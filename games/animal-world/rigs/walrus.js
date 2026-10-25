// 바다코끼리 리그. 모양은 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX. 원점 = 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.
// 거대한 주름진 분홍빛 갈색 몸(어깨가 솟고 엉덩이로 갈수록 가늘다), 작은 머리에 뻣뻣한 수염이 빽빽한 주둥이(수염판), 길고 흰 엄니, 작은 눈.
// 앞지느러미 둘(팔꿈치 + 넓은 노 모양 발)과, 앞으로 돌려 엉덩이 밑에 받친 뒷지느러미 둘.
// 걸음 = 무겁게 몸을 끄는 걸음: 지느러미가 번갈아 딛고(가까운 뒤 → 가까운 앞 → 먼 뒤 → 먼 앞), 가슴이 들렸다 놓일 때마다 뱃살이 출렁인다(스프링).
// 쉬기 = 숨쉬기·수염 씰룩·깜빡임, 가끔 앞지느러미로 가슴 긁기. 먹기·물 = 고개를 숙여 주둥이로 땅을 파헤친다(엄니 끝은 모래 속).
// 눕기(rest) = 옆으로 벌러덩 누워 배를 조금 드러내고, 머리를 뒤로 젖혀 땅에 대고, 위쪽 앞지느러미를 느긋하게 흔들며 눈을 감는다.
// 특수(엄니 들고 크게 울기) = 고개를 높이 들어 엄니를 앞으로 보이고, 목주머니를 부풀리며 세 번 크게 운다(소리 물결).
// 화면 쪽은 바다코끼리를 눕기 동물(LIES)로 보지 않으므로 p.ly 대신 p.st === 'rest'로 눕는다.

export const STRIDE = 9; // 한 걸음 주기 동안 나아가는 거리
export const BOX = [22, 26];
const DUTY = 0.7;
const OFFS = { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 };
const TAU = Math.PI * 2;
const HS = 0.92; // 머리 배율

const WR = {
  col: '#c48b73', far: '#a6705c', fold: '#ad7460', light: '#dcab94', belly: '#e4b9a5', wart: '#d29d86',
  flip: '#9a6656', flipFar: '#7e5244', toe: '#5e3a2f', pad: '#d9ac94', dot: '#8d5845', bristle: '#f4ecdf',
  tusk: '#f7f1e3', tuskFar: '#dcd1bd', tuskLine: '#cdbfa6', rim: '#8a4a3c', mouth: '#6a272c', tongue: '#c4646a', nostril: '#5b342a', sand: '#c4a074',
};
const cl01 = (v) => Math.max(0, Math.min(1, v));
const sm = (v) => { const x = cl01(v); return x * x * (3 - 2 * x); };
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? sm((s - a) / (b - a)) : s <= c ? 1 : 1 - sm((s - c) / (d - c)));
const L = (a, b, w) => a + (b - a) * w;
const L2 = (a, b, w) => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];

let HEAD = null, JAW = null, PAD = null;
function build() {
  const h = new Path2D(); // 머리: 둥근 정수리 → 이마 → 크고 뭉툭한 수염판 → 윗입술 → 뺨
  h.moveTo(-4.6, -1.4);
  h.bezierCurveTo(-4.4, -5.6, 1.4, -6.6, 4.2, -4.8);
  h.quadraticCurveTo(5.6, -3.8, 7.2, -3.3);
  h.bezierCurveTo(9.4, -2.8, 10.1, 1.6, 8.8, 3.6);
  h.quadraticCurveTo(6.6, 5.4, 3.6, 4.6);
  h.quadraticCurveTo(0, 4.6, -2.8, 3.4);
  h.quadraticCurveTo(-5, 1.8, -4.6, -1.4);
  h.closePath();
  HEAD = h;
  const j = new Path2D(); // 아래턱(엄니 뒤 작은 턱)
  j.moveTo(0.4, 3.8); j.quadraticCurveTo(3.4, 4.7, 5.3, 4.3); j.quadraticCurveTo(5.3, 5.7, 3.0, 6.0); j.quadraticCurveTo(0.8, 5.9, -0.5, 4.6); j.closePath();
  JAW = j;
  const p = new Path2D(); // 노 모양 지느러미(원점 = 손목·발목, +x로 뻗고, 끝에 발가락 다섯이 물결진다)
  p.moveTo(-0.6, -1.3);
  p.bezierCurveTo(2, -1.9, 4.8, -1.7, 6.4, -1.0);
  p.quadraticCurveTo(7.3, -0.75, 6.9, -0.25);
  p.quadraticCurveTo(7.5, 0.15, 7.0, 0.55);
  p.quadraticCurveTo(7.4, 1.0, 6.5, 1.25);
  p.bezierCurveTo(4.4, 1.6, 1.8, 1.6, -0.6, 1.3);
  p.closePath();
  PAD = p;
}
// 굵기가 줄어드는 마디 + 둥근 관절을 한 번에 채운다(감는 방향을 맞춰 겹쳐도 구멍이 없다)
function bones(g, pts, ws) {
  g.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath();
  }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], w = ws[i] / 2; g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU, true); }
  g.fill();
}

