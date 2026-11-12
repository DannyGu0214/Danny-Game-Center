// Ocean World 3D 조립(P2): 규칙(sim/) + 화면(render/core + render/aqua + render/proto) + UI(ui/). 열대 환초 블록 하나.
// 이 파일만 core와 aqua를 함께 안다(조립하는 곳). core는 aqua를 import하지 않는다.
// 생물·물건의 자리와 상태는 규칙이 1/30초 고정 단계로 정하고, 화면은 두 단계 사이를 보간해 그리기만 한다(PLAN 3절).
//
// 흐름: 타이틀(저장 있음: 내 바다 / 없음: 견본 장면) → 누르기 → [새 게임이면 프롤로그] → 게임. 5초마다·떠날 때 저장(localStorage 'ow3d').
//       T8에 확장 영역이 열리면 저장하고 다시 불러와 넓어진 블록으로 이어 간다(지형·물·카메라를 한 번에 다시 만드는 가장 단순한 방법).
//
// 주소 옵션
//   ?water=box|transmission  물 방식(기본 box = 투과 없음, transmission = 참고 사례 방식)
//   ?jelly=1                 젤리 세기(0 = 끔, 2 = 두 배)
//   ?view=default|top|side|under|near  시작 시점
//   ?perf=1                  성능 표시
//   ?capture                 녹화 모드(RAF 없이 window.__cap.step(dt)로 진행). 견본 장면(demo)으로 시작, 저장하지 않음. ?hud=1이면 HUD도 그림
//   ?demo=1 ?n=44            견본 장면(T8, 생물 n마리 ≤ 44, 물건 한 벌). 저장하지 않음
//   ?shadow=0 ?fog=0 ?caustics=0 ?snow=0 ?shafts=0 ?deform=0   기능 끄기(비교용)
//   ?ext=1                   확장 영역이 열린 블록(견본 장면 확인용. 저장된 게임은 T8이면 저절로 열림)
//   ?size=1280x800 ?dpr=1    녹화 모드 캔버스 크기, 픽셀 비율
//   ?sizes=1.35,1.1,0.95,0.85  크기 등급(S,M,L,XL) 화면 배율 덮어쓰기. 원본은 eco/atoll/data.js SIZES[].draw
//   ?title=0|1               타이틀 화면. 기본은 켬, ?capture·?perf=1·?demo에서는 끔. title=1이면 그때도 켬
//   ?prologue=0              새 게임에서 프롤로그 건너뛰기
//   ?lineup=1                종마다 한 마리 줄 세우기(변형 확인용, 규칙 없이 고정)
import * as THREE from 'three';
import * as TER from '../eco/atoll/terrain.js';
import { ENV, WATER, TERRAIN_COLORS, STRATA, STRATA_BOTTOM } from '../eco/atoll/profile.js';
import { makeEco, atollTerrain } from '../eco/atoll/data.js';
import { createSim, STEP } from '../sim/rules.js';
import { createStage } from './core/stage.js';
import { makeCoords } from './core/coords.js';
import { JellyBlock } from './core/jelly.js';
import { CameraRig } from './core/camera.js';
import { buildTerrain } from './core/terrain.js';
import { PropBatch } from './core/batched.js';
import { patchMaterial, patchStats } from './core/materials/shaderPatches.js';
import { deformUniforms } from './core/deform.js';
import { App } from './core/app.js';
import { BlockInput } from './core/input.js';
import { screenPick, toScreen, blockRay, rayToGround, rayToPlane } from './core/picking.js';
import { createWaterFog } from './aqua/waterFog.js';
import { Heightfield } from './aqua/heightfield.js';
import { WaterBody } from './aqua/surface.js';
import { createMarineSnow, createLightShafts } from './aqua/particles.js';
import { floatOn } from './aqua/buoyancy.js';
import { SPECIES as SHAPES, scaleCounts, parseSizeScale } from './proto/species.js';
import { propGeometries } from './proto/props.js';
import { CreatureView } from './proto/creatures.js';
import { PropView } from './proto/propview.js';
import { rng } from './proto/geo.js';
import { createTitle } from '../ui/title.js';
import { createHud } from '../ui/hud.js';

const SAVE_KEY = 'ow3d';
const NEW_FLAG = 'ow3d-new';   // 열린 지형(T8) 세이브에서 [새로 시작]을 누르면 닫힌 지형으로 다시 불러오며 남기는 표시(sessionStorage)

