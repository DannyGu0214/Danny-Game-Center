// 코요테 리그: 마른 회갈색 개과 몸(등에 짙은 얼룩 안장), 크고 뾰족한 귀, 가늘고 긴 주둥이, 연한 목·배, 낮게 늘어뜨린 끝이 검은 복슬 꼬리.
// 걷기(4박, 발가락으로 딛는 가는 다리, 머리는 낮게)·쉬기(킁킁 냄새 맡기·귀 씰룩·꼬리 흔들기, 가끔 앉기)·먹기(고개 숙여 씹기)·물(고개 숙여 혀로 핥기)
// ·눕기(몸을 말고 꼬리로 코를 덮고 눈 감기)·특수 행동(앉아서 하늘로 주둥이를 들고 입 벌려 울부짖기, 귀는 뒤로, 소리 물결).
// 몸통은 엉덩이(hip)·어깨(sh) 두 점이 정하는 틀(u = 몸 방향, v = 배 쪽)로 그려서, 앉을 때처럼 몸이 크게 기울어도 같은 모양을 쓴다.
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 9; // 한 걸음 주기 동안 몸이 나아가는 거리
export const BOX = [15, 26];
const TAU = Math.PI * 2;
const DUTY = 0.62; // 4박 걷기: 가까운 뒷다리 → 가까운 앞다리 → 먼 뒷다리 → 먼 앞다리
const OFFS = { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 };
const CY = {
  col: '#b59d7c', saddle: '#7f6a53', far: '#957e60', belly: '#ede3d0', leg: '#c49b6b', legFar: '#a2805a', muzzle: '#c79f6f', ear: '#a9845c', earIn: '#efe1ca',
  tip: '#2c2420', nose: '#251c17', iris: '#c9922e', mouth: '#5a2220', tongue: '#d77a7c', tooth: '#fbf3e2', line: '#5e4a36', toe: '#7a5c3a',
  hip: [-6.4, -14.2], sh: [6.2, -14.8], hind: { a: 5.9, b: 5.7, c: 4.1, bend: 1 }, fore: { a: 6.3, b: 6.5, c: 2.4, bend: -1 }, lift: 2.4,
};
// 꼬리 모양(뿌리 기준 베지어 조절점 셋): 늘어뜨림 · 걸을 때 · 앉아서 발 앞으로 감기 · 몸을 말고 코 덮기
const TAIL = {
  hang: [[-1.4, 2.6], [-2.6, 5.8], [-2.6, 9.0]],
  walk: [[-2.0, 2.0], [-4.0, 4.6], [-5.2, 7.4]],
  sit: [[-1.8, 2.6], [-0.4, 4.6], [8.6, 3.6]],
  curl: [[-2.8, 3.4], [-2.0, 8.2], [7.0, 7.4]],
};
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (A, B, k) => [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? ss((s - a) / (b - a)) : s <= c ? 1 : 1 - ss((s - c) / (d - c)));
const mixT = (A, B, k) => A.map((q, i) => lerp2(q, B[i], k));

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C } = H;
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, sp = p.sp ?? -1, real = H.real();
  const special = sp >= 0, moving = p.mv > 0 && !special, ph = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };

  // ---- 상태 ----
  const restT = p.st === 'rest' ? 1 : 0, rest = special ? 0 : Math.max(p.ly ?? 0, clamp01(spring('rest', restT, 14, 7.5)));
  const idle = !moving && !special && p.st === 'idle';
  const cyc = (t % 26) / 26, sitIdle = idle ? env(cyc, 0.42, 0.5, 0.82, 0.9) : 0;
  const howlSit = special ? ss(sp / 0.1) * ss((1 - sp) / 0.09) : 0;
  const sit = Math.max(clamp01(spring('sit', sitIdle, 10, 6.5)), howlSit) * (1 - rest);
  const sky = special ? env(sp, 0.08, 0.17, 0.84, 0.93) : 0; // 하늘로 고개 들기
  const howl = special ? Math.max(env(sp, 0.18, 0.24, 0.46, 0.52), env(sp, 0.56, 0.62, 0.8, 0.86)) : 0;
  const hd = p.st === 'eat' || p.st === 'drink' ? p.hd ?? 0 : 0, down = hd * (1 - rest) * (1 - sit);
  const sniff = idle ? env((t % 9) / 9, 0.08, 0.16, 0.34, 0.42) * (1 - sit) : 0; // 가끔 코를 땅에 대고 킁킁
  const breath = Math.sin((t * TAU) / 3.2), bob = moving ? Math.sin(ph * TAU * 2) : 0;

  // ---- 엉덩이·어깨: 서기 → 앉기 → 몸 말기, 먹을 땐 앞다리를 굽혀 앞몸을 낮춘다 ----
  let hip = [CY.hip[0], CY.hip[1] + 0.45 * bob];
  let sh = [CY.sh[0], CY.sh[1] + 0.45 * (moving ? Math.sin(ph * TAU * 2 + 1.4) : 0) + down * 3.4 + sniff * 1.2];
  hip = lerp2(hip, [-3.4, -4.6], sit); sh = lerp2(sh, [3.0, -15.0 - 0.15 * breath], sit);
  hip = lerp2(hip, [-4.6, -5.5], rest); sh = lerp2(sh, [3.8, -5.4 - 0.2 * breath], rest);
  let ux = sh[0] - hip[0], uy = sh[1] - hip[1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const vx = -uy, vy = ux; // v = 배 쪽(몸이 수평이면 아래)
  const Bp = (o, a, b) => [o[0] + ux * a + vx * b, o[1] + uy * a + vy * b];
  const mid = [(hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2];

  // ---- 다리: 발가락으로 서는 가는 다리. 걸을 땐 발 고정 걸음, 앉으면 뒷다리를 접고, 몸을 말면 모두 접는다 ----
  const stroke = STRIDE * DUTY;
  const legPts = (key, root, cfg, front) => {
    const x = root[0];
    let f;
    if (moving) { const q = footAt((ph + OFFS[key]) % 1, stroke, CY.lift, DUTY); f = { x: q.x + x + (front ? 0.6 : 1), y: q.y, sw: q.sw, st: q.st }; }
    else f = { x: x + (front ? 0.5 + down * 1.2 : 1) + (key === 'fh' ? -1.1 : key === 'ff' ? 1.1 : 0), y: 0, sw: 0, st: 0.45 };
    const th = front ? 1.1 * f.sw + (-0.12 + (f.st - 0.45) * 0.5) * (1 - f.sw) : 0.3 * f.sw + (-0.4 + (f.st - 0.5) * 0.4) * (1 - f.sw);
    const paw = [f.x, f.y], ankle = [paw[0] + cfg.c * Math.sin(th), paw[1] - cfg.c * Math.cos(th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a, cfg.b, cfg.bend);
    let pts = [root, knee, end, paw], pa = th;
    if (!front && sit > 0) { // 앉기: 허벅지는 앞아래로, 정강이는 뒤로, 발등은 땅에 눕혀 발은 앞으로
      const F2 = [root, [x + 4.5, root[1] + 3.6], [x - 1.0, -0.8], [x + 3.2, -0.35]];
      pts = pts.map((q, i) => lerp2(q, F2[i], sit)); pa = lerp(pa, 0, sit);
    }
    if (rest > 0) { // 몸 말기: 앞다리는 앞으로 접어 눕히고, 뒷다리는 배 밑으로
      const F3 = front ? [root, [x + 0.6, -1.6], [x - 3.0, -1.0], [x - 4.4, -0.5]] : [root, [x + 3.9, -2.7], [x - 1.6, -1.2], [x + 2.6, -0.5]];
      pts = pts.map((q, i) => lerp2(q, F3[i], rest)); pa = lerp(pa, 0, rest);
    }
    return [...pts, pa];
  };
  const legs = {
    fh: legPts('fh', Bp(hip, 0.9, 0), CY.hind, false), ff: legPts('ff', Bp(sh, 0.9, 0), CY.fore, true),
    nh: legPts('nh', hip, CY.hind, false), nf: legPts('nf', sh, CY.fore, true),
  };
  if (p.shadow !== false) {
    ell(g, lerp(0, -1, sit), 0, lerp(13, 9.5, Math.max(sit, rest)), 2.8, 0, 'rgba(40,25,10,0.22)');
    if (rest < 0.5) for (const k of ['nh', 'nf', 'fh', 'ff']) { const [x, y] = legs[k][3]; if (y > -0.3) ell(g, x + 0.8, 0.2, 2.1, 0.6, 0, 'rgba(40,25,10,0.28)'); }
  }
  // 다리 뼈 셋(굵기가 줄고 관절이 둥글다): 허벅지·윗팔은 몸 색, 아래는 황갈색
  const leg = (pts, ws, top, low) => {
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      g.fillStyle = C(i ? low : top); g.beginPath();
      g.moveTo(ax + nx * ws[i] / 2, ay + ny * ws[i] / 2); g.lineTo(bx + nx * ws[i + 1] / 2, by + ny * ws[i + 1] / 2);
      g.lineTo(bx - nx * ws[i + 1] / 2, by - ny * ws[i + 1] / 2); g.lineTo(ax - nx * ws[i] / 2, ay - ny * ws[i] / 2); g.closePath(); g.fill();
      g.beginPath(); g.arc(ax, ay, ws[i] / 2, 0, TAU); if (i) { g.moveTo(bx + ws[i + 1] / 2, by); g.arc(bx, by, ws[i + 1] / 2, 0, TAU); } g.fill();
    }
  };
  const paw = (pts, col, toes) => {
    const [x, y] = pts[3], a = pts[4] * 0.7;
    g.save(); g.translate(x, y); g.rotate(a);
    ell(g, 0.75, -0.9, 1.6, 0.92, 0, col);
    if (toes && real) { g.strokeStyle = CY.toe; g.lineWidth = 0.25; g.lineCap = 'round'; g.beginPath(); g.moveTo(1.5, -1.2); g.lineTo(1.7, -0.3); g.moveTo(2.0, -0.95); g.lineTo(2.15, -0.3); g.stroke(); }
    g.restore();
  };

  // ---- 꼬리: 뿌리에서 베지어로, 가운데가 가장 굵은 복슬 꼬리, 끝 검정 ----
  const tr = Bp(hip, -4.4, -4.0);
  springTo(r.tail, 0.3 + r.swish * 0.5 + (moving ? 0.2 * Math.sin(ph * TAU) : 0), 18, 4, dt);
  const swing = (r.tail.x - 0.3) + (idle ? 0.12 * Math.sin(t * 1.1) : 0);
  let T3 = moving ? TAIL.walk : TAIL.hang;
  T3 = T3.map((q, i) => [q[0] - swing * (i + 1) * 0.9, q[1] - swing * i * 0.6]);
  T3 = mixT(T3, TAIL.sit, sit); T3 = mixT(T3, TAIL.curl, rest);
  const drawTail = () => {
    const P = [tr, ...T3.map((q) => [tr[0] + q[0], tr[1] + q[1]])], n = 12, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n, m = 1 - s;
      const x = m * m * m * P[0][0] + 3 * m * m * s * P[1][0] + 3 * m * s * s * P[2][0] + s * s * s * P[3][0];
      const y = m * m * m * P[0][1] + 3 * m * m * s * P[1][1] + 3 * m * s * s * P[2][1] + s * s * s * P[3][1];
      let dx = 3 * m * m * (P[1][0] - P[0][0]) + 6 * m * s * (P[2][0] - P[1][0]) + 3 * s * s * (P[3][0] - P[2][0]);
      let dy = 3 * m * m * (P[1][1] - P[0][1]) + 6 * m * s * (P[2][1] - P[1][1]) + 3 * s * s * (P[3][1] - P[2][1]);
      const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const w = (0.8 + 1.15 * Math.sin(Math.PI * Math.min(1, s * 1.1))) * (s > 0.9 ? 1 - (s - 0.9) * 4 : 1);
      top.push([x + dy * w, y - dx * w]); bot.push([x - dy * w, y + dx * w]);
    }
    const path = new Path2D();
    path.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i <= n; i++) path.lineTo(top[i][0], top[i][1]);
    const e = n, ex = (top[e][0] + bot[e][0]) / 2, ey = (top[e][1] + bot[e][1]) / 2, tx = ex - (top[e - 1][0] + bot[e - 1][0]) / 2, ty = ey - (top[e - 1][1] + bot[e - 1][1]) / 2;
    path.quadraticCurveTo(ex + tx * 1.6, ey + ty * 1.6, bot[e][0], bot[e][1]);
    for (let i = n - 1; i >= 0; i--) path.lineTo(bot[i][0], bot[i][1]);
    path.closePath();
    g.fillStyle = C(CY.col); g.fill(path);
    if (real) {
      g.save(); g.clip(path);
      g.fillStyle = CY.saddle; g.beginPath(); for (let i = 0; i <= 7; i++) g.lineTo(top[i][0], top[i][1]); for (let i = 7; i >= 0; i--) g.lineTo((top[i][0] * 0.6 + bot[i][0] * 0.4), (top[i][1] * 0.6 + bot[i][1] * 0.4)); g.closePath(); g.fill(); // 윗면 짙은 털
      g.fillStyle = CY.tip; g.beginPath(); g.moveTo(top[9][0], top[9][1]); g.lineTo(ex + tx * 4, ey + ty * 4); g.lineTo(bot[9][0], bot[9][1]); g.closePath(); g.fill(); // 검은 끝
      g.restore();
    } else ell(g, ex, ey, 0.1, 0.1, 0, CY.tip);
  };
  const tailLate = rest > 0.5 ? 2 : sit > 0.5 ? 1 : 0; // 몸을 말면 머리 위에, 앉으면 발 앞에 감는다

  // ---- 먼 쪽 다리 ----
  const fold = rest > 0.6;
  if (!fold) { leg(legs.fh, [3.6, 2.4, 1.5, 1.35], CY.far, CY.legFar); paw(legs.fh, CY.legFar, false); }
  leg(legs.ff, [3.0, 2.1, 1.45, 1.3], CY.far, CY.legFar); paw(legs.ff, CY.legFar, false);
  if (!tailLate) drawTail();

  // ---- 몸통: 둥근 엉덩이 · 곧은 등 · 어깨 · 깊은 가슴 · 잘록한 배 · 허벅지 ----
  const by = 1 + 0.03 * breath;
  const body = new Path2D();
  const mv = (q) => body.moveTo(q[0], q[1]), qd = (c, q) => body.quadraticCurveTo(c[0], c[1], q[0], q[1]), bz = (c1, c2, q) => body.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], q[0], q[1]);
  mv(Bp(hip, 1.2, -5.0));
  qd(Bp(mid, 0, -5.7), Bp(sh, -2.6, -5.4));
  qd(Bp(sh, 2.6, -5.9), Bp(sh, 4.3, -2.4));
  qd(Bp(sh, 5.1, 1.0), Bp(sh, 2.3, 3.6 * by));
  bz(Bp(sh, -2.2, 4.3 * by), Bp(hip, 7, 2.0 * by), Bp(hip, 3.6, 1.8));
  qd(Bp(hip, 2.3, 3.6), Bp(hip, 1.0, 4.3));
  qd(Bp(hip, -2.9, 4.7), Bp(hip, -4.7, 1.4));
  bz(Bp(hip, -5.8, -1.2), Bp(hip, -5.0, -4.2), Bp(hip, -3.1, -5.0));
  qd(Bp(hip, -1.2, -5.6), Bp(hip, 1.2, -5.0));
  body.closePath();
  g.fillStyle = C(CY.col); g.fill(body);
  const ba = Math.atan2(uy, ux);
  if (real) {
    g.save(); g.clip(body);
    let q = Bp(mid, 0.6, 4.2); g.fillStyle = CY.belly; g.beginPath(); g.ellipse(q[0], q[1], 10, 2.4, ba, 0, TAU); g.fill(); // 연한 배
    q = Bp(sh, 4.2, 1.2); g.beginPath(); g.ellipse(q[0], q[1], 2.2, 3.4, ba, 0, TAU); g.fill(); // 연한 가슴
    q = Bp(mid, -0.5, -5.4); g.fillStyle = CY.saddle; g.beginPath(); g.ellipse(q[0], q[1], 9, 2.1, ba, 0, TAU); g.fill(); // 등 안장(짙은 얼룩)
    g.strokeStyle = 'rgba(70,52,34,0.35)'; g.lineWidth = 0.4; g.lineCap = 'round'; g.beginPath(); // 안장 가장자리 털결
    for (let i = 0; i < 7; i++) { const a = -6 + i * 2, b0 = Bp(mid, a, -3.6), b1 = Bp(mid, a - 0.6, -2.7); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); }
    g.stroke();
    g.strokeStyle = 'rgba(90,65,40,0.25)'; g.lineWidth = 0.5; g.beginPath(); // 허벅지 선
    q = Bp(hip, 2.2, -3.6); g.moveTo(q[0], q[1]); const q2 = Bp(hip, 3.4, 0.6), q3 = Bp(hip, 1.6, 4.2); g.quadraticCurveTo(q2[0], q2[1], q3[0], q3[1]); g.stroke();
    g.restore();
  }
  if (sit > 0.3 && !fold) { // 앉았을 때 둥근 허벅지
    const q = [hip[0] + 1.6, hip[1] + 1.2];
    g.save(); g.globalAlpha *= clamp01((sit - 0.3) * 3); ell(g, q[0], q[1], 4.2, 3.3, -0.4, CY.col); g.restore();
  }
  // ---- 가까운 쪽 다리 ----
  leg(legs.nh, [3.8, 2.5, 1.6, 1.4], CY.col, CY.leg); paw(legs.nh, CY.leg, true);
  leg(legs.nf, [3.2, 2.2, 1.5, 1.35], CY.col, CY.leg); paw(legs.nf, CY.leg, true);
  if (tailLate === 1) drawTail();

  // ---- 목·머리: 서기(살짝 듦) · 걷기(낮게) · 먹기/물(땅까지) · 킁킁 · 울부짖기(하늘로) · 몸 말기(옆으로 돌려 꼬리 밑) ----
  const look = r.look ?? 0;
  const nod = moving ? 0.05 * Math.sin(ph * TAU * 2 - 0.8) : 0.07 * Math.sin(look * 0.4) * Math.sin(look * 0.17);
  springTo(r.head, nod, 40, 8, dt);
  const nb = Bp(sh, 2.0, -3.3);
  let na = 0.78 + (moving ? 0.62 : 0) + down * 1.45 + sniff * 1.2 + r.head.x, nl = 5.6 + down * 2.4 + sniff * 1.4;
  let hr = 0.08 + (moving ? 0.36 : 0) + down * 0.95 + sniff * 0.75 + r.head.x * 0.8;
  na = lerp(na, 0.55, sit * (1 - sky)); hr = lerp(hr, 0.1, sit * (1 - sky));
  na = lerp(na, 0.2, sky); nl = lerp(nl, 6.6, sky); hr = lerp(hr, -1.12 - 0.08 * howl, sky);
  let hc = [nb[0] + Math.sin(na) * nl, nb[1] - Math.cos(na) * nl];
  const turn = ss((rest - 0.3) / 0.45), hcCurl = [2.8, -3.7 - 0.1 * breath];
  hc = lerp2(hc, hcCurl, ss(rest / 0.8)); hr = lerp(hr, 0.12, rest);
  // 목: 어깨에서 머리까지, 아래(목) 쪽은 연한 색
  if (rest < 0.75) {
    let nx = hc[0] - nb[0], ny = hc[1] - nb[1]; const nL = Math.hypot(nx, ny) || 1; nx /= nL; ny /= nL;
    const px = -ny, py = nx, b0 = Bp(sh, 0.2, -1.2);
    const neck = new Path2D();
    neck.moveTo(nb[0] - px * 3.6, nb[1] - py * 3.6 - 0.6);
    neck.quadraticCurveTo((nb[0] + hc[0]) / 2 - px * 2.4, (nb[1] + hc[1]) / 2 - py * 2.4, hc[0] - px * 2.0, hc[1] - py * 2.0);
    neck.lineTo(hc[0] + px * 2.0, hc[1] + py * 2.0);
    neck.quadraticCurveTo((nb[0] + hc[0]) / 2 + px * 2.8, (nb[1] + hc[1]) / 2 + py * 2.8, b0[0] + px * 3.6, b0[1] + py * 3.6);
    neck.closePath();
    g.fillStyle = C(CY.col); g.fill(neck);
    if (real) {
      g.save(); g.clip(neck);
      g.fillStyle = CY.belly; g.beginPath(); g.moveTo(hc[0], hc[1]); g.lineTo(hc[0] + px * 3, hc[1] + py * 3); g.lineTo(b0[0] + px * 5, b0[1] + py * 5); g.lineTo(b0[0] + px * 0.6, b0[1] + py * 0.6); g.closePath(); g.fill(); // 연한 목
      const q = [nb[0] - px * 2.6, nb[1] - py * 2.6]; g.fillStyle = 'rgba(110,88,64,0.3)'; g.beginPath(); g.ellipse(q[0], q[1], 2.4, 1.6, Math.atan2(ny, nx), 0, TAU); g.fill(); // 목덜미 짙은 털
      g.restore();
    }
  }
  // 머리(옆모습): 아래턱은 경첩(0.6, 1.0)으로 열린다. 몸을 말 땐 좌우를 뒤집어(돌아보는 모습) 꼬리 쪽을 본다
  const chew = p.st === 'eat' ? down * 0.22 * Math.max(0, Math.sin(t * TAU * 1.6)) : 0;
  const lap = p.st === 'drink' ? down * Math.max(0, Math.sin(t * TAU * 2.2)) : 0;
  const j = Math.max(chew, howl * 0.62, lap * 0.18);
  const closed = r.blink > 0 || rest > 0.5 || howl > 0.5;
  const earBack = Math.max(howl * 0.45, sky * 0.3, rest * 0.5);
  g.save(); g.translate(hc[0], hc[1]); g.scale(Math.cos(Math.PI * turn), 1); g.rotate(hr);
  const ear = (x, col, inner, k) => {
    g.save(); g.translate(x, -2.4); g.rotate(-0.12 + r.ear.x * k - earBack);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(-1.3, 0.4); g.quadraticCurveTo(-1.0, -2.8, 0.1, -4.9); g.quadraticCurveTo(1.2, -2.6, 1.4, 0.1); g.closePath(); g.fill();
    if (inner && real) { g.fillStyle = CY.earIn; g.beginPath(); g.moveTo(-0.6, -0.1); g.quadraticCurveTo(-0.4, -2.4, 0.15, -3.9); g.quadraticCurveTo(0.8, -2.2, 0.8, -0.2); g.closePath(); g.fill(); }
    g.restore();
  };
  ear(0.2, CY.ear, false, 0.35);
  if (j > 0.02) { // 입 안 + 혀
    const jt = [0.6 + 5.6 * Math.cos(j), 1.0 + 5.6 * Math.sin(j)];
    g.fillStyle = C(CY.mouth); g.beginPath(); g.moveTo(0.4, 1.0); g.lineTo(6.4, 0.75); g.quadraticCurveTo(6.6, jt[1] - 0.3, jt[0], jt[1]); g.closePath(); g.fill();
    if (real) ell(g, 0.6 + 3.8 * Math.cos(j * 0.6), 1.0 + 3.8 * Math.sin(j * 0.6), 2.0, 0.5, j * 0.6, CY.tongue);
  }
  if (lap > 0.05) { // 물 핥기: 혀를 땅(물) 쪽으로 쭉
    g.fillStyle = C(CY.tongue); g.beginPath(); g.ellipse(6.6, 1.3 + lap * 0.8, 0.7, 0.9 + lap * 0.9, 0.15, 0, TAU); g.fill();
  }
  g.save(); g.translate(0.6, 1.0); g.rotate(j); g.translate(-0.6, -1.0);
  const jawP = new Path2D();
  jawP.moveTo(0.4, 0.95); jawP.lineTo(6.2, 0.7); jawP.quadraticCurveTo(6.3, 1.35, 5.4, 1.5); jawP.quadraticCurveTo(3, 1.95, 0.4, 2.1); jawP.closePath();
  g.fillStyle = C(CY.belly); g.fill(jawP);
  if (j > 0.1 && real) { g.fillStyle = CY.tooth; g.beginPath(); g.moveTo(5.2, 0.75); g.lineTo(5.7, 0.73); g.lineTo(5.45, 0.0); g.closePath(); g.fill(); }
  g.restore();
  const head = new Path2D();
  head.moveTo(-3.0, -0.4); head.quadraticCurveTo(-2.7, -2.9, 0.2, -3.0); head.quadraticCurveTo(1.9, -3.0, 2.8, -1.8);
  head.lineTo(6.5, -0.75); head.quadraticCurveTo(7.5, -0.55, 7.35, 0.2); head.quadraticCurveTo(7.1, 0.8, 6.3, 0.72);
  head.lineTo(2.6, 1.0); head.quadraticCurveTo(0.6, 2.7, -1.4, 2.3); head.quadraticCurveTo(-3.1, 1.6, -3.0, -0.4); head.closePath();
  g.fillStyle = C(CY.col); g.fill(head);
  if (real) {
    g.save(); g.clip(head);
    g.fillStyle = CY.muzzle; g.beginPath(); g.moveTo(2.6, -2.2); g.lineTo(7.6, -0.9); g.lineTo(7.6, 0.4); g.lineTo(2.2, 0.4); g.closePath(); g.fill(); // 황갈색 주둥이
    g.fillStyle = CY.belly; g.beginPath(); g.ellipse(4.6, 0.95, 3.6, 0.5, -0.05, 0, TAU); g.fill(); // 흰 윗입술
    g.beginPath(); g.ellipse(-0.2, 1.9, 2.8, 1.0, -0.2, 0, TAU); g.fill(); // 연한 뺨
    g.fillStyle = 'rgba(80,60,40,0.22)'; g.beginPath(); g.ellipse(0.2, -2.6, 2.6, 0.8, 0, 0, TAU); g.fill(); // 정수리 짙은 털
    g.restore();
    if (j < 0.02) { g.strokeStyle = CY.line; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(6.4, 0.78); g.quadraticCurveTo(4.4, 1.2, 2.8, 1.05); g.stroke(); }
    if (!closed) { ell(g, 2.0, -1.45, 0.72, 0.55, -0.15, '#3a2a1c'); ell(g, 2.05, -1.45, 0.55, 0.42, -0.15, CY.iris); }
  }
  ell(g, 7.15, -0.35, 0.62, 0.48, 0.25, CY.nose);
  if (sniff > 0.3 && real) ell(g, 7.2, -0.3, 0.25 + 0.08 * Math.sin(t * TAU * 6), 0.18, 0, '#3a2c24'); // 킁킁(콧구멍 실룩)
  eye(g, 2.05, -1.45, 0.38, closed);
  ear(-1.4, CY.col, true, 0.6);
  g.restore();
  if (tailLate === 2) drawTail();
  // 울부짖기: 입에서 하늘로 퍼지는 소리 물결
  if (howl > 0.3 && real) {
    const c = Math.cos(hr), s = Math.sin(hr), m = [hc[0] + c * 7.4 - s * 1.2, hc[1] + s * 7.4 + c * 1.2], dir = hr + 0.15;
    g.save(); g.globalAlpha *= 0.85 * Math.min(1, (howl - 0.3) * 3); g.strokeStyle = C('#fffaf0'); g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const rad = 2.2 + k * 1.8 + ((sp * 9) % 1) * 1.8; g.lineWidth = 0.9 - k * 0.15; g.beginPath(); g.arc(m[0], m[1], rad, dir - 0.55, dir + 0.55); g.stroke(); }
    g.restore();
  }
}
