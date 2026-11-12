// 푸른자리돔(Chromis viridis) 생성기 — 장식 물고기 떼용(규칙·점수와 무관, render/aqua/school.js가 그린다).
// 모양만 만든다. 몸 규칙·aDef는 clownfish.js와 같다(몸길이 1, 앞 +Z, 원점 = 몸 중심).
// 실제 종과 맞춘 것: 날씬한 몸, 연한 청록 몸빛(등은 푸르고 배는 희게), 깊게 갈라진 꼬리, 큰 무리를 지어 산호 위를 맴돔.
// 떼로 수십 마리가 한 번에 그려지므로 삼각형을 아낀다(젤리풍 약 330개, 로우폴리풍 약 110개).
import { grid, paint, facet, merge, curve1, triCount, shadePatch, fishSwimPatch } from './_kit.js';

export const id = 'chromis';
export const variants = { jelly: '매끈한 젤리풍', lowpoly: '그래픽 로우폴리풍' };

const Z0 = 0.42, ZL = 0.7;
const zAt = (u) => Z0 - ZL * u;
const sAt = (z) => Math.min(1, Math.max(0, 0.5 - z));
const H = curve1([[0, 0], [0.03, 0.05], [0.1, 0.09], [0.3, 0.125], [0.5, 0.12], [0.7, 0.085], [0.85, 0.05], [0.93, 0.04], [1, 0]]);
const hAt = (u) => Math.max(0, H(u));
const bodyPoint = (u, th, o) => { const h = hAt(u), t = th * Math.PI * 2; o.set(h * 0.46 * Math.cos(t), h * Math.sin(t), zAt(u)); };
const DEFORM = fishSwimPatch('chromis-swim', { freq: 10.0, amp: 0.16, wave: 5.0, yaw: 0.07, pecPivot: [0.05, -0.02, 0.2], pecAmp: 0.4, pecFreq: 10.0 });

function colorAt(THREE, p) {
  const C = (h) => new THREE.Color(h);
  const u = (Z0 - p.z) / ZL, h = Math.max(1e-3, hAt(u)), yn = p.y / h;
  if (yn > 0) return C(0x8fe8e2).lerp(C(0x36a9cc), Math.min(1, yn * 1.1));
  return C(0x8fe8e2).lerp(C(0xeefcff), Math.min(1, -yn * 1.2));
}

function parts(THREE, lowpoly) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (h) => new THREE.Color(h);
  const fin = (g, col, def) => (lowpoly ? facet(THREE, g, { faceColor: () => col, def }) : paint(THREE, g, { color: col, def }));
  const out = [];
  const body = lowpoly
    ? grid(THREE, 6, 6, (th, u, o) => bodyPoint(u, th, o), { wrapU: true, vs: [0, 0.06, 0.2, 0.42, 0.66, 0.86, 1] })
    : grid(THREE, 12, 12, (th, u, o) => bodyPoint(u, th, o), { wrapU: true });
  out.push(lowpoly
    ? facet(THREE, body, { faceColor: (c, n) => (n.y > 0.3 ? C(0x3aaed0) : n.y < -0.3 ? C(0xe6fbff) : C(0x86e0e0)), def: (p) => [sAt(p.z), 0, 0, 0] })
    : paint(THREE, body, { color: (p) => colorAt(THREE, p), def: (p) => [sAt(p.z), 0, 0, 0] }));
  // 갈라진 꼬리: 가운데가 깊게 파인 V
  const tail = grid(THREE, lowpoly ? 2 : 6, 1, (t, v, o) => {
    const ph = t * 2 - 1;
    const root = V(0, 0.035 * ph, -0.26), edge = V(0, 0.17 * ph, -0.36 - 0.17 * Math.abs(ph));
    o.copy(root).lerp(edge, v);
  });
  out.push(fin(tail, C(0x7fd6e2), (p) => [sAt(p.z), Math.min(1, Math.max(0, (-0.26 - p.z) / 0.25)), 1, 0]));
  // 등지느러미
  const dorsal = grid(THREE, lowpoly ? 2 : 5, 1, (t, v, o) => {
    const u = 0.22 + 0.5 * t;
    o.set(0, hAt(u) * 0.95 + (0.02 + 0.06 * Math.sin(Math.PI * Math.min(1, t * 1.2))) * v, zAt(u) - 0.04 * v);
  });
  out.push(fin(dorsal, C(0x4fbcd6), (p) => [sAt(p.z), 0.8, 1, 0]));
  // 눈
  for (const sx of [-1, 1]) {
    const e = lowpoly ? new THREE.OctahedronGeometry(0.03, 0) : new THREE.SphereGeometry(0.03, 6, 4);
    e.translate(sx * 0.04, 0.025, 0.33);
    out.push(fin(e, C(0x0d1416), [sAt(0.33), 0, 4, 0]));
  }
  return out;
}

export function build(THREE, opts = {}) {
  const variant = opts.variant === 'lowpoly' ? 'lowpoly' : 'jelly';
  const geometry = merge(THREE, parts(THREE, variant === 'lowpoly'));
  const material = variant === 'lowpoly'
    ? { type: 'MeshStandardMaterial', params: { roughness: 0.5, metalness: 0, flatShading: true, side: THREE.DoubleSide } }
    : { type: 'MeshStandardMaterial', params: { roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide } };
  material.renderOrder = 0;
  const shade = shadePatch(variant === 'lowpoly' ? 'chromis-shade-lowpoly' : 'chromis-shade-jelly',
    variant === 'lowpoly' ? { rim: 0.25, rimPow: 3, glow: 0.08 } : { rim: 0.55, rimPow: 2.5, glow: 0.12 });
  return { id, variant, geometry, material, deform: [DEFORM], shade: [shade], cpu: {},
    info: { triangles: triCount(geometry), unit: '몸길이 1', origin: '몸 중심', front: '+Z', up: '+Y' } };
}
