// 시제품용 생물 8종: 코드로 만든 단순한 몸 + 종별 변형 조각 + 기본 개체 수(합 44).
// 이 파일은 P1 확인용이다. P3에서 eco/atoll/species/ 생성기로 옮긴다(PLAN 3절).
// 몸 규칙: 앞 = +Z, 위 = +Y, 원점 = 바닥에 닿는 점(기는·걷는·붙은 생물) 또는 몸 중심(헤엄치는 생물). 크기 1로 정규화.
import * as THREE from 'three';
import { part, merge, tube, hex, mix, rng } from './geo.js';
import { DEF_COMMON, BEND, PERISTALSIS, GAIT, SQUASH, RIM } from '../core/deform.js';
import { FISH, JELLY, RAY, TURTLE, OCTOPUS } from '../aqua/swim.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function cucumber() {
  const g = new THREE.CapsuleGeometry(0.14, 0.72, 6, 12);
  g.rotateX(Math.PI / 2);
  g.scale(1, 0.8, 1);
  g.translate(0, 0.11, 0);
  const r = rng(5);
  const spots = Array.from({ length: 14 }, () => V((r() - 0.5) * 0.2, 0.2, (r() - 0.5) * 0.9));
  return merge([part(g, (p) => {
    let c = mix(0x5b2f2a, 0x8a4a33, (p.y - 0.02) * 4);
    for (const s of spots) if (p.distanceTo(s) < 0.06) c = hex(0xe0b080);
    if (p.y < 0.05) c = hex(0xc49a7a);
    return c;
  }, (p) => [0.5 - p.z, 1, 0, 0])]);
}

function crab() {
  const parts = [];
  // 소라 껍데기(나선 느낌: 원뿔 + 줄무늬)
  const shell = new THREE.ConeGeometry(0.2, 0.46, 14, 6);
  shell.rotateX(-Math.PI / 2 - 0.5);
  shell.translate(0, 0.24, -0.12);
  parts.push(part(shell, (p) => mix(0xf0dcc0, 0xb7744a, 0.5 + 0.5 * Math.sin(p.z * 40 + Math.atan2(p.x, p.y - 0.24) * 2)), [0, 0, 0, 0]));
  const body = new THREE.SphereGeometry(0.11, 12, 8); body.scale(1.2, 0.8, 1); body.translate(0, 0.14, 0.12);
  parts.push(part(body, 0xd2553a, [0, 0, 0, 0]));
  for (const sx of [-1, 1]) {
    const claw = new THREE.SphereGeometry(0.06, 8, 6); claw.scale(1, 0.8, 1.3); claw.translate(sx * 0.09, 0.1, 0.25);
    parts.push(part(claw, 0xe06a44, [0, 0, 0, 0]));
    for (let k = 0; k < 3; k++) {
      const z = 0.16 - k * 0.07;
      const hip = V(sx * 0.1, 0.14, z), knee = V(sx * 0.22, 0.12, z + 0.02), foot = V(sx * 0.27, 0.0, z + 0.03);
      const idx = (k + (sx > 0 ? 1 : 0)) % 2;
      parts.push(part(tube(hip, knee, 0.018, 0.015, 5), 0xc9502f, (p) => [Math.min(1, p.distanceTo(hip) / 0.3), 1, 1, idx]));
      parts.push(part(tube(knee, foot, 0.015, 0.01, 5), 0xc9502f, (p) => [Math.min(1, 0.4 + p.distanceTo(knee) / 0.2), 1, 1, idx]));
    }
  }
  for (const sx of [-1, 1]) { const e = new THREE.SphereGeometry(0.022, 6, 4); e.translate(sx * 0.04, 0.24, 0.2); parts.push(part(e, 0x111111, [0, 0, 0, 0])); }
  return merge(parts);
}

function anemone() {
  const parts = [];
  const col = new THREE.CylinderGeometry(0.2, 0.24, 0.16, 18, 2); col.translate(0, 0.08, 0);
  parts.push(part(col, 0xb2456e, [0, 0, 0, 0]));
  const disc = new THREE.CylinderGeometry(0.22, 0.2, 0.03, 18); disc.translate(0, 0.17, 0);
  parts.push(part(disc, 0xd98aa8, [0, 0, 0, 0]));
  const r = rng(11);
  let n = 0;
  for (const [ring, cnt, len] of [[0.08, 8, 0.28], [0.14, 13, 0.34], [0.2, 19, 0.36]]) {
    for (let i = 0; i < cnt; i++, n++) {
      const a = (i / cnt) * Math.PI * 2 + ring * 10;
      const base = V(Math.cos(a) * ring, 0.17, Math.sin(a) * ring);
      const out = V(Math.cos(a), 0, Math.sin(a));
      const tip = base.clone().addScaledVector(out, len * (0.35 + r() * 0.3)).add(V(0, len * (0.8 + r() * 0.25), 0));
      const t = tube(base, tip, 0.028, 0.012, 5, 4);
      const L = tip.distanceTo(base);
      parts.push(part(t, (p) => mix(0x9c6ad6, 0xffb0d8, p.distanceTo(base) / L), (p) => [p.distanceTo(base) / L, 1, 1, n]));
    }
  }
  return merge(parts);
}

