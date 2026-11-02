//! This device's settings: the server it talks to, the quick-add shortcut, and launch at
//! login. The shared preferences (theme, week start, clock) live on the server instead.

use crate::{quick_add, token};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;

/// A JSON file in the app's data folder (%APPDATA%\io.github.xitas.agenda on Windows).
const STORE: &str = "desktop.json";
pub const DEFAULT_SERVER_URL: &str = "http://localhost:4001";
pub const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+Space";
/// Passed by the login item, so the app starts hidden in the tray.
pub const AUTOSTART_ARG: &str = "--autostart";

const SERVER_URL_KEY: &str = "serverUrl";
const SHORTCUT_KEY: &str = "shortcut";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    server_url: String,
    shortcut: String,
    launch_at_login: bool,
}

fn read(app: &AppHandle, key: &str, default: &str) -> String {
    app.store(STORE)
        .ok()
        .and_then(|store| store.get(key))
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_else(|| default.to_owned())
}

fn write(app: &AppHandle, key: &str, value: &str) -> Result<(), String> {
    let store = app.store(STORE).map_err(crate::text_error)?;
    store.set(key, value);
    store.save().map_err(crate::text_error)
}

pub fn server_url(app: &AppHandle) -> String {
    read(app, SERVER_URL_KEY, DEFAULT_SERVER_URL)
}

pub fn shortcut(app: &AppHandle) -> String {
    read(app, SHORTCUT_KEY, DEFAULT_SHORTCUT)
}

pub fn save_shortcut(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    write(app, SHORTCUT_KEY, shortcut)
}

/// The web app normalizes the URL (core's normalizeServerUrl); this is the last check
/// before it is stored: an http(s) origin, nothing more.
pub fn is_server_url(url: &str) -> bool {
    let rest = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"));
    match rest {
        Some(host) => !host.is_empty() && !host.contains(['/', '?', '#', '@', ' ']),
        None => false,
    }
}

#[tauri::command]
pub fn desktop_settings(app: AppHandle) -> DesktopSettings {
    DesktopSettings {
        server_url: server_url(&app),
        shortcut: shortcut(&app),
        launch_at_login: app.autolaunch().is_enabled().unwrap_or(false),
    }
}

/// A token belongs to the server that issued it, so a new server means logging in again.
/// The quick-add window reloads to use the new server; the main window reloads itself.
#[tauri::command]
pub fn set_server_url(app: AppHandle, url: String) -> Result<(), String> {
    if !is_server_url(&url) {
        return Err(format!("{url} isn't a server address."));
    }
    if url == server_url(&app) {
        return Ok(());
    }
    write(&app, SERVER_URL_KEY, &url)?;
    token::clear()?;
    if let Some(window) = app.get_webview_window(quick_add::LABEL) {
        let _ = window.reload();
    }
    Ok(())
}

#[tauri::command]
pub fn set_launch_at_login(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    let result = if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    };
    result.map_err(crate::text_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_http_origins() {
        assert!(is_server_url("http://localhost:4001"));
        assert!(is_server_url("https://api.agenda.example"));
        assert!(!is_server_url("localhost:4001"));
        assert!(!is_server_url("http://"));
        assert!(!is_server_url("https://api.example/v1"));
        assert!(!is_server_url("http://user@evil.example"));
        assert!(!is_server_url("file:///C:/Windows"));
    }
}
