// 그림 모듈: 게임 상태 없이 "펜"만 받아 그린다. 펜 = { ctx, P, zoom }.
// P(x, y, z) 는 월드 좌표(z = 높이)를 캔버스 좌표로 바꾼다(2:1 쿼터뷰).
// 오브젝트 그림은 모두 자기 발밑 (0,0)을 기준으로 그린다. 화면에서는 한 번 그려 둔 이미지(스프라이트)를 찍는다.
// 빛은 왼쪽 위(-x, -y 쪽)에서 온다: 윗면이 가장 밝고, +y 면(화면 왼쪽 아래)이 중간, +x 면(화면 오른쪽 아래)이 가장 어둡다.

export const ISO_A = 0.7071, ISO_B = 0.3536;

// ---------- 난수·색 ----------
export function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// 같은 씨앗이면 같은 수열(타일·오브젝트마다 모양이 고정된다)
export function rng(seed) {
  let a = (seed * 4294967296) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RGB = new Map();
function rgbOf(hex) {
  let v = RGB.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; RGB.set(hex, v); }
  return v;
}
const toHex = (r, g, b) => '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
export const shade = (hex, k) => { const [r, g, b] = rgbOf(hex); return toHex(r * k, g * k, b * k); };
export const mix = (h1, h2, t) => { const a = rgbOf(h1), b = rgbOf(h2); return toHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); };
export const rgba = (hex, a) => { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; };
// 옆면 밝기: 법선 (nx, ny)가 +y면 0.8, +x면 0.64(box의 왼쪽·오른쪽 면과 같다)
export const sideTone = (hex, nx, ny) => shade(hex, 0.64 + 0.08 * (ny - nx + 1));
export const tones = (hex) => [hex, shade(hex, 0.8), shade(hex, 0.64)];

// ---------- 기본 도형 ----------
function trace(ctx, q) {
  ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
  ctx.closePath();
}
export function poly(pen, pts, fill) {
  pen.ctx.fillStyle = fill;
  trace(pen.ctx, pts.map((p) => pen.P(p[0], p[1], p[2] || 0)));
  pen.ctx.fill();
}
export function line(pen, a, b, col, w = 1) {
  const { ctx, P, zoom } = pen;
  const p = P(a[0], a[1], a[2] || 0), q = P(b[0], b[1], b[2] || 0);
  ctx.strokeStyle = col; ctx.lineWidth = w * zoom;
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
}
export function polyline(pen, pts, col, w = 1) {
  const { ctx, P, zoom } = pen;
  ctx.strokeStyle = col; ctx.lineWidth = w * zoom; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => { const q = P(p[0], p[1], p[2] || 0); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
  ctx.stroke();
}
// 축에 맞춘 상자. col은 색 하나(자동 명암) 또는 [윗면, +y면, +x면]
export function box(pen, x, y, w, d, h, col, z0 = 0) {
  const [t, l, r] = Array.isArray(col) ? col : tones(col), z1 = z0 + h;
  poly(pen, [[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x + w, y, z1]], r);
  poly(pen, [[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x, y + d, z1]], l);
  poly(pen, [[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]], t);
}
// 상자 면 위의 사각형(창문·문·무늬): +x 면(X 고정, y 범위)과 +y 면(Y 고정, x 범위)
export const onX = (pen, X, y0, y1, z0, z1, fill) => poly(pen, [[X, y0, z0], [X, y1, z0], [X, y1, z1], [X, y0, z1]], fill);
export const onY = (pen, Y, x0, x1, z0, z1, fill) => poly(pen, [[x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1]], fill);
// 돌린 상자(cx, cy 중심, ang 라디안). 보이는 옆면만 깊이 순서로 그린다.
export function rbox(pen, cx, cy, w, d, h, ang, col, z0 = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2, hd = d / 2, z1 = z0 + h;
  const q = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]);
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = dy / L, ny = -dx / L;
    if (nx + ny > 0) faces.push({ a, b, nx, ny, k: a[0] + a[1] + b[0] + b[1] });
  }
  faces.sort((f, g) => f.k - g.k);
  for (const f of faces) poly(pen, [[f.a[0], f.a[1], z0], [f.b[0], f.b[1], z0], [f.b[0], f.b[1], z1], [f.a[0], f.a[1], z1]], sideTone(col, f.nx, f.ny));
  poly(pen, q.map(([x, y]) => [x, y, z1]), col);
}
// 세운 원기둥: 옆면은 왼쪽이 밝고 오른쪽이 어둡게
export function cyl(pen, x, y, r, h, col, z0 = 0, topCol = null) {
  const { ctx, P, zoom } = pen;
  const [bx, by] = P(x, y, z0), [tx, ty] = P(x, y, z0 + h), rx = r * zoom, ry = r * 0.5 * zoom;
  const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0);
  g.addColorStop(0, shade(col, 0.72)); g.addColorStop(0.32, shade(col, 0.98)); g.addColorStop(1, shade(col, 0.52));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI); ctx.lineTo(tx - rx, ty); ctx.ellipse(tx, ty, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = topCol ?? shade(col, 1.12);
  ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
// 원기둥 옆면의 가로 테(드럼통 띠): 앞쪽 반원만
export function cylBand(pen, x, y, r, z, col, w = 1.2) {
  const { ctx, P, zoom } = pen, [bx, by] = P(x, y, z);
  ctx.strokeStyle = col; ctx.lineWidth = w * zoom;
  ctx.beginPath(); ctx.ellipse(bx, by, r * zoom, r * 0.5 * zoom, 0, 0, Math.PI); ctx.stroke();
}
// 눕힌 원기둥(통나무·관): (x0,y0)에서 축(axis 'x'|'y') 방향으로 len, 단면 반지름 r, 바닥에서 z0 위
export function hcyl(pen, x0, y0, z0, len, r, axis, col, capCol = null) {
  const { ctx, P } = pen, N = 18;
  const ring = (t) => {
    const out = [];
    for (let i = 0; i < N; i++) {
      const f = (i / N) * Math.PI * 2, u = Math.cos(f) * r, v = Math.sin(f) * r;
      out.push(axis === 'x' ? P(x0 + t, y0 + u, z0 + r + v) : P(x0 + u, y0 + t, z0 + r + v));
    }
    return out;
  };
  const a = ring(0), b = ring(len);
  // 화면에서 축에 수직인 방향으로 가장 바깥 점 두 개씩 이어 몸통을 만든다
  const ax = b[0][0] - a[0][0], ay = b[0][1] - a[0][1], L = Math.hypot(ax, ay) || 1, px = -ay / L, py = ax / L;
  const ext = (pts) => { let lo = pts[0], hi = pts[0]; for (const p of pts) { const d = p[0] * px + p[1] * py; if (d < lo[0] * px + lo[1] * py) lo = p; if (d > hi[0] * px + hi[1] * py) hi = p; } return [lo, hi]; };
  const [a0, a1] = ext(a), [b0, b1] = ext(b);
  const g = ctx.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
  g.addColorStop(0, shade(col, 1.05)); g.addColorStop(0.45, shade(col, 0.85)); g.addColorStop(1, shade(col, 0.55));
  ctx.fillStyle = g; trace(ctx, [a0, b0, b1, a1]); ctx.fill();
  // 앞쪽(보는 쪽) 단면
  ctx.fillStyle = capCol ?? shade(col, 1.15); trace(ctx, b); ctx.fill();
  return b;
}
// 땅 위 원(쿼터뷰에서는 납작한 타원)
export function disc(pen, x, y, r, fill, z = 0) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(sx, sy, r * zoom, r * 0.5 * zoom, 0, 0, Math.PI * 2); ctx.fill();
}
export function ring(pen, x, y, r, col, w = 1, z = 0) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z);
  ctx.strokeStyle = col; ctx.lineWidth = w * zoom; ctx.beginPath(); ctx.ellipse(sx, sy, r * zoom, r * 0.5 * zoom, 0, 0, Math.PI * 2); ctx.stroke();
}
// 가장자리가 부드럽게 사라지는 땅 얼룩
export function soft(pen, x, y, r, col, a) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y);
  ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * zoom);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.6, rgba(col, a * 0.6)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * zoom, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// 들쭉날쭉한 땅 조각(얼룩·웅덩이·기름 자국)
export function splat(pen, x, y, r, fill, R, n = 9, z = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) { const f = (i / n) * Math.PI * 2, k = r * (0.6 + R() * 0.5); pts.push([x + Math.cos(f) * k, y + Math.sin(f) * k, z]); }
  poly(pen, pts, fill);
}
// 화면에서 동그란 덩어리(잎·머리·연기)
export function puff(pen, x, y, z, r, col) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, r * zoom, 0, Math.PI * 2); ctx.fill();
}
export function shadow(pen, x, y, r, a = 0.32) {
  soft(pen, x, y, r * 1.15, '#000000', a);
}
// 낮은 다각형 덩어리(바위·쓰레기 봉투): 고리 3개를 이어 면을 만들고, 면 방향에 따라 명암
export function lump(pen, x, y, r, h, col, R, o = {}) {
  const n = o.n ?? 8, sq = o.squash ?? 1;
  const c = Math.cos(o.rot ?? 0), sn = Math.sin(o.rot ?? 0);
  const mk = (rad, z, jit) => Array.from({ length: n }, (_, i) => {
    const f = (i / n) * Math.PI * 2, k = rad * (1 - jit / 2 + R() * jit), u = Math.cos(f) * k, v = Math.sin(f) * k * sq;
    return [x + u * c - v * sn, y + u * sn + v * c, z + (o.z0 ?? 0)];
  });
  const r0 = mk(r, 0, 0.25), r1 = mk(r * (o.mid ?? 0.86), h * 0.55, 0.25), r2 = mk(r * (o.top ?? 0.48), h, 0.3);
  const faces = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, f = ((i + 0.5) / n) * Math.PI * 2 + (o.rot ?? 0), nx = Math.cos(f), ny = Math.sin(f);
    if (nx + ny > -0.2) faces.push({ pts: [r0[i], r0[j], r1[j], r1[i]], k: r0[i][0] + r0[i][1] + r0[j][0] + r0[j][1], c: sideTone(col, nx, ny) });
    faces.push({ pts: [r1[i], r1[j], r2[j], r2[i]], k: 1e5 + r1[i][0] + r1[i][1] + r1[j][0] + r1[j][1], c: shade(sideTone(col, nx, ny), 1.12) });
  }
  faces.sort((a, b) => a.k - b.k);
  for (const f of faces) poly(pen, f.pts, f.c);
  poly(pen, r2, shade(col, 1.05));
  return r2;
}

// ---------- 땅(4×4 타일 덩어리 단위로 미리 그린다) ----------
// 구역별 땅: 기지 주변 다진 흙 · 주택가 잔디 · 상가 보도블록 · 공단 갈라진 콘크리트 · 폐허 도심 그을린 콘크리트 · 검은 숲 숲 바닥 · 군사 구역 마른 흙
export const ZONE_PAL = [
  { base: '#3b3a2b', alt: '#33402b', dark: '#2c2b20' },
  { base: '#2f3e29', alt: '#3c3b2b', dark: '#25321f' },
  { base: '#3b3e43', alt: '#34373b', dark: '#2c2f33' },
  { base: '#3b3934', alt: '#302e2a', dark: '#262420' },
  { base: '#36373b', alt: '#2c2d30', dark: '#232326' },
  { base: '#29301f', alt: '#33301f', dark: '#1d2317' },
  { base: '#47402e', alt: '#3c3626', dark: '#332d1f' },
];
const LAST = ZONE_PAL.length - 1;
const Z = { downtown: 4, forest: 5, military: 6 };
const ASPHALT = '#26292e';
// 구역 경계는 위험도 ±0.15 구간에서 섞어 계단처럼 끊기지 않게 한다
function zoneColor(d, key) {
  const z = Math.max(0, Math.min(LAST, Math.floor(d))), t = d - Math.floor(d);
  if (z > 0 && t < 0.15 && d < LAST + 1) return mix(ZONE_PAL[z - 1][key], ZONE_PAL[z][key], 0.5 + t / 0.3);
  if (z < LAST && t > 0.85) return mix(ZONE_PAL[z][key], ZONE_PAL[z + 1][key], (t - 0.85) / 0.3);
  return ZONE_PAL[z][key];
}

// pen.P는 덩어리 원점이 이미 반영된 월드 좌표용. X0,Y0 = 덩어리 왼쪽 위(월드), n = 한 변 타일 수.
// 이웃 타일까지 한 칸 더 넓혀 장식을 그리고 자기 마름모로 잘라서, 덩어리끼리 이음매가 보이지 않는다.
export function drawGround(pen, X0, Y0, n, TILE, dangerAt, roadAt) {
  const { ctx, P } = pen, S = n * TILE;
  const corner = [P(X0, Y0), P(X0 + S, Y0), P(X0 + S, Y0 + S), P(X0, Y0 + S)];
  const cxs = (corner[0][0] + corner[2][0]) / 2, cys = (corner[0][1] + corner[2][1]) / 2;
  ctx.save();
  trace(ctx, corner.map(([x, y]) => [cxs + (x - cxs) * 1.004 + Math.sign(x - cxs) * 0.6, cys + (y - cys) * 1.004 + Math.sign(y - cys) * 0.6]));
  ctx.clip();
  const t0x = Math.round(X0 / TILE), t0y = Math.round(Y0 / TILE);
  const tiles = [];
  for (let ty = t0y - 1; ty <= t0y + n; ty++) for (let tx = t0x - 1; tx <= t0x + n; tx++) {
    const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2, d = dangerAt(cx, cy);
    tiles.push({ tx, ty, cx, cy, d, z: Math.max(0, Math.min(LAST, Math.floor(d))), road: roadAt(tx, ty) });
  }
  // 1) 바탕: 타일 경계가 드러나지 않게 아주 작은 차이만 둔다
  for (const t of tiles) {
    poly(pen, [[t.tx * TILE - 0.6, t.ty * TILE - 0.6], [t.tx * TILE + TILE + 0.6, t.ty * TILE - 0.6], [t.tx * TILE + TILE + 0.6, t.ty * TILE + TILE + 0.6], [t.tx * TILE - 0.6, t.ty * TILE + TILE + 0.6]],
      t.road ? shade(ASPHALT, 0.97 + hash(t.tx, t.ty, 7) * 0.06) : shade(zoneColor(t.d, 'base'), 0.97 + hash(t.tx, t.ty, 7) * 0.05));
  }
  // 2) 넓은 얼룩: 이웃 타일 것까지 그려서 타일 격자를 지운다
  for (const t of tiles) {
    if (t.road) continue;
    const R = rng(hash(t.tx, t.ty, 11));
    for (let i = 0; i < 3; i++) soft(pen, t.cx + (R() - 0.5) * TILE, t.cy + (R() - 0.5) * TILE, 26 + R() * 34, R() < 0.55 ? zoneColor(t.d, 'alt') : zoneColor(t.d, 'dark'), 0.55 + R() * 0.3);
  }
  // 3) 도로
  for (const t of tiles) if (t.road) drawRoadTile(pen, t, TILE, roadAt);
  // 4) 잔장식
  for (const t of tiles) if (!t.road) drawDecals(pen, t, TILE);
  ctx.restore();
}

function drawRoadTile(pen, t, TILE, roadAt) {
  const x0 = t.tx * TILE, y0 = t.ty * TILE, x1 = x0 + TILE, y1 = y0 + TILE;
  const R = rng(hash(t.tx, t.ty, 23));
  const alongX = roadAt(t.tx - 1, t.ty) && roadAt(t.tx + 1, t.ty); // x 방향으로 뻗은 도로
  const alongY = roadAt(t.tx, t.ty - 1) && roadAt(t.tx, t.ty + 1);
  const cross = alongX && alongY;
  const wear = Math.min(1, t.d / 6.5); // 바깥 구역일수록 많이 부서졌다
  // 보도: 도로 옆이 도로가 아니면 가장자리 10만큼 보도블록과 연석
  const walk = '#4a4b4c', curb = '#6f7071';
  const side = (cond, pts, c1, c2) => { if (!cond) return; poly(pen, pts, walk); polyline(pen, [c1, c2], curb, 1.4); };
  side(!roadAt(t.tx, t.ty - 1), [[x0, y0], [x1, y0], [x1, y0 + 10], [x0, y0 + 10]], [x0, y0 + 10], [x1, y0 + 10]);
  side(!roadAt(t.tx, t.ty + 1), [[x0, y1 - 10], [x1, y1 - 10], [x1, y1], [x0, y1]], [x0, y1 - 10], [x1, y1 - 10]);
  side(!roadAt(t.tx - 1, t.ty), [[x0, y0], [x0 + 10, y0], [x0 + 10, y1], [x0, y1]], [x0 + 10, y0], [x0 + 10, y1]);
  side(!roadAt(t.tx + 1, t.ty), [[x1 - 10, y0], [x1, y0], [x1, y1], [x1 - 10, y1]], [x1 - 10, y0], [x1 - 10, y1]);
  // 보도블록 줄눈
  for (let k = 2.5; k < TILE; k += 7.5) {
    if (!roadAt(t.tx, t.ty - 1)) line(pen, [x0 + k, y0], [x0 + k, y0 + 10], 'rgba(0,0,0,0.18)', 0.6);
    if (!roadAt(t.tx, t.ty + 1)) line(pen, [x0 + k, y1 - 10], [x0 + k, y1], 'rgba(0,0,0,0.18)', 0.6);
    if (!roadAt(t.tx - 1, t.ty)) line(pen, [x0, y0 + k], [x0 + 10, y0 + k], 'rgba(0,0,0,0.18)', 0.6);
    if (!roadAt(t.tx + 1, t.ty)) line(pen, [x1 - 10, y0 + k], [x1, y0 + k], 'rgba(0,0,0,0.18)', 0.6);
  }
  // 아스팔트 결: 밝고 어두운 작은 점
  for (let i = 0; i < 26; i++) disc(pen, x0 + 10 + R() * (TILE - 20), y0 + 10 + R() * (TILE - 20), 0.6 + R() * 0.9, R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.16)');
  const paint = `rgba(214,198,140,${0.42 - wear * 0.2})`;
  if (!cross) {
    // 가운데 차선(점선)과 교차로 앞 횡단보도
    if (alongX) for (let k = 4; k < TILE; k += 26) if (R() > wear * 0.5) poly(pen, [[x0 + k, y0 + 39], [x0 + k + 13, y0 + 39], [x0 + k + 13, y0 + 41], [x0 + k, y0 + 41]], paint);
    if (alongY) for (let k = 4; k < TILE; k += 26) if (R() > wear * 0.5) poly(pen, [[x0 + 39, y0 + k], [x0 + 41, y0 + k], [x0 + 41, y0 + k + 13], [x0 + 39, y0 + k + 13]], paint);
    const nearX = alongX && (roadAt(t.tx - 1, t.ty - 1) || roadAt(t.tx + 1, t.ty - 1));
    const nearY = alongY && (roadAt(t.tx - 1, t.ty - 1) || roadAt(t.tx - 1, t.ty + 1));
    if (nearX) { const xe = roadAt(t.tx - 1, t.ty - 1) ? x0 + 4 : x1 - 14; for (let k = 13; k < TILE - 12; k += 7) poly(pen, [[xe, y0 + k], [xe + 10, y0 + k], [xe + 10, y0 + k + 3.5], [xe, y0 + k + 3.5]], `rgba(225,225,215,${0.36 - wear * 0.15})`); }
    if (nearY) { const ye = roadAt(t.tx - 1, t.ty - 1) ? y0 + 4 : y1 - 14; for (let k = 13; k < TILE - 12; k += 7) poly(pen, [[x0 + k, ye], [x0 + k + 3.5, ye], [x0 + k + 3.5, ye + 10], [x0 + k, ye + 10]], `rgba(225,225,215,${0.36 - wear * 0.15})`); }
  }
  // 맨홀·기름 자국·균열·움푹 팬 곳
  if (R() < 0.12) { const mx = x0 + 22 + R() * 36, my = y0 + 22 + R() * 36; disc(pen, mx, my, 6, '#1d1f22'); ring(pen, mx, my, 6, '#4a4d52', 1); line(pen, [mx - 4, my], [mx + 4, my], '#3a3d42', 0.8); line(pen, [mx, my - 4], [mx, my + 4], '#3a3d42', 0.8); }
  if (R() < 0.35) splat(pen, x0 + 15 + R() * 50, y0 + 15 + R() * 50, 4 + R() * 7, 'rgba(10,10,14,0.35)', R);
  const cracks = Math.floor(R() * (1 + wear * 4));
  for (let i = 0; i < cracks; i++) {
    let x = x0 + 12 + R() * 56, y = y0 + 12 + R() * 56; const pts = [[x, y]];
    for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 16; y += (R() - 0.5) * 16; pts.push([Math.max(x0 + 2, Math.min(x1 - 2, x)), Math.max(y0 + 2, Math.min(y1 - 2, y))]); }
    polyline(pen, pts, 'rgba(8,9,11,0.55)', 0.8);
  }
  if (R() < wear * 0.5) { const px = x0 + 18 + R() * 44, py = y0 + 18 + R() * 44, r = 4 + R() * 6; splat(pen, px, py, r, '#1b1d20', R); splat(pen, px - 1, py - 1, r * 0.7, '#141518', R); }
  if (wear > 0.6 && R() < 0.5) soft(pen, x0 + R() * TILE, y0 + R() * TILE, 18 + R() * 16, ZONE_PAL[t.z].base, 0.55); // 흙·모래가 덮였다
}

