/**
 * Campana Handbell Choir - Service Worker
 * Suporte completo a Modo Offline para ensaios em igrejas e retiros sem internet.
 */

const CACHE_NAME = 'campana-sinos-v3.3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css?v=3.3',
  './bell-audio.js?v=3.3',
  './score-player.js?v=3.3',
  './pitch-detector.js?v=3.3',
  './app.js?v=3.3',
  './manifest.json',
  './libs/jszip.min.js',
  './libs/opensheetmusicdisplay.min.js',
  './scores/hino-da-alegria.musicxml',
  './scores/shine_jesus_shine.musicxml',
  './scores/a-mighty-fortess-is-our-god.musicxml',
  './scores/noite-feliz.musicxml',
  './scores/canon-em-re.musicxml',
  './scores/brilha-brilha-estrelinha.musicxml'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Falha ao cachear alguns recursos offline:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não intercepta chamadas de API dinâmicas nem uploads
  if (url.pathname.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Busca versão atualizada em background (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
