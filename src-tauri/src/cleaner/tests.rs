//! Preview/execute tests against temp folders. `FakeTrasher` deletes inside the temp dir
//! instead of using the real Recycle Bin.

use std::collections::HashSet;
use std::fs;
use std::sync::{Arc, Mutex};

use super::*;
use crate::safety::{ProtectKind, ProtectedPath};
use crate::test_util::{age, canon, write_file};

#[derive(Clone)]
struct FakeTrasher {
    limit: RecycleLimit,
    /// Paths whose trash call fails, like a locked file.
    locked: Arc<Mutex<HashSet<PathBuf>>>,
    trashed: Arc<Mutex<Vec<PathBuf>>>,
}

impl FakeTrasher {
    fn new(limit: RecycleLimit) -> Self {
        FakeTrasher {
            limit,
            locked: Arc::default(),
            trashed: Arc::default(),
        }
    }
}

impl Trasher for FakeTrasher {
    fn trash(&self, paths: &[PathBuf]) -> Result<(), String> {
        let locked = self.locked.lock().unwrap();
        if paths.iter().any(|p| locked.contains(p)) {
            return Err("file is in use".into());
        }
        for p in paths {
            if p.is_dir() {
                fs::remove_dir_all(p).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(p).map_err(|e| e.to_string())?;
            }
            self.trashed.lock().unwrap().push(p.clone());
        }
        Ok(())
    }

    fn limit(&self, _path: &Path) -> RecycleLimit {
        self.limit
    }
}

const RULES: &str = r#"{
    "schema_version": 1, "os": "test",
    "rules": [
        { "id": "temp", "name": "Temp", "group": "general", "description": "d", "risk": "low",
          "default_checked": true, "allowed_roots": ["%TESTROOT%/temp"],
          "match": { "type": "files_in_root", "recursive": true, "min_age_days": 3 },
          "action": "trash" },
        { "id": "nm", "name": "node_modules", "group": "developer", "description": "d", "risk": "medium",
          "default_checked": false, "allowed_roots": ["%TESTROOT%/home", "%TESTROOT%/missing"],
          "match": { "type": "named_directory", "directory_name": "node_modules",
                     "project_marker_file": "package.json", "min_age_days": 60 },
          "action": "trash" },
        { "id": "nm-docs", "name": "node_modules + Documents", "group": "developer",
          "description": "d", "risk": "medium", "default_checked": false,
          "allowed_roots": ["%TESTROOT%/home", "%TESTROOT%/home/Documents"],
          "match": { "type": "named_directory", "directory_name": "node_modules",
                     "project_marker_file": "package.json", "min_age_days": 60 },
          "action": "trash" }
    ]
}"#;

struct Env {
    _dir: tempfile::TempDir,
    base: PathBuf,
    cleaner: Cleaner,
    trasher: FakeTrasher,
    log_path: PathBuf,
}

/// base/
///   temp/old1.tmp (100) old2.tmp (50) new.tmp (7) protected/secret.tmp (old)
///   home/proj/{package.json, node_modules/a.js (300)}  home/Documents/p2/... (protected)
///   logs/cleanup.jsonl
fn env_with(limit: RecycleLimit) -> Env {
    let dir = tempfile::tempdir().unwrap();
    let base = canon(dir.path());
    write_file(&base.join("temp/old1.tmp"), 100);
    write_file(&base.join("temp/old2.tmp"), 50);
    write_file(&base.join("temp/new.tmp"), 7);
    write_file(&base.join("temp/protected/secret.tmp"), 9);
    for f in [
        "temp/old1.tmp",
        "temp/old2.tmp",
        "temp/protected/secret.tmp",
    ] {
        age(&base.join(f), 10);
    }
    for proj in ["home/proj", "home/Documents/p2"] {
        write_file(&base.join(proj).join("package.json"), 1);
        write_file(&base.join(proj).join("node_modules/a.js"), 300);
        age(&base.join(proj).join("package.json"), 90);
        age(&base.join(proj), 90);
    }

    let policy = SafetyPolicy::new(
        vec![
            ProtectedPath {
                path: base.join("temp/protected"),
                kind: ProtectKind::Subtree,
            },
            ProtectedPath {
                path: base.join("home/Documents"),
                kind: ProtectKind::SubtreeUnlessExplicit,
            },
        ],
        &[],
    );
    let trasher = FakeTrasher::new(limit);
    let root = platform::display_path(&base);
    let log_path = base.join("logs/cleanup.jsonl");
    let cleaner = Cleaner::new(
        rules::load_rules(RULES, "test"),
        policy,
        Box::new(trasher.clone()),
        log_path.clone(),
        Box::new(move |name| (name == "TESTROOT").then(|| root.clone())),
    );
    Env {
        _dir: dir,
        base,
        cleaner,
        trasher,
        log_path,
    }
}

