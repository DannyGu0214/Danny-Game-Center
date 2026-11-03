import { VIEW, HULLS, MODULES, PAINTS } from './data.js';
import { planW, modulePos, sizeOf, statsOf } from './ship.js';
// 배 그림. 선체와 모듈은 높이별 단면을 그려 방향마다 쌓은 그림을 미리 구워 두고(층 쌓기), 돛·돛대·사람처럼 움직이는 것은 매 프레임 그린다.
// 배 좌표: x 뱃머리 쪽, y 우현 쪽, z 위쪽. 단위 m.

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CELL = 256, COLS = 8, DIRS = 64, PX = 20; // 아틀라스 한 칸 256px, 1m = 20px, 64방향 = 2048×2048
const CENTER_Y = CELL / 2 + 22; // 수면 기준점(높이만큼 위로 그려서 아래로 내려 둠)
const DZ = 0.075;
const WOOD = { deck: '#c79c63', deckDark: '#a97f4b', cap: '#8a5b34', floor: '#7f5a36', log: '#a07a4c', logDark: '#7a5a35', logLit: '#bd9767' };
const BOOT = '#274a60', BOTTOM = '#a8483a', STRIPE = '#1f6d8c';

function roundRect(g, x0, y0, x1, y1, r) {
  r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  g.moveTo(x0 + r, y0);
  g.arcTo(x1, y0, x1, y1, r); g.arcTo(x1, y1, x0, y1, r); g.arcTo(x0, y1, x0, y0, r); g.arcTo(x0, y0, x1, y0, r);
  g.closePath();
}

// 선체 윤곽 경로. z가 낮을수록 좁고 짧다
function hullPath(g, id, z, inset = 0, from = -1) {
  const H = HULLS[id], n = 34, top = [], bot = [];
  const f = 0.74 + 0.26 * clamp(z / H.deck, 0, 1), r = 0.88 + 0.12 * clamp(z / (H.deck * 1.4), 0, 1);
  for (let i = 0; i <= n; i++) {
    const s = from + (1 - from) * i / n, x = s * (H.len / 2) * r, w = Math.max(0, planW(id, s) * f - inset);
    top.push([x, -w]); bot.push([x, w]);
  }
  g.beginPath(); g.moveTo(top[0][0], top[0][1]);
  for (const p of top) g.lineTo(p[0], p[1]);
  for (const p of bot.reverse()) g.lineTo(p[0], p[1]);
  g.closePath();
}

// 선체 단면
// ★3 고유 개조 그림: 뗏목 노걸이, 나룻배 센터보드, 슬루프 윈치
function drawPerk(g, H) {
  if (H.kind === 'raft') {
    g.fillStyle = '#6f7478';
    for (const x of [-1, 1]) for (const y of [-1, 1]) { g.beginPath(); g.arc(x * 0.5, y * (H.beam / 2 - 0.1), 0.12, 0, TAU); g.fill(); }
  } else if (H.kind === 'rowboat') {
    g.beginPath(); roundRect(g, -0.85, -0.08, 0.75, 0.08, 0.04); g.fillStyle = '#5a3f22'; g.fill();
    g.fillStyle = '#d9b265'; g.fillRect(-0.7, -0.015, 1.3, 0.03);
  } else {
    const x = H.cockpit[1] + 0.25;
    for (const y of [-1, 1]) { g.beginPath(); g.arc(x, y * 1.02, 0.13, 0, TAU); g.fillStyle = '#d9b265'; g.fill(); g.beginPath(); g.arc(x, y * 1.02, 0.05, 0, TAU); g.fillStyle = '#6b4a2e'; g.fill(); }
  }
}

