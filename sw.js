/* RutaClima Trayectos: guardado local, para abrir la app sin señal.
   La página y el pronóstico se piden siempre primero a la red, y lo que llega bien se guarda. Sin red se usa la última
   copia guardada. El pronóstico guardado se entrega con la marca x-rc-guardado, para que la página avise que no es de
   ahora. No se guarda nada de quien usa la app: sólo los archivos del sitio y las letras. */
const CACHE = "rutaclima-v2";
/* el pronóstico también se guarda al instalar: quien abre la app una sola vez con señal ya puede usarla sin ella */
const BASE = ["./", "ciclo.json", "manifest.webmanifest", "icono-192.png", "icono-512.png", "icono-180.png", "maplibre-gl.js", "maplibre-gl.css"];
const clave = (u) => u.origin + (u.pathname.endsWith("/index.html") ? u.pathname.slice(0, -10) : u.pathname);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  /* el mapa de fondo se lee de a pedazos de un archivo grande: esos pedidos no se guardan ni se tocan */
  if (r.headers.has("range") || u.pathname.endsWith(".pmtiles")) return;
  if (u.origin === self.location.origin) {
    e.respondWith(fetch(r).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(clave(u), copia))); }
      return resp;
    }).catch(() => caches.match(clave(u)).then((g) => {
      if (!g) return Response.error();
      if (!u.pathname.endsWith("ciclo.json")) return g;
      const h = new Headers(g.headers);
      h.set("x-rc-guardado", "1");
      return g.blob().then((b) => new Response(b, { status: 200, headers: h }));
    })));
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(r).then((g) => g || fetch(r).then((resp) => {
      const copia = resp.clone();
      e.waitUntil(caches.open(CACHE).then((c) => c.put(r, copia)));
      return resp;
    })));
  }
});
