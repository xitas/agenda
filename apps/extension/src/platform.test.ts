import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createChromePlatform, originPattern, storageTokens, tellWorker } from './platform';
import { DEFAULT_EXTENSION_SETTINGS, read, readSettings, write } from './storage';
import type { ChromeExtras } from './test-utils/chrome';

const extras = () => fakeBrowser as unknown as ChromeExtras;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('originPattern', () => {
  it('asks for the server’s host, every port', () => {
    expect(originPattern('http://localhost:4001')).toBe('http://localhost/*');
    expect(originPattern('https://api.example.com')).toBe('https://api.example.com/*');
  });
});

describe('createChromePlatform', () => {
  it('uses a bearer token from extension storage against the Server URL', async () => {
    const platform = await createChromePlatform();
    expect(platform.auth.kind).toBe('token');
    expect(platform.apiBaseUrl).toBe('http://localhost:4001');
    expect(platform.desktop).toBeUndefined();
    await write('settings', {
      ...DEFAULT_EXTENSION_SETTINGS,
      serverUrl: 'https://api.example.com',
    });
    expect((await createChromePlatform()).apiBaseUrl).toBe('https://api.example.com');
  });

  it('keeps the token in chrome.storage.local', async () => {
    expect(await storageTokens.get()).toBeNull();
    await storageTokens.set('t0ken');
    expect(await fakeBrowser.storage.local.get('token')).toEqual({ token: 't0ken' });
    await storageTokens.clear();
    expect(await storageTokens.get()).toBeNull();
  });

  it('downloads exports through a Blob URL (no downloads permission)', async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:agenda/1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const platform = await createChromePlatform();
    expect(
      await platform.saveFile({ name: 'a.json', mimeType: 'application/json', contents: '[]' }),
    ).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:agenda/1');
    vi.useRealTimers();
  });
});

describe('the extension bridge', () => {
  const bridge = async () => {
    const { extension } = await createChromePlatform();
    if (extension === undefined) throw new Error('no extension bridge');
    return extension;
  };

  it('reads settings merged over the defaults', async () => {
    await fakeBrowser.storage.local.set({ settings: { serverUrl: 'https://api.example.com' } });
    expect(await (await bridge()).settings()).toEqual({
      ...DEFAULT_EXTENSION_SETTINGS,
      serverUrl: 'https://api.example.com',
    });
  });

  it('a new server logs out and gives back access to the old one (not the default)', async () => {
    const messages: unknown[] = [];
    fakeBrowser.runtime.onMessage.addListener((message) => {
      messages.push(message);
    });
    const ext = await bridge();
    await write('token', 'old');
    await ext.saveSettings({ ...DEFAULT_EXTENSION_SETTINGS, serverUrl: 'https://a.example.com' });
    expect(await read('token')).toBeNull();
    expect(extras().permissions.remove).not.toHaveBeenCalled();
    expect(messages).toEqual([{ type: 'settings-changed' }]);

    await write('token', 'a');
    await ext.saveSettings({ ...DEFAULT_EXTENSION_SETTINGS, serverUrl: 'https://b.example.com' });
    expect(extras().permissions.remove).toHaveBeenCalledWith({
      origins: ['https://a.example.com/*'],
    });

    // Same server, other settings: still logged in.
    await write('token', 'b');
    await ext.saveSettings({ ...(await readSettings()), webUrl: 'https://agenda.example.com' });
    expect(await read('token')).toBe('b');
  });

  it('checks and asks for host access and notifications', async () => {
    const ext = await bridge();
    expect(await ext.hasServerAccess('http://localhost:4001')).toBe(true);
    expect(await ext.hasServerAccess('https://api.example.com')).toBe(false);
    expect(await ext.requestServerAccess('https://api.example.com')).toBe(true);
    expect(await ext.hasServerAccess('https://api.example.com')).toBe(true);
    expect(await ext.requestNotifications()).toBe(true);
    expect(extras().permissions.request).toHaveBeenLastCalledWith({
      permissions: ['notifications'],
    });
  });

  it('opens tabs, and tells the worker about changes even when it sleeps', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    const ext = await bridge();
    await ext.openTab('http://localhost:5173');
    expect(create).toHaveBeenCalledWith({ url: 'http://localhost:5173' });
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockRejectedValueOnce(new Error('no receiver'));
    await expect(tellWorker({ type: 'events-changed' })).resolves.toBeUndefined();
    await expect(ext.eventsChanged()).resolves.toBeUndefined();
  });
});
