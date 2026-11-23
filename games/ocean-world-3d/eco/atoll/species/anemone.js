// 말미잘 생성기 — P3 콘텐츠(A 매끈한 젤리풍). 흰동가리가 사는 큰 말미잘(몰디브흰동가리의 짝, 화려한말미잘 Heteractis magnifica 계열).
// 모양만 만든다. 크기·개체 수는 받지 않는다(정본은 eco/atoll/data.js).
//
// 몸 규칙: 지름 약 1(촉수 끝까지), 원점 = 바닥(발판 가운데), 위 +Y. 둥글어서 앞뒤가 없다.
// aDef: x = s(촉수 뿌리 0 → 끝 1, 몸통은 0) · y = 1 · z = 부위(0 몸통·발판, 1 입판, 2 촉수) · w = 촉수 번호(위상)
// 실제 종과 맞춘 것: 짧고 굵은 몸통(진분홍~자주), 넓게 펼친 입판, 빽빽한 손가락 모양 촉수(끝이 뭉툭하고 밝음),
//   입판 가운데의 입(주름 진 구멍).
// 게임적 허용: 촉수를 조금 굵고 성기게(작게 보여도 하나하나 읽히게), 끝 색을 밝게.
// 움직임: 촉수마다 따로 해류에 흔들리고, 전체가 몇 초에 한 번 천천히 오므렸다 피며(숨쉬기), 몸통이 살짝 부푼다.
import { grid, paint, merge, rng, smooth, triCount, shadePatch } from './_kit.js';

export const id = 'anemone';
export const variants = { jelly: '매끈한 젤리풍' };

const COL_H = 0.16, DISC_R = 0.24;

const DEFORM = {
  name: 'an-sway',
  vertexDeform: /* glsl */`
{
  float g = uDeformGain;
  float breathe = 0.5 + 0.5 * sin(uTime * 0.55 * aSpeed + aPhase);   // 0 오므림 → 1 활짝
  breathe = smoothstep(0.0, 1.0, breathe);
  if (aDef.z > 1.5) {
    float s = aDef.x;
    vec3 root = vec3(0.0, ${COL_H.toFixed(3)} + 0.02, 0.0);
    // 숨쉬기: 오므릴 때 촉수가 가운데로 모이며 들린다
    vec3 q = transformed - root;
    float close = (1.0 - breathe) * 0.35 * g * s;
    q.xz *= 1.0 - close;
    q.y += length(q.xz) * close * 0.6;
    // 촉수마다 다른 흔들림 + 해류
    float ph = uTime * 1.7 * aSpeed + aPhase + aDef.w * 0.61;
    vec3 sw = vec3(sin(ph), 0.0, cos(ph * 0.83 + aDef.w)) * 0.05 + uCurrent * 0.5;
    q += sw * s * s * g;
    q.y -= dot(sw, sw) * s * s * 2.0 * g;
    transformed = root + q;
  } else {
    // 몸통·입판: 숨쉬기에 맞춰 살짝 부풂
    float k = (breathe - 0.5) * 0.06 * g;
    transformed.xz *= 1.0 + k * smoothstep(0.0, ${COL_H.toFixed(3)}, transformed.y);
  }
}`,
};

