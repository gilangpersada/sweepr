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
| `cleaner` | Muat rule JSON, preview, eksekusi ke Recycle Bin (via `trash`), cek kapasitas Recycle Bin, log JSON lines |
| `safety` | `SafetyPolicy`: denylist, allowed roots, kanonisasi, tolak link/reparse point |
| `platform` | Kode khusus OS (`windows.rs`; `macos.rs` + `unix.rs` stub aman): denylist per OS, deteksi reparse point, buka di Explorer, info/kosongkan/kapasitas Recycle Bin |
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
| `get_category_files` | `scan_id`, `node_id`, `category` (key), `sort_by`, `order`, `offset`, `limit` (maks 5000) | `FilesPage { total, items: Vec<FileView> }` |
| `get_node_path` | `scan_id`, `node_id` | `String` (hanya untuk tampilan/salin, tidak pernah diterima balik) |
| `get_skipped` | `scan_id`, `offset`, `limit` (maks 5000) | `SkippedPage { total, items: [{ path, reason }] }` — item yang tidak bisa dibaca saat scan (FR-2); `reason` = teks error OS |
| `get_largest_files` | `scan_id`, `limit` (maks 5000) | `Vec<FileView>` (`NodeView` + `path`) |
| `reveal_in_explorer` | `scan_id`, `node_id` | — (path dihitung dari tree, D-015) |
| `list_cleaner_rules` | — | `Vec<RuleInfo>` (`id, name, group, description, risk, default_checked`) |
| `preview_cleanup` | `rule_ids` | `CleanupPreview { preview_id, max_items, rules: Vec<RulePreview> }`; tiap item punya `item_id` |
| `execute_cleanup` | `preview_id`, `item_ids` | `CleanupResult { trashed_count, trashed_bytes, failed_count, items }`; item gagal membawa `error { code, message }` |
| `estimate_cleanup` | — | `CleanupEstimate { total_bytes, item_count }` dari rule yang dicentang default; **tidak** menyimpan preview (Beranda, D-038) |
| `list_recycle_bin` | — | `BinListing { list_id, items: Vec<BinItem>, drives: Vec<BinDrive>, unreadable_count, max_items }`; `BinItem { item_id, name, original_path, drive, size, is_dir, deleted }` |
| `restore_from_recycle_bin` | `list_id`, `item_ids` | `RestoreResult { restored_count, restored_bytes, failed_count, items }`; item gagal membawa `error { code, message }` (`originalExists`, `notFound`, `changed`, `originalFolderMissing`, `insideLink`, ...) |
| `get_recycle_bin_info` | — | `RecycleBinInfo { size_bytes, item_count }` |
| `empty_recycle_bin` | — | — (permanen; UI wajib konfirmasi) |

`NodeView` = versi ringan untuk UI: `id, name, is_dir, size, percent_of_parent, file_count, modified, has_children`.
Semua command query menerima `scan_id`; ID node dari scan lama ditolak (`unknownScan`) supaya tidak tertukar dengan tree baru. Node root selalu `0`.
Error command dikirim sebagai `{ code, message }` (`code` stabil untuk terjemahan UI).

## Event (backend → frontend)
- `scan-progress`: `{ scanId, filesSeen, dirsSeen, bytesSeen, currentPath }` (di-throttle ±10x/detik)
- `scan-finished`: `{ scanId, rootPath, rootId, totalBytes, totalFiles, nodeCount, skippedCount, elapsedMs }`
- `scan-failed`: `{ scanId, error: { code, message } }` · `scan-cancelled`: `{ scanId }` (juga dikirim bila scan digantikan scan baru)

## Scanner
- Gunakan traversal paralel (`jwalk`, atau `walkdir` + `rayon`).
- Callback `process_read_dir` jwalk harus **berurutan** (tanpa `par_iter`/rayon di dalamnya): pool-nya sama dengan jwalk, dan paralel bersarang bisa deadlock (scan macet di 0, ditemukan di M6). Paralelisme antar-folder sudah dari jwalk.
- Jangan ikuti symlink/junction (`follow_links(false)`, cek reparse point di Windows).
- `AtomicBool` untuk pembatalan, dicek berkala.
- Error akses → tambah ke daftar `skipped`, lanjut. Folder yang tak terbaca tetap tampil (ukuran 0).
- Root yang berupa symlink/junction ditolak (`isLink`). Symlink/junction di dalam tree tidak ditampilkan dan tidak dimasuki.
- `jwalk` mengembalikan entry berurutan depth-first, jadi parent dilacak dengan stack per kedalaman (tanpa map path→id).
- Ukuran = ukuran logis file (`len`), bukan ukuran terpakai di disk.
- Agregasi ukuran folder dilakukan setelah traversal (bottom-up), bukan saat UI meminta.
- Kategori file (video, foto, ...) ditentukan saat scan dari `category_extensions` di `config/cleaner-rules.<os>.json` (disematkan saat kompilasi, D-017). `get_category_summary` menjumlahkan subtree saat diminta.

