import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import * as SH from '../ship.js';
import { worldOf } from '../world.js';
import { advanceFlow, waveAngle, FLOW_LAYERS } from '../art.js';
import { createCreatures, hitRadius } from '../creatures.js';
import { NO_GO, HULLS, MODULES, REGIONS, REGION_ORDER, SPECIES, ACHIEVEMENTS, CAL, SAIL_LEVELS, ROLES, CAPTAINS, STORIES } from '../data.js';
import { isJourney } from '../art-story.js';
import { TRACKS, TRACK_IDS } from '../music.js';

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
    for (const q of [...w.ports, ...w.gates]) {
      assert.ok(w.dist(q.x, q.y) > 5, `${id} ${q.id}`);
      assert.ok(w.findPath(p0.x, p0.y, q.x, q.y), `${id} 길 ${q.id}`);
    }
    for (const f of w.finds) {
      const [ax, ay] = w.nearestWater(f.x, f.y), gap = Math.hypot(f.x - ax, f.y - ay), d = w.dist(f.x, f.y);
      assert.ok(w.findPath(p0.x, p0.y, ax, ay), `${id} 길 ${f.id}`);
      if (f.where === 'water') assert.ok(d > 5, `${f.id} 물 위`);
      else if (f.where === 'shore') { assert.ok(d < 0 && d > -7, `${f.id} 물가 ${d}`); assert.ok(gap < 24, `${f.id} 맨눈 ${gap}`); } else { assert.ok(d < -12, `${f.id} 내륙 ${d}`); assert.ok(gap < 66, `${f.id} 망원경 ${gap}`); }
    }
    assert.ok(w.finds.some((f) => f.where === 'inland'), `${id} 내륙 발견지`);
    assert.ok(w.finds.some((f) => f.where === 'shore'), `${id} 물가 발견지`);
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
  assert.ok(S.boat.spd > 4.8, `뗏목 ${S.boat.spd}`);
  S.boat.stamina = 0;
  for (let i = 0; i < 12 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.h = S.wind.from; }
  assert.ok(S.boat.spd < 5.4, `지친 뗏목 ${S.boat.spd}`);
  assert.equal(G.setSail(S, 2), false, '돛대 없음');
});

test('선체 속도 배율: 뗏목 2배, 나룻배·슬루프는 이전 값의 1.5배', () => {
  assert.equal(HULLS.raft.speed, 2); assert.equal(HULLS.raft3.speed, 2);
  assert.equal(HULLS.rowboat.speed, 1.5); assert.equal(HULLS.rowboat3.speed, 1.5);
  assert.equal(HULLS.sloop.speed, 1.5); assert.equal(HULLS.sloop3.speed, 1.5);
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
    const w = worldOf(id), pts = [...w.ports, ...w.gates, ...w.finds.map((f) => { const [x, y] = w.nearestWater(f.x, f.y); return { id: f.id, x, y }; })];
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

test('발견지: 1등급 맵은 고정, 2등급 맵은 처음 들어갈 때 판마다 자리가 정해지고 목록과 개수는 같다', () => {
  const pos = (S, r) => G.findsOf(S, r).map((f) => [f.id, Math.round(f.x), Math.round(f.y)]);
  const A = G.newGame(1), B = G.newGame(2);
  assert.deepEqual(pos(A, 'pond'), pos(B, 'pond'));
  assert.deepEqual(pos(A, 'lake'), pos(B, 'lake'));
  assert.equal(A.findPos, undefined, '강에 들어가기 전엔 정하지 않아요');
  const ids = REGIONS.river.finds.map((f) => f.id);
  const seen = new Set();
  const w = worldOf('river');
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const S = G.newGame(seed);
    S.ship.hull = 'sloop'; S.ship.mods = [{ id: 'oar', col: 1, row: 4, rot: 0 }]; S.region = 'lake';
    assert.ok(G.passGate(S, worldOf('lake').gates[0]));
    const list = G.findsOf(S, 'river');
    assert.deepEqual(list.map((f) => f.id), ids, '목록과 순서가 같아요');
    seen.add(JSON.stringify(pos(S, 'river')));
    // 규칙: 물 위·물가·내륙이 맞고, 배로 다가가 찾을 수 있고, 서로 떨어져 있다
    for (let i = 0; i < list.length; i++) {
      const f = list[i], def = REGIONS.river.finds[i], d = w.dist(f.x, f.y), [ax, ay] = w.nearestWater(f.x, f.y), gap = Math.hypot(f.x - ax, f.y - ay);
      if (def.art === 'wreck') { assert.equal(f.where, 'water'); assert.ok(d >= 12, `물 위 ${f.id} ${d}`); } else if (def.inland) { assert.equal(f.where, 'inland'); assert.ok(d < -12, `내륙 ${f.id} ${d}`); assert.ok(gap < 66, `망원경 거리 ${f.id} ${gap}`); } else { assert.equal(f.where, 'shore'); assert.ok(d < 0 && d > -7, `물가 ${f.id} ${d}`); assert.ok(gap < 24, `맨눈 거리 ${f.id} ${gap}`); }
      assert.ok(w.findPath(w.ports[0].x, w.ports[0].y, ax, ay), `길 ${f.id}`);
      for (let j = i + 1; j < list.length; j++) assert.ok(Math.hypot(f.x - list[j].x, f.y - list[j].y) > 38, `간격 ${f.id} ${list[j].id}`);
    }
    // 저장해도 자리가 그대로
    const T = G.deserialize(G.serialize(S));
    assert.deepEqual(pos(T, 'river'), pos(S, 'river'));
  }
  assert.ok(seen.size >= 7, `판마다 달라야 해요: ${seen.size}`);
});

test('자동 항로: 바람이 물가로 부는 나루에서도 돛으로 빠져나온다', () => {
  // 시드 2의 갈대 마을: 맞바람에 서서 뱃길만 뒤집다 물가에 붙어 버리던 자리
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const S = sloopAt('lake', seed), w = worldOf('lake'), a = w.ports.find((p) => p.id === 'reedTown'), f = w.finds.find((q) => q.id === 'lighthouse'), [x, y] = w.nearestWater(f.x, f.y);
    S.boat.x = a.x; S.boat.y = a.y; S.boat.sailLevel = 2; S.boat.sailNow = 1;
    assert.ok(G.setDest(S, x, y));
    let sec = 0, flips = 0;
    while (S.route && sec < 400) { G.step(S, G.FIXED_DT); sec += G.FIXED_DT; S.hull = 1; S.vigor = 1; flips += drain(S).filter((e) => e.type === 'tack').length; }
    assert.equal(S.route, null, `시드 ${seed} ${S.boat.x | 0},${S.boat.y | 0}에서 못 감`);
    assert.ok(flips < sec / 7, `시드 ${seed} 뱃길을 너무 자주 뒤집음 ${flips}번 / ${sec | 0}초`);
  }
});

