import { DEFAULT_SERVER_URL } from '@agenda/core';
import type {
  AgendaEvent,
  ExtensionSettings,
  ScheduledReminder,
  Settings,
  ShownReminders,
} from '@agenda/core';
import { browser } from 'wxt/browser';

/**
 * Everything the extension remembers, in chrome.storage.local. The service worker can be
 * stopped at any moment, so nothing lives only in memory: every handler reads what it
 * needs from here and writes back what changed. Only extension pages and the worker can
 * read this storage; there is no content script.
 */

export type { ExtensionSettings };

export const DEFAULT_WEB_URL = 'http://localhost:5173';

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  serverUrl: DEFAULT_SERVER_URL,
  webUrl: DEFAULT_WEB_URL,
  remindersInChrome: false,
};

/** What the worker fetched last, for the badge and reminders between refreshes. */
export interface EventCache {
  events: AgendaEvent[];
  /** The server's preferences (the clock for reminder text). */
  preferences: Settings | null;
  fetchedAt: number;
}

export interface Stored {
  settings: ExtensionSettings;
  token: string | null;
  cache: EventCache | null;
  schedule: ScheduledReminder[];
  shown: ShownReminders;
}

const DEFAULTS: Stored = {
  settings: DEFAULT_EXTENSION_SETTINGS,
  token: null,
  cache: null,
  schedule: [],
  shown: {},
};

export async function read<K extends keyof Stored>(key: K): Promise<Stored[K]> {
  const found = await browser.storage.local.get(key);
  // A missing key (or one the fake browser answers as undefined) means the default.
  return (found[key] as Stored[K] | undefined) ?? DEFAULTS[key];
}

export async function write<K extends keyof Stored>(key: K, value: Stored[K]): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function readSettings(): Promise<ExtensionSettings> {
  // Merged over the defaults, so a setting added later needs no migration.
  return { ...DEFAULT_EXTENSION_SETTINGS, ...(await read('settings')) };
}

/** Text selected on a page, waiting for its confirm window (session storage: never on disk). */
export const pendingKey = (id: string) => `pending:${id}`;

/** Takes the selected text left by the worker (and removes it: it is used once). */
export async function takePending(id: string): Promise<string> {
  const key = pendingKey(id);
  const found = await browser.storage.session.get(key);
  await browser.storage.session.remove(key);
  const text = found[key];
  return typeof text === 'string' ? text : '';
}
