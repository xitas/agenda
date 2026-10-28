import { vi } from 'vitest';

/**
 * Makes window.matchMedia report `matches` for every query (jsdom has no matchMedia).
 * Returns a function that flips the answer and notifies listeners, like a resize.
 */
export function mockMatchMedia(matches: boolean): (next: boolean) => void {
  let current = matches;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      get matches() {
        return current;
      },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    })),
  );
  return (next) => {
    current = next;
    for (const listener of listeners) listener();
  };
}
