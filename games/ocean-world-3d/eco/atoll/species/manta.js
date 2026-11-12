// 쥐가오리(산호초쥐가오리 Mobula alfredi) 생성기 — P3 콘텐츠(A 매끈한 젤리풍).
// 모양만 만든다. 크기·속도·개체 수는 받지 않는다(정본은 eco/atoll/data.js).
//
// 몸 규칙: 날개 폭 1(x −0.5..0.5), 앞 끝 z ≈ +0.24, 꼬리 끝 z ≈ −0.62, 원점 = 몸 중심, 앞 +Z, 위 +Y.
// aDef: x = s(날개는 몸 가운데 0 → 날개 끝 1, 꼬리는 0) · y = 꼬리 마스크(뿌리 0 → 끝 1) · z = 부위(0 몸·날개, 1 머리지느러미, 2 꼬리, 3 등지느러미)
//       w = 좌우(−1/+1)
// 실제 종과 맞춘 것: 마름모꼴 넓은 날개(앞 가장자리가 뒤로 휨, 끝이 뾰족), 머리 앞의 머리지느러미 두 장(뿔처럼 말림),
//   넓은 입, 짧은 꼬리와 작은 등지느러미, 검은 등과 어깨의 흰 반달 무늬(산호초쥐가오리 특징), 흰 배와 배의 검은 점.
// 게임적 허용: 어깨 흰 무늬를 크게(멀리서도 종이 읽히게), 배 점을 몇 개만.
// 움직임: 날개가 몸 쪽에서 끝으로 파동을 보내며 천천히 날갯짓, 머리지느러미가 말렸다 펴지고, 꼬리가 좌우로 흔들린다.
import { grid, tube, paint, merge, smooth, triCount, shadePatch } from './_kit.js';

export const id = 'manta';
export const variants = { jelly: '매끈한 젤리풍' };

const DEFORM = {
  name: 'mt-fly',
  vertexNormal: /* glsl */`
if (aDef.z < 0.5) {
  float s = aDef.x; float ph = uTime * 1.7 * aSpeed + aPhase;
  float dyds = 0.2 * (1.6 * pow(max(s, 1e-3), 0.6) * sin(ph - 1.8 * s) - 1.8 * pow(s, 1.6) * cos(ph - 1.8 * s)) * uDeformGain;
  objectNormal.xy = owRot(objectNormal.xy, atan(dyds) * aDef.w);
}`,
  vertexDeform: /* glsl */`
{
  float g = uDeformGain;
  float ph = uTime * 1.7 * aSpeed + aPhase;
  float part = aDef.z;
  if (part < 0.5) {
    float s = aDef.x;
    float f = 0.2 * pow(s, 1.6) * sin(ph - 1.8 * s) * g;
    transformed.y += f;
    transformed.x *= 1.0 - 0.5 * f * f;
    // 몸 전체가 날갯짓에 맞춰 조금 오르내림
    transformed.y -= 0.012 * sin(ph) * g;
  } else if (part < 1.5) {
    // 머리지느러미: 말렸다 펴짐
    float k = 0.5 + 0.5 * sin(ph * 0.8 + aPhase);
    vec3 piv = vec3(aDef.w * 0.07, 0.0, 0.2);
    vec3 q = transformed - piv;
    q.xy = owRot(q.xy, -aDef.w * 0.5 * k * g);
    transformed = piv + q;
    transformed.y -= 0.012 * sin(ph) * g;
  } else {
    transformed.x += 0.05 * sin(ph * 1.5 - aDef.y * 4.0) * aDef.y * g;
    transformed.y -= 0.012 * sin(ph) * g;
  }
}`,
};

