'use strict';

const CACHE_PREFIX = 'isejarah-static-';
const CACHE_NAME = `${CACHE_PREFIX}v88-8-sidebar`;
const RUNTIME_CACHE_NAME = 'isejarah-runtime-v88-8-sidebar';
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
  './teacher-panel.css?v=88.8',
  './assets/brand-branding-approved-login-artwork.png',
  "./branding.css?v=88.6",
  "./assets/brand-branding-logo-horizontal-compact.png",
  "./assets/brand-branding-app-icon-master-1024.png",
  "./assets/brand-icons-ios-apple-touch-icon-180x180.png",
  "./assets/brand-icons-favicon-32x32.png",
  "./assets/brand-icons-favicon.ico",
  "./assets/brand-icons-pwa-icon-192x192.png",
  "./assets/brand-icons-pwa-icon-512x512.png",
  "./assets/brand-icons-pwa-maskable-192x192.png",
  "./assets/brand-icons-pwa-maskable-512x512.png",
  './assets/pastel-trophy.svg',
  './assets/pastel-flower.svg',
  './assets/pastel-school.svg',
  './assets/pastel-search.svg',
  './assets/pastel-gear.svg',
  './assets/pastel-home.svg',
  './assets/pastel-students.svg',
  './assets/pastel-chart.svg',
  './assets/pastel-pencil.svg',
  './assets/pastel-books.svg',
  './assets/pastel-check.svg',
  './assets/pastel-target.svg',
  './assets/pastel-heart.svg',
  './assets/pastel-printer.svg',
  './pastel.css?v=88.4',
  './report-a4.css?v=88.5',
  './assets/pastel-clay-atlas.png',
  './readability.css?v=86.3',
  './',
  './index.html',
  './styles.css?v=83',
  './polish.css?v=86.1',
  './workspace.css?v=86.1',
  './modules/workspace.js?v=86.1',
  './app.js?v=88.5',
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
      .then(cache => Promise.all(STATIC_ASSETS.map(asset =>
        cache.add(asset).catch(error => console.warn('Optional asset was not cached:', asset, error))
      )))
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

  // Compare URL paths, not paths containing ?v=. Keep the exact query in cache keys.
  const isStaticAsset = STATIC_ASSETS.some(asset =>
    url.pathname === new URL(asset, self.registration.scope).pathname
  );
  if (isStaticAsset) event.respondWith(staleWhileRevalidate(request));
});
