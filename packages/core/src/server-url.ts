/** The API on this PC (`pnpm dev`): where the desktop app looks until told otherwise. */
export const DEFAULT_SERVER_URL = 'http://localhost:4001';

export type ServerUrlResult = { ok: true; url: string } | { ok: false; error: string };

export const SERVER_URL_MESSAGES = {
  missing: `Enter the server’s address, like ${DEFAULT_SERVER_URL}`,
  invalid: `That isn’t a web address. Enter one like ${DEFAULT_SERVER_URL}`,
  protocol: 'Use an address that starts with http:// or https://',
  path: 'Enter only the server’s address, without a path, like https://api.example.com',
  https:
    'Use https:// for a server outside your network. Plain http:// is only for this device or your local network.',
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
 * a path, query or user name is refused rather than silently dropped. With
 * `httpsOutsideLocal` (the phone app, which only allows cleartext to local addresses),
 * http:// is refused for any other host.
 */
export function normalizeServerUrl(
  input: string,
  { httpsOutsideLocal = false }: { httpsOutsideLocal?: boolean } = {},
): ServerUrlResult {
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
  if (httpsOutsideLocal && url.protocol === 'http:' && !isLocalServer(url.origin)) {
    return { ok: false, error: SERVER_URL_MESSAGES.https };
  }
  return { ok: true, url: url.origin };
}

/**
 * Whether an origin is this device or a private network address: localhost, 127.x, 10.x,
 * 192.168.x or 172.16–31.x (10.0.2.2 is how the Android emulator reaches the PC). Names
 * that only start like one ("10.example.com") are not.
 */
export function isLocalServer(origin: string): boolean {
  const host = /^[a-z]+:\/\/(\[[^\]]+\]|[^/:]+)/i.exec(origin)?.[1] ?? '';
  if (host === 'localhost' || host === '[::1]') return true;
  return /^[\d.]+$/.test(host) && LOCAL_HOST.test(host);
}
