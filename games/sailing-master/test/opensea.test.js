// M3 큰 바다(PLAN-M3.md 9-3절): B0 지도 시제품(isles 모양·항구·관문·저장 v8)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import { worldOf, createWorld } from '../world.js';
import { sceneLayout } from '../art.js';
import { HULLS, REGIONS, REGION_ORDER, ACHIEVEMENTS, TITLES } from '../data.js';
import { THEMES } from '../themes.js';

const drain = (S) => { const e = S.events.slice(); S.events.length = 0; return e; };
const SCH = [{ id: 'mast_m', col: 2, row: 2, rot: 0 }, { id: 'mast_d', col: 2, row: 7, rot: 0 }, { id: 'oar', col: 0, row: 10, rot: 0 }, { id: 'wheel', col: 2, row: 12, rot: 0 }];
// 앞바다 북쪽 경계 앞의 배
function coastShip(hull = 'schooner', seed = 1) {
  const S = G.newGame(seed);
  S.region = 'coast'; S.visited = { pond: 1, lake: 1, river: 1, coast: 1 }; S.blueprints = { mast_m: 1, telescope: 1 };
  S.ship = { hull, mods: (hull === 'schooner' ? SCH : [{ id: 'mast_m', col: 1, row: 2, rot: 0 }, { id: 'oar', col: 1, row: 4, rot: 0 }]).map((m) => ({ ...m })), name: 'T', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
  S.cap.x = HULLS[hull].helmX; S.cap.at = 'helm'; S.food = 50; S.water = 8; S.res.coin = 100;
  G.dock(S, 'yard'); drain(S);
  return S;
}

test('B0 isles 격자: 섬 안은 뭍, 네 끝 바깥은 dist < 0, 항구 4곳은 물가 12m 안', () => {
  const t0 = performance.now(), w = worldOf('sea'), ms = performance.now() - t0;
  assert.ok(w.isles && !w.coast && !w.river);
  assert.ok(ms < 1500, `만들기 ${Math.round(ms)}ms`); // 계획서: 300ms(node)를 넘으면 칸을 10m로(여기서는 8m 칸의 격자 전체 시간)
  for (const I of REGIONS.sea.islands) assert.equal(w.isWater(I.x, I.y), false, `섬 ${I.x},${I.y}`);
  // 큰 섬 남쪽 만은 물이에요(혹 −160m): 큰 섬 중심에서 남쪽으로 가면 해안선이 짧아져 바다가 닿아요
  assert.equal(w.isWater(300, -300), false);
  assert.ok(w.isWater(300, -20), '큰 섬 남쪽 만');
  assert.ok(w.isWater(0, 0) && w.isWater(1000, 1000), '바다');
  // 네 끝 경계
  for (const [x, y] of [[-2010, 0], [2010, 0], [0, -1610], [0, 1610]]) assert.ok(w.dist(x, y) < 0, `경계 밖 ${x},${y}`);
  for (const [x, y] of [[-1950, 0], [1950, 0], [0, -1550], [0, 1550]]) assert.ok(w.edgeDist(x, y) > 0 && w.edgeDist(x, y) <= 50, `경계 안 ${x},${y}`);
  assert.deepEqual(w.ports.map((p) => p.id), ['southLight', 'depot', 'palm', 'rockVillage']);
  for (const p of w.ports) { const d = w.dist(p.x, p.y); assert.ok(d >= 8 && d <= 12.5, `${p.id} 물가 ${d.toFixed(1)}m`); }
  assert.equal(REGIONS.sea.ports.find((p) => p.id === 'depot').yard, 5, '보급항은 5등급 조선소');
  assert.deepEqual(w.gates.map((g) => g.id), ['toCoast', 'toOcean']);
  assert.equal(w.gates.find((g) => g.id === 'toOcean').def ?? REGIONS.sea.gates[1].req.grade, 5);
  assert.ok(REGION_ORDER.includes('sea') && THEMES[REGIONS.sea.theme] && TITLES.length >= REGION_ORDER.length);
});

test('B0 섬 해안선 혹: 혹이 없으면 육지인 자리가 혹이 있으면 만(물)이에요', () => {
  const I = REGIONS.sea.islands[0], flat = createWorld({ ...REGIONS.sea, islands: [{ ...I, bumps: [] }, ...REGIONS.sea.islands.slice(1)] }), w = worldOf('sea');
  for (const y of [-80, -40, 0]) { assert.equal(flat.isWater(300, y), false, `혹 없음 ${y}`); assert.equal(w.isWater(300, y), true, `만 ${y}`); }
  assert.equal(w.isWater(300, -200), false, '섬 가운데는 그대로 뭍');
});

test('B0 풍경: 큰 바다 장면 배치가 만들어져요(항구 집 4·관문 표지 2)', () => {
  const S = G.newGame(1), L = sceneLayout('sea', G.findsOf(S, 'sea'));
  assert.equal(L.marks.filter((m) => m.port).length, 4); assert.equal(L.marks.filter((m) => m.gate).length, 2);
  assert.ok(L.props.length > 50, `사물 ${L.props.length}`);
});

test('B0 앞바다 → 큰 바다 → 앞바다 왕복: 스쿠너는 통과, 슬루프는 막혀요', () => {
  const toSea = worldOf('coast').gates.find((g) => g.id === 'toSea'), S0 = coastShip('sloop3' in HULLS ? 'sloop3' : 'sloop');
  assert.equal(G.passGate(S0, toSea), false);
  const S = coastShip('schooner');
  assert.ok(G.passGate(S, toSea));
  const ev = drain(S).find((e) => e.type === 'region');
  assert.ok(ev && ev.to === 'sea' && ev.first);
  assert.equal(S.region, 'sea'); assert.equal(S.docked, 'southLight'); assert.ok(S.visited.sea && S.ach.openSea && !S.ended);
  const back = worldOf('sea').gates.find((g) => g.id === 'toCoast');
  assert.ok(G.gateStatus(S, back).ok);
  assert.ok(G.passGate(S, back));
  assert.equal(S.region, 'coast'); assert.equal(S.docked, 'light');
  // 대양 어귀(5등급)는 아직 스쿠너로 못 넘어요
  assert.ok(G.passGate(S, toSea));
  const gate = worldOf('sea').gates.find((g) => g.id === 'toOcean');
  assert.equal(G.gateStatus(S, gate).ok, false); assert.equal(G.passGate(S, gate), false); assert.ok(!S.ended);
  assert.ok(G.gateStatus(S, gate).list[0].text.includes('5등급'));
});

test('B0 큰 바다 항해: 남쪽 등대 항 → 큰 섬 보급항 → 대양 어귀 표지까지 배로 가요', () => {
  const S = coastShip('schooner'); S.crew = Array.from({ length: 3 }, (_, i) => ({ id: 80 + i, role: 'deckhand', name: `x${i}`, wage: 0, baseWage: 0, lv: 1, xp: 0, fatigue: 0, morale: 0.9, trait: 'diligent' }));
  assert.ok(G.passGate(S, worldOf('coast').gates.find((g) => g.id === 'toSea'))); drain(S);
  const w = worldOf('sea');
  G.undock(S); S.food = 500; S.water = 10; S.boat.sailLevel = 2; S.boat.sailNow = 1;
  for (const [x, y, name] of [[w.ports[1].x, w.ports[1].y, 'depot'], [w.gates[1].x, w.gates[1].y, 'toOcean']]) {
    assert.ok(G.setDest(S, x, y), `${name} 길`);
    let sec = 0;
    while (S.route && sec < 2600) { G.step(S, G.FIXED_DT); sec += G.FIXED_DT; S.hull = 1; S.vigor = 1; S.boat.stamina = 1; S.water = 10; S.food = 500; S.crew.forEach((c) => { c.fatigue = 0; c.morale = 1; }); assert.ok(w.dist(S.boat.x, S.boat.y) > 0, '땅에 안 닿아요'); S.events.length = 0; }
    assert.equal(S.route, null, `${name}까지 가요(${sec.toFixed(0)}s)`);
  }
});

test('B0 저장 v7 → v8: 앞바다에서 M2 엔딩을 본 저장은 엔딩을 풀고 등대섬에 대 둬요, 옛 관문 경로·도전과제는 그대로', () => {
  const S = coastShip('schooner');
  const o = JSON.parse(G.serialize(S)); o.v = 7; o.ended = true; o.docked = null; o.ach = { ...o.ach, openSea: 1 }; o.res.coin = 77;
  o.route = { pts: [{ x: 0, y: -665 }], i: 0, target: { type: 'gate', id: 'toOcean' } };
  delete o.stats.typhoons; delete o.stats.typhoonHurt; delete o.stats.calmDays;
  const T = G.deserialize(JSON.stringify(o));
  assert.equal(T.v, 9); assert.equal(T.ended, false); assert.equal(T.region, 'coast'); assert.equal(T.docked, 'light'); assert.equal(T.route, null);
  assert.ok(T.ach.openSea); assert.equal(T.res.coin, 77, '금화를 다시 주지 않아요');
  assert.equal(T.stats.typhoons, 0); assert.equal(T.stats.typhoonHurt, 0); assert.equal(T.stats.calmDays, 0);
  // 엔딩 안 본 v7(앞바다 도중)은 그대로
  const p = JSON.parse(G.serialize(coastShip('schooner'))); p.v = 7; p.docked = 'yard';
  const U = G.deserialize(JSON.stringify(p));
  assert.equal(U.v, 9); assert.equal(U.region, 'coast'); assert.equal(U.docked, 'yard'); assert.equal(U.ended, false);
  // v8 왕복, 큰 바다 저장도 그대로 불러와요
  const sea = coastShip('schooner'); G.passGate(sea, worldOf('coast').gates.find((g) => g.id === 'toSea'));
  const R = G.deserialize(G.serialize(sea));
  assert.equal(R.region, 'sea'); assert.equal(R.docked, 'southLight'); assert.equal(R.v, 9);
});

test('B0 새 게임·새 저장 모양: v8, 태풍·무풍 통계 0, 도전과제 openSea는 큰 바다 도착이에요', () => {
  const S = G.newGame(1);
  assert.equal(S.v, 9); assert.deepEqual([S.stats.typhoons, S.stats.typhoonHurt, S.stats.calmDays], [0, 0, 0]);
  const a = ACHIEVEMENTS.find((q) => q.id === 'openSea'); assert.ok(a && a.desc.includes('큰 바다'));
});

// ── B1 바다 체계(너울·조류·무풍·항속 계획) ──
import { CAL, WX } from '../data.js';
const seaShip = (seed = 1) => { const S = coastShip('schooner', seed); G.passGate(S, worldOf('coast').gates.find((g) => g.id === 'toSea')); drain(S); return S; };
const dayWith = (seed, pred, from = 1) => { for (let d = from; d < 800; d++) if (pred(G.dayWeather(seed, d), d)) return d; throw new Error('그런 날이 없어요'); };

test('B1 너울: 큰 바다는 어디나 1, 항구 둘레 180m 안만 잔잔해요(× 0.3)', () => {
  const w = worldOf('sea');
  assert.equal(w.swellAt(0, 0), 1); assert.equal(w.swellAt(1000, 1000), 1); assert.equal(w.swellAt(-1000, -1300), 1);
  for (const p of w.ports) { assert.equal(+w.swellAt(p.x, p.y).toFixed(2), 0.3, `${p.id} 안`); assert.equal(w.swellAt(p.x + 260, p.y), 1, `${p.id} 밖`); }
  const mid = w.swellAt(w.ports[1].x, w.ports[1].y + 160); assert.ok(mid > 0.3 && mid < 1, `가장자리는 서서히 ${mid}`);
  assert.equal(worldOf('coast').swellAt(0, 0) >= 0, true); // 앞바다 식은 그대로
  // 너울 높이 표(1.3 + 날마다 0.4)는 담수가 아니니 그대로 돌아요
  const S = seaShip(); S.clock = 1 * CAL.day + 10; S.weather = G.weatherAt('sea', S.seed, S.clock);
  assert.ok(S.weather.fx.swell >= REGIONS.sea.swell.base);
  assert.ok(G.swellHere(S, w.ports[0].x + 900, w.ports[0].y - 900) > G.swellHere(S, w.ports[0].x, w.ports[0].y));
});

test('B1 조류: 선분 위에서 방향·세기가 맞고, 폭 밖은 0이에요(항로가 같은 flowAt을 써요)', () => {
  const w = worldOf('sea');
  const [e0, e1] = w.flowAt(1000, 320); assert.ok(Math.abs(e0 - 0.8) < 1e-9 && Math.abs(e1) < 1e-9, '동쪽 0.8');
  const [h0] = w.flowAt(1000, 400); assert.ok(Math.abs(h0 - 0.8 * (1 - 0.25)) < 1e-9, '가장자리 쪽은 약해요');
  assert.deepEqual(w.flowAt(1000, 520), [0, 0]);
  const [n0, n1] = w.flowAt(-700, 400); assert.ok(Math.abs(n0) < 1e-9 && Math.abs(n1 + 0.6) < 1e-9, '북쪽 0.6');
  const [s0, s1] = w.flowAt(-1300, -700); assert.ok(Math.abs(s0) < 1e-9 && Math.abs(s1 - 0.7) < 1e-9, '남쪽 0.7');
  assert.deepEqual(worldOf('coast').flowAt(1000, 320), [0, 0]); assert.deepEqual(worldOf('lake').flowAt(0, 0), [0, 0]);
  assert.equal(REGIONS.sea.currents.length, 3);
  // 실제로 밀려요: 돛도 노도 없이 가만히 있으면 흐름 쪽으로 떠가요
  const S = seaShip(); G.undock(S); S.boat.x = 1000; S.boat.y = 320; S.boat.sailLevel = 0; S.boat.row = false; S.food = 100; S.water = 10;
  const x0 = S.boat.x; for (let i = 0; i < 30 * 10; i++) { G.step(S, G.FIXED_DT); S.hull = 1; } S.events.length = 0;
  assert.ok(S.boat.x > x0 + 1, `동쪽으로 ${S.boat.x - x0}m`);
});

test('B1 무풍: 하루 내내 바람 × 0.15, 큰 바다 목록에만 있고 스쿠너 기관이 돌아요', () => {
  assert.ok(WX.calm && WX.calm.fx.wind === 0.15 && WX.calm.sev === 1 && WX.calm.when === 'day');
  assert.ok(REGIONS.sea.weather.includes('calm') && !REGIONS.coast.weather.includes('calm') && !REGIONS.river.weather.includes('calm'));
  const seed = 3, d = dayWith(seed, (q) => q.calm && q.gust === null && q.storm === null && q.squall === null), clk = d * CAL.day + 90;
  assert.deepEqual(G.kindsOf('sea', G.dayWeather(seed, d)).includes('calm'), true); assert.equal(G.kindsOf('coast', G.dayWeather(seed, d)).includes('calm'), false);
  const wx = G.weatherAt('sea', seed, clk); assert.ok(wx.on.includes('calm')); assert.ok(Math.abs(wx.fx.windDown - 0.15) < 1e-9);
  const S = seaShip(seed); S.clock = clk; S.weather = wx;
  const calmWind = G.windNow(S, wx).speed, normal = dayWith(seed, (q) => !q.calm && q.gust === null && q.storm === null && q.squall === null && !q.seafog), W2 = G.weatherAt('sea', seed, normal * CAL.day + 90);
  assert.ok(calmWind < G.windNow(S, W2).speed * 0.2, `무풍 바람 ${calmWind}`);
  // 스쿠너 기관
  G.undock(S); S.food = 100; S.water = 10; S.crew = Array.from({ length: 3 }, (_, i) => ({ id: 80 + i, role: 'deckhand', name: `x${i}`, wage: 0, baseWage: 0, lv: 1, xp: 0, fatigue: 0, morale: 0.9, trait: 'diligent' }));
  S.boat.x = 0; S.boat.y = 600; S.boat.sailLevel = 2; S.boat.sailNow = 1;
  let motor = false; for (let i = 0; i < 30 * 20; i++) { G.step(S, G.FIXED_DT); S.hull = 1; S.vigor = 1; S.clock = clk + i / 30; if (S.boat.motor) motor = true; }
  assert.ok(motor, '기관이 돌아요');
});

test('B1 rangeDays: min(식량 일수, 식수 일수), 조수기는 하루 생산량을 빼고, 민물은 식량만', () => {
  const S = seaShip(); S.crew = []; S.food = 10; S.water = 6;
  assert.equal(G.rangeDays(S), 6);                       // 식수 6통 ÷ 하루 1통
  S.water = 30; assert.equal(G.rangeDays(S), 10);        // 식량 10개 ÷ 하루 1개
  S.crew = Array.from({ length: 1 }, (_, i) => ({ id: 80 + i, role: 'deckhand', name: `x${i}`, wage: 0, baseWage: 0, lv: 1, xp: 0, fatigue: 0, morale: 0.9, trait: 'diligent' }));
  S.food = 10; S.water = 6; assert.equal(G.rangeDays(S), 3); // 2명: 식량 5일, 식수 3일
  S.ship.mods.push({ id: 'desal', col: 0, row: 0, rot: 0 }); S.rev++;
  assert.ok(G.stats(S).desal > 0, '조수기가 있어야 이 검사가 뜻이 있어요');
  assert.equal(G.rangeDays(S), 5, '조수기 하루 2통 = 2명이 마시는 양 → 식량이 한계');
  const L = seaShip(); L.region = 'lake'; L.food = 12; L.crew = []; L.water = 0; assert.equal(G.rangeDays(L), 12, '민물 수역은 식수가 무한');
  assert.equal(G.foodDays(L), 12);
});

test('B1 항해 계획: 가는 데 n일 · 실은 것 m일, n > m×0.8 주황 · n > m 빨강', () => {
  const S = seaShip(); const d = worldOf('sea').ports[1];
  const base = G.tripPlan(S, d.x, d.y); assert.ok(base && base.len > 1500 && base.n > 0, `길이 ${base?.len}`);
  assert.equal(base.n, G.tripDays(S, base.len)); assert.ok(base.len >= Math.hypot(d.x - S.boat.x, d.y - S.boat.y) - 1, '항로는 직선보다 길거나 같아요');
  S.crew = []; S.water = 999; S.ship.mods.push({ id: 'desal', col: 0, row: 0, rot: 0 });
  for (const [m, level] of [[base.n * 2, 'ok'], [base.n * 1.1, 'warn'], [base.n * 0.9, 'bad'], [base.n * 0.5, 'bad']]) { S.food = m; assert.equal(G.tripPlan(S, d.x, d.y).level, level, `${m.toFixed(2)}일치 → ${level}`); }
});

test('B1 출항 점검: 무풍 날 안내, 가까운 항구까지 항속이 모자라면 경고(출항은 막지 않아요)', () => {
  const seed = 3, d = dayWith(seed, (q) => q.calm && q.gust === null && q.storm === null), S = seaShip(seed);
  S.clock = d * CAL.day + 100; S.weather = G.weatherAt('sea', seed, S.clock);
  S.food = 200; S.water = 12; S.crew = [];
  let r = G.departureCheck(S, 2);
  assert.ok(r.warns.some((t) => t.includes('무풍')), r.warns.join('|'));
  assert.ok(!r.warns.some((t) => t.includes('가장 가까운 항구')), '식량·식수가 넉넉하면 항속 경고가 없어요');
  S.food = 0.4; S.water = 0.4; r = G.departureCheck(S, 2); // 하루는 180초예요: 스쿠너는 가장 가까운 항구까지 0.6일쯤 걸려요
  assert.ok(r.warns.some((t) => t.includes('가장 가까운 항구')), r.warns.join('|'));
  assert.ok(r.ok, '경고일 뿐 막지는 않아요(식수가 아예 없을 때만 막아요)');
  // 앞바다에서는 항속 경고를 따로 만들지 않아요(항구가 가까워요)
  const C = coastShip('schooner'); C.food = 0.4; C.water = 0.4; assert.ok(!G.departureCheck(C, 2).warns.some((t) => t.includes('가장 가까운 항구')));
});

// ── B2 태풍 ──
import { TYPHOON } from '../data.js';
import { readFileSync } from 'node:fs';
const typhoonDay = (seed, pred = () => true, from = 1) => dayWith(seed, (q) => q.typhoon && pred(q.typhoon), from);

test('B2 태풍 경로: 같은 시드·날짜면 같은 경로, 여름·가을에만, 들어오기 전엔 안 보여요', () => {
  const seed = 2, d = typhoonDay(seed), a = G.dayWeather(seed, d).typhoon, b = G.dayWeather(seed, d).typhoon;
  assert.deepEqual(a, b); assert.deepEqual(G.typhoonTrack('sea', a), G.typhoonTrack('sea', b));
  assert.ok(a.side === -1 || a.side === 1); assert.ok(a.t0 >= TYPHOON.enter[0] * CAL.day - 1e-9 && a.t0 <= TYPHOON.enter[1] * CAL.day + 1e-9);
  for (let day = 0; day < 140; day++) { const q = G.dayWeather(seed, day).typhoon; if (q) assert.ok([...Array(7).keys()].some((i) => G.clock({ clock: day * CAL.day }).season.id !== 'spring') && G.clock({ clock: day * CAL.day }).season.id !== 'winter', `계절 ${day}`); }
  // 시작점은 서쪽·동쪽 끝 밖 300m, 지나는 점은 지도 가운데 60% 안
  const T = G.typhoonTrack('sea', a), sh = REGIONS.sea.shape;
  assert.equal(T.sx, a.side < 0 ? sh.x0 - 300 : sh.x1 + 300);
  const [mx, my] = G.typhoonPos('sea', a, 75); assert.ok(Math.abs(mx) <= 0.3 * 4000 + 1e-6 && Math.abs(my) <= 0.3 * 3200 + 1e-6, `가운데 ${mx},${my}`);
  // 살아 있는 때: t0 ~ t0+150. 하루(180초)를 넘겨 다음 날 새벽까지 이어질 수 있어요
  const day0 = d * CAL.day;
  assert.equal(G.liveTyphoon('sea', seed, day0 + a.t0 - 1), null); assert.ok(G.liveTyphoon('sea', seed, day0 + a.t0 + 1)); assert.equal(G.liveTyphoon('sea', seed, day0 + a.t0 + 151)?.day === d, false);
  if (a.t0 + TYPHOON.cross > CAL.day) assert.equal(G.liveTyphoon('sea', seed, day0 + CAL.day + 1)?.day, d, '다음 날 새벽까지 이어져요');
  assert.equal(REGIONS.sea.weather[0], 'typhoon');
});

test('B2 태풍 효과: 눈·폭풍 원·바깥 원의 바람·너울·비와 거리별 세기, 중심을 도는 바람', () => {
  const seed = 2, d = typhoonDay(seed), tr = G.dayWeather(seed, d).typhoon, clk = d * CAL.day + tr.t0 + 75, [cx, cy] = G.typhoonPos('sea', tr, 75);
  const at = (dx, dy = 0) => G.typhoonAt('sea', seed, clk, cx + dx, cy + dy);
  const eye = at(40), storm = at(300), outer = at(1000), far = at(1400);
  assert.equal(eye.zone, 'eye'); assert.equal(eye.windDown, 0.2); assert.equal(eye.swell, 1.5); assert.equal(eye.rain, 0);
  assert.equal(storm.zone, 'storm'); assert.equal(storm.windUp, 2.6); assert.equal(storm.swell, 2.4); assert.equal(storm.rain, 1); assert.equal(+storm.strain.toFixed(4), 0.125); assert.equal(storm.sight, 0.5);
  assert.equal(outer.zone, 'outer'); assert.ok(outer.windUp > 1 && outer.windUp < REGIONS.sea.stormK); assert.ok(outer.swell > 0 && outer.swell < REGIONS.sea.swell.storm);
  const near = at(700), mid = at(1200); assert.ok(near.windUp > mid.windUp && mid.windUp > 1, '거리가 멀수록 약해요');
  assert.equal(far.zone, null); assert.equal(far.windUp, 1);
  // 반시계: 중심 동쪽 점은 북쪽으로 부는 바람(바람이 오는 쪽 = 남쪽 = +y), 북쪽 점은 서쪽으로 부는 바람(오는 쪽 = 동쪽)
  assert.ok(Math.abs(Math.cos(storm.from)) < 1e-9 && Math.sin(storm.from) > 0.99, '동쪽: 남쪽에서 불어와요(북쪽으로 향함)');
  const nor = at(0, -300); assert.ok(Math.cos(nor.from) > 0.99, '북쪽: 동쪽에서 불어와요(서쪽으로 향함)');
  assert.equal(G.typhoonAt('sea', seed, d * CAL.day + tr.t0 - 5, cx, cy), null, '아직 안 왔어요');
  // 배가 원 안이면 바람은 크고 도는 방향, 너울·비가 더해져요
  const S = seaShip(seed); S.clock = clk; G.undock(S); S.boat.x = cx + 300; S.boat.y = cy;
  G.step(S, G.FIXED_DT);
  assert.equal(S.weather.ty.zone, 'storm'); assert.ok(S.weather.fx.swell >= 2.4 + REGIONS.sea.swell.base && S.weather.rain && S.weather.fx.strain >= 0.125 && S.weather.fx.sight <= 0.5);
  assert.ok(S.wind.speed > REGIONS.sea.wind.speed * 2, `바람 ${S.wind.speed}`);
});

test('B2 항구에 대 있으면 태풍 효과가 없어요(대피), 항구에서 기다리면 피해 0', () => {
  const seed = 2, d = typhoonDay(seed), tr = G.dayWeather(seed, d).typhoon, clk = d * CAL.day + tr.t0 + 75, [cx, cy] = G.typhoonPos('sea', tr, 75);
  const S = seaShip(seed); S.clock = clk; const w = worldOf('sea'), p = w.ports[1];
  assert.equal(S.docked, 'southLight'); S.boat.x = cx; S.boat.y = cy; // 항구에 있는 채로 눈 한가운데로 옮겨 봐도(검사용) 효과가 없어요
  const h0 = S.hull, wx0 = JSON.stringify(S.weather.fx);
  for (let i = 0; i < 60; i++) G.step(S, G.FIXED_DT);
  assert.equal(S.hull, h0); assert.equal(JSON.stringify(S.weather.fx), wx0); assert.equal(S.weather.ty, undefined);
  assert.ok(p.id === 'depot');
  // 기다리면(waitDay) 시계만 흘러요
  const L = seaShip(seed); L.clock = d * CAL.day + 10; assert.ok(G.typhoonLeft(L) > 0); let n = 0; while (G.typhoonLeft(L) > 0 && n++ < 5) G.waitDay(L);
  assert.equal(G.typhoonLeft(L), 0); assert.equal(L.hull, 1);
});

test('B2 태풍 예보: 기본 2일 앞, 기압계 +1, 측후소 +2. 담수·앞바다엔 안 와요', () => {
  const seed = 2, d = typhoonDay(seed, () => true, 4);
  const at = (ahead, mods = []) => { const S = seaShip(seed); S.clock = (d - ahead) * CAL.day + 5; S.ship.mods.push(...mods); S.rev++; return S; };
  const seen = (S) => G.outlook(S).findIndex((q) => q.ids.includes('typhoon'));
  assert.equal(seen(at(2)), 2, '기본 2일 전부터'); assert.equal(seen(at(3)), -1, '3일 전엔 안 보여요');
  const baro = { id: 'barometer', col: 0, row: 0, rot: 0 }, stn = { id: 'station', col: 0, row: 1, rot: 0 };
  assert.equal(G.stats(at(3, [baro])).typhoonAhead, 3); assert.equal(seen(at(3, [baro])), 3, '기압계 +1일');
  assert.equal(G.stats(at(4, [baro, stn])).typhoonAhead, 5); assert.equal(G.stats(at(2, [stn])).typhoonAhead, 4, '측후소 +2일');
  // 예보 칸의 빈 날은 모르는 날(blind)이에요
  const o = G.outlook(at(2)); assert.ok(o.length >= 3 && o[2].blind && o[2].worst === 'typhoon');
  // 점검 안내
  assert.ok(G.departureCheck(at(2), 2).warns.some((t) => t.includes('태풍이 2일 뒤')));
  const T = seaShip(seed); T.clock = d * CAL.day + 5; assert.ok(G.departureCheck(T, 2).warns.some((t) => t.includes('오늘 태풍')));
  // 담수·앞바다엔 안 와요
  for (const region of ['pond', 'lake', 'river', 'coast']) { assert.equal(G.kindsOf(region, G.dayWeather(seed, d)).includes('typhoon'), false, region); assert.equal(G.weatherAt(region, seed, d * CAL.day + 70).typhoonOn, false, region); assert.equal(REGIONS[region].weather.includes('typhoon'), false); }
  assert.ok(G.kindsOf('sea', G.dayWeather(seed, d)).includes('typhoon') && G.kindsOf('sea', G.dayWeather(seed, d))[0] === 'typhoon');
});

test('B2 태풍 세 단계와 typhoonSafe: 원에서 멀리 있으면 전조·피해 없이 넘기고 도전과제, 원 안에 있으면 피해', () => {
  // 지도 한구석이 늘 가장 멀어요. 태풍 경로에서 바깥 원보다 먼 자리가 있는 날을 찾아요
  const w = worldOf('sea'); let pick = null;
  for (let seed = 1; seed <= 40 && !pick; seed++) for (let d = 1; d < 120 && !pick; d++) {
    const dw = G.dayWeather(seed, d), tr = dw.typhoon; if (!tr || dw.bigswell || dw.storm !== null || dw.gust !== null) continue;
    for (const [bx, by] of [[-1900, 1500], [1900, 1500], [-1900, -1500], [1900, -1500]]) {
      let m = 1e9; for (let s = 0; s <= 150; s += 5) { const [cx, cy] = G.typhoonPos('sea', tr, s); m = Math.min(m, Math.hypot(bx - cx, by - cy)); }
      if (m > TYPHOON.outer + 200 && w.isWater(bx, by) && w.dist(bx, by) > 20) { pick = { seed, d, tr, bx, by }; break; }
    }
  }
  assert.ok(pick, '피할 구석이 있는 태풍');
  const { seed, d, tr, bx, by } = pick, S = seaShip(seed); G.undock(S); S.boat.x = bx; S.boat.y = by; S.food = 500; S.water = 20; S.clock = d * CAL.day + tr.t0 - 40;
  const kinds = new Set();
  for (let i = 0; i < 30 * 260; i++) { G.step(S, G.FIXED_DT); for (const e of S.events) kinds.add(e.type); S.events.length = 0; S.vigor = 1; S.boat.stamina = 1; S.boat.x = bx; S.boat.y = by; S.boat.spd = 0; }
  assert.ok(kinds.has('typhoonSoon'), '전조'); assert.ok(!kinds.has('typhoonNear') && !kinds.has('typhoonIn')); assert.ok(kinds.has('typhoonDone'));
  assert.equal(S.stats.typhoons, 1); assert.equal(S.stats.typhoonHurt || 0, 0); assert.ok(S.ach.typhoonSafe); // (가장자리 너울·돌풍 피해는 태풍 피해가 아니라 typhoonHurt 0으로 확인해요)
  assert.ok(ACHIEVEMENTS.some((a) => a.id === 'typhoonSafe' && a.coin === 40));
  // 같은 태풍을 한가운데서 맞으면 고비(near)·파국(in)이 차례로 오고 피해가 나요(도전과제 없음)
  const R = seaShip(seed); G.undock(R); R.food = 500; R.water = 20; R.clock = d * CAL.day + tr.t0 + 1;
  const [c0x, c0y] = G.typhoonPos('sea', tr, 75); R.boat.x = c0x; R.boat.y = c0y; R.boat.sailLevel = 0;
  const order = []; for (let i = 0; i < 30 * 160; i++) { G.step(R, G.FIXED_DT); for (const e of R.events) if (!order.includes(e.type) && e.type.startsWith('typhoon')) order.push(e.type); R.events.length = 0; R.vigor = 1; R.boat.stamina = 1; R.boat.x = c0x; R.boat.y = c0y; if (R.disaster) break; }
  assert.ok(order.includes('typhoonIn'), order.join(',')); assert.ok(R.hull < 1 || R.disaster, '원 안에서는 배가 상해요(기존 체계)');
});

test('B2 index.html 모듈 스크립트가 문법 오류 없이 읽혀요(브라우저를 못 띄우는 환경의 방어선)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), m = html.match(/<script type="module">([\s\S]*?)<\/script>/g);
  assert.ok(m && m.length === 1);
  const code = m[0].replace(/^<script type="module">/, '').replace(/<\/script>$/, '').replace(/^import [^;]*;\s*$/gm, '');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(code), 'index.html 문법');
});

