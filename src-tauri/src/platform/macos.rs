//! macOS-specific helpers. Stub only; macOS is out of scope for the MVP.

use std::io;
use std::path::Path;
use std::process::Command;

pub const CLEANER_RULES_JSON: &str = include_str!("../../../config/cleaner-rules.macos.json");

/// Opens Finder with `path` selected.
pub fn reveal_in_file_manager(path: &Path) -> io::Result<()> {
    let child = Command::new("open").arg("-R").arg(path).spawn()?;
    super::reap(child);
    Ok(())
}
