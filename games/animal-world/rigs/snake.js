// 방울뱀(서부다이아몬드방울뱀) 리그: 모래빛 갈색 몸에 크림 테를 두른 짙은 마름모 무늬, 크림색 배, 세모난 머리(눈 뒤 검은 띠·열 감지 구멍),
// 갈라진 혀, 검고 흰 꼬리 띠 끝의 마디 방울.
// 몸은 척추 곡선(꼬리 끝 → 머리, N점)을 땅 위 평면(x, 깊이 d)과 높이 h로 잡아 옆모습으로 투영하고(깊이는 화면 위로 조금), 굵기를 준 띠로 그린다.
// 똬리는 화면에서 좌우로 꺾이는 곳마다 띠를 끊어(반 바퀴씩) 먼 것부터 그린다.
// 걷기(옆으로 물결치기: 물결이 땅에 고정돼 몸이 그 길을 따라 미끄러진다, 위상 = gait, 머리는 수평)·쉬기(느슨한 S, 혀 날름, 머리 천천히 흔들기)
// ·먹기/물(머리를 숙여 주둥이를 땅에, 혀)·눕기(납작한 똬리 위에 머리, 졸린 눈)·특수 행동(단단한 방어 똬리, S자로 세운 목, 꼬리 방울을 들어 떨기, 쉿).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 8; // 물결 한 파장 = 한 주기 동안 나아가는 거리(몸이 땅에 고정된 물결을 따라가므로 미끄러지지 않는다)
export const BOX = [14, 11];
const TAU = Math.PI * 2;
const N = 40, LB = 24, DS = LB / (N - 1), PD = 0.68; // 척추 점 수, 몸 길이, 점 간격, 깊이 → 화면 y 비율
const HX = 8.6; // 펴진 몸: 머리 뿌리 x
const WA = 0.95, LAM = STRIDE / 0.7868; // 걷기 물결: 진행 방향 진폭, 몸을 따라 잰 파장(= STRIDE ÷ 평균 cos, 그래야 화면 파장이 STRIDE이고 물결이 땅에 고정된다)
const SN = {
  col: '#b8935e', dark: '#5e4128', rim: '#f0dfb2', belly: '#efe3c4', stripe: '#4a3320', iris: '#d9b54a', pupil: '#1a120c',
  tongue: '#b52f3a', mouth: '#c4646c', fang: '#fffaf0', rattle: '#dcc595', rattleD: '#8d7448', band: '#2b231d', bandW: '#e8decb', brow: '#a8865a',
};
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? ss((s - a) / (b - a)) : s <= c ? 1 : 1 - ss((s - c) / (d - c)));
// 굵기(지름): 꼬리 끝 가늘게 → 몸 가운데 굵게 → 목에서 잘록 → 머리 뿌리
const W = Array.from({ length: N }, (_, i) => { const s = i / (N - 1); return 0.9 + 1.7 * ss(s / 0.42) - 0.8 * ss((s - 0.68) / 0.26) + 0.2 * ss((s - 0.93) / 0.07); });
// 척추 버퍼(매 프레임 재사용): [x, d(깊이, 멀수록 +), h(높이)] × N
const A = new Float64Array(N * 3), B = new Float64Array(N * 3), Q = new Float64Array(N * 3), F = new Float64Array(N * 3);
const X = new Float64Array(N), Y = new Float64Array(N), K = new Float64Array(N), TX = new Float64Array(N), TY = new Float64Array(N);

