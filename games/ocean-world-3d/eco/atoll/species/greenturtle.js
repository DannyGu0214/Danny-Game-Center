// 바다거북(푸른바다거북 Chelonia mydas) 생성기 — P3 콘텐츠(A 매끈한 젤리풍).
// 모양만 만든다. 크기·속도·개체 수는 받지 않는다(정본은 eco/atoll/data.js).
//
// 몸 규칙: 등딱지 길이 약 0.9 + 머리(주둥이 z ≈ +0.6, 등딱지 끝 z ≈ −0.45), 원점 = 몸 중심, 앞 +Z, 위 +Y.
// aDef: x = s(지느러미는 뿌리 0 → 끝 1, 그 밖은 0) · y = 머리 마스크(1 = 머리·목) · z = 부위(0 등딱지·배·머리, 1 앞지느러미, 2 뒷지느러미)
//       w = 좌우(−1/+1)
// 실제 종과 맞춘 것: 낮고 둥근 눈물방울 모양 등딱지, 등딱지 판(가운데 줄 5장 + 양옆 4장씩)과 판마다 퍼지는 갈색 무늬,
//   연노랑 배딱지, 짧고 뭉툭한 부리, 비늘 테두리가 밝은 머리, 길고 날개 같은 앞지느러미와 작은 뒷지느러미.
// 게임적 허용: 눈을 조금 크게, 등딱지 판 경계를 또렷하게.
// 움직임: 앞지느러미가 크게 날갯짓(위아래 + 뒤로 젓기), 뒷지느러미는 작게 방향을 잡고, 머리가 천천히 끄덕인다.
import { grid, paint, merge, smooth, triCount, shadePatch } from './_kit.js';

export const id = 'greenturtle';
export const variants = { jelly: '매끈한 젤리풍' };

const FRONT_PIV = [0.2, -0.01, 0.2], BACK_PIV = [0.15, -0.03, -0.3];
const f3 = (a) => a.map((v) => v.toFixed(3)).join(', ');

const FLIP = /* glsl */`
  bool front = aDef.z < 1.5;
  vec3 piv = front ? vec3(aDef.w * ${FRONT_PIV[0]}, ${FRONT_PIV[1]}, ${FRONT_PIV[2]}) : vec3(aDef.w * ${BACK_PIV[0]}, ${BACK_PIV[1]}, ${BACK_PIV[2]});
  float ph = uTime * 2.2 * aSpeed + aPhase + (front ? 0.0 : 1.4);
  float a = (front ? 0.6 : 0.2) * sin(ph) * uDeformGain * aDef.w;
  float sw = (front ? 0.42 : 0.25) * cos(ph) * uDeformGain * aDef.w;
  float tw = (front ? 0.3 : 0.0) * cos(ph) * uDeformGain;`;

const DEFORM = {
  name: 'gt-flap',
  vertexNormal: /* glsl */`
if (aDef.z > 0.5) {${FLIP}
  objectNormal.xy = owRot(objectNormal.xy, a);
  objectNormal.xz = owRot(objectNormal.xz, sw);
}`,
  vertexDeform: /* glsl */`
if (aDef.z > 0.5) {${FLIP}
  vec3 q = transformed - piv;
  // 끝으로 갈수록 늦게 따라오는 휨(날개처럼)
  float s = aDef.x;
  q.yz = owRot(q.yz, tw * s * s);
  q.xy = owRot(q.xy, a * (0.7 + 0.3 * s));
  q.xz = owRot(q.xz, sw);
  transformed = piv + q;
} else if (aDef.y > 0.5) {
  float ph = uTime * 1.1 * aSpeed + aPhase;
  vec3 neck = vec3(0.0, 0.0, 0.4);
  vec3 q = transformed - neck;
  q.yz = owRot(q.yz, 0.08 * sin(ph) * uDeformGain);
  q.xz = owRot(q.xz, 0.1 * sin(ph * 0.6 + 1.0) * uDeformGain);
  transformed = neck + q;
}`,
};

// 등딱지 윤곽: z(−0.45..0.45)에서 반폭
const halfW = (z) => 0.36 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((z + 0.02) / 0.47), 2.2)), 0.5) * (z > 0 ? 1 - 0.18 * z : 1 + 0.1 * z);

