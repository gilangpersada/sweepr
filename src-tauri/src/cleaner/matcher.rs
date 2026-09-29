//! Finds what a rule would clean. Never follows links, never enters protected folders, and
//! re-checks the same conditions right before execution (`recheck`).

use std::fs::{self, Metadata};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::rules::Match;
use crate::platform;
use crate::safety::SafetyPolicy;

const DAY_SECS: i64 = 86_400;

/// What must still be true at execution time for an item to be acted on. If anything
/// differs, the disk changed since the preview and the item is skipped.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fingerprint {
    pub modified: Option<i64>,
    /// Files only; a folder's size is not re-measured at execution.
    pub size: Option<u64>,
    /// `named_directory`: modified time of the marker file and of the project folder.
    pub marker_modified: Option<i64>,
    pub project_modified: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct Candidate {
    /// Canonical path (as produced by walking from a canonical root).
    pub path: PathBuf,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<i64>,
    pub fingerprint: Fingerprint,
}

#[derive(Debug, Default)]
pub struct Found {
    pub candidates: Vec<Candidate>,
    /// Folders or entries that could not be read.
    pub unreadable: usize,
    /// Matches left out on purpose (currently: folders that contain links).
    pub excluded: usize,
}

/// Collects candidates for `matcher` below `roots` (canonical, from `resolve_root`).
/// Safety validation of each candidate happens in the caller.
pub fn find(matcher: &Match, roots: &[PathBuf], policy: &SafetyPolicy, now: i64) -> Found {
    let mut found = Found::default();
    for root in roots {
        match matcher {
            Match::FilesInRoot { recursive, .. } => {
                found.unreadable += walk(root, policy, roots, *recursive, |path, meta| {
                    if let Some(fp) = check(matcher, path, meta, now) {
                        found.candidates.push(Candidate {
                            path: path.to_path_buf(),
                            is_dir: false,
                            size: meta.len(),
                            modified: fp.modified,
                            fingerprint: fp,
                        });
                    }
                    true
                });
            }
            Match::NamedDirectory { directory_name, .. } => {
                let mut matches = Vec::new();
                found.unreadable += walk(root, policy, roots, true, |path, meta| {
                    if !meta.is_dir() {
                        return false;
                    }
                    if name_is(path, directory_name) {
                        if let Some(fp) = check(matcher, path, meta, now) {
                            matches.push((path.to_path_buf(), fp));
                        }
                        // Never look inside, matched or not: nested copies go with it.
                        return false;
                    }
                    !skip_dir(path, meta)
                });
                for (path, fp) in matches {
                    let usage = folder_usage(&path, policy, roots);
                    found.unreadable += usage.unreadable;
                    if usage.links > 0 {
                        // Conservative (M3): a folder holding links/junctions (e.g. pnpm) is
                        // left out rather than trusting how the shell recycles them.
                        found.excluded += 1;
                        continue;
                    }
                    found.candidates.push(Candidate {
                        path,
                        is_dir: true,
                        size: usage.bytes,
                        modified: fp.modified,
                        fingerprint: fp,
                    });
                }
            }
        }
    }
    found
}

/// The item's fingerprint if it still matches the rule now, `None` otherwise.
pub fn recheck(matcher: &Match, path: &Path, now: i64) -> Option<Fingerprint> {
    let meta = fs::symlink_metadata(path).ok()?;
    if platform::is_link(&meta) {
        return None;
    }
    check(matcher, path, &meta, now)
}

fn check(matcher: &Match, path: &Path, meta: &Metadata, now: i64) -> Option<Fingerprint> {
    let old_enough =
        |t: Option<i64>| t.is_some_and(|t| t <= now - i64::from(matcher.min_age_days()) * DAY_SECS);
    match matcher {
        Match::FilesInRoot { extensions, .. } => {
            if !meta.is_file() {
                return None;
            }
            let modified = modified_secs(meta);
            let ext_ok = extensions.is_empty()
                || path
                    .extension()
                    .map(|e| format!(".{}", e.to_string_lossy()))
                    .is_some_and(|e| extensions.iter().any(|x| x.eq_ignore_ascii_case(&e)));
            (ext_ok && old_enough(modified)).then_some(Fingerprint {
                modified,
                size: Some(meta.len()),
                marker_modified: None,
                project_modified: None,
            })
        }
        Match::NamedDirectory {
            directory_name,
            project_marker_file,
            ..
        } => {
            if !meta.is_dir() || !name_is(path, directory_name) {
                return None;
            }
            let project = path.parent()?;
            let marker =
                no_link_meta(&project.join(project_marker_file)).filter(Metadata::is_file)?;
            let project_meta = no_link_meta(project)?;
            let (marker_modified, project_modified) =
                (modified_secs(&marker), modified_secs(&project_meta));
            // Q5 (M3): the project counts as untouched only if both are old.
            (old_enough(marker_modified) && old_enough(project_modified)).then_some(Fingerprint {
                modified: modified_secs(meta),
                size: None,
                marker_modified,
                project_modified,
            })
        }
    }
}

