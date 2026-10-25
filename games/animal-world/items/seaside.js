// seaside 물건 그림 16종. 각 함수는 (pen, R, K): pen = { ctx, P, zoom }, R = 난수, K = art.js 도형 도구.
// 물건은 자기 바닥 가운데 (0,0)을 기준으로 그린다(한 칸 = 32 월드 단위, z는 위쪽). 빛은 왼쪽 위에서 온다.
const TAU = Math.PI * 2;
const RED = '#d9453c', CREAM = '#fbf3e2', WOODY = '#b98a4a';

// ---------- 도우미 ----------
// 부드러운 둥근 모양: 각도 → 반지름 배율. 층마다 같은 함수를 쓰면 안쪽 층이 바깥 층 안에 꼭 들어맞는다
function shapeOf(R, amp = 1) {
  const p2 = R() * TAU, p3 = R() * TAU, p5 = R() * TAU;
  return (a) => 1 + amp * (0.06 * Math.sin(2 * a + p2) + 0.045 * Math.sin(3 * a + p3) + 0.025 * Math.sin(5 * a + p5));
}
function blob(K, pen, x, y, r, fill, f, z = 0, n = 32) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = r * f(a); pts.push([x + Math.cos(a) * k, y + Math.sin(a) * k, z]); }
  K.poly(pen, pts, fill);
}
// 땅 위의 원(타원으로 보인다)을 선으로
function ring(pen, x, y, r, z, col, w = 0.8, a0 = 0, a1 = TAU) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z);
  ctx.strokeStyle = col; ctx.lineWidth = w * zoom; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(sx, sy, r * zoom, r * 0.5 * zoom, 0, a0, a1); ctx.stroke();
}
// a→b 방향의 물결선(결·잔물결)
function wave(K, pen, a, b, amp, cyc, col, w, z = 0.1) {
  const n = 10, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  let p = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, o = Math.sin(t * cyc * TAU) * amp, q = [a[0] + dx * t + nx * o, a[1] + dy * t + ny * o, z];
    if (p) K.line(pen, p, q, col, w);
    p = q;
  }
}
// 화면에서 수평으로 놓이는 짧은 줄(물결 반짝임)
const dash = (K, pen, x, y, len, col, w = 0.8, z = 0.1) => K.line(pen, [x, y, z], [x + len, y - len, z], col, w);
// 위로 갈수록 가늘어지는 원통(등대·바구니·통). cyl처럼 가로 그라데이션
function frustum(K, pen, r0, r1, z0, z1, col, top = null, cx = 0, cy = 0) {
  const { ctx, P, zoom } = pen, [bx, by] = P(cx, cy, z0), [tx, ty] = P(cx, cy, z1), rx0 = r0 * zoom, rx1 = r1 * zoom;
  const g = ctx.createLinearGradient(bx - rx0, 0, bx + rx0, 0);
  g.addColorStop(0, K.shade(col, 0.8)); g.addColorStop(0.3, K.shade(col, 1.04)); g.addColorStop(1, K.shade(col, 0.58));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(bx, by, rx0, r0 * 0.5 * zoom, 0, 0, Math.PI); ctx.lineTo(tx - rx1, ty);
  ctx.ellipse(tx, ty, rx1, r1 * 0.5 * zoom, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = top ?? K.shade(col, 1.12);
  ctx.beginPath(); ctx.ellipse(tx, ty, rx1, r1 * 0.5 * zoom, 0, 0, TAU); ctx.fill();
}
// 통 안쪽만 보이게: 테두리 타원 안쪽 + 그 위 허공에만 그린다(앞 테두리 아래로는 가려진다)
function openTop(pen, x, y, z, r, draw) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z);
  ctx.save(); ctx.beginPath();
  ctx.rect(sx - r * zoom * 4, sy - 400 * zoom, r * zoom * 8, 400 * zoom);
  ctx.ellipse(sx, sy, r * zoom, r * 0.5 * zoom, 0, 0, TAU);
  ctx.clip(); draw(); ctx.restore();
}
// 물고기(오른쪽을 본다, flip이면 왼쪽). rot = 화면 기울기(라디안)
function fish(K, pen, x, y, z, len, col, rot = 0, flip = false, stripe = null) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z), L = len * zoom, H = L * 0.34;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = K.shade(col, 0.82);
  ctx.beginPath(); ctx.moveTo(-L * 0.3, 0); ctx.lineTo(-L * 0.58, -H * 0.9); ctx.lineTo(-L * 0.5, 0); ctx.lineTo(-L * 0.58, H * 0.9); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-L * 0.08, -H * 0.4); ctx.lineTo(-L * 0.2, -H * 0.98); ctx.lineTo(L * 0.12, -H * 0.45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, L * 0.4, H * 0.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = K.mix(col, '#ffffff', 0.6); ctx.beginPath(); ctx.ellipse(L * 0.02, H * 0.24, L * 0.33, H * 0.26, 0, 0, TAU); ctx.fill();
  if (stripe) { ctx.fillStyle = stripe; ctx.beginPath(); ctx.ellipse(L * 0.1, 0, L * 0.05, H * 0.58, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#1e1712'; ctx.beginPath(); ctx.arc(L * 0.26, -H * 0.12, Math.max(0.6, L * 0.045), 0, TAU); ctx.fill();
  ctx.restore();
}
// 가리비(부채꼴 + 살결)
function scallop(K, pen, x, y, z, r, col, rot = 0) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z), r0 = r * zoom;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r0, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = K.shade(col, 0.8); ctx.lineWidth = Math.max(0.4, 0.45 * zoom); ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const a = Math.PI * (1.2 + i * 0.15); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r0 * 0.95, Math.sin(a) * r0 * 0.95); ctx.stroke(); }
  ctx.fillStyle = K.shade(col, 0.86); ctx.fillRect(-r0 * 0.24, -r0 * 0.1, r0 * 0.48, r0 * 0.24);
  ctx.restore();
}
// 소라(나선 뿔)
function conch(K, pen, x, y, z, s, col, rot = 0) {
  const { ctx, P, zoom } = pen, [sx, sy] = P(x, y, z), u = s * zoom;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot);
  ctx.fillStyle = K.shade(col, 0.9); ctx.beginPath(); ctx.moveTo(-u * 1.55, 0); ctx.lineTo(-u * 0.2, -u * 0.52); ctx.lineTo(-u * 0.2, u * 0.52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(u * 0.15, 0, u * 0.82, u * 0.56, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = K.mix(col, '#e0705e', 0.85); ctx.beginPath(); ctx.ellipse(u * 0.52, u * 0.1, u * 0.34, u * 0.24, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = K.shade(col, 0.74); ctx.lineWidth = Math.max(0.4, 0.4 * zoom); ctx.lineCap = 'round';
  for (const [px, hh] of [[-1.05, 0.2], [-0.7, 0.34], [-0.4, 0.46]]) { ctx.beginPath(); ctx.moveTo(px * u, -hh * u); ctx.lineTo(px * u, hh * u); ctx.stroke(); }
  ctx.restore();
}
// 불가사리(땅에 납작)
function starfish(K, pen, x, y, r, col, z = 0.2) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, k = i % 2 ? r * 0.44 : r; pts.push([x + Math.cos(a) * k, y + Math.sin(a) * k, z]); }
  K.poly(pen, pts, col);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; K.puff(pen, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, z + 0.1, 0.35, K.shade(col, 0.7)); }
}
// 따개비(작은 흰 원뿔 무리)
function barnacles(K, pen, R, cx, cy, z, spread, n, rad = 0.85) {
  for (let i = 0; i < n; i++) {
    const x = cx + (R() - 0.5) * spread, y = cy + (R() - 0.5) * spread;
    K.puff(pen, x, y, z + (R() - 0.5), rad, '#ece6d6');
    K.puff(pen, x, y, z + (R() - 0.5) + 0.15, rad * 0.45, '#8c8577');
  }
}
// 물에 뜬 해초 띠(바닥에서 위로 살짝 솟는다)
function ribbon(K, pen, x, y, ang, len, w, h, col, wig, ph) {
  const n = 12, A = [], B = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, along = t * len, side = Math.sin(t * wig + ph) * len * 0.12;
    const cx = x + Math.cos(ang) * along - Math.sin(ang) * side, cy = y + Math.sin(ang) * along + Math.cos(ang) * side;
    const nx = -Math.sin(ang), ny = Math.cos(ang), ww = w * (1 - t * 0.85) * 0.5, z = 0.4 + h * Math.sin(t * Math.PI * 0.5);
    A.push([cx + nx * ww, cy + ny * ww, z]); B.push([cx - nx * ww, cy - ny * ww, z]);
  }
  K.poly(pen, [...A, ...B.reverse()], col);
}
// 가지 산호(재귀로 갈라진다)
function branch(K, pen, R, x, y, z, th, ph, len, depth, col, w) {
  const x1 = x + Math.sin(ph) * Math.cos(th) * len, y1 = y + Math.sin(ph) * Math.sin(th) * len, z1 = z + Math.cos(ph) * len;
  K.line(pen, [x, y, z], [x1, y1, z1], col, w);
  if (depth <= 0) { K.puff(pen, x1, y1, z1 + 0.2, w * 0.7, K.shade(col, 1.18)); return; }
  for (const s of [-1, 1]) branch(K, pen, R, x1, y1, z1, th + s * (0.7 + R() * 0.7), Math.min(1.25, ph * 0.6 + 0.45 + R() * 0.2), len * 0.78, depth - 1, col, w * 0.78);
}

