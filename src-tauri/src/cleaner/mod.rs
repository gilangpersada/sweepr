//! Cleaner: rule loading, preview, execute (Recycle Bin only, D-003).
//! Read docs/SAFETY_RULES.md before changing anything here.
//!
//! Flow: `preview` finds candidates, validates each with `SafetyPolicy`, and keeps them in
//! memory under a `preview_id`. The UI only ever sends back that id plus item ids.
//! `execute` consumes the preview, re-validates every item, checks it still matches the
//! rule and fits in the Recycle Bin, then trashes it and logs the outcome.

mod log;
mod matcher;
mod rules;

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

use crate::platform::{self, RecycleLimit};
use crate::safety::SafetyPolicy;
use log::{ActionLog, LogEntry, LogWriter};
use rules::Rule;
pub use rules::{Group, Risk, RuleError};

/// Most items a single execution may touch (SAFETY_RULES), also the cap per rule in a
/// preview.
pub const MAX_ITEMS: usize = 10_000;
/// A preview older than this is refused; the disk may have changed a lot since.
pub const PREVIEW_TTL: Duration = Duration::from_secs(30 * 60);
/// Items are trashed in batches; a failed batch is retried item by item.
const TRASH_BATCH: usize = 100;

/// Moves paths to the Recycle Bin. A trait so tests never touch the real bin.
pub trait Trasher: Send + Sync {
    fn trash(&self, paths: &[PathBuf]) -> Result<(), String>;
    fn limit(&self, path: &Path) -> RecycleLimit;
}

/// The real Recycle Bin, via the `trash` crate (IFileOperation with FOF_ALLOWUNDO).
pub struct SystemTrasher;

impl Trasher for SystemTrasher {
    fn trash(&self, paths: &[PathBuf]) -> Result<(), String> {
        trash::delete_all(paths).map_err(|e| e.to_string())
    }