function sliceRaft(g, z, H) {
  const L = H.len / 2, W2 = H.beam / 2;
  if (z > H.deck) return;
  // 통나무 다섯 개를 옆으로 나란히
  const n = 5, w = H.beam / n, top = z > H.deck - DZ * 1.2;
  for (let i = 0; i < n; i++) {
    const y = -W2 + (i + 0.5) * w;
    g.fillStyle = top ? (i % 2 ? WOOD.logLit : WOOD.log) : WOOD.logDark;
    g.beginPath(); roundRect(g, -L - (i % 3) * 0.08, y - w * 0.46, L + (i % 2) * 0.1, y + w * 0.46, w * 0.42); g.fill();
  }
  if (top) {
    // 묶은 밧줄
    g.fillStyle = '#d9c9a0';
    for (const x of H.star === 1 ? [-L * 0.68, L * 0.68] : [-L * 0.72, 0, L * 0.72]) g.fillRect(x - 0.05, -W2, 0.1, H.beam);
    if (H.star === 3) { g.fillStyle = '#6f7478'; for (const x of [-L * 0.36, L * 0.36]) g.fillRect(x - 0.04, -W2, 0.08, H.beam); drawPerk(g, H); }
  }
}
function sliceRowboat(g, z, paint, H) {
  const deck = H.deck, cap = H.star === 3 ? '#b98f45' : WOOD.cap; // ★3 보강재는 쇠붙이 색
  if (z > deck) return;
  const color = z < 0.06 ? BOTTOM : z < 0.1 ? BOOT : z > deck - DZ ? cap : paint;
  hullPath(g, H.id, z);
  g.fillStyle = color; g.fill();
  if (z > 0.17) {
    // 안쪽을 비워 벽만 남긴다
    g.save(); g.globalCompositeOperation = 'destination-out';
    hullPath(g, H.id, z, 0.13); g.fill(); g.restore();
  } else if (z > 0.1) {
    hullPath(g, H.id, z, 0.05); g.fillStyle = WOOD.floor; g.fill();
    g.strokeStyle = 'rgba(40,24,10,.3)'; g.lineWidth = 0.02;
    for (let y = -0.8; y < 0.9; y += 0.2) { g.beginPath(); g.moveTo(-H.len / 2, y); g.lineTo(H.len / 2, y); g.stroke(); }
  }
  if (z > 0.2 && z < 0.34) {
    g.fillStyle = WOOD.deck; // 가로 의자
    for (const x of H.star === 1 ? [-1.5, 1.1] : [-2, -0.2, 1.6]) g.fillRect(x - 0.17, -planW(H.id, x / (H.len / 2)) * 0.9, 0.34, planW(H.id, x / (H.len / 2)) * 1.8);
  }
  if (H.star === 3 && z > 0.2 && z < 0.3) drawPerk(g, H);
}
function sliceSloop(g, z, paint, H) {
  const DECK = H.deck, cap = H.star === 3 ? '#b98f45' : WOOD.cap, [ck0, ck1] = H.cockpit;
  let from = -1;
  if (z > DECK) from = Math.pow((z - DECK) / 0.42, 1 / 2.2);
  if (from >= 0.98) return;
  const color = z < 0.08 ? BOTTOM : z < 0.17 ? BOOT : z < 0.72 ? paint : z < 0.83 ? STRIPE : z < DECK - 0.05 ? paint : cap;
  hullPath(g, H.id, z, 0, from);
  g.fillStyle = color; g.fill();
  if (z > DECK - 0.05) {
    hullPath(g, H.id, z, 0.14, from);
    g.fillStyle = WOOD.deck; g.fill();
    g.save(); hullPath(g, H.id, z, 0.14, from); g.clip();
    g.strokeStyle = WOOD.deckDark; g.lineWidth = 0.025;
    for (let y = -1.6; y < 1.6; y += 0.22) { g.beginPath(); g.moveTo(-H.len / 2, y); g.lineTo(H.len / 2, y); g.stroke(); }
    g.restore();
  }
  // 고물 쪽 움푹한 조종석
  if (z >= 0.6 && z <= DECK + 0.02) {
    g.save(); g.globalCompositeOperation = 'destination-out';
    g.beginPath(); roundRect(g, ck0, -0.72, ck1, 0.72, 0.28); g.fill(); g.restore();
  }
  if (Math.abs(z - 0.56) < DZ * 0.6) {
    g.beginPath(); roundRect(g, ck0 - 0.1, -0.8, ck1 + 0.1, 0.8, 0.3); g.fillStyle = WOOD.floor; g.fill();
    g.strokeStyle = 'rgba(40,24,10,.35)'; g.lineWidth = 0.02;
    for (let x = ck0 + 0.05; x < ck1 + 0.1; x += 0.2) { g.beginPath(); g.moveTo(x, -0.75); g.lineTo(x, 0.75); g.stroke(); }
  }
  if (H.star === 3 && z > DECK && z < DECK + 0.16) drawPerk(g, H);
}

