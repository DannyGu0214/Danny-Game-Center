// 바다거북(푸른바다거북) 리그: 낮고 둥근 갈색-올리브 등딱지(비늘판 무늬), 긴 앞지느러미·짧은 뒷지느러미, 부리 같은 주둥이, 비늘 무늬 피부.
// 걷기(땅에서는 두 앞지느러미를 함께 짚어 몸을 앞으로 끌어당긴다: 짚는 동안 지느러미 끝은 땅에 붙고 몸이 울컥 나아간다)
// 쉬기(느린 눈 깜빡임·고개 까딱·숨쉬기)·먹기/물(목을 길게 빼 땅까지)·눕기(머리·지느러미를 조금 당기고 눈 감기)·특수 행동(앞지느러미로 번갈아 모래 파 뒤로 튀기기).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 6; // 한 번 끌어당길 때(주기) 몸이 나아가는 거리
export const BOX = [13, 10];
const TAU = Math.PI * 2;
const D = 0.55; // 주기 중 앞지느러미가 땅을 짚고 미는 비율
const TT = {
  shell: '#5f5230', plate: '#85773f', plate2: '#9d8f4c', seam: '#43391f', rim: '#776a37', plast: '#e2d49c',
  skin: '#7d7a4a', skinFar: '#626038', skinD: '#5a5530', scale: '#e8dfb4', belly: '#e4d9a8', beak: '#4a4128', sand: '#e8d29a', sand2: '#f4e6bd',
};
const SHO = [6.0, -2.3], REAR = [-8.0, -1.5], NECK = [8.8, -3.0]; // 몸 좌표: 앞지느러미 뿌리, 뒷지느러미 뿌리, 목 뿌리

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const qpt = (a, c, b, t) => { const m = 1 - t; return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]]; };

