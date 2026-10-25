// 웨델물범 리그: 통통한 짙은 회색 몸(등은 더 짙고 옆구리에 은빛 얼룩, 배는 밝다), 작고 둥근 머리에 고양이처럼 웃는 얼굴, 큰 검은 눈, 수염,
// 짧은 앞지느러미(발톱), 뒤로 끌리는 뒷지느러미. 몸은 척추 곡선을 따라 굵기를 준 띠로 그린다.
// 걷기(땅 위 자벌레 걸음: 가슴을 딛고 엉덩이를 끌어당겨 등이 불룩 솟았다가, 엉덩이를 딛고 가슴을 앞으로 쭉 뻗는다. 앞지느러미가 가슴과 함께 딛는다)
// ·쉬기(가끔 고개 들어 두리번, 깜빡임, 앞지느러미로 얼굴 긁기, 늘 웃는 얼굴)·먹기/물(고개를 눈 바닥까지 숙여 오물오물)
// ·눕기(옆으로 누워 배를 살짝 드러내고 눈 감고 웃기)·특수 행동(옆으로 굴러 배를 보이고 꼼지락, 몸을 활처럼 쭉 펴며 지느러미를 벌리고 하품, 다시 굴러 엎드리기).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 7; // 한 걸음 주기(몸을 한 번 오므렸다 펴기) 동안 나아가는 거리
export const BOX = [20, 14];
const TAU = Math.PI * 2;
const WD = {
  col: '#56616d', back: '#3f4852', belly: '#aab4bd', spot: '#b9c3cb', flip: '#48515b', flipFar: '#323941', claw: '#1f242a',
  muzzle: '#7d8893', pad: '#909ba5', nose: '#1c2126', line: '#22272d', mouth: '#4a2228', tongue: '#d77d84', whisk: '#eef2f5', snow: '#ffffff',
};
// 자세별 척추(뒷지느러미 뿌리 → 엉덩이 → 몸 가운데 → 가슴 → 목 → 머리 중심)와 반굵기, 머리 각도
const POSE = {
  stand: { s: [[-14.6, -3.0], [-9.6, -4.7], [-2.5, -6.5], [4.6, -6.3], [9.5, -7.0], [12.6, -8.6]], w: [1.5, 4.0, 6.4, 6.2, 4.2, 3.0], ha: -0.1 },
  eat: { s: [[-14.6, -3.0], [-9.6, -4.6], [-2.5, -6.1], [4.6, -5.8], [9.8, -4.7], [12.9, -3.5]], w: [1.5, 3.9, 6.0, 5.7, 3.7, 2.9], ha: 0.7 },
  rest: { s: [[-15.4, -2.4], [-10.2, -3.7], [-2.6, -4.9], [4.8, -4.8], [10.1, -4.0], [13.6, -3.5]], w: [1.4, 3.6, 4.9, 4.8, 3.6, 3.0], ha: -0.25 },
  side: { s: [[-15.4, -2.8], [-10.2, -4.0], [-2.6, -5.2], [5.0, -5.1], [10.3, -4.4], [13.8, -4.2]], w: [1.4, 3.7, 5.3, 5.2, 3.8, 3.0], ha: -0.45 },
};