// ---------- 옵션 ----------
const q = new URLSearchParams(location.search);
const flag = (k, d = true) => (q.has(k) ? q.get(k) !== '0' && q.get(k) !== 'false' : d);
const opt = {
  capture: q.has('capture'),
  water: q.get('water') === 'transmission' ? 'transmission' : 'box',
  n: q.has('n') ? Math.max(0, Math.min(44, parseInt(q.get('n'), 10) || 0)) : 44,
  jelly: q.has('jelly') ? Math.max(0, parseFloat(q.get('jelly')) || 0) : 1,
  view: q.get('view') || 'default',
  perf: q.get('perf') === '1',
  shadows: flag('shadow'), fog: flag('fog'), caustics: flag('caustics'), snow: flag('snow'), shafts: flag('shafts'), deform: flag('deform'),
  lineup: q.get('lineup') === '1',
  size: (q.get('size') || '1280x800').split('x').map(Number),
  dpr: q.has('dpr') ? parseFloat(q.get('dpr')) : null,
  sizes: parseSizeScale(q.get('sizes')),
  sigma: q.has('sigma') ? Math.max(0.05, parseFloat(q.get('sigma')) || 1) : 1,
  hud: q.get('hud') === '1',
  prologue: q.get('prologue') !== '0',
};
opt.demo = opt.capture || opt.lineup || q.has('demo') || q.has('n');
opt.title = q.has('title') ? q.get('title') !== '0' : !(opt.demo || opt.perf);
if (opt.water === 'transmission') opt.fog = q.has('fog') ? opt.fog : false; // 투과 방식은 기본으로 물속 안개를 끈다(사례와 같게)
document.body.classList.toggle('capture', opt.capture);
document.body.classList.toggle('hud', opt.hud);

// ---------- 저장 미리 보기: 확장 영역이 열린 세이브(T8)면 열린 지형으로 시작 ----------
const store = {
  get(k, s = localStorage) { try { return s.getItem(k); } catch { return null; } },
  set(k, v, s = localStorage) { try { s.setItem(k, v); } catch { /* 저장 못 함(사생활 보호 창 등) */ } },
  del(k, s = localStorage) { try { s.removeItem(k); } catch { /* 없음 */ } },
};
const wantNew = !opt.demo && store.get(NEW_FLAG, sessionStorage) === '1';
if (wantNew) store.del(NEW_FLAG, sessionStorage);
const raw = opt.demo || wantNew ? null : store.get(SAVE_KEY);
let savedTier = 0;
try { savedTier = raw ? JSON.parse(raw).tier || 0 : 0; } catch { savedTier = 0; }
opt.ext = q.get('ext') === '1' || savedTier >= 8;

// ---------- 규칙 ----------
const TERRAIN = atollTerrain(TER, opt.ext);   // 규칙과 화면이 같은 지형 함수를 읽는다
const eco = makeEco(TERRAIN);
const G = createSim(eco);
const IT = eco.items, SP = eco.species;

// ---------- 지형·좌표 ----------
const tOpts = { ext: opt.ext };
const heightAt = TERRAIN.heightAt;
const bounds = TER.bounds(tOpts);
const coords = makeCoords(bounds);
const BOTTOM = TER.BOTTOM;
const hx = coords.half.x, hz = coords.half.z;

// ---------- 무대 ----------
const canvas = document.getElementById('view');
if (opt.capture) { canvas.width = opt.size[0]; canvas.height = opt.size[1]; }
const stage = createStage(canvas, ENV, { capture: opt.capture, shadows: opt.shadows, pixelRatio: opt.capture ? (opt.dpr || 1) : opt.dpr });
const { renderer, scene, world } = stage;
stage.fitShadow(hx, hz, BOTTOM, 6);

// 물속 안개는 재질을 만들기 전에 'medium' 슬롯에 등록한다
const waterBox = new THREE.Box3(new THREE.Vector3(-hx, BOTTOM, -hz), new THREE.Vector3(hx, TER.SEA_LEVEL, hz));
const fog = createWaterFog(WATER, waterBox);
fog.setFog(opt.fog); fog.setCaustics(opt.caustics);
const SIGMA0 = new THREE.Vector3(...WATER.absorption);
const setSigma = (k) => { opt.sigma = k; fog.uniforms.uSigma.value.copy(SIGMA0).multiplyScalar(k); };
setSigma(opt.sigma);

// ---------- 지형 ----------
const TC = Object.fromEntries(Object.entries(TERRAIN_COLORS).map(([k, v]) => [k, new THREE.Color(v)]));
const LM = TER.LANDMARKS;
const _c = new THREE.Color(), _c2 = new THREE.Color();
function colorAt(x, y, h, out) {
  const n = TER.fbm(x * 0.6, y * 0.6), n2 = TER.fbm(x * 1.9 + 5, y * 1.9 - 3);
  const e = 0.35;
  const g = Math.hypot(heightAt(x + e, y) - heightAt(x - e, y), heightAt(x, y + e) - heightAt(x, y - e)) / (2 * e);
  const vegLine = 1.15 + (n2 - 0.5) * 0.5;
  if (h > vegLine) _c.copy(TC.veg).lerp(TC.vegDark, n);
  else if (h > vegLine - 0.12) _c.copy(TC.drySand).lerp(TC.veg, (h - vegLine + 0.12) / 0.12);
  else if (h > 0.25) _c.copy(TC.drySand).lerp(TC.wetSand, n2 * 0.25);
  else if (h > -0.3) _c.copy(TC.wetSand).lerp(TC.drySand, n * 0.4);
  else if (h > -2.2) {
    _c.copy(TC.reefFlat).lerp(TC.lagoonSand, 0.25 + n * 0.3);
    if (n2 > 0.6) _c.lerp(n > 0.5 ? TC.coralPink : TC.coralOchre, Math.min(1, (n2 - 0.6) * 4));
  } else if (h > -5.5) _c.copy(TC.lagoonSand).lerp(TC.reefFlat, n2 * 0.2);
  else _c.copy(TC.kanduSand).lerp(TC.lagoonSand, n * 0.35);
  const dTh = Math.hypot(x - LM.thila.x, y - LM.thila.y);
  if (dTh < 5.5 && h > -10) { _c2.copy(TC.thilaRock).lerp(TC.thilaCoral, n2 > 0.55 ? 0.8 : 0.1); _c.lerp(_c2, Math.min(1, (5.5 - dTh) / 2)); }
  if (g > 0.9 && h < -0.4) _c.lerp(TC.slope, Math.min(0.7, (g - 0.9) * 0.6));
  const edge = Math.min(x - bounds.x0, bounds.x1 - x, y - bounds.y0, bounds.y1 - y);
  if (edge < 2.2 && h < -3.5) _c.lerp(TC.dropoff, 0.45);
  out[0] = _c.r; out[1] = _c.g; out[2] = _c.b;
}
const terrain = buildTerrain({
  heightAt, colorAt, coords, step: 0.25, bottom: BOTTOM, strata: STRATA, strataBottom: STRATA_BOTTOM, slots: ['medium'],
});
world.add(terrain.mesh, terrain.sides);

