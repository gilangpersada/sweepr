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
- Cek manual `npm run tauri dev` (2026-09-29, pemilik), folder dummy `Desktop\sweepr-dummy-project` (package.json + node_modules, tanggal dimundurkan 90 hari):
  - Layar Pembersih tampil dengan bagian "Umum" dan "Cache Developer"; "node_modules project lama" tidak tercentang otomatis.
  - `node_modules` dummy dipindah → ada di Recycle Bin dengan Original Location benar; `package.json` utuh; `cleanup.jsonl` mencatat 1 baris `"ok":true` (3.002 byte).
  - Restore dari Recycle Bin berhasil, folder kembali ke project.
  - Setelah Restore, project tidak muncul lagi di preview: Restore mengubah tanggal folder project, jadi project dianggap aktif (perilaku yang diharapkan, D-021).
  - Hanya rule node_modules yang diuji lewat UI; file temp/installer dummy tidak dipindah (jalur yang sama sudah dicakup tes otomatis `real_cleanup_round_trip_in_dummy_folder`).

## M4 — Poles & rilis pribadi
- [x] Tema terang/gelap ikut sistem
- [x] Teks UI dipusatkan (i18n sederhana) — Bahasa Indonesia + Inggris (D-026)
- [x] Pesan error yang ramah, state kosong, state loading
- [x] Ikon & nama final app
- [x] `npm run tauri build` menghasilkan installer Windows — `Sweepr_0.1.0_x64-setup.exe` 1,59 MB (NSIS; sejak D-030 per mesin ke Program Files)
- [ ] Catatan hasil pemakaian 2 minggu → masukkan ke `DECISIONS.md`
**Selesai jika:** semua checklist "Definition of Done — MVP" di `PRD.md` tercentang.

**Masukan dari uji manual M3** (dikerjakan di M4):
- [x] Daftar detail rule diurutkan dari yang terbesar; file kecil tertentu sulit ditemukan di antara ratusan item. Usulan: kolom cari/filter di daftar detail.
- [x] Rule node_modules menampilkan tanggal folder `node_modules`, padahal yang dinilai adalah tanggal `package.json` dan folder project. Usulan: tampilkan "project terakhir diubah".

**Catatan M4 (2026-09-29)** — keputusan D-026 s/d D-029.
- Tambahan di luar checklist: FR-2 lengkap (daftar item yang tidak bisa dibaca, command `get_skipped` + dialog "Lihat daftar"); kolom cari di daftar detail Pembersih; tanggal "project terakhir diubah" untuk rule node_modules.
- i18n: kamus `id.ts`/`en.ts` bertipe; bahasa awal ikut Windows, pilihan di Beranda. Tidak ada teks UI yang tertanam di komponen (dicek dengan grep).
- Ikon: rubah menyapu dari pemilik, glow dibuang (`source-clean.png`), dibuat dengan `npm run tauri icon`.
- Otomatis: `cargo test` 72 lulus, clippy, typecheck, lint, prettier bersih.
- Build: `npm run tauri build` sukses; satu peringatan: identifier `com.sweepr.app` berakhiran `.app` (bentrok dengan bundle macOS, tidak berpengaruh di Windows — keputusan pemilik, D-010); installer 1,59 MB (target PRD < 30 MB), `sweepr.exe` 4,8 MB.
- Uji install/uninstall (2026-09-29, pemilik): installer per mesin ke `C:\Program Files\Sweepr` (D-030, ikon installer rubah) — dilaporkan aman. Percobaan pertama gagal menulis ke `Program Files (x86)` karena folder tujuan diganti saat installer masih mode per pengguna; itu yang memicu D-030.
- **Belum:** catatan pemakaian 2 minggu (template di `DECISIONS.md`).

## M5 — Redesign UI: menu, Neo-Brutalism, animasi (setelah MVP)
Tujuan: UI lebih rapi, tiap fitur punya menu sendiri, gaya visual Neo-Brutalism, animasi dengan `motion`, dan loading screen beranimasi. Tidak mengubah backend, perilaku scan, atau aturan keamanan pembersih. Boleh dikerjakan selama masa pemakaian 2 minggu M4; catatan pemakaian tetap diisi. Keputusan: D-031 s/d D-036 (lihat juga "Pertanyaan terbuka untuk M5" di `DECISIONS.md`).

**Persiapan**
- [x] Jawab pertanyaan terbuka M5 di `DECISIONS.md` (font, palet warna, toggle tema, lebar sidebar) — dijawab 2026-09-29: D-031, D-033 s/d D-035 (D-035 diganti D-036)
- [ ] Tambah dependency `motion` (D-032); pakai `LazyMotion` + `m` supaya bundle kecil
- [ ] Design token Neo-Brutalism di `src/index.css` (`@theme` Tailwind v4): warna, border tebal, bayangan keras, radius, font; versi terang dan gelap (D-031)
- [x] Font lokal Space Grotesk + JetBrains Mono (`.woff2` + lisensi OFL di `src/assets/fonts/`, D-031); tanpa jaringan (CSP D-009) — variable font latin + latin-ext dari Fontsource 5.3.0 (±97 KB total), sumber dan `unicode-range` di `src/assets/fonts/README.md`
- [ ] Komponen dasar di `src/components/ui/`: `Button` (primary/secondary/danger), `Card`, `Badge`, `Tabs`, `Checkbox`, `Input`, `ProgressBar`, `Dialog`; komponen lama beralih memakainya

