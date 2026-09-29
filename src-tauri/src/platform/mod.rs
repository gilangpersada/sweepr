//! OS-specific code. Each OS lives in its own file, gated with `#[cfg(target_os = "...")]`.

use std::io;
use std::path::Path;
use std::process::Child;
use std::thread;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
use windows as os;

#[cfg(not(target_os = "windows"))]
mod unix;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as os;

/// Other OSes are unsupported but should still compile.
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod os {
    use std::io;
    use std::path::Path;

    pub use super::unix::*;

    pub const CLEANER_RULES_JSON: &str = "{}";

    pub fn reveal_in_file_manager(_path: &Path) -> io::Result<()> {
        Err(io::Error::from(io::ErrorKind::Unsupported))
    }
}

pub use os::{
    display_path, empty_recycle_bin, is_hidden, is_link, path_eq, protected_paths,
    recycle_bin_info, recycle_bin_limit, ROOT_PROTECTED_NAMES,
};

/// The cleaner rules file for this OS (`config/cleaner-rules.<os>.json`).
pub const CLEANER_RULES_JSON: &str = os::CLEANER_RULES_JSON;

/// How much the Recycle Bin of a volume can take.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecycleLimit {
    /// Largest total the bin holds, in bytes. A bigger item would be deleted permanently.
    MaxBytes(u64),
    /// The user turned the bin off for this volume: deleting would be permanent.
    Disabled,
    /// Could not be determined (no bin on this volume, unreadable settings, other OS).
    Unknown,
}

/// Shows `path` selected in the OS file manager. `path` must come from a scan tree, never
/// straight from the UI. Fails with `NotFound` if it no longer exists.
pub fn reveal_in_file_manager(path: &Path) -> io::Result<()> {
    // `symlink_metadata` so a path that became a link is still "found" but never followed.
    std::fs::symlink_metadata(path)?;
    os::reveal_in_file_manager(path)
}

/// Waits for a launched helper process on a background thread so it never lingers as a
/// zombie. Its exit code is meaningless (Explorer returns 1 even on success).
fn reap(mut child: Child) {
    thread::spawn(move || {
        let _ = child.wait();
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scanner::Categories;

    #[test]
    fn embedded_rules_have_valid_categories() {
        let categories = Categories::from_rules_json(CLEANER_RULES_JSON).unwrap();
        if cfg!(target_os = "windows") {
            assert!(
                categories.id_count() > 1,
                "Windows config defines categories"
            );
        }
    }

    #[test]
    fn reveal_of_missing_path_is_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let err = reveal_in_file_manager(&dir.path().join("gone.txt")).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::NotFound);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn display_path_strips_verbatim_prefix() {
        use std::path::PathBuf;
        let canon = std::fs::canonicalize(std::env::temp_dir()).unwrap();
        assert!(canon.to_string_lossy().starts_with(r"\\?\"));
        let shown = display_path(&canon);
        assert!(!shown.to_string_lossy().starts_with(r"\\?\"), "{shown:?}");
        assert!(path_eq(&shown, &display_path(&shown)));
        assert_eq!(
            display_path(&PathBuf::from(r"\\?\C:\a\b")),
            PathBuf::from(r"C:\a\b")
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn recycle_bin_limit_is_the_same_for_verbatim_paths() {
        // The cleaner passes canonical (`\\?\C:\...`) paths; they must resolve to the same
        // volume setting as the plain form, or every item would be refused as Unknown.
        let verbatim = std::fs::canonicalize(std::env::temp_dir()).unwrap();
        let plain = display_path(&verbatim);
        let limit = recycle_bin_limit(&verbatim);
        println!("{plain:?}: {limit:?}");
        assert_eq!(limit, recycle_bin_limit(&plain));
    }
}
