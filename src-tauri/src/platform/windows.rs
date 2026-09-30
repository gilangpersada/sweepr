//! Windows-specific helpers (known folders, reveal in Explorer, reparse point checks,
//! Recycle Bin).

use std::env;
use std::ffi::{OsStr, OsString};
use std::fs::Metadata;
use std::io;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::fs::MetadataExt;
use std::os::windows::process::CommandExt;
use std::path::{Component, Path, PathBuf, Prefix};
use std::process::Command;

use windows_sys::Win32::Foundation::E_UNEXPECTED;
use windows_sys::Win32::Storage::FileSystem::{
    GetVolumeNameForVolumeMountPointW, GetVolumePathNameW, MoveFileExW, FILE_ATTRIBUTE_HIDDEN,
    FILE_ATTRIBUTE_REPARSE_POINT,
};
use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
use windows_sys::Win32::UI::Shell::{
    SHEmptyRecycleBinW, SHQueryRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOPROGRESSUI,
    SHERB_NOSOUND, SHQUERYRBINFO,
};

use super::RecycleLimit;
use crate::safety::{ProtectKind, ProtectedPath};

/// Cleaner rules for this OS, embedded at compile time (D-017; kept embedded in M3 so the
/// rules that drive deletion cannot be edited from outside the app).
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
    arg.push(display_path(path));
    arg.push("\"");
    let child = Command::new("explorer.exe").raw_arg(arg).spawn()?;
    super::reap(child);
    Ok(())
}

// ---------- safety helpers ----------

/// Folder names directly under any drive root that are never touched.
pub const ROOT_PROTECTED_NAMES: &[&str] =
    &["$Recycle.Bin", "System Volume Information", "Recovery"];

/// Symlinks, junctions and every other reparse point (SAFETY_RULES: reject all of them).
pub fn is_link(meta: &Metadata) -> bool {
    meta.file_type().is_symlink() || meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

pub fn is_hidden(meta: &Metadata) -> bool {
    meta.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
}

/// Compares component by component (so `\` and `/` are the same), ignoring case like NTFS.
pub fn path_eq(a: &Path, b: &Path) -> bool {
    let lower = |c: Component| c.as_os_str().to_string_lossy().to_lowercase();
    a.components().map(lower).eq(b.components().map(lower))
}

/// `\\?\C:\x` (what `canonicalize` returns) -> `C:\x`, for display and Explorer.
pub fn display_path(path: &Path) -> PathBuf {
    let mut comps = path.components();
    if let Some(Component::Prefix(p)) = comps.next() {
        if let Prefix::VerbatimDisk(letter) = p.kind() {
            let mut out = PathBuf::from(format!("{}:\\", char::from(letter)));
            out.extend(comps.filter(|c| !matches!(c, Component::RootDir)));
            return out;
        }
    }
    path.to_path_buf()
}

/// Denylist from SAFETY_RULES. Known folders come from `dirs`, so folders redirected to
/// OneDrive or another drive are covered; the plain `%USERPROFILE%\X` form is added too in
/// case they are not redirected.
pub fn protected_paths() -> Vec<ProtectedPath> {
    let mut out = Vec::new();
    let mut add = |path: Option<PathBuf>, kind: ProtectKind| {
        if let Some(path) = path {
            out.push(ProtectedPath { path, kind });
        }
    };
    let var = |k: &str| env::var_os(k).map(PathBuf::from);

    for k in [
        "SystemRoot",
        "windir",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramW6432",
        "ProgramData",
    ] {
        add(var(k), ProtectKind::Subtree);
    }
    for p in [
        r"C:\Windows",
        r"C:\Program Files",
        r"C:\Program Files (x86)",
        r"C:\ProgramData",
    ] {
        add(Some(PathBuf::from(p)), ProtectKind::Subtree);
    }

    let home = dirs::home_dir();
    add(home.clone(), ProtectKind::Exact);
    add(dirs::config_dir(), ProtectKind::SubtreeUnlessExplicit); // AppData\Roaming
    for known in [
        dirs::document_dir(),
        dirs::desktop_dir(),
        dirs::picture_dir(),
        dirs::video_dir(),
        dirs::audio_dir(),
    ] {
        add(known, ProtectKind::SubtreeUnlessExplicit);
    }
    if let Some(home) = home {
        for name in [
            r"AppData\Roaming",
            "Documents",
            "Desktop",
            "Pictures",
            "Videos",
            "Music",
        ] {
            add(Some(home.join(name)), ProtectKind::SubtreeUnlessExplicit);
        }
    }
    out
}

// ---------- Recycle Bin ----------

fn wide(s: &OsStr) -> Vec<u16> {
    s.encode_wide().chain(std::iter::once(0)).collect()
}

fn from_wide(buf: &[u16]) -> String {
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}

/// Recycle Bin settings of the volume holding `path`, read from
/// `HKCU\...\Explorer\BitBucket\Volume\{GUID}` (`NukeOnDelete`, `MaxCapacity` in MB).
pub fn recycle_bin_limit(path: &Path) -> RecycleLimit {
    let mut mount = [0u16; 1024];
    let mut volume = [0u16; 128];
    let path_w = wide(path.as_os_str());
    // SAFETY: the input is NUL-terminated; both output buffers are writable and their
    // lengths are passed in u16 units.
    let ok = unsafe {
        GetVolumePathNameW(path_w.as_ptr(), mount.as_mut_ptr(), mount.len() as u32) != 0
            && GetVolumeNameForVolumeMountPointW(
                mount.as_ptr(),
                volume.as_mut_ptr(),
                volume.len() as u32,
            ) != 0
    };
    if !ok {
        return RecycleLimit::Unknown;
    }
    // "\\?\Volume{GUID}\" -> "{GUID}"
    let volume = from_wide(&volume);
    let (Some(start), Some(end)) = (volume.find('{'), volume.find('}')) else {
        return RecycleLimit::Unknown;
    };
    let key = format!(
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume\{}",
        &volume[start..=end]
    );
    // A missing key or missing MaxCapacity means we cannot be sure: report Unknown and let
    // the cleaner refuse, rather than risk a silent permanent delete.
    let Some(max_mb) = read_dword(&key, "MaxCapacity") else {
        return RecycleLimit::Unknown;
    };
    if read_dword(&key, "NukeOnDelete").unwrap_or(0) != 0 {
        return RecycleLimit::Disabled;
    }
    RecycleLimit::MaxBytes(u64::from(max_mb) * 1024 * 1024)
}

/// A DWORD under HKCU, or `None` if the key or value is missing or unreadable.
fn read_dword(key: &str, value: &str) -> Option<u32> {
    let key = wide(OsStr::new(key));
    let name = wide(OsStr::new(value));
    let mut data: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;
    // SAFETY: strings are NUL-terminated; `data` is a writable u32 and `size` matches it.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            key.as_ptr(),
            name.as_ptr(),
            RRF_RT_REG_DWORD,
            std::ptr::null_mut(),
            (&mut data as *mut u32).cast(),
            &mut size,
        )
    };
    (status == 0).then_some(data)
}

