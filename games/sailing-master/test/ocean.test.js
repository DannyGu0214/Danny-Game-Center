// M4a 대양(PLAN-M3.md 7·8절): O0 지도·빨리 가기, O1 바람 띠·물, O2 장비·역할, O3 내용
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import { worldOf } from '../world.js';
import { REGIONS, REGION_ORDER, TITLES, ACHIEVEMENTS } from '../data.js';

const openWater = (id, x, y, seed = 1) => { const S = G.newGame(seed); S.region = id; S.visited[id] = 1; S.docked = null; S.boat.x = x; S.boat.y = y; S.weather = { ...G.calmWeather(), on: [], soon: [] }; return S; };

test('O0 대양 지도: 12km 띠, 북쪽은 새 대륙, 항구 넷은 물가 12m 안, 남쪽 등대에서 새 대륙 항구까지 길이 있어요', () => {
  const t0 = performance.now(), w = worldOf('ocean'), ms = performance.now() - t0;
  assert.ok(ms < 1500, `만들기 ${Math.round(ms)}ms`);
  assert.equal(REGION_ORDER.at(-1), 'ocean'); assert.ok(TITLES.length >= REGION_ORDER.length);
  const sh = REGIONS.ocean.shape; assert.deepEqual([sh.x1 - sh.x0, sh.y1 - sh.y0], [1800, 12800]);
  assert.ok(w.isWater(0, -2000) && w.isWater(-600, -6000), '바다');
  for (const [x, y] of [[0, -11900], [-500, -12100], [700, -12000]]) assert.ok(w.dist(x, y) < 0, `새 대륙 ${x},${y}`); // 북쪽은 뭍
  assert.ok(w.isWater(0, -11300), '해안 앞 바다');
  for (const [x, y] of [[-950, -3000], [950, -3000], [0, 430]]) assert.ok(w.dist(x, y) < 0, `경계 밖 ${x},${y}`);
  assert.deepEqual(w.ports.map((p) => p.id), ['lastLight', 'atollA', 'atollB', 'newLand']);
  for (const p of w.ports) { const d = w.dist(p.x, p.y); assert.ok(d >= 8 && d <= 12.5, `${p.id} 물가 ${d.toFixed(1)}m`); }
  const a = w.ports[0], b = w.ports[3], pts = w.findPath(a.x, a.y, b.x, b.y); assert.ok(pts, '길'); assert.ok(Math.hypot(pts.at(-1).x - b.x, pts.at(-1).y - b.y) < 30);
  for (const p of w.ports) assert.ok(w.landDist(p.x, p.y) > -1, `${p.id}는 뭍이 아니에요`);
  // 산호섬 둘레 얕은 물은 탐사선(흘수 1.3m)도 지나가요
  for (const q of REGIONS.ocean.shoals) assert.ok(q.depth >= 1.6 && q.depth <= 2.0);
  // 윤곽: 바다 + 섬 셋 + 새 대륙
  assert.equal(w.outlines(0).length, 1 + REGIONS.ocean.islands.length + 1);
});

test('O0 빨리 가기: 큰 바다·대양의 탁 트인 곳에서만 되고, 입항·물가·수상한 날씨·태풍 가까이에선 안 돼요', () => {
  assert.ok(REGIONS.sea.fast && REGIONS.ocean.fast && !REGIONS.coast.fast && !REGIONS.river.fast);
  assert.equal(G.fastCheck(openWater('coast', 0, -300)).ok, false, '앞바다는 안 돼요');
  const S = openWater('ocean', 0, -2000); assert.equal(G.fastCheck(S).ok, true);
  S.docked = 'lastLight'; assert.equal(G.fastCheck(S).ok, false); S.docked = null;
  const near = openWater('ocean', 0, -11450); assert.equal(G.fastCheck(near).ok, false); assert.match(G.fastCheck(near).why, /물가/);
  for (const id of ['storm', 'typhoon']) { const T = openWater('ocean', 0, -2000); T.weather.soon = [id]; assert.equal(G.fastCheck(T).ok, false, id); assert.match(G.fastCheck(T).why, /수상/); }
  const U = openWater('ocean', 0, -2000); U.weather.on = ['calm']; assert.equal(G.fastCheck(U).ok, true, '무풍은 괜찮아요');
  const V = openWater('ocean', 0, -2000); V.disaster = { cause: 'faint' }; assert.equal(G.fastCheck(V).ok, false);
  // 규칙은 그대로: ×4는 step을 4번 부르는 것이라 같은 시간만큼 가요
  const A = openWater('ocean', 0, -2000, 3), B = openWater('ocean', 0, -2000, 3);
  for (const T of [A, B]) { T.ship.hull = 'sloop'; T.boat.sailLevel = 2; T.boat.sailNow = 1; T.boat.h = -Math.PI / 2; T.wind = { from: Math.PI / 2, speed: 8 }; }
  for (let i = 0; i < 300; i++) G.step(A, G.FIXED_DT); for (let i = 0; i < 300; i++) for (let m = 0; m < 1; m++) G.step(B, G.FIXED_DT);
  assert.equal(A.t, B.t); assert.equal(A.boat.y, B.boat.y);
});

