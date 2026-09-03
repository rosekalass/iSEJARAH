'use strict';

const CACHE_PREFIX = 'isejarah-static-';
const CACHE_NAME = `${CACHE_PREFIX}v83-1`;
const RUNTIME_CACHE_NAME = 'isejarah-runtime-v83-1';
const OFFLINE_URL = './offline.html';
const STATIC_CDN_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './responsive.js',
  './pwa.js',
  './config.js',
  './tailwind.config.js',
  './modules/upgrades.js',
  './manifest.webmanifest',
  OFFLINE_URL,
  './assets/background-1.jpg',
  './assets/background-2.jpg',
  './assets/background-3.jpg',
  './assets/background-4.png',
  './assets/pwa-icon.svg',
  './assets/isejarah-login-hero.png',
  './assets/isejarah-wordmark.png',
  './assets/isejarah-pwa-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('isejarah-') && ![CACHE_NAME, RUNTIME_CACHE_NAME].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) ||
      (await caches.match('./index.html')) ||
      (await caches.match(OFFLINE_URL));
  }
}

async function staleWhileRevalidate(request, cacheName = CACHE_NAME) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(async response => {
    if (response && (response.ok || response.type === 'opaque')) {
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    if (STATIC_CDN_HOSTS.has(url.hostname)) {
      event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE_NAME));
    }
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  const isStaticAsset = STATIC_ASSETS.some(asset =>
    url.pathname.endsWith(asset.replace('./', '/'))
  );
  if (isStaticAsset) event.respondWith(staleWhileRevalidate(request));
});
