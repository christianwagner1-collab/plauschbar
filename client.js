/* ===========================
   GLOBAL
=========================== */
let socket;
let username = "";
let currentChat = "";
let unread = {};

/* ===========================
   PUSH
=========================== */

const VAPID_PUBLIC_KEY =
"BLo1Q*y9CVxLdlyVgFrwI_pNktRKUQqxSuhnsFI3*aQ1vCLylZ3KalTa1cGQVl61je_buQxhfV6*IPRDmwyV_q8";

function urlBase64T*Uint8Array(base64String) {

    co*st padding =
        "=".repeat((4*- base64String.length % 4) % 4);

*   const base64 =
        (base64S*ring + padding)
            .repla*e(/-/g, "+")
            .replace(*_/g, "/");

    const rawData = wi*dow.atob(base64);

    const outpu*Array =
        new Uint8Array(raw*ata.length);

    for (let i = 0; * < rawData.length; ++i) {
        *utputArray[i] =
            rawDat*.charCodeAt(i);
    }

    return *utputArray;
}

async function registerPush() {

    try {

        const permission =
            await Notification.requestPermission();

        if (permission !== "granted") {

            console.log(
                "Push-Benachrichtigungen nicht erlaubt"
            );

            return;
        }

        const registration =
            await navigator.serviceWorker.register(
                "/service-worker.js"
            );

        console.log(
            "Service Worker registriert"
        );

        let subscription =
            await registration.pushManager.getSubscription();

        if (!subscription) {

            subscription =
                await registration.pushManager.subscribe({

                    userVisibleOnly: true,

                    applicationServerKey:
                        urlBase64ToUint8Array(
                            VAPID_PUBLIC_KEY
                        )

                });

            console.log(
                "Neue Push Subscription erstellt"
            );
        }

        socket.emit(
            "saveSubscription",
            {
                username,
                subscription
            }
        );

        console.log(
            "Push Subscription gespeichert"
        );

    } catch (err) {

        console.error(
            "Push Fehler:",
            err
        );
    }
}

/* ===========================
   SOCKET.IO VERBINDUNG
=========================== */

function connectSocket() {

    socket = io("/", {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500
    });

    socket.on("connect", () => {

        console.log("🟢 Verbunden mit Server");

        if (username) {

            socket.emit(
                "login",
                { username }
            );

            registerPush();
        }
    });

    socket.on("onlineUsers", (users) => {
        renderUserList(users);
    });

    socket.on("message", (msg) => {
        handleIncomingMessage(msg);
    });

    socket.on("groupMessage", (msg) => {
        handleIncomingGroupMessage(msg);
    });

    socket.on("unreadList", (list) => {

        list.forEach(name => {

            unread[name] =
                (unread[name] || 0) + 1;

        });

        updateUnreadBadges();

    });

}

/* ===========================
   LOGIN
=========================== */

document
.getElementById("loginBtn")
.addEventListener("click", () => {

    const name =
        document
        .getElementById("usernameInput")
        .value
        .trim();

    const pin =
        document
        .getElementById("pinInput")
        .value
        .trim();

    if (!name || !pin) return;

    username = name;

    document
        .getElementById("loginScreen")
        .style.display = "none";

    document
        .getElementById("chatScreen")
        .style.display = "flex";

    socket.emit(
        "login",
        { username }
    );

    registerPush();

});

/* ===========================
   USERLISTE
=========================== */

function renderUserList(users) {

    const list =
        document.getElementById(
            "userListDesktop"
        );

    list.innerHTML = "";

    users.forEach(u => {

        if (u === username) return;

        const li =
            document.createElement("li");

        li.textContent = u;

        if (unread[u]) {

            li.innerHTML +=
                ` <span class="badge">${unread[u]}</span>`;

        }

        li.addEventListener(
            "click",
            () => openChat(u)
        );

        list.appendChild(li);

    });

}

/* ===========================
   CHAT ÖFFNEN
=========================== */

function openChat(name) {

    currentChat = name;

    unread[name] = 0;

    updateUnreadBadges();

    document
        .getElementById("chatTitle")
        .textContent = name;

    document
        .getElementById("messages")
        .innerHTML = "";

    socket.emit(
        "loadChat",
        { with: name }
    );

}

/* ===========================
   NACHRICHT EMPFANGEN
=========================== */

function handleIncomingMessage(msg) {

    if (msg.from !== currentChat) {

        unread[msg.from] =
            (unread[msg.from] || 0) + 1;

        updateUnreadBadges();
    }

    renderMessage(msg);

}

function handleIncomingGroupMessage(msg) {

    if (msg.group !== currentChat) {

        unread[msg.group] =
            (unread[msg.group] || 0) + 1;

        updateUnreadBadges();
    }

    renderMessage(msg);

}

/* ===========================
   NACHRICHT RENDERN
=========================== */

function renderMessage(msg) {

    const box =
        document.getElementById(
            "messages"
        );

    const div =
        document.createElement("div");

    div.className =
        msg.from === username
            ? "msg me"
            : "msg";

    div.innerHTML =
        `<strong>${msg.from}:</strong> ${msg.text || ""}`;

    box.appendChild(div);

    box.scrollTop =
        box.scrollHeight;

}

/* ===========================
   SENDEN
=========================== */

document
.getElementById("sendBtn")
.addEventListener("click", () => {

    const text =
        document
        .getElementById("messageInput")
        .value
        .trim();

    if (!text || !currentChat)
        return;

    const msg = {

        from: username,
        to: currentChat,
        text

    };

    socket.emit(
        "message",
        msg
    );

    renderMessage(msg);

    document
        .getElementById("messageInput")
        .value = "";

});

/* ===========================
   UNREAD BADGES
=========================== */

function updateUnreadBadges() {

    renderUserList(
        Object.keys(unread)
    );

}

/* ===========================
   PUSH CLICK
=========================== */

if ("serviceWorker" in navigator) {

    navigator.serviceWorker.addEventListener(
        "message",
        (event) => {

            if (
                event.data &&
                event.data.openChat
            ) {

                openChat(
                    event.data.openChat
                );

            }

        }
    );

}

/* ===========================
   START
=========================== */

connectSocket();
