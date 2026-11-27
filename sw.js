// Offline support: app files are cached on install; covers and fonts are cached as you browse.
const VERSION = 'shelflife-v19';
const APP_FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/actions.js', 'js/api.js', 'js/autotag.js', 'js/charts.js', 'js/covers.js', 'js/hardcover.js', 'js/data.js', 'js/sample.js', 'js/store.js', 'js/ui.js',
  'js/views/add.js', 'js/views/book.js', 'js/views/discover.js', 'js/views/home.js', 'js/views/library.js', 'js/views/preview.js', 'js/views/series.js',
  'js/views/settings.js', 'js/views/stats.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'shelflife-media').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Open Library search/API calls: always live.
  if (url.hostname === 'openlibrary.org' || url.hostname === 'itunes.apple.com' || url.hostname === 'www.googleapis.com' || url.hostname.endsWith('hardcover.app')) return;

  // Covers + fonts: cache first, they never change.
  if (url.hostname === 'covers.openlibrary.org' || url.hostname.endsWith('mzstatic.com') || url.hostname === 'books.google.com' || url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(caches.open('shelflife-media').then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  // App files: network first so updates show up, cache when offline.
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((res) => { // always check for a newer version
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
  }
});
