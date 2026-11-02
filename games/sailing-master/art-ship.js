import { VIEW } from './data.js';
// 배 그림. 선체는 높이별 단면을 그려 방향마다 쌓은 그림을 미리 구워 두고(층 쌓기), 돛·돛대·선장처럼 움직이는 것은 매 프레임 그린다.
// 배 좌표: x 뱃머리 쪽, y 우현 쪽, z 위쪽. 단위 m.

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CELL = 256, COLS = 8, DIRS = 64, PX = 20; // 아틀라스 한 칸 256px, 1m = 20px, 64방향 = 2048×2048
const CENTER_Y = CELL / 2 + 22; // 수면 기준점(높이만큼 위로 그려서 아래로 내려 둠)

const L = 9, B = 3, DECK = 1.0, DZ = 0.075;
const PAINT = { hull: '#f6f1e6', hullDark: '#dcd5c5', stripe: '#1f6d8c', boot: '#274a60', bottom: '#a8483a', deck: '#c79c63', deckDark: '#a97f4b', cap: '#8a5b34', cabin: '#fbf7ee', cabinTop: '#e9e2d0', glass: '#23475a', floor: '#7f5a36' };

// 뱃머리 끝이 뾰족하고 뒤가 넓은 슬루프 윤곽. s: -1 고물 ~ 1 뱃머리
const planW = (s) => (B / 2) * Math.pow(Math.max(0, Math.sin(PI * (0.2 + 0.8 * (s + 1) / 2))), 0.72);
const flare = (z) => 0.74 + 0.26 * clamp(z / DECK, 0, 1);
const rake = (z) => 0.88 + 0.12 * clamp(z / 1.4, 0, 1);
const sheerZ = (s) => DECK + 0.42 * Math.max(0, s) ** 2.2;

function hullPath(g, z, inset = 0, from = -1) {
  const n = 34, top = [], bot = [], f = flare(z), r = rake(z);
  for (let i = 0; i <= n; i++) {
    const s = from + (1 - from) * i / n, x = s * (L / 2) * r, w = Math.max(0, planW(s) * f - inset);
    top.push([x, -w]); bot.push([x, w]);
  }
  g.beginPath();
  g.moveTo(...top[0]);
  for (const p of top) g.lineTo(...p);
  for (const p of bot.reverse()) g.lineTo(...p);
  g.closePath();
}
function roundRect(g, x0, y0, x1, y1, r) {
  g.moveTo(x0 + r, y0);
  g.arcTo(x1, y0, x1, y1, r); g.arcTo(x1, y1, x0, y1, r); g.arcTo(x0, y1, x0, y0, r); g.arcTo(x0, y0, x1, y0, r);
  g.closePath();
}

function sliceAt(g, z) {
  // 윗면이 올라가는 뱃머리: 높이 z를 넘는 부분은 그만큼 앞쪽만 남는다
  let from = -1;
  if (z > DECK) from = Math.pow((z - DECK) / 0.42, 1 / 2.2);
  if (from >= 0.98) return;
  const color = z < 0.08 ? PAINT.bottom : z < 0.17 ? PAINT.boot : z < 0.72 ? PAINT.hull : z < 0.83 ? PAINT.stripe : z < DECK - 0.05 ? PAINT.hull : PAINT.cap;
  hullPath(g, z, 0, from);
  g.fillStyle = color; g.fill();
  if (z > DECK - 0.05) {
    // 갑판: 앞쪽이 올라가도 윗면은 나무 판
    hullPath(g, z, 0.14, from);
    g.fillStyle = PAINT.deck; g.fill();
    g.save(); hullPath(g, z, 0.14, from); g.clip();
    g.strokeStyle = PAINT.deckDark; g.lineWidth = 0.025;
    for (let y = -1.6; y < 1.6; y += 0.22) { g.beginPath(); g.moveTo(-5, y); g.lineTo(5, y); g.stroke(); }
    g.restore();
  }
}

