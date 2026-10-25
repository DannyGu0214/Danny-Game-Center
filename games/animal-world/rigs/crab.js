// 게 리그: 정면을 보고 옆으로 걷는다(화면 x 방향 = 옆걸음). 넓은 등딱지, 눈자루 위 눈, 큰 집게 둘, 양쪽에 마디 다리 넷씩.
// 걷기(다리 넷씩 두 무리가 번갈아 종종걸음, 디딘 발은 땅에 붙는다)·쉬기(눈자루 씰룩, 집게 벌렸다 오므리기, 거품)
// 먹기(집게로 번갈아 땅을 집어 입으로)·물(낮게 앉아 거품)·눕기(다리 접고 납작, 눈자루 눕히고 눈 감기)·특수 행동(집게 들고 옆걸음 춤).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 땅, 위가 -y. 정면 모습이라 face = -1로 뒤집어도 같다.

export const STRIDE = 3; // 한 걸음 주기 동안 몸이 옆으로 나아가는 거리(그림 단위)
export const BOX = [7, 9];
const TAU = Math.PI * 2;
const DUTY = 0.55; // 다리 넷씩 두 무리(오른 1·3 + 왼 2·4 / 그 반대)가 번갈아 디딘다
const CB = {
  shell: '#e0532b', top: '#ec6a3c', rim: '#b23c1b', face: '#f08a5a', mouth: '#a8381a', spot: '#c2421d',
  leg: '#c9481f', leg2: '#b83f1c', legFar: '#a43719', legFar2: '#8f2f16', claw: '#f0602f', clawIn: '#f8aa82', tip: '#4a2418', stalk: '#d24b26', food: '#6f8f3a',
};
const CY = -3.9; // 서 있을 때 등딱지 중심 높이
// 다리 i(0 = 앞, 3 = 뒤, 뒤일수록 높고 바깥): 뿌리·무릎·발목·발끝(서 있을 때, 오른쪽 기준). 뼈 길이는 이 자세에서 정한다
const LEGS = [0, 1, 2, 3].map((i) => {
  const root = [2.6 + i * 0.35, 0.8 - i * 0.45], knee = [4.1 + i * 0.62, -0.9 - i * 0.38], tip = [5.2 + i * 0.85, 0], ankle = [tip[0] - 0.1, -1.3];
  const kn = [knee[0], CY + knee[1]], rt = [root[0], CY + root[1]];
  return { root, tip, ank: ankle, a: Math.hypot(kn[0] - rt[0], kn[1] - rt[1]), b: Math.hypot(ankle[0] - kn[0], ankle[1] - kn[1]) };
});
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
// 굵기가 줄어드는 마디 + 둥근 관절을 한 번에 채운다
function bones(g, C, pts, ws, col) {
  g.fillStyle = C(col); g.beginPath();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w0 = ws[i] / 2, w1 = ws[i + 1] / 2;
    g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath();
  }
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], w = ws[i] / 2; g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU, true); }
  g.fill();
}
let SHELL = null;
function paths() {
  if (SHELL) return;
  SHELL = new Path2D(); // 정면에서 본 등딱지(몸 중심 기준): 둥근 윗선, 옆 끝은 뾰족, 아랫선은 납작
  SHELL.moveTo(-4.9, -0.5);
  SHELL.bezierCurveTo(-4.6, -3.4, 4.6, -3.4, 4.9, -0.5);
  SHELL.quadraticCurveTo(4.6, 1.3, 3.0, 2.0);
  SHELL.quadraticCurveTo(0, 2.8, -3.0, 2.0);
  SHELL.quadraticCurveTo(-4.6, 1.3, -4.9, -0.5);
  SHELL.closePath();
}