// ── B3 큰 바다 내용: 재료·발견지·생물·표류물·교역·도전과제 ──
import { ITEMS, WORKSHOP, SPECIES, MAT_IDS, TIDE } from '../data.js';
import { createCreatures } from '../creatures.js';
const SEA_FINDS = ['volcanoRim', 'reefLagoon', 'expWreck', 'turtleBeach', 'seaArch', 'islandFalls', 'oldStation', 'glassFloats', 'farLight', 'palmShrine'];
const SEA_SPECIES = ['flyingfish', 'tuna', 'shark', 'manta', 'albatross', 'frigatebird', 'shearwater', 'coconutcrab'];
const NEW_MATS = ['teak', 'synth', 'syrope', 'steel', 'chip'];

test('B3 발견지 10곳: 시드 1~8마다 자리가 유효하고(경계 70m·항구 45m·서로 40m), 무인 등대는 고정이에요', () => {
  const w = worldOf('sea'), fixed = REGIONS.sea.finds.find((f) => f.fixed);
  assert.deepEqual(REGIONS.sea.finds.map((f) => f.id), SEA_FINDS);
  assert.equal(fixed.id, 'farLight');
  const base = w.finds.find((f) => f.id === 'farLight');
  assert.ok(Math.hypot(base.x - 900, base.y + 1200) < 45, '작은 섬 위');
  const spots = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const S = G.newGame(seed); S.region = 'sea';
    const list = G.findsOf(S, 'sea');
    assert.equal(list.length, 10);
    list.forEach((f, i) => {
      assert.equal(f.id, SEA_FINDS[i]);
      if (f.id === 'farLight') { assert.equal(f.x, base.x); assert.equal(f.y, base.y); return; } // 고정
      assert.ok(w.edgeDist(f.x, f.y) >= 70, `${seed} ${f.id} 경계`);
      for (const q of [...w.ports, ...w.gates]) assert.ok(Math.hypot(q.x - f.x, q.y - f.y) > 45, `${seed} ${f.id} 항구 ${q.id}`);
      const def = REGIONS.sea.finds[i], d = w.dist(f.x, f.y);
      if (def.where === 'water') assert.ok(d > 12 - 1e-9, `${seed} ${f.id} 물 위`);
      else if (def.inland) assert.ok(Math.abs(-w.landDist(f.x, f.y) - def.inland) < 9, `${seed} ${f.id} 내륙 ${def.inland}m (${w.landDist(f.x, f.y).toFixed(1)})`);
      else assert.ok(d <= 5 && d >= -9, `${seed} ${f.id} 물가 ${d.toFixed(1)}`);
      spots.add(`${f.id}:${Math.round(f.x)},${Math.round(f.y)}`);
      list.forEach((g, j) => { if (j !== i && g.id !== 'farLight') assert.ok(Math.hypot(g.x - f.x, g.y - f.y) > 40 - 1e-9, `${seed} ${f.id}-${g.id} 간격`); });
    });
  }
  assert.ok(spots.size > 10, '판마다 자리가 달라요');
  // 보상: PLAN 표 그대로(설계도 2장, 최고급 재료)
  const F = Object.fromEntries(REGIONS.sea.finds.map((f) => [f.id, f]));
  assert.deepEqual([F.expWreck.blueprint, F.oldStation.blueprint], ['explorer', 'station']);
  assert.equal(F.expWreck.teak, 40); assert.equal(F.expWreck.steel, 8); assert.equal(F.oldStation.chip, 2); assert.equal(F.volcanoRim.steel, 6);
  assert.equal(F.expWreck.size, 1.6);
  // 장면 배치: 새 그림 6종이 표지로 서고, 등대는 발견지가 곧 불빛 표지예요(둘이 겹쳐 서지 않아요)
  const marks = sceneLayout('sea');
  for (const art of ['volcano', 'reef', 'turtlebeach', 'arch', 'falls', 'glassfloat']) assert.ok(marks.marks.some((m) => m.kind === art && m.find), art);
  assert.equal(marks.marks.filter((m) => m.kind === 'lighthouse' && m.lamp).length, 2, '남쪽 등대 + 무인 등대');
  assert.ok(marks.marks.some((m) => m.find?.id === 'farLight' && m.lamp));
  // 임시 발견지 3곳은 정식 발견지로 바뀌었어요
  for (const old of ['seaFall', 'seaCrater', 'seaLagoon']) assert.ok(!REGIONS.sea.finds.some((f) => f.id === old), old);
});

