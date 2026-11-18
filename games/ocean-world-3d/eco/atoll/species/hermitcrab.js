// 소라게 생성기 — P3 콘텐츠(A 매끈한 젤리풍). 모양만 만든다. 크기·속도·개체 수는 받지 않는다(정본은 eco/atoll/data.js).
//
// 몸 규칙: 몸길이 약 1(집게 끝 z ≈ +0.42, 껍데기 꼭지 z ≈ −0.48), 원점 = 바닥에 닿는 점(몸 가운데 아래), 앞 +Z, 위 +Y.
// aDef: x = s(다리·집게는 뿌리 0 → 끝 1, 그 밖은 0) · y = 1 · z = 부위(0 껍데기, 1 걷는 다리, 2 집게, 3 몸·눈, 4 더듬이)
//       w = 다리 번호(짝·홀이 번갈아 든다) 또는 좌우(−1/+1)
// 실제 종과 맞춘 것: 등에 진 나선 소라껍데기(층마다 굵어지는 나선 골), 껍데기 입구에서 나온 붉은 몸,
//   오른쪽이 더 큰 집게 한 쌍, 걷는 다리 세 쌍, 자루 끝의 검은 눈, 긴 더듬이.
// 게임적 허용: 눈자루를 조금 길게(표정), 껍데기 줄무늬를 진하게, 몸을 조금 크게 내보임.
// 움직임: 걷는 중(aParams.y)에는 다리를 짝·홀 번갈아 들어 앞뒤로 젓고, 껍데기가 좌우로 흔들리며 통통 튄다.
//   멈춰도 집게를 천천히 까딱이고 더듬이를 흔든다.
import { grid, tube, paint, merge, smooth, triCount, shadePatch } from './_kit.js';

export const id = 'hermitcrab';
export const variants = { jelly: '매끈한 젤리풍' };

const DEFORM = {
  name: 'hc-walk',
  vertexDeform: /* glsl */`
{
  float g = uDeformGain;
  float w = clamp(aParams.y, 0.0, 1.0);
  float ph = uTime * 10.0 * aSpeed + aPhase;
  float part = aDef.z, s = aDef.x;
  if (part > 0.5 && part < 1.5) {
    float side = mod(aDef.w, 2.0) < 0.5 ? 0.0 : 3.14159;
    float lift = max(0.0, sin(ph + side));
    transformed.y += lift * 0.12 * s * w * g;
    transformed.z += cos(ph + side) * 0.08 * s * w * g;
  } else if (part > 1.5 && part < 2.5) {
    // 집게: 천천히 까딱(멈춰도)
    float k = sin(uTime * 2.1 * aSpeed + aPhase + aDef.w) * 0.5 + 0.5;
    transformed.y += 0.025 * s * k * g;
    transformed.z += 0.015 * s * k * g;
  } else if (part > 3.5) {
    float ph2 = uTime * 3.0 * aSpeed + aPhase + aDef.w * 1.7;
    transformed.x += 0.03 * s * s * sin(ph2) * g;
    transformed.y += 0.02 * s * s * cos(ph2 * 1.3) * g;
  }
  // 몸 전체: 걸을 때 통통 튀고 껍데기가 좌우로 흔들림
  float bob = abs(sin(ph)) * 0.02 * w * g;
  transformed.y += bob;
  transformed.xy = owRot(transformed.xy, sin(ph * 0.5) * 0.06 * w * g * step(part, 0.5));
}`,
};

