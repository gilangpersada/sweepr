//! Cleaner rules: strict loading and validation of `config/cleaner-rules.<os>.json`.
//! Unknown fields, unknown actions and high-risk rules are rejected (SAFETY_RULES).

use std::collections::HashSet;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Risk {
    /// Recreated automatically (temp, caches). May be checked by default.
    Low,
    /// Can be recreated but costs time or bandwidth (`node_modules`). Never checked by default.
    Medium,
    // No `High`: not allowed in the MVP, so such a rule fails to parse.
}

/// Section of the cleaner screen a rule is shown in. Required, so every new rule picks one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Group {
    /// Useful to everyone (temp files, old installers).
    General,
    /// Only relevant to developers (`node_modules`, build caches). Shown as "Cache Developer".
    Developer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    /// Move to the Recycle Bin. The only action in the MVP (D-003).
    Trash,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Match {
    /// Files below the allowed roots, filtered by age and optionally by extension.
    FilesInRoot {
        recursive: bool,
        #[serde(default)]
        extensions: Vec<String>,
        min_age_days: u32,
    },
    /// Whole folders with this name, next to a project marker file (e.g. `node_modules`
    /// next to `package.json`).
    NamedDirectory {
        directory_name: String,
        project_marker_file: String,
        min_age_days: u32,
    },
}

