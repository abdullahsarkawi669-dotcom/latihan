// ============================================================
// Service Worker - CBT SMP IT Putra Abu Hurairah
// Membuat aplikasi tetap berjalan tanpa koneksi internet.
// ============================================================

const CACHE_NAME = 'cbt-pah-v1';

// File-file yang akan dicache saat instalasi.
// File soal1.js..soal5.js sengaja TIDAK masuk daftar precache karena
// bersifat opsional. Jika ada, ia akan di-cache on-the-fly saat
// pertama kali dimuat (lihat handler fetch di bawah).
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// ---------- INSTALL: precache aset inti ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Gunakan addAll dengan toleransi: jika salah satu URL gagal
      // (mis. file soal belum ada), instalasi tetap jalan.
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: 'no-store' })
            .then((resp) => {
              if (resp.ok) return cache.put(url, resp);
            })
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE: bersihkan cache lama ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- FETCH: strategi cache-first, fallback jaringan ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya tangani request GET.
  if (req.method !== 'GET') return;

  // Abaikan request non-http (chrome-extension:// dll).
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Untuk file soal eksternal (soal1.js .. soal5.js) —
  // strategi: jaringan-dahulu lalu cache (supaya update terbaru jika online).
  const isSoalFile = /soal\d+\.js$/i.test(url.pathname);

  if (isSoalFile) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Simpan ke cache untuk penggunaan offline berikutnya.
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Default: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          // Hanya cache response valid dari origin yang sama.
          if (resp.ok && url.origin === self.location.origin) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => {
          // Fallback terakhir untuk navigasi: kembali ke index.html.
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
