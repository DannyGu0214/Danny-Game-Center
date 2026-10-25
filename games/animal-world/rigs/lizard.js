// 도마뱀 리그: 모래색 사막 도마뱀(아가마·모래도마뱀 느낌). 낮고 납작한 몸, 길게 가늘어지는 꼬리, 옆으로 벌린 다리(무릎·팔꿈치가 옆·위로 솟는다),
// 펼친 긴 발가락, 등의 비늘 점무늬·꼬리 띠, 목 밑 멱.
// 걷기: 대각선 다리 쌍(가까운 뒷다리+먼 앞다리 → 가까운 앞다리+먼 뒷다리)이 함께 움직이고 몸·꼬리가 옆으로 S자 물결을 친다.
// 쉬기(고개 들기·가끔 혀 날름·깜빡임·꼬리 끝 말기)·먹기(벌레를 노리다 휙 덤벼 덥석, 오물오물)·물(고개 숙여 핥기)·눕기(배 깔고 일광욕, 눈 감기)
// ·특수 행동(팔굽혀펴기: 앞다리를 폈다 굽혔다, 고개 까딱, 멱이 파랗게 번쩍·머리가 주황빛).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y.
// 쿼터뷰 깊이: 몸 옆(z, 보는 쪽이 +)으로 벌어진 점은 화면에서 z × ZK만큼 아래에 그린다. 그래서 가까운 발은 땅선보다 조금 아래, 먼 발은 조금 위에 놓이고
// 꼬리가 옆으로 흔들리면 화면에서는 위아래로 물결친다.

export const STRIDE = 4; // 한 걸음 주기 동안 몸이 나아가는 거리(그림 단위)
export const BOX = [9, 6];
const TAU = Math.PI * 2;
const DUTY = 0.6; // 대각선 쌍 걸음
const OFFS = { nh: 0, ff: 0.03, nf: 0.5, fh: 0.53 };
const ZK = 0.3; // 옆(z) → 화면 아래
const HIP_X = -1.3, SH_X = 3.1, TL = 7.0; // 엉덩이·어깨 x(꼬리까지 합친 몸이 원점 가운데 오도록 조금 앞), 꼬리 길이
const LZ = {
  col: '#d8b57c', far: '#b39062', back: '#a47a48', dot: '#f4e4bc', belly: '#efdeb4', throat: '#f3e6c4', flash: '#3d8ad6', warm: '#e48a3c',
  mouth: '#8a4a3a', tongue: '#d4566c', ring: '#efe0b8', bug: '#3a3026', wing: '#e6eef2',
};

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
// 굵기가 줄어드는 마디들 + 둥근 관절을 한 번에 채운다
function bones(g, C, pts, ws, col) {
  g.fillStyle = C(col); g.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath();
  }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], w = ws[i] / 2; g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU, true); }
  g.fill();
}
// 등뼈 점들(목 → 꼬리 끝, 화면 좌표 + 윗/아랫 두께)로 매끈한 몸·꼬리 윤곽을 만든다
function ribbon(pts) {
  const n = pts.length, top = [], bot = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    // 목에서 꼬리로 가는 방향(왼쪽)이라 (−ty, tx)가 위쪽
    top.push([pts[i].x - ty * pts[i].wt, pts[i].y + tx * pts[i].wt]);
    bot.push([pts[i].x + ty * pts[i].wb, pts[i].y - tx * pts[i].wb]);
  }
  const path = new Path2D(), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n0 = pts[0], n1 = pts[1], fx = n0.x - n1.x, fy = n0.y - n1.y, fl = Math.hypot(fx, fy) || 1;
  path.moveTo(...bot[0]);
  path.quadraticCurveTo(n0.x + (fx / fl) * n0.wt * 1.2, n0.y + (fy / fl) * n0.wt * 1.2, ...top[0]); // 목 앞 둥근 끝
  for (let i = 1; i < n - 1; i++) path.quadraticCurveTo(...top[i], ...mid(top[i], top[i + 1]));
  path.lineTo(pts[n - 1].x, pts[n - 1].y);
  for (let i = n - 2; i >= 1; i--) path.quadraticCurveTo(...bot[i], ...mid(bot[i], bot[i - 1]));
  path.lineTo(...bot[0]);
  path.closePath();
  return path;
}

