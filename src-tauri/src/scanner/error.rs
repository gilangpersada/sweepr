//! Error type for scanning and tree queries.

use std::path::PathBuf;

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum ScanError {
    #[error("path does not exist: {0}")]
    NotFound(PathBuf),
    #[error("path is not a folder: {0}")]
    NotADirectory(PathBuf),
    #[error("path is a symbolic link or junction and will not be followed: {0}")]
    IsLink(PathBuf),
    #[error("cannot read {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("scan {0} is unknown or no longer the current scan")]
    UnknownScan(u64),
    #[error("node {0} does not exist in this scan")]
    UnknownNode(u32),
}

impl ScanError {
    /// Stable, machine-readable code so the UI can pick its own (translated) message.
    pub fn code(&self) -> &'static str {
        match self {
            ScanError::NotFound(_) => "notFound",
            ScanError::NotADirectory(_) => "notADirectory",
            ScanError::IsLink(_) => "isLink",
            ScanError::Io { .. } => "io",
            ScanError::UnknownScan(_) => "unknownScan",
            ScanError::UnknownNode(_) => "unknownNode",
        }
    }
}

/// Serialized as `{ code, message }` for the frontend.
impl Serialize for ScanError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("ScanError", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}
