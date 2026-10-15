// 오마주 서비스 워커: 앱 설치용. 사진만 저장하고, 화면과 코드는 항상 새로 받는다.
const VER = 'omaju-v4';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;
  if (/\.(jpg|png)$/.test(u.pathname)) {
    e.respondWith(caches.open(VER).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }))));
  } else {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
  }
});

// 아침 알림: 서버(FCM)에서 온 메시지를 알림으로 띄우고, 누르면 오마주를 연다.
self.addEventListener('push', e => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (err) {}
  const d = m.data || (m.notification ? { title: m.notification.title, body: m.notification.body } : {});
  e.waitUntil(self.registration.showNotification(d.title || '오마주', { body: d.body || '오늘 아침도 반갑습니다.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'omaju-morning', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if (w.url.startsWith(self.registration.scope)) { w.navigate(url); return w.focus(); } } return clients.openWindow(url); }));
});
