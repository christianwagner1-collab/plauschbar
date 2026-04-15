// =======================================
// SOCKET.IO VERBINDUNG
// =======================================
const socket = io("https://plauschbar.onrender.com", {
    transports: ["websocket"]
});

// =======================================
// DOM ELEMENTE
// =======================================
const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");
const usernameInput = document.getElementById("username");
const pinInput = document.getElementById("pin");
const startButton = document.getElementById("startButton");
const messagesContainer = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

// =======================================
// LOGIN
// =======================================
startButton.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    const pin = pinInput.value.trim();

    if (!username || !pin) {
        alert("Bitte Name und PIN eingeben.");
        return;
    }

    socket.emit("login", { username, pin });

    loginScreen.style.display = "none";
    chatScreen.style.display = "block";

    socket.emit("requestUnread");
});

// =======================================
// CHAT LADEN
// =======================================
socket.on("chatHistory", (history) => {
    messagesContainer.innerHTML = "";
    history.forEach(msg => addMessage(msg));
});

// =======================================
// NACHRICHT SENDEN
// =======================================
sendButton.addEventListener("click", () => {
    const text = messageInput.value.trim();
    if (!text) return;

    const msg = {
        from: usernameInput.value,
        to: "global",
        text,
        time: Date.now()
    };

    socket.emit("sendMessage", msg);
    addMessage(msg);

    messageInput.value = "";
});

// =======================================
// NACHRICHT EMPFANGEN
// =======================================
socket.on("privateMessage", (msg) => {
    addMessage(msg);
});

socket.on("groupMessage", (msg) => {
    addMessage(msg);
});

// =======================================
// NACHRICHT ANZEIGEN
// =======================================
function addMessage(msg) {
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `
        <strong>${msg.from}:</strong> ${msg.text}
        <div class="time">${new Date(msg.time).toLocaleTimeString()}</div>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// =======================================
// PUSH SUBSCRIPTION
// =======================================
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").then(reg => {
        return reg.pushManager.getSubscription().then(sub => {
            if (!sub) {
                return reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: "BJW8x8..." // dein VAPID Key
                });
            }
            return sub;
        });
    }).then(subscription => {
        socket.emit("saveSubscription", {
            username: usernameInput.value,
            subscription
        });
    });
}