test('B3 발견지를 찾으면 보상·설계도·유물을 받고, 10곳을 다 찾으면 seaIsles', () => {
  const S = seaShip(3); G.undock(S); drain(S);
  const list = G.findsOf(S, 'sea'), coin0 = S.res.coin, wreck = list.find((f) => f.id === 'expWreck');
  for (let i = 0; i < 20; i++) { S.boat.x = wreck.x; S.boat.y = wreck.y; S.boat.spd = 0; S.food = 500; S.water = 20; G.step(S, G.FIXED_DT); }
  assert.ok(S.found.expWreck); assert.equal(S.res.teak, 40); assert.equal(S.res.steel, 8); assert.equal(S.res.coin, coin0 + 80);
  assert.ok(S.blueprints.explorer && S.relics.expWreck); assert.ok(!S.ach.seaIsles);
  for (const f of list) S.found[f.id] = 1;
  G.checkAch(S);
  assert.ok(S.ach.seaIsles); assert.ok(ACHIEVEMENTS.some((a) => a.id === 'seaIsles' && a.coin === 60));
  assert.ok(S.blueprints.explorer);
});

test('B3 재료 5종: 창고 기본 0, 공방 최고급 짝(전자 부품 제외), 큰 바다 가게(shop:false·buyPort)', () => {
  for (const k of NEW_MATS) assert.equal(G.newGame(1).res[k], 0, k);
  const spec = { teak: [3, 4, 12, 'wood'], synth: [3, 6, 16, 'cloth'], syrope: [3, 5, 14, 'rope'], steel: [3, 8, 22, 'metal'], chip: [3, 12, 40, 'mech'] };
  for (const [k, [tier, sell, buy, fam]] of Object.entries(spec)) { const I = ITEMS[k]; assert.deepEqual([I.tier, I.sell, I.buy, I.fam], [tier, sell, buy, fam], k); assert.ok(MAT_IDS.includes(k)); }
  assert.equal(ITEMS.chip.buyPort, 'depot');
  assert.deepEqual([WORKSHOP.pairs.oak, WORKSHOP.pairs.canvas, WORKSHOP.pairs.tar, WORKSHOP.pairs.plate], ['teak', 'synth', 'syrope', 'steel']);
  assert.equal(Object.values(WORKSHOP.pairs).includes('chip'), false, '전자 부품은 공방으로 못 만들어요');
  // 옛 저장(v7): 새 재료 칸이 0으로 채워져요
  const o = JSON.parse(G.serialize(seaShip())); o.v = 7; for (const k of NEW_MATS) delete o.res[k];
  const T = G.deserialize(JSON.stringify(o)); for (const k of NEW_MATS) assert.equal(T.res[k], 0, k);
  // 공방: 참나무 3개 + 6닢 → 티크 1개(항구에서만)
  const S = seaShip(); S.res.oak = 7; S.res.coin = 100; S.res.plate = 3; S.res.tar = 3; S.res.canvas = 3;
  assert.equal(G.craft(S, 'oak', 2), 2); assert.equal(S.res.teak, 2); assert.equal(S.res.oak, 1); assert.equal(S.res.coin, 100 - 12);
  assert.equal(G.craft(S, 'plate', 1), 1); assert.equal(S.res.steel, 1); assert.equal(G.craft(S, 'tar', 1), 1); assert.equal(G.craft(S, 'canvas', 1), 1); assert.equal(G.craft(S, 'gear', 1), 0);
  // 가게: 큰 바다 항구는 최고급을 팔아요. 전자 부품은 보급항만, 야자섬 나루(shop:false)는 재료 가게가 없어요
  const at = (port) => { const R = seaShip(); R.docked = port; R.res.coin = 500; return R; };
  for (const port of ['southLight', 'depot', 'rockVillage']) for (const k of ['teak', 'synth', 'syrope', 'steel']) { const R = at(port); assert.ok(G.canBuyMat(R, k), `${port} ${k}`); assert.equal(G.buyMat(R, k, 2), 2); assert.equal(R.res[k], 2); assert.equal(R.res.coin, 500 - 2 * ITEMS[k].buy); }
  assert.ok(G.canBuyMat(at('depot'), 'chip')); assert.equal(G.buyMat(at('depot'), 'chip', 1), 1);
  for (const port of ['southLight', 'rockVillage', 'palm']) assert.equal(G.canBuyMat(at(port), 'chip'), false, `${port} chip`);
  for (const k of ['wood', 'hemp', 'nail', 'teak', 'steel', 'chip']) { const R = at('palm'); assert.equal(G.canBuyMat(R, k), false, `palm ${k}`); assert.equal(G.buyMat(R, k, 1), 0); assert.equal(R.res.coin, 500); }
  // 앞바다·강·호수 항구에서는 큰 바다 재료를 못 사요
  const C = coastShip(); C.res.coin = 500; assert.ok(C.docked); for (const k of NEW_MATS) assert.equal(G.canBuyMat(C, k), false, `coast ${k}`);
  assert.ok(G.canBuyMat(C, 'gear'), '앞바다 재료는 그대로 팔아요');
  // 팔기는 야자섬에서도 돼요
  const P = at('palm'); P.res.teak = 3; assert.equal(G.sell(P, 'teak', 3) >= 12, true);
});