test('선원 후보: 항구마다 1~3명, 능력치는 ±25%, 이름·성별이 있고 날이 지나면 바뀐다', () => {
  const counts = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const S = G.newGame(seed); S.res.coin = 999;
    for (const r of ['pond', 'lake', 'river']) {
      S.region = r; S.visited[r] = 1;
      for (const p of worldOf(r).ports) {
        G.dock(S, p.id);
        const list = G.candidatesAt(S);
        counts.add(list.length);
        assert.ok(list.length >= 1 && list.length <= 3, `${r} ${p.id} ${list.length}명`);
        assert.equal(new Set(list.map((c) => c.name)).size, list.length, '이름이 겹치지 않아요');
        for (const c of list) {
          const R = ROLES[c.role];
          assert.ok(['남', '여'].includes(c.gender) && c.name);
          for (const v of [c.skill, c.humor, c.drink]) assert.ok(v >= 75 && v <= 125, `능력치 ${v}`);
          assert.ok(c.hireCost >= Math.floor(R.hire * 0.75) && c.hireCost <= Math.ceil(R.hire * 1.25), `고용비 ${c.hireCost}`);
          assert.ok(REGIONS[R.region].order <= REGIONS[r].order, `${r}에 ${c.role}`);
        }
      }
    }
    assert.ok(worldOf('pond').ports[0]);
  }
  assert.deepEqual([...counts].sort(), [1, 2, 3], '1명, 2명, 3명이 모두 나와요');
  // 같은 날 다시 보면 같고, 3일 지나면 바뀌고, 다 뽑아도 최소 1명은 있다
  const S = G.newGame(4); S.res.coin = 999;
  S.ship = { hull: 'sloop', mods: [{ id: 'hammock', col: 0, row: 3, rot: 0 }, { id: 'hammock', col: 2, row: 3, rot: 0 }], name: 'x', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
  const a = G.candidatesAt(S).map((c) => c.id);
  assert.deepEqual(G.candidatesAt(S).map((c) => c.id), a);
  for (let i = 0; i < 3; i++) G.waitDay(S);
  assert.notDeepEqual(G.candidatesAt(S).map((c) => c.id), a);
  const b = G.candidatesAt(S);
  G.checkAch(S); // 이미 받을 수 있는 업적 보상을 먼저 받아 둬요
  const coin = S.res.coin;
  assert.ok(G.hire(S, b[0].id).ok);
  assert.equal(S.res.coin, coin - b[0].hireCost, '고용비를 그 사람 값대로 내요');
  assert.equal(G.hire(S, 999999).ok, false, '없는 사람은 못 뽑아요');
  S.cands[S.docked].list = [{ ...b[0], id: 777 }];
  assert.equal(G.hire(S, 777).ok, false, '같은 역할은 한 명만');
  S.cands[S.docked].list = [];
  assert.ok(G.candidatesAt(S).length >= 1);
  // 항해술은 속도에 더해지고 유머·주량은 효과가 없다
  const T = G.newGame(1), plain = G.stats(T).speedK;
  T.crew = [{ role: 'lookout', skill: 125, humor: 75, drink: 125, wage: 1 }];
  assert.ok(Math.abs(G.stats(T).speedK - plain * 1.025) < 1e-9);
  const U = G.newGame(1); U.crew = [{ role: 'lookout', skill: 125, humor: 125, drink: 75, wage: 1 }];
  assert.equal(G.stats(U).speedK, G.stats(T).speedK);
  // 예전 저장의 선원(능력치 없음)도 그대로 돌아가요
  const V = G.newGame(1); V.crew = [{ role: 'lookout', name: '수빈', wage: 2 }];
  assert.equal(G.stats(V).speedK, plain);
  const W = G.deserialize(G.serialize(V));
  assert.deepEqual([W.crew[0].gender, W.crew[0].skill, W.crew[0].humor, W.crew[0].drink], ['여', 100, 100, 100]);
  assert.ok(W.crew[0].id > 0);
  G.dismiss(W, W.crew[0].id);
  assert.equal(W.crew.length, 0);
});

