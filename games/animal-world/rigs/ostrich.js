// 타조(수컷) 리그: 두 발 걷기(2박, 디딤 0.6), 걸을 때 머리는 멈췄다가 앞으로 쑥(목 스프링), S자 목.
// 다리: 허벅지는 깃털 속, 보이는 긴 정강이(드럼스틱)가 아래 뒤로 내려가 뒤로 굽는 발목 → 긴 발등뼈 → 두 발가락.
// 쉬기(숨·깜빡임·두리번·목 흔들기)·먹기(목을 땅까지 숙여 쪼기)·물·눕기(다리 접고 앉기, 목은 세움)·특수 행동(날개 펼쳐 구애 춤).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 14; // 한 걸음 주기(두 발 한 번씩) 동안 몸이 나아가는 거리
export const BOX = [13, 56];
const TAU = Math.PI * 2;
const DUTY = 0.6;
const OS = { body: '#2f2823', body2: '#3d3530', fluff: '#4a403a', plume: '#f4f0e6', plume2: '#d8d1c4', skin: '#c9a49a', leg: '#d9a79a', beak: '#e2b07a', claw: '#5a4a40' };
const ROOT = [1.5, 5.5], NB = [9.4, -3.6]; // 몸 좌표: 다리 뿌리(깃털 속 무릎), 목 뿌리
const LEG = { a: 13.5, b: 12.5 };

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
const cub = (a, b, c, d, s) => { const m = 1 - s; return m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c + s * s * s * d; };
const cubD = (a, b, c, d, s) => { const m = 1 - s; return 3 * m * m * (b - a) + 6 * m * s * (c - b) + 3 * s * s * (d - c); };