// 모듈 단면: z는 갑판에서 잰 높이
function sliceModule(g, m, hullId, z) {
  const M = MODULES[m.id];
  if (z < 0 || z > M.z) return;
  const H = HULLS[hullId], [cx, cy] = modulePos(hullId, m), [w, h] = sizeOf(m);
  // 모듈 칸(가로 = 배 폭 방향, 세로 = 배 길이 방향)
  const hx = (h * H.cell) / 2 - 0.05, hy = (w * H.cell) / 2 - 0.05, x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, top = z > M.z - DZ * 1.1;
  g.fillStyle = M.color;
  switch (m.id) {
    case 'food': {
      // 나무통
      g.fillStyle = top ? '#d6b07a' : M.color;
      g.beginPath(); g.arc(cx, cy, Math.min(hx, hy) * 0.8, 0, TAU); g.fill();
      if (top || Math.abs(z - M.z * 0.5) < DZ) { g.strokeStyle = '#5a3f22'; g.lineWidth = 0.05; g.stroke(); }
      break;
    }
    case 'hold':
      g.beginPath(); roundRect(g, x0, y0, x1, y1, 0.08); g.fill();
      if (top) { g.strokeStyle = '#6d4e2a'; g.lineWidth = 0.05; g.beginPath(); roundRect(g, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0.05); g.moveTo(cx, y0 + 0.1); g.lineTo(cx, y1 - 0.1); g.stroke(); }
      break;
    case 'cabin':
      g.fillStyle = top ? '#e9e2d0' : M.color;
      g.beginPath(); roundRect(g, x0, y0, x1, y1, 0.3); g.fill();
      if (z > 0.22 && z < 0.42) {
        g.strokeStyle = '#23475a'; g.lineWidth = 0.09;
        for (const y of [y0, y1]) { g.beginPath(); g.moveTo(x0 + 0.25, y); g.lineTo(cx - 0.1, y); g.moveTo(cx + 0.1, y); g.lineTo(x1 - 0.25, y); g.stroke(); }
      }
      if (top) { g.fillStyle = 'rgba(90,120,140,.55)'; g.beginPath(); roundRect(g, cx - 0.3, cy - 0.28, cx + 0.3, cy + 0.28, 0.08); g.fill(); }
      break;
    case 'awning':
      // 네 기둥 + 위쪽 천
      if (!top) { g.fillStyle = '#6b4a2e'; for (const [px, py] of [[x0 + 0.08, y0 + 0.08], [x0 + 0.08, y1 - 0.08], [x1 - 0.08, y0 + 0.08], [x1 - 0.08, y1 - 0.08]]) g.fillRect(px - 0.04, py - 0.04, 0.08, 0.08); } else {
        for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#f1e9d6' : M.color; g.fillRect(x0 - 0.04, y0 - 0.04 + (y1 - y0 + 0.08) * i / 6, x1 - x0 + 0.08, (y1 - y0 + 0.08) / 6); }
      }
      break;
    case 'oar':
      g.beginPath(); roundRect(g, cx - 0.16, y0 - 0.1, cx + 0.16, y1 + 0.1, 0.05); g.fill();
      break;
    case 'hammock':
      g.fillStyle = '#6b4a2e'; g.fillRect(x0 + 0.02, cy - 0.04, 0.08, 0.08); g.fillRect(x1 - 0.1, cy - 0.04, 0.08, 0.08);
      if (top) { g.fillStyle = M.color; g.beginPath(); g.ellipse(cx, cy, hx * 0.92, hy * 0.5, 0, 0, TAU); g.fill(); }
      break;
    case 'net':
      g.beginPath(); g.arc(cx, cy, Math.min(hx, hy) * 0.86, 0, TAU); g.fill();
      if (top) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.025; for (let a = -0.3; a <= 0.3; a += 0.15) { g.beginPath(); g.moveTo(cx + a, cy - 0.3); g.lineTo(cx + a, cy + 0.3); g.moveTo(cx - 0.3, cy + a); g.lineTo(cx + 0.3, cy + a); g.stroke(); } }
      break;
    case 'ballast':
      for (const [a, b] of [[-0.14, -0.12], [0.14, -0.1], [0, 0.14]]) { g.fillStyle = top ? '#9aa09c' : M.color; g.beginPath(); g.arc(cx + a, cy + b, 0.16, 0, TAU); g.fill(); }
      break;
    case 'telescope':
      if (!top) { g.fillStyle = '#6b4a2e'; g.fillRect(cx - 0.04, cy - 0.04, 0.08, 0.08); } else { g.save(); g.translate(cx, cy); g.rotate(0.5); g.fillStyle = M.color; g.fillRect(-0.34, -0.06, 0.68, 0.12); g.restore(); }
      break;
    case 'barometer':
      if (!top) { g.fillStyle = '#6b4a2e'; g.fillRect(cx - 0.05, cy - 0.05, 0.1, 0.1); } else { g.fillStyle = M.color; g.beginPath(); g.arc(cx, cy, 0.16, 0, TAU); g.fill(); g.fillStyle = '#b03a2e'; g.fillRect(cx - 0.01, cy - 0.12, 0.02, 0.12); }
      break;
    default: // 돛대 받침
      g.beginPath(); g.arc(cx, cy, 0.2, 0, TAU); g.fill();
  }
}

// 꾸미기 소품(자리는 선체마다 고물·뱃머리 쪽에 고정)
function sliceDecor(g, ship, z) {
  const H = HULLS[ship.hull], stern = -H.len / 2 + 0.45, bow = H.len / 2 - 1.1;
  for (const d of ship.decor || []) {
    if (d === 'flowerpot' && z < 0.42) {
      const x = bow, y = 0;
      if (z < 0.22) { g.fillStyle = '#b5623e'; g.beginPath(); g.arc(x, y, 0.15, 0, TAU); g.fill(); } else { for (const [a, b, c] of [[0, 0, '#e9c23c'], [0.09, 0.07, '#e96f6f'], [-0.08, 0.06, '#f4f0e0'], [0.02, -0.1, '#e9c23c']]) { g.fillStyle = '#5c9a4a'; g.beginPath(); g.arc(x + a, y + b, 0.11, 0, TAU); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(x + a, y + b, 0.05, 0, TAU); g.fill(); } }
    }
    if (d === 'cat' && z < 0.26) {
      const x = stern + 0.5, y = 0.55 * H.beam * 0.35;
      g.fillStyle = z < 0.18 ? '#d9913f' : '#e9a653'; g.beginPath(); g.ellipse(x, y, 0.2, 0.12, 0, 0, TAU); g.fill();
      if (z > 0.15) { g.beginPath(); g.arc(x + 0.16, y, 0.09, 0, TAU); g.fill(); g.fillStyle = '#7a4f24'; g.fillRect(x + 0.2, y - 0.09, 0.05, 0.04); g.fillRect(x + 0.2, y + 0.05, 0.05, 0.04); }
    }
    if (d === 'garland' && z < 0.06) {
      for (let s = -0.9; s <= 0.9; s += 0.14) { const x = s * H.len / 2 * 0.9, w = planW(ship.hull, s) * 0.92; for (const y of [-w, w]) { g.fillStyle = (Math.round(s * 7) % 2) ? '#f4d03f' : '#ec7a7a'; g.beginPath(); g.arc(x, y, 0.07, 0, TAU); g.fill(); } }
    }
  }
}

