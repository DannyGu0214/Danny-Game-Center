// 맹그로브 덤불(확장 영역 테마 자연물, 해저 4×4, 수면 위로 솟음) — 면 음영.
// 얕은 바닥에서 활처럼 휜 버팀뿌리 다발이 올라와 수면 위 줄기로 모이고, 그 위에 짙은 잎 뭉치 덤불이 얹힌다.
// 뿌리 다발은 배치 때 바닥에서 줄기 높이(수면 위 0.45칸)까지 세로로 늘려 어떤 수심(1~3칸)에도 닿게 한다(지오메트리 높이 0..1).
import { lp, merge, tube, jitter, rng, sumTris } from './_kit.js';

export const id = 'mangrove';
const ROOT_TOP = 0.45;    // 수면 기준 줄기 밑 높이(칸)

/** 버팀뿌리 다발(높이 0..1, 폭 ±0.7) */
function roots(THREE, seed) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4, reach = 0.45 + r() * 0.3;
    const top = V((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12);
    const foot = V(Math.cos(a) * reach, 0, Math.sin(a) * reach);
    // 활 모양: 위에서 바깥으로 뻗었다 바닥으로 내려꽂힘
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const p = top.clone().lerp(foot, t);
      p.y = 1 - Math.pow(t, 1.6);
      p.addScaledVector(V(Math.cos(a), 0, Math.sin(a)), 0.18 * Math.sin(t * Math.PI));
      pts.push(p);
    }
    for (let k = 0; k < 5; k++) parts.push(lp(THREE, tube(THREE, pts[k], pts[k + 1], 0.06 - k * 0.006, 0.054 - k * 0.006, 5, 1, true), (c) => (c.y < 0.25 ? C(0x5a4a34) : C(0x7a5a3a))));
  }
  return merge(THREE, parts);
}

/** 수면 위: 줄기 몇 개 + 잎 뭉치(원점 = 줄기 밑, 수면 기준 ROOT_TOP 높이에 놓임) */
function canopy(THREE, w, seed) {
  const r = rng(seed), V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  const R = w * 0.45;
  const trunks = [[-0.3, -0.25], [0.35, -0.2], [-0.2, 0.35], [0.3, 0.35], [0, 0]];
  for (const [tx, tz] of trunks) {
    const b = V(tx * R, 0, tz * R), t = V(tx * R * 0.7, 0.9 + r() * 0.3, tz * R * 0.7);
    parts.push(lp(THREE, tube(THREE, b, t, 0.1, 0.07, 5, 1, true), C(0x6a4a2c)));
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + r() * 0.5, d = k === 0 ? 0 : R * (0.4 + r() * 0.3);
    const s = R * (0.46 + r() * 0.2);
    const g = new THREE.IcosahedronGeometry(1, 1); g.scale(s, s * 0.62, s);
    g.translate(Math.cos(a) * d, 1.15 + r() * 0.5 + (k === 0 ? 0.35 : 0), Math.sin(a) * d);
    jitter(THREE, g, s * 0.14, seed * 10 + k);
    const base = C(0x2f6a34).lerp(C(0x3e7e3a), r());
    parts.push(lp(THREE, g, (c, n) => base.clone().lerp(C(0x7ab05a), n.y > 0.55 ? 0.5 : 0).lerp(C(0x1e4422), n.y < -0.3 ? 0.6 : 0), (p) => [Math.min(0.4, Math.max(0, (p.y - 1) * 0.3)), 0]));
  }
  // 노란 잎 몇 장(맹그로브 특유의 소금 잎)
  for (let k = 0; k < 6; k++) {
    const a = r() * 6.28, d = R * (0.4 + r() * 0.5);
    const l = new THREE.OctahedronGeometry(0.1, 0); l.scale(1, 0.4, 1.6); l.translate(Math.cos(a) * d, 1.3 + r() * 0.6, Math.sin(a) * d);
    parts.push(lp(THREE, l, C(0xe8c84a), [0.3, 0]));
  }
  return merge(THREE, parts);
}

export function build(THREE, { w = 4, h = 4 } = {}) {
  const geometries = { rootsA: roots(THREE, 1), rootsB: roots(THREE, 2), canopy: canopy(THREE, w, 3) };
  const ox = w * 0.25, oz = h * 0.25;
  const recipe = [
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([dx, dy], i) => ({ g: i % 2 ? 'rootsA' : 'rootsB', dx: dx * ox, dy: dy * oz, up: ROOT_TOP, w: 1 })),
    { g: 'canopy', z: ROOT_TOP },
  ];
  return { id, geometries, recipe, info: { triangles: sumTris(geometries), note: '버팀뿌리 다발 5(바닥 → 수면 위로 늘림) + 줄기·잎 덤불' } };
}
