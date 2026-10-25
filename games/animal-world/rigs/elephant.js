// 코끼리(아프리카코끼리) 리그. 모양은 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX. 원점 = 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.
// 큰 몸통(어깨가 가장 높고 등 가운데가 살짝 꺼진 등선), 기둥 같은 다리(IK지만 거의 곧게, 둥글고 납작한 발에 발톱),
// 크게 펄럭이는 귀(스프링·가끔 부채질), 마디 스프링 사슬로 된 코(흔들림·끝 말림), 짧은 상아, 주름(실루엣에선 생략), 술 달린 가는 꼬리.
// 걸음 = 느린 측대 순서 걷기(뒷발 → 같은 쪽 앞발), 몸이 앞뒤로 살짝 출렁인다.
// 먹기 = 코를 땅으로 뻗어 풀을 감아 입으로(반복), 물 = 코를 땅(물)에 담갔다가 입으로, 쉬기 = 선 채로 졸기(눈 감고 귀 늘어뜨리고 코끝을 땅에),
// 특수(코로 물 뿌리기) = 코를 높이 앞으로 치켜들고 코끝을 벌린다(물방울은 화면 쪽이 (+32, -58)에서 뿌린다).

export const STRIDE = 14; // 느린 걸음
export const BOX = [26, 54];
const DUTY = 0.7;
const OFFS = { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 }; // 측대 순서: 가까운 뒷발 → 가까운 앞발 → 먼 뒷발 → 먼 앞발
const TAU = Math.PI * 2;

const EL = {
  col: '#949ba2', far: '#7b8289', ear: '#868d95', earFar: '#737a81', fold: '#a9afb5', vein: '#7a8189', wr: '#7a8188', tusk: '#f2ecdf', tuskFar: '#d3ccbe',
  nail: '#d9d3c7', tuft: '#3a3a3a', mouth: '#5f5658', tipIn: '#4a4f55', water: '#7cc3e6',
  hip: [-13, -26], sh: [11, -27],
  hind: { a: 11.6, b: 10.6, c: 4.4, bend: 1, w: [11, 9.6, 8.6, 9.8] }, fore: { a: 12, b: 11, c: 4.4, bend: -1, w: [11.5, 9.8, 8.8, 10] }, lift: 2.8,
};
// 코: 8마디 사슬. 자세별 마디 각도(0 = 앞, π/2 = 아래). 끝점은 목표점에 맞춰 돌리고 늘이거나 줄인다
const TN = 8, TL = 4.85;
const TR = {
  hang: [1.36, 1.46, 1.54, 1.6, 1.62, 1.55, 1.3, 0.9], // 늘어뜨림, 끝은 앞으로 살짝 말림
  ground: [1.5, 1.55, 1.6, 1.62, 1.6, 1.45, 0.7, 0.15], // 땅까지 뻗어 끝을 땅에 댐
  mouth: [1.45, 1.45, 1.45, 1.45, 2.53, 3.6, 4.67, 5.75], // 아래로 내려가 뒤로 말아 올려 끝을 입에
  rest: [1.52, 1.57, 1.6, 1.62, 1.58, 1.35, 0.6, 0.1], // 졸 때 코끝을 땅에 얹는다
  up: [-0.4, -0.85, -1.4, -2, -2.5, -2.3, -1.6, -0.7], // 높이 치켜든 S자, 끝은 앞 위로
};
const cl01 = (v) => Math.max(0, Math.min(1, v));
const lerpA = (A, B, w) => A.map((a, i) => a + (B[i] - a) * w);

