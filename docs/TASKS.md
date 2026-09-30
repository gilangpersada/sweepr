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
- [x] Tambah dependency `motion` (D-032); pakai `LazyMotion` + `m` supaya bundle kecil
- [x] Design token Neo-Brutalism di `src/index.css` (`@theme` Tailwind v4): warna, border tebal, bayangan keras, radius, font; versi terang dan gelap (D-031)
- [x] Font lokal Space Grotesk + JetBrains Mono (`.woff2` + lisensi OFL di `src/assets/fonts/`, D-031); tanpa jaringan (CSP D-009) — variable font latin + latin-ext dari Fontsource 5.3.0 (±97 KB total), sumber dan `unicode-range` di `src/assets/fonts/README.md`
- [x] Komponen dasar di `src/components/ui/`: `Button` (primary/secondary/danger), `Card`, `Badge`, `Tabs`, `Checkbox`, `Input`, `ProgressBar`, `Dialog`; komponen lama beralih memakainya

**Menu & pemisahan fitur**
- [x] `AppShell`: sidebar menu di kiri + area konten; sidebar selalu lebar, ikon + teks (D-033)
- [x] Menu (D-033): **Beranda** (drive + pilih folder), **Hasil Scan** (aktif setelah scan; tab Folder / File Terbesar / Kategori), **Pembersih**, **Recycle Bin** (dipisah dari layar Pembersih), **Pengaturan** (bahasa, tema, info versi)
- [x] Pindah menu tidak menghapus hasil scan atau posisi folder; progress scan yang sedang jalan terlihat dari menu mana pun (indikator di sidebar)
- [x] Pilihan bahasa pindah dari Beranda ke Pengaturan
- [x] Navigasi keyboard: menu bisa dipakai dengan Tab/Enter, fokus selalu terlihat

**Tema Neo-Brutalism**
- [x] Terapkan ke semua layar: Beranda, Hasil Scan (tabel, breadcrumb, kategori, file terbesar), Pembersih, Recycle Bin, Pengaturan, semua dialog, state kosong/error/loading
- [x] Pilihan tema di Pengaturan: Ikut sistem (bawaan) / Terang / Gelap, diingat antar sesi; `dark:` Tailwind memakai atribut `data-theme` (D-034)
- [x] Tema dipasang sebelum render pertama (skrip kecil di file terpisah, bukan inline) supaya tidak berkedip, termasuk splash; title bar jendela ikut tema
- [x] Kontras teks minimal WCAG AA di kedua tema
- [x] Aksi berbahaya (Pindahkan ke Recycle Bin, Kosongkan Recycle Bin) tetap paling jelas dibedakan (warna danger + ikon + teks), sesuai SAFETY_RULES

**Animasi (`motion`)**
- [x] `MotionConfig reducedMotion="user"`: bila Windows mengatur "Animation effects" mati, animasi gerak dimatikan
- [x] Transisi antar menu/halaman (fade + geser pendek, ≤ 250 ms)
- [x] Umpan balik tombol dan kartu: hover/tekan menggeser bayangan keras
- [x] Dialog muncul/hilang; kartu drive dan kartu rule muncul bertahap (stagger)
- [x] Progress scan dan bar pemakaian drive beranimasi halus; total ukuran hasil scan/pembersihan naik bertahap (count-up)
- [x] **Tidak** menganimasikan baris `VirtualList` satu per satu (kinerja tabel ±1 juta node); target PRD "tidak freeze > 200 ms" tetap berlaku
- [x] Animasi tidak pernah menunda atau menyembunyikan isi dialog konfirmasi hapus (tombol langsung bisa dibaca dan dipakai)