function tuft(pen, x, y, h, col, R) {
  for (let i = 0; i < 3; i++) line(pen, [x + (i - 1) * 0.8, y], [x + (i - 1) * 2.2 + (R() - 0.5), y + (R() - 0.5) * 2, h * (0.7 + R() * 0.5)], col, 0.9);
}
function drawDecals(pen, t, TILE) {
  const R = rng(hash(t.tx, t.ty, 31)), x0 = t.tx * TILE, y0 = t.ty * TILE;
  const at = () => [x0 + R() * TILE, y0 + R() * TILE];
  const z = t.z;
  if (z === 1) {
    if (R() < 0.18) { // 꽃밭: 흙 위에 줄지어 핀 꽃
      const [x, y] = at(), w = 14 + R() * 10, d = 8 + R() * 5;
      poly(pen, [[x, y], [x + w, y], [x + w, y + d], [x, y + d]], '#3a2e20');
      polyline(pen, [[x, y + d], [x + w, y + d], [x + w, y]], 'rgba(150,140,120,0.5)', 1);
      for (let i = 0; i < 10; i++) { const fx = x + 2 + R() * (w - 4), fy = y + 2 + R() * (d - 4); line(pen, [fx, fy, 0], [fx, fy, 2], '#4f6b37', 0.6); puff(pen, fx, fy, 2.4, 1, ['#d84a5a', '#e8c84a', '#e8e0f0', '#b06ad0'][i % 4]); }
    }
    if (R() < 0.12) { const [x, y] = at(), ang = R() * Math.PI; for (let i = 0; i < 4; i++) { const sx = x + Math.cos(ang) * i * 7, sy = y + Math.sin(ang) * i * 7; disc(pen, sx, sy, 2.6, '#6a6862'); disc(pen, sx - 0.4, sy - 0.4, 1.9, '#7e7c76'); } } // 디딤돌 길
    for (let i = 0; i < 3; i++) if (R() < 0.5) { const [x, y] = at(); line(pen, [x, y, 0], [x, y, 2.5], '#5c7240', 0.5); puff(pen, x, y, 2.8, 1.1, R() < 0.6 ? '#e8c84a' : '#f0f0e8'); } // 민들레
  }
  if (z === 2) {
    // 점자 블록: 도로 바로 옆 타일에 도로를 따라 끊김 없이 이어지는 노란 띠
    const md = (a) => ((a % 7) + 7) % 7, tile = (bx0, by0, bx1, by1, horiz) => {
      poly(pen, [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], 'rgba(185,160,60,0.55)');
      if (horiz) for (let k = bx0 + 2; k < bx1; k += 4) disc(pen, k, (by0 + by1) / 2, 0.6, 'rgba(110,95,30,0.7)');
      else for (let k = by0 + 2; k < by1; k += 4) disc(pen, (bx0 + bx1) / 2, k, 0.6, 'rgba(110,95,30,0.7)');
    };
    if (md(t.ty) === 2) tile(x0, y0 + TILE - 8, x0 + TILE, y0 + TILE - 4, true);
    if (md(t.ty) === 4) tile(x0, y0 + 4, x0 + TILE, y0 + 8, true);
    if (md(t.tx) === 2) tile(x0 + TILE - 8, y0, x0 + TILE - 4, y0 + TILE, false);
    if (md(t.tx) === 4) tile(x0 + 4, y0, x0 + 8, y0 + TILE, false);
    if (R() < 0.25) { const [x, y] = at(); poly(pen, [[x, y], [x + 8, y], [x + 8, y + 5], [x, y + 5]], '#1e2024'); for (let k = 1; k < 8; k += 1.6) line(pen, [x + k, y + 0.6], [x + k, y + 4.4], '#4a4d52', 0.5); } // 배수구 덮개
    for (let i = 0; i < 3; i++) if (R() < 0.5) { const [x, y] = at(), ang = R() * 3; const c = ['#3a6a3a', '#6a4a22', '#b9c0ca'][i % 3]; line(pen, [x, y, 0.6], [x + Math.cos(ang) * 3.5, y + Math.sin(ang) * 3.5, 0.6], c, 1.6); disc(pen, x, y, 0.5, 'rgba(255,255,255,0.5)', 1.2); } // 빈 병·캔
    if (R() < 0.3) { const [x, y] = at(); poly(pen, [[x, y], [x + 6, y + 1], [x + 5, y + 8], [x - 1, y + 7]], ['#d84a5a', '#e8c84a', '#5aa9dc'][Math.floor(R() * 3)]); line(pen, [x + 1, y + 2], [x + 4, y + 3], 'rgba(0,0,0,0.4)', 0.5); } // 찢어진 전단
  }
  if (z === 2) {
    // 상가: 보도블록 줄눈(일부는 깨져 있다)
    for (let k = 20; k < TILE; k += 20) { line(pen, [x0 + k, y0], [x0 + k, y0 + TILE], 'rgba(0,0,0,0.22)', 0.7); line(pen, [x0, y0 + k], [x0 + TILE, y0 + k], 'rgba(0,0,0,0.22)', 0.7); }
    for (let i = 0; i < 2; i++) if (R() < 0.5) { const bx = x0 + Math.floor(R() * 4) * 20, by = y0 + Math.floor(R() * 4) * 20; poly(pen, [[bx + 1, by + 1], [bx + 19, by + 1], [bx + 19, by + 19], [bx + 1, by + 19]], R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.14)'); }
    for (let i = 0; i < 3; i++) if (R() < 0.5) { const [x, y] = at(); poly(pen, [[x, y], [x + 3, y - 1], [x + 4, y + 2], [x + 1, y + 3]], 'rgba(220,215,200,0.45)'); } // 종이 쓰레기
  }
  if (z === 3) {
    if (((t.ty % 9) + 9) % 9 === 4) { // 버려진 철로: 같은 줄의 타일을 가로질러 이어진다
      poly(pen, [[x0, y0 + 30], [x0 + TILE, y0 + 30], [x0 + TILE, y0 + 50], [x0, y0 + 50]], 'rgba(90,86,80,0.75)'); // 자갈
      for (let i = 0; i < 18; i++) disc(pen, x0 + R() * TILE, y0 + 30 + R() * 20, 0.8, R() < 0.5 ? '#7a7670' : '#4a4740');
      for (let k = 2; k < TILE; k += 8) box(pen, x0 + k, y0 + 32, 3.2, 16, 0.8, '#4a3a2a'); // 침목
      for (const w of [35, 45]) { line(pen, [x0, y0 + w, 1.2], [x0 + TILE, y0 + w, 1.2], '#6a5a4a', 1.4); line(pen, [x0, y0 + w - 0.4, 1.6], [x0 + TILE, y0 + w - 0.4, 1.6], 'rgba(200,190,170,0.35)', 0.5); } // 레일
    }
    if (R() < 0.25) { const [x, y] = at(); poly(pen, [[x, y], [x + 16, y], [x + 16, y + 10], [x, y + 10]], '#5a5c5e'); for (const [dx, dy] of [[1.5, 1.5], [14.5, 1.5], [1.5, 8.5], [14.5, 8.5]]) disc(pen, x + dx, y + dy, 0.6, '#3a3c3e'); splat(pen, x + 10, y + 6, 3, rgba('#7a4a22', 0.5), R); } // 철판
    if (R() < 0.15) { const [x, y] = at(); for (let k = 0; k < 5; k++) poly(pen, [[x + k * 4, y], [x + k * 4 + 2, y], [x + k * 4 + 4, y + 3], [x + k * 4 + 2, y + 3]], k % 2 ? 'rgba(30,30,30,0.7)' : 'rgba(210,180,40,0.7)'); } // 노란·검은 경고선
    for (let i = 0; i < 2; i++) if (R() < 0.6) { // 균열
      let [x, y] = at(); const pts = [[x, y]];
      for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 22; y += (R() - 0.5) * 22; pts.push([x, y]); }
      polyline(pen, pts, 'rgba(10,10,10,0.5)', 0.8);
    }
    if (R() < 0.45) { const [x, y] = at(); splat(pen, x, y, 6 + R() * 9, 'rgba(8,8,10,0.45)', R); soft(pen, x - 2, y - 2, 4, '#5a6a8a', 0.18); } // 기름 자국
    for (let i = 0; i < 4; i++) { const [x, y] = at(); poly(pen, [[x, y], [x + 2.5, y], [x + 2.5, y + 1.5], [x, y + 1.5]], R() < 0.5 ? '#6b4a32' : '#55585c'); } // 녹슨 쇳조각
  }
  if (z === Z.downtown) {
    for (let k = 40; k < TILE; k += 40) { line(pen, [x0 + k, y0], [x0 + k, y0 + TILE], 'rgba(0,0,0,0.3)', 0.8); line(pen, [x0, y0 + k], [x0 + TILE, y0 + k], 'rgba(0,0,0,0.3)', 0.8); } // 큰 콘크리트 판
    for (let i = 0; i < 2; i++) if (R() < 0.7) { let [x, y] = at(); const pts = [[x, y]]; for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 24; y += (R() - 0.5) * 24; pts.push([x, y]); } polyline(pen, pts, 'rgba(8,8,10,0.55)', 0.9); } // 균열
    if (R() < 0.4) { const [x, y] = at(); soft(pen, x, y, 14 + R() * 14, '#121214', 0.6); } // 그을음
    for (let i = 0; i < 5; i++) { const [x, y] = at(); disc(pen, x, y, 0.7, R() < 0.5 ? 'rgba(160,200,220,0.55)' : 'rgba(220,235,240,0.4)'); } // 유리 파편
    for (let i = 0; i < 3; i++) { const [x, y] = at(); poly(pen, [[x, y], [x + 3 + R() * 3, y + R()], [x + 2 + R() * 3, y + 2 + R() * 2], [x, y + 2]], R() < 0.5 ? '#5a5b5e' : '#6e6f72'); } // 콘크리트 조각
    for (let i = 0; i < 2; i++) if (R() < 0.5) { const [x, y] = at(); poly(pen, [[x, y], [x + 3, y - 1], [x + 4, y + 2], [x + 1, y + 3]], 'rgba(220,215,200,0.4)'); } // 종이
  }
  if (z === Z.forest) {
    for (let i = 0; i < 10; i++) { const [x, y] = at(); disc(pen, x, y, 1 + R() * 0.8, ['#5a3a1e', '#6e4a22', '#4a3018', '#7a5a2a'][i % 4]); } // 낙엽
    for (let i = 0; i < 2; i++) if (R() < 0.6) { let [x, y] = at(); const pts = [[x, y]]; for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 14; y += (R() - 0.5) * 14; pts.push([x, y]); } polyline(pen, pts, 'rgba(60,40,22,0.8)', 1.3); } // 뿌리
    for (let i = 0; i < 3; i++) { const [x, y] = at(); line(pen, [x, y], [x + (R() - 0.5) * 8, y + (R() - 0.5) * 8], '#3a2a1a', 0.8); } // 잔가지
    if (R() < 0.3) for (let i = 0; i < 3; i++) { const [x, y] = at(); line(pen, [x, y, 0], [x, y, 1.6], '#d8d0c0', 0.6); puff(pen, x, y, 2, 1.1, R() < 0.3 ? '#a03a2a' : '#d8d0c0'); } // 버섯
    if (R() < 0.5) { const [x, y] = at(); soft(pen, x, y, 10 + R() * 10, '#33452a', 0.6); } // 이끼
  }
  if (z === Z.military) {
    if (R() < 0.35) { // 바퀴 자국
      const ax = R() < 0.5, o = 18 + R() * 30;
      for (const w of [0, 9]) polyline(pen, ax ? [[x0, y0 + o + w], [x0 + TILE, y0 + o + w + (R() - 0.5) * 6]] : [[x0 + o + w, y0], [x0 + o + w + (R() - 0.5) * 6, y0 + TILE]], 'rgba(20,16,10,0.32)', 2.4);
    }
    if (R() < 0.12) { const [x, y] = at(); disc(pen, x, y, 13, 'rgba(22,18,12,0.55)'); ring(pen, x, y, 14, 'rgba(110,98,72,0.5)', 2); disc(pen, x + 1, y + 1, 7, 'rgba(10,8,6,0.45)'); } // 포탄 구덩이
    for (let i = 0; i < 3; i++) { const [x, y] = at(); line(pen, [x, y], [x + 8, y + 3], 'rgba(120,108,80,0.35)', 0.8); } // 모래 물결
  }
  // 풀: 기지 주변·주택가는 많이, 바깥은 마르고 드물게
  const grass = [7, 12, 1, 2, 1, 10, 3][z], gcol = [['#4d6136', '#5c7240'], ['#4f6b37', '#628245'], ['#4f5a3a', '#5a6340'], ['#58603d', '#646a42'], ['#4f5a3a', '#5a6340'], ['#3a5230', '#466238'], ['#7a7044', '#8a7d4c']][z];
  for (let i = 0; i < grass; i++) { const [x, y] = at(); tuft(pen, x, y, 4 + R() * 3, gcol[i % 2], R); }
  // 자갈
  for (let i = 0; i < 5; i++) { const [x, y] = at(); disc(pen, x, y, 0.8 + R() * 1.2, R() < 0.5 ? 'rgba(160,155,140,0.35)' : 'rgba(0,0,0,0.25)'); }
  if (z === 1) {
    for (let i = 0; i < 4; i++) { const [x, y] = at(); disc(pen, x, y, 1.2, ['#8a5a2a', '#9a6a30', '#6a4a22'][i % 3]); } // 낙엽
    if (R() < 0.3) for (let i = 0; i < 4; i++) { const [x, y] = at(); disc(pen, x, y, 1, ['#c9c35a', '#d9d9d0', '#b06a8a'][i % 3]); } // 들꽃
  }
  if ((z === 1 || z === 2) && R() < 0.06) { const [x, y] = at(); splat(pen, x, y, 9, 'rgba(70,85,100,0.55)', R); soft(pen, x - 2, y - 2, 4, '#9ab0c0', 0.25); } // 웅덩이
  if (z > 0 && R() < 0.05) { const [x, y] = at(); splat(pen, x, y, 5 + R() * 5, 'rgba(70,12,12,0.45)', R); disc(pen, x + 7, y + 3, 1.5, 'rgba(70,12,12,0.45)'); } // 핏자국
}

