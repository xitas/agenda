/**
 * How the service worker answers a request. Pure, so it can be tested without a worker.
 *
 * - network-only: the browser fetches as if there were no service worker. Every /api
 *   request takes this route: your agenda changes from other devices, and its responses
 *   are personal data that must not outlive a logout. TanStack Query does the caching
 *   for data, deliberately, and Phase 7 brings real offline support.
 * - precache: a file from the build (hashed JS and CSS, fonts, icons), served from the
 *   cache the worker filled when it was installed.
 * - app-shell: a page load (any app URL, like /week/2026-11-02) gets the cached
 *   index.html; the router in the page then shows the right screen.
 */
export type Route = 'network-only' | 'precache' | 'app-shell';

export interface RequestInfo {
  method: string;
  url: string;
  mode: string;
}

/** True for the API, which is never cached. */
export const isApi = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/');

export function routeFor(
  request: RequestInfo,
  origin: string,
  precached: ReadonlySet<string>,
): Route {
  if (request.method !== 'GET') return 'network-only';
  const url = new URL(request.url);
  if (url.origin !== origin) return 'network-only';
  // Checked before navigations: a link or download to the API must reach the server.
  if (isApi(url.pathname)) return 'network-only';
  if (request.mode === 'navigate') return 'app-shell';
  if (precached.has(url.pathname)) return 'precache';
  return 'network-only';
}

/**
 * The build's file list as the paths the worker precaches ("/assets/index-abc.js"), each
 * once. The plugin lists the manifest's icons twice (from the glob and from the manifest),
 * and cache.addAll rejects duplicates, which would fail the whole install.
 */
export function precachePaths(
  manifest: readonly (string | { url: string; revision?: string | null })[],
): string[] {
  const paths = manifest.map(
    (entry) => `/${(typeof entry === 'string' ? entry : entry.url).replace(/^\//, '')}`,
  );
  return [...new Set(paths)];
}

/**
 * A cache name that changes whenever the build does, so a new worker fills a fresh cache
 * and the old one can be deleted on activate.
 */
export function cacheName(
  manifest: readonly (string | { url: string; revision?: string | null })[],
): string {
  const text = JSON.stringify(manifest);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return `${CACHE_PREFIX}${(hash >>> 0).toString(36)}`;
}

export const CACHE_PREFIX = 'agenda-shell-';
