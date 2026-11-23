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
