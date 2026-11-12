// 몰디브흰동가리(Amphiprion nigripes) 생성기 — P3 화풍 샘플(열대 물고기 1종).
// 모양만 만든다. 크기·속도·개체 수는 받지 않는다(정본은 eco/atoll/data.js, 배치하는 쪽이 곱한다).
//
// 몸 규칙: 몸길이 1(주둥이 z ≈ +0.46, 꼬리지느러미 끝 z ≈ −0.49), 원점 = 몸 중심, 앞 +Z, 위 +Y.
// aDef: _kit.js fishSwimPatch 설명과 같음(x = s 주둥이 0 → 꼬리 끝 1, y = 지느러미 마스크, z = 부위, w = 좌우)
// 실제 종과 맞춘 것: 둥근 달걀형 몸, 눈 바로 뒤의 흰 머리 띠 하나(가는 검은 테두리), 주황 몸·지느러미,
//   검은 배지느러미·뒷지느러미(종 이름 nigripes = 검은 발), 둥근 꼬리지느러미, 쉬지 않고 젓는 가슴지느러미.
// 게임적 허용: 눈을 조금 크게(작은 화면에서 표정이 읽히게), 머리 띠를 조금 넓게, 지느러미를 조금 크게.
import { grid, paint, facet, merge, curve1, smooth, triCount, shadePatch, fishSwimPatch } from './_kit.js';

export const id = 'clownfish';
export const variants = { jelly: '매끈한 젤리풍', lowpoly: '그래픽 로우폴리풍' };

const Z0 = 0.46, ZL = 0.8;                     // 몸통: u = 0(주둥이) → 1(꼬리자루 끝)
const zAt = (u) => Z0 - ZL * u;
const sAt = (z) => Math.min(1, Math.max(0, 0.5 - z));
const H = curve1([[0, 0], [0.025, 0.07], [0.07, 0.125], [0.15, 0.17], [0.28, 0.2], [0.42, 0.205], [0.56, 0.19], [0.7, 0.155], [0.82, 0.105], [0.9, 0.072], [0.955, 0.06], [1, 0]]);
const R = curve1([[0, 0.95], [0.1, 0.66], [0.3, 0.5], [0.6, 0.42], [0.85, 0.34], [1, 0.34]]);
const yc = (u) => 0.012 * Math.sin(Math.PI * u);
const hAt = (u) => Math.max(0, H(u));

function bodyPoint(u, th, o) {
  const h = hAt(u), w = h * R(u), t = th * Math.PI * 2, sn = Math.sin(t);
  o.set(w * Math.cos(t), yc(u) + h * sn * (sn < 0 ? 0.96 : 1), zAt(u));
}
const uOf = (z) => (Z0 - z) / ZL;
const PEC = [0.075, -0.035, 0.24];   // 가슴지느러미 뿌리(+x쪽). 변형 조각의 회전 중심과 같아야 한다
const DEFORM = fishSwimPatch('af-swim', { freq: 7.5, amp: 0.14, wave: 4.5, yaw: 0.06, pecPivot: PEC, pecAmp: 0.55, pecFreq: 9.0 });

// 등지느러미 높이: 앞쪽 가시 부분(작은 톱니) → 홈 → 뒤쪽 둥근 부분
function dorsalH(t) {
  if (t < 0.42) return (0.058 + 0.014 * Math.abs(Math.sin(t * Math.PI * 10))) * smooth(0, 0.1, t);
  if (t < 0.48) return 0.05;
  return 0.045 + 0.08 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.45) / 0.55)), 0.8);
}

