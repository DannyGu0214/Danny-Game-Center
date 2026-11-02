import { BOAT, POLAR, NO_GO, SAIL_K, NAV, SAIL_LEVELS, CAL, SEASONS, WEATHER, HULLS, MODULES, ROLES, CREW_NAMES, SPECIES, REGIONS, REGION_ORDER, ACHIEVEMENTS, DECOR } from './data.js';
import { worldOf } from './world.js';
import * as SH from './ship.js';
// 게임 규칙 전부. 화면이 없고, 시드와 고정 시간 단계만으로 결과가 같다.

const PI = Math.PI, TAU = PI * 2;
export const FIXED_DT = 1 / 30;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (v, to, dt, tau) => v + (to - v) * (1 - Math.exp(-dt / tau));
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

export function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > PI) d -= TAU; else if (d < -PI) d += TAU;
  return d;
}

// 상대 바람각(절댓값, 0 = 정면)의 돛 효율
export function polar(twa) {
  for (let i = 1; i < POLAR.length; i++) {
    const [a0, v0] = POLAR[i - 1], [a1, v1] = POLAR[i];
    if (twa <= a1) return v0 + (v1 - v0) * (twa - a0) / (a1 - a0);
  }
  return POLAR[POLAR.length - 1][1];
}

// ── 달력과 날씨 ──
export function clock(S) {
  const day = Math.floor(S.clock / CAL.day), si = Math.floor(day / CAL.seasonDays) % 4;
  return { day, season: SEASONS[si], si, dayOfSeason: day % CAL.seasonDays, year: Math.floor(day / (CAL.seasonDays * 4)), part: Math.floor((S.clock % CAL.day) / CAL.day * 4) };
}
// 날마다 날씨는 시드로 정해 둔다(예보가 그대로 맞는다)
export function dayWeather(seed, day) {
  const si = Math.floor(day / CAL.seasonDays) % 4, sea = SEASONS[si];
  const gust = hash(seed + 3.1, day) < sea.gust ? (0.12 + 0.76 * hash(seed + 7.7, day)) * CAL.day : null;
  const heat = !!sea.heat && hash(seed + 11.3, day) < sea.heat;
  const dos = day % CAL.seasonDays;
  const drought = (si === 1 && dos >= 3) || (si === 2 && dos <= 2);
  return { day, gust, heat, drought };
}
export function forecast(S) {
  const st = stats(S), today = clock(S).day, out = [];
  for (let d = 0; d <= st.forecast; d++) out.push(dayWeather(S.seed, today + d));
  return out;
}
function weatherNow(S) {
  const c = clock(S), w = dayWeather(S.seed, c.day), inDay = S.clock % CAL.day, def = REGIONS[S.region];
  const gustOn = w.gust !== null && inDay >= w.gust && inDay < w.gust + WEATHER.gustLen;
  const gustSoon = w.gust !== null && inDay >= w.gust - WEATHER.gustWarn && inDay < w.gust;
  return { heat: w.heat && !!def.heat, drought: w.drought, gustOn, gustSoon };
}
export function windAt(S) {
  const def = REGIONS[S.region].wind, t = S.t, ph = S.ph;
  const from = def.from + def.swing * (Math.sin(t / 83 + ph) + 0.45 * Math.sin(t / 31 + ph * 2));
  const speed = def.speed * (1 + 0.2 * Math.sin(t / 19 + ph * 3) + 0.12 * Math.sin(t / 6.3 + ph));
  return { from, speed };
}

