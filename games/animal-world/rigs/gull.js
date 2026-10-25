// 갈매기 리그: 흰 몸, 회색 등·날개, 검은 날개 끝(흰 점), 노란 부리(아랫부리 빨간 점), 분홍 다리와 물갈퀴 발.
// 걷기(뒤뚱 2박, 머리는 멈췄다가 앞으로 쑥)·쉬기(두리번, 가끔 깃 고르기·날개 추스르기)·먹기(땅 쪼기)·물(부리 담갔다 들어 삼키기)
// 눕기(땅에 배 깔고 앉아 목을 움츠리고 눈 감기)·특수 행동(날개 펴고 날아올랐다가 떠서 활공, 발을 늘어뜨리고 내려앉기).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 4; // 한 걸음 주기(두 발 한 번씩) 동안 몸이 나아가는 거리
export const BOX = [8, 14];
const TAU = Math.PI * 2;
const DUTY = 0.6;
const GL = { body: '#fbfbf8', shade: '#dfe3e6', grey: '#a3b0ba', grey2: '#8a98a3', black: '#26282c', beak: '#f3c331', spot: '#d8402e', leg: '#eda3a0', legFar: '#cf8986', ring: '#d9534a' };
const ROOT = [0.5, 2.3], NB = [3.6, -1.7], SHO = [2.0, -2.0]; // 몸 좌표: 다리 뿌리, 목 뿌리, 어깨(날개 뿌리)
const LEG = { a: 2.4, b: 2.7 };
const FLY = 17; // 날아오르는 높이

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
function bones(g, C, pts, ws, col) {
  g.fillStyle = C(col); g.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath();
  }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], w = ws[i] / 2; g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU, true); }
  g.fill();
}

