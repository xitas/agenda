import { DEFAULT_SERVER_URL, DEFAULT_SHORTCUT } from '@agenda/core';
import type { DesktopBridge, DesktopSettings, Platform, TokenStore } from '@agenda/core';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

type Listeners = Record<
  'navigate' | 'eventsChanged' | 'quickAddOpen',
  Set<(value: string) => void>
>;

export interface FakeDesktop {
  /** Every function is a vi.fn, so tests can check calls and change answers. */
  desktop: {
    [K in keyof DesktopBridge]: DesktopBridge[K] extends (...args: infer A) => infer R
      ? Mock<(...args: A) => R>
      : DesktopBridge[K];
  };
  /** A desktop platform (token auth) around it, for renderApp. */
  platform: Platform & { auth: { kind: 'token'; tokens: TokenStore } };
  settings: DesktopSettings;
  /** Plays an event from Rust. */
  emit: (event: keyof Listeners, value?: string) => void;
  listeners: Listeners;
}

/** The desktop app's bridge, with every call a vi.fn and the events under test control. */
export function fakeDesktop(
  window: DesktopBridge['window'] = 'main',
  settings: Partial<DesktopSettings> = {},
): FakeDesktop {
  const current: DesktopSettings = {
    serverUrl: DEFAULT_SERVER_URL,
    shortcut: DEFAULT_SHORTCUT,
    launchAtLogin: false,
    ...settings,
  };
  const listeners: Listeners = {
    navigate: new Set(),
    eventsChanged: new Set(),
    quickAddOpen: new Set(),
  };
  const on = (name: keyof Listeners) => (listener: (value: string) => void) => {
    listeners[name].add(listener);
    return () => {
      listeners[name].delete(listener);
    };
  };
  const done = () => Promise.resolve();
  const desktop = {
    window,
    settings: vi.fn(() => Promise.resolve({ ...current })),
    setServerUrl: vi.fn(done),
    setShortcut: vi.fn((shortcut: string) => {
      current.shortcut = shortcut;
      return Promise.resolve();
    }),
    setLaunchAtLogin: vi.fn((enabled: boolean) => {
      current.launchAtLogin = enabled;
      return Promise.resolve();
    }),
    setTrayItems: vi.fn(done),
    setReminders: vi.fn(done),
    onNavigate: vi.fn(on('navigate')),
    eventsChanged: vi.fn(done),
    onEventsChanged: vi.fn(on('eventsChanged')),
    onQuickAddOpen: vi.fn(on('quickAddOpen')),
    hideQuickAdd: vi.fn(done),
    resizeQuickAdd: vi.fn(done),
    showMain: vi.fn(done),
  } satisfies DesktopBridge;
  const tokens = {
    get: vi.fn(() => Promise.resolve<string | null>('token')),
    set: vi.fn(done),
    clear: vi.fn(done),
  };
  return {
    desktop,
    platform: {
      saveFile: vi.fn(() => Promise.resolve(true)),
      auth: { kind: 'token', tokens },
      apiBaseUrl: current.serverUrl,
      desktop,
    },
    settings: current,
    emit: (name, value = '') => {
      for (const listener of listeners[name]) listener(value);
    },
    listeners,
  };
}
