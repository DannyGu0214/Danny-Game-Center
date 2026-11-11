// P1 기술 시제품 조립: 열대 환초 블록 하나(render/core + render/aqua + eco/atoll).
// 이 파일만 core와 aqua를 함께 안다(조립하는 곳). core는 aqua를 import하지 않는다.
//
// 주소 옵션
//   ?water=box|transmission  물 방식(기본 box = 투과 없음, transmission = 참고 사례 방식)
//   ?n=44                    생물 수(0~400)
//   ?jelly=1                 젤리 세기(0 = 끔, 2 = 두 배)
//   ?view=default|top|side|under|near|bungalow  시작 시점
//   ?perf=1                  성능 표시
//   ?capture                 녹화 모드(RAF 없이 window.__cap.step(dt)로 진행)
//   ?shadow=0 ?fog=0 ?caustics=0 ?snow=0 ?shafts=0 ?deform=0   기능 끄기(비교용)
//   ?ext=1                   T8 확장 영역까지 넓힌 블록(지형 함수 확인용)
//   ?size=1280x800 ?dpr=1    녹화 모드 캔버스 크기, 픽셀 비율
//   ?title=0|1               타이틀 화면. 기본은 켬, ?capture·?perf=1에서는 끔(검증 자동화용). title=1이면 그때도 켬
import * as THREE from 'three';
import * as TER from '../eco/atoll/terrain.js';
import { ENV, WATER, TERRAIN_COLORS, STRATA, STRATA_BOTTOM } from '../eco/atoll/profile.js';
import { createStage } from './core/stage.js';
import { makeCoords } from './core/coords.js';
import { JellyBlock } from './core/jelly.js';
import { CameraRig } from './core/camera.js';
import { buildTerrain } from './core/terrain.js';
import { SpeciesMesh } from './core/instancing.js';
import { PropBatch } from './core/batched.js';
import { patchMaterial, patchStats } from './core/materials/shaderPatches.js';
import { deformUniforms } from './core/deform.js';
import { App } from './core/app.js';
import { BlockInput } from './core/input.js';
import { createWaterFog } from './aqua/waterFog.js';
import { Heightfield } from './aqua/heightfield.js';
import { WaterBody } from './aqua/surface.js';
import { createMarineSnow, createLightShafts } from './aqua/particles.js';
import { floatOn } from './aqua/buoyancy.js';
import { SPECIES, speciesMaterial, scaleCounts } from './proto/species.js';
import { propGeometries } from './proto/props.js';
import { Wander } from './proto/wander.js';
import { rng } from './proto/geo.js';
import { createTitle } from '../ui/title.js';

// ---------- 옵션 ----------
const q = new URLSearchParams(location.search);
const flag = (k, d = true) => (q.has(k) ? q.get(k) !== '0' && q.get(k) !== 'false' : d);
const opt = {
  capture: q.has('capture'),
  water: q.get('water') === 'transmission' ? 'transmission' : 'box',
  n: q.has('n') ? Math.max(0, Math.min(400, parseInt(q.get('n'), 10) || 0)) : 44,
  jelly: q.has('jelly') ? Math.max(0, parseFloat(q.get('jelly')) || 0) : 1,
  view: q.get('view') || 'default',
  perf: q.get('perf') === '1',
  shadows: flag('shadow'), fog: flag('fog'), caustics: flag('caustics'), snow: flag('snow'), shafts: flag('shafts'), deform: flag('deform'),
  ext: q.get('ext') === '1',
  lineup: q.get('lineup') === '1',   // 종마다 한 마리씩 앞 옆면 가까이 줄 세우기(변형 확인용)
  size: (q.get('size') || '1280x800').split('x').map(Number),
  dpr: q.has('dpr') ? parseFloat(q.get('dpr')) : null,
  title: q.has('title') ? q.get('title') !== '0' : !(q.has('capture') || q.get('perf') === '1'),
  sigma: q.has('sigma') ? Math.max(0.05, parseFloat(q.get('sigma')) || 1) : 1,  // 물 흡수 배율(탁도)
};
if (opt.water === 'transmission') opt.fog = q.has('fog') ? opt.fog : false; // 투과 방식은 기본으로 물속 안개를 끈다(사례와 같게)
document.body.classList.toggle('capture', opt.capture);

