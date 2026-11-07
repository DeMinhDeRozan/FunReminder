/* Service worker for Web Push. Must be served from the site root (same level as index.html). */
const ICON = 'https://d28igba62yy5is.cloudfront.net/kangaroo.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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
