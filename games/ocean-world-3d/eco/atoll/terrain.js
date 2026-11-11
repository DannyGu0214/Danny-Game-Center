// 열대 환초(몰디브형) 지형 정의 — 한 곳에서만 정의한다(PLAN.md 3절·4.3절).
// Three.js·DOM을 import하지 않는 순수 함수 모듈이라 Node에서도 import할 수 있다.
//
// 좌표: 격자 (x, y)는 바닥면(칸 단위, 0..w, 0..h), z는 높이(칸 단위, 위가 +, 수면 0).
//       y = 0 쪽이 "기본 시점에서의 앞", y = h 쪽이 "뒤"다(DESIGN 2.1절: 섬은 뒤, 칸두·석호는 앞).
// 높이: heightAt(x, y)는 연속 좌표 → 높이(칸). cellHeight(cx, cy)는 칸 가운데 높이를 1/3칸 정수로.
//
// 확장 영역(T8): 본 블록의 +x 옆면(기본 시점에서 오른쪽)에 폭 GRID.h(40칸) × 깊이 20칸이 붙는다.
// 지형 함수는 확장 영역까지 미리 정의해 두고, 열렸는지(opts.ext)에 따라 블록 경계(가장자리 절벽)만 옮긴다.

export const GRID = { w: 40, h: 40 };          // 본 블록 칸 수(x, y)
export const EXT = { side: '+x', depth: 20 };   // T8 확장 영역: +x 옆면에 20칸 깊이(폭은 그 옆면 길이 = GRID.h)
export const SEA_LEVEL = 0;                     // 수면 높이(칸)
export const MAX_DEPTH = 12;                    // 가장 깊은 곳(칸)
export const SUB = 3;                           // 규칙용 높이 단위: 1/3칸
export const BOTTOM = -(MAX_DEPTH + 1.5);       // 블록 밑면(지층 단면의 아래 끝, 칸)

export const KINDS = ['island', 'beach', 'lagoon', 'reefflat', 'thila', 'kandu', 'slope', 'dropoff', 'void'];

/** 블록 크기(확장 영역이 열렸는지에 따라). */
export function bounds(opts) {
  const ext = !!(opts && opts.ext);
  if (!ext) return { x0: 0, y0: 0, x1: GRID.w, y1: GRID.h, w: GRID.w, h: GRID.h };
  switch (EXT.side) {
    case '+x': return { x0: 0, y0: 0, x1: GRID.w + EXT.depth, y1: GRID.h, w: GRID.w + EXT.depth, h: GRID.h };
    case '-x': return { x0: -EXT.depth, y0: 0, x1: GRID.w, y1: GRID.h, w: GRID.w + EXT.depth, h: GRID.h };
    case '+y': return { x0: 0, y0: 0, x1: GRID.w, y1: GRID.h + EXT.depth, w: GRID.w, h: GRID.h + EXT.depth };
    default:   return { x0: 0, y0: -EXT.depth, x1: GRID.w, y1: GRID.h, w: GRID.w, h: GRID.h + EXT.depth };
  }
}

// ---------- 결정적 노이즈(시드 고정, Math.random 없음) ----------
function hash2(ix, iy) {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; // 0..1
}
export function fbm(x, y, oct = 3) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f + i * 17.3, y * f - i * 9.1); norm += amp; amp *= 0.5; f *= 2.03; }
  return s / norm; // 0..1
}

// ---------- 2D 거리 함수(SDF) ----------
const sdEllipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
function sdCapsule(x, y, ax, ay, bx, by, r) {
  const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay;
  const t = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * t, pay - bay * t) - r;
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const smax = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (a - b) / k)); return lerp(b, a, h) + k * h * (1 - h); };
const smin = (a, b, k) => -smax(-a, -b, k);

