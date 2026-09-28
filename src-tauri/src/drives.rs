//! Mounted drives and their capacity (via `sysinfo`, which is cross-platform).

use std::collections::HashSet;

use serde::Serialize;
use sysinfo::Disks;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    /// Volume label; may be empty (e.g. an unlabeled "Local Disk").
    pub name: String,
    /// Where to start a scan, e.g. `C:\`.
    pub mount_point: String,
    pub file_system: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub is_removable: bool,
}

pub fn list_drives() -> Vec<DriveInfo> {
    let disks = Disks::new_with_refreshed_list();
    let mut seen = HashSet::new();
    let mut drives: Vec<DriveInfo> = disks
        .list()
        .iter()
        .filter(|d| d.total_space() > 0)
        // The same volume can be listed twice; keep one entry per mount point.
        .filter(|d| seen.insert(d.mount_point().to_path_buf()))
        .map(|d| DriveInfo {
            name: d.name().to_string_lossy().into_owned(),
            mount_point: d.mount_point().to_string_lossy().into_owned(),
            file_system: d.file_system().to_string_lossy().into_owned(),
            total_bytes: d.total_space(),
            used_bytes: d.total_space().saturating_sub(d.available_space()),
            available_bytes: d.available_space(),
            is_removable: d.is_removable(),
        })
        .collect();
    drives.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));
    drives
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_at_least_one_drive_with_consistent_numbers() {
        let drives = list_drives();
        assert!(!drives.is_empty(), "expected at least one mounted drive");
        for d in &drives {
            assert!(d.total_bytes > 0);
            assert_eq!(d.used_bytes + d.available_bytes, d.total_bytes, "{d:?}");
            assert!(!d.mount_point.is_empty());
        }
    }
}
