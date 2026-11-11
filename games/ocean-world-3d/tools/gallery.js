// P3 화풍 확인용 갤러리: 생물 생성기 샘플을 물속 배경에서 나란히 돌려 본다(게임 본 화면과 별개).
// 주소 옵션
//   ?mode=lineup|crowd     lineup = 종마다 P1·젤리풍·로우폴리풍을 나란히(기본) · crowd = 고른 화풍으로 여러 마리 + 떼
//   ?v=jelly|lowpoly|p1    crowd에서 쓸 화풍(기본 jelly)
//   ?sv=jelly|lowpoly      장식 떼 화풍(기본: crowd는 v를 따름, lineup은 jelly)
//   ?school=0              장식 물고기 떼 끄기
//   ?fog=1|0.5|0           물속 안개 세기(1 = 게임과 같은 흡수 계수, 기본 0.5, 0 = 끔).
//                          갤러리는 카메라가 물속에 있어 생물까지 약 10칸이 통째로 물길이라, 1이면 가까이 확대해 볼 때보다 붉은색이 많이 빠진다
//   ?view=front|jellies|fishes|high|below|crowd
//   ?turn=0                돌리기(턴테이블) 끄기 · ?deform=0 변형 끄기
//   ?capture&size=1280x800 녹화 모드: RAF 없이 window.__cap.step(dt, n)으로 진행, __cap.shot()으로 그림
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ENV, WATER } from '../eco/atoll/profile.js';
import { createStage } from '../render/core/stage.js';
import { globals, patchMaterial, patchStats } from '../render/core/materials/shaderPatches.js';
import { deformUniforms } from '../render/core/deform.js';
import { SpeciesMesh } from '../render/core/instancing.js';
import { PropBatch } from '../render/core/batched.js';
import { createWaterFog } from '../render/aqua/waterFog.js';
import { createMarineSnow, createLightShafts } from '../render/aqua/particles.js';
import { createSchool, kitMaterial } from '../render/aqua/school.js';
import { SPECIES as P1_SPECIES, speciesMaterial as p1Material } from '../render/proto/species.js';
import { propGeometries } from '../render/proto/props.js';
import * as moonjelly from '../eco/atoll/species/moonjelly.js';
import * as clownfish from '../eco/atoll/species/clownfish.js';
import * as chromis from '../eco/atoll/species/chromis.js';

const q = new URLSearchParams(location.search);
const opt = {
  capture: q.has('capture'),
  size: (q.get('size') || '1280x800').split('x').map(Number),
  mode: q.get('mode') === 'crowd' ? 'crowd' : 'lineup',
  v: ['jelly', 'lowpoly', 'p1'].includes(q.get('v')) ? q.get('v') : 'jelly',
  school: q.get('school') !== '0',
  fog: q.has('fog') ? Math.max(0, parseFloat(q.get('fog'))) : 0.5,
  view: q.get('view') || (q.get('mode') === 'crowd' ? 'crowd' : 'front'),
  turn: q.get('turn') !== '0',
  deform: q.get('deform') !== '0',
};
opt.sv = ['jelly', 'lowpoly'].includes(q.get('sv')) ? q.get('sv') : (opt.mode === 'crowd' && opt.v === 'lowpoly' ? 'lowpoly' : 'jelly');
document.body.classList.toggle('capture', opt.capture);

// 게임 화면 크기(칸): data.js len × SIZES.draw. 갤러리 1단위 = 1칸
const SIZE = { moonjelly: 1.5 * 1.1, clownfish: 0.75 * 1.35 };
const SURFACE_Y = 4.5, FLOOR_Y = -2.6;

// ---------- 무대 ----------
const canvas = document.getElementById('view');
if (opt.capture) { canvas.width = opt.size[0]; canvas.height = opt.size[1]; }
const stage = createStage(canvas, ENV, { capture: opt.capture, shadows: false, pixelRatio: opt.capture ? 1 : undefined });
const { renderer, scene } = stage;
scene.background = null;

const waterBox = new THREE.Box3(new THREE.Vector3(-60, FLOOR_Y - 1, -60), new THREE.Vector3(60, SURFACE_Y, 60));
const fog = createWaterFog(WATER, waterBox);
fog.uniforms.uSigma.value.multiplyScalar(Math.max(0.0001, opt.fog));
fog.setFog(opt.fog > 0);

