/* ===========================
   GRUNDVARIABLEN
=========================== */
let socket;
let nickname = "";
let selectedFriend = "";

/* ===========================
   AVATARE
=========================== */
const avatars = {
  "Chris": "😎",
  "Täubchen": "❤️",
  "Stefan": "👨‍🔧",
  "Mike": "🤩",
  "Eltern": "😘"
};

function getAvatar(name) {
  return avatars[name] || "🙂";
}

/* ===========================
   DEBUG OVERLAY
=========================== */
function logStatus(msg) {
  const box = document.getElementById("debugStatus");
  if (box) box.textContent += `🟢 ${msg}\n`;
}

/* ===========================
   AUTO-SCROLL
=========================== */
function autoScroll() {
  const chat = document.getElementById("chatLog");
  setTimeout(() => {
    chat.scrollTop = chat.scrollHeight;
  }, 0);
}

/* ===========================
   TEXT-BLASE
=========================== */
function renderTextBubble({ sender, text, isOwn }) {
  const chat = document.getElementById("chatLog");

  const row = document.createElement("div");
  row.className = "msg-row";
  if (isOwn) row.classList.add("me");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = getAvatar(sender);

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (isOwn) bubble.classList.add("me");
  bubble.innerHTML = `<strong>${sender}:</strong> ${text}`;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chat.appendChild(row);

  autoScroll();
}

/* ===========================
   DATEI-BLASE
=========================== */
function renderFileBubble({ sender, isOwn, isImage, base64, filename }) {
  const chat = document.getElementById("chatLog");

  const row = document.createElement("div");
  row.className = "msg-row";
  if (isOwn) row.classList.add("me");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = getAvatar(sender);

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (isOwn) bubble.classList.add("me");

  bubble.innerHTML = `<strong>${sender}:</strong><br>`;

  if (isImage) {
    const img = document.createElement("img");
    img.src = base64;
    img.style.maxWidth = "160px";
    img.style.borderRadius = "10px";
    bubble.appendChild(img);
  } else {
    bubble.innerHTML += `📎 ${filename}<br>`;
    const link = document.createElement("a");
    link.href = base64;
    link.download = filename;
    link.textContent = "Download";
    bubble.appendChild(link);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  chat.appendChild(row);

  autoScroll();
}

/* ===========================
   SOCKET.IO VERBINDUNG
=========================== */
function connect() {
  logStatus("Socket.io connect() gestartet");

  socket = io("/", {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: Infinity
  });

  socket.on("connect", () => {
    logStatus("Socket.io verbunden");
    document.getElementById("connectionStatus").textContent = "🟢 Verbunden";

    socket.emit("sessionStart", { nickname });
  });

  socket.on("disconnect", () => {
    logStatus("Socket.io getrennt");
    document.getElementById("connectionStatus").textContent = "🔴 Getrennt";
  });

  socket.on("text", (data) => {
    if (data.sender === nickname) return;

    renderTextBubble({
      sender: data.sender,
      text: data.text,
      isOwn: false
    });
  });

  socket.on("file", (data) => {
    if (data.sender === nickname) return;

    renderFileBubble({
      sender: data.sender,
      isOwn: false,
      isImage: data.isImage,
      base64: data.base64,
      filename: data.filename
    });
  });
}

/* ===========================
   WAKE-PING (iPhone Fix)
=========================== */
setInterval(() => {
  if (socket && socket.connected) {
    socket.emit("ping");
  }
}, 30000);

/* ===========================
   UI LOGIK
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  logStatus("DOM geladen");

  const debugBox = document.createElement("pre");
  debugBox.id = "debugStatus";
  debugBox.style =
    "background:#eee; padding:8px; font-size:13px; margin-top:10px; white-space:pre-wrap;";
  document.body.appendChild(debugBox);

  /* Name laden */
  const nicknameSelect = document.getElementById("nicknameSelect");
  const savedName = localStorage.getItem("myName");

  nickname = savedName || nicknameSelect.value;
  nicknameSelect.value = nickname;

  nicknameSelect.addEventListener("change", (e) => {
    nickname = e.target.value;
    localStorage.setItem("myName", nickname);
    connect();
  });

  /* Freund laden */
  const friendSelect = document.getElementById("friendSelect");
  const savedFriend = localStorage.getItem("chatPartner");

  selectedFriend = savedFriend || friendSelect.value;
  friendSelect.value = selectedFriend;

  friendSelect.addEventListener("change", (e) => {
    selectedFriend = e.target.value;
    localStorage.setItem("chatPartner", selectedFriend);
  });

  /* Text senden */
  document.getElementById("sendButton").addEventListener("click", () => {
    const text = document.getElementById("messageInput").value.trim();
    if (!text || !selectedFriend) return;

    socket.emit("text", {
      sender: nickname,
      recipient: selectedFriend,
      text
    });

    renderTextBubble({
      sender: nickname,
      text,
      isOwn: true
    });

    document.getElementById("messageInput").value = "";
  });

  /* Emoji */
  document.getElementById("emojiButton").addEventListener("click", () => {
    const input = document.getElementById("messageInput");
    input.value += "😊";
    input.focus();
  });

  /* Datei senden */
  document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      socket.emit("file", {
        sender: nickname,
        recipient: selectedFriend,
        filename: file.name,
        base64: reader.result,
        isImage: file.type.startsWith("image/")
      });

      renderFileBubble({
        sender: nickname,
        isOwn: true,
        isImage: file.type.startsWith("image/"),
        base64: reader.result,
        filename: file.name
      });
    };

    reader.readAsDataURL(file);
  });

  connect();
});
