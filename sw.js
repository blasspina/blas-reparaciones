/* =========================================================================
   BLAS REPARACIONES · Service Worker (Offline + Network-First (propios) / Cache-First (CDN))
   ========================================================================= */
'use strict';

const CACHE_NAME = 'blasrep-cache-v3';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './css/styles.css',
  './js/store.js',
  './js/sync.js',
  './js/pattern.js',
  './js/boleta.js',
  './js/presupuesto.js',
  './js/registro.js',
  './js/stock.js',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(LOCAL_ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const NETWORK_TIMEOUT_MS = 6000;

/** Archivos propios (mismo origen): Network-First con fallback a caché */
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });

  const network = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  });

  if (!cached) {
    try {
      return await network;
    } catch (e) {
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw e;
    }
  }

  // Con caché disponible: si la red falla o tarda demasiado, se usa la copia guardada
  network.catch(() => {});
  try {
    return await Promise.race([
      network,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NETWORK_TIMEOUT_MS))
    ]);
  } catch (e) {
    return cached;
  }
}

/** Librerías de CDN (otros orígenes): Cache-First */
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (
    url.hostname.includes('firebaseio.com') ||
    url.href.includes('googleapis.com/identitytoolkit') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firestore.googleapis.com')
  ) {
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});