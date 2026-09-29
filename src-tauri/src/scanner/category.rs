//! File categories by extension (video, photo, ...), read from the `category_extensions`
//! section of `config/cleaner-rules.<os>.json` (D-006).
//!
//! Each file stores only a 1-byte `CategoryId`; the names live once in `Categories`.

use std::collections::{BTreeMap, HashMap};
use std::ffi::OsStr;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// Index into `Categories::names`, or `OTHER` for files matching no category.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct CategoryId(pub u8);

impl CategoryId {
    pub const OTHER: CategoryId = CategoryId(0);
}

/// Key reported for files matching no configured category.
pub const OTHER_KEY: &str = "other";

#[derive(Debug, Clone, Default)]
pub struct Categories {
    /// `names[i]` is the name of `CategoryId(i + 1)`.
    names: Vec<String>,
    /// Lowercased extension without the dot -> category.
    by_ext: HashMap<String, CategoryId>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CategoryConfigError {
    #[error("invalid JSON: {0}")]
    Json(String),
    #[error("category name is empty or reserved: {0:?}")]
    BadName(String),
    #[error("too many categories (max 255)")]
    TooMany,
    #[error("extension {ext:?} in category {category:?} must look like \".mp4\"")]
    BadExtension { category: String, ext: String },
    #[error("extension {ext:?} is listed in both {first:?} and {second:?}")]
    Duplicate {
        ext: String,
        first: String,
        second: String,
    },
}

/// Only the part of the rules file the scanner needs; unknown fields are ignored.
#[derive(Deserialize)]
struct RulesFile {
    #[serde(default)]
    category_extensions: BTreeMap<String, Vec<String>>,
}

impl Categories {
    /// Parses the `category_extensions` section of a cleaner rules file.
    pub fn from_rules_json(json: &str) -> Result<Self, CategoryConfigError> {
        let file: RulesFile =
            serde_json::from_str(json).map_err(|e| CategoryConfigError::Json(e.to_string()))?;
        Self::from_map(file.category_extensions)
    }

    fn from_map(map: BTreeMap<String, Vec<String>>) -> Result<Self, CategoryConfigError> {
        if map.len() > usize::from(u8::MAX) {
            return Err(CategoryConfigError::TooMany);
        }
        let mut names = Vec::with_capacity(map.len());
        let mut by_ext = HashMap::new();
        for (i, (name, exts)) in map.into_iter().enumerate() {
            if name.trim().is_empty() || name == OTHER_KEY {
                return Err(CategoryConfigError::BadName(name));
            }
            let id = CategoryId(u8::try_from(i + 1).expect("checked above"));
            for ext in exts {
                let key = match ext.strip_prefix('.') {
                    Some(rest) if !rest.is_empty() && !rest.contains(['.', '/', '\\']) => {
                        rest.to_lowercase()
                    }
                    _ => {
                        return Err(CategoryConfigError::BadExtension {
                            category: name,
                            ext,
                        })
                    }
                };
                if let Some(prev) = by_ext.insert(key, id) {
                    // Q5 (M2): an extension may belong to one category only.
                    return Err(CategoryConfigError::Duplicate {
                        ext,
                        first: names
                            .get(usize::from(prev.0) - 1)
                            .cloned()
                            .unwrap_or_else(|| name.clone()),
                        second: name,
                    });
                }
            }
            names.push(name);
        }
        Ok(Categories { names, by_ext })
    }

    /// Category of a file by its extension (case-insensitive).
    pub fn classify(&self, file_name: &OsStr) -> CategoryId {
        if self.by_ext.is_empty() {
            return CategoryId::OTHER;
        }
        Path::new(file_name)
            .extension()
            .and_then(OsStr::to_str)
            .and_then(|ext| self.by_ext.get(&ext.to_lowercase()))
            .copied()
            .unwrap_or(CategoryId::OTHER)
    }

    /// Config key of a category (e.g. "video"), or `OTHER_KEY`.
    pub fn key(&self, id: CategoryId) -> &str {
        match id.0 {
            0 => OTHER_KEY,
            n => self
                .names
                .get(usize::from(n) - 1)
                .map_or(OTHER_KEY, String::as_str),
        }
    }

    /// Number of ids in use, including `OTHER`.
    pub fn id_count(&self) -> usize {
        self.names.len() + 1
    }
}

/// Total size of one category below a folder.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CategorySize {
    /// Config key such as "video", or "other".
    pub key: String,
    pub size: u64,
    pub file_count: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    const RULES: &str = r#"{
        "schema_version": 1,
        "rules": [],
        "category_extensions": {
            "video": [".mp4", ".MKV"],
            "archive": [".zip", ".7z"]
        }
    }"#;

    fn key_of(c: &Categories, name: &str) -> String {
        c.key(c.classify(OsStr::new(name))).to_string()
    }

    #[test]
    fn classifies_by_extension_case_insensitively() {
        let c = Categories::from_rules_json(RULES).unwrap();
        assert_eq!(key_of(&c, "movie.mp4"), "video");
        assert_eq!(key_of(&c, "MOVIE.MP4"), "video");
        assert_eq!(key_of(&c, "show.mkv"), "video");
        assert_eq!(key_of(&c, "backup.tar.7z"), "archive");
        assert_eq!(key_of(&c, "notes.txt"), OTHER_KEY);
        assert_eq!(key_of(&c, "Makefile"), OTHER_KEY);
        assert_eq!(key_of(&c, ".zip"), OTHER_KEY, "dotfile has no extension");
        assert_eq!(c.id_count(), 3);
    }

    #[test]
    fn duplicate_extension_is_rejected() {
        let json = r#"{ "category_extensions": { "a": [".zip"], "b": [".ZIP"] } }"#;
        let err = Categories::from_rules_json(json).unwrap_err();
        assert!(
            matches!(err, CategoryConfigError::Duplicate { .. }),
            "{err}"
        );
    }

    #[test]
    fn malformed_extensions_and_names_are_rejected() {
        for bad in ["zip", ".", "", ".tar.gz", "./x"] {
            let json = format!(r#"{{ "category_extensions": {{ "a": ["{bad}"] }} }}"#);
            assert!(
                matches!(
                    Categories::from_rules_json(&json),
                    Err(CategoryConfigError::BadExtension { .. })
                ),
                "{bad:?} should be rejected"
            );
        }
        let json = r#"{ "category_extensions": { "other": [".x"] } }"#;
        assert!(matches!(
            Categories::from_rules_json(json),
            Err(CategoryConfigError::BadName(_))
        ));
        assert!(matches!(
            Categories::from_rules_json("not json"),
            Err(CategoryConfigError::Json(_))
        ));
    }

    #[test]
    fn missing_section_means_everything_is_other() {
        let c = Categories::from_rules_json(r#"{ "rules": [] }"#).unwrap();
        assert_eq!(key_of(&c, "a.mp4"), OTHER_KEY);
        assert_eq!(c.id_count(), 1);
    }
}
