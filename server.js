const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const webpush = require("web-push");
const fs = require("fs");

// Render Port oder lokal
const PORT = process.env.PORT || 3001;

// statische Dateien
app.use(express.static(__dirname));

/* ===========================
   JSON-DATEI LADEN / SPEICHERN
=========================== */

const DATA_FILE = "./json.js";

function loadData() {
    delete require.cache[require.resolve(DATA_FILE)];
    return require(DATA_FILE);
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, "module.exports = " + JSON.stringify(data, null, 2));
}

/* ===========================
   DATEN LADEN
=========================== */

let { chats, groupChats, groups, pushSubscriptions } = loadData();
let sockets = {};
let onlineUsers = [];

/* ===========================
   PUSH VAPID KEYS
=========================== */

webpush.setVapidDetails(
    "mailto:deine@mail.com",
    "BLo1QZy9CVxLdlyVgFrwI_pNktRKUQqxSuhnsFI3YaQ1vCLylZ3KalTa1cGQVl61je_buQxhfV6jIPRDmwyV_q8",
    "jQZxSv9R7eS7o7mYtaY8CwxeCJopH1-BBZUeUkoU2Ys"
);

/* ===========================
   SOCKET.IO
=========================== */

io.on("connection", (socket) => {

    /* PUSH SUBSCRIPTION SPEICHERN */
    socket.on("saveSubscription", ({ username, subscription }) => {
        pushSubscriptions[username] = subscription;
        saveData({ chats, groupChats, groups, pushSubscriptions });
        console.log("Push gespeichert für:", username);
    });

    /* LOGIN */
    socket.on("login", ({ username }) => {
        if (socket.username === username) return;

        socket.username = username;
        sockets[username] = socket.id;

        onlineUsers = onlineUsers.filter(u => u !== username);
        onlineUsers.push(username);

        io.emit("onlineUsers", onlineUsers);
        socket.emit("groupsUpdated", groups);

        // UNREAD
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

        saveData({ chats, groupChats, groups, pushSubscriptions });
    });

    /* PRIVATCHAT LADEN */
    socket.on("loadChat", ({ with: partner }) => {
        const key = [socket.username, partner].sort().join("_");
        if (!chats[key]) chats[key] = [];
        socket.emit("chatHistory", chats[key]);
    });

    /* GRUPPENCHAT LADEN */
    socket.on("loadGroupChat", ({ group }) => {
        if (!groupChats[group]) groupChats[group] = [];
        socket.emit("groupChatHistory", groupChats[group]);
    });

    /* PRIVATNACHRICHT */
    socket.on("message", (msg) => {
        const key = [msg.from, msg.to].sort().join("_");

        msg.id = Date.now() + Math.random();
        msg.unread = true;

        if (!chats[key]) chats[key] = [];
        chats[key].push(msg);

        // Empfänger online?
        if (sockets[msg.to]) {
            io.to(sockets[msg.to]).emit("message", msg);
            msg.unread = false;
        }

        // Push
        if (pushSubscriptions[msg.to]) {
            webpush.sendNotification(
                pushSubscriptions[msg.to],
                JSON.stringify({
                    title: msg.from,
                    body: msg.text ? "Neue Nachricht" : "Neue Datei"
                })
            ).catch(err => console.error("Push Fehler:", err));
        }

        saveData({ chats, groupChats, groups, pushSubscriptions });
    });

    /* GRUPPENNACHRICHT */
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
                        body: `Neue Nachricht von ${msg.from}`
                    })
                ).catch(err => console.error("Push Fehler:", err));
            }
        });

        saveData({ chats, groupChats, groups, pushSubscriptions });
    });

    /* DISCONNECT */
    socket.on("disconnect", () => {
        if (!socket.username) return;

        const username = socket.username;
        const oldSocketId = socket.id;

        console.log(`Disconnect: ${username} – warte auf Reconnect...`);

        setTimeout(() => {
            if (sockets[username] && sockets[username] !== oldSocketId) {
                console.log(`User wieder verbunden: ${username}`);
                return;
            }

            if (!sockets[username]) {
                console.log(`User offline: ${username}`);
                onlineUsers = onlineUsers.filter(u => u !== username);
                io.emit("onlineUsers", onlineUsers);
                return;
            }

            console.log(`User offline: ${username}`);
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
