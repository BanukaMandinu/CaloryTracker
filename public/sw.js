// Offline shell: cache app files; never cache third-party API calls.
const CACHE = 'bmct-v24';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'workout.js', 'notify.js', 'icon-192.png', 'icon.svg', 'manifest.webmanifest', 'vendor/zxing.min.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return; // never cache account data
  // network-first so updates arrive; fall back to cache offline
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});

// ---- reminders (web push) ----
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'BM Calory Tracker', { body: d.body || '', icon: 'icon-192.png', badge: 'badge-96.png', tag: d.tag || 'bmct', data: { url: d.url || '/#today' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { if ('navigate' in c) c.navigate(url).catch(() => { }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
// the browser can rotate a subscription: renew it quietly so reminders keep arriving
self.addEventListener('pushsubscriptionchange', e => e.waitUntil((async () => {
  try {
    const sub = await self.registration.pushManager.subscribe(e.oldSubscription?.options || { userVisibleOnly: true });
    await fetch('/api/push', { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) });
  } catch { }
})()));