**Loading screen**
- [x] Splash statis di `index.html` (CSS inline, tampil sebelum JavaScript dimuat): wordmark "SWEEPR" dalam ubin, tanpa gerak, supaya tidak ada layar kosong/putih
- [x] Tanpa logo (D-036): wordmark "SWEEPR" per huruf dalam ubin berborder tebal + bayangan keras
- [x] React mengambil alih dengan animasi: ubin huruf jatuh satu per satu (stagger); di bawahnya balok kuning menyapu "debu" (kotak/bulatan kecil) dari kiri ke kanan berulang sebagai indikator muat
- [x] Splash hilang (animasi keluar) setelah data awal siap (`list_drives`); tampil minimal ±600 ms supaya tidak berkedip, tanpa jeda buatan lain
- [x] Bila data awal gagal: splash berganti ke `ErrorState` dengan "Coba lagi", bukan macet
- [x] Dengan reduced motion: wordmark statis, hanya fade

**Penutup**
- [x] Semua teks baru lewat i18n (`id.ts` + `en.ts`); tidak ada teks tertanam (cek grep seperti M4)
- [x] Perbarui wireframe di `PRD.md` §9 dan bagian Frontend di `ARCHITECTURE.md`
- [x] `npm run tauri build` sukses; catat ukuran installer dan bundle JS (sebelum/sesudah `motion`)

**Selesai jika:** semua fitur bisa dibuka dari menu tanpa kehilangan hasil scan; semua layar memakai gaya Neo-Brutalism di tema terang dan gelap; animasi berjalan dan mati saat reduced motion aktif; loading screen tampil saat app dibuka; `typecheck`, `lint`, `prettier`, `cargo test`, `clippy` bersih; cek manual di Windows dicatat di sini.

**Catatan M5 (2026-09-30)** — keputusan D-031 s/d D-037 (detail implementasi, palet final, kontras, ukuran: D-037).
- Otomatis: `typecheck`, `lint`, `prettier --check`, `cargo test` (72 lulus), `clippy -D warnings`, `npm run build` — bersih. Backend tidak diubah; satu izin baru `core:window:allow-set-theme` (title bar ikut tema).
- Bundle JS 274,3 → 387,3 KB (gzip 84,1 → 120,7 KB) setelah `motion`; CSS 26,9 → 28,7 KB; font ±97 KB. Installer `Sweepr_0.1.0_x64-setup.exe` 1,59 → 1,76 MiB, `sweepr.exe` 4,8 → 4,9 MB.
- Kontras WCAG AA dihitung dari token (bukan diukur di layar): terendah 5,73:1 (terang), 6,13:1 (gelap).
- Teks baru lewat i18n; grep teks tertanam hanya menemukan nama merek "Sweepr"/"SWEEPR" (wordmark, sengaja tidak diterjemahkan).
- Perilaku: scan selesai membuka Hasil Scan hanya bila pengguna masih di Beranda; di menu lain tidak ditarik pindah.
- Cek manual sebagian (2026-09-30, pemilik): scan drive berjalan di `npm run tauri dev`. Sempat terlihat macet di "Memulai…" pada sesi dev lama yang sudah menerima banyak hot-reload; hilang setelah `tauri dev` dijalankan ulang (build release dan dev baru sudah dicek: progress normal, pindah ke Hasil Scan setelah selesai). **Koreksi (M6):** penyebabnya bukan hot-reload, melainkan deadlock acak di scanner; lihat catatan M6.
- **Belum:** sisa cek manual di Windows (pemilik). Daftar cek: splash (terang/gelap, ubin jatuh, balok menyapu, hilang setelah drive siap); pindah menu tidak menghilangkan posisi folder/tab/pilihan pembersih; indikator scan di sidebar + Batalkan scan; tema Ikut sistem/Terang/Gelap diingat setelah restart, title bar ikut; bahasa di Pengaturan; Windows "Animation effects" mati → hanya fade, bar/debu diam; dialog konfirmasi langsung bisa dibaca dan fokus awal di Batal; jendela 800 px (kolom "File" hilang, tabel tetap terbaca); Tab/Enter di sidebar dan fokus terlihat.

