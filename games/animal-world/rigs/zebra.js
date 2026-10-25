// 얼룩말 리그(기준 예시). 다른 종도 같은 모양: draw(g, p, H), STRIDE, BOX.
// p = 포즈 { face, st, ph(초), mv, hd(고개 숙임 0~1), ly(눕기 0~1), sp(특수 행동 진행 0~1, 아니면 -1), gait(걸음 위상 0~1), rig(몸짓 상태 객체), dt, shadow }
// 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y. 아이콘처럼 gait·rig·dt가 없으면 서 있는 모습으로 그린다.
// H = art.js가 넘기는 공통 도우미(ik·footAt·springTo·rigTick·limb·ell·eye·C(실루엣 색)·real() 등).

export const STRIDE = 10.5; // 한 걸음 주기 동안 몸이 나아가는 거리(그림 단위)
export const BOX = [20, 44]; // 탭 판정·표시 위치용 [가로 반폭, 높이]
const DUTY = 0.64; // 4박 걷기: 가까운 뒷다리 → 가까운 앞다리 → 먼 뒷다리 → 먼 앞다리
const OFFS = { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 };
const TAU = Math.PI * 2;

const ZB = {
  col: '#f6f3ec', far: '#d9d4ca', st: '#2b2622', stFar: '#4a443e', hoof: '#2a2420', muzzle: '#3a3532',
  hip: [-9.5, -21], sh: [9.5, -21.6], hind: { a: 8.6, b: 8.4, c: 6.8, bend: 1 }, fore: { a: 7.6, b: 7.8, c: 6.6, bend: -1 }, lift: 3.6,
};
export function draw(g, p, H) {
  const { TAU, ik, footAt, springTo, rigTick, limb, ell, eye, C } = H;
  const r = p.rig ?? {}, dt = p.dt ?? 0;
  rigTick(r, dt);
  const moving = p.mv > 0 && p.sp < 0, roll = p.sp >= 0, ly = roll ? 1 : p.ly, ph = p.gait ?? 0, t = p.ph ?? 0;
  const breath = Math.sin(t * TAU / 3.4), bob = moving ? Math.sin(ph * TAU * 2) : 0, drop = ly * 12;
  if (p.shadow !== false) ell(g, 0, 0, 16, 3.2, 0, 'rgba(40,25,10,0.22)');
  g.save();
  if (roll) { g.translate(0, -7); g.rotate(Math.sin(p.sp * TAU * 3) * 0.3); g.translate(0, 7); }
  const hip = [ZB.hip[0] + (moving || ly ? 0 : Math.sin(t * 0.6) * 0.4), ZB.hip[1] + 0.55 * bob + drop];
  const sh = [ZB.sh[0], ZB.sh[1] + 0.55 * (moving ? Math.sin(ph * TAU * 2 + 1.4) : 0) + drop];
  // 다리: 서 있으면 IK로 발을 땅에 두고, 누우면 접는다
  const stroke = STRIDE * DUTY;
  const legPts = (key, root, cfg, front) => {
    if (ly > 0.5) { // 접은 다리: 무릎은 앞(앞다리) 또는 뒤(뒷다리)로, 발굽은 몸 밑
      const kx = root[0] + (front ? 4.5 : 3.5), fx = root[0] + (front ? -1.5 : -4);
      const kick = roll ? Math.sin(p.sp * TAU * 6 + (front ? 0 : 1.5)) * 2.5 : 0;
      return [root, [kx, -2.6 - kick * 0.4], [kx - 2, -1.6 - kick], [fx, -1 - kick]];
    }
    let f;
    if (moving) { const u = footAt((ph + OFFS[key]) % 1, stroke, ZB.lift, DUTY); f = { ...u, x: u.x + root[0] + 0.6 }; }
    else f = { x: root[0] + (key === 'fh' ? -1.2 : key === 'ff' ? 1 : 0), y: 0, sw: 0, st: 0.45 };
    // 대롱뼈(발목~발굽)는 내딛을 땐 거의 수직, 들어 올릴 땐 뒤로 접힌다
    const th = front ? 0.95 * f.sw + (f.st - 0.4) * 0.35 * (1 - f.sw) : 0.55 * f.sw + (f.st - 0.5) * 0.25 * (1 - f.sw);
    const hoof = [f.x, f.y], ankle = [hoof[0] + cfg.c * Math.sin(th), hoof[1] - cfg.c * Math.cos(th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a, cfg.b, cfg.bend);
    return [root, knee, end, hoof];
  };
  const legs = {
    fh: legPts('fh', [hip[0] + 0.8, hip[1]], ZB.hind, false), ff: legPts('ff', [sh[0] + 0.8, sh[1]], ZB.fore, true),
    nh: legPts('nh', hip, ZB.hind, false), nf: legPts('nf', sh, ZB.fore, true),
  };
  if (p.shadow !== false && ly < 0.5) for (const k of ['nh', 'nf', 'fh', 'ff']) { const [hx, hy] = legs[k][3]; if (hy > -0.3) ell(g, hx, 0.2, 2.4, 0.7, 0, 'rgba(40,25,10,0.3)'); }
  limb(g, legs.fh, 4.6, 2.2, ZB.far, ZB.stFar, ZB.hoof);
  limb(g, legs.ff, 3.9, 2.1, ZB.far, ZB.stFar, ZB.hoof);
  // 꼬리(스프링): 걸을 때 흔들리고 가끔 휙 휘두른다
  const tailRoot = [hip[0] - 7.2, hip[1] - 5.2];
  springTo(r.tail, 0.32 + (moving ? 0.12 * Math.sin(ph * TAU) : 0) + r.swish + ly * 0.5, 40, 6, dt);
  const ta = r.tail.x, tl = 12 - ly * 3;
  const tm = [tailRoot[0] - Math.sin(ta * 0.6) * tl * 0.5, tailRoot[1] + Math.cos(ta * 0.6) * tl * 0.5], te = [tailRoot[0] - Math.sin(ta) * tl, tailRoot[1] + Math.cos(ta) * tl];
  g.strokeStyle = C(ZB.col); g.lineWidth = 1.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(tailRoot[0], tailRoot[1]); g.quadraticCurveTo(tm[0] - 1, tm[1], te[0], te[1]); g.stroke();
  ell(g, te[0], te[1] + 1.6, 1.4, 3, -ta * 0.8, ZB.st);
  // 몸통: 엉덩이·등·어깨·가슴·배(숨 쉴 때 배가 살짝 부푼다)
  const by = 1 + 0.025 * breath, [hx, hy] = hip, [sx, sy] = sh;
  const body = new Path2D();
  body.moveTo(hx - 2.5, hy - 8.2);
  body.quadraticCurveTo(0, Math.min(hy, sy) - 6.6, sx + 1, sy - 8.8);
  body.quadraticCurveTo(sx + 6, sy - 8.5, sx + 6.5, sy - 3);
  body.quadraticCurveTo(sx + 7.8, sy + 2.5, sx + 3.5, sy + 4.6 * by);
  body.quadraticCurveTo(0, (hy + sy) / 2 + 8.2 * by, hx + 1.5, hy + 4.4 * by);
  body.quadraticCurveTo(hx - 5.8, hy + 4.8, hx - 7.4, hy - 1.6);
  body.quadraticCurveTo(hx - 7.6, hy - 7.6, hx - 2.5, hy - 8.2);
  body.closePath();
  g.fillStyle = C(ZB.col); g.fill(body);
  if (C('#000') === '#000') {
    g.save(); g.clip(body);
    g.strokeStyle = ZB.st; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const x = sx + 3 - i * 2.35, top = sy - 10; g.lineWidth = 1.35 - (i % 2) * 0.25; g.beginPath(); g.moveTo(x + 0.6, top); g.quadraticCurveTo(x - 1.5, top + 8, x + 0.8, top + 17); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.lineWidth = 1.2; g.beginPath(); g.moveTo(hx - 8, hy - 6 + i * 2.6); g.quadraticCurveTo(hx - 2, hy - 3.5 + i * 2.6, hx + 2.5, hy - 7 + i * 3.2); g.stroke(); }
    g.fillStyle = 'rgba(70,55,40,0.16)'; g.beginPath(); g.ellipse(0, (hy + sy) / 2 + 7, 16, 6, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(0, Math.min(hy, sy) - 7.6, 11, 1.5, 0, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }
  limb(g, legs.nh, 4.8, 2.3, ZB.col, ZB.st, ZB.hoof);
  limb(g, legs.nf, 4.1, 2.2, ZB.col, ZB.st, ZB.hoof);
  // 목·머리: 걸을 땐 한 걸음에 두 번 끄덕, 쉴 땐 천천히 두리번, 먹을 땐 땅까지. 머리는 스프링으로 살짝 늦게
  const nod = moving ? 0.07 * Math.sin(ph * TAU * 2 - 0.6) : 0.08 * Math.sin(r.look * 0.5) * Math.sin(r.look * 0.23);
  springTo(r.head, nod, 60, 9, dt);
  const na = 0.62 + r.head.x + p.hd * 1.8 - (roll ? 0.3 : 0), nb = [sx + 4.2, sy - 6.5], nl = 12.5 + p.hd * 6;
  const tip = [nb[0] + Math.sin(na) * nl, nb[1] - Math.cos(na) * nl], nx = Math.cos(na), ny = Math.sin(na);
  const neck = new Path2D();
  neck.moveTo(nb[0] - nx * 5.2, nb[1] - ny * 5.2 + 2); neck.quadraticCurveTo((nb[0] + tip[0]) / 2 - nx * 3.6, (nb[1] + tip[1]) / 2 - ny * 3.6, tip[0] - nx * 2.6, tip[1] - ny * 2.6);
  neck.lineTo(tip[0] + nx * 3, tip[1] + ny * 3); neck.quadraticCurveTo((nb[0] + tip[0]) / 2 + nx * 4, (nb[1] + tip[1]) / 2 + ny * 4.2, nb[0] + nx * 4.6, nb[1] + ny * 4.6 + 3);
  neck.closePath();
  g.fillStyle = C(ZB.col); g.fill(neck);
  if (C('#000') === '#000') {
    g.save(); g.clip(neck); g.strokeStyle = ZB.st; g.lineWidth = 1.3;
    for (let k = 0; k < 5; k++) { const u = 0.12 + k * 0.19, cx = nb[0] + (tip[0] - nb[0]) * u, cy = nb[1] + (tip[1] - nb[1]) * u; g.beginPath(); g.moveTo(cx - nx * 6, cy - ny * 6); g.lineTo(cx + nx * 6, cy + ny * 6); g.stroke(); }
    g.restore();
  }
  // 갈기: 목 윗선을 따라 짧게 선 털(흰색·검은색 번갈아)
  for (let k = 0; k <= 9; k++) {
    const u = k / 9, cx = nb[0] - nx * 4.6 + (tip[0] - nx * 2.4 - (nb[0] - nx * 4.6)) * u, cy = nb[1] - ny * 4.6 + (tip[1] - ny * 2.4 - (nb[1] - ny * 4.6)) * u;
    g.strokeStyle = C(k % 2 ? ZB.st : ZB.col); g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - nx * 2.2, cy - ny * 2.2); g.stroke();
  }
  // 머리(옆모습): 이마 → 긴 콧등 → 검은 주둥이 → 턱. 귀는 스프링으로 가끔 휙
  g.save(); g.translate(tip[0], tip[1]); g.rotate(na * 0.4 + 1.2);
  const ear = (x, y, ang, col) => {
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = C(col); g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(-1.4, -3.4, 0, -5); g.quadraticCurveTo(1.4, -3.4, 1, 0); g.closePath(); g.fill();
    ell(g, 0, -4.2, 0.55, 0.9, 0, ZB.st); g.restore();
  };
  ear(-0.4, -2.2, -1.2 + r.ear.x * 0.6, ZB.far);
  const head = new Path2D();
  head.moveTo(-2, -1.6); head.quadraticCurveTo(3, -4.4, 10, -1.7); head.quadraticCurveTo(11.6, 0.6, 9.6, 2.7); head.quadraticCurveTo(4, 4, 0.4, 3.5); head.quadraticCurveTo(-2.6, 2.1, -2, -1.6); head.closePath();
  g.fillStyle = C(ZB.col); g.fill(head);
  if (C('#000') === '#000') {
    g.save(); g.clip(head);
    g.strokeStyle = ZB.st; g.lineWidth = 0.95; for (let k = 0; k < 4; k++) { const x = 1.2 + k * 1.6; g.beginPath(); g.moveTo(x - 0.4, -4); g.lineTo(x + 0.5, 4); g.stroke(); }
    g.fillStyle = ZB.muzzle; g.beginPath(); g.ellipse(10.4, 0.6, 3.3, 3.4, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(70,55,40,0.14)'; g.beginPath(); g.ellipse(4, 4.2, 8, 2.2, 0, 0, TAU); g.fill();
    g.restore();
    ell(g, 10.5, -0.2, 0.55, 0.38, 0.4, '#16120f');
    const closed = r.blink > 0 || p.st === 'rest';
    eye(g, 2.5, -0.9, 0.95, closed);
  }
  ear(0.6, -2.5, -0.95 + r.ear.x, ZB.col);
  g.restore();
  g.restore();
}
