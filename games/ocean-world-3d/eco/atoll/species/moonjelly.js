// 보름달물해파리(Aurelia, 몰디브 기재종 A. maldivensis 계열) 생성기 — P3 화풍 샘플.
// 모양만 만든다. 크기·속도·개체 수는 받지 않는다(정본은 eco/atoll/data.js, 배치하는 쪽이 곱한다).
//
// 몸 규칙: 갓 지름 1(반지름 0.5), 갓 가장자리 평면이 y = 0, 갓 꼭대기 y ≈ 0.25, 촉수·입팔은 아래(−y).
// aDef: x = s(갓은 중심 0 → 가장자리 1, 촉수·입팔은 뿌리 0 → 끝 1) · y = 1 · z = 부위 · w = 부위 안 번호(위상)
//   부위 0 갓 바깥면 · 1 갓 안쪽면·생식소(갓을 따라 움직임) · 2 가장자리 촉수 · 3 입팔 · 4 감각곤(가장자리 점)
// 실제 종과 맞춘 것: 납작한 접시 갓, 네 잎 클로버 모양 생식소(분홍·보라), 갓 가장자리 8곳의 오목한 홈과 감각곤,
//   짧고 가는 가장자리 촉수 여러 가닥, 주름진 입팔 4개, 갓에 비치는 방사관.
// 게임적 허용: 촉수를 실제보다 조금 길고 굵게(움직임이 읽히게), 생식소 색을 조금 진하게(작게 보여도 종이 읽히게).
import { grid, tube, paint, facet, merge, rng, smooth, triCount, shadePatch } from './_kit.js';

export const id = 'moonjelly';
export const variants = {
  jelly: '매끈한 젤리풍',
  lowpoly: '그래픽 로우폴리풍',
};

const BELL_H = 0.25;
/** 갓 바깥면 단면(v: 0 꼭대기 → 1 가장자리) */
const bellR = (v) => 0.5 * Math.pow(Math.sin(v * Math.PI / 2), 0.92);
const bellY = (v) => BELL_H * Math.pow(Math.cos(v * Math.PI / 2), 1.35);
/** 가장자리 홈 8곳(감각곤 자리): θ가 홈 가까이면 1 */
const notch = (th) => Math.pow(0.5 + 0.5 * Math.cos(8 * th), 26);

/** 박동 곡선(빠르게 오므리고 천천히 풀림). render/aqua/swim.js jellyPulse와 같은 식이라 CPU 추진과 맞물린다. */
export function pulse(time, speed = 1, phase = 0) {
  let p = (time * 0.52 * speed + phase / (Math.PI * 2)) % 1;
  if (p < 0) p += 1;
  return p < 0.28 ? smooth(0, 0.28, p) : 1 - smooth(0.28, 1, p);
}

/** 박동·촉수 흔들림 조각(두 화풍 공통). DEF_COMMON(render/core/deform.js) 뒤에 붙인다. */
const DEFORM = {
  name: 'mj-pulse',
  vertexPars: /* glsl */`
float mjPulse(float t, float sp, float ph) {
  float p = fract(t * 0.52 * sp + ph / 6.2831853);
  return p < 0.28 ? smoothstep(0.0, 0.28, p) : 1.0 - smoothstep(0.28, 1.0, p);
}`,
  vertexDeform: /* glsl */`
{
  float g = uDeformGain;
  float k = mjPulse(uTime, aSpeed, aPhase) * g;
  float part = aDef.z;
  float s = aDef.x;
  if (part < 1.5 || part > 3.5) {
    // 갓: 가장자리일수록 오므라들고, 오므릴 때 갓이 높아지며 가장자리가 안으로 말린다
    float rim = (part > 3.5) ? 1.0 : s;
    float r2 = rim * rim;
    transformed.xz *= 1.0 - 0.2 * k * r2;
    transformed.y *= 1.0 + 0.3 * k;
    transformed.y -= (0.06 * k * r2 * rim) ;
    // 갓 가장자리 물결(둘레를 따라 도는 작은 출렁임)
    float th = atan(position.z, position.x);
    transformed.y += 0.01 * sin(th * 8.0 + uTime * 2.6 * aSpeed + aPhase) * r2 * r2 * g;
  } else if (part < 2.5) {
    // 가장자리 촉수: 뿌리는 갓 가장자리를 따라가고, 끝은 늦게 따라와(뒤처짐) 오므릴 때 바깥으로 퍼진다
    transformed.xz *= 1.0 - 0.2 * k * (1.0 - s) + 0.1 * k * s;
    transformed.y -= 0.06 * k * (1.0 - 0.6 * s);
    transformed.y += 0.08 * k * s;
    float ph = uTime * 1.5 * aSpeed + aPhase + aDef.w * 0.37;
    transformed.x += 0.045 * s * sin(ph - 3.5 * s) * g;
    transformed.z += 0.045 * s * cos(ph * 0.9 - 3.5 * s) * g;
    transformed -= uCurrent * s * s * 0.4;
  } else {
    // 입팔: 천천히 흔들리고 박동에 맞춰 살짝 들린다
    float ph = uTime * 0.9 * aSpeed + aPhase + aDef.w * 1.57;
    transformed.xz *= 1.0 - 0.1 * k;
    transformed.y += 0.06 * k * s;
    transformed.x += 0.05 * s * s * sin(ph - 2.0 * s) * g;
    transformed.z += 0.05 * s * s * cos(ph * 0.8 - 2.0 * s) * g;
    transformed -= uCurrent * s * s * 0.3;
  }
}`,
};