// ---------- 장애물(통과·파밍 불가) ----------
// along = 긴 쪽이 x축 방향인지(rot 0). v = 변형 번호(0~2). 크기는 logic.js OBSTACLE_TYPES.r 안에 들어간다.
export const OBSTACLE_BOX = { rock: 22, rubble: 26, wall: 30, deadtree: 20, barrier: 22, container: 38, sandbags: 24, tanktrap: 20, tree: 26, hedge: 28, busstop: 30, kiosk: 28, pipes: 32, tank: 34, ruin: 42, bus: 40, pine: 22, bramble: 26, bunker: 36, tankwreck: 38 }; // 그림 반지름
export const OBSTACLE_H = { rock: 18, rubble: 20, wall: 34, deadtree: 50, barrier: 18, container: 30, sandbags: 16, tanktrap: 24, tree: 52, hedge: 18, busstop: 34, kiosk: 30, pipes: 24, tank: 46, ruin: 52, bus: 28, pine: 64, bramble: 18, bunker: 24, tankwreck: 28 };
export function drawObstacle(pen, type, r, along, v) {
  const R = rng(hash(v + 1, type.length, 97));
  const M = (u, w, z = 0) => (along ? [u, w, z] : [w, u, z]);
  const mbox = (u, w, lu, lw, h, col, z0 = 0) => (along ? box(pen, u, w, lu, lw, h, col, z0) : box(pen, w, u, lw, lu, h, col, z0));
  const mpoly = (pts, fill) => poly(pen, pts.map((p) => M(...p)), fill);
  const mline = (a, b, col, w) => line(pen, M(...a), M(...b), col, w);
  const mtone = (col, nu, nw) => (along ? sideTone(col, nu, nw) : sideTone(col, nw, nu));
  switch (type) {
    case 'rock': {
      const col = ['#7a766e', '#6c6a64', '#857c6c'][v];
      shadow(pen, 0, 0, r);
      const top = lump(pen, -3, -2, 15, 15, col, R, { n: 7, rot: R() });
      lump(pen, 9, 7, 7, 7, shade(col, 0.92), R, { n: 6 });
      lump(pen, -12, 9, 4, 3, shade(col, 0.85), R, { n: 5 });
      if (v !== 1) poly(pen, [top[0], top[1], top[2], [(-3 + top[1][0]) / 2, (-2 + top[1][1]) / 2, 15]], rgba('#56763a', 0.75)); // 이끼
      polyline(pen, [[-8, 4, 8], [-4, 5, 4], [-2, 7, 1]], 'rgba(0,0,0,0.35)', 0.8);
      break;
    }
    case 'rubble': {
      const col = ['#8f9396', '#9a968c', '#868a8e'][v];
      shadow(pen, 0, 0, r);
      for (let i = 0; i < 9; i++) disc(pen, (R() - 0.5) * 36, (R() - 0.5) * 30, 1 + R() * 1.6, R() < 0.5 ? '#6a6d70' : '#a5a8aa');
      rbox(pen, -8, -6, 18, 12, 6, R() * 3, shade(col, 0.95));
      rbox(pen, 6, -4, 14, 10, 9, R() * 3, col);
      rbox(pen, -3, 7, 16, 9, 5, R() * 3, shade(col, 1.05));
      rbox(pen, 2, 0, 10, 8, 6, R() * 3, shade(col, 1.1), 8);
      for (let i = 0; i < 2; i++) { const a = R() * 6; polyline(pen, [[2 + Math.cos(a) * 2, Math.sin(a) * 2, 13], [3 + Math.cos(a) * 5, Math.sin(a) * 5, 18 + R() * 3], [4 + Math.cos(a) * 8, Math.sin(a) * 6, 16]], '#8a4e2c', 1); } // 철근
      polyline(pen, [[-12, -4, 6], [-6, -2, 6], [-4, -6, 6]], 'rgba(0,0,0,0.3)', 0.7);
      break;
    }
    case 'wall': {
      const col = ['#9a5a45', '#8c8780', '#a07c52'][v], L = r * 1.8, n = 7, hs = [26, 31, 22, 27, 15, 19, 8];
      shadow(pen, 0, 0, r * 0.9);
      for (let i = 0; i < n; i++) {
        const u = -L / 2 + (L / n) * i, h = hs[(i + v * 2) % n];
        mbox(u, -4, L / n + 0.1, 8, h, col);
        // 벽돌 줄눈(보이는 긴 면)
        for (let z = 4; z < h; z += 4) mline([u, 4, z], [u + L / n, 4, z], 'rgba(30,18,12,0.45)', 0.6);
        for (let z = 0, k = 0; z < h - 1; z += 4, k++) { const j = u + ((k % 2) * 3.3 + 1.6); if (j < u + L / n) mline([j, 4, z], [j, 4, Math.min(h, z + 4)], 'rgba(30,18,12,0.4)', 0.6); }
        mpoly([[u, -4, h], [u + L / n, -4, h], [u + L / n, 4, h], [u, 4, h]], shade(col, 1.08));
      }
      mpoly([[-L / 2 + 6, 4.05, 10], [-L / 2 + 13, 4.05, 9], [-L / 2 + 12, 4.05, 16], [-L / 2 + 7, 4.05, 15]], rgba('#2a2a2a', 0.35)); // 그을음
      if (v === 0) mpoly([[4, 4.05, 6], [16, 4.05, 6], [16, 4.05, 12], [4, 4.05, 12]], rgba('#3f7fa8', 0.45)); // 낙서
      for (let i = 0; i < 6; i++) { const [bx, by] = M((R() - 0.5) * L, 8 + R() * 7); rbox(pen, bx, by, 3.5, 2, 1.8, R() * 3, col); } // 떨어진 벽돌
      break;
    }
    case 'deadtree': {
      const col = ['#5b4a3a', '#4e4238', '#62503c'][v];
      shadow(pen, 0, 0, r);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + R(); polyline(pen, [[0, 0, 2], [Math.cos(a) * 6, Math.sin(a) * 6, 0.5], [Math.cos(a) * 10, Math.sin(a) * 10, 0]], col, 2.2); }
      cyl(pen, 0, 0, 3.4, 30, col, 0, shade(col, 0.9));
      for (let z = 4; z < 28; z += 5) polyline(pen, [[-2, 3, z], [-1.5, 3.2, z + 3]], 'rgba(0,0,0,0.35)', 0.6);
      const br = [[-14, 2, 22, 40], [12, -4, 25, 46], [4, 11, 27, 40], [-6, -10, 29, 48]].slice(0, v === 2 ? 2 : 4);
      for (const [dx, dy, z1, z2] of br) {
        const mid = [dx * 0.5, dy * 0.5, (z1 + z2) / 2 - 3];
        polyline(pen, [[0, 0, z1], mid], col, 2.4);
        polyline(pen, [mid, [dx, dy, z2]], col, 1.4);
        polyline(pen, [[dx, dy, z2], [dx * 1.2 + 2, dy * 1.1, z2 + 4]], col, 0.8);
        polyline(pen, [mid, [mid[0] + 4, mid[1] - 3, mid[2] + 6]], col, 0.8);
      }
      if (v === 1) for (let i = 0; i < 6; i++) puff(pen, (R() - 0.5) * 24, (R() - 0.5) * 20, 34 + R() * 12, 1.4, '#7a5a2a'); // 마른 잎
      break;
    }
    case 'barrier': {
      const col = ['#b2b5b7', '#a8a59c', '#b7b9bb'][v], L = r * 1.8;
      shadow(pen, 0, 0, r * 0.9);
      mpoly([[-L / 2, 5, 0], [L / 2, 5, 0], [L / 2, 5, 3], [-L / 2, 5, 3]], mtone(col, 0, 1));
      mpoly([[-L / 2, 5, 3], [L / 2, 5, 3], [L / 2, 2.5, 14], [-L / 2, 2.5, 14]], shade(mtone(col, 0, 1), 1.1));
      mpoly([[-L / 2, -2.5, 14], [L / 2, -2.5, 14], [L / 2, 2.5, 14], [-L / 2, 2.5, 14]], shade(col, 1.06));
      mpoly([[L / 2, -5, 0], [L / 2, 5, 0], [L / 2, 5, 3], [L / 2, 2.5, 14], [L / 2, -2.5, 14], [L / 2, -5, 3]], mtone(col, 1, 0));
      if (v === 1) for (let u = -L / 2 + 2; u < L / 2 - 4; u += 8) mpoly([[u, 5, 3], [u + 4, 5, 3], [u + 6, 2.5, 14], [u + 2, 2.5, 14]], rgba('#b8412f', 0.85)); // 경고 줄무늬
      if (v === 2) mpoly([[-6, 4.6, 5], [5, 3.8, 9], [6, 3.6, 11], [-4, 4.2, 8]], rgba('#6a3a8a', 0.6)); // 낙서
      mline([-L / 2, 5, 3], [L / 2, 5, 3], 'rgba(0,0,0,0.25)', 0.7);
      for (let i = 0; i < 4; i++) { const u = (R() - 0.5) * (L - 6), z = 5 + R() * 6; mline([u, 4.3 - z * 0.2, z], [u + 2 + R() * 3, 4.1 - z * 0.2, z + 1 + R()], 'rgba(0,0,0,0.25)', 0.6); } // 긁힌 자국
      break;
    }
    case 'container': {
      const col = ['#7a4a32', '#3d5a72', '#4f6a48'][v], L = r * 1.7, W = r * 0.9, H = 26;
      shadow(pen, 0, 0, r * 0.95, 0.38);
      mbox(-L / 2, -W / 2, L, W, H, col);
      // 주름 철판: 긴 면 세로줄
      for (let u = -L / 2 + 1.5; u < L / 2; u += 3) mline([u, W / 2, 1], [u, W / 2, H - 1], (Math.round(u) % 2) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.22)', 0.8);
      mline([-L / 2, W / 2, H - 1.5], [L / 2, W / 2, H - 1.5], 'rgba(0,0,0,0.3)', 1);
      mline([-L / 2, W / 2, 1.5], [L / 2, W / 2, 1.5], 'rgba(0,0,0,0.3)', 1);
      // 끝면 문짝·잠금 막대
      mline([L / 2, 0, 1], [L / 2, 0, H - 1], 'rgba(0,0,0,0.45)', 1);
      for (const w of [-W / 2 + 4, -3, 3, W / 2 - 4]) mline([L / 2, w, 2], [L / 2, w, H - 2], 'rgba(220,220,210,0.35)', 0.9);
      if (v === 2) mpoly([[L / 2, 0, 1], [L / 2, W / 2 - 1, 1], [L / 2, W / 2 - 1, H - 1], [L / 2, 0, H - 1]], '#16181b'); // 열린 문
      // 녹물 자국
      for (let i = 0; i < 5; i++) { const u = (R() - 0.5) * (L - 6), h = 6 + R() * 12; mpoly([[u, W / 2 + 0.05, H - 1], [u + 2.5, W / 2 + 0.05, H - 1], [u + 2, W / 2 + 0.05, H - 1 - h], [u + 0.5, W / 2 + 0.05, H - 1 - h]], rgba('#8a4a22', 0.45)); }
      for (let u = -L / 2 + 6; u < L / 2; u += 12) mline([u, -W / 2, H], [u, W / 2, H], 'rgba(0,0,0,0.18)', 0.8); // 지붕 골
      mpoly([[-L / 2 + 8, W / 2 + 0.05, 9], [-L / 2 + 20, W / 2 + 0.05, 9], [-L / 2 + 20, W / 2 + 0.05, 15], [-L / 2 + 8, W / 2 + 0.05, 15]], rgba('#e8e2d0', 0.25)); // 지워진 상표
      break;
    }
    case 'sandbags': {
      const cols = ['#a89268', '#b8a37a', '#9c8a62'];
      shadow(pen, 0, 0, r * 0.9);
      const bags = [];
      for (let row = 0; row < 3; row++) for (let i = -2; i <= 2; i++) {
        if (row === 1 && i === 2) continue;
        if (row === 2 && (i < -1 || i > 0)) continue;
        const u = i * 7.5 + (row % 2 ? 3.75 : 0), w = -(u * u) / 60 + row * -1.2;
        bags.push({ u, w, z: row * 5, k: u + w + row * 100 });
      }
      bags.sort((a, b) => a.k - b.k);
      for (const b of bags) {
        const c = cols[Math.floor(R() * 3)], [x, y, z] = M(b.u, b.w, b.z);
        lump(pen, x, y, 4.4, 5.2, c, R, { n: 7, squash: 0.62, rot: along ? Math.atan2(-b.u / 30, 1) : Math.PI / 2 + Math.atan2(-b.u / 30, 1), z0: z, mid: 1, top: 0.7 });
        line(pen, M(b.u, b.w - 2.4, b.z + 5), M(b.u, b.w + 2.4, b.z + 5), 'rgba(60,45,25,0.5)', 0.6);
      }
      break;
    }
    case 'tanktrap': {
      const col = ['#4a4f55', '#5a4a40', '#4c5258'][v];
      shadow(pen, 0, 0, r);
      if (v === 2) box(pen, -12, -12, 24, 24, 3, '#8a8d90');
      const z0 = v === 2 ? 3 : 0;
      const beams = [[[-13, -5, z0], [13, 5, z0 + 20]], [[-5, 13, z0], [5, -13, z0 + 20]], [[-10, 10, z0 + 20], [10, -10, z0]]];
      beams.sort((a, b) => (a[0][0] + a[0][1] + a[1][0] + a[1][1]) - (b[0][0] + b[0][1] + b[1][0] + b[1][1]));
      for (const [a, b] of beams) {
        line(pen, a, b, shade(col, 0.7), 4.6);
        line(pen, [a[0], a[1], a[2] + 1], [b[0], b[1], b[2] + 1], col, 2.6);
        line(pen, [a[0], a[1], a[2] + 1.8], [b[0], b[1], b[2] + 1.8], shade(col, 1.45), 0.8);
        for (let i = 0; i < 2; i++) { const t = R(); puff(pen, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + 1, 1.2, rgba('#8a4a22', 0.8)); }
      }
      break;
    }
    case 'tree': { // 가로수: 0 잎 무성 · 1 단풍 · 2 반쯤 앙상
      const leaf = [['#2f4a28', '#3d5d32', '#4f7340'], ['#7a4a1e', '#a0622a', '#c08a3a'], ['#3a4a2a', '#4a5a32', '#5a6a3a']][v];
      shadow(pen, 4, 4, 22, 0.3);
      disc(pen, 0, 0, 7, '#2e2a20'); ring(pen, 0, 0, 7, '#5a5850', 1); // 가로수 받침
      for (let i = 0; i < 3; i++) { const a = R() * 6.3; polyline(pen, [[0, 0, 1], [Math.cos(a) * 5, Math.sin(a) * 5, 0.3]], '#4a3a2a', 1.6); }
      cyl(pen, 0, 0, 2.8, 24, '#5a4632', 0, '#4a3a28');
      polyline(pen, [[0, 0, 18], [-6, 2, 26]], '#5a4632', 1.6); polyline(pen, [[0, 0, 20], [5, -3, 28]], '#5a4632', 1.4);
      const n = v === 2 ? 6 : 13;
      const puffs = [];
      for (let i = 0; i < n; i++) { const a = R() * 6.3, r = R() * 11; puffs.push([Math.cos(a) * r, Math.sin(a) * r * 0.9, 26 + R() * 14, 6 + R() * 4]); }
      puffs.sort((p, q) => p[0] + p[1] - (q[0] + q[1]) + (p[2] - q[2]) * 0.4);
      for (const [x, y, z, r] of puffs) { puff(pen, x, y, z, r, leaf[0]); puff(pen, x - r * 0.25, y - r * 0.25, z + r * 0.3, r * 0.7, leaf[1]); puff(pen, x - r * 0.4, y - r * 0.45, z + r * 0.55, r * 0.35, leaf[2]); }
      if (v === 1) for (let i = 0; i < 6; i++) disc(pen, (R() - 0.5) * 26, (R() - 0.5) * 22, 1.3, ['#a0622a', '#c08a3a'][i % 2]); // 떨어진 잎
      if (v === 2) { polyline(pen, [[0, 0, 24], [-9, -4, 36], [-12, -7, 40]], '#5a4632', 1.2); polyline(pen, [[0, 0, 26], [8, 6, 38]], '#5a4632', 1.1); }
      break;
    }
    case 'hedge': { // 생울타리: 다듬은 직육면체 + 잎 덩어리, 2는 웃자라고 한쪽이 무너졌다
      const g = ['#33502c', '#2e4a2a', '#3a5530'][v], L = r * 1.8, H = 12;
      shadow(pen, 0, 0, r * 0.9);
      const segs = 6;
      for (let i = 0; i < segs; i++) {
        if (v === 2 && i === 4) continue;
        const u = -L / 2 + (L / segs) * i, h = v === 2 ? H + (R() - 0.3) * 6 : H;
        mbox(u, -5, L / segs + 0.1, 10, h, g);
        for (let k = 0; k < 4; k++) { const [x, y, z] = M(u + R() * (L / segs), -4 + R() * 9, h - 1 + R() * 2); puff(pen, x, y, z, 2.6 + R() * 1.6, shade(g, 1.05 + R() * 0.25)); }
        for (let k = 0; k < 3; k++) { const [x, y, z] = M(u + R() * (L / segs), 5.2, 2 + R() * (h - 4)); puff(pen, x, y, z, 1.4 + R(), shade(g, 0.85 + R() * 0.2)); }
      }
      if (v === 1) for (let i = 0; i < 4; i++) { const [x, y, z] = M(-L / 2 + R() * L, 5.3, 4 + R() * 6); puff(pen, x, y, z, 1, ['#e8e0d0', '#d8c84a'][i % 2]); } // 꽃
      if (v === 2) for (let i = 0; i < 5; i++) { const [x, y] = M(L / 2 - 14 + R() * 10, 7 + R() * 6); disc(pen, x, y, 1.6, '#3a2a1a'); } // 흩어진 가지
      break;
    }
    case 'busstop': { // 버스 정류장: 유리 뒷벽·지붕·기둥·의자·표지판, 1은 유리가 깨졌다
      const steel = '#6a7078', L = r * 1.6;
      shadow(pen, 0, 0, r * 0.9);
      mpoly([[-L / 2, -5, 0], [L / 2, -5, 0], [L / 2, -5, 20], [-L / 2, -5, 20]], v === 1 ? rgba('#9fc4d8', 0.15) : rgba('#9fc4d8', 0.35)); // 뒷벽 유리
      if (v === 1) for (let i = 0; i < 4; i++) mline([-L / 2 + 4 + R() * (L - 8), -5, 4 + R() * 12], [-L / 2 + 4 + R() * (L - 8), -5, 4 + R() * 12], 'rgba(220,235,245,0.7)', 0.6);
      mpoly([[-L / 2 + 3, -4.9, 6], [-L / 2 + 13, -4.9, 6], [-L / 2 + 13, -4.9, 18], [-L / 2 + 3, -4.9, 18]], ['#d23c34', '#3d84c4', '#e0b43a'][v]); // 광고판
      for (const u of [-L / 2, L / 2]) { mbox(u - 0.8, -5.8, 1.6, 1.6, 21, steel); mbox(u - 0.8, 4, 1.6, 1.6, 21, steel); }
      mbox(-L / 2 - 2, -7, L + 4, 13, 1.6, '#8a9096', 21); // 지붕
      mbox(-L / 2 + 6, -4, L - 12, 4, 1, '#7a5634', 6); for (const u of [-L / 2 + 8, L / 2 - 8]) mbox(u, -3, 1, 2, 6, steel); // 의자
      const [sx, sy] = M(L / 2 + 6, 6); line(pen, [sx, sy, 0], [sx, sy, 26], steel, 1); puff(pen, sx, sy, 28, 3.2, '#2f6aa0'); puff(pen, sx, sy, 28, 1.8, '#e8e8e0'); // 표지판
      if (v === 2) { const [gx, gy] = M(-4, 10); lump(pen, gx, gy, 4, 5, '#24282e', R, { n: 7 }); } // 버려진 짐
      break;
    }
    case 'kiosk': { // 노점 가판대: 줄무늬 차양·진열대·상자, 2는 넘어졌다
      const stripe = [['#c33f36', '#e8e4d8'], ['#2f6aa0', '#e8e4d8'], ['#3f7a4a', '#e0d8a0']][v], wood = '#8a6a44', L = r * 1.5;
      shadow(pen, 0, 0, r * 0.9);
      mbox(-L / 2, -6, L, 12, 9, wood); mpoly([[-L / 2, 6.05, 2], [L / 2, 6.05, 2], [L / 2, 6.05, 8], [-L / 2, 6.05, 8]], shade(wood, 0.7));
      for (let i = 0; i < 6; i++) { const [x, y] = M(-L / 2 + 3 + i * (L - 6) / 5, 0); box(pen, x - 1.5, y - 1.5, 3, 3, 2.5, ['#e0533f', '#f2c14e', '#8fd14f', '#e8e8e0', '#5aa9dc', '#c9925a'][i], 9); } // 물건
      if (v === 2) { // 쓰러진 차양
        for (let i = 0; i < 6; i++) { const u0 = -L / 2 + (L / 6) * i; mpoly([[u0, 8, 0.3], [u0 + L / 6, 8, 0.3], [u0 + L / 6, 18, 0.3], [u0, 18, 0.3]], stripe[i % 2]); }
        mline([-L / 2, 7, 0.5], [-L / 2 - 4, 16, 6], '#5a5e64', 1);
      } else {
        for (const u of [-L / 2, L / 2 - 1.2]) mbox(u, -6, 1.2, 1.2, 22, '#5a5e64');
        for (let i = 0; i < 6; i++) { const u0 = -L / 2 + (L / 6) * i; mpoly([[u0, -7, 22], [u0 + L / 6, -7, 22], [u0 + L / 6, 10, 15], [u0, 10, 15]], stripe[i % 2]); }
        for (let i = 0; i < 6; i++) { const u0 = -L / 2 + (L / 6) * i; mpoly([[u0, 10, 15], [u0 + L / 6, 10, 15], [u0 + L / 6 - 1, 10.5, 12.5], [u0 + 1, 10.5, 12.5]], shade(stripe[i % 2], 0.85)); } // 차양 끝 물결
      }
      const [cx, cy] = M(L / 2 + 5, 8); box(pen, cx - 4, cy - 3, 8, 6, 5, '#a07850'); box(pen, cx - 2, cy - 7, 6, 5, 4, '#8a6a44', 0);
      for (let i = 0; i < 3; i++) { const [px, py] = M(-L / 2 + R() * L, 12 + R() * 6); poly(pen, [[px, py], [px + 3, py], [px + 3, py + 4], [px, py + 4]], 'rgba(230,226,210,0.7)'); } // 흩어진 신문
      break;
    }
    case 'pipes': { // 콘크리트 관 더미: 2단으로 쌓은 큰 관, 끝은 비어 있다. 2는 녹슨 철관
      const col = ['#9a968c', '#8c8a84', '#8a5a3a'][v], ri = 7.5, len = 30;
      shadow(pen, 0, 0, r * 0.95, 0.35);
      const tube = (u, w, z) => {
        const [x, y] = M(u, w);
        const cap = along ? hcyl(pen, x, y, z, len, ri, 'x', col, shade(col, 1.1)) : hcyl(pen, x, y, z, len, ri, 'y', col, shade(col, 1.1));
        const cx = cap.reduce((a, p) => a + p[0], 0) / cap.length, cy = cap.reduce((a, p) => a + p[1], 0) / cap.length;
        pen.ctx.fillStyle = '#1b1c1e'; pen.ctx.beginPath(); cap.forEach((p, i) => { const qx = cx + (p[0] - cx) * 0.72, qy = cy + (p[1] - cy) * 0.72; i ? pen.ctx.lineTo(qx, qy) : pen.ctx.moveTo(qx, qy); }); pen.ctx.closePath(); pen.ctx.fill();
      };
      tube(-len / 2, -9, 0); tube(-len / 2, 7, 0); tube(-len / 2 + 2, -1, ri * 1.6);
      break;
    }
    case 'tank': { // 저장 탱크: 큰 원기둥·띠·사다리·지붕 돔·배관·경고 표시
      const col = ['#c8c6bc', '#8a5a3a', '#5f7a5a'][v];
      shadow(pen, 2, 2, r * 0.95, 0.4);
      box(pen, -17, -17, 34, 34, 2, '#7a7d80'); // 받침
      cyl(pen, 0, 0, 15, 30, col, 2);
      for (const z of [10, 20]) cylBand(pen, 0, 0, 15, z, shade(col, 0.7), 1.2);
      const { ctx, P, zoom } = pen, [tx, ty] = P(0, 0, 32);
      ctx.fillStyle = shade(col, 1.15); ctx.beginPath(); ctx.ellipse(tx, ty, 15 * zoom, 7.5 * zoom, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(col, 1.05); ctx.beginPath(); ctx.ellipse(tx, ty - 3 * zoom, 10 * zoom, 5 * zoom, 0, 0, Math.PI * 2); ctx.fill();
      for (let z = 4; z < 32; z += 3) line(pen, [10.5, 10.5, z], [12.5, 8.5, z], '#5a5e64', 0.7); // 사다리
      line(pen, [10.5, 10.5, 2], [10.5, 10.5, 33], '#5a5e64', 0.8); line(pen, [12.5, 8.5, 2], [12.5, 8.5, 33], '#5a5e64', 0.8);
      hcyl(pen, 13, -6, 2, 10, 1.6, 'x', '#6a7078'); // 배관
      poly(pen, [[4, 14.5, 14], [8, 13, 14], [8, 13, 18], [4, 14.5, 18]], '#e0b43a'); // 경고 표시
      if (v === 1) for (let i = 0; i < 5; i++) { const a = 0.3 + R() * 1.2; poly(pen, [[Math.cos(a) * 15.1, Math.sin(a) * 15.1, 30], [Math.cos(a + 0.12) * 15.1, Math.sin(a + 0.12) * 15.1, 30], [Math.cos(a + 0.06) * 15.1, Math.sin(a + 0.06) * 15.1, 12 + R() * 10]], rgba('#5a3018', 0.6)); } // 녹
      break;
    }
    case 'ruin': { // 무너진 건물: 층이 드러난 콘크리트 골조, 창 구멍, 부러진 바닥판·철근, 잔해 더미
      const col = ['#8a8780', '#857a6c', '#6e6c68'][v], L = r * 1.6, hs = [44, 38, 46, 30, 22, 34, 14];
      shadow(pen, 0, 0, r * 0.95, 0.4);
      for (let i = 0; i < 7; i++) { // 뒷벽(들쭉날쭉한 윗선)
        const u = -L / 2 + (L / 7) * i, h = hs[(i + v) % 7];
        mbox(u, -14, L / 7 + 0.1, 4, h, col);
        for (const z of [6, 22, 38]) if (z + 7 < h && (i + Math.floor(z / 16)) % 2 === 0) mpoly([[u + 1.5, -9.95, z], [u + L / 7 - 1.5, -9.95, z], [u + L / 7 - 1.5, -9.95, z + 7], [u + 1.5, -9.95, z + 7]], '#141518');
        if (h > 20) mpoly([[u + 1, -9.9, h - 6], [u + L / 7 - 1, -9.9, h - 6], [u + L / 7 - 2, -9.9, h - 1], [u + 2, -9.9, h - 1]], rgba('#1a1a1a', 0.35)); // 그을음
      }
      mbox(-L / 2, -10, 4, 16, 36 - v * 6, shade(col, 0.95)); // 옆벽
      mbox(-L / 2 + 4, -10, L * 0.55, 14, 1.8, shade(col, 1.1), 15); // 2층 바닥판
      mbox(-L / 2 + 4, -10, L * 0.3, 10, 1.8, shade(col, 1.1), 31); // 3층 바닥판
      for (let i = 0; i < 4; i++) { const u = -L / 2 + 6 + R() * L * 0.5; mline([u, 4, 16], [u + 2, 7 + R() * 3, 14 + R() * 5], '#8a4e2c', 0.9); } // 철근
      for (let i = 0; i < 6; i++) { const [x, y] = M(-L / 4 + R() * L * 0.7, 8 + R() * 8); lump(pen, x, y, 3 + R() * 4, 3 + R() * 5, shade(col, 0.85 + R() * 0.25), R, { n: 6 }); } // 잔해 더미
      break;
    }
    case 'bus': { // 불탄 버스: 그을린 차체, 유리 없는 창, 내려앉은 지붕, 바퀴 테만
      const body = ['#3a3430', '#5a4030', '#8a7a3a'][v], L = r * 1.7, W = 20;
      shadow(pen, 0, 0, r * 0.95, 0.4);
      for (const u of [-L / 2 + 9, L / 2 - 10]) { const [x, y] = M(u, W / 2); const pts = []; for (let i = 0; i < 10; i++) { const f = (i / 10) * Math.PI * 2; pts.push(along ? [x + Math.cos(f) * 3.6, y + 0.1, 3.6 + Math.sin(f) * 3.6] : [x + 0.1, y + Math.cos(f) * 3.6, 3.6 + Math.sin(f) * 3.6]); } poly(pen, pts, '#2a2a2a'); } // 바퀴 테
      mbox(-L / 2, -W / 2, L, W, 20, body, 3);
      for (let u = -L / 2 + 4; u < L / 2 - 6; u += 7) mpoly([[u, W / 2 + 0.05, 13], [u + 5, W / 2 + 0.05, 13], [u + 5, W / 2 + 0.05, 20], [u, W / 2 + 0.05, 20]], '#151515'); // 창
      for (let i = 0; i < 6; i++) { const u = -L / 2 + 3 + R() * (L - 6); mpoly([[u, W / 2 + 0.06, 20], [u + 4, W / 2 + 0.06, 20], [u + 3, W / 2 + 0.06, 22.5], [u + 1, W / 2 + 0.06, 22.5]], rgba('#101010', 0.5)); } // 그을음
      for (let i = 0; i < 5; i++) { const u = -L / 2 + R() * L; mpoly([[u, W / 2 + 0.07, 4], [u + 3, W / 2 + 0.07, 4], [u + 2.5, W / 2 + 0.07, 9 + R() * 3], [u + 0.5, W / 2 + 0.07, 8]], rgba('#7a4a2a', 0.6)); } // 녹
      mpoly([[L / 2 + 0.05, -W / 2 + 2, 11], [L / 2 + 0.05, W / 2 - 2, 11], [L / 2 + 0.05, W / 2 - 2, 20], [L / 2 + 0.05, -W / 2 + 2, 20]], '#151515'); // 앞 유리 구멍
      mpoly([[-6, -W / 2 + 2, 23.1], [12, -W / 2 + 2, 23.1], [10, W / 2 - 2, 21], [-4, W / 2 - 2, 21]], rgba('#0c0c0c', 0.7)); // 내려앉은 지붕
      break;
    }
    case 'pine': { // 침엽수: 층층이 쌓인 원뿔, 2는 반쯤 말라 갈색
      const cols = [['#1d321e', '#25402a', '#30533a'], ['#1f3530', '#284540', '#35584f'], ['#3a3a22', '#4a4428', '#5a5230']][v];
      shadow(pen, 4, 4, 18, 0.32);
      cyl(pen, 0, 0, 2.2, 12, '#4a3a28');
      const { ctx, P, zoom } = pen;
      for (let k = 0; k < 4; k++) {
        const z0 = 10 + k * 11, rr = (15 - k * 3) * zoom, [bx, by] = P(0, 0, z0), [tx, ty] = P(0, 0, z0 + 18 - k * 2);
        const g = ctx.createLinearGradient(bx - rr, 0, bx + rr, 0); g.addColorStop(0, cols[2]); g.addColorStop(0.45, cols[1]); g.addColorStop(1, cols[0]);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - rr, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + rr, by); ctx.ellipse(bx, by, rr, rr * 0.5, 0, 0, Math.PI); ctx.fill();
        for (let i = 0; i < 5; i++) { const a = Math.PI * (0.1 + R() * 0.8); ctx.strokeStyle = cols[0]; ctx.lineWidth = 0.8 * zoom; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * rr * 0.9, by + Math.sin(a) * rr * 0.45); ctx.lineTo(bx + Math.cos(a) * rr * 1.05, by + Math.sin(a) * rr * 0.55 + 2 * zoom); ctx.stroke(); } // 처진 잎끝
      }
      for (let i = 0; i < 4; i++) disc(pen, (R() - 0.5) * 22, (R() - 0.5) * 18, 1.2, '#5a4a30'); // 솔방울·솔잎
      break;
    }
    case 'bramble': { // 가시덤불: 뒤엉킨 덩굴 덩어리와 가시, 붉은 열매
      const cols = [['#2f3a22', '#3d4a2a', '#4a5a30'], ['#3a3422', '#4a422a', '#5a5030'], ['#26321f', '#33422a', '#3f5232']][v];
      shadow(pen, 0, 0, r * 0.95, 0.3);
      const blobs = [];
      for (let i = 0; i < 14; i++) { const a = R() * 6.3, d = R() * r * 0.8; blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.8, 3 + R() * 7, 4 + R() * 4]); }
      blobs.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
      for (const [x, y, z, rr] of blobs) { puff(pen, x, y, z, rr, cols[0]); puff(pen, x - rr * 0.3, y - rr * 0.3, z + rr * 0.3, rr * 0.6, cols[1]); }
      for (let i = 0; i < 22; i++) { const [x, y, z] = blobs[i % blobs.length], a = R() * 6.3; line(pen, [x, y, z + 2], [x + Math.cos(a) * 7, y + Math.sin(a) * 6, z + 2 + R() * 6], '#5a4a30', 0.6); } // 가시 덩굴
      for (let i = 0; i < 8; i++) { const [x, y, z, rr] = blobs[Math.floor(R() * blobs.length)]; puff(pen, x + (R() - 0.5) * rr, y + (R() - 0.5) * rr, z + rr * 0.6, 0.9, v === 1 ? '#3a2a4a' : '#a02a2a'); } // 열매
      break;
    }
    case 'bunker': { // 콘크리트 벙커(토치카): 비스듬한 지붕, 사격 구멍, 모래주머니, 철문. 2는 포탄에 깨졌다
      const col = ['#8a8a80', '#7a7c70', '#6e6e66'][v], L = 40, W = 30, H = 12;
      shadow(pen, 0, 0, r, 0.4);
      mbox(-L / 2, -W / 2, L, W, H, col);
      mpoly([[-L / 2, -W / 2, H], [L / 2, -W / 2, H], [L / 2 - 4, W / 2 - 6, H + 6], [-L / 2 + 4, W / 2 - 6, H + 6]], shade(col, 1.06)); // 지붕 경사
      mpoly([[-L / 2, W / 2, H], [L / 2, W / 2, H], [L / 2 - 4, W / 2 - 6, H + 6], [-L / 2 + 4, W / 2 - 6, H + 6]], shade(col, 0.9));
      mpoly([[-10, W / 2 + 0.05, 6], [10, W / 2 + 0.05, 6], [10, W / 2 + 0.05, 9], [-10, W / 2 + 0.05, 9]], '#0e0f10'); // 사격 구멍
      mpoly([[L / 2 + 0.05, -6, 0], [L / 2 + 0.05, 2, 0], [L / 2 + 0.05, 2, 9], [L / 2 + 0.05, -6, 9]], '#4a3a2a'); // 철문
      for (let i = 0; i < 4; i++) { const [x, y, z] = M(-L / 2 + 5 + i * 8, W / 2 + 6); lump(pen, x, y, 3.6, 4.2, ['#a89268', '#9c8a62'][i % 2], R, { n: 6, squash: 0.6, rot: along ? 0 : Math.PI / 2 }); }
      if (v === 2) { mpoly([[-14, W / 2 + 0.06, 2], [-6, W / 2 + 0.06, 3], [-8, W / 2 + 0.06, 10], [-15, W / 2 + 0.06, 8]], '#2a2a28'); mline([-16, W / 2 + 0.07, 10], [-4, W / 2 + 0.07, 2], 'rgba(0,0,0,0.5)', 0.8); } // 포탄 구멍
      mpoly([[-L / 2 + 3, -W / 2 + 2, H + 0.1], [-L / 2 + 14, -W / 2 + 2, H + 0.1], [-L / 2 + 12, W / 2 - 8, H + 5.5], [-L / 2 + 5, W / 2 - 8, H + 5.5]], rgba('#3f4a2a', 0.6)); // 위장망
      break;
    }
    case 'tankwreck': { // 파괴된 전차: 차체·궤도·포탑·포신, 그을음. 2는 포탑이 떨어져 옆에 굴러 있다
      const col = ['#4a5038', '#5a4a38', '#3f4438'][v], L = 44, W = 24;
      shadow(pen, 0, 0, r, 0.42);
      for (const w of [-W / 2, W / 2 - 5]) mbox(-L / 2, w, L, 5, 7, '#2a2c2a'); // 궤도
      for (let u = -L / 2 + 5; u < L / 2; u += 7.5) { const [x, y] = M(u, W / 2); const pts = []; for (let i = 0; i < 8; i++) { const f = (i / 8) * Math.PI * 2; pts.push(along ? [x + Math.cos(f) * 2.6, y + 0.1, 3.5 + Math.sin(f) * 2.6] : [x + 0.1, y + Math.cos(f) * 2.6, 3.5 + Math.sin(f) * 2.6]); } poly(pen, pts, '#4a4c4a'); } // 바퀴
      mbox(-L / 2 + 2, -W / 2 + 4, L - 4, W - 8, 8, col, 3);
      mpoly([[L / 2 - 2, -W / 2 + 4, 11], [L / 2 + 3, -W / 2 + 4, 6], [L / 2 + 3, W / 2 - 4, 6], [L / 2 - 2, W / 2 - 4, 11]], shade(col, 0.85)); // 경사 장갑
      for (let i = 0; i < 4; i++) { const [x, y] = M(-L / 2 + 6 + R() * (L - 12), -4 + R() * 8); splat(pen, x, y, 3 + R() * 3, rgba('#141410', 0.7), R, 7, 11.05); } // 그을음
      if (v === 2) { const [x, y] = M(-L / 2 - 6, W / 2 + 10); rbox(pen, x, y, 16, 13, 6, 0.6, shade(col, 0.95)); line(pen, [x, y, 3], [x + 14, y + 10, 1], '#2f332a', 2.6); disc(pen, 0, 0, 5, '#141410', 11.1); } // 떨어진 포탑
      else {
        const [x, y] = M(-2, 0); rbox(pen, x, y, 18, 14, 6, v ? 0.35 : 0, shade(col, 1.05), 11);
        const ang = v ? 0.35 : 0, bx = x + Math.cos(ang) * 8, by = y + Math.sin(ang) * 8;
        line(pen, [bx, by, 14], [bx + Math.cos(ang + 0.15) * 22, by + Math.sin(ang + 0.15) * 22, 13], '#2f332a', 2.6); // 포신
        disc(pen, x - 3, y - 2, 2.4, '#141410', 17.1); // 열린 해치
      }
      break;
    }
    default:
      box(pen, -10, -10, 20, 20, 12, '#777777');
  }
}

