// desert 물건 그림 16종. 각 함수는 (pen, R, K): pen = { ctx, P, zoom }, R = 난수, K = art.js 도형 도구.
// 모래 땅(#e7b673)에 놓이므로 바위·천막은 붉은 쪽, 물은 푸른 쪽으로 잡아 땅과 구분한다.
const TAU = Math.PI * 2;
const lift = (pen, z) => ({ ...pen, P: (x, y, zz = 0) => pen.P(x, y, zz + z) }); // 높이 z만큼 올려 그리는 펜(lump처럼 바닥 기준인 도구용)
const wobble = (R, n = 18) => { const ph = R() * TAU; return Array.from({ length: n }, (_, i) => 0.93 + 0.05 * Math.sin((i / n) * TAU * 2 + ph) + 0.04 * R()); }; // 매끈하게 일렁이는 윤곽 반지름 비율
function blob(pen, K, x, y, r, fill, jit, z = 0) {
  const n = jit.length;
  K.poly(pen, jit.map((k, i) => { const a = (i / n) * TAU; return [x + Math.cos(a) * r * k, y + Math.sin(a) * r * k, z]; }), fill);
}
// 다각형 기둥(바위 켜): ring = [[x, y]…]. 카메라 쪽 옆면을 먼 것부터 그리고 윗면을 얹는다. streak면 옆면에 세로 풍화 줄을 긋는다
function prism(pen, K, R, ring, z0, z1, col, topCol, streak = false) {
  const n = ring.length, cx = ring.reduce((s, p) => s + p[0], 0) / n, cy = ring.reduce((s, p) => s + p[1], 0) / n, faces = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, m = Math.hypot(mx, my) || 1, nx = mx / m, ny = my / m;
    if (nx + ny < -0.05) continue;
    faces.push({ a, b, nx, ny, key: a[0] + a[1] + b[0] + b[1] });
  }
  faces.sort((p, q) => p.key - q.key);
  for (const f of faces) {
    const c = K.shade(col, 0.64 + 0.08 * (f.ny - f.nx + 1));
    K.poly(pen, [[f.a[0], f.a[1], z0], [f.b[0], f.b[1], z0], [f.b[0], f.b[1], z1], [f.a[0], f.a[1], z1]], c);
    if (streak) for (let s = 0; s < 2; s++) { const t = 0.15 + R() * 0.7, x = f.a[0] + (f.b[0] - f.a[0]) * t, y = f.a[1] + (f.b[1] - f.a[1]) * t; K.line(pen, [x, y, z1 - 0.3], [x, y, z1 - (z1 - z0) * (0.35 + R() * 0.5)], K.shade(c, 0.8), 0.9); }
  }
  K.poly(pen, ring.map((p) => [p[0], p[1], z1]), topCol ?? K.shade(col, 1.12));
}
// 같은 윤곽을 반지름만 바꿔 여러 켜에 쓰기 위한 함수(rad → 점 목록)
const ringOf = (R, cx, cy, n = 10) => { const j = wobble(R, n).map((k) => k * (0.92 + R() * 0.16)); return (rad) => j.map((k, i) => { const a = (i / n) * TAU; return [cx + Math.cos(a) * rad * k, cy + Math.sin(a) * rad * k]; }); };

