const CACHE = 'creatorhub-v1';
const ASSETS = [
  '/', '/index.html','/app.js','/assets/icon.svg','/assets/og-image.png',
  '/data/creators.json','/data/schedule.json','/data/vods.json','/data/teams.json','/data/support.json','/data/notices.json','/config.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=> self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (ASSETS.includes(url.pathname) || url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return resp;
      }).catch(()=> res))
    );
  }
});
