// 시작 화면(독립 실행 앱): Danny Soft 로고 → 픽셀 아트 쿼터뷰 타이틀 "Zombie Outpost".
// 테마: 붕괴 뒤의 밤, 무너진 도시 끝의 전초기지. 모닥불과 탐조등만이 빛이고, 안개 속 도로로 좀비가 다가온다.
// 그리는 법: 가로 약 200칸짜리 낮은 해상도 화면에 한 칸(픽셀)씩 그리고, 실제 화면에는 정수 배로 키워 또렷한 픽셀로 보인다.
//   모양은 스캔라인으로 채워 가장자리가 흐려지지 않고, 반투명(빛·안개·노을)은 4×4 바이어 디더링으로 낸다.
//   움직이지 않는 풍경은 한 번 그려 두고, 매 프레임 그 위에 움직이는 것(빛·불·연기·사람·좀비·안개·재)만 덧그린다.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y, a) => BAYER[(y & 3) * 4 + (x & 3)] < a * 16;
const hash = (a, b = 0, c = 0) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const pack = ([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
const C = (hex) => pack(rgb(hex));
const unpack = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
const lerpC = (a, b, t) => { const x = unpack(a), y = unpack(b); return pack([0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t))); };

// 팔레트: 한밤 남색 · 불씨 주황 · 좀비 초록
const P = {
  void: C('#05060a'), sky0: C('#070a14'), sky1: C('#10152b'), sky2: C('#1d1a35'), sky3: C('#3a2236'), sky4: C('#6e2f28'), glow: C('#b5502a'),
  star: C('#cfd6ff'), starD: C('#7d86b8'), moon: C('#ece4cc'), moonD: C('#bdb39a'), moonE: C('#968d78'),
  city0: C('#0a0c14'), city1: C('#11141e'), cityE: C('#1a1d2a'), cityLit: C('#f2a93b'), cityLit2: C('#c86a2a'),
  smoke: C('#2c2a36'), smoke2: C('#3e3a46'),
  grass0: C('#17221a'), grass1: C('#1d2b20'), grass2: C('#243526'), grass3: C('#2e4430'), blade: C('#3c5a3a'),
  dirt0: C('#2a231d'), dirt1: C('#352c24'), dirt2: C('#43382c'),
  road0: C('#1c1f25'), road1: C('#24282f'), road2: C('#2e333b'), roadLine: C('#6a6448'), crack: C('#121418'),
  wood0: C('#3a281b'), wood1: C('#523826'), wood2: C('#6e4e34'), wood3: C('#8a6644'),
  metal0: C('#2a2f36'), metal1: C('#3f464f'), metal2: C('#5a636e'), metal3: C('#7e8894'),
  stone0: C('#34343a'), stone1: C('#4a4a52'), stone2: C('#62626a'),
  tent0: C('#2f3a2a'), tent1: C('#435238'), tent2: C('#5a6b48'),
  canvas0: C('#5a4e3a'), canvas1: C('#7a6a4c'),
  fire0: C('#c8401a'), fire1: C('#ff7a1f'), fire2: C('#ffc04a'), fire3: C('#fff1b0'),
  light: C('#ffe6a8'), win: C('#f2b55a'), winD: C('#a8682a'),
  skin: C('#e0c29f'), skinD: C('#b89a7a'), jacket: C('#d98a2b'), jacketD: C('#a5631c'), pants: C('#2c3340'), hair: C('#3a2a1e'), gun: C('#202328'),
  zskin: C('#8ea06e'), zskinD: C('#66784e'), zcloth: C('#4a4038'), zcloth2: C('#3a4450'), zeye: C('#ff5a3c'),
  fog: C('#7f8aa0'), ash: C('#a8a8b4'), ink: C('#030305'),
  red: C('#c0392b'), cone: C('#e0702a'), white: C('#e8ecef'),
  t0: C('#fff3c4'), t1: C('#ffd25a'), t2: C('#f59a2e'), t3: C('#d2621f'), t4: C('#9a3a14'), tDepth: C('#4a1a0c'), tLine: C('#140805'), rust: C('#7a2e12'),
};

// ---------- 낮은 해상도 픽셀 버퍼 ----------
class Px {
  constructor(w, h) { this.w = w; this.h = h; this.img = new ImageData(w, h); this.u = new Uint32Array(this.img.data.buffer); }
  set(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.u[y * this.w + x] = c; }
  get(x, y) { return this.u[y * this.w + x]; }
  mix(x, y, c, a) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; this.u[i] = lerpC(this.u[i], c, a); }
  rect(x, y, w, h, c, a = 1) { for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) if (a >= 1 || dith(i, j, a)) this.set(i, j, c); }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // 스캔라인 다각형 채우기(a < 1이면 디더링 반투명, fn이 있으면 픽셀마다 색을 묻는다)
  poly(pts, c, a = 1, fn = null) {
    let y0 = Infinity, y1 = -Infinity;
    for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y <= Math.min(this.h - 1, Math.floor(y1 - 0.5)); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(this.w, Math.round(xs[k + 1])); x++) {
          if (a < 1 && !dith(x, y, a)) continue;
          this.u[y * this.w + x] = fn ? fn(x, y) : c;
        }
      }
    }
  }
  disc(cx, cy, r, c, a = 1) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && (a >= 1 || dith(x, y, a))) this.set(x, y, c); }
  // 납작한 타원(쿼터뷰 바닥 위의 빛·웅덩이)
  oval(cx, cy, rx, ry, c, a = 1) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (a >= 1 || dith(x, y, a))) this.set(x, y, c); }
  // 비트맵 문자 그리기(sprite: 문자열 줄 목록, map: 글자 → 색)
  sprite(rows, x, y, map, flip = false) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[flip ? row.length - 1 - i : i]; const c = map[ch]; if (c) this.set(x + i, y + j, c); } });
  }
}