## Safety (`safety.rs`)
`SafetyPolicy` = denylist + pemeriksaan SAFETY_RULES. Dipakai dua kali per item: saat preview dan tepat sebelum aksi.
- `validate(path, roots)`: harus absolut, tanpa `..`/`.`; bukan link/junction/reparse point apa pun; `canonicalize` harus sama dengan input (kalau beda, ada link di atasnya → `insideLink`); bukan root drive; bukan `$Recycle.Bin`/`System Volume Information`/`Recovery` di root drive; tidak diblokir denylist; **di dalam** (bukan sama dengan) salah satu allowed root.
- Denylist (`platform::protected_paths`): `Subtree` (Windows, Program Files, ProgramData — selalu), `SubtreeUnlessExplicit` (Documents, Desktop, Pictures, Videos, Music, AppData\Roaming — isinya hanya boleh jika allowed root rule berada di/dalam folder itu; foldernya sendiri tidak pernah), `Exact` (folder home). Known folder dibaca via `dirs`, jadi yang dipindah ke OneDrive tetap terlindungi.
- `resolve_root`: allowed root rule harus ada, bukan/tidak di dalam link, bukan root drive, dan tidak di dalam entri `Subtree`.
- `may_descend`: walker tidak pernah masuk ke folder terlindungi.

## Cleaner (`cleaner/`)
1. `rules.rs`: memuat `config/cleaner-rules.<os>.json` yang disematkan (D-020) dengan validasi ketat — field asing ditolak, `group` wajib (`general`/`developer`, D-025), `action` hanya `trash`, `risk` hanya `low`/`medium` (medium tidak boleh dicentang default), `min_age_days ≥ 1`, id unik. `%VAR%` diekspansi (known folder via `dirs`, lalu env); variabel tak dikenal = error untuk root itu.
2. `matcher.rs`: `files_in_root` (umur + ekstensi opsional, rekursif opsional) dan `named_directory` (`node_modules` + `package.json`, D-021). Walker tidak pernah mengikuti link dan tidak masuk folder terlindungi. Folder kandidat berisi link dikecualikan (D-022). Root yang berada di dalam root lain tidak dimasuki dari root luar (ditelusuri sendiri), dan kandidat dibuang duplikatnya.
3. `preview(rule_ids)`: kandidat → `safety::validate` (yang gagal tidak pernah ditampilkan, hanya dihitung `excludedCount`) → urut terbesar → maks 10.000 per rule → disimpan di memori dengan `preview_id` (hanya satu preview aktif; preview baru menggantikan yang lama). Item rule `named_directory` membawa `project_modified` (tanggal terbaru `package.json`/folder project) untuk ditampilkan.
4. `execute(preview_id, item_ids)`: preview **dikonsumsi** (tidak bisa dipakai dua kali), ditolak jika > 30 menit atau > 10.000 item. Log dibuka dulu; kalau gagal, tidak ada aksi. Per item: `validate` ulang → `recheck` (fingerprint ukuran/waktu ubah harus sama, rule masih cocok) → cek Recycle Bin drive (D-019) → `trash::delete_all` per batch 100 (batch gagal diulang per item) → pastikan path sudah hilang. Setiap hasil langsung ditulis ke log.
5. Log JSON lines: `<app_log_dir>/cleanup.jsonl` (Windows: `%LOCALAPPDATA%\com.sweepr.app\logs`). Field: `ts` (unix ms), `action` (`trash`/`emptyRecycleBin`/`restore`), `previewId`, `ruleId`, `path`, `size`, `ok`, `reason`.
6. `empty_recycle_bin` = `SHEmptyRecycleBinW` semua drive, tanpa dialog Windows (konfirmasi ada di UI), dicatat di log.
7. `estimate()` memakai langkah yang sama dengan `preview` (`build`: cari kandidat + `validate`) untuk rule yang dicentang default, tanpa menyimpan apa pun, jadi preview yang terbuka di Pembersih tetap berlaku.
8. `recycle.rs` (D-039): `list` membaca path `$R…` dari `trash::os_limited::list`, lalu path asal/ukuran/waktu dari file `$I` pasangannya (format versi 1 dan 2), disimpan dengan `list_id` (sekali pakai, 30 menit). `restore` mengecek ulang tiap item lalu memindah dengan `platform::move_no_replace` (`MoveFileExW` tanpa replace) dan menghapus `$I`-nya; tidak pernah menimpa. Tes memakai `FakeBin` di folder `$Recycle.Bin` palsu; `real_restore_round_trip` (`--ignored`) memakai Recycle Bin asli.
9. Tes memakai `FakeTrasher` (trait `Trasher`) supaya tidak menyentuh Recycle Bin asli; `real_recycle_bin_round_trip` (`--ignored`) memverifikasi jalur asli dan membersihkan entrinya sendiri.

