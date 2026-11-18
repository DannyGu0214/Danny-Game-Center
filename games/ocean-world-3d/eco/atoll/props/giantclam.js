// 대왕조개(자연물, 해저 2×2) — 면 음영. 굵은 물결 주름이 진 두 껍데기가 위로 벌어지고, 사이로 파랑·청록 외투막이 빛난다.
import { lp, merge, jitter, rng, sumTris } from './_kit.js';

export const id = 'giantclam';

function clam(THREE, w, seed, mantleA, mantleB) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  const L = w * 0.42, W = w * 0.24, H = 0.62;
  // 껍데기 한 쪽: 경첩(아래 가운데)에서 위 가장자리로, 가장자리가 물결(주름 5개)
  const valve = (side) => {
    const nu = 20, nv = 6, pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu * 2 - 1, v = j / nv;
      const wave = 0.09 * Math.cos(u * Math.PI * 2.5) * v;          // 주름(가장자리로 갈수록 깊게)
      const x = u * L * Math.sin(v * Math.PI * 0.5 + 0.3);
      const y = 0.05 + v * H * (1 - 0.35 * u * u) + wave * 0.4;
      const z = side * (W * Math.sin(v * Math.PI * 0.75) * (1 - 0.4 * u * u) + wave);
      pos.push(x, y, z);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    return lp(THREE, g, (c, n, f) => {
      const rib = Math.cos((c.x / L) * Math.PI * 2.5);
      return C(0xcfc6ae).lerp(C(0x9a917c), rib > 0.3 ? 0.5 : 0).lerp(C(0xf0eadc), c.y > H * 0.85 ? 0.5 : 0);
    }, [0, 0], true);
  };
  parts.push(valve(1), valve(-1));
  // 외투막: 두 껍데기 사이의 물결진 띠(빛남)
  const nu = 20, pos = [], idx = [];
  for (let j = 0; j <= 2; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu * 2 - 1, t = j / 2;
    const x = u * L * 0.92, y = 0.1 + H * (1 - 0.35 * u * u) * (0.75 + 0.2 * t);
    const z = (t - 0.5) * 2 * W * 0.65 * (1 - 0.4 * u * u) + 0.04 * Math.sin(u * 12 + t * 3);
    pos.push(x, y + 0.04 * Math.sin(u * Math.PI * 5), z);
  }
  for (let j = 0; j < 2; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setIndex(idx);
  parts.push(lp(THREE, m, (c, n, f) => (f % 3 === 0 ? C(0x9ff0ff) : C(mantleA).lerp(C(mantleB), 0.5 + 0.5 * Math.sin(c.x * 14))), [0.05, 0.35], true));
  // 밑동 바위
  const rock = new THREE.IcosahedronGeometry(1, 1); rock.scale(L * 1.1, 0.22, W * 1.8); rock.translate(0, 0, 0); jitter(THREE, rock, 0.05, seed);
  parts.push(lp(THREE, rock, (c, n) => (n.y > 0.5 ? C(0xa89a80) : C(0x7a7060))));
  void r; void V;
  return merge(THREE, parts);
}

export function build(THREE, { w = 2 } = {}) {
  const geometries = { blue: clam(THREE, w, 1, 0x2a6fd6, 0x45e0c8), teal: clam(THREE, w, 2, 0x1aa0a0, 0x7a50d0) };
  return { id, geometries, recipe: [{ g: ['blue', 'teal'] }], info: { triangles: sumTris(geometries), note: '주름 껍데기 2장 + 빛나는 외투막' } };
}