// ---------- 5×7 비트맵 글꼴 ----------
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'], J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'], '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'], '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
  ')': ['..#..', '...#.', '....#', '....#', '....#', '...#.', '..#..'], '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
};
const textW = (s, sc, gap) => s.length * 5 * sc + (s.length - 1) * gap;
// 글자: 줄마다 색(fill(줄 0~6, 글자 번호)), 외곽선, 아래쪽 두께(depth)
function text(px, s, x, y, sc, fill, { gap = sc, line = null, depth = 0, depthC = 0 } = {}) {
  const cells = [];
  [...s.toUpperCase()].forEach((ch, k) => {
    const g = FONT[ch] ?? FONT[' '], ox = x + k * (5 * sc + gap);
    g.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') cells.push([ox + i * sc, y + j * sc, j, k]); });
  });
  if (line) for (const [cx, cy] of cells) for (let dy = -1; dy <= sc + depth; dy++) for (let dx = -1; dx <= sc; dx++) px.set(cx + dx, cy + dy, line);
  for (let d = depth; d >= 1; d--) for (const [cx, cy] of cells) px.rect(cx, cy + d, sc, sc, depthC);
  for (const [cx, cy, j, k] of cells) px.rect(cx, cy, sc, sc, fill(j, k));
}

// ---------- 쿼터뷰 ----------
// 타일 16×8칸(2:1). 전진기지 가운데가 (0, 0)이다.
function makeIso(OX, OY) { return (gx, gy, gz = 0) => [OX + (gx - gy) * 8, OY + (gx + gy) * 4 - gz]; }

function isoBox(px, I, gx, gy, gz, sx, sy, sz, top, left, right, edge = null) {
  const a = I(gx, gy + sy, gz), b = I(gx + sx, gy + sy, gz), c = I(gx + sx, gy, gz);
  const a2 = I(gx, gy + sy, gz + sz), b2 = I(gx + sx, gy + sy, gz + sz), c2 = I(gx + sx, gy, gz + sz), d2 = I(gx, gy, gz + sz);
  px.poly([a, b, b2, a2], left);
  px.poly([b, c, c2, b2], right);
  px.poly([d2, c2, b2, a2], top);
  if (edge) { px.line(a2[0], a2[1], b2[0], b2[1], edge); px.line(b2[0], b2[1], c2[0], c2[1], edge); }
}