fn env() -> Env {
    env_with(RecycleLimit::MaxBytes(1 << 30))
}

fn ids(p: &CleanupPreview) -> Vec<u32> {
    p.rules
        .iter()
        .flat_map(|r| r.items.iter().map(|i| i.item_id))
        .collect()
}

fn preview_all(e: &Env) -> CleanupPreview {
    e.cleaner.preview(&["temp".into(), "nm".into()]).unwrap()
}

fn log_lines(e: &Env) -> Vec<serde_json::Value> {
    fs::read_to_string(&e.log_path)
        .unwrap_or_default()
        .lines()
        .map(|l| serde_json::from_str(l).unwrap())
        .collect()
}

#[test]
fn preview_lists_only_old_unprotected_items_largest_first() {
    let e = env();
    let p = preview_all(&e);
    let temp = &p.rules[0];
    let names: Vec<_> = temp
        .items
        .iter()
        .map(|i| i.path.rsplit(['\\', '/']).next().unwrap())
        .collect();
    assert_eq!(names, ["old1.tmp", "old2.tmp"]);
    assert_eq!(temp.total_bytes, 150);
    assert!(!temp.truncated);

    let nm = &p.rules[1];
    assert_eq!(
        nm.items.len(),
        1,
        "Documents is protected and not named by the rule"
    );
    assert!(nm.items[0].is_dir);
    assert_eq!(nm.items[0].size, 300);
    // The missing root is reported, not fatal.
    assert_eq!(nm.root_problems.len(), 1);

    // No protected path ever shows up in a preview.
    let all_paths: Vec<_> = p
        .rules
        .iter()
        .flat_map(|r| &r.items)
        .map(|i| i.path.clone())
        .collect();
    assert!(all_paths
        .iter()
        .all(|p| !p.contains("protected") && !p.contains("Documents")));
    // Item ids are unique across rules.
    let unique: HashSet<_> = ids(&p).into_iter().collect();
    assert_eq!(unique.len(), 3);
}

#[test]
fn unknown_rule_is_an_error() {
    let e = env();
    let err = e.cleaner.preview(&["nope".into()]).unwrap_err();
    assert_eq!(err.code(), "unknownRule");
}

#[test]
fn execute_trashes_selected_items_and_logs_each() {
    let e = env();
    let p = preview_all(&e);
    let old1 = p.rules[0].items[0].item_id;
    let nm = p.rules[1].items[0].item_id;
    let r = e.cleaner.execute(p.preview_id, &[old1, nm]).unwrap();

    assert_eq!(
        (r.trashed_count, r.failed_count, r.trashed_bytes),
        (2, 0, 400)
    );
    assert!(!e.base.join("temp/old1.tmp").exists());
    assert!(
        e.base.join("temp/old2.tmp").exists(),
        "unchecked item untouched"
    );
    assert!(!e.base.join("home/proj/node_modules").exists());
    assert!(e.base.join("home/proj/package.json").exists());

    let log = log_lines(&e);
    assert_eq!(log.len(), 2);
    assert!(log
        .iter()
        .all(|l| l["action"] == "trash" && l["ok"] == true));
    assert!(log.iter().any(|l| l["ruleId"] == "nm" && l["size"] == 300));
}

