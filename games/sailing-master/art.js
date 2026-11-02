import { VIEW } from './data.js';
import { outlines, scatter, dist } from './world.js';
// 물·땅·나무 그림. 파일 없이 코드로 그리고, 반복되는 것은 오프스크린에 미리 그려 찍는다(매 프레임 비용을 낮추려고).

const TAU = Math.PI * 2;
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return [c, c.getContext('2d')]; }
function hash(x, y) { let s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

export const WATER = { deep: '#2c8aa4', mid: '#3a9fb4' };

// 이어 붙여도 이음새가 없는 물결 무늬 한 장
function waveTile(size, count, strokeW, seed, light) {
  const [c, g] = canvas(size, size);
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = hash(i, seed) * size, y = hash(seed, i * 1.7) * size;
    const L = size * (0.018 + hash(i * 2.3, seed) * 0.032), curve = L * (0.35 + hash(i, seed * 3) * 0.45);
    const a = (0.06 + hash(i * 4, seed) * 0.2) * (light ? 1 : 0.8);
    g.strokeStyle = light ? `rgba(226,250,250,${a})` : `rgba(14,70,96,${a})`;
    g.lineWidth = strokeW * (0.6 + hash(i, 9) * 0.9);
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      g.beginPath(); g.moveTo(x + ox - L, y + oy); g.quadraticCurveTo(x + ox, y + oy - curve, x + ox + L, y + oy); g.stroke();
    }
  }
  return c;
}

// 잔바람이 스치는 어두운 물결 덩어리
function pawSprite() {
  const [c, g] = canvas(256, 128);
  const gr = g.createRadialGradient(128, 64, 8, 128, 64, 128);
  gr.addColorStop(0, 'rgba(10,58,84,.5)'); gr.addColorStop(0.6, 'rgba(10,58,84,.2)'); gr.addColorStop(1, 'rgba(10,58,84,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 32); g.fillStyle = gr; g.fillRect(0, -64, 256, 384); // 위아래가 잘리면 물 위에 가로 경계선이 보인다
  return c;
}

function grassTile() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#6da64c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = hash(i, 1) * 256, y = hash(2, i) * 256, r = hash(i, 3);
    g.fillStyle = r < 0.5 ? 'rgba(66,120,50,.35)' : r < 0.9 ? 'rgba(132,186,86,.35)' : 'rgba(240,226,120,.5)';
    g.fillRect(x, y, 2 + hash(i, 4) * 4, 1.2);
  }
  return c;
}
function sandTile() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#e8d9ae'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = hash(i, 5) < 0.5 ? 'rgba(170,146,100,.28)' : 'rgba(255,248,220,.4)';
    g.fillRect(hash(i, 6) * 256, hash(7, i) * 256, 1.6, 1.2);
  }
  return c;
}

// 땅 층: d(m)만큼 뭍으로 옮긴 윤곽의 바깥을 채운다. 뒤로 갈수록 뭍 쪽이다
const LAND_LAYERS = [
  { d: -16, fill: 'rgba(120,205,205,.13)' },
  { d: -9, fill: 'rgba(138,216,208,.18)' },
  { d: -4, fill: 'rgba(170,228,212,.26)' },
  { d: -1.2, fill: 'rgba(214,226,190,.62)' },
  { d: 0, tex: 'wet', fill: '#c9b98d' },
  { d: 1.2, tex: 'sand' },
  { d: 5.5, fill: '#7a5a36' },   // 흙 둑
  { d: 5.5, lift: 1.5, tex: 'grass' },
];

function landPath(d) {
  const p = new Path2D();
  // 바깥 큰 사각형 + 호수 구멍(evenodd) + 섬은 다시 채워진다
  p.rect(-3000, -3000, 6000, 6000);
  for (const poly of outlines(d)) {
    p.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) p.lineTo(poly[i][0], poly[i][1]);
    p.closePath();
  }
  return p;
}