// 설계가 바뀔 때 방향마다 층을 쌓아 한 장에 굽는다. 조명은 세상 기준이라 칸마다 입힌다
export function bakeShip(ship, reuse = null) {
  const H = HULLS[ship.hull], paint = PAINTS.hull[ship.paint?.hull ?? 0] || PAINTS.hull[0];
  const tall = Math.max(...ship.mods.map((m) => MODULES[m.id].z), 0.1) + (H.kind === 'sloop' ? 0.45 : 0.1);
  const zMax = H.deck + tall, layers = [], size = CELL;
  for (let z = 0; z <= zMax; z += DZ) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    g.setTransform(PX, 0, 0, PX, size / 2, size / 2);
    if (H.kind === 'raft') sliceRaft(g, z, H); else if (H.kind === 'rowboat') sliceRowboat(g, z, paint, H); else sliceSloop(g, z, paint, H);
    for (const m of ship.mods) sliceModule(g, m, ship.hull, z - H.deck);
    sliceDecor(g, ship, z - H.deck);
    layers.push({ c, z });
  }
  const atlas = reuse?.atlas || document.createElement('canvas');
  atlas.width = COLS * CELL; atlas.height = Math.ceil(DIRS / COLS) * CELL;
  const g = atlas.getContext('2d');
  for (let d = 0; d < DIRS; d++) {
    const a = d / DIRS * TAU, cx = (d % COLS) * CELL + CELL / 2, cy = Math.floor(d / COLS) * CELL + CENTER_Y;
    g.save();
    g.beginPath(); g.rect((d % COLS) * CELL, Math.floor(d / COLS) * CELL, CELL, CELL); g.clip();
    for (const { c, z } of layers) {
      g.setTransform(Math.cos(a), Math.sin(a) * VIEW.tiltY, -Math.sin(a), Math.cos(a) * VIEW.tiltY, cx, cy - z * PX * VIEW.tiltZ);
      g.drawImage(c, -size / 2, -size / 2);
    }
    // 왼쪽 위에서 오는 햇빛: 오른쪽 아래가 어둡다
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(cx - 70, cy - 60, cx + 70, cy + 50);
    gr.addColorStop(0, 'rgba(255,240,205,.14)'); gr.addColorStop(0.55, 'rgba(255,240,205,0)'); gr.addColorStop(1, 'rgba(24,40,70,.26)');
    g.fillStyle = gr; g.fillRect(cx - CELL / 2, cy - CENTER_Y, CELL, CELL);
    g.restore();
  }
  for (const l of layers) l.c.width = l.c.height = 0; // iOS 캔버스 메모리 반환
  const st = statsOf(ship);
  const M = st.mast ? MODULES[st.mastId] : null;
  return {
    atlas, hull: H, oar: ship.mods.find((m) => m.id === 'oar') ? modulePos(ship.hull, ship.mods.find((m) => m.id === 'oar'))[0] : -0.5,
    rig: M ? { x: st.mastX, h: M.mastH, boomL: M.boom, boomZ: H.deck + 1.3, big: M.sail >= 1, base: H.deck + 0.05 } : null,
    sail: PAINTS.sail[ship.paint?.sail ?? 0] || PAINTS.sail[0], flag: PAINTS.flag[ship.paint?.flag ?? 0] || PAINTS.flag[0],
    decor: ship.decor || [],
  };
}

// 배 위의 점을 화면 좌표로. 기울기·앞뒤 흔들림을 진짜 3D로 돌린다
export function makeProjector(bx, by, h, heel, pitch, zoom, bob) {
  const ch = Math.cos(h), sh = Math.sin(h), cr = Math.cos(heel), sr = Math.sin(heel), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (x, y, z) => {
    const y1 = y * cr - z * sr, z1 = y * sr + z * cr;
    const x2 = x * cp + z1 * sp, z2 = -x * sp + z1 * cp;
    const wx = x2 * ch - y1 * sh, wy = x2 * sh + y1 * ch;
    return [bx + wx * zoom, by + (wy * VIEW.tiltY - (z2 + bob) * VIEW.tiltZ) * zoom, wy];
  };
}