// ---------- 매끈한 젤리풍 ----------
function buildJelly(THREE, detail) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const ORANGE = C(0xff8a1c), TOP = C(0xee620a), BELLY = C(0xffb84a), WHITE = C(0xfdfaf2), INK = C(0x241612), BLACK = C(0x1a1311);
  const parts = [];
  // 몸통
  const body = grid(THREE, Math.round(28 * detail), Math.round(44 * detail), (th, u, o) => bodyPoint(u, th, o), { wrapU: true });
  parts.push(paint(THREE, body, {
    color: (p) => {
      const u = uOf(p.z), h = Math.max(1e-3, hAt(u)), yn = (p.y - yc(u)) / h;
      const ub = 0.25 - 0.022 * yn * yn, d = Math.abs(u - ub);
      if (d < 0.04) return WHITE;
      if (d < 0.054) return INK;
      const c = yn > 0 ? ORANGE.clone().lerp(TOP, yn * 0.8) : ORANGE.clone().lerp(BELLY, -yn * 0.9);
      if (u < 0.035) c.lerp(TOP, 0.3);
      return c;
    },
    def: (p) => [sAt(p.z), 0, 0, 0],
  }));
  // 눈(크게, 검은 눈동자 + 금빛 테 + 반짝임)
  for (const sx of [-1, 1]) {
    const ctr = V(sx * 0.074, 0.05, 0.37), out = V(sx, 0.06, 0.28).normalize();
    const e = new THREE.SphereGeometry(0.047, 14, 10); e.translate(ctr.x, ctr.y, ctr.z);
    parts.push(paint(THREE, e, {
      color: (p) => { const d = p.clone().sub(ctr).normalize().dot(out); return d > 0.62 ? C(0x0c0a0a) : d > 0.4 ? C(0xffb21e) : C(0xe8742a); },
      def: [sAt(0.37), 0, 4, 0], mat: [1, 0.02],
    }));
    const hl = new THREE.SphereGeometry(0.011, 6, 4);
    const hp = ctr.clone().addScaledVector(V(sx, 0.7, 0.55).normalize(), 0.044); hl.translate(hp.x, hp.y, hp.z);
    parts.push(paint(THREE, hl, { color: 0xffffff, def: [sAt(0.37), 0, 4, 0], mat: [1, 0.9] }));
  }
  // 등지느러미
  parts.push(paint(THREE, grid(THREE, Math.round(30 * detail), 3, (t, v, o) => {
    const u = 0.2 + 0.66 * t, z = zAt(u);
    o.set(0, yc(u) + hAt(u) * 0.95 + dorsalH(t) * v, z - 0.035 * v * v);
  }), { color: (p) => ORANGE.clone().lerp(C(0xffc070), smooth(0.6, 1, (p.y - 0.15) / 0.12)), def: (p) => [sAt(p.z), Math.min(1, Math.max(0, (p.y - 0.17) / 0.1)), 1, 0] }));
  // 뒷지느러미(검정, 뿌리 줄만 주황 섞임)
  const nA = Math.round(14 * detail);
  parts.push(paint(THREE, grid(THREE, nA, 3, (t, v, o) => {
    const u = 0.6 + 0.28 * t, z = zAt(u), fh = 0.03 + 0.07 * Math.pow(Math.sin(Math.PI * t), 0.7);
    o.set(0, yc(u) - hAt(u) * 0.94 - fh * v, z - 0.03 * v);
  }, { vs: [0, 0.2, 0.6, 1] }), {
    color: (p, i) => (i <= nA ? ORANGE.clone().lerp(BLACK, 0.6) : BLACK),
    def: (p, i) => [sAt(p.z), [0, 0.2, 0.6, 1][Math.floor(i / (nA + 1))], 1, 0],
  }));
  // 꼬리지느러미(둥근 부채)
  parts.push(paint(THREE, grid(THREE, Math.round(16 * detail), 3, (t, v, o) => {
    const ph = (t * 2 - 1) * 0.9;
    const root = V(0, 0.055 * ph / 0.9, -0.32), edge = V(0, 0.2 * Math.sin(ph), -0.335 - 0.16 * Math.cos(ph));
    o.copy(root).lerp(edge, v);
  }), { color: (p) => ORANGE.clone().lerp(C(0xffc878), smooth(0.43, 0.49, -p.z) * 0.8), def: (p) => [sAt(p.z), Math.min(1, Math.max(0, (-0.32 - p.z) / 0.17)), 1, 0] }));
  // 가슴지느러미(좌우)
  for (const sx of [-1, 1]) {
    const root = V(sx * PEC[0], PEC[1], PEC[2]), back = V(sx * 0.5, -0.12, -1).normalize();
    parts.push(paint(THREE, grid(THREE, 10, 2, (t, v, o) => {
      const ph = t * 2 - 1;
      const a = root.clone().add(V(0, 0.02 * ph, 0));
      const e = root.clone().addScaledVector(back, 0.13 * (0.72 + 0.28 * Math.cos(ph * 1.3))).add(V(0, 0.065 * Math.sin(ph * 1.15), 0));
      o.copy(a).lerp(e, v);
    }), { color: (p) => C(0xffa848).lerp(C(0xffd090), smooth(0.06, 0.12, p.distanceTo(root))), def: (p) => [sAt(p.z), Math.min(1, p.distanceTo(root) / 0.13), 2, sx] }));
  }
  // 배지느러미(좌우, 검정)
  for (const sx of [-1, 1]) {
    const u = 0.34, root = V(sx * 0.03, yc(u) - hAt(u) * 0.9, zAt(u));
    parts.push(paint(THREE, grid(THREE, 6, 2, (t, v, o) => {
      const ph = t * 2 - 1;
      const a = root.clone().add(V(0, 0, 0.022 * ph));
      const e = root.clone().add(V(sx * 0.03, -0.05 + 0.015 * ph * ph, -0.07 + 0.025 * ph));
      o.copy(a).lerp(e, v);
    }), { color: BLACK, def: (p) => [sAt(p.z), Math.min(1, p.distanceTo(root) / 0.1), 3, sx] }));
  }
  return merge(THREE, parts);
}

