// 대화·이야기 화면. 이미지 모델로 만든 배경과 인물(assets.js)을 겹쳐 그린다. 좌표는 CSS 픽셀(W×H).
import { PEOPLE } from './data.js';
import { img, portraitOf } from './assets.js';

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

export function drawCup(g, x, y, s, fill = '#5a371f') {
  g.save();
  g.strokeStyle = '#f2e9d9'; g.lineWidth = s * 0.14; g.beginPath(); g.arc(x + s * 0.72, y + s * 0.36, s * 0.26, -1.2, 1.2); g.stroke();
  g.fillStyle = lin(g, x - s, y, x + s, y, [[0, '#fff8ea'], [0.6, '#f0e3cd'], [1, '#d7c6ab']]);
  g.beginPath(); g.moveTo(x - s * 0.78, y); g.lineTo(x + s * 0.78, y); g.bezierCurveTo(x + s * 0.72, y + s * 0.74, x + s * 0.44, y + s * 0.98, x + s * 0.2, y + s); g.lineTo(x - s * 0.2, y + s); g.bezierCurveTo(x - s * 0.44, y + s * 0.98, x - s * 0.72, y + s * 0.74, x - s * 0.78, y); g.fill();
  g.fillStyle = fill; g.beginPath(); g.ellipse(x, y + s * 0.04, s * 0.68, s * 0.13, 0, 0, TAU); g.fill();
  g.fillStyle = '#e4d3b5'; g.beginPath(); g.ellipse(x, y + s * 1.03, s * 0.82, s * 0.09, 0, 0, TAU); g.fill();
  g.restore();
}

export const personOf = (id, choices) => {
  if (id === 'hero') return PEOPLE[`hero${choices.hero}`];
  if (id === 'owner') return PEOPLE[`owner${choices.owner}`];
  return PEOPLE[id];
};

// ── 그림 놓기 ──────────────────────────────
// 화면을 꽉 채우고 가운데 위를 맞춘다. 그림 안 비율 좌표를 화면 좌표로 바꾸는 함수도 돌려준다
export function cover(g, im, W, H) {
  const k = Math.max(W / im.width, H / im.height), ox = (W - im.width * k) / 2, oy = 0;
  g.drawImage(im, ox, oy, im.width * k, im.height * k);
  return { k, ox, oy, x: (f) => ox + f * im.width * k, y: (f) => oy + f * im.height * k };
}
export function rainOverlay(g, x, y, w, h, t, count = 30, alpha = 0.32) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = `rgba(232,242,250,${alpha})`; g.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const sp = 330 + noise(i) * 240, px = x + noise(i + 9) * w, py = y + (noise(i + 40) * h + t * sp) % h;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px - 1.2, py + 8 + noise(i) * 8); g.stroke();
  }
  g.restore();
}
// 인물: 아래 끝(by)과 높이로 놓는다. 숨 쉬듯 아주 살짝 움직인다
export function drawBust(g, name, cx, by, h, t = 0) {
  const im = img(name);
  if (!im) return;
  const w = h * im.width / im.height, lift = Math.sin(t * 1.4 + cx) * h * 0.003;
  g.drawImage(im, cx - w / 2, by - h + lift, w, h);
}

