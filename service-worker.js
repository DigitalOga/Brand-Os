/* ── Brand OS Service Worker ───────────────────────────────────────────────
   Gives the Web2APK wrapper a real app shell: offline caching, fast loads,
   and notification-click handling.

   STRATEGY: app code (JS/HTML/CSS) is NETWORK-FIRST — always tries the
   live server first so every deploy takes effect immediately, falling back
   to cache only when offline. Only truly static assets (icons) stay
   cache-first, since those never change between deploys.

   v4: bumped to force cache invalidation after auth + subscription update. */

const CACHE = 'brandos-v15'; // bumped: FIXED — Voice Library additions now actually reach the AI (were previously frozen at onboarding, silently ignored everywhere except 3 pages)

// Only genuinely static, never-changing assets get cache-first treatment.
const STATIC_SHELL = [
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/icon-72.png'
];

// App code — always fetched fresh from network first.
const CODE_EXTENSIONS = ['.js', '.html', '.css'];

// ── install: pre-cache only the truly static shell ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── activate: drop ALL old caches (forces fresh load of all app code) ─────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // pass cross-origin straight through

  // API endpoints must NEVER be cached — a GET to ai-proxy.php?action=status
  // or admin-keys.php?action=status has no file extension, so without this
  // check it would fall into the cache-first branch below and serve a
  // stale "is AI configured" answer forever after the first successful hit.
  if (url.pathname.endsWith('.php')) return;

  const isCode = CODE_EXTENSIONS.some(ext => url.pathname.endsWith(ext))
    || url.pathname === '/'
    || url.pathname.endsWith('/');

  if (isCode) {
    // NETWORK-FIRST: try live server, cache for offline fallback only.
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./app.html')))
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./app.html');
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});

// ── notification click ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetPage = event.notification.data && event.notification.data.page;
  const targetUrl  = targetPage ? `./?go=${targetPage}` : './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if (targetPage && 'postMessage' in client) {
            client.postMessage({ type: 'navigate', page: targetPage });
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── push ───────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Brand OS', body: 'You have a new brand alert.', page: 'dashboard' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'assets/icons/icon-192.png',
      badge: 'assets/icons/icon-72.png',
      tag: data.tag || 'brandos-push',
      data: { page: data.page || 'dashboard' }
    })
  );
});

// ── allow the page to activate a waiting worker immediately ───────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
