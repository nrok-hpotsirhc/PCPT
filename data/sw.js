// Increment this version with every deploy to bust the old cache.
// The deploy workflow bumps this automatically.
const CACHE_NAME = 'pcpt-v2';

self.addEventListener('install', (event) => {
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete every cache that doesn't match the current version
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

// ── Fetch strategy ───────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // External Pokémon TCG API — always network-first
  if (url.hostname.includes('pokemontcg.io')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Same-origin only from here
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // JSON data files — network-first so price/card updates are picked up
  // index.html — network-first so a new build is always fetched immediately
  if (path.endsWith('.json') || path.endsWith('.html') || path.endsWith('/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed JS/CSS/image assets (/assets/…) — cache-first (content-addressed)
  event.respondWith(cacheFirst(request));
});