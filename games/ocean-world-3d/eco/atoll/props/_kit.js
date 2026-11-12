// 물건 생성기 공용 도구(P3 콘텐츠). 화풍: 면 음영(로우폴리) — 면마다 단색, 지형과 같은 계열(PLAN 0절 2026-11-12 "섞기").
// THREE는 인자로 받는다(eco/는 three를 직접 import하지 않는다).
//
// 물건 지오메트리 속성(render/core/batched.js PropBatch 규칙): position, normal, color(선형), aAux(vec2), index
//   aAux.x = 흔들림 정도(0 = 고정, 1 = 끝. 게임 재질이 해류·물결로 흔든다) · aAux.y = 자체 발광 세기
// 좌표: 1 = 1칸(가로·세로·높이 같음). 원점 = 발자국 가운데의 바닥, 위 +Y, 앞 +Z. 발자국 w×h칸이면 x −w/2..w/2, z −h/2..h/2.
//
// 생성기 약속(eco/atoll/props/<id>.js)
//   export const id                         eco/atoll/data.js ITEMS의 키
//   export function build(THREE, { w, h })  발자국 칸 수(data.js에서 읽어 넘김) →
//     { id, geometries: { 이름: BufferGeometry }, recipe: [조각], info: { triangles, note } }
//   recipe 조각은 render/proto/propview.js가 읽는다:
//     g: 이름 또는 이름 배열(배열이면 물건마다 하나를 고름) · dx, dy: 발자국 가운데에서 떨어진 칸(물건 방향을 따라 돎)
//     at: 'ground'(기본, 그 자리 지형 높이) | 'item'(규칙이 준 수중 물건 높이) | 'sea'(수면, float와 함께)
//     up: 'sea' | 'item' | 수(수면 기준 높이) — 세로 조각(밧줄·기둥·뿌리)을 지형에서 그 높이까지 늘림(지오메트리 높이 0..1)
//     z: 수면 기준 높이에 고정 · s: 크기 배율 · w: up 조각의 굵기 배율 · yaw: 추가 회전 · float: 수면 기울기를 따름

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

/** 결정적 난수(render/proto/geo.js와 같은 식) */
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 위치로 정하는 0..1 해시(같은 자리의 꼭짓점이 같은 값 → 흔들어도 면이 벌어지지 않는다) */
export function phash(x, y, z, k = 0) {
  const q = (v) => Math.round(v * 1000);
  let h = (q(x) * 73856093) ^ (q(y) * 19349663) ^ (q(z) * 83492791) ^ (k * 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 꼭짓점을 위치 해시로 흔들어 울퉁불퉁하게(바위·덤불). amp = 칸 */
export function jitter(THREE, g, amp, seed = 1, axes = [1, 1, 1]) {
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    P.setXYZ(i, x + (phash(x, y, z, seed) - 0.5) * 2 * amp * axes[0], y + (phash(x, y, z, seed + 7) - 0.5) * 2 * amp * axes[1], z + (phash(x, y, z, seed + 13) - 0.5) * 2 * amp * axes[2]);
  }
  g.computeVertexNormals();
  return g;
}

const colorOf = (THREE, c, out) => { if (c && c.isColor) out.copy(c); else out.set(c); return out; };

/**
 * 면 음영 조각. 면마다 꼭짓점을 따로 두고 면 하나에 색 하나.
 * color: 값 또는 (centroid, normal, faceIndex) → 색 · aux: [흔들림, 발광] 또는 (꼭짓점 위치) → [..] · two: 양면
 */
export function lp(THREE, g, color, aux = [0, 0], two = false) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv'); g.deleteAttribute('uv1'); g.deleteAttribute('normal');
  g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, n = P.count;
  const col = new Float32Array(n * 3), ax = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3(), cc = new THREE.Color(), p = new THREE.Vector3();
  for (let f = 0; f < n / 3; f++) {
    a.fromBufferAttribute(P, f * 3); b.fromBufferAttribute(P, f * 3 + 1); c.fromBufferAttribute(P, f * 3 + 2);
    nn.fromBufferAttribute(N, f * 3);
    const ctr = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    colorOf(THREE, typeof color === 'function' ? color(ctr, nn, f) : color, cc);
    for (let k = 0; k < 3; k++) col.set([cc.r, cc.g, cc.b], (f * 3 + k) * 3);
  }
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    const v = typeof aux === 'function' ? aux(p) : aux;
    ax[i * 2] = v[0] || 0; ax[i * 2 + 1] = v[1] || 0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aAux', new THREE.BufferAttribute(ax, 2));
  // two = 양면(잎·판): 같은 꼭짓점으로 뒤집힌 삼각형을 하나 더(게임 재질이 앞면만 그리고 면 음영이라 법선은 화면에서 다시 계산됨)
  const idx = [];
  for (let f = 0; f < n / 3; f++) { idx.push(f * 3, f * 3 + 1, f * 3 + 2); if (two) idx.push(f * 3, f * 3 + 2, f * 3 + 1); }
  g.setIndex(idx);
  return g;
}

/** 같은 속성 묶음(position, normal, color, aAux)을 하나로 */
export function merge(THREE, parts) {
  const names = ['position', 'normal', 'color', 'aAux'];
  let verts = 0, idx = 0;
  for (const g of parts) { verts += g.attributes.position.count; idx += g.index.count; }
  const out = new THREE.BufferGeometry();
  for (const nm of names) {
    const size = parts[0].attributes[nm].itemSize, arr = new Float32Array(verts * size);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; }
    out.setAttribute(nm, new THREE.BufferAttribute(arr, size));
  }
  const I = verts > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  let o = 0, base = 0;
  for (const g of parts) { const s = g.index.array; for (let k = 0; k < s.length; k++) I[o + k] = s[k] + base; o += s.length; base += g.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(I, 1));
  out.computeBoundingSphere();
  return out;
}

/** 두 점 사이 원기둥(굵기 r0→r1, 마디 seg) */
export function tube(THREE, a, b, r0, r1, radial = 6, seg = 1, open = false) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, seg, open);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** 점 목록을 잇는 관(마디마다 굵기 rs[i]). 굽은 줄기·뿌리 */
export function path(THREE, pts, rs, radial = 6) {
  const parts = [];
  for (let i = 0; i < pts.length - 1; i++) parts.push(tube(THREE, pts[i], pts[i + 1], rs[i], rs[i + 1], radial, 1, true));
  return parts;
}

/** 두 점을 잇는 판(잎·지느러미 같은 띠): 폭 w(t) 함수, 접힘(가운데 골) fold */
export function ribbon(THREE, pts, widths, side, fold = 0) {
  const pos = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], w = widths[i];
    const tan = (i < n - 1 ? pts[i + 1].clone().sub(p) : p.clone().sub(pts[i - 1])).normalize();
    const s = side.clone().sub(tan.clone().multiplyScalar(side.dot(tan))).normalize();
    const up = new THREE.Vector3().crossVectors(s, tan).normalize();
    const L = p.clone().addScaledVector(s, -w).addScaledVector(up, -fold * w), M = p.clone().addScaledVector(up, fold * w * 0.2), R = p.clone().addScaledVector(s, w).addScaledVector(up, -fold * w);
    pos.push(L, M, R);
  }
  const arr = [], idx = [];
  for (const v of pos) arr.push(v.x, v.y, v.z);
  for (let i = 0; i < n - 1; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  g.setIndex(idx);
  return g;
}

export const triCount = (g) => g.index.count / 3;
export const sumTris = (geos) => Object.values(geos).reduce((s, g) => s + triCount(g), 0);
