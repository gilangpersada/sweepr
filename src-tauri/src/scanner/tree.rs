//! Arena-based file tree (D-005) plus the read-only queries the UI needs.
//!
//! All nodes live in one `Vec<Node>` and refer to each other by `NodeId` (an index).
//! In Rust this avoids `Rc<RefCell<..>>` parent/child cycles and keeps memory compact.
//! Children are an intrusive singly linked list (`first_child` / `next_sibling`) instead of
//! a `Vec` per node, which saves ~16 bytes per node on trees with millions of entries.

use std::cmp::{Ordering, Reverse};
use std::collections::BinaryHeap;
use std::ffi::OsStr;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::category::{Categories, CategoryId, CategorySize};
use super::error::ScanError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct NodeId(pub u32);

impl NodeId {
    pub const ROOT: NodeId = NodeId(0);

    fn index(self) -> usize {
        self.0 as usize
    }
}

#[derive(Debug)]
pub struct Node {
    /// File name; for the root node this is the full root path.
    pub name: Box<OsStr>,
    pub parent: Option<NodeId>,
    pub is_dir: bool,
    /// Bytes. For folders: total of everything below (filled in by `aggregate`).
    pub size: u64,
    /// For folders: number of files below (recursive). For files: 0.
    pub file_count: u32,
    /// Last modified time, unix seconds.
    pub modified: Option<i64>,
    /// File category by extension. Always `OTHER` for folders. One byte; fits in padding.
    pub category: CategoryId,
    first_child: Option<NodeId>,
    next_sibling: Option<NodeId>,
}

/// Tree of one scan. Nodes are appended parent-before-child, so every child has a larger
/// index than its parent; `aggregate` relies on that.
#[derive(Debug)]
pub struct ScanTree {
    nodes: Vec<Node>,
}

impl ScanTree {
    pub fn new(root_name: &OsStr, modified: Option<i64>) -> Self {
        let root = Node {
            name: root_name.into(),
            parent: None,
            is_dir: true,
            size: 0,
            file_count: 0,
            modified,
            category: CategoryId::OTHER,
            first_child: None,
            next_sibling: None,
        };
        ScanTree { nodes: vec![root] }
    }

    /// Appends a node under `parent`. `size` and `category` are the file's own (ignored for
    /// folders).
    pub fn push(
        &mut self,
        parent: NodeId,
        name: &OsStr,
        is_dir: bool,
        size: u64,
        modified: Option<i64>,
        category: CategoryId,
    ) -> NodeId {
        let id = NodeId(u32::try_from(self.nodes.len()).expect("more than u32::MAX entries"));
        let parent_node = &mut self.nodes[parent.index()];
        debug_assert!(parent_node.is_dir, "parent must be a folder");
        let next_sibling = parent_node.first_child.replace(id);
        self.nodes.push(Node {
            name: name.into(),
            parent: Some(parent),
            is_dir,
            size: if is_dir { 0 } else { size },
            file_count: 0,
            modified,
            category: if is_dir { CategoryId::OTHER } else { category },
            first_child: None,
            next_sibling,
        });
        id
    }

    /// Fills folder `size` and `file_count` bottom-up. Call once, after traversal.
    pub fn aggregate(&mut self) {
        // Children always have a higher index than their parent, so walking backwards
        // visits every child before its parent.
        for i in (1..self.nodes.len()).rev() {
            let node = &self.nodes[i];
            let (size, files) = (node.size, if node.is_dir { node.file_count } else { 1 });
            let parent = node.parent.expect("non-root node has a parent").index();
            let p = &mut self.nodes[parent];
            p.size += size;
            p.file_count += files;
        }
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn root(&self) -> &Node {
        &self.nodes[0]
    }

    pub fn get(&self, id: NodeId) -> Result<&Node, ScanError> {
        self.nodes
            .get(id.index())
            .ok_or(ScanError::UnknownNode(id.0))
    }

    pub fn children(&self, id: NodeId) -> impl Iterator<Item = NodeId> + '_ {
        let mut next = self.nodes.get(id.index()).and_then(|n| n.first_child);
        std::iter::from_fn(move || {
            let cur = next?;
            next = self.nodes[cur.index()].next_sibling;
            Some(cur)
        })
    }

