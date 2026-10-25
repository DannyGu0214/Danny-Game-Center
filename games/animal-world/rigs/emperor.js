// 황제펭귄 리그(XL): 네 펭귄 중 가장 크고 듬직하다. 회청색 등과 검은 머리, 귀에서 목으로 이어지는 노란 주황 무늬가 가슴에서 연노랑으로 옅어진다,
// 길고 살짝 아래로 굽은 검은 부리(아랫부리에 분홍빛 주황 띠), 검은 발.
// 걷기(종종걸음 뒤뚱)·쉬기(숨쉬기·깜빡·두리번·뒤돌아보기·날개 털기·깃 고르기)·먹기(허리 숙여 물고기 쪼아 꿀꺽)·물(눈 떠먹기)·눕기(배 깔고 엎드리기)
// 특수 행동(고개 숙여 인사하기: 천천히 깊이 숙여 부리를 가슴께로 내리고, 눈을 지그시 감고 머문 뒤, 천천히 일어난다).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 4.5; // 한 걸음 주기(두 발 한 번씩) 동안 나아가는 거리
export const BOX = [9, 32];
const SPEC = {
  S: 1.34, seed: 0.8,
  body: { ht: 16, fw: 5.8, bw: 5.3, nf: 2.6, nb: 2.8, yw: 0.36, bx: 0.06, clear: 1.0, tail: 2.4, tailA: 0.4 },
  head: { rx: 3.5, ry: 3.0, nj: [0.4, 0.3], off: [0.6, -2.2] },
  beak: { x0: 2.75, y0: 0.5, len: 4.8, dep: 1.0, cv: 0.75, up: '#1a1b1e', lo: '#1a1b1e', stripe: '#f39a7c' },
  flip: { len: 9.0, w: 2.7, root: [-0.5, -12.2] },
  foot: { len: 3.2, lift: 1.0 },
  col: {
    back: '#56637a', backFar: '#414c5e', flip: '#4a566b', head: '#15171a', tail: '#2a3140', belly: '#fbfbf6', chest: '#ffd75e', chest2: '#fff3c2', ear: '#ffc23a', ear2: '#ffe27a', edge: '#2a2f38',
    leg: '#2d2e33', legFar: '#1c1d21', foot: '#303136', footFar: '#1f2024', flipEdge: null, ring: '#2c3036',
  },
  drawHead(g, H, Q) {
    const { rx, ry } = SPEC.head, c = SPEC.col, ex = rx * 0.32 * Q.bk + 0.15, ey = -ry * 0.2;
    H.ell(g, 0, 0, rx, ry, 0, c.head);
    g.fillStyle = H.C(c.ear); g.beginPath(); // 귀 무늬: 눈 뒤에서 목 옆을 감싸며 아래로 넓어진다
    g.moveTo(-0.5, -0.9); g.quadraticCurveTo(-2.3, -0.4, -2.3, 1.6); g.quadraticCurveTo(-2.1, 3.7, 0.3, 3.9); g.quadraticCurveTo(-0.6, 2.4, -0.3, 1.0); g.quadraticCurveTo(-0.1, 0.0, -0.5, -0.9); g.closePath(); g.fill();
    if (Q.real) { g.fillStyle = c.ear2; g.beginPath(); g.moveTo(-1.6, 1.2); g.quadraticCurveTo(-1.6, 3.1, 0.1, 3.6); g.quadraticCurveTo(-1.1, 2.6, -1.0, 1.4); g.closePath(); g.fill(); }
    beak(g, H, Q);
    peye(g, H, ex, ey, 0.42, Q.closed, c.ring);
  },
  marks(g, H, M) { // 몸 안: 검은 목덜미 → 노란 윗가슴이 연노랑으로 옅어져 흰 배 → 등과 배 사이 어두운 띠
    const B = SPEC.body, c = SPEC.col, S = shapes();
    if (M.real) {
      const gr = g.createLinearGradient(0, -B.ht * 0.95, 0, -B.ht * 0.45);
      gr.addColorStop(0, c.chest); gr.addColorStop(0.45, c.chest2); gr.addColorStop(1, c.belly);
      g.fillStyle = gr; g.fill(S.belly);
    }
    g.fillStyle = H.C(c.head); g.beginPath(); g.ellipse(-0.7, -B.ht - 0.4, B.bw * 0.95, B.ht * 0.15, 0.12, 0, TAU); g.fill();
    g.strokeStyle = H.C(c.edge); g.lineWidth = 0.45; g.stroke(S.edge);
  },
  // 인사: 천천히 깊이 숙이기(0~0.34) → 머물기(~0.66, 눈 감기) → 천천히 일어나기(~0.96)
  special(s, P) {
    const bow = win(s, 0, 0.66, 0.34, 0.3), deep = 0.04 * Math.sin(clamp01((s - 0.34) / 0.32) * Math.PI);
    P.lean += bow * 0.6 + deep; P.headRel += bow * 1.2 + deep; P.headExt -= bow * 0.5; P.neck += bow * 0.2;
    P.flipN -= bow * 0.12; P.flipF += bow * 0.25; P.sy -= 0.02 * bow;
    if (bow > 0.85) P.closed = true;
  },
};

