// 수상 데크(확장 영역 테마 인공물, 해저 4×4, 수면 위로 솟음) — 면 음영.
// 얕은 바닥에 박은 나무 기둥 여섯 개 위로 널빤지 데크, 두 면의 난간, 벤치와 등불 기둥, 물로 내려가는 사다리.
// 기둥은 배치 때 바닥에서 데크 높이까지 세로로 늘린다(지오메트리 높이 0..1).
import { lp, merge, rng, sumTris } from './_kit.js';

export const id = 'boardwalk';
const DECK_Z = 0.9;   // 수면 기준 데크 밑면 높이(칸)

function post(THREE) {
  const C = (c) => new THREE.Color(c);
  const g = new THREE.CylinderGeometry(0.12, 0.13, 1, 6, 2); g.translate(0, 0.5, 0);
  return merge(THREE, [lp(THREE, g, (c) => (c.y < 0.35 ? C(0x4a5a4a) : C(0x7a5a3a)))]);   // 물에 잠긴 아래쪽은 이끼빛
}

function deck(THREE, w, h, seed) {
  const r = rng(seed), C = (c) => new THREE.Color(c);
  const parts = [];
  const W = w * 0.48, D = h * 0.48;
  // 널빤지(가로로 길게, 사이 틈)
  const N = 9;
  for (let k = 0; k < N; k++) {
    const z = -D + (k + 0.5) * (2 * D / N);
    const b = new THREE.BoxGeometry(W * 2, 0.12, (2 * D / N) * 0.86); b.translate(0, 0.06, z);
    parts.push(lp(THREE, b, (c, n) => (n.y > 0.5 ? C(0xb88a58).lerp(C(0x9a6f44), r() * 0.5) : C(0x7a5632))));
  }
  // 받침 들보
  for (const x of [-W * 0.9, 0, W * 0.9]) { const j = new THREE.BoxGeometry(0.14, 0.12, D * 2); j.translate(x, -0.06, 0); parts.push(lp(THREE, j, C(0x6a4a2c))); }
  // 난간(뒤·오른쪽)
  const RAIL = C(0x8a6038);
  for (let k = 0; k <= 4; k++) {
    const x = -W + k * (W / 2);
    const p = new THREE.BoxGeometry(0.08, 0.6, 0.08); p.translate(x * 0.96, 0.42, -D * 0.96); parts.push(lp(THREE, p, RAIL));
    const q = new THREE.BoxGeometry(0.08, 0.6, 0.08); q.translate(W * 0.96, 0.42, -D + k * (D / 2) * 0.96); parts.push(lp(THREE, q, RAIL));
  }
  const top1 = new THREE.BoxGeometry(W * 2, 0.07, 0.1); top1.translate(0, 0.72, -D * 0.96); parts.push(lp(THREE, top1, C(0xa87848)));
  const top2 = new THREE.BoxGeometry(0.1, 0.07, D * 2); top2.translate(W * 0.96, 0.72, 0); parts.push(lp(THREE, top2, C(0xa87848)));
  // 벤치
  const seat = new THREE.BoxGeometry(W * 0.8, 0.07, 0.34); seat.translate(-W * 0.3, 0.42, -D * 0.7); parts.push(lp(THREE, seat, C(0x9a6a3a)));
  for (const sx of [-1, 1]) { const l = new THREE.BoxGeometry(0.07, 0.3, 0.3); l.translate(-W * 0.3 + sx * W * 0.34, 0.25, -D * 0.7); parts.push(lp(THREE, l, C(0x6a4a2c))); }
  // 등불 기둥
  const lp1 = new THREE.CylinderGeometry(0.04, 0.05, 1.1, 5); lp1.translate(W * 0.8, 0.65, D * 0.75); parts.push(lp(THREE, lp1, C(0x404448)));
  const lantern = new THREE.OctahedronGeometry(0.14, 0); lantern.scale(1, 1.3, 1); lantern.translate(W * 0.8, 1.28, D * 0.75); parts.push(lp(THREE, lantern, C(0xffd870), [0, 1.3]));
  // 사다리(앞 왼쪽, 데크에서 물 아래로)
  for (const sx of [-1, 1]) { const s = new THREE.BoxGeometry(0.05, 1.2, 0.05); s.translate(-W * 0.6 + sx * 0.18, -0.5, D + 0.05); parts.push(lp(THREE, s, C(0x9aa0a4))); }
  for (let k = 0; k < 4; k++) { const s = new THREE.BoxGeometry(0.4, 0.04, 0.05); s.translate(-W * 0.6, -0.95 + k * 0.28, D + 0.05); parts.push(lp(THREE, s, C(0xb8bec2))); }
  // 데크 위 소품: 감긴 밧줄, 물통
  const coil = new THREE.TorusGeometry(0.16, 0.05, 4, 8); coil.rotateX(Math.PI / 2); coil.translate(W * 0.35, 0.16, D * 0.3); parts.push(lp(THREE, coil, C(0xe8dcc0)));
  const bucket = new THREE.CylinderGeometry(0.14, 0.11, 0.24, 7); bucket.translate(-W * 0.75, 0.24, D * 0.2); parts.push(lp(THREE, bucket, C(0x3a8ad0)));
  return merge(THREE, parts);
}

export function build(THREE, { w = 4, h = 4 } = {}) {
  const geometries = { post: post(THREE), deck: deck(THREE, w, h, 2) };
  const px = w * 0.4, pz = h * 0.4;
  const recipe = [
    ...[[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => ({ g: 'post', dx: dx * px, dy: dy * pz, up: DECK_Z, w: 1 })),
    { g: 'deck', z: DECK_Z },
  ];
  return { id, geometries, recipe, info: { triangles: sumTris(geometries), note: '나무 기둥 6(바닥 → 데크로 늘림) + 널빤지 데크·난간·벤치·등불·사다리' } };
}