function clownfish() {
  const parts = [];
  const body = new THREE.SphereGeometry(0.5, 20, 14); body.scale(0.3, 0.42, 0.62); body.translate(0, 0, 0.08);
  const band = (z) => {
    for (const bz of [0.36, 0.08, -0.22]) {
      const d = Math.abs(z - bz);
      if (d < 0.045) return hex(0xffffff);
      if (d < 0.065) return hex(0x1a1a1a);
    }
    return null;
  };
  parts.push(part(body, (p) => band(p.z) || mix(0xff6a10, 0xffa040, 0.5 + p.y), (p) => [Math.min(1, Math.max(0, (0.45 - p.z) / 1.0)), 1, 0, 0]));
  const tail = new THREE.SphereGeometry(0.5, 12, 8); tail.scale(0.03, 0.26, 0.17); tail.translate(0, 0, -0.42);
  parts.push(part(tail, (p) => (p.z < -0.52 ? hex(0x1a1a1a) : hex(0xff7a20)), (p) => [Math.min(1, (0.45 - p.z) / 1.0), 1, 0, 0]));
  const dorsal = new THREE.SphereGeometry(0.5, 12, 8); dorsal.scale(0.025, 0.12, 0.3); dorsal.translate(0, 0.2, 0.02);
  parts.push(part(dorsal, 0xff7a20, (p) => [Math.min(1, (0.45 - p.z) / 1.0), 1, 0, 0]));
  for (const sx of [-1, 1]) {
    const e = new THREE.SphereGeometry(0.04, 8, 6); e.translate(sx * 0.12, 0.06, 0.42);
    parts.push(part(e, 0x101010, [0.05, 1, 0, 0]));
  }
  return merge(parts);
}

function octopus() {
  const parts = [];
  const mantle = new THREE.SphereGeometry(0.2, 18, 12); mantle.scale(1, 1.3, 1.15); mantle.translate(0, 0.3, -0.04);
  parts.push(part(mantle, (p) => mix(0xa8452f, 0xd8754e, (p.y - 0.1) * 2), [0, 0, 0, 0]));
  for (const sx of [-1, 1]) { const e = new THREE.SphereGeometry(0.035, 8, 6); e.translate(sx * 0.12, 0.2, 0.12); parts.push(part(e, 0xf3e3a0, [0, 0, 0, 0])); }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const dir = V(Math.sin(a), 0, Math.cos(a));
    const pts = [];
    for (let k = 0; k <= 6; k++) { const s = k / 6; pts.push(V(0, 0.12 - s * 0.08, 0).addScaledVector(dir, 0.06 + s * 0.42).add(V(0, -Math.sin(s * 2.2) * 0.07, 0))); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 14, 0.04, 6, false);
    // 끝으로 갈수록 가늘게
    const P = g.attributes.position;
    for (let v = 0; v < P.count; v++) {
      const ring = Math.floor(v / 7), s = ring / 14;
      const c = curve.getPointAt(Math.min(1, s));
      _t.fromBufferAttribute(P, v).sub(c).multiplyScalar(1 - 0.78 * s).add(c);
      P.setXYZ(v, _t.x, _t.y, _t.z);
    }
    g.computeVertexNormals();
    parts.push(part(g, (p) => (p.y < 0.03 ? hex(0xf2c0a0) : hex(0xb5513a)), (p) => [Math.min(1, Math.hypot(p.x, p.z) / 0.48), 1, 1, i]));
  }
  return merge(parts);
}
const _t = new THREE.Vector3();