test('O0 대양에 닿기: 도전과제 oceanGate는 대양에 처음 닿을 때, 칭호 「대양 항해사」, 저장은 v9(crossed·crossDays 기본값)', () => {
  assert.equal(TITLES[5], '대양 항해사'); assert.ok(ACHIEVEMENTS.find((a) => a.id === 'oceanGate').desc.includes('대양'));
  const S = G.newGame(2); assert.equal(S.v, 9); assert.equal(S.crossed, null); assert.equal(S.stats.crossDays, 0);
  const L = G.deserialize(G.serialize(S)); assert.equal(L.crossed, null);
  assert.ok(!S.ach.oceanGate); S.visited.ocean = 1; G.checkAch(S); assert.ok(S.ach.oceanGate);
});

// ── O1 바람 띠·무풍대·대양 너울·빗물받이 ──
test('O1 바람 띠: 무역풍(동남쪽 10) → 무풍대(1.5) → 편서풍(서쪽 13), 경계는 300m씩 섞여요', () => {
  const at = (y) => G.bandAt('ocean', y);
  assert.deepEqual(['trade', 'doldrums', 'westerlies'], [at(-2000).id, at(-5800).id, at(-9500).id]);
  assert.equal(G.bandAt('sea', 0), null, '큰 바다는 띠가 없어요');
  assert.ok(Math.abs(at(-2000).speed - 10) < 1e-9 && Math.abs(at(-5800).speed - 1.5) < 1e-9 && Math.abs(at(-9500).speed - 13) < 1e-9);
  assert.ok(at(-5800).calm && !at(-2000).calm);
  // 경계(−4,400)에서 섞여요: 한가운데는 중간 세기, 300m 밖은 순수
  const mid = at(-4400).speed; assert.ok(mid > 4 && mid < 8, `경계 ${mid}`);
  assert.ok(Math.abs(at(-4150).speed - 10) < 0.5 && Math.abs(at(-4700).speed - 1.5) < 0.5);
  // 바람이 오는 방향: 무역풍은 남동(45°), 편서풍은 서쪽(180°)
  assert.ok(Math.abs(at(-2000).from - Math.PI / 4) < 1e-9 && Math.abs(Math.abs(at(-9500).from) - Math.PI) < 1e-9);
  // windAt은 배 y를 따라가요
  const S = openWater('ocean', 0, -5800); const w = G.windAt(S); assert.ok(w.speed < 3, `무풍대 ${w.speed}`);
  S.boat.y = -9500; assert.ok(G.windAt(S).speed > 9);
  S.boat.y = -2000; assert.ok(G.windAt(S).speed > 7);
});

test('O1 대양 너울: 기본 1.8m, 편서풍 ×1.2, 무풍대 ×0.5', () => {
  const S = openWater('ocean', 0, -2000); S.weather.fx = { ...S.weather.fx, swell: 2 };
  const hereAt = (y) => G.swellHere(S, 0, y);
  assert.ok(Math.abs(hereAt(-2000) - 2) < 1e-6); assert.ok(Math.abs(hereAt(-5800) - 1) < 1e-6); assert.ok(Math.abs(hereAt(-9500) - 2.4) < 1e-6);
  assert.equal(REGIONS.ocean.swell.base, 1.8);
});