function buildJelly(THREE, detail) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const SHELL_A = C(0xf4e2c4), SHELL_B = C(0xb4683c), SHELL_C = C(0x7a3c22), LIP = C(0xf2a8a0);
  const RED = C(0xd8462a), RED_D = C(0xa22a1c), ORANGE = C(0xf07a3c), EYE = C(0x101010);
  const parts = [];
  // ---- 껍데기: 입구(앞 아래) → 꼭지(뒤 위)로 가는 굽은 원뿔 + 나선 골 ----
  const A = V(0, 0.2, 0.03), dir = V(0.06, 0.32, -1).normalize(), LEN = 0.48, R0 = 0.21, TURNS = 3.0;
  const ref = V(0, 1, 0), n1 = new THREE.Vector3().crossVectors(dir, ref).normalize(), n2 = new THREE.Vector3().crossVectors(n1, dir).normalize();
  const shell = grid(THREE, Math.round(30 * detail), Math.round(34 * detail), (th, v, o) => {
    const t = th * Math.PI * 2;
    const grow = Math.pow(1 - v, 0.8);
    const spiral = 0.5 + 0.5 * Math.sin(t + v * TURNS * Math.PI * 2);   // 나선 골(층마다 볼록)
    const rr = R0 * grow * (0.86 + 0.14 * spiral) + 0.006;
    const bend = 0.08 * Math.sin(v * Math.PI);                         // 꼭지가 살짝 아래로 휨
    o.copy(A).addScaledVector(dir, LEN * v).addScaledVector(n2, -bend).addScaledVector(n1, Math.cos(t) * rr * 1.05).addScaledVector(n2, Math.sin(t) * rr);
  }, { wrapU: true });
  parts.push(paint(THREE, shell, {
    color: (p) => {
      const q = p.clone().sub(A), v = Math.min(1, Math.max(0, q.dot(dir) / LEN));
      const t = Math.atan2(q.dot(n2), q.dot(n1));
      const band = 0.5 + 0.5 * Math.sin(t + v * TURNS * Math.PI * 2);
      const c = SHELL_A.clone().lerp(SHELL_B, smooth(0.35, 0.75, band));
      const stripe = Math.sin((t + v * TURNS * Math.PI * 2) * 3);
      if (stripe > 0.75) c.lerp(SHELL_C, 0.55);
      if (v < 0.05) c.lerp(LIP, 0.7);
      return c;
    },
    def: [0, 1, 0, 0],
  }));
  // 입구 안쪽(분홍 진주층)
  const cap = new THREE.CircleGeometry(R0 * 0.97, Math.round(20 * detail));
  cap.lookAt(dir.clone().negate()); cap.translate(A.x + dir.x * 0.012, A.y + dir.y * 0.012, A.z + dir.z * 0.012);
  parts.push(paint(THREE, cap, { color: C(0xe48a86), def: [0, 1, 0, 0] }));

  // ---- 몸(입구에서 나온 앞부분) ----
  const body = new THREE.SphereGeometry(0.12, Math.round(16 * detail), Math.round(12 * detail));
  body.scale(1.15, 0.72, 1.0); body.translate(0, 0.14, 0.14);
  parts.push(paint(THREE, body, { color: (p) => (p.y > 0.15 ? RED : ORANGE), def: [0, 1, 3, 0] }));
  // 눈자루 + 눈
  for (const sx of [-1, 1]) {
    const a = V(sx * 0.035, 0.18, 0.22), b = V(sx * 0.06, 0.3, 0.26);
    parts.push(paint(THREE, tube(THREE, a, b, 0.016, 0.013, 6, 2), { color: ORANGE, def: [0, 1, 3, sx] }));
    const e = new THREE.SphereGeometry(0.026, 10, 8); e.translate(b.x, b.y + 0.012, b.z);
    parts.push(paint(THREE, e, { color: (p) => (p.y > b.y + 0.028 ? C(0xf2c060) : EYE), def: [0, 1, 3, sx], mat: [1, 0.02] }));
    const hl = new THREE.SphereGeometry(0.007, 5, 4); hl.translate(b.x + sx * 0.012, b.y + 0.024, b.z + 0.018);
    parts.push(paint(THREE, hl, { color: 0xffffff, def: [0, 1, 3, sx], mat: [1, 0.9] }));
    // 더듬이
    const a0 = V(sx * 0.02, 0.17, 0.25), a1 = V(sx * 0.12, 0.27, 0.5);
    parts.push(paint(THREE, tube(THREE, a0, a1, 0.006, 0.002, 4, 4), { color: C(0xf0a060), def: (p) => [Math.min(1, p.distanceTo(a0) / 0.28), 1, 4, sx] }));
  }
  // ---- 집게: 오른쪽(−x가 화면 왼쪽인 몸 기준 +x를 오른쪽으로 둠)이 크게 ----
  for (const sx of [-1, 1]) {
    const big = sx > 0, k = big ? 1 : 0.72;
    const sh = V(sx * 0.08, 0.12, 0.2), el = V(sx * 0.13, 0.1, 0.27);
    const L = 0.2;
    const arm = paint(THREE, tube(THREE, sh, el, 0.03 * k, 0.026 * k, 8, 2), { color: RED_D, def: (p) => [Math.min(1, p.distanceTo(sh) / L), 1, 2, sx] });
    parts.push(arm);
    const palm = new THREE.SphereGeometry(0.06 * k, 12, 10); palm.scale(1, 0.75, 1.35); palm.translate(el.x, el.y + 0.005, el.z + 0.06 * k);
    parts.push(paint(THREE, palm, { color: (p) => (p.y > el.y + 0.02 ? RED : C(0xf0a080)), def: (p) => [Math.min(1, p.distanceTo(sh) / L), 1, 2, sx] }));
    // 집게 손가락 두 개
    const tip = V(el.x, el.y + 0.005, el.z + 0.12 * k);
    for (const fy of [1, -1]) {
      const f0 = tip.clone().add(V(0, fy * 0.016 * k, -0.02)), f1 = tip.clone().add(V(-sx * 0.012, fy * 0.006, 0.055 * k));
      parts.push(paint(THREE, tube(THREE, f0, f1, 0.016 * k, 0.004, 6, 2), { color: (p) => C(0xc23a24).lerp(C(0xffe0c8), smooth(0.02, 0.06, p.distanceTo(f0))), def: [1, 1, 2, sx] }));
    }
  }
  // ---- 걷는 다리 세 쌍(무릎에서 꺾인 두 마디) ----
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = 0.15 - k * 0.075;
    const hip = V(sx * 0.1, 0.13, z), knee = V(sx * (0.23 + k * 0.02), 0.17, z + 0.02 - k * 0.02), foot = V(sx * (0.3 + k * 0.02), 0.0, z + 0.05 - k * 0.04);
    const idx = k + (sx > 0 ? 1 : 0);
    const L = hip.distanceTo(knee) + knee.distanceTo(foot);
    const dfn = (p) => [Math.min(1, Math.max(0, Math.hypot(p.x - hip.x, p.z - hip.z) / Math.hypot(foot.x - hip.x, foot.z - hip.z))), 1, 1, idx];
    parts.push(paint(THREE, tube(THREE, hip, knee, 0.02, 0.017, 7, 2), { color: (p) => RED.clone().lerp(ORANGE, 0.3), def: dfn }));
    parts.push(paint(THREE, tube(THREE, knee, foot, 0.017, 0.006, 7, 3), {
      color: (p) => RED.clone().lerp(C(0xffd0a8), smooth(0.08, 0.0, p.y)), def: dfn }));
    // 무릎 마디
    const kn = new THREE.SphereGeometry(0.019, 8, 6); kn.translate(knee.x, knee.y, knee.z);
    parts.push(paint(THREE, kn, { color: RED_D, def: dfn }));
    void L;
  }
  return merge(THREE, parts);
}

/**
 * @param {typeof import('three')} THREE
 * @param {{variant?: 'jelly', detail?: number}} opts
 */
export function build(THREE, opts = {}) {
  const geometry = buildJelly(THREE, Math.max(0.4, Math.min(1, opts.detail ?? 1)));
  const material = { type: 'MeshPhysicalMaterial', params: { roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    sheen: 0.4, sheenColor: new THREE.Color(0xffe0c0), sheenRoughness: 0.4 }, renderOrder: 0 };
  return {
    id, variant: 'jelly', geometry, material, deform: [DEFORM], shade: [shadePatch('hc-shade', { rim: 0.5, rimPow: 2.6, glow: 0.1 })],
    cpu: {},
    info: { triangles: triCount(geometry), unit: '몸길이 약 1', origin: '몸 가운데 아래(바닥)', front: '+Z', up: '+Y' },
  };
}
