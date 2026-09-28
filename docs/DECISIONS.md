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

## Pertanyaan terbuka (bahas sebelum/selama M3)
- **D-003 — Recycle Bin vs hapus permanen.** Memindahkan ke Recycle Bin tidak membebaskan ruang sampai dikosongkan. Usulan: default ke Recycle Bin + tombol "Kosongkan Recycle Bin" terpisah. Opsi lain: khusus kategori Risiko Rendah (temp) boleh hapus permanen dengan konfirmasi. **Belum diputuskan.**
- **Ketersediaan nama "Sweepr"** (D-010): cek merek dagang, domain, crates.io/npm sebelum rilis publik.
- **Ukuran yang ditampilkan:** M1 memakai logical size (`len`). Size on disk (cluster slack, kompresi, file cloud OneDrive) dan hardlink yang terhitung ganda belum ditangani — putuskan apakah perlu sebelum rilis.
- **Perlu izin admin opsional** untuk scan folder yang terkunci? (MVP: lewati saja.)
- **Lisensi jika open source** (MIT / Apache-2.0 / GPL)?
- **Bahasa UI:** Indonesia saja di MVP, Inggris menyusul?

## Pertanyaan terbuka untuk M2 (putuskan di awal M2)
- **Tombol "pilih folder"** butuh dependency baru: plugin resmi `@tauri-apps/plugin-dialog` (Rust + npm). Perlu persetujuan pemilik.
- **"Buka di Explorer"**: plugin resmi `tauri-plugin-opener`, atau panggil `explorer.exe /select,<path>` sendiri di `platform/windows.rs` (tanpa dependency). Usulan: opsi kedua.
- **Virtual list**: tulis sendiri (tanpa dependency) atau `@tanstack/react-virtual`. Usulan: tulis sendiri dulu.
