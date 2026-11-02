/** The API on this PC (`pnpm dev`): where the desktop app looks until told otherwise. */
export const DEFAULT_SERVER_URL = 'http://localhost:4001';

export type ServerUrlResult = { ok: true; url: string } | { ok: false; error: string };

export const SERVER_URL_MESSAGES = {
  missing: `Enter the server’s address, like ${DEFAULT_SERVER_URL}`,
  invalid: `That isn’t a web address. Enter one like ${DEFAULT_SERVER_URL}`,
  protocol: 'Use an address that starts with http:// or https://',
  path: 'Enter only the server’s address, without a path, like https://api.example.com',
} as const;

// core has no DOM or Node types (like http.ts), but every runtime it targets has the
// WHATWG URL class; this is the part of it used here.
interface ParsedUrl {
  readonly protocol: string;
  readonly username: string;
  readonly password: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly origin: string;
}
declare const URL: new (input: string) => ParsedUrl;

/** Hosts on this PC or the local network, where plain http is normal. */
const LOCAL_HOST = /^(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

/**
 * Reads a typed server address into the API origin the client needs. "localhost:4001"
 * becomes "http://localhost:4001" and "api.example.com" becomes "https://api.example.com";
 * a path, query or user name is refused rather than silently dropped.
 */
export function normalizeServerUrl(input: string): ServerUrlResult {
  const typed = input.trim();
  if (typed === '') return { ok: false, error: SERVER_URL_MESSAGES.missing };
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(typed)
    ? typed
    : `${LOCAL_HOST.test(typed) ? 'http' : 'https'}://${typed}`;
  let url: ParsedUrl;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: SERVER_URL_MESSAGES.invalid };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: SERVER_URL_MESSAGES.protocol };
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    return { ok: false, error: SERVER_URL_MESSAGES.path };
  }
  if (url.pathname !== '/') return { ok: false, error: SERVER_URL_MESSAGES.path };
  return { ok: true, url: url.origin };
}