// ---------- 정적 풍경(크기마다 한 번) ----------
function buildScene(w, h) {
  const px = new Px(w, h), HZ = Math.round(h * 0.34), OX = Math.round(w / 2), OY = Math.round(h * 0.57), I = makeIso(OX, OY);
  // 하늘: 위는 깊은 남색, 지평선 쪽은 불타는 도시의 붉은 빛(디더링 띠)
  const bands = [P.sky0, P.sky1, P.sky2, P.sky3, P.sky4, P.glow];
  for (let y = 0; y < HZ + 6; y++) {
    const t = Math.pow(y / (HZ + 6), 1.6) * (bands.length - 1), i = Math.min(bands.length - 2, Math.floor(t)), f = t - i;
    for (let x = 0; x < w; x++) px.set(x, y, dith(x, y, f) ? bands[i + 1] : bands[i]);
  }
  // 달과 달무리
  const mr = Math.max(5, Math.round(w * 0.034)), mx = Math.round(w * 0.88), my = Math.round(h * 0.075) - mr - 3; // 오른쪽 위, 로고 위
  px.disc(mx, my, mr + 5, P.sky2, 0.35);
  px.disc(mx, my, mr, P.moon);
  px.disc(mx + 2, my - 1, mr * 0.95, P.moonD, 0.25);
  for (const [ox, oy, r] of [[-2, -2, 1.6], [2, 2, 1.2], [-1, 3, 1], [3, -3, 0.8]]) px.disc(mx + ox, my + oy, r, P.moonE);
  // 무너진 도시의 실루엣(먼 줄 · 가까운 줄), 부서진 지붕, 크레인, 드문 불빛
  const skyline = (base, col, edgeC, seed, minH, maxH, lit) => {
    let x = -2;
    while (x < w + 2) {
      const bw = 6 + Math.floor(hash(x, seed) * 14), bh = minH + Math.floor(hash(x, seed + 1) * (maxH - minH));
      const top = base - bh;
      px.rect(x, top, bw, bh + 1, col);
      // 부서진 꼭대기
      for (let i = 0; i < bw; i++) if (hash(x + i, seed + 2) < 0.35) px.rect(x + i, top - 1 - Math.floor(hash(x + i, seed + 3) * 3), 1, 3, col);
      px.line(x, top, x, base, edgeC);
      for (let wy = top + 3; wy < base - 2; wy += 3) for (let wx = x + 2; wx < x + bw - 1; wx += 3) if (hash(wx, wy, seed) < lit) px.set(wx, wy, hash(wx, wy, seed + 9) < 0.5 ? P.cityLit : P.cityLit2);
      x += bw + (hash(x, seed + 4) < 0.3 ? 2 : 0);
    }
  };
  skyline(HZ + 3, P.city1, P.cityE, 11, 10, 26, 0.04);
  skyline(HZ + 5, P.city0, P.city1, 23, 4, 14, 0.02);
  // 크레인
  const cx0 = Math.round(w * 0.18);
  px.line(cx0, HZ - 30, cx0, HZ + 2, P.city1); px.line(cx0 + 1, HZ - 30, cx0 + 1, HZ + 2, P.city1);
  px.line(cx0 - 6, HZ - 30, cx0 + 22, HZ - 30, P.city1); px.line(cx0 + 18, HZ - 30, cx0 + 18, HZ - 22, P.cityE);

  // 땅: 화면 픽셀마다 쿼터뷰 좌표로 되돌려 무늬를 정한다
  const inv = (x, y) => { const a = (x - OX) / 8, b = (y - OY) / 4; return [(a + b) / 2, (b - a) / 2]; };
  for (let y = HZ + 2; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < HZ + 6 && px.get(x, y) !== P.glow && px.get(x, y) !== P.sky4 && px.get(x, y) !== P.sky3) continue; // 도시 실루엣은 남긴다
      const [gx, gy] = inv(x + 0.5, y + 0.5), tx = Math.floor(gx), ty = Math.floor(gy), hv = hash(tx, ty);
      let c;
      const inside = Math.abs(gx) < 4.4 && Math.abs(gy) < 4.4;
      const roadA = gx > -0.6 && gx < 1.6 && gy > 4.3; // 정문에서 앞으로 뻗은 길
      const roadB = gy > 9 && gy < 11.4; // 가로지르는 큰길
      if (roadB || roadA) {
        c = hv < 0.33 ? P.road0 : hv < 0.75 ? P.road1 : P.road2;
        if (roadB && Math.abs(gy - 10.2) < 0.12 && (Math.floor(gx * 1.4) & 1)) c = P.roadLine; // 중앙선
        if (hash(tx * 3 + Math.floor(gx * 4), ty * 3 + Math.floor(gy * 4), 5) < 0.04) c = P.crack;
      } else if (inside) {
        c = hv < 0.4 ? P.dirt0 : hv < 0.8 ? P.dirt1 : P.dirt2;
        if (dith(x, y, 0.15) && hash(x, y, 2) < 0.3) c = P.dirt2;
      } else {
        c = hv < 0.12 ? P.grass0 : hv < 0.84 ? P.grass1 : hv < 0.96 ? P.grass2 : P.dirt0; // 풀빛은 거의 고르게, 흙 자리는 드물게
        if (hash(x, y, 3) < 0.06) c = P.blade;
        if (hash(x, y, 4) < 0.02) c = P.grass3;
      }
      // 타일 이음매
      if (!inside && !roadA && !roadB && (gx - tx < 0.04 || gy - ty < 0.04) && hv > 0.7) c = lerpC(c, P.void, 0.15);
      // 멀수록(지평선 쪽) 어둠에 잠긴다
      const far = Math.max(0, 1 - (y - HZ) / (h * 0.32));
      if (far > 0) c = lerpC(c, P.sky2, far * 0.75);
      px.set(x, y, c);
    }
  }
  // 웅덩이(달빛 반사)
  for (const [gx, gy, r] of [[-6, 7, 6], [5.5, 12.5, 7], [-2.5, 13.5, 5]]) {
    const [x, y] = I(gx, gy); px.oval(x, y, r, r * 0.45, P.road0); px.oval(x - 1, y - 1, r * 0.5, r * 0.2, P.sky2); px.set(x + 1, y, P.starD);
  }

  // 물체들: 깊이(gx+gy) 순서로 그린다
  const items = [];
  const add = (depth, fn) => items.push([depth, fn]);
  // 말뚝 울타리(뒤쪽 두 변 · 앞쪽 두 변, 정문 자리는 비운다)
  const post = (gx, gy) => add(gx + gy, () => {
    const hgt = 12 + Math.floor(hash(gx, gy) * 4);
    isoBox(px, I, gx - 0.3, gy - 0.3, 0, 0.6, 0.6, hgt, P.wood2, P.wood1, P.wood0);
    const [tx, ty] = I(gx, gy, hgt + 2); px.set(tx, ty, P.wood3); px.set(tx, ty + 1, P.wood2);
  });
  for (let i = -4; i <= 4; i++) { post(i, -4); post(-4, i); if (i < -0 || i > 1) post(i, 4); post(4, i); }
  // 울타리 가로대
  for (const [a, b] of [[[-4, -4], [4, -4]], [[-4, -4], [-4, 4]], [[4, -4], [4, 4]], [[-4, 4], [-0.6, 4]], [[1.6, 4], [4, 4]]]) {
    add(a[0] + a[1] + 0.05 + (b[0] + b[1] - a[0] - a[1]) / 2, () => { const p = I(a[0], a[1], 7), q = I(b[0], b[1], 7); px.line(p[0], p[1], q[0], q[1], P.wood3); px.line(p[0], p[1] + 1, q[0], q[1] + 1, P.wood0); });
  }
  // 정문 기둥과 간판
  add(4.6, () => {
    isoBox(px, I, -0.95, 3.7, 0, 0.6, 0.6, 22, P.wood2, P.wood1, P.wood0);
    isoBox(px, I, 1.35, 3.7, 0, 0.6, 0.6, 22, P.wood2, P.wood1, P.wood0);
    const a = I(-0.7, 4, 22), b = I(1.6, 4, 22);
    px.poly([[a[0], a[1] - 4], [b[0], b[1] - 4], [b[0], b[1] + 1], [a[0], a[1] + 1]], P.wood1);
    px.line(a[0], a[1] - 4, b[0], b[1] - 4, P.wood3);
    for (let k = 0; k < 6; k++) px.set(Math.round(a[0] + (b[0] - a[0]) * (0.2 + k * 0.12)), Math.round(a[1] + (b[1] - a[1]) * (0.2 + k * 0.12)) - 2, P.cityLit);
  });
  // 감시탑(뒤 모서리)
  add(-6, () => {
    for (const [ox, oy] of [[0, 0], [1.3, 0], [0, 1.3], [1.3, 1.3]]) isoBox(px, I, -3.6 + ox, -3.6 + oy, 0, 0.22, 0.22, 30, P.wood2, P.wood1, P.wood0);
    for (const z of [9, 19]) { const p = I(-3.5, -2.3, z), q = I(-2.3, -2.3, z + 6); px.line(p[0], p[1], q[0], q[1], P.wood1); const r = I(-2.3, -3.5, z), s2 = I(-2.3, -2.3, z + 6); px.line(r[0], r[1], s2[0], s2[1], P.wood0); }
    isoBox(px, I, -3.75, -3.75, 30, 1.8, 1.8, 3, P.wood3, P.wood1, P.wood0, P.wood3);
    for (const [ox, oy] of [[0, 1.8], [1.8, 0], [1.8, 1.8]]) { const p = I(-3.75 + ox, -3.75 + oy, 33), q = I(-3.75 + ox, -3.75 + oy, 38); px.line(p[0], p[1], q[0], q[1], P.wood1); }
    const r1 = I(-3.75, -1.95, 38), r2 = I(-1.95, -1.95, 38), r3 = I(-1.95, -3.75, 38);
    px.line(r1[0], r1[1], r2[0], r2[1], P.wood2); px.line(r2[0], r2[1], r3[0], r3[1], P.wood2);
    // 지붕(사각뿔)
    const t = I(-2.85, -2.85, 50), e1 = I(-4, -1.7, 40), e2 = I(-1.7, -1.7, 40), e3 = I(-1.7, -4, 40);
    px.poly([t, e1, e2], P.metal1); px.poly([t, e2, e3], P.metal0);
    px.line(t[0], t[1], e2[0], e2[1], P.metal2);
  });
  // 본부 오두막: 판자 벽, 불 켜진 창, 함석 지붕, 굴뚝
  add(-1.6, () => {
    const gx = -2.4, gy = -1.6, sx = 2.4, sy = 2, hz = 16;
    isoBox(px, I, gx, gy, 0, sx, sy, hz, P.wood2, P.wood1, P.wood0);
    // 판자 줄
    for (let z = 3; z < hz; z += 3) { const p = I(gx, gy + sy, z), q = I(gx + sx, gy + sy, z); px.line(p[0], p[1], q[0], q[1], P.wood0); const r = I(gx + sx, gy + sy, z), s2 = I(gx + sx, gy, z); px.line(r[0], r[1], s2[0], s2[1], C('#2a1d13')); }
    // 문과 창
    const d0 = I(gx + 1.4, gy + sy, 0); px.rect(d0[0] - 2, d0[1] - 10, 5, 10, C('#1a120c')); px.set(d0[0] + 1, d0[1] - 5, P.cityLit);
    const w0 = I(gx + 0.5, gy + sy, 9); px.rect(w0[0] - 1, w0[1] - 4, 4, 4, P.win); px.rect(w0[0] - 1, w0[1] - 2, 4, 1, P.winD);
    const w1 = I(gx + sx, gy + 0.9, 9); px.rect(w1[0] - 2, w1[1] - 4, 4, 4, P.winD);
    // 지붕: 처마가 나온 평지붕 + 골
    isoBox(px, I, gx - 0.25, gy - 0.25, hz, sx + 0.5, sy + 0.5, 2, P.metal2, P.metal1, P.metal0);
    for (let k = 0; k <= 5; k++) { const p = I(gx - 0.25 + k * (sx + 0.5) / 5, gy - 0.25, hz + 2), q = I(gx - 0.25 + k * (sx + 0.5) / 5, gy + sy + 0.25, hz + 2); px.line(p[0], p[1], q[0], q[1], P.metal1); }
    isoBox(px, I, gx + 0.3, gy + 0.3, hz + 2, 0.45, 0.45, 9, P.stone2, P.stone1, P.stone0); // 굴뚝
    const ant = I(gx + sx - 0.3, gy + 0.3, hz + 2); px.line(ant[0], ant[1], ant[0], ant[1] - 14, P.metal3); px.line(ant[0] - 2, ant[1] - 11, ant[0] + 2, ant[1] - 11, P.metal3);
  });
  // 천막 둘
  const tent = (gx, gy, c0, c1, c2) => add(gx + gy, () => {
    const L = 1.8, Wd = 1.2, H = 11;
    const f1 = I(gx, gy + Wd, 0), f2 = I(gx, gy, 0), b1 = I(gx + L, gy + Wd, 0), b2 = I(gx + L, gy, 0), rf = I(gx, gy + Wd / 2, H), rb = I(gx + L, gy + Wd / 2, H);
    px.poly([f2, b2, rb, rf], c0); px.poly([f1, b1, rb, rf], c1);
    px.poly([b1, b2, rb], c2); px.poly([I(gx + L, gy + Wd * 0.3, 0), I(gx + L, gy + Wd * 0.7, 0), I(gx + L, gy + Wd / 2, 7)], C('#120e0a'));
    px.line(rf[0], rf[1], rb[0], rb[1], c2);
  });
  tent(0.6, -3.4, P.tent0, P.tent1, P.tent2);
  tent(1.4, -1.4, P.canvas0, P.canvas1, C('#8e7c58'));
  // 모닥불 돌 테두리와 장작
  const FIRE = [0.8, 1.6];
  add(FIRE[0] + FIRE[1], () => {
    const [x, y] = I(FIRE[0], FIRE[1]);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; px.rect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 3), 2, 1, k % 2 ? P.stone2 : P.stone1); }
    px.line(x - 4, y + 1, x + 3, y - 1, P.wood1); px.line(x - 3, y - 1, x + 4, y + 1, P.wood0);
  });
  // 상자·드럼통
  const crate = (gx, gy, z = 0) => add(gx + gy + z * 0.01, () => { isoBox(px, I, gx, gy, z, 0.7, 0.7, 6, P.wood3, P.wood2, P.wood1); const p = I(gx, gy + 0.7, z), q = I(gx + 0.7, gy + 0.7, z + 6); px.line(p[0], p[1] - 0, q[0], q[1], P.wood0); });
  crate(2.6, 2.4); crate(3.2, 2.4); crate(2.9, 2.4, 6); crate(-3.4, 1.2);
  const barrel = (gx, gy, c) => add(gx + gy, () => { const [x, y] = I(gx, gy); px.rect(x - 2, y - 7, 5, 7, c); px.rect(x - 2, y - 5, 5, 1, P.metal0); px.oval(x, y - 7, 2.5, 1.2, lerpC(c, P.white, 0.25)); px.set(x - 2, y - 6, lerpC(c, P.white, 0.3)); });
  barrel(-3, 2.9, C('#4a6a3a')); barrel(-2.5, 3.3, C('#8a2e22')); barrel(3.4, -0.6, C('#3a4a6a'));
  // 정문 앞 모래주머니
  for (let k = 0; k < 7; k++) { const gx = -1.2 + k * 0.5, gy = 5.6 + Math.abs(k - 3) * 0.15; add(gx + gy, () => { isoBox(px, I, gx, gy, 0, 0.55, 0.4, 3, C('#8a7a5a'), C('#6e6046'), C('#564a36')); isoBox(px, I, gx + 0.2, gy, 3, 0.5, 0.4, 3, C('#9a8a6a'), C('#7a6a4e'), C('#5e523c')); }); }
  // 큰길 위의 버려진 차
  add(15, () => {
    const gx = 4.2, gy = 9.8;
    isoBox(px, I, gx, gy, 2, 2.6, 1.2, 5, C('#6a2a24'), C('#4e1e1a'), C('#3a1612'));
    isoBox(px, I, gx + 0.6, gy + 0.1, 7, 1.3, 1, 4, C('#3a4250'), C('#2a3038'), C('#20252c'));
    for (const [ox, oy] of [[0.4, 1.2], [2.2, 1.2]]) { const [x, y] = I(gx + ox, gy + oy, 1); px.disc(x, y, 1.6, P.ink); }
    const hl = I(gx + 2.6, gy + 0.3, 4); px.set(hl[0], hl[1], P.metal3);
  });
  // 원뿔 표지
  for (const [gx, gy] of [[2.4, 8.8], [3, 8.6], [-1.6, 11.8]]) add(gx + gy, () => { const [x, y] = I(gx, gy); px.poly([[x - 2, y], [x + 2, y], [x, y - 6]], P.cone); px.line(x - 1, y - 3, x + 1, y - 3, P.white); });
  // 고목
  const tree = (gx, gy, s) => add(gx + gy, () => {
    const [x, y] = I(gx, gy), H = Math.round(26 * s);
    px.rect(x - 1, y - H, 2, H, P.wood0); px.set(x + 1, y - H, P.wood1);
    for (let k = 0; k < 5; k++) {
      const by = y - H + 3 + k * Math.round(4 * s), dir = k % 2 ? 1 : -1, len = Math.round((8 - k) * s);
      px.line(x, by, x + dir * len, by - Math.round(len * 0.6), P.wood0);
      px.line(x + dir * Math.round(len * 0.6), by - Math.round(len * 0.36), x + dir * Math.round(len * 0.8), by - Math.round(len), P.wood0);
    }
  });
  tree(-6.4, 6, 1); tree(7, 2.6, 0.9); tree(-4.2, 12.5, 1.15); tree(9, 7, 1);
  // 부서진 가로등
  add(8.6, () => { const [x, y] = I(2.2, 6.4); px.line(x, y, x, y - 24, P.metal1); px.line(x, y - 24, x + 5, y - 20, P.metal1); px.rect(x + 4, y - 20, 3, 2, P.metal2); });
  // 화면 가장자리의 무너진 건물
  const ruin = (gx, gy, sx, sy, hz) => add(gx + gy + sx + sy, () => {
    isoBox(px, I, gx, gy, 0, sx, sy, hz, C('#3a3a42'), C('#2c2c34'), C('#222228'));
    for (let z = 6; z < hz - 4; z += 7) for (let k = 0.4; k < sx - 0.3; k += 0.9) { const p = I(gx + k, gy + sy, z); px.rect(p[0], p[1] - 3, 2, 3, hash(k, z, gx) < 0.15 ? P.winD : C('#141418')); }
    // 부서진 윗부분
    const p = I(gx, gy + sy, hz), q = I(gx + sx, gy + sy, hz);
    for (let i = 0; i <= 8; i++) { const x = Math.round(p[0] + (q[0] - p[0]) * i / 8), y = Math.round(p[1] + (q[1] - p[1]) * i / 8); px.rect(x, y - Math.floor(hash(i, gx) * 6), 2, Math.floor(hash(i, gx) * 6) + 1, C('#2c2c34')); }
  });
  ruin(-11, 1, 3, 2.5, 40); ruin(8.5, -6, 2.5, 3, 34);
  add(20.4, () => { const [x, y] = I(8.6, 11.8); px.rect(x - 3, y - 8, 7, 8, C('#4a3020')); px.rect(x - 3, y - 6, 7, 1, C('#2a1a10')); px.rect(x - 3, y - 3, 7, 1, C('#2a1a10')); px.oval(x, y - 8, 3.5, 1.4, C('#1a0e08')); }); // 불 피운 드럼통
  // 앞쪽 들판: 뒤집힌 승합차, 타이어 더미, 쓰러진 표지판, 버려진 짐
  add(26, () => {
    const gx = 11.5, gy = 13.5;
    isoBox(px, I, gx, gy, 0, 2.8, 1.4, 6, C('#5a6066'), C('#41464c'), C('#2e3236'));
    isoBox(px, I, gx + 0.2, gy + 0.1, 6, 2.2, 1.2, 4, C('#6a7076'), C('#4a5056'), C('#363a3e'));
    for (const ox of [0.5, 2.2]) { const [x, y] = I(gx + ox, gy - 0.05, 9); px.disc(x, y, 1.8, P.ink); px.set(x, y, P.metal2); }
    const [x, y] = I(gx + 1, gy + 1.4, 3); px.rect(x - 1, y - 2, 4, 2, C('#1a1c20'));
  });
  for (const [gx, gy] of [[-2.5, 16.5], [-2, 16.9], [-2.3, 16.7]]) add(gx + gy, () => { const [x, y] = I(gx, gy); px.oval(x, y - 1, 3, 1.4, P.ink); px.oval(x, y - 2, 2.2, 1, C('#2a2a2e')); });
  add(21, () => { const [x, y] = I(6.5, 14.5); px.line(x, y, x + 9, y - 3, P.metal1); px.rect(x + 7, y - 9, 8, 5, C('#c8a63a')); px.rect(x + 8, y - 8, 6, 3, C('#1a1a1a')); px.set(x + 10, y - 7, C('#c8a63a')); });
  for (const [gx, gy, c] of [[3.5, 16, C('#4a3a5a')], [13.5, 18, C('#5a4a2a')]]) add(gx + gy, () => { const [x, y] = I(gx, gy); px.rect(x - 2, y - 3, 5, 3, c); px.set(x, y - 4, lerpC(c, P.white, 0.3)); });
  // 돌무더기
  for (const [gx, gy] of [[-7.5, 9], [6.2, 5.2], [-3, 8], [8, 12]]) add(gx + gy, () => { const [x, y] = I(gx, gy); for (let k = 0; k < 9; k++) px.rect(x - 4 + Math.floor(hash(k, gx) * 8), y - Math.floor(hash(k, gy) * 3), 2, 2, k % 3 ? P.stone1 : P.stone2); });

  items.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());

  // 화면 가장자리 어둡게(비네트): 어둡게 칠할 칸을 한 번만 골라 둔다
  const vig = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.max(Math.abs(x / w - 0.5) * 2, Math.abs(y / h - 0.5) * 2); if (v > 0.82 && dith(x, y, (v - 0.82) * 2.6)) vig.push(y * w + x); }
  // 안쪽 사람 자리·불·탑 등 움직이는 것이 쓸 좌표
  return {
    px, HZ, I, w, h, vig: Uint32Array.from(vig),
    barrel: I(8.6, 11.8),
    fire: I(FIRE[0], FIRE[1]),
    lamp: I(-2.85, -1.95, 34),
    chimney: I(-2.0, -1.2, 29),
    flag: I(-0.3, -1.3, 32),
    stars: Array.from({ length: Math.round(w * 0.35) }, (_, k) => [Math.floor(hash(k, 1) * w), Math.floor(hash(k, 2) * HZ * 0.8), hash(k, 3)]),
    smokes: [0.12, 0.42, 0.66, 0.9].map((f, k) => [Math.round(w * f), HZ - 10 - Math.floor(hash(k, 8) * 12)]),
  };
}

