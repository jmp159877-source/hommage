// 오마주 서비스 워커: 앱 설치용. 화면 파일만 저장하고, 내용은 항상 새로 받는다.
const VER = 'omaju-v1';
const SHELL = ['/', '/index.html', '/css/omaju.css', '/leaf.png', '/logo-light.png', '/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;
  if (/\.(jpg|png|css|webmanifest)$/.test(u.pathname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(VER).then(x => x.put(e.request, c)); return res; })));
  } else {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
  }
});
