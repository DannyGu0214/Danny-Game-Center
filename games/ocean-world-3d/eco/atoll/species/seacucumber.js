// 해삼 생성기 — P3 콘텐츠(A 매끈한 젤리풍). 모양만 만든다. 크기·속도·개체 수는 받지 않는다(정본은 eco/atoll/data.js).
//
// 몸 규칙: 몸길이 1(입 z ≈ +0.5, 항문 z ≈ −0.5), 원점 = 바닥에 닿는 점(배 가운데), 앞 +Z, 위 +Y.
// aDef: x = s(입 0 → 꼬리 1) · y = 1 · z = 부위(0 몸, 1 돌기, 2 입 촉수) · w = 부위 안 번호(위상)
// 실제 종과 맞춘 것: 소시지 모양 몸, 등의 뭉툭한 돌기(유두 돌기), 납작하고 밝은 배(관족이 있는 바닥면),
//   입 둘레의 짧은 촉수 왕관(모래를 집어 먹는 손), 짙은 적갈색 몸.
// 게임적 허용: 돌기 끝을 밝은 크림색으로 칠해 작게 보여도 질감이 읽히게, 몸을 조금 통통하게.
// 움직임: 머리에서 꼬리로 굵기 파동(연동 운동)이 지나가고 몸이 조금 늘었다 줄며, 고개를 천천히 좌우로 흔든다.
//   걷는 중(인스턴스 aParams.y, render/proto/creatures.js가 채움)일수록 파동이 커진다. 멈추면 숨 쉬듯 작게.
import { grid, paint, merge, rng, smooth, triCount, shadePatch } from './_kit.js';

export const id = 'seacucumber';
export const variants = { jelly: '매끈한 젤리풍' };

const AXIS_Y = 0.12;                 // 몸 중심축 높이
const R = (u) => 0.15 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, 0.04 + u * 0.92))), 0.55) * (1 - 0.12 * u);

/** 연동 운동 조각. aParams.y = 걷는 중(0..1) */
const DEFORM = {
  name: 'sc-crawl',
  vertexDeform: /* glsl */`
{
  float s = aDef.x; float g = uDeformGain;
  float w = clamp(aParams.y, 0.0, 1.0);
  float ph = uTime * (1.6 + 1.6 * w) * aSpeed + aPhase;
  float wave = sin(ph - s * 6.2832);
  float amp = (0.05 + 0.11 * w) * g;
  // 굵기 파동: 좌우는 축 기준, 위아래는 배를 바닥에 붙인 채
  transformed.x *= 1.0 + amp * wave;
  transformed.y *= 1.0 + amp * wave * 0.9;
  // 마디가 줄고 늘며 앞으로 밀리는 느낌
  transformed.z += 0.035 * cos(ph - s * 6.2832) * (0.3 + w) * g;
  // 고개(앞쪽)를 천천히 좌우로
  float head = (1.0 - s) * (1.0 - s);
  transformed.x += 0.05 * sin(uTime * 0.7 * aSpeed + aPhase * 1.3) * head * g;
  // 입 촉수: 오므렸다 폈다
  if (aDef.z > 1.5) {
    float k = 0.5 + 0.5 * sin(uTime * 2.2 * aSpeed + aPhase + aDef.w * 0.8);
    vec3 c = vec3(0.0, ${AXIS_Y.toFixed(3)}, 0.47);
    transformed = c + (transformed - c) * (0.75 + 0.4 * k * g);
  }
}`,
};