#[test]
fn preview_can_be_used_once() {
    let e = env();
    let p = preview_all(&e);
    e.cleaner.execute(p.preview_id, &[]).unwrap();
    let err = e.cleaner.execute(p.preview_id, &ids(&p)).unwrap_err();
    assert_eq!(err.code(), "unknownPreview");
    assert!(e.base.join("temp/old1.tmp").exists());
    // A newer preview replaces the older one.
    let p1 = preview_all(&e);
    let p2 = preview_all(&e);
    assert_eq!(
        e.cleaner.execute(p1.preview_id, &[]).unwrap_err().code(),
        "unknownPreview"
    );
    e.cleaner.execute(p2.preview_id, &[]).unwrap();
}

#[test]
fn expired_preview_is_refused() {
    let mut e = env();
    e.cleaner.preview_ttl = Duration::ZERO;
    let p = preview_all(&e);
    std::thread::sleep(Duration::from_millis(5));
    let err = e.cleaner.execute(p.preview_id, &ids(&p)).unwrap_err();
    assert_eq!(err.code(), "previewExpired");
    assert!(e.base.join("temp/old1.tmp").exists());
}

#[test]
fn item_limit_is_enforced() {
    let e = env();
    let p = preview_all(&e);
    let too_many: Vec<u32> = (0..=MAX_ITEMS as u32).collect();
    let err = e.cleaner.execute(p.preview_id, &too_many).unwrap_err();
    assert_eq!(err.code(), "tooManyItems");
    // Not consumed by a rejected request; duplicates count once.
    let dupes = vec![0u32; MAX_ITEMS + 5];
    let r = e.cleaner.execute(p.preview_id, &dupes).unwrap();
    assert_eq!(r.items.len(), 1);
}

#[test]
fn items_changed_since_preview_are_skipped() {
    let e = env();
    let p = preview_all(&e);
    let [a, b] = [p.rules[0].items[0].item_id, p.rules[0].items[1].item_id];
    // old1 rewritten (fresh), old2 deleted by someone else.
    write_file(&e.base.join("temp/old1.tmp"), 101);
    fs::remove_file(e.base.join("temp/old2.tmp")).unwrap();
    let r = e.cleaner.execute(p.preview_id, &[a, b, 999]).unwrap();
    let codes: Vec<_> = r
        .items
        .iter()
        .map(|o| o.error.as_ref().unwrap().code.as_str())
        .collect();
    assert_eq!(codes, ["changed", "notFound", "unknownItem"]);
    assert_eq!(r.trashed_count, 0);
    assert!(e.base.join("temp/old1.tmp").exists());
    assert_eq!(log_lines(&e).len(), 3, "failures are logged too");
}

#[cfg(windows)]
#[test]
fn item_replaced_by_a_junction_is_refused() {
    use crate::test_util::make_junction;
    let e = env();
    write_file(&e.base.join("victim/keep.txt"), 1);
    let p = preview_all(&e);
    let nm = p.rules[1].items[0].item_id;
    let nm_path = e.base.join("home/proj/node_modules");
    fs::remove_dir_all(&nm_path).unwrap();
    make_junction(&e.base.join("victim"), &nm_path);
    let r = e.cleaner.execute(p.preview_id, &[nm]).unwrap();
    assert_eq!(r.items[0].error.as_ref().unwrap().code, "isLink");
    assert!(e.base.join("victim/keep.txt").exists());
    assert!(e.trasher.trashed.lock().unwrap().is_empty());
}

#[test]
fn recycle_bin_problems_never_fall_back_to_permanent_delete() {
    for (limit, code) in [
        (RecycleLimit::Disabled, "recycleBinDisabled"),
        (RecycleLimit::Unknown, "recycleBinUnknown"),
        // 200 bytes max -> 180 usable; the 300-byte node_modules does not fit.
        (RecycleLimit::MaxBytes(200), "tooBigForRecycleBin"),
    ] {
        let e = env_with(limit);
        let p = preview_all(&e);
        let nm = p.rules[1].items[0].item_id;
        let r = e.cleaner.execute(p.preview_id, &[nm]).unwrap();
        assert_eq!(r.items[0].error.as_ref().unwrap().code, code);
        assert!(e.base.join("home/proj/node_modules").exists());
        assert!(e.trasher.trashed.lock().unwrap().is_empty());
    }
}