// ── 시작 ──
export function newGame(seed = 1) {
  const S = {
    v: 1, seed, t: 0, clock: 0, rng: (seed * 2654435761) >>> 0,
    ph: (seed * 2.399963) % TAU,
    region: 'pond', visited: { pond: 1 }, lastPort: { region: 'pond', id: 'reed' },
    wind: null, weather: { heat: false, drought: false, gustOn: false, gustSoon: false },
    boat: { x: 0, y: 0, h: -PI / 2, spd: 0, turn: 0, rudder: 0, sailLevel: 0, sailNow: 0, lastSail: 2, row: false, rowPhase: 0, stamina: 1, boom: 0.2, luff: false, heel: 0, twa: 0, grounded: false, shoal: false },
    cap: { x: HULLS.raft.helmX, at: 'helm', to: null, then: null },
    route: null, docked: 'reed', disaster: null, events: [],
    res: { wood: 15, cloth: 0, coin: 10 }, hold: { wood: 0, cloth: 0, coin: 0 },
    food: HULLS.raft.foodBase, hull: 1, vigor: 1,
    ship: { hull: 'raft', mods: [{ id: 'oar', col: 1, row: 1, rot: 0 }], name: '새벽호', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] },
    crew: [], hiredEver: {}, owed: 0, wageDay: 0,
    flot: {}, fog: {}, found: {}, blueprints: {}, seen: {}, photos: {}, ach: {},
    stats: { rowDist: 0, sailDist: 0, dist: 0, tacks: 0, gusts: 0, gustHurt: 0, heatDays: 0, rescues: 0 },
    ended: false, rev: 0,
  };
  S.wind = windAt(S);
  placeAtPort(S, 'reed');
  return S;
}
const W = (S) => worldOf(S.region);
const rnd = (S) => { S.rng = (S.rng + 0x6D2B79F5) >>> 0; let t = S.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const stats = (S) => SH.statsOf(S.ship, holdUsed(S), S.food);
export const holdUsed = (S) => S.hold.wood + S.hold.cloth + S.hold.coin;
export const isUnlocked = (S, id) => { const n = MODULES[id].need; return (!n.region || S.visited[n.region]) && (!n.blueprint || S.blueprints[n.blueprint]); };
export const hasRole = (S, role) => S.crew.some((c) => c.role === role);
function emit(S, type, data) { S.events.push({ type, ...data }); }

function placeAtPort(S, portId) {
  const w = W(S), p = w.ports.find((q) => q.id === portId), b = S.boat, [gx, gy] = w.gradient(p.x, p.y);
  b.x = p.x; b.y = p.y; b.h = Math.atan2(gy, gx); b.spd = 0; b.turn = 0; b.rudder = 0; b.row = false; b.grounded = false;
  S.docked = portId; S.route = null;
  S.lastPort = { region: S.region, id: portId };
  revealFog(S);
}

// ── 조작 ──
const stationX = (S, where) => {
  const st = stats(S);
  if (where === 'mast' && st.mast) return st.mastX - 0.55;
  if (where === 'oar') { const o = S.ship.mods.find((m) => m.id === 'oar'); if (o) return SH.modulePos(S.ship.hull, o)[0]; }
  return HULLS[S.ship.hull].helmX;
};
// 선장을 그 자리로 걷게 한다. 도착하면 then을 한다
function walkTo(S, where, then) {
  S.cap.to = where; S.cap.then = then || null;
  if (Math.abs(S.cap.x - stationX(S, where)) < 0.05) arriveCap(S);
}
function arriveCap(S) {
  const c = S.cap, then = c.then;
  c.at = c.to; c.to = null; c.then = null;
  if (then) applyAction(S, then);
}
function applyAction(S, a) {
  const b = S.boat;
  if (a.type === 'sail') {
    b.sailLevel = a.level; if (a.level > 0) b.lastSail = a.level;
    if (!b.row) walkTo(S, 'helm');
    else walkTo(S, 'oar');
  } else if (a.type === 'row') { b.row = a.on; if (!a.on) walkTo(S, 'helm'); }
}
const canSteer = (S) => hasRole(S, 'helmsman') || S.cap.to === null && (S.cap.at === 'helm' || S.cap.at === 'oar');
export function setRudder(S, r) {
  if (S.docked) return;
  S.boat.rudder = clamp(r, -1, 1);
  S.route = null;
  if (!hasRole(S, 'helmsman') && S.cap.at !== 'helm' && S.cap.at !== 'oar' && !S.cap.to) walkTo(S, 'helm');
}
export function setSail(S, level) {
  if (!stats(S).sailArea) return false;
  level = clamp(level, 0, SAIL_LEVELS.length - 1);
  if (hasRole(S, 'deckhand')) { S.boat.sailLevel = level; if (level > 0) S.boat.lastSail = level; return true; }
  walkTo(S, 'mast', { type: 'sail', level });
  return true;
}
export function setRow(S, on) {
  if (on && !stats(S).oars) return false;
  if (on) walkTo(S, 'oar', { type: 'row', on: true });
  else { S.boat.row = false; walkTo(S, 'helm'); }
  return true;
}
// 탭한 곳으로 자동 항로. 움직일 힘이 없으면 돛을 올리거나 노를 젓는다
export function setDest(S, x, y, target = null) {
  if (S.docked) return false;
  const b = S.boat, w = W(S), [dx, dy] = w.nearestWater(x, y), pts = w.findPath(b.x, b.y, dx, dy);
  if (!pts) return false;
  S.route = { pts, i: 0, side: 0, since: 99, dx, dy, target };
  const st = stats(S);
  if (b.sailLevel === 0 && !b.row && !(S.cap.then && S.cap.then.type === 'sail')) {
    if (st.sailArea) setSail(S, b.lastSail);
    else if (st.oars) setRow(S, true);
  }
  if (!hasRole(S, 'helmsman') && !S.cap.to && S.cap.at === 'mast') walkTo(S, 'helm');
  return true;
}
export const clearRoute = (S) => { S.route = null; S.boat.rudder = 0; };

// 입항: 항구 근처면 바로, 아니면 항로로 간다
export function nearPort(S, r = NAV.dock + 8) { return W(S).ports.find((p) => Math.hypot(p.x - S.boat.x, p.y - S.boat.y) < r) || null; }
export function nearGate(S, r = NAV.dock + 8) { return W(S).gates.find((g) => Math.hypot(g.x - S.boat.x, g.y - S.boat.y) < r) || null; }
export function dock(S, portId) {
  placeAtPort(S, portId);
  const got = { ...S.hold };
  for (const k of Object.keys(S.hold)) { S.res[k] += S.hold[k]; S.hold[k] = 0; }
  S.boat.sailLevel = 0; S.boat.row = false;
  S.vigor = 1; S.boat.stamina = 1;
  S.cap.to = null; S.cap.then = null; S.cap.at = 'helm'; S.cap.x = HULLS[S.ship.hull].helmX;
  payWages(S);
  // 굶는 사람은 돌려보내지 않는다: 코인이 없으면 마을에서 하루치를 나눠 줘요
  const persons = 1 + S.crew.length;
  let gift = 0;
  if (S.food < persons && S.res.coin < persons * FOOD_PRICE) { gift = persons - S.food; S.food = persons; }
  checkAch(S);
  emit(S, 'docked', { got, port: portId, gift });
  return got;
}
function payWages(S) {
  const due = Math.ceil(S.owed);
  if (due <= 0) return;
  if (S.res.coin >= due) { S.res.coin -= due; S.owed = 0; emit(S, 'wages', { pay: due }); return; }
  S.res.coin = 0; S.owed = 0;
  const left = S.crew.pop();
  if (left) emit(S, 'crewLeft', { name: left.name });
}
export function undock(S) {
  if (!S.docked) return { ok: false };
  const c = departureCheck(S);
  if (!c.ok) return { ok: false, why: c.blockers[0] };
  S.docked = null; S.boat.spd = 0.5;
  S.cap.x = HULLS[S.ship.hull].helmX; S.cap.at = 'helm';
  return { ok: true };
}
// 출항 점검: blockers는 못 나가는 이유, warns는 위험하지만 나갈 수 있는 것
export function departureCheck(S, days = 2) {
  const st = stats(S), blockers = [], warns = [];
  if (!st.canMove) blockers.push('노 자리나 돛대가 있어야 움직여요');
  if (st.overload) blockers.push('너무 무거워요. 짐이나 모듈을 줄여요');
  if (S.crew.length < 0) blockers.push('');
  const persons = 1 + S.crew.length;
  if (S.food < persons * days) warns.push(`식량이 ${Math.floor(S.food / persons)}일치뿐이에요`);
  if (S.hull < 0.5) warns.push('선체가 많이 상했어요');
  if (st.load > 0.9) warns.push('짐이 많아 느려요');
  const fc = forecast(S);
  if (fc.some((d) => d.gust !== null) && st.sailArea) warns.push('예보에 돌풍이 있어요');
  if (REGIONS[S.region].heat && fc.some((d) => d.heat) && !st.awning) warns.push('무더위 예보: 그늘막이 없어요');
  if (S.region === 'river' && fc.some((d) => d.drought) && st.draft > 0.75) warns.push('가뭄 예보: 배가 깊어 여울에 걸려요');
  return { ok: !blockers.length, blockers, warns };
}

// ── 항구에서 할 일 ──
const canPay = (S, cost) => Object.entries(cost).every(([k, v]) => S.res[k] >= v);
const pay = (S, cost, sign = 1) => { for (const [k, v] of Object.entries(cost)) S.res[k] -= v * sign; };
export const FOOD_PRICE = 1;
export function buyFood(S, n = 1) {
  const st = stats(S), room = Math.max(0, st.foodCap - S.food), k = Math.min(n, Math.floor(room), S.res.coin / FOOD_PRICE | 0);
  if (!S.docked || k <= 0) return false;
  S.food += k; S.res.coin -= k * FOOD_PRICE;
  return k;
}
// 재료를 코인으로 판다(목재 2개에 1코인, 천 1개에 1코인). 코인이 없어 막히는 일을 막는다
export const SELL_RATE = { wood: 0.5, cloth: 1 };
export function sell(S, k, n) {
  if (!S.docked || !SELL_RATE[k]) return 0;
  n = Math.min(n, S.res[k]);
  if (k === 'wood') n -= n % 2;
  if (n <= 0) return 0;
  const coin = Math.floor(n * SELL_RATE[k]);
  S.res[k] -= n; S.res.coin += coin;
  return coin;
}
export const repairCost = (S) => Math.ceil((1 - S.hull) * 40 * HULLS[S.ship.hull].grade);
export function repair(S) {
  const c = repairCost(S);
  if (!S.docked || c <= 0 || S.res.coin < c) return false;
  S.res.coin -= c; S.hull = 1;
  return true;
}
export function waitDay(S) {
  if (!S.docked) return false;
  S.clock += CAL.day - (S.clock % CAL.day);
  S.owed += S.crew.reduce((a, c) => a + c.wage, 0);
  payWages(S);
  return true;
}
export function hireList(S, region = S.region) {
  return Object.entries(ROLES).filter(([id, r]) => !hasRole(S, id) && REGIONS[r.region].order <= REGIONS[region].order).map(([id, r]) => ({ role: id, ...r }));
}
export function hire(S, role) {
  const R = ROLES[role], st = stats(S);
  if (!S.docked || S.crew.length >= st.crewCap) return { ok: false, why: '잠자리(해먹)가 모자라요' };
  if (hasRole(S, role)) return { ok: false, why: '이미 있어요' };
  if (S.res.coin < R.hire) return { ok: false, why: '코인이 모자라요' };
  S.res.coin -= R.hire;
  const name = CREW_NAMES[Math.floor(rnd(S) * CREW_NAMES.length)];
  S.crew.push({ role, name, wage: R.wage });
  S.hiredEver[role] = 1;
  checkAch(S);
  return { ok: true, name };
}
export function dismiss(S, role) { S.crew = S.crew.filter((c) => c.role !== role); }

export function placeModule(S, id, col, row, rot = 0) {
  if (!S.docked) return { ok: false, why: '항구에서만 고칠 수 있어요' };
  const M = MODULES[id];
  if (!isUnlocked(S, id)) return { ok: false, why: '아직 잠겨 있어요' };
  if (!canPay(S, M.cost)) return { ok: false, why: '재료가 모자라요' };
  const m = { id, col, row, rot };
  if (!SH.canPlace(S.ship, m)) return { ok: false, why: M.sail && S.ship.mods.some((o) => MODULES[o.id].sail) ? '돛대는 하나만 세워요' : '그 자리엔 안 들어가요' };
  pay(S, M.cost);
  S.ship.mods.push(m); S.rev++;
  return { ok: true };
}
export function removeModule(S, col, row) {
  if (!S.docked) return false;
  const m = SH.moduleAt(S.ship, col, row);
  if (!m) return false;
  const cost = MODULES[m.id].cost;
  for (const [k, v] of Object.entries(cost)) S.res[k] += Math.ceil(v / 2);
  S.ship.mods = S.ship.mods.filter((o) => o !== m); S.rev++;
  return true;
}
// 새 선체: 모듈은 값 절반을 돌려받는다
export function buildHull(S, id) {
  const H = HULLS[id];
  if (!S.docked) return { ok: false, why: '항구에서만 지어요' };
  if (H.grade <= HULLS[S.ship.hull].grade) return { ok: false, why: '이미 더 큰 배예요' };
  if (id === 'sloop' && !S.visited.lake) return { ok: false, why: '큰 호수에서 지을 수 있어요' };
  if (!canPay(S, H.price)) return { ok: false, why: '재료가 모자라요' };
  pay(S, H.price);
  for (const m of S.ship.mods) for (const [k, v] of Object.entries(MODULES[m.id].cost)) S.res[k] += Math.ceil(v / 2);
  S.ship.hull = id; S.ship.mods = [];
  // 노 자리 하나는 달아 준다(움직일 수 있게)
  const free = SH.validCells(id).find(([c, r]) => r >= Math.floor(H.rows / 2) && c === Math.floor(H.cols / 2)) || SH.validCells(id)[0];
  S.ship.mods.push({ id: 'oar', col: free[0], row: free[1], rot: 0 });
  S.food = Math.min(S.food, SH.statsOf(S.ship, 0, 0).foodCap);
  S.crew = S.crew.slice(0, 0);
  S.hull = 1; S.cap.x = H.helmX; S.rev++;
  checkAch(S);
  emit(S, 'built', { id });
  return { ok: true };
}
export function setPaint(S, key, i) { S.ship.paint[key] = i; S.stats.painted = 1; S.rev++; checkAch(S); }
export function setName(S, name) { S.ship.name = String(name).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 12) || S.ship.name; S.stats.painted = 1; checkAch(S); }
export function toggleDecor(S, id) {
  if (!DECOR[id] || !decorOpen(S, id)) return false;
  S.ship.decor = S.ship.decor.includes(id) ? S.ship.decor.filter((d) => d !== id) : [...S.ship.decor, id];
  S.rev++;
  return true;
}
export const decorOpen = (S, id) => ACHIEVEMENTS.some((a) => a.decor === id && S.ach[a.id]);

