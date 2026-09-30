# SAFETY_RULES — aturan keselamatan penghapusan

Dokumen ini punya prioritas tertinggi. Jika PRD/tugas bertentangan dengan dokumen ini, ikuti dokumen ini dan tanyakan ke pemilik proyek.

## Prinsip
1. **Bisa dikembalikan lebih baik daripada permanen.** Default: pindah ke Recycle Bin/Trash.
2. **Backend tidak percaya UI.** UI hanya mengirim ID dari preview yang dibuat backend.
3. **Validasi dua kali:** saat preview dan sekali lagi tepat sebelum eksekusi.
4. **Tanpa kejutan:** pengguna selalu melihat daftar + total ukuran sebelum apa pun berubah.

## Aturan teknis
- Kanonisasi setiap path (`std::fs::canonicalize`) sebelum validasi, untuk mencegah `..` dan trik path.
- **Tolak** jika path adalah symlink/junction/reparse point, atau berada di dalam salah satunya.
- **Tolak** jika path sama dengan, atau berada di dalam, daftar terlarang (denylist) di `safety.rs`.
- **Hanya izinkan** path yang berada di dalam "allowed roots" milik rule yang sedang dijalankan (misal `%TEMP%`, folder Downloads pengguna).
- Jangan hapus folder root drive, folder home pengguna, Desktop, Documents, Pictures, Videos, Music (folder itu sendiri; isi tertentu hanya bila ada rule eksplisit).
- File yang sedang dipakai (locked) → lewati, laporkan sebagai gagal, jangan paksa.
- Batasi jumlah item per eksekusi (default 10.000) untuk mencegah bencana akibat bug rule.
- Tulis log setiap aksi: waktu, rule, path, ukuran, hasil.

## Denylist minimum (Windows)
```
C:\Windows            C:\Program Files       C:\Program Files (x86)
C:\ProgramData        C:\$Recycle.Bin        C:\System Volume Information
C:\Users\<user>\AppData\Roaming (kecuali rule eksplisit)
C:\Users\<user>\Documents  \Desktop  \Pictures  \Videos  \Music
Root drive mana pun (mis. C:\ atau D:\)
```
(macOS nanti: `/System`, `/Library`, `/Applications`, `/usr`, `/bin`, `/private`, home, dan folder pengguna standar.)

## Tingkat risiko rule
- **Rendah:** dibuat ulang otomatis (temp, cache). Boleh dicentang default.
- **Sedang:** bisa dibuat ulang tapi butuh waktu/internet (`node_modules`). Tidak dicentang default.
- **Tinggi:** sulit dipulihkan. **Tidak ada di MVP.**

## Hapus permanen
Tidak ada di MVP kecuali "Kosongkan Recycle Bin" (aksi terpisah, konfirmasi sendiri, menjelaskan bahwa ini tidak bisa dibatalkan).

## Pulihkan dari Recycle Bin (M6, D-039)
- UI hanya mengirim `list_id` + ID item dari daftar buatan backend (`list_recycle_bin`); daftar sekali pakai dan kedaluwarsa 30 menit, seperti preview.
- Path asal dibaca dari catatan `$I` milik Windows, bukan dari nama tampilan shell (yang menyembunyikan ekstensi). Item tanpa catatan yang terbaca tidak ditampilkan dan tidak bisa dipulihkan.
- Tepat sebelum memindah, dicek lagi: item masih ada, catatan `$I` tidak berubah, lokasi asal kosong, folder asal ada dan bukan/tidak berada di dalam symlink/junction.
- **Tidak pernah menimpa atau mengganti nama.** Pemindahan memakai `MoveFileExW` tanpa `MOVEFILE_REPLACE_EXISTING`: Windows sendiri menolak bila tujuan sudah ada, jadi tidak ada jeda antara cek dan pindah. `trash::os_limited::restore_all` **tidak dipakai**: ia menimpa saat tabrakan (`FOF_NO_UI`) dan memakai nama tanpa ekstensi.
- Setiap pemulihan dicatat di log (`"action":"restore"`). Tidak ada hapus permanen per item; "Kosongkan Recycle Bin" tetap satu-satunya.

## Buka file (M6, D-040)
- Hanya lewat `node_id` dari hasil scan; symlink/junction dan folder ditolak.
- File yang menjalankan program (`executable_extensions` di config: `.exe`, `.msi`, `.bat`, `.ps1`, `.js`, `.lnk`, `.reg`, ...) ditolak di backend; UI hanya menawarkan "Buka di Explorer" untuknya.

## Tes wajib
- Path `..` dan path relatif ditolak / dinormalisasi.
- Symlink/junction ditolak.
- Setiap entri denylist ditolak, termasuk turunannya.
- Path di luar allowed roots ditolak.
- Batas jumlah item ditegakkan.
- Preview kedaluwarsa (file sudah berubah) ditolak saat eksekusi.
- Pulihkan: lokasi asal terisi → dilewati, isi tidak berubah; item hilang/catatan berubah/folder asal hilang/di balik junction → dilewati; daftar tak dikenal/terpakai/kedaluwarsa ditolak.
- Buka file: file yang bisa dijalankan dan folder ditolak.
