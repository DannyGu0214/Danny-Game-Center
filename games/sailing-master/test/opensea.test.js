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
  S.ship = { hull, mods: hull === 'schooner' ? SCH : [{ id: 'mast_m', col: 1, row: 2, rot: 0 }, { id: 'oar', col: 1, row: 4, rot: 0 }], name: 'T', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
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
  assert.ok(REGION_ORDER.at(-1) === 'sea' && THEMES[REGIONS.sea.theme] && TITLES.length >= REGION_ORDER.length);
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
  assert.equal(T.v, 8); assert.equal(T.ended, false); assert.equal(T.region, 'coast'); assert.equal(T.docked, 'light'); assert.equal(T.route, null);
  assert.ok(T.ach.openSea); assert.equal(T.res.coin, 77, '금화를 다시 주지 않아요');
  assert.equal(T.stats.typhoons, 0); assert.equal(T.stats.typhoonHurt, 0); assert.equal(T.stats.calmDays, 0);
  // 엔딩 안 본 v7(앞바다 도중)은 그대로
  const p = JSON.parse(G.serialize(coastShip('schooner'))); p.v = 7; p.docked = 'yard';
  const U = G.deserialize(JSON.stringify(p));
  assert.equal(U.v, 8); assert.equal(U.region, 'coast'); assert.equal(U.docked, 'yard'); assert.equal(U.ended, false);
  // v8 왕복, 큰 바다 저장도 그대로 불러와요
  const sea = coastShip('schooner'); G.passGate(sea, worldOf('coast').gates.find((g) => g.id === 'toSea'));
  const R = G.deserialize(G.serialize(sea));
  assert.equal(R.region, 'sea'); assert.equal(R.docked, 'southLight'); assert.equal(R.v, 8);
});

test('B0 새 게임·새 저장 모양: v8, 태풍·무풍 통계 0, 도전과제 openSea는 큰 바다 도착이에요', () => {
  const S = G.newGame(1);
  assert.equal(S.v, 8); assert.deepEqual([S.stats.typhoons, S.stats.typhoonHurt, S.stats.calmDays], [0, 0, 0]);
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
