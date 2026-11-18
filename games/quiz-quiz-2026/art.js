// 도트 무대(2026-11-14 대니님 확정 화풍): C '브라운관 대결형' 배치 + C '오락실 원색' + 2~2.5등신 치비.
// 480×270 픽셀 버퍼에 그리고 화면에는 통째로 키운다. 사람·소품은 2배 도트(zoom)로 그려 무대보다 큰 픽셀로 또렷하게 보인다.
// 픽셀 버퍼·디더링은 좀비 아웃포스트 title.js와 같은 방식(정수 좌표에 한 칸씩, 반투명은 4×4 바이어 디더링)이다.
// 움직이지 않는 배경은 한 번 그려 두고(문제가 떠 있을 때 쓰는 어두운 판도 따로), 매 프레임 사람·불빛·이펙트만 덧그린다.

import { drawPerson, drawDuo, LOOKS } from './chars.js';

export const W = 480, H = 270;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y, a) => BAYER[(y & 3) * 4 + (x & 3)] < a * 16;
const C = (hex) => (0xff000000 | (parseInt(hex.slice(5, 7), 16) << 16) | (parseInt(hex.slice(3, 5), 16) << 8) | parseInt(hex.slice(1, 3), 16)) >>> 0;

// 고정 팔레트 32색: 거의 검정 바탕 + 오락실 원색(빨강·노랑·파랑·초록·주황·흰색) + 팀 주황/하늘 + 피부·머리·옷
export const P = {
  ink: C('#0C0C1A'), ink2: C('#16162E'), ink3: C('#24244A'), grid: C('#2E2E78'),
  red: C('#E8302F'), red2: C('#9A1C24'), yellow: C('#FFD23A'), yellow2: C('#C8920E'),
  blue: C('#2F5BEA'), blue2: C('#1C348C'), green: C('#2FBF5A'), green2: C('#1A7A3A'),
  orange: C('#FF7A1A'), orange2: C('#B04E10'), sky: C('#4CC3FF'), sky2: C('#1F78B8'),
  white: C('#FFFFFF'), grey: C('#A4A4BC'), grey2: C('#565670'), cream: C('#FFF2C8'),
  skin: C('#F6C99C'), skin2: C('#D8946A'), hair: C('#1A1418'), hair2: C('#3A2A30'),
  pink: C('#FF8FB0'), pink2: C('#D0507A'), purple: C('#8A4FD8'), brown: C('#6B4426'),
  olive: C('#6E6A2C'), navy: C('#1E2A5A'), navy2: C('#33468A'), lblue: C('#8FD0FF'),
};
const TEAM = [{ c: P.orange, c2: P.orange2 }, { c: P.sky, c2: P.sky2 }];

class Px {
  constructor(w, h) { this.w = w; this.h = h; this.img = new ImageData(w, h); this.u = new Uint32Array(this.img.data.buffer); }
  set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.u[y * this.w + x] = c; }
  rect(x, y, w, h, c, a = 1) { x = Math.round(x); y = Math.round(y); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (a >= 1 || dith(i, j, a)) this.set(i, j, c); }
  disc(cx, cy, r, c, a = 1) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && (a >= 1 || dith(x, y, a))) this.set(x, y, c); }
  tri(x0, y0, x1, y1, x2, y2, c, a = 1) { // 채운 삼각형
    const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
    const e = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (let y = Math.max(minY, -50); y <= Math.min(maxY, this.h + 50); y++) {
      const xs = [];
      for (const [ax, ay, bx, by] of e) if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      const x0r = Math.max(-1, Math.round(xs[0])), x1r = Math.min(this.w + 1, Math.round(xs[xs.length - 1]));
      for (let x = x0r; x < x1r; x++) if (a >= 1 || dith(x, y, a)) this.set(x, y, c);
    }
  }
  copy(o) { this.u.set(o.u); }
  sprite(rows, x, y, map, flip = false) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = map[row[flip ? row.length - 1 - i : i]]; if (c) this.set(x + i, y + j, c); } });
  }
}

