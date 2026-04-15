/* ===========================
   PUSH SERVICE WORKER
=========================== */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("Service Worker registriert"))
    .catch(err => console.error("SW Fehler:", err));
}

/* ===========================
   TEIL 1 — BASIS & LOGIN
=========================== */

// ============================
// SOCKET VERBINDUNG MIT AUTO-RECONNECT
// ============================
const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500
});


// --- AUTOMATISCH WIEDER EINLOGGEN ---
socket.on("connect", () => {
   if (selectedChat) {
    if (selectedChat.type === "user") {
        socket.emit("loadChat", { with: selectedChat.id });
    } else {
        socket.emit("loadGroupChat", { group: selectedChat.id });
    }
}

    console.log("Verbunden!");

    if (localStorage.username) {
        username = localStorage.username;
        socket.emit("login", { username });
    }
});

// ============================
// WAKE-SYNC: Neue Nachrichten abrufen,
// sobald die App wieder sichtbar wird
// ============================
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        console.log("🔄 Wake-Sync: App wieder sichtbar");

        // Verbindung sicherstellen
        if (socket.disconnected && !socket.connecting) {
            socket.connect();
        }

        // Automatisch einloggen
        if (localStorage.username) {
            username = localStorage.username;
            socket.emit("login", { username });
        }

        // Ungelesene Nachrichten abrufen
        socket.emit("requestUnread");
    }
});


// --- AUTOMATISCHES WIEDERVERBINDEN ---
socket.on("disconnect", () => {
    console.log("Verbindung verloren – versuche erneut zu verbinden…");
});

socket.on("reconnect", () => {
    console.log("Wieder verbunden!");

    if (localStorage.username) {
        username = localStorage.username;
        socket.emit("login", { username });
    }
});

// --- LOGIN-FUNKTION ---
function doLogin(username) {
    localStorage.username = username;

    socket.emit("login", { username });
    socket.emit("requestUnread");

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("chatScreen").style.display = "block";
}

// --- PING CHECK ---
let unread = {};
setInterval(() => {
    socket.emit("pingCheck");
}, 20000);

// --- SOUND ---
const messageSound = new Audio("dein-sound.mp3");
messageSound.volume = 0.6;

/* AVATARS */
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

let groups = {};
let username = null;
let selectedUser = null;
let onlineUsers = [];

/* ===========================
   PUSH SUBSCRIPTION FUNKTION
=========================== */

async function subscribeUserToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: "BLo1QZy9CVxLdlyVgFrwI_pNktRKUQqxSuhnsFI3YaQ1vCLylZ3KalTa1cGQVl61je_buQxhfV6jIPRDmwyV_q8"
    });

    socket.emit("saveSubscription", {
      username: username,
      subscription: subscription
    });

    console.log("Push Subscription gespeichert");
  } catch (err) {
    console.error("Push Subscription Fehler:", err);
  }
}

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let typingTimeout = null;

/* ENCRYPTION */
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

