import { VIEW, RES } from './data.js';
import { worldOf } from './world.js';
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

function landPath(outlines, d) {
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

// 수역이 바뀌어도 그대로 쓰는 그림(물 무늬·나무)
let shared = null;
function sharedArt() {
  if (shared) return shared;
  shared = {
    tiles: { a: waveTile(512, 150, 3, 1.3, true), b: waveTile(512, 90, 5, 4.1, false) },
    paw: pawSprite(), grass: grassTile(), sand: sandTile(),
    sprites: {
      pine: [treeSprite('pine', 0.2), treeSprite('pine', 0.8)],
      oak: [treeSprite('oak', 0.2), treeSprite('oak', 0.8)],
      bush: [treeSprite('bush', 0.5)],
      reed: [treeSprite('reed', 0.1), treeSprite('reed', 0.7)],
      rock: [treeSprite('rock', 0.5)],
      pier: pierSprite(), hut: hutSprite(), sign: signSprite(), stone: stoneSprite(), stump: stumpSprite(), wreck: wreckSprite(), tower: towerSprite(),
    },
    flot: { wood: flotSprite('wood'), cloth: flotSprite('cloth'), coin: flotSprite('coin') },
  };
  return shared;
}

export function createScene(regionId) {
  const w = worldOf(regionId), art = sharedArt();
  const layers = LAND_LAYERS.map((l) => ({ ...l, path: landPath(w.outlines, l.d) }));
  // 항구·수문·발견지는 물가 쪽 땅에 그림을 세운다
  const marks = [];
  const shore = (p) => { const [gx, gy] = w.gradient(p.x, p.y); return [p.x - gx * (w.dist(p.x, p.y) + 2.5), p.y - gy * (w.dist(p.x, p.y) + 2.5), gx, gy]; };
  for (const p of w.ports) { const [x, y, gx, gy] = shore(p); marks.push({ kind: 'hut', x: x - gx * 3, y: y - gy * 3, size: 1, name: p.name, port: p }); marks.push({ kind: 'pier', x: (x + p.x) / 2, y: (y + p.y) / 2, size: 1, ang: Math.atan2(gy, gx) }); }
  for (const g of w.gates) { const [x, y] = shore(g); marks.push({ kind: 'sign', x, y, size: 1, name: g.name, gate: g }); }
  for (const f of w.finds) { const [x, y, gx, gy] = shore(f); marks.push({ kind: f.art, x: f.art === 'wreck' ? f.x + gx * -1 : x - gx * 1.5, y: f.art === 'wreck' ? f.y + gy * -1 : y - gy * 1.5, size: 1, find: f }); }
  const trees = w.scatter().filter((t) => !marks.some((m) => (m.port || m.find || m.gate) && Math.hypot(m.x - t.x, m.y - t.y) < 9));
  const props = [...trees, ...marks].sort((a, b) => a.y - b.y);
  const foam = w.outlines(-0.7, 420);
  const paws = Array.from({ length: 9 }, (_, i) => ({ s: i * 0.7, rx: hash(i, 3), ry: hash(5, i), size: 0.6 + hash(i, 8) * 0.9 }));
  return { id: regionId, world: w, ...art, layers, props, shore: foam, paws, buf: null, patterns: null, shoals: w.def.shoals || [], bakedAt: null, bakedDry: false };
}

// 물 무늬 패턴은 캔버스 문맥마다 만들어 둔다
function patternsOf(sc, g) {
  if (sc.patterns) return sc.patterns;
  sc.patterns = { a: g.createPattern(sc.tiles.a, 'repeat'), b: g.createPattern(sc.tiles.b, 'repeat') };
  return sc.patterns;
}

// 물결의 흐름 상태. 위치를 '방향 × 전체 시간'으로 계산하면 바람이 조금만 돌아도 물결이 옆으로 크게 미끄러지므로
// 프레임마다 지난 시간만큼 더해 간다. 바람이 돌 때는 카메라를 중심으로 돌려서 화면 가운데 물결이 튀지 않게 한다.
export const FLOW_LAYERS = [{ scale: 0.11, drift: 1.1, alpha: 0.9 }, { scale: 0.19, drift: 0.55, alpha: 0.8 }];
const PAW_SPEED = 6, TURN_LAG = 3;
// 무늬의 물마루는 가로이고 위로 볼록하다. 볼록한 쪽(-y)이 바람 부는 쪽을 보게 하는 회전각
export const waveAngle = (blow) => blow + Math.PI / 2;
export function advanceFlow(sc, cam, t, wind) {
  const target = wind.from + Math.PI;
  if (!sc.flow) sc.flow = { t, ang: target, layers: FLOW_LAYERS.map(() => ({ x: 0, y: 0 })), paw: { x: 0, y: 0 } };
  const F = sc.flow, dt = Math.max(0, Math.min(0.25, t - F.t));
  F.t = t;
  let d = (target - F.ang) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
  const dA = d * (1 - Math.exp(-dt / TURN_LAG)), c = Math.cos(dA), n = Math.sin(dA);
  F.ang += dA;
  const wx = Math.cos(F.ang), wy = Math.sin(F.ang), k = 0.6 + wind.speed / 15, [fx, fy] = sc.world.flowAt(cam.x, cam.y);
  FLOW_LAYERS.forEach((L, i) => {
    const o = F.layers[i], rx = o.x - cam.x, ry = o.y - cam.y;
    o.x = cam.x + rx * c - ry * n + (wx * L.drift * k + fx) * dt;
    o.y = cam.y + rx * n + ry * c + (wy * L.drift * k + fy) * dt;
  });
  F.paw.x += wx * PAW_SPEED * k * dt; F.paw.y += wy * PAW_SPEED * k * dt;
  return F;
}

// 물 바닥: 색 + 서로 다른 속도로 흐르는 무늬 두 겹 + 바람 자국 + 반짝임
export function drawWater(g, sc, cam, W, H, t, wind, dpr) {
  const z = cam.zoom, k = VIEW.tiltY;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2b7f9f'); grad.addColorStop(1, '#2f94a9');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  const pat = patternsOf(sc, g), F = advanceFlow(sc, cam, t, wind);
  // 무늬 좌표 → 세상(돌리고 옮김) → 화면(3/4로 납작하게). 물마루가 바람에 직각이 되게 돌린다
  const deg = waveAngle(F.ang) * 180 / Math.PI;
  FLOW_LAYERS.forEach((L, i) => {
    const o = F.layers[i], m = new DOMMatrix().translate(W / 2, cam.cy).scale(z, z * k).translate(o.x - cam.x, o.y - cam.y).rotate(deg).scale(L.scale);
    const p = i === 0 ? pat.a : pat.b;
    p.setTransform(m);
    g.globalAlpha = L.alpha;
    g.fillStyle = p; g.fillRect(0, 0, W, H);
  });
  g.globalAlpha = 1;

  // 바람 자국: 바람 부는 쪽으로 흘러가는 어두운 잔물결 덩어리
  const span = Math.max(W, H / k) / z * 1.4;
  for (const p of sc.paws) {
    const life = (t * 0.045 + p.s) % 1, fade = Math.sin(life * Math.PI);
    const px = ((p.rx * span + F.paw.x) % span + span) % span - span / 2 + cam.x;
    const py = ((p.ry * span + F.paw.y) % span + span) % span - span / 2 + cam.y;
    const sx = W / 2 + (px - cam.x) * z, sy = cam.cy + (py - cam.y) * z * k;
    const sw = 60 * p.size * z, sh = 30 * p.size * z;
    if (sx < -sw || sx > W + sw || sy < -sw || sy > H + sw) continue;
    g.save();
    g.translate(sx, sy); g.scale(1, k); g.rotate(waveAngle(F.ang));
    g.globalAlpha = 0.34 * fade;
    g.drawImage(sc.paw, -sw / 2, -sh / 2, sw, sh);
    g.restore();
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
function bakeLand(sc, cam, W, H, dpr, dry) {
  const m = 0.45, bw = W * (1 + m * 2), bh = H * (1 + m * 2);
  if (!sc.buf) sc.buf = canvas(bw * dpr, bh * dpr);
  const [c, g] = sc.buf;
  if (c.width !== Math.ceil(bw * dpr) || c.height !== Math.ceil(bh * dpr)) { c.width = Math.ceil(bw * dpr); c.height = Math.ceil(bh * dpr); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  const z = cam.zoom, k = VIEW.tiltY;
  // 이 그림의 왼쪽 위가 세상 어디인지 기억한다
  const ox = bw / 2, oy = cam.cy + H * m;
  // 여울: 얕은 곳이 밝게 비친다. 가뭄이면 모래가 드러난다
  for (const q of sc.shoals) {
    const sx = ox + (q.x - cam.x) * z, sy = oy + (q.y - cam.y) * z * k, r = q.r * z;
    g.setTransform(dpr, 0, 0, dpr * k, sx * dpr, sy * dpr);
    const gr = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    gr.addColorStop(0, dry ? 'rgba(232,214,160,.72)' : 'rgba(190,226,206,.38)'); gr.addColorStop(0.7, dry ? 'rgba(220,214,170,.42)' : 'rgba(170,220,206,.2)'); gr.addColorStop(1, 'rgba(170,220,206,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  }
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
  sc.bakedDry = dry;
}

export function drawLand(g, sc, cam, W, H, dpr, zooming, dry = false) {
  const b = sc.bakedAt;
  const moved = b && (Math.abs(cam.x - b.x) * cam.zoom > W * b.m * 0.8 || Math.abs(cam.y - b.y) * cam.zoom * VIEW.tiltY > H * b.m * 0.8);
  const rezoom = b && Math.abs(cam.zoom / b.zoom - 1) > (zooming ? 0.3 : 0.001);
  if (!b || moved || rezoom || b.W !== W || b.H !== H || sc.bakedDry !== dry) bakeLand(sc, cam, W, H, dpr, dry);
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
export function drawBowFoam(g, cam, W, dpr, b, spdK, t, len = 9) {
  if (spdK < 0.1) return;
  const z = cam.zoom, k = VIEW.tiltY, ch = Math.cos(b.h), sh = Math.sin(b.h);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = (x, y) => [W / 2 + (b.x + x * ch - y * sh - cam.x) * z, cam.cy + (b.y + x * sh + y * ch - cam.y) * z * k];
  g.strokeStyle = `rgba(245,253,252,${0.5 + 0.35 * spdK})`; g.lineWidth = Math.max(0.8, 0.28 * z); g.lineCap = 'round';
  for (const side of [-1, 1]) {
    const w = 1 + Math.sin(t * 5 + side) * 0.15;
    const L = len / 2, a = P(L - 0.2, 0), c = P(L * 0.67 - spdK * 1.4, side * (L * 0.3 + spdK * 0.6) * w), m = P(L * 0.87, side * L * 0.21 * w);
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
  const list = sc.sprites[p.kind], sp = Array.isArray(list) ? list[Math.floor(p.v * list.length) % list.length] : list;
  const z = cam.zoom * p.size, k = VIEW.tiltY;
  const sx = W / 2 + (p.x - cam.x) * cam.zoom, sy = cam.cy + (p.y - cam.y) * cam.zoom * k;
  g.drawImage(sp.c, sx - sp.ox * z, sy - sp.oy * z, sp.W * z, sp.H * z);
  void t;
}

// ── 항구·표지·발견지 그림 ──
function pierSprite() {
  const S = 22, W = 8, H = 5, [c, g] = canvas(W * S, H * S);
  g.fillStyle = 'rgba(14,50,70,.25)'; g.fillRect(S * 1, S * 3.3, S * 6, S * 0.5);
  for (const x of [1.4, 3.4, 5.4, 6.6]) { g.fillStyle = '#5a4228'; g.fillRect(x * S, S * 2.5, S * 0.35, S * 1.4); }
  g.fillStyle = '#9c7648'; g.fillRect(S * 1, S * 2, S * 6, S * 0.7);
  g.strokeStyle = '#7a5a35'; g.lineWidth = 1.4;
  for (let x = 1.4; x < 7; x += 0.5) { g.beginPath(); g.moveTo(x * S, S * 2); g.lineTo(x * S, S * 2.7); g.stroke(); }
  return { c, W, H, ox: W / 2, oy: 3 };
}
function hutSprite() {
  const S = 22, W = 8.5, H = 8, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * 0.8;
  g.fillStyle = 'rgba(18,50,40,.28)'; g.beginPath(); g.ellipse(cx + S * 0.3, by + 2, W * S * 0.42, S * 0.7, 0, 0, TAU); g.fill();
  g.fillStyle = '#d9c29a'; g.fillRect(cx - S * 2.7, by - S * 2.9, S * 5.4, S * 2.9);
  g.fillStyle = '#7a5a35'; g.fillRect(cx - S * 0.5, by - S * 1.7, S * 1, S * 1.7);
  g.fillStyle = '#35566a'; g.fillRect(cx + S * 1, by - S * 2.1, S * 1, S * 0.9); g.fillRect(cx - S * 2.1, by - S * 2.1, S * 1, S * 0.9);
  g.fillStyle = '#a84f3b'; g.beginPath(); g.moveTo(cx - S * 3.4, by - S * 2.8); g.lineTo(cx, by - S * 5.2); g.lineTo(cx + S * 3.4, by - S * 2.8); g.closePath(); g.fill();
  g.fillStyle = '#c4644d'; g.beginPath(); g.moveTo(cx - S * 3.4, by - S * 2.8); g.lineTo(cx, by - S * 5.2); g.lineTo(cx - S * 0.3, by - S * 2.8); g.closePath(); g.fill();
  return { c, W, H, ox: W / 2, oy: H - 0.8 };
}
function signSprite() {
  const S = 22, W = 4, H = 6, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * 0.5;
  g.fillStyle = '#5a4228'; g.fillRect(cx - 3, by - S * 4.4, 6, S * 4.4);
  g.fillStyle = '#e7b64a'; g.beginPath(); g.moveTo(cx - S * 1.5, by - S * 4.6); g.lineTo(cx + S * 1.1, by - S * 4.6); g.lineTo(cx + S * 1.7, by - S * 3.95); g.lineTo(cx + S * 1.1, by - S * 3.3); g.lineTo(cx - S * 1.5, by - S * 3.3); g.closePath(); g.fill();
  g.strokeStyle = '#8a6a22'; g.lineWidth = 2; g.stroke();
  return { c, W, H, ox: W / 2, oy: H - 0.5 };
}
function stoneSprite() {
  const S = 22, W = 4, H = 5, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * 0.5;
  g.fillStyle = 'rgba(18,50,40,.25)'; g.beginPath(); g.ellipse(cx + 3, by, S * 1.5, S * 0.4, 0, 0, TAU); g.fill();
  for (const [y, w, col] of [[0, 1.35, '#8c8f88'], [0.95, 1, '#a3a69e'], [1.75, 0.75, '#8c8f88'], [2.4, 0.5, '#b4b7ad']]) { g.fillStyle = col; g.beginPath(); g.ellipse(cx, by - y * S, w * S, 0.5 * S, 0, 0, TAU); g.fill(); }
  return { c, W, H, ox: W / 2, oy: H - 0.5 };
}
function stumpSprite() {
  const S = 22, W = 5, H = 6, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * 0.5;
  g.fillStyle = 'rgba(18,50,40,.25)'; g.beginPath(); g.ellipse(cx + 3, by, S * 2, S * 0.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#6b4c2c'; g.beginPath(); g.moveTo(cx - S * 1.5, by); g.lineTo(cx - S * 1, by - S * 3.6); g.lineTo(cx + S * 1, by - S * 3.8); g.lineTo(cx + S * 1.5, by); g.closePath(); g.fill();
  g.fillStyle = '#2a1d10'; g.beginPath(); g.ellipse(cx, by - S * 1.6, S * 0.55, S * 0.8, 0, 0, TAU); g.fill();
  g.fillStyle = '#5f9a4a'; g.beginPath(); g.ellipse(cx - S * 0.3, by - S * 3.8, S * 1.15, S * 0.45, 0, 0, TAU); g.fill();
  return { c, W, H, ox: W / 2, oy: H - 0.5 };
}
function wreckSprite() {
  const S = 22, W = 8, H = 4.4, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * 0.7;
  g.fillStyle = 'rgba(14,50,70,.3)'; g.beginPath(); g.ellipse(cx, by, W * S * 0.44, S * 0.7, 0, 0, TAU); g.fill();
  g.fillStyle = '#5e4a34'; g.beginPath(); g.moveTo(cx - S * 3.3, by - S * 1.1); g.quadraticCurveTo(cx, by + S * 0.8, cx + S * 3.3, by - S * 1.7); g.lineTo(cx + S * 2.8, by - S * 0.3); g.lineTo(cx - S * 2.7, by + S * 0.1); g.closePath(); g.fill();
  g.strokeStyle = '#463525'; g.lineWidth = 3; for (const x of [-1.6, 0, 1.5]) { g.beginPath(); g.moveTo(cx + x * S, by + S * 0.1); g.lineTo(cx + x * S + 3, by - S * 1.4); g.stroke(); }
  return { c, W, H, ox: W / 2, oy: H - 0.7 };
}
function towerSprite() {
  const S = 22, W = 5.4, H = 11, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * 0.6;
  g.fillStyle = 'rgba(18,50,40,.28)'; g.beginPath(); g.ellipse(cx + 4, by, S * 2, S * 0.55, 0, 0, TAU); g.fill();
  g.fillStyle = '#efe7d4'; g.beginPath(); g.moveTo(cx - S * 1.4, by); g.lineTo(cx - S * 0.9, by - S * 7.2); g.lineTo(cx + S * 0.9, by - S * 7.2); g.lineTo(cx + S * 1.4, by); g.closePath(); g.fill();
  g.fillStyle = '#c0533f'; g.fillRect(cx - S * 1.2, by - S * 2.6, S * 2.4, S * 0.9); g.fillRect(cx - S * 1, by - S * 5.4, S * 2, S * 0.9);
  g.fillStyle = '#35566a'; g.fillRect(cx - S * 0.75, by - S * 8.2, S * 1.5, S * 1);
  g.fillStyle = '#a84f3b'; g.beginPath(); g.moveTo(cx - S * 1.1, by - S * 8.2); g.lineTo(cx, by - S * 9.5); g.lineTo(cx + S * 1.1, by - S * 8.2); g.closePath(); g.fill();
  return { c, W, H, ox: W / 2, oy: H - 0.6 };
}

// 표류물: 물에 뜬 통나무·천 뭉치·상자
function flotSprite(k) {
  const [c, g] = canvas(64, 48), cx = 32, cy = 28;
  g.fillStyle = 'rgba(14,50,70,.3)'; g.beginPath(); g.ellipse(cx, cy + 5, 21, 7, 0, 0, TAU); g.fill();
  if (k === 'wood') {
    for (const [y, c2] of [[0, '#8c6a3f'], [-7, '#a58150']]) { g.fillStyle = c2; g.beginPath(); g.roundRect(cx - 19, cy + y - 3.5, 38, 7, 3.5); g.fill(); g.fillStyle = '#d8bb8a'; g.beginPath(); g.ellipse(cx + 18, cy + y, 3, 3.5, 0, 0, TAU); g.fill(); }
  } else if (k === 'cloth') {
    g.fillStyle = '#e4d5b0'; g.beginPath(); g.ellipse(cx, cy - 3, 16, 10, 0, 0, TAU); g.fill();
    g.strokeStyle = '#a4845a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 8, cy - 12); g.lineTo(cx - 8, cy + 5); g.moveTo(cx + 7, cy - 12); g.lineTo(cx + 7, cy + 5); g.stroke();
  } else {
    g.fillStyle = '#8a6236'; g.fillRect(cx - 14, cy - 12, 28, 18);
    g.fillStyle = '#a47a48'; g.fillRect(cx - 14, cy - 16, 28, 6);
    g.fillStyle = '#e7b64a'; g.fillRect(cx - 3, cy - 12, 6, 7);
  }
  return c;
}
export function drawFlotsam(g, sc, list, cam, W, H, t, dpr) {
  const z = cam.zoom, k = VIEW.tiltY;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const size = Math.max(18, 3.6 * z);
  for (const f of list) {
    const sx = W / 2 + (f.x - cam.x) * z, sy = cam.cy + (f.y - cam.y) * z * k + Math.sin(t * 1.4 + f.ph) * 0.12 * z;
    if (sx < -size || sx > W + size || sy < -size || sy > H + size) continue;
    // 건질 것만 금빛 고리와 반짝임을 쓴다(동물과 헷갈리지 않게)
    const q = (t * 0.6 + f.ph) % 1, pulse = 0.8 + 0.7 * q;
    g.strokeStyle = `rgba(255,214,102,${0.85 * (1 - q)})`; g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(sx, sy + size * 0.1, size * 0.6 * pulse, size * 0.6 * pulse * k, 0, 0, TAU); g.stroke();
    g.drawImage(sc.flot[f.k], sx - size / 2, sy - size * 0.55, size, size * 0.75);
    const tw = 0.55 + 0.45 * Math.sin(t * 4 + f.ph * 3), r = size * 0.26 * tw, gx = sx + size * 0.3, gy = sy - size * 0.5;
    g.fillStyle = '#ffe9a8';
    g.beginPath(); g.moveTo(gx, gy - r); g.quadraticCurveTo(gx, gy, gx + r, gy); g.quadraticCurveTo(gx, gy, gx, gy + r); g.quadraticCurveTo(gx, gy, gx - r, gy); g.quadraticCurveTo(gx, gy, gx, gy - r); g.fill();
  }
  
}

// 날씨 덧칠: 돌풍 전조·비, 무더위
export function drawWeather(g, weather, W, H, t, dpr, seedDrops) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (weather.heat) { g.fillStyle = 'rgba(255,186,90,.11)'; g.fillRect(0, 0, W, H); }
  if (weather.gustSoon || weather.gustOn) {
    g.fillStyle = weather.gustOn ? 'rgba(20,40,62,.3)' : 'rgba(20,40,62,.14)'; g.fillRect(0, 0, W, H);
  }
  if (weather.gustOn) {
    g.strokeStyle = 'rgba(214,232,240,.42)'; g.lineWidth = 1; g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < 70; i++) {
      const sp = 420 + hash(i, 2) * 240, x = (hash(i, 1) * W * 1.3 + t * sp * 0.34) % (W * 1.3) - W * 0.15, y = (hash(3, i) * H + t * sp) % H;
      g.moveTo(x, y); g.lineTo(x + 5, y + 15);
    }
    g.stroke();
  }
  void seedDrops;
}