// 배경: 물속에서 본 하늘(수면 쪽 밝음 → 수평선 물색 → 아래 깊은 색). 물속 안개의 먼 끝 색과 이어지게 고름
{
  const lin = (h) => new THREE.Color(h);
  const horizon = lin(WATER.scatter).lerp(lin(WATER.scatterDeep), 0.3);
  const top = lin(0xb6ecf2), deep = lin(WATER.scatterDeep).multiplyScalar(0.8);
  const g = new THREE.SphereGeometry(200, 32, 24);
  const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const e = P.getY(i) / 200;
    if (e >= 0) c.copy(horizon).lerp(top, Math.pow(THREE.MathUtils.smoothstep(e, 0, 0.85), 1.4));
    else c.copy(horizon).lerp(deep, THREE.MathUtils.smoothstep(-e, 0, 0.6));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
  sky.name = 'bg'; sky.renderOrder = -10;
  scene.add(sky);
}

// 바닥 모래 + 산호 몇 개(P1 물건 모양을 빌려 씀)
const groups = {};   // 드로우콜 나눠 재기용 이름 → Object3D
{
  const g = new THREE.PlaneGeometry(90, 90, 90, 90); g.rotateX(-Math.PI / 2);
  const P = g.attributes.position, col = new Float32Array(P.count * 3), c = new THREE.Color(), a = new THREE.Color(0xf3ead2), b = new THREE.Color(0xd9c79c);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    const n = 0.5 + 0.25 * Math.sin(x * 0.7 + Math.sin(z * 0.4) * 2) + 0.25 * Math.sin(z * 0.9 - x * 0.3);
    P.setY(i, 0.12 * Math.sin(x * 1.3 + z * 0.7) * Math.cos(z * 1.1 - x * 0.4));
    c.copy(a).lerp(b, n * 0.5); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  m.name = 'floor';
  patchMaterial(m, [], { slots: ['medium'], defines: { OW_CAUSTICS: true } });
  const floor = new THREE.Mesh(g, m); floor.position.y = FLOOR_Y; floor.name = 'floor';
  scene.add(floor); groups.floor = floor;

  const props = propGeometries();
  const pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, flatShading: true });
  pm.name = 'props';
  patchMaterial(pm, [], { slots: ['medium'], defines: { OW_CAUSTICS: true } });
  const batch = new PropBatch(pm, props.geometries, 24);
  const Q = (y) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), y);
  const S = (s) => new THREE.Vector3(s, s, s);
  for (const [n, x, z, y, s] of [['coralPink', -7.5, -4, 0.3, 1.5], ['coralPurple', -2.2, -8.5, 1.1, 1.3], ['coralOrange', 3.4, -7.2, 2.2, 1.4],
    ['coralPink', 7.8, -3.4, 0.5, 1.2], ['grassA', -5.2, -6.5, 0, 1.2], ['grassB', 6.2, -8, 0.7, 1.3], ['grassA', 0.6, -10, 0.2, 1.2],
    ['boulderA', -6, -12, 0.4, 1.3], ['boulderB', 6, -13, 1.3, 1.5], ['clam', -1.4, -4.5, 0.5, 1.0]]) {
    batch.add(props.index[n], new THREE.Vector3(x, FLOOR_Y, z), Q(y), S(s));
  }
  scene.add(batch.mesh); groups.props = batch.mesh;

  groups.snow = createMarineSnow(new THREE.Box3(new THREE.Vector3(-14, FLOOR_Y + 0.4, -12), new THREE.Vector3(14, SURFACE_Y - 0.3, 7)), 800);
  scene.add(groups.snow);
  const sd = new THREE.Vector3(...ENV.sunDir).normalize();
  const pts = [[-9, -6], [-5, -2], [-1, -7], [3, -3], [7, -6], [10, -1], [-11, 0]].map(([x, z]) => new THREE.Vector3(x + 4, SURFACE_Y - 0.05, z + 3));
  groups.shafts = createLightShafts(pts, sd, 10).mesh;
  scene.add(groups.shafts);
}