// 확대 도트: 기준점(ax, ay)을 중심으로 한 칸을 k×k로 그린다
function zoom(px, ax, ay, k = 2) {
  const z = Object.create(Px.prototype);
  z.w = px.w * 8; z.h = px.h * 8;
  z.set = (x, y, c) => px.rect(Math.round(ax + (Math.floor(x) - ax) * k), Math.round(ay + (Math.floor(y) - ay) * k), k, k, c);
  return z;
}

// ---------- 배치(index.html의 DOM 배치와 맞춘다) ----------
export const LAYOUT = {
  podium: [{ x: 6, w: 102 }, { x: 372, w: 102 }], podiumTop: 198,
  duoX: [57, 423], duoFeet: 198,
  hostX: [184, 298], hostFeet: 88, booth: { x: 140, y: 54, w: 200, h: 36 },
};

// ---------- 정적 배경 ----------
function buildBack(dim) {
  const px = new Px(W, H);
  px.rect(0, 0, W, H, P.ink);
  // 오락실 원색 조명 기둥(위에서 비스듬히 내려온다)
  const beams = [[60, P.red, 0.9], [150, P.green, 0.25], [330, P.blue, -0.25], [420, P.yellow, -0.9]];
  for (const [x, c, tilt] of beams) {
    px.tri(x - 6, 0, x + 6, 0, x + tilt * 170 + 34, 200, c, dim ? 0.08 : 0.16);
    px.tri(x - 6, 0, x + tilt * 170 - 34, 200, x + tilt * 170 + 34, 200, c, dim ? 0.08 : 0.16);
  }
  // 뒷벽 원색 패널(오락실 간판 느낌, 디더링으로 은은하게)
  for (const [x, c] of [[20, P.red], [100, P.green], [356, P.blue], [436, P.yellow]]) px.rect(x, 40, 24, 110, c, dim ? 0.06 : 0.14);
  // 바닥: 원근 격자(소실점은 화면 가운데)
  const VY = 150;
  for (let y = 160; y < H; y++) for (let x = 0; x < W; x++) if (dith(x, y, 0.35)) px.set(x, y, P.ink2);
  for (let k = -14; k <= 14; k++) for (let y = 160; y < H; y++) { const t = (y - VY) / (H - VY); px.set(240 + k * 6 + k * 34 * t, y, P.grid); }
  for (let i = 0; i < 9; i++) { const y = Math.round(160 + i * i * 1.4); if (y < H) for (let x = 0; x < W; x++) px.set(x, y, P.grid); }
  // 가운데 빛줄기
  for (let y = 0; y < H; y++) { const w = 2 + y * 0.03; for (let x = Math.floor(240 - w); x < 240 + w; x++) if (dith(x, y, 0.5)) px.set(x, y, P.lblue); }
  // 위쪽 트러스
  px.rect(0, 0, W, 4, P.ink3); px.rect(0, 4, W, 1, P.grey2);
  if (dim) for (let y = 5; y < H; y++) for (let x = 0; x < W; x++) if (dith(x, y, 0.45)) px.set(x, y, P.ink);
  return px;
}
let BACK = null, BACK_DIM = null;
const back = (dim) => (dim ? (BACK_DIM ??= buildBack(true)) : (BACK ??= buildBack(false)));

