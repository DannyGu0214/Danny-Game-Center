// 본게임 규칙(화면 없음): 날씨, 손님 도착, 자동 제조, 매출, 평판, 장비, 결산.
import * as G from './logic.js';
import { ESPRESSO, DAYS_PER_SEASON, DAY_SEC, OPEN_HOUR, HOURS, WEEK, WEATHER_ODDS, MENUS, COST, COLDBREW_COST, SIDE, ROAST, START_MONEY, RENT_PER_SEASON, FAST_TIP_SEC, TIP, EQUIP, BIZ_REGULARS, SEASON_NAME } from './data.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function rollWeather(season, rand = Math.random) {
  const odds = WEATHER_ODDS[season];
  let r = rand() * Object.values(odds).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(odds)) { r -= v; if (r < 0) return k; }
  return 'sun';
}
export const weekIndex = (day) => (day - 1) % 7; // 1일차는 월요일
export const weekdayOf = (day) => WEEK[weekIndex(day)];
export const isWeekend = (day) => weekIndex(day) >= 5;
export const hourOf = (sec) => OPEN_HOUR + sec / DAY_SEC * HOURS;
export function clockOf(sec) {
  const h = hourOf(Math.min(sec, DAY_SEC)), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
export const seasonLabel = (biz) => SEASON_NAME[biz.season];

// 시간대별 손님 몰림(DESIGN 1절: 오피스는 평일 점심, 주택가는 주말 오전)
function hourWeight(place, weekend, hour) {
  if (place === 'office') {
    if (weekend) return hour >= 11 && hour < 15 ? 1.4 : 0.6;
    if (hour >= 12 && hour < 13.5) return 4.5;
    if (hour >= 8 && hour < 9.5) return 2.2;
    if (hour >= 14 && hour < 17) return 0.8;
    return 0.6;
  }
  if (weekend) return hour >= 9 && hour < 12.5 ? 3 : hour >= 14 && hour < 17 ? 1.2 : 0.7;
  return hour >= 10 && hour < 12 ? 1.5 : hour >= 14 && hour < 17 ? 1.4 : 0.9;
}
// 일반 손님 수: 일주일 평균이 하루 20명쯤 되게 맞췄다
const BASE_COUNT = { office: { week: 22, end: 12 }, home: { week: 16, end: 27 } };
const WEATHER_FACTOR = { sun: 1.06, cloud: 1, rain: 0.86, shower: 0.82, snow: 0.82 };
export function customerCount(place, day, weather, rep) {
  const base = isWeekend(day) ? BASE_COUNT[place].end : BASE_COUNT[place].week;
  return Math.round(base * (WEATHER_FACTOR[weather] ?? 1) * (0.9 + rep * 0.04));
}
export function pickMenu(place, hour, weather, stock, rand = Math.random) {
  const rainy = weather === 'rain' || weather === 'shower' || weather === 'snow';
  const table = place === 'office'
    ? { americano: 40, iced: rainy ? 8 : 20, latte: 26, espresso: 5, coldbrew: stock > 0 ? (rainy ? 6 : 12) : 0, drip: hour >= 14 && hour < 17 ? 8 : 0 }
    : { americano: 30, latte: 34, drip: 12, origin: 6, espresso: 8, iced: rainy ? 2 : 8 };
  let r = rand() * Object.values(table).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(table)) { r -= v; if (r < 0) return k; }
  return 'americano';
}
// 하루 일정: 손님이 언제 오는지 미리 뽑아 둔다
export function planDay(place, day, weather, rep, rand = Math.random) {
  const n = customerCount(place, day, weather, rep), weekend = isWeekend(day), hours = [];
  for (let h = 0; h < HOURS * 2; h++) hours.push(hourWeight(place, weekend, OPEN_HOUR + h / 2));
  const total = hours.reduce((a, b) => a + b, 0), times = [];
  for (let i = 0; i < n; i++) {
    let r = rand() * total, slot = 0;
    for (; slot < hours.length - 1; slot++) { r -= hours[slot]; if (r < 0) break; }
    times.push((slot + rand()) / hours.length * (DAY_SEC - 18) + 2);
  }
  return times.sort((a, b) => a - b);
}
export function regularsOfDay(place, day) {
  // 하루에 단골 평균 2명. 돌아가며 온다. 드립 손님은 오후에 온다
  const ids = Object.keys(BIZ_REGULARS[place]);
  return [ids[(day - 1) % ids.length], ids[day % ids.length]].map((id, i) => {
    const menu = BIZ_REGULARS[place][id].menu;
    const at = menu === 'drip' ? DAY_SEC * 0.58 : DAY_SEC * (i === 0 ? 0.2 : 0.72);
    return { id, at };
  });
}

