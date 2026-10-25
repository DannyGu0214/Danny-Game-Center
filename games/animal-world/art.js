// 그림 모듈: 게임 상태 없이 "펜"만 받아 그린다. 펜 = { ctx, P, zoom }.
// P(x, y, z) 는 월드 좌표(z = 높이)를 캔버스 좌표로 바꾼다(2:1 쿼터뷰). 한 칸 = TILE 월드 단위.
// 물건 그림은 자기 바닥 가운데 (0,0)을 기준으로 그린다. 빛은 왼쪽 위에서 온다.
// 동물은 쿼터뷰 땅 위에 옆모습 2D로 그린다(오른쪽을 보는 모습으로 그리고 face = -1이면 뒤집는다).

import * as R_RABBIT from './rigs/rabbit.js';
import * as R_MEERKAT from './rigs/meerkat.js';
import * as R_GAZELLE from './rigs/gazelle.js';
import * as R_ZEBRA from './rigs/zebra.js';
import * as R_OSTRICH from './rigs/ostrich.js';
import * as R_LION from './rigs/lion.js';
import * as R_GIRAFFE from './rigs/giraffe.js';
import * as R_ELEPHANT from './rigs/elephant.js';
import * as R_CRAB from './rigs/crab.js';
import * as R_GULL from './rigs/gull.js';
import * as R_TURTLE from './rigs/turtle.js';
import * as R_FLAMINGO from './rigs/flamingo.js';
import * as R_OTTER from './rigs/otter.js';
import * as R_SEALION from './rigs/sealion.js';
import * as R_DOLPHIN from './rigs/dolphin.js';
import * as R_WALRUS from './rigs/walrus.js';
import * as R_LIZARD from './rigs/lizard.js';
import * as R_JERBOA from './rigs/jerboa.js';
import * as R_FENNEC from './rigs/fennec.js';
import * as R_SNAKE from './rigs/snake.js';
import * as R_COYOTE from './rigs/coyote.js';
import * as R_VULTURE from './rigs/vulture.js';
import * as R_ORYX from './rigs/oryx.js';
import * as R_CAMEL from './rigs/camel.js';
import * as R_ADELIE from './rigs/adelie.js';
import * as R_SKUA from './rigs/skua.js';
import * as R_GENTOO from './rigs/gentoo.js';
import * as R_WEDDELL from './rigs/weddell.js';
import * as R_KING from './rigs/king.js';
import * as R_ELEPHANTSEAL from './rigs/elephantseal.js';
import * as R_EMPEROR from './rigs/emperor.js';
import * as R_ORCA from './rigs/orca.js';
import * as I_SEASIDE from './items/seaside.js';
import * as I_DESERT from './items/desert.js';
import * as I_ANTARCTIC from './items/antarctic.js';

export const ISO_A = 0.7071, ISO_B = 0.3536;
export const TILE = 32;

// ---------- 난수·색 ----------
export function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
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
const sideTone = (hex, nx, ny) => shade(hex, 0.64 + 0.08 * (ny - nx + 1));
const tones = (hex) => [hex, shade(hex, 0.8), shade(hex, 0.64)];

// ---------- 쿼터뷰 기본 도형 ----------
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
  ctx.strokeStyle = col; ctx.lineWidth = w * zoom; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
}
// 축에 맞춘 상자. col은 색 하나(자동 명암) 또는 [윗면, +y면, +x면]
export function box(pen, x, y, w, d, h, col, z0 = 0) {
  const [t, l, r] = Array.isArray(col) ? col : tones(col), z1 = z0 + h;
  poly(pen, [[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x + w, y, z1]], r);
  poly(pen, [[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x, y + d, z1]], l);
  poly(pen, [[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]], t);
}
const onY = (pen, Y, x0, x1, z0, z1, fill) => poly(pen, [[x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1]], fill);
export function cyl(pen, x, y, r, h, col, z0 = 0, topCol = null) {
  const { ctx, P, zoom } = pen;
  const [bx, by] = P(x, y, z0), [tx, ty] = P(x, y, z0 + h), rx = r * zoom * 1.0, ry = r * 0.5 * zoom;
  const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0);
  g.addColorStop(0, shade(col, 0.78)); g.addColorStop(0.32, shade(col, 1)); g.addColorStop(1, shade(col, 0.58));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI); ctx.lineTo(tx - rx, ty); ctx.ellipse(tx, ty, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = topCol ?? shade(col, 1.12);
  ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
export function disc(pen, x, y, r, fill, z = 0) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(sx, sy, r * zoom, r * 0.5 * zoom, 0, 0, Math.PI * 2); ctx.fill();
}
export function soft(pen, x, y, r, col, a) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y);
  ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * zoom);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.6, rgba(col, a * 0.6)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * zoom, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
export function splat(pen, x, y, r, fill, R, n = 11, z = 0, sq = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) { const f = (i / n) * Math.PI * 2, k = r * (0.78 + R() * 0.3); pts.push([x + Math.cos(f) * k, y + Math.sin(f) * k * sq, z]); }
  poly(pen, pts, fill);
}
export function puff(pen, x, y, z, r, col) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, r * zoom, 0, Math.PI * 2); ctx.fill();
}
export const shadow = (pen, x, y, r, a = 0.28) => soft(pen, x, y, r * 1.15, '#2a1d10', a);
// 낮은 다각형 덩어리(바위·흙더미)
export function lump(pen, x, y, r, h, col, R, o = {}) {
  const n = o.n ?? 9, sq = o.squash ?? 1;
  const mk = (rad, z, jit) => Array.from({ length: n }, (_, i) => {
    const f = (i / n) * Math.PI * 2, k = rad * (1 - jit / 2 + R() * jit);
    return [x + Math.cos(f) * k, y + Math.sin(f) * k * sq, z];
  });
  const r0 = mk(r, 0, 0.25), r1 = mk(r * (o.mid ?? 0.86), h * 0.55, 0.25), r2 = mk(r * (o.top ?? 0.5), h, 0.3);
  const faces = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, f = ((i + 0.5) / n) * Math.PI * 2, nx = Math.cos(f), ny = Math.sin(f);
    if (nx + ny > -0.2) faces.push({ pts: [r0[i], r0[j], r1[j], r1[i]], k: r0[i][0] + r0[i][1] + r0[j][0] + r0[j][1], c: sideTone(col, nx, ny) });
    faces.push({ pts: [r1[i], r1[j], r2[j], r2[i]], k: 1e5 + r1[i][0] + r1[i][1] + r1[j][0] + r1[j][1], c: shade(sideTone(col, nx, ny), 1.12) });
  }
  faces.sort((a, b) => a.k - b.k);
  for (const f of faces) poly(pen, f.pts, f.c);
  poly(pen, r2, shade(col, 1.06));
  return r2;
}
// 풀잎 한 포기(화면에서 위로 뻗는 가는 잎 몇 장)
function tuft(pen, x, y, h, col, R, n = 3) {
  for (let i = 0; i < n; i++) line(pen, [x + (R() - 0.5) * 2, y + (R() - 0.5) * 2, 0], [x + (R() - 0.5) * 5, y + (R() - 0.5) * 3, h * (0.6 + R() * 0.5)], i % 2 ? col : shade(col, 0.82), 0.9);
}

