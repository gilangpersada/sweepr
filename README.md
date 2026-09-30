# Sweepr

Aplikasi desktop untuk memindai penyimpanan PC, menunjukkan folder/file apa yang memakan ruang, dan membantu membebaskan ruang dengan aman.

- **Platform MVP:** Windows 10/11 (struktur disiapkan untuk macOS)
- **Stack:** Tauri 2 (Rust) + React + TypeScript + Vite
- **Status:** Pra-MVP — M0–M3 selesai; M4 (poles & rilis pribadi): installer jadi, menunggu 2 minggu pemakaian; M5 (redesign UI) sudah di-merge; M6 (menu Scan, Beranda aksi cepat, isi + pulihkan Recycle Bin, file per kategori) dikerjakan, tinggal cek manual
- **Prasyarat:** Node ≥ 22.12, Rust stable (MSVC), Visual Studio Build Tools (C++)

## Isi folder ini

| File | Fungsi |
|---|---|
| `CLAUDE.md` | Aturan & konteks utama untuk Claude Code / AI coding agent |
| `docs/PRD.md` | Product Requirements Document untuk MVP |
| `docs/ARCHITECTURE.md` | Rancangan teknis: modul, command, event, model data |
| `docs/SAFETY_RULES.md` | Aturan keselamatan hapus file (WAJIB dipatuhi) |
| `docs/TASKS.md` | Pecahan pekerjaan MVP per milestone + kriteria selesai |
| `docs/ROADMAP.md` | Fitur berikutnya & ide project lain |
| `docs/DECISIONS.md` | Catatan keputusan & pertanyaan terbuka |
| `docs/START_PROMPT.md` | Prompt awal untuk memulai di Claude Code |
| `config/cleaner-rules.windows.json` | Aturan pembersih Windows (data, bukan kode) |
| `config/cleaner-rules.macos.json` | Stub untuk macOS (belum dipakai di MVP) |

## Menjalankan saat pengembangan

```
npm install
npm run tauri dev
```

Cek sebelum commit: `npm run lint && npm run typecheck`, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`.

## Membuat & memasang installer (Windows)

1. `npm run tauri build` — build pertama mengunduh tool NSIS dari GitHub (hanya saat build).
2. Hasil: `src-tauri/target/release/bundle/nsis/Sweepr_<versi>_x64-setup.exe`.
3. Jalankan installer. Terpasang per mesin di `C:\Program Files\Sweepr`, **butuh hak admin** (prompt UAC, D-030). App sendiri tetap berjalan sebagai pengguna biasa.
4. Installer belum ditandatangani, jadi Windows SmartScreen menampilkan "Windows protected your PC": klik **More info → Run anyway**.
5. Uninstall lewat **Settings → Apps → Installed apps → Sweepr** (juga meminta admin).

Log pembersihan: `%LOCALAPPDATA%\com.sweepr.app\logs\cleanup.jsonl`.

## Bekerja dengan Claude Code

Kerjakan satu milestone per sesi dari `docs/TASKS.md`. Prompt awal proyek ada di `docs/START_PROMPT.md`.
