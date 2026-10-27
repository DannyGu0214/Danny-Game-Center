// 오프라인 실행용 서비스 워커(홈 화면에 설치한 독립 실행에서만 쓴다).
// 게임 파일: 네트워크 우선 — 온라인이면 늘 새 파일(저장소를 고치면 바로 반영), 안 되면 캐시로 오프라인 실행.
// 글꼴(Google Fonts): 한 번 받으면 바뀌지 않으니 캐시 우선.
const CACHE = 'animal-world-v11';
const SPECIES = ['rabbit', 'meerkat', 'gazelle', 'zebra', 'ostrich', 'lion', 'giraffe', 'elephant', 'crab', 'gull', 'turtle', 'flamingo', 'otter', 'sealion', 'dolphin', 'walrus',
  'lizard', 'jerboa', 'fennec', 'snake', 'coyote', 'vulture', 'oryx', 'camel', 'adelie', 'skua', 'gentoo', 'weddell', 'king', 'elephantseal', 'emperor', 'orca'];
const REGION_FILES = ['seaside', 'desert', 'antarctic'].flatMap((r) => [`items/${r}.js`, `sounds/${r}.js`]);
const CORE = ['./', 'index.html', 'logic.js', 'terrain.js', 'data.js', 'art.js', 'music.js', 'sound.js', ...SPECIES.map((sp) => `rigs/${sp}.js`), ...REGION_FILES, 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
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
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    Promise.race([fetch(req), timeout(NET_TIMEOUT_MS)])
      .then((res) => (res.ok ? put(req, res) : res))
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