// 수문: 조건을 보여 주고 넘어간다
export function gateStatus(S, gate) {
  const r = gate.req, st = stats(S), list = [];
  if (r.grade) list.push({ text: `${['', '뗏목', '나룻배', '슬루프'][r.grade]} 이상`, ok: HULLS[S.ship.hull].grade >= r.grade });
  if (r.found) { const n = W(S).finds.filter((f) => S.found[f.id]).length; list.push({ text: `이 수역 발견지 ${r.found}곳(${n})`, ok: n >= r.found }); }
  if (r.draft) list.push({ text: `흘수 ${r.draft}m 이하(${st.draft.toFixed(2)}m)`, ok: st.draft <= r.draft });
  return { list, ok: list.every((x) => x.ok) };
}
export function passGate(S, gate) {
  if (!gateStatus(S, gate).ok) return false;
  if (!gate.to) { S.ended = true; S.ach.riverEnd || giveAch(S, 'riverEnd'); emit(S, 'ended'); return true; }
  const from = S.region;
  // 화물은 그대로 싣고 넘어간다. 도착 항구에 들르면 창고로 옮겨요
  S.region = gate.to; S.visited[gate.to] = 1;
  placeAtPort(S, gate.entry);
  S.docked = gate.entry;
  S.cap.x = HULLS[S.ship.hull].helmX; S.cap.at = 'helm'; S.cap.to = null;
  const got = { ...S.hold };
  for (const k of Object.keys(S.hold)) { S.res[k] += S.hold[k]; S.hold[k] = 0; }
  emit(S, 'region', { from, to: gate.to, got });
  checkAch(S);
  return true;
}