test('B3 표류물·교역 표: 한도 36, 새 재료가 떠다니고 물통·반짝이는 곳은 그대로, 향신료·비단을 찾아요', () => {
  const f = REGIONS.sea.flot, t = Object.fromEntries(f.table.map(([k, wgt, a, b]) => [k, [wgt, a, b]]));
  assert.equal(f.cap, 36);
  assert.deepEqual([t.wood[0], t.oak[0], t.teak[0], t.net[0], t.syrope[0], t.plate[0], t.steel[0], t.gear[0], t.water[0], t.shiny[0]], [1, 1.5, 0.8, 2, 0.8, 1, 0.4, 0.5, 3, 6]);
  assert.deepEqual([t.water[1], t.water[2], t.shiny[1], t.shiny[2]], [2, 3, 1, 2]);
  for (const [k] of f.table) assert.ok(ITEMS[k] || ['net', 'water', 'shiny'].includes(k), k);
  const tr = Object.fromEntries(REGIONS.sea.trade);
  assert.deepEqual([tr.porcelain, tr.silk, tr.painting, tr.spice], [3, 4, 1.2, 2]); assert.deepEqual(REGIONS.sea.demand, ['spice', 'silk']);
  // 티크·합성 로프·강판은 건져서 화물칸에 담겨요
  const S = seaShip(); G.undock(S); drain(S); S.food = 500; S.water = 20;
  const fl = G.flotsamOf(S); fl.length = 0; fl.push({ x: S.boat.x, y: S.boat.y, k: 'teak', n: 2, ph: 0 }, { x: S.boat.x, y: S.boat.y, k: 'syrope', n: 1, ph: 0 }, { x: S.boat.x, y: S.boat.y, k: 'steel', n: 1, ph: 0 });
  const bx = S.boat.x, by = S.boat.y; for (let i = 0; i < 20; i++) { S.boat.x = bx; S.boat.y = by; S.boat.spd = 0; G.step(S, G.FIXED_DT); } assert.deepEqual([S.hold.teak, S.hold.syrope, S.hold.steel], [2, 1, 1]);
});

