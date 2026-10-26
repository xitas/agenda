import { describe, expect, it, vi } from 'vitest';
import { applyTheme, readTheme, THEME_STORAGE_KEY } from './theme';

describe('theme', () => {
  it('reads light or dark, and treats anything else as system', () => {
    expect(readTheme()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readTheme()).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readTheme()).toBe('system');
  });

  it('applies and stores a choice', () => {
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    applyTheme('system', root);
    expect(root.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('still works when storage is blocked', () => {
    const throwing = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: vi.fn(),
    };
    expect(readTheme(throwing)).toBe('system');
    const root = document.createElement('html');
    expect(() => {
      applyTheme('light', root, throwing);
    }).not.toThrow();
    expect(root.dataset.theme).toBe('light');
  });

  it('copes with no storage at all', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readTheme()).toBe('system');
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    vi.restoreAllMocks();
  });
});
