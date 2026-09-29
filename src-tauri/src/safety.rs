//! Safety: protected paths (denylist) and path validation. See docs/SAFETY_RULES.md, which
//! wins over anything else. Every path the cleaner touches goes through `SafetyPolicy`:
//! once when the preview is built and again right before the action.

use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

use crate::platform;

/// How far a denylist entry reaches.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProtectKind {
    /// Only the folder itself (e.g. the user's home); its contents are allowed.
    Exact,
    /// The folder and everything below it, always (e.g. `C:\Windows`).
    Subtree,
    /// The folder and everything below it, unless a rule explicitly names it (or a folder
    /// inside it) as an allowed root, e.g. Documents or `AppData\Roaming`.
    SubtreeUnlessExplicit,
}

#[derive(Debug, Clone)]
pub struct ProtectedPath {
    pub path: PathBuf,
    pub kind: ProtectKind,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SafetyError {
    #[error("path is not absolute: {0}")]
    NotAbsolute(PathBuf),
    #[error("path contains '..': {0}")]
    ParentComponent(PathBuf),
    #[error("path does not exist: {0}")]
    NotFound(PathBuf),
    #[error("cannot read {0}: {1}")]
    Io(PathBuf, String),
    #[error("path is a symbolic link, junction or reparse point: {0}")]
    IsLink(PathBuf),
    #[error("path lies inside a symbolic link or junction: {0}")]
    InsideLink(PathBuf),
    #[error("path is a drive root: {0}")]
    DriveRoot(PathBuf),
    #[error("path is protected ({protected}): {path}")]
    Protected { path: PathBuf, protected: PathBuf },
    #[error("path is outside the rule's allowed folders: {0}")]
    OutsideAllowedRoots(PathBuf),
}

impl SafetyError {
    /// Stable code for the UI and the log.
    pub fn code(&self) -> &'static str {
        match self {
            SafetyError::NotAbsolute(_) => "notAbsolute",
            SafetyError::ParentComponent(_) => "parentComponent",
            SafetyError::NotFound(_) => "notFound",
            SafetyError::Io(..) => "io",
            SafetyError::IsLink(_) => "isLink",
            SafetyError::InsideLink(_) => "insideLink",
            SafetyError::DriveRoot(_) => "driveRoot",
            SafetyError::Protected { .. } => "protected",
            SafetyError::OutsideAllowedRoots(_) => "outsideAllowedRoots",
        }
    }
}

