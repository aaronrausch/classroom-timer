/*
 * Offline support (SPEC §5.13).
 *
 * School Wi-Fi fails; lessons do not stop. After one successful visit the
 * whole app is available with no network at all.
 *
 * The update strategy is the part worth reading carefully. There is no
 * `skipWaiting()` here, deliberately. A new deployment installs in the
 * background and waits; it takes over only once every tab running the old
 * version has closed. A timer projected in front of a class is therefore never
 * swapped out underneath itself mid-countdown, which is the failure this
 * requirement exists to prevent.
 *
 * Two caching strategies, chosen by what the request is for:
 *
 *  - Navigations are network-first. That is how a new deployment is noticed at
 *    all, and the cached copy is right there when the network is missing.
 *  - Everything else is cache-first. The build emits content-hashed filenames,
 *    so a cached asset can never be stale: a changed file has a changed name.
 */

const VERSION = 'v1';
const CACHE = `classroom-timer-${VERSION}`;

const BASE = new URL('./', self.location).href;

/** The shell, precached on install so the first offline visit already works. */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './sounds/gentle.wav',
  './sounds/neutral.wav',
  './sounds/assertive.wav',
  './sounds/warning.wav',
].map((path) => new URL(path, BASE).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Individually, so one missing optional asset cannot fail the install
      // and leave the app with no offline support at all.
      await Promise.all(
        SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)),
      );
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('classroom-timer-') && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(BASE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(new URL('./index.html', BASE).href, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request)) ?? (await cache.match(new URL('./index.html', BASE).href));
    if (cached) return cached;
    throw new Error('offline and not cached');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
}
