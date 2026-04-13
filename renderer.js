let socket;
let nickname = "";
let selectedFriend = "";

// Avatar‑Mapping
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

function logStatus(msg) {
  const box = document.getElementById("debugStatus");
  if (box) box.textContent += `🟢 ${msg}\n`;
}

/* ===========================
   Auto‑Scroll (iOS‑sicher)
=========================== */
function autoScroll() {
  const chat = document.getElementById("chatLog");
  setTimeout(() => {
    chat.scrollTop = chat.scrollHeight;
  }, 0);
}

/* ===========================
   Text‑Blase
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
   Datei / Bild‑Blase
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
   WebSocket (NEU & RICHTIG)
=========================== */
function connect() {
  logStatus("connect() gestartet");

  // ⭐ AUTOMATISCH richtig — lokal & Tailscale
  const wsUrl = `${location.origin.replace(/^http/, "ws")}/api/socket`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    logStatus("WebSocket verbunden");
    document.getElementById("connectionStatus").textContent = "🟢 Verbunden";

    socket.send(JSON.stringify({ type: "sessionStart", nickname }));
    logStatus(`sessionStart gesendet: ${nickname}`);
  };

  socket.onclose = () => {
    logStatus("WebSocket getrennt");
    document.getElementById("connectionStatus").textContent = "🔴 Getrennt";
    setTimeout(connect, 1000);
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.sender === nickname) return;

    if (data.type === "text") {
      renderTextBubble({
        sender: data.sender,
        text: data.text,
        isOwn: false
      });
      return;
    }

    if (data.type === "file") {
      renderFileBubble({
        sender: data.sender,
        isOwn: false,
        isImage: data.isImage,
        base64: data.base64,
        filename: data.filename
      });
      return;
    }
  };

  socket.onerror = (err) => {
    logStatus("WebSocket Fehler");
    console.error("WebSocket Fehler:", err);
  };
}

/* ===========================
   UI‑Logik
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  logStatus("DOM vollständig geladen");

  const debugBox = document.createElement("pre");
  debugBox.id = "debugStatus";
  debugBox.style =
    "background:#eee; padding:8px; font-size:13px; margin-top:10px; white-space:pre-wrap;";
  document.body.appendChild(debugBox);
  logStatus("Debug-Overlay aktiv");

  /* Name laden */
  const nicknameSelect = document.getElementById("nicknameSelect");
  const savedName = localStorage.getItem("myName");

  nickname = savedName || nicknameSelect.value;
  nicknameSelect.value = nickname;

  nicknameSelect.addEventListener("change", (e) => {
    nickname = e.target.value;
    localStorage.setItem("myName", nickname);
    logStatus(`Eigener Name geändert: ${nickname}`);
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
    logStatus(`Chatpartner ausgewählt: ${selectedFriend}`);
  });

  /* Freund hinzufügen */
  document.getElementById("addFriendButton").addEventListener("click", () => {
    const input = document.getElementById("newFriendInput");
    const name = input.value.trim();
    if (!name) return;

    const exists = Array.from(friendSelect.options).some(
      (opt) => opt.value === name
    );

    if (!exists) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      friendSelect.appendChild(option);
    }

    friendSelect.value = name;
    selectedFriend = name;
    localStorage.setItem("chatPartner", name);

    input.value = "";
    logStatus(`Freund hinzugefügt: ${name}`);
  });

  /* Text senden */
  document.getElementById("sendButton").addEventListener("click", () => {
    const text = document.getElementById("messageInput").value.trim();
    if (!text || !selectedFriend || socket.readyState !== WebSocket.OPEN) {
      logStatus("Senden fehlgeschlagen");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "text",
        sender: nickname,
        recipient: selectedFriend,
        text,
      })
    );

    renderTextBubble({
      sender: nickname,
      text,
      isOwn: true
    });

    document.getElementById("messageInput").value = "";
    logStatus(`Nachricht gesendet an ${selectedFriend}`);
  });

  /* Emoji */
  document.getElementById("emojiButton").addEventListener("click", () => {
    const input = document.getElementById("messageInput");
    input.value += "😊";
    input.focus();
    logStatus("Emoji hinzugefügt");
  });

  /* Datei senden */
  document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    document.getElementById("fileLabel").textContent =
      file?.name || "Keine Datei ausgewählt";
    logStatus("Datei ausgewählt");

    if (!file || socket.readyState !== WebSocket.OPEN) {
      logStatus("Datei senden fehlgeschlagen");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      socket.send(
        JSON.stringify({
          type: "file",
          sender: nickname,
          recipient: selectedFriend,
          filename: file.name,
          base64: reader.result,
          isImage: file.type.startsWith("image/"),
        })
      );

      renderFileBubble({
        sender: nickname,
        isOwn: true,
        isImage: file.type.startsWith("image/"),
        base64: reader.result,
        filename: file.name
      });

      logStatus(`Datei gesendet: ${file.name}`);
    };

    reader.readAsDataURL(file);
  });

  connect();
});
