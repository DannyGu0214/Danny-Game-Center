import { BOAT, POLAR, NO_GO, SAIL_K, NAV, SAIL_LEVELS, CAL, SEASONS, WEATHER, HULLS, MODULES, ROLES, CREW_NAMES, SPECIES, REGIONS, REGION_ORDER, ACHIEVEMENTS, DECOR, CAPTAINS, CREW, HULL_ORDER, HULL_TIERS, ITEMS, TRADE_IDS, WORKSHOP, TRADE, SUPPLY, HERB } from './data.js';
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
    v: 3, seed, t: 0, clock: 0, rng: (seed * 2654435761) >>> 0,
    ph: (seed * 2.399963) % TAU,
    region: 'pond', visited: { pond: 1 }, lastPort: { region: 'pond', id: 'reed' },
    wind: null, weather: { heat: false, drought: false, gustOn: false, gustSoon: false },
    boat: { x: 0, y: 0, h: -PI / 2, spd: 0, turn: 0, rudder: 0, sailLevel: 0, sailNow: 0, lastSail: 2, row: false, rowPhase: 0, stamina: 1, boom: 0.2, luff: false, heel: 0, twa: 0, grounded: false, shoal: false },
    cap: { x: HULLS.raft.helmX, at: 'helm', to: null, then: null },
    route: null, docked: 'reed', disaster: null, events: [],
    res: { wood: 15, cloth: 0, coin: 10 }, hold: {},
    food: HULLS.raft.foodBase, pantry: [{ k: 'bread', n: HULLS.raft.foodBase, exp: SUPPLY.bread.keep }], herb: 0, hull: 1, vigor: 1, relics: {}, letters: {},
    ship: { hull: 'raft', mods: [{ id: 'oar', col: 1, row: 1, rot: 0 }], name: '새벽호', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] },
    crew: [], hiredEver: {}, owed: 0, wageDay: 0,
    flot: {}, fog: {}, found: {}, blueprints: {}, seen: {}, photos: {}, ach: {},
    stats: { rowDist: 0, sailDist: 0, dist: 0, tacks: 0, gusts: 0, gustHurt: 0, heatDays: 0, rescues: 0 },
    ended: false, rev: 0,
  };
  S.best = JSON.parse(JSON.stringify(S.ship));
  S.wind = windAt(S);
  placeAtPort(S, 'reed');
  return S;
}
const W = (S) => worldOf(S.region);
// 이 판의 발견지. 1등급 맵은 자리가 고정이고, 2등급 이상은 처음 들어갈 때 시드로 정해 저장한다
export function findsOf(S, region = S.region) {
  const w = worldOf(region);
  if (REGIONS[region].grade < 2) return w.finds;
  if (!S.findPos) S.findPos = {};
  if (!S.findPos[region]) S.findPos[region] = w.randomFinds(() => rnd(S));
  return S.findPos[region];
}
const rnd = (S) => { S.rng = (S.rng + 0x6D2B79F5) >>> 0; let t = S.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// 선장 특성이 계기 값에 들어간다. 항해술은 돛·노 모두 10% 빠르다
export function stats(S) {
  const st = SH.statsOf(S.ship, holdUsed(S), S.food);
  // 선원의 항해술도 속도에 더해진다(유머 감각·주량은 효과가 없는 개성)
  const crewK = S.crew.reduce((a, c) => a + ((c.skill ?? CREW.baseStat) / CREW.baseStat - 1) * CREW.speedPerSkill, 0);
  st.speedK = (st.hull.speed || 1) * (hasTrait(S, 'sailor') ? 1.1 : 1) * (1 + crewK);
  st.maxSpeed *= st.speedK; st.rowSpeed *= st.speedK;
  return st;
}
export const hasTrait = (S, id) => !!S.captain && S.captain.id === id;
// 선장 고르기. 이름은 비우면 첫 추천 이름이 붙는다
export function setCaptain(S, id, name) {
  const C = CAPTAINS[id];
  if (!C) return false;
  const clean = String(name ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 10);
  S.captain = { id, name: clean || C.names[0] };
  return true;
}
// 기능공은 모듈 값이 재료마다 1 줄어든다
export function moduleCost(S, id) {
  const cost = { ...MODULES[id].cost };
  if (hasTrait(S, 'crafter')) for (const k of Object.keys(cost)) cost[k] = Math.max(0, cost[k] - 1);
  return cost;
}
// 화물칸 부피: 금화는 자리를 차지하지 않아요
export const holdUsed = (S) => Object.entries(S.hold).reduce((a, [k, v]) => a + v * (ITEMS[k]?.vol ?? 1), 0);
const add = (o, k, n) => { o[k] = (o[k] || 0) + n; };
// 짐 옮기기: 화물칸 → 항구 창고
function unload(S) { const got = {}; for (const [k, v] of Object.entries(S.hold)) { if (!v) continue; add(S.res, k, v); got[k] = v; } S.hold = {}; return got; }
export const isTrade = (k) => ITEMS[k]?.kind === 'trade';
export const isUnlocked = (S, id) => { const M = MODULES[id], n = M.need; return !M.future && !M.upOnly && (!n.region || S.visited[n.region]) && (!n.blueprint || S.blueprints[n.blueprint]) && (!n.grade || HULLS[S.ship.hull].grade >= n.grade); };
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
  if (where === 'mast' && st.mast) { const x = st.mastX - 0.55; return st.hull.winch ? (x + st.hull.helmX) / 2 : x; } // 윈치가 있으면 반만 걷는다
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

// 입항: 항구 근처면 바로, 아니면 항로로 간다
export function nearPort(S, r = NAV.dock + 8) { return W(S).ports.find((p) => Math.hypot(p.x - S.boat.x, p.y - S.boat.y) < r) || null; }
export function nearGate(S, r = NAV.dock + 8) { return W(S).gates.find((g) => Math.hypot(g.x - S.boat.x, g.y - S.boat.y) < r) || null; }
export function dock(S, portId) {
  placeAtPort(S, portId);
  const got = unload(S);
  S.boat.sailLevel = 0; S.boat.row = false;
  S.vigor = 1; S.boat.stamina = 1;
  S.cap.to = null; S.cap.then = null; S.cap.at = 'helm'; S.cap.x = HULLS[S.ship.hull].helmX;
  payWages(S);
  // 굶는 사람은 돌려보내지 않는다: 코인이 없으면 마을에서 하루치를 나눠 줘요
  const persons = 1 + S.crew.length;
  let gift = 0;
  if (S.food < persons && S.res.coin < persons * FOOD_PRICE) { gift = persons - S.food; stock(S, 'bread', gift); }
  // 금화도 잡목도 없어 못 고치는 배는 항구 사람들이 절반까지 대충 때워 준다(침몰 → 구조 → 침몰 악순환 방지)
  const patched = patchIfBroke(S);
  checkAch(S);
  emit(S, 'docked', { got, port: portId, gift, patched });
  return got;
}
function patchIfBroke(S) {
  if (S.hull < 0.5 && S.res.coin < repairCost(S) && (S.res.wood || 0) < repairWoodCost(S)) { S.hull = 0.5; return true; }
  return false;
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
  if (!st.canMove) blockers.push('노 자리나 돛대가 있어야 움직이지!');
  if (st.overload) blockers.push('너무 무거워! 짐이나 모듈을 덜어 내!');
  if (S.crew.length < 0) blockers.push('');
  const persons = 1 + S.crew.length;
  if (S.food < persons * days) warns.push(`식량이 ${Math.floor(S.food / persons)}일치뿐이야!`);
  const bread = pantryOf(S).bread;
  if (bread && bread.n >= 1 && bread.left != null && bread.left <= 1) warns.push(`빵 ${Math.round(bread.n)}개가 ${bread.left <= 0 ? '오늘' : '내일'} 상한다!`);
  if (S.hull < 0.5) warns.push('선체가 많이 상했어!');
  if (st.load > 0.9) warns.push('짐이 많아서 느려 터졌어');
  const fc = forecast(S);
  if (fc.some((d) => d.gust !== null) && st.sailArea) warns.push('예보에 돌풍이 있다!');
  if (REGIONS[S.region].heat && fc.some((d) => d.heat) && !st.awning) warns.push('무더위 예보: 그늘막이 없잖아!');
  if (S.region === 'river' && fc.some((d) => d.drought) && st.draft > 0.75) warns.push('가뭄 예보: 배가 깊어서 여울에 걸린다!');
  return { ok: !blockers.length, blockers, warns };
}

// ── 항구에서 할 일 ──
const canPay = (S, cost) => Object.entries(cost).every(([k, v]) => (S.res[k] || 0) >= v);
const pay = (S, cost, sign = 1) => { for (const [k, v] of Object.entries(cost)) S.res[k] = (S.res[k] || 0) - v * sign; };
// ── 식량 창고: 무엇을 얼마나, 언제 상하는지(batch). S.food는 그 합이에요 ──
const today = (S) => Math.floor(S.clock / CAL.day);
// 다른 곳에서 S.food만 바꿨으면(구조·옛 저장·점검) 맞춰 준다: 모자라면 안 상하는 건어로, 넘치면 빨리 상할 것부터 덜어 낸다
function syncPantry(S) {
  if (!S.pantry) S.pantry = [];
  let sum = S.pantry.reduce((a, q) => a + q.n, 0);
  if (sum < S.food - 1e-6) { stock(S, 'dfish', S.food - sum, true); sum = S.food; }
  S.pantry.sort((p, q) => (p.exp ?? 1e9) - (q.exp ?? 1e9));
  while (sum > S.food + 1e-6 && S.pantry.length) { const q = S.pantry[0], d = Math.min(q.n, sum - S.food); q.n -= d; sum -= d; if (q.n <= 1e-6) S.pantry.shift(); }
}
function stock(S, k, n, raw = false) {
  if (n <= 0) return;
  const keep = SUPPLY[k].keep, exp = keep ? today(S) + keep : null;
  const same = S.pantry.find((q) => q.k === k && q.exp === exp);
  if (same) same.n += n; else S.pantry.push({ k, n, exp });
  S.pantry.sort((p, q) => (p.exp ?? 1e9) - (q.exp ?? 1e9));
  if (!raw) S.food += n;
}
// 먹기: 빨리 상할 것부터
function eat(S, n) {
  syncPantry(S);
  S.food = Math.max(0, S.food - n);
  while (n > 1e-9 && S.pantry.length) { const q = S.pantry[0], d = Math.min(q.n, n); q.n -= d; n -= d; if (q.n <= 1e-6) S.pantry.shift(); }
}
// 날이 바뀌면 상한 것을 버린다
function spoil(S) {
  syncPantry(S);
  const d = today(S), gone = {};
  S.pantry = S.pantry.filter((q) => { if (q.exp == null || q.exp > d) return true; gone[q.k] = (gone[q.k] || 0) + q.n; S.food = Math.max(0, S.food - q.n); return false; });
  if (Object.keys(gone).length) emit(S, 'spoiled', { gone });
}
// 창고 보기: 종류별 양과 가장 빨리 상하는 날(며칠 남았나)
export function pantryOf(S) {
  syncPantry(S);
  const out = {}, d = today(S);
  for (const q of S.pantry) { const o = out[q.k] ||= { n: 0, left: null }; o.n += q.n; if (q.exp != null) o.left = o.left == null ? q.exp - d : Math.min(o.left, q.exp - d); }
  return out;
}
export const FOOD_PRICE = SUPPLY.bread.price;
export function buyFood(S, n = 1, k = 'bread') {
  const P = SUPPLY[k]?.price;
  if (!P) return false;
  const st = stats(S), room = Math.max(0, st.foodCap - S.food), q = Math.min(n, Math.floor(room + 1e-9), Math.floor(S.res.coin / P));
  if (!S.docked || q <= 0) return false;
  syncPantry(S); stock(S, k, q); S.res.coin -= q * P;
  return q;
}
export function buyHerb(S, n = 1) {
  const q = Math.min(n, HERB.cap - (S.herb || 0), Math.floor(S.res.coin / HERB.price));
  if (!S.docked || q <= 0) return false;
  S.herb = (S.herb || 0) + q; S.res.coin -= q * HERB.price;
  return q;
}
// ── 팔기 ──
// 재료는 정한 값, 교역품은 그 공간이 찾는 품목이면 1.5배. 같은 공간의 기항지는 값이 같아요
export const SELL_RATE = Object.fromEntries(Object.entries(ITEMS).filter(([, I]) => I.kind === 'mat').map(([k, I]) => [k, I.sell]));
export const wanted = (S, k) => (REGIONS[S.region].demand || []).includes(k);
export function priceOf(S, k) {
  const I = ITEMS[k];
  if (!I) return 0;
  if (I.kind === 'trade') return Math.round(I.price * (wanted(S, k) ? TRADE.demandK : 1));
  return I.sell || 0;
}
export function sell(S, k, n) {
  const rate = priceOf(S, k);
  if (!S.docked || !rate) return 0;
  n = Math.min(n, S.res[k] || 0);
  if (rate < 1) n -= n % Math.round(1 / rate); // 잡목은 2개에 1닢이라 짝수로
  if (n <= 0) return 0;
  // 거래술 +10%는 끝수를 모아 두었다 1코인이 되면 준다(적게 팔아도 손해가 없게)
  S.sellCarry = (S.sellCarry || 0) + n * rate * (hasTrait(S, 'trader') ? 1.1 : 1);
  const coin = Math.floor(S.sellCarry + 1e-9);
  S.sellCarry -= coin;
  S.res[k] -= n; S.res.coin += coin;
  if (isTrade(k)) S.stats.traded = (S.stats.traded || 0) + coin;
  return coin;
}
// ── 공방: 같은 계열 낮은 등급 3개 + 금화 → 높은 등급 1개. 기본 재료는 금화로도 사요(막힘 방지) ──
export function craft(S, from, times = 1) {
  const to = WORKSHOP.pairs[from];
  if (!S.docked || !to) return 0;
  const n = Math.min(times, Math.floor((S.res[from] || 0) / WORKSHOP.ratio), Math.floor(S.res.coin / WORKSHOP.fee));
  if (n <= 0) return 0;
  S.res[from] -= n * WORKSHOP.ratio; S.res.coin -= n * WORKSHOP.fee; add(S.res, to, n);
  return n;
}
export function buyMat(S, k, n = 1) {
  const P = ITEMS[k]?.buy;
  if (!S.docked || !P) return 0;
  const q = Math.min(n, Math.floor(S.res.coin / P));
  if (q <= 0) return 0;
  S.res.coin -= q * P; add(S.res, k, q);
  return q;
}
export const repairCost = (S) => Math.ceil((1 - S.hull) * HULLS[S.ship.hull].hp); // 잃은 내구도 1에 금화 한 닢
export function repair(S) {
  const c = repairCost(S);
  if (!S.docked || c <= 0 || S.res.coin < c) return false;
  S.res.coin -= c; S.hull = 1;
  return true;
}
// 금화가 없어도 잡목으로 손수 고친다(교착 방지). 잃은 내구도 1에 잡목 1개
export const repairWoodCost = (S) => repairCost(S);
export function repairWithWood(S) {
  const c = repairWoodCost(S);
  if (!S.docked || c <= 0 || (S.res.wood || 0) < c) return false;
  S.res.wood -= c; S.hull = 1;
  return true;
}
export function waitDay(S) {
  if (!S.docked) return false;
  S.clock += CAL.day - (S.clock % CAL.day);
  S.owed += S.crew.reduce((a, c) => a + c.wage, 0);
  payWages(S);
  return true;
}
// 금화 세는 말: 한 닢, 두 닢 … 열 닢, 그 위는 숫자로
export const coinCount = (n) => { const w = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'][n]; return w ? `${w} 닢` : `${n}닢`; };
// 주량이 아주 센 선원은 보수를 럼주 값으로 달라고 한다(내는 금화는 같다)
export const wantsRum = (c) => (c.drink ?? CREW.baseStat) >= CREW.rumDrink;
// 기준값의 ±25% 안에서 고른다
const vary = (S, base) => Math.max(1, Math.round(base * (1 - CREW.spread + rnd(S) * 2 * CREW.spread)));
function makeCandidate(S, taken) {
  const open = Object.entries(ROLES).filter(([, r]) => REGIONS[r.region].order <= REGIONS[S.region].order);
  const fresh = open.filter(([id]) => !hasRole(S, id)), roles = fresh.length ? fresh : open; // 아직 없는 역할부터 온다
  const [role, R] = roles[Math.floor(rnd(S) * roles.length)];
  const gender = rnd(S) < 0.5 ? '남' : '여', pool = CREW_NAMES[gender].filter((n) => !taken.has(n));
  const list = pool.length ? pool : CREW_NAMES[gender], name = list[Math.floor(rnd(S) * list.length)];
  taken.add(name);
  S.crewSeq = (S.crewSeq || 0) + 1;
  return { id: S.crewSeq, role, name, gender, skill: vary(S, CREW.baseStat), hireCost: vary(S, R.hire), humor: vary(S, CREW.baseStat), drink: vary(S, CREW.baseStat), wage: R.wage };
}
// 지금 항구의 선원 후보(1~3명). 날이 지나거나 다 뽑으면 새로 온다
export function candidatesAt(S) {
  if (!S.docked) return [];
  if (!S.cands) S.cands = {};
  const day = clock(S).day, cur = S.cands[S.docked];
  if (cur && cur.list.length && day - cur.day < CREW.refreshDays) return cur.list;
  const n = CREW.minCands + Math.floor(rnd(S) * (CREW.maxCands - CREW.minCands + 1)), taken = new Set(S.crew.map((c) => c.name)), list = [];
  for (let i = 0; i < n; i++) list.push(makeCandidate(S, taken));
  S.cands[S.docked] = { day, list };
  return list;
}
export function hire(S, id) {
  const st = stats(S), list = candidatesAt(S), c = list.find((q) => q.id === id);
  if (!S.docked || !c) return { ok: false, why: '그런 녀석은 이 항구에 없어, 선장!' };
  if (!st.hull.crew) return { ok: false, why: `${st.hull.name}엔 선원 태울 자리가 없다고!` };
  if (S.crew.length >= st.crewCap) return { ok: false, why: '재울 데가 없잖아! 해먹부터 달아, 선장!' };
  if (hasRole(S, c.role)) return { ok: false, why: `${ROLES[c.role].name}은(는) 이미 있다고!` };
  if (S.res.coin < c.hireCost) return { ok: false, why: '금화가 모자라, 선장! 주머니가 가볍다고!' };
  S.res.coin -= c.hireCost;
  S.crew.push(c);
  S.cands[S.docked].list = list.filter((q) => q !== c);
  S.hiredEver[c.role] = 1;
  checkAch(S);
  return { ok: true, name: c.name };
}
export function dismiss(S, id) { S.crew = S.crew.filter((c) => (c.id ?? c.role) !== id); }

export function placeModule(S, id, col, row, rot = 0) {
  if (!S.docked) return { ok: false, why: '배는 항구에 대고 고치는 거야, 친구!' };
  const M = MODULES[id], cost = moduleCost(S, id);
  if (!isUnlocked(S, id)) return { ok: false, why: '아직 손댈 수 없는 물건이야!' };
  if ((id === 'hammock' || id === 'cabin') && !HULLS[S.ship.hull].crew) return { ok: false, why: `${HULLS[S.ship.hull].name}엔 선원 태울 자리가 없다고!` };
  if (M.sail && HULLS[S.ship.hull].grade < 2) return { ok: false, why: `${HULLS[S.ship.hull].name}엔 돛대를 못 세운다고! 나룻배부터야!` };
  if (!canPay(S, cost)) return { ok: false, why: '재료가 모자라! 더 건져 오라고!' };
  const m = { id, col, row, rot };
  if (!SH.canPlace(S.ship, m)) return { ok: false, why: M.sail && S.ship.mods.some((o) => MODULES[o.id].sail) ? '돛대는 하나면 족해, 선장!' : '거긴 안 들어간다고!' };
  pay(S, cost);
  S.ship.mods.push(m); S.rev++; noteBest(S);
  return { ok: true };
}
// 모듈 올리기(Mk): 같은 칸에서 재료만 내면 다음 Mk가 돼요. 슬루프부터
export function upgradeStatus(S, m) {
  const to = m && MODULES[m.id].up, U = to && MODULES[to];
  if (!U) return null;
  const okGrade = !U.need.grade || HULLS[S.ship.hull].grade >= U.need.grade, cost = moduleCost(S, to);
  return { to, U, cost, okGrade, ok: !!S.docked && okGrade && canPay(S, cost) };
}
export function upgradeModule(S, col, row) {
  const m = SH.moduleAt(S.ship, col, row), u = upgradeStatus(S, m);
  if (!u) return { ok: false, why: '더 올릴 수 없는 물건이야!' };
  if (!S.docked) return { ok: false, why: '배는 항구에 대고 고치는 거야, 친구!' };
  if (!u.okGrade) return { ok: false, why: `${u.U.name}은(는) 더 큰 배부터야!` };
  if (!canPay(S, u.cost)) return { ok: false, why: '재료가 모자라! 더 건져 오라고!' };
  pay(S, u.cost); m.id = u.to; S.rev++; noteBest(S);
  return { ok: true };
}
export function removeModule(S, col, row) {
  if (!S.docked) return false;
  const m = SH.moduleAt(S.ship, col, row);
  if (!m) return false;
  refundHalf(S, m);
  S.ship.mods = S.ship.mods.filter((o) => o !== m); S.rev++; noteBest(S);
  return true;
}
// ── 조선소 ──
// 올린 모듈(Mk2)은 처음 모듈 값과 올린 값을 합쳐 절반을 돌려줘요
const paidFor = (S, id) => { const base = Object.keys(MODULES).find((b) => MODULES[b].up === id); const c = { ...moduleCost(S, id) }; if (base) for (const [k, v] of Object.entries(paidFor(S, base))) c[k] = (c[k] || 0) + v; return c; };
function refundHalf(S, m) { for (const [k, v] of Object.entries(paidFor(S, m.id))) add(S.res, k, Math.ceil(v / 2)); }
// 타이틀에 보여 줄 가장 높은 배. 구조로 모듈을 잃어도 그대로 두고, 직접 고칠 때만 새로 적어 둔다
function noteBest(S) {
  if (!S.best || HULL_ORDER.indexOf(S.ship.hull) >= HULL_ORDER.indexOf(S.best.hull)) S.best = JSON.parse(JSON.stringify(S.ship));
}
// 지금 배에서 지을 수 있는 칸: 같은 배의 다음 별, 다음 등급의 ★1
export function buildSteps(S) {
  const C = HULLS[S.ship.hull], out = [];
  if (C.star < 3) out.push(HULLS[`${C.kind}${C.star + 1}`]);
  const up = Object.values(HULLS).find((H) => H.grade === C.grade + 1 && H.star === 1);
  if (up) out.push(up);
  return out;
}
const yardName = (n) => (n >= 3 ? '강' : n === 2 ? '큰 호수' : '호수');
// 짓기 조건 목록. 뗏목은 별 없이 나룻배로 넘어가고(서두르게 하려고), 2등급부터는 ★2까지 키워야 다음 등급이다
export function buildStatus(S, id) {
  const H = HULLS[id], C = HULLS[S.ship.hull], list = [];
  const legal = buildSteps(S).includes(H);
  if (H.kind !== C.kind && C.grade >= 2) list.push({ text: `${C.name} ★2까지 키우기`, ok: C.star >= 2 });
  list.push({ text: `${yardName(H.yard)} 항구${H.yard < 3 ? ' 이상' : ''}에서 짓기`, ok: REGIONS[S.region].yard >= H.yard });
  if (H.blueprint) list.push({ text: `${H.name} 설계도(강에서 찾아)`, ok: !!S.blueprints[H.blueprint] });
  const short = !canPay(S, H.price);
  return { legal, list, ok: legal && !short && list.every((q) => q.ok), short };
}
export function buildHull(S, id) {
  const H = HULLS[id], C = HULLS[S.ship.hull];
  if (!S.docked) return { ok: false, why: '배는 항구에서 짓는 거야!' };
  const st = buildStatus(S, id);
  if (!st.legal) return { ok: false, why: H.grade <= C.grade ? '지금 배가 더 크잖아, 친구!' : '한 번에 한 칸씩 올라가는 거야, 친구!' };
  const miss = st.list.find((q) => !q.ok);
  if (miss) return { ok: false, why: `아직 안 돼! ${miss.text}` };
  if (st.short) return { ok: false, why: '재료가 모자라! 더 건져 오라고!' };
  pay(S, H.price);
  if (H.kind === C.kind) {
    // 별 올리기: 선원과 모듈이 그대로 간다. 새 윤곽에 안 맞는 모듈만 값 절반으로 돌려받는다
    const kept = { hull: id, mods: [] };
    for (const m of S.ship.mods) {
      const moved = { ...m, row: m.row + (H.rowOff || 0) };
      if (SH.canPlace(kept, moved)) kept.mods.push(moved); else refundHalf(S, m);
    }
    S.ship.hull = id; S.ship.mods = kept.mods;
  } else {
    for (const m of S.ship.mods) refundHalf(S, m);
    S.ship.hull = id; S.ship.mods = [];
    // 노 자리 하나는 달아 준다(움직일 수 있게)
    const free = SH.validCells(id).find(([c, r]) => r >= Math.floor(H.rows / 2) && c === Math.floor(H.cols / 2)) || SH.validCells(id)[0];
    S.ship.mods.push({ id: 'oar', col: free[0], row: free[1], rot: 0 });
    S.food = Math.min(S.food, SH.statsOf(S.ship, 0, 0).foodCap); syncPantry(S);
    S.crew = [];
  }
  S.hull = 1; S.cap.x = H.helmX; S.rev++;
  noteBest(S);
  checkAch(S);
  emit(S, 'built', { id });
  return { ok: true };
}
export function setPaint(S, key, i) { S.ship.paint[key] = i; S.stats.painted = 1; S.rev++; noteBest(S); checkAch(S); }
export function setName(S, name) { S.ship.name = String(name).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 12) || S.ship.name; S.stats.painted = 1; noteBest(S); checkAch(S); }
export function toggleDecor(S, id) {
  if (!DECOR[id] || !decorOpen(S, id)) return false;
  S.ship.decor = S.ship.decor.includes(id) ? S.ship.decor.filter((d) => d !== id) : [...S.ship.decor, id];
  S.rev++; noteBest(S);
  return true;
}
export const decorOpen = (S, id) => ACHIEVEMENTS.some((a) => a.decor === id && S.ach[a.id]);

// 수문: 조건을 보여 주고 넘어간다
export function gateStatus(S, gate) {
  const r = gate.req, list = [];
  if (r.grade) list.push({ text: `${r.grade}등급(${HULL_TIERS[r.grade - 1].name}) 이상`, ok: HULLS[S.ship.hull].grade >= r.grade });
  return { list, ok: list.every((x) => x.ok) };
}
export function passGate(S, gate) {
  if (!gateStatus(S, gate).ok) return false;
  if (!gate.to) { S.ended = true; S.ach.riverEnd || giveAch(S, 'riverEnd'); emit(S, 'ended'); return true; }
  const from = S.region, first = !S.visited[gate.to];
  // 화물은 그대로 싣고 넘어간다. 도착 항구에 들르면 창고로 옮겨요
  S.region = gate.to; S.visited[gate.to] = 1;
  findsOf(S, gate.to);
  placeAtPort(S, gate.entry);
  S.docked = gate.entry;
  S.cap.x = HULLS[S.ship.hull].helmX; S.cap.at = 'helm'; S.cap.to = null;
  const got = unload(S);
  emit(S, 'region', { from, to: gate.to, got, first });
  checkAch(S);
  return true;
}

// ── 기록 ──
// 동물은 관찰 대상이라 탭하면 기록만 된다. 보상은 도감 달성(도전과제)으로 받는다
export function recordSpecies(S, id) {
  if (!SPECIES[id] || S.seen[id]) return false;
  if (SPECIES[id].kind === 'land' && !stats(S).telescope) return false; // 뭍짐승은 망원경으로 봐요
  S.seen[id] = 1;
  emit(S, 'species', { id });
  checkAch(S);
  return true;
}
function giveAch(S, id) {
  const a = ACHIEVEMENTS.find((q) => q.id === id);
  if (!a || S.ach[id]) return;
  S.ach[id] = 1; S.res.coin += a.coin || 0;
  emit(S, 'ach', { id });
}
const worldDone = (S, region) => worldOf(region).def.finds.every((f) => S.found[f.id]);
// 다음 배의 재료가 모이면 한 번 알려 준다(창고 + 화물칸). 2등급부터는 ★2가 먼저다
export function nextHull(S) {
  const C = HULLS[S.ship.hull];
  if (C.grade >= 2 && C.star < 2) return HULLS[`${C.kind}2`];
  return Object.values(HULLS).find((H) => H.grade === C.grade + 1 && H.star === 1) || null;
}
export function canAffordHull(S, H) {
  if (!H) return false;
  const st = buildStatus(S, H.id);
  return st.legal && st.list.every((q) => q.ok) && Object.entries(H.price).every(([k, v]) => (S.res[k] || 0) + (S.hold[k] || 0) >= v);
}
export function checkAch(S) {
  const next = nextHull(S);
  if (next && S.buildHint !== next.id && canAffordHull(S, next)) { S.buildHint = next.id; emit(S, 'canBuild', { id: next.id }); }
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
  c('sloop', HULLS[S.ship.hull].grade >= 3);
  c('lakeAll', worldDone(S, 'lake'));
  const nSeen = Object.keys(S.seen).length;
  c('species5', nSeen >= 5);
  c('species10', nSeen >= 10);
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
    // 아주 드물게 병 속 편지: 아직 못 찾은 발견지 하나를 해도에 알려 줘요
    if (rnd(S) < 0.025 && findsOf(S).some((f) => !S.found[f.id] && !S.letters?.[f.id])) { list.push({ x, y, k: 'bottle', n: 1, ph: rnd(S) * TAU }); return; }
    const total = def.table.reduce((a, e) => a + e[1], 0); let r = rnd(S) * total, pick = def.table[0];
    for (const e of def.table) { if (r < e[1]) { pick = e; break; } r -= e[1]; }
    list.push({ x, y, k: pick[0], n: pick[2] + Math.floor(rnd(S) * (pick[3] - pick[2] + 1)), ph: rnd(S) * TAU });
    return;
  }
}
function collectFlot(S) {
  const st = stats(S), b = S.boat, list = flotsamOf(S), R = 6 + (hasRole(S, 'lookout') ? 6 : 0);
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    if (Math.hypot(f.x - b.x, f.y - b.y) > R) continue;
    if (f.k === 'bottle') { list.splice(i, 1); readLetter(S, f); continue; }
    const room = st.holdCap - holdUsed(S);
    if (room <= 0) { if (!S.holdFullWarned) { S.holdFullWarned = 1; emit(S, 'holdFull'); } return; }
    // 반짝이는 곳: 무엇이 나올지는 건질 때까지 몰라요(수역 교역품 표)
    const k = f.k === 'shiny' ? rollTrade(S) : f.k, n = Math.min(room, f.n);
    add(S.hold, k, n);
    emit(S, 'pick', { k, n, x: f.x, y: f.y, shiny: f.k === 'shiny' });
    list.splice(i, 1);
  }
  S.holdFullWarned = 0;
}