// 기둥 다리: 뿌리 → 무릎 → 발목 → 발바닥 가운데. 발바닥은 평평하고 조금 넓다
function column(g, C, pts, ws, col) {
  const n = pts.length, Bk = [], Fr = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i + 1];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const h = ws[i] / 2; Bk.push([pts[i][0] - dy * h, pts[i][1] + dx * h]); Fr.push([pts[i][0] + dy * h, pts[i][1] - dx * h]);
  }
  const [fx, fy] = pts[n - 1], fw = ws[n - 1] / 2;
  g.fillStyle = C(col); g.beginPath();
  g.moveTo(Bk[0][0], Bk[0][1]);
  for (let i = 1; i < n - 1; i++) g.lineTo(Bk[i][0], Bk[i][1]);
  g.quadraticCurveTo(fx - fw - 0.2, fy - 0.7, fx - fw + 1, fy);
  g.lineTo(fx + fw - 1, fy);
  g.quadraticCurveTo(fx + fw + 0.2, fy - 0.7, Fr[n - 2][0], Fr[n - 2][1]);
  for (let i = n - 3; i >= 0; i--) g.lineTo(Fr[i][0], Fr[i][1]);
  g.closePath(); g.fill();
}
// 굵기가 줄어드는 띠(코). 끝은 둥글게, 뿌리는 머리 속에 묻힌다
function ribbon(pts, ws) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const h = ws[i] / 2; L.push([pts[i][0] - dy * h, pts[i][1] + dx * h]); R.push([pts[i][0] + dy * h, pts[i][1] - dx * h]);
  }
  const path = new Path2D(), e = pts[n - 1];
  path.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n - 1; i++) path.quadraticCurveTo(L[i][0], L[i][1], (L[i][0] + L[i + 1][0]) / 2, (L[i][1] + L[i + 1][1]) / 2);
  path.lineTo(L[n - 1][0], L[n - 1][1]);
  path.arc(e[0], e[1], ws[n - 1] / 2, Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]), Math.atan2(R[n - 1][1] - e[1], R[n - 1][0] - e[0]), true);
  for (let i = n - 2; i > 0; i--) path.quadraticCurveTo(R[i][0], R[i][1], (R[i][0] + R[i - 1][0]) / 2, (R[i][1] + R[i - 1][1]) / 2);
  path.lineTo(R[0][0], R[0][1]);
  path.closePath();
  return path;
}
// 귀(아프리카코끼리: 크고 아래가 뾰족한 귀). 원점 = 귀가 머리에 붙는 앞쪽 위
function earPath() {
  const e = new Path2D();
  e.moveTo(1.5, -3.5);
  e.bezierCurveTo(-4, -8.5, -13, -7.5, -15, -2);
  e.bezierCurveTo(-16.5, 4, -14, 10, -10.5, 14);
  e.bezierCurveTo(-8, 17, -5.5, 20.5, -3.5, 20);
  e.bezierCurveTo(-1.5, 19.5, -1, 15, 0, 11);
  e.quadraticCurveTo(1.2, 5, 0.5, 1);
  e.quadraticCurveTo(1, -1, 1.5, -3.5);
  e.closePath();
  return e;
}

