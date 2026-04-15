/* ===========================
   SERVICE WORKER + PUSH
=========================== */

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
        .then(() => console.log("Service Worker registriert"))
        .catch(err => console.error("SW Fehler:", err));
}

/* ===========================
   SOCKET VERBINDUNG
=========================== */

const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500
});

let username = null;
let selectedChat = null; // { type: 'user' | 'group', id: 'Name' }
let groups = {};
let onlineUsers = [];

/* SOUND */
const messageSound = new Audio("dein-sound.mp3");
messageSound.volume = 0.6;

/* ===========================
   AVATARE / FREUNDE / PINS
=========================== */

const avatars = {
    "Chris": "😎",
    "Täubchen": "❤️",
    "Stefan": "👨‍🔧",
    "Michael": "🧔",
    "Andreas": "🐻",
    "Papa": "😘",
    "Mama": "😇",
    "Julia": "😤",
    "Jessica": "💜",
    "Dominic": "😍",
    "Eva": "🤩",
    "Oliver": "😊",
    "Manfred": "🤖",
    "Alexander": "🤓",
};

const friends = [
    "Täubchen","Chris","Stefan","Michael","Andreas","Papa","Mama",
    "Julia","Jessica","Alexander","Eva","Oliver","Manfred","Dominic"
];

const pins = {
    "Chris": "1968",
    "Täubchen": "1966",
    "Papa": "1941",
    "Mama": "1947",
    "Stefan": "1974",
    "Michael": "1967",
    "Andreas": "1993",
    "Julia": "1997",
    "Jessica": "2000",
    "Dominic": "1996",
    "Eva": "1969",
    "Oliver": "1992",
    "Manfred": "1967",
    "Alexander": "1995"
};

/* ===========================
   ENCRYPTION
=========================== */

const SECRET_KEY = "ChristianChatKey2025";

function encrypt(text) {
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
}

function decrypt(cipher) {
    try {
        const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
        return "";
    }
}

/* ===========================
   DOM ELEMENTE
=========================== */

const loginScreen = document.getElementById("loginScreen");
const usernameInput = document.getElementById("usernameInput");
const pinInput = document.getElementById("pinInput");
const loginBtn = document.getElementById("loginBtn");

const chatScreen = document.getElementById("chatScreen");
const groupListDesktop = document.getElementById("groupListDesktop");
const userListDesktop = document.getElementById("userListDesktop");

const chatAvatar = document.getElementById("chatAvatar");
const chatTitle = document.getElementById("chatTitle");
const chatSubTitle = document.getElementById("chatSubTitle");

const messages = document.getElementById("messages");
const emojiSelect = document.getElementById("emojiSelect");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");
const recordBtn = document.getElementById("recordBtnHeader");
const deleteChatBtn = document.getElementById("deleteChatBtn");

/* ===========================
   LOGIN
=========================== */

loginBtn.onclick = () => {
    const name = usernameInput.value.trim();
    const pin = pinInput.value.trim();

    if (!name) return alert("Bitte Namen eingeben.");
    if (!pins[name]) return alert("Diesen Benutzer gibt es nicht.");
    if (pin !== pins[name]) return alert("Falsche PIN!");

    username = name;
    localStorage.username = name;

    socket.emit("login", { username });

    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");

    // Push aktivieren
    if ("serviceWorker" in navigator && "PushManager" in window) {
        subscribeUserToPush();
    }
};

/* Auto-Login nach Reconnect */
socket.on("connect", () => {
    console.log("Verbunden");
    if (localStorage.username && !username) {
        username = localStorage.username;
        socket.emit("login", { username });
    }
});

/* ===========================
   PUSH SUBSCRIPTION
=========================== */

async function subscribeUserToPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: "BLo1QZy9CVxLdlyVgFrwI_pNktRKUQqxSuhnsFI3YaQ1vCLylZ3KalTa1cGQVl61je_buQxhfV6jIPRDmwyV_q8"
        });

        socket.emit("saveSubscription", {
            username,
            subscription
        });

        console.log("Push Subscription gespeichert");
    } catch (err) {
        console.error("Push Subscription Fehler:", err);
    }
}

/* ===========================
   ONLINE USERS / GROUPS
=========================== */

socket.on("onlineUsers", (users) => {
    onlineUsers = users;
    renderLists();
});

socket.on("groupsUpdated", (g) => {
    groups = g || {};
    renderLists();
});

