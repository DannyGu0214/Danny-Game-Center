// 낙타(단봉낙타) 리그. 구조·좌표·p 필드는 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX.
// 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y. 아이콘처럼 gait·rig·dt가 없으면 서 있는 모습으로 그린다.
// 등 가운데 큰 혹 하나, 모래색 털(혹·목 아래·다리 윗부분은 덥수룩), 아래로 휘었다 올라가는 긴 목, 작은 귀,
// 눈꺼풀이 무겁고 속눈썹이 긴 눈, 갈라진 윗입술, 마디가 굵은 무릎, 두 발가락의 넓적한 발바닥, 술 달린 꼬리.
// 걸음 = 측대보(같은 쪽 앞뒤 다리가 함께): 몸이 좌우로 흔들려 옆에서는 한쪽 다리 뿌리가 오르내리고 몸이 출렁, 목이 앞뒤로 흔들린다.
// 쉬기 = 되새김(턱이 동그랗게 돈다)·속눈썹 깜빡임·귀 쫑긋·꼬리 휘두르기. 먹기 = 목을 땅까지 내려 입술을 오물오물, 물 = 목을 내려 길게 마신다.
// 눕기 = 낙타식으로 앉기: 앞다리 무릎을 먼저 꿇고(앞이 내려감) 뒷다리를 접어 배를 땅에 댄다. 일어날 땐 뒤부터(ly를 거꾸로 돌리면 그 순서가 된다).
// 특수(무릎 꿇고 앉았다 일어나기) = 앞 무릎 꿇기 → 뒤 내려 앉기 → 잠시 되새김 → 뒤부터 일어나기 → 앞 일어나기.

export const STRIDE = 15; // 한 걸음 주기 동안 몸이 나아가는 거리(그림 단위)
export const BOX = [24, 58]; // 탭 판정·표시 위치용 [가로 반폭, 높이]
const DUTY = 0.66;
const OFFS = { nh: 0, nf: 0.05, fh: 0.5, ff: 0.55 }; // 측대보: 가까운 쪽 뒤·앞 → 먼 쪽 뒤·앞
const TAU = Math.PI * 2;

const CM = {
  col: '#d4a966', far: '#b48b52', fur: '#bb8c4c', furHi: '#e6c68f', sole: '#8a6e52', soleFar: '#76604a', nail: '#4a3a2c',
  callus: '#a8845a', nose: '#4b3626', lid: '#bf9658', lash: '#2e2016', mouth: '#6a4c34', tuft: '#5e4128', earIn: '#9c7a52',
  hip: [-12, -36], sh: [11, -35], neck: [14, -41.5],
  hind: { a: 10, b: 11.5, c: 16, bend: 1 }, fore: { a: 9, b: 12, c: 15, bend: -1 }, lift: 3.8,
};
// 목 줄기(3차 곡선) 조절점: 목 뿌리에서의 오프셋 [P1, P2, P3]과 머리 기울기(0 = 수평, + = 코가 아래)
const NK = {
  stand: { p: [[8, 5.5], [11.5, -1], [8.5, -11.5]], h: 0.1 },
  eat: { p: [[9, 9], [11.5, 21], [8, 30.5]], h: 1.05 },
  drink: { p: [[9, 9.5], [12, 22.5], [10, 32]], h: 1.28 },
  kneel: { p: [[6, -1], [7.5, -8], [7.5, -16]], h: -0.05 },
  couch: { p: [[5.5, 0], [7.5, -8], [8, -17]], h: 0 },
};
const cl01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, w) => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
// 두 점 사이 사다리꼴(굵기 w0 → w1)을 경로에 더한다. 언제나 같은 방향으로 돌아 겹쳐도 구멍이 나지 않는다
function quad(P, a, b, w0, w1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  P.moveTo(a[0] + (nx * w0) / 2, a[1] + (ny * w0) / 2); P.lineTo(b[0] + (nx * w1) / 2, b[1] + (ny * w1) / 2);
  P.lineTo(b[0] - (nx * w1) / 2, b[1] - (ny * w1) / 2); P.lineTo(a[0] - (nx * w0) / 2, a[1] - (ny * w0) / 2); P.closePath();
}
function dot(P, c, rad) { P.moveTo(c[0] + rad, c[1]); P.arc(c[0], c[1], rad, 0, TAU, true); }

