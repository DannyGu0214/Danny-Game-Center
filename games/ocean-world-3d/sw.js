// 오프라인 실행용 서비스 워커(W3, games/zombie-outpost/sw.js 방식). claude.ai Artifact 안과 녹화 모드(?capture)에서는 등록하지 않는다.
// 게임 파일: 네트워크 우선 — 온라인이면 늘 새 파일(저장소를 고치면 바로 반영), 안 되면 캐시로 오프라인 실행.
// 처음 설치할 때 아래 CORE를 모두 받아 둔다. 게임이 불러오는 파일이 바뀌면 이 목록과 CACHE 버전을 함께 고친다
// (목록 근거: render/main.js에서 따라간 import 그래프 + 프롤로그가 부르는 css·그림. docs/p5-finish-report.md 2절).
// 테스트(test/)·문서(docs/)·도구(tools/)·안 쓰는 파일(render/aqua/swim.js, assets/portraits/)은 넣지 않는다.
const CACHE = 'ocean-world-3d-v2';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'ui/prologue.css',
  'assets/story/institute.webp',
  'assets/story/surface.webp',
  'assets/story/idea.webp',
  'assets/story/jelly.webp',
  'assets/story/invite.webp',
  'audio/music.js',
  'audio/sfx.js',
  'audio/sound.js',
  'eco/atoll/data.js',
  'eco/atoll/profile.js',
  'eco/atoll/props/_kit.js',
  'eco/atoll/props/_mooring.js',
  'eco/atoll/props/beachscrub.js',
  'eco/atoll/props/boardwalk.js',
  'eco/atoll/props/boulder.js',
  'eco/atoll/props/branchcoral.js',
  'eco/atoll/props/buoy.js',
  'eco/atoll/props/cleaning.js',
  'eco/atoll/props/dome.js',
  'eco/atoll/props/feedbasket.js',
  'eco/atoll/props/giantclam.js',
  'eco/atoll/props/hut.js',
  'eco/atoll/props/lagoonsand.js',
  'eco/atoll/props/mangrove.js',
  'eco/atoll/props/nursery.js',
  'eco/atoll/props/palm.js',
  'eco/atoll/props/planktonlamp.js',
  'eco/atoll/props/reefblock.js',
  'eco/atoll/props/seagrass.js',
  'eco/atoll/props/shellbox.js',
  'eco/atoll/species/_kit.js',
  'eco/atoll/species/anemone.js',
  'eco/atoll/species/chromis.js',
  'eco/atoll/species/clownfish.js',
  'eco/atoll/species/greenturtle.js',
  'eco/atoll/species/hermitcrab.js',
  'eco/atoll/species/manta.js',
  'eco/atoll/species/moonjelly.js',
  'eco/atoll/species/octopus.js',
  'eco/atoll/species/seacucumber.js',
  'eco/atoll/terrain.js',
  'render/aqua/buoyancy.js',
  'render/aqua/caustics.js',
  'render/aqua/heightfield.js',
  'render/aqua/particles.js',
  'render/aqua/school.js',
  'render/aqua/surface.js',
  'render/aqua/waterFog.js',
  'render/core/app.js',
  'render/core/batched.js',
  'render/core/camera.js',
  'render/core/coords.js',
  'render/core/deform.js',
  'render/core/events.js',
  'render/core/input.js',
  'render/core/instancing.js',
  'render/core/jelly.js',
  'render/core/materials/shaderPatches.js',
  'render/core/perf.js',
  'render/core/picking.js',
  'render/core/stage.js',
  'render/core/terrain.js',
  'render/main.js',
  'render/proto/creatures.js',
  'render/proto/geo.js',
  'render/proto/props.js',
  'render/proto/propview.js',
  'render/proto/species.js',
  'sim/move.js',
  'sim/rules.js',
  'sim/save.js',
  'sim/space.js',
  'sim/util.js',
  'ui/hud.js',
  'ui/pc-only.js',
  'ui/prologue-story.js',
  'ui/prologue.js',
  'ui/react.js',
  'ui/settings.js',
  'ui/title.js',
  'vendor/three-0.187.0/build/three.core.js',
  'vendor/three-0.187.0/build/three.module.js',
  'vendor/three-0.187.0/examples/jsm/controls/OrbitControls.js',
  'vendor/three-0.187.0/examples/jsm/environments/RoomEnvironment.js',
  'vendor/three-0.187.0/examples/jsm/utils/BufferGeometryUtils.js',
];
const NET_TIMEOUT_MS = 4000; // 신호가 약하면 기다리지 않고 캐시로

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // 새 버전이 켜지면 이 게임의 옛 캐시를 지운다(같은 출처의 다른 게임 캐시는 건드리지 않음)
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('ocean-world-3d-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; };
const timeout = (ms) => new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    Promise.race([fetch(req), timeout(NET_TIMEOUT_MS)])
      .then((res) => (res.ok ? put(req, res) : res))
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