function drawPodium(px, tm, lit, t) {
  const { x, w } = LAYOUT.podium[tm], top = LAYOUT.podiumTop, { c, c2 } = TEAM[tm];
  px.rect(x - 2, top, w + 4, 5, P.white); px.rect(x - 2, top + 4, w + 4, 1, P.grey);
  px.rect(x, top + 5, w, H - top - 5, c);
  px.rect(tm ? x : x + w - 10, top + 5, 10, H - top - 5, c2);
  for (let y = top + 12; y < H; y += 12) px.rect(tm ? x + 14 : x + 4, y, w - 18, 1, c2, 0.5);
  // 팀 기호: A는 ▲, B는 ●(색약이어도 모양으로 구분)
  const cx = x + (tm ? w / 2 + 5 : w / 2 - 5), cy = top + 38;
  if (tm) { px.disc(cx, cy, 15, P.ink); px.disc(cx, cy, 12, P.white); px.disc(cx, cy, 9, c); }
  else { px.tri(cx, cy - 18, cx - 19, cy + 15, cx + 19, cy + 15, P.ink); px.tri(cx, cy - 12, cx - 14, cy + 11, cx + 14, cy + 11, P.white); px.tri(cx, cy - 6, cx - 9, cy + 8, cx + 9, cy + 8, c); }
  // 차례 팀: 노란 빛 테두리와 깜빡이는 전구, 위에서 내리는 노란 조명
  if (lit) {
    const fx = x, fy = 112, fw = w, fh = top - fy, on = Math.floor(t * 6) % 2;
    px.tri(fx + fw / 2 - 10, 5, fx + fw / 2 + 10, 5, fx + fw - 4, top, P.yellow, 0.08);
    px.tri(fx + fw / 2 - 10, 5, fx + 4, top, fx + fw - 4, top, P.yellow, 0.08);
    for (let i = 0; i < fw; i++) { px.set(fx + i, fy, P.yellow); px.set(fx + i, fy + 1, P.yellow2); }
    for (let j = 0; j < fh; j++) { px.set(fx, fy + j, P.yellow); px.set(fx + 1, fy + j, P.yellow2); px.set(fx + fw - 1, fy + j, P.yellow); px.set(fx + fw - 2, fy + j, P.yellow2); }
    for (let k = 0; k < 8; k++) px.rect(fx + 6 + k * ((fw - 12) / 7) - 1, fy - 1, 3, 3, (k + on) % 2 ? P.cream : P.yellow);
  }
}

// 인물(진행자·듀오·반짝이)은 chars.js가 1배 픽셀로 정교하게 그린다
export { DUOS, DUO_IDS } from './chars.js';