// ---------- 샘플 ----------
const kitOf = (mod, variant) => mod.build(THREE, { variant });
/** 화풍 하나의 메시 만들기: { mesh(SpeciesMesh), tris, label } */
function speciesMesh(spId, variant, count) {
  if (variant === 'p1') {
    const sp = P1_SPECIES.find((s) => s.id === spId);
    const geo = sp.build();
    const { material, patches } = p1Material(sp);
    patchMaterial(material, patches, { slots: ['medium'], defines: { OW_CAUSTICS: true } });
    const sm = new SpeciesMesh(geo, material, count);
    sm.mesh.renderOrder = sp.mat && sp.mat.transparent ? 3 : 0;
    return { sm, tris: geo.index.count / 3, kit: null };
  }
  const kit = kitOf(spId === 'moonjelly' ? moonjelly : clownfish, variant);
  const sm = new SpeciesMesh(kit.geometry, kitMaterial(kit), count);
  sm.mesh.renderOrder = kit.material.renderOrder || 0;
  return { sm, tris: kit.info.triangles, kit };
}
const VLABEL = { p1: 'P1 임시 도형', jelly: 'A 매끈한 젤리풍', lowpoly: 'B 그래픽 로우폴리풍' };
const SPNAME = { moonjelly: '보름달물해파리', clownfish: '몰디브흰동가리' };

const samples = [];   // { spId, variant, sm, list:[{base, y, vy, kPrev, yaw, phase, speed, ...}], tris, label }
const _r = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
if (opt.mode === 'lineup') {
  const cols = { p1: -3.4, jelly: 0, lowpoly: 3.4 };
  for (const spId of ['moonjelly', 'clownfish']) {
    for (const variant of ['p1', 'jelly', 'lowpoly']) {
      const { sm, tris } = speciesMesh(spId, variant, 1);
      sm.mesh.name = `${spId}-${variant}`;
      const base = new THREE.Vector3(cols[variant], spId === 'moonjelly' ? 1.45 : -0.75, 0);
      sm.setPhase(0, variant === 'p1' ? 0 : 0.0); sm.setSpeed(0, 1); sm.setParams(0, 0, 0, 0, 0);
      scene.add(sm.mesh);
      groups[sm.mesh.name] = sm.mesh;
      samples.push({ spId, variant, sm, tris, label: `${VLABEL[variant]}`, list: [{ base, y: base.y, vy: 0, kPrev: 0, yaw: 0, phase: 0, speed: 1 }] });
    }
  }
} else {
  for (const [spId, n] of [['moonjelly', 7], ['clownfish', 10]]) {
    const { sm, tris } = speciesMesh(spId, opt.v, n);
    sm.mesh.name = `${spId}-${opt.v}`;
    const list = [];
    for (let i = 0; i < n; i++) {
      const phase = _r() * Math.PI * 2, speed = 0.85 + _r() * 0.3;
      sm.setPhase(i, phase); sm.setSpeed(i, speed); sm.setParams(i, 0, 0, 0, 0);
      if (spId === 'moonjelly') {
        const tint = new THREE.Color().setHSL(_r(), 0.3, 0.9);
        sm.setColor(i, new THREE.Color(1, 1, 1).lerp(tint, 0.35));
      }
      const base = new THREE.Vector3(-6 + _r() * 12, -1.2 + _r() * 4, -6 + _r() * 7);
      list.push({ base, y: base.y, vy: 0, kPrev: 0, phase, speed, r: 1.5 + _r() * 2.5, w0: _r() * 6.28, dir: _r() < 0.5 ? -1 : 1, yaw: 0 });
    }
    scene.add(sm.mesh);
    groups[sm.mesh.name] = sm.mesh;
    samples.push({ spId, variant: opt.v, sm, tris, label: `${SPNAME[spId]} ×${n}`, list });
  }
}

// 장식 물고기 떼(InstancedMesh 하나)
let school = null;
if (opt.school) {
  const kit = chromis.build(THREE, { variant: opt.sv });
  school = createSchool(kit, {
    seed: 5,
    schools: [
      { count: 46, center: [-1.5, 0.3, -5.2], radius: [6, 0.7, 2.2], speed: 1.5, spread: 1.15, size: 0.42 },
      { count: 30, center: [2.5, 2.4, -7.5], radius: [5, 0.9, 2.0], speed: 1.25, spread: 0.95, size: 0.4 },
    ],
    floor: () => FLOOR_Y,
    bounds: new THREE.Box3(new THREE.Vector3(-20, FLOOR_Y, -20), new THREE.Vector3(20, SURFACE_Y - 0.4, 6)),
  });
  scene.add(school.mesh);
  groups.school = school.mesh;
}

