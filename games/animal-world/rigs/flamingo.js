// 홍학 리그: 분홍 몸통, 긴 S자 목, 가운데서 꺾인 끝이 검은 부리, 아주 긴 분홍 다리(뒤로 꺾이는 발목, 타조처럼), 물갈퀴 발.
// 걷기(느리게 발을 높이 드는 두 발 걷기, 목이 앞뒤로 흔들림)·쉬기(가끔 목을 말아 가슴 깃털 고르기)·먹기/물(목을 땅까지, 머리를 거꾸로 해 좌우로 훑기)
// ·눕기(한 다리 접고 머리를 등에 얹고 눈 감기)·특수 행동(한 발로 서서 날개 깃털 고르기).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 9; // 한 걸음 주기(두 발 한 번씩) 동안 몸이 나아가는 거리
export const BOX = [11, 44];
const TAU = Math.PI * 2;
const DUTY = 0.6;
const FL = {
  body: '#f6a3b0', wing: '#ee7590', wing2: '#f59aab', black: '#2a2226', neck: '#f7adb8', leg: '#e9798c',
  foot: '#d9677b', beak: '#f4e4dc', tip: '#2a2226', face: '#fbe3e3', iris: '#f2d24a',
};
const ROOT = [0.8, 3.3], NB = [5.4, -2.4]; // 몸 좌표: 다리 뿌리(깃털 속), 목 뿌리
const LEG = { a: 10.6, b: 12.8 }; // 정강이(깃털 아래 보이는 부분) · 발등뼈

const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (A, B, k) => [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? ss((s - a) / (b - a)) : s <= c ? 1 : 1 - ss((s - c) / (d - c)));
const cub = (a, b, c, d, s) => { const m = 1 - s; return m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c + s * s * s * d; };
const cubD = (a, b, c, d, s) => { const m = 1 - s; return 3 * m * m * (b - a) + 6 * m * s * (c - b) + 3 * s * s * (d - c); };
// 굵기가 줄어드는 마디 + 둥근 관절(타조와 같은 방식)
function bones(g, C, pts, ws, col) {
  g.fillStyle = C(col); g.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath();
  }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], w = ws[i] / 2; g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU, true); }
  g.fill();
}