// ---------- 무대 그리기 ----------
// state: { t, turn, duo:[id,id], react:[], talk, cardFlip, banjjak, think:[], cheer, dim, vs:null|{ t0, kind:'vs'|'win', team } }
export function createStage(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const px = new Px(W, H), parts = [];
  let chick = null, bowFx = null, bell = null;

  function confetti(n = 80) {
    const cols = [P.red, P.yellow, P.blue, P.green, P.orange, P.white, P.pink];
    for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: -Math.random() * 60, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 40, c: cols[i % cols.length], life: 4 });
  }
  function burst(x, y, n = 40) { // 정답 순간 꽃가루 폭발
    const cols = [P.red, P.yellow, P.blue, P.green, P.orange, P.white];
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 90; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, c: cols[i % cols.length], life: 1.6, g: 120 }); }
  }
  function chicken(team) { chick = { x: LAYOUT.duoX[team], y: -30, vy: 0, t: 0, bounce: 0 }; }
  function bowFly() { bowFx = { x: LAYOUT.hostX[1], y: LAYOUT.hostFeet - 40, t: 0 }; }
  function ring(team) { bell = { team, t: 0 }; burst(LAYOUT.duoX[team], 120); }

  function draw(s, dt) {
    const t = s.t;
    px.copy(back(s.dim));
    // 트러스 전구(돌아가는 원색 불빛)
    const bulbs = [P.red, P.yellow, P.blue, P.green];
    for (let k = 0; k < 40; k++) px.rect(4 + k * 12, 1, 3, 2, (Math.floor(t * 6) + k) % 4 === 0 ? P.white : bulbs[k % 4]);
    // 진행자: 부스 뒤에서 고개를 내민다(작게). 말하는 사람은 쑥 올라온다
    const up = (who) => (s.talk === who ? -5 : 0) + (Math.floor(t * 1.5 + (who === 'na' ? 1 : 0)) % 2 ? -1 : 0);
    const [nx, wx] = LAYOUT.hostX, hf = LAYOUT.hostFeet;
    const f4 = Math.floor(t * 6) % 4, blink = (t % 3.7) < 0.12;
    drawPerson(px, nx, hf + up('na'), LOOKS.na, { arms: s.talk === 'na' ? ['mic', 'out'] : ['mic', 'down'], face: s.talk === 'na' ? 'idle' : 'smug', talk: s.talk === 'na', frame: f4, blink });
    drawPerson(px, wx, hf + up('wang'), LOOKS.wang,
      { arms: s.talk === 'wang' ? ['out', 'card'] : ['down', 'card'], face: s.talk === 'wang' ? 'happy' : s.cardFlip ? 'shock' : 'idle', talk: s.talk === 'wang', frame: f4, blink, noBow: !!bowFx, bowSpin: Math.floor(t * 6) });
    // 부스 앞판(진행자 아랫몸을 가린다)
    const b = LAYOUT.booth;
    px.rect(b.x, b.y, b.w, b.h, P.navy); px.rect(b.x, b.y, b.w, 2, P.yellow); px.rect(b.x, b.y + b.h - 2, b.w, 2, P.yellow2);
    px.rect(b.x + 4, b.y + 6, b.w - 8, b.h - 12, P.blue2);
    for (let x = b.x + 8, k = 0; x < b.x + b.w - 6; x += 12, k++) { const c = (Math.floor(t * 4) + k) % 3 ? P.cream : P.red; px.rect(x, b.y + 3, 2, 2, c); px.rect(x, b.y + b.h - 5, 2, 2, c); }
    // 두 팀 단상과 듀오
    for (const tm of [0, 1]) drawPodium(px, tm, s.turn === tm || s.turn === 'both', t);
    for (const tm of [0, 1]) drawDuo(px, s.duo[tm], LAYOUT.duoX[tm], LAYOUT.duoFeet - 1, s.react[tm], t, { dir: tm ? -1 : 1, think: s.think?.[tm] });
    // 반짝이(롤러스케이트로 화면 아래를 가로지른다)
    if (s.banjjak != null) {
      const x = Math.round(-40 + s.banjjak * (W + 80)), slip = Math.floor(t * 10) % 7 === 0;
      drawPerson(px, x, 268 - (slip ? 2 : 0), LOOKS.banjjak, { arms: ['up', 'out'], lean: slip ? 3 : 0, face: slip ? 'shock' : 'happy', frame: Math.floor(t * 6) % 4 });
    }
    // 정답 종
    if (bell) {
      bell.t += dt;
      const bx = LAYOUT.duoX[bell.team] + (bell.team ? -40 : 40), by = 104, sw = Math.round(Math.sin(bell.t * 18) * 2), bz = zoom(px, bx, by);
      bz.rect(bx - 4 + sw, by - 6, 8, 7, P.yellow); bz.rect(bx - 5 + sw, by + 1, 10, 2, P.yellow2); bz.rect(bx - 1 + sw, by - 8, 2, 2, P.yellow2); bz.rect(bx - 1 + sw, by + 3, 2, 2, P.orange2); bz.rect(bx - 3 + sw, by - 5, 1, 4, P.cream);
      if (bell.t > 1.4) bell = null;
    }
    // 고무 닭
    if (chick) {
      chick.t += dt; chick.vy += 420 * dt; chick.y += chick.vy * dt;
      if (chick.y > 98 && chick.vy > 0) { chick.y = 98; chick.vy = -chick.vy * 0.45; chick.bounce++; }
      const cx = Math.round(chick.x), cy = Math.round(chick.y);
      zoom(px, cx, cy).sprite(CHICK, cx - 6, cy, { r: P.red, w: P.yellow, k: P.ink, y: P.orange }, chick.bounce % 2 === 1);
      if (chick.t > 2.6) chick = null;
    }
    // 날아가는 나비넥타이(천재 등장)
    if (bowFx) {
      bowFx.t += dt;
      const k = bowFx.t, x = bowFx.x + k * 110, y = bowFx.y - k * 60 + k * k * 22, w = [6, 3, 1, 3][Math.floor(k * 12) % 4];
      px.rect(x - w - 2, y - 3, w, 7, P.red); px.rect(x + 3, y - 3, w, 7, P.red); px.rect(x - 1, y - 2, 4, 4, P.red2);
      for (let i = 1; i < 6; i++) px.set(x - i * 7, y + i * 3, P.white);
      if (k > 2.4) bowFx = null;
    }
    // 방청석 머리(단상 사이 아래 끝, 박수 칠 때 들썩인다)
    for (let i = 0; i < 14; i++) {
      const x = 124 + i * 18, upk = s.cheer && (Math.floor(t * 6) + i) % 2 === 0 ? 3 : 0;
      px.disc(x, 268 - upk, 7, i % 4 === 3 ? P.hair2 : P.hair); px.rect(x - 3, 263 - upk, 3, 1, P.grey2);
      if (s.cheer && upk) { px.rect(x - 8, 256, 2, 6, P.skin2); px.rect(x + 7, 256, 2, 6, P.skin2); }
    }
    // 꽃가루
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt; p.vy += (p.g ?? 0) * dt; p.x += (p.vx + (p.g ? 0 : Math.sin(p.y / 9) * 10)) * dt; p.y += p.vy * dt;
      if (p.life <= 0 || p.y > H) { parts.splice(i, 1); continue; }
      const flip = Math.floor(p.y / 5) % 2;
      px.rect(p.x, p.y, flip ? 3 : 2, flip ? 2 : 3, p.c);
    }
    if (s.vs) drawVs(px, s, t);
    ctx.putImageData(px.img, 0, 0);
  }
  return { draw, confetti, chicken, bowFly, ring };
}

