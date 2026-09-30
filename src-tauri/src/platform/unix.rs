//! Conservative defaults shared by macOS and other Unix-likes. Not used in the MVP; the
//! cleaner refuses to run here because the Recycle Bin limit is always `Unknown`.

use std::fs::Metadata;
use std::io;
use std::path::{Path, PathBuf};

use super::RecycleLimit;
use crate::safety::{ProtectKind, ProtectedPath};

pub const ROOT_PROTECTED_NAMES: &[&str] = &[];

pub fn is_link(meta: &Metadata) -> bool {
    meta.file_type().is_symlink()
}

/// Dot-folders are skipped by name elsewhere; there is no hidden attribute here.
pub fn is_hidden(_meta: &Metadata) -> bool {
    false
}

pub fn path_eq(a: &Path, b: &Path) -> bool {
    a == b
}

pub fn display_path(path: &Path) -> PathBuf {
    path.to_path_buf()
}

pub fn protected_paths() -> Vec<ProtectedPath> {
    let mut out: Vec<ProtectedPath> = [
        "/System",
        "/Library",
        "/Applications",
        "/usr",
        "/bin",
        "/sbin",
        "/private",
        "/etc",
    ]
    .iter()
    .map(|p| ProtectedPath {
        path: PathBuf::from(p),
        kind: ProtectKind::Subtree,
    })
    .collect();
    if let Some(home) = dirs::home_dir() {
        out.push(ProtectedPath {
            path: home,
            kind: ProtectKind::Exact,
        });
    }
    out
}

pub fn recycle_bin_limit(_path: &Path) -> RecycleLimit {
    RecycleLimit::Unknown
}

pub fn recycle_bin_info() -> io::Result<(u64, u64)> {
    Err(io::Error::from(io::ErrorKind::Unsupported))
}

pub fn empty_recycle_bin() -> io::Result<()> {
    Err(io::Error::from(io::ErrorKind::Unsupported))
}

/// Recycle Bin items (their storage paths). Not supported here yet.
pub fn recycle_bin_item_paths() -> io::Result<Vec<PathBuf>> {
    Err(io::Error::from(io::ErrorKind::Unsupported))
}

/// Moves `from` to `to`, failing if `to` exists. Not supported here yet.
pub fn move_no_replace(_from: &Path, _to: &Path) -> io::Result<()> {
    Err(io::Error::from(io::ErrorKind::Unsupported))
}