// ---------- 물 ----------
const hf = new Heightfield(bounds, heightAt, 0.5);
const water = new WaterBody({ hf, coords, heightAt, water: WATER, mode: opt.water });
for (const m of water.meshes) world.add(m);

// ---------- 물건(BatchedMesh 하나, 규칙 상태에서) ----------
const W = (x, y, z) => coords.toWorld(x, y, z, new THREE.Vector3());
const props = propGeometries();
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, flatShading: true });
propMat.name = 'props';
const PROP_PATCH = {
  name: 'propSwayEmit',
  uniforms: deformUniforms,
  vertexPars: /* glsl */`attribute vec2 aAux; varying float vEmit; uniform vec3 uCurrent; uniform float uDeformGain;`,
  vertexDeform: /* glsl */`
{
  vec3 base = vec3(0.0);
  #ifdef USE_BATCHING
    base = batchingMatrix[3].xyz;
  #endif
  float h = aAux.x;
  float ph = uTime * 1.3 + base.x * 0.37 + base.z * 0.29 + position.y * 0.5;
  vec3 sw = vec3(sin(ph), 0.0, cos(ph * 0.8 + 0.7)) * 0.09 + uCurrent * 0.5;
  transformed += sw * h * h * uDeformGain;
  vEmit = aAux.y;
}`,
  fragmentPars: /* glsl */`varying float vEmit;`,
  fragmentEmissive: /* glsl */`totalEmissiveRadiance += diffuseColor.rgb * vEmit;`,
};
patchMaterial(propMat, [PROP_PATCH], { slots: ['medium'], defines: { OW_CAUSTICS: true } });
// 물건 수 상한이 없어 봇 240분에 800개 안팎(조각 3~4천). 넉넉히 잡는다(BatchedMesh는 그리는 수만큼만 그린다)
const batch = new PropBatch(propMat, props.geometries, 6000);
batch.mesh.castShadow = true; batch.mesh.receiveShadow = true;
world.add(batch.mesh);
const propView = new PropView({ batch, index: props.index, coords, heightAt, eco });

// ---------- 생물(종마다 InstancedMesh, 규칙 상태에서) ----------
const creatures = new CreatureView({ world, coords, heightAt, eco, bodyLen: G.bodyLen, cap: 48, sizeOverride: opt.sizes, fixedZ: opt.lineup });

// ---------- 입자·빛줄기 ----------
if (opt.snow) world.add(createMarineSnow(new THREE.Box3(new THREE.Vector3(-hx + 0.3, BOTTOM + 1.5, -hz + 0.3), new THREE.Vector3(hx - 0.3, -0.15, hz - 0.3)), 1400));
if (opt.shafts) {
  const sr = rng(5), pts = [];
  // 빛은 태양 반대쪽(격자 −x, −y)으로 내려가므로, 끝이 블록 밖으로 나가지 않게 시작점을 +x·+y 쪽으로 둔다
  const sd = new THREE.Vector3(...ENV.sunDir).normalize(), LEN = 9;
  const mx = Math.abs(sd.x / sd.y) * LEN * 1.15 + 1.5, my = Math.abs(sd.z / sd.y) * LEN * 1.15 + 1.5;
  for (let i = 0; i < WATER.shaftCount; i++) pts.push(W(bounds.x0 + mx + sr() * (bounds.x1 - bounds.x0 - mx - 2), bounds.y0 + my + sr() * (bounds.y1 - bounds.y0 - my - 4), -0.05));
  world.add(createLightShafts(pts, sd, LEN).mesh);
}

// ---------- 판정용 상자, 젤리, 카메라 ----------
const hitMesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 3 - BOTTOM, hz * 2).translate(0, (3 + BOTTOM) / 2, 0), new THREE.MeshBasicMaterial());
hitMesh.visible = false; hitMesh.name = 'hit';
world.add(hitMesh);
const jelly = new JellyBlock(world, { bottomY: BOTTOM, height: 3 - BOTTOM });
jelly.setStrength(opt.jelly);

