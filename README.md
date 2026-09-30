# Sweepr

A desktop app that scans your PC's storage, shows which folders and files take up the most space, and helps you free space safely.

- **MVP platform:** Windows 10/11 (the code is structured so a macOS port stays possible)
- **Stack:** Tauri 2 (Rust) + React + TypeScript + Vite
- **Status:** Pre-MVP.
  - Done: M0–M3, M5 (UI redesign) and M6 (Scan menu, quick-action Home, Recycle Bin list + restore, files per category). M6 still needs the owner's manual checks.
  - M4 (polish & private release): the installer is ready; waiting on two weeks of real use.
  - Next: M7 (skip cloud-only files, more developer caches, old large files), then M8 (treemap, low-disk alerts, duplicate files).
- **Prerequisites:** Node ≥ 22.12, Rust stable (MSVC), Visual Studio Build Tools (C++)
- **Fully local:** no network calls, no telemetry. Cleaning moves files to the Recycle Bin; the only permanent delete is "Empty Recycle Bin".

## What is in this repo

The project docs are written in Indonesian.

| File                                | Purpose                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `CLAUDE.md`                         | Main rules and context for Claude Code / AI coding agents |
| `docs/PRD.md`                       | Product requirements for the MVP                        |
| `docs/ARCHITECTURE.md`              | Technical design: modules, commands, events, data model |
| `docs/SAFETY_RULES.md`              | File deletion safety rules (MUST be followed)           |
| `docs/TASKS.md`                     | MVP work split into milestones + definition of done     |
| `docs/ROADMAP.md`                   | Upcoming features and other project ideas               |
| `docs/DECISIONS.md`                 | Decision log and open questions                         |
| `docs/START_PROMPT.md`              | Starting prompt for Claude Code                         |
| `config/cleaner-rules.windows.json` | Windows cleaner rules (data, not code)                  |
| `config/cleaner-rules.macos.json`   | macOS stub (not used in the MVP)                        |

## Running in development

```
npm install
npm run tauri dev
```

Before committing, run:

- `npm run lint && npm run typecheck`
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml`

## Building and installing (Windows)

1. Run `npm run tauri build`. The first build downloads the NSIS tools from GitHub (only at build time).
2. The installer is written to `src-tauri/target/release/bundle/nsis/Sweepr_<version>_x64-setup.exe`.
3. Run the installer. It installs per machine to `C:\Program Files\Sweepr` and **needs admin rights** (UAC prompt, D-030). The app itself runs as a normal user.
4. The installer is not signed yet, so Windows SmartScreen shows "Windows protected your PC". Click **More info → Run anyway**.
5. To uninstall, go to **Settings → Apps → Installed apps → Sweepr** (this also asks for admin rights).

Cleanup log: `%LOCALAPPDATA%\com.sweepr.app\logs\cleanup.jsonl`.

## Working with Claude Code

Work on one milestone per session from `docs/TASKS.md`. The project's starting prompt is in `docs/START_PROMPT.md`.
