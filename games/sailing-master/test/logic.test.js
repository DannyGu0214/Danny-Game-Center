import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import * as SH from '../ship.js';
import { worldOf } from '../world.js';
import { NO_GO, HULLS, MODULES, REGIONS, REGION_ORDER, SPECIES, ACHIEVEMENTS, CAL, SAIL_LEVELS } from '../data.js';

const D = Math.PI / 180;
const run = (S, sec) => { for (let i = 0; i < sec * 30; i++) G.step(S, G.FIXED_DT); return S; };
const drain = (S) => { const e = S.events.slice(); S.events.length = 0; return e; };
// 슬루프 + 돛대 + 노가 있는 배로 호수에 띄운다
function sloopAt(region = 'lake', seed = 1, extra = []) {
  const S = G.newGame(seed);
  S.region = region; S.visited = { pond: 1, lake: 1, river: 1 }; S.blueprints = { mast_m: 1, telescope: 1, barometer: 1 };
  S.ship = { hull: 'sloop', mods: [{ id: 'mast_m', col: 1, row: 2, rot: 0 }, { id: 'oar', col: 1, row: 4, rot: 0 }, ...extra], name: 'T', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
  S.docked = null; S.food = 50; S.cap.x = HULLS.sloop.helmX; S.cap.at = 'helm';
  const w = worldOf(region), p = w.ports[0];
  S.boat.x = p.x; S.boat.y = p.y;
  return S;
}
const finishWalk = (S) => run(S, 6);

test('폴라: 맞바람 금지 구역은 0, 옆바람이 가장 빠르고 뒷바람은 그보다 느리다', () => {
  assert.equal(G.polar(0), 0);
  assert.equal(G.polar(NO_GO), 0);
  assert.ok(G.polar(90 * D) > G.polar(60 * D));
  assert.ok(G.polar(90 * D) > G.polar(180 * D));
});

test('지도: 수역마다 항구·수문·발견지가 물 위에 있고 서로 배로 갈 수 있다', () => {
  for (const id of REGION_ORDER) {
    const w = worldOf(id), [p0] = w.ports;
    assert.ok(w.dist(p0.x, p0.y) >= 8, `${id} 항구`);
    for (const q of [...w.ports, ...w.gates, ...w.finds]) {
      assert.ok(w.dist(q.x, q.y) > 5, `${id} ${q.id}`);
      assert.ok(w.findPath(p0.x, p0.y, q.x, q.y), `${id} 길 ${q.id}`);
    }
    for (const I of REGIONS[id].islands) assert.equal(w.isWater(I.x, I.y), false, `${id} 섬`);
  }
  assert.equal(worldOf('pond').isWater(0, 400), false);
});

test('강: 물살이 하류(북쪽)로 흐르고 가장자리로 갈수록 약하다', () => {
  const w = worldOf('river');
  const [, fy] = w.flowAt(-110, 470);
  assert.ok(fy < -0.1, `물살 ${fy}`);
  assert.equal(worldOf('lake').flowAt(0, 0)[0], 0);
});

test('새 게임: 뗏목, 노 자리, 항구에 묶여 있고, 항구에 있는 동안 시간이 안 흐른다', () => {
  const S = G.newGame(1);
  assert.equal(S.ship.hull, 'raft');
  assert.equal(S.docked, 'reed');
  run(S, 5);
  assert.equal(S.clock, 0);
  assert.ok(G.undock(S).ok);
  run(S, 5);
  assert.ok(S.clock > 4);
});

test('선체 칸: 윤곽 안의 칸만 쓰고, 뗏목은 모두, 뾰족한 배는 끝 칸이 빠진다', () => {
  assert.equal(SH.validCells('raft').length, 12);
  assert.ok(SH.validCells('rowboat').length < 12);
  assert.ok(SH.validCells('sloop').length < 21 && SH.validCells('sloop').length >= 12);
});

test('설계: 겹치거나 밖으로 나가면 못 놓고, 값을 내고, 치우면 절반 돌려받는다', () => {
  const S = G.newGame(1);
  S.res.wood = 100;
  const before = S.res.wood;
  assert.ok(G.placeModule(S, 'food', 0, 0).ok);
  assert.equal(S.res.wood, before - MODULES.food.cost.wood);
  assert.equal(G.placeModule(S, 'food', 0, 0).ok, false, '겹침');
  assert.equal(G.placeModule(S, 'hold', 2, 3).ok, false, '세로 2칸이 밖으로');
  assert.equal(G.placeModule(S, 'mast_s', 0, 2).ok, false, '잠김');
  assert.ok(G.removeModule(S, 0, 0));
  assert.equal(S.res.wood, before - MODULES.food.cost.wood + Math.ceil(MODULES.food.cost.wood / 2));
});

test('계기: 무거우면 느리고 깊어지며, 한쪽 쏠림과 돛은 복원력·속도를 바꾼다', () => {
  const light = SH.statsOf({ hull: 'sloop', mods: [{ id: 'mast_m', col: 1, row: 2, rot: 0 }] });
  const heavy = SH.statsOf({ hull: 'sloop', mods: [{ id: 'mast_m', col: 1, row: 2, rot: 0 }] }, 800);
  assert.ok(heavy.load > light.load && heavy.draft > light.draft);
  assert.ok(heavy.maxSpeed < light.maxSpeed);
  assert.ok(heavy.overload);
  const list = SH.statsOf({ hull: 'sloop', mods: [{ id: 'ballast', col: 2, row: 3, rot: 0 }, { id: 'ballast', col: 2, row: 4, rot: 0 }, { id: 'ballast', col: 2, row: 2, rot: 0 }] });
  const even = SH.statsOf({ hull: 'sloop', mods: [{ id: 'ballast', col: 1, row: 3, rot: 0 }, { id: 'ballast', col: 1, row: 4, rot: 0 }, { id: 'ballast', col: 1, row: 2, rot: 0 }] });
  assert.ok(list.listing > even.listing);
  assert.ok(list.stability < even.stability);
  assert.equal(SH.statsOf({ hull: 'raft', mods: [] }).canMove, false);
});

test('출항 점검: 움직일 수 없으면 못 나가고, 위험은 경고만 한다', () => {
  const S = G.newGame(1);
  S.ship.mods = [];
  assert.equal(G.undock(S).ok, false);
  const T = G.newGame(1);
  T.food = 0.5;
  const c = G.departureCheck(T);
  assert.ok(c.ok && c.warns.some((w) => w.includes('식량')));
  assert.ok(G.undock(T).ok);
});

test('돛: 옆바람에서 빠르고 맞바람에서 멈춘다', () => {
  const beam = sloopAt('lake');
  beam.boat.x = -20; beam.boat.y = 0; beam.boat.sailLevel = 2;
  for (let i = 0; i < 12 * 30; i++) { G.step(beam, G.FIXED_DT); beam.boat.h = beam.wind.from + Math.PI / 2; }
  assert.ok(beam.boat.spd > 3, `옆바람 ${beam.boat.spd}`);
  const irons = sloopAt('lake');
  irons.boat.x = 0; irons.boat.y = 0; irons.boat.sailLevel = 2; irons.boat.spd = 5;
  for (let i = 0; i < 25 * 30; i++) { G.step(irons, G.FIXED_DT); irons.boat.h = irons.wind.from; }
  assert.ok(irons.boat.spd < 1 && irons.boat.luff, `맞바람 ${irons.boat.spd}`);
});

test('선장: 돛을 바꾸면 돛대까지 걸어가고, 그동안 키가 안 듣는다. 갑판원이 있으면 걷지 않는다', () => {
  const S = sloopAt('lake');
  S.boat.x = 0; S.boat.y = 0;
  assert.ok(G.setSail(S, 2));
  assert.equal(S.boat.sailLevel, 0, '아직 걷는 중');
  assert.equal(S.cap.to, 'mast');
  G.step(S, G.FIXED_DT);
  S.boat.rudder = 1; G.step(S, G.FIXED_DT);
  assert.equal(S.boat.rudder, 0);
  finishWalk(S);
  assert.equal(S.boat.sailLevel, 2);
  assert.equal(S.cap.at, 'helm', '다시 키로 돌아온다');
  const T = sloopAt('lake');
  T.crew = [{ role: 'deckhand', name: 'x', wage: 2 }];
  G.setSail(T, 1);
  assert.equal(T.boat.sailLevel, 1, '바로 바뀐다');
});

test('노: 맞바람에도 가고 오래 저으면 지친다. 돛대 없는 뗏목도 저어 간다', () => {
  const S = G.newGame(1); G.undock(S);
  G.setRow(S, true); run(S, 1);
  for (let i = 0; i < 10 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.h = S.wind.from; }
  assert.ok(S.boat.spd > 1.2, `뗏목 ${S.boat.spd}`);
  S.boat.stamina = 0;
  for (let i = 0; i < 12 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.h = S.wind.from; }
  assert.ok(S.boat.spd < 1.35, `지친 뗏목 ${S.boat.spd}`);
  assert.equal(G.setSail(S, 2), false, '돛대 없음');
});

test('물가에 부딪혀도 땅에 올라가지 않고 선체가 조금 상한다', () => {
  const S = sloopAt('lake');
  S.boat.x = 0; S.boat.y = 0; S.boat.row = true; S.boat.sailLevel = 2;
  const w = worldOf('lake');
  for (let i = 0; i < 300 * 30; i++) {
    G.step(S, G.FIXED_DT); S.boat.h = 0.3; S.boat.stamina = 1; S.hull = Math.max(S.hull, 0.5);
    assert.ok(w.dist(S.boat.x, S.boat.y) > 0);
  }
  assert.ok(S.boat.grounded);
});

test('자동 항로: 맞바람 쪽 목적지도 태킹해서 도착한다', () => {
  const S = sloopAt('lake');
  S.boat.x = 0; S.boat.y = 180; S.boat.sailLevel = 2; S.boat.sailNow = 1;
  G.step(S, G.FIXED_DT);
  const up = S.wind.from;
  assert.ok(G.setDest(S, Math.cos(up) * 90, 180 + Math.sin(up) * 90));
  let tacks = 0, sec = 0;
  while (S.route && sec < 400) { G.step(S, G.FIXED_DT); sec += G.FIXED_DT; tacks += drain(S).filter((e) => e.type === 'tack').length; }
  assert.equal(S.route, null, `도착 못함 ${S.boat.x},${S.boat.y}`);
  assert.ok(tacks >= 1, `태킹 ${tacks}`);
});

test('자동 항로: 세 수역 어디서 어디로 가든 도착하고 땅에 안 닿는다', () => {
  const worst = {};
  for (const id of REGION_ORDER) {
    const w = worldOf(id), pts = [...w.ports, ...w.gates, ...w.finds];
    worst[id] = 0;
    for (const seed of [1, 2]) for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 2) % pts.length];
      const S = id === 'pond' ? (() => { const T = G.newGame(seed); G.undock(T); return T; })() : sloopAt(id, seed);
      S.boat.x = a.x; S.boat.y = a.y; S.food = 500;
      if (id !== 'pond') { S.boat.sailLevel = 2; S.boat.sailNow = 1; }
      assert.ok(G.setDest(S, b.x, b.y), `${id} 길`);
      let sec = 0;
      while (S.route && sec < 900) {
        G.step(S, G.FIXED_DT); sec += G.FIXED_DT; S.hull = 1; S.vigor = 1; S.boat.stamina = 1;
        assert.ok(w.dist(S.boat.x, S.boat.y) > 0);
      }
      assert.equal(S.route, null, `${id} 시드 ${seed} ${a.id} → ${b.id}: ${S.boat.x.toFixed(0)},${S.boat.y.toFixed(0)}에서 못 감`);
      worst[id] = Math.max(worst[id], sec);
    }
  }
  console.log('가장 오래 걸린 항로(초)', Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, Math.round(v)])));
});