function renderLists() {
    groupListDesktop.innerHTML = "";
    userListDesktop.innerHTML = "";

    // Gruppen
    Object.keys(groups).forEach(groupName => {
        const li = document.createElement("li");
        li.className = "user-item group";
        li.dataset.name = groupName;
        li.innerHTML = `
            <span>👥 ${groupName}</span>
            <span class="redDot" style="display:none;">●</span>
        `;
        li.onclick = () => selectGroup(groupName);
        groupListDesktop.appendChild(li);
    });

    // Freunde
    friends.forEach(name => {
        const emoji = avatars[name] || "👤";
        const isOnline = onlineUsers.includes(name);

        const li = document.createElement("li");
        li.className = "user-item";
        li.dataset.name = name;
        li.innerHTML = `
            <span>${emoji} ${name}</span>
            <span class="redDot" style="display:none;">●</span>
        `;
        if (isOnline) {
            li.style.borderLeft = "3px solid #00c8ff";
        }
        li.onclick = () => selectUser(name);
        userListDesktop.appendChild(li);
    });
}

/* ===========================
   CHAT AUSWAHL
=========================== */

function selectUser(name) {
    selectedChat = { type: "user", id: name };
    const emoji = avatars[name] || "👤";

    chatAvatar.textContent = emoji;
    chatTitle.textContent = `${emoji} ${name}`;
    chatSubTitle.textContent = "";

    messages.innerHTML = "";
    clearRedDot(name);

    socket.emit("loadChat", { with: name });
}

function selectGroup(groupName) {
    selectedChat = { type: "group", id: groupName };

    chatAvatar.textContent = "👥";
    chatTitle.textContent = `👥 ${groupName}`;
    chatSubTitle.textContent = "";

    messages.innerHTML = "";
    clearRedDot(groupName);

    socket.emit("loadGroupChat", { group: groupName });
}

/* ===========================
   CHAT HISTORY
=========================== */

socket.on("chatHistory", (history) => {
    if (!selectedChat || selectedChat.type !== "user") return;
    messages.innerHTML = "";
    history.forEach(msg => renderIncomingHistory(msg, "user"));
});

socket.on("groupChatHistory", (history) => {
    if (!selectedChat || selectedChat.type !== "group") return;
    messages.innerHTML = "";
    history.forEach(msg => renderIncomingHistory(msg, "group"));
});

function renderIncomingHistory(msg, mode) {
    if (msg.image) {
        const decrypted = decrypt(msg.image) || msg.image;
        addImage(decrypted, msg.from === username, msg.from);
    } else if (msg.audio) {
        addAudio(decrypt(msg.audio), msg.from === username, msg.from);
    } else if (msg.video) {
        addVideo(decrypt(msg.video), msg.from === username, msg.from);
    } else if (msg.text) {
        const text = decrypt(msg.text);
        if (mode === "group") {
            addMessage(`${msg.from}: ${text}`, msg.from === username, msg.from);
        } else {
            addMessage(text, msg.from === username, msg.from);
        }
    }
}

/* ===========================
   SENDEN
=========================== */

sendBtn.onclick = sendMessage;
messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
});

function sendMessage() {
    if (!selectedChat) return;

    const text = messageInput.value.trim();
    if (!text) return;

    if (selectedChat.type === "group") {
        const payload = {
            from: username,
            group: selectedChat.id,
            text: encrypt(text)
        };
        socket.emit("groupMessage", payload);
        addMessage(`Ich: ${text}`, true, username);
    } else {
        const payload = {
            from: username,
            to: selectedChat.id,
            text: encrypt(text)
        };
        socket.emit("message", payload);
        addMessage(text, true, username);
    }

    messageInput.value = "";
}

/* ===========================
   EMPFANGEN
=========================== */

socket.on("message", (msg) => {
    const isCurrent =
        selectedChat &&
        selectedChat.type === "user" &&
        (selectedChat.id === msg.from || selectedChat.id === msg.to);

    if (isCurrent) {
        if (msg.image) {
            const decrypted = decrypt(msg.image) || msg.image;
            addImage(decrypted, msg.from === username, msg.from);
        } else if (msg.audio) {
            addAudio(decrypt(msg.audio), msg.from === username, msg.from);
        } else if (msg.video) {
            addVideo(decrypt(msg.video), msg.from === username, msg.from);
        } else if (msg.text) {
            addMessage(decrypt(msg.text), msg.from === username, msg.from);
        }
    } else {
        setRedDot(msg.from);
        chatSubTitle.textContent = `Neue Nachricht von ${msg.from}`;
    }

    if (navigator.vibrate) navigator.vibrate(150);
    messageSound.play().catch(() => {});
});

socket.on("groupMessage", (msg) => {
    const isCurrent =
        selectedChat &&
        selectedChat.type === "group" &&
        selectedChat.id === msg.group;

    const text = decrypt(msg.text);

    if (isCurrent) {
        addMessage(`${msg.from}: ${text}`, msg.from === username, msg.from);
    } else {
        setRedDot(msg.group);
        chatSubTitle.textContent = `Neue Nachricht in ${msg.group}`;
    }

    if (navigator.vibrate) navigator.vibrate(150);
    messageSound.play().catch(() => {});
});

/* ===========================
   RED DOTS
=========================== */

