// 제조 화면 8가지(갈기·담기·다지기·샷·물·스팀·뜸·붓기). 판정은 logic.js, 여기는 그림과 손 조작뿐이다.
import * as G from './logic.js';
import { ESPRESSO, DRIP, MILK, AMERICANO, MENUS, STEP_NAME, GRIND, REAL_PER_GAME, TASTE_GOOD, TASTE_OK } from './data.js';
import { rr, circle, lin, rad, font, TAU } from './art.js';
import { img } from './assets.js';
import { tiltAvailable, tiltNeedsAsk, tiltListen, tiltStop, tiltAsk, tiltWait, tiltAngle } from './tilt.js';

let TOP = 128; // 위쪽 단계 표시와 안내 자리
let COUNTER = 176; // 카운터 윗면이 화면 아래에서 떨어진 거리(게이지 2줄 + 버튼 자리)
// 홈 화면 앱은 노치와 아래 막대만큼 더 비운다
export function setInsets(top, bottom) { TOP = 128 + top; COUNTER = 176 + bottom; }

const BENCH_LINE = 0.79; // 그림에서 카운터 윗면 높이(비율)
function bench(g, W, H) {
  const cy = H - COUNTER, im = img('st-bench');
  g.fillStyle = '#2a1a10'; g.fillRect(0, 0, W, H);
  if (im) {
    const k = Math.max(W / im.width, cy / (im.height * BENCH_LINE)), ox = (W - im.width * k) / 2, oy = cy - im.height * BENCH_LINE * k;
    g.drawImage(im, ox, oy, im.width * k, im.height * k);
  }
  // 게이지 글자가 잘 보이게 카운터 아래를 어둡게 한다
  g.fillStyle = lin(g, 0, cy + 12, 0, H, [[0, 'rgba(30,17,10,.55)'], [1, 'rgba(24,13,7,.92)']]); g.fillRect(0, cy + 12, W, H - cy - 12);
  return cy;
}
// 그림 조각을 너비 기준으로 놓는다. (ax, ay): 그림 안 기준점 비율
function sprite(g, name, x, y, w, ax = 0.5, ay = 0.5) {
  const im = img(name);
  if (!im) return 0;
  const h = w * im.height / im.width;
  g.drawImage(im, x - w * ax, y - h * ay, w, h);
  return h;
}
// 가로 게이지: lo~hi가 초록 칸
export function gauge(g, x, y, w, { val, min = 0, max, lo, hi, label, text, h = 16 }) {
  const X = (v) => x + (Math.max(min, Math.min(max, v)) - min) / (max - min) * w, inZone = val >= lo && val <= hi;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = '#efe3cf'; g.font = font(13, 600); g.fillText(label, x, y - 5);
  g.textAlign = 'right'; g.font = font(16, 800); g.fillStyle = inZone ? '#a5ec9b' : '#fff5e4'; g.fillText(text, x + w, y - 4);
  g.fillStyle = 'rgba(16,9,5,.62)'; rr(g, x, y, w, h, h / 2); g.fill();
  g.fillStyle = inZone ? '#7be37f' : '#5ca86a'; rr(g, X(lo), y + 1, Math.max(4, X(hi) - X(lo)), h - 2, 4); g.fill();
  const px = X(val);
  g.fillStyle = '#fff'; g.strokeStyle = '#201209'; g.lineWidth = 2; rr(g, px - 4, y - 4, 8, h + 8, 3); g.fill(); g.stroke();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 낱알: 담기·거품에 같이 쓴다
function makeParticles() {
  const list = [];
  return {
    add(p) { if (list.length < 240) list.push(p); },
    draw(g, dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt; p.x += (p.vx || 0) * dt; p.y += p.vy * dt;
        g.globalAlpha = p.fade ? Math.min(1, p.life / p.fade) * (p.a ?? 1) : (p.a ?? 1);
        g.fillStyle = p.c; circle(g, p.x, p.y, p.r * (p.grow ? 1 + (p.max - p.life) * p.grow : 1)); g.fill();
      }
      g.globalAlpha = 1;
    },
    get size() { return list.length; },
  };
}

