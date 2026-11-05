// 가게 외관과 점내 구조. 손님 움직임은 floor.js가 정하고 여기는 그리기만 한다.
import { rr, circle, lin, rad, font, TAU, shopFront } from './art.js';
import { FLOORS } from './floor.js';

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16), f = (c) => Math.round(Math.max(0, Math.min(255, c * k)));
  return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
};

// ── 작은 인물 ──────────────────────────────
const LOOK = {
  skin: ['#f2cfae', '#ecc29d', '#e6b890', '#f4d6ba'],
  hair: ['#1f1a1b', '#2d2320', '#49301f', '#6a5548', '#b9b3aa'],
  office: ['#2d3545', '#3f4b63', '#454852', '#6c7886', '#2a2e38', '#e9e4da'],
  home: ['#c98d6c', '#7c9a7a', '#d9c07f', '#6d8598', '#b56f71', '#e7dcc6'],
  style: ['short', 'bob', 'mid', 'long'],
};
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
export const randomLook = (place, rand = Math.random) => ({ skin: pick(LOOK.skin, rand), hair: pick(LOOK.hair, rand), body: pick(LOOK[place], rand), style: pick(LOOK.style, rand), legs: place === 'office' ? '#262a33' : '#4d5563' });

export function drawChibi(g, x, y, s, p, { phase = 0, moving = false, sit = false, cup = false, apron = false, dir = 1, alpha = 1 } = {}) {
  const look = p || { skin: '#ecc29d', hair: '#2d2320', body: '#6d8598', style: 'short' };
  const bob = moving ? Math.abs(Math.sin(phase)) * s * 0.07 : 0;
  g.save(); g.globalAlpha *= alpha;
  // 그림자
  g.fillStyle = 'rgba(20,10,5,.28)'; g.beginPath(); g.ellipse(x, y, s * 0.46, s * 0.15, 0, 0, TAU); g.fill();
  const hip = y - (sit ? s * 0.62 : s * 0.72) - bob, shoulder = hip - s * 0.82, headY = shoulder - s * 0.44;
  // 다리
  if (!sit) {
    const sw = moving ? Math.sin(phase) * s * 0.17 : 0;
    g.strokeStyle = look.legs || '#2e323c'; g.lineWidth = s * 0.25; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - s * 0.16, hip); g.lineTo(x - s * 0.16 + sw, y - s * 0.08); g.moveTo(x + s * 0.16, hip); g.lineTo(x + s * 0.16 - sw, y - s * 0.08); g.stroke();
  }
  // 몸
  g.fillStyle = lin(g, x, shoulder, x, hip, [[0, shade(look.body, 1.08)], [1, shade(look.body, 0.82)]]);
  rr(g, x - s * 0.4, shoulder, s * 0.8, hip - shoulder + s * 0.08, s * 0.24); g.fill();
  if (apron) { g.fillStyle = '#5b3f2a'; rr(g, x - s * 0.3, shoulder + s * 0.2, s * 0.6, hip - shoulder - s * 0.1, s * 0.08); g.fill(); }
  if (look.tie) { g.fillStyle = look.tie; g.fillRect(x - s * 0.05, shoulder + s * 0.05, s * 0.1, s * 0.34); }
  // 팔과 컵
  const armX = x + dir * s * 0.42;
  g.strokeStyle = shade(look.body, 0.92); g.lineWidth = s * 0.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(armX, shoulder + s * 0.14); g.lineTo(armX + dir * s * (cup ? 0.16 : 0.02), shoulder + s * (cup ? 0.46 : 0.66)); g.stroke();
  if (cup) {
    const cx = armX + dir * s * 0.22, cy = shoulder + s * 0.34;
    g.fillStyle = '#f5ecdb'; g.beginPath(); g.moveTo(cx - s * 0.13, cy - s * 0.17); g.lineTo(cx + s * 0.13, cy - s * 0.17); g.lineTo(cx + s * 0.09, cy + s * 0.15); g.lineTo(cx - s * 0.09, cy + s * 0.15); g.fill();
    g.fillStyle = '#7b4c27'; g.fillRect(cx - s * 0.11, cy - s * 0.04, s * 0.2, s * 0.1);
  }
  // 머리
  g.fillStyle = look.skin; circle(g, x, headY, s * 0.42); g.fill();
  g.fillStyle = look.hair;
  g.beginPath(); g.arc(x, headY - s * 0.04, s * 0.45, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(x, headY - s * 0.2, x - s * 0.45, headY - s * 0.02); g.fill();
  if (look.style === 'bob' || look.style === 'long' || look.style === 'oldF') { const l = look.style === 'long' ? 0.72 : 0.36; g.fillRect(x - s * 0.46, headY - s * 0.06, s * 0.15, s * l); g.fillRect(x + s * 0.31, headY - s * 0.06, s * 0.15, s * l); }
  if (look.style === 'oldF') { circle(g, x, headY - s * 0.5, s * 0.16); g.fill(); }
  g.fillStyle = '#2a1f1b'; circle(g, x - s * 0.15 + dir * s * 0.05, headY + s * 0.05, s * 0.05); g.fill(); circle(g, x + s * 0.15 + dir * s * 0.05, headY + s * 0.05, s * 0.05); g.fill();
  if (look.glasses) { g.strokeStyle = '#4e3b2c'; g.lineWidth = s * 0.03; circle(g, x - s * 0.15 + dir * s * 0.05, headY + s * 0.05, s * 0.1); g.stroke(); circle(g, x + s * 0.15 + dir * s * 0.05, headY + s * 0.05, s * 0.1); g.stroke(); }
  g.restore();
}

