/* ===========================
   SERVICE WORKER
   PUSH + AUTO-OPEN
=========================== */

/* ===========================
   INSTALL
=========================== */

self.addEventListener("install", (event) => {

    console.log("Service Worker installiert");

    self.skipWaiting();

});

/* ===========================
   ACTIVATE
=========================== */

self.addEventListener("activate", (event) => {

    console.log("Service Worker aktiv");

    event.waitUntil(clients.claim());

});

/* ===========================
   PUSH EMPFANGEN
=========================== */

self.addEventListener("push", (event) => {

    let data = {};

    try {

        if (event.data) {
            data = event.data.json();
        }

    } catch (err) {

        console.error(
            "Push JSON Fehler:",
            err
        );

    }

    const title =
        data.title || "Neue Nachricht";

    const body =
        data.body || "";

    const chatName =
        data.title || "";

    const options = {

        body: body,

        icon: "/icon-192.png",

        badge: "/icon-192.png",

        vibrate: [200, 100, 200],

        tag: "chat-message",

        renotify: true,

        requireInteraction: false,

        data: {
            chatName: chatName
        }

    };

    event.waitUntil(

        self.registration.showNotification(
            title,
            options
        )

    );

});

/* ===========================
   BENACHRICHTIGUNG GEKLICKT
=========================== */

self.addEventListener(
    "notificationclick",
    (event) => {

        event.notification.close();

        const chatName =
            event.notification.data?.chatName || "";

        event.waitUntil(

            clients.matchAll({
                type: "window",
                includeUncontrolled: true
            })

            .then((clientList) => {

                for (const client of clientList) {

                    client.focus();

                    client.postMessage({
                        openChat: chatName
                    });

                    return;
                }

                return clients
                    .openWindow("/")
                    .then(() => {

                        console.log(
                            "App geöffnet"
                        );

                    });

            })

        );

    }

);
