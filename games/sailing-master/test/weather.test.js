// S5 날씨 체계와 영향(2026-11-12)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import * as SH from '../ship.js';
import { worldOf } from '../world.js';
import { moodOf } from '../music.js';
import { HULLS, REGIONS, CAL, SAIL_LEVELS, WX, WX_ORDER, SAILCLOTH, WET, WEATHER } from '../data.js';

const run = (S, sec, each) => { for (let i = 0; i < sec * 30; i++) { G.step(S, G.FIXED_DT); if (each) each(S); } return S; };
const drain = (S) => { const e = S.events.slice(); S.events.length = 0; return e; };
const mate = (role, extra = {}) => ({ id: Math.floor(Math.random() * 1e6), role, name: role, gender: '남', wage: 0, baseWage: 0, lv: 1, xp: 0, fatigue: 0, morale: 0.7, trait: 'diligent', ...extra });
function sloopAt(region = 'lake', seed = 1, extra = []) {
  const S = G.newGame(seed);
  S.region = region; S.visited = { pond: 1, lake: 1, river: 1 }; S.blueprints = { mast_m: 1, telescope: 1, barometer: 1 };
  S.ship = { hull: 'sloop', mods: [{ id: 'mast_m', col: 1, row: 2, rot: 0 }, { id: 'oar', col: 1, row: 4, rot: 0 }, ...extra], name: 'T', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
  S.docked = null; S.food = 50; S.cap.x = HULLS.sloop.helmX; S.cap.at = 'helm';
  const p = worldOf(region).ports[0];
  S.boat.x = p.x; S.boat.y = p.y;
  return S;
}
const dayWith = (seed, pred, from = 1) => { for (let d = from; d < 600; d++) if (pred(G.dayWeather(seed, d))) return d; throw new Error('없음'); };
// 배를 한 자리에 묶어 두고 옆바람을 받게 한다(날씨만 보려고)
const pin = (x, y) => (S) => { S.boat.h = S.wind.from + Math.PI / 2; S.boat.x = x; S.boat.y = y; S.vigor = 1; };
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

test('S5 날씨 표: 돌풍·무더위·가뭄은 S5 전 공식과 같은 날에 오고, 새 날씨도 시드로 정해진다', () => {
  const OLD = [{ gust: 0.45 }, { gust: 0.25, heat: 0.6 }, { gust: 0.55 }, { gust: 0.35 }]; // S5 전 SEASONS 값
  for (const seed of [1, 7]) for (let day = 0; day < 120; day++) {
    const si = Math.floor(day / CAL.seasonDays) % 4, sea = OLD[si], dos = day % CAL.seasonDays;
    const gust = hash(seed + 3.1, day) < sea.gust ? (0.12 + 0.76 * hash(seed + 7.7, day)) * CAL.day : null;
    const w = G.dayWeather(seed, day);
    assert.equal(w.gust, gust, `돌풍 ${seed}/${day}`);
    assert.equal(w.heat, !!sea.heat && hash(seed + 11.3, day) < sea.heat, `무더위 ${day}`);
    assert.equal(w.drought, (si === 1 && dos >= 3) || (si === 2 && dos <= 2), `가뭄 ${day}`);
    assert.deepEqual(G.dayWeather(seed, day), w, '같은 시드면 같은 날씨');
  }
  // 표에 필요한 값이 다 있다
  for (const id of WX_ORDER) { const K = WX[id]; assert.ok(K.name && K.icon && K.sev && K.when && K.fx, id); if (K.when === 'event') assert.ok(K.len > 0 && K.warn > 0, id); }
  // 첫날은 새 날씨가 없다
  for (let seed = 1; seed < 30; seed++) { const w = G.dayWeather(seed, 0); assert.ok(w.storm === null && w.squall === null && !w.fog, `첫날 ${seed}`); }
});

test('S5 계절: 안개는 봄에 잦고, 폭풍은 여름·가을에만, 홍수는 봄 강에서 온다. 수역마다 오는 날씨가 다르다', () => {
  const n = { spring: { fog: 0, storm: 0, squall: 0 }, summer: { fog: 0, storm: 0, squall: 0 }, autumn: { fog: 0, storm: 0, squall: 0 }, winter: { fog: 0, storm: 0, squall: 0 } };
  for (const seed of [1, 2, 3]) for (let d = 1; d < 28 * 6; d++) {
    const w = G.dayWeather(seed, d), sea = ['spring', 'summer', 'autumn', 'winter'][Math.floor(d / 7) % 4];
    if (w.fog) n[sea].fog++; if (w.storm !== null) n[sea].storm++; if (w.squall !== null) n[sea].squall++;
    if (w.flood) assert.equal(sea, 'spring');
  }
  assert.ok(n.spring.fog > n.summer.fog * 4 && n.spring.fog > n.autumn.fog, JSON.stringify(n));
  assert.equal(n.spring.storm + n.winter.storm, 0);
  assert.ok(n.summer.storm > 0 && n.autumn.storm > 0);
  assert.ok(n.summer.squall > n.winter.squall);
  // 작은 호수엔 폭풍·무더위가 없고, 홍수·가뭄은 강에만
  const d = { day: 9, storm: 50, gust: 40, squall: 60, fog: true, heat: true, flood: true, drought: true };
  assert.deepEqual(G.kindsOf('pond', d), ['gust', 'squall', 'fog']);
  assert.deepEqual(G.kindsOf('lake', d), ['storm', 'gust', 'squall', 'fog', 'heat']);
  assert.deepEqual(G.kindsOf('river', d), WX_ORDER);
});

test('S5 예보: 날씨 칸은 심한 것부터, 안개는 내일까지만 보이고 기압계로 폭풍을 더 멀리 본다', () => {
  const S = sloopAt('lake');
  S.ship.mods.push({ id: 'barometer', col: 0, row: 0, rot: 0 });
  const fog = dayWith(1, (w) => w.fog && w.storm === null) - 3, st = dayWith(1, (w) => w.storm !== null, 30) - 3;
  S.clock = Math.max(0, fog) * CAL.day;
  let o = G.outlook(S);
  assert.equal(o.length, 4);
  const at = fog < 0 ? 3 + fog : 3;
  assert.ok(!o[at].ids.includes('fog'), '사흘 뒤 안개는 안 보여요');
  S.clock = (Math.max(0, fog) + at - 1) * CAL.day; o = G.outlook(S);
  assert.ok(o[1].ids.includes('fog'), '내일 안개는 보여요');
  S.clock = st * CAL.day; o = G.outlook(S);
  assert.ok(o[3].ids.includes('storm')); assert.equal(o[3].worst, 'storm'); assert.equal(o[3].sev, 3);
  for (const d of o) assert.deepEqual(d.ids, [...d.ids].sort((a, b) => WX_ORDER.indexOf(a) - WX_ORDER.indexOf(b)));
});

test('S5 지금 날씨: 폭풍엔 바람이 세고 비가 오며, 안개엔 바람이 잦아들고, 홍수엔 물살이 세고 여울이 깊다', () => {
  const d = dayWith(1, (w) => w.storm !== null && w.gust === null), w = G.dayWeather(1, d), t0 = d * CAL.day + w.storm;
  let x = G.weatherAt('lake', 1, t0 - 10);
  assert.ok(x.stormSoon && !x.stormOn && !x.rough);
  x = G.weatherAt('lake', 1, t0 + 5);
  assert.ok(x.stormOn && x.rough && x.rain); assert.equal(x.worst, 'storm');
  assert.equal(x.fx.windUp, REGIONS.lake.stormK); assert.ok(x.fx.strain > WX.gust.fx.strain);
  assert.equal(G.weatherAt('pond', 1, t0 + 5).stormOn, false, '작은 호수엔 폭풍이 없다');
  const f = dayWith(1, (q) => q.fog);
  x = G.weatherAt('lake', 1, f * CAL.day + 20);
  assert.ok(x.fog > 0.9); assert.ok(x.fx.windDown < 0.7);
  assert.equal(G.weatherAt('lake', 1, f * CAL.day + WX.fog.len + 1).fog, 0, '아침이 지나면 걷힌다');
  const fl = dayWith(1, (q) => q.flood, 28);
  x = G.weatherAt('river', 1, fl * CAL.day + 30);
  assert.ok(x.flood); assert.equal(x.fx.flow, 1.6); assert.equal(x.fx.depth, 1.5);
  assert.equal(G.weatherAt('lake', 1, fl * CAL.day + 30).flood, false);
});

test('S5 폭풍: 예고 → 고비 → 줄이면 멀쩡하고, 다 펴고 버티면 돛이 찢어진다(경고가 먼저 온다)', () => {
  const d = dayWith(1, (w) => w.storm !== null && w.gust === null), w = G.dayWeather(1, d);
  const go = (level) => {
    const S = sloopAt('lake'); S.boat.x = -20; S.boat.y = 0; S.boat.sailLevel = level; S.boat.sailNow = SAIL_LEVELS[level];
    S.clock = d * CAL.day + w.storm - WX.storm.warn - 2;
    const ev = [];
    run(S, WX.storm.warn + WX.storm.len + 6, (q) => { pin(-20, 0)(q); ev.push(...drain(q)); });
    return { S, ev: ev.map((e) => e.type) };
  };
  const full = go(2), reef = go(1);
  const i = (a, k) => a.indexOf(k);
  assert.ok(i(full.ev, 'stormSoon') >= 0 && i(full.ev, 'stormSoon') < i(full.ev, 'stormOn'), '예고가 먼저');
  assert.ok(i(full.ev, 'sailStrain') > i(full.ev, 'stormOn') && i(full.ev, 'sailTorn') > i(full.ev, 'sailStrain'), '경고 뒤에 찢어짐');
  assert.ok(full.S.boat.torn); assert.equal(full.S.stats.torn, 1);
  assert.ok(full.S.hull < 0.99, `다 펴면 선체도 상한다 ${full.S.hull}`);
  assert.ok(!reef.S.boat.torn); assert.ok(reef.S.hull > 0.999, `줄이면 멀쩡 ${reef.S.hull}`);
  assert.ok(reef.ev.includes('stormOff')); assert.equal(reef.S.stats.storms, 1);
  assert.ok(reef.S.ach.stormSafe, '피해 없이 넘기면 도전과제');
  assert.ok(!full.S.ach.stormSafe);
  // 찢어진 돛은 반쯤만 펴진다
  run(full.S, 3, pin(-20, 0));
  assert.ok(full.S.boat.sailNow <= SAILCLOTH.tornMax + 1e-9);
});

test('S5 돌풍: 다 펴고 버티면 돌풍에도 찢어지지만, 금방 줄이면 안 찢어진다', () => {
  const d = dayWith(1, (w) => w.gust !== null), w = G.dayWeather(1, d);
  const go = (reefAfter) => {
    const S = sloopAt('lake'); S.boat.x = -20; S.boat.y = 0; S.boat.sailLevel = 2; S.boat.sailNow = 1;
    S.clock = d * CAL.day + w.gust - 1;
    let t = 0;
    run(S, WX.gust.len + 2, (q) => { pin(-20, 0)(q); t += G.FIXED_DT; if (reefAfter && t > reefAfter) q.boat.sailLevel = 1; });
    return S;
  };
  assert.ok(go(0).boat.torn, '40초 내내 다 펴면 찢어진다');
  assert.ok(!go(10).boat.torn, '10초 안에 줄이면 괜찮다');
});

test('S5 돛 꿰매기: 바다에선 화물칸 마포 2장으로 선장이 돛대에서 30초, 갑판원은 알아서 더 빨리. 항구에선 천이나 금화', () => {
  const S = sloopAt('lake'); S.boat.torn = true;
  assert.equal(G.mendSail(S).ok, false, '마포가 없으면 못 꿰맨다');
  S.hold.cloth = 3;
  const r = G.mendSail(S); assert.ok(r.ok); assert.equal(r.by, 'cap');
  run(S, 10); assert.equal(S.cap.at, 'mast'); assert.ok(S.boat.torn, '아직 꿰매는 중');
  run(S, SAILCLOTH.capTime); assert.equal(S.boat.torn, false); assert.equal(S.hold.cloth, 1);
  assert.ok(drain(S).some((e) => e.type === 'sailMended'));
  // 갑판원: 규칙 mend가 켜져 있으면 알아서 시작한다
  const T = sloopAt('lake', 1, [{ id: 'hammock', col: 0, row: 5, rot: 0 }]); T.crew = [mate('deckhand')]; T.boat.torn = true; T.hold.canvas = 1;
  run(T, 1); assert.ok(T.mend && T.mend.by === 'crew');
  run(T, SAILCLOTH.crewTime + 1); assert.equal(T.boat.torn, false); assert.equal(T.hold.canvas, undefined, '마포가 없으면 범포 1장');
  // 항구: 창고 마포 → 없으면 돛장이 금화 → 그것도 없으면 입항할 때 외상으로
  const P = G.newGame(1); P.ship = sloopAt().ship; P.boat.torn = true; P.res.cloth = 2;
  assert.ok(G.mendSail(P).ok); assert.equal(P.res.cloth, undefined); assert.equal(P.boat.torn, false);
  P.boat.torn = true; P.res.coin = 50; const fee = G.sailFee(P);
  assert.equal(fee, 10); assert.equal(G.mendSail(P).fee, fee); assert.equal(P.res.coin, 40);
  P.boat.torn = true; P.res.coin = 0; P.res.canvas = 0;
  assert.equal(G.mendSail(P).ok, false);
  P.docked = null; G.dock(P, 'reed');
  assert.equal(P.boat.torn, false, '돛장이 인심');
});

test('S5 수선용 마포: 돛이 있으면 출항할 때 창고 마포 2장을 화물칸에 싣는다', () => {
  const S = sloopAt('lake'); S.docked = 'pine'; S.res.cloth = 5;
  const r = G.undock(S);
  assert.ok(r.ok); assert.equal(r.spare, SAILCLOTH.spare); assert.equal(S.hold.cloth, 2); assert.equal(S.res.cloth, 3);
  const R = G.newGame(1); R.res.cloth = 5; assert.equal(G.undock(R).spare, 0, '뗏목은 돛이 없다');
});

test('S5 젖은 식량: 그늘막 없이 비를 맞으면 빵은 일찍 상하고 건어도 상하게 되며, 그늘막이 있으면 멀쩡하다', () => {
  const d = dayWith(1, (w) => w.squall !== null && w.storm === null && w.gust === null), w = G.dayWeather(1, d);
  const go = (extra) => {
    const S = sloopAt('lake', 1, extra);
    S.clock = d * CAL.day + w.squall - 2;
    S.food = 0; S.pantry = []; S.foodDay = d;
    S.pantry = [{ k: 'bread', n: 4, exp: d + 5 }, { k: 'dfish', n: 3, exp: null }]; S.food = 7;
    const ev = [];
    run(S, WX.squall.len, (q) => { pin(-20, 0)(q); ev.push(...drain(q)); });
    return { S, ev };
  };
  const bare = go([]), shade = go([{ id: 'awning', col: 0, row: 3, rot: 0 }]);
  const wet = bare.ev.find((e) => e.type === 'foodWet');
  assert.ok(wet && wet.got.bread && wet.got.dfish, '젖었다고 알린다');
  const bread = bare.S.pantry.find((q) => q.k === 'bread'), fish = bare.S.pantry.find((q) => q.k === 'dfish');
  assert.equal(bread.exp, d + 5 - WET.bread); assert.equal(fish.exp, d + WET.dfish); assert.equal(bare.S.stats.wet, 1);
  assert.ok(!shade.ev.some((e) => e.type === 'foodWet')); assert.ok(shade.S.pantry.every((q) => !q.wet));
  // 젖어도 내일 하루는 버틴다(갑자기 굶지 않게)
  const T = sloopAt('lake'); T.clock = 10 * CAL.day; T.pantry = [{ k: 'bread', n: 3, exp: 11 }]; T.food = 3;
  G.soakFood(T); assert.equal(T.pantry[0].exp, 11);
  T.pantry = [{ k: 'bread', n: 3, exp: 13 }]; G.soakFood(T); assert.equal(T.pantry[0].exp, 11);
});

test('S5 폭풍 편성·폭풍 곡: 규칙을 켜면 폭풍 예고 때 폭풍 편성으로 가고 갑판원이 돛을 줄이며, 지나가면 돌아온다', () => {
  const d = dayWith(1, (w) => w.storm !== null && (w.gust === null || Math.abs(w.gust - w.storm) > 200)), w = G.dayWeather(1, d);
  const S = sloopAt('lake', 1, [{ id: 'hammock', col: 0, row: 5, rot: 0 }, { id: 'hammock', col: 2, row: 5, rot: 0 }]);
  S.crew = [mate('deckhand'), mate('rower')];
  const [a] = S.crew, rest = G.seatsOf(S).filter((q) => q.type === 'rest').map((q) => q.key);
  G.workerAt(S, 'sail'); G.savePlan(S, 'sail');
  G.setSeat(S, S.crew[1].id, rest[1]); G.savePlan(S, 'storm'); G.applyPlan(S, 'sail');
  G.setRule(S, 'storm', true);
  S.boat.sailLevel = 2; S.boat.sailNow = 1;
  S.clock = d * CAL.day + w.storm - WX.storm.warn - 2;
  const moods = new Set(), ev = [];
  run(S, 3, (q) => { pin(-20, 0)(q); moods.add(moodOf({ gustOn: q.weather.gustOn, gustSoon: q.weather.gustSoon, storm: q.weather.stormOn || q.weather.stormSoon })); ev.push(...drain(q)); });
  assert.equal(S.plan, 'storm', '예고 때 폭풍 편성'); assert.equal(S.boat.sailLevel, 1, '갑판원이 줄였다'); assert.ok(moods.has('storm'));
  assert.equal(G.seatType(S, a), 'sail');
  run(S, WX.storm.warn + WX.storm.len, (q) => { pin(-20, 0)(q); ev.push(...drain(q)); });
  assert.equal(S.plan, 'sail', '지나가면 항해 편성'); assert.equal(S.boat.sailLevel, 2, '돛을 되돌린다'); assert.ok(!S.boat.torn);
  assert.ok(ev.filter((e) => e.type === 'plan').length >= 2);
});

test('S5 출항 점검: 오늘 폭풍·찢어진 돛·안개·비(그늘막 없음)를 알리고, 가뭄 경고는 실제 여울 깊이로 판단한다', () => {
  const d = dayWith(1, (w) => w.storm !== null && w.gust === null), w = G.dayWeather(1, d);
  const S = sloopAt('lake'); S.docked = 'pine'; S.clock = d * CAL.day + w.storm - 60; S.pantry = [{ k: 'bread', n: 5, exp: d + 5 }];
  let c = G.departureCheck(S);
  assert.ok(c.ok); assert.ok(c.warns.some((x) => x.includes('오늘 폭풍')), c.warns.join('/'));
  assert.ok(c.warns.some((x) => x.includes('식량이 젖어')));
  S.clock = d * CAL.day + w.storm + WX.storm.len + 1; c = G.departureCheck(S);
  assert.ok(!c.warns.some((x) => x.includes('오늘 폭풍')), '지나간 폭풍은 빼요');
  S.boat.torn = true; assert.ok(G.departureCheck(S).warns.some((x) => x.includes('돛이 찢어')));
  const f = dayWith(1, (q) => q.fog); S.clock = f * CAL.day; assert.ok(G.departureCheck(S).warns.some((x) => x.includes('안개')));
  // 가뭄: 슬루프(흘수 0.68~)는 가뭄 여울(0.95 × 0.55 = 0.52)에 걸린다
  const dr = dayWith(1, (q) => q.drought), R = sloopAt('river'); R.docked = 'ferry'; R.clock = dr * CAL.day; R.food = 6; R.pantry = [{ k: 'bread', n: 6, exp: dr + 5 }];
  assert.ok(G.stats(R).draft < 0.75 && G.stats(R).draft > G.shoalFloor('river', WEATHER.droughtDepth));
  assert.ok(G.departureCheck(R).warns.some((x) => x.includes('가뭄')));
});

test('S5 안개: 보는 거리와 해도 밝히기가 줄고, 견시·랜턴이 덜어 주며 항구 가까이는 옅다', () => {
  const f = dayWith(1, (q) => q.fog);
  const S = sloopAt('lake', 1, [{ id: 'telescope', col: 0, row: 3, rot: 0 }, { id: 'hammock', col: 0, row: 5, rot: 0 }]);
  const clear = G.sightRange(S);
  S.boat.x = 0; S.boat.y = -300; S.clock = f * CAL.day + 10; G.step(S, G.FIXED_DT);
  assert.ok(S.weather.fog > 0.9);
  const thick = G.sightRange(S);
  assert.ok(thick < clear * 0.5, `${thick} < ${clear}`);
  S.ship.decor = ['lantern']; const lamp = G.sightRange(S); assert.ok(lamp > thick);
  S.crew = [mate('lookout')]; const look = G.sightRange(S); assert.ok(look > lamp);
  const p = worldOf('lake').ports[0]; S.boat.x = p.x; S.boat.y = p.y;
  assert.ok(G.fogCut(S) < 0.5, '항구 불빛 가까이는 옅다');
});

test('S5 홍수: 물살이 세고 여울이 깊어져 가뭄엔 걸리던 배도 지나간다. 표류물도 더 많다', () => {
  const fl = dayWith(1, (q) => q.flood, 28), dry = dayWith(1, (q) => q.drought), s = REGIONS.river.shoals[4];
  const go = (day) => { const S = sloopAt('river'); S.boat.x = s.x; S.boat.y = s.y; S.clock = day * CAL.day + 30; S.boat.row = true; G.step(S, G.FIXED_DT); return S; };
  assert.equal(go(dry).boat.shoal, true); assert.equal(go(fl).boat.shoal, false);
  // 물살: 같은 자리에서 1초 동안 흘러간 거리
  const wr = worldOf('river'), y = wr.ports[1].y - 60, x = [...Array(61)].map((_, i) => -150 + i * 5).sort((a, b) => wr.dist(b, y) - wr.dist(a, y))[0]; // 강 한가운데
  const drift = (day) => { const S = sloopAt('river'); S.boat.x = x; S.boat.y = y; S.clock = day * CAL.day + 30; const y0 = S.boat.y; run(S, 1); return Math.abs(S.boat.y - y0); };
  const calm = dayWith(1, (q) => !q.flood && !q.drought && q.gust === null && q.storm === null && q.squall === null && !q.fog, 30);
  assert.ok(drift(fl) > drift(calm) * 1.3, `${drift(fl)} > ${drift(calm)}`);
});

test('S5 너울·방수 격벽(앞바다용 자리): 너울이 내항성을 넘으면 깎이고 격벽이 절반으로 줄인다. 지금 담수엔 너울이 없다', () => {
  const st = SH.statsOf({ hull: 'sloop', mods: [] }), sb = { ...st, bulkhead: true };
  assert.equal(G.swellHurt(st, 0.5), 0);
  assert.ok(G.swellHurt(st, 2.5) > 0); assert.equal(G.swellHurt(sb, 2.5), G.swellHurt(st, 2.5) / 2);
  for (const id of WX_ORDER) assert.ok(!WX[id].fx.swell && !WX[id].fx.spray, `${id}: 담수 날씨엔 너울·물보라가 없다`);
});

test('저장 v4 → v5: 돛은 멀쩡, 꿰매기 규칙은 켬, 옛 날씨 칸은 효과 값을 채우고 그대로 이어서 돈다', () => {
  const S = sloopAt('lake'); const o = JSON.parse(G.serialize(S));
  o.v = 4; delete o.boat.torn; delete o.boat.strain; delete o.mend; delete o.rules?.mend; o.rules = { reef: true, repair: true, storm: false };
  o.weather = { heat: false, drought: false, gustOn: true, gustSoon: false };
  const T = G.deserialize(JSON.stringify(o));
  assert.equal(T.v, 5); assert.equal(T.boat.torn, false); assert.equal(T.boat.strain, 0); assert.equal(T.rules.mend, true);
  assert.ok(T.weather.fx); assert.equal(T.weather.gustOn, true, '돌풍이 끝나는 것도 알아챈다');
  run(T, 2);
  assert.ok(T.weather.fx && Array.isArray(T.weather.on));
  assert.equal(G.newGame(1).v, 5);
});
