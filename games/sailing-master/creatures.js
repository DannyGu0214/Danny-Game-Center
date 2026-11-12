import { VIEW, SPECIES, TIDE } from './data.js';
// 지나가는 생물. 규칙에 영향을 주지 않는 풍경이라 화면 쪽에서만 움직인다. 탭하면 도감에 기록된다.
// 물고기·오리·물새·개구리·헤엄치는 짐승·날짐승·물가 짐승·거북 틀에 표의 색과 크기만 바꿔 그린다.
// M2b 바다 생물은 제 모양 틀이 있어요: 돌고래(뛰어오르고, 가끔 배 앞을 타요) · 물범(물가 바위에서 쉬어요) · 바다거북 · 해파리 떼 · 게(썰물 해변) · 펠리컨 · 가마우지(바위에서 날개 말리기)

const TAU = Math.PI * 2;
const R = Math.random;

export function createCreatures(world) {
  const list = [];
  const pool = Object.keys(SPECIES).filter((id) => SPECIES[id].region === world.id);
  let timer = 0;

  function place(sp, cam, W, H) {
    const def = SPECIES[sp], z = cam.zoom, k = VIEW.tiltY;
    for (let t = 0; t < 26; t++) {
      // 화면 안쪽 가장자리 근처에 나타난다
      const sx = (R() * 0.9 + 0.05) * W, sy = (R() * 0.8 + 0.08) * H;
      const x = cam.x + (sx - W / 2) / z, y = cam.y + (sy - cam.cy) / (z * k), d = world.dist(x, y);
      const land = def.kind === 'land', shore = def.kind === 'wader' || def.kind === 'frog', rock = def.kind === 'perch' || def.kind === 'seal', beach = def.kind === 'crab';
      if (land ? (d < -45 || d > -3) : shore ? (d < 0.5 || d > 5) : rock ? (d < -2.5 || d > -0.3) : beach ? (d < -5 || d > -0.4) : d < 7) continue;
      const n = def.kind === 'crab' ? 3 : 1;
      return { sp, kind: def.kind, x, y, h: R() * TAU, age: 0, life: 22 + R() * 26, ph: R() * TAU, act: 0, next: 2 + R() * 6, bob: 0, size: def.size || 1, n };
    }
    return null;
  }

  return {
    list,
    // telescope: 뭍짐승은 망원경이 있어야 나타난다. env: { tide 물높이(게는 썰물에만), len 배 길이(돌고래가 뱃머리를 탈 자리), docked }
    update(dt, cam, W, H, boat, telescope = false, env = {}) {
      const low = (env.tide ?? 0) <= TIDE.low;
      timer -= dt;
      const hw = W / 2 / cam.zoom + 30, hh = H / 2 / (cam.zoom * VIEW.tiltY) + 30;
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i], def = SPECIES[c.sp];
        c.age += dt; c.ph += dt;
        const far = Math.abs(c.x - cam.x) > hw * 1.6 || Math.abs(c.y - cam.y) > hh * 1.6;
        if (c.age > c.life || far) { list.splice(i, 1); continue; }
        c.next -= dt;
        const away = Math.hypot(c.x - boat.x, c.y - boat.y);
        switch (c.kind) {
          case 'fish': if (c.next < 0 && c.act <= 0) { c.act = 0.9; c.next = 3 + R() * 7; } c.act -= dt; { const nx = c.x + Math.cos(c.h) * dt * 1.6, ny = c.y + Math.sin(c.h) * dt * 1.6; if (world.dist(nx, ny) > 3) { c.x = nx; c.y = ny; } else c.h += 2; } if (R() < dt * 0.3) c.h += (R() - 0.5) * 1.5; break;
          case 'duck': case 'swimmer': case 'turtle': {
            const spd = c.kind === 'duck' ? 1.1 : c.kind === 'swimmer' ? 1.8 : 0.5;
            if (away < 12) c.h = Math.atan2(c.y - boat.y, c.x - boat.x);
            const nx = c.x + Math.cos(c.h) * dt * spd, ny = c.y + Math.sin(c.h) * dt * spd;
            if (world.dist(nx, ny) > 3) { c.x = nx; c.y = ny; } else c.h += 1.8;
            if (R() < dt * 0.2) c.h += (R() - 0.5) * 1.2;
            if (c.kind === 'swimmer' && c.next < 0) { c.act = c.act > 0 ? 0 : 2.4; c.next = 3 + R() * 5; } else c.act -= dt;
            break;
          }
          case 'bird': { c.x += Math.cos(c.h) * dt * (def.wing > 1 ? 7 : 11); c.y += Math.sin(c.h) * dt * (def.wing > 1 ? 7 : 11); break; }
          // 돌고래: 빠르게 헤엄치다 2~4초마다 물 위로 활처럼 뛰어요. 배가 빠르게 지나가면 뱃머리 앞을 한동안 따라 타요(bow)
          case 'dolphin': {
            const fast = boat.spd > 3 && !env.docked;
            if (!c.bow && fast && away < 45 && R() < dt * 0.25) { c.bow = 10 + R() * 10; c.side = R() < 0.5 ? -1 : 1; c.next = 0.6; }
            if (c.bow) {
              c.bow -= dt; if (c.bow <= 0 || !fast) { c.bow = 0; c.h = boat.h + c.side * 0.6; }
              const L = (env.len || 9) / 2 + 2.2 + Math.sin(c.ph * 0.9) * 0.8, off = c.side * (1.1 + 0.5 * Math.sin(c.ph * 0.6));
              const tx = boat.x + Math.cos(boat.h) * L - Math.sin(boat.h) * off, ty = boat.y + Math.sin(boat.h) * L + Math.cos(boat.h) * off;
              const k = 1 - Math.exp(-dt * 2.5); c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.h = boat.h; c.age = Math.min(c.age, c.life - 3);
            } else { const nx = c.x + Math.cos(c.h) * dt * 4.2, ny = c.y + Math.sin(c.h) * dt * 4.2; if (world.dist(nx, ny) > 5) { c.x = nx; c.y = ny; } else c.h += 2.2; if (R() < dt * 0.15) c.h += (R() - 0.5) * 0.8; }
            if (c.next < 0 && c.act <= 0) { c.act = 1.1; c.next = (c.bow ? 1.6 : 2.5) + R() * 2; } c.act -= dt;
            break;
          }
          case 'seaturtle': case 'pelican': {
            const spd = c.kind === 'seaturtle' ? 0.8 : 0.9, nx = c.x + Math.cos(c.h) * dt * spd, ny = c.y + Math.sin(c.h) * dt * spd;
            if (away < 10) c.h = Math.atan2(c.y - boat.y, c.x - boat.x);
            if (world.dist(nx, ny) > 4) { c.x = nx; c.y = ny; } else c.h += 1.8;
            if (R() < dt * 0.15) c.h += (R() - 0.5) * 1;
            if (c.next < 0) { c.act = c.act > 0 ? 0 : c.kind === 'seaturtle' ? 3 : 1.4; c.next = 4 + R() * 6; } else c.act -= dt;
            break;
          }
          case 'jelly': { c.x += Math.cos(c.h) * dt * 0.25; c.y += Math.sin(c.h) * dt * 0.25; if (R() < dt * 0.1) c.h += (R() - 0.5); break; }
          // 게: 옆으로 종종 걷다 멈춰요. 밀물이 들면 일찍 사라져요
          case 'crab': { if (c.next < 0) { c.act = c.act > 0 ? 0 : 1.2; c.next = 1 + R() * 2.5; c.h = R() < 0.5 ? 0 : Math.PI; } else c.act -= dt; if (c.act > 0) { const nx = c.x + Math.cos(c.h) * dt * 0.9; if (world.dist(nx, c.y) < -0.3) c.x = nx; } if (!low) c.life = Math.min(c.life, c.age + 2); break; }
          case 'perch': case 'seal': if (c.next < 0) { c.act = c.act > 0 ? 0 : 2.5; c.next = 3 + R() * 5; } else c.act -= dt; break;
          case 'wader': case 'land': case 'frog': if (c.next < 0) { c.act = c.act > 0 ? 0 : 1.8; c.next = 2 + R() * 5; } else c.act -= dt; break;
          default: break;
        }
      }
      const choices = pool.filter((id) => (telescope || SPECIES[id].kind !== 'land') && (SPECIES[id].tide !== 'low' || low));
      if (timer <= 0 && list.length < 7 && choices.length) {
        timer = 1.6 + R() * 2.6;
        const c = place(choices[Math.floor(R() * choices.length)], cam, W, H);
        if (c) list.push(c);
      }
    },
    // 땅 위 짐승과 물 위 생물을 함께 그린다
    draw(g, cam, W, H, dpr) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const z = cam.zoom, k = VIEW.tiltY;
      for (const c of list) {
        const sx = W / 2 + (c.x - cam.x) * z, sy = cam.cy + (c.y - cam.y) * z * k;
        if (sx < -40 || sx > W + 40 || sy < -60 || sy > H + 40) continue;
        const fade = Math.min(1, c.age, (c.life - c.age));
        g.globalAlpha = Math.max(0, fade);
        DRAW[c.kind](g, c, sx, sy, z, SPECIES[c.sp]);
      }
      g.globalAlpha = 1;
    },
    // 화면 좌표에 있는 생물: 몸 크기에 맞춰 판정한다(넓으면 물이나 건질 것을 누른 게 동물로 잡힌다)
    at(sx, sy, cam, W) {
      const z = cam.zoom, k = VIEW.tiltY;
      let best = null, bd = Infinity;
      for (const c of list) {
        const px = W / 2 + (c.x - cam.x) * z, py = cam.cy + (c.y - cam.y) * z * k - bodyLift(c, z);
        const d = Math.hypot(px - sx, py - sy);
        if (d < hitRadius(c, z) && d < bd) { bd = d; best = c; }
      }
      return best;
    },
    clear() { list.length = 0; },
  };
}

