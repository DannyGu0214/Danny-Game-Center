// 오프라인 실행용 서비스 워커(Animal World와 같은 방식). 게임 파일은 네트워크 우선 + 브라우저 캐시 건너뛰기, 안 되면 캐시로.
const CACHE = 'sailing-master-v2';
const CORE = ['./', 'index.html', 'logic.js', 'data.js', 'world.js', 'ship.js', 'art.js', 'art-ship.js', 'art-story.js', 'creatures.js', 'music.js', 'sound.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const NET_TIMEOUT_MS = 4000; // 신호가 약하면 기다리지 않고 캐시로

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (req, res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; };
const timeout = (ms) => new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // GitHub Pages는 파일마다 10분 캐시를 준다. no-cache로 서버에 확인해야 배포가 바로 반영된다
  const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
  e.respondWith(
    Promise.race([fresh, timeout(NET_TIMEOUT_MS)])
      .then((res) => (res.status === 200 ? put(req, res) : res)) // 음악의 부분 응답(206)은 캐시에 못 넣는다
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
