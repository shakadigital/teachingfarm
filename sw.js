const CACHE_NAME = 'teachingfarm-v2.5';
const STATIC_ASSETS = [
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

// Install — cache static assets (index.html TIDAK di-cache agar selalu fresh)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting(); // Langsung aktif tanpa tunggu tab lama ditutup
});

// Activate — hapus semua cache lama, klaim semua client
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim()) // Klaim semua tab yang terbuka
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ── index.html → NETWORK FIRST, fallback cache ──
  // Ini kunci utama agar update selalu terdeteksi
  if (url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Simpan versi terbaru ke cache
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html')) // Fallback ke cache jika offline
    );
    return;
  }

  // ── Supabase API → Network only ──
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // ── CDN (Chart.js, xlsx, jspdf) → Network first, cache fallback ──
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

  // ── JS/CSS lokal → Network first, cache fallback ──
  // Pastikan file JS lokal (supabase.js, offline-db.js, dll) selalu fresh
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
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

  // ── Asset statis lainnya (icon, manifest) → Cache first ──
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
