// Service worker: bewaart het spel op het apparaat, zodat het ook zonder internet werkt.
// Verhoog VERSION bij elke nieuwe versie van het spel.
const VERSION = 'spb-v5';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Prata&family=PT+Sans:ital,wght@0,400;0,700;1,400&display=swap';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP_FILES);
    // Lettertypen meenemen, zodat het spel offline er hetzelfde uitziet
    try {
      const res = await fetch(FONT_CSS, {mode: 'cors'});
      if (res.ok) {
        await cache.put(FONT_CSS, res.clone());
        const css = await res.text();
        const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)].map(m => m[1]);
        await Promise.all(urls.map(u => fetch(u, {mode: 'cors'}).then(r => r.ok && cache.put(u, r)).catch(() => {})));
      }
    } catch (e) { /* zonder lettertypen werkt het spel ook, met standaardletters */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Eerst uit de opslag (direct en offline), op de achtergrond bijwerken als er internet is
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, {ignoreSearch: req.mode === 'navigate'});
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
