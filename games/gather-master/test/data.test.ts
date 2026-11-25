import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEMS, MAX_LEVEL_PROTOTYPE, PRICE_MULTIPLIER, RECIPES, TIER_BONUS, xpToNext } from '../src/sim/data.ts';
import { addXp, familySkill } from '../src/sim/skills.ts';
import { GOODS_IDS, RESOURCE_IDS, type Ingredient } from '../src/sim/types.ts';
import { newState, ofKind } from './helpers.ts';

const price = (id: string) => {
  const found = ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`품목이 없어요: ${id}`);
  return found.basePrice;
};
const sum = (inputs: Ingredient[]) => inputs.reduce((acc, i) => acc + price(i.item) * i.qty, 0);

test('모든 ItemId에 ITEMS 행이 하나씩 있어요', () => {
  const ids = [...RESOURCE_IDS, ...GOODS_IDS];
  assert.equal(ITEMS.length, ids.length);
  for (const id of ids) assert.equal(ITEMS.filter((i) => i.id === id).length, 1, id);
});

test('레시피 id가 겹치지 않아요', () => {
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length);
});

test('제작물 기준가 = round(재료합×1.4+단계보너스), XP = ceil(기준가/2)', () => {
  for (const r of RECIPES) {
    if (r.output.kind !== 'item') continue;
    const base = price(r.output.item);
    assert.equal(base, Math.round(sum(r.inputs) * PRICE_MULTIPLIER + TIER_BONUS[r.tier]), `${r.id} 기준가`);
    assert.equal(r.xp, Math.ceil(base / 2), `${r.id} XP`);
  }
});

test('도구·설치물 XP = ceil(재료합/2)', () => {
  for (const r of RECIPES) {
    if (r.output.kind === 'item') continue;
    assert.equal(r.xp, Math.ceil(sum(r.inputs) / 2), r.id);
  }
});

test('레벨 곡선의 누적 XP가 DESIGN 6절 표와 같아요', () => {
  let total = 0;
  const cumulative: number[] = [];
  for (let level = 1; level < MAX_LEVEL_PROTOTYPE; level++) {
    total += xpToNext(level);
    cumulative.push(total);
  }
  assert.deepEqual(cumulative, [20, 81, 197, 381, 644, 996, 1446, 2003, 2676]);
});

test('addXp: 넘친 XP를 이월하고 여러 레벨이 한 번에 올라요', () => {
  const state = newState();
  const first = addXp(state, 'gathering', 25);
  assert.equal(state.skills.gathering.level, 2);
  assert.equal(state.skills.gathering.xp, 5);
  assert.equal(ofKind(first, 'levelUp').length, 1);
  addXp(state, 'gathering', 197 - 25);
  assert.equal(state.skills.gathering.level, 4);
  assert.equal(state.skills.gathering.xp, 0);
  assert.equal(state.skills.gathering.totalXp, 197);
  assert.equal(state.telemetry.xpBySkill.gathering, 197);
  assert.ok(state.telemetry.firstLevelUp !== null);
  assert.equal(state.skills.mining.level, 1);
});

test('addXp: 시제품은 Lv10에서 멈추고 XP는 totalXp에 쌓여요', () => {
  const state = newState();
  addXp(state, 'mining', 2676 + 5000);
  assert.equal(state.skills.mining.level, MAX_LEVEL_PROTOTYPE);
  assert.equal(state.skills.mining.totalXp, 2676 + 5000);
});

test('familySkill: 도끼=채집, 곡괭이=채광, 물뿌리개=농사', () => {
  assert.equal(familySkill('axe'), 'gathering');
  assert.equal(familySkill('pickaxe'), 'mining');
  assert.equal(familySkill('can'), 'farming');
});
