//! OS-specific code. Each OS lives in its own file, gated with `#[cfg(target_os = "...")]`.

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
mod macos;