// ── 기록 ──
export function recordSpecies(S, id) {
  if (!SPECIES[id] || S.seen[id]) return 0;
  const R = SPECIES[id].reward;
  S.seen[id] = 1; S.res.coin += R;
  emit(S, 'species', { id, reward: R });
  checkAch(S);
  return R;
}
function giveAch(S, id) {
  const a = ACHIEVEMENTS.find((q) => q.id === id);
  if (!a || S.ach[id]) return;
  S.ach[id] = 1; S.res.coin += a.coin || 0;
  emit(S, 'ach', { id });
}
const worldDone = (S, region) => worldOf(region).finds.every((f) => S.found[f.id]);
export function checkAch(S) {
  const c = (id, ok) => { if (ok) giveAch(S, id); };
  const t = S.stats;
  c('firstRow', t.rowDist >= 100);
  c('firstPort', t.docks >= 1);
  c('rowboat', HULLS[S.ship.hull].grade >= 2);
  c('pondAll', worldDone(S, 'pond'));
  c('firstSail', t.sailDist >= 200);
  c('firstTack', t.tacks >= 1);
  c('paint', t.painted);
  c('gustSafe', t.gusts - t.gustHurt >= 1);
  c('heatSafe', t.heatDays >= 1);
  c('crew3', Object.keys(S.hiredEver).length >= 3);
  c('sloop', S.ship.hull === 'sloop');
  c('lakeAll', worldDone(S, 'lake'));
  const nSeen = Object.keys(S.seen).length;
  c('species5', nSeen >= 5);
  c('speciesAll', nSeen >= Object.keys(SPECIES).length);
}

