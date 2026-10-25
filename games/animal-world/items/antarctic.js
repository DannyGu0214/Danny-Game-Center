// antarctic 물건 그림. 각 함수는 (pen, R, K): pen = { ctx, P, zoom }, R = 난수, K = art.js 도형 도구.
// 땅이 하얀 눈이라 그림자는 푸른색으로, 바위는 어둡게, 얼음은 짙은 하늘색 면으로 대비를 준다. 빛은 왼쪽 위.
const TAU = Math.PI * 2;
const sh = (pen, K, x, y, r, a = 0.32) => K.soft(pen, x, y, r * 1.15, '#3d5f8e', a); // 눈 위의 푸른 그림자
const S = (s, z, x = 0, y = 0) => [x + s / 2, y - s / 2, z]; // 화면 가로로 s만큼 떨어진 월드 점(오른쪽이 +)
const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function oval(pen, x, y, z, rx, ry, fill, rot = 0) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(sx, sy, Math.max(0.1, rx * zoom), Math.max(0.1, ry * zoom), rot, 0, TAU); ctx.fill();
}
// 공(눈사람·둥근 덩어리): 왼쪽 위가 밝은 그라데이션
function ball(pen, x, y, z, r, c0, c1) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z), rr = r * zoom;
  const g = ctx.createRadialGradient(sx - rr * 0.38, sy - rr * 0.42, rr * 0.08, sx, sy, rr);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
}
// 물고기 한 마리(머리가 rot 방향). 은빛 푸른 등과 흰 배
function fish(pen, x, y, z, len, rot, back = '#6d93b3', belly = '#dbe9f3') {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z), L = len * zoom;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
  ctx.fillStyle = back; ctx.beginPath(); ctx.moveTo(-L * 0.38, 0); ctx.lineTo(-L * 0.72, -L * 0.24); ctx.lineTo(-L * 0.72, L * 0.24); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, L / 2, L * 0.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(L * 0.02, L * 0.07, L * 0.4, L * 0.1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#16212e'; ctx.beginPath(); ctx.arc(L * 0.3, -L * 0.04, Math.max(0.5, L * 0.05), 0, TAU); ctx.fill();
  ctx.restore();
}
// 위가 넓은 양동이. 안쪽은 inside 색
function bucket(pen, K, r0, r1, h, col, inside) {
  const { ctx, P, zoom } = pen, [bx, by] = P(0, 0, 0), [tx, ty] = P(0, 0, h), a0 = r0 * zoom, a1 = r1 * zoom;
  const g = ctx.createLinearGradient(bx - a1, 0, bx + a1, 0);
  g.addColorStop(0, K.shade(col, 0.9)); g.addColorStop(0.3, K.shade(col, 1.1)); g.addColorStop(1, K.shade(col, 0.58));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(bx, by, a0, a0 / 2, 0, 0, Math.PI); ctx.lineTo(tx - a1, ty); ctx.ellipse(tx, ty, a1, a1 / 2, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = K.shade(col, 0.62); ctx.lineWidth = 1.1 * zoom;
  for (const f of [0.28, 0.72]) { // 테
    const [hx, hy] = P(0, 0, h * f), hr = (r0 + (r1 - r0) * f) * zoom;
    ctx.beginPath(); ctx.ellipse(hx, hy, hr, hr / 2, 0, 0.12, Math.PI - 0.12); ctx.stroke();
  }
  ctx.fillStyle = K.shade(col, 1.22); ctx.beginPath(); ctx.ellipse(tx, ty, a1, a1 / 2, 0, 0, TAU); ctx.fill();
  const ia = a1 - 1.4 * zoom;
  ctx.fillStyle = inside; ctx.beginPath(); ctx.ellipse(tx, ty + 0.3 * zoom, ia, ia / 2, 0, 0, TAU); ctx.fill();
  return [tx, ty];
}
// 눈더미: 왼쪽이 높고 오른쪽으로 길게 눕는 둔덕
function mound(pen, x, y, rx, h, stops) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, 0), a = rx * zoom, b = a * 0.5, H = h * zoom;
  const g = ctx.createLinearGradient(sx - a * 0.8, sy - H, sx + a * 0.8, sy + b * 0.7);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx + a, sy); ctx.ellipse(sx, sy, a, b, 0, 0, Math.PI);
  ctx.bezierCurveTo(sx - a * 0.92, sy - H * 1.2, sx + a * 0.3, sy - H * 1.38, sx + a, sy);
  ctx.closePath(); ctx.fill();
}
const sparkle = (pen, K, x, y, z, s = 1.6) => { K.line(pen, S(-s, z, x, y), S(s, z, x, y), '#ffffff', 0.8); K.line(pen, [x, y, z - s], [x, y, z + s], '#ffffff', 0.8); };

