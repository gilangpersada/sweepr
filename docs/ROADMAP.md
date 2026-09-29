# ROADMAP — setelah MVP

Urutan ini usulan, bukan janji. Ubah sesuai apa yang benar-benar terpakai.

## Fitur berikutnya untuk Sweepr

| Versi | Fitur | Catatan |
|---|---|---|
| v0.1.x | **Redesign UI (M5)** | Menu sidebar per fitur, gaya Neo-Brutalism, animasi `motion`, loading screen. Lihat `TASKS.md` M5, D-031 s/d D-033. |
| v0.2 | **Treemap / sunburst** | Visual kotak berwarna; klik untuk masuk folder. Pakai canvas/SVG dari data `get_children`. |
| v0.2 | **Rescan cepat** | Scan ulang hanya subfolder yang dipilih. |
| v0.3 | **Deteksi file duplikat** | Kelompokkan berdasarkan ukuran → hash sebagian → hash penuh (BLAKE3). Pilih mana yang dipertahankan. |
| v0.3 | **File besar jarang dibuka** | Filter: > X GB dan tidak diakses > N hari. Cocok untuk video mentah lama. |
| v0.4 | **Riwayat scan** | Simpan snapshot ringkas (SQLite); tampilkan folder yang tumbuh cepat. |
| v0.4 | **Cache browser & app** | Rule tambahan dengan peringatan (login/sesi bisa hilang). |
| v0.4 | **Cache Developer tambahan** | Rule grup developer lain: `target/` (Rust), `.next/`, `dist/`/`build/` lama, cache Gradle/pip. Plus dukungan `node_modules` pnpm (saat ini dikecualikan karena berisi junction, D-022) — perlu verifikasi perilaku Recycle Bin terhadap junction dulu. |
| v0.5 | **Widget tray + peringatan drive hampir penuh** | Ikon tray, sisa ruang tiap drive, notifikasi ambang batas. |
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