// ── 안개 걷기 ──
const FOG_CELL = 24;
function fogGrid(region) { const [x0, y0, x1, y1] = worldOf(region).bounds; return { x0, y0, cols: Math.ceil((x1 - x0) / FOG_CELL), rows: Math.ceil((y1 - y0) / FOG_CELL) }; }
export const fogInfo = (region) => ({ ...fogGrid(region), cell: FOG_CELL });
export function fogOf(S, region) {
  const g = fogGrid(region);
  if (!S.fog[region] || S.fog[region].length !== g.cols * g.rows) S.fog[region] = '0'.repeat(g.cols * g.rows);
  return S.fog[region];
}
function revealFog(S) {
  const g = fogGrid(S.region), st = stats(S), R = 70 + (st.telescope ? 40 : 0) + (hasRole(S, 'lookout') ? 40 : 0);
  const arr = fogOf(S, S.region).split(''); let changed = false;
  const b = S.boat, ci = Math.floor((b.x - g.x0) / FOG_CELL), cj = Math.floor((b.y - g.y0) / FOG_CELL), n = Math.ceil(R / FOG_CELL);
  for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) {
    if (i < 0 || j < 0 || i >= g.cols || j >= g.rows) continue;
    if (Math.hypot(i - ci, j - cj) * FOG_CELL > R) continue;
    const k = j * g.cols + i;
    if (arr[k] === '0') { arr[k] = '1'; changed = true; }
  }
  if (changed) S.fog[S.region] = arr.join('');
}

// ── 건지기 ──
export function flotsamOf(S, region = S.region) { if (!S.flot[region]) S.flot[region] = []; return S.flot[region]; }
function spawnFlot(S) {
  const def = REGIONS[S.region].flot, list = flotsamOf(S), w = W(S), [x0, y0, x1, y1] = w.bounds;
  if (list.length >= def.cap) return;
  for (let t = 0; t < 40; t++) {
    const x = x0 + rnd(S) * (x1 - x0), y = y0 + rnd(S) * (y1 - y0);
    if (w.dist(x, y) < 10) continue;
    if (Math.hypot(x - S.boat.x, y - S.boat.y) < 40) continue;
    const total = def.table.reduce((a, e) => a + e[1], 0); let r = rnd(S) * total, pick = def.table[0];
    for (const e of def.table) { if (r < e[1]) { pick = e; break; } r -= e[1]; }
    list.push({ x, y, k: pick[0], n: pick[2] + Math.floor(rnd(S) * (pick[3] - pick[2] + 1)), ph: rnd(S) * TAU });
    return;
  }
}
function collectFlot(S) {
  const st = stats(S), b = S.boat, list = flotsamOf(S), R = 6 + (st.telescope ? 3 : 0) + (hasRole(S, 'lookout') ? 6 : 0);
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    if (Math.hypot(f.x - b.x, f.y - b.y) > R) continue;
    const room = st.holdCap - holdUsed(S);
    if (room <= 0) { if (!S.holdFullWarned) { S.holdFullWarned = 1; emit(S, 'holdFull'); } return; }
    const n = Math.min(room, f.n);
    S.hold[f.k] += n;
    emit(S, 'pick', { k: f.k, n, x: f.x, y: f.y });
    list.splice(i, 1);
  }
  S.holdFullWarned = 0;
}

// ── 발견 ──
function checkFinds(S) {
  const st = stats(S), b = S.boat, R = 26 + (st.telescope ? 14 : 0) + (hasRole(S, 'lookout') ? 14 : 0);
  for (const f of W(S).finds) {
    if (S.found[f.id] || Math.hypot(f.x - b.x, f.y - b.y) > R) continue;
    S.found[f.id] = 1;
    S.res.coin += f.coin || 0; S.res.wood += f.wood || 0; S.res.cloth += f.cloth || 0;
    if (f.blueprint) S.blueprints[f.blueprint] = 1;
    emit(S, 'found', { id: f.id, name: f.name, coin: f.coin, wood: f.wood, cloth: f.cloth, blueprint: f.blueprint });
    checkAch(S);
  }
}

