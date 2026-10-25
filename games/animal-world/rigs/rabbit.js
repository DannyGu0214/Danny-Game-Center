// 토끼 리그: 걷지 않고 깡충 뛴다(한 번 뛰는 거리 = STRIDE). 앉아 있기·풀 뜯기·물·식빵 자세(눕기)·빙키(공중 비틀기, 특수 행동).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 7.5; // 한 번 뛸 때 나아가는 거리(그림 단위)
export const BOX = [8, 17];
const TAU = Math.PI * 2;
const RB = { col: '#c9a27e', belly: '#efe2cc', ear: '#e8a9a4', nose: '#d9827c', ring: '#f1e6d4', foot: '#e4d2b6' };
const HIP = [-3.4, 0.7], SH = [3.3, 1.1], NECK = [4.4, -2.2]; // 몸 좌표(몸 중심 기준, 기울이기·늘이기 전)
const LEG = { a: 3.3, b: 3.7, F: 4.6, fa: 3.0, fb: 3.0 }; // 허벅지·정강이·뒷발, 앞다리 위·아래

// 한 번 뛰기(위상 0~1): [위상, 몸 x, 높이, 기울기(+면 코가 아래), 늘이기]
// 0 웅크려 밀기 → 0.24 뒷발 떼기(쭉 늘어남) → 0.44 앞발 착지 → 0.68 뒷발이 앞발 근처로 착지(모으기) → 웅크림
const HOP = [
  [0.00, -0.5, 0.5, -0.08, -0.12],
  [0.12, 0.3, 1.9, -0.26, 0.06],
  [0.24, 1.1, 3.4, -0.16, 0.22],
  [0.34, 1.2, 3.6, 0.04, 0.2],
  [0.44, 0.8, 2.0, 0.26, 0.08],
  [0.56, 0.2, 1.5, 0.2, -0.08],
  [0.68, -0.4, 0.8, 0.06, -0.16],
  [0.84, -0.7, 0.3, -0.02, -0.15],
];
const H_LAND = 0.68, H_OFF = 0.24, F_LAND = 0.44, F_OFF = 0.8, XH = 1.0, XF = 4.9; // 발 디딤 구간과 디딜 자리
const BASE_Y = -5.4;

// 순환 Catmull-Rom 보간(키프레임 사이를 매끄럽게)
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
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
// 몸 좌표 → 그림 좌표
function frame(cx, cy, th, st, sq) {
  const ca = Math.cos(th), sa = Math.sin(th), kx = (1 + st) * sq, ky = 1 / (1 + st);
  return { cx, cy, th, kx, ky, T: (x, y) => [cx + ca * x * kx - sa * y * ky, cy + sa * x * kx + ca * y * ky] };
}
const hopFrame = (u) => { const [bx, lift, th, st] = cyc(HOP, ((u % 1) + 1) % 1); return frame(bx, BASE_Y - lift, th, st, 1); };
// 굵기가 줄어드는 마디들 + 둥근 관절을 한 번에 채운다(감는 방향을 맞춰 겹쳐도 구멍이 안 난다)
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
  BODY = new Path2D(); // 몸 좌표: 엉덩이(뒤, 크고 둥글다) → 등 → 어깨 → 가슴 → 배
  BODY.moveTo(-6.8, -1.6);
  BODY.quadraticCurveTo(-5.8, -5.0, -1.4, -5.0);
  BODY.quadraticCurveTo(2.6, -5.0, 4.6, -2.8);
  BODY.quadraticCurveTo(6.4, -0.6, 5.6, 2.0);
  BODY.quadraticCurveTo(4.6, 4.2, 1.4, 4.0);
  BODY.quadraticCurveTo(-2.2, 4.3, -4.4, 4.6);
  BODY.quadraticCurveTo(-7.7, 4.4, -7.7, 1.2);
  BODY.quadraticCurveTo(-7.6, -0.4, -6.8, -1.6);
  BODY.closePath();
  HEAD = new Path2D(); // 머리 좌표(머리 중심 기준, 오른쪽이 코)
  HEAD.moveTo(-3.2, 0.7);
  HEAD.quadraticCurveTo(-3.3, -3.0, 0.2, -3.1);
  HEAD.quadraticCurveTo(3.0, -3.1, 4.3, -0.5);
  HEAD.quadraticCurveTo(5.0, 1.0, 4.0, 2.1);
  HEAD.quadraticCurveTo(2.7, 3.3, 0.4, 3.1);
  HEAD.quadraticCurveTo(-2.6, 3.1, -3.2, 0.7);
  HEAD.closePath();
}

