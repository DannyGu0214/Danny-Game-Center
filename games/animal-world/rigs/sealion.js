// 바다사자 리그: 매끈한 갈색 몸(척추 곡선을 따라 굵기를 준 띠), 작은 귓바퀴, 수염, 몸을 받치는 긴 앞지느러미, 앞으로 돌린 뒷지느러미.
// 걷기(땅 위 뒤뚱걸음: 앞지느러미 번갈아 딛기, 몸이 물결치고 머리 끄덕임)·쉬기(고개 들고 킁킁, 깜빡임, 수염 씰룩)·먹기/물(고개를 땅까지)
// ·눕기(배를 깔고 납작 엎드려 지느러미를 펼치고 눈 감기)·특수 행동(꼿꼿이 앉아 가슴 앞에서 앞지느러미로 박수, 입 벌려 컹컹).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 8; // 한 걸음 주기 동안 몸이 나아가는 거리
export const BOX = [18, 22];
const TAU = Math.PI * 2;
const DUTY = 0.62, DUTY_R = 0.7;
const OFFS = { nf: 0, ff: 0.5, nr: 0.25, fr: 0.75 }; // 앞지느러미 가까운·먼, 뒷지느러미 가까운·먼
const SL = {
  col: '#7a5639', far: '#5f4129', belly: '#957050', hi: '#a78462', flip: '#4f3524', flipFar: '#3d281b', snout: '#86603f', pad: '#9c7a58',
  nose: '#2a1c14', ear: '#4e3524', mouth: '#6e2626', tongue: '#c96a6a', whisk: '#f1e9dc', line: '#3a271a',
};
// 자세별 척추(꼬리 끝 → 엉덩이 → 몸 가운데 → 가슴 → 목 → 머리 중심)와 반굵기, 머리 각도
const POSE = {
  stand: { s: [[-16.2, -2.4], [-10, -4.6], [-3, -7.4], [4.3, -11.0], [8.2, -15.4], [11.0, -18.6]], w: [0.8, 4.5, 5.7, 5.9, 4.1, 2.9], ha: -0.18 },
  eat: { s: [[-16.2, -2.4], [-10, -4.6], [-3, -7.0], [4.4, -9.4], [9.4, -8.6], [12.0, -5.4]], w: [0.8, 4.5, 5.7, 5.6, 4.0, 2.9], ha: 1.05 },
  rest: { s: [[-15, -1.2], [-9, -3.1], [-1.5, -3.9], [5.3, -4.0], [9.4, -3.7], [12.6, -3.1]], w: [0.7, 3.2, 3.9, 3.9, 3.3, 2.9], ha: 0.12 },
  up: { s: [[-11.5, -1.1], [-7.2, -4.2], [-3.8, -9.8], [-1.0, -15.6], [0.6, -20.8], [2.0, -24.2]], w: [0.8, 4.5, 5.4, 5.0, 3.9, 2.9], ha: -0.8 },
};