/// Depth-first walk below `root` without following links or entering protected folders.
/// `visit` sees every non-link entry and returns whether to descend (folders only).
/// Returns the number of unreadable folders/entries.
fn walk(
    root: &Path,
    policy: &SafetyPolicy,
    roots: &[PathBuf],
    recursive: bool,
    mut visit: impl FnMut(&Path, &Metadata) -> bool,
) -> usize {
    let mut unreadable = 0;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            unreadable += 1;
            continue;
        };
        for entry in entries {
            // `DirEntry::metadata` does not follow links (and is free on Windows).
            let Ok((entry, meta)) = entry.and_then(|e| e.metadata().map(|m| (e, m))) else {
                unreadable += 1;
                continue;
            };
            if platform::is_link(&meta) {
                continue;
            }
            let path = entry.path();
            let descend = visit(&path, &meta);
            if meta.is_dir() && recursive && descend && policy.may_descend(&path, roots) {
                stack.push(path);
            }
        }
    }
    unreadable
}

struct Usage {
    bytes: u64,
    links: usize,
    unreadable: usize,
}

/// Total file size below a folder, and how many links it contains.
fn folder_usage(dir: &Path, policy: &SafetyPolicy, roots: &[PathBuf]) -> Usage {
    let mut usage = Usage {
        bytes: 0,
        links: 0,
        unreadable: 0,
    };
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(entries) = fs::read_dir(&d) else {
            usage.unreadable += 1;
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else {
                usage.unreadable += 1;
                continue;
            };
            if platform::is_link(&meta) {
                usage.links += 1;
            } else if meta.is_dir() {
                let path = entry.path();
                if policy.may_descend(&path, roots) {
                    stack.push(path);
                }
            } else {
                usage.bytes += meta.len();
            }
        }
    }
    usage
}

/// Hidden and dot folders (AppData, .git, .cache, ...) are not searched for projects.
fn skip_dir(path: &Path, meta: &Metadata) -> bool {
    platform::is_hidden(meta)
        || path
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with('.'))
}

fn name_is(path: &Path, name: &str) -> bool {
    path.file_name()
        .is_some_and(|n| n.to_string_lossy().eq_ignore_ascii_case(name))
}

fn no_link_meta(path: &Path) -> Option<Metadata> {
    fs::symlink_metadata(path)
        .ok()
        .filter(|m| !platform::is_link(m))
}