export function draw(g, p, H) {
  const { footAt, springTo, rigTick, ell, eye, C, mix } = H;
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  const show = sp >= 0, moving = p.mv > 0 && !show, u = (((p.gait ?? 0) % 1) + 1) % 1;
  // 사막 동물은 게임에서 ly를 받지 못하므로 상태로 직접 눕는다(아이콘처럼 dt가 없으면 바로)
  const restT = !show && !moving && p.st === 'rest' ? 1 : 0;
  const ly = Math.max(show || moving ? 0 : p.ly ?? 0, dt > 0 ? clamp01(spring('rest', restT, 18, 8)) : restT);
  const eat = p.st === 'eat' && !moving && !show ? hd * (1 - ly) : 0, drink = p.st === 'drink' && !moving && !show ? hd * (1 - ly) : 0;
  const idle = moving || show ? 0 : (1 - ly) * (1 - Math.max(eat, drink));
  const breath = Math.sin(t * TAU / 2.6);

  // ---- 특수 행동: 팔굽혀펴기 6번(빨리 올라가 잠깐 버티고 내려온다) ----
  const pe = show ? ss(sp / 0.05) * ss((1 - sp) / 0.05) : 0, pq = show ? (sp * 6) % 1 : 0;
  const pu = pe * ss(pq / 0.22) * (1 - ss((pq - 0.5) / 0.3));
  const pnod = pe * Math.sin(Math.PI * clamp01((pq - 0.5) / 0.28)); // 내려올 때 고개 까딱
  // ---- 먹기: 노려보다(0~0.3) 휙 덤벼(0.3~0.42) 덥석(0.44) 물러나 오물오물 ----
  const ec = (t / 1.9) % 1;
  const lunge = eat * ss((ec - 0.28) / 0.12) * (1 - ss((ec - 0.5) / 0.3));
  const jawE = eat * ss((ec - 0.3) / 0.06) * (1 - ss((ec - 0.41) / 0.04)) * 0.38;
  const chew = eat * (ec > 0.5 && ec < 0.85 ? Math.max(0, Math.sin(((ec - 0.5) / 0.35) * Math.PI * 4)) * 0.12 : 0);
  const lick = drink * Math.max(0, Math.sin(t * TAU * 2.2));
  // 가끔 혀 날름(쉴 때), 꼬리 끝 천천히 말기
  const fq = (t % 6.7) / 6.7, flick = idle * (fq < 0.06 ? Math.sin(Math.PI * fq / 0.06) : 0);
  const curl = idle * (0.5 + 0.5 * Math.sin(t * 0.7));

  // ---- 몸 높이(엉덩이 hP·어깨 hS, 땅에서 등뼈까지)·고개 ----
  let hP = 1.45, hS = 1.95, hx = 0, headA = -0.3 + 0.06 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
  if (moving) {
    hP = 1.3 + 0.07 * Math.sin(u * TAU * 2); hS = 1.42 + 0.07 * Math.sin(u * TAU * 2 + 1.2);
    headA = -0.06 + 0.05 * Math.sin(u * TAU * 2 - 0.6);
  } else {
    const down = Math.max(eat, drink);
    hS = lerp(hS, 1.45, down); headA = lerp(headA, 0.08, eat); headA = lerp(headA, 0.2, drink);
    hx += 1.3 * lunge; hS -= 0.3 * lunge; headA += 0.2 * lunge;
    hS = lerp(hS, 1.4 + 1.9 * pu, pe); hP = lerp(hP, 1.35 + 0.3 * pu, pe); headA = lerp(headA, -0.12 - 0.2 * pu + 0.32 * pnod, pe);
    hP = lerp(hP, 0.97, ly); hS = lerp(hS, 1.0, ly); headA = lerp(headA, 0.14, ly);
  }
  const by = 1 + 0.03 * breath * (moving ? 0 : 1);
  // ---- 옆으로 치는 물결(z): 걸을 땐 한 걸음에 한 번 몸 전체가 S자로, 쉴 땐 꼬리만 천천히 ----
  const wAmp = moving ? 1 : 0.35 * idle, wPh = moving ? u * TAU : t * 0.8;
  const zAt = (s) => wAmp * (0.15 + 2.3 * s * s) * Math.sin(wPh - s * 3.4);
  const P = (x, h, z) => [x, -h + z * ZK];
  const Px = HIP_X + hx, Sx = SH_X + hx;

  // ---- 등뼈(목 → 꼬리 끝) ----
  const neckH = hS + 0.1 - 0.25 * lunge - 0.25 * drink;
  const nodes = [
    { x: Sx + 1.25, h: neckH, s: 0, wt: 0.78, wb: 0.86 },
    { x: Sx, h: hS, s: 0.06, wt: 0.95, wb: 1.0 },
    { x: (Px + Sx) / 2, h: (hP + hS) / 2, s: 0.15, wt: 1.0, wb: 1.12 * by },
    { x: Px, h: hP, s: 0.24, wt: 0.95, wb: 1.0 },
    { x: Px - 1.1, h: hP - 0.1, s: 0.31, wt: 0.76, wb: 0.76 },
  ];
  const NT = 7;
  for (let i = 1; i <= NT; i++) {
    const s = i / NT, w = 0.07 + 0.62 * Math.pow(1 - s, 1.25);
    let x = Px - 1.1 - s * TL;
    const hb = lerp(hP - 0.1, w + 0.04, ss(s / 0.5));
    const raise = (moving ? 0.75 * s : 0) + curl * 1.5 * ss((s - 0.62) / 0.38) + pe * 0.4 * s;
    x += curl * 1.0 * ss((s - 0.75) / 0.25);
    nodes.push({ x, h: Math.max(w + 0.04, hb + raise), s: 0.31 + 0.69 * s, wt: w, wb: w });
  }
  for (const n of nodes) { const z = zAt(n.s); n.z = z; [n.x, n.y] = P(n.x, n.h, z); }
  const [N, S0, M, P0] = nodes;

  // ---- 다리: 뿌리(몸 옆)·무릎/팔꿈치(옆으로 벌어져 위로 솟음)·발(더 옆, 땅) ----
  const legs = {};
  const mk = (key, near) => {
    const front = key[1] === 'f', zs = near ? 1 : -1, root = front ? S0 : P0;
    const rx = root.x + (near ? 0 : 0.35), rh = (front ? hS - 0.25 : hP - 0.1), rz = zs * 0.6 + root.z;
    let fx, fh = 0, sw = 0;
    if (moving) {
      const f = footAt((u + OFFS[key]) % 1, STRIDE * DUTY, 0.75, DUTY);
      fx = rx + (front ? 0.85 : 0.45) + f.x; fh = -f.y; sw = f.sw;
    } else fx = rx + (front ? 0.95 + (near ? 0 : 0.3) : 0.55 + (near ? 0 : 0.4));
    let fz = zs * (front ? 1.75 : 1.95) + rz * 0.3;
    let kx, kh, kz;
    if (front) { // 팔꿈치: 굽힐수록(어깨가 낮을수록) 뒤·옆·위로
      const bent = clamp01((2.35 - hS) / 1.25);
      kx = lerp((rx + fx) / 2, rx - 0.85, bent); kh = lerp((rh + fh) / 2, rh + 0.45, bent) + 0.3 * sw; kz = zs * lerp(1.15, 1.9, bent);
    } else { // 무릎: 앞·위로 솟는다
      kx = rx + 0.45 * (fx - rx) + 0.75; kh = rh + (near ? 0.6 : 0.2) + 0.4 * sw; kz = zs * 1.5; // 먼 무릎은 등 위로 삐죽 나오지 않게 조금 낮춘다
    }
    if (ly > 0) { // 일광욕: 다리를 땅에 납작하게. 뒷다리는 꼬리 옆으로 뒤로 뻗는다
      if (front) { fx = lerp(fx, rx + 1.2, ly); kx = lerp(kx, rx - 0.5, ly); kh = lerp(kh, 0.55, ly); }
      else { fx = lerp(fx, rx - 2.1, ly); kx = lerp(kx, rx - 0.5, ly); kh = lerp(kh, 0.6, ly); fz = lerp(fz, zs * 1.5, ly); }
      fh *= 1 - ly;
    }
    legs[key] = { front, near, sw, pts: [P(rx, rh, rz), P(kx, kh, kz), P(fx, fh, fz)], zs };
  };
  mk('nh', true); mk('nf', true); mk('fh', false); mk('ff', false);
  const drawLeg = (L, col) => {
    const [a, k, f] = L.pts, front = L.front;
    // 발가락(땅 위로 펼친 모양): 앞으로 긴 것 둘, 옆, 뒤로 짧은 것. 들면 오므려 처진다
    const len = (front ? 1.15 : 1.6) * (1 - 0.35 * L.sw), dirs = front ? [[-0.25, 1], [0.35, 0.85], [1.0, 0.7], [2.5, 0.5]] : [[-0.2, 1], [0.3, 0.8], [0.9, 0.65], [2.6, 0.6]];
    g.strokeStyle = C(col); g.lineCap = 'round'; g.lineWidth = 0.28; g.beginPath();
    for (const [a0, kl] of dirs) {
      const aa = a0 * L.zs, l = len * kl;
      g.moveTo(f[0], f[1]); g.lineTo(f[0] + Math.cos(aa) * l * (1 - 0.3 * L.sw), f[1] + Math.sin(aa) * l * ZK * 1.6 + 0.35 * L.sw * l);
    }
    g.stroke();
    bones(g, C, [a, k, f], front ? [1.0, 0.62, 0.5] : [1.25, 0.72, 0.52], col);
  };

  // ---- 그림자 ----
  if (p.shadow !== false) {
    ell(g, (Px + Sx) / 2 - 0.6, 0.15, 6.2, 1.5, 0, 'rgba(40,25,10,0.22)');
    if (real) for (const k of ['nh', 'nf', 'fh', 'ff']) { const f = legs[k].pts[2]; if (legs[k].sw < 0.3) ell(g, f[0] + 0.4, f[1] + 0.1, 1.1, 0.35, 0, 'rgba(40,25,10,0.2)'); }
  }

  // ---- 벌레(먹기): 노리는 동안 앞에서 꼼지락 ----
  const bugX = SH_X + 5.3, bugY = 0.15;
  if (eat > 0.5 && ec < 0.42) {
    const wig = Math.sin(t * TAU * 5) * 0.12;
    if (real) { ell(g, bugX - 0.1, bugY - 0.45, 0.45, 0.2, -0.5 + wig, LZ.wing); ell(g, bugX + 0.1, bugY - 0.45, 0.45, 0.2, 0.5 - wig, LZ.wing); }
    ell(g, bugX, bugY - 0.25, 0.5, 0.28, 0, LZ.bug);
  }

  // ---- 먼 쪽 다리 → 몸·꼬리 → 가까운 쪽 다리 ----
  drawLeg(legs.fh, LZ.far); drawLeg(legs.ff, LZ.far);
  const body = ribbon(nodes);
  g.fillStyle = C(LZ.col); g.fill(body);
  if (real) {
    g.save(); g.clip(body);
    const ta = Math.atan2(S0.y - P0.y, S0.x - P0.x);
    g.fillStyle = LZ.belly; g.beginPath(); g.ellipse(M.x + 0.3, M.y + 0.95, 3.6, 0.55, ta, 0, TAU); g.fill(); // 연한 배
    g.fillStyle = 'rgba(90,60,25,0.16)'; g.beginPath(); g.ellipse(M.x, M.y + 1.25, 4.2, 0.45, ta, 0, TAU); g.fill(); // 배 쪽 그늘
    // 등 비늘 점무늬: 등선을 따라 짙은 점 두 줄 + 사이사이 밝은 점, 꼬리는 짙은 띠
    const dark = new Path2D(), light = new Path2D();
    const along = (i, f) => { const a = nodes[i], b = nodes[i + 1]; return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), w: lerp(a.wt, b.wt, f) }; };
    for (let i = 1; i < 5; i++) for (const f of [0.15, 0.6]) {
      const q = along(i, f);
      dark.moveTo(q.x + 0.42, q.y - q.w * 0.42); dark.ellipse(q.x, q.y - q.w * 0.42, 0.42, 0.26, 0, 0, TAU);
      dark.moveTo(q.x + 0.3 + 0.3, q.y + q.w * 0.2); dark.ellipse(q.x + 0.3, q.y + q.w * 0.2, 0.3, 0.2, 0, 0, TAU);
      light.moveTo(q.x - 0.55 + 0.2, q.y - q.w * 0.1); light.ellipse(q.x - 0.55, q.y - q.w * 0.1, 0.2, 0.2, 0, 0, TAU);
    }
    g.fillStyle = LZ.back; g.fill(dark); g.fillStyle = LZ.dot; g.fill(light);
    g.strokeStyle = LZ.back; g.lineCap = 'butt'; g.beginPath();
    for (const i of [6, 8, 10]) { const a = nodes[i], b = nodes[i + 1], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, w = a.wt + 0.1; g.lineWidth = 0.55 - (i - 6) * 0.06; g.moveTo(a.x - (dy / l) * w, a.y + (dx / l) * w); g.lineTo(a.x + (dy / l) * w, a.y - (dx / l) * w); }
    g.stroke();
    g.fillStyle = 'rgba(255,248,225,0.35)'; g.beginPath(); g.ellipse(M.x - 0.3, M.y - 0.75, 3.4, 0.28, ta, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }
  drawLeg(legs.nh, LZ.col); drawLeg(legs.nf, LZ.col);

  // ---- 머리: 쐐기 모양. 아래턱은 경첩(0.5, 0.4)으로 열린다. 팔굽혀펴기 땐 머리가 주황빛, 멱이 파랗게 부푼다 ----
  const ang = Math.atan2(N.y - S0.y, N.x - S0.x) + headA;
  const disp = pe * (0.55 + 0.45 * pu), headCol = mix(LZ.col, LZ.warm, 0.7 * pe);
  g.save(); g.translate(N.x - 0.15, N.y - 0.05); g.rotate(ang); g.scale(0.86, 0.86);
  const jaw = jawE + chew + 0.12 * lick + 0.1 * flick;
  // 멱(목 밑): 아래턱 뒤쪽에서 목으로 이어지는 주머니
  const dew = 0.55 * disp, dp = new Path2D();
  dp.moveTo(2.3, 0.7); dp.quadraticCurveTo(1.5, 1.05 + dew * 1.5, 0.1, 1.0 + dew * 0.9); dp.quadraticCurveTo(-0.9, 0.95 + dew * 0.3, -0.75, 0.1); dp.closePath();
  g.fillStyle = C(real ? mix(LZ.throat, LZ.flash, disp) : LZ.col); g.fill(dp);
  // 혀(아래턱보다 먼저): 날름·핥기
  const tongue = Math.max(flick * 1.3, lick * 0.9);
  if (tongue > 0.05 && real) {
    const tx = 3.5 + tongue, ty = 0.35 + 0.35 * lick;
    g.strokeStyle = LZ.tongue; g.lineWidth = 0.28; g.lineCap = 'round'; g.beginPath();
    g.moveTo(3.2, 0.4); g.lineTo(tx, ty); g.moveTo(tx, ty); g.lineTo(tx + 0.35, ty - 0.18); g.moveTo(tx, ty); g.lineTo(tx + 0.35, ty + 0.16); g.stroke();
  }
  g.save(); g.translate(0.5, 0.4); g.rotate(jaw); g.translate(-0.5, -0.4);
  if (jaw > 0.04) ell(g, 2.0, 0.42, 1.5, 0.2, 0, LZ.mouth);
  const jp = new Path2D();
  jp.moveTo(0.3, 0.38); jp.lineTo(3.35, 0.32); jp.quadraticCurveTo(3.3, 0.72, 2.5, 0.84); jp.quadraticCurveTo(1.0, 1.1, -0.3, 0.9); jp.quadraticCurveTo(-0.5, 0.55, 0.3, 0.38); jp.closePath();
  g.fillStyle = C(headCol); g.fill(jp);
  if (real) { g.save(); g.clip(jp); g.fillStyle = mix(LZ.throat, LZ.flash, disp * 0.6); g.beginPath(); g.ellipse(0.9, 1.05, 1.5, 0.28, 0.05, 0, TAU); g.fill(); g.restore(); }
  if (eat > 0.5 && ec >= 0.42 && ec < 0.62) ell(g, 3.3, 0.25, 0.42, 0.24, 0.3, LZ.bug); // 물고 있는 벌레
  g.restore();
  const hp = new Path2D();
  hp.moveTo(-0.55, -0.8);
  hp.quadraticCurveTo(0.9, -1.35, 2.2, -0.95);
  hp.quadraticCurveTo(3.35, -0.62, 3.75, -0.08);
  hp.quadraticCurveTo(3.85, 0.3, 3.4, 0.36);
  hp.lineTo(0.5, 0.42);
  hp.quadraticCurveTo(-0.5, 0.5, -0.7, -0.05);
  hp.quadraticCurveTo(-0.75, -0.5, -0.55, -0.8);
  hp.closePath();
  g.fillStyle = C(headCol); g.fill(hp);
  const closed = r.blink > 0 || ly > 0.6;
  if (real) {
    g.save(); g.clip(hp);
    g.fillStyle = 'rgba(255,248,225,0.35)'; g.beginPath(); g.ellipse(1.6, -1.0, 1.6, 0.25, -0.1, 0, TAU); g.fill(); // 정수리 하이라이트
    g.fillStyle = 'rgba(110,70,30,0.2)'; g.beginPath(); g.ellipse(2.4, 0.3, 1.6, 0.25, -0.05, 0, TAU); g.fill(); // 입술 그늘
    g.restore();
    g.strokeStyle = 'rgba(110,70,40,0.75)'; g.lineWidth = 0.12; g.lineCap = 'round'; g.beginPath(); g.moveTo(3.45, 0.36); g.quadraticCurveTo(2.0, 0.48, 0.6, 0.3); g.stroke(); // 입선
    ell(g, 3.35, -0.25, 0.12, 0.09, 0, '#3a2a1c'); // 콧구멍
    ell(g, 1.5, -0.38, 0.58, 0.5, 0, LZ.ring); // 눈 둘레 비늘
    g.strokeStyle = LZ.back; g.lineWidth = 0.22; g.beginPath(); g.moveTo(0.9, -0.85); g.quadraticCurveTo(1.5, -1.12, 2.1, -0.82); g.stroke(); // 눈썹 비늘
  }
  eye(g, 1.52, -0.38, 0.36, closed);
  g.restore();
}
