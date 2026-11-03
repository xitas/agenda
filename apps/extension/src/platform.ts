import type { ExtensionBridge, Platform, TokenStore } from '@agenda/core';
import { browser } from 'wxt/browser';
import { read, readSettings, write } from './storage';
import type { ExtensionSettings } from './storage';

/** The host-permission pattern for a server origin (Chrome's patterns cover every port). */
export function originPattern(serverUrl: string): string {
  const url = new URL(serverUrl);
  return `${url.protocol}//${url.hostname}/*`;
}

/** The session token, in chrome.storage.local (extension pages and the worker only). */
export const storageTokens: TokenStore = {
  get: () => read('token'),
  set: (token) => write('token', token),
  clear: () => write('token', null),
};

/** Messages from the pages to the service worker. */
export type WorkerMessage = { type: 'events-changed' } | { type: 'settings-changed' };

export function tellWorker(message: WorkerMessage): Promise<void> {
  // The worker may be asleep; sending a message wakes it. Nobody answering is fine.
  return browser.runtime.sendMessage(message).then(
    () => undefined,
    () => undefined,
  );
}

export function extensionBridge(): ExtensionBridge {
  return {
    settings: readSettings,
    async saveSettings(next: ExtensionSettings) {
      const before = await readSettings();
      if (next.serverUrl !== before.serverUrl) {
        // A token belongs to the server that issued it.
        await write('token', null);
        // Give back access to the old server, unless it is the default (always granted).
        const old = originPattern(before.serverUrl);
        if (old !== 'http://localhost/*') {
          await browser.permissions.remove({ origins: [old] }).catch(() => false);
        }
      }
      await write('settings', next);
      await tellWorker({ type: 'settings-changed' });
    },
    hasServerAccess: (serverUrl) =>
      browser.permissions.contains({ origins: [originPattern(serverUrl)] }),
    // Must run in a click handler: Chrome only shows the prompt for a user gesture.
    requestServerAccess: (serverUrl) =>
      browser.permissions.request({ origins: [originPattern(serverUrl)] }),
    requestNotifications: () => browser.permissions.request({ permissions: ['notifications'] }),
    eventsChanged: () => tellWorker({ type: 'events-changed' }),
    openTab: async (url) => {
      await browser.tabs.create({ url });
    },
  };
}

/** Blob downloads work in extension pages too; no "downloads" permission needed. */
function download({ name, mimeType, contents }: Parameters<Platform['saveFile']>[0]) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
  return Promise.resolve(true);
}

/** The extension's platform adapter (ARCHITECTURE.md §7). */
export async function createChromePlatform(): Promise<Platform> {
  const { serverUrl } = await readSettings();
  return {
    saveFile: download,
    auth: { kind: 'token', tokens: storageTokens },
    apiBaseUrl: serverUrl,
    extension: extensionBridge(),
  };
}
