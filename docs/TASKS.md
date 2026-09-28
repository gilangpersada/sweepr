# TASKS — MVP

Kerjakan **satu milestone per sesi**. Centang tugas setelah selesai dan kriteria terpenuhi.

## M0 — Setup proyek
- [x] Inisialisasi Tauri 2 + React + TypeScript + Vite (nama app: Sweepr)
- [x] Susun struktur folder sesuai `CLAUDE.md`
- [x] Atur lint/format: clippy, rustfmt, eslint, prettier, script `typecheck`
- [x] Halaman kosong dengan judul, jalan di `npm run tauri dev`
- [x] Satu command contoh (`ping`) + wrapper `api.ts` untuk membuktikan alur invoke
**Selesai jika:** app terbuka di Windows, tombol memanggil Rust dan menampilkan jawabannya, lint bersih.

## M1 — Inti scanner (tanpa UI rumit)
- [x] `list_drives` (nama, total, terpakai, sisa)
- [x] Model tree berbasis arena + agregasi ukuran
- [x] Traversal paralel, tidak mengikuti symlink/junction
- [x] Progress via event (throttled), pembatalan, error akses dicatat
- [x] `get_children` (sort, limit, offset), `get_largest_files`
- [x] Unit test: agregasi ukuran, cancel, folder tak terbaca, symlink
**Selesai jika:** scan folder uji (dibuat di test) menghasilkan ukuran benar; scan folder besar nyata tidak membuat UI beku; waktu scan & memori dicatat di catatan.

**Catatan M1 (2026-09-29)** — build release, `cargo run --release --example scan_bench -- C:\`, Windows 11, 20 core logis:
| Scan | Waktu | Node | File | Total | Dilewati | Memori puncak |
|---|---|---|---|---|---|---|
| `C:\` pertama (cache dingin) | 32,3 dtk | 1.076.247 | 960.815 | 718,3 GiB | 606 | ±189 MB (working set, sampel 200 ms) |
| `C:\` ulang (cache hangat) | 13,1 dtk | sama | sama | sama | sama | — |

- Windows melaporkan 744,8 GiB terpakai. Selisih ±26 GiB = folder sistem yang ditolak aksesnya, metadata NTFS, dan ukuran logis vs ukuran terpakai di disk (cluster slack, kompresi).
- Hardlink (mis. `WinSxS`) terhitung lebih dari sekali; file cloud OneDrive dihitung ukuran logisnya walau belum diunduh.
- Test symlink asli dilewati bila Developer Mode Windows mati; test junction selalu jalan.
- UI beku atau tidak: dicek manual lewat `npm run tauri dev` (layar uji sementara `views/ScanDebug.tsx`).

## M2 — UI hasil scan
- [ ] Beranda: kartu drive + tombol pilih folder
- [ ] Banner progress + tombol batal
- [ ] Tabel folder (urut, persen, jumlah file, tanggal) + breadcrumb + masuk/naik folder
- [ ] Ringkasan kategori (ekstensi dari config)
- [ ] Tab "File Terbesar"
- [ ] Aksi: buka di Explorer, salin path
- [ ] Virtual list bila baris banyak
**Selesai jika:** pengguna bisa scan drive lalu menelusuri sampai file terbesar tanpa hang.

## M3 — Pembersih aman
- [ ] `safety.rs` lengkap dengan denylist + tes (lihat SAFETY_RULES)
- [ ] Loader rule JSON + validasi skema
- [ ] Rule: temp pengguna, installer lama Downloads, node_modules lama
- [ ] `preview_cleanup` + layar preview dengan centang per item
- [ ] Dialog konfirmasi (jumlah item + total ukuran)
- [ ] `execute_cleanup` ke Recycle Bin, hasil + alasan gagal, log JSON lines
- [ ] Tombol "Kosongkan Recycle Bin" dengan konfirmasi terpisah + penjelasan
**Selesai jika:** semua tes safety lulus; uji manual di folder dummy: item terhapus masuk Recycle Bin dan bisa dipulihkan; path terlarang tidak pernah muncul di preview.

## M4 — Poles & rilis pribadi
- [ ] Tema terang/gelap ikut sistem
- [ ] Teks UI dipusatkan (i18n sederhana, Bahasa Indonesia)
- [ ] Pesan error yang ramah, state kosong, state loading
- [ ] Ikon & nama final app
- [ ] `npm run tauri build` menghasilkan installer Windows
- [ ] Catatan hasil pemakaian 2 minggu → masukkan ke `DECISIONS.md`
**Selesai jika:** semua checklist "Definition of Done — MVP" di `PRD.md` tercentang.