// ==== 공통 펭귄 빌더(adelie·gentoo·king·emperor.js에 똑같이 들어 있다. 고칠 땐 네 파일을 함께 고친다) ====
// 펭귄은 N 단위로 그린 뒤 SPEC.S배로 키운다. 몸 좌표 = 원점이 몸 밑 가운데, 위가 -y, 배(앞)가 +x.
// 포즈(P): lean 앞으로 숙임 · tilt 뒤뚱 기울기 · lift 들림 · dx 앞뒤 이동 · sx·sy 늘이기 · chest 가슴 부풀림 · headRel 몸에 대한 고개 각도
//          headExt 목 늘이기 · yaw 고개 돌리기(0 옆, 0.5 정면, 1 뒤) · open 부리 벌림 · flipN·flipF 날개 각도(+면 끝이 뒤로)
//          lie 배 깔고 엎드림 · reach 부리 끝 목표 높이 {y, w}(허리 숙임을 풀어 맞춘다) · kick·padN·padF 엎드려 발·날개로 밀기
//          hAbs·hW 몸 기울기와 상관없는 고개 각도와 그 비중(땅 쪼기·줍기) · neck 목을 앞아래로 빼기(0~1, 몸 높이의 0.2배) · bx 발은 두고 몸만 앞뒤로 · roll 뒤뚱일 때 흰 배가 보이는 폭
const TAU = Math.PI * 2;
const DUTY = 0.6; // 종종걸음: 한 발이 땅에 있는 비율
const TH_LIE = Math.PI / 2 - 0.1; // 엎드린 몸 기울기(머리 쪽이 살짝 들린다)
const EAT_HA = 1.4; // 땅을 쫄 때 고개(부리) 각도(몸 기울기와 상관없이 땅을 향한다)
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const win = (s, a, b, ra, rb = ra) => ss((s - a) / ra) * (1 - ss((s - b) / rb)); // a에서 켜지고 b에서 꺼지는 창
const cubic = (a, b, c, d, t) => { const u = 1 - t; return [0, 1].map((i) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i]); };