const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.5, 600);
const R = Math.hypot(hx, hz, 7);
const fit = (cam) => {
  const v = THREE.MathUtils.degToRad(cam.fov);
  const h = 2 * Math.atan(Math.tan(v / 2) * cam.aspect);
  return (R / Math.sin(Math.min(v, h) / 2)) * 0.8;
};
const presets = {
  default: { polar: 60, azimuth: 26, target: [0, -3, 0], distance: fit },
  top: { polar: 1.5, azimuth: 0, target: [0, -2, 0], distance: (c) => fit(c) * 0.95 },
  side: { polar: 86, azimuth: 0, target: [0, -4.5, 0], distance: fit },
  under: { polar: 93, azimuth: 14, target: [0, -6, 0], distance: fit },
  near: { polar: 82, azimuth: 16, target: W(9, 3.2, 0.2).toArray(), distance: 11 },
  title: { polar: 64, azimuth: 30, target: [0, -2.5, 0], distance: (c) => fit(c) * 1.04, orbitSpeed: 5 },
  lineup: { polar: 77, azimuth: 0, target: W(20, 3.0 + 2.4 * 24 / 48, -5.4).toArray(), distance: 29 },
};
const keepOut = new THREE.Box3(new THREE.Vector3(-hx - 1, BOTTOM - 1, -hz - 1), new THREE.Vector3(hx + 1, 7.5, hz + 1));
const rig = new CameraRig(camera, canvas, { box: keepOut, target: new THREE.Vector3(0, -3, 0), presets });

let hud = null;
function resize() {
  let w, h;
  if (opt.capture) { [w, h] = opt.size; } else { w = window.innerWidth; h = window.innerHeight; }
  if (!w || !h) return;   // 숨은 창(크기 0)에서는 다음 크기 바뀜을 기다린다
  renderer.setSize(w, h, !opt.capture);
  // 오른쪽 패널이 열려 있으면 블록이 남은 화면 가운데 오게 투영 중심을 왼쪽으로 민다(가상 화면을 패널 폭만큼 넓힘)
  const pw = hud && mode === 'play' ? hud.panelWidth() : 0;
  if (pw > 0) { camera.aspect = (w + pw) / h; camera.setViewOffset(w + pw, h, pw, 0, w, h); }
  else { camera.aspect = w / h; camera.clearViewOffset(); }
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => { if (!opt.capture) resize(); });

const ui = opt.capture ? null : document.getElementById('ui');

// ---------- 게임 상태 ----------
let mode = 'boot';      // 'title' | 'prologue' | 'play' | 'demo'
let S = null;           // 지금 그리는 상태
let live = false;       // 저장하는 진짜 게임인가
let acc = 0, prevC = null, curC = [];
let placing = null;     // 놓기 중: { id, x, y, layer, rot, ok, why }
let lineup = null;

function setState(s, isLive) {
  S = s; live = isLive; acc = 0;
  curC = G.creatures(S); prevC = null;
  G.drainEvents(S);
  propView.sync(G.props(S));
  if (hud) hud.refresh();
}

/** 견본 장면: T8, 물건 종류마다 한두 개, 생물 n마리(종 비율은 시제품 기본 수). 저장하지 않는다 */
function demoState(n = 44, seed = 9) {
  const D = G.newGame(seed, 0);
  D.pop = 1e9; D.tier = 8; D.rev++;
  for (const id of G.itemIds) for (let k = 0; k < (IT[id].zone === 'water' ? 2 : 1); k++) {
    const at = G.freeSpot(D, id);
    if (at) G.placeItem(D, id, at.x, at.y, at.layer, k);
  }
  const counts = scaleCounts(n);
  SHAPES.forEach((def, i) => { for (let k = 0; k < counts[i]; k++) G.adopt(D, def.id); });
  // 처음 몇 초 흘려 생물이 흩어지게
  for (let i = 0; i < 30 * 4; i++) G.tick(D);
  G.drainEvents(D);
  D.pop = 400;
  return D;
}

function lineupList() {
  let x = 0;
  const xs = SHAPES.map((d) => { const L = G.bodyLen(d.id); const c = x + L / 2; x += L + 1.1; return c; });
  const off = 20 - x / 2;
  return SHAPES.map((d, i) => { const cx = xs[i] + off; return { uid: i + 1, sp: d.id, x: cx, y: 3.0 + (2.4 * (cx + 4)) / 48, z: -5.6, face: 0, pitch: 0, st: 'move', on: 'water' }; });
}

// ---------- 저장 ----------
function save() {
  if (!live || !S) return;
  S.savedAt = Date.now();
  store.set(SAVE_KEY, G.serialize(S, S.savedAt));
}
setInterval(() => { if (!document.hidden) save(); }, 5000);
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); return; }
  if (!live || mode !== 'play') return;
  const r = G.settleOffline(S, Date.now());   // 탭을 가린 동안의 관람 수익(최대 30분치)
  if (r.gain >= 1) hud.toast(`쉬는 동안 관람 수익 ⭐+${Math.floor(r.gain)}`);
});

// ---------- 놓기 ----------
const ghost = new THREE.Group();
ghost.visible = false; ghost.renderOrder = 20;
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x3fd07a, transparent: true, opacity: 0.32, depthTest: false, depthWrite: false });
const ghostLine = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
const gBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), ghostMat);
const gEdge = new THREE.LineSegments(new THREE.EdgesGeometry(gBox.geometry), ghostLine);
const gStem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6).translate(0, 0.5, 0), ghostMat);
for (const m of [gBox, gEdge, gStem]) { m.renderOrder = 20; ghost.add(m); }
world.add(ghost);

