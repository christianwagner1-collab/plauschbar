/* ===========================
   SERVICE WORKER – PUSH + AUTO-OPEN
=========================== */

// Install
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

// Activate
self.addEventListener("activate", (event) => {
    clients.claim();
});

/* ===========================
   PUSH EMPFANGEN
=========================== */
self.addEventListener("push", (event) => {
    let data = {};

    try {
        data = event.data.json();
    } catch (e) {
        console.error("Push JSON Fehler:", e);
    }

    const title = data.title || "Neue Nachricht";
    const body = data.body || "";
    const chatName = data.title; // Name des Chats (Absender oder Gruppe)

    const options = {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: {
            chatName
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

/* ===========================
   PUSH ANGEKLICKT → CHAT ÖFFNEN
=========================== */
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const chatName = event.notification.data.chatName;

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {

                // Falls App offen → Nachricht an Client schicken
                for (const client of clientList) {
                    client.postMessage({ openChat: chatName });
                    client.focus();
                    return;
                }

                // Falls App geschlossen → neu öffnen
                return clients.openWindow("/").then((newClient) => {
                    setTimeout(() => {
                        newClient.postMessage({ openChat: chatName });
                    }, 500);
                });
            })
    );
});