// ---------- 매끈한 젤리풍 ----------
function buildJelly(THREE, detail) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const NU = Math.round(96 * detail), NV = Math.round(20 * detail);
  const parts = [];
  // 생식소 4개(네 잎 클로버): 말발굽 고리, 열린 쪽이 중심을 본다
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const g = new THREE.TorusGeometry(0.082, 0.024, 10, Math.round(28 * detail), Math.PI * 1.6);
    g.rotateZ(Math.PI * 0.2 + Math.PI);          // 열린 쪽을 −x로
    g.rotateX(Math.PI / 2);
    g.scale(1, 1, 1); g.scale(1, 0.55, 1);
    g.rotateY(-a);
    g.translate(Math.cos(a) * 0.15, 0.165, Math.sin(a) * 0.15);
    parts.push(paint(THREE, g, {
      color: (p) => C(0xff92cf).lerp(C(0xd47ee0), smooth(0.08, 0.22, Math.hypot(p.x, p.z))),
      def: (p) => [Math.hypot(p.x, p.z) / 0.5, 1, 1, k], mat: [1.9, 0.22],
    }));
  }
  // 입팔 4개: 주름진 띠, 생식소 사이로 내려온다
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + 0.05;
    const out = V(Math.cos(a), 0, Math.sin(a)), side = V(-Math.sin(a), 0, Math.cos(a));
    const g = grid(THREE, Math.round(24 * detail), 4, (s, c, o) => {
      const cc = c * 2 - 1;
      const w = 0.055 * (1 - 0.55 * s) + 0.01;
      const ruff = 0.022 * cc * cc * Math.sin(s * 30 + cc * 2.2 + k);
      o.set(0, 0.11 - s * 0.5, 0).addScaledVector(out, 0.02 + s * 0.09 + ruff).addScaledVector(side, cc * w);
    });
    parts.push(paint(THREE, g, {
      color: (p) => C(0xf8ecff).lerp(C(0xf3b8e6), smooth(0.25, 0.45, -p.y + 0.11) * 0.5),
      def: (p) => [Math.min(1, Math.max(0, (0.11 - p.y) / 0.5)), 1, 3, k], mat: [1.25, 0.06],
    }));
  }
  // 갓 안쪽면(얇은 두께감)
  {
    const g = grid(THREE, Math.round(NU / 2), Math.round(NV / 2), (th, v, o) => {
      const t = th * Math.PI * 2, r = bellR(v) * 0.93 * (1 - 0.035 * notch(t) * Math.pow(v, 6));
      o.set(Math.cos(t) * r, bellY(v) * 0.62 - 0.012, Math.sin(t) * r);
    }, { wrapU: true });
    parts.push(paint(THREE, g, { color: 0xd9ecff, def: (p) => [Math.min(1, Math.hypot(p.x, p.z) / 0.5), 1, 1, 0], mat: [0.55, 0.0] }));
  }
  // 가장자리 촉수: 짧고 가는 술
  const r = rng(31);
  const NT = Math.round(72 * detail);
  for (let i = 0; i < NT; i++) {
    const t = (i / NT) * Math.PI * 2;
    const rr = 0.49 * (1 - 0.035 * notch(t));
    const base = V(Math.cos(t) * rr, -0.004, Math.sin(t) * rr);
    const L = 0.17 + r() * 0.08;
    const tip = base.clone().add(V(Math.cos(t) * 0.03, -L, Math.sin(t) * 0.03));
    const g = tube(THREE, base, tip, 0.0055, 0.0022, 3, 5, (v, o) => { o.x += Math.cos(t) * 0.02 * Math.sin(v * 3); o.z += Math.sin(t) * 0.02 * Math.sin(v * 3); });
    parts.push(paint(THREE, g, { color: 0xfff3fb, def: (p) => [Math.min(1, Math.max(0, (base.y - p.y) / L)), 1, 2, i], mat: [1.35, 0.05] }));
  }
  // 감각곤 8개(가장자리 홈의 작은 점)
  for (let k = 0; k < 8; k++) {
    const t = k * Math.PI / 4;
    const g = new THREE.SphereGeometry(0.012, 6, 4);
    g.translate(Math.cos(t) * 0.468, 0.004, Math.sin(t) * 0.468);
    parts.push(paint(THREE, g, { color: 0xfff0b8, def: [1, 1, 4, k], mat: [2.2, 0.5] }));
  }
  // 갓 바깥면(마지막에 그려 위에 덮인다): 방사관 16줄 + 고리관, 가장자리 띠는 조금 더 희고 진하게
  {
    const g = grid(THREE, NU, NV, (th, v, o) => {
      const t = th * Math.PI * 2;
      const r = bellR(v) * (1 - 0.04 * notch(t) * Math.pow(v, 6)) * (1 + 0.006 * Math.sin(t * 48) * Math.pow(v, 10));
      o.set(Math.cos(t) * r, bellY(v), Math.sin(t) * r);
    }, { wrapU: true });
    const canal = (p) => {
      const t = Math.atan2(p.z, p.x), rr = Math.hypot(p.x, p.z) / 0.5;
      const radial = Math.pow(Math.abs(Math.cos(8 * t)), 7) * smooth(0.25, 0.45, rr) * (1 - smooth(0.9, 0.96, rr));
      const ring = Math.exp(-Math.pow((rr - 0.9) / 0.025, 2));
      return Math.min(1, radial * 0.8 + ring * 0.7);
    };
    parts.push(paint(THREE, g, {
      color: (p) => {
        const rr = Math.hypot(p.x, p.z) / 0.5;
        return C(0xeef7ff).lerp(C(0xcfe6ff), rr * 0.6).lerp(C(0xffffff), canal(p) * 0.8).lerp(C(0xf4eaff), smooth(0.93, 1, rr) * 0.6);
      },
      def: (p) => [Math.min(1, Math.hypot(p.x, p.z) / 0.5), 1, 0, 0],
      mat: (p) => { const rr = Math.hypot(p.x, p.z) / 0.5; return [1 + canal(p) * 0.6 + smooth(0.92, 1, rr) * 0.5, canal(p) * 0.05]; },
    }));
  }
  return merge(THREE, parts);
}