// ---------- 파밍 대상물(13종) ----------
// 자원 색(목재 갈색·고철 회색·플라스틱 파랑)을 바탕색으로 지켜 한눈에 무엇이 나오는지 보이게 한다.
// 발밑의 옅은 자원 색 고리 = 파밍할 수 있다는 표시(장애물에는 없다).
export const NODE_BOX = { pole: [30, 22], shed: [26, 26], cart: [20, 22], fridge: [18, 32], pharmacy: [20, 34], fallenTree: [28, 26], pallets: [22, 20], furniture: [22, 28], fence: [22, 24], wreck: [27, 24], drums: [18, 24], vending: [16, 38], rebar: [24, 20], garbage: [18, 16], bluedrum: [18, 24], crates: [18, 26], cones: [18, 22], mannequin: [20, 38] };
const RES_TINT = { wood: '#c9925a', scrap: '#b9c0ca', plastic: '#5aa9dc' };
export function drawNode(pen, type, res, v) {
  const R = rng(hash(v + 7, type.length, 131));
  shadow(pen, 0, 0, 16, 0.3);
  ring(pen, 0, 0, 19, rgba(RES_TINT[res], 0.32), 1.4);
  switch (type) {
    case 'fallenTree': {
      const bark = ['#6e4e30', '#5e4630', '#735336'][v];
      for (let i = 0; i < 3; i++) polyline(pen, [[17, 0, 4], [21 + R() * 3, (R() - 0.5) * 10, 1 + R() * 5]], bark, 1.4); // 뿌리
      disc(pen, 19, 0, 6, rgba('#3a2a1a', 0.7));
      // 잎 덩어리(뒤쪽 끝)
      for (let i = 0; i < 7; i++) puff(pen, -18 + (R() - 0.5) * 12, (R() - 0.5) * 12, 6 + R() * 7, 4 + R() * 2.5, ['#2f4527', '#3d5530', '#4a6638'][i % 3]);
      const cap = hcyl(pen, -16, 0, 0, 34, 4.6, 'x', bark, '#c9a074');
      // 나이테
      const cx = cap.reduce((a, p) => a + p[0], 0) / cap.length, cy = cap.reduce((a, p) => a + p[1], 0) / cap.length;
      pen.ctx.strokeStyle = 'rgba(120,80,40,0.7)'; pen.ctx.lineWidth = 0.7 * pen.zoom;
      for (const k of [0.65, 0.35]) { pen.ctx.beginPath(); cap.forEach((p, i) => { const x = cx + (p[0] - cx) * k, y = cy + (p[1] - cy) * k; i ? pen.ctx.lineTo(x, y) : pen.ctx.moveTo(x, y); }); pen.ctx.closePath(); pen.ctx.stroke(); }
      for (let i = 0; i < 4; i++) { const u = -12 + i * 8; polyline(pen, [[u, 4.2, 3], [u + 5, 4.4, 4]], 'rgba(0,0,0,0.35)', 0.7); polyline(pen, [[u + 2, 2, 8.6], [u + 7, 1.5, 8.8]], 'rgba(0,0,0,0.3)', 0.6); }
      polyline(pen, [[-2, -2, 8], [-4, -7, 15], [-7, -9, 19]], bark, 1.8); // 부러진 가지
      polyline(pen, [[6, 2, 8], [8, 6, 13]], bark, 1.4);
      break;
    }
    case 'pallets': {
      const wood = ['#c79a62', '#b88d5a', '#a89474'][v];
      rbox(pen, 13, 12, 22, 3, 1.2, 0.5 + R() * 0.4, shade(wood, 0.9)); // 떨어진 판자
      for (let k = 0; k < 3; k++) {
        const ox = (R() - 0.5) * 3, oy = (R() - 0.5) * 3, z = k * 5;
        for (const y of [-10, -1, 8]) box(pen, -13 + ox, y + oy, 26, 2.5, 3, shade(wood, 0.82), z);
        for (let i = 0; i < 5; i++) box(pen, -13 + ox + i * 5.6, -10 + oy, 3.8, 20.5, 1.3, shade(wood, 0.95 + R() * 0.15), z + 3);
      }
      break;
    }
    case 'furniture': {
      const wood = ['#8a6a4a', '#6e5a48', '#93704c'][v];
      if (v === 1) { // 소파
        const fab = '#5d6a78';
        box(pen, -13, -6, 26, 12, 6, fab, 1);
        box(pen, -13, -8, 26, 4, 13, shade(fab, 0.92), 1);
        box(pen, -15, -8, 3, 14, 9, shade(fab, 0.9), 1); box(pen, 12, -8, 3, 14, 9, shade(fab, 0.9), 1);
        line(pen, [0, -4, 7], [0, 6, 7], 'rgba(0,0,0,0.35)', 0.8);
        for (let i = 0; i < 4; i++) puff(pen, -6 + R() * 10, R() * 5, 7.5, 1.2, '#e6e0d0'); // 터진 솜
        for (const [x, y] of [[-13, 6], [12, 6]]) box(pen, x, y - 1, 1.5, 1.5, 1, '#3a2a1a');
      } else {
        box(pen, -8, -8, 16, 12, 20, wood); // 서랍장
        for (let k = 0; k < 3; k++) { onY(pen, 4.05, -7, 7, 2 + k * 6, 6.5 + k * 6, shade(wood, 0.72)); puff(pen, 0, 4.1, 4.2 + k * 6, 0.8, '#d0b070'); }
        box(pen, -7, 4, 14, 6, 4, shade(wood, 1.05), 8); // 빠진 서랍
        polyline(pen, [[-8, 4, 20], [-2, 4, 14]], 'rgba(0,0,0,0.4)', 0.7);
        if (v === 2) { // 쓰러진 의자
          box(pen, 7, 6, 10, 8, 1.5, shade(wood, 1.1), 4);
          for (const [x, y] of [[8, 7], [15, 7], [8, 12], [15, 12]]) line(pen, [x, y, 4], [x + 1, y, 0], shade(wood, 0.7), 1.1);
          box(pen, 7, 13, 10, 1.5, 9, shade(wood, 0.9), 0);
        } else box(pen, 9, 2, 6, 6, 5, '#6a5f55'); // 상자
      }
      break;
    }
    case 'fence': {
      const wood = ['#a98458', '#9a8f7c', '#b08a5c'][v], hs = [16, 11, 18, 6, 15, 17, 9];
      box(pen, -17, -1, 34, 1.4, 1.6, shade(wood, 0.85), 4);
      box(pen, -17, -1, 34, 1.4, 1.6, shade(wood, 0.85), 11);
      for (let i = 0; i < 7; i++) {
        const u = -16 + i * 5, h = hs[(i + v) % 7];
        box(pen, u, 0.4, 3.2, 1.4, h, wood);
        if (h > 12) poly(pen, [[u, 1.8, h], [u + 3.2, 1.8, h], [u + 1.6, 1.8, h + 2.6]], shade(wood, 0.8)); // 뾰족한 끝
      }
      rbox(pen, 4, 9, 3.2, 15, 1.4, 1.2 + R() * 0.4, shade(wood, 0.95)); // 쓰러진 널
      rbox(pen, -9, 8, 3.2, 12, 1.4, 0.3, shade(wood, 0.9));
      break;
    }
    case 'wreck': {
      const body = ['#7a4a38', '#3f5870', '#85837a'][v], glass = '#22303a';
      const wheel = (x) => {
        const pts = []; for (let i = 0; i < 12; i++) { const f = (i / 12) * Math.PI * 2; pts.push([x + Math.cos(f) * 4.2, 10.2, 4.2 + Math.sin(f) * 4.2]); }
        poly(pen, pts, '#1b1d20'); poly(pen, pts.map(([a, b, c]) => [x + (a - x) * 0.45, b + 0.1, 4.2 + (c - 4.2) * 0.45]), '#5a5e64');
      };
      box(pen, -20, -10, 40, 20, 7, body, 3);
      wheel(-12); wheel(12);
      onY(pen, 10.05, -20, 20, 3, 4.5, shade(body, 0.55)); // 문턱
      box(pen, -9, -8.5, 19, 17, 7.5, body, 10);
      onY(pen, 8.55, -7.5, 1.5, 11, 16.5, glass); onY(pen, 8.55, 2.5, 9, 11, 16.5, glass); // 옆 창
      onX(pen, 10.05, -7, 7, 11, 16.5, glass); // 앞 유리
      poly(pen, [[10.1, -4, 16], [10.1, -1, 16], [10.1, 2, 11.5], [10.1, -1, 11.5]], 'rgba(255,255,255,0.18)');
      polyline(pen, [[10.1, 1, 16], [10.1, 4, 13], [10.1, 2, 11.5]], 'rgba(200,220,230,0.6)', 0.6); // 금 간 유리
      onX(pen, 20.05, -8, -4.5, 6.5, 8.5, '#d8d4c0'); onX(pen, 20.05, 4.5, 8, 6.5, 8.5, '#8a8270'); // 전조등(하나는 깨짐)
      onX(pen, 20.05, -3, 3, 5, 9, shade(body, 0.4)); // 그릴
      for (let i = 0; i < 5; i++) splat(pen, -18 + R() * 36, -8 + R() * 16, 1.5 + R() * 2.5, rgba('#7a3a1a', 0.75), R, 7, 10.05); // 녹
      if (v === 2) poly(pen, [[10, -9, 10.1], [19, -9, 10.1], [19, 9, 10.1], [10, 9, 10.1]], '#191b1e'); // 보닛 없음
      onY(pen, 10.05, -1, -0.2, 6, 9, 'rgba(0,0,0,0.5)'); // 문틈
      break;
    }
    case 'drums': {
      const cols = [['#6d7176', '#7c5a3c', '#5d6166'], ['#4f6a8a', '#6d7176', '#8a4a32'], ['#7c5a3c', '#5d6166', '#6a7a4a']][v];
      const drum = (x, y, c, h = 16) => {
        cyl(pen, x, y, 6, h, c);
        cylBand(pen, x, y, 6, 5, shade(c, 0.6), 1.3); cylBand(pen, x, y, 6, 11, shade(c, 0.6), 1.3);
        ring(pen, x, y, 5, shade(c, 0.7), 0.9, h); puff(pen, x + 2.5, y - 1.5, h, 1, shade(c, 0.55));
        for (let i = 0; i < 2; i++) { const a = 0.4 + R() * 1.6; poly(pen, [[x + Math.cos(a) * 6.05, y + Math.sin(a) * 6.05, 2 + R() * 6], [x + Math.cos(a + 0.25) * 6.05, y + Math.sin(a + 0.25) * 6.05, 2], [x + Math.cos(a + 0.12) * 6.05, y + Math.sin(a + 0.12) * 6.05, 12]], rgba('#7a3a1a', 0.55)); }
      };
      if (v === 1) { hcyl(pen, 0, -14, 0, 15, 5.6, 'y', cols[2], shade(cols[2], 1.1)); drum(-7, -5, cols[0]); drum(6, 4, cols[1]); }
      else { drum(-6, -4, cols[0]); drum(8, -8, cols[2], 14); drum(5, 5, cols[1]); }
      poly(pen, [[3.6, 9.6, 8], [6.4, 9.6, 8], [6.4, 9.6, 10.5], [3.6, 9.6, 10.5]], '#e0b43a'); // 경고 딱지
      break;
    }
    case 'vending': {
      const body = ['#c33f36', '#2f5f9a', '#c8c6bc'][v];
      box(pen, -9, -6, 18, 12, 30, body);
      onY(pen, 6.05, -8, 3.5, 7, 27, '#132029'); // 유리창
      const bot = ['#e0533f', '#5aa9dc', '#8fd14f', '#f2c14e', '#e8e8e8'];
      for (let z = 9; z < 26; z += 4.2) { onY(pen, 6.1, -7.5, 3, z - 0.4, z - 0.1, 'rgba(255,255,255,0.25)'); for (let x = -7; x < 2.5; x += 2.1) onY(pen, 6.12, x, x + 1.2, z, z + 2.6, bot[Math.floor(R() * bot.length)]); }
      poly(pen, [[-8, 6.15, 26], [-5, 6.15, 26], [1, 6.15, 8], [-2, 6.15, 8]], 'rgba(255,255,255,0.12)'); // 반사
      if (v !== 1) polyline(pen, [[-3, 6.2, 22], [-1, 6.2, 18], [1.5, 6.2, 19], [-0.5, 6.2, 14]], 'rgba(220,235,245,0.7)', 0.6); // 깨진 금
      onY(pen, 6.05, -8, 8, 27.5, 29.5, '#f4efe6'); // 상표 띠
      for (let k = 0; k < 4; k++) onY(pen, 6.1, 5, 7.5, 13 + k * 3, 14.6 + k * 3, '#2a2d33'); // 버튼
      onY(pen, 6.05, -6, 3, 2.5, 5.5, '#0c0e10'); // 꺼내는 곳
      onX(pen, 9.05, -4, 2, 12, 20, rgba('#f4efe6', 0.18)); // 옆면 스티커
      for (let i = 0; i < 3; i++) puff(pen, -6 + R() * 14, 9 + R() * 4, 0.6, 1.1, bot[i]); // 쏟아진 캔
      break;
    }
    case 'rebar': {
      box(pen, -14, -9, 4, 18, 3, '#5d4630'); box(pen, 10, -9, 4, 18, 3, '#5d4630'); // 받침목
      const rust = ['#8a4a2a', '#9a5a32', '#6e3a20'];
      for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
        const y = -7 + i * 2.8 + (row % 2) * 1.2, z = 3.6 + row * 1.6;
        line(pen, [-19, y, z], [19, y, z], rust[(i + row + v) % 3], 1.2);
        line(pen, [-19, y - 0.3, z + 0.5], [19, y - 0.3, z + 0.5], 'rgba(255,190,140,0.18)', 0.4);
      }
      for (let i = 0; i < 2 + v; i++) { const y = -6 + R() * 12; polyline(pen, [[-16, y, 8], [-4, y + 1, 9], [2 + R() * 6, y + 2, 16 + R() * 6]], rust[i % 3], 1.2); } // 휘어진 철근
      box(pen, 12, 8, 8, 6, 5, '#8a8d90'); line(pen, [15, 10, 5], [17, 13, 12], rust[0], 1); // 콘크리트 조각
      break;
    }
    case 'garbage': {
      const bagCols = [['#24282e', '#2e3a2e', '#3a5a8a'], ['#2a2e34', '#3a5a8a', '#24282e'], ['#3a5a8a', '#24282e', '#c8c8c0']][v];
      for (let i = 0; i < 4; i++) puff(pen, -12 + R() * 24, 6 + R() * 6, 0.4, 1.2, ['#e8e2d0', '#c9925a', '#8fd14f', '#d0d0c8'][i]); // 흘러나온 쓰레기
      const bags = [[-6, -3, 8, 10], [6, -5, 7, 9], [1, 5, 7.5, 8], [-8, 7, 5.5, 6]];
      bags.forEach(([x, y, r, h], i) => {
        const c = bagCols[i % 3], top = lump(pen, x, y, r, h, c, R, { n: 8, mid: 0.95, top: 0.55 });
        const tx = top.reduce((a, p) => a + p[0], 0) / top.length, ty = top.reduce((a, p) => a + p[1], 0) / top.length;
        puff(pen, tx, ty, h + 1, 1.6, shade(c, 0.9)); // 묶은 매듭
        line(pen, [tx, ty, h + 2], [tx - 2, ty - 1, h + 4], shade(c, 0.9), 0.9); line(pen, [tx, ty, h + 2], [tx + 2, ty + 0.5, h + 4], shade(c, 0.9), 0.9);
        puff(pen, x - r * 0.35, y - r * 0.3, h * 0.75, r * 0.22, 'rgba(255,255,255,0.13)'); // 비닐 광택
      });
      cyl(pen, 11, 9, 1.4, 3.2, '#b9c0ca'); // 캔
      break;
    }
    case 'bluedrum': {
      const blue = ['#2f6fa0', '#3479ad', '#2a6a8a'][v];
      const barrel = (x, y) => {
        cyl(pen, x, y, 6.6, 18, blue);
        for (const z of [5, 9.5, 14]) cylBand(pen, x, y, 6.6, z, shade(blue, 1.25), 0.9);
        puff(pen, x - 2.5, y - 1, 18, 1.4, shade(blue, 0.8)); puff(pen, x + 2.5, y + 1, 18, 1.4, shade(blue, 0.8));
      };
      if (v === 2) { hcyl(pen, -2, -15, 0, 17, 6, 'y', blue, shade(blue, 1.15)); barrel(9, 5); }
      else { barrel(-5, -1); barrel(8, 6); }
      box(pen, -14, 6, 8, 5, 10, '#d6d6cc'); // 하얀 물통
      line(pen, [-12, 8.5, 10], [-8, 8.5, 12], '#d6d6cc', 1.4); puff(pen, -8, 7, 11, 1.1, '#e0533f');
      break;
    }
    case 'crates': {
      const cols = [['#e0b43a', '#3d84c4', '#d24a3c'], ['#3d84c4', '#3d84c4', '#e0b43a'], ['#d24a3c', '#5aa04a', '#3d84c4']][v];
      const crate = (x, y, w, d, h, c, z0 = 0) => {
        box(pen, x, y, w, d, h, c, z0);
        for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) onY(pen, y + d + 0.05, x + 1 + i * (w - 2) / 4 + 0.6, x + 1 + (i + 1) * (w - 2) / 4 - 0.6, z0 + 1.5 + k * (h - 3) / 2, z0 + (k + 1) * (h - 3) / 2, shade(c, 0.45));
        for (let i = 0; i < 2; i++) onX(pen, x + w + 0.05, y + 1 + i * (d - 2) / 2 + 0.6, y + 1 + (i + 1) * (d - 2) / 2 - 0.6, z0 + 2, z0 + h - 2, shade(c, 0.4));
        poly(pen, [[x + 1.2, y + 1.2, z0 + h + 0.05], [x + w - 1.2, y + 1.2, z0 + h + 0.05], [x + w - 1.2, y + d - 1.2, z0 + h + 0.05], [x + 1.2, y + d - 1.2, z0 + h + 0.05]], shade(c, 0.55));
      };
      crate(-13, -9, 15, 11, 9, cols[0]); crate(2, -5, 14, 11, 9, cols[1]); crate(-9, -7, 14, 10, 8, cols[2], 9);
      break;
    }
    case 'cones': {
      const cone = (x, y, tip = false) => {
        box(pen, x - 4.5, y - 4.5, 9, 9, 1.2, '#c95a1a');
        if (tip) { poly(pen, [[x - 2, y - 3.5, 1.2], [x - 2, y + 3.5, 1.2], [x + 14, y + 0.5, 2.5]], '#f07a2a'); line(pen, [x + 3, y - 2.6, 1.5], [x + 3, y + 2.6, 1.5], 'rgba(255,255,255,0.8)', 1.6); return; }
        const { ctx, P, zoom } = pen, [bx, by] = P(x, y, 1.2), [tx, ty] = P(x, y, 17), rx = 4 * zoom;
        const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0); g.addColorStop(0, '#f39250'); g.addColorStop(0.4, '#f07a2a'); g.addColorStop(1, '#b8531a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - rx, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + rx, by); ctx.ellipse(bx, by, rx, rx * 0.5, 0, 0, Math.PI); ctx.fill();
        for (const z of [6.5, 11]) { const [mx, my] = P(x, y, z), k = 1 - (z - 1.2) / 15.8; ctx.strokeStyle = 'rgba(245,245,240,0.9)'; ctx.lineWidth = 1.8 * zoom; ctx.beginPath(); ctx.ellipse(mx, my, rx * k, rx * k * 0.5, 0, 0, Math.PI); ctx.stroke(); }
      };
      cone(-8, -4); cone(6, -7); cone(1, 7, v !== 0);
      if (v === 2) cone(-9, 8);
      break;
    }
    case 'mannequin': {
      const skin = ['#d9cbb8', '#e2d6c4', '#cfc2b0'][v];
      // 서 있는 마네킹(받침대 위)
      disc(pen, -6, -2, 4, '#3a3d42', 0.6); line(pen, [-6, -2, 0.6], [-6, -2, 8], '#2a2d33', 1);
      box(pen, -8, -3.5, 4, 3, 9, skin, 8); // 다리
      lump(pen, -6, -2, 4, 9, skin, R, { n: 7, z0: 17, mid: 1.05, top: 0.6, squash: 0.7 }); // 몸통
      line(pen, [-9.5, -2, 25], [-12, 0, 17], skin, 1.6); line(pen, [-2.5, -2, 25], [0, -4, 18], skin, 1.6);
      puff(pen, -6, -2, 30, 3, skin); puff(pen, -7, -2.6, 31, 1.2, 'rgba(255,255,255,0.35)');
      // 쓰러진 마네킹
      rbox(pen, 7, 6, 13, 6, 4, 0.5, shade(skin, 0.95));
      puff(pen, 13.5, 10, 3, 2.8, shade(skin, 0.95));
      line(pen, [2, 3, 2], [-2, 10, 0.5], shade(skin, 0.9), 1.6);
      if (v === 1) { box(pen, 10, -10, 1, 1, 22, '#5a5e64'); line(pen, [3, -10, 22], [17, -10, 22], '#5a5e64', 0.9); poly(pen, [[5, -9.5, 21], [9, -9.5, 21], [9.5, -9.5, 12], [4.5, -9.5, 12]], '#8a3a4a'); } // 옷걸이
      break;
    }
    case 'pole': { // 쓰러진 전봇대: 나무 기둥·가로대·애자·늘어진 전선
      const wood = ['#4a3a2a', '#56432e', '#3f342a'][v];
      box(pen, 16, -6, 9, 12, 5, '#8a8d90'); // 뽑힌 콘크리트 밑동
      hcyl(pen, -22, 0, 0, 40, 3.6, 'x', wood, '#8a6a44');
      box(pen, -16, -10, 3, 20, 2.4, shade(wood, 1.1), 7.2); // 가로대
      for (const y of [-8, 0, 8]) cyl(pen, -14.5, y, 1.2, 2.4, '#e8e4d8', 9.6);
      polyline(pen, [[-14.5, -8, 12], [-20, -12, 4], [-26, -14, 0]], '#1e2024', 0.7);
      polyline(pen, [[-14.5, 8, 12], [-8, 14, 3], [0, 16, 0]], '#1e2024', 0.7);
      for (let i = 0; i < 4; i++) polyline(pen, [[-10 + i * 7, 3.4, 4], [-6 + i * 7, 3.5, 5]], 'rgba(0,0,0,0.35)', 0.6);
      onY(pen, 3.7, 2, 6, 3, 6, '#c9b44a'); // 번호판
      break;
    }
    case 'shed': { // 무너진 헛간: 기울어진 지붕판·흩어진 판자·문짝
      const wood = ['#8a6a44', '#7a6248', '#94704a'][v];
      box(pen, -14, -12, 3, 22, 12, shade(wood, 0.9)); // 남은 벽
      for (let k = 0; k < 5; k++) line(pen, [-11, -12 + k * 5, 0.5], [-11, -12 + k * 5, 11.5], 'rgba(0,0,0,0.3)', 0.6);
      poly(pen, [[-11, -14, 12], [10, -10, 2], [10, 12, 2], [-11, 10, 12]], '#6a7078'); // 기울어진 양철 지붕
      for (let y = -12; y < 12; y += 3) line(pen, [-11, y, 12.1], [10, y + 2, 2.1], 'rgba(255,255,255,0.12)', 0.6);
      rbox(pen, 10, 12, 16, 9, 1.2, 0.4, shade(wood, 1.05)); // 문짝
      for (let i = 0; i < 4; i++) rbox(pen, -2 + R() * 18, 10 + R() * 8, 14, 2.4, 1, R() * 3, shade(wood, 0.85 + R() * 0.25), i * 1.1); // 판자
      break;
    }
    case 'cart': { // 쇼핑 카트(철망 바구니·손잡이·바퀴)
      const c = '#b9c0ca';
      for (const [x, y] of [[-9, -5], [8, -5], [-9, 6], [8, 6]]) { line(pen, [x, y, 0], [x, y, 3], '#5a5e64', 0.8); puff(pen, x, y, 0.8, 1.3, '#2a2d33'); }
      const z0 = 4, z1 = 14;
      for (let x = -10; x <= 10; x += 2.5) line(pen, [x, 7, z0], [x, 7, z1], c, 0.5); // 앞 철망
      for (let y = -6; y <= 7; y += 2.5) line(pen, [10, y, z0], [10, y, z1], c, 0.5);
      polyline(pen, [[-10, -6, z1], [10, -6, z1], [10, 7, z1], [-10, 7, z1], [-10, -6, z1]], c, 1);
      polyline(pen, [[-10, 7, z0], [10, 7, z0], [10, -6, z0]], c, 1);
      polyline(pen, [[-10, -6, z1], [-14, -6, z1 + 3], [-14, 7, z1 + 3], [-10, 7, z1]], '#e0533f', 1.3); // 손잡이
      if (v === 1) lump(pen, 1, 0, 5, 6, '#2a2e34', R, { z0: z0 + 1, n: 7 });
      if (v === 2) { box(pen, -6, -4, 9, 8, 7, '#a07850', z0 + 0.5); line(pen, [-6, 4, z0 + 7.5], [3, 4, z0 + 7.5], 'rgba(0,0,0,0.3)', 0.6); } // 골판지 상자
      break;
    }
    case 'fridge': { // 버려진 냉장고: 문이 열렸거나 누워 있다
      const white = ['#d6d8d2', '#c8c4b4', '#b8c4c8'][v];
      if (v === 1) { box(pen, -14, -7, 28, 14, 11, white); onY(pen, 7.05, -12, 12, 9, 9.6, shade(white, 0.7)); onY(pen, 7.05, -12, -6, 5, 6, '#8a8d90'); }
      else {
        box(pen, -7, -6, 14, 12, 26, white);
        onY(pen, 6.05, -6, 6, 1, 25, '#2a2d33'); // 열린 속
        for (const z of [8, 15, 21]) onY(pen, 6.1, -5.5, 5.5, z, z + 0.6, '#8a8d90'); // 선반
        rbox(pen, 9, 9, 1.4, 12, 25, 0.9, shade(white, 0.95)); // 열린 문
        onX(pen, 7.05, -5, 5, 10, 10.6, shade(white, 0.7));
      }
      for (let i = 0; i < 4; i++) splat(pen, -5 + R() * 10, -4 + R() * 8, 1.4 + R() * 1.6, rgba('#8a4a22', 0.7), R, 6, v === 1 ? 11.05 : 26.05);
      break;
    }
    case 'pharmacy': { // 약국 진열대: 선반·약 상자·하얀 약병·녹색 십자 간판
      const frame = ['#d6dade', '#c8ccd0', '#dcd8cc'][v];
      box(pen, -10, -4, 20, 8, 1.5, frame); box(pen, -10, -5, 20, 1.5, 26, frame);
      box(pen, -10, -4, 1.5, 8, 26, shade(frame, 0.95)); box(pen, 8.5, -4, 1.5, 8, 26, shade(frame, 0.95));
      const meds = ['#5aa9dc', '#e8e8e0', '#e0533f', '#8fd14f', '#f2c14e', '#c9b6ff'];
      for (const z of [1.5, 9.5, 17.5]) {
        box(pen, -8.5, -3.5, 17, 7, 0.8, shade(frame, 0.9), z + 7);
        for (let x = -8; x < 7; x += 3.2) if (R() > 0.25) { const c = meds[Math.floor(R() * meds.length)]; R() < 0.5 ? box(pen, x, -2, 2.4, 3, 3.5, c, z) : cyl(pen, x + 1.2, 0, 1.2, 4, c, z); }
      }
      box(pen, -6, -5, 12, 1.2, 6, '#2f8a4a', 27); onY(pen, -3.75, -1.2, 1.2, 28, 32, '#e8f4e8'); onY(pen, -3.7, -3, 3, 29.4, 30.6, '#e8f4e8'); // 십자 간판
      for (let i = 0; i < 4; i++) cyl(pen, -10 + R() * 22, 6 + R() * 7, 1.1, 3, ['#e8e8e0', '#5aa9dc'][i % 2]); // 떨어진 약병
      break;
    }
    default:
      box(pen, -8, -8, 16, 16, 10, '#777777');
  }
}

