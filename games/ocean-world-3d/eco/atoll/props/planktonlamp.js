// 플랑크톤 등(인공물, 수중 2×2) — 면 음영. 밤에 빛으로 플랑크톤을 모으는 등: 육각 철제 틀 안에서 빛나는 하늘색 심지,
// 위아래 뚜껑과 손잡이 고리, 둘레를 떠도는 작은 빛 알갱이(플랑크톤). 밧줄이 바닥 닻으로 이어짐.
import { lp, merge, tube, rng, sumTris } from './_kit.js';
import { anchorBlock, rope } from './_mooring.js';

export const id = 'planktonlamp';

function lamp(THREE, w, seed) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [], s = w / 2;
  const R = 0.32 * s, H = 0.62 * s;
  const core = new THREE.IcosahedronGeometry(R * 0.78, 1); core.scale(1, 1.25, 1);
  parts.push(lp(THREE, core, (c, n, f) => (f % 4 === 0 ? C(0xe8ffff) : C(0x9ff0ff)), [0, 1.6]));
  const FR = C(0x3a4248);
  for (const y of [-H / 2, H / 2]) {
    const cap = new THREE.CylinderGeometry(R * (y > 0 ? 0.7 : 0.9), R * (y > 0 ? 1.05 : 0.7), 0.1, 6); cap.translate(0, y + (y > 0 ? 0.04 : -0.04), 0);
    parts.push(lp(THREE, cap, FR));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(lp(THREE, tube(THREE, V(Math.cos(a) * R, -H / 2, Math.sin(a) * R), V(Math.cos(a) * R, H / 2, Math.sin(a) * R), 0.022, 0.022, 4, 1, true), FR));
  }
  const ring = new THREE.TorusGeometry(0.09, 0.02, 4, 8); ring.translate(0, H / 2 + 0.16, 0);
  parts.push(lp(THREE, ring, FR));
  // 빛 알갱이
  for (let k = 0; k < 10; k++) {
    const a = r() * 6.28, d = R * (1.4 + r() * 1.2), y = (r() - 0.5) * H * 1.6;
    const p = new THREE.OctahedronGeometry(0.035, 0); p.translate(Math.cos(a) * d, y, Math.sin(a) * d);
    parts.push(lp(THREE, p, C(0xd8ffb0), [0.9, 1.3]));
  }
  return merge(THREE, parts);
}

export function build(THREE, { w = 2 } = {}) {
  const geometries = { anchor: anchorBlock(THREE), rope: rope(THREE), lamp: lamp(THREE, w, 6) };
  const recipe = [{ g: 'anchor' }, { g: 'rope', up: 'item' }, { g: 'lamp', at: 'item' }];
  return { id, geometries, recipe, info: { triangles: sumTris(geometries), note: '육각 틀 등 + 빛나는 심지 + 빛 알갱이 + 밧줄·닻' } };
}