const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (A, B, k) => [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? ss((s - a) / (b - a)) : s <= c ? 1 : 1 - ss((s - c) / (d - c)));
const mixPose = (A, B, k) => (k <= 0 ? A : { s: A.s.map((q, i) => lerp2(q, B.s[i], k)), w: A.w.map((v, i) => lerp(v, B.w[i], k)), ha: lerp(A.ha, B.ha, k) });
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t); // Catmull-Rom
// 척추 곡선을 촘촘히 뽑아 점마다 배 쪽 법선(N)과 반굵기를 붙인다. at(i, s): s = -1 등선, 0 척추, +1 배선
function ribbon(S, W) {
  const pts = [], ws = [], n = S.length;
  for (let i = 0; i < n - 1; i++) {
    const a = S[Math.max(0, i - 1)], b = S[i], c = S[i + 1], d = S[Math.min(n - 1, i + 2)];
    for (let j = 0; j < 4; j++) { const tt = j / 4; pts.push([cr(a[0], b[0], c[0], d[0], tt), cr(a[1], b[1], c[1], d[1], tt)]); ws.push(lerp(W[i], W[i + 1], ss(tt))); }
  }
  pts.push(S[n - 1]); ws.push(W[n - 1]);
  const N = pts.map((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; });
  const at = (i, s) => [pts[i][0] + N[i][0] * ws[i] * s, pts[i][1] + N[i][1] * ws[i] * s];
  const band = (s0, s1, i0 = 0, i1 = pts.length - 1) => { const b = new Path2D(); for (let i = i0; i <= i1; i++) { const q = at(i, Math.max(-1.05, s0)); if (i === i0) b.moveTo(q[0], q[1]); else b.lineTo(q[0], q[1]); } for (let i = i1; i >= i0; i--) { const q = at(i, Math.min(1.05, s1)); b.lineTo(q[0], q[1]); } b.closePath(); return b; };
  return { pts, ws, N, at, band, n: pts.length, path: band(-1, 1) };
}
// 짧은 앞지느러미: 뿌리 → 끝(둥근 노 모양), 끝에 작은 발톱
function foreFlip(g, C, ell, real, a, b, w0, w1, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, ux = dx / L, uy = dy / L;
  g.fillStyle = C(col); g.beginPath();
  g.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2);
  g.quadraticCurveTo(a[0] + dx * 0.55 + nx * w1 * 0.75, a[1] + dy * 0.55 + ny * w1 * 0.75, b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
  g.quadraticCurveTo(b[0] + ux * w1 * 0.9, b[1] + uy * w1 * 0.9, b[0] - nx * w1 / 2, b[1] - ny * w1 / 2);
  g.quadraticCurveTo(a[0] + dx * 0.55 - nx * w1 * 0.6, a[1] + dy * 0.55 - ny * w1 * 0.6, a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  g.closePath(); g.fill();
  if (real) for (const o of [-0.32, 0, 0.32]) ell(g, b[0] + ux * w1 * 0.55 + nx * w1 * o, b[1] + uy * w1 * 0.55 + ny * w1 * o, 0.22, 0.16, Math.atan2(uy, ux), WD.claw);
}
// 뒷지느러미: 뿌리에서 뒤로 부채처럼 벌어지고 끝은 두 갈래
function rearFlip(g, C, x, y, ang, len, spread, col) {
  const L = len, s = spread;
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = C(col); g.beginPath();
  g.moveTo(0, -0.9); g.quadraticCurveTo(L * 0.55, -1.0 - 0.2 * s, L, -1.9 - 0.9 * s);
  g.quadraticCurveTo(L * 0.8, -0.3, L * 0.86, 0);
  g.quadraticCurveTo(L * 0.8, 0.3, L, 1.9 + 0.9 * s);
  g.quadraticCurveTo(L * 0.55, 1.0 + 0.2 * s, 0, 0.9);
  g.closePath(); g.fill();
  g.restore();
}

export function draw(g, p, H) {
  const { footAt, rigTick, ell, eye, C, hash } = H;
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, sp = p.sp ?? -1, real = H.real();
  const special = sp >= 0, moving = p.mv > 0 && !special, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const follow = (key, target, rate) => { r[key] = dt > 0 && r[key] !== undefined ? r[key] + (target - r[key]) * Math.min(1, dt * rate) : target; return r[key]; };
  const ly = special || moving ? 0 : Math.max(p.ly ?? 0, follow('rz', p.st === 'rest' ? 1 : 0, 2.5));
  const hd = special || moving ? 0 : clamp01(p.hd ?? 0) * (1 - ly), drinking = p.st === 'drink';
  const breath = Math.sin((t * TAU) / (ly > 0.5 ? 5 : 3.8));
  const idle = !moving && !special && p.st === 'idle', cyc = (t % 11) / 11;
  const lift = idle ? env(cyc, 0.18, 0.26, 0.46, 0.54) : 0; // 가끔 고개 들어 두리번
  const scr = idle ? env(cyc, 0.66, 0.71, 0.86, 0.91) : 0; // 가끔 앞지느러미로 얼굴 긁기

  // ---- 특수(뒹굴며 기지개): 옆으로 굴러 벌러덩 → 쭉 뻗기·하품 → 다시 굴러 엎드리기 ----
  const roll = special ? env(sp, 0.02, 0.24, 0.72, 0.93) : 0;
  const stretch = special ? env(sp, 0.3, 0.42, 0.56, 0.68) : 0;
  const yawn = special ? env(sp, 0.36, 0.43, 0.52, 0.6) : 0;
  const wig = special ? Math.sin(sp * TAU * 9) * roll * (1 - stretch) : 0; // 벌러덩 누워 지느러미 꼼지락
  const side = special ? 0.62 * roll : 0.24 * ly; // 몸이 옆으로 돌아간 정도(0 = 엎드림, 0.5 = 배가 이쪽을 본다)

  // ---- 자세 섞기 ----
  let P = { s: POSE.stand.s.map((q) => [...q]), w: [...POSE.stand.w], ha: POSE.stand.ha };
  let fc = { x: 0, y: 0, sw: 0 }, bunch = 0;
  if (moving) { // 자벌레 걸음: 가슴 디딤(엉덩이를 끌어당김 → 등이 솟는다) ↔ 엉덩이 디딤(가슴을 앞으로 뻗음)
    const st = STRIDE * 0.5;
    fc = footAt(u, st, 1.4, 0.5); const fp = footAt((u + 0.5) % 1, st, 0.9, 0.5);
    bunch = clamp01((fp.x - fc.x + st) / (2 * st));
    const S = P.s;
    S[3][0] += fc.x; S[3][1] -= fc.sw * 1.2;
    S[4][0] += fc.x * 0.95; S[4][1] -= fc.sw * 1.0;
    S[5][0] += fc.x * 0.9; S[5][1] -= fc.sw * 0.5 - 0.35 * Math.sin(u * TAU * 2);
    S[1][0] += fp.x; S[1][1] -= fp.sw * 0.9;
    S[0][0] += fp.x * 0.95; S[0][1] -= fp.sw * 0.5;
    const hb = ss(bunch); // 등이 솟는 정도
    S[2][0] = (S[1][0] + S[3][0]) / 2 - 0.3; S[2][1] -= hb * 2.1; S[3][1] -= hb * 0.7; S[1][1] -= hb * 0.4; S[4][1] -= hb * 0.3;
    P.w[2] += bunch * 0.3;
    P.ha += 0.06 * Math.sin(u * TAU - 1.2);
  } else {
    P.s[2][1] -= 0.18 * breath; P.w[2] += 0.15 * breath; P.w[3] += 0.1 * breath;
    const look = 0.07 * Math.sin((r.look ?? 0) * 0.4) * Math.sin((r.look ?? 0) * 0.17);
    P.s[5][1] -= 2.3 * lift; P.s[5][0] -= 0.5 * lift; P.s[4][1] -= 0.9 * lift;
    P.ha += look * (1 - scr) - 0.32 * lift + 0.18 * scr + 0.12 * Math.sin(t * 1.3) * lift;
  }
  const nib = drinking ? 0.25 * Math.sin(t * TAU * 0.9) : 0.45 * Math.max(0, Math.sin(t * TAU * 1.3)) ** 2; // 오물오물(먹기는 콕콕, 물은 눈을 핥는다)
  P = mixPose(P, POSE.eat, hd);
  if (hd > 0) { P.s[5][1] -= nib * hd; P.ha -= nib * 0.15 * hd; }
  P = mixPose(P, POSE.rest, ly);
  if (ly > 0) P.s.forEach((q, i) => { if (i >= 2 && i <= 3) q[1] -= ly * 0.15 * (1 + breath); });
  P = mixPose(P, POSE.side, roll);
  if (stretch > 0) { // 기지개: 몸을 길게 늘이고 머리·꼬리를 들어 활처럼
    P.s.forEach((q, i) => { q[0] = -1 + (q[0] + 1) * (1 + 0.12 * stretch); q[1] -= stretch * [1.6, 0.7, 0, 0, 0.6, 1.5][i]; });
    P.w = P.w.map((v) => v * (1 - 0.07 * stretch)); P.ha -= 0.25 * stretch;
  }
  const S = P.s, R = ribbon(S, P.w);
  const iC = 12; // 가슴 샘플 번호(척추점 3 = 샘플 12)

  // ---- 지느러미 자리 ----
  const fS = lerp(0.36, -0.3, side / 0.62); // 앞지느러미 뿌리(옆구리 아래 → 옆으로 누우면 위쪽 옆구리)
  const fRoot = R.at(iC, fS), fRootF = [fRoot[0] + 1.3, fRoot[1] - 0.6];
  const foreTip = (root, far) => {
    let v = [S[3][0] + 1.2 + (far ? 1.4 : 0) - root[0], -1.4 - fc.sw * 1.0 - root[1]];
    if (hd > 0) v = lerp2(v, [2.4, 1.6], hd * 0.5);
    if (scr > 0 && !far) { const k = Math.sin(t * TAU * 2.6); v = lerp2(v, [S[5][0] - 0.6 + 0.5 * k - root[0], S[5][1] + 1.6 + 0.9 * k - root[1]], scr); } // 앞지느러미로 볼·턱 긁기
    if (ly > 0) v = lerp2(v, far ? [2.6, 0.3] : [-3.6, 0.6], ly); // 옆구리에 얹는다
    if (roll > 0) { const a = lerp(-1.05 - (far ? 0.5 : 0), -0.35 - (far ? 0.3 : 0), stretch) + 0.3 * wig * (far ? -1 : 1), L = lerp(3.8, 4.8, stretch); v = lerp2(v, [Math.cos(a) * L, Math.sin(a) * L], roll); } // 위쪽 앞지느러미를 들어 꼼지락 → 머리 앞으로 쭉
    return [root[0] + v[0], root[1] + v[1]];
  };
  const fTip = foreTip(fRoot, false), fTipF = foreTip(fRootF, true);
  const rr = S[0], rb = Math.atan2(S[0][1] - S[1][1], S[0][0] - S[1][0]); // 뒷지느러미 뿌리·방향(엉덩이 → 꼬리)
  const rearA = (far) => rb + (far ? 0.12 : -0.1) + roll * (far ? 0.3 : 0) + stretch * (far ? 0.4 : -0.35) + wig * 0.15 + (moving ? 0.06 * Math.sin(u * TAU) : 0);
  const rearL = 5.4 + stretch * 0.8, rearS = stretch + 0.2 * roll;

  // ---- 그림자 ----
  if (p.shadow !== false) ell(g, -1.5, 0, 18.5, 2.6, 0, 'rgba(40,25,10,0.22)');

  // ---- 먼 쪽 지느러미 ----
  rearFlip(g, C, rr[0], rr[1], rearA(true), rearL, rearS, WD.flipFar);
  if (roll < 0.3) foreFlip(g, C, ell, real, fRootF, fTipF, 1.5, 2.2, WD.flipFar); // 옆으로 누우면 아래쪽 지느러미는 몸에 가린다

  // ---- 몸통: 짙은 등 · 은빛 얼룩 · 밝은 배. 구르면 배 띠가 아래 → 가운데 → 위로 옮겨 간다 ----
  g.fillStyle = C(WD.col); g.fill(R.path);
  ell(g, S[0][0] - 0.2, S[0][1], 1.6, 1.5, 0, WD.col);
  if (real) {
    const o = lerp(0.86, -0.8, side), hw = 0.32 + 0.5 * Math.sin(side * Math.PI), bc = o - 2;
    g.save(); g.clip(R.path);
    g.fillStyle = WD.back; g.fill(R.band(bc - 0.95, bc + 0.95)); // 짙은 등
    g.fillStyle = 'rgba(30,36,44,0.18)'; g.fill(R.band(bc + 0.95, bc + 1.3)); // 등 → 옆구리 사이
    for (let k = 0; k < 16; k++) { // 은빛 얼룩(등·옆구리)
      const i = 3 + Math.floor(hash(k, 3, 7) * (R.n - 8)), sv = bc + 1.25 + (hash(k, 5, 1) - 0.5) * 2.0, q = R.at(i, Math.max(-0.92, Math.min(0.92, sv)));
      const a = Math.atan2(R.N[i][0], -R.N[i][1]);
      ell(g, q[0], q[1], 0.6 + hash(k, 9, 2) * 0.7, 0.32 + hash(k, 4, 4) * 0.3, a + (hash(k, 6, 6) - 0.5) * 0.8, WD.spot);
    }
    g.fillStyle = WD.belly; g.fill(R.band(o - hw, o + hw, 2, R.n - 2)); // 밝은 배
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill(R.band(-0.9, -0.62, 4, R.n - 4)); // 등 윤기
    g.restore();
  }

  // ---- 가까운 쪽 지느러미 ----
  rearFlip(g, C, rr[0], rr[1], rearA(false), rearL, rearS, WD.flip);
  if (real) { // 뒷지느러미 발가락 줄
    g.save(); g.translate(rr[0], rr[1]); g.rotate(rearA(false)); g.strokeStyle = 'rgba(15,20,25,0.4)'; g.lineWidth = 0.22; g.lineCap = 'round'; g.beginPath();
    for (const v of [-0.8, 0, 0.8]) { g.moveTo(rearL * 0.25, v * 0.4); g.lineTo(rearL * 0.82, v * (1.4 + rearS * 0.7)); }
    g.stroke(); g.restore();
  }
  if (scr <= 0.5) foreFlip(g, C, ell, real, fRoot, fTip, 1.7, 2.5, WD.flip);

  // ---- 머리: 작고 둥근 머리, 짧은 주둥이, 큰 눈, 웃는 입, 수염 ----
  const hc = S[5], ha = P.ha;
  const happy = ly > 0.5 || scr > 0.5 || stretch > 0.4; // 눈 감고 웃기
  const closed = happy || r.blink > 0;
  const jaw = yawn * 0.9 + (drinking ? hd * 0.25 * (0.5 + 0.5 * Math.sin(t * TAU * 0.9)) : hd * 0.3 * nib);
  g.save(); g.translate(hc[0], hc[1]); g.rotate(ha); g.scale(1.1, 1.1);
  ell(g, 0, 0, 3.45, 3.05, 0, WD.col);
  if (real) {
    g.save(); g.beginPath(); g.ellipse(0, 0, 3.45, 3.05, 0, 0, TAU); g.clip();
    g.fillStyle = WD.back; g.beginPath(); g.ellipse(-0.8, -2.4, 3.6, 1.6, -0.1, 0, TAU); g.fill(); // 짙은 정수리
    g.fillStyle = WD.belly; g.beginPath(); g.ellipse(0.4, 2.6, 2.8, 1.1, 0, 0, TAU); g.fill(); // 밝은 턱 밑
    g.restore();
  }
  if (jaw > 0.05) { // 입 안(하품)
    ell(g, 2.7, 1.7 + jaw * 0.35, 1.75, 0.3 + jaw * 0.85, 0.12, WD.mouth);
    if (real) ell(g, 2.4, 1.95 + jaw * 0.6, 1.0, 0.25 + 0.3 * jaw, 0.12, WD.tongue);
  }
  ell(g, 2.75, 0.75, 2.05, 1.5, 0.05, WD.muzzle); // 짧고 둥근 주둥이
  ell(g, 4.4, -0.05, 0.62, 0.45, 0, WD.nose); // 코
  if (real) {
    ell(g, 3.3, 1.05, 1.15, 0.75, 0.1, WD.pad); // 수염 자리
    for (const [x, y] of [[2.9, 0.8], [3.4, 1.15], [3.85, 0.85], [3.35, 0.55]]) ell(g, x, y, 0.1, 0.1, 0, '#4a535c');
    g.strokeStyle = WD.line; g.lineWidth = 0.26; g.lineCap = 'round'; g.beginPath();
    if (jaw <= 0.05) { g.moveTo(4.3, 1.35); g.quadraticCurveTo(3.4, 2.15, 2.25, 1.45); g.quadraticCurveTo(2.05, 1.3, 2.1, 1.05); } // 웃는 입
    g.moveTo(4.25, -0.3); g.lineTo(4.55, -0.05); g.stroke(); // 콧구멍
    const tw = (r.ear?.x ?? 0) * 0.08;
    g.strokeStyle = WD.whisk; g.lineWidth = 0.17; g.beginPath(); // 수염
    for (const [a, b] of [[6.0, 0.4], [6.1, 1.1], [5.7, 1.8], [5.0, 2.3]]) { g.moveTo(3.7, 1.0); g.quadraticCurveTo((3.7 + a) / 2, (1.0 + b) / 2 - 0.25, a + tw, b - tw * 3); }
    g.moveTo(1.6, -1.7); g.lineTo(2.2, -2.9); g.moveTo(1.9, -1.6); g.lineTo(2.8, -2.6); // 눈썹 수염
    g.stroke();
  }
  if (closed && happy && real) { g.strokeStyle = WD.line; g.lineWidth = 0.35; g.lineCap = 'round'; g.beginPath(); g.arc(1.2, -0.45, 0.8, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); } // 웃으며 감은 눈
  else eye(g, 1.2, -0.7, 0.98, closed);
  g.restore();
  if (scr > 0.5) foreFlip(g, C, ell, real, fRoot, fTip, 1.7, 2.5, WD.flip); // 얼굴 긁기: 지느러미가 얼굴 앞으로

  // ---- 먹기·물: 주둥이 앞 눈 부스러기 ----
  if (real && hd > 0.5) {
    const m = [hc[0] + Math.cos(ha) * 4.6, -0.3];
    for (let i = 0; i < 4; i++) { const v = (t * 1.3 + i * 0.27) % 1; ell(g, m[0] + 0.5 + v * (1.2 + i * 0.5), -0.3 - (v * 3 - v * v * 3) * (0.8 + (i % 2) * 0.4), 0.32 * (1 - v * 0.4), 0.28 * (1 - v * 0.4), 0, WD.snow); }
  }
}