## M6 — Menu Scan, Beranda ringkas, isi Recycle Bin, file per kategori (setelah M5)
Tujuan: dari masukan pemilik setelah M5 (2026-09-30). Scan punya menu sendiri, Beranda hanya berisi aksi cepat yang jelas, Recycle Bin menampilkan isinya dan bisa memulihkan item, tab Kategori bisa menampilkan file per kategori. Tidak ada hapus permanen baru (D-003 tetap). Keputusan: D-038 s/d D-040; pertanyaan terbuka M6 di `DECISIONS.md`.

**Menu & Beranda (D-038)**
- [x] Menu baru **Scan** (antara Beranda dan Hasil Scan): kartu drive, pilih folder, progress scan + Batal, pesan batal/gagal. Scan hanya dimulai dari sini (dan "Scan ulang" di Hasil Scan)
- [x] Beranda bagian **Kondisi sekarang** (3 kartu kecil, angka + label jelas): drive paling penuh (bar + sisa ruang, warna danger bila ≥ 90%), Recycle Bin (ukuran + jumlah item, "masih memakan ruang"), Scan terakhir (path, ukuran, kapan) atau "belum ada scan"
- [x] Beranda bagian **Mau apa?**: 4 kartu bernomor sesuai alur, tiap kartu satu kalimat "untuk apa" + satu tombol ke menunya: (1) Scan → menu Scan (tidak memulai scan langsung), (2) Lihat hasil → Hasil Scan (nonaktif + "scan dulu" bila belum ada), (3) Bersihkan → Pembersih, dengan perkiraan "± X GB bisa dibersihkan", (4) Kosongkan → Recycle Bin (warna danger, "tidak bisa dibatalkan"). Pengaturan hanya di sidebar
- [x] Satu baris catatan keamanan di bawah: Sweepr hanya memindahkan ke Recycle Bin; hapus permanen hanya lewat "Kosongkan Recycle Bin"
- [x] Backend: `estimate_cleanup` — total ukuran + jumlah item per rule yang **dicentang otomatis**, tanpa menyimpan preview (backend hanya menyimpan satu preview; memakai `preview_cleanup` dari Beranda akan membatalkan preview yang sedang dibuka di Pembersih). Hanya membaca; tes bahwa preview aktif tetap berlaku setelah `estimate_cleanup`
- [x] Perkiraan dimuat di latar belakang (tidak menahan Beranda/splash), tampil "menghitung…" lalu angkanya; dihitung ulang saat Beranda dibuka lagi dan setelah pembersihan
- [x] Sidebar: tiap menu punya keterangan singkat (tooltip/sub-teks) supaya pengguna tahu isinya; urutan menu: Beranda, Scan, Hasil Scan, Pembersih, Recycle Bin, Pengaturan
- [x] Scan selesai → pindah ke Hasil Scan bila pengguna masih di menu Scan (aturan M5 disesuaikan)

**Isi Recycle Bin (D-039)**
- [x] Backend: `list_recycle_bin` lewat `trash::os_limited::list` + `metadata` (tanpa dependency baru): nama, lokasi asal, ukuran, tanggal dihapus, folder/file. Mengembalikan **ID** dari daftar yang dibuat backend; daftar kedaluwarsa seperti preview pembersih
- [x] Backend: `restore_from_recycle_bin(list_id, item_ids)`: frontend hanya mengirim ID; backend mencari item lagi, melewati item yang sudah tidak ada atau yang lokasi asalnya sudah terisi (tidak menimpa, tidak mengganti nama), hasil per item + alasan gagal, dicatat di log JSON lines
- [x] Tes: ID tak dikenal/kedaluwarsa, lokasi asal sudah ada (tidak ditimpa), item hilang sejak daftar dibuat; tes Recycle Bin asli `#[ignore]` seperti M3 (buang file dummy → tampil di daftar → pulihkan → kembali utuh)
- [x] UI: satu daftar gabungan semua drive (seperti Explorer), tabel virtual (nama, lokasi asal, drive, ukuran, tanggal dihapus), filter per drive (tampil bila > 1 drive), ringkasan ukuran per drive, cari, urut, centang per item, tombol **Pulihkan** dengan konfirmasi (jumlah + total ukuran); "Kosongkan Recycle Bin" tetap satu-satunya hapus permanen
- [x] Ringkasan ukuran/isi tetap ada di atas daftar; daftar dimuat ulang setelah pulihkan/kosongkan

