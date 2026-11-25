import assert from 'node:assert/strict';
import test from 'node:test';
import { RECIPES, RESOURCES, STATIONS } from '../src/sim/data.ts';
import { reachabilityReport } from '../src/sim/ladder.ts';
import type { ItemId, ResourceId, StationId } from '../src/sim/types.ts';

const recipe = (id: string) => {
  const found = RECIPES.find((r) => r.id === id);
  if (!found) throw new Error(`레시피가 없어요: ${id}`);
  return found;
};
const resource = (id: ResourceId) => {
  const found = RESOURCES.find((r) => r.id === id);
  if (!found) throw new Error(`자원이 없어요: ${id}`);
  return found;
};
const station = (id: StationId) => {
  const found = STATIONS.find((s) => s.id === id);
  if (!found) throw new Error(`제작대가 없어요: ${id}`);
  return found;
};
const inputs = (id: string) => recipe(id).inputs.map((i) => i.item);

/** 이 재료들을 마련하는 데 거치는 모든 품목(제작물은 재료까지 펼쳐요) */
function closure(items: ItemId[], seen = new Set<ItemId>()): Set<ItemId> {
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    const made = RECIPES.find((r) => r.output.kind === 'item' && r.output.item === item);
    if (made) closure(made.inputs.map((i) => i.item), seen);
  }
  return seen;
}

test('모든 것이 시작 상태에서 도달 가능하고 순환이 없어요', () => {
  assert.deepEqual(reachabilityReport(), { unreachable: [], cycles: [] });
});

test('사슬 1: 등불 ← 구리 주괴·유리 ← 가마', () => {
  assert.deepEqual(inputs('lantern'), ['copper-ingot', 'glass']);
  assert.equal(recipe('copper-ingot').station, 'kiln');
  assert.equal(recipe('glass').station, 'kiln');
  for (const item of closure(inputs('lantern'))) {
    assert.ok(!RESOURCES.some((r) => r.id === item && r.access === 'lantern'), `${item}은 등불이 필요해요`);
  }
});

test('사슬 2: 철 광석 ← 등불·구리 곡괭이', () => {
  assert.equal(resource('iron-ore').access, 'lantern');
  assert.deepEqual(resource('iron-ore').tool, { family: 'pickaxe', minTier: 2 });
  const used = closure([...inputs('copper-pickaxe'), ...inputs('lantern')]);
  assert.ok(!used.has('iron-ore') && !used.has('iron-ingot'));
});

test('사슬 3: 단단한 원목 ← 사다리·구리 도끼', () => {
  assert.equal(resource('hardwood').access, 'ladder');
  assert.deepEqual(resource('hardwood').tool, { family: 'axe', minTier: 2 });
  const used = closure([...inputs('ladder'), ...inputs('copper-axe')]);
  assert.ok(!used.has('hardwood'));
});

test('사슬 4: 대장간 ← 벽돌 ← 점토·석탄', () => {
  assert.ok(station('smithy').items.some((i) => i.item === 'brick'));
  assert.deepEqual(inputs('brick'), ['clay', 'coal']);
  assert.equal(recipe('brick').station, 'kiln');
  const used = closure(station('smithy').items.map((i) => i.item));
  for (const item of used) {
    assert.ok(!RECIPES.some((r) => r.station === 'smithy' && r.output.kind === 'item' && r.output.item === item),
      `${item}은 대장간이 있어야 나와요`);
  }
});
