// =====================================================================
//  Ruta Comercial · service worker
//  Guarda la app en el teléfono para que abra aunque no haya internet.
//  Súbelo a GitHub junto a index.html (misma carpeta). No hay que editarlo.
// =====================================================================
const CACHE = "ruta-comercial-v1";
const CORE = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red con tiempo límite: con señal débil no se queda esperando para siempre
function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req).then((r) => { clearTimeout(t); resolve(r); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Datos de Supabase: nunca se guardan aquí (la app maneja su propia copia)
  if (url.hostname.endsWith("supabase.co")) return;

  // La app (index.html): primero internet para tener la última versión; si falla, la copia guardada
  if (req.mode === "navigate" || url.origin === self.location.origin) {
    e.respondWith(
      fetchWithTimeout(req, 5000)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? "./index.html" : req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Librería de Supabase y tipografías: se guardan la primera vez y se reutilizan
  if (/cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