test('B3 생물 8종: 큰 바다 도감, 야자집게는 밀물에도 남고, 박물학자 도전과제', () => {
  assert.deepEqual(Object.keys(SPECIES).filter((id) => SPECIES[id].region === 'sea'), SEA_SPECIES);
  const kinds = Object.fromEntries(SEA_SPECIES.map((id) => [id, SPECIES[id].kind]));
  assert.deepEqual(kinds, { flyingfish: 'flyfish', tuna: 'fish', shark: 'fin', manta: 'manta', albatross: 'bird', frigatebird: 'bird', shearwater: 'bird', coconutcrab: 'crab' });
  assert.equal(SPECIES.tuna.len, 1.2); assert.equal(SPECIES.tuna.school, 4); assert.equal(SPECIES.albatross.wing, 2.2); assert.equal(SPECIES.shearwater.wing, 1.2); assert.equal(SPECIES.coconutcrab.size, 1.6);
  assert.equal(SPECIES.coconutcrab.tide, undefined, '밀물에도 안 사라져요'); assert.equal(SPECIES.crab.tide, 'low');
  assert.ok(SEA_SPECIES.every((id) => SPECIES[id].sea));
  // 큰 바다 생물 칸은 앞바다 칸과 따로 세요
  const S = G.newGame(1); S.region = 'sea'; S.ship.mods.push({ id: 'telescope', col: 0, row: 3, rot: 0 });
  for (const id of Object.keys(SPECIES).filter((k) => SPECIES[k].region === 'coast')) G.recordSpecies(S, id);
  assert.ok(S.ach.seaAll); assert.ok(!S.ach.islandNaturalist);
  for (const id of SEA_SPECIES.slice(0, 7)) G.recordSpecies(S, id);
  assert.ok(!S.ach.islandNaturalist); G.recordSpecies(S, 'coconutcrab');
  assert.ok(S.ach.islandNaturalist); assert.ok(ACHIEVEMENTS.some((a) => a.id === 'islandNaturalist' && a.coin === 60));
  // 큰 바다에서 만나면 도감에 적혀요
  const R = G.newGame(2); assert.equal(G.recordSpecies(R, 'shark'), true); assert.equal(R.seen.shark, 1);
  // 야자집게는 높은 물때(밀물)에도 해변에 나타나요. 같은 자리에서 썰물 전용 게(앞바다)는 이 바다에 없어요
  const w = worldOf('sea'), cr = createCreatures(w);
  const tb = w.finds.find((f) => f.id === 'turtleBeach'), cam = { x: tb.x, y: tb.y, zoom: 8, cy: 200 };
  const seen = new Set();
  for (let i = 0; i < 4000; i++) { cr.update(0.2, cam, 400, 400, { x: -1100, y: 500, spd: 0 }, true, { tide: TIDE.amp, len: 14 }); for (const c of cr.list) seen.add(c.sp); }
  assert.ok(seen.has('coconutcrab'), `밀물에도 야자집게가 보여야 해요: ${[...seen]}`); assert.ok(!seen.has('crab'));
  for (const sp of seen) assert.equal(SPECIES[sp].region, 'sea', sp);
});

// ── B4 선원·모듈 ──
import { ROLES, MODULES } from '../data.js';
const mate = (id, role, extra = {}) => ({ id, role, name: `c${id}`, gender: '남', skill: 3, humor: 3, drink: 3, baseWage: ROLES[role].wage, wage: ROLES[role].wage, lv: 1, xp: 0, fatigue: 0, morale: 0.7, trait: 'diligent', ...extra });
// 스쿠너 + 지정 모듈 + 지정 선원(역할마다 맞는 자리에 앉아요)
function crewShip(mods, roles, seed = 1) {
  const S = seaShip(seed); S.ship.mods.push(...mods.map((m) => ({ rot: 0, ...m }))); S.rev++;
  S.crew = roles.map((r, i) => mate(100 + i, r)); S.crew.forEach((c) => { c.seat = undefined; }); G.autoSeat(S);
  return S;
}
const GALLEY = { id: 'galley', col: 0, row: 4 }, SICK = { id: 'sickbay', col: 4, row: 4 }, LOUNGE = { id: 'lounge', col: 0, row: 6 };

