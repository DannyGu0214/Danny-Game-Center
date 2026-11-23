// 석호 모래밭(자연물, 해저 2×2, 생물이 위를 다님) — 면 음영. 낮게 쌓인 흰 모래 둔덕과 물결 자국, 조개껍데기·불가사리·자갈.
import { lp, merge, jitter, rng, sumTris } from './_kit.js';

export const id = 'lagoonsand';

function sand(THREE, w, h, seed) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  const rx = w * 0.47, rz = h * 0.47;
  // 둔덕: 가장자리가 지형에 묻히도록 아래로 내려감
  const g = new THREE.CircleGeometry(1, 14, 0, Math.PI * 2);
  // 원판을 고리 몇 겹으로 다시 나눠 높이를 준다
  const pos = [], idx = [], rings = 4, seg = 16;
  pos.push(0, 0.28, 0);
  for (let j = 1; j <= rings; j++) for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2, t = j / rings;
    const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5 + seed * 2);
    const y = 0.28 * (1 - t * t) - (j === rings ? 0.1 : 0) + 0.03 * Math.sin(a * 7 + t * 9);
    pos.push(Math.cos(a) * rx * t * wob, y, Math.sin(a) * rz * t * wob);
  }
  for (let i = 0; i < seg; i++) idx.push(0, 1 + ((i + 1) % seg), 1 + i);
  for (let j = 0; j < rings - 1; j++) for (let i = 0; i < seg; i++) {
    const a = 1 + j * seg + i, b = 1 + j * seg + ((i + 1) % seg), c = a + seg, d = b + seg;
    idx.push(a, b, c, b, d, c);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.deleteAttribute('normal'); g.deleteAttribute('uv');
  jitter(THREE, g, 0.03, seed, [1, 0.5, 1]);
  parts.push(lp(THREE, g, (c, n) => {
    const ripple = Math.sin(c.x * 6 + c.z * 2.5 + seed);
    // 흰 모래 + 진한 물결 자국(주변 지형 모래와 구분되게 대비를 줌)
    return C(0xfff6e0).lerp(C(0xc8aa78), ripple > 0.45 ? 0.6 : 0).lerp(C(0xe6d2a8), n.y < 0.9 ? 0.5 : 0);
  }));
  // 조개(부채 모양) 2~3개
  for (let k = 0; k < 3; k++) {
    const s = new THREE.ConeGeometry(0.11, 0.05, 7, 1); s.rotateX(Math.PI * 0.08);
    const a = r() * 6.28, d = 0.3 + r() * 0.35;
    s.rotateY(r() * 6.28); s.translate(Math.cos(a) * d * rx, 0.16 - d * 0.12, Math.sin(a) * d * rz);
    parts.push(lp(THREE, s, (c, n, f) => (f % 2 ? C(0xf6c8b0) : C(0xe89a88))));
  }
  // 불가사리(주황 다섯 팔)
  {
    const a = r() * 6.28, d = 0.35;
    const cx = Math.cos(a) * d * rx, cz = Math.sin(a) * d * rz, rot = r() * 6.28;
    const pts = [];
    for (let i = 0; i < 10; i++) { const t = rot + (i / 10) * Math.PI * 2, R = i % 2 ? 0.07 : 0.2; pts.push(new THREE.Vector2(Math.cos(t) * R, Math.sin(t) * R)); }
    const star = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.04, bevelEnabled: false });
    star.rotateX(-Math.PI / 2); star.translate(cx, 0.15, cz);
    parts.push(lp(THREE, star, (c, n) => (n.y > 0.5 ? C(0xf2783a) : C(0xc8502a))));
  }
  // 자갈·산호 부스러기(가장자리를 둘러 발자국을 드러냄)
  for (let k = 0; k < 14; k++) {
    const p = new THREE.IcosahedronGeometry(0.05 + r() * 0.05, 0); p.scale(1, 0.6, 1);
    const a = (k / 14) * 6.28 + r() * 0.3, d = k < 10 ? 0.88 + r() * 0.1 : 0.2 + r() * 0.5;
    p.translate(Math.cos(a) * d * rx, 0.28 * (1 - d * d) - 0.01, Math.sin(a) * d * rz);
    parts.push(lp(THREE, p, k % 3 ? C(0xb8ac98).lerp(C(0xe6dccb), r()) : C(0xf2b8c0)));
  }
  void V;
  return merge(THREE, parts);
}

export function build(THREE, { w = 2, h = 2 } = {}) {
  const geometries = { a: sand(THREE, w, h, 3), b: sand(THREE, w, h, 8) };
  return { id, geometries, recipe: [{ g: ['a', 'b'] }], info: { triangles: sumTris(geometries), note: '모래 둔덕 + 조개·불가사리·자갈' } };
}
