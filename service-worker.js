const CACHE = 'canid-v62';
const SHELL = [
  '/',
  '/editor',
  '/c',
  '/saved',
  '/faq',
  '/terms',
  '/css/app.css',
  '/css/view.css',
  '/js/mode.js',
  '/js/nav.js',
  '/js/fonts.js',
  '/js/app.js',
  '/js/qr.js',
  '/js/store.js',
  '/js/share.js',
  '/js/scramble.js',
  '/js/util.js',
  '/js/faq.js',
  '/js/faq-page.js',
  '/js/registry.js',
  '/js/icons.js',
  '/js/outline.js',
  '/js/text.js',
  '/js/view.js',
  '/js/vcard.js',
  '/js/saved.js',
  '/js/saved-page.js',
  '/vendor/qr-styling.js',
  '/manifest.json',
  '/fonts/Karrik-Regular.woff2',
  '/fonts/Karrik-Italic.woff2',
  '/fonts/Inter-Regular.woff2',
  '/fonts/InstrumentSerif-Regular.woff2',
  '/fonts/JetBrainsMono-Regular.woff2',
  '/icons/favicon.ico',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;

  const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isLocalhost) {
    e.respondWith(fetch(e.request));
    return;
  }

  const putIfCacheable = res => {
    if (res && res.ok && !res.redirected) {
      const resClone = res.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, resClone));
    }
    return res;
  };

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(putIfCacheable)
        .catch(() =>
          caches.match(e.request).then(cached => cached || caches.match('/'))
        )
    );
    return;
  }

  const fetchPromise = fetch(e.request).then(putIfCacheable);

  e.waitUntil(fetchPromise.catch(() => {}));

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetchPromise;
    })
  );
});
