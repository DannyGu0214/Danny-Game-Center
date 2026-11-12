// 가지산호 군락(자연물, 해저 2×2) — 면 음영. 사슴뿔산호처럼 갈라지는 가지 덩이 세 개, 가지 끝은 밝고 살짝 빛남.
// 색 세 가지(분홍·보라·주황)를 물건마다 하나 고른다.
import { lp, merge, tube, jitter, rng, sumTris } from './_kit.js';

export const id = 'branchcoral';

function colony(THREE, parts, r, ox, oz, scale, base, tip) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const grow = (a, dir, len, rad, depth) => {
    const b = a.clone().addScaledVector(dir, len);
    parts.push(lp(THREE, tube(THREE, a, b, rad, rad * 0.78, depth >= 2 ? 4 : 5, 1, true), C(base).lerp(C(tip), depth * 0.18), (p) => [Math.min(1, (p.y / (1.4 * scale)) ** 2), 0]));
    if (depth >= 3) {
      const t = new THREE.IcosahedronGeometry(rad * 1.05, 0); t.translate(b.x, b.y, b.z);
      parts.push(lp(THREE, t, C(tip), [Math.min(1, (b.y / (1.4 * scale)) ** 2), 0.18]));
      return;
    }
    const n = 2 + (r() > 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(V((r() - 0.5) * 1.3, 0.35, (r() - 0.5) * 1.3)).normalize();
      grow(b, d, len * (0.72 + r() * 0.15), rad * 0.74, depth + 1);
    }
  };
  for (let k = 0; k < 2; k++) {
    const d0 = V((r() - 0.5) * 0.5, 1, (r() - 0.5) * 0.5).normalize();
    grow(V(ox, -0.05, oz), d0, 0.42 * scale, 0.11 * scale, 0);
  }
  // 밑동 바위
  const rock = new THREE.IcosahedronGeometry(0.22 * scale, 0); rock.scale(1.3, 0.55, 1.2); rock.translate(ox, 0.02, oz); jitter(THREE, rock, 0.03, 9);
  parts.push(lp(THREE, rock, (c, n) => (n.y > 0.5 ? C(0xb2a690) : C(0x8e846f))));
}

function coral(THREE, w, h, seed, base, tip) {
  const r = rng(seed), parts = [];
  const sx = w / 2, sz = h / 2;
  colony(THREE, parts, r, -0.32 * sx, -0.18 * sz, 1.15, base, tip);
  colony(THREE, parts, r, 0.4 * sx, 0.1 * sz, 0.9, base, tip);
  colony(THREE, parts, r, -0.05 * sx, 0.45 * sz, 0.7, base, tip);
  return merge(THREE, parts);
}

export function build(THREE, { w = 2, h = 2 } = {}) {
  const geometries = {
    pink: coral(THREE, w, h, 7, 0xd85a8a, 0xffc0d8),
    purple: coral(THREE, w, h, 8, 0x8a5ad8, 0xd8c0ff),
    orange: coral(THREE, w, h, 9, 0xe8803a, 0xffd8a0),
  };
  return { id, geometries, recipe: [{ g: ['pink', 'purple', 'orange'] }], info: { triangles: sumTris(geometries), note: '가지 덩이 3 + 밑동 바위, 3색' } };
}
