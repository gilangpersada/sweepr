# DECISIONS

## Keputusan (ADR ringkas)
| ID | Keputusan | Alasan | Status |
|---|---|---|---|
| D-001 | Stack: Tauri 2 + React + TS | Scan cepat & ringan, cross-platform, UI berbasis web yang familier | Diterima |
| D-002 | Windows dulu, siap macOS | Pengguna awal di Windows; struktur `platform/` + rule per OS | Diterima |
| D-004 | Scan mode biasa dulu (tanpa admin) | Lebih sederhana & aman; MFT ke roadmap | Diterima |
| D-005 | Pohon in-memory berbasis arena, children dimuat lazy | Hemat memori, UI tidak menerima data raksasa | Diterima |
| D-006 | Rule pembersih berupa JSON per OS | Mudah menambah/ubah tanpa kompilasi ulang | Diterima |

## Pertanyaan terbuka (bahas sebelum/selama M3)
- **D-003 — Recycle Bin vs hapus permanen.** Memindahkan ke Recycle Bin tidak membebaskan ruang sampai dikosongkan. Usulan: default ke Recycle Bin + tombol "Kosongkan Recycle Bin" terpisah. Opsi lain: khusus kategori Risiko Rendah (temp) boleh hapus permanen dengan konfirmasi. **Belum diputuskan.**
- **Nama aplikasi final?** "DiskLens" hanya nama kerja. Cek ketersediaan nama/domain sebelum rilis publik.
- **Ukuran yang ditampilkan:** logical size (MVP) atau juga size on disk?
- **Perlu izin admin opsional** untuk scan folder yang terkunci? (MVP: lewati saja.)
- **Lisensi jika open source** (MIT / Apache-2.0 / GPL)?
- **Bahasa UI:** Indonesia saja di MVP, Inggris menyusul?
- **Styling frontend:** CSS biasa atau Tailwind? (Tanyakan di M0.)
