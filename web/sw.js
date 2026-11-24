/* FunReminder service worker. Must be served from the site root (same level as index.html).
 *
 * 1. Web Push for cloud reminders (unchanged behaviour).
 * 2. Offline shell: static files are cached so the app opens without a network.
 *    Only same-origin GET requests for our own files are cached.
 *    The reminder API, Cognito and every other cross-origin request are NOT touched,
 *    so private API responses are never stored here.
 */
const VERSION = 'fr-v2.3.0';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const ICON = 'icons/icon-192.png';

const PRECACHE = [
  'offline.html', 'manifest.webmanifest', 'kangaroo.png',
  'icons/icon-192.png', 'icons/icon-512.png',
  'css/app.css',
  'js/main.js', 'js/pwa.js',
  'js/storage/storageConfig.js', 'js/storage/localStorageAdapter.js', 'js/storage/indexedDBAdapter.js',
  'js/storage/storageMigration.js', 'js/storage/localDataManager.js',
  'js/core/ui.js', 'js/core/icons.js', 'js/core/time.js',
  'js/audio/audioManager.js',
  'js/features/clock.js', 'js/features/scenes.js', 'js/features/sceneKit.js', 'js/features/sceneLakeside.js',
  'js/features/clockmode.js', 'js/features/rooLines.js', 'js/features/tasks.js', 'js/features/focus.js',
  'js/features/stats.js', 'js/features/countdowns.js', 'js/features/settings.js',
  'js/features/today.js', 'js/features/mascot.js',
  'js/features/clockface.js', 'js/features/views.js',
  'cameos/cameo-core.js', 'cameos/cheer.js', 'cameos/plumber.js', 'cameos/dunk.js', 'cameos/pirate.js',
  'cameos/roo-head.webp', 'cameos/roo-shades.webp'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // one missing file must not break the install (and with it, push)
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    // first install takes over at once; updates wait for the page's "Reload" prompt
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('fr-') && !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;              // API, auth, CDN, fonts: browser default
  if (url.search.includes('code=') || url.search.includes('state=')) return;   // OAuth callback: never cache

  // pages: network first (always fresh when online), cached copy or offline page when not
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(RUNTIME); c.put(url.pathname, res.clone()); }
        return res;
      } catch (e) {
        return (await caches.match(url.pathname)) || (await caches.match('offline.html')) || Response.error();
      }
    })());
    return;
  }

  // our static files: serve from cache, refresh in the background (stale-while-revalidate)
  if (/\.(js|css|png|webp|svg|jpg|jpeg|mp3|webmanifest|json|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      const network = fetch(req).then(async res => {
        if (res.ok && res.type === 'basic') { const c = await caches.open(RUNTIME); c.put(req, res.clone()); }
        return res;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});

/* ---------------- Web Push (cloud reminders) ---------------- */
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { body: event.data && event.data.text() }; }

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // A visible tab already fires the reminder itself (polling + sound): don't double up.
    if (wins.some(c => c.visibilityState === 'visible')) {
      wins.forEach(c => c.postMessage({ type: 'push-reminder', id: d.id }));
      return;
    }
    await self.registration.showNotification(d.title || '⏰ Reminder', {
      body: d.body || 'Your reminder just went off.',
      icon: ICON,
      badge: ICON,
      tag: d.id || 'reminder',          // same tag as the in-page notification => replaced, not duplicated
      renotify: true,
      requireInteraction: true,
      data: { url: d.url || './' }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  })());
});
