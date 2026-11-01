# @agenda/desktop

Agenda for Windows (and later macOS and Linux), built with [Tauri 2](https://tauri.app). The window shows the web app from `apps/web`: the Vite dev server in dev, its built `dist/` in the installer. Everything native lives in the Rust core in `src-tauri/`: the tray, the global quick-add shortcut, reminder notifications, launch at login, the credential store and the device settings.

## Requirements

- Everything the web app needs (Node, pnpm via Corepack).
- Rust through [rustup](https://rustup.rs), with the MSVC toolchain on Windows (`rustup default stable-msvc`). `src-tauri/rust-toolchain.toml` pins the exact version; rustup installs it on first use.
- On Windows, the Visual Studio Build Tools with "Desktop development with C++" (the MSVC linker and Windows SDK). The WebView2 runtime comes with Windows 11; the installer fetches it on older systems.

## Commands

```sh
pnpm dev                                # the API on :4001 (and web on :5173), in one terminal
pnpm --filter @agenda/desktop dev       # the desktop app, in another
pnpm desktop:installer                  # builds web, then the NSIS installer
pnpm --filter @agenda/desktop rust:check  # cargo fmt --check and clippy -D warnings
pnpm --filter @agenda/desktop rust:test   # Rust unit tests
pnpm --filter @agenda/desktop icons     # app icons from apps/web/public/icon.svg (commit them)
```

`dev` builds the packages web needs, then runs `tauri dev`. That starts the web dev server on port **5174** (so it can run next to `pnpm dev` on 5173), compiles the Rust core, and opens the window. Rust changes rebuild and restart the app; web changes hot-reload as in the browser. The first build compiles about 500 crates and takes a few minutes.

The installer ends up in `src-tauri/target/release/bundle/nsis/Agenda_<version>_x64-setup.exe`. It installs for the current user, without admin rights. It is not code-signed yet (see docs/PLAN.md), so Windows SmartScreen says "Windows protected your PC": choose **More info → Run anyway**. With Smart App Control turned on, Windows blocks unsigned installers outright.

## Connecting to the API

The app talks to `http://localhost:4001` until you change the **Server URL** (Settings → This computer, or the link on the login and "Can't reach" screens). Its pages run on `http://tauri.localhost` (`http://localhost:5174` in dev), a different site from the API, so:

- it logs in as a **token** client (`client: 'token'`) and sends `Authorization: Bearer`. A token is never attached by the browser on its own, so these requests skip the API's CSRF Origin check;
- the API must still allow its origin for **CORS**: `apps/api/.env.example` lists `http://localhost:5174`, `http://tauri.localhost` and `tauri://localhost` in `CORS_ORIGINS`. Copy that line into your `apps/api/.env`.

The token is kept in **Windows Credential Manager** (macOS Keychain, Linux Secret Service) through the `keyring` crate, not in the webview's `localStorage`, which is a plain file under AppData. Device settings (server, shortcut) are in `%APPDATA%\io.github.xitas.agenda\desktop.json`.

## How the pieces fit

- **Two windows, one web app.** `main` shows the app; `quick-add` (560 × 72, no frame, always on top) shows the `/quick-add` page. Both are hidden at start; the main window is shown unless the app was started at login (`--autostart`). Closing the main window hides it: the app keeps running in the tray.
- **The web code never imports Tauri.** `apps/web/src/platform/detect.ts` checks for Tauri and loads `platform/tauri.ts`, the only file allowed to import `@tauri-apps/api` (an ESLint rule enforces it). Everything else uses the `Platform` adapter from `packages/core`.
- **Data stays in the web app.** The main window fetches the events (TanStack Query, refreshed every 5 minutes, even in the tray) and turns them into tray lines and a reminder schedule with core's `trayItems` and `reminderSchedule`. Rust only shows the menu and times the notifications: a hidden webview's timers are slowed to about once a minute.
- **Reminders fire once.** Each has a key (event id, offset, start). Rust keeps the keys it has shown in `reminders.json`, so a restart doesn't repeat them, and a moved event gets new keys. A reminder more than 5 minutes late (the PC was off or asleep) is skipped.

## Permissions (capabilities)

The pages can call only the commands their window's capability lists (`src-tauri/capabilities/`). Every plugin is used from Rust, so the pages get **no plugin permissions**: no file system, no shell, no arbitrary notifications. `build.rs` lists the app's commands, which makes Tauri generate one `allow-<command>` permission each, and refuse any command a capability doesn't name.

| Permission                                       | Window    | Why                                                                 |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------- |
| `core:event:allow-listen`, `allow-unlisten`      | both      | Receive "navigate", "events-changed" and "quick-add-open" from Rust |
| `allow-token-get`, `allow-token-clear`           | both      | Read the session token; forget it after a 401                       |
| `allow-token-set`                                | main      | Store the token after logging in                                    |
| `allow-desktop-settings`                         | both      | Read the Server URL (both windows call the API) and the shortcut    |
| `allow-set-server-url`, `allow-set-shortcut`     | main      | The desktop settings dialog                                         |
| `allow-set-launch-at-login`                      | main      | The "open at login" checkbox                                        |
| `allow-set-tray-items`, `allow-set-reminders`    | main      | Keep the tray menu and the reminder schedule up to date             |
| `allow-save-file`                                | main      | Exports: Rust shows the save dialog and writes the file             |
| `allow-events-changed`                           | quick-add | Tell the main window to refetch after a quick add                   |
| `allow-hide-quick-add`, `allow-resize-quick-add` | quick-add | Close on Esc or after saving; grow to fit the preview               |
| `allow-show-main`                                | quick-add | "Open Agenda" (to log in) from the popup                            |

Capabilities apply to the app's own pages only. A remote page, if one were ever loaded, could call nothing.

## Dependencies

| Crate / package                | Why                                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| `tauri`, `tauri-build`         | The framework: windows, webviews, tray, IPC, and the build-time ACL   |
| `tauri-plugin-global-shortcut` | Ctrl+Shift+Space anywhere in Windows opens quick add                  |
| `tauri-plugin-notification`    | Reminder toasts in the Windows notification center                    |
| `tauri-plugin-autostart`       | Launch at login (the registry Run key on Windows)                     |
| `tauri-plugin-single-instance` | A second launch focuses the running app instead of a second tray icon |
| `tauri-plugin-store`           | Small JSON files for device settings and the reminders already shown  |
| `tauri-plugin-dialog`          | The native save dialog for exports (called from Rust only)            |
| `keyring`                      | The OS credential store for the session token                         |
| `serde`, `serde_json`          | The data passed between the pages and Rust                            |
| `@tauri-apps/cli` (npm)        | `tauri dev`, `tauri build`, `tauri icon`                              |
| `@tauri-apps/api` (npm, web)   | `invoke` and `listen`, used only by `apps/web/src/platform/tauri.ts`  |

### Updating Rust dependencies

New releases are only taken once they are at least two weeks old, like the npm packages. Cargo can filter by publish date behind an unstable flag; `RUSTC_BOOTSTRAP=1` lets the stable toolchain use it, only to write the lockfile:

```sh
cd apps/desktop/src-tauri
RUSTC_BOOTSTRAP=1 cargo -Z min-publish-age --config 'registry.global-min-publish-age="14 days"' update
```

Commit `Cargo.lock`; CI builds with `--locked`.
