// 인물·카페·이야기 그림. 파일 없이 캔버스로 그린다. 좌표는 CSS 픽셀(W×H).
import { PEOPLE, PLACES } from './data.js';

export const TAU = Math.PI * 2;
export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
export function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
export function lin(g, x0, y0, x1, y1, stops) {
  const f = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => f.addColorStop(o, c));
  return f;
}
export function rad(g, x, y, r0, r1, stops) {
  const f = g.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([o, c]) => f.addColorStop(o, c));
  return f;
}
const FONT = 'system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
export const font = (px, w = 600) => `${w} ${px}px ${FONT}`;
const noise = (i) => { const x = Math.sin(i * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); };
// 색을 밝게/어둡게
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (c) => Math.round(Math.max(0, Math.min(255, c * k)));
  return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
}

// ── 인물 ───────────────────────────────────
// cx: 가운데, by: 그림 아래 끝(카운터 뒤로 숨는 자리), s: 얼굴 반지름
export function drawPerson(g, p, cx, by, s, { mood = 'calm', t = 0, apron = false, suit = false, badge = false, look = 0 } = {}) {
  const breath = Math.sin(t * 1.5 + cx) * s * 0.018;
  const headY = by - s * 3.15 + breath;
  const blink = Math.sin(t * 0.73 + cx * 0.3) > 0.985 || Math.sin(t * 0.21 + cx) > 0.997;
  g.save();
  // 몸
  const bodyCol = suit ? '#2d3545' : p.body;
  const shW = s * (p.style === 'oldF' || p.style === 'bob' || p.style === 'long' ? 1.72 : 1.95);
  g.fillStyle = lin(g, cx, by - s * 2, cx, by, [[0, shade(bodyCol, 1.06)], [1, shade(bodyCol, 0.8)]]);
  g.beginPath();
  g.moveTo(cx - shW - s * 0.2, by);
  g.bezierCurveTo(cx - shW - s * 0.2, by - s * 1.3, cx - shW + s * 0.15, by - s * 1.72 + breath, cx - s * 0.5, by - s * 1.86 + breath);
  g.lineTo(cx + s * 0.5, by - s * 1.86 + breath);
  g.bezierCurveTo(cx + shW - s * 0.15, by - s * 1.72 + breath, cx + shW + s * 0.2, by - s * 1.3, cx + shW + s * 0.2, by);
  g.closePath(); g.fill();
  // 셔츠 깃과 넥타이
  if (suit || p.tie) {
    g.fillStyle = '#f4f1ea';
    g.beginPath(); g.moveTo(cx - s * 0.42, by - s * 1.84 + breath); g.lineTo(cx, by - s * 1.1); g.lineTo(cx + s * 0.42, by - s * 1.84 + breath); g.closePath(); g.fill();
    g.fillStyle = p.tie || '#3a4f6a';
    g.beginPath(); g.moveTo(cx - s * 0.1, by - s * 1.68 + breath); g.lineTo(cx + s * 0.1, by - s * 1.68 + breath); g.lineTo(cx + s * 0.16, by - s * 0.9); g.lineTo(cx, by - s * 0.72); g.lineTo(cx - s * 0.16, by - s * 0.9); g.closePath(); g.fill();
  }
  if (apron) {
    g.strokeStyle = '#4a3323'; g.lineWidth = s * 0.16;
    g.beginPath(); g.moveTo(cx - s * 0.68, by - s * 1.78); g.lineTo(cx - s * 0.6, by - s * 1.1); g.moveTo(cx + s * 0.68, by - s * 1.78); g.lineTo(cx + s * 0.6, by - s * 1.1); g.stroke();
    g.fillStyle = lin(g, cx, by - s * 1.2, cx, by, [[0, '#6a4a32'], [1, '#4f3625']]);
    rr(g, cx - s * 0.92, by - s * 1.16, s * 1.84, s * 1.3, s * 0.12); g.fill();
    g.strokeStyle = 'rgba(255,235,205,.25)'; g.lineWidth = 1; rr(g, cx - s * 0.84, by - s * 1.08, s * 1.68, s * 1.2, s * 0.08); g.stroke();
  }
  if (badge) {
    g.strokeStyle = '#3f6ea3'; g.lineWidth = s * 0.05;
    g.beginPath(); g.moveTo(cx - s * 0.32, by - s * 1.78); g.lineTo(cx - s * 0.05, by - s * 0.95); g.lineTo(cx + s * 0.32, by - s * 1.78); g.stroke();
    g.fillStyle = '#f7f4ee'; rr(g, cx - s * 0.26, by - s * 0.98, s * 0.5, s * 0.62, s * 0.05); g.fill();
    g.fillStyle = '#b8c4d2'; rr(g, cx - s * 0.17, by - s * 0.9, s * 0.32, s * 0.26, s * 0.03); g.fill();
  }
  // 목
  g.fillStyle = shade(p.skin, 0.88); rr(g, cx - s * 0.32, headY + s * 0.7, s * 0.64, s * 0.75, s * 0.14); g.fill();
  if (p.style === 'long') hairBack(g, p, cx, headY, s, 1.22);
  if (p.style === 'bob') hairBack(g, p, cx, headY, s, 0.76);
  if (p.style === 'oldF') { g.fillStyle = shade(p.hair, 0.92); circle(g, cx, headY - s * 1.18, s * 0.42); g.fill(); }
  // 귀
  g.fillStyle = shade(p.skin, 0.94);
  if (p.style !== 'long' && p.style !== 'bob') { circle(g, cx - s * 0.92, headY + s * 0.08, s * 0.17); g.fill(); circle(g, cx + s * 0.92, headY + s * 0.08, s * 0.17); g.fill(); }
  // 얼굴
  g.fillStyle = rad(g, cx - s * 0.2, headY - s * 0.2, s * 0.15, s * 1.25, [[0, shade(p.skin, 1.06)], [1, p.skin]]);
  g.beginPath();
  g.moveTo(cx - s * 0.93, headY - s * 0.15);
  g.bezierCurveTo(cx - s * 0.93, headY - s * 1.12, cx + s * 0.93, headY - s * 1.12, cx + s * 0.93, headY - s * 0.15);
  g.bezierCurveTo(cx + s * 0.93, headY + s * 0.62, cx + s * 0.42, headY + s * 1.0, cx, headY + s * 1.03);
  g.bezierCurveTo(cx - s * 0.42, headY + s * 1.0, cx - s * 0.93, headY + s * 0.62, cx - s * 0.93, headY - s * 0.15);
  g.closePath(); g.fill();
  // 볼
  g.fillStyle = 'rgba(232,120,105,.16)'; circle(g, cx - s * 0.56, headY + s * 0.3, s * 0.21); g.fill(); circle(g, cx + s * 0.56, headY + s * 0.3, s * 0.21); g.fill();
  // 머리
  hairFront(g, p, cx, headY, s);
  // 눈
  const ex = s * 0.38, ey = headY + s * 0.03, lx = look * s * 0.05;
  const eyeCol = '#2a1f1b';
  if (blink || mood === 'closed') {
    g.strokeStyle = eyeCol; g.lineWidth = s * 0.055; g.lineCap = 'round';
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * ex - s * 0.11, ey); g.quadraticCurveTo(cx + d * ex, ey + s * 0.07, cx + d * ex + s * 0.11, ey); g.stroke(); }
  } else if (mood === 'smile') {
    g.strokeStyle = eyeCol; g.lineWidth = s * 0.065; g.lineCap = 'round';
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * ex - s * 0.13, ey + s * 0.03); g.quadraticCurveTo(cx + d * ex, ey - s * 0.11, cx + d * ex + s * 0.13, ey + s * 0.03); g.stroke(); }
  } else {
    const er = mood === 'surprised' ? s * 0.125 : s * 0.1;
    g.fillStyle = eyeCol;
    for (const d of [-1, 1]) {
      g.beginPath(); g.ellipse(cx + d * ex + lx, ey, er * 0.9, er * 1.14, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; circle(g, cx + d * ex + lx + er * 0.25, ey - er * 0.35, er * 0.25); g.fill(); g.fillStyle = eyeCol;
    }
  }
  // 다크서클
  if (p.tired || mood === 'tired') {
    g.strokeStyle = 'rgba(104,80,110,.32)'; g.lineWidth = s * 0.06; g.lineCap = 'round';
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * ex - s * 0.13, ey + s * 0.2); g.quadraticCurveTo(cx + d * ex, ey + s * 0.27, cx + d * ex + s * 0.13, ey + s * 0.2); g.stroke(); }
  }
  // 눈썹
  g.strokeStyle = shade(p.hair, p.age >= 60 ? 0.75 : 0.9); g.lineWidth = s * (p.age >= 60 ? 0.09 : 0.065); g.lineCap = 'round';
  const browUp = mood === 'surprised' ? s * 0.1 : 0, browTilt = mood === 'tired' || p.tired ? 0.07 : mood === 'sad' ? 0.09 : 0;
  for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * (ex - s * 0.17), ey - s * 0.26 - browUp - browTilt * s * 0.0 - s * browTilt); g.lineTo(cx + d * (ex + s * 0.16), ey - s * 0.25 - browUp + s * browTilt); g.stroke(); }
  // 코
  g.strokeStyle = shade(p.skin, 0.74); g.lineWidth = s * 0.045; g.beginPath(); g.moveTo(cx - s * 0.03, headY + s * 0.28); g.quadraticCurveTo(cx + s * 0.07, headY + s * 0.38, cx - s * 0.03, headY + s * 0.42); g.stroke();
  // 입
  g.strokeStyle = '#8b4a3f'; g.lineWidth = s * 0.05;
  if (mood === 'smile' || mood === 'closed') { g.beginPath(); g.moveTo(cx - s * 0.2, headY + s * 0.58); g.quadraticCurveTo(cx, headY + s * 0.76, cx + s * 0.2, headY + s * 0.58); g.stroke(); }
  else if (mood === 'surprised') { g.fillStyle = '#8b4a3f'; g.beginPath(); g.ellipse(cx, headY + s * 0.65, s * 0.09, s * 0.12, 0, 0, TAU); g.fill(); }
  else if (mood === 'tired' || mood === 'sad') { g.beginPath(); g.moveTo(cx - s * 0.15, headY + s * 0.65); g.quadraticCurveTo(cx, headY + s * 0.6, cx + s * 0.15, headY + s * 0.65); g.stroke(); }
  else { g.beginPath(); g.moveTo(cx - s * 0.15, headY + s * 0.62); g.quadraticCurveTo(cx, headY + s * 0.68, cx + s * 0.15, headY + s * 0.62); g.stroke(); }
  // 주름과 수염
  if (p.age >= 60) {
    g.strokeStyle = shade(p.skin, 0.78); g.lineWidth = s * 0.03;
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * s * 0.3, headY + s * 0.42); g.quadraticCurveTo(cx + d * s * 0.38, headY + s * 0.58, cx + d * s * 0.32, headY + s * 0.7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - s * 0.28, headY - s * 0.5); g.quadraticCurveTo(cx, headY - s * 0.56, cx + s * 0.28, headY - s * 0.5); g.stroke();
  }
  if (p.mustache) {
    g.fillStyle = p.hair;
    g.beginPath(); g.moveTo(cx, headY + s * 0.46); g.bezierCurveTo(cx - s * 0.13, headY + s * 0.4, cx - s * 0.33, headY + s * 0.47, cx - s * 0.36, headY + s * 0.59); g.bezierCurveTo(cx - s * 0.2, headY + s * 0.56, cx - s * 0.08, headY + s * 0.58, cx, headY + s * 0.53);
    g.bezierCurveTo(cx + s * 0.08, headY + s * 0.58, cx + s * 0.2, headY + s * 0.56, cx + s * 0.36, headY + s * 0.59); g.bezierCurveTo(cx + s * 0.33, headY + s * 0.47, cx + s * 0.13, headY + s * 0.4, cx, headY + s * 0.46); g.fill();
  }
  if (p.glasses) {
    g.strokeStyle = '#4e3b2c'; g.lineWidth = s * 0.05;
    for (const d of [-1, 1]) { rr(g, cx + d * ex - s * 0.24, ey - s * 0.17, s * 0.48, s * 0.36, s * 0.13); g.stroke(); }
    g.beginPath(); g.moveTo(cx - ex + s * 0.24, ey - s * 0.03); g.lineTo(cx + ex - s * 0.24, ey - s * 0.03); g.stroke();
  }
  g.restore();
}
function hairBack(g, p, cx, hy, s, len) {
  g.fillStyle = shade(p.hair, 0.88);
  g.beginPath();
  g.moveTo(cx - s * 1.04, hy - s * 0.2);
  g.bezierCurveTo(cx - s * 1.14, hy - s * 1.36, cx + s * 1.14, hy - s * 1.36, cx + s * 1.04, hy - s * 0.2);
  g.bezierCurveTo(cx + s * 1.12, hy + s * len * 0.6, cx + s * 1.1, hy + s * len, cx + s * 0.86, hy + s * len);
  g.lineTo(cx - s * 0.86, hy + s * len);
  g.bezierCurveTo(cx - s * 1.1, hy + s * len, cx - s * 1.12, hy + s * len * 0.6, cx - s * 1.04, hy - s * 0.2);
  g.closePath(); g.fill();
}
function hairFront(g, p, cx, hy, s) {
  g.fillStyle = lin(g, cx, hy - s * 1.2, cx, hy, [[0, shade(p.hair, 1.16)], [1, p.hair]]);
  const y = hy;
  switch (p.style) {
    case 'short':
      g.beginPath(); g.moveTo(cx - s * 0.97, y - s * 0.06); g.bezierCurveTo(cx - s * 1.08, y - s * 1.26, cx + s * 1.08, y - s * 1.26, cx + s * 0.97, y - s * 0.06);
      g.bezierCurveTo(cx + s * 0.8, y - s * 0.46, cx + s * 0.56, y - s * 0.56, cx + s * 0.34, y - s * 0.62); g.bezierCurveTo(cx, y - s * 0.56, cx - s * 0.4, y - s * 0.46, cx - s * 0.72, y - s * 0.46); g.bezierCurveTo(cx - s * 0.84, y - s * 0.38, cx - s * 0.9, y - s * 0.24, cx - s * 0.97, y - s * 0.06); g.fill();
      break;
    case 'mid':
      g.beginPath(); g.moveTo(cx - s * 1, y + s * 0.2); g.bezierCurveTo(cx - s * 1.14, y - s * 1.32, cx + s * 1.14, y - s * 1.32, cx + s * 1, y + s * 0.2);
      g.bezierCurveTo(cx + s * 0.88, y - s * 0.26, cx + s * 0.76, y - s * 0.4, cx + s * 0.6, y - s * 0.46); g.bezierCurveTo(cx + s * 0.3, y - s * 0.22, cx - s * 0.24, y - s * 0.26, cx - s * 0.46, y - s * 0.5); g.bezierCurveTo(cx - s * 0.74, y - s * 0.36, cx - s * 0.88, y - s * 0.2, cx - s * 1, y + s * 0.2); g.fill();
      break;
    case 'bob':
      g.beginPath(); g.moveTo(cx - s * 1.02, y + s * 0.62); g.bezierCurveTo(cx - s * 1.24, y - s * 1.62, cx + s * 1.24, y - s * 1.62, cx + s * 1.02, y + s * 0.62);
      g.bezierCurveTo(cx + s * 0.9, y + s * 0.28, cx + s * 0.82, y - s * 0.26, cx + s * 0.6, y - s * 0.36); g.bezierCurveTo(cx + s * 0.26, y - s * 0.44, cx - s * 0.24, y - s * 0.56, cx - s * 0.5, y - s * 0.6); g.bezierCurveTo(cx - s * 0.84, y - s * 0.28, cx - s * 0.88, y + s * 0.28, cx - s * 1.02, y + s * 0.62); g.fill();
      break;
    case 'long':
      g.beginPath(); g.moveTo(cx - s * 1, y + s * 0.8); g.bezierCurveTo(cx - s * 1.22, y - s * 1.68, cx + s * 1.22, y - s * 1.68, cx + s * 1, y + s * 0.8);
      g.bezierCurveTo(cx + s * 0.92, y + s * 0.2, cx + s * 0.76, y - s * 0.46, cx + s * 0.06, y - s * 0.7); g.bezierCurveTo(cx - s * 0.6, y - s * 0.46, cx - s * 0.92, y + s * 0.2, cx - s * 1, y + s * 0.8); g.fill();
      break;
    case 'oldM':
      g.beginPath(); g.moveTo(cx - s * 0.97, y - s * 0.02); g.bezierCurveTo(cx - s * 1.06, y - s * 1.08, cx - s * 0.2, y - s * 1.2, cx + s * 0.06, y - s * 1.12); g.bezierCurveTo(cx + s * 0.76, y - s * 1.1, cx + s * 1.04, y - s * 0.68, cx + s * 0.97, y - s * 0.02);
      g.bezierCurveTo(cx + s * 0.86, y - s * 0.34, cx + s * 0.74, y - s * 0.56, cx + s * 0.5, y - s * 0.68); g.bezierCurveTo(cx + s * 0.2, y - s * 0.78, cx - s * 0.34, y - s * 0.72, cx - s * 0.62, y - s * 0.62); g.bezierCurveTo(cx - s * 0.82, y - s * 0.44, cx - s * 0.92, y - s * 0.24, cx - s * 0.97, y - s * 0.02); g.fill();
      break;
    case 'oldF':
      g.beginPath(); g.moveTo(cx - s * 1, y + s * 0.02); g.bezierCurveTo(cx - s * 1.14, y - s * 1.28, cx + s * 1.14, y - s * 1.28, cx + s * 1, y + s * 0.02);
      g.bezierCurveTo(cx + s * 0.9, y - s * 0.38, cx + s * 0.6, y - s * 0.62, cx + s * 0.08, y - s * 0.72); g.bezierCurveTo(cx - s * 0.4, y - s * 0.62, cx - s * 0.88, y - s * 0.4, cx - s * 1, y + s * 0.02); g.fill();
      break;
    default:
  }
}
export const personOf = (id, choices) => {
  if (id === 'hero') return PEOPLE[`hero${choices.hero}`];
  if (id === 'owner') return PEOPLE[`owner${choices.owner}`];
  return PEOPLE[id];
};

