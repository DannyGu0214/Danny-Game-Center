// 날쥐(긴귀날쥐 느낌) 리그: 아주 큰 뒷발, 가슴에 붙인 작은 앞발, 큰 귀, 큰 눈, 끝에 검은·흰 털 술이 달린 아주 길고 가는 꼬리.
// 이동: 두 뒷발을 모아 캥거루처럼 깡충(한 번 뛰는 거리 = STRIDE). 꼬리는 균형추로 뒤로 뻗고, 몸이 오르내릴 때 늦게 따라와 물결친다. 착지 땐 눌린다.
// 쉬기(뒷발로 앉아 수염·코 씰룩, 귀 돌리기, 가끔 앞발로 세수)·먹기(앞발로 씨앗을 쥐고 오물오물)·물(몸을 숙여 할짝)·눕기(공처럼 웅크리고 꼬리를 두르고 눈 감기)
// ·특수 행동(긴 뒷다리로 아주 높이 세 번 뛰기: 꼬리가 길게 흩날리고 끝 술이 채찍처럼 휙).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 6; // 한 번 뛸 때 나아가는 거리(그림 단위)
export const BOX = [6, 12];
const TAU = Math.PI * 2;
const JB = {
  col: '#dcb889', belly: '#f7efe0', earIn: '#ecb3a6', nose: '#d98a86', foot: '#ecd5ad', toe: '#d9c099', tuftK: '#2b2420', tuftW: '#fbf8f0',
  seed: '#a8743c', seedHi: '#d9a866', ring: '#f4e8d2', lid: '#5a4030',
};
const HIP = [-1.7, 1.0], SH = [1.6, 1.0], NECK = [2.0, -0.8], TAILB = [-2.8, 0.6]; // 몸 좌표(몸 중심 기준, 기울이기·늘이기 전)
const LEG = { a: 2.1, b: 2.7, F: 3.0, ua: 0.85, la: 0.85 }; // 허벅지·정강이·뒷발, 앞다리 위·아래
const TLEN = 10, TN = 10; // 꼬리 길이·마디 수

// 한 번 뛰기(위상 0~1): [위상, 몸 x, 높이, 기울기(-면 코가 위), 늘이기]
// 0 발끝 착지 → 0.1 눌림 → 0.22 차고 오름(쭉 늘어남) → 0.5 꼭대기 → 내려오며 발을 앞으로
const HOP = [
  [0.00, 0.3, 0.2, -0.3, -0.04],
  [0.10, 0.0, -0.45, -0.2, -0.17],
  [0.22, -0.3, 0.5, -0.36, 0.15],
  [0.34, -0.15, 2.2, -0.22, 0.12],
  [0.52, 0.1, 3.0, -0.08, 0.06],
  [0.70, 0.3, 2.4, -0.08, 0.0],
  [0.87, 0.4, 1.1, -0.22, -0.02],
];
const H_OFF = 0.24, XL = 0.6; // 뒷발이 땅을 떠나는 위상, 착지하는 발끝 x
const BASE_Y = -3.9;
const LEAPS = [15, 19, 13]; // 특수 행동 높이 뛰기 세 번의 높이(외곽선 캔버스는 BOX 높이 위로 30 여유)

