//! Restore tests against a fake `$Recycle.Bin` inside a temp folder. `FakeBin` moves with
//! the same no-replace rule as the real one, so nothing here touches the real bin.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use super::*;
use crate::test_util::{canon, write_file};

#[derive(Clone, Default)]
struct FakeBin {
    paths: Arc<Mutex<Vec<PathBuf>>>,
}

impl BinSource for FakeBin {
    fn item_paths(&self) -> io::Result<Vec<PathBuf>> {
        Ok(self.paths.lock().unwrap().clone())
    }

    fn move_no_replace(&self, from: &Path, to: &Path) -> io::Result<()> {
        if fs::symlink_metadata(to).is_ok() {
            return Err(io::Error::from(io::ErrorKind::AlreadyExists));
        }
        fs::rename(from, to)
    }
}

/// `$I` version 2 record for `original`.
fn record_bytes(original: &Path, size: u64, deleted_unix: i64) -> Vec<u8> {
    let mut b = Vec::new();
    b.extend_from_slice(&2u64.to_le_bytes());
    b.extend_from_slice(&size.to_le_bytes());
    let ft = EPOCH_AS_FILETIME + deleted_unix as u64 * 10_000_000;
    b.extend_from_slice(&ft.to_le_bytes());
    let units: Vec<u16> = original
        .to_string_lossy()
        .encode_utf16()
        .chain([0])
        .collect();
    b.extend_from_slice(&(units.len() as u32).to_le_bytes());
    for u in units {
        b.extend_from_slice(&u.to_le_bytes());
    }
    b
}

struct Env {
    _dir: tempfile::TempDir,
    base: PathBuf,
    sid: PathBuf,
    bin: RecycleBin,
    fake: FakeBin,
    log_path: PathBuf,
}

fn env() -> Env {
    let dir = tempfile::tempdir().unwrap();
    // Plain (non-verbatim) form, like the paths Windows writes into `$I` records.
    let base = platform::display_path(&canon(dir.path()));
    let sid = base.join("$Recycle.Bin").join("S-1-5-TEST");
    fs::create_dir_all(&sid).unwrap();
    fs::create_dir_all(base.join("orig")).unwrap();
    let fake = FakeBin::default();
    let log_path = base.join("logs/cleanup.jsonl");
    let bin = RecycleBin::new(Box::new(fake.clone()), log_path.clone());
    Env {
        _dir: dir,
        base,
        sid,
        bin,
        fake,
        log_path,
    }
}

impl Env {
    /// Puts a file in the fake bin as if it had been deleted from `original`.
    fn trashed(&self, id: &str, original: &Path, len: usize, deleted: i64) -> PathBuf {
        let data = self.sid.join(format!("$R{id}"));
        write_file(&data, len);
        fs::write(
            self.sid.join(format!("$I{id}")),
            record_bytes(original, len as u64, deleted),
        )
        .unwrap();
        self.fake.paths.lock().unwrap().push(data.clone());
        data
    }

    fn orig(&self, name: &str) -> PathBuf {
        self.base.join("orig").join(name)
    }

    fn id_of(listing: &BinListing, name: &str) -> u32 {
        listing
            .items
            .iter()
            .find(|i| i.name == name)
            .unwrap()
            .item_id
    }
}

fn code(o: &RestoreOutcome) -> &str {
    o.error.as_ref().map_or("ok", |e| e.code.as_str())
}

#[test]
fn parses_version_1_and_2_records() {
    let path = PathBuf::from(r"C:\Users\me\Downloads\report.final.pdf");
    let v2 = record_bytes(&path, 1234, 1_790_000_000);
    let r = parse_record(&v2).unwrap();
    assert_eq!(r.original, path);
    assert_eq!((r.size, r.deleted), (1234, 1_790_000_000));

    let mut v1 = v2[..24].to_vec();
    v1[0] = 1;
    let mut fixed = vec![0u8; 520];
    for (i, u) in path.to_string_lossy().encode_utf16().enumerate() {
        fixed[i * 2..i * 2 + 2].copy_from_slice(&u.to_le_bytes());
    }
    v1.extend_from_slice(&fixed);
    assert_eq!(parse_record(&v1).unwrap().original, path);

    // Garbage, truncated, unknown version, relative path.
    assert!(parse_record(b"nope").is_none());
    assert!(parse_record(&v2[..30]).is_none());
    let mut v3 = v2.clone();
    v3[0] = 3;
    assert!(parse_record(&v3).is_none());
    assert!(parse_record(&record_bytes(Path::new("relative.txt"), 1, 0)).is_none());
}

