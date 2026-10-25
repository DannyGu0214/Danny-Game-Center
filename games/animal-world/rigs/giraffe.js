// 기린 리그. 모양은 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX. 원점 = 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.
// 아주 긴 다리와 목, 높은 어깨(기갑)에서 엉덩이로 내려가는 등선, 크림색 바탕에 불규칙한 갈색 무늬(몸·목 모양으로 잘라 그린다).
// 걸음 = 같은 쪽 앞뒤 다리가 거의 함께 움직이는 측대보에 가까운 느린 걷기. 목은 걸음마다 앞뒤로 크게 흔들린다(스프링).
// 먹기 = 먹이통 높이로 목을 내밀어 숙임, 물 = 앞다리를 크게 벌리고 목을 땅까지, 눕기 = 다리를 접고 목은 세움,
// 특수(목 뻗어 잎 먹기) = 목을 곧게 위로 뻗고, 보라색 긴 혀로 머리 위 가지의 잎을 감아 먹는다.

export const STRIDE = 16; // 느리고 긴 걸음
export const BOX = [24, 90]; // 물 마시기·먹기 때 머리가 앞으로 멀리 나가고, 특수 행동 때 가지가 머리 위에 있다
const DUTY = 0.66;
const OFFS = { nh: 0, nf: 0.08, fh: 0.5, ff: 0.58 }; // 측대보: 가까운 쪽 뒤·앞 → 먼 쪽 뒤·앞
const TAU = Math.PI * 2;

const GF = {
  col: '#ecc88f', far: '#cfa673', patch: '#a5622d', mane: '#9a5a2a', tuft: '#3a2616', hoof: '#3e2a1a', hoofFar: '#56402c',
  muzzle: '#dcb27a', nose: '#4a3020', tongue: '#4b2c5e', twig: '#7a5634', leaf: '#6f9a3c', leaf2: '#86b04a',
  hip: [-9, -34.5], sh: [9, -38],
  hind: { a: 10, b: 12.5, c: 13, bend: 1 }, fore: { a: 11, b: 13.5, c: 14, bend: -1 }, lift: 4.6, neck: 33,
};

// 무늬 모양(한 번만 만든다): 몸 무늬는 서 있는 자세 좌표, 목 무늬는 목 줄기(u)·폭(v) 좌표
let PAT = null;
function patterns(hash) {
  if (PAT) return PAT;
  const shape = (s) => Array.from({ length: 6 }, (_, k) => { const a = ((k + 0.45 * hash(s, k, 1)) / 6) * TAU, m = 0.78 + 0.38 * hash(s, k, 2); return [Math.cos(a) * m, Math.sin(a) * m]; });
  const body = [], neck = [];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) {
    const s = 7 + j * 7 + i;
    const q = { x: -18 + i * 5.7 + (j % 2) * 2.85 + (hash(s, 3, 3) - 0.5) * 1.2, y: -52.5 + j * 5 + (hash(s, 4, 3) - 0.5) * 1.1, r: 2.35 + hash(s, 5, 3) * 0.55, pts: shape(s) };
    const top = -42.9 - 9.3 * Math.max(0, Math.min(1, (q.x + 10.5) / 18)); // 서 있을 때 등선 높이(몸 밖 무늬는 버린다)
    if (q.y > top - q.r && q.y < -29 + q.r && q.x > -17.5 - q.r && q.x < 17 + q.r) body.push(q);
  }
  for (let j = 0; j < 7; j++) for (let i = 0; i < 2; i++) {
    const s = 90 + j * 2 + i;
    neck.push({ u: 0.08 + j * 0.135 + i * 0.065, v: i ? 0.4 : -0.36, r: 0.19 + hash(s, 6, 3) * 0.05, pts: shape(s) });
  }
  PAT = { body, neck };
  return PAT;
}
// 둥근 모서리 다각형(무늬 한 조각)을 경로에 더한다
function blob(path, cx, cy, r, pts) {
  const n = pts.length, last = pts[n - 1];
  path.moveTo(cx + ((last[0] + pts[0][0]) / 2) * r, cy + ((last[1] + pts[0][1]) / 2) * r);
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[(k + 1) % n];
    path.quadraticCurveTo(cx + a[0] * r, cy + a[1] * r, cx + ((a[0] + b[0]) / 2) * r, cy + ((a[1] + b[1]) / 2) * r);
  }
  path.closePath();
}
const nd = (a) => [Math.sin(a), -Math.cos(a)]; // 세로에서 앞으로 a만큼 기운 방향
const cl01 = (v) => Math.max(0, Math.min(1, v));

