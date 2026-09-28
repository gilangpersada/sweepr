# PRD — DiskLens MVP

> Nama sementara. Versi: 0.1 (draft) · Platform: Windows · Pengguna awal: pembuat sendiri

## 1. Ringkasan
DiskLens memindai folder atau drive, menampilkan folder dan file mana yang paling memakan ruang, lalu membantu pengguna membebaskan ruang dengan cara yang aman. MVP fokus pada dua hal: **scan yang cepat dan jelas**, dan **pembersihan yang aman dan terbatas**.

## 2. Masalah
- Drive penuh, tapi tidak jelas apa penyebabnya.
- Tool bawaan Windows (Storage Sense) kurang detail per folder.
- Content creator menumpuk video mentah/render lama; developer menumpuk `node_modules` dan cache project.
- Tool yang ada (WinDirStat, TreeSize, WizTree) kuat di scan, tapi pembersihannya minim atau tidak dipandu.

## 3. Pengguna
- **Utama:** pembuat sendiri (content creator affiliate + developer, sering edit video dan ngoding).
- **Nanti:** pengguna umum Windows/macOS jika dirilis (open source atau berbayar).

## 4. Tujuan MVP
1. Pengguna bisa memilih folder/drive, scan sampai selesai tanpa aplikasi hang, dan dapat membatalkan scan.
2. Pengguna bisa menelusuri hasil dari yang terbesar sampai ke file.
3. Pengguna bisa membebaskan ruang dari beberapa kategori aman lewat preview dan konfirmasi.
4. Tidak ada kejadian file penting terhapus akibat aplikasi.

### Metrik keberhasilan (target awal, diukur lalu dievaluasi)
| Metrik | Target awal |
|---|---|
| UI tetap responsif selama scan | Tidak freeze > 200 ms |
| Progress pertama tampil | < 1 detik setelah scan dimulai |
| Scan drive ±250 GB (mode biasa) | Dicatat waktunya; target awal < 3 menit |
| Memori untuk ±1 juta file | < 500 MB |
| Data loss tak disengaja | 0 |
| Dipakai sendiri secara rutin | Ya, minimal 2 minggu |

## 5. Non-goals (BUKAN bagian MVP)
Treemap/sunburst, mode cepat MFT, deteksi duplikat, riwayat scan, widget tray, notifikasi drive penuh, build macOS, auto-update, code signing, akun/cloud. Lihat `ROADMAP.md`.

## 6. User stories
- Sebagai pengguna, saya ingin melihat sisa ruang setiap drive supaya tahu mana yang bermasalah.
- Sebagai pengguna, saya ingin memilih sebuah folder/drive dan memindainya, dengan progress dan tombol batal.
- Sebagai pengguna, saya ingin daftar folder terurut dari terbesar, dan bisa masuk ke subfolder.
- Sebagai pengguna, saya ingin ringkasan per kategori (video, foto, dokumen, arsip, installer, lainnya).
- Sebagai pengguna, saya ingin melihat 50 file terbesar untuk menemukan pemakan ruang cepat.
- Sebagai pengguna, saya ingin saran pembersihan yang aman, dengan preview sebelum apa pun dihapus.
- Sebagai pengguna, saya ingin file yang dibersihkan bisa dikembalikan (Recycle Bin) kalau salah.
- Sebagai pengguna, saya ingin membuka lokasi file di File Explorer.

## 7. Requirement fungsional

### FR-1 Ringkasan drive
Tampilkan semua drive lokal: nama, total, terpakai, sisa, dan persentase (bar).

### FR-2 Scan
- Input: pilih drive atau folder (folder picker).
- Mode biasa (tanpa admin). Tidak mengikuti symlink/junction.
- Berjalan di thread terpisah, mengirim progress (jumlah file, ukuran terkumpul, path saat ini).
- Bisa dibatalkan kapan saja; hasil parsial dibuang dengan bersih.
- Folder yang tidak bisa diakses dilewati dan dicatat (jumlah + daftar) tanpa menghentikan scan.
- Ukuran yang dipakai: ukuran file (logical size). Ukuran on-disk boleh ditambahkan nanti.

### FR-3 Penelusuran hasil
- Tampilan daftar/tabel: nama, ukuran, persentase dari induk, jumlah file, terakhir diubah.
- Urut default: ukuran terbesar. Bisa urut nama/tanggal.
- Klik folder untuk masuk; breadcrumb untuk naik.
- Muat anak folder secara lazy (bukan seluruh tree sekaligus).
- Aksi: "Buka di Explorer", "Salin path".