test('뗏목은 선원이 탈 자리가 없고 해먹·선실도 놓을 수 없다', () => {
  const S = G.newGame(1); S.res.coin = 999; S.res.wood = 99; S.res.cloth = 99;
  assert.equal(S.ship.hull, 'raft');
  assert.match(G.hire(S, G.candidatesAt(S)[0].id).why, /자리가 없다/);
  assert.match(G.placeModule(S, 'hammock', 0, 0).why, /자리가 없다/);
  assert.equal(S.ship.mods.some((m) => m.id === 'hammock'), false);
});

test('선술집 곡: 마디마다 박자가 맞고 조에서 벗어나지 않는다', () => {
  assert.deepEqual(TRACK_IDS, ['pond', 'lake', 'river']);
  for (const [id, T] of Object.entries(TRACKS)) {
    assert.equal(T.chords.length, T.melody.length, id);
    assert.ok(T.bpm >= 100, `${id}는 흥겨운 빠르기`);
    T.melody.forEach((m, i) => {
      assert.equal(m.reduce((a, [, l]) => a + l, 0), T.bar, `${id} ${i + 1}마디 길이`);
      for (const [n] of m) if (n != null) assert.ok(T.scale.includes(((n % 12) + 12) % 12), `${id} ${i + 1}마디 음 ${n}`);
    });
  }
});

test('금화 세기와 럼주 선원: 내는 금화는 같고 말만 다르다', () => {
  assert.deepEqual([1, 2, 5, 10, 12].map(G.coinCount), ['한 닢', '두 닢', '다섯 닢', '열 닢', '12닢']);
  assert.equal(G.wantsRum({ drink: 115 }), true);
  assert.equal(G.wantsRum({ drink: 114 }), false);
  assert.equal(G.wantsRum({}), false, '예전 선원은 금화로 받아요');
});

test('뗏목은 예전의 2배로 젓고, 나룻배가 뗏목보다 빠르다', () => {
  const rowSpeed = (hull) => SH.statsOf({ hull, mods: [{ id: 'oar', col: 0, row: 2, rot: 0 }] }).rowSpeed;
  assert.ok(rowSpeed('raft') >= 3.8);
  assert.ok(rowSpeed('rowboat') > rowSpeed('raft'));
  assert.equal(HULLS.raft.row, 3.8);
});

test('출항 이야기: 선장마다 3쪽, 마지막은 여정, 이름 조사가 맞는다', () => {
  assert.deepEqual(Object.keys(STORIES), Object.keys(CAPTAINS));
  for (const [id, St] of Object.entries(STORIES)) {
    assert.equal(St.pages.length, 3, id);
    assert.ok(isJourney(St.pages[2].scene), `${id} 3쪽은 여정`);
    assert.ok(St.pages[2].text.includes('갈대 나루'), `${id} 도착지`);
    for (const P of St.pages) for (const n of CAPTAINS[id].names) assert.ok(!/[{}]/.test(G.storyLine(P.text, n)), P.text);
  }
  assert.equal(G.storyLine('{N은} {N이} {N을}', '민준'), '민준은 민준이 민준을');
  assert.equal(G.storyLine('{N은} {N이} {N을}', '지호'), '지호는 지호가 지호를');
  assert.equal(G.storyLine('{N은}', 'Sam'), 'Sam은(는)');
  assert.equal(G.storyLine('{N은}', '티아고 2세'), '티아고 2세는');
  assert.equal(G.storyLine('{N을}', '한스'), '한스를');
});

test('기항지: 작은 호수 3곳, 큰 호수 5곳이 고루 있고 어디든 같은 일을 한다', () => {
  for (const [id, n, far] of [['pond', 3, 90], ['lake', 5, 150]]) {
    const w = worldOf(id);
    assert.equal(w.ports.length, n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(w.ports[i].x - w.ports[j].x, w.ports[i].y - w.ports[j].y) > far, `${id} ${w.ports[i].id} ${w.ports[j].id}`);
    for (const p of w.ports) for (const f of w.finds) assert.ok(Math.hypot(p.x - f.x, p.y - f.y) > 28, `${id} ${p.id} ${f.id} 겹침`);
  }
  // 맵 크기는 그대로
  assert.equal(REGIONS.pond.shape.ax, 96); assert.equal(REGIONS.lake.shape.ax, 170);
  // 같은 맵 안에서는 어느 나루든 값이 같고 수리·보급·고용·건조가 된다
  const results = worldOf('lake').ports.map((p) => {
    const S = G.newGame(1); S.region = 'lake'; S.visited.lake = 1; S.res = { wood: 500, cloth: 500, coin: 500 }; S.food = 0; S.hull = 0.5;
    G.dock(S, p.id); S.res = { wood: 500, cloth: 500, coin: 500 }; S.hull = 0.5; S.food = 1;
    const sold = G.sell(S, 'wood', 20), food = G.buyFood(S, 2), fixed = G.repair(S), built = G.buildHull(S, 'rowboat').ok, placed = G.placeModule(S, 'hammock', 0, 3).ok, res = { ...S.res }, hired = G.hire(S, G.candidatesAt(S)[0].id).ok;
    return JSON.stringify({ sold, food, fixed, built, placed, hired, res });
  });
  assert.equal(new Set(results).size, 1, results.join());
  assert.ok(results[0].includes('"built":true') && results[0].includes('"hired":true'));
});

