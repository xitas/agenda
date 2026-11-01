import { emit } from '@tauri-apps/api/event';
import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTauriPlatform, keychainTokens } from './tauri';

type Calls = [string, unknown][];

/** Fakes the Rust side: records each command and answers like the desktop app does. */
function fakeRust(answers: Record<string, unknown> = {}): Calls {
  const calls: Calls = [];
  mockIPC(
    (cmd, payload) => {
      calls.push([cmd, payload]);
      if (cmd in answers) return answers[cmd];
      if (cmd === 'desktop_settings') {
        return {
          serverUrl: 'http://localhost:4001',
          shortcut: 'Ctrl+Shift+Space',
          launchAtLogin: false,
        };
      }
      return null;
    },
    { shouldMockEvents: true },
  );
  return calls;
}

const commands = (calls: Calls) =>
  calls.map(([cmd]) => cmd).filter((cmd) => !cmd.startsWith('plugin:event'));

beforeEach(() => {
  mockWindows('main');
});

afterEach(() => {
  clearMocks();
});

describe('createTauriPlatform', () => {
  it('uses a bearer token against the configured server', async () => {
    fakeRust();
    const platform = await createTauriPlatform();
    expect(platform.apiBaseUrl).toBe('http://localhost:4001');
    expect(platform.auth.kind).toBe('token');
    expect(platform.desktop?.window).toBe('main');
  });

  it('knows when it runs in the quick-add window', async () => {
    mockWindows('quick-add', 'main');
    fakeRust();
    expect((await createTauriPlatform()).desktop?.window).toBe('quick-add');
  });

  it('calls the desktop commands with their arguments', async () => {
    const calls = fakeRust({ save_file: true });
    const { desktop, saveFile } = await createTauriPlatform();
    if (desktop === undefined) throw new Error('no desktop bridge');
    const file = { name: 'agenda.json', mimeType: 'application/json', contents: '[]' };
    expect(await saveFile(file)).toBe(true);
    await desktop.setServerUrl('https://api.example.com');
    await desktop.setShortcut('Alt+KeyA');
    await desktop.setLaunchAtLogin(true);
    await desktop.setTrayItems([{ label: 'Today, 15:00 · Call Ali', path: '/day/2026-11-02' }]);
    await desktop.setReminders([{ key: 'k', atMs: 5, title: 'Call Ali', body: 'Today, 15:00' }]);
    await desktop.eventsChanged();
    await desktop.hideQuickAdd();
    await desktop.resizeQuickAdd(140);
    await desktop.showMain('/login');
    await desktop.showMain();
    expect(calls.slice(1)).toEqual([
      ['save_file', { file }],
      ['set_server_url', { url: 'https://api.example.com' }],
      ['set_shortcut', { shortcut: 'Alt+KeyA' }],
      ['set_launch_at_login', { enabled: true }],
      [
        'set_tray_items',
        { items: [{ label: 'Today, 15:00 · Call Ali', path: '/day/2026-11-02' }] },
      ],
      [
        'set_reminders',
        { reminders: [{ key: 'k', atMs: 5, title: 'Call Ali', body: 'Today, 15:00' }] },
      ],
      ['events_changed', {}],
      ['hide_quick_add', {}],
      ['resize_quick_add', { height: 140 }],
      ['show_main', { path: '/login' }],
      ['show_main', { path: null }],
    ]);
  });

  it('passes events from Rust to listeners until they stop listening', async () => {
    fakeRust();
    const { desktop } = await createTauriPlatform();
    if (desktop === undefined) throw new Error('no desktop bridge');
    const navigate = vi.fn();
    const changed = vi.fn();
    const opened = vi.fn();
    const stopNavigate = desktop.onNavigate(navigate);
    desktop.onEventsChanged(changed);
    desktop.onQuickAddOpen(opened);
    // listen() resolves after a round trip; wait for it before emitting.
    await vi.waitFor(async () => {
      await emit('navigate', '/day/2026-11-02');
      expect(navigate).toHaveBeenCalledWith('/day/2026-11-02');
    });
    await emit('navigate', 42);
    await emit('events-changed');
    await emit('quick-add-open');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalled();
    expect(opened).toHaveBeenCalled();
    stopNavigate();
    await emit('navigate', '/week');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('stops a listener even when asked before listening began', async () => {
    fakeRust();
    const { desktop } = await createTauriPlatform();
    const listener = vi.fn();
    desktop?.onEventsChanged(listener)();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await emit('events-changed');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('keychainTokens', () => {
  it('reads the keychain once a token is found, and writes through', async () => {
    const calls = fakeRust({ token_get: 'stored-token' });
    const tokens = keychainTokens();
    expect(await tokens.get()).toBe('stored-token');
    expect(await tokens.get()).toBe('stored-token');
    await tokens.set('new-token');
    expect(await tokens.get()).toBe('new-token');
    await tokens.clear();
    expect(commands(calls)).toEqual(['token_get', 'token_set', 'token_clear']);
    expect(calls[1]).toEqual(['token_set', { token: 'new-token' }]);
  });

  it('asks again while there is no token, so a login in the other window is found', async () => {
    const answers: Record<string, unknown> = { token_get: null };
    const calls = fakeRust(answers);
    const tokens = keychainTokens();
    expect(await tokens.get()).toBeNull();
    answers.token_get = 'from-main-window';
    expect(await tokens.get()).toBe('from-main-window');
    expect(commands(calls)).toEqual(['token_get', 'token_get']);
  });
});