// 펴진 몸: 머리에서 꼬리 쪽으로 진행 방향(각도)을 적분한다. 머리 쪽 몇 칸은 곧게(머리는 수평 유지)
function stretch(o, u, wave, t, lift, sway) {
  let x = HX, d = 0;
  for (let i = N - 1; i >= 0; i--) {
    const s = i / (N - 1);
    o[i * 3] = x; o[i * 3 + 1] = d; o[i * 3 + 2] = W[i] / 2 + lift * ss((s - 0.78) / 0.22) + 0.45 * ss((0.08 - s) / 0.08);
    const am = (1 - s) * LB + DS / 2; // 머리에서 잰 거리(다음 칸 가운데)
    const thW = WA * ss((am - 2.2) / 6) * Math.sin(TAU * (u - am / LAM)); // 땅에 고정된 물결: 한 주기(STRIDE) 나아가면 몸은 길을 따라 한 파장 미끄러진다
    const thI = 0.72 * ss((am - 1.6) / 5) * Math.sin((TAU * am) / 15 + 1.4 + 0.3 * Math.sin(t * 0.21)) + sway * (1 - ss(am / 5));
    const th = lerp(thI, thW, wave);
    x -= Math.cos(th) * DS; d -= Math.sin(th) * DS;
  }
}
// 똬리: 꼬리 쪽(바깥·아래)에서 안쪽·위로 감아 오른다. c.s0~c.s1 구간이 똬리, 그 앞(꼬리)과 뒤(목)는 따로
function coil(o, c) {
  const i0 = Math.round(c.s0 * (N - 1)), i1 = Math.round(c.s1 * (N - 1)), Lc = (i1 - i0) * DS;
  const dphi = (Lc / (c.R0 - c.R1)) * Math.log(c.R0 / c.R1);
  let phi = c.phiEnd - dphi;
  const phi0 = phi;
  for (let i = i0; i <= i1; i++) {
    const R = lerp(c.R0, c.R1, (i - i0) / (i1 - i0));
    o[i * 3] = c.cx + R * Math.cos(phi); o[i * 3 + 1] = c.cd + R * Math.sin(phi); o[i * 3 + 2] = W[i] / 2 + (c.rise * (phi - phi0)) / TAU;
    phi += DS / R;
  }
  return [i0, i1];
}
// 3차 베지어로 목(점 i1 → 머리 뿌리)을 채운다
function neckTo(o, i1, P1, P2, P3) {
  const P0 = [o[i1 * 3], o[i1 * 3 + 1], o[i1 * 3 + 2]];
  for (let i = i1 + 1; i < N; i++) {
    const s = (i - i1) / (N - 1 - i1), m = 1 - s;
    for (let k = 0; k < 3; k++) o[i * 3 + k] = m * m * m * P0[k] + 3 * m * m * s * P1[k] + 3 * m * s * s * P2[k] + s * s * s * P3[k];
  }
}