// ── 가게 안 ────────────────────────────────
function rainOnGlass(g, x, y, w, h, t, strength = 1) {
  g.save(); rr(g, x, y, w, h, 3); g.clip();
  g.strokeStyle = 'rgba(230,240,250,.5)'; g.lineWidth = 1;
  for (let i = 0; i < 46 * strength; i++) {
    const sp = 330 + noise(i) * 240, px = x + noise(i + 9) * w, py = y + (noise(i + 40) * h + t * sp) % h;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px - 1.2, py + 8 + noise(i) * 8); g.stroke();
  }
  g.restore();
}
function officeView(g, x, y, w, h, t, weather) {
  const dark = weather === 'rain' ? 0.82 : 1;
  g.fillStyle = lin(g, x, y, x, y + h, [[0, shade('#b9d0de', dark)], [0.6, shade('#dfe5de', dark)], [1, shade('#c6bdb0', dark)]]);
  g.fillRect(x, y, w, h);
  // 맞은편 식당가: 건물 + 간판
  const cols = ['#a78770', '#8c7f7a', '#b49a7c', '#7f8c8d'];
  const signs = [['국밥', '#a33d32'], ['백반', '#2f6b5a'], ['분식', '#c2862b'], ['칼국수', '#39597f']];
  for (let i = 0; i < 4; i++) {
    const bx = x + (w / 4) * i + 1, bw = w / 4 - 2, bh = h * (0.68 + noise(i) * 0.14), by = y + h * 0.82 - bh;
    g.fillStyle = shade(cols[i], dark); g.fillRect(bx, by, bw, bh);
    g.fillStyle = 'rgba(60,70,80,.32)';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) g.fillRect(bx + 4 + c * (bw / 2), by + 6 + r * (bh * 0.2), bw / 2 - 8, bh * 0.12);
    g.fillStyle = signs[i][1]; g.fillRect(bx + 2, y + h * 0.6, bw - 4, h * 0.11);
    g.fillStyle = '#fff'; g.font = font(Math.min(11, bw * 0.28), 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(signs[i][0], bx + bw / 2, y + h * 0.655);
    g.fillStyle = '#463a34'; g.fillRect(bx + 3, y + h * 0.71, bw - 6, h * 0.11);
  }
  g.fillStyle = shade('#8b8680', dark); g.fillRect(x, y + h * 0.82, w, h * 0.18);
  // 지나가는 직장인
  for (let i = 0; i < 4; i++) {
    const px = x + ((noise(i + 4) * w + t * (14 + i * 6) * (i % 2 ? 1 : -1)) % w + w) % w, py = y + h * 0.9;
    g.fillStyle = ['#2c3343', '#444b5b', '#333', '#5a5560'][i];
    rr(g, px - 4, py - 17, 8, 18, 3); g.fill();
    g.fillStyle = '#e6c2a2'; circle(g, px, py - 21, 4); g.fill();
  }
}
function homeView(g, x, y, w, h, t, weather) {
  const dark = weather === 'rain' ? 0.82 : 1;
  g.fillStyle = lin(g, x, y, x, y + h, [[0, shade('#bfe0ee', dark)], [0.7, shade('#f0ecd8', dark)]]);
  g.fillRect(x, y, w, h);
  // 낮은 집들
  const houses = [[0.02, 0.42, '#d6b295', '#8c4a3a'], [0.32, 0.5, '#e3d6c3', '#4f6a7d'], [0.64, 0.38, '#c9a890', '#74503c']];
  for (const [fx, fh, wall, roof] of houses) {
    const bx = x + w * fx, bw = w * 0.34, by = y + h * (0.84 - fh), bh = h * fh;
    g.fillStyle = shade(wall, dark); g.fillRect(bx, by, bw, bh);
    g.fillStyle = shade(roof, dark); g.beginPath(); g.moveTo(bx - 4, by); g.lineTo(bx + bw / 2, by - h * 0.13); g.lineTo(bx + bw + 4, by); g.closePath(); g.fill();
    g.fillStyle = 'rgba(60,80,90,.45)'; g.fillRect(bx + bw * 0.2, by + bh * 0.2, bw * 0.24, bh * 0.28); g.fillRect(bx + bw * 0.56, by + bh * 0.2, bw * 0.24, bh * 0.28);
  }
  // 나무 + 길 + 자전거
  const sway = Math.sin(t * 0.8) * 2;
  g.fillStyle = '#6a4b35'; g.fillRect(x + w * 0.79, y + h * 0.42, 5, h * 0.42);
  g.fillStyle = shade('#6f9a62', dark);
  for (const [dx, dy, r] of [[0, 0.3, 0.16], [-0.07, 0.38, 0.12], [0.07, 0.4, 0.12]]) { circle(g, x + w * (0.8 + dx) + sway, y + h * dy, h * r); g.fill(); }
  g.fillStyle = shade('#a39b8e', dark); g.fillRect(x, y + h * 0.84, w, h * 0.16);
  g.strokeStyle = '#4a4a4a'; g.lineWidth = 1.4; const bx = x + w * 0.22, by = y + h * 0.88;
  circle(g, bx, by, 6); g.stroke(); circle(g, bx + 18, by, 6); g.stroke();
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 7, by - 9); g.lineTo(bx + 15, by - 9); g.lineTo(bx + 18, by); g.moveTo(bx + 7, by - 9); g.lineTo(bx + 9, by); g.lineTo(bx + 15, by - 9); g.stroke();
}
export function drawSiphon(g, x, y, s) {
  g.save(); g.translate(x, y);
  g.strokeStyle = 'rgba(230,240,240,.85)'; g.lineWidth = 1.5; g.fillStyle = 'rgba(210,235,240,.26)';
  circle(g, 0, 0, s * 0.42); g.fill(); g.stroke(); // 아래 플라스크
  g.beginPath(); g.moveTo(-s * 0.3, -s * 1.02); g.bezierCurveTo(-s * 0.36, -s * 0.72, -s * 0.15, -s * 0.56, -s * 0.05, -s * 0.46); g.lineTo(s * 0.05, -s * 0.46); g.bezierCurveTo(s * 0.15, -s * 0.56, s * 0.36, -s * 0.72, s * 0.3, -s * 1.02); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#6b4c34'; g.fillRect(-s * 0.32, -s * 1.08, s * 0.64, s * 0.08);
  g.strokeStyle = '#3f3a35'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, s * 0.42); g.lineTo(0, s * 0.58); g.moveTo(-s * 0.36, s * 0.6); g.lineTo(s * 0.36, s * 0.6); g.moveTo(s * 0.36, s * 0.6); g.quadraticCurveTo(s * 0.62, s * 0.1, s * 0.42, -s * 0.36); g.stroke();
  g.fillStyle = 'rgba(69,42,24,.75)'; g.beginPath(); g.arc(0, 0, s * 0.34, 0.3, Math.PI - 0.3); g.closePath(); g.fill();
  g.restore();
}
export function drawCup(g, x, y, s, fill = '#5a371f') {
  g.save();
  g.strokeStyle = '#f2e9d9'; g.lineWidth = s * 0.14; g.beginPath(); g.arc(x + s * 0.72, y + s * 0.36, s * 0.26, -1.2, 1.2); g.stroke();
  g.fillStyle = lin(g, x - s, y, x + s, y, [[0, '#fff8ea'], [0.6, '#f0e3cd'], [1, '#d7c6ab']]);
  g.beginPath(); g.moveTo(x - s * 0.78, y); g.lineTo(x + s * 0.78, y); g.bezierCurveTo(x + s * 0.72, y + s * 0.74, x + s * 0.44, y + s * 0.98, x + s * 0.2, y + s); g.lineTo(x - s * 0.2, y + s); g.bezierCurveTo(x - s * 0.44, y + s * 0.98, x - s * 0.72, y + s * 0.74, x - s * 0.78, y); g.fill();
  g.fillStyle = fill; g.beginPath(); g.ellipse(x, y + s * 0.04, s * 0.68, s * 0.13, 0, 0, TAU); g.fill();
  g.fillStyle = '#e4d3b5'; g.beginPath(); g.ellipse(x, y + s * 1.03, s * 0.82, s * 0.09, 0, 0, TAU); g.fill();
  g.restore();
}
export function drawBar(g, W, H, { place = 'home', weather = 'sun', t = 0, cafe = '', front = null, frontMood = 'calm', frontOpts = {}, counterY = H * 0.6, choices = null, owner2 = false }) {
  // 벽
  g.fillStyle = lin(g, 0, 0, 0, counterY, [[0, '#5c4332'], [0.65, '#7a5a42'], [1, '#6b4d38']]);
  g.fillRect(0, 0, W, counterY + 8);
  // 창
  const wx = W * 0.05, wy = H * 0.09, ww = W * 0.56, wh = H * 0.34;
  g.save(); rr(g, wx, wy, ww, wh, 6); g.clip();
  (place === 'office' ? officeView : homeView)(g, wx, wy, ww, wh, t, weather);
  g.fillStyle = 'rgba(255,214,150,.08)'; g.fillRect(wx, wy, ww, wh);
  g.restore();
  if (weather === 'rain') rainOnGlass(g, wx, wy, ww, wh, t);
  g.strokeStyle = '#3a281c'; g.lineWidth = 5; rr(g, wx, wy, ww, wh, 6); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.moveTo(wx + ww * 0.5, wy); g.lineTo(wx + ww * 0.5, wy + wh); g.stroke();
  // 작은 간판
  if (cafe) {
    g.font = font(13, 800); const tw = Math.min(ww - 12, g.measureText(cafe).width + 26);
    g.fillStyle = '#2f2017'; rr(g, wx + ww / 2 - tw / 2, wy - 14, tw, 25, 7); g.fill();
    g.strokeStyle = 'rgba(239,204,147,.6)'; g.lineWidth = 1; rr(g, wx + ww / 2 - tw / 2 + 2, wy - 12, tw - 4, 21, 5); g.stroke();
    g.fillStyle = '#f4d8a4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cafe, wx + ww / 2, wy - 1, tw - 10);
  }
  // 선반
  const sx = W * 0.65, sw = W * 0.33;
  for (const [i, sy] of [H * 0.17, H * 0.31, H * 0.45].entries()) {
    g.fillStyle = '#3f2c20'; g.fillRect(sx, sy, sw, 6);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(sx, sy + 6, sw, 3);
    if (i === 0) {
      for (let k = 0; k < 3; k++) { const jx = sx + 16 + k * sw * 0.31; g.fillStyle = 'rgba(232,223,205,.34)'; rr(g, jx - 10, sy - 34, 20, 34, 4); g.fill(); g.fillStyle = ['#5a3a22', '#3f2a1a', '#7a5233'][k]; rr(g, jx - 8, sy - 21, 16, 19, 2); g.fill(); g.fillStyle = '#b08a60'; g.fillRect(jx - 10, sy - 37, 20, 4); }
    } else if (i === 1) {
      drawSiphon(g, sx + sw * 0.72, sy - 16, 26);
      for (let k = 0; k < 2; k++) { g.fillStyle = '#efe5d2'; rr(g, sx + 10 + k * 26, sy - 19, 19, 19, 3); g.fill(); }
    } else {
      for (let k = 0; k < 4; k++) { const cx = sx + 18 + k * sw * 0.24; g.fillStyle = ['#efe5d2', '#d8c8ad', '#efe5d2', '#c4a98a'][k]; rr(g, cx - 9, sy - 15, 18, 15, 3); g.fill(); }
    }
  }
  // 조명
  for (const lx of [W * 0.22, W * 0.8]) {
    g.strokeStyle = '#201510'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, H * 0.04); g.stroke();
    g.fillStyle = '#2b1c13'; g.beginPath(); g.moveTo(lx - 15, H * 0.067); g.lineTo(lx - 5, H * 0.04); g.lineTo(lx + 5, H * 0.04); g.lineTo(lx + 15, H * 0.067); g.closePath(); g.fill();
    g.fillStyle = rad(g, lx, H * 0.07, 2, W * 0.42, [[0, 'rgba(255,214,150,.5)'], [0.3, 'rgba(255,205,135,.1)'], [1, 'rgba(255,205,135,0)']]);
    g.fillRect(0, 0, W, counterY);
    g.fillStyle = '#ffe9bf'; circle(g, lx, H * 0.07, 4); g.fill();
  }
  // 앞사람
  if (front) drawPerson(g, front, W * 0.5, counterY + 8, Math.min(W * 0.14, H * 0.082), { mood: frontMood, t, ...frontOpts });
  // 카운터
  g.fillStyle = lin(g, 0, counterY, 0, counterY + 14, [[0, '#c0916a'], [1, '#8a6245']]);
  g.fillRect(0, counterY, W, 14);
  g.fillStyle = lin(g, 0, counterY + 14, 0, H, [[0, '#4f3524'], [0.4, '#3a2619'], [1, '#2a1a10']]);
  g.fillRect(0, counterY + 14, W, H - counterY - 14);
  g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1;
  for (let i = 1; i < 7; i++) { const x = W * i / 7; g.beginPath(); g.moveTo(x, counterY + 14); g.lineTo(x, H); g.stroke(); }
  // 카운터 위 소품: 왼쪽 그라인더, 오른쪽 머신
  const cy = counterY;
  g.fillStyle = '#2e2b2a'; rr(g, W * 0.06, cy - 46, 30, 46, 4); g.fill();
  g.fillStyle = 'rgba(214,226,226,.3)'; g.beginPath(); g.moveTo(W * 0.06 + 2, cy - 46); g.lineTo(W * 0.06 - 3, cy - 72); g.lineTo(W * 0.06 + 33, cy - 72); g.lineTo(W * 0.06 + 28, cy - 46); g.closePath(); g.fill();
  g.fillStyle = '#4a2c18'; g.beginPath(); g.moveTo(W * 0.06 + 3, cy - 48); g.lineTo(W * 0.06, cy - 62); g.lineTo(W * 0.06 + 30, cy - 62); g.lineTo(W * 0.06 + 27, cy - 48); g.closePath(); g.fill();
  g.fillStyle = lin(g, W * 0.76, cy - 60, W * 0.96, cy, [[0, '#bcc0bf'], [0.5, '#828786'], [1, '#5f6362']]);
  rr(g, W * 0.75, cy - 60, W * 0.21, 60, 5); g.fill();
  g.fillStyle = '#2a2a2a'; g.fillRect(W * 0.77, cy - 24, W * 0.17, 16);
  g.fillStyle = '#d1b47d'; circle(g, W * 0.8, cy - 42, 4); g.fill(); circle(g, W * 0.86, cy - 42, 4); g.fill();
  drawCup(g, W * 0.3, cy - 17, 13);
}

