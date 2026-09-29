//! Windows-specific helpers (known folders, reveal in Explorer, reparse point checks).

use std::ffi::OsString;
use std::io;
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;

/// Cleaner rules for this OS, embedded at compile time (M2 decision Q4; M3 adds a loader).
pub const CLEANER_RULES_JSON: &str = include_str!("../../../config/cleaner-rules.windows.json");

/// Opens Explorer with `path` selected.
pub fn reveal_in_file_manager(path: &Path) -> io::Result<()> {
    // Windows paths cannot contain `"`, but check anyway: the quoting below relies on it.
    if path.as_os_str().to_string_lossy().contains('"') {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "path contains a quote",
        ));
    }
    // Explorer parses `/select,"<path>"` itself and mis-reads std's quoting of the whole
    // argument when the path has spaces, so pass it raw.
    let mut arg = OsString::from("/select,\"");
    arg.push(path);
    arg.push("\"");
    let child = Command::new("explorer.exe").raw_arg(arg).spawn()?;
    super::reap(child);
    Ok(())
}
