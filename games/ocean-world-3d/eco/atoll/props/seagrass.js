// 해초밭(자연물, 해저 4×4, 생물이 위를 다님) — 면 음영. 거북말(Thalassia)처럼 끈 모양 잎 덤불 다섯 개가 발자국을 채운다.
// 덤불마다 따로 지형에 얹으려고 조각을 나눈다(4×4 안에서도 바닥이 기울 수 있음).
import { lp, merge, ribbon, rng, sumTris } from './_kit.js';

export const id = 'seagrass';

function clump(THREE, seed, R, n) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  // 모래 바닥 얼룩(잎 사이로 보이는 진한 바닥)
  const pad = new THREE.CircleGeometry(R * 1.05, 9); pad.rotateX(-Math.PI / 2); pad.translate(0, 0.02, 0);
  parts.push(lp(THREE, pad, (c, nn, f) => (f % 2 ? C(0xc8b88a) : C(0xb8a878))));
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * R;
    const base = V(Math.cos(a) * d, 0, Math.sin(a) * d);
    const L = 0.55 + r() * 0.65, bend = (r() - 0.5) * 0.5, ba = r() * 6.28;
    const bd = V(Math.cos(ba), 0, Math.sin(ba));
    const pts = [], ws = [];
    for (let k = 0; k <= 4; k++) {
      const s = k / 4;
      pts.push(base.clone().add(V(0, L * s, 0)).addScaledVector(bd, bend * s * s));
      ws.push(k === 4 ? 0.015 : 0.055);
    }
    const g = ribbon(THREE, pts, ws, V(-bd.z, 0, bd.x));
    const col = C(0x3f8a3a).lerp(C(0x6fb04a), r() * 0.6);
    parts.push(lp(THREE, g, (c) => col.clone().lerp(C(0xa8d878), Math.min(1, c.y / 1.2) * 0.6), (p) => [Math.min(1, p.y / 1.15), 0], true));
  }
  return merge(THREE, parts);
}

export function build(THREE, { w = 4, h = 4 } = {}) {
  const geometries = { a: clump(THREE, 3, 1.05, 30), b: clump(THREE, 4, 1.05, 30), c: clump(THREE, 5, 0.85, 22) };
  const ox = w / 4, oz = h / 4;
  const recipe = [
    { g: ['a', 'b'], dx: -ox, dy: -oz }, { g: ['b', 'a'], dx: ox, dy: -oz },
    { g: ['b', 'c'], dx: -ox, dy: oz }, { g: ['a', 'c'], dx: ox, dy: oz },
    { g: 'c', s: 0.9, yaw: 1.3 },
  ];
  return { id, geometries, recipe, info: { triangles: sumTris(geometries), note: '끈 잎 덤불 5개(조각마다 지형에 얹음)' } };
}