function mainMesh(P, rig, boom, now, luff, t, flapAmp) {
  const rows = 7, cols = 5, head = rig.boomZ + (rig.h - 0.2 - rig.boomZ) * (0.22 + 0.78 * now);
  const cb = Math.cos(boom), sb = Math.sin(boom), MX = rig.x;
  const clew = [MX - rig.boomL * cb, rig.boomL * sb, rig.boomZ + 0.05];
  const belly = (luff ? 0.2 : 0.62) * Math.sign(boom || 1) * (rig.boomL / 4.2), mesh = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows, lz = rig.boomZ + (head - rig.boomZ) * v;
    const rx = clew[0] + (MX - clew[0]) * v * 0.96, ry = clew[1] * (1 - v * 0.96), rz = clew[2] + (head - clew[2]) * v;
    const row = [];
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      let bulge = belly * Math.sin(PI * u) * (1 - v) ** 0.7;
      if (luff) bulge += flapAmp * Math.sin(u * 6 + v * 5 - t * 11) * u * (1 - v * 0.6);
      row.push(P(MX + (rx - MX) * u + sb * bulge, ry * u + cb * bulge, lz + (rz - lz) * u));
    }
    mesh.push(row);
  }
  return mesh;
}
function jibMesh(P, rig, hull, boom, now, luff, t, flapAmp) {
  const rows = 5, cols = 4, k = clamp((now - 0.6) / 0.4, 0, 1);
  if (k <= 0 || !rig.big) return null;
  const side = Math.sign(boom || 1), a = Math.abs(boom) * 0.8 + 0.1, MX = rig.x;
  const tack = [hull.len / 2 - 0.25, 0, hull.deck + 0.45], head = [MX + 0.25, 0, rig.boomZ + (rig.h - 0.2 - rig.boomZ) * 0.86 * k + 0.2];
  const clew = [MX + 0.15 + (3 - 3 * Math.cos(a)) * 0.2, side * (0.5 + 2.6 * Math.sin(a)) * k, hull.deck + 0.65];
  const mesh = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const lf = [tack[0] + (head[0] - tack[0]) * v, 0, tack[2] + (head[2] - tack[2]) * v];
    const rt = [clew[0] + (head[0] - clew[0]) * v, clew[1] * (1 - v), clew[2] + (head[2] - clew[2]) * v];
    const row = [];
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      let bulge = (luff ? 0.1 : 0.42) * side * Math.sin(PI * u) * (1 - v) ** 0.6;
      if (luff) bulge += flapAmp * 0.8 * Math.sin(u * 7 + v * 4 - t * 13) * u;
      row.push(P(lf[0] + (rt[0] - lf[0]) * u, lf[1] + (rt[1] - lf[1]) * u + bulge, lf[2] + (rt[2] - lf[2]) * u));
    }
    mesh.push(row);
  }
  return mesh;
}
function drawMesh(g, mesh, color, dim = 1) {
  const rows = mesh.length - 1;
  for (let j = 0; j < rows; j++) {
    const a = mesh[j], b = mesh[j + 1], n = a.length - 1;
    let area = 0;
    for (let i = 0; i < n; i++) area += (a[i + 1][0] - a[i][0]) * (b[i][1] - a[i][1]) - (a[i + 1][1] - a[i][1]) * (b[i][0] - a[i][0]);
    const k = (area > 0 ? 1 : 0.8) * (0.9 + 0.1 * j / rows) * dim;
    g.fillStyle = `rgb(${color[0] * k | 0},${color[1] * k | 0},${color[2] * k | 0})`;
    g.beginPath();
    g.moveTo(a[0][0], a[0][1]);
    for (let i = 1; i <= n; i++) g.lineTo(a[i][0], a[i][1]);
    for (let i = n; i >= 0; i--) g.lineTo(b[i][0], b[i][1]);
    g.closePath(); g.fill();
    g.strokeStyle = g.fillStyle; g.lineWidth = 0.6; g.stroke(); // 판 사이 틈 메우기
  }
  g.strokeStyle = 'rgba(120,100,70,.28)'; g.lineWidth = 0.7;
  for (let j = 1; j < rows; j++) { const a = mesh[j]; g.beginPath(); g.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) g.lineTo(a[i][0], a[i][1]); g.stroke(); }
}
function line(g, P, a, b, color, w) {
  const p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]);
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
}

// 사람: 작은 원통 몸 + 머리 + 모자. 선장은 흰 모자, 선원은 맨머리
function drawPerson(g, P, x, y, z, zoom, rowPhase, coat, captain) {
  const s = Math.max(1, zoom / 6.5), lean = rowPhase === null ? 0 : Math.cos(rowPhase) * 0.34;
  const base = P(x, y, z), top = P(x + lean, y, z + (rowPhase === null ? 1.1 : 0.82));
  g.lineCap = 'round';
  g.strokeStyle = coat; g.lineWidth = 3.2 * s;
  g.beginPath(); g.moveTo(base[0], base[1]); g.lineTo(top[0], top[1]); g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(top[0], top[1] - 2.1 * s, 1.8 * s, 0, TAU); g.fill();
  if (captain) {
    g.fillStyle = '#fbfbf6'; g.beginPath(); g.ellipse(top[0], top[1] - 3.3 * s, 2.5 * s, 1 * s, 0, 0, TAU); g.fill();
    g.fillStyle = '#1b3550'; g.fillRect(top[0] - 2 * s, top[1] - 3.6 * s, 4 * s, 0.6 * s);
  } else { g.fillStyle = '#4a3322'; g.beginPath(); g.arc(top[0], top[1] - 2.6 * s, 1.5 * s, PI, TAU); g.fill(); }
}

