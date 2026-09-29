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
- Cek manual `npm run tauri dev` (2026-09-29, pemilik): scan `C:\` tidak membuat UI beku, Batal berfungsi, hasil tampil. Layar uji sementara `views/ScanDebug.tsx` diganti UI sungguhan di M2.
- Jika `tauri dev` gagal dengan path lama `...\disklens\...`: cache build sisa rename, jalankan `cargo clean --manifest-path src-tauri/Cargo.toml --profile dev`.

## M2 — UI hasil scan
- [x] Beranda: kartu drive + tombol pilih folder
- [x] Banner progress + tombol batal
- [x] Tabel folder (urut, persen, jumlah file, tanggal) + breadcrumb + masuk/naik folder
- [x] Ringkasan kategori (ekstensi dari config)
- [x] Tab "File Terbesar"
- [x] Aksi: buka di Explorer, salin path
- [x] Virtual list bila baris banyak
**Selesai jika:** pengguna bisa scan drive lalu menelusuri sampai file terbesar tanpa hang.

**Catatan M2 (2026-09-29)** — keputusan D-014 s/d D-017 (dialog plugin, `explorer.exe /select`, virtual list sendiri, kategori dari config).
- Otomatis: `cargo test` (33 tes, termasuk ringkasan kategori, validasi config kategori, ukuran `Node` ≤ 72 byte), `clippy -D warnings`, `typecheck`, `lint`, `prettier --check`, `npm run build` — semua bersih.
- Command baru: `get_category_summary`, `get_node_path`, `reveal_in_explorer` (menerima `node_id`, bukan path).
- Tabel folder memakai virtual list untuk semua ukuran (bukan hanya > 500 baris): lebih sederhana, satu jalur kode.
- Tab "File Terbesar" menampilkan 1000 file terbesar di seluruh hasil scan (bukan per folder).
- Cek manual `npm run tauri dev` (2026-09-29, pemilik): hasil sementara oke (scan, telusuri folder, file terbesar). Rincian per poin daftar cek belum dicatat; tambahkan di sini bila ada temuan.

## M3 — Pembersih aman
- [x] `safety.rs` lengkap dengan denylist + tes (lihat SAFETY_RULES)
- [x] Loader rule JSON + validasi skema
- [x] Rule: temp pengguna, installer lama Downloads, node_modules lama
- [x] `preview_cleanup` + layar preview dengan centang per item
- [x] Dialog konfirmasi (jumlah item + total ukuran)
- [x] `execute_cleanup` ke Recycle Bin, hasil + alasan gagal, log JSON lines
- [x] Tombol "Kosongkan Recycle Bin" dengan konfirmasi terpisah + penjelasan
**Selesai jika:** semua tes safety lulus; uji manual di folder dummy: item terhapus masuk Recycle Bin dan bisa dipulihkan; path terlarang tidak pernah muncul di preview.

**Catatan M3 (2026-09-29)** — keputusan D-003, D-018 s/d D-024.
- Otomatis: `cargo test` 70 tes lulus (safety 12, cleaner 23 = rules + matcher + preview/execute, platform 4, scanner 28, lainnya 3), `clippy -D warnings`, `typecheck`, `lint`, `prettier`, `npm run build` bersih. Semua "Tes wajib" SAFETY_RULES tercakup: `..`/relatif, symlink/junction (termasuk item yang diganti junction setelah preview), denylist + turunannya, di luar allowed roots, batas 10.000 item, preview kedaluwarsa/berubah.
- Recycle Bin asli (`cargo test --lib real_ -- --ignored`, 2026-09-29, lulus):
  - `real_cleanup_round_trip_in_dummy_folder`: folder dummy → preview → execute dengan denylist, Recycle Bin, dan cek kapasitas asli → item ada di Recycle Bin → dipulihkan ke lokasi asli dengan ukuran sama. Kriteria "masuk Recycle Bin dan bisa dipulihkan" terbukti otomatis.
  - `real_recycle_bin_round_trip`: file masuk Recycle Bin dengan lokasi asli yang benar. Kedua tes membersihkan entri ujinya sendiri.
  - Cek kapasitas memberi hasil sama untuk path verbatim dan biasa (dijaga tes `recycle_bin_limit_is_the_same_for_verbatim_paths`).
- Temuan saat tes: pada path verbatim (bentuk `\\?\C:\...` hasil `canonicalize`), `PathBuf::join("..")` langsung membuang komponen sebelumnya, jadi `..` tidak pernah terlihat; pemeriksaan kini juga menolak komponen bernama `..`/`.` sebagai pertahanan tambahan. Daftar Recycle Bin menyembunyikan ekstensi hanya untuk tipe file terdaftar (`.txt` ya, `.tmp` tidak).
- Preview nyata di PC pemilik (hanya baca): temp 422 item / 247 MB (53 ms), installer lama 28 item / 7,5 GB (2 ms), `node_modules` lama 0 item — project ada di Desktop yang terlindungi (lihat pertanyaan terbuka di DECISIONS).
- Recycle Bin `C:` di PC pemilik: MaxCapacity ±48,6 GB, NukeOnDelete 0.
- **Lanjutan M3 — grup "Cache Developer" (D-025):** rule punya field `group`; `node_modules project lama` kini juga mencari di Desktop dan Documents (disebut eksplisit), root bersarang tidak ditelusuri dua kali. `cargo test` 72 lulus. Preview nyata: penelusuran user folder + Desktop + Documents 468 ms; 0 item karena 2 project lama memakai pnpm dengan ±1.000 junction ke lokasi lama (dikecualikan, D-022); `node_modules` extension VS Code (`.vscode`) tidak disentuh.
- **Cek manual `npm run tauri dev` di folder dummy belum dilakukan** — lihat daftar cek di ringkasan PR M3; isi hasilnya di sini.

## M4 — Poles & rilis pribadi
- [ ] Tema terang/gelap ikut sistem
- [ ] Teks UI dipusatkan (i18n sederhana, Bahasa Indonesia)
- [ ] Pesan error yang ramah, state kosong, state loading
- [ ] Ikon & nama final app
- [ ] `npm run tauri build` menghasilkan installer Windows
- [ ] Catatan hasil pemakaian 2 minggu → masukkan ke `DECISIONS.md`
**Selesai jika:** semua checklist "Definition of Done — MVP" di `PRD.md` tercentang.
