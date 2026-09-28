//! Sweepr backend: Tauri setup and module wiring.
//! Logic lives in the modules below; `commands` stays a thin layer over them.

mod cleaner;
mod commands;
mod drives;
mod platform;
mod safety;
pub mod scanner;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(scanner::ScanSessions::default())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::list_drives,
            commands::start_scan,
            commands::cancel_scan,
            commands::get_children,
            commands::get_largest_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