function buildJelly(THREE, detail) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const COL = C(0xc2286a), COL_D = C(0x8e1a54), FOOT = C(0xe86aa0), DISC = C(0xd8c08a), MOUTH = C(0xb03a6a);
  const TENT = C(0xc9d48a), TENT_TIP = C(0xfbe7a6), TENT_DOT = C(0xf2a6c8);
  const parts = [];
  // 몸통(발판에서 입판까지, 아래가 조금 넓고 위로 벌어짐)
  const col = grid(THREE, Math.round(28 * detail), 6, (th, v, o) => {
    const t = th * Math.PI * 2;
    const r = 0.2 - 0.03 * Math.sin(v * Math.PI) + 0.05 * smooth(0.7, 1, v) + 0.006 * Math.sin(t * 9);
    o.set(Math.cos(t) * r, v * COL_H, Math.sin(t) * r);
  }, { wrapU: true });
  parts.push(paint(THREE, col, {
    color: (p) => { const c = COL.clone().lerp(COL_D, 0.5 + 0.5 * Math.sin(Math.atan2(p.z, p.x) * 9)); return p.y < 0.025 ? FOOT : c; },
    def: [0, 1, 0, 0],
  }));
  // 입판(살짝 오목한 원판, 가운데 입)
  const disc = grid(THREE, Math.round(28 * detail), 5, (th, v, o) => {
    const t = th * Math.PI * 2, r = DISC_R * v + 0.0001;
    o.set(Math.cos(t) * r, COL_H + 0.015 - 0.03 * (1 - v) * (1 - v) + 0.008 * Math.sin(t * 6) * v, Math.sin(t) * r);
  }, { wrapU: true });
  // 격자의 감는 방향 때문에 면이 아래를 보므로 뒤집는다
  { const I = disc.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } disc.computeVertexNormals(); }
  parts.push(paint(THREE, disc, {
    color: (p) => { const r = Math.hypot(p.x, p.z); return r < 0.04 ? MOUTH : DISC.clone().lerp(C(0xa8b070), 0.3 + 0.3 * Math.sin(Math.atan2(p.z, p.x) * 12)); },
    def: [0, 1, 1, 0],
  }));
  // 촉수: 고리 세 겹, 뭉툭한 손가락
  const r = rng(11);
  let n = 0;
  const rings = [[0.07, 10, 0.2], [0.13, 16, 0.25], [0.19, 22, 0.28], [0.235, 26, 0.26]];
  for (const [ring, cnt, len] of rings) {
    for (let i = 0; i < cnt; i++, n++) {
      const a = (i / cnt) * Math.PI * 2 + ring * 17 + r() * 0.1;
      const base = V(Math.cos(a) * ring, COL_H + 0.01, Math.sin(a) * ring);
      const out = V(Math.cos(a), 0, Math.sin(a));
      const L = len * (0.85 + r() * 0.3);
      const lean = 0.3 + ring * 4.2 + r() * 0.25;           // 바깥 고리일수록 바깥으로 눕는다
      const rad = 0.022 * (1 + ring * 0.6);
      const tip = r() < 0.5;
      const g = grid(THREE, 6, Math.round(6 * detail) + 1, (th, v, o) => {
        const t = th * Math.PI * 2;
        const curve = V(0, 1, 0).multiplyScalar(Math.cos(v * lean)).addScaledVector(out, Math.sin(v * lean));
        // 중심선: 뿌리에서 위로 솟아 바깥으로 눕는 원호(길이 L, 굽은 각 lean)
        const c = base.clone().addScaledVector(out, L * (1 - Math.cos(v * lean)) / lean).add(V(0, L * Math.sin(v * lean) / lean, 0));
        const side = new THREE.Vector3().crossVectors(curve, V(0, 1, 0)).normalize();
        if (side.lengthSq() < 1e-6) side.set(-out.z, 0, out.x);
        const up2 = new THREE.Vector3().crossVectors(side, curve).normalize();
        const rr = rad * (1 - 0.25 * v) * (v > 0.82 ? Math.sqrt(Math.max(0, 1 - ((v - 0.82) / 0.18) ** 2)) : 1) * (v > 0.82 ? 1.15 : 1);
        o.copy(c).addScaledVector(side, Math.cos(t) * rr).addScaledVector(up2, Math.sin(t) * rr);
      }, { wrapU: true });
      const k = n;
      parts.push(paint(THREE, g, {
        color: (p) => {
          const s = Math.min(1, p.distanceTo(base) / L);
          return TENT.clone().lerp(tip ? TENT_DOT : TENT_TIP, smooth(0.6, 0.95, s));
        },
        def: (p) => [Math.min(1, p.distanceTo(base) / L), 1, 2, k],
        mat: (p) => [1, p.distanceTo(base) / L > 0.85 ? 0.06 : 0],
      }));
    }
  }
  return merge(THREE, parts);
}

/**
 * @param {typeof import('three')} THREE
 * @param {{variant?: 'jelly', detail?: number}} opts
 */
export function build(THREE, opts = {}) {
  const geometry = buildJelly(THREE, Math.max(0.4, Math.min(1, opts.detail ?? 1)));
  const material = { type: 'MeshPhysicalMaterial', params: { roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12,
    sheen: 0.7, sheenColor: new THREE.Color(0xfff0c8), sheenRoughness: 0.4 }, renderOrder: 0 };
  return {
    id, variant: 'jelly', geometry, material, deform: [DEFORM], shade: [shadePatch('an-shade', { rim: 0.6, rimPow: 2.2, glow: 0.14 })],
    cpu: {},
    info: { triangles: triCount(geometry), unit: '지름 약 1', origin: '발판 가운데(바닥)', front: '없음(둥긂)', up: '+Y' },
  };
}
