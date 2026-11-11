// 생활형별 이동. 생물의 위치·상태는 여기서 정하고 화면은 그리기만 한다(PLAN 3절).
//   walker 육지형 · crawler 바닥형: 칸 격자 너비 우선 탐색(BFS) [AW logic.js `findPath`·`decide`를 옮김]
//   sessile 고착형: 놓인 자리에 붙어 있음
//   swimmer 유영형 · surfacer 수면형: 물기둥 3차원. 곧은 길이 비면 곧장, 막히면 거친 3D 격자(칸 × 1칸 높이) BFS로 돌아감
//   drifter 표류형: 길찾기 없이 천천히 떠다니며 막히면 방향을 돌림
//   surfacer 수면형: 정해진 간격으로 수면에 올라 숨 쉬고, 가끔 정해진 지형의 뭍에 올라 쉼
// 생태계 이름·지형 이름은 모른다. eco.species의 life·speed·roam·home·breath·bask와 space가 주는 판정만 쓴다.
import { rnd, range, pick, clamp } from './util.js';

export const LIFE = {
  walker: { pool: 'land', ground: 'land' },
  crawler: { pool: 'water', ground: 'bed' },
  sessile: { pool: 'water', fixed: true },
  swimmer: { pool: 'water', swim: true },
  drifter: { pool: 'water', swim: true, drift: true },
  surfacer: { pool: 'both', swim: true, breathe: true },
};
const DUR = { eat: 3.5, drink: 3, rest: 6 }; // [AW logic.js `arrive`]
// 길 점: [x, y, z, 방식] 방식 0 헤엄 · 1 뭍 걷기 · 2 바닥 걷기 · 3 수면까지 헤엄
const SWIM = 0, LAND = 1, BED = 2, SURF = 3;

