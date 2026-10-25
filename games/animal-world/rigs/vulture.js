// 독수리(사막 독수리) 리그: 짙은 갈색 몸과 넓은 날개(끝은 손가락처럼 갈라진 첫째날개깃), 털 없는 분홍빛 머리·목, 끝이 굽은 연한 부리,
// 목 아래 흰 깃 목도리, 비늘 진 회색 다리와 검은 발톱.
// 걷기(뒤뚱 2박, 뒤로 굽는 발목 IK, 몸이 좌우로 구르듯 기울고 머리는 멈췄다 쑥)·쉬기(웅크린 자세, 날개 살짝 처짐, 두리번, 가끔 날개를 반쯤 펴고 햇볕 쬐기)
// ·먹기(땅의 먹이를 물고 홱 잡아당기기)·물(부리 담갔다 고개 젖혀 삼키기)·눕기(주저앉아 목을 목도리에 파묻고 눈 감기)
// ·특수 행동(날개를 활짝 펴고 크게 몇 번 날갯짓해 떠올라 활공, 발을 내밀고 내려앉아 날개 접기).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 6; // 한 걸음 주기(두 발 한 번씩) 동안 몸이 나아가는 거리
export const BOX = [11, 26];
const TAU = Math.PI * 2;
const DUTY = 0.6;
const VT = {
  body: '#4b3527', body2: '#5f4434', cov: '#6b4e3b', cov2: '#46322a', flight: '#7d6a59', flightFar: '#5e4e41', finger: '#33251c', fingerFar: '#2a1f18',
  ruff: '#efe6d6', ruff2: '#d3c6b0', skin: '#dc9a8a', skin2: '#c47a6a', beak: '#efe3c6', beak2: '#b9a684', leg: '#a9a5a0', legFar: '#87837e', claw: '#2e2724', eye: '#2a1810',
};
const ROOT = [0.4, 4.4], NB = [6.0, -4.4], SHO = [3.6, -4.2]; // 몸 좌표: 다리 뿌리, 목 뿌리(목도리), 어깨(날개 뿌리)
const LEG = { a: 4.6, b: 4.4 };
const FLY = 11.5; // 날아오르는 높이
const WL = 18, WC = 6.0; // 펼친 날개 길이·폭

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

