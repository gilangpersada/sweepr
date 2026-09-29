//! Append-only JSON lines log of every cleaner action (SAFETY_RULES: time, rule, path,
//! size, result). One object per line so it stays readable even if a write is cut short.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry<'a> {
    /// Unix milliseconds.
    pub ts: u64,
    /// "trash" or "emptyRecycleBin".
    pub action: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_id: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<&'a str>,
    pub size: u64,
    pub ok: bool,
    /// Failure code, e.g. "changed" or "trashFailed".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub struct ActionLog {
    path: PathBuf,
}

impl ActionLog {
    pub fn new(path: PathBuf) -> Self {
        ActionLog { path }
    }

    /// Opens the log for appending, creating its folder if needed. Callers open it before
    /// acting, so an unwritable log stops the action instead of running it unrecorded.
    pub fn open(&self) -> io::Result<LogWriter> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir)?;
        }
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        Ok(LogWriter { file })
    }
}

pub struct LogWriter {
    file: File,
}

impl LogWriter {
    pub fn write(&mut self, entry: &LogEntry) -> io::Result<()> {
        let mut line = serde_json::to_vec(entry).map_err(io::Error::other)?;
        line.push(b'\n');
        // One `write_all` per line; the file is opened in append mode.
        self.file.write_all(&line)
    }
}
