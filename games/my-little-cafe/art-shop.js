// 가게 외관과 점내 구조. 손님 움직임은 floor.js가 정하고 여기는 그리기만 한다.
import { rr, circle, lin, font, TAU, drawFront } from './art.js';
import { img } from './assets.js';
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
  g.strokeStyle = 'rgba(32,20,14,.75)'; g.lineWidth = Math.max(0.8, s * 0.045); g.stroke();
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
  g.strokeStyle = 'rgba(32,20,14,.75)'; g.lineWidth = Math.max(0.8, s * 0.045); g.stroke();
  g.fillStyle = 'rgba(150,80,60,.14)'; g.beginPath(); g.arc(x, headY, s * 0.42, 0.2, Math.PI - 0.2); g.fill();
  g.fillStyle = look.hair;
  g.beginPath(); g.arc(x, headY - s * 0.04, s * 0.45, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(x, headY - s * 0.2, x - s * 0.45, headY - s * 0.02); g.fill();
  if (look.style === 'bob' || look.style === 'long' || look.style === 'oldF') { const l = look.style === 'long' ? 0.72 : 0.36; g.fillRect(x - s * 0.46, headY - s * 0.06, s * 0.15, s * l); g.fillRect(x + s * 0.31, headY - s * 0.06, s * 0.15, s * l); }
  if (look.style === 'oldF') { circle(g, x, headY - s * 0.5, s * 0.16); g.fill(); }
  g.fillStyle = '#2a1f1b'; circle(g, x - s * 0.15 + dir * s * 0.05, headY + s * 0.05, s * 0.05); g.fill(); circle(g, x + s * 0.15 + dir * s * 0.05, headY + s * 0.05, s * 0.05); g.fill();
  if (look.glasses) { g.strokeStyle = '#4e3b2c'; g.lineWidth = s * 0.03; circle(g, x - s * 0.15 + dir * s * 0.05, headY + s * 0.05, s * 0.1); g.stroke(); circle(g, x + s * 0.15 + dir * s * 0.05, headY + s * 0.05, s * 0.1); g.stroke(); }
  g.restore();
}

// ── 점내 ───────────────────────────────────
// 방 그림은 코드 배치도를 참고해 다시 그렸다. 화면에 꽉 채우면 floor.js 좌표와 맞는다
function projector(place, W, H) {
  const T = { office: { width: 0.9, top: 0.31 }, home: { width: 1.08, top: 0.31 } }[place];
  const floorTop = H * T.top, floorBot = H * 0.885, wf = W * T.width;
  const P = (x, y) => { const v = y / 100, k = 0.72 + 0.28 * v; return { x: W / 2 + (x - 50) / 100 * wf * k, y: floorTop + (floorBot - floorTop) * v, k }; };
  return { P, floorTop, floorBot };
}
// staff: 카운터 뒤 사람들 [{ person }], ownerSit: 손님 자리에 앉은 사장님
export function drawInside(g, W, H, { place, cafe, F, t, staff = [], ownerSit = null }) {
  const { P, floorTop } = projector(place, W, H), L = FLOORS[place], room = img(`room-${place}`);
  g.fillStyle = '#20150f'; g.fillRect(0, 0, W, H);
  if (room) g.drawImage(room, 0, 0, W, H);
  const people = H * 0.041;
  // 카운터 뒤 직원은 카운터에 가려진다
  const cy = P(50, 15).y;
  g.save(); g.beginPath(); g.rect(0, 0, W, cy); g.clip();
  staff.forEach((st, i) => {
    const p = P(L.order.x + (i === 0 ? 0 : 22), 9);
    drawChibi(g, p.x, p.y, people * p.k, st.person, { apron: true, phase: t * 2, dir: i ? -1 : 1 });
  });
  g.restore();
  // 앞뒤 정렬해서 그린다
  const items = [];
  if (ownerSit) { const s = P(ownerSit.seat.x, ownerSit.seat.y); items.push({ y: ownerSit.seat.y + 0.1, draw: () => drawChibi(g, s.x, s.y, people * s.k * 0.95, ownerSit.person, { sit: true, cup: true, dir: ownerSit.seat.x < 50 ? 1 : -1 }) }); }
  for (const c of F.people) {
    const s = P(c.x, c.y), sit = c.state === 'sit';
    items.push({ y: c.y + 0.2, draw: () => drawChibi(g, s.x, s.y, people * s.k * (sit ? 0.95 : 1), c.look, { moving: c.path.length > 0, phase: c.phase, sit, cup: c.cup, dir: c.dir || 1, alpha: c.y > 95 ? Math.max(0, (100 - c.y) / 5) : 1 }) });
  }
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
  // 벽의 카페 이름
  if (cafe) {
    g.font = font(Math.min(15, W * 0.04), 800);
    const tw = Math.min(W * 0.6, g.measureText(cafe).width + 24), y = Math.max(46, floorTop * 0.28);
    g.fillStyle = '#2b1c13'; rr(g, W / 2 - tw / 2, y, tw, 25, 6); g.fill();
    g.fillStyle = '#f4d8a4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cafe, W / 2, y + 13, tw - 8);
  }
}

// ── 외관 ───────────────────────────────────
// 지나가는 사람과 문으로 들어가는 사람. t로만 정해지는 움직임이라 저장할 것이 없다
function outsideWalkers(g, W, H, place, t, looks, c) {
  const groundY = c ? c.y(place === 'office' ? 0.79 : 0.8) : H * 0.8, doorX = c ? c.x(place === 'office' ? 0.62 : 0.68) : W * 0.68, n = place === 'office' ? 6 : 3, unit = H * 0.05, list = [];
  for (let i = 0; i < n; i++) {
    const dur = (place === 'office' ? 8 : 13) + i * 1.3, u = ((t + i * 3.1) / dur) % 1, look = looks[i % looks.length], laneY = groundY + H * (0.035 + (i % 3) * 0.05);
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
  const c = drawFront(g, W, H, { place, cafe, t, weather });
  outsideWalkers(g, W, H, place, t, looks, c);
}
