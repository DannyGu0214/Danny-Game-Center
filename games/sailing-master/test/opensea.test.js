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
