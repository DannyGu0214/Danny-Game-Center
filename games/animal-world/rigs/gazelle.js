// 가젤(톰슨가젤) 리그. 구조·좌표·p 필드는 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX.
// 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y. 아이콘처럼 gait·rig·dt가 없으면 서 있는 모습으로 그린다.
// 날씬한 몸·옆구리 검은 띠·흰 배와 엉덩이·짧고 늘 까딱이는 검은 꼬리·고리 무늬 수금(lyre) 뿔·큰 눈과 얼굴 줄무늬·큰 귀.

export const STRIDE = 9; // 한 걸음 주기 동안 몸이 나아가는 거리(그림 단위)
export const BOX = [16, 42]; // 탭 판정·표시 위치용 [가로 반폭, 높이]
const DUTY = 0.62; // 4박 걷기: 가까운 뒷다리 → 가까운 앞다리 → 먼 뒷다리 → 먼 앞다리
const OFFS = { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 };
const BOUNCE = [5.5, 6.6, 7, 7, 6.6, 6.2, 5]; // 통통 뛰기 높이(한 번씩). 외곽선 캔버스(BOX 높이 + 8) 안에 들도록

const GZ = {
  col: '#c98c4e', far: '#a06c3c', belly: '#f6efe2', band: '#ddb27a', st: '#3a2618', face: '#b5733a',
  hoof: '#2e2118', hoofFar: '#4a3a2c', tail: '#2a1e16', horn: '#33281e', hornFar: '#55473a', ring: '#6e5c48',
  hip: [-8, -17.6], sh: [7.4, -17.8], hind: { a: 6.6, b: 7, c: 5.9, bend: 1 }, fore: { a: 6, b: 6.6, c: 5.6, bend: -1 }, lift: 3.2,
};
const HORN = [[0, 0], [-0.8, -4.2], [-5.8, -6.4], [-4.4, -10.6]]; // 뿔 베지어(서 있을 때 화면 기준): 뒤로 휘었다가 끝이 위·앞으로
const HR0 = 0.95; // 서 있을 때 머리(얼굴 축) 기울기