test('O1 빗물받이: 비 오는 동안 20초마다 한 통(대수만큼), 물통 칸까지, 맑은 날엔 안 받아요', () => {
  const seed = 1, rainAt = (t) => G.weatherAt('ocean', seed, t).rain;
  let t0 = -1; for (let t = 0; t < 180 * 400 && t0 < 0; t += 5) if ([0, 20, 40, 60, 80, 100].every((d) => rainAt(t + d))) t0 = t; // 100초 이어서 비 오는 때
  let c0 = -1; for (let t = 0; t < 180 * 400 && c0 < 0; t += 5) if ([0, 50, 100].every((d) => !rainAt(t + d))) c0 = t;
  assert.ok(t0 >= 0 && c0 >= 0, '비 오는 때·맑은 때를 찾아야 해요');
  const mk = (n, at) => { const S = openWater('ocean', 0, -2000, seed); S.clock = at; S.ship.hull = 'explorer'; S.ship.mods = [{ id: 'oar', col: 0, row: 2, rot: 0 }]; for (let i = 0; i < n; i++) S.ship.mods.push({ id: 'raincatch', col: 1 + i, row: 8, rot: 0 }); S.rev++; S.water = 2; return S; };
  const run = (S, sec) => { for (let i = 0; i < sec * 30; i++) { G.step(S, G.FIXED_DT); S.food = 99; S.hull = 1; S.vigor = 1; S.boat.stamina = 1; S.water = Math.max(S.water, 0); } return S; };
  const none = run(mk(0, t0), 100), one = run(mk(1, t0), 100), two = run(mk(2, t0), 100);
  assert.equal(G.stats(one).raincatch, 1);
  assert.ok(one.water > none.water + 3, `한 대 ${one.water} / 없음 ${none.water}`); assert.ok(two.water > one.water + 3, `두 대 ${two.water}`);
  const dry = run(mk(2, c0), 100), dryNone = run(mk(0, c0), 100); assert.ok(dry.water <= dryNone.water + 0.5, '맑은 날은 안 받아요');
  const full = mk(2, t0); full.water = G.stats(full).waterCap; run(full, 60); assert.ok(full.water <= G.stats(full).waterCap + 1e-9);
  assert.deepEqual(REGIONS.ocean.windBands.map((b) => b.id), ['trade', 'doldrums', 'westerlies']);
});

test('O1 사는 재료: 큰 바다 재료는 대양 항구에서도 사요(전자 부품은 보급항에서만)', () => {
  const S = openWater('ocean', 0, 252); S.docked = 'lastLight';
  for (const k of ['teak', 'synth', 'steel', 'oak', 'plate']) assert.ok(G.canBuyMat(S, k), k);
  assert.equal(G.canBuyMat(S, 'chip'), false);
  const A = openWater('ocean', 0, -3900); A.docked = 'atollA'; assert.equal(G.canBuyMat(A, 'teak'), false, '산호섬 나루는 가게가 없어요');
});

// ── O2 장비·역할·대양 태풍 ──
import { ROLES, MODULES, HULLS, SEATS, TYPHOON } from '../data.js';
const hire = (S, role, lv = 1) => { S.crewSeq = (S.crewSeq || 0) + 1; const c = { id: S.crewSeq, role, name: role, lv, xp: 0, fatigue: 0, morale: 0.7, wage: 1, baseWage: 1, skill: 1, humor: 1, drink: 1, trait: null }; S.crew.push(c); G.autoSeat(S); return c; };
const bigShip = (mods, hull = 'explorer3', seed = 1) => { const S = openWater('ocean', 0, -2000, seed); S.ship.hull = hull; S.ship.mods = mods.map((m, i) => ({ rot: 0, ...m })); S.rev++; S.water = 5; S.food = 99; return S; };