test('B4 역할 4개가 열리고 자리 3개(기관·조리·의무)가 생겨요', () => {
  for (const [id, region, wage, hire] of [['cook', 'coast', 2, 20], ['bosun', 'coast', 3, 30], ['engineer', 'coast', 3, 30], ['medic', 'sea', 3, 30]]) {
    const R = ROLES[id]; assert.ok(!R.future, id); assert.deepEqual([R.region, R.wage, R.hire], [region, wage, hire], id);
  }
  assert.ok(ROLES.weather.future && ROLES.mate.future);
  for (const id of ['galley', 'sickbay', 'lounge']) assert.ok(!MODULES[id].future && MODULES[id].need.grade === 4, id);
  assert.equal(MODULES.oar2.future, true);
  const S = crewShip([GALLEY, SICK], ['cook', 'engineer', 'medic']);
  const types = G.seatsOf(S).map((q) => q.type);
  for (const t of ['engine', 'cook', 'medic']) assert.ok(types.includes(t), t);
  assert.deepEqual(S.crew.map((c) => G.seatsOf(S).find((q) => q.key === c.seat)?.type), ['cook', 'engine', 'medic']);
  assert.ok(G.seatsOf(seaShip()).some((q) => q.key === 'engine'), '기관 자리는 모듈 없이 생겨요');
  assert.equal(G.seatsOf(G.newGame(1)).some((q) => q.type === 'engine'), false, '뗏목엔 기관 자리가 없어요');
  // 후보: 앞바다부터 요리사·갑판장·기관사, 큰 바다부터 의무원
  const at = (region) => { const S2 = seaShip(2); S2.region = region; const set = new Set(); for (let i = 0; i < 80; i++) { S2.cands = {}; S2.clock += 9999 * 180; S2.docked = region === 'sea' ? 'depot' : 'light'; for (const c of G.candidatesAt(S2)) set.add(c.role); } return set; };
  const coastRoles = at('coast'), seaRoles = at('sea');
  assert.ok(coastRoles.has('cook') && coastRoles.has('bosun') && coastRoles.has('engineer')); assert.ok(!coastRoles.has('medic'));
  assert.ok(seaRoles.has('medic'));
});

test('B4 요리사·조리실: 식량 소비 ×0.9, 요리사까지 앉으면 ×0.675, 하루 한 번 사기 +5%', () => {
  const none = crewShip([GALLEY], ['deckhand']), gal = crewShip([GALLEY], []), cook = crewShip([GALLEY], ['cook']);
  assert.equal(G.foodK(crewShip([], [])), 1); assert.ok(Math.abs(G.foodK(gal) - 0.9) < 1e-9); assert.ok(Math.abs(G.foodK(none) - 0.9) < 1e-9); assert.ok(Math.abs(G.foodK(cook) - 0.9 * 0.75) < 1e-9);
  const eatOver = (S) => { S.boat.x = 0; S.boat.y = 0; S.food = 20; S.water = 8; const f0 = S.food; for (let i = 0; i < 30 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.x = 0; S.boat.y = 0; S.boat.spd = 0; } return f0 - S.food; };
  G.undock(none); G.undock(cook);
  const a = eatOver(none), b = eatOver(cook);
  assert.ok(Math.abs(b / a - 0.75) < 0.03, `소비 비율 ${(b / a).toFixed(3)}`); // 요리사 효과 ×(1−0.25)
  // 사기: 하루에 한 번
  const T = crewShip([GALLEY], ['cook', 'deckhand']); G.undock(T); const m0 = T.crew[1].morale; T.crew.forEach((c) => { c.morale = 0.5; });
  for (let i = 0; i < 30 * 5; i++) { G.step(T, G.FIXED_DT); T.boat.x = 0; T.boat.y = 0; }
  assert.ok(T.crew[1].morale > 0.54 && T.crew[1].morale < 0.57, `하루 한 번 +5%: ${T.crew[1].morale}`); void m0;
});

test('B4 갑판장: 갑판원 효과 ×1.25, 돛 바꾸는 시간 절반, 돌풍 예고에 곧바로 돛을 줄여요', () => {
  const deck = crewShip([], ['deckhand']), both = crewShip([], ['deckhand', 'bosun']);
  const w0 = G.crewWork(deck, 'sail'), w1 = G.crewWork(both, 'sail');
  assert.ok(w0 > 0); assert.ok(Math.abs(w1 / w0 - 1.25) < 0.01, `비율 ${w1 / w0}`);
  // 돛 속도: 갑판장 자리에서 돛이 2배 빨리 펴져요
  const rate = (S) => { G.undock(S); S.boat.x = 0; S.boat.y = 0; S.boat.sailLevel = 2; S.boat.sailNow = 0; G.step(S, 0.2); return S.boat.sailNow; };
  const solo = crewShip([], ['deckhand']), boss = crewShip([], ['bosun']);
  assert.ok(Math.abs(rate(boss) / rate(solo) - 2) < 0.05, '절반 시간');
  // 돌풍 예고(gustSoon)에 축범: 갑판장은 즉시, 갑판원은 돌풍이 온 뒤에야
  const seed = 2, d = dayWith(seed, (q) => q.gust !== null && q.gust !== undefined && !q.storm && !q.typhoon, 5);
  const gustAt = G.dayWeather(seed, d).gust;
  const run = (role) => { const S = crewShip([], [role], seed); G.undock(S); S.boat.x = 0; S.boat.y = 0; S.food = 500; S.water = 20; S.boat.sailLevel = 2; S.boat.sailNow = 1; S.clock = d * CAL.day + gustAt - 40; let soonAt = -1; for (let i = 0; i < 30 * 70; i++) { G.step(S, G.FIXED_DT); S.boat.x = 0; S.boat.y = 0; S.boat.spd = 0; if (soonAt < 0 && S.weather.gustSoon) { soonAt = i; if (S.boat.sailLevel === 1) return 'early'; } } return S.boat.sailLevel === 1 ? 'late' : 'none'; };
  assert.ok(typeof gustAt !== 'undefined');
  assert.equal(run('bosun'), 'early'); assert.notEqual(run('deckhand'), 'early');
});

test('B4 기관사: 기관 ×1.15(3.2 → 3.68), 무풍 날엔 돛보다 기관이 먼저 돌아요', () => {
  const S = crewShip([], ['engineer'], 2), N = crewShip([], [], 2);
  assert.ok(Math.abs(G.roleWork(S, 'engineer') - 1) < 1e-9);
  const calm = dayWith(2, (q) => q.calm, 1);
  const topSpeed = (T) => { G.undock(T); T.clock = calm * CAL.day + 60; T.boat.x = 0; T.boat.y = 0; T.boat.h = 0; T.boat.sailLevel = 1; T.food = 500; T.water = 20; let m = 0; for (let i = 0; i < 30 * 50; i++) { G.step(T, G.FIXED_DT); T.boat.row = false; T.boat.sailLevel = 1; m = Math.max(m, T.boat.spd); if (T.boat.x > 600) T.boat.x = 0; T.boat.rudder = 0; } return m; };
  const a = topSpeed(N), b = topSpeed(S);
  assert.ok(a <= 3.25, `기관사 없음 ${a}`); assert.ok(b > a * 1.08 && b <= 3.2 * 1.15 + 0.05, `기관사 ${b} vs ${a}`);
});

test('B4 의무원: 기력 회복 ×1.5·피로 회복 ×1.5, 무더위 감소 ×0.6', () => {
  const none = crewShip([SICK], ['deckhand']), med = crewShip([SICK], ['medic', 'deckhand']);
  assert.ok(Math.abs(G.roleWork(med, 'medic') - 1) < 1e-9);
  const gain = (S) => { G.undock(S); S.boat.x = 0; S.boat.y = 0; S.food = 500; S.water = 20; S.vigor = 0.2; for (let i = 0; i < 30 * 10; i++) { G.step(S, G.FIXED_DT); S.boat.x = 0; S.boat.y = 0; S.boat.spd = 0; } return S.vigor - 0.2; };
  const a = gain(none), b = gain(med);
  assert.ok(Math.abs(b / a - 1.5) < 0.05, `회복 비율 ${(b / a).toFixed(3)}`);
  // 피로 회복: 쉬는 선원이 1.5배 빨리 풀려요
  const T = crewShip([SICK, { id: 'hammock', col: 1, row: 6 }], ['medic', 'cook']); G.undock(T);
  const U = crewShip([{ id: 'hammock', col: 1, row: 6 }], ['cook']); G.undock(U);
  T.crew[1].fatigue = 0.8; U.crew[0].fatigue = 0.8; T.crew[1].seat = null; U.crew[0].seat = null;
  for (let i = 0; i < 30 * 8; i++) { for (const X of [T, U]) { G.step(X, G.FIXED_DT); X.boat.x = 0; X.boat.y = 0; X.boat.spd = 0; } }
  assert.ok(0.8 - T.crew[1].fatigue > 1.3 * (0.8 - U.crew[0].fatigue), `피로 ${T.crew[1].fatigue} vs ${U.crew[0].fatigue}`);
});

