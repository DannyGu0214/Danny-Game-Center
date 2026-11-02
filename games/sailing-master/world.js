import { LAKE } from './data.js';
// 호수 지도. 물가는 중심에서 잰 반지름 함수라 그림(다각형)과 규칙(거리 격자)이 같은 모양을 쓴다.
// 좌표: x 동쪽, y 남쪽. 호수 가운데가 (0, 0)이다.

const TAU = Math.PI * 2;

// 호수 반지름(타원 좌표에서 1 근처). d만큼 넓힌 윤곽은 outline()에서 만든다
const lakeShape = (a) => 1
  + 0.13 * Math.sin(2 * a + 0.9) + 0.09 * Math.sin(3 * a + 2.4)
  + 0.06 * Math.sin(5 * a + 0.7) + 0.035 * Math.sin(8 * a + 4.1) + 0.018 * Math.sin(13 * a + 1.3);

export const ISLANDS = [
  { x: 54, y: -118, r: 30, ph: 0.6 },
  { x: -62, y: 26, r: 21, ph: 2.2 },
  { x: 44, y: 112, r: 13, ph: 4.0 },
];
const isleShape = (I, a) => I.r * (1 + 0.2 * Math.sin(2 * a + I.ph) + 0.12 * Math.sin(3 * a + I.ph * 2) + 0.06 * Math.sin(5 * a + I.ph * 3));

function rawWater(x, y) {
  const u = x / LAKE.ax, v = y / LAKE.ay;
  if (Math.hypot(u, v) >= lakeShape(Math.atan2(v, u))) return false;
  for (const I of ISLANDS) {
    const dx = x - I.x, dy = y - I.y;
    if (Math.hypot(dx, dy) < isleShape(I, Math.atan2(dy, dx))) return false;
  }
  return true;
}

// 물가까지 거리 격자(물 쪽 +, 땅 쪽 -). 8방향 챔퍼 거리로 두 번 훑는다
const CELL = 3, X0 = -360, Y0 = -500, GW = 241, GH = 335;
const field = new Float32Array(GW * GH);
(function build() {
  const INF = 1e6, a = new Float32Array(GW * GH), b = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const w = rawWater(X0 + i * CELL, Y0 + j * CELL);
    a[j * GW + i] = w ? INF : 0; // a: 땅까지 거리
    b[j * GW + i] = w ? 0 : INF; // b: 물까지 거리
  }
  const S = CELL, Q = CELL * Math.SQRT2;
  for (const f of [a, b]) {
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i; let v = f[k];
      if (i > 0) v = Math.min(v, f[k - 1] + S);
      if (j > 0) { v = Math.min(v, f[k - GW] + S); if (i > 0) v = Math.min(v, f[k - GW - 1] + Q); if (i < GW - 1) v = Math.min(v, f[k - GW + 1] + Q); }
      f[k] = v;
    }
    for (let j = GH - 1; j >= 0; j--) for (let i = GW - 1; i >= 0; i--) {
      const k = j * GW + i; let v = f[k];
      if (i < GW - 1) v = Math.min(v, f[k + 1] + S);
      if (j < GH - 1) { v = Math.min(v, f[k + GW] + S); if (i < GW - 1) v = Math.min(v, f[k + GW + 1] + Q); if (i > 0) v = Math.min(v, f[k + GW - 1] + Q); }
      f[k] = v;
    }
  }
  for (let k = 0; k < field.length; k++) field[k] = a[k] > 0 ? a[k] - CELL / 2 : -(b[k] - CELL / 2);
})();

// 물가까지 부호 있는 거리(물 안이면 +)
export function dist(x, y) {
  const fx = (x - X0) / CELL, fy = (y - Y0) / CELL;
  if (fx < 0 || fy < 0 || fx >= GW - 1 || fy >= GH - 1) return -200;
  const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * GW + i;
  return (field[k] * (1 - u) + field[k + 1] * u) * (1 - v) + (field[k + GW] * (1 - u) + field[k + GW + 1] * u) * v;
}
export const isWater = (x, y) => dist(x, y) > 0;
// 물 쪽으로 향하는 단위 벡터
export function gradient(x, y) {
  const e = CELL, gx = dist(x + e, y) - dist(x - e, y), gy = dist(x, y + e) - dist(x, y - e), m = Math.hypot(gx, gy) || 1;
  return [gx / m, gy / m];
}
export function lineClear(x0, y0, x1, y1, clear) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 2));
  for (let i = 0; i <= n; i++) if (dist(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) < clear) return false;
  return true;
}