// 나무·덤불·바위 그림(바닥 가운데가 기준점)
function treeSprite(kind, v) {
  const S = 22;
  if (kind === 'pine') {
    const H = 13, W = 6.4, [c, g] = canvas(W * S, H * S);
    const cx = W * S / 2, by = H * S - S * 0.9;
    g.fillStyle = 'rgba(18,50,40,.28)'; g.beginPath(); g.ellipse(cx + S * 0.3, by + S * 0.1, W * S * 0.42, S * 0.8, 0, 0, TAU); g.fill();
    g.fillStyle = '#5a4228'; g.fillRect(cx - S * 0.3, by - S * 2, S * 0.6, S * 2.2);
    const dark = v < 0.5 ? '#2f6b4a' : '#2a6252', lit = v < 0.5 ? '#478a5c' : '#3e7f66';
    for (let i = 0; i < 4; i++) {
      const y = by - S * (1.6 + i * 2.5), w = S * (2.9 - i * 0.55), h = S * 3.6;
      g.fillStyle = dark; g.beginPath(); g.moveTo(cx, y - h); g.lineTo(cx + w, y); g.quadraticCurveTo(cx, y + S * 0.8, cx - w, y); g.closePath(); g.fill();
      g.fillStyle = lit; g.beginPath(); g.moveTo(cx - S * 0.05, y - h); g.lineTo(cx - w * 0.96, y - S * 0.06); g.quadraticCurveTo(cx - w * 0.4, y + S * 0.26, cx + w * 0.08, y + S * 0.2); g.closePath(); g.fill();
    }
    return { c, W, H, ox: W / 2, oy: H - 0.9 };
  }
  if (kind === 'oak') {
    const H = 11, W = 9, [c, g] = canvas(W * S, H * S);
    const cx = W * S / 2, by = H * S - S * 0.9;
    g.fillStyle = 'rgba(18,50,40,.28)'; g.beginPath(); g.ellipse(cx + S * 0.4, by + S * 0.1, W * S * 0.42, S * 1, 0, 0, TAU); g.fill();
    g.fillStyle = '#634a2c'; g.beginPath(); g.moveTo(cx - S * 0.55, by); g.lineTo(cx - S * 0.32, by - S * 4); g.lineTo(cx + S * 0.32, by - S * 4); g.lineTo(cx + S * 0.55, by); g.closePath(); g.fill();
    const base = v < 0.5 ? ['#3f7d3f', '#5a9c4a', '#79b75a'] : ['#4d8a38', '#6da545', '#92c35f'];
    const blobs = [[0, -6.4, 3.6], [-2.2, -5.2, 2.5], [2.3, -5.3, 2.5], [-1, -7.8, 2.2], [1.3, -7.5, 2.2]];
    for (const [x, y, r] of blobs) { g.fillStyle = base[0]; g.beginPath(); g.arc(cx + x * S, by + y * S, r * S, 0, TAU); g.fill(); }
    for (const [x, y, r] of blobs) { g.fillStyle = base[1]; g.beginPath(); g.arc(cx + (x - 0.35) * S, by + (y - 0.35) * S, r * S * 0.76, 0, TAU); g.fill(); }
    for (const [x, y, r] of blobs) { g.fillStyle = base[2]; g.beginPath(); g.arc(cx + (x - 0.7) * S, by + (y - 0.7) * S, r * S * 0.38, 0, TAU); g.fill(); }
    return { c, W, H, ox: W / 2, oy: H - 0.9 };
  }
  if (kind === 'bush') {
    const H = 3.4, W = 4.6, [c, g] = canvas(W * S, H * S);
    const cx = W * S / 2, by = H * S - S * 0.6;
    g.fillStyle = 'rgba(18,50,40,.25)'; g.beginPath(); g.ellipse(cx, by, W * S * 0.44, S * 0.5, 0, 0, TAU); g.fill();
    for (const [x, y, r, col] of [[-1, -0.9, 1.1, '#4a8a3f'], [1, -0.8, 1.1, '#4a8a3f'], [0, -1.4, 1.3, '#5f9f49'], [-0.4, -1.8, 0.7, '#86bd5c']]) { g.fillStyle = col; g.beginPath(); g.arc(cx + x * S, by + y * S, r * S, 0, TAU); g.fill(); }
    return { c, W, H, ox: W / 2, oy: H - 0.6 };
  }
  if (kind === 'reed') {
    const H = 3.2, W = 2.8, [c, g] = canvas(W * S, H * S);
    const cx = W * S / 2, by = H * S - 4;
    g.strokeStyle = '#6f9a4a'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = cx + (i - 4) * S * 0.24, t = by - S * (1.5 + hash(i, v * 9) * 1.3);
      g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x, t + S * 0.6, x + (i - 4) * 1.2, t); g.stroke();
      if (i % 3 === 0) { g.fillStyle = '#7b5b35'; g.fillRect(x + (i - 4) * 1.2 - 1.4, t - 4, 2.8, 9); }
    }
    return { c, W, H, ox: W / 2, oy: H - 0.2 };
  }
  const H = 2.4, W = 3.4, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * 0.4; // rock
  g.fillStyle = 'rgba(18,50,40,.22)'; g.beginPath(); g.ellipse(cx + 3, by, W * S * 0.44, S * 0.42, 0, 0, TAU); g.fill();
  g.fillStyle = '#8c8f88'; g.beginPath(); g.moveTo(cx - S * 1.4, by); g.lineTo(cx - S * 1.05, by - S * 1.1); g.lineTo(cx - S * 0.1, by - S * 1.65); g.lineTo(cx + S * 1, by - S * 1.05); g.lineTo(cx + S * 1.4, by); g.closePath(); g.fill();
  g.fillStyle = '#b4b7ad'; g.beginPath(); g.moveTo(cx - S * 1.05, by - S * 1.1); g.lineTo(cx - S * 0.1, by - S * 1.65); g.lineTo(cx + S * 0.15, by - S * 0.95); g.lineTo(cx - S * 0.5, by - S * 0.6); g.closePath(); g.fill();
  return { c, W, H, ox: W / 2, oy: H - 0.4 };
}

