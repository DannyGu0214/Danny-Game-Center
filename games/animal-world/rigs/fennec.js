// 사막여우(페넥) 리그: 작은 크림색 여우. 아주 큰 귀(안쪽 분홍·흰 털), 크고 까만 눈과 코, 눈 밑 짙은 줄, 끝이 검은 풍성한 꼬리, 가는 다리, 짙은 발.
// 걷기: 작은 갯과처럼 가볍게 4박 종종걸음(가까운 뒷다리 → 가까운 앞다리 → 먼 뒷다리 → 먼 앞다리).
// 쉬기(두 귀가 따로 이리저리 돌아간다·고개 갸웃·깜빡임·꼬리 살랑, 가끔 앉기)·먹기(고개 숙여 킁킁 오물오물)·물(고개 숙여 할짝)
// ·눕기(동그랗게 웅크려 꼬리로 코를 덮고 귀는 뒤로 눕히고 눈 감기)·특수 행동(큰 귀를 쫑긋 세워 땅 쪽으로 기울여 듣다가 앞발로 빠르게 파기, 모래가 뒤로 튄다).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 5; // 한 걸음 주기 동안 몸이 나아가는 거리(그림 단위)
export const BOX = [9, 16];
const TAU = Math.PI * 2;
const DUTY = 0.62; // 4박 걷기
const OFFS = { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 };
const FX = {
  col: '#f0d6a4', belly: '#fbf3e2', earIn: '#f0bfae', earFur: '#fffaf0', tip: '#3a2a20', nose: '#1e1510', paw: '#8a6646', stripe: '#a87a4c',
  sand: '#e2b877', sand2: '#c99858', tongue: '#d9707a', mouth: '#8a5a40',
};
const LEG = { hind: { a: 2.6, b: 2.7, c: 1.9 }, fore: { a: 2.7, b: 2.6, c: 0.9 } };
// 자세: 엉덩이 H·어깨 S, 머리(어깨 기준) hd·각도 ha, 꼬리(뿌리 기준 3차 곡선 c1·c2·끝 tt), 귀 기울기 ear
const POSE = {
  stand: { H: [-3.3, -6.0], S: [2.9, -6.3], hd: [3.0, -2.9], ha: 0.05, c1: [-1.8, 1.2], c2: [-3.4, 3.4], tt: [-4.2, 5.3], ear: 0 },
  walk: { H: [-3.3, -5.9], S: [2.9, -6.1], hd: [3.4, -2.3], ha: 0.12, c1: [-2.0, 0.8], c2: [-4.0, 2.2], tt: [-5.6, 3.6], ear: -0.15 },
  sit: { H: [-2.3, -2.6], S: [2.4, -6.5], hd: [2.5, -3.2], ha: 0.0, c1: [-1.4, 1.6], c2: [-0.2, 3.4], tt: [3.2, 3.3], ear: 0 },
  eat: { H: [-3.4, -6.0], S: [2.7, -5.3], hd: [3.0, 2.5], ha: 0.95, c1: [-1.8, 1.0], c2: [-3.4, 3.0], tt: [-4.4, 4.8], ear: 0.25 },
  drink: { H: [-3.4, -6.0], S: [2.7, -5.2], hd: [2.9, 2.8], ha: 1.0, c1: [-1.8, 1.0], c2: [-3.4, 3.0], tt: [-4.4, 4.8], ear: 0.15 },
  rest: { H: [-1.9, -2.7], S: [1.3, -2.7], hd: [2.6, 0.1], ha: 0.12, c1: [-2.4, 2.7], c2: [3.0, 3.7], tt: [9.8, 2.6], ear: -1.35 },
  listen: { H: [-3.3, -6.1], S: [2.8, -5.5], hd: [3.0, -0.8], ha: 0.55, c1: [-2.0, 0.4], c2: [-3.8, 0.8], tt: [-5.4, 1.6], ear: 0.3 },
  dig: { H: [-3.1, -6.6], S: [2.6, -4.5], hd: [2.8, 0.7], ha: 0.5, c1: [-1.6, -1.6], c2: [-3.6, -2.4], tt: [-5.4, -1.6], ear: 0.3 },
};