let SHELL = null, SEAMS = null, PLATES = null, MARG = null;
function paths() {
  if (SHELL) return;
  SHELL = new Path2D(); // 등딱지(몸 좌표, 원점은 배딱지 가운데 아래): 앞은 가파르고 뒤는 완만한 낮은 돔
  SHELL.moveTo(10.2, -1.8);
  SHELL.bezierCurveTo(9.4, -6.3, 3.2, -7.9, -1.4, -7.7);
  SHELL.bezierCurveTo(-6.6, -7.4, -10.4, -4.6, -12.0, -1.0);
  SHELL.quadraticCurveTo(-10.8, -0.5, -9.8, -0.8);
  SHELL.quadraticCurveTo(0, -0.3, 9.6, -1.0);
  SHELL.quadraticCurveTo(10.4, -1.1, 10.2, -1.8);
  SHELL.closePath();
  // 비늘판 이음선: 척추판/늑판 경계(A), 늑판/가장자리판 경계(B), 늑판 칸막이 3, 척추판 칸막이 4, 가장자리판 칸막이
  const A0 = [9.1, -4.5], A1 = [0.8, -8.7], A2 = [-10.1, -3.6], B0 = [10.0, -2.6], B1 = [0, -1.7], B2 = [-11.2, -2.3];
  SEAMS = new Path2D(); PLATES = new Path2D(); MARG = new Path2D();
  SEAMS.moveTo(...A0); SEAMS.quadraticCurveTo(...A1, ...A2);
  SEAMS.moveTo(...B0); SEAMS.quadraticCurveTo(...B1, ...B2);
  const at = [0.08, 0.3, 0.53, 0.76, 0.98], bt = [0.03, 0.27, 0.51, 0.75, 0.99];
  for (let i = 1; i <= 3; i++) { SEAMS.moveTo(...qpt(A0, A1, A2, at[i])); SEAMS.lineTo(...qpt(B0, B1, B2, bt[i])); }
  for (const tv of [0.14, 0.38, 0.62, 0.86]) { const p = qpt(A0, A1, A2, tv); SEAMS.moveTo(...p); SEAMS.lineTo(p[0] + 0.3, p[1] - 3); }
  for (let i = 1; i < 11; i++) { const p = qpt(B0, B1, B2, i / 11); SEAMS.moveTo(...p); SEAMS.lineTo(p[0] + 0.15, p[1] + 2.2); }
  // 늑판 가운데 밝은 무늬(햇살처럼 퍼진 결) + 척추판 무늬
  for (let i = 0; i < 4; i++) {
    const a = qpt(A0, A1, A2, (at[i] + at[i + 1]) / 2), b = qpt(B0, B1, B2, (bt[i] + bt[i + 1]) / 2), c = [(a[0] * 0.55 + b[0] * 0.45), (a[1] * 0.55 + b[1] * 0.45)];
    PLATES.moveTo(c[0] + 1.9, c[1]); PLATES.ellipse(c[0], c[1], 1.9, 1.1, -0.1, 0, TAU);
  }
  for (const tv of [0.26, 0.5, 0.74]) { const p = qpt(A0, A1, A2, tv); PLATES.moveTo(p[0] + 1.3, p[1] - 0.8); PLATES.ellipse(p[0], p[1] - 0.8, 1.3, 0.45, 0, 0, TAU); }
  MARG.moveTo(...B0); MARG.quadraticCurveTo(...B1, ...B2); MARG.lineTo(-11, 1); MARG.lineTo(11, 1); MARG.closePath();
}
// 지느러미 날: 뿌리 R에서 끝 P까지, 앞가장자리(-n 쪽)가 볼록, 끝은 둥글고 뾰족
function blade(g, C, R, P, w, col) {
  const dx = P[0] - R[0], dy = P[1] - R[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  g.fillStyle = C(col); g.beginPath();
  g.moveTo(R[0] - nx * w * 0.42, R[1] - ny * w * 0.42);
  g.quadraticCurveTo(R[0] + dx * 0.5 - nx * w * 0.75, R[1] + dy * 0.5 - ny * w * 0.75, P[0] - nx * w * 0.06 + ux * 0.2, P[1] - ny * w * 0.06 + uy * 0.2);
  g.quadraticCurveTo(P[0] + nx * w * 0.2, P[1] + ny * w * 0.2, R[0] + dx * 0.7 + nx * w * 0.4, R[1] + dy * 0.7 + ny * w * 0.4);
  g.quadraticCurveTo(R[0] + dx * 0.3 + nx * w * 0.5, R[1] + dy * 0.3 + ny * w * 0.5, R[0] + nx * w * 0.42, R[1] + ny * w * 0.42);
  g.closePath(); g.fill();
  return { ux, uy, nx, ny, l };
}

export function draw(g, p, H) {
  const { ik, springTo, rigTick, ell, eye, C, taper } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const dig = sp >= 0, moving = p.mv > 0 && !dig, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  // 바닷가 동물은 게임에서 ly를 받지 못하므로 상태로 직접 쉰다(아이콘처럼 dt가 없으면 바로)
  const restT = p.st === 'rest' ? 1 : 0, ly = Math.max(p.ly ?? 0, dt > 0 ? clamp01(spring('rest', restT, 20, 9)) : restT);
  const eat = p.st === 'eat' ? hd * (1 - ly) : 0, drink = p.st === 'drink' ? hd * (1 - ly) : 0, down = Math.max(eat, drink);
  const breath = Math.sin(t * TAU / 4.2);
  const dc = dig ? ss(sp / 0.06) * ss((1 - sp) / 0.06) : 0, w = sp * TAU * 5.5; // 파기: 앞지느러미 번갈아 5.5번씩

  // ---- 몸 위치: 짚는 동안 울컥 나아가고(앞이 들린다) 거두는 동안은 멈춘다 ----
  let bx = 0, by = -0.35, th = 0, push = 0;
  if (moving) {
    const prog = u < D ? ss(u / D) : 1;
    bx = STRIDE * (prog - u) - STRIDE * (1 - D) / 2;
    push = u < D ? Math.sin(Math.PI * u / D) : 0;
    by -= 0.8 * push; th = -0.06 * push;
  }
  if (!moving && !dig) by -= 0.12 * (1 + breath) * (1 - ly);
  by += ly * 0.25; th += down * 0.03;
  if (dc > 0) { th += dc * 0.05 * Math.sin(w); by -= dc * 0.4 * Math.abs(Math.sin(w)); }
  const ca = Math.cos(th), sa = Math.sin(th), T = (x, y) => [bx + ca * x - sa * y, by + sa * x + ca * y];

  // ---- 앞지느러미 끝 위치(땅 기준) ----
  const sh = T(...SHO), shF = T(SHO[0] + 0.9, SHO[1] - 0.5);
  const foreTip = (side) => { // side 0 = 가까운 쪽, 1 = 먼 쪽
    const base = side ? 0.9 : 0;
    if (moving) {
      if (u < D) return [sh[0] + base + 7.5 - STRIDE * ss(u / D), 0]; // 짚기: 땅에 붙은 끝을 몸이 지나간다
      const k = (u - D) / (1 - D);
      return [sh[0] + base + 7.5 - STRIDE * (1 - k) * (1 - k), -3.8 * Math.sin(Math.PI * k)]; // 거두기: 들어 올려 앞으로 크게 뻗는다
    }
    let tip = [sh[0] + base + 6.2, -0.05];
    if (ly > 0) tip = [lerp(tip[0], sh[0] + base + 4.4, ly), lerp(tip[1], -0.1, ly)];
    if (dc > 0) { // 모래 파기: 앞에서 땅을 긁어 뒤로 휙, 공중으로 돌아온다
      const c = ((w / TAU + (side ? 0.5 : 0)) % 1 + 1) % 1;
      let d;
      if (c < 0.45) { const k = ss(c / 0.45); d = [sh[0] + base + 6.8 - 9.6 * k, -0.05 - 0.3 * k * k]; }
      else if (c < 0.6) { const k = Math.sin(((c - 0.45) / 0.15) * Math.PI / 2); d = [sh[0] + base - 2.8 - 3.4 * k, -0.35 - 2.6 * k]; }
      else { const k = ss((c - 0.6) / 0.4); d = [lerp(sh[0] + base - 6.2, sh[0] + base + 6.8, k), lerp(-2.95, -0.05, k) - 3.0 * Math.sin(k * Math.PI)]; }
      tip = [lerp(tip[0], d[0], dc), lerp(tip[1], d[1], dc)];
    }
    return tip;
  };
  // 앞지느러미는 어깨에서 끝까지 한 장의 노. 옆으로 벌릴수록(끝이 어깨 가까이) 짧고 넓게 보인다(원근)
  const FN = [sh, foreTip(0)], FF = [shF, foreTip(1)];
  const drawFore = (L, col, near) => {
    const [rt, tp] = L, d = Math.hypot(tp[0] - rt[0], tp[1] - rt[1]), wd = Math.max(3.0, Math.min(4.6, 3.0 + (7.2 - d) * 0.35));
    const b = blade(g, C, rt, tp, wd, col);
    if (real && near) {
      g.strokeStyle = TT.scale; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath();
      for (const f of [0.38, 0.58, 0.78]) { const cx = rt[0] + (tp[0] - rt[0]) * f, cy = rt[1] + (tp[1] - rt[1]) * f, hw = wd * 0.36 * (1.1 - f * 0.6); g.moveTo(cx - b.nx * hw, cy - b.ny * hw); g.lineTo(cx + b.nx * hw * 0.8 + b.ux * 0.4, cy + b.ny * hw * 0.8 + b.uy * 0.4); }
      g.moveTo(rt[0] - b.nx * wd * 0.42 + b.ux * 1.2, rt[1] - b.ny * wd * 0.42 + b.uy * 1.2); g.quadraticCurveTo(rt[0] + (tp[0] - rt[0]) * 0.5 - b.nx * wd * 0.62, rt[1] + (tp[1] - rt[1]) * 0.5 - b.ny * wd * 0.62, tp[0] - b.nx * 0.3, tp[1] - b.ny * 0.3); // 앞가장자리 밝은 선
      g.stroke();
      const cl = [rt[0] + (tp[0] - rt[0]) * 0.42 - b.nx * wd * 0.55, rt[1] + (tp[1] - rt[1]) * 0.42 - b.ny * wd * 0.55]; ell(g, cl[0], cl[1], 0.35, 0.22, Math.atan2(b.uy, b.ux), TT.beak); // 발톱 하나
    }
  };
  // 뒷지느러미: 짧고 둥근 노, 끝은 땅에 끌린다
  const rearTip = (side) => {
    const base = side ? 0.8 : 0, rr = T(REAR[0] + base, REAR[1]);
    let k = 0;
    if (moving) k = u < D ? -Math.sin(Math.PI * u / D) : 0;
    if (dc > 0) k = dc * 0.4 * Math.sin(w + side * Math.PI);
    return [rr, [rr[0] - 4.0 + k * 0.8 - ly * 0.6, -0.1 - Math.max(0, -k) * 0.3]];
  };

  // ---- 그림자 ----
  if (p.shadow !== false) ell(g, bx, 0, 12.5, 2.2, 0, 'rgba(40,25,10,0.22)');

  // ---- 먼 쪽 지느러미 ----
  { const [rr, tp] = rearTip(1); blade(g, C, rr, tp, 3.0, TT.skinFar); }
  drawFore(FF, TT.skinFar, false);

  // ---- 목·머리 위치: 서기 → 먹기·물(땅까지) → 쉬기(당김) ----
  const nod = 0.25 * Math.sin(t * TAU / 5.5) + 0.2 * breath;
  let hc = T(13.0, -5.0 - nod * (1 - ly)), ha = -0.08 + 0.05 * Math.sin(r.look * 0.4);
  if (moving) { hc = T(13.3, -5.0 - 0.5 * push); ha = -0.1 + 0.08 * push; }
  const chomp = p.st === 'eat' ? Math.max(0, Math.sin(t * TAU * 1.3)) : 0, sip = p.st === 'drink' ? 0.5 + 0.5 * Math.sin(t * TAU * 0.4) : 0;
  const gh = [bx + 14.2, -1.9 - sip * 0.8 - chomp * 0.3], ga = 0.5 - sip * 0.15;
  hc = [lerp(hc[0], gh[0], down), lerp(hc[1], gh[1], down)]; ha = lerp(ha, ga, down);
  const rh = T(11.0, -3.0); hc = [lerp(hc[0], rh[0], ly), lerp(hc[1], rh[1], ly)]; ha = lerp(ha, 0.12, ly);
  if (dc > 0) { const dh = T(12.4 + 0.3 * Math.sin(w), -3.9); hc = [lerp(hc[0], dh[0], dc), lerp(hc[1], dh[1], dc)]; ha = lerp(ha, 0.1, dc); }
  const nb = T(...NECK);
  taper(g, nb[0], nb[1], hc[0] - 1.0, hc[1] + 0.4, 3.6, 2.9, TT.skin);
  if (real) { // 목 아래 밝은 피부
    g.strokeStyle = TT.belly; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(nb[0] + 0.3, nb[1] + 1.4); g.lineTo(hc[0] - 1.0, hc[1] + 1.5); g.stroke();
  }

  // ---- 배딱지 + 등딱지 ----
  g.save(); g.translate(bx, by); g.rotate(th); g.scale(1 + 0.008 * breath, 1 + 0.018 * breath);
  ell(g, -0.6, -0.55, 9.8, 1.0, 0, TT.plast);
  g.fillStyle = C(TT.shell); g.fill(SHELL);
  if (real) {
    g.save(); g.clip(SHELL);
    g.fillStyle = TT.plate; g.fill(SHELL);
    g.fillStyle = TT.rim; g.fill(MARG);
    g.fillStyle = TT.plate2; g.fill(PLATES);
    g.strokeStyle = TT.seam; g.lineWidth = 0.55; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(SEAMS);
    g.fillStyle = 'rgba(255,250,220,0.22)'; g.beginPath(); g.ellipse(-0.5, -7.0, 6.5, 0.8, -0.04, 0, TAU); g.fill(); // 등 하이라이트
    g.fillStyle = 'rgba(40,30,10,0.18)'; g.beginPath(); g.ellipse(0, -0.2, 11, 1.4, 0, 0, TAU); g.fill(); // 아래 그늘
    g.restore();
  }
  g.restore();

  // ---- 가까운 쪽 지느러미 ----
  { const [rr, tp] = rearTip(0); const b = blade(g, C, rr, tp, 3.1, TT.skin); if (real) ell(g, rr[0] + b.ux * 2.0, rr[1] + b.uy * 2.0 - 0.1, 0.6, 0.35, Math.atan2(b.uy, b.ux), TT.scale); }

  // ---- 머리: 둥근 머리 + 짧은 부리, 큰 눈과 무거운 눈꺼풀, 테두리가 밝은 큰 비늘 ----
  const cyc = (t % 6.5) / 6.5, slow = ss((cyc - 0.86) / 0.04) * ss((0.97 - cyc) / 0.04); // 느린 깜빡임
  const closed = ly > 0.6 || slow > 0.6 || r.blink > 0;
  g.save(); g.translate(hc[0], hc[1]); g.rotate(ha); g.scale(1.12, 1.12);
  const head = new Path2D();
  head.moveTo(-2.4, -1.3); head.quadraticCurveTo(-0.2, -2.7, 2.1, -2.0); head.quadraticCurveTo(3.5, -1.3, 3.4, 0.0);
  head.quadraticCurveTo(3.1, 1.3, 1.6, 1.5); head.quadraticCurveTo(-0.8, 1.9, -2.5, 1.0); head.closePath();
  g.fillStyle = C(TT.skin); g.fill(head);
  if (real) {
    g.save(); g.clip(head);
    g.fillStyle = TT.belly; g.beginPath(); g.ellipse(0.6, 1.6, 2.8, 0.8, 0, 0, TAU); g.fill(); // 턱 밑 밝은 피부
    g.fillStyle = TT.skinD; g.strokeStyle = TT.scale; g.lineWidth = 0.28; g.lineJoin = 'round';
    g.beginPath(); // 큰 비늘(어두운 판 + 밝은 테두리)
    for (const q of [[[-1.6, -2.3], [0.3, -2.6], [0.1, -1.5], [-1.5, -1.3]], [[0.4, -2.6], [2.2, -2.2], [1.8, -1.4], [0.3, -1.5]], [[-2.6, -1.1], [-1.4, -1.1], [-1.2, 0.2], [-2.6, 0.4]], [[2.3, -2.0], [3.6, -1.0], [2.6, -0.8], [1.9, -1.3]]]) {
      g.moveTo(...q[0]); for (let i = 1; i < q.length; i++) g.lineTo(...q[i]); g.closePath();
    }
    g.fill(); g.stroke();
    g.restore();
    g.strokeStyle = TT.beak; g.lineWidth = 0.32; g.lineCap = 'round'; // 부리 선(입)
    const open = chomp * 0.5;
    g.beginPath(); g.moveTo(3.3, 0.15 + open * 0.4); g.quadraticCurveTo(2.4, 0.5 + open, 1.2, 0.6 + open * 0.6); g.stroke();
  }
  // 눈: 크고 둥근 검은 눈 + 위에서 내려오는 눈꺼풀(느린 깜빡임)
  if (closed) { ell(g, 1.25, -0.75, 0.98, 0.95, 0, TT.skin); eye(g, 1.25, -0.6, 0.75, true); }
  else {
    ell(g, 1.25, -0.75, 0.82, 0.78, 0, '#1e1712');
    if (real) ell(g, 1.5, -1.0, 0.28, 0.28, 0, '#ffffff');
    const lid = 0.22 + slow * 0.7, eyeLid = new Path2D(); eyeLid.ellipse(1.25, -0.75, 0.98, 0.95, 0, 0, TAU);
    g.save(); g.clip(eyeLid); g.fillStyle = C(TT.skin); g.fillRect(0, -1.8, 2.6, 1.9 * lid); g.restore();
  }
  g.restore();

  drawFore(FN, TT.skin, true); // 가까운 앞지느러미는 머리보다 앞

  // ---- 모래 튀기기(특수) ----
  if (dc > 0.2 && real) {
    for (let side = 0; side < 2; side++) {
      const c = ((w / TAU + (side ? 0.5 : 0)) % 1 + 1) % 1, age = (c - 0.42 + 1) % 1;
      if (age > 0.5) continue;
      const ox = sh[0] + side * 0.9 - 3.2, oy = -0.8;
      for (let i = 0; i < 5; i++) {
        const vx = -(15 + i * 4.5), vy = -(22 + (i % 3) * 6), a = age * 0.9;
        const x = ox + vx * a, y = Math.min(-0.3, oy + vy * a + 42 * a * a), rr = (0.75 + (i % 2) * 0.4) * (1 - age * 0.7);
        ell(g, x, y, rr, rr, 0, i % 2 ? TT.sand2 : TT.sand);
      }
    }
  }
}
