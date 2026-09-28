//! Sweepr backend: Tauri setup and module wiring.
//! Logic lives in the modules below; `commands` stays a thin layer over them.

mod cleaner;
mod commands;
mod platform;
mod safety;
mod scanner;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
