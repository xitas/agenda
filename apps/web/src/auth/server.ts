import type { Platform } from '@agenda/core';

/**
 * The server the app talks to, as shown to the user: the desktop app's Server URL, or
 * the page's own origin in the browser (where /api is proxied or served alongside).
 */
export function serverLabel(
  { apiBaseUrl }: Pick<Platform, 'apiBaseUrl'>,
  origin: string = window.location.origin,
): string {
  return apiBaseUrl === '' ? origin : apiBaseUrl;
}

export { unreachableMessage } from '@agenda/core';