// ---------- 기지 ----------
const tier = (lv) => (lv >= 7 ? 2 : lv >= 4 ? 1 : 0);
const planks = (pen, face, a0, a1, b, z0, z1, step, col) => { // 판자 줄(가로)
  for (let z = z0 + step; z < z1; z += step) face === 'x' ? line(pen, [b, a0, z], [b, a1, z], col, 0.6) : line(pen, [a0, b, z], [a1, b, z], col, 0.6);
};
const winY = (pen, Y, x0, x1, z0, z1, lit) => { onY(pen, Y + 0.05, x0 - 0.6, x1 + 0.6, z0 - 0.6, z1 + 0.6, '#2a2620'); onY(pen, Y + 0.1, x0, x1, z0, z1, lit ? '#f2c46a' : '#1a2128'); if (lit) onY(pen, Y + 0.12, x0, x1, z0, z0 + (z1 - z0) * 0.35, 'rgba(255,240,200,0.45)'); };
const winX = (pen, X, y0, y1, z0, z1, lit) => { onX(pen, X + 0.05, y0 - 0.6, y1 + 0.6, z0 - 0.6, z1 + 0.6, '#2a2620'); onX(pen, X + 0.1, y0, y1, z0, z1, lit ? '#d9a858' : '#141a20'); };
function sandbagRow(pen, x0, y0, x1, y1, z0, col = '#a89268') {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 7)), R = rng(hash(Math.round(x0), Math.round(y0), 5));
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; lump(pen, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3.6, 4.4, shade(col, 0.9 + R() * 0.2), R, { n: 6, squash: 0.6, rot: Math.atan2(y1 - y0, x1 - x0), z0, mid: 1, top: 0.7 }); }
}
function flag(pen, x, y, z, h, col) {
  line(pen, [x, y, z], [x, y, z + h], '#d9d2c3', 1.2);
  poly(pen, [[x, y, z + h], [x + 9, y - 4, z + h - 2.5], [x + 1, y - 1, z + h - 6]], col);
  poly(pen, [[x, y, z + h], [x + 5, y - 2.2, z + h - 1.5], [x + 0.6, y - 0.5, z + h - 3.4]], rgba('#ffffff', 0.2));
}

// 본부: 1~3 판잣집 · 4~6 2층 거점 · 7~10 요새
export const HQ_BOX = [46, 96];
// 안테나 끝 높이(빨간 경고등 자리). 1~3레벨은 안테나가 없다.
export function hqBeacon(lv) {
  const T = tier(lv);
  if (!T) return null;
  const h1 = (T === 2 ? 24 : 20) + (lv - (T === 2 ? 7 : 4)) * 2;
  return [8, 4, h1 + 1.6 + (T === 2 ? 14 : 12) + 22.5];
}
// 그림 전체를 k배로 키운 펜(건물은 발밑 크기와 상관없는 장식이라 화면에서 더 크게 보이게 한다)
export const scaled = (pen, k) => ({ ctx: pen.ctx, zoom: pen.zoom * k, P: (x, y, z = 0) => pen.P(x * k, y * k, z * k) });
export function drawHQ(pen, lv) {
  const T = tier(lv), R = rng(hash(lv, 3, 17));
  shadow(pen, 0, 0, 40, 0.4);
  if (T === 0) {
    const h = 16 + lv * 2, wood = '#8a6f45';
    box(pen, -22, -22, 44, 44, h, wood);
    planks(pen, 'y', -22, 22, 22, 0, h, 3, 'rgba(40,28,16,0.45)'); planks(pen, 'x', -22, 22, 22, 0, h, 3, 'rgba(40,28,16,0.45)');
    onY(pen, 22.05, -4, 5, 0, 11, '#3a2a1a'); // 문
    winY(pen, 22, 9, 17, 6, 11, true); winX(pen, 22, -14, -6, 6, 11, true);
    line(pen, [-15, 22.2, 5.5], [-7, 22.2, 11.5], '#6a5030', 1.2); line(pen, [-15, 22.2, 11.5], [-7, 22.2, 5.5], '#6a5030', 1.2); // 판자로 막은 창
    poly(pen, [[-24, -24, h], [24, -24, h], [24, 24, h + 0.5], [-24, 24, h]], '#3f6d8f'); // 방수포 지붕
    for (const t of [-10, 6]) line(pen, [-24, t, h + 0.6], [24, t + 2, h + 0.6], 'rgba(0,0,0,0.3)', 0.8);
    box(pen, -14, -14, 8, 8, 4, '#6a5a44', h); cyl(pen, 10, -8, 3, 5, '#5d6166', h);
    sandbagRow(pen, -18, 30, 18, 30, 0);
    flag(pen, 14, -14, h, 22, '#e0533f');
    return;
  }
  const big = T === 2, W = big ? 27 : 25, h1 = (big ? 24 : 20) + (lv - (big ? 7 : 4)) * 2, conc = big ? '#8d8a82' : '#8a7458';
  box(pen, -W, -W, W * 2, W * 2, h1, conc);
  if (big) { for (let k = 6; k < h1; k += 6) { line(pen, [-W, W, k], [W, W, k], 'rgba(0,0,0,0.18)', 0.6); line(pen, [W, -W, k], [W, W, k], 'rgba(0,0,0,0.18)', 0.6); } }
  else { planks(pen, 'y', -W, W, W, 0, h1, 4, 'rgba(30,20,10,0.25)'); planks(pen, 'x', -W, W, W, 0, h1, 4, 'rgba(30,20,10,0.25)'); }
  onY(pen, W + 0.05, -5, 5, 0, 12, '#2a2620'); onY(pen, W + 0.1, -4, 4, 0, 11, '#4a3a28'); // 문
  for (const x of [-18, 10]) winY(pen, W, x, x + 7, 9, 15, R() < 0.8);
  for (const y of [-16, 2]) winX(pen, W, y, y + 7, 9, 15, R() < 0.6);
  box(pen, -W - 1, -W - 1, W * 2 + 2, W * 2 + 2, 1.6, shade(conc, 0.85), h1); // 처마
  const W2 = big ? 17 : 15, h2 = big ? 14 : 12;
  box(pen, -W2 - 4, -W2 - 4, W2 * 2, W2 * 2, h2, shade(conc, 1.05), h1 + 1.6);
  winY(pen, W2 - 4, -12, -4, h1 + 5, h1 + 10, true); winY(pen, W2 - 4, 2, 9, h1 + 5, h1 + 10, true); winX(pen, W2 - 4, -14, -7, h1 + 5, h1 + 10, true);
  const roof = h1 + 1.6 + h2;
  cyl(pen, -12, -12, 4.5, 7, '#6a7480', roof); // 물탱크
  box(pen, 2, -14, 7, 5, 4, '#9aa0a6', roof); line(pen, [3, -9.1, roof + 2], [8, -9.1, roof + 2], 'rgba(0,0,0,0.4)', 0.6); // 실외기
  line(pen, [8, 4, roof], [8, 4, roof + 22], '#b9c0ca', 1); line(pen, [5, 4, roof + 14], [11, 4, roof + 14], '#b9c0ca', 0.8); puff(pen, 8, 4, roof + 22.5, 1.3, '#ff5a3c'); // 안테나
  flag(pen, -2, 8, roof, 18, '#e0533f');
  if (big) {
    for (const [a, b] of [[[-W2 - 4, W2 - 4], [W2 - 4, W2 - 4]], [[W2 - 4, -W2 - 4], [W2 - 4, W2 - 4]]]) { line(pen, [...a, roof + 4], [...b, roof + 4], '#5a5e64', 0.8); } // 난간
    box(pen, -8, 6, 6, 6, 3, '#5a5e64', roof); cyl(pen, -5, 9, 2.6, 3, '#d8d4c0', roof + 3); // 탐조등
    const [sx, sy] = pen.P(-5, 9, roof + 4.5); const g = pen.ctx.createRadialGradient(sx, sy, 0, sx, sy, 10 * pen.zoom); g.addColorStop(0, 'rgba(255,240,190,0.7)'); g.addColorStop(1, 'rgba(255,240,190,0)'); pen.ctx.fillStyle = g; pen.ctx.beginPath(); pen.ctx.arc(sx, sy, 10 * pen.zoom, 0, Math.PI * 2); pen.ctx.fill();
    sandbagRow(pen, -26, 34, 26, 34, 0); sandbagRow(pen, 34, -26, 34, 26, 0); sandbagRow(pen, -20, 34, 20, 34, 4.4); // 모래주머니 벽
  } else sandbagRow(pen, -16, 32, 16, 32, 0);
}