impl Match {
    pub fn min_age_days(&self) -> u32 {
        match self {
            Match::FilesInRoot { min_age_days, .. }
            | Match::NamedDirectory { min_age_days, .. } => *min_age_days,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub group: Group,
    pub description: String,
    pub risk: Risk,
    pub default_checked: bool,
    /// Folders the rule may clean inside, with `%VAR%` placeholders.
    pub allowed_roots: Vec<String>,
    #[serde(rename = "match")]
    pub matcher: Match,
    pub action: Action,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RulesFile {
    #[serde(rename = "_note", default)]
    _note: Option<String>,
    schema_version: u32,
    os: String,
    rules: Vec<Rule>,
    /// Parsed by the scanner (`Categories`); only tolerated here.
    #[serde(rename = "category_extensions", default)]
    _category_extensions: serde_json::Value,
    #[serde(rename = "_executable_note", default)]
    _executable_note: Option<String>,
    #[serde(rename = "executable_extensions", default)]
    _executable_extensions: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum RuleError {
    #[error("invalid rules file: {0}")]
    Json(String),
    #[error("unsupported schema_version {0} (expected {SCHEMA_VERSION})")]
    SchemaVersion(u32),
    #[error("rules file is for {found:?}, this app runs on {expected:?}")]
    WrongOs { expected: String, found: String },
    #[error("rule {id:?}: {problem}")]
    Invalid { id: String, problem: String },
}

/// Parses and validates a rules file for `os` ("windows", "macos").
pub fn load_rules(json: &str, os: &str) -> Result<Vec<Rule>, RuleError> {
    let file: RulesFile = serde_json::from_str(json).map_err(|e| RuleError::Json(e.to_string()))?;
    if file.schema_version != SCHEMA_VERSION {
        return Err(RuleError::SchemaVersion(file.schema_version));
    }
    if file.os != os {
        return Err(RuleError::WrongOs {
            expected: os.to_string(),
            found: file.os,
        });
    }
    let mut ids = HashSet::new();
    for rule in &file.rules {
        let invalid = |problem: &str| RuleError::Invalid {
            id: rule.id.clone(),
            problem: problem.to_string(),
        };
        if rule.id.is_empty()
            || !rule
                .id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            return Err(invalid("id must be lowercase letters, digits and '-'"));
        }
        if !ids.insert(rule.id.as_str()) {
            return Err(invalid("duplicate id"));
        }
        if rule.name.trim().is_empty() {
            return Err(invalid("name is empty"));
        }
        if rule.allowed_roots.is_empty() {
            return Err(invalid("allowed_roots is empty"));
        }
        if rule.risk == Risk::Medium && rule.default_checked {
            return Err(invalid("medium-risk rules must not be checked by default"));
        }
        // 0 days would target files that are still being written.
        if rule.matcher.min_age_days() == 0 {
            return Err(invalid("min_age_days must be at least 1"));
        }
        match &rule.matcher {
            Match::FilesInRoot { extensions, .. } => {
                if extensions.iter().any(|e| !is_extension(e)) {
                    return Err(invalid("extensions must look like \".exe\""));
                }
            }
            Match::NamedDirectory {
                directory_name,
                project_marker_file,
                ..
            } => {
                if !is_plain_name(directory_name) || !is_plain_name(project_marker_file) {
                    return Err(invalid(
                        "directory_name and project_marker_file must be plain names",
                    ));
                }
            }
        }
    }
    Ok(file.rules)
}

fn is_extension(e: &str) -> bool {
    matches!(e.strip_prefix('.'), Some(rest) if is_plain_name(rest) && !rest.contains('.'))
}

/// A single path segment: no separators, not "." or "..".
fn is_plain_name(s: &str) -> bool {
    !s.is_empty() && s != "." && s != ".." && !s.contains(['/', '\\', ':'])
}

/// Replaces `%NAME%` placeholders using `lookup`. Fails on an unknown or unterminated
/// placeholder, so a typo never turns into a relative or empty root.
pub fn expand_vars(s: &str, lookup: impl Fn(&str) -> Option<PathBuf>) -> Result<PathBuf, String> {
    let mut out = String::new();
    let mut rest = s;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        let end = after
            .find('%')
            .ok_or_else(|| format!("unterminated %VAR% in {s:?}"))?;
        let name = &after[..end];
        let value = lookup(name).ok_or_else(|| format!("unknown variable %{name}% in {s:?}"))?;
        out.push_str(&value.to_string_lossy());
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    let path = PathBuf::from(out);
    if !path.is_absolute() {
        return Err(format!("{s:?} does not expand to an absolute path"));
    }
    Ok(path)
}

/// Values for `%NAME%`: known folders (which may be redirected, e.g. to OneDrive or another
/// drive) first, then environment variables.
pub fn system_var(name: &str) -> Option<PathBuf> {
    let known = match name.to_ascii_uppercase().as_str() {
        "DOWNLOADS" => dirs::download_dir(),
        "DOCUMENTS" => dirs::document_dir(),
        "DESKTOP" => dirs::desktop_dir(),
        "HOME" | "USERPROFILE" => dirs::home_dir(),
        _ => None,
    };
    known
        .or_else(|| std::env::var_os(name).map(PathBuf::from))
        .filter(|p| !p.as_os_str().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::CLEANER_RULES_JSON;

    fn file_with(rule: &str) -> String {
        format!(r#"{{ "schema_version": 1, "os": "windows", "rules": [{rule}] }}"#)
    }

    const GOOD: &str = r#"{
        "id": "user-temp", "name": "Temp", "group": "general", "description": "d", "risk": "low",
        "default_checked": true, "allowed_roots": ["%TEMP%"],
        "match": { "type": "files_in_root", "recursive": true, "min_age_days": 3 },
        "action": "trash"
    }"#;

    fn err(json: &str) -> String {
        load_rules(json, "windows").unwrap_err().to_string()
    }

    #[test]
    fn embedded_windows_rules_are_valid() {
        if cfg!(windows) {
            let rules = load_rules(CLEANER_RULES_JSON, "windows").unwrap();
            let ids: Vec<_> = rules.iter().map(|r| r.id.as_str()).collect();
            assert_eq!(ids, ["user-temp", "old-installers", "stale-node-modules"]);
            assert!(rules.iter().all(|r| r.action == Action::Trash));
            let groups: Vec<_> = rules.iter().map(|r| r.group).collect();
            assert_eq!(groups, [Group::General, Group::General, Group::Developer]);
            // Desktop/Documents are protected unless a rule names them: this one does.
            assert_eq!(
                rules[2].allowed_roots,
                ["%USERPROFILE%", "%DESKTOP%", "%DOCUMENTS%"]
            );
        }
    }

    #[test]
    fn group_is_required_and_checked() {
        let without = GOOD.replace(r#""group": "general", "#, "");
        assert!(err(&file_with(&without)).contains("missing field `group`"));
        let unknown = GOOD.replace(r#""group": "general""#, r#""group": "gamer""#);
        assert!(load_rules(&file_with(&unknown), "windows").is_err());
    }

    #[test]
    fn good_rule_parses() {
        let rules = load_rules(&file_with(GOOD), "windows").unwrap();
        assert_eq!(
            rules[0].matcher,
            Match::FilesInRoot {
                recursive: true,
                extensions: vec![],
                min_age_days: 3
            }
        );
    }

    #[test]
    fn schema_problems_are_rejected() {
        assert!(err("{").contains("invalid rules file"));
        assert!(
            err(r#"{ "schema_version": 2, "os": "windows", "rules": [] }"#)
                .contains("schema_version")
        );
        assert!(load_rules(&file_with(GOOD), "macos").is_err(), "wrong OS");
        // Unknown fields at every level.
        assert!(
            err(r#"{ "schema_version": 1, "os": "windows", "rules": [], "x": 1 }"#)
                .contains("unknown field")
        );
        assert!(err(&file_with(
            &GOOD.replace(r#""action""#, r#""extra": 1, "action""#)
        ))
        .contains("unknown field"));
        assert!(err(&file_with(
            &GOOD.replace(r#""recursive""#, r#""follow_links": true, "recursive""#)
        ))
        .contains("unknown field"));
    }

    #[test]
    fn unsafe_rules_are_rejected() {
        let cases = [
            (r#""risk": "low""#, r#""risk": "high""#),
            (r#""action": "trash""#, r#""action": "delete""#),
            (r#""min_age_days": 3"#, r#""min_age_days": 0"#),
            (r#""allowed_roots": ["%TEMP%"]"#, r#""allowed_roots": []"#),
            (r#""id": "user-temp""#, r#""id": "User Temp""#),
            (r#""type": "files_in_root""#, r#""type": "everything""#),
        ];
        for (from, to) in cases {
            assert!(
                load_rules(&file_with(&GOOD.replace(from, to)), "windows").is_err(),
                "{to}"
            );
        }
        let medium_checked = GOOD.replace(r#""risk": "low""#, r#""risk": "medium""#);
        assert!(err(&file_with(&medium_checked)).contains("medium-risk"));
        let two = format!("{GOOD}, {GOOD}");
        assert!(err(&file_with(&two)).contains("duplicate id"));
        let bad_ext = GOOD.replace(
            r#""recursive": true"#,
            r#""recursive": true, "extensions": ["exe"]"#,
        );
        assert!(err(&file_with(&bad_ext)).contains("extensions"));
        let bad_dir = r#"{
            "id": "nm", "name": "n", "group": "developer", "description": "d", "risk": "medium",
            "default_checked": false, "allowed_roots": ["%USERPROFILE%"],
            "match": { "type": "named_directory", "directory_name": "../x",
                       "project_marker_file": "package.json", "min_age_days": 60 },
            "action": "trash"
        }"#;
        assert!(err(&file_with(bad_dir)).contains("plain names"));
    }

    #[test]
    fn vars_expand_and_typos_fail() {
        let lookup = |name: &str| match name {
            "TEMP" => Some(PathBuf::from(if cfg!(windows) { r"C:\T" } else { "/t" })),
            _ => None,
        };
        let temp = expand_vars("%TEMP%", lookup).unwrap();
        assert!(temp.is_absolute());
        let sub = expand_vars(&format!("%TEMP%{}x", std::path::MAIN_SEPARATOR), lookup).unwrap();
        assert!(sub.ends_with("x"));
        assert!(expand_vars("%TMEP%", lookup)
            .unwrap_err()
            .contains("unknown variable"));
        assert!(expand_vars("%TEMP", lookup)
            .unwrap_err()
            .contains("unterminated"));
        assert!(expand_vars("relative", lookup)
            .unwrap_err()
            .contains("absolute"));
    }

    #[test]
    fn known_folders_resolve() {
        if cfg!(windows) {
            assert!(system_var("DOWNLOADS").is_some());
            assert!(system_var("TEMP").is_some());
            assert!(system_var("SWEEPR_DOES_NOT_EXIST").is_none());
        }
    }
}
