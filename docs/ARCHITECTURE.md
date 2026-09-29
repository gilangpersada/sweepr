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
    first_child: Option<NodeId>,   // anak sebagai linked list (hemat ~16 byte/node dibanding Vec)
    next_sibling: Option<NodeId>,
    category: CategoryId,      // u8, kategori ekstensi (M2); 0 = "other", selalu 0 untuk folder
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
| `get_children` | `scan_id`, `node_id`, `sort_by` (size/name/modified/fileCount), `order` (asc/desc), `offset`, `limit` (maks 5000) | `ChildrenPage { total, items: Vec<NodeView> }` |
| `get_category_summary` | `scan_id`, `node_id` | `Vec<CategorySize>` (`key, size, file_count`; `key` = nama kategori di config atau `other`) |
| `get_node_path` | `scan_id`, `node_id` | `String` (hanya untuk tampilan/salin, tidak pernah diterima balik) |
| `get_largest_files` | `scan_id`, `limit` (maks 5000) | `Vec<FileView>` (`NodeView` + `path`) |
| `reveal_in_explorer` | `scan_id`, `node_id` | — (path dihitung dari tree, D-015) |
| `preview_cleanup` | `rule_ids` | `CleanupPreview` (items dengan `item_id`) |
| `execute_cleanup` | `preview_id`, `item_ids` | `CleanupResult` |
| `empty_recycle_bin` | — | `Result` |

`NodeView` = versi ringan untuk UI: `id, name, is_dir, size, percent_of_parent, file_count, modified, has_children`.
Semua command query menerima `scan_id`; ID node dari scan lama ditolak (`unknownScan`) supaya tidak tertukar dengan tree baru. Node root selalu `0`.
Error command dikirim sebagai `{ code, message }` (`code` stabil untuk terjemahan UI).

## Event (backend → frontend)
- `scan-progress`: `{ scanId, filesSeen, dirsSeen, bytesSeen, currentPath }` (di-throttle ±10x/detik)
- `scan-finished`: `{ scanId, rootPath, rootId, totalBytes, totalFiles, nodeCount, skippedCount, elapsedMs }`
- `scan-failed`: `{ scanId, error: { code, message } }` · `scan-cancelled`: `{ scanId }` (juga dikirim bila scan digantikan scan baru)

## Scanner
- Gunakan traversal paralel (`jwalk`, atau `walkdir` + `rayon`).
- Jangan ikuti symlink/junction (`follow_links(false)`, cek reparse point di Windows).
- `AtomicBool` untuk pembatalan, dicek berkala.
- Error akses → tambah ke daftar `skipped`, lanjut. Folder yang tak terbaca tetap tampil (ukuran 0).
- Root yang berupa symlink/junction ditolak (`isLink`). Symlink/junction di dalam tree tidak ditampilkan dan tidak dimasuki.
- `jwalk` mengembalikan entry berurutan depth-first, jadi parent dilacak dengan stack per kedalaman (tanpa map path→id).
- Ukuran = ukuran logis file (`len`), bukan ukuran terpakai di disk.
- Agregasi ukuran folder dilakukan setelah traversal (bottom-up), bukan saat UI meminta.
- Kategori file (video, foto, ...) ditentukan saat scan dari `category_extensions` di `config/cleaner-rules.<os>.json` (disematkan saat kompilasi, D-017). `get_category_summary` menjumlahkan subtree saat diminta.

## Cleaner
1. `load_rules(os)` membaca `config/cleaner-rules.<os>.json`, memvalidasi skema.
2. `preview_cleanup` memperluas variabel lingkungan, mencocokkan file sesuai filter (umur, ekstensi), menjalankan `safety::validate` pada tiap item, lalu menyimpan preview di memori dengan `preview_id`.
3. `execute_cleanup` hanya menerima `preview_id` + `item_ids`; **tidak pernah** path mentah dari UI. Validasi ulang setiap path sebelum aksi, karena disk bisa berubah antara preview dan eksekusi.
4. Aksi default: `trash::delete`. Tulis log (JSON lines) ke folder data aplikasi.

## Frontend
- `src/lib/api.ts`: pembungkus bertipe untuk semua `invoke` dan `listen`.
- `src/views/`: `Home`, `ScanResult`, `Cleaner`.
- `src/components/`: `DriveCard`, `ProgressBanner`, `Breadcrumb`, `CategoryBar`, `FolderTable`, `LargestFiles`, `RowActions`, `VirtualList`, `icons`; `ConfirmDialog` menyusul di M3.
- `src/hooks/`: `useScan` (siklus scan dari event), `useChildren` (isi folder per halaman 500 baris), `useAsync` (query sekali ambil).
- State sederhana (React state/context); jangan tambah library state di MVP.
- Tabel memakai `VirtualList` (tinggi baris tetap, hanya baris terlihat di DOM) dan memuat `get_children` per halaman saat di-scroll (D-016).

## Cross-platform
- Semua path memakai `PathBuf`. Kode OS di `platform/`.
- Rule pembersih per OS di `config/`. macOS stub sudah ada, isinya kosong di MVP.
