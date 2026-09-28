# DiskLens (working name)

Aplikasi desktop untuk memindai penyimpanan PC, menunjukkan folder/file apa yang memakan ruang, dan membantu membebaskan ruang dengan aman.

- **Platform MVP:** Windows 10/11 (struktur disiapkan untuk macOS)
- **Stack:** Tauri 2 (Rust) + React + TypeScript + Vite
- **Status:** Pra-MVP — M0 (setup proyek) selesai
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

## Cara mulai

1. Ekstrak zip, jalankan `git init` di foldernya.
2. Buka folder di Claude Code.
3. Buka `docs/START_PROMPT.md`, salin prompt-nya, dan mulai dari **Milestone M0**.
4. Kerjakan satu milestone per sesi. Jangan lompat.