let SH = null;
function shapes() {
  if (SH) return SH;
  const { ht, fw, bw, nf, nb, yw, bx, tail } = SPEC.body, yW = -ht * yw, F = SPEC.flip, FT = SPEC.foot.len;
  // 몸: 목 뒤 → 등 → 엉덩이 → 배 밑 → 불룩한 배 → 가슴 → 목 앞
  const segs = [
    [[-nb, -ht], [-nb - bw * 0.3, -ht * 0.8], [-bw, yW - ht * 0.24], [-bw, yW]],
    [[-bw, yW], [-bw, yW + ht * 0.22], [-bw * 0.62, 0.5], [0, 0.5]],
    [[0, 0.5], [fw * 0.62, 0.5], [fw, yW + ht * 0.24], [fw, yW]],
    [[fw, yW], [fw, yW - ht * 0.3], [nf + 0.7, -ht * 0.88], [nf, -ht]],
  ];
  const body = new Path2D();
  body.moveTo(-nb, -ht);
  for (const [, a, b, c] of segs) body.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
  body.quadraticCurveTo(0, -ht - 1.8, -nb, -ht); body.closePath();
  const samp = [];
  for (const sg of segs) for (let i = 0; i < 4; i++) samp.push(cubic(...sg, i / 4));
  const cb = samp.reduce((m, q) => [m[0] + q[0] / samp.length, m[1] + q[1] / samp.length], [0, 0]);
  // 흰 배: 목 앞(턱 밑)에서 옆구리를 따라 엉덩이 아래로 내려가는 경계의 앞쪽
  const belly = new Path2D();
  belly.moveTo(nf - 0.5, -ht - 0.6);
  belly.bezierCurveTo(nf - 1.6, -ht * 0.8, -bw * bx, yW - ht * 0.2, -bw * bx, yW);
  belly.bezierCurveTo(-bw * bx, yW + ht * 0.25, -bw * 0.4, -0.5, -bw * 0.5, 1);
  belly.lineTo(fw + 3, 1); belly.lineTo(fw + 3, -ht - 3); belly.closePath();
  const edge = new Path2D(); // 경계선(킹·황제의 검은 띠)
  edge.moveTo(nf - 0.5, -ht - 0.6);
  edge.bezierCurveTo(nf - 1.6, -ht * 0.8, -bw * bx, yW - ht * 0.2, -bw * bx, yW);
  edge.bezierCurveTo(-bw * bx, yW + ht * 0.25, -bw * 0.4, -0.5, -bw * 0.5, 1);
  // 날개(뿌리 원점, 아래 +y로 늘어진다. 앞가장자리 +x)
  const flip = new Path2D();
  flip.moveTo(F.w * 0.5, 0.1);
  flip.bezierCurveTo(F.w * 0.7, F.len * 0.4, F.w * 0.3, F.len * 0.86, -F.w * 0.05, F.len);
  flip.quadraticCurveTo(-F.w * 0.4, F.len * 0.98, -F.w * 0.42, F.len * 0.76);
  flip.bezierCurveTo(-F.w * 0.56, F.len * 0.45, -F.w * 0.62, F.len * 0.15, -F.w * 0.42, -0.3);
  flip.quadraticCurveTo(0, -0.9, F.w * 0.5, 0.1); flip.closePath();
  // 물갈퀴 발(발뒤꿈치 원점, 발가락 +x)
  const foot = new Path2D();
  foot.moveTo(-0.5, -0.1);
  foot.quadraticCurveTo(-0.45, -0.85, 0.5, -0.8);
  foot.quadraticCurveTo(FT * 0.62, -0.62, FT * 0.96, -0.22);
  foot.quadraticCurveTo(FT * 1.1, 0.06, FT * 0.86, 0.1);
  foot.lineTo(-0.3, 0.1); foot.quadraticCurveTo(-0.62, 0.05, -0.5, -0.1); foot.closePath();
  // 꼬리(엉덩이 뒤 원점, 뒤 -x로 뾰족)
  const tl = new Path2D();
  tl.moveTo(0.6, -1.2); tl.quadraticCurveTo(-tail * 0.5, -1.0, -tail, 0.2); tl.quadraticCurveTo(-tail * 0.45, 0.9, 0.8, 0.7); tl.closePath();
  return (SH = { body, belly, edge, samp, cb, flip, foot, tl });
}

const basePose = () => ({ lean: 0, tilt: 0, lift: 0, dx: 0, sx: 1, sy: 1, chest: 0, headRel: 0, headExt: 0, yaw: 0, open: 0, flipN: 0.12, flipF: -0.06, lie: 0, reach: null, kick: 0, padN: 0, padF: 0, lieHR: 0, closed: false, hAbs: 0, hW: 0, neck: 0, bx: 0, roll: 0 });

