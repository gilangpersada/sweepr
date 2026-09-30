//! Recycle Bin contents and restore (D-039). Read docs/SAFETY_RULES.md before changing this.
//!
//! Windows keeps every deleted item as a pair in `X:\$Recycle.Bin\<SID>\`: `$R<id><.ext>` is
//! the data and `$I<id><.ext>` records the original path, size and deletion time. The list
//! is read from the `$I` records (the shell's display names hide known extensions, so they
//! cannot be trusted to rebuild the original path).
//!
//! Flow, like the cleaner preview: `list` keeps the entries in memory under a `list_id`; the
//! UI sends back that id plus item ids, never paths. `restore` consumes the list, checks each
//! item again, and moves `$R` back with `move_no_replace`, which never overwrites anything.
//! No permanent delete here: emptying the bin stays the only one (D-003).

use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::Serialize;

use super::log::{ActionLog, LogEntry, LogWriter};
use super::{now_millis, reason, shown, CleanerError, FailReason, MAX_ITEMS, PREVIEW_TTL};
use crate::platform;

/// Where the items come from and how they move back. A trait so tests use a temp folder.
pub trait BinSource: Send + Sync {
    /// Storage paths of the `$R...` data items, on all drives.
    fn item_paths(&self) -> io::Result<Vec<PathBuf>>;
    /// Moves `from` to `to`; must fail with `AlreadyExists` instead of replacing `to`.
    fn move_no_replace(&self, from: &Path, to: &Path) -> io::Result<()>;
}

/// The real Recycle Bin of the current user.
pub struct SystemBin;

impl BinSource for SystemBin {
    fn item_paths(&self) -> io::Result<Vec<PathBuf>> {
        platform::recycle_bin_item_paths()
    }

    fn move_no_replace(&self, from: &Path, to: &Path) -> io::Result<()> {
        platform::move_no_replace(from, to)
    }
}

