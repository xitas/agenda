// Release builds are GUI apps on Windows: no console window next to Agenda.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! The Rust core of Agenda's desktop app. The webviews run the web app (apps/web); this
//! process owns everything native: windows, the tray, the global shortcut, notifications,
//! the credential store and the settings file. The webviews reach it only through the
//! commands registered below, and only those their capability allows.

mod files;
mod main_window;
mod quick_add;
mod reminders;
mod settings;
mod token;
mod tray;

use tauri_plugin_autostart::MacosLauncher;

fn main() {
    tauri::Builder::default()
        // First, so a second launch only focuses the running app and then exits.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            main_window::show(app, None);
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![settings::AUTOSTART_ARG]),
        ))
        .plugin(quick_add::shortcut_plugin())
        .manage(reminders::Reminders::default())
        .invoke_handler(tauri::generate_handler![
            token::token_get,
            token::token_set,
            token::token_clear,
            settings::desktop_settings,
            settings::set_server_url,
            settings::set_launch_at_login,
            quick_add::set_shortcut,
            quick_add::hide_quick_add,
            quick_add::resize_quick_add,
            tray::set_tray_items,
            reminders::set_reminders,
            files::save_file,
            main_window::show_main,
            main_window::events_changed,
        ])
        .setup(|app| {
            tray::create(app)?;
            quick_add::register_saved_shortcut(app.handle());
            reminders::start(app.handle().clone());
            // Launched at login: start in the tray. Otherwise show the window.
            if !std::env::args().any(|arg| arg == settings::AUTOSTART_ARG) {
                main_window::show(app.handle(), None);
            }
            Ok(())
        })
        .on_window_event(main_window::on_window_event)
        .run(tauri::generate_context!())
        .expect("error while running Agenda");
}

/// Commands return errors as plain text, which the web app shows as it is.
fn text_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}