// ---------- 지형·좌표 ----------
const tOpts = { ext: opt.ext };
const heightAt = (x, y) => TER.heightAt(x, y, tOpts);
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

// ---------- 물건(BatchedMesh 하나) ----------
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
const batch = new PropBatch(propMat, props.geometries, 120);
batch.mesh.castShadow = true; batch.mesh.receiveShadow = true;
world.add(batch.mesh);

const pr = rng(77);
const findSpot = (pred, near, rad, tries = 600) => {
  for (let k = 0; k < tries; k++) {
    const a = pr() * Math.PI * 2, d = Math.sqrt(pr()) * rad;
    const x = near.x + Math.cos(a) * d, y = near.y + Math.sin(a) * d;
    if (x < bounds.x0 + 2.5 || x > bounds.x1 - 2.5 || y < bounds.y0 + 2.5 || y > bounds.y1 - 2.5) continue;
    const g = heightAt(x, y);
    if (pred(g, x, y)) return { x, y, g };
  }
  return null;
};
const Q = (yaw = 0) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
const S1 = new THREE.Vector3(1, 1, 1);
const placed = [];
function put(name, spot, { z, yaw = pr() * Math.PI * 2, scale = S1, color, zone } = {}) {
  if (!spot) return null;
  const id = batch.add(props.index[name], W(spot.x, spot.y, z ?? spot.g), Q(yaw), scale, color);
  placed.push({ name, zone, x: +spot.x.toFixed(1), y: +spot.y.toFixed(1), z: +(z ?? spot.g).toFixed(2) });
  return id;
}
// 육지
const isl = LM.island;
for (const n of ['palmA', 'palmB', 'palmC']) put(n, findSpot((g) => g > 1.6, isl, 5), { zone: 'land' });
put('hut', findSpot((g) => g > 1.9, isl, 3), { zone: 'land' });
for (const n of ['bushA', 'bushB', 'bushA']) put(n, findSpot((g) => g > 0.7 && g < 1.6, isl, 7), { zone: 'land' });
put('shellBox', findSpot((g) => g > 0.25 && g < 0.6, LM.sandbank, 4), { zone: 'land' });
// 해저
const coralColors = [null, new THREE.Color(0xffd0e0), new THREE.Color(0xd8f0ff), new THREE.Color(0xfff0c0)];
['coralPink', 'coralPurple', 'coralOrange', 'coralPink', 'coralOrange'].forEach((n, i) =>
  put(n, findSpot((g) => g > -1.9 && g < -0.7, i < 3 ? isl : LM.sandbank, 11), { zone: 'seabed', color: coralColors[i % 4] }));