export function draw(g, p, H) {
  const { ik, footAt, smooth, springTo, rigTick, ell, eye, C } = H;
  const real = H.real();
  const r = p.rig ?? {}, dt = p.dt ?? 0;
  rigTick(r, dt);
  if (!r.nk) Object.assign(r, { nk: { x: 0, v: 0 }, hk: 'eat' });
  const follow = (s, target, k, c) => { if (dt > 0) springTo(s, target, k, c, dt); else { s.x = target; s.v = 0; } };
  const sp = p.sp ?? -1, sit = sp >= 0, moving = p.mv > 0 && !sit, ph = p.gait ?? 0, t = p.ph ?? 0, lk = p.rig ? r.look : 0;
  if (p.st === 'eat' || p.st === 'drink') r.hk = p.st; // 고개를 드는 동안에도 어떤 자세였는지 기억
  const hd = p.hd ?? 0, ek = r.hk === 'eat' ? hd : 0, dk = r.hk === 'drink' ? hd : 0;
  // 앉기 단계: fk = 앞 무릎 꿇기(0~1), kk = 뒤 내려 앉기(0~1)
  const ly = p.ly ?? 0;
  let fk = smooth(cl01(ly / 0.5)), kk = smooth(cl01((ly - 0.4) / 0.6)); // 쉬다가 특수 행동이 시작되면 눕기에서 이어진다
  if (sit) {
    fk = Math.max(fk, sp < 0.6 ? smooth(cl01((sp - 0.03) / 0.17)) : 1 - smooth(cl01((sp - 0.76) / 0.18)));
    kk = Math.max(kk, sp < 0.5 ? smooth(cl01((sp - 0.2) / 0.18)) : 1 - smooth(cl01((sp - 0.6) / 0.16)));
  }
  const down = fk > 0.001 || kk > 0.001, couched = kk > 0.6;

  // 측대보: 같은 쪽 다리가 디딜 때마다 몸이 그쪽으로 기울어(옆에서는 가까운 쪽·먼 쪽 다리 뿌리가 엇갈려 오르내림) 출렁인다
  const roll = moving ? Math.sin(ph * TAU) : 0, bob = moving ? Math.sin(ph * TAU * 2 + 0.6) : 0;
  const breath = Math.sin((t * TAU) / 4.4);
  const pa = 0.5 * fk * (1 - kk) + 0.018 * roll; // 몸 기울기(+ = 앞이 내려감)
  const hipW = [CM.hip[0], CM.hip[1] + 3 * fk * (1 - kk) + 26.5 * kk + 0.7 * bob];
  const ca = Math.cos(pa), sa = Math.sin(pa);
  const Wb = (x, y) => [hipW[0] + (x - CM.hip[0]) * ca - (y - CM.hip[1]) * sa, hipW[1] + (x - CM.hip[0]) * sa + (y - CM.hip[1]) * ca]; // 몸 기준 → 땅 기준
  if (p.shadow !== false) ell(g, 1, 0, 20, 3.8, 0, 'rgba(40,25,10,0.22)');

  // 다리: 서 있으면 IK로 발을 땅에, 걸으면 발 고정 걸음. 앉을 땐 앞다리는 무릎(손목)을 땅에 대고 정강이를 뒤로 접고, 뒷다리는 뒤꿈치를 뒤로 눕힌다
  const stroke = STRIDE * DUTY, ry = 0.7 * roll;
  const legPts = (key, rootL, cfg, front) => {
    const near = key[0] === 'n', rt = Wb(rootL[0], rootL[1]), root = [rt[0], rt[1] + (near ? ry : -ry)];
    const sx = rootL[0] + (key === 'fh' ? -1.4 : key === 'ff' ? 1.2 : 0);
    if (down) {
      const c = cfg.c, S = [sx, -c];
      const T = front ? lerp(lerp(S, [root[0] + 0.6, -1.9], fk), [root[0] + 9.5, -2.1], kk) : lerp(S, [root[0] - 4, -1.9], kk);
      const { knee, end } = ik(root[0], root[1], T[0], T[1], cfg.a, cfg.b, cfg.bend);
      const h = Math.max(0, -end[1]), th = Math.acos(Math.min(1, h / c)) * (front ? -1 : 1); // 발은 땅에 붙인 채 정강이를 접는다
      return [root, knee, end, [end[0] + c * Math.sin(th), end[1] + c * Math.cos(th)]];
    }
    let f;
    if (moving) {
      const u = footAt((ph + OFFS[key]) % 1, stroke, CM.lift, DUTY);
      f = { x: u.x + sx + 0.6, y: u.y, th: front ? 0.9 * u.sw + (u.st - 0.4) * 0.3 * (1 - u.sw) : 0.5 * u.sw + (u.st - 0.5) * 0.22 * (1 - u.sw) };
    } else f = { x: sx, y: 0, th: 0 };
    const foot = [f.x, f.y], ankle = [foot[0] + cfg.c * Math.sin(f.th), foot[1] - cfg.c * Math.cos(f.th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a, cfg.b, cfg.bend);
    return [root, knee, end, foot];
  };
  const legs = {
    fh: legPts('fh', [CM.hip[0] + 0.8, CM.hip[1]], CM.hind, false), ff: legPts('ff', [CM.sh[0] + 0.8, CM.sh[1]], CM.fore, true),
    nh: legPts('nh', CM.hip, CM.hind, false), nf: legPts('nf', CM.sh, CM.fore, true),
  };
  if (p.shadow !== false && !couched) for (const k of ['nh', 'nf', 'fh', 'ff']) { const [x, y] = legs[k][3]; if (y > -0.3) ell(g, x + 0.8, 0.2, 3.4, 0.8, 0, 'rgba(40,25,10,0.3)'); }
  // 가는 다리 + 굵은 무릎·뒤꿈치 마디 + 두 발가락의 넓적한 발(한 경로로 한 번에 칠한다)
  const WH = [6.4, 3.8, 2.4, 2.1], WF = [5.6, 3.4, 2.4, 2.1];
  const leg = (pts, ws, far, front, fold) => {
    const P = new Path2D(), [ex, ey] = pts[2], [fx, fy] = pts[3], ks = 1 - 0.4 * fold; // 접어 넣은 발은 작게(몸 밑에 깔린다)
    for (let i = 0; i < 3; i++) { quad(P, pts[i], pts[i + 1], ws[i], ws[i + 1]); dot(P, pts[i + 1], ws[i + 1] / 2); }
    dot(P, pts[2], front ? 1.75 : 1.55); // 마디 굵은 무릎·뒤꿈치
    const L = Math.hypot(fx - ex, fy - ey) || 1, ps = Math.atan2(-(fx - ex) / L, (fy - ey) / L); // 발바닥은 정강이 방향을 따라 기운다
    const m = { a: Math.cos(ps) * ks, b: Math.sin(ps) * ks, c: -Math.sin(ps) * ks, d: Math.cos(ps) * ks, e: fx, f: fy };
    const pad = new Path2D();
    pad.moveTo(-1.4, -2.3); pad.quadraticCurveTo(-2.6, -1.8, -2.5, -0.6); pad.quadraticCurveTo(-2.3, 0.1, -1, 0.1); pad.lineTo(3, 0.1);
    pad.quadraticCurveTo(4.2, 0, 4.1, -0.9); pad.quadraticCurveTo(3.9, -2, 2.2, -2.4); pad.closePath();
    P.addPath(pad, m);
    g.fillStyle = C(far ? CM.far : CM.col); g.fill(P);
    if (real) {
      g.save(); g.transform(m.a, m.b, m.c, m.d, m.e, m.f);
      g.fillStyle = far ? CM.soleFar : CM.sole; g.beginPath(); g.moveTo(-2.4, -0.5); g.quadraticCurveTo(-2.2, 0.1, -1, 0.1); g.lineTo(3, 0.1); g.quadraticCurveTo(4.1, 0, 4.1, -0.7); g.closePath(); g.fill();
      if (fold < 0.5) g.fillStyle = CM.nail, g.beginPath(); g.ellipse(3.4, -1.1, 0.75, 0.55, 0.4, 0, TAU); g.ellipse(2.2, -1.75, 0.6, 0.45, 0.3, 0, TAU); g.fill(); // 발톱 두 개
      g.restore();
      ell(g, ex + (front ? 0.5 : -0.4), ey, 1.05, 1.3, 0, far ? CM.far : CM.callus); // 굳은살
    }
  };
  leg(legs.fh, WH, true, false, kk);
  leg(legs.ff, WF, true, true, fk);

  // 몸 기준 좌표계: 서 있을 때 땅 좌표 그대로, 앉을 때 엉덩이를 축으로 기울고 내려간다
  g.save(); g.translate(hipW[0], hipW[1]); g.rotate(pa); g.translate(-CM.hip[0], -CM.hip[1]);
  // 꼬리(스프링): 가늘고 끝에 짙은 술. 걸을 때 흔들리고 가끔 휙
  const tr = [-17.6, -40.6];
  follow(r.tail, 0.12 + r.swish * 0.9 * (1 - kk * 0.6) + (moving ? 0.1 * Math.sin(ph * TAU) : 0), 30, 5);
  const ta = r.tail.x - pa * 0.9 + kk * 0.25, tl = 12 - kk * 4.5; // 앉으면 꼬리 끝이 땅에 닿아 짧아 보인다
  const tm = [tr[0] - 0.8 - Math.sin(ta * 0.6) * tl * 0.5, tr[1] + Math.cos(ta * 0.6) * tl * 0.5], te = [tr[0] - Math.sin(ta) * tl, tr[1] + Math.cos(ta) * tl];
  H.curve(g, tr[0], tr[1], tm[0], tm[1], te[0], te[1], 1.4, CM.col);
  ell(g, te[0] - Math.sin(ta) * 1.6, te[1] + Math.cos(ta) * 1.6, 1.2, 2.6, -ta, CM.tuft);
  // 몸통: 엉덩이 → 혹(등 가운데 하나) → 기갑 → 가슴(굳은살 받침) → 배(숨 쉴 때 살짝 부푼다)
  const by = 1 + 0.03 * breath;
  const body = new Path2D();
  body.moveTo(-17, -41.5);
  body.quadraticCurveTo(-15.5, -45.5, -10, -46.3);
  body.bezierCurveTo(-6.5, -46.8, -6, -55.2, 0, -55.2);
  body.bezierCurveTo(5.5, -55.2, 6.5, -47.5, 10.5, -46.8);
  body.quadraticCurveTo(15.5, -46, 17.5, -40);
  body.quadraticCurveTo(18.5, -33, 14, -29);
  body.quadraticCurveTo(11, -26.4, 6, -26.8);
  body.quadraticCurveTo(-3, -27 + 2.5 * by, -8.5, -28.5);
  body.quadraticCurveTo(-13.5, -29, -16.5, -33);
  body.quadraticCurveTo(-19, -37.5, -17, -41.5);
  body.closePath();
  g.fillStyle = C(CM.col); g.fill(body);
  if (real) {
    g.save(); g.clip(body);
    // 혹 위 덥수룩한 털: 아래 가장자리가 털 뭉치처럼 둥글게 늘어진다
    const hump = (x) => -46.6 - 8.6 * Math.pow(Math.sin(Math.PI * cl01((x + 7.5) / 15)), 1.4), HN = 9;
    g.fillStyle = CM.fur; g.beginPath(); g.moveTo(-11, -50); g.lineTo(-10.5, hump(-10.5) + 1.2);
    for (let i = 1; i <= HN; i++) {
      const x0 = -10.5 + ((i - 1) / HN) * 21.5, x1 = -10.5 + (i / HN) * 21.5, d = (x) => 1.3 + 2.6 * Math.sin(Math.PI * cl01((x + 10.5) / 21.5));
      g.quadraticCurveTo((x0 + x1) / 2, Math.max(hump(x0), hump(x1)) + d((x0 + x1) / 2) + 1.5, x1, hump(x1) + d(x1));
    }
    g.lineTo(12, -50); g.lineTo(0, -58); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,240,200,0.32)'; g.beginPath(); g.ellipse(-0.5, -53.4, 4.5, 1.3, 0, 0, TAU); g.fill(); // 혹 하이라이트
    g.fillStyle = 'rgba(90,55,20,0.15)'; g.beginPath(); g.ellipse(-0.5, -26.5, 17, 4.2, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    ell(g, 13.5, -28.4, 3, 1.5, -0.35, CM.callus); // 가슴 굳은살 받침
    g.restore();
  }
  g.restore();
  // 가까운 다리 + 윗부분의 덥수룩한 털
  const shag = (pts, ws, side) => { // 윗마디 한쪽 가장자리(side +1 앞 / -1 뒤)에 털 뭉치
    const [a, b] = pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, fx = (b[1] - a[1]) / L, fy = -(b[0] - a[0]) / L;
    const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
    g.fillStyle = C(CM.fur); g.beginPath();
    for (const u of [0.4, 0.58, 0.76]) { // 다리 가장자리에서 아래로 늘어진 뾰족한 털 뭉치
      const w = (ws[0] + (ws[1] - ws[0]) * u) / 2, x = a[0] + (b[0] - a[0]) * u + fx * side * (w - 0.6), y = a[1] + (b[1] - a[1]) * u + fy * side * (w - 0.6);
      g.moveTo(x - dx * 1.3, y - dy * 1.3); g.quadraticCurveTo(x + fx * side * 1.4, y + fy * side * 1.4, x + dx * 1.5 + fx * side * 1.1, y + dy * 1.5 + fy * side * 1.1);
      g.lineTo(x + dx * 0.6 - fx * side * 0.2, y + dy * 0.6 - fy * side * 0.2); g.closePath();
    }
    g.fill();
  };
  leg(legs.nh, WH, false, false, kk);
  if (!couched) shag(legs.nh, WH, 1);
  leg(legs.nf, WF, false, true, fk);
  if (!couched) shag(legs.nf, WF, -1);

  // 목: 3차 곡선 줄기를 따라 굵기가 줄어드는 띠. 자세별 조절점을 섞고, 걸을 땐 걸음마다 앞뒤로 흔들린다(스프링)
  const kn = fk * (1 - kk);
  const swT = moving ? 0.1 * Math.sin(ph * TAU * 2 - 1) : 0.05 * Math.sin(lk * 0.4) * Math.sin(lk * 0.17) * (1 - hd);
  follow(r.nk, swT, 22, 3.6);
  const sw = r.nk.x;
  const mixP = (i) => {
    let [x, y] = NK.stand.p[i];
    for (const [k, w] of [['eat', ek], ['drink', dk], ['kneel', kn], ['couch', kk]]) if (w > 0) { x += (NK[k].p[i][0] - NK.stand.p[i][0]) * w; y += (NK[k].p[i][1] - NK.stand.p[i][1]) * w; }
    return [x, y];
  };
  const P0 = Wb(CM.neck[0], CM.neck[1]), o1 = mixP(0), o2 = mixP(1), o3 = mixP(2);
  const P1 = [P0[0] + o1[0] + 1.5 * sw, P0[1] + o1[1]], P2 = [P0[0] + o2[0] + 3.5 * sw, P0[1] + o2[1] + 0.6 * sw], P3 = [P0[0] + o3[0] + 5.5 * sw, P0[1] + o3[1] + 1.6 * Math.abs(sw)];
  const NS = 8, S = [], N = [], Wd = [];
  for (let i = 0; i < NS; i++) {
    const u = i / (NS - 1), a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
    S.push([a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]]);
    const tx = 3 * (1 - u) ** 2 * (P1[0] - P0[0]) + 6 * (1 - u) * u * (P2[0] - P1[0]) + 3 * u * u * (P3[0] - P2[0]);
    const ty = 3 * (1 - u) ** 2 * (P1[1] - P0[1]) + 6 * (1 - u) * u * (P2[1] - P1[1]) + 3 * u * u * (P3[1] - P2[1]), tn = Math.hypot(tx, ty) || 1;
    N.push([-ty / tn, tx / tn]); // 목 앞쪽(목구멍 쪽)
    Wd.push((4.4 + 5.6 * Math.pow(1 - u, 1.4)) / 2);
  }
  const edge = (sg, extra = 0) => S.map((q, i) => [q[0] + N[i][0] * (Wd[i] + extra) * sg, q[1] + N[i][1] * (Wd[i] + extra) * sg]);
  const back = edge(-1), front = edge(1);
  if (real) { // 목 아래 덥수룩한 털(목 아랫부분)
    g.fillStyle = CM.fur; g.beginPath(); g.moveTo(front[1][0], front[1][1]);
    for (let i = 2; i <= 5; i++) for (const m of [0.5, 1]) {
      const j = Math.min(NS - 1, i - 1 + m), i0 = Math.floor(j), i1 = Math.min(NS - 1, i0 + 1), w = j - i0;
      const x = front[i0][0] + (front[i1][0] - front[i0][0]) * w, y = front[i0][1] + (front[i1][1] - front[i0][1]) * w, l = m === 0.5 ? 2.2 - i * 0.3 : 0.2;
      g.lineTo(x + N[i0][0] * l, y + N[i0][1] * l);
    }
    g.lineTo(S[5][0], S[5][1]); g.lineTo(S[1][0], S[1][1]); g.closePath(); g.fill();
  }
  const neck = new Path2D();
  neck.moveTo(back[0][0], back[0][1]);
  for (let i = 1; i < NS - 1; i++) neck.quadraticCurveTo(back[i][0], back[i][1], (back[i][0] + back[i + 1][0]) / 2, (back[i][1] + back[i + 1][1]) / 2);
  neck.lineTo(back[NS - 1][0], back[NS - 1][1]);
  neck.lineTo(front[NS - 1][0], front[NS - 1][1]);
  for (let i = NS - 2; i > 0; i--) neck.quadraticCurveTo(front[i][0], front[i][1], (front[i][0] + front[i - 1][0]) / 2, (front[i][1] + front[i - 1][1]) / 2);
  neck.lineTo(front[0][0], front[0][1]);
  const B0 = Wb(9, -47.4), B1 = Wb(16.6, -37);
  neck.lineTo(B1[0], B1[1]); neck.lineTo(B0[0], B0[1]); // 목 뿌리를 어깨·가슴에 묻는다
  neck.closePath();
  g.fillStyle = C(CM.col); g.fill(neck);
  if (real) {
    g.save(); g.clip(neck);
    g.fillStyle = 'rgba(255,240,200,0.28)'; g.beginPath(); // 목 윗선 하이라이트
    for (let i = 1; i < NS; i++) { const x = back[i][0] + N[i][0] * 1.2, y = back[i][1] + N[i][1] * 1.2; if (i === 1) g.moveTo(x, y); else g.lineTo(x, y); }
    for (let i = NS - 1; i >= 1; i--) g.lineTo(back[i][0] - N[i][0], back[i][1] - N[i][1]);
    g.closePath(); g.fill();
    g.restore();
  }

  // 머리: 목 끝에서 스프링으로 살짝 늦게. 되새김(턱이 동그랗게)·먹을 땐 입술 오물오물·물 마실 땐 꿀꺽
  let hr = NK.stand.h;
  for (const [k, w] of [['eat', ek], ['drink', dk], ['kneel', kn], ['couch', kk]]) hr += (NK[k].h - NK.stand.h) * w;
  follow(r.head, -0.5 * sw + (moving || hd > 0.3 ? 0 : 0.07 * Math.sin(lk * 0.31)), 45, 7);
  hr += r.head.x + (dk > 0.6 ? 0.03 * Math.sin(t * 3.4) : 0);
  const eating = ek > 0.6, cw = eating ? 9 : 4.6, chew = !moving && !(dk > 0.6), jx = chew ? 0.35 * Math.cos(t * cw) : 0, jy = chew ? 0.3 * (1 + Math.sin(t * cw)) : 0;
  const lip = eating ? 0.35 * Math.sin(t * 11) : 0;
  g.save(); g.translate(P3[0], P3[1]); g.rotate(hr);
  const ear = (x, y, ang, col, inner) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(-0.9, 0.2); g.quadraticCurveTo(-1.3, -2.1, 0, -2.6); g.quadraticCurveTo(1.3, -2.1, 0.9, 0.2); g.closePath(); g.fill();
    if (inner && real) ell(g, 0, -1.2, 0.45, 0.9, 0, CM.earIn);
    g.restore();
  };
  ear(-1.6, -2.6, -0.75 + r.ear.x * 0.6, CM.far, false);
  // 아래턱(따로 움직인다)
  const jaw = new Path2D();
  jaw.moveTo(5.6 + jx, 1.4 + jy); jaw.quadraticCurveTo(9.4 + jx, 1.6 + jy, 10.6 + jx, 2.2 + jy); jaw.quadraticCurveTo(10.8 + jx, 3.7 + jy, 9 + jx, 3.8 + jy);
  jaw.quadraticCurveTo(6, 4 + jy, 3.6, 3.2); jaw.closePath();
  g.fillStyle = C(CM.lid); g.fill(jaw);
  const head = new Path2D();
  head.moveTo(-1.5, -2.6);
  head.quadraticCurveTo(1.4, -4.4, 4.6, -3.3);
  head.quadraticCurveTo(7.6, -2.5, 9.8, -1.6);
  head.quadraticCurveTo(11.6 + lip, -1, 11.6 + lip, 0.6);
  head.quadraticCurveTo(11.5 + lip, 2.1, 10, 2.1);
  head.quadraticCurveTo(7.5, 2, 5.6, 2.6);
  head.quadraticCurveTo(3.4, 3.6, 1.6, 3.8);
  head.quadraticCurveTo(-1.2, 3.8, -2.2, 1.4);
  head.quadraticCurveTo(-2.7, -0.8, -1.5, -2.6);
  head.closePath();
  g.fillStyle = C(CM.col); g.fill(head);
  const closed = r.blink > 0, sleepy = couched && !sit;
  if (real) {
    g.save(); g.clip(head);
    g.fillStyle = 'rgba(90,55,20,0.14)'; g.beginPath(); g.ellipse(5, 3.4, 5.5, 1.3, 0.05, 0, TAU); g.fill(); // 턱 그늘
    g.fillStyle = CM.fur; g.beginPath(); g.ellipse(-0.4, -3.6, 2.6, 1.2, -0.2, 0, TAU); g.fill(); // 정수리 털
    g.restore();
    g.strokeStyle = CM.mouth; g.lineCap = 'round'; g.lineWidth = 0.4; g.beginPath();
    g.moveTo(11.5 + lip, 0.9); g.lineTo(10.9 + lip * 0.5, 2.05); // 갈라진 윗입술
    g.moveTo(10, -0.9); g.quadraticCurveTo(10.6, -0.85, 11 + lip * 0.5, -0.4); // 콧구멍(가는 틈)
    g.moveTo(9.9, 2.1); g.quadraticCurveTo(7.8, 2.1, 6.4, 2.5); // 입
    g.stroke();
    g.strokeStyle = CM.lid; g.lineWidth = 0.7; g.beginPath(); g.moveTo(2, -2.4); g.quadraticCurveTo(3.4, -3.1, 4.9, -2.3); g.stroke(); // 두툼한 눈두덩
  }
  // 눈: 무거운 윗눈꺼풀이 반쯤 덮고, 긴 속눈썹이 위로 휜다. 깜빡일 땐 아래로
  const ex = 3.4, ey = -1.3;
  eye(g, ex, ey, 0.85, closed);
  if (real) {
    const cover = closed ? 1 : sleepy ? 0.72 : 0.45;
    if (!closed) { g.fillStyle = CM.lid; g.beginPath(); g.ellipse(ex, ey, 1.05, 0.95, 0, Math.PI, TAU); g.lineTo(ex + 1.05, ey - 0.95 + cover * 1.9); g.lineTo(ex - 1.05, ey - 0.95 + cover * 1.9); g.closePath(); g.fill(); }
    const ly2 = closed ? ey : ey - 0.95 + cover * 1.9, dn = closed ? 1 : -1;
    g.strokeStyle = CM.lash; g.lineWidth = 0.32; g.beginPath();
    g.moveTo(ex - 1, ly2); g.lineTo(ex + 1.05, ly2); // 눈꺼풀 선
    for (const [dx, l] of [[-0.6, 0.9], [0, 1.1], [0.6, 1.2]]) { g.moveTo(ex + dx, ly2); g.quadraticCurveTo(ex + dx + 0.3, ly2 + dn * l * 0.6, ex + dx + 0.75, ly2 + dn * l); }
    g.stroke();
  }
  ear(-1.2, -2.4, -0.55 + r.ear.x * 0.9, CM.col, true);
  g.restore();
}