#[test]
fn only_paths_inside_a_recycle_bin_are_items() {
    let ok = if cfg!(windows) {
        PathBuf::from(r"C:\$Recycle.Bin\S-1-5-21\$RAB12CD.txt")
    } else {
        PathBuf::from("/x/$Recycle.Bin/S-1-5-21/$RAB12CD.txt")
    };
    assert_eq!(
        record_path_for(&ok).unwrap().file_name().unwrap(),
        "$IAB12CD.txt"
    );
    let parent = ok.parent().unwrap();
    assert!(
        record_path_for(&parent.join("$IAB12CD.txt")).is_none(),
        "record, not data"
    );
    assert!(record_path_for(&parent.join("$R")).is_none());
    assert!(
        record_path_for(Path::new("$RAB12CD.txt")).is_none(),
        "relative"
    );
    let elsewhere = parent
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("Other/S-1/$RX.txt");
    assert!(record_path_for(&elsewhere).is_none());
}

#[test]
fn list_reads_records_newest_first_with_drive_totals() {
    let e = env();
    e.trashed("AAA.pdf", &e.orig("old.pdf"), 10, 100);
    e.trashed("BBB.json", &e.orig("capabilities.json"), 20, 200);
    // A data file without a readable record is counted, never listed.
    write_file(&e.sid.join("$RCCC.txt"), 5);
    e.fake.paths.lock().unwrap().push(e.sid.join("$RCCC.txt"));

    let listing = e.bin.list().unwrap();
    let names: Vec<_> = listing.items.iter().map(|i| i.name.as_str()).collect();
    assert_eq!(names, ["capabilities.json", "old.pdf"], "extension kept");
    assert_eq!(listing.unreadable_count, 1);
    assert_eq!(listing.items[0].size, 20);
    assert_eq!(listing.items[0].deleted, 200);
    assert_eq!(listing.drives.len(), 1);
    assert_eq!(listing.drives[0].size, 30);
    assert_eq!(listing.drives[0].item_count, 2);
    assert_eq!(listing.drives[0].drive, listing.items[0].drive);
}

