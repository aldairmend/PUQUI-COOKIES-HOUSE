// Service worker de la PWA: guarda en caché solo los archivos estáticos de la interfaz (el «shell»).
// Nunca guarda respuestas de la API: las ventas y el stock deben ser siempre datos frescos.
const CACHE = 'puqui-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
  // Navegación: primero la red; sin conexión, el shell en caché.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }
  // Archivos estáticos (JS, CSS, íconos): caché primero y se actualiza en segundo plano.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const red = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      });
      return hit || red;
    })
  );
});
