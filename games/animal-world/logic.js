// 게임 규칙 전부(화면 없음). 경제·한도·발전도·행복도·티어·요청·순간 포착·동물 행동·저장 형식.
// 상태 S는 JSON으로 그대로 저장할 수 있는 순수 데이터다. 난수는 S.rng(시드)에서만 뽑는다.
import {
  GRID, GW, GH, ISLE, ISLE_THEME, MAX_TIER, TIERS, caps, SIZE, ECON, REGIONS, SPECIES, ITEMS,
  animalValue, itemPoints, animalPrice, itemPrice, speciesOf, itemsOf,
} from './data.js';
import { TERRAIN, kindAt, terrainFits, allowedOn, hasWater, terrainOf } from './terrain.js';

export const STEP = 1 / 30;
export const SAVE_VERSION = 4; // 2: 인기점수를 지역마다 따로(R.pop), 쉬는 지역은 R.away부터 정산 · 3: 관람객 요청도 지역마다 따로(R.requests·R.reqSwapAt) · 4: 땅 40×40칸(좌표 2배)
const SAVE_KEYS = ['v', 'rng', 'earned', 'time', 'savedAt', 'view', 'regions', 'album', 'chance', 'chanceIn', 'uid'];

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
    v: SAVE_VERSION, rng: seed | 0 || 1, earned: 0, time: 0, savedAt: now,
    view: 'grassland', regions: {}, album: {},
    chance: null, chanceIn: 12, uid: 1, events: [],
  };
  for (const r of REGIONS) S.regions[r.id] = newRegion(r.id === S.view ? null : 0);
  fillRequests(S, S.view);
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