function moonjelly() {
  const parts = [];
  const prof = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(Math.sin(t * Math.PI / 2) * 0.5, Math.cos(t * Math.PI / 2) * 0.3 * (1 - 0.15 * t))); }
  const bell = new THREE.LatheGeometry(prof, 28);
  parts.push(part(bell, (p) => {
    const r = Math.hypot(p.x, p.z), a = Math.atan2(p.z, p.x);
    const gon = r > 0.1 && r < 0.24 && Math.cos(4 * a) > 0.55;
    return gon ? hex(0xff8fc8) : mix(0xe8f4ff, 0xbfe2ff, r * 2);
  }, (p) => [0, Math.min(1, Math.hypot(p.x, p.z) / 0.5), 0, 0]));
  const r = rng(21);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const base = V(Math.cos(a) * 0.48, 0.01, Math.sin(a) * 0.48);
    const tip = base.clone().add(V((r() - 0.5) * 0.05, -0.4 - r() * 0.2, (r() - 0.5) * 0.05));
    const L = tip.distanceTo(base);
    parts.push(part(tube(base, tip, 0.008, 0.004, 3, 6), 0xf6e8ff, (p) => [p.distanceTo(base) / L, 1, 2, i]));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const base = V(Math.cos(a) * 0.04, 0.04, Math.sin(a) * 0.04);
    const tip = V(Math.cos(a) * 0.12, -0.5, Math.sin(a) * 0.12);
    const L = tip.distanceTo(base);
    parts.push(part(tube(base, tip, 0.035, 0.012, 6, 8), 0xffd0ec, (p) => [p.distanceTo(base) / L, 1, 3, i + 30]));
  }
  return merge(parts);
}

function turtle() {
  const parts = [];
  const shell = new THREE.SphereGeometry(0.5, 24, 14); shell.scale(0.74, 0.3, 1.0); shell.translate(0, 0.02, 0);
  const P = shell.attributes.position;
  for (let i = 0; i < P.count; i++) { if (P.getY(i) < 0) P.setY(i, P.getY(i) * 0.35); }
  shell.computeVertexNormals();
  parts.push(part(shell, (p) => {
    if (p.y < 0.0) return hex(0xe8d6a0);
    const cell = Math.abs(Math.sin(p.x * 16) * Math.sin(p.z * 13));
    return mix(0x5a6b2e, 0x8a7a3a, cell);
  }, [0, 0, 0, 0]));
  const head = new THREE.SphereGeometry(0.1, 12, 8); head.scale(1, 0.85, 1.25); head.translate(0, 0.03, 0.56);
  parts.push(part(head, 0x7a8a58, [0, 1, 0, 0]));
  for (const sx of [-1, 1]) {
    const f = new THREE.SphereGeometry(0.5, 12, 6); f.scale(0.34, 0.035, 0.11); f.rotateY(sx * 0.5); f.translate(sx * 0.4, 0, 0.12);
    parts.push(part(f, 0x6f7f4c, (p) => [Math.abs(p.x) / 0.56, 1, 1, sx]));
    const r2 = new THREE.SphereGeometry(0.5, 10, 6); r2.scale(0.16, 0.03, 0.08); r2.rotateY(-sx * 0.6); r2.translate(sx * 0.25, -0.02, -0.38);
    parts.push(part(r2, 0x6f7f4c, (p) => [Math.abs(p.x) / 0.32, 1, 2, sx]));
  }
  return merge(parts);
}

