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