/// Total size and item count of the Recycle Bin on all drives.
pub fn recycle_bin_info() -> io::Result<(u64, u64)> {
    let mut info = SHQUERYRBINFO {
        cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
        i64Size: 0,
        i64NumItems: 0,
    };
    // SAFETY: null root = all drives; `info` is writable and has `cbSize` set.
    let hr = unsafe { SHQueryRecycleBinW(std::ptr::null(), &mut info) };
    if hr < 0 {
        return Err(io::Error::other(format!(
            "SHQueryRecycleBinW failed: {hr:#x}"
        )));
    }
    Ok((info.i64Size.max(0) as u64, info.i64NumItems.max(0) as u64))
}

/// Permanently empties the Recycle Bin on all drives. The UI confirms with the user first.
pub fn empty_recycle_bin() -> io::Result<()> {
    // SAFETY: no owner window; null root = all drives.
    let hr = unsafe {
        SHEmptyRecycleBinW(
            std::ptr::null_mut(),
            std::ptr::null(),
            SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND,
        )
    };
    // E_UNEXPECTED is what Windows returns when the bin is already empty.
    if hr < 0 && hr != E_UNEXPECTED {
        return Err(io::Error::other(format!(
            "SHEmptyRecycleBinW failed: {hr:#x}"
        )));
    }
    Ok(())
}

/// Storage paths (`X:\$Recycle.Bin\<SID>\$R...`) of every item in the current user's
/// Recycle Bin on all drives. The `trash` crate reports them as the item id.
pub fn recycle_bin_item_paths() -> io::Result<Vec<PathBuf>> {
    let items = trash::os_limited::list().map_err(|e| io::Error::other(e.to_string()))?;
    Ok(items.into_iter().map(|i| PathBuf::from(i.id)).collect())
}

/// Moves `from` to `to` on the same volume. Never replaces: without
/// `MOVEFILE_REPLACE_EXISTING` Windows itself refuses when `to` exists (`AlreadyExists`),
/// so there is no gap between a check and the move.
pub fn move_no_replace(from: &Path, to: &Path) -> io::Result<()> {
    let from_w = wide(from.as_os_str());
    let to_w = wide(to.as_os_str());
    // SAFETY: both strings are NUL-terminated and outlive the call. Flags 0: no replace, no
    // copy across volumes.
    let ok = unsafe { MoveFileExW(from_w.as_ptr(), to_w.as_ptr(), 0) };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}