// ── 바 화면 ────────────────────────────────
const COUNTER_Y = 0.786; // 배경 그림에서 앞 카운터 윗면 높이(비율)
const barWeather = (w) => (w === 'cloud' || w === 'rain' ? w : w === 'shower' ? 'rain' : 'sun'); // 소나기는 비 배경(DESIGN 5.10절)
function drawBarBack(g, W, H, place, weather, t) {
  const im = img(`bar-${place}-${barWeather(weather)}`);
  if (!im) { g.fillStyle = '#2a1b12'; g.fillRect(0, 0, W, H); return null; }
  const c = cover(g, im, W, H);
  if (weather === 'rain' || weather === 'shower') rainOverlay(g, c.x(0), c.y(0.11), c.x(0.74) - c.x(0), c.y(0.5), t, 22, 0.22);
  c.im = im; c.counter = c.y(COUNTER_Y);
  return c;
}
function drawBarFront(g, c, W, H) {
  if (!c) return;
  g.save(); g.beginPath(); g.rect(0, c.counter, W, H - c.counter); g.clip();
  g.drawImage(c.im, c.ox, c.oy, c.im.width * c.k, c.im.height * c.k);
  g.restore();
}
function cafePlate(g, W, cafe) {
  if (!cafe) return;
  g.font = font(13, 800);
  const tw = Math.min(W * 0.6, g.measureText(cafe).width + 26), x = W / 2 - tw / 2, y = 54;
  g.fillStyle = 'rgba(28,17,11,.78)'; rr(g, x, y, tw, 25, 7); g.fill();
  g.fillStyle = '#f4d8a4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cafe, W / 2, y + 13, tw - 10);
}
// people: [{ name, x(0~1), scale }] 왼쪽부터
function barScene(g, W, H, { place, weather, t, cafe, people }) {
  const c = drawBarBack(g, W, H, place, weather, t), counter = c ? c.counter : H * COUNTER_Y;
  for (const p of people) drawBust(g, p.name, W * p.x, counter + H * 0.02, H * 0.47 * (p.scale || 1), t);
  drawBarFront(g, c, W, H);
  cafePlate(g, W, cafe);
}
export function drawBar(g, W, H, { place, weather, t, cafe, front, frontMood = 'calm', choices }) {
  const name = front ? portraitOf(front, choices, frontMood) : null;
  barScene(g, W, H, { place, weather, t, cafe, people: name ? [{ name, x: 0.5 }] : [] });
}

// 가게 밖 장면(박람회 등): 그림 한 장 위에 인물을 세운다
export function drawScene(g, W, H, { bg, t, front, frontMood = 'calm', choices }) {
  const im = img(bg) || img('bg-fair'); // 새 배경 그림이 아직 없으면 박람회장으로 대신한다
  if (im) cover(g, im, W, H); else { g.fillStyle = '#2a1b12'; g.fillRect(0, 0, W, H); }
  if (front) drawBust(g, portraitOf(front, choices, frontMood), W / 2, H * 0.8, H * 0.47, t);
}

// ── 가게 앞 ────────────────────────────────
const SIGN = { home: { x0: 0.14, x1: 0.91, y: 0.303 }, office: { x0: 0.14, x1: 0.78, y: 0.445 } };
export function drawFront(g, W, H, { place, cafe, t, night = false, weather = 'sun' }) {
  const im = img(`front-${place}-${night ? 'night' : 'day'}`);
  if (!im) { g.fillStyle = '#2a1b12'; g.fillRect(0, 0, W, H); return null; }
  const c = cover(g, im, W, H), s = SIGN[place];
  if (cafe) {
    const sw = c.x(s.x1) - c.x(s.x0), cx = (c.x(s.x0) + c.x(s.x1)) / 2;
    g.fillStyle = '#f7dfae'; g.font = font(Math.min(32, sw * 0.13), 800); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 5; g.fillText(cafe, cx, c.y(s.y), sw * 0.9); g.shadowBlur = 0;
  }
  if (weather === 'rain' || weather === 'shower') rainOverlay(g, 0, 0, W, H, t, 44, 0.3);
  return c;
}

