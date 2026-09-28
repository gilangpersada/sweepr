# TASKS — MVP

Kerjakan **satu milestone per sesi**. Centang tugas setelah selesai dan kriteria terpenuhi.

## M0 — Setup proyek
- [ ] Inisialisasi Tauri 2 + React + TypeScript + Vite (nama app: DiskLens)
- [ ] Susun struktur folder sesuai `CLAUDE.md`
- [ ] Atur lint/format: clippy, rustfmt, eslint, prettier, script `typecheck`
- [ ] Halaman kosong dengan judul, jalan di `npm run tauri dev`
- [ ] Satu command contoh (`ping`) + wrapper `api.ts` untuk membuktikan alur invoke
**Selesai jika:** app terbuka di Windows, tombol memanggil Rust dan menampilkan jawabannya, lint bersih.

## M1 — Inti scanner (tanpa UI rumit)
- [ ] `list_drives` (nama, total, terpakai, sisa)
- [ ] Model tree berbasis arena + agregasi ukuran
- [ ] Traversal paralel, tidak mengikuti symlink/junction
- [ ] Progress via event (throttled), pembatalan, error akses dicatat
- [ ] `get_children` (sort, limit, offset), `get_largest_files`
- [ ] Unit test: agregasi ukuran, cancel, folder tak terbaca, symlink
**Selesai jika:** scan folder uji (dibuat di test) menghasilkan ukuran benar; scan folder besar nyata tidak membuat UI beku; waktu scan & memori dicatat di catatan.

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
