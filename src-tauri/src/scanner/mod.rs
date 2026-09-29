//! Scanner: parallel traversal, arena-based tree model, size aggregation, cancellation.
//! See docs/ARCHITECTURE.md.

mod category;
mod error;
mod session;
mod tree;
mod walk;

pub use category::{Categories, CategoryConfigError, CategorySize};
pub use error::ScanError;
pub use session::{ScanEvent, ScanId, ScanSessions};
pub use tree::{ChildrenPage, FileView, NodeId, SortBy, SortOrder};
pub use walk::{scan, Progress, ScanOptions, ScanOutcome, ScanResult};

#[cfg(test)]
mod tests;