pub fn modified_secs(meta: &Metadata) -> Option<i64> {
    let secs = meta
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_secs();
    i64::try_from(secs).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::safety::{ProtectKind, ProtectedPath};
    use crate::test_util::{age, canon, write_file};
    use std::time::SystemTime;

    fn now() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64
    }

    fn names(found: &Found) -> Vec<String> {
        let mut v: Vec<_> = found
            .candidates
            .iter()
            .map(|c| c.path.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        v.sort();
        v
    }

    fn open_policy() -> SafetyPolicy {
        SafetyPolicy::new(vec![], &[])
    }

    #[test]
    fn files_filtered_by_age_extension_and_depth() {
        let dir = tempfile::tempdir().unwrap();
        let root = canon(dir.path());
        write_file(&root.join("old.exe"), 10);
        write_file(&root.join("OLD2.MSI"), 20);
        write_file(&root.join("new.exe"), 30);
        write_file(&root.join("old.txt"), 40);
        write_file(&root.join("sub/deep.exe"), 50);
        for f in ["old.exe", "OLD2.MSI", "old.txt", "sub/deep.exe"] {
            age(&root.join(f), 40);
        }
        let flat = Match::FilesInRoot {
            recursive: false,
            extensions: vec![".exe".into(), ".msi".into()],
            min_age_days: 30,
        };
        let found = find(&flat, std::slice::from_ref(&root), &open_policy(), now());
        assert_eq!(names(&found), ["OLD2.MSI", "old.exe"]);
        assert_eq!(found.candidates.iter().map(|c| c.size).sum::<u64>(), 30);

        let deep = Match::FilesInRoot {
            recursive: true,
            extensions: vec![],
            min_age_days: 30,
        };
        let found = find(&deep, std::slice::from_ref(&root), &open_policy(), now());
        assert_eq!(
            names(&found),
            ["OLD2.MSI", "deep.exe", "old.exe", "old.txt"]
        );
    }

    #[test]
    fn protected_folders_are_not_entered() {
        let dir = tempfile::tempdir().unwrap();
        let root = canon(dir.path());
        write_file(&root.join("a.tmp"), 1);
        write_file(&root.join("guarded/b.tmp"), 1);
        age(&root.join("a.tmp"), 10);
        age(&root.join("guarded/b.tmp"), 10);
        let policy = SafetyPolicy::new(
            vec![ProtectedPath {
                path: root.join("guarded"),
                kind: ProtectKind::SubtreeUnlessExplicit,
            }],
            &[],
        );
        let m = Match::FilesInRoot {
            recursive: true,
            extensions: vec![],
            min_age_days: 1,
        };
        assert_eq!(names(&find(&m, &[root], &policy, now())), ["a.tmp"]);
    }

    fn node_modules_fixture(root: &Path, project: &str, days: u64) {
        let p = root.join(project);
        write_file(&p.join("package.json"), 2);
        write_file(&p.join("node_modules/lib/index.js"), 100);
        write_file(&p.join("node_modules/lib/node_modules/nested/x.js"), 50);
        age(&p.join("package.json"), days);
        age(&p, days);
    }

    fn nm_rule() -> Match {
        Match::NamedDirectory {
            directory_name: "node_modules".into(),
            project_marker_file: "package.json".into(),
            min_age_days: 60,
        }
    }

    #[test]
    fn stale_node_modules_are_found_with_size_and_nested_copies_are_not_listed() {
        let dir = tempfile::tempdir().unwrap();
        let root = canon(dir.path());
        node_modules_fixture(&root, "old-project", 90);
        node_modules_fixture(&root, "fresh-project", 5);
        // No marker file: not a project.
        write_file(&root.join("loose/node_modules/y.js"), 7);
        age(&root.join("loose"), 90);
        // Hidden-by-name folders are not searched.
        node_modules_fixture(&root, ".cache/tool", 90);

        let found = find(
            &nm_rule(),
            std::slice::from_ref(&root),
            &open_policy(),
            now(),
        );
        assert_eq!(found.candidates.len(), 1, "{:?}", found.candidates);
        let c = &found.candidates[0];
        assert!(c.is_dir);
        assert!(c
            .path
            .ends_with(Path::new("old-project").join("node_modules")));
        assert_eq!(c.size, 150);
    }

    #[test]
    fn recheck_detects_changes() {
        let dir = tempfile::tempdir().unwrap();
        let root = canon(dir.path());
        let file = root.join("old.log");
        write_file(&file, 10);
        age(&file, 10);
        let m = Match::FilesInRoot {
            recursive: false,
            extensions: vec![],
            min_age_days: 3,
        };
        let found = find(&m, std::slice::from_ref(&root), &open_policy(), now());
        let fp = found.candidates[0].fingerprint.clone();
        assert_eq!(recheck(&m, &file, now()), Some(fp.clone()));
        // Rewritten since the preview: new size and a fresh time -> no longer matches.
        write_file(&file, 11);
        assert_eq!(recheck(&m, &file, now()), None);
        // Same age but different size -> different fingerprint.
        age(&file, 10);
        assert_ne!(recheck(&m, &file, now()), Some(fp));
        fs::remove_file(&file).unwrap();
        assert_eq!(recheck(&m, &file, now()), None);

        node_modules_fixture(&root, "p", 90);
        let nm = root.join("p/node_modules");
        let fp = recheck(&nm_rule(), &nm, now()).unwrap();
        // `npm install` touches package.json -> the project is not stale any more.
        write_file(&root.join("p/package.json"), 3);
        assert_ne!(recheck(&nm_rule(), &nm, now()), Some(fp));
    }

    #[cfg(windows)]
    #[test]
    fn links_are_never_followed_and_folders_with_links_are_excluded() {
        use crate::test_util::make_junction;
        let dir = tempfile::tempdir().unwrap();
        let root = canon(dir.path());
        let outside = root.join("outside");
        write_file(&outside.join("victim.tmp"), 1);
        age(&outside.join("victim.tmp"), 10);
        let scan_root = root.join("scan");
        fs::create_dir(&scan_root).unwrap();
        make_junction(&outside, &scan_root.join("link"));
        let m = Match::FilesInRoot {
            recursive: true,
            extensions: vec![],
            min_age_days: 1,
        };
        let found = find(&m, std::slice::from_ref(&scan_root), &open_policy(), now());
        assert!(found.candidates.is_empty(), "{:?}", found.candidates);

        // pnpm-style node_modules with a junction inside is left out.
        node_modules_fixture(&scan_root, "pnpm-project", 90);
        make_junction(
            &outside,
            &scan_root.join("pnpm-project/node_modules/linked"),
        );
        age(&scan_root.join("pnpm-project"), 90);
        let found = find(&nm_rule(), &[scan_root], &open_policy(), now());
        assert!(found.candidates.is_empty());
        assert_eq!(found.excluded, 1);
        assert!(outside.join("victim.tmp").exists());
    }
}
