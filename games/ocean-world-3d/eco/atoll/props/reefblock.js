// 인공 어초(인공물, 해저 2×2) — 면 음영. 구멍이 숭숭 뚫린 콘크리트 반구(리프볼) 셋, 표면에 붙은 작은 산호와 이끼빛.
import { lp, merge, rng, sumTris } from './_kit.js';

export const id = 'reefblock';

function ball(THREE, parts, x, z, R, seed) {
  const r = rng(seed), C = (c) => new THREE.Color(c);
  const g = new THREE.SphereGeometry(R, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); g.translate(x, -R * 0.12, z);
  // 구멍 자리(바깥에서 본 방향 몇 개)
  const holes = Array.from({ length: 4 }, (_, i) => { const a = i * 1.05 + r() * 0.4, e = 0.25 + r() * 0.5; return new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); });
  parts.push(lp(THREE, g, (c, n) => {
    const d = c.clone().sub(new THREE.Vector3(x, -R * 0.12, z)).normalize();
    for (const h of holes) if (d.dot(h) > 0.96) return C(0x6a665e);
    const moss = Math.sin(c.x * 9 + c.y * 7) * Math.sin(c.z * 8 - c.y * 5);
    return moss > 0.7 ? C(0xa8c098) : n.y > 0.6 ? C(0xdcd6c8) : C(0xc4beb2);
  }));
  // 붙은 산호(작은 공·뿔)
  for (let k = 0; k < 3; k++) {
    const a = r() * 6.28, e = 0.4 + r() * 0.8;
    const p = new THREE.Vector3(x + Math.cos(a) * Math.cos(e) * R, -R * 0.12 + Math.sin(e) * R, z + Math.sin(a) * Math.cos(e) * R);
    const b = new THREE.IcosahedronGeometry(0.07 + r() * 0.06, 0); b.translate(p.x, p.y, p.z);
    parts.push(lp(THREE, b, C([0xf08aa0, 0xf2c050, 0x8ad0e0][k % 3]), [0, 0.08]));
  }
}

function reef(THREE, w, seed) {
  const parts = [], s = w / 2;
  ball(THREE, parts, -0.3 * s, -0.25 * s, 0.68 * s, seed);
  ball(THREE, parts, 0.45 * s, -0.1 * s, 0.52 * s, seed + 1);
  ball(THREE, parts, 0.0 * s, 0.5 * s, 0.46 * s, seed + 2);
  return merge(THREE, parts);
}

export function build(THREE, { w = 2 } = {}) {
  const geometries = { a: reef(THREE, w, 4), b: reef(THREE, w, 9) };
  return { id, geometries, recipe: [{ g: ['a', 'b'] }], info: { triangles: sumTris(geometries), note: '구멍 뚫린 콘크리트 반구 3 + 붙은 산호' } };
}