put('clam', findSpot((g) => g > -1.8 && g < -0.8, LM.lagoon, 14), { zone: 'seabed' });
put('clam', findSpot((g) => g > -1.8 && g < -0.8, LM.sandbank, 8), { zone: 'seabed' });
put('boulderA', findSpot((g) => g > -6 && g < -4, LM.thila, 4), { zone: 'seabed' });
put('boulderB', findSpot((g) => g > -6.5 && g < -4, LM.thila, 4), { zone: 'seabed' });
put('boulderA', findSpot((g) => g > -3.4 && g < -2.2, LM.bommies[1], 4), { zone: 'seabed' });
put('dome', findSpot((g) => g < -10.6, { x: 12, y: 5 }, 6), { zone: 'seabed' });
put('reef', findSpot((g) => g > -3.8 && g < -2.6, LM.lagoon, 6), { zone: 'seabed' });
for (const n of ['grassA', 'grassB', 'grassA', 'grassB']) put(n, findSpot((g) => g > -3.6 && g < -2.2, LM.lagoon, 10), { zone: 'seabed' });
// 수중: 표층에 뜬 부표(줄로 닻에 매임), 중층에 매단 산호 묘목 줄, 칸두 중층의 플랑크톤 등
const buoySpot = findSpot((g) => g < -3 && g > -5, { x: 30, y: 19 }, 6) || { x: 30, y: 19, g: -3 };
put('anchor', buoySpot, { zone: 'underwater' });
const buoyId = put('buoy', buoySpot, { z: 0, zone: 'underwater' });
const buoyRope = put('rope', buoySpot, { zone: 'underwater', scale: new THREE.Vector3(1, -buoySpot.g, 1) });
const nurSpot = findSpot((g) => g < -3.6, LM.lagoon, 8) || { x: 20, y: 18, g: -3.5 };
const nurZ = nurSpot.g * 0.45;
put('anchor', nurSpot, { zone: 'underwater' });
put('rope', nurSpot, { zone: 'underwater', scale: new THREE.Vector3(1, nurZ - nurSpot.g, 1), yaw: 0 });
put('nursery', nurSpot, { z: nurZ, zone: 'underwater', yaw: 0.4 });
const lampSpot = findSpot((g) => g < -10, { x: 18, y: 6 }, 5) || { x: 18, y: 6, g: -11 };
put('anchor', lampSpot, { zone: 'underwater' });
put('rope', lampSpot, { zone: 'underwater', scale: new THREE.Vector3(1, -5.2 - lampSpot.g, 1) });
put('plankton', lampSpot, { z: -5.2, zone: 'underwater' });
// 수면을 가로지르는 기둥: 칸두 앞쪽 수로 표지(앞 옆면 가까이) + 석호의 물 위 방갈로
const pole = { x: 9, y: 3.2 }; pole.g = heightAt(pole.x, pole.y);
put('pillar', pole, { zone: 'cross', yaw: 0, scale: new THREE.Vector3(1.4, 2.2 - pole.g, 1.4), color: new THREE.Color(0xffd27a) });
const bung = findSpot((g) => g < -2.4 && g > -3.6, { x: 24, y: 19 }, 5) || { x: 24, y: 19, g: heightAt(24, 19) };
const deckZ = 1.4;
for (const [ox, oy] of [[-1.7, -1.3], [1.7, -1.3], [-1.7, 1.3], [1.7, 1.3]]) {
  const s = { x: bung.x + ox, y: bung.y + oy }; s.g = heightAt(s.x, s.y);
  put('pillar', s, { zone: 'cross', yaw: 0, scale: new THREE.Vector3(1, deckZ - s.g, 1) });
}
put('bungalow', bung, { z: deckZ + 0.12, zone: 'cross', yaw: 0 });

// ---------- 생물 ----------
// 줄 세우기: 크기만큼 간격을 두고 칸두를 따라, 수심 5.6칸에 띄움(움직이지 않음)
const LINE_X = (() => { let x = 0; const xs = SPECIES.map((sp) => { const c = x + sp.L / 2; x += sp.L + 1.1; return c; }); const off = 20 - x / 2; return xs.map((v) => v + off); })();
const lineY = (x) => 3.0 + (2.4 * (x + 4)) / 48;
function lineUp(c, si) { c.x = LINE_X[si]; c.y = lineY(c.x); c.z = -5.6; c.yaw = 0; c.pitch = 0; c.roll = 0; c.life = 'fixed'; c.walk = 1; c.L = c.sp.L; }
const wander = new Wander({ bounds, heightAt, seed: 9 });
const counts = opt.lineup ? SPECIES.map(() => 1) : scaleCounts(opt.n);
const species = [];
let total = 0;
SPECIES.forEach((sp, si) => {
  const c = counts[si];
  const geo = sp.build();
  const { material, patches } = speciesMaterial(sp);
  patchMaterial(material, patches, { slots: ['medium'], defines: { OW_CAUSTICS: true } });
  const sm = new SpeciesMesh(geo, material, c);
  sm.mesh.name = 'sp-' + sp.id;
  sm.mesh.renderOrder = sp.mat && sp.mat.transparent ? 3 : 0;
  const r = rng(100 + si);
  const list = [];
  for (let i = 0; i < c; i++) {
    let place = null;
    if (sp.life === 'fixed') { const s = findSpot((g) => g > -2.2 && g < -0.8, i % 2 ? LM.lagoon : LM.island, 12); if (s) place = { x: s.x, y: s.y }; }
    const cr = wander.add(sp, place);
    if (opt.lineup) lineUp(cr, si);
    list.push(cr);
    sm.setPhase(i, r() * Math.PI * 2);
    sm.setSpeed(i, 0.85 + r() * 0.3);
    sm.setParams(i, r() * 0.1, 0, 0, 0);
    const tint = new THREE.Color().setHSL(r(), 0.25, 0.9);
    sm.setColor(i, new THREE.Color(1, 1, 1).lerp(tint, sp.id === 'moonjelly' ? 0.6 : 0.25));
  }
  world.add(sm.mesh);
  species.push({ sp, sm, list });
  total += c;
});

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
const pW = W(pole.x, pole.y, 0.2), bW = W(bung.x, bung.y, 0.4);
const presets = {
  default: { polar: 60, azimuth: 26, target: [0, -3, 0], distance: fit },
  top: { polar: 1.5, azimuth: 0, target: [0, -2, 0], distance: (c) => fit(c) * 0.95 },
  side: { polar: 86, azimuth: 0, target: [0, -4.5, 0], distance: fit },
  under: { polar: 93, azimuth: 14, target: [0, -6, 0], distance: fit },
  near: { polar: 82, azimuth: 16, target: pW.toArray(), distance: 11 },
  bungalow: { polar: 60, azimuth: 32, target: bW.toArray(), distance: 17 },
  title: { polar: 64, azimuth: 30, target: [0, -2.5, 0], distance: (c) => fit(c) * 1.04, orbitSpeed: 5 },
  lineup: { polar: 77, azimuth: 0, target: W(20, 3.0 + 2.4 * 24 / 48, -5.4).toArray(), distance: 29 },
};
const keepOut = new THREE.Box3(new THREE.Vector3(-hx - 1, BOTTOM - 1, -hz - 1), new THREE.Vector3(hx + 1, 7.5, hz + 1));
const rig = new CameraRig(camera, canvas, { box: keepOut, target: new THREE.Vector3(0, -3, 0), presets });