function drawCockpit(g, z) {
  // 고물 쪽 움푹한 조종석: 갑판보다 낮은 층에서 구멍을 판다
  if (z < 0.6 || z > DECK + 0.02) return;
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); roundRect(g, -3.7, -0.72, -1.55, 0.72, 0.28); g.fill();
  g.restore();
}
function drawCockpitFloor(g, z) {
  if (Math.abs(z - 0.56) > DZ * 0.6) return;
  g.beginPath(); roundRect(g, -3.8, -0.8, -1.45, 0.8, 0.3); g.fillStyle = PAINT.floor; g.fill();
  g.strokeStyle = 'rgba(40,24,10,.35)'; g.lineWidth = 0.02;
  for (let x = -3.6; x < -1.5; x += 0.2) { g.beginPath(); g.moveTo(x, -0.75); g.lineTo(x, 0.75); g.stroke(); }
}
function drawCabin(g, z) {
  if (z < DECK || z > DECK + 0.7) return;
  const top = z > DECK + 0.62;
  g.beginPath();
  roundRect(g, -1.45, -0.86, 1.25, 0.86, 0.42);
  g.fillStyle = top ? PAINT.cabinTop : PAINT.cabin; g.fill();
  if (z > DECK + 0.22 && z < DECK + 0.42) {
    // 옆창: 벽을 이루는 층의 가장자리에 어두운 조각
    g.strokeStyle = PAINT.glass; g.lineWidth = 0.09; g.lineCap = 'butt';
    for (const [x0, x1] of [[-1.1, -0.5], [-0.25, 0.35], [0.6, 1.0]]) for (const y of [-0.86, 0.86]) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  }
  if (top) {
    g.strokeStyle = 'rgba(120,100,70,.5)'; g.lineWidth = 0.03;
    g.beginPath(); roundRect(g, -0.9, -0.42, -0.05, 0.42, 0.1); g.stroke();
    g.fillStyle = 'rgba(90,120,140,.55)'; g.beginPath(); roundRect(g, -0.8, -0.32, -0.15, 0.32, 0.08); g.fill();
  }
}
function drawDeckBits(g, z) {
  if (Math.abs(z - (DECK + 0.05)) > DZ * 0.6) return;
  g.fillStyle = '#e8e0cc'; g.beginPath(); roundRect(g, 2.1, -0.34, 2.75, 0.34, 0.08); g.fill(); // 앞 해치
  g.strokeStyle = PAINT.cap; g.lineWidth = 0.05; g.beginPath(); roundRect(g, 2.1, -0.34, 2.75, 0.34, 0.08); g.stroke();
}

// 바라보는 방향(heading)마다 층을 쌓아 한 장에 굽는다. 조명은 세상 기준이라 칸마다 입힌다
export function bakeShip() {
  const layers = [];
  const size = CELL;
  for (let z = 0; z <= DECK + 0.74; z += DZ) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    g.setTransform(PX, 0, 0, PX, size / 2, size / 2);
    sliceAt(g, z);
    drawCockpit(g, z);
    drawCockpitFloor(g, z);
    drawDeckBits(g, z);
    drawCabin(g, z);
    layers.push({ c, z });
  }
  const atlas = document.createElement('canvas');
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
  return { atlas, layers: layers.length };
}

export const shipSprite = { CELL, COLS, DIRS, PX, CENTER_Y };

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

const MAST_X = 0.75, MAST_H = 12.6, BOOM_Z = 2.3, BOOM_L = 4.2;
const HEAD_FULL = MAST_H - 0.2;

