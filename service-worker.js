/**
 * Demise Message Builder PWA - Service Worker
 * Implements offline capabilities:
 * - Cache-first strategy for static assets
 * - Network-first strategy for API configuration calls (caching fallback values)
 */

const CACHE_NAME = 'demise-builder-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-icon.png'
];

// Install event - caching static resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleaning old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - handling requests offline
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Network-first strategy for Google Apps Script Web App calls
  if (requestUrl.host.includes('script.google.com') || requestUrl.searchParams.has('action')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If successful response, save a clone to the cache for offline fallback
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          console.log('[Service Worker] Network failed, fetching API request from cache');
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return an offline-friendly JSON response if not in cache
            return new Response(
              JSON.stringify({
                success: false,
                offline: true,
                error: 'You are currently offline. Using offline cached data.'
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fallback to network
        return fetch(event.request).then(response => {
          // If response is valid, cache it dynamically for later
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        }).catch(err => {
          console.error('[Service Worker] Fetch failed and not in cache:', err);
        });
      })
  );
});