// 자동 잔: 맛은 아침에 맞춘 칸으로 정해지고, 별은 2개까지다(DESIGN 5.7절)
export function autoCup(menu, grindErr) {
  let t = 0;
  while (t < 100 && G.shotYieldAt(t, grindErr, ESPRESSO.dose) < ESPRESSO.yield) t += 0.1;
  const taste = G.shotTaste({ realT: t, yieldG: ESPRESSO.yield }), band = G.tasteBand(taste);
  const score = clamp(0.72 - Math.abs(taste) * 0.5, 0, 0.72);
  return { menu, taste, band, score, target: 0, stars: band === 'good' ? 2 : G.starsOf(score, band), detail: '자동', auto: true };
}
export const canAuto = (menu, equip) => menu === 'americano' || menu === 'espresso' || menu === 'iced' || (menu === 'latte' && !!equip.pitcher);
export const isInstant = (menu) => menu === 'coldbrew';

export function newBiz(rand = Math.random) {
  const season = 'spring';
  return { season, day: 1, money: START_MONEY, rep: 2.5, equip: {}, friend: {}, visits: {}, stock: { coldbrew: 0, dessert: 0, beans: 0, beansQ: 0.7 }, weather: rollWeather(season, rand), history: [], finished: false };
}
export function newDayStats() { return { served: 0, lost: 0, stars: 0, sales: 0, cost: 0, tips: 0, regulars: 0, dessert: 0, beans: 0, sideSales: 0, prep: 0 }; }
// 내준 잔 하나를 장부에 적는다
export function sellCup(biz, stats, { menu, stars, waited = 99, place }) {
  const price = MENUS[menu].price, cost = COST[menu] ?? 1000;
  let tip = 0;
  if (place === 'office' && waited <= FAST_TIP_SEC && stars >= 2) tip += TIP;
  if (stars >= 3) tip += TIP;
  stats.served += 1; stats.stars += stars; stats.sales += price; stats.cost += cost; stats.tips += tip;
  return { price, tip };
}
// 서브제품이 팔릴 확률: 여러 변수의 곱이다. 평판과 잔 품질이 좋을수록 잘 팔린다(가게를 잘 운영하면 늘어난다)
const STAR_F = [0.3, 0.7, 1, 1.35];
export function sideChance(kind, { place, rep, stars, hour, weekend, weather, friend = 0, quality = 0.7 }) {
  const rainy = weather === 'rain' || weather === 'shower' || weather === 'snow';
  let p = SIDE[kind].base[place] * (0.6 + rep * 0.16) * STAR_F[clamp(stars, 0, 3)] * (1 + Math.min(friend, 10) * 0.03);
  if (kind === 'dessert') {
    p *= hour >= 14 && hour < 17 ? 1.4 : hour < 10 ? 0.7 : 1;
    if (rainy) p *= 1.15;
    if (place === 'home' && weekend) p *= 1.2;
  } else {
    p *= 0.5 + quality * 0.7; // 로스팅을 잘했을수록 잘 팔린다
    if (weekend) p *= 1.25;
  }
  return clamp(p, 0, 0.7);
}
// 커피 한 잔을 판 뒤 함께 팔린 것을 정한다. 재고가 없으면 못 판다. 원가는 들여올 때 이미 냈다
export function sellSide(biz, stats, ctx, rand = Math.random) {
  const sold = [];
  for (const kind of ['dessert', 'beans']) {
    if (biz.stock[kind] <= 0) continue;
    if (rand() < sideChance(kind, { ...ctx, quality: biz.stock.beansQ })) {
      biz.stock[kind] -= 1; stats[kind] += 1; stats.sales += SIDE[kind].price; stats.sideSales += SIDE[kind].price;
      sold.push(kind);
    }
  }
  return sold;
}
// 하루 마감: 돈과 평판을 반영한다. 평판은 별 평균과 놓친 손님으로 움직인다
export function closeDay(biz, stats) {
  const avg = stats.served ? stats.stars / stats.served : 0;
  const repDelta = stats.served ? clamp((avg - 1.5) * 0.16 - stats.lost * 0.025, -0.3, 0.3) : -0.1;
  const net = stats.sales + stats.tips - stats.cost;
  biz.money += net;
  biz.rep = clamp(biz.rep + repDelta, 0, 5);
  const record = { season: biz.season, day: biz.day, weather: biz.weather, ...stats, avg: +avg.toFixed(2), net, rep: +biz.rep.toFixed(2) };
  biz.history.push(record);
  return { ...record, repDelta: +repDelta.toFixed(2) };
}
export const isSeasonEnd = (biz) => biz.day >= DAYS_PER_SEASON;
// 계절이 끝나면 월세를 낸다
export function settleSeason(biz, place) {
  const rent = RENT_PER_SEASON[place], days = biz.history.filter((d) => d.season === biz.season);
  const sum = (k) => days.reduce((a, d) => a + d[k], 0);
  const income = sum('sales') + sum('tips') - sum('cost');
  biz.money -= rent;
  return { rent, days: days.length, income, served: sum('served'), lost: sum('lost'), avgStars: sum('served') ? +(sum('stars') / sum('served')).toFixed(2) : 0, money: biz.money, rep: +biz.rep.toFixed(2) };
}
export function nextDay(biz, rand = Math.random) {
  biz.day += 1;
  biz.weather = rollWeather(biz.season, rand);
}
export function buyEquip(biz, id) {
  const e = EQUIP[id];
  if (!e || biz.equip[id] || biz.money < e.price) return false;
  biz.money -= e.price; biz.equip[id] = true;
  return true;
}
export function prepColdbrew(biz, n) {
  const count = clamp(Math.floor(n), 0, 12), cost = count * COLDBREW_COST;
  if (biz.money < cost) return false;
  biz.money -= cost;
  biz.stock.coldbrew += count;
  return true;
}
export function buyDessert(biz, n) {
  const count = clamp(Math.floor(n), 0, 20), cost = count * SIDE.dessert.unitCost;
  if (biz.money < cost) return false;
  biz.money -= cost; biz.stock.dessert += count;
  return true;
}
// 로스팅 품질: 초록 칸(210~220℃)이면 1, 멀어질수록 떨어진다
export function roastQuality(temp) {
  const d = temp < ROAST.lo ? ROAST.lo - temp : temp > ROAST.hi ? temp - ROAST.hi : 0;
  return clamp(1 - d / 28, 0, 1);
}
export function roastBatch(biz, temp) {
  if (biz.money < ROAST.batchCost) return null;
  const q = roastQuality(temp), before = biz.stock.beans;
  biz.money -= ROAST.batchCost;
  biz.stock.beansQ = (biz.stock.beansQ * before + q * ROAST.bags) / (before + ROAST.bags); // 남은 원두와 섞어 평균
  biz.stock.beans = before + ROAST.bags;
  return q;
}
// 콜드브루와 디저트는 그날 저녁 버린다. 원두는 남겨 둔다
export function endOfDayStock(biz) { const left = { coldbrew: biz.stock.coldbrew, dessert: biz.stock.dessert }; biz.stock.coldbrew = 0; biz.stock.dessert = 0; return left; }
export const friendLevel = (biz, id) => biz.friend[id] || 0;
export function regularDone(biz, id, cup) {
  biz.visits[id] = (biz.visits[id] || 0) + 1;
  if (cup.stars >= 2 && cup.band === 'good') biz.friend[id] = (biz.friend[id] || 0) + 1;
}
export function normalizeBiz(raw) {
  if (!raw || typeof raw !== 'object' || !SEASONS.includes(raw.season)) return null;
  const b = newBiz(() => 0);
  b.season = raw.season;
  b.day = clamp(Number(raw.day) || 1, 1, DAYS_PER_SEASON);
  b.money = Number.isFinite(raw.money) ? raw.money : START_MONEY;
  b.rep = clamp(Number(raw.rep) || 0, 0, 5);
  b.weather = WEATHER_ODDS[raw.season][raw.weather] ? raw.weather : 'sun';
  for (const k of ['equip', 'friend', 'visits']) if (raw[k] && typeof raw[k] === 'object') b[k] = { ...raw[k] };
  if (raw.stock) for (const k of Object.keys(b.stock)) if (Number.isFinite(raw.stock[k])) b.stock[k] = raw.stock[k];
  b.history = Array.isArray(raw.history) ? raw.history.slice(-100) : [];
  b.finished = !!raw.finished;
  return b;
}