export function draw(g, p, H) {
  const { ik, footAt, smooth, springTo, rigTick, ell, eye, C } = H;
  const real = H.real();
  const r = p.rig ?? {}, dt = p.dt ?? 0;
  rigTick(r, dt);
  if (!r.tk) Object.assign(r, { tk: TR.hang.map((a) => ({ x: a, v: 0 })), tl: { x: TL, v: 0 }, ef: { x: 0, v: 0 }, rz: { x: 0, v: 0 }, hk: 'eat', eo: Math.random() * 20 });
  const follow = (s, target, k, c) => { if (dt > 0) springTo(s, target, k, c, dt); else { s.x = target; s.v = 0; } };
  const moving = p.mv > 0 && p.sp < 0, ph = p.gait ?? 0, t = p.ph ?? 0, lt = t + (p.rig ? r.eo : 0);
  if (p.st === 'eat' || p.st === 'drink') r.hk = p.st;
  const hd = p.hd ?? 0, ek = r.hk === 'eat' ? hd : 0, dk = r.hk === 'drink' ? hd : 0;
  const sp = p.sp ?? -1, s = sp >= 0 ? smooth(cl01(sp / 0.12)) * smooth(cl01((1 - sp) / 0.08)) : 0;
  follow(r.rz, p.st === 'rest' && !moving ? 1 : 0, 8, 6); // 졸기(서서)
  const rz = cl01(r.rz.x), calm = 1 - rz * 0.6;
  const breath = Math.sin((t * TAU) / (4.6 + rz * 1.6));
  if (p.shadow !== false) ell(g, 0, 0, 22, 4.4, 0, 'rgba(40,25,10,0.24)');
  // 걸을 때 엉덩이와 어깨가 엇갈려 오르내려 몸이 앞뒤로 출렁인다
  const bobH = moving ? Math.sin(ph * TAU * 2) : 0, bobS = moving ? Math.sin(ph * TAU * 2 + 1.6) : 0;
  const hip = [EL.hip[0], EL.hip[1] + 0.55 * bobH], sh = [EL.sh[0], EL.sh[1] + 0.55 * bobS + 0.4 * rz];

  // 다리: 거의 곧은 기둥. 디딘 발은 땅에 붙어 뒤로, 든 발은 낮게 앞으로
  const stroke = STRIDE * DUTY;
  const legPts = (key, root, cfg, front) => {
    let f;
    if (moving) { const u = footAt((ph + OFFS[key]) % 1, stroke, EL.lift, DUTY); f = { ...u, x: u.x + root[0] + 0.5 }; }
    else f = { x: root[0] + (key === 'fh' ? -1.4 : key === 'ff' ? 1.2 : 0), y: 0, sw: 0, st: 0.5 };
    const th = (front ? 0.45 : 0.3) * f.sw;
    const sole = [f.x, f.y], ankle = [sole[0] + cfg.c * Math.sin(th), sole[1] - cfg.c * Math.cos(th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a, cfg.b, cfg.bend);
    return [root, knee, end, sole];
  };
  const legs = {
    fh: legPts('fh', [hip[0] + 1.2, hip[1]], EL.hind, false), ff: legPts('ff', [sh[0] + 1.2, sh[1]], EL.fore, true),
    nh: legPts('nh', hip, EL.hind, false), nf: legPts('nf', sh, EL.fore, true),
  };
  if (p.shadow !== false) for (const key of ['nh', 'nf', 'fh', 'ff']) { const [x, y] = legs[key][3]; if (y > -0.3) ell(g, x, 0.2, 5, 1, 0, 'rgba(40,25,10,0.28)'); }
  column(g, C, legs.fh, EL.hind.w.map((w) => w * 0.95), EL.far);
  column(g, C, legs.ff, EL.fore.w.map((w) => w * 0.95), EL.far);

  // 꼬리(스프링): 가늘고 끝에 검은 털 술
  const tailRoot = [hip[0] - 10.6, hip[1] - 13];
  follow(r.tail, 0.08 + (moving ? 0.12 * Math.sin(ph * TAU) : 0) + r.swish * 0.7 * calm, 26, 5);
  const ta = r.tail.x, tl = 14;
  const tm = [tailRoot[0] - 1.6 - Math.sin(ta * 0.6) * tl * 0.5, tailRoot[1] + Math.cos(ta * 0.6) * tl * 0.5], te = [tailRoot[0] - 1 - Math.sin(ta) * tl, tailRoot[1] + Math.cos(ta) * tl];
  g.strokeStyle = C(EL.col); g.lineWidth = 1.3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(tailRoot[0], tailRoot[1]); g.quadraticCurveTo(tm[0], tm[1], te[0], te[1]); g.stroke();
  ell(g, te[0] - Math.sin(ta) * 1.4, te[1] + Math.cos(ta) * 1.4, 1, 2.2, -ta, EL.tuft);

  // 몸통: 어깨가 가장 높고 등 가운데가 꺼졌다가 엉덩이에서 둥글게 내려간다. 배는 숨 쉴 때 살짝 부푼다
  const by = 1 + 0.025 * breath, [hx, hy] = hip, [sx, sy] = sh;
  const body = new Path2D();
  body.moveTo(sx - 2, sy - 21.5);
  body.bezierCurveTo(sx - 9, sy - 21, hx + 9, hy - 17.5, hx + 1, hy - 19.5);
  body.bezierCurveTo(hx - 6, hy - 20, hx - 11.5, hy - 13, hx - 12, hy - 5);
  body.quadraticCurveTo(hx - 12, hy + 2, hx - 8, hy + 4);
  body.quadraticCurveTo(hx - 2, hy + 8 * by, (hx + sx) / 2 - 1, (hy + sy) / 2 + 10.5 * by);
  body.quadraticCurveTo(sx - 4, sy + 9.5 * by, sx + 5, sy + 4);
  body.quadraticCurveTo(sx + 10, sy - 2, sx + 8, sy - 12);
  body.quadraticCurveTo(sx + 5, sy - 21, sx - 2, sy - 21.5);
  body.closePath();
  g.fillStyle = C(EL.col); g.fill(body);
  const nearLeg = (pts, cfg) => {
    column(g, C, pts, cfg.w, EL.col);
    if (!real) return;
    const [, kn, an, so] = pts, fw = cfg.w[3] / 2;
    g.strokeStyle = EL.wr; g.lineWidth = 0.5; g.lineCap = 'round'; g.beginPath();
    for (const [q, w, dy] of [[kn, cfg.w[1], -1.2], [kn, cfg.w[1], 0.6], [an, cfg.w[2], -1.6]]) { g.moveTo(q[0] - w * 0.3, q[1] + dy); g.quadraticCurveTo(q[0], q[1] + dy + 0.7, q[0] + w * 0.32, q[1] + dy - 0.1); }
    g.stroke();
    for (const k of [-0.05, 0.3, 0.62]) ell(g, so[0] + fw * k + 0.6, so[1] - 0.75, 0.95, 0.75, 0, EL.nail); // 발톱
  };
  nearLeg(legs.nh, EL.hind);
  nearLeg(legs.nf, EL.fore);
  if (real) { // 배 그늘·등 하이라이트·주름(다리 윗부분까지 덮는다)
    g.save(); g.clip(body);
    g.fillStyle = 'rgba(40,45,60,0.14)'; g.beginPath(); g.ellipse((hx + sx) / 2, (hy + sy) / 2 + 9, 21, 5.5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.ellipse((hx + sx) / 2 - 2, (hy + sy) / 2 - 18.4, 14, 2.2, 0.03, 0, TAU); g.fill();
    g.strokeStyle = EL.wr; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath();
    g.moveTo(sx - 6.5, sy - 9); g.quadraticCurveTo(sx - 4, sy - 1, sx - 5, sy + 6); // 어깨 뒤 주름
    g.moveTo(hx + 7.5, hy - 12); g.quadraticCurveTo(hx + 9.5, hy - 4, hx + 7, hy + 4); // 옆구리 주름
    g.moveTo(hx + 5, hy - 9); g.quadraticCurveTo(hx + 6.6, hy - 3, hx + 5.2, hy + 2);
    g.moveTo(-3, (hy + sy) / 2 + 6); g.quadraticCurveTo(1, (hy + sy) / 2 + 7, 4, (hy + sy) / 2 + 6); // 배 주름
    g.stroke();
    g.restore();
  }

  // 머리: 걸을 땐 끄덕, 쉴 땐 천천히. 먹고 마실 땐 조금 숙이고, 물을 입으로 올릴 땐 살짝 든다. 뿌릴 땐 치켜든다
  const dCyc = (t / 4.4 + 0.2) % 1, lift = dk * smooth(cl01((dCyc - 0.6) / 0.15)) * (1 - smooth(cl01((dCyc - 0.85) / 0.15)));
  follow(r.head, moving ? 0.03 * Math.sin(ph * TAU * 2 - 0.6) : 0.025 * Math.sin(lt * 0.37) * calm, 50, 8);
  const ha = r.head.x + 0.07 * (ek + dk) + 0.06 * rz - 0.13 * s - 0.1 * lift;
  const hp = [sx + 10.5, sy - 13.5 + 1.5 * (ek + dk) + rz - 1.5 * s + 0.5 * bobS], ca = Math.cos(ha), sa = Math.sin(ha);
  const toW = (x, y) => [hp[0] + x * ca - y * sa, hp[1] + x * sa + y * ca];

  // 귀 부채질(스프링): 쉴 땐 가끔 몇 번씩, 걸을 땐 출렁, 졸 땐 늘어뜨림, 물 뿌릴 땐 활짝
  const earT = s > 0 ? s * (0.6 + 0.12 * Math.sin(t * 9)) : moving ? 0.2 + 0.12 * Math.sin(ph * TAU * 2) : (Math.sin(lt * 0.5) > 0.35 ? 0.75 * Math.max(0, Math.sin(lt * 3.4)) : 0.04) * (1 - rz);
  follow(r.ef, earT, 40, 5);
  const ef = Math.max(-0.1, Math.min(1, r.ef.x)), ear = earPath();
  const earAt = (dx, dy, k, col) => {
    g.save(); g.translate(hp[0], hp[1]); g.rotate(ha); g.translate(-3.5 + dx, -4 + dy); g.rotate(-0.1 * ef + 0.06 * rz); g.scale(k * (1 - 0.5 * ef), k);
    g.fillStyle = C(col); g.fill(ear);
  };
  earAt(-1, 0.6, 0.95, EL.earFar); g.restore(); // 먼 귀: 가까운 귀 뒤로 조금 보인다

  const head = new Path2D();
  head.moveTo(-6.5, -6);
  head.bezierCurveTo(-4, -10.5, 4, -10.5, 6.5, -6.5);
  head.quadraticCurveTo(8.6, -3.5, 8.4, 1);
  head.quadraticCurveTo(8.4, 4, 8, 6);
  head.quadraticCurveTo(6.5, 9.5, 3.5, 9.2);
  head.quadraticCurveTo(-1, 9, -4.5, 6);
  head.quadraticCurveTo(-8, 1, -6.5, -6);
  head.closePath();
  g.save(); g.translate(hp[0], hp[1]); g.rotate(ha);
  g.fillStyle = C(EL.col); g.fill(head);
  if (real) {
    g.fillStyle = 'rgba(40,45,60,0.12)'; g.beginPath(); g.ellipse(1, 7.2, 6, 2.2, 0, 0, TAU); g.fill();
    g.strokeStyle = EL.mouth; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath(); g.moveTo(6.4, 7.8); g.quadraticCurveTo(4.8, 8.8, 2.8, 8.4); g.stroke();
  }
  g.restore();
  // 가까운 귀(머리 뒤쪽을 덮는다)
  earAt(0, 0, 1, EL.ear);
  if (real) {
    g.lineCap = 'round';
    g.strokeStyle = EL.fold; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0.2, -4.3); g.bezierCurveTo(-5, -7.4, -12.3, -6.4, -14, -1.8); g.bezierCurveTo(-15.6, 4, -13.2, 10.5, -9.6, 13.4); g.stroke(); // 귀 가장자리 접힘
    g.strokeStyle = EL.vein; g.lineWidth = 0.55; g.beginPath(); g.moveTo(-2.4, 1.5); g.quadraticCurveTo(-6.5, 3.6, -10, 2); g.moveTo(-3, 6.5); g.quadraticCurveTo(-6.5, 9, -8, 12.5); g.moveTo(-1.6, -2); g.quadraticCurveTo(-5, -2.4, -8, -4); g.stroke(); // 핏줄
  }
  g.restore();
  if (real) { // 눈과 눈가 주름
    g.save(); g.translate(hp[0], hp[1]); g.rotate(ha);
    eye(g, 2.6, -2, 0.8, r.blink > 0 || p.st === 'rest' || rz > 0.5);
    g.strokeStyle = EL.wr; g.lineWidth = 0.5; g.beginPath();
    g.moveTo(1.2, -3.6); g.quadraticCurveTo(2.6, -4.3, 4, -3.5); g.moveTo(1.6, -0.6); g.quadraticCurveTo(2.8, 0, 4, -0.7);
    g.moveTo(6.6, -1); g.lineTo(7.8, -0.8); g.moveTo(6.8, 1.2); g.lineTo(8, 1.3);
    g.stroke(); g.restore();
  }

  // 코: 자세(마디 각도 틀)마다 끝을 목표점(땅·입·높은 곳)에 맞춘 뒤 섞고, 마디마다 스프링으로 늦게 따라간다
  const tb = toW(5, 1); // 코 뿌리: 이마 선이 그대로 코 앞선으로 이어진다
  const fitK = (A, q) => { // 틀을 돌리고 늘이거나 줄여 끝이 q에 오게
    if (!q) return { a: A, L: TL };
    let ex = 0, ey = 0; for (const a of A) { ex += Math.cos(a); ey += Math.sin(a); }
    const qx = q[0] - tb[0], qy = q[1] - tb[1];
    let rot = Math.atan2(qy, qx) - Math.atan2(ey, ex); rot -= Math.round(rot / TAU) * TAU;
    return { a: A.map((v) => v + rot), L: Math.max(0.55, Math.min(1.15, Math.hypot(qx, qy) / (Math.hypot(ex, ey) * TL))) * TL };
  };
  const mixK = (a, b, w) => ({ a: lerpA(a.a, b.a, w), L: a.L + (b.L - a.L) * w });
  const roll = (a, b, w) => ({ a: a.a.map((v, i) => v + (b.a[i] - v) * smooth(cl01(w * 2 - (1 - i / (TN - 1))))), L: a.L + (b.L - a.L) * smooth(cl01(w * 2)) }); // 끝부터 말리고 펴진다
  const K = { hang: fitK(TR.hang, null), ground: fitK(TR.ground, [tb[0] + 8, -1.9]), mouth: fitK(TR.mouth, toW(3.8, 8.5)) };
  const cycle = (c, a, b, d) => c < a ? mixK(K.hang, K.ground, smooth(c / a)) : c < b ? K.ground // 늘어뜨림 → 땅 → 머묾 → 입으로 → 다시 늘어뜨림
    : c < d ? roll(K.ground, K.mouth, (c - b) / (d - b)) : roll(K.hang, K.mouth, 1 - (c - d) / (1 - d));
  let T = K.hang;
  const mixIn = (k, w) => { if (w > 0) T = mixK(T, k, w); };
  const eCyc = (t / 3.2) % 1;
  mixIn(cycle(eCyc, 0.28, 0.42, 0.72), ek);
  mixIn(cycle(dCyc, 0.25, 0.55, 0.78), dk);
  mixIn(fitK(TR.rest, [tb[0] + 7, -1.9]), rz * (1 - hd));
  if (s > 0) {
    mixIn(roll(K.hang, fitK(TR.up, [32, -57.5 + 0.8 * Math.sin(sp * TAU * 7)]), s), 1);
  }
  follow(r.tl, T.L, 160, 24);
  const grab = ek * (eCyc > 0.26 && eCyc < 0.44 ? Math.sin(((eCyc - 0.26) / 0.18) * Math.PI) : 0); // 풀을 감아쥐며 코끝을 위로 만다
  const swayA = (moving ? 0.07 : 0.06 * calm) * (1 - Math.max(ek, dk) * 0.7) * (1 - s * 0.8);
  const ang = [];
  let mx = 0, my = 0, cx = 0, cy = 0;
  for (let i = 0; i < TN; i++) {
    const u = i / (TN - 1), sway = swayA * (0.3 + u) * (moving ? Math.sin(ph * TAU - i * 0.5) : Math.sin(lt * 1.1 - i * 0.45)), k = 110 - 8 * i;
    follow(r.tk[i], T.a[i] + sway - (i >= TN - 2 ? grab * (i === TN - 1 ? 1 : 0.5) : 0), k, 1.4 * Math.sqrt(k));
    const a = r.tk[i].x; ang.push(a); cx += Math.cos(a); cy += Math.sin(a); mx = Math.max(mx, cx); my = Math.min(my, cy);
  }
  // 그림 칸(외곽선 캔버스) 밖으로 나갈 만큼 뻗으면 코를 그만큼 줄인다(모양은 그대로)
  const segL = Math.min(r.tl.x, mx > 0 ? (35 - tb[0]) / mx : 99, my < 0 ? (tb[1] + 59.5) / -my : 99);
  const pts = [tb];
  for (let i = 0; i < TN; i++) pts.push([pts[i][0] + Math.cos(ang[i]) * segL, pts[i][1] + Math.sin(ang[i]) * segL]);
  const ws = pts.map((_, i) => 7.2 - (4.4 * i) / TN);
  for (let i = 1; i <= TN; i++) pts[i][1] = Math.min(pts[i][1], 0.1 - ws[i] / 2); // 땅을 뚫지 않고 땅 위에 눕는다
  const tw = (sx2, col) => { // 상아: 입가에서 앞으로 나와 끝이 살짝 위로
    g.save(); g.translate(hp[0], hp[1]); g.rotate(ha); g.translate(sx2[0], sx2[1]);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(5.4, 5.8); g.quadraticCurveTo(9, 9.8, 12.2, 7.4); g.quadraticCurveTo(9.2, 8, 6.9, 4.8); g.closePath(); g.fill();
    g.restore();
  };
  tw([-0.9, -0.7], EL.tuskFar);
  const trunk = ribbon(pts, ws);
  g.fillStyle = C(EL.col); g.fill(trunk);
  const tipP = pts[TN], tipA = ang[TN - 1];
  if (real) {
    g.save(); g.clip(trunk);
    g.strokeStyle = EL.wr; g.lineWidth = 0.45; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i < TN; i++) for (const f of [0.3, 0.75]) { // 코 주름(마디마다 가로줄)
      const a = ang[i], cx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, cy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, w = (ws[i] + (ws[i + 1] - ws[i]) * f) * 0.36;
      g.moveTo(cx - Math.sin(a) * w, cy + Math.cos(a) * w); g.lineTo(cx + Math.sin(a) * w, cy - Math.cos(a) * w);
    }
    g.stroke();
    g.restore();
  }
  // 코끝: 물 뿌릴 땐 나팔처럼 벌어진 끝, 아니면 작은 콧구멍
  if (s > 0.4) {
    ell(g, tipP[0], tipP[1], 1.5, 2.6 * s, tipA, EL.col);
    if (real) { ell(g, tipP[0] + Math.cos(tipA) * 0.4, tipP[1] + Math.sin(tipA) * 0.4, 0.8, 1.6 * s, tipA, EL.tipIn); ell(g, tipP[0] + Math.cos(tipA) * 1.6, tipP[1] + Math.sin(tipA) * 1.6, 0.7, 1.1, tipA, EL.water); }
  } else if (real) ell(g, tipP[0] + Math.cos(tipA) * 0.9, tipP[1] + Math.sin(tipA) * 0.9, 0.55, 0.85, tipA, EL.tipIn);
  tw([0, 0], EL.tusk);
}