function resize() {
  let w, h;
  if (opt.capture) { [w, h] = opt.size; } else { w = window.innerWidth; h = window.innerHeight; }
  renderer.setSize(w, h, !opt.capture);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', () => { if (!opt.capture) resize(); });
rig.setView(presets[opt.view] ? opt.view : 'default', 0);

const ui = opt.capture ? null : document.getElementById('ui');

// ---------- 루프 ----------
const app = new App({ renderer, scene, camera, rig, world, jelly, capture: opt.capture, perf: opt.perf,
  extra: () => ({ water: opt.water + (opt.water === 'box' ? ` σ×${opt.sigma.toFixed(2)}` : ''), creatures: total, view: rig.current }) });
deformUniforms.uDeformGain.value = opt.deform ? 1 : 0;

const tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
const buoyState = {};
app.onUpdate((dt, t) => {
  // 블록 가속도 → 물 쏠림, 생물 해류, 변형 해류
  const a = jelly.accel;
  hf.slosh(a.x, -a.z, dt);
  hf.step(dt);
  water.update();
  wander.current.x -= a.x * dt * 0.06; wander.current.y -= -a.z * dt * 0.06;
  const cur = deformUniforms.uCurrent.value;
  cur.set(-a.x, 0, -a.z).multiplyScalar(0.004).clampLength(0, 0.4);
  cur.lerp(new THREE.Vector3(0.03 * Math.sin(t * 0.3), 0, 0.02), 0.2);
  deformUniforms.uSquash.value = jelly.s.q * 1.6;
  // 생물
  wander.update(dt, t);
  for (const { sm, list } of species) {
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      coords.toWorld(c.x, c.y, c.z, tmpP);
      tmpE.set(-c.pitch, coords.yawToWorld(c.yaw), c.roll);
      tmpQ.setFromEuler(tmpE);
      sm.setTransform(i, tmpP, tmpQ, c.L);
      if (c.life === 'walk' || opt.lineup) sm.params.setY(i, c.walk);
    }
    sm.params.needsUpdate = true;
    sm.commit();
  }
  // 떠 있는 부표
  if (buoyId !== null) {
    floatOn(hf, buoySpot.x, buoySpot.y, buoyState, Math.min(1, dt * 6));
    tmpQ.setFromEuler(tmpE.set(-buoyState.tiltY * 0.8, 0, -buoyState.tiltX * 0.8));
    batch.move(buoyId, W(buoySpot.x, buoySpot.y, buoyState.z - 0.12), tmpQ, S1);
    batch.move(buoyRope, W(buoySpot.x, buoySpot.y, buoySpot.g), Q(0), new THREE.Vector3(1, buoyState.z - 0.2 - buoySpot.g, 1));
  }
});