**File per kategori (D-040)**
- [x] Backend: `get_category_files(scan_id, node_id, category, sort, offset, limit)`: file kategori itu di bawah folder breadcrumb, per halaman (seperti `get_children`), tanpa mengirim seluruh daftar sekaligus
- [x] Tes: hasil hanya berisi kategori yang diminta, ikut subtree folder, sort + paging benar, kategori tak dikenal → error
- [x] UI: klik baris kategori (atau segmen bar) → daftar file kategori itu (nama, lokasi, ukuran, tanggal) dengan aksi **Buka file**, **Buka di Explorer**, **Salin path**; kembali ke ringkasan kategori _(Buka file dihapus di revisi akhir, D-041)_
- [x] "Buka file" lewat backend dengan `node_id` (bukan path dari frontend), dibuka dengan aplikasi bawaan Windows. File yang bisa dijalankan (daftar ekstensi di config: `.exe`, `.msi`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.lnk`, `.scr`, `.com`, ...) tidak diberi tombol ini dan ditolak backend; hanya "Buka di Explorer". Tes penolakannya _(dihapus di revisi akhir, D-041)_
- [x] Bar kategori: label nama + persentase di dalam segmen yang cukup lebar, legenda di bawah bar untuk segmen kecil, tooltip lengkap (nama, ukuran, persen, jumlah file) di setiap segmen; bisa difokus dengan keyboard

**Penutup**
- [x] Semua teks baru lewat i18n (`id.ts` + `en.ts`); cek grep teks tertanam
- [x] Perbarui `PRD.md` §9, `ARCHITECTURE.md` (command baru, Frontend), `SAFETY_RULES.md` (pulihkan dari Recycle Bin)
- [x] `cargo test`, `clippy`, `typecheck`, `lint`, `prettier` bersih; cek manual di Windows dicatat di sini

**Selesai jika:** scan hanya dari menu Scan dan Beranda berisi aksi cepat yang dipahami tanpa penjelasan; isi Recycle Bin tampil dan item terpilih bisa dipulihkan ke lokasi asal tanpa menimpa file; file per kategori bisa dilihat, dibuka, dan disalin path-nya; bar kategori punya label dan persentase; semua tes lulus.

**Catatan M6 (2026-09-30)** — keputusan D-038 s/d D-040.
- Otomatis: `cargo test` 89 lulus (17 baru: file per kategori, executable, estimate, parse `$I`, pulihkan: berhasil / tidak menimpa / cek ulang / junction / daftar sekali pakai & kedaluwarsa / batas item, `move_no_replace`, `open_file`), `clippy -D warnings`, `cargo fmt`, `typecheck`, `lint`, `prettier` bersih. Grep teks tertanam: hanya temuan palsu (operator `<`/`>` di kode).
- Recycle Bin asli (`cargo test --lib real_restore -- --ignored`, lulus): file dummy `.json` dibuang → muncul di daftar dengan nama lengkap berikut ekstensi → dipulihkan utuh → hilang dari Recycle Bin.
- Temuan implementasi (D-039): `trash::os_limited::restore_all` memakai nama tampilan tanpa ekstensi (`capabilities.json` → `capabilities`) dan menimpa saat tabrakan (`FOF_NO_UI`). Pulihkan kini membaca path asal dari file `$I` dan memindah dengan `MoveFileExW` tanpa replace.
- Cek di app (`tauri dev`, instance uji terpisah, 2026-09-30, Claude lewat screenshot): Beranda (drive paling penuh, Recycle Bin 9,4 GB, perkiraan "± 8,1 GB bisa dibersihkan"), menu Scan, scan `C:\` 18,9 dtk → pindah otomatis ke Hasil Scan, tab Kategori (label + % di segmen lebar, legenda), daftar file Installers (tombol "Buka file" hanya untuk `.iso`, redup untuk `.exe`/`.msi`), daftar Recycle Bin 23 item dengan ekstensi benar. Tidak ada yang dipulihkan, dibuka, atau dihapus saat cek ini.
- **Bug scan macet di 0 (sejak M1, ditemukan pemilik di M6):** callback `process_read_dir` memakai `par_iter` di pool rayon yang sama dengan jwalk. Thread yang menunggu bisa mencuri tugas "ambil folder berikutnya" milik jwalk, yang terblokir sampai folder itu sendiri selesai → deadlock acak (progress 0, Batal tidak bereaksi). Terbukti dengan log sementara di `tauri dev` (70.968 folder terbaca, loop utama tidak menerima entri pertama). Perbaikan: callback berurutan (paralelisme antar-folder tetap dari jwalk). `scan_bench` kini juga mencetak waktu sampai progress pertama: `C:` release 9,84 → 9,67 dtk, progress pertama 0,22 dtk. Di app (`tauri dev`, scan langsung saat Beranda masih menghitung perkiraan, 3× berturut-turut): progress terlihat < 1,5 dtk, selesai ±10 dtk; Batal berfungsi.
- Bundle JS 387,3 → 411,6 KB (gzip 120,7 → 126,1 KB); CSS 28,7 → 30,2 KB.
- **Belum (pemilik):** cek manual — Pulihkan dari UI (pilih 1 item dummy → konfirmasi → kembali ke lokasi asal; coba juga saat lokasi asal sudah ada file bernama sama → dilewati, file tidak berubah), filter drive (bila ada drive kedua/flashdisk), tema terang, jendela 800 px.

**Revisi akhir M6 (2026-09-30, masukan pemilik, D-041)**
- [x] Sidebar: ikon app (rubah) + teks "Sweepr" menggantikan ubin huruf
- [x] Beranda: judul = sapaan menurut jam (pagi/siang/sore/malam; diperbarui tiap menit) + ikon matahari/bulan; kartu "Mau apa?" pakai ikon, bukan nomor; kartu ke-4 → "Recycle Bin"
- [x] Semua halaman rata kiri dengan satu lebar maksimum (`PAGE_BODY`); Pengaturan tidak lagi di tengah
- [x] Ikon Pengaturan → roda gigi
- [x] Pembersih: bar "Dipilih + Lanjut ke konfirmasi" → kartu melayang (sticky) di dalam area daftar, selebar daftar
- [x] "Buka file" dihapus seluruhnya: tombol, command `open_file`, `executable_extensions` di config, `ScanError::NotAFile`/`Executable`, 4 tesnya
- [x] Bug: scrollbar jendela (kanan + bawah) berkedip setiap pindah menu. Penyebab: animasi masuk halaman (`PageView`, geser 16 px) sesaat membuat isi lebih lebar dari jendela. Perbaikan: `<main>` memotong isinya (`overflow-hidden`) dan `html, body` tidak pernah scroll; yang scroll hanya area di dalam halaman. Dicek lewat CDP: 7× pindah menu, lebar/tinggi dokumen tidak pernah melebihi jendela (selisih 0 px)
- Otomatis: `cargo test` 85 lulus (89 − 4 tes "Buka file"), `clippy -D warnings`, `cargo fmt`, `typecheck`, `lint`, `prettier` bersih.
- Cek di app (salinan uji terpisah, Claude lewat screenshot, tema gelap, 1100 px): logo + "Sweepr" di sidebar, "Good evening" + ikon bulan, kartu berikon, kartu "Recycle Bin", ikon roda gigi, Pengaturan rata kiri, kartu "Dipilih" di Pembersih tetap terlihat di bawah saat detail aturan dibuka. Daftar file kategori tanpa "Buka file" belum dilihat (perlu scan).