// 동물 둘레의 물결: 닫힌 고리는 건질 것 전용이라, 동물은 짧은 호 두 개만 그린다
// 몸이 그려지는 높이(화면 px)와 탭 범위
function bodyLift(c, z) {
  const s = Math.max(0.75, z / 8);
  if (c.kind === 'bird') return 7 * z;
  if (c.kind === 'wader') return 11 * s;
  if (c.kind === 'land') return 6 * s * (SPECIES[c.sp].height || 1);
  if (c.kind === 'duck' || c.kind === 'pelican') return 3 * s * (c.size || 1);
  if (c.kind === 'perch') return 8 * s;
  if (c.kind === 'seal') return 3 * s;
  return 0;
}
export function hitRadius(c, z) {
  const s = Math.max(0.75, z / 8), def = SPECIES[c.sp];
  const body = c.kind === 'fish' ? def.len * 1.9 * z * 0.5 + (def.school ? 2 * z : 0) : c.kind === 'land' ? 7 * s * (def.height || 1) : c.kind === 'wader' || c.kind === 'perch' ? 9 * s : c.kind === 'bird' ? 10 * s : c.kind === 'dolphin' ? 1.3 * z : c.kind === 'jelly' ? 2.2 * z : c.kind === 'crab' ? 6 * s : 7 * s * (c.size || 1);
  return Math.max(16, body + 6);
}
function ripple(g, x, y, r, a, k = VIEW.tiltY) {
  g.strokeStyle = `rgba(214,240,244,${a})`; g.lineWidth = 1;
  g.beginPath(); g.ellipse(x, y, r, r * k, 0, 0.25, 1.05); g.stroke();
  g.beginPath(); g.ellipse(x, y, r, r * k, 0, Math.PI + 0.25, Math.PI + 1.05); g.stroke();
}
// 물방울 몇 개(물고기가 튈 때, 수달이 잠수할 때)
function drops(g, x, y, r, a) {
  g.fillStyle = `rgba(232,248,250,${a})`;
  for (const q of [-1, -0.4, 0.5, 1]) { g.beginPath(); g.arc(x + q * r, y - Math.abs(q) * r * 0.25, 1, 0, TAU); g.fill(); }
}
const DRAW = {
  // 물고기: 평소엔 물속 그림자, 가끔 튀어 오른다
  fish(g, c, x, y, z, def) {
    const n = def.school || 1;
    for (let i = 0; i < n; i++) {
      const ox = n > 1 ? Math.cos(i * 2.4) * (1 + i * 0.4) * z : 0, oy = n > 1 ? Math.sin(i * 2.4) * (1 + i * 0.4) * z * 0.6 : 0;
      const L = Math.max(4, def.len * 1.9 * z), wig = Math.sin(c.ph * 9 + i) * 0.25;
      g.save(); g.translate(x + ox, y + oy); g.scale(1, VIEW.tiltY); g.rotate(c.h);
      g.fillStyle = 'rgba(14,50,72,.42)';
      g.beginPath(); g.ellipse(0, 0, L * 0.5, L * (def.thin ? 0.11 : 0.2), 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-L * 0.42, 0); g.lineTo(-L * 0.72, L * (0.16 + wig * 0.3)); g.lineTo(-L * 0.72, -L * (0.16 - wig * 0.3)); g.closePath(); g.fill();
      g.restore();
    }
    if (c.act > 0) {
      const p = 1 - c.act / 0.9, h = Math.sin(p * Math.PI) * 1.8 * z, L = Math.max(5, def.len * 1.9 * z);
      g.save(); g.translate(x, y - h); g.rotate((p - 0.5) * 2 * (Math.cos(c.h) > 0 ? 1 : -1));
      g.fillStyle = def.color; g.beginPath(); g.ellipse(0, 0, L * 0.5, L * (def.thin ? 0.1 : 0.2), 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-L * 0.45, 0); g.lineTo(-L * 0.72, L * 0.2); g.lineTo(-L * 0.72, -L * 0.2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(L * 0.05, -L * 0.07, L * 0.24, L * 0.05, 0, 0, TAU); g.fill();
      g.restore();
      drops(g, x, y, (0.3 + p * 1.1) * z, 0.8 * (1 - p));
    }
  },
  // 물새: 오리·백조(옆모습 + 물결)
  duck(g, c, x, y, z, def) {
    const s = Math.max(0.65, z / 8) * (c.size || 1), f = Math.cos(c.h) >= 0 ? 1 : -1, bob = Math.sin(c.ph * 2) * 0.6;
    ripple(g, x, y + 1.6 * s, 7.5 * s + Math.sin(c.ph) * s, 0.4);
    g.save(); g.translate(x, y + bob); g.scale(f * s, s);
    g.fillStyle = def.color; g.beginPath(); g.moveTo(-7.5, -1.5); g.quadraticCurveTo(-2, 3.2, 6, 1); g.quadraticCurveTo(5.5, -4.5, 0, -4.5); g.quadraticCurveTo(-4, -4.5, -7.5, -1.5); g.closePath(); g.fill();
    const nk = def.neck || 1;
    g.strokeStyle = def.head; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(4.5, -2.5); g.quadraticCurveTo(7.5, -4.5 * nk, 5.5, -6.5 * nk); g.stroke();
    g.fillStyle = def.head; g.beginPath(); g.arc(5.7, -7 * nk, 2.1, 0, TAU); g.fill();
    g.fillStyle = '#e9a02d'; g.beginPath(); g.moveTo(7.5, -7.2 * nk); g.lineTo(10.2, -6.6 * nk); g.lineTo(7.3, -6 * nk); g.closePath(); g.fill();
    g.restore();
  },
  // 물가에 선 긴 다리 새
  wader(g, c, x, y, z, def) {
    const s = Math.max(0.7, z / 8), f = Math.sin(c.ph * 0.2) > 0 ? 1 : -1, peck = c.act > 0 ? Math.sin(Math.min(1, c.act) * Math.PI) : 0;
    ripple(g, x, y, 3.5 * s, 0.35);
    g.save(); g.translate(x, y); g.scale(f * s, s);
    g.strokeStyle = '#5f5a4a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-0.8, 0); g.lineTo(-0.8, -8); g.moveTo(1, 0); g.lineTo(1, -8); g.stroke();
    g.fillStyle = def.color; g.beginPath(); g.ellipse(0, -10.5, 5.5, 3.2, -0.25, 0, TAU); g.fill();
    g.strokeStyle = def.color; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(3.5, -12); g.quadraticCurveTo(6, -16 + peck * 5, 5, -19 + peck * 13); g.stroke();
    g.fillStyle = '#d8dde0'; g.beginPath(); g.arc(5, -19.5 + peck * 13, 1.7, 0, TAU); g.fill();
    g.fillStyle = '#d9a83a'; g.beginPath(); g.moveTo(6, -20 + peck * 13); g.lineTo(11, -18.6 + peck * 15); g.lineTo(6, -18.6 + peck * 13); g.closePath(); g.fill();
    g.restore();
  },
  frog(g, c, x, y, z, def) {
    const s = Math.max(0.7, z / 8), hop = c.act > 0 ? Math.sin(Math.min(1, c.act / 1.8) * Math.PI) * 5 : 0;
    g.fillStyle = '#5b9a58'; g.beginPath(); g.ellipse(x, y + 1, 7 * s, 4 * s, 0, 0, TAU); g.fill(); // 연잎
    g.fillStyle = '#7bb86e'; g.beginPath(); g.ellipse(x - 0.5 * s, y + 0.5, 5.5 * s, 3 * s, 0, 0, TAU); g.fill();
    g.fillStyle = def.color; g.beginPath(); g.ellipse(x, y - 1.8 * s - hop, 3 * s, 2.3 * s, 0, 0, TAU); g.fill();
    for (const q of [-1, 1]) { g.beginPath(); g.arc(x + q * 1.5 * s, y - 3.9 * s - hop, 1 * s, 0, TAU); g.fill(); g.fillStyle = '#1e2a20'; g.beginPath(); g.arc(x + q * 1.5 * s, y - 4 * s - hop, 0.45 * s, 0, TAU); g.fill(); g.fillStyle = def.color; }
  },
  // 헤엄치는 짐승: 머리 + 브이 물결, 가끔 잠수
  swimmer(g, c, x, y, z, def) {
    const s = Math.max(0.7, z / 8), n = def.group || 1;
    for (let i = 0; i < n; i++) {
      const ox = i ? -Math.cos(c.h) * i * 6 * s + (i % 2 ? 3 : -3) * s : 0, oy = i ? -Math.sin(c.h) * i * 6 * s * VIEW.tiltY : 0, sc = i ? 0.7 : 1;
      const px = x + ox, py = y + oy;
      if (c.act > 0 && i === 0) { drops(g, px, py, 4 * s, 0.5); continue; }
      g.strokeStyle = 'rgba(240,252,250,.5)'; g.lineWidth = 1;
      const back = c.h + Math.PI;
      for (const q of [-0.4, 0.4]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(back + q) * 11 * s, py + Math.sin(back + q) * 11 * s * VIEW.tiltY); g.stroke(); }
      g.fillStyle = def.color; g.beginPath(); g.ellipse(px, py - 1.4 * s * sc, 3.2 * s * sc, 2.5 * s * sc, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(px - 1.8 * s * sc, py - 3.2 * s * sc, 0.8 * s * sc, 0, TAU); g.arc(px + 1.8 * s * sc, py - 3.2 * s * sc, 0.8 * s * sc, 0, TAU); g.fill();
      g.fillStyle = '#20150c'; g.beginPath(); g.arc(px, py - 0.8 * s * sc, 0.7 * s * sc, 0, TAU); g.fill();
    }
  },
  turtle(g, c, x, y, z, def) {
    const s = Math.max(0.7, z / 8);
    ripple(g, x, y, 6.5 * s, 0.3);
    g.save(); g.translate(x, y); g.scale(1, VIEW.tiltY); g.rotate(c.h);
    g.fillStyle = '#7fa35c'; g.beginPath(); g.ellipse(5.5 * s, 0, 1.8 * s, 1.5 * s, 0, 0, TAU); g.fill();
    g.fillStyle = def.color; g.beginPath(); g.ellipse(0, 0, 5 * s, 4 * s, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(30,50,20,.55)'; g.lineWidth = 0.7; g.beginPath(); g.ellipse(0, 0, 2.6 * s, 2.1 * s, 0, 0, TAU); g.moveTo(-5 * s, 0); g.lineTo(-2.6 * s, 0); g.moveTo(5 * s, 0); g.lineTo(2.6 * s, 0); g.stroke();
    g.restore();
  },
  // 날짐승: 하늘을 가로지르고 물 위에 그림자가 진다
  bird(g, c, x, y, z, def) {
    const s = Math.max(0.8, z / 8) * (def.wing > 1 ? 1.5 : 0.9), flap = Math.sin(c.ph * (def.wing > 1 ? 5 : 15));
    const alt = 14 * z * 0.5;
    g.fillStyle = 'rgba(14,50,70,.2)'; g.beginPath(); g.ellipse(x + alt * 0.2, y, 7 * s, 2.4 * s, 0, 0, TAU); g.fill();
    const py = y - alt;
    g.strokeStyle = def.color; g.lineWidth = 2 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 9 * s, py - flap * 4 * s); g.quadraticCurveTo(x - 4 * s, py - 2 * s - flap * 2 * s, x, py); g.quadraticCurveTo(x + 4 * s, py - 2 * s - flap * 2 * s, x + 9 * s, py - flap * 4 * s); g.stroke();
    if (def.tip) { g.strokeStyle = def.tip; g.lineWidth = 2.1 * s; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(x + d * 6.6 * s, py - flap * 3.2 * s - 0.6 * s); g.lineTo(x + d * 9 * s, py - flap * 4 * s); g.stroke(); } } // 갈매기 날개 끝
    g.fillStyle = def.color; g.beginPath(); g.ellipse(x, py, 2.2 * s, 1.5 * s, 0, 0, TAU); g.fill();
    if (def.tip) { g.fillStyle = '#e6b23c'; g.beginPath(); g.moveTo(x + 2 * s, py - 0.3 * s); g.lineTo(x + 3.4 * s, py); g.lineTo(x + 2 * s, py + 0.4 * s); g.closePath(); g.fill(); }
  },
  // ── M2b 바다 생물 ──
  // 돌고래: 평소엔 등지느러미와 등만 물 위로, act 동안 활처럼 뛰어올라요(배 쪽은 밝은 색, 부리 같은 주둥이)
  dolphin(g, c, x, y, z, def) {
    const L = 2.4 * z * (c.size || 1), f = Math.cos(c.h) >= 0 ? 1 : -1, leap = c.act > 0 ? 1 - c.act / 1.1 : -1;
    if (leap < 0) {
      // 물 밑 그림자 + 등지느러미 + 물결
      g.save(); g.translate(x, y); g.scale(1, VIEW.tiltY); g.rotate(c.h);
      g.fillStyle = 'rgba(20,60,80,.45)'; g.beginPath(); g.ellipse(0, 0, L * 0.5, L * 0.13, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-L * 0.42, 0); g.lineTo(-L * 0.62, L * 0.16); g.lineTo(-L * 0.58, 0); g.lineTo(-L * 0.62, -L * 0.16); g.closePath(); g.fill();
      g.restore();
      if (Math.sin(c.ph * 2.2) > 0) { g.fillStyle = def.color; g.beginPath(); g.moveTo(x - f * L * 0.1, y); g.quadraticCurveTo(x - f * L * 0.02, y - L * 0.2, x + f * L * 0.08, y - L * 0.22); g.quadraticCurveTo(x + f * L * 0.03, y - L * 0.08, x + f * L * 0.12, y); g.closePath(); g.fill(); }
      ripple(g, x, y, L * 0.3, 0.45);
      if (c.bow) { g.strokeStyle = 'rgba(255,240,170,.7)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, L * 0.6, L * 0.6 * VIEW.tiltY, 0, 0, TAU); g.stroke(); }
      return;
    }
    // 뛰어오른 몸: 포물선을 따라 머리가 위로 → 아래로
    const h = Math.sin(leap * Math.PI) * 1.4 * z, ang = (leap - 0.5) * 1.6;
    g.save(); g.translate(x, y - h); g.scale(f, 1); g.rotate(ang);
    g.fillStyle = def.color;
    g.beginPath(); g.moveTo(L * 0.5, 0.02 * L); g.quadraticCurveTo(L * 0.42, -L * 0.1, L * 0.2, -L * 0.13); g.quadraticCurveTo(-L * 0.15, -L * 0.15, -L * 0.42, -L * 0.03); g.lineTo(-L * 0.42, L * 0.03); g.quadraticCurveTo(-L * 0.1, L * 0.12, L * 0.3, L * 0.08); g.closePath(); g.fill();
    g.fillStyle = def.belly; g.beginPath(); g.moveTo(L * 0.42, L * 0.04); g.quadraticCurveTo(L * 0.05, L * 0.12, -L * 0.3, L * 0.03); g.quadraticCurveTo(0, L * 0.05, L * 0.42, L * 0.03); g.closePath(); g.fill();
    g.fillStyle = def.color;
    g.beginPath(); g.moveTo(-L * 0.38, 0); g.lineTo(-L * 0.6, -L * 0.14); g.lineTo(-L * 0.52, 0); g.lineTo(-L * 0.6, L * 0.14); g.closePath(); g.fill(); // 꼬리
    g.beginPath(); g.moveTo(L * 0.02, -L * 0.13); g.lineTo(-L * 0.1, -L * 0.27); g.lineTo(-L * 0.14, -L * 0.12); g.closePath(); g.fill(); // 등지느러미
    g.beginPath(); g.moveTo(L * 0.12, L * 0.06); g.lineTo(L * 0.02, L * 0.17); g.lineTo(-L * 0.02, L * 0.06); g.closePath(); g.fill(); // 가슴지느러미
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(L * 0.05, -L * 0.09, L * 0.2, L * 0.025, -0.05, 0, TAU); g.fill();
    g.fillStyle = '#1d2428'; g.beginPath(); g.arc(L * 0.33, -L * 0.035, Math.max(0.8, L * 0.018), 0, TAU); g.fill();
    g.restore();
    drops(g, x - f * L * 0.3 * (1 - leap), y, (0.4 + leap) * z * 0.6, 0.7 * (1 - leap));
    if (c.bow) { g.strokeStyle = 'rgba(255,240,170,.7)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, L * 0.6, L * 0.6 * VIEW.tiltY, 0, 0, TAU); g.stroke(); } // 뱃머리 타는 중: 금빛 고리(지금 탭!)
  },
  // 물범: 물가 바위에 배를 깔고 누워 가끔 고개와 꼬리를 들어요
  seal(g, c, x, y, z, def) {
    const s = Math.max(0.7, z / 8), f = Math.sin(c.ph * 0.13 + c.x) > 0 ? 1 : -1, up = c.act > 0 ? Math.sin(Math.min(1, c.act / 2.5) * Math.PI) : 0;
    g.fillStyle = 'rgba(18,40,40,.25)'; g.beginPath(); g.ellipse(x, y + 0.6 * s, 9 * s, 2.2 * s, 0, 0, TAU); g.fill();
    g.save(); g.translate(x, y); g.scale(f * s, s);
    g.fillStyle = def.color; g.beginPath(); g.moveTo(-8, -1); g.quadraticCurveTo(-4, -6, 3, -5); g.quadraticCurveTo(7, -4.5 - up * 3, 7.5, -3 - up * 4); g.quadraticCurveTo(7, 0, 3, 0.5); g.quadraticCurveTo(-4, 1.2, -8, -1); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-7.5, -1); g.lineTo(-11, -2.5 - up * 1.5); g.lineTo(-10.5, 0.4); g.closePath(); g.fill(); // 뒷지느러미
    g.fillStyle = 'rgba(255,255,240,.2)'; g.beginPath(); g.ellipse(-1, -4, 4.5, 1.1, -0.1, 0, TAU); g.fill();
    g.fillStyle = 'rgba(60,55,45,.35)'; for (const [a, b] of [[-3, -3], [0, -2.2], [-5, -1.6], [2, -3.6]]) { g.beginPath(); g.arc(a, b, 0.55, 0, TAU); g.fill(); }
    g.fillStyle = '#1d2428'; g.beginPath(); g.arc(6.4, -4 - up * 3.6, 0.6, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(240,240,230,.6)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(7.4, -3 - up * 4); g.lineTo(9, -3.6 - up * 4); g.moveTo(7.4, -2.6 - up * 4); g.lineTo(9, -2.4 - up * 4); g.stroke(); // 수염
    g.restore();
  },
  // 바다거북: 큰 등딱지, 노 같은 앞지느러미가 저어요. act 동안은 잠수(그림자만)
  seaturtle(g, c, x, y, z, def) {
    const s = Math.max(0.7, z / 8) * 1.3, paddle = Math.sin(c.ph * 2.2) * 0.5;
    g.save(); g.translate(x, y); g.scale(1, VIEW.tiltY); g.rotate(c.h);
    if (c.act > 0) { g.fillStyle = 'rgba(20,60,70,.3)'; g.beginPath(); g.ellipse(0, 0, 5.5 * s, 4 * s, 0, 0, TAU); g.fill(); g.restore(); return; }
    g.fillStyle = def.color;
    for (const sd of [-1, 1]) { g.save(); g.translate(2 * s, sd * 3 * s); g.rotate(sd * (0.6 + paddle)); g.beginPath(); g.ellipse(-1.5 * s, sd * 1.5 * s, 4 * s, 1.1 * s, sd * 0.5, 0, TAU); g.fill(); g.restore(); }
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(-4 * s, sd * 2.2 * s, 1.6 * s, 0.8 * s, sd * -0.6, 0, TAU); g.fill(); }
    g.beginPath(); g.ellipse(6 * s, 0, 1.8 * s, 1.4 * s, 0, 0, TAU); g.fill(); // 머리
    g.fillStyle = def.shell; g.beginPath(); g.ellipse(0, 0, 5 * s, 3.8 * s, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,30,12,.5)'; g.lineWidth = 0.6;
    g.beginPath(); for (const [a, b] of [[-2, 0], [0, -1.8], [2, 0], [0, 1.8]]) { g.moveTo(a * s + 1.3 * s, b * s); g.arc(a * s, b * s, 1.3 * s, 0, TAU); } g.stroke();
    g.fillStyle = 'rgba(255,240,200,.25)'; g.beginPath(); g.ellipse(-1 * s, -1.5 * s, 3 * s, 1.2 * s, 0, 0, TAU); g.fill();
    g.restore();
    ripple(g, x, y, 7 * s, 0.3);
  },
  // 해파리 떼: 물속에 반투명한 갓이 숨 쉬듯 오므렸다 펴요
  jelly(g, c, x, y, z, def) {
    const n = def.group || 7, s = Math.max(0.6, z / 8);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + c.x * 0.01, q = i ? 1.2 + (i % 3) * 1.1 : 0, px = x + Math.cos(a) * q * z * 0.9, py = y + Math.sin(a) * q * z * 0.5;
      const pulse = 1 + 0.15 * Math.sin(c.ph * 2.6 + i * 1.3), r = (2.2 + (i % 3) * 0.5) * s;
      g.strokeStyle = 'rgba(240,200,225,.35)'; g.lineWidth = 0.6;
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(px + k * r * 0.3, py); g.quadraticCurveTo(px + k * r * 0.4 + Math.sin(c.ph * 2 + i + k) * r * 0.3, py + r * 0.9, px + k * r * 0.3, py + r * 1.8); g.stroke(); }
      g.fillStyle = 'rgba(248,196,226,.45)'; g.beginPath(); g.ellipse(px, py, r * pulse, r * 0.7 / pulse, 0, Math.PI, TAU); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,240,250,.5)'; g.beginPath(); g.ellipse(px - r * 0.25, py - r * 0.3, r * 0.35, r * 0.15, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(190,110,160,.5)'; g.lineWidth = 0.6; g.beginPath(); g.arc(px, py - r * 0.15, r * 0.35, 0.3, Math.PI - 0.3); g.stroke();
    }
  },
  // 게: 썰물 해변을 옆으로 종종. 집게 둘을 들었다 놨다
  crab(g, c, x, y, z, def) {
    const s = Math.max(0.7, z / 8) * 0.8, n = c.n || 1;
    for (let i = 0; i < n; i++) {
      const px = x + (i - (n - 1) / 2) * 5 * s + Math.sin(i * 3.1) * 2 * s, py = y + Math.cos(i * 2.3) * 1.6 * s, walk = c.act > 0 ? Math.sin(c.ph * 18 + i) : 0, claw = Math.sin(c.ph * 3 + i * 2) * 0.4;
      g.fillStyle = 'rgba(60,40,20,.22)'; g.beginPath(); g.ellipse(px, py + 0.4 * s, 3 * s, 0.9 * s, 0, 0, TAU); g.fill();
      g.strokeStyle = shadeHex(def.color, -0.3); g.lineWidth = 0.7 * s; g.lineCap = 'round';
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const lx = px + sd * (1.6 + k * 0.5) * s; g.beginPath(); g.moveTo(px + sd * 1 * s, py - 0.6 * s); g.lineTo(lx + sd * 0.6 * s, py - (1.2 + (k % 2 ? walk : -walk) * 0.4) * s); g.lineTo(lx + sd * 0.9 * s, py + 0.2 * s); g.stroke(); }
      g.fillStyle = def.color; g.beginPath(); g.ellipse(px, py - 1 * s, 2.2 * s, 1.4 * s, 0, 0, TAU); g.fill();
      for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(px + sd * 2.6 * s, py - (2.4 + (sd > 0 ? claw : -claw)) * s, 0.95 * s, 0.7 * s, sd * 0.5, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,220,200,.35)'; g.beginPath(); g.ellipse(px - 0.6 * s, py - 1.5 * s, 1 * s, 0.4 * s, 0, 0, TAU); g.fill();
      g.fillStyle = '#1d1a18'; for (const sd of [-0.6, 0.6]) { g.beginPath(); g.arc(px + sd * s, py - 2.4 * s, 0.32 * s, 0, TAU); g.fill(); }
    }
  },
  // 펠리컨: 물에 둥둥, 노란 큰 부리와 목주머니. act 동안 부리를 물에 박아요
  pelican(g, c, x, y, z, def) {
    const s = Math.max(0.65, z / 8) * (c.size || 1), f = Math.cos(c.h) >= 0 ? 1 : -1, bob = Math.sin(c.ph * 1.8) * 0.5, dip = c.act > 0 ? Math.sin(Math.min(1, c.act / 1.4) * Math.PI) : 0;
    ripple(g, x, y + 1.6 * s, 8 * s + Math.sin(c.ph) * s, 0.4);
    g.save(); g.translate(x, y + bob); g.scale(f * s, s);
    g.fillStyle = def.color; g.beginPath(); g.moveTo(-8, -1.5); g.quadraticCurveTo(-2, 3.5, 6, 1); g.quadraticCurveTo(5, -5, -1, -5); g.quadraticCurveTo(-5, -5, -8, -1.5); g.closePath(); g.fill();
    g.fillStyle = 'rgba(70,70,70,.55)'; g.beginPath(); g.moveTo(-8, -1.5); g.quadraticCurveTo(-5, -3.5, -2, -3); g.lineTo(-6, 0); g.closePath(); g.fill(); // 날개 끝 검은 깃
    const hx = 5.2 + dip * 2, hy = -9 + dip * 8;
    g.strokeStyle = def.color; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(4.2, -2.5); g.quadraticCurveTo(7, -6, hx, hy); g.stroke();
    g.fillStyle = def.color; g.beginPath(); g.arc(hx, hy, 2.1, 0, TAU); g.fill();
    g.fillStyle = def.bill; g.beginPath(); g.moveTo(hx + 1.2, hy - 0.8); g.lineTo(hx + 9, hy + 0.4 + dip); g.quadraticCurveTo(hx + 5, hy + 3.4, hx + 1, hy + 1.4); g.closePath(); g.fill();
    g.fillStyle = shadeHex(def.bill, -0.2); g.beginPath(); g.moveTo(hx + 1.5, hy + 0.8); g.quadraticCurveTo(hx + 5, hy + 3.2, hx + 8.5, hy + 0.8); g.quadraticCurveTo(hx + 5, hy + 1.6, hx + 1.5, hy + 0.8); g.fill();
    g.fillStyle = '#1d2428'; g.beginPath(); g.arc(hx + 0.4, hy - 0.5, 0.45, 0, TAU); g.fill();
    g.restore();
    if (dip > 0.5) drops(g, x + f * 8 * s, y, 3 * s, 0.6);
  },
  // 가마우지: 물가 바위에 곧게 서서, act 동안 날개를 활짝 펴 말려요
  perch(g, c, x, y, z, def) {
    const s = Math.max(0.7, z / 8), f = Math.sin(c.ph * 0.17 + c.y) > 0 ? 1 : -1, wing = c.act > 0 ? Math.sin(Math.min(1, c.act / 2.5) * Math.PI) : 0;
    g.fillStyle = 'rgba(18,40,40,.25)'; g.beginPath(); g.ellipse(x, y + 0.5 * s, 3.2 * s, 1 * s, 0, 0, TAU); g.fill();
    g.save(); g.translate(x, y); g.scale(f * s, s);
    g.fillStyle = '#3a3a34'; g.fillRect(-0.9, -1.6, 0.7, 1.6); g.fillRect(0.3, -1.6, 0.7, 1.6);
    if (wing > 0.05) { g.fillStyle = def.color; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(sd * 5 * wing, -11 - 2 * wing, sd * 8 * wing, -7); g.lineTo(sd * 6 * wing, -4); g.quadraticCurveTo(sd * 3 * wing, -5, 0, -4.5); g.closePath(); g.fill(); } }
    g.fillStyle = def.color; g.beginPath(); g.ellipse(0, -5.5, 2.4, 4.4, 0.12, 0, TAU); g.fill();
    g.strokeStyle = def.color; g.lineWidth = 1.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0.6, -9); g.quadraticCurveTo(1.6, -11.5, 0.8, -13); g.stroke();
    g.beginPath(); g.arc(1, -13.3, 1.3, 0, TAU); g.fill();
    g.fillStyle = '#e3b44a'; g.beginPath(); g.moveTo(1.8, -13.6); g.lineTo(4.6, -13); g.lineTo(1.9, -12.7); g.closePath(); g.fill();
    g.fillStyle = 'rgba(90,120,110,.45)'; g.beginPath(); g.ellipse(-0.6, -6.5, 1.1, 2.6, 0.12, 0, TAU); g.fill(); // 젖은 깃 광택
    g.restore();
  },
  // 물가 짐승: 서서 고개를 숙여 물을 마신다
  land(g, c, x, y, z, def) {
    const s = Math.max(0.75, z / 8) * (def.height || 1), f = Math.sin(c.life * 3) > 0 ? 1 : -1, dip = c.act > 0 ? 1 : 0;
    g.fillStyle = 'rgba(18,50,40,.25)'; g.beginPath(); g.ellipse(x, y, 7 * s, 2 * s, 0, 0, TAU); g.fill();
    g.save(); g.translate(x, y); g.scale(f * s, s);
    g.strokeStyle = def.color; g.lineWidth = 1.4; g.lineCap = 'round';
    for (const lx of [-3.8, -2.2, 2.2, 3.8]) { g.beginPath(); g.moveTo(lx, -4.5); g.lineTo(lx, 0); g.stroke(); }
    g.fillStyle = def.color; g.beginPath(); g.ellipse(0, -6, 5.6, 2.8, 0, 0, TAU); g.fill();
    const hx = 6.5, hy = dip ? -2.5 : -9.5;
    g.lineWidth = 2.2; g.beginPath(); g.moveTo(4.5, -6.5); g.lineTo(hx, hy); g.stroke();
    g.beginPath(); g.ellipse(hx + 0.8, hy, 2.1, 1.4, 0.2, 0, TAU); g.fill();
    if (def.antler) { g.strokeStyle = '#5a4228'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(hx, hy - 1); g.lineTo(hx - 1, hy - 4); g.moveTo(hx - 0.5, hy - 2.6); g.lineTo(hx + 1.2, hy - 3.8); g.stroke(); }
    g.restore();
  },
};

