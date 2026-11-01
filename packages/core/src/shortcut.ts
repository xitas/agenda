/** The global quick-add shortcut until the user picks another one. */
export const DEFAULT_SHORTCUT = 'Ctrl+Shift+Space';

/** The fields of a KeyboardEvent this needs (core has no DOM types). */
export interface KeyPress {
  key: string;
  /** The physical key, e.g. "KeyA", "Digit1", "Space": layout-independent. */
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export type ShortcutResult = { ok: true; shortcut: string } | { ok: false; error: string };

const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/;
const NAMED_KEYS = new Set([
  'Space',
  'Enter',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Comma',
  'Period',
  'Slash',
  'Semicolon',
  'Quote',
  'BracketLeft',
  'BracketRight',
  'Backslash',
  'Minus',
  'Equal',
  'Backquote',
]);
const KEY_CODE = /^(Key[A-Z]|Digit\d|Numpad\d|F([1-9]|1\d|2[0-4]))$/;

export const SHORTCUT_MESSAGES = {
  needsModifier:
    'Add Ctrl, Alt or the Windows key, so the shortcut doesn’t get in the way of typing.',
  unsupportedKey: 'That key can’t be part of a shortcut. Try a letter, a number or Space.',
} as const;

/**
 * Turns a key press into the accelerator string Tauri's global-shortcut plugin reads
 * ("Ctrl+Shift+Space", "Alt+KeyA"). Null while only modifiers are held down: the
 * recorder keeps listening for the main key.
 */
export function shortcutFromKeys(press: KeyPress): ShortcutResult | null {
  if (MODIFIER_CODES.test(press.code)) return null;
  if (!NAMED_KEYS.has(press.code) && !KEY_CODE.test(press.code)) {
    return { ok: false, error: SHORTCUT_MESSAGES.unsupportedKey };
  }
  if (!press.ctrlKey && !press.altKey && !press.metaKey) {
    return { ok: false, error: SHORTCUT_MESSAGES.needsModifier };
  }
  const parts = [
    press.ctrlKey && 'Ctrl',
    press.altKey && 'Alt',
    press.shiftKey && 'Shift',
    press.metaKey && 'Super',
    press.code,
  ].filter((part) => part !== false);
  return { ok: true, shortcut: parts.join('+') };
}

const KEY_NAMES: Record<string, string> = {
  Super: 'Win',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

/** The keys of a shortcut as people read them: ["Ctrl", "Shift", "Space"], ["Alt", "A"]. */
export function shortcutKeys(shortcut: string): string[] {
  return shortcut.split('+').map((part) => {
    const named = KEY_NAMES[part];
    if (named !== undefined) return named;
    return part.replace(/^(Key|Digit)/, '').replace(/^Numpad(\d)$/, 'Num $1');
  });
}