test('입항: 항구로 항로를 잡으면 묶이고, 화물이 창고로 옮겨지고 기력이 찬다', () => {
  const S = G.newGame(1); G.undock(S);
  S.hold.wood = 7; S.vigor = 0.4;
  const w = worldOf('pond'), p = w.ports[0];
  S.boat.x = p.x; S.boat.y = p.y - 40;
  const wood = S.res.wood;
  G.setDest(S, p.x, p.y, { type: 'port', id: p.id });
  run(S, 60);
  assert.equal(S.docked, p.id);
  assert.equal(S.res.wood, wood + 7);
  assert.equal(S.hold.wood, 0);
  assert.equal(S.vigor, 1);
});

test('건지기: 지나가면 화물칸에 담기고, 칸이 차면 더 못 담는다', () => {
  const S = G.newGame(1); G.undock(S);
  S.boat.x = 0; S.boat.y = 0; S.boat.spd = 0;
  const cap = G.stats(S).holdCap;
  G.flotsamOf(S).push({ x: 1, y: 1, k: 'wood', n: 5, ph: 0 });
  run(S, 1);
  assert.equal(S.hold.wood, 5);
  S.hold.wood = cap;
  G.flotsamOf(S).length = 0;
  G.flotsamOf(S).push({ x: 1, y: 1, k: 'cloth', n: 5, ph: 0 });
  S.boat.x = 0; S.boat.y = 0;
  run(S, 1);
  assert.equal(S.hold.cloth, 0);
  assert.ok(drain(S).some((e) => e.type === 'holdFull'));
});

