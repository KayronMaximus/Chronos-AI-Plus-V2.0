/*// Escuta o evento de clique na notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Fecha a notificação ao clicar

    // Abre o aplicativo se ele estiver fechado, ou foca na aba se estiver aberta
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/'); // Abre a home do seu app
        })
    );
});

const cacheName = 'chronos-v1';
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
});*/

// Responde com os arquivos do cache quando estiver offline
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close(); // Fecha a notificação ao clicar

  // Abre o aplicativo se ele estiver fechado, ou foca na aba se estiver aberta
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow("/"); // Abre a home do seu app
    }),
  );
});

// Cache básico para o app funcionar offline (Opcional, mas recomendado)
const CACHE_NAME = "chronos-v1";
const assets = ["/", "/index.html", "/css/style.css", "/js/script.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(assets)));
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