const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (A, B, k) => [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const mixPose = (A, B, k) => (k <= 0 ? A : { s: A.s.map((p, i) => lerp2(p, B.s[i], k)), w: A.w.map((v, i) => lerp(v, B.w[i], k)), ha: lerp(A.ha, B.ha, k) });
const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t); // Catmull-Rom
// 굵기가 줄어드는 판(지느러미): 뿌리 → 끝, 끝은 둥글게
function blade(g, C, x, y, ang, len, w0, w1, col) {
  const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c, ex = x + c * len, ey = y + s * len;
  g.fillStyle = C(col); g.beginPath();
  g.moveTo(x + nx * w0 / 2, y + ny * w0 / 2); g.lineTo(ex + nx * w1 / 2, ey + ny * w1 / 2);
  g.quadraticCurveTo(ex + c * w1 * 0.7, ey + s * w1 * 0.7, ex - nx * w1 / 2, ey - ny * w1 / 2);
  g.lineTo(x - nx * w0 / 2, y - ny * w0 / 2); g.closePath(); g.fill();
  g.beginPath(); g.arc(x, y, w0 / 2, 0, TAU); g.fill();
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C, taper } = H;
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, ly = p.ly ?? 0, sp = p.sp ?? -1, real = H.real();
  const special = sp >= 0, moving = p.mv > 0 && !special, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const look = r.look ?? 0, w2 = u * TAU * 2;
  const breath = Math.sin(t * TAU / 3.6);

  // ---- 자세 섞기 ----
  const spc = special ? ss(sp / 0.1) * ss((1 - sp) / 0.08) : 0;
  const rest = moving ? 0 : ly * (1 - spc), eat = moving ? 0 : hd * (1 - ly) * (1 - spc);
  let P = { s: POSE.stand.s.map((q) => [...q]), w: [...POSE.stand.w], ha: POSE.stand.ha };
  if (moving) { // 뒤뚱걸음: 몸이 꼬리 쪽으로 물결치고 머리는 한 걸음에 두 번 끄덕
    const dy = [0.3 * Math.sin(w2 + 2.6), 0.5 * Math.sin(w2 + 2.0), 0.55 * Math.sin(w2 + 1.1), 0.75 * Math.sin(w2), 0.7 * Math.sin(w2 - 0.6), 0.95 * Math.sin(w2 - 1.1)];
    P.s.forEach((q, i) => { q[1] += dy[i]; });
    P.s[3][0] += 0.4 * Math.sin(w2); P.s[5][0] += 0.5 * Math.sin(w2 - 0.6);
    P.ha += 0.07 * Math.sin(w2 - 1.6);
  } else {
    // 숨쉬기(가슴), 가끔 고개를 들어 킁킁
    P.s[3][1] -= 0.25 * breath; P.w[3] += 0.12 * breath;
    const sniff = Math.max(0, Math.sin(t * TAU / 4.5)) ** 6;
    P.ha += -0.22 * sniff + 0.08 * Math.sin(look * 0.4) * Math.sin(look * 0.17); P.s[5][1] -= 0.6 * sniff;
  }
  P = mixPose(P, POSE.eat, eat);
  P = mixPose(P, POSE.rest, rest);
  P = mixPose(P, POSE.up, spc);
  if (rest > 0) P.s.forEach((q, i) => { if (i >= 2) q[1] -= rest * 0.12 * (1 + breath); });
  const S = P.s;

  // ---- 지느러미 위치: 서기(IK·걸음) → 눕기·특수 자세 ----
  const fRoot = lerp2([S[3][0] + 1.2, S[3][1] + 2.8], [S[3][0] + 1.7, S[3][1] + 0.9], spc);
  const rRoot = [S[1][0] + 0.6, S[1][1] + 1.6];
  const front = (key, dx) => {
    let wr, ang, sw = 0;
    if (moving) {
      const f = footAt((u + OFFS[key]) % 1, STRIDE * DUTY, 2.4, DUTY);
      wr = [S[3][0] + 1.4 + dx + f.x, -1.2 + f.y]; ang = 0.15 + 0.35 * f.sw; sw = f.sw;
    } else { wr = [S[3][0] + 1.4 + dx + eat * 0.6, -1.2]; ang = 0.15; }
    const { knee } = ik(fRoot[0] + dx * 0.5, fRoot[1], wr[0], wr[1], 4.6, 5.0, -1);
    let pts = [[fRoot[0] + dx * 0.5, fRoot[1]], knee, wr];
    // 눕기: 가까운 지느러미는 옆구리를 따라 뒤로(들어 올리며 돌린다), 먼 지느러미는 앞으로 펼친다
    if (rest > 0) {
      const R = key === 'nf' ? { e: [S[3][0] - 0.5, -1.4], w: [S[3][0] - 1.5, -0.8], a: -Math.PI - 0.1 } : { e: [S[3][0] + 1.5, -1.6], w: [S[3][0] + 3.5, -0.9], a: 0.12 };
      pts = [pts[0], lerp2(pts[1], R.e, rest), lerp2(pts[2], R.w, rest)]; ang = lerp(ang, R.a, rest);
    }
    return { pts, ang, sw };
  };
  const rear = (key, dx) => {
    let an, ang = 0.06;
    if (moving) { const f = footAt((u + OFFS[key]) % 1, STRIDE * DUTY_R, 1.3, DUTY_R); an = [rRoot[0] + dx + 0.6 + f.x, -1.1 + f.y]; ang += 0.25 * f.sw; }
    else an = [rRoot[0] + dx + 0.6, -1.1];
    if (rest > 0) { // 눕기: 뒷지느러미를 꼬리 뒤로 나란히 뻗는다
      an = lerp2(an, [S[0][0] + 1.5 + dx * 0.4, -1.0 - dx * 0.5], rest); ang = lerp(ang, -Math.PI + 0.04 - dx * 0.1, rest); // 들어 올리며 뒤로 돌린다(땅을 뚫지 않게)
    }
    return { root: [rRoot[0] + dx, rRoot[1]], an, ang };
  };
  const FF = front('ff', 1.3), NF = front('nf', 0), FR = rear('fr', 1.2), NR = rear('nr', 0);
  // 특수(박수): 앞지느러미를 가슴 앞으로 들어 올려 벌렸다 탁 모은다
  const k = sp * 11, f = k - Math.floor(k), close = special ? (f < 0.22 ? ss(f / 0.22) : f < 0.36 ? 1 : 1 - ss((f - 0.36) / 0.5)) : 0;
  const jaw = special ? spc * (0.25 + 0.45 * Math.max(0, Math.sin(sp * TAU * 5.5)) ** 0.7) : eat * 0.22 * Math.max(0, Math.sin(t * TAU * 1.6));
  if (spc > 0) {
    for (const [F, o] of [[NF, 1], [FF, -1]]) {
      const wr = [fRoot[0] + 3.4 + (o < 0 ? 0.4 : 0), fRoot[1] - 0.2 + (o < 0 ? -0.5 : 0)];
      const el = [fRoot[0] + 1.2, fRoot[1] + 2.0];
      F.pts = [F.pts[0], lerp2(F.pts[1], el, spc), lerp2(F.pts[2], wr, spc)];
      F.ang = lerp(F.ang, o > 0 ? lerp(0.85, 0.08, close) : lerp(-0.75, -0.08, close), spc);
    }
    FR.an = lerp2(FR.an, [S[1][0] + 2.4, -1.1], spc); NR.an = lerp2(NR.an, [S[1][0] + 1.2, -1.1], spc);
  }

  // ---- 그림자 ----
  if (p.shadow !== false) {
    ell(g, lerp(-1.5, -4, spc), 0, lerp(16, 11, spc), 2.6, 0, 'rgba(40,25,10,0.22)');
    if (real && rest < 0.5) for (const F of [NF, FF]) { const w = F.pts[2]; if (w[1] > -2) ell(g, w[0] + 2.2, 0.15, 3, 0.6, 0, 'rgba(40,25,10,0.25)'); }
  }

  // 지느러미 그리기: 팔(몸 색) → 넓적한 판(진한 색)
  const drawFront = (F, armCol, flCol) => {
    const [a, b, c] = F.pts;
    taper(g, a[0], a[1], b[0], b[1], 3.8, 3.0, armCol);
    taper(g, b[0], b[1], c[0], c[1], 3.0, 2.5, armCol);
    blade(g, C, c[0], c[1], F.ang, 6.2, 2.7, 1.2, flCol);
  };
  const drawRear = (R, armCol, flCol) => {
    taper(g, R.root[0], R.root[1], R.an[0], R.an[1], 3.0, 1.8, armCol);
    blade(g, C, R.an[0], R.an[1], R.ang, 4.0, 1.7, 2.3, flCol);
    if (real) { g.strokeStyle = 'rgba(20,10,5,0.35)'; g.lineWidth = 0.22; g.lineCap = 'round'; g.beginPath(); const c = Math.cos(R.ang), s = Math.sin(R.ang); for (const o of [-0.55, 0, 0.55]) { g.moveTo(R.an[0] + c * 2.2 - s * o, R.an[1] + s * 2.2 + c * o); g.lineTo(R.an[0] + c * 3.9 - s * o * 1.4, R.an[1] + s * 3.9 + c * o * 1.4); } g.stroke(); } // 발가락 줄
  };

  // ---- 먼 쪽 지느러미 ----
  drawRear(FR, SL.far, SL.flipFar);
  drawFront(FF, SL.far, SL.flipFar);

  // ---- 몸통: 척추를 Catmull-Rom으로 잇고 굵기를 준 띠(위 = 등, 아래 = 배) ----
  const pts = [], ws = [], n = S.length;
  for (let i = 0; i < n - 1; i++) {
    const a = S[Math.max(0, i - 1)], b = S[i], c = S[i + 1], d = S[Math.min(n - 1, i + 2)];
    for (let j = 0; j < 4; j++) { const tt = j / 4; pts.push([cr(a[0], b[0], c[0], d[0], tt), cr(a[1], b[1], c[1], d[1], tt)]); ws.push(lerp(P.w[i], P.w[i + 1], ss(tt))); }
  }
  pts.push(S[n - 1]); ws.push(P.w[n - 1]);
  const top = [], bot = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    top.push([pts[i][0] + dy * ws[i], pts[i][1] - dx * ws[i]]); bot.push([pts[i][0] - dy * ws[i], pts[i][1] + dx * ws[i]]);
  }
  const body = new Path2D();
  body.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < top.length; i++) body.lineTo(top[i][0], top[i][1]);
  for (let i = bot.length - 1; i >= 0; i--) body.lineTo(bot[i][0], bot[i][1]);
  body.closePath();
  g.fillStyle = C(SL.col); g.fill(body);
  ell(g, S[0][0], S[0][1], 1.1, 0.8, 0, SL.col); // 짧은 꼬리 끝
  if (real) {
    const belly = new Path2D(); // 배 쪽 절반(조금 밝다)
    belly.moveTo(pts[1][0], pts[1][1] + 0.2);
    for (let i = 2; i < pts.length - 2; i++) belly.lineTo(pts[i][0] * 0.55 + bot[i][0] * 0.45, pts[i][1] * 0.55 + bot[i][1] * 0.45);
    for (let i = pts.length - 3; i >= 1; i--) belly.lineTo(bot[i][0], bot[i][1]);
    belly.closePath();
    g.save(); g.clip(body);
    g.fillStyle = SL.belly; g.fill(belly);
    g.strokeStyle = 'rgba(255,240,215,0.28)'; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); // 젖은 듯 반짝이는 등선
    for (let i = 3; i < top.length - 4; i++) { const q = [top[i][0] * 0.85 + pts[i][0] * 0.15, top[i][1] * 0.85 + pts[i][1] * 0.15]; if (i === 3) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]); }
    g.stroke();
    g.restore();
  }

  // ---- 가까운 쪽 지느러미 ----
  drawRear(NR, SL.col, SL.flip);
  if (spc < 0.5) drawFront(NF, SL.col, SL.flip);

  // ---- 머리(옆모습): 둥근 머리, 개처럼 뾰족한 주둥이, 작은 귓바퀴, 큰 눈, 수염. 아래턱은 경첩(0.8, 1.1)으로 열린다 ----
  const hc = S[n - 1], ha = P.ha;
  g.save(); g.translate(hc[0], hc[1]); g.rotate(ha); g.scale(1.15, 1.15);
  const j = jaw;
  if (j > 0.03) { // 입 안
    const jt = [0.8 + 4.0 * Math.cos(j), 1.1 + 4.0 * Math.sin(j)];
    g.fillStyle = C(SL.mouth); g.beginPath(); g.moveTo(0.6, 1.0); g.lineTo(5.0, 0.9); g.quadraticCurveTo(5.2, jt[1] - 0.2, jt[0], jt[1]); g.closePath(); g.fill();
    if (real) ell(g, 0.8 + 2.6 * Math.cos(j * 0.8), 1.2 + 2.6 * Math.sin(j * 0.8), 1.5, 0.45, j * 0.8, SL.tongue);
  }
  g.save(); g.translate(0.8, 1.1); g.rotate(j); g.translate(-0.8, -1.1);
  ell(g, 2.8, 1.35, 2.3, 0.75, 0.04, SL.snout); // 아래턱
  g.restore();
  ell(g, 0, 0, 3.0, 2.55, 0, SL.col); // 머리
  ell(g, 2.9, 0.35, 2.45, 1.25, 0.03, SL.snout); // 주둥이(윗입술)
  if (real) {
    ell(g, 3.4, 0.85, 1.4, 0.65, 0.05, SL.pad); // 수염 자리
    g.strokeStyle = SL.whisk; g.lineWidth = 0.18; g.lineCap = 'round'; g.beginPath(); // 수염(가끔 씰룩)
    const tw = (r.ear?.x ?? 0) * 0.08;
    for (const [a, b] of [[5.4, 1.0], [5.3, 1.6], [4.8, 2.0]]) { g.moveTo(3.7, 0.9); g.lineTo(a + tw, b - tw * 3); }
    g.stroke();
    for (const [x2, y2] of [[3.0, 0.8], [3.4, 1.05], [3.8, 0.8]]) ell(g, x2, y2, 0.1, 0.1, 0, '#5a3d28');
    if (j < 0.05) { g.strokeStyle = SL.line; g.lineWidth = 0.28; g.beginPath(); g.moveTo(5.0, 1.2); g.quadraticCurveTo(3.6, 1.75, 2.2, 1.45); g.stroke(); } // 입선
    ell(g, 0.2, 1.8, 2.2, 0.8, 0.1, 'rgba(60,35,20,0.18)'); // 턱 밑 그늘
  }
  const sniff = !moving && !special ? Math.max(0, Math.sin(t * TAU / 4.5)) ** 6 : 0;
  ell(g, 5.25, 0.05, 0.55 + 0.08 * sniff * Math.sin(t * TAU * 7), 0.45, 0, SL.nose); // 코(킁킁할 때 실룩)
  // 작은 귓바퀴: 머리 뒤쪽에 뒤로 말린 작은 잎
  g.fillStyle = C(SL.ear); g.beginPath(); g.moveTo(-1.1, -1.6); g.quadraticCurveTo(-2.3, -2.1, -2.9, -1.2); g.quadraticCurveTo(-2.1, -1.1, -1.3, -0.8); g.closePath(); g.fill();
  const closed = rest > 0.5 || r.blink > 0 || (spc > 0.5 && j > 0.6);
  eye(g, 1.0, -0.75, 0.78, closed);
  if (real && !closed) ell(g, 0.75, -1.65, 0.9, 0.22, -0.15, 'rgba(40,25,15,0.35)'); // 눈두덩
  g.restore();

  // 박수(가까운 앞지느러미는 가슴 앞, 머리 위에 그린다) + 탁 소리 선 + 컹컹 소리 물결
  if (spc >= 0.5) {
    drawFront(NF, SL.col, SL.flip);
    if (real && close > 0.9) {
      const w = NF.pts[2], tip = [w[0] + Math.cos(NF.ang) * 6.2, w[1] + Math.sin(NF.ang) * 6.2];
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.35; g.lineCap = 'round'; g.beginPath();
      for (const a of [-1.2, -0.4, 0.4, 1.2]) { g.moveTo(tip[0] + Math.cos(a) * 1.6, tip[1] + Math.sin(a) * 1.6); g.lineTo(tip[0] + Math.cos(a) * 2.6, tip[1] + Math.sin(a) * 2.6); }
      g.stroke();
    }
    if (real && j > 0.4) {
      const c = Math.cos(ha), s = Math.sin(ha), m = [hc[0] + c * 6.2 - s * 1.6, hc[1] + s * 6.2 + c * 1.6], dir = ha + j * 0.4;
      g.save(); g.globalAlpha *= 0.85; g.strokeStyle = C('#fffaf0'); g.lineCap = 'round';
      for (let q = 0; q < 3; q++) { const rad = 2 + q * 1.4 + ((sp * 16) % 1) * 1.2; g.lineWidth = 0.8 - q * 0.15; g.beginPath(); g.arc(m[0], m[1], rad, dir - 0.55, dir + 0.55); g.stroke(); }
      g.restore();
    }
  }
}