// ---------- 인기점수(지역마다 따로) ----------
// 지역 하나: 티어·물건·동물 + 그 지역 인기점수(pop)·관람객 요청(requests, reqSwapAt)·섬 꾸미기(isle). away = 그 지역을 떠난 플레이 시각(보고 있으면 null)
const newRegion = (away) => ({ tier: 1, items: [], animals: [], pop: ECON.start, away, requests: [], reqSwapAt: 0, isle: newIsle() });
const newIsle = () => ({ done: [], got: [] }); // 섬 꾸미기: 달성한 항목·보상 받은 항목
export const popOf = (S, rid = S.view) => S.regions[rid].pop;
// 분당 관람 수익: 그 지역 발전도 ÷ incomeDiv. 보고 있는 지역에만 실시간으로 쌓인다
export function incomePerMin(S, rid = S.view) {
  const d = regionDef(rid);
  return d && d.ready && isUnlocked(S, rid) ? stats(S, rid).dev / ECON.incomeDiv : 0;
}
const gain = (S, rid, n) => { S.regions[rid].pop += n; S.earned += n; };
// 쉬는 동안(sec초)의 관람 수익: 지역마다 최대 offlineCapSec 분량
const restGain = (S, rid, sec) => (incomePerMin(S, rid) / 60) * clamp(sec, 0, ECON.offlineCapSec);

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
// 지역 격자는 GW×GH(본섬 GRID행 + 다리 + T8 섬). 칸 번호 = y × GW + x
const inGrid = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH;
// T8 섬(본섬 앞 다리와 섬): 그 지역이 T8이 되면 열린다. 그전에는 못 가고 물건도 못 놓는다
export const isleOpen = (S, rid) => S.regions[rid].tier >= ISLE.tier;
const locked = (S, rid, y) => y >= GRID && !isleOpen(S, rid);
const rowsOf = (S, rid) => (isleOpen(S, rid) ? GH : GRID); // 갈 수 있는 행 수(배회 목표를 고를 때)
function occupancy(S, rid) {
  return cached(S, 'occ:' + rid, () => {
    const occ = new Array(GW * GH).fill(null);
    for (const it of S.regions[rid].items) {
      const d = ITEMS[it.id];
      for (let y = it.y; y < it.y + d.h; y++) for (let x = it.x; x < it.x + d.w; x++) occ[y * GW + x] = it;
    }
    return occ;
  });
}
export const itemAt = (S, rid, x, y) => (inGrid(x, y) ? occupancy(S, rid)[y * GW + x] : null);
// swim = 물에 사는 동물: 물 지형(바다·호수)과 헤엄칠 수 있는 물건(swim)의 칸만 다닌다.
// 나머지는 걸을 수 있는 지형(봉우리·물 제외)의 빈칸과 걸을 수 있는 물건(walk)
export function walkable(S, rid, x, y, swim = false) {
  if (!inGrid(x, y) || locked(S, rid, y)) return false;
  const it = occupancy(S, rid)[y * GW + x], t = TERRAIN[kindAt(rid, x, y)];
  if (swim) return !!t.swim || !!(it && ITEMS[it.id].swim);
  return t.walk && (!it || ITEMS[it.id].walk);
}
const isSwimmer = (sp) => !!SPECIES[sp].swim;
export function fits(S, rid, id, x, y) {
  const d = ITEMS[id];
  if (!d || x < 0 || y < 0 || x + d.w > GW || y + d.h > GH || locked(S, rid, y + d.h - 1)) return false;
  if (!terrainFits(rid, id, x, y)) return false; // 지형마다 놓을 수 있는 물건이 정해져 있다(terrain.js)
  const occ = occupancy(S, rid);
  for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (occ[yy * GW + xx]) return false;
  return true;
}
// 물건이 들어갈 자리: 그 물건에 권하는 지형(은신처·먹이 → 낮은 언덕, 놀이 → 높은 언덕) 먼저, 그다음 가운데에 가까운 순서. 없으면 null.
// 지형은 바뀌지 않으므로 지형에 맞는 후보 목록은 지역·물건마다 한 번만 만들고(2,640칸이라 매번 정렬하면 느리다), 빈자리만 확인한다.
// T8 섬 자리는 본섬 자리를 다 쓴 뒤에(섬이 열려 있어도 본섬부터 채운다)
const spotLists = {};
function spotList(rid, id) {
  const key = rid + ':' + id;
  if (spotLists[key]) return spotLists[key];
  const d = ITEMS[id], c = (GRID - 1) / 2, cand = [], on = allowedOn(id);
  for (let y = 0; y + d.h <= GH; y++) for (let x = 0; x + d.w <= GW; x++) {
    const pref = on.indexOf(kindAt(rid, x, y));
    if (pref >= 0 && terrainFits(rid, id, x, y)) cand.push([x, y, (y >= GRID ? 1000 : 0) + pref * 100 + Math.hypot(x + (d.w - 1) / 2 - c, y + (d.h - 1) / 2 - c)]);
  }
  cand.sort((a, b) => a[2] - b[2]);
  return (spotLists[key] = cand.map(([x, y]) => [x, y]));
}
// on: 그 지형 칸에 걸치는 자리만(지형 꾸미기 요청)
export function freeSpot(S, rid, id, on = null) {
  const d = ITEMS[id], occ = occupancy(S, rid);
  next: for (const [x, y] of spotList(rid, id)) {
    if (locked(S, rid, y + d.h - 1) || (on && !covers(rid, id, x, y, on))) continue;
    for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (occ[yy * GW + xx]) continue next;
    return [x, y];
  }
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
  if (popOf(S, rid) < priceOfAnimal(sp)) return no('인기점수가 모자라요');
  return ok;
}
export function adopt(S, rid, sp) {
  const c = canAdopt(S, rid, sp);
  if (!c.ok) return c;
  const price = priceOfAnimal(sp);
  S.regions[rid].pop -= price;
  const spot = spawnTile(S, rid, isSwimmer(sp));
  const a = {
    uid: S.uid++, sp, x: spot[0] + 0.5, y: spot[1] + 0.5, st: 'idle', t: range(S, 0.5, 2), path: null, goal: null,
    face: rnd(S) < 0.5 ? -1 : 1, ph: range(S, 0, 10), jx: range(S, -0.3, 0.3), jy: range(S, -0.3, 0.3), paid: price,
  };
  S.regions[rid].animals.push(a);
  refresh(S, rid);
  return { ok: true, animal: a };
}
export function release(S, rid, uid) {
  const R = S.regions[rid], i = R.animals.findIndex((a) => a.uid === uid);
  if (i < 0) return no('없는 동물');
  const [a] = R.animals.splice(i, 1);
  gainRefund(S, rid, a.paid);
  if (S.chance && S.chance.uid === uid) endChance(S);
  refresh(S, rid);
  return { ok: true, refund: Math.floor(a.paid * ECON.refund) };
}
const gainRefund = (S, rid, paid) => { S.regions[rid].pop += Math.floor(paid * ECON.refund); };