let BODY = null, WING = null, OPEN = null, FING = null;
function paths() {
  if (BODY) return;
  BODY = new Path2D(); // 몸 좌표(몸 중심 기준, +x = 가슴 쪽): 목 뿌리 → 둥근 가슴 → 배 → 꽁지 → 등
  BODY.moveTo(6.4, -4.2);
  BODY.bezierCurveTo(8.6, -1.6, 8.0, 3.6, 3.6, 5.6);
  BODY.quadraticCurveTo(-1.4, 7.0, -5.6, 4.4);
  BODY.lineTo(-12.2, 2.4); BODY.lineTo(-12.6, 0.4); BODY.lineTo(-9.0, -0.4); // 짧고 네모난 꽁지
  BODY.quadraticCurveTo(-7.6, -5.0, -2.0, -6.2);
  BODY.quadraticCurveTo(3.6, -6.8, 6.4, -4.2);
  BODY.closePath();
  WING = new Path2D(); // 접은 날개(몸 옆면): 어깨 → 등 → 꽁지 너머 날개 끝 → 아래 가장자리
  WING.moveTo(5.6, -4.8);
  WING.quadraticCurveTo(-1.5, -7.2, -7.5, -3.8);
  WING.quadraticCurveTo(-11.5, -1.2, -14.6, 1.6);
  WING.quadraticCurveTo(-10.4, 2.6, -6.6, 3.6);
  WING.quadraticCurveTo(-0.4, 4.8, 4.6, 2.4);
  WING.quadraticCurveTo(7.0, 0.4, 5.6, -4.8);
  WING.closePath();
  // 펼친 날개(날개 좌표: 어깨 = 원점, +x = 날개 끝, +y = 뒷가장자리)
  OPEN = new Path2D(); // 팔(넓은 안쪽 날개) + 손(조금 좁아짐). 끝의 손가락 깃은 FING
  OPEN.moveTo(-0.6, -0.9);
  OPEN.quadraticCurveTo(WL * 0.42, -1.7, WL * 0.72, -0.7);
  OPEN.quadraticCurveTo(WL * 0.76, WC * 0.4, WL * 0.73, WC * 0.86);
  for (let i = 0; i < 7; i++) { const x0 = WL * (0.72 - i * 0.104), x1 = x0 - WL * 0.104; OPEN.quadraticCurveTo((x0 + x1) / 2, WC * (1.1 - i * 0.004), x1, WC * (0.98 + i * 0.006)); } // 둘째날개깃 가장자리(잔물결)
  OPEN.lineTo(-0.8, WC * 0.78);
  OPEN.closePath();
  FING = []; // 손가락처럼 갈라진 첫째날개깃 6장(거의 나란히, 살짝 벌어진다)
  for (let i = 0; i < 5; i++) {
    const a = -0.12 + i * 0.09, L = WL * (0.31 - Math.abs(i - 1.5) * 0.025), w = 0.7, f = new Path2D();
    const bx = WL * 0.64, by = WC * (0.04 + i * 0.19), c = Math.cos(a), s = Math.sin(a);
    f.moveTo(bx - s * w, by + c * w); f.quadraticCurveTo(bx + c * L * 0.7 - s * w, by + s * L * 0.7 + c * w, bx + c * L, by + s * L);
    f.quadraticCurveTo(bx + c * L * 0.7 + s * w, by + s * L * 0.7 - c * w, bx + s * w, by - c * w); f.closePath();
    FING.push(f);
  }
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C, taper } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const fly = sp >= 0, moving = p.mv > 0 && !fly, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  const restT = p.st === 'rest' ? 1 : 0, ly = fly ? 0 : Math.max(p.ly ?? 0, dt > 0 ? clamp01(spring('rest', restT, 20, 9)) : restT);
  const eat = p.st === 'eat' ? hd * (1 - ly) : 0, drink = p.st === 'drink' ? hd * (1 - ly) : 0, down = Math.max(eat, drink);
  const breath = Math.sin((t * TAU) / 3.4);
  const idle = !moving && !fly && p.st === 'idle', cyc = (t % 21) / 21;
  const sun = idle ? env(cyc, 0.55, 0.62, 0.84, 0.9) : 0; // 가끔 날개를 반쯤 펴고 햇볕 쬐기

  // ---- 날기(특수): 활짝 펴기 → 크게 날갯짓하며 떠오르기 → 활공 → 발 내밀고 내려앉기 → 접기 ----
  let spread = 0, lift = 0, flap = 0, crouch = 0, legFwd = 0, dangle = 0, pitch = 0, glide = 0;
  if (fly) {
    spread = ss(sp / 0.07) * ss((1 - sp) / 0.07);
    const up = ss((sp - 0.12) / 0.26), dn = ss((sp - 0.64) / 0.22);
    lift = up * (1 - dn);
    glide = ss((sp - 0.4) / 0.06) * ss((0.64 - sp) / 0.06);
    const amp = ss((sp - 0.08) / 0.04) * (1 - 0.85 * glide) * (1 - ss((sp - 0.86) / 0.04));
    flap = Math.sin((sp - 0.08) * TAU * 7.5) * amp; // 크고 느린 날갯짓
    crouch = env(sp, 0.06, 0.09, 0.11, 0.14) + 0.7 * env(sp, 0.84, 0.87, 0.89, 0.94);
    dangle = ss((sp - 0.16) / 0.08) * (1 - ss((sp - 0.62) / 0.1));
    legFwd = ss((sp - 0.66) / 0.1) * (1 - ss((sp - 0.86) / 0.03));
    pitch = 0.22 * ss((sp - 0.1) / 0.06) * (1 - ss((sp - 0.32) / 0.1)) + 0.28 * glide - 0.12 * legFwd; // 날 땐 몸을 앞으로 눕힌다
  }
  const H0 = lift * (FLY + 0.9 * Math.sin(sp * TAU * 2.5));
  const open = Math.max(spread, sun * 0.85);

  // ---- 몸 위치·기울기(가슴을 든 웅크린 자세) ----
  let bx = -0.4, by = -12.6, th = -0.36;
  if (moving) { by += 0.45 * Math.cos(u * TAU * 2); th += 0.07 * Math.sin(u * TAU); bx += 0.25 * Math.sin(u * TAU); } // 뒤뚱 구르기
  if (!moving && !fly) by += 0.1 * breath;
  by += down * 1.2; th += eat * 0.55 + drink * 0.45;
  by = lerp(by, -6.2, ly); th = lerp(th, -0.22, ly);
  by += crouch * 1.4 - H0; th += pitch;
  const ca = Math.cos(th), sa = Math.sin(th), T = (x, y) => [bx + ca * x - sa * y, by + sa * x + ca * y];

  // ---- 다리: 뒤로 굽는 발목(IK, bend -1), 깃털 바지 + 비늘 진 회색 발목 + 발가락 ----
  const root = T(...ROOT), rootF = T(ROOT[0] + 1.0, ROOT[1] - 0.3);
  const legOf = (rt, off, dx) => {
    let f = { x: dx, y: 0, sw: 0 };
    if (moving) { const q = footAt((u + off) % 1, STRIDE * DUTY, 1.6, DUTY); f = { x: q.x + dx, y: q.y, sw: q.sw }; }
    let foot = [bx + ROOT[0] + 0.6 + f.x, -0.7 + f.y], toeA = f.sw * 0.7;
    if (fly && lift > 0.001) {
      const hang = [rt[0] - 3.0 + legFwd * 5.6 + dx * 0.3, rt[1] + 5.0 - legFwd * 0.6];
      const k = clamp01(lift * 3);
      foot = lerp2(foot, hang, k); toeA = lerp(toeA, 1.0 * dangle - 0.15 * legFwd, k);
    }
    const { knee } = ik(rt[0], rt[1], foot[0], foot[1], LEG.a, LEG.b, -1);
    return { pts: [rt, knee, foot], toeA };
  };
  const LN = legOf(root, 0, 0.2), LF = legOf(rootF, 0.5, 1.3);
  const drawLeg = (L, col, near) => {
    const [rt, an, fj] = L.pts;
    bones(g, C, [an, fj], [1.5, 1.2], col); // 비늘 진 발목
    if (real && near) { g.strokeStyle = 'rgba(70,65,60,0.4)'; g.lineWidth = 0.22; g.beginPath(); for (let k = 1; k < 5; k++) { const q = lerp2(an, fj, k / 5); g.moveTo(q[0] - 0.65, q[1]); g.lineTo(q[0] + 0.65, q[1] + 0.15); } g.stroke(); }
    // 발가락: 앞으로 둘(보이는 것), 뒤로 하나, 끝에 검은 발톱
    g.save(); g.translate(fj[0], fj[1]); g.rotate(L.toeA);
    bones(g, C, [[0, 0], [2.6, 0.55]], [0.95, 0.55], col); bones(g, C, [[0, 0], [2.1, 0.75]], [0.85, 0.5], col); bones(g, C, [[0, 0], [-1.3, 0.55]], [0.8, 0.5], col);
    ell(g, 2.75, 0.75, 0.42, 0.26, 0.9, VT.claw); ell(g, 2.25, 0.95, 0.38, 0.24, 0.9, VT.claw); ell(g, -1.45, 0.75, 0.36, 0.22, -0.6, VT.claw);
    g.restore();
    ell(g, rt[0] + (an[0] - rt[0]) * 0.45, rt[1] + (an[1] - rt[1]) * 0.45, 2.0, 2.9, Math.atan2(an[1] - rt[1], an[0] - rt[0]) - Math.PI / 2, near ? VT.body2 : VT.body); // 깃털 바지
  };

  // ---- 그림자 ----
  if (p.shadow !== false) {
    const k = 1 / (1 + H0 * 0.06);
    ell(g, bx, 0, 10 * k, 2.2 * k, 0, `rgba(40,25,10,${(0.22 * k).toFixed(3)})`);
  }

  // ---- 펼친 날개: 어깨에서 화면 안에서 위아래로 젓는다(만화식). 손가락 첫째날개깃 ----
  const wingOpen = (near) => {
    const dsp = fly ? env(sp, 0, 0.04, 0.08, 0.13) : 0; // 날기 전 날개를 V자로 활짝 펴 보이기
    const sunA = near ? 0.3 : 0.95, flyA = lerp(0.4 + 0.75 * flap - 0.05 * glide, 1.0, dsp) + (near ? 0 : lerp(0.42, 0.9, dsp));
    let al = lerp(sunA, flyA, spread / Math.max(open, 1e-3));
    if (H0 < 5) al = Math.max(al, near ? -0.15 : 0.2); // 땅 가까이선 날개 끝이 땅에 닿지 않게
    al = lerp(-0.2, al, open);
    const L = lerp(0.45, 1, open), s0 = T(SHO[0] + (near ? 0 : 0.6), SHO[1] - (near ? 0 : 0.6));
    g.save(); g.translate(s0[0], s0[1]); g.rotate(Math.PI + 0.3 * th + al); g.scale(L, -1);
    g.fillStyle = C(near ? VT.flight : VT.flightFar); g.fill(OPEN);
    g.fillStyle = C(near ? VT.finger : VT.fingerFar); for (const f of FING) g.fill(f);
    if (real) {
      g.save(); g.clip(OPEN);
      g.fillStyle = near ? VT.cov2 : VT.body; g.beginPath(); g.moveTo(-1, -2); g.quadraticCurveTo(WL * 0.4, -2.6, WL * 0.78, -1.6); g.lineTo(WL * 0.7, WC * 0.36); g.quadraticCurveTo(WL * 0.35, WC * 0.56, -1, WC * 0.46); g.closePath(); g.fill(); // 덮깃(짙은 앞쪽)
      g.restore();
    }
    g.restore();
  };
  if (open > 0.05) wingOpen(false);

  // ---- 다리(눕으면 몸 밑에 접혀 안 보인다) ----
  if (ly < 0.6) drawLeg(LF, VT.legFar, false);

  // ---- 몸통 ----
  g.save(); g.translate(bx, by); g.rotate(th); g.scale(1 + 0.012 * breath + ly * 0.04, 1 + 0.02 * breath + ly * 0.05);
  g.fillStyle = C(VT.body); g.fill(BODY);
  if (real) {
    g.save(); g.clip(BODY);
    g.strokeStyle = 'rgba(25,15,8,0.3)'; g.lineWidth = 0.35; g.lineCap = 'round'; g.beginPath(); // 가슴 깃 비늘
    for (const [x, y] of [[5.5, 0.5], [6.3, 2.4], [3.6, 3.6], [4.6, -1.6], [1.4, 5.0]]) { g.moveTo(x + 0.9, y); g.arc(x, y, 0.9, 0, Math.PI); }
    g.stroke();
    g.fillStyle = 'rgba(255,235,210,0.08)'; g.beginPath(); g.ellipse(-2, -5.4, 7, 1.3, -0.05, 0, TAU); g.fill();
    g.restore();
  }
  g.restore();
  if (ly < 0.6) drawLeg(LN, VT.leg, true);
  // 접은 날개(펼치면 줄어든다). 쉴 땐 살짝 처진다
  g.save(); g.translate(bx, by); g.rotate(th); g.scale(1 + 0.012 * breath + ly * 0.04, 1 + 0.02 * breath + ly * 0.05);
  const fold = 1 - open;
  if (fold > 0.3) {
    const droop = (idle ? 0.06 : 0) + ly * 0.04;
    g.save(); g.translate(SHO[0], SHO[1]); g.rotate(droop + (moving ? 0.03 * Math.sin(u * TAU * 2) : 0)); g.scale(lerp(1, 0.4, open), 1); g.translate(-SHO[0], -SHO[1]);
    g.fillStyle = C(VT.body2); g.fill(WING);
    if (real) {
      g.save(); g.clip(WING);
      g.fillStyle = VT.cov; g.beginPath(); g.ellipse(0.6, -3.4, 6.6, 2.6, -0.12, 0, TAU); g.fill(); // 밝은 덮깃
      g.fillStyle = VT.finger; g.beginPath(); g.moveTo(-8, -3.2); g.quadraticCurveTo(-12, -0.6, -15, 1.8); g.lineTo(-9, 3.4); g.quadraticCurveTo(-7, 0, -8, -3.2); g.closePath(); g.fill(); // 날개 끝 짙은 첫째날개깃
      g.strokeStyle = 'rgba(25,15,8,0.4)'; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath(); // 깃 줄
      for (let i = 0; i < 5; i++) { const x = 2.6 - i * 2.4; g.moveTo(x, -1.0 + i * 0.3); g.quadraticCurveTo(x - 1.6, 0.6 + i * 0.4, x - 3.6, 1.5 + i * 0.5); }
      g.stroke();
      g.strokeStyle = 'rgba(255,240,220,0.18)'; g.lineWidth = 0.4; g.beginPath(); for (const [x, y] of [[3, -3.6], [0.8, -4.2], [-1.4, -4.2], [-3.4, -3.6]]) { g.moveTo(x + 1, y); g.arc(x, y, 1, 0, Math.PI); } g.stroke(); // 덮깃 비늘
      g.restore();
    }
    g.restore();
  }
  g.restore();

  // ---- 머리 위치: 웅크림 → 두리번 → 먹기(물고 잡아당기기) → 물(담갔다 젖히기) → 눕기(목도리에 파묻기) → 날기 ----
  let hb = 0;
  if (moving) { const v = (u * 2) % 1; hb = v < 0.6 ? 1.1 - 2.2 * (v / 0.6) : -1.1 + 2.2 * ss((v - 0.6) / 0.4); }
  const bob = spring('hb', hb, 300, 24);
  const nb = T(...NB);
  const look = 0.12 * Math.sin(r.look * 0.45) + 0.08 * Math.sin(r.look * 1.2);
  const backLook = idle && !sun ? env((t % 11) / 11, 0.3, 0.34, 0.46, 0.5) : 0; // 가끔 뒤를 돌아본다
  let hc = [nb[0] + 3.0 + (moving ? 0.6 : 0), nb[1] - 2.6 - (idle ? 0.8 * Math.max(0, Math.sin(r.look * 0.3)) : 0)], ha = (idle ? look : 0) + r.head.x;
  hc[0] += bob;
  // 먹기: 땅에 부리를 대고 있다가 홱 들어 올리며 뜯는다
  const tc = (t % 1.5) / 1.5, yank = p.st === 'eat' ? env(tc, 0.45, 0.55, 0.62, 0.85) : 0;
  const tipAt = (x, y, a) => [x - (4.4 * Math.cos(a) - 0.5 * Math.sin(a)), y - (4.4 * Math.sin(a) + 0.5 * Math.cos(a))]; // 부리 끝이 (x, y)에 오도록 머리 중심
  const gA = 1.2 - yank * 0.9, gEat = tipAt(bx + 13.2 - yank * 1.4, -0.3 - yank * 3.2, gA);
  const sip = p.st === 'drink' ? ss(0.5 + 0.9 * Math.sin(t * TAU * 0.42)) : 0; // 0 = 담금, 1 = 고개 젖혀 삼키기
  const dA = lerp(1.3, -0.6, sip), dTip = tipAt(bx + 13.2, 0.1, 1.3), gDrink = [lerp(dTip[0], nb[0] + 2.6, sip), lerp(dTip[1], nb[1] - 4.0, sip)];
  const gnd = p.st === 'drink' ? gDrink : gEat;
  hc = lerp2(hc, gnd, down); ha = lerp(ha, p.st === 'drink' ? dA : gA, down);
  hc = lerp2(hc, [nb[0] + 1.6, nb[1] - 0.6], ly); ha = lerp(ha, 0.35, ly); // 목을 목도리에 파묻는다
  if (fly) { const fh = T(9.6, -4.0); hc = lerp2(hc, fh, spread); ha = lerp(ha, 0.15 - pitch * 0.8, spread); }
  if (sun > 0) { hc = lerp2(hc, [nb[0] + 2.4, nb[1] - 3.6], sun); ha = lerp(ha, -0.1, sun); }
  if (moving) ha += 0.05 * Math.sin(u * TAU * 2);
  springTo(r.head, (hb - bob) * 0.05, 60, 8, dt);

  // ---- 목(털 없는 분홍): 목도리 속에서 머리까지 ----
  taper(g, nb[0] - 0.4, nb[1] + 0.4, hc[0] - 0.6, hc[1] + 0.4, 2.6, 1.9, VT.skin);
  if (real) { g.strokeStyle = 'rgba(150,80,70,0.35)'; g.lineWidth = 0.25; g.beginPath(); const m = lerp2(nb, hc, 0.5); g.moveTo(m[0] - 0.5, m[1] - 0.6); g.lineTo(m[0] + 0.3, m[1] + 0.7); g.stroke(); } // 목 주름
  // 흰 깃 목도리: 목 뿌리를 감싸는 복슬한 고리
  {
    const c = T(NB[0] - 0.7, NB[1] + 0.7), n = 22, R0 = 2.5 + ly * 0.5, rx = R0 * 1.25, ry = R0 * 0.95, rot = th - 0.5;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    g.fillStyle = C(VT.ruff); g.beginPath();
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = i % 2 ? 0.86 : 1.04, x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k; g.lineTo(c[0] + x * cr - y * sr, c[1] + x * sr + y * cr); }
    g.closePath(); g.fill();
    if (real) { ell(g, c[0] - 0.4 * cr - 1.0 * sr, c[1] - 0.4 * sr + 1.0 * cr, rx * 0.62, ry * 0.5, rot, VT.ruff2); ell(g, c[0] + 0.5 * sr, c[1] - 0.5 * cr, rx * 0.5, ry * 0.36, rot, VT.ruff); }
  }
  // 머리를 뒤로 돌려 볼 땐 좌우를 뒤집는다(몸 뒤쪽을 보는 모습)
  g.save(); g.translate(hc[0], hc[1]); if (backLook > 0.5) g.scale(-1, 1); g.rotate(ha);
  ell(g, 0, 0, 2.1, 1.75, 0, VT.skin);
  if (real) {
    g.fillStyle = VT.skin2; g.beginPath(); g.ellipse(-0.7, 0.8, 1.3, 0.8, 0.2, 0, TAU); g.fill(); // 볼 주름 그늘
    g.strokeStyle = 'rgba(140,70,60,0.45)'; g.lineWidth = 0.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(-1.4, -0.6); g.quadraticCurveTo(-0.9, 0.1, -1.3, 0.8); g.moveTo(-0.6, 1.2); g.quadraticCurveTo(0.2, 1.5, 0.9, 1.1); g.stroke(); // 주름
  }
  // 부리: 굵은 윗부리 끝이 아래로 갈고리처럼 굽는다(밑동은 분홍 납막)
  g.fillStyle = C(VT.beak); g.beginPath();
  g.moveTo(1.2, -1.0); g.quadraticCurveTo(3.4, -1.25, 4.3, -0.4); g.quadraticCurveTo(4.85, 0.35, 4.25, 1.05); g.quadraticCurveTo(4.15, 0.55, 3.75, 0.45); g.lineTo(1.4, 0.55); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(1.4, 0.55); g.lineTo(3.6, 0.6); g.quadraticCurveTo(3.4, 1.05, 2.9, 1.1); g.lineTo(1.3, 1.0); g.closePath(); g.fill(); // 아랫부리
  if (real) {
    ell(g, 1.55, -0.2, 0.75, 0.85, 0, VT.skin2); // 납막
    ell(g, 2.05, -0.3, 0.32, 0.14, 0, '#5a3a30'); // 콧구멍
    g.fillStyle = VT.beak2; g.beginPath(); g.moveTo(4.0, -0.5); g.quadraticCurveTo(4.85, 0.35, 4.25, 1.05); g.quadraticCurveTo(4.2, 0.4, 3.7, 0.2); g.closePath(); g.fill(); // 갈고리 끝(짙게)
  }
  const closed = r.blink > 0 || ly > 0.6;
  if (real && !closed) ell(g, 0.15, -0.55, 0.62, 0.55, 0, '#f2d6c8');
  eye(g, 0.15, -0.55, 0.44, closed);
  if (real && !closed) { g.strokeStyle = 'rgba(120,60,50,0.6)'; g.lineWidth = 0.28; g.beginPath(); g.moveTo(-0.6, -1.15); g.quadraticCurveTo(0.2, -1.45, 0.9, -1.05); g.stroke(); } // 눈두덩
  g.restore();

  if (open > 0.05) wingOpen(true);
}