const shadeHex = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; };
// 도감 그림: 한 칸에 맞춰 그린다
export function drawSpeciesIcon(g, id, x, y, size) {
  const def = SPECIES[id], z = 8;
  const c = { h: 0, ph: 1, act: def.kind === 'fish' ? 0.45 : def.kind === 'dolphin' ? 0.55 : def.kind === 'perch' ? 1.25 : 0, life: 1, size: def.size || 1, n: 1, x: 0, y: 0 };
  // 종류마다 몸이 그려지는 높이가 달라 칸 안에 들어오게 크기와 기준 높이를 맞춘다
  const fit = { fish: [0.05, size * 0.42], duck: [0.05 / (def.neck || 1) / (def.size || 1), size * 0.34], wader: [0.042, size * 0.72], frog: [0.08, size * 0.22], swimmer: [0.08, size * 0.14], turtle: [0.08, 0], bird: [0.05, 0], land: [0.075 / (def.height || 1), size * 0.5], dolphin: [0.06, size * 0.3], seal: [0.075, size * 0.12], seaturtle: [0.06, 0], jelly: [0.06, -size * 0.12], crab: [0.11, size * 0.12], pelican: [0.042, size * 0.3], perch: [0.05, size * 0.5] }[def.kind];
  const k = size * fit[0], lift = def.kind === 'bird' ? 7 * z * k : fit[1];
  g.save();
  g.translate(x, y + lift);
  g.scale(k, k);
  DRAW[def.kind](g, c, 0, 0, z, def);
  g.restore();
}