// 기지 건물 6종: 레벨 1~3 · 4~6 · 7~10 세 단계로 겉모습이 달라진다
export const BLD_BOX = [26, 46];
export function drawBuilding(pen, id, lv) {
  const T = tier(lv), R = rng(hash(lv, id.length, 41));
  shadow(pen, 0, 0, 22, 0.35);
  switch (id) {
    case 'workbench': {
      const wood = '#7d6a52', roofC = T === 2 ? '#6a7078' : '#8a6a44';
      if (T >= 1) { box(pen, -14, -14, 28, 3, 16 + T * 2, T === 2 ? '#8a5a45' : wood); box(pen, -14, -11, 3, 25, 16 + T * 2, T === 2 ? '#8a5a45' : wood); } // 뒷벽
      for (const [x, y] of [[-14, -14], [11, -14], [-14, 11], [11, 11]]) box(pen, x, y, 3, 3, 18 + T * 2, shade(wood, 0.85));
      box(pen, -8, -4, 18, 8, 7, '#6a5a44'); box(pen, -9, -5, 20, 10, 1.6, '#9a7c56', 7); // 작업대
      box(pen, 4, -2, 4, 3, 3, '#4a4f55', 8.6); box(pen, -5, -3, 6, 2, 1, '#b9c0ca', 8.6); // 바이스·쇠판
      for (let i = 0; i < 4; i++) line(pen, [-11, -10 + i * 4, 9], [-11, -10 + i * 4, 15], ['#b9c0ca', '#8a6a44', '#c9925a', '#5d6166'][i], 1); // 벽에 건 공구
      box(pen, 8, 8, 6, 4, 4, '#3a3f45'); box(pen, 7, 7.5, 8, 5, 1.5, '#4a4f55', 4); // 모루
      const rz = 18 + T * 2;
      poly(pen, [[-16, -16, rz + 3], [16, -16, rz + 3], [16, 16, rz - 1], [-16, 16, rz - 1]], roofC);
      for (let k = -12; k < 16; k += 5) line(pen, [k, -16, rz + 3], [k, 16, rz - 1], 'rgba(0,0,0,0.2)', 0.7);
      if (T === 2) { box(pen, -12, -12, 5, 5, 12, '#7a5a45', rz); for (let i = 0; i < 3; i++) puff(pen, -9 + i * 1.5, -10 - i, rz + 14 + i * 4, 2.2 + i * 0.6, `rgba(150,150,150,${0.35 - i * 0.08})`); } // 굴뚝·연기
      break;
    }
    case 'dorm': {
      const canvas = ['#7a7a5a', '#6a7480', '#8a7a5a'];
      if (T === 0) {
        const tent = (x, y, c) => { poly(pen, [[x - 9, y + 7, 0], [x + 9, y + 7, 0], [x + 9, y, 11], [x - 9, y, 11]], sideTone(c, 0, 1)); poly(pen, [[x + 9, y - 7, 0], [x + 9, y + 7, 0], [x + 9, y, 11]], sideTone(c, 1, 0)); onX(pen, x + 9.05, y - 2, y + 2, 0, 6, '#2a2620'); line(pen, [x - 9, y, 11], [x + 9, y, 11], shade(c, 1.2), 0.8); };
        tent(-4, -7, canvas[0]); tent(3, 7, canvas[1]);
        line(pen, [-14, 14, 0], [-14, 14, 10], '#6a5a44', 0.8); line(pen, [-14, 14, 9], [8, 18, 9], '#c8c0a8', 0.6); // 빨랫줄
        poly(pen, [[-10, 15.5, 9], [-6, 16.3, 9], [-6, 16.3, 5], [-10, 15.5, 5.5]], '#8a3a4a');
      } else if (T === 1) {
        const c = '#6a7480', h = 14;
        box(pen, -14, -12, 28, 24, h, c);
        planks(pen, 'y', -14, 14, 12, 0, h, 3.5, 'rgba(0,0,0,0.2)');
        onY(pen, 12.05, -3, 3, 0, 9, '#2a2620'); winY(pen, 12, -11, -6, 5, 10, true); winY(pen, 12, 7, 12, 5, 10, true); winX(pen, 14, -8, -2, 5, 10, false);
        poly(pen, [[-15, -13, h], [15, -13, h], [15, 0, h + 7], [-15, 0, h + 7]], '#5a5048'); poly(pen, [[-15, 0, h + 7], [15, 0, h + 7], [15, 13, h], [-15, 13, h]], shade('#5a5048', 0.85));
        poly(pen, [[15, -13, h], [15, 13, h], [15, 0, h + 7]], shade(c, 0.6));
        cyl(pen, 9, -6, 1.2, 4, '#5d6166', h + 4); // 연통
      } else {
        const c = '#7a828c', h = 22;
        box(pen, -15, -12, 30, 24, h, c);
        for (const z of [4, 14]) { winY(pen, 12, -12, -7, z, z + 5, true); winY(pen, 12, -3, 2, z, z + 5, R() < 0.7); winY(pen, 12, 7, 12, z, z + 5, true); winX(pen, 15, -8, -3, z, z + 5, z === 4); }
        line(pen, [-15, 12, 11], [15, 12, 11], 'rgba(0,0,0,0.3)', 0.8);
        box(pen, 15, 2, 5, 9, 1, '#5a5e64', 10); for (let k = 0; k < 5; k++) box(pen, 15, 3 + k * 1.6, 5, 1.4, 1, '#5a5e64', k * 2); // 계단
        box(pen, -16, -13, 32, 26, 1.5, shade(c, 0.8), h);
        box(pen, -6, -6, 6, 6, 3, '#9aa0a6', h + 1.5);
      }
      break;
    }
    case 'sawmill': {
      const log = '#6e4e30';
      for (let k = 0; k < 3 + T; k++) hcyl(pen, -14, -12 + (k % 3) * 5.5, Math.floor(k / 3) * 5, 22, 2.8, 'x', shade(log, 0.9 + R() * 0.2), '#c9a074'); // 통나무 더미
      box(pen, -6, 4, 14, 8, 6, '#6a5a44'); box(pen, -7, 3, 16, 10, 1.2, '#9a7c56', 6); // 작업대
      const bz = 7.2, pts = []; for (let i = 0; i < 14; i++) { const f = (i / 14) * Math.PI * 2; pts.push([1 + Math.cos(f) * 5, 8, bz + 2 + Math.sin(f) * 5]); }
      poly(pen, pts, '#c4cacf'); poly(pen, pts.map(([a, b, c]) => [1 + (a - 1) * 0.3, b + 0.05, bz + 2 + (c - bz - 2) * 0.3]), '#6a7078'); // 원형 톱날
      for (let k = 0; k < 2 + T; k++) box(pen, 9, -12 + k * 0.4, 6, 16, 1.2, shade('#c79a62', 0.9 + k * 0.05), k * 1.3); // 켠 판자
      if (T >= 1) { for (const [x, y] of [[-16, -16], [14, -16], [-16, 14], [14, 14]]) box(pen, x, y, 2, 2, 20, '#5a4129'); poly(pen, [[-17, -17, 21], [17, -17, 21], [17, 17, 18], [-17, 17, 18]], T === 2 ? '#6a7078' : '#7a6a50'); }
      if (T === 2) { box(pen, -15, 14, 30, 4, 4, '#3a3f45'); for (let x = -13; x < 15; x += 4) line(pen, [x, 14, 4.2], [x, 18, 4.2], '#8a8d90', 0.7); } // 컨베이어
      for (let i = 0; i < 6; i++) disc(pen, -4 + R() * 14, 10 + R() * 6, 1, '#d9b98a'); // 톱밥
      break;
    }
    case 'scrapyard': {
      const greys = ['#7e8287', '#6a6e73', '#8a8d90', '#5a4a40'];
      for (let i = 0; i < 6 + T * 3; i++) rbox(pen, -8 + (R() - 0.5) * 16, -6 + (R() - 0.5) * 14, 5 + R() * 7, 3 + R() * 6, 2 + R() * 4, R() * 3, greys[i % 4], R() * (3 + T * 2)); // 고철 더미
      hcyl(pen, 6, -14, 0, 3, 4, 'y', '#1e2024', '#3a3d42'); // 타이어
      cyl(pen, 10, 6, 4, 9, '#5d6166');
      if (T >= 1) { // 크레인
        box(pen, 10, -14, 4, 4, 26 + T * 6, '#c9a03a');
        line(pen, [12, -12, 26 + T * 6], [-8, -2, 28 + T * 6], '#c9a03a', 1.6); line(pen, [-8, -2, 28 + T * 6], [-8, -2, 16], '#3a3d42', 0.6);
        box(pen, -10, -4, 4, 4, 1.5, '#5d6166', 14.5);
      }
      if (T === 2) { box(pen, -15, 6, 12, 10, 9, '#4a4f55'); for (let x = -14; x < -4; x += 3) poly(pen, [[x, 16.05, 7], [x + 1.5, 16.05, 7], [x + 2.5, 16.05, 9], [x + 1, 16.05, 9]], '#e0b43a'); } // 압착기
      break;
    }
    case 'recycler': {
      const bin = (x, y, c) => { box(pen, x, y, 7, 7, 8, c); box(pen, x - 0.5, y - 0.5, 8, 8, 1.2, shade(c, 1.15), 8); onY(pen, y + 7.05, x + 2, x + 5, 4, 6, 'rgba(255,255,255,0.6)'); };
      bin(-14, 6, '#3d84c4'); bin(-6, 8, '#5aa04a'); bin(2, 10, '#e0b43a');
      if (T >= 1) { // 선별 컨베이어·호퍼
        box(pen, -14, -10, 24, 5, 5, '#4a4f55'); for (let x = -12; x < 10; x += 3) line(pen, [x, -10, 5.2], [x, -5, 5.2], '#8a8d90', 0.6);
        poly(pen, [[6, -14, 14], [14, -14, 14], [12, -6, 6], [8, -6, 6]], '#5d6166'); box(pen, 6, -14, 8, 8, 1, '#6a7078', 14);
        for (let i = 0; i < 5; i++) puff(pen, -10 + i * 4, -7.5, 6, 1.1, ['#5aa9dc', '#e8e8e8', '#8fd14f', '#e0533f', '#f2c14e'][i]);
      }
      if (T === 2) for (let i = 0; i < 3; i++) { const c = ['#5aa9dc', '#d24a3c', '#e8e8e0'][i]; box(pen, 8 + (i % 2) * 7, -2 + i * 2, 6, 6, 6, c, i === 2 ? 6 : 0); line(pen, [8 + (i % 2) * 7, 4 + i * 2, (i === 2 ? 6 : 0) + 3], [14 + (i % 2) * 7, 4 + i * 2, (i === 2 ? 6 : 0) + 3], 'rgba(0,0,0,0.4)', 0.6); } // 압축 더미
      break;
    }
    case 'clinic': {
      const white = '#d6dade', cross = (face, a, b, z) => {
        if (face === 'y') { onY(pen, b, a - 1.2, a + 1.2, z - 4, z + 4, '#d23c34'); onY(pen, b + 0.05, a - 4, a + 4, z - 1.2, z + 1.2, '#d23c34'); }
        else { onX(pen, b, a - 1.2, a + 1.2, z - 4, z + 4, '#d23c34'); onX(pen, b + 0.05, a - 4, a + 4, z - 1.2, z + 1.2, '#d23c34'); }
      };
      if (T === 0) {
        poly(pen, [[-13, 10, 0], [13, 10, 0], [13, 0, 13], [-13, 0, 13]], sideTone(white, 0, 1)); poly(pen, [[13, -10, 0], [13, 10, 0], [13, 0, 13]], sideTone(white, 1, 0));
        poly(pen, [[-13, 6, 5], [-3, 6, 5], [-3, 3.5, 8], [-13, 3.5, 8]], '#d23c34'); onX(pen, 13.05, -3, 3, 0, 7, '#3a3d42');
        box(pen, 4, 12, 9, 4, 2, '#5aa04a', 2); for (const [x, y] of [[4.5, 12.5], [12, 12.5], [4.5, 15], [12, 15]]) line(pen, [x, y, 2], [x, y, 0], '#8a8d90', 0.6); // 들것
      } else {
        const h = T === 2 ? 18 : 13;
        box(pen, -14, -11, 28, 22, h, white);
        cross('y', -6, 11.05, h / 2 + 1); cross('x', -1, 14.05, h / 2 + 1);
        onY(pen, 11.05, 4, 10, 0, 9, '#9fb8c8'); winY(pen, 11, -12, -10, h - 6, h - 2, true);
        box(pen, -15, -12, 30, 24, 1.2, shade(white, 0.85), h);
        if (T === 2) { box(pen, -10, -8, 8, 6, 3, '#9aa0a6', h + 1.2); line(pen, [8, 4, h + 1.2], [8, 4, h + 16], '#b9c0ca', 0.8); puff(pen, 8, 4, h + 16.5, 1.2, '#ff5a3c'); box(pen, 16, 4, 9, 4, 2, '#5aa04a', 2); }
      }
      break;
    }
    case 'ammo': { // 총알 제작소: 1~3 탄약 압착기·상자 · 4~6 철판 작업장 · 7~10 콘크리트 공장(굴뚝)
      const crate = (x, y, z = 0) => { box(pen, x, y, 7, 5, 4, '#4f5a3a', z); onY(pen, y + 5.05, x + 1, x + 6, z + 1.2, z + 2.8, '#c9a83a'); line(pen, [x + 3.5, y, z + 4.05], [x + 3.5, y + 5, z + 4.05], 'rgba(0,0,0,0.35)', 0.6); };
      if (T >= 1) {
        const c = T === 2 ? '#8d8a82' : '#6a7078', h = T === 2 ? 20 : 15;
        box(pen, -15, -14, 24, 20, h, c);
        if (T === 1) for (let x = -14; x < 9; x += 2.5) line(pen, [x, 6, 0.5], [x, 6, h - 0.5], 'rgba(255,255,255,0.1)', 0.6);
        onY(pen, 6.05, -11, 1, 0, 10, '#3a3d42'); for (let z = 1.5; z < 10; z += 1.6) onY(pen, 6.1, -11, 1, z, z + 0.4, 'rgba(255,255,255,0.12)'); // 셔터
        winY(pen, 6, 3, 7, 7, 11, true);
        box(pen, -16, -15, 26, 22, 1.2, shade(c, 0.8), h);
        if (T === 2) { box(pen, -12, -11, 4, 4, 12, '#7a5a45', h + 1.2); for (let i = 0; i < 3; i++) puff(pen, -10 + i * 1.5, -9 - i, h + 15 + i * 4, 2.2 + i * 0.6, `rgba(150,150,150,${0.35 - i * 0.08})`); }
        poly(pen, [[-6, 6.1, h - 4], [0, 6.1, h - 4], [0, 6.1, h - 1], [-6, 6.1, h - 1]], '#c9a83a'); poly(pen, [[-4.5, 6.15, h - 3.4], [-1, 6.15, h - 3.4], [-0.4, 6.15, h - 2.5], [-1, 6.15, h - 1.6], [-4.5, 6.15, h - 1.6]], '#3a3020'); // 총알 간판
      }
      box(pen, 4, 9, 10, 6, 6, '#6a5a44'); box(pen, 3.5, 8.5, 11, 7, 1, '#9a7c56', 6); // 작업대
      box(pen, 6, 10, 3, 3, 6, '#4a4f55', 7); line(pen, [7.5, 11.5, 13], [10, 11.5, 15], '#9aa0a6', 1); // 압착기
      for (let i = 0; i < 5; i++) cyl(pen, 11 + (i % 3) * 1.2, 10 + Math.floor(i / 3) * 1.4, 0.45, 1.6, '#d9b24a', 7); // 만든 탄
      crate(-14, 9); crate(-6, 10); crate(-11, 9, 4);
      if (T >= 1) { crate(10, -14); crate(10, -8); }
      cyl(pen, 15, 3, 2.6, 4, '#5a5e64'); for (let i = 0; i < 4; i++) puff(pen, 14.5 + R(), 2.5 + R(), 4.2, 0.5, '#d9b24a'); // 탄피 통
      break;
    }
    case 'pack': { // 배낭 공방: 1~3 천막 작업대 · 4~6 함석 작업장 · 7~10 벽돌 공방(지붕에 배낭 간판)
      const bag = (x, y, z, c) => { box(pen, x, y, 5, 4, 6, c, z); box(pen, x - 0.3, y - 0.3, 5.6, 4.6, 1.5, shade(c, 1.18), z + 6); onY(pen, y + 4.05, x + 1, x + 4, z + 0.8, z + 3.4, shade(c, 0.72)); }; // 몸통·덮개·앞주머니
      if (T === 0) {
        for (const [x, y] of [[-15, -13], [13, -13], [-15, 9], [13, 9]]) box(pen, x, y, 2, 2, 16, '#6a5a44'); // 기둥
        poly(pen, [[-17, -15, 18], [16, -15, 18], [16, 12, 14], [-17, 12, 14]], '#a58c5c'); // 천막
        for (let k = -13; k < 16; k += 6) line(pen, [k, -15, 18], [k, 12, 14], 'rgba(0,0,0,0.16)', 0.8);
        for (const [x, c] of [[-12, '#6b7a3c'], [-6, '#8a5a3a']]) { line(pen, [x + 2.5, -13, 15], [x + 2.5, -13, 12], '#3a3d42', 0.6); bag(x, -14, 5, c); } // 걸어 둔 배낭
      } else {
        const c = T === 2 ? '#8a5a45' : '#6a7078', h = T === 2 ? 19 : 15;
        box(pen, -15, -14, 26, 20, h, c);
        if (T === 2) for (let z = 2; z < h; z += 2.5) onY(pen, 6.05, -15, 11, z, z + 0.3, 'rgba(0,0,0,0.18)'); // 벽돌 줄
        else for (let x = -14; x < 11; x += 2.5) line(pen, [x, 6, 0.5], [x, 6, h - 0.5], 'rgba(255,255,255,0.1)', 0.6); // 함석 골
        onY(pen, 6.05, -11, -3, 0, 10, '#3a2d22'); // 문
        winY(pen, 6, 2, 8, 7, 11, true);
        box(pen, -16, -15, 28, 22, 1.2, shade(c, 0.8), h);
        bag(-5, -4, h + 1.2, '#c9a83a'); // 지붕 간판
        if (T === 2) for (const [x, cc] of [[-14, '#4a5a6a'], [-8, '#6b7a3c']]) bag(x, 6.5, 0, cc); // 문 앞에 내놓은 배낭
      }
      box(pen, 4, 8, 11, 7, 6, '#6a5a44'); box(pen, 3.5, 7.5, 12, 8, 1, '#9a7c56', 6); // 작업대
      bag(5, 9, 7, '#6b7a3c');
      hcyl(pen, 11, 9.5, 7.9, 5, 1.1, 'y', '#c9b48a', '#e0cfa4'); hcyl(pen, 13, 9.5, 7.9, 5, 1.1, 'y', '#7a8a5a', '#9aaa7a'); // 천 두루마리
      line(pen, [9, 13, 7], [11.5, 14.5, 7], '#b9c0ca', 0.7); // 가위
      bag(10, -14, 0, '#8a5a3a'); bag(10, -8, 0, '#4a5a6a');
      break;
    }
    case 'repair': { // 수리점: 1 작업대·공구함 · 2 셔터 차고 · 3 간판·타이어 더미
      if (lv >= 2) {
        const c = '#6a7078', h = 14 + lv * 2;
        box(pen, -14, -12, 26, 22, h, c);
        onY(pen, 10.05, -10, 4, 0, 11, '#4a4f55'); for (let z = 1.5; z < 11; z += 1.6) onY(pen, 10.1, -10, 4, z, z + 0.4, 'rgba(255,255,255,0.15)'); // 셔터
        winY(pen, 10, 6, 10, 6, 10, true);
        box(pen, -15, -13, 28, 24, 1.2, shade(c, 0.8), h);
        if (lv >= 3) { box(pen, -6, -3, 12, 1.2, 6, '#e0b43a', h + 1.2); onY(pen, -1.75, -3, 3, h + 3, h + 5, '#2a2d33'); } // 렌치 간판
      }
      box(pen, 4, 12, 12, 6, 6, '#6a5a44'); box(pen, 3.5, 11.5, 13, 7, 1, '#9a7c56', 6); // 작업대
      box(pen, 6, 13, 3, 3, 2.5, '#4a4f55', 7); line(pen, [11, 14, 7], [14, 15, 8.5], '#b9c0ca', 1); // 연마기·렌치
      box(pen, -14, 12, 7, 5, 8, '#c33f36'); for (const z of [3, 5.5]) onY(pen, 17.05, -13.5, -7.5, z, z + 0.4, '#2a2d33'); // 공구함
      if (lv >= 3) for (let k = 0; k < 3; k++) hcyl(pen, 15, -8 + k * 0.3, k * 2.6, 3, 4.2, 'y', '#1e2024', '#3a3d42'); // 타이어 더미
      break;
    }
    default: box(pen, -14, -14, 28, 28, 12 + lv * 2, '#7d6a52');
  }
}
// 아직 안 지은 자리: 말뚝과 측량 끈
export function drawLot(pen) {
  for (const [x, y] of [[-13, -13], [13, -13], [13, 13], [-13, 13]]) { box(pen, x - 0.8, y - 0.8, 1.6, 1.6, 6, '#8a6a44'); }
  polyline(pen, [[-13, -13, 5], [13, -13, 5], [13, 13, 5], [-13, 13, 5], [-13, -13, 5]], 'rgba(242,169,59,0.65)', 0.7);
  for (let i = 0; i < 6; i++) disc(pen, -9 + (i % 3) * 9, -6 + Math.floor(i / 3) * 12, 1.2, 'rgba(160,150,120,0.35)');
}
// 공사 중 비계(건물·본부 위에 겹쳐 그린다). half = 반 너비, h = 높이
export function drawScaffold(pen, half, h) {
  const c = '#9aa0a6', p = half + 3;
  for (const [x, y] of [[-p, -p], [p, -p], [-p, p], [p, p]]) line(pen, [x, y, 0], [x, y, h + 4], c, 0.9);
  for (const z of [h * 0.35, h * 0.7, h + 3]) polyline(pen, [[-p, p, z], [p, p, z], [p, -p, z]], c, 0.8);
  line(pen, [-p, p, 0], [p, p, h * 0.7], c, 0.6); line(pen, [p, -p, 0], [p, p, h * 0.7], c, 0.6);
  box(pen, -p, p - 2, p * 2, 3, 0.6, '#b8945a', h * 0.7); // 발판
  for (let x = -p + 3; x < p; x += 7) onY(pen, p + 1.05, x, x + 3.5, h * 0.7 - 1.2, h * 0.7 - 0.2, '#e0b43a'); // 경고 띠
}
// 감시탑
export const TOWER_BOX = [14, 62];
export function drawTower(pen) {
  shadow(pen, 0, 0, 12);
  const wood = '#6a5a44';
  for (const [x, y] of [[-7, -7], [5, -7], [-7, 5], [5, 5]]) box(pen, x, y, 2, 2, 38, wood);
  for (const z of [10, 24]) { line(pen, [-6, 6, z], [6, 6, z + 12], shade(wood, 1.2), 0.8); line(pen, [6, -6, z], [6, 6, z + 12], shade(wood, 1.1), 0.8); } // 버팀대
  for (let z = 3; z < 38; z += 4) line(pen, [-2, 7.5, z], [1, 7.5, z], '#8a7656', 0.8); // 사다리
  box(pen, -10, -10, 20, 20, 2.5, '#8a7656', 38);
  for (const [a, b] of [[[-10, 10], [10, 10]], [[10, -10], [10, 10]]]) { line(pen, [...a, 44], [...b, 44], '#5a4a36', 1); line(pen, [...a, 41], [...b, 41], '#5a4a36', 0.6); }
  for (const [x, y] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) line(pen, [x, y, 40.5], [x, y, 50], '#5a4a36', 0.9);
  poly(pen, [[-12, -12, 50], [12, -12, 50], [0, 0, 58]], '#5a4a36'); poly(pen, [[12, -12, 50], [12, 12, 50], [0, 0, 58]], shade('#7a5a3a', 0.7)); poly(pen, [[-12, 12, 50], [12, 12, 50], [0, 0, 58]], shade('#7a5a3a', 0.85));
  sandbagRow(pen, -8, 8, 8, 8, 40.5);
}
// 모닥불 받침(돌 고리·장작). 불꽃은 화면에서 매 프레임 따로 그린다.
export function drawFirepit(pen) {
  for (let i = 0; i < 9; i++) { const f = (i / 9) * Math.PI * 2; rbox(pen, Math.cos(f) * 7, Math.sin(f) * 7, 3.2, 2.4, 2.2, f, '#6c6a64'); }
  rbox(pen, 0, 0, 10, 2, 2, 0.5, '#5a4129', 0.5); rbox(pen, 0, 0, 10, 2, 2, 2.1, '#6a4a2c', 1.5);
  disc(pen, 0, 0, 4, 'rgba(255,140,50,0.55)', 2);
}

// ---------- 전진기지 ----------
export const OUTPOST_BOX = [34, 64];
export function drawOutpost(pen, lv) {
  const R = rng(hash(lv, 9, 5));
  shadow(pen, 0, 0, 30, 0.35);
  // 1레벨: 천막 · 2레벨: 판잣집 · 3레벨: 판잣집 + 망루 + 발전기
  if (lv === 1) {
    const c = '#5f7a6a';
    poly(pen, [[-14, 10, 0], [14, 10, 0], [14, 0, 14], [-14, 0, 14]], sideTone(c, 0, 1)); poly(pen, [[14, -10, 0], [14, 10, 0], [14, 0, 14]], sideTone(c, 1, 0));
    onX(pen, 14.05, -3, 3, 0, 8, '#1e2420'); line(pen, [-14, 0, 14], [14, 0, 14], shade(c, 1.2), 0.8);
  } else {
    const c = '#6a5a44', h = 16 + lv * 2;
    box(pen, -14, -14, 28, 28, h, c);
    planks(pen, 'y', -14, 14, 14, 0, h, 3.2, 'rgba(0,0,0,0.3)'); planks(pen, 'x', -14, 14, 14, 0, h, 3.2, 'rgba(0,0,0,0.3)');
    onY(pen, 14.05, -3, 4, 0, 10, '#2a2620'); winX(pen, 14, -8, -2, 7, 12, true); winY(pen, 14, 7, 12, 7, 12, true);
    poly(pen, [[-16, -16, h + 4], [16, -16, h + 4], [16, 16, h], [-16, 16, h]], '#5a6068');
    for (let k = -12; k < 16; k += 5) line(pen, [k, -16, h + 4], [k, 16, h], 'rgba(0,0,0,0.25)', 0.6);
    if (lv === 3) {
      for (const [x, y] of [[-24, -24], [-16, -24], [-24, -16], [-16, -16]]) box(pen, x, y, 1.6, 1.6, 34, '#5a4a36');
      box(pen, -26, -26, 12, 12, 2, '#7a6a50', 34); line(pen, [-26, -14, 38], [-14, -14, 38], '#5a4a36', 0.8); line(pen, [-14, -26, 38], [-14, -14, 38], '#5a4a36', 0.8);
      box(pen, 18, 6, 9, 7, 6, '#4a5a3a'); for (let k = 0; k < 3; k++) onX(pen, 27.05, 7 + k * 2, 8 + k * 2, 1.5, 4.5, '#2a2d33'); // 발전기
      line(pen, [24, -8, 0], [24, -8, 30], '#7a7d80', 1); box(pen, 22, -10, 4, 3, 2.5, '#d8d4c0', 30); // 조명탑
    }
  }
  sandbagRow(pen, -18, 22, 6, 22, 0);
  box(pen, 16, 14, 7, 6, 6, '#7a6a50'); line(pen, [16, 20, 3], [23, 20, 3], 'rgba(0,0,0,0.35)', 0.6); // 보급 상자
  cyl(pen, 20, -14, 3.6, 9, ['#2f6fa0', '#7c5a3c', '#6d7176'][Math.floor(R() * 3)]);
  line(pen, [-20, 14, 0], [-20, 14, 18], '#5a4a36', 1); puff(pen, -20, 14, 18.5, 2, '#f2c46a'); // 등불
  flag(pen, -4, -14, lv === 1 ? 14 : 20 + lv * 2, 14, '#5bb8a7');
}
// 비어 있는 후보지 표지판 · 공사 중 자재
export function drawSite(pen, building) {
  if (building) {
    for (const [x, y] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) line(pen, [x, y, 0], [x, y, 20], '#9aa0a6', 0.9);
    polyline(pen, [[-12, 12, 14], [12, 12, 14], [12, -12, 14]], '#9aa0a6', 0.8);
    box(pen, -10, -10, 20, 20, 4, '#6a5a44');
    for (let k = 0; k < 4; k++) box(pen, 14, -4 + k * 0.5, 14, 6, 1.1, shade('#c79a62', 0.9 + k * 0.04), k * 1.2); // 판자 더미
    for (let k = 0; k < 6; k++) rbox(pen, -18 + (k % 3) * 4, 16 + Math.floor(k / 3) * 3, 3.5, 2, 1.8, 0.1 * k, '#9a5a45', Math.floor(k / 3) * 1.8); // 벽돌
    poly(pen, [[-20, -4, 0], [-12, -6, 0], [-14, 4, 5], [-21, 4, 3]], '#3f6d8f'); // 방수포
    return;
  }
  line(pen, [0, 0, 0], [0, 0, 26], '#6d5a40', 1.6);
  box(pen, -12, -1, 24, 1.5, 9, '#c9b48a', 20); onY(pen, 0.55, -10, 10, 22, 27, '#b8a074');
  line(pen, [-6, 0.6, 24.5], [6, 0.6, 24.5], 'rgba(60,40,20,0.7)', 1.2); poly(pen, [[6, 0.6, 26], [9, 0.6, 24.5], [6, 0.6, 23]], 'rgba(60,40,20,0.7)'); // 화살표
  for (const [x, y] of [[-26, -26], [26, -26], [26, 26], [-26, 26]]) { line(pen, [x, y, 0], [x, y, 7], '#8a6a44', 1); poly(pen, [[x, y, 7], [x + 4, y - 1, 6], [x, y, 5]], '#f07a2a'); }
}
// 본부 바닥: 다진 흙 원판, 안쪽 순찰로, 콘크리트 판. R = 안전지대 반지름
// 본부 바닥: 사각형 기지(꼭짓점은 본부 중심 기준 월드 좌표). 흙 마당 + 안쪽 밝은 마당 + 점선 길 + 흙·얼룩 + 가운데 콘크리트 판.
export function drawBaseFloor(pen, pts) {
  const R = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
  const scaleP = (k) => pts.map(([x, y]) => [x * k, y * k]);
  poly(pen, pts, '#3a3429');
  poly(pen, scaleP(0.9), '#3f392c');
  poly(pen, scaleP(0.62), '#463f31');
  const { ctx, P, zoom } = pen;
  ctx.save(); ctx.strokeStyle = 'rgba(120,105,80,0.35)'; ctx.lineWidth = 9 * zoom; ctx.setLineDash([3 * zoom, 2 * zoom]);
  ctx.beginPath(); scaleP(0.78).forEach(([x, y], i) => { const [sx, sy] = P(x, y); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.stroke(); ctx.restore();
  // 사각형 안쪽인지(볼록, 반시계)
  const inside = (x, y, k) => scaleP(k).every(([ax, ay], i, a) => { const [bx, by] = a[(i + 1) % a.length]; return (x - ax) * (by - ay) - (y - ay) * (bx - ax) <= 0; });
  const Rn = rng(hash(Math.round(R), Math.round(pts[0][0]), 9));
  for (let i = 0; i < R * 1.2; i++) { const x = (Rn() * 2 - 1) * R, y = (Rn() * 2 - 1) * R; if (inside(x, y, 0.95)) disc(pen, x, y, 0.8 + Rn() * 1.2, Rn() < 0.5 ? 'rgba(170,150,110,0.3)' : 'rgba(0,0,0,0.2)'); }
  for (let i = 0; i < 6; i++) { const x = (Rn() * 2 - 1) * R * 0.7, y = (Rn() * 2 - 1) * R * 0.7; if (inside(x, y, 0.8)) splat(pen, x, y, 8 + Rn() * 10, 'rgba(30,26,20,0.35)', Rn); }
  poly(pen, [[-36, -36], [36, -36], [36, 36], [-36, 36]], '#55524a'); // 콘크리트 판
  for (let k = -36; k <= 36; k += 12) { line(pen, [k, -36], [k, 36], 'rgba(0,0,0,0.18)', 0.6); line(pen, [-36, k], [36, k], 'rgba(0,0,0,0.18)', 0.6); }
}
// 방벽 한 칸(기둥 사이): 레벨 0~2 판자 · 3~5 철판 · 6+ 콘크리트+철조망. broken이면 낮고 들쭉날쭉하다.
export function drawWallSeg(pen, x1, y1, x2, y2, h, lvB, broken, seed) {
  const R = rng(seed);
  const T = lvB >= 6 ? 2 : lvB >= 3 ? 1 : 0, col = ['#7a5a3a', '#6f7a84', '#8f8c84'][T];
  let nx = y2 - y1, ny = -(x2 - x1); const L = Math.hypot(nx, ny) || 1;
  if (nx + ny < 0) { nx = -nx; ny = -ny; } // 보는 쪽 면
  const tone = sideTone(col, nx / L, ny / L);
  const top = broken ? [h * (0.3 + R() * 0.2), h * (0.5 + R() * 0.3)] : [h, h];
  poly(pen, [[x1, y1, 0], [x2, y2, 0], [x2, y2, top[1]], [x1, y1, top[0]]], tone);
  const n = T === 2 ? 2 : 4;
  for (let i = 1; i < n; i++) { const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; line(pen, [x, y, 0], [x, y, top[0] + (top[1] - top[0]) * t], T === 1 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.3)', 0.6); }
  if (T === 1) for (let i = 0; i < 2; i++) { const t = R(), x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; line(pen, [x, y, h * 0.9], [x, y, h * 0.4], rgba('#8a4a22', 0.6), 1.4); }
  line(pen, [x1, y1, top[0]], [x2, y2, top[1]], shade(col, 1.25), 1.2);
  box(pen, x1 - 1.2, y1 - 1.2, 2.4, 2.4, h + 2, shade(col, 0.8)); // 기둥
  if (T === 2 && !broken) { // 철조망
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, h + 2.5 + (i % 2) * 2]); }
    polyline(pen, pts, '#9aa0a6', 0.6);
  }
}