test('B4 휴게실: 쉼 자리 2개·정원 +2, 쉬는 동안 사기 회복 ×2', () => {
  const S = crewShip([LOUNGE], []); const rest = G.seatsOf(S).filter((q) => q.type === 'rest'); assert.equal(rest.length, 2); assert.equal(new Set(rest.map((q) => q.key)).size, 2);
  assert.equal(G.stats(S).crewCap, 2);
  const hammock = crewShip([{ id: 'hammock', col: 0, row: 6 }], ['rower']); assert.equal(G.stats(hammock).crewCap, 1);
  const L = crewShip([LOUNGE], ['rower', 'rower']), H = crewShip([{ id: 'hammock', col: 0, row: 6 }, { id: 'hammock', col: 1, row: 6 }], ['rower', 'rower']);
  for (const X of [L, H]) { G.undock(X); X.crew.forEach((c) => { c.seat = null; }); X.crew.forEach((c) => { c.morale = 0.4; c.seat = G.seatsOf(X).find((q) => q.type === 'rest' && !X.crew.some((o) => o.seat === q.key))?.key ?? null; }); }
  assert.ok(L.crew.every((c) => c.seat) && H.crew.every((c) => c.seat));
  for (let i = 0; i < 30 * 10; i++) for (const X of [L, H]) { G.step(X, G.FIXED_DT); X.boat.x = 0; X.boat.y = 0; X.boat.spd = 0; X.food = 500; X.water = 20; }
  const gl = L.crew[0].morale - 0.4, gh = H.crew[0].morale - 0.4; assert.ok(gl > 1.8 * gh && gl < 2.2 * gh, `휴게실 ${gl} vs 해먹 ${gh}`);
});

test('B4 측후소: 예보 +4일(기압계 +2 대신), 설계도가 있어야 짓고, 태풍 예보는 +2일', () => {
  const S = seaShip(); assert.equal(G.stats(S).forecast, 1);
  const st = (m) => { const T = seaShip(); T.ship.mods.push({ ...m, rot: 0 }); return T; };
  assert.equal(G.stats(st({ id: 'barometer', col: 0, row: 0 })).forecast, 3);
  assert.equal(G.stats(st({ id: 'station', col: 0, row: 1 })).forecast, 5);
  assert.ok(!G.isUnlocked(S, 'station')); S.blueprints.station = 1; assert.ok(G.isUnlocked(S, 'station'));
  assert.deepEqual(MODULES.station.cost, { plate: 4, gear: 2, coin: 40 });
  const T = st({ id: 'station', col: 0, row: 1 }); assert.equal(G.stats(T).typhoonAhead, 4);
});

test('B4 옮겨 탈 때 선원이 남아요(정원 안), 정원이 줄 때만 숙련 낮은 사람부터 내려요, 바다 품삯 ×0.75', () => {
  const S = coastShip('sloop'); S.ship.hull = 'sloop2'; S.crew = [mate(1, 'deckhand', { lv: 3 }), mate(2, 'rower', { lv: 1 })];
  S.blueprints.schooner = 1; S.res = { ...S.res, oak: 300, canvas: 300, plate: 99, gear: 20, tar: 99, nail: 99, coin: 2000, wood: 99 }; G.dock(S, 'yard'); drain(S);
  assert.ok(G.buildHull(S, 'schooner').ok, JSON.stringify(G.buildStatus(S, 'schooner')));
  assert.deepEqual(S.crew.map((c) => c.id), [1, 2]); assert.ok(S.crew.every((c) => c.seat === undefined || c.seat === null || G.seatsOf(S).some((q) => q.key === c.seat)));
  // 정원이 줄 때(시험용으로 스쿠너 정원을 1로 낮춰요)
  const R = coastShip('sloop'); R.ship.hull = 'sloop2'; R.crew = [mate(1, 'deckhand', { lv: 1 }), mate(2, 'rower', { lv: 4 })];
  R.blueprints.schooner = 1; R.res = { ...R.res, oak: 300, canvas: 300, plate: 99, gear: 20, tar: 99, nail: 99, coin: 2000, wood: 99 }; G.dock(R, 'yard'); drain(R);
  const keep = HULLS.schooner.crew; HULLS.schooner.crew = 1;
  try { assert.ok(G.buildHull(R, 'schooner').ok); } finally { HULLS.schooner.crew = keep; }
  assert.deepEqual(R.crew.map((c) => c.id), [2], '숙련 높은 사람이 남아요'); assert.ok(drain(R).some((e) => e.type === 'crewLeft' && e.why === 'size'));
  // 바다 품삯: 같은 선원·같은 시간에 쌓이는 보수가 짠물 수역에서 0.75배
  const b = seaShip(); b.crew = [mate(1, 'deckhand', { wage: 4, baseWage: 4 })]; G.undock(b); b.owed = 0; b.food = 500; b.water = 20;
  for (let i = 0; i < 30 * 10; i++) { G.step(b, G.FIXED_DT); b.boat.spd = 0; }
  assert.ok(Math.abs(b.owed - 4 * 10 / CAL.day * 0.75) < 0.01, `짠물 품삯 ${b.owed}`);
  const fresh = G.newGame(1); fresh.region = 'river'; assert.equal(G.wageK(fresh), 1); assert.equal(G.wageK(b), 0.75);
});

// ── B5 대양 탐사선 ──
import { atlasBounds, pxOf } from '../art-ship.js';
import * as SH from '../ship.js';
import { HULL_TIERS } from '../data.js';
const EXP = [{ id: 'mast_l', col: 2, row: 3, rot: 0 }, { id: 'mast_d', col: 2, row: 9, rot: 0 }, { id: 'mast_m', col: 2, row: 15, rot: 0 }, { id: 'oar', col: 0, row: 12, rot: 0 }];
const rich5 = (S) => { S.res = { ...S.res, teak: 999, synth: 999, steel: 999, syrope: 999, chip: 99, oak: 999, canvas: 999, plate: 99, tar: 99, nail: 99, coin: 5000 }; };
function explorerShip(hull = 'explorer', seed = 1) {
  const S = seaShip(seed); S.ship.hull = hull; S.ship.mods = EXP.map((m) => ({ ...m })); S.rev++;
  S.blueprints.explorer = 1; S.cap.x = HULLS[hull].helmX; S.cap.at = 'helm'; return S;
}

test('B5 탐사선 선체 ★1~3: 칸 수·정원·내구도·값·기관·흘수·돛대 셋', () => {
  assert.deepEqual(['explorer', 'explorer2', 'explorer3'].map((id) => SH.validCells(id).length), [84, 116, 116]);
  const [a, b, c] = ['explorer', 'explorer2', 'explorer3'].map((id) => HULLS[id]);
  assert.deepEqual([a.crew, b.crew, c.crew], [12, 14, 16]); assert.deepEqual([a.hp, b.hp, c.hp], [400, 400, 520]);
  assert.deepEqual([a.len, b.len, c.len], [22, 27, 27]); assert.deepEqual([a.grade, a.yard, a.motor, a.draft, a.maxMasts, a.minCrew], [5, 5, 4.2, 1.3, 3, 6]);
  assert.deepEqual(a.price, { teak: 120, synth: 60, steel: 24, syrope: 30, chip: 6, coin: 400 }); assert.deepEqual(b.price, { teak: 140, synth: 60, steel: 20, coin: 320 });
  assert.deepEqual(c.price, { teak: 160, synth: 80, syrope: 40, steel: 30, chip: 4, coin: 450 });
  assert.equal(a.blueprint, 'explorer'); assert.equal(b.blueprint, undefined); assert.equal(c.perk, '항해 함교');
  assert.equal(HULL_TIERS[4].kind, 'explorer');
  assert.deepEqual(MODULES.mast_l.cost, { teak: 18, synth: 24, syrope: 8, steel: 4, coin: 30 }); assert.deepEqual([MODULES.mast_l.sail, MODULES.mast_l.mastH, MODULES.mast_l.boom, MODULES.mast_l.need.grade], [1.6, 19, 6.5, 5]);
  // 돛 넓이: 가장 큰 돛 + 나머지 × 0.85 = 1.6 + 0.85 × (1.35 + 1) ≈ 3.6
  const S = explorerShip(); const st = G.stats(S); assert.equal(st.motor, 4.2); assert.ok(Math.abs(st.sailArea - (1.6 + 0.85 * (1.35 + 1))) < 1e-9, `돛 ${st.sailArea}`); assert.ok(st.sailArea > 3.5 && st.sailArea < 3.7);
  assert.equal(st.draft >= 1.3, true);
});

test('B5 돛대 셋 규칙: 셋까지(MAST_GAP 3.6m 이상), 넷째는 many, 가까우면 near', () => {
  const d = { hull: 'explorer', mods: [] };
  for (const m of EXP.slice(0, 3)) { assert.equal(SH.mastProblem(d, m), null); d.mods.push(m); }
  assert.equal(SH.mastProblem(d, { id: 'mast_m', col: 4, row: 19, rot: 0 }), 'many');
  const e = { hull: 'explorer', mods: [EXP[0]] }; assert.equal(SH.mastProblem(e, { id: 'mast_m', col: 2, row: 6, rot: 0 }), 'near');
  assert.equal(SH.mastProblem({ hull: 'schooner', mods: [{ id: 'mast_m', col: 2, row: 2, rot: 0 }, { id: 'mast_d', col: 2, row: 7, rot: 0 }] }, { id: 'mast_m', col: 4, row: 12, rot: 0 }), 'many', '스쿠너는 둘까지');
  const S = explorerShip(); rich5(S); assert.ok(G.isUnlocked(S, 'mast_l')); assert.ok(!G.isUnlocked(seaShip(), 'mast_l'), '큰 주돛대는 5등급부터');
});

