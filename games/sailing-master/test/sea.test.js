// M2a 앞바다: 지도·바다 체계(너울·조수·해무)·식수(2026-11-12)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import * as SH from '../ship.js';
import { worldOf, createWorld } from '../world.js';
import { sceneLayout } from '../art.js';
import { SAIL_SETS, FILES, READY, startSail } from '../music.js';
import { HULLS, REGIONS, CAL, WX, WEATHER, TIDE, WATER, MODULES, ACHIEVEMENTS } from '../data.js';

const run = (S, sec, each) => { for (let i = 0; i < sec * 30; i++) { G.step(S, G.FIXED_DT); if (each) each(S); } return S; };
const drain = (S) => { const e = S.events.slice(); S.events.length = 0; return e; };
// 앞바다의 슬루프. extra: 더 놓을 모듈
function coastSloop(seed = 1, extra = [], hull = 'sloop') {
  const S = G.newGame(seed);
  S.region = 'coast'; S.visited = { pond: 1, lake: 1, river: 1, coast: 1 }; S.blueprints = { mast_m: 1, telescope: 1 };
  S.ship = { hull, mods: [{ id: 'mast_m', col: 1, row: 2, rot: 0 }, { id: 'oar', col: 1, row: 4, rot: 0 }, ...extra], name: 'T', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
  S.cap.x = HULLS[hull].helmX; S.cap.at = 'helm'; S.food = 50; S.water = 8; S.res.coin = 100;
  G.dock(S, 'yard'); drain(S);
  return S;
}
const atSea = (S, x, y) => { G.undock(S); S.boat.x = x; S.boat.y = y; drain(S); return S; };
const dayWith = (seed, pred, from = 1) => { for (let d = from; d < 800; d++) if (pred(G.dayWeather(seed, d), d)) return d; throw new Error('그런 날이 없어요'); };
const calmDay = (seed) => dayWith(seed, (q) => q.gust === null && q.storm === null && q.squall === null && !q.fog && !q.seafog && !q.heat && !q.bigswell);

test('M2a 지도: 앞바다는 남쪽이 뭍·북쪽이 바다, 거리 격자 5m, 항구는 물가 12m 안, 관문·발견지는 배로 간다', () => {
  const t0 = performance.now(), w = createWorld(REGIONS.coast), ms = performance.now() - t0;
  console.log(`앞바다 격자 ${w.grid[0]}×${w.grid[1]}칸(${w.cell}m), 만들기 ${ms.toFixed(0)}ms`);
  assert.equal(w.cell, 5); assert.ok(w.coast);
  const [x0, y0, x1, y1] = w.bounds;
  assert.ok(x1 - x0 >= 1600 && y1 - y0 >= 1200, '1600 × 1200m 이상');
  // 남쪽 뭍, 북쪽 바다, 섬은 뭍, 지도 끝 너머는 막혀요(물가 거리는 그대로 바다)
  assert.ok(w.dist(0, 480) < 0 && w.dist(0, -400) > 50);
  for (const I of REGIONS.coast.islands) assert.ok(w.dist(I.x, I.y) < 0, `섬 ${I.x}`);
  assert.ok(w.dist(0, -720) < 0 && w.landDist(0, -720) > 0, '북쪽 경계 너머는 못 가지만 땅도 아니에요');
  assert.ok(w.dist(-820, -300) < 0 && w.dist(820, -300) < 0);
  // 거리 격자가 실제 거리와 맞아요: 해안선 바로 위(뭍 쪽)에서 북쪽으로 20m 가면 물가 거리 ≈ 20 이하
  const cy = w.coastY(-40);
  assert.ok(Math.abs(w.dist(-40, cy - 20) - 20) < 6, `${w.dist(-40, cy - 20)}`);
  assert.equal(w.ports.length, 4);
  for (const p of w.ports) { const d = w.dist(p.x, p.y); assert.ok(d > 5 && d <= 12.6, `${p.id} 물가 ${d.toFixed(1)}m`); }
  const p0 = w.ports[0], t1 = performance.now();
  for (const q of [...w.ports, ...w.gates]) assert.ok(w.findPath(p0.x, p0.y, q.x, q.y), `길 ${q.id}`);
  console.log(`앞바다 길 찾기 ${((performance.now() - t1) / (w.ports.length + w.gates.length)).toFixed(1)}ms/번`);
  // 판마다 다른 발견지 자리도 물가·경계 규칙을 지켜요
  for (let seed = 1; seed <= 6; seed++) {
    const S = G.newGame(seed), list = G.findsOf(S, 'coast');
    assert.equal(list.length, REGIONS.coast.finds.length);
    for (const f of list) {
      assert.ok(w.edgeDist(f.x, f.y) > 60, `시드 ${seed} ${f.id} 경계 가까이`);
      if (f.where === 'water') assert.ok(w.dist(f.x, f.y) > 10);
      else if (f.where === 'beach') assert.ok(w.landDist(f.x, f.y) > 0 && w.landDist(f.x, f.y) < 6, `시드 ${seed} ${f.id} 조간대`); // M2b 조수 웅덩이
      else { assert.ok(w.landDist(f.x, f.y) < 0, `시드 ${seed} ${f.id} 뭍`); const [ax, ay] = w.nearestWater(f.x, f.y); assert.ok(w.findPath(p0.x, p0.y, ax, ay), `시드 ${seed} ${f.id} 길`); }
    }
  }
  // 너울 자리: 만 안쪽은 잔잔, 바깥 바다는 다 받아요
  assert.ok(w.swellAt(0, 150) < 0.05 && w.swellAt(-50, -20) < 0.2, '만 안쪽');
  assert.ok(w.swellAt(0, -450) > 0.95 && w.swellAt(-250, -338) > 0.9, '바깥 바다·등대섬');
  // 풍경: 지도 밖(경계 너머)에 나무를 심지 않아요
  const L = sceneLayout('coast');
  for (const p of L.props) if (!L.marks.includes(p)) assert.ok(w.landDist(p.x, p.y) < 0 && p.x > x0 && p.x < x1, `${p.kind} ${p.x | 0},${p.y | 0}`);
});

test('M2a 관문: 강 끝 → 앞바다 하구 어촌, 앞바다 강 하구 → 강 끝 나루. 큰 바다 경계는 4등급부터이고 넘으면 엔딩', () => {
  const S = coastSloop(); S.region = 'river'; G.dock(S, 'mouth'); drain(S);
  const toSea = worldOf('river').gates.find((g) => g.id === 'toSea');
  assert.ok(G.passGate(S, toSea));
  let ev = drain(S).find((e) => e.type === 'region');
  assert.equal(S.region, 'coast'); assert.equal(S.docked, 'fisher'); assert.ok(S.ach.riverEnd); assert.ok(!S.ended);
  const back = worldOf('coast').gates.find((g) => g.to === 'river');
  assert.ok(G.gateStatus(S, back).ok);
  assert.ok(G.passGate(S, back));
  ev = drain(S).find((e) => e.type === 'region');
  assert.equal(S.region, 'river'); assert.equal(S.docked, 'mouth'); assert.equal(ev.first, false);
  // 나룻배는 앞바다에 못 들어가요
  S.ship.hull = 'rowboat2'; assert.equal(G.passGate(S, toSea), false);
  // 큰 바다 경계: 슬루프 ★3도 못 넘어요(4등급 스쿠너는 C4)
  const T = coastSloop(1, [], 'sloop3'), ocean = worldOf('coast').gates.find((g) => g.id === 'toOcean');
  assert.equal(G.gateStatus(T, ocean).ok, false); assert.equal(G.passGate(T, ocean), false); assert.ok(!T.ended);
  // 시험용 4등급 선체로 넘으면 이번 단계의 엔딩
  HULLS.__g4 = { ...HULLS.sloop3, id: '__g4', grade: 4 };
  try { T.ship.hull = '__g4'; assert.ok(G.passGate(T, ocean)); assert.ok(T.ended && T.ach.openSea); assert.ok(drain(T).some((e) => e.type === 'ended')); } finally { delete HULLS.__g4; }
  assert.ok(ACHIEVEMENTS.some((a) => a.id === 'openSea') && ACHIEVEMENTS.some((a) => a.id === 'riverEnd'));
  // 경계 띠: 지도 끝 100m는 짙은 안개, 4등급이 아니면 알려 줘요
  const E = atSea(coastSloop(), 0, -660); E.clock = calmDay(1) * CAL.day + 120; G.step(E, G.FIXED_DT);
  assert.ok(E.weather.fog > 0.5, `경계 안개 ${E.weather.fog}`);
  assert.ok(drain(E).some((e) => e.type === 'edge' && !e.ok));
});

test('M2a 너울: 내항성을 넘으면 느려지고 상하고, 옆으로 맞으면 더, 방수 격벽은 절반, 만 안쪽은 잔잔하다', () => {
  // 내항성: 등급 × 0.45 + 별 0.1 + 바닥짐 0.1
  assert.equal(+SH.statsOf({ hull: 'sloop', mods: [] }).sea.toFixed(2), 1.35);
  assert.equal(+SH.statsOf({ hull: 'sloop3', mods: [{ id: 'ballast', col: 0, row: 3, rot: 0 }] }).sea.toFixed(2), 1.65);
  const big = dayWith(1, (q) => q.bigswell && q.gust === null && q.storm === null && !q.heat, 2), calm = calmDay(1);
  const sw = G.weatherAt('coast', 1, big * CAL.day + 100).fx.swell;
  assert.ok(sw >= 1.9 && sw <= 2.25, `큰 너울 ${sw}`);
  assert.ok(G.weatherAt('coast', 1, calm * CAL.day + 100).fx.swell < 1.3, '보통 날은 슬루프가 견뎌요');
  const ride = (day, x, y, h, extra = [], sec = 20) => {
    const S = atSea(coastSloop(1, extra), x, y);
    S.clock = day * CAL.day + 60;
    const h0 = S.hull;
    run(S, sec, (T) => { T.boat.x = x; T.boat.y = y; T.boat.h = h; T.boat.sailLevel = 0; T.boat.row = true; T.vigor = 1; T.water = 8; });
    return { hurt: h0 - S.hull, ev: drain(S), S };
  };
  const beam = ride(big, 0, -450, 0), head = ride(big, 0, -450, -Math.PI / 2), bay = ride(big, 0, 150, 0), calmSea = ride(calm, 0, -450, 0);
  const bulk = ride(big, 0, -450, 0, [{ id: 'bulkhead', col: 0, row: 3, rot: 0 }]);
  assert.ok(beam.hurt > 0.05, `옆으로 맞으면 상해요 ${beam.hurt}`);
  assert.ok(head.hurt < beam.hurt * 0.4, `맞받으면 덜 ${head.hurt} < ${beam.hurt}`);
  assert.ok(Math.abs(bulk.hurt - beam.hurt / 2) < 0.01, `격벽 절반 ${bulk.hurt}`);
  assert.equal(bay.hurt, 0, '만 안쪽은 잔잔'); assert.equal(calmSea.hurt, 0, '보통 날 바깥 바다');
  assert.ok(beam.ev.some((e) => e.type === 'swellHit' && e.beam));
  // 느려짐: 같은 노 젓기라도 큰 너울 속이 느려요
  const spd = (day) => { const S = atSea(coastSloop(), 0, -450); S.clock = day * CAL.day + 60; run(S, 12, (T) => { T.boat.y = -450; T.boat.h = 0; T.boat.row = true; T.vigor = 1; }); return S.boat.spd; };
  assert.ok(spd(big) < spd(calm) * 0.9, `${spd(big)} < ${spd(calm)}`);
  // 화물 유실: 오래 있으면 짐을 잃어요
  const C = atSea(coastSloop(), 0, -450); C.clock = big * CAL.day + 30; C.hold = { wood: 30, oak: 10 };
  run(C, 90, (T) => { T.boat.x = 0; T.boat.y = -450; T.boat.h = 0; T.hull = 1; T.vigor = 1; T.water = 8; });
  assert.ok((C.stats.cargoLost || 0) > 0 && (C.hold.wood || 0) + (C.hold.oak || 0) < 40, `화물 ${JSON.stringify(C.hold)}`);
  // 출항 점검: 너울 예보가 배보다 높으면 알려요
  const D = coastSloop(); D.clock = big * CAL.day;
  assert.ok(G.departureCheck(D).warns.some((x) => x.includes('너울')));
  // 수식: 방수 격벽은 절반
  const st = SH.statsOf({ hull: 'sloop', mods: [] });
  assert.equal(G.swellHurt(st, 1.35), 0); assert.ok(Math.abs(G.swellHurt(st, 1.85, 1.5) - 0.5 * WEATHER.swellHurt * 1.5) < 1e-9);
});

test('M2a 조수: 하루 두 번 ±0.6m, 썰물엔 모래톱에 걸리고 밀물엔 넘어간다. 거리 격자는 그대로', () => {
  const D = CAL.day, w = worldOf('coast'), q = REGIONS.coast.shoals[1];
  const hs = Array.from({ length: 73 }, (_, i) => G.tideAt('coast', i * D / 72));
  assert.ok(Math.abs(Math.max(...hs) - TIDE.amp) < 1e-6 && Math.abs(Math.min(...hs) + TIDE.amp) < 1e-6);
  let highs = 0; for (let i = 1; i < 72; i++) if (hs[i] > hs[i - 1] && hs[i] >= hs[i + 1]) highs++;
  assert.equal(highs + 2, 3, '하루에 밀물 꼭대기 두 번(처음과 한가운데)');
  assert.equal(G.tideAt('river', 50), 0, '강엔 조수가 없어요');
  const low = D / 4, high = D / 2, dist0 = w.dist(q.x, q.y);
  assert.ok(Math.abs(w.depthAt(q.x, q.y, G.tideAt('coast', low)) - (q.depth - TIDE.amp)) < 1e-6);
  assert.ok(w.depthAt(q.x, q.y, G.tideAt('coast', low)) < 0, '썰물엔 모래톱 가운데가 드러나요');
  const go = (t) => { const S = atSea(coastSloop(), q.x, q.y); S.clock = calmDay(1) * D + t; S.boat.row = true; G.step(S, G.FIXED_DT); return S.boat.shoal; };
  assert.equal(go(low), true); assert.equal(go(high), false);
  assert.equal(w.dist(q.x, q.y), dist0, '거리 격자는 안 바뀌어요');
  const S = coastSloop(); S.clock = low - 10;
  const ti = G.tideInfo(S);
  assert.equal(ti.rising, false); assert.ok(ti.toLow > 0 && ti.toLow < 11); assert.equal(G.tideInfo(G.newGame(1)), null);
});

test('M2a 해무: 앞바다 새벽에 잦고 짙으며, 등대 가까이는 옅다', () => {
  let spring = 0, summer = 0;
  for (let d = 1; d < 28 * 4; d++) { const w = G.dayWeather(1, d), s = Math.floor(d / 7) % 4; if (w.seafog) { if (s === 0) spring++; if (s === 1) summer++; } }
  assert.ok(spring > summer, `${spring} > ${summer}`);
  assert.deepEqual(G.kindsOf('coast', { seafog: true, fog: true }), ['seafog'], '앞바다엔 민물 안개 대신 해무');
  const f = dayWith(1, (q) => q.seafog && q.gust === null && q.storm === null && q.squall === null && !q.bigswell);
  const S = atSea(coastSloop(), 300, -500); S.clock = f * CAL.day + 30; G.step(S, G.FIXED_DT);
  assert.ok(S.weather.fog > 0.9 && S.weather.on.includes('seafog'));
  const far = G.fogCut(S), L = REGIONS.coast.lights[0];
  S.boat.x = L.x + 40; S.boat.y = L.y - 60; const near = G.fogCut(S);
  assert.ok(near < far * 0.75, `등대 가까이 ${near} < ${far}`);
  assert.ok(G.weatherAt('coast', 1, f * CAL.day + WX.seafog.len * 0.5).fog > 0.5, '담수 안개(75초)보다 오래 껴요');
});

test('M2a 식수: 짠물에선 하루 1통(무더위 2통), 바닥나면 기력이 빨리 빠져 쓰러지고, 항구·표류물로 채운다', () => {
  // 물통 모듈은 앞바다에 가 봐야 열려요
  const R = G.newGame(1); R.ship.hull = 'sloop'; R.visited.river = 1;
  assert.ok(!G.isUnlocked(R, 'water')); R.visited.coast = 1; assert.ok(G.isUnlocked(R, 'water') && G.isUnlocked(R, 'bulkhead'));
  assert.equal(SH.statsOf({ hull: 'sloop', mods: [{ id: 'water', col: 0, row: 3, rot: 0 }, { id: 'water', col: 2, row: 3, rot: 0 }] }).waterCap, HULLS.sloop.waterBase + 2 * 4);
  // 마시는 양
  const calm = calmDay(1), hot = dayWith(1, (q) => q.heat && q.gust === null && q.storm === null && q.squall === null && !q.bigswell);
  const drink = (day, crew = 0) => { const S = atSea(coastSloop(), 0, 150); S.crew = Array.from({ length: crew }, (_, i) => ({ id: 90 + i, role: 'deckhand', name: `x${i}`, wage: 0, baseWage: 0, lv: 1, xp: 0, fatigue: 0, morale: 0.7, trait: 'diligent' })); S.clock = day * CAL.day + 5; S.water = 8; run(S, CAL.day / 4, (T) => { T.boat.x = 0; T.boat.y = 150; T.vigor = 1; }); return 8 - S.water; };
  assert.ok(Math.abs(drink(calm) - 0.25) < 0.01, `하루 1통 ${drink(calm)}`);
  assert.ok(Math.abs(drink(calm, 1) - 0.5) < 0.01, '두 사람이면 두 배');
  assert.ok(Math.abs(drink(hot) - 0.5) < 0.01, `무더위 2통 ${drink(hot)}`);
  // 민물에선 안 마셔요(퍼 마셔요)
  const F = G.newGame(1); G.undock(F); F.water = 1; run(F, 30); assert.equal(F.water, 1);
  // 바닥나면: 경고 → 기력이 빨리 빠져 쓰러짐 → 구조선이 물 한 통
  const T = atSea(coastSloop(), 0, 150); T.clock = calm * CAL.day; T.water = 0.05;
  let ev = [];
  run(T, 120, (U) => { U.boat.x = 0; U.boat.y = 150; ev.push(...drain(U)); });
  assert.ok(ev.some((e) => e.type === 'waterOut'));
  assert.ok(T.disaster && T.disaster.cause === 'faint', '목이 말라 쓰러져요');
  const fainted = ev.findIndex((e) => e.type === 'disaster'), out = ev.findIndex((e) => e.type === 'waterOut');
  assert.ok(fainted > out);
  G.rescue(T); assert.ok(T.water >= 1 && T.docked);
  // 출항 점검: 물이 없으면 못 나가요. 하루치가 안 되면 경고
  const P = coastSloop(); P.water = 0; P.res.coin = 0;
  assert.equal(G.undock(P).ok, false);
  P.water = 0.6; assert.ok(G.departureCheck(P).warns.some((x) => x.includes('식수')));
  // 항구에서 사요: 등대섬은 비싸요. 금화가 없으면 하루치는 나눠 줘요
  const B = coastSloop(1, [{ id: 'water', col: 0, row: 3, rot: 0 }]); B.water = 0; B.res.coin = 20;
  assert.equal(G.buyWater(B, 3), 3); assert.equal(B.res.coin, 17); assert.equal(B.water, 3);
  G.dock(B, 'light'); B.res.coin = 9; assert.equal(G.waterPrice(B), 3); assert.equal(G.buyWater(B, 9), 3); assert.equal(B.res.coin, 0);
  const C = coastSloop(); C.water = 0; C.res.coin = 0; G.dock(C, 'cape');
  assert.ok(C.water >= 1 && drain(C).some((e) => e.type === 'docked' && e.waterGift > 0), '교착 방지');
  // 민물 항구는 공짜로 가득
  const M = coastSloop(1, [{ id: 'water', col: 0, row: 3, rot: 0 }]); M.water = 0; M.region = 'river'; G.dock(M, 'mouth');
  assert.equal(M.water, G.stats(M).waterCap); assert.equal(M.water, 6);
  // 떠다니는 물통: 식수로(화물칸이 아니라)
  const W2 = atSea(coastSloop(1, [{ id: 'water', col: 0, row: 3, rot: 0 }]), 0, 150); W2.water = 1;
  G.flotsamOf(W2).length = 0; G.flotsamOf(W2).push({ x: 1, y: 150, k: 'water', n: 3, ph: 0 });
  run(W2, 1, (U) => { U.boat.x = 0; U.boat.y = 150; });
  assert.ok(W2.water > 3.9 && !W2.hold.water && drain(W2).some((e) => e.type === 'pickWater'));
  // 그물 뭉치는 마포로
  G.flotsamOf(W2).push({ x: 1, y: 150, k: 'net', n: 4, ph: 0 }); run(W2, 1, (U) => { U.boat.x = 0; U.boat.y = 150; });
  assert.equal(W2.hold.cloth, 4);
  // 앞바다 표류물 표: 잡목은 적고 물통·그물·반짝이는 곳이 있어요. 비단이 처음 나와요
  const tb = Object.fromEntries(REGIONS.coast.flot.table.map((e) => [e[0], e[1]]));
  assert.ok(tb.water && tb.net && tb.shiny && tb.wood < REGIONS.river.flot.table.find((e) => e[0] === 'wood')[1]);
  assert.ok(REGIONS.coast.trade.some((e) => e[0] === 'silk') && !REGIONS.river.trade.some((e) => e[0] === 'silk'));
  assert.ok(MODULES.water.cost.wood && !MODULES.water.future && !MODULES.bulkhead.future);
});

test('M2a 저장 v5 → v6: 식수 0, 강 끝 엔딩을 본 저장은 엔딩을 풀고 강 끝 나루에서 이어 간다', () => {
  const S = G.newGame(2); S.region = 'river'; S.visited.river = 1; S.ship.hull = 'sloop2';
  G.undock(S); const g = worldOf('river').gates[0]; S.boat.x = g.x; S.boat.y = g.y;
  S.ended = true; S.ach.riverEnd = 1;
  const o = JSON.parse(G.serialize(S)); o.v = 5; delete o.water;
  const T = G.deserialize(JSON.stringify(o));
  assert.equal(T.v, 7); assert.equal(T.water, 0); assert.equal(T.ended, false);
  assert.equal(T.region, 'river'); assert.equal(T.docked, 'mouth'); assert.ok(T.ach.riverEnd);
  const p = worldOf('river').ports.find((q) => q.id === 'mouth');
  assert.ok(Math.hypot(T.boat.x - p.x, T.boat.y - p.y) < 1);
  // 그대로 이어서 앞바다로 가요
  assert.ok(G.undock(T).ok); assert.ok(G.passGate(T, g)); assert.equal(T.region, 'coast');
  // 엔딩 안 본 v5 저장은 자리 그대로
  const U = G.newGame(3); const q = JSON.parse(G.serialize(U)); q.v = 5; delete q.water;
  const V = G.deserialize(JSON.stringify(q)); assert.equal(V.docked, 'reed'); assert.equal(V.water, 0);
  // 다시 저장해도 같아요
  assert.deepEqual(JSON.parse(G.serialize(G.deserialize(G.serialize(T)))), JSON.parse(G.serialize(T)));
});

test('M2a 음악: 앞바다는 sea.mp3(있는 파일)로 시작하고 강 곡과 번갈아요', () => {
  assert.deepEqual(SAIL_SETS.coast, ['sea', 'river']);
  assert.equal(startSail('coast').track, 'sea');
  assert.ok(READY.has(FILES.sea));
});