test('O2 기상사·일등 항해사: 큰 바다부터 후보가 오고, 함교 자리(탐사선)와 기상 자리가 생겨요', () => {
  for (const r of ['weather', 'mate']) assert.ok(!ROLES[r].future && ROLES[r].region === 'sea' && ROLES[r].grade === 5, r);
  assert.deepEqual([ROLES.weather.hire, ROLES.weather.wage, ROLES.mate.hire, ROLES.mate.wage], [35, 3, 50, 4]);
  assert.equal(SEATS.bridge, '함교');
  const S = bigShip([{ id: 'station', col: 3, row: 4 }]);
  const seats = G.seatsOf(S); assert.ok(seats.some((q) => q.type === 'bridge' && q.x > 8) && seats.some((q) => q.type === 'weather'));
  assert.ok(HULLS.explorer.bridgeAt && HULLS.explorer2.bridgeAt && HULLS.explorer3.bridgeAt);
  const m = hire(S, 'mate'), w = hire(S, 'weather');
  assert.equal(S.crew.find((c) => c.id === m.id).seat, 'bridge'); assert.match(S.crew.find((c) => c.id === w.id).seat, /^station@/);
  assert.ok(G.roleWork(S, 'mate') > 0.9 && G.roleWork(S, 'weather') > 0.9);
});

test('O2 기상사: 예보 +1일, 태풍 예고 +1일, 태풍 예상 경로를 하루 전부터 해도에', () => {
  const S = bigShip([{ id: 'station', col: 3, row: 4 }]);
  const base = G.forecast(S).length; hire(S, 'weather'); assert.equal(G.forecast(S).length, base + 1); assert.equal(G.officerDays(S), 1);
  // 태풍이 있는 날 전날: 기상사가 있으면 내일 경로가 보여요
  const seed = 5; S.seed = seed; let day = -1; for (let d = 1; d < 400 && day < 0; d++) if (G.dayWeather(seed, d).typhoon && REGIONS.ocean.weather.includes('typhoon')) day = d;
  assert.ok(day > 0, '대양에 태풍이 오는 날이 있어야 해요');
  S.clock = (day - 1) * 180 + 20; const v = G.typhoonView(S); assert.ok(v && v.tomorrow && !v.pos, '전날 경로');
  const T = bigShip([{ id: 'station', col: 3, row: 4 }]); T.seed = seed; T.clock = (day - 1) * 180 + 20; assert.equal(G.typhoonView(T), null, '기상사 없으면 안 보여요');
});

test('O2 일등 항해사: 다른 선원 효과 +10%, 피로 −20%, 조타수 몫(선장이 키를 떠나도 돼요)', () => {
  const mk = () => bigShip([{ id: 'mast_l', col: 2, row: 3 }, { id: 'mast_d', col: 2, row: 9 }, { id: 'hammock', col: 0, row: 14 }, { id: 'hammock', col: 4, row: 14 }]);
  const A = mk(), B = mk(); const da = hire(A, 'deckhand'), db = hire(B, 'deckhand'); hire(B, 'mate');
  assert.ok(Math.abs(G.crewWork(B, 'sail') / G.crewWork(A, 'sail') - 1.1) < 0.01, `+10% ${G.crewWork(B, 'sail') / G.crewWork(A, 'sail')}`);
  for (const T of [A, B]) { G.undock(T); T.boat.sailLevel = 2; }
  for (let i = 0; i < 30 * 60; i++) { G.step(A, G.FIXED_DT); G.step(B, G.FIXED_DT); A.food = B.food = 99; }
  const fa = A.crew.find((c) => c.id === da.id).fatigue, fb = B.crew.find((c) => c.id === db.id).fatigue;
  assert.ok(fa > 0 && Math.abs(fb / fa - 0.8) < 0.03, `피로 ${fb}/${fa}`);
  // 조타수 몫: 일등 항해사가 있으면 선장이 키를 떠나도 배가 말을 들어요
  assert.ok(G.workerAt(B, 'helm') && G.workerAt(B, 'helm').role === 'mate'); assert.equal(G.workerAt(A, 'helm'), null);
});