// ---------- 물건 ----------
export const ITEM_ART = {
  // 모래사장: 밝은 모래 한 조각 + 물결 모양 결 + 가리비·불가사리·소라
  sand(pen, R, K) {
    const f = shapeOf(R, 0.9);
    blob(K, pen, 0, 0, 14.9, '#dcc489', f);
    blob(K, pen, 0, 0, 13.9, '#f8ebc2', f);
    K.soft(pen, -3, -3, 10, '#fffbee', 0.6);
    for (const c of [-9, -3, 3, 9]) { const L = Math.sqrt((120 - c * c / 2) / 2) * 0.8; wave(K, pen, [c / 2 - L, c / 2 + L], [c / 2 + L, c / 2 - L], 0.7, 2, '#e4cf96', 0.7); }
    starfish(K, pen, -5.5, -6.5, 3.2, '#ee8a4e');
    scallop(K, pen, 5.5, 5.5, 0.2, 2.8, '#f3b7ae', -0.3);
    scallop(K, pen, -7.5, 3, 0.2, 2.3, '#fff2e0', 0.5);
    conch(K, pen, 6.5, -4.5, 0.3, 2.4, '#f6dcc6', 0.4);
    for (let i = 0; i < 6; i++) { const a = R() * TAU, r = 4 + R() * 8; K.puff(pen, Math.cos(a) * r, Math.sin(a) * r, 0.4, 0.7 + R() * 0.5, i % 2 ? '#ffffff' : '#d9cba6'); }
  },
  // 조개 더미: 모래 둔덕 위에 소라·가리비·고둥이 쌓여 있다
  shells(pen, R, K) {
    K.shadow(pen, 1, 1, 14, 0.24);
    K.lump(pen, 0, 0, 12.5, 4.5, '#f6e5b4', R, { top: 0.62, n: 10 });
    starfish(K, pen, 11, -8, 3, '#ee8a4e', 0.3);
    conch(K, pen, -2, -4, 6.5, 5, '#f4d9c2', 0.15);
    scallop(K, pen, 5.5, -2, 5.2, 4, '#fbf1e1', 0.25);
    scallop(K, pen, -8, 1.5, 4, 3.6, '#f3aea4', -0.3);
    conch(K, pen, 7.5, 4, 4.2, 3.4, '#f0b98a', 0.9);
    scallop(K, pen, 0, 4.5, 5, 3.9, '#f5c4a0', 0.05);
    scallop(K, pen, -3.5, 9.5, 2.6, 3.2, '#fbf1e1', -0.2);
    scallop(K, pen, 8, 10, 1.4, 2.6, '#d6c1ee', 0.35);
    scallop(K, pen, -9.5, 8.5, 1.4, 2, '#fff4e6', 0.4);
    scallop(K, pen, 3, 12.5, 0.6, 2.2, '#f3aea4', -0.1);
    for (let i = 0; i < 4; i++) { const a = R() * TAU, r = 7 + R() * 5; K.puff(pen, Math.cos(a) * r, Math.sin(a) * r, 1.6, 0.7 + R() * 0.4, ['#ffffff', '#f7d9c4'][i % 2]); }
  },
  // 갯바위: 젖어 짙은 바위 + 따개비 + 해초
  tiderock(pen, R, K) {
    K.shadow(pen, 1.5, 1.5, 15, 0.26);
    K.splat(pen, 0, 0, 14.2, 'rgba(150,126,86,0.55)', R, 14); // 젖은 모래
    K.lump(pen, -0.5, -1.5, 12, 16, '#586470', R, { top: 0.48 });
    K.lump(pen, 7.5, 7, 6.2, 7.5, '#657480', R, { n: 7 });
    K.lump(pen, -8.5, 7.5, 5, 5.5, '#4d5762', R, { n: 7 });
    K.puff(pen, -4.2, -6.5, 14.6, 1.8, 'rgba(210,235,245,0.55)'); // 젖은 윤기
    K.puff(pen, -1.2, -5.2, 15.8, 1, 'rgba(235,248,252,0.7)');
    barnacles(K, pen, R, 7, 7.5, 5.2, 7, 6, 0.8);
    barnacles(K, pen, R, 2, 10, 3.6, 8, 5, 0.8);
    barnacles(K, pen, R, 10, 1, 7.5, 3, 4, 0.7);
    K.tuft(pen, -13, 11, 8, '#46703a', R, 5);
    K.tuft(pen, -10, 14, 6, '#6b6a2c', R, 4);
    K.tuft(pen, 12, 11, 6, '#46703a', R, 4);
  },
  // 생선 바구니: 엮은 바구니 + 손잡이 + 삐져나온 물고기
  fishbasket(pen, R, K) {
    const { ctx, P, zoom } = pen, wood = '#c4924a';
    K.shadow(pen, 1, 1, 15, 0.26);
    frustum(K, pen, 10.2, 12.4, 0, 12.5, wood, '#5e4120');
    // 엮은 결: 가로 띠 + 번갈아 어긋난 세로 눈금
    for (const z of [3, 6.5, 10]) {
      const rz = 10.2 + (12.4 - 10.2) * (z / 12.5), [bx, by] = P(0, 0, z);
      ctx.strokeStyle = K.shade(wood, 0.66); ctx.lineWidth = 0.7 * zoom; ctx.beginPath(); ctx.ellipse(bx, by, rz * zoom, rz * 0.5 * zoom, 0, 0.05, Math.PI - 0.05); ctx.stroke();
    }
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
      const a = (i + (row % 2) * 0.5) / 9 * Math.PI * 0.78 + 0.14 * Math.PI, z0 = 0.4 + row * 3.5, rz = 10.4 + 2.2 * (z0 / 12.5);
      K.line(pen, [Math.cos(a) * rz, Math.sin(a) * rz, z0], [Math.cos(a) * (rz + 0.2), Math.sin(a) * (rz + 0.2), z0 + 2.6], K.shade(wood, 0.72), 0.6);
    }
    // 손잡이(바구니 뒤에서 솟는 둥근 고리)
    const [h0x, h0y] = P(-10.5, -4, 11), [h1x, h1y] = P(10.5, 4, 11), [hcx, hcy] = P(0, 0, 36);
    for (const [col, w] of [['#7a5226', 2.6], ['#d6a45a', 1.4]]) { ctx.strokeStyle = col; ctx.lineWidth = w * zoom; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(h0x, h0y); ctx.quadraticCurveTo(hcx, hcy, h1x, h1y); ctx.stroke(); }
    // 안쪽 + 물고기
    K.disc(pen, 0, 0, 11.2, '#4d3519', 12.5);
    openTop(pen, 0, 0, 12.5, 11.4, () => {
      fish(K, pen, -4.5, -3, 14.6, 14, '#7ea5c2', -0.75);
      fish(K, pen, 4, -4.5, 16.4, 14, '#e98b54', -1.15, true);
      fish(K, pen, -6.5, 3, 13.5, 13, '#b8cbd6', 0.55, true);
      fish(K, pen, 5, 3, 14, 13, '#d8605a', -0.3);
      fish(K, pen, 0, 6, 12.8, 12, '#8fb7a8', 0.15, true);
    });
    ring(pen, 0, 0, 12.4, 12.5, '#e1b062', 1.5, 0, Math.PI);
    ring(pen, 0, 0, 12.4, 12.5, '#a97a3e', 1.1, Math.PI, TAU);
  },
  // 얕은 물: 둘레 돌 + 맑은 물(바닥이 비친다). 수면은 평평하게
  tidepool(pen, R, K) {
    const f = shapeOf(R, 0.95);
    blob(K, pen, 0, 0, 30.5, '#cdb787', f);
    blob(K, pen, 0, 0, 28.5, '#8f8a7e', f);
    blob(K, pen, 0, 0, 26.3, '#79cfd4', f);
    blob(K, pen, 0, 0, 19.5, '#52b7cf', f);
    blob(K, pen, 0, 0, 11.5, '#3fa1c4', f);
    K.soft(pen, -8, -8, 18, '#d8f6f6', 0.55);
    // 물속 돌멩이와 모래결
    for (let i = 0; i < 6; i++) { const a = R() * TAU, r = 6 + R() * 15; K.splat(pen, Math.cos(a) * r, Math.sin(a) * r, 1.6 + R() * 1.4, 'rgba(60,110,130,0.35)', R, 7, 0.1); }
    starfish(K, pen, 7, 5, 3, 'rgba(238,138,78,0.85)', 0.15);
    for (const [x, y, rr] of [[-4, 1, 8], [8, -6, 5], [-9, 10, 4]]) ring(pen, x, y, rr, 0.2, 'rgba(255,255,255,0.45)', 0.7, Math.PI * 0.1, Math.PI * 1.1);
    for (const [x, y] of [[-9, -4], [4, 9], [10, 0], [-2, -12]]) dash(K, pen, x, y, 2.6, 'rgba(255,255,255,0.75)', 0.8);
    // 둘레 돌
    const stones = [];
    for (let i = 0; i < 13; i++) { const a = (i / 13) * TAU + R() * 0.3; stones.push([Math.cos(a) * 27.6 * f(a), Math.sin(a) * 27.6 * f(a)]); }
    stones.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    stones.forEach(([x, y], i) => K.lump(pen, x, y, 3.6 + R() * 2.2, 3 + R() * 2.4, ['#9d978b', '#aaa398', '#8a857b', '#b1a99c'][i % 4], R, { n: 6 }));
  },
  // 파라솔: 흰 기둥 + 줄무늬 둥근 지붕(가장자리가 물결 모양)
  parasol(pen, R, K) {
    K.shadow(pen, 5, 5, 17, 0.24);
    blob(K, pen, 0, 0, 7.5, '#f8ebc2', shapeOf(R, 1), 0.1, 16);
    K.lump(pen, 0, 0, 4.2, 1.8, '#f6e4b0', R, { n: 7, top: 0.6 });
    K.line(pen, [0, 0, 1], [0, 0, 40], '#f2ecde', 1.9);
    K.line(pen, [0.5, 0.5, 1], [0.5, 0.5, 38], '#cfc7b3', 0.6);
    const rr = 21, zr = 31, apex = [0, 0, 42], n = 8, wedges = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + 0.2, a1 = ((i + 1) / n) * TAU + 0.2, am = (a0 + a1) / 2, pts = [apex];
      for (let j = 0; j <= 4; j++) {
        const a = a0 + (a1 - a0) * (j / 4), s = Math.sin(Math.PI * j / 4);
        pts.push([Math.cos(a) * rr * (1 - 0.025 * s), Math.sin(a) * rr * (1 - 0.025 * s), zr - 2.8 * s]);
      }
      const lit = (Math.sin(am) - Math.cos(am)) / 1.414, base = i % 2 ? CREAM : '#ee5f6e';
      wedges.push({ pts, key: Math.cos(am) + Math.sin(am), col: lit >= 0 ? K.mix(base, '#ffffff', 0.16 * lit) : K.mix(base, i % 2 ? '#e3b7a6' : '#b8344c', -0.5 * lit), a0 });
    }
    wedges.sort((p, q) => p.key - q.key);
    for (const w of wedges) K.poly(pen, w.pts, w.col);
    for (const w of wedges) K.line(pen, apex, [Math.cos(w.a0) * rr, Math.sin(w.a0) * rr, zr], 'rgba(120,40,40,0.28)', 0.5);
    K.puff(pen, 0, 0, 43.2, 1.7, '#f6d98a');
  },
  // 갯벌: 젖은 흙 + 물결 모양 결 + 고인 물 + 갯지렁이 구멍
  mudflat(pen, R, K) {
    const f = shapeOf(R, 1);
    blob(K, pen, 0, 0, 30, '#c9ad79', f);
    blob(K, pen, 0, 0, 28.5, '#9c7b57', f);
    blob(K, pen, 0, 0, 22, '#8b6b4a', f);
    K.soft(pen, -7, -7, 17, '#b69674', 0.5);
    for (const c of [-22, -14, -6, 2, 10, 18]) {
      const L = Math.sqrt(Math.max(0, (22 * 22 - c * c / 2) / 2)) * 0.9;
      wave(K, pen, [c / 2 - L, c / 2 + L], [c / 2 + L, c / 2 - L], 1.1, 2.5, '#6d5039', 0.9);
      wave(K, pen, [c / 2 - L + 0.8, c / 2 + L + 0.8], [c / 2 + L + 0.8, c / 2 - L + 0.8], 1.1, 2.5, '#b79a78', 0.6);
    }
    // 고인 물(하늘이 비친다)
    const pools = [[-8, -4, 6.5], [9, 5, 5], [-3, 12, 4], [12, -10, 3.4]];
    for (const [x, y, rr] of pools) {
      const g = shapeOf(R, 1.4);
      blob(K, pen, x, y, rr, '#6a5037', g, 0.1);
      blob(K, pen, x, y, rr * 0.82, '#9fbfc6', g, 0.15);
      dash(K, pen, x - rr * 0.3, y - rr * 0.1, rr * 0.5, 'rgba(255,255,255,0.8)', 0.8, 0.2);
    }
    // 갯지렁이 구멍과 흙 덩이
    for (let i = 0; i < 12; i++) {
      const a = R() * TAU, r = 3 + R() * 19, x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (pools.some(([px, py, rr]) => Math.hypot(x - px, y - py) < rr + 2)) continue;
      K.puff(pen, x, y, 0.2, 1.15, '#a58762'); K.puff(pen, x, y + 0.2, 0.3, 0.7, '#3d2c1c');
    }
    for (let i = 0; i < 4; i++) { const a = R() * TAU, r = 6 + R() * 15; K.lump(pen, Math.cos(a) * r, Math.sin(a) * r, 2.2, 1.2, '#7b5d40', R, { n: 6 }); }
    K.tuft(pen, 17, 15, 5, '#6c7d3a', R, 4);
  },
  // 부표: 나무 받침대 위의 빨강·흰 줄무늬 부표 + 꼭대기 등
  buoy(pen, R, K) {
    const { ctx, P, zoom } = pen, wood = '#a67c46';
    K.shadow(pen, 2.5, 2.5, 17, 0.26);
    K.box(pen, -12, -12, 24, 24, 2.4, [K.shade(wood, 1.1), K.shade(wood, 0.9), K.shade(wood, 0.7)]);
    // 받침 다리 네 개가 둥근 부표를 받친다(뒤·옆 다리는 부표 뒤로, 앞다리는 앞으로)
    const legs = [[-10, -10], [10, -10], [-10, 10], [10, 10]], tip = (x, y) => [x * 0.5, y * 0.5, 11];
    for (const [x, y] of legs.slice(0, 3)) K.line(pen, [x, y, 2.4], tip(x, y), wood, 2.4);
    // 둥근 몸통: 빨강·흰 가로 줄무늬(위도선을 따라 휘어진다)
    const cz = 18, rad = 10.5, [cx, cy] = P(0, 0, cz), r = rad * zoom, far = r * 2.6;
    const lat = (dz) => ({ y: cy - dz * r, rl: Math.sqrt(1 - dz * dz) * r });
    const band = (dA, dB, col) => {
      ctx.fillStyle = col; ctx.beginPath();
      if (dA === null) { ctx.moveTo(cx - far, cy - far); ctx.lineTo(cx + far, cy - far); ctx.lineTo(cx + far, lat(dB).y); }
      else { const a = lat(dA); ctx.moveTo(cx - far, a.y); ctx.lineTo(cx - a.rl, a.y); ctx.ellipse(cx, a.y, a.rl, a.rl * 0.5, 0, Math.PI, 0, true); ctx.lineTo(cx + far, a.y); ctx.lineTo(cx + far, dB === null ? cy + far : lat(dB).y); }
      if (dB === null) ctx.lineTo(cx - far, cy + far);
      else { const b = lat(dB); ctx.lineTo(cx + b.rl, b.y); ctx.ellipse(cx, b.y, b.rl, b.rl * 0.5, 0, 0, Math.PI, false); ctx.lineTo(cx - far, b.y); }
      ctx.closePath(); ctx.fill();
    };
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    band(null, 0.5, RED); band(0.5, 0.05, CREAM); band(0.05, -0.42, RED); band(-0.42, null, CREAM);
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.1, cx, cy, r * 1.02);
    g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(40,10,30,0.36)');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy - r * 0.46, r * 0.14, r * 0.09, -0.7, 0, TAU); ctx.fill();
    // 꼭대기 고리·기둥·등
    K.line(pen, [0, 0, cz + rad - 0.5], [0, 0, 36], '#5b4a3a', 1.3);
    K.cyl(pen, 0, 0, 2.3, 3.4, '#f2c75a', 35, '#fff1b0');
    K.puff(pen, 0, 0, 38.5, 5, 'rgba(255,232,140,0.32)');
    K.puff(pen, 0, 0, 38.5, 2.2, '#fff0a8');
    // 앞다리가 부표 앞을 지난다
    K.line(pen, [10, 10, 2.4], tip(10, 10), wood, 2.4);
  },
  // 다시마 숲: 짙은 바닷물 + 물 위로 솟은 다시마 띠와 황금빛 부레
  kelp(pen, R, K) {
    const f = shapeOf(R, 0.95);
    blob(K, pen, 0, 0, 30.5, '#9fd2bd', f);
    blob(K, pen, 0, 0, 28.8, '#43a3a8', f);
    blob(K, pen, 0, 0, 22.5, '#2f8c9d', f);
    blob(K, pen, 0, 0, 13, '#277586', f);
    K.soft(pen, -9, -9, 18, '#bfece8', 0.35);
    // 물속에 비치는 그림자 같은 다시마
    for (let i = 0; i < 9; i++) { const a = R() * TAU, r = R() * 20; K.splat(pen, Math.cos(a) * r, Math.sin(a) * r, 2.5 + R() * 3, 'rgba(20,76,56,0.42)', R, 8, 0.1, 0.8); }
    const fronds = [[-14, -2, 0.5], [-5, -12, -0.6], [8, -10, 0.9], [14, 3, -0.4], [4, 10, 2.5], [-10, 11, -2.2], [-1, -1, 1.7], [11, -3, -2.8], [-18, -10, 0.2], [0, 16, -1.2], [-6, 3, -0.5], [17, -12, 2.1]];
    fronds.forEach(([x, y, ang], i) => {
      const len = 13 + R() * 6, h = 3 + R() * 4;
      ribbon(K, pen, x, y, ang, len, 4.6, h, i % 2 ? '#4d8a2e' : '#5f9a36', 3 + R() * 2, R() * 6);
      ribbon(K, pen, x + 0.4, y - 0.4, ang, len * 0.75, 1.5, h + 0.5, i % 2 ? '#95bf55' : '#a8cc62', 3, R() * 6);
      K.puff(pen, x, y, 0.8, 1.25, '#d4a73a'); K.puff(pen, x - 0.3, y - 0.4, 1.3, 0.5, '#f1d27a');
    });
    for (const [x, y] of [[-8, 4], [9, -6], [2, 14]]) dash(K, pen, x, y, 2.6, 'rgba(255,255,255,0.7)', 0.8);
  },
  // 물고기 통: 파란 통 + 물 + 팔딱이는 물고기
  fishtub(pen, R, K) {
    const { ctx, P, zoom } = pen, blue = '#3e86c9';
    K.shadow(pen, 1, 1, 15, 0.26);
    frustum(K, pen, 10.8, 13, 0, 11, blue, '#7db6ec');
    // 옆면 홈과 손잡이
    for (const z of [3.5, 7.5]) { const rz = 10.8 + 2.2 * (z / 11), [bx, by] = P(0, 0, z); ctx.strokeStyle = 'rgba(20,60,110,0.35)'; ctx.lineWidth = 0.7 * zoom; ctx.beginPath(); ctx.ellipse(bx, by, rz * zoom, rz * 0.5 * zoom, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
    for (const s of [-1, 1]) { const x = 12.9 * 0.7071 * s, y = -12.9 * 0.7071 * s; K.line(pen, [x, y, 9], [x * 1.18, y * 1.18, 9.8], '#2c639c', 2.2); K.line(pen, [x * 1.18, y * 1.18, 9.8], [x * 1.18, y * 1.18, 7], '#2c639c', 2.2); }
    K.disc(pen, 0, 0, 11.6, '#2a5f9a', 11);
    K.disc(pen, 0, 0, 10.2, '#62bfe6', 9.2);
    K.soft(pen, -3, -3, 6, '#d9f4fb', 0.5);
    ring(pen, 0, 0, 5.5, 9.3, 'rgba(255,255,255,0.45)', 0.7, Math.PI * 0.2, Math.PI * 1.2);
    openTop(pen, 0, 0, 9.2, 10.4, () => {
      fish(K, pen, -3.5, -1, 9.6, 11, '#aac5d8', 0.12);
      fish(K, pen, 3.5, 2.5, 9.8, 10.5, '#f0963f', -0.1, true);
      fish(K, pen, 1, -4.5, 10, 9.5, '#e8d468', 0.3);
      fish(K, pen, -1.5, 5, 10, 9, '#c9d7e0', -0.2, true);
    });
    ring(pen, 0, 0, 12.9, 11, '#9ccaf2', 1.4, 0, Math.PI);
    // 튀어 오르는 물방울
    K.puff(pen, 2, -6, 15, 0.9, '#cdeefb'); K.puff(pen, -3, -7, 17, 0.6, '#cdeefb'); K.puff(pen, 5, -3, 13.5, 0.6, '#cdeefb');
  },
  // 바위 해안: 우뚝한 바위 무리 + 파도에 젖은 웅덩이 + 따개비·해초
  rockyshore(pen, R, K) {
    K.shadow(pen, 4, 4, 32, 0.24);
    const f = shapeOf(R, 0.9);
    blob(K, pen, 0, 0, 30, 'rgba(150,124,84,0.5)', f);
    blob(K, pen, 0, 2, 25, '#7b766f', f);
    // 웅덩이 두 개(오목한 바위 틈)
    for (const [x, y, rr] of [[3, 8, 10], [-15, 18, 5.2]]) {
      const g = shapeOf(R, 1.2);
      blob(K, pen, x, y, rr, '#4b4f55', g, 0.2);
      blob(K, pen, x, y, rr * 0.84, '#5fbdd2', g, 0.3);
      blob(K, pen, x, y, rr * 0.5, '#46a6c4', g, 0.35);
      K.soft(pen, x - rr * 0.3, y - rr * 0.3, rr * 0.8, '#d6f4f6', 0.45);
      dash(K, pen, x - rr * 0.45, y - rr * 0.1, rr * 0.5, 'rgba(255,255,255,0.85)', 0.8, 0.4);
    }
    starfish(K, pen, 6.5, 10.5, 2.8, '#ee8a4e', 0.5);
    const rocks = [
      [-9, -11, 16, 30, '#9a9086', 0.5], [14, -10, 11, 21, '#8a8886', 0.5], [-20, 2, 9, 14, '#9d9285', 0.5],
      [22, 7, 6.5, 9, '#7d7873', 0.55], [-6, 25, 6, 6.5, '#8f8578', 0.55], [18, 20, 5, 5.5, '#857e76', 0.55],
    ];
    rocks.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    for (const [x, y, r, h, c, top] of rocks) K.lump(pen, x, y, r, h, c, R, { top });
    barnacles(K, pen, R, -1, -1, 7, 7, 7, 0.85);
    barnacles(K, pen, R, 21, 5, 6, 4, 4, 0.8);
    barnacles(K, pen, R, -17, 8, 7, 5, 4, 0.8);
    K.tuft(pen, -2, 22, 8, '#46703a', R, 6);
    K.tuft(pen, 24, 15, 6, '#6b6a2c', R, 4);
    K.tuft(pen, -25, 12, 7, '#46703a', R, 4);
    K.tuft(pen, 9, 20, 5, '#6b6a2c', R, 3);
  },
  // 비치볼: 여섯 조각 색 공 + 반짝임
  beachball(pen, R, K) {
    const { ctx, P, zoom } = pen;
    K.disc(pen, 0, 0, 7, 'rgba(150,120,70,0.35)', 0.1);
    K.shadow(pen, 3.5, 3.5, 11.5, 0.3);
    const [cx, cy] = P(0, 0, 10.5), r = 10 * zoom;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    const px = cx + r * 0.1, py = cy - r * 0.62, cols = ['#ee4a4a', '#fff4de', '#2f8fe3', '#f7c62e', '#fff4de', '#35b873'];
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU + 0.5, a1 = ((i + 1) / 6) * TAU + 0.5, am = (a0 + a1) / 2;
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a0) * r * 3, py + Math.sin(a0) * r * 3);
      ctx.quadraticCurveTo(px + Math.cos(am) * r * 3.6 + Math.sin(am) * r * 0.9, py + Math.sin(am) * r * 3.6 - Math.cos(am) * r * 0.9, px + Math.cos(a1) * r * 3, py + Math.sin(a1) * r * 3);
      ctx.closePath(); ctx.fill();
    }
    const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.1, cx, cy, r * 1.02);
    g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(30,20,60,0.34)');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(px, py, r * 0.1, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy - r * 0.42, r * 0.16, r * 0.1, -0.7, 0, TAU); ctx.fill();
  },
  // 석호: 큰 청록빛 물(가장자리 거품·얕은 물에서 깊은 물로) + 반짝임
  lagoon(pen, R, K) {
    const f = shapeOf(R, 0.8);
    blob(K, pen, 0, 0, 45.5, '#d8bf80', f);
    blob(K, pen, 0, 0, 43.8, '#f7fcf6', f);
    blob(K, pen, 0, 0, 42, '#9fe8d9', f);
    blob(K, pen, 0, 0, 34, '#5fd3cf', f);
    blob(K, pen, 0, 0, 25.5, '#33b8c8', f);
    blob(K, pen, 0, 0, 16, '#2299b9', f);
    K.soft(pen, -14, -14, 30, '#e4fbf3', 0.5);
    K.soft(pen, 10, 12, 20, '#1b7fa6', 0.25);
    // 가장자리 거품
    for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU + R() * 0.2, k = 43.3 * f(a); K.puff(pen, Math.cos(a) * k, Math.sin(a) * k, 0.3, 0.9 + R() * 0.8, '#ffffff'); }
    // 잔물결과 반짝임
    for (const [x, y, rr, a0] of [[-12, -4, 12, 0.1], [14, 6, 9, 0.9], [-2, 18, 11, 0.4], [6, -16, 8, 0.2], [-22, 8, 7, 0.6]]) ring(pen, x, y, rr, 0.2, 'rgba(255,255,255,0.45)', 0.8, Math.PI * a0, Math.PI * (a0 + 0.95));
    for (let i = 0; i < 14; i++) { const a = R() * TAU, r = R() * 32; dash(K, pen, Math.cos(a) * r, Math.sin(a) * r, 2.2 + R() * 2.2, 'rgba(255,255,255,0.78)', 0.8); }
    // 물속 모래 얼룩
    for (let i = 0; i < 6; i++) { const a = R() * TAU, r = 18 + R() * 12; K.splat(pen, Math.cos(a) * r, Math.sin(a) * r, 3 + R() * 3, 'rgba(255,240,190,0.28)', R, 8, 0.1, 0.8); }
    // 가장자리 돌과 풀 몇 개
    for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.95 + R() * Math.PI * 0.7, k = 44.5 * f(a); K.lump(pen, Math.cos(a) * k, Math.sin(a) * k, 3 + R() * 2, 2.4 + R() * 2, ['#a8a094', '#b6ae9f', '#928c80'][i % 3], R, { n: 6 }); }
    K.tuft(pen, -38, -12, 9, '#7ea04a', R, 6); K.tuft(pen, -34, -22, 7, '#7ea04a', R, 5);
  },
  // 물고기 먹이대: 말뚝 위 나무 발판 + 난간 + 물고기 가득한 여물통과 양동이
  fishfeeder(pen, R, K) {
    K.shadow(pen, 2.5, 2.5, 20, 0.24);
    for (const [x, y] of [[-12, 11], [11, 11], [11, -12]]) K.box(pen, x, y, 2.2, 2.2, 8.5, '#6f4a2a');
    const deck = [K.shade(WOODY, 1.12), K.shade(WOODY, 0.86), K.shade(WOODY, 0.66)];
    K.box(pen, -14, -14, 28, 28, 3, deck, 8);
    for (let i = 1; i < 6; i++) K.line(pen, [-14 + i * 4.67, -14, 11.1], [-14 + i * 4.67, 14, 11.1], K.shade(WOODY, 0.78), 0.6);
    K.line(pen, [-14, 14, 9.5], [14, 14, 9.5], K.shade(WOODY, 0.7), 0.6);
    // 뒤쪽 난간
    for (const [x, y] of [[-13, -13], [-13, 12], [12, -13]]) K.box(pen, x, y, 1.8, 1.8, 9, '#7c5230', 11);
    K.box(pen, -13, -13, 1.6, 26, 1.4, '#946539', 18);
    K.box(pen, -13, -13, 26, 1.6, 1.4, '#a8743f', 18);
    // 여물통(뒤쪽 왼편) + 물고기
    K.box(pen, -11, -8, 17, 11, 6, ['#a47443', '#86592f', '#6e4626'], 11);
    K.poly(pen, [[-10, -7, 16.7], [5, -7, 16.7], [5, 1, 16.7], [-10, 1, 16.7]], '#4a3220');
    openTop(pen, -2.5, -3, 17.2, 8.5, () => {
      fish(K, pen, -6.5, -3, 18.8, 11, '#aac5d8', -0.5);
      fish(K, pen, -0.5, -4.5, 19.6, 11, '#f0963f', -0.95, true);
      fish(K, pen, 2, -1, 18.2, 10, '#e8d468', 0.25);
      fish(K, pen, -5, 0, 18, 10, '#d8605a', 0.1, true);
    });
    // 양동이(앞쪽 오른편)
    K.cyl(pen, 6.5, 6.5, 3.6, 5, '#3e86c9', 11, '#26578c');
    K.disc(pen, 6.5, 6.5, 2.7, '#5ab9e0', 15.6);
    fish(K, pen, 6.2, 6, 16.4, 6.5, '#f0963f', -0.8);
    // 바닥에 놓인 물고기와 먹이 알갱이
    fish(K, pen, -4, 8.5, 11.5, 8.5, '#8fb7a8', 0.2, true);
    fish(K, pen, 8, -4, 11.5, 8, '#e8d468', -0.15);
    for (const [x, y] of [[0, 10], [2.5, 12], [-9, 6], [10, 2], [12, 5]]) K.puff(pen, x, y, 11.4, 0.7, '#e8d9a8');
  },
  // 산호초: 맑은 물밑에 가지·부채·뇌·탁자 산호와 작은 열대어
  reef(pen, R, K) {
    const f = shapeOf(R, 0.95);
    blob(K, pen, 0, 0, 31, '#dcc686', f);
    blob(K, pen, 0, 0, 29.4, '#7fd5d6', f);
    blob(K, pen, 0, 0, 24, '#47b3cd', f);
    blob(K, pen, 0, 0, 15, '#2d93bb', f);
    K.soft(pen, -9, -9, 18, '#d4f6f6', 0.4);
    // 산호(뒤에서 앞으로)
    const spots = [
      [-6, -16, 'brain', '#e8728a'], [10, -12, 'branch', '#f59a4a'], [-19, -3, 'fan', '#a77ad8'], [20, -2, 'branch', '#9b6fd0'],
      [2, -1, 'table', '#f2cf50'], [-12, 9, 'branch', '#ee6f78'], [13, 10, 'brain', '#f4a35c'], [-1, 15, 'fan', '#e86f9d'], [-17, 17, 'branch', '#5cc8a0'], [7, 21, 'branch', '#f0707a'],
    ];
    spots.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    for (const [x, y, kind, col] of spots) {
      K.soft(pen, x, y, 6, '#1d5a73', 0.28);
      if (kind === 'branch') { for (let i = 0; i < 3; i++) branch(K, pen, R, x + (i - 1) * 2.2, y + (R() - 0.5) * 2, 0.4, R() * TAU, 0.3 + R() * 0.25, 4, 2, K.shade(col, 0.9 + i * 0.1), 1.6); }
      else if (kind === 'brain') {
        K.lump(pen, x, y, 6, 4.4, col, R, { n: 9, top: 0.72 });
        for (let i = 0; i < 4; i++) wave(K, pen, [x - 2.6 + i * 0.4, y - 2.6 + i * 1.6], [x + 2.2 + i * 0.4, y - 3 + i * 1.6], 0.5, 2, K.shade(col, 0.72), 0.6, 4.6);
      } else if (kind === 'fan') {
        K.line(pen, [x, y, 0.3], [x, y, 3.2], K.shade(col, 0.7), 1.1);
        scallop(K, pen, x, y, 2.8, 7.2, col, 0);
      } else {
        K.cyl(pen, x, y, 1.6, 4, K.shade(col, 0.75), 0, K.shade(col, 0.9));
        K.cyl(pen, x, y, 7, 1.5, col, 4, K.shade(col, 1.12));
        K.disc(pen, x, y, 4.2, K.shade(col, 1.2), 5.6);
      }
    }
    // 말미잘 + 흰동가리, 블루탱
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; K.line(pen, [-24 + Math.cos(a) * 0.8, 10 + Math.sin(a) * 0.8, 0.4], [-24 + Math.cos(a) * 2.2, 10 + Math.sin(a) * 2.2, 3.4], '#f08ab0', 0.8); }
    fish(K, pen, -22, 9, 5.6, 6, '#f08a30', -0.1, false, '#fffaf0');
    fish(K, pen, 9, 14, 4.5, 6.5, '#3f7fe0', 0.1, true);
    fish(K, pen, -3, -4, 7.5, 5.5, '#f2cf50', -0.2, false);
    for (const [x, y] of [[-8, 14], [8, -2], [-3, 8]]) { ring(pen, x, y, 2.4, 0.2, 'rgba(255,255,255,0.5)', 0.6); K.puff(pen, x + 4, y - 5, 8, 0.7, 'rgba(255,255,255,0.7)'); }
  },
  // 등대: 빨강·흰 줄무늬 탑 + 난간 있는 둘레 + 노란 불빛 + 빨간 지붕
  lighthouse(pen, R, K) {
    const { ctx, P, zoom } = pen, WHITE = '#f7f2ea', DARK = '#3f4a58';
    const rAt = (z) => 11 + (6.8 - 11) * (z - 5) / 51;
    K.shadow(pen, 6, 6, 21, 0.24);
    K.lump(pen, 0, 0, 15.5, 6.5, '#8d8a85', R, { top: 0.74 });
    K.lump(pen, 11, 8, 5, 4, '#7c7974', R, { n: 6 });
    // 탑 몸통
    const bands = [[5, 17, WHITE], [17, 29, RED], [29, 41, WHITE], [41, 56, RED]];
    for (const [z0, z1, c] of bands) frustum(K, pen, rAt(z0), rAt(z1), z0, z1, c, c === RED ? '#e8625a' : '#fffdf6');
    // 문과 창
    const door = P(0.7071 * rAt(6), 0.7071 * rAt(6), 5.2);
    ctx.fillStyle = '#4a3322'; ctx.beginPath(); ctx.moveTo(door[0] - 2.2 * zoom, door[1]); ctx.lineTo(door[0] - 2.2 * zoom, door[1] - 5 * zoom); ctx.arc(door[0], door[1] - 5 * zoom, 2.2 * zoom, Math.PI, 0); ctx.lineTo(door[0] + 2.2 * zoom, door[1]); ctx.closePath(); ctx.fill();
    for (const z of [23, 35, 48]) {
      const w = P(0.7071 * rAt(z), 0.7071 * rAt(z), z);
      ctx.fillStyle = DARK; ctx.beginPath(); ctx.moveTo(w[0] - 1.5 * zoom, w[1] + 1.8 * zoom); ctx.lineTo(w[0] - 1.5 * zoom, w[1] - 1.4 * zoom); ctx.arc(w[0], w[1] - 1.4 * zoom, 1.5 * zoom, Math.PI, 0); ctx.lineTo(w[0] + 1.5 * zoom, w[1] + 1.8 * zoom); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,170,0.7)'; ctx.fillRect(w[0] - 0.5 * zoom, w[1] - 1.2 * zoom, 1 * zoom, 2.2 * zoom);
    }
    // 불빛 번짐(탑 뒤)
    const [lx, ly] = P(0, 0, 63), gl = ctx.createRadialGradient(lx, ly, 3 * zoom, lx, ly, 20 * zoom);
    gl.addColorStop(0, 'rgba(255,236,150,0.55)'); gl.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, ly, 20 * zoom, 0, TAU); ctx.fill();
    // 둘레(발코니) + 뒤쪽 난간
    frustum(K, pen, 7.4, 10, 53, 56.2, DARK, '#586676');
    ring(pen, 0, 0, 9.6, 59.5, '#2a343f', 0.8, Math.PI, TAU);
    for (let i = 0; i < 12; i++) { const a = Math.PI + (i / 12) * Math.PI; K.line(pen, [Math.cos(a) * 9.6, Math.sin(a) * 9.6, 56.2], [Math.cos(a) * 9.6, Math.sin(a) * 9.6, 59.5], '#2a343f', 0.6); }
    // 등불 방
    frustum(K, pen, 5.6, 5.2, 56.2, 67, '#ffe6a0', '#fff6cf');
    for (const a of [Math.PI * 0.25 - 0.62, Math.PI * 0.25, Math.PI * 0.25 + 0.62]) K.line(pen, [Math.cos(a) * 5.5, Math.sin(a) * 5.5, 56.5], [Math.cos(a) * 5.2, Math.sin(a) * 5.2, 66.8], '#5a4a3a', 0.7);
    K.puff(pen, -1.5, 0.5, 62, 1.4, 'rgba(255,255,255,0.7)');
    // 앞쪽 난간
    ring(pen, 0, 0, 9.6, 59.5, '#2a343f', 0.8, 0, Math.PI);
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; K.line(pen, [Math.cos(a) * 9.6, Math.sin(a) * 9.6, 56.2], [Math.cos(a) * 9.6, Math.sin(a) * 9.6, 59.5], '#2a343f', 0.6); }
    // 지붕과 꼭대기
    frustum(K, pen, 7.2, 6.4, 67, 68.4, '#a52f2a', '#c23a34');
    frustum(K, pen, 6.2, 0.8, 68.4, 77, RED, '#e8625a');
    K.line(pen, [0, 0, 77], [0, 0, 83], '#4b4038', 0.9);
    K.puff(pen, 0, 0, 84, 1.5, '#f2c75a');
  },
};

// id: [반지름, 높이](월드 단위). 반지름 = 바닥 모서리 폭의 절반 + 튀어나온 부분, 높이 = 가장 높은 점
export const ITEM_BOX = {
  sand: [24, 8], shells: [24, 14], tiderock: [24, 22], fishbasket: [24, 36], tidepool: [46, 10], parasol: [28, 48],
  mudflat: [46, 8], buoy: [24, 46], kelp: [46, 14], fishtub: [24, 22], rockyshore: [48, 38], beachball: [24, 24],
  lagoon: [68, 12], fishfeeder: [26, 34], reef: [46, 14], lighthouse: [26, 90],
};
// 바닥에 깔리는 물건(동물보다 먼저 그린다)
export const FLOOR = ['sand', 'tidepool', 'mudflat', 'kelp', 'lagoon', 'reef'];
