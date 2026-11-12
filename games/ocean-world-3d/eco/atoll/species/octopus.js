// 문어 생성기 — P3 콘텐츠(A 매끈한 젤리풍). 산호초의 낮 문어(Octopus cyanea 계열).
// 모양만 만든다. 크기·속도·개체 수는 받지 않는다(정본은 eco/atoll/data.js).
//
// 몸 규칙: 팔을 편 폭 약 1, 원점 = 팔 아래 바닥 높이(팔이 닿는 면), 앞 +Z(눈이 보는 쪽), 위 +Y.
// aDef: x = s(팔은 뿌리 0 → 끝 1, 그 밖은 0) · y = 1 · z = 부위(0 외투막, 1 팔, 2 팔 사이 막, 3 머리·눈) · w = 팔 번호(0..7)
// 실제 종과 맞춘 것: 뒤로 부푼 외투막, 툭 튀어나온 두 눈(가로로 긴 눈동자), 팔 여덟 개(끝으로 가늘고 끝이 말림),
//   팔 뿌리 사이의 막, 팔 아래쪽의 밝은 빨판 줄, 몸의 얼룩무늬.
// 게임적 허용: 눈을 크고 또렷하게, 외투막을 둥글게(귀엽게), 빨판은 점 대신 밝은 줄로.
// 움직임: 팔이 우산처럼 벌어졌다 오므리며(분사 박자) 팔마다 물결이 끝으로 지나가고, 팔 끝이 말렸다 풀린다.
//   외투막은 오므릴 때 부풀고(숨 내뿜기), 늘 천천히 숨 쉰다.
import { grid, paint, merge, rng, smooth, triCount, shadePatch } from './_kit.js';

export const id = 'octopus';
export const variants = { jelly: '매끈한 젤리풍' };

const HUB = [0, 0.16, 0.02];     // 팔이 모이는 자리

const DEFORM = {
  name: 'oc-jet',
  vertexPars: /* glsl */`
float ocPulse(float t, float sp, float ph) {
  float p = fract(t * 0.45 * sp + ph / 6.2831853);
  return p < 0.3 ? smoothstep(0.0, 0.3, p) : 1.0 - smoothstep(0.3, 1.0, p);
}`,
  vertexDeform: /* glsl */`
{
  float g = uDeformGain;
  float k = ocPulse(uTime, aSpeed, aPhase) * g;
  vec3 hub = vec3(${HUB.map((v) => v.toFixed(3)).join(', ')});
  float part = aDef.z;
  if (part > 0.5 && part < 2.5) {
    float s = aDef.x;
    float ph = uTime * 2.2 * aSpeed + aPhase + aDef.w * 0.785;
    vec3 q = transformed - hub;
    // 분사: 오므릴 때 팔이 모이고 아래로 쭉, 풀리면 다시 펼침
    q.xz *= 1.0 + (0.12 - 0.38 * k) * s;
    q.y += (-0.1 * k) * s;
    // 팔마다 끝으로 지나가는 물결(위아래 + 옆)
    q.y += 0.045 * s * sin(ph - 5.0 * s) * g;
    vec2 tdir = normalize(vec2(-q.z, q.x) + 1e-4);
    q.xz += tdir * 0.04 * s * s * sin(ph * 0.7 - 4.0 * s) * g;
    transformed = hub + q;
  } else if (part < 0.5) {
    // 외투막: 숨쉬기 + 분사 때 부풂
    float br = 0.03 * sin(uTime * 1.3 * aSpeed + aPhase) * g;
    vec3 c = vec3(0.0, 0.34, -0.1);
    transformed = c + (transformed - c) * (1.0 + br + 0.08 * k);
  }
}`,
};

