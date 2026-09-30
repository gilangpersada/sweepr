# ROADMAP — setelah MVP

Urutan ini usulan, bukan janji. Ubah sesuai apa yang benar-benar terpakai.

## Fitur berikutnya untuk Sweepr

| Versi | Fitur | Catatan |
|---|---|---|
| v0.1.x | **Redesign UI (M5)** — sudah dikerjakan | Menu sidebar per fitur, gaya Neo-Brutalism, animasi `motion`, loading screen. Lihat `TASKS.md` M5, D-031 s/d D-037. |
| v0.1.x | **Menu Scan, isi Recycle Bin, file per kategori (M6)** | Beranda jadi aksi cepat, menu Scan sendiri, daftar + pulihkan item Recycle Bin, daftar file per kategori + label bar. Lihat `TASKS.md` M6, D-038 s/d D-040. |
| v0.2 | **Lewati file cloud, cache developer tambahan, file besar lama (M7)** | File "hanya online" tidak dipindai dan tidak pernah dibuang; rule `target/`, `.next/`, cache npm/pip; filter file besar lama di File Terbesar + pindah ke Recycle Bin. Lihat `TASKS.md` M7, D-042 s/d D-044. |
| v0.2 | **Treemap, peringatan drive hampir penuh, file duplikat (M8)** | Treemap dari data `get_children`; ikon tray + notifikasi ambang; duplikat: ukuran → hash sebagian → hash penuh (BLAKE3). Lihat `TASKS.md` M8. |
| v0.3 | **Rescan cepat** | Scan ulang hanya subfolder yang dipilih. |
| v0.4 | **Riwayat scan** | Simpan snapshot ringkas (SQLite); tampilkan folder yang tumbuh cepat. |
| v0.4 | **Cache browser & app** | Rule tambahan dengan peringatan (login/sesi bisa hilang). |
| v0.4 | **Cache developer lanjutan** | `dist/`/`build/` lama dan `node_modules` pnpm (junction, D-022) — perlu verifikasi perilaku Recycle Bin terhadap junction dulu. |
| v0.5 | **Mode pembersih: aman / sedang / agresif** | Preset yang mengatur rule mana dicentang. |
| v0.6 | **Port ke macOS** | Full Disk Access, `cleaner-rules.macos.json`, `~/Library/Caches`, Xcode DerivedData, Trash. |
| v0.7 | **Mode cepat MFT (Windows/NTFS)** | Baca MFT langsung; butuh admin; jauh lebih cepat. Bonus khusus Windows. |
| Nanti | **Rilis** | Code signing (Windows), notarisasi (Mac, Apple Developer), auto-update, situs sederhana. |
| Nanti | **Open source / jual** | Mulai dari gratis/open source; lisensi dipilih sebelum publik. Uji lebih ketat karena fitur hapus. |

## Ide project lain (pakai pola "pengumpul / pemantau / pembuat")
1. **Token Usage Monitor** — tray/floating widget yang membaca log lokal Claude Code (file JSONL di folder `.claude`) untuk menampilkan token & estimasi biaya harian/mingguan. Referensi: `ccusage`. Cocok sebagai proyek kecil kedua karena stack-nya sama (Tauri).
2. **Shopee Price & Stock Watcher** — pantau harga produk yang sudah direview; harga turun = momen bikin konten lagi. Bisa jadi lanjutan Affiliate Product Scout.
3. **Content Performance Tracker** — rekap performa per video/produk (klik, komisi) dari spreadsheet atau ekspor, dengan grafik tren.
4. **Pelanggan & Pengingat Galon** — catatan pelanggan langganan depot, pengingat kapan mereka biasanya habis, rekap pesanan harian.
5. **Media Cleaner khusus creator** — turunan Sweepr: temukan render/rekaman lama per project video, arsipkan ke drive lain atau tandai aman dihapus.
6. **Project Folder Organizer** — rapikan folder Downloads/Desktop otomatis berdasarkan aturan.

## Prinsip memilih berikutnya
Kerjakan yang benar-benar terpakai. Setelah MVP dipakai 2 minggu, catat: fitur apa yang paling sering dibuka, apa yang mengganggu, apa yang kurang. Itu jadi dasar memilih v0.2.