#[test]
fn locked_item_fails_alone_without_blocking_its_batch() {
    let e = env();
    let p = preview_all(&e);
    let locked = e.base.join("temp/old2.tmp");
    e.trasher.locked.lock().unwrap().insert(locked.clone());
    let r = e.cleaner.execute(p.preview_id, &ids(&p)).unwrap();
    assert_eq!((r.trashed_count, r.failed_count), (2, 1));
    let failed = r.items.iter().find(|o| o.error.is_some()).unwrap();
    assert_eq!(failed.error.as_ref().unwrap().code, "trashFailed");
    assert!(locked.exists());
}

#[test]
fn unwritable_log_stops_before_any_action() {
    let e = env();
    // A file where the log folder should be makes the log impossible to open.
    fs::write(e.base.join("logs"), b"not a folder").unwrap();
    let p = preview_all(&e);
    let err = e.cleaner.execute(p.preview_id, &ids(&p)).unwrap_err();
    assert_eq!(err.code(), "logUnavailable");
    assert!(e.base.join("temp/old1.tmp").exists());
    assert!(e.trasher.trashed.lock().unwrap().is_empty());
}

#[test]
fn invalid_rules_disable_the_cleaner() {
    let e = env();
    let broken = Cleaner::new(
        rules::load_rules("{}", "test"),
        SafetyPolicy::new(vec![], &[]),
        Box::new(e.trasher.clone()),
        e.log_path.clone(),
        Box::new(|_| None),
    );
    assert_eq!(broken.list_rules().unwrap_err().code(), "rulesInvalid");
    assert_eq!(broken.preview(&[]).unwrap_err().code(), "rulesInvalid");
}

/// Uses the real Recycle Bin: `cargo test --lib real_recycle_bin -- --ignored`.
/// Trashes one uniquely named 10-byte file, checks it is in the bin with its original
/// location, then removes only that entry so the bin is left as it was.
#[cfg(windows)]
#[test]
#[ignore]
fn real_recycle_bin_round_trip() {
    let dir = tempfile::tempdir().unwrap();
    let name = format!("sweepr-recycle-test-{}.txt", now_millis());
    let file = canon(dir.path()).join(&name);
    write_file(&file, 10);
    SystemTrasher.trash(std::slice::from_ref(&file)).unwrap();
    assert!(!file.exists());

    // The bin lists display names, which hide the extension.
    let stem = name.trim_end_matches(".txt");
    let temp = platform::display_path(&canon(&std::env::temp_dir()));
    let (this_run, leftovers): (Vec<_>, Vec<_>) = trash::os_limited::list()
        .unwrap()
        .into_iter()
        // Only entries this test created (its own prefix; tests run in parallel).
        .filter(|item| {
            item.name
                .to_string_lossy()
                .starts_with("sweepr-recycle-test-")
                && item.original_parent.starts_with(&temp)
        })
        .partition(|item| item.name == stem || item.name == name.as_str());
    assert_eq!(
        this_run.len(),
        1,
        "the file must be in the Recycle Bin, not deleted"
    );
    assert!(platform::path_eq(
        &this_run[0].original_parent,
        &platform::display_path(&canon(dir.path()))
    ));
    // Leave the bin as it was, including leftovers of earlier failed runs.
    trash::os_limited::purge_all(this_run.into_iter().chain(leftovers)).unwrap();
}

