//! Scan lifecycle: runs one scan at a time on a background thread, keeps the latest result,
//! and reports events through a callback. No Tauri types here, so it is testable directly.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use serde::Serialize;

use super::error::ScanError;
use super::walk::{scan, Progress, ScanOptions, ScanOutcome, ScanResult};

pub type ScanId = u64;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressEvent {
    pub scan_id: ScanId,
    pub files_seen: u64,
    pub dirs_seen: u64,
    pub bytes_seen: u64,
    pub current_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFinishedEvent {
    pub scan_id: ScanId,
    pub root_path: String,
    /// Always 0; the root node id to pass to `get_children`.
    pub root_id: u32,
    pub total_bytes: u64,
    pub total_files: u32,
    pub node_count: usize,
    pub skipped_count: usize,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCancelledEvent {
    pub scan_id: ScanId,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFailedEvent {
    pub scan_id: ScanId,
    pub error: ScanError,
}

#[derive(Debug)]
pub enum ScanEvent {
    Progress(ScanProgressEvent),
    Finished(ScanFinishedEvent),
    Cancelled(ScanCancelledEvent),
    Failed(ScanFailedEvent),
}

#[derive(Default)]
struct Inner {
    next_id: ScanId,
    /// The running scan, if any.
    active: Option<(ScanId, Arc<AtomicBool>)>,
    /// Result of the latest completed scan. Dropped as soon as a new scan starts.
    result: Option<(ScanId, Arc<ScanResult>)>,
}

#[derive(Default, Clone)]
pub struct ScanSessions {
    inner: Arc<Mutex<Inner>>,
    options: ScanOptions,
}

impl ScanSessions {
    pub fn new(options: ScanOptions) -> Self {
        ScanSessions {
            inner: Arc::default(),
            options,
        }
    }

    /// Starts scanning `root` on a new thread, cancelling any scan already running.
    /// `on_event` is called from that thread.
    pub fn start(&self, root: PathBuf, on_event: impl Fn(ScanEvent) + Send + 'static) -> ScanId {
        let cancel = Arc::new(AtomicBool::new(false));
        let scan_id = {
            let mut inner = lock(&self.inner);
            if let Some((_, old)) = inner.active.take() {
                old.store(true, Ordering::Relaxed);
            }
            inner.result = None;
            inner.next_id += 1;
            inner.active = Some((inner.next_id, Arc::clone(&cancel)));
            inner.next_id
        };

        let shared = Arc::clone(&self.inner);
        let options = self.options.clone();
        thread::spawn(move || {
            let outcome = scan(&root, Arc::clone(&cancel), &options, |p: &Progress| {
                on_event(ScanEvent::Progress(ScanProgressEvent {
                    scan_id,
                    files_seen: p.files_seen,
                    dirs_seen: p.dirs_seen,
                    bytes_seen: p.bytes_seen,
                    current_path: p.current_path.to_string_lossy().into_owned(),
                }));
            });

            let event = {
                let mut inner = lock(&shared);
                let is_current = matches!(&inner.active, Some((id, _)) if *id == scan_id);
                if is_current {
                    inner.active = None;
                }
                match outcome {
                    Ok(ScanOutcome::Completed(result)) if is_current => {
                        let event = finished_event(scan_id, &result);
                        inner.result = Some((scan_id, Arc::new(result)));
                        ScanEvent::Finished(event)
                    }
                    // Superseded by a newer scan: treat as cancelled, keep nothing.
                    Ok(_) => ScanEvent::Cancelled(ScanCancelledEvent { scan_id }),
                    Err(error) => ScanEvent::Failed(ScanFailedEvent { scan_id, error }),
                }
            };
            on_event(event);
        });
        scan_id
    }

    /// Requests cancellation. Unknown or already finished ids are ignored.
    pub fn cancel(&self, scan_id: ScanId) {
        let inner = lock(&self.inner);
        if let Some((id, flag)) = &inner.active {
            if *id == scan_id {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }

    /// The completed result of `scan_id`, if it is still the latest one.
    pub fn result(&self, scan_id: ScanId) -> Result<Arc<ScanResult>, ScanError> {
        match &lock(&self.inner).result {
            Some((id, result)) if *id == scan_id => Ok(Arc::clone(result)),
            _ => Err(ScanError::UnknownScan(scan_id)),
        }
    }
}

fn finished_event(scan_id: ScanId, result: &ScanResult) -> ScanFinishedEvent {
    let root = result.tree.root();
    ScanFinishedEvent {
        scan_id,
        root_path: result.root_path.to_string_lossy().into_owned(),
        root_id: 0,
        total_bytes: root.size,
        total_files: root.file_count,
        node_count: result.tree.len(),
        skipped_count: result.skipped.len(),
        elapsed_ms: u64::try_from(result.elapsed.as_millis()).unwrap_or(u64::MAX),
    }
}

/// A panic while holding the lock must not brick every later command, so ignore poisoning.
fn lock(m: &Mutex<Inner>) -> MutexGuard<'_, Inner> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}
