//! Saving an export: a native save dialog, then the file is written here in Rust, so the
//! webview needs no file-system or dialog permission of its own.

use serde::Deserialize;
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// The web app's SaveFileRequest (core's platform.ts).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileRequest {
    name: String,
    mime_type: String,
    contents: String,
}

/// "JSON file" or "Calendar file" in the dialog's type list, by MIME type.
fn filter_name(mime_type: &str) -> &'static str {
    match mime_type {
        "application/json" => "JSON file",
        "text/calendar" => "Calendar file",
        _ => "File",
    }
}

/// Resolves to false when the user cancels the dialog.
#[tauri::command]
pub async fn save_file(app: AppHandle, file: SaveFileRequest) -> Result<bool, String> {
    // The dialog blocks until it closes, so it runs off the async runtime's threads.
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_file_name(&file.name);
        if let Some(extension) = Path::new(&file.name).extension().and_then(|e| e.to_str()) {
            dialog = dialog.add_filter(filter_name(&file.mime_type), &[extension]);
        }
        let Some(path) = dialog.blocking_save_file() else {
            return Ok(false);
        };
        let path = path.into_path().map_err(crate::text_error)?;
        std::fs::write(path, file.contents).map_err(crate::text_error)?;
        Ok(true)
    })
    .await
    .map_err(crate::text_error)?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_file_type() {
        assert_eq!(filter_name("application/json"), "JSON file");
        assert_eq!(filter_name("text/calendar"), "Calendar file");
        assert_eq!(filter_name("text/plain"), "File");
    }
}