// ---------- 카메라 ----------
const camera = new THREE.PerspectiveCamera(32, 16 / 10, 0.1, 500);
const VIEWS = {
  front: { pos: [0, 1.3, 10.2], target: [0, 0.35, 0] },
  jellies: { pos: [0, 2.6, 7.2], target: [0, 1.35, 0] },
  fishes: { pos: [0, -0.2, 6.6], target: [0, -0.75, 0] },
  high: { pos: [0, 7.5, 7.5], target: [0, 0.2, 0] },
  below: { pos: [0, -2.1, 7.0], target: [0, 1.1, 0] },
  crowd: { pos: [0, 2.6, 13.5], target: [0, 0.6, -2] },
};
// 샘플마다 가까이 보기(lineup): 이름 = '<종>-<화풍>'
for (const smp of samples) {
  if (opt.mode !== 'lineup') break;
  const b = smp.list[0].base, isJ = smp.spId === 'moonjelly';
  VIEWS[smp.sm.mesh.name] = isJ ? { pos: [b.x, b.y + 2.0, b.z + 5.0], target: [b.x, b.y + 0.15, b.z] } : { pos: [b.x + 0.7, b.y + 0.45, b.z + 3.5], target: [b.x, b.y, b.z] };
}
const controls = opt.capture ? null : new OrbitControls(camera, canvas);
function setView(name) {
  const v = VIEWS[name] || VIEWS.front;
  camera.position.set(...v.pos);
  camera.lookAt(...v.target);
  if (controls) { controls.target.set(...v.target); controls.update(); }
  opt.view = name;
}
if (controls) { controls.enableDamping = true; controls.maxDistance = 40; }
function resize() {
  const [w, h] = opt.capture ? opt.size : [window.innerWidth, window.innerHeight];
  renderer.setSize(w, h, !opt.capture);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', () => { if (!opt.capture) resize(); });
setView(opt.view);
deformUniforms.uDeformGain.value = opt.deform ? 1 : 0;

// ---------- 움직임 ----------
const P = new THREE.Vector3(), Qt = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ');
let t = 0;
let fixedYaw = null;   // 녹화에서 각도를 고정해 찍을 때
function update(dt) {
  t += dt;
  globals.uTime.value = t;
  const cur = deformUniforms.uCurrent.value;
  cur.set(0.03 * Math.sin(t * 0.3), 0, 0.02);
  for (const s of samples) {
    const isJ = s.spId === 'moonjelly';
    const L = SIZE[s.spId];
    s.list.forEach((c, i) => {
      if (isJ) {
        // 박동에 맞춘 추진: 오므릴 때(박동 값이 오를 때) 위로 밀고, 천천히 가라앉으며 제자리로 돌아온다
        const k = moonjelly.pulse(t, c.speed, c.phase);
        c.vy += Math.max(0, k - c.kPrev) * 0.55; c.kPrev = k;
        c.vy += (c.base.y - c.y) * 0.8 * dt; c.vy *= Math.exp(-1.8 * dt);
        c.y += c.vy * dt;
        const drift = opt.mode === 'crowd' ? 0.25 * Math.sin(t * 0.13 + c.phase) : 0;
        P.set(c.base.x + drift, c.y, c.base.z);
        const tilt = opt.mode === 'lineup' ? 0.32 : 0.12 * Math.sin(t * 0.2 + c.phase);
        E.set(tilt, (fixedYaw ?? (opt.turn ? t * 0.25 : 0)) + c.phase, 0.06 * Math.sin(t * 0.3 + c.phase));
      } else if (opt.mode === 'lineup') {
        const yaw = fixedYaw ?? (opt.turn ? 1.2 + 0.9 * Math.sin(t * 0.35) : 1.25);
        P.set(c.base.x, c.base.y + 0.05 * Math.sin(t * 1.3), c.base.z);
        E.set(0.04 * Math.sin(t * 0.9), yaw, 0);
      } else {
        // 무리 화면: 원을 그리며 헤엄(속도 = data.js 흰동가리 1.2칸/초)
        const w = (1.2 / c.r) * c.dir, a = c.w0 + w * t;
        P.set(c.base.x + Math.cos(a) * c.r, c.base.y + 0.3 * Math.sin(t * 0.5 + c.phase), c.base.z + Math.sin(a) * c.r * 0.6);
        const vx = -Math.sin(a) * c.dir, vz = Math.cos(a) * 0.6 * c.dir;
        E.set(-0.1 * Math.cos(t * 0.5 + c.phase), Math.atan2(vx, vz), 0);
      }
      Qt.setFromEuler(E);
      s.sm.setTransform(i, P, Qt, L);
    });
    s.sm.commit();
  }
  if (school) school.update(dt, t);
}

function render() {
  if (controls) controls.update();
  camera.updateMatrixWorld();
  globals.uBlockInv.value.identity();
  globals.uCamBlock.value.copy(camera.position);
  renderer.render(scene, camera);
}

// ---------- 표시·녹화 ----------
const statEl = document.getElementById('stats');
let fpsAcc = 0, fpsN = 0, fps = 0;
function stats() {
  const i = renderer.info.render;
  return { calls: i.calls, triangles: i.triangles, programs: renderer.info.programs?.length ?? null };
}
/** 구성 요소별 드로우콜: 하나씩 숨겨 다시 그리고 차이를 잰다 */
function breakdown() {
  render();
  const all = stats();
  const parts = {};
  for (const [name, obj] of Object.entries(groups)) {
    obj.visible = false; render();
    parts[name] = { calls: all.calls - stats().calls, triangles: all.triangles - stats().triangles };
    obj.visible = true;
  }
  render();
  return { all, parts, samples: samples.map((s) => ({ name: s.sm.mesh.name, label: s.label, trisPerBody: s.tris, count: s.list.length })),
    school: school ? { count: school.count, triangles: school.triangles } : null, patch: patchStats() };
}
function projectLabel(s) {
  const c = s.list[0];
  const v = new THREE.Vector3(c.base.x, c.base.y - (s.spId === 'moonjelly' ? 0.95 : 0.75), c.base.z).project(camera);
  return [(v.x * 0.5 + 0.5), (-v.y * 0.5 + 0.5)];
}
/** 캔버스 + 이름표를 합친 그림(dataURL) */
function shot({ labels = true, title = '', type = 'image/jpeg', quality = 0.88 } = {}) {
  render();
  const W = canvas.width, H = canvas.height;
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const g = c2.getContext('2d');
  g.drawImage(canvas, 0, 0);
  g.font = `600 ${Math.round(H * 0.024)}px system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif`;
  g.textAlign = 'center';
  const tag = (txt, x, y) => {
    const w = g.measureText(txt).width + 18, h = Math.round(H * 0.036);
    g.fillStyle = 'rgba(255,255,255,0.82)'; g.beginPath(); g.roundRect(x - w / 2, y - h * 0.72, w, h, 8); g.fill();
    g.fillStyle = '#1d3340'; g.fillText(txt, x, y);
  };
  if (labels && opt.mode === 'lineup' && ['front', 'high', 'below'].includes(opt.view)) for (const s of samples) { const [x, y] = projectLabel(s); if (x > 0 && x < 1 && y > 0 && y < 1) tag(s.label, x * W, y * H); }
  if (title) { g.textAlign = 'left'; const pad = 14; g.font = `700 ${Math.round(H * 0.026)}px system-ui, sans-serif`; const w = g.measureText(title).width + 20;
    g.fillStyle = 'rgba(10,30,45,0.72)'; g.beginPath(); g.roundRect(pad, pad, w, H * 0.045, 8); g.fill(); g.fillStyle = '#fff'; g.fillText(title, pad + 10, pad + H * 0.031); }
  return c2.toDataURL(type, quality);
}
/** 같은 시점에서 시간을 나눠 여러 장을 가로로 이은 띠(움직임 확인용) */
function strip({ frames = 4, every = 0.24, crop = null, title = '' } = {}) {
  const W = canvas.width, H = canvas.height;
  const [cx, cy, cw, ch] = crop || [0, 0, W, H];
  const c2 = document.createElement('canvas'); c2.width = cw * frames; c2.height = ch;
  const g = c2.getContext('2d');
  for (let k = 0; k < frames; k++) {
    if (k) { const n = Math.round(every / (1 / 60)); for (let j = 0; j < n; j++) update(1 / 60); }
    render();
    g.drawImage(canvas, cx, cy, cw, ch, k * cw, 0, cw, ch);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = `600 ${Math.round(ch * 0.05)}px system-ui, sans-serif`; g.fillText(`t=${t.toFixed(2)}s`, k * cw + 10, ch - 12);
  }
  if (title) { g.fillStyle = 'rgba(10,30,45,0.72)'; g.fillRect(0, 0, c2.width, ch * 0.08); g.fillStyle = '#fff'; g.font = `700 ${Math.round(ch * 0.05)}px system-ui, sans-serif`; g.fillText(title, 10, ch * 0.06); }
  return c2.toDataURL('image/jpeg', 0.86);
}
async function save(name, dataURL) {
  const blob = await (await fetch(dataURL)).blob();
  const r = await fetch('/__save/' + name, { method: 'PUT', body: blob });
  return r.status;
}

window.__cap = {
  step(dt = 1 / 60, n = 1) { for (let k = 0; k < n; k++) update(dt); render(); return t; },
  setView(name) { setView(name); render(); return opt.view; },
  setYaw(y) { fixedYaw = y; },
  setTime(x) { t = x; },
  dump: stats, breakdown, shot, strip, save,
  time: () => t, opt,
  info: () => samples.map((s) => ({ name: s.sm.mesh.name, tris: s.tris, n: s.list.length })),
  ready: true,
};

if (!opt.capture) {
  const timer = new THREE.Timer(); timer.connect(document);
  let last = performance.now(), statT = 0;
  const loop = (ts) => {
    requestAnimationFrame(loop);
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 1 / 20);
    update(dt); render();
    const now = performance.now(); fpsAcc += now - last; fpsN++; last = now;
    statT += dt;
    if (statT > 0.5 && statEl) {
      fps = 1000 / (fpsAcc / fpsN); fpsAcc = 0; fpsN = 0; statT = 0;
      const s = stats();
      const tris = samples.map((x) => `${x.sm.mesh.name} ${x.tris.toLocaleString()}`).join(' · ');
      statEl.textContent = `드로우콜 ${s.calls} · 삼각형 ${s.triangles.toLocaleString()} · ${fps.toFixed(0)}fps\n몸 1개 삼각형: ${tris}${school ? `\n장식 떼 ${school.count}마리 · ${school.triangles.toLocaleString()}` : ''}`;
    }
  };
  requestAnimationFrame(loop);
  // 작은 UI
  const link = (over) => { const p = new URLSearchParams(location.search); for (const [k, v] of Object.entries(over)) { if (v === null) p.delete(k); else p.set(k, v); } return '?' + p.toString(); };
  const ui = document.getElementById('ui');
  const row = (lab, html) => { const d = document.createElement('div'); d.className = 'row'; d.innerHTML = `<span class="lab">${lab}</span>${html}`; ui.appendChild(d); return d; };
  const a = (on, href, txt) => `<a class="${on ? 'on' : ''}" href="${href}">${txt}</a>`;
  row('보기', a(opt.mode === 'lineup', link({ mode: null, v: null, view: null }), '나란히') + a(opt.mode === 'crowd' && opt.v === 'jelly', link({ mode: 'crowd', v: 'jelly', view: null, sv: null }), '무리: A 젤리풍') +
    a(opt.mode === 'crowd' && opt.v === 'lowpoly', link({ mode: 'crowd', v: 'lowpoly', view: null, sv: null }), '무리: B 로우폴리풍') + a(opt.mode === 'crowd' && opt.v === 'p1', link({ mode: 'crowd', v: 'p1', view: null, sv: null }), '무리: P1'));
  row('떼', a(opt.school && opt.sv === 'jelly', link({ school: null, sv: 'jelly' }), 'A') + a(opt.school && opt.sv === 'lowpoly', link({ school: null, sv: 'lowpoly' }), 'B') + a(!opt.school, link({ school: '0' }), '끔'));
  row('물빛', a(opt.fog === 1, link({ fog: '1' }), '게임 계수 그대로') + a(opt.fog === 0.5, link({ fog: null }), '절반(기본)') + a(opt.fog === 0, link({ fog: '0' }), '끔'));
  const vr = row('시점', '');
  for (const [k, label] of [['front', '정면'], ['jellies', '해파리'], ['fishes', '물고기'], ['high', '위'], ['below', '아래'], ['crowd', '멀리']]) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => setView(k); vr.appendChild(b);
  }
  const tr = row('움직임', '');
  const tb = (label, get, set) => { const b = document.createElement('button'); const upd = () => { b.textContent = `${label} ${get() ? '켬' : '끔'}`; }; b.onclick = () => { set(!get()); upd(); }; upd(); tr.appendChild(b); };
  tb('돌리기', () => opt.turn, (v) => { opt.turn = v; });
  tb('변형', () => opt.deform, (v) => { opt.deform = v; deformUniforms.uDeformGain.value = v ? 1 : 0; });
}