// ── 김과 잔 ──
// 김은 부드러운 입자 하나를 미리 구워 두고 찍는다(매 프레임 그라디언트를 만들지 않는다)
let puffTex = null;
function puff(g, x, y, r, a) {
  if (!puffTex) {
    puffTex = document.createElement('canvas'); puffTex.width = puffTex.height = 64;
    const c = puffTex.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  }
  g.globalAlpha = a; g.drawImage(puffTex, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
}
// 피어오르는 김: 줄기 n개가 흔들리며 올라가 옅어진다
function wisps(g, x, y, w, h, t, amount, n = 3) {
  if (amount <= 0) return;
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < 7; i++) {
      const p = (t * 0.2 + i / 7 + k * 0.37) % 1;
      const px = x + (k - (n - 1) / 2) * w * 0.3 + Math.sin(p * 6 + t * 0.7 + k * 2) * w * (0.05 + p * 0.2);
      puff(g, px, y - p * h, w * (0.09 + p * 0.2), amount * Math.sin(p * Math.PI) * 0.26);
    }
  }
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (v) => 1 - (1 - clamp01(v)) ** 3;
function mixColor(stops, x) {
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1][0]) i++;
  const [x0, a] = stops[i], [x1, b] = stops[i + 1], k = clamp01((x - x0) / (x1 - x0));
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`;
}
// 옆에서 본 잔: 그림 속 입구 타원 자리를 잰 값이다. R은 입구 반지름, bottom은 받침 아래 끝
const CUP_ART = { aspect: 526 / 720, mx: 0.486, my: 0.199, rx: 0.344, ry: 0.188 };
function sideCup(g, cx, bottom, R) {
  const w = R / CUP_ART.rx, h = w * CUP_ART.aspect, left = cx - CUP_ART.mx * w, top = bottom - h, im = img('sp-cup');
  if (im) g.drawImage(im, left, top, w, h);
  return { x: cx, y: top + CUP_ART.my * h, rx: R, ry: CUP_ART.ry * h };
}
// 잔 속 액체의 수면: 적을수록 낮고 좁다
const cupSurface = (m, level) => ({ x: m.x, y: m.y + m.ry * 0.6 * (1 - level), rx: m.rx * 0.93 * (0.62 + 0.34 * level), ry: m.ry * 0.9 * (0.62 + 0.34 * level) });
function cupLiquid(g, m, level, { body, crema = null, flecks = 0, ripple = 0, t = 0 }) {
  if (level <= 0.01) return;
  const s = cupSurface(m, level);
  g.save(); g.beginPath(); g.ellipse(m.x, m.y, m.rx * 0.95, m.ry * 0.92, 0, 0, TAU); g.clip();
  g.fillStyle = body; g.beginPath(); g.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, TAU); g.fill();
  if (crema) { // 가운데가 밝고 가장자리로 갈수록 짙어진다
    g.save(); g.translate(s.x, s.y); g.scale(1, s.ry / s.rx);
    g.fillStyle = rad(g, 0, 0, s.rx * 0.2, s.rx * 0.94, [[0, crema], [0.72, crema], [1, body]]); circle(g, 0, 0, s.rx * 0.94); g.fill();
    g.restore();
  }
  for (let i = 0; i < flecks; i++) { // 크레마의 짙은 얼룩
    const a = i * 2.399, r = Math.sqrt((i + 0.5) / flecks) * 0.88;
    g.fillStyle = i % 3 ? 'rgba(92,48,18,.4)' : 'rgba(250,216,160,.42)';
    g.beginPath(); g.ellipse(s.x + Math.cos(a) * s.rx * r, s.y + Math.sin(a) * s.ry * r, 1.3 + (i % 3), 0.8 + (i % 2), 0, 0, TAU); g.fill();
  }
  for (let i = 0; i < 3 && ripple > 0; i++) { // 줄기가 닿는 자리의 물결
    const p = (t * 1.5 + i / 3) % 1;
    g.strokeStyle = `rgba(255,236,204,${(1 - p) * 0.4 * ripple})`; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(s.x, s.y, s.rx * p * 0.8, s.ry * p * 0.8, 0, 0, TAU); g.stroke();
  }
  g.restore();
}

// ── 1. 갈기 ──
const DIAL_FROM = Math.PI * 0.75, DIAL_SWEEP = Math.PI * 1.5;
const dialAngle = (v) => DIAL_FROM + (v - GRIND.min) / (GRIND.max - GRIND.min) * DIAL_SWEEP;

async function stepGrind(ctx, st, beat) {
  const { ui, sfx } = ctx, key = st.menu === 'drip' ? 'drip' : 'espresso';
  let v = ctx.S.dial[key], grinding = 0, last = Math.round(v * 2);
  let dragA = null;
  const P = (W, H) => { const room = H - COUNTER - TOP, R = Math.min(W * 0.31, room * 0.31); return { cx: W / 2, cy: TOP + room * 0.64, R }; };
  ui.hint(beat.tips?.grind || (st.advice ? `${st.advice} 숫자가 낮을수록 고와요.` : '다이얼을 돌려요. 숫자가 낮을수록 고와요.'));
  return new Promise((done) => {
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), { cx, cy, R } = P(W, H);
      // 그라인더 몸통
      const shake = grinding ? Math.sin(t * 90) * 1.5 : 0;
      g.save(); g.beginPath(); g.rect(0, 0, W, cy0); g.clip();
      sprite(g, 'sp-grinder', cx + shake, cy, R * 3, 0.5, 0.66); // 몸통 앞판 가운데에 다이얼이 오게 놓는다
      g.restore();
      // 눈금판
      g.fillStyle = rad(g, cx, cy - R * 0.2, R * 0.1, R * 1.15, [[0, '#f3e8d3'], [1, '#d3c1a2']]); circle(g, cx, cy, R * 1.04); g.fill();
      g.strokeStyle = '#201a17'; g.lineWidth = 3; circle(g, cx, cy, R * 1.04); g.stroke();
      if (beat.grindHint) {
        const ideal = G.idealGrind(ctx.S.day, st.menu);
        g.strokeStyle = '#4fb65e'; g.lineWidth = R * 0.13; g.lineCap = 'butt';
        g.beginPath(); g.arc(cx, cy, R * 0.92, dialAngle(ideal - 0.45), dialAngle(ideal + 0.45)); g.stroke();
      }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = GRIND.min; i <= GRIND.max; i += 0.5) {
        const a = dialAngle(i), major = Number.isInteger(i), r0 = R * (major ? 0.8 : 0.86), r1 = R * 0.97;
        g.strokeStyle = '#3a2b1f'; g.lineWidth = major ? 2.5 : 1.2;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
        if (major) { g.fillStyle = '#2f2318'; g.font = font(Math.max(13, R * 0.13), 700); g.fillText(String(i), cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66); }
      }
      // 굵기 안내
      g.font = font(12, 700); g.fillStyle = '#e8d8bd'; g.fillText('고움', cx + Math.cos(DIAL_FROM - 0.16) * R * 1.0 + 4, cy + Math.sin(DIAL_FROM - 0.16) * R * 1.02 + 16);
      g.fillText('굵음', cx + Math.cos(DIAL_FROM + DIAL_SWEEP + 0.16) * R * 1.0 - 4, cy + Math.sin(DIAL_FROM + DIAL_SWEEP + 0.16) * R * 1.02 + 16);
      // 손잡이
      const a = dialAngle(v);
      g.fillStyle = lin(g, cx, cy - R * 0.5, cx, cy + R * 0.5, [[0, '#66564a'], [1, '#2b2320']]); circle(g, cx, cy, R * 0.47); g.fill();
      g.strokeStyle = '#17120f'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#f2c26a'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.46, cy + Math.sin(a) * R * 0.46); g.lineTo(cx + Math.cos(a) * R * 0.76, cy + Math.sin(a) * R * 0.76); g.stroke();
      g.fillStyle = '#fff5e0'; g.font = font(Math.max(22, R * 0.26), 800); g.fillText(v.toFixed(1), cx, cy + 1);
    });
    ctx.setPointer({
      down: (x, y, W, H) => { const { cx, cy } = P(W, H); dragA = Math.atan2(y - cy, x - cx); },
      move: (x, y, W, H) => {
        if (dragA == null || grinding) return;
        const { cx, cy } = P(W, H), a = Math.atan2(y - cy, x - cx);
        let d = a - dragA; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
        dragA = a;
        v = G.clampGrind(v + d / DIAL_SWEEP * (GRIND.max - GRIND.min));
        const n = Math.round(v * 2);
        if (n !== last) { sfx.play('tick'); last = n; }
      },
      up: () => { dragA = null; },
    });
    ui.primary('이 칸으로 갈기', { tap: async () => {
      if (grinding) return;
      ui.clearActions(); ui.hint('윙… 가는 중이에요.');
      grinding = 1; sfx.loop('grinder', 1);
      await wait(ctx.fast ? 40 : 1100);
      sfx.stopLoops(); grinding = 0;
      ctx.S.dial[key] = v;
      done(v);
    } });
    if (ctx.auto) { v = G.idealGrind(ctx.S.day, st.menu); ui.fire(); }
  });
}

// ── 2. 담기 ──
function portafilter(g, cx, y, w, fill) {
  // 바스켓 중심이 cx, 입구 높이가 y에 오게 놓는다. 그림의 바스켓 폭이 전체의 약 35%다
  sprite(g, 'sp-portafilter', cx, y, w * 2 / 0.35, 0.18, 0.2);
  if (fill > 0) {
    g.fillStyle = '#4c2d18'; const fy = y - Math.min(fill, 1.4) * w * 0.03;
    g.beginPath(); g.ellipse(cx, fy, w * 0.82, w * 0.15, 0, 0, TAU); g.fill();
    g.fillStyle = '#6f4728'; g.beginPath(); g.ellipse(cx, fy - w * 0.02, w * 0.5 * Math.min(1, fill + 0.25), w * 0.07, 0, 0, TAU); g.fill();
  }
}
function dripper(g, cx, y, w, fill) {
  g.fillStyle = 'rgba(245,240,230,.9)';
  g.beginPath(); g.moveTo(cx - w, y); g.lineTo(cx + w, y); g.lineTo(cx + w * 0.26, y + w * 0.92); g.lineTo(cx - w * 0.26, y + w * 0.92); g.closePath(); g.fill();
  g.fillStyle = '#efe7d6'; g.beginPath(); g.ellipse(cx, y, w, w * 0.22, 0, 0, TAU); g.fill();
  g.fillStyle = '#fbf7ef'; g.beginPath(); g.ellipse(cx, y, w * 0.88, w * 0.17, 0, 0, TAU); g.fill();
  if (fill > 0) { g.fillStyle = '#5d3a20'; g.beginPath(); g.ellipse(cx, y + 1, w * Math.min(0.8, 0.3 + fill * 0.5), w * 0.13, 0, 0, TAU); g.fill(); }
}
function scaleBase(g, cx, y, w, value) {
  g.fillStyle = '#26221f'; rr(g, cx - w, y, w * 2, 30, 7); g.fill();
  g.fillStyle = '#123a2c'; rr(g, cx - w * 0.5, y + 6, w, 18, 4); g.fill();
  g.fillStyle = '#8bffbf'; g.font = font(14, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(value, cx, y + 15);
}

async function stepDose(ctx, st, beat) {
  const { ui, sfx } = ctx, drip = st.menu === 'drip', tg = drip ? DRIP : ESPRESSO;
  let g0 = 0, down = false, ok = false;
  const fx = makeParticles();
  ui.hint(beat.tips?.dose || '누르고 있으면 가루가 떨어져요. 초록 칸에서 손을 떼요.');
  return new Promise((done) => {
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), cx = W / 2, top = Math.max(TOP + 12, cy0 - 360), baseY = cy0 - 30;
      const rate = 3.6 * (g0 > tg.dose - 4 ? 0.62 : 1);
      if (down) {
        g0 = Math.min(g0 + rate * dt, 34);
        if (Math.random() < dt * 90) fx.add({ x: cx + (Math.random() - 0.5) * 8, y: top + 100, vx: (Math.random() - 0.5) * 12, vy: 90 + Math.random() * 60, g: 620, life: 0.38, r: 1.4 + Math.random() * 1.2, c: Math.random() < 0.5 ? '#3a2212' : '#573419' });
      }
      const inZone = Math.abs(g0 - tg.dose) <= tg.doseOk;
      if (inZone && !ok) { ok = true; sfx.play('tick'); }
      if (!inZone) ok = false;
      sprite(g, 'sp-grinder', cx + (down ? Math.sin(t * 90) : 0), top + 104, 112, 0.5, 1);
      const w = Math.min(W * 0.2, 80), holderY = baseY - (drip ? w * 1.05 : w * 1.3) - 4;
      fx.draw(g, dt);
      if (drip) dripper(g, cx, holderY, w, g0 / tg.dose); else portafilter(g, cx, holderY, w, g0 / tg.dose);
      scaleBase(g, cx, baseY, Math.min(W * 0.26, 110), `${g0.toFixed(1)}g`);
      gauge(g, 24, cy0 + 40, W - 48, { val: g0, max: tg.dose * 1.6, lo: tg.dose - tg.doseOk, hi: tg.dose + tg.doseOk, label: `가루 ${tg.dose}g 담기`, text: `${g0.toFixed(1)}g` });
    });
    ui.primary('누르고 있기', { hold: true, down: () => { down = true; sfx.loop('grinder', 0.55); }, up: () => { down = false; sfx.stopLoops(); if (g0 > 1) ui.secondary('다 담았어요', () => done(g0)); } });
    if (ctx.auto) { g0 = tg.dose; done(g0); }
  });
}

// ── 3. 다지기 ──
const TILT_HINT = '화면을 꾹 누른 채 폰을 좌우로 기울여 수평을 맞춰요. 힘이 초록 칸에 들면 손을 떼요.';
// 폰 기울이기와 손가락 중 무엇으로 할지 정한다. 안 되는 기기는 손가락으로 돌아간다
async function tampInput(ctx) {
  const { ui } = ctx;
  if (!tiltAvailable()) return 'finger';
  const saved = ctx.tampMode();
  if (saved === 'finger') return 'finger';
  if (saved === 'tilt') {
    tiltListen();
    if (await tiltWait(500)) return 'tilt';
    if (!tiltNeedsAsk()) { tiltStop(); return 'finger'; }
  }
  ui.hint(saved ? '폰 기울이기를 다시 켜 주세요. 손가락으로 해도 돼요.' : '이번엔 폰을 직접 기울여서 수평을 맞춰 볼까요? 손가락으로 해도 돼요.');
  const pick = await new Promise((res) => {
    ui.primary('폰 기울이기', { click: true, tap: () => res(tiltAsk()) }); // 허용 창 때문에 눌린 그 자리에서 부른다
    ui.secondary('손가락으로', () => res('finger'));
  });
  ui.clearActions();
  if (pick === 'finger') { ctx.setTampMode('finger'); tiltStop(); return 'finger'; }
  if (pick && await tiltWait(1500)) { ctx.setTampMode('tilt'); return 'tilt'; }
  ctx.setTampMode('finger'); tiltStop();
  return 'failed';
}

async function stepTamp(ctx, st, beat) {
  const { ui, sfx } = ctx;
  let down = false, press = 0, startX = 0, fingerX = 0, tilt = 0, phase = Math.random() * 6, samples = [], kicked = 0;
  let mode = null, base = 0, hand = 0, chipArmed = false, chipBusy = false;
  const easy = ctx.S.day <= 1 ? 0.3 : 0.5;
  const fingerHint = beat.tips?.tamp || '꾹 누른 채 좌우로 움직여 수평을 맞춰요. 힘이 초록 칸에 들면 손을 떼요.';
  const setMode = (m) => {
    mode = m === 'tilt' ? 'tilt' : 'finger';
    ui.hint(m === 'tilt' ? TILT_HINT : m === 'failed' ? `폰 기울이기를 못 켜서 손가락으로 해요. ${fingerHint}` : fingerHint);
  };
  // 누르기 전에는 조작 방식을 바꿀 수 있다
  const chipBox = (W, cy0) => ({ w: 176, h: 30, x: W / 2 - 88, y: cy0 + 64 });
  const onChip = (x, y, W, H) => { if (!tiltAvailable() || mode == null || press > 0) return false; const c = chipBox(W, H - COUNTER); return x >= c.x - 6 && x <= c.x + c.w + 6 && y >= c.y - 6 && y <= c.y + c.h + 6; };
  const switchMode = async () => {
    if (chipBusy) return;
    if (mode === 'tilt') { ctx.setTampMode('finger'); tiltStop(); setMode('finger'); return; }
    chipBusy = true;
    const ok = await tiltAsk() && await tiltWait(1500);
    chipBusy = false;
    if (ok) { ctx.setTampMode('tilt'); setMode('tilt'); } else { tiltStop(); setMode('failed'); }
  };
  ui.hint(fingerHint);
  return new Promise((done) => {
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), cx = W / 2, w = Math.min(W * 0.25, 92), baseY = cy0 - w * 1.38, topArea = TOP + 18;
      if (down) {
        press = Math.min(1.1, press + dt * 0.28); // 초록 칸까지 약 2초, 지나치기까지 약 3초: 수평을 잡을 시간을 준다
        phase += dt * 1.25;
        const wobble = Math.sin(phase) * easy + Math.sin(phase * 2.3) * easy * 0.45;
        if (mode === 'tilt') { // 손 떨림이 더해지니 흔들림을 조금 줄인다. 가만히 들고만 있어선 만점이 안 나온다
          hand += (G.tiltFromAngle(tiltAngle() ?? base, base) - hand) * Math.min(1, dt * 14);
          tilt = wobble * 0.85 + hand;
        } else tilt = wobble + (fingerX - startX) / W * 3;
        tilt = Math.max(-1, Math.min(1, tilt));
        samples.push(tilt);
      } else if (press > 0 && !kicked) tilt *= 0.9;
      // 포터필터
      portafilter(g, cx, baseY, w, 1);
      // 탬퍼
      const py = baseY - w * 0.16 - (1 - Math.min(press, 1)) * 90 - 26;
      g.save(); g.translate(cx, py); g.rotate(tilt * 0.3);
      sprite(g, 'sp-tamper', 0, 22, w * 1.72, 0.5, 1);
      g.restore();
      // 수평계
      const lw = Math.min(W - 80, 280), lx = cx - lw / 2, ly = topArea + 24, lh = 30; // 두 줄 안내 아래에 온다
      g.fillStyle = 'rgba(16,9,5,.82)'; rr(g, lx, ly, lw, lh, lh / 2); g.fill();
      const green = Math.abs(tilt) < 0.22;
      g.fillStyle = green ? '#7be37f' : '#5ca86a'; rr(g, cx - lw * 0.11, ly + 2, lw * 0.22, lh - 4, 8); g.fill();
      const bx = cx + tilt * (lw / 2 - 18);
      g.fillStyle = rad(g, bx - 3, ly + lh / 2 - 3, 1, 14, [[0, '#ffffff'], [1, '#d9eee0']]); circle(g, bx, ly + lh / 2, 12); g.fill();
      g.fillStyle = '#efe3cf'; g.font = font(12, 700); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(green ? '수평이에요!' : tilt < 0 ? '← 왼쪽으로 기울었어요' : '오른쪽으로 기울었어요 →', cx, ly + lh + 18);
      gauge(g, 24, cy0 + 40, W - 48, { val: press, max: 1.1, lo: 0.55, hi: 0.85, label: '누르는 힘', text: press < 0.55 ? (press ? '더요' : '') : press <= 0.85 ? '좋아요!' : '너무 세요' });
      if (mode == null) return; // 조작 방식을 고르는 동안은 아래 칸에 버튼이 있다
      if (tiltAvailable() && press === 0) { // 조작 방식 바꾸기
        const c = chipBox(W, cy0);
        g.fillStyle = 'rgba(28,17,11,.78)'; rr(g, c.x, c.y, c.w, c.h, 15); g.fill();
        g.strokeStyle = 'rgba(241,218,178,.45)'; g.lineWidth = 1; rr(g, c.x, c.y, c.w, c.h, 15); g.stroke();
        g.fillStyle = '#efe3cf'; g.font = font(12, 700); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(mode === 'tilt' ? '손가락으로 바꾸기' : '폰 기울이기로 바꾸기', cx, c.y + c.h / 2 + 1);
      }
      // 아래 조작 안내: 화면 어디를 눌러도 되지만, 여기를 보며 움직이게 한다
      const padH = 62, padY = H - padH - 12 - (COUNTER - 176), padX = 12, padW = W - 24; // 아래 막대가 있는 폰이면 그만큼 올린다
      g.fillStyle = 'rgba(28,17,11,.88)'; rr(g, padX, padY, padW, padH, 16); g.fill();
      g.strokeStyle = down ? '#f0bf68' : 'rgba(241,218,178,.35)'; g.lineWidth = 2; rr(g, padX, padY, padW, padH, 16); g.stroke();
      g.fillStyle = 'rgba(241,218,178,.7)'; g.font = font(18, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('◀', padX + 24, padY + padH / 2); g.fillText('▶', padX + padW - 24, padY + padH / 2);
      const reach = padW / 2 - 70, off = !down ? 0 : mode === 'tilt' ? tilt * reach : Math.max(-reach, Math.min(reach, fingerX - startX));
      if (!down) { g.fillStyle = '#efe3cf'; g.font = font(14, 700); g.fillText(press > 0 ? '다시 꾹 눌러요' : mode === 'tilt' ? '꾹 누른 채 폰을 기울여요' : '꾹 누른 채 좌우로', cx, padY + padH / 2 + (press === 0 ? Math.sin(t * 4) * 1.5 : 0)); } else {
        g.fillStyle = '#f0bf68'; rr(g, cx + off - 34, padY + 9, 68, padH - 18, 12); g.fill();
        g.fillStyle = '#2a1b10'; g.font = font(13, 800); g.fillText(mode === 'tilt' ? '기울이기' : '좌우로', cx + off, padY + padH / 2);
      }
    });
    const finish = () => {
      const even = G.tampEvenness(samples) - (press > 0.95 ? 0.08 : 0);
      sfx.play('thud');
      tiltStop();
      done(Math.max(0, even));
    };
    ctx.setPointer({
      down: (x, y, W, H) => {
        if (mode == null) return;
        if (onChip(x, y, W, H)) { chipArmed = true; return; }
        down = true; startX = x; fingerX = x; base = tiltAngle() ?? 0; hand = 0; sfx.play('clunk');
      },
      move: (x) => { if (down) fingerX = x; },
      up: () => {
        if (chipArmed) { chipArmed = false; switchMode(); return; } // 손을 뗀 순간이어야 허용 창이 뜬다
        if (!down) return;
        down = false;
        if (press < 0.4) { ui.hint('조금 더 오래 꾹 눌러요. 초록 칸까지요.'); press = 0; samples = []; tilt = 0; return; }
        finish();
      },
    });
    ui.clearActions();
    if (ctx.auto) { samples = [0]; press = 0.7; down = false; finish(); return; }
    tampInput(ctx).then((m) => { ui.clearActions(); setMode(m); });
  });
}

// ── 4. 샷 ──
function machineHead(g, cx, top, w) {
  // 그림의 브루 헤드가 cx에 오게 놓는다
  sprite(g, 'sp-machine', cx, top + 78, w * 4, 0.6, 0.75);
}
// 나올수록 짙은 색에서 금빛으로, 너무 오래 뽑으면 옅어진다
const STREAM_COLOR = [[0, [42, 20, 9]], [0.3, [96, 52, 20]], [0.7, [178, 118, 54]], [1, [205, 156, 88]], [1.5, [226, 200, 150]]];
const CREMA_COLOR = [[0, [96, 56, 24]], [0.5, [150, 94, 40]], [1, [197, 142, 74]], [1.5, [221, 192, 140]]];
function shotSpouts(g, x, y) { // 포터필터 아래 두 갈래 주둥이. 끝자리를 돌려준다
  g.fillStyle = lin(g, x - 16, 0, x + 16, 0, [[0, '#70757a'], [0.45, '#e6e9ea'], [1, '#7c8185']]);
  rr(g, x - 6, y - 4, 12, 9, 3); g.fill();
  for (const d of [-1, 1]) { g.beginPath(); g.moveTo(x + d * 2, y + 1); g.lineTo(x + d * 13, y + 7); g.lineTo(x + d * 13, y + 13); g.lineTo(x + d * 7, y + 13); g.lineTo(x, y + 5); g.closePath(); g.fill(); }
  return [x - 10, x + 10].map((sx) => ({ x: sx, y: y + 13 }));
}
function shotStream(g, a, x1, y1, col, thick, t, seed) {
  const wob = Math.sin(t * 9 + seed) * 0.9 + Math.sin(t * 23 + seed * 2) * 0.4;
  const line = () => { g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(a.x + (x1 - a.x) * 0.2 + wob, (a.y + y1) / 2, x1 + wob * 0.5, y1); g.stroke(); };
  g.lineCap = 'round'; g.strokeStyle = col; g.lineWidth = thick; line();
  g.strokeStyle = 'rgba(255,232,190,.5)'; g.lineWidth = Math.max(0.6, thick * 0.26); line();
}

async function stepExtract(ctx, st, beat) {
  const { ui, sfx } = ctx;
  const ideal = G.idealGrind(ctx.S.day, st.menu), err = G.grindError(st.grind, ideal);
  let state = 'idle', gameT = 0, realT = 0, y = 0, fx = makeParticles(), entry = ctx.fast ? 1 : 0, dripT = 0;
  ui.hint(beat.tips?.extract || '샷 시작을 눌러요. 무게가 초록 칸이면 멈춰요.');
  const flowY = (rt) => G.shotYieldAt(rt, err, st.doseG) * G.channelFlowBoost(st.even);
  return new Promise((done) => {
    const stop = async () => {
      if (state !== 'run') return;
      state = 'stop'; sfx.stopLoops(); sfx.play('clunk'); ui.clearActions();
      await wait(ctx.fast ? 30 : 650);
      done({ realT, yieldG: y });
    };
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), cx = W / 2, w = Math.min(W * 0.2, 78), top = Math.max(TOP + 34, cy0 - 330);
      if (state === 'run') {
        gameT += dt; realT = gameT * REAL_PER_GAME; y = flowY(realT);
        if (beat.autoStop && y >= ESPRESSO.yield) stop();
        if (realT > 75) stop();
      }
      // 포터필터를 끼우는 움직임
      if (entry < 1) { entry = Math.min(1, entry + dt / 0.5); if (entry === 1) sfx.play('clunk'); }
      const e = easeOut(entry), shake = state === 'run' ? Math.sin(t * 63) * 0.6 : 0;
      machineHead(g, cx + shake, top, w);
      const pw = w * 0.72, pfY = top + 78 + (1 - e) * 46;
      g.save(); g.translate(cx + shake, pfY); g.rotate((1 - e) * -0.2);
      const tips = shotSpouts(g, 0, pw * 1.24);
      portafilter(g, 0, 0, pw, 1);
      g.restore();
      // 받침과 잔
      const R = Math.min(w * 0.9, 66);
      g.fillStyle = lin(g, 0, cy0 - 14, 0, cy0, [[0, '#a7abad'], [1, '#55595c']]); rr(g, cx - R * 1.7, cy0 - 14, R * 3.4, 14, 4); g.fill();
      g.fillStyle = 'rgba(20,18,16,.55)'; for (let i = -6; i <= 6; i++) { rr(g, cx + i * R * 0.24 - 2, cy0 - 11, 4, 4, 1); g.fill(); }
      const m = sideCup(g, cx, cy0 - 9, R);
      const ratio = y / ESPRESSO.yield, level = Math.min(1, ratio * 0.62), col = mixColor(STREAM_COLOR, ratio);
      cupLiquid(g, m, level, { body: '#35190b', crema: ratio > 0.04 ? mixColor(CREMA_COLOR, ratio) : null, flecks: Math.round(Math.min(1, ratio) * 22), ripple: state === 'run' && realT > 5 ? 1 : 0, t });
      // 처음엔 방울로 떨어지다 줄기가 되고, 멈추면 다시 방울이 된다
      const s = cupSurface(m, level), from = tips.map((p) => ({ x: cx + p.x, y: pfY + p.y }));
      const flow = state === 'run' ? clamp01((realT - 6) / 4) : 0;
      if (flow > 0) { const thick = (1.2 + flow * 1.9) * (ratio > 1.25 ? 0.72 : 1); from.forEach((a, i) => shotStream(g, a, m.x + (i ? 3 : -3), s.y, col, thick, t, i * 2)); }
      if ((state === 'run' && realT > 3 && flow < 1) || state === 'stop') {
        dripT += dt;
        if (dripT > (state === 'stop' ? 0.09 : 0.2 - flow * 0.1)) {
          dripT = 0;
          const a = from[Math.random() < 0.5 ? 0 : 1];
          fx.add({ x: a.x, y: a.y, vx: 0, vy: 30, g: 900, life: Math.sqrt(2 * Math.max(4, s.y - a.y) / 900) * 0.92, r: 1.7, c: col });
        }
      }
      fx.draw(g, dt);
      wisps(g, m.x, m.y - m.ry * 0.9, R * 1.4, 84, t, ratio > 0.12 ? Math.min(0.85, ratio) : 0);
      // 게이지
      gauge(g, 24, cy0 + 30, W - 48, { val: y, max: 60, lo: ESPRESSO.yield - ESPRESSO.yieldOk, hi: ESPRESSO.yield + ESPRESSO.yieldOk, label: '커피 양', text: `${y.toFixed(1)}g` });
      gauge(g, 24, cy0 + 66, W - 48, { val: realT, max: 50, lo: ESPRESSO.time - ESPRESSO.timeOk, hi: ESPRESSO.time + ESPRESSO.timeOk, label: '걸린 시간', text: `${realT.toFixed(0)}초`, h: 10 });
    });
    const start = () => {
      if (state !== 'idle') return;
      state = 'run'; sfx.loop('shot', 1); sfx.play('clunk');
      if (beat.autoStop) { ui.clearActions(); return; }
      ui.primary('멈추기', { tap: stop, danger: true });
    };
    ui.primary('샷 시작', { tap: start });
    if (ctx.auto) { done({ realT: ESPRESSO.time, yieldG: ESPRESSO.yield }); }
  });
}

// ── 5. 뜨거운 물 ──
async function stepWater(ctx, st, beat) {
  const { ui, sfx } = ctx;
  let water = 0, down = false;
  ui.hint(beat.tips?.water || '누르고 있으면 물이 나와요. 초록 칸에서 손을 떼요.');
  return new Promise((done) => {
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), cx = W / 2, R = Math.min(W * 0.2, 80);
      if (down) water = Math.min(water + AMERICANO.flow * dt, 320);
      g.fillStyle = lin(g, cx - 30, 0, cx + 30, 0, [[0, '#7d8180'], [0.5, '#dfe2e1'], [1, '#7d8180']]);
      rr(g, cx - 12, TOP + 8, 24, 60, 4); g.fill(); rr(g, cx - 72, TOP + 2, 96, 18, 6); g.fill();
      g.fillStyle = '#b53a2e'; circle(g, cx - 66, TOP + 11, 12); g.fill();
      const m = sideCup(g, cx, cy0 + 2, R), r = Math.min(1, water / AMERICANO.water), level = 0.3 + r * 0.66;
      const col = `rgb(${Math.round(58 + r * 30)},${Math.round(34 + r * 22)},${Math.round(18 + r * 12)})`;
      cupLiquid(g, m, level, { body: col, ripple: down ? 1 : 0, t });
      const sy = cupSurface(m, level).y;
      if (down) { g.strokeStyle = 'rgba(214,236,244,.85)'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, TOP + 68); g.lineTo(cx + Math.sin(t * 30), sy); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 2, TOP + 68); g.lineTo(cx - 2 + Math.sin(t * 30), sy); g.stroke(); }
      wisps(g, m.x, m.y - m.ry * 0.9, R * 1.4, 90, t, water > 10 ? 0.8 : 0.35);
      gauge(g, 24, cy0 + 40, W - 48, { val: water, max: 320, lo: AMERICANO.water - AMERICANO.waterOk, hi: AMERICANO.water + AMERICANO.waterOk, label: '뜨거운 물', text: `${water.toFixed(0)}g` });
    });
    ui.primary('누르고 있기', { hold: true, down: () => { down = true; sfx.loop('water', 1); }, up: () => { down = false; sfx.stopLoops(); if (water > 10) ui.secondary('다 됐어요', () => done(water)); } });
    if (ctx.auto) done(AMERICANO.water);
  });
}

// ── 6. 스팀 ──
// 금속 피처는 안이 안 보여서 몸통에 창을 내 우유와 막대 깊이를 보여 준다. 수치는 그림 속 몸통 자리를 잰 값이다
const PITCHER = { aspect: 692 / 720, l: 0.043, r: 0.735, t: 0.008, b: 0.995 };
const LATTE = { r: 0.232, cx: 0.499, cy: 0.5 }; // 위에서 본 잔 그림의 수면 자리
const LATTE_SAY = { heart: '하트가 예쁘게 떴어요!', thin: '거품이 적어서 무늬가 흐려요.', foam: '거품이 많아서 무늬가 안 그려져요.' };
const POUR_SEC = 2, LATTE_SEC = 3;

// 우유를 샷 위에 붓는 장면. p는 0~1, 거품 상태에 따라 무늬가 달라진다
function drawLatte(g, W, cx, cy0, sec, look, t) {
  const room = cy0 - TOP - 10, D = Math.min(W * 0.98, room), cy = TOP + 18 + room / 2, left = cx - D / 2, top = cy - D / 2;
  const pour = clamp01(sec / POUR_SEC), base = img('sp-latte-base'), heart = img('sp-latte-heart');
  if (base) g.drawImage(base, left, top, D, D);
  const L = { x: left + LATTE.cx * D, y: top + LATTE.cy * D, r: LATTE.r * D };
  g.save(); g.beginPath(); g.arc(L.x, L.y, L.r, 0, TAU); g.clip();
  const wash = Math.sin(Math.PI * Math.min(1, pour * 1.1)) * 0.5;
  if (look === 'thin') { // 거품이 적으면 커피색만 옅어진다
    g.fillStyle = '#d4a873'; g.globalAlpha = 0.25 + pour * 0.35; circle(g, L.x, L.y, L.r * easeOut(pour * 1.4)); g.fill(); g.globalAlpha = 1;
  } else if (look === 'foam') { // 거품이 많으면 흰 거품이 덮는다
    puff(g, L.x, L.y, L.r * 2.1 * easeOut(pour * 1.2), 0.9);
    g.fillStyle = 'rgba(214,190,150,.55)'; for (let i = 0; i < 36 * pour; i++) { const a = i * 2.399, r = Math.sqrt((i + 0.5) / 36) * L.r * 0.8; circle(g, L.x + Math.cos(a) * r, L.y + Math.sin(a) * r, 1 + (i % 3) * 0.7); g.fill(); }
  } else {
    if (wash > 0) { g.fillStyle = '#e8cfa6'; g.globalAlpha = wash; circle(g, L.x, L.y, L.r * easeOut(pour * 1.5)); g.fill(); g.globalAlpha = 1; }
    if (heart) { // 무늬가 가운데서 밀려 나오듯 커진다
      const k = 0.35 + 0.65 * pour * (2 - pour); // 천천히 잦아들며 끝 크기에 닿는다
      g.save(); g.translate(L.x, L.y); g.scale(k, k); g.translate(-L.x, -L.y); g.globalAlpha = clamp01(pour * 1.7 - 0.35); g.drawImage(heart, left, top, D, D); g.restore();
    }
  }
  g.restore();
  // 피처는 오른쪽 위에서 들어와 붓고 나간다
  const pitcher = img('sp-pitcher'), inOut = (1 - easeOut(sec / 0.3)) + clamp01((sec - POUR_SEC) / 0.35);
  const sx = L.x + L.r * 0.5 + inOut * D * 0.5, sy = L.y - L.r * 1.25 - inOut * D * 0.3;
  if (sec < POUR_SEC) {
    const lx = L.x + Math.sin(t * 7) * L.r * 0.2 * (1 - pour * 0.5), ly = L.y + (pour - 0.45) * L.r * 0.6;
    g.lineCap = 'round'; g.strokeStyle = '#fbf3e4'; g.lineWidth = 5 - pour * 2; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx - 2, (sy + ly) / 2, lx, ly); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx - 1, sy); g.quadraticCurveTo(sx - 3, (sy + ly) / 2, lx - 1, ly); g.stroke();
    g.strokeStyle = 'rgba(255,245,226,.5)'; g.lineWidth = 1.2; for (let i = 0; i < 2; i++) { const q = (t * 2 + i / 2) % 1; circle(g, lx, ly, 4 + q * L.r * 0.26); g.stroke(); }
  }
  if (pitcher && inOut < 1) {
    const w = D * 0.56;
    g.save(); g.translate(sx, sy); g.rotate(-0.9); g.drawImage(pitcher, -w * 0.02, -w * 0.02, w, w * PITCHER.aspect); g.restore();
  }
  wisps(g, L.x, L.y - L.r * 1.05, L.r * 1.5, D * 0.26, t, 0.6);
  if (sec > POUR_SEC && look === 'heart') { // 다 됐을 때 잠깐 반짝인다
    const q = clamp01((sec - POUR_SEC) / 0.8);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.399 + 0.6, r = L.r * (0.75 + (i % 3) * 0.16), s = Math.sin(Math.PI * clamp01(q * 1.6 - i * 0.12)) * 7;
      if (s <= 0) continue;
      const x = L.x + Math.cos(a) * r, y = L.y + Math.sin(a) * r;
      g.fillStyle = 'rgba(255,246,214,.95)'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.22, y - s * 0.22); g.lineTo(x + s, y); g.lineTo(x + s * 0.22, y + s * 0.22); g.lineTo(x, y + s); g.lineTo(x - s * 0.22, y + s * 0.22); g.lineTo(x - s, y); g.lineTo(x - s * 0.22, y - s * 0.22); g.closePath(); g.fill();
    }
  }
}

async function stepSteam(ctx, st, beat) {
  const { ui, sfx } = ctx;
  let m = { temp: MILK.start, foam: 0 }, depth = 0.05, on = false, last = null, alerted = false, sec = 0, look = 'heart', said = false, ended = false;
  const bubbles = makeParticles();
  ui.hint(beat.tips?.steam || '끌어서 위아래로 움직여요. 위쪽은 공기, 아래쪽은 데우기예요.');
  return new Promise((done) => {
    const finish = () => {
      if (on === 'pour') return;
      sfx.stopLoops(); ui.clearActions(); ui.hint('우유를 샷 위에 부어요.');
      look = G.latteLook(m.foam); on = 'pour'; sec = 0;
      if (ctx.fast) { done({ ...m }); return; }
      sfx.loop('pour', 0.6);
    };
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), cx = W / 2, room = H - COUNTER - TOP;
      if (on === true) {
        m = G.steamStep(m, depth, dt);
        const surface = depth < 0.34;
        sfx.loop('steam', surface ? 1 : 0.16); sfx.loop('whirl', surface ? 0.15 : 0.9);
        if (m.temp >= MILK.tempLo && !alerted) { alerted = true; sfx.play('ok'); if (beat.showTempAlert) ui.hint('온도가 초록 칸이에요! 거품도 초록이면 끝내기를 눌러요.'); }
        if (m.temp >= MILK.burn && alerted !== 'burn') { alerted = 'burn'; sfx.play('bad'); ui.hint('너무 뜨거워요! 얼른 끝내요.'); }
        if (m.temp >= 92) finish();
      }
      if (on === 'pour') {
        sec += dt;
        if (sec >= POUR_SEC && !said) { said = true; sfx.stopLoops(); sfx.play(look === 'heart' ? 'ok' : 'click'); ui.hint(LATTE_SAY[look]); }
        if (sec >= LATTE_SEC && !ended) { ended = true; done({ ...m }); }
        drawLatte(g, W, cx, cy0, Math.min(sec, LATTE_SEC), look, t);
      } else {
        // 피처: 몸통 폭과 높이는 그림 비율을 따른다
        const shake = on === true ? Math.sin(t * 58) * 0.7 : 0, bodyK = (PITCHER.aspect * (PITCHER.b - PITCHER.t)) / (PITCHER.r - PITCHER.l);
        const pw = Math.min(W * 0.3, 112, room * 0.74 / (2 * bodyK)), ph = pw * 2 * bodyK, pitcherTop = cy0 - ph + 3;
        const sw = pw * 2 / (PITCHER.r - PITCHER.l), left = cx - pw - PITCHER.l * sw + shake, topY = pitcherTop - PITCHER.t * sw * PITCHER.aspect;
        const wx = cx - pw * 0.82 + shake, ww = pw * 1.64, wy = pitcherTop + ph * 0.07, wh = ph * 0.87;
        const foamH = m.foam * ph * 0.15, surfY = wy + wh - ph * 0.48 - foamH;
        const wandX = cx - pw * 0.12, wandTop = TOP - 4, wandTip = surfY + 4 + depth * ph * 0.34, surface = depth < 0.34;
        const wand = () => { g.strokeStyle = lin(g, wandX - 4, 0, wandX + 4, 0, [[0, '#868a8c'], [0.5, '#f4f5f5'], [1, '#868a8c']]); g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(wandX, wandTop); g.lineTo(wandX, wandTip); g.stroke(); g.fillStyle = '#6f7375'; rr(g, wandX - 5, wandTip - 2, 10, 9, 3); g.fill(); };
        wand();
        const pic = img('sp-pitcher');
        if (pic) g.drawImage(pic, left, topY, sw, sw * PITCHER.aspect);
        // 창 안쪽
        g.save(); rr(g, wx, wy, ww, wh, 16); g.clip();
        g.fillStyle = lin(g, wx, 0, wx + ww, 0, [[0, '#3c4042'], [0.5, '#676c6f'], [1, '#34383a']]); g.fillRect(wx, wy, ww, wh);
        const warm = clamp01((m.temp - 20) / 45), wave = on === true ? (surface ? 3.2 : 1.1) : 0.5;
        const edge = (x) => surfY + Math.sin(x * 0.07 + t * 6) * wave + Math.sin(x * 0.17 - t * 9) * wave * 0.45;
        const body = () => { g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx, edge(wx)); for (let x = wx; x <= wx + ww; x += 6) g.lineTo(x, edge(x)); g.lineTo(wx + ww, wy + wh); g.closePath(); };
        g.fillStyle = lin(g, 0, surfY, 0, wy + wh, [[0, mixColor([[0, [255, 252, 244]], [1, [252, 240, 216]]], warm)], [1, mixColor([[0, [244, 234, 214]], [1, [238, 214, 176]]], warm)]]); body(); g.fill();
        if (on === true && !surface) { // 소용돌이: 깊이 넣으면 우유가 돈다
          for (let i = 0; i < 4; i++) {
            const yy = surfY + foamH + 18 + i * (wy + wh - surfY - foamH - 28) / 4, rx = ww * (0.42 - i * 0.05), a0 = (t * (5 - i * 0.6) + i * 1.3) % TAU;
            g.strokeStyle = `rgba(190,162,120,${0.34 - i * 0.04})`; g.lineWidth = 2.6; g.lineCap = 'round';
            g.beginPath(); g.ellipse(wandX + 8, yy, rx, 6 + i * 1.6, 0, a0, a0 + 3.4); g.stroke();
          }
        }
        // 거품 층: 공기가 들어갈수록 두꺼워진다
        if (foamH > 0.5) {
          g.fillStyle = lin(g, 0, surfY - 2, 0, surfY + foamH + 6, [[0, 'rgba(255,255,255,1)'], [0.75, 'rgba(255,252,244,.92)'], [1, 'rgba(255,252,244,0)']]);
          g.fillRect(wx, surfY - 4 - wave, ww, foamH + 12 + wave);
          const dots = foamH < 7 ? 0 : Math.round(Math.min(70, foamH * 2.4));
          for (let i = 0; i < dots; i++) {
            const a = (i * 0.7549) % 1, bb = (i * 0.5698) % 1;
            g.fillStyle = 'rgba(196,176,146,.42)'; circle(g, wx + a * ww, surfY + 2 + bb * foamH, 0.8 + (i % 3) * 0.55); g.fill();
          }
        }
        g.fillStyle = 'rgba(255,255,255,.5)'; for (let x = wx; x <= wx + ww; x += 7) { circle(g, x, edge(x), 3.2 + Math.sin(x * 1.3) * 1.4); g.fill(); }
        // 우유 속 막대는 비쳐 보인다
        g.save(); g.globalAlpha = wandTip > surfY ? 0.62 : 1; g.beginPath(); g.rect(wx, wy, ww, wh); g.clip(); wand(); g.restore();
        if (on === true && surface) {
          if (Math.random() < dt * 40) bubbles.add({ x: wandX + (Math.random() - 0.5) * 26, y: surfY, vx: (Math.random() - 0.5) * 34, vy: -34 - Math.random() * 40, g: 120, life: 0.5, max: 0.5, fade: 0.25, r: 1.4 + Math.random() * 2.2, c: '#fff' });
          puff(g, wandX, surfY - 8, 24, 0.5);
        } else if (on === true && Math.random() < dt * 18) bubbles.add({ x: wandX + (Math.random() - 0.5) * 18, y: wandTip + 4, vx: (Math.random() - 0.5) * 16, vy: -44, life: 0.4, max: 0.4, fade: 0.2, a: 0.7, r: 1.2 + Math.random(), c: '#fff8ea' });
        bubbles.draw(g, dt);
        g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(wx + ww * 0.1, wy); g.lineTo(wx + ww * 0.3, wy); g.lineTo(wx + ww * 0.06, wy + wh); g.lineTo(wx - ww * 0.14, wy + wh); g.closePath(); g.fill();
        g.restore();
        g.strokeStyle = '#555a5c'; g.lineWidth = 3; rr(g, wx, wy, ww, wh, 16); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; rr(g, wx - 2, wy - 2, ww + 4, wh + 4, 18); g.stroke();
        // 데워질수록 김이 오른다
        wisps(g, cx + pw * 0.15, pitcherTop - 2, pw * 1.3, ph * 0.34, t, clamp01((m.temp - 22) / 34) * (on === true ? 1 : 0.5));
        // 왼쪽 깊이 안내: 손을 어디 대도 되지만 지금 깊이를 여기서 본다
        const tx = Math.max(24, cx - pw - 34), ty = wy + 4, th = wh - 8, split = ty + th * 0.34, ky = ty + depth * th;
        g.fillStyle = 'rgba(20,12,7,.72)'; rr(g, tx - 12, ty - 4, 24, th + 8, 12); g.fill();
        g.fillStyle = '#d99f45'; rr(g, tx - 4, ty, 8, split - ty - 1, 4); g.fill();
        g.fillStyle = '#6ea5c2'; rr(g, tx - 4, split + 1, 8, ty + th - split - 1, 4); g.fill();
        g.fillStyle = surface ? '#ffe9b0' : '#d9eef8'; g.strokeStyle = '#201209'; g.lineWidth = 2; rr(g, tx - 10, ky - 7, 20, 14, 7); g.fill(); g.stroke();
        g.fillStyle = '#efe3cf'; g.font = font(11, 700); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillText('공기', tx, ty - 10); g.fillText('데우기', tx, ty + th + 18);
        // 상태 글
        g.fillStyle = surface ? '#ffe9b0' : '#cfe9f4'; g.font = font(13, 700);
        const say = on === true ? (surface ? '치익, 공기가 들어가요' : '뱅글뱅글, 데우고 있어요') : on === false ? '화면을 누른 채 위아래로 끌어요' : '';
        if (say) { const sw2 = g.measureText(say).width + 22; g.fillStyle = 'rgba(28,17,11,.78)'; rr(g, cx - sw2 / 2, pitcherTop - 34, sw2, 25, 12); g.fill(); g.fillStyle = surface ? '#ffe9b0' : '#cfe9f4'; g.fillText(say, cx, pitcherTop - 17); }
      }
      // 게이지
      const half = (W - 60) / 2;
      gauge(g, 24, cy0 + 40, half, { val: m.temp, max: 85, lo: MILK.tempLo, hi: MILK.tempHi, label: '온도', text: `${m.temp.toFixed(0)}℃` });
      gauge(g, 36 + half, cy0 + 40, half, { val: m.foam, max: 1, lo: MILK.foamLo, hi: MILK.foamHi, label: '거품', text: m.foam < MILK.foamLo ? '적어요' : m.foam <= MILK.foamHi ? '좋아요' : '많아요' });
    });
    ctx.setPointer({
      down: (x, y) => { last = y; if (on === false) { on = true; ui.primary('끝내기', { tap: finish }); } },
      move: (x, y) => { if (last == null || on !== true) return; depth = Math.max(0, Math.min(1, depth + (y - last) / 170)); last = y; },
      up: () => { last = null; },
    });
    ui.clearActions();
    if (ctx.auto) { on = 'auto'; done({ temp: 62, foam: 0.35 }); }
  });
}

// ── 7·8. 뜸과 붓기: 위에서 내려다본 드리퍼 ──
function drawDripTop(g, W, cx, cy, R, d, { swell = 0, t, pour = null }) {
  // 드리퍼와 종이 필터(그림). 원두 층은 물에 따라 변해서 코드로 그린다
  sprite(g, 'sp-dripper', cx, cy, R * 2.7);
  // 원두 층
  const r2 = R * (1 + swell * 0.05);
  g.fillStyle = rad(g, cx, cy, R * 0.1, r2, [[0, '#6e4628'], [1, '#573519']]); circle(g, cx, cy, r2); g.fill();
  // 젖은 자리: 칸 경계가 보이지 않게 부드러운 얼룩으로 그린다
  for (let i = 0; i < G.DRIP_CELLS; i++) {
    const w = d.wet[i]; if (w <= 0) continue;
    const ring = Math.floor(i / 8), a = ((i % 8) + 0.5) / 8 * TAU, rm = (ring + 0.5) / 3 * r2;
    const x = cx + Math.cos(a) * rm, y = cy + Math.sin(a) * rm, area = [1, 3, 5][ring], rb = r2 * [0.36, 0.3, 0.32][ring];
    const k = Math.min(0.62, w / area / 7);
    g.fillStyle = rad(g, x, y, 0, rb, [[0, `rgba(30,16,7,${k})`], [1, 'rgba(30,16,7,0)']]);
    circle(g, x, y, rb); g.fill();
  }
  // 뜸의 거품과 물 높이
  const lv = Math.min(1, d.level / 130);
  if (lv > 0.01) { g.fillStyle = `rgba(68,38,18,${0.3 + lv * 0.55})`; circle(g, cx, cy, r2 * 1.02); g.fill(); g.fillStyle = `rgba(190,140,86,${0.2 + lv * 0.35})`; for (let i = 0; i < 26; i++) { const a = i * 2.399 + t * 0.2, rr2 = r2 * Math.sqrt((i + 0.5) / 26) * 0.95; circle(g, cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2, 2.4 + (i % 3)); g.fill(); } }
  if (swell > 0.02) { g.fillStyle = 'rgba(235,204,160,.55)'; for (let i = 0; i < 30; i++) { const a = i * 2.399, rr2 = r2 * Math.sqrt((i + 0.5) / 30) * 0.9, sz = (1.5 + (i % 3)) * (0.6 + 0.4 * Math.sin(t * 3 + i)) * swell; circle(g, cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2, Math.max(0.1, sz + 1)); g.fill(); } }
  // 김
  if (d.poured > 0) { for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,.07)'; circle(g, cx + Math.sin(t + i * 2) * R * 0.5, cy - R * 0.5 - ((t * 26 + i * 30) % 80), 13 + i * 3); g.fill(); } }
}
function kettle(g, x, y, pouring, t) {
  // 구스넥 주전자: 손끝 오른쪽 위에 있고, 물줄기가 손끝으로 떨어진다
  g.save();
  if (pouring) { g.strokeStyle = 'rgba(214,236,244,.9)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x + Math.sin(t * 40) * 0.7, y); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; circle(g, x, y, 5); g.fill(); }
  // 주둥이 끝이 물줄기 위쪽에 오게 놓는다
  sprite(g, 'sp-kettle', x, y - 46, 150, 0, 0.17);
  g.restore();
}
const dripLayout = (W, H) => { const room = H - COUNTER - TOP, R = Math.min(W * 0.36, room * 0.36); return { cx: W / 2, cy: TOP + room * 0.56, R }; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function stepBloom(ctx, st, beat) {
  const { ui, sfx } = ctx, d = st.drip;
  let finger = null, waiting = 0, idle = 0, swell = 0, phase = 'pour';
  const WAIT_GAME = DRIP.bloomReal / (DRIP.time / DRIP.gameSec);
  ui.hint(beat.tips?.bloom || '원두 위를 문질러 물을 조금만 부어요. 초록 칸이면 손을 떼요.');
  ui.clearActions();
  return new Promise((done) => {
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), { cx, cy, R } = dripLayout(W, H);
      if (phase === 'pour') {
        if (finger && d.poured < 110) { G.dripStep(d, { x: (finger.x - cx) / R, y: (finger.y - cy) / R }, dt); idle = 0; sfx.loop('pour', 0.7); } else { sfx.loop('pour', 0); if (d.poured > 8) idle += dt; G.dripStep(d, null, dt); }
        // 초록 칸 전에 손을 잠깐 떼도 바로 끝나지 않게 더 기다려 준다
        if (d.poured > 8 && idle > (d.poured >= DRIP.bloomWater - DRIP.bloomOk ? 0.7 : 2.5)) { phase = 'wait'; sfx.stopLoops(); ui.hint('기다려요. 가루가 빵처럼 부풀어 올라요.'); }
      } else if (phase === 'wait') {
        waiting += dt; swell = Math.min(1, waiting / 1.8);
        G.dripStep(d, null, dt);
        if (waiting >= WAIT_GAME) { phase = 'done'; sfx.play('ok'); done(G.bloomScore(d.poured, DRIP.bloomReal)); }
      }
      drawDripTop(g, W, cx, cy, R, d, { swell, t });
      if (phase === 'pour' && !finger && d.poured === 0) { const a = t * 1.8, rr2 = R * 0.5; g.fillStyle = 'rgba(255,236,190,.85)'; circle(g, cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2, 8); g.fill(); g.fillStyle = '#efe3cf'; g.font = font(13, 700); g.textAlign = 'center'; g.fillText('원두 위를 눌러서 문질러요', cx, cy - R * 1.3 - 6); }
      if (finger) kettle(g, finger.x, finger.y, true, t);
      if (phase === 'wait') {
        const left = Math.max(0, DRIP.bloomReal * (1 - waiting / WAIT_GAME));
        g.strokeStyle = '#ffd98b'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R * 1.18, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - waiting / WAIT_GAME)); g.stroke();
        g.fillStyle = '#fff5e0'; g.font = font(Math.min(36, R * 0.42), 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${Math.ceil(left)}초`, cx, cy);
      }
      gauge(g, 24, cy0 + 40, W - 48, { val: d.poured, max: 110, lo: DRIP.bloomWater - DRIP.bloomOk, hi: DRIP.bloomWater + DRIP.bloomOk, label: '뜸 들이는 물', text: `${d.poured.toFixed(0)}g` });
    });
    ctx.setPointer({
      down: (x, y) => { if (phase === 'pour') finger = { x, y }; },
      move: (x, y) => { if (finger) finger = { x, y }; },
      up: () => { finger = null; },
    });
    if (ctx.auto) { d.poured = DRIP.bloomWater; d.t += WAIT_GAME + 2; d.level = 0; d.passed = 30; d.wet = d.wet.map((_, i) => [1, 3, 5][Math.floor(i / 8)] * 40 / 72); done(1); }
  });
}
async function stepPour(ctx, st, beat) {
  const { ui, sfx } = ctx, d = st.drip;
  d.phase = 'pour';
  let finger = null, finished = false, drained = false;
  const fx = makeParticles();
  ui.hint(beat.tips?.pour || '원을 그리며 천천히 부어요. 물 칸이 초록이면 그만 부어요.');
  ui.clearActions();
  return new Promise((done) => {
    const stopPour = () => { if (finished) return; finished = true; finger = null; sfx.stopLoops(); ui.clearActions(); ui.hint('똑… 똑… 다 내려올 때까지 기다려요.'); };
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), { cx, cy, R } = dripLayout(W, H);
      if (!finished) {
        if (finger) {
          G.dripStep(d, { x: (finger.x - cx) / R, y: (finger.y - cy) / R }, dt);
          sfx.loop('pour', 1);
          if (Math.random() < dt * 28) fx.add({ x: finger.x, y: finger.y, vx: (Math.random() - 0.5) * 34, vy: (Math.random() - 0.5) * 34, life: 0.3, fade: 0.2, r: 2 + Math.random() * 2, c: 'rgba(235,204,160,.8)' });
        } else { sfx.loop('pour', 0); G.dripStep(d, null, dt); }
        if (d.poured >= 200) ui.secondary('그만 붓기', stopPour);
        if (d.poured >= 370) stopPour();
      } else if (!drained) {
        const ff = 2.4;
        for (let i = 0; i < 3; i++) G.dripStep(d, null, dt * ff / 3);
        if (d.level < 2) { drained = true; sfx.play('ok'); done(); }
      }
      drawDripTop(g, W, cx, cy, R, d, { t });
      fx.draw(g, dt);
      // 안내 원: 고르게 부으라고 천천히 도는 점
      if (!finger && !finished) {
        const a = t * 1.1, rr2 = R * (0.42 + Math.sin(t * 0.3) * 0.38);
        g.fillStyle = 'rgba(255,236,190,.85)'; circle(g, cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2, 7); g.fill();
      }
      if (finger) kettle(g, finger.x, finger.y, true, t);
      const lv = d.level / 130;
      if (lv > 0.72 && !finished) { g.fillStyle = '#ffd38b'; g.font = font(13, 700); g.textAlign = 'center'; g.fillText('물이 넘칠 것 같아요. 잠깐 쉬어요!', cx, cy - R * 1.3 - 6); }
      const real = G.dripRealTime(d.t);
      gauge(g, 24, cy0 + 30, W - 48, { val: d.poured, max: 400, lo: DRIP.water - DRIP.waterOk, hi: DRIP.water + DRIP.waterOk, label: '부은 물', text: `${d.poured.toFixed(0)}g` });
      gauge(g, 24, cy0 + 66, W - 48, { val: real, max: 300, lo: DRIP.time - DRIP.timeOk, hi: DRIP.time + DRIP.timeOk, label: '걸린 시간', text: mmss(real), h: 10 });
    });
    ctx.setPointer({
      down: (x, y) => { if (!finished) finger = { x, y }; },
      move: (x, y) => { if (finger) finger = { x, y }; },
      up: () => { finger = null; },
    });
    if (ctx.auto) { d.poured = DRIP.water; d.t = DRIP.gameSec; d.level = 0; d.wet = d.wet.map((_, i) => [1, 3, 5][Math.floor(i / 8)] * DRIP.water / 72); done(); }
  });
}

