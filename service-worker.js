/* ===========================
   SERVICE WORKER – FIXED
=========================== */

const CACHE_VERSION = "v10";
const STATIC_CACHE = `static-${CACHE_VERSION}`;

const STATIC_FILES = [
  "/",
  "/style.css",
  "/icon.png"
];

/* INSTALL */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

/* ACTIVATE */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* FETCH – Network first for HTML/JS */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // HTML & JS IMMER aus dem Netzwerk
  if (url.pathname.endsWith(".html") || url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  // Icons & CSS aus Cache
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

/* PUSH */
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

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url }
    })
  );
});

/* NOTIFICATION CLICK */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow("/");
    })
  );
});