// 고리 하나(각도 순서대로 점)
function ringOf(n, cx, cy, r, z, R, jit = 0.12, rot = 0) {
  return Array.from({ length: n }, (_, i) => { const f = (i / n) * TAU + rot, v = r * (1 - jit / 2 + R() * jit); return [cx + Math.cos(f) * v, cy + Math.sin(f) * v, z]; });
}
// 두 고리 사이 옆면: 보이는 면만 법선(왼쪽 아래 면은 밝게, 오른쪽 아래 면은 어둡게) 명암으로 칠한다. pal = [밝은 색, 어두운 색]
function band(pen, K, A, B, pal, R) {
  const n = A.length, faces = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ex = A[j][0] - A[i][0], ey = A[j][1] - A[i][1], L = Math.hypot(ex, ey) || 1, nx = ey / L, ny = -ex / L;
    if (nx + ny < -0.15) continue;
    const t = Math.max(-1, Math.min(1, (nx - ny) / 1.2));
    faces.push({ pts: [A[i], A[j], B[j], B[i]], k: A[i][0] + A[i][1] + A[j][0] + A[j][1], c: K.mix(K.mix(pal[0], pal[1], (t + 1) / 2), '#ffffff', R() * 0.12) });
  }
  faces.sort((a, b) => a.k - b.k);
  for (const f of faces) K.poly(pen, f.pts, f.c);
}
// 물가 모양: 반지름 비율 k(들쭉날쭉)와 p(2 = 동그라미, 3 = 둥근 네모)로 만든 가장자리 점
function shoreK(n, R, lo = 0.93, hi = 0.12) { return Array.from({ length: n }, () => lo + R() * hi); }
function shore(k, s, z, p = 2, ox = 0, oy = 0) {
  const n = k.length;
  return k.map((v, i) => { const f = ((i + 0.5) / n) * TAU, c = Math.abs(Math.cos(f)), d = Math.abs(Math.sin(f)), r = (s * v) / Math.pow(c ** p + d ** p, 1 / p); return [ox + Math.cos(f) * r, oy + Math.sin(f) * r, z]; });
}
// 물 색: 위(먼 쪽)가 조금 밝고 아래로 갈수록 짙은 세로 그라데이션
function waterFill(pen, r, cols) {
  const { ctx, P } = pen, g = ctx.createLinearGradient(0, P(-r, -r, 0)[1], 0, P(r, r, 0)[1]);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  return g;
}
// 물 위에 뜬 얼음 조각(납작한 판)
function floe(pen, K, x, y, r, R, z = -1) {
  const n = 7, k = Array.from({ length: n }, () => 0.78 + R() * 0.4);
  const ring = (s, zz, ox = 0, oy = 0) => k.map((v, i) => { const f = (i / n) * TAU; return [x + ox + Math.cos(f) * r * s * v, y + oy + Math.sin(f) * r * s * v * 0.95, zz]; });
  K.poly(pen, ring(1.04, z - 1.4), '#84c3e6');
  K.poly(pen, ring(1, z), '#e6f6ff');
  K.poly(pen, ring(0.62, z + 0.05, -r * 0.1, -r * 0.1), '#ffffff');
}