test('O2 자동 조타: 사람 없이 항로를 지켜요(선장이 키를 떠나도 됨)', () => {
  const S = bigShip([{ id: 'autohelm', col: 2, row: 17 }]); G.undock(S);
  assert.ok(MODULES.autohelm.need.grade === 5 && MODULES.autohelm.cost.steel === 4 && MODULES.autohelm.cost.chip === 2);
  assert.equal(G.stats(S).autohelm, true); assert.equal(G.workerAt(S, 'helm'), null);
  S.cap.at = 'mast'; S.cap.to = null; S.cap.x = 0; G.setSail(S, 2); assert.equal(S.cap.to, null, '자동 조타가 있으면 선장이 키로 돌아가지 않아도 돼요');
  const N = bigShip([]); G.undock(N); assert.equal(G.stats(N).autohelm, false);
});

test('O2 태양광 패널: 보조 기관 +0.5m/s(2장까지), 비·해무·태풍엔 절반', () => {
  assert.deepEqual([MODULES.solar.w, MODULES.solar.h, MODULES.solar.cost], [2, 1, { chip: 2, steel: 2, synth: 4 }]);
  const calm = (() => { for (let d = 1; d < 400; d++) { const ok = (t) => { const w = G.weatherAt('ocean', 3, t); return !w.rain && !w.fog && !w.gustOn && !w.stormOn && !w.on.length && !w.gustSoon && !w.stormSoon && !w.typhoonSoon; }; if ([0, 20, 40, 60, 80].every((x) => ok(d * 180 + 40 + x))) return d * 180 + 40; } throw new Error('맑은 날'); })();
  const top = (n) => { const S = bigShip([{ id: 'mast_l', col: 2, row: 3 }, ...Array.from({ length: n }, (_, i) => ({ id: 'solar', col: 0 + (i ? 3 : 0), row: 12 }))], 'explorer', 3); G.undock(S); S.seed = 3; S.clock = calm; S.boat.sailLevel = 1; S.boat.h = -Math.PI / 2; S.boat.y = -5800; S.wind = { from: 0, speed: 0 }; let m = 0; for (let i = 0; i < 30 * 60; i++) { G.step(S, G.FIXED_DT); S.boat.y = -5800; S.food = 99; S.boat.sailLevel = 1; S.hull = 1; m = Math.max(m, S.boat.spd); } return [m, S]; };
  const [m0] = top(0), [m1, S1] = top(1), [m2, S2] = top(2), [m3] = top(3);
  assert.equal(G.stats(S1).solar, 1); assert.equal(G.stats(S2).solar, 2);
  assert.ok(m0 > 3.9 && m0 < 4.4, `무풍대 기관 ${m0}`); assert.ok(m1 > m0 + 0.35 && m1 < m0 + 0.65, `1장 ${m1}`); assert.ok(m2 > m0 + 0.85 && m2 < m0 + 1.15, `2장 ${m2}`); assert.ok(Math.abs(m3 - m2) < 0.05, '세 장째는 안 늘어요');
});

test('O2 대양 태풍: 폭 3.6km 띠를 가로질러 가고(대피 항구 없음, 비켜 가야 해요), 크기·세기는 큰 바다와 같아요', () => {
  assert.ok(REGIONS.ocean.weather.includes('typhoon'));
  const seed = 5; let tr = null, d = 0; for (d = 1; d < 400 && !tr; d++) tr = G.dayWeather(seed, d).typhoon;
  assert.ok(tr); const T = G.typhoonTrack('ocean', tr);
  const sh = REGIONS.ocean.shape; assert.ok(T.sx < sh.x0 || T.sx > sh.x1, '옆 끝 밖에서 들어와요');
  const [ya, yb] = sh.ty; for (const y of [T.sy, T.ey]) assert.ok(y > ya - 2000 && y < yb + 2000, `경로 y ${y}`);
  const px = (T.sx + T.ex) / 2, py = (T.sy + T.ey) / 2; assert.ok(Math.abs(px) < 0.31 * (sh.x1 - sh.x0) && py >= ya && py <= yb, `한가운데 ${px},${py}`);
  // 태풍 속도: 모양 비율이 비슷해야 해요(150초에 3km 안팎, 큰 바다는 약 5km)
  const speed = Math.hypot(T.ex - T.sx, T.ey - T.sy) / T.dur; assert.ok(speed > 12 && speed < 45, `속도 ${speed}`);
  // 같은 시드·날짜면 같은 경로
  assert.deepEqual(G.typhoonTrack('ocean', G.dayWeather(seed, d - 1).typhoon), T);
  // 태풍 안 효과는 큰 바다와 같은 표
  const live = (() => { const S = openWater('ocean', 0, -6000, seed); for (let t = 0; t < 180 * 3; t += 1) { const q = G.typhoonAt('ocean', seed, (d - 1) * 180 + tr.t0 + t, G.typhoonPos('ocean', tr, t)[0], G.typhoonPos('ocean', tr, t)[1]); if (q && q.zone === 'eye') return q; } return null; })();
  assert.ok(live && live.windDown === TYPHOON.eyeWind);
});