// 블록 누르기·끌기 → 젤리 + 물결
const gridOf = (p) => coords.toGrid(p.x, p.y, p.z, {});
const input = new BlockInput({
  dom: canvas, camera, rig, jelly, hitMesh,
  onTap: (p) => { const g = gridOf(p); hf.disturb(g.x, g.y, 1.4, -2.2); },
  onDrag: (p) => { const g = gridOf(p); hf.disturb(g.x, g.y, 0.9, -0.35); },
});

// ---------- 타이틀 ----------
// 타이틀 동안: 카메라는 블록 둘레를 천천히 돌고(조작 잠금), 생물·물은 계속 움직인다.
// 시작(누르기): 블록이 한 번 출렁 → 카메라가 기본 시점으로 넘어감 → 조작 풀림.
let title = null;
/** 게임 시작 동작. P2에서 저장 유무·프롤로그가 이 앞뒤에 붙는다. */
function startGame() {
  jelly.poke(-0.9, 0.25, 0.15);
  hf.disturb(20, 20, 2.2, -2.8);
  rig.stopOrbit();
  rig.controls.enabled = false;
  rig.setView('default', 1.8);
  setTimeout(() => { rig.controls.enabled = true; input.enabled = !ui || ui.querySelector('[data-k=drag]').checked; }, opt.capture ? 0 : 1850);
}
if (opt.title) {
  input.enabled = false;
  rig.startOrbit('title');
  title = createTitle({ title: 'Ocean World 3D', prompt: '눌러서 바다로 들어가요!', onStart: startGame });
}

app.installCapture({
  title: { start: () => { if (title) title.start(); app.step(0); }, active: () => !!title && !title.started },
  info: () => ({ opt, total, counts: Object.fromEntries(SPECIES.map((s, i) => [s.id, counts[i]])), placed, patch: patchStats(),
    terrain: TER.summary(tOpts), polar: rig.polarDeg }),
  poke: (amt = -0.8, sx = 0.4, sz = 0.2) => { jelly.poke(amt, sx, sz); hf.disturb(20, 20, 2, -2.5); },
  setJelly: (s) => jelly.setStrength(s),
  setSigma,
  orbit: (polar, azimuth, distance, target) => {
    presets._custom = { polar, azimuth, distance: distance ?? fit, target: target ?? [0, -3, 0] };
    rig.setView('_custom', 0); app.step(0);
  },
});
window.__ow = { app, opt, jelly, rig, hf, species, batch, placed, fog, input, hitMesh };
app.start();

// ---------- 작은 UI ----------

if (ui) {
  const link = (over) => { const p = new URLSearchParams(location.search); for (const [k, v] of Object.entries(over)) { if (v === null) p.delete(k); else p.set(k, v); } return '?' + p.toString(); };
  ui.querySelector('[data-k=water]').innerHTML =
    `<a class="${opt.water === 'box' ? 'on' : ''}" href="${link({ water: null })}">투과 없음(제안)</a>` +
    `<a class="${opt.water === 'transmission' ? 'on' : ''}" href="${link({ water: 'transmission' })}">투과(참고 사례)</a>`;
  const views = ui.querySelector('[data-k=views]');
  for (const [k, label] of [['default', '기본'], ['top', '위'], ['side', '옆'], ['under', '아래'], ['near', '수면 기둥'], ['bungalow', '방갈로']]) {
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
  const nSel = ui.querySelector('[data-k=n]');
  nSel.value = String(opt.n);
  if (nSel.value !== String(opt.n)) { const o = document.createElement('option'); o.value = o.textContent = String(opt.n); nSel.appendChild(o); nSel.value = String(opt.n); }
  nSel.onchange = () => { location.search = link({ n: nSel.value }); };
  ui.querySelector('[data-k=perf]').href = link({ perf: opt.perf ? null : '1' });
  ui.querySelector('[data-k=perf]').textContent = opt.perf ? '성능 표시 끄기' : '성능 표시 켜기';
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 't') rig.setView('top'); else if (k === 'y') rig.setView('side'); else if (k === 'h') rig.setView('default');
  });
}