function cyc(keys, u) {
  const n = keys.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] <= u) i = k;
  const k0 = keys[(i - 1 + n) % n], k1 = keys[i], k2 = keys[(i + 1) % n], k3 = keys[(i + 2) % n];
  const u2 = i + 1 < n ? k2[0] : 1 + k2[0], s = (u - k1[0]) / (u2 - k1[0]), s2 = s * s, s3 = s2 * s, out = [];
  for (let j = 1; j < k1.length; j++) {
    const p0 = k0[j], p1 = k1[j], p2 = k2[j], p3 = k3[j];
    out.push(0.5 * (2 * p1 + (p2 - p0) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (3 * p1 - p0 - 3 * p2 + p3) * s3));
  }
  return out;
}
const mod1 = (v) => ((v % 1) + 1) % 1;
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
function frame(cx, cy, th, st, sq = 1) {
  const ca = Math.cos(th), sa = Math.sin(th), kx = (1 + st) * sq, ky = 1 / (1 + st);
  return { cx, cy, th, kx, ky, T: (x, y) => [cx + ca * x * kx - sa * y * ky, cy + sa * x * kx + ca * y * ky] };
}
const hopFrame = (u) => { const [bx, lift, th, st] = cyc(HOP, mod1(u)); return frame(bx, BASE_Y - lift, th, st); };
// 높이 뛰기(특수 행동 진행 sp 0~1에 세 번): h 높이, crouch 웅크림, stretch 몸을 세워 늘이기, air 공중, w 공중 진행, vy 위로 가는 빠르기(1 → -1), spin 몸 비틀기, push 차기
function leapState(sp) {
  const s = Math.max(0, Math.min(0.9999, sp)), n = LEAPS.length, k = Math.floor(s * n), q = s * n - k, Hm = LEAPS[k];
  const o = { h: 0, crouch: 0, stretch: 0, air: false, w: 0, vy: 0, push: 0, spin: 0 };
  if (q < 0.2) { o.push = ss((q - 0.13) / 0.07); o.crouch = ss(q / 0.12) * (1 - o.push) * (k === 0 ? ss(sp / 0.03) : 1); o.stretch = o.push; o.vy = o.push; }
  else if (q < 0.86) {
    const w = (q - 0.2) / 0.66; o.air = true; o.w = w; o.h = Hm * 4 * w * (1 - w); o.vy = 1 - 2 * w;
    o.stretch = 1 - 0.7 * ss(w / 0.4) + 0.5 * ss((w - 0.72) / 0.28); o.spin = (k === 1 ? 0.5 : -0.3) * Math.sin(Math.PI * w);
  } else { o.crouch = Math.sin(Math.PI * (q - 0.86) / 0.14) * 0.9; }
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

let BODY = null, HEAD = null;
function paths() {
  if (BODY) return;
  BODY = new Path2D(); // 몸 좌표: 둥글고 큰 엉덩이 → 등 → 가슴(작다) → 배
  BODY.moveTo(2.4, -0.5);
  BODY.quadraticCurveTo(0.6, -2.4, -1.5, -2.15);
  BODY.quadraticCurveTo(-3.3, -1.7, -3.15, 0.3);
  BODY.quadraticCurveTo(-2.9, 2.15, -0.6, 2.05);
  BODY.quadraticCurveTo(1.6, 1.85, 2.5, 0.65);
  BODY.quadraticCurveTo(2.85, 0.0, 2.4, -0.5);
  BODY.closePath();
  HEAD = new Path2D(); // 머리 좌표(머리 중심 기준, 오른쪽이 코): 둥근 머리 + 짧고 뾰족한 주둥이
  HEAD.moveTo(-1.75, 0.45);
  HEAD.quadraticCurveTo(-1.95, -1.85, 0.15, -1.9);
  HEAD.quadraticCurveTo(1.6, -1.85, 2.25, -0.55);
  HEAD.quadraticCurveTo(2.75, 0.05, 2.55, 0.5);
  HEAD.quadraticCurveTo(2.15, 1.2, 0.8, 1.4);
  HEAD.quadraticCurveTo(-1.35, 1.65, -1.75, 0.45);
  HEAD.closePath();
}

export function draw(g, p, H) {
  const { ik, springTo, rigTick, ell, eye, C, shade } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const leap = sp >= 0, hop = !leap && p.mv > 0, u = hop ? mod1(p.gait ?? 0) : 0;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  // 사막 동물은 게임에서 ly를 받지 못하므로 상태로 직접 웅크린다(아이콘처럼 dt가 없으면 바로)
  const restT = !leap && !hop && p.st === 'rest' ? 1 : 0;
  const ly = Math.max(leap || hop ? 0 : p.ly ?? 0, dt > 0 ? clamp01(spring('rest', restT, 14, 7)) : restT);
  const eat = p.st === 'eat' && !hop && !leap ? hd * (1 - ly) : 0, drink = p.st === 'drink' && !hop && !leap ? hd * (1 - ly) : 0;
  const far = shade(JB.col, 0.8), breath = Math.sin(t * TAU / 1.4);
  const lv = leap ? leapState(sp) : null;

  // ---- 자세: 몸 틀(F)·뒷발(발끝·발 각도 psi)·머리 위치(목에서 화면 기준)·각도 ----
  let F, legs, headOff, ha, earT, lift = 0, closed = false, groom = 0, sniff = 0, wTrail = 0;
  const hind = (toe, psi) => ({ toe, psi });
  if (hop) {
    F = hopFrame(u);
    lift = BASE_Y - F.cy;
    // 뒷발: 착지(0) → 이륙(H_OFF) 동안 땅에 붙어 몸이 간 만큼 뒤로, 공중에선 뒤로 쭉 뻗었다가 앞으로 모아 착지
    const hindAt = (uu, dx) => {
      const q = mod1(uu);
      if (q <= H_OFF) { const k = q / H_OFF; return hind([XL + dx - q * STRIDE, 0], k < 0.4 ? lerp(0.45, 0.2, ss(k / 0.4)) : lerp(0.2, 1.2, ss((k - 0.4) / 0.6))); }
      const w = (q - H_OFF) / (1 - H_OFF), cur = hopFrame(q).T(...HIP), h0 = hopFrame(H_OFF).T(...HIP), h1 = hopFrame(0).T(...HIP);
      const rel0 = [XL + dx - H_OFF * STRIDE - h0[0], -h0[1]], rel1 = [XL + dx - h1[0], -h1[1]], trail = [-4.7, 2.0], tuck = [1.9, 2.9];
      let rel, psi;
      if (w < 0.3) { const k = ss(w / 0.3); rel = lerp2(rel0, trail, k); psi = lerp(1.2, 2.2, k); }
      else if (w < 0.45) { rel = trail; psi = 2.2; }
      else if (w < 0.82) { const k = ss((w - 0.45) / 0.37); rel = lerp2(trail, tuck, k); rel[1] -= 0.8 * Math.sin(Math.PI * k); psi = lerp(2.2, 0.5, k); }
      else { const k = ss((w - 0.82) / 0.18); rel = lerp2(tuck, rel1, k); psi = lerp(0.5, 0.45, k); }
      return hind([cur[0] + rel[0], Math.min(0, cur[1] + rel[1])], psi);
    };
    legs = { nh: hindAt(u, 0), fh: hindAt(u + 0.025, 0.5) };
    headOff = [1.9, -0.6]; ha = F.th * 0.45 + 0.1;
    earT = -1.0 - 0.4 * clamp01(lift / 3);
    wTrail = 1;
  } else {
    // 앉기(뒷발로) ↔ 먹기(앞발로 씨앗) / 물(몸 숙이기) ↔ 웅크리기(눕기)
    let cx = -0.3, cy = -4.55, th = -1.08, st = 0, sq = 1;
    if (lv) { cy += lv.crouch * 0.9 - lv.h; th = lerp(th, -1.32, lv.stretch) + lv.spin; st = 0.16 * lv.stretch - 0.14 * lv.crouch; }
    else {
      th = lerp(th, -0.3, drink); cx = lerp(cx, 0.3, drink); cy = lerp(cy, -3.5, drink);
      th = lerp(th, -1.0, eat);
      cx = lerp(cx, -0.4, ly); cy = lerp(cy, -2.45, ly); th = lerp(th, 0.05, ly); st = lerp(st, -0.1, ly); sq = lerp(1, 0.97, ly);
      // 가끔 앞발로 얼굴 닦기(세수), 코 킁킁
      const gc = (t % 11) / 11;
      groom = ss((gc - 0.76) / 0.04) * ss((0.96 - gc) / 0.04) * (1 - hd) * (1 - ly);
      th -= 0.1 * groom;
      sniff = Math.max(0, Math.sin(t * 1.1) * 1.6 - 0.5);
    }
    F = frame(cx, cy, th, st, sq);
    const hip = F.T(...HIP);
    if (lv && lv.air) {
      // 공중: 차고 오를 땐 다리를 아래로 쭉, 꼭대기에서 접었다가 착지 전에 다시 뻗는다
      const rel = lerp2(lerp2([0.5, 5.4], [1.8, 3.0], ss(lv.w / 0.45)), [0.9, 4.8], ss((lv.w - 0.7) / 0.3));
      const psi = lerp(lerp(1.45, 0.55, ss(lv.w / 0.45)), 1.05, ss((lv.w - 0.7) / 0.3));
      const toe = [hip[0] + rel[0], Math.min(0, hip[1] + rel[1])];
      legs = { nh: hind(toe, psi), fh: hind([toe[0] + 0.5, toe[1] - 0.2], psi - 0.05) };
      wTrail = ss(lv.w / 0.12) * (1 - ss((lv.w - 0.85) / 0.15));
    } else {
      const push = lv ? lv.push : 0;
      const tx = hip[0] + lerp(lerp(2.0, 1.2, ly), 1.3, drink);
      legs = { nh: hind([tx, 0], push * 1.25), fh: hind([tx + 0.5, 0], push * 1.25) };
    }
    headOff = lerp2(lerp2([1.1, -1.5], [1.6, 0.4], drink), [0.55, 0.45], ly);
    ha = lerp(lerp(lerp(0.2, 0.45, eat), 0.85, drink), 1.25, ly) + 0.3 * groom;
    if (lv) ha = -0.05 + 0.25 * lv.crouch + lv.spin * 0.4;
    else if (hd < 0.5 && ly < 0.5 && dt > 0) ha += 0.06 * Math.sin(r.look * 0.6) * Math.sin(r.look * 0.23);
    earT = lerp(-0.3, -2.35, ly) + (lv ? -0.5 * clamp01(lv.h / 5) - 0.7 * Math.max(0, lv.vy) + 0.25 * Math.max(0, -lv.vy) : 0) - 0.25 * groom - 0.2 * drink;
    closed = ly > 0.6 || groom > 0.5;
    lift = lv ? lv.h : 0;
  }
  closed = closed || r.blink > 0;
  const { T } = F, hip = T(...HIP), sh = T(...SH), nb = T(...NECK);
  const hc = [nb[0] + headOff[0], nb[1] + headOff[1]], hcos = Math.cos(ha), hsin = Math.sin(ha);
  const HW = (x, y) => [hc[0] + hcos * x - hsin * y, hc[1] + hsin * x + hcos * y]; // 머리 좌표 → 그림 좌표

  // ---- 앞발: 가슴에 붙여 든다. 먹을 땐 입 앞에서 씨앗을 쥐고, 물 마실 땐 땅을 짚고, 세수할 땐 얼굴을 비빈다 ----
  let paws = { nf: T(2.75, 1.15), ff: T(2.95, 0.9) };
  if (eat > 0) { const nib = Math.sin(t * TAU * 3) * 0.1, m = HW(2.0, 1.55); paws.nf = lerp2(paws.nf, [m[0] - 0.25, m[1] + 0.35 + nib], eat); paws.ff = lerp2(paws.ff, [m[0] + 0.2, m[1] + 0.25 + nib], eat); }
  if (drink > 0) { paws.nf = lerp2(paws.nf, [sh[0] + 1.4, 0], drink); paws.ff = lerp2(paws.ff, [sh[0] + 1.9, -0.1], drink); }
  if (ly > 0) { paws.nf = lerp2(paws.nf, T(2.3, 1.7), ly); paws.ff = lerp2(paws.ff, T(2.5, 1.5), ly); }
  if (groom > 0.01) {
    const rub = Math.sin(t * TAU * 2.8) * 0.4, f0 = HW(1.4, 0.6);
    paws.nf = lerp2(paws.nf, [f0[0] + rub * 0.3, f0[1] + rub], groom);
    paws.ff = lerp2(paws.ff, [f0[0] + 0.5 - rub * 0.3, f0[1] + 0.2 - rub], groom);
  }

  // ---- 그림자 ----
  if (p.shadow !== false) ell(g, F.cx - 0.3, 0, Math.max(2.0, (ly > 0.5 ? 4.0 : 4.3) - lift * 0.15), Math.max(0.6, 1.3 - lift * 0.04), 0, 'rgba(40,25,10,0.24)');

  // ---- 다리 계산 ----
  const hindLeg = (L, root) => {
    const heel = [L.toe[0] - LEG.F * Math.cos(L.psi), L.toe[1] - LEG.F * Math.sin(L.psi)];
    const { knee, end } = ik(root[0], root[1], heel[0], heel[1], LEG.a, LEG.b, 1);
    return { hip: root, knee, heel: end, toe: [end[0] + LEG.F * Math.cos(L.psi), Math.min(0, end[1] + LEG.F * Math.sin(L.psi))] };
  };
  const foreLeg = (paw, root) => { const { knee, end } = ik(root[0], root[1], paw[0], paw[1], LEG.ua, LEG.la, -1); return [root, knee, end]; };
  const hN = hindLeg(legs.nh, hip), hF = hindLeg(legs.fh, [hip[0] + 0.5, hip[1] - 0.2]);
  const fN = foreLeg(paws.nf, sh), fF = foreLeg(paws.ff, [sh[0] + 0.4, sh[1] - 0.2]);
  const drawHind = (L, near) => {
    bones(g, C, [L.knee, L.heel], [1.2, 0.72], near ? JB.col : far);
    bones(g, C, [L.heel, L.toe], [0.8, 0.72], near ? JB.foot : shade(JB.foot, 0.8));
    ell(g, L.toe[0] - 0.05, L.toe[1] - 0.22, 0.62, 0.4, Math.atan2(L.toe[1] - L.heel[1], L.toe[0] - L.heel[0]), near ? JB.toe : shade(JB.toe, 0.8)); // 발끝 털뭉치
  };
  const drawFore = (L, col) => { bones(g, C, L, [0.75, 0.55, 0.45], col); const [px, py] = L[2]; ell(g, px + 0.15, py, 0.42, 0.34, 0, col === JB.col ? JB.foot : col); };

  // ---- 꼬리: 마디 사슬. 앉으면 땅에 늘어지고 끝이 살짝 들리며, 뛸 땐 움직임 반대쪽으로 늦게 끌려와 물결친다 ----
  const tb = T(...TAILB);
  const tailPts = () => {
    const pts = [tb], seg = TLEN / TN;
    const trailAt = (k) => { // 움직임 반대쪽(뒤)으로 끌려가는 방향. k = 늦은 정도(위상)
      let vx, vy;
      if (hop) { const e = 0.02, uu = u - k, a0 = cyc(HOP, mod1(uu - e)), a1 = cyc(HOP, mod1(uu + e)); vx = STRIDE + (a1[0] - a0[0]) / (2 * e); vy = (a1[1] - a0[1]) / (2 * e); }
      else { vx = 1; vy = leapState(sp - k / LEAPS.length).vy * 2.4; }
      let ang = Math.atan2(vy, -vx); if (ang < 0) ang += TAU;
      return ang;
    };
    let aS = Math.PI - 0.55 + 0.4 * drink, aT = Math.PI + F.th * 0.6 + (hop ? 0.2 : 0), x = tb[0], y = tb[1];
    const sway = 0.04 * Math.sin(t * 1.1), curl = 0.36 + 0.08 * Math.sin(t * 0.7); // 끝을 위로 말아 술이 보이게(아이콘 안에 들도록)
    for (let i = 0; i < TN; i++) {
      aS += 0.06 + sway * (i / TN) + (i >= TN - 4 ? curl : 0);
      if (wTrail > 0) { const tgt = lerp(Math.PI - 0.1, trailAt((hop ? 0.035 : 0.022) * (i + 1)), hop ? 0.38 : 0.92); aT += (tgt - aT) * (hop ? 0.4 : 0.55); }
      const a = lerp(aS, aT, wTrail);
      x += Math.cos(a) * seg; y = Math.min(-0.22, y + Math.sin(a) * seg); pts.push([x, y]);
    }
    return pts;
  };
  // 웅크렸을 땐 몸 뒤에서 땅을 따라 앞으로 감아 와 술이 얼굴 앞에서 들린다
  const curlPts = () => {
    const pts = [T(-2.9, 1.0)], ctrl = [[-3.1, -0.55], [-1.5, -0.36], [0.5, -0.34], [2.3, -0.38], [3.4, -0.55], [4.1, -0.95], [4.4, -1.6]];
    for (const c of ctrl) pts.push([F.cx + c[0], c[1]]);
    return pts;
  };
  const drawTail = (pts, edge, ts = 1) => {
    const n = pts.length, ws = pts.map((_, i) => lerp(0.62, 0.3, i / (n - 1)));
    if (edge && real) bones(g, C, pts.slice(0, n - 2), ws.slice(0, n - 2).map((w) => w + 0.3), 'rgba(110,75,40,0.45)'); // 몸 앞을 지날 땐 테두리 그늘로 구분
    bones(g, C, pts.slice(0, n - 2), ws.slice(0, n - 2), JB.col);
    const [ax, ay] = pts[n - 3], [bx, by] = pts[n - 2], [cx2, cy2] = pts[n - 1], ang = Math.atan2(cy2 - by, cx2 - bx);
    bones(g, C, [[ax, ay], [bx, by], [cx2, cy2]], [0.45, 0.9 * ts, 1.0 * ts], JB.tuftK); // 검은 술
    ell(g, cx2 + Math.cos(ang) * 0.75 * ts, cy2 + Math.sin(ang) * 0.75 * ts, 1.0 * ts, 0.6 * ts, ang, JB.tuftW); // 흰 끝
  };
  const curled = ly > 0.5;

  // ---- 먼 쪽 다리·꼬리 ----
  drawHind(hF, false);
  bones(g, C, [hF.hip, hF.knee], [2.0, 1.2], far);
  drawFore(fF, far);
  if (!curled) drawTail(tailPts());

  // ---- 목 메움 + 몸통 ----
  const nk = T(1.6, -0.2);
  H.taper(g, nk[0], nk[1], hc[0] - 0.5, hc[1] + 0.5, 3.2, 2.6, JB.col);
  const by = 1 + 0.035 * breath * (1 - Math.min(1, lift));
  g.save(); g.translate(F.cx, F.cy); g.rotate(F.th); g.scale(F.kx, F.ky * by);
  g.fillStyle = C(JB.col); g.fill(BODY);
  if (real) {
    g.save(); g.clip(BODY);
    g.fillStyle = JB.belly; g.beginPath(); g.ellipse(1.2, 1.9, 3.0, 1.35, -0.3, 0, TAU); g.fill(); // 흰 배·가슴
    g.fillStyle = 'rgba(90,60,30,0.14)'; g.beginPath(); g.ellipse(-1.0, 2.3, 3.4, 0.9, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,248,230,0.35)'; g.beginPath(); g.ellipse(-0.6, -1.9, 2.2, 0.5, 0.15, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }
  g.restore();

  // ---- 가까운 쪽 뒷다리(큰 허벅지가 정강이 위를 덮는다)·앞다리 ----
  drawHind(hN, true);
  const tang = Math.atan2(hN.knee[1] - hN.hip[1], hN.knee[0] - hN.hip[0]);
  const tcx = (hN.hip[0] + hN.knee[0]) / 2 - Math.cos(tang) * 0.3, tcy = (hN.hip[1] + hN.knee[1]) / 2 - Math.sin(tang) * 0.3;
  ell(g, tcx, tcy, 1.85, 1.5, tang, JB.col);
  if (real) { g.strokeStyle = 'rgba(110,75,40,0.3)'; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath(); g.ellipse(tcx, tcy, 1.6, 1.25, tang, -0.3, 1.9); g.stroke(); }
  const front = groom > 0.3 || eat > 0.3;
  if (!front) drawFore(fN, JB.col);

  // ---- 머리·귀 ----
  const earSp = spring('earS', earT, 60, 6);
  const swivel = dt > 0 ? 0.18 * Math.sin(t * 0.9 + 1) * Math.sin(t * 0.37) : 0;
  const earNear = earSp + r.ear.x * 0.4 + swivel, earFar = earSp + 0.22 - swivel * 0.7;
  const ear = (x, y, ang, len, col, inner) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = C(col); g.beginPath();
    g.moveTo(-0.75, 0.3); g.bezierCurveTo(-1.6, -len * 0.45, -1.3, -len, 0.05, -len);
    g.bezierCurveTo(1.35, -len, 1.5, -len * 0.45, 0.75, 0.3); g.closePath(); g.fill();
    if (inner && real) { g.fillStyle = JB.earIn; g.beginPath(); g.moveTo(-0.25, -0.3); g.bezierCurveTo(-1.0, -len * 0.45, -0.75, -len * 0.88, 0.05, -len * 0.9); g.bezierCurveTo(0.85, -len * 0.88, 0.95, -len * 0.45, 0.35, -0.3); g.closePath(); g.fill(); }
    g.restore();
  };
  const nib = eat > 0.3 ? Math.sin(t * TAU * 3.4) : 0;
  g.save(); g.translate(hc[0], hc[1]); g.rotate(ha + nib * 0.03);
  ear(0.15, -1.55, earFar, 3.4, shade(JB.col, 0.86), false);
  g.fillStyle = C(JB.col); g.fill(HEAD);
  if (real) {
    g.save(); g.clip(HEAD);
    g.fillStyle = JB.belly; g.beginPath(); g.ellipse(1.6, 1.25, 1.7, 0.75, -0.15, 0, TAU); g.fill(); // 흰 뺨·턱
    g.fillStyle = 'rgba(90,60,30,0.12)'; g.beginPath(); g.ellipse(-0.6, 1.5, 1.8, 0.6, 0, 0, TAU); g.fill();
    g.restore();
    ell(g, 0.75, -0.35, 1.0, 0.95, 0, JB.ring); // 눈 둘레 밝은 털
  }
  if (closed) { g.strokeStyle = C(JB.lid); g.lineWidth = 0.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0.1, -0.35); g.quadraticCurveTo(0.78, 0.05, 1.45, -0.35); g.stroke(); }
  else eye(g, 0.78, -0.35, 0.78, false);
  const tw = (sniff > 0 ? Math.sin(t * TAU * 7) * 0.12 * Math.min(1, sniff) : 0) + nib * 0.1;
  ell(g, 2.6, 0.25 + tw, 0.3, 0.26, 0, JB.nose);
  if (real) {
    g.strokeStyle = 'rgba(70,50,35,0.45)'; g.lineWidth = 0.1; g.lineCap = 'round'; g.beginPath();
    if (ly < 0.5) for (const [a, l] of [[-0.25, 2.1], [0.05, 2.3], [0.35, 1.9]]) { const aa = a + tw * 0.8; g.moveTo(2.1, 0.55); g.lineTo(2.1 + Math.cos(aa) * l, 0.55 + Math.sin(aa) * l); } // 수염
    g.stroke();
    g.strokeStyle = 'rgba(80,50,35,0.55)'; g.lineWidth = 0.14; g.beginPath(); g.moveTo(2.45, 0.6 + tw); g.quadraticCurveTo(2.3, 1.0, 1.85, 1.05 + nib * 0.15); g.stroke(); // 입
    if (drink > 0.5 && Math.sin(t * TAU * 2.6) > 0.2) ell(g, 2.6, 1.0, 0.25, 0.4, 0, '#e07a80'); // 할짝
  }
  ear(-0.5, -1.4, earNear, 3.6, JB.col, true);
  g.restore();
  if (curled) drawTail(curlPts(), true, 0.8); // 웅크리면 꼬리가 몸 앞을 둘러 얼굴 앞까지
  if (front) { // 세수·먹을 땐 앞발이 얼굴 앞에. 먹을 땐 두 앞발 사이에 씨앗
    drawFore(fN, JB.col);
    if (eat > 0.3) {
      const [px, py] = fN[2];
      ell(g, px + 0.3, py - 0.4, 0.7, 0.5, 0.4, JB.seed);
      if (real) ell(g, px + 0.12, py - 0.58, 0.28, 0.16, 0.4, JB.seedHi);
      drawFore(fF, shade(JB.col, 0.93));
    }
  }
}
