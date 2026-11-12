// P3 화풍 확인용 갤러리: 생물 생성기 샘플을 물속 배경에서 나란히 돌려 본다(게임 본 화면과 별개).
// 주소 옵션
//   ?mode=lineup|crowd|all lineup = 해파리·흰동가리의 젤리풍·로우폴리풍을 나란히(기본) · crowd = 고른 화풍으로 여러 마리 + 떼
//                          all = P3 콘텐츠 전체 줄 세우기: 생물 8종(게임 크기, A 젤리풍) + 물건 18종(면 음영, 발자국 칸 표시)
//   ?v=jelly|lowpoly       crowd에서 쓸 화풍(기본 jelly). P1 임시 도형은 P3 콘텐츠에서 생성기로 바뀌어 없어졌다
//   ?sv=jelly|lowpoly      장식 떼 화풍(기본: crowd는 v를 따름, lineup은 jelly)
//   ?school=0              장식 물고기 떼 끄기
//   ?fog=1|0.5|0           물속 안개 세기(1 = 게임과 같은 흡수 계수, 기본 0.5, 0 = 끔).
//                          갤러리는 카메라가 물속에 있어 생물까지 약 10칸이 통째로 물길이라, 1이면 가까이 확대해 볼 때보다 붉은색이 많이 빠진다
//   ?view=front|jellies|fishes|high|below|crowd · all 모드: all|species|nature|made|theme|<종 id>|<물건 id>
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
import { SPECIES as GAME_SPECIES } from '../render/proto/species.js';
import { propGeometries } from '../render/proto/props.js';
import { SPECIES as SP_DATA, ITEMS, SIZES } from '../eco/atoll/data.js';
import * as moonjelly from '../eco/atoll/species/moonjelly.js';
import * as clownfish from '../eco/atoll/species/clownfish.js';
import * as chromis from '../eco/atoll/species/chromis.js';

const q = new URLSearchParams(location.search);
const opt = {
  capture: q.has('capture'),
  size: (q.get('size') || '1280x800').split('x').map(Number),
  mode: ['crowd', 'all'].includes(q.get('mode')) ? q.get('mode') : 'lineup',
  v: ['jelly', 'lowpoly'].includes(q.get('v')) ? q.get('v') : 'jelly',
  school: q.get('school') !== '0',
  fog: q.has('fog') ? Math.max(0, parseFloat(q.get('fog'))) : (q.get('mode') === 'all' ? 0.25 : 0.5),
  view: q.get('view') || ({ crowd: 'crowd', all: 'all' }[q.get('mode')] || 'front'),
  turn: q.get('turn') !== '0',
  deform: q.get('deform') !== '0',
};
opt.sv = ['jelly', 'lowpoly'].includes(q.get('sv')) ? q.get('sv') : (opt.mode === 'crowd' && opt.v === 'lowpoly' ? 'lowpoly' : 'jelly');
document.body.classList.toggle('capture', opt.capture);

// 게임 화면 크기(칸): data.js len × SIZES.draw. 갤러리 1단위 = 1칸
const bodyLen = (id) => (SP_DATA[id].len ?? 1) * (SIZES[SP_DATA[id].size]?.draw ?? 1);
const SIZE = Object.fromEntries(Object.keys(SP_DATA).map((id) => [id, bodyLen(id)]));
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

// 물건 재질: 게임(render/main.js)과 같은 면 음영 + 흔들림·발광 조각(aAux)
function propMaterial() {
  const pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, flatShading: true });
  pm.name = 'props';
  patchMaterial(pm, [{
    name: 'propSwayEmit', uniforms: deformUniforms,
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
  }], { slots: ['medium'], defines: { OW_CAUSTICS: true } });
  return pm;
}
const Q = (y) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), y);
const S = (s) => new THREE.Vector3(s, s, s);

