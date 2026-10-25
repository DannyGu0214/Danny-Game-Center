// 도둑갈매기(갈색도둑갈매기) 리그: 땅딸막한 짙은 갈색 몸(얼룩덜룩한 깃), 날개깃 밑동의 흰 무늬, 짧고 굵은 갈고리 검은 부리, 검은 다리와 물갈퀴 발.
// 걷기(뒤뚱 2박, 뒤로 굽는 발목 IK, 가슴을 내밀고 몸을 살짝 흔드는 으스대는 걸음, 머리는 멈췄다가 앞으로 쑥)
// ·쉬기(두리번, 가끔 깃 고르기·날개 추스르기)·먹기(땅의 먹이를 물고 홱 잡아 뜯기)·물(부리 담갔다 들어 삼키기)
// ·눕기(배 깔고 앉아 목을 어깨에 파묻고 눈 감기)·특수 행동(두 날개를 등 위로 높이 들어 흰 무늬를 보이고, 고개를 젖혀 부리를 벌리고 크게 운다).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 4; // 한 걸음 주기(두 발 한 번씩) 동안 몸이 나아가는 거리
export const BOX = [9, 14];
const TAU = Math.PI * 2;
const DUTY = 0.6;
const SK = {
  body: '#5e4535', head: '#684d3b', cap: '#3d2c22', wing: '#4e392c', wingFar: '#3a2a20', prim: '#2c211a', primFar: '#231a15',
  flash: '#f7f2e8', speck: '#94785f', edge: '#7c614c', beak: '#1c1816', leg: '#221d1a', legFar: '#141110', mouth: '#a8463e', meat: '#b0493e',
};
const ROOT = [0.4, 2.7], NB = [3.9, -2.1], SHO = [2.2, -2.4]; // 몸 좌표: 다리 뿌리, 목 뿌리, 어깨(날개 뿌리)
const LEG = { a: 2.4, b: 2.7 };

const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (A, B, k) => [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? ss((s - a) / (b - a)) : s <= c ? 1 : 1 - ss((s - c) / (d - c)));
function bones(g, C, pts, ws, col) {
  g.fillStyle = C(col); g.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath();
  }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], w = ws[i] / 2; g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU, true); }
  g.fill();
}