// ── O3 발견지·생물·도전과제 ──
import { SPECIES } from '../data.js';
import { createCreatures } from '../creatures.js';

test('O3 발견지 8곳: 띠마다 어울리는 자리, 항구·수문과 겹치지 않고 다 닿아요', () => {
  const w = worldOf('ocean'), f = Object.fromEntries(w.finds.map((q) => [q.id, q])); assert.equal(w.finds.length, 8);
  const arts = w.finds.map((q) => q.art).sort(); assert.deepEqual(arts, ['beached', 'bottle', 'buoy', 'iceberg', 'kelp', 'stone', 'vent', 'whalespot']);
  const band = (y) => REGIONS.ocean.windBands.find((b) => y <= b.y0 && y > b.y1).id;
  assert.equal(band(f.kelpMat.y), 'doldrums'); assert.equal(band(f.iceberg.y), 'westerlies'); assert.equal(band(f.weatherBuoy.y), 'trade');
  assert.ok(f.iceberg.y < -10000, '편서풍 띠 북쪽 끝'); assert.equal(f.farSideStone.where, 'inland'); assert.ok(w.dist(f.farSideStone.x, f.farSideStone.y) < -25, '새 대륙 내륙');
  for (const q of w.finds) for (const p of [...w.ports, ...w.gates]) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > 40, `${q.id} 가 ${p.id} 와 겹쳐요`);
  for (const q of w.finds.filter((v) => v.where === 'water')) assert.ok(w.dist(q.x, q.y) > 30, `${q.id} 물 위`);
  const o = { mats: ['steel', 'chip', 'teak', 'syrope', 'synth'] }; assert.ok(f.weatherBuoy.chip === 2 && f.seaVent.steel === 6 && f.kelpMat.syrope === 8 && f.lagoonBoat.teak > 0 && o.mats.length);
  // 다 찾으면 발견물 도감에 유물 8개
  const S = openWater('ocean', 0, 252); S.ship.mods.push({ id: 'telescope', col: 0, row: 3, rot: 0 });
  for (const q of G.findsOf(S)) for (let i = 0; i < 60 && !S.found[q.id]; i++) { S.boat.x = q.x; S.boat.y = q.y; S.boat.spd = 0; S.food = 99; S.hull = 1; G.step(S, G.FIXED_DT); }
  assert.equal(Object.keys(S.relics).filter((k) => w.finds.some((q) => q.id === k)).length, 8);
});

test('O3 대양 생물 8종: 고래 3종·돌고래 떼·개복치·바다제비·펭귄·슴새 떼, 도감은 대양 칸에', () => {
  const ids = Object.keys(SPECIES).filter((id) => SPECIES[id].region === 'ocean'); assert.equal(ids.length, 8);
  assert.deepEqual(ids.map((id) => SPECIES[id].kind).sort(), ['bird', 'bird', 'dolphin', 'penguin', 'sunfish', 'whale', 'whale', 'whale']);
  assert.ok(SPECIES.bluewhale.size >= 2.6 && SPECIES.bluewhale.rare < 0.5 && SPECIES.spermwhale.head === 'blunt');
  for (const id of ids) assert.ok(SPECIES[id].sea, `${id}: 민물 도감(speciesAll)에서 빠져요`);
  // 큰 바다 도감(islandNaturalist)·앞바다(seaAll)엔 안 들어가요
  const S = G.newGame(1); for (const id of Object.keys(SPECIES)) if (SPECIES[id].region !== 'ocean') G.recordSpecies(S, id);
  assert.ok(!S.ach.oceanNaturalist && S.ach.islandNaturalist);
  for (const id of ids) G.recordSpecies(S, id); assert.ok(S.ach.oceanNaturalist); assert.equal(ACHIEVEMENTS.find((a) => a.id === 'oceanNaturalist').coin, 80);
});