    fn limit(&self, path: &Path) -> RecycleLimit {
        platform::recycle_bin_limit(path)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CleanerError {
    #[error("cleaner rules are invalid: {0}")]
    RulesInvalid(String),
    #[error("unknown rule: {0}")]
    UnknownRule(String),
    #[error("preview {0} is unknown or was already used")]
    UnknownPreview(u64),
    #[error("the preview is too old; make a new one")]
    PreviewExpired,
    #[error("{count} items selected; at most {max} per run")]
    TooManyItems { count: usize, max: usize },
    #[error("cannot write the cleanup log: {0}")]
    LogUnavailable(String),
    #[error("Recycle Bin: {0}")]
    RecycleBin(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl CleanerError {
    pub fn code(&self) -> &'static str {
        match self {
            CleanerError::RulesInvalid(_) => "rulesInvalid",
            CleanerError::UnknownRule(_) => "unknownRule",
            CleanerError::UnknownPreview(_) => "unknownPreview",
            CleanerError::PreviewExpired => "previewExpired",
            CleanerError::TooManyItems { .. } => "tooManyItems",
            CleanerError::LogUnavailable(_) => "logUnavailable",
            CleanerError::RecycleBin(_) => "recycleBin",
            CleanerError::Internal(_) => "internal",
        }
    }
}

impl Serialize for CleanerError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("CleanerError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

/// Rule metadata for the UI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleInfo {
    pub id: String,
    pub name: String,
    pub group: Group,
    pub description: String,
    pub risk: Risk,
    pub default_checked: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewItem {
    pub item_id: u32,
    /// For display only; never accepted back from the UI.
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<i64>,
    /// `named_directory` rules: when the project last changed (newest of the marker file
    /// and the project folder), which is what the age check uses. `None` for plain files.
    pub project_modified: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RulePreview {
    #[serde(flatten)]
    pub rule: RuleInfo,
    /// Largest first, at most `MAX_ITEMS`.
    pub items: Vec<PreviewItem>,
    pub total_bytes: u64,
    /// More matches existed than `MAX_ITEMS`; only the largest are listed.
    pub truncated: bool,
    /// Matches left out by safety checks or on purpose (never listed).
    pub excluded_count: usize,
    pub unreadable_count: usize,
    /// Allowed roots that could not be used (missing folder, protected, link, ...).
    pub root_problems: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPreview {
    pub preview_id: u64,
    pub max_items: usize,
    pub rules: Vec<RulePreview>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FailReason {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemOutcome {
    pub item_id: u32,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    /// `None` when the item is now in the Recycle Bin.
    pub error: Option<FailReason>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupResult {
    pub preview_id: u64,
    pub trashed_count: usize,
    /// Moved to the Recycle Bin; freed only once the bin is emptied.
    pub trashed_bytes: u64,
    pub failed_count: usize,
    pub items: Vec<ItemOutcome>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecycleBinInfo {
    pub size_bytes: u64,
    pub item_count: u64,
}

struct StoredRule {
    rule: Rule,
    roots: Vec<PathBuf>,
}

struct StoredItem {
    rule: usize,
    path: PathBuf,
    is_dir: bool,
    size: u64,
    fingerprint: matcher::Fingerprint,
}

struct StoredPreview {
    id: u64,
    created: Instant,
    rules: Vec<StoredRule>,
    /// Index = item id.
    items: Vec<StoredItem>,
}

#[derive(Default)]
struct State {
    next_id: u64,
    preview: Option<StoredPreview>,
}

type VarLookup = Box<dyn Fn(&str) -> Option<PathBuf> + Send + Sync>;

pub struct Cleaner {
    rules: Result<Vec<Rule>, RuleError>,
    policy: SafetyPolicy,
    trasher: Box<dyn Trasher>,
    log: ActionLog,
    vars: VarLookup,
    preview_ttl: Duration,
    state: Mutex<State>,
}

impl Cleaner {
    /// The app's cleaner: embedded rules for this OS, the real denylist and Recycle Bin.
    pub fn for_app(log_path: PathBuf) -> Self {
        Cleaner::new(
            rules::load_rules(platform::CLEANER_RULES_JSON, std::env::consts::OS),
            SafetyPolicy::for_current_user(),
            Box::new(SystemTrasher),
            log_path,
            Box::new(rules::system_var),
        )
    }

    fn new(
        rules: Result<Vec<Rule>, RuleError>,
        policy: SafetyPolicy,
        trasher: Box<dyn Trasher>,
        log_path: PathBuf,
        vars: VarLookup,
    ) -> Self {
        Cleaner {
            rules,
            policy,
            trasher,
            log: ActionLog::new(log_path),
            vars,
            preview_ttl: PREVIEW_TTL,
            state: Mutex::default(),
        }
    }

    fn rules(&self) -> Result<&[Rule], CleanerError> {
        self.rules
            .as_deref()
            .map_err(|e| CleanerError::RulesInvalid(e.to_string()))
    }

    pub fn list_rules(&self) -> Result<Vec<RuleInfo>, CleanerError> {
        Ok(self.rules()?.iter().map(rule_info).collect())
    }

    /// Builds a preview for the given rules, replacing any earlier preview.
    pub fn preview(&self, rule_ids: &[String]) -> Result<CleanupPreview, CleanerError> {
        let all = self.rules()?;
        let mut seen = HashSet::new();
        let mut chosen = Vec::new();
        for id in rule_ids {
            let rule = all
                .iter()
                .find(|r| &r.id == id)
                .ok_or_else(|| CleanerError::UnknownRule(id.clone()))?;
            if seen.insert(id) {
                chosen.push(rule.clone());
            }
        }

        let now = now_secs();
        let mut stored_rules = Vec::new();
        let mut items = Vec::new();
        let mut out = Vec::new();
        for rule in chosen {
            let mut roots = Vec::new();
            let mut root_problems = Vec::new();
            for raw in &rule.allowed_roots {
                match rules::expand_vars(raw, &self.vars)
                    .and_then(|p| self.policy.resolve_root(&p).map_err(|e| e.to_string()))
                {
                    Ok(root) => roots.push(root),
                    Err(problem) => root_problems.push(problem),
                }
            }

            let found = matcher::find(&rule.matcher, &roots, &self.policy, now);
            let mut excluded = found.excluded;
            let mut valid: Vec<_> = found
                .candidates
                .into_iter()
                .filter(|c| {
                    // Anything the policy refuses is never shown (TASKS M3 criterion).
                    let ok = self.policy.validate(&c.path, &roots).is_ok();
                    excluded += usize::from(!ok);
                    ok
                })
                .collect();
            valid.sort_by(|a, b| b.size.cmp(&a.size).then_with(|| a.path.cmp(&b.path)));
            let truncated = valid.len() > MAX_ITEMS;
            valid.truncate(MAX_ITEMS);

            let rule_idx = stored_rules.len();
            let mut view_items = Vec::with_capacity(valid.len());
            for c in valid {
                let item_id = u32::try_from(items.len())
                    .map_err(|e| CleanerError::Internal(e.to_string()))?;
                view_items.push(PreviewItem {
                    item_id,
                    path: shown(&c.path),
                    is_dir: c.is_dir,
                    size: c.size,
                    modified: c.modified,
                    project_modified: c
                        .fingerprint
                        .marker_modified
                        .max(c.fingerprint.project_modified),
                });
                items.push(StoredItem {
                    rule: rule_idx,
                    path: c.path,
                    is_dir: c.is_dir,
                    size: c.size,
                    fingerprint: c.fingerprint,
                });
            }
            out.push(RulePreview {
                rule: rule_info(&rule),
                total_bytes: view_items.iter().map(|i| i.size).sum(),
                items: view_items,
                truncated,
                excluded_count: excluded,
                unreadable_count: found.unreadable,
                root_problems,
            });
            stored_rules.push(StoredRule { rule, roots });
        }

        let mut state = self.lock();
        state.next_id += 1;
        let preview_id = state.next_id;
        state.preview = Some(StoredPreview {
            id: preview_id,
            created: Instant::now(),
            rules: stored_rules,
            items,
        });
        Ok(CleanupPreview {
            preview_id,
            max_items: MAX_ITEMS,
            rules: out,
        })
    }

    /// Moves the selected preview items to the Recycle Bin. The preview is consumed, so the
    /// same ids can never run twice.
    pub fn execute(
        &self,
        preview_id: u64,
        item_ids: &[u32],
    ) -> Result<CleanupResult, CleanerError> {
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
        let preview = {
            let mut state = self.lock();
            match &state.preview {
                Some(p) if p.id == preview_id => {}
                _ => return Err(CleanerError::UnknownPreview(preview_id)),
            }
            let preview = state.preview.take().expect("checked above");
            if preview.created.elapsed() > self.preview_ttl {
                return Err(CleanerError::PreviewExpired);
            }
            preview
        };
        let mut log = self
            .log
            .open()
            .map_err(|e| CleanerError::LogUnavailable(e.to_string()))?;

        let now = now_secs();
        let mut outcomes: Vec<ItemOutcome> = Vec::with_capacity(ids.len());
        let mut ready: Vec<(u32, &StoredItem)> = Vec::new();
        for id in ids {
            let Some(item) = preview.items.get(id as usize) else {
                let o = ItemOutcome {
                    item_id: id,
                    path: String::new(),
                    size: 0,
                    is_dir: false,
                    error: Some(reason("unknownItem", "item is not part of this preview")),
                };
                record(&mut log, &mut outcomes, &preview, o);
                continue;
            };
            match self.check_item(&preview, item, now) {
                Ok(()) => ready.push((id, item)),
                Err(why) => record(
                    &mut log,
                    &mut outcomes,
                    &preview,
                    outcome(id, item, Some(why)),
                ),
            }
        }

        for batch in ready.chunks(TRASH_BATCH) {
            let paths: Vec<PathBuf> = batch.iter().map(|(_, i)| i.path.clone()).collect();
            let batch_ok = self.trasher.trash(&paths).is_ok();
            for &(id, item) in batch {
                let error = if batch_ok && is_gone(&item.path) {
                    None
                } else if batch_ok {
                    Some(reason("stillExists", "item is still there after moving"))
                } else {
                    // Retry alone so one locked file does not fail the whole batch.
                    match self.trasher.trash(std::slice::from_ref(&item.path)) {
                        Ok(()) if is_gone(&item.path) => None,
                        Ok(()) => Some(reason("stillExists", "item is still there after moving")),
                        Err(e) => Some(reason("trashFailed", &e)),
                    }
                };
                record(&mut log, &mut outcomes, &preview, outcome(id, item, error));
            }
        }

        outcomes.sort_by_key(|o| o.item_id);
        let trashed: Vec<_> = outcomes.iter().filter(|o| o.error.is_none()).collect();
        Ok(CleanupResult {
            preview_id: preview.id,
            trashed_count: trashed.len(),
            trashed_bytes: trashed.iter().map(|o| o.size).sum(),
            failed_count: outcomes.len() - trashed.len(),
            items: outcomes,
        })
    }

    /// The pre-action checks: safety (again), unchanged since the preview, and the Recycle
    /// Bin can really take it (never a silent permanent delete).
    fn check_item(
        &self,
        preview: &StoredPreview,
        item: &StoredItem,
        now: i64,
    ) -> Result<(), FailReason> {
        let rule = &preview.rules[item.rule];
        self.policy
            .validate(&item.path, &rule.roots)
            .map_err(|e| reason(e.code(), &e.to_string()))?;
        if matcher::recheck(&rule.rule.matcher, &item.path, now).as_ref() != Some(&item.fingerprint)
        {
            return Err(reason("changed", "item changed since the preview"));
        }
        match self.trasher.limit(&item.path) {
            RecycleLimit::Disabled => Err(reason(
                "recycleBinDisabled",
                "the Recycle Bin is turned off for this drive",
            )),
            RecycleLimit::Unknown => Err(reason(
                "recycleBinUnknown",
                "cannot confirm this drive has a Recycle Bin",
            )),
            // Keep 10% headroom below the configured maximum.
            RecycleLimit::MaxBytes(max) if item.size > max / 10 * 9 => Err(reason(
                "tooBigForRecycleBin",
                "item is too large for the Recycle Bin and would be deleted permanently",
            )),
            RecycleLimit::MaxBytes(_) => Ok(()),
        }
    }

    pub fn recycle_bin_info(&self) -> Result<RecycleBinInfo, CleanerError> {
        let (size_bytes, item_count) =
            platform::recycle_bin_info().map_err(|e| CleanerError::RecycleBin(e.to_string()))?;
        Ok(RecycleBinInfo {
            size_bytes,
            item_count,
        })
    }

    /// Permanently empties the Recycle Bin (the only permanent delete in the MVP, D-003).
    pub fn empty_recycle_bin(&self) -> Result<(), CleanerError> {
        let mut log = self
            .log
            .open()
            .map_err(|e| CleanerError::LogUnavailable(e.to_string()))?;
        let size = self.recycle_bin_info().map(|i| i.size_bytes).unwrap_or(0);
        let result = platform::empty_recycle_bin();
        let entry = LogEntry {
            ts: now_millis(),
            action: "emptyRecycleBin",
            preview_id: None,
            rule_id: None,
            path: None,
            size,
            ok: result.is_ok(),
            reason: result.as_ref().err().map(|_| "failed"),
        };
        if let Err(e) = log.write(&entry) {
            eprintln!("cleanup log write failed: {e}");
        }
        result.map_err(|e| CleanerError::RecycleBin(e.to_string()))
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }
}

fn rule_info(rule: &Rule) -> RuleInfo {
    RuleInfo {
        id: rule.id.clone(),
        name: rule.name.clone(),
        group: rule.group,
        description: rule.description.clone(),
        risk: rule.risk,
        default_checked: rule.default_checked,
    }
}

fn outcome(item_id: u32, item: &StoredItem, error: Option<FailReason>) -> ItemOutcome {
    ItemOutcome {
        item_id,
        path: shown(&item.path),
        size: item.size,
        is_dir: item.is_dir,
        error,
    }
}

/// Logs one outcome right away (so a crash mid-run still leaves a record) and keeps it.
fn record(
    log: &mut LogWriter,
    outcomes: &mut Vec<ItemOutcome>,
    preview: &StoredPreview,
    o: ItemOutcome,
) {
    let rule_id = preview
        .items
        .get(o.item_id as usize)
        .map(|i| preview.rules[i.rule].rule.id.as_str());
    let entry = LogEntry {
        ts: now_millis(),
        action: "trash",
        preview_id: Some(preview.id),
        rule_id,
        path: Some(&o.path),
        size: o.size,
        ok: o.error.is_none(),
        reason: o.error.as_ref().map(|r| r.code.as_str()),
    };
    // The log was opened before acting; a write failing now cannot undo a move, so report it.
    if let Err(e) = log.write(&entry) {
        eprintln!("cleanup log write failed: {e}");
    }
    outcomes.push(o);
}

fn reason(code: &str, message: &str) -> FailReason {
    FailReason {
        code: code.to_string(),
        message: message.to_string(),
    }
}

fn is_gone(path: &Path) -> bool {
    matches!(fs::symlink_metadata(path), Err(e) if e.kind() == std::io::ErrorKind::NotFound)
}

fn shown(path: &Path) -> String {
    platform::display_path(path).to_string_lossy().into_owned()
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests;
