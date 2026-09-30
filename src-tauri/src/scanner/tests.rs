//! Scanner tests against real temporary folders.

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;

use super::*;

fn write_file(path: &Path, len: usize) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, vec![0u8; len]).unwrap();
}

fn scan_ok(root: &Path) -> ScanResult {
    let cancel = Arc::new(AtomicBool::new(false));
    match scan(root, cancel, &ScanOptions::default(), |_| {}).unwrap() {
        ScanOutcome::Completed(r) => r,
        ScanOutcome::Cancelled => panic!("scan was cancelled"),
    }
}

/// Finds a node by walking names from the root.
fn node_at(result: &ScanResult, names: &[&str]) -> Option<NodeId> {
    let tree = &result.tree;
    let mut cur = NodeId::ROOT;
    for name in names {
        cur = tree
            .children(cur)
            .find(|&c| tree.get(c).unwrap().name.to_str() == Some(*name))?;
    }
    Some(cur)
}

fn size_at(result: &ScanResult, names: &[&str]) -> u64 {
    result
        .tree
        .get(node_at(result, names).unwrap())
        .unwrap()
        .size
}

#[test]
fn sizes_and_counts_match_files_on_disk() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write_file(&root.join("a.bin"), 1_000);
    write_file(&root.join("docs/b.txt"), 250);
    write_file(&root.join("docs/deep/c.txt"), 50);
    write_file(&root.join("docs/deep/d.txt"), 0);
    fs::create_dir(root.join("empty")).unwrap();

    let r = scan_ok(root);
    let root_node = r.tree.root();
    assert_eq!(root_node.size, 1_300);
    assert_eq!(root_node.file_count, 4);
    assert_eq!(size_at(&r, &["docs"]), 300);
    assert_eq!(size_at(&r, &["docs", "deep"]), 50);
    assert_eq!(size_at(&r, &["empty"]), 0);
    // root + a.bin + docs + b.txt + deep + c.txt + d.txt + empty
    assert_eq!(r.tree.len(), 8);
    assert!(r.skipped.is_empty(), "{:?}", r.skipped);
    assert_eq!(
        r.tree
            .path(node_at(&r, &["docs", "deep", "c.txt"]).unwrap())
            .unwrap(),
        root.join("docs").join("deep").join("c.txt")
    );
}

#[test]
fn many_siblings_and_nesting_keep_parents_right() {
    // Enough entries that jwalk spreads directories over several threads.
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    for i in 0..20 {
        for j in 0..10 {
            write_file(&root.join(format!("d{i}/sub{j}/f.bin")), i * 10 + j);
        }
    }
    let r = scan_ok(root);
    assert_eq!(r.tree.root().file_count, 200);
    for i in 0..20usize {
        let expected: usize = (0..10).map(|j| i * 10 + j).sum();
        assert_eq!(size_at(&r, &[&format!("d{i}")]), expected as u64);
    }
}

#[test]
fn root_errors_are_reported() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("nope");
    let file = dir.path().join("file.txt");
    write_file(&file, 1);
    let cancel = Arc::new(AtomicBool::new(false));
    let opts = ScanOptions::default();

    let err = scan(&missing, cancel.clone(), &opts, |_| {}).unwrap_err();
    assert!(matches!(err, ScanError::NotFound(_)), "{err:?}");
    let err = scan(&file, cancel, &opts, |_| {}).unwrap_err();
    assert!(matches!(err, ScanError::NotADirectory(_)), "{err:?}");
}

#[test]
fn cancelled_before_start_returns_cancelled() {
    let dir = tempfile::tempdir().unwrap();
    write_file(&dir.path().join("x/y.bin"), 10);
    let cancel = Arc::new(AtomicBool::new(true));
    let outcome = scan(dir.path(), cancel, &ScanOptions::default(), |_| {}).unwrap();
    assert!(matches!(outcome, ScanOutcome::Cancelled));
}

#[test]
fn cancel_during_scan_stops_early() {
    let dir = tempfile::tempdir().unwrap();
    for i in 0..50 {
        write_file(&dir.path().join(format!("d{i}/f{i}.bin")), 1);
    }
    let cancel = Arc::new(AtomicBool::new(false));
    let opts = ScanOptions {
        progress_interval: Duration::ZERO,
        ..Default::default()
    };
    let mut calls = 0;
    let flag = Arc::clone(&cancel);
    let outcome = scan(dir.path(), cancel, &opts, |_| {
        calls += 1;
        if calls == 3 {
            flag.store(true, Ordering::Relaxed);
        }
    })
    .unwrap();
    assert!(matches!(outcome, ScanOutcome::Cancelled));
    assert_eq!(calls, 3, "no more progress after cancelling");
}