let BODY = null, WING = null;
function paths() {
  if (BODY) return;
  BODY = new Path2D(); // 몸 좌표(몸 중심 기준): 가슴 → 둥근 등 → 엉덩이 → 아래 깃털 술 → 가슴
  BODY.moveTo(10.5, -3.8);
  BODY.bezierCurveTo(8.5, -9.4, -3, -10.2, -8.5, -7.8);
  BODY.quadraticCurveTo(-13.5, -5.4, -14, -1.2);
  BODY.quadraticCurveTo(-14, 3.6, -9.6, 6.0);
  BODY.quadraticCurveTo(-7.5, 8.6, -5.6, 6.6);
  BODY.quadraticCurveTo(-3.6, 8.8, -1.6, 6.8);
  BODY.quadraticCurveTo(0.4, 8.8, 2.4, 6.7);
  BODY.quadraticCurveTo(4.6, 8.4, 6.6, 6.0);
  BODY.quadraticCurveTo(11.4, 3.6, 11.6, -0.2);
  BODY.quadraticCurveTo(11.6, -2.4, 10.5, -3.8);
  BODY.closePath();
  WING = new Path2D(); // 접은 날개(몸 옆면)
  WING.moveTo(7.5, -4.6);
  WING.quadraticCurveTo(-1, -8.6, -9.5, -4.6);
  WING.quadraticCurveTo(-12.5, -0.5, -8.5, 3.4);
  WING.quadraticCurveTo(0.5, 4.8, 7.5, -4.6);
  WING.closePath();
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C, shade } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, ly = p.ly ?? 0, sp = p.sp ?? -1, real = H.real();
  const dance = sp >= 0, moving = p.mv > 0 && !dance, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  const breath = Math.sin(t * TAU / 3.6);
  const farLeg = shade(OS.leg, 0.76);

  // ---- 몸 위치·기울기 ----
  const dc = dance ? ss(sp / 0.08) * ss((1 - sp) / 0.08) : 0, w = sp * TAU * 4; // 춤: 4박자
  const eat = hd * (1 - ly);
  let bx = -1, by = -31, th = 0;
  if (moving) { by += 0.8 * Math.cos(u * TAU * 2); th = 0.03 * Math.sin(u * TAU); }
  by += eat * 2.2; th += eat * 0.28;
  by = lerp(by, -9.6, ly); th = lerp(th, -0.04, ly);
  by += dc * 7; th += dc * (0.12 + 0.08 * Math.sin(w)); bx += dc * 1.3 * Math.sin(w);
  const ca = Math.cos(th), sa = Math.sin(th), T = (x, y) => [bx + ca * x - sa * y, by + sa * x + ca * y];
  const sway = moving || dance || ly > 0.5 ? 0 : Math.sin(t * 0.7);

  // ---- 다리: 뒤로 굽는 발목(2-bone IK, bend -1) ----
  const root = T(...ROOT), rootF = T(ROOT[0] + 1.6, ROOT[1] - 0.4);
  const legPts = (rt, foot) => { const { knee, end } = ik(rt[0], rt[1], foot[0], foot[1], LEG.a, LEG.b, -1); return [rt, knee, end]; }; // 뿌리 → 발목(뒤로 굽음) → 발
  const stepFoot = (off, dx) => {
    if (!moving) return { x: dx, y: 0, sw: 0 };
    const f = footAt((u + off) % 1, STRIDE * DUTY, 4.5, DUTY);
    return { x: f.x + dx, y: f.y, sw: f.sw };
  };
  const legOf = (rt, off, dx, stamp) => {
    const f = stepFoot(off, dx), fy = -0.9 + f.y - stamp;
    const foot = [bx + ROOT[0] + f.x, fy], toeA = 0.15 + f.sw * 1.1 + stamp * 0.3; // 들면 발가락이 아래로 오므라든다
    if (ly > 0.5) return { pts: [rt, [rt[0] - 6.5, -1.4], [rt[0] + 3.6, -0.9]], toeA: 0.05 }; // 앉기: 발등뼈를 땅에 눕히고 발목(뒤꿈치)은 뒤, 발가락은 앞
    return { pts: legPts(rt, foot), toeA };
  };
  const stampN = dance ? 2.2 * Math.max(0, Math.sin(w)) ** 3 * dc : 0, stampF = dance ? 2.2 * Math.max(0, Math.sin(w + Math.PI)) ** 3 * dc : 0;
  const LN = legOf(root, 0, 0.6, stampN), LF = legOf(rootF, 0.5, 1.8, stampF);
  const drawLeg = (L, col, near) => {
    const [rt, an, fj] = L.pts;
    bones(g, C, [rt, an], [5.8, 2.4], col); // 드럼스틱(위가 굵다)
    bones(g, C, [an, fj], [2.3, 1.8], col); // 발등뼈
    ell(g, an[0], an[1], 1.6, 1.6, 0, col); // 뒤로 굽는 발목 관절
    // 두 발가락: 큰 셋째 발가락(앞) + 작은 넷째 발가락
    const a = L.toeA, t1 = [fj[0] + Math.cos(a) * 4.3, fj[1] + Math.sin(a) * 4.3 + 0.4], t2 = [fj[0] + Math.cos(a + 0.35) * 2.8, fj[1] + Math.sin(a + 0.35) * 2.8 + 0.4];
    bones(g, C, [fj, t2], [1.6, 0.9], shade(col, 0.88));
    bones(g, C, [fj, t1], [1.9, 1.1], col);
    if (real) {
      ell(g, t1[0] + Math.cos(a) * 0.5, t1[1] + Math.sin(a) * 0.5, 0.7, 0.45, a, OS.claw);
      if (near) { g.strokeStyle = 'rgba(190,80,80,0.35)'; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(an[0] + 0.5, an[1] + 1.5); g.lineTo(fj[0] + 0.6, fj[1] - 1.2); g.stroke(); } // 발등 비늘(수컷은 붉다)
    }
  };

  // ---- 그림자 ----
  if (p.shadow !== false) {
    ell(g, bx + 1, 0, 11, 2.6, 0, 'rgba(40,25,10,0.22)');
    if (real && ly < 0.5) for (const L of [LN, LF]) { const fj = L.pts[2]; if (fj[1] > -1.5) ell(g, fj[0] + 2, 0.15, 3.2, 0.7, 0, 'rgba(40,25,10,0.25)'); }
  }

  // ---- 날개(춤): 부채처럼 펼쳐 번갈아 들어 올린다 ----
  const wingFan = (side) => {
    const lift = Math.sin(w + (side > 0 ? 0 : Math.PI)); // 1이면 높이 든 날개
    const base = T(-0.5 + (side > 0 ? 0 : 1.2), -6.6), gam = -2.3 + 0.6 * lift + th, spread = (0.5 + 0.12 * lift) * dc, R = (13 + 2.5 * lift) * dc;
    const dark = side > 0 ? OS.body2 : shade(OS.body2, 0.78), white = side > 0 ? OS.plume : OS.plume2;
    g.fillStyle = C(dark); g.beginPath(); g.moveTo(base[0], base[1]); g.arc(base[0], base[1], R * 0.9, gam - spread, gam + spread); g.closePath(); g.fill();
    for (let i = 0; i < 6; i++) {
      const a = gam - spread + (2 * spread * i) / 5, L = R * (0.9 + 0.05 * Math.sin(i * 2.1 + w));
      ell(g, base[0] + Math.cos(a) * L, base[1] + Math.sin(a) * L, R * 0.17 + 0.2, 1.5 * dc + 0.2, a, white);
    }
  };
  if (dc > 0.05) wingFan(-1);

  // ---- 먼 쪽 다리, 꼬리 깃(흰색) ----
  drawLeg(LF, farLeg, false);
  const tailUp = eat * 0.35 + (moving ? 0.06 * Math.sin(u * TAU * 2) : 0) + dc * 0.3;
  for (const [x, y, rx, ry, a] of [[-14.2, -5.4, 3.4, 1.7, -0.5], [-14.8, -3.2, 3.2, 1.5, -0.15], [-13.2, -7.4, 2.9, 1.4, -0.85]]) {
    const q = T(x, y), sw2 = (moving ? Math.sin(u * TAU * 2 + 1) * 0.08 : 0);
    ell(g, q[0], q[1], rx, ry, a + th - tailUp + sw2, OS.plume);
  }

  // ---- 가까운 쪽 다리(뿌리는 깃털 속으로 숨는다) ----
  drawLeg(LN, OS.leg, true);

  // ---- 목(S자, 머리 끄덕임은 스프링) ----
  const nb = T(...NB);
  let hb = 0;
  if (moving) { const v = (u * 2) % 1; hb = v < 0.62 ? 1.7 - 3.4 * (v / 0.62) : -1.7 + 3.4 * ss((v - 0.62) / 0.38); }
  const bob = spring('hb', hb, 320, 24);
  // 머리 위치: 서 있기 → 먹기(땅) → 앉기 → 춤
  const peck = p.st === 'eat' ? Math.max(0, Math.sin(t * TAU * 1.3)) ** 2 : 0, dip = p.st === 'drink' ? 0.5 + 0.5 * Math.sin(t * TAU * 0.6) : 0;
  let hc = [nb[0] + 3.8 + sway * 0.8 + (moving ? 1.6 : 0), nb[1] - 19.5 + (moving ? 1.2 : 0)];
  const ground = [nb[0] + 8.6 - peck * 0.6, -6.4 + peck * 0.55 + dip * 0.5];
  hc = [lerp(hc[0], ground[0], eat), lerp(hc[1], ground[1], eat)];
  hc = [lerp(hc[0], nb[0] + 2.6, ly), lerp(hc[1], nb[1] - 16.5, ly)];
  if (dc > 0) hc = [lerp(hc[0], nb[0] + 1 + 3.5 * Math.sin(w + 0.9), dc), lerp(hc[1], nb[1] - 15 + 1.2 * Math.cos(w * 2), dc)];
  hc[0] += bob;
  springTo(r.head, (hb - bob) * 0.06 + (dc > 0 ? 0 : sway * 0.03), 60, 8, dt); // 머리를 내밀 땐 살짝 숙였다 든다
  const c1 = [lerp(nb[0] + 4.8 + sway * 0.6, nb[0] + 6.5, eat), lerp(nb[1] - 5.2, nb[1] - 3.0, eat)];
  const c2 = [lerp(hc[0] - 3.8 + bob * 0.4 - sway * 0.4, hc[0] - 1.5, eat), lerp(hc[1] + 6.8, hc[1] - 8.5, eat)];
  if (dc > 0) { c1[0] += dc * 1.5 * Math.sin(w); c2[0] += dc * 3 * Math.sin(w + 2); }
  const N = 10, Ls = [], Rs = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, x = cub(nb[0], c1[0], c2[0], hc[0], s), y = cub(nb[1], c1[1], c2[1], hc[1], s);
    const dx = cubD(nb[0], c1[0], c2[0], hc[0], s), dy = cubD(nb[1], c1[1], c2[1], hc[1], s), L = Math.hypot(dx, dy) || 1;
    const hw = (2.1 + 2.6 * (1 - s) * (1 - s)) / 2, nx = -dy / L * hw, ny = dx / L * hw;
    Ls.push([x + nx, y + ny]); Rs.push([x - nx, y - ny]);
  }
  g.fillStyle = C(OS.skin); g.beginPath(); g.moveTo(Ls[0][0], Ls[0][1]);
  for (const q of Ls) g.lineTo(q[0], q[1]);
  for (let i = Rs.length - 1; i >= 0; i--) g.lineTo(Rs[i][0], Rs[i][1]);
  g.closePath(); g.fill();
  if (real) { // 목 뒤쪽 그늘
    g.strokeStyle = 'rgba(110,70,70,0.22)'; g.lineWidth = 0.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(Rs[2][0], Rs[2][1]);
    for (let i = 3; i < Rs.length - 1; i++) g.lineTo(Rs[i][0] * 0.7 + Ls[i][0] * 0.3, Rs[i][1] * 0.7 + Ls[i][1] * 0.3);
    g.stroke();
  }
  // 목 아래 흰 깃 고리(수컷)
  const ring = [cub(nb[0], c1[0], c2[0], hc[0], 0.2), cub(nb[1], c1[1], c2[1], hc[1], 0.2)];
  ell(g, ring[0], ring[1], 2.4, 1.0, Math.atan2(cubD(nb[1], c1[1], c2[1], hc[1], 0.2), cubD(nb[0], c1[0], c2[0], hc[0], 0.2)) + Math.PI / 2, OS.plume);

  // ---- 몸통 ----
  g.save(); g.translate(bx, by); g.rotate(th); g.scale(1 + 0.01 * breath, 1 + 0.02 * breath);
  g.fillStyle = C(OS.body); g.fill(BODY);
  if (real) {
    g.save(); g.clip(BODY);
    g.strokeStyle = OS.fluff; g.lineWidth = 0.8; g.lineCap = 'round';
    g.beginPath(); for (const [x, y] of [[6, 1], [2, 3.5], [-3, 4], [-8, 2.5], [8.5, -1.5]]) { g.moveTo(x + 2.2 * Math.cos(0.3), y + 2.2 * Math.sin(0.3)); g.arc(x, y, 2.2, 0.3, 2.6); } g.stroke(); // 깃털 결
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(-1, 7.4, 13, 3, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.beginPath(); g.ellipse(-1.5, -8.2, 8.5, 1.5, -0.05, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }
  // 접은 날개 + 끝의 흰 깃(춤출 땐 펼친다)
  const fold = 1 - dc;
  if (fold > 0.05) {
    if (real) { g.fillStyle = OS.body2; g.fill(WING); g.strokeStyle = OS.fluff; g.lineWidth = 0.7; g.beginPath(); g.moveTo(5, -3.4); g.quadraticCurveTo(-2, -5.8, -8, -2.5); g.stroke(); }
    const flap = moving ? Math.sin(u * TAU * 2) * 0.06 : 0;
    for (const [x, y, rx, ry, a] of [[-6.8, 3.4, 3.6, 1.5, 0.35], [-9.4, 2.6, 3.7, 1.6, 0.55], [-11.8, 1.0, 3.4, 1.5, 0.8], [-13.0, -1.4, 2.8, 1.3, 1.1]]) {
      ell(g, x, y, rx * fold, ry, a + flap, OS.plume);
      if (real) ell(g, x - 0.6, y - 0.5, rx * 0.55 * fold, ry * 0.45, a + flap, OS.plume2);
    }
  }
  g.restore();
  if (dc > 0.05) wingFan(1);

  // ---- 머리: 납작한 넓은 부리, 큰 눈과 속눈썹 ----
  let ha = lerp(0.12 + 0.08 * Math.sin(r.look * 0.4) + r.head.x, 1.1 + peck * 0.2, eat);
  ha = lerp(ha, 0.18, ly);
  if (dc > 0) ha = lerp(ha, -0.25 + 0.3 * Math.sin(w + 1.5), dc);
  if (moving) ha += 0.04 * Math.sin(u * TAU * 2);
  g.save(); g.translate(hc[0], hc[1]); g.rotate(ha);
  ell(g, -0.2, 0, 2.7, 2.2, 0, OS.skin);
  g.fillStyle = C(OS.beak); g.beginPath(); g.moveTo(1.2, -1.0); g.quadraticCurveTo(4.9, -1.15, 6.1, -0.05); g.quadraticCurveTo(5.1, 1.05, 1.2, 1.15); g.closePath(); g.fill();
  if (real) {
    g.strokeStyle = 'rgba(120,80,40,0.55)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(1.6, 0.15); g.quadraticCurveTo(4, 0.25, 5.9, 0); g.stroke(); // 부리 선
    ell(g, -0.9, -1.8, 1.7, 0.6, -0.1, '#8d7d74'); // 정수리 잔털
  }
  const closed = r.blink > 0 || (ly > 0.6 && Math.sin(t * 0.5) > -0.6);
  eye(g, 0.35, -0.45, 1.05, closed);
  if (real && !closed) { g.strokeStyle = '#1e1712'; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath(); for (const k of [-0.6, 0, 0.6]) { g.moveTo(0.35 + k, -1.4); g.lineTo(0.35 + k * 1.5, -2.0); } g.stroke(); } // 속눈썹
  g.restore();
}