// ---------- 캐릭터(움직이므로 매 프레임 그린다) ----------
// 화면 좌표로 그린다. 발밑 = P(x, y, z). dir = 바라보는 방향의 화면 단위 벡터. phase = 걸음 주기(라디안).
// o: { kind, dir, phase, moving, hit, weapon('gun'|'melee'|null), weaponId, eyes, trim, shirt, bag(0~1), wave, z, fall(0~1), fallSide(±1), alpha }
const CHAR = {
  player: { skin: '#e0c29f', body: '#d98a2b', legs: '#2f3540', hair: '#3a2a1e', scale: 1, w: 14, hunch: 0, arms: 'walk', boots: '#1f2226' },
  defender: { skin: '#d8b896', body: '#3f8f82', legs: '#2c3a36', helmet: '#3d4a36', scale: 1, w: 14, hunch: 0, arms: 'walk', boots: '#1f2226' },
  survivor: { skin: '#e9cba6', body: '#d7dde3', legs: '#4c5560', hair: '#5a4632', scale: 0.95, w: 13, hunch: 0, arms: 'walk', boots: '#2a2d33' },
  // 좀비 3등급 6종: 강점이 겉모습에 드러난다(체력형은 덩치, 피해형은 무기 같은 손, 속도형은 마르고 긴 다리)
  runner: { skin: '#a7b08a', legs: '#3d3a31', scale: 0.92, w: 11, hunch: 4.5, arms: 'flail', stride: 5.5, shirts: ['#7a4a3a', '#5a5a6a', '#857a5a'], hair: '#3a2e22' }, // 하급 속도형: 마르고 작게, 팔을 휘저으며 달린다
  bloater: { skin: '#a3b06a', legs: '#3b3f35', scale: 1.12, w: 19, hunch: 3.8, arms: 'lunge', stride: 3.2, head: 5.3, armW: 4.2, feat: 'belly', shirts: ['#6f6450', '#4f5a68', '#6a5050'], hair: '#2e2a22' }, // 하급 체력형: 불룩한 배, 뒤뚱 걸음
  sprinter: { skin: '#8e9a86', legs: '#2e3036', scale: 1, w: 10, hunch: 6, arms: 'trail', stride: 7, leg: 1.45, head: 5.3, eyes: '#ff4030', hat: 'hood', hatCol: '#4a4c54', shirts: ['#3e4048', '#4a3e3e'] }, // 중급 속도형: 긴 다리, 낮은 질주 자세, 찢어진 후드
  butcher: { skin: '#94a37c', legs: '#33302c', scale: 1.18, w: 16, hunch: 3, arms: 'chop', stride: 4, armW: 4.4, feat: 'apron', shirts: ['#5a4a40', '#4a4a50'], hair: '#2a2420' }, // 중급 피해형: 피 묻은 앞치마, 식칼 손
  hulk: { skin: '#7c8d69', legs: '#262a30', scale: 1.6, w: 20, hunch: 3.6, arms: 'lunge', stride: 3.4, head: 5, armW: 5, feat: 'armor', hat: 'helmet', hatCol: '#2a2f38', shirts: ['#3a4250'] }, // 상급 체력형: 진압복 갑옷·헬멧·방패
  slayer: { skin: '#8a6a62', legs: '#2c2624', scale: 1.35, w: 15, hunch: 3.5, arms: 'claw', stride: 4.8, armW: 3.8, head: 5.2, feat: 'claws', eyes: '#ff6a3c', shirts: ['#4a2a28', '#3a2a2a'] }, // 상급 피해형: 뼈 갈퀴, 드러난 갈비뼈, 붉은 기운
};
// 무기 모양: len(화면 길이), col, 종류별 머리 모양
const ARMS_LOOK = {
  pistol: { len: 7, col: '#2b2e33' }, shotgun: { len: 15, col: '#2b2e33', stock: '#6a4a2c' }, rifle: { len: 18, col: '#2b2e33', stock: '#7a5634' },
  carbine: { len: 15, col: '#1e2024', stock: '#1e2024', mag: true }, crossbow: { len: 12, col: '#5a4129', bow: true }, nailgun: { len: 9, col: '#e0b43a', body: true },
  flamer: { len: 14, col: '#4a4f55', tank: '#c33f36' }, savior: { len: 15, col: '#3a2e28', stock: '#8a5a2c' }, milestone: { len: 21, col: '#2b2e33', stock: '#4a4f55' },
  prometheus: { len: 15, col: '#5a4a40', tank: '#e0a43a' },
  pipe: { len: 13, col: '#8a8d90', w: 2.2 }, bat: { len: 14, col: '#a07850', w: 2.8, head: 'nails' }, machete: { len: 13, col: '#3a2e22', blade: '#c4cacf' },
  axe: { len: 15, col: '#6a4a2c', axe: '#b8412f' }, chainsaw: { len: 12, col: '#f07a2a', saw: true }, sledge: { len: 16, col: '#6a4a2c', hammer: '#5a5e64' },
  homerun: { len: 15, col: '#b8412f', w: 3, head: 'nails' }, bulwark: { len: 13, col: '#5a5e64', shield: true }, fist: null,
};
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function stroke(ctx, a, b, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
function dot(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

function drawWeapon(ctx, hx, hy, dx, dy, o, sc, C) {
  const id = o.weaponId, look = ARMS_LOOK[id] ?? (o.weapon === 'gun' ? ARMS_LOOK.rifle : ARMS_LOOK.pipe);
  if (!look) return;
  if (o.weapon === 'gun') {
    const L = look.len * sc, ex = hx + dx * L, ey = hy + dy * L * 0.6;
    if (look.stock) stroke(ctx, [hx, hy], [hx - dx * 4 * sc, hy - dy * 2.4 * sc + 1.5 * sc], C(look.stock), 3 * sc);
    if (look.tank) { rrect(ctx, hx - dx * 6 * sc - 2.5 * sc, hy - 7 * sc, 5 * sc, 8 * sc, 2 * sc); ctx.fillStyle = C(look.tank); ctx.fill(); }
    stroke(ctx, [hx, hy], [ex, ey], C(look.col), (look.body ? 4 : 2.6) * sc);
    if (look.mag) stroke(ctx, [hx + dx * 5 * sc, hy + dy * 3 * sc], [hx + dx * 5 * sc, hy + dy * 3 * sc + 3.5 * sc], C(look.col), 2 * sc);
    if (look.bow) stroke(ctx, [ex - dy * 6 * sc, ey + dx * 3 * sc], [ex + dy * 6 * sc, ey - dx * 3 * sc], C('#3a2e22'), 1.4 * sc);
    return [ex, ey];
  }
  // 근접: 손에서 앞·위로 치켜든다
  let ux = dx * 0.75, uy = dy * 0.45 - 0.75; const n = Math.hypot(ux, uy); ux /= n; uy /= n;
  const L = look.len * sc, ex = hx + ux * L, ey = hy + uy * L;
  if (look.shield) { rrect(ctx, hx + dx * 2 * sc - 5 * sc, hy - 8 * sc, 10 * sc, 13 * sc, 2.5 * sc); ctx.fillStyle = C('#6a7078'); ctx.fill(); stroke(ctx, [hx + dx * 2 * sc - 5 * sc, hy - 2 * sc], [hx + dx * 2 * sc + 5 * sc, hy - 2 * sc], C('#9aa0a6'), 1 * sc); return; }
  if (look.saw) { stroke(ctx, [hx, hy], [hx + ux * 5 * sc, hy + uy * 5 * sc], C(look.col), 5 * sc); stroke(ctx, [hx + ux * 5 * sc, hy + uy * 5 * sc], [ex, ey], C('#b9c0ca'), 2.4 * sc); return; }
  stroke(ctx, [hx, hy], [ex, ey], C(look.col), (look.w ?? 1.8) * sc);
  if (look.blade) stroke(ctx, [hx + ux * 3 * sc, hy + uy * 3 * sc], [ex + ux * 2 * sc, ey + uy * 2 * sc], C(look.blade), 3 * sc);
  if (look.axe) { stroke(ctx, [ex - uy * 3.5 * sc, ey + ux * 3.5 * sc], [ex + uy * 1 * sc, ey - ux * 1 * sc], C(look.axe), 4 * sc); }
  if (look.hammer) stroke(ctx, [ex - uy * 4 * sc, ey + ux * 4 * sc], [ex + uy * 4 * sc, ey - ux * 4 * sc], C(look.hammer), 5 * sc);
  if (look.head === 'nails') for (let i = 0; i < 3; i++) stroke(ctx, [ex - ux * i * 2 * sc, ey - uy * i * 2 * sc], [ex - ux * i * 2 * sc + uy * 2 * sc, ey - uy * i * 2 * sc - ux * 2 * sc], C('#c4cacf'), 0.6 * sc);
}

// 동료 직업별 차림(몸통·바지 색, 모자, 장비, 손에 든 무기 모양). 등급은 목도리·테두리 색(trim)으로 보인다.
const ROLE_LOOK = {
  gunner: { body: '#5d6b45', legs: '#3a4030', hat: 'helmet', hatCol: '#4a5a3a', gear: 'rig', weaponId: 'rifle' },
  brawler: { body: '#7a3a30', legs: '#33302c', hat: 'bandana', hatCol: '#c0392b', gear: 'bare', weaponId: 'bat', w: 15 },
  scout: { body: '#3f5a4a', legs: '#2e3a34', hat: 'hood', hatCol: '#4f6e5a', gear: 'bandolier', weaponId: 'milestone' },
  medic: { body: '#d9dde2', legs: '#4a5560', hat: 'cap', hatCol: '#eef0f2', gear: 'cross', weaponId: 'pistol' },
  engineer: { body: '#b9b83c', legs: '#3a4048', hat: 'hardhat', hatCol: '#f2c230', gear: 'hivis', weaponId: 'nailgun' },
};
// 플레이어 생존자 4명: 주황 겉옷은 같아 늘 눈에 띄고, 머리 모양·색, 체격, 수염·안경으로 구분한다
const HERO_LOOK = {
  youngM: { hairStyle: 'spiky' }, // 젊은 남자: 짧고 삐친 갈색 머리
  oldM: { hair: '#9a958c', w: 15, hairStyle: 'receding', beard: '#8f8a80', body: '#c9772a' }, // 중년 남자: 벗어진 회색 머리, 짧은 수염, 다부진 몸
  youngF: { hair: '#4a2e20', w: 12.5, hairStyle: 'long', body: '#e0912e' }, // 젊은 여자: 어깨까지 오는 긴 머리, 옆으로 넘긴 앞머리
  oldF: { hair: '#8a7f74', w: 13.5, hairStyle: 'curly', glasses: true, body: '#d68a3a' }, // 중년 여자: 희끗한 파마머리, 안경
};
const SKINS = ['#e3c4a0', '#d2a67e', '#b9875e', '#8d5f3e'], HAIRS = ['#2a221c', '#4a3626', '#6a4a2c', '#1e1e22', '#8a6a44'];

export const charScale = (kind) => CHAR[kind]?.scale ?? 1;

// ---------- 몸놀림(2026-10-25, Animal World의 리그 방식을 사람·좀비에 맞춤) ----------
// 걸음: 다리마다 위상이 있고, 디딘 발(stance)은 땅에 붙어 몸이 간 만큼만 뒤로 가며, 드는 발(swing)은 호를 그린다.
// 위상은 화면에서 실제로 움직인 거리 ÷ 한 주기 거리(gaitCycle)로 진행시킨다(index.html) → 발이 미끄러지지 않는다.
// duty 디딤 비율 · stroke 보폭(화면 단위, 크기 1 기준) · lift 드는 높이 · off 두 다리 위상 차 · lurch 상체 휘청(rad) · sway 좌우 뒤뚱 · drag 끄는 다리(±1)
const GAIT = {
  human: { duty: 0.6, stroke: 6.5, lift: 2.2, off: 0.5 },
  runner: { duty: 0.42, stroke: 7, lift: 2.8, off: 0.5, lurch: 0.07 }, // 하급 속도형: 허우적 뜀
  bloater: { duty: 0.68, stroke: 4.6, lift: 1.3, off: 0.5, sway: 1.6 }, // 하급 체력형: 뒤뚱
  sprinter: { duty: 0.38, stroke: 9, lift: 3.4, off: 0.5, lurch: 0.05 }, // 중급 속도형: 성큼 질주
  butcher: { duty: 0.62, stroke: 5.6, lift: 1.8, off: 0.4, drag: 1 }, // 중급 피해형: 한 발을 끈다(엇박)
  hulk: { duty: 0.7, stroke: 5.2, lift: 1.5, off: 0.5, sway: 1.1 }, // 상급 체력형: 무겁게 뒤뚱
  slayer: { duty: 0.55, stroke: 6.6, lift: 2.4, off: 0.45, lurch: 0.06, drag: -1 }, // 상급 피해형: 휘청이며 한 발을 끈다
};
const gaitOf = (kind) => GAIT[kind] ?? GAIT.human;
export const gaitCycle = (kind) => gaitOf(kind).stroke / gaitOf(kind).duty; // 걸음 한 주기 동안 몸이 가는 화면 거리(크기 1 기준)
const TAU = Math.PI * 2, frac = (v) => v - Math.floor(v), smooth = (t) => t * t * (3 - 2 * t);
function footAt(u, duty, stroke, lift) {
  if (u < duty) return { x: stroke * (0.5 - u / duty), y: 0 };
  const t = (u - duty) / (1 - duty);
  return { x: stroke * (-0.5 + smooth(t)), y: lift * Math.sin(Math.PI * t) };
}
// 2-bone IK: 뿌리 r에서 끝 t까지 a·b 두 뼈. 관절은 bend 방향으로 굽는 쪽을 고른다(무릎은 앞, 팔꿈치는 뒤).
function ikJoint(r, t, a, b, bend) {
  const vx = t[0] - r[0], vy = t[1] - r[1], d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, Math.hypot(vx, vy)));
  const base = Math.atan2(vy, vx), A2 = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const k1 = [r[0] + a * Math.cos(base + A2), r[1] + a * Math.sin(base + A2)], k2 = [r[0] + a * Math.cos(base - A2), r[1] + a * Math.sin(base - A2)];
  const mx = (r[0] + t[0]) / 2, my = (r[1] + t[1]) / 2;
  return (k1[0] - mx) * bend[0] + (k1[1] - my) * bend[1] >= (k2[0] - mx) * bend[0] + (k2[1] - my) * bend[1] ? k1 : k2;
}
// 스프링(2차 움직임): 목표를 늦게·출렁이며 따라간다
const springTo = (sp, target, k, c, dt) => { sp.v += (k * (target - sp.x) - c * sp.v) * dt; sp.x += sp.v * dt; };
// 외곽선: 부위마다 진한 밑선을 먼저 모두 긋고 색을 얹는다(관절에 줄이 생기지 않게). 좀비가 많아 오프스크린 실루엣 방식은 쓰지 않는다.
const OL = 'rgba(16,13,12,0.82)';
function limb(ctx, pts, ws, col, ol) {
  for (let i = 0; i < pts.length - 1; i++) stroke(ctx, pts[i], pts[i + 1], OL, ws[i] + ol);
  for (let i = 0; i < pts.length - 1; i++) stroke(ctx, pts[i], pts[i + 1], col, ws[i]);
}

