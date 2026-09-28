//! Parallel traversal that builds a `ScanTree`.
//!
//! `jwalk` reads directories on a rayon thread pool but yields entries on the calling thread
//! in strict depth-first order. That lets us track each entry's parent with a small stack
//! indexed by depth instead of a path -> id map.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, UNIX_EPOCH};

use jwalk::rayon::prelude::*;
use jwalk::WalkDirGeneric;

use super::error::ScanError;
use super::tree::{NodeId, ScanTree};

#[derive(Debug, Clone)]
pub struct ScanOptions {
    /// Minimum time between two progress callbacks.
    pub progress_interval: Duration,
}

impl Default for ScanOptions {
    fn default() -> Self {
        ScanOptions {
            progress_interval: Duration::from_millis(100),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Progress {
    pub files_seen: u64,
    pub dirs_seen: u64,
    pub bytes_seen: u64,
    pub current_path: PathBuf,
}

/// An entry that could not be read (e.g. access denied). The scan continues without it.
#[derive(Debug, Clone)]
pub struct Skipped {
    pub path: PathBuf,
    pub reason: String,
}

#[derive(Debug)]
pub struct ScanResult {
    pub root_path: PathBuf,
    pub tree: ScanTree,
    pub skipped: Vec<Skipped>,
    pub elapsed: Duration,
}

#[derive(Debug)]
pub enum ScanOutcome {
    Completed(ScanResult),
    Cancelled,
}

/// Per-entry metadata, filled in parallel inside jwalk's `process_read_dir` callback.
#[derive(Debug, Default)]
struct EntryMeta {
    size: u64,
    modified: Option<i64>,
    error: Option<String>,
}

type Walk = WalkDirGeneric<((), EntryMeta)>;

/// Scans `root` recursively. Never follows symlinks or junctions (a root that is one is
/// rejected). Unreadable entries end up in `ScanResult::skipped`.
///
/// Blocks the calling thread; run it off the UI thread. Set `cancel` to stop early.
pub fn scan(
    root: &Path,
    cancel: Arc<AtomicBool>,
    options: &ScanOptions,
    mut on_progress: impl FnMut(&Progress),
) -> Result<ScanOutcome, ScanError> {
    let started = Instant::now();
    let root_meta = check_root(root)?;
    let mut tree = ScanTree::new(root.as_os_str(), modified_secs(&root_meta));
    let mut skipped = Vec::new();
    // stack[d] = folder node at depth d on the current depth-first path.
    let mut stack: Vec<NodeId> = Vec::new();
    let (mut files, mut dirs, mut bytes) = (0u64, 0u64, 0u64);
    let mut last_progress = Instant::now();

    let cancel_in_walk = Arc::clone(&cancel);
    let walk = Walk::new(root)
        .follow_links(false)
        .skip_hidden(false)
        .sort(false)
        .process_read_dir(move |_depth, _dir, _state, children| {
            if cancel_in_walk.load(Ordering::Relaxed) {
                // Stop descending; the main loop notices the flag and bails out.
                children.clear();
                return;
            }
            // Symlinks and junctions both report `is_symlink()` (on Windows std treats any
            // name-surrogate reparse point as a link), so neither is listed nor entered.
            children.retain(|c| !matches!(c, Ok(e) if e.file_type.is_symlink()));
            children.par_iter_mut().flatten().for_each(|entry| {
                match fs::symlink_metadata(entry.parent_path.join(&entry.file_name)) {
                    Ok(m) => {
                        entry.client_state.size = if m.is_dir() { 0 } else { m.len() };
                        entry.client_state.modified = modified_secs(&m);
                    }
                    Err(e) => {
                        entry.client_state.error = Some(e.to_string());
                        // Without metadata we skip the entry, so never read below it either.
                        entry.read_children = None;
                    }
                }
            });
        });

    for result in walk {
        if cancel.load(Ordering::Relaxed) {
            return Ok(ScanOutcome::Cancelled);
        }
        let entry = match result {
            Ok(entry) => entry,
            Err(e) => {
                skipped.push(Skipped {
                    path: e.path().map(Path::to_path_buf).unwrap_or_default(),
                    reason: e.to_string(),
                });
                continue;
            }
        };

        if entry.depth == 0 {
            if let Some(err) = entry.read_children.as_ref().and_then(|rc| rc.error()) {
                return Err(ScanError::Io {
                    path: root.to_path_buf(),
                    source: io::Error::other(err.to_string()),
                });
            }
            stack.push(NodeId::ROOT);
            continue;
        }

        let Some(&parent) = stack.get(entry.depth - 1) else {
            debug_assert!(false, "jwalk yielded an entry without its parent");
            continue;
        };
        let meta = &entry.client_state;
        if let Some(reason) = &meta.error {
            skipped.push(Skipped {
                path: entry.path(),
                reason: reason.clone(),
            });
            continue;
        }

        let is_dir = entry.file_type.is_dir();
        let id = tree.push(parent, &entry.file_name, is_dir, meta.size, meta.modified);
        if is_dir {
            dirs += 1;
            stack.truncate(entry.depth);
            stack.push(id);
            if let Some(err) = entry.read_children.as_ref().and_then(|rc| rc.error()) {
                skipped.push(Skipped {
                    path: entry.path(),
                    reason: read_error_reason(err),
                });
            }
        } else {
            files += 1;
            bytes += meta.size;
        }

        if last_progress.elapsed() >= options.progress_interval {
            on_progress(&Progress {
                files_seen: files,
                dirs_seen: dirs,
                bytes_seen: bytes,
                current_path: entry.path(),
            });
            last_progress = Instant::now();
        }
    }

    // The callback may have cut the walk short after the last check in the loop.
    if cancel.load(Ordering::Relaxed) {
        return Ok(ScanOutcome::Cancelled);
    }

    tree.aggregate();
    Ok(ScanOutcome::Completed(ScanResult {
        root_path: root.to_path_buf(),
        tree,
        skipped,
        elapsed: started.elapsed(),
    }))
}

fn check_root(root: &Path) -> Result<fs::Metadata, ScanError> {
    let meta = fs::symlink_metadata(root).map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => ScanError::NotFound(root.to_path_buf()),
        _ => ScanError::Io {
            path: root.to_path_buf(),
            source: e,
        },
    })?;
    if meta.file_type().is_symlink() {
        return Err(ScanError::IsLink(root.to_path_buf()));
    }
    if !meta.is_dir() {
        return Err(ScanError::NotADirectory(root.to_path_buf()));
    }
    Ok(meta)
}

/// jwalk's error text repeats the path; keep only the underlying OS reason.
fn read_error_reason(err: &jwalk::Error) -> String {
    err.io_error()
        .map(ToString::to_string)
        .unwrap_or_else(|| err.to_string())
}

fn modified_secs(meta: &fs::Metadata) -> Option<i64> {
    let secs = meta
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_secs();
    i64::try_from(secs).ok()
}