// ---------- 전체 줄 세우기(mode=all) ----------
// 물건 18종: 1줄 자연물 8 · 2줄 인공물 8 · 3줄 테마 2. 물건마다 발자국 테두리(얇은 판)와 이름표.
// 높이 규칙(게임 propview.js와 같은 뜻): ground = 바닥, item = 수중 물건 높이(바닥 위 3칸), sea = 수면, z·up(수) = 수면 기준 높이.
// 테마 물건(맹그로브·데크)은 수심 3칸까지만 놓이므로 얕은 받침(수면 아래 2.4칸) 위에 세운다.
const ALL = { labels: [], views: {} };
const PROP_ROWS = [
  { key: 'nature', z: -1.5, ids: Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'nature' && !ITEMS[k].theme) },
  { key: 'made', z: -8.5, ids: Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'made' && !ITEMS[k].theme) },
  { key: 'theme', z: -15.5, ids: Object.keys(ITEMS).filter((k) => ITEMS[k].theme) },
];
function layoutAll(props, batch) {
  const _p = new THREE.Vector3(), M = new THREE.Matrix4();
  const footMat = new THREE.MeshBasicMaterial({ color: 0x1f8fb0, transparent: true, opacity: 0.35, depthWrite: false });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xe8dcb6, roughness: 0.95 });
  patchMaterial(plinthMat, [], { slots: ['medium'], defines: { OW_CAUSTICS: true } });
  for (const row of PROP_ROWS) {
    const widths = row.ids.map((id) => ITEMS[id].w);
    const total = widths.reduce((a, b) => a + b, 0) + 1.6 * (widths.length - 1);
    let x = -total / 2;
    row.ids.forEach((id) => {
      const it = ITEMS[id], cx = x + it.w / 2, cz = row.z;
      x += it.w + 1.6;
      const shallow = it.maxDepth != null;
      const ground = shallow ? SURFACE_Y - 2.4 : FLOOR_Y;
      if (shallow) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(it.w + 0.6, ground - FLOOR_Y, it.h + 0.6), plinthMat);
        pl.position.set(cx, (ground + FLOOR_Y) / 2, cz); scene.add(pl);
      }
      const foot = new THREE.Mesh(new THREE.PlaneGeometry(it.w, it.h).rotateX(-Math.PI / 2), footMat);
      foot.position.set(cx, ground + 0.03, cz); foot.renderOrder = 2; scene.add(foot);
      const itemY = ground + 3;
      let top = ground + 0.3;
      for (const [k, spec] of props.recipes[id].entries()) {
        const name = Array.isArray(spec.g) ? spec.g[k % spec.g.length] : spec.g;
        const px = cx + (spec.dx || 0), pz = cz - (spec.dy || 0);
        let y = spec.at === 'item' ? itemY : spec.at === 'sea' ? SURFACE_Y - 0.12 : ground;
        if (spec.z != null) y = SURFACE_Y + spec.z;
        const sc = spec.s ?? 1;
        let scale = S(sc);
        if (spec.up != null) {
          const top = spec.up === 'sea' ? SURFACE_Y - 0.2 : spec.up === 'item' ? itemY : SURFACE_Y + spec.up;
          scale = new THREE.Vector3(spec.w ?? 1, Math.max(0.05, top - ground), spec.w ?? 1); y = ground;
        }
        batch.add(props.index[name], _p.set(px, y, pz), Q(spec.yaw || 0), scale);
        const g = props.geometries[props.index[name]]; g.computeBoundingBox();
        top = Math.max(top, y + g.boundingBox.max.y * scale.y);
      }
      ALL.labels.push({ text: `${it.icon} ${it.name} ${it.w}×${it.h}`, pos: new THREE.Vector3(cx, ground - 0.1, cz + it.h / 2 + 0.4) });
      // 가까이 보기: 물건 높이·폭에 맞춘 거리, 25° 내려다봄
      const Hh = top - ground, d = Math.max(it.w * 1.25, Hh * 1.15) * 1.9 + 1.2, ty = ground + Hh * 0.42;
      ALL.views[id] = { pos: [cx + d * 0.42, ty + d * 0.42, cz + d * 0.8], target: [cx, ty, cz] };
    });
  }
  void M;
}

// 바닥 모래 + 물건(배경: 산호 몇 개, all 모드: 물건 18종)
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
  const batch = new PropBatch(propMaterial(), props.geometries, opt.mode === 'all' ? 400 : 24);
  if (opt.mode !== 'all') {
    for (const [n, x, z, y, s] of [['branchcoral.pink', -7.5, -4, 0.3, 1.0], ['branchcoral.purple', -2.2, -8.5, 1.1, 0.9], ['branchcoral.orange', 3.4, -7.2, 2.2, 1.0],
      ['branchcoral.pink', 7.8, -3.4, 0.5, 0.8], ['seagrass.a', -5.2, -6.5, 0, 1.0], ['seagrass.b', 6.2, -8, 0.7, 1.0], ['seagrass.c', 0.6, -10, 0.2, 1.0],
      ['boulder.a', -6, -12, 0.4, 0.6], ['boulder.b', 6, -13, 1.3, 0.7], ['giantclam.blue', -1.4, -4.5, 0.5, 0.7]]) {
      batch.add(props.index[n], new THREE.Vector3(x, FLOOR_Y, z), Q(y), S(s));
    }
  } else layoutAll(props, batch);
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
/** 화풍 하나의 메시 만들기: { sm(SpeciesMesh), tris, kit } */
function speciesMesh(spId, variant, count) {
  const kit = kitOf(spId === 'moonjelly' ? moonjelly : clownfish, variant);
  const sm = new SpeciesMesh(kit.geometry, kitMaterial(kit), count);
  sm.mesh.renderOrder = kit.material.renderOrder || 0;
  return { sm, tris: kit.info.triangles, kit };
}
/** 게임에 쓰는 종 모양(render/proto/species.js SPECIES = 생성기 A 젤리풍)으로 메시 만들기 */
function gameSpeciesMesh(def, count) {
  const kit = def.kit;
  const sm = new SpeciesMesh(def.build(), kitMaterial(kit), count);
  sm.mesh.renderOrder = kit.material.renderOrder || 0;
  return { sm, tris: kit.info.triangles, kit };
}
const VLABEL = { jelly: 'A 매끈한 젤리풍', lowpoly: 'B 그래픽 로우폴리풍' };
const SPNAME = Object.fromEntries(Object.entries(SP_DATA).map(([k, v]) => [k, v.name]));
const GROUNDED = new Set(['seacucumber', 'hermitcrab', 'anemone', 'octopus']);   // 원점이 바닥인 종

