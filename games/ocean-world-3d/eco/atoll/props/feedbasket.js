// 먹이 바구니(인공물, 해저 2×2) — 면 음영. 엮은 대나무 바구니(띠가 번갈아 진하고 연함) 두 개와 둥근 손잡이,
// 바구니 위로 소복한 먹이 알갱이, 바구니를 묶은 밧줄과 작은 돌 추.
import { lp, merge, tube, rng, sumTris } from './_kit.js';

export const id = 'feedbasket';

function basket(THREE, parts, x, z, R, H, seed) {
  const r = rng(seed), V = (a, b, c) => new THREE.Vector3(a, b, c), C = (c) => new THREE.Color(c);
  const body = new THREE.CylinderGeometry(R, R * 0.78, H, 12, 4, true); body.translate(x, H / 2, z);
  parts.push(lp(THREE, body, (c, n, f) => {
    const row = Math.floor((c.y / H) * 4), col = Math.floor((Math.atan2(c.z - z, c.x - x) + Math.PI) / (Math.PI * 2) * 12);
    return (row + col) % 2 ? C(0xb98a52) : C(0x8e6436);
  }, [0, 0], true));
  const rim = new THREE.TorusGeometry(R, 0.05, 4, 12); rim.rotateX(Math.PI / 2); rim.translate(x, H, z);
  parts.push(lp(THREE, rim, C(0x7a5430)));
  const bottom = new THREE.CircleGeometry(R * 0.78, 12); bottom.rotateX(-Math.PI / 2); bottom.translate(x, 0.02, z);
  parts.push(lp(THREE, bottom, C(0x6a4a2a)));
  // 먹이(둥근 더미 + 알갱이)
  const food = new THREE.SphereGeometry(R * 0.92, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2); food.scale(1, 0.4, 1); food.translate(x, H - 0.05, z);
  parts.push(lp(THREE, food, (c, n, f) => (f % 3 ? C(0xe8b860) : C(0xc89040)), [0, 0.06]));
  for (let k = 0; k < 6; k++) {
    const p = new THREE.IcosahedronGeometry(0.05, 0), a = r() * 6.28, d = r() * R * 0.7;
    p.translate(x + Math.cos(a) * d, H + 0.1 + r() * 0.1, z + Math.sin(a) * d);
    parts.push(lp(THREE, p, k % 2 ? C(0xa8d060) : C(0xf2d080), [0, 0.1]));
  }
  // 손잡이 반원
  const handle = new THREE.TorusGeometry(R * 0.85, 0.035, 4, 10, Math.PI); handle.translate(x, H, z); handle.rotateY(r() * 0.6);
  parts.push(lp(THREE, handle, C(0x8e6436)));
  void V;
}

function build1(THREE, w, h, seed) {
  const parts = [], C = (c) => new THREE.Color(c), V = (a, b, c) => new THREE.Vector3(a, b, c);
  const s = w / 2;
  basket(THREE, parts, -0.32 * s, -0.15 * s, 0.5 * s, 0.55 * s, seed);
  basket(THREE, parts, 0.45 * s, 0.35 * s, 0.34 * s, 0.4 * s, seed + 3);
  // 밧줄과 돌 추
  parts.push(lp(THREE, tube(THREE, V(-0.32 * s, 0.3, -0.15 * s - 0.5 * s), V(-0.1 * s, 0.03, -0.85 * s), 0.025, 0.025, 4, 1, true), C(0xe8dcc0)));
  const stone = new THREE.DodecahedronGeometry(0.13, 0); stone.translate(-0.08 * s, 0.08, -0.86 * s);
  parts.push(lp(THREE, stone, C(0x8a8478)));
  void h;
  return merge(THREE, parts);
}

export function build(THREE, { w = 2, h = 2 } = {}) {
  const geometries = { a: build1(THREE, w, h, 1) };
  return { id, geometries, recipe: [{ g: 'a' }], info: { triangles: sumTris(geometries), note: '엮은 바구니 2 + 먹이 더미 + 돌 추' } };
}