// ── 이야기 그림 ────────────────────────────
function backOf(g, W, H, name) {
  const im = img(name);
  if (!im) { g.fillStyle = '#17110c'; g.fillRect(0, 0, W, H); return null; }
  return cover(g, im, W, H);
}
const twoShot = (g, W, H, ctx, left, right) => barScene(g, W, H, {
  place: ctx.choices.place, weather: 'sun', t: ctx.t, cafe: ctx.choices.cafe,
  people: [{ name: left, x: 0.28, scale: 0.88 }, { name: right, x: 0.73, scale: 0.88 }],
});
export const CUTS = {
  night: (g, W, H, ctx) => {
    backOf(g, W, H, 'cut-night');
    drawBust(g, portraitOf('hero', ctx.choices, 'tired', 'suit'), W / 2, H * 0.87, H * 0.5, ctx.t);
  },
  sketch: (g, W, H) => { backOf(g, W, H, 'cut-sketch'); },
  encounter: (g, W, H, ctx) => {
    const { choices, t } = ctx, place = choices.place;
    drawFront(g, W, H, { place, cafe: choices.cafe, t });
    drawBust(g, portraitOf('owner', choices, 'smile'), W * 0.71, H * 0.87, H * 0.37, t);
    drawBust(g, portraitOf('hero', choices, place === 'office' ? 'tired' : 'calm', place === 'office' ? 'suit' : 'casual'), W * 0.29, H * 0.87, H * 0.4, t);
  },
  notice: (g, W, H, ctx) => {
    const c = backOf(g, W, H, 'cut-notice');
    if (!c) return;
    rainOverlay(g, 0, 0, W, H, ctx.t, 30, 0.2);
    g.save(); g.translate(c.x(0.51), c.y(0.485)); g.rotate(0.012);
    const pw = c.x(0.5) - c.x(0);
    g.fillStyle = '#3a2b1f'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = font(Math.min(17, pw * 0.09), 700);
    g.fillText('이번 달까지만', 0, -pw * 0.2); g.fillText('문을 열어요.', 0, -pw * 0.08);
    g.font = font(Math.min(14, pw * 0.075), 500); g.fillText('그동안 고마웠어요.', 0, pw * 0.1);
    g.font = font(Math.min(11, pw * 0.06), 500); g.fillStyle = '#7a6856'; g.fillText(`「${ctx.choices.cafe}」`, 0, pw * 0.27, pw * 0.8);
    g.restore();
  },
  decide: (g, W, H, ctx) => {
    const hTalk = ctx.who === 'hero', { choices } = ctx;
    twoShot(g, W, H, ctx, portraitOf('hero', choices, 'calm', 'suit'), portraitOf('owner', choices, hTalk ? 'surprised' : 'smile'));
  },
  apron: (g, W, H, ctx) => {
    const { choices, t } = ctx;
    barScene(g, W, H, { place: choices.place, weather: 'sun', t, cafe: choices.cafe, people: [{ name: portraitOf('hero', choices, 'calm'), x: 0.5 }] });
  },
  junior: (g, W, H, ctx) => {
    const happy = ctx.index >= 6, { choices } = ctx;
    twoShot(g, W, H, ctx, portraitOf('hero', choices, 'smile'), portraitOf('junior', choices, happy ? 'smile' : 'tired'));
  },
  key: (g, W, H, ctx) => {
    const { choices } = ctx;
    twoShot(g, W, H, ctx, portraitOf('hero', choices, 'calm'), portraitOf('owner', choices, 'smile'));
    const im = img('sp-key');
    if (im) { const w = W * 0.2, h = w * im.height / im.width; g.drawImage(im, W * 0.4, H * 0.8 - h * 0.86, w, h); }
  },
  sign: (g, W, H, ctx) => {
    drawFront(g, W, H, { place: ctx.choices.place, cafe: ctx.choices.cafe, t: ctx.t, night: true });
    drawBust(g, portraitOf('hero', ctx.choices, 'smile'), W * 0.5, H * 0.87, H * 0.38, ctx.t);
  },
};
export function drawTitleBg(g, W, H, t) {
  drawFront(g, W, H, { place: 'home', cafe: '', t, night: true, weather: 'rain' });
  g.fillStyle = lin(g, 0, 0, 0, H * 0.42, [[0, 'rgba(25,14,8,.86)'], [1, 'rgba(25,14,8,0)']]); g.fillRect(0, 0, W, H * 0.42);
  g.fillStyle = lin(g, 0, H * 0.62, 0, H, [[0, 'rgba(25,14,8,0)'], [1, 'rgba(25,14,8,.96)']]); g.fillRect(0, H * 0.62, W, H * 0.38);
}