/* DOWNLOAD */
function downloadBase64(filename, base64) {
  const a = document.createElement("a");
  a.href = base64;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ELEMENTS */
const loginScreen = document.getElementById("loginScreen");
const usernameInput = document.getElementById("usernameInput");
const loginBtn = document.getElementById("loginBtn");
const pinInput = document.getElementById("pinInput");

const chatScreen = document.getElementById("chatScreen");
const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");

fileBtn.onclick = () => {
  fileInput.click();
};

const sidebarOverlay = document.getElementById("sidebarOverlay");
const openSidebarBtn = document.getElementById("openSidebarBtn");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");

const userListMobile = document.getElementById("userList");
const userListDesktop = document.getElementById("userListDesktop");

const chatTitle = document.getElementById("chatTitle");
const chatAvatar = document.getElementById("chatAvatar");
const chatSubTitle = document.getElementById("chatSubTitle");
const groupMembersBox = document.getElementById("groupMembers");

const emojiSelect = document.getElementById("emojiSelect");
const deleteChatBtn = document.getElementById("deleteChatBtn");
const recordBtn = document.getElementById("recordBtnHeader");
const addToGroupBtn = document.getElementById("addToGroupBtn");
const removeFromGroupBtn = document.getElementById("removeFromGroupBtn");

/* PIN-LISTE */
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

/* LOGIN */
loginBtn.onclick = () => {
  const name = usernameInput.value.trim();
  const pin = pinInput.value.trim();

  if (!name) return alert("Bitte Namen eingeben.");
  if (!pins[name]) return alert("Diesen Benutzer gibt es nicht.");
  if (pin !== pins[name]) return alert("Falsche PIN!");

  username = name;
  localStorage.username = name;

  socket.emit("login", { username });
  socket.emit("requestUnread");

  loginScreen.style.display = "none";
  chatScreen.style.display = "flex";

  // ⭐ Push aktivieren
  if ("serviceWorker" in navigator && "PushManager" in window) {
    subscribeUserToPush();
  }
};

/* ONLINE USERS */
socket.on("onlineUsers", (users) => {
  onlineUsers = users;
  renderFriends();
});

/* GROUPS UPDATED */
socket.on("groupsUpdated", (g) => {
  groups = g;
  renderFriends();
});

/* FREUNDE RENDERN */
function renderFriends() {
  userListMobile.innerHTML = "";
  userListDesktop.innerHTML = "";

  friends.forEach((name) => {
    const emoji = avatars[name] || "👤";
    const isOnline = onlineUsers.includes(name);

    const li = document.createElement("li");
    li.className = "user-item";
    li.dataset.name = name;

    li.innerHTML = `
      <div class="status-dot ${isOnline ? "online" : ""}"></div>
      <span class="friendName">${emoji} ${name}</span>
      <span class="redDot" style="display:none;">●</span>
    `;

    li.querySelector(".friendName").onclick = () => selectUser(name);

    const li2 = li.cloneNode(true);
    li2.querySelector(".friendName").onclick = () => selectUser(name);

    userListMobile.appendChild(li);
    userListDesktop.appendChild(li2);
  });

  Object.keys(groups).forEach(groupName => {
    const li = document.createElement("li");
    li.className = "user-item group";
    li.dataset.name = groupName;
    li.onclick = () => selectGroup(groupName);

    li.innerHTML = `
      <div class="status-dot group"></div>
      <span>👥 ${groupName}</span>
      <span class="redDot" style="display:none;">●</span>
    `;

    const li2 = li.cloneNode(true);
    li2.onclick = () => selectGroup(groupName);

    userListMobile.appendChild(li);
    userListDesktop.appendChild(li2);
  });
}

/* USER AUSWÄHLEN */
function selectUser(name) {
  selectedUser = name;
  const emoji = avatars[name] || "👤";

  chatAvatar.textContent = emoji;
  chatTitle.textContent = `${emoji} ${name}`;
  chatSubTitle.textContent = "";
  groupMembersBox.textContent = "";

  messages.innerHTML = "";
  clearRedDot(name);

  socket.emit("loadChat", { with: name });

  socket.emit("markAsRead", {
    user: username,
    with: name
  });
}

/* GRUPPE AUSWÄHLEN */
function selectGroup(groupName) {
  selectedUser = groupName;

  chatAvatar.textContent = "👥";
  chatTitle.textContent = `👥 ${groupName}`;
  chatSubTitle.textContent = "";

  groupMembersBox.textContent =
    "Mitglieder: " + groups[groupName].join(", ");

  messages.innerHTML = "";
  clearRedDot(groupName);

  socket.emit("loadGroupChat", { group: groupName });
}

/* ===========================
   TEIL 2 — CHAT & MEDIEN
=========================== */

/* CHAT HISTORY (1:1) */
socket.on("chatHistory", (history) => {
  messages.innerHTML = "";
  history.forEach(msg => {
    if (msg.image) {
      let decrypted = decrypt(msg.image);
      if (!decrypted || decrypted.length < 50) decrypted = msg.image;
      addImage(decrypted, msg.from === username, msg.from, msg.id);

    } else if (msg.audio) {
      addAudio(decrypt(msg.audio), msg.from === username, msg.from, msg.id);

    } else if (msg.video) {
      addVideo(decrypt(msg.video), msg.from === username, msg.from, msg.id);

    } else if (msg.text) {
      addMessage(decrypt(msg.text), msg.from === username, msg.from, msg.id);
    }
  });
});

/* GROUP HISTORY */
socket.on("groupChatHistory", (history) => {
  messages.innerHTML = "";
  history.forEach(msg => {
    addMessage(decrypt(msg.text), msg.from === username, msg.from, msg.id);
  });
});

/* SEND MESSAGE */
sendBtn.onclick = sendMessage;
messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  if (!selectedUser) return;

  const text = messageInput.value.trim();
  if (!text) return;

  const id = Date.now() + Math.random();

  if (groups[selectedUser]) {
    socket.emit("groupMessage", {
      from: username,
      group: selectedUser,
      text: encrypt(text),
      time: Date.now(),
      id
    });

    addMessage(text, true, username, id);

  } else {
    socket.emit("message", {
      from: username,
      to: selectedUser,
      text: encrypt(text),
      time: Date.now(),
      id
    });

    addMessage(text, true, username, id);
  }

  messageInput.value = "";
}

