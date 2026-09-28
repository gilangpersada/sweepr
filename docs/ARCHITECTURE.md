# ARCHITECTURE — Sweepr MVP

## Gambaran
```
React UI  <—invoke/events—>  Tauri commands (thin)  →  scanner / cleaner / safety / platform
```
Semua logika berat di Rust. UI hanya menampilkan data dan mengirim niat pengguna.

## Modul Rust
| Modul | Tanggung jawab |
|---|---|
| `scanner` | Traversal paralel, bangun tree in-memory, agregasi ukuran, cancel token |
| `cleaner` | Muat rule JSON, buat preview, eksekusi (via `trash`), logging |
| `safety` | Daftar path terlarang, validasi & kanonisasi path, cek symlink |
| `platform` | Kode khusus OS (`windows.rs`, `macos.rs` stub): known folders, buka di explorer |
| `commands` | Handler `#[tauri::command]`, tipis, hanya panggil modul di atas |

## Model data (Rust)
```rust
struct NodeId(u32);            // index ke arena Vec<Node>

struct Node {
    name: String,
    parent: Option<NodeId>,
    is_dir: bool,
    size: u64,                 // untuk folder = total isi (diagregasi)
    file_count: u32,           // hanya untuk folder
    modified: Option<i64>,     // unix seconds
    children: Vec<NodeId>,     // hanya folder
    ext_category: Option<CategoryId>,
}
```
- Simpan dalam **arena (`Vec<Node>`) + `NodeId`** supaya hemat memori dan tanpa referensi berputar.
- Path lengkap dihitung dari rantai `parent`, tidak disimpan per node.
- Tree hidup di `State` Tauri (`Mutex<Option<ScanResult>>`), dibuang saat scan baru.

## Command (frontend → backend)
| Command | Input | Output |
|---|---|---|
| `list_drives` | — | `Vec<DriveInfo>` |
| `start_scan` | `path` | `scan_id` (progress lewat event) |
| `cancel_scan` | `scan_id` | — |
| `get_children` | `node_id`, `sort_by`, `limit`, `offset` | `Vec<NodeView>` |
| `get_category_summary` | `node_id` | `Vec<CategorySize>` |
| `get_largest_files` | `limit` | `Vec<NodeView>` |
| `reveal_in_explorer` | `node_id` | — |
| `preview_cleanup` | `rule_ids` | `CleanupPreview` (items dengan `item_id`) |
| `execute_cleanup` | `preview_id`, `item_ids` | `CleanupResult` |
| `empty_recycle_bin` | — | `Result` |

`NodeView` = versi ringan untuk UI: `id, name, is_dir, size, percent_of_parent, file_count, modified`.

## Event (backend → frontend)
- `scan-progress`: `{ scan_id, files_seen, bytes_seen, current_path }` (di-throttle ±10x/detik)
- `scan-finished`: `{ scan_id, total_bytes, total_files, skipped_count, elapsed_ms }`
- `scan-failed` / `scan-cancelled`

## Scanner
- Gunakan traversal paralel (`jwalk`, atau `walkdir` + `rayon`).
- Jangan ikuti symlink/junction (`follow_links(false)`, cek reparse point di Windows).
- `AtomicBool` untuk pembatalan, dicek berkala.
- Error akses → tambah ke daftar `skipped`, lanjut.
- Agregasi ukuran folder dilakukan setelah traversal (bottom-up), bukan saat UI meminta.

## Cleaner
1. `load_rules(os)` membaca `config/cleaner-rules.<os>.json`, memvalidasi skema.
2. `preview_cleanup` memperluas variabel lingkungan, mencocokkan file sesuai filter (umur, ekstensi), menjalankan `safety::validate` pada tiap item, lalu menyimpan preview di memori dengan `preview_id`.
3. `execute_cleanup` hanya menerima `preview_id` + `item_ids`; **tidak pernah** path mentah dari UI. Validasi ulang setiap path sebelum aksi, karena disk bisa berubah antara preview dan eksekusi.
4. Aksi default: `trash::delete`. Tulis log (JSON lines) ke folder data aplikasi.

## Frontend
- `src/lib/api.ts`: pembungkus bertipe untuk semua `invoke` dan `listen`.
- `src/views/`: `Home`, `ScanResult`, `Cleaner`.
- `src/components/`: `DriveCard`, `FolderTable`, `Breadcrumb`, `CategoryBar`, `ConfirmDialog`, `ProgressBanner`.
- State sederhana (React state/context); jangan tambah library state di MVP.
- Tabel besar: gunakan windowing/virtual list jika > 500 baris.

## Cross-platform
- Semua path memakai `PathBuf`. Kode OS di `platform/`.
- Rule pembersih per OS di `config/`. macOS stub sudah ada, isinya kosong di MVP.
