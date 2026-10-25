// 미어캣 리그: 낮게 종종걸음(대각선 다리 쌍, 속보), 가늘고 긴 꼬리(끝이 검다), 눈가 검은 무늬·뾰족한 주둥이.
// 쉬기(가끔 뒷발로 반쯤 일어나 두리번)·먹기(앞발로 번갈아 땅 파기)·물·눕기(배 깔고 일광욕)·특수 행동(두 발로 서서 보초, 꼬리로 받친다).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 5; // 한 걸음 주기 동안 몸이 나아가는 거리(그림 단위)
export const BOX = [8, 15];
const TAU = Math.PI * 2;
const DUTY = 0.5; // 속보: 가까운 뒷다리+먼 앞다리 → 가까운 앞다리+먼 뒷다리
const OFFS = { nh: 0, ff: 0.03, nf: 0.5, fh: 0.53 };
const MK = { col: '#cdb084', dark: '#5a4632', belly: '#e8d6b0', patch: '#3e2f22', nose: '#2a1d14', dirt: '#9a7a50' };
const LEG = { hind: [2.2, 2.2, 1.5], fore: [2.0, 2.0, 0.9] };

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
// 굵기가 줄어드는 마디 + 둥근 관절을 한 번에 채운다(감는 방향을 맞춰 겹쳐도 구멍이 안 난다)
function bones(g, C, pts, ws, col) {
  g.fillStyle = C(col); g.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath();
  }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], w = ws[i] / 2; g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU, true); }
  g.fill();
}
// 자세 하나: 엉덩이 H, 몸 각도 a(0 = 수평, -π/2 = 똑바로 섬), 몸 길이 L, 머리(어깨 기준), 꼬리, 발 목표
const POSE = {
  idle: { H: [-3.4, -5.2], a: -0.15, L: 6.8, head: [3.0, -2.9], ha: 0, tail: [Math.PI + 0.3, 7.6, -0.7], ht: [1.6, 0], hb: 0.5, fp: [0.6, 0], fg: 0.1 },
  half: { H: [-2.8, -4.3], a: -0.95, L: 7.0, head: [1.7, -2.9], ha: -0.05, tail: [Math.PI + 0.05, 7.8, 0.5], ht: [2.0, 0], hb: 1.0, fp: [2.4, 2.3], fg: -0.3, rel: 1, fat: 1.08 },
  sent: { H: [-1.2, -3.6], a: -1.45, L: 8.0, head: [0.4, -3.0], ha: 0, tail: [Math.PI + 0.05, 8.0, 0.9], ht: [2.3, 0], hb: 1.35, fp: [2.9, 2.6], fg: -0.45, rel: 1, fat: 1.18 },
  eat: { H: [-3.6, -5.5], a: 0.2, L: 6.6, head: [3.1, -0.5], ha: 0.95, tail: [Math.PI + 0.5, 7.4, -0.8], ht: [1.4, 0], hb: 0.5, fp: [1.4, 0], fg: 0.1 },
  drink: { H: [-3.6, -5.4], a: 0.16, L: 6.6, head: [3.0, 0.4], ha: 1.0, tail: [Math.PI + 0.4, 7.4, -0.7], ht: [1.4, 0], hb: 0.5, fp: [1.0, 0], fg: 0.1 },
  rest: { H: [-3.6, -2.4], a: 0.02, L: 7.0, head: [3.4, 0.3], ha: 0.06, tail: [Math.PI + 0.02, 7.8, 0.3], ht: [-3.6, -0.4], hb: -1.3, fp: [2.8, -0.4], fg: -1.25 },
};
function mixPose(A, B, k) {
  if (k <= 0) return A;
  const o = {};
  for (const key of Object.keys(A)) {
    const a = A[key], b = B[key] ?? a;
    o[key] = Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], k)) : lerp(a, b, k);
  }
  o.rel = lerp(A.rel ?? 0, B.rel ?? 0, k); o.fat = lerp(A.fat ?? 1, B.fat ?? 1, k);
  return o;
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C, shade, taper } = H;
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, ly = p.ly ?? 0, sp = p.sp ?? -1, real = H.real();
  const sentinel = sp >= 0, moving = p.mv > 0 && !sentinel, ph = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  const breath = Math.sin(t * TAU / 1.6);
  const far = shade(MK.col, 0.78);

  // ---- 자세 고르기·섞기 ----
  let P, yaw = 0, rise = 0, dig = 0;
  if (moving) {
    const bob = Math.sin(ph * TAU * 2) * 0.3;
    P = { ...POSE.idle, H: [-3.4, -4.9 + bob], a: -0.05 + Math.sin(ph * TAU * 2 + 0.8) * 0.03, head: [3.6, -1.7 + bob * 0.5], tail: [Math.PI + 0.42, 7.6, -0.9], rel: 0 };
  } else if (sentinel) {
    const k = ss(sp / 0.08) * ss((1 - sp) / 0.08);
    P = mixPose(POSE.idle, POSE.sent, k);
    const v = Math.max(-1, Math.min(1, Math.sin(sp * TAU * 2) * 1.6));
    yaw = (Math.PI / 2) * (1 - v) * k;
  } else {
    // 가끔 뒷발로 반쯤 일어나 두리번
    const c = (t % 9) / 9;
    rise = ss((c - 0.55) / 0.07) * ss((0.93 - c) / 0.07) * (1 - hd) * (1 - ly);
    P = mixPose(POSE.idle, POSE.half, rise);
    if (hd > 0) P = mixPose(P, p.st === 'drink' ? POSE.drink : POSE.eat, hd);
    if (ly > 0) P = mixPose(P, POSE.rest, ly);
    yaw = rise * 0.9 * (0.5 + 0.5 * Math.sin(t * 1.3));
    dig = p.st === 'eat' ? hd : 0;
  }
  const ca = Math.cos(P.a), sa = Math.sin(P.a), rot = (x, y) => [ca * x - sa * y, sa * x + ca * y];
  const Hp = P.H, S = [Hp[0] + ca * P.L, Hp[1] + sa * P.L];
  const at = (B, x, y) => { const [dx, dy] = rot(x, y); return [B[0] + dx, B[1] + dy]; };
  const bR = (1 + 0.03 * breath) * (P.fat ?? 1), rH = (2.8 - ly * 0.35) * bR, rS = (2.4 - ly * 0.3) * bR;

  // ---- 다리 목표 ----
  const hipJ = at(Hp, 0.2, 1.0), shJ = at(S, 0.4, 1.2);
  const hindPts = (root, toe, beta, sx = 0) => {
    const [a, b, c] = LEG.hind, ankle = [toe[0] - c * Math.sin(beta), toe[1] - c * Math.cos(beta)];
    const { knee, end } = ik(root[0] + sx, root[1], ankle[0], ankle[1], a, b, 1);
    return [[root[0] + sx, root[1]], knee, end, [end[0] + c * Math.sin(beta), end[1] + c * Math.cos(beta)]];
  };
  const forePts = (root, paw, gam, sx = 0) => {
    const [a, b, c] = LEG.fore, wrist = [paw[0] + c * Math.sin(gam), paw[1] - c * Math.cos(gam)];
    const { knee, end } = ik(root[0] + sx, root[1], wrist[0], wrist[1], a, b, -1);
    return [[root[0] + sx, root[1]], knee, end, [end[0] - c * Math.sin(gam), end[1] + c * Math.cos(gam)]];
  };
  let legs;
  if (moving) {
    const stroke = STRIDE * DUTY, at2 = (key) => footAt((ph + OFFS[key]) % 1, stroke, 1.3, DUTY);
    const hind = (key, sx) => { const f = at2(key); return hindPts(hipJ, [Hp[0] + 1.5 + f.x + sx, f.y], 0.5 * (1 - f.sw) + 0.25 * f.st * (1 - f.sw) - 0.7 * f.sw, sx); };
    const fore = (key, sx) => { const f = at2(key); return forePts(shJ, [Hp[0] + P.L + 0.9 + f.x + sx, f.y], 0.15 - 0.3 * f.st * (1 - f.sw) + 1.2 * f.sw, sx); };
    legs = { nh: hind('nh', 0), fh: hind('fh', 0.6), nf: fore('nf', 0), ff: fore('ff', 0.6) };
  } else if (ly > 0.5) {
    // 배 깔고 일광욕: 뒷다리는 뒤로 쭉, 앞다리는 앞으로
    const hj = hipJ, sj = shJ;
    legs = {
      nh: [hj, [hj[0] - 1.6, -0.9], [hj[0] - 3.6, -0.7], [hj[0] - 5.0, -0.5]], fh: [[hj[0] + 0.5, hj[1]], [hj[0] - 1.0, -1.1], [hj[0] - 3.0, -0.9], [hj[0] - 4.4, -0.7]],
      nf: [sj, [sj[0] + 1.2, -0.8], [sj[0] + 2.8, -0.6], [sj[0] + 3.6, -0.5]], ff: [[sj[0] + 0.5, sj[1]], [sj[0] + 1.6, -1.0], [sj[0] + 3.2, -0.8], [sj[0] + 4.0, -0.7]],
    };
  } else {
    const ht = P.rel ? [Hp[0] + P.ht[0], P.ht[1]] : [hipJ[0] + P.ht[0], P.ht[1]];
    let fpN = P.rel ? [S[0] + P.fp[0], S[1] + P.fp[1]] : [shJ[0] + P.fp[0], P.fp[1]];
    const relP = P.rel ?? 0;
    if (relP > 0 && relP < 1) { const a0 = [shJ[0] + POSE.idle.fp[0], 0], a1 = [S[0] + P.fp[0], S[1] + P.fp[1]]; fpN = [lerp(a0[0], a1[0], relP), lerp(a0[1], a1[1], relP)]; }
    let fpF = [fpN[0] + 0.6, fpN[1] - (relP > 0.5 ? 0.3 : 0)];
    if (dig > 0) { // 앞발로 번갈아 긁기: 공중에서 앞으로, 땅에서 뒤로
      const scr = (c) => [shJ[0] + 1.6 - 1.5 * Math.cos(c), -Math.max(0, Math.sin(c)) * 1.4];
      const c = t * TAU * 2.6;
      fpN = [lerp(fpN[0], scr(c)[0], dig), lerp(fpN[1], scr(c)[1], dig)];
      fpF = [lerp(fpF[0], scr(c + Math.PI)[0] + 0.6, dig), lerp(fpF[1], scr(c + Math.PI)[1], dig)];
    }
    legs = { nh: hindPts(hipJ, ht, P.hb), fh: hindPts(hipJ, [ht[0] + 0.6, ht[1]], P.hb, 0.6), nf: forePts(shJ, fpN, P.fg), ff: forePts(shJ, fpF, P.fg, 0.6) };
  }

  // ---- 그림자 ----
  if (p.shadow !== false) ell(g, (Hp[0] + S[0]) / 2, 0, 6.4, 1.8, 0, 'rgba(40,25,10,0.24)');

  // ---- 꼬리(스프링): 걸을 땐 살짝 들고 흔든다, 보초 땐 땅을 짚는다 ----
  const swing = moving ? Math.sin(ph * TAU) * 0.12 : Math.sin(t * 0.9) * 0.05;
  const ta = spring('tA', P.tail[0] + swing + r.swish * 0.15, 55, 7);
  const tr = at(Hp, -rH + 0.5, -0.3), tlen = P.tail[1], tk = P.tail[2];
  const tip = [tr[0] + Math.cos(ta) * tlen, tr[1] + Math.sin(ta) * tlen], tc = [(tr[0] + tip[0]) / 2 + Math.sin(ta) * tk, (tr[1] + tip[1]) / 2 - Math.cos(ta) * tk];
  const tp = [];
  for (let i = 0; i <= 6; i++) { const s = i / 6, a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s; tp.push([a * tr[0] + b * tc[0] + c * tip[0], Math.min(-0.35, a * tr[1] + b * tc[1] + c * tip[1])]); }
  bones(g, C, tp.slice(0, 5), [1.6, 1.35, 1.15, 0.95, 0.8], MK.col);
  bones(g, C, tp.slice(4), [0.8, 0.65, 0.5], MK.dark);

  // ---- 먼 쪽 다리 ----
  bones(g, C, legs.fh, [2.1, 1.5, 1.1, 0.9], far);
  bones(g, C, legs.ff, [1.6, 1.2, 1.0, 0.8], far);

  // ---- 목·몸통(소시지 모양: 엉덩이가 조금 굵다) ----
  const yawLook = Math.sin(yaw); // 정면을 볼수록 머리가 몸 쪽으로 온다
  const hc0 = [S[0] + P.head[0] * (1 - 0.35 * yawLook), S[1] + P.head[1]];
  springTo(r.head, moving ? Math.sin(ph * TAU * 2 - 0.5) * 0.25 : 0, 90, 10, dt);
  const hc = [hc0[0], hc0[1] + r.head.x];
  const nb = at(S, 0.9, -0.5);
  taper(g, nb[0], nb[1], hc[0] - 0.5, hc[1] + 0.4, 3.9, 3.0, MK.col);
  const nu = [sa, -ca], ang = P.a, mid = [(Hp[0] + S[0]) / 2, (Hp[1] + S[1]) / 2], rm = (rH + rS) / 2;
  const body = new Path2D();
  body.moveTo(Hp[0] + nu[0] * rH, Hp[1] + nu[1] * rH);
  body.quadraticCurveTo(mid[0] + nu[0] * (rm - 0.15), mid[1] + nu[1] * (rm - 0.15), S[0] + nu[0] * rS, S[1] + nu[1] * rS);
  body.arc(S[0], S[1], rS, ang - Math.PI / 2, ang + Math.PI / 2);
  body.quadraticCurveTo(mid[0] - nu[0] * (rm + 0.45), mid[1] - nu[1] * (rm + 0.45), Hp[0] - nu[0] * rH, Hp[1] - nu[1] * rH);
  body.arc(Hp[0], Hp[1], rH, ang + Math.PI / 2, ang + Math.PI * 1.5);
  body.closePath();
  g.fillStyle = C(MK.col); g.fill(body);
  if (real) {
    g.save(); g.clip(body);
    g.translate(mid[0], mid[1]); g.rotate(ang);
    const hl = P.L / 2;
    g.fillStyle = MK.belly; g.beginPath(); g.ellipse(hl * 0.25, rm + 0.2, hl + 1.2, 1.5, 0, 0, TAU); g.fill(); // 배·가슴 밝은 털
    g.strokeStyle = 'rgba(70,50,30,0.35)'; g.lineCap = 'round'; g.lineWidth = 0.7;
    for (let i = 0; i < 6; i++) { const x = -hl - 1.2 + i * 1.25; g.beginPath(); g.moveTo(x + 0.3, -rm - 0.4); g.lineTo(x - 0.25, -rm + 1.5 - (i % 2) * 0.3); g.stroke(); } // 등 줄무늬
    g.fillStyle = 'rgba(70,45,20,0.16)'; g.beginPath(); g.ellipse(0, rm + 1.0, hl + 2, 1.3, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(0.4, -rm + 0.45, hl + 0.3, 0.6, 0, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }

  // ---- 가까운 쪽 다리 ----
  bones(g, C, legs.nh, [2.3, 1.6, 1.2, 1.0], MK.col);
  bones(g, C, legs.nf, [1.7, 1.3, 1.1, 0.9], MK.col);
  if (real) for (const L of [legs.nf, legs.nh]) { const [x, y] = L[3]; ell(g, x + 0.3, y, 0.55, 0.3, 0, MK.dark); } // 발톱
  if (dig > 0.3 && real) { // 흙 튀기
    for (let i = 0; i < 3; i++) { const s = (t * 2.6 + i / 3) % 1; ell(g, shJ[0] + 1.2 - 6.5 * s, -0.5 - 3.4 * s + 4.6 * s * s, 0.42, 0.34, 0, MK.dirt); }
  }

  // ---- 머리: 둥근 머리 + 뾰족한 주둥이. yaw로 옆 → 정면 → 반대쪽을 돌아본다 ----
  const closed = r.blink > 0 || ly > 0.6;
  g.save(); g.translate(hc[0], hc[1]); g.rotate(P.ha + (moving ? 0.08 : 0));
  const R = 2.25, cy = Math.cos(yaw);
  const ears = [yaw + 1.95, yaw - 1.95].map((b) => ({ x: R * 0.86 * Math.cos(b), d: Math.sin(b) }));
  for (const e of ears) if (e.d < 0) ell(g, e.x, -0.55, 0.62, 0.72, 0, MK.dark);
  ell(g, 0, 0, R, R * 0.93, 0, MK.col);
  if (real) { g.fillStyle = 'rgba(80,55,30,0.22)'; g.beginPath(); g.ellipse(-0.25 * cy, -1.1, 1.25, 0.6, 0, 0, TAU); g.fill(); } // 정수리 짙은 털
  for (const e of ears) if (e.d >= 0) ell(g, e.x, -0.55, 0.62, 0.72, 0, MK.dark);
  const sb = [0.5 * cy, 0.45], st = [3.7 * cy, 0.95];
  taper(g, sb[0], sb[1], st[0], st[1], 2.5, 1.0, MK.col);
  if (real) ell(g, (sb[0] + st[0]) / 2, 1.05, Math.abs(st[0] - sb[0]) / 2 + 0.6, 0.55, 0, MK.belly);
  for (const b of [yaw + 0.8, yaw - 0.8]) {
    const d = Math.sin(b); if (d < -0.15) continue;
    const ex = R * 0.82 * Math.cos(b), w = 0.45 + 0.5 * Math.max(0, d);
    ell(g, ex, -0.35, 0.95 * w, 0.75, 0, MK.patch); // 눈가 검은 무늬
    eye(g, ex + 0.12 * cy, -0.4, 0.42, closed);
  }
  if (Math.sin(yaw) > -0.2) ell(g, st[0] + 0.25 * cy, st[1] - 0.05, 0.5, 0.42, 0, MK.nose);
  if (p.st === 'drink' && hd > 0.5 && real && Math.sin(t * TAU * 3) > 0.3) ell(g, st[0], st[1] + 0.7, 0.3, 0.5, 0, '#d9747a');
  g.restore();

}
