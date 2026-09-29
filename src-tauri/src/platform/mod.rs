//! OS-specific code. Each OS lives in its own file, gated with `#[cfg(target_os = "...")]`.

use std::io;
use std::path::Path;
use std::process::Child;
use std::thread;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
use windows as os;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as os;

/// Other OSes are unsupported but should still compile.
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod os {
    use std::io;
    use std::path::Path;

    pub const CLEANER_RULES_JSON: &str = "{}";

    pub fn reveal_in_file_manager(_path: &Path) -> io::Result<()> {
        Err(io::Error::from(io::ErrorKind::Unsupported))
    }
}

/// The cleaner rules file for this OS (`config/cleaner-rules.<os>.json`).
pub const CLEANER_RULES_JSON: &str = os::CLEANER_RULES_JSON;

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
}