let BODY = null, WING = null;
function paths() {
  if (BODY) return;
  BODY = new Path2D(); // 몸 좌표(몸 중심 기준): 목 뿌리 → 둥근 가슴 → 배 → 꼬리 끝 → 등
  BODY.moveTo(4.0, -2.5);
  BODY.bezierCurveTo(5.9, -0.9, 5.1, 2.5, 1.2, 2.95);
  BODY.quadraticCurveTo(-3.2, 3.25, -5.6, 1.2);
  BODY.lineTo(-8.7, -0.45);
  BODY.quadraticCurveTo(-8.5, -1.45, -5.8, -1.85);
  BODY.quadraticCurveTo(-1.2, -3.35, 4.0, -2.5);
  BODY.closePath();
  WING = new Path2D(); // 접은 날개(몸 옆면), 끝은 꼬리 너머까지
  WING.moveTo(3.7, -1.9);
  WING.quadraticCurveTo(-1, -3.15, -5.4, -2.0);
  WING.quadraticCurveTo(-8.3, -1.5, -10.4, -0.85);
  WING.quadraticCurveTo(-7.3, -0.05, -4.6, 0.55);
  WING.quadraticCurveTo(0.4, 1.5, 3.2, 0.25);
  WING.quadraticCurveTo(4.5, -0.8, 3.7, -1.9);
  WING.closePath();
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C, taper } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const fly = sp >= 0, moving = p.mv > 0 && !fly, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  // 바닷가 동물은 게임에서 ly를 받지 못하므로 상태로 직접 앉는다(아이콘처럼 dt가 없으면 바로)
  const restT = p.st === 'rest' ? 1 : 0, ly = Math.max(p.ly ?? 0, dt > 0 ? clamp01(spring('rest', restT, 30, 11)) : restT);
  const eat = p.st === 'eat' ? hd * (1 - ly) : 0, drink = p.st === 'drink' ? hd * (1 - ly) : 0, down = Math.max(eat, drink);
  const breath = Math.sin(t * TAU / 2.6);

  // ---- 날기(특수): 펼치기 → 날갯짓하며 떠오르기 → 떠서 활공 → 발 내리고 내려앉기 → 접기 ----
  let spread = 0, lift = 0, flap = 0, crouch = 0, legFwd = 0, dangle = 0, pitch = 0;
  if (fly) {
    spread = ss(sp / 0.07) * ss((1 - sp) / 0.06);
    const up = ss((sp - 0.1) / 0.22), downK = ss((sp - 0.66) / 0.24);
    lift = up * (1 - downK);
    const glide = ss((sp - 0.36) / 0.06) * ss((0.62 - sp) / 0.06); // 가운데쯤은 날개를 편 채 미끄러지듯
    const amp = spread * (1 - 0.8 * glide) * (sp < 0.92 ? 1 : 1 - ss((sp - 0.92) / 0.05));
    flap = Math.sin(sp * TAU * 13) * amp + glide * 0.05 * Math.sin(sp * TAU * 3);
    crouch = ss((sp - 0.03) / 0.05) * (1 - ss((sp - 0.09) / 0.03)) + ss((sp - 0.88) / 0.03) * (1 - ss((sp - 0.94) / 0.04)) * 0.6; // 뛰기 전·내려앉을 때 무릎 굽힘
    dangle = ss((sp - 0.12) / 0.06) * (1 - ss((sp - 0.66) / 0.1)); // 공중: 발을 뒤로 늘어뜨림
    legFwd = ss((sp - 0.68) / 0.08) * (1 - ss((sp - 0.9) / 0.03)); // 내려앉기 직전: 발을 앞으로
    pitch = -0.28 * ss((sp - 0.08) / 0.06) * (1 - ss((sp - 0.3) / 0.08)) - 0.08 * glide - 0.32 * legFwd;
  }
  const H0 = lift * (FLY + 0.8 * Math.sin(sp * TAU * 3));

  // ---- 몸 위치·기울기 ----
  let bx = -0.6, by = -7.0, th = -0.06;
  if (moving) { by += 0.35 * Math.cos(u * TAU * 2); th = 0.05 * Math.sin(u * TAU); }
  if (!moving && !fly) by += 0.08 * breath;
  by += down * 0.6; th += eat * 0.26 + drink * 0.22;
  by = lerp(by, -3.2, ly); th = lerp(th, -0.05, ly);
  by += crouch * 1.1 - H0; th += pitch;
  const ca = Math.cos(th), sa = Math.sin(th), T = (x, y) => [bx + ca * x - sa * y, by + sa * x + ca * y];

  // ---- 다리: 뒤로 굽는 발목(2-bone IK, bend -1), 물갈퀴 발 ----
  const root = T(...ROOT), rootF = T(ROOT[0] + 0.9, ROOT[1] - 0.2);
  const legOf = (rt, off, dx) => {
    let f = { x: dx, y: 0, sw: 0 };
    if (moving) { const q = footAt((u + off) % 1, STRIDE * DUTY, 1.5, DUTY); f = { x: q.x + dx, y: q.y, sw: q.sw }; }
    let foot = [bx + ROOT[0] + f.x, -0.55 + f.y], toeA = f.sw * 0.9;
    if (fly && lift > 0.001) { // 공중: 발을 늘어뜨리거나(뒤로) 내려앉을 땐 앞으로 내민다
      const hang = [rt[0] - 2.4 + legFwd * 4.2 + dx * 0.3, rt[1] + 4.0 + legFwd * 0.3];
      const k = clamp01(lift * 3);
      foot = [lerp(foot[0], hang[0], k), lerp(foot[1], hang[1], k)];
      toeA = lerp(toeA, 1.15 * dangle + 0.1 * legFwd, k);
    }
    const { knee } = ik(rt[0], rt[1], foot[0], foot[1], LEG.a, LEG.b, -1);
    return { pts: [rt, knee, foot], toeA };
  };
  const LN = legOf(root, 0, 0.3), LF = legOf(rootF, 0.5, 1.1);
  const drawLeg = (L, col) => {
    const [rt, an, fj] = L.pts;
    bones(g, C, [rt, an, fj], [1.25, 0.72, 0.62], col);
    // 물갈퀴 발: 앞으로 편 세 발가락 사이 막. 들면 아래로 오므린다
    g.save(); g.translate(fj[0], fj[1]); g.rotate(L.toeA);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(-0.55, -0.25); g.lineTo(2.5, 0.25); g.lineTo(2.2, 0.62); g.lineTo(-0.3, 0.6); g.closePath(); g.fill();
    if (real) { g.strokeStyle = 'rgba(150,70,70,0.45)'; g.lineWidth = 0.22; g.beginPath(); g.moveTo(0, 0.1); g.lineTo(2.3, 0.35); g.moveTo(0, 0.35); g.lineTo(2.0, 0.6); g.stroke(); }
    g.restore();
  };

  // ---- 그림자 ----
  if (p.shadow !== false) {
    const k = 1 / (1 + H0 * 0.06);
    ell(g, bx + 0.5, 0, 7.5 * k, 1.6 * k, 0, `rgba(40,25,10,${(0.22 * k).toFixed(3)})`);
  }

  // ---- 펼친 날개: 어깨에서 뒤쪽 기준으로 화면 안에서 위아래로 젓는다(만화식). 끝 30%는 검고 흰 점 ----
  const wingOpen = (near) => {
    const a0 = 0.4 + 1.0 * flap + (near ? 0 : 0.22), al = lerp(-0.1, a0, spread), L = lerp(9.4, 10.6, spread), cw = lerp(2.6, 3.6, spread);
    const s0 = T(SHO[0] + (near ? 0 : 0.5), SHO[1] - (near ? 0 : 0.5));
    g.save(); g.translate(s0[0], s0[1]); g.rotate(Math.PI + th + al); g.scale(1, -1); // 로컬 +x = 날개 끝, +y = 뒷가장자리
    const wing = new Path2D();
    wing.moveTo(-0.4, -0.7);
    wing.quadraticCurveTo(L * 0.42, -1.5, L, 0.25);
    wing.quadraticCurveTo(L * 0.8, 1.0, L * 0.56, cw * 0.55);
    wing.quadraticCurveTo(L * 0.25, cw * 1.05, -0.8, cw);
    wing.closePath();
    g.fillStyle = C(near ? GL.grey : GL.grey2); g.fill(wing);
    g.save(); g.clip(wing);
    g.fillStyle = C(GL.black); g.fillRect(L * 0.66, -3, L, 8);
    if (real) {
      ell(g, L * 0.86, 0.2, 0.42, 0.32, 0, '#ffffff'); ell(g, L * 0.74, 0.55, 0.36, 0.28, 0, '#ffffff'); // 흰 점
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath(); g.moveTo(-0.6, cw - 0.25); g.quadraticCurveTo(L * 0.25, cw * 1.0 - 0.25, L * 0.6, cw * 0.52 - 0.2); g.stroke(); // 흰 뒷가장자리
      g.strokeStyle = 'rgba(70,85,100,0.3)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(0.5, 0.6); g.quadraticCurveTo(L * 0.35, 0.3, L * 0.62, 0.7); g.stroke(); // 깃 결
    }
    g.restore();
    g.restore();
  };
  if (spread > 0.05) wingOpen(false);

  // ---- 다리(뿌리는 몸에 가린다). 앉으면 몸 밑에 접혀 안 보인다 ----
  if (ly < 0.6) { drawLeg(LF, GL.legFar); drawLeg(LN, GL.leg); }

  // ---- 머리 위치: 서기 → 먹기·물(땅) → 앉기(움츠림) → 깃 고르기 → 날기 ----
  let hb = 0;
  if (moving) { const v = (u * 2) % 1; hb = v < 0.6 ? 1.0 - 2.0 * (v / 0.6) : -1.0 + 2.0 * ss((v - 0.6) / 0.4); }
  const bob = spring('hb', hb, 320, 24);
  const cyc = (t % 13) / 13, idle = !moving && !fly ? (1 - down) * (1 - ly) : 0;
  const preen = idle * ss((cyc - 0.58) / 0.04) * ss((0.76 - cyc) / 0.04);
  const shuffle = idle * ss((cyc - 0.84) / 0.025) * ss((0.93 - cyc) / 0.025);
  const look = 0.1 * Math.sin(r.look * 0.5) + 0.06 * Math.sin(r.look * 1.3);
  const peck = p.st === 'eat' ? Math.max(0, Math.sin(t * TAU * 1.6)) ** 3 : 0;
  const sip = p.st === 'drink' ? ss(0.5 + 0.9 * Math.sin(t * TAU * 0.45)) : 0; // 0 = 담금, 1 = 들어 삼키기
  let hc = T(5.6 + (moving ? 0.6 : 0), -4.6), ha = look * idle + r.head.x;
  hc[0] += bob;
  const gA = p.st === 'drink' ? lerp(1.15, -0.45, sip) : 1.1 + peck * 0.15;
  const tipAt = (x, y, a) => [x - (5.0 * Math.cos(a) - 0.3 * Math.sin(a)), y - (5.0 * Math.sin(a) + 0.3 * Math.cos(a))]; // 부리 끝이 (x, y)에 오도록 머리 중심
  const gEat = tipAt(bx + 10.2, -0.15 - (1 - peck) * 0.9, gA), gDrink = sip > 0 ? [lerp(tipAt(bx + 10.2, 0.1, gA)[0], bx + 7.0, sip), lerp(tipAt(bx + 10.2, 0.1, gA)[1], -6.6, sip)] : tipAt(bx + 10.2, 0.1, gA);
  const gnd = p.st === 'drink' ? gDrink : gEat;
  hc = [lerp(hc[0], gnd[0], down), lerp(hc[1], gnd[1], down)]; ha = lerp(ha, gA, down);
  const sit = T(4.2, -3.3); hc = [lerp(hc[0], sit[0], ly), lerp(hc[1], sit[1], ly)]; ha = lerp(ha, 0.35, ly);
  if (preen > 0) { const pr = T(1.6, -4.0 + 0.3 * Math.sin(t * TAU * 3)); hc = [lerp(hc[0], pr[0], preen), lerp(hc[1], pr[1], preen)]; ha = preen > 0.5 ? 0.75 + 0.15 * Math.sin(t * TAU * 3) : ha; } // 고개를 뒤로 돌려 날개깃을 부리로 고른다
  if (fly) { const fh = T(5.8, -3.0); const k = spread; hc = [lerp(hc[0], fh[0], k), lerp(hc[1], fh[1], k)]; ha = lerp(ha, 0.12 - pitch * 0.6, k); }
  if (moving) ha += 0.05 * Math.sin(u * TAU * 2);
  springTo(r.head, (hb - bob) * 0.05, 60, 8, dt);

  // ---- 목(흰색, 굵다) + 몸통 ----
  const nb = T(...NB);
  taper(g, nb[0], nb[1], hc[0] - 0.3, hc[1] + 0.3, 4.4, 3.4, GL.body);
  g.save(); g.translate(bx, by); g.rotate(th); g.scale(1 + 0.01 * breath + ly * 0.03, 1 + 0.02 * breath + ly * 0.04);
  g.fillStyle = C(GL.body); g.fill(BODY);
  if (real) {
    g.save(); g.clip(BODY);
    g.fillStyle = GL.grey; g.beginPath(); g.ellipse(-1.5, -2.9, 6.2, 1.5, -0.08, 0, TAU); g.fill(); // 회색 등
    g.fillStyle = 'rgba(120,135,150,0.2)'; g.beginPath(); g.ellipse(-0.5, 2.9, 6.5, 1.4, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.restore();
  }
  // 접은 날개(날 땐 펼친 날개로 바뀐다). 날개 추스르기 땐 살짝 들었다 놓는다
  const fold = 1 - spread;
  if (fold > 0.05) {
    g.save(); g.translate(SHO[0], SHO[1]); g.rotate(-0.16 * shuffle); g.scale(lerp(1, 0.45, spread), 1); g.translate(-SHO[0], -SHO[1]);
    g.fillStyle = C(GL.grey); g.fill(WING);
    g.save(); g.clip(WING);
    g.fillStyle = C(GL.black); g.fillRect(-11, -4, 4.9 + (moving ? 0.1 * Math.sin(u * TAU * 2) : 0), 6);
    if (real) {
      ell(g, -8.0, -1.2, 0.45, 0.3, 0, '#ffffff'); ell(g, -9.6, -0.95, 0.4, 0.26, 0, '#ffffff'); // 날개 끝 흰 점
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-1.2, -2.85); g.quadraticCurveTo(-3.8, -2.6, -5.6, -1.85); g.stroke(); // 셋째날개깃 흰 초승달
      g.beginPath(); g.moveTo(2.6, 0.55); g.quadraticCurveTo(-1.5, 1.05, -4.7, 0.45); g.stroke(); // 흰 뒷가장자리
      g.strokeStyle = 'rgba(80,95,110,0.35)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(2.2, -1.0); g.quadraticCurveTo(-1.5, -1.4, -4.8, -0.5); g.stroke(); // 깃 결
    }
    g.restore();
    g.restore();
  }
  g.restore();
  if (spread > 0.05) wingOpen(true);

  // ---- 머리: 둥근 흰 머리, 갈고리 노란 부리(아랫부리에 빨간 점), 빨간 눈테 ----
  g.save(); g.translate(hc[0], hc[1]); if (preen > 0.5) g.scale(-1, 1); g.rotate(ha);
  ell(g, 0, 0, 2.25, 2.0, 0, GL.body);
  if (real) { g.fillStyle = 'rgba(150,160,170,0.18)'; g.beginPath(); g.ellipse(-0.6, 0.9, 1.4, 0.9, 0, 0, TAU); g.fill(); }
  g.fillStyle = C(GL.beak); g.beginPath(); // 윗부리(끝이 아래로 굽는다)
  g.moveTo(1.5, -0.7); g.quadraticCurveTo(3.9, -0.75, 4.8, -0.2); g.quadraticCurveTo(5.25, 0.25, 4.75, 0.6); g.lineTo(1.7, 0.3); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(1.7, 0.3); g.lineTo(4.5, 0.5); g.quadraticCurveTo(4.0, 1.05, 3.55, 1.05); g.quadraticCurveTo(2.5, 0.95, 1.5, 0.85); g.closePath(); g.fill(); // 아랫부리
  if (real) ell(g, 3.85, 0.72, 0.36, 0.3, 0, GL.spot);
  const closed = r.blink > 0 || ly > 0.6;
  if (real && !closed) ell(g, 0.75, -0.55, 0.62, 0.62, 0, GL.ring);
  eye(g, 0.75, -0.55, 0.5, closed);
  g.restore();
}
