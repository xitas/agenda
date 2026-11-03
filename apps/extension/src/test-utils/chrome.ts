import { vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

/**
 * WXT's fake browser keeps storage, alarms, the badge, notifications, runtime messages,
 * tabs and windows in memory. These are the APIs it doesn't have, as recorders.
 */
export interface ChromeExtras {
  contextMenus: {
    create: ReturnType<typeof vi.fn>;
    removeAll: ReturnType<typeof vi.fn>;
    onClicked: { addListener: ReturnType<typeof vi.fn> };
  };
  permissions: {
    /** Origin patterns granted so far; http://localhost/* is granted at install. */
    granted: Set<string>;
    contains: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    /** What the next request answers (the user clicking Allow or Deny). */
    answer: boolean;
  };
  sidePanel: { open: ReturnType<typeof vi.fn> };
}

export function installChromeExtras(): ChromeExtras {
  const granted = new Set(['http://localhost/*']);
  const permissions = {
    granted,
    answer: true,
    contains: vi.fn(({ origins = [] }: { origins?: string[] }) =>
      Promise.resolve(origins.every((origin) => granted.has(origin))),
    ),
    request: vi.fn(
      ({
        origins = [],
        permissions: names = [],
      }: {
        origins?: string[];
        permissions?: string[];
      }) => {
        if (permissions.answer) for (const item of [...origins, ...names]) granted.add(item);
        return Promise.resolve(permissions.answer);
      },
    ),
    remove: vi.fn(({ origins = [] }: { origins?: string[] }) => {
      for (const origin of origins) granted.delete(origin);
      return Promise.resolve(true);
    }),
  };
  const extras: ChromeExtras = {
    contextMenus: {
      create: vi.fn(),
      removeAll: vi.fn(() => Promise.resolve()),
      onClicked: { addListener: vi.fn() },
    },
    permissions,
    sidePanel: { open: vi.fn(() => Promise.resolve()) },
  };
  Object.assign(fakeBrowser, extras);
  return extras;
}