// ── 파국과 구조 ──
function disaster(S, cause) {
  if (S.disaster) return;
  S.disaster = { cause };
  S.route = null; S.boat.row = false; S.boat.sailLevel = 0;
  emit(S, 'disaster', { cause });
}
export function rescue(S) {
  if (!S.disaster) return null;
  const lost = { ...S.hold }, port = S.lastPort, broke = [];
  for (const k of Object.keys(S.hold)) S.hold[k] = 0;
  // 돛대·노는 남기고 모듈 하나가 부서진다
  const opts = S.ship.mods.filter((m) => !MODULES[m.id].sail && m.id !== 'oar');
  if (opts.length) { const m = opts[Math.floor(rnd(S) * opts.length)]; S.ship.mods = S.ship.mods.filter((o) => o !== m); broke.push(m.id); S.rev++; }
  const left = S.crew.length ? S.crew.pop() : null;
  const fee = Math.min(S.res.coin, 10 * HULLS[S.ship.hull].grade);
  S.res.coin -= fee;
  S.hull = 0.35; S.vigor = 0.8; S.food = Math.max(S.food, 1);
  S.region = port.region;
  placeAtPort(S, port.id);
  S.boat.sailLevel = 0; S.boat.sailNow = 0;
  S.cap.x = HULLS[S.ship.hull].helmX; S.cap.at = 'helm'; S.cap.to = null; S.cap.then = null;
  S.stats.rescues++;
  const out = { lost, broke, left: left && left.name, fee, cause: S.disaster.cause, port: port.id };
  S.disaster = null;
  return out;
}

// ── 자동 조타 ──
function blocked(S, x, y, a, L, clear = 9) {
  const w = W(S), dx = Math.cos(a), dy = Math.sin(a), draft = stats(S).draft, k = S.weather.drought ? WEATHER.droughtDepth : 1, n = Math.ceil(L / 2);
  const shoals = !(S.route && S.route.noShoal);
  for (let i = 0; i <= n; i++) {
    const px = x + dx * i * 2, py = y + dy * i * 2;
    if (w.dist(px, py) < clear) return true;
    if (shoals && w.depthAt(px, py) * k < draft) return true;
  }
  return false;
}
function tack(S, r, side) { r.side = side; r.since = 0; emit(S, 'tack'); }
function autopilot(S, dt) {
  const r = S.route, b = S.boat;
  let wp = r.pts[r.i], dx = wp.x - b.x, dy = wp.y - b.y;
  const last = r.i === r.pts.length - 1;
  // 도착 거리는 배 크기에 맞춘다(큰 배는 회전 반경이 커서 일찍 끝낸다). 건지러 갈 때는 바짝 간다
  const arriveR = r.target && r.target.type === 'pick' ? 4 : stats(S).hull.len * 1.3;
  if (Math.hypot(dx, dy) < (last ? arriveR : NAV.waypoint)) {
    if (last) { arrive(S); return; }
    r.i++; wp = r.pts[r.i]; dx = wp.x - b.x; dy = wp.y - b.y;
  }
  r.since += dt;
  // 여울을 피해 맴돌기만 하면(목적지가 여울 안일 때) 30초 뒤엔 그냥 지나간다
  const left = Math.hypot(dx, dy);
  if (r.bestI !== r.i || left < r.best - 5) { r.best = left; r.bestI = r.i; r.bestT = S.t; } else if (S.t - r.bestT > 30 && !r.noShoal) { r.noShoal = true; emit(S, 'shoalRisk'); }
  if (last && left < 30 && S.t - r.bestT > 22) { arrive(S); return; } // 큰 배가 목적지 둘레를 맴돌면 끝낸다
  const bearing = Math.atan2(dy, dx), up = S.wind.from, rel = angDiff(bearing, up);
  const sailing = b.sailLevel > 0 && !b.row;
  let want = bearing;
  if (sailing && Math.abs(rel) < NAV.tackAngle) {
    if (!r.side) r.side = angDiff(b.h, up) >= 0 ? 1 : -1;
    const past = r.side > 0 ? rel < -NAV.lay : rel > NAV.lay;
    if (past && r.since > NAV.minTack) tack(S, r, -r.side);
    want = up + r.side * NAV.tackAngle;
    if (blocked(S, b.x, b.y, want, NAV.look) && r.since > NAV.minTack) { tack(S, r, -r.side); want = up + r.side * NAV.tackAngle; }
  } else {
    r.side = 0;
    if (blocked(S, b.x, b.y, want, NAV.look)) {
      for (let k = 1; k <= 8; k++) {
        const pick = [want + k * 0.26, want - k * 0.26].find((a) => !blocked(S, b.x, b.y, a, NAV.look) && (!sailing || Math.abs(angDiff(a, up)) >= NAV.tackAngle));
        if (pick !== undefined) { want = pick; break; }
      }
    }
  }
  // 물가에 바짝 붙으면 물가에서 멀어지는 쪽을 섞는다(바람과 물살에 밀려 붙은 채 있지 않게)
  const w = W(S), d0 = w.dist(b.x, b.y);
  if (d0 < 11) {
    const [gx, gy] = w.gradient(b.x, b.y), k = (11 - d0) / 5;
    const mixed = Math.atan2(Math.sin(want) + gy * k, Math.cos(want) + gx * k);
    if (!sailing || Math.abs(angDiff(mixed, up)) >= NO_GO + 0.1) want = mixed;
  }
  b.rudder = clamp(angDiff(want, b.h) * 1.9, -1, 1);
}
function arrive(S) {
  const r = S.route, b = S.boat;
  const t = r.target;
  S.route = null; b.rudder = 0;
  emit(S, 'arrive', { target: t });
  if (t && t.type === 'port') { S.stats.docks = (S.stats.docks || 0) + 1; dock(S, t.id); return; }
  if (t && t.type === 'gate') { emit(S, 'atGate', { id: t.id }); }
  if (t && t.type === 'pick') return; // 건지기는 잠깐 들르는 것이라 돛·노를 그대로 둔다
  if (b.row) { b.row = false; walkTo(S, 'helm'); } else if (stats(S).sailArea) setSail(S, 0);
}
export function dockHere(S, port) { S.stats.docks = (S.stats.docks || 0) + 1; dock(S, port.id); }