// ── 점내 ───────────────────────────────────
const THEME = {
  office: { floorA: '#8d8a84', floorB: '#7f7c77', wall: '#514238', wallLow: '#3c3029', side: '#463930', trim: '#22191a', counter: '#3a2c23', counterTop: '#cdbda5', width: 0.9, top: 0.31 },
  home: { floorA: '#b98d62', floorB: '#a97e55', wall: '#e4d4b7', wallLow: '#c9b491', side: '#d8c6a7', trim: '#7b5a3d', counter: '#8b6240', counterTop: '#e6d3b4', width: 1.08, top: 0.31 },
};
function projector(place, W, H) {
  const T = THEME[place], floorTop = H * T.top, floorBot = H * 0.885, wf = W * T.width;
  const P = (x, y) => { const v = y / 100, k = 0.72 + 0.28 * v; return { x: W / 2 + (x - 50) / 100 * wf * k, y: floorTop + (floorBot - floorTop) * v, k }; };
  return { P, floorTop, floorBot, wf, T };
}
function quad(g, a, b, c, d) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); }
function drawFloorSurface(g, place, pj) {
  const { P, T } = pj;
  quad(g, P(0, 0), P(100, 0), P(100, 100), P(0, 100));
  g.fillStyle = T.floorA; g.fill();
  g.save(); g.clip();
  if (place === 'home') { // 나무 마루
    g.strokeStyle = 'rgba(70,42,20,.22)'; g.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { const a = P(0, i * 100 / 12), b = P(100, i * 100 / 12); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    for (let i = 0; i < 12; i++) for (let k = i % 2 ? 1 : 0; k <= 8; k += 2) { const a = P(k * 12.5, i * 100 / 12), b = P(k * 12.5, (i + 1) * 100 / 12); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    // 러그
    quad(g, P(38, 40), P(62, 40), P(62, 88), P(38, 88)); g.fillStyle = 'rgba(121,62,47,.28)'; g.fill();
  } else { // 사각 타일
    for (let i = 0; i < 10; i++) for (let k = 0; k < 8; k++) if ((i + k) % 2) { quad(g, P(k * 12.5, i * 10), P((k + 1) * 12.5, i * 10), P((k + 1) * 12.5, (i + 1) * 10), P(k * 12.5, (i + 1) * 10)); g.fillStyle = T.floorB; g.fill(); }
  }
  g.restore();
  // 창으로 드는 빛
  const a = P(2, 30), b = P(30, 40), c = P(30, 86), d = P(2, 92);
  quad(g, a, b, c, d); g.fillStyle = 'rgba(255,233,180,.12)'; g.fill();
}
function drawWalls(g, W, H, place, pj, { cafe, weather, t, drawView }) {
  const { P, floorTop, T } = pj, wallH = floorTop - H * 0.07;
  const a = P(0, 0), b = P(100, 0), c = P(100, 100), d = P(0, 100), up = (p, h = wallH) => ({ x: p.x, y: p.y - h * p.k / 0.72 });
  // 왼쪽 벽
  quad(g, up(d), up(a), a, d); g.fillStyle = lin(g, d.x, 0, a.x, 0, [[0, shade(T.side.startsWith('#') ? T.side : '#888888', 0.8)], [1, T.side]]); g.fill();
  // 오른쪽 벽
  quad(g, up(b), up(c), c, b); g.fillStyle = lin(g, c.x, 0, b.x, 0, [[0, shade(T.side, 0.72)], [1, shade(T.side, 0.95)]]); g.fill();
  // 뒤 벽
  quad(g, up(a), up(b), b, a); g.fillStyle = lin(g, 0, a.y - wallH, 0, a.y, [[0, shade(T.wall, 1.04)], [1, T.wall]]); g.fill();
  // 왼쪽 벽 창: 바깥 풍경
  const wa = P(0, 24), wb = P(0, 88);
  const q1 = { x: wa.x, y: wa.y - wallH * wa.k / 0.72 * 0.86 }, q2 = { x: wb.x, y: wb.y - wallH * wb.k / 0.72 * 0.86 }, q3 = { x: wb.x, y: wb.y - wallH * wb.k / 0.72 * 0.2 }, q4 = { x: wa.x, y: wa.y - wallH * wa.k / 0.72 * 0.2 };
  g.save(); quad(g, q1, q2, q3, q4); g.clip();
  const top = Math.min(q1.y, q2.y), bot = Math.max(q3.y, q4.y);
  drawView(g, Math.min(q1.x, q2.x), top, Math.abs(q2.x - q1.x) + 2, bot - top);
  if (weather === 'rain') { g.strokeStyle = 'rgba(230,240,250,.5)'; g.lineWidth = 1; for (let i = 0; i < 18; i++) { const px = Math.min(q1.x, q2.x) + (i * 37.7 % Math.abs(q2.x - q1.x)), py = top + ((i * 61 + t * 300) % (bot - top)); g.beginPath(); g.moveTo(px, py); g.lineTo(px - 1, py + 9); g.stroke(); } }
  g.restore();
  quad(g, q1, q2, q3, q4); g.strokeStyle = T.trim; g.lineWidth = 3; g.stroke();
  const n = 3;
  g.lineWidth = 2; for (let i = 1; i < n; i++) { const f = i / n, m1 = { x: q1.x + (q2.x - q1.x) * f, y: q1.y + (q2.y - q1.y) * f }, m2 = { x: q4.x + (q3.x - q4.x) * f, y: q4.y + (q3.y - q4.y) * f }; g.beginPath(); g.moveTo(m1.x, m1.y); g.lineTo(m2.x, m2.y); g.stroke(); }
  // 뒤 벽 선반과 간판
  const shelfY = a.y - wallH * 0.55, lx = a.x + (b.x - a.x) * 0.1, rx = a.x + (b.x - a.x) * 0.9;
  for (const sy of [shelfY, shelfY + wallH * 0.24]) {
    g.fillStyle = place === 'home' ? '#7b5a3d' : '#1e1817'; g.fillRect(lx, sy, rx - lx, 3);
    for (let i = 0; i < 11; i++) {
      const jx = lx + 8 + i * (rx - lx - 16) / 10;
      if (i % 2) { g.fillStyle = 'rgba(245,236,219,.92)'; rr(g, jx - 4, sy - 7, 8, 7, 1.5); g.fill(); } else { g.fillStyle = ['#5a3a22', '#7a5233', '#3f2a1a'][i % 3]; rr(g, jx - 4, sy - 12, 8, 12, 1.5); g.fill(); g.fillStyle = 'rgba(240,226,198,.8)'; g.fillRect(jx - 4, sy - 13, 8, 2); }
    }
  }
  if (cafe) {
    g.font = font(Math.min(16, W * 0.042), 800);
    const tw = Math.min(rx - lx, g.measureText(cafe).width + 26), sx = (a.x + b.x) / 2 - tw / 2, sy = a.y - wallH * 0.93;
    g.fillStyle = '#2b1c13'; rr(g, sx, sy, tw, 26, 6); g.fill();
    g.fillStyle = '#f4d8a4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cafe, sx + tw / 2, sy + 13.5, tw - 8);
  }
  // 조명
  for (const fx of [0.25, 0.75]) {
    const lx2 = a.x + (b.x - a.x) * fx, ly = a.y - wallH * 0.42 + 60;
    g.fillStyle = rad(g, lx2, ly, 2, W * 0.38, [[0, 'rgba(255,214,150,.2)'], [1, 'rgba(255,214,150,0)']]); circle(g, lx2, ly, W * 0.38); g.fill();
  }
}
function officeWindow(g, x, y, w, h) {
  g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#b8cdd8'], [1, '#d7d5ca']]); g.fillRect(x, y, w, h);
  const cols = [['#a33d32', '국'], ['#2f6b5a', '밥'], ['#c2862b', '분'], ['#39597f', '식']];
  cols.forEach(([c, tx], i) => { const bw = w / 4; g.fillStyle = '#8f8176'; g.fillRect(x + i * bw, y + h * 0.1, bw - 1, h * 0.9); g.fillStyle = c; g.fillRect(x + i * bw + 1, y + h * 0.5, bw - 3, h * 0.26); g.fillStyle = '#fff'; g.font = font(9, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, x + i * bw + bw / 2, y + h * 0.64); });
}
function homeWindow(g, x, y, w, h) {
  g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#bfe0ee'], [1, '#eef1d9']]); g.fillRect(x, y, w, h);
  g.fillStyle = '#7ca76b';
  for (const [fx, fy, r] of [[0.2, 0.52, 0.3], [0.55, 0.6, 0.34], [0.85, 0.5, 0.26]]) { circle(g, x + w * fx, y + h * fy, h * r); g.fill(); }
  g.fillStyle = '#c5b8a3'; g.fillRect(x, y + h * 0.8, w, h * 0.2);
}
function drawStool(g, p, s) { g.fillStyle = '#25201c'; g.fillRect(p.x - 1.5, p.y - s * 0.5, 3, s * 0.5); g.fillStyle = '#7a4f33'; g.beginPath(); g.ellipse(p.x, p.y - s * 0.52, s * 0.26, s * 0.09, 0, 0, TAU); g.fill(); }
function drawChair(g, p, s, wood) { g.fillStyle = shade(wood, 0.8); g.beginPath(); g.ellipse(p.x, p.y - s * 0.4, s * 0.27, s * 0.12, 0, 0, TAU); g.fill(); g.fillStyle = shade(wood, 0.6); g.fillRect(p.x - s * 0.2, p.y - s * 0.4, 2, s * 0.4); g.fillRect(p.x + s * 0.2 - 2, p.y - s * 0.4, 2, s * 0.4); }
function drawTable(g, p, s, wood, cupOn) {
  g.fillStyle = 'rgba(20,10,5,.2)'; g.beginPath(); g.ellipse(p.x, p.y + 2, s * 0.56, s * 0.17, 0, 0, TAU); g.fill();
  g.fillStyle = '#3a2a20'; g.fillRect(p.x - 2, p.y - s * 0.56, 4, s * 0.56);
  g.fillStyle = lin(g, p.x - s * 0.6, 0, p.x + s * 0.6, 0, [[0, wood], [1, shade(wood, 0.8)]]); g.beginPath(); g.ellipse(p.x, p.y - s * 0.58, s * 0.58, s * 0.2, 0, 0, TAU); g.fill();
  if (cupOn) { g.fillStyle = '#f7f0e2'; g.beginPath(); g.ellipse(p.x - s * 0.14, p.y - s * 0.64, s * 0.09, s * 0.05, 0, 0, TAU); g.fill(); }
}
function drawCounter(g, place, pj, H) {
  const { P, T } = pj, x0 = place === 'office' ? 16 : 30, x1 = place === 'office' ? 96 : 96, y0 = 13, y1 = 18;
  const a = P(x0, y0), b = P(x1, y0), c = P(x1, y1), d = P(x0, y1), h = H * 0.052;
  quad(g, c, d, { x: d.x, y: d.y + h }, { x: c.x, y: c.y + h }); g.fillStyle = lin(g, 0, d.y, 0, d.y + h, [[0, T.counter], [1, shade(T.counter, 0.68)]]); g.fill();
  quad(g, a, b, c, d); g.fillStyle = T.counterTop; g.fill();
  // 위의 소품: 머신·그라인더·계산대
  const mid = (fx) => ({ x: d.x + (c.x - d.x) * fx, y: (a.y + d.y) / 2 });
  const m = mid(place === 'office' ? 0.78 : 0.82), s = H * 0.03;
  g.fillStyle = lin(g, m.x - s, 0, m.x + s, 0, [[0, '#858a88'], [0.5, '#d8dbda'], [1, '#6f7372']]); rr(g, m.x - s * 1.4, m.y - s * 1.5, s * 2.8, s * 1.5, 3); g.fill();
  g.fillStyle = '#252525'; g.fillRect(m.x - s, m.y - s * 0.65, s * 2, s * 0.35);
  const n = mid(place === 'office' ? 0.56 : 0.6);
  g.fillStyle = '#2e2b2a'; rr(g, n.x - s * 0.34, n.y - s * 1.22, s * 0.68, s * 1.22, 2); g.fill(); g.fillStyle = 'rgba(214,226,226,.6)'; g.beginPath(); g.moveTo(n.x - s * 0.34, n.y - s * 1.22); g.lineTo(n.x - s * 0.5, n.y - s * 1.8); g.lineTo(n.x + s * 0.5, n.y - s * 1.8); g.lineTo(n.x + s * 0.34, n.y - s * 1.22); g.fill();
  const reg = P(FLOORS[place].order.x, 15.5);
  g.fillStyle = '#2a2523'; rr(g, reg.x - s * 0.5, reg.y - s * 0.72, s, s * 0.7, 2); g.fill(); g.fillStyle = '#a8d8c2'; g.fillRect(reg.x - s * 0.36, reg.y - s * 0.62, s * 0.72, s * 0.32);
}
function plant(g, p, s) {
  g.fillStyle = '#a0683f'; g.beginPath(); g.moveTo(p.x - s * 0.24, p.y - s * 0.34); g.lineTo(p.x + s * 0.24, p.y - s * 0.34); g.lineTo(p.x + s * 0.17, p.y); g.lineTo(p.x - s * 0.17, p.y); g.fill();
  g.fillStyle = '#5f8f57'; for (const [dx, dy, r] of [[-0.14, -0.58, 0.2], [0.14, -0.62, 0.2], [0, -0.84, 0.22]]) { circle(g, p.x + s * dx, p.y + s * dy, s * r); g.fill(); }
}
// staff: 카운터 뒤 사람들 [{ person, apron }], ownerSit: 손님 자리에 앉은 사장님
export function drawInside(g, W, H, { place, cafe, F, t, weather = 'sun', staff = [], ownerSit = null }) {
  const pj = projector(place, W, H), { P, floorBot, T } = pj, L = FLOORS[place];
  g.fillStyle = '#20150f'; g.fillRect(0, 0, W, H);
  drawWalls(g, W, H, place, pj, { cafe, weather, t, drawView: place === 'office' ? officeWindow : homeWindow });
  drawFloorSurface(g, place, pj);
  const unit = H * 0.054, people = H * 0.041; // 맨 앞(k=1)에서 가구와 사람 크기
  // 카운터 뒤 직원
  staff.forEach((st, i) => {
    const p = P(L.order.x + (i === 0 ? 0 : 22), 9);
    drawChibi(g, p.x, p.y, people * p.k, st.person, { apron: true, phase: t * 2, dir: i ? -1 : 1 });
  });
  drawCounter(g, place, pj, H);
  // 앞뒤 정렬해서 그린다
  const items = [];
  const wood = place === 'home' ? '#c99a6b' : '#6b4c36';
  L.seats.forEach((seat, i) => { const s = P(seat.x, seat.y); items.push({ y: seat.y - 0.5, draw: () => (seat.bar ? drawStool(g, s, unit * s.k) : drawChair(g, s, unit * s.k, wood)) }); });
  // 테이블(자리 중복 없이)
  const seen = new Set();
  L.seats.forEach((seat) => {
    if (!seat.table) return;
    const k = `${seat.table.x},${seat.table.y}`;
    if (seen.has(k)) return; seen.add(k);
    const s = P(seat.table.x, seat.table.y);
    const occupied = F.people.some((c) => c.state === 'sit' && L.seats[c.seat]?.table === seat.table);
    const tb = seat.table;
    items.push({ y: tb.y, draw: () => drawTable(g, s, unit * s.k, wood, occupied) });
  });
  if (place === 'office') { // 창가 긴 바 테이블
    items.push({ y: 34, draw: () => { const a = P(4, 36), b = P(11, 36), c = P(11, 84), d = P(4, 84); quad(g, { x: a.x, y: a.y - unit * 0.62 * a.k }, { x: b.x, y: b.y - unit * 0.62 * b.k }, { x: c.x, y: c.y - unit * 0.62 * c.k }, { x: d.x, y: d.y - unit * 0.62 * d.k }); g.fillStyle = wood; g.fill(); g.strokeStyle = '#2d1f15'; g.lineWidth = 1.5; g.stroke(); } });
  } else {
    for (const [x, y] of [[4, 27], [96, 27], [96, 96], [4, 96]]) { const s = P(x, y); items.push({ y, draw: () => plant(g, s, unit * s.k * 1.05) }); }
  }
  if (ownerSit) { const s = P(ownerSit.seat.x, ownerSit.seat.y); items.push({ y: ownerSit.seat.y + 0.1, draw: () => drawChibi(g, s.x, s.y, people * s.k * 0.95, ownerSit.person, { sit: true, cup: true, dir: ownerSit.seat.x < 50 ? 1 : -1 }) }); }
  for (const c of F.people) {
    const s = P(c.x, c.y), sit = c.state === 'sit';
    items.push({ y: c.y + 0.2, draw: () => drawChibi(g, s.x, s.y, people * s.k * (sit ? 0.95 : 1), c.look, { moving: c.path.length > 0, phase: c.phase, sit, cup: c.cup, dir: c.dir || 1, alpha: c.y > 95 ? Math.max(0, (100 - c.y) / 5) : 1 }) });
  }
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
  // 앞벽(잘라낸 단면)과 문
  const doorP = P(L.door.x, 100), a = P(0, 100), b = P(100, 100), dw = W * 0.11, bh = H - floorBot;
  g.fillStyle = lin(g, 0, floorBot, 0, H, [[0, shade(T.side, 0.62)], [1, shade(T.side, 0.45)]]);
  g.fillRect(0, floorBot, doorP.x - dw, bh); g.fillRect(doorP.x + dw, floorBot, W - doorP.x - dw, bh);
  g.fillStyle = '#c5b8a3'; g.fillRect(doorP.x - dw, floorBot, dw * 2, bh);
  g.fillStyle = 'rgba(255,240,200,.3)'; g.fillRect(doorP.x - dw, floorBot, dw * 2, 5);
  g.strokeStyle = T.trim; g.lineWidth = 3; g.strokeRect(doorP.x - dw, floorBot + 1, dw * 2, bh);
  g.fillStyle = '#f4e8d0'; g.font = font(11, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#4b3a2a'; g.fillText('입구', doorP.x, floorBot + bh / 2);
  void a; void b;
}

// ── 외관 ───────────────────────────────────
function aBoard(g, x, y, s, cafe) {
  g.fillStyle = '#3a2a1f'; g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.36, y - s * 1.3); g.lineTo(x + s * 0.36, y - s * 1.3); g.lineTo(x + s * 0.5, y); g.closePath(); g.fill();
  g.fillStyle = '#26332e'; g.beginPath(); g.moveTo(x - s * 0.4, y - s * 0.2); g.lineTo(x - s * 0.3, y - s * 1.2); g.lineTo(x + s * 0.3, y - s * 1.2); g.lineTo(x + s * 0.4, y - s * 0.2); g.closePath(); g.fill();
  g.fillStyle = '#f2ead6'; g.font = font(s * 0.25, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('오늘의', x, y - s * 0.86); g.fillText('커피', x, y - s * 0.55);
  void cafe;
}
function potPlant(g, x, y, s) {
  g.fillStyle = '#9d623a'; g.beginPath(); g.moveTo(x - s * 0.36, y - s * 0.46); g.lineTo(x + s * 0.36, y - s * 0.46); g.lineTo(x + s * 0.26, y); g.lineTo(x - s * 0.26, y); g.fill();
  g.fillStyle = '#5f8f57'; for (const [dx, dy, r] of [[-0.22, -0.78, 0.28], [0.22, -0.8, 0.28], [0, -1.08, 0.3]]) { circle(g, x + s * dx, y + s * dy, s * r); g.fill(); }
}
function lamp(g, x, y, h, on) {
  g.fillStyle = '#2c2b2c'; g.fillRect(x - 2, y - h, 4, h);
  g.fillStyle = on ? '#ffe7b0' : '#d8d3c6'; circle(g, x, y - h, 9); g.fill();
  if (on) { g.fillStyle = rad(g, x, y - h, 2, 60, [[0, 'rgba(255,220,150,.42)'], [1, 'rgba(255,220,150,0)']]); circle(g, x, y - h, 60); g.fill(); }
}
// 지나가는 사람과 문으로 들어가는 사람. t로만 정해지는 움직임이라 저장할 것이 없다
function outsideWalkers(g, W, H, place, t, looks) {
  const groundY = H * 0.77, doorX = W * 0.74, n = place === 'office' ? 6 : 3, unit = H * 0.045, list = [];
  for (let i = 0; i < n; i++) {
    const dur = (place === 'office' ? 8 : 13) + i * 1.3, u = ((t + i * 3.1) / dur) % 1, look = looks[i % looks.length], laneY = groundY + H * (0.03 + (i % 3) * 0.055);
    const fromLeft = i % 2 === 0;
    if (i % 3 === 0) { // 문으로 들어간다
      const s0 = fromLeft ? -0.08 * W : W * 1.08;
      if (u < 0.72) { const f = u / 0.72, x = s0 + (doorX - s0) * f; list.push({ x, y: laneY, look, phase: t * 9 + i, moving: true, dir: fromLeft ? 1 : -1 }); } else if (u < 0.86) { const f = (u - 0.72) / 0.14; list.push({ x: doorX, y: laneY + (groundY + 2 - laneY) * f, look, phase: t * 9 + i, moving: true, alpha: 1 - Math.max(0, f - 0.6) / 0.4, dir: 1 }); }
    } else if (i % 3 === 1) { // 컵을 들고 나온다
      if (u < 0.14) { const f = u / 0.14; list.push({ x: doorX, y: groundY + 2 + (laneY - groundY - 2) * f, look, phase: t * 9 + i, moving: true, cup: true, alpha: Math.min(1, f / 0.4), dir: 1 }); } else if (u < 0.8) { const f = (u - 0.14) / 0.66, e = fromLeft ? W * 1.1 : -0.1 * W; list.push({ x: doorX + (e - doorX) * f, y: laneY, look, phase: t * 9 + i, moving: true, cup: true, dir: e > doorX ? 1 : -1 }); }
    } else { // 그냥 지나간다
      const a = fromLeft ? -0.1 * W : 1.1 * W, b = fromLeft ? 1.1 * W : -0.1 * W;
      list.push({ x: a + (b - a) * u, y: laneY, look, phase: t * 9 + i, moving: true, dir: fromLeft ? 1 : -1 });
    }
  }
  list.sort((p, q) => p.y - q.y).forEach((p) => drawChibi(g, p.x, p.y, unit, p.look, p));
}
export function drawOutside(g, W, H, { place, cafe, t, weather = 'sun', looks }) {
  shopFront(g, W, H, { place, cafe, t, weather });
  const groundY = H * 0.77, s = H * 0.05;
  // 인도 무늬
  g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const y = groundY + (H - groundY) * i / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let i = 0; i < 9; i++) { const x = W * i / 8; g.beginPath(); g.moveTo(x, groundY); g.lineTo(x, H); g.stroke(); }
  if (place === 'office') {
    aBoard(g, W * 0.56, groundY + 10, s, cafe);
    lamp(g, W * 0.06, groundY + 6, H * 0.34, weather === 'rain');
  } else {
    aBoard(g, W * 0.54, groundY + 10, s, cafe);
    potPlant(g, W * 0.16, groundY + 8, s * 0.95);
    potPlant(g, W * 0.92, groundY + 8, s * 0.95);
    // 작은 벤치
    g.fillStyle = '#7a5a3d'; g.fillRect(W * 0.24, groundY - s * 0.26, W * 0.2, 6); g.fillRect(W * 0.26, groundY - s * 0.26, 5, s * 0.4); g.fillRect(W * 0.42, groundY - s * 0.26, 5, s * 0.4);
  }
  outsideWalkers(g, W, H, place, t, looks);
}