## Frontend
- `src/lib/api.ts`: pembungkus bertipe untuk semua `invoke` dan `listen`.
- `src/App.tsx`: memuat `list_drives` sekali (splash), memegang halaman aktif dan daftar halaman yang sudah dibuka. Halaman yang pernah dibuka tetap ter-mount (disembunyikan), jadi posisi folder, tab, dan pilihan pembersih tidak hilang saat pindah menu (D-033). Scan selesai → pindah ke Hasil Scan bila pengguna masih di menu Scan (di menu lain tidak ditarik pindah); scan baru → ke menu Scan (backend membuang hasil lama saat scan baru dimulai, jadi menu Hasil Scan nonaktif selama scan).
- `src/views/`: `Home` (kondisi sekarang + 4 langkah, D-038), `Scan` (drive, pilih folder, progress; satu-satunya tempat mulai scan selain "Scan ulang"), `ScanResult` (tab Folder / File Terbesar / Kategori), `Cleaner`, `RecycleBin` (ringkasan, daftar isi + Pulihkan, Kosongkan), `Settings` (bahasa, tema, versi).
- `src/components/`: `AppShell` (sidebar selalu lebar + indikator scan), `PageView` (transisi halaman), `SplashScreen`, `ThemeProvider`, `I18nProvider`, `DriveCard`, `ProgressBanner`, `Breadcrumb`, `CategoryView` (bar berlabel + legenda + tabel, klik → `CategoryFiles`), `CategoryFiles`, `BinList`, `FolderTable`, `LargestFiles`, `RowActions`, `VirtualList`, `icons`, `ConfirmDialog`, `RuleCard`, `CleanupResultView`, `SkippedDialog` (FR-2), `states` (`Spinner`, `LoadingState`, `EmptyState`, `ErrorState` dengan "Coba lagi").
- `src/components/ui/`: komponen dasar Neo-Brutalism — `Button` (primary/secondary/danger/ghost; `PRESSABLE` = geser ke arah bayangan saat hover/tekan, hanya `motion-safe`), `Card`, `Badge`, `Tabs` (pola ARIA, panah kiri/kanan), `Checkbox` (native, digambar ulang), `Input`, `ProgressBar` (nilai, atau blok "sedang bekerja"), `Dialog` (`<dialog>` bawaan + animasi), `CountUp`, `styles.ts` (`SECTION_TITLE`, `PAGE_BODY` = isi halaman rata kiri dengan satu lebar maksimum, D-041).
- Design token (D-031) hanya di `src/index.css`: nilai mentah per tema di `:root` / `[data-theme="dark"]`, dipetakan ke utilitas Tailwind lewat `@theme inline` (`bg-canvas`, `bg-surface`, `bg-sunken`, `text-ink`, `text-muted`, `border-line`, `bg-primary`/`-soft`, `bg-danger`/`-soft`/`text-danger-ink`, `info`, `success`, `text-on-accent`, `shadow-hard-sm|hard|hard-lg`, `rounded-control|card`, `bg-cat-*` untuk kategori). Komponen tidak memakai hex atau palet bawaan Tailwind (zinc/blue/...).
- Tema (D-034): `public/theme-init.js` (file terpisah, CSP melarang skrip inline) memasang `data-theme` sebelum render pertama; `ThemeProvider` menjaga atribut itu, mengikuti perubahan tema Windows saat "Ikut sistem", dan mengatur title bar lewat `getCurrentWindow().setTheme()` (izin `core:window:allow-set-theme`). `dark:` = `@custom-variant` pada atribut itu.
- Animasi (D-032): `LazyMotion features={domAnimation} strict` + `m` + `MotionConfig reducedMotion="user"` di `main.tsx`. Animasi yang bukan transform (lebar bar, blok "sedang bekerja", count-up, debu splash) memeriksa `useReducedMotion()` sendiri. Baris `VirtualList` tidak dianimasikan. `Dialog` masuk hanya dengan geser/skala (opacity tetap 1), jadi isi konfirmasi hapus langsung terbaca dan tombolnya langsung bisa dipakai.
- Loading screen (D-036): splash statis (`#splash`, CSS inline) di `index.html` → `SplashScreen` menghapusnya saat mount dan mengambil alih dengan animasi; keluar setelah `list_drives` selesai dan minimal 600 ms.
- `src/lib/i18n/`: kamus `id.ts` (acuan bentuk) + `en.ts`, `useI18n()` → `{ lang, setLang, t, fmt }`. Semua teks UI lewat `t`, semua angka/ukuran/tanggal lewat `fmt` (D-026). Pesan error backend dipetakan dari `code` ke `t.errors`; nama rule pembersih diterjemahkan lewat `t.rule.names[id]`.
- `src/hooks/`: `useScan` (siklus scan dari event, mencatat waktu selesai), `usePagedList` (daftar panjang per halaman 500 baris dari backend), `useChildren` (isi folder, di atas `usePagedList`), `useAsync` (query sekali ambil, dengan `retry`).
- State sederhana (React state/context); jangan tambah library state di MVP.
- Tabel memakai `VirtualList` (tinggi baris tetap, hanya baris terlihat di DOM) dan memuat `get_children` per halaman saat di-scroll (D-016).

## Cross-platform
- Semua path memakai `PathBuf`. Kode OS di `platform/`.
- Rule pembersih per OS di `config/`. macOS stub sudah ada, isinya kosong di MVP.