test('선장 특성 4가지가 효과를 낸다', () => {
  const mk = (id) => { const S = G.newGame(1); G.setCaptain(S, id, ''); return S; };
  const base = G.newGame(1);
  assert.equal(mk('sailor').captain.name, '디에고', '비우면 추천 이름');
  G.setCaptain(base, 'trader', '  <하나>둘셋넷다섯여섯일곱 ');
  assert.equal(base.captain.name.length, 10); assert.ok(!base.captain.name.includes('<'));
  base.captain = undefined;
  // 항해술: 노와 돛 모두 10% 빠르다
  const race = (cap) => { const S = cap ? mk(cap) : G.newGame(1); G.undock(S); S.boat.x = 0; S.boat.y = 0; G.setRow(S, true); for (let i = 0; i < 12 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.x = 0; S.boat.y = 0; S.boat.rowPhase = 1.5; } return S.boat.spd; };
  const r = race('sailor') / race(null);
  assert.ok(r > 1.08 && r < 1.12, `노 ${r}`);
  assert.ok(Math.abs(G.stats(mk('sailor')).maxSpeed / G.stats(base).maxSpeed - 1.1) < 1e-9);
  // 운빨: 찾는 거리 10%
  assert.ok(Math.abs(G.sightRange(mk('lucky')) - G.sightRange(base) * 1.1) < 1e-9);
  // 거래술: 판매 10%, 끝수는 모아 준다
  const T = mk('trader'), N = G.newGame(1);
  T.res.cloth = N.res.cloth = 100; const c0 = T.res.coin;
  for (let i = 0; i < 20; i++) { G.sell(T, 'cloth', 5); G.sell(N, 'cloth', 5); }
  assert.equal(T.res.coin - c0, 110); assert.equal(N.res.coin - c0, 100);
  // 기능공: 재료마다 1 덜 써요(0 아래로는 안 내려가요)
  const K = mk('crafter'); K.res = { wood: 20, cloth: 20, coin: 50 };
  assert.deepEqual(G.moduleCost(K, 'hold'), { wood: 11 });
  assert.equal(G.moduleCost(K, 'telescope').wood, 5); assert.equal(G.moduleCost(K, 'telescope').coin, 19);
  assert.ok(G.placeModule(K, 'food', 0, 0).ok);
  assert.equal(K.res.wood, 20 - 7);
  assert.deepEqual(G.moduleCost(base, 'hold'), { wood: 12 });
  // 특성이 없는 예전 저장도 그대로 돌아간다
  const old = G.deserialize(G.serialize(G.newGame(3)));
  assert.equal(old.captain, undefined); assert.equal(G.stats(old).speedK, 2); // 뗏목 기본 배율(선장·선원 보정은 없음)
});

test('망원경: 내륙 발견지와 뭍짐승은 망원경이 있어야 찾고, 보는 거리가 늘어난다', () => {
  const w = worldOf('pond'), f = w.finds.find((q) => q.id === 'grove'), [ax, ay] = w.nearestWater(f.x, f.y);
  const S = G.newGame(1); G.undock(S);
  S.boat.x = ax; S.boat.y = ay;
  assert.equal(G.canSeeFind(S, f), false);
  assert.equal(G.sightRange(S), 26);
  run(S, 1);
  assert.ok(!S.found.grove, '맨눈으로는 못 찾아요');
  assert.equal(drain(S).filter((e) => e.type === 'inlandHint').length, 1);
  assert.equal(G.recordSpecies(S, 'deer'), false, '뭍짐승은 망원경으로');
  S.ship.mods.push({ id: 'telescope', col: 0, row: 3, rot: 0 });
  assert.equal(G.sightRange(S), 70);
  S.boat.x = ax; S.boat.y = ay;
  assert.equal(G.canSeeFind(S, f), true);
  run(S, 1);
  assert.ok(S.found.grove, '망원경으로 찾아요');
  assert.equal(G.recordSpecies(S, 'deer'), true);
  // 건지기 범위는 망원경과 무관
  const T = G.newGame(1); G.undock(T); T.boat.x = 0; T.boat.y = 0; T.boat.spd = 0;
  T.ship.mods.push({ id: 'telescope', col: 0, row: 3, rot: 0 });
  G.flotsamOf(T).push({ x: 8, y: 0, k: 'wood', n: 5, ph: 0 });
  run(T, 1);
  assert.equal(T.hold.wood, 0);
});