// 물건을 놓을 수 있는 지형 이름(예: '낮은 언덕·평지')
export const terrainNames = (id) => allowedOn(id).map((k) => TERRAIN[k].name).join('·');
export function canPlace(S, rid, id, x, y) {
  const d = ITEMS[id];
  if (!d || d.region !== rid) return no('이 지역 물건이 아니에요');
  const r = regionOpen(S, rid);
  if (!r.ok) return r;
  if (S.regions[rid].tier < d.tier) return no(`T${d.tier}에서 해금`);
  if (x >= 0 && y >= 0 && x + d.w <= GW && y + d.h <= GH && locked(S, rid, y + d.h - 1)) return no(`T${ISLE.tier}에 열리는 섬이에요`);
  if (x >= 0 && y >= 0 && x + d.w <= GW && y + d.h <= GH && !terrainFits(rid, id, x, y)) return no(`${terrainNames(id)}에 놓아요`);
  if (!fits(S, rid, id, x, y)) return no('놓을 수 없는 자리예요');
  if (popOf(S, rid) < priceOfItem(id)) return no('인기점수가 모자라요');
  return ok;
}
export function placeItem(S, rid, id, x, y) {
  const c = canPlace(S, rid, id, x, y);
  if (!c.ok) return c;
  const price = priceOfItem(id);
  S.regions[rid].pop -= price;
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
  gainRefund(S, rid, it.paid);
  refresh(S, rid);
  reroute(S, rid);
  return { ok: true, refund: Math.floor(it.paid * ECON.refund) };
}

