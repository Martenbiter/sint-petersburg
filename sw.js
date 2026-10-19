// Service worker: bewaart het spel op het apparaat, zodat het ook zonder internet werkt.
// Verhoog VERSION bij elke nieuwe versie van het spel.
const VERSION = 'spb-v9';
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
    await cache.addAll(APP_FILES.map(u => new Request(u, {cache: 'reload'})));
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

const timeout = ms => new Promise(resolve => setTimeout(() => resolve(null), ms));

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // De pagina zelf: eerst het internet proberen (nieuwste versie), na 3 seconden of zonder internet de bewaarde versie
    if (req.mode === 'navigate') {
      const network = fetch(req, {cache: 'no-store'}).then(res => {
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res && res.ok ? res : null;
      }).catch(() => null);
      const res = await Promise.race([network, timeout(3000)]);
      return res || (await cache.match('./index.html')) || (await network) || Response.error();
    }
    // Overige bestanden: direct uit de opslag, op de achtergrond bijwerken
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || Response.error();
  })());
});
