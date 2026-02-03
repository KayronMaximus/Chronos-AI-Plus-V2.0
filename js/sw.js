const cacheName = "chronos-v2";
const assets = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/script.js",
  "https://cdn.jsdelivr.net/npm/chart.js",
];
//NOVO 12:35
// sw.js - O cérebro que nunca dorme
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Escuta mensagens do script principal para disparar notificações
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "NOTIFICAR_AGORA") {
    const options = {
      body: event.data.corpo,
      icon: "https://cdn-icons-png.flaticon.com/512/4712/4712009.png", // Ícone do Zeus
      badge: "https://cdn-icons-png.flaticon.com/512/4712/4712009.png",
      vibrate: [200, 100, 200],
      tag: "alerta-chronos",
      renotify: true,
      data: { url: "./" },
    };

    self.registration.showNotification(event.data.titulo, options);
  }
});

// Faz o app abrir ao clicar na notificação
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) return clientList[0].focus();
        return clients.openWindow("./");
      }),
  );
});
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "verificar-missoes") {
    event.waitUntil(verificarTarefasPendentes());
  }
});

async function verificarTarefasPendentes() {
  // O Service Worker não tem acesso direto ao localStorage
  // Mas ele pode comunicar com o app ou usar IndexedDB no futuro.
  // Por agora, vamos simular um lembrete de disciplina:

  const options = {
    body: "Chronos, não te esqueças das tuas missões diárias. A disciplina é o caminho para o topo!",
    icon: "https://cdn-icons-png.flaticon.com/512/4712/4712009.png",
    vibrate: [100, 50, 100],
    data: { url: "./" },
  };

  return self.registration.showNotification("🛡️ Lembrete de Zeus", options);
}
// Instala o Service Worker e guarda os arquivos no cache
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(assets);
    }),
  );
});

// Responde com os arquivos do cache quando estiver offline
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    }),
  );
});
