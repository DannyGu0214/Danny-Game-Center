// 게임 규칙 전부(화면 없음). 경제·한도·발전도·행복도·티어·요청·순간 포착·동물 행동·저장 형식.
// 상태 S는 JSON으로 그대로 저장할 수 있는 순수 데이터다. 난수는 S.rng(시드)에서만 뽑는다.
import {
  GRID, MAX_TIER, TIERS, caps, SIZE, ECON, REGIONS, SPECIES, ITEMS,
  animalValue, itemPoints, animalPrice, itemPrice, speciesOf, itemsOf,
} from './data.js';
import { TERRAIN, kindAt, terrainFits, allowedOn, hasWater, terrainOf } from './terrain.js';

export const STEP = 1 / 30;
export const SAVE_VERSION = 1;
const SAVE_KEYS = ['v', 'rng', 'pop', 'earned', 'time', 'savedAt', 'view', 'regions', 'album', 'requests', 'reqSwapAt', 'chance', 'chanceIn', 'uid'];

// ---------- 난수(mulberry32) ----------
function rnd(S) {
  let t = (S.rng = (S.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const range = (S, a, b) => a + rnd(S) * (b - a);
const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 새 게임 ----------
export function newGame(seed = 1, now = Date.now()) {
  const S = {
    v: SAVE_VERSION, rng: seed | 0 || 1, pop: ECON.start, earned: 0, time: 0, savedAt: now,
    view: 'grassland', regions: {}, album: {}, requests: [], reqSwapAt: 0,
    chance: null, chanceIn: 12, uid: 1, events: [],
  };
  for (const r of REGIONS) S.regions[r.id] = { tier: 1, items: [], animals: [] };
  fillRequests(S);
  return S;
}

export const regionDef = (id) => REGIONS.find((r) => r.id === id);
export function isUnlocked(S, id) {
  const d = regionDef(id);
  return !d.unlock || S.regions[d.unlock.region].tier >= d.unlock.tier;
}

// ---------- 계산 캐시: 구성이 바뀔 때마다 S.rev를 올리고, 같은 rev 동안은 다시 계산하지 않는다 ----------
const cache = new WeakMap();
function cached(S, key, make) {
  let c = cache.get(S);
  if (!c || c.rev !== S.rev) { c = { rev: S.rev }; cache.set(S, c); }
  if (!(key in c)) c[key] = make();
  return c[key];
}
const touch = (S) => { S.rev = (S.rev || 0) + 1; };

// ---------- 발전도·행복도 ----------
export function stats(S, rid) {
  return cached(S, 'st:' + rid, () => {
    const R = S.regions[rid];
    const counts = {}, items = {};
    for (const a of R.animals) counts[a.sp] = (counts[a.sp] || 0) + 1;
    for (const it of R.items) items[it.id] = (items[it.id] || 0) + 1;
    let animal = 0, decor = 0;
    for (const [sp, n] of Object.entries(counts)) {
      const v = animalValue(SPECIES[sp].tier);
      animal += v * Math.min(n, ECON.speciesFull) + v * 0.5 * Math.max(0, n - ECON.speciesFull);
    }
    for (const [id, n] of Object.entries(items)) {
      const p = itemPoints(ITEMS[id].tier);
      decor += p * Math.min(n, ECON.itemFull) + p * 0.5 * Math.max(0, n - ECON.itemFull);
    }
    const species = Object.keys(counts).length, diversity = species * ECON.diversity;
    const supply = { food: 0, water: 0, shelter: 0 }, demand = { food: 0, water: 0, shelter: 0 };
    for (const it of R.items) for (const [k, n] of Object.entries(ITEMS[it.id].give)) supply[k] += n;
    for (const a of R.animals) {
      const s = SPECIES[a.sp];
      for (const k of s.needs) if (k in demand) demand[k] += SIZE[s.size].use;
    }
    const ratio = {};
    for (const k in demand) ratio[k] = demand[k] ? Math.min(1, supply[k] / demand[k]) : 1;
    const needMet = {}, happy = {};
    for (const sp of Object.keys(counts)) {
      needMet[sp] = {};
      for (const k of SPECIES[sp].needs) needMet[sp][k] = k === 'herd' ? Math.min(1, counts[sp] / 3) : ratio[k];
      const vals = Object.values(needMet[sp]);
      happy[sp] = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
    let H = 1;
    if (R.animals.length) { H = 0; for (const [sp, n] of Object.entries(counts)) H += happy[sp] * n; H /= R.animals.length; }
    const mult = 0.5 + 0.5 * H;
    const dev = Math.round((animal + diversity + decor) * mult);
    return {
      dev, H, mult, animal, diversity, decor, supply, demand, ratio, needMet, happy, counts, items,
      species, animals: R.animals.length, caps: caps(R.tier),
      next: R.tier < MAX_TIER ? TIERS[R.tier] : null,
    };
  });
}

// 분당 관람 수익: 해금된 모든 지역 발전도의 합 ÷ incomeDiv
export function incomePerMin(S) {
  let dev = 0;
  for (const r of REGIONS) if (r.ready && isUnlocked(S, r.id)) dev += stats(S, r.id).dev;
  return dev / ECON.incomeDiv;
}
const gain = (S, n) => { S.pop += n; S.earned += n; };

// 구성이 바뀐 뒤: 다시 계산하고 티어를 올린다(티어는 내려가지 않는다)
function refresh(S, rid) {
  touch(S);
  const R = S.regions[rid], st = stats(S, rid);
  while (R.tier < MAX_TIER && st.dev >= TIERS[R.tier]) {
    R.tier++;
    touch(S);
    S.events.push({ type: 'tier', region: rid, tier: R.tier });
    for (const d of REGIONS) if (d.unlock && d.unlock.region === rid && d.unlock.tier === R.tier) S.events.push({ type: 'region', region: d.id });
  }
}

// ---------- 땅: 칸 점유와 걸을 수 있는 칸 ----------
const inGrid = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
function occupancy(S, rid) {
  return cached(S, 'occ:' + rid, () => {
    const occ = new Array(GRID * GRID).fill(null);
    for (const it of S.regions[rid].items) {
      const d = ITEMS[it.id];
      for (let y = it.y; y < it.y + d.h; y++) for (let x = it.x; x < it.x + d.w; x++) occ[y * GRID + x] = it;
    }
    return occ;
  });
}
export const itemAt = (S, rid, x, y) => (inGrid(x, y) ? occupancy(S, rid)[y * GRID + x] : null);
// swim = 물에 사는 동물: 물 지형(바다·호수)과 헤엄칠 수 있는 물건(swim)의 칸만 다닌다.
// 나머지는 걸을 수 있는 지형(봉우리·물 제외)의 빈칸과 걸을 수 있는 물건(walk)
export function walkable(S, rid, x, y, swim = false) {
  if (!inGrid(x, y)) return false;
  const it = occupancy(S, rid)[y * GRID + x], t = TERRAIN[kindAt(rid, x, y)];
  if (swim) return !!t.swim || !!(it && ITEMS[it.id].swim);
  return t.walk && (!it || ITEMS[it.id].walk);
}
const isSwimmer = (sp) => !!SPECIES[sp].swim;
export function fits(S, rid, id, x, y) {
  const d = ITEMS[id];
  if (!d || x < 0 || y < 0 || x + d.w > GRID || y + d.h > GRID) return false;
  if (!terrainFits(rid, id, x, y)) return false; // 지형마다 놓을 수 있는 물건이 정해져 있다(terrain.js)
  const occ = occupancy(S, rid);
  for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (occ[yy * GRID + xx]) return false;
  return true;
}
// 물건이 들어갈 자리: 그 물건에 권하는 지형(은신처·먹이 → 낮은 언덕, 놀이 → 높은 언덕) 먼저, 그다음 가운데에 가까운 순서. 없으면 null
export function freeSpot(S, rid, id) {
  const d = ITEMS[id], c = (GRID - 1) / 2, cand = [], on = allowedOn(id);
  for (let y = 0; y + d.h <= GRID; y++) for (let x = 0; x + d.w <= GRID; x++) {
    const pref = on.indexOf(kindAt(rid, x, y));
    if (pref >= 0) cand.push([x, y, pref * 100 + Math.hypot(x + (d.w - 1) / 2 - c, y + (d.h - 1) / 2 - c)]);
  }
  cand.sort((a, b) => a[2] - b[2]);
  for (const [x, y] of cand) if (fits(S, rid, id, x, y)) return [x, y];
  return null;
}

// ---------- 구매 ----------
const ok = { ok: true };
const no = (why) => ({ ok: false, why });
function regionOpen(S, rid) {
  const d = regionDef(rid);
  if (!d) return no('없는 지역');
  if (!isUnlocked(S, rid)) return no('잠긴 지역');
  if (!d.ready) return no('다음 업데이트에서 열려요');
  return ok;
}
export const priceOfAnimal = (sp) => animalPrice(SPECIES[sp].tier);
export const priceOfItem = (id) => itemPrice(ITEMS[id].tier);

export function canAdopt(S, rid, sp) {
  const d = SPECIES[sp];
  if (!d || d.region !== rid) return no('이 지역 동물이 아니에요');
  const r = regionOpen(S, rid);
  if (!r.ok) return r;
  const R = S.regions[rid], st = stats(S, rid);
  if (R.tier < d.tier) return no(`T${d.tier}에서 해금`);
  if (d.swim && !swimTiles(S, rid).length) return no('헤엄칠 물이 필요해요');
  if (!st.counts[sp] && st.species >= st.caps.species) return no(`종 한도 ${st.caps.species}종`);
  if (st.animals >= st.caps.animals) return no(`개체 한도 ${st.caps.animals}마리`);
  if (S.pop < priceOfAnimal(sp)) return no('인기점수가 모자라요');
  return ok;
}
export function adopt(S, rid, sp) {
  const c = canAdopt(S, rid, sp);
  if (!c.ok) return c;
  const price = priceOfAnimal(sp);
  S.pop -= price;
  const spot = spawnTile(S, rid, isSwimmer(sp));
  const a = {
    uid: S.uid++, sp, x: spot[0] + 0.5, y: spot[1] + 0.5, st: 'idle', t: range(S, 0.5, 2), path: null, goal: null,
    face: rnd(S) < 0.5 ? -1 : 1, ph: range(S, 0, 10), jx: range(S, -0.22, 0.22), jy: range(S, -0.22, 0.22), paid: price,
  };
  S.regions[rid].animals.push(a);
  refresh(S, rid);
  return { ok: true, animal: a };
}
export function release(S, rid, uid) {
  const R = S.regions[rid], i = R.animals.findIndex((a) => a.uid === uid);
  if (i < 0) return no('없는 동물');
  const [a] = R.animals.splice(i, 1);
  gainRefund(S, a.paid);
  if (S.chance && S.chance.uid === uid) endChance(S);
  refresh(S, rid);
  return { ok: true, refund: Math.floor(a.paid * ECON.refund) };
}
const gainRefund = (S, paid) => { S.pop += Math.floor(paid * ECON.refund); };

// 물건을 놓을 수 있는 지형 이름(예: '낮은 언덕·평지')
export const terrainNames = (id) => allowedOn(id).map((k) => TERRAIN[k].name).join('·');
export function canPlace(S, rid, id, x, y) {
  const d = ITEMS[id];
  if (!d || d.region !== rid) return no('이 지역 물건이 아니에요');
  const r = regionOpen(S, rid);
  if (!r.ok) return r;
  if (S.regions[rid].tier < d.tier) return no(`T${d.tier}에서 해금`);
  if (x >= 0 && y >= 0 && x + d.w <= GRID && y + d.h <= GRID && !terrainFits(rid, id, x, y)) return no(`${terrainNames(id)}에 놓아요`);
  if (!fits(S, rid, id, x, y)) return no('놓을 수 없는 자리예요');
  if (S.pop < priceOfItem(id)) return no('인기점수가 모자라요');
  return ok;
}
export function placeItem(S, rid, id, x, y) {
  const c = canPlace(S, rid, id, x, y);
  if (!c.ok) return c;
  const price = priceOfItem(id);
  S.pop -= price;
  const it = { uid: S.uid++, id, x, y, paid: price };
  S.regions[rid].items.push(it);
  refresh(S, rid);
  reroute(S, rid);
  return { ok: true, item: it };
}
export function removeItem(S, rid, uid) {
  const R = S.regions[rid], i = R.items.findIndex((it) => it.uid === uid);
  if (i < 0) return no('없는 물건');
  if (ITEMS[R.items[i].id].swim && !hasWater(rid) && R.animals.some((a) => isSwimmer(a.sp)) && !R.items.some((it, j) => j !== i && ITEMS[it.id].swim)) return no('물에 사는 동물이 있어서 치울 수 없어요');
  const [it] = R.items.splice(i, 1);
  gainRefund(S, it.paid);
  refresh(S, rid);
  reroute(S, rid);
  return { ok: true, refund: Math.floor(it.paid * ECON.refund) };
}

// ---------- 동물 행동 ----------
const tileOf = (a) => [clamp(Math.floor(a.x), 0, GRID - 1), clamp(Math.floor(a.y), 0, GRID - 1)];
function walkTiles(S, rid, swim = false) {
  const out = [];
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (walkable(S, rid, x, y, swim)) out.push([x, y]);
  return out;
}
export const swimTiles = (S, rid) => cached(S, 'swim:' + rid, () => walkTiles(S, rid, true));
function spawnTile(S, rid, swim = false) {
  const w = swim ? swimTiles(S, rid) : walkTiles(S, rid);
  return w.length ? pick(S, w) : [Math.floor(GRID / 2), Math.floor(GRID / 2)];
}
// 걸을 수 있는 칸만 지나 goal(x,y)=true인 가장 가까운 칸까지. 경로는 시작 칸을 뺀 칸 목록
export function findPath(S, rid, from, goal, swim = false) {
  const seen = new Int16Array(GRID * GRID).fill(-1), q = [from[1] * GRID + from[0]];
  seen[q[0]] = q[0];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % GRID, cy = (cur - cx) / GRID;
    if (goal(cx, cy)) {
      const path = [];
      for (let c = cur; c !== q[0]; c = seen[c]) path.push([c % GRID, (c - (c % GRID)) / GRID]);
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, n = ny * GRID + nx;
      if (inGrid(nx, ny) && seen[n] < 0 && walkable(S, rid, nx, ny, swim)) { seen[n] = cur; q.push(n); }
    }
  }
  return null;
}
// 필요 k를 채우는 칸: 걸을 수 있는 물건이면 그 칸, 아니면 물건 바로 옆 칸
function servesAt(S, rid, k) {
  return cached(S, `sv:${rid}:${k}`, () => {
    const set = new Uint8Array(GRID * GRID);
    for (const it of S.regions[rid].items) {
      const d = ITEMS[it.id];
      if (!d.give[k]) continue;
      for (let y = it.y - 1; y <= it.y + d.h; y++) for (let x = it.x - 1; x <= it.x + d.w; x++) {
        if (!inGrid(x, y)) continue;
        const inside = x >= it.x && y >= it.y && x < it.x + d.w && y < it.y + d.h;
        const edge = !inside && (x >= it.x && x < it.x + d.w || y >= it.y && y < it.y + d.h); // 대각선 모서리는 뺀다
        if ((inside && d.walk) || (edge && walkable(S, rid, x, y))) set[y * GRID + x] = 1;
      }
    }
    return set;
  });
}
// 물건이 놓이거나 치워지면: 막힌 칸에 선 동물은 가까운 빈칸으로 옮기고, 가던 길은 다시 정한다
function reroute(S, rid) {
  for (const a of S.regions[rid].animals) {
    const [tx, ty] = tileOf(a), swim = isSwimmer(a.sp);
    if (swim && !walkable(S, rid, tx, ty, true)) { // 가장 가까운 물 칸으로
      const w = swimTiles(S, rid);
      if (w.length) { const to = w.reduce((b, c) => (Math.hypot(c[0] - tx, c[1] - ty) < Math.hypot(b[0] - tx, b[1] - ty) ? c : b)); a.x = to[0] + 0.5; a.y = to[1] + 0.5; }
    } else if (!swim && !walkable(S, rid, tx, ty)) {
      const p = findPath(S, rid, [tx, ty], (x, y) => walkable(S, rid, x, y) && (x !== tx || y !== ty));
      const to = p && p.length ? p[p.length - 1] : spawnTile(S, rid);
      a.x = to[0] + 0.5; a.y = to[1] + 0.5;
    }
    if (a.st === 'walk') { a.st = 'idle'; a.t = range(S, 0.2, 0.8); a.path = null; a.goal = null; }
  }
}
const NEED_STATE = { food: 'eat', water: 'drink', shelter: 'rest' };
function decide(S, rid, a) {
  const s = SPECIES[a.sp], R = S.regions[rid], r = rnd(S);
  const from = tileOf(a);
  if (s.swim) {
    if (r < 0.3) return arrive(a, rnd(S) < 0.5 ? 'eat' : 'rest');
    if (r < 0.85) {
      const tx = clamp(from[0] + Math.round(range(S, -3, 3)), 0, GRID - 1), ty = clamp(from[1] + Math.round(range(S, -3, 3)), 0, GRID - 1);
      const path = findPath(S, rid, from, (x, y) => x === tx && y === ty, true);
      if (path && path.length) return go(a, path, null);
    }
    a.st = 'idle'; a.t = range(S, 1.5, 4); return;
  }
  const needs = s.needs.filter((k) => k !== 'herd');
  if (r < 0.38 && needs.length) {
    const k = pick(S, needs), set = servesAt(S, rid, k);
    const path = findPath(S, rid, from, (x, y) => set[y * GRID + x] === 1);
    if (path) return go(a, path, NEED_STATE[k]);
  }
  if (r < 0.5) {
    // 높은 언덕에 올라가 쉬거나(전망), 가까운 길로 나선다(길을 조금 더 좋아하지만 길로만 다니지는 않는다)
    const want = r < 0.44 ? 'high' : 'path', near = terrainTiles(rid, want).filter(([x, y]) => Math.abs(x - from[0]) + Math.abs(y - from[1]) <= (want === 'high' ? 12 : 6));
    if (near.length) {
      const [tx, ty] = pick(S, near), path = findPath(S, rid, from, (x, y) => x === tx && y === ty);
      if (path && path.length) return go(a, path, want === 'high' ? 'rest' : null);
    }
  }
  if (r < 0.8) {
    // 배회: 무리 동물은 같은 종 근처로
    let cx = from[0], cy = from[1], rad = 5;
    if (s.needs.includes('herd') && rnd(S) < 0.6) {
      const mates = R.animals.filter((b) => b !== a && b.sp === a.sp);
      if (mates.length) { const m = pick(S, mates); [cx, cy] = tileOf(m); rad = 2; }
    }
    const tx = clamp(cx + Math.round(range(S, -rad, rad)), 0, GRID - 1), ty = clamp(cy + Math.round(range(S, -rad, rad)), 0, GRID - 1);
    const path = findPath(S, rid, from, (x, y) => x === tx && y === ty);
    if (path && path.length) return go(a, path, null);
  }
  a.st = 'idle'; a.t = range(S, 1.5, 4.5);
}
const tTiles = {};
function terrainTiles(rid, kind) {
  const key = rid + ':' + kind;
  if (!tTiles[key]) { tTiles[key] = []; terrainOf(rid).forEach((k, i) => { if (k === kind) tTiles[key].push([i % GRID, (i - (i % GRID)) / GRID]); }); }
  return tTiles[key];
}
function go(a, path, then) {
  if (!path.length) return arrive(a, then);
  a.st = 'walk'; a.path = path; a.goal = then;
}
function arrive(a, then) {
  a.path = null; a.goal = null;
  if (then === 'eat') { a.st = 'eat'; a.t = 3.5; } else if (then === 'drink') { a.st = 'drink'; a.t = 3; } else if (then === 'rest') { a.st = 'rest'; a.t = 6; } else { a.st = 'idle'; a.t = 1.2; }
}
function moveAnimal(S, rid, a, dt) {
  let left = SIZE[SPECIES[a.sp].size].speed * dt;
  while (left > 0 && a.path && a.path.length) {
    const [tx, ty] = a.path[0];
    if (!walkable(S, rid, tx, ty, isSwimmer(a.sp))) { a.st = 'idle'; a.t = 0.3; a.path = null; return; }
    const wx = tx + 0.5 + (a.path.length === 1 ? a.jx : 0), wy = ty + 0.5 + (a.path.length === 1 ? a.jy : 0);
    const dx = wx - a.x, dy = wy - a.y, d = Math.hypot(dx, dy);
    const sx = dx - dy; // 화면 가로 방향(쿼터뷰)
    if (Math.abs(sx) > 0.02) a.face = sx > 0 ? 1 : -1;
    if (d <= left) { a.x = wx; a.y = wy; left -= d; a.path.shift(); } else { a.x += (dx / d) * left; a.y += (dy / d) * left; left = 0; }
  }
  if (!a.path || !a.path.length) arrive(a, a.goal);
}
function updateAnimal(S, rid, a, dt) {
  a.ph += dt;
  if (a.st === 'walk') return moveAnimal(S, rid, a, dt);
  a.t -= dt;
  if (a.t <= 0) decide(S, rid, a);
}

// ---------- 순간 포착 ----------
function endChance(S) {
  S.chance = null;
  S.chanceIn = range(S, ECON.chanceEvery[0], ECON.chanceEvery[1]);
}
function updateChance(S, dt) {
  if (S.chance) {
    S.chance.t -= dt;
    if (S.chance.t <= 0) endChance(S);
    return;
  }
  S.chanceIn -= dt;
  if (S.chanceIn > 0) return;
  const R = S.regions[S.view];
  const cand = R ? R.animals.filter((a) => a.st !== 'special') : [];
  if (!cand.length) { S.chanceIn = 5; return; }
  const a = pick(S, cand);
  a.st = 'special'; a.t = ECON.chanceLen; a.path = null; a.goal = null;
  S.chance = { region: S.view, uid: a.uid, t: ECON.chanceLen };
}
export function capture(S, uid) {
  if (!S.chance || S.chance.uid !== uid) return no('지금은 포착할 수 없어요');
  const R = S.regions[S.chance.region], a = R.animals.find((b) => b.uid === uid);
  if (!a) { endChance(S); return no('없는 동물'); }
  const first = !S.album[a.sp], perMin = incomePerMin(S);
  const reward = first
    ? Math.max(ECON.firstMin, Math.round(perMin * ECON.firstMinutes))
    : Math.max(ECON.captureMin, Math.round(perMin * ECON.captureMinutes));
  S.album[a.sp] = (S.album[a.sp] || 0) + 1;
  gain(S, reward);
  for (const q of S.requests) if (q.kind === 'photo' && q.sp === a.sp) q.got++;
  endChance(S);
  S.events.push({ type: 'capture', sp: a.sp, reward, first });
  return { ok: true, reward, first, sp: a.sp };
}

// ---------- 관람객 요청 ----------
export function requestDone(S, q) {
  const st = stats(S, q.region);
  if (q.kind === 'adopt') return (st.counts[q.sp] || 0) >= q.n;
  if (q.kind === 'place') return (st.items[q.item] || 0) >= q.n;
  if (q.kind === 'happy') return st.animals >= 2 && Math.round(st.H * 100) >= q.pct;
  if (q.kind === 'photo') return q.got >= q.n;
  return false;
}
export function requestProgress(S, q) {
  const st = stats(S, q.region);
  if (q.kind === 'adopt') return [Math.min(q.n, st.counts[q.sp] || 0), q.n];
  if (q.kind === 'place') return [Math.min(q.n, st.items[q.item] || 0), q.n];
  if (q.kind === 'happy') return [Math.min(q.pct, Math.round(st.H * 100 * (st.animals >= 2 ? 1 : 0))), q.pct];
  return [Math.min(q.n, q.got), q.n];
}
function requestCandidates(S, rid) {
  const R = S.regions[rid], st = stats(S, rid), out = [];
  const room = st.caps.animals - st.animals;
  for (const sp of speciesOf(rid)) {
    const have = st.counts[sp] || 0;
    if (SPECIES[sp].tier > R.tier || room <= 0 || (!have && st.species >= st.caps.species) || (SPECIES[sp].swim && !swimTiles(S, rid).length)) continue;
    const add = Math.min(room, 1 + Math.floor(rnd(S) * 2));
    out.push({ kind: 'adopt', sp, n: have + add, minutes: 2 + 2 * add });
    if (have) out.push({ kind: 'photo', sp, n: 1, got: 0, minutes: 3 });
  }
  for (const id of itemsOf(rid)) {
    if (ITEMS[id].tier > R.tier || !freeSpot(S, rid, id)) continue;
    out.push({ kind: 'place', item: id, n: (st.items[id] || 0) + 1, minutes: 3 });
  }
  if (st.animals >= 2) {
    const pct = Math.ceil((Math.round(st.H * 100) + 5) / 5) * 5;
    if (pct <= 100) out.push({ kind: 'happy', pct, minutes: 5 });
  }
  return out;
}
const reqKey = (q) => `${q.kind}:${q.sp || q.item || q.pct}`;
function makeRequest(S) {
  const rid = regionDef(S.view)?.ready && isUnlocked(S, S.view) ? S.view : 'grassland';
  const taken = new Set(S.requests.map(reqKey));
  const cand = requestCandidates(S, rid).filter((q) => !taken.has(reqKey(q)) && !requestDone(S, { ...q, region: rid }));
  if (!cand.length) return null;
  const q = pick(S, cand);
  return { uid: S.uid++, region: rid, ...q, reward: Math.max(ECON.requestMin, Math.round(incomePerMin(S) * q.minutes)) };
}
function fillRequests(S) {
  while (S.requests.length < 3) {
    const q = makeRequest(S);
    if (!q) break;
    S.requests.push(q);
  }
}
export function claim(S, uid) {
  const i = S.requests.findIndex((q) => q.uid === uid);
  if (i < 0) return no('없는 요청');
  const q = S.requests[i];
  if (!requestDone(S, q)) return no('아직 덜 됐어요');
  gain(S, q.reward);
  S.requests.splice(i, 1);
  fillRequests(S);
  return { ok: true, reward: q.reward };
}
export function swapRequest(S, uid) {
  if (S.time < S.reqSwapAt) return no(`${Math.ceil(S.reqSwapAt - S.time)}초 뒤에 바꿀 수 있어요`);
  const i = S.requests.findIndex((q) => q.uid === uid);
  if (i < 0) return no('없는 요청');
  const [old] = S.requests.splice(i, 1);
  const q = makeRequest(S);
  S.requests.splice(i, 0, q ?? old);
  S.reqSwapAt = S.time + ECON.swapCooldown;
  return { ok: true };
}

// ---------- 시간 ----------
// 하루 = 플레이 4분: 아침 → 낮 → 저녁 → 밤이 1분씩. 진행일수는 1일차부터
export const DAY_SEC = 240, PHASE_SEC = 60;
export const PHASE_NAME = ['아침', '낮', '저녁', '밤'];
export function clock(S) {
  const t = Math.max(0, S.time) % DAY_SEC;
  return { day: Math.floor(Math.max(0, S.time) / DAY_SEC) + 1, phase: Math.floor(t / PHASE_SEC), sec: t % PHASE_SEC };
}
export function step(S, dt) {
  S.time += dt;
  gain(S, (incomePerMin(S) / 60) * dt);
  updateChance(S, dt);
  for (const r of REGIONS) {
    if (!r.ready) continue;
    for (const a of S.regions[r.id].animals) updateAnimal(S, r.id, a, dt);
  }
  if (S.requests.length < 3) fillRequests(S);
}
// 자리를 비운 동안의 관람 수익(최대 offlineCapSec). 시계가 뒤로 가면 0
export function settleOffline(S, now) {
  const sec = clamp((now - S.savedAt) / 1000, 0, ECON.offlineCapSec);
  const n = (incomePerMin(S) / 60) * sec;
  gain(S, n);
  S.savedAt = now;
  return { sec, gain: n };
}
export function setView(S, rid) {
  if (!regionDef(rid) || !isUnlocked(S, rid) || !regionDef(rid).ready) return regionOpen(S, rid);
  if (S.chance && S.chance.region !== rid) endChance(S);
  S.view = rid;
  return ok;
}

// ---------- 저장 ----------
export function serialize(S, now = Date.now()) {
  const o = {};
  for (const k of SAVE_KEYS) o[k] = S[k];
  o.savedAt = now;
  return JSON.stringify(o);
}
export function deserialize(raw) {
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || o.v !== SAVE_VERSION || typeof o.pop !== 'number' || !o.regions || !Array.isArray(o.requests)) return null;
  const S = { ...o, events: [] };
  for (const r of REGIONS) S.regions[r.id] ??= { tier: 1, items: [], animals: [] };
  for (const r of REGIONS) {
    const R = S.regions[r.id];
    R.items = R.items.filter((it) => ITEMS[it.id]);
    R.animals = R.animals.filter((a) => SPECIES[a.sp]);
  }
  touch(S);
  fitTerrain(S);
  return S;
}

// 지형이 생기기 전 세이브: 지형에 맞지 않는 물건은 가까운 맞는 자리로 옮기고, 자리가 없으면 낸 값을 모두 돌려준다.
// 동물은 걸을 수 없는 칸(봉우리·물, 헤엄치는 동물은 물 밖)에 서 있으면 가까운 칸으로 옮긴다
export function fitTerrain(S) {
  const out = { moved: 0, refunded: 0 };
  for (const r of REGIONS) {
    const R = S.regions[r.id], bad = R.items.filter((it) => !terrainFits(r.id, it.id, it.x, it.y));
    if (!bad.length) continue;
    R.items = R.items.filter((it) => !bad.includes(it));
    touch(S);
    for (const it of bad) {
      const at = freeSpot(S, r.id, it.id);
      if (at) { it.x = at[0]; it.y = at[1]; R.items.push(it); out.moved++; } else { S.pop += it.paid; out.refunded++; }
      touch(S);
    }
  }
  for (const r of REGIONS) {
    const off = (a) => { const [x, y] = tileOf(a); return !walkable(S, r.id, x, y, isSwimmer(a.sp)); };
    if (S.regions[r.id].animals.some(off)) reroute(S, r.id);
  }
  if (out.moved || out.refunded) S.events.push({ type: 'terrain', ...out });
  return out;
}

export { GRID, MAX_TIER, TIERS };