// 수면 그늘과 비친 돛(선체보다 먼저 그린다)
const rotateLocal = (a, h) => [a[0] * Math.cos(h) - a[1] * Math.sin(h), a[0] * Math.sin(h) + a[1] * Math.cos(h)];
export function drawShipOnWater(g, sprite, st, zoom, sx, sy) {
  const hull = sprite.hull, rig = sprite.rig;
  g.save();
  g.translate(sx, sy); g.scale(1, VIEW.tiltY); g.rotate(st.h);
  g.fillStyle = 'rgba(14,50,70,.28)';
  g.beginPath(); g.ellipse(0.1 * zoom, 0.25 * zoom, (hull.len / 2 + 0.4) * zoom, (hull.beam / 2 + 0.45) * zoom, 0, 0, TAU); g.fill();
  g.restore();
  if (!rig || st.sailNow < 0.05) return;
  const head = rig.boomZ + (rig.h - 0.2 - rig.boomZ) * (0.22 + 0.78 * st.sailNow);
  const clew = [rig.x - rig.boomL * Math.cos(st.boom), rig.boomL * Math.sin(st.boom), rig.boomZ];
  const shade = (a) => { const [wx, wy] = rotateLocal(a, st.h); return [sx + (wx + a[2] * 0.38) * zoom, sy + (wy + a[2] * 0.2) * VIEW.tiltY * zoom]; };
  g.fillStyle = 'rgba(14,50,70,.14)';
  const pts = [[rig.x, 0, rig.boomZ], [rig.x, 0, head], clew].map(shade);
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,250,235,.08)';
  const mir = [[rig.x, 0, -rig.boomZ], [rig.x, 0, -head], [clew[0], clew[1], -clew[2]]].map((a) => { const [wx, wy] = rotateLocal(a, st.h); return [sx + wx * zoom + Math.sin(a[2] + st.t * 2) * 1.4, sy + (wy * VIEW.tiltY - a[2] * VIEW.tiltZ) * zoom]; });
  g.beginPath(); g.moveTo(mir[0][0], mir[0][1]); g.lineTo(mir[1][0], mir[1][1]); g.lineTo(mir[2][0], mir[2][1]); g.closePath(); g.fill();
}

const COATS = { deckhand: '#8a3f3a', lookout: '#3f7a4f', helmsman: '#7a5a2a' };

