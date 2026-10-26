const webpush = require("web-push");
let sockets = {};   // username → socket.id
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

// Render Port oder lokal 3001
const PORT = process.env.PORT || 3001;

// statische Dateien aus dem Root
app.use(express.static(__dirname));

let onlineUsers = [];
let chats = {};
let groupChats = {};

let groups = {
    "Familie": ["Papa", "Mama", "Chris", "Täubchen"],
    "Freunde": ["Chris", "Stefan", "Michael"]
};

/* ===========================
   PUSH VAPID KEYS
=========================== */
webpush.setVapidDetails(
    "mailto:deine@mail.com",
    "BHpAxlR1IOB5-l9qaZG0ZUcmMzpU1jM3THblOGZfTRmBVvIM61LIaIWbQ-GElC9cySX8wIdesXZ2-REw-RBmxx0",
    "SEJZFk1QACGLJyKm6FE12GO6Nhrxu_EZaWsXdvkJMCE"
);

let pushSubscriptions = {};

/* ===========================
   SOCKET.IO
=========================== */
io.on("connection", (socket) => {

    socket.on("saveSubscription", ({ username, subscription }) => {
        pushSubscriptions[username] = subscription;
        console.log("Push Subscription gespeichert für:", username);
    });

    socket.on("login", ({ username }) => {
        if (socket.username === username) return;

        console.log("Login:", username);
        socket.username = username;

        sockets[username] = socket.id;

        onlineUsers = onlineUsers.filter(u => u !== username);
        onlineUsers.push(username);

        io.emit("onlineUsers", onlineUsers);
        socket.emit("groupsUpdated", groups);

        let unread = [];

        Object.keys(chats).forEach(key => {
            chats[key].forEach(msg => {
                if (msg.to === username && msg.unread) unread.push(msg);
            });
        });

        unread.forEach(msg => {
            io.to(socket.id).emit("message", msg);
            msg.unread = false;
        });

        const unreadFrom = [...new Set(unread.map(m => m.from))];
        socket.emit("unreadList", unreadFrom);
    });

    socket.on("loadChat", ({ with: partner }) => {
        const key = [socket.username, partner].sort().join("_");
        if (!chats[key]) chats[key] = [];
        socket.emit("chatHistory", chats[key]);
    });

    socket.on("loadGroupChat", ({ group }) => {
        if (!groupChats[group]) groupChats[group] = [];
        socket.emit("groupChatHistory", groupChats[group]);
    });

    socket.on("message", (msg) => {
        const key = [msg.from, msg.to].sort().join("_");

        msg.id = Date.now() + Math.random();
        msg.unread = true;

        if (!chats[key]) chats[key] = [];
        chats[key].push(msg);

        if (sockets[msg.to]) {
            io.to(sockets[msg.to]).emit("message", msg);
            msg.unread = false;
        }
	console.log("Push für:", msg.to);
console.log("Subscription vorhanden:",
    !!pushSubscriptions[msg.to]);
if (pushSubscriptions[msg.to]) {
    webpush.sendNotification(
        pushSubscriptions[msg.to],
        JSON.stringify({
            title: msg.from,
            body: msg.text ? "Neue Nachricht" : "Neue Datei",
            chat: msg.from
        })
    ).catch(err => console.error("Push Fehler:", err));
}
    });

    socket.on("groupMessage", (msg) => {
        msg.id = Date.now() + Math.random();
        msg.unread = true;

        if (!groupChats[msg.group]) groupChats[msg.group] = [];
        groupChats[msg.group].push(msg);

        groups[msg.group].forEach(member => {
            if (sockets[member] && member !== msg.from) {
                io.to(sockets[member]).emit("groupMessage", msg);
                msg.unread = false;
            }
        });

        groups[msg.group].forEach(member => {
            if (member !== msg.from && pushSubscriptions[member]) {
                webpush.sendNotification(
                    pushSubscriptions[member],
JSON.stringify({
    title: msg.group,
    body: `Neue Nachricht von ${msg.from}`,
    chat: msg.group
})
                ).catch(err => console.error("Push Fehler:", err));
            }
        });
    });

    socket.on("requestUnread", () => {
        let unread = [];

        Object.keys(chats).forEach(key => {
            chats[key].forEach(msg => {
                if (msg.to === socket.username && msg.unread) unread.push(msg);
            });
        });

        unread.forEach(msg => {
            io.to(socket.id).emit("message", msg);
            msg.unread = false;
        });
    });
/* ===========================
   AUDIO CALLS
=========================== */

socket.on("callUser", ({ from, to }) => {

    if (!sockets[to]) return;

    io.to(sockets[to]).emit(
        "incomingCall",
        {
            from
        }
    );

});

socket.on("acceptCall", ({ from, to }) => {

    if (!sockets[to]) return;

    io.to(sockets[to]).emit(
        "callAccepted",
        {
            from
        }
    );

});

socket.on("rejectCall", ({ from, to }) => {

    if (!sockets[to]) return;

    io.to(sockets[to]).emit(
        "callRejected",
        {
            from
        }
    );

});

    socket.on("disconnect", () => {
        if (!socket.username) return;

        const username = socket.username;
        const oldSocketId = socket.id;

        console.log(`Disconnect erkannt: ${username} – warte auf Reconnect...`);

        setTimeout(() => {
            if (sockets[username] && sockets[username] !== oldSocketId) {
                console.log(`User wieder verbunden: ${username}`);
                return;
            }

            if (!sockets[username]) {
                console.log(`User wirklich offline: ${username}`);
                onlineUsers = onlineUsers.filter(u => u !== username);
                io.emit("onlineUsers", onlineUsers);
                return;
            }

            console.log(`User wirklich offline: ${username}`);
            onlineUsers = onlineUsers.filter(u => u !== username);
            delete sockets[username];
            io.emit("onlineUsers", onlineUsers);

        }, 5000);
    });

});

/* ===========================
   SERVER START
=========================== */
http.listen(PORT, () => console.log("Server läuft auf Port", PORT));