test('뭍짐승은 망원경이 있을 때만 나타난다', () => {
  const cam = { x: 150, y: 0, zoom: 4, cy: 400 }, boat = { x: 150, y: 0 };
  const count = (tele) => {
    const cr = createCreatures(worldOf('lake'));
    let land = 0;
    for (let i = 0; i < 2500; i++) {
      cr.update(0.5, cam, 390, 844, boat, tele);
      land += cr.list.filter((c) => c.kind === 'land').length;
      if (cr.list.length > 5) cr.list.length = 0;
    }
    return land;
  };
  assert.equal(count(false), 0);
  assert.ok(count(true) > 0);
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

test('작은 호수 발견지 보상만으로 나룻배를 지을 수 있고, 발견지끼리 떨어져 있다', () => {
  const w = worldOf('pond'), S = G.newGame(1), price = HULLS.rowboat.price;
  const open = w.finds.filter((f) => !f.inland);
  const near = open.filter((f) => Math.hypot(f.x - w.ports[0].x, f.y - w.ports[0].y) < 90);
  assert.ok(near.length >= 2, `나루 가까이 ${near.length}곳`);
  let wood = S.res.wood, coin = S.res.coin, n = 0;
  for (const f of open.slice().sort((a, b) => Math.hypot(a.x - w.ports[0].x, a.y - w.ports[0].y) - Math.hypot(b.x - w.ports[0].x, b.y - w.ports[0].y))) {
    if (wood >= price.wood && coin >= price.coin) break;
    wood += f.wood || 0; coin += f.coin || 0; n++;
  }
  assert.ok(wood >= price.wood && coin >= price.coin, `발견지로 모자람 ${wood} ${coin}`);
  assert.ok(n <= 4, `가까운 ${n}곳이면 충분해야 함`);
  for (let i = 0; i < w.finds.length; i++) for (let j = i + 1; j < w.finds.length; j++) {
    assert.ok(Math.hypot(w.finds[i].x - w.finds[j].x, w.finds[i].y - w.finds[j].y) > 34, `${w.finds[i].id} ${w.finds[j].id} 너무 가까움`);
  }
});

test('다음 배 재료가 모이면 한 번만 알려 준다', () => {
  const S = G.newGame(1);
  G.undock(S);
  run(S, 1);
  assert.ok(!drain(S).some((e) => e.type === 'canBuild'), '아직 모자람');
  S.res.wood = 30; S.hold.wood = 10; S.res.coin = 15;
  run(S, 1);
  assert.equal(drain(S).filter((e) => e.type === 'canBuild').length, 1);
  run(S, 1);
  assert.equal(drain(S).filter((e) => e.type === 'canBuild').length, 0);
});

test('수문: 호수끼리는 뗏목으로 가고, 강은 2등급부터, 강 끝은 3등급부터다', () => {
  const S = G.newGame(1);
  const toLake = worldOf('pond').gates[0], toRiver = worldOf('lake').gates[0], toSea = worldOf('river').gates[0];
  assert.ok(G.gateStatus(S, toLake).ok, '같은 호수 공간이라 조건이 없어요');
  S.hold.wood = 3; const wood = S.res.wood;
  assert.ok(G.passGate(S, toLake));
  assert.equal(S.region, 'lake');
  assert.equal(S.docked, 'southGate');
  assert.equal(S.res.wood, wood + 3);
  assert.ok(G.isUnlocked(S, 'mast_s'));
  assert.equal(G.passGate(S, toRiver), false, '뗏목은 강에 못 들어가요');
  S.ship.hull = 'rowboat'; S.ship.mods = [{ id: 'oar', col: 0, row: 2, rot: 0 }];
  assert.ok(G.passGate(S, toRiver));
  assert.equal(S.region, 'river');
  assert.equal(G.passGate(S, toSea), false, '나룻배는 강 끝을 못 넘어요');
  S.ship.hull = 'sloop3';
  assert.ok(G.gateStatus(S, toSea).ok, '높은 등급 배도 들어가요');
});

test('수문: 온 길로 돌아갈 수 있고, 돌아간 수역을 처음 간 것처럼 알리지 않는다', () => {
  const S = G.newGame(1);
  G.passGate(S, worldOf('pond').gates[0]);
  assert.equal(drain(S).find((e) => e.type === 'region').first, true);
  const back = worldOf('lake').gates.find((g) => g.to === 'pond');
  assert.ok(G.passGate(S, back));
  assert.equal(S.region, 'pond');
  assert.equal(S.docked, 'stonePier');
  assert.equal(drain(S).find((e) => e.type === 'region').first, false);
  const R = sloopAt('river');
  assert.ok(G.passGate(R, worldOf('river').gates.find((g) => g.to === 'lake')));
  assert.equal(R.region, 'lake');
  assert.equal(R.docked, 'northPier');
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

test('선원: 해먹이 있어야 태우고, 보수를 못 주면 떠난다', () => {
  const S = G.newGame(1);
  S.region = 'lake'; S.visited.lake = 1; S.docked = 'pine'; S.res.coin = 100;
  S.ship = { hull: 'rowboat', mods: [{ id: 'oar', col: 0, row: 2, rot: 0 }], name: 'x', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
  const first = G.candidatesAt(S)[0];
  assert.equal(G.hire(S, first.id).ok, false, '해먹이 없으면 못 태워요');
  S.ship.mods.push({ id: 'hammock', col: 0, row: 3, rot: 0 });
  assert.ok(G.hire(S, first.id).ok);
  assert.equal(S.crew[0].name, first.name);
  assert.equal(G.hire(S, G.candidatesAt(S)[0].id).ok, false, '나룻배 정원 1');
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

test('사다리: 1~3등급 별 9칸의 칸 수·내구도가 기획 표와 같다', () => {
  const cells = (id) => SH.validCells(id).length;
  assert.deepEqual(['raft', 'raft2', 'raft3', 'rowboat', 'rowboat2', 'rowboat3', 'sloop', 'sloop2', 'sloop3'].map(cells), [12, 15, 15, 8, 12, 12, 17, 26, 26]);
  assert.deepEqual(['raft', 'rowboat', 'sloop'].map((id) => HULLS[id].hp), [40, 70, 120]);
  assert.deepEqual(['raft3', 'rowboat3', 'sloop3'].map((id) => HULLS[id].hp), [52, 91, 156]);
  // 별을 올리면 더 빠르고 둔해진다. 등급이 오를수록 최고 속도도 오른다
  for (const k of ['raft', 'rowboat', 'sloop']) {
    const a = SH.statsOf({ hull: k, mods: [] }), b = SH.statsOf({ hull: `${k}2`, mods: [] });
    assert.ok(b.maxSpeed > a.maxSpeed && HULLS[`${k}2`].turn < HULLS[k].turn, k);
  }
  assert.ok(HULLS.sloop.row > HULLS.raft.row && HULLS.sloop.row < HULLS.rowboat.row, '슬루프 노가 뗏목보다 느리지 않아요');
});

test('별 올리기: 선원과 모듈이 그대로 가고, 값을 내고, 안 맞는 모듈만 절반 돌려받는다', () => {
  for (const [from, to] of [['raft', 'raft2'], ['raft2', 'raft3'], ['rowboat', 'rowboat2'], ['rowboat2', 'rowboat3'], ['sloop', 'sloop2'], ['sloop2', 'sloop3']]) {
    const S = G.newGame(1); S.region = 'river'; S.docked = 'head'; S.res = { wood: 900, cloth: 900, coin: 900 }; S.hull = 0.5;
    S.ship.hull = from; S.ship.mods = [];
    // 칸을 모듈로 다 채워도 ★1에 놓인 것이 어긋나지 않아야 해요
    for (const [c, r] of SH.validCells(from)) S.ship.mods.push({ id: 'food', col: c, row: r, rot: 0 });
    S.crew = HULLS[from].crew ? [{ id: 1, role: 'lookout', name: 'x', wage: 1 }] : [];
    const n = S.ship.mods.length, crew = S.crew.length;
    G.checkAch(S); // 이미 받을 수 있는 업적 보상을 먼저 받아 둬요
    const coin = S.res.coin;
    assert.ok(G.buildHull(S, to).ok, to);
    assert.equal(S.ship.hull, to);
    assert.equal(S.ship.mods.length, n, `${to} 모듈이 그대로`);
    assert.equal(S.crew.length, crew);
    assert.equal(S.res.coin, coin - (HULLS[to].price.coin || 0));
    assert.equal(S.hull, 1);
    assert.equal(S.cap.x, HULLS[to].helmX);
    for (const m of S.ship.mods) assert.ok(SH.validCells(to).some(([c, r]) => c === m.col && r === m.row), `${to} ${m.col},${m.row}`);
  }
  // 윤곽에 안 맞게 된 모듈은 값 절반을 돌려준다(오래된 저장의 어긋난 모듈 대비)
  const T = G.newGame(1); T.res = { wood: 100, cloth: 0, coin: 0 };
  T.ship.mods = [{ id: 'food', col: 9, row: 9, rot: 0 }];
  assert.ok(G.buildHull(T, 'raft2').ok);
  assert.equal(T.ship.mods.length, 0);
  assert.equal(T.res.wood, 100 - 12 + Math.ceil(MODULES.food.cost.wood / 2));
});

test('등급 올리기: 뗏목은 바로, 2등급부터 ★2가 먼저고, 슬루프는 강에서 설계도로 짓는다', () => {
  const S = G.newGame(1);
  S.res = { wood: 900, cloth: 900, coin: 900 };
  assert.equal(G.buildHull(S, 'sloop').ok, false, '두 칸은 못 건너요');
  assert.equal(G.buildHull(S, 'raft3').ok, false, '별도 한 칸씩');
  assert.ok(G.buildHull(S, 'rowboat').ok, '뗏목은 별 없이 나룻배로');
  assert.equal(S.ship.hull, 'rowboat');
  assert.ok(G.stats(S).oars >= 1, '노 자리를 달아 준다');
  assert.equal(G.buildHull(S, 'raft').ok, false);
  assert.match(G.buildHull(S, 'sloop').why, /★2/);
  assert.equal(G.nextHull(S).id, 'rowboat2');
  assert.ok(G.buildHull(S, 'rowboat2').ok);
  assert.equal(G.nextHull(S).id, 'sloop');
  assert.match(G.buildHull(S, 'sloop').why, /강 항구/, '호수에서는 못 지어요');
  assert.equal(G.buildHull(S, 'rowboat3').ok, false, '작은 호수 조선소로는 ★3을 못 지어요');
  S.region = 'lake'; S.docked = 'pine';
  assert.ok(G.buildHull(S, 'rowboat3').ok, '큰 호수에서 지어요');
  S.region = 'river'; S.docked = 'head';
  assert.match(G.buildHull(S, 'sloop').why, /설계도/);
  S.blueprints.sloop = 1;
  const crew = { id: 1, role: 'lookout', name: 'x', wage: 1 }; S.crew = [crew];
  S.ship.mods.push({ id: 'food', col: 0, row: 1, rot: 0 });
  const wood = S.res.wood;
  assert.ok(G.buildHull(S, 'sloop').ok);
  assert.equal(S.res.wood, wood - HULLS.sloop.price.wood + 2 + Math.ceil(MODULES.food.cost.wood / 2), '옮겨 타면 모듈은 값 절반');
  assert.equal(S.crew.length, 0);
  assert.equal(S.ship.mods.length, 1);
  assert.ok(S.ach.sloop);
  assert.equal(G.buildHull(S, 'sloop3').ok, false);
  assert.ok(G.buildHull(S, 'sloop2').ok); assert.ok(G.buildHull(S, 'sloop3').ok);
  assert.equal(G.buildSteps(S).length, 0, '지금은 슬루프 ★3이 끝');
  assert.equal(G.nextHull(S), null);
  // 강 물레방아에서 슬루프 설계도가 나온다
  assert.equal(REGIONS.river.finds.filter((f) => f.blueprint === 'sloop').length, 1);
});

test('내구도: 피해는 절대값이라 큰 배가 잘 버티고, 수리비도 잃은 내구도만큼이다', () => {
  const hit = (hull) => {
    const S = sloopAt('lake');
    S.ship.hull = hull; S.boat.x = 0; S.boat.y = 0; S.boat.spd = 5; S.boat.h = Math.atan2(-worldOf('lake').gradient(0, 0)[1], 0);
    const w = worldOf('lake'), I = REGIONS.lake.islands[0];
    let x = I.x, y = I.y + I.r * 1.6;
    while (w.dist(x, y) > 1) y -= 0.5;
    S.boat.x = x; S.boat.y = y; S.boat.spd = 5; S.boat.h = -Math.PI / 2;
    G.step(S, G.FIXED_DT);
    assert.ok(S.boat.grounded);
    return 1 - S.hull;
  };
  const a = hit('raft'), b = hit('sloop');
  assert.ok(a > b * 2.5, `뗏목 ${a} 슬루프 ${b}`);
  const S = G.newGame(1); S.res.coin = 999; S.hull = 0.5;
  assert.equal(G.repairCost(S), 20);
  S.ship.hull = 'sloop';
  assert.equal(G.repairCost(S), 60);
});

test('고유 개조: 노걸이는 노를 빠르게, 센터보드는 맞바람에 붙게, 윈치는 돛을 빨리 바꾼다', () => {
  const row = (h) => SH.statsOf({ hull: h, mods: [{ id: 'oar', col: 1, row: 1, rot: 0 }] }).rowSpeed;
  assert.ok(Math.abs(row('raft3') / row('raft2') - 1.15) < 1e-9);
  // 센터보드: 38° 옆바람에서 일반 나룻배는 돛이 펄럭이고 ★3은 간다
  const at = (hull) => {
    const S = sloopAt('lake'); S.ship.hull = hull; S.ship.mods = [{ id: 'mast_s', col: 0, row: 2, rot: 0 }];
    S.boat.x = 0; S.boat.y = 0; S.boat.sailLevel = 2; S.boat.sailNow = 1;
    for (let i = 0; i < 20 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.h = S.wind.from + 38 * D; S.boat.x = 0; S.boat.y = 0; S.boat.rudder = 0; S.boat.turn = 0; }
    return S.boat;
  };
  assert.equal(at('rowboat2').luff, true);
  const cb = at('rowboat3');
  assert.equal(cb.luff, false);
  assert.ok(cb.spd > at('rowboat2').spd);
  assert.ok(SH.statsOf({ hull: 'rowboat3', mods: [] }).leeK < 1);
  // 윈치: 돛이 다 오르는 시간이 절반이고 걷는 거리도 절반이다
  const rise = (hull) => {
    const S = sloopAt('lake'); S.ship.hull = hull; S.boat.x = 0; S.boat.y = 0; S.boat.sailLevel = 2; S.boat.sailNow = 0;
    let n = 0;
    while (S.boat.sailNow < 0.99 && n < 300) { G.step(S, G.FIXED_DT); n++; }
    return n;
  };
  const r2 = rise('sloop2'), r3 = rise('sloop3');
  assert.ok(Math.abs(r3 / r2 - 0.5) < 0.05, `${r2} ${r3}`);
  const walk = (hull) => { const S = sloopAt('lake'); S.ship.hull = hull; S.cap.x = HULLS[hull].helmX; S.boat.x = 0; S.boat.y = 0; G.setSail(S, 2); let n = 0; while (S.cap.at !== 'mast' && n < 900) { G.step(S, G.FIXED_DT); n++; } return n; };
  assert.ok(Math.abs(walk('sloop3') / walk('sloop2') - 0.5) < 0.05);
});

test('뗏목에는 돛대를 못 세운다', () => {
  const S = G.newGame(1); S.visited.lake = 1; S.res = { wood: 99, cloth: 99, coin: 99 };
  assert.match(G.placeModule(S, 'mast_s', 1, 2).why, /돛대/);
  assert.ok(G.buildHull(S, 'rowboat').ok);
  assert.ok(G.placeModule(S, 'mast_s', 0, 2).ok);
});

test('가장 높은 배 기록: 고치면 따라오고, 구조로 모듈을 잃어도 남는다', () => {
  const S = G.newGame(1); S.res = { wood: 900, cloth: 900, coin: 900 };
  assert.equal(S.best.hull, 'raft');
  G.buildHull(S, 'raft2'); assert.equal(S.best.hull, 'raft2');
  G.placeModule(S, 'food', 0, 0); assert.ok(S.best.mods.some((m) => m.id === 'food'));
  G.setPaint(S, 'hull', 2); assert.equal(S.best.paint.hull, 2);
  S.best.mods = S.ship.mods.map((m) => ({ ...m }));
  S.docked = null; S.disaster = { cause: 'sink' }; S.lastPort = { region: 'pond', id: 'reed' };
  const n = S.best.mods.length;
  G.rescue(S);
  assert.ok(S.ship.mods.length < n);
  assert.equal(S.best.mods.length, n);
});

test('저장 v1 → v2: 예전 배는 ★1, 슬루프로 있던 판도 그대로, 찾아 둔 물레방아는 설계도를 준다', () => {
  const old = JSON.parse(G.serialize(sloopAt('lake')));
  old.v = 1; delete old.best; old.found = { mill2: 1 };
  const T = G.deserialize(JSON.stringify(old));
  assert.equal(T.v, 2);
  assert.equal(T.ship.hull, 'sloop');
  assert.equal(HULLS[T.ship.hull].star, 1);
  assert.equal(T.best.hull, 'sloop');
  assert.ok(T.blueprints.sloop);
  assert.ok(G.stats(T).sailArea > 0);
  run(T, 2);
  assert.equal(G.nextHull(T).id, 'sloop2');
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

test('도감: 동물을 기록해도 자원이 늘지 않고, 달성 보상만 받는다', () => {
  const S = G.newGame(1), res = { ...S.res }, hold = { ...S.hold };
  assert.equal(G.recordSpecies(S, 'duck'), true);
  assert.deepEqual(S.res, res);
  assert.deepEqual(S.hold, hold);
  assert.equal(G.recordSpecies(S, 'duck'), false);
  S.ship.mods.push({ id: 'telescope', col: 0, row: 3, rot: 0 }); // 뭍짐승은 망원경으로 봐요
  const ids = Object.keys(SPECIES);
  for (const id of ids.slice(0, 5)) G.recordSpecies(S, id);
  assert.ok(S.ach.species5);
  assert.equal(S.res.coin, res.coin + 30);
  assert.ok(!S.ach.species10);
  for (const id of ids) G.recordSpecies(S, id);
  assert.ok(S.ach.species10 && S.ach.speciesAll);
  assert.equal(S.res.coin, res.coin + 30 + 50 + 80);
  assert.equal(ACHIEVEMENTS.length, 16);
  for (const d of Object.values(SPECIES)) assert.equal(d.reward, undefined);
});

test('동물 탭 범위는 몸에 맞고, 떨어진 곳은 잡지 않는다', () => {
  const zoom = 8, W2 = 400, cam = { x: 0, y: 0, zoom, cy: 400 };
  const cr = createCreatures(worldOf('pond'));
  cr.list.push({ sp: 'duck', kind: 'duck', x: 0, y: 0, h: 0, age: 1, life: 30, ph: 0, act: 0, next: 9, size: 1 });
  assert.ok(cr.at(W2 / 2, 400, cam, W2));
  assert.equal(cr.at(W2 / 2 + 40, 400, cam, W2), null, '40px 옆은 동물이 아니다');
  assert.ok(hitRadius(cr.list[0], zoom) < 34);
});

test('강 끝: 슬루프로 닿으면 엔딩', () => {
  const S = sloopAt('river');
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

test('물결: 물마루가 바람 부는 쪽을 보게 돌아간다', () => {
  // 무늬의 볼록한 쪽(0, -1)을 돌리면 바람 부는 쪽과 같아야 한다
  for (const blow of [0, 1, 2.5, -1.2, -2.9]) {
    const a = waveAngle(blow), x = Math.sin(a), y = -Math.cos(a);
    assert.ok(Math.abs(x - Math.cos(blow)) < 1e-9 && Math.abs(y - Math.sin(blow)) < 1e-9);
  }
});

test('물결: 오래 플레이해도 바람 부는 쪽으로 의도한 속도로 흐른다', () => {
  for (const region of REGION_ORDER) {
    const S = G.newGame(1), sc = { world: worldOf(region) }, cam = { x: 30, y: 40 };
    S.region = region;
    const maxSpd = FLOW_LAYERS[0].drift * (0.6 + REGIONS[region].wind.speed * 1.32 / 15) + (REGIONS[region].flow || 0);
    let off = 0, n = 0, top = 0, worst = 0;
    // 화면 가운데(카메라) 물결이 한 단계 뒤 어디로 갔는지 잰다
    S.t = 0; advanceFlow(sc, cam, 0, G.windAt(S));
    for (let i = 1; i < 3600 * 30; i++) {
      const F = sc.flow, p = F.layers[0], t0 = waveAngle(F.ang), rx = cam.x - p.x, ry = cam.y - p.y;
      const u = rx * Math.cos(-t0) - ry * Math.sin(-t0), v = rx * Math.sin(-t0) + ry * Math.cos(-t0); // 무늬 좌표
      S.t = i / 30;
      const w = G.windAt(S);
      advanceFlow(sc, cam, S.t, w);
      const t1 = waveAngle(F.ang), nx = p.x + u * Math.cos(t1) - v * Math.sin(t1), ny = p.y + u * Math.sin(t1) + v * Math.cos(t1);
      const vx = (nx - cam.x) * 30, vy = (ny - cam.y) * 30;
      if (i < 30 * 30) continue; // 첫 30초 뒤부터 잰다
      const d = Math.abs(G.angDiff(Math.atan2(vy, vx), F.ang)), lag = Math.abs(G.angDiff(F.ang, w.from + Math.PI));
      if (!REGIONS[region].flow) { off += Math.max(d, lag); n++; worst = Math.max(worst, d, lag); }
      top = Math.max(top, Math.hypot(vx, vy));
      assert.ok(lag < 0.4, `${region} 바람을 못 따라감 ${lag}`);
    }
    if (n) {
      assert.ok(off / n * 180 / Math.PI < 10, `${region} 평균 어긋남 ${(off / n * 180 / Math.PI).toFixed(1)}°`);
      console.log(region, `물결 평균 어긋남 ${(off / n * 180 / Math.PI).toFixed(1)}°, 최대 ${(worst * 180 / Math.PI).toFixed(1)}°, 최대 속도 ${top.toFixed(2)}m/s`);
    } else console.log(region, `물결 최대 속도 ${top.toFixed(2)}m/s(물살 포함)`);
    assert.ok(top <= maxSpd + 0.05, `${region} 너무 빠름 ${top}`);
  }
});

test('같은 시드는 같은 결과', () => {
  const a = G.newGame(5), b = G.newGame(5);
  for (const S of [a, b]) { G.undock(S); G.setDest(S, 20, 60); run(S, 40); }
  assert.deepEqual([a.boat.x, a.boat.y, a.boat.h], [b.boat.x, b.boat.y, b.boat.h]);
});