test('O3 생물이 실제로 나와요: 고래·개복치·돌고래·새를 시뮬레이션에서 볼 수 있고, 펭귄은 빙산 위에서만', () => {
  const w = worldOf('ocean'), cr = createCreatures(w), seen = new Set(), cam = { x: 0, y: -6000, zoom: 5.5, cy: 300 }, boat = { x: 0, y: -6000, h: 0, spd: 4 };
  let seed = 7; const R = Math.random; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  try { for (let i = 0; i < 20000; i++) { cr.update(0.1, cam, 400, 600, boat, false, { tide: 0, len: 9, docked: false }); for (const c of cr.list) seen.add(c.sp); if (i % 40 === 0) cr.clear(); } } finally { Math.random = R; }
  for (const id of ['humpback', 'spermwhale', 'commondolphin', 'sunfish', 'petrel', 'shearflock']) assert.ok(seen.has(id), `${id} 안 나와요`);
  assert.ok(!seen.has('penguin'), '펭귄은 빙산 없이 안 나와요');
  const cr2 = createCreatures(w); cr2.update(0.1, { x: -560, y: -10900, zoom: 5.5, cy: 300 }, 400, 600, boat, false, { berg: { x: -560, y: -10900 } });
  assert.equal(cr2.list.filter((c) => c.sp === 'penguin').length, 2);
});

test('O3 고래의 도약: 뛰어오르는 고래를 탭하면 기록 + 도전과제(50닢), 고래가 아니면 안 돼요', () => {
  const S = G.newGame(1); S.region = 'ocean'; const c0 = S.res.coin;
  assert.equal(G.whaleLeap(S, 'duck'), false);
  assert.equal(G.whaleLeap(S, 'humpback'), true); assert.ok(S.seen.humpback && S.ach.whaleLeap); assert.equal(S.res.coin, c0 + 50);
  assert.equal(G.whaleLeap(S, 'humpback'), false, '한 번만');
  // 크리처: 배 120m 안 고래는 가끔 breach 를 해요
  const w = worldOf('ocean'), cr = createCreatures(w), boat = { x: 0, y: -6000, h: 0, spd: 0 }; let any = 0;
  cr.list.push({ sp: 'humpback', kind: 'whale', x: 60, y: -6000, h: 0, age: 0, life: 1e6, ph: 0, act: 0, next: 5, size: 1.6, st: 1, breach: 0 });
  let sd = 11; const R0 = Math.random; Math.random = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  try { for (let i = 0; i < 30 * 1800 && !any; i++) { cr.update(1 / 30, { x: 0, y: -6000, zoom: 5.5, cy: 300 }, 400, 600, boat, false, {}); const q = cr.list.find((v) => v.sp === 'humpback'); if (q) { q.life = 1e6; q.x = 60; if (q.breach > 0) any = q.breach; } } } finally { Math.random = R0; }
  assert.ok(any > 0 && any <= 3, '30분 안에 뛰어올라야 해요');
});

test('O3 무풍대를 건너: 남쪽(−4,400m 아래)을 지난 배가 북쪽 끝(−7,100m)을 넘으면 40닢', () => {
  const S = openWater('ocean', 0, -3000); S.food = 99; const c0 = S.res.coin;
  S.boat.y = -7200; G.step(S, G.FIXED_DT); assert.ok(!S.ach.doldrums, '북쪽만 온 배는 안 돼요');
  const T = openWater('ocean', 0, -3000, 2); T.boat.y = -4000; G.step(T, G.FIXED_DT); assert.ok(!T.ach.doldrums); T.boat.y = -7200; G.step(T, G.FIXED_DT);
  assert.ok(T.ach.doldrums, '남에서 북으로 건넜어요'); assert.ok(T.res.coin >= c0 + 40);
});