// 상태 → 포즈
function pose(I) {
  const P = basePose(), t = I.t;
  P.lie = I.L;
  const breath = Math.sin((t * TAU) / 3.2);
  P.sy += 0.014 * breath * (1 - I.L * 0.5); P.sx += 0.008 * breath;
  const ww = I.walk;
  if (ww > 0) { // 뒤뚱: 디딘 발 쪽으로 몸을 번갈아 기울이고(흰 배가 보이는 폭도 바뀐다), 한 발로 설 때 살짝 솟는다. 날개는 벌려 균형
    const k = Math.sin(TAU * (I.u - 0.05));
    P.tilt = 0.12 * k * ww; P.roll = k * ww; P.lift = 0.32 * (0.5 - 0.5 * Math.cos(TAU * 2 * (I.u - 0.05))) * ww;
    P.flipN = lerp(P.flipN, 0.6 + 0.14 * k, ww); P.flipF = lerp(P.flipF, -1.25 + 0.14 * k, ww);
    P.headRel = -0.75 * P.tilt + 0.04 * Math.sin(TAU * 2 * I.u) * ww;
  }
  const iw = I.idle;
  if (iw > 0) { // 쉬기 몸짓(11초 주기): 두리번 · 뒤돌아보기 · 날개 털기 · 깃 고르기
    const c = (((t + SPEC.seed) / 11) % 1 + 1) % 1;
    const back = win(c, 0.2, 0.34, 0.035), flap = win(c, 0.46, 0.53, 0.012), preen = win(c, 0.64, 0.82, 0.035);
    P.yaw = iw * back;
    P.headRel += iw * (0.08 * Math.sin(t * 0.9) * (1 - preen) + preen * (1.25 + 0.12 * Math.sin(t * TAU * 2.6)));
    P.headExt -= iw * preen * 0.3;
    const fl = iw * flap * (0.4 + 0.7 * Math.sin(t * TAU * 5));
    P.flipN += fl; P.flipF -= fl * 1.2;
  }
  if (I.eatK > 0) { // 먹기(1.33초에 한 입): 숙여 물고기 쪼기 → 물어 들고 → 고개 젖혀 꿀꺽
    const e = (((t * 0.75) % 1) + 1) % 1, up = win(e, 0.42, 0.88, 0.12, 0.1);
    I.eat = e;
    P.reach = { y: -0.3 - 0.7 * Math.max(0, Math.sin(e * TAU * 2.4)) ** 2 * (1 - ss(e / 0.3)), w: I.eatK * (1 - up) };
    P.hAbs = lerp(EAT_HA, -0.75, ss((up - 0.55) / 0.45)); P.hW = I.eatK; P.neck = I.eatK * (1 - up); P.sy -= 0.1 * P.neck; // 몸을 다 세운 뒤에 고개를 젖힌다
    P.open = Math.max(P.open, I.eatK * win(e, 0.3, 0.4, 0.04) * 0.8);
    P.flipN += I.eatK * 0.25; P.flipF -= I.eatK * 0.2;
  }
  if (I.drinkK > 0) { // 물: 부리를 눈에 묻어 떠먹고, 들어 올려 삼킨다
    const sip = ss(0.5 + 0.9 * Math.sin(t * TAU * 0.5));
    I.sip = sip;
    P.reach = { y: -0.15, w: I.drinkK * (1 - sip) };
    P.hAbs = lerp(EAT_HA, -0.5, ss((sip - 0.35) / 0.65)); P.hW = I.drinkK; P.neck = I.drinkK * (1 - sip); P.sy -= 0.1 * P.neck;
    P.flipN += I.drinkK * 0.2; P.flipF -= I.drinkK * 0.15;
  }
  if (I.s >= 0) SPEC.special(I.s, P, I);
  if (P.lie > 0) { // 엎드리기: 고개는 앞을 보고, 날개는 몸 옆으로 뒤로 붙인다
    const e = ss(P.lie);
    P.headRel = lerp(P.headRel, -TH_LIE + 0.14 + P.lieHR, e);
    P.yaw *= 1 - e;
    P.flipN = lerp(P.flipN, 0.22, e) + P.padN; P.flipF = lerp(P.flipF, 0.3, e) + P.padF;
  }
  if (I.L > 0.6) P.closed = true;
  return P;
}