test('표류물은 수역 한도까지 저절로 생긴다', () => {
  const S = G.newGame(1); G.undock(S);
  run(S, 200);
  assert.ok(G.flotsamOf(S).length > 3);
  assert.ok(G.flotsamOf(S).length <= REGIONS.pond.flot.cap);
});

test('발견: 가까이 가면 보상과 설계도를 받고 해도가 밝아진다', () => {
  const S = G.newGame(1); G.undock(S);
  const f = worldOf('pond').finds.find((q) => q.id === 'skiff'), fog0 = G.fogOf(S, 'pond');
  const coin = S.res.coin;
  S.boat.x = f.x; S.boat.y = f.y;
  run(S, 1);
  assert.ok(S.found.skiff && S.blueprints.telescope);
  assert.equal(S.res.coin, coin + f.coin);
  assert.notEqual(G.fogOf(S, 'pond'), fog0);
});

test('수문: 조건이 안 되면 못 넘고, 되면 다음 수역 항구에 닿는다', () => {
  const S = G.newGame(1);
  const g = worldOf('pond').gates[0];
  assert.equal(G.passGate(S, g), false);
  S.ship.hull = 'rowboat'; S.ship.mods = [{ id: 'oar', col: 0, row: 2, rot: 0 }];
  S.found.stone = 1; S.found.hollow = 1;
  S.hold.wood = 3; const wood = S.res.wood;
  assert.ok(G.gateStatus(S, g).ok);
  assert.ok(G.passGate(S, g));
  assert.equal(S.region, 'lake');
  assert.equal(S.docked, 'southGate');
  assert.equal(S.res.wood, wood + 3);
  assert.ok(G.isUnlocked(S, 'mast_s'));
});