function layerZ(id, x, y, layer) {
  const d = IT[id];
  if (d.zone !== 'water') return null;
  const z = G.space.itemZ({ id, x, y, layer });
  return Number.isFinite(z) ? z : -2.5 * (G.space.layerIds.indexOf(layer) + 0.5);
}
function drawGhost() {
  if (!placing) { ghost.visible = false; return; }
  const d = IT[placing.id], p = placing, cx = p.x + d.w / 2, cy = p.y + d.h / 2;
  ghostMat.color.set(p.ok ? 0x3fd07a : 0xff5a4a);
  const ground = heightAt(cx, cy);
  let z = ground, hgt = d.zone === 'land' ? 1.6 : 1.0;
  if (d.zone === 'water') { z = d.float ? 0 : layerZ(p.id, p.x, p.y, p.layer); hgt = 0.6; z -= hgt / 2; }
  const pos = W(cx, cy, z);
  gBox.position.copy(pos); gBox.scale.set(d.w * 0.96, hgt, d.h * 0.96); gBox.rotation.y = p.rot * Math.PI / 2;
  gEdge.position.copy(pos); gEdge.scale.copy(gBox.scale); gEdge.rotation.y = gBox.rotation.y;
  gStem.visible = d.zone === 'water';
  if (gStem.visible) { gStem.position.copy(W(cx, cy, ground)); gStem.scale.set(1, Math.max(0.05, z - ground), 1); }
  ghost.visible = true;
}
function evalPlace() {
  const c = G.canPlace(S, placing.id, placing.x, placing.y, placing.layer);
  placing.ok = c.ok; placing.why = c.why || '';
  drawGhost();
  hud.setPlacing(placing);
}
function startPlace(id) {
  const d = IT[id];
  const at = G.freeSpot(S, id);
  placing = { id, x: at ? at.x : Math.floor(bounds.w / 2 - d.w / 2), y: at ? at.y : Math.floor(bounds.h / 2 - d.h / 2), layer: at ? at.layer : d.zone === 'water' ? d.layers[0] : null, rot: 0 };
  hud.select(null);
  evalPlace();
  if (!at) hud.toast('놓을 빈자리가 없어요. 다른 물건을 치우거나 다른 구역을 써 보세요');
}
function endPlace() { placing = null; drawGhost(); hud.setPlacing(null); }
/** 놓기 중 블록을 누름: 그 물건 구역의 면(육지·해저는 지형, 수중은 고른 층 높이의 수평면)에서 자리를 잡는다 */
function placeAt(e) {
  const d = IT[placing.id];
  const ray = blockRay(camera, canvas, jelly.inverse, e.clientX, e.clientY);
  const g = d.zone === 'water'
    ? rayToPlane(ray, coords, d.float ? 0 : layerZ(placing.id, placing.x, placing.y, placing.layer))
    : rayToGround(ray, coords, heightAt);
  if (!g) return;
  placing.x = Math.round(g.x - d.w / 2); placing.y = Math.round(g.y - d.h / 2);
  evalPlace();
}

// ---------- 고르기·포착 ----------
function pick(e) {
  if (mode !== 'play') return false;
  if (placing) { placeAt(e); return true; }
  const minPx = e.pointerType === 'touch' ? 28 : 22;
  const hits = screenPick({ camera, dom: canvas, matrix: world.matrixWorld, items: creatures.drawn, x: e.clientX, y: e.clientY, minPx });
  if (S.chance) {
    const h = hits.find((c) => c.item.uid === S.chance.uid);
    if (h) { capture(); hud.select({ kind: 'animal', uid: h.item.uid }); return true; }
  }
  if (hits.length) { hud.select({ kind: 'animal', uid: hits[0].item.uid }); return true; }
  const ph = screenPick({ camera, dom: canvas, matrix: world.matrixWorld, items: propView.pickList(), x: e.clientX, y: e.clientY, minPx: 12 });
  if (ph.length) { hud.select({ kind: 'item', uid: ph[0].item.uid }); return true; }
  if (hud.selected) { hud.select(null); }
  return false;
}
function capture() {
  if (!S.chance) return;
  const r = G.capture(S, S.chance.uid);
  if (!r.ok) { hud.toast(r.why); return; }
  hud.toast(`📸 ${SP[r.sp].icon ?? ''}${SP[r.sp].name} 포착! ⭐+${r.reward}${r.first ? ' (첫 포착)' : ''}`, r.first);
  jelly.poke(-0.3, 0.1, 0.05);
  save();
}
const _scr = {};
function chanceMarker() {
  if (mode !== 'play' || !S.chance) { hud.chance(null); return; }
  const d = creatures.drawn.find((c) => c.uid === S.chance.uid);
  if (!d) { hud.chance(null); return; }
  toScreen(camera, canvas, world.matrixWorld, d.pos.clone().setY(d.pos.y + d.r), _scr);
  const pw = hud.panelWidth();
  const on = _scr.on && _scr.x < window.innerWidth - pw;
  hud.chance({ x: _scr.x, y: _scr.y, on, front: _scr.front, t: S.chance.t });
}
function chanceTap() {
  if (!S.chance) return;
  const d = creatures.drawn.find((c) => c.uid === S.chance.uid);
  toScreen(camera, canvas, world.matrixWorld, d.pos, _scr);
  if (_scr.on && _scr.x < window.innerWidth - hud.panelWidth()) capture();
  else rig.focus(d.pos.clone(), 0.8);   // 화면 밖: 그쪽으로 돌려 보여 주기만(포착은 한 번 더)
}