const samples = [];   // { spId, variant, sm, list:[{base, y, vy, kPrev, yaw, phase, speed, ...}], tris, label }
const _r = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
if (opt.mode === 'all') {
  // 생물 8종 한 줄(게임 크기 = data.js len × SIZES.draw). 바닥 종은 바닥에, 헤엄 종은 바닥 위에
  const ZS = 5;
  const lens = GAME_SPECIES.map((d) => SIZE[d.id]);
  const total = lens.reduce((x, y) => x + y, 0) + 1.2 * (lens.length - 1);
  let x = -total / 2;
  GAME_SPECIES.forEach((def, i) => {
    const L = lens[i], cx = x + L / 2; x += L + 1.2;
    const { sm, tris } = gameSpeciesMesh(def, 1);
    sm.mesh.name = def.id;
    sm.setPhase(0, i * 0.9); sm.setSpeed(0, 1); sm.setParams(0, 0, def.walk ? 1 : 0, 0, 0);
    const y = GROUNDED.has(def.id) ? FLOOR_Y + 0.02 : FLOOR_Y + (def.id === 'moonjelly' ? 1.0 : 0.25) * L + 0.6;
    const base = new THREE.Vector3(cx, y, ZS);
    scene.add(sm.mesh); groups[def.id] = sm.mesh;
    samples.push({ spId: def.id, variant: 'jelly', sm, tris, label: `${SP_DATA[def.id].icon} ${SPNAME[def.id]}`, all: true, list: [{ base, y, vy: 0, kPrev: 0, yaw: 0, phase: i * 0.9, speed: 1 }] });
    ALL.labels.push({ text: `${SP_DATA[def.id].icon} ${SPNAME[def.id]}`, pos: new THREE.Vector3(cx, FLOOR_Y - 0.1, ZS + 0.9) });
    const d = L * 2.1 + 0.9, ty = y + L * (GROUNDED.has(def.id) ? 0.2 : 0.05);
    ALL.views[def.id] = { pos: [cx + d * 0.45, ty + d * 0.38, ZS + d * 0.8], target: [cx, ty, ZS] };
  });
} else if (opt.mode === 'lineup') {
  const cols = { jelly: -1.7, lowpoly: 1.7 };
  for (const spId of ['moonjelly', 'clownfish']) {
    for (const variant of ['jelly', 'lowpoly']) {
      const { sm, tris } = speciesMesh(spId, variant, 1);
      sm.mesh.name = `${spId}-${variant}`;
      const base = new THREE.Vector3(cols[variant], spId === 'moonjelly' ? 1.45 : -0.75, 0);
      sm.setPhase(0, 0); sm.setSpeed(0, 1); sm.setParams(0, 0, 0, 0, 0);
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
if (opt.school && opt.mode !== 'all') {
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
  all: { pos: [0, 20, 40], target: [0, -1.5, -6] },
  species: { pos: [0, 2.5, 33], target: [0, -1.4, 5] },
  nature: { pos: [0, 12, 34], target: [0, -1.2, -1.5] },
  made: { pos: [0, 13, 27], target: [0, -1.2, -8.5] },
  theme: { pos: [0, 10.5, -2], target: [0, 3, -15.5] },
};
Object.assign(VIEWS, ALL.views);
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
      if (s.all) {
        // 줄 세우기: 제자리에서 천천히 돌며(돌리기 켬) 변형만 보여 줌. 해파리는 박동에 맞춰 살짝 오르내림
        let y = c.base.y;
        if (isJ) { const k = moonjelly.pulse(t, c.speed, c.phase); c.vy += Math.max(0, k - c.kPrev) * 0.4; c.kPrev = k; c.vy += (c.base.y - c.y) * 0.8 * dt; c.vy *= Math.exp(-1.8 * dt); c.y += c.vy * dt; y = c.y; }
        P.set(c.base.x, y, c.base.z);
        E.set(0, fixedYaw ?? (opt.turn ? 0.6 + t * 0.3 : 0.6), 0);
      } else if (isJ) {
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
  if (labels && opt.mode === 'all') {
    g.font = `600 ${Math.round(H * 0.02)}px system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif`;
    for (const l of ALL.labels) { const v = l.pos.clone().project(camera); if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) tag(l.text, (v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H); }
  }
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
/** 가까이 보기 여러 장을 격자로 이은 그림(all 모드): ids = 종·물건 id 목록 */
function sheet(ids, { cols = 4, title = '' } = {}) {
  const W = canvas.width, H = canvas.height, cw = Math.round(W / cols), ch = Math.round(H / cols);
  const rows = Math.ceil(ids.length / cols), head = title ? Math.round(ch * 0.16) : 0;
  const c2 = document.createElement('canvas'); c2.width = cw * cols; c2.height = ch * rows + head;
  const g = c2.getContext('2d');
  g.fillStyle = '#0d2a38'; g.fillRect(0, 0, c2.width, c2.height);
  const before = opt.view;
  ids.forEach((id, i) => {
    setView(id); render();
    const x = (i % cols) * cw, y = head + Math.floor(i / cols) * ch;
    g.drawImage(canvas, 0, 0, W, H, x + 2, y + 2, cw - 4, ch - 4);
    const name = ITEMS[id] ? `${ITEMS[id].icon} ${ITEMS[id].name} ${ITEMS[id].w}×${ITEMS[id].h}` : `${SP_DATA[id].icon} ${SP_DATA[id].name}`;
    g.font = `600 ${Math.round(ch * 0.075)}px system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif`;
    const tw = g.measureText(name).width + 16;
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.roundRect(x + 8, y + 8, tw, ch * 0.11, 6); g.fill();
    g.fillStyle = '#1d3340'; g.fillText(name, x + 16, y + 8 + ch * 0.082);
  });
  if (title) { g.fillStyle = '#fff'; g.font = `700 ${Math.round(head * 0.55)}px system-ui, sans-serif`; g.fillText(title, 14, head * 0.7); }
  setView(before); render();
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
  dump: stats, breakdown, shot, strip, sheet, save,
  ids: () => ({ species: GAME_SPECIES.map((d) => d.id), props: PROP_ROWS.flatMap((r) => r.ids) }),
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
    a(opt.mode === 'crowd' && opt.v === 'lowpoly', link({ mode: 'crowd', v: 'lowpoly', view: null, sv: null }), '무리: B 로우폴리풍') +
    a(opt.mode === 'all', link({ mode: 'all', v: null, view: null, sv: null, fog: null }), '전체 줄 세우기(P3)'));
  row('떼', a(opt.school && opt.sv === 'jelly', link({ school: null, sv: 'jelly' }), 'A') + a(opt.school && opt.sv === 'lowpoly', link({ school: null, sv: 'lowpoly' }), 'B') + a(!opt.school, link({ school: '0' }), '끔'));
  row('물빛', a(opt.fog === 1, link({ fog: '1' }), '게임 계수 그대로') + a(opt.fog === 0.5, link({ fog: null }), '절반(기본)') + a(opt.fog === 0, link({ fog: '0' }), '끔'));
  const vr = row('시점', '');
  const viewList = opt.mode === 'all' ? [['all', '전체'], ['species', '생물 8종'], ['nature', '자연물'], ['made', '인공물'], ['theme', '테마']]
    : [['front', '정면'], ['jellies', '해파리'], ['fishes', '물고기'], ['high', '위'], ['below', '아래'], ['crowd', '멀리']];
  for (const [k, label] of viewList) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => setView(k); vr.appendChild(b);
  }
  const tr = row('움직임', '');
  const tb = (label, get, set) => { const b = document.createElement('button'); const upd = () => { b.textContent = `${label} ${get() ? '켬' : '끔'}`; }; b.onclick = () => { set(!get()); upd(); }; upd(); tr.appendChild(b); };
  tb('돌리기', () => opt.turn, (v) => { opt.turn = v; });
  tb('변형', () => opt.deform, (v) => { opt.deform = v; deformUniforms.uDeformGain.value = v ? 1 : 0; });
}
