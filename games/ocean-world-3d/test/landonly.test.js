// 규칙이 생태계를 모르는지: 물이 없고 걷는 동물만 있는 가상의 작은 육지 생태계 데이터로도 규칙이 돈다(DESIGN 11.4).
// 육지 생태계 기능을 새로 만든 것이 아니라, 지금 규칙이 바다 전용 가정에 묶여 있지 않은지 확인하는 시험이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../sim/rules.js';
import { readFileSync, readdirSync } from 'node:fs';

const MAP = [
  '############',
  '#..........#',
  '#..^^......#',
  '#..^^......#',
  '#..........#',
  '#......,,,,#',
  '#......,,,,#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '############',
];
const KIND = { '#': 'cliff', '.': 'meadow', '^': 'rock', ',': 'grove' };
const terrain = {
  GRID: { w: 12, h: 12 }, EXT: null, SEA_LEVEL: null, MAX_DEPTH: 0,
  kindAt: (x, y) => KIND[MAP[y]?.[x]] ?? 'void',
  cellHeight: (x, y) => (MAP[y]?.[x] === '^' ? 3 : 0),
  heightAt: () => 0,
};
const meadow = {
  id: 'meadow', name: '시험 들판', terrain,
  kinds: { meadow: { name: '풀밭', walk: true, place: true }, grove: { name: '숲', walk: true, place: true }, rock: { name: '바위', walk: false, place: false }, cliff: { name: '벼랑', walk: false, place: false }, void: { out: true } },
  layers: {}, zones: { land: { name: '땅' } },
  needs: { food: { name: '먹이', supply: true, act: 'eat' }, shelter: { name: '쉼터', supply: true, act: 'rest' }, water: { name: '물', supply: true, act: 'drink' }, herd: { name: '무리' } },
  sizes: { S: { use: 1 }, M: { use: 1 }, L: { use: 2 } },
  species: {
    hare: { name: '산토끼', tier: 1, size: 'S', life: 'walker', needs: ['food', 'shelter'], speed: 2.6, special: '깡충' },
    deer: { name: '사슴', tier: 2, size: 'L', life: 'walker', needs: ['food', 'water', 'herd'], speed: 1.8, special: '뿔 비비기' },
  },
  items: {
    clover: { name: '토끼풀', tier: 1, kind: 'nature', zone: 'land', w: 2, h: 2, on: ['meadow'], walk: true, give: { food: 2 } },
    hutch: { name: '굴', tier: 1, kind: 'made', zone: 'land', w: 2, h: 2, on: ['meadow', 'grove'], give: { shelter: 3 } },
    pond: { name: '웅덩이', tier: 2, kind: 'nature', zone: 'land', w: 2, h: 2, on: ['grove'], give: { water: 4 } },
  },
  tiers: [0, 60], maxTier: 2,
  econ: { start: 60, incomeDiv: 25, diversity: 30, speciesFull: 4, itemFull: 2, animalBase: 15, itemBase: 10, growth: 1.7, refund: 0.5, offlineCapSec: 1800, chanceEvery: [15, 35], chanceLen: 5, captureMinutes: 0.5, captureMin: 2, firstMinutes: 5, firstMin: 10, requestMin: 10, swapCooldown: 60, perTier: 4, herdSize: 3, animalValueBase: 6, animalValueStep: 4, itemPointsBase: 4, itemPointsStep: 2, daySec: 240 },
};

test('물 없는 육지 생태계: 들이기·놓기·발전도·티어·요청·포착·이동·저장이 모두 돈다', () => {
  const G = createSim(meadow);
  const S = G.newGame(4, 0);
  assert.equal(G.space.hasWater, false);
  assert.equal(S.requests.length, 3);
  assert.ok(G.adopt(S, 'hare').ok);
  const at = G.freeSpot(S, 'clover');
  assert.equal(at.layer, null);
  assert.ok(G.placeItem(S, 'clover', at.x, at.y).ok);
  S.pop = 1e5;
  for (let i = 0; i < 3; i++) G.adopt(S, 'hare');
  for (const id of ['clover', 'hutch']) { const p = G.freeSpot(S, id); G.placeItem(S, id, p.x, p.y); }
  assert.equal(S.tier, 2);
  assert.ok(G.adopt(S, 'deer').ok);
  const st = G.stats(S);
  assert.equal(st.needMet.hare.food, 4 / 6, 'AW와 같이 지역 전체 공급 ÷ 소비(토끼풀 2개 = 4, 산토끼 4 + 사슴 2)');
  assert.equal(st.needMet.deer.food, 4 / 6);
  assert.equal(st.supply.water.food, 0);
  assert.equal(G.poolOfSpecies('deer'), 'land');
  const start = S.animals.map((a) => [a.x, a.y]);
  for (let i = 0; i < 30 * 60; i++) {
    G.tick(S);
    for (const a of S.animals) { const c = G.space.cellAt(a.x, a.y); assert.ok(G.space.canWalk(S, c, 'land'), `${a.sp} ${a.x},${a.y}`); assert.ok(!['rock', 'cliff'].includes(G.space.kind[c])); }
  }
  assert.ok(S.animals.some((a, i) => Math.hypot(a.x - start[i][0], a.y - start[i][1]) > 1), '걸어 다닌다');
  assert.ok(S.time > 59);
  const T = G.deserialize(G.serialize(S, 0));
  assert.equal(G.stats(T).dev, G.stats(S).dev);
  assert.equal(G.view(S).props[0].zone, 'land');
});

test('생태계 데이터 점검: 물이 없는 생태계에 헤엄치는 생물·물속 물건을 넣으면 거절한다', () => {
  assert.throws(() => createSim({ ...meadow, species: { ...meadow.species, carp: { name: '잉어', tier: 1, size: 'S', life: 'swimmer', needs: ['food'], speed: 1 } } }), /물이 없는 생태계/);
  assert.throws(() => createSim({ ...meadow, items: { ...meadow.items, reed: { name: '갈대', tier: 1, zone: 'bed', w: 2, h: 2, on: ['meadow'], give: {} } } }), /물이 없는 생태계/);
  assert.throws(() => createSim({ ...meadow, species: { ...meadow.species, bat: { name: '박쥐', tier: 1, size: 'S', life: 'flyer', needs: ['food'] } } }), /모르는 생활형/);
});

test('sim/은 Three.js·DOM을 가져오지 않고, 생태계 이름(환초·바다·산호 등)을 코드에 박아 두지 않는다', () => {
  const dir = new URL('../sim/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    const imports = [...src.matchAll(/import[^'"]*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const m of imports) assert.ok(m.startsWith('./'), `${f}: ${m}`);
    assert.ok(!/\b(document|window|THREE|navigator)\b/.test(src), `${f}: DOM·Three.js`);
    const code = src.replace(/\/\/.*$/gm, ''); // 주석의 설명은 빼고 코드만
    for (const w of ['atoll', '환초', '바다', '산호', '석호', '틸라', '칸두', 'anemone', 'clownfish', 'reef', 'lagoon', 'kandu', 'thila', 'beach']) assert.ok(!code.includes(w), `${f}: ${w}`);
  }
});