export const ITEM_ART = {
  // 얼음구멍: 얼음판에 뚫린 동그란 구멍. 바닥에 깔린다
  icehole(pen, R, K) {
    const k = shoreK(18, R, 0.94, 0.1);
    K.soft(pen, 0, 0, 20, '#6f9cc8', 0.42);
    K.poly(pen, shore(k, 15.2, 0), '#f6fbfe');
    K.poly(pen, shore(k, 12.8, 0), '#c6e6f8');
    K.poly(pen, shore(k, 10.8, 0), '#84c4e8'); // 안쪽 얼음 벽(뒤쪽만 보인다)
    K.poly(pen, shore(k, 9.8, -2.2), '#235f97');
    K.poly(pen, shore(k, 6.6, -2.2, 2, 1.2, 1.2), '#18497d');
    K.poly(pen, shore(k, 3.2, -2.2, 2, 2.4, 2.4), '#10355f');
    K.line(pen, [-7.2, -2, -2.2], [-3.4, -6.6, -2.2], '#7cc3ea', 1);
    K.line(pen, [-5, -1, -2.2], [-3, -3, -2.2], '#a9dcf4', 0.8);
    for (let i = 0; i < 4; i++) { const f = 0.5 + i * 1.6 + R() * 0.5; K.line(pen, [Math.cos(f) * 13.2, Math.sin(f) * 13.2, 0.1], [Math.cos(f + 0.12) * 17, Math.sin(f + 0.12) * 17, 0.1], '#a9cde6', 0.8); }
  },
  // 생선 양동이: 빨간 양동이에 물고기 꼬리가 삐죽
  fishbucket(pen, R, K) {
    sh(pen, K, 1, 1, 13, 0.34);
    const [tx, ty] = bucket(pen, K, 8.6, 11, 15, '#e2603f', '#4b2218');
    const { ctx, zoom } = pen, a1 = 11 * zoom;
    ctx.strokeStyle = '#3c4552'; ctx.lineWidth = 1.2 * zoom; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx - a1 + 0.5, ty); ctx.bezierCurveTo(tx - a1, ty - 14 * zoom, tx + a1, ty - 14 * zoom, tx + a1 - 0.5, ty); ctx.stroke();
    oval(pen, 0, 0, 15, 8.4, 3.8, '#7f9db6');
    const fs = [[-3.5, -1.5, '#6d93b3'], [2.5, -2.6, '#8aa9c0'], [4, 2.6, '#e08a78'], [-1, 1.4, '#7a9bb7']];
    fs.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    for (const [x, y, c] of fs) fish(pen, x, y, 20, 12, Math.PI / 2 + (R() - 0.5) * 1.1, c, '#e4eff6');
  },
  // 눈더미: 바람에 쓸려 길게 쌓인 눈 둔덕
  snowdrift(pen, R, K) {
    sh(pen, K, 4, 3, 18, 0.36);
    mound(pen, 5, 4, 12, 7, ['#e8f1f9', '#c3d8ec', '#9fbfdf']);
    mound(pen, -1, -1, 20, 14, ['#ffffff', '#ecf4fb', '#b9d2ea']);
    mound(pen, -8, -8, 9, 9, ['#ffffff', '#ffffff', '#e1edf8']);
    const { ctx, P, zoom } = pen;
    ctx.strokeStyle = '#b6cfe7'; ctx.lineWidth = 0.9 * zoom; ctx.lineCap = 'round';
    for (const [x, y, z, w] of [[2, 6, 3.5, 11], [-6, 5, 5.5, 8], [8, -2, 3.5, 7]]) {
      const [sx, sy] = P(x, y, z);
      ctx.beginPath(); ctx.moveTo(sx - w * zoom * 0.5, sy + zoom); ctx.quadraticCurveTo(sx, sy - 2 * zoom, sx + w * zoom * 0.5, sy + 0.5 * zoom); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) sparkle(pen, K, -10 + R() * 18, -8 + R() * 14, 7 + R() * 5, 1.3);
  },
  // 조약돌 둥지: 조약돌을 둥글게 쌓은 펭귄 둥지와 알 하나
  pebblenest(pen, R, K) {
    sh(pen, K, 0, 0, 14, 0.3);
    K.splat(pen, 0, 0, 14.5, '#d3e0ec', R, 14);
    K.splat(pen, 0, 0, 10, '#a9b3be', R, 12);
    const cols = ['#8a8d98', '#6b6f7b', '#a8a49c', '#c6c1b6', '#5b5f6b', '#b09b86', '#d8d4cc'];
    const items = [];
    for (let i = 0; i < 17; i++) {
      const f = (i / 17) * TAU + (R() - 0.5) * 0.2, r = 10 + R() * 2.4, x = Math.cos(f) * r, y = Math.sin(f) * r * 0.95;
      items.push({ k: x + y, d: () => K.lump(pen, x, y, 2.9 + R() * 1.7, 3 + R() * 2, cols[i % cols.length], R, { n: 6, top: 0.6 }) });
    }
    for (let i = 0; i < 5; i++) { const f = R() * TAU, r = R() * 7, x = Math.cos(f) * r, y = Math.sin(f) * r; items.push({ k: x + y - 6, d: () => K.lump(pen, x, y, 2 + R(), 1.8, cols[(i + 3) % cols.length], R, { n: 6 }) }); }
    items.push({ k: 0.5, d: () => { oval(pen, 0.5, 0.5, 0, 3.4, 1.7, 'rgba(60,70,95,0.4)'); oval(pen, 0, 0, 4, 3.1, 4.3, '#f6ecd6'); oval(pen, -0.9, -1, 5.2, 1.1, 1.6, '#ffffff'); } });
    items.sort((a, b) => a.k - b.k);
    for (const o of items) o.d();
  },
  // 바위 해안: 어두운 바위 무더기 위에 소복한 눈
  rockshore(pen, R, K) {
    sh(pen, K, 3, 3, 34, 0.34);
    K.splat(pen, 0, 0, 34, '#d6e4f0', R, 18);
    K.splat(pen, 0, 2, 28, '#c4d6e6', R, 16);
    const rocks = [[-8, -9, 18, 28, '#5b6172'], [13, 5, 13, 17, '#666c7d'], [-19, 12, 9, 10, '#525868'], [3, 20, 8, 8, '#6a7080'], [20, -14, 8, 9, '#575d6d']];
    rocks.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const [x, y, r, h, c] of rocks) {
      const top = K.lump(pen, x, y, r, h, c, R, { n: 9, top: 0.5 });
      const cx = top.reduce((s, p) => s + p[0], 0) / top.length, cy = top.reduce((s, p) => s + p[1], 0) / top.length;
      const ring = (s, z) => top.map(([px, py]) => [cx + (px - cx) * s, cy + (py - cy) * s, z]);
      K.poly(pen, ring(1.75, h - h * 0.2), '#cfe1f1');
      K.poly(pen, ring(1.4, h - h * 0.1), '#eef6fc');
      K.poly(pen, top, '#ffffff');
    }
    for (let i = 0; i < 6; i++) { const f = R() * TAU, r = 24 + R() * 8; K.puff(pen, Math.cos(f) * r, Math.sin(f) * r, 0.6, 1.1, '#ffffff'); }
  },
  // 물고기 통: 나무 상자에 은빛 물고기와 얼음이 가득
  fishcrate(pen, R, K) {
    sh(pen, K, 1, 1, 16, 0.34);
    K.box(pen, -12, -9, 24, 18, 11, ['#d6a468', '#b07a43', '#8a5a2e']);
    for (const z of [3.7, 7.3]) {
      K.line(pen, [-12, 9.05, z], [12, 9.05, z], '#6d4824', 0.9);
      K.line(pen, [12.05, -9, z], [12.05, 9, z], '#5a3a1c', 0.9);
    }
    K.poly(pen, [[-10.2, -7.2, 11.05], [10.2, -7.2, 11.05], [10.2, 7.2, 11.05], [-10.2, 7.2, 11.05]], '#4f3219');
    const fs = [];
    for (const [x, y] of [[-5, -2.5], [3, -3.5], [5.5, 1], [-2.5, 3], [-7, 2], [1, 0], [6, 4]]) fs.push([x + (R() - 0.5) * 1.6, y + (R() - 0.5) * 1.2, 11.4 + R() * 1.2, R()]);
    fs.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    const colsB = ['#6d93b3', '#86a8c0', '#e08a78', '#7898b6'];
    fs.forEach(([x, y, z, r], i) => fish(pen, x, y, z, 11.5, (r - 0.5) * 1.4 + (i % 2 ? Math.PI * 0.9 : 0.15), colsB[i % 4], '#e4eff6'));
    K.box(pen, -9.5, -6.5, 4, 3.4, 3, ['#f2fbff', '#c9e8f8', '#9fcfec'], 11);
    K.box(pen, 6, -6.4, 3.4, 3, 2.6, ['#f2fbff', '#c9e8f8', '#9fcfec'], 11);
  },
  // 얼음 틈 바다: 얼음 사이로 벌어진 짙은 푸른 바다. 바닥에 납작하게 깔린다(헤엄치는 동물이 이 위에 뜬다)
  sealead(pen, R, K) {
    const k = shoreK(30, R, 0.93, 0.12);
    K.soft(pen, 0, 0, 46, '#6f9cc8', 0.4);
    K.poly(pen, shore(k, 35, 0, 3.6), '#f6fbfe');
    K.poly(pen, shore(k, 32.4, 0, 3.6), '#c2e3f6');
    K.poly(pen, shore(k, 30.4, 0, 3.6), '#6aaedb'); // 안쪽 얼음 벽(뒤쪽만 보인다)
    K.poly(pen, shore(k, 29.2, -2.4, 3.6), waterFill(pen, 30, ['#2a77b0', '#1d5f98', '#154a7f']));
    K.poly(pen, shore(k, 20, -2.4, 3.6, 1, 1), 'rgba(12,48,92,0.35)');
    K.soft(pen, -9, -10, 18, '#8bd0f0', 0.28);
    const rip = [[-14, -12], [-4, 4], [12, -8], [8, 14], [-16, 10], [18, 6]];
    for (const [x, y] of rip) { K.line(pen, S(-4, -2.4, x, y), S(0, -2.4, x, y), '#6fb8e2', 0.9); K.line(pen, S(0, -2.4, x, y), S(4, -2.4, x, y), '#4f9cd0', 0.9); }
    floe(pen, K, -22, 17, 4.2, R, -2.2); floe(pen, K, 21, -19, 3.4, R, -2.2);
    for (let i = 0; i < 8; i++) { const f = R() * TAU; K.line(pen, [Math.cos(f) * 32, Math.sin(f) * 32, 0.1], [Math.cos(f + 0.1) * 37, Math.sin(f + 0.1) * 37, 0.1], '#a9cde6', 0.8); }
  },
  // 얼음 미끄럼틀: 계단으로 올라가 비탈로 쭉 미끄러지는 작은 얼음 놀이터
  iceslide(pen, R, K) {
    sh(pen, K, 3, 3, 20, 0.32);
    const T = '#f0fbff', Lt = '#bfe3f6', Dk = '#8dc1e2';
    K.box(pen, -14, -9, 12, 18, 17, [T, Lt, Dk]); // 윗단
    K.box(pen, -14, 9, 12, 3, 11, [T, Lt, Dk]); // 계단 둘째 칸
    K.box(pen, -14, 12, 12, 3, 6, [T, Lt, Dk]); // 계단 첫째 칸
    K.poly(pen, [[-2, 6, 17], [15, 6, 2], [15, 6, 0], [-2, 6, 0]], '#a4d1ec'); // 비탈 옆면
    K.poly(pen, [[15, -6, 2], [15, 6, 2], [15, 6, 0], [15, -6, 0]], Dk);
    K.poly(pen, [[-2, -6, 17], [15, -6, 2], [15, 6, 2], [-2, 6, 17]], '#d5f1ff'); // 미끄럼 면
    for (const y of [-3.6, 0, 3.6]) K.line(pen, [0, y, 15.4], [12, y, 4.6], '#ffffff', 0.9);
    K.line(pen, [-2, -6, 17.2], [15, -6, 2.2], '#ffffff', 1.5);
    K.line(pen, [-2, 6, 17.2], [15, 6, 2.2], '#7fb7de', 1.2);
    K.poly(pen, [[-12.5, -7.5, 17.06], [-3.5, -7.5, 17.06], [-3.5, 7.5, 17.06], [-12.5, 7.5, 17.06]], '#ffffff');
    sparkle(pen, K, -8, 0, 20, 1.6); sparkle(pen, K, 8, 0, 9, 1.4);
  },
  // 빙하 바위: 크고 푸른 빙하 덩어리. 아래는 짙은 푸른색, 위는 눈으로 하얗다
  glacier(pen, R, K) {
    sh(pen, K, 4, 4, 40, 0.34);
    K.splat(pen, 0, 0, 36, '#d3e4f2', R, 18);
    const A = ringOf(9, -5, -5, 27, 0, R, 0.12, 0.2), B = ringOf(9, -6, -6, 24, 22, R, 0.12, 0.2), C = ringOf(9, -8, -8, 17, 36, R, 0.14, 0.2).map(([x, y, z]) => [x, y, z - (x + y) * 0.15]);
    band(pen, K, A, B, ['#a8dcf6', '#3f8cc4'], R);
    band(pen, K, B, C, ['#dcf3fd', '#74b4de'], R);
    A.forEach((p, i) => {
      const f = (i / 9) * TAU + 0.2;
      if (Math.cos(f) + Math.sin(f) > 0.25 && i % 2 === 0) K.line(pen, mid(p, B[i], 0.08), mid(p, B[i], 0.78), '#3b86bf', 1);
    });
    K.poly(pen, C, '#f6fbff');
    K.poly(pen, C.map(([x, y, z]) => [x * 0.62 - 3, y * 0.62 - 3, z + 0.1]), '#ffffff');
    // 앞쪽에 떨어져 나온 작은 얼음덩이
    const A2 = ringOf(7, 17, 15, 9, 0, R, 0.15), B2 = ringOf(7, 17, 15, 7.5, 13, R, 0.15), C2 = ringOf(7, 16.5, 14.5, 5.5, 18, R, 0.15);
    band(pen, K, A2, B2, ['#a8dcf6', '#3f8cc4'], R); band(pen, K, B2, C2, ['#dcf3fd', '#74b4de'], R);
    K.poly(pen, C2, '#ffffff');
    sparkle(pen, K, -13, -3, 40, 2); sparkle(pen, K, 6, 5, 26, 1.6);
  },
  // 크릴 통: 파란 통에 분홍 크릴이 수북
  krill(pen, R, K) {
    sh(pen, K, 1, 1, 13, 0.34);
    bucket(pen, K, 8.6, 11, 14, '#3b83c6', '#8a3d4e');
    const { ctx, P, zoom } = pen;
    oval(pen, 0, 0, 14.2, 9.4, 4.6, '#f08a95'); // 수북한 크릴 더미
    oval(pen, -1.2, -1, 16.4, 7, 3.6, '#f6a0a8');
    oval(pen, -2, -1.6, 18.2, 4.2, 2.2, '#f9b4ba');
    const cols = ['#ff9aa3', '#f06f7d', '#ffc4c9', '#e85d70'];
    ctx.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const a = R() * TAU, r = Math.sqrt(R()) * 7.6, x = Math.cos(a) * r, y = Math.sin(a) * r, z = 14.4 + 3.6 * (1 - (r / 8.4) ** 2);
      const [sx, sy] = P(x, y, z), rot = R() * TAU, L = (2.6 + R() * 1.2) * zoom;
      ctx.strokeStyle = cols[i % 4]; ctx.lineWidth = 1.5 * zoom;
      ctx.beginPath(); ctx.arc(sx, sy, L * 0.5, rot, rot + 2.6); ctx.stroke();
      if (i % 5 === 0) { ctx.fillStyle = '#4a1f2b'; ctx.beginPath(); ctx.arc(sx + Math.cos(rot) * L * 0.5, sy + Math.sin(rot) * L * 0.5, 0.55 * zoom, 0, TAU); ctx.fill(); }
    }
    for (const [x, y, rot, c] of [[13, 6.5, 0.4, '#f06f7d'], [15.5, 4.5, 2.4, '#ff9aa3']]) { // 흘린 크릴
      const [sx, sy] = P(x, y, 0.5); ctx.strokeStyle = c; ctx.lineWidth = 1.3 * zoom; ctx.beginPath(); ctx.arc(sx, sy, 1.5 * zoom, rot, rot + 2.6); ctx.stroke();
    }
  },
  // 얼음 동굴: 얼음 돔과 어두운 입구
  icecave(pen, R, K) {
    const { ctx, P, zoom } = pen;
    sh(pen, K, 5, 5, 38, 0.36);
    K.splat(pen, 0, 0, 35, '#d8e7f3', R, 18);
    const [cx, cy] = P(-1, -1, 0), a = 31 * zoom, b = a * 0.5, H = 42 * zoom;
    const g = ctx.createRadialGradient(cx - a * 0.4, cy - H * 0.72, a * 0.1, cx - a * 0.1, cy - H * 0.35, a * 1.55);
    [[0, '#ffffff'], [0.38, '#e3f5fe'], [0.72, '#a9d5ef'], [1, '#5ea6d7']].forEach(([o, c]) => g.addColorStop(o, c));
    const dome = () => { ctx.beginPath(); ctx.moveTo(cx + a, cy); ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI); ctx.ellipse(cx, cy, a, H, 0, Math.PI, TAU); ctx.closePath(); };
    dome(); ctx.fillStyle = g; ctx.fill();
    ctx.save(); dome(); ctx.clip(); // 얼음결(돔 안쪽에만)
    ctx.lineCap = 'round';
    for (const [dx, w, col] of [[-0.62, 1.6, 'rgba(255,255,255,0.7)'], [-0.22, 1.2, 'rgba(70,130,190,0.28)'], [0.36, 1.4, 'rgba(70,130,190,0.3)'], [0.72, 1.2, 'rgba(255,255,255,0.35)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w * zoom; ctx.beginPath(); ctx.moveTo(cx + dx * a, cy + b * 0.7); ctx.quadraticCurveTo(cx + dx * a * 1.2, cy - H * 0.7, cx + dx * a * 0.35, cy - H * 0.96); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(70,130,190,0.28)'; ctx.lineWidth = 1.1 * zoom;
    for (const f of [0.34, 0.62]) { ctx.beginPath(); ctx.ellipse(cx, cy - H * f * 0.6, a * (1 - f * f) * 0.95, H * 0.12, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
    ctx.restore();
    // 입구(돔 앞면)
    const ex = cx + 3 * zoom, ey = cy + b * 0.74, w = 13 * zoom, h = 24 * zoom;
    const arch = (ww, hh, yy) => { ctx.beginPath(); ctx.moveTo(ex - ww, yy); ctx.lineTo(ex - ww, yy - hh * 0.55); ctx.bezierCurveTo(ex - ww, yy - hh * 1.12, ex + ww, yy - hh * 1.12, ex + ww, yy - hh * 0.55); ctx.lineTo(ex + ww, yy); ctx.ellipse(ex, yy, ww, ww * 0.42, 0, 0, Math.PI); ctx.closePath(); };
    arch(w, h, ey); ctx.fillStyle = '#f2fbff'; ctx.fill();
    arch(w * 0.84, h * 0.9, ey + 0.5 * zoom); ctx.fillStyle = '#7fbbe3'; ctx.fill();
    arch(w * 0.7, h * 0.82, ey + 0.8 * zoom);
    const ig = ctx.createLinearGradient(0, ey - h, 0, ey + 3 * zoom); ig.addColorStop(0, '#1d4a78'); ig.addColorStop(1, '#0a2142');
    ctx.fillStyle = ig; ctx.fill();
    ctx.fillStyle = 'rgba(95,170,225,0.35)'; ctx.beginPath(); ctx.ellipse(ex, ey + 1.6 * zoom, w * 0.52, w * 0.2, 0, 0, TAU); ctx.fill();
    K.box(pen, 22, 0, 7, 5, 4, ['#f2fbff', '#c9e8f8', '#9fcfec']);
    K.box(pen, -24, 16, 6, 5, 3, ['#f2fbff', '#c9e8f8', '#9fcfec']);
    sparkle(pen, K, -14, -14, 40, 2); sparkle(pen, K, 8, -10, 26, 1.5);
  },
  // 관측 깃발: 빨강·흰 줄무늬 막대에 주황 깃발, 아래에 돌무더기
  flag(pen, R, K) {
    sh(pen, K, 1.5, 1.5, 11, 0.34);
    mound(pen, 0, 0, 10, 4.5, ['#ffffff', '#e4eff8', '#b3cde6']);
    for (const [x, y, r, c] of [[5, 3, 3.4, '#5b6172'], [-4, 5, 3, '#6a7080'], [3, -4, 2.6, '#525868']]) K.lump(pen, x, y, r, r * 0.9, c, R, { n: 6, top: 0.55 });
    for (let i = 0; i < 9; i++) K.line(pen, [0, 0, 3 + i * 4.6], [0, 0, 3 + (i + 1) * 4.6], i % 2 ? '#ffffff' : '#d8402f', 1.9);
    K.puff(pen, 0, 0, 45.6, 1.5, '#d8402f');
    const top = (s) => 44 + Math.sin(s * 0.55) * 1.2 - s * 0.05, bot = (s) => 35.5 + Math.sin(s * 0.55 + 0.8) * 1.4 - s * 0.35;
    const up = [], dn = [];
    for (let s = 0; s <= 15; s += 2.5) { up.push(S(s, top(s))); dn.unshift(S(s, bot(s))); }
    K.poly(pen, [...up, ...dn], '#ff7a1a');
    const u2 = [], d2 = [];
    for (let s = 0; s <= 15; s += 2.5) { u2.push(S(s, bot(s) + 4.4)); d2.unshift(S(s, bot(s))); }
    K.poly(pen, [...u2, ...d2], '#e5560c');
    K.line(pen, S(0, 44), S(14, top(14)), '#ffb066', 0.9);
  },
  // 빙산: 뾰족한 봉우리 둘이 있는 키 큰 얼음. 물에 잠기는 아랫부분은 청록색
  iceberg(pen, R, K) {
    sh(pen, K, 4, 4, 34, 0.36);
    K.splat(pen, 0, 0, 33, '#cfe3f2', R, 18);
    K.splat(pen, 1, 2, 26, '#9ccdea', R, 14);
    const A = ringOf(7, -3, -3, 22, 0, R, 0.12, 0.3), A2 = A.map(([x, y]) => [x * 0.96 - 0.1, y * 0.96 - 0.1, 7]);
    const B = ringOf(7, -4, -4, 20, 24, R, 0.12, 0.3), C = ringOf(7, -6, -6, 14, 46, R, 0.12, 0.3);
    band(pen, K, A, A2, ['#7fd8e4', '#2f93b6'], R); // 물에 잠긴 청록 띠
    band(pen, K, A2, B, ['#b3e0f7', '#3f8cc4'], R);
    band(pen, K, B, C, ['#dff4fe', '#6ba9d8'], R);
    const apex = [-9, -9, 72];
    band(pen, K, C, C.map(() => apex), ['#f7fdff', '#a3d2ec'], R);
    // 앞쪽의 작은 봉우리
    const D = ringOf(7, 13, 11, 8.5, 18, R, 0.14, 0.3), D2 = ringOf(7, 13, 11, 9.5, 8, R, 0.14, 0.3);
    band(pen, K, D2, D, ['#b3e0f7', '#3f8cc4'], R);
    band(pen, K, D, D.map(() => [14, 11, 44]), ['#f0fbff', '#8ec6e6'], R);
    for (const [a, b, c] of [[C[1], apex, '#ffffff'], [C[2], mid(C[2], apex, 0.7), '#ffffff'], [B[1], C[1], '#6ba9d8']]) K.line(pen, a, b, c, 0.9);
    sparkle(pen, K, -9, -9, 64, 2.2); sparkle(pen, K, 13, 11, 40, 1.5);
  },
  // 눈사람: 숯 눈·당근 코·빨간 목도리·검은 모자·나뭇가지 팔
  snowman(pen, R, K) {
    sh(pen, K, 2, 2, 14, 0.36);
    ball(pen, 0, 0, 10, 11, '#ffffff', '#b4cde6');
    ball(pen, 0, 0, 24, 8, '#ffffff', '#b8d0e8');
    for (const [s, z, w] of [[-7.8, 25, 1.5], [7.8, 25, 1.5]]) K.line(pen, S(s, z), S(s * 2.15, z + (s < 0 ? 7 : 5)), '#6b4a2e', w);
    K.line(pen, S(-14.5, 28), S(-18, 33), '#6b4a2e', 1.1); K.line(pen, S(-14.5, 28), S(-18.5, 28), '#6b4a2e', 1.1);
    K.line(pen, S(14.6, 27), S(18, 31), '#6b4a2e', 1.1);
    ball(pen, 0, 0, 35.8, 6.3, '#ffffff', '#bad1e8');
    // 목도리
    const { ctx, P, zoom } = pen, [nx, ny] = P(0, 0, 30.3);
    ctx.fillStyle = '#d8402f'; ctx.beginPath(); ctx.ellipse(nx, ny, 6.8 * zoom, 2.7 * zoom, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#b8301f'; ctx.beginPath(); ctx.moveTo(nx + 3 * zoom, ny + 1.8 * zoom); ctx.lineTo(nx + 6.2 * zoom, ny + 3 * zoom); ctx.lineTo(nx + 7 * zoom, ny + 9 * zoom); ctx.lineTo(nx + 3.4 * zoom, ny + 8 * zoom); ctx.closePath(); ctx.fill();
    // 얼굴
    const [hx, hy] = P(0, 0, 35.8);
    ctx.fillStyle = '#20252f';
    for (const dx of [-2.3, 2.3]) { ctx.beginPath(); ctx.arc(hx + dx * zoom, hy - 0.8 * zoom, 0.95 * zoom, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#f08a2c'; ctx.beginPath(); ctx.moveTo(hx - 1 * zoom, hy + 0.6 * zoom); ctx.lineTo(hx + 1.2 * zoom, hy + 0.5 * zoom); ctx.lineTo(hx + 0.3 * zoom, hy + 5.2 * zoom); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#20252f';
    for (let i = 0; i < 4; i++) { const t = i / 3, a = 0.3 + t * 2.5; ctx.beginPath(); ctx.arc(hx + Math.cos(a) * 3.1 * zoom, hy + 2.3 * zoom + Math.sin(a) * 0.6 * zoom, 0.5 * zoom, 0, TAU); ctx.fill(); }
    const [bx, by] = P(0, 0, 22);
    ctx.fillStyle = '#20252f'; for (const dy of [-3.2, 0, 3.2]) { ctx.beginPath(); ctx.arc(bx + 0.3 * zoom, by + dy * zoom, 0.95 * zoom, 0, TAU); ctx.fill(); }
    // 모자
    K.disc(pen, 0, 0, 6.6, '#1e222b', 41);
    K.cyl(pen, 0, 0, 4.2, 6.2, '#2b303b', 41, '#394050');
    K.cyl(pen, 0, 0, 4.3, 1.6, '#d8402f', 41.6, '#e86a5a');
  },
  // 남극해: 넓게 펼쳐진 푸른 바다에 작은 얼음 조각이 떠 있다. 바닥에 납작하게 깔린다(헤엄치는 동물이 이 위에 뜬다)
  southsea(pen, R, K) {
    const k = shoreK(40, R, 0.94, 0.1);
    K.soft(pen, 0, 0, 70, '#6f9cc8', 0.36);
    K.poly(pen, shore(k, 51.5, 0, 3), '#f6fbfe');
    K.poly(pen, shore(k, 48.2, 0, 3), '#c2e3f6');
    K.poly(pen, shore(k, 46.2, 0, 3), '#6aaedb');
    K.poly(pen, shore(k, 45, -2.4, 3), waterFill(pen, 48, ['#3a8cc6', '#2977b2', '#1d6199']));
    K.soft(pen, -16, -18, 30, '#9ddcf5', 0.3);
    K.soft(pen, 18, 16, 26, '#154a7f', 0.25);
    for (let i = 0; i < 16; i++) {
      const x = (R() - 0.5) * 76, y = (R() - 0.5) * 76;
      K.line(pen, S(-4.5, -2.4, x, y), S(0, -2.4, x, y), '#8fd0ee', 0.9); K.line(pen, S(0, -2.4, x, y), S(4.5, -2.4, x, y), '#5da9db', 0.9);
    }
    for (const [x, y, r] of [[-26, -10, 5.5], [14, -26, 4.5], [24, 14, 6.2], [-8, 24, 4.2], [-30, 28, 3.4], [2, 2, 3.2]]) floe(pen, K, x, y, r, R, -2.2);
    for (let i = 0; i < 12; i++) { const f = R() * TAU; K.line(pen, [Math.cos(f) * 48, Math.sin(f) * 48, 0.1], [Math.cos(f + 0.08) * 54, Math.sin(f + 0.08) * 54, 0.1], '#a9cde6', 0.8); }
  },
  // 연구 기지: 빨간 벽에 눈 덮인 지붕, 문·창문과 안테나
  station(pen, R, K) {
    sh(pen, K, 2, 2, 19, 0.34);
    K.box(pen, -11, -9, 22, 18, 13, ['#e4574a', '#dc4d40', '#a93a30']);
    K.poly(pen, [[11, -9, 13], [11, 9, 13], [11, 0, 19.2]], '#a93a30');
    K.onY(pen, 9.05, -8.9, -1.1, 0, 10.2, '#f1f6fa');
    K.onY(pen, 9.1, -8, -2, 0, 9.4, '#2f4a6d');
    K.puff(pen, -3, 9.2, 4.6, 0.7, '#f0c14b');
    K.onY(pen, 9.05, 2, 9, 3.6, 10.3, '#f1f6fa');
    K.onY(pen, 9.1, 2.8, 8.2, 4.4, 9.5, '#9fd2ee');
    K.line(pen, [5.5, 9.15, 4.4], [5.5, 9.15, 9.5], '#f1f6fa', 0.8); K.line(pen, [2.8, 9.15, 7], [8.2, 9.15, 7], '#f1f6fa', 0.8);
    K.poly(pen, [[11.05, -6.5, 4.2], [11.05, -1.5, 4.2], [11.05, -1.5, 9.8], [11.05, -6.5, 9.8]], '#d7dfe7');
    K.poly(pen, [[11.1, -5.8, 4.9], [11.1, -2.2, 4.9], [11.1, -2.2, 9.1], [11.1, -5.8, 9.1]], '#6aa9cf');
    K.line(pen, [-11, 9.1, 0.5], [11, 9.1, 0.5], '#8f2e26', 1);
    // 안테나 (지붕 뒤쪽)
    K.line(pen, [6, -5, 15], [6, -5, 35], '#4b5563', 1.1);
    K.line(pen, S(-3.5, 31, 6, -5), S(3.5, 31, 6, -5), '#4b5563', 0.9); K.line(pen, S(-2.5, 34, 6, -5), S(2.5, 34, 6, -5), '#4b5563', 0.9);
    K.puff(pen, 6, -5, 36, 1.5, '#ff6a3d');
    // 지붕
    K.poly(pen, [[-13, -11, 13], [13, -11, 13], [13, 0, 20], [-13, 0, 20]], '#d6e6f3');
    K.poly(pen, [[-13, 0, 20], [13, 0, 20], [13, 11, 13], [-13, 11, 13]], '#ffffff');
    K.poly(pen, [[13, -11, 13], [13, 11, 13], [13, 0, 20]], '#b9cfe3');
    K.line(pen, [-13, 11, 13], [13, 11, 13], '#5b6b82', 1.6);
    K.line(pen, [13, 11, 13], [13, 0, 20], '#5b6b82', 1.2);
    K.line(pen, [-13, 0, 20.1], [13, 0, 20.1], '#a9c3dc', 1);
    // 굴뚝
    K.box(pen, -7, -5, 4, 4, 6, ['#9a4a3e', '#8a3f35', '#6f3028'], 17);
    K.puff(pen, -4.6, -2.6, 25.5, 1.8, 'rgba(255,255,255,0.8)'); K.puff(pen, -3.4, -2, 28.5, 2.4, 'rgba(255,255,255,0.6)');
    // 눈더미
    K.splat(pen, -3, 12.8, 7, '#dce8f4', R, 9, 0.1, 0.5); K.splat(pen, -3.4, 12.6, 5.6, '#ffffff', R, 9, 0.4, 0.5);
  },
};

export const ITEM_BOX = { // id: [반지름, 높이](월드 단위)
  icehole: [24, 4], fishbucket: [22, 24], snowdrift: [24, 18], pebblenest: [22, 10], rockshore: [48, 38],
  fishcrate: [24, 22], sealead: [48, 6], iceslide: [26, 22], glacier: [46, 46], krill: [22, 24],
  icecave: [48, 48], flag: [22, 50], iceberg: [44, 74], snowman: [22, 46], southsea: [72, 6], station: [24, 40],
};

export const FLOOR = ['icehole', 'sealead', 'southsea']; // 바닥에 깔리는 물건 id(동물보다 먼저 그린다)