/* RECEIVE 1:1 */
socket.on("message", (msg) => {
  const isCurrentChat = selectedUser === msg.from;

  if (msg.image) {
    let decrypted = decrypt(msg.image);
    if (!decrypted || decrypted.length < 50) decrypted = msg.image;
    addImage(decrypted, msg.from === username, msg.from, msg.id);

  } else if (msg.audio) {
    addAudio(decrypt(msg.audio), msg.from === username, msg.from, msg.id);

  } else if (msg.video) {
    addVideo(decrypt(msg.video), msg.from === username, msg.from, msg.id);

  } else if (msg.text) {
    addMessage(decrypt(msg.text), msg.from === username, msg.from, msg.id);
  }

  if (!isCurrentChat) {
    setRedDot(msg.from);
    const emoji = avatars[msg.from] || "👤";
    chatSubTitle.textContent = `Neue Nachricht von ${emoji} ${msg.from}`;
  }

  if (navigator.vibrate) navigator.vibrate(200);
  messageSound.play().catch(() => {});
});

/* RECEIVE GROUP */
socket.on("groupMessage", (msg) => {
  const isCurrentGroup = selectedUser === msg.group;

  addMessage(
    decrypt(msg.text),
    msg.from === username,
    msg.from,
    msg.id
  );

  if (!isCurrentGroup) {
    setRedDot(msg.group);
    chatSubTitle.textContent = `Neue Nachricht in ${msg.group}`;
  }

  if (navigator.vibrate) navigator.vibrate(200);
  messageSound.play().catch(() => {});
});

/* TYPING */
socket.on("typing", ({ from, to }) => {
  if (to !== username || from !== selectedUser) return;
  const emoji = avatars[from] || "👤";
  chatSubTitle.textContent = `${emoji} ${from} schreibt…`;
});

socket.on("stopTyping", ({ from, to }) => {
  if (to !== username || from !== selectedUser) return;
  chatSubTitle.textContent = "";
});

/* MESSAGES READ */
socket.on("messagesRead", ({ by }) => {
  if (selectedUser === by) {
    clearRedDot(by);
  }
});

/* RED DOT */
function setRedDot(user) {
  document.querySelectorAll(".user-item").forEach(li => {
    if (li.dataset.name === user) {
      li.querySelector(".redDot").style.display = "inline";
    }
  });
}

function clearRedDot(user) {
  document.querySelectorAll(".user-item").forEach(li => {
    if (li.dataset.name === user) {
      li.querySelector(".redDot").style.display = "none";
    }
  });
}

