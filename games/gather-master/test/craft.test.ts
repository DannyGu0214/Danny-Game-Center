import assert from 'node:assert/strict';
import test from 'node:test';
import { addItems, countItem, removeItems } from '../src/sim/bag.ts';
import { applyIntent, canCraft, visibleRecipes } from '../src/sim/state.ts';
import type { GameState, Ingredient } from '../src/sim/types.ts';
import { copy, NEAR, newState, ofKind, place, run, setLevel, world } from './helpers.ts';

function atBench(items: Ingredient[]): GameState {
  const state = newState();
  place(state, NEAR.workbench);
  assert.ok(addItems(state.bag, items));
  return state;
}

test('판자: 재료가 모자라면 아무것도 바뀌지 않아요', () => {
  const state = atBench([{ item: 'log', qty: 1 }]);
  assert.equal(canCraft(state, world, 'plank'), 'need-items');
  const before = copy(state);
  assert.deepEqual(applyIntent(state, world, { kind: 'craft', recipeId: 'plank' }),
    [{ kind: 'rejected', intent: 'craft', reason: 'need-items' }]);
  assert.deepEqual(state, before);
});

test('판자: 3초 뒤에 재료 소모와 산출이 한 번에 일어나요', () => {
  const state = atBench([{ item: 'log', qty: 2 }]);
  assert.equal(canCraft(state, world, 'plank'), null);
  applyIntent(state, world, { kind: 'craft', recipeId: 'plank' });
  run(state, 2.8);
  assert.equal(countItem(state.bag, 'log'), 2, '끝나기 전에는 재료가 그대로예요');
  assert.equal(countItem(state.bag, 'plank'), 0);
  const events = run(state, 0.4);
  assert.equal(countItem(state.bag, 'log'), 0);
  assert.equal(countItem(state.bag, 'plank'), 1);
  assert.deepEqual(ofKind(events, 'crafted'), [{ kind: 'crafted', recipeId: 'plank', xp: 8 }]);
  assert.equal(state.skills.crafting.totalXp, 8);
  assert.ok(state.telemetry.firstCraft !== null);
  assert.equal(state.player.activity.kind, 'idle');
});

test('제작 중 재료가 사라지면 끝날 때 거절하고 아무것도 만들지 않아요', () => {
  const state = atBench([{ item: 'log', qty: 2 }]);
  applyIntent(state, world, { kind: 'craft', recipeId: 'plank' });
  run(state, 1);
  assert.ok(removeItems(state.bag, [{ item: 'log', qty: 1 }]));
  const events = run(state, 3);
  assert.ok(ofKind(events, 'rejected').some((e) => e.reason === 'need-items'));
  assert.equal(countItem(state.bag, 'log'), 1);
  assert.equal(countItem(state.bag, 'plank'), 0);
  assert.equal(state.skills.crafting.totalXp, 0);
});

test('제작을 멈추면 아무것도 바뀌지 않아요', () => {
  const state = atBench([{ item: 'log', qty: 2 }]);
  applyIntent(state, world, { kind: 'craft', recipeId: 'plank' });
  run(state, 1);
  applyIntent(state, world, { kind: 'stopAction' });
  run(state, 4);
  assert.equal(countItem(state.bag, 'log'), 2);
  assert.equal(countItem(state.bag, 'plank'), 0);
});

test('제작대에서 멀면 too-far예요', () => {
  const state = newState();
  place(state, { x: 2, z: 13 });
  addItems(state.bag, [{ item: 'log', qty: 2 }]);
  assert.equal(canCraft(state, world, 'plank'), 'too-far');
});

test('세우지 않은 제작대의 레시피는 need-station이에요', () => {
  const state = atBench([{ item: 'clay', qty: 2 }, { item: 'coal', qty: 1 }]);
  assert.equal(canCraft(state, world, 'brick'), 'need-station');
});

test('돌 도끼: 제작 Lv2와 채집 Lv3이 모두 필요하고, 다시는 못 만들어요', () => {
  const state = atBench([{ item: 'branch', qty: 4 }, { item: 'stone', qty: 6 }]);
  setLevel(state, 'gathering', 3);
  assert.equal(canCraft(state, world, 'stone-axe'), 'need-level');
  setLevel(state, 'crafting', 2);
  setLevel(state, 'gathering', 2);
  assert.equal(canCraft(state, world, 'stone-axe'), 'need-level');
  setLevel(state, 'gathering', 3);
  assert.equal(canCraft(state, world, 'stone-axe'), null);
  applyIntent(state, world, { kind: 'craft', recipeId: 'stone-axe' });
  run(state, 3.2);
  assert.equal(state.tools.axe, 1);
  assert.equal(countItem(state.bag, 'branch'), 2);
  assert.equal(countItem(state.bag, 'stone'), 3);
  assert.ok(state.telemetry.firstTool !== null);
  assert.equal(canCraft(state, world, 'stone-axe'), 'blocked');
});

test('돌 곡괭이는 채광 레벨을 봐요', () => {
  const state = atBench([{ item: 'branch', qty: 2 }, { item: 'stone', qty: 3 }]);
  setLevel(state, 'crafting', 2);
  setLevel(state, 'gathering', 3);
  assert.equal(canCraft(state, world, 'stone-pickaxe'), 'need-level');
  setLevel(state, 'mining', 3);
  assert.equal(canCraft(state, world, 'stone-pickaxe'), null);
});

test('판매함: 하나 만들면 빈 함이 생기고, 1단계 집에서 2개째는 blocked예요', () => {
  const state = atBench([{ item: 'plank', qty: 8 }, { item: 'rope', qty: 4 }]);
  setLevel(state, 'crafting', 2);
  applyIntent(state, world, { kind: 'craft', recipeId: 'consign-box' });
  run(state, 3.2);
  assert.equal(state.placeables.consignBoxes, 1);
  assert.deepEqual(state.boxes, [[]]);
  assert.equal(countItem(state.bag, 'plank'), 4);
  assert.equal(canCraft(state, world, 'consign-box'), 'blocked');
});

test('레시피는 재료를 하나라도 본 것만 보여요', () => {
  const state = newState();
  assert.deepEqual(visibleRecipes(state), []);
  state.seenItems.push('log');
  const ids = visibleRecipes(state).map((r) => r.id);
  assert.ok(ids.includes('plank'));
  assert.ok(!ids.includes('rope'));
});

test('모르는 레시피는 unknown이에요', () => {
  assert.equal(canCraft(atBench([]), world, 'nope'), 'unknown');
});