test('달력·예보: 하루 3분, 계절 7일, 같은 시드면 예보대로 온다', () => {
  const S = G.newGame(1);
  S.clock = CAL.day * 8;
  const c = G.clock(S);
  assert.equal(c.season.id, 'summer');
  assert.equal(c.dayOfSeason, 1);
  const a = G.forecast(S);
  assert.equal(a.length, 2);
  assert.deepEqual(a[0], G.dayWeather(1, 8));
  S.ship.mods.push({ id: 'barometer', col: 0, row: 0, rot: 0 });
  assert.equal(G.forecast(S).length, 4);
  let found = 0;
  for (let d = 0; d < 28; d++) if (G.dayWeather(1, d).heat) { found++; assert.equal(Math.floor(d / 7) % 4, 1); }
  assert.ok(found > 0);
});

function dayWith(seed, pred, from = 0) { for (let d = from; d < 400; d++) if (pred(G.dayWeather(seed, d))) return d; throw new Error('없음'); }

test('돌풍: 돛을 다 펴면 선체가 상하고, 줄이면 멀쩡하고, 갑판원은 알아서 줄인다', () => {
  const d = dayWith(1, (w) => w.gust !== null);
  const go = (level, crew) => {
    const S = sloopAt('lake');
    if (crew) S.crew = [{ role: 'deckhand', name: 'x', wage: 0 }];
    S.boat.x = -20; S.boat.y = 0; S.boat.sailLevel = level; S.boat.sailNow = SAIL_LEVELS[level];
    const w = G.dayWeather(1, d);
    S.clock = d * CAL.day + w.gust - 3;
    for (let i = 0; i < 46 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.h = S.wind.from + Math.PI / 2; S.boat.x = -20; S.boat.y = 0; S.food = 50; S.vigor = 1; }
    return S;
  };
  const full = go(2), reef = go(1), crew = go(2, true);
  assert.ok(full.hull < 0.95, `전체 돛 ${full.hull}`);
  assert.ok(reef.hull > 0.999, `줄인 돛 ${reef.hull}`);
  assert.ok(crew.hull > full.hull, `갑판원 ${crew.hull}`);
  assert.equal(crew.boat.sailLevel, 2, '끝나면 되돌린다');
  assert.ok(reef.ach.gustSafe);
});

