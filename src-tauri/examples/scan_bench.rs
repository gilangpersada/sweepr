//! Scans a folder with the real scanner and prints timing and tree size.
//! Usage: cargo run --release --example scan_bench -- <path>

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use sweepr_lib::scanner::{scan, ScanOptions, ScanOutcome};

fn main() {
    let root = std::env::args().nth(1).expect("usage: scan_bench <path>");
    let outcome = scan(
        root.as_ref(),
        Arc::new(AtomicBool::new(false)),
        &ScanOptions::default(),
        |_| {},
    )
    .expect("scan failed");
    let ScanOutcome::Completed(r) = outcome else {
        unreachable!("never cancelled")
    };
    let root_node = r.tree.root();
    println!("root:      {}", r.root_path.display());
    println!("elapsed:   {:.2} s", r.elapsed.as_secs_f64());
    println!("nodes:     {}", r.tree.len());
    println!("files:     {}", root_node.file_count);
    println!(
        "bytes:     {} ({:.2} GiB)",
        root_node.size,
        root_node.size as f64 / (1u64 << 30) as f64
    );
    println!("skipped:   {}", r.skipped.len());
}