export function createScene() {
  const tiles = { a: waveTile(512, 150, 3, 1.3, true), b: waveTile(512, 90, 5, 4.1, false) };
  const paw = pawSprite();
  const grass = grassTile(), sand = sandTile();
  const layers = LAND_LAYERS.map((l) => ({ ...l, path: landPath(l.d) }));
  const sprites = {
    pine: [treeSprite('pine', 0.2), treeSprite('pine', 0.8)],
    oak: [treeSprite('oak', 0.2), treeSprite('oak', 0.8)],
    bush: [treeSprite('bush', 0.5)],
    reed: [treeSprite('reed', 0.1), treeSprite('reed', 0.7)],
    rock: [treeSprite('rock', 0.5)],
  };
  const props = scatter();
  const shore = outlines(-0.7, 420); // 찰랑이는 물가 선
  const paws = Array.from({ length: 9 }, (_, i) => ({ s: i * 0.7, rx: hash(i, 3), ry: hash(5, i), size: 0.6 + hash(i, 8) * 0.9 }));
  return { tiles, paw, grass, sand, layers, sprites, props, shore, paws, buf: null, patterns: null };
}

// 물 무늬 패턴은 캔버스 문맥마다 만들어 둔다
function patternsOf(sc, g) {
  if (sc.patterns) return sc.patterns;
  sc.patterns = { a: g.createPattern(sc.tiles.a, 'repeat'), b: g.createPattern(sc.tiles.b, 'repeat') };
  return sc.patterns;
}

