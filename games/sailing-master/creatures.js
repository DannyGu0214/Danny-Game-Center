import { VIEW, SPECIES } from './data.js';
// 지나가는 생물. 규칙에 영향을 주지 않는 풍경이라 화면 쪽에서만 움직인다. 탭하면 도감에 기록된다.
// 물고기·오리·물새·개구리·헤엄치는 짐승·날짐승·물가 짐승·거북 틀에 표의 색과 크기만 바꿔 그린다.

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
      const land = def.kind === 'land', shore = def.kind === 'wader' || def.kind === 'frog';
      if (land ? (d < -45 || d > -3) : shore ? (d < 0.5 || d > 5) : d < 7) continue;
      return { sp, kind: def.kind, x, y, h: R() * TAU, age: 0, life: 22 + R() * 26, ph: R() * TAU, act: 0, next: 2 + R() * 6, bob: 0, size: def.size || 1 };
    }
    return null;
  }

  return {
    list,
    // telescope: 뭍짐승은 망원경이 있어야 나타난다
    update(dt, cam, W, H, boat, telescope = false) {
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
          case 'wader': case 'land': case 'frog': if (c.next < 0) { c.act = c.act > 0 ? 0 : 1.8; c.next = 2 + R() * 5; } else c.act -= dt; break;
          default: break;
        }
      }
      const choices = telescope ? pool : pool.filter((id) => SPECIES[id].kind !== 'land');
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
  if (c.kind === 'duck') return 3 * s * (c.size || 1);
  return 0;
}
export function hitRadius(c, z) {
  const s = Math.max(0.75, z / 8), def = SPECIES[c.sp];
  const body = c.kind === 'fish' ? def.len * 1.9 * z * 0.5 + (def.school ? 2 * z : 0) : c.kind === 'land' ? 7 * s * (def.height || 1) : c.kind === 'wader' ? 9 * s : c.kind === 'bird' ? 10 * s : 7 * s * (c.size || 1);
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
    g.fillStyle = def.color; g.beginPath(); g.ellipse(x, py, 2.2 * s, 1.5 * s, 0, 0, TAU); g.fill();
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

// 도감 그림: 한 칸에 맞춰 그린다
export function drawSpeciesIcon(g, id, x, y, size) {
  const def = SPECIES[id], z = 8;
  const c = { h: 0, ph: 1, act: def.kind === 'fish' ? 0.45 : 0, life: 1, size: def.size || 1 };
  // 종류마다 몸이 그려지는 높이가 달라 칸 안에 들어오게 크기와 기준 높이를 맞춘다
  const fit = { fish: [0.05, size * 0.42], duck: [0.05 / (def.neck || 1) / (def.size || 1), size * 0.34], wader: [0.042, size * 0.72], frog: [0.08, size * 0.22], swimmer: [0.08, size * 0.14], turtle: [0.08, 0], bird: [0.05, 0], land: [0.075 / (def.height || 1), size * 0.5] }[def.kind];
  const k = size * fit[0], lift = def.kind === 'bird' ? 7 * z * k : fit[1];
  g.save();
  g.translate(x, y + lift);
  g.scale(k, k);
  DRAW[def.kind](g, c, 0, 0, z, def);
  g.restore();
}
