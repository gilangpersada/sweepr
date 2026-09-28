# CLAUDE.md — DiskLens

Read this file first in every session. Then read `docs/TASKS.md` to see the current milestone.

## What this project is
A desktop disk-space analyzer + safe cleaner. Scan a folder/drive, show what uses space, and let the user free space safely.
Owner is a solo developer (Indonesian speaker, comfortable with JavaScript/TypeScript, new to Rust). Explain Rust decisions briefly when you make them. Reply to the user in Indonesian unless asked otherwise; keep code, identifiers, and commit messages in English.

## Stack
- Tauri 2 (Rust backend) + React + TypeScript + Vite frontend
- Rust crates (propose before adding others): `jwalk` or `walkdir` (traversal), `rayon`, `serde`/`serde_json`, `sysinfo` (drive info), `trash` (send to Recycle Bin/Trash), `dirs` (known folders), `thiserror`, `tracing`
- Frontend: React + TS, plain CSS or Tailwind (ask before choosing), no heavy UI kits in MVP

## Platform policy
- MVP target: **Windows**. Code must stay **cross-platform-ready** for macOS:
  - Use `std::path::PathBuf`; never hardcode `\` or `/`.
  - Put OS-specific code behind `#[cfg(target_os = "...")]` in `src-tauri/src/platform/`.
  - Cleaner rules live in `config/cleaner-rules.<os>.json` (data, not hardcoded in Rust).
- Do not build macOS-specific features in MVP, but do not block them either.

## Project structure (target)
```
src-tauri/src/
  main.rs            # Tauri setup only
  commands.rs        # #[tauri::command] handlers (thin)
  scanner/           # traversal, tree model, cancellation
  cleaner/           # rule loading, preview, execute (see SAFETY_RULES)
  platform/          # cfg-gated OS code (windows.rs, macos.rs)
  safety.rs          # protected paths + path validation
src/                 # React app
  components/ views/ hooks/ lib/ (typed wrappers around invoke)
config/              # cleaner rules per OS
docs/                # PRD, architecture, tasks, roadmap
```

## Commands
```
npm install
npm run tauri dev        # run app in dev
npm run tauri build      # production build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml
npm run lint && npm run typecheck
```

## HARD RULES (never violate)
1. **Deletion safety is the top priority.** Read `docs/SAFETY_RULES.md` before touching anything in `cleaner/` or `safety.rs`. Any change there needs tests.
2. The frontend must **never** send arbitrary paths to a delete command. It sends IDs from a backend-generated preview; the backend re-validates every path.
3. Default action is **move to Recycle Bin/Trash**. Permanent delete only where `docs/DECISIONS.md` says it is allowed.
4. Never follow symlinks/junctions during scan or cleanup.
5. Never scan or modify protected system locations for deletion (list in `safety.rs`).
6. No network calls, no telemetry, no analytics. The app is fully local.
7. Do not add dependencies without saying why in one sentence and asking first.

## Working style
- Work **one milestone at a time** from `docs/TASKS.md`. Do not start the next milestone unprompted.
- Before big changes, state a short plan (3–6 bullets), then implement.
- Keep commands thin; put logic in modules that are unit-testable without Tauri.
- Scanning must run off the UI thread, report progress via events, and be cancellable.
- Never send the whole file tree to the frontend at once. Send children lazily per node (see ARCHITECTURE).
- Write tests for: size aggregation, cancellation, path validation/protected paths, rule matching.
- When you finish a task: tick it in `docs/TASKS.md`, list what you changed, list anything you were unsure about.
- If a requirement is unclear or conflicts with SAFETY_RULES, **ask** instead of guessing.

## Definition of done (per task)
- Builds without warnings (`clippy -D warnings`, `typecheck`)
- Tests added/updated and passing
- Manual check on Windows described in the summary
- `docs/TASKS.md` updated

## Out of scope for MVP (do not build)
MFT fast mode, treemap, duplicate finder, scan history, tray widget, macOS build, auto-update, code signing, settings sync. See `docs/ROADMAP.md`.