// ---------- 사건 ----------
function handleEvents(evs) {
  let dirty = false;
  for (const e of evs) {
    if (e.type === 'place' || e.type === 'remove' || e.type === 'terrain') dirty = true;
    if (!live) continue;
    if (e.type === 'tier') { hud.toast(`🎉 T${e.tier} 달성! 새 생물과 물건이 열렸어요`, true, 4200); jelly.poke(-0.9, 0.25, 0.15); hf.disturb(20, 20, 2.2, -2.4); }
    else if (e.type === 'ext' && !opt.ext) extOpened();
    else if (e.type === 'chance') hud.toast(`✨ ${SP[e.sp].name}이 특별한 행동을 해요! 7초 안에 눌러요`);
    else if (e.type === 'claim') hud.toast(`요청 완료 ⭐+${e.reward}`);
    else if (e.type === 'extGoal' && e.key !== 'visit') hud.toast('확장 영역 꾸미기 하나 달성! 요청 탭에서 받아요');
    else if (e.type === 'extMaster') hud.toast(`확장 영역 마스터! ⭐+${e.reward}`, true, 5000);
    else if (e.type === 'terrain') hud.toast(`지형이 바뀌어 물건 ${e.moved}개를 옮기고 ${e.refunded}개 값을 돌려줬어요`);
  }
  if (dirty) propView.sync(G.props(S));
}
function extOpened() {
  save();
  hud.modal('<h3>🌊 확장 영역이 열렸어요!</h3><p>블록 오른쪽에 바다가 20칸 더 붙고, 생물을 12마리 더 들일 수 있어요.</p>', [
    { label: '지금 넓히기', onClick: () => { save(); location.reload(); } },
    { label: '나중에', onClick: () => hud.toast('다음에 게임을 열면 넓어져 있어요') },
  ]);
}

// ---------- 동작(HUD가 부름) ----------
const game = {
  G, S: () => S,
  adopt(sp) {
    const r = G.adopt(S, sp);
    if (!r.ok) { hud.toast(r.why); return; }
    const a = r.animal;
    hf.disturb(a.x, a.y, 1.6, -1.8); jelly.poke(-0.35, 0.08, 0.04);
    hud.toast(`${SP[sp].icon ?? ''} ${SP[sp].name} 들어왔어요!`);
    curC = G.creatures(S);
    save();
  },
  startPlace,
  setLayer(L) {
    if (!placing) return;
    placing.layer = L;
    // 그 자리에 그 층이 없으면(물이 얕음) 그 층이 있는 권하는 빈자리로 옮긴다(DESIGN 5.3절)
    if (!G.space.terrainOk(placing.id, placing.x, placing.y, L)) {
      const at = G.freeSpot(S, placing.id, { layer: L });
      if (at) { placing.x = at.x; placing.y = at.y; hud.toast(`여기는 얕아서 ${eco.layers[L].name}이 없어요. 깊은 자리로 옮겼어요`); }
    }
    evalPlace();
  },
  rotate() { if (!placing) return; placing.rot = (placing.rot + 1) & 3; drawGhost(); },
  confirmPlace() {
    if (!placing) return;
    const p = placing, r = G.placeItem(S, p.id, p.x, p.y, p.layer, p.rot);
    if (!r.ok) { hud.toast(r.why); evalPlace(); return; }
    handleEvents(G.drainEvents(S));
    hf.disturb(p.x + IT[p.id].w / 2, p.y + IT[p.id].h / 2, 1.4, -1.2); jelly.poke(-0.25);
    hud.toast(`${IT[p.id].icon ?? ''} ${IT[p.id].name} 놓았어요`);
    endPlace();
    save();
  },
  cancelPlace: endPlace,
  release(uid) { const r = G.release(S, uid); if (!r.ok) { hud.toast(r.why); return; } hud.toast(`바다로 돌려보냈어요 ⭐+${r.refund}`); hud.select(null); curC = G.creatures(S); save(); },
  removeItem(uid) { const r = G.removeItem(S, uid); if (!r.ok) { hud.toast(r.why); return; } handleEvents(G.drainEvents(S)); hud.toast(`치웠어요 ⭐+${r.refund}`); hud.select(null); save(); },
  capture, chanceTap,
  claim(uid) { const r = G.claim(S, uid); if (!r.ok) hud.toast(r.why); else save(); },
  swap(uid) { const r = G.swapRequest(S, uid); if (!r.ok) hud.toast(r.why); },
  claimExt(key) { const r = G.claimExt(S, key); if (!r.ok) hud.toast(r.why); else { hud.toast(`⭐+${r.reward + (r.master || 0)}`); save(); } },
  setView(name) { rig.setView(name); },
  deselect() {},
  panelChanged() { resize(); },
};

