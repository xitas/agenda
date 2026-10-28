import { breakpoint } from '@agenda/tokens';
import { useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches, kept up to date. Where matchMedia doesn't exist
 * (jsdom in tests) it never matches, which means the wide layout.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
}

/** Below breakpoint.narrow: the phone layout. */
export const NARROW = `(width < ${String(breakpoint.narrow)}px)`;
