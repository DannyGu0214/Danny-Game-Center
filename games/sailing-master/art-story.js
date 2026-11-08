// 선장 출항 이야기의 그림(논리 크기 360×250). assets/story/에 받은 일러스트를 쓰고, 아직 못 읽었거나 없으면 캔버스로 직접 그린다.
// 3쪽 여정은 일러스트(배경만) 위에 길·빨간 점선·이동하는 인물을 겹쳐 움직인다.
// drawStoryScene(g, captain, sceneId, t): t는 3쪽 여정 진행도(0~1), 다른 쪽은 쓰지 않는다
export const STORY_W = 360, STORY_H = 250;
const TAU = Math.PI * 2;

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
const rnd = (i) => { const v = Math.sin(i * 127.1 + 11.7) * 43758.5453; return v - Math.floor(v); };
const bg = (g, a, b, h = STORY_H) => { const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, a); q.addColorStop(1, b); g.fillStyle = q; g.fillRect(0, 0, STORY_W, h); };
const label = (g, text, x, y, size, color, weight = 700) => { g.fillStyle = color; g.font = `${weight} ${size}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y); };
const glow = (g, x, y, r, color) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, color); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); };

// 사람: (x, y)가 발끝. 키는 s=1에서 약 52
function person(g, C, x, y, s, o = {}) {
  g.save(); g.translate(x, y); g.scale(o.flip ? -s : s, s);
  const skin = '#f0c8a0', coat = o.coat || C.coat, knee = !!o.kneel;
  if (C.style === 'long') { g.fillStyle = C.hair; g.beginPath(); g.ellipse(0, knee ? -32 : -43, 9, 12, 0, 0, TAU); g.fill(); }
  if (knee) { g.translate(0, 11); g.fillStyle = '#2b3440'; g.fillRect(-7, -16, 15, 6); g.fillRect(-7, -12, 5, 12); g.fillStyle = '#1c2229'; g.fillRect(4, -13, 8, 3); }
  else { g.fillStyle = o.pants || '#2b3440'; g.fillRect(-6, -17, 5, 17); g.fillRect(1, -17, 5, 17); g.fillStyle = '#1c2229'; g.fillRect(-7, -2, 7, 2.6); g.fillRect(1, -2, 7, 2.6); }
  g.fillStyle = coat; rr(g, -8, -37, 16, 23, 4);
  if (o.apron) { g.fillStyle = o.apron; g.fillRect(-6, -30, 12, 19); }
  g.strokeStyle = coat; g.lineWidth = 4.2; g.lineCap = 'round';
  const arm = o.arm || [9, -19], arm2 = o.arm2 || [-9, -19];
  g.beginPath(); g.moveTo(7, -33); g.lineTo(arm[0], arm[1]); g.moveTo(-7, -33); g.lineTo(arm2[0], arm2[1]); g.stroke();
  g.fillStyle = skin; g.beginPath(); g.arc(arm[0], arm[1], 2.3, 0, TAU); g.arc(arm2[0], arm2[1], 2.3, 0, TAU); g.fill();
  g.fillStyle = skin; g.fillRect(-2.5, -39, 5, 4);
  g.beginPath(); g.ellipse(0, -45, 7.4, 8.2, 0, 0, TAU); g.fill();
  g.fillStyle = C.hair;
  if (C.style === 'short') { g.beginPath(); g.ellipse(0, -49, 7.8, 5, 0, Math.PI, TAU); g.fill(); g.fillRect(-7.8, -50, 2, 4); g.fillRect(5.8, -50, 2, 4); }
  if (C.style === 'long') { g.beginPath(); g.ellipse(-1, -50, 7.4, 4.4, -0.2, Math.PI, TAU); g.fill(); }
  if (C.style === 'perm') for (const [a, b] of [[-7, -48], [-4, -52], [1, -53], [5, -51], [7.4, -47]]) { g.beginPath(); g.arc(a, b, 3.1, 0, TAU); g.fill(); }
  if (C.style === 'bald') { g.fillRect(-7.8, -48, 1.8, 5); g.fillRect(6, -48, 1.8, 5); g.fillRect(-4.5, -41.5, 9, 1.6); }
  g.fillStyle = '#2a2320'; g.beginPath(); g.arc(-2.6, -45.5, 0.95, 0, TAU); g.arc(2.8, -45.5, 0.95, 0, TAU); g.fill();
  if (C.style === 'perm') { g.strokeStyle = '#3a3a3a'; g.lineWidth = 0.6; g.beginPath(); g.arc(-2.6, -45.5, 2.2, 0, TAU); g.moveTo(5, -45.5); g.arc(2.8, -45.5, 2.2, 0, TAU); g.stroke(); }
  if (o.cap) { g.fillStyle = '#23263a'; g.beginPath(); g.moveTo(-12, -49); g.quadraticCurveTo(0, -60, 12, -49); g.quadraticCurveTo(0, -46, -12, -49); g.fill(); g.fillStyle = '#c9a24a'; g.fillRect(-7, -49.4, 14, 1.2); }
  if (o.hat) { g.fillStyle = '#fbfbf6'; g.beginPath(); g.ellipse(0, -52.5, 8.8, 3.2, 0, 0, TAU); g.fill(); g.fillStyle = '#1b3550'; g.fillRect(-7, -52, 14, 1.8); }
  g.restore();
}

// 선장 모집 공고: (x, y)가 가운데
function notice(g, x, y, w, rot = 0) {
  const h = w * 1.34;
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  g.fillStyle = '#f4ead0'; g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = '#b84a35'; g.beginPath(); g.arc(0, -h / 2 + 3, 2.4, 0, TAU); g.fill();
  const k = w / 80;
  label(g, '선장 모집', 0, -h / 2 + 17 * k, 14 * k, '#7a2d20', 800);
  g.fillStyle = '#7a4a24'; g.beginPath(); g.moveTo(-15 * k, 3 * k); g.lineTo(15 * k, 3 * k); g.lineTo(10 * k, 10 * k); g.lineTo(-10 * k, 10 * k); g.closePath(); g.fill();
  g.fillStyle = '#6d90a8'; g.fillRect(-w / 2 + 8 * k, 10 * k, w - 16 * k, 2 * k);
  g.fillStyle = '#4b3a2b'; g.fillRect(-0.8 * k, -22 * k, 1.6 * k, 25 * k);
  g.fillStyle = '#d65a40'; g.beginPath(); g.moveTo(1 * k, -21 * k); g.lineTo(14 * k, 0); g.lineTo(1 * k, 0); g.closePath(); g.fill();
  label(g, '경력 없어도 좋습니다', 0, 22 * k, 7.2 * k, '#3d3226', 600);
  label(g, '갈대 나루 → 대양', 0, 34 * k, 7.6 * k, '#3d3226', 700);
  g.restore();
}

function rain(g, n = 70) {
  g.strokeStyle = 'rgba(190,215,240,.3)'; g.lineWidth = 0.9; g.beginPath();
  for (let i = 0; i < n; i++) { const x = rnd(i) * (STORY_W + 30), y = rnd(i + 91) * STORY_H; g.moveTo(x, y); g.lineTo(x - 4, y + 12); }
  g.stroke();
}
// 항구 도시의 박공지붕 집들
function townRow(g, base, wall, roof, lit, seed) {
  for (let x = -8, i = seed; x < STORY_W; i++) {
    const w = 40 + rnd(i) * 26, h = 58 + rnd(i + 7) * 52, peak = 15 + rnd(i + 3) * 10;
    g.fillStyle = wall; g.fillRect(x, base - h, w, h);
    g.fillStyle = roof; g.beginPath(); g.moveTo(x - 3, base - h); g.lineTo(x + w / 2, base - h - peak); g.lineTo(x + w + 3, base - h); g.closePath(); g.fill();
    for (let wy = base - h + 9; wy < base - 18; wy += 21) for (let wx = x + 7; wx < x + w - 10; wx += 16) {
      const on = rnd(wx * 3 + wy) < lit;
      g.fillStyle = on ? '#f3c969' : 'rgba(0,0,0,.28)'; g.fillRect(wx, wy, 8, 12);
      g.fillStyle = 'rgba(30,20,10,.55)'; g.fillRect(wx + 3.5, wy, 1, 12); g.fillRect(wx, wy + 5.5, 8, 1);
    }
    x += w + 1;
  }
}
function cobbles(g, y, base, stone) {
  g.fillStyle = base; g.fillRect(0, y, STORY_W, STORY_H - y);
  g.fillStyle = stone;
  for (let r = 0, yy = y + 4; yy < STORY_H; r++, yy += 8) for (let x = -10 + (r % 2) * 9, i = 0; x < STORY_W; x += 18, i++) rr(g, x + rnd(i + r) * 2, yy, 14, 5, 2);
}
function wheel(g, x, y, r) {
  g.strokeStyle = '#3a2a1a'; g.lineWidth = Math.max(1.2, r * 0.28); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.lineWidth = Math.max(0.7, r * 0.14); g.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.stroke();
}
// 말·노새·당나귀: (x, y)가 발끝, 머리는 오른쪽
function horse(g, x, y, s, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const c = o.color || '#6d4a2c', dk = o.dark || '#3a2616', ear = o.ear || 5;
  g.strokeStyle = c; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath();
  if (o.gallop) { g.moveTo(14, -18); g.lineTo(25, -7); g.moveTo(10, -17); g.lineTo(19, -3); g.moveTo(-13, -17); g.lineTo(-24, -5); g.moveTo(-9, -17); g.lineTo(-19, -2); }
  else { g.moveTo(14, -18); g.lineTo(15, 0); g.moveTo(9, -18); g.lineTo(9, 0); g.moveTo(-14, -18); g.lineTo(-15, 0); g.moveTo(-9, -18); g.lineTo(-9, 0); }
  g.stroke();
  g.strokeStyle = dk; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, -28); g.quadraticCurveTo(-29, -26, -27, -11); g.stroke();
  g.fillStyle = c; g.beginPath(); g.ellipse(0, -25, 20, 9.6, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(11, -32); g.lineTo(24, -48); g.lineTo(31, -44); g.lineTo(20, -22); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(31, -44, 8.4, 4.4, 0.5, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(24, -48); g.lineTo(25, -48 - ear); g.lineTo(28, -47); g.closePath(); g.fill();
  g.strokeStyle = dk; g.lineWidth = 2.6; g.beginPath(); g.moveTo(24, -49); g.lineTo(11, -33); g.stroke();
  g.fillStyle = '#17110b'; g.beginPath(); g.arc(30, -46, 0.95, 0, TAU); g.fill();
  g.fillStyle = o.saddle || '#7a2d20'; rr(g, -8, -36, 15, 5, 1.5);
  g.restore();
}
function mailBag(g, x, y, s) { g.fillStyle = '#a5763f'; rr(g, x, y, 14 * s, 13 * s, 2.5 * s); g.fillStyle = '#7d5429'; g.fillRect(x, y, 14 * s, 4.5 * s); g.fillStyle = '#f4ead0'; g.fillRect(x + 4 * s, y + 7 * s, 7 * s, 4 * s); }
function gear(g, x, y, r, color) {
  g.fillStyle = color; g.beginPath();
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, q = i % 2 ? r : r * 0.78; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(30,20,10,.65)'; g.beginPath(); g.arc(x, y, r * 0.28, 0, TAU); g.fill();
}
function clockFace(g, x, y, r, a = 0.8, b = 4) {
  g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(x, y, r + 2.5, 0, TAU); g.fill();
  g.fillStyle = '#f4ecd8'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = '#2c2318'; g.lineCap = 'round'; g.lineWidth = Math.max(1, r * 0.09); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * r * 0.78, y - Math.cos(a) * r * 0.78); g.moveTo(x, y); g.lineTo(x + Math.sin(b) * r * 0.5, y - Math.cos(b) * r * 0.5); g.stroke();
}

// ── 쪽마다 그림 ──
const SCENES = {
  // 우편 기수: 비 오는 밤의 항구 도시
  ride(g, C) {
    bg(g, '#0b1729', '#2b3257', 190);
    townRow(g, 190, '#27304c', '#1a2238', 0.3, 3); townRow(g, 192, '#3a3a52', '#2a2436', 0.42, 15);
    cobbles(g, 190, '#1c2230', '#28303f');
    for (let i = 0; i < 22; i++) { g.fillStyle = 'rgba(243,201,105,.14)'; g.fillRect(rnd(i + 3) * STORY_W, 192, 5 + rnd(i) * 8, 12 + rnd(i + 8) * 26); }
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.4; g.beginPath(); for (const [a, b] of [[14, 178], [38, 196], [8, 208]]) { g.moveTo(a, b); g.lineTo(a + 62, b); } g.stroke();
    horse(g, 186, 232, 1.75, { gallop: true });
    person(g, C, 182, 190, 1.32, { kneel: true, cap: true, arm: [12, -26], arm2: [8, -22] });
    mailBag(g, 142, 172, 1.6);
    rain(g);
  },
  // 가로등 기둥에 붙은 공고
  poleNotice(g, C) {
    bg(g, '#0d1a2c', '#262e4c', 196);
    townRow(g, 198, '#2a324c', '#1d2438', 0.18, 41);
    glow(g, 236, 30, 140, 'rgba(255,226,150,.5)');
    cobbles(g, 196, '#1b2130', '#262e3c');
    g.fillStyle = '#2e2a26'; g.fillRect(230, 26, 11, 182);
    g.fillStyle = '#2e2a26'; g.beginPath(); g.moveTo(224, 26); g.lineTo(247, 26); g.lineTo(243, 20); g.lineTo(228, 20); g.closePath(); g.fill();
    g.fillStyle = '#ffe9a6'; rr(g, 228, 7, 15, 14, 2); g.strokeStyle = '#2e2a26'; g.lineWidth = 1.6; g.strokeRect(228, 7, 15, 14);
    notice(g, 236, 112, 88, -0.03);
    horse(g, 62, 222, 1.35);
    mailBag(g, 40, 180, 1.2);
    person(g, C, 158, 216, 1.5, { arm: [16, -40], coat: C.coat });
    rain(g, 62);
  },
  // 세관 유실물 창고
  lostFound(g, C) {
    bg(g, '#efe2c6', '#d9c9a4', 190);
    g.fillStyle = '#1e3a5a'; rr(g, 84, 8, 192, 25, 4); label(g, '세관 유실물 창고', 180, 21, 14, '#fff');
    const shelf = (y) => { g.fillStyle = '#8a6a44'; g.fillRect(14, y, 332, 5); };
    for (const y of [76, 124, 172]) shelf(y);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) {
      const x = 22 + i * 27 + rnd(i + r * 20) * 4, y = [76, 124, 172][r], k = rnd(i * 3 + r * 9);
      if (k < 0.4) { const c = ['#c8553d', '#3f7a8c', '#6f8f4a', '#8d5f9c'][i % 4]; g.fillStyle = c; rr(g, x, y - 22, 19, 22, 3); g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(x + 9.5, y - 22, 5, Math.PI, TAU); g.stroke(); }
      else if (k < 0.72) { g.fillStyle = '#b08a58'; g.fillRect(x, y - 25, 21, 25); g.fillStyle = '#8f6d42'; g.fillRect(x, y - 15, 21, 3); }
      else { g.strokeStyle = ['#2f4a70', '#a33d44', '#2b6a5a'][i % 3]; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 8, y - 2); g.lineTo(x + 8, y - 30); g.stroke(); }
      g.fillStyle = '#f7f2e4'; g.fillRect(x + 12, y - 8, 7, 5);
    }
    person(g, C, 196, 214, 1.5, { arm: [-16, -32], arm2: [-12, -24], coat: '#2d5f7a' });
    g.strokeStyle = '#7a2f3a'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(158, 150); g.lineTo(150, 196); g.stroke();
    g.fillStyle = '#a06e3f'; g.fillRect(0, 196, STORY_W, 54); g.fillStyle = '#c28a52'; g.fillRect(0, 192, STORY_W, 8);
    g.fillStyle = '#f4ead0'; g.fillRect(248, 178, 44, 15); g.fillStyle = '#7f745f'; for (let i = 0; i < 3; i++) g.fillRect(252, 182 + i * 3.6, 34, 1.2);
  },
  // 찾으러 오지 않는 상자
  oldBox(g, C) {
    bg(g, '#2a241c', '#3f362a');
    g.fillStyle = '#1e1912'; for (const y of [50, 104]) g.fillRect(0, y, STORY_W, 6);
    for (let i = 0; i < 14; i++) { g.fillStyle = '#332b20'; g.fillRect(i * 27 + 4, (i % 2 ? 50 : 104) - 26 - rnd(i) * 6, 22, 26 + rnd(i) * 6); }
    g.fillStyle = '#51452f'; g.fillRect(0, 192, STORY_W, 58);
    const q = g.createLinearGradient(0, 0, 0, 240); q.addColorStop(0, 'rgba(255,233,170,.42)'); q.addColorStop(1, 'rgba(255,233,170,.05)'); g.fillStyle = q; g.beginPath(); g.moveTo(180, -6); g.lineTo(250, -6); g.lineTo(324, 244); g.lineTo(112, 244); g.closePath(); g.fill();
    // 펼친 해도
    g.save(); g.translate(278, 214); g.rotate(-0.06);
    g.fillStyle = '#e4d3a4'; g.fillRect(-62, -24, 124, 48); g.fillStyle = '#86b5c4'; g.fillRect(-56, -19, 112, 38);
    g.fillStyle = '#d4c184'; g.beginPath(); g.ellipse(-34, -6, 14, 10, 0.3, 0, TAU); g.ellipse(32, 8, 16, 8, -0.2, 0, TAU); g.fill();
    g.strokeStyle = '#a03a2e'; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(-34, -2); g.quadraticCurveTo(0, -20, 28, 6); g.stroke(); g.setLineDash([]);
    g.restore();
    // 궤짝과 공고
    g.fillStyle = '#5e3f22'; g.beginPath(); g.moveTo(148, 146); g.quadraticCurveTo(192, 96, 236, 146); g.closePath(); g.fill();
    g.fillStyle = '#20150b'; g.beginPath(); g.moveTo(154, 146); g.quadraticCurveTo(192, 106, 230, 146); g.closePath(); g.fill();
    g.fillStyle = '#7a5230'; g.fillRect(148, 146, 88, 58);
    g.fillStyle = '#3d3226'; for (const x of [158, 218]) g.fillRect(x, 146, 7, 58); g.fillRect(148, 146, 88, 6); g.fillRect(148, 198, 88, 6);
    g.fillStyle = '#c9a24a'; rr(g, 186, 148, 12, 13, 2);
    g.fillStyle = '#e8dcbc'; g.save(); g.translate(208, 132); g.rotate(0.28); g.fillRect(-5, -26, 10, 40); g.restore();
    g.fillStyle = '#f7f2e4'; g.fillRect(172, 172, 40, 18); label(g, '1년 넘음', 192, 181, 7.5, '#6d3f2a');
    notice(g, 186, 122, 44, -0.1);
    person(g, C, 92, 206, 1.6, { kneel: true, arm: [20, -30], arm2: [14, -24], coat: '#2d5f7a' });
    for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(255,240,195,.5)'; g.beginPath(); g.arc(150 + rnd(i) * 110, 22 + rnd(i + 5) * 160, 0.5 + rnd(i + 9), 0, TAU); g.fill(); }
  },
  // 향신료 가게
  market(g, C) {
    bg(g, '#f8e5b8', '#f0cf96', 170);
    g.fillStyle = '#c9b58f'; g.fillRect(0, 54, STORY_W, 160);
    for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#c8452f' : '#fff4dd'; g.beginPath(); g.moveTo(i * 22 - 6, 6); g.lineTo(i * 22 + 16, 6); g.lineTo(i * 22 + 18, 44); g.arc(i * 22 + 7, 44, 11, 0, Math.PI); g.closePath(); g.fill(); }
    g.fillStyle = '#7a2d20'; rr(g, 98, 48, 164, 24, 3); label(g, '향신료 30년', 180, 60, 13, '#fff0d0');
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 86); g.lineTo(STORY_W, 86); g.stroke();
    for (let i = 0; i < 16; i++) { const x = 16 + i * 22; g.strokeStyle = '#6a4a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 86); g.lineTo(x, 92); g.stroke();
      if (Math.abs(x - 180) < 28) continue;
      if (i % 2) { g.fillStyle = '#c63f2e'; for (let q = 0; q < 4; q++) { g.beginPath(); g.ellipse(x + (q % 2 ? 2 : -2), 95 + q * 7, 2.2, 5, q % 2 ? 0.35 : -0.35, 0, TAU); g.fill(); } }
      else { g.fillStyle = '#f2ead6'; for (let q = 0; q < 3; q++) { g.beginPath(); g.arc(x + (q % 2 ? 2 : -2), 96 + q * 9, 5, 0, TAU); g.fill(); } } }
    person(g, C, 180, 192, 1.6, { apron: '#e9e2cf', arm: [14, -22], arm2: [-14, -26] });
    g.fillStyle = '#8b6238'; g.fillRect(40, 170, 280, 42); g.fillStyle = '#a97a49'; g.fillRect(34, 162, 292, 10);
    g.fillStyle = '#6e5230'; g.fillRect(0, 212, STORY_W, 38);
    const basket = (x, c) => { g.fillStyle = '#b7894f'; g.beginPath(); g.ellipse(x, 156, 26, 9, 0, 0, TAU); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(x, 153, 22, 7, 0, 0, TAU); g.fill(); };
    basket(72, '#37302a'); basket(130, '#a4622c'); basket(292, '#e8a11f');
    // 저울
    g.fillStyle = '#3f4a50'; g.fillRect(226, 150, 26, 12); g.fillStyle = '#c5ced3'; g.beginPath(); g.ellipse(239, 148, 19, 4, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(239, 157, 4, 0, TAU); g.fill();
    g.fillStyle = '#fff8e6'; for (const [x, t] of [[72, '후추'], [130, '계피'], [292, '사프란']]) { rr(g, x - 18, 170, 36, 15, 2); label(g, t, x, 178, 9.5, '#7a2d20'); g.fillStyle = '#fff8e6'; }
  },
  // 헐리는 시장의 마지막 장날
  lastDay(g, C) {
    bg(g, '#e98a54', '#f5cf95', 202);
    glow(g, 74, 118, 74, 'rgba(255,240,190,.75)');
    // 부두를 넓히는 나무 기중기와 잔해
    g.fillStyle = '#6c5a4a'; g.beginPath(); g.moveTo(0, 202); g.lineTo(0, 158); g.lineTo(40, 136); g.lineTo(82, 150); g.lineTo(120, 138); g.lineTo(160, 160); g.lineTo(160, 202); g.closePath(); g.fill();
    g.strokeStyle = '#4c3626'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(78, 142); g.lineTo(100, 66); g.lineTo(120, 142); g.moveTo(100, 66); g.lineTo(38, 44); g.stroke();
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(38, 44); g.lineTo(38, 96); g.stroke();
    g.fillStyle = '#4c3626'; g.fillRect(28, 96, 20, 14);
    // 셔터 내린 가게
    g.fillStyle = '#7f7468'; g.fillRect(142, 62, 218, 140);
    for (let i = 0; i < 2; i++) { const x = 150 + i * 106; g.fillStyle = '#9fa5a6'; g.fillRect(x, 96, 96, 106); g.fillStyle = 'rgba(0,0,0,.14)'; for (let y = 100; y < 202; y += 8) g.fillRect(x, y, 96, 1.6);
      g.fillStyle = '#5d554b'; g.fillRect(x, 74, 96, 18); label(g, ['향신료', '염색집'][i], x + 48, 83, 10.5, '#e6dcc8');
      g.strokeStyle = 'rgba(190,40,30,.8)'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 20, 112); g.lineTo(x + 76, 172); g.moveTo(x + 76, 112); g.lineTo(x + 20, 172); g.stroke(); }
    notice(g, 302, 150, 62, 0.03);
    g.fillStyle = '#5f5448'; g.fillRect(0, 200, STORY_W, 50);
    for (let i = 0; i < 12; i++) { g.fillStyle = '#7b6c5b'; g.fillRect(rnd(i) * STORY_W, 206 + rnd(i + 4) * 36, 8 + rnd(i + 2) * 14, 3); }
    person(g, { coat: '#47688a', hair: '#2a1c12', style: 'long' }, 72, 224, 1.45, { arm: [14, -24] });
    person(g, C, 198, 224, 1.6, { arm: [24, -40] });
    g.fillStyle = '#6b4c32'; rr(g, 168, 190, 18, 22, 3); g.fillStyle = '#c5ced3'; g.beginPath(); g.ellipse(177, 189, 11, 3, 0, 0, TAU); g.fill();
  },
  // 문을 닫는 시계 공방
  clockShop(g, C) {
    bg(g, '#5a4230', '#3a2b1f', 216);
    glow(g, 180, 60, 190, 'rgba(255,214,150,.22)');
    g.fillStyle = '#c2b28c'; rr(g, 104, 8, 170, 22, 2); label(g, '시계 공방, 오늘로 닫습니다', 189, 19, 11.5, '#3f3424');
    g.fillStyle = '#2f2318'; for (const y of [78, 128]) g.fillRect(150, y, 200, 5);
    for (let i = 0; i < 6; i++) { clockFace(g, 170 + i * 33, 62, 12, 0.4 + i, 2 + i * 1.3); if (i < 5) clockFace(g, 186 + i * 33, 112, 11, 2 + i, 5 - i); }
    g.fillStyle = '#6b4a2a'; g.fillRect(40, 44, 52, 112); g.fillStyle = '#7d5a35'; g.beginPath(); g.moveTo(34, 44); g.lineTo(66, 22); g.lineTo(98, 44); g.closePath(); g.fill();
    clockFace(g, 66, 74, 19, 0, 3.6);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(66, 96); g.lineTo(66, 134); g.stroke(); g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(66, 138, 7, 0, TAU); g.fill();
    g.fillStyle = '#2a2018'; g.fillRect(0, 214, STORY_W, 36);
    person(g, C, 130, 214, 1.7, { coat: '#6b5a3a', apron: '#3f3226', arm: [24, -30], arm2: [16, -24] });
    g.fillStyle = '#7d5a35'; g.fillRect(150, 172, 210, 42); g.fillStyle = '#9a7248'; g.fillRect(146, 166, 214, 9);
    gear(g, 204, 155, 13, '#c9a24a'); gear(g, 228, 158, 9, '#a8894a'); gear(g, 250, 156, 11, '#b8c0c4');
    g.fillStyle = '#3d3226'; rr(g, 280, 148, 44, 19, 3); g.fillStyle = '#a5763f'; g.fillRect(286, 144, 32, 5);
  },
  // 대야에 띄운 나무 배
  basinBoat(g, C) {
    bg(g, '#f2b77a', '#f8dfae', 150);
    g.fillStyle = '#a9b58a'; g.fillRect(0, 138, STORY_W, 112);
    // 철물점
    g.fillStyle = '#b9ab92'; g.fillRect(232, 48, 128, 94); g.fillStyle = '#51627a'; g.fillRect(226, 44, 140, 22); label(g, '대장간', 294, 56, 12.5, '#fff');
    g.fillStyle = '#3e4c5f'; g.fillRect(312, 78, 38, 64);
    notice(g, 272, 106, 50, -0.02);
    // 울타리
    g.fillStyle = '#8c6d49'; for (let x = 0; x < 232; x += 20) g.fillRect(x, 94, 12, 46); g.fillRect(0, 106, 232, 5);
    // 대야
    g.fillStyle = '#7f909c'; g.beginPath(); g.ellipse(176, 206, 66, 24, 0, 0, TAU); g.fill();
    g.fillStyle = '#6eb6cf'; g.beginPath(); g.ellipse(176, 201, 58, 18, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(176, 203, 34, 8, 0, 0.3, 2.3); g.stroke();
    g.fillStyle = '#8c5a2b'; g.beginPath(); g.moveTo(148, 192); g.lineTo(204, 192); g.lineTo(194, 206); g.lineTo(158, 206); g.closePath(); g.fill();
    g.fillStyle = '#5a3a1e'; g.fillRect(175, 150, 2.4, 44);
    g.fillStyle = '#fbf3df'; g.beginPath(); g.moveTo(178, 152); g.lineTo(205, 188); g.lineTo(178, 188); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(174, 160); g.lineTo(155, 188); g.lineTo(174, 188); g.closePath(); g.fill();
    person(g, C, 76, 208, 1.5, { kneel: true, coat: '#6a7a82', arm: [16, -28], arm2: [10, -22] });
    g.fillStyle = '#c6a273'; g.save(); g.translate(100, 170); g.rotate(-0.5); g.fillRect(-2, -8, 4, 16); g.restore();
    person(g, { coat: '#d9603f', hair: '#2a1c12', style: 'short' }, 268, 222, 1.05, { arm: [-16, -42], flip: false, pants: '#39506d' });
  },
};

// ── 3쪽: 살던 곳에서 작은 호수까지 가는 길(t로 그려져 나간다) ──
const ROUTE = [[52, 212], [120, 244], [176, 150], [264, 134]];
const routeAt = (t, R = ROUTE) => {
  const u = 1 - t, [a, b, c, d] = R;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};
function hometown(g, kind) {
  if (kind === 'port') { for (let i = 0; i < 4; i++) { const x = 4 + i * 23, h = 26 + (i % 2) * 10; g.fillStyle = ['#d9c9a4', '#c9a57c', '#e0d4b8', '#b98d68'][i]; g.fillRect(x, 212 - h, 21, h); g.fillStyle = '#a4472f'; g.beginPath(); g.moveTo(x - 2, 212 - h); g.lineTo(x + 10.5, 200 - h); g.lineTo(x + 23, 212 - h); g.closePath(); g.fill(); } }
  if (kind === 'customs') { g.fillStyle = '#b8ad96'; g.fillRect(8, 182, 78, 30); g.fillStyle = '#8f8570'; g.beginPath(); g.moveTo(3, 182); g.lineTo(47, 166); g.lineTo(91, 182); g.closePath(); g.fill(); g.fillStyle = '#6f6655'; for (let i = 0; i < 5; i++) g.fillRect(14 + i * 15, 185, 5, 27); g.fillStyle = '#4c3626'; g.fillRect(46, 146, 2, 22); g.fillStyle = '#c8452f'; g.beginPath(); g.moveTo(48, 147); g.lineTo(62, 151); g.lineTo(48, 156); g.closePath(); g.fill(); }
  if (kind === 'market') { for (let i = 0; i < 3; i++) { const x = 8 + i * 28; g.fillStyle = ['#c8452f', '#d59a3d', '#2f6b5a'][i]; g.beginPath(); g.moveTo(x, 192); g.lineTo(x + 13, 176); g.lineTo(x + 26, 192); g.closePath(); g.fill(); g.fillStyle = '#d8c7a0'; g.fillRect(x + 3, 192, 20, 18); } g.strokeStyle = '#4c3626'; g.lineWidth = 3; g.beginPath(); g.moveTo(92, 212); g.lineTo(92, 166); g.lineTo(66, 160); g.stroke(); g.lineWidth = 1; g.beginPath(); g.moveTo(66, 160); g.lineTo(66, 174); g.stroke(); }
  if (kind === 'workshop') { g.fillStyle = '#c9b48f'; g.fillRect(8, 190, 50, 22); g.fillStyle = '#a4472f'; g.beginPath(); g.moveTo(4, 190); g.lineTo(33, 176); g.lineTo(62, 190); g.closePath(); g.fill(); g.fillStyle = '#9a8c74'; g.fillRect(64, 152, 20, 60); g.fillStyle = '#6e4a32'; g.beginPath(); g.moveTo(61, 152); g.lineTo(74, 136); g.lineTo(87, 152); g.closePath(); g.fill(); clockFace(g, 74, 164, 7, 0.5, 3.4); }
}
function vehicle(g, kind, C, x, y, a) {
  g.save(); g.translate(x, y); g.rotate(Math.cos(a) < 0 ? a + Math.PI : a); if (Math.cos(a) < 0) g.scale(-1, 1);
  if (kind === 'port') { horse(g, 0, 3, 0.46, { gallop: true }); person(g, C, -1, -9, 0.42, { kneel: true, cap: true, arm: [12, -26] }); }
  if (kind === 'customs') { horse(g, 23, 3, 0.4, { gallop: true, color: '#efe6d4', dark: '#a89c84', saddle: '#2f6b5a' }); g.fillStyle = '#7a2d20'; rr(g, -24, -19, 30, 17, 3); g.fillStyle = '#e8c97a'; g.fillRect(-24, -8, 30, 1.6); g.fillStyle = '#f7ecc8'; g.fillRect(-19, -16, 8, 6); g.fillRect(-7, -16, 8, 6); wheel(g, -16, -1, 4.2); wheel(g, 0, -1, 4.2); }
  if (kind === 'market') { horse(g, 22, 3, 0.38, { color: '#7c6a56', dark: '#4a3e30', saddle: '#7c6a56', ear: 9 }); g.fillStyle = '#8c6238'; g.fillRect(-23, -10, 30, 7); g.fillStyle = '#c89a5c'; rr(g, -21, -19, 11, 9, 2); g.fillStyle = '#d65a40'; rr(g, -9, -18, 11, 8, 2); wheel(g, -13, -1, 4.6); }
  if (kind === 'workshop') { horse(g, 0, 3, 0.42, { color: '#8a8378', dark: '#55504a', saddle: '#6b4a2a', ear: 11 }); person(g, C, -1, -9, 0.4, { kneel: true, arm: [10, -26] }); g.fillStyle = '#3d3226'; rr(g, -12, -13, 8, 6, 1); }
  g.restore();
}
function journey(g, C, t, kind) {
  bg(g, '#9ad6e6', '#dff2e4', 92);
  glow(g, 304, 34, 54, 'rgba(255,245,195,.95)');
  g.fillStyle = '#fff7d9'; g.beginPath(); g.arc(304, 34, 14, 0, TAU); g.fill();
  g.fillStyle = '#9db8b4'; g.beginPath(); g.moveTo(0, 82); g.lineTo(62, 44); g.lineTo(116, 78); g.lineTo(172, 38); g.lineTo(246, 82); g.lineTo(306, 54); g.lineTo(360, 82); g.lineTo(360, 110); g.lineTo(0, 110); g.closePath(); g.fill();
  g.fillStyle = '#8db66c'; g.fillRect(0, 88, STORY_W, 162);
  g.fillStyle = '#7ba75f'; g.beginPath(); g.moveTo(0, 148); g.quadraticCurveTo(90, 96, 200, 142); g.quadraticCurveTo(278, 174, 360, 150); g.lineTo(360, 250); g.lineTo(0, 250); g.closePath(); g.fill();
  // 작은 호수와 갈대
  g.fillStyle = '#d6c58f'; g.beginPath(); g.ellipse(292, 118, 70, 30, -0.04, 0, TAU); g.fill();
  g.fillStyle = '#4e9dbc'; g.beginPath(); g.ellipse(296, 115, 62, 24, -0.04, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; for (const [x, y] of [[276, 108], [314, 120], [330, 106]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y); g.stroke(); }
  g.strokeStyle = '#5c7a3a'; g.lineWidth = 1.2; g.fillStyle = '#8a6a3a';
  for (let i = 0; i < 26; i++) { const a = 2.1 + i * 0.075, x = 292 + Math.cos(a) * 70 + rnd(i) * 5, y = 120 + Math.sin(a) * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 13); g.stroke(); g.beginPath(); g.ellipse(x + 1, y - 14, 1.3, 3, 0, 0, TAU); g.fill(); }
  // 살던 곳
  hometown(g, kind);
  for (let i = 0; i < 18; i++) { const x = 16 + rnd(i) * 330, y = 170 + rnd(i + 4) * 74; if (Math.abs(x - routeAt(0.5)[0]) < 30 && Math.abs(y - routeAt(0.5)[1]) < 30) continue; g.fillStyle = i % 3 ? '#5f8d4c' : '#507c40'; g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x + 7, y); g.lineTo(x - 7, y); g.closePath(); g.fill(); }
  // 지나갈 길과 지나온 길
  g.lineCap = 'round';
  const path = (end) => { g.beginPath(); g.moveTo(ROUTE[0][0], ROUTE[0][1]); for (let i = 1; i <= 40; i++) { const q = routeAt(i / 40 * end); g.lineTo(q[0], q[1]); } g.stroke(); };
  g.strokeStyle = '#c9b98d'; g.lineWidth = 8; path(1);
  g.strokeStyle = '#c8452f'; g.lineWidth = 2.4; g.setLineDash([6, 5]); if (t > 0.002) path(t); g.setLineDash([]);
  // 나루와 뗏목
  g.fillStyle = '#8a6a44'; g.fillRect(260, 126, 34, 5); g.fillRect(264, 128, 3, 10); g.fillRect(286, 128, 3, 10);
  g.fillStyle = '#b48a55'; for (let i = 0; i < 5; i++) rr(g, 302, 112 + i * 3.3, 28, 3, 1.4);
  g.strokeStyle = '#6b4c32'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(330, 120); g.lineTo(342, 112); g.moveTo(302, 120); g.lineTo(292, 112); g.stroke();
  label(g, '갈대 나루', 276, 148, 11, '#20404c');
  label(g, ({ port: '살던 항구', customs: '세관 창고', market: '헐린 시장', workshop: '닫은 공방' })[kind], 42, 230, 10.5, '#26361f');
  const [x, y] = routeAt(t), [x2, y2] = routeAt(Math.min(1, t + 0.01)), [x1, y1] = routeAt(Math.max(0, t - 0.01));
  if (t < 0.985) vehicle(g, kind, C, x, y, Math.atan2(y2 - y1, x2 - x1));
  else person(g, C, 279, 127, 0.62, { hat: true, arm: [10, -30] });
}

const JOURNEY = { journeyHorse: 'port', journeyCoach: 'customs', journeyCart: 'market', journeyDonkey: 'workshop' };
export const isJourney = (scene) => scene in JOURNEY;
// 일러스트
const IMG = {};
export function storyImage(scene, onload) {
  let im = IMG[scene];
  if (!im) { im = IMG[scene] = new Image(); im.decoding = 'async'; im.src = `assets/story/${scene}.webp`; }
  if (onload && !(im.complete && im.naturalWidth)) im.addEventListener('load', onload, { once: true });
  return im;
}
const ready = (im) => im && im.complete && im.naturalWidth > 0;
// 여정 일러스트마다 살던 곳 앞(시작)과 갈대 나루 부두(끝)의 자리, 그 사이 길의 굽이(베지어 조절점 둘)
const ROUTES = {
  journeyHorse: [[115, 215], [170, 242], [228, 204], [255, 168]],
  journeyCoach: [[115, 218], [170, 242], [220, 198], [258, 182]],
  journeyCart: [[140, 192], [172, 218], [200, 182], [226, 170]],
  journeyDonkey: [[170, 196], [214, 218], [250, 180], [282, 168]],
};
function journeyArt(g, C, t, kind, im, R) {
  g.drawImage(im, 0, 0, STORY_W, STORY_H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const path = (end) => { g.beginPath(); g.moveTo(R[0][0], R[0][1]); for (let i = 1; i <= 40; i++) { const q = routeAt(i / 40 * end, R); g.lineTo(q[0], q[1]); } g.stroke(); };
  g.strokeStyle = 'rgba(120,96,60,.35)'; g.lineWidth = 8; path(1);
  g.strokeStyle = 'rgba(226,206,160,.85)'; g.lineWidth = 5.5; path(1);
  g.strokeStyle = '#c8452f'; g.lineWidth = 2.4; g.setLineDash([6, 5]); if (t > 0.002) path(t); g.setLineDash([]);
  const tag = (text, x, y) => { g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3.2; g.strokeStyle = 'rgba(20,40,50,.75)'; g.strokeText(text, x, y); g.fillStyle = '#fff8e6'; g.fillText(text, x, y); };
  const [ex, ey] = R[3];
  tag('갈대 나루', Math.min(STORY_W - 30, ex + 8), ey - 24);
  tag(({ port: '살던 항구', customs: '세관 창고', market: '헐린 시장', workshop: '닫은 공방' })[kind], R[0][0] - 4, Math.min(R[0][1] + 15, 222));
  const [x, y] = routeAt(t, R), [x2, y2] = routeAt(Math.min(1, t + 0.01), R), [x1, y1] = routeAt(Math.max(0, t - 0.01), R);
  if (t < 0.985) vehicle(g, kind, C, x, y, Math.atan2(y2 - y1, x2 - x1));
  else person(g, C, ex - 4, ey + 3, 0.5, { hat: true, arm: [10, -30] });
}
export function drawStoryScene(g, C, scene, t = 1) {
  g.save(); g.beginPath(); g.rect(0, 0, STORY_W, STORY_H); g.clip();
  const im = storyImage(scene);
  if (ready(im)) { if (scene in JOURNEY) journeyArt(g, C, t, JOURNEY[scene], im, ROUTES[scene]); else g.drawImage(im, 0, 0, STORY_W, STORY_H); }
  else if (scene in JOURNEY) journey(g, C, t, JOURNEY[scene]); else SCENES[scene](g, C);
  g.restore();
}