#[test]
fn progress_reports_growing_counts() {
    let dir = tempfile::tempdir().unwrap();
    for i in 0..5 {
        write_file(&dir.path().join(format!("f{i}.bin")), 100);
    }
    let opts = ScanOptions {
        progress_interval: Duration::ZERO,
        ..Default::default()
    };
    let mut seen = Vec::new();
    scan(dir.path(), Arc::new(AtomicBool::new(false)), &opts, |p| {
        seen.push((p.files_seen, p.bytes_seen))
    })
    .unwrap();
    assert_eq!(seen.len(), 5);
    assert_eq!(seen.last(), Some(&(5, 500)));
    assert!(seen.windows(2).all(|w| w[0].0 < w[1].0));
}

// ---------- symlinks / junctions ----------

/// Creates a directory link. On Windows tries a real symlink (needs Developer Mode or admin)
/// and returns false if that is not permitted.
#[cfg(windows)]
fn make_dir_symlink(target: &Path, link: &Path) -> bool {
    std::os::windows::fs::symlink_dir(target, link).is_ok()
}

#[cfg(unix)]
fn make_dir_symlink(target: &Path, link: &Path) -> bool {
    std::os::unix::fs::symlink(target, link).is_ok()
}

/// A junction needs no special rights, so this always works on Windows.
#[cfg(windows)]
fn make_junction(target: &Path, link: &Path) {
    let status = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .stdout(std::process::Stdio::null())
        .status()
        .unwrap();
    assert!(status.success(), "mklink /J failed");
}

/// Outside folder with 1 MB that must never be counted, plus a root with 10 bytes.
fn link_fixture() -> (tempfile::TempDir, std::path::PathBuf, std::path::PathBuf) {
    let base = tempfile::tempdir().unwrap();
    let outside = base.path().join("outside");
    let root = base.path().join("root");
    write_file(&outside.join("huge.bin"), 1_000_000);
    write_file(&root.join("own.bin"), 10);
    (base, outside, root)
}

#[test]
fn directory_symlinks_are_not_followed() {
    let (_base, outside, root) = link_fixture();
    if !make_dir_symlink(&outside, &root.join("link")) {
        eprintln!("skipping: creating symlinks is not permitted here");
        return;
    }
    let r = scan_ok(&root);
    assert_eq!(r.tree.root().size, 10);
    assert!(node_at(&r, &["link"]).is_none(), "links are not listed");
}

#[cfg(windows)]
#[test]
fn junctions_are_not_followed() {
    let (_base, outside, root) = link_fixture();
    make_junction(&outside, &root.join("junction"));
    assert!(
        root.join("junction").join("huge.bin").exists(),
        "fixture sanity"
    );

    let r = scan_ok(&root);
    assert_eq!(r.tree.root().size, 10);
    assert_eq!(r.tree.root().file_count, 1);
    assert!(node_at(&r, &["junction"]).is_none());
}

#[cfg(windows)]
#[test]
fn junction_as_root_is_rejected() {
    let (_base, outside, root) = link_fixture();
    let link = root.join("junction");
    make_junction(&outside, &link);
    let err = scan(
        &link,
        Arc::new(AtomicBool::new(false)),
        &ScanOptions::default(),
        |_| {},
    )
    .unwrap_err();
    assert!(matches!(err, ScanError::IsLink(_)), "{err:?}");
}

#[test]
fn symlink_as_root_is_rejected() {
    let (_base, outside, root) = link_fixture();
    let link = root.join("link");
    if !make_dir_symlink(&outside, &link) {
        eprintln!("skipping: creating symlinks is not permitted here");
        return;
    }
    let err = scan(
        &link,
        Arc::new(AtomicBool::new(false)),
        &ScanOptions::default(),
        |_| {},
    )
    .unwrap_err();
    assert!(matches!(err, ScanError::IsLink(_)), "{err:?}");
}

// ---------- unreadable folders ----------

/// Denies listing a folder for the current user and restores access on drop.
struct DenyList {
    path: std::path::PathBuf,
}

#[cfg(windows)]
impl DenyList {
    fn user() -> String {
        std::env::var("USERNAME").expect("USERNAME is set on Windows")
    }

    fn new(path: &Path) -> Self {
        let status = std::process::Command::new("icacls")
            .arg(path)
            .args(["/deny", &format!("{}:(RD)", Self::user())])
            .stdout(std::process::Stdio::null())
            .status()
            .unwrap();
        assert!(status.success(), "icacls /deny failed");
        DenyList {
            path: path.to_path_buf(),
        }
    }
}