function buildJelly(THREE, detail) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const BACK = C(0x1d2534), BACK_L = C(0x3a4658), WHITE = C(0xf4f7f8), BELLY = C(0xeef2f4), SPOT = C(0x2a3040), MOUTH = C(0x3a4250);
  const parts = [];
  // 몸·날개: x = 폭(−1..1), 단면은 앞뒤 코드를 도는 고리(위는 볼록, 아래는 납작)
  const zF = (au) => 0.22 - 0.1 * au - 0.2 * au * au * au;                  // 앞 가장자리(끝으로 갈수록 뒤로)
  const zB = (au) => -0.2 + 0.12 * Math.pow(au, 0.6);                       // 뒤 가장자리(끝에서 앞 가장자리와 만남)
  const nu = Math.round(36 * detail), nt = Math.round(14 * detail);
  const body = grid(THREE, nt, nu, (th, uu, o) => {
    const u = uu * 2 - 1, au = Math.abs(u);
    const t = th * Math.PI * 2;
    const f = zF(au), b = zB(au), mid = (f + b) / 2, half = Math.max(0.004, (f - b) / 2);
    const thick = 0.075 * Math.pow(Math.max(0, 1 - au), 1.5) + 0.004;
    const sn = Math.sin(t);
    // 앞 가장자리 쪽이 두껍고 뒤쪽은 얇은 날개 단면
    const zz = mid + half * Math.cos(t);
    const bias = 0.6 + 0.4 * Math.cos(t);
    o.set(u * 0.5, (sn > 0 ? thick * sn : thick * 0.5 * sn) * bias, zz);
  }, { wrapU: true });
  parts.push(paint(THREE, body, {
    color: (p, i, n) => {
      if (n.y < -0.1) {
        // 배: 흰 바탕에 검은 점 몇 개, 아가미 줄
        const sp = [[0.05, -0.02], [-0.07, -0.06], [0.1, -0.1], [-0.02, -0.12]];
        for (const [x, z] of sp) if (Math.hypot(p.x - x, p.z - z) < 0.016) return SPOT;
        if (Math.abs(p.x) > 0.05 && Math.abs(p.x) < 0.12 && p.z > -0.02 && p.z < 0.1 && Math.sin(p.z * 120) > 0.6) return C(0xc8d0d8);
        return Math.abs(p.x) > 0.42 ? C(0x5a6474) : BELLY;
      }
      // 등: 검정, 어깨의 흰 반달(가운데선에서 떨어진 앞쪽)
      const ax = Math.abs(p.x);
      const sh = Math.hypot((ax - 0.13) / 0.1, (p.z - 0.04) / 0.07);
      if (sh < 1 && p.z < 0.12 - ax * 0.25) return WHITE.clone().lerp(BACK_L, smooth(0.6, 1, sh));
      const c = BACK.clone();
      if (ax < 0.04 && p.z > -0.1) c.lerp(BACK_L, 0.4);
      return c;
    },
    def: (p) => [Math.min(1, Math.abs(p.x) / 0.5), 0, 0, Math.sign(p.x) || 1],
  }));
  // 머리지느러미(앞으로 뻗은 두 장, 안쪽은 흰색)
  for (const sx of [-1, 1]) {
    const piv = V(sx * 0.07, 0, 0.2);
    const g = grid(THREE, 8, 6, (th, v, o) => {
      const t = th * Math.PI * 2;
      const w = 0.022 * (1 - 0.4 * v) + 0.003, h = 0.012;
      o.set(piv.x + sx * (0.01 + 0.012 * v) + Math.cos(t) * h * 0.6, Math.sin(t) * w - 0.01 * v, piv.z + 0.11 * v);
    }, { wrapU: true });
    parts.push(paint(THREE, g, { color: (p) => (p.x * sx < piv.x * sx ? C(0xdfe4ea) : BACK), def: [0, 0, 1, sx] }));
  }
  // 입(넓은 어두운 홈)
  const mouth = new THREE.CapsuleGeometry(0.008, 0.11, 3, 6); mouth.rotateZ(Math.PI / 2); mouth.translate(0, -0.004, 0.205);
  parts.push(paint(THREE, mouth, { color: MOUTH, def: [0, 0, 0, 1] }));
  // 눈(머리 양옆)
  for (const sx of [-1, 1]) {
    const e = new THREE.SphereGeometry(0.012, 8, 6); e.translate(sx * 0.085, 0.012, 0.17);
    parts.push(paint(THREE, e, { color: 0x080808, def: [0.17, 0, 0, sx], mat: [1, 0.05] }));
  }
  // 등지느러미(작은 세모)
  const dor = grid(THREE, 6, 2, (th, v, o) => {
    const t = th * Math.PI * 2;
    o.set(Math.cos(t) * 0.006 * (1 - v), 0.03 + 0.04 * v, -0.17 - 0.03 * v + Math.sin(t) * 0.025 * (1 - v));
  }, { wrapU: true });
  parts.push(paint(THREE, dor, { color: BACK, def: [0, 0, 3, 1] }));
  // 꼬리
  const t0 = V(0, 0.01, -0.18), t1 = V(0, 0.0, -0.62);
  parts.push(paint(THREE, tube(THREE, t0, t1, 0.014, 0.003, 6, 8), { color: BACK, def: (p) => [0, Math.min(1, (-0.18 - p.z) / 0.44), 2, 0] }));
  return merge(THREE, parts);
}

/**
 * @param {typeof import('three')} THREE
 * @param {{variant?: 'jelly', detail?: number}} opts
 */
export function build(THREE, opts = {}) {
  const geometry = buildJelly(THREE, Math.max(0.4, Math.min(1, opts.detail ?? 1)));
  const material = { type: 'MeshPhysicalMaterial', params: { roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    sheen: 0.5, sheenColor: new THREE.Color(0xc8e0ff), sheenRoughness: 0.4, side: THREE.DoubleSide }, renderOrder: 0 };
  return {
    id, variant: 'jelly', geometry, material, deform: [DEFORM], shade: [shadePatch('mt-shade', { rim: 0.55, rimPow: 2.4, glow: 0.12 })],
    cpu: {},
    info: { triangles: triCount(geometry), unit: '날개 폭 1', origin: '몸 중심', front: '+Z', up: '+Y' },
  };
}