function manta() {
  const parts = [];
  const nu = 28, nv = 10;
  for (const sheet of [1, -1]) {
    const pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1, v = j / nv, au = Math.abs(u);
      const zF = 0.2 - 0.26 * au, zB = -0.2 + 0.16 * Math.pow(au, 0.7);
      const z = zB + (zF - zB) * v;
      const t = 0.07 * Math.pow(1 - au, 1.4) * Math.sin(Math.PI * v);
      pos.push(u * 0.5, sheet > 0 ? t : -t * 0.55, z);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (sheet > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    parts.push(part(g, (p) => (sheet > 0 ? mix(0x1f2a3a, 0x3a4a5e, Math.abs(p.x) < 0.12 && p.z > 0 ? 0.9 : 0.1) : hex(0xeef2f4)),
      (p) => [Math.min(1, Math.abs(p.x) / 0.5), 0, 0, Math.sign(p.x) || 1]));
  }
  for (const sx of [-1, 1]) {
    const c = new THREE.BoxGeometry(0.035, 0.02, 0.12); c.rotateY(sx * 0.25); c.translate(sx * 0.075, 0, 0.23);
    parts.push(part(c, 0x1f2a3a, [0.15, 0, 0, sx]));
  }
  const tail = tube(V(0, 0, -0.18), V(0, 0, -0.62), 0.016, 0.004, 4, 6);
  parts.push(part(tail, 0x1f2a3a, (p) => [0, Math.min(1, (-0.18 - p.z) / 0.44), 2, 0]));
  return merge(parts);
}

/**
 * 크기 등급별 화면 배율(게임적 허용, 대니님 방향 2026-11-11: "작은 건 조금 커지게, 큰 건 조금 작게").
 * L(아래 표)에 곱한다. 등급 순서 S < M < L < XL은 유지된다. 주소 옵션 ?sizes=1.35,1.1,0.95,0.85 로 바꿔 볼 수 있다(?sizes=1 = 끔).
 * P2에서는 규칙 세션의 생태계 데이터(eco/atoll/data.js)에 같은 값이 들어가므로 그 값을 읽도록 바꾸면 된다.
 */
export const SIZE_SCALE = { S: 1.35, M: 1.1, L: 0.95, XL: 0.85 };
/** '1.35,1.1,0.95,0.85' 또는 '1' → { S, M, L, XL } */
export function parseSizeScale(str) {
  if (!str) return { ...SIZE_SCALE };
  const v = str.split(',').map(Number).filter((n) => n > 0);
  if (v.length === 1) return { S: v[0], M: v[0], L: v[0], XL: v[0] };
  const [S = 1, M = 1, L = 1, XL = 1] = v;
  return { S, M, L, XL };
}

/**
 * 종 목록. L: 게임 크기(칸, DESIGN 12.2절 가안), count: 기본 개체 수(합 44), life: 화면 확인용 임시 움직임 종류.
 * patches: 변형 조각. mat: 재질 옵션.
 */
export const SPECIES = [
  { id: 'seacucumber', name: '해삼', size: 'S', L: 1.0, count: 5, life: 'crawl', build: cucumber, patches: [PERISTALSIS], speed: 0.55 },
  { id: 'hermitcrab', name: '소라게', size: 'S', L: 0.75, count: 6, life: 'walk', build: crab, patches: [GAIT], speed: 1.15 },
  { id: 'anemone', name: '말미잘', size: 'M', L: 2.0, count: 5, life: 'fixed', build: anemone, patches: [BEND], speed: 0 },
  { id: 'clownfish', name: '몰디브흰동가리', size: 'S', L: 0.75, count: 10, life: 'swim', build: clownfish, patches: [FISH], speed: 1.9 },
  { id: 'octopus', name: '문어', size: 'M', L: 2.0, count: 4, life: 'swim', build: octopus, patches: [OCTOPUS], speed: 1.0 },
  { id: 'moonjelly', name: '보름달물해파리', size: 'M', L: 1.5, count: 7, life: 'drift', build: moonjelly, patches: [JELLY], speed: 0.36,
    mat: { transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide, roughness: 0.15 }, jellyAlpha: true },
  { id: 'turtle', name: '푸른바다거북', size: 'L', L: 2.5, count: 4, life: 'swim', build: turtle, patches: [TURTLE], speed: 1.45 },
  { id: 'manta', name: '쥐가오리', size: 'XL', L: 4.0, count: 3, life: 'swim', build: manta, patches: [RAY], speed: 1.75, mat: { side: THREE.DoubleSide } },
];

/** 반투명 해파리: 가장자리는 진하고 가운데는 비치는 프레넬 불투명도 */
const JELLY_ALPHA = {
  name: 'jellyAlpha',
  fragmentOutput: /* glsl */`
{
  vec3 vv = normalize(vViewPosition);
  float f = pow(1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0), 2.0);
  gl_FragColor.a = clamp(opacity * (0.35 + 0.9 * f), 0.0, 0.95);
}`,
};

/** 종별 재질 생성(patchMaterial은 부르는 쪽에서) */
export function speciesMaterial(sp) {
  const m = new THREE.MeshPhysicalMaterial(Object.assign({
    vertexColors: true, roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.0,
  }, sp.mat || {}));
  m.name = 'sp-' + sp.id;
  const patches = [DEF_COMMON, SQUASH, ...sp.patches, RIM];
  if (sp.jellyAlpha) patches.push(JELLY_ALPHA);
  return { material: m, patches };
}

/** ?n= 개체 수에 맞춰 종별 수를 비율대로 나눈다(최소 1). */
export function scaleCounts(total) {
  const base = SPECIES.reduce((s, sp) => s + sp.count, 0);
  if (total === base) return SPECIES.map((sp) => sp.count);
  const raw = SPECIES.map((sp) => (sp.count * total) / base);
  const out = raw.map((r) => Math.max(total > 0 ? 1 : 0, Math.floor(r)));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  while (out.reduce((a, b) => a + b, 0) > total) { const i = out.indexOf(Math.max(...out)); out[i]--; }
  return out;
}
