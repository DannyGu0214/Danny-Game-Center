// 사자(수컷) 리그. 구조·좌표·p 필드는 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX.
// 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y. 아이콘처럼 gait·rig·dt가 없으면 서 있는 모습으로 그린다.
// 두툼한 어깨·깊은 가슴·처진 뱃살, 머리와 목·가슴을 덮는 짙은 갈기, 발가락 자국이 있는 둥근 발(발굽 없음), 끝에 검은 털 뭉치가 달린 긴 꼬리.

export const STRIDE = 11; // 한 걸음 주기 동안 몸이 나아가는 거리(그림 단위)
export const BOX = [20, 34]; // 탭 판정·표시 위치용 [가로 반폭, 높이]
const DUTY = 0.62; // 4박 걷기: 가까운 뒷다리 → 가까운 앞다리 → 먼 뒷다리 → 먼 앞다리
const OFFS = { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 };

const LN = {
  col: '#d8a65a', far: '#b48446', belly: '#efd29c', mane: '#8a4f27', maneLight: '#a9662f', muzzle: '#f3dcb0', nose: '#4a2a1c',
  line: '#6a3e1c', toe: '#8a6232', mouth: '#6e2420', tongue: '#d4706c', tooth: '#fbf3e2', tuft: '#4e2e17', earIn: '#6e4426', iris: '#c48a2c',
  hip: [-8.5, -14.6], sh: [8, -15.4], hind: { a: 6.6, b: 5.8, c: 4.6, bend: 1 }, fore: { a: 6.2, b: 6.6, c: 3, bend: -1 }, lift: 2.4,
};
// 갈기 털끝 길이(고정 난수): 매 프레임 같은 모양
const JIT = Array.from({ length: 30 }, (_, i) => { const v = Math.sin(i * 12.9898) * 43758.5453; return 0.9 + 0.2 * (v - Math.floor(v)); });
const sm = (t) => t * t * (3 - 2 * t);
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? sm((s - a) / (b - a)) : s <= c ? 1 : 1 - sm((s - c) / (d - c)));

