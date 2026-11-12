import { REGIONS } from './data.js';
// 수역 지도. 물가는 호수(반지름 함수)나 강(중심선 + 폭), 해안(해안선 y = f(x), 남쪽이 뭍) 하나로 그림(다각형)과 규칙(거리 격자)이 같은 모양을 쓴다.
// 좌표: x 동쪽, y 남쪽. 수역마다 createWorld로 한 번만 만들어 둔다.

const TAU = Math.PI * 2;

const lakeShape = (a, ph = 0) => 1
  + 0.13 * Math.sin(2 * a + 0.9 + ph) + 0.09 * Math.sin(3 * a + 2.4 + ph * 2)
  + 0.06 * Math.sin(5 * a + 0.7 + ph) + 0.035 * Math.sin(8 * a + 4.1) + 0.018 * Math.sin(13 * a + 1.3);
const isleShape = (I, a) => I.r * (1 + 0.2 * Math.sin(2 * a + I.ph) + 0.12 * Math.sin(3 * a + I.ph * 2) + 0.06 * Math.sin(5 * a + I.ph * 3));

// 강 중심선: 점 사이를 부드럽게 이어(Catmull-Rom) 촘촘한 점으로 만든다
function smoothLine(pts, seg = 14) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// 해안선(M2a): 기본 높이 + 혹(곶·만·하구) + 잔물결. 혹은 [가운데 x, 폭, 높이(+ 남쪽), 모양 지수]이고 지수가 크면 옆이 가팔라요
const coastLine = (sh) => (x) => {
  let y = sh.base;
  for (const [cx, w, dy, p = 2] of sh.bumps) y += dy * Math.exp(-((Math.abs(x - cx) / w) ** p));
  for (const [a, per, ph] of sh.wig || []) y += a * Math.sin(x / per + ph);
  return y;
};
const smooth01 = (t) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };

