/* ===========================
   GLOBAL
=========================== */
let socket;
let username = "";
let currentChat = "";
let unread = {}; // { "Chris": 2, "Mama": 1 }

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
            socket.emit("login", { username });
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
            unread[name] = (unread[name] || 0) + 1;
        });
        updateUnreadBadges();
    });
}

/* ===========================
   LOGIN
=========================== */
document.getElementById("loginBtn").addEventListener("click", () => {
    const name = document.getElementById("usernameInput").value.trim();
    const pin = document.getElementById("pinInput").value.trim();

    if (!name || !pin) return;

    username = name;

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("chatScreen").style.display = "flex";

    socket.emit("login", { username });
});

/* ===========================
   USERLISTE
=========================== */
function renderUserList(users) {
    const list = document.getElementById("userListDesktop");
    list.innerHTML = "";

    users.forEach(u => {
        if (u === username) return;

        const li = document.createElement("li");
        li.textContent = u;

        if (unread[u]) {
            li.innerHTML += ` <span class="badge">${unread[u]}</span>`;
        }

        li.addEventListener("click", () => openChat(u));
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

    document.getElementById("chatTitle").textContent = name;
    document.getElementById("messages").innerHTML = "";

    socket.emit("loadChat", { with: name });
}

/* ===========================
   NACHRICHT EMPFANGEN
=========================== */
function handleIncomingMessage(msg) {
    if (msg.from !== currentChat) {
        unread[msg.from] = (unread[msg.from] || 0) + 1;
        updateUnreadBadges();
    }

    renderMessage(msg);
}

function handleIncomingGroupMessage(msg) {
    if (msg.group !== currentChat) {
        unread[msg.group] = (unread[msg.group] || 0) + 1;
        updateUnreadBadges();
    }

    renderMessage(msg);
}

/* ===========================
   NACHRICHT RENDERN
=========================== */
function renderMessage(msg) {
    const box = document.getElementById("messages");

    const div = document.createElement("div");
    div.className = msg.from === username ? "msg me" : "msg";

    div.innerHTML = `<strong>${msg.from}:</strong> ${msg.text || ""}`;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

/* ===========================
   SENDEN
=========================== */
document.getElementById("sendBtn").addEventListener("click", () => {
    const text = document.getElementById("messageInput").value.trim();
    if (!text || !currentChat) return;

    const msg = {
        from: username,
        to: currentChat,
        text
    };

    socket.emit("message", msg);
    renderMessage(msg);

    document.getElementById("messageInput").value = "";
});

/* ===========================
   UNREAD BADGES
=========================== */
function updateUnreadBadges() {
    renderUserList(Object.keys(unread));
}

/* ===========================
   PUSH CLICK → CHAT AUTOMATISCH ÖFFNEN
=========================== */
navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.openChat) {
        openChat(event.data.openChat);
    }
});

/* ===========================
   START
=========================== */
connectSocket();