function buildJelly(THREE, detail) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const SKIN = C(0xb4523a), SKIN_D = C(0x7e2e22), SKIN_L = C(0xe08a5c), UNDER = C(0xf3c3a4), SUCK = C(0xfde2cc);
  const parts = [];
  const r = rng(31);
  const spots = Array.from({ length: 40 }, () => V((r() - 0.5) * 0.5, 0.15 + r() * 0.4, -0.35 + r() * 0.5));
  const mottled = (p, base) => {
    const c = base.clone();
    for (const s of spots) { const d = p.distanceTo(s); if (d < 0.045) { c.lerp(SKIN_L, 0.55 * (1 - d / 0.045)); } }
    return c;
  };
  // 외투막(뒤로 부푼 주머니). 아래쪽은 머리로 이어진다
  const mantle = grid(THREE, Math.round(26 * detail), Math.round(18 * detail), (th, v, o) => {
    const t = th * Math.PI * 2, a = v * Math.PI;
    const rr = 0.17 * Math.sin(a) * (1 + 0.08 * Math.sin(a * 2)) + 0.001;
    // 축: 머리 위(0, 0.2, 0.06) → 뒤 위(0, 0.44, -0.22)
    const ax = V(0, 0.2, 0.06).lerp(V(0, 0.46, -0.24), v);
    o.set(Math.cos(t) * rr * 1.05, ax.y + Math.sin(t) * rr * 0.76, ax.z + Math.sin(t) * rr * 0.65);   // 단면은 축(위·뒤)에 수직
  }, { wrapU: true });
  parts.push(paint(THREE, mantle, { color: (p, i, n) => mottled(p, SKIN.clone().lerp(SKIN_D, smooth(0.2, 0.9, n.y) * 0.5)), def: [0, 1, 0, 0] }));
  // 머리(눈이 붙는 넓은 자리)
  const head = new THREE.SphereGeometry(0.135, Math.round(20 * detail), Math.round(14 * detail));
  head.scale(1.15, 0.85, 1.0); head.translate(0, 0.2, 0.05);
  parts.push(paint(THREE, head, { color: (p) => mottled(p, SKIN), def: [0, 1, 3, 0] }));
  // 눈: 볼록한 눈두덩 + 금빛 눈 + 가로 눈동자 + 반짝임
  for (const sx of [-1, 1]) {
    const ctr = V(sx * 0.1, 0.27, 0.1), out = V(sx, 0.45, 0.6).normalize();
    const lid = new THREE.SphereGeometry(0.052, 14, 10); lid.translate(ctr.x, ctr.y, ctr.z);
    parts.push(paint(THREE, lid, { color: (p) => mottled(p, SKIN_L), def: [0, 1, 3, 0] }));
    const eye = new THREE.SphereGeometry(0.04, 14, 10); eye.translate(ctr.x + out.x * 0.024, ctr.y + out.y * 0.024, ctr.z + out.z * 0.024);
    const ec = V(ctr.x + out.x * 0.024, ctr.y + out.y * 0.024, ctr.z + out.z * 0.024);
    parts.push(paint(THREE, eye, {
      color: (p) => {
        const d = p.clone().sub(ec).normalize();
        if (d.dot(out) < 0.35) return SKIN_L;
        const up = V(0, 1, 0), side = new THREE.Vector3().crossVectors(up, out).normalize();
        const py = Math.abs(d.dot(up)), px = Math.abs(d.dot(side));
        return py < 0.12 && px < 0.42 ? C(0x0c0a08) : C(0xf2c440);
      },
      def: [0, 1, 3, 0], mat: [1, 0.05],
    }));
    const hl = new THREE.SphereGeometry(0.009, 6, 4);
    const hp = ec.clone().addScaledVector(V(sx * 0.3, 0.8, 0.5).normalize(), 0.038); hl.translate(hp.x, hp.y, hp.z);
    parts.push(paint(THREE, hl, { color: 0xffffff, def: [0, 1, 3, 0], mat: [1, 0.9] }));
  }
  // 팔 여덟 개: 뿌리에서 바깥·아래로, 끝이 위로 말림
  const hub = V(...HUB);
  const armPts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8 + (r() - 0.5) * 0.15;
    const dir = V(Math.sin(a), 0, Math.cos(a));
    const side = V(dir.z, 0, -dir.x);
    const L = 0.44 + r() * 0.06, curl = 0.7 + r() * 0.5;
    const center = (s) => {
      const reach = 0.05 + L * Math.sin(s * Math.PI * 0.5 * 0.95) * (1 - 0.18 * s * s * curl);
      const y = hub.y - 0.14 * smooth(0, 0.5, s) + 0.1 * curl * smooth(0.65, 1, s) * s;
      return hub.clone().addScaledVector(dir, reach).setY(y).addScaledVector(side, 0.05 * curl * s * s * s);
    };
    armPts.push({ dir, side, center });
    const nv = Math.round(16 * detail);
    const g = grid(THREE, 8, nv, (th, s, o) => {
      const t = th * Math.PI * 2;
      const c = center(s), c2 = center(Math.min(1, s + 0.02)), c1 = center(Math.max(0, s - 0.02));
      const tan = c2.sub(c1).normalize();
      const n1 = new THREE.Vector3().crossVectors(tan, V(0, 1, 0)).normalize();
      if (n1.lengthSq() < 1e-6) n1.copy(side);
      const n2 = new THREE.Vector3().crossVectors(n1, tan).normalize();
      const rr = 0.042 * Math.pow(1 - s, 0.85) + 0.004;
      o.copy(c).addScaledVector(n1, Math.cos(t) * rr).addScaledVector(n2, Math.sin(t) * rr * 0.85);
    }, { wrapU: true });
    const k = i;
    parts.push(paint(THREE, g, {
      color: (p, j, n) => {
        // 아래쪽(빨판 쪽)은 밝게, 빨판 줄은 더 밝게
        if (n.y < -0.25) {
          const along = p.distanceTo(hub);
          return Math.sin(along * 120) > 0.2 ? SUCK : UNDER;
        }
        return mottled(p, SKIN.clone().lerp(SKIN_D, 0.25));
      },
      // 팔 위의 s = 격자의 길이 방향 번호(꼭짓점 번호 = 마디 × 8 + 둘레). 말린 끝도 뿌리에서 같은 비율로 움직여 끊기지 않는다
      def: (p, j) => [Math.floor(j / 8) / nv, 1, 1, k],
    }));
  }
  // 팔 사이 막(뿌리 쪽 치마)
  const web = grid(THREE, 32, 3, (th, v, o) => {
    const t = th * Math.PI * 2;
    const rr = 0.05 + v * 0.13 * (0.75 + 0.25 * Math.cos(t * 8 - Math.PI));
    o.set(Math.sin(t) * rr, hub.y - 0.07 * v - 0.012, Math.cos(t) * rr + hub.z);
  }, { wrapU: true });
  parts.push(paint(THREE, web, {
    color: (p, i, n) => (n.y < 0 ? UNDER : SKIN),
    def: (p) => [Math.min(1, Math.max(0, (Math.hypot(p.x - hub.x, p.z - hub.z) - 0.05) / 0.44)), 1, 2, 0],
  }));
  return merge(THREE, parts);
}

/**
 * @param {typeof import('three')} THREE
 * @param {{variant?: 'jelly', detail?: number}} opts
 */
export function build(THREE, opts = {}) {
  const geometry = buildJelly(THREE, Math.max(0.4, Math.min(1, opts.detail ?? 1)));
  const material = { type: 'MeshPhysicalMaterial', params: { roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    sheen: 0.6, sheenColor: new THREE.Color(0xffc0a0), sheenRoughness: 0.45, side: THREE.DoubleSide }, renderOrder: 0 };
  return {
    id, variant: 'jelly', geometry, material, deform: [DEFORM], shade: [shadePatch('oc-shade', { rim: 0.6, rimPow: 2.2, glow: 0.12 })],
    cpu: {},
    info: { triangles: triCount(geometry), unit: '팔 편 폭 약 1', origin: '팔 아래 바닥 높이', front: '+Z', up: '+Y' },
  };
}