// 포즈 → 자리(몸 피벗·기울기, 목, 머리, 부리 끝). 몸은 가장 낮은 곳이 땅(또는 다리 높이)에 닿게 놓는다
function place(P) {
  P.sx *= 1 + 0.07 * P.chest;
  const B = SPEC.body, S = shapes(), eL = ss(P.lie), th = lerp(P.tilt + P.lean, TH_LIE, eL), c = Math.cos(th), s = Math.sin(th);
  let maxY = -1e9;
  for (const [x, y] of S.samp) { const yy = x * P.sx * s + y * P.sy * c; if (yy > maxY) maxY = yy; }
  const cbx = S.cb[0] * Math.cos(TH_LIE) - S.cb[1] * Math.sin(TH_LIE);
  const px = lerp(0, -cbx - B.ht * 0.2, eL) - B.ht * 0.06 * Math.sin(Math.PI * eL) + P.dx + (P.bx - B.ht * 0.16 * P.neck) * (1 - eL), py = -maxY - B.clear * (1 - eL) * (1 - 0.6 * ss(P.lean / 0.9)) - P.lift;
  const T = (x, y) => [px + x * P.sx * c - y * P.sy * s, py + x * P.sx * s + y * P.sy * c];
  const nj0 = T(SPEC.head.nj[0], -B.ht + SPEC.head.nj[1]), nk = P.neck * B.ht * 0.2, nj = T(SPEC.head.nj[0] + 0.55 * nk, -B.ht + SPEC.head.nj[1] + 0.85 * nk), ha = lerp(th + P.headRel, P.hAbs, P.hW), ca = Math.cos(ha), sa = Math.sin(ha);
  const o = SPEC.head.off, ox = o[0], oy = o[1] - P.headExt, oa = lerp(th, ha, 0.55), co = Math.cos(oa), so = Math.sin(oa); // 목은 고개 돌린 만큼의 반쯤만 따라간다
  const hc = [nj[0] + ox * co - oy * so, nj[1] + ox * so + oy * co];
  const Bk = SPEC.beak, tx = Bk.x0 + Bk.len, ty = Bk.y0 + Bk.cv, tip = [hc[0] + tx * ca - ty * sa, hc[1] + tx * sa + ty * ca];
  return { th, c, s, px, py, T, nj0, nj, ha, hc, tip, eL };
}
// 부리 끝이 목표 높이에 닿도록 허리 숙임(lean)을 이분법으로 찾는다
function reach(P) {
  if (!P.reach || P.reach.w <= 0.001) return;
  const base = P.lean;
  let lo = -0.2, hi = 1.7;
  for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; P.lean = base + m; if (place(P).tip[1] < P.reach.y) lo = m; else hi = m; }
  P.lean = base + ((lo + hi) / 2) * P.reach.w;
}
// 땅을 쫄 때 부리 끝이 닿는 자리(물고기·조약돌 위치)
function groundX() {
  const S = shapes();
  if (S.gx === undefined) { const P = basePose(); P.hAbs = EAT_HA; P.hW = 1; P.neck = 1; P.sy = 0.9; P.reach = { y: -0.3, w: 1 }; reach(P); S.gx = place(P).tip[0]; }
  return S.gx;
}