export function draw(g, p, H) {
  const { TAU, ik, footAt, springTo, rigTick, smooth, limb, ell, eye, C } = H;
  const r = p.rig ?? {}, dt = p.dt ?? 0, real = H.real();
  rigTick(r, dt);
  const stot = p.sp >= 0, moving = p.mv > 0 && !stot, ly = stot ? 0 : p.ly ?? 0, hd = stot ? 0 : p.hd ?? 0, ph = p.gait ?? 0, t = p.ph ?? 0;
  // 통통 뛰기(stotting): 네 다리를 뻣뻣이 모은 채 여러 번 튀어 오른다. 땅에 닿을 땐 살짝 눌렸다가 다시
  let up = 0, arch = 0, pitch = 0;
  if (stot) {
    const n = BOUNCE.length, k = Math.min(n - 1, Math.floor(p.sp * n)), f = p.sp * n - k, c = 0.14;
    if (f < c) up = -0.7 * Math.sin((Math.PI * f) / c);
    else { const u = (f - c) / (1 - c); up = 4 * u * (1 - u) * BOUNCE[k]; pitch = -0.06 * (1 - 2 * u); }
    arch = smooth(Math.min(1, p.sp * 8)) * smooth(Math.min(1, (1 - p.sp) * 8));
  }
  if (p.shadow !== false) ell(g, 0, 0, 12 - Math.max(0, up) * 0.35, 2.8 - Math.max(0, up) * 0.07, 0, 'rgba(40,25,10,0.22)');
  g.save();
  if (stot) { g.translate(0, -up - 17); g.rotate(pitch); g.translate(0, 17); }
  const breath = Math.sin((t * TAU) / 2.8), bob = moving ? Math.sin(ph * TAU * 2) : 0, drop = ly * 11.8, dip = hd * 1.3 * (1 - ly);
  const hip = [GZ.hip[0], GZ.hip[1] + 0.5 * bob + drop];
  const sh = [GZ.sh[0], GZ.sh[1] + 0.5 * (moving ? Math.sin(ph * TAU * 2 + 1.4) : 0) + drop + dip];
  // 다리: 서 있으면 IK로 발굽을 땅에, 걸으면 발 고정 걸음, 누우면 접고, 통통 뛸 땐 곧게 편다
  const stroke = STRIDE * DUTY, gy = Math.max(0, up); // gy = 땅(몸 기준)
  const legPts = (key, root, cfg, front) => {
    const x = root[0];
    if (ly > 0.5) { // 앞다리는 무릎을 앞으로 접어 발굽을 가슴 밑에, 뒷다리는 뒤꿈치를 뒤로 빼고 발굽을 앞으로
      return front ? [root, [x + 0.2, -3.4], [x + 3.6, -1.6], [x + 0.2, -0.9]] : [root, [x + 3.4, -3.4], [x - 3.2, -1.5], [x + 1.9, -0.9]];
    }
    let f;
    if (moving) { const u = footAt((ph + OFFS[key]) % 1, stroke, GZ.lift, DUTY); f = { x: u.x + x + 0.5, y: u.y, sw: u.sw, st: u.st }; }
    else if (stot) f = { x: x + (x * -0.3 + (front ? 0.8 : 0.4)) * arch, y: Math.min(gy, root[1] + (cfg.a + cfg.b + cfg.c) * 0.97), sw: 0, st: 0.45 };
    else f = { x: x + (key === 'fh' ? -1 : key === 'ff' ? 0.9 : 0), y: 0, sw: 0, st: 0.45 };
    // 대롱뼈: 디딜 땐 거의 수직, 들 땐 앞다리는 무릎을 앞으로 내밀며 접히고 뒷다리는 뒤꿈치가 뒤로 접힌다
    const th = stot ? 0 : front ? 1.0 * f.sw + (f.st - 0.4) * 0.35 * (1 - f.sw) : 0.6 * f.sw + (f.st - 0.5) * 0.25 * (1 - f.sw);
    const hoof = [f.x, f.y], ankle = [hoof[0] + cfg.c * Math.sin(th), hoof[1] - cfg.c * Math.cos(th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a, cfg.b, cfg.bend);
    return [root, knee, end, hoof];
  };
  const legs = {
    fh: legPts('fh', [hip[0] + 0.8, hip[1]], GZ.hind, false), ff: legPts('ff', [sh[0] + 0.8, sh[1]], GZ.fore, true),
    nh: legPts('nh', hip, GZ.hind, false), nf: legPts('nf', sh, GZ.fore, true),
  };
  if (p.shadow !== false && ly < 0.5 && up < 1) for (const k of ['nh', 'nf', 'fh', 'ff']) { const [hx, hy] = legs[k][3]; if (hy > -0.3) ell(g, hx, 0.2, 1.8, 0.6, 0, 'rgba(40,25,10,0.3)'); }
  const fold = ly > 0.5; // 접은 다리는 발굽을 숨긴다(배 밑에 깔린다)
  limb(g, legs.fh, 4, 1.15, GZ.far, null, fold ? GZ.far : GZ.hoofFar);
  limb(g, legs.ff, 3, 1.1, GZ.far, null, fold ? GZ.far : GZ.hoofFar);
  // 몸통: 둥근 엉덩이 · 곧은 등 · 어깨 · 깊은 가슴 · 잘록한 배(숨 쉴 때 배가 살짝 부푼다). 통통 뛸 땐 등이 둥글게 솟는다
  const by = 1 + 0.03 * breath, [hx, hy] = hip, [sx, sy] = sh, my = (hy + sy) / 2;
  const body = new Path2D();
  body.moveTo(hx + 1, hy - 7);
  body.quadraticCurveTo(0, Math.min(hy, sy) - 5.6 - arch * 2.8, sx + 0.5, sy - 7.1);
  body.quadraticCurveTo(sx + 4.6, sy - 6.8, sx + 5.2, sy - 2.2);
  body.quadraticCurveTo(sx + 5.6, sy + 2.4, sx + 2.2, sy + 3.6 * by);
  body.bezierCurveTo(sx - 3, sy + 4.5 * by, hx + 8, hy + 3.2 * by - arch, hx + 4.4, hy + 2.2);
  body.quadraticCurveTo(hx + 3.4, hy + 3.4, hx + 3, hy + 5.4);
  body.quadraticCurveTo(hx - 1.6, hy + 6.4, hx - 5, hy + 2.6);
  body.bezierCurveTo(hx - 6.6, hy + 1.2, hx - 7.2, hy - 2.4, hx - 5.4, hy - 4.6);
  body.quadraticCurveTo(hx - 3.4, hy - 7.6, hx + 1, hy - 7);
  body.closePath();
  g.fillStyle = C(GZ.col); g.fill(body);
  if (real) {
    g.save(); g.clip(body);
    // 흰 배(옆줄 아래 전부)
    g.fillStyle = GZ.belly; g.beginPath(); g.moveTo(sx + 8, sy + 0.2); g.lineTo(sx + 3, sy + 0.8);
    g.quadraticCurveTo(0, my + 2.1, hx + 1.2, hy + 0.3); g.lineTo(hx - 2, hy + 8); g.lineTo(sx + 8, sy + 8); g.closePath(); g.fill();
    // 옆줄 위 연한 띠와 굵은 검은 옆줄
    g.fillStyle = GZ.band; g.beginPath(); g.moveTo(sx + 2.6, sy - 0.2); g.quadraticCurveTo(0, my - 3.4, hx + 1.6, hy - 1.2); g.quadraticCurveTo(0, my - 1.2, sx + 2.6, sy - 0.2); g.fill();
    g.fillStyle = GZ.st; g.beginPath(); g.moveTo(sx + 3, sy + 0.8); g.quadraticCurveTo(0, my - 1.8, hx + 1.2, hy + 0.3); g.quadraticCurveTo(0, my + 2.1, sx + 3, sy + 0.8); g.fill();
    // 꼬리 밑 흰 엉덩이 반점
    g.fillStyle = GZ.belly; g.beginPath(); g.ellipse(hx - 6.9, hy - 0.8, 2.6 + arch * 0.7, 4.6 + arch * 0.3, 0.12, 0, TAU); g.fill();
    g.fillStyle = 'rgba(70,45,20,0.16)'; g.beginPath(); g.ellipse(1.5, my + 4.6, 10, 2.2, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.fillStyle = 'rgba(255,240,215,0.42)'; g.beginPath(); g.ellipse(0, Math.min(hy, sy) - 6.4 - arch * 1.6, 9.5, 1.2, 0, 0, TAU); g.fill(); // 등 하이라이트
    g.restore();
  }
  limb(g, legs.nh, 4.2, 1.2, GZ.col, null, fold ? GZ.col : GZ.hoof);
  limb(g, legs.nf, 3.1, 1.15, GZ.col, null, fold ? GZ.col : GZ.hoof);
  // 꼬리(스프링): 짧고 검다. 쉬지 않고 까딱이고, 걸으면 들리고, 통통 뛸 땐 바짝 세워 흰 엉덩이를 보인다
  const tr = [hx - 5.1, hy - 4.9];
  springTo(r.tail, 0.3 + r.swish * 1.3 + (moving ? 0.35 + 0.2 * Math.sin(ph * TAU * 2) : 0) - ly * 0.1, 80, 7, dt);
  const wag = ly > 0.5 ? 0 : Math.sin(t * 15) * (0.55 + 0.45 * Math.sin(t * 1.3));
  const ta = r.tail.x + 0.3 * wag + arch * 1.7, tl = 4;
  const te = [tr[0] - Math.sin(ta) * tl, tr[1] + Math.cos(ta) * tl];
  H.curve(g, tr[0], tr[1], tr[0] - Math.sin(ta * 0.7) * tl * 0.55 - 0.4, tr[1] + Math.cos(ta * 0.7) * tl * 0.55, te[0], te[1], 0.95, GZ.tail);
  ell(g, te[0] - Math.sin(ta) * 0.4, te[1] + Math.cos(ta) * 0.4, 0.65, 1.15, -ta, GZ.tail);
  // 목: 길고 가늘다. 걸을 땐 한 걸음에 두 번 끄덕, 쉴 땐 가끔 두리번, 먹을 땐 땅까지. 머리는 스프링으로 늦게 따라온다
  const look = r.look ?? 0;
  const nod = moving ? 0.06 * Math.sin(ph * TAU * 2 - 0.6) : 0.09 * Math.sin(look * 0.5) * Math.sin(look * 0.23);
  springTo(r.head, nod * (1 - hd), 60, 9, dt);
  const na = 0.42 + r.head.x + hd * 2.26 - ly * 0.06, nb = [sx + 3.3, sy - 5.4], nl = 9 + hd * hd * 7.2; // 목은 숙인 뒤에 늘인다(중간에 앞으로 너무 나가지 않게)
  const tip = [nb[0] + Math.sin(na) * nl, nb[1] - Math.cos(na) * nl], nx = Math.cos(na), ny = Math.sin(na);
  const mx = (nb[0] + tip[0]) / 2, mY = (nb[1] + tip[1]) / 2;
  const neck = new Path2D();
  neck.moveTo(sx + 0.4, sy - 6.8); // 목 뿌리는 어깨(등)와 가슴에 고정해 어떤 각도에서도 몸에 붙는다
  neck.quadraticCurveTo(mx - nx * 2.0, mY - ny * 2.0, tip[0] - nx * 1.7, tip[1] - ny * 1.7);
  neck.lineTo(tip[0] + nx * 2.1, tip[1] + ny * 2.1);
  neck.quadraticCurveTo(mx + nx * 2.5, mY + ny * 2.5, sx + 5, sy - 0.6);
  neck.closePath();
  g.fillStyle = C(GZ.col); g.fill(neck);
  if (real) { // 멱(목 아래) 흰 줄
    g.save(); g.clip(neck); g.strokeStyle = GZ.belly; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx + 5.2, sy - 0.2); g.quadraticCurveTo(mx + nx * 2.6, mY + ny * 2.6, tip[0] + nx * 2.2, tip[1] + ny * 2.2); g.stroke();
    g.restore();
  }
  // 머리(옆모습): 좁은 얼굴 · 큰 눈 · 눈에서 코까지 흰 줄과 검은 줄 · 큰 귀 · 고리 무늬 뿔. 귀는 스프링으로 가끔 휙
  const hr = HR0 + (na - 0.42) * 0.38 - arch * 0.12;
  g.save(); g.translate(tip[0], tip[1]); g.rotate(hr);
  const ear = (x, y, ang, col, inner) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(-1.1, 0); g.quadraticCurveTo(-1.7, -3.6, 0, -5.5); g.quadraticCurveTo(1.7, -3.6, 1.1, 0); g.closePath(); g.fill();
    if (inner && real) { g.fillStyle = '#f2dcc2'; g.beginPath(); g.ellipse(0.15, -2.8, 0.6, 1.9, 0, 0, TAU); g.fill(); }
    g.restore();
  };
  const horn = (dx, col, w0) => { // 굵기가 줄어드는 휜 뿔(머리 기준이 아닌 '서 있을 때 화면' 기준으로 그려 머리와 함께 돈다)
    g.save(); g.translate(0.5 + dx, -1.9); g.rotate(-HR0);
    const P = HORN, pt = (u) => { const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3; return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]]; };
    const N = 7, L = [], Rr = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, [x, y] = pt(u), [x2, y2] = pt(Math.min(1, u + 0.02)), [x1, y1] = pt(Math.max(0, u - 0.02));
      const tx = x2 - x1, ty = y2 - y1, l = Math.hypot(tx, ty) || 1, w = (w0 * (1 - 0.8 * u)) / 2;
      L.push([x - (ty / l) * w, y + (tx / l) * w]); Rr.push([x + (ty / l) * w, y - (tx / l) * w]);
    }
    g.fillStyle = C(col); g.beginPath(); g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= N; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = N; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
    g.closePath(); g.fill();
    if (real) { g.strokeStyle = GZ.ring; g.lineWidth = 0.28; for (let i = 1; i <= 3; i++) { g.beginPath(); g.moveTo(L[i][0], L[i][1]); g.lineTo(Rr[i][0], Rr[i][1]); g.stroke(); } }
    g.restore();
  };
  ear(-0.9, -1.4, -1.95 + r.ear.x * 0.5, GZ.far, false);
  horn(1.2, GZ.hornFar, 1.1);
  const head = new Path2D();
  head.moveTo(-1.4, -1.9); head.quadraticCurveTo(2.2, -2.7, 6.2, -0.9); head.quadraticCurveTo(7.5, -0.4, 7.1, 0.8);
  head.quadraticCurveTo(6.8, 1.6, 5.6, 1.5); head.quadraticCurveTo(2.8, 2.4, 0.4, 2.7); head.quadraticCurveTo(-2.1, 2.1, -1.4, -1.9); head.closePath();
  g.fillStyle = C(GZ.col); g.fill(head);
  const closed = r.blink > 0 || p.st === 'rest';
  if (real) {
    g.save(); g.clip(head);
    g.fillStyle = GZ.face; g.beginPath(); g.ellipse(2.6, -2.1, 3.2, 0.7, 0.2, 0, TAU); g.fill(); // 이마의 짙은 털
    g.strokeStyle = GZ.belly; g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(1.4, -1.6); g.quadraticCurveTo(4, -1.3, 6.4, -0.3); g.stroke(); // 흰 줄
    g.strokeStyle = GZ.st; g.lineWidth = 0.8; g.beginPath(); g.moveTo(2, -0.2); g.quadraticCurveTo(4.2, 0.1, 6.3, 0.5); g.stroke(); // 검은 줄
    g.fillStyle = GZ.belly; g.beginPath(); g.ellipse(3.8, 2.4, 3, 0.75, 0.05, 0, TAU); g.fill(); // 흰 턱
    g.fillStyle = 'rgba(70,45,20,0.14)'; g.beginPath(); g.ellipse(1, 2.2, 2.6, 1, 0, 0, TAU); g.fill();
    g.restore();
    ell(g, 6.9, 0.1, 0.5, 0.42, 0, '#1e1712'); // 코
    if (!closed) ell(g, 1.5, -0.75, 1.3, 1.15, 0, GZ.belly); // 흰 눈테
  }
  eye(g, 1.5, -0.75, 0.9, closed);
  horn(0, GZ.horn, 1.2);
  ear(-0.4, -1.5, -1.6 + r.ear.x * 0.8, GZ.col, true);
  g.restore();
  g.restore();
}