    /// Full path of a node, rebuilt from the parent chain (paths are not stored per node).
    pub fn path(&self, id: NodeId) -> Result<PathBuf, ScanError> {
        self.get(id)?;
        let mut parts = Vec::new();
        let mut cur = Some(id);
        while let Some(c) = cur {
            let node = &self.nodes[c.index()];
            parts.push(&*node.name);
            cur = node.parent;
        }
        Ok(parts.iter().rev().collect())
    }

    /// One page of a folder's children, sorted.
    pub fn children_page(
        &self,
        id: NodeId,
        sort: SortBy,
        order: SortOrder,
        offset: usize,
        limit: usize,
    ) -> Result<ChildrenPage, ScanError> {
        let parent = self.get(id)?;
        let mut ids: Vec<NodeId> = self.children(id).collect();
        ids.sort_by(|a, b| {
            let (a, b) = (&self.nodes[a.index()], &self.nodes[b.index()]);
            let ord = match sort {
                SortBy::Size => a.size.cmp(&b.size),
                SortBy::Name => cmp_names(&a.name, &b.name),
                SortBy::Modified => a.modified.cmp(&b.modified),
                SortBy::FileCount => a.file_count.cmp(&b.file_count),
            };
            let ord = if order == SortOrder::Desc {
                ord.reverse()
            } else {
                ord
            };
            // Stable tie-break so paging never shows the same row twice.
            ord.then_with(|| cmp_names(&a.name, &b.name))
        });
        let items = ids
            .iter()
            .skip(offset)
            .take(limit)
            .map(|&c| self.view(c, parent.size))
            .collect();
        Ok(ChildrenPage {
            total: ids.len(),
            items,
        })
    }