// 큰 돛 격자: 줄마다 앞(돛대)에서 뒤로 점을 내고, 바람받이 반대로 불룩하게 민다
function mainMesh(P, boom, now, luff, t, flapAmp) {
  const rows = 7, cols = 5, head = BOOM_Z + (HEAD_FULL - BOOM_Z) * (0.22 + 0.78 * now);
  const cb = Math.cos(boom), sb = Math.sin(boom);
  const clew = [MAST_X - BOOM_L * cb, BOOM_L * sb, BOOM_Z + 0.05];
  const belly = (luff ? 0.2 : 0.62) * Math.sign(boom || 1), mesh = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows, lz = BOOM_Z + (head - BOOM_Z) * v;
    const lx = MAST_X, ly = 0, rx = clew[0] + (MAST_X - clew[0]) * v * 0.96, ry = clew[1] * (1 - v * 0.96), rz = clew[2] + (head - clew[2]) * v;
    const row = [];
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      let bulge = belly * Math.sin(PI * u) * (1 - v) ** 0.7;
      if (luff) bulge += flapAmp * Math.sin(u * 6 + v * 5 - t * 11) * u * (1 - v * 0.6);
      const nx = sb, ny = cb; // 돛대-돛끝 선에 수직인 방향(수평)
      row.push(P(lx + (rx - lx) * u + nx * bulge * Math.sign(boom || 1) * Math.sign(boom || 1), ly + (ry - ly) * u + ny * bulge, lz + (rz - lz) * u));
    }
    mesh.push(row);
  }
  return mesh;
}
function jibMesh(P, boom, now, luff, t, flapAmp) {
  const rows = 5, cols = 4, k = clamp((now - 0.6) / 0.4, 0, 1);
  if (k <= 0) return null;
  const side = Math.sign(boom || 1), a = Math.abs(boom) * 0.8 + 0.1;
  const tack = [4.25, 0, 1.45], head = [MAST_X + 0.25, 0, BOOM_Z + (HEAD_FULL - BOOM_Z) * 0.86 * k + 0.2];
  const clew = [MAST_X + 0.15 + (3 - 3 * Math.cos(a)) * 0.2, side * (0.5 + 2.6 * Math.sin(a)) * k, 1.65];
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
function drawMesh(g, mesh, color) {
  const rows = mesh.length - 1;
  for (let j = 0; j < rows; j++) {
    const a = mesh[j], b = mesh[j + 1];
    // 위아래 줄이 어느 쪽으로 기우는지로 밝기를 정한다(같은 색이면 평평해 보인다)
    let area = 0;
    const n = a.length - 1;
    for (let i = 0; i < n; i++) area += (a[i + 1][0] - a[i][0]) * (b[i][1] - a[i][1]) - (a[i + 1][1] - a[i][1]) * (b[i][0] - a[i][0]);
    const front = area > 0;
    const v = j / rows;
    const k = (front ? 1 : 0.8) * (0.9 + 0.1 * v);
    g.fillStyle = `rgb(${color[0] * k | 0},${color[1] * k | 0},${color[2] * k | 0})`;
    g.beginPath();
    g.moveTo(a[0][0], a[0][1]);
    for (let i = 1; i <= n; i++) g.lineTo(a[i][0], a[i][1]);
    for (let i = n; i >= 0; i--) g.lineTo(b[i][0], b[i][1]);
    g.closePath(); g.fill();
    // 판 사이 틈이 보이지 않게 같은 색으로 한 번 그어 준다
    g.strokeStyle = g.fillStyle; g.lineWidth = 0.6; g.stroke();
  }
  // 천 이음선
  g.strokeStyle = 'rgba(120,100,70,.28)'; g.lineWidth = 0.7;
  for (let j = 1; j < rows; j++) { const a = mesh[j]; g.beginPath(); g.moveTo(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) g.lineTo(a[i][0], a[i][1]); g.stroke(); }
}

function line(g, P, a, b, color, w) {
  const p = P(...a), q = P(...b);
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
}
const SAIL_CREAM = [250, 243, 226], JIB_CREAM = [247, 235, 214];

// 사람: 작은 원통 몸 + 머리 + 모자. pose는 앉기(row)·서기
function drawCaptain(g, P, x, y, z, zoom, rowPhase) {
  const s = Math.max(1, zoom / 6.5);
  const lean = rowPhase === null ? 0 : Math.cos(rowPhase) * 0.34;
  const base = P(x, y, z), top = P(x + lean, y, z + (rowPhase === null ? 1.1 : 0.82));
  g.lineCap = 'round';
  g.strokeStyle = '#25506f'; g.lineWidth = 3.2 * s;
  g.beginPath(); g.moveTo(base[0], base[1]); g.lineTo(top[0], top[1]); g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(top[0], top[1] - 2.1 * s, 1.8 * s, 0, TAU); g.fill();
  g.fillStyle = '#fbfbf6'; g.beginPath(); g.ellipse(top[0], top[1] - 3.3 * s, 2.5 * s, 1 * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#1b3550'; g.fillRect(top[0] - 2 * s, top[1] - 3.6 * s, 4 * s, 0.6 * s);
}

// 수면 그늘과 비친 돛(선체보다 먼저 그린다)
export function drawShipOnWater(g, st, zoom, sx, sy) {
  const { P } = st;
  const head = BOOM_Z + (HEAD_FULL - BOOM_Z) * (0.22 + 0.78 * st.sailNow);
  const clew = [MAST_X - BOOM_L * Math.cos(st.boom), BOOM_L * Math.sin(st.boom), BOOM_Z];
  // 선체 그늘
  g.save();
  g.translate(sx, sy); g.scale(1, VIEW.tiltY); g.rotate(st.h);
  g.fillStyle = 'rgba(14,50,70,.28)';
  g.beginPath(); g.ellipse(0.1 * zoom, 0.25 * zoom, 4.9 * zoom, 1.95 * zoom, 0, 0, TAU); g.fill();
  g.restore();
  if (st.sailNow < 0.05) return;
  // 돛 그림자(해가 왼쪽 위라 오른쪽 아래로)
  const shade = (a) => { const [wx, wy] = rotateLocal(a, st.h); return [sx + (wx + a[2] * 0.38) * zoom, sy + (wy + a[2] * 0.2) * VIEW.tiltY * zoom]; };
  g.fillStyle = 'rgba(14,50,70,.14)';
  const pts = [[MAST_X, 0, BOOM_Z], [MAST_X, 0, head], clew].map(shade);
  g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[1]); g.lineTo(...pts[2]); g.closePath(); g.fill();
  // 비친 돛: 위아래가 뒤집혀 물결에 흔들린다
  g.fillStyle = 'rgba(255,250,235,.08)';
  const mir = [[MAST_X, 0, -BOOM_Z], [MAST_X, 0, -head], [clew[0], clew[1], -clew[2]]].map((a) => { const [wx, wy] = rotateLocal(a, st.h); return [sx + wx * zoom + Math.sin(a[2] + st.t * 2) * 1.4, sy + (wy * VIEW.tiltY - a[2] * VIEW.tiltZ) * zoom]; });
  g.beginPath(); g.moveTo(...mir[0]); g.lineTo(...mir[1]); g.lineTo(...mir[2]); g.closePath(); g.fill();
}
const rotateLocal = (a, h) => [a[0] * Math.cos(h) - a[1] * Math.sin(h), a[0] * Math.sin(h) + a[1] * Math.cos(h)];

// 배 전체: 선체 그림 한 장 + 그 위의 돛대·돛·사람
export function drawShip(g, sprite, st, zoom, sx, sy) {
  const { h, heel, pitch, bob, sailNow, boom, luff, t, row, rowPhase, flagFrom } = st;
  const { atlas } = sprite;
  const P = st.P;
  // 가까운 방향을 고르고, 남은 각은 화면에서 살짝 돌려 끊김을 숨긴다
  const f = ((h / TAU) % 1 + 1) % 1 * DIRS, idx = Math.round(f) % DIRS, rest = (f - Math.round(f)) * TAU / DIRS;
  const k = zoom / PX;
  const sxa = (idx % COLS) * CELL, sya = Math.floor(idx / COLS) * CELL;
  // 왼쪽으로 기울어도 선체 그림은 한 장이라, 화면에서 보이는 기울기만큼 돌린다
  const screenRoll = -heel * Math.sin(h) * 0.9 + pitch * Math.cos(h) * 0.7;
  g.save();
  g.translate(sx, sy - bob * VIEW.tiltZ * zoom);
  g.rotate(screenRoll + rest * VIEW.tiltY);
  g.scale(k, k);
  g.drawImage(atlas, sxa, sya, CELL, CELL, -CELL / 2, -CENTER_Y, CELL, CELL);
  g.restore();

  const items = [];
  const mastBase = P(MAST_X, 0, DECK + 0.65), mastTop = P(MAST_X, 0, MAST_H);
  const boomEnd = [MAST_X - BOOM_L * Math.cos(boom), BOOM_L * Math.sin(boom), BOOM_Z];
  const flapAmp = 0.34;
  const s = Math.max(1, zoom / 6.5);

  items.push({ d: mastBase[2], draw() {
    line(g, P, [MAST_X, 0, DECK + 0.65], [MAST_X, 0, MAST_H], '#6b4a2e', 1.8 * s);
    line(g, P, [MAST_X, 0, MAST_H - 0.05], [4.25, 0, 1.45], 'rgba(60,50,40,.55)', 0.6 * s);
    line(g, P, [MAST_X, 0, MAST_H - 0.05], [-4.05, 0, DECK + 0.1], 'rgba(60,50,40,.45)', 0.6 * s);
    line(g, P, [MAST_X, 0, BOOM_Z], boomEnd, '#6b4a2e', 1.5 * s);
    // 돛대 꼭대기 깃발: 바람 부는 쪽으로 날린다
    const fx = mastTop[0], fy = mastTop[1];
    const ang = flagFrom;
    const dx = -Math.cos(ang) * 6.5 * s, dy = -Math.sin(ang) * 6.5 * s * VIEW.tiltY;
    const w = Math.sin(t * 7) * 1.2 * s;
    g.fillStyle = '#d6443a';
    g.beginPath(); g.moveTo(fx, fy - 1.6 * s); g.quadraticCurveTo(fx + dx * 0.5, fy + dy * 0.5 + w - 0.6 * s, fx + dx, fy + dy + w * 1.6);
    g.quadraticCurveTo(fx + dx * 0.5, fy + dy * 0.5 + w + 0.6 * s, fx, fy + 1.6 * s); g.closePath(); g.fill();
  } });

  if (sailNow >= 0.05) {
    const main = mainMesh(P, boom, sailNow, luff, t, flapAmp);
    items.push({ d: (main[3][2][2]) - 0.01, draw() { drawMesh(g, main, SAIL_CREAM); } });
    const jib = jibMesh(P, boom, sailNow, luff, t, flapAmp);
    if (jib) items.push({ d: jib[2][2][2], draw() { drawMesh(g, jib, JIB_CREAM); } });
  } else {
    // 내린 돛은 활대 위에 말아 둔다
    items.push({ d: mastBase[2] + 0.01, draw() { line(g, P, [MAST_X, 0, BOOM_Z + 0.14], [boomEnd[0], boomEnd[1], BOOM_Z + 0.14], '#efe6cf', 3.2 * s); } });
  }

  // 사람: 평소엔 고물 키 옆에 서고, 노 저을 땐 가운데 앉는다
  const man = row ? [-1.9, 0, 0.72] : [-3.1, 0, 0.72];
  const manP = P(...man);
  items.push({ d: manP[2], draw() {
    drawCaptain(g, P, man[0], man[1], man[2], zoom, row ? rowPhase : null);
    if (!row) {
      // 키 손잡이
      const rud = st.rudder * 0.5;
      line(g, P, [-4.35, 0, 1.08], [-2.9, -rud * 1.3, 1.14], '#6b4a2e', 1.3 * s);
    }
  } });
  if (row) items.push({ d: manP[2] + 0.01, draw() { drawOars(g, P, rowPhase, s); } });

  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}

function drawOars(g, P, phase, s) {
  const swing = Math.cos(phase) * 0.8, dip = Math.sin(phase);
  for (const side of [-1, 1]) {
    const pin = [-1.45, side * 1.32, DECK + 0.02];
    const blade = [pin[0] + swing * 2.6, side * 4.1, dip > 0 ? -0.05 : 0.5 + (-dip) * 0.45];
    const hand = [pin[0] - swing * 0.72, side * 0.28, DECK + 0.16];
    line(g, P, hand, blade, '#7a5230', 1.2 * s);
    const a = P(...blade), b = P(blade[0] - swing * 0.2, side * 4.9, blade[2]);
    g.strokeStyle = '#e8d7a8'; g.lineWidth = 3 * s; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
}

// 노 끝이 물에 닿는 자리(물결 고리를 만들 때 쓴다)
export function oarBladeLocal(phase, side) {
  const swing = Math.cos(phase) * 0.8;
  return [-1.45 + swing * 2.6, side * 4.4];
}