export function draw(g, p, H) {
  const { footAt, rigTick, ell, taper, C } = H, S = shapes(), K = SPEC, B = K.body, col = K.col;
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), live = dt > 0 && !!p.rig, real = H.real();
  const t = p.ph ?? 0, st = p.st ?? 'idle', s = p.sp ?? -1, special = s >= 0;
  const moving = (p.mv ?? 0) > 0 && !special, u = ((((p.gait ?? 0) % 1) + 1) % 1);
  const ease = (key, target, rate) => { if (!live) return target; const v = r[key] === undefined ? target : r[key] + (target - r[key]) * Math.min(1, dt * rate); r[key] = v; return v; };
  if (st === 'eat' || st === 'drink') r.dn = st;
  const hd = clamp01(p.hd ?? 0), dn = r.dn ?? 'eat', L = clamp01(p.ly ?? (st === 'rest' ? 1 : 0));
  const I = { u, moving, t, st, s, L, real, eatK: dn === 'eat' ? hd : 0, drinkK: dn === 'drink' ? hd : 0 };
  I.idle = ease('iw', st === 'idle' && !moving && !special ? 1 : 0, 4) * (1 - hd) * (1 - L);
  I.walk = ease('ww', moving ? 1 : 0, 9);
  const solve = (I2) => { const P2 = pose(I2); reach(P2); return { P: P2, G: place(P2) }; };
  const { P, G } = solve(I), { T, th, eL } = G;
  const closed = P.closed || r.blink > 0;

  g.save(); g.scale(K.S, K.S);
  if (p.shadow !== false) ell(g, G.px + lerp(S.cb[0], 0, eL) + (B.fw - B.bw) * 0.2, 0, lerp(B.fw + B.bw, B.ht * 0.75, eL) * 0.62, 0.9, 0, 'rgba(40,25,10,0.22)');
  const fx = { G, P, I, t, s, real, gx: groundX(), at: (s2) => solve({ ...I, s: s2 }).G };
  K.fx?.(g, H, fx, 'back');

  // ---- 발: 서 있으면 종종걸음(발은 땅에 붙는다), 엎드리면 몸 뒤로 뻗어 발바닥이 위를 본다 ----
  const stroke = (STRIDE / K.S) * DUTY;
  const footOf = (off, x0, hipX) => {
    let x = x0, y = 0, a = 0;
    if (moving && eL < 0.99) { const q = footAt((u + off) % 1, stroke, K.foot.lift, DUTY); x += q.x; y = q.y; a = -0.25 * q.sw; }
    x += P.dx * (1 - eL);
    const kick = P.kick * (off ? -1 : 1), lp = T(hipX * 0.6 - 0.2, 1.0 + 0.4 * kick), la = Math.PI + 0.3 + th - TH_LIE + 0.35 * kick;
    const pos = [lerp(x, lp[0], eL), lerp(y, lp[1], eL)], ang = lerp(a, la, eL), sn = Math.sin(ang), cs = Math.cos(ang);
    pos[1] -= Math.max(0, pos[1] + 0.1 * cs + Math.max(K.foot.len * sn, -0.5 * sn, 0.85 * Math.abs(sn))); // 발끝·뒤꿈치가 땅에 묻히지 않게
    const ank = [pos[0] + 0.15 * Math.cos(ang) + 0.6 * Math.sin(ang), pos[1] + 0.15 * Math.sin(ang) - 0.6 * Math.cos(ang)];
    return { pos, ang, ank, hip: T(hipX, -1.3) };
  };
  const FN = footOf(0, 0.2, -0.1), FF = footOf(0.5, 0.8, 0.5);
  const drawFoot = (F, c) => {
    g.save(); g.translate(F.pos[0], F.pos[1]); g.rotate(F.ang); g.fillStyle = C(c); g.fill(S.foot);
    if (real) { g.strokeStyle = 'rgba(60,30,20,0.28)'; g.lineWidth = 0.18; g.beginPath(); g.moveTo(0.4, -0.35); g.lineTo(K.foot.len * 0.85, -0.12); g.moveTo(0.4, -0.05); g.lineTo(K.foot.len * 0.7, 0.05); g.stroke(); }
    g.restore();
  };
  taper(g, FF.hip[0], FF.hip[1], FF.ank[0], FF.ank[1], 1.3, 0.85, col.legFar);
  drawFoot(FF, col.footFar);
  taper(g, FN.hip[0], FN.hip[1], FN.ank[0], FN.ank[1], 1.4, 0.9, col.leg);

  // ---- 먼 날개 · 꼬리 · 목 ----
  const body = (fn) => { g.save(); g.translate(G.px, G.py); g.rotate(th); g.scale(P.sx, P.sy); fn(); g.restore(); };
  const fr = K.flip.root;
  body(() => {
    g.save(); g.translate(fr[0] + 0.7, fr[1] - 0.3); g.rotate(P.flipF); g.fillStyle = C(col.backFar); g.fill(S.flip); g.restore();
    g.save(); g.translate(-B.bw * 0.72, -0.7); g.rotate(B.tailA + (moving ? 0.12 * Math.sin(TAU * u) : 0)); g.fillStyle = C(col.tail ?? col.back); g.fill(S.tl); g.restore();
  });
  taper(g, G.nj0[0], G.nj0[1], G.nj[0], G.nj[1], B.nb * 1.7, B.nb * 1.6, col.head);
  taper(g, G.nj[0], G.nj[1], G.hc[0], G.hc[1], B.nb * 1.6, K.head.ry * 1.5, col.head);

  // ---- 몸통: 등 색 → 흰 배 → 종별 무늬(가슴 색·경계 띠) → 그늘 ----
  body(() => {
    g.fillStyle = C(col.back); g.fill(S.body);
    g.save(); g.clip(S.body);
    g.save(); g.translate(0.45 * P.roll, 0); // 뒤뚱일 때 배 경계가 앞뒤로 살짝 밀린다(몸이 좌우로 구르는 느낌)
    g.fillStyle = C(col.belly); g.fill(S.belly);
    K.marks?.(g, H, { real, P });
    g.restore();
    if (real) {
      g.fillStyle = 'rgba(90,110,140,0.13)'; g.beginPath(); g.ellipse(B.fw * 0.2, 0.2, B.fw * 1.1, 2.2, 0, 0, TAU); g.fill(); // 배 밑 그늘
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(-B.bw * 0.7, -B.ht * 0.55, 1.0, B.ht * 0.25, 0.1, 0, TAU); g.fill(); // 등 윤기
    }
    g.restore();
    });

  // ---- 가까운 발 · 가까운 날개 ----
  drawFoot(FN, col.foot);
  body(() => {
    g.save(); g.translate(fr[0], fr[1]); g.rotate(P.flipN); g.fillStyle = C(col.flip ?? col.back); g.fill(S.flip);
    if (real && col.flipEdge) { g.strokeStyle = col.flipEdge; g.lineWidth = 0.28; g.lineCap = 'round'; g.beginPath(); g.moveTo(-K.flip.w * 0.55, K.flip.len * 0.4); g.bezierCurveTo(-K.flip.w * 0.55, K.flip.len * 0.6, -K.flip.w * 0.45, K.flip.len * 0.8, -K.flip.w * 0.15, K.flip.len * 0.97); g.stroke(); }
    g.restore();
  });
  if (real && I.eatK > 0.05) fish(g, H, fx);
  if (real && I.drinkK > 0.05) snowBite(g, H, fx);
  K.fx?.(g, H, fx, 'mid');

  // ---- 머리: 고개 돌리기(yaw)는 부리를 짧게 보이게 하고, 반을 넘으면 뒤를 본다 ----
  const yaw = P.yaw, bk = Math.max(0.3, Math.abs(Math.cos(yaw * Math.PI)));
  g.save(); g.translate(G.hc[0], G.hc[1]); g.rotate(G.ha); if (yaw > 0.5) g.scale(-1, 1);
  K.drawHead(g, H, { real, closed, open: P.open, bk, P, t });
  g.restore();
  K.fx?.(g, H, fx, 'front');
  g.restore();
}