// ---------- 루프 ----------
const app = new App({ renderer, scene, camera, rig, world, jelly, capture: opt.capture, perf: opt.perf,
  extra: () => ({ water: opt.water + (opt.water === 'box' ? ` σ×${opt.sigma.toFixed(2)}` : ''), creatures: creatures.total, props: propView.count, view: rig.current }) });
deformUniforms.uDeformGain.value = opt.deform ? 1 : 0;

let hudAt = 0;
app.onUpdate((dt, t) => {
  // 블록 가속도 → 물 쏠림, 변형 해류
  const a = jelly.accel;
  hf.slosh(a.x, -a.z, dt);
  hf.step(dt);
  water.update();
  const cur = deformUniforms.uCurrent.value;
  cur.set(-a.x, 0, -a.z).multiplyScalar(0.004).clampLength(0, 0.4);
  cur.lerp(new THREE.Vector3(0.03 * Math.sin(t * 0.3), 0, 0.02), 0.2);
  deformUniforms.uSquash.value = jelly.s.q * 1.6;
  // 규칙: 고정 단계(1/30초)로 진행. 화면은 마지막 두 단계 사이를 보간한다. 프레임이 아주 길면(1/20초 넘게) 그만큼 규칙 시간이 느리게 간다
  if (lineup) { creatures.update(null, lineup, 1, dt); }
  else if (S) {
    acc += dt;
    let n = 0;
    while (acc >= STEP - 1e-9 && n < 12) { prevC = curC; G.tick(S); curC = G.creatures(S); acc -= STEP; n++; }
    if (n >= 12) acc = 0;
    const evs = G.drainEvents(S);
    if (evs.length) handleEvents(evs);
    creatures.update(prevC, curC, Math.min(1, acc / STEP), dt);
  }
  propView.update((x, y, st) => floatOn(hf, x, y, st, Math.min(1, dt * 6)));
  if (hud && mode === 'play') {
    chanceMarker();
    const now = performance.now();
    if (now - hudAt > 120) { hudAt = now; hud.update(now); }
  }
});

// 블록 누르기·끌기 → 젤리 + 물결. 짧은 탭은 먼저 고르기(생물 → 물건)
const gridOf = (p) => coords.toGrid(p.x, p.y, p.z, {});
const input = new BlockInput({
  dom: canvas, camera, rig, jelly, hitMesh,
  onTap: (p) => { const g = gridOf(p); hf.disturb(g.x, g.y, 1.4, -2.2); },
  onDrag: (p) => { const g = gridOf(p); hf.disturb(g.x, g.y, 0.9, -0.35); },
  onPick: (e) => pick(e),
});

// ---------- 시작 흐름 ----------
// 타이틀 동안: 카메라는 블록 둘레를 천천히 돌고(조작 잠금), 규칙 시간은 타이틀용 사본에서만 흐른다(진짜 상태는 멈춤, PLAN 7.2절).
// 시작: 블록이 한 번 출렁 → 카메라가 기본 시점으로 넘어감 → 조작 풀림 → HUD.
let title = null;
function cameraIn() {
  jelly.poke(-0.9, 0.25, 0.15);
  hf.disturb(20, 20, 2.2, -2.8);
  rig.stopOrbit();
  rig.controls.enabled = false;
  rig.setView('default', 1.8);
  setTimeout(() => { rig.controls.enabled = true; input.enabled = !ui || ui.querySelector('[data-k=drag]').checked; }, opt.capture ? 0 : 1850);
}
function enterPlay(s) {
  setState(s, true);
  mode = 'play';
  document.body.classList.remove('intro');
  resize();
  hud.refresh();
  save();
}
function continueGame(real, bg) {
  if (bg) real.animals = bg.animals;   // 타이틀에서 헤엄치던 자리 그대로 이어서(끊김 없이). 경제·시간은 저장된 그대로
  const off = G.settleOffline(real, Date.now());
  cameraIn();
  enterPlay(real);
  if (opt.ext && G.extOpen(real)) G.visitExt(real);
  if (off.gain >= 1) hud.toast(`쉬는 동안 관람 수익 ⭐+${Math.floor(off.gain)}${off.capped ? '(30분치까지)' : ''}`, true, 4000);
}
async function runPrologue() {
  if (!opt.prologue || opt.capture) return;
  let mod = null;
  try { mod = await import('../ui/prologue.js'); } catch { return; }   // 프롤로그 파일이 아직 없으면 건너뜀
  if (typeof mod?.showPrologue !== 'function') return;
  mode = 'prologue';
  document.body.classList.add('intro');
  try { await mod.showPrologue({ root: document.body, onDone: () => {} }); } catch (err) { console.warn('프롤로그를 띄우지 못했어요', err); }
}
async function newGame() {
  store.del(SAVE_KEY);
  if (opt.ext) { store.set(NEW_FLAG, '1', sessionStorage); location.reload(); return; }   // 새 게임은 닫힌 지형에서
  cameraIn();
  await runPrologue();
  const s = G.newGame((Date.now() % 2147483646) + 1, Date.now());
  enterPlay(s);
  hud.toast('생물 탭에서 첫 생물(해삼)을 들여 보세요 🥒', true, 5000);
}

