// 덩어리산호 바위(자연물, 해저 4×4, 키 높음) — 면 음영. 뇌산호처럼 홈이 진 큰 둥근 바위, 앞쪽의 어두운 굴(문어 집),
// 위에 붙은 작은 산호 몇 개. 발자국을 거의 채우는 크기.
import { lp, merge, jitter, tube, rng, sumTris } from './_kit.js';

export const id = 'boulder';

function boulder(THREE, w, h, seed) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  const rx = w * 0.46, rz = h * 0.44, H = 1.75;
  const g = new THREE.IcosahedronGeometry(1, 3);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const v = V(P.getX(i), P.getY(i), P.getZ(i));
    const k = 1 + 0.1 * Math.sin(v.x * 4 + seed) * Math.sin(v.z * 3.3 - seed) + 0.06 * Math.sin(v.y * 6 + v.x * 2);
    v.multiplyScalar(k);
    // 굴: 앞쪽(+z) 아래를 오목하게
    const cave = Math.max(0, v.z - 0.6) * Math.max(0, 0.22 - Math.abs(v.y + 0.1)) * Math.max(0, 0.3 - Math.abs(v.x));
    v.z -= cave * 9;
    P.setXYZ(i, v.x * rx, Math.max(-0.15, v.y * H * 0.55 + H * 0.45), v.z * rz);
  }
  jitter(THREE, g, 0.06, seed);
  parts.push(lp(THREE, g, (c, n) => {
    // 뇌산호 홈(물결 줄무늬) + 위는 밝게
    const groove = Math.sin(c.x * 5.5 + Math.sin(c.z * 3) * 1.6) * Math.sin(c.z * 5 - c.y * 2);
    const base = C(0xc8a05a).lerp(C(0xe6c88a), n.y > 0.5 ? 0.4 : 0);
    if (c.z > rz * 0.5 && c.y > H * 0.08 && c.y < H * 0.38 && Math.abs(c.x) < rx * 0.26) return C(0x3a3028);   // 굴 안쪽
    return groove > 0.3 ? base.clone().lerp(C(0x8a6a3a), 0.5) : base;
  }));
  // 위에 붙은 작은 산호(뿔·공)
  for (let k = 0; k < 5; k++) {
    const a = r() * 6.28, d = 0.25 + r() * 0.45;
    const x = Math.cos(a) * d * rx, z = Math.sin(a) * d * rz, y = H * (0.95 - d * d * 0.55);
    if (k % 2) {
      const b = new THREE.IcosahedronGeometry(0.16 + r() * 0.1, 0); b.translate(x, y + 0.08, z);
      parts.push(lp(THREE, b, C([0xe86aa0, 0x7ac0e0, 0xf0c040][k % 3]), [0, 0.08]));
    } else {
      for (let j = 0; j < 3; j++) {
        const t0 = V(x, y - 0.05, z), t1 = V(x + (r() - 0.5) * 0.3, y + 0.3 + r() * 0.2, z + (r() - 0.5) * 0.3);
        parts.push(lp(THREE, tube(THREE, t0, t1, 0.05, 0.03, 5, 1, true), C(0x9ae0c0), [0.3, 0.06]));
      }
    }
  }
  // 바닥의 부서진 산호 조각
  for (let k = 0; k < 4; k++) {
    const p = new THREE.IcosahedronGeometry(0.12 + r() * 0.1, 0); p.scale(1, 0.6, 1);
    const a = r() * 6.28; p.translate(Math.cos(a) * rx * 1.02, 0.02, Math.sin(a) * rz * 1.02);
    parts.push(lp(THREE, p, C(0xd8ccb0)));
  }
  return merge(THREE, parts);
}

export function build(THREE, { w = 4, h = 4 } = {}) {
  const geometries = { a: boulder(THREE, w, h, 1), b: boulder(THREE, w, h, 2) };
  return { id, geometries, recipe: [{ g: ['a', 'b'] }], info: { triangles: sumTris(geometries), note: '홈 진 큰 바위 + 앞쪽 굴 + 작은 산호' } };
}