export function draw(g, p, H) {
  const { TAU, ik, footAt, springTo, rigTick, limb, ell, eye, C } = H;
  const r = p.rig ?? {}, dt = p.dt ?? 0, real = H.real();
  rigTick(r, dt);
  const sp = p.sp >= 0, moving = p.mv > 0 && !sp, ly = sp ? 0 : p.ly ?? 0, hd = sp ? 0 : p.hd ?? 0, ph = p.gait ?? 0, t = p.ph ?? 0;
  // 특수 행동: 하품(고개를 젖히고 입을 크게, 눈 감기) → 잠깐 다물기 → 포효(고개를 앞으로, 입 벌리고 소리 물결)
  const yawn = sp ? env(p.sp, 0.02, 0.12, 0.3, 0.42) : 0, rr = sp ? env(p.sp, 0.45, 0.52, 0.84, 0.95) : 0;
  const jaw = 0.95 * yawn + 0.72 * rr;
  const breath = Math.sin((t * TAU) / 3.6);
  if (p.shadow !== false) ell(g, 0, 0, 17, 3.4, 0, 'rgba(40,25,10,0.22)');
  g.save();
  // 걸음: 디딘 앞다리 쪽 어깨뼈가 솟았다 내려간다(어깨 굴림)
  const stroke = STRIDE * DUTY;
  const stance = (key) => { const u = (ph + OFFS[key]) % 1; return u < DUTY ? Math.sin((Math.PI * u) / DUTY) : 0; };
  const rollN = moving ? stance('nf') : 0, rollF = moving ? stance('ff') : 0, bob = moving ? Math.sin(ph * TAU * 2) : 0;
  const dip = hd * 6 * (1 - ly) + rr * 0.8; // 먹고 마실 땐 앞다리를 굽혀 앞몸을 낮춘다
  const hip = [LN.hip[0], LN.hip[1] + 0.4 * bob + ly * 7.6];
  const sh = [LN.sh[0], LN.sh[1] + 0.4 * (moving ? Math.sin(ph * TAU * 2 + 1.4) : 0) - 0.3 * rollN + ly * 9.8 + dip];
  // 다리(발가락으로 서는 다리): 서 있으면 IK로 발을 땅에, 걸으면 발 고정 걸음, 누우면 앞다리는 앞으로 뻗고 뒷다리는 옆으로 접는다
  const legPts = (key, root, cfg, front) => {
    const x = root[0];
    if (ly > 0.5) return front ? [root, [x - 0.8, -2.5], [x + 6.6, -1.8], [x + 8.6, -0.3], 0] : [root, [x + 4.6, -3.8], [x - 3.2, -1.7], [x + 1.6, -0.3], 0];
    let f;
    if (moving) { const u = footAt((ph + OFFS[key]) % 1, stroke, LN.lift, DUTY); f = { x: u.x + x + (front ? 0.6 : 1), y: u.y, sw: u.sw, st: u.st }; }
    else f = { x: x + (front ? 0.6 + hd * 1.4 : 1) + (key === 'fh' ? -1.2 : key === 'ff' ? 1.2 : 0), y: 0, sw: 0, st: 0.45 };
    // 발목(앞)·뒤꿈치(뒤): 디딜 땐 비스듬히, 들 땐 앞다리는 손목이 앞으로 꺾여 발바닥이 뒤로, 뒷다리는 발이 뒤꿈치 밑으로 매달린다
    const th = front ? 1.1 * f.sw + (-0.12 + (f.st - 0.45) * 0.5) * (1 - f.sw) : 0.3 * f.sw + (-0.42 + (f.st - 0.5) * 0.4) * (1 - f.sw);
    const paw = [f.x, f.y], ankle = [paw[0] + cfg.c * Math.sin(th), paw[1] - cfg.c * Math.cos(th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a, cfg.b, cfg.bend);
    return [root, knee, end, paw, th];
  };
  const legs = {
    fh: legPts('fh', [hip[0] + 1, hip[1]], LN.hind, false), ff: legPts('ff', [sh[0] + 1, sh[1]], LN.fore, true),
    nh: legPts('nh', hip, LN.hind, false), nf: legPts('nf', sh, LN.fore, true),
  };
  if (p.shadow !== false && ly < 0.5) for (const k of ['nh', 'nf', 'fh', 'ff']) { const [x, y] = legs[k][3]; if (y > -0.3) ell(g, x + 1, 0.2, 2.8, 0.8, 0, 'rgba(40,25,10,0.28)'); }
  // 둥근 발: 발바닥이 땅에 닿고, 앞쪽에 발가락 자국 두 줄
  const paw = (pts, col, toes) => {
    const [x, y] = pts[3], a = pts[4] * 0.7;
    g.save(); g.translate(x, y); g.rotate(a);
    ell(g, 1, -1.25, 2.5, 1.45, 0, col);
    if (toes && real) { g.strokeStyle = LN.toe; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(2.1, -1.6); g.lineTo(2.3, -0.3); g.moveTo(2.9, -1.3); g.lineTo(3.1, -0.4); g.stroke(); }
    g.restore();
  };
  limb(g, legs.fh, 6.4, 3.1, LN.far, null, LN.far); paw(legs.fh, LN.far, false);
  limb(g, legs.ff, 6, 3.3, LN.far, null, LN.far); paw(legs.ff, LN.far, false);
  // 꼬리(스프링): 길게 늘어져 끝이 살짝 들리고, 천천히 흔들다 가끔 휙. 끝에 검은 털 뭉치
  const [hx, hy] = hip, [sx, sy] = sh, my = (hy + sy) / 2;
  const tr = [hx - 5.8, hy - 7.2];
  springTo(r.tail, 0.3 + r.swish * 0.9 + (moving ? 0.25 * Math.sin(ph * TAU) : 0), 22, 4, dt);
  const sw = r.tail.x - 0.3 + 0.12 * Math.sin(t * 1.3), lift = Math.max(0, sw); // sw: 0 = 늘어짐, + = 뒤로 휘두름
  const tp = [tr[0] - 4.4, tr[1] + 0.6, 0, 0, tr[0] - 6.8 - 3.4 * sw, tr[1] + 13.6 - 5 * lift];
  tp[2] = tp[4] + 2.2 + 1.6 * sw; tp[3] = tp[5] - 5 + 1.5 * lift;
  if (ly > 0) { const L = [tr[0] - 2.4, tr[1] + 3.6, tr[0] - 7, -1, tr[0] - 11, -1.4]; for (let i = 0; i < 6; i++) tp[i] += (L[i] - tp[i]) * ly; } // 누우면 땅에 늘어뜨린다
  g.strokeStyle = C(LN.col); g.lineWidth = 1.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(tr[0], tr[1]);
  g.bezierCurveTo(tp[0], tp[1], tp[2], tp[3], tp[4], tp[5]); g.stroke();
  const te = [tp[4], tp[5]], tdx = te[0] - tp[2], tdy = te[1] - tp[3], tl = Math.hypot(tdx, tdy) || 1;
  ell(g, te[0] + (tdx / tl) * 0.9, te[1] + (tdy / tl) * 0.9, 2.1, 1.35, Math.atan2(tdy, tdx), LN.tuft);
  // 몸통: 엉덩이 · 등 · 솟은 어깨뼈 · 두툼한 어깨 · 깊은 가슴 · 처진 뱃살 · 굵은 허벅지(숨 쉴 때 배가 살짝 부푼다)
  const by = 1 + 0.025 * breath, wy = sy - 10.2 - 2 * rollN - 0.7 * rollF;
  const body = new Path2D();
  body.moveTo(hx + 1, hy - 8.8);
  body.quadraticCurveTo(-1.5, Math.min(hy, sy) - 7.4, sx - 3.4, wy);
  body.quadraticCurveTo(sx + 3, wy - 0.6, sx + 6.4, sy - 5.6);
  body.quadraticCurveTo(sx + 8.2, sy - 0.6, sx + 4.6, sy + 4.6 * by);
  body.bezierCurveTo(sx - 1, sy + 6.2 * by, hx + 9, hy + 5.8 * by, hx + 4.6, hy + 4);
  body.quadraticCurveTo(hx + 3.6, hy + 5.6, hx + 2.6, hy + 6.8);
  body.quadraticCurveTo(hx - 3.2, hy + 7.8, hx - 6.6, hy + 2.4);
  body.bezierCurveTo(hx - 8.4, hy - 1.2, hx - 7.8, hy - 6.4, hx - 5.6, hy - 7.8);
  body.quadraticCurveTo(hx - 2.6, hy - 9.6, hx + 1, hy - 8.8);
  body.closePath();
  g.fillStyle = C(LN.col); g.fill(body);
  if (real) {
    g.save(); g.clip(body);
    g.fillStyle = LN.belly; g.beginPath(); g.ellipse(1, my + 5.6, 14, 3.4, 0, 0, TAU); g.fill(); // 연한 배
    g.fillStyle = 'rgba(90,55,20,0.16)'; g.beginPath(); g.ellipse(0.5, my + 6.6, 12, 2.2, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.fillStyle = 'rgba(255,238,205,0.38)'; g.beginPath(); g.ellipse(-1, Math.min(hy, sy) - 8.6, 11, 1.4, 0, 0, TAU); g.fill(); // 등 하이라이트
    g.strokeStyle = 'rgba(120,70,30,0.24)'; g.lineWidth = 0.55; g.lineCap = 'round'; // 어깨뼈·허벅지 근육 선(어깨뼈 선은 걸음에 맞춰 오르내린다)
    g.beginPath(); g.moveTo(sx - 4.2, wy + 3.4); g.quadraticCurveTo(sx - 5.2, sy - 1.6, sx - 2.8, sy + 2.8); g.stroke();
    g.beginPath(); g.moveTo(hx + 2.4, hy - 5.4); g.quadraticCurveTo(hx + 4.2, hy - 0.6, hx + 2, hy + 4.2); g.stroke();
    g.restore();
  }
  limb(g, legs.nh, 6.8, 3.3, LN.col, null, LN.col); paw(legs.nh, LN.col, true);
  limb(g, legs.nf, 6.4, 3.5, LN.col, null, LN.col); paw(legs.nf, LN.col, true);
  // 머리 위치: 서 있으면 등높이, 걸을 땐 낮게, 먹고 마실 땐 땅까지. 머리는 스프링으로 늦게, 쉴 땐 천천히 두리번
  const look = r.look ?? 0;
  const nod = moving ? 0.05 * Math.sin(ph * TAU * 2 - 0.8) : 0.08 * Math.sin(look * 0.4) * Math.sin(look * 0.17);
  springTo(r.head, nod, 40, 8, dt);
  const na = 1.15 + (moving ? 0.6 : 0) + hd * 1.3 - yawn * 0.3 + rr * 0.2 - ly * 0.2 + r.head.x;
  const nb = [sx + 3, sy - 7], nl = 6.6 + hd * 5.4 + rr * 0.5;
  const hc = [nb[0] + Math.sin(na) * nl, nb[1] - Math.cos(na) * nl];
  const hr = 0.16 + (moving ? 0.2 : 0) + hd * 0.95 - yawn * 0.62 - rr * 0.22 + r.head.x * 0.8;
  const ch = Math.cos(hr), shr = Math.sin(hr), H2W = (x, y) => [hc[0] + x * ch - y * shr, hc[1] + x * shr + y * ch];
  // 갈기: 목 뿌리(가슴)부터 머리 뒤까지 감싸는 뾰족한 털 덩어리 + 얼굴 둘레의 밝은 갈기
  const spiky = (A, B, rA, rB, n, col, chest) => {
    let ux = B[0] - A[0], uy = B[1] - A[1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const vx = -uy, vy = ux;
    g.fillStyle = C(col); g.beginPath();
    for (let i = 0; i < n; i++) {
      const q = (i / n) * TAU, cq = Math.cos(q), sq = Math.sin(q), c = cq >= 0 ? B : A;
      const rad = ((cq >= 0 ? rB : rA) + chest * Math.max(0, sq)) * (i % 2 ? 0.84 : JIT[i % 30]);
      const x = c[0] + (ux * cq + vx * sq) * rad, y = c[1] + (uy * cq + vy * sq) * rad;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.fill();
  };
  const mB = H2W(-3.4, 0.2), mA = [nb[0] + 0.5, nb[1] + 2.6];
  spiky(mA, mB, 7.2, 7.5, 28, LN.mane, 1.6);
  const rc = H2W(-1.4, 0.7);
  spiky([rc[0] - 0.01, rc[1]], rc, 6.2, 6.2, 18, LN.maneLight, 0);
  // 얼굴(옆모습): 아래턱은 경첩(0.6, 2)을 중심으로 열린다
  g.save(); g.translate(hc[0], hc[1]); g.rotate(hr);
  const ear = (x, y, col, inner, k) => {
    g.save(); g.translate(x, y); g.rotate(r.ear.x * k);
    ell(g, 0, -1.3, 1.5, 1.7, -0.2, col);
    if (inner && real) ell(g, 0.15, -1.1, 0.75, 0.95, -0.2, LN.earIn);
    g.restore();
  };
  ear(0.4, -3.6, LN.far, false, 0.35);
  const closed = r.blink > 0 || p.st === 'rest' || yawn > 0.3, j = jaw;
  const jt = [0.6 + 5 * Math.cos(j) - 0.4 * Math.sin(j), 2 + 5 * Math.sin(j) + 0.4 * Math.cos(j)]; // 아래턱 끝
  if (j > 0.02) { // 입 안(어두운 빨강) + 혀
    g.fillStyle = C(LN.mouth); g.beginPath(); g.moveTo(0.4, 2); g.lineTo(6.3, 2.5); g.quadraticCurveTo(6.4, jt[1] - 0.4, jt[0], jt[1]); g.closePath(); g.fill();
  }
  g.save(); g.translate(0.6, 2); g.rotate(j); g.translate(-0.6, -2);
  if (j > 0.05 && real) { ell(g, 3.6, 2.2, 2.3, 0.6, 0.02, LN.tongue); g.fillStyle = LN.tooth; g.beginPath(); g.moveTo(4.7, 2.4); g.lineTo(5.3, 2.4); g.lineTo(5.05, 1.3); g.closePath(); g.fill(); }
  const jawP = new Path2D();
  jawP.moveTo(0.6, 2); jawP.lineTo(5.6, 2.4); jawP.quadraticCurveTo(5.8, 4, 4.1, 4.5); jawP.quadraticCurveTo(0.8, 5, -2.4, 3.4); jawP.quadraticCurveTo(-1.8, 2.2, 0.6, 2); jawP.closePath();
  g.fillStyle = C(LN.col); g.fill(jawP);
  if (real) ell(g, 3.4, 3.9, 1.9, 0.75, 0.05, LN.muzzle); // 흰 턱
  g.restore();
  const head = new Path2D();
  head.moveTo(-3.4, -3.2); head.quadraticCurveTo(-0.6, -5.4, 2.6, -4.2); head.quadraticCurveTo(4.6, -3.4, 6, -1.8);
  head.quadraticCurveTo(7.2, -1, 7.4, 0.4); head.quadraticCurveTo(7.6, 2, 6.4, 2.5); head.lineTo(1, 2.2);
  head.quadraticCurveTo(-2.6, 2.6, -3.8, 0.4); head.quadraticCurveTo(-4.2, -1.6, -3.4, -3.2); head.closePath();
  g.fillStyle = C(LN.col); g.fill(head);
  if (real) {
    g.save(); g.clip(head);
    g.fillStyle = LN.muzzle; g.beginPath(); g.ellipse(5.4, 1.5, 2.3, 1.5, 0.1, 0, TAU); g.fill(); // 수염 자리
    g.fillStyle = 'rgba(255,240,210,0.5)'; g.beginPath(); g.ellipse(2.8, -1.1, 1.3, 0.55, -0.1, 0, TAU); g.fill(); // 눈 밑 흰 털
    g.fillStyle = 'rgba(120,70,30,0.18)'; g.beginPath(); g.ellipse(4.2, -3.2, 3, 0.9, 0.5, 0, TAU); g.fill(); // 콧등 그늘
    g.restore();
    g.fillStyle = '#8a5a34'; for (const [x, y] of [[4.9, 1.1], [5.5, 1.5], [5, 1.9]]) { g.beginPath(); g.arc(x, y, 0.16, 0, TAU); g.fill(); }
    if (j < 0.05) { g.strokeStyle = LN.line; g.lineWidth = 0.35; g.lineCap = 'round'; g.beginPath(); g.moveTo(6.5, 2.5); g.quadraticCurveTo(4.6, 2.9, 3, 2.4); g.stroke(); }
    else { g.fillStyle = LN.tooth; g.beginPath(); g.moveTo(5.4, 2.4); g.lineTo(6, 2.45); g.lineTo(5.65, 3.5); g.closePath(); g.fill(); } // 송곳니
    g.strokeStyle = LN.line; g.lineWidth = 0.4; g.beginPath(); g.moveTo(1.5, -2.9); g.quadraticCurveTo(2.7, -3.3, 3.8, -2.6); g.stroke(); // 눈썹
    if (!closed) ell(g, 2.6, -1.9, 1.05, 0.9, 0, LN.iris);
  }
  ell(g, 7, -0.2, 0.95, 0.7, 0.3, LN.nose);
  eye(g, 2.6, -1.9, 0.7, closed);
  ear(-1.6, -3.4, LN.col, true, 0.6);
  g.restore();
  // 포효: 입 앞으로 퍼지는 소리 물결
  if (rr > 0.3) {
    const m = H2W(6.6, 2.6), dir = hr + j * 0.5;
    g.save(); g.globalAlpha *= 0.85 * Math.min(1, (rr - 0.3) * 3); g.strokeStyle = C('#fffaf0'); g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const rad = 2.2 + k * 1.5 + ((p.sp * 14) % 1) * 1.5; g.lineWidth = 0.95 - k * 0.15; g.beginPath(); g.arc(m[0], m[1], rad, dir - 0.6, dir + 0.6); g.stroke(); }
    g.restore();
  }
  g.restore();
}