if (!opt.capture || opt.hud) hud = createHud(game);
if (opt.lineup) { lineup = lineupList(); S = demoState(0); mode = 'demo'; propView.sync(G.props(S)); }
else if (opt.demo) { setState(demoState(opt.n), false); mode = hud ? 'play' : 'demo'; }
else {
  const real = raw ? G.deserialize(raw) : null;
  if (raw && !real) console.warn('저장을 읽지 못했어요(형식이 다름). 새로 시작해요');
  const bg = real ? G.deserialize(raw) : demoState(20, 4);
  setState(bg, false);
  if (opt.title) {
    mode = 'title';
    input.enabled = false;
    title = createTitle({
      title: 'Ocean World 3D',
      prompt: real ? '눌러서 다시 바다로!' : '눌러서 바다로 들어가요!',
      onStart: () => (real ? continueGame(real, bg) : newGame()),
      onNew: real ? () => newGame() : undefined,
    });
  } else if (real) continueGame(real, bg);
  else newGame();
}
resize();
rig.setView(presets[opt.view] ? opt.view : 'default', 0);
if (opt.lineup) rig.setView('lineup', 0);
if (title) rig.startOrbit('title');

// ---------- 녹화 모드 ----------
app.installCapture({
  title: { start: () => { if (title) title.start(); app.step(0); }, active: () => !!title && !title.started },
  info: () => ({ opt, total: creatures.total, props: propView.count, patch: patchStats(), terrain: TER.summary(tOpts), polar: rig.polarDeg,
    state: S && { tier: S.tier, pop: Math.floor(S.pop), animals: S.animals.length, items: S.items.length, time: +S.time.toFixed(1) } }),
  poke: (amt = -0.8, sx = 0.4, sz = 0.2) => { jelly.poke(amt, sx, sz); hf.disturb(20, 20, 2, -2.5); },
  setJelly: (s) => jelly.setStrength(s),
  setSigma,
  orbit: (polar, azimuth, distance, target) => {
    presets._custom = { polar, azimuth, distance: distance ?? fit, target: target ?? [0, -3, 0] };
    rig.setView('_custom', 0); app.step(0);
  },
  game,
});
window.__ow = { app, opt, jelly, rig, hf, creatures, propView, batch, fog, input, hitMesh, heightAt, G, game, get S() { return S; }, get mode() { return mode; }, get placing() { return placing; }, ghost, save };
app.start();

// ---------- 설정·확인용 작은 창(⚙) ----------
if (ui) {
  const link = (over) => { const p = new URLSearchParams(location.search); for (const [k, v] of Object.entries(over)) { if (v === null) p.delete(k); else p.set(k, v); } return '?' + p.toString(); };
  ui.querySelector('[data-k=water]').innerHTML =
    `<a class="${opt.water === 'box' ? 'on' : ''}" href="${link({ water: null })}">투과 없음(제안)</a>` +
    `<a class="${opt.water === 'transmission' ? 'on' : ''}" href="${link({ water: 'transmission' })}">투과(참고 사례)</a>`;
  const views = ui.querySelector('[data-k=views]');
  for (const [k, label] of [['default', '기본'], ['top', '위'], ['side', '옆'], ['under', '아래'], ['near', '수면 기둥']]) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => rig.setView(k); views.appendChild(b);
  }
  const js = ui.querySelector('[data-k=jelly]');
  js.value = String(opt.jelly);
  const jv = ui.querySelector('[data-k=jellyv]');
  const showJ = () => { jv.textContent = jelly.strength === 0 ? '끔' : jelly.strength.toFixed(1); };
  showJ();
  js.oninput = () => { jelly.setStrength(parseFloat(js.value)); showJ(); };
  const sg = ui.querySelector('[data-k=sigma]'), sv = ui.querySelector('[data-k=sigmav]');
  sg.value = String(opt.sigma); sv.textContent = opt.sigma.toFixed(2);
  sg.oninput = () => { setSigma(parseFloat(sg.value)); sv.textContent = opt.sigma.toFixed(2); };
  if (opt.water === 'transmission') sg.closest('.row').style.display = 'none';
  ui.querySelector('[data-k=poke]').onclick = () => { jelly.poke(-0.8, 0.35, 0.2); hf.disturb(20, 20, 2, -2.5); };
  const dragT = ui.querySelector('[data-k=drag]');
  dragT.onchange = () => { input.enabled = dragT.checked; };
  ui.querySelector('[data-k=perf]').href = link({ perf: opt.perf ? null : '1' });
  ui.querySelector('[data-k=perf]').textContent = opt.perf ? '성능 표시 끄기' : '성능 표시 켜기';
  ui.querySelector('[data-k=demo]').href = opt.demo ? link({ demo: null, n: null }) : link({ demo: '1' });
  ui.querySelector('[data-k=demo]').textContent = opt.demo ? '내 게임으로' : '견본 장면(44마리)';
}
window.addEventListener('keydown', (e) => {
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (placing) {
    if (k === 'escape') game.cancelPlace();
    else if (k === 'r') game.rotate();
    else if (k === 'enter') game.confirmPlace();
    return;
  }
  if (k === 'escape' && hud) hud.select(null);
  else if (k === 't') rig.setView('top'); else if (k === 'y') rig.setView('side'); else if (k === 'h') rig.setView('default');
});