### FR-4 Ringkasan kategori
Kelompokkan berdasarkan ekstensi: Video, Foto, Audio, Dokumen, Arsip, Installer, Kode/Project, Lainnya. Tampilkan ukuran per kategori. Pemetaan ekstensi disimpan di file konfigurasi.

### FR-5 File terbesar
Daftar 50 file terbesar dari hasil scan, dengan aksi "Buka di Explorer".

### FR-6 Pembersih (Cleaner)
Kategori awal (lihat `config/cleaner-rules.windows.json`):
1. **File sementara pengguna** (`%TEMP%`), hanya file yang lebih tua dari N hari.
2. **Installer lama di Downloads** (`.exe`, `.msi`, `.zip`, `.iso`) lebih tua dari 30 hari.
3. **`node_modules` lama** yang ditemukan saat scan, di project yang tidak diubah > 60 hari.
4. **Cache browser** dibiarkan di luar MVP (risiko login/sesi), masuk roadmap.

Alur wajib:
1. Pengguna memilih kategori → backend membuat **preview** (daftar item, ukuran, tingkat risiko).
2. Pengguna bisa menghapus centang per item.
3. Layar **konfirmasi** menampilkan jumlah item dan total ukuran.
4. Eksekusi memindahkan item ke **Recycle Bin** (default).
5. Hasil ditampilkan: berhasil, gagal (dengan alasan), ruang yang akan dibebaskan.
6. Semua aksi dicatat di log lokal.

> Catatan penting: memindahkan ke Recycle Bin **belum** membebaskan ruang sampai Recycle Bin dikosongkan. UI harus menjelaskan ini dan menyediakan tombol "Kosongkan Recycle Bin" dengan konfirmasi terpisah. Keputusan lengkap ada di `DECISIONS.md` (D-003).

### FR-7 Keamanan
Semua ketentuan di `SAFETY_RULES.md` berlaku. Jika ada konflik, SAFETY_RULES menang.

## 8. Requirement non-fungsional
- Lokal penuh: tanpa jaringan, telemetri, atau akun.
- Instalasi ringan (target < 30 MB installer).
- Tidak butuh hak admin di MVP.
- Teks UI dalam Bahasa Indonesia; siapkan struktur i18n sederhana (kunci teks di satu tempat) agar bisa ditambah Inggris.
- Tema terang/gelap mengikuti sistem.

## 9. Layar (wireframe teks)

**Layar 1 — Beranda**
```
[Drive C:  ████████░░ 82% terpakai · sisa 45 GB   [Scan]]
[Drive D:  ███░░░░░░░ 31% terpakai · sisa 640 GB  [Scan]]
[ Pilih folder lain... ]
```

**Layar 2 — Hasil scan**
```
Breadcrumb: C: > Users > gilang
Kategori: Video 120 GB | Foto 30 GB | Arsip 18 GB | ...
-------------------------------------------------------
Nama            Ukuran     %      File   Diubah
Videos          120 GB     48%    312    2 hari lalu
node_modules... ...
[Tab: Folder | File Terbesar | Pembersih]
```

**Layar 3 — Pembersih**
```
[x] File sementara      2.3 GB   Risiko: Rendah   [Lihat detail]
[x] Installer lama      4.1 GB   Risiko: Rendah   [Lihat detail]
[ ] node_modules lama   9.8 GB   Risiko: Sedang   [Lihat detail]
Total dipilih: 6.4 GB            [Lanjut ke konfirmasi]
```

## 10. Risiko
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Salah hapus file penting | Sangat tinggi | SAFETY_RULES, preview, Recycle Bin, daftar terlarang, tes |
| Scan lambat di drive besar | Sedang | Multi-thread, progress, batal; MFT di roadmap |
| Memori membengkak | Sedang | Lazy children, struktur data ringkas |
| Belajar Rust memperlambat | Sedang | Logika kecil & bertahap, dikerjakan bersama Claude Code |
| Ruang tidak bebas karena Recycle Bin | Rendah | Penjelasan di UI + tombol kosongkan |

## 11. Pertanyaan terbuka
Lihat `DECISIONS.md` bagian "Pertanyaan terbuka".

## 12. Definition of Done — MVP
- [ ] Semua FR-1 s/d FR-7 berfungsi di Windows 11
- [ ] Dipakai di PC sendiri tanpa insiden data hilang
- [ ] Tes otomatis untuk scanner, safety, dan rule matching lulus
- [ ] Build installer Windows berhasil (`npm run tauri build`)
- [ ] `TASKS.md` semua milestone M0–M4 tercentang
