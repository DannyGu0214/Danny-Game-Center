// 해안 덤불(자연물, 육지 4×4) — 면 음영. 해안에 자라는 낮은 덤불(갯쑥부쟁이·해송잎 느낌의 둥근 잎 뭉치) 다섯 무더기와
// 작은 흰 꽃, 가지 끝의 열매. 무더기마다 지형에 따로 얹는다.
import { lp, merge, jitter, tube, rng, sumTris } from './_kit.js';

export const id = 'beachscrub';

function bush(THREE, seed, R, Hh) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  // 줄기 몇 개
  for (let k = 0; k < 3; k++) {
    const a = r() * 6.28;
    parts.push(lp(THREE, tube(THREE, V(0, 0, 0), V(Math.cos(a) * R * 0.4, Hh * 0.5, Math.sin(a) * R * 0.4), 0.06, 0.04, 5, 1, true), C(0x6a5034)));
  }
  // 잎 뭉치(울퉁불퉁한 공 여러 개)
  for (let k = 0; k < 6; k++) {
    const a = r() * 6.28, d = r() * R * 0.6;
    const s = R * (0.42 + r() * 0.25);
    const g = new THREE.IcosahedronGeometry(1, 1); g.scale(s, s * 0.75, s);
    g.translate(Math.cos(a) * d, Hh * (0.45 + r() * 0.35), Math.sin(a) * d);
    jitter(THREE, g, s * 0.12, seed * 10 + k);
    const base = C(0x4f8f3c).lerp(C(0x3a7030), r());
    parts.push(lp(THREE, g, (c, n, f) => base.clone().lerp(C(0x8cc060), n.y > 0.6 ? 0.45 : n.y < -0.2 ? -0.3 : 0.1).lerp(C(0x2a5024), n.y < -0.3 ? 0.5 : 0),
      (p) => [Math.min(0.35, Math.max(0, p.y / (Hh * 2))), 0]));
  }
  // 흰 꽃·주황 열매
  for (let k = 0; k < 7; k++) {
    const a = r() * 6.28, d = R * (0.3 + r() * 0.5);
    const f = new THREE.OctahedronGeometry(0.06, 0);
    f.translate(Math.cos(a) * d, Hh * (0.75 + r() * 0.3), Math.sin(a) * d);
    parts.push(lp(THREE, f, k % 3 ? C(0xfdf8f0) : C(0xf08a3a), [0.3, 0.05]));
  }
  return merge(THREE, parts);
}

export function build(THREE, { w = 4, h = 4 } = {}) {
  const geometries = { a: bush(THREE, 5, 0.95, 1.1), b: bush(THREE, 6, 0.8, 0.95), c: bush(THREE, 7, 1.1, 1.3) };
  const ox = w * 0.24, oz = h * 0.24;
  const recipe = [
    { g: ['a', 'b'], dx: -ox, dy: -oz }, { g: ['b', 'c'], dx: ox, dy: -oz * 0.8 },
    { g: ['c', 'a'], dx: -ox * 0.8, dy: oz }, { g: ['a', 'b'], dx: ox, dy: oz },
    { g: 'c', s: 1.1, yaw: 2.1 },
  ];
  return { id, geometries, recipe, info: { triangles: sumTris(geometries), note: '잎 뭉치 덤불 5무더기 + 꽃·열매' } };
}