// ---------- 하늘과 섬(지역 땅) ----------
// 지역별 땅: 칸 색, 얼룩(blot), 칸 장식(deco: tuft 풀포기 · shell 조개·모래결 · pebble 자갈·모래결 · snow 눈 반짝임·얼음 금), 단면 색, 가장자리
export const PAL = {
  grassland: {
    tiles: ['#c8c467', '#bcc160', '#a9bd5a', '#d2c46e'], blot: ['#e0cf82', '#98b452'], deco: 'tuft', tuft: ['#8fa548', '#a3a64a'], dirt: '#9b6a3c', dirt2: '#7d5230', lip: '#93a84d',
  },
  seaside: {
    tiles: ['#f1dda6', '#ead49a', '#f5e4b6', '#e6cf92'], blot: ['#fff1cc', '#d9bf84'], deco: 'shell', tuft: ['#c9b27a', '#e9e0cf'], dirt: '#c9a46a', dirt2: '#a8854f', lip: '#e2c98d',
  },
  desert: {
    tiles: ['#e7b673', '#dfa864', '#edc085', '#e3ae6b'], blot: ['#f3cf96', '#c98f50'], deco: 'pebble', tuft: ['#a07a46', '#8d9a52'], dirt: '#b8683a', dirt2: '#97522c', lip: '#d89c58',
  },
  antarctic: {
    tiles: ['#eef4f8', '#e4edf3', '#f6fafc', '#dde8f0'], blot: ['#ffffff', '#cfe0ec'], deco: 'snow', tuft: ['#b7cfe0', '#ffffff'], dirt: '#9fc4dc', dirt2: '#7ea9c6', lip: '#d6e8f3',
  },
};
// 시간대 빛(아침 · 낮 · 저녁 · 밤). sky = 하늘 위·가운데·지평선, tint = 땅·동물에 덧입히는 색과 세기,
// sun·moon = 화면 비율 위치(x, 지평선 대비 y), stars = 별 밝기, cloud = 구름 색과 투명도
const LIGHTS = [
  { sky: ['#a7c6e6', '#f4d4c6', '#ffd9a4'], hill: ['#c4c690', '#a9b578'], tree: '#7c8650', tint: ['#ff9a5a', 0.1], sun: { x: 0.18, y: 0.66, col: '#fff0c4' }, moon: null, stars: 0, cloud: ['#fff2ea', 0.75] },
  { sky: ['#8fcbe6', '#cfe9ee', '#f6e7bf'], hill: ['#b9c98a', '#9fb46e'], tree: '#6f8a4a', tint: ['#ffffff', 0], sun: { x: 0.78, y: 0.32, col: '#fff6d8' }, moon: null, stars: 0, cloud: ['#ffffff', 0.72] },
  { sky: ['#7470b2', '#e9a088', '#ffc477'], hill: ['#b19a72', '#93835c'], tree: '#5a553a', tint: ['#ff7a3c', 0.17], sun: { x: 0.62, y: 0.74, col: '#ffb25e' }, moon: null, stars: 0.15, cloud: ['#ffc8ae', 0.7] },
  { sky: ['#0d1634', '#1c2a56', '#33447a'], hill: ['#2c3b52', '#223148'], tree: '#1a2537', tint: ['#0f1a44', 0.48], sun: null, moon: { x: 0.3, y: 0.46, col: '#f3f0dc' }, stars: 1, cloud: ['#8b96c4', 0.22] },
];
const lerp = (a, b, k) => a + (b - a) * k;
function blendBody(a, b, k) {
  if (a && b) return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), col: mix(a.col, b.col, k), a: 1 };
  if (a) return { ...a, a: 1 - k };
  if (b) return { ...b, a: k };
  return null;
}
// 플레이 시간(초) → 그 순간의 빛. 1분짜리 시간대의 마지막 8초 동안 다음 시간대로 부드럽게 넘어간다
export function lightAt(time) {
  const t = Math.max(0, time) % 240, p = Math.floor(t / 60), f = t - p * 60;
  const k0 = f > 52 ? (f - 52) / 8 : 0, k = k0 * k0 * (3 - 2 * k0);
  const a = LIGHTS[p], b = LIGHTS[(p + 1) % 4];
  return {
    phase: p,
    sky: a.sky.map((c, i) => mix(c, b.sky[i], k)), hill: a.hill.map((c, i) => mix(c, b.hill[i], k)), tree: mix(a.tree, b.tree, k),
    tint: [mix(a.tint[0], b.tint[0], k), lerp(a.tint[1], b.tint[1], k)],
    sun: blendBody(a.sun, b.sun, k), moon: blendBody(a.moon, b.moon, k), stars: lerp(a.stars, b.stars, k),
    cloud: [mix(a.cloud[0], b.cloud[0], k), lerp(a.cloud[1], b.cloud[1], k)],
  };
}
// 하늘·해·달·별·먼 언덕·구름(화면 좌표, 매 프레임). L = lightAt() 결과
export function drawSky(ctx, W, H, horizon, t, L, region = 'grassland') {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, L.sky[0]); g.addColorStop(0.6, L.sky[1]); g.addColorStop(1, L.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 별: 자리는 고정, 조금씩 반짝인다
  if (L.stars > 0.01) {
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 7) * W, y = hash(i, 11) * horizon * 0.85, r = 0.5 + hash(i, 13) * 1.1;
      ctx.globalAlpha = L.stars * (0.45 + 0.55 * Math.abs(Math.sin(t * (0.6 + hash(i, 17)) + i)));
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // 해
  if (L.sun && L.sun.a > 0.01) {
    const sx = W * L.sun.x, sy = horizon * L.sun.y;
    ctx.globalAlpha = L.sun.a;
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 64);
    sg.addColorStop(0, rgba(L.sun.col, 0.95)); sg.addColorStop(0.3, rgba(L.sun.col, 0.45)); sg.addColorStop(1, rgba(L.sun.col, 0));
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 64, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.sun.col; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 달(초승달 모양: 밝은 원에 하늘색 원을 겹친다)
  if (L.moon && L.moon.a > 0.01) {
    const mx = W * L.moon.x, my = horizon * L.moon.y;
    ctx.globalAlpha = L.moon.a;
    const mg = ctx.createRadialGradient(mx, my, 6, mx, my, 50);
    mg.addColorStop(0, 'rgba(240,236,210,0.35)'); mg.addColorStop(1, 'rgba(240,236,210,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.moon.col; ctx.beginPath(); ctx.arc(mx, my, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.sky[0]; ctx.beginPath(); ctx.arc(mx + 6, my - 4, 11, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 구름
  for (let i = 0; i < 4; i++) {
    const cw = 70 + i * 18, x = ((i * 157 + t * (5 + i * 2)) % (W + cw * 2)) - cw, y = horizon * (0.16 + i * 0.13);
    ctx.fillStyle = rgba(L.cloud[0], L.cloud[1]);
    ctx.beginPath();
    ctx.ellipse(x, y, cw * 0.5, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(x - cw * 0.18, y - 6, cw * 0.22, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cw * 0.14, y - 8, cw * 0.26, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  (FAR[region] ?? FAR.grassland)(ctx, W, H, horizon, t, L);
}
// 지평선 너머 풍경(지역별). 시간대 빛은 lit()로 덧입힌다(초원은 시간대 색 L.hill을 그대로)
const lit = (L, col) => mix(col, L.tint[0], Math.min(0.75, L.tint[1] * 1.15));
function waveBand(ctx, W, y0, y1, t, col, hi) {
  ctx.fillStyle = col; ctx.fillRect(0, y0, W, y1 - y0);
  ctx.strokeStyle = hi; ctx.lineWidth = 1.2;
  for (let row = 0; row < 7; row++) {
    const y = y0 + 6 + row * ((y1 - y0) / 7), sp = 8 + row * 3, len = 8 + row * 3;
    for (let x = ((row * 37 + t * sp) % 60) - 60; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y - 2, x + len, y); ctx.stroke(); }
  }
}
const FAR = {
  grassland(ctx, W, H, horizon, t, L) {
    // 먼 언덕 두 겹과 아카시아 그림자
    for (let layer = 0; layer < 2; layer++) {
      const base = horizon + layer * 14, amp = 10 + layer * 6;
      ctx.fillStyle = L.hill[layer];
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let i = 0, n = Math.ceil(W / 8); i <= n; i++) { const x = (i / n) * W; ctx.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * 0.013 + layer * 2.1) * Math.sin(x * 0.005 + 1 + layer))); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = L.tree;
    for (let i = 0; i < 5; i++) {
      const x = (i * 0.23 + 0.07) * W, y = horizon + 6 + (i % 2) * 6, s = 0.7 + (i % 3) * 0.2;
      ctx.fillRect(x - 0.8 * s, y - 12 * s, 1.6 * s, 12 * s);
      ctx.beginPath(); ctx.ellipse(x, y - 13 * s, 11 * s, 3.2 * s, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 바닷가: 섬이 바다 위에 떠 있다. 먼 섬과 반짝이는 물결
  seaside(ctx, W, H, horizon, t, L) {
    const g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, lit(L, '#5fb2d4')); g.addColorStop(0.35, lit(L, '#4a9fc7')); g.addColorStop(1, lit(L, '#3a86b4'));
    ctx.fillStyle = g; ctx.fillRect(0, horizon, W, H - horizon);
    waveBand(ctx, W, horizon + 4, H, t, 'rgba(0,0,0,0)', rgba(lit(L, '#d9f1fa'), 0.55));
    ctx.fillStyle = lit(L, '#7aa86a'); // 먼 섬과 야자수
    ctx.beginPath(); ctx.ellipse(W * 0.16, horizon + 2, 46, 9, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = lit(L, '#5d8a4c'); ctx.fillRect(W * 0.16 + 4, horizon - 20, 2, 16);
    for (const a of [-2.6, -2.1, -1.2, -0.6]) { ctx.beginPath(); ctx.ellipse(W * 0.16 + 5 + Math.cos(a) * 7, horizon - 21 + Math.sin(a) * 3, 8, 2, a, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = lit(L, '#e8edf2'); ctx.beginPath(); ctx.moveTo(W * 0.82, horizon - 1); ctx.lineTo(W * 0.82 + 16, horizon - 1); ctx.lineTo(W * 0.82 + 8, horizon - 14); ctx.closePath(); ctx.fill(); // 먼 돛단배
    ctx.fillStyle = lit(L, '#c86a4a'); ctx.fillRect(W * 0.82 - 2, horizon - 1, 20, 3);
  },
  // 사막: 부드러운 모래언덕 두 겹과 먼 메사(탁상 바위)
  desert(ctx, W, H, horizon, t, L) {
    ctx.fillStyle = lit(L, '#c98a58');
    ctx.beginPath(); ctx.moveTo(W * 0.58, horizon + 4); ctx.lineTo(W * 0.62, horizon - 26); ctx.lineTo(W * 0.78, horizon - 28); ctx.lineTo(W * 0.82, horizon + 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W * 0.05, horizon + 4); ctx.lineTo(W * 0.08, horizon - 16); ctx.lineTo(W * 0.17, horizon - 17); ctx.lineTo(W * 0.2, horizon + 4); ctx.closePath(); ctx.fill();
    for (let layer = 0; layer < 2; layer++) {
      const base = horizon + layer * 16, amp = 12 + layer * 8;
      ctx.fillStyle = lit(L, layer ? '#dca462' : '#e8b97a');
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let i = 0, n = Math.ceil(W / 8); i <= n; i++) { const x = (i / n) * W; ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.009 + layer * 1.7))); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
  },
  // 남극: 먼 얼음산, 섬은 얼음 조각이 떠다니는 바다 위
  antarctic(ctx, W, H, horizon, t, L) {
    ctx.fillStyle = lit(L, '#dbe8f2');
    ctx.beginPath(); ctx.moveTo(0, horizon + 2);
    const peaks = [[0.04, 22], [0.12, 36], [0.2, 18], [0.3, 30], [0.42, 14], [0.56, 26], [0.68, 40], [0.8, 20], [0.9, 30], [1, 16]];
    for (const [fx, hgt] of peaks) ctx.lineTo(fx * W, horizon - hgt);
    ctx.lineTo(W, horizon + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lit(L, '#b8cfe0'); // 산의 그늘진 면
    for (let i = 1; i < peaks.length - 1; i += 2) { const [fx, hgt] = peaks[i]; ctx.beginPath(); ctx.moveTo(fx * W, horizon - hgt); ctx.lineTo(fx * W + 14, horizon + 2); ctx.lineTo(fx * W - 2, horizon + 2); ctx.closePath(); ctx.fill(); }
    const g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, lit(L, '#3f7fa8')); g.addColorStop(1, lit(L, '#2c6590'));
    ctx.fillStyle = g; ctx.fillRect(0, horizon + 2, W, H - horizon);
    waveBand(ctx, W, horizon + 6, H, t * 0.6, 'rgba(0,0,0,0)', rgba(lit(L, '#cfe6f2'), 0.4));
    ctx.fillStyle = lit(L, '#eef5fa'); // 떠다니는 얼음 조각
    for (let i = 0; i < 7; i++) { const x = ((hash(i, 3) * W + t * (2 + i)) % (W + 60)) - 30, y = horizon + 14 + hash(i, 5) * (H - horizon - 30), w = 10 + hash(i, 9) * 22; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.28, 0, 0, Math.PI * 2); ctx.fill(); }
  },
};
// 떠 있는 섬: 칸마다 색이 조금 다른 윗면 + 앞쪽 두 면의 흙 단면. G = 한 변 월드 길이
export const slabOf = (G) => G * 0.075; // 흙 단면 두께(땅 크기에 비례)
export function drawIsland(pen, G, n, pal, seed = 1) {
  const D = slabOf(G), T = G / n;
  // 흙 단면(+y면 → 화면 왼쪽 아래, +x면 → 오른쪽 아래)
  poly(pen, [[0, G, 0], [G, G, 0], [G, G, -D], [0, G, -D]], pal.dirt);
  poly(pen, [[G, 0, 0], [G, G, 0], [G, G, -D], [G, 0, -D]], pal.dirt2);
  for (let k = 1; k < 3; k++) {
    line(pen, [0, G, -D * k / 3], [G, G, -D * k / 3], shade(pal.dirt, 0.85), 0.8);
    line(pen, [G, 0, -D * k / 3], [G, G, -D * k / 3], shade(pal.dirt2, 0.85), 0.8);
  }
  // 아래로 처진 흙덩이
  const R = rng(seed + 0.17);
  const nd = Math.round(n * 0.9), dw = G / nd / 2.4;
  for (let i = 0; i < nd; i++) {
    const u = (i + 0.5) / nd * G, dz = D * (1.15 + R() * 0.4);
    poly(pen, [[u - dw, G, -D + 1], [u + dw, G, -D + 1], [u + dw * 0.25, G, -dz]], pal.dirt);
    poly(pen, [[G, u - dw, -D + 1], [G, u + dw, -D + 1], [G, u + dw * 0.25, -dz]], pal.dirt2);
  }
  // 윗면 칸
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const h = hash(x, y, seed), col = pal.tiles[Math.floor(h * pal.tiles.length)];
    poly(pen, [[x * T, y * T], [(x + 1) * T, y * T], [(x + 1) * T, (y + 1) * T], [x * T, (y + 1) * T]], col);
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = rng(hash(x, y, seed + 3) + 0.01);
    if (r() < 0.55) soft(pen, (x + 0.2 + r() * 0.6) * T, (y + 0.2 + r() * 0.6) * T, 10 + r() * 8, r() < 0.5 ? pal.blot[0] : pal.blot[1], 0.35);
    const k = 1 + Math.floor(r() * 3), px = () => (x + 0.15 + r() * 0.7) * T, py = () => (y + 0.15 + r() * 0.7) * T;
    if (pal.deco === 'tuft') { for (let i = 0; i < k; i++) tuft(pen, px(), py(), 4 + r() * 3, pal.tuft[i % 2], r); continue; }
    if (pal.deco === 'shell' || pal.deco === 'pebble') { // 바람에 생긴 모래결 + 조개껍데기·자갈
      if (r() < 0.6) { const cx = px(), cy = py(); line(pen, [cx - 5, cy - 2, 0.1], [cx + 5, cy + 2, 0.1], shade(pal.tiles[0], 0.9), 0.7); line(pen, [cx - 4, cy + 1, 0.1], [cx + 4, cy + 4, 0.1], shade(pal.tiles[0], 0.92), 0.6); }
      for (let i = 0; i < k - 1; i++) puff(pen, px(), py(), 0.6, 0.9 + r() * 0.6, pal.tuft[i % 2]);
      if (pal.deco === 'pebble' && r() < 0.18) tuft(pen, px(), py(), 3.5, '#8d9a52', r, 4); // 드문 마른 덤불
      if (pal.deco === 'shell' && r() < 0.12) tuft(pen, px(), py(), 5, '#9fae62', r, 3); // 드문 해안 풀
      continue;
    }
    // 눈: 반짝이는 점과 얼음 금
    for (let i = 0; i < k; i++) puff(pen, px(), py(), 0.4, 0.6 + r() * 0.5, '#ffffff');
    if (r() < 0.2) { const cx = px(), cy = py(); line(pen, [cx - 4, cy, 0.1], [cx + 1, cy + 3, 0.1], '#c4d8e6', 0.6); line(pen, [cx + 1, cy + 3, 0.1], [cx + 5, cy + 1, 0.1], '#c4d8e6', 0.6); }
  }
  // 가장자리 풀 테두리
  line(pen, [0, G, 0], [G, G, 0], pal.lip, 2.2);
  line(pen, [G, 0, 0], [G, G, 0], shade(pal.lip, 0.85), 2.2);
}
// 칸 테두리(꾸미기 모드)
export function drawGrid(pen, G, n) {
  const T = G / n;
  for (let i = 0; i <= n; i++) {
    line(pen, [i * T, 0, 0.2], [i * T, G, 0.2], 'rgba(255,255,255,0.28)', 0.6);
    line(pen, [0, i * T, 0.2], [G, i * T, 0.2], 'rgba(255,255,255,0.28)', 0.6);
  }
}
export function footprint(pen, x, y, w, h, fill, stroke) {
  const T = TILE, q = [[x * T, y * T, 0.4], [(x + w) * T, y * T, 0.4], [(x + w) * T, (y + h) * T, 0.4], [x * T, (y + h) * T, 0.4]];
  poly(pen, q, fill);
  const { ctx, P, zoom } = pen;
  ctx.strokeStyle = stroke; ctx.lineWidth = 1.5 * zoom; trace(ctx, q.map((p) => P(p[0], p[1], p[2]))); ctx.stroke();
}

// ---------- 물건 ----------
// 바닥에 깔리는 물건(동물보다 먼저 그린다)
export const FLOOR = new Set(['grass', 'puddle', 'pond']);
// 스프라이트 크기: [반지름, 높이] (월드 단위)
export const ITEM_BOX = {
  grass: [24, 8], hutch: [22, 22], burrow: [20, 14], fence: [22, 16], puddle: [46, 10], feeder: [22, 16],
  rocks: [44, 24], trough: [22, 14], tallgrass: [22, 26], hay: [20, 20], acacia: [34, 48], awning: [24, 26],
  pond: [68, 14], saltlick: [14, 18], baobab: [40, 60], tower: [24, 62],
};
const WATER = '#5aa6c9', WATER_HI = '#a6dbe9', WOOD = '#a8743f';
// 지역 물건 모듈(items/<지역>.js)에 넘기는 도형 도구
const KIT = { poly, line, box, cyl, disc, soft, splat, puff, shadow, lump, tuft, onY, rng, hash, shade, mix, rgba };
export function drawItem(pen, id, seed = 1) {
  const R = rng(seed + 0.31);
  const f = ITEM_ART[id];
  if (f) f(pen, R, KIT);
}
const ITEM_ART = {
  grass(pen, R) {
    splat(pen, 0, 0, 15, '#86b04a', R, 12);
    splat(pen, 0, 0, 11, '#97bd52', R, 10);
    for (let i = 0; i < 16; i++) tuft(pen, (R() - 0.5) * 24, (R() - 0.5) * 24, 5 + R() * 4, i % 2 ? '#5f9a35' : '#78ad3e', R, 3);
    for (let i = 0; i < 3; i++) puff(pen, (R() - 0.5) * 18, (R() - 0.5) * 18, 2, 1.2, i % 2 ? '#f3e27a' : '#ffffff');
  },
  tallgrass(pen, R) {
    shadow(pen, 0, 0, 14, 0.18);
    const cols = ['#b2ad4c', '#9aa645', '#c7b75a', '#86983c'];
    for (let i = 0; i < 9; i++) {
      const x = (R() - 0.5) * 22, y = (R() - 0.5) * 22, h = 15 + R() * 9;
      for (let k = 0; k < 6; k++) line(pen, [x + (R() - 0.5) * 3, y + (R() - 0.5) * 3, 0], [x + (R() - 0.5) * 8, y + (R() - 0.5) * 5, h * (0.7 + R() * 0.4)], cols[(i + k) % 4], 1.1);
      puff(pen, x, y, h + 1, 1.3, '#d8c46a');
    }
  },
  hutch(pen) {
    shadow(pen, 0, 0, 16);
    box(pen, -11, -9, 22, 18, 12, '#b98249');
    onY(pen, 9.05, -4.5, 4.5, 0.5, 8.5, '#3a2617');
    onY(pen, 9.1, -3.4, 3.4, 0.5, 7.4, '#22160c');
    // 박공지붕(앞뒤 경사면)
    poly(pen, [[-13, -11, 12], [13, -11, 12], [13, 0, 19], [-13, 0, 19]], '#8a5a30');
    poly(pen, [[-13, 0, 19], [13, 0, 19], [13, 11, 12], [-13, 11, 12]], '#a86c38');
    poly(pen, [[13, -11, 12], [13, 11, 12], [13, 0, 19]], '#6e4626');
    for (let i = 0; i < 3; i++) line(pen, [-6 + i * 5, 10, 0.5], [-4 + i * 5, 12, 0.5], '#e2c56a', 0.9);
  },
  burrow(pen, R) {
    shadow(pen, 0, 0, 14);
    lump(pen, 0, -1, 13, 9, '#b07f4c', R, { top: 0.55 });
    const { ctx, P, zoom } = pen, [hx, hy] = P(4, 8, 3.2);
    ctx.fillStyle = '#5a3b20'; ctx.beginPath(); ctx.ellipse(hx, hy, 5 * zoom, 3.6 * zoom, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#24170c'; ctx.beginPath(); ctx.ellipse(hx, hy + 0.4 * zoom, 3.8 * zoom, 2.6 * zoom, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) puff(pen, 4 + (R() - 0.5) * 14, 11 + R() * 4, 0.6, 1.1, '#9a6c40');
  },
  fence(pen) {
    shadow(pen, 0, 0, 14, 0.16);
    for (const x of [-13, -1, 11]) box(pen, x, -1.2, 2.4, 2.4, 14, '#9a6a3c');
    for (const z of [5, 10]) box(pen, -13, -0.6, 26, 1.2, 1.8, '#b07b45', z);
  },
  puddle(pen, R) {
    splat(pen, 0, 0, 30, '#8f6c43', R, 14);
    splat(pen, 0, 0, 26, '#6e5233', R, 14);
    splat(pen, 0, 0, 23, WATER, R, 14);
    soft(pen, -6, -5, 14, WATER_HI, 0.55);
    for (let i = 0; i < 4; i++) tuft(pen, -20 + R() * 10, -18 + R() * 8, 9, '#6b9a3c', R, 4);
  },
  pond(pen, R) {
    splat(pen, 0, 0, 46, '#8c7a5a', R, 18);
    splat(pen, 0, 0, 42, '#4f8fb2', R, 18);
    splat(pen, 0, 0, 36, WATER, R, 18);
    soft(pen, -10, -9, 22, WATER_HI, 0.5);
    for (let i = 0; i < 4; i++) { const a = R() * Math.PI * 2, r = 12 + R() * 16; disc(pen, Math.cos(a) * r, Math.sin(a) * r, 3.2, '#6faa48', 0.3); }
    for (let i = 0; i < 10; i++) { const a = -Math.PI * 0.95 + R() * Math.PI * 0.7, r = 40 + R() * 4; lump(pen, Math.cos(a) * r, Math.sin(a) * r, 3.5, 3, '#a59b8c', R, { n: 6 }); }
    for (let i = 0; i < 3; i++) tuft(pen, -34 + R() * 8, -6 + R() * 12, 14, '#5f8f38', R, 6);
  },
  feeder(pen) {
    shadow(pen, 0, 0, 16);
    for (const [x, y] of [[-11, -6], [9, -6], [-11, 4.5], [9, 4.5]]) box(pen, x, y, 2, 2, 5, '#7c5230');
    box(pen, -12.5, -7.5, 25, 15, 6, WOOD, 5);
    poly(pen, [[-11, -6, 10.4], [11, -6, 10.4], [11, 6, 10.4], [-11, 6, 10.4]], '#6c9a38');
    for (let i = 0; i < 7; i++) line(pen, [-9 + i * 3, -3, 10.5], [-7 + i * 3, 2, 13], i % 2 ? '#e2c56a' : '#8fbc4c', 1);
  },
  rocks(pen, R) {
    shadow(pen, 0, 0, 34, 0.22);
    lump(pen, -6, -6, 17, 18, '#a69a86', R);
    lump(pen, 12, 8, 11, 11, '#b3a690', R);
    lump(pen, -16, 13, 7, 6, '#9c907c', R);
    tuft(pen, 4, 20, 7, '#8fa548', R, 4);
  },
  trough(pen) {
    shadow(pen, 0, 0, 16);
    box(pen, -13, -7, 26, 14, 8, '#9a978c');
    poly(pen, [[-11, -5, 7.6], [11, -5, 7.6], [11, 5, 7.6], [-11, 5, 7.6]], WATER);
    poly(pen, [[-11, -5, 7.7], [-2, -5, 7.7], [-6, 5, 7.7], [-11, 5, 7.7]], 'rgba(255,255,255,0.25)');
  },
  hay(pen, R) {
    shadow(pen, 0, 0, 14);
    cyl(pen, 0, 0, 11, 12, '#d6af54', 0, '#e8c86e');
    const { ctx, P, zoom } = pen, [tx, ty] = P(0, 0, 12);
    ctx.strokeStyle = '#b48c3a'; ctx.lineWidth = 0.8 * zoom;
    for (let r = 3; r <= 9; r += 3) { ctx.beginPath(); ctx.ellipse(tx, ty, r * zoom, r * 0.5 * zoom, 0, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 8; i++) line(pen, [(R() - 0.5) * 24, (R() - 0.5) * 24, 0], [(R() - 0.5) * 26, (R() - 0.5) * 26, 0.3], '#e2c56a', 0.9);
  },
  acacia(pen, R) {
    shadow(pen, 4, 4, 22, 0.24);
    const trunk = '#6b4a2e';
    line(pen, [0, 0, 0], [1, 1, 22], trunk, 3.6);
    line(pen, [1, 1, 20], [-10, -4, 32], trunk, 2);
    line(pen, [1, 1, 20], [10, 6, 31], trunk, 2);
    line(pen, [1, 1, 22], [2, -8, 33], trunk, 1.6);
    disc(pen, 0, 0, 30, '#4e7a2e', 31);
    disc(pen, -2, -2, 27, '#5f8d36', 34);
    disc(pen, -4, -4, 21, '#74a543', 36.5);
    for (let i = 0; i < 8; i++) { const a = R() * Math.PI * 2, r = 8 + R() * 16; disc(pen, Math.cos(a) * r - 3, Math.sin(a) * r - 3, 4 + R() * 3, R() < 0.5 ? '#86b84d' : '#5f8d36', 37); }
  },
  awning(pen) {
    shadow(pen, 0, 0, 18, 0.2);
    for (const [x, y] of [[-12, -12], [11, -12], [-12, 11], [11, 11]]) box(pen, x, y, 1.6, 1.6, 18 + (y < 0 ? 3 : 0), '#7c5230');
    const top = (x0, x1, col) => poly(pen, [[x0, -13, 21.5], [x1, -13, 21.5], [x1, 13, 18], [x0, 13, 18]], col);
    for (let i = 0; i < 6; i++) top(-14 + i * (28 / 6), -14 + (i + 1) * (28 / 6), i % 2 ? '#f6ecd6' : '#e08a3c');
    for (let i = 0; i < 6; i++) poly(pen, [[-14 + i * (28 / 6), 13, 18], [-14 + (i + 1) * (28 / 6), 13, 18], [-14 + (i + 0.5) * (28 / 6), 13, 15]], i % 2 ? '#e8dcc0' : '#c8742f');
  },
  saltlick(pen) {
    shadow(pen, 0, 0, 9);
    box(pen, -2, -2, 4, 4, 9, '#8a6a42');
    box(pen, -6, -5, 12, 10, 7, ['#f2e4dc', '#d9c4b8', '#bfa89a'], 9);
    poly(pen, [[-4, -3, 16.1], [1, -3, 16.1], [-1, 2, 16.1], [-4, 2, 16.1]], 'rgba(255,255,255,0.4)');
  },
  baobab(pen, R) {
    shadow(pen, 4, 4, 30, 0.26);
    const bark = '#a48268';
    cyl(pen, 0, 0, 14, 30, bark, 0, '#8e6e56');
    cyl(pen, 0, 0, 10, 8, bark, 30, '#8e6e56');
    for (const [dx, dy, h] of [[-14, -6, 52], [12, -10, 54], [-4, 14, 50], [14, 10, 49], [-12, 10, 51]]) {
      line(pen, [0, 0, 36], [dx, dy, h], '#8c6a52', 2.4);
      puff(pen, dx, dy, h + 3, 6 + R() * 2, '#6f9a3c');
      puff(pen, dx - 2, dy - 2, h + 5, 4, '#86b04a');
    }
  },
  tower(pen) {
    shadow(pen, 0, 0, 18, 0.24);
    const legs = [[-11, -11], [9, -11], [-11, 9], [9, 9]];
    for (const [x, y] of legs) box(pen, x, y, 2.2, 2.2, 32, '#8a5f36');
    line(pen, [-10, 10, 2], [10, 10, 30], '#7a5230', 1.2);
    line(pen, [10, -10, 2], [10, 10, 30], '#6a4628', 1.2);
    box(pen, -13, -13, 26, 26, 2.5, '#b07b45', 32);
    for (const z of [38]) { box(pen, -13, 12, 26, 1, 1.4, '#9a6a3c', z); box(pen, 12, -13, 1, 26, 1.4, '#86592f', z); }
    for (const [x, y] of legs) box(pen, x, y, 1.6, 1.6, 12, '#8a5f36', 34);
    poly(pen, [[-15, -15, 46], [15, -15, 46], [0, 0, 58]], '#b8903f');
    poly(pen, [[-15, 15, 46], [15, 15, 46], [0, 0, 58]], '#d4ab55');
    poly(pen, [[15, -15, 46], [15, 15, 46], [0, 0, 58]], '#a07a35');
    // 깃발
    line(pen, [0, 0, 58], [0, 0, 66], '#5a3b20', 0.9);
    poly(pen, [[0, 0, 66], [0, 0, 62], [6, -6, 64]], '#e0533f');
  },
};

for (const M of [I_SEASIDE, I_DESERT, I_ANTARCTIC]) { // 다른 지역 물건 그림 합치기
  Object.assign(ITEM_ART, M.ITEM_ART); Object.assign(ITEM_BOX, M.ITEM_BOX);
  for (const id of M.FLOOR) FLOOR.add(id);
}

// ---------- 동물(옆모습) ----------
// pose = { face, st, ph(초), hd(고개 숙임 0~1), ly(눕기 0~1), sp(특수 행동 진행 0~1, 아니면 -1), seed, sil(실루엣 색) }
// 원점은 몸통 아래 땅. 단위는 화면 px ÷ k.
const TAU = Math.PI * 2;
let C = (c) => c; // 실루엣 그리기에서 색을 바꾼다
// 그림자(rgba)는 실루엣에서도 반투명 그대로 둔다
function ell(ctx, x, y, rx, ry, rot, col) { ctx.fillStyle = col.startsWith('rgba') ? col : C(col); ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); ctx.fill(); }
function seg(ctx, ax, ay, bx, by, w, col) { ctx.strokeStyle = C(col); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
function curve(ctx, ax, ay, cx, cy, bx, by, w, col) { ctx.strokeStyle = C(col); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by); ctx.stroke(); }
function eye(ctx, x, y, r, closed) {
  if (closed) { seg(ctx, x - r, y, x + r, y, r * 0.55, '#2a1d14'); return; }
  ell(ctx, x, y, r, r, 0, '#1e1712');
  if (C('#fff') === '#fff') ell(ctx, x + r * 0.3, y - r * 0.35, r * 0.38, r * 0.38, 0, '#ffffff');
}
// 굵기가 줄어드는 목·코(두 점 사이 사다리꼴 + 끝 동그라미)
function taper(ctx, ax, ay, bx, by, w0, w1, col) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.fillStyle = C(col); ctx.beginPath();
  ctx.moveTo(ax + nx * w0 / 2, ay + ny * w0 / 2); ctx.lineTo(bx + nx * w1 / 2, by + ny * w1 / 2);
  ctx.lineTo(bx - nx * w1 / 2, by - ny * w1 / 2); ctx.lineTo(ax - nx * w0 / 2, ay - ny * w0 / 2); ctx.closePath(); ctx.fill();
  ell(ctx, ax, ay, w0 / 2, w0 / 2, 0, col); ell(ctx, bx, by, w1 / 2, w1 / 2, 0, col);
}
// 네 다리: 가까운 다리 둘(near)·먼 다리 둘(far). 걸을 때 대각선 쌍이 함께 움직인다
function legs4(ctx, o, near) {
  const { hipB, hipF, hipYB, hipYF, L, w, col, ph, mv, ly, stiff } = o;
  const far = !near, c = far ? shade(col, 0.72) : col, foot = o.hoof ? (far ? shade(o.hoof, 0.75) : o.hoof) : null;
  const list = near ? [[hipB, hipYB, 0], [hipF, hipYF, Math.PI]] : [[hipB + 1.2, hipYB, Math.PI], [hipF + 1.2, hipYF, 0]];
  for (const [hx, hy0, off] of list) {
    const hy = hy0 * (1 - ly * 0.8), len = -hy; // 누우면 엉덩이가 내려온다
    if (ly > 0.5) { // 접은 다리
      ell(ctx, hx + 2, -w * 0.6, w * 1.3, w * 0.7, 0, c);
      continue;
    }
    const a = stiff ? 0 : mv * Math.sin(ph + off) * 0.42;
    const kx = hx + Math.sin(a) * len * 0.5, ky = hy + len * 0.5;
    const bend = mv * Math.max(0, Math.sin(ph + off + 1.2)) * 2.2;
    const fx = hx + Math.sin(a) * len, fy = Math.min(0, hy + len) - bend * 0.8;
    seg(ctx, hx, hy, kx - bend * 0.4, ky, w, c);
    seg(ctx, kx - bend * 0.4, ky, fx, fy, w * 0.85, c);
    if (foot) seg(ctx, fx, fy - 0.6, fx + 0.6, fy, w * 0.95, foot);
  }
}

// ---------- 리그(관절 계산·발 고정 걸음·몸짓) — 2026-10-25 얼룩말부터 적용 ----------
// 2-bone IK: 뿌리(rx,ry)에서 목표(tx,ty)까지 길이 a·b 두 뼈. bend +1이면 관절이 앞(+x)으로 굽는다
function ik(rx, ry, tx, ty, a, b, bend) {
  const dx = tx - rx, dy = ty - ry, d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx), A2 = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const k1 = [rx + a * Math.cos(base + A2), ry + a * Math.sin(base + A2)], k2 = [rx + a * Math.cos(base - A2), ry + a * Math.sin(base - A2)];
  return { knee: (k1[0] - k2[0]) * bend > 0 ? k1 : k2, end: [rx + Math.cos(base) * d, ry + Math.sin(base) * d] };
}
const smooth = (t) => t * t * (3 - 2 * t);
// 발 하나의 걸음 주기(u 0~1): 디딤(stance, 비율 duty) 동안은 몸이 움직인 만큼만 뒤로 가서 땅에 붙어 있고, 나머지(swing)는 호를 그리며 앞으로.
// stroke = 보폭 × duty(디딤 동안 발이 뒤로 가는 거리). sw = 들림 정도(0~1), st = 디딤 진행(0~1)
function footAt(u, stroke, lift, duty = 0.64) {
  if (u < duty) { const t = u / duty; return { x: stroke * (0.5 - t), y: 0, sw: 0, st: t }; }
  const t = (u - duty) / (1 - duty);
  return { x: stroke * (-0.5 + smooth(t)), y: -lift * Math.sin(Math.PI * t), sw: Math.sin(Math.PI * t), st: 1 };
}
// 스프링: 목표를 늦게, 출렁이며 따라간다(꼬리·귀·머리)
const springTo = (s, target, k, c, dt) => { s.v += (k * (target - s.x) - c * s.v) * dt; s.x += s.v * dt; };
// 몸짓 상태(동물마다 하나, 화면 쪽이 들고 있다): 깜빡임·귀 털기·꼬리 휘두르기·두리번
function rigTick(r, dt) {
  if (!r.tail) Object.assign(r, { tail: { x: 0.3, v: 0 }, ear: { x: 0, v: 0 }, head: { x: 0, v: 0 }, blink: 0, nextBlink: 1 + Math.random() * 4, nextFlick: 1 + Math.random() * 5, nextSwish: 1 + Math.random() * 4, swish: 0, look: Math.random() * 20 });
  r.blink -= dt; r.nextBlink -= dt; r.nextFlick -= dt; r.nextSwish -= dt; r.look += dt;
  if (r.nextBlink <= 0) { r.blink = 0.13; r.nextBlink = 2 + Math.random() * 4; }
  if (r.nextFlick <= 0) { r.ear.v -= 14; r.nextFlick = 2.5 + Math.random() * 4; }
  if (r.nextSwish <= 0) { r.swish = 0.9; r.nextSwish = 2 + Math.random() * 3.5; }
  r.swish *= Math.exp(-dt * 4);
  springTo(r.ear, 0, 120, 10, dt);
}
// 세 마디 다리(굵기가 줄고 관절이 둥글다) + 마디마다 가로 줄무늬 + 발굽
function limb(g, pts, w0, w1, col, stripe, hoofCol) {
  const ws = [w0, w0 * 0.78, w1 * 1.05, w1];
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.fillStyle = C(col); g.beginPath();
    g.moveTo(ax + nx * ws[i] / 2, ay + ny * ws[i] / 2); g.lineTo(bx + nx * ws[i + 1] / 2, by + ny * ws[i + 1] / 2);
    g.lineTo(bx - nx * ws[i + 1] / 2, by - ny * ws[i + 1] / 2); g.lineTo(ax - nx * ws[i] / 2, ay - ny * ws[i] / 2); g.closePath(); g.fill();
    g.beginPath(); g.arc(bx, by, ws[i + 1] / 2, 0, TAU); g.fill();
    if (stripe && C('#000') === '#000') {
      g.strokeStyle = stripe; g.lineWidth = 0.9; g.lineCap = 'round';
      const n = i === 0 ? 2 : 3;
      for (let k = 1; k <= n; k++) { const t = k / (n + 1), cx = ax + dx * t, cy = ay + dy * t, w = (ws[i] + (ws[i + 1] - ws[i]) * t) / 2; g.beginPath(); g.moveTo(cx + nx * w, cy + ny * w); g.lineTo(cx - nx * w, cy - ny * w); g.stroke(); }
    }
  }
  const [hx, hy] = pts[3];
  g.fillStyle = C(hoofCol); g.beginPath(); g.moveTo(hx - w1 * 0.55, hy - 1.6); g.lineTo(hx + w1 * 0.6, hy - 1.6); g.lineTo(hx + w1 * 0.85, hy); g.lineTo(hx - w1 * 0.65, hy); g.closePath(); g.fill();
}
const ANIMAL_ART = {
  rabbit(ctx, p) {
    const col = '#c9a27e', belly = '#efe2cc', ear = '#e8a9a4';
    let up = 0, rot = 0;
    if (p.mv) up = Math.abs(Math.sin(p.ph * TAU * 1.6)) * 4;
    if (p.sp >= 0) { const f = (p.sp * 2) % 1; up = Math.sin(f * Math.PI) * 12; rot = Math.sin(f * TAU) * 0.35; }
    ell(ctx, 0, 0, 7 - up * 0.2, 2.2, 0, 'rgba(40,25,10,0.25)');
    ctx.save(); ctx.translate(0, -up); ctx.rotate(rot);
    const hd = p.hd, ly = p.ly;
    ell(ctx, -2.5, -4.6 + ly, 5.2, 4.4, 0, shade(col, 0.92));
    ell(ctx, 0, -5.6 + ly, 7, 4.8, 0, col);
    ell(ctx, 1, -3.8 + ly, 4.5, 2.4, 0, belly);
    ell(ctx, -7, -6.2 + ly, 2.3, 2.3, 0, '#ffffff');
    if (ly < 0.5) { ell(ctx, 4.6, -1.2, 1.6, 1.2, 0, belly); ell(ctx, -3, -0.9, 3, 1.3, 0, shade(col, 0.85)); }
    const hx = 6 + hd * 1.5, hy = -10 + hd * 5 + ly;
    const earA = -0.35 + Math.sin(p.ph * 1.3) * 0.06 - (p.sp >= 0 ? 0.3 : 0);
    for (const [dx, k] of [[-1.2, 0.8], [0.6, 1]]) {
      ctx.save(); ctx.translate(hx + dx, hy - 2.5); ctx.rotate(earA - hd * 0.5);
      ell(ctx, 0, -4.6, 1.5, 5, 0, k < 1 ? shade(col, 0.85) : col);
      if (k === 1) ell(ctx, 0.2, -4.4, 0.7, 3.6, 0, ear);
      ctx.restore();
    }
    ell(ctx, hx, hy, 3.9, 3.5, 0, col);
    ell(ctx, hx + 2.4, hy + 1.2, 1.8, 1.4, 0, belly);
    eye(ctx, hx + 1.4, hy - 0.8, 0.9, p.st === 'rest');
    ell(ctx, hx + 3.7, hy + 0.5, 0.7, 0.55, 0, '#d9827c');
    ctx.restore();
  },
  meerkat(ctx, p) {
    const col = '#cdb084', dark = '#5a4632', belly = '#e8d6b0';
    ell(ctx, 0, 0, 6.5, 1.9, 0, 'rgba(40,25,10,0.25)');
    if (p.sp >= 0) { // 두 발로 서서 두리번거린다
      const look = Math.sin(p.sp * TAU * 2) > 0 ? 1 : -1;
      curve(ctx, -1, -3, -6, -2, -8.5, 0, 1.6, dark);
      seg(ctx, -0.8, -3, -1, 0, 1.6, shade(col, 0.8)); seg(ctx, 1.2, -3, 1.4, 0, 1.6, col);
      ell(ctx, 0, -9.5, 3.1, 6.8, 0, col);
      ell(ctx, 0.7, -9, 1.7, 5.2, 0, belly);
      seg(ctx, 1.6, -12, 2.6, -11, 1.1, shade(col, 0.85)); seg(ctx, 1.8, -12.4, 3, -11.6, 1.1, col);
      ctx.save(); ctx.translate(0.4, -17.6); ctx.scale(look, 1);
      ell(ctx, 0, 0, 2.6, 2.3, 0, col);
      ell(ctx, 2.3, 0.6, 1.6, 1.1, 0, col);
      ell(ctx, 0.9, -0.3, 1.1, 0.8, 0, dark);
      eye(ctx, 1, -0.4, 0.55);
      ell(ctx, 3.8, 0.6, 0.5, 0.45, 0, '#2a1d14');
      ell(ctx, -1.6, -1.6, 0.8, 0.8, 0, dark);
      ctx.restore();
      return;
    }
    const ly = p.ly, mv = p.mv, ph = p.ph * TAU * 2.2;
    curve(ctx, -6, -4 + ly, -11, -4 + ly, -13, -1, 1.5, col);
    seg(ctx, -12, -1.6, -13.3, -0.6, 1.5, dark);
    legs4(ctx, { hipB: -3.5, hipF: 3.5, hipYB: -3.2, hipYF: -3.2, L: 3.2, w: 1.5, col, ph, mv, ly }, false);
    ell(ctx, 0, -5 + ly * 2, 6.5, 3.1, -0.05, col);
    for (let i = 0; i < 4; i++) seg(ctx, -4 + i * 2.4, -7.6 + ly * 2, -4.6 + i * 2.4, -5.6 + ly * 2, 0.7, shade(col, 0.82));
    legs4(ctx, { hipB: -3.5, hipF: 3.5, hipYB: -3.2, hipYF: -3.2, L: 3.2, w: 1.5, col, ph, mv, ly }, true);
    const hx = 6.2 + p.hd, hy = -7 + p.hd * 4 + ly * 2;
    ell(ctx, hx, hy, 2.6, 2.2, 0, col);
    ell(ctx, hx + 2.4, hy + 0.7, 1.7, 1.1, 0.1, col);
    ell(ctx, hx + 1, hy - 0.3, 1.1, 0.8, 0, dark);
    eye(ctx, hx + 1.1, hy - 0.4, 0.55, p.st === 'rest');
    ell(ctx, hx + 4, hy + 0.7, 0.5, 0.45, 0, '#2a1d14');
    ell(ctx, hx - 1.4, hy - 1.6, 0.8, 0.8, 0, dark);
  },
  gazelle(ctx, p) {
    const col = '#c98c4e', belly = '#f6efe2', dark = '#4a3020';
    let up = 0;
    const stot = p.sp >= 0;
    if (stot) { const f = (p.sp * 3) % 1; up = Math.sin(f * Math.PI) * 10; }
    ell(ctx, 0, 0, 11 - up * 0.3, 2.6, 0, 'rgba(40,25,10,0.25)');
    ctx.save(); ctx.translate(0, -up);
    const ly = p.ly, mv = stot ? 0 : p.mv, ph = p.ph * TAU * 1.8;
    const o = { hipB: -8, hipF: 8, hipYB: -15, hipYF: -15, L: 15, w: 1.7, col, hoof: '#3a2a1c', ph, mv, ly, stiff: stot };
    seg(ctx, -11, -21 + ly * 11, -12.4, -17.5 + ly * 11, 1.6, dark);
    legs4(ctx, o, false);
    ell(ctx, 0, -19 + ly * 11, 11, 5.6, 0, col);
    ell(ctx, 0.5, -16.4 + ly * 11, 9, 2.7, 0, belly);
    ell(ctx, 0, -17.9 + ly * 11, 9.6, 0.9, 0, dark);
    ell(ctx, -10, -19 + ly * 11, 2.6, 3.4, 0, belly);
    legs4(ctx, o, true);
    const nb = [8, -22 + ly * 11], na = 0.45 + p.hd * 2.0, nl = 9 + p.hd * 8; // 먹을 때는 목을 땅까지 뻗는다
    const tip = [nb[0] + Math.sin(na) * nl, nb[1] - Math.cos(na) * nl];
    taper(ctx, nb[0], nb[1], tip[0], tip[1], 4, 2.8, col);
    ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(na * 0.6 + 0.25);
    curve(ctx, -1, -2, -3, -8, -6, -10, 1, '#3a2a1c'); curve(ctx, 0, -2, -1.6, -8.5, -4.4, -11, 1, '#2a1d14');
    ell(ctx, -1.4, -2.2, 1, 2.2, -0.7, col);
    ell(ctx, 1.6, 0.4, 3.6, 2.1, 0.25, col);
    ell(ctx, 2.6, 0.9, 2.4, 0.8, 0.25, belly);
    eye(ctx, 1.1, -0.4, 0.6, p.st === 'rest');
    ell(ctx, 4.8, 1.3, 0.5, 0.45, 0, '#2a1d14');
    ctx.restore();
    ctx.restore();
  },
  ostrich(ctx, p) {
    const col = '#2f2823', plume = '#f4f0e6', leg = '#d9a79a';
    const dance = p.sp >= 0, ly = p.ly, mv = p.mv;
    const ph = p.ph * TAU * 1.5 + (dance ? p.sp * 20 : 0);
    ell(ctx, 0, 0, 11, 2.8, 0, 'rgba(40,25,10,0.25)');
    const sway = dance ? Math.sin(p.sp * TAU * 4) * 2 : 0, crouch = dance ? 4 : 0;
    const by = -31 + ly * 21 + crouch;
    for (const [side, off] of [[0, 0], [1, Math.PI]]) {
      const a = (mv || dance ? Math.sin(ph + off) * 0.45 : 0), c = side ? leg : shade(leg, 0.78);
      if (ly > 0.5) { ell(ctx, 3 - side * 4, -2, 4, 1.5, 0, c); continue; }
      const hx = side * 2 - 1, hy = by + 5, kx = hx + 3 + Math.sin(a) * 4, ky = hy + 11, fx = hx + Math.sin(a) * 9, fy = 0 - Math.max(0, Math.sin(ph + off + 1)) * (mv ? 2.5 : 0);
      seg(ctx, hx, hy, kx, ky, side ? 3.2 : 2.8, c); seg(ctx, kx, ky, fx, fy, 1.8, c); seg(ctx, fx, fy, fx + 3, fy, 1.6, c);
    }
    ctx.save(); ctx.translate(sway, 0);
    if (dance) for (const s of [-1, 1]) { ctx.save(); ctx.translate(-1, by - 2); ctx.rotate(s * 0.9 - 0.4 + Math.sin(p.sp * TAU * 4) * 0.25 * s); ell(ctx, -6, -3, 9, 4.2, 0, s > 0 ? plume : shade(plume, 0.85)); ctx.restore(); }
    ell(ctx, -11, by - 1, 4.6, 4, 0, plume);
    ell(ctx, 0, by, 12, 8.4, -0.08, col);
    if (!dance) { ell(ctx, -2, by - 0.5, 8, 4.4, -0.15, '#4a403a'); ell(ctx, -8.5, by + 1, 3, 2.2, -0.2, plume); }
    const nb = [8, by - 4], na = 0.15 + p.hd * 2.4, nl = 20;
    const tip = [nb[0] + Math.sin(na) * nl, nb[1] - Math.cos(na) * nl];
    curve(ctx, nb[0], nb[1], nb[0] + 4 + Math.sin(na) * 2, nb[1] - 9, tip[0], tip[1], 2.6, '#c9a49a');
    ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(na * 0.4 + (dance ? Math.sin(p.sp * TAU * 4) * 0.3 : 0));
    ell(ctx, 0, 0, 2.8, 2.2, 0, '#c9a49a');
    ctx.fillStyle = C('#e2b07a'); ctx.beginPath(); ctx.moveTo(1.8, -0.6); ctx.lineTo(5.6, 0.4); ctx.lineTo(1.8, 1.2); ctx.closePath(); ctx.fill();
    eye(ctx, 0.6, -0.5, 0.9, p.st === 'rest');
    ctx.restore();
    ctx.restore();
  },
  lion(ctx, p) {
    const col = '#d8a65a', mane = '#94562a', belly = '#ecc98a';
    const roar = p.sp >= 0, ly = p.ly, mv = p.mv, ph = p.ph * TAU * 1.5;
    ell(ctx, 0, 0, 14, 3, 0, 'rgba(40,25,10,0.25)');
    const dy = ly * 9;
    const o = { hipB: -10, hipF: 10, hipYB: -12, hipYF: -12, L: 12, w: 4, col, hoof: shade(col, 0.88), ph, mv, ly };
    const tw = Math.sin(p.ph * 2) * 2;
    curve(ctx, -13, -19 + dy, -21, -20 + dy + tw, -22, -9 + dy, 1.6, col);
    ell(ctx, -22, -8.5 + dy, 1.6, 2.2, 0, mane);
    legs4(ctx, o, false);
    ell(ctx, 0, -17.5 + dy, 14, 7.4, 0, col);
    ell(ctx, 1, -14.2 + dy, 11, 3, 0, belly);
    legs4(ctx, o, true);
    if (ly > 0.5) { ell(ctx, 14, -2, 5, 2, 0, col); ell(ctx, 17.5, -1.6, 2.2, 1.6, 0, belly); }
    const hx = 13 + p.hd * 2, hy = -23 + p.hd * 9 + dy * 0.8;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(roar ? -0.45 * Math.sin(Math.min(1, p.sp * 1.6) * Math.PI) : 0);
    ctx.fillStyle = C(mane); ctx.beginPath();
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, r = i % 2 ? 7.4 : 9.2; ctx.lineTo(Math.cos(a) * r - 1, Math.sin(a) * r + 0.5); }
    ctx.closePath(); ctx.fill();
    ell(ctx, -1, 0.5, 7.2, 7.2, 0, shade(mane, 1.15));
    ell(ctx, -3.6, -5.2, 1.7, 1.7, 0, col);
    ell(ctx, 1.2, 0.4, 4.8, 4.4, 0, col);
    ell(ctx, 4.2, 2.2, 2.6, 2, 0, belly);
    const open = roar ? Math.sin(Math.min(1, p.sp * 1.6) * Math.PI) : 0;
    if (open > 0.05) ell(ctx, 4.4, 3.8, 2.1, 1.8 * open + 0.3, 0, '#7a2a22');
    ell(ctx, 5.8, 0.9, 1, 0.8, 0, '#4a2a1c');
    eye(ctx, 2.2, -0.9, 0.8, p.st === 'rest' || open > 0.5);
    ctx.restore();
    if (roar && p.sp > 0.15 && p.sp < 0.7) {
      ctx.globalAlpha *= 0.7;
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = C('#ffffff'); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hx + 6, hy - 2, 5 + k * 3.5 + (p.sp * 30) % 3.5, -0.9, 0.5); ctx.stroke(); }
      ctx.globalAlpha /= 0.7;
    }
  },
  giraffe(ctx, p) {
    const col = '#ecc88f', patch = '#a5622d', dark = '#5a3a20';
    const ly = p.ly, mv = p.mv, ph = p.ph * TAU * 1.1;
    const drink = p.st === 'drink', stretch = p.sp >= 0 ? Math.sin(Math.min(1, p.sp * 1.4) * Math.PI * 0.5) : 0;
    ell(ctx, 0, 0, 16, 3.4, 0, 'rgba(40,25,10,0.25)');
    const dy = ly * 26;
    const spread = drink ? p.hd * 6 : 0;
    const o = { hipB: -11, hipF: 11 + spread, hipYB: -30, hipYF: -33 + p.hd * (drink ? 7 : 0), L: 30, w: 2.8, col, hoof: dark, ph, mv, ly };
    curve(ctx, -14, -40 + dy, -16, -33 + dy, -16, -27 + dy, 1.1, col);
    ell(ctx, -16, -26 + dy, 1.2, 2.2, 0, dark);
    legs4(ctx, o, false);
    const bodyY = -38 + dy + (drink ? p.hd * 5 : 0);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, bodyY, 15, 9, -0.16, 0, TAU); ctx.fillStyle = C(col); ctx.fill(); ctx.clip();
    const R = rng(0.42);
    for (let i = 0; i < 14; i++) { const x = -14 + (i % 5) * 7 + R() * 2, y = bodyY - 8 + Math.floor(i / 5) * 6.5 + R() * 2; ell(ctx, x, y, 2.7, 2.2, R(), patch); }
    ctx.restore();
    legs4(ctx, o, true);
    // 목: 고개 숙임(먹기 0.6 · 물 마시기 1)과 늘이기(특수 행동)
    const down = drink ? p.hd * 2.0 : p.hd * 1.05;
    const nb = [10, bodyY - 5], na = 0.32 + down - stretch * 0.32, nl = 38 + stretch * 5;
    const tip = [nb[0] + Math.sin(na) * nl, nb[1] - Math.cos(na) * nl];
    taper(ctx, nb[0], nb[1], tip[0], tip[1], 7.5, 3.6, col);
    for (let k = 1; k < 5; k++) { const t = k / 5.2, x = nb[0] + (tip[0] - nb[0]) * t, y = nb[1] + (tip[1] - nb[1]) * t; ell(ctx, x, y, 2.1 * (1 - t * 0.4), 1.9 * (1 - t * 0.4), na, patch); }
    for (let k = 0; k < 6; k++) { const t = k / 6, x = nb[0] + (tip[0] - nb[0]) * t, y = nb[1] + (tip[1] - nb[1]) * t; ell(ctx, x - 2.6 * Math.cos(na), y - 2.6 * Math.sin(na), 1, 1.6, na, dark); }
    ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(na * 0.5 + 0.9 - stretch * 0.5);
    seg(ctx, -1.6, -2, -2.4, -5.4, 1, col); seg(ctx, 0, -2.2, -0.4, -5.6, 1, col);
    ell(ctx, -2.4, -5.6, 0.9, 0.9, 0, dark); ell(ctx, -0.4, -5.8, 0.9, 0.9, 0, dark);
    ell(ctx, -3.4, -1.4, 0.8, 2, -1.1, col);
    ell(ctx, 2, 0.4, 5.2, 2.7, 0.15, col);
    eye(ctx, 0.4, -0.6, 0.8, p.st === 'rest');
    ell(ctx, 6.4, 1.4, 0.5, 0.45, 0, dark);
    if (stretch > 0.5) { curve(ctx, 6.6, 1.6, 9, 0.5, 9.5, -2, 1.1, '#6a4a7a'); }
    ctx.restore();
    if (stretch > 0.4) { // 높은 가지의 잎
      for (let k = 0; k < 4; k++) ell(ctx, tip[0] + 8 + k * 2.4, tip[1] - 6 + (k % 2) * 2.5, 2.2, 1.4, k, '#6f9a3c');
    }
  },
  elephant(ctx, p) {
    const col = '#949ba2', dark = '#6f767d', light = '#aab0b6';
    const spray = p.sp >= 0, mv = p.mv, ph = p.ph * TAU * 1.0, eat = p.hd;
    ell(ctx, 0, 0, 22, 4.6, 0, 'rgba(40,25,10,0.28)');
    const o = { hipB: -13, hipF: 13, hipYB: -18, hipYF: -18, L: 18, w: 8, col, hoof: '#d8d2c6', ph, mv, ly: 0 };
    curve(ctx, -21, -35, -24, -28, -24, -20, 1.4, dark);
    ell(ctx, -24, -19, 1.2, 2.2, 0, '#3a3a3a');
    legs4(ctx, o, false);
    ell(ctx, 0, -32, 22, 15, 0, col);
    ell(ctx, -3, -40, 15, 6, 0, light);
    legs4(ctx, o, true);
    // 머리·귀·코
    ell(ctx, 18, -37, 9, 10, 0, col);
    const flap = Math.sin(p.ph * 2.2) * 0.12;
    ctx.save(); ctx.translate(13, -42); ctx.rotate(flap);
    ell(ctx, -1, 5, 7.6, 10.5, 0.1, dark); ell(ctx, -0.4, 5, 6, 8.8, 0.1, shade(col, 0.9));
    ctx.restore();
    let tx, ty, cx, cy;
    if (spray) { tx = 32; ty = -58; cx = 32; cy = -40; }
    else if (eat > 0.1) { tx = 26 + eat * 2; ty = -11 + eat * 9 - Math.max(0, Math.sin(p.ph * 3)) * eat * 8; cx = 30; cy = -26; }
    else { tx = 26 + Math.sin(p.ph * 1.3) * 1.5; ty = -12; cx = 29; cy = -24; }
    ctx.strokeStyle = C(col); ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const t0 = k / 6, t1 = (k + 1) / 6, q = (t) => [(1 - t) * (1 - t) * 24 + 2 * (1 - t) * t * cx + t * t * tx, (1 - t) * (1 - t) * -34 + 2 * (1 - t) * t * cy + t * t * ty];
      const [ax, ay] = q(t0), [bx, by] = q(t1);
      ctx.lineWidth = 6 - k * 0.7; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    curve(ctx, 22, -31, 26, -28, 28, -30, 1.8, '#f2ecdf');
    eye(ctx, 20.5, -40, 0.9, p.st === 'rest');
  },
};
// k = 화면 px / 단위. 원점(sx, sy) = 발밑
// 종별 리그 모듈(rigs/<종>.js): draw(g, p, H)가 있으면 그걸로 그리고, 없으면 위의 예전 그림(ANIMAL_ART)
// H = 리그가 쓰는 공통 도우미. C는 실루엣(앨범·잠금 아이콘)일 때 색을 바꾸므로 함수로 넘긴다
const RIGS = {
  rabbit: R_RABBIT, meerkat: R_MEERKAT, gazelle: R_GAZELLE, zebra: R_ZEBRA, ostrich: R_OSTRICH, lion: R_LION, giraffe: R_GIRAFFE, elephant: R_ELEPHANT,
  crab: R_CRAB, gull: R_GULL, turtle: R_TURTLE, flamingo: R_FLAMINGO, otter: R_OTTER, sealion: R_SEALION, dolphin: R_DOLPHIN, walrus: R_WALRUS, lizard: R_LIZARD, jerboa: R_JERBOA, fennec: R_FENNEC, snake: R_SNAKE, coyote: R_COYOTE, vulture: R_VULTURE, oryx: R_ORYX, camel: R_CAMEL, adelie: R_ADELIE, skua: R_SKUA, gentoo: R_GENTOO, weddell: R_WEDDELL, king: R_KING, elephantseal: R_ELEPHANTSEAL, emperor: R_EMPEROR, orca: R_ORCA,
};
const H = {
  TAU, ik, footAt, smooth, springTo, rigTick, limb, ell, seg, curve, taper, eye, shade, mix, rgba, hash,
  C: (c) => C(c), real: () => C('#000') === '#000',
};
export const RIGGED = new Set(Object.keys(RIGS).filter((sp) => RIGS[sp].draw)); // 외곽선을 두르는 종
export const STRIDE = Object.fromEntries(Object.keys(RIGS).filter((sp) => RIGS[sp].STRIDE).map((sp) => [sp, RIGS[sp].STRIDE])); // 걸음 위상 = 움직인 거리 ÷ STRIDE
export function drawAnimal(ctx, sp, sx, sy, k, pose, sil = null) {
  const rig = !pose.legacy && RIGS[sp]?.draw, f = rig ? (g, p) => rig(g, p, H) : ANIMAL_ART[sp]; // legacy: 비교용 예전 그림
  if (!f) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(k * (pose.face || 1), k);
  if (sil) C = () => sil;
  try { f(ctx, pose); } finally { C = (c) => c; ctx.restore(); }
}
// 탭 판정·말풍선 위치용 크기(단위): [가로 반폭, 높이]
export const ANIMAL_BOX = {
  rabbit: [8, 17], meerkat: [8, 14], gazelle: [13, 32], zebra: [20, 44], ostrich: [13, 56], lion: [18, 32], giraffe: [18, 86], elephant: [26, 54],
};
for (const sp of Object.keys(RIGS)) if (RIGS[sp].draw && RIGS[sp].BOX) ANIMAL_BOX[sp] = RIGS[sp].BOX; // 리그 그림 크기가 다르면 종 모듈이 덮어쓴다
// 반짝이(순간 포착 표시)
export function sparkle(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + i * 2.1, d = r * 1.4, px = Math.cos(a) * d, py = Math.sin(a) * d * 0.5 - r * 0.4, s = r * (0.5 + 0.25 * Math.sin(t * 8 + i));
    ctx.fillStyle = i ? '#ffe680' : '#ffffff';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const q = (k / 8) * TAU, rr = k % 2 ? s * 0.32 : s; ctx.lineTo(px + Math.cos(q) * rr, py + Math.sin(q) * rr); }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// 물방울 말풍선(행복도가 낮은 동물)
export function sadDrop(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.ellipse(0, 0, 6 * s, 6 * s, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-2 * s, 5 * s); ctx.lineTo(0, 9 * s); ctx.lineTo(2 * s, 5 * s); ctx.fill();
  ctx.fillStyle = '#4a9ad0';
  ctx.beginPath(); ctx.moveTo(0, -3.6 * s); ctx.quadraticCurveTo(3 * s, 0.5 * s, 0, 2.8 * s); ctx.quadraticCurveTo(-3 * s, 0.5 * s, 0, -3.6 * s); ctx.fill();
  ctx.restore();
}