/// One row of the list for the UI. Paths are for display only.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinItem {
    pub item_id: u32,
    /// Original file or folder name, with its extension.
    pub name: String,
    pub original_path: String,
    /// Drive of the original location, e.g. "C:".
    pub drive: String,
    /// Original size in bytes as recorded by Windows (folders: everything inside).
    pub size: u64,
    pub is_dir: bool,
    /// Unix seconds.
    pub deleted: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinDrive {
    pub drive: String,
    pub size: u64,
    pub item_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinListing {
    pub list_id: u64,
    /// Newest first.
    pub items: Vec<BinItem>,
    /// Totals per drive, by drive letter.
    pub drives: Vec<BinDrive>,
    /// Items whose record could not be read; they are left out and never restored.
    pub unreadable_count: usize,
    pub max_items: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreOutcome {
    pub item_id: u32,
    pub path: String,
    pub size: u64,
    /// `None` when the item is back at its original location.
    pub error: Option<FailReason>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub list_id: u64,
    pub restored_count: usize,
    pub restored_bytes: u64,
    pub failed_count: usize,
    pub items: Vec<RestoreOutcome>,
}

/// What a `$I` record says.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecycleRecord {
    pub original: PathBuf,
    pub size: u64,
    /// Unix seconds.
    pub deleted: i64,
}

struct StoredEntry {
    data: PathBuf,
    record_path: PathBuf,
    record: RecycleRecord,
}

struct StoredList {
    id: u64,
    created: Instant,
    /// Index = item id.
    entries: Vec<StoredEntry>,
}

#[derive(Default)]
struct State {
    next_id: u64,
    list: Option<StoredList>,
}

pub struct RecycleBin {
    source: Box<dyn BinSource>,
    log: ActionLog,
    ttl: Duration,
    state: Mutex<State>,
}

impl RecycleBin {
    /// The app's Recycle Bin, logging to the cleaner's log file.
    pub fn for_app(log_path: PathBuf) -> Self {
        RecycleBin::new(Box::new(SystemBin), log_path)
    }

    fn new(source: Box<dyn BinSource>, log_path: PathBuf) -> Self {
        RecycleBin {
            source,
            log: ActionLog::new(log_path),
            ttl: PREVIEW_TTL,
            state: Mutex::default(),
        }
    }

    /// Reads the bin, replacing any earlier list.
    pub fn list(&self) -> Result<BinListing, CleanerError> {
        let paths = self
            .source
            .item_paths()
            .map_err(|e| CleanerError::RecycleBin(e.to_string()))?;
        let mut entries = Vec::new();
        let mut unreadable = 0;
        for data in paths {
            match read_entry(&data) {
                Some(entry) => entries.push(entry),
                None => unreadable += 1,
            }
        }
        entries.sort_by(|a, b| {
            b.record
                .deleted
                .cmp(&a.record.deleted)
                .then_with(|| a.record.original.cmp(&b.record.original))
        });

        let mut items = Vec::with_capacity(entries.len());
        let mut drives: BTreeMap<String, BinDrive> = BTreeMap::new();
        for (i, e) in entries.iter().enumerate() {
            let item_id = u32::try_from(i).map_err(|e| CleanerError::Internal(e.to_string()))?;
            let drive = drive_of(&e.record.original);
            let d = drives.entry(drive.clone()).or_insert_with(|| BinDrive {
                drive: drive.clone(),
                size: 0,
                item_count: 0,
            });
            d.size += e.record.size;
            d.item_count += 1;
            items.push(BinItem {
                item_id,
                name: e
                    .record
                    .original
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                original_path: shown(&e.record.original),
                drive,
                size: e.record.size,
                is_dir: fs::symlink_metadata(&e.data).is_ok_and(|m| m.is_dir()),
                deleted: e.record.deleted,
            });
        }

        let mut state = self.lock();
        state.next_id += 1;
        let list_id = state.next_id;
        state.list = Some(StoredList {
            id: list_id,
            created: Instant::now(),
            entries,
        });
        Ok(BinListing {
            list_id,
            items,
            drives: drives.into_values().collect(),
            unreadable_count: unreadable,
            max_items: MAX_ITEMS,
        })
    }

    /// Moves the chosen items back to where they were deleted from. The list is consumed,
    /// so the same ids never run twice. An item whose original location is taken is
    /// skipped: nothing is ever replaced or renamed.
    pub fn restore(&self, list_id: u64, item_ids: &[u32]) -> Result<RestoreResult, CleanerError> {
        let ids: Vec<u32> = {
            let mut seen = HashSet::new();
            item_ids
                .iter()
                .copied()
                .filter(|id| seen.insert(*id))
                .collect()
        };
        if ids.len() > MAX_ITEMS {
            return Err(CleanerError::TooManyItems {
                count: ids.len(),
                max: MAX_ITEMS,
            });
        }
        let list = {
            let mut state = self.lock();
            match &state.list {
                Some(l) if l.id == list_id => {}
                _ => return Err(CleanerError::UnknownPreview(list_id)),
            }
            let list = state.list.take().expect("checked above");
            if list.created.elapsed() > self.ttl {
                return Err(CleanerError::PreviewExpired);
            }
            list
        };
        let mut log = self
            .log
            .open()
            .map_err(|e| CleanerError::LogUnavailable(e.to_string()))?;

        let mut outcomes = Vec::with_capacity(ids.len());
        for id in ids {
            let Some(entry) = list.entries.get(id as usize) else {
                let o = RestoreOutcome {
                    item_id: id,
                    path: String::new(),
                    size: 0,
                    error: Some(reason("unknownItem", "item is not part of this list")),
                };
                record(&mut log, &mut outcomes, list.id, o);
                continue;
            };
            let error = self.restore_one(entry).err();
            let o = RestoreOutcome {
                item_id: id,
                path: shown(&entry.record.original),
                size: entry.record.size,
                error,
            };
            record(&mut log, &mut outcomes, list.id, o);
        }

        let restored: Vec<_> = outcomes.iter().filter(|o| o.error.is_none()).collect();
        Ok(RestoreResult {
            list_id: list.id,
            restored_count: restored.len(),
            restored_bytes: restored.iter().map(|o| o.size).sum(),
            failed_count: outcomes.len() - restored.len(),
            items: outcomes,
        })
    }

    /// The checks right before moving (SAFETY_RULES: validate again before acting), then the
    /// move itself.
    fn restore_one(&self, entry: &StoredEntry) -> Result<(), FailReason> {
        if fs::symlink_metadata(&entry.data).is_err() {
            return Err(reason("notFound", "item is no longer in the Recycle Bin"));
        }
        match fs::read(&entry.record_path)
            .ok()
            .and_then(|b| parse_record(&b))
        {
            Some(r) if r == entry.record => {}
            _ => return Err(reason("changed", "item changed since the list was made")),
        }
        let target = &entry.record.original;
        match fs::symlink_metadata(target) {
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Ok(_) => return Err(reason("originalExists", "the original location is taken")),
            Err(e) => return Err(reason("io", &e.to_string())),
        }
        let parent = target
            .parent()
            .ok_or_else(|| reason("notAbsolute", "original path has no folder"))?;
        match fs::symlink_metadata(parent) {
            Ok(m) if m.is_dir() && !platform::is_link(&m) => {}
            Ok(_) => return Err(reason("insideLink", "original folder is a link")),
            Err(_) => {
                return Err(reason(
                    "originalFolderMissing",
                    "the original folder no longer exists",
                ))
            }
        }
        // No link anywhere above it either (hard rule 4): the canonical form resolves links,
        // so it only matches when there are none.
        match fs::canonicalize(parent) {
            Ok(c) if platform::path_eq(&platform::display_path(&c), parent) => {}
            _ => return Err(reason("insideLink", "original folder is inside a link")),
        }

        match self.source.move_no_replace(&entry.data, target) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
                return Err(reason("originalExists", "the original location is taken"))
            }
            Err(e) => return Err(reason("restoreFailed", &e.to_string())),
        }
        // The record is the bin's bookkeeping for an item that is no longer there; Windows
        // removes it the same way when restoring. Failing here leaves a harmless orphan.
        if let Err(e) = fs::remove_file(&entry.record_path) {
            eprintln!("could not remove {:?}: {e}", entry.record_path);
        }
        Ok(())
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// `...\$Recycle.Bin\<SID>\$R<id>` plus its readable `$I` record, or `None`.
fn read_entry(data: &Path) -> Option<StoredEntry> {
    let record_path = record_path_for(data)?;
    let record = parse_record(&fs::read(&record_path).ok()?)?;
    fs::symlink_metadata(data).ok()?;
    Some(StoredEntry {
        data: data.to_path_buf(),
        record_path,
        record,
    })
}

/// `$R` data path -> `$I` record path. Only accepts paths directly inside a
/// `$Recycle.Bin\<SID>` folder, so a stray path can never be treated as a bin item.
fn record_path_for(data: &Path) -> Option<PathBuf> {
    if !data.is_absolute() {
        return None;
    }
    let name = data.file_name()?.to_str()?;
    let rest = name.strip_prefix("$R")?;
    let sid_dir = data.parent()?;
    let bin = sid_dir.parent()?.file_name()?.to_str()?;
    if !bin.eq_ignore_ascii_case("$Recycle.Bin") || rest.is_empty() {
        return None;
    }
    Some(sid_dir.join(format!("$I{rest}")))
}

/// January 1, 1970 as a Windows FILETIME (100 ns ticks since 1601).
const EPOCH_AS_FILETIME: u64 = 116_444_736_000_000_000;

/// Parses a `$I` record: version 1 (Vista–8.1: fixed 260-char path) or 2 (Windows 10+:
/// length-prefixed path). Layout: version u64, size u64, deletion FILETIME u64, path.
pub fn parse_record(bytes: &[u8]) -> Option<RecycleRecord> {
    let u64_at = |at: usize| Some(u64::from_le_bytes(bytes.get(at..at + 8)?.try_into().ok()?));
    let version = u64_at(0)?;
    let size = u64_at(8)?;
    let filetime = u64_at(16)?;
    let path_bytes = match version {
        1 => bytes.get(24..24 + 520)?,
        2 => {
            let chars = u32::from_le_bytes(bytes.get(24..28)?.try_into().ok()?) as usize;
            bytes.get(28..28 + chars.checked_mul(2)?)?
        }
        _ => return None,
    };
    let units: Vec<u16> = path_bytes
        .as_chunks::<2>()
        .0
        .iter()
        .map(|&c| u16::from_le_bytes(c))
        .take_while(|&u| u != 0)
        .collect();
    let original = PathBuf::from(String::from_utf16(&units).ok()?);
    // Only full paths with a file name: anything else cannot be a place to restore to.
    if !original.is_absolute() || original.file_name().is_none() {
        return None;
    }
    let deleted = (filetime.saturating_sub(EPOCH_AS_FILETIME) / 10_000_000) as i64;
    Some(RecycleRecord {
        original,
        size,
        deleted,
    })
}

/// "C:" for `C:\x\y`; the first component otherwise.
fn drive_of(path: &Path) -> String {
    match path.components().next() {
        Some(Component::Prefix(p)) => p.as_os_str().to_string_lossy().to_uppercase(),
        Some(c) => c.as_os_str().to_string_lossy().into_owned(),
        None => String::new(),
    }
}

fn record(
    log: &mut LogWriter,
    outcomes: &mut Vec<RestoreOutcome>,
    list_id: u64,
    o: RestoreOutcome,
) {
    let entry = LogEntry {
        ts: now_millis(),
        action: "restore",
        preview_id: Some(list_id),
        rule_id: None,
        path: Some(&o.path),
        size: o.size,
        ok: o.error.is_none(),
        reason: o.error.as_ref().map(|r| r.code.as_str()),
    };
    if let Err(e) = log.write(&entry) {
        eprintln!("cleanup log write failed: {e}");
    }
    outcomes.push(o);
}

#[cfg(test)]
mod tests;