// 배 전체: 선체 그림 한 장 + 그 위의 돛대·돛·사람
export function drawShip(g, sprite, st, zoom, sx, sy) {
  const { h, heel, pitch, bob, sailNow, boom, luff, t, row, rowPhase, flagFrom } = st;
  const { atlas, hull, rig } = sprite, P = st.P;
  const f = ((h / TAU) % 1 + 1) % 1 * DIRS, idx = Math.round(f) % DIRS, rest = (f - Math.round(f)) * TAU / DIRS;
  const k = zoom / PX, sxa = (idx % COLS) * CELL, sya = Math.floor(idx / COLS) * CELL;
  const screenRoll = -heel * Math.sin(h) * 0.9 + pitch * Math.cos(h) * 0.7;
  g.save();
  g.translate(sx, sy - bob * VIEW.tiltZ * zoom);
  g.rotate(screenRoll + rest * VIEW.tiltY);
  g.scale(k, k);
  g.drawImage(atlas, sxa, sya, CELL, CELL, -CELL / 2, -CENTER_Y, CELL, CELL);
  g.restore();

  const items = [], s = Math.max(1, zoom / 6.5), flapAmp = 0.34, deck = hull.deck;
  if (rig) {
    const MX = rig.x, base = P(MX, 0, rig.base), top = P(MX, 0, rig.h);
    const boomEnd = [MX - rig.boomL * Math.cos(boom), rig.boomL * Math.sin(boom), rig.boomZ];
    items.push({ d: base[2], draw() {
      line(g, P, [MX, 0, rig.base], [MX, 0, rig.h], '#6b4a2e', (rig.big ? 1.8 : 1.3) * s);
      line(g, P, [MX, 0, rig.h - 0.05], [hull.len / 2 - 0.25, 0, deck + 0.45], 'rgba(60,50,40,.55)', 0.6 * s);
      line(g, P, [MX, 0, rig.h - 0.05], [-hull.len / 2 + 0.45, 0, deck + 0.1], 'rgba(60,50,40,.45)', 0.6 * s);
      line(g, P, [MX, 0, rig.boomZ], boomEnd, '#6b4a2e', (rig.big ? 1.5 : 1.1) * s);
      // 돛대 꼭대기 깃발: 바람 부는 쪽으로 날린다
      const dx = -Math.cos(flagFrom) * 6.5 * s, dy = -Math.sin(flagFrom) * 6.5 * s * VIEW.tiltY, wv = Math.sin(t * 7) * 1.2 * s;
      g.fillStyle = sprite.flag;
      g.beginPath(); g.moveTo(top[0], top[1] - 1.6 * s); g.quadraticCurveTo(top[0] + dx * 0.5, top[1] + dy * 0.5 + wv - 0.6 * s, top[0] + dx, top[1] + dy + wv * 1.6);
      g.quadraticCurveTo(top[0] + dx * 0.5, top[1] + dy * 0.5 + wv + 0.6 * s, top[0], top[1] + 1.6 * s); g.closePath(); g.fill();
      // 삼각기 줄
      if (sprite.decor.includes('pennant')) {
        const a = P(MX, 0, rig.h - 1), b = P(hull.len / 2 - 0.3, 0, deck + 0.5);
        for (let i = 1; i < 7; i++) { const q = i / 7, px = a[0] + (b[0] - a[0]) * q, py = a[1] + (b[1] - a[1]) * q + Math.sin(q * PI) * 3 * s; g.fillStyle = ['#d6443a', '#e7b64a', '#2f7fb8'][i % 3]; g.beginPath(); g.moveTo(px - 1.3 * s, py); g.lineTo(px + 1.3 * s, py); g.lineTo(px, py + 2.6 * s); g.closePath(); g.fill(); }
      }
    } });
    if (sailNow >= 0.05) {
      const main = mainMesh(P, rig, boom, sailNow, luff, t, flapAmp);
      items.push({ d: main[3][2][2] - 0.01, draw() { drawMesh(g, main, sprite.sail); } });
      const jib = jibMesh(P, rig, hull, boom, sailNow, luff, t, flapAmp);
      if (jib) items.push({ d: jib[2][2][2], draw() { drawMesh(g, jib, sprite.sail, 0.97); } });
    } else items.push({ d: base[2] + 0.01, draw() { line(g, P, [MX, 0, rig.boomZ + 0.14], [boomEnd[0], boomEnd[1], rig.boomZ + 0.14], '#efe6cf', (rig.big ? 3.2 : 2.3) * s); } });
  } else if (sprite.decor.includes('pennant')) { /* 돛대가 없으면 삼각기 줄을 걸 곳이 없다 */ }

  // 랜턴: 고물 기둥
  if (sprite.decor.includes('lantern')) {
    const lx = -hull.len / 2 + 0.3, p0 = P(lx, 0, deck), p1 = P(lx, 0, deck + 1.1);
    items.push({ d: p0[2] - 0.02, draw() {
      g.strokeStyle = '#4a3322'; g.lineWidth = 0.9 * s; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      g.fillStyle = '#ffcf6b'; g.beginPath(); g.arc(p1[0], p1[1], 1.5 * s, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,210,120,.28)'; g.beginPath(); g.arc(p1[0], p1[1], 3.6 * s, 0, TAU); g.fill();
    } });
  }
  // 사람들
  const floor = hull.kind === 'sloop' ? 0.72 : hull.kind === 'rowboat' ? 0.22 : deck;
  const capX = st.capX ?? hull.helmX;
  const manP = P(capX, 0, floor);
  items.push({ d: manP[2], draw() {
    drawPerson(g, P, capX, 0, floor, zoom, row ? rowPhase : null, '#25506f', true);
    if (!row && Math.abs(capX - hull.helmX) < 0.6) line(g, P, [-hull.len / 2 + 0.25, 0, deck + 0.08], [hull.helmX + 0.2, -st.rudder * 0.65, deck + 0.14], '#6b4a2e', 1.3 * s);
  } });
  if (row) items.push({ d: manP[2] + 0.01, draw() { drawOars(g, P, sprite, rowPhase, s); } });
  (st.crew || []).forEach((c) => {
    const pos = c.role === 'deckhand' ? [(rig ? rig.x : 0) - 0.5, 0.45, deck] : c.role === 'lookout' ? [hull.len / 2 - 1.5, 0, deck] : [hull.helmX, 0.35, floor];
    const q = P(pos[0], pos[1], pos[2]);
    items.push({ d: q[2], draw() { drawPerson(g, P, pos[0], pos[1], pos[2], zoom, null, COATS[c.role] || '#555', false); } });
  });

  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}