impl Serialize for SafetyError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("SafetyError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

/// The denylist plus the checks from SAFETY_RULES.
#[derive(Debug, Clone)]
pub struct SafetyPolicy {
    /// Canonical where the path exists, so it compares equal to canonicalized input.
    protected: Vec<ProtectedPath>,
    /// Folder names directly under a drive root that are always protected.
    root_names: Vec<String>,
}

impl SafetyPolicy {
    pub fn new(protected: Vec<ProtectedPath>, root_names: &[&str]) -> Self {
        let protected = protected
            .into_iter()
            .map(|p| ProtectedPath {
                // A protected folder that does not exist has no contents to protect, but keep
                // it anyway in case it appears later.
                path: fs::canonicalize(&p.path).unwrap_or(p.path),
                kind: p.kind,
            })
            .collect();
        SafetyPolicy {
            protected,
            root_names: root_names.iter().map(|s| s.to_lowercase()).collect(),
        }
    }

    /// The denylist of this OS and user.
    pub fn for_current_user() -> Self {
        Self::new(platform::protected_paths(), platform::ROOT_PROTECTED_NAMES)
    }

    /// Checks a rule's allowed root and returns its canonical form. Roots must exist, must
    /// not be (or sit inside) a link, and must not be a drive root or inside a folder that
    /// is always protected.
    pub fn resolve_root(&self, root: &Path) -> Result<PathBuf, SafetyError> {
        let canon = canonical_no_links(root)?;
        if canon.parent().is_none() {
            return Err(SafetyError::DriveRoot(display(&canon)));
        }
        self.check_root_names(&canon)?;
        if let Some(p) = self
            .protected
            .iter()
            .find(|p| p.kind == ProtectKind::Subtree && canon.starts_with(&p.path))
        {
            return Err(protected(&canon, p));
        }
        Ok(canon)
    }

    /// Validates a path the cleaner is about to show or act on. `roots` must come from
    /// `resolve_root`. Returns the canonical path to act on.
    pub fn validate(&self, path: &Path, roots: &[PathBuf]) -> Result<PathBuf, SafetyError> {
        let canon = canonical_no_links(path)?;
        if canon.parent().is_none() {
            return Err(SafetyError::DriveRoot(display(&canon)));
        }
        self.check_root_names(&canon)?;
        if let Some(p) = self.protected.iter().find(|p| blocks(p, &canon, roots)) {
            return Err(protected(&canon, p));
        }
        // Strictly inside: a rule may never remove its allowed root itself.
        if !roots
            .iter()
            .any(|r| canon.starts_with(r) && !platform::path_eq(&canon, r))
        {
            return Err(SafetyError::OutsideAllowedRoots(display(&canon)));
        }
        Ok(canon)
    }

    /// Whether a walker may enter `dir` (canonical) while collecting candidates for a rule
    /// with these `roots`. Protected subtrees are never entered.
    pub fn may_descend(&self, dir: &Path, roots: &[PathBuf]) -> bool {
        let blocked = |p: &ProtectedPath| match p.kind {
            ProtectKind::Exact => false,
            ProtectKind::Subtree => dir.starts_with(&p.path),
            // Entering an explicitly named protected folder is fine; removing it is not
            // (`validate` still refuses the folder itself).
            ProtectKind::SubtreeUnlessExplicit => {
                dir.starts_with(&p.path) && !roots.iter().any(|r| r.starts_with(&p.path))
            }
        };
        self.check_root_names(dir).is_ok() && !self.protected.iter().any(blocked)
    }

    fn check_root_names(&self, canon: &Path) -> Result<(), SafetyError> {
        // First normal component after the drive root, e.g. "$Recycle.Bin".
        let first = canon.components().find_map(|c| match c {
            Component::Normal(n) => Some(n.to_string_lossy().to_lowercase()),
            _ => None,
        });
        match first {
            Some(name) if self.root_names.contains(&name) => {
                let root: PathBuf = canon.components().take(3).collect();
                Err(SafetyError::Protected {
                    path: display(canon),
                    protected: display(&root),
                })
            }
            _ => Ok(()),
        }
    }
}

/// Does protected entry `p` block `canon` for a rule with these allowed `roots`?
fn blocks(p: &ProtectedPath, canon: &Path, roots: &[PathBuf]) -> bool {
    match p.kind {
        ProtectKind::Exact => platform::path_eq(canon, &p.path),
        ProtectKind::Subtree => canon.starts_with(&p.path),
        ProtectKind::SubtreeUnlessExplicit => {
            canon.starts_with(&p.path)
                && (platform::path_eq(canon, &p.path)
                    || !roots.iter().any(|r| r.starts_with(&p.path)))
        }
    }
}

/// Canonicalizes `path` after checking that neither it nor any folder above it is a link.
fn canonical_no_links(path: &Path) -> Result<PathBuf, SafetyError> {
    if !path.is_absolute() {
        return Err(SafetyError::NotAbsolute(path.to_path_buf()));
    }
    // Reject rather than normalize: a legitimate preview path never contains "..". Verbatim
    // paths (`\\?\C:\...`) report ".." as a normal component, so check names too.
    let dotted = |c: Component| match c {
        Component::ParentDir => true,
        Component::Normal(n) => n == ".." || n == ".",
        _ => false,
    };
    if path.components().any(dotted) {
        return Err(SafetyError::ParentComponent(path.to_path_buf()));
    }
    let meta = fs::symlink_metadata(path).map_err(|e| io_error(path, e))?;
    if platform::is_link(&meta) {
        return Err(SafetyError::IsLink(path.to_path_buf()));
    }
    let canon = fs::canonicalize(path).map_err(|e| io_error(path, e))?;
    // `canonicalize` resolves links on the way; if the result differs from the input, some
    // folder above `path` was a link (or a short 8.3 name, also rejected to be safe).
    let same = platform::path_eq(
        &platform::display_path(&canon),
        &platform::display_path(path),
    );
    if !same {
        return Err(SafetyError::InsideLink(path.to_path_buf()));
    }
    Ok(canon)
}

fn io_error(path: &Path, e: io::Error) -> SafetyError {
    match e.kind() {
        io::ErrorKind::NotFound => SafetyError::NotFound(path.to_path_buf()),
        _ => SafetyError::Io(path.to_path_buf(), e.to_string()),
    }
}

fn display(path: &Path) -> PathBuf {
    platform::display_path(path)
}

fn protected(canon: &Path, p: &ProtectedPath) -> SafetyError {
    SafetyError::Protected {
        path: display(canon),
        protected: display(&p.path),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::{canon, write_file};

    /// base/
    ///   allowed/        <- the rule's allowed root
    ///     junk.tmp
    ///     keep/         <- protected with SubtreeUnlessExplicit (like Documents)
    ///       inner.tmp
    ///   system/         <- protected with Subtree (like C:\Windows)
    ///     allowed-sys/x.tmp
    ///   home/           <- protected with Exact (like the user's home)
    ///     loose.tmp
    struct Fixture {
        _dir: tempfile::TempDir,
        base: PathBuf,
        policy: SafetyPolicy,
        root: PathBuf,
    }

    fn fixture() -> Fixture {
        let dir = tempfile::tempdir().unwrap();
        let base = canon(dir.path());
        write_file(&base.join("allowed/junk.tmp"), 1);
        write_file(&base.join("allowed/keep/inner.tmp"), 1);
        write_file(&base.join("system/allowed-sys/x.tmp"), 1);
        write_file(&base.join("home/loose.tmp"), 1);
        write_file(&base.join("outside.tmp"), 1);
        let policy = SafetyPolicy::new(
            vec![
                ProtectedPath {
                    path: base.join("allowed/keep"),
                    kind: ProtectKind::SubtreeUnlessExplicit,
                },
                ProtectedPath {
                    path: base.join("system"),
                    kind: ProtectKind::Subtree,
                },
                ProtectedPath {
                    path: base.join("home"),
                    kind: ProtectKind::Exact,
                },
            ],
            &["$Recycle.Bin"],
        );
        let root = policy.resolve_root(&base.join("allowed")).unwrap();
        Fixture {
            _dir: dir,
            base,
            policy,
            root,
        }
    }

    fn code(r: Result<PathBuf, SafetyError>) -> &'static str {
        r.map(|_| "ok").unwrap_or_else(|e| e.code())
    }

    #[test]
    fn file_inside_allowed_root_passes() {
        let f = fixture();
        let path = f.base.join("allowed/junk.tmp");
        let ok = f
            .policy
            .validate(&path, std::slice::from_ref(&f.root))
            .unwrap();
        assert_eq!(ok, canon(&path));
    }

    #[test]
    fn relative_and_parent_paths_are_rejected() {
        let f = fixture();
        let roots = [f.root.clone()];
        assert_eq!(
            code(f.policy.validate(Path::new("junk.tmp"), &roots)),
            "notAbsolute"
        );
        // Built from raw strings: `PathBuf::join("..")` on a verbatim path already pops.
        let sep = std::path::MAIN_SEPARATOR;
        let raw = |base: &Path, rest: &str| {
            PathBuf::from(format!(
                "{}{sep}{}",
                base.display(),
                rest.replace('/', &sep.to_string())
            ))
        };
        let plain_base = platform::display_path(&f.base);
        for base in [f.base.as_path(), plain_base.as_path()] {
            // Would resolve to base/outside.tmp; must be rejected, not normalized.
            let sneaky = raw(base, "allowed/../outside.tmp");
            assert_eq!(code(f.policy.validate(&sneaky, &roots)), "parentComponent");
            let sneaky_in = raw(base, "allowed/keep/../junk.tmp");
            assert_eq!(
                code(f.policy.validate(&sneaky_in, &roots)),
                "parentComponent"
            );
        }
        // And if something normalizes ".." away first, the result is still outside.
        let popped = f.base.join("allowed").join("..").join("outside.tmp");
        assert_eq!(
            code(f.policy.validate(&popped, &roots)),
            "outsideAllowedRoots"
        );
    }

    #[test]
    fn missing_path_is_rejected() {
        let f = fixture();
        let gone = f.base.join("allowed/gone.tmp");
        assert_eq!(
            code(f.policy.validate(&gone, std::slice::from_ref(&f.root))),
            "notFound"
        );
    }

    #[test]
    fn outside_allowed_roots_is_rejected() {
        let f = fixture();
        let roots = [f.root.clone()];
        let out = f.base.join("outside.tmp");
        assert_eq!(code(f.policy.validate(&out, &roots)), "outsideAllowedRoots");
        // The allowed root itself is never a target.
        assert_eq!(
            code(f.policy.validate(&f.root, &roots)),
            "outsideAllowedRoots"
        );
        // No roots at all: nothing is allowed.
        assert_eq!(
            code(f.policy.validate(&f.base.join("allowed/junk.tmp"), &[])),
            "outsideAllowedRoots"
        );
    }

    #[test]
    fn subtree_denylist_entries_and_descendants_are_rejected() {
        let f = fixture();
        // Even if a rule names a folder inside it as its root, a Subtree entry wins.
        assert_eq!(
            code(f.policy.resolve_root(&f.base.join("system/allowed-sys"))),
            "protected"
        );
        let roots = [f.base.clone()];
        assert_eq!(
            code(f.policy.validate(&f.base.join("system"), &roots)),
            "protected"
        );
        assert_eq!(
            code(
                f.policy
                    .validate(&f.base.join("system/allowed-sys/x.tmp"), &roots)
            ),
            "protected"
        );
        assert!(!f.policy.may_descend(&f.base.join("system"), &roots));
    }

    #[test]
    fn user_folders_are_protected_unless_a_rule_names_them() {
        let f = fixture();
        let inner = f.base.join("allowed/keep/inner.tmp");
        let keep = f.base.join("allowed/keep");
        // Root is the parent folder: not explicit, so the protected folder is off limits.
        assert_eq!(
            code(f.policy.validate(&inner, std::slice::from_ref(&f.root))),
            "protected"
        );
        assert_eq!(
            code(f.policy.validate(&keep, std::slice::from_ref(&f.root))),
            "protected"
        );
        assert!(!f.policy.may_descend(&keep, std::slice::from_ref(&f.root)));
        // A rule whose root is the protected folder itself may touch its contents...
        let explicit = f.policy.resolve_root(&keep).unwrap();
        assert_eq!(
            code(f.policy.validate(&inner, std::slice::from_ref(&explicit))),
            "ok"
        );
        assert!(f.policy.may_descend(&keep, std::slice::from_ref(&explicit)));
        // ...but never the protected folder itself.
        assert_eq!(code(f.policy.validate(&keep, &[explicit])), "protected");
    }

    #[test]
    fn exact_entries_protect_only_the_folder_itself() {
        let f = fixture();
        let roots = [f.base.clone()];
        assert_eq!(
            code(f.policy.validate(&f.base.join("home"), &roots)),
            "protected"
        );
        assert_eq!(
            code(f.policy.validate(&f.base.join("home/loose.tmp"), &roots)),
            "ok"
        );
        assert!(f.policy.may_descend(&f.base.join("home"), &roots));
    }

    #[test]
    fn drive_roots_are_rejected() {
        let f = fixture();
        let drive: PathBuf = f.base.components().take(2).collect();
        assert_eq!(code(f.policy.resolve_root(&drive)), "driveRoot");
        assert_eq!(
            code(f.policy.validate(&drive, std::slice::from_ref(&f.root))),
            "driveRoot"
        );
    }

    #[cfg(windows)]
    #[test]
    fn recycle_bin_folder_at_drive_root_is_rejected() {
        let f = fixture();
        let bin = PathBuf::from(r"C:\$Recycle.Bin");
        if bin.exists() {
            assert_eq!(code(f.policy.resolve_root(&bin)), "protected");
        }
    }

    #[cfg(windows)]
    #[test]
    fn junctions_and_paths_inside_them_are_rejected() {
        use crate::test_util::make_junction;
        let f = fixture();
        // allowed/link -> base/outside-dir (a folder the rule must never reach)
        write_file(&f.base.join("outside-dir/secret.txt"), 1);
        let link = f.base.join("allowed/link");
        make_junction(&f.base.join("outside-dir"), &link);
        let roots = [f.root.clone()];
        assert_eq!(code(f.policy.validate(&link, &roots)), "isLink");
        assert_eq!(
            code(f.policy.validate(&link.join("secret.txt"), &roots)),
            "insideLink"
        );
        // A root that is (or goes through) a junction is refused too.
        assert_eq!(code(f.policy.resolve_root(&link)), "isLink");
        assert_eq!(code(f.policy.resolve_root(&link.join("."))), "isLink");
    }

    #[test]
    fn symlinks_are_rejected_when_the_os_allows_creating_them() {
        let f = fixture();
        let link = f.base.join("allowed/file-link");
        #[cfg(windows)]
        let made = std::os::windows::fs::symlink_file(f.base.join("outside.tmp"), &link).is_ok();
        #[cfg(unix)]
        let made = std::os::unix::fs::symlink(f.base.join("outside.tmp"), &link).is_ok();
        if !made {
            eprintln!("skipped: creating symlinks needs Developer Mode on Windows");
            return;
        }
        assert_eq!(
            code(f.policy.validate(&link, std::slice::from_ref(&f.root))),
            "isLink"
        );
    }

    #[test]
    fn real_denylist_covers_safety_rules_minimum() {
        let policy = SafetyPolicy::for_current_user();
        let has = |p: &Path, kind: ProtectKind| {
            policy
                .protected
                .iter()
                .any(|e| e.kind == kind && platform::path_eq(&display(&e.path), p))
        };
        if cfg!(windows) {
            for p in [r"C:\Windows", r"C:\Program Files", r"C:\ProgramData"] {
                assert!(has(Path::new(p), ProtectKind::Subtree), "{p} missing");
            }
            let home = dirs::home_dir().unwrap();
            assert!(has(&home, ProtectKind::Exact));
            for name in [
                "Documents",
                "Desktop",
                "Pictures",
                "Videos",
                "Music",
                r"AppData\Roaming",
            ] {
                assert!(
                    has(&home.join(name), ProtectKind::SubtreeUnlessExplicit),
                    "{name} missing"
                );
            }
            // A real system file is refused even with the whole drive as a (bogus) root.
            let roots = [PathBuf::from(r"\\?\C:\")];
            let notepad = Path::new(r"C:\Windows\notepad.exe");
            if notepad.exists() {
                assert_eq!(code(policy.validate(notepad, &roots)), "protected");
            }
        }
    }
}