function setRedDot(name) {
    document.querySelectorAll(".user-item").forEach(li => {
        if (li.dataset.name === name) {
            const dot = li.querySelector(".redDot");
            if (dot) dot.style.display = "inline";
        }
    });
}

function clearRedDot(name) {
    document.querySelectorAll(".user-item").forEach(li => {
        if (li.dataset.name === name) {
            const dot = li.querySelector(".redDot");
            if (dot) dot.style.display = "none";
        }
    });
}

/* ===========================
   BUBBLES
=========================== */

function addMessage(text, isMe, fromUser) {
    const div = document.createElement("div");
    div.className = "bubble " + (isMe ? "me" : "them");

    if (!isMe) {
        const emoji = avatars[fromUser] || "👤";
        div.innerHTML = `<strong>${emoji} ${fromUser}:</strong><br>${text}`;
    } else {
        div.textContent = text;
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

/* BILD */

function addImage(src, isMe, fromUser) {
    const div = document.createElement("div");
    div.className = "bubble " + (isMe ? "me" : "them");

    if (!isMe) {
        const emoji = avatars[fromUser] || "👤";
        div.innerHTML = `<strong>${emoji} ${fromUser}:</strong><br>`;
    }

    const img = document.createElement("img");
    img.src = src;
    img.style.maxWidth = "220px";
    img.style.borderRadius = "10px";
    img.style.cursor = "pointer";
    img.onclick = () => openImageFullscreen(src);

    div.appendChild(img);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function openImageFullscreen(src) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.85)";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "9999";
    overlay.onclick = () => overlay.remove();

    const img = document.createElement("img");
    img.src = src;
    img.style.maxWidth = "95%";
    img.style.maxHeight = "95%";

    overlay.appendChild(img);
    document.body.appendChild(overlay);
}

/* VIDEO */

function addVideo(src, isMe, fromUser) {
    const div = document.createElement("div");
    div.className = "bubble " + (isMe ? "me" : "them");

    if (!isMe) {
        const emoji = avatars[fromUser] || "👤";
        div.innerHTML = `<strong>${emoji} ${fromUser}:</strong><br>`;
    }

    const video = document.createElement("video");
    video.controls = true;
    video.src = src;
    video.style.maxWidth = "240px";
    video.style.borderRadius = "10px";

    div.appendChild(video);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

/* AUDIO */

function addAudio(src, isMe, fromUser) {
    const div = document.createElement("div");
    div.className = "bubble " + (isMe ? "me" : "them");

    if (!isMe) {
        const emoji = avatars[fromUser] || "👤";
        div.innerHTML = `<strong>${emoji} ${fromUser}:</strong><br>`;
    }

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = src;

    div.appendChild(audio);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

/* ===========================
   EMOJI
=========================== */

emojiSelect.onchange = () => {
    const emoji = emojiSelect.value;
    if (emoji) {
        messageInput.value += emoji;
        emojiSelect.value = "";
        messageInput.focus();
    }
};

/* ===========================
   FILE UPLOAD (BILD/VIDEO)
=========================== */

fileBtn.onclick = () => fileInput.click();

fileInput.onchange = () => {
    if (!selectedChat || selectedChat.type !== "user") {
        alert("Medien nur in 1:1 Chats.");
        fileInput.value = "";
        return;
    }

    const file = fileInput.files[0];
    if (!file) return;
    fileInput.value = "";

    if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result;
            const encrypted = encrypt(base64);
            socket.emit("message", {
                from: username,
                to: selectedChat.id,
                image: encrypted
            });
            addImage(base64, true, username);
        };
        reader.readAsDataURL(file);
        return;
    }

    if (file.type.startsWith("video/")) {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result;
            const encrypted = encrypt(base64);
            socket.emit("message", {
                from: username,
                to: selectedChat.id,
                video: encrypted
            });
            addVideo(base64, true, username);
        };
        reader.readAsDataURL(file);
        return;
    }

    alert("Dieser Dateityp wird nicht unterstützt.");
};

/* ===========================
   AUDIO RECORD
=========================== */

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

recordBtn.onclick = async () => {
    if (!selectedChat || selectedChat.type !== "user") return;

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: "audio/webm" });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result;
                    const encrypted = encrypt(base64);
                    socket.emit("message", {
                        from: username,
                        to: selectedChat.id,
                        audio: encrypted
                    });
                    addAudio(base64, true, username);
                };
                reader.readAsDataURL(blob);
            };

            mediaRecorder.start();
            isRecording = true;
            recordBtn.textContent = "⏹️";
        } catch {
            alert("Bitte Mikrofon erlauben.");
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.textContent = "🎙️";
    }
};

/* ===========================
   GANZEN CHAT LOKAL LÖSCHEN
=========================== */

deleteChatBtn.onclick = () => {
    if (!selectedChat) return;
    if (!confirm(`Chat mit ${selectedChat.id} lokal leeren?`)) return;
    messages.innerHTML = "";
    chatSubTitle.textContent = "";
};
