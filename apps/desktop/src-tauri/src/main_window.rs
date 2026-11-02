//! The main window: shown from the tray, hidden (not closed) by its close button, so the
//! app keeps running in the tray with its reminders and shortcut.

use crate::quick_add;
use tauri::{AppHandle, Emitter, Manager, Window, WindowEvent};

pub const LABEL: &str = "main";

/// Brings the main window to the front, optionally on a page ("/day/2026-11-02").
pub fn show(app: &AppHandle, path: Option<&str>) {
    let Some(window) = app.get_webview_window(LABEL) else {
        return;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    if let Some(path) = path {
        let _ = app.emit_to(LABEL, "navigate", path);
    }
}

pub fn on_window_event(window: &Window, event: &WindowEvent) {
    match (window.label(), event) {
        (LABEL, WindowEvent::CloseRequested { api, .. }) => {
            api.prevent_close();
            let _ = window.hide();
        }
        // The quick-add window is a popup: clicking anywhere else dismisses it.
        (quick_add::LABEL, WindowEvent::Focused(false)) => {
            let _ = window.hide();
        }
        _ => {}
    }
}

/// From the quick-add window: "Open Agenda" (for example to log in).
#[tauri::command]
pub fn show_main(app: AppHandle, path: Option<String>) {
    quick_add::hide(&app);
    show(&app, path.as_deref());
}

/// From the quick-add window after a save: the main window refetches its events.
#[tauri::command]
pub fn events_changed(app: AppHandle) -> Result<(), String> {
    app.emit_to(LABEL, "events-changed", ())
        .map_err(crate::text_error)
}
