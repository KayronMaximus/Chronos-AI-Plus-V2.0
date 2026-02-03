const cacheName = 'chronos-v2';
const assets = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Instala o Service Worker e guarda os arquivos no cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Responde com os arquivos do cache quando estiver offline
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});