test('B5 탐사선 짓기: 보급항(조선소 5등급)에서만, 설계도·재료가 있어야 해요', () => {
  const S = seaShip(); S.ship.hull = 'schooner3'; S.rev++; rich5(S);
  G.dock(S, 'southLight'); drain(S);
  assert.match(G.buildHull(S, 'explorer').why, /설계도|조선|보급/);
  S.blueprints.explorer = 1; assert.equal(G.buildHull(S, 'explorer').ok, false, '남쪽 등대 항은 조선소 4등급');
  G.dock(S, 'depot'); drain(S); assert.equal(G.yardOf(S), 5);
  const miss = { ...S.res }; S.res.chip = 5; assert.equal(G.buildHull(S, 'explorer').ok, false, '전자 부품 6개가 모자라요'); S.res.chip = miss.chip;
  const crew = [mate(1, 'deckhand', { lv: 2 }), mate(2, 'cook')]; S.crew = crew;
  const r = G.buildHull(S, 'explorer'); assert.ok(r.ok, JSON.stringify(r));
  assert.equal(S.ship.hull, 'explorer'); assert.ok(S.ach.explorer); assert.equal(S.crew.length, 2, '정원 12 안이라 선원이 남아요');
  assert.equal(S.res.teak, 999 - 120); assert.equal(S.res.chip, 99 - 6);
  assert.ok(G.buildHull(S, 'explorer2').ok && G.buildHull(S, 'explorer3').ok); assert.ok(G.stats(S).hull.bridge);
  // 슬루프에서는 한 번에 올라갈 수 없어요
  const T = seaShip(); T.ship.hull = 'sloop'; T.blueprints.explorer = 1; rich5(T); G.dock(T, 'depot'); assert.equal(G.buildHull(T, 'explorer').ok, false);
});

test('B5 그림: 탐사선 ★1~3 아틀라스가 64방향 모두 칸 안에 들고, 배율은 10·8px/m', () => {
  for (const id of ['explorer', 'explorer2', 'explorer3']) {
    const b = atlasBounds({ hull: id, mods: EXP });
    assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= b.cell && b.y1 <= b.cell, `${id} ${JSON.stringify(b)}`); assert.ok(b.layer < b.cell / 2);
  }
  assert.equal(pxOf(HULLS.explorer), 10); assert.equal(pxOf(HULLS.explorer2), 8);
});

test('B5 보조 기관 4.2m/s와 기관 자리, 항해 함교(★3: 예보 +2일, 조타 자리에서 돛 바꾸기)', () => {
  const calm = dayWith(2, (q) => q.calm, 1), S = explorerShip('explorer', 2); G.undock(S);
  S.clock = calm * CAL.day + 60; S.boat.x = 0; S.boat.y = 0; S.boat.h = 0; S.food = 500; S.water = 20; let m = 0;
  for (let i = 0; i < 30 * 70; i++) { G.step(S, G.FIXED_DT); S.boat.sailLevel = 1; S.boat.row = false; m = Math.max(m, S.boat.spd); if (S.boat.x > 500) S.boat.x = 0; S.boat.rudder = 0; }
  assert.ok(m > 3.9 && m <= 4.25, `탐사선 기관 ${m}`);
  assert.ok(G.seatsOf(S).some((q) => q.type === 'engine' && Math.abs(q.x + 8.4) < 1e-9));
  // 함교
  const F = (hull) => { const T = explorerShip(hull); G.undock(T); T.cap.x = HULLS[hull].helmX; T.cap.at = 'helm'; T.crew = []; return T; };
  const a = F('explorer2'), b = F('explorer3');
  G.setSail(a, 2); G.setSail(b, 2);
  assert.ok(a.cap.to === 'mast', '함교 없는 배는 돛대까지 걸어가요'); assert.equal(a.boat.sailLevel, 0);
  assert.equal(b.cap.to, null); assert.equal(b.boat.sailLevel, 2, '함교: 조타 자리에서 바로');
  assert.equal(G.stats(b).forecast, G.stats(a).forecast + 2);
});

test('B5 강·호수 관문 maxGrade 4: 탐사선은 앞바다까지만, 스쿠너는 그대로', () => {
  const gates = [['pond', 'toLake'], ['lake', 'toRiver'], ['lake', 'toPond'], ['river', 'toLake'], ['coast', 'toRiver']];
  for (const [region, id] of gates) { const gate = worldOf(region).gates.find((g) => g.id === id); assert.equal(gate.maxGrade, 4, `${region}.${id}`); }
  for (const [region, id] of [['river', 'toSea'], ['coast', 'toSea'], ['sea', 'toCoast']]) assert.equal(worldOf(region).gates.find((g) => g.id === id).maxGrade, undefined, `${region}.${id}`);
  const S = coastShip('schooner3'); S.ship.hull = 'explorer'; S.rev++;
  const gate = worldOf('coast').gates.find((g) => g.id === 'toRiver');
  const st = G.gateStatus(S, gate); assert.equal(st.ok, false); assert.ok(st.list.some((q) => q.text.includes('배가 너무 커')));
  assert.equal(G.passGate(S, gate), false); assert.equal(S.region, 'coast');
  const T = coastShip('schooner3'); assert.equal(G.passGate(T, gate), true);
  // 앞바다 ↔ 큰 바다는 탐사선도 다녀요
  assert.equal(G.passGate(S, worldOf('coast').gates.find((g) => g.id === 'toSea')), true);
});

// ── B6 큰 바다 풍경 ──
import { BOX, markBoxes } from '../themes.js';
import { FX } from '../sound.js';
test('B6 큰 바다 풍경: 야자수·섬 항구 집이 판마다 항구·부두·관문·등대·발견지와 겹치지 않고 모두 뭍 위에 있다(시드 1~8)', () => {
  assert.equal(THEMES.sea.hut, 'seahut'); assert.ok(THEMES.sea.strict);
  const k = 0.62, box = (p) => { const [w, h] = BOX[p.kind], s = p.size || 1; return [p.x - w * s / 2, p.x + w * s / 2, p.y * k - h * s, p.y * k + 0.6]; };
  const hit = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
  const kinds = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const S = G.newGame(seed), L = sceneLayout('sea', G.findsOf(S, 'sea')), mb = markBoxes(L.marks), w = worldOf('sea');
    const land = L.props.filter((p) => !L.marks.includes(p));
    for (const p of land) { kinds.add(p.kind); for (let i = 0; i < mb.length; i++) assert.ok(!hit(box(p), mb[i]), `시드 ${seed}: ${p.kind} (${p.x | 0}, ${p.y | 0}) × ${L.marks[i].kind}`); assert.ok(w.landDist(p.x, p.y) < 0, `${p.kind} 뭍`); }
    for (const q of L.decals) for (const m of L.marks) assert.ok(Math.hypot(q.x - m.x, q.y - m.y) > q.r + 5, `시드 ${seed}: ${q.kind} × ${m.kind}`);
  }
  for (const kk of ['palm', 'palm2', 'islehut']) assert.ok(kinds.has(kk), `${kk} 이 한 번도 안 놓였어요`);
});
test('B6 소리: 섬 새소리는 효과음에 있고 두 소리 모두 틀려요(오프라인 컨텍스트 없이 호출만 확인)', () => {
  assert.equal(typeof FX.isleBird, 'function');
  const calls = []; const ac = { currentTime: 0, createOscillator: () => ({ type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() { calls.push(1); } }), createGain: () => ({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }) };
  FX.isleBird(ac, null, {}, 0, 0.1); FX.isleBird(ac, null, {}, 0, 0.9); assert.equal(calls.length, 4);
});

// ── B7 마감 ──
test('M4 O0 대양 어귀: 탐사선으로 넘으면 대양 마지막 등대에 닿고(oceanGate 100닢), 스쿠너로는 못 넘어요', () => {
  const gate = worldOf('sea').gates.find((g) => g.id === 'toOcean');
  assert.equal(gate.to, 'ocean'); assert.equal(gate.entry, 'lastLight');
  const T = seaShip(); assert.equal(G.passGate(T, gate), false); assert.equal(T.region, 'sea');
  const S = explorerShip(); S.region = 'sea'; G.undock(S); const c0 = S.res.coin; drain(S);
  assert.equal(G.passGate(S, gate), true); assert.equal(S.region, 'ocean'); assert.equal(S.docked, 'lastLight'); assert.ok(!S.ended);
  assert.ok(S.ach.oceanGate); assert.ok(S.res.coin >= c0 + 100); // 탐사선 도전과제 60닢이 함께 나올 수 있어요
  // 대양 남쪽 물목으로 돌아가면 큰 바다 보급항이에요
  const back = worldOf('ocean').gates.find((g) => g.id === 'toSea'); G.undock(S); assert.equal(G.passGate(S, back), true); assert.equal(S.region, 'sea'); assert.equal(S.docked, 'depot');
  // M3 엔딩을 본 옛 저장(v8, ended + 큰 바다)은 엔딩을 풀고 보급항에 대요
  const o = JSON.parse(G.serialize(explorerShip())); o.v = 8; o.region = 'sea'; o.ended = true; delete o.crossed;
  const L = G.deserialize(JSON.stringify(o)); assert.equal(L.ended, false); assert.equal(L.docked, 'depot'); assert.equal(L.v, 9); assert.equal(L.crossed, null); assert.equal(L.stats.crossDays, 0);
});
test('B7 저장 v8 호환: B4~B5가 저장 모양을 안 바꿔요(탐사선·역할 선원도 그대로 불러와져요)', () => {
  const S = explorerShip('explorer3'); S.crew = [mate(1, 'cook'), mate(2, 'medic')];
  const L = G.deserialize(G.serialize(S));
  assert.equal(L.v, 9); assert.equal(L.ship.hull, 'explorer3'); assert.equal(L.crew.length, 2); assert.equal(G.stats(L).forecast, G.stats(S).forecast);
});
