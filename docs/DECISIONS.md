# DECISIONS

## Keputusan (ADR ringkas)
| ID | Keputusan | Alasan | Status |
|---|---|---|---|
| D-001 | Stack: Tauri 2 + React + TS | Scan cepat & ringan, cross-platform, UI berbasis web yang familier | Diterima |
| D-002 | Windows dulu, siap macOS | Pengguna awal di Windows; struktur `platform/` + rule per OS | Diterima |
| D-004 | Scan mode biasa dulu (tanpa admin) | Lebih sederhana & aman; MFT ke roadmap | Diterima |
| D-005 | Pohon in-memory berbasis arena, children dimuat lazy | Hemat memori, UI tidak menerima data raksasa | Diterima |
| D-006 | Rule pembersih berupa JSON per OS | Mudah menambah/ubah tanpa kompilasi ulang | Diterima |
| D-007 | Styling: Tailwind CSS v4 via `@tailwindcss/vite` | Dipilih pemilik di M0; v4 tanpa config/PostCSS terpisah; dark mode ikut `prefers-color-scheme` (sejak M5 lewat pilihan tema, D-034) | Diterima |
| D-008 | Toolchain minimum: Node ≥ 22.12 (dipakai: 24 LTS), Rust stable MSVC | Vite 8/ESLint 10 butuh Node ≥ 20.19; Node 20 sudah EOL | Diterima |
| D-009 | Webview dikunci CSP ketat (hanya `self` + IPC Tauri) | Mendukung aturan "tanpa jaringan"; berlaku di build produksi | Diterima |
| D-010 | Nama app: **Sweepr** (repo `sweepr`, identifier `com.sweepr.app`), menggantikan nama kerja "DiskLens" | Dipilih pemilik setelah M0; ringkas dan menonjolkan fungsi pembersih | Diterima |
| D-011 | Traversal pakai `jwalk` (rayon) + `sysinfo` (fitur `disk`) untuk daftar drive | Urutan hasil depth-first memungkinkan parent dilacak dengan stack, tanpa map path→id; scan `C:\` ±1 juta node dalam 13–32 dtk, ±189 MB | Diterima (M1) |
| D-012 | Semua query hasil scan menyertakan `scan_id`; error dikirim sebagai `{ code, message }` | ID node dari scan lama ditolak, tidak salah baca tree baru; `code` stabil untuk teks UI terjemahan | Diterima (M1) |
| D-013 | Symlink/junction di dalam tree tidak ditampilkan; root berupa link ditolak | Aturan keras #4; menghindari hitung ganda dan loop | Diterima (M1) |
| D-014 | Pilih folder pakai plugin resmi `tauri-plugin-dialog` + `@tauri-apps/plugin-dialog`, izin hanya `dialog:allow-open` | Dialog folder bawaan OS; lokal, tanpa jaringan; izin sesempit mungkin | Diterima (M2) |
| D-015 | "Buka di Explorer" via `explorer.exe /select,"<path>"` di `platform/windows.rs` (macOS: `open -R`), tanpa dependency. Command menerima `scan_id` + `node_id`, path dihitung backend | Tidak perlu `tauri-plugin-opener`; UI tak pernah mengirim path (aturan keras #2) | Diterima (M2) |
| D-016 | Virtual list ditulis sendiri (`components/VirtualList.tsx`, tinggi baris tetap) + `get_children` dimuat per halaman 500 baris | Tanpa dependency; cukup untuk tabel dengan tinggi baris tetap. `@tanstack/react-virtual` jadi cadangan bila perlu | Diterima (M2) |
| D-017 | Kategori file: `category_extensions` dibaca dari `config/cleaner-rules.<os>.json` yang disematkan saat kompilasi (`include_str!`); kategori disimpan 1 byte per node saat scan; ekstensi ganda antar kategori ditolak | Sederhana untuk M2; `Node` tetap 72 byte (dijaga tes). Loader rule lengkap + file config di luar binary menyusul di M3 | Diterima (M2) |
| D-003 | Semua rule hanya memindahkan ke Recycle Bin. Satu-satunya hapus permanen: tombol "Kosongkan Recycle Bin" dengan konfirmasi terpisah | Sesuai SAFETY_RULES; opsi "temp boleh permanen" ditolak karena bertentangan dengannya | Diterima (M3) |
| D-018 | Dependency M3: `trash` (pindah ke Recycle Bin), `dirs` (lokasi asli Downloads/Documents/…, termasuk yang dipindah ke OneDrive), `windows-sys` 0.61 fitur `Win32_Foundation`, `Win32_Storage_FileSystem`, `Win32_System_Registry`, `Win32_UI_Shell` (ukuran/kosongkan Recycle Bin, pengaturan Recycle Bin per drive) | `windows-sys` sudah ada di dependency tree Tauri; tanpa `chrono` (waktu log = unix ms) | Diterima (M3) |
| D-019 | Sebelum memindahkan, cek Recycle Bin drive itu di registry (`BitBucket\Volume\{GUID}`): tolak item jika `NukeOnDelete=1`, pengaturan tak terbaca, atau ukuran item > 90% `MaxCapacity` | Mencegah Windows diam-diam menghapus permanen item yang tidak muat di Recycle Bin. `trash` memakai `FOF_WANTNUKEWARNING`, tapi perilakunya tanpa UI tidak terdokumentasi | Diterima (M3) |
| D-020 | Config rule tetap disematkan saat kompilasi (menyesuaikan D-006/D-017) | Rule yang menggerakkan penghapusan tidak bisa diubah dari luar app. Ubah rule = build ulang | Diterima (M3) |
| D-021 | `node_modules` dicari dengan menelusuri `%USERPROFILE%` sendiri (bukan dari hasil scan); folder hidden/berawalan titik dan folder terlindungi tidak ditelusuri. "Tidak diubah > N hari" = `package.json` **dan** folder project sama-sama lebih tua dari N hari | Tidak bergantung pada scan terakhir; di mesin pemilik < 10 ms | Diterima (M3) |
| D-022 | Folder kandidat (mis. `node_modules`) yang berisi symlink/junction di dalamnya dikecualikan dari preview (hanya dihitung) | Konservatif: belum diverifikasi bagaimana shell memperlakukan link di dalam folder yang dibuang/dikosongkan. Akibatnya project pnpm tidak ikut dibersihkan. Terbukti berguna: di PC pemilik 2 project pnpm berisi ±1.000 junction yang menunjuk ke lokasi lama (project pernah dipindah) | Diterima (M3), tinjau ulang |
| D-023 | Pembersih = layar tersendiri (tombol di Beranda dan di header hasil scan), bukan tab hasil scan | Rule tidak butuh hasil scan | Diterima (M3) |
| D-024 | Root rule boleh memakai `%DOWNLOADS%`, `%DOCUMENTS%`, `%DESKTOP%`, `%HOME%` (folder asli via `dirs`) selain variabel lingkungan; rule "installer lama" memakai `%DOWNLOADS%` | Downloads yang dipindah ke drive lain tetap benar | Diterima (M3) |
| D-025 | Rule punya field wajib `group` (`general` / `developer`); layar Pembersih dibagi "Umum" dan "Cache Developer". Rule `node_modules project lama` masuk grup developer dengan root `%USERPROFILE%`, `%DESKTOP%`, `%DOCUMENTS%` | Project developer sering di Desktop/Documents; menyebut folder itu secara eksplisit memenuhi SAFETY_RULES (folder Desktop/Documents sendiri tetap tidak pernah bisa dihapus). Root yang bersarang di root lain ditelusuri sekali, kandidat tidak pernah ganda | Diterima (M3, lanjutan) |
| D-026 | UI dua bahasa (Indonesia + Inggris) sejak M4, tanpa library: kamus bertipe `src/lib/i18n/id.ts` (acuan bentuk) dan `en.ts` (typecheck gagal bila kunci kurang), `useI18n()` memberi `t` + formatter angka/ukuran/tanggal sesuai bahasa. Bahasa awal ikut bahasa Windows (Indonesia → `id`, lainnya → `en`), bisa diganti di Beranda dan diingat (`localStorage`). Nama/deskripsi rule diterjemahkan di kamus per `id` rule; config tetap satu bahasa | Diminta pemilik di awal M4 (menggantikan "Inggris menyusul"); tanpa dependency |
| D-027 | Installer: NSIS saja, `installMode: currentUser` (tanpa hak admin); belum ditandatangani (SmartScreen akan memperingatkan) | Sesuai PRD "tidak butuh hak admin"; satu file setup; code signing di luar MVP. **Digantikan D-030** (mode install) |
| D-028 | Ikon app: rubah menyapu (gaya flat, latar transparan) dari pemilik. Sumber `src-tauri/icons/source.png`; `source-clean.png` = versi tanpa glow (piksel alpha < 200 dibuang) yang dipakai `npm run tauri icon` | Glow semi-transparan membuat ikon buram di taskbar gelap. Folder ikon android/ios tidak disimpan |
| D-029 | Tema: selain kelas `dark:` Tailwind, `color-scheme: light dark` di `:root` supaya scrollbar, checkbox, `<select>`, `<dialog>` ikut tema Windows; latar `html/body` diset agar tidak berkedip putih | Melengkapi D-007; sejak D-034 `color-scheme` mengikuti pilihan tema |
| D-030 | Installer `installMode: perMachine` → `C:\Program Files\Sweepr` (app 64-bit, jadi bukan `Program Files (x86)`); install/uninstall butuh admin (UAC). App tetap berjalan sebagai pengguna biasa, data/log tetap per pengguna di AppData. Ikon installer = ikon app (`nsis.installerIcon`) | Diminta pemilik saat uji install M4 (ingin app di Program Files). Menggantikan bagian mode install D-027; PRD "tanpa admin" kini berlaku untuk app, bukan installer |
| D-031 | Gaya visual Neo-Brutalism (M5): border tebal gelap, bayangan keras tanpa blur (offset), warna aksen jenuh, radius kecil, tipografi tebal. Semua nilai jadi design token di `@theme` (`src/index.css`), ada versi terang dan gelap; tetap Tailwind, tanpa UI kit. Font lokal: **Space Grotesk** (judul + teks) dan **JetBrains Mono** (angka, ukuran, path), file `.woff2` + lisensi OFL di `src/assets/fonts/`. Palet: kuning (primary), pink/merah (danger), biru (info), hijau (sukses) di atas latar krem (terang) / hampir hitam (gelap); nilai hex final ditetapkan saat membuat token, setelah cek kontras WCAG AA | Diminta pemilik; font dan palet dipilih pemilik dari usulan (2026-09-29). Token satu tempat supaya komponen konsisten; tanpa jaringan (aturan keras #6, CSP D-009): file font diunduh sekali oleh pengembang, bukan oleh app |
| D-032 | Dependency `motion` (paket npm `motion`, dulu Framer Motion) untuk animasi, dengan `LazyMotion` + `m` dan `MotionConfig reducedMotion="user"` | Diminta pemilik; animasi deklaratif untuk React (transisi halaman, dialog keluar-masuk, stagger) yang sulit dengan CSS saja; lokal, tanpa jaringan. Catat ukuran bundle sebelum/sesudah |
| D-033 | Navigasi pakai sidebar menu yang **selalu lebar** (ikon + teks, tidak bisa diciutkan): Beranda, Hasil Scan, Pembersih, Recycle Bin, Pengaturan. Recycle Bin dipisah dari layar Pembersih; pilihan bahasa pindah ke Pengaturan. Tetap state React biasa (tanpa router/library state); view yang sudah dibuka tetap ter-mount supaya hasil scan dan posisi folder tidak hilang | Diminta pemilik ("pisahkan antar fitur"). Melanjutkan D-023; tanpa `react-router` karena hanya 5 halaman tanpa URL. Lebar sidebar dipilih pemilik (2026-09-29); jendela minimum 800 px tetap cukup |
| D-034 | Pilihan tema di Pengaturan: **Ikut sistem** (bawaan) / **Terang** / **Gelap**, disimpan di `localStorage` seperti bahasa. Varian `dark:` Tailwind pindah dari media query ke atribut `data-theme` di `<html>` (`@custom-variant dark`); `color-scheme` mengikuti pilihan. Tema dipasang sebelum render pertama lewat skrip kecil di file terpisah (skrip inline diblokir CSP D-009) supaya tidak berkedip. Title bar jendela ikut tema lewat API window Tauri; izin tambahannya dicatat saat implementasi | Diminta pemilik (2026-09-29). Menyesuaikan D-007/D-029 |
| D-035 | Logo loading screen berupa **SVG** rubah menyapu, digambar ulang dari `source-clean.png` (D-028). Bagian yang dianimasikan (sapu, ekor, debu) jadi grup SVG terpisah ber-`id`; disimpan di `src/assets/`. Ikon app (`.ico`/PNG) tidak berubah | Diminta pemilik (2026-09-29): PNG tidak bisa dianimasikan per bagian |

## Pertanyaan terbuka
- **Ketersediaan nama "Sweepr"** (D-010): cek merek dagang, domain, crates.io/npm sebelum rilis publik.
- **Ukuran yang ditampilkan:** M1 memakai logical size (`len`). Size on disk (cluster slack, kompresi, file cloud OneDrive) dan hardlink yang terhitung ganda belum ditangani — putuskan apakah perlu sebelum rilis.
- **Perlu izin admin opsional** untuk scan folder yang terkunci? (MVP: lewati saja.)
- **Lisensi jika open source** (MIT / Apache-2.0 / GPL)?

## Pertanyaan terbuka untuk M2
Sudah diputuskan di awal M2: lihat D-014 s/d D-017.

## Pertanyaan terbuka untuk M5
Sudah dijawab pemilik (2026-09-29): font dan palet (D-031), sidebar selalu lebar (D-033), pilihan tema manual (D-034), logo SVG (D-035).

## Catatan pemakaian 2 minggu (M4)
Isi setelah memakai build installer di PC sendiri selama ±2 minggu (mulai: ____, selesai: ____). Tulis singkat; jadi dasar memilih v0.2 (lihat ROADMAP).
- **Paling sering dipakai:** (scan drive? file terbesar? pembersih? rule mana?)
- **Yang mengganggu / membingungkan:**
- **Yang kurang:**
- **Insiden data** (file yang tidak seharusnya terhapus, walau bisa dipulihkan): _harus "tidak ada" untuk Definition of Done MVP_
- **Kinerja** (waktu scan, memori, UI tersendat?):
- **Bahasa** (Indonesia/Inggris, teks yang janggal):
- **Keputusan yang perlu ditinjau ulang** (mis. D-022 pnpm, D-020 config disematkan):