// ---------- 지형 요소(칸 좌표). 숫자는 모두 가안 ----------
// 큰 섬(야자수 섬): 뒤쪽 왼편. 모래톱(finolhu): 뒤쪽 오른편, 풀 없음.
const ISLAND = { cx: 14.5, cy: 28.4, rx: 11.2, ry: 7.0, top: 2.7 };
const SANDBANK = { cx: 31.6, cy: 30.2, rx: 5.4, ry: 3.1, top: 0.6 };
// 칸두: 앞 옆면을 따라 가로지르는 깊은 수로. 앞 옆면이 깊은 물로 열려 옆에서 물속이 잘 보인다(DESIGN 2.1절).
const KANDU = { ax: -4, ay: 3.0, bx: 44, by: 5.4, r: 3.8, floor: -11.6 };
// 틸라: 칸두 안에 솟은 물속 봉우리(꼭대기 수심 약 4.5칸).
const THILA = { cx: 27, cy: 7.4, rTop: 1.8, rBase: 6.0, top: -4.4 };
// 석호 안 산호 덩어리(bommie): 수위 아래 작은 봉우리.
const BOMMIES = [
  { cx: 9, cy: 19, r: 1.6, top: -1.3 },
  { cx: 21, cy: 21.5, r: 1.3, top: -1.6 },
  { cx: 33, cy: 22, r: 1.5, top: -1.2 },
];
const LAGOON_FLOOR = -3.0;
const REEF_FLAT = -1.1;
const EDGE_BAND = 2.2;   // 블록 가장자리 바깥 비탈 띠 폭(칸)
const EDGE_DEPTH = -6.2; // 바깥 비탈이 블록 옆면에 닿는 높이(칸, 가안)

/** 연속 좌표(칸) → 높이(칸). 화면용. opts.ext: 확장 영역이 열렸는지. */
export function heightAt(x, y, opts) {
  const b = bounds(opts);
  // 석호 바닥: 얕은 분지 + 모래 언덕
  let h = LAGOON_FLOOR + (fbm(x * 0.13, y * 0.13) - 0.5) * 0.9 + (fbm(x * 0.5 + 40, y * 0.5) - 0.5) * 0.25;

  // 산호 대지: 섬 둘레 띠 + 뒤쪽 환초 테두리(본 블록 뒤 가장자리 쪽)
  const dIsl = sdEllipse(x, y, ISLAND.cx, ISLAND.cy, ISLAND.rx, ISLAND.ry);
  const dSand = sdEllipse(x, y, SANDBANK.cx, SANDBANK.cy, SANDBANK.rx, SANDBANK.ry);
  const rim = (b.y1 - 4.5) - y;                        // 뒤 가장자리에서 4.5칸 안쪽까지 테두리
  let dReef = Math.min(dIsl - 3.2, dSand - 2.6, rim);
  dReef += (fbm(x * 0.35 + 7, y * 0.35 - 3) - 0.5) * 2.2; // 테두리를 울퉁불퉁하게
  const reefH = REEF_FLAT + (fbm(x * 0.8, y * 0.8 + 11) - 0.5) * 0.7;
  h = lerp(h, reefH, 1 - sstep(-0.6, 1.4, dReef));

  // 석호 안 산호 덩어리
  for (const m of BOMMIES) {
    const d = Math.hypot(x - m.cx, y - m.cy);
    const bump = m.top - Math.pow(Math.max(0, d / m.r), 2) * 1.2 + (fbm(x * 1.7, y * 1.7) - 0.5) * 0.6;
    h = smax(h, bump, 0.6);
  }

  // 칸두: 깊게 파낸 수로(옆 비탈은 계단 느낌을 조금)
  const dK = sdCapsule(x, y, KANDU.ax, KANDU.ay, KANDU.bx, KANDU.by, KANDU.r) + (fbm(x * 0.25, y * 0.25 + 5) - 0.5) * 2.5;
  const kT = 1 - sstep(-1.0, 4.0, dK);
  const kanduH = KANDU.floor + (fbm(x * 0.6 + 3, y * 0.6) - 0.5) * 0.6;
  h = lerp(h, Math.min(h, kanduH), kT);

  // 틸라: 칸두 안의 봉우리
  {
    const d = Math.hypot(x - THILA.cx, y - THILA.cy) + (fbm(x * 0.9, y * 0.9 - 2) - 0.5) * 1.4;
    const t = 1 - sstep(THILA.rTop, THILA.rBase, d);
    const peak = lerp(KANDU.floor + 1, THILA.top + (fbm(x * 1.3, y * 1.3) - 0.5) * 0.8, t * t * (3 - 2 * t));
    h = smax(h, peak, 0.8);
  }

  // 섬(큰 섬, 모래톱): 해변은 완만하게, 안쪽은 낮은 언덕
  {
    const e = dIsl + (fbm(x * 0.45, y * 0.45 + 21) - 0.5) * 1.6;
    const isl = lerp(-1.0 - Math.max(0, e) * 1.5, ISLAND.top, sstep(1.2, -3.8, e)) + (fbm(x * 0.6, y * 0.6 - 30) - 0.5) * 0.5 * sstep(0, -3, e);
    h = smax(h, isl, 0.5);
    const e2 = dSand + (fbm(x * 0.6 + 50, y * 0.6) - 0.5) * 0.8;
    const sb = lerp(-1.0 - Math.max(0, e2) * 1.5, SANDBANK.top, sstep(0.8, -1.4, e2));
    h = smax(h, sb, 0.4);
  }

  // 바깥 비탈: 블록 가장자리 띠에서 급히 깊어진다(드롭오프)
  // 가장자리 높이는 수심 약 5~7칸까지만 내려가 옆면에 지층 단면이 두껍게 보이게 한다(칸두 끝은 더 깊음).
  const edge = Math.min(x - b.x0, b.x1 - x, y - b.y0, b.y1 - y);
  const drop = 1 - sstep(0, EDGE_BAND, edge);
  if (drop > 0) {
    const rimH = EDGE_DEPTH + (fbm(x * 0.3 + 90, y * 0.3 - 40) - 0.5) * 2.4 + edge * 1.4;
    h = lerp(h, Math.min(h, rimH), drop * drop);
  }

  return Math.max(-MAX_DEPTH, Math.min(3.0, h));
}