**Menu & pemisahan fitur**
- [ ] `AppShell`: sidebar menu di kiri + area konten; sidebar selalu lebar, ikon + teks (D-033)
- [ ] Menu (D-033): **Beranda** (drive + pilih folder), **Hasil Scan** (aktif setelah scan; tab Folder / File Terbesar / Kategori), **Pembersih**, **Recycle Bin** (dipisah dari layar Pembersih), **Pengaturan** (bahasa, tema, info versi)
- [ ] Pindah menu tidak menghapus hasil scan atau posisi folder; progress scan yang sedang jalan terlihat dari menu mana pun (indikator di sidebar)
- [ ] Pilihan bahasa pindah dari Beranda ke Pengaturan
- [ ] Navigasi keyboard: menu bisa dipakai dengan Tab/Enter, fokus selalu terlihat

**Tema Neo-Brutalism**
- [ ] Terapkan ke semua layar: Beranda, Hasil Scan (tabel, breadcrumb, kategori, file terbesar), Pembersih, Recycle Bin, Pengaturan, semua dialog, state kosong/error/loading
- [ ] Pilihan tema di Pengaturan: Ikut sistem (bawaan) / Terang / Gelap, diingat antar sesi; `dark:` Tailwind memakai atribut `data-theme` (D-034)
- [ ] Tema dipasang sebelum render pertama (skrip kecil di file terpisah, bukan inline) supaya tidak berkedip, termasuk splash; title bar jendela ikut tema
- [ ] Kontras teks minimal WCAG AA di kedua tema
- [ ] Aksi berbahaya (Pindahkan ke Recycle Bin, Kosongkan Recycle Bin) tetap paling jelas dibedakan (warna danger + ikon + teks), sesuai SAFETY_RULES

**Animasi (`motion`)**
- [ ] `MotionConfig reducedMotion="user"`: bila Windows mengatur "Animation effects" mati, animasi gerak dimatikan
- [ ] Transisi antar menu/halaman (fade + geser pendek, ≤ 250 ms)
- [ ] Umpan balik tombol dan kartu: hover/tekan menggeser bayangan keras
- [ ] Dialog muncul/hilang; kartu drive dan kartu rule muncul bertahap (stagger)
- [ ] Progress scan dan bar pemakaian drive beranimasi halus; total ukuran hasil scan/pembersihan naik bertahap (count-up)
- [ ] **Tidak** menganimasikan baris `VirtualList` satu per satu (kinerja tabel ±1 juta node); target PRD "tidak freeze > 200 ms" tetap berlaku
- [ ] Animasi tidak pernah menunda atau menyembunyikan isi dialog konfirmasi hapus (tombol langsung bisa dibaca dan dipakai)

**Loading screen**
- [ ] Splash statis di `index.html` (CSS inline, tampil sebelum JavaScript dimuat): wordmark "SWEEPR" dalam ubin, tanpa gerak, supaya tidak ada layar kosong/putih
- [ ] Tanpa logo (D-036): wordmark "SWEEPR" per huruf dalam ubin berborder tebal + bayangan keras
- [ ] React mengambil alih dengan animasi: ubin huruf jatuh satu per satu (stagger); di bawahnya balok kuning menyapu "debu" (kotak/bulatan kecil) dari kiri ke kanan berulang sebagai indikator muat
- [ ] Splash hilang (animasi keluar) setelah data awal siap (`list_drives`); tampil minimal ±600 ms supaya tidak berkedip, tanpa jeda buatan lain
- [ ] Bila data awal gagal: splash berganti ke `ErrorState` dengan "Coba lagi", bukan macet
- [ ] Dengan reduced motion: wordmark statis, hanya fade

**Penutup**
- [ ] Semua teks baru lewat i18n (`id.ts` + `en.ts`); tidak ada teks tertanam (cek grep seperti M4)
- [ ] Perbarui wireframe di `PRD.md` §9 dan bagian Frontend di `ARCHITECTURE.md`
- [ ] `npm run tauri build` sukses; catat ukuran installer dan bundle JS (sebelum/sesudah `motion`)

**Selesai jika:** semua fitur bisa dibuka dari menu tanpa kehilangan hasil scan; semua layar memakai gaya Neo-Brutalism di tema terang dan gelap; animasi berjalan dan mati saat reduced motion aktif; loading screen tampil saat app dibuka; `typecheck`, `lint`, `prettier`, `cargo test`, `clippy` bersih; cek manual di Windows dicatat di sini.