#[cfg(windows)]
impl Drop for DenyList {
    fn drop(&mut self) {
        let _ = std::process::Command::new("icacls")
            .arg(&self.path)
            .args(["/remove:d", &Self::user()])
            .stdout(std::process::Stdio::null())
            .status();
    }
}

#[cfg(unix)]
impl DenyList {
    fn new(path: &Path) -> Self {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o000)).unwrap();
        DenyList {
            path: path.to_path_buf(),
        }
    }
}

#[cfg(unix)]
impl Drop for DenyList {
    fn drop(&mut self) {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&self.path, fs::Permissions::from_mode(0o755));
    }
}

#[test]
fn unreadable_folder_is_skipped_and_scan_continues() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write_file(&root.join("ok/a.bin"), 100);
    write_file(&root.join("locked/secret.bin"), 5_000);
    let _guard = DenyList::new(&root.join("locked"));
    if fs::read_dir(root.join("locked")).is_ok() {
        eprintln!("skipping: permissions are not enforced here (running as root?)");
        return;
    }

    let r = scan_ok(root);
    assert_eq!(r.tree.root().size, 100);
    assert_eq!(size_at(&r, &["ok"]), 100);
    // The folder itself is still shown, just empty.
    assert_eq!(size_at(&r, &["locked"]), 0);
    assert_eq!(r.skipped.len(), 1, "{:?}", r.skipped);
    assert_eq!(r.skipped[0].path, root.join("locked"));
    assert!(!r.skipped[0].reason.is_empty());

    // FR-2: the UI can list them page by page.
    let page = r.skipped_page(0, 10);
    assert_eq!(page.total, 1);
    assert_eq!(page.items[0].path, root.join("locked").to_string_lossy());
    assert!(r.skipped_page(1, 10).items.is_empty());
    assert!(r.skipped_page(0, 0).items.is_empty());
}

// ---------- sessions ----------

fn wait_final(rx: &mpsc::Receiver<ScanEvent>) -> ScanEvent {
    loop {
        match rx
            .recv_timeout(Duration::from_secs(30))
            .expect("scan event")
        {
            ScanEvent::Progress(_) => continue,
            other => return other,
        }
    }
}

#[test]
fn session_runs_in_background_and_keeps_result() {
    let dir = tempfile::tempdir().unwrap();
    write_file(&dir.path().join("a/b.bin"), 42);
    let sessions = ScanSessions::default();
    let (tx, rx) = mpsc::channel();

    let id = sessions.start(dir.path().to_path_buf(), move |e| {
        let _ = tx.send(e);
    });
    match wait_final(&rx) {
        ScanEvent::Finished(f) => {
            assert_eq!(f.scan_id, id);
            assert_eq!(f.total_bytes, 42);
            assert_eq!(f.total_files, 1);
            assert_eq!(f.root_id, 0);
        }
        other => panic!("unexpected {other:?}"),
    }

    let result = sessions.result(id).unwrap();
    let page = result
        .tree
        .children_page(NodeId::ROOT, SortBy::Size, SortOrder::Desc, 0, 10)
        .unwrap();
    assert_eq!(page.items[0].name, "a");
    assert!(matches!(
        sessions.result(id + 1),
        Err(ScanError::UnknownScan(_))
    ));
}

#[test]
fn session_reports_failure_for_bad_root() {
    let dir = tempfile::tempdir().unwrap();
    let sessions = ScanSessions::default();
    let (tx, rx) = mpsc::channel();
    let id = sessions.start(dir.path().join("missing"), move |e| {
        let _ = tx.send(e);
    });
    match wait_final(&rx) {
        ScanEvent::Failed(f) => {
            assert_eq!(f.scan_id, id);
            let json = serde_json::to_value(&f).unwrap();
            assert_eq!(json["error"]["code"], "notFound");
            assert_eq!(json["scanId"], id);
        }
        other => panic!("unexpected {other:?}"),
    }
    assert!(sessions.result(id).is_err());
}

#[test]
fn new_scan_drops_previous_result() {
    let dir = tempfile::tempdir().unwrap();
    write_file(&dir.path().join("f.bin"), 1);
    let sessions = ScanSessions::default();
    let (tx, rx) = mpsc::channel();

    let tx1 = tx.clone();
    let first = sessions.start(dir.path().to_path_buf(), move |e| {
        let _ = tx1.send(e);
    });
    assert!(matches!(wait_final(&rx), ScanEvent::Finished(_)));
    assert!(sessions.result(first).is_ok());

    let second = sessions.start(dir.path().to_path_buf(), move |e| {
        let _ = tx.send(e);
    });
    assert!(sessions.result(first).is_err(), "old tree is dropped");
    assert!(matches!(wait_final(&rx), ScanEvent::Finished(_)));
    assert!(sessions.result(second).is_ok());
}