export function drawCharacter(pen, x, y, o) {
  let L = CHAR[o.kind] ?? CHAR.runner;
  if (o.role && ROLE_LOOK[o.role]) L = { ...L, ...ROLE_LOOK[o.role], helmet: null };
  if (o.kind === 'player') L = { ...L, ...(HERO_LOOK[o.hero] ?? HERO_LOOK.youngM) };
  const { ctx, zoom } = pen, sc = L.scale * (o.scale ?? 1) * zoom;
  const [sx, sy] = pen.P(x, y, o.z ?? 0);
  const C = o.hit ? () => '#ffffff' : (c) => c;
  const [dx, dy] = o.dir ?? [0, 1], px = -dy, py = dx; // 진행 방향, 화면에서 그에 수직
  const back = dy < -0.15, ph = o.phase ?? 0, mv = o.moving ? 1 : 0;
  const zombie = !!L.shirts, human = !zombie, body = o.shirt ?? L.body ?? L.shirts[(o.seed ?? 0) % L.shirts.length];
  // 동료는 사람마다 피부·머리색이 다르다
  const crew = human && o.kind === 'defender', sd = o.seed ?? 0;
  const skin = crew ? SKINS[sd % SKINS.length] : L.skin, hairCol = crew ? HAIRS[Math.floor(sd / 2) % HAIRS.length] : L.hair;
  const player = o.kind === 'player';
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.lineCap = 'round';
  // 그림자(쓰러져도 그대로)
  ctx.fillStyle = 'rgba(0,0,0,0.36)'; ctx.beginPath(); ctx.ellipse(sx, sy, (L.w * 0.65) * sc, 4.4 * sc, 0, 0, Math.PI * 2); ctx.fill();
  if (o.fall) { ctx.translate(sx, sy); ctx.rotate((o.fallSide ?? 1) * o.fall * 1.45); ctx.translate(-sx, -sy); }
  const bob = mv ? Math.abs(Math.sin(ph)) * 1.3 * sc : Math.sin(ph * 0.35) * 0.35 * sc;
  const GT = gaitOf(human ? 'human' : o.kind), now = performance.now();
  // 리그 상태(o.rig, 캐릭터마다 이어지는 객체): 머리가 몸을 늦게 따라오고, 좀비 팔이 출렁이며, 사람은 깜빡이고 쉴 때 두리번거린다
  const R = o.rig && !o.fall ? o.rig : null;
  if (R) {
    const dt = R.t ? Math.min(0.05, Math.max(0, (now - R.t) / 1000)) : 0; R.t = now;
    R.hb ??= { x: bob, v: 0 }; R.arm ??= { x: 0, v: 0 }; R.look ??= { x: 0, v: 0 };
    if (!(R.lookNext > now)) { R.lookTo = Math.random() < 0.35 ? 0 : Math.random() * 2 - 1; R.lookNext = now + 1500 + Math.random() * 3500; }
    if (!(R.blinkNext > now)) { R.blinkEnd = now + 130; R.blinkNext = now + 2000 + Math.random() * 4000; }
    springTo(R.hb, bob, 160, 14, dt);
    springTo(R.arm, zombie && mv ? Math.sin(ph) * 2.4 + (GT.sway ?? 0) * Math.sin(ph) : 0, 60, 6, dt);
    springTo(R.look, human && !mv ? R.lookTo : 0, 40, 9, dt);
  }
  const swayX = mv && GT.sway ? Math.sin(ph) * GT.sway * sc : 0, breath = Math.sin(now / 1000 * 2.4 + (o.seed ?? 0) * 1.7) * (mv ? 0.3 : 1);
  if (L.feat === 'claws' && !o.fall) { // 학살자: 몸 둘레의 붉은 기운
    const rg = ctx.createRadialGradient(sx, sy - 14 * sc, 2 * sc, sx, sy - 14 * sc, 20 * sc);
    rg.addColorStop(0, 'rgba(220,40,20,0.28)'); rg.addColorStop(1, 'rgba(220,40,20,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, sy - 14 * sc, 20 * sc, 0, Math.PI * 2); ctx.fill();
  }
  const legK = L.leg ?? 1, lean = L.hunch * sc, tx = sx + dx * lean + px * swayX, hipY = sy - 9 * sc * legK, topY = sy - (21 + 9 * (legK - 1)) * sc - bob + (zombie ? L.hunch * 0.3 * sc : 0);
  // 다리: 발 고정 걸음 + 무릎 IK. 먼 쪽(화면 위쪽) 다리부터.
  const cyc = ph / TAU, seg = 9 * legK * sc * 0.54;
  const legs = [-1, 1].map((side) => {
    const f = mv ? footAt(frac(cyc + (side > 0 ? 0 : GT.off)), GT.duty, GT.stroke * sc, GT.lift * sc * (GT.drag === side ? 0.18 : 1)) : { x: 0, y: 0 };
    const hip = [sx + px * side * (L.w * 0.17) * sc, hipY], foot = [sx + px * side * (L.w * 0.2) * sc + dx * f.x, sy + dy * f.x - f.y];
    return { side, k: side * py, hip, foot, knee: ikJoint(hip, foot, seg, seg, [dx + px * side * 0.35, dy + py * side * 0.35]) };
  }).sort((a, b) => a.k - b.k);
  const bootCol = L.boots ?? shade(L.legs, 0.7);
  for (const g of legs) {
    limb(ctx, [g.hip, g.knee, g.foot], [4.4 * sc, 3.8 * sc], C(L.legs), 1.4 * sc);
    if (human) {
      // 정강이 안쪽 그늘과 밑창 있는 부츠
      stroke(ctx, [g.knee[0] + 0.8 * sc, g.knee[1] + 0.6 * sc], [g.foot[0] + 0.8 * sc, g.foot[1] - 2 * sc], C(shade(L.legs, 0.72)), 1 * sc);
      const fx = g.foot[0] + dx * 1.2 * sc, fy = g.foot[1];
      ctx.fillStyle = C('#121416'); ctx.beginPath(); ctx.ellipse(fx, fy + 0.7 * sc, 2.9 * sc, 1.7 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C(bootCol); ctx.beginPath(); ctx.ellipse(fx, fy - 0.2 * sc, 2.6 * sc, 1.9 * sc, 0, 0, Math.PI * 2); ctx.fill();
      dot(ctx, fx - 0.8 * sc, fy - 0.9 * sc, 0.7 * sc, C(shade(bootCol, 1.6)));
    } else { dot(ctx, g.foot[0] + dx * 1 * sc, g.foot[1], 2.9 * sc, OL); dot(ctx, g.foot[0] + dx * 1 * sc, g.foot[1], 2.2 * sc, C(bootCol)); }
  }
  // 상체 휘청(좀비): 엉덩이를 축으로 좌우로 기운다
  if (mv && GT.lurch) { ctx.translate(sx, hipY); ctx.rotate(Math.sin(ph) * GT.lurch); ctx.translate(-sx, -hipY); }
  if (L.arms === 'lunge') { const k = 0.1 + (mv ? 0.06 * Math.abs(Math.sin(ph)) : 0); ctx.translate(sx, hipY); ctx.rotate(k * Math.sign(dx || 1) * Math.min(1, Math.abs(dx) * 1.5)); ctx.translate(-sx, -hipY); } // 진행 방향으로 쏠린다
  // 팔: 어깨 → 손
  // 손을 흔들 때는 어깨를 화면 좌우로 벌린다(옆을 봐도 팔이 머리에 가리지 않게)
  const sh = (side) => (o.wave ? [tx + side * (L.w * 0.5 - 1) * sc, topY + 3 * sc] : [tx + px * side * (L.w * 0.5 - 1) * sc, topY + 3 * sc]);
  const hand = (side) => {
    const h0 = hand0(side);
    return R && zombie ? [h0[0] + px * R.arm.x * sc, h0[1] + py * R.arm.x * 0.5 * sc + Math.abs(R.arm.x) * 0.3 * sc] : h0;
  };
  const hand0 = (side) => {
    const s0 = sh(side), sw = mv ? Math.sin(ph + (side > 0 ? Math.PI : 0)) : 0;
    // 덮치기(덩치 큰 좀비): 두 팔을 어깨보다 높이 치켜들어 앞으로 뻗고, 걸음에 맞춰 위아래로 출렁인다
    if (L.arms === 'lunge') return [s0[0] + dx * 10 * sc + px * side * 1.5 * sc, s0[1] + dy * 5 * sc - 6.5 * sc + Math.sin(ph * 2 + side) * 1.6 * sc * (mv || 0.3)];
    if (L.arms === 'reach') return [s0[0] + dx * 9 * sc, s0[1] + dy * 5 * sc + 2 * sc + Math.sin(ph * 0.5 + side) * 1.2 * sc];
    // 러너: 두 팔을 번갈아 머리 위까지 크게 휘젓는다
    if (L.arms === 'flail') return [s0[0] - dx * sw * 6 * sc + dx * 3 * sc + px * side * 3 * sc, s0[1] + 3 * sc - (0.5 + 0.5 * Math.sin(ph + side * 1.4)) * 10 * sc * (mv || 0.4)];
    // 질주자: 낮게 숙이고 팔을 뒤로 젖혀 흔든다
    if (L.arms === 'trail') return [s0[0] - dx * (7 + sw * 3) * sc + px * side * 2 * sc, s0[1] + 5 * sc - dy * 3 * sc];
    // 도살자: 긴 두 팔을 몸 앞으로 뻗은 채 위아래·좌우로 흔든다(오른손에 식칼)
    if (L.arms === 'chop') { const a = mv || 0.4; return [s0[0] + dx * 12 * sc + px * side * (1.5 + Math.sin(ph + side) * 1.8 * a) * sc, s0[1] + dy * 6 * sc - 1 * sc + Math.sin(ph * 2 + side * 1.6) * 3.2 * sc * a]; }
    // 학살자: 뼈 갈퀴 두 팔을 양옆으로 벌리고 위아래로 크게 휘두른다(두 팔이 엇갈려)
    if (L.arms === 'claw') return [s0[0] + dx * 5 * sc + px * side * 6.5 * sc, s0[1] - 3 * sc + Math.sin(ph * 2 + (side > 0 ? 0 : Math.PI)) * 6 * sc * (mv || 0.4)];
    if (L.arms === 'hang') return [s0[0] + px * side * 2.5 * sc + dx * sw * 2.5 * sc, s0[1] + 11 * sc];
    if (o.wave) return [s0[0] + side * (3 + Math.sin(ph * 2.2 + side) * 2) * sc, s0[1] - 10 * sc];
    if (o.weapon && side === 1) return [s0[0] + dx * 7 * sc, s0[1] + dy * 4 * sc + 4 * sc];
    return [s0[0] + dx * sw * 3.5 * sc, s0[1] + 8 * sc];
  };
  const bare = L.gear === 'bare'; // 근접전사는 민소매라 맨팔
  const armCol = zombie || o.kind === 'survivor' || bare ? skin : body;
  const wo = o.weaponId || !L.weaponId ? o : { ...o, weaponId: L.weaponId };
  const arms = [-1, 1].map((side) => ({ side, k: side * py })).sort((a, b) => a.k - b.k);
  const drawArm = (side) => {
    const s0 = sh(side), h = hand(side), aw = (L.armW ?? (bare ? 3.6 : 3.2)) * sc, ua = 9.5 * sc * 0.52;
    // 팔꿈치: 사람은 뒤·바깥으로, 좀비는 뻗은 팔이면 아래로, 늘어뜨린 팔이면 바깥으로 굽는다
    const out = [px * side, py * side];
    const bend = o.wave ? [side, 0.5] : human ? [-dx + out[0] * 0.4, -dy * 0.6 + 0.35 + out[1] * 0.4] : L.arms === 'reach' || L.arms === 'lunge' ? [out[0] * 0.3, 1] : L.arms === 'hang' ? [out[0], 0.2] : L.arms === 'claw' || L.arms === 'flail' ? [out[0], out[1] + 0.6] : L.arms === 'chop' ? [out[0] * 0.3, 1] : [-dx, 0.4];
    const el = ikJoint(s0, h, ua, ua, bend);
    limb(ctx, [s0, el, h], [aw, aw * 0.9], C(armCol), 1.3 * sc);
    if (zombie && !o.hit) {
      if (L.feat === 'claws') for (const k of [-1, 0, 1]) stroke(ctx, h, [h[0] + dx * 5 * sc + px * k * 1.6 * sc, h[1] + dy * 3 * sc + 1.6 * sc + Math.abs(k) * 0.8 * sc], '#e8dcc0', 0.9 * sc); // 뼈 갈퀴
      if (L.feat === 'apron' && side === 1) { // 도살자 식칼
        const bx0 = h[0] + dx * 1.5 * sc, by0 = h[1] + 1 * sc;
        ctx.fillStyle = '#b9c0ca'; ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx0 + dx * 7 * sc, by0 + dy * 4 * sc + 2 * sc); ctx.lineTo(bx0 + dx * 7 * sc, by0 + dy * 4 * sc + 6 * sc); ctx.lineTo(bx0, by0 + 4 * sc); ctx.closePath(); ctx.fill();
        stroke(ctx, [bx0, by0 + 4 * sc], [bx0 + dx * 7 * sc, by0 + dy * 4 * sc + 6 * sc], 'rgba(110,20,20,0.8)', 0.8 * sc);
      }
      if (L.feat === 'armor' && side === -1) { // 거구 진압 방패
        rrect(ctx, h[0] - 4 * sc, h[1] - 8 * sc, 8 * sc, 12 * sc, 1.5 * sc); ctx.fillStyle = 'rgba(150,175,195,0.75)'; ctx.fill();
        ctx.fillStyle = '#e8ecef'; ctx.fillRect(h[0] - 3 * sc, h[1] - 3.5 * sc, 6 * sc, 1.2 * sc);
      }
    }
    if (human) {
      const at = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      if (!bare && o.kind !== 'survivor') stroke(ctx, at(el, h, 0.6), at(el, h, 0.78), C(shade(body, 0.72)), 3.4 * sc); // 소매 끝
      if (L.gear === 'cross') stroke(ctx, at(s0, el, 0.45), at(s0, el, 0.7), C('#d23c34'), 3 * sc); // 적십자 완장(가는 띠)
    }
    dot(ctx, h[0], h[1], 1.7 * sc, C(player ? '#3a332c' : skin)); // 플레이어는 장갑
    if (side === 1 && o.weapon) drawWeapon(ctx, h[0], h[1], dx, dy, wo, sc, C);
  };
  const bag = () => { // 배낭: 가방이 찰수록 불룩해진다. 위에 침낭을 말아 묶었다.
    if (!player) return;
    const bw = (7 + (o.bag ?? 0) * 2.5) * sc, bh = (8 + (o.bag ?? 0) * 2.5) * sc, bx = tx - dx * 4.5 * sc - bw / 2, by = topY + 2 * sc;
    rrect(ctx, bx, by, bw, bh, 2.5 * sc); ctx.fillStyle = C('#5a4a36'); ctx.fill();
    stroke(ctx, [bx + 1.5 * sc, by + bh * 0.45], [bx + bw - 1.5 * sc, by + bh * 0.45], C('#3e3226'), 1 * sc);
    rrect(ctx, bx + bw * 0.25, by + bh * 0.55, bw * 0.5, bh * 0.32, 1.2 * sc); ctx.fillStyle = C('#4e4030'); ctx.fill(); // 앞주머니
    rrect(ctx, bx - 1 * sc, by - 2.8 * sc, bw + 2 * sc, 3.4 * sc, 1.7 * sc); ctx.fillStyle = C('#8a7a52'); ctx.fill(); // 침낭
    for (const t of [0.28, 0.72]) stroke(ctx, [bx + bw * t, by - 2.8 * sc], [bx + bw * t, by + 0.6 * sc], C('#3e3226'), 0.9 * sc);
  };
  if (back) { drawArm(arms[0].side); drawArm(arms[1].side); }
  else { if (!back) bag(); drawArm(arms[0].side); }
  // 몸통: 왼쪽이 밝고 오른쪽이 어둡다
  const w = (L.w) * sc, th = 13 * sc * (1 + 0.03 * breath), bx = tx - w / 2, by = topY - (th - 13 * sc), cx = tx; // 숨쉬기: 몸통이 살짝 부풀었다 줄어든다
  const g = ctx.createLinearGradient(bx, 0, bx + w, 0);
  g.addColorStop(0, C(shade(body, 1.12))); g.addColorStop(0.55, C(body)); g.addColorStop(1, C(shade(body, 0.7)));
  rrect(ctx, bx, by, w, th, 4 * sc); ctx.fillStyle = g; ctx.fill();
  if (zombie && !o.hit) { // 찢어진 옷·핏자국
    ctx.fillStyle = L.skin;
    for (let i = 0; i < 3; i++) { const tx0 = bx + (i + 0.5) * w / 3; ctx.beginPath(); ctx.moveTo(tx0 - 1.6 * sc, by + th); ctx.lineTo(tx0, by + th - 3 * sc); ctx.lineTo(tx0 + 1.6 * sc, by + th); ctx.fill(); }
    dot(ctx, bx + w * 0.3, by + th * 0.4, 1.6 * sc, 'rgba(110,20,20,0.75)'); dot(ctx, bx + w * 0.65, by + th * 0.7, 1.1 * sc, 'rgba(110,20,20,0.6)');
    if (L.feat === 'belly' && !back) { // 뚱보: 옷 밖으로 불룩한 배, 핏줄과 고름
      ctx.fillStyle = shade(L.skin, 1.05); ctx.beginPath(); ctx.ellipse(cx + dx * 2 * sc, by + th * 0.64, w * 0.42, th * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      stroke(ctx, [cx - 2 * sc, by + th * 0.5], [cx + 1 * sc, by + th * 0.7], 'rgba(70,90,60,0.7)', 0.6 * sc);
      for (const [ox, oy] of [[-3, 0.55], [2.5, 0.75], [0.5, 0.45]]) dot(ctx, cx + ox * sc, by + th * oy, 0.9 * sc, '#c8d07a');
    }
    if (L.feat === 'apron') { // 도살자: 피 묻은 앞치마(뒤에서는 끈)
      if (!back) { rrect(ctx, bx + 2 * sc, by + 2.5 * sc, w - 4 * sc, th + 2 * sc, 1.5 * sc); ctx.fillStyle = '#c9c2b0'; ctx.fill(); for (const [ox, oy, r] of [[-2, 6, 1.6], [2, 9, 1.2], [0, 12, 1.8]]) dot(ctx, cx + ox * sc, by + oy * sc, r * sc, 'rgba(120,20,18,0.85)'); }
      else for (const s of [-1, 1]) stroke(ctx, [cx + s * 2 * sc, by + 2 * sc], [cx - s * 2.5 * sc, by + th - 2 * sc], '#c9c2b0', 0.8 * sc);
    }
    if (L.feat === 'armor') { // 거구: 가슴 판·어깨 받침
      rrect(ctx, bx + 1.5 * sc, by + 1.5 * sc, w - 3 * sc, th * 0.62, 2 * sc); ctx.fillStyle = '#2e3542'; ctx.fill();
      stroke(ctx, [bx + 3 * sc, by + 2.4 * sc], [bx + w - 3 * sc, by + 2.4 * sc], 'rgba(255,255,255,0.18)', 0.8 * sc);
      for (const s of [-1, 1]) dot(ctx, cx + s * w * 0.45, by + 1.5 * sc, 3.6 * sc, '#3a4250');
    }
    if (L.feat === 'claws' && !back) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) stroke(ctx, [cx + s * 1.5 * sc, by + (4 + k * 2.4) * sc], [cx + s * (w * 0.4), by + (3.4 + k * 2.4) * sc], '#e8dcc0', 0.7 * sc); // 드러난 갈비뼈
  }
  if (human && !o.hit) {
    ctx.save(); rrect(ctx, bx, by, w, th, 4 * sc); ctx.clip();
    ctx.fillStyle = shade(body, 0.78); ctx.fillRect(bx, by + th - 2.2 * sc, w, 2.2 * sc); // 밑단
    // 직업별 장비
    if (L.gear === 'hivis') for (const t of [0.34, 0.66]) { ctx.fillStyle = '#e8ecef'; ctx.fillRect(bx, by + th * t, w, 1.3 * sc); }
    if (L.gear === 'bare') { ctx.fillStyle = shade(body, 0.6); ctx.fillRect(cx - 0.5 * sc, by, 1 * sc, th); } // 조끼 앞섶
    ctx.restore();
    // 벨트·버클
    stroke(ctx, [bx + 0.6 * sc, by + th - 2.6 * sc], [bx + w - 0.6 * sc, by + th - 2.6 * sc], '#2a2420', 1.5 * sc);
    if (!back) { ctx.fillStyle = '#c9a83a'; ctx.fillRect(cx - 1.1 * sc, by + th - 3.4 * sc, 2.2 * sc, 1.6 * sc); }
    if (!back) { // 옷깃(V)
      stroke(ctx, [cx - 2.6 * sc, by + 0.6 * sc], [cx, by + 3.2 * sc], shade(body, 0.62), 1 * sc);
      stroke(ctx, [cx + 2.6 * sc, by + 0.6 * sc], [cx, by + 3.2 * sc], shade(body, 0.62), 1 * sc);
    }
    if (player && !back) {
      stroke(ctx, [cx, by + 3 * sc], [cx, by + th - 3 * sc], 'rgba(0,0,0,0.3)', 0.8 * sc); // 지퍼
      for (const s of [-1, 1]) { ctx.strokeStyle = shade(body, 0.66); ctx.lineWidth = 0.7 * sc; ctx.strokeRect(cx + s * 3.4 * sc - 1.6 * sc, by + 4.2 * sc, 3.2 * sc, 2.6 * sc); } // 가슴 주머니
      for (const s of [-1, 1]) stroke(ctx, [cx + s * w * 0.3, by + 0.4 * sc], [cx + s * w * 0.27, by + th - 3 * sc], '#3e3226', 1.3 * sc); // 배낭 어깨끈
    }
    if (L.gear === 'rig' && !back) for (const i of [-1, 0, 1]) { rrect(ctx, cx + i * 3.2 * sc - 1.3 * sc, by + th * 0.42, 2.6 * sc, 3 * sc, 0.6 * sc); ctx.fillStyle = shade(body, 0.7); ctx.fill(); } // 탄입대
    if (L.gear === 'bandolier') { stroke(ctx, [bx + 1.5 * sc, by + 1 * sc], [bx + w - 1.5 * sc, by + th - 3 * sc], '#5a4029', 1.6 * sc); for (const t of [0.3, 0.5, 0.7]) dot(ctx, bx + 1.5 * sc + (w - 3 * sc) * t, by + 1 * sc + (th - 4 * sc) * t, 0.8 * sc, '#c9a83a'); } // 탄띠
    if (L.gear === 'cross') { // 가슴(뒤에서는 등)의 적십자 + 옆구리 구급 가방
      ctx.fillStyle = '#d23c34'; ctx.fillRect(cx - 0.8 * sc, by + 3.2 * sc, 1.6 * sc, 4.6 * sc); ctx.fillRect(cx - 2.3 * sc, by + 4.7 * sc, 4.6 * sc, 1.6 * sc);
      rrect(ctx, cx - px * w * 0.55 - 2 * sc, by + th - 4 * sc, 4 * sc, 3.4 * sc, 0.8 * sc); ctx.fillStyle = '#f2f2f2'; ctx.fill();
      ctx.fillStyle = '#d23c34'; ctx.fillRect(cx - px * w * 0.55 - 0.4 * sc, by + th - 3.6 * sc, 0.8 * sc, 2.6 * sc);
    }
    if (L.gear === 'hivis') { stroke(ctx, [cx + px * w * 0.5, by + th - 2.6 * sc], [cx + px * w * 0.5 + 0.6 * sc, by + th + 1.6 * sc], '#9aa0a6', 1.3 * sc); } // 허리에 찬 렌치
    if (crew) { rrect(ctx, cx - 3.6 * sc, by - 0.6 * sc, 7.2 * sc, 2.4 * sc, 1.2 * sc); ctx.fillStyle = o.trim ?? '#9aa0a6'; ctx.fill(); } // 등급 색 목도리
  }
  // 테두리: 등급(trim)이 있으면 그 색, 없으면 어두운 외곽선으로 또렷하게
  if (o.trim) { ctx.strokeStyle = o.hit ? '#ffffff' : o.trim; ctx.lineWidth = 1.2 * sc; rrect(ctx, bx, by, w, th, 4 * sc); ctx.stroke(); }
  else { ctx.strokeStyle = OL; ctx.lineWidth = 1 * sc; rrect(ctx, bx, by, w, th, 4 * sc); ctx.stroke(); }
  if (o.kind === 'defender' && !o.role && !o.hit) stroke(ctx, [bx + 1 * sc, by + th * 0.55], [bx + w - 1 * sc, by + th * 0.55], 'rgba(0,0,0,0.3)', 1.6 * sc); // 탄띠(직업 정보가 없을 때)
  if (back) bag(); else drawArm(arms[1].side);
  // 머리
  const look = R ? R.look.x : 0;
  const hr = (L.head ?? 5.8) * sc, hx = tx + dx * (zombie ? L.hunch * 0.5 * sc : 0) + (mv ? dx * Math.sin(ph * 2) * 0.35 * sc : 0) + px * look * 0.6 * sc;
  const hy = topY - 5.5 * sc + (zombie ? 1 * sc : 0) + (R ? bob - R.hb.x : 0); // 머리는 몸 오르내림을 살짝 늦게 따라온다
  const hat = L.hat;
  if (hat === 'hood') dot(ctx, hx - dx * 0.8 * sc, hy - 0.6 * sc, hr * 1.3, C(shade(L.hatCol, 0.85))); // 후드 뒤판
  if (L.hairStyle === 'long' && !back) { rrect(ctx, hx - hr * 1.08, hy - hr * 0.7, hr * 2.16, hr * 2.05, hr * 0.85); ctx.fillStyle = C(hairCol); ctx.fill(); } // 얼굴 뒤로 내려오는 긴 머리
  if (human && hat !== 'hood' && !back) for (const s of [-1, 1]) dot(ctx, hx + px * s * hr * 0.92, hy + 0.6 * sc, 1.3 * sc, C(shade(skin, 0.88))); // 귀
  if (hat !== 'hood') dot(ctx, hx, hy, hr + 0.75 * sc, OL); // 머리 외곽선
  if (human && !o.hit) { // 얼굴 명암: 왼쪽 위가 밝다
    const rg = ctx.createRadialGradient(hx - hr * 0.35, hy - hr * 0.4, hr * 0.15, hx, hy, hr * 1.05);
    rg.addColorStop(0, shade(skin, 1.1)); rg.addColorStop(0.6, skin); rg.addColorStop(1, shade(skin, 0.78));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(hx, hy, hat === 'hood' ? hr * 0.86 : hr, 0, Math.PI * 2); ctx.fill();
  } else dot(ctx, hx, hy, hr, C(skin));
  const capArc = (r, col, lift = 0.6) => { ctx.fillStyle = C(col); ctx.beginPath(); ctx.arc(hx, hy - lift * sc, r, Math.PI, 0); ctx.fill(); };
  if (hat === 'helmet') { // 철모 + 테 + 턱끈
    capArc(hr * 1.14, L.hatCol); stroke(ctx, [hx - hr * 1.3, hy - 0.4 * sc], [hx + hr * 1.3, hy - 0.4 * sc], C(shade(L.hatCol, 0.75)), 1.5 * sc);
    dot(ctx, hx - hr * 0.4, hy - hr * 0.75, hr * 0.22, C(shade(L.hatCol, 1.35)));
    if (!back) for (const s of [-1, 1]) stroke(ctx, [hx + s * hr * 0.95, hy - 0.2 * sc], [hx + s * hr * 0.72, hy + hr * 0.62], C(shade(L.hatCol, 0.6)), 0.6 * sc); // 양쪽 턱끈(얼굴 가장자리)
  } else if (hat === 'hardhat') { // 안전모: 둥근 머리 + 넓은 챙 + 가운데 줄
    capArc(hr * 1.18, L.hatCol, 0.9); stroke(ctx, [hx - hr * 1.45, hy - 0.5 * sc], [hx + hr * 1.45, hy - 0.5 * sc], C(shade(L.hatCol, 0.8)), 1.6 * sc);
    stroke(ctx, [hx, hy - hr * 1.2], [hx, hy - 0.8 * sc], C(shade(L.hatCol, 1.2)), 1 * sc);
  } else if (hat === 'cap') { // 흰 모자 + 챙 + 작은 적십자
    capArc(hr * 1.04, L.hatCol, 0.8);
    if (!back) { stroke(ctx, [hx + dx * hr * 0.4 - px * hr * 0.6, hy - 0.6 * sc + dy * 1.2 * sc], [hx + dx * hr * 1.1 + px * hr * 0.6, hy - 0.6 * sc + dy * 1.6 * sc], C(shade(L.hatCol, 0.82)), 1.4 * sc); ctx.fillStyle = C('#d23c34'); ctx.fillRect(hx - 0.4 * sc, hy - hr * 0.95, 0.8 * sc, 2.4 * sc); ctx.fillRect(hx - 1.2 * sc, hy - hr * 0.95 + 0.8 * sc, 2.4 * sc, 0.8 * sc); }
  } else if (hat === 'hood') { // 후드: 얼굴 둘레를 감싼다
    ctx.strokeStyle = C(L.hatCol); ctx.lineWidth = 2.2 * sc; ctx.beginPath(); ctx.arc(hx, hy, hr * 0.98, back ? 0 : Math.PI * 0.85, back ? Math.PI * 2 : Math.PI * 2.15); ctx.stroke();
    if (back) dot(ctx, hx, hy, hr, C(L.hatCol));
  } else if (hat === 'bandana') { // 짧은 머리 + 이마의 두건 + 뒤로 날리는 매듭
    capArc(hr * 1.02, hairCol ?? '#2a221c', 0.8);
    stroke(ctx, [hx - hr * 1.0, hy - hr * 0.42], [hx + hr * 1.0, hy - hr * 0.42], C(L.hatCol), 2.2 * sc);
    for (const k of [0.6, -0.4]) stroke(ctx, [hx - dx * hr * 0.9, hy - hr * 0.4], [hx - dx * hr * 1.9 + px * k * 2 * sc, hy - hr * 0.1 + Math.sin(ph + k) * 0.8 * sc], C(shade(L.hatCol, 0.85)), 1.2 * sc);
  } else if (L.helmet) { ctx.fillStyle = C(L.helmet); ctx.beginPath(); ctx.arc(hx, hy - 0.6 * sc, hr * 1.12, Math.PI, 0); ctx.fill(); stroke(ctx, [hx - hr * 1.3, hy - 0.4 * sc], [hx + hr * 1.3, hy - 0.4 * sc], C(shade(L.helmet, 0.8)), 1.4 * sc); }
  else if (hairCol) {
    const style = L.hairStyle;
    if (style === 'receding' && !back) { // 벗어진 머리: 옆머리만 남는다
      for (const s of [-1, 1]) dot(ctx, hx + px * s * hr * 0.82 * (1 - Math.abs(dx) * 0.7) - dx * hr * 0.62, hy - hr * 0.2, hr * 0.42, C(hairCol)); // 옆을 보면 뒤통수 쪽으로
    } else {
      ctx.fillStyle = C(hairCol); ctx.beginPath();
      if (back) ctx.arc(hx, hy, hr * 1.02, 0, Math.PI * 2); else ctx.arc(hx - dx * 1.5 * sc, hy - 1 * sc, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
    }
    if (style === 'long' && back) { rrect(ctx, hx - hr * 0.95, hy - hr * 0.2, hr * 1.9, hr * 1.75, hr * 0.7); ctx.fillStyle = C(hairCol); ctx.fill(); } // 등 뒤로 늘어진 머리
    if (style === 'curly') for (let k = 0; k < 7; k++) { const a = Math.PI * (1.02 + k * 0.16); dot(ctx, hx + Math.cos(a) * hr * 0.98, hy - 0.6 * sc + Math.sin(a) * hr * 0.98, hr * 0.3, C(shade(hairCol, k % 2 ? 1.12 : 0.92))); } // 파마 곱슬
    if (player && !back && style === 'spiky') for (const k of [-1, 0, 1]) dot(ctx, hx + dx * hr * 0.35 + px * k * hr * 0.42, hy - hr * 0.62 + Math.abs(k) * 0.4 * sc, hr * 0.32, C(hairCol)); // 삐친 앞머리
    if (player && !back && style === 'long') dot(ctx, hx + dx * hr * 0.3 + px * hr * 0.32, hy - hr * 0.58, hr * 0.48, C(hairCol)); // 옆으로 넘긴 앞머리
  }
  if (L.beard && !back && !o.hit) { ctx.fillStyle = C(L.beard); ctx.beginPath(); ctx.arc(hx + dx * 0.6 * sc, hy + 0.4 * sc, hr * 0.92, Math.PI * 0.12, Math.PI * 0.88); ctx.fill(); } // 짧은 수염
  if (o.kind === 'slayer' && !o.hit) stroke(ctx, [hx - 2 * sc, hy - 3 * sc], [hx + 2.5 * sc, hy - 1 * sc], 'rgba(60,20,20,0.6)', 0.8 * sc); // 흉터
  if (L.feat === 'armor' && !back && !o.hit) stroke(ctx, [hx - hr * 0.85, hy - 0.2 * sc], [hx + hr * 0.85, hy - 0.2 * sc], 'rgba(20,24,30,0.85)', 2 * sc); // 헬멧 가리개
  if (!back) {
    const ex = hx + dx * 2.2 * sc + px * look * 1.1 * sc, ey = hy - 0.5 * sc + dy * 1 * sc, ew = (zombie ? 1.3 : 0.9) * sc;
    const shut = human && R && now < R.blinkEnd; // 사람은 2~6초마다 눈을 깜빡인다
    for (const s of [-1, 1]) {
      if (shut) stroke(ctx, [ex + px * s * 2 * sc - 0.9 * sc, ey], [ex + px * s * 2 * sc + 0.9 * sc, ey], '#2a2018', 0.6 * sc);
      else dot(ctx, ex + px * s * 2 * sc, ey, ew, o.hit ? '#ffffff' : (L.eyes ?? o.eyes ?? '#2a2018'));
    }
    if (zombie && !o.hit) dot(ctx, ex, ey + 2.6 * sc, 1 * sc, 'rgba(30,10,10,0.8)'); // 벌린 입
    if (human && !o.hit) {
      for (const s of [-1, 1]) stroke(ctx, [ex + px * s * 2.9 * sc, ey - 1.5 * sc], [ex + px * s * 1.2 * sc, ey - 1.7 * sc], hat === 'hood' || !hairCol ? '#3a2a20' : hairCol, 0.6 * sc); // 눈썹
      stroke(ctx, [ex - px * 0.9 * sc, ey + 2.3 * sc], [ex + px * 0.9 * sc, ey + 2.3 * sc], L.beard ? shade(L.beard, 0.6) : shade(skin, 0.6), 0.55 * sc); // 입
      if (L.glasses) { // 안경
        ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 0.55 * sc;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(ex + px * s * 2 * sc, ey, 1.45 * sc, 0, Math.PI * 2); ctx.stroke(); }
        stroke(ctx, [ex - px * 0.55 * sc, ey], [ex + px * 0.55 * sc, ey], '#2a2622', 0.5 * sc);
      }
    }
  }
  ctx.restore();
}