function drawOars(g, P, sprite, phase, s) {
  const { hull, oar } = sprite, swing = Math.cos(phase) * 0.8, dip = Math.sin(phase), reach = hull.beam / 2 + 1.5;
  for (const side of [-1, 1]) {
    const pin = [oar, side * hull.beam * 0.44, hull.deck + 0.02];
    const blade = [pin[0] + swing * 2.2, side * (reach + 0.2), dip > 0 ? -0.05 : 0.5 + (-dip) * 0.45];
    const hand = [pin[0] - swing * 0.6, side * 0.25, hull.deck + 0.16];
    line(g, P, hand, blade, '#7a5230', 1.2 * s);
    const a = P(blade[0], blade[1], blade[2]), b = P(blade[0] - swing * 0.2, side * (reach + 1), blade[2]);
    g.strokeStyle = '#e8d7a8'; g.lineWidth = 3 * s; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
}

// 노 끝이 물에 닿는 자리(물결 고리를 만들 때 쓴다)
export function oarBladeLocal(sprite, phase, side) {
  const swing = Math.cos(phase) * 0.8, reach = sprite.hull.beam / 2 + 1.7;
  return [sprite.oar + swing * 2.2, side * reach];
}

// 평면도 한 칸 그림(설계 화면용): 모듈을 위에서 본 모양으로
export function drawModuleTop(g, m, hullId, px, ox, oy) {
  const H = HULLS[hullId];
  g.save();
  // 평면도: 뱃머리가 위. 배 x → 화면 -y, 배 y → 화면 x
  g.setTransform(px, 0, 0, px, ox, oy);
  g.transform(0, -1, 1, 0, 0, 0);
  const M = MODULES[m.id], top = M.z;
  sliceModule(g, m, hullId, top - 0.0001);
  g.restore();
  void H;
}
export function drawHullTop(g, hullId, px, ox, oy, paint) {
  g.save();
  g.setTransform(px, 0, 0, px, ox, oy);
  g.transform(0, -1, 1, 0, 0, 0);
  const H = HULLS[hullId];
  if (H.kind === 'raft') { sliceRaft(g, H.deck, H); } else {
    hullPath(g, hullId, H.deck); g.fillStyle = H.star === 3 ? '#b98f45' : paint; g.fill(); // ★3은 테두리에 보강재
    if (H.star === 3) { hullPath(g, hullId, H.deck, 0.05); g.fillStyle = paint; g.fill(); }
    hullPath(g, hullId, H.deck, 0.12); g.fillStyle = H.kind === 'sloop' ? WOOD.deck : WOOD.floor; g.fill();
    if (H.star === 3) drawPerk(g, H);
  }
  g.restore();
}

// 선장 고르기 얼굴(머리·모자·옷). 머리 모양과 색으로 네 사람을 구분한다
export function drawCaptainPortrait(g, C, x, y, s, hat = true) {
  const skin = '#f0c8a0';
  g.fillStyle = C.coat; g.beginPath(); g.moveTo(x - 24 * s, y + 38 * s); g.quadraticCurveTo(x - 22 * s, y + 8 * s, x, y + 8 * s); g.quadraticCurveTo(x + 22 * s, y + 8 * s, x + 24 * s, y + 38 * s); g.closePath(); g.fill();
  if (C.style === 'long') { g.fillStyle = C.hair; g.beginPath(); g.ellipse(x, y - 4 * s, 16 * s, 21 * s, 0, 0, TAU); g.fill(); }
  g.fillStyle = skin; g.fillRect(x - 5 * s, y, 10 * s, 11 * s);
  g.beginPath(); g.ellipse(x, y - 8 * s, 12.5 * s, 14 * s, 0, 0, TAU); g.fill();
  g.fillStyle = C.hair;
  if (C.style === 'short') { g.beginPath(); g.ellipse(x, y - 15 * s, 13 * s, 8 * s, 0, PI, TAU); g.fill(); g.fillRect(x - 13 * s, y - 16 * s, 3.5 * s, 8 * s); g.fillRect(x + 9.5 * s, y - 16 * s, 3.5 * s, 8 * s); }
  if (C.style === 'long') { g.beginPath(); g.ellipse(x - 3 * s, y - 16 * s, 12 * s, 7 * s, -0.2, PI, TAU); g.fill(); }
  if (C.style === 'perm') for (const [a, b] of [[-12, -12], [-6, -17], [1, -18], [8, -16], [12, -11]]) { g.beginPath(); g.arc(x + a * s, y + b * s, 5 * s, 0, TAU); g.fill(); }
  if (C.style === 'bald') { g.fillRect(x - 13 * s, y - 11 * s, 3 * s, 8 * s); g.fillRect(x + 10 * s, y - 11 * s, 3 * s, 8 * s); g.fillRect(x - 8 * s, y + 0.5 * s, 16 * s, 2.5 * s); }
  g.fillStyle = '#2a2320';
  for (const q of [-1, 1]) { g.beginPath(); g.arc(x + q * 4.6 * s, y - 8 * s, 1.5 * s, 0, TAU); g.fill(); }
  g.strokeStyle = '#a0603f'; g.lineWidth = 1.2 * s; g.beginPath(); g.arc(x, y - 3.6 * s, 3.4 * s, 0.25, PI - 0.25); g.stroke();
  if (C.style === 'perm') { g.strokeStyle = '#3a3a3a'; g.lineWidth = 1 * s; for (const q of [-1, 1]) { g.beginPath(); g.arc(x + q * 4.6 * s, y - 8 * s, 3.6 * s, 0, TAU); g.stroke(); } }
  if (!hat) return;
  // 선장 모자
  g.fillStyle = '#fbfbf6'; g.beginPath(); g.ellipse(x, y - 21 * s, 15 * s, 5.5 * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#1b3550'; g.fillRect(x - 12 * s, y - 20 * s, 24 * s, 3 * s);
}
