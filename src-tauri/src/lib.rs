//! Sweepr backend: Tauri setup and module wiring.
//! Logic lives in the modules below; `commands` stays a thin layer over them.

mod cleaner;
mod commands;
mod drives;
mod platform;
mod safety;
pub mod scanner;

use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The config is embedded and covered by a test, so this only fails on a broken build;
    // the app still works then, just without categories.
    let categories = scanner::Categories::from_rules_json(platform::CLEANER_RULES_JSON)
        .unwrap_or_else(|err| {
            eprintln!("invalid category_extensions in cleaner rules: {err}");
            scanner::Categories::default()
        });
    let options = scanner::ScanOptions {
        categories: Arc::new(categories),
        ..Default::default()
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(scanner::ScanSessions::new(options))
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::list_drives,
            commands::start_scan,
            commands::cancel_scan,
            commands::get_children,
            commands::get_largest_files,
            commands::get_category_summary,
            commands::get_node_path,
            commands::reveal_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
