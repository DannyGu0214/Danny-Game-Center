// 열대 환초 데이터 점검(DESIGN 3.2~3.4절과 PLAN 0절 결정)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eco, G } from './helpers.js';
import { LIFE } from '../sim/move.js';

test('생물 8종이 티어 1~8에 하나씩, 물건은 티어마다 자연물 하나·인공물 하나(확장 영역 테마 물건 2개는 따로 T8)', () => {
  const sp = Object.values(eco.species);
  assert.equal(sp.length, 8);
  assert.deepEqual(sp.map((s) => s.tier).sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  const theme = Object.entries(eco.items).filter(([, d]) => d.theme);
  assert.deepEqual(theme.map(([id]) => id).sort(), ['boardwalk', 'mangrove']);
  assert.deepEqual(theme.map(([, d]) => d.kind).sort(), ['made', 'nature']);
  for (const [, d] of theme) assert.equal(d.tier, eco.ext.tier);
  for (let t = 1; t <= 8; t++) {
    const its = Object.values(eco.items).filter((d) => d.tier === t && !d.theme);
    assert.deepEqual(its.map((d) => d.kind).sort(), ['made', 'nature'], `T${t}`);
  }
});

test('인공물은 해저 3 · 수중 3 · 육지 2(DESIGN 3.4), 난파선은 물건 목록·확장 테마에 없다', () => {
  const made = Object.values(eco.items).filter((d) => d.kind === 'made' && !d.theme), n = {};
  for (const d of made) n[d.zone] = (n[d.zone] || 0) + 1;
  assert.deepEqual(n, { bed: 3, water: 3, land: 2 });
  for (const [id, d] of Object.entries(eco.items)) assert.ok(!/wreck|난파|침몰/.test(id + d.name), id);
  assert.deepEqual([...eco.ext.theme].sort(), ['boardwalk', 'mangrove']);
  for (const id of eco.ext.theme) { const d = eco.items[id]; assert.ok(d && d.theme, `테마 물건 ${id}`); assert.notEqual(d.zone, 'land', '확장 영역에 육지가 없어도 놓인다'); }
});

test('모든 수위층(PLAN 0절): 종마다 다니는 층 기본값은 전부(layers 없음)', () => {
  for (const [id, s] of Object.entries(eco.species)) assert.equal(s.layers, undefined, id);
});

test('생활형: 육지형 소라게, 바닥형 해삼, 고착형 말미잘, 유영형 흰동가리·문어·쥐가오리, 표류형 해파리, 수면형 거북', () => {
  const life = Object.fromEntries(Object.entries(eco.species).map(([id, s]) => [id, s.life]));
  assert.deepEqual(life, { seacucumber: 'crawler', hermitcrab: 'walker', anemone: 'sessile', clownfish: 'swimmer', octopus: 'swimmer', moonjelly: 'drifter', greenturtle: 'surfacer', manta: 'swimmer' });
});

test('필요는 그 티어까지의 물건으로, 그 생물이 쓰는 공급 묶음(뭍·물속) 안에서 채울 수 있다', () => {
  for (const [id, s] of Object.entries(eco.species)) {
    const pool = G.poolOfSpecies(id);
    for (const k of s.needs) {
      if (!eco.needs[k].supply) continue;
      const ok = Object.entries(eco.items).some(([iid, d]) => d.tier <= s.tier && d.give[k] && (pool === 'both' || G.poolOfItem(iid) === pool));
      assert.ok(ok, `${s.name}(T${s.tier}) ${eco.needs[k].name}`);
    }
    if (s.partner) assert.ok(eco.species[s.partner.sp].tier < s.tier, `${s.name}의 짝은 먼저 해금`);
  }
});

test('경제 수치는 AW와 같고, 포착 시간만 7초(가안)', () => {
  const E = eco.econ;
  assert.deepEqual([E.start, E.incomeDiv, E.diversity, E.speciesFull, E.itemFull, E.animalBase, E.itemBase, E.growth, E.refund, E.offlineCapSec], [60, 25, 30, 4, 2, 15, 10, 1.7, 0.5, 1800]);
  assert.deepEqual([E.chanceEvery, E.captureMinutes, E.captureMin, E.firstMinutes, E.firstMin, E.requestMin, E.swapCooldown], [[15, 35], 0.5, 2, 5, 10, 10, 60]);
  assert.equal(E.chanceLen, 7);
  assert.deepEqual(eco.tiers, [0, 60, 150, 250, 370, 520, 680, 870]);
  assert.deepEqual([eco.ext.tier, eco.ext.animals], [8, 12]);
  for (const s of Object.values(eco.species)) assert.ok(LIFE[s.life]);
});

test('화면 크기 배율(게임적 허용): S ×1.35 · M ×1.1 · L ×0.95 · XL ×0.85, 등급 순서는 그대로, 소비량은 크기 등급 기준 그대로', () => {
  assert.deepEqual(['S', 'M', 'L', 'XL'].map((k) => eco.sizes[k].draw), [1.35, 1.1, 0.95, 0.85]);
  assert.deepEqual(['S', 'M', 'L', 'XL'].map((k) => eco.sizes[k].use), [1, 1, 2, 3]);
  const order = ['S', 'M', 'L', 'XL'], maxOf = (k) => Math.max(...Object.keys(eco.species).filter((s) => eco.species[s].size === k).map((s) => G.bodyLen(s)));
  const minOf = (k) => Math.min(...Object.keys(eco.species).filter((s) => eco.species[s].size === k).map((s) => G.bodyLen(s)));
  for (let i = 0; i < 3; i++) assert.ok(maxOf(order[i]) < minOf(order[i + 1]), `${order[i]} < ${order[i + 1]}`);
  assert.ok(Math.abs(G.bodyLen('manta') - 3.4) < 1e-9);
  assert.ok(Math.abs(G.bodyLen('seacucumber') - 1.35) < 1e-9);
  for (const [id, s] of Object.entries(eco.species)) assert.ok(s.len > 0, `${id}.len`);
});

test('흰동가리는 짝 둘레에 묶이지 않는다(home 없음, visit만)', () => {
  assert.equal(eco.species.clownfish.home, undefined);
  assert.ok(eco.species.clownfish.visit > 0 && eco.species.clownfish.visit < 0.5);
  assert.deepEqual(eco.species.clownfish.partner, { sp: 'anemone', per: 2 });
});
