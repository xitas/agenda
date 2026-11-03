/**
 * The platform adapter (ARCHITECTURE.md §7): what differs between the web app, the
 * desktop app (Tauri), the extension and mobile. Shared code only sees this interface;
 * each app passes its own implementation.
 */

/** A text file to give the user, such as an export. */
export interface SaveFileRequest {
  /** Suggested file name, e.g. "agenda-2026-10-29.json". */
  name: string;
  /** e.g. "application/json" or "text/calendar". */
  mimeType: string;
  contents: string;
}

/** Where a token client keeps its session token (the OS keychain on desktop). */
export interface TokenStore {
  get: () => Promise<string | null>;
  set: (token: string) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * How the app authenticates: the web app with the session cookie, every other platform
 * with a bearer token it keeps itself (ARCHITECTURE.md §5).
 */
export type PlatformAuth = { kind: 'cookie' } | { kind: 'token'; tokens: TokenStore };

/** One line of the tray menu; with a path it opens the app there. */
export interface TrayItem {
  label: string;
  path?: string;
}

/** A reminder to show at `atMs` (milliseconds since 1970, UTC). */
export interface ScheduledReminder {
  /** Event id, offset and start: a moved event's reminders get new keys. */
  key: string;
  atMs: number;
  title: string;
  body: string;
}

/** This device's own settings (the shared preferences live on the server). */
export interface DesktopSettings {
  serverUrl: string;
  /** In the accelerator form shortcutFromKeys writes, e.g. "Ctrl+Shift+Space". */
  shortcut: string;
  launchAtLogin: boolean;
}

/** Stops listening. */
export type Unsubscribe = () => void;

/** What only the desktop app has: its windows, tray, shortcut and reminders. */
export interface DesktopBridge {
  /** Which window this page is in. */
  window: 'main' | 'quick-add';
  settings: () => Promise<DesktopSettings>;
  /** Stores the URL and logs out (a token belongs to its server); the caller reloads. */
  setServerUrl: (url: string) => Promise<void>;
  /** Rejects with a message to show when the shortcut is taken or not supported. */
  setShortcut: (shortcut: string) => Promise<void>;
  setLaunchAtLogin: (enabled: boolean) => Promise<void>;
  setTrayItems: (items: TrayItem[]) => Promise<void>;
  /** Replaces every scheduled reminder. */
  setReminders: (reminders: ScheduledReminder[]) => Promise<void>;
  /** The tray asks the main window to show a page. */
  onNavigate: (listener: (path: string) => void) => Unsubscribe;
  /** Tells the main window that another window changed events. */
  eventsChanged: () => Promise<void>;
  onEventsChanged: (listener: () => void) => Unsubscribe;
  /** The quick-add window was opened by the shortcut or the tray. */
  onQuickAddOpen: (listener: () => void) => Unsubscribe;
  hideQuickAdd: () => Promise<void>;
  /** The quick-add window grows to fit its preview. */
  resizeQuickAdd: (height: number) => Promise<void>;
  /** Shows the main window, optionally on a page. */
  showMain: (path?: string) => Promise<void>;
}

/** The Chrome extension's own settings (the shared preferences live on the server). */
export interface ExtensionSettings {
  /** The API, e.g. http://localhost:4001. */
  serverUrl: string;
  /** What "Open full Agenda" opens, e.g. http://localhost:5173. */
  webUrl: string;
  /** Off by default, so reminders don't show twice while the desktop app runs. */
  remindersInChrome: boolean;
}

/** What only the Chrome extension has: its settings, permissions and service worker. */
export interface ExtensionBridge {
  settings: () => Promise<ExtensionSettings>;
  /** Stores them; a new server also logs out (a token belongs to its server). */
  saveSettings: (settings: ExtensionSettings) => Promise<void>;
  /** Whether the extension may call this server (a host permission). */
  hasServerAccess: (serverUrl: string) => Promise<boolean>;
  /** Asks Chrome for access to this server; only works from a click. */
  requestServerAccess: (serverUrl: string) => Promise<boolean>;
  /** Asks for the notifications permission; only works from a click. */
  requestNotifications: () => Promise<boolean>;
  /** Tells the service worker that events changed (badge, reminders). */
  eventsChanged: () => Promise<void>;
  openTab: (url: string) => Promise<void>;
}

export interface Platform {
  /**
   * Hands a file to the user: a download on the web, a native save dialog on desktop.
   * Resolves to false if the user cancelled (a dialog can be cancelled; a download can't).
   */
  saveFile: (file: SaveFileRequest) => Promise<boolean>;
  auth: PlatformAuth;
  /** The API origin; '' means the page's own origin (the web app's dev proxy). */
  apiBaseUrl: string;
  /** Only in the desktop app. */
  desktop?: DesktopBridge;
  /** Only in the Chrome extension. */
  extension?: ExtensionBridge;
}