// ---------- 작은 사람·좀비 그림(픽셀) ----------
const SURV = [
  ['..hh..', '.hhhh.', '.ssss.', '.s.s..', '..ss..', 'jjjjjj', 'jjJjjj', 'jjJjjj', '.jjjj.', '.pp.p.', '.p..p.', '.k..k.'],
  ['..hh..', '.hhhh.', '.ssss.', '.s.s..', '..ss..', 'jjjjjj', 'jjJjjj', 'jjJjjj', '.jjjj.', '.p.pp.', '.p..p.', '.k..k.'],
];
const ZOMB = [
  ['..gg..', '.zzzz.', '.zeze.', '.zzzz.', 'zcccz.', '.ccccz', '.cccc.', '.cccc.', '.p..p.', '.p..p.', 'p...p.', 'k...k.'],
  ['..gg..', '.zzzz.', '.zeze.', '.zzzz.', '.cccz.', 'zcccc.', '.cccz.', '.cccc.', '.p.p..', '.p.p..', '.p..p.', '.k..k.'],
];
const MAP_S = { h: P.hair, s: P.skin, j: P.jacket, J: P.jacketD, p: P.pants, k: P.ink };
const mapZ = (shirt) => ({ g: C('#2e2a22'), z: P.zskin, e: P.zeye, c: shirt, p: C('#2e3328'), k: P.ink });

