const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: { origin: "*" }
});

// ===============================
// JSON-Datenbank laden
// ===============================
const DB_FILE = path.join(__dirname, "json.js");

function loadDB() {
    try {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        return JSON.parse(raw);
    } catch (err) {
        console.log("⚠️ json.js nicht gefunden oder leer – neue Datei wird erstellt.");
        return { users: {}, groups: {}, messages: {} };
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ===============================
// STATIC FILES
// ===============================
app.use(express.static(__dirname));

// ===============================
// SOCKET.IO
// ===============================
io.on("connection", (socket) => {
    console.log("🔌 Neuer Client verbunden:", socket.id);

    // LOGIN
    socket.on("login", ({ username }) => {
        console.log("🔐 Login:", username);

        db.users[username] = { online: true };
        saveDB();

        socket.username = username;

        // Online-Liste senden
        io.emit("onlineUsers", Object.keys(db.users).filter(u => db.users[u].online));
    });

    // UNREAD
    socket.on("requestUnread", () => {
        if (!socket.username) return;

        const msgs = db.messages[socket.username] || [];
        socket.emit("chatHistory", msgs);
    });

    // 1:1 CHAT LADEN
    socket.on("loadChat", ({ with: partner }) => {
        if (!socket.username) return;

        const keyA = `${socket.username}__${partner}`;
        const keyB = `${partner}__${socket.username}`;

        const history = db.messages[keyA] || db.messages[keyB] || [];
        socket.emit("chatHistory", history);
    });

    // GRUPPENCHAT LADEN
    socket.on("loadGroupChat", ({ group }) => {
        const history = db.messages[group] || [];
        socket.emit("groupChatHistory", history);
    });

    // TEXT SENDEN
    socket.on("sendMessage", (msg) => {
        const key = msg.toGroup
            ? msg.toGroup
            : `${msg.from}__${msg.to}`;

        if (!db.messages[key]) db.messages[key] = [];
        db.messages[key].push(msg);

        saveDB();

        if (msg.toGroup) {
            io.emit("groupMessage", msg);
        } else {
            io.emit("privateMessage", msg);
        }
    });

    // PUSH SUBSCRIPTION
    socket.on("saveSubscription", ({ username, subscription }) => {
        if (!db.users[username]) db.users[username] = {};
        db.users[username].subscription = subscription;
        saveDB();
    });

    // DISCONNECT
    socket.on("disconnect", () => {
        if (socket.username && db.users[socket.username]) {
            db.users[socket.username].online = false;
            saveDB();
        }

        io.emit("onlineUsers", Object.keys(db.users).filter(u => db.users[u].online));
        console.log("❌ Client getrennt:", socket.id);
    });
});

// ===============================
// SERVER START
// ===============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("🚀 Server läuft auf Port", PORT);
});
