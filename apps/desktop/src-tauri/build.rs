// Every command the webview may call is listed here. tauri-build then generates one
// permission per command ("allow-token-get", ...), and a window can only call the ones
// its capability in capabilities/ names. Without this list, every command is allowed.
const COMMANDS: &[&str] = &[
    "token_get",
    "token_set",
    "token_clear",
    "desktop_settings",
    "set_server_url",
    "set_launch_at_login",
    "set_shortcut",
    "set_tray_items",
    "set_reminders",
    "save_file",
    "show_main",
    "events_changed",
    "hide_quick_add",
    "resize_quick_add",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
