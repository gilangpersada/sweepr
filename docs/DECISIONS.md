# DECISIONS

## Keputusan (ADR ringkas)
| ID | Keputusan | Alasan | Status |
|---|---|---|---|
| D-001 | Stack: Tauri 2 + React + TS | Scan cepat & ringan, cross-platform, UI berbasis web yang familier | Diterima |
| D-002 | Windows dulu, siap macOS | Pengguna awal di Windows; struktur `platform/` + rule per OS | Diterima |
| D-004 | Scan mode biasa dulu (tanpa admin) | Lebih sederhana & aman; MFT ke roadmap | Diterima |
| D-005 | Pohon in-memory berbasis arena, children dimuat lazy | Hemat memori, UI tidak menerima data raksasa | Diterima |
| D-006 | Rule pembersih berupa JSON per OS | Mudah menambah/ubah tanpa kompilasi ulang | Diterima |
| D-007 | Styling: Tailwind CSS v4 via `@tailwindcss/vite` | Dipilih pemilik di M0; v4 tanpa config/PostCSS terpisah; dark mode ikut `prefers-color-scheme` | Diterima |
| D-008 | Toolchain minimum: Node ≥ 22.12 (dipakai: 24 LTS), Rust stable MSVC | Vite 8/ESLint 10 butuh Node ≥ 20.19; Node 20 sudah EOL | Diterima |
| D-009 | Webview dikunci CSP ketat (hanya `self` + IPC Tauri) | Mendukung aturan "tanpa jaringan"; berlaku di build produksi | Diterima |
| D-010 | Nama app: **Sweepr** (repo `sweepr`, identifier `com.sweepr.app`), menggantikan nama kerja "DiskLens" | Dipilih pemilik setelah M0; ringkas dan menonjolkan fungsi pembersih | Diterima |
| D-011 | Traversal pakai `jwalk` (rayon) + `sysinfo` (fitur `disk`) untuk daftar drive | Urutan hasil depth-first memungkinkan parent dilacak dengan stack, tanpa map path→id; scan `C:\` ±1 juta node dalam 13–32 dtk, ±189 MB | Diterima (M1) |
| D-012 | Semua query hasil scan menyertakan `scan_id`; error dikirim sebagai `{ code, message }` | ID node dari scan lama ditolak, tidak salah baca tree baru; `code` stabil untuk teks UI terjemahan | Diterima (M1) |
| D-013 | Symlink/junction di dalam tree tidak ditampilkan; root berupa link ditolak | Aturan keras #4; menghindari hitung ganda dan loop | Diterima (M1) |
| D-014 | Pilih folder pakai plugin resmi `tauri-plugin-dialog` + `@tauri-apps/plugin-dialog`, izin hanya `dialog:allow-open` | Dialog folder bawaan OS; lokal, tanpa jaringan; izin sesempit mungkin | Diterima (M2) |
| D-015 | "Buka di Explorer" via `explorer.exe /select,"<path>"` di `platform/windows.rs` (macOS: `open -R`), tanpa dependency. Command menerima `scan_id` + `node_id`, path dihitung backend | Tidak perlu `tauri-plugin-opener`; UI tak pernah mengirim path (aturan keras #2) | Diterima (M2) |
| D-016 | Virtual list ditulis sendiri (`components/VirtualList.tsx`, tinggi baris tetap) + `get_children` dimuat per halaman 500 baris | Tanpa dependency; cukup untuk tabel dengan tinggi baris tetap. `@tanstack/react-virtual` jadi cadangan bila perlu | Diterima (M2) |
| D-017 | Kategori file: `category_extensions` dibaca dari `config/cleaner-rules.<os>.json` yang disematkan saat kompilasi (`include_str!`); kategori disimpan 1 byte per node saat scan; ekstensi ganda antar kategori ditolak | Sederhana untuk M2; `Node` tetap 72 byte (dijaga tes). Loader rule lengkap + file config di luar binary menyusul di M3 | Diterima (M2) |
| D-003 | Semua rule hanya memindahkan ke Recycle Bin. Satu-satunya hapus permanen: tombol "Kosongkan Recycle Bin" dengan konfirmasi terpisah | Sesuai SAFETY_RULES; opsi "temp boleh permanen" ditolak karena bertentangan dengannya | Diterima (M3) |
| D-018 | Dependency M3: `trash` (pindah ke Recycle Bin), `dirs` (lokasi asli Downloads/Documents/…, termasuk yang dipindah ke OneDrive), `windows-sys` 0.61 fitur `Win32_Foundation`, `Win32_Storage_FileSystem`, `Win32_System_Registry`, `Win32_UI_Shell` (ukuran/kosongkan Recycle Bin, pengaturan Recycle Bin per drive) | `windows-sys` sudah ada di dependency tree Tauri; tanpa `chrono` (waktu log = unix ms) | Diterima (M3) |
| D-019 | Sebelum memindahkan, cek Recycle Bin drive itu di registry (`BitBucket\Volume\{GUID}`): tolak item jika `NukeOnDelete=1`, pengaturan tak terbaca, atau ukuran item > 90% `MaxCapacity` | Mencegah Windows diam-diam menghapus permanen item yang tidak muat di Recycle Bin. `trash` memakai `FOF_WANTNUKEWARNING`, tapi perilakunya tanpa UI tidak terdokumentasi | Diterima (M3) |
| D-020 | Config rule tetap disematkan saat kompilasi (menyesuaikan D-006/D-017) | Rule yang menggerakkan penghapusan tidak bisa diubah dari luar app. Ubah rule = build ulang | Diterima (M3) |
| D-021 | `node_modules` dicari dengan menelusuri `%USERPROFILE%` sendiri (bukan dari hasil scan); folder hidden/berawalan titik dan folder terlindungi tidak ditelusuri. "Tidak diubah > N hari" = `package.json` **dan** folder project sama-sama lebih tua dari N hari | Tidak bergantung pada scan terakhir; di mesin pemilik < 10 ms | Diterima (M3) |
| D-022 | Folder kandidat (mis. `node_modules`) yang berisi symlink/junction di dalamnya dikecualikan dari preview (hanya dihitung) | Konservatif: belum diverifikasi bagaimana shell memperlakukan link di dalam folder yang dibuang/dikosongkan. Akibatnya project pnpm tidak ikut dibersihkan | Diterima (M3), tinjau ulang |
| D-023 | Pembersih = layar tersendiri (tombol di Beranda dan di header hasil scan), bukan tab hasil scan | Rule tidak butuh hasil scan | Diterima (M3) |
| D-024 | Root rule boleh memakai `%DOWNLOADS%`, `%DOCUMENTS%`, `%DESKTOP%`, `%HOME%` (folder asli via `dirs`) selain variabel lingkungan; rule "installer lama" memakai `%DOWNLOADS%` | Downloads yang dipindah ke drive lain tetap benar | Diterima (M3) |

## Pertanyaan terbuka
- **`node_modules` di Desktop/Documents** (M3): folder itu terlindungi (SAFETY_RULES: isinya hanya boleh disentuh rule yang menyebutnya eksplisit), jadi project di sana tidak ditemukan. Di PC pemilik, project ada di `Desktop\Work\…` sehingga rule ini menemukan 0 item. Opsi: tambahkan `%DESKTOP%` / `%DOCUMENTS%` ke `allowed_roots` rule `stale-node-modules` (keputusan pemilik).
- **Ketersediaan nama "Sweepr"** (D-010): cek merek dagang, domain, crates.io/npm sebelum rilis publik.
- **Ukuran yang ditampilkan:** M1 memakai logical size (`len`). Size on disk (cluster slack, kompresi, file cloud OneDrive) dan hardlink yang terhitung ganda belum ditangani — putuskan apakah perlu sebelum rilis.
- **Perlu izin admin opsional** untuk scan folder yang terkunci? (MVP: lewati saja.)
- **Lisensi jika open source** (MIT / Apache-2.0 / GPL)?
- **Bahasa UI:** Indonesia saja di MVP, Inggris menyusul?

## Pertanyaan terbuka untuk M2
Sudah diputuskan di awal M2: lihat D-014 s/d D-017.
