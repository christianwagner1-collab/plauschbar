// Fix für iPhone Safari (100vh Bug)
function setAppHeight() {
    document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`
    );
}

window.addEventListener("resize", setAppHeight);
setAppHeight();

// Optional: Service Worker für PWA
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
}