// ---- 머리 그림 도우미(종별 head()가 쓴다) ----
// 부리(머리 좌표): 밑동 (x0, y0), 길이 len, 두께 dep, 끝이 cv만큼 아래로 굽는다. open만큼 아랫부리가 벌어진다
// o.up·o.lo 윗·아랫부리 색, o.base 밑동 색, o.stripe 아랫부리 옆 띠, o.ridge 윗부리 등줄기·끝 색
function beak(g, H, Q, o = SPEC.beak) {
  const { C } = H, len = o.len * Q.bk, d = o.dep, cv = o.cv, op = Q.open * 0.6;
  g.save(); g.translate(o.x0, o.y0);
  if (op > 0.04) { g.fillStyle = C(o.mouth ?? '#c85a64'); g.beginPath(); g.moveTo(-0.3, 0.1); g.lineTo(len * 0.8, cv + 0.1); g.lineTo(len * 0.8 * Math.cos(op), cv + len * 0.8 * Math.sin(op)); g.closePath(); g.fill(); }
  g.save(); g.translate(-0.2, 0.15); g.rotate(op); // 아랫부리
  const lo = new Path2D(); lo.moveTo(-0.1, -0.1); lo.quadraticCurveTo(len * 0.55, cv * 0.5, len * 0.9, cv + 0.05); lo.quadraticCurveTo(len * 0.45, d * 0.45 + cv * 0.5, -0.2, d * 0.5); lo.closePath();
  g.fillStyle = C(o.lo); g.fill(lo);
  if (o.stripe) { g.save(); g.clip(lo); g.fillStyle = C(o.stripe); g.beginPath(); g.moveTo(-0.3, 0.05); g.quadraticCurveTo(len * 0.4, cv * 0.35 + 0.05, len * 0.72, cv * 0.8 + 0.05); g.quadraticCurveTo(len * 0.4, cv * 0.4 + d * 0.32, -0.3, d * 0.45); g.closePath(); g.fill(); g.restore(); }
  g.restore();
  const up = new Path2D(); up.moveTo(-0.35, -d * 0.55); up.quadraticCurveTo(len * 0.5, -d * 0.48 + cv * 0.25, len, cv); up.quadraticCurveTo(len * 0.55, cv * 0.45 + 0.15, -0.25, 0.2); up.closePath();
  g.fillStyle = C(o.up); g.fill(up);
  if (o.ridge) { g.save(); g.clip(up); g.fillStyle = C(o.ridge); g.beginPath(); g.moveTo(-0.4, -d); g.quadraticCurveTo(len * 0.5, -d * 0.6 + cv * 0.25, len + 0.3, cv - 0.3); g.lineTo(len + 0.3, cv + 1); g.lineTo(len * 0.8, cv + 1); g.quadraticCurveTo(len * 0.45, -d * 0.2 + cv * 0.2, -0.4, -d * 0.25); g.closePath(); g.fill(); g.restore(); }
  if (o.base) { g.save(); g.clip(up); g.fillStyle = C(o.base); g.fillRect(-0.5, -d, len * 0.32, d * 1.6); g.restore(); }
  g.restore();
}
// 눈: ring이 있으면 둘레(아델리 흰 눈테 등). 감으면 아래로 굽은 선
function peye(g, H, x, y, r, closed, ring) {
  if (ring) H.ell(g, x, y, r * 1.85, r * 1.85, 0, ring);
  if (closed) { g.strokeStyle = H.C(ring && ring !== '#ffffff' ? '#8a929c' : ring ? '#2a2420' : '#8a929c'); g.lineWidth = r * 0.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - r, y - r * 0.1); g.quadraticCurveTo(x, y + r * 0.7, x + r, y - r * 0.1); g.stroke(); return; }
  H.eye(g, x, y, r, false);
}
// 먹기 물고기: 땅에 놓였다가(쪼기) 부리에 물리고(들기) 꿀꺽 사라진 뒤 새로 놓인다
function fishShape(g, H, x, y, a, k) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
  g.fillStyle = H.C('#9dbbd2'); g.beginPath(); g.ellipse(0, 0, 1.25, 0.42, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-1.0, 0); g.lineTo(-1.9, -0.5); g.lineTo(-1.75, 0); g.lineTo(-1.9, 0.5); g.closePath(); g.fill();
  g.fillStyle = H.C('#5f7f9c'); g.beginPath(); g.ellipse(0.1, -0.18, 1.0, 0.2, 0, 0, TAU); g.fill();
  H.ell(g, 0.82, -0.08, 0.12, 0.12, 0, '#1e1712');
  g.restore();
}
function fish(g, H, F) {
  const e = F.I.eat ?? 0, k = F.I.eatK;
  if (e < 0.4 || e > 0.93) { const a = e > 0.93 ? ss((e - 0.93) / 0.05) : 1; g.save(); g.globalAlpha *= a * Math.min(1, k * 2); fishShape(g, H, F.gx + 0.3, -0.42, 0.05, 1); g.restore(); }
  else if (e < 0.74) fishShape(g, H, F.G.tip[0] - 0.2 * Math.cos(F.G.ha), F.G.tip[1] + 0.3, F.G.ha + 1.35, 0.95);
}
// 물(눈 떠먹기): 부리가 눈에 닿을 때 눈가루가 튄다
function snowBite(g, H, F) {
  const sip = F.I.sip ?? 1, k = F.I.drinkK * (1 - ss((sip - 0.05) / 0.3));
  if (k <= 0.02) return;
  for (let i = 0; i < 4; i++) { const a = ((F.t * 1.3 + i / 4) % 1), x = F.G.tip[0] + (i - 1.5) * 0.45 + a * (i - 1.5) * 0.5, y = -0.3 - Math.sin(a * Math.PI) * 1.2; H.ell(g, x, y, 0.32 * k, 0.28 * k, 0, '#ffffff'); }
  H.ell(g, F.G.tip[0] - 0.3, 0, 1.4, 0.4, 0, '#dfeaf3');
}