export function draw(g, p, H) {
  const { ik, footAt, springTo, rigTick, ell, eye, C } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, sp = p.sp ?? -1, real = H.real();
  const dance = sp >= 0, moving = p.mv > 0 && !dance, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  // 바닷가 동물은 게임에서 ly를 받지 못하므로 상태로 직접 눕는다(아이콘처럼 dt가 없으면 바로)
  const restT = p.st === 'rest' ? 1 : 0, ly = Math.max(p.ly ?? 0, dt > 0 ? clamp01(spring('rest', restT, 30, 11)) : restT);
  const eat = p.st === 'eat' ? hd * (1 - ly) : 0, drink = p.st === 'drink' ? hd * (1 - ly) : 0;
  const dc = dance ? ss(sp / 0.06) * ss((1 - sp) / 0.06) : 0, w = sp * TAU * 4.5;
  const low = Math.max(ly, drink * 0.75); // 낮게 앉기(다리 접기)

  // ---- 몸 위치 ----
  let bx = 0, cy = CY, th = 0;
  if (moving) { cy += 0.22 * Math.cos(u * TAU * 2); th = 0.035 * Math.sin(u * TAU * 2); bx = 0.15 * Math.sin(u * TAU * 2); }
  cy += eat * 0.5 + low * 1.7;
  if (dc > 0) { bx += dc * 1.5 * Math.sin(w); cy -= dc * 0.5 * Math.abs(Math.cos(w)); th += dc * 0.07 * Math.sin(w); }
  if (!moving && dc === 0 && ly < 0.5) cy += 0.06 * Math.sin(t * TAU / 2.2); // 숨
  const ca = Math.cos(th), sa = Math.sin(th), T = (x, y) => [bx + ca * x - sa * y, cy + sa * x + ca * y];

  // ---- 다리: 양쪽 넷씩, 뿌리는 등딱지 밑, 무릎은 바깥 위로, 끝(발톱)은 땅 ----
  const legs = [];
  for (const s of [1, -1]) for (let i = 3; i >= 0; i--) {
    const D = LEGS[i], root = T(s * D.root[0], D.root[1]);
    const tuck = low * (0.9 + i * 0.12);
    let tip = [s * (D.tip[0] - tuck), 0];
    const grp = (i + (s > 0 ? 0 : 1)) % 2;
    if (moving) {
      const f = footAt((u + grp * 0.5 + i * 0.045) % 1, STRIDE * DUTY, 1.5, DUTY);
      tip = [tip[0] + f.x, f.y];
    } else if (dc > 0) {
      const tap = Math.max(0, Math.sin(w * 2 + grp * Math.PI)) * 1.0 * dc;
      tip = [tip[0] + dc * 0.5 * Math.sin(w), -tap];
    }
    const ankle = [tip[0] + s * (D.ank[0] - D.tip[0]), tip[1] + D.ank[1] * (1 - low * 0.35)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], D.a, D.b, s);
    legs.push({ pts: [root, knee, end, tip], i });
  }

  // ---- 그림자 ----
  if (p.shadow !== false) ell(g, bx, 0, 7.2, 1.4, 0, 'rgba(40,25,10,0.22)');

  for (const L of legs) bones(g, C, L.pts, [1.15, 1.0, 0.7, 0.2], [CB.leg, CB.leg2, CB.legFar, CB.legFar2][L.i]);
  if (real) { // 다리 마디 밝은 점(무릎)
    for (const L of legs) if (L.i < 2) { const k = L.pts[1]; ell(g, k[0], k[1] - 0.2, 0.32, 0.22, 0, CB.face); }
  }

  // ---- 등딱지 ----
  g.save(); g.translate(bx, cy); g.rotate(th);
  g.fillStyle = C(CB.shell); g.fill(SHELL);
  if (real) {
    g.save(); g.clip(SHELL);
    g.fillStyle = CB.face; g.beginPath(); g.ellipse(0, 2.4, 3.9, 1.6, 0, 0, TAU); g.fill(); // 아래 앞면(밝은 배 쪽)
    g.fillStyle = CB.top; g.beginPath(); g.ellipse(0, -1.6, 4.0, 1.2, 0, 0, TAU); g.fill(); // 등 윗면
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-1.0, -2.05, 2.0, 0.42, -0.05, 0, TAU); g.fill(); // 하이라이트
    g.fillStyle = CB.spot; for (const [x, y, rr] of [[-2.7, -0.9, 0.32], [2.5, -1.1, 0.28], [0.8, -0.4, 0.22], [-1.3, -0.2, 0.2], [3.6, -0.2, 0.2]]) { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
    g.strokeStyle = CB.rim; g.lineWidth = 0.35; g.lineCap = 'round'; g.beginPath(); g.moveTo(-4.4, 0.2); g.quadraticCurveTo(0, 1.0, 4.4, 0.2); g.stroke(); // 앞 가장자리
    g.restore();
    ell(g, 0, 1.5, 1.0, 0.45, 0, CB.mouth); // 입
  }
  g.restore();

  // ---- 눈자루·눈 ----
  const twitch = spring('tw', r.ear.x, 140, 9);
  const look = 0.12 * Math.sin(r.look * 0.7) * Math.sin(r.look * 0.31);
  const closed = r.blink > 0 || ly > 0.6;
  for (const s of [-1, 1]) {
    const base = T(s * 1.2, -2.0);
    let a = s * 0.16 + look + (s > 0 ? twitch * 0.35 : -twitch * 0.2); // 0 = 똑바로 위
    if (moving) a += 0.06 * Math.sin(u * TAU * 2 + s);
    if (dc > 0) a += dc * 0.25 * Math.sin(w * 2 + s * 1.2);
    a = lerp(a, s * 1.3, ly); // 쉴 땐 눈자루를 옆으로 눕힌다
    const L = lerp(2.1, 1.6, ly), top = [base[0] + Math.sin(a) * L, base[1] - Math.cos(a) * L];
    bones(g, C, [base, top], [0.75, 0.55], CB.stalk);
    if (closed) { ell(g, top[0], top[1], 0.85, 0.85, 0, CB.stalk); eye(g, top[0], top[1] + 0.1, 0.6, true); }
    else { ell(g, top[0], top[1], 0.9, 0.9, 0, '#2a1a12'); eye(g, top[0], top[1], 0.72, false); }
  }

  // ---- 집게(팔 두 마디 + 집게손): 기본은 양옆에 들어 올린 자세 ----
  const claw = (s) => {
    const sh = T(s * 1.9, 1.3);
    let wr = [bx + s * 3.7, cy - 0.3], ang = -Math.PI / 2 + s * 0.22, open = 0.5 + 0.3 * Math.sin(t * 1.9 + s * 1.3), food = 0;
    if (moving) { wr = [bx + s * 3.7, cy - 0.2 + 0.25 * Math.sin(u * TAU * 2 + s)]; ang += s * 0.08 * Math.sin(u * TAU * 2); open = 0.35; }
    if (eat > 0) { // 한쪽씩 땅을 집어 입으로
      const c = t * TAU * 0.75 + (s > 0 ? 0 : Math.PI), k = ss(0.5 - 0.5 * Math.cos(c));
      const gw = [s * 3.4, -3.4], ga = Math.PI / 2 - s * 0.25, mw = [s * 3.4, cy + 2.0], ma = (s > 0 ? Math.PI : 0) - s * 0.25;
      wr = [lerp(wr[0], lerp(gw[0], mw[0], k), eat), lerp(wr[1], lerp(gw[1], mw[1], k), eat)];
      ang = lerp(ang, lerp(ga, ma, k), eat);
      open = lerp(open, k < 0.2 ? 0.15 + 0.6 * Math.max(0, Math.sin(t * TAU * 3)) : 0.04, eat);
      food = k > 0.3 ? eat : 0;
    }
    if (low > 0) { // 낮게 앉기: 집게를 입 앞에 접는다
      const fw = [bx + s * 2.7, cy + 1.6], fa = -Math.PI / 2 - s * 0.75;
      wr = [lerp(wr[0], fw[0], low), lerp(wr[1], fw[1], low)]; ang = lerp(ang, fa, low); open = lerp(open, drink > 0.5 ? 0.12 : 0.02, low);
    }
    if (dc > 0) { // 춤: 집게를 높이 들고 흔든다
      const dw = [bx + s * 5.0, cy - 3.2 + 0.8 * Math.sin(w * 2 + s * 1.6)], da = -Math.PI / 2 + s * (0.2 + 0.35 * Math.sin(w * 2 + s));
      wr = [lerp(wr[0], dw[0], dc), lerp(wr[1], dw[1], dc)]; ang = lerp(ang, da, dc); open = lerp(open, 0.4 + 0.4 * Math.sin(t * TAU * 2.5 + s), dc);
    }
    const { knee } = ik(sh[0], sh[1], wr[0], wr[1], 2.6, 2.6, s);
    bones(g, C, [sh, knee, wr], [1.45, 1.3, 1.5], CB.claw);
    if (real) { const m = [(knee[0] + wr[0]) / 2, (knee[1] + wr[1]) / 2]; ell(g, m[0], m[1], 0.35, 0.3, 0, CB.clawIn); }
    g.save(); g.translate(wr[0], wr[1]); g.rotate(ang); if (s < 0) g.scale(1, -1); g.scale(0.8, 0.8);
    ell(g, 1.5, 0, 1.95, 1.5, 0, CB.claw); // 집게손바닥
    if (real) {
      g.strokeStyle = CB.rim; g.lineWidth = 0.35; g.beginPath(); g.ellipse(1.5, 0, 1.95, 1.5, 0, 0.4, 2.9); g.stroke(); // 바깥 그늘선
      g.fillStyle = CB.clawIn; g.beginPath(); g.ellipse(1.5, -0.55, 1.2, 0.5, 0, 0, TAU); g.fill();
    }
    g.fillStyle = C(CB.claw); g.beginPath(); // 고정 손가락(안쪽)
    g.moveTo(2.6, -1.3); g.quadraticCurveTo(4.4, -1.25, 5.2, -0.15); g.quadraticCurveTo(4.1, -0.15, 2.8, 0.2); g.closePath(); g.fill();
    g.save(); g.translate(2.8, 0.8); g.rotate(open * 0.8); // 움직이는 손가락(바깥쪽)
    g.fillStyle = C(CB.claw); g.beginPath(); g.moveTo(-0.3, 0.75); g.quadraticCurveTo(1.7, 0.85, 2.5, -0.8); g.quadraticCurveTo(1.4, -0.4, -0.2, -0.65); g.closePath(); g.fill();
    if (real) ell(g, 2.25, -0.5, 0.42, 0.3, -0.6, CB.tip);
    g.restore();
    if (real) ell(g, 4.95, -0.3, 0.42, 0.28, 0.5, CB.tip);
    if (food > 0.3 && real) ell(g, 4.4, 0.35, 0.6, 0.5, 0, CB.food); // 집은 먹이
    g.restore();
  };
  claw(-1); claw(1);

  // ---- 거품(쉬기·물) ----
  if (real && !moving && dc === 0 && ly < 0.5 && (p.st === 'idle' || drink > 0.3)) {
    const m = T(0, 1.5);
    for (let i = 0; i < 3; i++) {
      const q = (t * 0.55 + i / 3) % 1; if (q > 0.75) continue;
      const x = m[0] + 0.4 + Math.sin(q * 9 + i * 2) * 0.6, y = m[1] - 1.2 - q * 6, rr = 0.3 + q * 0.45;
      g.fillStyle = 'rgba(232,246,252,0.9)'; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - rr * 0.35, y - rr * 0.35, rr * 0.3, 0, TAU); g.fill();
    }
  }
}