export function draw(g, p, H) {
  const { springTo, rigTick, ell, C } = H;
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const special = sp >= 0, moving = p.mv > 0 && !special, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };

  // ---- 상태 섞기(쉬기 → 걷기 물결 / 먹기 / 똬리 / 방어 똬리) ----
  const restT = p.st === 'rest' ? 1 : 0, rest = Math.max(p.ly ?? 0, clamp01(spring('rest', restT, 16, 8)));
  const wave = clamp01(spring('wave', moving ? 1 : 0, 14, 7.5));
  const spc = special ? ss(sp / 0.12) * ss((1 - sp) / 0.1) : 0;
  const down = (p.st === 'eat' || p.st === 'drink' ? hd : 0) * (1 - rest);
  const vib = special ? spc * ss((sp - 0.1) / 0.06) * (1 - ss((sp - 0.86) / 0.06)) : 0; // 방울 떨기
  const breath = Math.sin((t * TAU) / 3.2);
  const swayA = Math.sin(t * 0.9), swayB = Math.sin(t * 0.55 + 1.3);
  const idleK = (1 - wave) * (1 - down);
  const lift = lerp(1.25 + 0.3 * swayA * idleK, 0.85, down) - 0.15 * wave;
  stretch(A, u, wave, t, lift, 0.35 * swayB * idleK);
  let ha = lerp(0.04 * swayA * idleK - 0.02, 0.3 + 0.04 * Math.sin(t * TAU * 0.7), down);
  for (let i = 0; i < N * 3; i++) F[i] = A[i];
  // 눕기: 납작한 똬리 한 바퀴, 목은 똬리 위로 넘어와 머리를 얹는다
  if (rest > 0.001) {
    coil(B, { cx: -1.2, cd: 2.4, R0: 4.6, R1: 2.0, rise: 1.7, s0: 0, s1: 1, phiEnd: TAU * 2 + 4.95 });
    for (let i = 0; i < N; i++) B[i * 3 + 2] += (0.05 * breath + 0.5 * ss((i / (N - 1) - 0.86) / 0.14)) * (i / N); // 머리는 똬리 꼭대기에 살짝 들어 얹는다
    for (let i = 0; i < N * 3; i++) F[i] = lerp(F[i], B[i], rest);
    ha = lerp(ha, 0.1, rest);
  }
  // 특수: 단단한 방어 똬리, 꼬리는 똬리 뒤에서 세우고, 목은 S자로 세워 머리를 앞으로(가끔 앞뒤로 위협)
  if (spc > 0.001) {
    const [i0, i1] = coil(Q, { cx: -2.4, cd: 1.9, R0: 3.4, R1: 1.75, rise: 2.0, s0: 0.12, s1: 0.64, phiEnd: TAU * 2 + 1.75 });
    const x0 = Q[i0 * 3], d0 = Q[i0 * 3 + 1], h0 = Q[i0 * 3 + 2];
    for (let i = i0 - 1; i >= 0; i--) { const L = (i0 - i) * DS; Q[i * 3] = x0 - 0.18 * L - 0.07 * L * L; Q[i * 3 + 1] = d0; Q[i * 3 + 2] = h0 + 0.93 * L; }
    const fe = Math.sin(t * TAU * 0.55), E = [Q[i1 * 3], Q[i1 * 3 + 1], Q[i1 * 3 + 2]];
    const hb = [1.6 + 0.6 * fe, 0.6, 8.6 + 0.25 * Math.sin(t * TAU * 0.55 + 1.2)];
    neckTo(Q, i1, [E[0] - 1.6, E[1] - 0.4, E[2] + 3.6], [hb[0] - 4.4, hb[1], hb[2] - 0.6], hb);
    for (let i = 0; i < N * 3; i++) F[i] = lerp(F[i], Q[i], spc);
    ha = lerp(ha, 0.06 - 0.08 * fe, spc);
  }
  const coiled = Math.max(rest, spc);

  // ---- 화면 투영·접선 ----
  for (let i = 0; i < N; i++) { const x = F[i * 3], d = F[i * 3 + 1], h = F[i * 3 + 2]; X[i] = x; Y[i] = -h - PD * d; K[i] = d - 0.6 * h; }
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), dx = X[b] - X[a], dy = Y[b] - Y[a], L = Math.hypot(dx, dy) || 1;
    TX[i] = dx / L; TY[i] = dy / L;
  }

  // ---- 그림자: 땅에 닿은 몸을 따라 ----
  if (p.shadow !== false) {
    if (coiled > 0.05) ell(g, lerp(-1.2, -2.4, spc) + 0.3, -PD * lerp(2.4, 1.9, spc) + 0.4, lerp(5.6, 4.6, spc), 2.4, 0, `rgba(40,25,10,${(0.18 * coiled).toFixed(3)})`);
    g.strokeStyle = 'rgba(40,25,10,0.15)'; g.lineWidth = 1.7; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    let on = false;
    for (let i = 0; i < N; i++) {
      const low = F[i * 3 + 2] < W[i] * 0.75 + 0.15;
      if (low) { const sx = X[i] + 0.3, sy = -PD * F[i * 3 + 1] + 0.1; if (on) g.lineTo(sx, sy); else g.moveTo(sx, sy); }
      on = low;
    }
    g.stroke();
  }

  // ---- 띠 나누기: 똬리에서 화면 좌우 방향이 바뀌는 곳(반 바퀴)마다 끊고, 먼 것부터 ----
  const runs = [];
  {
    let a = 0, sg = 0;
    for (let i = 0; i < N - 1; i++) {
      const dx = X[i + 1] - X[i];
      if (Math.abs(dx) < 0.12 * DS) continue;
      const s2 = dx > 0 ? 1 : -1;
      if (sg && s2 !== sg && coiled > 0.02 && i > a) { runs.push([a, i, sg]); a = i; }
      sg = s2;
    }
    runs.push([a, N - 1, sg || 1]);
    for (const R of runs) { let k = 0; for (let i = R[0]; i <= R[1]; i++) k += K[i]; R.push(k / (R[1] - R[0] + 1)); }
    runs.sort((P1, P2) => P2[3] - P1[3]);
  }
  const at = (fi) => { const i = Math.min(N - 2, Math.floor(fi)), f = fi - i; return [lerp(X[i], X[i + 1], f), lerp(Y[i], Y[i + 1], f), lerp(TX[i], TX[i + 1], f), lerp(TY[i], TY[i + 1], f), lerp(W[i], W[i + 1], f)]; };
  const quad = (path, c, tx, ty, nx, ny, a, b) => { path.moveTo(c[0] + tx * a, c[1] + ty * a); path.lineTo(c[0] + nx * b, c[1] + ny * b); path.lineTo(c[0] - tx * a, c[1] - ty * a); path.lineTo(c[0] - nx * b, c[1] - ny * b); path.closePath(); };

  const drawRun = (R) => {
    const ext = runs.length > 1, a = ext ? Math.max(0, R[0] - 1) : R[0], b = ext ? Math.min(N - 1, R[1] + 1) : R[1];
    const ms = (R[0] + R[1]) / 2 / (N - 1), sg = R[2] < 0 && ms < 0.7 && coiled > 0.3 ? -1 : 1; // 똬리 뒤쪽 반 바퀴는 배가 아래로 오도록 뒤집는다
    const body = new Path2D();
    for (let i = a; i <= b; i++) { const w = W[i] / 2; body.lineTo(X[i] + TY[i] * w, Y[i] - TX[i] * w); }
    for (let i = b; i >= a; i--) { const w = W[i] / 2; body.lineTo(X[i] - TY[i] * w, Y[i] + TX[i] * w); }
    body.closePath();
    g.fillStyle = C(SN.col); g.fill(body);
    if (!real) return;
    g.save(); g.clip(body);
    // 배(크림색 띠): 배 쪽 가장자리
    const bl = new Path2D();
    for (let i = a; i <= b; i++) { const w = W[i] * 0.2 * sg; bl.lineTo(X[i] - TY[i] * w, Y[i] + TX[i] * w); }
    for (let i = b; i >= a; i--) { const w = (W[i] * 0.55 + 0.6) * sg; bl.lineTo(X[i] - TY[i] * w, Y[i] + TX[i] * w); }
    bl.closePath();
    g.fillStyle = SN.belly; g.fill(bl);
    // 마름모 무늬(크림 테 + 짙은 갈색), 등 쪽으로 조금 올려서
    const rim = new Path2D(), dk = new Path2D();
    for (let s = 0.16; s < 0.9; s += 0.085) {
      const fi = s * (N - 1); if (fi < a || fi > b) continue;
      const [x, y, tx, ty, w] = at(fi), nx = -ty * sg, ny = tx * sg, c = [x - nx * w * 0.12, y - ny * w * 0.12];
      quad(rim, c, tx, ty, nx, ny, w * 0.6, w * 0.47); quad(dk, c, tx, ty, nx, ny, w * 0.42, w * 0.32);
    }
    g.fillStyle = SN.rim; g.fill(rim); g.fillStyle = SN.dark; g.fill(dk);
    // 꼬리 끝 검고 흰 띠
    if (a <= 5) {
      const bw = new Path2D(), bk = new Path2D();
      for (let k = 0; k < 6; k++) {
        const fi = 0.25 + k * 0.62; if (fi < a || fi > b + 0.5) continue;
        const [x, y, tx, ty, w] = at(fi);
        quad(k % 2 ? bw : bk, [x, y], tx, ty, -ty, tx, 0.42, w + 0.5);
      }
      g.fillStyle = SN.bandW; g.fill(bw); g.fillStyle = SN.band; g.fill(bk);
    }
    g.fillStyle = 'rgba(255,246,222,0.22)'; g.beginPath(); // 등 하이라이트
    for (let i = a; i <= b; i++) { const w = W[i] * 0.36 * sg; g.lineTo(X[i] + TY[i] * w, Y[i] - TX[i] * w); }
    for (let i = b; i >= a; i--) { const w = W[i] * 0.2 * sg; g.lineTo(X[i] + TY[i] * w, Y[i] - TX[i] * w); }
    g.closePath(); g.fill();
    g.restore();
  };

  // ---- 방울: 꼬리 끝에서 뒤로 마디 4개(끝으로 갈수록 작다). 떨 땐 잔상과 떨림 선 ----
  const rattle = () => {
    let dx = X[0] - X[1], dy = Y[0] - Y[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = -dy, ny = dx, ang = Math.atan2(dy, dx);
    const one = (o) => {
      for (let k = 3; k >= 0; k--) {
        const cx = X[0] + dx * (0.25 + 0.6 * k) + nx * o, cy = Y[0] + dy * (0.25 + 0.6 * k) + ny * o, ry = 0.62 - 0.07 * k;
        if (real) { ell(g, cx, cy, 0.42, ry, ang, SN.rattleD); ell(g, cx + dx * 0.1, cy + dy * 0.1, 0.33, ry - 0.08, ang, SN.rattle); }
        else ell(g, cx, cy, 0.42, ry, ang, SN.rattle);
      }
    };
    if (vib > 0.05) {
      const j = Math.sin(t * TAU * 23) * 0.32 * vib;
      if (real) { g.save(); g.globalAlpha *= 0.35; one(j - 0.45 * vib); one(j + 0.45 * vib); g.restore(); }
      one(j);
      if (real) { // 떨림 선(방울 양옆 짧은 호)
        const tip = [X[0] + dx * 1.4, Y[0] + dy * 1.4];
        g.save(); g.globalAlpha *= 0.8 * vib; g.strokeStyle = C('#fffaf0'); g.lineWidth = 0.28; g.lineCap = 'round';
        const ph2 = (t * 6) % 1;
        for (const sd of [-1, 1]) for (let q = 0; q < 2; q++) {
          const rr = 1.4 + q * 0.7 + ph2 * 0.4, a0 = ang + (sd > 0 ? Math.PI / 2 : -Math.PI / 2);
          g.beginPath(); g.arc(tip[0], tip[1], rr, a0 - 0.45, a0 + 0.45); g.stroke();
        }
        g.restore();
      }
    } else one(0);
  };

  for (const R of runs) { drawRun(R); if (R[0] === 0) rattle(); }

  // ---- 머리(옆모습): 납작한 정수리, 둥근 주둥이, 볼(턱) 쪽이 불룩한 세모 머리. 아래턱은 경첩(-0.6, 0.8)으로 열린다 ----
  const flick = (per, len) => { const f = (t % per) / per; return f < len ? Math.sin((Math.PI * f) / len) : 0; };
  const hiss = special ? 0.55 * env(sp, 0.4, 0.46, 0.58, 0.64) : 0;
  const j = hiss + (p.st === 'eat' ? down * 0.18 * Math.max(0, Math.sin(t * TAU * 0.7)) ** 2 : 0);
  let tg = 0;
  if (rest < 0.5 && j < 0.1) tg = special ? spc * flick(0.9, 0.35) : down > 0.5 ? flick(1.1, 0.45) : moving ? flick(2.6, 0.22) : flick(2.2, 0.25);
  const tw = 0.22 * Math.sin(t * TAU * 9) + down * 0.35;
  const hang = Math.atan2(TY[N - 1], TX[N - 1]) * 0.35 + ha;
  g.save(); g.translate(X[N - 1], Y[N - 1]); g.rotate(hang); g.scale(1.2, 1.2);
  if (tg > 0.02) { // 갈라진 혀: 주둥이 끝 홈에서 나와 끝이 두 갈래
    const L = 2.5 * tg, ex = 4.1 + Math.cos(tw) * L, ey = 0.45 + Math.sin(tw) * L;
    g.strokeStyle = C(SN.tongue); g.lineWidth = 0.28; g.lineCap = 'round'; g.beginPath();
    g.moveTo(3.6, 0.45); g.lineTo(ex, ey);
    g.lineTo(ex + Math.cos(tw - 0.45) * 0.75 * tg, ey + Math.sin(tw - 0.45) * 0.75 * tg); g.moveTo(ex, ey);
    g.lineTo(ex + Math.cos(tw + 0.45) * 0.75 * tg, ey + Math.sin(tw + 0.45) * 0.75 * tg); g.stroke();
  }
  if (j > 0.03) { // 입 안 + 송곳니
    const jt = [-0.6 + 4.4 * Math.cos(j), 0.8 + 4.4 * Math.sin(j)];
    g.fillStyle = C(SN.mouth); g.beginPath(); g.moveTo(-0.6, 0.8); g.lineTo(4.0, 0.5); g.quadraticCurveTo(4.1, jt[1] * 0.7, jt[0], jt[1]); g.closePath(); g.fill();
    if (real) { g.fillStyle = SN.fang; g.beginPath(); g.moveTo(3.2, 0.55); g.lineTo(3.55, 0.52); g.lineTo(3.3, 0.55 + 1.2 * Math.min(1, j * 2)); g.closePath(); g.fill(); }
  }
  g.save(); g.translate(-0.6, 0.8); g.rotate(j); g.translate(0.6, -0.8);
  const jaw = new Path2D();
  jaw.moveTo(-1.2, 0.4); jaw.lineTo(3.9, 0.25); jaw.quadraticCurveTo(4.3, 0.55, 3.8, 0.8); jaw.quadraticCurveTo(1.8, 1.25, 0.5, 1.45); jaw.quadraticCurveTo(-0.7, 1.5, -1.25, 0.9); jaw.closePath();
  g.fillStyle = C(SN.col); g.fill(jaw);
  if (real) { g.save(); g.clip(jaw); ell(g, 2.6, 1.05, 2.0, 0.42, -0.18, SN.belly); g.restore(); } // 크림색 아래턱
  g.restore();
  const head = new Path2D();
  head.moveTo(-1.1, -0.95); head.quadraticCurveTo(0.6, -1.3, 2.6, -1.08); head.quadraticCurveTo(3.95, -0.98, 4.4, -0.35);
  head.quadraticCurveTo(4.65, 0.2, 4.1, 0.52); head.lineTo(1.0, 0.85); head.quadraticCurveTo(-0.4, 0.95, -1.2, 0.85); head.closePath();
  g.fillStyle = C(SN.col); g.fill(head);
  const sleepy = rest > 0.5;
  if (real) {
    g.save(); g.clip(head);
    g.fillStyle = SN.belly; g.beginPath(); g.moveTo(4.6, 0.1); g.lineTo(1.0, 0.62); g.lineTo(1.0, 1.2); g.lineTo(4.6, 1.2); g.closePath(); g.fill(); // 윗입술 크림
    g.lineCap = 'butt'; // 눈 뒤 검은 띠(크림 테)
    g.strokeStyle = SN.rim; g.lineWidth = 0.95; g.beginPath(); g.moveTo(2.9, -0.4); g.lineTo(-0.6, 0.85); g.stroke();
    g.strokeStyle = SN.stripe; g.lineWidth = 0.5; g.beginPath(); g.moveTo(2.9, -0.4); g.lineTo(-0.6, 0.85); g.stroke();
    g.fillStyle = 'rgba(255,246,222,0.3)'; g.beginPath(); g.ellipse(1.6, -1.0, 2.6, 0.35, -0.03, 0, TAU); g.fill(); // 정수리 하이라이트
    g.restore();
    if (j < 0.03) { g.strokeStyle = 'rgba(70,45,25,0.55)'; g.lineWidth = 0.22; g.lineCap = 'round'; g.beginPath(); g.moveTo(4.05, 0.5); g.quadraticCurveTo(2.4, 0.95, 0.9, 0.8); g.stroke(); } // 입선
    ell(g, 3.45, 0.02, 0.15, 0.13, 0, '#2a1d14'); // 열 감지 구멍
    ell(g, 4.12, -0.33, 0.11, 0.08, 0.4, '#2a1d14'); // 콧구멍
    // 눈: 금빛 홍채 + 세로 동공. 졸 땐(눈꺼풀이 없어) 흐릿하고 눈두덩 비늘이 덮는다
    if (sleepy) { ell(g, 2.55, -0.32, 0.42, 0.4, 0, '#8a7448'); ell(g, 2.55, -0.3, 0.07, 0.22, 0, '#3a2c1e'); }
    else { ell(g, 2.55, -0.32, 0.44, 0.42, 0, SN.iris); ell(g, 2.58, -0.32, 0.1, 0.32, 0, SN.pupil); if (!(r.blink > 0)) ell(g, 2.7, -0.5, 0.11, 0.11, 0, '#ffffff'); }
    g.fillStyle = SN.brow; g.beginPath(); // 눈두덩 비늘(위협하는 눈매)
    g.moveTo(1.95, -0.62); g.quadraticCurveTo(2.6, sleepy ? -0.05 : -0.95, 3.25, sleepy ? -0.35 : -0.72); g.quadraticCurveTo(2.6, -1.25, 1.95, -0.62); g.closePath(); g.fill();
  } else if (!sleepy) ell(g, 2.55, -0.32, 0.42, 0.4, 0, '#1e1712');
  g.restore();
}