const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
function mixPose(A, B, k) {
  if (k <= 0) return A;
  const o = {};
  for (const key of Object.keys(A)) { const a = A[key], b = B[key]; o[key] = Array.isArray(a) ? lerp2(a, b, k) : lerp(a, b, k); }
  return o;
}
function bones(g, C, pts, ws, col) {
  g.fillStyle = C(col); g.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath();
  }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], w = ws[i] / 2; g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU, true); }
  g.fill();
}
// 풍성한 꼬리: 3차 곡선을 따라 가운데가 두껍고 끝이 둥근 모양(땅 밑으로는 내려가지 않게)
function tailPath(B, c1, c2, E) {
  const n = 12, P = [], L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, m = 1 - s;
    P.push([m * m * m * B[0] + 3 * m * m * s * c1[0] + 3 * m * s * s * c2[0] + s * s * s * E[0], m * m * m * B[1] + 3 * m * m * s * c1[1] + 3 * m * s * s * c2[1] + s * s * s * E[1]]);
  }
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const w = 0.55 + 1.15 * Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.98)) + 0.25 * s;
    const lp = [P[i][0] + nx * w, P[i][1] + ny * w], rp = [P[i][0] - nx * w, P[i][1] - ny * w];
    lp[1] = Math.min(lp[1], -0.05); rp[1] = Math.min(rp[1], -0.05);
    L.push(lp); R.push(rp);
  }
  const path = new Path2D(), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  path.moveTo(...L[0]);
  for (let i = 1; i < n; i++) path.quadraticCurveTo(...L[i], ...mid(L[i], L[i + 1]));
  const a = P[n - 1], e = P[n], dx = e[0] - a[0], dy = e[1] - a[1], l = Math.hypot(dx, dy) || 1;
  path.lineTo(...L[n]); path.quadraticCurveTo(e[0] + (dx / l) * 1.9, Math.min(-0.05, e[1] + (dy / l) * 1.9), ...R[n]); // 둥근 끝
  for (let i = n - 1; i > 0; i--) path.quadraticCurveTo(...R[i], ...mid(R[i], R[i - 1]));
  path.lineTo(...R[0]); path.closePath();
  return { path, end: e, dir: [dx / l, dy / l], P };
}