// ---------- 그래픽 로우폴리풍 ----------
function buildLowpoly(THREE) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const parts = [];
  const vs = [0, 0.05, 0.12, 0.195, 0.21, 0.29, 0.305, 0.44, 0.6, 0.76, 0.9, 1];
  const body = grid(THREE, 8, vs.length - 1, (th, u, o) => bodyPoint(u, th, o), { wrapU: true, vs });
  parts.push(facet(THREE, body, {
    faceColor: (c, n) => {
      const u = uOf(c.z);
      if ((u > 0.195 && u < 0.21) || (u > 0.29 && u < 0.305)) return C(0x1a1210);
      if (u > 0.21 && u < 0.29) return C(0xffffff);
      return n.y > 0.35 ? C(0xff6400) : n.y < -0.35 ? C(0xffa424) : C(0xff820e);
    },
    def: (p) => [sAt(p.z), 0, 0, 0],
  }));
  for (const sx of [-1, 1]) {
    const ctr = V(sx * 0.075, 0.05, 0.37);
    const e = new THREE.OctahedronGeometry(0.05, 0); e.rotateY(Math.PI / 4); e.translate(ctr.x, ctr.y, ctr.z);
    parts.push(facet(THREE, e, { faceColor: () => C(0x0e0b0b), def: [sAt(0.37), 0, 4, 0], mat: [1, 0.02] }));
    const hl = new THREE.TetrahedronGeometry(0.014, 0); hl.translate(ctr.x + sx * 0.036, ctr.y + 0.024, ctr.z + 0.02);
    parts.push(facet(THREE, hl, { faceColor: () => C(0xffffff), def: [sAt(0.37), 0, 4, 0], mat: [1, 0.9] }));
  }
  const dH = [0.02, 0.078, 0.05, 0.078, 0.045, 0.12, 0.035];
  parts.push(facet(THREE, grid(THREE, 6, 1, (t, v, o) => {
    const u = 0.2 + 0.66 * t;
    o.set(0, yc(u) + hAt(u) * 0.95 + dH[Math.round(t * 6)] * v, zAt(u) - 0.04 * v);
  }), { faceColor: (c, n, f) => (f % 2 ? C(0xff7a10) : C(0xff9a30)), def: (p) => [sAt(p.z), Math.min(1, Math.max(0, (p.y - 0.17) / 0.1)), 1, 0] }));
  const aH = [0.02, 0.095, 0.075, 0.02];
  parts.push(facet(THREE, grid(THREE, 3, 1, (t, v, o) => {
    const u = 0.6 + 0.28 * t;
    o.set(0, yc(u) - hAt(u) * 0.94 - aH[Math.round(t * 3)] * v, zAt(u) - 0.03 * v);
  }), { faceColor: () => C(0x16100e), def: (p) => [sAt(p.z), Math.min(1, Math.max(0, (-0.17 - p.y) / 0.1)), 1, 0] }));
  parts.push(facet(THREE, grid(THREE, 4, 1, (t, v, o) => {
    const ph = (t * 2 - 1) * 0.9;
    o.copy(V(0, 0.055 * ph / 0.9, -0.32)).lerp(V(0, 0.2 * Math.sin(ph), -0.335 - 0.16 * Math.cos(ph)), v);
  }), { faceColor: (c, n, f) => (f % 2 ? C(0xff8a1a) : C(0xffa83e)), def: (p) => [sAt(p.z), Math.min(1, Math.max(0, (-0.32 - p.z) / 0.17)), 1, 0] }));
  for (const sx of [-1, 1]) {
    const root = V(sx * PEC[0], PEC[1], PEC[2]), back = V(sx * 0.5, -0.12, -1).normalize();
    parts.push(facet(THREE, grid(THREE, 2, 1, (t, v, o) => {
      const ph = t * 2 - 1;
      o.copy(root).add(V(0, 0.02 * ph, 0)).lerp(root.clone().addScaledVector(back, 0.13 * (0.72 + 0.28 * Math.cos(ph * 1.3))).add(V(0, 0.065 * Math.sin(ph * 1.15), 0)), v);
    }), { faceColor: () => C(0xffb050), def: (p) => [sAt(p.z), Math.min(1, p.distanceTo(root) / 0.13), 2, sx] }));
    const u = 0.34, pr = V(sx * 0.03, yc(u) - hAt(u) * 0.9, zAt(u));
    parts.push(facet(THREE, grid(THREE, 1, 1, (t, v, o) => {
      o.copy(pr).add(V(0, 0, 0.02 * (t * 2 - 1))).lerp(pr.clone().add(V(sx * 0.03, -0.05, -0.07 + 0.025 * (t * 2 - 1))), v);
    }), { faceColor: () => C(0x16100e), def: (p) => [sAt(p.z), Math.min(1, p.distanceTo(pr) / 0.1), 3, sx] }));
  }
  return merge(THREE, parts);
}