test('바닥짐은 돌풍 기울기를 줄인다', () => {
  const a = SH.statsOf({ hull: 'sloop', mods: [{ id: 'mast_m', col: 1, row: 2, rot: 0 }] });
  const b = SH.statsOf({ hull: 'sloop', mods: [{ id: 'mast_m', col: 1, row: 2, rot: 0 }, { id: 'ballast', col: 1, row: 3, rot: 0 }] });
  assert.ok(b.stability > a.stability);
});

test('무더위: 그늘막이 없으면 기력이 줄어 쓰러지고, 있으면 멀쩡하다', () => {
  const d = dayWith(1, (w) => w.heat);
  const go = (extra) => {
    const S = sloopAt('lake', 1, extra);
    S.boat.x = 0; S.boat.y = 0; S.clock = d * CAL.day + 1;
    for (let i = 0; i < 100 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.x = 0; S.boat.y = 0; }
    return S;
  };
  const bare = go([]), shade = go([{ id: 'awning', col: 0, row: 3, rot: 0 }]);
  assert.ok(bare.vigor < 0.8, `그늘 없음 ${bare.vigor}`);
  assert.equal(shade.vigor, 1);
});

test('가뭄: 여울 수심이 줄어 깊은 배가 걸리고, 얕은 배는 지나간다', () => {
  const dry = dayWith(1, (w) => w.drought), wet = dayWith(1, (w) => !w.drought);
  const s = REGIONS.river.shoals[4];
  const go = (day, hull) => {
    const S = sloopAt('river');
    if (hull === 'rowboat') { S.ship = { ...S.ship, hull: 'rowboat', mods: [{ id: 'oar', col: 0, row: 2, rot: 0 }] }; }
    S.boat.x = s.x; S.boat.y = s.y; S.clock = day * CAL.day + 1; S.boat.row = true;
    G.step(S, G.FIXED_DT);
    return S;
  };
  assert.equal(go(dry, 'sloop').boat.shoal, true);
  assert.equal(go(wet, 'sloop').boat.shoal, false);
  assert.equal(go(dry, 'rowboat').boat.shoal, false);
});

test('파국: 침몰하면 구조되어 마지막 항구로 간다. 화물·모듈·선원을 잃지만 배와 해금은 남는다', () => {
  const S = sloopAt('lake', 1, [{ id: 'food', col: 0, row: 3, rot: 0 }]);
  S.lastPort = { region: 'lake', id: 'pine' };
  S.crew = [{ role: 'lookout', name: 'x', wage: 2 }];
  S.hold.wood = 9; S.res.coin = 100; S.blueprints.mast_m = 1;
  S.boat.x = 0; S.boat.y = 0; S.hull = 0.001; S.boat.heel = 0; S.boat.sailLevel = 2;
  S.hull = -1;
  G.step(S, G.FIXED_DT);
  assert.equal(S.disaster.cause, 'sink');
  const r = G.rescue(S);
  assert.deepEqual(r.broke, ['food']);
  assert.equal(r.left, 'x');
  assert.equal(S.docked, 'pine');
  assert.equal(S.hold.wood, 0);
  assert.equal(S.ship.hull, 'sloop');
  assert.ok(S.ship.mods.some((m) => m.id === 'mast_m'));
  assert.ok(S.blueprints.mast_m);
  assert.equal(S.hull, 0.35);
  assert.ok(S.res.coin < 100);
});

test('굶으면 쓰러져 구조된다', () => {
  const S = sloopAt('lake');
  S.boat.x = 0; S.boat.y = 0; S.food = 0;
  let n = 0;
  while (!S.disaster && n < 200 * 30) { G.step(S, G.FIXED_DT); n++; S.food = 0; }
  assert.equal(S.disaster.cause, 'faint');
});