#[test]
fn restore_moves_the_item_back_and_logs_it() {
    let e = env();
    let data = e.trashed("AAA.txt", &e.orig("notes.txt"), 42, 100);
    let listing = e.bin.list().unwrap();

    let res = e
        .bin
        .restore(listing.list_id, &[Env::id_of(&listing, "notes.txt")])
        .unwrap();
    assert_eq!((res.restored_count, res.failed_count), (1, 0));
    assert_eq!(res.restored_bytes, 42);
    assert_eq!(fs::metadata(e.orig("notes.txt")).unwrap().len(), 42);
    assert!(!data.exists());
    assert!(!e.sid.join("$IAAA.txt").exists(), "record removed");

    let log = fs::read_to_string(&e.log_path).unwrap();
    assert!(log.contains(r#""action":"restore""#), "{log}");
    assert!(log.contains(r#""ok":true"#), "{log}");
}

#[test]
fn restore_never_replaces_what_is_at_the_original_location() {
    let e = env();
    let data = e.trashed("AAA.txt", &e.orig("notes.txt"), 42, 100);
    let dir_data = e.trashed("BBB", &e.orig("folder"), 7, 100);
    let listing = e.bin.list().unwrap();
    fs::write(e.orig("notes.txt"), "newer file").unwrap();
    fs::create_dir(e.orig("folder")).unwrap();

    let res = e
        .bin
        .restore(
            listing.list_id,
            &[
                Env::id_of(&listing, "notes.txt"),
                Env::id_of(&listing, "folder"),
            ],
        )
        .unwrap();
    assert_eq!(res.restored_count, 0);
    assert!(res.items.iter().all(|o| code(o) == "originalExists"));
    assert_eq!(
        fs::read_to_string(e.orig("notes.txt")).unwrap(),
        "newer file"
    );
    assert!(data.exists() && dir_data.exists(), "still in the bin");
    assert!(e.sid.join("$IAAA.txt").exists());
}

#[test]
fn restore_checks_items_again() {
    let e = env();
    let gone = e.trashed("AAA.txt", &e.orig("gone.txt"), 1, 100);
    e.trashed("BBB.txt", &e.orig("changed.txt"), 1, 100);
    e.trashed("CCC.txt", &e.base.join("missing").join("x.txt"), 1, 100);
    let listing = e.bin.list().unwrap();

    fs::remove_file(gone).unwrap();
    // Same id reused for another original (e.g. bin emptied and refilled).
    fs::write(
        e.sid.join("$IBBB.txt"),
        record_bytes(&e.orig("other.txt"), 1, 100),
    )
    .unwrap();

    let ids: Vec<u32> = ["gone.txt", "changed.txt", "x.txt"]
        .iter()
        .map(|n| Env::id_of(&listing, n))
        .chain([9_999])
        .collect();
    let res = e.bin.restore(listing.list_id, &ids).unwrap();
    let codes: Vec<&str> = res.items.iter().map(code).collect();
    assert_eq!(
        codes,
        [
            "notFound",
            "changed",
            "originalFolderMissing",
            "unknownItem"
        ]
    );
    assert!(!e.orig("other.txt").exists() && !e.orig("changed.txt").exists());
}

#[cfg(windows)]
#[test]
fn restore_refuses_an_original_folder_behind_a_junction() {
    let e = env();
    let real = e.base.join("real");
    fs::create_dir(&real).unwrap();
    crate::test_util::make_junction(&real, &e.base.join("link"));
    e.trashed("AAA.txt", &e.base.join("link").join("a.txt"), 1, 100);
    e.trashed(
        "BBB.txt",
        &e.base.join("link").join("sub").join("b.txt"),
        1,
        100,
    );
    fs::create_dir(real.join("sub")).unwrap();
    let listing = e.bin.list().unwrap();
    let ids: Vec<u32> = listing.items.iter().map(|i| i.item_id).collect();

    let res = e.bin.restore(listing.list_id, &ids).unwrap();
    assert!(
        res.items.iter().all(|o| code(o) == "insideLink"),
        "{:?}",
        res.items
    );
    assert!(
        fs::read_dir(&real).unwrap().count() == 1,
        "only `sub`, nothing restored"
    );
}

#[test]
fn list_ids_are_single_use_and_expire() {
    let e = env();
    e.trashed("AAA.txt", &e.orig("a.txt"), 1, 100);
    let listing = e.bin.list().unwrap();
    assert!(matches!(
        e.bin.restore(listing.list_id + 1, &[0]),
        Err(CleanerError::UnknownPreview(_))
    ));
    e.bin.restore(listing.list_id, &[]).unwrap();
    assert!(
        matches!(
            e.bin.restore(listing.list_id, &[0]),
            Err(CleanerError::UnknownPreview(_))
        ),
        "consumed"
    );

    let mut bin = RecycleBin::new(Box::new(e.fake.clone()), e.log_path.clone());
    bin.ttl = Duration::ZERO;
    let listing = bin.list().unwrap();
    std::thread::sleep(Duration::from_millis(5));
    assert!(matches!(
        bin.restore(listing.list_id, &[0]),
        Err(CleanerError::PreviewExpired)
    ));
    assert!(
        e.orig("a.txt").symlink_metadata().is_err(),
        "nothing restored"
    );
}

#[test]
fn too_many_ids_are_refused() {
    let e = env();
    let listing = e.bin.list().unwrap();
    let ids: Vec<u32> = (0..=MAX_ITEMS as u32).collect();
    assert!(matches!(
        e.bin.restore(listing.list_id, &ids),
        Err(CleanerError::TooManyItems { .. })
    ));
}

/// Real Recycle Bin: trash a dummy file, find it in the list with its extension, restore it.
/// Run with `cargo test --lib real_ -- --ignored`.
#[cfg(windows)]
#[test]
#[ignore = "touches the real Recycle Bin"]
fn real_restore_round_trip() {
    let dir = tempfile::tempdir().unwrap();
    let file = platform::display_path(&canon(dir.path())).join("sweepr-restore-test.json");
    fs::write(&file, "{\"restore\": true}").unwrap();
    trash::delete(&file).unwrap();
    assert!(!file.exists());

    let log = dir.path().join("log.jsonl");
    let bin = RecycleBin::new(Box::new(SystemBin), log);
    let listing = bin.list().unwrap();
    let item = listing
        .items
        .iter()
        .find(|i| platform::path_eq(Path::new(&i.original_path), &file))
        .expect("dummy file is listed with its real name");
    assert_eq!(item.name, "sweepr-restore-test.json");
    assert_eq!(item.size, 17);

    let res = bin.restore(listing.list_id, &[item.item_id]).unwrap();
    assert_eq!(res.restored_count, 1, "{:?}", res.items);
    assert_eq!(fs::read_to_string(&file).unwrap(), "{\"restore\": true}");
    let again = bin.list().unwrap();
    assert!(
        !again
            .items
            .iter()
            .any(|i| platform::path_eq(Path::new(&i.original_path), &file)),
        "no longer in the bin"
    );
}
