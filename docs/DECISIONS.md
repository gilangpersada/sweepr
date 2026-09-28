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

## Pertanyaan terbuka (bahas sebelum/selama M3)
- **D-003 — Recycle Bin vs hapus permanen.** Memindahkan ke Recycle Bin tidak membebaskan ruang sampai dikosongkan. Usulan: default ke Recycle Bin + tombol "Kosongkan Recycle Bin" terpisah. Opsi lain: khusus kategori Risiko Rendah (temp) boleh hapus permanen dengan konfirmasi. **Belum diputuskan.**
- **Ketersediaan nama "Sweepr"** (D-010): cek merek dagang, domain, crates.io/npm sebelum rilis publik.
- **Ukuran yang ditampilkan:** logical size (MVP) atau juga size on disk?
- **Perlu izin admin opsional** untuk scan folder yang terkunci? (MVP: lewati saja.)
- **Lisensi jika open source** (MIT / Apache-2.0 / GPL)?
- **Bahasa UI:** Indonesia saja di MVP, Inggris menyusul?
