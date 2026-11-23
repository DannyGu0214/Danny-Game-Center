// 야자수(자연물, 육지 2×2) — 면 음영. 바다 쪽으로 휜 마디진 줄기, 접힌 깃꼴 잎 9장, 코코넛 송이, 뿌리 둔덕.
import { lp, merge, tube, ribbon, jitter, rng, sumTris } from './_kit.js';

export const id = 'palm';

function palm(THREE, w, seed) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  const H = 3.4 + r() * 0.9, lean = 0.5 + r() * 0.6, la = r() * 6.28;
  const ld = V(Math.cos(la), 0, Math.sin(la));
  const at = (s) => V(0, s * H, 0).addScaledVector(ld, lean * s * s);
  // 뿌리 둔덕
  const mound = new THREE.ConeGeometry(0.42, 0.28, 7, 1); mound.translate(0, 0.08, 0); jitter(THREE, mound, 0.04, seed);
  parts.push(lp(THREE, mound, (c, n) => (n.y > 0.6 ? C(0x9a7a50) : C(0x7a5c3a))));
  // 줄기: 마디마다 굵기가 조금씩 다른 고리(면 음영이라 마디가 읽힘)
  const N = 9;
  for (let k = 0; k < N; k++) {
    const a = at(k / N), b = at((k + 1) / N);
    const r0 = 0.17 - k * 0.008, r1 = 0.15 - k * 0.008;
    parts.push(lp(THREE, tube(THREE, a, b, r0, r1, 7, 1), (c, n) => (k % 2 ? C(0x9c7a52) : C(0x84653f)).lerp(C(0xb89568), n.y > 0.2 ? 0.25 : 0), (p) => [Math.max(0, p.y / H - 0.6) * 0.4, 0]));
  }
  const top = at(1);
  // 잎: 위로 솟았다 처지는 띠(가운데 골로 접힘), 끝으로 갈수록 흔들림
  const NL = 9;
  for (let i = 0; i < NL; i++) {
    const a = (i / NL) * Math.PI * 2 + r() * 0.35, L = 1.7 + r() * 0.5, droop = 0.9 + r() * 0.5;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const pts = [], ws = [];
    const M = 6;
    for (let k = 0; k <= M; k++) {
      const s = k / M;
      pts.push(top.clone().addScaledVector(dir, L * s).add(V(0, 0.45 * Math.sin(s * 2.0) - droop * s * s, 0)));
      ws.push((0.06 + 0.3 * Math.sin(Math.PI * Math.min(1, s * 1.1))) * (k === M ? 0.2 : 1));
    }
    const side = V(-dir.z, 0, dir.x);
    const leaf = ribbon(THREE, pts, ws, side, 0.35);
    const base = C(0x3f8f3a).lerp(C(0x2f6f2e), r() * 0.5);
    parts.push(lp(THREE, leaf, (c, n, f) => base.clone().lerp(C(0x86c75a), (f % 4 < 2 ? 0.35 : 0) + Math.min(0.4, c.distanceTo(top) / L * 0.4)),
      (p) => [Math.min(1, p.distanceTo(top) / L), 0], true));
  }
  // 코코넛 송이
  for (let i = 0; i < 4; i++) {
    const c = new THREE.IcosahedronGeometry(0.13, 0);
    c.translate(top.x + Math.cos(i * 1.7) * 0.15, top.y - 0.16 - (i % 2) * 0.06, top.z + Math.sin(i * 1.7) * 0.15);
    parts.push(lp(THREE, c, (cc, n) => (n.y > 0 ? C(0x7a6a2a) : C(0x5a4a22)), [0.1, 0]));
  }
  void w;
  return merge(THREE, parts);
}

export function build(THREE, { w = 2 } = {}) {
  const geometries = { a: palm(THREE, w, 1), b: palm(THREE, w, 2), c: palm(THREE, w, 3) };
  return { id, geometries, recipe: [{ g: ['a', 'b', 'c'] }], info: { triangles: sumTris(geometries), note: '휜 줄기 + 잎 9장 + 코코넛' } };
}