#[test]
fn cancelling_a_session_emits_cancelled() {
    let dir = tempfile::tempdir().unwrap();
    for i in 0..300 {
        write_file(&dir.path().join(format!("d{}/f{i}.bin", i % 30)), 1);
    }
    let sessions = ScanSessions::new(ScanOptions {
        progress_interval: Duration::ZERO,
        ..Default::default()
    });
    let (tx, rx) = mpsc::channel();
    let s = sessions.clone();
    // Cancel from inside the first progress event so the scan is guaranteed to be running.
    let started = sessions.start(dir.path().to_path_buf(), move |e| {
        if let ScanEvent::Progress(p) = &e {
            s.cancel(p.scan_id);
        }
        let _ = tx.send(e);
    });
    match wait_final(&rx) {
        ScanEvent::Cancelled(c) => assert_eq!(c.scan_id, started),
        other => panic!("unexpected {other:?}"),
    }
    assert!(sessions.result(started).is_err());
}

#[test]
fn scan_assigns_categories_from_config() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write_file(&root.join("clip.MP4"), 300);
    write_file(&root.join("sub/movie.mkv"), 200);
    write_file(&root.join("sub/notes.txt"), 7);
    // A folder named like a video must not count as one.
    fs::create_dir_all(root.join("album.mp4")).unwrap();

    let categories =
        Categories::from_rules_json(r#"{ "category_extensions": { "video": [".mp4", ".mkv"] } }"#)
            .unwrap();
    let opts = ScanOptions {
        categories: Arc::new(categories),
        ..Default::default()
    };
    let r = match scan(root, Arc::new(AtomicBool::new(false)), &opts, |_| {}).unwrap() {
        ScanOutcome::Completed(r) => r,
        ScanOutcome::Cancelled => panic!("scan was cancelled"),
    };
    let summary = r
        .tree
        .category_summary(NodeId::ROOT, &r.categories)
        .unwrap();
    let rows: Vec<_> = summary
        .iter()
        .map(|c| (c.key.as_str(), c.size, c.file_count))
        .collect();
    assert_eq!(rows, [("video", 500, 2), ("other", 7, 1)]);
}

#[test]
fn only_plain_non_executable_files_are_openable() {
    let dir = tempfile::tempdir().unwrap();
    write_file(&dir.path().join("docs/report.pdf"), 3);
    write_file(&dir.path().join("setup.EXE"), 3);
    write_file(&dir.path().join("run.bat"), 3);
    let categories = Categories::from_rules_json(
        r#"{ "category_extensions": {}, "executable_extensions": [".exe", ".bat"] }"#,
    )
    .unwrap();
    let options = ScanOptions {
        categories: Arc::new(categories),
        ..Default::default()
    };
    let cancel = Arc::new(AtomicBool::new(false));
    let ScanOutcome::Completed(r) = scan(dir.path(), cancel, &options, |_| {}).unwrap() else {
        panic!("scan was cancelled");
    };

    let pdf = node_at(&r, &["docs", "report.pdf"]).unwrap();
    assert!(r.openable_path(pdf).unwrap().ends_with("report.pdf"));
    for name in ["setup.EXE", "run.bat"] {
        let id = node_at(&r, &[name]).unwrap();
        assert!(
            matches!(r.openable_path(id), Err(ScanError::Executable(_))),
            "{name} must not be opened"
        );
    }
    let folder = node_at(&r, &["docs"]).unwrap();
    assert!(matches!(
        r.openable_path(folder),
        Err(ScanError::NotAFile(_))
    ));
    assert!(matches!(
        r.openable_path(NodeId(9_999)),
        Err(ScanError::UnknownNode(_))
    ));
}

#[test]
fn windows_config_lists_common_executables() {
    let c = Categories::from_rules_json(crate::platform::CLEANER_RULES_JSON).unwrap();
    if cfg!(windows) {
        for name in ["a.exe", "a.msi", "a.bat", "a.ps1", "a.lnk", "a.js", "a.reg"] {
            assert!(c.is_executable(std::ffi::OsStr::new(name)), "{name}");
        }
        assert!(!c.is_executable(std::ffi::OsStr::new("a.pdf")));
    }
}