// ── 로스팅 ──
// 온도가 오르다 1차 크랙(탁탁)이 나고, 초록 칸에서 꺼낸다
export function runRoast(ctx, ROAST) {
  const { ui, sfx } = ctx;
  let state = 'idle', temp = ROAST.start, spin = 0, nextPop = 0;
  ui.hint('시작을 눌러요. 탁탁 소리(1차 크랙)가 나면 곧 초록 칸이에요. 초록 칸에서 꺼내요.');
  return new Promise((done) => {
    const take = async () => {
      if (state !== 'run') return;
      state = 'out'; sfx.stopLoops(); sfx.play('clunk'); ui.clearActions(); ui.hint('식히는 중이에요.');
      await wait(ctx.fast ? 20 : 800);
      done(temp);
    };
    ctx.setView((g, W, H, t, dt) => {
      const cy0 = bench(g, W, H), cx = W / 2, R = Math.min(W * 0.3, (H - COUNTER - TOP) * 0.3), cy = TOP + (H - COUNTER - TOP) * 0.5;
      if (state === 'run') {
        temp += ROAST.perSec * dt; spin += dt * 5; nextPop -= dt;
        if (temp >= ROAST.crack && temp < ROAST.hi + 6 && nextPop <= 0) { sfx.play('tick'); nextPop = 0.14 + Math.random() * 0.3; }
        if (temp >= ROAST.max) take();
      }
      // 로스터 그림의 둥근 창 가운데에 원두를 그린다(창 중심 50.7%·53%, 반지름은 폭의 21.5%)
      sprite(g, 'sp-roaster', cx, cy, R * 0.86 / 0.215, 0.507, 0.53);
      const k = Math.min(1, (temp - ROAST.start) / (ROAST.max - ROAST.start));
      const col = `rgb(${Math.round(148 - k * 105)},${Math.round(142 - k * 110)},${Math.round(82 - k * 62)})`;
      g.save(); circle(g, cx, cy, R * 0.8); g.clip();
      g.fillStyle = col;
      for (let i = 0; i < 46; i++) {
        const a = i * 2.399 + spin * (i % 2 ? 1 : 0.8), r = R * 0.74 * Math.sqrt((i + 0.5) / 46), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r + R * 0.12;
        g.beginPath(); g.ellipse(x, y, R * 0.08, R * 0.05, a, 0, TAU); g.fill();
      }
      g.restore();
      if (state === 'run' && temp >= ROAST.crack) { g.fillStyle = '#ffd98b'; g.font = font(14, 800); g.textAlign = 'center'; g.fillText('탁탁!', cx, cy - R * 1.2); }
      gauge(g, 24, cy0 + 40, W - 48, { val: temp, min: ROAST.start, max: ROAST.max, lo: ROAST.lo, hi: ROAST.hi, label: '원두 온도', text: `${temp.toFixed(0)}℃` });
    });
    ui.primary('로스팅 시작', { tap: () => { if (state !== 'idle') return; state = 'run'; sfx.loop('whirl', 0.8); ui.primary('꺼내기', { tap: take, danger: true }); } });
    if (ctx.auto) { done((ROAST.lo + ROAST.hi) / 2); }
  });
}

