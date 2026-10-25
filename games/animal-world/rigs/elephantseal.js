// 남방코끼리물범(수컷) 리그: 거대한 회갈색 몸(어깨·목이 두껍고 엉덩이로 갈수록 가늘다), 목의 두툼한 주름, 가슴 방패의 흉터,
// 입 위로 늘어진 코끼리 코(부풀릴 수 있다), 작은 눈, 짧은 앞지느러미(발톱), 뒤로 끌리는 뒷지느러미. 몸은 척추 곡선을 따라 굵기를 준 띠로 그린다.
// 걷기(웨델물범처럼 자벌레 걸음이지만 더 느리고 무겁다: 가슴을 딛고 엉덩이를 끌어당겨 등이 솟고, 엉덩이를 딛고 가슴을 내민다. 뱃살은 스프링으로 출렁)
// ·쉬기(느린 숨, 코 씰룩, 깜빡임, 가끔 앞지느러미로 눈을 퍼서 등에 끼얹기)·먹기/물(고개를 땅까지 숙인다)
// ·눕기(납작 엎드려 턱을 땅에 대고 눈 감고 천천히 숨쉬기)·특수 행동(앞몸을 높이 세워 뒤로 젖히고, 코를 부풀리며 입을 크게 벌려 세 번 포효, 다시 쿵 내려앉기).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 9; // 한 걸음 주기(몸을 한 번 오므렸다 펴기) 동안 나아가는 거리
export const BOX = [26, 22];
const TAU = Math.PI * 2;
const ES = {
  col: '#7b6b5c', back: '#685a4c', belly: '#968673', shield: '#8f7f6f', scar: '#d2b5a5', fold: '#54473b', flip: '#5f5144', flipFar: '#4a3f35', claw: '#2a221c',
  nose: '#6e5f51', noseHi: '#8b7a6a', nostril: '#2b221c', mouth: '#7a2f33', tongue: '#c86a6e', tooth: '#f3ecdf', rim: '#4a3d33', whisk: '#e9e0d2', snow: '#ffffff',
};
// 자세별 척추(뒷지느러미 뿌리 → 엉덩이 → 몸 가운데 → 가슴 → 목 → 머리 중심)와 반굵기, 머리 각도
const POSE = {
  stand: { s: [[-20.5, -3.4], [-14.6, -6.2], [-5.0, -9.6], [5.0, -10.5], [11.6, -11.6], [15.8, -13.6]], w: [1.8, 5.6, 9.4, 10.3, 7.4, 4.4], ha: 0.05 },
  eat: { s: [[-20.5, -3.4], [-14.6, -6.2], [-5.0, -9.5], [5.0, -10.2], [11.8, -8.6], [15.6, -5.2]], w: [1.8, 5.6, 9.3, 10.0, 7.0, 4.3], ha: 0.75 },
  rest: { s: [[-21.4, -2.6], [-15.4, -5.0], [-5.2, -7.9], [5.0, -8.4], [12.2, -7.4], [16.8, -5.4]], w: [1.7, 5.0, 7.8, 8.2, 6.4, 4.4], ha: 0.12 },
  rear: { s: [[-20.0, -3.2], [-14.2, -6.0], [-6.2, -11.4], [-0.6, -18.6], [2.4, -24.6], [4.4, -29.2]], w: [1.8, 5.6, 9.0, 9.0, 6.8, 4.4], ha: -0.8 },
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
// 짧은 앞지느러미: 뿌리 → 끝(넓어지는 노 모양), 끝에 발톱
function foreFlip(g, C, ell, real, a, b, w0, w1, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, ux = dx / L, uy = dy / L;
  g.fillStyle = C(col); g.beginPath();
  g.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2);
  g.quadraticCurveTo(a[0] + dx * 0.55 + nx * w1 * 0.75, a[1] + dy * 0.55 + ny * w1 * 0.75, b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
  g.quadraticCurveTo(b[0] + ux * w1 * 0.9, b[1] + uy * w1 * 0.9, b[0] - nx * w1 / 2, b[1] - ny * w1 / 2);
  g.quadraticCurveTo(a[0] + dx * 0.55 - nx * w1 * 0.6, a[1] + dy * 0.55 - ny * w1 * 0.6, a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  g.closePath(); g.fill();
  if (real) for (const o of [-0.34, -0.1, 0.14, 0.36]) ell(g, b[0] + ux * w1 * 0.55 + nx * w1 * o, b[1] + uy * w1 * 0.55 + ny * w1 * o, 0.3, 0.2, Math.atan2(uy, ux), ES.claw);
}
// 뒷지느러미: 뿌리에서 뒤로 부채처럼 벌어지고 끝은 두 갈래
function rearFlip(g, C, x, y, ang, len, col) {
  const L = len;
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = C(col); g.beginPath();
  g.moveTo(0, -1.2); g.quadraticCurveTo(L * 0.55, -1.3, L, -2.6);
  g.quadraticCurveTo(L * 0.8, -0.4, L * 0.86, 0);
  g.quadraticCurveTo(L * 0.8, 0.4, L, 2.6);
  g.quadraticCurveTo(L * 0.55, 1.3, 0, 1.2);
  g.closePath(); g.fill();
  g.restore();
}
// 코끼리 코(머리 좌표): 이마에서 시작해 주둥이 위로 둥글게 넘어가 입 앞에 늘어진다. k = 부풀림(0~1)
function nosePath(k) {
  const n = new Path2D();
  n.moveTo(0.4, -3.4);
  n.bezierCurveTo(3.4, -5.0 - 1.9 * k, 7.8 + 1.4 * k, -4.4 - 1.7 * k, 8.0 + 1.3 * k, -0.4 - 0.3 * k); // 이마 → 둥근 코 등
  n.bezierCurveTo(8.1 + 1.3 * k, 1.6 + 0.4 * k, 7.6 + 0.6 * k, 4.4, 6.9 - 0.3 * k, 5.4 - 0.3 * k); // 앞으로 늘어진 코끝
  n.quadraticCurveTo(6.0 - 0.6 * k, 5.9 - 0.2 * k, 5.6 - 0.5 * k, 4.6 - 0.3 * k);
  n.bezierCurveTo(5.6 - 0.2 * k, 3.0, 5.6, 1.4, 4.6, 0.6); // 코 뒤쪽 → 윗입술
  n.quadraticCurveTo(3.0, -0.4, 1.4, -1.2);
  n.closePath();
  return n;
}

export function draw(g, p, H) {
  const { footAt, springTo, rigTick, ell, eye, C, hash } = H;
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  if (!r.jg) r.jg = { x: 0, v: 0 };
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, sp = p.sp ?? -1, real = H.real();
  const special = sp >= 0, moving = p.mv > 0 && !special, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const follow = (key, target, rate) => { r[key] = dt > 0 && r[key] !== undefined ? r[key] + (target - r[key]) * Math.min(1, dt * rate) : target; return r[key]; };
  const ly = special || moving ? 0 : Math.max(p.ly ?? 0, follow('rz', p.st === 'rest' ? 1 : 0, 2));
  const hd = special || moving ? 0 : clamp01(p.hd ?? 0) * (1 - ly);
  const breath = Math.sin((t * TAU) / (ly > 0.5 ? 6.5 : 4.6));
  const idle = !moving && !special && p.st === 'idle', cyc = (t % 13) / 13;
  const flick = idle ? env(cyc, 0.58, 0.63, 0.74, 0.8) : 0; // 가끔 앞지느러미로 눈을 퍼서 등에 끼얹기
  const fl = idle ? clamp01((cyc - 0.6) / 0.16) : 0; // 끼얹기 진행(0 = 퍼 담기, 1 = 등 위로 던짐)
  const twitch = (idle || ly > 0) ? Math.max(0, Math.sin(t * TAU / 4.2)) ** 8 * Math.sin(t * TAU * 5) : 0; // 코 씰룩

  // ---- 특수(포효): 앞몸을 세워 젖히고 → 코를 부풀리며 세 번 포효 → 쿵 내려앉기 ----
  const rise = special ? env(sp, 0.0, 0.18, 0.8, 0.93) : 0;
  const roar = special ? Math.max(env(sp, 0.22, 0.27, 0.36, 0.41), env(sp, 0.44, 0.49, 0.58, 0.63), env(sp, 0.66, 0.7, 0.77, 0.81)) : 0;
  const puff = rise * (0.5 + 0.7 * roar); // 코 부풀림
  const shake = roar * 0.25 * Math.sin(sp * TAU * 40);

  // ---- 자세 섞기 ----
  let P = { s: POSE.stand.s.map((q) => [...q]), w: [...POSE.stand.w], ha: POSE.stand.ha };
  let fc = { x: 0, y: 0, sw: 0 }, hump = 0;
  if (moving) { // 무거운 자벌레 걸음: 가슴 디딤(엉덩이를 끌어당김 → 등이 솟는다) ↔ 엉덩이 디딤(가슴을 앞으로 내민다)
    const st = STRIDE * 0.5;
    fc = footAt(u, st, 1.6, 0.5); const fp = footAt((u + 0.5) % 1, st, 1.0, 0.5);
    hump = ss(clamp01((fp.x - fc.x + st) / (2 * st)));
    const S = P.s;
    S[3][0] += fc.x; S[3][1] -= fc.sw * 1.5 + hump * 0.9;
    S[4][0] += fc.x * 0.95; S[4][1] -= fc.sw * 1.3 + hump * 0.4;
    S[5][0] += fc.x * 0.9; S[5][1] -= fc.sw * 0.9 - 0.4 * Math.sin(u * TAU * 2);
    S[1][0] += fp.x; S[1][1] -= fp.sw * 1.0 + hump * 0.5;
    S[0][0] += fp.x * 0.95; S[0][1] -= fp.sw * 0.6;
    S[2][0] = (S[1][0] + S[3][0]) / 2 - 0.5; S[2][1] -= hump * 2.6;
    P.ha += 0.06 * Math.sin(u * TAU - 1.4);
  } else {
    P.s[3][1] -= 0.3 * breath; P.w[3] += 0.25 * breath; P.w[2] += 0.2 * breath;
    P.ha += 0.04 * Math.sin((r.look ?? 0) * 0.35) + 0.08 * flick;
  }
  // 뱃살 출렁: 등이 솟는 정도·몸 세우기를 스프링이 늦게 따라간다
  const jt = hump * 2.6 + rise * 8;
  if (dt > 0) springTo(r.jg, jt, 55, 4.5, dt); else { r.jg.x = jt; r.jg.v = 0; }
  const jig = (r.jg.x - jt) * (moving ? 0.5 : 0.25) + shake;
  P.s[2][1] += jig * 0.6; P.w[2] += Math.abs(jig) * 0.15; P.s[1][1] += jig * 0.25;
  P = mixPose(P, POSE.eat, hd);
  if (hd > 0) { P.s[5][1] -= hd * 0.35 * Math.max(0, Math.sin(t * TAU * 0.8)); }
  P = mixPose(P, POSE.rest, ly);
  if (ly > 0) { P.s[2][1] -= ly * 0.25 * breath; P.s[3][1] -= ly * 0.3 * breath; P.w[3] += ly * 0.2 * breath; }
  P = mixPose(P, POSE.rear, rise);
  if (rise > 0) { P.s[5][0] += shake * 0.5; P.s[4][0] += shake * 0.3; P.ha -= 0.12 * roar; }
  const S = P.s, R = ribbon(S, P.w);
  const iC = 12; // 가슴 샘플 번호(척추점 3 = 샘플 12)

  // ---- 지느러미 자리 ----
  const fRoot = R.at(iC, 0.32), fRootF = [fRoot[0] + 1.6, fRoot[1] - 0.8];
  const foreTip = (root, far) => {
    let v = [S[3][0] + 1.8 + (far ? 1.6 : 0) - root[0], -1.8 - fc.sw * 1.2 - root[1]];
    if (hd > 0) v = lerp2(v, [3.0, 2.2], hd * 0.4);
    if (ly > 0) v = lerp2(v, far ? [3.2, 1.0] : [-3.6, 2.4], ly); // 납작 엎드려 옆구리에 붙인다
    if (flick > 0 && !far) { const a = lerp(1.15, -2.5, ss(fl)), L = lerp(5.4, 6.4, fl); v = lerp2(v, [Math.cos(a) * L, Math.sin(a) * L], flick); } // 눈 퍼서 휙
    if (rise > 0) { const a = 1.0 + (far ? -0.25 : 0) + 0.12 * Math.sin(sp * TAU * 3), L = 5.4; v = lerp2(v, [Math.cos(a) * L, Math.sin(a) * L], rise); } // 세우면 앞지느러미가 늘어진다
    return [root[0] + v[0], root[1] + v[1]];
  };
  const fTip = foreTip(fRoot, false), fTipF = foreTip(fRootF, true);
  const rr = S[0], rb = Math.atan2(S[0][1] - S[1][1], S[0][0] - S[1][0]);
  const rearA = (far) => rb + (far ? 0.14 : -0.1) + (moving ? 0.06 * Math.sin(u * TAU) : 0);

  // ---- 그림자 ----
  if (p.shadow !== false) ell(g, -2.5, 0, 24, 3.3, 0, 'rgba(40,25,10,0.24)');

  // ---- 먼 쪽 지느러미 ----
  rearFlip(g, C, rr[0], rr[1], rearA(true), 7.0, ES.flipFar);
  foreFlip(g, C, ell, real, fRootF, fTipF, 2.4, 3.2, ES.flipFar);

  // ---- 몸통: 짙은 등 · 밝은 배 · 가슴 방패의 흉터 · 목 주름 ----
  g.fillStyle = C(ES.col); g.fill(R.path);
  ell(g, S[0][0] - 0.3, S[0][1], 2.0, 1.9, 0, ES.col);
  if (real) {
    g.save(); g.clip(R.path);
    g.fillStyle = ES.back; g.fill(R.band(-1.1, -0.45)); // 짙은 등
    g.fillStyle = ES.belly; g.fill(R.band(0.62, 1.1, 2, R.n - 3)); // 밝은 배
    g.fillStyle = 'rgba(255,240,225,0.16)'; g.fill(R.band(-0.92, -0.7, 3, R.n - 5)); // 등 윤기
    g.strokeStyle = ES.scar; g.lineWidth = 0.26; g.lineCap = 'round'; g.beginPath(); // 흉터
    for (let k = 0; k < 5; k++) { const i = 13 + Math.floor(hash(k, 2, 5) * 6), sv = -0.2 + hash(k, 7, 3) * 0.8, q = R.at(i, sv), a = hash(k, 1, 8) * 2 - 1, l = 0.5 + hash(k, 5, 2) * 0.6; g.moveTo(q[0] - Math.cos(a) * l, q[1] - Math.sin(a) * l); g.lineTo(q[0] + Math.cos(a) * l, q[1] + Math.sin(a) * l); }
    g.stroke();
    g.strokeStyle = 'rgba(60,45,34,0.55)'; g.lineWidth = 0.5; g.beginPath(); // 목 주름(머리 쪽으로 볼록한 둥근 줄)
    for (const i of [15, 17, 19]) { const a = R.at(i, -0.85), m = R.at(Math.min(R.n - 1, i + 1), 0), b = R.at(i, 0.85); g.moveTo(a[0], a[1]); g.quadraticCurveTo(m[0], m[1], b[0], b[1]); }
    g.stroke();
    g.strokeStyle = 'rgba(60,45,34,0.3)'; g.lineWidth = 0.4; g.beginPath(); // 옆구리 살 주름
    for (const i of [6, 9]) { const a = R.at(i, -0.2), m = R.at(i + 1, 0.2), b = R.at(i, 0.6); g.moveTo(a[0], a[1]); g.quadraticCurveTo(m[0], m[1], b[0], b[1]); }
    g.stroke();
    g.restore();
  }

  // ---- 가까운 쪽 지느러미 ----
  rearFlip(g, C, rr[0], rr[1], rearA(false), 7.2, ES.flip);
  if (real) {
    g.save(); g.translate(rr[0], rr[1]); g.rotate(rearA(false)); g.strokeStyle = 'rgba(25,15,8,0.38)'; g.lineWidth = 0.28; g.lineCap = 'round'; g.beginPath();
    for (const v of [-0.9, 0, 0.9]) { g.moveTo(1.6, v * 0.5); g.lineTo(6.0, v * 1.9); }
    g.stroke(); g.restore();
  }
  foreFlip(g, C, ell, real, fRoot, fTip, 2.8, 3.6, ES.flip);

  // ---- 끼얹은 눈: 지느러미 끝에서 등 위로 포물선 ----
  if (flick > 0.3 && fl > 0.35) {
    const a = [S[3][0] + 4.5, -0.6], b = R.at(7, -1.0), k = clamp01((fl - 0.35) / 0.65);
    for (let i = 0; i < 7; i++) {
      const v = clamp01(k * 1.5 - i * 0.08); if (v <= 0 || v >= 1) continue;
      const x = lerp(a[0] + (i % 3) * 0.6, b[0] + (i - 3) * 1.6, v), y = lerp(a[1], b[1], v) - Math.sin(v * Math.PI) * (6 + (i % 3) * 1.2);
      ell(g, x, y, 0.75 - (i % 3) * 0.12, 0.62 - (i % 3) * 0.1, 0, ES.snow);
    }
  }

  // ---- 머리: 크고 뭉툭한 머리, 늘어진 코(부풀림), 작은 눈. 아래턱은 경첩(1.2, 2.3)으로 열린다 ----
  const hc = S[5], ha = P.ha;
  const jaw = roar * 0.95 + (hd > 0 ? hd * 0.12 * Math.max(0, Math.sin(t * TAU * 0.8)) : 0);
  const closed = ly > 0.5 || r.blink > 0 || roar > 0.6;
  g.save(); g.translate(hc[0], hc[1]); g.rotate(ha);
  if (jaw > 0.04) { // 입 안 + 아랫니
    const c = Math.cos(jaw), s = Math.sin(jaw), ex = 1.2 + 4.2 * c - 0.3 * s, ey = 2.3 + 4.2 * s + 0.3 * c;
    g.fillStyle = C(ES.mouth); g.beginPath(); g.moveTo(0.9, 2.1); g.lineTo(5.6, 2.2); g.quadraticCurveTo(ex + 1.0, ey - 0.6, ex, ey); g.closePath(); g.fill();
    if (real) { ell(g, 1.2 + 2.4 * c, 2.6 + 2.4 * s, 1.6, 0.6, jaw, ES.tongue); ell(g, ex - 0.2 * c, ey - 0.6, 0.28, 0.5, jaw, ES.tooth); }
  }
  g.save(); g.translate(1.2, 2.3); g.rotate(jaw); g.translate(-1.2, -2.3); // 아래턱
  g.fillStyle = C(ES.col); g.beginPath(); g.moveTo(0.2, 1.9); g.quadraticCurveTo(3.0, 2.3, 4.6, 2.5); g.quadraticCurveTo(4.6, 3.9, 2.8, 4.0); g.quadraticCurveTo(0.6, 3.9, -0.6, 3.0); g.closePath(); g.fill();
  g.restore();
  ell(g, 0, -0.3, 4.2, 3.7, 0, ES.col); // 머리
  ell(g, 2.9, 1.5, 2.2, 1.4, 0.05, ES.col); // 윗입술
  if (real) {
    g.save(); g.beginPath(); g.ellipse(0, 0, 4.4, 3.9, 0, 0, TAU); g.clip();
    g.fillStyle = ES.back; g.beginPath(); g.ellipse(-1.4, -3.2, 4.0, 1.7, -0.1, 0, TAU); g.fill();
    g.fillStyle = ES.shield; g.beginPath(); g.ellipse(-0.8, 2.8, 3.4, 1.5, 0, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = ES.whisk; g.lineWidth = 0.18; g.lineCap = 'round'; g.beginPath(); // 수염(코 뒤 윗입술에서 아래로)
    for (const [x, y] of [[4.6, 3.6], [4.0, 4.0]]) { g.moveTo(3.2, 2.3); g.lineTo(x, y); }
    g.stroke();
  }
  // 코: 숨쉬기·씰룩에 따라 살짝 흔들리고, 포효 땐 크게 부푼다
  g.save(); g.translate(1.0, -2.4); g.rotate(0.05 * twitch + 0.02 * breath * (1 - rise)); g.translate(-1.0, 2.4);
  const k = puff;
  g.fillStyle = C(ES.nose); g.fill(nosePath(k));
  if (real) {
    g.fillStyle = ES.noseHi; g.beginPath(); g.ellipse(4.6 + k * 0.6, -3.0 - k * 1.0, 2.4 + k * 0.8, 0.9 + k * 0.5, 0.15, 0, TAU); g.fill(); // 코 등 윤기
    g.strokeStyle = 'rgba(40,30,22,0.5)'; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath(); // 코 주름(늘어진 앞쪽에 가로로)
    for (let i = 0; i < 3; i++) { const y = 0.9 + i * 1.25 - k * 0.3; g.moveTo(5.9 - i * 0.1, y + 0.1); g.quadraticCurveTo(7.0 + k * 0.5, y + 0.45, 7.9 + k * 1.1 - i * 0.35, y - 0.1); }
    g.stroke();
    ell(g, 6.2 - 0.5 * k, 5.45 - 0.25 * k, 0.55, 0.3, 0.2, ES.nostril); // 콧구멍
  }
  g.restore();
  if (real) { ell(g, 0.5, -1.0, 0.95, 0.85, 0, ES.rim); g.strokeStyle = ES.fold; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-0.7, -2.0); g.quadraticCurveTo(0.5, -2.6, 1.6, -1.9); g.stroke(); } // 눈가·눈두덩
  eye(g, 0.5, -1.0, 0.6, closed);
  g.restore();

  // ---- 포효 소리 물결 ----
  if (rise > 0.4 && roar > 0.15) {
    const c = Math.cos(ha), s = Math.sin(ha), m = [hc[0] + c * 6.5 - s * 3.4, hc[1] + s * 6.5 + c * 3.4], dir = ha + 0.35;
    g.strokeStyle = C('#ffffff'); g.lineCap = 'round';
    for (let q = 0; q < 3; q++) {
      const v = (sp * 9 + q / 3) % 1, rad = 3 + v * 9;
      g.lineWidth = 1.3 * (1 - v * 0.5) * Math.min(1, roar * 2); if (g.lineWidth < 0.2) continue;
      g.beginPath(); g.arc(m[0], m[1], rad, dir - 0.55, dir + 0.55); g.stroke();
    }
  }
}