// 물 바닥: 색 + 서로 다른 속도로 흐르는 무늬 두 겹 + 바람 자국 + 반짝임
export function drawWater(g, sc, cam, W, H, t, wind, dpr) {
  const z = cam.zoom, k = VIEW.tiltY;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2b7f9f'); grad.addColorStop(1, '#2f94a9');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  const pat = patternsOf(sc, g);
  const wx = -Math.cos(wind.from), wy = -Math.sin(wind.from);
  const flow = [
    { p: pat.a, s: 0.11, drift: 1.1, wob: 3.2, alpha: 0.9, phase: 0 },
    { p: pat.b, s: 0.19, drift: 0.55, wob: 4.6, alpha: 0.8, phase: 1.7 },
  ];
  for (const f of flow) {
    const ox = (wx * t * f.drift + Math.sin(t * 0.21 + f.phase) * f.wob - cam.x) * z;
    const oy = (wy * t * f.drift + Math.cos(t * 0.17 + f.phase) * f.wob - cam.y) * z * k;
    const m = new DOMMatrix([z * f.s, 0, 0, z * f.s * k, W / 2 + ox, cam.cy + oy]);
    f.p.setTransform(m);
    g.globalAlpha = f.alpha;
    g.fillStyle = f.p; g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;

  // 바람 자국: 바람 방향으로 흘러가는 어두운 잔물결 덩어리(바람이 어디서 오는지 보여 준다)
  const span = Math.max(W, H / k) / z * 1.4;
  for (const p of sc.paws) {
    const life = (t * 0.045 + p.s) % 1, fade = Math.sin(life * Math.PI);
    const px = ((p.rx * span + wx * t * 7) % span + span) % span - span / 2 + cam.x;
    const py = ((p.ry * span + wy * t * 7) % span + span) % span - span / 2 + cam.y;
    const sx = W / 2 + (px - cam.x) * z, sy = cam.cy + (py - cam.y) * z * k;
    const sw = 60 * p.size * z, sh = 30 * p.size * z * k;
    if (sx < -sw || sx > W + sw || sy < -sh || sy > H + sh) continue;
    g.globalAlpha = 0.34 * fade;
    g.drawImage(sc.paw, sx - sw / 2, sy - sh / 2, sw, sh);
  }
  g.globalAlpha = 1;

  // 반짝임: 세상에 붙은 칸마다 정해진 박자로 잠깐 빛난다
  const cell = 7, x0 = Math.floor((cam.x - W / 2 / z) / cell), x1 = Math.ceil((cam.x + W / 2 / z) / cell);
  const y0 = Math.floor((cam.y - cam.cy / z / k) / cell), y1 = Math.ceil((cam.y + (H - cam.cy) / z / k) / cell);
  g.fillStyle = '#fff';
  const rs = Math.min(1.4, z / 6);
  if (z > 3.6) for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const r = hash(i, j), s = Math.sin(t * (0.9 + r * 1.3) + r * 40);
    if (s < 0.88) continue;
    const wxx = (i + hash(j, i)) * cell, wyy = (j + hash(j * 2, i)) * cell;
    g.globalAlpha = (s - 0.88) * 5;
    const gx = W / 2 + (wxx - cam.x) * z, gy = cam.cy + (wyy - cam.y) * z * k;
    g.fillRect(gx - 2 * rs, gy - 0.35 * rs, 4 * rs, 0.7 * rs);
    g.fillRect(gx - 0.35 * rs, gy - 1 * rs, 0.7 * rs, 2 * rs);
  }
  g.globalAlpha = 1;
}

