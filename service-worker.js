/* ===========================
   SERVICE WORKER – CHAT APP
=========================== */

// Cache Name
const CACHE_NAME = "chat-cache-v1";

// Dateien, die offline verfügbar sein sollen
const OFFLINE_FILES = [
  "/",
  "/index.html",
  "/client.js",
  "/style.css",
  "/icon.png"
];

/* ===========================
   INSTALL – Dateien cachen
=========================== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_FILES))
  );
  self.skipWaiting();
});

/* ===========================
   ACTIVATE – alte Caches löschen
=========================== */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ===========================
   FETCH – Offline‑Fallback
=========================== */
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() =>
          caches.match("/index.html")
        )
      );
    })
  );
});

/* ===========================
   PUSH – Nachricht anzeigen
=========================== */
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Neue Nachricht", body: "Du hast eine neue Nachricht." };
  }

  const title = data.title || "Neue Nachricht";
  const body = data.body || "Du hast eine neue Nachricht.";
  const url = data.url || "/";

  const options = {
    body,
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [100, 50, 100],
    data: { url }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ===========================
   NOTIFICATION CLICK
=========================== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

/* ===========================
   BADGE RESET
=========================== */
self.addEventListener("message", (event) => {
  if (event.data === "clearBadge" && self.registration.setAppBadge) {
    self.registration.setAppBadge(0).catch(() => {});
  }
});
