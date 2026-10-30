/// <reference lib="webworker" />
// The service worker (ARCHITECTURE.md §6 Web). vite-plugin-pwa replaces
// self.__WB_MANIFEST with the build's file list and bundles this file as /sw.js.
import { CACHE_PREFIX, cacheName, isApi, precachePaths, routeFor } from './routes';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

const manifest = self.__WB_MANIFEST;
const CACHE = cacheName(manifest);
const paths = precachePaths(manifest);
const precached = new Set(paths);

// Install: fill this build's cache. The new worker then waits until the page tells it
// to take over (the "Update available" toast), so one tab never mixes two builds.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(paths.filter((path) => !isApi(path)))),
  );
});

// Activate: delete the caches of older builds.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
});

// "Reload" in the update toast: take over now.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: unknown } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Nothing is ever written to the cache here, so an API response can't end up in it.
self.addEventListener('fetch', (event) => {
  const route = routeFor(event.request, self.location.origin, precached);
  if (route === 'network-only') return;
  const key = route === 'app-shell' ? '/index.html' : new URL(event.request.url).pathname;
  event.respondWith(
    caches.match(key, { cacheName: CACHE }).then((cached) => cached ?? fetch(event.request)),
  );
});