// ---------- 그래픽 로우폴리풍 ----------
function buildLowpoly(THREE) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const parts = [];
  // 생식소: 두툼한 각진 고리, 진한 분홍
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const g = new THREE.TorusGeometry(0.085, 0.03, 4, 7, Math.PI * 1.6);
    g.rotateZ(Math.PI * 0.2 + Math.PI); g.rotateX(Math.PI / 2); g.scale(1, 0.6, 1);
    g.rotateY(-a); g.translate(Math.cos(a) * 0.15, 0.16, Math.sin(a) * 0.15);
    parts.push(facet(THREE, g, { faceColor: (c, n) => (n.y > 0 ? C(0xff6fc2) : C(0xd94fb0)), def: (p) => [Math.hypot(p.x, p.z) / 0.5, 1, 1, k], mat: [2.2, 0.2] }));
  }
  // 입팔: 지그재그로 접힌 띠
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    const out = V(Math.cos(a), 0, Math.sin(a)), side = V(-Math.sin(a), 0, Math.cos(a));
    const g = grid(THREE, 6, 1, (s, c, o) => {
      const cc = c * 2 - 1, zig = ((Math.round(s * 6) % 2) ? 1 : -1) * 0.025;
      o.set(0, 0.1 - s * 0.5, 0).addScaledVector(out, 0.03 + s * 0.08 + zig).addScaledVector(side, cc * (0.05 * (1 - 0.5 * s) + 0.012));
    });
    parts.push(facet(THREE, g, { faceColor: (c, n, f) => (f % 2 ? C(0xf6dcff) : C(0xe7c2fb)), def: (p) => [Math.min(1, Math.max(0, (0.1 - p.y) / 0.5)), 1, 3, k], mat: [1.5, 0.05] }));
  }
  // 촉수 16가닥: 세모 기둥
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const base = V(Math.cos(t) * 0.45, 0, Math.sin(t) * 0.45);
    const L = 0.26;
    const g = tube(THREE, base, base.clone().add(V(Math.cos(t) * 0.04, -L, Math.sin(t) * 0.04)), 0.011, 0.003, 3, 3);
    parts.push(facet(THREE, g, { faceColor: () => C(0xffffff), def: (p) => [Math.min(1, Math.max(0, -p.y / L)), 1, 2, i], mat: [1.6, 0.08] }));
  }
  // 갓: 16조각, 가장자리 8곳을 안으로 당겨 별 모양 홈
  {
    const us = Array.from({ length: 17 }, (_, i) => i / 16);
    const g = grid(THREE, 16, 4, (th, v, o) => {
      const i = Math.round(th * 16), t = th * Math.PI * 2;
      const pull = (i % 2 === 0) ? 0.07 * Math.pow(v, 4) : 0;
      const r = bellR(v) * (1 - pull);
      o.set(Math.cos(t) * r, bellY(v), Math.sin(t) * r);
    }, { wrapU: true, us, vs: [0, 0.3, 0.6, 0.85, 1] });
    parts.push(facet(THREE, g, {
      faceColor: (c, n, f) => {
        const rr = Math.hypot(c.x, c.z) / 0.5, seg = Math.floor(f / 2) % 16;
        if (rr > 0.86) return C(0xf7f0ff);
        return seg % 2 ? C(0xd3f1ff) : C(0xc2e4fb);
      },
      def: (p) => [Math.min(1, Math.hypot(p.x, p.z) / 0.5), 1, 0, 0],
      mat: (p) => [Math.hypot(p.x, p.z) > 0.43 ? 1.5 : 1, 0],
    }));
  }
  return merge(THREE, parts);
}