    /// The `limit` largest files in the whole tree, largest first.
    pub fn largest_files(&self, limit: usize) -> Vec<FileView> {
        if limit == 0 {
            return Vec::new();
        }
        // Min-heap of size `limit`: O(n log limit) and no full sort of millions of files.
        let mut heap: BinaryHeap<Reverse<(u64, u32)>> = BinaryHeap::with_capacity(limit + 1);
        for (i, node) in self.nodes.iter().enumerate().skip(1) {
            if node.is_dir {
                continue;
            }
            heap.push(Reverse((node.size, i as u32)));
            if heap.len() > limit {
                heap.pop();
            }
        }
        let root_size = self.root().size;
        let mut top: Vec<_> = heap.into_iter().map(|Reverse(x)| x).collect();
        top.sort_by(|a, b| b.cmp(a));
        top.into_iter()
            .map(|(_, i)| {
                let id = NodeId(i);
                FileView {
                    node: self.view(id, root_size),
                    path: self
                        .path(id)
                        .map(|p| p.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                }
            })
            .collect()
    }

    /// Size per file category below `id` (recursive), largest first. Categories without
    /// files are left out.
    pub fn category_summary(
        &self,
        id: NodeId,
        categories: &Categories,
    ) -> Result<Vec<CategorySize>, ScanError> {
        let start = self.get(id)?;
        let mut totals = vec![(0u64, 0u32); categories.id_count()];
        let mut add = |node: &Node| {
            if let Some(t) = totals.get_mut(usize::from(node.category.0)) {
                t.0 += node.size;
                t.1 += 1;
            }
        };
        if start.is_dir {
            // Explicit stack instead of recursion: folder depth is unbounded.
            let mut stack = vec![id];
            while let Some(dir) = stack.pop() {
                for c in self.children(dir) {
                    let node = &self.nodes[c.index()];
                    if node.is_dir {
                        stack.push(c);
                    } else {
                        add(node);
                    }
                }
            }
        } else {
            add(start);
        }
        let mut out: Vec<CategorySize> = totals
            .into_iter()
            .enumerate()
            .filter(|&(_, (_, files))| files > 0)
            .map(|(i, (size, file_count))| CategorySize {
                key: categories
                    .key(CategoryId(u8::try_from(i).unwrap_or(0)))
                    .to_string(),
                size,
                file_count,
            })
            .collect();
        out.sort_by(|a, b| b.size.cmp(&a.size).then_with(|| a.key.cmp(&b.key)));
        Ok(out)
    }

    pub fn view(&self, id: NodeId, parent_size: u64) -> NodeView {
        let n = &self.nodes[id.index()];
        NodeView {
            id: id.0,
            name: n.name.to_string_lossy().into_owned(),
            is_dir: n.is_dir,
            size: n.size,
            percent_of_parent: percent(n.size, parent_size),
            file_count: n.file_count,
            modified: n.modified,
            has_children: n.first_child.is_some(),
        }
    }
}

fn percent(part: u64, whole: u64) -> f64 {
    if whole == 0 {
        0.0
    } else {
        part as f64 / whole as f64 * 100.0
    }
}

fn cmp_names(a: &OsStr, b: &OsStr) -> Ordering {
    let (a, b) = (a.to_string_lossy(), b.to_string_lossy());
    a.to_lowercase()
        .cmp(&b.to_lowercase())
        .then_with(|| a.cmp(&b))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SortBy {
    Size,
    Name,
    Modified,
    FileCount,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SortOrder {
    Asc,
    Desc,
}

/// Lightweight row for the UI.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NodeView {
    pub id: u32,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub percent_of_parent: f64,
    pub file_count: u32,
    pub modified: Option<i64>,
    pub has_children: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChildrenPage {
    /// Number of children in total, for paging.
    pub total: usize,
    pub items: Vec<NodeView>,
}

/// A file row with its full path (used by the "largest files" list).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileView {
    #[serde(flatten)]
    pub node: NodeView,
    pub path: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn os(s: &str) -> &OsStr {
        OsStr::new(s)
    }

    /// root/
    ///   a/ (x.txt 10, y.txt 20, b/ (z.bin 5))
    ///   big.iso 100
    ///   empty/
    fn sample() -> ScanTree {
        let cats = categories();
        let c = |name: &str| cats.classify(os(name));
        let mut t = ScanTree::new(os("root"), None);
        let a = t.push(NodeId::ROOT, os("a"), true, 999, Some(1), c("a"));
        t.push(a, os("x.txt"), false, 10, Some(2), c("x.txt"));
        t.push(a, os("y.txt"), false, 20, Some(3), c("y.txt"));
        let b = t.push(a, os("b"), true, 0, None, c("b"));
        t.push(b, os("z.bin"), false, 5, None, c("z.bin"));
        t.push(
            NodeId::ROOT,
            os("big.iso"),
            false,
            100,
            Some(4),
            c("big.iso"),
        );
        t.push(NodeId::ROOT, os("empty"), true, 0, None, c("empty"));
        t.aggregate();
        t
    }

    fn categories() -> Categories {
        Categories::from_rules_json(
            r#"{ "category_extensions": { "document": [".txt"], "installer": [".iso"] } }"#,
        )
        .unwrap()
    }

    fn find(t: &ScanTree, parent: NodeId, name: &str) -> NodeId {
        t.children(parent)
            .find(|&c| &*t.get(c).unwrap().name == os(name))
            .unwrap()
    }

    #[test]
    fn aggregates_sizes_and_file_counts_bottom_up() {
        let t = sample();
        assert_eq!(t.root().size, 135);
        assert_eq!(t.root().file_count, 4);
        let a = t.get(find(&t, NodeId::ROOT, "a")).unwrap();
        // Folder's own reported size (999) is ignored; only contents count.
        assert_eq!((a.size, a.file_count), (35, 3));
        let empty = t.get(find(&t, NodeId::ROOT, "empty")).unwrap();
        assert_eq!((empty.size, empty.file_count), (0, 0));
    }

    #[test]
    fn children_sorted_by_size_desc_with_percent() {
        let t = sample();
        let page = t
            .children_page(NodeId::ROOT, SortBy::Size, SortOrder::Desc, 0, 10)
            .unwrap();
        let names: Vec<_> = page.items.iter().map(|v| v.name.as_str()).collect();
        assert_eq!(names, ["big.iso", "a", "empty"]);
        assert_eq!(page.total, 3);
        let pct: f64 = page.items.iter().map(|v| v.percent_of_parent).sum();
        assert!((pct - 100.0).abs() < 1e-9);
        assert!(page.items[1].has_children);
        assert!(!page.items[2].has_children);
    }

    #[test]
    fn children_paging_and_name_sort() {
        let t = sample();
        let page = t
            .children_page(NodeId::ROOT, SortBy::Name, SortOrder::Asc, 1, 1)
            .unwrap();
        assert_eq!(page.total, 3);
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].name, "big.iso");
        let past_end = t
            .children_page(NodeId::ROOT, SortBy::Name, SortOrder::Asc, 10, 5)
            .unwrap();
        assert!(past_end.items.is_empty());
    }