/**
 * @param {typeof import('three')} THREE
 * @param {{variant?: 'jelly'|'lowpoly', detail?: number}} opts
 */
export function build(THREE, opts = {}) {
  const variant = opts.variant === 'lowpoly' ? 'lowpoly' : 'jelly';
  const geometry = variant === 'lowpoly' ? buildLowpoly(THREE) : buildJelly(THREE, Math.max(0.4, Math.min(1, opts.detail ?? 1)));
  const material = variant === 'lowpoly'
    ? { type: 'MeshStandardMaterial', params: { roughness: 0.55, metalness: 0, flatShading: true, side: THREE.DoubleSide } }
    : { type: 'MeshPhysicalMaterial', params: { roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.5,
      sheenColor: new THREE.Color(0xffd8a8), sheenRoughness: 0.45, side: THREE.DoubleSide } };
  material.renderOrder = 0;
  const shade = variant === 'lowpoly'
    ? shadePatch('af-shade-lowpoly', { rim: 0.22, rimPow: 3, glow: 0.07 })
    : shadePatch('af-shade-jelly', { rim: 0.5, rimPow: 2.5, glow: 0.1 });
  return {
    id, variant, geometry, material, deform: [DEFORM], shade: [shade],
    cpu: {},
    info: { triangles: triCount(geometry), unit: '몸길이 1', origin: '몸 중심', front: '+Z', up: '+Y' },
  };
}