let HEAD = null;
function paths() {
  if (HEAD) return;
  HEAD = new Path2D(); // 머리 좌표(머리 중심 기준, 오른쪽이 코): 둥근 머리 + 가늘고 뾰족한 주둥이
  HEAD.moveTo(-2.0, 0.4);
  HEAD.quadraticCurveTo(-2.3, -2.0, 0.0, -2.15);
  HEAD.quadraticCurveTo(1.5, -2.2, 2.0, -0.9);
  HEAD.quadraticCurveTo(2.5, -0.15, 3.25, 0.1);
  HEAD.quadraticCurveTo(3.55, 0.5, 3.0, 0.8);
  HEAD.quadraticCurveTo(2.1, 1.35, 0.9, 1.75);
  HEAD.quadraticCurveTo(-1.4, 1.95, -2.0, 0.4);
  HEAD.closePath();
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C, shade, taper } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const spc = sp >= 0, moving = p.mv > 0 && !spc, ph = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  // 사막 동물은 게임에서 ly를 받지 못하므로 상태로 직접 웅크린다(아이콘처럼 dt가 없으면 바로)
  const restT = !spc && !moving && p.st === 'rest' ? 1 : 0;
  const ly = Math.max(spc || moving ? 0 : p.ly ?? 0, dt > 0 ? clamp01(spring('rest', restT, 12, 7)) : restT);
  const eat = p.st === 'eat' && !moving && !spc ? hd * (1 - ly) : 0, drink = p.st === 'drink' && !moving && !spc ? hd * (1 - ly) : 0;
  const breath = Math.sin(t * TAU / 2.2), far = shade(FX.col, 0.82), farPaw = shade(FX.paw, 0.8);

  // ---- 특수 행동: 0~0.34 귀 쫑긋·땅에 귀 기울이기 → 0.34~0.94 앞발로 빠르게 파기 ----
  const listen = spc ? ss(sp / 0.06) * (1 - ss((sp - 0.3) / 0.06)) : 0;
  const dig = spc ? ss((sp - 0.3) / 0.06) * (1 - ss((sp - 0.93) / 0.06)) : 0;
  // ---- 가끔 앉기(쉴 때) ----
  const sc = (t % 17) / 17, sit = moving || spc ? 0 : ss((sc - 0.55) / 0.05) * ss((0.95 - sc) / 0.05) * (1 - hd) * (1 - ly);

  // ---- 자세 섞기 ----
  let P = moving ? POSE.walk : POSE.stand;
  if (!moving) {
    P = mixPose(P, POSE.sit, sit);
    if (eat > 0) P = mixPose(P, POSE.eat, eat);
    if (drink > 0) P = mixPose(P, POSE.drink, drink);
    if (ly > 0) P = mixPose(P, POSE.rest, ly);
    if (listen > 0) P = mixPose(P, POSE.listen, listen);
    if (dig > 0) P = mixPose(P, POSE.dig, dig);
  }
  const bob = moving ? Math.sin(ph * TAU * 2) * 0.22 : 0, digShake = dig * Math.sin(t * TAU * 5) * 0.12;
  const hip = [P.H[0], P.H[1] + bob + 0.06 * breath * (1 - ly)], sh = [P.S[0], P.S[1] + (moving ? Math.sin(ph * TAU * 2 + 1.3) * 0.22 : 0) + digShake];

  // ---- 다리: 서 있으면 IK로 발을 땅에, 걸으면 발 고정 걸음, 앉으면 뒷발목을 땅에, 파기면 앞발로 번갈아 긁기 ----
  const stroke = STRIDE * DUTY;
  const legPts = (key, root, cfg, front) => {
    const x = root[0];
    let f;
    if (moving) { const u = footAt((ph + OFFS[key]) % 1, stroke, 1.2, DUTY); f = { x: u.x + x + (front ? 0.5 : 0.9), y: u.y, sw: u.sw, st: u.st }; }
    else {
      f = { x: x + (front ? 0.5 + eat * 0.6 : 0.9) + (key === 'fh' ? -0.9 : key === 'ff' ? 0.9 : 0), y: 0, sw: 0, st: 0.45 };
      if (!front && sit > 0) f.x = lerp(f.x, x + 2.7 + (key === 'fh' ? 0.5 : 0), sit);
      if (front && dig > 0) { // 앞발 긁기: 공중에서 앞으로 뻗어 땅을 짚고 뒤로 확 끌어당긴다
        const c = t * TAU * 3.2 + (key === 'ff' ? Math.PI : 0);
        const dx = x + 1.4 - 1.7 * Math.cos(c), dy = -Math.max(0, Math.sin(c)) * 1.5;
        f = { x: lerp(f.x, dx, dig), y: lerp(f.y, dy, dig), sw: dig * Math.max(0, Math.sin(c)), st: 0.45 };
      }
    }
    // 발목 각도(수직에서): 디딜 땐 비스듬히, 들 땐 앞다리는 손목이 꺾여 발바닥이 뒤로, 뒷다리는 발이 매달린다. 앉으면 뒷발목이 땅에 눕는다
    let th = front ? 1.0 * f.sw + (-0.12 + (f.st - 0.45) * 0.5) * (1 - f.sw) : 0.3 * f.sw + (-0.42 + (f.st - 0.5) * 0.4) * (1 - f.sw);
    if (!front && sit > 0) th = lerp(th, -1.5, sit);
    const paw = [f.x, f.y], ankle = [paw[0] + cfg.c * Math.sin(th), paw[1] - cfg.c * Math.cos(th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a, cfg.b, front ? -1 : 1);
    return [root, knee, end, paw, f.sw];
  };
  const curled = ly > 0.5;
  const legs = {
    fh: legPts('fh', [hip[0] + 0.8, hip[1] - 0.2], LEG.hind, false), ff: legPts('ff', [sh[0] + 0.8, sh[1] - 0.2], LEG.fore, true),
    nh: legPts('nh', hip, LEG.hind, false), nf: legPts('nf', sh, LEG.fore, true),
  };
  if (p.shadow !== false) {
    ell(g, (hip[0] + sh[0]) / 2 - 0.3, 0, curled ? 6.4 : 7.2, 1.7, 0, 'rgba(40,25,10,0.22)');
    if (!curled && real) for (const k of ['nh', 'nf', 'fh', 'ff']) { const [x, y] = legs[k][3]; if (y > -0.3) ell(g, x + 0.5, 0.15, 1.3, 0.4, 0, 'rgba(40,25,10,0.22)'); }
  }
  const drawLeg = (L, col, pawCol, near, front) => {
    if (curled) return;
    bones(g, C, [L[1], L[2], L[3]], front ? [1.05, 0.8, 0.7] : [1.15, 0.75, 0.68], col);
    bones(g, C, [L[0], L[1]], front ? [1.5, 1.1] : [2.3, 1.2], col);
    const a = Math.atan2(L[3][1] - L[2][1], L[3][0] - L[2][0]) - Math.PI / 2;
    g.save(); g.translate(L[3][0], L[3][1]); g.rotate(a * 0.5);
    ell(g, 0.3, -0.38, 0.8, 0.42, 0, pawCol); // 짙은 발
    g.restore();
    if (near && real) ell(g, L[2][0], L[2][1], 0.3, 0.3, 0, shade(FX.col, 0.9));
  };

  // ---- 꼬리(뒤에 그릴 것) ----
  const TB = [hip[0] - 1.7, hip[1] - 1.2];
  const swayT = moving ? Math.sin(ph * TAU) * 0.6 : (1 - ly) * (0.5 * Math.sin(t * 1.3) + spring('tw', r.swish * 1.2, 30, 5));
  const wag = dig * Math.sin(t * TAU * 2.4) * 0.6;
  const tail = tailPath(TB, [TB[0] + P.c1[0], TB[1] + P.c1[1]], [TB[0] + P.c2[0] + swayT * 0.5, TB[1] + P.c2[1] - swayT * 0.2 + wag], [TB[0] + P.tt[0] + swayT, TB[1] + P.tt[1] - swayT * 0.4 + wag * 1.6]);
  const drawTail = () => {
    if (curled && real) { g.strokeStyle = 'rgba(150,105,55,0.45)'; g.lineWidth = 0.35; g.stroke(tail.path); } // 몸 앞을 감쌀 땐 테두리 그늘로 구분
    g.fillStyle = C(FX.col); g.fill(tail.path);
    g.save(); g.clip(tail.path);
    const [ex, ey] = tail.end, [ux, uy] = tail.dir;
    ell(g, ex + ux * 0.5, ey + uy * 0.5, 2.4, 2.4, 0, FX.tip); // 검은 꼬리 끝
    g.restore();
  };
  if (!curled) drawTail();

  // ---- 먼 쪽 다리 ----
  drawLeg(legs.fh, far, farPaw, false, false);
  drawLeg(legs.ff, far, farPaw, false, true);

  // ---- 몸통: 엉덩이·등·어깨·가슴·잘록한 배 ----
  const [hx, hy] = hip, [sx, sy] = sh, mx = (hx + sx) / 2, top = Math.min(hy, sy);
  const bd = curled ? 1.4 : 1; // 웅크리면 둥글게
  const body = new Path2D();
  body.moveTo(hx + 0.6, hy - 2.0 * bd);
  body.quadraticCurveTo(mx, top - 2.3 * bd, sx - 0.4, sy - 2.0 * bd);
  body.quadraticCurveTo(sx + 2.0, sy - 1.9, sx + 2.1, sy + 0.1);
  body.quadraticCurveTo(sx + 1.9, sy + 1.9, sx - 0.2, sy + 1.9);
  body.quadraticCurveTo(mx, (hy + sy) / 2 + (curled ? 2.2 : 1.35), hx + 0.8, hy + 1.7);
  body.quadraticCurveTo(hx - 2.0, hy + 1.8, hx - 2.1, hy - 0.3);
  body.quadraticCurveTo(hx - 1.9, hy - 2.0 * bd, hx + 0.6, hy - 2.0 * bd);
  body.closePath();
  // 목(머리까지 굵게 이어진다)
  const hc = [sx + P.hd[0], sy + P.hd[1]];
  taper(g, sx + 0.9, sy - 1.0, hc[0] - 0.8, hc[1] + 0.4, 3.6, 2.8, FX.col);
  g.fillStyle = C(FX.col); g.fill(body);
  if (real) {
    g.save(); g.clip(body);
    g.fillStyle = FX.belly; g.beginPath(); g.ellipse(sx + 0.6, sy + 1.6, 2.6, 1.5, -0.3, 0, TAU); g.fill(); // 흰 가슴
    g.beginPath(); g.ellipse(mx, (hy + sy) / 2 + 1.9, 3.6, 0.9, 0, 0, TAU); g.fill(); // 흰 배
    g.fillStyle = 'rgba(180,130,70,0.22)'; g.beginPath(); g.ellipse(mx - 0.4, top - 2.0 * bd, 4.6, 0.8, (sy - hy) / 12, 0, TAU); g.fill(); // 등 쪽 진한 털
    g.restore();
  }

  // ---- 가까운 쪽 다리(허벅지는 몸 위에 둥글게) ----
  if (curled) { // 웅크림: 앞발은 턱 밑으로 내밀고, 뒷다리는 옆구리에 접는다
    ell(g, hx + 0.6, hy + 0.5, 2.3, 1.7, -0.3, FX.col);
    if (real) { g.strokeStyle = 'rgba(160,115,60,0.35)'; g.lineWidth = 0.3; g.beginPath(); g.ellipse(hx + 0.6, hy + 0.5, 2.0, 1.45, -0.3, -2.4, 0.6); g.stroke(); }
    ell(g, hx + 2.6, -0.45, 1.0, 0.45, 0, FX.paw);
    ell(g, sx + 1.7, -0.45, 1.0, 0.45, 0, FX.paw);
  } else {
    drawLeg(legs.nh, FX.col, FX.paw, true, false);
    const kn = legs.nh[1], ta = Math.atan2(kn[1] - hip[1], kn[0] - hip[0]);
    ell(g, (hip[0] + kn[0]) / 2 - 0.2, (hip[1] + kn[1]) / 2 - 0.2, 2.3, 1.6, ta, FX.col); // 허벅지
    drawLeg(legs.nf, FX.col, FX.paw, true, true);
  }
  // 파기: 앞발 사이에서 모래가 뒷다리 사이로 튄다
  if (dig > 0.2) {
    for (let i = 0; i < 5; i++) {
      const s = (t * 2.6 + i / 5) % 1, x0 = sx + 1.2, x1 = hx - 3.5 - (i % 2) * 1.5;
      const x = lerp(x0, x1, s), y = -0.3 - 4.2 * s * (1 - s) * (1.2 + (i % 3) * 0.25), rr = 0.35 + 0.35 * s;
      ell(g, x, y, rr, rr * 0.85, 0, i % 2 ? FX.sand : FX.sand2);
    }
    ell(g, sx + 1.3, -0.15, 1.6 * dig, 0.45 * dig, 0, FX.sand2); // 판 자리
  }

  // ---- 머리: 귀(따로 도는 스프링)·눈·코 ----
  // 귀: 쉴 땐 각자 가끔 새 방향을 골라 스프링으로 돌아간다. 아이콘(dt 없음)은 기본 자세
  if (dt > 0) {
    for (const k of ['eN', 'eF']) { r[k + 't'] = (r[k + 't'] ?? Math.random() * 2) - dt; if (r[k + 't'] <= 0) { r[k + 'g'] = (Math.random() - 0.5) * 0.7; r[k + 't'] = 1.2 + Math.random() * 3; } }
  }
  const idleEar = moving || spc || ly > 0.5 ? 0 : 1;
  const perk = listen * 0.25 + dig * 0.1;
  const eN = spring('eN', P.ear + idleEar * (r.eNg ?? 0) - perk * 0.3, 70, 7) + r.ear.x * 0.35, eF = spring('eF', P.ear + idleEar * (r.eFg ?? 0) + 0.1 - perk * 0.2, 70, 7);
  const twitch = listen * (Math.max(0, Math.sin(t * TAU * 1.3)) ** 8) * 0.25; // 들으며 귀를 움찔
  const tilt = (1 - ly) * (moving ? 0 : 0.14 * Math.sin(t * 0.5) * Math.sin(t * 0.21)) + listen * 0.25 * Math.sin(Math.min(1, sp / 0.3) * Math.PI);
  const nib = (eat > 0.3 ? Math.sin(t * TAU * 2.6) : 0) * (1 - ly);
  const ha = P.ha + tilt + nib * 0.05 + (moving ? 0.04 * Math.sin(ph * TAU * 2 - 0.5) : 0);
  const ear = (x, y, ang, yaw, col, inner) => {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(Math.max(0.55, Math.min(1.2, 1 + yaw)), 1);
    g.fillStyle = C(col); g.beginPath();
    g.moveTo(-1.45, 0.3); g.bezierCurveTo(-2.1, -2.4, -1.3, -5.0, 0.05, -6.1);
    g.bezierCurveTo(1.15, -4.9, 1.75, -2.4, 1.45, 0.3); g.closePath(); g.fill();
    if (inner && real && yaw > -0.3 && ly < 0.5) {
      g.fillStyle = FX.earIn; g.beginPath();
      g.moveTo(-0.95, -0.2); g.bezierCurveTo(-1.45, -2.4, -0.85, -4.4, 0.05, -5.3);
      g.bezierCurveTo(0.8, -4.3, 1.15, -2.3, 0.95, -0.2); g.closePath(); g.fill();
      g.fillStyle = FX.earFur; g.beginPath(); // 귓속 흰 털(앞쪽 가장자리를 따라 보송하게)
      g.ellipse(0.75, -1.5, 0.28, 1.1, 0.15, 0, TAU); g.moveTo(-0.3, -0.7); g.ellipse(-0.55, -0.7, 0.26, 0.5, -0.3, 0, TAU); g.fill();
    }
    g.restore();
  };
  const closed = r.blink > 0 || ly > 0.6;
  g.save(); g.translate(hc[0], hc[1]); g.rotate(ha); g.scale(0.92, 0.92);
  ear(0.3, -1.7, eF - 0.12 - twitch * 0.6, -(r.eFg ?? 0) * 0.6 - perk, shade(FX.col, 0.85), false);
  g.fillStyle = C(FX.col); g.fill(HEAD);
  if (real) {
    g.save(); g.clip(HEAD);
    g.fillStyle = FX.belly; g.beginPath(); g.ellipse(1.4, 1.2, 2.2, 0.9, -0.1, 0, TAU); g.fill(); // 흰 뺨·턱
    g.fillStyle = 'rgba(180,130,70,0.2)'; g.beginPath(); g.ellipse(0.2, -1.7, 1.8, 0.6, 0, 0, TAU); g.fill(); // 정수리
    g.restore();
    g.strokeStyle = FX.stripe; g.lineWidth = 0.24; g.lineCap = 'round'; g.beginPath(); g.moveTo(1.55, -0.12); g.quadraticCurveTo(1.95, 0.05, 2.2, 0.4); g.stroke(); // 눈 앞에서 입가로 내려가는 짙은 줄
    if (nib !== 0 || drink > 0.3) { g.strokeStyle = FX.mouth; g.lineWidth = 0.18; g.beginPath(); g.moveTo(3.0, 0.78); g.quadraticCurveTo(2.4, 1.15 + Math.max(0, nib) * 0.2, 1.8, 1.1); g.stroke(); }
    if (drink > 0.5 && Math.sin(t * TAU * 2.5) > 0.1) ell(g, 3.05, 1.25, 0.32, 0.5, 0.2, FX.tongue); // 할짝
  }
  if (closed) { g.strokeStyle = C('#3a2a1c'); g.lineWidth = 0.22; g.lineCap = 'round'; g.beginPath(); g.moveTo(0.6, -0.45); g.quadraticCurveTo(1.15, -0.05, 1.75, -0.4); g.stroke(); }
  else { ell(g, 1.15, -0.45, 0.68, 0.62, -0.15, '#1a1410'); if (real) { ell(g, 1.4, -0.7, 0.24, 0.24, 0, '#ffffff'); ell(g, 0.95, -0.2, 0.1, 0.1, 0, '#ffffff'); } }
  const sniff = (eat > 0.3 || listen > 0.3) ? Math.sin(t * TAU * 6) * 0.08 : 0;
  ell(g, 3.15, 0.32 + sniff, 0.42, 0.36, 0.2, FX.nose);
  ear(-0.7, -1.5, eN - 0.3 - twitch, (r.eNg ?? 0) * 0.6 + perk * 0.5, FX.col, true);
  g.restore();
  if (curled) drawTail(); // 웅크리면 꼬리로 코를 덮는다
}