function buildJelly(THREE, detail) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const SC_A = C(0x6b5a2a), SC_B = C(0x9a7a3a), SC_C = C(0x3e3a1e), SEAM = C(0xd8c890), PLAST = C(0xeedd9a);
  const SKIN = C(0x5c6644), SKIN_L = C(0x9aa078), SKIN_D = C(0x3e4428);
  const parts = [];
  // 등딱지 판 중심(가운데 5 + 양옆 4씩)
  const scutes = [];
  for (let i = 0; i < 5; i++) scutes.push(V(0, 0, 0.32 - i * 0.16));
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) scutes.push(V(sx * 0.2, 0, 0.24 - i * 0.17));
  const scuteCol = (p) => {
    let d1 = 9, d2 = 9, best = null;
    for (const s of scutes) { const d = Math.hypot((p.x - s.x) * 1.1, p.z - s.z); if (d < d1) { d2 = d1; d1 = d; best = s; } else if (d < d2) d2 = d; }
    if (d2 - d1 < 0.018) return SEAM.clone().lerp(SC_A, 0.2);
    // 판마다 가운데에서 퍼지는 줄무늬
    const ang = Math.atan2(p.z - best.z, p.x - best.x);
    const ray = 0.5 + 0.5 * Math.sin(ang * 7 + best.z * 20);
    return SC_C.clone().lerp(SC_A, smooth(0.0, 0.08, d1)).lerp(SC_B, ray * 0.55 * smooth(0.02, 0.1, d1));
  };
  // 등딱지(위)와 배딱지(아래)를 한 고리로: u = 둘레(0..1), v = 앞→뒤
  const shell = grid(THREE, Math.round(32 * detail), Math.round(26 * detail), (th, v, o) => {
    const z = 0.45 - 0.92 * v, hw = halfW(z) + 0.002;
    const t = th * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
    const top = sn > 0;
    const h = top ? 0.15 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(z + 0.04) / 0.47, 2)), 0.6) : 0.045;
    const x = hw * Math.sign(cs) * Math.pow(Math.abs(cs), 0.7);
    const y = (top ? h * Math.pow(Math.abs(sn), 0.8) : -h * Math.pow(Math.abs(sn), 0.6)) + (top ? 0 : 0);
    o.set(x, y, z);
  }, { wrapU: true });
  parts.push(paint(THREE, shell, {
    color: (p, i, n) => {
      if (p.y < -0.005) return PLAST.clone().lerp(C(0xd8c070), 0.3 * Math.abs(Math.sin(p.z * 20)));
      if (Math.abs(p.y) < 0.012) return SEAM;
      return scuteCol(p);
    },
    def: [0, 0, 0, 0],
  }));
  // 머리·목
  const head = grid(THREE, Math.round(18 * detail), Math.round(14 * detail), (th, v, o) => {
    const t = th * Math.PI * 2;
    const z = 0.34 + v * 0.27;
    const rr = 0.085 * Math.pow(Math.sin(Math.min(1, 0.15 + v * 0.95) * Math.PI * 0.5 + (v > 0.6 ? (v - 0.6) * 2.4 : 0)), 1) * (v > 0.75 ? Math.sqrt(Math.max(0, 1 - ((v - 0.75) / 0.25) ** 2)) : 1);
    o.set(Math.cos(t) * rr, 0.015 + Math.sin(t) * rr * 0.82 + 0.02 * v, z);
  }, { wrapU: true });
  parts.push(paint(THREE, head, {
    color: (p) => {
      if (p.z > 0.585) return C(0x3a3220);                 // 부리 끝
      const cell = Math.sin(p.x * 90) * Math.sin(p.z * 80 + p.y * 40);
      return Math.abs(cell) < 0.18 ? SKIN_L : SKIN.clone().lerp(SKIN_D, 0.3 * (0.5 + 0.5 * cell));
    },
    def: [0, 1, 0, 0],
  }));
  for (const sx of [-1, 1]) {
    const ctr = V(sx * 0.055, 0.05, 0.53);
    const e = new THREE.SphereGeometry(0.022, 10, 8); e.translate(ctr.x, ctr.y, ctr.z);
    parts.push(paint(THREE, e, { color: (p) => (p.clone().sub(ctr).normalize().dot(V(sx, 0.2, 0.4).normalize()) > 0.5 ? C(0x0a0806) : C(0x8a5a2a)), def: [0, 1, 0, 0], mat: [1, 0.03] }));
    const hl = new THREE.SphereGeometry(0.006, 5, 4); hl.translate(ctr.x + sx * 0.012, ctr.y + 0.012, ctr.z + 0.012);
    parts.push(paint(THREE, hl, { color: 0xffffff, def: [0, 1, 0, 0], mat: [1, 0.9] }));
  }
  // 지느러미: 납작한 날개(앞은 길게 뒤로 휨, 뒤는 작고 둥글게)
  const flipper = (sx, front) => {
    const piv = front ? V(sx * FRONT_PIV[0], FRONT_PIV[1], FRONT_PIV[2]) : V(sx * BACK_PIV[0], BACK_PIV[1], BACK_PIV[2]);
    const L = front ? 0.5 : 0.2, W = front ? 0.12 : 0.09, sweep = front ? 0.55 : 0.5;
    const out = V(sx * Math.cos(sweep), 0, -Math.sin(sweep) * (front ? 1 : -0.2) - (front ? 0 : 0.6)).normalize();
    const back = new THREE.Vector3().crossVectors(out, V(0, sx, 0)).normalize();   // 날개 뒤쪽(코드 방향)
    const g = grid(THREE, Math.round(12 * detail), Math.round(10 * detail), (th, s, o) => {
      const t = th * Math.PI * 2;
      const chord = W * Math.pow(Math.sin(Math.min(1, 0.2 + s) * Math.PI * 0.62), 0.8) * (1 - 0.65 * s * s) + 0.004;
      const thick = 0.022 * (1 - 0.7 * s) + 0.003;
      const lead = front ? -0.25 * chord : 0;
      o.copy(piv).addScaledVector(out, L * s).addScaledVector(back, Math.cos(t) * chord + lead).add(V(0, Math.sin(t) * thick - 0.03 * s * s, 0));
    }, { wrapU: true });
    return paint(THREE, g, {
      color: (p, i, n) => {
        const cell = Math.sin(p.x * 70 + p.z * 30) * Math.sin(p.z * 75 - p.x * 25);
        if (n.y < -0.3) return SKIN_L.clone().lerp(SKIN, 0.4);
        return Math.abs(cell) < 0.12 ? SKIN_L : SKIN.clone().lerp(SKIN_D, 0.4 * (0.5 + 0.5 * cell));
      },
      def: (p) => [Math.min(1, Math.max(0, p.clone().sub(piv).dot(out) / L)), 0, front ? 1 : 2, sx],
    });
  };
  for (const sx of [-1, 1]) { parts.push(flipper(sx, true)); parts.push(flipper(sx, false)); }
  // 짧은 꼬리
  const tail = new THREE.ConeGeometry(0.03, 0.09, 8); tail.rotateX(-Math.PI / 2); tail.translate(0, -0.01, -0.48);
  parts.push(paint(THREE, tail, { color: SKIN, def: [0, 0, 0, 0] }));
  return merge(THREE, parts);
}

/**
 * @param {typeof import('three')} THREE
 * @param {{variant?: 'jelly', detail?: number}} opts
 */
export function build(THREE, opts = {}) {
  const geometry = buildJelly(THREE, Math.max(0.4, Math.min(1, opts.detail ?? 1)));
  const material = { type: 'MeshPhysicalMaterial', params: { roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12,
    sheen: 0.35, sheenColor: new THREE.Color(0xf0e8b0), sheenRoughness: 0.5, side: THREE.DoubleSide }, renderOrder: 0 };
  return {
    id, variant: 'jelly', geometry, material, deform: [DEFORM], shade: [shadePatch('gt-shade', { rim: 0.45, rimPow: 2.6, glow: 0.1 })],
    cpu: {},
    info: { triangles: triCount(geometry), unit: '등딱지 길이 약 0.9', origin: '몸 중심', front: '+Z', up: '+Y' },
  };
}
void f3;
