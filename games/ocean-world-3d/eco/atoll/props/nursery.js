// 산호 묘목 줄(인공물, 수중·중층/저층 2×2) — 면 음영. 물속에 띄워 산호를 기르는 틀: 흰 관으로 짠 네모 틀에
// 줄이 여러 가닥 걸리고 줄마다 알록달록한 산호 조각이 매달림. 위의 작은 노란 부이가 틀을 띄우고, 밧줄이 바닥 닻으로 이어짐.
import { lp, merge, tube, rng, sumTris } from './_kit.js';
import { anchorBlock, rope } from './_mooring.js';

export const id = 'nursery';

function frame(THREE, w, seed) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  const X = w * 0.45, Z = w * 0.32;
  const PIPE = C(0xeeeae0);
  // 네모 틀(위 가로대 두 개 + 세로 연결)
  for (const z of [-Z, Z]) parts.push(lp(THREE, tube(THREE, V(-X, 0, z), V(X, 0, z), 0.045, 0.045, 5, 1), PIPE));
  for (const x of [-X, X]) parts.push(lp(THREE, tube(THREE, V(x, 0, -Z), V(x, 0, Z), 0.045, 0.045, 5, 1), PIPE));
  // 매단 줄 4가닥 × 산호 조각 3개
  const cols = [0xf08aa0, 0xf2b05a, 0x9a7ae0, 0x6ad0b0, 0xf06a5a];
  for (let i = 0; i < 4; i++) {
    const x = -X + (i + 0.5) * (2 * X / 4);
    parts.push(lp(THREE, tube(THREE, V(x, 0, -Z), V(x, -0.05, Z), 0.012, 0.012, 3, 1, true), C(0xd8d0c0)));
    for (let k = 0; k < 3; k++) {
      const z = -Z + (k + 0.5) * (2 * Z / 3);
      parts.push(lp(THREE, tube(THREE, V(x, -0.02, z), V(x, -0.2, z), 0.008, 0.008, 3, 1, true), C(0xd8d0c0)));
      // 산호 조각: 작은 가지 몇 개
      const col = C(cols[(i * 3 + k) % cols.length]);
      for (let b = 0; b < 3; b++) {
        const a = r() * 6.28;
        const t0 = V(x, -0.22, z), t1 = V(x + Math.cos(a) * 0.15, -0.22 - 0.06 + (r() - 0.3) * 0.26, z + Math.sin(a) * 0.15);
        parts.push(lp(THREE, tube(THREE, t0, t1, 0.05, 0.03, 4, 1), col, [0.35, 0.15]));
      }
    }
  }
  // 띄우는 부이(가운데 위)
  const fl = new THREE.IcosahedronGeometry(0.17, 0); fl.translate(0, 0.28, 0);
  parts.push(lp(THREE, fl, C(0xffc640), [0.1, 0.1]));
  parts.push(lp(THREE, tube(THREE, V(0, 0, 0), V(0, 0.2, 0), 0.015, 0.015, 3, 1, true), C(0xd8d0c0)));
  return merge(THREE, parts);
}

export function build(THREE, { w = 2 } = {}) {
  const geometries = { anchor: anchorBlock(THREE), rope: rope(THREE), frame: frame(THREE, w, 5) };
  const recipe = [{ g: 'anchor' }, { g: 'rope', up: 'item' }, { g: 'frame', at: 'item' }];
  return { id, geometries, recipe, info: { triangles: sumTris(geometries), note: '관 틀 + 줄 4가닥 × 산호 조각 3 + 부이 + 밧줄·닻' } };
}
