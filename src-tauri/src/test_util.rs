//! Helpers shared by unit tests (compiled only for `cargo test`).

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

pub fn write_file(path: &Path, len: usize) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, vec![0u8; len]).unwrap();
}

/// Sets a file's or folder's modified time to `days` days ago.
pub fn age(path: &Path, days: u64) {
    let when = SystemTime::now() - Duration::from_secs(days * 86_400);
    let file = if path.is_dir() {
        open_dir(path)
    } else {
        fs::OpenOptions::new().write(true).open(path).unwrap()
    };
    file.set_modified(when).unwrap();
}

#[cfg(windows)]
fn open_dir(path: &Path) -> fs::File {
    use std::os::windows::fs::OpenOptionsExt;
    // FILE_FLAG_BACKUP_SEMANTICS is required to open a directory handle on Windows.
    fs::OpenOptions::new()
        .write(true)
        .custom_flags(0x0200_0000)
        .open(path)
        .unwrap()
}

#[cfg(not(windows))]
fn open_dir(path: &Path) -> fs::File {
    fs::File::open(path).unwrap()
}

/// A junction needs no special rights, so this always works on Windows.
#[cfg(windows)]
pub fn make_junction(target: &Path, link: &Path) {
    let status = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .stdout(std::process::Stdio::null())
        .status()
        .unwrap();
    assert!(status.success(), "mklink /J failed");
}

/// Canonical form of a temp dir, as the cleaner uses internally.
pub fn canon(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap()
}