function buildJelly(THREE, detail) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const TOP = C(0x5a2620), SIDE = C(0x8b3f2c), BELLY = C(0xd7a582), WART = C(0xf0cf9e), MOUTH = C(0x3a1a16);
  const r = rng(13);
  // 등 돌기 자리(u = 길이 0..1, a = 둘레 각, 위쪽 반만)
  const warts = [];
  for (let i = 0; i < 26; i++) warts.push({ u: 0.1 + r() * 0.82, a: (r() - 0.5) * 2.3, s: 0.6 + r() * 0.5 });
  const parts = [];

  // 몸: 축을 도는 격자. 배는 납작, 등은 둥글게
  const body = grid(THREE, Math.round(26 * detail), Math.round(36 * detail), (th, u, o) => {
    const t = th * Math.PI * 2, rr = R(u), sn = Math.sin(t), cs = Math.cos(t);
    const flat = sn < 0 ? 0.72 : 1.08;   // 배는 조금 납작, 등은 둥글게
    o.set(rr * cs * 1.08, AXIS_Y + rr * sn * flat, 0.5 - u);
    if (o.y < 0.01) o.y = 0.01 + (o.y - 0.01) * 0.2;
  }, { wrapU: true });
  parts.push(paint(THREE, body, {
    color: (p, i, n) => {
      const top = smooth(-0.2, 0.7, n.y);
      const c = SIDE.clone().lerp(TOP, top);
      if (n.y < -0.35) c.copy(BELLY);
      else if (n.y < -0.05) c.lerp(BELLY, smooth(-0.05, -0.35, n.y));
      // 옆구리 어두운 얼룩
      const sp = Math.sin(p.z * 31 + Math.sin(p.x * 40) * 2) * Math.sin(p.z * 17 - p.x * 23);
      if (sp > 0.55 && n.y > -0.1) c.lerp(TOP, 0.6);
      if (p.z > 0.47) c.lerp(MOUTH, 0.5);
      return c;
    },
    def: (p) => [Math.min(1, Math.max(0, 0.5 - p.z)), 1, 0, 0],
  }));

  // 돌기: 둥근 끝을 가진 작은 원뿔(몸 표면에 심음)
  warts.forEach((w, k) => {
    const rr = R(w.u), t = Math.PI / 2 + w.a;
    const base = V(rr * Math.cos(t) * 1.08, AXIS_Y + rr * Math.sin(t), 0.5 - w.u);
    const nrm = V(Math.cos(t), Math.sin(t), 0).normalize();
    const L = 0.05 * w.s, rb = 0.022 * w.s;
    const g = grid(THREE, 7, 4, (th, v, o) => {
      const a = th * Math.PI * 2, rad = rb * Math.sqrt(Math.max(0, 1 - v * v)) * (1 - 0.35 * v);
      const side = V(-nrm.y, nrm.x, 0), fwd = V(0, 0, 1);
      o.copy(base).addScaledVector(nrm, L * v - 0.01).addScaledVector(side, Math.cos(a) * rad).addScaledVector(fwd, Math.sin(a) * rad);
    }, { wrapU: true });
    parts.push(paint(THREE, g, {
      color: (p) => SIDE.clone().lerp(WART, smooth(0.0, 0.8, (p.clone().sub(base).dot(nrm) + 0.01) / L)),
      def: () => [Math.min(1, Math.max(0, w.u)), 1, 1, k],
    }));
  });

  // 입 촉수 왕관(앞쪽 끝, 짧은 손가락 10개)
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const base = V(Math.cos(a) * 0.045, AXIS_Y + Math.sin(a) * 0.04, 0.49);
    const dir = V(Math.cos(a) * 0.8, Math.sin(a) * 0.8 + 0.1, 1).normalize();
    const g = grid(THREE, 5, 3, (th, v, o) => {
      const t = th * Math.PI * 2, rad = 0.011 * (1 - 0.5 * v) * (v > 0.8 ? Math.sqrt(Math.max(0, 1 - ((v - 0.8) / 0.2) ** 2)) : 1);
      const n1 = V(-dir.y, dir.x, 0).normalize(), n2 = new THREE.Vector3().crossVectors(dir, n1);
      o.copy(base).addScaledVector(dir, 0.05 * v).addScaledVector(n1, Math.cos(t) * rad).addScaledVector(n2, Math.sin(t) * rad);
    }, { wrapU: true });
    parts.push(paint(THREE, g, { color: (p) => C(0xe7c49a).lerp(C(0xfff0d6), smooth(0.49, 0.54, p.z)), def: [0, 1, 2, k] }));
  }
  return merge(THREE, parts);
}

/**
 * @param {typeof import('three')} THREE
 * @param {{variant?: 'jelly', detail?: number}} opts
 */
export function build(THREE, opts = {}) {
  const geometry = buildJelly(THREE, Math.max(0.4, Math.min(1, opts.detail ?? 1)));
  const material = { type: 'MeshPhysicalMaterial', params: { roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18,
    sheen: 0.6, sheenColor: new THREE.Color(0xffc8a0), sheenRoughness: 0.5 }, renderOrder: 0 };
  return {
    id, variant: 'jelly', geometry, material, deform: [DEFORM], shade: [shadePatch('sc-shade', { rim: 0.55, rimPow: 2.4, glow: 0.12 })],
    cpu: {},
    info: { triangles: triCount(geometry), unit: '몸길이 1', origin: '배 가운데(바닥)', front: '+Z', up: '+Y' },
  };
}