    #[test]
    fn unknown_node_is_an_error() {
        let t = sample();
        let err = t
            .children_page(NodeId(999), SortBy::Size, SortOrder::Desc, 0, 10)
            .unwrap_err();
        assert!(matches!(err, ScanError::UnknownNode(999)));
    }

    #[test]
    fn path_is_rebuilt_from_parents() {
        let t = sample();
        let a = find(&t, NodeId::ROOT, "a");
        let b = find(&t, a, "b");
        let z = find(&t, b, "z.bin");
        let expected: PathBuf = ["root", "a", "b", "z.bin"].iter().collect();
        assert_eq!(t.path(z).unwrap(), expected);
    }

    #[test]
    fn category_summary_sums_subtree_by_category() {
        let t = sample();
        let cats = categories();
        let row = |key: &str, size: u64, file_count: u32| CategorySize {
            key: key.to_string(),
            size,
            file_count,
        };
        assert_eq!(
            t.category_summary(NodeId::ROOT, &cats).unwrap(),
            [
                row("installer", 100, 1),
                row("document", 30, 2),
                row("other", 5, 1)
            ]
        );
        let a = find(&t, NodeId::ROOT, "a");
        assert_eq!(
            t.category_summary(a, &cats).unwrap(),
            [row("document", 30, 2), row("other", 5, 1)]
        );
        let empty = find(&t, NodeId::ROOT, "empty");
        assert!(t.category_summary(empty, &cats).unwrap().is_empty());
        // A single file summarizes itself.
        let iso = find(&t, NodeId::ROOT, "big.iso");
        assert_eq!(
            t.category_summary(iso, &cats).unwrap(),
            [row("installer", 100, 1)]
        );
        assert!(matches!(
            t.category_summary(NodeId(999), &cats),
            Err(ScanError::UnknownNode(999))
        ));
    }

    #[test]
    fn category_does_not_grow_node() {
        // Guards the memory budget: ~1M nodes per drive scan.
        assert!(std::mem::size_of::<Node>() <= 72);
    }

    #[test]
    fn largest_files_top_n() {
        let t = sample();
        let top = t.largest_files(2);
        let names: Vec<_> = top.iter().map(|f| f.node.name.as_str()).collect();
        assert_eq!(names, ["big.iso", "y.txt"]);
        assert!(top[1].path.ends_with("y.txt"));
        assert!(t.largest_files(0).is_empty());
        assert_eq!(t.largest_files(100).len(), 4);
    }
}
