// 그늘 오두막(인공물, 육지 2×2) — 면 음영. 관람객 쉼터: 낮은 나무 마루, 기둥 네 개, 겹겹이 처진 초가 지붕(야자잎 이엉),
// 반쯤 열린 앞쪽과 나무 의자, 뒤쪽 벽.
import { lp, merge, jitter, rng, sumTris } from './_kit.js';

export const id = 'hut';

function hut(THREE, w, seed) {
  const r = rng(seed), C = (c) => new THREE.Color(c);
  const parts = [], s = w / 2;
  const W = 1.7 * s, D = 1.5 * s;
  // 마루(살짝 띄움)
  const deck = new THREE.BoxGeometry(W, 0.16, D); deck.translate(0, 0.12, 0);
  parts.push(lp(THREE, deck, (c, n, f) => (n.y > 0.5 ? (Math.floor((c.x + W) * 4) % 2 ? C(0xb88a58) : C(0xa57a4c)) : C(0x7a5632))));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.BoxGeometry(0.12, 0.2, 0.12); leg.translate(sx * W * 0.44, 0.02, sz * D * 0.44); parts.push(lp(THREE, leg, C(0x6a4a2a)));
    const post = new THREE.CylinderGeometry(0.06, 0.07, 1.25, 5); post.translate(sx * W * 0.42, 0.82, sz * D * 0.42); parts.push(lp(THREE, post, C(0x8a6038)));
  }
  // 뒷벽(엮은 무늬)
  const wall = new THREE.BoxGeometry(W * 0.86, 1.05, 0.06); wall.translate(0, 0.72, -D * 0.42);
  parts.push(lp(THREE, wall, (c, n, f) => (Math.floor(c.y * 6 + c.x * 3) % 2 ? C(0xd8b98a) : C(0xc4a272))));
  // 의자
  const bench = new THREE.BoxGeometry(W * 0.6, 0.06, 0.28); bench.translate(0, 0.48, -D * 0.22); parts.push(lp(THREE, bench, C(0x9a6a3a)));
  for (const sx of [-1, 1]) { const l = new THREE.BoxGeometry(0.06, 0.26, 0.24); l.translate(sx * W * 0.26, 0.33, -D * 0.22); parts.push(lp(THREE, l, C(0x7a5232))); }
  // 초가 지붕: 아래 처마가 넓은 네모뿔 두 겹 + 꼭대기 묶음
  for (const [y, R, Hh, col] of [[1.42, 1.35 * s, 0.75, 0xc79a4f], [1.85, 0.95 * s, 0.6, 0xd8ae5e]]) {
    const roof = new THREE.ConeGeometry(R, Hh, 4, 2, true); roof.rotateY(Math.PI / 4); roof.scale(W / (1.7 * s), 1, D / (1.5 * s));
    roof.translate(0, y + Hh / 2, 0); jitter(THREE, roof, 0.04, seed + y * 10, [1, 0.6, 1]);
    parts.push(lp(THREE, roof, (c, n, f) => C(col).lerp(C(0x9a7438), f % 3 === 0 ? 0.35 : 0), [0, 0], true));
  }
  const knot = new THREE.ConeGeometry(0.12, 0.3, 5); knot.translate(0, 2.55, 0); parts.push(lp(THREE, knot, C(0x8a6a30)));
  // 처마 끝 늘어진 이엉 술
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, rr = 1.32 * s * 0.92;
    const t = new THREE.ConeGeometry(0.06, 0.22, 3); t.rotateX(Math.PI); t.translate(Math.cos(a) * rr * (W / (1.7 * s)), 1.36, Math.sin(a) * rr * (D / (1.5 * s)));
    parts.push(lp(THREE, t, C(0xb88a42), [0.4, 0]));
  }
  void r;
  return merge(THREE, parts);
}

export function build(THREE, { w = 2 } = {}) {
  const geometries = { a: hut(THREE, w, 2) };
  return { id, geometries, recipe: [{ g: 'a' }], info: { triangles: sumTris(geometries), note: '마루 + 기둥 4 + 두 겹 초가 지붕 + 의자·뒷벽' } };
}