// 둥근 머리가 있는 세로 기둥(선인장 줄기). 세로 줄과 가시를 그린다
function pill(pen, K, x, y, r, z0, z1, col) {
  const { ctx, P, zoom } = pen, [bx, by] = P(x, y, z0), [tx, ty] = P(x, y, z1), rx = r * zoom, ry = rx * 0.5;
  const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0);
  g.addColorStop(0, K.shade(col, 0.86)); g.addColorStop(0.28, K.shade(col, 1.1)); g.addColorStop(1, K.shade(col, 0.6));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(bx + rx, by); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI); ctx.lineTo(tx - rx, ty); ctx.arc(tx, ty, rx, Math.PI, TAU); ctx.closePath(); ctx.fill();
  ctx.lineCap = 'round';
  for (const f of [-0.66, -0.24, 0.26, 0.7]) {
    const k = Math.sqrt(1 - f * f);
    ctx.strokeStyle = K.shade(col, 0.7); ctx.lineWidth = 0.8 * zoom;
    ctx.beginPath(); ctx.moveTo(bx + f * rx, by + ry * k); ctx.lineTo(tx + f * rx, ty); ctx.quadraticCurveTo(tx + f * rx * 0.9, ty - rx * k * 0.95, tx + f * rx * 0.25, ty - rx * 0.99); ctx.stroke();
    ctx.fillStyle = 'rgba(255,243,196,0.9)';
    for (let j = 0; j < 4; j++) { const u = ((j * 0.29 + f * 0.37 + 1) % 0.8) + 0.08, sx = bx + f * rx, sy = by + (ty - by) * u; ctx.beginPath(); ctx.arc(sx, sy, 0.42 * zoom, 0, TAU); ctx.fill(); }
  }
}
// 속이 비치는 바퀴(수레): 평면 y = cy 위의 원
function wheel(pen, K, cx, cy, cz, r) {
  const { ctx, P, zoom } = pen, pts = [];
  for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; pts.push(P(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r)); }
  ctx.lineJoin = 'round';
  for (const [col, w] of [['#4e3017', 2.8], ['#9a6a3a', 1.7]]) { ctx.strokeStyle = col; ctx.lineWidth = w * zoom; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke(); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; K.line(pen, [cx, cy, cz], [cx + Math.cos(a) * r * 0.92, cy, cz + Math.sin(a) * r * 0.92], '#7a4e2a', 0.9); }
  K.puff(pen, cx, cy, cz, 1.9, '#4e3017'); K.puff(pen, cx - 0.2, cy, cz + 0.3, 1.1, '#b8864e');
}
// 갈대(부들 이삭이 달린 줄기 몇 가닥)
function reeds(pen, K, R, x, y, n, h) {
  for (let i = 0; i < n; i++) {
    const bx = x + (R() - 0.5) * 7, by = y + (R() - 0.5) * 7, hh = h * (0.7 + R() * 0.5), l = (R() - 0.5) * 7, tx = bx + l, ty = by + l * 0.4;
    K.line(pen, [bx, by, 0], [tx, ty, hh], i % 2 ? '#5f9a3c' : '#4a8a35', 0.9);
    if (R() < 0.55) K.line(pen, [bx + l * 0.9, by + l * 0.36, hh - 3.4], [tx, ty, hh], '#7b4a28', 1.8);
  }
}
// 야자나무: 휘어진 줄기 + 아래로 처지는 잎 아홉 장. 줄기 밑 (x, y), 높이 h, lean = 꼭대기가 밑에서 얼마나 기우는지
function palm(pen, K, R, x, y, h, lean, sc = 1) {
  const { ctx, P, zoom } = pen, n = 8, pts = [], wd = (i) => (3.4 - (1.5 * i) / n) * sc;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x + lean[0] * t * t, y + lean[1] * t * t, h * t]); }
  K.shadow(pen, x + lean[0] * 0.7 + 4, y + lean[1] * 0.7 + 4, 12 * sc, 0.2);
  for (let i = 0; i < n; i++) K.line(pen, pts[i], pts[i + 1], '#6c4724', wd(i) + 0.9);
  for (let i = 0; i < n; i++) K.line(pen, pts[i], pts[i + 1], i % 2 ? '#a9794a' : '#bd8d58', wd(i));
  ctx.strokeStyle = '#6c4724'; ctx.lineWidth = 0.7 * zoom;
  for (let i = 1; i < n; i++) { const [sx, sy] = P(pts[i][0], pts[i][1], pts[i][2]), w = wd(i) * 0.5 * zoom; ctx.beginPath(); ctx.moveTo(sx - w, sy - 0.3 * zoom); ctx.lineTo(sx + w, sy + 0.5 * zoom); ctx.stroke(); }
  const top = pts[n], cnt = 9, fr = [];
  for (let k = 0; k < cnt; k++) { const a = (k / cnt) * TAU + R() * 0.35; fr.push({ a, len: (15 + R() * 5) * sc, key: Math.cos(a) + Math.sin(a) }); }
  fr.sort((p, q) => p.key - q.key);
  for (const [dx, dy] of [[1.4, 0.6], [-0.4, 1.8], [-1.6, -0.8]]) K.puff(pen, top[0] + dx * sc, top[1] + dy * sc, top[2] - 2.4 * sc, 1.5 * sc, '#8a5424');
  for (const f of fr) {
    const dx = Math.cos(f.a), dy = Math.sin(f.a), steps = 9, c = [];
    for (let i = 0; i <= steps; i++) { const t = i / steps; c.push(P(top[0] + dx * f.len * 0.85 * t, top[1] + dy * f.len * 0.85 * t, top[2] + f.len * 0.55 * t * (1.1 - 1.9 * t))); }
    const L = [], Rt = [];
    for (let i = 0; i <= steps; i++) {
      const p = c[Math.max(0, i - 1)], q = c[Math.min(steps, i + 1)], tx = q[0] - p[0], ty = q[1] - p[1], m = Math.hypot(tx, ty) || 1, w = 2.7 * sc * zoom * Math.pow(Math.sin(Math.PI * (i / steps)), 0.8) * (i % 2 ? 1 : 0.6);
      L.push([c[i][0] - (ty / m) * w, c[i][1] + (tx / m) * w]); Rt.push([c[i][0] + (ty / m) * w, c[i][1] - (tx / m) * w]);
    }
    ctx.fillStyle = K.shade('#52a43c', 0.8 - (0.22 * (dx + dy)) / 1.414);
    ctx.beginPath(); L.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); for (let i = steps; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2f7a2e'; ctx.lineWidth = 0.7 * zoom; ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }
}
// 오아시스 물웅덩이: 풀 테두리 → 젖은 모래 → 물 → 반짝임
function pool(pen, K, R, x, y, r) {
  const { ctx, P, zoom } = pen;
  blob(pen, K, x, y, r + 7, '#9db654', wobble(R), 0); blob(pen, K, x, y, r + 5, '#86a845', wobble(R), 0.05);
  const jw = wobble(R);
  blob(pen, K, x, y, r + 2.6, '#b88650', jw, 0.1); blob(pen, K, x, y, r + 1.2, '#8f6439', jw, 0.15);
  blob(pen, K, x, y, r, '#3f9bc2', jw, 0.2); blob(pen, K, x, y, r * 0.8, '#55b2d2', jw, 0.25); blob(pen, K, x - r * 0.08, y - r * 0.1, r * 0.5, '#79c9df', jw, 0.3);
  K.soft(pen, x - r * 0.3, y - r * 0.3, r * 0.6, '#e4f8fb', 0.6);
  const [sx, sy] = P(x, y, 0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8 * zoom;
  for (const [k, a0, a1] of [[0.55, 3.5, 4.4], [0.7, 4.0, 4.9], [0.35, 0.3, 1.1]]) { ctx.beginPath(); ctx.ellipse(sx, sy, r * k * zoom, r * k * 0.5 * zoom, 0, a0, a1); ctx.stroke(); }
}

export const ITEM_ART = {
  // 바위 더미: 사암 덩어리 셋과 자갈
  rockpile(pen, R, K) {
    K.shadow(pen, 1, 1, 19, 0.26);
    K.lump(pen, -5, -5, 11.5, 18, '#cf9d68', R, { top: 0.55 });
    K.lump(pen, 9, 3, 9, 11, '#c18f5a', R);
    K.lump(pen, -8, 9, 7, 8, '#d9ac78', R);
    K.lump(pen, 12, 13, 3.4, 3.2, '#b98650', R, { n: 6 });
    K.lump(pen, 1, 14, 2.6, 2.4, '#d3a06a', R, { n: 6 });
    K.tuft(pen, 14, 5, 6, '#a98a4a', R, 3);
  },
  // 선인장 열매 바구니: 엮은 바구니에 붉은 열매가 수북하고 뒤에 선인장 잎이 기대어 있다
  fruitbasket(pen, R, K) {
    const { ctx, P, zoom } = pen;
    K.shadow(pen, 0, 0, 17, 0.26);
    for (const [x, y, z, rot] of [[-7, -7, 11, -0.35], [-1, -10, 12, 0.3]]) {
      const [sx, sy] = P(x, y, z);
      ctx.fillStyle = '#5f9f52'; ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 0.8 * zoom;
      ctx.beginPath(); ctx.ellipse(sx, sy - 3 * zoom, 4.4 * zoom, 7 * zoom, rot, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f6efc9'; for (let i = 0; i < 4; i++) ctx.fillRect(sx + (i - 1.5) * 1.6 * zoom + rot * 4 * zoom, sy - (i % 2 ? 6 : 1.5) * zoom, 0.8 * zoom, 0.8 * zoom);
    }
    // 바구니 몸통(아래가 좁은 통)
    const r0 = 8, r1 = 11, h = 8, [px, py] = P(0, 0, 0), [qx, qy] = P(0, 0, h);
    const g = ctx.createLinearGradient(px - r1 * zoom, 0, px + r1 * zoom, 0);
    g.addColorStop(0, '#c99a58'); g.addColorStop(0.35, '#d6aa66'); g.addColorStop(1, '#8e6430');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px + r0 * zoom, py); ctx.ellipse(px, py, r0 * zoom, r0 * 0.5 * zoom, 0, 0, Math.PI); ctx.lineTo(qx - r1 * zoom, qy); ctx.ellipse(qx, qy, r1 * zoom, r1 * 0.5 * zoom, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a5226'; ctx.lineWidth = 0.7 * zoom;
    for (let row = 0; row < 3; row++) {
      const z0 = (row / 3) * h, z1 = ((row + 1) / 3) * h, ra = r0 + (r1 - r0) * (z0 / h), rb = r0 + (r1 - r0) * (z1 / h);
      for (let i = 0; i <= 7; i++) { const a = ((i + (row % 2) * 0.5) / 7) * Math.PI; if (a > Math.PI) continue; const [ax, ay] = P(Math.cos(a) * ra, Math.sin(a) * ra, z0), [cx, cy] = P(Math.cos(a) * rb, Math.sin(a) * rb, z1); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke(); }
      const [ex, ey] = P(0, 0, z1); ctx.beginPath(); ctx.ellipse(ex, ey, rb * zoom, rb * 0.5 * zoom, 0, 0, Math.PI); ctx.stroke();
    }
    ctx.fillStyle = '#5b3d1c'; ctx.beginPath(); ctx.ellipse(qx, qy, r1 * zoom, r1 * 0.5 * zoom, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e0b974'; ctx.lineWidth = 1.5 * zoom; ctx.beginPath(); ctx.ellipse(qx, qy, r1 * zoom, r1 * 0.5 * zoom, 0, 0, TAU); ctx.stroke();
    // 열매 더미: 아래층 → 위층(먼 것부터)
    const reds = ['#d8354f', '#c42a4d', '#e8573d', '#e2425a'], fruit = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3; fruit.push([Math.cos(a) * 6, Math.sin(a) * 6, h + 1.4]); }
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 1; fruit.push([Math.cos(a) * 2.8, Math.sin(a) * 2.8, h + 4.6]); }
    fruit.push([0, 0, h + 7]);
    fruit.sort((p, q) => p[2] - q[2] || p[0] + p[1] - q[0] - q[1]);
    fruit.forEach(([x, y, z], i) => {
      K.puff(pen, x, y, z, 3.3, reds[i % 4]);
      K.puff(pen, x - 0.9, y - 0.9, z + 1.2, 1, 'rgba(255,255,255,0.45)');
      K.puff(pen, x + 0.2, y + 0.2, z + 2.6, 0.7, '#8a1d35');
    });
    for (const [x, y, c] of [[13, 8, 0], [5, 15, 2]]) { K.puff(pen, x, y, 2.4, 3, reds[c]); K.puff(pen, x - 0.8, y - 0.8, 3.4, 0.9, 'rgba(255,255,255,0.45)'); }
  },
  // 모래굴: 바람에 쌓인 모래 언덕과 어두운 구멍, 파낸 모래 자국
  sandburrow(pen, R, K) {
    const { ctx, P, zoom } = pen;
    K.shadow(pen, 0, 0, 18, 0.2);
    K.splat(pen, 0, 2, 19, '#e3ad63', R, 12, 0.1, 0.9);
    // 바람에 쓸려 한쪽이 가파른 매끈한 모래 언덕
    const [mx, my] = P(0, -2, 0), rx = 15.5 * zoom, ry = rx * 0.5, h = 13 * zoom;
    const g = ctx.createLinearGradient(mx - rx, my - h, mx + rx * 0.7, my + ry);
    g.addColorStop(0, '#fde3ae'); g.addColorStop(0.45, '#f5c682'); g.addColorStop(1, '#d6a05c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(mx - rx, my);
    ctx.bezierCurveTo(mx - rx * 0.7, my - h * 1.05, mx - rx * 0.25, my - h * 1.12, mx + rx * 0.08, my - h);
    ctx.bezierCurveTo(mx + rx * 0.4, my - h * 0.85, mx + rx * 0.85, my - h * 0.5, mx + rx, my);
    ctx.ellipse(mx, my, rx, ry, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineWidth = 0.9 * zoom;
    for (const [k, c] of [[0.45, 'rgba(193,138,72,0.55)'], [0.7, 'rgba(193,138,72,0.45)'], [0.2, 'rgba(255,240,205,0.6)']]) {
      ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(mx - rx * (0.75 - k * 0.5), my - h * (0.28 + k * 0.4));
      ctx.quadraticCurveTo(mx - rx * 0.1, my - h * (0.42 + k * 0.45) - ry * 0.2, mx + rx * (0.15 + k * 0.45), my - h * (0.22 + k * 0.2) + ry * 0.4); ctx.stroke();
    }
    const [hx, hy] = P(2, 8.6, 2.6);
    ctx.fillStyle = '#c4905a'; ctx.beginPath(); ctx.ellipse(hx, hy + 0.7 * zoom, 6.4 * zoom, 4.4 * zoom, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3b20'; ctx.beginPath(); ctx.ellipse(hx, hy, 5.4 * zoom, 3.7 * zoom, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#22150b'; ctx.beginPath(); ctx.ellipse(hx, hy + 0.5 * zoom, 4 * zoom, 2.6 * zoom, 0, 0, TAU); ctx.fill();
    K.splat(pen, 5, 15, 6, '#f3d29a', R, 9, 0.3, 0.55);
    for (let i = 0; i < 6; i++) K.puff(pen, 2 + (R() - 0.5) * 16, 13 + R() * 6, 0.6, 0.9 + R() * 0.5, i % 2 ? '#e4b878' : '#f5d9a4');
    K.lump(pen, -11, 10, 2.6, 2.4, '#c99660', R, { n: 6 });
    K.tuft(pen, -18, 1, 6, '#a98a4a', R, 3);
  },
  // 마른 풀 다발: 끈으로 묶어 세운 짚 한 다발과 흩어진 풀
  drygrass(pen, R, K) {
    K.shadow(pen, 0, 0, 14, 0.22);
    const straw = ['#e2c067', '#d1a94f', '#efd58a', '#b98f3f', '#c7a24b'];
    for (let i = 0; i < 9; i++) { const a = R() * TAU, x = (R() - 0.5) * 10, y = (R() - 0.5) * 10, l = 7 + R() * 7; K.line(pen, [x, y, 0.4], [x + Math.cos(a) * l, y + Math.sin(a) * l, 0.5], straw[i % 5], 0.9); }
    const st = [];
    for (let i = 0; i < 38; i++) {
      const bx = (R() - 0.5) * 6.4, by = (R() - 0.5) * 6.4, h = 21 + R() * 8;
      st.push({ bx, by, tx: bx * 2.6 + (R() - 0.5) * 6 + 1.5, ty: by * 2.6 + (R() - 0.5) * 6 - 1, h, c: straw[i % 5] });
    }
    st.sort((p, q) => p.bx + p.by - q.bx - q.by);
    for (const s of st) K.line(pen, [s.bx, s.by, 0], [s.tx, s.ty, s.h], s.c, 1.3);
    for (const s of st) if (s.h > 25) K.puff(pen, s.tx, s.ty, s.h, 0.9, '#f3e0a0');
    const { ctx, P, zoom } = pen, [sx, sy] = P(0, 0, 8.5);
    ctx.strokeStyle = '#7c4f27'; ctx.lineWidth = 1.7 * zoom; ctx.beginPath(); ctx.ellipse(sx, sy, 4.7 * zoom, 2.4 * zoom, 0, 0.05, Math.PI - 0.05); ctx.stroke();
    ctx.strokeStyle = '#a56d38'; ctx.lineWidth = 0.7 * zoom; ctx.beginPath(); ctx.ellipse(sx, sy - 0.5 * zoom, 4.7 * zoom, 2.4 * zoom, 0, 0.3, Math.PI - 0.3); ctx.stroke();
    K.puff(pen, 0, 4.6, 8.3, 1.5, '#7c4f27');
    K.line(pen, [0, 4.6, 8.3], [-2, 6.6, 5.4], '#7c4f27', 0.9); K.line(pen, [0, 4.6, 8.3], [2.4, 6, 5.8], '#7c4f27', 0.9);
  },
  // 선인장: 사과 모양 키 큰 기둥 선인장 + 분홍 꽃
  cactus(pen, R, K) {
    K.shadow(pen, 3, 3, 15, 0.26);
    K.splat(pen, 0, 0, 10, '#d4a063', R, 10, 0.1, 0.9);
    const col = '#4f9b4d', arm = '#5aa752', hw = 0.7071;
    // 팔(줄기에서 옆으로 뻗어 위로 꺾인다): 왼쪽(화면 좌) · 오른쪽(화면 우)
    for (const [dx, dy, z0, z1, off] of [[-hw, hw, 14, 27, 8.6], [hw, -hw, 20, 34, 8.6]]) {
      const ex = dx * off, ey = dy * off;
      K.line(pen, [0, 0, z0], [ex, ey, z0], K.shade(arm, 0.62), 6);
      K.line(pen, [0, 0, z0], [ex, ey, z0], arm, 5);
      K.line(pen, [0, 0, z0 + 1.2], [ex, ey, z0 + 1.2], K.shade(arm, 1.18), 1.6);
      pill(pen, K, ex, ey, 2.8, z0 - 2.4, z1, arm);
      K.puff(pen, ex, ey, z1 + 2.7, 1.3, '#ff7fa8'); K.puff(pen, ex, ey, z1 + 2.9, 0.6, '#ffd84a');
    }
    pill(pen, K, 0, 0, 5.4, 0, 35, col);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; K.puff(pen, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 41.4, 2, k % 2 ? '#ff6f9d' : '#ff93b8'); }
    K.puff(pen, 0, 0, 41.8, 1.6, '#ffd23f'); K.puff(pen, -0.3, -0.3, 42.2, 0.7, '#fff2a8');
    K.tuft(pen, 10, 8, 5, '#a98a4a', R, 3);
    K.lump(pen, -9, 8, 2.8, 2.6, '#c99660', R, { n: 6 });
  },
  // 물그릇: 흙으로 빚은 둥근 그릇에 물이 가득
  waterbowl(pen, R, K) {
    const { ctx, P, zoom } = pen;
    K.shadow(pen, 0, 0, 16, 0.26);
    const r0 = 8, r1 = 12.5, h = 8.4, [px, py] = P(0, 0, 0), [qx, qy] = P(0, 0, h);
    const g = ctx.createLinearGradient(px - r1 * zoom, 0, px + r1 * zoom, 0);
    g.addColorStop(0, '#d57a47'); g.addColorStop(0.3, '#e08a52'); g.addColorStop(1, '#9c4a26');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px + r0 * zoom, py); ctx.ellipse(px, py, r0 * zoom, r0 * 0.5 * zoom, 0, 0, Math.PI); ctx.lineTo(qx - r1 * zoom, qy); ctx.ellipse(qx, qy, r1 * zoom, r1 * 0.5 * zoom, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    // 무늬 띠: 어두운 줄 둘 사이에 크림색 마름모
    ctx.strokeStyle = '#7e3a1c'; ctx.lineWidth = 0.9 * zoom;
    for (const z of [2.6, 5.6]) { const rr = r0 + (r1 - r0) * (z / h), [ex, ey] = P(0, 0, z); ctx.beginPath(); ctx.ellipse(ex, ey, rr * zoom, rr * 0.5 * zoom, 0, 0.04, Math.PI - 0.04); ctx.stroke(); }
    ctx.fillStyle = '#f4e3c0';
    for (let i = 0; i < 9; i++) { const a = ((i + 0.5) / 9) * Math.PI, rr = r0 + (r1 - r0) * (4.1 / h), [mx, my] = P(Math.cos(a) * rr, Math.sin(a) * rr, 4.1); ctx.beginPath(); ctx.moveTo(mx, my - 1.2 * zoom); ctx.lineTo(mx + 0.9 * zoom, my); ctx.lineTo(mx, my + 1.2 * zoom); ctx.lineTo(mx - 0.9 * zoom, my); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#eba26a'; ctx.beginPath(); ctx.ellipse(qx, qy, r1 * zoom, r1 * 0.5 * zoom, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8683a'; ctx.beginPath(); ctx.ellipse(qx, qy + 0.3 * zoom, (r1 - 1.3) * zoom, (r1 - 1.3) * 0.5 * zoom, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4aa4c9'; ctx.beginPath(); ctx.ellipse(qx, qy + 0.5 * zoom, (r1 - 2.2) * zoom, (r1 - 2.2) * 0.5 * zoom, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6dbfd9'; ctx.beginPath(); ctx.ellipse(qx + 1 * zoom, qy + 0.9 * zoom, (r1 - 5) * zoom, (r1 - 5) * 0.5 * zoom, 0, 0, TAU); ctx.fill();
    K.soft(lift(pen, h), -3.5, -3.5, 6, '#e4f8fb', 0.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.7 * zoom; ctx.beginPath(); ctx.ellipse(qx + 1.5 * zoom, qy + 0.9 * zoom, 4 * zoom, 2 * zoom, 0, 0.3, 1.5); ctx.stroke();
    K.lump(pen, 14, 5, 2.6, 2.4, '#c99660', R, { n: 6 });
  },
  // 붉은 바위: 층층이 쌓인 붉은 사암 메사와 작은 뷰트
  redrock(pen, R, K) {
    K.shadow(pen, 3, 3, 40, 0.26);
    K.splat(pen, 0, 2, 36, '#d9a367', R, 14, 0.1, 0.85);
    const A = ringOf(R, -5, -5, 11), B = ringOf(R, -19, 14, 8), C = ringOf(R, 17, 9, 9);
    const layer = (ring, rad, z0, z1, col, top, streak) => prism(pen, K, R, ring(rad), z0, z1, col, top, streak);
    layer(A, 24, 0, 9, '#b4512c', null, true); layer(A, 22, 9, 18, '#c8623a', null, true); layer(A, 20.5, 18, 26, '#a5472a', null, true);
    layer(A, 19, 26, 35, '#cf764a', null, true); layer(A, 16.5, 35, 40, '#dc9560', '#eab07e');
    layer(B, 8.5, 0, 7, '#b4512c', null, true); layer(B, 7, 7, 13, '#cf764a', '#e3a273');
    layer(C, 13, 0, 8, '#b4512c', null, true); layer(C, 11.6, 8, 15, '#c8623a', null, true); layer(C, 10, 15, 21, '#dc9560', '#eab07e');
    K.lump(pen, 4, 24, 5, 5.5, '#b4512c', R, { n: 7 }); K.lump(pen, -8, 24, 3.4, 3.4, '#c8623a', R, { n: 6 }); K.lump(pen, 27, 24, 3.6, 3.4, '#a5472a', R, { n: 6 });
    K.tuft(pen, 22, -2, 6, '#a98a4a', R, 3); K.tuft(pen, -26, 4, 6, '#a98a4a', R, 3);
  },
  // 그늘 천막: 줄무늬 지붕이 솟은 사각 차양, 안에 깔개와 방석
  tent(pen, R, K) {
    K.shadow(pen, 0, 0, 22, 0.2);
    // 천막 아래 그늘과 깔개
    K.soft(pen, 0, 0, 18, '#3a2417', 0.3);
    const rug = ['#b8442f', '#f2e4c4', '#2f6f9a', '#f2e4c4', '#b8442f'];
    for (let i = 0; i < 5; i++) K.poly(pen, [[-9, -8 + i * 3.2, 0.3], [9, -8 + i * 3.2, 0.3], [9, -4.8 + i * 3.2, 0.3], [-9, -4.8 + i * 3.2, 0.3]], rug[i]);
    K.box(pen, -6, -4, 6, 6, 2.4, ['#3aa0ae', '#2f8a98', '#26707c']); K.box(pen, 2, 1, 6, 5, 2.2, ['#f0b840', '#d49c2c', '#b0821f']);
    const e = 14, ez = 15, az = 27, wood = '#8a5a32';
    for (const [x, y] of [[-e + 1, -e + 1], [e - 1, -e + 1], [-e + 1, e - 1], [e - 1, e - 1]]) K.box(pen, x - 0.9, y - 0.9, 1.8, 1.8, ez, [K.shade(wood, 1.1), K.shade(wood, 0.85), K.shade(wood, 0.68)]);
    const cA = ['#d9503a', '#f6ead0'], N = 7, st = (2 * e) / N;
    // +y 쪽 지붕면(왼쪽 앞), +x 쪽 지붕면(오른쪽 앞)
    for (let i = 0; i < N; i++) K.poly(pen, [[-e + i * st, e, ez], [-e + (i + 1) * st, e, ez], [0, 0, az]], cA[i % 2]);
    for (let i = 0; i < N; i++) K.poly(pen, [[e, -e + i * st, ez], [e, -e + (i + 1) * st, ez], [0, 0, az]], K.shade(cA[i % 2], 0.74));
    // 처마 장식(톱니 모양 술)
    for (let i = 0; i < N; i++) {
      const x0 = -e + i * st, x1 = x0 + st;
      K.poly(pen, [[x0, e, ez], [x1, e, ez], [x1, e, ez - 3], [(x0 + x1) / 2, e, ez - 4.6], [x0, e, ez - 3]], K.shade(cA[i % 2], 0.92));
      K.poly(pen, [[e, x0, ez], [e, x1, ez], [e, x1, ez - 3], [e, (x0 + x1) / 2, ez - 4.6], [e, x0, ez - 3]], K.shade(cA[i % 2], 0.68));
    }
    K.line(pen, [0, 0, az], [0, 0, az + 4.5], '#6a4424', 1);
    K.puff(pen, 0, 0, az + 5, 1.7, '#f3c14b'); K.puff(pen, -0.4, -0.4, az + 5.5, 0.6, '#fff0a8');
  },
  // 오아시스: 작은 샘과 풀 테두리, 뒤쪽 모서리의 야자나무
  oasis(pen, R, K) {
    pool(pen, K, R, 2, 4, 21);
    for (const [x, y, r] of [[-16, 14, 3.4], [-8, 24, 3], [20, -8, 3.2], [26, 8, 2.8]]) K.lump(pen, x, y, r, r * 0.85, '#c99660', R, { n: 7 });
    for (const [x, y] of [[-6, 2], [10, 8]]) { K.disc(pen, x, y, 3.2, '#5aa64a', 0.4); K.disc(pen, x - 0.4, y - 0.3, 2.3, '#74bb5c', 0.5); }
    reeds(pen, K, R, -22, 10, 7, 18); reeds(pen, K, R, 22, -14, 5, 15);
    palm(pen, K, R, -19, -21, 38, [10, 8], 1);
    for (let i = 0; i < 5; i++) { const a = R() * TAU; K.tuft(pen, -2 + Math.cos(a) * 25, 4 + Math.sin(a) * 25, 6, i % 2 ? '#5f9a3c' : '#78ad3e', R, 3); }
    reeds(pen, K, R, 10, 27, 5, 12);
  },
  // 먹이 상자: 나무 상자에 과일과 채소가 수북
  foodcrate(pen, R, K) {
    K.shadow(pen, 0, 0, 17, 0.26);
    const w = ['#c8905a', '#aa7742', '#8a5c30'], dk = '#6e4624';
    K.box(pen, -10.5, -10.5, 21, 21, 13, w);
    for (const z of [4.4, 8.8]) { K.line(pen, [-10.5, 10.5, z], [10.5, 10.5, z], dk, 0.8); K.line(pen, [10.5, -10.5, z], [10.5, 10.5, z], K.shade(dk, 0.8), 0.8); }
    const post = ['#b8814a', '#9a6a3a', '#7a4f28'];
    K.line(pen, [-8, 10.6, 1.4], [8, 10.6, 11.6], '#7a4f28', 1.1); K.line(pen, [8, 10.6, 1.4], [-8, 10.6, 11.6], '#7a4f28', 1.1);
    K.line(pen, [10.6, -8, 1.4], [10.6, 8, 11.6], '#5e3c1e', 1.1); K.line(pen, [10.6, 8, 1.4], [10.6, -8, 11.6], '#5e3c1e', 1.1);
    K.box(pen, -10.9, 8.3, 2.7, 2.7, 13.4, post); K.box(pen, 8.3, 8.3, 2.7, 2.7, 13.4, post); K.box(pen, 8.3, -10.9, 2.7, 2.7, 13.4, post);
    K.poly(pen, [[-8, -8, 13.1], [8, -8, 13.1], [8, 8, 13.1], [-8, 8, 13.1]], '#4a2f16');
    const cols = ['#e98a2e', '#d9503a', '#8fbf4a', '#f2c14e', '#c2284a'], f = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) f.push([-5.6 + i * 5.6, -5.6 + j * 5.6, 15.4, (i * 3 + j) % 5]);
    for (const [x, y, c] of [[-3, -3, 1], [3, -3, 4], [-3, 3, 3], [3, 3, 0]]) f.push([x, y, 19, c]);
    f.push([0, 0, 22.4, 2]);
    f.sort((p, q) => p[2] - q[2] || p[0] + p[1] - q[0] - q[1]);
    for (const [x, y, z, c] of f) { K.puff(pen, x, y, z, 3.5, cols[c]); K.puff(pen, x - 1, y - 1, z + 1.2, 1, 'rgba(255,255,255,0.45)'); }
    for (let i = 0; i < 5; i++) K.line(pen, [(R() - 0.5) * 10, (R() - 0.5) * 10, 20], [(R() - 0.5) * 18, (R() - 0.5) * 18, 24 + R() * 3], i % 2 ? '#4f9a35' : '#6fb143', 1.2);
  },
  // 마른 나무: 잎 하나 없이 비틀린 줄기와 뾰족한 가지
  deadtree(pen, R, K) {
    K.shadow(pen, 3, 3, 19, 0.24);
    K.splat(pen, 0, 0, 10, '#d4a063', R, 10, 0.1, 0.9);
    const dark = '#5d4632', mid = '#9a8266', lite = '#c4ad8c', segs = [], pts = [];
    for (let i = 0; i <= 6; i++) pts.push([3.4 * Math.sin(i * 1.05), 2.8 * Math.cos(i * 0.85) - 2.8, i * 5.8]);
    for (let i = 0; i < 6; i++) segs.push([pts[i], pts[i + 1], 7.6 - i * 0.7]);
    const twig = (p, az, el, len, w, depth) => {
      let [x, y, z] = p;
      for (let i = 0; i < 3; i++) {
        az += (R() - 0.5) * 0.8; el = Math.max(0.2, Math.min(1.45, el + (R() - 0.45) * 0.4));
        const l = len / 3, q = [x + Math.cos(az) * Math.cos(el) * l, y + Math.sin(az) * Math.cos(el) * l, z + Math.sin(el) * l];
        segs.push([[x, y, z], q, w]);
        [x, y, z] = q; w *= 0.72;
        if (depth > 0 && i < 2) twig([x, y, z], az + (i ? -1 : 1) * (0.7 + R() * 0.6), el + 0.1, len * 0.55, w * 0.95, depth - 1);
      }
    };
    twig(pts[3], 2.5, 0.95, 21, 4, 2); twig(pts[3], -0.6, 0.9, 20, 3.8, 2);
    twig(pts[5], 0.9, 0.8, 15, 2.8, 1); twig(pts[5], 3.8, 0.85, 15, 2.8, 1); twig(pts[6], 1.8, 1.25, 12, 2.4, 1);
    twig(pts[2], 4.7, 0.45, 13, 3, 1); twig(pts[2], 1.6, 0.35, 12, 3, 1);
    for (const [dx, dy] of [[5, 2.6], [-2.4, 5.4], [-5, -1.6], [1.6, -5]]) segs.push([[dx * 0.35, dy * 0.35, 2.4], [dx, dy, 0.3], 3.2]);
    for (const [a, b, w] of segs) K.line(pen, a, b, dark, w + 1);
    for (const [a, b, w] of segs) K.line(pen, a, b, mid, w);
    for (const [a, b, w] of segs) if (w > 2) K.line(pen, [a[0] - 0.7, a[1] + 0.7, a[2]], [b[0] - 0.7, b[1] + 0.7, b[2]], lite, w * 0.3);
    const { ctx, P, zoom } = pen, [kx, ky] = P(pts[2][0] + 1.6, pts[2][1] + 2.4, pts[2][2] + 1);
    ctx.fillStyle = '#3b2a1b'; ctx.beginPath(); ctx.ellipse(kx, ky, 1.4 * zoom, 2.2 * zoom, 0.2, 0, TAU); ctx.fill();
    K.tuft(pen, -10, 7, 5, '#a98a4a', R, 3); K.lump(pen, 9, 8, 2.8, 2.6, '#c99660', R, { n: 6 });
  },
  // 새 횃대: 모래에 박은 말뚝 끝에 가로대, 낮은 쪽에 짧은 가지와 깃털
  perch(pen, R, K) {
    K.shadow(pen, 0, 0, 15, 0.24);
    K.lump(pen, -5, -3, 5.5, 4.5, '#cf9d68', R, { n: 7 }); K.lump(pen, 4, -5, 4.5, 4, '#c18f5a', R, { n: 7 });
    K.box(pen, -2, -2, 4, 4, 33, ['#b8814a', '#9a6a3a', '#7a4f28']);
    K.line(pen, [-10.5, 10.5, 31], [10.5, -10.5, 31], '#5e3c1e', 4.2);
    K.line(pen, [-10.5, 10.5, 31], [10.5, -10.5, 31], '#9a6a3a', 3.2);
    K.line(pen, [-10, 10, 32.2], [10, -10, 32.2], '#c99258', 1);
    K.line(pen, [2, 2, 18], [8, 8, 22.5], '#5e3c1e', 3); K.line(pen, [2, 2, 18], [8, 8, 22.5], '#9a6a3a', 2);
    const { ctx, P, zoom } = pen;
    ctx.strokeStyle = '#e8d49a'; ctx.lineWidth = 1.2 * zoom;
    for (const z of [25.5, 26.7, 27.9]) { const [sx, sy] = P(0, 0, z); ctx.beginPath(); ctx.ellipse(sx, sy, 2.9 * zoom, 1.45 * zoom, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
    // 가로대 왼쪽 끝에 달린 붉은 깃털
    const [fx, fy] = P(-9, 9, 25);
    K.line(pen, [-9, 9, 30], [-9, 9, 25], '#e8d49a', 0.7);
    ctx.fillStyle = '#d9533a'; ctx.beginPath(); ctx.ellipse(fx, fy + 1 * zoom, 1.4 * zoom, 4.4 * zoom, 0.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a2d1f'; ctx.lineWidth = 0.6 * zoom; ctx.beginPath(); ctx.moveTo(fx - 0.2 * zoom, fy - 3.4 * zoom); ctx.lineTo(fx + 0.2 * zoom, fy + 5 * zoom); ctx.stroke();
    K.tuft(pen, 9, -2, 5, '#a98a4a', R, 3);
  },
  // 큰 오아시스: 넓은 못과 야자나무 셋, 연꽃, 갈대
  bigoasis(pen, R, K) {
    pool(pen, K, R, 4, 4, 33);
    for (const [x, y, r] of [[-26, 24, 4], [-12, 38, 3.4], [30, -20, 3.8], [40, 2, 3.2], [34, 28, 3.4], [-34, 4, 3.2]]) K.lump(pen, x, y, r, r * 0.85, '#c99660', R, { n: 7 });
    for (const [x, y, r] of [[-8, 4, 4.2], [14, 14, 3.6], [2, -12, 3.4], [18, -4, 3]]) { K.disc(pen, x, y, r, '#4e9a40', 0.4); K.disc(pen, x - 0.4, y - 0.3, r * 0.72, '#6fb858', 0.5); }
    K.puff(pen, 14, 14, 2.2, 2.2, '#ff8fb5'); K.puff(pen, 13.5, 13.5, 2.9, 1, '#ffd84a');
    reeds(pen, K, R, -34, 22, 8, 20); reeds(pen, K, R, -28, 30, 6, 17); reeds(pen, K, R, 38, -10, 7, 18);
    for (const [x, y] of [[-34, -28], [32, -34], [-42, 4]]) K.splat(pen, x, y, 9, '#8ea84a', R, 9, 0.1, 0.9);
    palm(pen, K, R, -38, -34, 46, [13, 10], 1.1);
    palm(pen, K, R, -44, 6, 34, [11, -3], 0.95);
    palm(pen, K, R, 34, -38, 40, [-8, 11], 1);
    for (let i = 0; i < 8; i++) { const a = R() * TAU; K.tuft(pen, 4 + Math.cos(a) * 38, 4 + Math.sin(a) * 38, 6, i % 2 ? '#5f9a3c' : '#78ad3e', R, 3); }
    reeds(pen, K, R, 12, 42, 6, 14); reeds(pen, K, R, 38, 24, 5, 13);
  },
  // 건초 수레: 짚을 가득 실은 나무 수레
  haycart(pen, R, K) {
    K.shadow(pen, 4, 2, 21, 0.26);
    const w = ['#b8814a', '#9a6a3a', '#7a4f28'], sd = ['#9a6a3a', '#8a5a32', '#7a4f28'];
    wheel(pen, K, 0, -9.4, 6.8, 6.8);
    for (const y of [-4.6, 4.6]) { K.line(pen, [12, y, 8], [28, y, 1.6], '#4e3017', 2.8); K.line(pen, [12, y, 8], [28, y, 1.6], '#8a5a32', 1.8); }
    K.box(pen, -12, -8, 24, 16, 6.6, w, 5.4);
    for (const z of [7.6, 9.8]) { K.line(pen, [-12, 8, z], [12, 8, z], '#5e3c1e', 0.7); K.line(pen, [12, -8, z], [12, 8, z], '#4e3017', 0.7); }
    K.box(pen, -12.4, 7.6, 2.6, 0.9, 7.2, sd, 5); K.box(pen, 9.8, 7.6, 2.6, 0.9, 7.2, sd, 5);
    K.lump(lift(pen, 11.6), 0, 0, 11.6, 10, '#e3c15f', R, { squash: 0.8, top: 0.55, mid: 0.92, n: 11 });
    for (let i = 0; i < 22; i++) { const a = R() * TAU, k = 5 + R() * 6, z = 12 + R() * 8; K.line(pen, [Math.cos(a) * k * 0.95, Math.sin(a) * k * 0.7, z], [Math.cos(a) * (k + 2 + R() * 2.5), Math.sin(a) * (k + 2 + R() * 2.5) * 0.75, z + (R() - 0.3) * 3], i % 2 ? '#f0d682' : '#c9a443', 0.9); }
    wheel(pen, K, 0, 9.4, 6.8, 6.8);
    K.line(pen, [-15, 3, 0.8], [-9, 8, 1.2], '#e2c56a', 0.9); K.line(pen, [18, 12, 0.4], [24, 9, 0.5], '#e2c56a', 0.9);
  },
  // 사암 아치: 붉은 사암이 구멍 뚫린 문처럼 선 랜드마크
  arch(pen, R, K) {
    const { ctx, P, zoom } = pen, D = 6.5, col = '#e8a063';
    const OUT = [[-39, 0], [-38, 13], [-34, 27], [-26, 39], [-14, 47], [3, 50], [19, 46], [30, 36], [36, 21], [39, 8], [38, 0]];
    const HOL = [[-17, 0], [-17, 13], [-14, 23], [-8, 30], [0, 33], [8, 30], [14, 22], [17, 12], [17, 0]];
    const cen = (a) => [a.reduce((s, p) => s + p[0], 0) / a.length, a.reduce((s, p) => s + p[1], 0) / a.length];
    const [ox, oz] = cen(OUT), [hx, hz] = cen(HOL);
    const k = (nx, nz) => { const a = Math.max(nz, 0), b = Math.max(nx, 0); return (a + b * 0.66) / (a + b || 1); };
    K.shadow(pen, -26, 6, 17, 0.24); K.shadow(pen, 26, 6, 17, 0.24); K.shadow(pen, 0, 6, 18, 0.14);
    K.lump(pen, 22, -22, 8, 9, '#c98650', R, { n: 8 }); K.lump(pen, 31, -16, 5, 5.5, '#d99a62', R, { n: 7 });
    // 구멍 안쪽 면(왼쪽 반이 카메라에 보인다)
    for (let i = 0; i < HOL.length - 1; i++) {
      const a = HOL[i], b = HOL[i + 1];
      let nx = -(b[1] - a[1]), nz = b[0] - a[0]; const m = Math.hypot(nx, nz) || 1; nx /= m; nz /= m;
      if ((hx - a[0]) * nx + (hz - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
      if (nx + 0.707 * nz > 0) K.poly(pen, [[a[0], -D, a[1]], [b[0], -D, b[1]], [b[0], D, b[1]], [a[0], D, a[1]]], K.shade(col, 0.5));
    }
    // 바깥 옆·윗면
    for (let i = 0; i < OUT.length - 1; i++) {
      const a = OUT[i], b = OUT[i + 1];
      let nx = -(b[1] - a[1]), nz = b[0] - a[0]; const m = Math.hypot(nx, nz) || 1; nx /= m; nz /= m;
      if ((a[0] - ox) * nx + (a[1] - oz) * nz < 0) { nx = -nx; nz = -nz; }
      if (nx + 0.707 * nz > 0) K.poly(pen, [[a[0], -D, a[1]], [b[0], -D, b[1]], [b[0], D, b[1]], [a[0], D, a[1]]], K.shade(col, 0.55 + 0.5 * k(nx, nz)));
    }
    // 앞면(구멍이 뚫린 하나의 다각형) + 지층 줄무늬
    const face = [...OUT, ...HOL.slice().reverse()].map(([x, z]) => P(x, D, z));
    ctx.save();
    ctx.beginPath(); face.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = K.shade(col, 0.84); ctx.fill(); ctx.clip();
    const bands = ['#c4814b', '#d99a62', '#b97646', '#d08c55', '#be7a48'];
    for (let j = 0; j < 12; j++) {
      const z = 2 + j * 4.3, wv = 0.9 + (j % 3) * 0.4;
      ctx.strokeStyle = bands[j % 5]; ctx.lineWidth = (1.4 + (j % 3) * 0.8) * zoom; ctx.beginPath();
      for (let x = -42; x <= 42; x += 3) { const [sx, sy] = P(x, D, z + wv * Math.sin(x * 0.17 + j * 1.7)); if (x === -42) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(110,60,30,0.35)'; ctx.lineWidth = 0.8 * zoom;
    for (const [x, z0, z1] of [[-31, 6, 18], [28, 4, 14], [-9, 38, 47], [12, 40, 47]]) { const [ax, ay] = P(x, D, z0), [bx, by] = P(x + 1.2, D, z1); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
    ctx.restore();
    K.lump(pen, -31, 18, 7, 8, '#d9955a', R, { n: 8 }); K.lump(pen, -23, 22, 4.6, 5, '#e2a56c', R, { n: 7 }); K.lump(pen, 29, 17, 6, 7, '#cf8a52', R, { n: 8 }); K.lump(pen, 22, 22, 3.2, 3.2, '#e2a56c', R, { n: 6 });
    K.tuft(pen, -40, 8, 6, '#a98a4a', R, 3); K.tuft(pen, 8, 22, 6, '#a98a4a', R, 3);
  },
  // 캐러밴 텐트: 팔각 유목민 천막. 알록달록 지붕, 열린 문, 깔개, 깃발
  caravan(pen, R, K) {
    K.shadow(pen, 2, 2, 21, 0.26);
    const n = 8, R0 = 10.6, Re = 13, wz = 10, az = 28, tri = [], wall = [], c0 = R0 * Math.cos(Math.PI / 8) * 0.7071;
    const F = (u, w, z) => [c0 + (-u + w) * 0.7071, c0 + (u + w) * 0.7071, z]; // 정면 벽(+x+y 쪽) 기준 좌표: u 옆으로, w 바깥으로
    const rug = ['#c0442f', '#f4e5c0', '#2f9aa8', '#f0b840', '#2f9aa8', '#f4e5c0', '#c0442f'];
    for (let i = 0; i < 7; i++) K.poly(pen, [F(-8.4 + i * 2.4, 0.8, 0.3), F(-6 + i * 2.4, 0.8, 0.3), F(-6 + i * 2.4, 8.4, 0.3), F(-8.4 + i * 2.4, 8.4, 0.3)], rug[i]);
    for (let i = 0; i <= 7; i++) K.line(pen, F(-8.4 + i * 2.4, 8.4, 0.3), F(-8.4 + i * 2.4, 9.6, 0.2), '#f4e5c0', 0.7);
    const V = (k, rad, z) => { const a = ((k + 0.5) / n) * TAU; return [Math.cos(a) * rad, Math.sin(a) * rad, z]; };
    const roofCols = ['#d9503a', '#f2b93e', '#2f9aa8', '#f2b93e'];
    for (let k = 0; k < n; k++) {
      const f = ((k + 1) / n) * TAU, nx = Math.cos(f), ny = Math.sin(f), t = 0.64 + 0.08 * (ny - nx + 1);
      wall.push({ pts: [V(k, R0, 0), V(k + 1, R0, 0), V(k + 1, R0, wz), V(k, R0, wz)], key: nx + ny, c: K.shade('#f1e2c0', t) });
      tri.push({ pts: [V(k, Re, wz - 0.4), V(k + 1, Re, wz - 0.4), [0, 0, az]], key: nx + ny + 0.01, c: K.shade(roofCols[k % 4], t + 0.12), k, vis: nx + ny > -0.5, t });
    }
    wall.sort((a, b) => a.key - b.key); tri.sort((a, b) => a.key - b.key);
    for (const f of wall) K.poly(pen, f.pts, f.c);
    // 문: 정면 벽 가운데의 아치 구멍과 양쪽 걷어 올린 천
    K.poly(pen, [F(-2.7, 0.15, 0.2), F(2.7, 0.15, 0.2), F(2.7, 0.15, 6.6), F(0, 0.15, 8.6), F(-2.7, 0.15, 6.6)], '#3b2217');
    K.poly(pen, [F(-2.7, 0.2, 0.2), F(-2.7, 0.2, 6.6), F(-4.3, 0.2, 7.8), F(-4.3, 0.2, 0.2)], '#c0442f'); K.poly(pen, [F(2.7, 0.2, 0.2), F(2.7, 0.2, 6.6), F(4.3, 0.2, 7.8), F(4.3, 0.2, 0.2)], '#9c3524');
    // 지붕: 처마 띠 → 쐐기 지붕
    for (const f of tri) if (f.vis) K.poly(pen, [V(f.k, Re, wz - 0.4), V(f.k + 1, Re, wz - 0.4), V(f.k + 1, Re, wz - 2.8), V(f.k, Re, wz - 2.8)], K.shade('#8a2f22', f.t + 0.15));
    for (const f of tri) K.poly(pen, f.pts, f.c);
    for (let k = 0; k < n; k++) K.line(pen, V(k, Re, wz - 0.4), [0, 0, az], '#6e2a1c', 0.7);
    K.line(pen, [0, 0, az], [0, 0, az + 7.5], '#5a3b20', 0.9);
    K.poly(pen, [[0, 0, az + 7.5], [0, 0, az + 3.8], [5.2, -5.2, az + 5.8]], '#e0533f');
    K.puff(pen, 0, 0, az + 0.5, 1.3, '#f3c14b');
    const [jx, jy] = F(9, 3.6, 0);
    K.cyl(pen, jx, jy, 2.3, 4.6, '#b5663a', 0, '#7e3a1c');
    K.puff(pen, jx - 0.6, jy - 0.6, 3.2, 0.8, 'rgba(255,255,255,0.35)');
  },
};

export const ITEM_BOX = {
  rockpile: [22, 20], fruitbasket: [22, 24], sandburrow: [22, 14], drygrass: [22, 30], cactus: [22, 44], waterbowl: [22, 14], redrock: [46, 44], tent: [24, 34],
  oasis: [46, 66], foodcrate: [22, 26], deadtree: [24, 56], perch: [22, 40], bigoasis: [70, 78], haycart: [26, 30], arch: [46, 52], caravan: [24, 38],
};
export const FLOOR = []; // 오아시스·큰 오아시스는 야자나무가 서 있어 바닥 물건이 아니다
