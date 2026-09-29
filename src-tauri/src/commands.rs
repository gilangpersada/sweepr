//! `#[tauri::command]` handlers. Keep these thin: validate input, call a module, return data.

use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::cleaner::{
    Cleaner, CleanerError, CleanupPreview, CleanupResult, RecycleBinInfo, RuleInfo,
};
use crate::drives::{self, DriveInfo};
use crate::platform;
use crate::scanner::{
    CategorySize, ChildrenPage, FileView, NodeId, ScanError, ScanEvent, ScanId, ScanSessions,
    SkippedPage, SortBy, SortOrder,
};

/// Upper bound for page sizes requested by the UI, so one call never ships a huge payload.
const MAX_PAGE: usize = 5_000;

/// Response of the `ping` command. Serialized as camelCase to match the TypeScript types.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PingResponse {
    pub message: String,
    pub app_version: String,
}

/// Health check used to prove the frontend -> backend invoke flow works.
#[tauri::command]
pub fn ping() -> PingResponse {
    PingResponse {
        message: "pong".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
pub async fn list_drives() -> Vec<DriveInfo> {
    // `async` commands run off the main thread; querying drives can take a moment.
    drives::list_drives()
}

/// Starts a scan in the background and returns its id. Progress and the outcome arrive as
/// `scan-progress`, `scan-finished`, `scan-cancelled` or `scan-failed` events.
#[tauri::command]
pub fn start_scan(app: AppHandle, sessions: State<'_, ScanSessions>, path: String) -> ScanId {
    sessions.start(PathBuf::from(path), move |event| {
        let sent = match event {
            ScanEvent::Progress(e) => app.emit("scan-progress", e),
            ScanEvent::Finished(e) => app.emit("scan-finished", e),
            ScanEvent::Cancelled(e) => app.emit("scan-cancelled", e),
            ScanEvent::Failed(e) => app.emit("scan-failed", &e),
        };
        if let Err(err) = sent {
            eprintln!("failed to emit scan event: {err}");
        }
    })
}

#[tauri::command]
pub fn cancel_scan(sessions: State<'_, ScanSessions>, scan_id: ScanId) {
    sessions.cancel(scan_id);
}

#[tauri::command]
pub fn get_children(
    sessions: State<'_, ScanSessions>,
    scan_id: ScanId,
    node_id: u32,
    sort_by: SortBy,
    order: SortOrder,
    offset: usize,
    limit: usize,
) -> Result<ChildrenPage, ScanError> {
    let result = sessions.result(scan_id)?;
    result
        .tree
        .children_page(NodeId(node_id), sort_by, order, offset, limit.min(MAX_PAGE))
}

#[tauri::command]
pub fn get_largest_files(
    sessions: State<'_, ScanSessions>,
    scan_id: ScanId,
    limit: usize,
) -> Result<Vec<FileView>, ScanError> {
    let result = sessions.result(scan_id)?;
    Ok(result.tree.largest_files(limit.min(MAX_PAGE)))
}

/// Entries the scan could not read (FR-2), a page at a time.
#[tauri::command]
pub fn get_skipped(
    sessions: State<'_, ScanSessions>,
    scan_id: ScanId,
    offset: usize,
    limit: usize,
) -> Result<SkippedPage, ScanError> {
    let result = sessions.result(scan_id)?;
    Ok(result.skipped_page(offset, limit.min(MAX_PAGE)))
}

/// File size per category (video, photo, ...) below a node.
#[tauri::command]
pub async fn get_category_summary(
    sessions: State<'_, ScanSessions>,
    scan_id: ScanId,
    node_id: u32,
) -> Result<Vec<CategorySize>, ScanError> {
    // `async` so walking a whole-drive subtree never blocks the main thread.
    let result = sessions.result(scan_id)?;
    result
        .tree
        .category_summary(NodeId(node_id), &result.categories)
}

/// Full path of a node, for "copy path". Display only; never accepted back as input.
#[tauri::command]
pub fn get_node_path(
    sessions: State<'_, ScanSessions>,
    scan_id: ScanId,
    node_id: u32,
) -> Result<String, ScanError> {
    let result = sessions.result(scan_id)?;
    let path = result.tree.path(NodeId(node_id))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Shows a node in Explorer. Takes a node id, not a path: the path comes from the scan tree.
#[tauri::command]
pub async fn reveal_in_explorer(
    sessions: State<'_, ScanSessions>,
    scan_id: ScanId,
    node_id: u32,
) -> Result<(), ScanError> {
    let result = sessions.result(scan_id)?;
    let path = result.tree.path(NodeId(node_id))?;
    platform::reveal_in_file_manager(&path).map_err(|e| ScanError::from_io(path, e))
}

// ---------- cleaner ----------
// The UI never sends paths here: only rule ids, a preview id and item ids from that preview.

#[tauri::command]
pub fn list_cleaner_rules(cleaner: State<'_, Arc<Cleaner>>) -> Result<Vec<RuleInfo>, CleanerError> {
    cleaner.list_rules()
}

/// Finds what the given rules would clean. Can take a while (walks the user folder).
#[tauri::command]
pub async fn preview_cleanup(
    cleaner: State<'_, Arc<Cleaner>>,
    rule_ids: Vec<String>,
) -> Result<CleanupPreview, CleanerError> {
    blocking(&cleaner, move |c| c.preview(&rule_ids)).await
}

/// Moves the chosen items of a preview to the Recycle Bin.
#[tauri::command]
pub async fn execute_cleanup(
    cleaner: State<'_, Arc<Cleaner>>,
    preview_id: u64,
    item_ids: Vec<u32>,
) -> Result<CleanupResult, CleanerError> {
    blocking(&cleaner, move |c| c.execute(preview_id, &item_ids)).await
}

#[tauri::command]
pub async fn get_recycle_bin_info(
    cleaner: State<'_, Arc<Cleaner>>,
) -> Result<RecycleBinInfo, CleanerError> {
    blocking(&cleaner, |c| c.recycle_bin_info()).await
}

/// Permanently empties the Recycle Bin. The UI shows its own confirmation first.
#[tauri::command]
pub async fn empty_recycle_bin(cleaner: State<'_, Arc<Cleaner>>) -> Result<(), CleanerError> {
    blocking(&cleaner, |c| c.empty_recycle_bin()).await
}

/// Runs slow file-system work on Tauri's blocking pool instead of an async worker.
async fn blocking<T: Send + 'static>(
    cleaner: &Arc<Cleaner>,
    f: impl FnOnce(&Cleaner) -> Result<T, CleanerError> + Send + 'static,
) -> Result<T, CleanerError> {
    let cleaner = Arc::clone(cleaner);
    tauri::async_runtime::spawn_blocking(move || f(&cleaner))
        .await
        .map_err(|e| CleanerError::Internal(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_returns_pong_and_version() {
        let res = ping();
        assert_eq!(res.message, "pong");
        assert_eq!(res.app_version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn ping_serializes_as_camel_case() {
        let json = serde_json::to_value(ping()).unwrap();
        assert_eq!(json["message"], "pong");
        assert!(json.get("appVersion").is_some());
        assert!(json.get("app_version").is_none());
    }
}