// 대결 시작은 두 팀 클로즈업과 VS 폭발, 정답 순간은 맞힌 팀 클로즈업
function drawVs(px, s, t) {
  const v = s.vs, k = Math.min(1, (t - v.t0) / 0.25);
  // 배경을 덮는 굵은 원색 집중선(오락실 느낌, 디더링 없이 또렷하게)
  const cx = 240, cy = 135, rot = t * 0.6;
  const base = v.kind === 'vs' ? P.red2 : v.team ? P.sky2 : P.orange2, cols = v.kind === 'vs' ? [P.red, P.yellow] : v.team ? [P.sky, P.white] : [P.orange, P.yellow];
  px.rect(0, 0, W, H, base);
  for (let i = 0; i < 16; i++) {
    const a0 = rot + (i / 16) * Math.PI * 2, a1 = a0 + Math.PI / 16, r = 400;
    px.tri(cx, cy, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cols[i % 2]);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, (y - cy) * 1.6); if (d > 250 && dith(x, y, Math.min(1, (d - 250) / 60))) px.set(x, y, P.ink); }
  if (v.kind === 'vs') {
    const sp = 1 + Math.sin(t * 20) * 0.08;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r1 = (i % 2 ? 26 : 48) * sp, a2 = a + Math.PI / 12;
      px.tri(cx, cy, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a2) * 18, cy + Math.sin(a2) * 18, P.yellow);
      px.tri(cx, cy, cx + Math.cos(a) * r1 * 0.6, cy + Math.sin(a) * r1 * 0.6, cx + Math.cos(a2) * 11, cy + Math.sin(a2) * 11, P.white);
    }
    const off = (1 - k) * 220;
    drawDuo(px, s.duo[0], 110 - off, 268, null, t, { k: 2, dir: 1 });
    drawDuo(px, s.duo[1], 370 + off, 268, null, t, { k: 2, dir: -1 });
  } else {
    drawDuo(px, s.duo[v.team], 240, 268, 'win', t, { k: 2, dir: v.team ? -1 : 1 });
  }
}

