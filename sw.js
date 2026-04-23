const CACHE_NAME = 'teachingfarm-v2.4';
const STATIC_ASSETS = [
  '/index.html',
  '/supabase.js',
  '/offline-db.js',
  '/offline-manager.js',
  '/mobile-gestures.js',
  '/pull-to-refresh.js',
  '/mobile-forms.js',
  '/realtime-manager.js',
  '/install-prompt.js',
  '/manifest.json',
  '/icon/favicon.ico',
  '/icon/icon.svg',
  '/icon/icon-96.png',
  '/icon/icon-192.png',
  '/icon/icon-512.png'
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // addAll tapi jangan gagal jika icon belum ada
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// Activate — hapus cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Supabase API → Network only (data harus fresh)
// - Chart.js CDN → Cache first, fallback network
// - Static files → Cache first, fallback network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase API — selalu dari network
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: {'Content-Type': 'application/json'}
    })));
    return;
  }

  // CDN resources — network first, cache fallback
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
