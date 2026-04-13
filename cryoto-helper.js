// crypto-helper.js
// AES-Verschlüsselung für Christian-Chat

const SECRET_KEY = "ChristianChatKey2025";

// Text verschlüsseln
function encrypt(text) {
    if (!text) return "";
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
}

// Text entschlüsseln
function decrypt(cipher) {
    if (!cipher) return "";
    try {
        return CryptoJS.AES.decrypt(cipher, SECRET_KEY).toString(CryptoJS.enc.Utf8);
    } catch {
        return "[Fehler beim Entschlüsseln]";
    }
}