let BODY = null, WING = null, UP = null;
const UL = 15, UC = 4.1; // 든 날개 길이·폭
function paths() {
  if (BODY) return;
  BODY = new Path2D(); // 몸 좌표(몸 중심 기준): 목 뿌리 → 불룩한 가슴 → 배 → 짧은 꽁지 → 등
  BODY.moveTo(4.4, -2.9);
  BODY.bezierCurveTo(6.8, -1.1, 6.0, 3.1, 1.4, 3.45);
  BODY.quadraticCurveTo(-3.2, 3.7, -5.6, 1.7);
  BODY.lineTo(-8.5, 0.35);
  BODY.quadraticCurveTo(-8.7, -0.8, -6.0, -1.7);
  BODY.quadraticCurveTo(-1.4, -3.9, 4.4, -2.9);
  BODY.closePath();
  WING = new Path2D(); // 접은 날개(몸 옆면): 끝은 꽁지를 조금 넘는다
  WING.moveTo(4.1, -2.3);
  WING.quadraticCurveTo(-1, -3.7, -5.6, -2.4);
  WING.quadraticCurveTo(-8.4, -1.7, -10.2, -0.9);
  WING.quadraticCurveTo(-7.3, 0.15, -4.6, 0.85);
  WING.quadraticCurveTo(0.4, 2.0, 3.5, 0.55);
  WING.quadraticCurveTo(4.9, -0.8, 4.1, -2.3);
  WING.closePath();
  UP = new Path2D(); // 든 날개(날개 좌표: 어깨 = 원점, +x = 날개 끝, +y = 뒷가장자리)
  UP.moveTo(-0.5, -1.0);
  UP.quadraticCurveTo(UL * 0.45, -2.0, UL, 0.1);
  UP.quadraticCurveTo(UL * 0.9, 1.4, UL * 0.66, UC * 0.66);
  for (let i = 0; i < 5; i++) { const x0 = UL * (0.66 - i * 0.14), x1 = x0 - UL * 0.14; UP.quadraticCurveTo((x0 + x1) / 2, UC * (1.08 + i * 0.02), x1, UC * (0.9 + i * 0.03)); } // 둘째날개깃 가장자리(잔물결)
  UP.lineTo(-0.9, UC * 0.8);
  UP.closePath();
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C, taper, hash } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const special = sp >= 0, moving = p.mv > 0 && !special, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  const restT = p.st === 'rest' ? 1 : 0, ly = special ? 0 : Math.max(p.ly ?? 0, dt > 0 ? clamp01(spring('rest', restT, 30, 11)) : restT);
  const eat = p.st === 'eat' ? hd * (1 - ly) : 0, drink = p.st === 'drink' ? hd * (1 - ly) : 0, down = Math.max(eat, drink);
  const breath = Math.sin((t * TAU) / 2.8);
  const idle = !moving && !special && p.st === 'idle', cyc = (t % 14) / 14;
  const preen = idle ? env(cyc, 0.5, 0.54, 0.66, 0.7) : 0; // 가끔 깃 고르기
  const shuffle = idle ? env(cyc, 0.82, 0.845, 0.9, 0.93) : 0; // 가끔 날개 추스르기

  // ---- 특수(크게 울기): 날개를 등 위로 들어 올리고, 고개를 젖혀 세 번 운다 ----
  const up = special ? ss(sp / 0.1) * ss((1 - sp) / 0.09) : 0;
  const call = special ? Math.max(env(sp, 0.14, 0.2, 0.3, 0.36), env(sp, 0.4, 0.46, 0.56, 0.62), env(sp, 0.66, 0.72, 0.82, 0.88)) : 0;
  const flut = special ? 0.05 * Math.sin(sp * TAU * 26) * call : 0;

  // ---- 몸 위치·기울기 ----
  let bx = -0.6, by = -7.2, th = -0.1;
  if (moving) { by += 0.4 * Math.cos(u * TAU * 2); th += 0.07 * Math.sin(u * TAU) - 0.04; bx += 0.2 * Math.sin(u * TAU); } // 가슴 내밀고 으스대며
  if (!moving && !special) by += 0.08 * breath;
  const yank = p.st === 'eat' ? env((t % 1.4) / 1.4, 0.45, 0.55, 0.62, 0.85) : 0; // 먹이를 물고 홱 잡아당긴다
  by += down * 0.7; th += eat * (0.36 - 0.2 * yank) + drink * 0.24;
  by = lerp(by, -3.5, ly); th = lerp(th, -0.04, ly);
  by -= up * 0.6; th -= up * 0.2;
  const ca = Math.cos(th), sa = Math.sin(th), T = (x, y) => [bx + ca * x - sa * y, by + sa * x + ca * y];

  // ---- 다리: 뒤로 굽는 발목(2-bone IK, bend -1), 검은 물갈퀴 발 ----
  const root = T(...ROOT), rootF = T(ROOT[0] + 0.9, ROOT[1] - 0.2);
  const legOf = (rt, off, dx) => {
    let f = { x: dx, y: 0, sw: 0 };
    if (moving) { const q = footAt((u + off) % 1, STRIDE * DUTY, 1.5, DUTY); f = { x: q.x + dx, y: q.y, sw: q.sw }; }
    const foot = [bx + ROOT[0] + f.x, -0.55 + f.y], toeA = f.sw * 0.9;
    const { knee } = ik(rt[0], rt[1], foot[0], foot[1], LEG.a, LEG.b, -1);
    return { pts: [rt, knee, foot], toeA };
  };
  const LN = legOf(root, 0, 0.3), LF = legOf(rootF, 0.5, 1.2);
  const drawLeg = (L, col) => {
    const [rt, an, fj] = L.pts;
    bones(g, C, [rt, an, fj], [1.35, 0.78, 0.66], col);
    g.save(); g.translate(fj[0], fj[1]); g.rotate(L.toeA);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(-0.6, -0.3); g.lineTo(2.5, 0.2); g.lineTo(2.25, 0.62); g.lineTo(-0.3, 0.62); g.closePath(); g.fill();
    g.restore();
  };

  // ---- 그림자 ----
  if (p.shadow !== false) ell(g, bx + 0.4, 0, 7.6, 1.7, 0, 'rgba(40,25,10,0.22)');

  // ---- 든 날개(특수): 어깨에서 뒤로 접혀 있다가 등 위로 높이 선다. 날개깃 밑동에 흰 띠 ----
  const wingUp = (near) => {
    const s0 = T(SHO[0] + (near ? 0 : 0.7), SHO[1] - (near ? 0 : 0.5));
    const a = lerp(Math.PI + 0.12, Math.PI * 1.5 - (near ? 0.38 : 0.8), up) + flut * (near ? 1 : -1);
    const L = lerp(0.8, 1, up), W = lerp(0.62, 1, up);
    g.save(); g.translate(s0[0], s0[1]); g.rotate(a); g.scale(L, -W);
    g.fillStyle = C(near ? SK.wing : SK.wingFar); g.fill(UP);
    g.save(); g.clip(UP);
    g.fillStyle = C(near ? SK.prim : SK.primFar); g.fillRect(UL * 0.64, -3, UL, 9); // 짙은 첫째날개깃
    g.fillStyle = C(SK.flash); g.beginPath(); g.moveTo(UL * 0.52, -2.2); g.lineTo(UL * 0.66, -2.2); g.lineTo(UL * 0.64, UC + 1); g.lineTo(UL * 0.5, UC + 1); g.closePath(); g.fill(); // 흰 무늬
    if (real) {
      g.fillStyle = 'rgba(20,12,8,0.22)'; g.fillRect(-1, UC * 0.55, UL * 0.52, UC); // 둘째날개깃(조금 짙게)
      g.strokeStyle = near ? SK.edge : SK.wing; g.lineWidth = 0.32; g.lineCap = 'round'; g.beginPath(); // 덮깃 가장자리
      for (const [x, y] of [[0.8, 0.2], [2.6, 0.0], [4.4, -0.1], [1.7, 1.4], [3.5, 1.3], [5.3, 1.1]]) { g.moveTo(x + 0.85, y); g.arc(x, y, 0.85, 0, Math.PI); }
      g.stroke();
      g.strokeStyle = 'rgba(20,12,8,0.42)'; g.lineWidth = 0.28; g.beginPath();
      for (let i = 0; i < 4; i++) { const x = UL * (0.1 + i * 0.1); g.moveTo(x, UC * 0.62); g.lineTo(x - 0.5, UC * 1.0); } // 둘째날개깃 결
      for (let i = 0; i < 3; i++) { const y = 0.3 + i * 1.0; g.moveTo(UL * 0.7, y); g.lineTo(UL * 0.95, y * 0.35 + 0.2); } // 첫째날개깃 결
      g.stroke();
    }
    g.restore();
    g.restore();
  };
  if (up > 0.04) wingUp(false);

  // ---- 다리(앉으면 몸 밑에 접혀 안 보인다) ----
  if (ly < 0.6) { drawLeg(LF, SK.legFar); drawLeg(LN, SK.leg); }

  // ---- 머리 위치: 서기 → 먹기(물고 뜯기)·물 → 앉기(등에 파묻기) → 깃 고르기 → 울기 ----
  let hb = 0;
  if (moving) { const v = (u * 2) % 1; hb = v < 0.6 ? 1.0 - 2.0 * (v / 0.6) : -1.0 + 2.0 * ss((v - 0.6) / 0.4); }
  const bob = spring('hb', hb, 320, 24);
  const look = 0.12 * Math.sin((r.look ?? 0) * 0.5) + 0.07 * Math.sin((r.look ?? 0) * 1.3);
  const rh = (r.head?.x ?? 0);
  let hc = T(5.9 + (moving ? 0.5 : 0), -4.9 - (idle ? 0.5 * Math.max(0, Math.sin((r.look ?? 0) * 0.31)) : 0)), ha = (idle ? look : 0) + rh;
  hc[0] += bob;
  const tipAt = (x, y, a) => [x - (4.7 * Math.cos(a) - 0.3 * Math.sin(a)), y - (4.7 * Math.sin(a) + 0.3 * Math.cos(a))]; // 부리 끝이 (x, y)에 오도록 머리 중심
  const gA = 1.15 - yank * 0.75, gEat = tipAt(bx + 10.4 - yank * 1.2, -0.25 - yank * 2.6, gA);
  const sip = p.st === 'drink' ? ss(0.5 + 0.9 * Math.sin(t * TAU * 0.45)) : 0; // 0 = 담금, 1 = 들어 삼키기
  const dTip = tipAt(bx + 10.4, 0.1, 1.2), gDrink = lerp2(dTip, [bx + 7.2, -7.0], sip), dA = lerp(1.2, -0.4, sip);
  hc = lerp2(hc, p.st === 'drink' ? gDrink : gEat, down); ha = lerp(ha, p.st === 'drink' ? dA : gA, down);
  hc = lerp2(hc, T(4.5, -3.0), ly); ha = lerp(ha, 0.42, ly); // 앉아 쉴 땐 목을 어깨에 파묻고 부리를 가슴 쪽으로
  if (preen > 0) { const pr = T(1.4, -4.1 + 0.3 * Math.sin(t * TAU * 3)); hc = lerp2(hc, pr, preen); ha = preen > 0.5 ? 0.8 + 0.15 * Math.sin(t * TAU * 3) : ha; }
  if (up > 0) { const ch = T(5.6, -6.1); hc = lerp2(hc, ch, up); ha = lerp(ha, -0.95 - 0.3 * call, up); }
  if (moving) ha += 0.05 * Math.sin(u * TAU * 2);
  springTo(r.head ?? (r.head = { x: 0, v: 0 }), (hb - bob) * 0.05, 60, 8, dt);
  const flip = preen > 0.5; // 뒤를 돌아볼 땐 머리 좌우를 뒤집는다

  // ---- 목(굵다) + 몸통 ----
  const nb = T(...NB);
  taper(g, nb[0], nb[1], hc[0] - (flip ? -0.3 : 0.3), hc[1] + 0.4, 4.8, 3.9, SK.body);
  const sx = 1 + 0.012 * breath + ly * 0.04, sy = 1 + 0.022 * breath + ly * 0.05;
  g.save(); g.translate(bx, by); g.rotate(th); g.scale(sx, sy);
  g.fillStyle = C(SK.body); g.fill(BODY);
  if (real) {
    g.save(); g.clip(BODY);
    g.fillStyle = 'rgba(25,14,8,0.16)'; g.beginPath(); g.ellipse(-0.5, 3.2, 6.6, 1.6, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    for (let i = 0; i < 9; i++) ell(g, -4 + hash(i, 7, 1) * 10, -0.6 + hash(i, 8, 2) * 3.8, 0.42, 0.26, 0.3, SK.speck); // 가슴·옆구리 얼룩
    g.restore();
  }
  // 접은 날개(울 땐 든 날개로 바뀐다). 날개 추스르기 땐 들썩이며 흰 무늬가 비친다
  const fold = 1 - up;
  if (fold > 0.05) {
    g.save(); g.translate(SHO[0], SHO[1]); g.rotate(-0.2 * shuffle + (moving ? 0.03 * Math.sin(u * TAU * 2) : 0)); g.scale(lerp(1, 0.4, up), 1 + 0.06 * shuffle); g.translate(-SHO[0], -SHO[1]);
    g.fillStyle = C(SK.wing); g.fill(WING);
    g.save(); g.clip(WING);
    g.fillStyle = C(SK.prim); g.fillRect(-11, -4, 5.6, 6); // 짙은 첫째날개깃
    g.fillStyle = C(SK.flash); g.beginPath(); g.ellipse(-5.3, -0.05, 0.62 + 0.25 * shuffle, 1.25, 0.35, 0, TAU); g.fill(); // 날개깃 밑동 흰 무늬
    if (real) {
      g.strokeStyle = SK.edge; g.lineWidth = 0.32; g.lineCap = 'round'; g.beginPath(); // 덮깃 가장자리(비늘처럼 얼룩덜룩)
      for (const [x, y] of [[2.2, -1.6], [0.4, -1.9], [-1.4, -1.8], [-3.2, -1.5], [1.3, -0.5], [-0.5, -0.6], [-2.3, -0.4], [0.4, 0.6], [-1.5, 0.7]]) { g.moveTo(x + 0.8, y); g.arc(x, y, 0.8, 0, Math.PI); }
      g.stroke();
      g.strokeStyle = 'rgba(15,8,5,0.4)'; g.lineWidth = 0.28; g.beginPath(); g.moveTo(-6.2, -1.4); g.quadraticCurveTo(-8, -0.9, -9.6, -0.8); g.moveTo(-6.0, -0.4); g.quadraticCurveTo(-7.6, -0.3, -9.2, -0.5); g.stroke(); // 첫째날개깃 결
    }
    g.restore();
    g.restore();
  }
  g.restore();
  if (up > 0.04) wingUp(true);

  // ---- 머리: 둥근 갈색 머리(짙은 정수리), 굵고 짧은 갈고리 검은 부리. 울 땐 아랫부리가 벌어진다 ----
  const jaw = up * call * (0.5 + 0.12 * Math.sin(sp * TAU * 30)) + (p.st === 'drink' ? 0.1 * down * (1 - sip) : 0);
  g.save(); g.translate(hc[0], hc[1]); if (flip) g.scale(-1, 1); g.rotate(ha);
  ell(g, 0, 0, 2.45, 2.2, 0, SK.head);
  if (real) {
    g.save(); g.beginPath(); g.ellipse(0, 0, 2.45, 2.2, 0, 0, TAU); g.clip();
    g.fillStyle = SK.cap; g.beginPath(); g.ellipse(-0.4, -1.5, 2.6, 1.3, -0.15, 0, TAU); g.fill(); // 짙은 정수리
    g.fillStyle = 'rgba(25,14,8,0.18)'; g.beginPath(); g.ellipse(-0.6, 1.4, 1.8, 0.9, 0, 0, TAU); g.fill();
    g.restore();
    for (let i = 0; i < 4; i++) ell(g, -1.4 + hash(i, 3, 9) * 1.6, 0.2 + hash(i, 4, 9) * 1.3, 0.28, 0.17, 0.4, SK.speck); // 목·뺨 줄무늬
  }
  if (jaw > 0.03) { // 입 안
    const c = Math.cos(jaw), s = Math.sin(jaw);
    g.fillStyle = C(SK.mouth); g.beginPath(); g.moveTo(1.6, 0.2); g.lineTo(4.4, 0.35); g.lineTo(1.6 + 2.9 * c, 0.4 + 2.9 * s); g.closePath(); g.fill();
  }
  g.fillStyle = C(SK.beak); g.beginPath(); // 아랫부리(경첩 1.6, 0.4)
  g.save(); g.translate(1.6, 0.4); g.rotate(jaw); g.translate(-1.6, -0.4);
  g.moveTo(1.5, 0.3); g.lineTo(4.1, 0.45); g.quadraticCurveTo(3.7, 1.2, 3.1, 1.2); g.quadraticCurveTo(2.2, 1.2, 1.4, 1.0); g.closePath(); g.fill();
  g.restore();
  g.beginPath(); // 윗부리: 굵고 짧으며 끝이 갈고리처럼 아래로 굽는다
  g.moveTo(1.4, -0.95); g.quadraticCurveTo(3.4, -1.15, 4.4, -0.45); g.quadraticCurveTo(5.15, 0.15, 4.75, 0.95); g.quadraticCurveTo(4.55, 0.5, 4.1, 0.42); g.lineTo(1.5, 0.35); g.closePath(); g.fill();
  if (real && eat > 0.5 && (yank > 0.2 || (t % 1.4) / 1.4 > 0.6)) ell(g, 4.3, 1.2, 0.8, 0.45, 0.6, SK.meat); // 뜯은 먹이 조각
  const closed = r.blink > 0 || ly > 0.6;
  eye(g, 0.65, -0.45, 0.5, closed);
  if (real && !closed) { g.strokeStyle = 'rgba(15,8,5,0.55)'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(-0.1, -1.05); g.quadraticCurveTo(0.6, -1.3, 1.3, -0.95); g.stroke(); } // 눈두덩
  g.restore();

  // ---- 울음 소리 물결 ----
  if (up > 0.3 && call > 0.2) {
    const c = Math.cos(ha), s = Math.sin(ha), m = [hc[0] + c * 5.6 - s * 0.6, hc[1] + s * 5.6 + c * 0.6], dir = ha + 0.15;
    g.strokeStyle = C('#ffffff'); g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const v = (sp * 12 + k / 3) % 1, rr = 1.6 + v * 5.5;
      g.lineWidth = 0.75 * (1 - v * 0.5) * Math.min(1, call * 2); if (g.lineWidth < 0.12) continue;
      g.beginPath(); g.arc(m[0], m[1], rr, dir - 0.6, dir + 0.6); g.stroke();
    }
  }
}