export function draw(g, p, H) {
  if (!HEAD) build();
  const { ik, footAt, springTo, rigTick, ell, eye, C, hash } = H, real = H.real();
  const r = p.rig ?? {}, dt = p.dt ?? 0;
  rigTick(r, dt);
  if (!r.jg) r.jg = { x: 0, v: 0 };
  const follow = (key, target, rate) => { r[key] = dt > 0 && r[key] !== undefined ? r[key] + (target - r[key]) * Math.min(1, dt * rate) : target; };
  const t = p.ph ?? 0, sp = p.sp ?? -1, special = sp >= 0, moving = p.mv > 0 && !special, ph = p.gait ?? 0, mv = moving ? 1 : 0;
  follow('rz', p.st === 'rest' && !moving ? 1 : 0, 2.5);
  if (p.st === 'eat' || p.st === 'drink') r.hk = p.st;
  const hd = special ? 0 : cl01(p.hd ?? 0), ek = r.hk === 'drink' ? 0 : hd;
  const lr = special ? 0 : sm(r.rz) * (1 - hd); // 눕기
  const s = special ? sm(sp / 0.12) * sm((1 - sp) / 0.1) : 0; // 울기 자세
  const bell = s * Math.pow(Math.abs(Math.sin(((sp - 0.05) * Math.PI) / 0.3)), 0.7); // 세 번 우는 박자(0.2·0.5·0.8에서 가장 크게)
  const sc = ((t + 3.1) / 9.5) % 1, scr = (1 - mv) * (1 - lr) * (1 - hd) * (1 - s) * env(sc, 0.55, 0.62, 0.8, 0.87); // 가끔 가슴 긁기

  // ---- 몸 움직임: 가슴이 들렸다 놓이고 엉덩이가 늦게 따라오며, 뱃살은 스프링으로 출렁 ----
  const q2 = ph * TAU * 2, breath = Math.sin((t * TAU) / 4.4);
  const lift = mv * (0.5 + 0.5 * Math.sin(q2 - 0.6)) * 2.0, hlift = mv * (0.5 + 0.5 * Math.sin(q2 - 2.5)) * 1.1, surge = mv * 0.7 * Math.sin(q2 + 0.9);
  if (dt > 0) springTo(r.jg, lift, 70, 5, dt); else { r.jg.x = lift; r.jg.v = 0; }
  const jig = (r.jg.x - lift) * 1.6 + mv * 0.75 * Math.sin(q2 - 2.2);
  const S = [L(5, 4, lr) + surge, L(-11, -8.4, lr) - lift - 1.2 * s], Hp = [L(-13.5, -13.8, lr) + surge * 0.3, L(-7, -5.4, lr) - hlift];
  const topS = L(9.4, 5.4, lr) + 0.35 * breath * (1 - lr) + 0.9 * s - 1.2 * hd, rumpT = L(6.6, 5.8, lr), chestD = L(11, 8.4, lr);
  const pouch = s * (0.8 + 1.8 * bell) + 0.25 * breath * (1 - lr);

  // ---- 머리 자세: 서기 → 먹기(주둥이를 땅에) → 눕기(뒤로 젖혀 땅에) → 울기(높이 들어 엄니를 앞으로) ----
  const dig = Math.sin(t * 6.5);
  let hp = [S[0] + 7.4, S[1] - 7.6 + 0.4 * jig], ha = 0.15 + (1 - mv) * 0.03 * Math.sin(t * 0.45) + mv * 0.08 * Math.sin(q2 - 1.4) + 0.12 * scr;
  if (hd > 0) { hp = L2(hp, [S[0] + 10.6 + 0.5 * dig * ek, -9.0 - 0.3 * Math.max(0, dig) * ek], hd); ha = L(ha, 1.0 + 0.06 * dig * ek, hd); }
  if (lr > 0) { hp = L2(hp, [S[0] + 7.4, -5.9], lr); ha = L(ha, -0.85, lr); }
  if (s > 0) { hp = L2(hp, [S[0] + 4.5, S[1] - 12.5], s); ha = L(ha, -0.75 - 0.08 * bell, s); }
  const ca = Math.cos(ha) * HS, sa = Math.sin(ha) * HS;
  const toH = (x, y) => [hp[0] + x * ca - y * sa, hp[1] + x * sa + y * ca];
  const inHead = (fn) => { g.save(); g.translate(hp[0], hp[1]); g.rotate(ha); g.scale(HS, HS); fn(); g.restore(); };
  const tl = L(1, 0.68, lr); // 엄니 길이(누우면 이쪽을 향해 짧아 보인다)

  // ---- 지느러미 ----
  const stroke = STRIDE * DUTY;
  const foot = (key) => (moving ? footAt((ph + OFFS[key]) % 1, stroke, 1.5, DUTY) : { x: 0, y: 0, sw: 0 });
  const front = (key, far) => {
    const f = foot(key), root = [S[0] + (far ? 1.2 : 0), S[1] + 0.5];
    let w = [S[0] + 2.1 + (far ? 1.6 : 0) + f.x, -1.45 + f.y], pa = -0.5 * f.sw - (far ? 0.08 : 0);
    if (lr > 0) { w = L2(w, far ? [S[0] + 5.5, -1.45] : [S[0] + 3.2, S[1] - 7 + Math.sin(t * 1.5) * 0.8], lr); pa = L(pa, far ? 0.15 : -1.5 + 0.35 * Math.sin(t * 1.5 - 0.6), lr); }
    if (!far && scr > 0) { const k = Math.sin(t * 15); w = L2(w, [S[0] + 6.6 + 0.4 * k, S[1] + 1 + 1.2 * k], scr); pa = L(pa, -2.0 + 0.3 * k, scr); }
    const { knee } = ik(root[0], root[1], w[0], w[1], 5.8, 5.4, -1);
    return { pts: [root, knee, w], pa };
  };
  const rear = (key, far) => {
    const f = foot(key);
    let a = [Hp[0] - 3.2 + (far ? 1.4 : 0) + f.x * 0.8, -1.35 + f.y * 0.7], pa = -0.3 * f.sw;
    if (lr > 0) { a = L2(a, [Hp[0] - 4.2 + (far ? 0.8 : 0), Hp[1] + 3 + (far ? 0.6 : 0)], lr); pa = L(pa, far ? -2.85 : -2.5 + 0.15 * Math.sin(t * 1.2), lr); }
    return { pts: [[Hp[0] - 1 + (far ? 1 : 0), Hp[1] + 2], a], pa };
  };
  const paddle = (x, y, ang, col, k) => {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(k, k);
    g.fillStyle = C(col); g.fill(PAD);
    if (real) {
      g.strokeStyle = WR.toe; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath();
      for (const v of [-0.55, 0.15, 0.85]) { g.moveTo(1.6, v * 0.8); g.quadraticCurveTo(4.2, v, 6.2, v * 1.15); }
      g.stroke();
      for (const v of [-0.7, -0.05, 0.6]) ell(g, 6.9, v, 0.35, 0.25, 0, WR.toe); // 작은 발톱
    }
    g.restore();
  };
  const fn = front('nf', false), ff = front('ff', true), rn = rear('nh', false), rf = rear('fh', true);

  if (p.shadow !== false) ell(g, -1.5, 0, 22, 3.8, 0, 'rgba(40,25,10,0.24)');
  // 먼 쪽 지느러미
  g.fillStyle = C(WR.far); bones(g, rf.pts, [3.2, 2.4]); paddle(rf.pts[1][0], rf.pts[1][1], rf.pa, WR.flipFar, 0.95);
  g.fillStyle = C(WR.far); bones(g, ff.pts, [4, 3.2, 2.6]); paddle(ff.pts[2][0], ff.pts[2][1], ff.pa, WR.flipFar, 1);

  // ---- 몸통: 둥근 엉덩이 → 등 → 솟은 어깨 → 굵은 목 → (머리 밑) → 목주머니·가슴 → 땅에 닿는 배 ----
  const nk = toH(-3.5, -3.8), th = toH(-1, 4.2), rx = Hp[0] - 8.0, ry = Hp[1] + L(3.4, 3.2, lr);
  const body = new Path2D();
  body.moveTo(rx, ry);
  body.bezierCurveTo(rx - 0.9, ry - 3.4, Hp[0] - 4.5, Hp[1] - rumpT + 0.6 - jig * 0.3, Hp[0] + 1, Hp[1] - rumpT - 0.6 - jig * 0.5);
  body.bezierCurveTo(Hp[0] + 7, Hp[1] - rumpT - 3.6 - jig, S[0] - 7, S[1] - topS - 0.2 - jig, S[0] - 1, S[1] - topS - jig * 0.6);
  body.bezierCurveTo(S[0] + 3.5, S[1] - topS, nk[0] - 3, nk[1] - 1, nk[0], nk[1]);
  body.lineTo(th[0], th[1]);
  body.bezierCurveTo(th[0] + 1.5 + pouch, th[1] + 3.5, S[0] + 9 + pouch, S[1] + 2, S[0] + 7.6 + pouch * 0.5, S[1] + chestD - 4);
  body.quadraticCurveTo(S[0] + 6, S[1] + chestD - 0.4, S[0] + 1.5, S[1] + chestD);
  body.bezierCurveTo(S[0] - 6, S[1] + chestD + 0.4 + jig * 0.6, Hp[0] + 7, Hp[1] + L(7.2, 5.6, lr) + jig * 0.6, Hp[0] - 0.5, Hp[1] + L(5.6, 5.3, lr));
  body.bezierCurveTo(Hp[0] - 4.5, Hp[1] + L(5.5, 5.2, lr), rx + 0.6, ry + 1.6, rx, ry);
  body.closePath();
  g.fillStyle = C(WR.col); g.fill(body);
  if (real) {
    g.save(); g.clip(body);
    const mx = (S[0] + Hp[0]) / 2, my = (S[1] + Hp[1]) / 2;
    g.fillStyle = 'rgba(90,35,25,0.14)'; g.beginPath(); g.ellipse(mx, -1, 18, 4.5, 0, 0, TAU); g.fill(); // 배 그늘
    if (lr > 0.01) { g.globalAlpha = lr; g.fillStyle = WR.belly; g.beginPath(); g.ellipse(mx + 3, S[1] + 5.4, 12, 3.8, -0.06, 0, TAU); g.fill(); g.globalAlpha = 1; } // 드러낸 배
    g.fillStyle = 'rgba(255,232,215,0.3)'; g.beginPath(); g.ellipse(mx - 1, my - topS * 0.95 + 1.2, 12, 2.2, -0.12, 0, TAU); g.fill(); // 등 윤기
    for (let i = 0; i < 12; i++) ell(g, Hp[0] - 4 + hash(i, 1, 3) * 22, S[1] - 7 + hash(i, 2, 5) * 14, 0.5 + hash(i, 3, 1) * 0.5, 0.35 + hash(i, 4, 2) * 0.3, 0, WR.wart); // 우툴두툴한 살갗
    g.strokeStyle = WR.fold; g.lineCap = 'round'; g.lineWidth = 0.42; g.beginPath();
    for (let k = 0; k < 3; k++) { const rr = 5.6 + k * 2.1; g.moveTo(hp[0] + Math.cos(ha + 1.95) * rr, hp[1] + Math.sin(ha + 1.95) * rr); g.arc(hp[0], hp[1], rr, ha + 1.95, ha + 3.5 - k * 0.12); } // 목 주름
    g.moveTo(S[0] - 5, S[1] - topS + 3); g.quadraticCurveTo(S[0] - 3.4, S[1] - 1, S[0] - 5.2, S[1] + 6); // 어깨 뒤 주름
    g.moveTo(Hp[0] + 5.5, Hp[1] - rumpT + 2); g.quadraticCurveTo(Hp[0] + 7.4, Hp[1] - 2, Hp[0] + 5.6, Hp[1] + 4); // 옆구리 주름
    g.moveTo(Hp[0] + 2, Hp[1] - rumpT + 3); g.quadraticCurveTo(Hp[0] + 3.4, Hp[1] - 2, Hp[0] + 2.2, Hp[1] + 3);
    g.stroke();
    g.restore();
  }
  // 가까운 쪽 지느러미(팔·다리는 몸 색, 노 모양 발은 짙게)
  g.fillStyle = C(WR.col); bones(g, rn.pts, [3.4, 2.6]); paddle(rn.pts[1][0], rn.pts[1][1], rn.pa, WR.flip, 0.95);
  g.fillStyle = C(WR.col); bones(g, fn.pts, [4.4, 3.4, 2.8]);
  if (real) { const [, kn] = fn.pts; g.strokeStyle = WR.fold; g.lineWidth = 0.45; g.beginPath(); g.arc(kn[0], kn[1], 1.6, Math.PI * 0.6, Math.PI * 1.3); g.stroke(); }
  paddle(fn.pts[2][0], fn.pts[2][1], fn.pa, WR.flip, 1);

  // ---- 머리·엄니·수염 ----
  const tusk = (bx, by, col) => { // 엄니: 윗입술 밑에서 아래로 길게, 끝이 살짝 뒤로 휜다(땅 밑은 잘린다)
    const pts = [];
    for (let i = 0; i <= 7; i++) { const u = i / 7, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; pts.push([a * bx + b * (bx + 1.3) + c * (bx - 0.5), a * by + b * (by + 5.6 * tl) + c * (by + 11.2 * tl)]); }
    g.save(); g.beginPath(); g.rect(-60, -90, 120, 90); g.clip();
    inHead(() => {
      const Lf = [], Rt = [];
      for (let i = 0; i <= 7; i++) {
        const u = i / 7, q = pts[i], n = pts[Math.min(7, i + 1)], o = pts[Math.max(0, i - 1)], dx = n[0] - o[0], dy = n[1] - o[1], l = Math.hypot(dx, dy) || 1, w = (1.55 * (1 - u) + 0.22 * u) / 2;
        Lf.push([q[0] - (dy / l) * w, q[1] + (dx / l) * w]); Rt.push([q[0] + (dy / l) * w, q[1] - (dx / l) * w]);
      }
      g.fillStyle = C(col); g.beginPath(); g.moveTo(Lf[0][0], Lf[0][1]);
      for (const q of Lf) g.lineTo(q[0], q[1]);
      for (let i = 7; i >= 0; i--) g.lineTo(Rt[i][0], Rt[i][1]);
      g.closePath(); g.fill();
      if (real) { g.strokeStyle = WR.tuskLine; g.lineWidth = 0.3; g.beginPath(); g.moveTo(Lf[1][0], Lf[1][1]); for (let i = 2; i < 7; i++) g.lineTo(Lf[i][0] * 0.7 + pts[i][0] * 0.3, Lf[i][1] * 0.7 + pts[i][1] * 0.3); g.stroke(); }
    });
    g.restore();
  };
  tusk(6.0, 3.6, WR.tuskFar);
  const jaw = 0.62 * bell + (r.hk === 'drink' ? 0.12 * hd * Math.max(0, Math.sin(t * 4)) : 0);
  const shut = r.blink > 0 || lr > 0.5 || bell > 0.55 || scr > 0.5;
  const tw = (r.ear?.x ?? 0) * 0.5 + bell * 0.35; // 수염 씰룩
  inHead(() => {
    g.fillStyle = C(WR.col); g.fill(HEAD);
    if (real) {
      g.save(); g.clip(HEAD);
      g.fillStyle = WR.pad; g.beginPath(); g.ellipse(6.6 + tw * 0.25, 0.9, 3.5, 3.7, 0.1, 0, TAU); g.fill(); // 수염판
      g.fillStyle = 'rgba(90,35,25,0.14)'; g.beginPath(); g.ellipse(0.5, 3.6, 5, 1.6, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,232,215,0.3)'; g.beginPath(); g.ellipse(-0.5, -4.4, 3.4, 1.2, -0.1, 0, TAU); g.fill();
      g.restore();
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - (i === 0 ? 1 : 0); j++) ell(g, 4.9 + j * 1.15 + i * 0.3 + tw * 0.2, -1.2 + i * 1.2, 0.17, 0.17, 0, WR.dot); // 수염 뿌리
      ell(g, 3.1, -3.0, 0.85, 0.72, 0, WR.rim); // 눈가
      eye(g, 3.1, -3.0, 0.52, shut);
      g.strokeStyle = WR.fold; g.lineWidth = 0.45; g.lineCap = 'round'; g.beginPath();
      g.moveTo(1.8, -4.1); g.quadraticCurveTo(3.1, -4.8, 4.4, -4.0); // 눈 위 주름
      g.moveTo(1.4, -1.6); g.quadraticCurveTo(2.2, 0.4, 1.6, 2.4); // 뺨 주름
      g.stroke();
      g.strokeStyle = WR.nostril; g.lineWidth = 0.4; g.beginPath(); g.moveTo(7.1, -2.75); g.quadraticCurveTo(7.6, -3.05, 8.1, -2.65); g.moveTo(7.6, -2.45); g.quadraticCurveTo(8.1, -2.7, 8.5, -2.3); g.stroke(); // 콧구멍
    }
    // 입: 울 때 아래턱이 벌어져 붉은 입속이 보인다
    if (jaw > 0.03) {
      const c = Math.cos(jaw), s2 = Math.sin(jaw), ex = 0.4 + (5.3 - 0.4) * c - (4.3 - 4.0) * s2, ey = 4.0 + (5.3 - 0.4) * s2 + (4.3 - 4.0) * c;
      g.fillStyle = C(WR.mouth); g.beginPath(); g.moveTo(0.2, 4.0); g.lineTo(5.6, 4.4); g.lineTo(ex, ey + 0.4); g.closePath(); g.fill();
      if (real) ell(g, 2.6, 4.6 + jaw * 1.4, 1.6, 0.6, jaw * 0.5, WR.tongue);
    }
    g.save(); g.translate(0.4, 4.0); g.rotate(jaw); g.translate(-0.4, -4.0); g.fillStyle = C(WR.col); g.fill(JAW); g.restore();
  });
  tusk(5.0, 3.9, WR.tusk);
  inHead(() => { // 뻣뻣한 수염: 수염판 앞·아래 가장자리를 따라 삐죽삐죽한 술(한 덩어리로 채워 외곽선이 깔끔하다)
    const cx = 6.6 + tw * 0.25, cy = 0.9, a0 = -0.25, a1 = 2.15, n = 12;
    g.fillStyle = C(WR.bristle); g.beginPath();
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; g.lineTo(cx + Math.cos(a) * 3.1, cy + Math.sin(a) * 3.3); }
    for (let i = 2 * n; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / (2 * n) + tw * 0.08, k = i % 2 ? 1.08 : 1.34 + 0.07 * Math.sin(i * 1.7 + tw * 3);
      g.lineTo(cx + Math.cos(a) * 3.5 * k, cy + Math.sin(a) * 3.7 * k);
    }
    g.closePath(); g.fill();
    if (real) { // 술 안의 털 결
      g.strokeStyle = WR.tuskLine; g.lineWidth = 0.22; g.lineCap = 'round'; g.beginPath();
      for (let i = 1; i < 2 * n; i += 2) { const a = a0 + ((a1 - a0) * i) / (2 * n); g.moveTo(cx + Math.cos(a) * 3.3, cy + Math.sin(a) * 3.5); g.lineTo(cx + Math.cos(a) * 4.1, cy + Math.sin(a) * 4.3); }
      g.stroke();
    }
  });

  // ---- 먹기: 주둥이 앞으로 모래가 튄다 · 울기: 입에서 소리 물결 ----
  if (real && ek > 0.4) {
    const m = toH(9.6, 2.5);
    for (let i = 0; i < 5; i++) { const u = (t * 1.7 + i * 0.21) % 1, px = m[0] - 0.5 - u * (3 + i * 0.8), py = Math.min(-0.2, -0.3 - (u * 5 - u * u * 5) * (1 + (i % 3) * 0.3)); ell(g, px, py, 0.42 * (1 - u * 0.4), 0.36 * (1 - u * 0.4), 0, WR.sand); }
  }
  if (s > 0.3) {
    const m = toH(6.4, 5.6), dir = ha + 0.75;
    g.strokeStyle = C('#ffffff'); g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const u = (sp * 10 + k / 3) % 1, rr = 2.6 + u * 7.5;
      g.lineWidth = 1.1 * (1 - u * 0.5) * Math.min(1, bell * 2.5); if (g.lineWidth < 0.15) continue;
      g.beginPath(); g.arc(m[0], m[1], rr, dir - 0.55, dir + 0.55); g.stroke();
    }
  }
}