test('선원: 해먹이 있어야 태우고, 임금을 못 주면 떠난다', () => {
  const S = G.newGame(1);
  S.region = 'lake'; S.visited.lake = 1; S.docked = 'pine'; S.res.coin = 100;
  S.ship = { hull: 'rowboat', mods: [{ id: 'oar', col: 0, row: 2, rot: 0 }], name: 'x', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
  assert.equal(G.hire(S, 'lookout').ok, false);
  S.ship.mods.push({ id: 'hammock', col: 0, row: 3, rot: 0 });
  assert.ok(G.hire(S, 'lookout').ok);
  assert.equal(G.hire(S, 'deckhand').ok, false, '나룻배 정원 1');
  S.res.coin = 0; S.owed = 5;
  G.dock(S, 'pine');
  assert.equal(S.crew.length, 0);
  assert.ok(drain(S).some((e) => e.type === 'crewLeft'));
});

test('경제: 재료를 팔아 코인을 얻고, 굶으면 입항 때 하루치를 받는다', () => {
  const S = G.newGame(1);
  S.res = { wood: 11, cloth: 3, coin: 0 };
  assert.equal(G.sell(S, 'wood', 11), 5);
  assert.equal(S.res.wood, 1);
  assert.equal(G.sell(S, 'cloth', 3), 3);
  S.res.coin = 0; S.food = 0;
  G.dock(S, 'reed');
  assert.equal(S.food, 1);
});

test('큰 배 짓기: 재료를 내고, 모듈은 값 절반을 돌려받으며, 슬루프는 큰 호수부터 지어요', () => {
  const S = G.newGame(1);
  S.res = { wood: 500, cloth: 500, coin: 500 };
  assert.equal(G.buildHull(S, 'sloop').ok, false);
  assert.ok(G.buildHull(S, 'rowboat').ok);
  assert.equal(S.ship.hull, 'rowboat');
  assert.ok(G.stats(S).oars >= 1, '노 자리를 달아 준다');
  assert.equal(G.buildHull(S, 'raft').ok, false);
});

test('꾸미기: 도전과제로 열리고, 칠과 이름이 바뀐다', () => {
  const S = G.newGame(1);
  assert.equal(G.toggleDecor(S, 'lantern'), false);
  S.stats.docks = 1; G.checkAch(S);
  assert.ok(G.toggleDecor(S, 'lantern'));
  assert.deepEqual(S.ship.decor, ['lantern']);
  G.setPaint(S, 'hull', 2);
  assert.ok(S.ach.paint);
  G.setName(S, '  <파도>호 ');
  assert.equal(S.ship.name, '파도호');
});

test('도감: 처음 기록할 때만 보상, 전부 모으면 도전과제', () => {
  const S = G.newGame(1), coin = S.res.coin;
  assert.equal(G.recordSpecies(S, 'duck'), SPECIES.duck.reward);
  assert.equal(S.res.coin, coin + SPECIES.duck.reward);
  assert.equal(G.recordSpecies(S, 'duck'), 0);
  for (const id of Object.keys(SPECIES)) G.recordSpecies(S, id);
  assert.ok(S.ach.species5 && S.ach.speciesAll);
  assert.equal(ACHIEVEMENTS.length, 15);
});

test('강 끝: 조건을 채우면 엔딩', () => {
  const S = sloopAt('river');
  for (const f of worldOf('river').finds) S.found[f.id] = 1;
  const g = worldOf('river').gates[0];
  assert.ok(G.passGate(S, g));
  assert.ok(S.ended && S.ach.riverEnd);
});

test('저장: 다시 불러도 같고, 망가진 저장은 거른다', () => {
  const S = sloopAt('lake');
  run(S, 3);
  const T = G.deserialize(G.serialize(S));
  run(S, 5); run(T, 5);
  assert.equal(T.boat.x, S.boat.x);
  assert.equal(G.deserialize('{"v":99}'), null);
  assert.equal(G.deserialize('망가짐'), null);
});

test('같은 시드는 같은 결과', () => {
  const a = G.newGame(5), b = G.newGame(5);
  for (const S of [a, b]) { G.undock(S); G.setDest(S, 20, 60); run(S, 40); }
  assert.deepEqual([a.boat.x, a.boat.y, a.boat.h], [b.boat.x, b.boat.y, b.boat.h]);
});