// 항로 찾기: 8m 칸 BFS로 길을 찾고, 직선으로 이어도 되는 점은 건너뛴다
const NC = 8, NX0 = -240, NY0 = -360, NW = 61, NH = 91, NAV_CLEAR = 9;
const passable = new Uint8Array(NW * NH);
for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) passable[j * NW + i] = dist(NX0 + i * NC, NY0 + j * NC) >= NAV_CLEAR ? 1 : 0;
const cellOf = (x, y) => [Math.max(0, Math.min(NW - 1, Math.round((x - NX0) / NC))), Math.max(0, Math.min(NH - 1, Math.round((y - NY0) / NC)))];
function nearestPassable(x, y) {
  const [ci, cj] = cellOf(x, y);
  let best = -1, bd = Infinity;
  for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
    if (!passable[j * NW + i]) continue;
    const d = (i - ci) ** 2 + (j - cj) ** 2;
    if (d < bd) { bd = d; best = j * NW + i; }
  }
  return best;
}
export function nearestWater(x, y) {
  if (dist(x, y) >= NAV_CLEAR) return [x, y];
  const k = nearestPassable(x, y);
  return [NX0 + (k % NW) * NC, NY0 + Math.floor(k / NW) * NC];
}
export function findPath(x0, y0, x1, y1) {
  const s = nearestPassable(x0, y0), g = nearestPassable(x1, y1);
  const prev = new Int32Array(NW * NH).fill(-1), q = [s];
  prev[s] = s;
  for (let h = 0; h < q.length && prev[g] < 0; h++) {
    const k = q[h], i = k % NW, j = Math.floor(k / NW);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= NW || b >= NH) continue;
      const n = b * NW + a;
      if (!passable[n] || prev[n] >= 0) continue;
      if (di && dj && (!passable[j * NW + a] || !passable[b * NW + i])) continue; // 모서리 파고들지 않기
      prev[n] = k; q.push(n);
    }
  }
  if (prev[g] < 0) return null;
  const raw = [[x1, y1]];
  for (let k = g; ; k = prev[k]) { raw.push([NX0 + (k % NW) * NC, NY0 + Math.floor(k / NW) * NC]); if (k === s) break; }
  raw.reverse();
  // 직선으로 이어도 되는 점 건너뛰기
  const out = []; let ax = x0, ay = y0, i = 0;
  while (i < raw.length) {
    let far = i;
    for (let j = raw.length - 1; j > i; j--) if (lineClear(ax, ay, raw[j][0], raw[j][1], NAV_CLEAR - 2)) { far = j; break; }
    out.push({ x: raw[far][0], y: raw[far][1] });
    ax = raw[far][0]; ay = raw[far][1]; i = far + 1;
  }
  return out;
}

// 그림용 윤곽. d > 0이면 땅 쪽으로(호수는 넓게, 섬은 좁게), d < 0이면 물 쪽으로 d m 옮긴다.
export function outlines(d, n = 420) {
  const out = [], lake = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, r = lakeShape(a);
    const x = Math.cos(a) * r * LAKE.ax, y = Math.sin(a) * r * LAKE.ay, m = Math.hypot(x, y) || 1;
    lake.push([x + x / m * d, y + y / m * d]);
  }
  out.push(lake);
  for (const I of ISLANDS) {
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * TAU, r = isleShape(I, a) - d;
      if (r > 0.3) pts.push([I.x + Math.cos(a) * r, I.y + Math.sin(a) * r]);
    }
    if (pts.length > 8) out.push(pts);
  }
  return out;
}

// 땅 위에 나무·바위를 시드로 흩어 놓는다(바꾸지 않음, 저장하지 않음)
export function scatter(seed = 11) {
  let s = seed >>> 0;
  const rnd = () => (s = (s + 0x6D2B79F5) >>> 0, ((s ^ (s >>> 15)) * (1 | s) >>> 0) / 4294967296);
  const out = [], used = new Set();
  for (let t = 0; t < 26000 && out.length < 1300; t++) {
    const x = -340 + rnd() * 680, y = -480 + rnd() * 960, d = dist(x, y);
    if (d > -2.5) continue;
    const keep = Math.min(1, 0.14 + (-d) / 34);
    if (rnd() > keep) continue;
    const key = `${Math.round(x / 7)},${Math.round(y / 7)}`;
    if (used.has(key)) continue;
    used.add(key);
    const r = rnd();
    const kind = d > -6 ? (r < 0.5 ? 'rock' : r < 0.8 ? 'bush' : 'reed') : r < 0.46 ? 'pine' : r < 0.86 ? 'oak' : r < 0.95 ? 'bush' : 'rock';
    out.push({ x, y, kind, v: rnd(), size: 0.8 + rnd() * 0.5 });
  }
  return out.sort((a, b) => a.y - b.y);
}