// ── 이야기 그림 ────────────────────────────
function officeNight(g, W, H, ctx) {
  const hero = personOf('hero', ctx.choices), t = ctx.t;
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#0d1422'], [1, '#1a2130']]); g.fillRect(0, 0, W, H);
  // 창밖 빌딩
  for (let i = 0; i < 9; i++) {
    const bx = i * W / 8 - 10, bh = H * (0.14 + noise(i) * 0.14);
    g.fillStyle = '#121a2a'; g.fillRect(bx, H * 0.34 - bh, W / 8 + 4, bh + 10);
    g.fillStyle = 'rgba(250,216,140,.7)';
    for (let k = 0; k < 16; k++) { if (noise(i * 30 + k) > 0.68) g.fillRect(bx + 4 + (k % 4) * 11, H * 0.34 - bh + 6 + Math.floor(k / 4) * 16, 5, 7); }
  }
  // 꺼진 책상들
  g.fillStyle = '#1b2231'; g.fillRect(0, H * 0.34, W, H * 0.66);
  for (const [x, y, w] of [[0.06, 0.4, 0.28], [0.68, 0.4, 0.28]]) { g.fillStyle = '#111825'; rr(g, W * x, H * y, W * w, H * 0.12, 3); g.fill(); g.fillStyle = '#0a0f18'; rr(g, W * x + W * w * 0.3, H * y - 18, W * w * 0.4, 30, 2); g.fill(); }
  // 모니터 빛
  const mx = W * 0.5, my = H * 0.46;
  g.fillStyle = rad(g, mx, my + 30, 5, W * 0.7, [[0, 'rgba(150,200,255,.34)'], [1, 'rgba(150,200,255,0)']]); g.fillRect(0, 0, W, H);
  drawPerson(g, hero, mx, H * 0.72, Math.min(W * 0.13, H * 0.075), { mood: 'tired', suit: true, badge: true, t });
  g.fillStyle = '#20293a'; g.fillRect(0, H * 0.7, W, H * 0.3);
  // 등을 보이는 모니터
  g.fillStyle = '#0c111b'; rr(g, mx - W * 0.2, H * 0.64, W * 0.4, H * 0.1, 4); g.fill();
  g.fillStyle = 'rgba(170,215,255,.55)'; g.fillRect(mx - W * 0.2, H * 0.64 - 1, W * 0.4, 2);
  // 종이컵 자판기 커피
  g.fillStyle = '#f0ece2'; g.beginPath(); g.moveTo(W * 0.75, H * 0.66); g.lineTo(W * 0.83, H * 0.66); g.lineTo(W * 0.815, H * 0.71); g.lineTo(W * 0.765, H * 0.71); g.closePath(); g.fill();
  g.fillStyle = '#2d1c12'; g.beginPath(); g.ellipse(W * 0.79, H * 0.661, W * 0.04, 3, 0, 0, TAU); g.fill();
}
function sketch(g, W, H, ctx) {
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#2a2017'], [1, '#17110c']]); g.fillRect(0, 0, W, H);
  g.strokeStyle = '#0f0a07'; g.lineWidth = 8; g.strokeRect(W * 0.04, H * 0.05, W * 0.92, H * 0.7);
  g.save(); g.translate(W * 0.5, H * 0.38); g.rotate(-0.05);
  const pw = W * 0.74, ph = H * 0.48;
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 18; g.fillStyle = '#efe7d6'; g.fillRect(-pw / 2, -ph / 2, pw, ph); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(120,105,85,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-pw / 2, 0); g.lineTo(pw / 2, 0); g.moveTo(0, -ph / 2); g.lineTo(0, ph / 2); g.stroke();
  // 연필 그림
  g.strokeStyle = '#4b4238'; g.lineWidth = 1.6; g.lineCap = 'round';
  const s = pw / 240;
  g.strokeRect(-85 * s, -40 * s, 170 * s, 100 * s);
  g.beginPath(); g.moveTo(-96 * s, -40 * s); g.lineTo(-74 * s, -66 * s); g.lineTo(74 * s, -66 * s); g.lineTo(96 * s, -40 * s); g.closePath(); g.stroke();
  for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo((-74 + i * 21) * s, -66 * s); g.lineTo((-88 + i * 25) * s, -40 * s); g.stroke(); }
  g.strokeRect(-70 * s, -22 * s, 60 * s, 52 * s); g.strokeRect(20 * s, -22 * s, 46 * s, 82 * s);
  g.beginPath(); g.arc(58 * s, 20 * s, 2 * s, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(-40 * s, 30 * s, 20 * s, 3 * s, 0, 0, TAU); g.stroke();
  g.fillStyle = '#4b4238'; g.font = `${15 * s}px ${FONT}`; g.textAlign = 'center'; g.fillText('언젠가 내 카페', 0, -82 * s);
  g.font = `${11 * s}px ${FONT}`; g.fillText('창가 자리 / 커피 냄새 / 느린 음악', 0, 78 * s);
  g.restore();
  // 연필
  g.save(); g.translate(W * 0.74, H * 0.62); g.rotate(-0.6); g.fillStyle = '#d9a43f'; g.fillRect(-55, -4, 92, 8); g.fillStyle = '#e8cfa6'; g.beginPath(); g.moveTo(37, -4); g.lineTo(50, 0); g.lineTo(37, 4); g.fill(); g.restore();
}
// 가게 앞(프롤로그와 엔딩)
export function shopFront(g, W, H, { place, cafe, t = 0, weather = 'sun', night = false, showPeople = false, choices = null }) {
  const off = place === 'office';
  // 하늘
  g.fillStyle = night ? lin(g, 0, 0, 0, H, [[0, '#28253f'], [0.6, '#5f4b55']]) : off ? lin(g, 0, 0, 0, H, [[0, '#a9c4d6'], [0.6, '#dbe1dc']]) : lin(g, 0, 0, 0, H, [[0, '#a7d5ea'], [0.6, '#f6ecd5']]);
  g.fillRect(0, 0, W, H);
  const groundY = H * 0.77, shopTop = H * 0.2, sw = W * 0.8, sx = W * 0.1;
  if (off) {
    // 오피스빌딩 + 양쪽 식당
    g.fillStyle = night ? '#2b2e3b' : '#868f97'; g.fillRect(sx - W * 0.05, 0, sw + W * 0.1, groundY);
    g.fillStyle = night ? 'rgba(255,221,150,.45)' : 'rgba(40,60,80,.32)';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) g.fillRect(sx + c * sw / 6 + 3, 6 + r * H * 0.055, sw / 6 - 7, H * 0.038);
    for (const [x, txt, col] of [[0, '국밥', '#a33d32'], [W * 0.93, '백반', '#2f6b5a']]) {
      g.fillStyle = night ? '#3a342f' : '#a58a70'; g.fillRect(x, H * 0.3, W * 0.07, groundY - H * 0.3);
      g.fillStyle = col; g.fillRect(x, H * 0.42, W * 0.07, 60);
      g.fillStyle = '#fff'; g.font = font(10, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
      [...txt].forEach((ch, i) => g.fillText(ch, x + W * 0.035, H * 0.42 + 17 + i * 17));
    }
  } else {
    // 나지막한 상가 + 가로수
    g.fillStyle = night ? '#3d3640' : '#e3d4bd'; g.fillRect(sx - W * 0.05, shopTop - H * 0.16, sw + W * 0.1, groundY - shopTop + H * 0.16);
    g.fillStyle = night ? 'rgba(255,226,170,.5)' : 'rgba(70,90,100,.38)';
    for (let c = 0; c < 3; c++) { g.fillRect(sx + c * sw / 3 + sw * 0.08, shopTop - H * 0.12, sw * 0.18, H * 0.08); }
    g.fillStyle = '#6b4c34'; g.fillRect(W * 0.03, H * 0.34, 8, groundY - H * 0.34);
    g.fillStyle = night ? '#35504a' : '#79a56b';
    const sway = Math.sin(t * 0.7) * 3;
    for (const [dx, dy, r] of [[0, 0.3, 0.08], [-0.05, 0.36, 0.06], [0.06, 0.37, 0.065]]) { circle(g, W * (0.05 + dx) + sway, H * dy, H * r); g.fill(); }
  }
  // 가게 정면
  g.fillStyle = lin(g, 0, shopTop, 0, groundY, [[0, '#4a3122'], [1, '#2d1d13']]); g.fillRect(sx, shopTop, sw, groundY - shopTop);
  // 간판
  const signH = H * 0.08;
  g.fillStyle = '#2b1c13'; g.fillRect(sx - 4, shopTop - 4, sw + 8, signH + 8);
  g.fillStyle = '#f4d8a4'; g.font = font(Math.min(30, sw * 0.095), 800); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(cafe, sx + sw / 2, shopTop + signH / 2, sw - 20);
  // 어닝
  const awY = shopTop + signH + 4, awH = H * 0.04, n = 10;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#efe4d0' : '#3f6657';
    g.beginPath(); g.moveTo(sx + i * sw / n, awY); g.lineTo(sx + (i + 1) * sw / n, awY); g.lineTo(sx + (i + 1) * sw / n, awY + awH); g.quadraticCurveTo(sx + (i + 0.5) * sw / n, awY + awH + 6, sx + i * sw / n, awY + awH); g.fill();
  }
  // 큰 창과 문
  const glassY = awY + awH + 8, glassH = groundY - glassY - 8;
  const glow = night ? 'rgba(255,207,130,.95)' : 'rgba(255,217,160,.62)';
  g.fillStyle = lin(g, 0, glassY, 0, glassY + glassH, [[0, glow], [1, 'rgba(160,106,60,.92)']]);
  rr(g, sx + 10, glassY, sw * 0.58, glassH, 3); g.fill();
  g.strokeStyle = '#2b1c13'; g.lineWidth = 3; rr(g, sx + 10, glassY, sw * 0.58, glassH, 3); g.stroke();
  // 창 안 실내
  g.fillStyle = 'rgba(54,33,20,.65)';
  g.fillRect(sx + 18, glassY + glassH * 0.68, sw * 0.58 - 16, 5);
  for (let i = 0; i < 3; i++) { const lx = sx + 40 + i * sw * 0.18; g.fillStyle = '#ffeec9'; circle(g, lx, glassY + 14, 4); g.fill(); g.fillStyle = 'rgba(64,40,25,.8)'; rr(g, lx - 10, glassY + glassH * 0.68 - 22, 20, 22, 3); g.fill(); }
  // 문
  const dx = sx + sw * 0.66, dw = sw * 0.28;
  g.fillStyle = '#6e4a30'; g.fillRect(dx, glassY - 3, dw, groundY - glassY + 3);
  g.fillStyle = lin(g, 0, glassY, 0, groundY, [[0, glow], [1, 'rgba(160,106,60,.92)']]); g.fillRect(dx + 7, glassY + 5, dw - 14, glassH * 0.62);
  g.fillStyle = '#d6b477'; circle(g, dx + dw - 10, glassY + glassH * 0.72, 3); g.fill();
  // 땅
  g.fillStyle = night ? '#35303a' : off ? '#a59f97' : '#c5b8a3'; g.fillRect(0, groundY, W, H - groundY);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, groundY, W, 5);
  if (weather === 'rain') rainOnGlass(g, 0, 0, W, H, t);
}
function encounter(g, W, H, ctx) {
  const { choices, t } = ctx, place = choices.place;
  shopFront(g, W, H, { place, cafe: choices.cafe, t, weather: place === 'office' ? 'sun' : 'sun' });
  const s = Math.min(W * 0.11, H * 0.064);
  drawPerson(g, personOf('owner', choices), W * 0.71, H * 0.78, s * 0.92, { mood: 'smile', apron: true, t });
  drawPerson(g, personOf('hero', choices), W * 0.3, H * 0.8, s, place === 'office' ? { mood: 'tired', suit: true, badge: true, t } : { mood: 'calm', t, look: 1 });
  // 땅이 앞을 가린다
  g.fillStyle = place === 'office' ? '#a59f97' : '#c5b8a3'; g.fillRect(0, H * 0.79, W, H);
}
function notice(g, W, H, ctx) {
  shopFront(g, W, H, { place: ctx.choices.place, cafe: ctx.choices.cafe, t: ctx.t, weather: 'rain' });
  g.fillStyle = 'rgba(30,24,30,.34)'; g.fillRect(0, 0, W, H);
  // 안내문을 크게
  g.save(); g.translate(W * 0.5, H * 0.38); g.rotate(-0.02);
  const pw = W * 0.72, ph = H * 0.26;
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 14; g.fillStyle = '#f6f1e4'; g.fillRect(-pw / 2, -ph / 2, pw, ph); g.shadowBlur = 0;
  g.fillStyle = 'rgba(230,214,170,.8)'; g.fillRect(-pw * 0.12, -ph / 2 - 7, pw * 0.24, 14);
  g.fillStyle = '#3a2b1f'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font(Math.min(21, W * 0.054), 700); g.fillText('이번 달까지만 문을 열어요.', 0, -ph * 0.14);
  g.font = font(Math.min(15, W * 0.04), 500); g.fillText('그동안 고마웠어요.', 0, ph * 0.12);
  g.font = font(Math.min(12, W * 0.032), 500); g.fillStyle = '#7a6856'; g.fillText(`「${ctx.choices.cafe}」 사장 드림`, 0, ph * 0.34, pw * 0.9);
  g.restore();
}
function twoShot(g, W, H, ctx, leftId, rightId, leftOpts, rightOpts, cy = H * 0.68) {
  const { choices, t } = ctx;
  drawBar(g, W, H, { place: choices.place, weather: 'rain', t, cafe: choices.cafe, counterY: cy });
  const s = Math.min(W * 0.125, H * 0.075);
  drawPerson(g, personOf(rightId, choices), W * 0.71, cy + 6, s, { t, ...rightOpts });
  drawPerson(g, personOf(leftId, choices), W * 0.28, cy + 6, s, { t, ...leftOpts });
  g.fillStyle = lin(g, 0, cy, 0, cy + 14, [[0, '#c0916a'], [1, '#8a6245']]); g.fillRect(0, cy, W, 14);
  g.fillStyle = lin(g, 0, cy + 14, 0, H, [[0, '#4f3524'], [1, '#2a1a10']]); g.fillRect(0, cy + 14, W, H - cy - 14);
}
export const CUTS = {
  night: officeNight,
  sketch,
  encounter,
  notice,
  decide: (g, W, H, ctx) => {
    const hTalk = ctx.who === 'hero';
    twoShot(g, W, H, ctx, 'hero', 'owner', { mood: hTalk ? 'calm' : 'surprised', suit: true, look: 1 }, { mood: hTalk ? 'surprised' : 'smile', apron: true, look: -1 });
  },
  apron: (g, W, H, ctx) => {
    const { choices, t } = ctx, cy = H * 0.7;
    drawBar(g, W, H, { place: choices.place, weather: 'sun', t, cafe: choices.cafe, counterY: cy, front: personOf('hero', choices), frontMood: 'calm', frontOpts: { apron: true } });
    // 카운터 위 사원증
    const x = W * 0.58, y = cy - 3;
    g.strokeStyle = '#3f6ea3'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 16, y - 6); g.quadraticCurveTo(x + 70, y + 2, x + 60, y - 18); g.stroke();
    g.save(); g.translate(x, y - 8); g.rotate(-0.14); g.fillStyle = '#f7f4ee'; rr(g, -16, -22, 32, 26, 3); g.fill(); g.fillStyle = '#b8c4d2'; rr(g, -11, -18, 13, 14, 2); g.fill(); g.fillStyle = '#8c98a8'; g.fillRect(4, -16, 8, 2); g.fillRect(4, -11, 8, 2); g.restore();
  },
  junior: (g, W, H, ctx) => {
    const happy = ctx.index >= 6;
    twoShot(g, W, H, ctx, 'hero', 'junior', { mood: 'smile', apron: true, look: 1 }, { mood: happy ? 'closed' : 'tired', look: -1 });
    if (happy) drawCup(g, W * 0.71, H * 0.68 - 17, 14);
  },
  key: (g, W, H, ctx) => {
    const cy = H * 0.68;
    twoShot(g, W, H, ctx, 'hero', 'owner', { mood: 'calm', apron: true, look: 1 }, { mood: 'smile', look: -1 }, cy);
    // 열쇠와 노트
    const x = W * 0.5;
    g.save(); g.translate(x, cy + 44);
    g.fillStyle = '#7a5a3a'; rr(g, -58, -22, 70, 46, 3); g.fill(); g.fillStyle = '#efe5d2'; g.fillRect(-52, -18, 58, 38);
    g.strokeStyle = 'rgba(80,60,40,.4)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-48, -11 + i * 7); g.lineTo(2 - noise(i) * 14, -11 + i * 7); g.stroke(); }
    g.strokeStyle = '#d8ae55'; g.lineWidth = 3.5; circle(g, 32, -6, 8); g.stroke();
    g.beginPath(); g.moveTo(32, 2); g.lineTo(32, 24); g.moveTo(32, 15); g.lineTo(38, 15); g.moveTo(32, 21); g.lineTo(38, 21); g.stroke();
    g.restore();
    // 선반의 사이펀을 은은하게 비춘다
    g.fillStyle = rad(g, W * 0.87, H * 0.27, 2, W * 0.16, [[0, 'rgba(255,225,160,.35)'], [1, 'rgba(255,225,160,0)']]);
    g.fillRect(W * 0.65, H * 0.14, W * 0.35, H * 0.22);
  },
  sign: (g, W, H, ctx) => {
    shopFront(g, W, H, { place: ctx.choices.place, cafe: ctx.choices.cafe, t: ctx.t, night: true });
    const s = Math.min(W * 0.11, H * 0.062);
    drawPerson(g, personOf('hero', ctx.choices), W * 0.5, H * 0.8, s, { mood: 'smile', apron: true, t: ctx.t });
    g.fillStyle = '#35303a'; g.fillRect(0, H * 0.79, W, H);
  },
};
export function drawTitleBg(g, W, H, t) {
  shopFront(g, W, H, { place: 'home', cafe: '', t, night: true, weather: 'rain' });
  g.fillStyle = lin(g, 0, 0, 0, H * 0.45, [[0, 'rgba(25,14,8,.92)'], [1, 'rgba(25,14,8,0)']]); g.fillRect(0, 0, W, H * 0.45);
  g.fillStyle = lin(g, 0, H * 0.55, 0, H, [[0, 'rgba(25,14,8,0)'], [1, 'rgba(25,14,8,.96)']]); g.fillRect(0, H * 0.55, W, H * 0.45);
}
export { PLACES };