// ---------- 동물 행동 ----------
const tileOf = (a) => [clamp(Math.floor(a.x), 0, GW - 1), clamp(Math.floor(a.y), 0, GH - 1)];
function walkTiles(S, rid, swim = false) {
  const out = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (walkable(S, rid, x, y, swim)) out.push([x, y]);
  return out;
}
export const swimTiles = (S, rid) => cached(S, 'swim:' + rid, () => walkTiles(S, rid, true));
function spawnTile(S, rid, swim = false) {
  const w = swim ? swimTiles(S, rid) : walkTiles(S, rid);
  return w.length ? pick(S, w) : [Math.floor(GRID / 2), Math.floor(GRID / 2)];
}
// 걸을 수 있는 칸만 지나 goal(x,y)=true인 가장 가까운 칸까지. 경로는 시작 칸을 뺀 칸 목록
export function findPath(S, rid, from, goal, swim = false) {
  const seen = new Int16Array(GW * GH).fill(-1), q = [from[1] * GW + from[0]];
  seen[q[0]] = q[0];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % GW, cy = (cur - cx) / GW;
    if (goal(cx, cy)) {
      const path = [];
      for (let c = cur; c !== q[0]; c = seen[c]) path.push([c % GW, (c - (c % GW)) / GW]);
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, n = ny * GW + nx;
      if (inGrid(nx, ny) && seen[n] < 0 && walkable(S, rid, nx, ny, swim)) { seen[n] = cur; q.push(n); }
    }
  }
  return null;
}
// 필요 k를 채우는 칸: 걸을 수 있는 물건이면 그 칸, 아니면 물건 바로 옆 칸
function servesAt(S, rid, k) {
  return cached(S, `sv:${rid}:${k}`, () => {
    const set = new Uint8Array(GW * GH);
    for (const it of S.regions[rid].items) {
      const d = ITEMS[it.id];
      if (!d.give[k]) continue;
      for (let y = it.y - 1; y <= it.y + d.h; y++) for (let x = it.x - 1; x <= it.x + d.w; x++) {
        if (!inGrid(x, y)) continue;
        const inside = x >= it.x && y >= it.y && x < it.x + d.w && y < it.y + d.h;
        const edge = !inside && (x >= it.x && x < it.x + d.w || y >= it.y && y < it.y + d.h); // 대각선 모서리는 뺀다
        if ((inside && d.walk) || (edge && walkable(S, rid, x, y))) set[y * GW + x] = 1;
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
      const tx = clamp(from[0] + Math.round(range(S, -6, 6)), 0, GW - 1), ty = clamp(from[1] + Math.round(range(S, -6, 6)), 0, rowsOf(S, rid) - 1);
      const path = findPath(S, rid, from, (x, y) => x === tx && y === ty, true);
      if (path && path.length) return go(a, path, null);
    }
    a.st = 'idle'; a.t = range(S, 1.5, 4); return;
  }
  const needs = s.needs.filter((k) => k !== 'herd');
  if (r < 0.38 && needs.length) {
    const k = pick(S, needs), set = servesAt(S, rid, k);
    const path = findPath(S, rid, from, (x, y) => set[y * GW + x] === 1);
    if (path) return go(a, path, NEED_STATE[k]);
  }
  if (r < 0.5) {
    // 높은 언덕에 올라가 쉬거나(전망), 가까운 길로 나선다(길을 조금 더 좋아하지만 길로만 다니지는 않는다)
    const want = r < 0.44 ? 'high' : 'path', near = terrainTiles(rid, want).filter(([x, y]) => y < rowsOf(S, rid) && Math.abs(x - from[0]) + Math.abs(y - from[1]) <= (want === 'high' ? 24 : 12));
    if (near.length) {
      const [tx, ty] = pick(S, near), path = findPath(S, rid, from, (x, y) => x === tx && y === ty);
      if (path && path.length) return go(a, path, want === 'high' ? 'rest' : null);
    }
  }
  if (r < 0.8) {
    // 배회: 무리 동물은 같은 종 근처로
    let cx = from[0], cy = from[1], rad = 10;
    if (s.needs.includes('herd') && rnd(S) < 0.6) {
      const mates = R.animals.filter((b) => b !== a && b.sp === a.sp);
      if (mates.length) { const m = pick(S, mates); [cx, cy] = tileOf(m); rad = 4; }
    }
    const tx = clamp(cx + Math.round(range(S, -rad, rad)), 0, GW - 1), ty = clamp(cy + Math.round(range(S, -rad, rad)), 0, rowsOf(S, rid) - 1);
    const path = findPath(S, rid, from, (x, y) => x === tx && y === ty);
    if (path && path.length) return go(a, path, null);
  }
  a.st = 'idle'; a.t = range(S, 1.5, 4.5);
}
const tTiles = {};
function terrainTiles(rid, kind) {
  const key = rid + ':' + kind;
  if (!tTiles[key]) { tTiles[key] = []; terrainOf(rid).forEach((k, i) => { if (k === kind) tTiles[key].push([i % GW, (i - (i % GW)) / GW]); }); }
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
  const first = !S.album[a.sp], perMin = incomePerMin(S, S.chance.region), rid = S.chance.region;
  const reward = first
    ? Math.max(ECON.firstMin, Math.round(perMin * ECON.firstMinutes))
    : Math.max(ECON.captureMin, Math.round(perMin * ECON.captureMinutes));
  S.album[a.sp] = (S.album[a.sp] || 0) + 1;
  gain(S, rid, reward);
  const phase = clock(S).phase;
  for (const q of R.requests) if (q.kind === 'photo' && q.sp === a.sp && (q.phase == null || q.phase === phase)) q.got++;
  endChance(S);
  S.events.push({ type: 'capture', sp: a.sp, reward, first });
  return { ok: true, reward, first, sp: a.sp };
}

// ---------- 관람객 요청 ----------
// 지역마다 3장, 같은 종류는 한 장만(2026-10-28 대니님 승인 후속작업 4). 그 지역에서만 보이고, 보상도 그 지역 인기점수로(관람 수익 N분치, 최소 requestMin)
//   adopt 그 종 N마리(종마다 4마리까지) · species 지역 동물 N종 · set 필요별 물건 수(먹이·물·쉼터를 주는 물건) ·
//   terrain 그 지형 위에 그 물건 · happy 행복도 N% · photo 그 종 특수 행동 사진(phase가 있으면 그 시간대에)
//   place(물건 N개)는 예전 세이브에만 남아 있다
const SET_NEEDS = ['food', 'water', 'shelter'];
// 물건이 그 지형 칸에 걸쳐 있나(물·저지대에 걸치는 헤엄 물건 말고는 덮는 칸 지형이 모두 같다)
function covers(rid, id, x, y, k) {
  const d = ITEMS[id];
  for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) if (kindAt(rid, xx, yy) === k) return true;
  return false;
}
const needCount = (st, k) => Object.entries(st.items).reduce((n, [id, c]) => n + (ITEMS[id].give[k] ? c : 0), 0);
const countOn = (S, rid, id, k) => S.regions[rid].items.filter((it) => it.id === id && covers(rid, id, it.x, it.y, k)).length;
export function requestProgress(S, q) {
  const st = stats(S, q.region);
  if (q.kind === 'adopt') return [Math.min(q.n, st.counts[q.sp] || 0), q.n];
  if (q.kind === 'species') return [Math.min(q.n, st.species), q.n];
  if (q.kind === 'set') {
    const ks = Object.keys(q.need);
    return [ks.reduce((n, k) => n + Math.min(q.need[k], needCount(st, k)), 0), ks.reduce((n, k) => n + q.need[k], 0)];
  }
  if (q.kind === 'terrain') return [Math.min(q.n, countOn(S, q.region, q.item, q.on)), q.n];
  if (q.kind === 'place') return [Math.min(q.n, st.items[q.item] || 0), q.n];
  if (q.kind === 'happy') return [Math.min(q.pct, Math.round(st.H * 100 * (st.animals >= 2 ? 1 : 0))), q.pct];
  return [Math.min(q.n, q.got), q.n];
}
export function requestDone(S, q) {
  if (q.kind === 'happy') { const st = stats(S, q.region); return st.animals >= 2 && Math.round(st.H * 100) >= q.pct; }
  const [a, b] = requestProgress(S, q);
  return a >= b;
}
// 지금 낼 수 있는 요청을 종류별로
function requestCandidates(S, rid) {
  const R = S.regions[rid], st = stats(S, rid), out = { adopt: [], species: [], set: [], terrain: [], happy: [], photo: [] };
  const room = st.caps.animals - st.animals, water = swimTiles(S, rid).length > 0;
  const canHave = (sp) => SPECIES[sp].tier <= R.tier && (!SPECIES[sp].swim || water);
  for (const sp of speciesOf(rid)) {
    const have = st.counts[sp] || 0;
    if (have) {
      out.photo.push({ kind: 'photo', sp, n: 1, got: 0, minutes: 1 });
      out.photo.push({ kind: 'photo', sp, n: 1, got: 0, phase: Math.floor(rnd(S) * 4), minutes: 2 });
    }
    if (!canHave(sp) || room <= 0 || have >= ECON.speciesFull || (!have && st.species >= st.caps.species)) continue;
    const add = Math.min(room, ECON.speciesFull - have, 1 + Math.floor(rnd(S) * 2));
    out.adopt.push({ kind: 'adopt', sp, n: have + add, minutes: add });
  }
  if (st.species >= 1 && st.species < st.caps.species && room > 0 && speciesOf(rid).some((sp) => !st.counts[sp] && canHave(sp))) out.species.push({ kind: 'species', n: st.species + 1, minutes: 2 });
  const open = itemsOf(rid).filter((id) => ITEMS[id].tier <= R.tier);
  const needs = SET_NEEDS.filter((k) => open.some((id) => ITEMS[id].give[k] && freeSpot(S, rid, id)));
  if (needs.length) {
    const drop = needs.length > 2 ? pick(S, needs) : null, ks = needs.filter((k) => k !== drop), need = {}; // 두 가지까지
    for (const k of ks) need[k] = needCount(st, k) + 1;
    out.set.push({ kind: 'set', need, minutes: ks.length });
  }
  for (const id of open) for (const k of allowedOn(id)) {
    if (k !== 'flat' && freeSpot(S, rid, id, k)) out.terrain.push({ kind: 'terrain', item: id, on: k, n: countOn(S, rid, id, k) + 1, minutes: 2 });
  }
  if (st.animals >= 2) {
    const pct = Math.ceil((Math.round(st.H * 100) + 5) / 5) * 5;
    if (pct <= 100) out.happy.push({ kind: 'happy', pct, minutes: 3 });
  }
  return out;
}
const reqKey = (q) => `${q.kind}:${q.sp || q.item || q.pct || ''}:${q.on ?? q.phase ?? ''}`;
// 새 요청 하나: 남은 요청과 다른 종류 중에서 종류를 먼저 고르고(종류마다 같은 확률), 그 안에서 하나. avoid = 방금 바꾼 요청(같은 것을 다시 내지 않게)
function makeRequest(S, rid, avoid = null) {
  if (!regionDef(rid)?.ready || !isUnlocked(S, rid)) return null;
  const taken = new Set(S.regions[rid].requests.map((q) => q.kind)), cand = requestCandidates(S, rid);
  const kinds = Object.keys(cand)
    .filter((k) => !taken.has(k))
    .map((k) => cand[k].filter((q) => reqKey(q) !== avoid && !requestDone(S, { ...q, region: rid })))
    .filter((l) => l.length);
  if (!kinds.length) return null;
  const q = pick(S, pick(S, kinds));
  return { uid: S.uid++, region: rid, ...q, reward: Math.max(ECON.requestMin, Math.round(incomePerMin(S, rid) * q.minutes)) };
}
function fillRequests(S, rid) {
  const list = S.regions[rid].requests;
  while (list.length < 3) {
    const q = makeRequest(S, rid);
    if (!q) break;
    list.push(q);
  }
}
export const requestsOf = (S, rid = S.view) => S.regions[rid].requests;
// uid로 요청 찾기(어느 지역 것이든)
function findRequest(S, uid) {
  for (const r of REGIONS) { const list = S.regions[r.id].requests, i = list.findIndex((q) => q.uid === uid); if (i >= 0) return { rid: r.id, list, i }; }
  return null;
}
export function claim(S, uid) {
  const f = findRequest(S, uid);
  if (!f) return no('없는 요청');
  const q = f.list[f.i];
  if (!requestDone(S, q)) return no('아직 덜 됐어요');
  gain(S, f.rid, q.reward);
  f.list.splice(f.i, 1);
  fillRequests(S, f.rid);
  return { ok: true, reward: q.reward };
}
export function swapRequest(S, uid) {
  const f = findRequest(S, uid);
  if (!f) return no('없는 요청');
  const R = S.regions[f.rid];
  if (S.time < R.reqSwapAt) return no(`${Math.ceil(R.reqSwapAt - S.time)}초 뒤에 바꿀 수 있어요`);
  const [old] = f.list.splice(f.i, 1);
  const q = makeRequest(S, f.rid, reqKey(old));
  f.list.splice(f.i, 0, q ?? old);
  R.reqSwapAt = S.time + ECON.swapCooldown;
  return { ok: true };
}

// ---------- T8 섬 꾸미기 ----------
// 섬이 열리면 일반 요청 3장과 따로 6항목(2026-10-30 대니님 승인 후속작업 5). 아무 순서로, 바꾸기·기한 없음.
// 조건을 한 번 채우면 달성으로 기록하고(동물은 섬을 드나드니까) [받기]로 보상(관람 수익 N분치, 최소 requestMin).
// 6항목을 다 받으면 섬 마스터(20분치, 앨범 도장, 지역 카드 🏝️✓). 섬 위 물건·동물은 섬 칸(ISLE.y0행부터)으로 센다. 행복도는 지역 하나에 하나 그대로
export const ISLE_GOALS = [
  { key: 'visit', n: 1, minutes: 5 }, // 섬 첫 방문(화면에서 섬을 확대해 보기 — visitIsle)
  { key: 'item', n: 1, minutes: 3 }, // 섬 첫 물건
  { key: 'needs', n: 3, minutes: 5 }, // 먹이·물·쉼터 물건 하나씩
  { key: 'theme', n: 2, minutes: 6 }, // 지역 테마 물건 2개(ISLE_THEME)
  { key: 'residents', n: 6, minutes: 6 }, // 섬에서 지내는 동물 6마리
  { key: 'terrain', n: 2, minutes: 5 }, // 섬 언덕(낮은·높은)에 하나, 저지대·물에 하나
];
export const ISLE_MASTER_MINUTES = 20;
const onIsle = (y) => y >= ISLE.y0;
function isleNow(S, rid, key) {
  const R = S.regions[rid], items = R.items.filter((it) => onIsle(it.y));
  const on = (ks) => items.some((it) => ks.some((k) => covers(rid, it.id, it.x, it.y, k)));
  if (key === 'visit') return 0;
  if (key === 'item') return items.length;
  if (key === 'needs') return SET_NEEDS.filter((k) => items.some((it) => ITEMS[it.id].give[k])).length;
  if (key === 'theme') return items.filter((it) => ISLE_THEME[rid].includes(it.id)).length;
  if (key === 'residents') return R.animals.filter((a) => onIsle(tileOf(a)[1])).length;
  return (on(['hill', 'high']) ? 1 : 0) + (on(['low', 'water']) ? 1 : 0);
}
export function isleProgress(S, rid, key) {
  const g = ISLE_GOALS.find((x) => x.key === key);
  return [S.regions[rid].isle.done.includes(key) ? g.n : Math.min(g.n, isleNow(S, rid, key)), g.n];
}
export const isleReward = (S, rid, minutes) => Math.max(ECON.requestMin, Math.round(incomePerMin(S, rid) * minutes));
export const isleMaster = (S, rid) => ISLE_GOALS.every((g) => S.regions[rid].isle.got.includes(g.key));
// 받을 수 있는(달성했고 아직 안 받은) 항목 수
export const isleReady = (S, rid) => { const I = S.regions[rid].isle; return I.done.filter((k) => !I.got.includes(k)).length; };
// 새로 채운 항목을 달성으로 기록한다(보고 있는 지역, 1초마다)
function checkIsle(S, rid) {
  if (!isleOpen(S, rid)) return;
  const I = S.regions[rid].isle;
  for (const g of ISLE_GOALS) {
    if (I.done.includes(g.key) || isleNow(S, rid, g.key) < g.n) continue;
    I.done.push(g.key);
    S.events.push({ type: 'isle', region: rid, key: g.key });
  }
}
export function visitIsle(S, rid) {
  const I = S.regions[rid].isle;
  if (!isleOpen(S, rid) || I.done.includes('visit')) return false;
  I.done.push('visit');
  S.events.push({ type: 'isle', region: rid, key: 'visit' });
  return true;
}
export function claimIsle(S, rid, key) {
  const I = S.regions[rid].isle, g = ISLE_GOALS.find((x) => x.key === key);
  if (!g) return no('없는 항목');
  checkIsle(S, rid);
  if (I.got.includes(key)) return no('이미 받았어요');
  if (!I.done.includes(key)) return no('아직 덜 됐어요');
  const reward = isleReward(S, rid, g.minutes);
  gain(S, rid, reward);
  I.got.push(key);
  let master = 0;
  if (isleMaster(S, rid)) {
    master = isleReward(S, rid, ISLE_MASTER_MINUTES);
    gain(S, rid, master);
    S.events.push({ type: 'isleMaster', region: rid, reward: master });
  }
  return { ok: true, reward, master };
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
  gain(S, S.view, (incomePerMin(S) / 60) * dt);
  updateChance(S, dt);
  for (const r of REGIONS) {
    if (!r.ready) continue;
    for (const a of S.regions[r.id].animals) updateAnimal(S, r.id, a, dt);
  }
  if (Math.floor(S.time) !== Math.floor(S.time - dt)) {
    if (S.regions[S.view].requests.length < 3) fillRequests(S, S.view); // 빈 칸은 1초마다 다시 채워 본다(낼 요청이 없을 때 매 프레임 자리 찾기를 하지 않게)
    checkIsle(S, S.view);
  }
}
// 게임을 끈 동안: 보고 있던 지역은 바로 정산(최대 offlineCapSec), 다른 지역은 쉬는 시간에 더해 두었다가 돌아올 때 정산.
// sec = 실제로 비운 시간, gain = 보고 있던 지역에 쌓인 점수. 시계가 뒤로 가면 0
export function settleOffline(S, now) {
  const sec = Math.max(0, (now - S.savedAt) / 1000), n = restGain(S, S.view, sec);
  gain(S, S.view, n);
  for (const r of REGIONS) { const R = S.regions[r.id]; if (r.id !== S.view && R.away != null) R.away -= sec; }
  S.savedAt = now;
  return { sec, gain: n, capped: sec > ECON.offlineCapSec };
}
// 지역 이동: 떠나는 지역은 쉬기 시작하고, 가는 지역은 쉬는 동안 쌓인 관람 수익(최대 offlineCapSec)을 받는다
export function setView(S, rid) {
  if (!regionDef(rid) || !isUnlocked(S, rid) || !regionDef(rid).ready) return regionOpen(S, rid);
  if (rid === S.view) return { ok: true, rest: { sec: 0, gain: 0 } };
  if (S.chance && S.chance.region !== rid) endChance(S);
  const from = S.regions[S.view], to = S.regions[rid], sec = to.away == null ? 0 : S.time - to.away, n = restGain(S, rid, sec);
  from.away = S.time;
  gain(S, rid, n);
  to.away = null;
  S.view = rid;
  fillRequests(S, rid);
  return { ok: true, rest: { sec, gain: n, capped: sec > ECON.offlineCapSec } };
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
  if (!o || !o.regions || !(o.v === SAVE_VERSION || o.v === 3 || (o.v === 2 && Array.isArray(o.requests)) || (o.v === 1 && typeof o.pop === 'number' && Array.isArray(o.requests)))) return null;
  const S = { ...o, events: [] };
  for (const r of REGIONS) S.regions[r.id] ??= newRegion(0);
  for (const r of REGIONS) {
    const R = S.regions[r.id];
    R.items = R.items.filter((it) => ITEMS[it.id]);
    R.animals = R.animals.filter((a) => SPECIES[a.sp]);
  }
  touch(S);
  if (S.v === 1) migrateV1(S);
  if (S.v === 2) migrateV2(S);
  if (S.v === 3) migrateV3(S);
  for (const r of REGIONS) { const R = S.regions[r.id]; R.pop ??= ECON.start; if (R.away === undefined) R.away = r.id === S.view ? null : S.time; R.requests ??= []; R.reqSwapAt ??= 0; R.isle ??= newIsle(); }
  fitTerrain(S);
  return S;
}

// v1(인기점수 하나를 모든 지역이 같이 씀) → v2: 그 점수는 발전도가 가장 높은 지역(같으면 앞 지역)으로, 나머지 지역은 시작 점수로.
// 보고 있지 않던 지역은 지금부터 쉬는 것으로 친다
function migrateV1(S) {
  touch(S);
  let best = REGIONS[0].id;
  for (const r of REGIONS) if (stats(S, r.id).dev > stats(S, best).dev) best = r.id;
  for (const r of REGIONS) {
    const R = S.regions[r.id];
    R.pop = r.id === best ? S.pop : ECON.start;
    R.away = r.id === S.view ? null : S.time;
  }
  delete S.pop;
  S.v = 2;
}
// v2(요청 3장을 모든 지역이 같이 씀) → v3: 요청은 낸 지역으로 나눠 담고, 바꾸기 대기 시간은 지역마다 같은 값으로 시작
function migrateV2(S) {
  for (const r of REGIONS) { const R = S.regions[r.id]; R.requests = []; R.reqSwapAt = S.reqSwapAt || 0; }
  for (const q of S.requests || []) S.regions[q.region]?.requests.push(q);
  delete S.requests; delete S.reqSwapAt;
  S.v = 3;
}
// v3(땅 20×20칸) → v4(40×40칸, 칸 크기 반): 물건·동물 좌표를 2배로. 걷던 동물은 멈추고 다시 길을 정한다.
// 새 지도에 맞지 않는 물건은 이어서 fitTerrain이 가까운 맞는 자리로 옮긴다
function migrateV3(S) {
  for (const r of REGIONS) {
    const R = S.regions[r.id];
    for (const it of R.items) { it.x *= 2; it.y *= 2; }
    for (const a of R.animals) { a.x *= 2; a.y *= 2; a.path = null; a.goal = null; if (a.st === 'walk') { a.st = 'idle'; a.t = 0.5; } }
  }
  touch(S);
  S.v = SAVE_VERSION;
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
      if (at) { it.x = at[0]; it.y = at[1]; R.items.push(it); out.moved++; } else { R.pop += it.paid; out.refunded++; }
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

export { GRID, GW, GH, ISLE, ISLE_THEME, MAX_TIER, TIERS };
