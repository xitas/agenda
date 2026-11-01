//! The global shortcut and the quick-add window it opens: a 560 px popup with no frame
//! (DESIGN.md §4) that shows the web app's /quick-add page.

use crate::settings;
use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const LABEL: &str = "quick-add";
const WIDTH: f64 = 560.0;
/// The field alone is 72 px tall; the page asks for more while it shows its preview.
const MIN_HEIGHT: f64 = 72.0;
const MAX_HEIGHT: f64 = 480.0;

/// Pressing the shortcut anywhere in the OS opens the window, or closes it if it is open.
pub fn shortcut_plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle(app);
            }
        })
        .build()
}

/// At startup. If another app holds the shortcut, Agenda still starts; the desktop
/// settings dialog lets the user pick another one.
pub fn register_saved_shortcut(app: &AppHandle) {
    let saved = settings::shortcut(app);
    if let Ok(shortcut) = saved.parse::<Shortcut>()
        && let Err(error) = app.global_shortcut().register(shortcut)
    {
        eprintln!("Couldn't register the quick-add shortcut {saved}: {error}");
    }
}

pub fn open(app: &AppHandle) {
    let Some(window) = app.get_webview_window(LABEL) else {
        return;
    };
    let _ = window.set_size(LogicalSize::new(WIDTH, MIN_HEIGHT));
    let _ = window.center();
    let _ = window.show();
    let _ = window.set_focus();
    // The page clears its field and focuses it.
    let _ = app.emit_to(LABEL, "quick-add-open", ());
}

pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.hide();
    }
}

fn toggle(app: &AppHandle) {
    let visible = app
        .get_webview_window(LABEL)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);
    if visible { hide(app) } else { open(app) }
}

/// The new shortcut is registered before the old one is let go, so a shortcut that is
/// taken leaves the working one in place.
#[tauri::command]
pub fn set_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    let new: Shortcut = shortcut
        .parse()
        .map_err(|_| format!("{shortcut} can't be used as a shortcut. Try another."))?;
    let old = settings::shortcut(&app);
    if old == shortcut {
        return Ok(());
    }
    let manager = app.global_shortcut();
    manager
        .register(new)
        .map_err(|_| format!("{shortcut} is already used by another app. Try another."))?;
    if let Ok(old) = old.parse::<Shortcut>() {
        let _ = manager.unregister(old);
    }
    settings::save_shortcut(&app, &shortcut)
}

#[tauri::command]
pub fn hide_quick_add(app: AppHandle) {
    hide(&app);
}

#[tauri::command]
pub fn resize_quick_add(app: AppHandle, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window(LABEL)
        .ok_or("The quick-add window is missing")?;
    window
        .set_size(LogicalSize::new(
            WIDTH,
            height.clamp(MIN_HEIGHT, MAX_HEIGHT),
        ))
        .map_err(crate::text_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The web app writes shortcuts with core's shortcutFromKeys; each form must parse.
    #[test]
    fn parses_the_shortcuts_the_web_app_writes() {
        for text in [
            settings::DEFAULT_SHORTCUT,
            "Alt+KeyA",
            "Ctrl+Alt+Digit1",
            "Super+Shift+F5",
            "Ctrl+ArrowUp",
            "Ctrl+Shift+Comma",
        ] {
            assert!(text.parse::<Shortcut>().is_ok(), "{text}");
        }
        assert!("Ctrl+".parse::<Shortcut>().is_err());
    }
}
