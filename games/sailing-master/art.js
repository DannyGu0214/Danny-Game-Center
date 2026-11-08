import { VIEW, RES } from './data.js';
import { worldOf } from './world.js';
// 물·땅·나무 그림. 파일 없이 코드로 그리고, 반복되는 것은 오프스크린에 미리 그려 찍는다(매 프레임 비용을 낮추려고).

const PI = Math.PI, TAU = PI * 2;
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return [c, c.getContext('2d')]; }
function hash(x, y) { let s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

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
      pier: pierSprite(), hut: hutSprite(), sign: signSprite(), stone: stoneSprite(), stump: stumpSprite(), wreck: wreckSprite(), tower: towerSprite(), cabin: cabinSprite(), mill: millSprite(), shrine: shrineSprite(), camp: campSprite(), logpile: logpileSprite(), beacon: beaconSprite(), shelter: shelterSprite(), beached: beachedSprite(),
    },
    flot: { wood: flotSprite('wood'), cloth: flotSprite('cloth'), coin: flotSprite('coin') },
  };
  return shared;
}

export function createScene(regionId, finds = worldOf(regionId).finds) {
  const w = worldOf(regionId), art = sharedArt();
  const layers = LAND_LAYERS.map((l) => ({ ...l, path: landPath(w.outlines, l.d) }));
  // 항구·수문·발견지는 물가 쪽 땅에 그림을 세운다
  const marks = [];
  const shore = (p) => { const [gx, gy] = w.gradient(p.x, p.y); return [p.x - gx * (w.dist(p.x, p.y) + 2.5), p.y - gy * (w.dist(p.x, p.y) + 2.5), gx, gy]; };
  for (const p of w.ports) { const [x, y, gx, gy] = shore(p); const side = gy > 0 ? -1 : 1; // 집은 부두 옆 뭍으로 비켜 세운다(집 오른쪽 옆벽이 부두 머리를 가리지 않게 왼쪽으로)
    marks.push({ kind: 'hut', x: x - gx * 3.5 + gy * side * 3.6, y: y - gy * 3.5 - gx * side * 3.6, size: 1, name: p.name, port: p }); const d = w.dist(p.x, p.y) + 0.4, len = Math.max(5, Math.min(PIER_MAX, d - 4.5)), x0 = p.x - gx * d, y0 = p.y - gy * d;
    marks.push({ kind: 'pier', x: x0 + gx * len / 2, y: y0 + gy * len / 2, x0, y0, len, size: 1, ang: Math.atan2(gy, gx) }); }
  for (const g of w.gates) { const [x, y] = shore(g); marks.push({ kind: 'sign', x, y, size: 1, name: g.name, gate: g }); }
  for (const f of finds) marks.push({ kind: f.art, x: f.x, y: f.y, size: 1, find: f });
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
  if (sp.pier) { drawPier(g, sp, cam, W, p, t); return; }
  const z = cam.zoom * p.size, k = VIEW.tiltY;
  const sx = W / 2 + (p.x - cam.x) * cam.zoom, sy = cam.cy + (p.y - cam.y) * cam.zoom * k;
  g.drawImage(sp.c, sx - sp.ox * z, sy - sp.oy * z, sp.W * z, sp.H * z);
  // 등실 불빛: 천천히 숨 쉬듯 밝아진다
  if (sp.glow) {
    const [gx, gy] = sp.glow, x = sx + gx * z, y = sy + gy * z, a = 0.32 + 0.12 * Math.sin(t * 1.6 + p.x), r = 2.2 * z;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,226,140,${a})`); gr.addColorStop(1, 'rgba(255,226,140,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // 봉화 불꽃: 겹친 혀 세 개가 따로 흔들린다
  if (sp.fire) {
    const [fx, fy] = sp.fire, x = sx + fx * z, y = sy + fy * z;
    const gr = g.createRadialGradient(x, y - 0.6 * z, 0, x, y - 0.6 * z, 2.4 * z); gr.addColorStop(0, 'rgba(255,190,90,.35)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y - 0.6 * z, 2.4 * z, 0, TAU); g.fill();
    for (const [dx, h, col, ph] of [[-0.3, 1.1, '#e0632e', 0], [0.25, 1.3, '#f08a2c', 1.7], [0, 1.7, '#ffcf5a', 3.1]]) {
      const w = Math.sin(t * 7 + ph + p.x) * 0.12, hh = h * (0.85 + 0.15 * Math.sin(t * 9 + ph));
      g.fillStyle = col; g.beginPath(); g.moveTo(x + (dx - 0.35) * z, y); g.quadraticCurveTo(x + (dx - 0.3 + w) * z, y - hh * 0.6 * z, x + (dx + w * 2) * z, y - hh * z); g.quadraticCurveTo(x + (dx + 0.3 + w) * z, y - hh * 0.6 * z, x + (dx + 0.35) * z, y); g.closePath(); g.fill();
    }
  }
  // 물에 잠긴 것 둘레의 물결
  if (sp.ripple) for (let i = 0; i < 2; i++) {
    const f = ((t * 0.35 + i * 0.5) % 1 + 1) % 1, [rx, ry] = sp.ripple;
    g.strokeStyle = `rgba(235,248,250,${0.4 * (1 - f)})`; g.lineWidth = Math.max(1, z * 0.08);
    g.beginPath(); g.ellipse(sx, sy - 0.2 * z, (rx + f * 1.2) * z, (ry + f * 0.35) * z, 0, 0, TAU); g.stroke();
  }
  // 굴뚝 연기: 피어올라 옆으로 흩어진다
  if (sp.smoke) for (let i = 0; i < 5; i++) {
    const f = (((t * 0.22 + i / 5 + p.x * 0.013) % 1) + 1) % 1, [mx, my] = sp.smoke;
    g.fillStyle = `rgba(236,236,230,${0.42 * (1 - f) * Math.min(1, f * 6)})`;
    g.beginPath(); g.arc(sx + (mx + f * 1.6 + Math.sin(f * 6 + i) * 0.15) * z, sy + (my - f * 2.6) * z, (0.22 + f * 0.55) * z, 0, TAU); g.fill();
  }
}

// ── 항구·표지·발견지 그림 ──
// 부두: 물가에서 물 쪽으로 뻗은 널판 다리. 항구마다 방향이 달라서 위에서 본 널판 그림을 땅 좌표로 돌려 그린다
const PIER_R = 32, PIER_MAX = 16, PIER_W = 2, PIER_H = 0.6;
function pierSprite() {
  const R = PIER_R, L = PIER_MAX, Wd = PIER_W, [c, g] = canvas(L * R, Wd * R), pw = 0.3 * R;
  g.fillStyle = '#4e3822'; g.fillRect(0, 0, L * R, Wd * R); // 널판 사이 틈으로 보이는 아래
  const tones = ['#a77d4c', '#9c7346', '#b08654', '#93693f'];
  for (let i = 0, x = 0; x < L * R; i++, x += pw) {
    const h = hash(i, 7), off = (hash(i, 3) - 0.5) * 0.14 * R, y0 = 0.05 * R + off, hh = Wd * R - 0.1 * R;
    g.fillStyle = tones[Math.floor(h * 4)]; g.fillRect(x + 1, y0, pw - 2.6, hh);
    g.fillStyle = 'rgba(255,236,196,.2)'; g.fillRect(x + 1, y0, 2, hh); // 빛 받는 모서리
    g.fillStyle = 'rgba(60,38,20,.22)'; g.fillRect(x + pw - 3.6, y0, 1.2, hh);
    g.strokeStyle = 'rgba(78,50,26,.38)'; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { const yy = y0 + (0.15 + hash(i, k + 11) * 0.7) * hh; g.beginPath(); g.moveTo(x + 3, yy); g.lineTo(x + pw - 4, yy + (hash(i, k) - 0.5) * 3); g.stroke(); }
    if (h > 0.82) { g.fillStyle = 'rgba(70,46,24,.4)'; g.beginPath(); g.ellipse(x + pw * 0.45, y0 + hh * (0.3 + hash(i, 5) * 0.4), 2.2, 3.2, 0, 0, TAU); g.fill(); } // 옹이
    g.fillStyle = '#3a2a1a'; for (const yy of [0.22, Wd - 0.22]) { g.beginPath(); g.arc(x + pw / 2, yy * R, 1.5, 0, TAU); g.fill(); } // 못
  }
  return { pier: true, deck: c };
}
function drawPier(g, sp, cam, W, p, t) {
  const z = cam.zoom, k = VIEW.tiltY, tz = VIEW.tiltZ, R = PIER_R, Wd = PIER_W, L = p.len, hw = Wd / 2;
  const cs = Math.cos(p.ang), sn = Math.sin(p.ang);
  const at = (u, v, h = 0, dx = 0, dy = 0) => [W / 2 + (p.x0 + u * cs - v * sn + dx - cam.x) * z, cam.cy + (p.y0 + u * sn + v * cs + dy - cam.y) * z * k - h * z * tz];
  const quad = (h, fill, dx = 0, dy = 0, u0 = 0, u1 = L) => {
    g.beginPath(); for (const [u, v] of [[u0, -hw], [u1, -hw], [u1, hw], [u0, hw]]) g.lineTo(...at(u, v, h, dx, dy)); g.closePath(); g.fillStyle = fill; g.fill();
  };
  quad(0, 'rgba(14,46,62,.28)', 0.5, 0.45, 0.6); // 물에 진 그림자
  // 말뚝: 물에서 널판까지. 밑동에 찰랑이는 물결
  const piles = [];
  for (let u = 1.1; u < L - 0.3; u += 2.3) piles.push(u);
  piles.push(L - 0.15);
  for (const u of piles) for (const v of [-hw + 0.12, hw - 0.12]) {
    const [x0, y0] = at(u, v, -0.2), [, y1] = at(u, v, PIER_H), w = 0.26 * z;
    g.fillStyle = '#4a3420'; g.fillRect(x0 - w / 2, y1, w, y0 - y1);
    g.fillStyle = '#6a4d31'; g.fillRect(x0 - w / 2, y1, w * 0.4, y0 - y1);
    g.strokeStyle = `rgba(235,248,250,${0.35 + 0.15 * Math.sin(t * 2.2 + u * 3 + v)})`; g.lineWidth = Math.max(1, z * 0.07);
    g.beginPath(); g.ellipse(x0, at(u, v, 0)[1], w * 0.95, w * 0.95 * k, 0, 0, TAU); g.stroke();
  }
  quad(PIER_H - 0.22, '#5b4129'); // 널판 두께(옆면)
  g.save();
  const [ex, ey] = at(0, -hw, PIER_H);
  g.transform(z * cs / R, z * k * sn / R, -z * sn / R, z * k * cs / R, ex, ey);
  g.drawImage(sp.deck, 0, 0, Math.ceil(L * R), Wd * R, 0, 0, Math.ceil(L * R), Wd * R);
  // 밧줄 사리
  const rx = (L - 1.6) * R, ry = (Wd - 0.55) * R;
  g.strokeStyle = '#7d6440'; g.lineWidth = 4.5; for (const r of [0.34, 0.24, 0.14]) { g.beginPath(); g.arc(rx, ry, r * R, 0, TAU); g.stroke(); }
  g.strokeStyle = '#cdb27c'; g.lineWidth = 2.4; for (const r of [0.34, 0.24, 0.14]) { g.beginPath(); g.arc(rx, ry, r * R, 0, TAU); g.stroke(); }
  g.restore();
  // 끝의 계류 기둥 둘, 등불 기둥 하나
  const post = (u, v, h, w, col, lit) => { const [x, y0] = at(u, v, PIER_H), [, y1] = at(u, v, PIER_H + h); g.fillStyle = col; g.fillRect(x - w * z / 2, y1, w * z, y0 - y1); g.fillStyle = lit; g.fillRect(x - w * z / 2, y1, w * z * 0.35, y0 - y1); return [x, y1]; };
  const [bx, by] = post(L - 0.3, hw - 0.2, 0.55, 0.3, '#3f2e1d', '#5e4630');
  g.fillStyle = '#2f2216'; g.beginPath(); g.ellipse(bx, by, 0.2 * z, 0.2 * z * k, 0, 0, TAU); g.fill();
  const [lx, ly] = post(L - 0.3, -hw + 0.2, 2.5, 0.16, '#3f2e1d', '#5e4630');
  g.strokeStyle = '#3f2e1d'; g.lineWidth = Math.max(1, 0.08 * z); g.beginPath(); g.moveTo(lx, ly + 0.1 * z); g.lineTo(lx + 0.5 * z, ly + 0.1 * z); g.stroke();
  const fl = 0.75 + 0.12 * Math.sin(t * 6.3) + 0.08 * Math.sin(t * 11.7);
  const gl = g.createRadialGradient(lx + 0.5 * z, ly + 0.55 * z, 0, lx + 0.5 * z, ly + 0.55 * z, 1.3 * z);
  gl.addColorStop(0, `rgba(255,214,120,${0.42 * fl})`); gl.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(lx + 0.5 * z, ly + 0.55 * z, 1.3 * z, 0, TAU); g.fill();
  g.fillStyle = '#2f2216'; g.fillRect(lx + 0.33 * z, ly + 0.2 * z, 0.34 * z, 0.08 * z); g.fillRect(lx + 0.33 * z, ly + 0.82 * z, 0.34 * z, 0.08 * z);
  g.fillStyle = `rgba(255,${200 + 30 * fl | 0},110,1)`; g.fillRect(lx + 0.37 * z, ly + 0.28 * z, 0.26 * z, 0.54 * z);
  // 물가 쪽 끝에 통과 상자
  const [cx, cy] = at(1.6, hw - 0.55, PIER_H), cw = 0.7 * z, ch = 0.6 * z;
  g.fillStyle = '#7a5530'; g.fillRect(cx - cw / 2, cy - ch, cw, ch); g.fillStyle = '#9a7142'; g.fillRect(cx - cw / 2, cy - ch - 0.22 * z, cw, 0.24 * z);
  g.strokeStyle = '#5a3d22'; g.lineWidth = Math.max(1, 0.05 * z); g.strokeRect(cx - cw / 2, cy - ch, cw, ch); g.beginPath(); g.moveTo(cx - cw / 2, cy - ch); g.lineTo(cx + cw / 2, cy); g.stroke();
  const [kx, ky] = at(2.5, hw - 0.5, PIER_H), kw = 0.62 * z, kh = 0.78 * z;
  g.fillStyle = '#8a5f34'; g.beginPath(); g.ellipse(kx, ky, kw / 2, kw / 2 * k, 0, 0, Math.PI); g.lineTo(kx - kw / 2, ky - kh); g.ellipse(kx, ky - kh, kw / 2, kw / 2 * k, 0, Math.PI, 0, true); g.closePath(); g.fill();
  g.fillStyle = '#a77a48'; g.beginPath(); g.ellipse(kx, ky - kh, kw / 2, kw / 2 * k, 0, 0, TAU); g.fill();
  g.strokeStyle = '#3f3a36'; g.lineWidth = Math.max(1, 0.06 * z); for (const f of [0.22, 0.78]) { g.beginPath(); g.ellipse(kx, ky - kh * f, kw / 2, kw / 2 * k, 0, 0, Math.PI); g.stroke(); }
}
// 항구 집: 돌 기단, 나무 뼈대가 드러난 회벽, 기와지붕, 굴뚝 연기(연기는 drawProp이 움직인다), 닻 간판, 꽃 상자, 통과 상자
function hutSprite() {
  const S = 32, W = 10.6, H = 9.4, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * 0.8;
  const P = (x, y) => [cx + x * S, by + y * S];
  const poly = (pts, fill) => { g.beginPath(); for (const q of pts) g.lineTo(...P(...q)); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } };
  const beam = (x0, y0, x1, y1, w = 0.17) => { g.strokeStyle = '#5c3f25'; g.lineWidth = w * S; g.lineCap = 'butt'; g.beginPath(); g.moveTo(...P(x0, y0)); g.lineTo(...P(x1, y1)); g.stroke(); };
  g.fillStyle = 'rgba(18,50,40,.3)'; g.beginPath(); g.ellipse(...P(0.7, 0.1), 5.1 * S, 0.95 * S, 0, 0, TAU); g.fill();
  const D = [2.4, -1.1]; // 옆으로 물러나는 깊이
  const FL = -3.1, FR = 1.2, WH = 3; // 앞벽 왼쪽·오른쪽 끝, 벽 높이
  // 옆벽(그늘)
  poly([[FR, 0], [FR + D[0], D[1]], [FR + D[0], D[1] - WH], [FR, -WH]], '#c9b48f');
  poly([[FR, 0], [FR + D[0], D[1]], [FR + D[0], D[1] - 0.55], [FR, -0.55]], '#86837a');
  beam(FR + D[0], D[1], FR + D[0], D[1] - WH); beam(FR, -WH, FR + D[0], D[1] - WH);
  // 옆 창
  const sw = (u, h) => [FR + D[0] * u, D[1] * u - h];
  poly([sw(0.35, 1.1), sw(0.72, 1.1), sw(0.72, 2.1), sw(0.35, 2.1)], '#ffd98a');
  poly([sw(0.35, 1.1), sw(0.72, 1.1), sw(0.72, 1.3), sw(0.35, 1.3)], 'rgba(180,110,40,.35)');
  g.strokeStyle = '#4a3320'; g.lineWidth = 0.1 * S; g.beginPath(); g.moveTo(...P(...sw(0.535, 1.1))); g.lineTo(...P(...sw(0.535, 2.1))); g.moveTo(...P(...sw(0.35, 1.6))); g.lineTo(...P(...sw(0.72, 1.6))); g.stroke();
  // 앞벽
  poly([[FL, 0], [FR, 0], [FR, -WH], [FL, -WH]], '#ecdfc2');
  poly([[FL, 0], [FR, 0], [FR, -0.55], [FL, -0.55]], '#97948a');
  for (let i = 0; i < 9; i++) for (let r = 0; r < 2; r++) { const x = FL + 0.1 + i * 0.48 + (r ? 0.24 : 0); if (x > FR - 0.2) continue; g.fillStyle = hash(i, r) > 0.5 ? '#aeaba0' : '#a39f94'; g.beginPath(); g.roundRect(...P(x, -0.52 + r * 0.26), 0.42 * S, 0.22 * S, 3); g.fill(); }
  for (let i = 0; i < 4; i++) { const u = 0.08 + i * 0.24; g.fillStyle = '#a5a297'; poly([sw(u, 0.08), sw(u + 0.2, 0.08), sw(u + 0.2, 0.3), sw(u, 0.3)], '#a19e93'); }
  // 회벽 얼룩
  for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(190,165,120,.18)'; g.beginPath(); g.ellipse(...P(FL + hash(i, 2) * 4.2, -0.9 - hash(2, i) * 1.9), (0.25 + hash(i, 9) * 0.35) * S, 0.18 * S, 0, 0, TAU); g.fill(); }
  // 나무 뼈대
  beam(FL, -0.55, FR, -0.55, 0.2); beam(FL, -WH, FR, -WH, 0.2); beam(FL + 0.08, -0.55, FL + 0.08, -WH); beam(FR - 0.08, -0.55, FR - 0.08, -WH);
  beam(-0.95, -0.55, -0.95, -WH); beam(FL + 0.1, -2.35, -1.85, -WH, 0.13); beam(-1.85, -0.6, FL + 0.1, -1.25, 0.13);
  // 앞 창: 따뜻한 불빛, 덧문, 꽃 상자
  const wx0 = -2.55, wx1 = -1.45, wy0 = -1.15, wy1 = -2.3;
  poly([[wx0 - 0.42, wy0], [wx0, wy0], [wx0, wy1], [wx0 - 0.42, wy1]], '#3f6f7a'); poly([[wx1, wy0], [wx1 + 0.42, wy0], [wx1 + 0.42, wy1], [wx1, wy1]], '#3f6f7a');
  g.strokeStyle = '#2f5560'; g.lineWidth = 2; for (const x of [wx0 - 0.21, wx1 + 0.21]) { g.beginPath(); g.moveTo(...P(x, wy0 - 0.1)); g.lineTo(...P(x, wy1 + 0.1)); g.stroke(); }
  const wg = g.createLinearGradient(...P(0, wy1), ...P(0, wy0)); wg.addColorStop(0, '#ffe7a8'); wg.addColorStop(1, '#f0b45e');
  poly([[wx0, wy0], [wx1, wy0], [wx1, wy1], [wx0, wy1]], wg);
  g.strokeStyle = '#4a3320'; g.lineWidth = 0.1 * S; g.strokeRect(...P(wx0, wy1), (wx1 - wx0) * S, (wy0 - wy1) * S);
  g.beginPath(); g.moveTo(...P((wx0 + wx1) / 2, wy0)); g.lineTo(...P((wx0 + wx1) / 2, wy1)); g.moveTo(...P(wx0, (wy0 + wy1) / 2)); g.lineTo(...P(wx1, (wy0 + wy1) / 2)); g.stroke();
  poly([[wx0 - 0.15, wy0 + 0.05], [wx1 + 0.15, wy0 + 0.05], [wx1 + 0.1, wy0 + 0.38], [wx0 - 0.1, wy0 + 0.38]], '#6b4a2b');
  for (let i = 0; i < 9; i++) { const x = wx0 + i * 0.15, col = ['#d4544a', '#f0a3b5', '#fff2e0'][i % 3]; g.fillStyle = '#5d8f45'; g.beginPath(); g.arc(...P(x + 0.05, wy0 - 0.02), 0.11 * S, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(...P(x + 0.02 + hash(i, 4) * 0.06, wy0 - 0.12 - hash(4, i) * 0.08), 0.075 * S, 0, TAU); g.fill(); }
  // 문: 아치, 세로 널, 손잡이, 디딤돌, 등
  const dx0 = -0.6, dx1 = 0.45, dy1 = -2.05;
  g.fillStyle = '#4a3320'; g.beginPath(); g.moveTo(...P(dx0 - 0.12, 0)); g.lineTo(...P(dx0 - 0.12, dy1 + 0.4)); g.arc(...P((dx0 + dx1) / 2, dy1 + 0.4), ((dx1 - dx0) / 2 + 0.12) * S, Math.PI, 0); g.lineTo(...P(dx1 + 0.12, 0)); g.closePath(); g.fill();
  g.fillStyle = '#80552f'; g.beginPath(); g.moveTo(...P(dx0, 0)); g.lineTo(...P(dx0, dy1 + 0.4)); g.arc(...P((dx0 + dx1) / 2, dy1 + 0.4), (dx1 - dx0) / 2 * S, Math.PI, 0); g.lineTo(...P(dx1, 0)); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(50,30,15,.5)'; g.lineWidth = 1.5; for (const x of [-0.34, -0.08, 0.18]) { g.beginPath(); g.moveTo(...P(x, -0.05)); g.lineTo(...P(x, dy1 + 0.2)); g.stroke(); }
  g.fillStyle = '#e7b64a'; g.beginPath(); g.arc(...P(0.25, -1), 0.07 * S, 0, TAU); g.fill();
  g.fillStyle = '#a8a59a'; g.beginPath(); g.ellipse(...P(-0.07, 0.12), 0.85 * S, 0.2 * S, 0, 0, TAU); g.fill();
  g.fillStyle = '#2f2216'; g.fillRect(...P(0.62, -2.15), 0.06 * S, 0.3 * S);
  const lg = g.createRadialGradient(...P(0.75, -1.65), 0, ...P(0.75, -1.65), 0.8 * S); lg.addColorStop(0, 'rgba(255,214,120,.5)'); lg.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = lg; g.beginPath(); g.arc(...P(0.75, -1.65), 0.8 * S, 0, TAU); g.fill();
  g.fillStyle = '#2f2216'; g.fillRect(...P(0.6, -1.95), 0.3 * S, 0.6 * S); g.fillStyle = '#ffd37a'; g.fillRect(...P(0.65, -1.88), 0.2 * S, 0.44 * S);
  // 박공(앞 삼각 벽)과 둥근 다락 창
  const AP = [(FL + FR) / 2, -WH - 2.1];
  poly([[FL, -WH], [FR, -WH], AP], '#e4d6b8');
  beam(...AP, (FL + FR) / 2, -WH, 0.15);
  g.fillStyle = '#4a3320'; g.beginPath(); g.arc(...P(AP[0], -WH - 0.85), 0.42 * S, 0, TAU); g.fill();
  g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(...P(AP[0], -WH - 0.85), 0.32 * S, 0, TAU); g.fill();
  g.strokeStyle = '#4a3320'; g.lineWidth = 0.08 * S; g.beginPath(); g.moveTo(...P(AP[0] - 0.32, -WH - 0.85)); g.lineTo(...P(AP[0] + 0.32, -WH - 0.85)); g.moveTo(...P(AP[0], -WH - 1.17)); g.lineTo(...P(AP[0], -WH - 0.53)); g.stroke();
  // 지붕 옆면: 기와 줄
  const E0 = [FR + 0.4, -WH + 0.18], A0 = [AP[0], AP[1] - 0.22], A1 = [A0[0] + D[0], A0[1] + D[1]], E1 = [E0[0] + D[0], E0[1] + D[1]];
  poly([A0, A1, E1, E0], '#b0533b');
  g.save(); poly([A0, A1, E1, E0]); g.clip();
  const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  for (let i = 0; i < 9; i++) {
    const f = i / 9, a = lerp(E0, A0, f), b = lerp(E1, A1, f), a2 = lerp(E0, A0, f + 1 / 9), b2 = lerp(E1, A1, f + 1 / 9);
    poly([a, b, b2, a2], i % 2 ? '#bc5d43' : '#a94e37');
    g.strokeStyle = 'rgba(70,25,15,.45)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke();
    g.strokeStyle = 'rgba(70,25,15,.3)'; g.lineWidth = 1.2;
    for (let j = 0; j <= 8; j++) { const q = lerp(a, b, (j + (i % 2) * 0.5) / 8), q2 = lerp(a2, b2, (j + (i % 2) * 0.5) / 8); g.beginPath(); g.moveTo(...P(...q)); g.lineTo(...P(...lerp(q, q2, 0.85))); g.stroke(); }
  }
  g.restore();
  g.strokeStyle = '#d27a5c'; g.lineWidth = 0.16 * S; g.lineCap = 'round'; g.beginPath(); g.moveTo(...P(...A0)); g.lineTo(...P(...A1)); g.stroke(); // 용마루
  // 굴뚝
  const CH = lerp(lerp(E0, A0, 0.72), lerp(E1, A1, 0.72), 0.62);
  poly([[CH[0] - 0.32, CH[1] + 0.3], [CH[0] + 0.32, CH[1] + 0.15], [CH[0] + 0.32, CH[1] - 1.25], [CH[0] - 0.32, CH[1] - 1.25]], '#9a4b35');
  poly([[CH[0] - 0.32, CH[1] + 0.3], [CH[0] - 0.12, CH[1] + 0.25], [CH[0] - 0.12, CH[1] - 1.25], [CH[0] - 0.32, CH[1] - 1.25]], '#b5614a');
  g.strokeStyle = 'rgba(60,25,15,.4)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(...P(CH[0] - 0.32, CH[1] - 0.2 - i * 0.28)); g.lineTo(...P(CH[0] + 0.32, CH[1] - 0.2 - i * 0.28)); g.stroke(); }
  g.fillStyle = '#4a3320'; g.fillRect(...P(CH[0] - 0.42, CH[1] - 1.42), 0.84 * S, 0.2 * S);
  // 앞 지붕 끝판(박공널)
  g.strokeStyle = '#5c3f25'; g.lineWidth = 0.26 * S; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(...P(FL - 0.4, -WH + 0.18)); g.lineTo(...P(...A0)); g.lineTo(...P(...E0)); g.stroke();
  g.strokeStyle = '#7a5532'; g.lineWidth = 0.08 * S; g.beginPath(); g.moveTo(...P(FL - 0.38, -WH + 0.08)); g.lineTo(...P(A0[0], A0[1] - 0.1)); g.stroke();
  // 닻 간판
  beam(FL, -2.7, FL - 1.05, -2.7, 0.1);
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5; for (const x of [FL - 0.95, FL - 0.35]) { g.beginPath(); g.moveTo(...P(x, -2.7)); g.lineTo(...P(x, -2.45)); g.stroke(); }
  g.fillStyle = '#2f5560'; g.beginPath(); g.roundRect(...P(FL - 1.15, -2.45), 1 * S, 0.8 * S, 4); g.fill();
  g.strokeStyle = '#e7b64a'; g.lineWidth = 0.07 * S; g.lineCap = 'round';
  const [ax, ay] = P(FL - 0.65, -2.05), u = S * 0.1;
  g.beginPath(); g.arc(ax, ay - 2.6 * u, 0.6 * u, 0, TAU); g.moveTo(ax, ay - 2 * u); g.lineTo(ax, ay + 2.4 * u); g.moveTo(ax - 1.2 * u, ay - 1.1 * u); g.lineTo(ax + 1.2 * u, ay - 1.1 * u);
  g.moveTo(ax - 2 * u, ay + 0.8 * u); g.quadraticCurveTo(ax - 1.8 * u, ay + 2.6 * u, ax, ay + 2.6 * u); g.quadraticCurveTo(ax + 1.8 * u, ay + 2.6 * u, ax + 2 * u, ay + 0.8 * u); g.stroke();
  // 통과 상자
  const barrel = (x, h) => {
    const [bx, bb] = P(x, 0), r = 0.38 * S, hh = h * S;
    g.fillStyle = '#7d532d'; g.fillRect(bx - r, bb - hh, r * 2, hh); g.beginPath(); g.ellipse(bx, bb, r, r * 0.35, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#9a6a3b'; g.fillRect(bx - r * 0.75, bb - hh, r * 0.55, hh);
    g.strokeStyle = '#3f3a36'; g.lineWidth = 2; for (const f of [0.2, 0.8]) { g.beginPath(); g.ellipse(bx, bb - hh * f, r, r * 0.35, 0, 0, Math.PI); g.stroke(); }
    g.fillStyle = '#a97a48'; g.beginPath(); g.ellipse(bx, bb - hh, r, r * 0.35, 0, 0, TAU); g.fill();
  };
  barrel(-4.55, 0.95); barrel(-3.75, 0.95);
  const [kx, ky] = P(-4.35, -0.95), kw = 0.85 * S;
  g.fillStyle = '#8a6236'; g.fillRect(kx, ky - kw * 0.8, kw, kw * 0.8); g.fillStyle = '#a47a48'; g.fillRect(kx, ky - kw * 0.8 - 0.15 * S, kw, 0.17 * S);
  g.strokeStyle = '#5a3d22'; g.lineWidth = 1.6; g.strokeRect(kx, ky - kw * 0.8, kw, kw * 0.8); g.beginPath(); g.moveTo(kx, ky - kw * 0.8); g.lineTo(kx + kw, ky); g.stroke();
  const chimney = [CH[0], CH[1] - 1.5];
  return { c, W, H, ox: W / 2, oy: H - 0.8, smoke: chimney };
}
// 발견지 그림. 바닥 가운데가 기준점이고 1m = 32px로 그린다. 빛은 왼쪽 위에서 온다
function spriteBox(W, H, base) { const S = 32, [c, g] = canvas(W * S, H * S), cx = W * S / 2, by = H * S - S * base; return { S, c, g, cx, by, P: (x, y) => [cx + x * S, by + y * S] }; }
function blob(g, P, S, x, y, rx, ry, seed, fill, n = 9, jit = 0.16) {
  g.beginPath();
  for (let i = 0; i < n; i++) { const a = i / n * TAU, r = 1 + (hash(seed, i) - 0.5) * 2 * jit; g.lineTo(...P(x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r)); }
  g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); }
}
function shadowAt(g, P, S, x, rx, ry = 0.45, a = 0.26) { g.fillStyle = `rgba(18,50,40,${a})`; g.beginPath(); g.ellipse(...P(x, 0.05), rx * S, ry * S, 0, 0, TAU); g.fill(); }
function grassTuft(g, P, S, x, seed) {
  g.strokeStyle = '#4f8a3c'; g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const dx = x + (i - 2.5) * 0.12, h = 0.35 + hash(seed, i) * 0.35; g.beginPath(); g.moveTo(...P(dx, 0)); g.quadraticCurveTo(...P(dx + (i - 2.5) * 0.05, -h * 0.6), ...P(dx + (i - 2.5) * 0.1, -h)); g.stroke(); }
}
// 수문 표지: 화살표 널판 두 장, 노란 칠이 바랜 위판
function signSprite() {
  const { S, c, g, P } = spriteBox(5, 6.4, 0.5);
  shadowAt(g, P, S, 0.15, 1.3, 0.38);
  // 기둥
  g.fillStyle = '#5a4228'; g.fillRect(...P(-0.15, -4.9), 0.3 * S, 4.9 * S);
  g.fillStyle = '#7a5a38'; g.fillRect(...P(-0.15, -4.9), 0.11 * S, 4.9 * S);
  g.strokeStyle = 'rgba(40,26,14,.45)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { const y = -0.4 - i * 0.9; g.beginPath(); g.moveTo(...P(0.02, y)); g.lineTo(...P(0.04, y - 0.5)); g.stroke(); }
  g.fillStyle = '#4a3420'; g.beginPath(); g.ellipse(...P(0, -4.9), 0.17 * S, 0.07 * S, 0, 0, TAU); g.fill();
  // 널판: 끝이 뾰족한 화살표
  const board = (x0, x1, y, h, dir, fill, edge, tilt) => {
    const [ox, oy] = P(0, y); g.save(); g.translate(ox, oy); g.rotate(tilt);
    const tip = dir * 0.55;
    const pts = dir > 0 ? [[x0, -h / 2], [x1, -h / 2], [x1 + tip, 0], [x1, h / 2], [x0, h / 2]] : [[x1, -h / 2], [x0, -h / 2], [x0 + tip, 0], [x0, h / 2], [x1, h / 2]];
    g.beginPath(); for (const [px, py] of pts) g.lineTo(px * S, py * S); g.closePath(); g.fillStyle = fill; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(255,240,200,.25)'; g.fillRect(Math.min(x0, x1 + tip) * S - 4, -h / 2 * S, 3 * S, 0.12 * S);
    g.fillStyle = 'rgba(60,40,20,.25)'; g.fillRect(Math.min(x0, x0 + tip) * S - 4, (h / 2 - 0.12) * S, 4 * S, 0.12 * S);
    g.strokeStyle = 'rgba(110,70,30,.35)'; g.lineWidth = 1; for (const f of [-0.18, 0.05, 0.22]) { g.beginPath(); g.moveTo(Math.min(x0, x1) * S - 20, f * h * S * 1.6); g.lineTo(Math.max(x0, x1) * S + 20, (f * h * 1.6 + 0.03) * S); g.stroke(); }
    // 새긴 자국(글자처럼 보이지만 읽히지 않게)
    g.strokeStyle = 'rgba(70,40,20,.4)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const xx = (Math.min(x0, x1) + 0.45 + i * 0.6) * S, yy = (hash(i, x0 * 7) - 0.5) * 0.12 * S; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + (0.28 + hash(x0 * 3, i) * 0.18) * S, yy + 1); g.stroke(); }
    g.restore();
    g.beginPath(); for (const [px, py] of pts) g.lineTo(px * S, py * S); g.closePath(); g.strokeStyle = edge; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#3a2a1a'; for (const xx of [-0.06, 0.08]) { g.beginPath(); g.arc(xx * S, 0, 1.6, 0, TAU); g.fill(); }
    g.restore();
  };
  board(-1.5, 1.2, -4.15, 0.62, 1, '#dcae4a', '#8a6a22', -0.04);
  board(-1.45, 1.05, -3.15, 0.5, -1, '#b98a52', '#6f4f2c', 0.07);
  // 감은 밧줄
  g.strokeStyle = '#d9c9a0'; g.lineWidth = 2.2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(...P(-0.16, -2.2 - i * 0.12)); g.lineTo(...P(0.16, -2.3 - i * 0.12)); g.stroke(); }
  grassTuft(g, P, S, -0.45, 1); grassTuft(g, P, S, 0.4, 2);
  return { c, W: 5, H: 6.4, ox: 2.5, oy: 5.9 };
}
// 돌탑·표지석·돌무지: 납작한 돌을 쌓고 이끼가 낀다
function stoneSprite() {
  const { S, c, g, P } = spriteBox(4.6, 5.6, 0.5);
  shadowAt(g, P, S, 0.2, 1.75, 0.45);
  for (let i = 0; i < 7; i++) blob(g, P, S, -1.6 + hash(i, 1) * 3.2, 0.05 + hash(1, i) * 0.12, 0.14 + hash(i, 2) * 0.1, 0.08, i, ['#8a8d86', '#9fa29a', '#7d8079'][i % 3], 7, 0.25);
  const stones = [[0, 1.45, 0.42, '#878a83', 0.04], [-0.82, 1.15, 0.38, '#9b9e96', -0.06], [-1.55, 0.92, 0.33, '#8c8f88', 0.08], [-2.18, 0.72, 0.3, '#a5a89f', -0.05], [-2.7, 0.46, 0.26, '#959890', 0.1]];
  stones.forEach(([y, rx, ry, col, tilt], i) => {
    const x = tilt * 2, yy = y - ry * 0.85;
    blob(g, P, S, x, yy, rx, ry, i + 20, '#5f625c', 11, 0.1); // 아래 그늘
    blob(g, P, S, x - 0.03, yy - 0.06, rx * 0.97, ry * 0.9, i + 20, col, 11, 0.1);
    blob(g, P, S, x - rx * 0.28, yy - ry * 0.32, rx * 0.55, ry * 0.42, i + 40, 'rgba(255,255,245,.2)', 9, 0.2);
    if (i < 3) for (let k = 0; k < 3; k++) blob(g, P, S, x - rx * 0.6 + hash(i, k + 5) * rx * 1.2, yy + ry * 0.35, 0.12 + hash(k, i) * 0.12, 0.07, i * 7 + k, ['#5f8f45', '#77a552', '#4f7d3a'][k], 7, 0.3); // 이끼
    g.strokeStyle = 'rgba(60,62,58,.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(...P(x + rx * 0.1, yy - ry * 0.2)); g.lineTo(...P(x + rx * 0.35, yy + ry * 0.2)); g.stroke();
  });
  grassTuft(g, P, S, -1.35, 3); grassTuft(g, P, S, 1.3, 4);
  return { c, W: 4.6, H: 5.6, ox: 2.3, oy: 5.1 };
}
// 고목 그루터기: 나이테, 뿌리, 속 빈 구멍, 버섯과 이끼
function stumpSprite() {
  const { S, c, g, P } = spriteBox(5.8, 5.6, 0.6);
  shadowAt(g, P, S, 0.3, 2.3, 0.55);
  // 뿌리
  g.fillStyle = '#5a3f24';
  for (const [x, dir, len] of [[-1.05, -1, 1.1], [1.05, 1, 1.2], [-0.4, -0.4, 0.8], [0.45, 0.5, 0.75]]) { g.beginPath(); g.moveTo(...P(x - 0.25, -0.6)); g.quadraticCurveTo(...P(x + dir * len * 0.5, -0.1), ...P(x + dir * len, 0.1)); g.quadraticCurveTo(...P(x + dir * len * 0.4, 0.05), ...P(x + 0.25, -0.2)); g.closePath(); g.fill(); }
  // 줄기
  const top = -3.5;
  g.fillStyle = '#5e4429'; g.beginPath(); g.moveTo(...P(-1.45, 0)); g.quadraticCurveTo(...P(-1.25, -1.6), ...P(-1.05, top)); g.lineTo(...P(1.05, top)); g.quadraticCurveTo(...P(1.25, -1.6), ...P(1.45, 0)); g.closePath(); g.fill();
  g.fillStyle = '#7d5a35'; g.beginPath(); g.moveTo(...P(-1.45, 0)); g.quadraticCurveTo(...P(-1.25, -1.6), ...P(-1.05, top)); g.lineTo(...P(-0.45, top)); g.quadraticCurveTo(...P(-0.6, -1.6), ...P(-0.7, 0)); g.closePath(); g.fill();
  g.strokeStyle = '#432f1b'; g.lineWidth = 2;
  for (let i = 0; i < 7; i++) { const x = -1.15 + i * 0.38, w = (hash(i, 9) - 0.5) * 0.2; g.beginPath(); g.moveTo(...P(x * 1.1, -0.1)); g.quadraticCurveTo(...P(x + w, -1.8), ...P(x * 0.92, top + 0.2)); g.stroke(); }
  // 속 빈 구멍
  g.fillStyle = '#2a1d10'; g.beginPath(); g.ellipse(...P(0.25, -1.4), 0.5 * S, 0.75 * S, 0, 0, TAU); g.fill();
  g.strokeStyle = '#7d5a35'; g.lineWidth = 3; g.beginPath(); g.ellipse(...P(0.25, -1.4), 0.52 * S, 0.77 * S, 0, PI * 0.9, PI * 1.6); g.stroke();
  // 잘린 면과 나이테, 갈라진 자국
  g.fillStyle = '#5e4429'; g.beginPath(); g.ellipse(...P(0, top), 1.08 * S, 0.42 * S, 0, 0, TAU); g.fill();
  g.fillStyle = '#c9a46c'; g.beginPath(); g.ellipse(...P(-0.02, top - 0.04), 0.96 * S, 0.36 * S, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(140,100,55,.7)'; g.lineWidth = 1.2; for (const f of [0.78, 0.56, 0.34, 0.14]) { g.beginPath(); g.ellipse(...P(0.05, top - 0.04), 0.96 * f * S, 0.36 * f * S, 0, 0, TAU); g.stroke(); }
  g.strokeStyle = '#6b4c2c'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(...P(0.05, top - 0.04)); g.lineTo(...P(0.55, top - 0.2)); g.lineTo(...P(0.8, top - 0.12)); g.stroke();
  // 이끼와 버섯
  for (let k = 0; k < 5; k++) blob(g, P, S, -1.2 + k * 0.22, -0.3 - hash(k, 3) * 0.6, 0.2, 0.14, k + 60, ['#5f8f45', '#77a552'][k % 2], 7, 0.3);
  for (const [x, y, r] of [[1.25, -0.35, 0.26], [1.55, -0.12, 0.2], [-1.7, -0.05, 0.18]]) {
    g.fillStyle = '#efe4cc'; g.fillRect(...P(x - 0.04, y), 0.08 * S, 0.3 * S);
    g.fillStyle = '#c8573f'; g.beginPath(); g.ellipse(...P(x, y), r * S, r * 0.6 * S, 0, PI, TAU); g.fill();
    g.fillStyle = '#fff6e6'; for (const d of [-0.4, 0.2]) { g.beginPath(); g.arc(...P(x + d * r, y - r * 0.3), 1.6, 0, TAU); g.fill(); }
  }
  return { c, W: 5.8, H: 5.6, ox: 2.9, oy: 5 };
}
// 난파선: 반쯤 잠긴 선체, 드러난 늑골, 부러진 돛대. 물에 닿는 곳에 물결이 인다(drawProp)
function wreckSprite() {
  const { S, c, g, P } = spriteBox(9, 5.6, 1);
  g.fillStyle = 'rgba(14,50,70,.32)'; g.beginPath(); g.ellipse(...P(0, 0.1), 3.9 * S, 0.8 * S, 0, 0, TAU); g.fill();
  // 부러진 돛대와 늘어진 밧줄
  g.strokeStyle = '#4a3624'; g.lineWidth = 0.22 * S; g.lineCap = 'round'; g.beginPath(); g.moveTo(...P(0.2, -0.6)); g.lineTo(...P(1.4, -3.7)); g.stroke();
  g.strokeStyle = '#6b5238'; g.lineWidth = 0.08 * S; g.beginPath(); g.moveTo(...P(0.15, -0.6)); g.lineTo(...P(1.3, -3.6)); g.stroke();
  g.strokeStyle = 'rgba(200,185,150,.85)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(1.35, -3.5)); g.quadraticCurveTo(...P(2.3, -2.2), ...P(2.9, -0.7)); g.moveTo(...P(1.2, -3.2)); g.quadraticCurveTo(...P(0.3, -2.1), ...P(-0.9, -1.2)); g.stroke();
  // 선체 안쪽(어둠)과 바깥 판자
  g.fillStyle = '#2f2418'; g.beginPath(); g.moveTo(...P(-3.4, -1.3)); g.quadraticCurveTo(...P(-0.3, -1.9), ...P(3.2, -1.95)); g.lineTo(...P(2.9, -0.5)); g.quadraticCurveTo(...P(0, -0.2), ...P(-3, -0.4)); g.closePath(); g.fill();
  const plank = ['#6b5238', '#5f4831', '#755a3d'];
  for (let i = 0; i < 4; i++) {
    const y0 = -1.25 + i * 0.32, y1 = y0 + 0.3, xr = 3.1 - i * 0.25 - (i === 1 ? 0.9 : 0) - (i === 2 ? 0.4 : 0);
    g.fillStyle = plank[i % 3]; g.beginPath(); g.moveTo(...P(-3.4 + i * 0.12, y0)); g.quadraticCurveTo(...P(0, y0 + 0.45), ...P(xr, y0 - 0.35 + i * 0.05)); g.lineTo(...P(xr - 0.15, y1 - 0.3 + i * 0.05)); g.quadraticCurveTo(...P(0, y1 + 0.45), ...P(-3.3 + i * 0.12, y1)); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,235,200,.12)'; g.fillRect(...P(-2.8 + i * 0.3, y0 + 0.08), 1.6 * S, 0.05 * S);
  }
  // 부서진 끝: 들쭉날쭉
  g.fillStyle = '#2f2418'; g.beginPath(); g.moveTo(...P(1.9, -1.1)); g.lineTo(...P(2.2, -0.75)); g.lineTo(...P(1.95, -0.55)); g.lineTo(...P(2.3, -0.3)); g.lineTo(...P(2.6, -0.62)); g.lineTo(...P(2.4, -1.15)); g.closePath(); g.fill();
  // 늑골
  g.strokeStyle = '#4e3b27'; g.lineWidth = 0.16 * S; g.lineCap = 'round';
  for (const [x, h] of [[-2.2, 1.4], [-1.1, 1.75], [0, 1.9], [1.05, 1.6], [2.0, 1.1]]) { g.beginPath(); g.moveTo(...P(x, -0.45)); g.quadraticCurveTo(...P(x - 0.35, -0.9 - h * 0.6), ...P(x + 0.05, -0.9 - h)); g.stroke(); }
  g.strokeStyle = 'rgba(170,140,100,.45)'; g.lineWidth = 0.05 * S; for (const [x, h] of [[-2.2, 1.4], [-1.1, 1.75], [0, 1.9], [1.05, 1.6]]) { g.beginPath(); g.moveTo(...P(x - 0.05, -0.5)); g.quadraticCurveTo(...P(x - 0.4, -0.9 - h * 0.6), ...P(x, -0.9 - h)); g.stroke(); }
  // 물에 잠긴 아래쪽
  g.save(); g.beginPath(); g.ellipse(...P(-0.1, -0.1), 3.75 * S, 0.75 * S, 0, 0, TAU); g.clip();
  g.fillStyle = 'rgba(38,110,140,.6)'; g.beginPath(); g.moveTo(...P(-4, -0.25)); g.quadraticCurveTo(...P(0, -0.05), ...P(4, -0.35)); g.lineTo(...P(4, 1)); g.lineTo(...P(-4, 1)); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(240,250,250,.75)'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i <= 24; i++) { const x = -3.5 + i * 0.29, y = -0.22 + Math.sin(i * 1.7) * 0.05 + (x * x) * -0.004; g.lineTo(...P(x, y)); }
  g.stroke();
  return { c, W: 9, H: 5.6, ox: 4.5, oy: 4.6, ripple: [3.7, 0.7] };
}
// 탑: 돌 쌓은 흰 탑, 붉은 띠, 난간, 불 켜진 등실(빛은 drawProp이 깜빡인다)
function towerSprite() {
  const { S, c, g, P } = spriteBox(6, 12.6, 0.6);
  shadowAt(g, P, S, 0.5, 2.3, 0.55, 0.28);
  for (let i = 0; i < 6; i++) blob(g, P, S, -1.9 + i * 0.75, -0.05, 0.34 + hash(i, 4) * 0.2, 0.22, i + 80, ['#8c8f88', '#a3a69e', '#7d8079'][i % 3], 8, 0.2);
  const B = 1.45, T = 0.95, TOP = -7.4, xAt = (y, side) => side * (B + (T - B) * (y / TOP));
  const body = (fill, x0f = -1, x1f = 1) => { g.beginPath(); g.moveTo(...P(xAt(0, 1) * x0f, 0)); g.lineTo(...P(xAt(0, 1) * x1f, 0)); g.lineTo(...P(xAt(TOP, 1) * x1f, TOP)); g.lineTo(...P(xAt(TOP, 1) * x0f, TOP)); g.closePath(); g.fillStyle = fill; g.fill(); };
  body('#efe7d4'); body('#d5cab2', 0.25, 1);
  // 붉은 띠
  for (const [y0, y1] of [[-2.2, -3.1], [-4.9, -5.8]]) { g.fillStyle = '#c0533f'; g.beginPath(); g.moveTo(...P(-xAt(y0, 1), y0)); g.lineTo(...P(xAt(y0, 1), y0)); g.lineTo(...P(xAt(y1, 1), y1)); g.lineTo(...P(-xAt(y1, 1), y1)); g.closePath(); g.fill(); g.fillStyle = 'rgba(70,20,10,.25)'; g.beginPath(); g.moveTo(...P(xAt(y0, 1) * 0.25, y0)); g.lineTo(...P(xAt(y0, 1), y0)); g.lineTo(...P(xAt(y1, 1), y1)); g.lineTo(...P(xAt(y1, 1) * 0.25, y1)); g.closePath(); g.fill(); }
  // 돌 쌓은 줄눈
  g.strokeStyle = 'rgba(120,105,80,.35)'; g.lineWidth = 1;
  for (let r = 0; r < 15; r++) { const y = -0.45 - r * 0.47; g.beginPath(); g.moveTo(...P(-xAt(y, 1), y)); g.lineTo(...P(xAt(y, 1), y)); g.stroke(); for (let j = 0; j < 4; j++) { const x = -xAt(y, 1) + (j + (r % 2) * 0.5 + 0.3) * xAt(y, 1) * 0.5; g.beginPath(); g.moveTo(...P(x, y)); g.lineTo(...P(x, y + 0.47)); g.stroke(); } }
  // 문과 창
  g.fillStyle = '#4a3320'; g.beginPath(); g.moveTo(...P(-0.38, 0)); g.lineTo(...P(-0.38, -0.95)); g.arc(...P(0, -0.95), 0.38 * S, PI, 0); g.lineTo(...P(0.38, 0)); g.closePath(); g.fill();
  g.fillStyle = '#7a5232'; g.beginPath(); g.moveTo(...P(-0.28, 0)); g.lineTo(...P(-0.28, -0.95)); g.arc(...P(0, -0.95), 0.28 * S, PI, 0); g.lineTo(...P(0.28, 0)); g.closePath(); g.fill();
  for (const y of [-3.9, -6.6]) { g.fillStyle = '#3a2a1a'; g.beginPath(); g.roundRect(...P(-0.2, y - 0.35), 0.4 * S, 0.6 * S, 5); g.fill(); g.fillStyle = '#ffd98a'; g.beginPath(); g.roundRect(...P(-0.13, y - 0.28), 0.26 * S, 0.46 * S, 4); g.fill(); }
  // 난간 받침
  g.fillStyle = '#3f4448'; g.beginPath(); g.ellipse(...P(0, TOP), 1.35 * S, 0.34 * S, 0, 0, TAU); g.fill();
  g.fillStyle = '#5c6268'; g.beginPath(); g.ellipse(...P(0, TOP - 0.08), 1.3 * S, 0.3 * S, 0, 0, TAU); g.fill();
  // 등실
  g.fillStyle = '#3f4448'; g.fillRect(...P(-0.72, TOP - 1.35), 1.44 * S, 1.3 * S);
  const lg = g.createLinearGradient(...P(-0.6, 0), ...P(0.6, 0)); lg.addColorStop(0, '#fff3c4'); lg.addColorStop(1, '#f1c060');
  g.fillStyle = lg; g.fillRect(...P(-0.6, TOP - 1.25), 1.2 * S, 1.1 * S);
  g.fillStyle = '#3f4448'; for (const x of [-0.2, 0.2]) g.fillRect(...P(x - 0.04, TOP - 1.25), 0.08 * S, 1.1 * S);
  // 난간
  g.strokeStyle = '#2f3438'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(...P(0, TOP - 0.55), 1.3 * S, 0.3 * S, 0, 0, PI); g.stroke();
  for (let i = 0; i <= 8; i++) { const a = i / 8 * PI, x = Math.cos(a) * 1.3, y = Math.sin(a) * 0.3; g.beginPath(); g.moveTo(...P(x, TOP + y - 0.05)); g.lineTo(...P(x, TOP + y - 0.55)); g.stroke(); }
  // 지붕과 꼭지
  g.fillStyle = '#a84f3b'; g.beginPath(); g.moveTo(...P(-0.95, TOP - 1.3)); g.quadraticCurveTo(...P(-0.3, TOP - 1.9), ...P(0, TOP - 2.55)); g.quadraticCurveTo(...P(0.3, TOP - 1.9), ...P(0.95, TOP - 1.3)); g.closePath(); g.fill();
  g.fillStyle = '#c4644d'; g.beginPath(); g.moveTo(...P(-0.95, TOP - 1.3)); g.quadraticCurveTo(...P(-0.3, TOP - 1.9), ...P(0, TOP - 2.55)); g.lineTo(...P(-0.15, TOP - 1.3)); g.closePath(); g.fill();
  g.fillStyle = '#3f4448'; g.beginPath(); g.arc(...P(0, TOP - 2.65), 0.14 * S, 0, TAU); g.fill();
  return { c, W: 6, H: 12.6, ox: 3, oy: 12, glow: [0, TOP - 0.7] };
}
// 빈 오두막: 통나무 벽, 이끼 낀 널지붕, 비뚤어진 돌 굴뚝, 반쯤 열린 문과 떨어진 덧문, 장작더미
function cabinSprite() {
  const { S, c, g, P } = spriteBox(8, 7, 0.7);
  shadowAt(g, P, S, 0.5, 3.7, 0.75, 0.28);
  const FL = -2.4, FR = 1.1, WH = 2.2, D = [1.9, -0.85];
  const poly = (pts, fill) => { g.beginPath(); for (const q of pts) g.lineTo(...P(...q)); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } };
  // 옆벽 통나무
  for (let i = 0; i < 6; i++) { const y = -i * 0.37; poly([[FR, y], [FR + D[0], y + D[1]], [FR + D[0], y + D[1] - 0.36], [FR, y - 0.36]], i % 2 ? '#6b4c2e' : '#5f432a'); }
  // 앞벽 통나무와 모서리 끝
  for (let i = 0; i < 6; i++) {
    const y = -i * 0.37;
    g.fillStyle = i % 2 ? '#86603a' : '#7a5634'; g.beginPath(); g.roundRect(...P(FL - 0.15, y - 0.36), (FR - FL + 0.3) * S, 0.36 * S, 0.17 * S); g.fill();
    g.fillStyle = 'rgba(255,230,190,.16)'; g.fillRect(...P(FL, y - 0.33), (FR - FL) * S, 0.07 * S);
    for (const x of [FL - 0.1, FR + 0.1]) { g.fillStyle = '#c9a46c'; g.beginPath(); g.ellipse(...P(x, y - 0.18), 0.16 * S, 0.17 * S, 0, 0, TAU); g.fill(); g.strokeStyle = '#8a6a40'; g.lineWidth = 1; g.beginPath(); g.ellipse(...P(x, y - 0.18), 0.08 * S, 0.09 * S, 0, 0, TAU); g.stroke(); }
  }
  // 반쯤 열린 문(안은 어둡다)
  g.fillStyle = '#1f1710'; g.fillRect(...P(-0.55, -1.75), 0.9 * S, 1.75 * S);
  poly([[-0.55, 0], [-0.25, 0.08], [-0.25, -1.65], [-0.55, -1.75]], '#6b4a2b');
  // 빈 창과 떨어진 덧문
  g.fillStyle = '#1f1710'; g.fillRect(...P(-1.95, -1.6), 0.75 * S, 0.62 * S);
  g.strokeStyle = '#4a3320'; g.lineWidth = 2.5; g.strokeRect(...P(-1.95, -1.6), 0.75 * S, 0.62 * S);
  g.save(); g.translate(...P(-1.2, -1.6)); g.rotate(0.5); g.fillStyle = '#5d7a72'; g.fillRect(0, 0, 0.32 * S, 0.66 * S); g.restore();
  // 널지붕
  const AP = [(FL + FR) / 2, -WH - 1.5], E0 = [FR + 0.35, -WH + 0.12], A0 = [AP[0], AP[1] - 0.15], A1 = [A0[0] + D[0], A0[1] + D[1]], E1 = [E0[0] + D[0], E0[1] + D[1]];
  poly([[FL, -WH], [FR, -WH], AP], '#6b4c2e');
  for (let i = 0; i < 3; i++) poly([[FL + 0.3 + i * 0.25, -WH - i * 0.4], [FR - 0.3 - i * 0.25, -WH - i * 0.4], [FR - 0.5 - i * 0.25, -WH - i * 0.4 - 0.35], [FL + 0.5 + i * 0.25, -WH - i * 0.4 - 0.35]], i % 2 ? '#7a5634' : '#86603a');
  poly([A0, A1, E1, E0], '#7d6a52');
  const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  g.save(); poly([A0, A1, E1, E0]); g.clip();
  for (let i = 0; i < 7; i++) { const a = lerp(E0, A0, i / 7), b = lerp(E1, A1, i / 7); g.strokeStyle = 'rgba(50,40,30,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); for (let j = 1; j < 7; j++) { const q = lerp(a, b, (j + (i % 2) * 0.5) / 7), q2 = lerp(lerp(E0, A0, (i + 1) / 7), lerp(E1, A1, (i + 1) / 7), (j + (i % 2) * 0.5) / 7); g.beginPath(); g.moveTo(...P(...q)); g.lineTo(...P(...q2)); g.stroke(); } }
  for (let k = 0; k < 6; k++) { const q = lerp(lerp(E0, A0, hash(k, 1) * 0.9), lerp(E1, A1, hash(k, 1) * 0.9), hash(2, k)); blob(g, P, S, q[0], q[1], 0.3, 0.14, k + 90, ['#5f8f45', '#77a552', '#4f7d3a'][k % 3], 7, 0.3); }
  g.restore();
  g.strokeStyle = '#4a3420'; g.lineWidth = 0.2 * S; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(...P(FL - 0.35, -WH + 0.12)); g.lineTo(...P(...A0)); g.lineTo(...P(...E0)); g.stroke();
  g.strokeStyle = '#8f7b60'; g.lineWidth = 0.12 * S; g.beginPath(); g.moveTo(...P(...A0)); g.lineTo(...P(...A1)); g.stroke();
  // 비뚤어진 돌 굴뚝
  const CH = lerp(lerp(E0, A0, 0.45), lerp(E1, A1, 0.45), 0.75);
  for (let i = 0; i < 5; i++) blob(g, P, S, CH[0] + (i % 2) * 0.05 - 0.03 * i, CH[1] - i * 0.24, 0.3, 0.13, i + 110, ['#8c8f88', '#a3a69e'][i % 2], 8, 0.15);
  // 장작더미
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { const x = FL - 1.15 + i * 0.32 + r * 0.16, y = -0.14 - r * 0.27; g.fillStyle = '#c9a46c'; g.beginPath(); g.ellipse(...P(x, y), 0.15 * S, 0.14 * S, 0, 0, TAU); g.fill(); g.strokeStyle = '#6b4c2c'; g.lineWidth = 1.5; g.stroke(); }
  grassTuft(g, P, S, 2.4, 6); grassTuft(g, P, S, -0.9, 7);
  return { c, W: 8, H: 7, ox: 4, oy: 6.3 };
}

// 멈춘 물레방아: 돌 기단 위 방앗간, 이끼 낀 큰 바퀴, 마른 물길
function millSprite() {
  const { S, c, g, P } = spriteBox(9, 8.4, 0.7);
  shadowAt(g, P, S, 0.4, 4, 0.8, 0.28);
  const poly = (pts, fill) => { g.beginPath(); for (const q of pts) g.lineTo(...P(...q)); g.closePath(); g.fillStyle = fill; g.fill(); };
  const FL = -2.6, FR = 0.9, WH = 2.6, D = [1.8, -0.8];
  poly([[FR, 0], [FR + D[0], D[1]], [FR + D[0], D[1] - WH], [FR, -WH]], '#b7ab92');
  poly([[FL, 0], [FR, 0], [FR, -WH], [FL, -WH]], '#d9cdb1');
  for (let r = 0; r < 6; r++) for (let i = 0; i < 7; i++) { const x = FL + 0.05 + i * 0.5 + (r % 2) * 0.25; if (x > FR - 0.35) continue; g.fillStyle = hash(i, r) > 0.5 ? 'rgba(150,135,105,.35)' : 'rgba(255,250,235,.25)'; g.beginPath(); g.roundRect(...P(x, -0.42 - r * 0.42), 0.44 * S, 0.36 * S, 3); g.fill(); }
  g.fillStyle = '#4a3320'; g.fillRect(...P(-1.3, -1.7), 0.9 * S, 1.7 * S); g.fillStyle = '#6b4a2b'; g.fillRect(...P(-1.22, -1.62), 0.74 * S, 1.62 * S);
  g.fillStyle = '#2f2418'; g.fillRect(...P(-2.25, -2.1), 0.6 * S, 0.55 * S);
  // 널지붕
  const AP = [(FL + FR) / 2, -WH - 1.6], E0 = [FR + 0.35, -WH + 0.12], A0 = [AP[0], AP[1] - 0.15], A1 = [A0[0] + D[0], A0[1] + D[1]], E1 = [E0[0] + D[0], E0[1] + D[1]];
  poly([[FL, -WH], [FR, -WH], AP], '#c9bc9f');
  poly([A0, A1, E1, E0], '#6f5a44');
  const lerp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  g.strokeStyle = 'rgba(40,30,20,.45)'; g.lineWidth = 1.4; for (let i = 1; i < 7; i++) { g.beginPath(); g.moveTo(...P(...lerp(E0, A0, i / 7))); g.lineTo(...P(...lerp(E1, A1, i / 7))); g.stroke(); }
  g.strokeStyle = '#4a3420'; g.lineWidth = 0.2 * S; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(...P(FL - 0.35, -WH + 0.12)); g.lineTo(...P(...A0)); g.lineTo(...P(...E0)); g.stroke();
  // 마른 물길(나무 홈통)
  poly([[FR + D[0] - 0.2, D[1] - WH + 0.4], [FR + D[0] + 1.6, D[1] - WH + 0.1], [FR + D[0] + 1.6, D[1] - WH + 0.35], [FR + D[0] - 0.2, D[1] - WH + 0.65]], '#6b4c2c');
  // 큰 바퀴: 옆벽에 붙어 있다
  const [wx, wy] = [FR + D[0] * 0.55, D[1] * 0.55 - 1.45], R = 1.55;
  g.strokeStyle = '#4e3822'; g.lineWidth = 0.18 * S; g.beginPath(); g.ellipse(...P(wx, wy), R * 0.55 * S, R * S, 0, 0, TAU); g.stroke();
  g.strokeStyle = '#6b4c2c'; g.lineWidth = 0.08 * S; g.beginPath(); g.ellipse(...P(wx, wy), R * 0.4 * S, R * 0.72 * S, 0, 0, TAU); g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, x = wx + Math.cos(a) * R * 0.55, y = wy + Math.sin(a) * R; g.strokeStyle = '#4e3822'; g.lineWidth = 0.07 * S; g.beginPath(); g.moveTo(...P(wx, wy)); g.lineTo(...P(x, y)); g.stroke(); g.fillStyle = '#7a5a38'; g.fillRect(...P(x - 0.14, y - 0.08), 0.28 * S, 0.16 * S); }
  g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(...P(wx, wy), 0.14 * S, 0.22 * S, 0, 0, TAU); g.fill();
  for (let k = 0; k < 5; k++) blob(g, P, S, wx + (hash(k, 4) - 0.5) * R, wy + R * (0.4 + hash(4, k) * 0.5), 0.2, 0.12, k + 130, ['#5f8f45', '#77a552'][k % 2], 7, 0.3);
  grassTuft(g, P, S, -3, 8); grassTuft(g, P, S, 3.4, 9);
  return { c, W: 9, H: 8.4, ox: 4.5, oy: 7.7 };
}
// 숲속 암자: 돌계단 위 작은 돌 예배당, 기와지붕과 종탑, 등잔(유럽풍 세계에 맞춰)
function shrineSprite() {
  const { S, c, g, P } = spriteBox(7, 7.4, 0.6);
  shadowAt(g, P, S, 0.3, 3, 0.7, 0.28);
  for (let i = 0; i < 3; i++) { g.fillStyle = ['#9a9d95', '#aeb1a8', '#8c8f88'][i]; g.fillRect(...P(-2.4 + i * 0.3, -0.35 * (i + 1)), (4.8 - i * 0.6) * S, 0.35 * S); g.fillStyle = 'rgba(255,255,245,.18)'; g.fillRect(...P(-2.4 + i * 0.3, -0.35 * (i + 1)), (4.8 - i * 0.6) * S, 0.07 * S); }
  const by = -1.05;
  g.fillStyle = '#e4d6b8'; g.fillRect(...P(-1.5, by - 2.1), 3 * S, 2.1 * S);
  g.fillStyle = '#c9b48f'; g.fillRect(...P(0.9, by - 2.1), 0.6 * S, 2.1 * S);
  for (const x of [-1.5, 1.32]) { g.fillStyle = '#7a3a2a'; g.fillRect(...P(x, by - 2.1), 0.18 * S, 2.1 * S); }
  g.fillStyle = '#2a1d14'; g.beginPath(); g.moveTo(...P(-0.55, by)); g.lineTo(...P(-0.55, by - 1.2)); g.arc(...P(0, by - 1.2), 0.55 * S, PI, 0); g.lineTo(...P(0.55, by)); g.closePath(); g.fill();
  const gl = g.createRadialGradient(...P(0, by - 0.6), 0, ...P(0, by - 0.6), 0.6 * S); gl.addColorStop(0, 'rgba(255,214,120,.9)'); gl.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = gl; g.beginPath(); g.arc(...P(0, by - 0.6), 0.6 * S, 0, TAU); g.fill();
  g.fillStyle = '#ffe2a0'; g.beginPath(); g.ellipse(...P(0, by - 0.55), 0.08 * S, 0.14 * S, 0, 0, TAU); g.fill();
  // 기와 박공지붕과 종탑
  const ry = by - 2.1;
  g.fillStyle = '#a84f3b'; g.beginPath(); g.moveTo(...P(-1.95, ry + 0.15)); g.lineTo(...P(0, ry - 1.35)); g.lineTo(...P(1.95, ry + 0.15)); g.closePath(); g.fill();
  g.fillStyle = '#c4644d'; g.beginPath(); g.moveTo(...P(-1.95, ry + 0.15)); g.lineTo(...P(0, ry - 1.35)); g.lineTo(...P(-0.2, ry + 0.15)); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(70,25,15,.35)'; g.lineWidth = 1.2; for (let i = 1; i < 5; i++) { const f = i / 5; g.beginPath(); g.moveTo(...P(-1.95 * (1 - f), ry + 0.15 - 1.5 * f)); g.lineTo(...P(1.95 * (1 - f), ry + 0.15 - 1.5 * f)); g.stroke(); }
  g.fillStyle = '#c9bc9f'; g.fillRect(...P(-0.4, ry - 2.35), 0.8 * S, 1.15 * S);
  g.fillStyle = '#2a1d14'; g.beginPath(); g.moveTo(...P(-0.24, ry - 1.3)); g.lineTo(...P(-0.24, ry - 1.9)); g.arc(...P(0, ry - 1.9), 0.24 * S, PI, 0); g.lineTo(...P(0.24, ry - 1.3)); g.closePath(); g.fill();
  g.fillStyle = '#c9a24a'; g.beginPath(); g.moveTo(...P(-0.15, ry - 1.45)); g.quadraticCurveTo(...P(-0.15, ry - 1.9), ...P(0, ry - 1.9)); g.quadraticCurveTo(...P(0.15, ry - 1.9), ...P(0.15, ry - 1.45)); g.closePath(); g.fill();
  g.fillStyle = '#a84f3b'; g.beginPath(); g.moveTo(...P(-0.55, ry - 2.3)); g.lineTo(...P(0, ry - 2.8)); g.lineTo(...P(0.55, ry - 2.3)); g.closePath(); g.fill();
  g.strokeStyle = '#3f3a36'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...P(0, ry - 2.8)); g.lineTo(...P(0, ry - 3.2)); g.moveTo(...P(-0.15, ry - 3.05)); g.lineTo(...P(0.15, ry - 3.05)); g.stroke();
  // 이끼 낀 돌등
  for (const x of [-2.6, 2.4]) { g.fillStyle = '#8c8f88'; g.fillRect(...P(x - 0.15, -1.2), 0.3 * S, 1.2 * S); g.fillStyle = '#9fa29a'; g.fillRect(...P(x - 0.3, -1.55), 0.6 * S, 0.38 * S); g.fillStyle = '#7d8079'; g.beginPath(); g.moveTo(...P(x - 0.38, -1.55)); g.lineTo(...P(x, -1.9)); g.lineTo(...P(x + 0.38, -1.55)); g.closePath(); g.fill(); blob(g, P, S, x, -0.2, 0.25, 0.12, x * 10, '#5f8f45', 7, 0.3); }
  return { c, W: 7, H: 7.4, ox: 3.5, oy: 6.8 };
}
// 빈 야영지: 기운 천막, 식은 모닥불 돌, 통나무 의자, 걸린 냄비
function campSprite() {
  const { S, c, g, P } = spriteBox(7, 4.6, 0.5);
  shadowAt(g, P, S, 0.3, 3.1, 0.55, 0.22);
  // 천막
  g.fillStyle = '#b8a77e'; g.beginPath(); g.moveTo(...P(-3, 0)); g.lineTo(...P(-1.6, -2.4)); g.lineTo(...P(-0.2, 0)); g.closePath(); g.fill();
  g.fillStyle = '#d8c79c'; g.beginPath(); g.moveTo(...P(-3, 0)); g.lineTo(...P(-1.6, -2.4)); g.lineTo(...P(-1.4, 0)); g.closePath(); g.fill();
  g.fillStyle = '#3a2f22'; g.beginPath(); g.moveTo(...P(-1.6, -1.4)); g.lineTo(...P(-1.1, 0)); g.lineTo(...P(-2, 0)); g.closePath(); g.fill();
  g.fillStyle = 'rgba(150,90,60,.5)'; g.beginPath(); g.moveTo(...P(-2.2, -0.9)); g.lineTo(...P(-1.9, -0.4)); g.lineTo(...P(-2.5, -0.5)); g.closePath(); g.fill(); // 기운 자국
  g.strokeStyle = '#5a4228'; g.lineWidth = 0.08 * S; g.beginPath(); g.moveTo(...P(-1.6, -2.4)); g.lineTo(...P(-1.6, -2.7)); g.stroke();
  // 모닥불 돌과 재
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; blob(g, P, S, 1.2 + Math.cos(a) * 0.62, -0.25 + Math.sin(a) * 0.28, 0.17, 0.12, i + 150, ['#8c8f88', '#a3a69e'][i % 2], 7, 0.2); }
  g.fillStyle = '#4a4440'; g.beginPath(); g.ellipse(...P(1.2, -0.25), 0.42 * S, 0.18 * S, 0, 0, TAU); g.fill();
  g.strokeStyle = '#2a1d10'; g.lineWidth = 0.09 * S; g.beginPath(); g.moveTo(...P(0.95, -0.2)); g.lineTo(...P(1.45, -0.35)); g.moveTo(...P(1, -0.35)); g.lineTo(...P(1.4, -0.15)); g.stroke();
  // 냄비 걸이
  g.strokeStyle = '#4a3624'; g.lineWidth = 0.07 * S; g.beginPath(); g.moveTo(...P(0.55, -0.1)); g.lineTo(...P(0.85, -1.2)); g.moveTo(...P(1.85, -0.1)); g.lineTo(...P(1.55, -1.2)); g.moveTo(...P(0.75, -1.12)); g.lineTo(...P(1.65, -1.12)); g.stroke();
  g.strokeStyle = '#2f2f30'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(...P(1.2, -1.12)); g.lineTo(...P(1.2, -0.85)); g.stroke();
  g.fillStyle = '#3a3b3d'; g.beginPath(); g.ellipse(...P(1.2, -0.7), 0.24 * S, 0.17 * S, 0, 0, TAU); g.fill();
  // 통나무 의자
  g.fillStyle = '#7a5634'; g.beginPath(); g.roundRect(...P(2.1, -0.45), 0.95 * S, 0.38 * S, 0.19 * S); g.fill();
  g.fillStyle = '#c9a46c'; g.beginPath(); g.ellipse(...P(3.05, -0.26), 0.13 * S, 0.19 * S, 0, 0, TAU); g.fill();
  grassTuft(g, P, S, 0.1, 10); grassTuft(g, P, S, 2.9, 11);
  return { c, W: 7, H: 4.6, ox: 3.5, oy: 4.1 };
}
// 통나무 더미: 쌓은 통나무와 고임 말뚝
function logpileSprite() {
  const { S, c, g, P } = spriteBox(6.4, 4, 0.5);
  shadowAt(g, P, S, 0.3, 2.9, 0.5, 0.24);
  for (const x of [-2.3, 2.3]) { g.fillStyle = '#5a4228'; g.fillRect(...P(x - 0.09, -2.1), 0.18 * S, 2.1 * S); }
  const rows = [[0, 5], [1, 4], [2, 3], [3, 2]];
  for (const [r, n] of rows) for (let i = 0; i < n; i++) {
    const x = -1.9 + r * 0.42 + i * 0.84, y = -0.38 - r * 0.6;
    g.fillStyle = '#6b4c2c'; g.beginPath(); g.roundRect(...P(x - 0.42, y - 0.3), 0.6 * S, 0.62 * S, 0.3 * S); g.fill();
    g.fillStyle = '#d2b07a'; g.beginPath(); g.arc(...P(x, y), 0.31 * S, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(140,100,55,.6)'; g.lineWidth = 1; for (const f of [0.66, 0.36]) { g.beginPath(); g.arc(...P(x + 0.02, y + 0.01), 0.31 * f * S, 0, TAU); g.stroke(); }
    g.strokeStyle = '#4e3822'; g.lineWidth = 1.6; g.beginPath(); g.arc(...P(x, y), 0.31 * S, 0, TAU); g.stroke();
  }
  blob(g, P, S, -1.8, -0.1, 0.3, 0.12, 170, '#5f8f45', 7, 0.3); grassTuft(g, P, S, 2.6, 12);
  return { c, W: 6.4, H: 4, ox: 3.2, oy: 3.5 };
}
// 봉화대: 돌을 쌓은 단 위 화로, 불꽃은 drawProp이 흔든다
function beaconSprite() {
  const { S, c, g, P } = spriteBox(5.4, 7.6, 0.6);
  shadowAt(g, P, S, 0.3, 2.3, 0.55, 0.28);
  const B = 1.7, T = 1.15, TOP = -3.6, xAt = (y) => B + (T - B) * (y / TOP);
  g.fillStyle = '#9a9d95'; g.beginPath(); g.moveTo(...P(-B, 0)); g.lineTo(...P(B, 0)); g.lineTo(...P(T, TOP)); g.lineTo(...P(-T, TOP)); g.closePath(); g.fill();
  g.fillStyle = '#82857e'; g.beginPath(); g.moveTo(...P(B * 0.3, 0)); g.lineTo(...P(B, 0)); g.lineTo(...P(T, TOP)); g.lineTo(...P(T * 0.3, TOP)); g.closePath(); g.fill();
  for (let r = 0; r < 7; r++) { const y = -0.5 - r * 0.5; g.strokeStyle = 'rgba(70,72,68,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(...P(-xAt(y), y)); g.lineTo(...P(xAt(y), y)); g.stroke(); for (let j = 0; j < 3; j++) { const x = -xAt(y) + (j + 0.5 + (r % 2) * 0.5) * xAt(y) * 0.66; g.beginPath(); g.moveTo(...P(x, y)); g.lineTo(...P(x, y + 0.5)); g.stroke(); } }
  // 화로
  g.fillStyle = '#3a3b3d'; g.beginPath(); g.moveTo(...P(-0.85, TOP - 0.1)); g.lineTo(...P(0.85, TOP - 0.1)); g.lineTo(...P(1, TOP - 0.8)); g.lineTo(...P(-1, TOP - 0.8)); g.closePath(); g.fill();
  g.fillStyle = '#55575a'; g.beginPath(); g.ellipse(...P(0, TOP - 0.8), 1 * S, 0.28 * S, 0, 0, TAU); g.fill();
  g.fillStyle = '#d0682f'; g.beginPath(); g.ellipse(...P(0, TOP - 0.82), 0.8 * S, 0.2 * S, 0, 0, TAU); g.fill();
  for (let k = 0; k < 5; k++) blob(g, P, S, -1.3 + hash(k, 6) * 2.6, -0.2 - hash(6, k) * 1.2, 0.2, 0.12, k + 180, ['#5f8f45', '#77a552'][k % 2], 7, 0.3);
  return { c, W: 5.4, H: 7.6, ox: 2.7, oy: 7, fire: [0, TOP - 0.9] };
}
// 은둔처: 가지를 기대어 세운 움막과 껍질 지붕, 빨랫줄과 물통
function shelterSprite() {
  const { S, c, g, P } = spriteBox(6.6, 4.8, 0.5);
  shadowAt(g, P, S, 0.4, 3, 0.6, 0.24);
  g.fillStyle = '#2a1d14'; g.beginPath(); g.moveTo(...P(-2.4, 0)); g.lineTo(...P(-1.1, -2.6)); g.lineTo(...P(1.4, -2.6)); g.lineTo(...P(2.2, 0)); g.closePath(); g.fill();
  // 기대 세운 가지
  for (let i = 0; i < 11; i++) { const x0 = -2.4 + i * 0.44, x1 = -1.1 + i * 0.25; g.strokeStyle = i % 2 ? '#6b4c2c' : '#5a3f24'; g.lineWidth = 0.14 * S; g.lineCap = 'round'; g.beginPath(); g.moveTo(...P(x0, 0)); g.lineTo(...P(x1, -2.65)); g.stroke(); }
  // 껍질 지붕 조각
  for (let i = 0; i < 6; i++) { const x = -1.9 + i * 0.62, y = -0.9 - (i % 2) * 0.7; g.fillStyle = ['#8a6e4c', '#7a5f40', '#9a7d58'][i % 3]; g.beginPath(); g.roundRect(...P(x, y - 0.5), 0.75 * S, 0.5 * S, 3); g.fill(); }
  for (let k = 0; k < 6; k++) blob(g, P, S, -1.6 + k * 0.55, -2.3 + hash(k, 2) * 0.4, 0.28, 0.14, k + 190, ['#5f8f45', '#77a552', '#4f7d3a'][k % 3], 7, 0.3);
  g.strokeStyle = '#3f2e1d'; g.lineWidth = 0.18 * S; g.beginPath(); g.moveTo(...P(-1.25, -2.62)); g.lineTo(...P(1.6, -2.62)); g.stroke();
  // 빨랫줄과 천
  g.strokeStyle = '#5a4228'; g.lineWidth = 0.08 * S; g.beginPath(); g.moveTo(...P(2.9, 0)); g.lineTo(...P(2.9, -1.9)); g.stroke();
  g.strokeStyle = 'rgba(220,205,170,.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(...P(1.5, -2.4)); g.quadraticCurveTo(...P(2.2, -1.95), ...P(2.9, -1.85)); g.stroke();
  g.fillStyle = '#d9cfb5'; g.fillRect(...P(1.95, -2.1), 0.35 * S, 0.5 * S); g.fillStyle = '#9a5a46'; g.fillRect(...P(2.4, -1.95), 0.3 * S, 0.42 * S);
  // 물통
  g.fillStyle = '#7d532d'; g.fillRect(...P(-2.95, -0.7), 0.55 * S, 0.7 * S); g.fillStyle = '#4a7f95'; g.beginPath(); g.ellipse(...P(-2.675, -0.7), 0.27 * S, 0.1 * S, 0, 0, TAU); g.fill();
  g.strokeStyle = '#3f3a36'; g.lineWidth = 1.5; g.strokeRect(...P(-2.95, -0.5), 0.55 * S, 0.01 * S);
  grassTuft(g, P, S, 0.2, 13); grassTuft(g, P, S, 3.1, 14);
  return { c, W: 6.6, H: 4.8, ox: 3.3, oy: 4.3 };
}
// 뭍에 끌어 올린 쪽배: 엎어진 노, 닻줄, 갈대
function beachedSprite() {
  const { S, c, g, P } = spriteBox(7.4, 3.8, 0.6);
  shadowAt(g, P, S, 0.2, 3.2, 0.5, 0.24);
  const hull = (inset, fill) => { g.beginPath(); g.moveTo(...P(-2.9 + inset, -0.6)); g.quadraticCurveTo(...P(-0.5, -1.05 + inset * 0.3), ...P(2.9 - inset, -1)); g.quadraticCurveTo(...P(2.4, 0.05 - inset * 0.3), ...P(0.2, 0.1 - inset * 0.3)); g.quadraticCurveTo(...P(-2.3, 0.05 - inset * 0.3), ...P(-2.9 + inset, -0.6)); g.closePath(); g.fillStyle = fill; g.fill(); };
  hull(0, '#3f6f8f'); hull(0.08, '#2f5570');
  g.fillStyle = '#a8483a'; g.beginPath(); g.moveTo(...P(-2.5, -0.25)); g.quadraticCurveTo(...P(0, 0.12), ...P(2.6, -0.3)); g.quadraticCurveTo(...P(0, 0.2), ...P(-2.5, -0.25)); g.fill();
  hull(0.28, '#7f5a36');
  g.strokeStyle = 'rgba(40,24,10,.35)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(...P(-2.1, -0.55 + i * 0.13)); g.quadraticCurveTo(...P(0, -0.85 + i * 0.13), ...P(2.3, -0.8 + i * 0.13)); g.stroke(); }
  g.fillStyle = '#c79c63'; for (const x of [-1, 0.9]) g.fillRect(...P(x - 0.15, -0.95), 0.3 * S, 0.75 * S);
  g.strokeStyle = 'rgba(255,240,210,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(...P(-2.8, -0.62)); g.quadraticCurveTo(...P(-0.5, -1.06), ...P(2.85, -1.02)); g.stroke();
  // 노 하나는 배에 걸치고
  g.strokeStyle = '#8a6a44'; g.lineWidth = 0.1 * S; g.lineCap = 'round'; g.beginPath(); g.moveTo(...P(-1.6, -0.9)); g.lineTo(...P(1.9, 0.15)); g.stroke();
  g.fillStyle = '#a07a4c'; g.beginPath(); g.ellipse(...P(2.05, 0.2), 0.42 * S, 0.14 * S, 0.3, 0, TAU); g.fill();
  // 닻줄과 말뚝
  g.fillStyle = '#5a4228'; g.fillRect(...P(-3.4, -0.9), 0.16 * S, 0.9 * S);
  g.strokeStyle = 'rgba(220,205,170,.9)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(...P(-3.3, -0.75)); g.quadraticCurveTo(...P(-3.05, -0.3), ...P(-2.8, -0.6)); g.stroke();
  // 갈대
  g.strokeStyle = '#6f9a4a'; g.lineWidth = 1.6; for (let i = 0; i < 7; i++) { const x = 3 + (i - 3) * 0.12, h = 0.9 + hash(i, 20) * 0.6; g.beginPath(); g.moveTo(...P(x, 0)); g.quadraticCurveTo(...P(x, -h * 0.6), ...P(x + (i - 3) * 0.06, -h)); g.stroke(); if (i % 2 === 0) { g.fillStyle = '#7b5b35'; g.fillRect(...P(x + (i - 3) * 0.06 - 0.04, -h - 0.15), 0.09 * S, 0.28 * S); } }
  return { c, W: 7.4, H: 3.8, ox: 3.7, oy: 3.2 };
}

// 표류물: 물에 뜬 통나무·천 뭉치·상자
function flotSprite(k) {
  const [c, g] = canvas(128, 96), cx = 64, cy = 58;
  g.fillStyle = 'rgba(14,50,70,.3)'; g.beginPath(); g.ellipse(cx, cy + 10, 44, 13, 0, 0, TAU); g.fill();
  if (k === 'wood') {
    // 통나무 두 개: 껍질 결과 밝은 단면
    for (const [y, x0, len, col] of [[2, -40, 76, '#7d5a35'], [-12, -34, 70, '#94703f']]) {
      g.fillStyle = col; g.beginPath(); g.roundRect(cx + x0, cy + y - 8, len, 16, 8); g.fill();
      g.fillStyle = 'rgba(255,236,200,.22)'; g.fillRect(cx + x0 + 6, cy + y - 6, len - 14, 3);
      g.strokeStyle = 'rgba(60,40,20,.45)'; g.lineWidth = 1.4; for (let i = 0; i < 5; i++) { const xx = cx + x0 + 10 + i * 12; g.beginPath(); g.moveTo(xx, cy + y - 2 + (i % 2) * 3); g.lineTo(xx + 9, cy + y - 1 + (i % 2) * 3); g.stroke(); }
      g.fillStyle = '#d8bb8a'; g.beginPath(); g.ellipse(cx + x0 + len - 4, cy + y, 5, 8, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(140,100,55,.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx + x0 + len - 4, cy + y, 2.4, 4, 0, 0, TAU); g.stroke();
    }
  } else if (k === 'cloth') {
    // 끈으로 묶은 천 꾸러미
    g.fillStyle = '#cfbf98'; g.beginPath(); g.ellipse(cx, cy - 4, 34, 20, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8dbb8'; g.beginPath(); g.ellipse(cx - 4, cy - 9, 28, 14, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(150,125,85,.6)'; g.lineWidth = 1.5; for (const d of [-14, 0, 14]) { g.beginPath(); g.moveTo(cx + d - 6, cy - 20); g.quadraticCurveTo(cx + d + 4, cy - 6, cx + d - 2, cy + 10); g.stroke(); }
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; for (const d of [-12, 12]) { g.beginPath(); g.ellipse(cx + d, cy - 4, 3.5, 20, 0, 0, TAU); g.stroke(); }
    g.beginPath(); g.moveTo(cx + 12, cy - 22); g.quadraticCurveTo(cx + 20, cy - 30, cx + 26, cy - 24); g.stroke();
  } else {
    // 쇠띠를 두른 상자, 뚜껑 틈으로 금빛
    g.fillStyle = '#7a5530'; g.fillRect(cx - 28, cy - 22, 56, 32);
    g.fillStyle = '#9a6d3f'; g.beginPath(); g.moveTo(cx - 30, cy - 22); g.lineTo(cx + 30, cy - 22); g.quadraticCurveTo(cx + 30, cy - 36, cx, cy - 38); g.quadraticCurveTo(cx - 30, cy - 36, cx - 30, cy - 22); g.fill();
    g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 1.2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(cx - 28, cy - 22 + i * 8); g.lineTo(cx + 28, cy - 22 + i * 8); g.stroke(); }
    g.fillStyle = '#4a4a4c'; for (const x of [-20, 14]) { g.fillRect(cx + x, cy - 36, 6, 46); }
    g.fillStyle = '#ffd86a'; g.fillRect(cx - 26, cy - 23.5, 52, 3);
    g.fillStyle = '#e7b64a'; g.fillRect(cx - 4, cy - 20, 8, 9); g.fillStyle = '#5a4020'; g.fillRect(cx - 1, cy - 17, 2, 4);
  }
  // 물에 잠긴 아랫부분과 물결
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(38,110,140,.5)'; g.fillRect(0, cy + 4, 128, 40); g.globalCompositeOperation = 'source-over';
  g.strokeStyle = 'rgba(240,250,250,.8)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 14; i++) { const x = cx - 42 + i * 6; g.lineTo(x, cy + 5 + Math.sin(i * 1.8) * 1.6); } g.stroke();
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
