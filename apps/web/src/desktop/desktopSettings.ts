import type { DesktopBridge } from '@agenda/core';
import { useQuery } from '@tanstack/react-query';

/** Device settings, read from the desktop app (not from the API). */
export const DESKTOP_SETTINGS_KEY = ['desktop-settings'] as const;

export function useDesktopSettings(desktop: DesktopBridge, enabled = true) {
  return useQuery({
    queryKey: DESKTOP_SETTINGS_KEY,
    queryFn: () => desktop.settings(),
    enabled,
  });
}

/** Rust commands reject with a plain message; anything else gets a generic one. */
export function commandError(error: unknown): string {
  return typeof error === 'string' && error !== '' ? error : 'Something went wrong. Try again.';
}