// 땅과 얕은 물은 화면보다 크게 한 장 그려 두고 카메라가 많이 움직였을 때만 다시 그린다
function bakeLand(sc, cam, W, H, dpr) {
  const m = 0.45, bw = W * (1 + m * 2), bh = H * (1 + m * 2);
  if (!sc.buf) sc.buf = canvas(bw * dpr, bh * dpr);
  const [c, g] = sc.buf;
  if (c.width !== Math.ceil(bw * dpr) || c.height !== Math.ceil(bh * dpr)) { c.width = Math.ceil(bw * dpr); c.height = Math.ceil(bh * dpr); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  const z = cam.zoom, k = VIEW.tiltY;
  // 이 그림의 왼쪽 위가 세상 어디인지 기억한다
  const ox = bw / 2, oy = cam.cy + H * m;
  for (const l of sc.layers) {
    const lift = l.lift ? l.lift * VIEW.tiltZ * z : 0;
    g.setTransform(z * dpr, 0, 0, z * k * dpr, (ox - cam.x * z) * dpr, (oy - cam.y * z * k - lift) * dpr);
    if (l.tex) {
      const img = l.tex === 'grass' ? sc.grass : sc.sand;
      if (l.tex === 'wet') { g.fillStyle = l.fill; g.fill(l.path, 'evenodd'); continue; }
      const p = g.createPattern(img, 'repeat');
      p.setTransform(new DOMMatrix([0.3, 0, 0, 0.3 / k * 0.8, 0, 0]));
      g.fillStyle = p;
    } else g.fillStyle = l.fill;
    g.fill(l.path, 'evenodd');
  }
  sc.bakedAt = { x: cam.x, y: cam.y, zoom: z, ox, oy, W, H, m };
}

export function drawLand(g, sc, cam, W, H, dpr, zooming) {
  const b = sc.bakedAt;
  const moved = b && (Math.abs(cam.x - b.x) * cam.zoom > W * b.m * 0.8 || Math.abs(cam.y - b.y) * cam.zoom * VIEW.tiltY > H * b.m * 0.8);
  const rezoom = b && Math.abs(cam.zoom / b.zoom - 1) > (zooming ? 0.3 : 0.001);
  if (!b || moved || rezoom || b.W !== W || b.H !== H) bakeLand(sc, cam, W, H, dpr);
  const q = sc.bakedAt, [c] = sc.buf, s = cam.zoom / q.zoom;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 구운 그림 위의 세상 점 (cam.x, cam.y)가 화면 (W/2, cam.cy)에 오게 찍는다
  const bx = q.ox + (cam.x - q.x) * q.zoom, by = q.oy + (cam.y - q.y) * q.zoom * VIEW.tiltY;
  g.drawImage(c, W / 2 - bx * s, cam.cy - by * s, c.width / dpr * s, c.height / dpr * s);
}

// 물가에 찰랑이는 흰 선: 보이는 구간만 그린다
export function drawShoreFoam(g, sc, cam, W, H, t, dpr) {
  const z = cam.zoom, k = VIEW.tiltY;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.strokeStyle = 'rgba(255,255,250,.55)'; g.lineWidth = Math.max(0.7, 0.2 * z); g.lineCap = 'round';
  const pad = 30;
  for (const poly of sc.shore) {
    let open = false;
    g.beginPath();
    for (let i = 0; i < poly.length + 1; i++) {
      const [x, y] = poly[i % poly.length], sx = W / 2 + (x - cam.x) * z, sy = cam.cy + (y - cam.y) * z * k;
      if (sx < -pad || sx > W + pad || sy < -pad || sy > H + pad) { open = false; continue; }
      const off = (Math.sin(t * 0.9 + x * 0.09 + y * 0.07) + 1) * 0.55 * z;
      if (!open) { g.moveTo(sx, sy + off * 0.2); open = true; } else g.lineTo(sx, sy + off * 0.2);
    }
    g.stroke();
  }
}

// 항적: 고물에서 시작해 양쪽으로 벌어지는 두 줄과 가운데 거품. 오래된 점일수록 흐리다
export class Wake {
  constructor() { this.pts = []; this.acc = 0; this.rings = []; }
  update(dt, b, sternX, sternY) {
    this.acc += dt;
    if (this.acc > 0.16) {
      this.acc = 0;
      this.pts.push({ x: sternX, y: sternY, nx: -Math.sin(b.h), ny: Math.cos(b.h), age: 0, s: Math.min(1, b.spd / 6) });
      if (this.pts.length > 56) this.pts.shift();
    }
    for (const p of this.pts) p.age += dt;
    while (this.pts.length && this.pts[0].age > 8.5) this.pts.shift();
    for (const r of this.rings) r.age += dt;
    while (this.rings.length && this.rings[0].age > r0life) this.rings.shift();
  }
  ring(x, y, size = 1) { if (this.rings.length < 24) this.rings.push({ x, y, age: 0, size }); }
  draw(g, cam, W, dpr) {
    const z = cam.zoom, k = VIEW.tiltY;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = (x) => W / 2 + (x - cam.x) * z, py = (y) => cam.cy + (y - cam.y) * z * k;
    const bands = 5, n = this.pts.length;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let b = 0; b < bands; b++) {
      const lo = Math.floor(n * b / bands), hi = Math.floor(n * (b + 1) / bands);
      if (hi - lo < 1) continue;
      const mid = this.pts[Math.floor((lo + hi) / 2)];
      const fade = Math.max(0, 1 - mid.age / 8.5);
      for (const side of [-1, 1]) {
        g.lineCap = 'round';
        g.strokeStyle = `rgba(240,252,250,${0.42 * fade * fade})`;
        g.lineWidth = Math.max(0.6, (0.45 - 0.2 * fade) * z);
        g.beginPath();
        let moved = false;
        for (let i = lo; i <= Math.min(hi, n - 1); i++) {
          const p = this.pts[i], w = (0.9 + p.age * 0.95) * side * (0.35 + p.s * 0.65);
          const x = px(p.x + p.nx * w), y = py(p.y + p.ny * w);
          if (!moved) { g.moveTo(x, y); moved = true; } else g.lineTo(x, y);
        }
        g.stroke();
      }
      // 가운데 거품
      g.strokeStyle = `rgba(232,250,250,${0.24 * fade})`;
      g.lineWidth = (0.9 + (1 - fade) * 1.6) * z;
      g.lineCap = 'butt'; // 띠가 겹치는 자리에 구슬 무늬가 생기지 않게
      g.beginPath();
      for (let i = lo; i <= Math.min(hi, n - 1); i++) { const p = this.pts[i], x = px(p.x), y = py(p.y); if (i === lo) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    for (const r of this.rings) {
      const f = r.age / r0life, rad = (0.5 + f * 2.8) * r.size * z;
      g.strokeStyle = `rgba(240,252,250,${0.55 * (1 - f)})`; g.lineWidth = Math.max(0.6, 0.14 * z);
      g.beginPath(); g.ellipse(px(r.x), py(r.y), rad, rad * k, 0, 0, TAU); g.stroke();
    }
  }
}
const r0life = 1.6;

// 뱃머리 물보라
export function drawBowFoam(g, cam, W, dpr, b, spdK, t) {
  if (spdK < 0.1) return;
  const z = cam.zoom, k = VIEW.tiltY, ch = Math.cos(b.h), sh = Math.sin(b.h);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = (x, y) => [W / 2 + (b.x + x * ch - y * sh - cam.x) * z, cam.cy + (b.y + x * sh + y * ch - cam.y) * z * k];
  g.strokeStyle = `rgba(245,253,252,${0.5 + 0.35 * spdK})`; g.lineWidth = Math.max(0.8, 0.28 * z); g.lineCap = 'round';
  for (const side of [-1, 1]) {
    const w = 1 + Math.sin(t * 5 + side) * 0.15;
    const a = P(4.3, 0), c = P(3 - spdK * 1.4, side * (1.35 + spdK * 0.6) * w), m = P(3.9, side * 0.95 * w);
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(m[0], m[1], c[0], c[1]); g.stroke();
  }
}

// 땅의 나무·바위를 깊이 순서로: 화면에 들어오는 것만 고른다
export function visibleProps(sc, cam, W, H) {
  const z = cam.zoom, k = VIEW.tiltY, out = [];
  const topY = cam.y - (cam.cy + 16 * z) / (z * k), botY = cam.y + (H - cam.cy + 16 * z * VIEW.tiltZ) / (z * k);
  const hw = W / 2 / z + 8;
  // 많이 축소하면 작은 것을 건너뛰어 그리는 양을 줄인다
  const skip = z < 3.4 ? 2 : 1;
  for (let i = 0; i < sc.props.length; i++) {
    const p = sc.props[i];
    if (p.y < topY || p.y > botY) continue;
    if (Math.abs(p.x - cam.x) > hw) continue;
    if (skip > 1 && (p.kind === 'bush' || p.kind === 'rock' || p.kind === 'reed')) continue;
    out.push(p);
  }
  return out;
}
export function drawProp(g, sc, cam, W, p, t) {
  const list = sc.sprites[p.kind], sp = list[Math.floor(p.v * list.length) % list.length];
  const z = cam.zoom * p.size, k = VIEW.tiltY;
  const sx = W / 2 + (p.x - cam.x) * cam.zoom, sy = cam.cy + (p.y - cam.y) * cam.zoom * k;
  g.drawImage(sp.c, sx - sp.ox * z, sy - sp.oy * z, sp.W * z, sp.H * z);
  void t; void dist;
}