const CHICK = [
  '....rr......',
  '...rrr......',
  '..wwww......',
  '.wwkwww.....',
  'yywwwwww....',
  '..wwwwwww.ww',
  '..wwwwwwwwww',
  '...wwwwwwww.',
  '....wwwwww..',
  '.....y..y...',
  '.....y..y...',
];

// ---------- 타이틀 ----------
const FONT = {
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
let LOGO_PX = null;
export function drawLogo(canvas, t = 0) {
  const ctx = canvas.getContext('2d');
  if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
  const px = (LOGO_PX ??= new Px(W, H));
  px.copy(back(false));
  // 글자: 외곽선을 먼저 모두 그리고 그 위에 채운다(통통 튀는 예능 자막 느낌)
  const word = (s, y, sc, cols, line) => {
    const adv = 6 * sc + 3, wd = s.length * adv - sc - 3, x0 = Math.round((W - wd) / 2), cells = [];
    [...s].forEach((ch, k) => (FONT[ch] ?? FONT[' ']).forEach((row, j) => {
      for (let i = 0; i < 5; i++) if (row[i] === '#') cells.push([x0 + k * adv + i * sc, y + j * sc + Math.round(Math.sin(t * 4 + k * 0.7) * 2), k, j]);
    }));
    for (const [x, yy] of cells) px.rect(x - 2, yy - 2, sc + 4, sc + 6, line);
    for (const [x, yy, k, j] of cells) { px.rect(x, yy, sc, sc, cols[k % cols.length]); if (j < 2) px.rect(x, yy, sc, 1, P.white); }
  };
  word('QUIZ QUIZ', 22, 5, [P.red, P.yellow, P.blue, P.green], P.ink);
  word('2026', 70, 4, [P.white], P.red2);
  const f4 = Math.floor(t * 4) % 4;
  drawPerson(px, 70, 220, LOOKS.wang, { arms: ['card', 'up'], face: 'happy', talk: true, frame: f4, bowSpin: Math.floor(t * 6) }, 1);
  drawPerson(px, 410, 220, LOOKS.na, { arms: ['out', 'mic'], face: 'idle', talk: true, frame: f4 + 1 }, 1, true);
  ctx.putImageData(px.img, 0, 0);
}

// 팀 고르기 카드용 듀오 미리보기(100×88)
export function drawDuoCard(canvas, id, t = 0) {
  const w = 100, h = 88, px = new Px(w, h), ctx = canvas.getContext('2d');
  canvas.width = w; canvas.height = h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(x, y, dith(x, y, (y / h) * 0.6) ? P.ink3 : P.ink2);
  for (let x = 0; x < w; x++) px.set(x, 85, P.grid);
  drawDuo(px, id, 50, 84, 'idle', t, { k: 1, dir: 1 });
  ctx.putImageData(px.img, 0, 0);
}

// 시상식 금 트로피(48×48, 투명 바탕)
export function drawTrophy(canvas) {
  const s = 48, px = new Px(s, s), ctx = canvas.getContext('2d');
  canvas.width = s; canvas.height = s;
  px.disc(24, 16, 13, P.yellow2); px.rect(11, 3, 26, 13, P.yellow2);
  px.disc(24, 15, 11, P.yellow); px.rect(13, 4, 22, 11, P.yellow);
  px.rect(16, 6, 3, 14, P.cream);
  for (const sx of [5, 37]) { px.rect(sx, 7, 6, 2, P.yellow2); px.rect(sx + (sx < 20 ? 0 : 4), 7, 2, 9, P.yellow2); px.rect(sx, 14, 6, 2, P.yellow2); }
  px.rect(21, 28, 6, 6, P.yellow2); px.rect(16, 34, 16, 4, P.yellow); px.rect(12, 38, 24, 7, P.red); px.rect(14, 40, 20, 3, P.red2);
  px.rect(20, 10, 8, 2, P.red);
  ctx.putImageData(px.img, 0, 0);
}
