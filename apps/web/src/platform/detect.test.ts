import { describe, expect, it, vi } from 'vitest';
import { webPlatform } from '../app/platform';
import { isTauri, loadPlatform } from './detect';

const tauriPlatform = { saveFile: vi.fn(), auth: { kind: 'token' }, apiBaseUrl: 'x' };
vi.mock('./tauri', () => ({ createTauriPlatform: vi.fn(() => Promise.resolve(tauriPlatform)) }));

describe('isTauri', () => {
  it('is true only where Tauri defined its internals', () => {
    expect(isTauri({})).toBe(false);
    expect(isTauri({ __TAURI_INTERNALS__: {} })).toBe(true);
    // The test runner is a browser-like page, not Tauri.
    expect(isTauri()).toBe(false);
  });
});

describe('loadPlatform', () => {
  it('gives the browser the web adapter: cookie auth, downloads', async () => {
    const platform = await loadPlatform({});
    expect(platform).toBe(webPlatform);
    expect(platform.auth).toEqual({ kind: 'cookie' });
    expect(platform.desktop).toBeUndefined();
  });

  it('loads the Tauri adapter inside Tauri', async () => {
    expect(await loadPlatform({ __TAURI_INTERNALS__: {} })).toBe(tauriPlatform);
  });
});
