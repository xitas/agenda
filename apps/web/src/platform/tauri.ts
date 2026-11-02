import type {
  DesktopBridge,
  DesktopSettings,
  Platform,
  TokenStore,
  Unsubscribe,
} from '@agenda/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

// The only file in the web app that imports Tauri (an ESLint rule keeps it that way).
// Every call is one of the desktop app's own commands (apps/desktop/src-tauri); which
// of them a window may call is set by its capability file there.

/** Listens to an event from Rust; stopping works even before listen() has resolved. */
function subscribe(event: string, listener: (payload: unknown) => void): Unsubscribe {
  let stopped = false;
  let unlisten: (() => void) | undefined;
  void listen(event, ({ payload }) => {
    listener(payload);
  }).then((stop) => {
    if (stopped) stop();
    else unlisten = stop;
  });
  return () => {
    stopped = true;
    unlisten?.();
  };
}

/**
 * The token lives in the OS credential store. Once found it is kept in memory, so most
 * requests don't ask Rust for it. "No token" is not kept: the other window may log in
 * meanwhile, and the next request should find that token.
 */
export function keychainTokens(): TokenStore {
  let token: string | null = null;
  return {
    get: async () => (token ??= await invoke<string | null>('token_get')),
    set: async (next) => {
      await invoke('token_set', { token: next });
      token = next;
    },
    clear: async () => {
      token = null;
      await invoke('token_clear');
    },
  };
}

export function desktopBridge(): DesktopBridge {
  return {
    window: getCurrentWindow().label === 'quick-add' ? 'quick-add' : 'main',
    settings: () => invoke<DesktopSettings>('desktop_settings'),
    setServerUrl: (url) => invoke('set_server_url', { url }),
    setShortcut: (shortcut) => invoke('set_shortcut', { shortcut }),
    setLaunchAtLogin: (enabled) => invoke('set_launch_at_login', { enabled }),
    setTrayItems: (items) => invoke('set_tray_items', { items }),
    setReminders: (reminders) => invoke('set_reminders', { reminders }),
    onNavigate: (listener) =>
      subscribe('navigate', (path) => {
        if (typeof path === 'string') listener(path);
      }),
    eventsChanged: () => invoke('events_changed'),
    onEventsChanged: (listener) => subscribe('events-changed', listener),
    onQuickAddOpen: (listener) => subscribe('quick-add-open', listener),
    hideQuickAdd: () => invoke('hide_quick_add'),
    resizeQuickAdd: (height) => invoke('resize_quick_add', { height }),
    showMain: (path) => invoke('show_main', { path: path ?? null }),
  };
}

/**
 * The desktop app's adapter: a bearer token against the server set in the desktop
 * settings (absolute URLs, no dev proxy), and a native save dialog for exports.
 */
export async function createTauriPlatform(): Promise<Platform> {
  const desktop = desktopBridge();
  const { serverUrl } = await desktop.settings();
  return {
    saveFile: (file) => invoke<boolean>('save_file', { file }),
    auth: { kind: 'token', tokens: keychainTokens() },
    apiBaseUrl: serverUrl,
    desktop,
  };
}
