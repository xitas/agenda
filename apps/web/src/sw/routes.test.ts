import { describe, expect, it } from 'vitest';
import { CACHE_PREFIX, cacheName, isApi, precachePaths, routeFor } from './routes';

const ORIGIN = 'https://agenda.example';
const PRECACHED = new Set([
  '/index.html',
  '/assets/index-abc123.js',
  '/assets/index-def456.css',
  '/pwa-192x192.png',
]);
const get = (path: string, mode = 'cors') => ({ method: 'GET', url: `${ORIGIN}${path}`, mode });

describe('routeFor', () => {
  it.each([
    ['/api/v1/events?from=2026-10-26T19:00:00.000Z', 'cors'],
    ['/api/v1/auth/me', 'cors'],
    ['/api/v1/settings', 'same-origin'],
    // A download link or a typed URL to the API is a navigation; it still goes to the server.
    ['/api/v1/events/export.json', 'navigate'],
    ['/api', 'navigate'],
  ])('never caches the API: %s (%s)', (path, mode) => {
    expect(routeFor(get(path, mode), ORIGIN, PRECACHED)).toBe('network-only');
  });

  it('never caches writes, even to cached paths', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(
        routeFor({ method, url: `${ORIGIN}/api/v1/events`, mode: 'cors' }, ORIGIN, PRECACHED),
      ).toBe('network-only');
      expect(
        routeFor({ method, url: `${ORIGIN}/index.html`, mode: 'navigate' }, ORIGIN, PRECACHED),
      ).toBe('network-only');
    }
  });

  it('serves build files from the precache, and nothing else', () => {
    expect(routeFor(get('/assets/index-abc123.js'), ORIGIN, PRECACHED)).toBe('precache');
    expect(routeFor(get('/pwa-192x192.png'), ORIGIN, PRECACHED)).toBe('precache');
    expect(routeFor(get('/assets/not-in-this-build.js'), ORIGIN, PRECACHED)).toBe('network-only');
    expect(routeFor(get('/robots.txt'), ORIGIN, PRECACHED)).toBe('network-only');
  });

  it('answers page loads with the app shell', () => {
    for (const path of ['/', '/week/2026-11-02', '/settings', '/login?next=%2Fmonth']) {
      expect(routeFor(get(path, 'navigate'), ORIGIN, PRECACHED)).toBe('app-shell');
    }
  });

  it('leaves other origins alone (fonts, an API on another domain)', () => {
    expect(
      routeFor(
        { method: 'GET', url: 'https://api.agenda.example/api/v1/events', mode: 'cors' },
        ORIGIN,
        PRECACHED,
      ),
    ).toBe('network-only');
    expect(
      routeFor(
        { method: 'GET', url: 'https://fonts.example/inter.woff2', mode: 'navigate' },
        ORIGIN,
        PRECACHED,
      ),
    ).toBe('network-only');
  });

  it('knows the API by its path prefix only', () => {
    expect(isApi('/api')).toBe(true);
    expect(isApi('/api/v1/events')).toBe(true);
    expect(isApi('/apiary')).toBe(false);
    expect(isApi('/week')).toBe(false);
  });
});

describe('precache list and cache name', () => {
  const manifest = [
    { url: 'index.html', revision: 'r1' },
    'assets/index-abc123.js',
    { url: '/favicon.ico', revision: null },
  ];

  it('lists each path once, since cache.addAll rejects duplicates', () => {
    expect(
      precachePaths([
        { url: 'pwa-192x192.png', revision: 'a' },
        'index.html',
        { url: '/pwa-192x192.png', revision: 'a' },
      ]),
    ).toEqual(['/pwa-192x192.png', '/index.html']);
  });

  it('turns the build manifest into paths', () => {
    expect(precachePaths(manifest)).toEqual([
      '/index.html',
      '/assets/index-abc123.js',
      '/favicon.ico',
    ]);
  });

  it('names the cache after the build, so a new build gets a new cache', () => {
    const name = cacheName(manifest);
    expect(name.startsWith(CACHE_PREFIX)).toBe(true);
    expect(cacheName(manifest)).toBe(name);
    expect(cacheName([{ url: 'index.html', revision: 'r2' }])).not.toBe(
      cacheName([{ url: 'index.html', revision: 'r1' }]),
    );
  });
});
