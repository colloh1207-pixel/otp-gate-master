// PWA service worker registration with iframe + preview guard.
// Service workers cause cache pollution inside the Lovable editor preview iframe,
// so we ONLY register on the published site outside an iframe.
export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreview = host.includes("id-preview--") || host.includes("lovableproject.com");

  if (inIframe || isPreview) {
    // Make sure no stale SW lingers in preview
    void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
    return;
  }

  // Minimal inline SW: cache-first for static assets, network-first for everything else.
  const swCode = `
    const CACHE = "wagate-v1";
    const ASSETS = ["/", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];
    self.addEventListener("install", (e) => {
      e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(()=>{}));
      self.skipWaiting();
    });
    self.addEventListener("activate", (e) => {
      e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
      self.clients.claim();
    });
    self.addEventListener("fetch", (e) => {
      const url = new URL(e.request.url);
      if (e.request.method !== "GET") return;
      if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/_serverFn")) return;
      e.respondWith(
        fetch(e.request).then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(()=>{});
          return res;
        }).catch(() => caches.match(e.request).then((r) => r || caches.match("/")))
      );
    });
  `;
  const blob = new Blob([swCode], { type: "application/javascript" });
  const swUrl = URL.createObjectURL(blob);
  void navigator.serviceWorker.register(swUrl).catch(() => {});
}
