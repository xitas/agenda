export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'agenda.theme';

/**
 * The saved choice, or "system". Storage can be unavailable (private windows, blocked
 * site data), so every access is guarded; the app must work without it.
 */
export function readTheme(
  storage: Pick<Storage, 'getItem'> | undefined = safeStorage(),
): ThemeChoice {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Applies a choice: "system" removes data-theme so prefers-color-scheme decides;
 * "light"/"dark" set it, which tokens.css lets win over the system setting.
 */
export function applyTheme(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined = safeStorage(),
): void {
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === 'system') storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not saved; the choice still applies for this visit.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
