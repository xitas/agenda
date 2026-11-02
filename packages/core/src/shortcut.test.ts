import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUT, SHORTCUT_MESSAGES, shortcutFromKeys, shortcutKeys } from './shortcut.js';
import type { KeyPress } from './shortcut.js';

const press = (code: string, mods: Partial<KeyPress> = {}): KeyPress => ({
  key: code,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe('shortcutFromKeys', () => {
  it('writes the accelerator Tauri reads, modifiers in a fixed order', () => {
    expect(shortcutFromKeys(press('Space', { ctrlKey: true, shiftKey: true }))).toEqual({
      ok: true,
      shortcut: DEFAULT_SHORTCUT,
    });
    expect(
      shortcutFromKeys(
        press('KeyA', { metaKey: true, shiftKey: true, altKey: true, ctrlKey: true }),
      ),
    ).toEqual({ ok: true, shortcut: 'Ctrl+Alt+Shift+Super+KeyA' });
    expect(shortcutFromKeys(press('F5', { altKey: true }))).toEqual({
      ok: true,
      shortcut: 'Alt+F5',
    });
    expect(shortcutFromKeys(press('Comma', { ctrlKey: true }))).toEqual({
      ok: true,
      shortcut: 'Ctrl+Comma',
    });
  });

  it('keeps listening while only modifiers are down', () => {
    expect(shortcutFromKeys(press('ControlLeft', { ctrlKey: true }))).toBeNull();
    expect(shortcutFromKeys(press('ShiftRight', { shiftKey: true, ctrlKey: true }))).toBeNull();
    expect(shortcutFromKeys(press('MetaLeft', { metaKey: true }))).toBeNull();
  });

  it('needs Ctrl, Alt or the Windows key, so it can’t take over typing', () => {
    expect(shortcutFromKeys(press('KeyA'))).toEqual({
      ok: false,
      error: SHORTCUT_MESSAGES.needsModifier,
    });
    expect(shortcutFromKeys(press('KeyA', { shiftKey: true }))).toEqual({
      ok: false,
      error: SHORTCUT_MESSAGES.needsModifier,
    });
  });

  it('refuses keys the OS shortcut can’t use', () => {
    for (const code of ['CapsLock', 'Tab', 'Escape', 'F25', 'IntlBackslash']) {
      expect(shortcutFromKeys(press(code, { ctrlKey: true }))).toEqual({
        ok: false,
        error: SHORTCUT_MESSAGES.unsupportedKey,
      });
    }
  });
});

describe('shortcutKeys', () => {
  it('names the keys as people read them', () => {
    expect(shortcutKeys(DEFAULT_SHORTCUT)).toEqual(['Ctrl', 'Shift', 'Space']);
    expect(shortcutKeys('Super+Alt+KeyA')).toEqual(['Win', 'Alt', 'A']);
    expect(shortcutKeys('Ctrl+Digit1')).toEqual(['Ctrl', '1']);
    expect(shortcutKeys('Ctrl+Numpad4')).toEqual(['Ctrl', 'Num 4']);
    expect(shortcutKeys('Alt+ArrowUp')).toEqual(['Alt', '↑']);
  });
});
