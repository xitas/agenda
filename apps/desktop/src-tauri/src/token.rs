//! The session token, kept in the OS credential store (Windows Credential Manager, macOS
//! Keychain, Linux Secret Service) instead of the webview's localStorage, which is a plain
//! file on disk.

use keyring::{Entry, Error};

const SERVICE: &str = "Agenda";
const ACCOUNT: &str = "session-token";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(crate::text_error)
}

/// Removes the stored token; having none is fine too.
pub fn clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn token_get() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn token_set(token: String) -> Result<(), String> {
    entry()?.set_password(&token).map_err(crate::text_error)
}

#[tauri::command]
pub fn token_clear() -> Result<(), String> {
    clear()
}