/// Preview only (never executes) with the real rules and denylist, to see timings and
/// counts on this machine: `cargo test --release --lib real_preview -- --ignored --nocapture`.
#[test]
#[ignore]
fn real_preview_smoke() {
    let dir = tempfile::tempdir().unwrap();
    let cleaner = Cleaner::for_app(dir.path().join("cleanup.jsonl"));
    for rule in cleaner.list_rules().unwrap() {
        let started = std::time::Instant::now();
        let p = cleaner.preview(std::slice::from_ref(&rule.id)).unwrap();
        let r = &p.rules[0];
        println!(
            "{:<20} {:>6} items {:>12} bytes  excluded {:>4}  unreadable {:>4}  {:?}  roots: {:?}",
            rule.id,
            r.items.len(),
            r.total_bytes,
            r.excluded_count,
            r.unreadable_count,
            started.elapsed(),
            r.root_problems,
        );
        for item in r.items.iter().take(3) {
            println!("    {} ({} bytes)", item.path, item.size);
        }
    }
}

/// End to end on a dummy folder with the real denylist, Recycle Bin and capacity check:
/// preview -> execute -> restore from the bin -> file is back.
/// `cargo test --lib real_cleanup_round_trip -- --ignored`
#[cfg(windows)]
#[test]
#[ignore]
fn real_cleanup_round_trip_in_dummy_folder() {
    let dir = tempfile::tempdir().unwrap();
    let base = canon(dir.path());
    let name = format!("sweepr-e2e-{}", now_millis());
    let file = base.join("temp").join(format!("{name}.tmp"));
    write_file(&file, 1234);
    age(&file, 10);

    let root = platform::display_path(&base);
    let cleaner = Cleaner::new(
        rules::load_rules(RULES, "test"),
        SafetyPolicy::for_current_user(),
        Box::new(SystemTrasher),
        base.join("logs/cleanup.jsonl"),
        Box::new(move |n| (n == "TESTROOT").then(|| root.clone())),
    );
    let p = cleaner.preview(&["temp".into()]).unwrap();
    assert_eq!(p.rules[0].items.len(), 1);
    let r = cleaner
        .execute(p.preview_id, &[p.rules[0].items[0].item_id])
        .unwrap();
    assert_eq!(r.trashed_count, 1, "{:?}", r.items);
    assert!(!file.exists());

    // The bin shows the extension only for unregistered types, so accept both forms.
    let full = format!("{name}.tmp");
    let temp = platform::display_path(&canon(&std::env::temp_dir()));
    let (ours, leftovers): (Vec<_>, Vec<_>) = trash::os_limited::list()
        .unwrap()
        .into_iter()
        .filter(|i| {
            i.name.to_string_lossy().starts_with("sweepr-e2e-")
                && i.original_parent.starts_with(&temp)
        })
        .partition(|i| i.name == name.as_str() || i.name == full.as_str());
    assert_eq!(ours.len(), 1, "item must be in the Recycle Bin");
    trash::os_limited::restore_all(ours).unwrap();
    // Entries left by earlier failed runs of these tests (their folders are gone).
    if !leftovers.is_empty() {
        trash::os_limited::purge_all(leftovers).unwrap();
    }
    assert!(file.exists(), "restored to its original place");
    assert_eq!(fs::metadata(&file).unwrap().len(), 1234);
}

#[test]
fn explicitly_named_protected_folder_is_searched_once_but_never_offered_itself() {
    let e = env();
    let p = e.cleaner.preview(&["nm-docs".into()]).unwrap();
    let mut paths: Vec<_> = p.rules[0]
        .items
        .iter()
        .map(|i| i.path.replace('\\', "/"))
        .collect();
    paths.sort();
    // home/proj via the user folder, home/Documents/p2 because the rule names Documents;
    // each exactly once although Documents is inside the home root.
    assert_eq!(paths.len(), 2, "{paths:?}");
    assert!(paths[0].ends_with("home/Documents/p2/node_modules"));
    assert!(paths[1].ends_with("home/proj/node_modules"));
    assert!(p.rules[0].root_problems.is_empty());

    let r = e.cleaner.execute(p.preview_id, &ids(&p)).unwrap();
    assert_eq!(r.trashed_count, 2);
    // The protected folder and the projects stay; only node_modules went.
    assert!(e.base.join("home/Documents/p2/package.json").exists());
    assert!(e.base.join("home/Documents").is_dir());
}