/* TEXT BUBBLE */
function addMessage(text, isMe, fromUser, id) {
  const div = document.createElement("div");
  div.className = "bubble " + (isMe ? "me" : "them");
  div.dataset.id = id;

  if (!isMe) {
    const emoji = avatars[fromUser] || "👤";
    div.innerHTML = `<strong>${emoji} ${fromUser}:</strong><br>${text}`;
  } else {
    div.innerHTML = `
      <span class="myText">${text}</span>
      <button class="deleteMsgBtn">🗑️</button>
    `;
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  if (isMe) {
    const btn = div.querySelector(".deleteMsgBtn");
    btn.onclick = () => {
      if (!confirm("Diese Nachricht wirklich löschen?")) return;

      div.classList.add("bubble-delete");
      setTimeout(() => {
        socket.emit("deleteMessage", {
          id,
          user: username,
          with: selectedUser
        });
        div.remove();
      }, 200);
    };
  }
}

/* ===========================
   TEIL 3 — MEDIEN & UI
=========================== */

/* BILD */
function addImage(src, isMe, fromUser, id) {
  const div = document.createElement("div");
  div.className = "bubble " + (isMe ? "me" : "them");
  div.dataset.id = id;

  if (!isMe) {
    const emoji = avatars[fromUser] || "👤";
    div.innerHTML = `<strong>${emoji} ${fromUser}:</strong><br>`;
  }

  const img = document.createElement("img");
  img.src = src;
  img.style.maxWidth = "200px";
  img.style.borderRadius = "8px";
  img.style.cursor = "pointer";
  img.onclick = () => openImageFullscreen(src);

  if (isMe) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "6px";

    wrapper.appendChild(img);

    const dl = document.createElement("button");
    dl.textContent = "⬇️";
    dl.className = "downloadBtn";
    dl.onclick = () => downloadBase64("bild.jpg", src);
    wrapper.appendChild(dl);

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.className = "deleteMsgBtn";
    del.onclick = () => {
      if (!confirm("Dieses Bild wirklich löschen?")) return;
      div.classList.add("bubble-delete");
      setTimeout(() => {
        socket.emit("deleteMessage", {
          id,
          user: username,
          with: selectedUser
        });
        div.remove();
      }, 200);
    };
    wrapper.appendChild(del);

    div.appendChild(wrapper);
  } else {
    div.appendChild(img);
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

/* BILD VOLL BILD */
function openImageFullscreen(src) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.8)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "9999";
  overlay.onclick = () => overlay.remove();

  const img = document.createElement("img");
  img.src = src;
  img.style.maxWidth = "95%";
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

/* VIDEO */
function addVideo(src, isMe, fromUser, id) {
  const div = document.createElement("div");
  div.className = "bubble " + (isMe ? "me" : "them");
  div.dataset.id = id;

  if (!isMe) {
    const emoji = avatars[fromUser] || "👤";
    div.innerHTML = `<strong>${emoji} ${fromUser}:</strong><br>`;
  }

  const video = document.createElement("video");
  video.controls = true;
  video.src = src;
  video.style.maxWidth = "250px";
  video.style.borderRadius = "8px";

  if (isMe) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "6px";

    wrapper.appendChild(video);

    const dl = document.createElement("button");
    dl.textContent = "⬇️";
    dl.className = "downloadBtn";
    dl.onclick = () => downloadBase64("video.mp4", src);
    wrapper.appendChild(dl);

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.className = "deleteMsgBtn";
    del.onclick = () => {
      if (!confirm("Dieses Video wirklich löschen?")) return;
      div.classList.add("bubble-delete");
      setTimeout(() => {
        socket.emit("deleteMessage", {
          id,
          user: username,
          with: selectedUser
        });
        div.remove();
      }, 200);
    };
    wrapper.appendChild(del);

    div.appendChild(wrapper);
  } else {
    div.appendChild(video);
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

/* AUDIO */
function addAudio(src, isMe, fromUser, id) {
  const div = document.createElement("div");
  div.className = "bubble " + (isMe ? "me" : "them");
  div.dataset.id = id;

  if (!isMe) {
    const emoji = avatars[fromUser] || "👤";
    div.innerHTML = `<strong>${emoji} ${fromUser}:</strong><br>`;
  }

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = src;

  if (isMe) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "6px";

    wrapper.appendChild(audio);

    const dl = document.createElement("button");
    dl.textContent = "⬇️";
    dl.className = "downloadBtn";
    dl.onclick = () => downloadBase64("audio.webm", src);
    wrapper.appendChild(dl);

    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.className = "deleteMsgBtn";
    del.onclick = () => {
      if (!confirm("Diese Sprachnachricht wirklich löschen?")) return;
      div.classList.add("bubble-delete");
      setTimeout(() => {
        socket.emit("deleteMessage", {
          id,
          user: username,
          with: selectedUser
        });
        div.remove();
      }, 200);
    };
    wrapper.appendChild(del);

    div.appendChild(wrapper);
  } else {
    div.appendChild(audio);
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

/* SERVER MELDET: NACHRICHT GELÖSCHT */
socket.on("messageDeleted", ({ id }) => {
  const bubble = document.querySelector(`.bubble[data-id="${id}"]`);
  if (bubble) {
    bubble.classList.add("bubble-delete");
    setTimeout(() => bubble.remove(), 200);
  }
});

/* EMOJI */
emojiSelect.onchange = () => {
  const emoji = emojiSelect.value;
  if (emoji) {
    messageInput.value += emoji;
    emojiSelect.value = "";
    messageInput.focus();
  }
};

/* FILE UPLOAD (BILD + VIDEO, ohne Kompression) */
fileInput.onchange = async () => {
  if (!selectedUser) return;
  if (groups[selectedUser]) {
    alert("Medien können nur in 1:1 Chats gesendet werden.");
    return;
  }

  const file = fileInput.files[0];
  if (!file) return;

  fileInput.value = "";
  const id = Date.now() + Math.random();

  // ⭐ BILDER
  if (file.type.startsWith("image/")) {
    const reader = new FileReader();

    reader.onload = async () => {
      const base64 = reader.result;
      const resized = await resizeImageIfNeeded(base64);
      const encrypted = encrypt(resized);

      socket.emit("message", {
        from: username,
        to: selectedUser,
        image: encrypted,
        time: Date.now(),
        id
      });

      addImage(resized, true, username, id);
    };

    reader.readAsDataURL(file);
    return;
  }

  // ⭐ VIDEOS
  if (file.type.startsWith("video/")) {
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result;
      const encrypted = encrypt(base64);

      socket.emit("message", {
        from: username,
        to: selectedUser,
        video: encrypted,
        time: Date.now(),
        id
      });

      addVideo(base64, true, username, id);
    };

    reader.readAsDataURL(file);
    return;
  }

  alert("Dieser Dateityp wird nicht unterstützt.");
};

/* ===========================
   TEIL 4 — AUDIO RECORD
=========================== */

recordBtn.onclick = async () => {
  if (!selectedUser) return;
  if (groups[selectedUser]) return;

  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        const id = Date.now() + Math.random();

        reader.onloadend = () => {
          const base64 = reader.result;
          const encrypted = encrypt(base64);

          socket.emit("message", {
            from: username,
            to: selectedUser,
            audio: encrypted,
            time: Date.now(),
            id
          });

          addAudio(base64, true, username, id);
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
   TEIL 5 — GROUPS / DELETE / SIDEBAR
=========================== */

/* GROUP ADD */
addToGroupBtn.onclick = () => {
  if (!selectedUser) return;
  if (!groups[selectedUser]) {
    alert("Nur Gruppen können erweitert werden.");
    return;
  }

  const friend = prompt("Welchen Freund möchtest du hinzufügen?");
  if (!friend || !friends.includes(friend)) {
    alert("Dieser Freund existiert nicht.");
    return;
  }

  socket.emit("addToGroup", {
    group: selectedUser,
    friend
  });
};

/* GROUP REMOVE */
removeFromGroupBtn.onclick = () => {
  if (!selectedUser) return;
  if (!groups[selectedUser]) {
    alert("Nur Gruppen können geändert werden.");
    return;
  }

  const friend = prompt("Welches Mitglied soll entfernt werden?");
  if (!friend || !groups[selectedUser].includes(friend)) {
    alert("Dieses Mitglied ist nicht in der Gruppe.");
    return;
  }

  socket.emit("removeFromGroup", {
    group: selectedUser,
    friend
  });
};

/* GANZEN CHAT LÖSCHEN */
deleteChatBtn.onclick = () => {
  if (!selectedUser) return;
  if (groups[selectedUser]) return;

  if (!confirm(`Chat mit ${selectedUser} wirklich löschen?`)) return;

  messages.innerHTML = "";

  socket.emit("deleteChat", {
    user: username,
    with: selectedUser
  });

  clearRedDot(selectedUser);
  chatSubTitle.textContent = "";
};

socket.on("chatDeleted", ({ with: partner }) => {
  if (selectedUser === partner) {
    messages.innerHTML = "";
    chatSubTitle.textContent = "";
  }
});

/* SIDEBAR */
openSidebarBtn.onclick = () => {
  sidebarOverlay.classList.remove("hidden");
};

closeSidebarBtn.onclick = () => {
  sidebarOverlay.classList.add("hidden");
};

sidebarOverlay.onclick = () => {
  sidebarOverlay.classList.add("hidden");
};

document.getElementById("sidebar").onclick = (e) => {
  e.stopPropagation();
};

/* ===========================
   TEIL 6 — RESIZE & COMPRESS
=========================== */

/* IMAGE RESIZE FUNCTION */
async function resizeImageIfNeeded(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;

      let w = img.width;
      let h = img.height;

      if (w <= MAX && h <= MAX) {
        return resolve(base64);
      }

      if (w > h) {
        h = Math.round(h * (MAX / w));
        w = MAX;
      } else {
        w = Math.round(w * (MAX / h));
        h = MAX;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = base64;
  });
}

/* VIDEO COMPRESS FUNCTION */
async function compressVideo(file) {
  return new Promise(resolve => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const canvas = document.createElement("canvas");

      const MAX = 720;
      let w = video.videoWidth;
      let h = video.videoHeight;

      if (w > h) {
        h = Math.round(h * (MAX / w));
        w = MAX;
      } else {
        w = Math.round(w * (MAX / h));
        h = MAX;
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");

      const stream = canvas.captureStream();
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
        videoBitsPerSecond: 800000
      });

      const chunks = [];

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      };

      recorder.start();

      const draw = () => {
        ctx.drawImage(video, 0, 0, w, h);
        if (!video.paused && !video.ended) {
          requestAnimationFrame(draw);
        }
      };

      video.play().then(() => {
        draw();
        video.onended = () => recorder.stop();
      });
    };
  });
}