// ---------- 화면 ----------
export function runTitle(canvas, { onLayout, onPhase } = {}) {
  const ctx = canvas.getContext('2d');
  let low = null, lowCtx = null, scene = null, frame = null, cell = 4, dpr = 1, raf = 0, t0 = performance.now(), phase = 'splash', skipAt = null;
  const SPLASH = 2.3, REVEAL = 0.55;
  const ash = Array.from({ length: 60 }, (_, k) => [hash(k, 11), hash(k, 12), 0.3 + hash(k, 13) * 0.7]);
  const zombies = [
    // [시작 gx, gy, 끝 gx, gy, 걸리는 초, 시작 시차, 옷] — 화면 아래 안개 속에서 정문 앞 모래주머니 쪽으로
    [12, 16, 1.2, 6.8, 30, 0, P.zcloth], [8, 19, 0.2, 6.7, 34, 9, P.zcloth2], [15, 13, 2.2, 6.9, 28, 17, C('#5a3a3a')],
    [16, 9.8, 3.6, 9.6, 36, 4, C('#4a4a3a')], [18, 18, 0.8, 7.2, 40, 21, P.zcloth], [6, 21, -0.6, 7, 38, 13, P.zcloth2],
    [20, 14, 2.8, 7.4, 44, 30, C('#3a3a4a')], [10, 23, 0.6, 7.6, 46, 6, C('#5a4a3a')],
  ];

  function resize() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || window.innerWidth || 360, ch = canvas.clientHeight || window.innerHeight || 640; // 숨은 탭처럼 크기가 0이면 임시 크기(보이면 resize로 다시 그린다)
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    cell = Math.max(2, Math.round(canvas.width / 200)); // 가로 약 200칸
    const w = Math.ceil(canvas.width / cell), h = Math.ceil(canvas.height / cell);
    low = document.createElement('canvas'); low.width = w; low.height = h; lowCtx = low.getContext('2d');
    scene = buildScene(w, h);
    frame = new Px(w, h);
    onLayout?.({ cssPerCell: cell / dpr, w, h, logoBottom: logoMetrics(w, h).lineY });
  }

  function drawTitle(px, t) {
    const S = scene, { w, h, HZ, I } = S;
    px.u.set(S.px.u);
    // 별 반짝임
    for (const [x, y, k] of S.stars) { const b = Math.sin(t * (1 + k * 3) + k * 40); if (b > 0.3) px.set(x, y, b > 0.85 ? P.star : P.starD); }
    // 도시 연기 기둥(오르며 퍼진다)
    for (const [sx, sy] of S.smokes) for (let k = 0; k < 7; k++) {
      const life = ((t * 0.08 + k / 7 + sx * 0.013) % 1), r = 2 + life * 9;
      px.disc(sx + Math.sin(life * 4 + sx) * 3 + life * 10, sy - life * 40, r, life < 0.5 ? P.smoke2 : P.smoke, 0.45 * (1 - life));
    }
    // 지평선 불빛 일렁임
    for (let x = 0; x < w; x++) if (hash(x, Math.floor(t * 6)) < 0.04) px.set(x, HZ + 1 + Math.floor(hash(x, 7) * 2), P.fire0);
    // 굴뚝 연기
    for (let k = 0; k < 5; k++) { const life = (t * 0.25 + k / 5) % 1; px.disc(S.chimney[0] + life * 6 + Math.sin(life * 6 + t) * 1.5, S.chimney[1] - life * 22, 1.2 + life * 3, P.smoke2, 0.6 * (1 - life)); }
    // 깃발(두 장면을 번갈아)
    const [fx, fy] = S.flag; const wave = Math.floor(t * 4) % 2;
    px.line(fx, fy, fx, fy - 12, P.metal3);
    px.sprite(wave ? ['rrrr.', 'rrrrr', 'rrrr.', '.rr..'] : ['rrr..', 'rrrrr', '.rrrr', '..rr.'], fx + 1, fy - 12, { r: P.red });
    // 모닥불: 땅을 데우는 빛(3단계로 끊어 픽셀 느낌) + 불꽃 + 불티
    const [cx, cy] = S.fire, flick = 0.85 + Math.sin(t * 13) * 0.08 + hash(Math.floor(t * 9)) * 0.1;
    for (let y = cy - 18; y <= cy + 12; y++) for (let x = cx - 30; x <= cx + 30; x++) {
      const d = Math.hypot((x - cx) / 30, (y - cy) / 15) / flick;
      if (d < 1) { const a = d < 0.35 ? 0.42 : d < 0.65 ? 0.26 : 0.12; if (y >= 0 && y < h && x >= 0 && x < w) px.mix(x, y, P.fire1, a); }
    }
    for (let k = 0; k < 14; k++) {
      const fx2 = cx - 3 + (k % 7), hgt = 3 + Math.floor(hash(k, Math.floor(t * 12)) * 6) - Math.abs(k % 7 - 3);
      for (let j = 0; j < hgt; j++) px.set(fx2, cy - 1 - j, j < hgt * 0.4 ? P.fire1 : j < hgt * 0.75 ? P.fire2 : P.fire3);
    }
    for (let k = 0; k < 8; k++) { const life = (t * 0.6 + k / 8) % 1; px.set(cx + Math.sin(k * 3 + t * 2) * 4 * life, cy - 6 - life * 26, life < 0.6 ? P.fire2 : P.fire0); }
    // 길가 드럼통 불(작은 빛)
    { const [bx, by] = S.barrel, fl = 0.85 + hash(Math.floor(t * 8), 3) * 0.2;
      for (let y = by - 22; y <= by + 8; y++) for (let x = bx - 18; x <= bx + 18; x++) { const d = Math.hypot((x - bx) / 18, (y - by + 4) / 11) / fl; if (d < 1 && x >= 0 && x < w && y >= 0 && y < h) px.mix(x, y, P.fire1, d < 0.45 ? 0.3 : 0.14); }
      for (let k = 0; k < 6; k++) { const hgt = 2 + Math.floor(hash(k, Math.floor(t * 11)) * 4); for (let j = 0; j < hgt; j++) px.set(bx - 2 + k, by - 9 - j, j < hgt * 0.5 ? P.fire1 : P.fire2); } }
    // 사람들: 모닥불가의 둘, 정문 보초, 망루 위
    const idle = Math.floor(t * 2) % 2;
    px.sprite(SURV[0], cx - 13, cy - 11 + (idle ? 0 : 0), MAP_S);
    px.sprite(SURV[1], cx + 8, cy - 12, MAP_S, true);
    const [gx0, gy0] = I(1.9, 4.6); px.sprite(SURV[idle], gx0 - 3, gy0 - 12, MAP_S); px.line(gx0 + 3, gy0 - 6, gx0 + 6, gy0 - 9, P.gun);
    const [lx, ly] = S.lamp; px.sprite(['.hh.', 'hssh', 'jjjj', 'jjjj'], lx - 7, ly - 6, MAP_S);
    // 탐조등: 망루에서 들판을 훑는다(디더링 빛줄기 + 땅에 닿은 둥근 빛)
    const ang = Math.sin(t * 0.45) * 0.75 + 1.85, reach = h * 0.42;
    const tx = lx + Math.cos(ang) * reach, ty = ly + Math.sin(ang) * reach * 0.9, sp = 16;
    px.poly([[lx, ly], [tx - sp, ty], [tx + sp, ty + 4]], P.light, 0.22);
    px.oval(tx, ty + 2, sp + 2, 7, P.light, 0.4);
    px.oval(tx, ty + 2, sp * 0.55, 4, P.light, 0.62);
    px.rect(lx - 1, ly - 1, 3, 2, P.white);
    // 좀비 무리: 길을 따라 정문 쪽으로 걸어오고, 끝에 닿으면 처음 자리로
    const walkers = zombies.map(([ax, ay, bx, by, dur, off, shirt], k) => {
      const f = ((t + off) % dur) / dur, gx = ax + (bx - ax) * f, gy = ay + (by - ay) * f;
      return { gx, gy, shirt, flip: (bx - by) - (ax - ay) < 0, step: Math.floor(t * 3 + k) % 2 }; // 화면 왼쪽으로 걸으면 뒤집는다
    }).sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const z of walkers) {
      const [x, y] = I(z.gx, z.gy);
      if (y < HZ) continue;
      const inBeam = Math.hypot((x - tx) / (sp + 2), (y - ty) / 8) < 1;
      px.oval(x, y, 3, 1.2, P.ink, 0.6);
      px.sprite(ZOMB[z.step], x - 3, y - 12, inBeam ? { ...mapZ(z.shirt), z: lerpC(P.zskin, P.light, 0.35) } : mapZ(z.shirt), z.flip);
    }
    // 앞쪽 안개(흘러간다)와 떨어지는 재
    const drift = Math.floor(t * 6);
    for (let y = Math.round(h * 0.7); y < h; y++) {
      const base = (y - h * 0.7) / (h * 0.3) * 0.42 + Math.sin(y * 0.18 + t * 0.6) * 0.08;
      for (let x = 0; x < w; x += 1) {
        const a = base + Math.sin((x + t * 9) * 0.06 + y * 0.03) * 0.1;
        if (a > 0.04 && dith(x + drift, y, a)) px.mix(x, y, P.fog, 0.35);
      }
    }
    for (const [ax, ay, sp2] of ash) { const x = ((ax * w + t * 6 * sp2) % w + w) % w, y = ((ay * h + t * 14 * sp2) % h); px.set(x, y, sp2 > 0.75 ? P.ash : P.smoke2); }
    for (const i of S.vig) px.u[i] = P.void; // 비네트
    drawLogo(px, t);
    // 시작 안내(깜빡임)와 저작권
    if (Math.floor(t * 1.6) % 2 === 0) { const s = 'TAP TO START', tw = textW(s, 1, 1); text(px, s, Math.round((w - tw) / 2), Math.round(h * 0.72), 1, () => P.t0, { gap: 1, line: P.tLine }); }
    const c = '(C) 2026 DANNY SOFT', cw2 = textW(c, 1, 1); text(px, c, Math.round((w - cw2) / 2), h - 11, 1, () => P.metal3, { gap: 1, line: P.void });
  }

  function logoMetrics(w, h) {
    const s1 = 'ZOMBIE', sc1 = Math.max(2, Math.floor((w - 24) / (8 * 6))), w1 = textW(s1, sc1, sc1);
    const s2 = 'OUTPOST', sc2 = Math.max(3, Math.floor((w - 16) / (7 * 6))), w2 = textW(s2, sc2, sc2);
    const y1 = Math.round(h * 0.075), y2 = y1 + 7 * sc1 + sc1 + 4;
    return { s1, sc1, w1, s2, sc2, w2, y1, y2, lineY: y2 + 7 * sc2 + 6 };
  }
  function drawLogo(px, t) {
    const { w, h } = scene;
    const grad = [P.t0, P.t1, P.t1, P.t2, P.t2, P.t3, P.t4];
    const ember = (j, k) => (hash(k, Math.floor(t * 3)) < 0.08 && j < 3 ? P.t0 : grad[j]);
    const { s1, sc1, w1, s2, sc2, w2, y1, y2 } = logoMetrics(w, h);
    text(px, s1, Math.round((w - w1) / 2), y1, sc1, (j) => grad[Math.min(6, j)], { line: P.tLine, depth: 2, depthC: P.tDepth });
    text(px, s2, Math.round((w - w2) / 2), y2, sc2, ember, { line: P.tLine, depth: 3, depthC: P.tDepth });
    // 녹슨 얼룩
    for (let k = 0; k < 18; k++) { const x = Math.round((w - w2) / 2 + hash(k, 5) * w2), y = y2 + Math.floor(hash(k, 6) * 7 * sc2); if (px.get(x, y) !== P.tLine && px.get(x, y) !== P.tDepth) px.set(x, y, P.rust); }
    // 위아래 가는 선
    const lineY = y2 + 7 * sc2 + 6;
    for (let x = Math.round((w - w2) / 2); x < Math.round((w + w2) / 2); x++) if (dith(x, lineY, 0.7)) px.set(x, lineY, P.t3);
    return lineY;
  }

  function drawSplash(px, t) {
    const { w, h } = scene;
    px.u.fill(P.void);
    const cx = Math.round(w / 2), cy = Math.round(h * 0.44);
    // 불꽃 엠블럼
    const em = ['....#....', '...###...', '..##.##..', '..#####..', '.###o###.', '.##ooo##.', '##ooooo##', '.#######.', '..#####..'];
    const sc = 3, ox = cx - Math.round((9 * sc) / 2), oy = cy - 40;
    em.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') px.rect(ox + i * sc, oy + j * sc, sc, sc, row[i] === 'o' ? P.t0 : j < 3 ? P.t2 : P.t3); });
    const s = 'DANNY SOFT', s2 = Math.max(2, Math.min(3, Math.floor((w - 20) / (10 * 6)))), tw = textW(s, s2, s2);
    text(px, s, Math.round((w - tw) / 2), cy, s2, (j) => (j < 3 ? P.white : P.metal3), { line: P.ink, depth: 1, depthC: P.metal1 });
    const p = 'PRESENTS', pw = textW(p, 1, 2);
    text(px, p, Math.round((w - pw) / 2), cy + 7 * s2 + 10, 1, () => P.t2, { gap: 2 });
    // 디더링으로 나타났다 사라진다
    const a = Math.min(1, t / 0.55, (SPLASH - t) / 0.45);
    if (a < 1) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!dith(x, y, Math.max(0, a))) px.u[y * w + x] = P.void;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!scene || canvas.clientWidth === 0) return;
    let t = (now - t0) / 1000;
    if (skipAt != null && t < SPLASH) { t0 -= (SPLASH - t) * 1000; t = SPLASH; skipAt = null; }
    if (phase === 'splash' && t >= SPLASH) { phase = 'title'; onPhase?.('title'); }
    if (phase === 'splash') drawSplash(frame, t);
    else {
      const tt = t - SPLASH;
      drawTitle(frame, tt + 3);
      if (tt < REVEAL) { const a = tt / REVEAL; for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) if (!dith(x, y, a)) frame.u[y * scene.w + x] = P.void; }
    }
    lowCtx.putImageData(frame.img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, scene.w * cell, scene.h * cell);
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();
  raf = requestAnimationFrame(loop);
  return {
    get phase() { return phase; },
    skip() { if (phase === 'splash') skipAt = true; },
    stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); },
  };
}
