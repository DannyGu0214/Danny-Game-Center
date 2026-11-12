// 소라껍데기 상자(인공물, 육지 2×2) — 면 음영. 빈 껍데기를 모아 두는 나무 상자(널빤지 사이 틈), 비스듬히 걸친 뚜껑,
// 상자 안과 옆에 쌓인 크고 작은 소라껍데기(소라게가 이사할 집).
import { lp, merge, rng, sumTris } from './_kit.js';

export const id = 'shellbox';

function conch(THREE, parts, x, y, z, s, rot, col) {
  const C = (c) => new THREE.Color(c);
  const g = new THREE.ConeGeometry(0.16 * s, 0.38 * s, 7, 3);
  // 층마다 비틀어 나선처럼
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const yy = P.getY(i), t = (yy / (0.38 * s) + 0.5) * 2.5;
    const xx = P.getX(i), zz = P.getZ(i), c = Math.cos(t), sn = Math.sin(t);
    P.setXYZ(i, xx * c - zz * sn, yy, xx * sn + zz * c);
  }
  g.rotateZ(Math.PI / 2 - 0.3); g.rotateY(rot); g.translate(x, y + 0.1 * s, z);
  parts.push(lp(THREE, g, (c, n, f) => (f % 3 === 0 ? C(col).lerp(C(0x7a4a2a), 0.5) : C(col))));
  const lip = new THREE.CircleGeometry(0.12 * s, 7); lip.rotateY(Math.PI / 2); lip.rotateY(rot); lip.translate(x + Math.cos(-rot) * 0.18 * s, y + 0.1 * s, z + Math.sin(-rot) * 0.18 * s);
  parts.push(lp(THREE, lip, C(0xf2a8a0), [0, 0], true));
}

function box(THREE, w, seed) {
  const r = rng(seed), C = (c) => new THREE.Color(c);
  const parts = [];
  const W = w * 0.62, D = w * 0.46, H = 0.62;
  // 널빤지 벽(네 면, 가로 널 3장씩)
  for (let k = 0; k < 3; k++) {
    const y = 0.04 + k * 0.2;
    for (const [sx, sz, lw, ld] of [[0, D / 2, W, 0.05], [0, -D / 2, W, 0.05], [W / 2, 0, 0.05, D], [-W / 2, 0, 0.05, D]]) {
      const b = new THREE.BoxGeometry(lw, 0.16, ld); b.translate(sx, y + 0.08, sz);
      parts.push(lp(THREE, b, C(k % 2 ? 0xc89a62 : 0xb5844e).lerp(C(0x8a6038), r() * 0.3)));
    }
  }
  const floor = new THREE.BoxGeometry(W, 0.05, D); floor.translate(0, 0.03, 0); parts.push(lp(THREE, floor, C(0x8a6038)));
  // 모서리 기둥
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = new THREE.BoxGeometry(0.08, H, 0.08); p.translate(sx * W / 2, H / 2, sz * D / 2); parts.push(lp(THREE, p, C(0x7a5232)));
  }
  // 뚜껑(뒤쪽에 비스듬히 기댐)
  const lid = new THREE.BoxGeometry(W * 1.04, 0.06, D * 0.9); lid.rotateX(-1.1); lid.translate(0, H + 0.12, -D / 2 - 0.2);
  parts.push(lp(THREE, lid, C(0xa8784a)));
  // 껍데기: 상자 안 더미 + 앞 모래 위
  const cols = [0xf4e2c4, 0xe8c8a0, 0xf6d6c0, 0xd8b088];
  for (let k = 0; k < 6; k++) conch(THREE, parts, (r() - 0.5) * W * 0.7, H - 0.12 + r() * 0.12, (r() - 0.5) * D * 0.6, 0.8 + r() * 0.5, r() * 6.28, cols[k % 4]);
  for (let k = 0; k < 3; k++) conch(THREE, parts, (r() - 0.5) * W, 0, D / 2 + 0.2 + r() * 0.2, 0.9 + r() * 0.6, r() * 6.28, cols[(k + 1) % 4]);
  return merge(THREE, parts);
}

export function build(THREE, { w = 2 } = {}) {
  const geometries = { a: box(THREE, w, 3) };
  return { id, geometries, recipe: [{ g: 'a' }], info: { triangles: sumTris(geometries), note: '널빤지 상자 + 기댄 뚜껑 + 소라껍데기 9개' } };
}