// ── 한 단계 ──
export function step(S, dt) {
  S.t += dt;
  if (S.docked || S.disaster || S.ended) { S.wind = windAt(S); return S; }
  S.clock += dt;
  const b = S.boat, st = stats(S), w = W(S), wx = weatherNow(S), prev = S.weather;
  S.weather = wx;
  S.wind = windAt(S);
  if (wx.gustOn) S.wind.speed *= REGIONS[S.region].gustK;
  const { from, speed: wspd } = S.wind;

  // 돌풍: 전조·시작·끝
  if (wx.gustSoon && !prev.gustSoon) emit(S, 'gustSoon');
  if (wx.gustOn && !prev.gustOn) { S.gustHurt = 0; emit(S, 'gustOn'); if (hasRole(S, 'deckhand') && b.sailLevel === 2) { b.sailLevel = 1; S.reefedByCrew = 1; } }
  if (!wx.gustOn && prev.gustOn) {
    S.stats.gusts++; if (S.gustHurt > 0.005) S.stats.gustHurt++;
    if (S.reefedByCrew) { b.sailLevel = 2; S.reefedByCrew = 0; }
    emit(S, 'gustOff', { hurt: S.gustHurt }); checkAch(S);
  }
  if (wx.heat && !prev.heat) emit(S, 'heatOn', { shade: st.awning });
  if (wx.drought && !prev.drought && S.region === 'river') emit(S, 'droughtOn');

  // 선장 걷기
  const c = S.cap;
  if (c.to) {
    const tx = stationX(S, c.to), mv = BOAT.walk * dt;
    if (Math.abs(tx - c.x) <= mv) { c.x = tx; arriveCap(S); } else c.x += Math.sign(tx - c.x) * mv;
  }
  if (S.route) { if (canSteer(S)) autopilot(S, dt); else b.rudder = 0; } else if (!canSteer(S)) b.rudder = 0;
  if (S.docked) return S;

  // 돛 올리고 내리기
  const wantSail = SAIL_LEVELS[b.sailLevel] * (st.sailArea ? 1 : 0);
  b.sailNow += clamp(wantSail - b.sailNow, -dt * 0.7, dt * 0.7);

  const windSide = angDiff(from, b.h);
  const twa = Math.abs(windSide);
  b.twa = twa;
  b.luff = twa < NO_GO && b.sailNow > 0.03;
  const sailT = Math.min(st.maxSpeed, polar(twa) * wspd * SAIL_K * (0.45 + 0.55 * st.sailArea)) * Math.pow(b.sailNow, 0.7);

  let rowT = 0;
  if (b.row) {
    const before = Math.sin(b.rowPhase);
    b.rowPhase = (b.rowPhase + dt * TAU / BOAT.rowPeriod) % TAU;
    if (before <= 0 && Math.sin(b.rowPhase) > 0) emit(S, 'stroke');
    b.stamina = Math.max(0, b.stamina - BOAT.staminaDrain * (wx.heat && !st.awning ? 1.5 : 1) * dt);
    rowT = st.rowSpeed * (b.stamina > 0 ? 1 : BOAT.tired) * (0.82 + 0.36 * Math.max(0, Math.sin(b.rowPhase)));
  } else b.stamina = Math.min(1, b.stamina + BOAT.staminaRest * dt);

  // 여울: 배가 수심보다 깊으면 걸린다
  const depth = w.depthAt(b.x, b.y) * (wx.drought ? WEATHER.droughtDepth : 1);
  const onShoal = st.draft > depth;
  let target = Math.max(sailT, rowT) + 0.25 * Math.min(sailT, rowT);
  if (onShoal) { target = Math.min(target, 0.7); if (!b.shoal) emit(S, 'shoal'); if (b.spd > 0.25) S.hull -= WEATHER.shoalHurt * dt; }
  b.shoal = onShoal;
  b.spd = ease(b.spd, target, dt, target > b.spd ? BOAT.accel : BOAT.coast);

  // 키
  let steer = Math.max(BOAT.minSteer, Math.min(1, b.spd / BOAT.fullSteerSpd));
  if (b.row) steer = Math.max(steer, BOAT.rowSteer);
  b.turn = ease(b.turn, b.rudder * st.hull.turn * steer, dt, BOAT.turnLag);
  b.h = (b.h + b.turn * dt) % TAU;
  b.spd *= Math.exp(-Math.abs(b.turn) * 0.1 * dt);

  // 돛 각도: 맞바람일수록 조이고 뒷바람일수록 푼다
  const trim = (12 + clamp((twa - NO_GO) / (PI - NO_GO), 0, 1) * 68) * PI / 180;
  const boomT = b.luff ? Math.sign(b.boom || 1) * 0.1 : -Math.sign(windSide || 1) * trim;
  const boomBefore = b.boom;
  b.boom += clamp(boomT - b.boom, -dt * 1.5, dt * 1.5);
  if (boomBefore * b.boom < 0 && b.sailNow > 0.2) {
    emit(S, 'swing');
    if (twa < PI / 2) { S.stats.tacks++; checkAch(S); }
  }

  // 기울기: 복원력을 넘으면 선체가 상한다
  const force = Math.min(1.35, wspd / 12) * Math.sin(twa) * 0.34 * Math.sqrt(st.sailArea || 0) / st.stability;
  const heelT = b.luff ? 0 : Math.sign(windSide) * b.sailNow * force;
  b.heel = ease(b.heel, heelT, dt, 1.6);
  if (Math.abs(b.heel) > WEATHER.heelSafe) {
    const hurt = (Math.abs(b.heel) - WEATHER.heelSafe) * WEATHER.heelHurt * dt;
    S.hull -= hurt; S.gustHurt = (S.gustHurt || 0) + hurt;
    if (!S.heelWarnAt || S.t - S.heelWarnAt > 8) { S.heelWarnAt = S.t; emit(S, 'heel'); }
  }

  // 이동: 뱃머리 방향 + 바람에 밀림 + 물살
  const lee = 0.018 * wspd * (0.25 + b.sailNow) * (0.4 + Math.sin(twa));
  const [fx, fy] = w.flowAt(b.x, b.y);
  const vx = Math.cos(b.h) * b.spd - Math.cos(from) * lee + fx;
  const vy = Math.sin(b.h) * b.spd - Math.sin(from) * lee + fy;
  let nx = b.x + vx * dt, ny = b.y + vy * dt;
  const d = w.dist(nx, ny);
  if (d < BOAT.clear) {
    const [gx, gy] = w.gradient(nx, ny);
    nx += gx * (BOAT.clear - d); ny += gy * (BOAT.clear - d);
    if (!b.grounded && b.spd > 1) { emit(S, 'ground'); S.hull -= b.spd * WEATHER.hitHurt; }
    b.grounded = true;
    // 뱃머리가 물가로 향할수록 크게 느려진다. 스치기만 하면 조금만
    const into = Math.max(0, -(Math.cos(b.h) * gx + Math.sin(b.h) * gy));
    b.spd *= Math.exp(-dt * (0.25 + 2.2 * into));
  } else if (d > BOAT.clear + 1.5) b.grounded = false;
  const moved = Math.hypot(nx - b.x, ny - b.y);
  b.x = nx; b.y = ny;
  S.stats.dist += moved;
  if (b.row && sailT < rowT) S.stats.rowDist += moved; else if (b.sailNow > 0.2) S.stats.sailDist += moved;

  // 식량·기력
  const persons = 1 + S.crew.length;
  S.food = Math.max(0, S.food - persons * dt / CAL.day);
  S.owed += S.crew.reduce((a, q) => a + q.wage, 0) * dt / CAL.day;
  if (st.net && b.spd > 1) S.food = Math.min(st.foodCap, S.food + dt / 60);
  if (wx.heat && !st.awning) S.vigor -= WEATHER.heatVigor * dt;
  else if (S.food > 0) S.vigor = Math.min(1, S.vigor + WEATHER.restVigor * dt);
  if (S.food <= 0) S.vigor -= WEATHER.hungerVigor * dt;
  if (wx.heat && st.awning) { S.heatSafe = (S.heatSafe || 0) + dt; if (S.heatSafe >= CAL.day) { S.stats.heatDays++; S.heatSafe = 0; checkAch(S); } }
  S.foodLowWarned = S.food < persons * 0.5 ? (S.foodLowWarned || (emit(S, 'foodLow'), 1)) : 0;

  // 가끔 하는 일: 건지기·발견·안개·표류물
  S.tick = (S.tick || 0) + dt;
  if (S.tick > 0.25) {
    S.tick = 0;
    collectFlot(S); checkFinds(S); revealFog(S);
    if (rnd(S) < 0.12) spawnFlot(S);
    checkAch(S);
  }
  if (S.hull <= 0) { S.hull = 0; disaster(S, 'sink'); } else if (S.vigor <= 0) { S.vigor = 0; disaster(S, 'faint'); }
  return S;
}

// ── 저장 ──
export function serialize(S) { const { events, ...rest } = S; return JSON.stringify(rest); }
export function deserialize(raw) {
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || !o.boat || !o.ship) return null;
    o.events = [];
    return o;
  } catch { return null; }
}
export { REGION_ORDER };