// ── 한 잔 ──
// 메뉴 단계를 차례로 돌린다. do에 없는 단계는 오너가 대신해 기준값으로 채운다.
export async function runBrew(ctx, beat, opts = {}) {
  const menu = beat.menu, steps = MENUS[menu].steps, isDrip = menu === 'drip';
  const ideal = G.idealGrind(ctx.S.day, menu), target = opts.target ?? 0;
  const st = { menu, advice: opts.advice, grind: ideal, doseG: isDrip ? DRIP.dose : ESPRESSO.dose, even: 0.95, bloom: 1 };
  if (beat.lockGrind != null) st.grind = G.clampGrind(ideal + beat.lockGrind);
  else if (opts.useDial) st.grind = ctx.S.dial[isDrip ? 'drip' : 'espresso'];
  ctx.ui.setSteps(steps, beat.do, -1, beat.title || MENUS[menu].name);
  if (isDrip) st.drip = G.newDrip(0, DRIP.dose);
  let shot = { realT: ESPRESSO.time, yieldG: ESPRESSO.yield }, water = AMERICANO.water, milk = { temp: 62, foam: 0.35 };
  if (opts.autoErr != null && !beat.do.includes('extract') && !isDrip) { // 머신이 아침 칸으로 뽑아 둔 샷
    let t = 0;
    while (t < 90 && G.shotYieldAt(t, opts.autoErr, st.doseG) < ESPRESSO.yield) t += 0.1;
    shot = { realT: t, yieldG: ESPRESSO.yield };
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    ctx.ui.setSteps(steps, beat.do, i, beat.title || MENUS[menu].name);
    if (!beat.do.includes(step)) continue;
    ctx.setPointer(null); ctx.ui.clearActions();
    if (step === 'grind') st.grind = await stepGrind(ctx, st, beat);
    else if (step === 'dose') st.doseG = await stepDose(ctx, st, beat);
    else if (step === 'tamp') st.even = await stepTamp(ctx, st, beat);
    else if (step === 'extract') shot = await stepExtract(ctx, st, beat);
    else if (step === 'water') water = await stepWater(ctx, st, beat);
    else if (step === 'steam') milk = await stepSteam(ctx, st, beat);
    else if (step === 'bloom') { st.drip.grindErr = G.grindError(st.grind, ideal); st.bloom = await stepBloom(ctx, st, beat); } else if (step === 'pour') { st.drip.grindErr = G.grindError(st.grind, ideal); await stepPour(ctx, st, beat); }
    ctx.sfx.play('click');
  }
  ctx.setPointer(null); ctx.ui.clearActions(); ctx.sfx.stopLoops();
  // 플레이어가 직접 한 단계만 항목으로 삼는다. 사장님이 대신한 단계는 점수에 넣지 않는다
  const did = (x) => beat.do.includes(x), parts = [];
  const part = (label, value, sc) => parts.push({ label, value, sc });
  const shotAssisted = !opts.useDial && opts.autoErr == null;
  const assisted = shotAssisted && (steps.some((x) => !did(x)) || !!beat.grindHint || beat.lockGrind != null);
  let taste, detail = '';
  if (isDrip) {
    const d = st.drip, even = G.dripEvenness(d.wet), real = G.dripRealTime(d.t);
    taste = G.dripTaste({ gameT: d.t, water: d.poured });
    if (did('dose')) part('담기', `${st.doseG.toFixed(1)}g`, G.hit(Math.abs(st.doseG - DRIP.dose), DRIP.doseOk, 4));
    if (did('bloom')) part('뜸', `${Math.round(st.bloom * 100)}점`, st.bloom);
    part('고르게 붓기', `${Math.round(even * 100)}%`, G.evenHit(even));
    part('물 양', `${d.poured.toFixed(0)}g`, G.hit(Math.abs(d.poured - DRIP.water), DRIP.waterOk, 60));
    part('걸린 시간', mmss(real), G.hit(Math.abs(real - DRIP.time), DRIP.timeOk, 60));
    detail = `${d.poured.toFixed(0)}g · ${mmss(real)}`;
    if (d.over > 20) part('넘친 물', `${d.over.toFixed(0)}g`, G.hit(d.over, 20, 80));
  } else {
    taste = G.shotTaste(shot);
    if (menu === 'americano') taste = Math.max(-1, Math.min(1, taste + G.waterTasteShift(water)));
    if (did('dose')) part('담기', `${st.doseG.toFixed(1)}g`, G.hit(Math.abs(st.doseG - ESPRESSO.dose), ESPRESSO.doseOk, 3));
    if (did('tamp')) part('다지기', `수평 ${Math.round(st.even * 100)}%`, G.evenHit(st.even));
    if (did('extract')) part('커피 양', `${shot.yieldG.toFixed(1)}g`, G.hit(Math.abs(shot.yieldG - ESPRESSO.yield), ESPRESSO.yieldOk, 10));
    if (did('extract') || did('grind')) part('걸린 시간', `${shot.realT.toFixed(0)}초`, G.hit(Math.abs(shot.realT - ESPRESSO.time), ESPRESSO.timeOk, 9));
    if (did('water')) part('물', `${water.toFixed(0)}g`, G.scoreWater(water));
    detail = `${shot.yieldG.toFixed(1)}g · ${shot.realT.toFixed(0)}초`;
    if (did('steam')) {
      const ms = G.scoreMilk(milk);
      part('우유 온도', `${milk.temp.toFixed(0)}℃`, ms.tempScore);
      part('거품', ms.foamScore >= 1 ? '좋아요' : milk.foam > MILK.foamHi ? '많아요' : '적어요', ms.foamScore);
    }
  }
  if (isDrip || did('extract') || did('grind') || opts.autoErr != null) part('맛', tasteWord(taste, target), G.hit(Math.abs(taste - target), TASTE_GOOD, 0.5));
  const score = G.mixScore(parts.map((p) => p.sc)), band = G.tasteBand(taste, target);
  const stars = Math.min(G.starsOf(score, band), assisted ? 2 : 3);
  return { menu, taste, score, stars, band, target, detail, parts, assisted, grind: st.grind, milk: did('steam') ? milk : null };
}
const tasteWord = (taste, target) => { const d = taste - target; return Math.abs(d) <= TASTE_GOOD ? '딱 좋아요' : d < 0 ? (d < -TASTE_OK ? '많이 시큼' : '살짝 시큼') : (d > TASTE_OK ? '많이 씀' : '살짝 씀'); };
export { STEP_NAME };