export function createMover(eco, sp) {
  const SPECIES = eco.species, ITEMS = eco.items, NEEDS = eco.needs;
  const supplyNeeds = (s) => s.needs.filter((k) => NEEDS[k]?.supply);
  const act = (k) => NEEDS[k]?.act || null;
  const N = sp.N, LV = Math.max(1, Math.ceil(sp.maxDepth || 1)); // 3D 격자 높이 칸 수
  const zOf = (k) => sp.seaZ - (k + 0.5);
  const kOf = (z) => clamp(Math.floor(sp.seaZ - z), 0, LV - 1);
  const ctr = (i) => [sp.cx(i) + 0.5, sp.cy(i) + 0.5];

  // ---------- 2D 격자 BFS(땅·바닥) ----------
  const seen2 = new Uint32Array(N), par2 = new Int32Array(N), q2 = new Int32Array(N);
  let stamp2 = 0;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // from에서 걸을 수 있는 칸만 지나 goal(i)인 가장 가까운 칸까지. 결과는 시작 칸을 뺀 칸 목록(없으면 null)
  function bfs2(S, from, goal, mode, limit = N) {
    if (from < 0) return null;
    stamp2++;
    seen2[from] = stamp2; par2[from] = -1; q2[0] = from;
    let n = 1;
    for (let h = 0; h < n && h < limit; h++) {
      const cur = q2[h];
      if (goal(cur)) { const p = []; for (let c = cur; c !== from; c = par2[c]) p.push(c); return p.reverse(); }
      const x = sp.cx(cur), y = sp.cy(cur);
      for (const [dx, dy] of NB) {
        const j = sp.cellOf(x + dx, y + dy);
        if (j >= 0 && seen2[j] !== stamp2 && sp.canWalk(S, j, mode)) { seen2[j] = stamp2; par2[j] = cur; q2[n++] = j; }
      }
    }
    return null;
  }
  // 필요 k를 채우는 칸: 걷는 물건이면 그 칸, 아니면 물건 바로 옆 칸(대각선 모서리 제외) [AW `servesAt`]
  function servesAt(S, mode, k) {
    const key = `sv:${mode}:${k}`;
    return cachedOn(S, key, () => {
      const set = new Uint8Array(N);
      for (const it of S.items) {
        const d = ITEMS[it.id];
        if (!d.give[k] || (mode === 'land') !== (d.zone === 'land') || d.zone === 'water') continue;
        for (let y = it.y - 1; y <= it.y + d.h; y++) for (let x = it.x - 1; x <= it.x + d.w; x++) {
          const i = sp.cellOf(x, y);
          if (i < 0) continue;
          const inside = x >= it.x && y >= it.y && x < it.x + d.w && y < it.y + d.h;
          const edge = !inside && ((x >= it.x && x < it.x + d.w) || (y >= it.y && y < it.y + d.h));
          if ((inside && d.walk && sp.canWalk(S, i, mode)) || (edge && sp.canWalk(S, i, mode))) set[i] = 1;
        }
      }
      return set;
    });
  }
  const memo = new WeakMap();
  function cachedOn(S, key, make) {
    let c = memo.get(S);
    if (!c || c.rev !== S.rev) { c = { rev: S.rev }; memo.set(S, c); }
    if (!(key in c)) c[key] = make();
    return c[key];
  }

  // ---------- 물기둥 ----------
  // 곧은 선분이 비었나(0.25칸마다, 바닥에서 0.15칸 더 띄워 확인 — 점 사이 칸 경계에서 바닥에 닿지 않게). 숨 쉬고 내려가는 첫 0.6칸은 수면 가까이도 된다
  function los(S, s, a, b, surf) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz), n = Math.max(1, Math.ceil(d / 0.25));
    const at = (u, pad) => { const x = a[0] + dx * u, y = a[1] + dy * u, z = a[2] + dz * u; return sp.freePoint(S, sp.cellAt(x, y), z, s, surf || u * d < 0.6, pad); };
    for (let t = 1; t <= n; t++) if (!at(t / n, t < n ? 0.15 : 0)) return false;
    // 칸 경계를 지나는 곳 바로 앞뒤도 본다(칸 모서리를 살짝 스치는 경우)
    for (const [p0, dp] of [[a[0], dx], [a[1], dy]]) {
      if (Math.abs(dp) < 1e-9) continue;
      const lo = Math.min(p0, p0 + dp), hi = Math.max(p0, p0 + dp);
      for (let X = Math.ceil(lo); X <= hi; X++) {
        const u = (X - p0) / dp;
        if (u <= 0 || u >= 1) continue;
        if (!at(u - 1e-4, 0) || !at(u + 1e-4, 0)) return false;
      }
    }
    return true;
  }
  const seen3 = new Uint32Array(N * LV), par3 = new Int32Array(N * LV), q3 = new Int32Array(N * LV);
  let stamp3 = 0;
  const LIMIT3 = 9000; // 한 번에 살펴보는 3D 칸 수 상한(넘으면 포기하고 다음에 다시 고른다)
  function nodeOk(S, s, i, k, surf) { return sp.freePoint(S, i, zOf(k), s, surf); }
  function nearK(S, s, i, z, surf) {
    const k0 = kOf(z);
    for (let d = 0; d < LV; d++) for (const k of [k0 - d, k0 + d]) if (k >= 0 && k < LV && nodeOk(S, s, i, k, surf)) return k;
    return -1;
  }
  // a 위치에서 목표점 t까지의 길 점 목록(없으면 null)
  function path3(S, a, s, t, surf = false) {
    const from = [a.x, a.y, a.z];
    if (los(S, s, from, t, surf)) return [[t[0], t[1], t[2], surf ? SURF : SWIM]];
    const si = sp.cellAt(a.x, a.y), gi = sp.cellAt(t[0], t[1]);
    if (si < 0 || gi < 0) return null;
    const sk = nearK(S, s, si, a.z, surf), gk = nearK(S, s, gi, t[2], surf);
    if (sk < 0 || gk < 0) return null;
    const start = si * LV + sk, goal = gi * LV + gk;
    stamp3++;
    seen3[start] = stamp3; par3[start] = -1; q3[0] = start;
    let n = 1, found = -1;
    for (let h = 0; h < n && h < LIMIT3; h++) {
      const cur = q3[h];
      if (cur === goal) { found = cur; break; }
      const i = (cur / LV) | 0, k = cur - i * LV, x = sp.cx(i), y = sp.cy(i);
      const push = (j, kk) => {
        const nd = j * LV + kk;
        if (seen3[nd] !== stamp3 && nodeOk(S, s, j, kk, surf)) { seen3[nd] = stamp3; par3[nd] = cur; q3[n++] = nd; }
      };
      for (const [dx, dy] of NB) { const j = sp.cellOf(x + dx, y + dy); if (j >= 0) push(j, k); }
      if (k > 0) push(i, k - 1);
      if (k < LV - 1) push(i, k + 1);
    }
    if (found < 0) return null;
    const nodes = [];
    for (let c = found; c !== -1; c = par3[c]) { const i = (c / LV) | 0, k = c - i * LV, [x, y] = ctr(i); nodes.push([x, y, zOf(k)]); }
    nodes.reverse(); // 시작 칸 가운데부터(제자리에서 칸 가운데로 간 뒤 옆 칸으로)
    nodes.push(t);
    // 곧게 펴기: 지금 점에서 곧장 갈 수 있는 가장 먼 점으로 건너뛴다(앞으로 8점까지 본다)
    const out = [];
    let anchor = from;
    for (let i = 0; i < nodes.length;) {
      let j = Math.min(nodes.length - 1, i + 8);
      while (j > i && !los(S, s, anchor, nodes[j], surf)) j--;
      out.push([nodes[j][0], nodes[j][1], nodes[j][2], surf ? SURF : SWIM]);
      anchor = nodes[j];
      i = j + 1;
    }
    return out;
  }

  // ---------- 상태 바꾸기 ----------
  function go(a, pts, goal) { a.st = 'move'; a.path = pts; a.goal = goal; }
  function stop(a, t) { a.st = 'idle'; a.t = t; a.path = null; a.goal = null; }
  function arrive(S, a, s, goal) {
    a.path = null; a.goal = null; a.pitch = 0;
    if (goal && DUR[goal]) { a.st = goal; a.t = DUR[goal]; return; }
    if (goal === 'breathe') { a.st = 'breathe'; a.t = 3; a.breath = range(S, s.breath[0], s.breath[1]); return; }
    if (goal === 'bask') { a.st = 'bask'; a.t = range(S, 12, 20); return; }
    a.st = 'idle'; a.t = 1.2;
  }
  const onLand = (a) => { const i = sp.cellAt(a.x, a.y); return i >= 0 && !sp.wet[i]; };
  const hostOf = (S, a) => (a.host ? S.animals.find((b) => b.uid === a.host) : null);
  const mateOf = (S, a) => { const m = S.animals.filter((b) => b !== a && b.sp === a.sp); return m.length ? pick(S, m) : null; };
  const hostCenter = (h) => { const f = SPECIES[h.sp].foot || 1; return [h.fx + f / 2, h.fy + f / 2]; };

  // ---------- 판단 ----------
  function decideGround(S, a, s, mode) {
    const from = sp.cellAt(a.x, a.y), r = rnd(S), needs = supplyNeeds(s);
    if (r < 0.38 && needs.length) {
      const k = pick(S, needs), set = servesAt(S, mode, k);
      const path = bfs2(S, from, (i) => set[i] === 1, mode);
      if (path) return go(a, toPts(a, path, mode), act(k));
    }
    if (r < 0.8) {
      let c = from, rad = s.roam ?? 10;
      if (s.needs.includes('herd') && rnd(S) < 0.6) { const m = mateOf(S, a); if (m) { c = sp.cellAt(m.x, m.y); rad = 4; } }
      if (c >= 0) {
        const t = sp.cellOf(sp.cx(c) + Math.round(range(S, -rad, rad)), sp.cy(c) + Math.round(range(S, -rad, rad)));
        if (t >= 0 && t !== from && sp.canWalk(S, t, mode)) {
          const path = bfs2(S, from, (i) => i === t, mode, 3000);
          if (path && path.length) return go(a, toPts(a, path, mode), null);
        }
      }
    }
    stop(a, range(S, 1.5, 4.5));
  }
  function toPts(a, cells, mode) {
    return cells.map((i, n) => { const [x, y] = ctr(i), last = n === cells.length - 1; return [x + (last ? a.jx : 0), y + (last ? a.jy : 0), sp.bottomZ(i), mode === 'land' ? LAND : BED]; });
  }
  // 물기둥 안의 빈 점 하나(그 칸의 바닥·수면 사이, 집이 있으면 집 둘레)
  function waterPoint(S, a, s, x, y, zlo = -Infinity, zhi = Infinity) {
    const i = sp.cellAt(x, y);
    if (i < 0 || !sp.wet[i]) return null;
    const lo = Math.max(sp.bottomZ(i) + 0.4, zlo), hi = Math.min(sp.seaZ - 0.35, zhi);
    if (lo > hi) return null;
    const z = range(S, lo, hi);
    return sp.freePoint(S, i, z, s) ? [x, y, z] : null;
  }
  function wanderPoint(S, a, s) {
    const h = s.home ? hostOf(S, a) : null;
    for (let tries = 0; tries < 6; tries++) {
      let c = [a.x, a.y], rad = s.roam ?? 10, zhi = Infinity;
      if (h) { c = hostCenter(h); rad = s.home.r + (SPECIES[h.sp].foot || 1) / 2; zhi = sp.bottomZ(sp.cellAt(c[0], c[1])) + s.home.h; }
      else if (s.needs.includes('herd') && rnd(S) < 0.6) { const m = mateOf(S, a); if (m) { c = [m.x, m.y]; rad = 4; } }
      const p = waterPoint(S, a, s, c[0] + range(S, -rad, rad), c[1] + range(S, -rad, rad), -Infinity, zhi);
      if (p) return p;
    }
    return null;
  }
  // 필요 k를 주는 물속 물건 둘레의 점
  function needPoint(S, a, s, k) {
    const list = S.items.filter((it) => ITEMS[it.id].give[k] && ITEMS[it.id].zone !== 'land');
    if (!list.length) return null;
    const it = pick(S, list), d = ITEMS[it.id], z0 = sp.itemZ(it);
    for (let tries = 0; tries < 6; tries++) {
      const x = it.x + range(S, -1, d.w + 1), y = it.y + range(S, -1, d.h + 1);
      const p = d.zone === 'water' ? waterPoint(S, a, s, x, y, z0 - 1, z0 + 1) : waterPoint(S, a, s, x, y, -Infinity, z0 + 2.5);
      if (p) return p;
    }
    return null;
  }
  function goBreathe(S, a, s) {
    const p = path3(S, a, s, [a.x, a.y, sp.seaZ - 0.1], true);
    if (p) go(a, p, 'breathe'); else a.breath = 5;
  }
  function goBask(S, a, s) {
    const busy = S.animals.filter((b) => b.sp === a.sp && (onLand(b) || b.goal === 'bask')).length;
    if (busy >= (s.baskMax ?? Infinity)) return false;
    const rad = s.roam ?? 10, list = sp.shores(s.bask).filter((p) => sp.canWalk(S, p.land, 'land') && Math.hypot(sp.cx(p.sea) + 0.5 - a.x, sp.cy(p.sea) + 0.5 - a.y) <= rad);
    if (!list.length) return false;
    const p = pick(S, list), [sx, sy] = ctr(p.sea), sea = [sx, sy, sp.seaZ - 0.35];
    if (!sp.freePoint(S, p.sea, sea[2], s)) return false;
    const path = path3(S, a, s, sea);
    if (!path) return false;
    const [lx, ly] = ctr(p.land);
    go(a, [...path, [lx, ly, sp.bottomZ(p.land), LAND]], 'bask');
    return true;
  }
  // 뭍에서 물로 돌아가기: 가까운 물가 육지 칸까지 걸어가 물로 한 걸음
  function goSea(S, a, s) {
    const from = sp.cellAt(a.x, a.y), sh = sp.shores(s.bask || []), byLand = new Map();
    for (const p of sh) if (!byLand.has(p.land)) byLand.set(p.land, p.sea);
    let cells = byLand.has(from) ? [] : bfs2(S, from, (i) => byLand.has(i), 'land');
    if (!cells) { // 물가가 없으면(지형이 바뀐 세이브) 가장 가까운 물 칸으로 옮긴다
      relocateSwim(S, a, s); return stop(a, 0.5);
    }
    const end = cells.length ? cells[cells.length - 1] : from, sea = byLand.get(end), [sx, sy] = ctr(sea);
    go(a, [...cells.map((i) => { const [x, y] = ctr(i); return [x, y, sp.bottomZ(i), LAND]; }), [sx, sy, sp.seaZ - 0.35, SWIM]], null);
  }
  function decideSwim(S, a, s, L) {
    if (L.breathe && onLand(a)) return goSea(S, a, s);
    if (L.breathe && s.bask && rnd(S) < 0.12 && goBask(S, a, s)) return;
    const r = rnd(S), needs = supplyNeeds(s);
    if (r < 0.3 && needs.length) {
      const k = pick(S, needs), t = s.home ? wanderPoint(S, a, s) : needPoint(S, a, s, k); // 집이 있는 생물은 집 둘레에서 먹고 쉰다
      if (t) { const p = path3(S, a, s, t); if (p) return go(a, p, act(k)); }
    }
    if (r < 0.85) {
      const t = wanderPoint(S, a, s);
      if (t) { const p = path3(S, a, s, t); if (p) return go(a, p, null); }
    }
    stop(a, range(S, 1, 3));
  }
  function decideDrift(S, a, s) {
    if (rnd(S) < 0.25) return stop(a, range(S, 2, 4)); // 제자리에서 오르내리며 박동
    a.st = 'move'; a.t = range(S, 4, 9); a.path = null; a.goal = null;
    const i = sp.cellAt(a.x, a.y), lo = sp.bottomZ(i) + 0.5, hi = sp.seaZ - 0.4;
    a.tz = lo < hi ? range(S, lo, hi) : a.z;
    if (s.needs.includes('herd') && rnd(S) < 0.5) { const m = mateOf(S, a); if (m && Math.hypot(m.x - a.x, m.y - a.y) > 4) a.hd = Math.atan2(m.y - a.y, m.x - a.x); }
  }
  function decide(S, a) {
    const s = SPECIES[a.sp], L = LIFE[s.life];
    if (L.fixed) { a.st = rnd(S) < 0.4 ? 'eat' : 'idle'; a.t = range(S, 3, 6); return; }
    if (L.drift) return decideDrift(S, a, s);
    if (L.swim) return decideSwim(S, a, s, L);
    return decideGround(S, a, s, L.ground);
  }

  // ---------- 움직이기 ----------
  function pointOk(S, a, s, p) {
    const i = sp.cellAt(p[0], p[1]);
    if (p[3] === LAND) return sp.canWalk(S, i, 'land');
    if (p[3] === BED) return sp.canWalk(S, i, 'bed');
    return sp.freePoint(S, i, p[2], s, p[3] === SURF);
  }
  function follow(S, a, s, dt) {
    let left = s.speed * dt;
    while (left > 0 && a.path && a.path.length) {
      const p = a.path[0];
      if (!pointOk(S, a, s, p)) { stop(a, 0.3); return; }
      const dx = p[0] - a.x, dy = p[1] - a.y, dz = p[2] - a.z, hd = Math.hypot(dx, dy), d = Math.hypot(hd, dz);
      if (hd > 1e-3) a.face = Math.atan2(dy, dx);
      a.pitch = p[3] === SWIM || p[3] === SURF ? Math.atan2(dz, Math.max(hd, 1e-6)) : 0;
      if (d <= left) { a.x = p[0]; a.y = p[1]; a.z = p[2]; left -= d; a.path.shift(); }
      else { a.x += (dx / d) * left; a.y += (dy / d) * left; a.z += (dz / d) * left; left = 0; }
      if (p[3] === LAND || p[3] === BED) { const i = sp.cellAt(a.x, a.y); if (i >= 0 && (p[3] === BED || !sp.wet[i])) a.z = sp.bottomZ(i); } // 물에서 뭍으로 오를 때는 높이를 이어서
    }
    if (!a.path || !a.path.length) arrive(S, a, s, a.goal);
  }
  function drift(S, a, s, dt) {
    a.hd += Math.sin(a.ph * 0.7 + a.uid) * 0.35 * dt; // 느린 물흐름(시드 난수를 쓰지 않는 결정적 흔들림)
    const v = s.speed, nx = a.x + Math.cos(a.hd) * v * dt, ny = a.y + Math.sin(a.hd) * v * dt;
    const nz = a.z + clamp(a.tz - a.z, -1, 1) * 0.3 * dt;
    if (sp.freePoint(S, sp.cellAt(nx, ny), nz, s)) { a.x = nx; a.y = ny; a.z = nz; }
    else if (sp.freePoint(S, sp.cellAt(a.x, a.y), nz, s)) { a.z = nz; a.hd += Math.PI * 0.75; }
    else { a.hd += Math.PI * 0.75; a.tz = a.z; }
    a.face = a.hd; a.pitch = 0;
    a.t -= dt;
    if (a.t <= 0) decide(S, a);
  }
  function update(S, a, dt) {
    a.ph += dt;
    const s = SPECIES[a.sp], L = LIFE[s.life];
    if (L.breathe && a.st !== 'special' && a.st !== 'breathe' && a.st !== 'bask' && a.goal !== 'breathe' && a.goal !== 'bask' && !onLand(a)) {
      a.breath -= dt;
      if (a.breath <= 0) return goBreathe(S, a, s);
    }
    if (a.st === 'move') return L.drift ? drift(S, a, s, dt) : follow(S, a, s, dt);
    a.t -= dt;
    if (a.t <= 0) decide(S, a);
  }

  // ---------- 나오기·자리 고치기 ----------
  function cellsWhere(S, fn) { const out = []; for (let i = 0; i < N; i++) if (fn(i)) out.push(i); return out; }
  function relocateSwim(S, a, s) {
    const c = sp.cellAt(a.x, a.y), x = c >= 0 ? sp.cx(c) : 0, y = c >= 0 ? sp.cy(c) : 0;
    for (let r = 0; r <= 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const i = sp.cellOf(x + dx, y + dy);
      if (i < 0) continue;
      const k = nearK(S, s, i, a.z, false);
      if (k >= 0) { const [px, py] = ctr(i); a.x = px; a.y = py; a.z = zOf(k); return true; }
    }
    return spawn(S, a);
  }
  function spawn(S, a) {
    const s = SPECIES[a.sp], L = LIFE[s.life];
    a.pitch = 0;
    if (L.fixed) { const f = s.foot || 1; a.x = a.fx + f / 2; a.y = a.fy + f / 2; let z = -Infinity; sp.foot({ w: f, h: f }, a.fx, a.fy, (i) => { z = Math.max(z, sp.bottomZ(i)); }); a.z = z; return true; }
    if (!L.swim) {
      const list = cellsWhere(S, (i) => sp.canWalk(S, i, L.ground));
      if (!list.length) return false;
      const i = pick(S, list), [x, y] = ctr(i);
      a.x = x + a.jx; a.y = y + a.jy; a.z = sp.bottomZ(i);
      return true;
    }
    const h = s.home ? hostOf(S, a) : null;
    if (h) { // 집이 있는 생물은 집 둘레에서 나온다
      for (let tries = 0; tries < 40; tries++) { const p = wanderPoint(S, a, s); if (p) { [a.x, a.y, a.z] = p; return true; } }
    }
    const list = cellsWhere(S, (i) => sp.wet[i] && sp.swimK[i] && !sp.lockedCell(S, i));
    for (let tries = 0; tries < 40 && list.length; tries++) {
      const i = pick(S, list), [x, y] = ctr(i), p = waterPoint(S, a, s, x + a.jx, y + a.jy);
      if (p) { [a.x, a.y, a.z] = p; if (L.drift) { a.hd = range(S, -Math.PI, Math.PI); a.tz = a.z; } return true; }
    }
    return false;
  }
  // 물건이 놓이거나 치워진 뒤·불러온 뒤: 막힌 자리에 있는 생물은 가까운 빈자리로 옮기고, 가던 길은 다시 정한다 [AW `reroute`]
  // keep = true면 가던 길은 그대로 둔다(불러올 때: 막힌 자리의 생물만 옮기고 상태는 건드리지 않음)
  function fix(S, keep = false) {
    for (const a of S.animals) {
      const s = SPECIES[a.sp], L = LIFE[s.life], i = sp.cellAt(a.x, a.y);
      if (L.fixed) continue;
      if (L.swim) {
        if (L.breathe && onLand(a)) { if (!sp.canWalk(S, i, 'land')) relocateSwim(S, a, s); }
        else if (!sp.freePoint(S, i, a.z, s, true)) relocateSwim(S, a, s);
      } else if (!sp.canWalk(S, i, L.ground)) {
        const p = bfs2(S, i, (j) => j !== i && sp.canWalk(S, j, L.ground), L.ground);
        if (p && p.length) { const [x, y] = ctr(p[p.length - 1]); a.x = x; a.y = y; a.z = sp.bottomZ(p[p.length - 1]); }
        else spawn(S, a);
      }
      if (!keep && a.st === 'move' && !L.drift) stop(a, range(S, 0.2, 0.8));
    }
  }
  // 생물이 지금 있는 곳: 'land' 뭍 · 'bed' 물 밑 바닥 · 'water' 물기둥
  function whereOf(a) {
    const L = LIFE[SPECIES[a.sp].life];
    if (onLand(a)) return 'land';
    return L.swim ? 'water' : 'bed';
  }

  return { update, spawn, fix, decide, whereOf, onLand, bfs2, path3, servesAt, stop };
}