function inBounds(cx, cy, opts) {
  const b = bounds(opts);
  return cx >= b.x0 && cy >= b.y0 && cx < b.x1 && cy < b.y1;
}

/** 칸 → 규칙용 높이(1/3칸 단위 정수). 칸 가운데에서 잰다. */
export function cellHeight(cx, cy, opts) {
  if (!inBounds(cx, cy, opts)) return null;
  return Math.round(heightAt(cx + 0.5, cy + 0.5, opts) * SUB);
}

/** 칸 → 지형 종류. */
export function kindAt(cx, cy, opts) {
  if (!inBounds(cx, cy, opts)) return 'void';
  const b = bounds(opts);
  const x = cx + 0.5, y = cy + 0.5;
  const h = heightAt(x, y, opts);
  const edge = Math.min(x - b.x0, b.x1 - x, y - b.y0, b.y1 - y);
  if (edge < EDGE_BAND && h < -3.5 && h > -9) return 'dropoff';
  if (h > SEA_LEVEL) {
    const inIsl = sdEllipse(x, y, ISLAND.cx, ISLAND.cy, ISLAND.rx, ISLAND.ry) < -1.6;
    return (inIsl && h > 1.0) ? 'island' : 'beach';
  }
  // 경사: 칸 안 높이 차가 크면 비탈(작은 계단)
  const g = Math.max(
    Math.abs(heightAt(x + 0.5, y, opts) - heightAt(x - 0.5, y, opts)),
    Math.abs(heightAt(x, y + 0.5, opts) - heightAt(x, y - 0.5, opts)));
  const dTh = Math.hypot(x - THILA.cx, y - THILA.cy);
  if (dTh < THILA.rBase - 1.5 && h > -8) return 'thila';
  if (g > 1.6) return 'slope';
  if (h < -7) return 'kandu';
  if (h >= -2) return 'reefflat';
  if (h >= -5) return 'lagoon';
  return 'slope';
}

/** 디버그·보고용: 지형 종류별 칸 수와 수심 통계. */
export function summary(opts) {
  const b = bounds(opts);
  const count = Object.fromEntries(KINDS.map((k) => [k, 0]));
  let minH = Infinity, maxH = -Infinity;
  for (let cy = b.y0; cy < b.y1; cy++) for (let cx = b.x0; cx < b.x1; cx++) {
    count[kindAt(cx, cy, opts)]++;
    const hh = cellHeight(cx, cy, opts) / SUB;
    if (hh < minH) minH = hh; if (hh > maxH) maxH = hh;
  }
  return { bounds: b, count, minH, maxH };
}

/** 렌더가 쓰는 랜드마크(생물·물건 시험 배치용 기준점). 규칙 데이터가 아니다. */
export const LANDMARKS = {
  island: { x: ISLAND.cx, y: ISLAND.cy },
  sandbank: { x: SANDBANK.cx, y: SANDBANK.cy },
  thila: { x: THILA.cx, y: THILA.cy },
  kandu: { x: 14, y: 5.5 },
  lagoon: { x: 20, y: 18 },
  bommies: BOMMIES.map((m) => ({ x: m.cx, y: m.cy })),
};