export function draw(g, p, H) {
  const { ik, footAt, smooth, springTo, rigTick, limb, ell, eye, C } = H;
  const real = H.real();
  const r = p.rig ?? {}, dt = p.dt ?? 0;
  rigTick(r, dt);
  if (!r.nk) Object.assign(r, { nk: { x: 0, v: 0 }, hk: 'eat' });
  const follow = (s, target, k, c) => { if (dt > 0) springTo(s, target, k, c, dt); else { s.x = target; s.v = 0; } };
  const pat = patterns(H.hash);
  const moving = p.mv > 0 && p.sp < 0, ph = p.gait ?? 0, t = p.ph ?? 0, ly = p.ly ?? 0, lk = p.rig ? r.look : 0;
  if (p.st === 'eat' || p.st === 'drink') r.hk = p.st; // 고개를 드는 동안에도 어떤 자세였는지 기억
  const hd = p.hd ?? 0, ek = r.hk === 'eat' ? hd : 0, dk = r.hk === 'drink' ? hd : 0;
  const sp = p.sp ?? -1, s = sp >= 0 ? smooth(cl01(sp / 0.15)) * smooth(cl01((1 - sp) / 0.1)) : 0;
  const breath = Math.sin((t * TAU) / 4.2), bob = moving ? Math.sin(ph * TAU * 2 + 0.4) : 0;
  // 물: 몸·다리가 먼저 벌어지고, 목은 윗목부터 굽혀 내려간다(도중에 머리가 너무 앞으로 나가지 않게)
  const dkE = smooth(cl01(dk * 2)), dkA = smooth(cl01((dk - 0.35) / 0.65)), dkB = smooth(cl01((dk - 0.1) / 0.6)), dkL = Math.sin(Math.PI * cl01((dk - 0.1) / 0.85));
  const drop = ly * 26, shift = -6 * ek - 5 * dkE; // 먹고 마실 땐 몸을 조금 뒤로 빼고 목을 앞으로
  if (p.shadow !== false) ell(g, shift * 0.6, 0, 17, 3.4, 0, 'rgba(40,25,10,0.22)');
  const hip = [GF.hip[0] + shift, GF.hip[1] + 0.6 * bob + drop + 1.5 * dkE];
  const sh = [GF.sh[0] + shift, GF.sh[1] + 0.6 * (moving ? Math.sin(ph * TAU * 2 + 1.3) : 0) + drop + 9 * dkE - 0.8 * s];

  // 다리: 서 있으면 IK로 발굽을 땅에 둔다. 물 마실 땐 앞다리를 앞뒤로 크게 벌리고, 누우면 접는다
  const stroke = STRIDE * DUTY;
  const legPts = (key, root, cfg, front) => {
    if (ly > 0.5) {
      const o = key[0] === 'f' ? 1.8 : 0;
      if (front) return [root, [root[0] - 4.5 + o, -3.6], [root[0] + 7.5 + o, -2.4], [root[0] - 3.5 + o, -1.3]]; // 무릎을 앞으로 접어 가슴 밑에
      return [root, [root[0] + 7.5 + o, -4.6], [root[0] - 3.5 + o, -2.5], [root[0] + 8.5 + o, -1.3]]; // 발굽이 배 밑으로
    }
    let f;
    if (moving) { const u = footAt((ph + OFFS[key]) % 1, stroke, GF.lift, DUTY); f = { ...u, x: u.x + root[0] + 0.8 }; }
    else {
      const splay = front ? (key === 'nf' ? 10.5 : -7.5) * dkE : -1.2 * dkE;
      f = { x: root[0] + (key === 'fh' ? -1.2 : key === 'ff' ? 1 : 0) + splay, y: 0, sw: 0, st: 0.45 };
    }
    // 대롱뼈: 내딛을 땐 거의 수직, 들어 올릴 땐 뒤로 접힌다. 벌린 앞다리는 다리 선을 따라 곧게
    let th = front ? 0.95 * f.sw + (f.st - 0.4) * 0.3 * (1 - f.sw) : 0.55 * f.sw + (f.st - 0.5) * 0.22 * (1 - f.sw);
    const k = front ? 1 - 0.17 * dkE : 1; // 옆으로 벌린 다리는 짧아 보인다
    if (front && dkE > 0) th += (Math.atan2(root[0] - f.x, -root[1]) - th) * dkE;
    const hoof = [f.x, f.y], c = cfg.c * k, ankle = [hoof[0] + c * Math.sin(th), hoof[1] - c * Math.cos(th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a * k, cfg.b * k, cfg.bend);
    return [root, knee, end, hoof];
  };
  const legs = {
    fh: legPts('fh', [hip[0] + 0.8, hip[1]], GF.hind, false), ff: legPts('ff', [sh[0] + 0.8, sh[1]], GF.fore, true),
    nh: legPts('nh', hip, GF.hind, false), nf: legPts('nf', sh, GF.fore, true),
  };
  if (p.shadow !== false && ly < 0.5) for (const key of ['nh', 'nf', 'fh', 'ff']) { const [x, y] = legs[key][3]; if (y > -0.3) ell(g, x, 0.2, 2.6, 0.7, 0, 'rgba(40,25,10,0.3)'); }
  limb(g, legs.fh, 4, 1.8, GF.far, null, GF.hoofFar);
  limb(g, legs.ff, 3.8, 1.8, GF.far, null, GF.hoofFar);

  // 꼬리(스프링): 가늘고 길며 끝에 검은 술. 걸을 때 흔들리고 가끔 휙
  const tailRoot = [hip[0] - 6.3, hip[1] - 6.6];
  follow(r.tail, 0.16 + (moving ? 0.1 * Math.sin(ph * TAU) : 0) + r.swish * 0.8 + ly * 0.3, 30, 5);
  const ta = r.tail.x, tl = 17 - ly * 6;
  const tm = [tailRoot[0] - Math.sin(ta * 0.6) * tl * 0.5, tailRoot[1] + Math.cos(ta * 0.6) * tl * 0.5], te = [tailRoot[0] - Math.sin(ta) * tl, tailRoot[1] + Math.cos(ta) * tl];
  g.strokeStyle = C(GF.col); g.lineWidth = 1.3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(tailRoot[0], tailRoot[1]); g.quadraticCurveTo(tm[0] - 1, tm[1], te[0], te[1]); g.stroke();
  ell(g, te[0] - Math.sin(ta) * 1.8, te[1] + Math.cos(ta) * 1.8, 1.5, 3.4, -ta * 0.9, GF.tuft);

  // 몸통: 짧고 깊은 몸. 엉덩이 → 내려가는 등선 → 높은 기갑 → 가슴 → 배(숨 쉴 때 살짝 부푼다)
  const by = 1 + 0.03 * breath, [hx, hy] = hip, [sx, sy] = sh;
  const body = new Path2D();
  body.moveTo(hx - 1.5, hy - 8.4);
  body.bezierCurveTo(hx + 6, hy - 10.6, sx - 9, sy - 11.2, sx - 1.5, sy - 14.2);
  body.quadraticCurveTo(sx + 5, sy - 13.5, sx + 7, sy - 5);
  body.quadraticCurveTo(sx + 8.2, sy + 1.5, sx + 4, sy + 6 * by);
  body.quadraticCurveTo((hx + sx) / 2 + 2, (hy + sy) / 2 + 8.4 * by, hx + 3, hy + 4.6 * by);
  body.quadraticCurveTo(hx - 4.6, hy + 4.4, hx - 6.6, hy - 1);
  body.quadraticCurveTo(hx - 7.4, hy - 7.6, hx - 1.5, hy - 8.4);
  body.closePath();
  g.fillStyle = C(GF.col); g.fill(body);
  limb(g, legs.nh, 4.4, 1.9, GF.col, null, GF.hoof);
  limb(g, legs.nf, 4.1, 1.9, GF.col, null, GF.hoof);
  if (real) { // 무늬는 다리 윗부분까지 덮어 몸과 한 덩어리로 보이게
    g.save(); g.clip(body);
    const pp = new Path2D(), [h0x, h0y] = GF.hip, [s0x, s0y] = GF.sh;
    for (const q of pat.body) {
      const u = (q.x - h0x) / (s0x - h0x);
      blob(pp, q.x + shift, q.y + (hy - h0y) + ((sy - s0y) - (hy - h0y)) * u, q.r, q.pts);
    }
    g.fillStyle = GF.patch; g.fill(pp);
    g.fillStyle = 'rgba(80,40,10,0.15)'; g.beginPath(); g.ellipse((hx + sx) / 2, (hy + sy) / 2 + 7.5, 15, 4.6, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    const ba = Math.atan2((sy - 14.2) - (hy - 8.4), sx - hx);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse((hx + sx) / 2 - 1.5, (hy + sy) / 2 - 10, 9.5, 1.4, ba, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }

  // 목: 2차 곡선 줄기를 따라 굵기가 줄어드는 띠. 걸을 땐 걸음마다 앞뒤로 크게(스프링), 쉴 땐 천천히 두리번
  const swingT = moving ? 0.085 * Math.sin(ph * TAU * 2 - 0.9) : 0.035 * Math.sin(lk * 0.4) * Math.sin(lk * 0.17);
  follow(r.nk, swingT * (1 - s) * (1 - dk), 22, 3.6);
  const sw = r.nk.x;
  const nA = 0.32 + 0.23 * ek + 2.03 * dkA - 0.2 * ly - 0.34 * s + sw;
  const nB = 0.26 + 0.74 * ek + 2.34 * dkB - 0.2 * ly - 0.34 * s + sw * 1.4;
  const NL = GF.neck * (1 - 0.22 * dkL) + 0.5 * s, B = [sx + 2.5, sy - 9], d1 = nd(nA), d2 = nd(nB);
  const P0 = [B[0] - d1[0] * 3, B[1] - d1[1] * 3], P1 = [B[0] + d1[0] * NL * 0.5, B[1] + d1[1] * NL * 0.5], P2 = [P1[0] + d2[0] * NL * 0.5, P1[1] + d2[1] * NL * 0.5];
  const NS = 7, S = [], N = [], W = [];
  for (let i = 0; i < NS; i++) {
    const u = i / (NS - 1), a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    S.push([a * P0[0] + b * P1[0] + c * P2[0], a * P0[1] + b * P1[1] + c * P2[1]]);
    const tx = (1 - u) * (P1[0] - P0[0]) + u * (P2[0] - P1[0]), ty = (1 - u) * (P1[1] - P0[1]) + u * (P2[1] - P1[1]), tn = Math.hypot(tx, ty) || 1;
    N.push([-ty / tn, tx / tn]); // 목 앞쪽(목구멍 쪽)
    W.push((5 + 7.6 * Math.pow(1 - u, 1.25)) / 2);
  }
  const edge = (sg) => S.map((q, i) => [q[0] + N[i][0] * W[i] * sg, q[1] + N[i][1] * W[i] * sg]);
  const back = edge(-1), front = edge(1);
  const neck = new Path2D();
  neck.moveTo(back[0][0], back[0][1]);
  for (let i = 1; i < NS - 1; i++) neck.quadraticCurveTo(back[i][0], back[i][1], (back[i][0] + back[i + 1][0]) / 2, (back[i][1] + back[i + 1][1]) / 2);
  neck.lineTo(back[NS - 1][0], back[NS - 1][1]);
  const tip = S[NS - 1], tpx = -N[NS - 1][1], tpy = N[NS - 1][0]; // 줄기 끝 방향
  neck.quadraticCurveTo(tip[0] + tpx * W[NS - 1] * 1.6, tip[1] + tpy * W[NS - 1] * 1.6, front[NS - 1][0], front[NS - 1][1]);
  for (let i = NS - 2; i > 0; i--) neck.quadraticCurveTo(front[i][0], front[i][1], (front[i][0] + front[i - 1][0]) / 2, (front[i][1] + front[i - 1][1]) / 2);
  neck.lineTo(front[0][0], front[0][1]);
  neck.closePath();
  g.fillStyle = C(GF.col); g.fill(neck);
  if (real) {
    g.save(); g.clip(neck);
    const pp = new Path2D();
    for (const q of pat.neck) {
      const fi = q.u * (NS - 1), i0 = Math.min(NS - 2, Math.floor(fi)), f = fi - i0, lerp = (A, j) => A[i0][j] + (A[i0 + 1][j] - A[i0][j]) * f;
      const w = W[i0] + (W[i0 + 1] - W[i0]) * f, cx = lerp(S, 0) + lerp(N, 0) * q.v * w * 2 * 0.62, cy = lerp(S, 1) + lerp(N, 1) * q.v * w * 2 * 0.62;
      blob(pp, cx, cy, q.r * w * 2, q.pts);
    }
    g.fillStyle = GF.patch; g.fill(pp);
    g.restore();
  }
  // 갈기: 목 뒷선을 따라 짧고 곧게 선 털
  g.strokeStyle = C(GF.mane); g.lineWidth = 1.9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 1; i < NS; i++) { const x = back[i][0] - N[i][0] * 0.55, y = back[i][1] - N[i][1] * 0.55; if (i === 1) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  if (real) {
    g.lineWidth = 0.8; g.beginPath();
    for (let i = 1; i < NS; i++) for (const f of [0, 0.5]) {
      const j = Math.min(NS - 1, i + f), i0 = Math.floor(j), i1 = Math.min(NS - 1, i0 + 1), m = j - i0;
      const x = back[i0][0] + (back[i1][0] - back[i0][0]) * m, y = back[i0][1] + (back[i1][1] - back[i0][1]) * m, nx = N[i0][0], ny = N[i0][1];
      g.moveTo(x - nx * 0.6, y - ny * 0.6); g.lineTo(x - nx * 2.1, y - ny * 2.1);
    }
    g.stroke();
  }

  // 머리: 목 끝에서 스프링으로 살짝 늦게 따라온다. 먹을 땐 우물우물
  const chew = r.hk === 'eat' && hd > 0.5 ? 0.05 * Math.sin(t * 7) : 0;
  follow(r.head, -0.55 * sw + (moving || ly > 0.5 ? 0 : 0.1 * Math.sin(lk * 0.31) * (1 - hd) * (1 - s)) + chew, 45, 7);
  const hA = 0.5 + 0.8 * ek + 1.25 * dkB - 0.08 * ly - 1.05 * s + r.head.x;
  const ca = Math.cos(hA), sa = Math.sin(hA), toW = (x, y) => [P2[0] + x * ca - y * sa, P2[1] + x * sa + y * ca];
  // 특수: 머리 위 앞쪽의 잎 달린 가지(잎은 하나씩 먹혀 줄어든다)
  if (s > 0.3) {
    const M = toW(10.6, 0.6), q = smooth(cl01((s - 0.3) / 0.7)), bx = M[0] - 0.5, by2 = M[1] - 4.2 - (1 - q) * 3;
    g.save(); g.translate(bx, by2); g.scale(q, q);
    g.strokeStyle = C(GF.twig); g.lineCap = 'round'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(11, -2.5); g.quadraticCurveTo(4, -1.5, -5, 0.5); g.moveTo(3.5, -1.2); g.lineTo(1.5, -3.6); g.stroke();
    const leaves = [[-4.6, 1.6, 0.6], [-1.5, 1.7, -0.5], [1.2, -3.9, -0.9], [2.4, 0.9, 0.4], [5.4, -0.8, -0.4], [8.2, -1.2, 0.5]];
    const left = sp >= 0 ? Math.max(2, leaves.length - Math.floor(cl01((sp - 0.25) / 0.6) * 4)) : leaves.length;
    for (let i = leaves.length - left; i < leaves.length; i++) { const [lx, ly2, la] = leaves[i]; ell(g, lx, ly2, 2.4, 1.3, la, i % 2 ? GF.leaf : GF.leaf2); }
    g.restore();
  }
  g.save(); g.translate(P2[0], P2[1]); g.rotate(hA);
  const ear = (x, y, ang, col, inner) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(0, -0.9); g.quadraticCurveTo(-3, -2.3, -5.2, -0.4); g.quadraticCurveTo(-3, 1.2, 0, 0.9); g.closePath(); g.fill();
    if (inner && real) ell(g, -2.6, -0.4, 1.6, 0.5, -0.1, '#c99a68');
    g.restore();
  };
  const ossi = (x, y, col) => { // 뿔(오시콘): 짧은 기둥 + 검은 털 뭉치
    g.strokeStyle = C(col); g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1.2, y - 3.4); g.stroke();
    ell(g, x - 1.3, y - 3.7, 1, 0.95, 0, GF.tuft);
  };
  ear(-1.6, -2.1, 0.3 - r.ear.x * 0.7 + 0.12 * ly, GF.far, false);
  ossi(0.8, -2.9, GF.far);
  const head = new Path2D();
  head.moveTo(-2.6, -0.5);
  head.quadraticCurveTo(-2.2, -3.4, 1, -3.3);
  head.quadraticCurveTo(5, -3.2, 9.2, -1.8);
  head.quadraticCurveTo(11, -1.2, 10.8, 0.6);
  head.quadraticCurveTo(10.6, 2.3, 8.6, 2.4);
  head.quadraticCurveTo(4.5, 2.3, 1.5, 3.2);
  head.quadraticCurveTo(-2.4, 3.2, -2.6, -0.5);
  head.closePath();
  g.fillStyle = C(GF.col); g.fill(head);
  if (real) {
    g.save(); g.clip(head);
    g.fillStyle = GF.muzzle; g.beginPath(); g.ellipse(9.4, 0.6, 2.8, 2.6, 0, 0, TAU); g.fill();
    g.fillStyle = GF.patch; g.beginPath(); g.ellipse(-0.6, 1.4, 1.1, 0.9, 0.4, 0, TAU); g.ellipse(5.6, -2.9, 1.1, 0.7, 0.2, 0, TAU); g.fill();
    g.fillStyle = 'rgba(90,50,20,0.14)'; g.beginPath(); g.ellipse(4.5, 3, 7, 1.6, 0, 0, TAU); g.fill();
    g.restore();
    ell(g, 9.7, -0.5, 0.55, 0.35, 0.3, GF.nose);
    g.strokeStyle = GF.nose; g.lineWidth = 0.45; g.beginPath(); g.moveTo(10.5, 1.2); g.quadraticCurveTo(9.6, 1.7, 8.4, 1.6); g.stroke();
    eye(g, 2.6, -1.1, 0.95, r.blink > 0 || p.st === 'rest');
  }
  ossi(-0.6, -2.8, GF.col);
  ear(-1.2, -1.8, 0.45 - r.ear.x * 0.8 + 0.12 * ly, GF.col, true);
  // 특수: 길고 검보라색인 혀가 가지 쪽으로 말려 올라간다
  if (s > 0.3) {
    const e = 0.5 + 0.5 * Math.sin(sp * TAU * 4.5), L = (s - 0.3) / 0.7;
    g.strokeStyle = C(GF.tongue); g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(10.2, 1.0); g.bezierCurveTo(12.5 + 2 * e * L, 2.4, 14.5 + 2.5 * e * L, -1.2 - e * L, 12.4 + 2 * e * L, -3.4 - 1.8 * e * L); g.stroke();
  }
  g.restore();
}