export function createWorld(def) {
  const sh = def.shape, river = sh.kind === 'river', coast = sh.kind === 'coast';
  const line = river ? smoothLine(sh.pts) : null, coastY = coast ? coastLine(sh) : null;
  const halfW = (i) => sh.width * (1 + 0.16 * Math.sin(i * 0.11) + 0.1 * Math.sin(i * 0.037 + 1));

  function riverNear(x, y) {
    let best = 1e12, bi = 0;
    for (let i = 0; i < line.length; i += 2) { const dx = x - line[i][0], dy = y - line[i][1], d = dx * dx + dy * dy; if (d < best) { best = d; bi = i; } }
    return [bi, Math.sqrt(best)];
  }
  function rawWater(x, y) {
    if (coast) { if (y >= coastY(x)) return false; } else if (river) { const [i, d] = riverNear(x, y); if (d >= halfW(i)) return false; } else {
      const u = x / sh.ax, v = y / sh.ay;
      if (Math.hypot(u, v) >= lakeShape(Math.atan2(v, u), sh.ph)) return false;
    }
    for (const I of def.islands) {
      const dx = x - I.x, dy = y - I.y;
      if (Math.hypot(dx, dy) < isleShape(I, Math.atan2(dy, dx))) return false;
    }
    return true;
  }

  // 범위와 격자
  let bx0, bx1, by0, by1;
  if (coast) { bx0 = sh.x0 - 80; bx1 = sh.x1 + 80; by0 = sh.y0 - 80; by1 = sh.y1; } else if (river) {
    bx0 = Math.min(...line.map((p) => p[0])) - sh.width * 2 - 90; bx1 = Math.max(...line.map((p) => p[0])) + sh.width * 2 + 90;
    by0 = Math.min(...line.map((p) => p[1])) - 130; by1 = Math.max(...line.map((p) => p[1])) + 130;
  } else { bx0 = -sh.ax * 1.42 - 110; bx1 = sh.ax * 1.42 + 110; by0 = -sh.ay * 1.42 - 110; by1 = sh.ay * 1.42 + 110; }
  const CELL = coast ? 5 : river ? 4 : 3, X0 = bx0, Y0 = by0, GW = Math.ceil((bx1 - bx0) / CELL) + 1, GH = Math.ceil((by1 - by0) / CELL) + 1;
  const field = new Float32Array(GW * GH);
  (() => {
    const INF = 1e6, a = new Float32Array(GW * GH), b = new Float32Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const w = rawWater(X0 + i * CELL, Y0 + j * CELL);
      a[j * GW + i] = w ? INF : 0; b[j * GW + i] = w ? 0 : INF;
    }
    const S = CELL, Q = CELL * Math.SQRT2;
    for (const f of [a, b]) {
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const k = j * GW + i; let v = f[k];
        if (i > 0) v = Math.min(v, f[k - 1] + S);
        if (j > 0) { v = Math.min(v, f[k - GW] + S); if (i > 0) v = Math.min(v, f[k - GW - 1] + Q); if (i < GW - 1) v = Math.min(v, f[k - GW + 1] + Q); }
        f[k] = v;
      }
      for (let j = GH - 1; j >= 0; j--) for (let i = GW - 1; i >= 0; i--) {
        const k = j * GW + i; let v = f[k];
        if (i < GW - 1) v = Math.min(v, f[k + 1] + S);
        if (j < GH - 1) { v = Math.min(v, f[k + GW] + S); if (i < GW - 1) v = Math.min(v, f[k + GW + 1] + Q); if (i > 0) v = Math.min(v, f[k + GW - 1] + Q); }
        f[k] = v;
      }
    }
    for (let k = 0; k < field.length; k++) field[k] = a[k] > 0 ? a[k] - CELL / 2 : -(b[k] - CELL / 2);
  })();

  // 물가 거리(땅·섬만). 해안 지도는 바다 끝(동·서·북 경계)도 물가처럼 막아요: dist = min(물가, 경계)
  function landDist(x, y) {
    const fx = (x - X0) / CELL, fy = (y - Y0) / CELL;
    if (fx < 0 || fy < 0 || fx >= GW - 1 || fy >= GH - 1) return -200;
    const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * GW + i;
    return (field[k] * (1 - u) + field[k + 1] * u) * (1 - v) + (field[k + GW] * (1 - u) + field[k + GW + 1] * u) * v;
  }
  const edgeDist = coast ? (x, y) => Math.min(x - sh.x0, sh.x1 - x, y - sh.y0) : () => Infinity;
  const dist = coast ? (x, y) => Math.min(landDist(x, y), edgeDist(x, y)) : landDist;
  function gradient(x, y) {
    const e = CELL, gx = dist(x + e, y) - dist(x - e, y), gy = dist(x, y + e) - dist(x, y - e), m = Math.hypot(gx, gy) || 1;
    return [gx / m, gy / m];
  }
  const lineAvoid = (x0, y0, x1, y1, avoid) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 4)); for (let i = 1; i < n; i++) if (avoid(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false; return true; };
  function lineClear(x0, y0, x1, y1, clear) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 2));
    for (let i = 0; i <= n; i++) if (dist(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) < clear) return false;
    return true;
  }

  // 항로 찾기: 8m 칸 BFS로 길을 찾고, 직선으로 이어도 되는 점은 건너뛴다
  const NC = 8, NAV_CLEAR = 9, NW = Math.ceil((bx1 - bx0) / NC) + 1, NH = Math.ceil((by1 - by0) / NC) + 1;
  const passable = new Uint8Array(NW * NH);
  for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) passable[j * NW + i] = dist(X0 + i * NC, Y0 + j * NC) >= NAV_CLEAR ? 1 : 0;
  const cellOf = (x, y) => [Math.max(0, Math.min(NW - 1, Math.round((x - X0) / NC))), Math.max(0, Math.min(NH - 1, Math.round((y - Y0) / NC)))];
  function nearestPassable(x, y) {
    const [ci, cj] = cellOf(x, y);
    let best = -1, bd = Infinity;
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      if (!passable[j * NW + i]) continue;
      const d = (i - ci) ** 2 + (j - cj) ** 2;
      if (d < bd) { bd = d; best = j * NW + i; }
    }
    return best;
  }
  const nodeXY = (k) => [X0 + (k % NW) * NC, Y0 + Math.floor(k / NW) * NC];
  function nearestWater(x, y) {
    if (dist(x, y) >= NAV_CLEAR) return [x, y];
    return nodeXY(nearestPassable(x, y));
  }
  // avoid(x, y): 참이면 그 칸을 피해요(앞바다: 지금 물때에 배가 걸릴 모래톱). 출발·도착 칸은 늘 지나가요
  function findPath(x0, y0, x1, y1, avoid = null) {
    const s = nearestPassable(x0, y0), g = nearestPassable(x1, y1);
    const prev = new Int32Array(NW * NH).fill(-1), q = [s];
    prev[s] = s;
    for (let h = 0; h < q.length && prev[g] < 0; h++) {
      const k = q[h], i = k % NW, j = Math.floor(k / NW);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= NW || b >= NH) continue;
        const n = b * NW + a;
        if (!passable[n] || prev[n] >= 0) continue;
        if (di && dj && (!passable[j * NW + a] || !passable[b * NW + i])) continue; // 모서리 파고들지 않기
        if (avoid && n !== g && avoid(X0 + a * NC, Y0 + b * NC)) continue;
        prev[n] = k; q.push(n);
      }
    }
    if (prev[g] < 0) return null;
    const raw = [[x1, y1]];
    for (let k = g; ; k = prev[k]) { raw.push(nodeXY(k)); if (k === s) break; }
    raw.reverse();
    const out = []; let ax = x0, ay = y0, i = 0;
    while (i < raw.length) {
      let far = i;
      for (let j = raw.length - 1; j > i; j--) if (lineClear(ax, ay, raw[j][0], raw[j][1], NAV_CLEAR - 2) && (!avoid || lineAvoid(ax, ay, raw[j][0], raw[j][1], avoid))) { far = j; break; }
      out.push({ x: raw[far][0], y: raw[far][1] });
      ax = raw[far][0]; ay = raw[far][1]; i = far + 1;
    }
    return out;
  }

  // 그림용 윤곽. d > 0이면 땅 쪽으로, d < 0이면 물 쪽으로 d m 옮긴다.
  function outlines(d, n = 420) {
    const out = [];
    if (coast) {
      // 해안선을 3m마다 짚고 뭍 쪽 법선으로 d만큼 옮긴다. 바다 쪽은 지도 밖 멀리까지 닫아 물로 칠해요
      const pts = [];
      for (let x = bx0 - 40; x <= bx1 + 40; x += 3) pts.push([x, coastY(x)]);
      const off = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1; return [p[0] - ty / m * d, p[1] + tx / m * d]; });
      out.push([[-2990, off[0][1]], ...off, [2990, off[off.length - 1][1]], [2990, -2990], [-2990, -2990]]);
    } else if (river) {
      const L = [], R = [];
      for (let i = 0; i < line.length; i++) {
        const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
        const tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1, w = halfW(i) + d;
        L.push([line[i][0] - ty / m * w, line[i][1] + tx / m * w]);
        R.push([line[i][0] + ty / m * w, line[i][1] - tx / m * w]);
      }
      // 양 끝은 둥글게 닫는다
      const cap = (c, from, to) => { const pts = []; const r = Math.hypot(from[0] - c[0], from[1] - c[1]), a0 = Math.atan2(from[1] - c[1], from[0] - c[0]); let a1 = Math.atan2(to[1] - c[1], to[0] - c[0]); if (a1 < a0) a1 += TAU; for (let k = 1; k < 10; k++) { const a = a0 + (a1 - a0) * k / 10; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } return pts; };
      const end = line[line.length - 1], start = line[0];
      out.push([...L, ...cap(end, L[L.length - 1], R[R.length - 1]), ...R.reverse(), ...cap(start, R[R.length - 1] ?? start, L[0])]);
    } else {
      const lake = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, r = lakeShape(a, sh.ph);
        const x = Math.cos(a) * r * sh.ax, y = Math.sin(a) * r * sh.ay, m = Math.hypot(x, y) || 1;
        lake.push([x + x / m * d, y + y / m * d]);
      }
      out.push(lake);
    }
    for (const I of def.islands) {
      const pts = [];
      for (let i = 0; i < 72; i++) {
        const a = i / 72 * TAU, r = isleShape(I, a) - d;
        if (r > 0.3) pts.push([I.x + Math.cos(a) * r, I.y + Math.sin(a) * r]);
      }
      if (pts.length > 8) out.push(pts);
    }
    return out;
  }

  // 땅 위에 나무·바위를 시드로 흩어 놓는다(바꾸지 않음, 저장하지 않음). pick: (물가 거리, 난수, x, y) → 종류(themes.js 테마 표). null이면 비워 둔다
  const lakePick = (d, r) => d > -6 ? (r < 0.5 ? 'rock' : r < 0.8 ? 'bush' : 'reed') : r < 0.46 ? 'pine' : r < 0.86 ? 'oak' : r < 0.95 ? 'bush' : 'rock';
  function scatter(seed = 11, pick = lakePick, opt = {}) {
    let s = seed >>> 0;
    const rnd = () => (s = (s + 0x6D2B79F5) >>> 0, ((s ^ (s >>> 15)) * (1 | s) >>> 0) / 4294967296);
    const out = [], used = new Set(), W2 = bx1 - bx0, H2 = by1 - by0, area = W2 * H2 / 1000;
    const k = opt.k ?? 1, tries = Math.min(opt.tries ?? 40000, area * 40 * k), cap = Math.min(opt.cap ?? 1400, area * 2.2 * k); // opt: 테마의 빽빽함
    for (let t = 0; t < tries && out.length < cap; t++) {
      const x = bx0 + rnd() * W2, y = by0 + rnd() * H2, d = landDist(x, y); // 바다 끝 너머(지도 밖)엔 심지 않아요
      if (d > -2.5 || d <= -199) continue;
      if (rnd() > Math.min(1, 0.14 + (-d) / 34)) continue;
      const key = `${Math.round(x / 7)},${Math.round(y / 7)}`;
      if (used.has(key)) continue;
      used.add(key);
      const r = rnd(), kind = pick(d, r, x, y);
      if (!kind) continue;
      out.push({ x, y, kind, v: rnd(), size: 0.8 + rnd() * 0.5 });
    }
    return out.sort((a, b) => a.y - b.y);
  }

  // 물살(강에서 중심선을 따라 흐른다)
  function flowAt(x, y) {
    if (!river || !def.flow) return [0, 0];
    const [i, d] = riverNear(x, y);
    const a = line[Math.max(0, i - 2)], b = line[Math.min(line.length - 1, i + 2)], m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = def.flow * Math.max(0.25, 1 - (d / (sh.width * 1.1)) ** 2);
    return [(b[0] - a[0]) / m * k, (b[1] - a[1]) / m * k];
  }
  // 여울 수심(없으면 Infinity). tide: 조수로 오르내린 물높이(m, 앞바다만. 거리 격자는 그대로고 얕은 곳만 바뀌어요)
  function depthAt(x, y, tide = 0) {
    let v = Infinity;
    for (const s of def.shoals || []) { const q = Math.hypot(x - s.x, y - s.y); if (q < s.r) v = Math.min(v, s.depth + (q / s.r) ** 2 * 0.7); }
    return v + tide;
  }
  // 너울 자리 배율(0~1): 바깥 바다(남쪽 기준선에서 북쪽으로 ramp m)에서 커지고, 두 곶 사이 만 안쪽은 잔잔해요
  function swellAt(x, y) {
    const q = sh.swell;
    if (!q) return 0;
    const open = smooth01((q.y - y) / q.ramp), bay = smooth01((x - q.bay[0]) / 70) * smooth01((q.bay[1] - x) / 70) * smooth01((y - q.bay[2]) / 90);
    return open * (1 - 0.85 * bay);
  }

  // 항구·수문·발견지 자리: 물가에 가까운 물 위로 맞춘다
  const snap = (p) => { const [x, y] = nearestWater(p.x, p.y); return { ...p, x, y }; };
  // 물가에서 뭍 쪽으로 depth m 들어간 자리
  function landSpot(x, y, depth) {
    let px = x, py = y;
    for (let i = 0; i < 300 && dist(px, py) > -depth; i++) { const [gx, gy] = gradient(px, py); px -= gx * 2; py -= gy * 2; }
    return [px, py];
  }
  // 발견지 자리(M2b where 칸): water 물 위 · shore 물가 뭍(3m, depth로 바꿔요) · beach 물가에서 물 쪽으로 3m(썰물에 드러나는 조간대, 조수 웅덩이) · inland가 있으면 그만큼 내륙
  const whereOf = (f) => (f.where === 'water' ? 'water' : f.inland ? 'inland' : f.where === 'beach' ? 'beach' : 'shore');
  const depthOf = (f) => f.inland || f.depth || (f.where === 'beach' ? -3 : 3); // 음수면 물 쪽
  const finds = def.finds.map((f) => {
    const w = snap(f);
    if (whereOf(f) === 'water') return { ...w, where: 'water' };
    const [x, y] = landSpot(w.x, w.y, depthOf(f));
    return { ...f, x, y, where: whereOf(f) };
  });
  // 배 대는 자리는 물가에서 12m 안쪽으로 당긴다. 너무 멀면 부두가 닿지 않아 배가 물 한가운데 떠 보인다
  const dockSpot = (p) => {
    let { x, y } = p;
    for (let i = 0; i < 20 && dist(x, y) > 12.5; i++) { const [gx, gy] = gradient(x, y), d = dist(x, y); x -= gx * (d - 12); y -= gy * (d - 12); }
    return { ...p, x, y };
  };
  const ports = def.ports.map(snap).map(dockSpot), gates = def.gates.map(snap);
  // 2등급 이상 맵: 처음 들어갈 때 발견지 자리를 정한다. 목록과 개수는 표 그대로이고 자리만 달라진다
  function randomFinds(rnd) {
    const taken = [...ports, ...gates], out = [];
    const clear = (x, y) => taken.every((q) => Math.hypot(q.x - x, q.y - y) > 45) && out.every((q) => Math.hypot(q.x - x, q.y - y) > 40);
    def.finds.forEach((f, i) => {
      let done = null;
      for (let t = 0; t < 600 && !done; t++) {
        const x = bx0 + rnd() * (bx1 - bx0), y = by0 + rnd() * (by1 - by0), d = dist(x, y);
        if (d < 12) continue; // 물 위에서 고른 뒤
        if (coast && edgeDist(x, y) < 70) continue; // 해안 지도: 큰 바다 경계(짙은 안개 띠) 근처는 빼요
        const where = whereOf(f);
        if (where === 'water') { if (clear(x, y)) done = { ...f, x, y, where }; continue; }
        if (d > 34) continue; // 물가 가까이에서 뭍으로 들어간다
        const depth = depthOf(f), [px, py] = landSpot(x, y, depth), q = landDist(px, py);
        if (q > -depth + 1 || q < -depth - 8 || !clear(px, py)) continue;
        done = { ...f, x: px, y: py, where };
      }
      out.push(done || finds[i]);
    });
    return out;
  }

  return { id: def.id, def, randomFinds, whereOf, dist, landDist, edgeDist, isWater: (x, y) => dist(x, y) > 0, gradient, lineClear, nearestWater, findPath, outlines, scatter, flowAt, depthAt, swellAt, ports, gates, finds, bounds: [bx0, by0, bx1, by1], river, coast, cell: CELL, grid: [GW, GH], coastY };
}

const cache = {};
export const worldOf = (id) => cache[id] || (cache[id] = createWorld(REGIONS[id]));