export function draw(g, p, H) {
  const { ik, springTo, rigTick, ell, eye, C, shade } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, ly = p.ly ?? 0, sp = p.sp ?? -1, real = H.real();
  const binky = sp >= 0, hop = !binky && p.mv > 0, u = hop ? (((p.gait ?? 0) % 1) + 1) % 1 : 0;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  const breath = Math.sin(t * TAU / 2.1);
  const far = shade(RB.col, 0.8), dark = shade(RB.col, 0.86);

  // ---- 자세: 몸 위치·기울기·늘이기, 네 발 목표, 머리 ----
  let F, legs, headOff, ha, earT, lift = 0, closed = false, groom = 0, sniff = 0, kick = 0, twist = 0;
  const hind = (toe, psi) => ({ toe, psi }), fore = (paw) => ({ paw });
  if (hop) {
    F = hopFrame(u);
    lift = BASE_Y - F.cy;
    // 뒷발: 디딤(H_LAND → H_OFF) 동안 땅에 붙어 몸이 간 만큼 뒤로, 그 뒤는 뒤로 쭉 뻗었다가 앞으로 모은다
    const hindAt = (uu, dx) => {
      const D = 1 - H_LAND + H_OFF, q = (((uu - H_LAND) % 1) + 1) % 1;
      if (q <= D) { const k = q / D; return hind([XH + dx - q * STRIDE, 0], 1.3 * ss((k - 0.5) / 0.5)); }
      const w = (q - D) / (1 - D), cur = hopFrame(uu).T(...HIP), h0 = hopFrame(H_OFF).T(...HIP), h1 = hopFrame(H_LAND).T(...HIP);
      const rel0 = [XH + dx - D * STRIDE - h0[0], -h0[1]], rel1 = [XH + dx - h1[0], -h1[1]], trail = [-5.4, 4.2];
      let rel, psi;
      if (w < 0.4) { const k = ss(w / 0.4); rel = lerp2(rel0, trail, k); psi = lerp(1.3, 2.3, k); }
      else { const k = ss((w - 0.4) / 0.6); rel = lerp2(trail, rel1, k); rel[1] -= 1.6 * Math.sin(Math.PI * (w - 0.4) / 0.6); psi = lerp(2.3, 0, k); }
      return hind([cur[0] + rel[0], Math.min(0, cur[1] + rel[1])], psi);
    };
    // 앞발: 디딤(F_LAND → F_OFF), 떼면 가슴 밑으로 접었다가 앞으로 뻗어 먼저 착지
    const foreAt = (uu, dx) => {
      const D = F_OFF - F_LAND, q = (((uu - F_LAND) % 1) + 1) % 1;
      if (q <= D) return fore([XF + dx - q * STRIDE, 0]);
      const w = (q - D) / (1 - D), s0 = hopFrame(F_OFF).T(...SH), s1 = hopFrame(F_LAND).T(...SH), cur = hopFrame(uu).T(...SH);
      const rel0 = [XF + dx - D * STRIDE - s0[0], -s0[1]], rel1 = [XF + dx - s1[0], -s1[1]], tuck = [1.0, 3.0];
      const rel = w < 0.5 ? lerp2(rel0, tuck, ss(w / 0.5)) : lerp2(tuck, rel1, ss((w - 0.5) / 0.5));
      return fore([cur[0] + rel[0], Math.min(0, cur[1] + rel[1])]);
    };
    legs = { nh: hindAt(u, 0), fh: hindAt(u + 0.03, 0.7), nf: foreAt(u, 0), ff: foreAt(u + 0.06, 0.8) };
    headOff = [1.8, -2.4]; ha = F.th * 0.45;
    earT = -0.38 - 0.9 * Math.max(0, F.kx - 1) + 0.6 * Math.max(0, F.th);
  } else {
    // 앉은 자세 ↔ 식빵(눕기) ↔ 고개 숙이기(먹기·물)
    let cx = lerp(-0.3, 0.1, ly), cy = lerp(-5.5, -4.2, ly), th = lerp(-0.17, 0.02, ly), st = lerp(-0.05, 0.08, ly), sq = 1;
    cx = lerp(cx, -0.5, hd); cy = lerp(cy, -5.2, hd); th = lerp(th, 0.1, hd); st = lerp(st, 0, hd);
    const f = binky ? (sp * 2) % 1 : 0, fl = clamp01((f - 0.34) / 0.42), air = binky && f >= 0.34 && f < 0.76;
    if (!binky) {
      // 가끔 앞발로 얼굴 닦기(그루밍), 코 킁킁
      const gc = (t % 13) / 13;
      groom = ss((gc - 0.74) / 0.04) * ss((0.96 - gc) / 0.04) * (1 - hd) * (1 - ly);
      th -= 0.14 * groom; cy -= 0.4 * groom;
      sniff = Math.max(0, Math.sin(t * 0.9) * 1.6 - 0.4);
    } else {
      // 빙키: 웅크렸다 높이 뛰어 공중에서 몸을 비틀고 뒷발을 찬다(한 번 특수 행동에 두 번)
      const crouch = ss((f - 0.12) / 0.13) * (1 - ss((f - 0.27) / 0.07));
      lift = f < 0.34 ? ss((f - 0.25) / 0.09) * 2.2 : air ? 2.2 * (1 - fl) + 5.4 * Math.sin(Math.PI * fl) : 0;
      const land = f >= 0.76 ? Math.sin(Math.PI * clamp01((f - 0.76) / 0.16)) : 0;
      twist = air ? Math.sin(Math.PI * fl) : 0;
      kick = twist * twist;
      cy = -5.5 + crouch * 0.9 + land * 0.8 - lift; cx = -0.2;
      th = -0.17 + crouch * 0.2 - ss((f - 0.27) / 0.08) * (1 - ss((f - 0.4) / 0.1)) * 0.25 - (air ? 0.32 * Math.sin(TAU * fl) : 0) + land * 0.15;
      st = -0.05 - crouch * 0.14 + (f > 0.27 && f < 0.76 ? 0.16 * (1 - Math.abs(fl * 2 - 1)) : 0) - land * 0.16;
      sq = 1 - 0.3 * twist * Math.abs(Math.sin(Math.PI * fl * 2));
    }
    F = frame(cx, cy, th, st, sq);
    const hip = F.T(...HIP), sh = F.T(...SH);
    if (air) {
      // 공중: 뒷발은 밑으로 모았다가 뒤로 휙 찬다, 앞발은 가슴에 접었다가 착지 전에 뻗는다
      const base = fl < 0.5 ? lerp2([4.6, 7.0], [2.0, 5.0], ss(fl / 0.25)) : lerp2([2.0, 5.0], [4.6, 5.4], ss((fl - 0.6) / 0.4));
      const rel = lerp2(base, [-6.2, 0.6], kick);
      let psi = lerp(lerp(1.2, 0.5, ss(fl / 0.25)), 2.6, kick);
      if (fl > 0.6) psi = lerp(psi, 0.1, ss((fl - 0.6) / 0.4));
      const toe = [hip[0] + rel[0], Math.min(0, hip[1] + rel[1])], reach = ss((fl - 0.7) / 0.3);
      legs = {
        nh: hind(toe, psi), fh: hind([toe[0] + 0.8, toe[1] - 0.6 * kick], psi - 0.1),
        nf: fore([sh[0] + 1.1, Math.min(0, sh[1] + lerp(3.0, 5.4, reach))]), ff: fore([sh[0] + 1.8, Math.min(0, sh[1] + lerp(2.8, 5.4, reach))]),
      };
    } else {
      const push = binky ? ss((f - 0.27) / 0.07) * (f < 0.5 ? 1 : 0) : 0;
      const tx = hip[0] + lerp(4.9, 4.4, ly);
      legs = {
        nh: hind([tx, 0], push * 1.2), fh: hind([tx + 0.7, 0], push * 1.2),
        nf: fore(ly > 0.5 ? [sh[0] + 1.6, -0.3] : [sh[0] + 0.4 + hd * 0.5, 0]), ff: fore(ly > 0.5 ? [sh[0] + 2.3, -0.3] : [sh[0] + 1.2 + hd * 0.5, 0]),
      };
    }
    if (groom > 0.01) { // 앞발을 얼굴로
      const rub = Math.sin(t * TAU * 2.6) * 0.7;
      legs.nf = fore(lerp2(legs.nf.paw, [sh[0] + 3.0 + rub * 0.4, sh[1] - 2.4 + rub], groom));
      legs.ff = fore(lerp2(legs.ff.paw, [sh[0] + 3.6 - rub * 0.4, sh[1] - 2.0 - rub], groom));
    }
    headOff = lerp2(lerp2([1.6, -2.7], [1.6, -1.2], ly), [4.4, 3.4], hd);
    headOff[1] += groom * 1.0;
    ha = lerp(lerp(-0.06, 0.1, ly), 0.9, hd) + 0.5 * groom - 0.35 * Math.sin(TAU * fl) * twist;
    if (!binky && hd < 0.5 && ly < 0.5) ha += 0.07 * Math.sin(r.look * 0.5) * Math.sin(r.look * 0.21);
    earT = lerp(lerp(-0.32, -1.28, ly), -0.75, hd) - (binky ? 0.75 * clamp01(lift / 3) : 0) - 0.3 * groom;
    closed = ly > 0.6;
  }
  closed = closed || r.blink > 0;
  const { T } = F, hip = T(...HIP), sh = T(...SH);

  // ---- 그림자 ----
  if (p.shadow !== false) ell(g, F.cx, 0, Math.max(3.5, 7.4 - lift * 0.45), 2.1, 0, 'rgba(40,25,10,0.24)');

  // ---- 다리 계산 ----
  const hindLeg = (L, root) => {
    const heel = [L.toe[0] - LEG.F * Math.cos(L.psi), L.toe[1] - LEG.F * Math.sin(L.psi)];
    const { knee, end } = ik(root[0], root[1], heel[0], heel[1], LEG.a, LEG.b, 1);
    return { hip: root, knee, heel: end, toe: [end[0] + LEG.F * Math.cos(L.psi), Math.min(0, end[1] + LEG.F * Math.sin(L.psi))] };
  };
  const foreLeg = (L, root) => { const { knee, end } = ik(root[0], root[1], L.paw[0], L.paw[1], LEG.fa, LEG.fb, -1); return [root, knee, end]; };
  const hN = hindLeg(legs.nh, hip), hF = hindLeg(legs.fh, [hip[0] + 0.6, hip[1] - 0.2]);
  const fN = foreLeg(legs.nf, sh), fF = foreLeg(legs.ff, [sh[0] + 0.7, sh[1] - 0.2]);
  const drawHind = (L, col, near) => {
    bones(g, C, [L.knee, L.heel], [2.6, 1.7], col);
    bones(g, C, [L.heel, L.toe], [2.0, 1.7], col);
    if (near && real) ell(g, L.toe[0] - 0.2, L.toe[1] - 0.15, 1.1, 0.75, Math.atan2(L.toe[1] - L.heel[1], L.toe[0] - L.heel[0]), RB.foot);
  };
  const drawFore = (L, col, near) => {
    bones(g, C, L, [2.1, 1.7, 1.45], col);
    const [px, py] = L[2];
    ell(g, px + 0.5, py - 0.35, 1.1, 0.7, 0, near ? RB.foot : col);
  };

  // ---- 먼 쪽 다리 ----
  drawHind(hF, far, false);
  bones(g, C, [hF.hip, hF.knee], [4.6, 3.4], far);
  drawFore(fF, far, false);

  // ---- 목 메움 + 몸통 ----
  const nb = T(...NECK), nf = T(3.6, -0.4), c5 = Math.cos(F.th * 0.5), s5 = Math.sin(F.th * 0.5);
  const hc = hop ? [nb[0] + headOff[0], nb[1] + headOff[1]] : [nb[0] + c5 * headOff[0] - s5 * headOff[1], nb[1] + s5 * headOff[0] + c5 * headOff[1]];
  H.taper(g, nf[0], nf[1], hc[0] - 0.6, hc[1] + 0.8, 5.6, 4.4, RB.col);
  const by = 1 + 0.03 * breath * (1 - Math.min(1, lift));
  g.save(); g.translate(F.cx, F.cy); g.rotate(F.th); g.scale(F.kx, F.ky * by);
  g.fillStyle = C(RB.col); g.fill(BODY);
  if (real) {
    g.save(); g.clip(BODY);
    g.fillStyle = RB.belly; g.beginPath(); g.ellipse(3.4, 3.4, 4.2, 2.5, -0.35, 0, TAU); g.fill(); // 가슴·배 흰 털
    g.fillStyle = 'rgba(80,50,25,0.16)'; g.beginPath(); g.ellipse(-0.5, 4.8, 8.5, 2.2, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(-0.8, -4.4, 4.6, 1.05, 0.04, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }
  g.restore();
  // 솜뭉치 꼬리: 가끔 씰룩, 뛸 때는 위로 들린다
  const tw = Math.max(0, Math.sin(t * 2.3)) ** 6 * Math.sin(t * TAU * 4) * 0.35;
  const tl = T(-7.3, -1.3 - (hop ? 0.6 : 0) + tw);
  ell(g, tl[0], tl[1], 1.9, 1.75, 0, '#fbf7ef');
  if (real) ell(g, tl[0] + 0.5, tl[1] + 0.6, 1.1, 0.9, 0, 'rgba(120,100,80,0.18)');

  // ---- 가까운 쪽 뒷다리(엉덩이 큰 허벅지가 정강이 위를 덮는다)·앞다리 ----
  drawHind(hN, RB.col, true);
  const tang = Math.atan2(hN.knee[1] - hN.hip[1], hN.knee[0] - hN.hip[0]);
  const tcx = (hN.hip[0] + hN.knee[0]) / 2 - Math.cos(tang) * 0.4, tcy = (hN.hip[1] + hN.knee[1]) / 2 - Math.sin(tang) * 0.4;
  ell(g, tcx, tcy, 3.9, 3.3, tang, RB.col);
  if (real) {
    g.strokeStyle = 'rgba(90,60,30,0.28)'; g.lineWidth = 0.55; g.lineCap = 'round';
    g.beginPath(); g.ellipse(tcx, tcy, 3.6, 3.0, tang, -0.2, 1.9); g.stroke();
  }
  if (groom <= 0.3) drawFore(fN, RB.col, true);

  // ---- 머리·귀 ----
  const earSp = spring('earS', earT, 70, 6.5);
  const swivel = 0.1 * Math.sin(t * 0.83) * Math.sin(t * 0.31);
  const earNear = earSp + r.ear.x * 0.5, earFar = earSp + 0.16 + swivel;
  const ear = (x, y, ang, len, col, inner) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = C(col); g.beginPath();
    g.moveTo(-0.9, 0.5); g.bezierCurveTo(-2.0, -len * 0.4, -1.5, -len * 0.96, 0.1, -len);
    g.bezierCurveTo(1.6, -len * 0.95, 1.7, -len * 0.4, 0.9, 0.5); g.closePath(); g.fill();
    if (inner && real) { g.fillStyle = RB.ear; g.beginPath(); g.moveTo(-0.2, -0.6); g.bezierCurveTo(-1.0, -len * 0.42, -0.7, -len * 0.86, 0.15, -len * 0.88); g.bezierCurveTo(1.0, -len * 0.84, 0.9, -len * 0.4, 0.5, -0.6); g.closePath(); g.fill(); }
    g.restore();
  };
  const nib = p.st === 'eat' ? Math.sin(t * TAU * 3.2) : 0; // 오물오물
  g.save(); g.translate(hc[0], hc[1] + nib * 0.15 * hd); g.rotate(ha);
  ear(0.2, -2.7, earFar, 8.2, dark, false);
  g.fillStyle = C(RB.col); g.fill(HEAD);
  if (real) {
    g.save(); g.clip(HEAD);
    g.fillStyle = RB.belly; g.beginPath(); g.ellipse(3.2, 1.9, 2.1, 1.5, 0.2, 0, TAU); g.fill(); // 주둥이
    g.fillStyle = 'rgba(80,50,25,0.14)'; g.beginPath(); g.ellipse(-0.4, 3.4, 4.2, 1.3, 0, 0, TAU); g.fill();
    g.restore();
    ell(g, 1.1, -0.85, 1.45, 1.35, 0, RB.ring);
  }
  eye(g, 1.15, -0.85, 1.05, closed);
  // 코 씰룩(가끔 빠르게 킁킁), 먹을 때는 오물오물
  const tw2 = (sniff > 0 ? Math.sin(t * TAU * 6) * 0.22 * Math.min(1, sniff) : 0) + nib * 0.18;
  ell(g, 4.45, 0.15 + tw2, 0.62, 0.5, 0.3, RB.nose);
  if (real) {
    g.strokeStyle = 'rgba(70,45,30,0.55)'; g.lineWidth = 0.35; g.lineCap = 'round';
    g.beginPath(); g.moveTo(4.2, 0.7 + tw2); g.quadraticCurveTo(4.1, 1.6, 3.4, 1.9 + nib * 0.2); g.stroke(); // 입
    if (p.st === 'drink' && hd > 0.5 && Math.sin(t * TAU * 2.5) > 0.2) ell(g, 4.4, 2.6, 0.5, 0.7, 0, '#e07a80'); // 홀짝
  }
  ear(-0.9, -2.5, earNear, 8.6, RB.col, true);
  g.restore();
  if (groom > 0.3) drawFore(fN, RB.col, true); // 얼굴 닦을 땐 앞발이 얼굴 앞에
}
