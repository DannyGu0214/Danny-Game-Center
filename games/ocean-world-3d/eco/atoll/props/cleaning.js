// 청소 정거장(자연물, 해저 4×4) — 면 음영. 위가 평평한 산호 언덕(봄미) 위에 탁자산호·부채산호·해면,
// 언덕 둘레를 맴도는 청소놀래기(파란 바탕에 검은 줄) 몇 마리. 쥐가오리가 위에서 맴도는 자리.
import { lp, merge, jitter, tube, ribbon, rng, sumTris } from './_kit.js';

export const id = 'cleaning';

function station(THREE, w, h, seed) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  const rx = w * 0.45, rz = h * 0.45, H = 1.25;
  // 언덕: 위가 평평한 둔덕
  const g = new THREE.CylinderGeometry(0.62, 1, 1, 12, 3); g.translate(0, 0.5, 0);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const k = 1 + 0.1 * Math.sin(Math.atan2(z, x) * 3 + seed) ;
    P.setXYZ(i, x * rx * k, y * H - 0.1, z * rz * k);
  }
  jitter(THREE, g, 0.09, seed);
  parts.push(lp(THREE, g, (c, n) => {
    if (n.y > 0.8) return C(0xb8b090).lerp(C(0x9ac0a0), Math.sin(c.x * 3 + c.z * 2) > 0 ? 0.4 : 0);
    const enc = Math.sin(c.x * 4.2 + c.y * 3) * Math.sin(c.z * 3.6 - c.y * 2);
    return enc > 0.45 ? C(0xd87aa8) : enc < -0.5 ? C(0xe8b04a) : C(0x9a8a6c);
  }));
  // 탁자산호(납작한 원판 + 기둥)
  {
    const x = -rx * 0.25, z = -rz * 0.2, y = H - 0.1;
    parts.push(lp(THREE, tube(THREE, V(x, y - 0.05, z), V(x, y + 0.35, z), 0.08, 0.06, 5, 1, true), C(0x8ab0a0)));
    const t = new THREE.CylinderGeometry(0.75, 0.6, 0.1, 10); t.translate(x, y + 0.4, z); jitter(THREE, t, 0.04, 3, [1, 0.3, 1]);
    parts.push(lp(THREE, t, (c, n) => (n.y > 0.5 ? C(0xa8e0c8) : C(0x6a9a8a)), [0.1, 0.06]));
  }
  // 부채산호(보라 그물 판, 해류에 흔들림)
  {
    const x = rx * 0.35, z = rz * 0.05, y = H - 0.12;
    const pts = [], ws = [];
    for (let k = 0; k <= 4; k++) { const s = k / 4; pts.push(V(x, y + s * 0.9, z + 0.05 * Math.sin(s * 3))); ws.push(0.08 + 0.42 * Math.sin(Math.min(1, s * 1.2) * Math.PI * 0.85)); }
    const f = ribbon(THREE, pts, ws, V(1, 0, 0.3));
    parts.push(lp(THREE, f, (c, n, i) => (i % 3 ? C(0xa04ac0) : C(0xd27ae0)), (p) => [Math.min(1, (p.y - y) / 0.9), 0.05], true));
  }
  // 둥근 해면·작은 산호
  for (let k = 0; k < 6; k++) {
    const a = r() * 6.28, d = 0.45 + r() * 0.4;
    const b = new THREE.IcosahedronGeometry(0.14 + r() * 0.1, 0);
    b.translate(Math.cos(a) * d * rx * 0.72, H - 0.12 + 0.06, Math.sin(a) * d * rz * 0.72);
    parts.push(lp(THREE, b, C([0xf0a040, 0x50b8e0, 0xe86a8a][k % 3]), [0, 0.06]));
  }
  // 청소놀래기: 언덕 둘레 위에 떠 있는 작은 물고기(파랑 + 검은 줄). 흔들림 값으로 하늘하늘 움직임
  for (let k = 0; k < 4; k++) {
    const a = k * 1.6 + r(), d = 0.75;
    const x = Math.cos(a) * rx * d, z = Math.sin(a) * rz * d, y = H + 0.35 + r() * 0.4;
    const body = new THREE.OctahedronGeometry(0.1, 0); body.scale(0.45, 0.6, 1.6);
    body.rotateY(-a); body.translate(x, y, z);
    parts.push(lp(THREE, body, (c, n) => (Math.abs(n.y) < 0.3 ? C(0x101820) : C(0x3aa8f0)), [0.9, 0.12]));
    const tail = new THREE.ConeGeometry(0.06, 0.1, 3); tail.rotateX(Math.PI / 2); tail.translate(0, 0, -0.18); tail.rotateY(-a); tail.translate(x, y, z);
    parts.push(lp(THREE, tail, C(0x101820), [1, 0.05]));
  }
  return merge(THREE, parts);
}

export function build(THREE, { w = 4, h = 4 } = {}) {
  const geometries = { a: station(THREE, w, h, 4), b: station(THREE, w, h, 5) };
  return { id, geometries, recipe: [{ g: ['a', 'b'] }], info: { triangles: sumTris(geometries), note: '평평한 산호 언덕 + 탁자산호·부채산호 + 청소놀래기' } };
}