/**
 * @param {typeof import('three')} THREE
 * @param {{variant?: 'jelly'|'lowpoly', detail?: number}} opts detail = 젤리풍 분할 배율(0.5~1, 기본 1)
 */
export function build(THREE, opts = {}) {
  const variant = opts.variant === 'lowpoly' ? 'lowpoly' : 'jelly';
  const geometry = variant === 'lowpoly' ? buildLowpoly(THREE) : buildJelly(THREE, Math.max(0.4, Math.min(1, opts.detail ?? 1)));
  const material = variant === 'lowpoly'
    ? { type: 'MeshStandardMaterial', params: { roughness: 0.3, metalness: 0, flatShading: true, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide } }
    : { type: 'MeshPhysicalMaterial', params: { roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.55, iridescenceIOR: 1.3,
      sheen: 0.35, sheenColor: new THREE.Color(0xe8d8ff), sheenRoughness: 0.5, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide } };
  material.renderOrder = 3;
  const shade = variant === 'lowpoly'
    ? shadePatch('mj-shade-lowpoly', { rim: 0.35, rimPow: 2, glow: 0.12, alpha: { base: 0.42, edge: 0.45, pow: 1.5, max: 0.9 } })
    : shadePatch('mj-shade-jelly', { rim: 0.6, rimPow: 2.2, glow: 0.1, alpha: { base: 0.32, edge: 0.9, pow: 2, max: 0.92 } });
  return {
    id, variant, geometry, material, deform: [DEFORM], shade: [shade],
    cpu: { pulse },
    info: { triangles: triCount(geometry), unit: '갓 지름 1', origin: '갓 가장자리 평면의 중심', front: '+Z(둥글어서 방향 없음)', up: '+Y' },
  };
}