let BODY = null, WING = null, PRIM = null, BEAK = null, TIP = null, FOOT = null;
function paths() {
  if (BODY) return;
  BODY = new Path2D(); // 몸 좌표(몸 중심 기준): 가슴 → 둥근 등 → 뾰족한 꽁지 → 배
  BODY.moveTo(6.6, -1.4);
  BODY.bezierCurveTo(6.6, -4.6, 2.2, -5.3, -2, -4.9);
  BODY.quadraticCurveTo(-6.6, -4.3, -9.8, -1.8);
  BODY.quadraticCurveTo(-8, 1, -5.4, 2.6);
  BODY.bezierCurveTo(-2.2, 4.7, 4.4, 4.5, 6, 1.9);
  BODY.quadraticCurveTo(7, 0.3, 6.6, -1.4);
  BODY.closePath();
  WING = new Path2D(); // 접은 날개(진한 분홍 덮깃). 원점 = 어깨
  WING.moveTo(0, 0);
  WING.quadraticCurveTo(-5, -2.3, -11, -0.4);
  WING.quadraticCurveTo(-13.2, 0.9, -13.4, 2.0);
  WING.quadraticCurveTo(-9, 3.8, -4, 3.6);
  WING.quadraticCurveTo(0.2, 3.2, 0, 0);
  WING.closePath();
  PRIM = new Path2D(); // 날개 끝 검은 날개깃(꽁지 쪽)
  PRIM.moveTo(-6.5, 2.2);
  PRIM.quadraticCurveTo(-11, 1.4, -13.8, 2.2);
  PRIM.quadraticCurveTo(-11, 4.4, -6.5, 3.6);
  PRIM.closePath();
  BEAK = new Path2D(); // 부리(머리 좌표): 곧은 윗선 → 가운데서 아래로 꺾임
  BEAK.moveTo(0.8, -1.15);
  BEAK.quadraticCurveTo(2.6, -1.45, 3.7, -0.75);
  BEAK.quadraticCurveTo(4.8, 0.2, 5.0, 2.5);
  BEAK.quadraticCurveTo(4.4, 2.5, 3.6, 1.4);
  BEAK.quadraticCurveTo(2.5, 0.9, 0.8, 1.05);
  BEAK.closePath();
  TIP = new Path2D(); // 부리 끝 검은 부분
  TIP.moveTo(3.55, -0.85);
  TIP.quadraticCurveTo(4.8, 0.2, 5.0, 2.5);
  TIP.quadraticCurveTo(4.4, 2.5, 3.6, 1.4);
  TIP.quadraticCurveTo(3.0, 0.3, 3.55, -0.85);
  TIP.closePath();
  FOOT = new Path2D(); // 물갈퀴 발(발 좌표: 원점 = 발가락 뿌리, +x = 발끝)
  FOOT.moveTo(-0.9, -0.55);
  FOOT.lineTo(2.2, -0.45);
  FOOT.quadraticCurveTo(3.7, -0.3, 3.8, 0.15);
  FOOT.lineTo(3.0, 0.3);
  FOOT.lineTo(3.5, 0.55);
  FOOT.lineTo(-0.9, 0.55);
  FOOT.closePath();
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C, shade } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, ly = p.ly ?? 0, sp = p.sp ?? -1, real = H.real();
  const special = sp >= 0, moving = p.mv > 0 && !special, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  const breath = Math.sin(t * TAU / 3.8);
  const farLeg = shade(FL.leg, 0.78), farFoot = shade(FL.foot, 0.78);

  // ---- 자세 섞기 ----
  // spc: 특수 행동(한 발 서기 + 날개 깃털 고르기), tk: 다리 접기(눕기·특수), eat: 목 숙이기, pr: 쉬는 중 가끔 가슴 깃털 고르기
  const spc = special ? ss(sp / 0.1) * ss((1 - sp) / 0.1) : 0;
  const tk = Math.max(moving ? 0 : ly, spc);
  const eat = moving ? 0 : hd * (1 - ly) * (1 - spc);
  const rest = moving ? 0 : ly * (1 - spc);
  const pr = !moving && !special && p.st === 'idle' ? env((t % 11) / 11, 0.62, 0.68, 0.86, 0.92) : 0;

  // ---- 몸 위치·기울기 ----
  let bx = -0.6, by = -26.2, th = 0;
  if (moving) { by += 0.55 * Math.cos(u * TAU * 2); th = 0.035 * Math.sin(u * TAU); }
  by += eat * 1.4; th += eat * 0.32;
  bx -= tk * 0.5; by += tk * 0.4 + rest * 0.4 * breath; th -= rest * 0.06 - spc * 0.05;
  const ca = Math.cos(th), sa = Math.sin(th), T = (x, y) => [bx + ca * x - sa * y, by + sa * x + ca * y];

  // ---- 다리: 뒤로 굽는 발목(2-bone IK, bend -1) ----
  const legOf = (rt, off, dx, tuck) => {
    let foot, toeA = 0;
    if (moving) {
      const f = footAt((u + off) % 1, STRIDE * DUTY, 5.2, DUTY);
      foot = [bx + ROOT[0] + dx + f.x, -0.6 + f.y]; toeA = 0.15 + f.sw * 1.15; // 들면 발가락을 오므려 아래로
    } else foot = [bx + ROOT[0] + dx + eat * 0.6, -0.6];
    const { knee } = ik(rt[0], rt[1], foot[0], foot[1], LEG.a, LEG.b, -1);
    let an = knee, fj = foot;
    if (tuck > 0) { // 접은 다리: 발목은 몸 아래 뒤로 튀어나오고 발은 배 깃털 속으로
      an = lerp2(an, [rt[0] - 5.4, rt[1] + 3.9], tuck); fj = lerp2(fj, [rt[0] + 0.6, rt[1] - 0.6], tuck); toeA = lerp(toeA, -0.6, tuck);
    }
    return { pts: [rt, an, fj], toeA };
  };
  const rootN = T(...ROOT), rootF = T(ROOT[0] + 1.3, ROOT[1] - 0.3);
  const LN = legOf(rootN, 0, tk * -0.3, 0), LF = legOf(rootF, 0.5, 1.2 - tk * 1.2, tk);
  const drawLeg = (L, col, fcol) => {
    const [rt, an, fj] = L.pts;
    bones(g, C, [rt, an], [1.9, 1.35], col); // 정강이
    bones(g, C, [an, fj], [1.3, 1.05], col); // 발등뼈
    ell(g, an[0], an[1], 1.0, 1.0, 0, col); // 뒤로 굽는 발목(울퉁불퉁한 관절)
    g.save(); g.translate(fj[0], fj[1] + 0.05); g.rotate(L.toeA); g.fillStyle = C(fcol); g.fill(FOOT); g.restore();
  };

  // ---- 그림자 ----
  if (p.shadow !== false) {
    ell(g, bx + 0.5, 0, 8.5, 1.9, 0, 'rgba(40,25,10,0.2)');
    if (real) for (const L of [LN, LF]) { const fj = L.pts[2]; if (fj[1] > -1.5) ell(g, fj[0] + 1.4, 0.15, 2.6, 0.6, 0, 'rgba(40,25,10,0.25)'); }
  }

  // ---- 다리(먼 쪽 → 가까운 쪽), 뿌리는 몸통 깃털 속 ----
  drawLeg(LF, farLeg, farFoot);
  drawLeg(LN, FL.leg, FL.foot);

  // ---- 몸통 + 접은 날개 ----
  g.save(); g.translate(bx, by); g.rotate(th); g.scale(1 + 0.01 * breath, 1 + 0.025 * breath);
  g.fillStyle = C(FL.body); g.fill(BODY);
  if (real) {
    g.save(); g.clip(BODY);
    g.fillStyle = 'rgba(200,80,110,0.16)'; g.beginPath(); g.ellipse(-0.5, 4.2, 9, 2.4, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.fillStyle = 'rgba(255,240,240,0.35)'; g.beginPath(); g.ellipse(0.5, -4.4, 6, 1.1, -0.05, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }
  // 날개: 깃털 고를 땐 살짝 들어 검은 날개깃이 더 보인다
  const lift = spc * (0.12 + 0.1 * Math.sin(sp * TAU * 3)) + pr * 0.05;
  g.save(); g.translate(4.4, -2.6); g.rotate(-lift);
  g.fillStyle = C(FL.black); g.fill(PRIM);
  g.fillStyle = C(FL.wing); g.fill(WING);
  if (real) {
    g.strokeStyle = FL.wing2; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath(); // 덮깃 결(비늘 모양)
    for (const [x, y] of [[-3, 1.4], [-6, 1.6], [-9, 1.5], [-4.5, -0.2], [-7.5, 0.1]]) { g.moveTo(x + 1.3, y - 0.6); g.quadraticCurveTo(x, y + 0.8, x - 1.4, y - 0.4); }
    g.stroke();
  }
  g.restore();
  g.restore();

  // ---- 목(S자) + 머리 ----
  const nb = T(...NB);
  // 걸을 땐 한 걸음에 두 번 머리가 앞뒤로(스프링으로 늦게), 쉴 땐 천천히 흔들거림
  const hsw = spring('fsw', moving ? 1.1 * Math.sin(u * TAU * 2 - 0.5) : 0.5 * Math.sin(t * 0.8), 90, 11);
  const look = r.look ?? 0;
  // 서기
  let hc = [nb[0] - 1.6 + hsw * 0.7, nb[1] - 14.2 + (moving ? 0.6 : 0)], c1 = [nb[0] + 6, nb[1] - 5], c2 = [nb[0] - 5.4 + hsw * 0.4, nb[1] - 9.6];
  let ha = 0.22 + 0.06 * Math.sin(look * 0.4) + (moving ? 0.05 * Math.sin(u * TAU * 2) : 0), fx = 1;
  // 먹기·물: 목을 땅까지, 머리는 거꾸로(부리 끝이 다리 쪽), 먹을 땐 좌우로 훑는다
  if (eat > 0) {
    const swp = p.st === 'eat' ? 1.5 * Math.sin(t * TAU * 0.9) : 0.3 * Math.sin(t * TAU * 0.4);
    const ehc = [nb[0] + 4.2 + swp, -3.7 + (p.st === 'eat' ? 0.25 * Math.sin(t * TAU * 1.8) : 0)];
    hc = lerp2(hc, ehc, eat); c1 = lerp2(c1, [nb[0] + 5.5, nb[1] - 1.5], eat); c2 = lerp2(c2, [ehc[0] + 2.2 - swp * 0.4, ehc[1] - 9], eat);
    ha = lerp(ha, 2.0 + swp * 0.05, eat);
  }
  // 쉬는 중 가슴 깃털 고르기(목을 말아 부리를 가슴으로)
  if (pr > 0) {
    const nib = 0.35 * Math.sin(t * TAU * 3.2);
    const phc = [nb[0] + 1.4 + nib * 0.4, nb[1] + 1.6 + nib];
    hc = lerp2(hc, phc, pr); c1 = lerp2(c1, [nb[0] + 1.5, nb[1] - 11], pr); c2 = lerp2(c2, [phc[0] + 7, phc[1] - 10], pr); ha = lerp(ha, 1.35, pr);
  }
  // 특수: 고개를 돌려 날개 깃털을 차례로(어깨 → 날개 가운데 → 날개 끝) 부리로 훑는다
  if (spc > 0) {
    const k = sp * 3, i = Math.min(2, Math.floor(k)), f = ss((k - i) / 0.25);
    const spots = [[-0.5, -2.2], [-4.5, -1.6], [-8, -0.6]], a0 = spots[Math.max(0, i - 1)], a1 = spots[i];
    const nib = 0.4 * Math.sin(sp * TAU * 18);
    const tgt = T(lerp(a0[0], a1[0], i ? f : 1) + nib * 0.3, lerp(a0[1], a1[1], i ? f : 1) - 2.6 + nib);
    hc = lerp2(hc, tgt, spc); c1 = lerp2(c1, [nb[0] + 4, nb[1] - 9], spc); c2 = lerp2(c2, [tgt[0] + 3.5, tgt[1] - 8.5], spc);
    ha = lerp(ha, 0.95 + nib * 0.2, spc); if (spc > 0.5) fx = -1;
  }
  // 눕기(잠): 목을 접어 머리를 등에 얹고 부리를 등 깃털 속에
  if (rest > 0) {
    const rhc = T(-3.2, -5.9 + 0.15 * breath);
    hc = lerp2(hc, rhc, rest); c1 = lerp2(c1, [nb[0] + 2.6, nb[1] - 7], rest); c2 = lerp2(c2, [rhc[0] + 6, rhc[1] - 3.5], rest);
    ha = lerp(ha, 0.45, rest); if (rest > 0.5) fx = -1;
  }
  // 목 그리기(뿌리는 굵고 머리 쪽은 가늘다)
  const N = 12, Ls = [], Rs = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, x = cub(nb[0], c1[0], c2[0], hc[0], s), y = cub(nb[1], c1[1], c2[1], hc[1], s);
    const dx = cubD(nb[0], c1[0], c2[0], hc[0], s), dy = cubD(nb[1], c1[1], c2[1], hc[1], s), L = Math.hypot(dx, dy) || 1;
    const hw = (1.9 + 2.2 * (1 - s) ** 3) / 2, nx = -dy / L * hw, ny = dx / L * hw;
    Ls.push([x + nx, y + ny]); Rs.push([x - nx, y - ny]);
  }
  g.fillStyle = C(FL.neck); g.beginPath(); g.moveTo(Ls[0][0], Ls[0][1]);
  for (const q of Ls) g.lineTo(q[0], q[1]);
  for (let i = Rs.length - 1; i >= 0; i--) g.lineTo(Rs[i][0], Rs[i][1]);
  g.closePath(); g.fill();
  ell(g, nb[0] - 0.5, nb[1] + 0.6, 2.1, 2.1, 0, FL.neck); // 목 뿌리를 가슴에 붙인다

  // 머리: 작고 둥근 머리, 노란 눈, 꺾인 부리
  g.save(); g.translate(hc[0], hc[1]); g.scale(fx, 1); g.rotate(ha);
  ell(g, -0.2, -0.1, 1.95, 1.75, 0, FL.neck);
  g.fillStyle = C(FL.beak); g.fill(BEAK);
  g.fillStyle = C(FL.tip); g.fill(TIP);
  if (real) {
    ell(g, 0.9, -0.15, 0.75, 0.7, 0, FL.face); // 눈과 부리 사이 맨살
    g.strokeStyle = 'rgba(120,70,70,0.45)'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(1.1, 0.25); g.quadraticCurveTo(2.6, 0.2, 3.5, 0.55); g.stroke(); // 부리 선
  }
  const closed = rest > 0.6 || r.blink > 0 || (spc > 0.5 && Math.sin(sp * TAU * 5) > 0.6);
  if (real && !closed) ell(g, -0.2, -0.5, 0.62, 0.62, 0, FL.iris);
  eye(g, -0.2, -0.5, closed ? 0.6 : 0.36, closed);
  g.restore();
}