// ── 저장 슬롯 ──
// 스토리를 끝내면 주인공·사장님 설정(base)이 남고, 가게는 위치별로 따로 저장한다. 어느 쪽이든 언제든 오갈 수 있다
export const BASE_KEY = 'mlc.base.v1';
export const OLD_BIZ_KEY = 'mlc.biz.v1';
export const slotKey = (place) => `mlc.slot.${place}.v1`;
const cleanNotes = (notes, known) => (Array.isArray(notes) ? notes.filter((n) => known[n]) : []);
export function parseBase(raw, known = {}) {
  if (!raw || !G.validChoices({ ...raw.choices })) return null;
  return { choices: raw.choices, notes: cleanNotes(raw.notes, known), dial: raw.dial };
}
export function parseSlot(raw, place, known = {}) {
  if (!raw || !G.validChoices({ ...raw.choices }) || raw.choices.place !== place || !raw.biz) return null;
  const biz = normalizeBiz(raw.biz);
  return biz ? { choices: raw.choices, notes: cleanNotes(raw.notes, known), dial: raw.dial, biz } : null;
}
// 이전 저장(가게 하나)을 새 구조로 옮긴다
export function migrateOldBiz(raw, known = {}) {
  const base = parseBase(raw, known);
  if (!base) return null;
  return { base, slot: raw.biz ? parseSlot(raw, raw.choices.place, known) : null };
}
// 가게를 새로 열 때의 선택: 스토리의 주인공·사장님을 쓰고, 위치와 이름만 그 가게 것이다
export const slotChoices = (base, place, cafe) => ({ ...base.choices, place, cafe: G.cleanCafeName(cafe ?? base.choices.cafe) });
export const needsNewName = (base, place) => base.choices.place !== place;