function rollTrade(S) {
  const t = REGIONS[S.region].trade || [['coffee', 1]], total = t.reduce((a, e) => a + e[1], 0);
  let r = rnd(S) * total;
  for (const [k, w] of t) { if (r < w) return k; r -= w; }
  return t[0][0];
}
function readLetter(S, f) {
  const left = findsOf(S).filter((q) => !S.found[q.id] && !S.letters[q.id]);
  if (!left.length) return;
  const q = left[Math.floor(rnd(S) * left.length)];
  S.letters[q.id] = 1; S.stats.letters = (S.stats.letters || 0) + 1;
  emit(S, 'letter', { id: q.id, name: q.name, x: f.x, y: f.y });
}
// ── 발견 ──
// 망원경: 볼 수 있는 거리가 26m에서 70m로 늘고, 내륙 발견지와 뭍짐승을 찾을 수 있다
export const sightRange = (S) => ((stats(S).telescope ? 70 : 26) + (hasRole(S, 'lookout') ? 14 : 0)) * (hasTrait(S, 'lucky') ? 1.1 : 1);
// 내륙 발견지는 찾기 전까지 그림도 보이지 않는다(끌어서 둘러봐도 미리 알 수 없게)
export function canSeeFind(S, f) {
  if (S.found[f.id] || !f.inland) return true;
  return stats(S).telescope && Math.hypot(f.x - S.boat.x, f.y - S.boat.y) <= sightRange(S);
}
function checkFinds(S) {
  const st = stats(S), b = S.boat, R = sightRange(S);
  for (const f of findsOf(S)) {
    if (S.found[f.id]) continue;
    const d = Math.hypot(f.x - b.x, f.y - b.y);
    if (f.inland && !st.telescope) {
      if (d < 70 && !S.stats.inlandHint) { S.stats.inlandHint = 1; emit(S, 'inlandHint'); }
      continue;
    }
    if (d > R) continue;
    S.found[f.id] = 1;
    const give = {};
    for (const k of Object.keys(ITEMS)) if (typeof f[k] === 'number' && f[k] > 0) { add(S.res, k, f[k]); give[k] = f[k]; }
    if (f.blueprint) S.blueprints[f.blueprint] = 1;
    if (f.relic) S.relics[f.id] = 1;
    emit(S, 'found', { id: f.id, name: f.name, give, coin: f.coin, wood: f.wood, cloth: f.cloth, blueprint: f.blueprint, relic: f.relic });
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
  S.hold = {};
  // 돛대·노는 남기고 모듈 하나가 부서진다
  const opts = S.ship.mods.filter((m) => !MODULES[m.id].sail && m.id !== 'oar');
  if (opts.length) { const m = opts[Math.floor(rnd(S) * opts.length)]; S.ship.mods = S.ship.mods.filter((o) => o !== m); broke.push(m.id); S.rev++; }
  const left = S.crew.length ? S.crew.pop() : null;
  const fee = Math.min(S.res.coin, 10 * HULLS[S.ship.hull].grade);
  S.res.coin -= fee;
  S.hull = 0.35; S.vigor = 0.8; if (S.food < 1) { syncPantry(S); stock(S, 'bread', 1 - S.food); }
  S.region = port.region;
  placeAtPort(S, port.id);
  S.boat.sailLevel = 0; S.boat.sailNow = 0;
  S.cap.x = HULLS[S.ship.hull].helmX; S.cap.at = 'helm'; S.cap.to = null; S.cap.then = null;
  S.stats.rescues++;
  const patched = patchIfBroke(S);
  const out = { lost, broke, left: left && left.name, fee, cause: S.disaster.cause, port: port.id, patched };
  S.disaster = null;
  return out;
}

// ── 자동 조타 ──
function blocked(S, x, y, a, L, clear = 9) {
  const w = W(S), dx = Math.cos(a), dy = Math.sin(a), draft = stats(S).draft, k = S.weather.drought ? WEATHER.droughtDepth : 1, n = Math.ceil(L / 2);
  const shoals = !(S.route && S.route.noShoal);
  // 이미 물가에 붙어 있으면 지금보다 더 가까워지는 쪽만 막힌 것으로 본다(떠나는 길까지 막히면 못 빠져나온다)
  const lim = Math.min(clear, w.dist(x, y) - 0.5);
  for (let i = 1; i <= n; i++) {
    const px = x + dx * i * 2, py = y + dy * i * 2;
    if (w.dist(px, py) < lim) return true;
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
    // 맞바람에 서 있을 때 뱃길을 또 뒤집으면 영영 바람을 못 받는다. 속도가 붙은 뒤에만 뒤집는다
    const ready = r.since > NAV.minTack && ((b.twa > NO_GO && b.spd > 1.2) || r.since > 30);
    if (past && ready) tack(S, r, -r.side);
    want = up + r.side * NAV.tackAngle;
    if (blocked(S, b.x, b.y, want, NAV.look) && ready) { tack(S, r, -r.side); want = up + r.side * NAV.tackAngle; }
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
  const sailRate = dt * 0.7 * (st.hull.winch ? 2 : 1);
  b.sailNow += clamp(wantSail - b.sailNow, -sailRate, sailRate);

  const windSide = angDiff(from, b.h);
  const twa = Math.abs(windSide);
  b.twa = twa;
  b.luff = twa < st.noGo && b.sailNow > 0.03;
  const sailT = Math.min(st.maxSpeed, polar(twa + NO_GO - st.noGo) * wspd * SAIL_K * (0.45 + 0.55 * st.sailArea) * st.speedK) * Math.pow(b.sailNow, 0.7);

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
  if (onShoal) { target = Math.min(target, 0.7); if (!b.shoal) emit(S, 'shoal'); if (b.spd > 0.25) S.hull -= WEATHER.shoalHurt * dt / st.hull.hp; }
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
    const hurt = (Math.abs(b.heel) - WEATHER.heelSafe) * WEATHER.heelHurt * dt / st.hull.hp;
    S.hull -= hurt; S.gustHurt = (S.gustHurt || 0) + hurt;
    if (!S.heelWarnAt || S.t - S.heelWarnAt > 8) { S.heelWarnAt = S.t; emit(S, 'heel'); }
  }

  // 이동: 뱃머리 방향 + 바람에 밀림 + 물살
  const lee = 0.018 * wspd * (0.25 + b.sailNow) * (0.4 + Math.sin(twa)) * st.leeK;
  const [fx, fy] = w.flowAt(b.x, b.y);
  const vx = Math.cos(b.h) * b.spd - Math.cos(from) * lee + fx;
  const vy = Math.sin(b.h) * b.spd - Math.sin(from) * lee + fy;
  let nx = b.x + vx * dt, ny = b.y + vy * dt;
  const d = w.dist(nx, ny);
  if (d < BOAT.clear) {
    const [gx, gy] = w.gradient(nx, ny);
    nx += gx * (BOAT.clear - d); ny += gy * (BOAT.clear - d);
    if (!b.grounded && b.spd > 1) { emit(S, 'ground'); S.hull -= b.spd * (b.row ? 0.5 : 1) * WEATHER.hitHurt / st.hull.hp; } // 노 속도를 2배로 올리면서 부딪힘 피해는 그대로 둔다
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
  // 날이 바뀌면 상한 것부터 버린다
  const dayNow = today(S);
  if (S.foodDay !== dayNow) { if (S.foodDay != null) spoil(S); S.foodDay = dayNow; }
  const fresh = S.pantry?.[0]?.k === 'ffish' && S.food > 0; // 지금 먹는 것이 신선한 물고기면 기력이 빨리 돌아온다
  eat(S, persons * dt / CAL.day);
  S.owed += S.crew.reduce((a, q) => a + q.wage, 0) * dt / CAL.day;
  if (st.net && b.spd > 1 && S.food < st.foodCap) { syncPantry(S); stock(S, 'ffish', Math.min(st.foodCap - S.food, dt / 60)); }
  if (wx.heat && !st.awning) S.vigor -= WEATHER.heatVigor * dt;
  else if (S.food > 0) S.vigor = Math.min(1, S.vigor + WEATHER.restVigor * dt * (fresh ? SUPPLY.ffish.vigor : 1));
  if (S.food <= 0) S.vigor -= WEATHER.hungerVigor * dt;
  // 약초: 기력이 바닥나기 전에 알아서 씹어 먹는다
  if (S.vigor < HERB.at && S.herb > 0) { S.herb--; S.vigor = Math.min(1, S.vigor + HERB.vigor); emit(S, 'herb', { left: S.herb }); }
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
const OLD_WOMEN = ['수빈', '서아', '나래', '보라', '다온', '지안', '하람']; // 이름을 바꾸기 전 저장의 선원
// 이야기 문장의 {N은}·{N이}·{N을}을 이름 받침에 맞춰 채운다
export function storyLine(text, name) {
  const code = name.charCodeAt(name.length - 1) - 0xac00, hangul = code >= 0 && code <= 11171, batchim = hangul && code % 28 !== 0;
  const pair = { 은: ['은', '는'], 이: ['이', '가'], 을: ['을', '를'] };
  return text.replace(/\{N([은이을])\}/g, (_, j) => name + (hangul ? pair[j][batchim ? 0 : 1] : `${pair[j][0]}(${pair[j][1]})`));
}
export function serialize(S) { const { events, ...rest } = S; return JSON.stringify(rest); }
export function deserialize(raw) {
  try {
    const o = JSON.parse(raw);
    if (!o || ![1, 2, 3].includes(o.v) || !o.boat || !o.ship) return null;
    o.events = [];
    // v2 → v3(S2 아이템): 목재·천은 잡목·마포로 이어 받는다. 화물칸의 금화는 창고로, 식량은 빵으로(5일 뒤 상함), 찾은 발견지의 유물을 준다
    if (o.v < 3) {
      o.hold ||= {};
      if (o.hold.coin) { o.res.coin = (o.res.coin || 0) + o.hold.coin; }
      delete o.hold.coin;
      for (const k of Object.keys(o.hold)) if (!o.hold[k]) delete o.hold[k];
      const day = Math.floor((o.clock || 0) / CAL.day);
      o.pantry = o.food > 0 ? [{ k: 'bread', n: o.food, exp: day + SUPPLY.bread.keep }] : [];
      o.herb = 0; o.letters = {}; o.relics = {};
      for (const r of Object.keys(REGIONS)) for (const f of REGIONS[r].finds) if (o.found?.[f.id] && f.relic) o.relics[f.id] = 1;
      // 떠 있던 금화 상자는 반짝이는 곳으로
      for (const list of Object.values(o.flot || {})) for (const f of list) if (f.k === 'coin') { f.k = 'shiny'; f.n = 1; }
    }
    o.relics ||= {}; o.letters ||= {}; o.pantry ||= []; o.herb ||= 0;
    // v1 → v2: 뗏목·나룻배·슬루프는 그대로 ★1이고, 강에서 이미 찾은 물레방아는 슬루프 설계도를 준다
    o.v = 3;
    o.best ??= JSON.parse(JSON.stringify(o.ship));
    if (o.found?.mill2) o.blueprints.sloop = 1;
    // 능력치가 없던 예전 선원은 기준값으로 채운다
    for (const c of o.crew || []) {
      if (c.id == null) { o.crewSeq = (o.crewSeq || 0) + 1; c.id = o.crewSeq; }
      c.gender ??= OLD_WOMEN.includes(c.name) ? '여' : '남';
      c.skill ??= CREW.baseStat; c.humor ??= CREW.baseStat; c.drink ??= CREW.baseStat;
    }
    return o;
  } catch { return null; }
}
export { REGION_ORDER };
