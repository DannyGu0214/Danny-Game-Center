import assert from 'node:assert/strict';
import test from 'node:test';
import { addItems, countItem } from '../src/sim/bag.ts';
import { applyIntent, boxQuote, shopQuote } from '../src/sim/state.ts';
import type { GameState, Ingredient } from '../src/sim/types.ts';
import { copy, NEAR, newState, ofKind, place, run, world } from './helpers.ts';

function atShop(items: Ingredient[]): GameState {
  const state = newState();
  place(state, NEAR.shop);
  assert.ok(addItems(state.bag, items));
  return state;
}
function atBox(items: Ingredient[]): GameState {
  const state = newState();
  place(state, NEAR.box);
  state.placeables.consignBoxes = 1;
  state.boxes = [[]];
  assert.ok(addItems(state.bag, items));
  return state;
}

test('상점은 기준가×0.6, 21번째부터 ×0.3이고 거래 합계를 내림해요', () => {
  const state = atShop([{ item: 'plank', qty: 22 }]);
  assert.equal(shopQuote(state, 'plank', 1), 9);
  assert.equal(shopQuote(state, 'plank', 20), 192);
  assert.equal(shopQuote(state, 'plank', 22), 201);
  const events = applyIntent(state, world, { kind: 'sellShop', item: 'plank', qty: 20 });
  assert.deepEqual(ofKind(events, 'sold'), [{ kind: 'sold', channel: 'shop', item: 'plank', qty: 20, coins: 192 }]);
  assert.equal(state.coins, 192);
  assert.equal(state.shopSoldToday.plank, 20);
  assert.equal(shopQuote(state, 'plank', 1), 4);
  applyIntent(state, world, { kind: 'sellShop', item: 'plank', qty: 1 });
  assert.equal(state.coins, 196);
  assert.equal(state.telemetry.coinsByChannel.shop, 196);
  assert.equal(state.telemetry.salesByChannel.shop, 21);
  assert.ok(state.telemetry.firstSale !== null);
});

test('상점 하루 한도는 아침에 다시 비어요', () => {
  const state = atShop([{ item: 'plank', qty: 20 }]);
  applyIntent(state, world, { kind: 'sellShop', item: 'plank', qty: 20 });
  applyIntent(state, world, { kind: 'sleep' });
  assert.equal(shopQuote(state, 'plank', 1), 9);
});

test('상점 판매는 XP를 주지 않아요', () => {
  const state = atShop([{ item: 'plank', qty: 2 }]);
  const before = copy(state.skills);
  applyIntent(state, world, { kind: 'sellShop', item: 'plank', qty: 2 });
  assert.deepEqual(state.skills, before);
});

test('상점: 멀거나 수량이 모자라면 거절하고 아무것도 바뀌지 않아요', () => {
  const state = atShop([{ item: 'plank', qty: 1 }]);
  const before = copy(state);
  assert.deepEqual(applyIntent(state, world, { kind: 'sellShop', item: 'plank', qty: 2 }),
    [{ kind: 'rejected', intent: 'sellShop', reason: 'need-items' }]);
  assert.deepEqual(state, before);
  place(state, NEAR.tree08);
  assert.deepEqual(applyIntent(state, world, { kind: 'sellShop', item: 'plank', qty: 1 }),
    [{ kind: 'rejected', intent: 'sellShop', reason: 'too-far' }]);
});

test('판매함: 판자 12개는 아침에 142코인이고 그 전에는 코인이 그대로예요', () => {
  const state = atBox([{ item: 'plank', qty: 12 }]);
  applyIntent(state, world, { kind: 'depositBox', boxIndex: 0, item: 'plank', qty: 12 });
  assert.equal(countItem(state.bag, 'plank'), 0);
  assert.equal(boxQuote(state), 142);
  run(state, 10);
  assert.equal(state.coins, 0);
  const events = applyIntent(state, world, { kind: 'sleep' });
  assert.equal(state.coins, 142);
  const [settled] = ofKind(events, 'boxSettled');
  assert.deepEqual(settled, { kind: 'boxSettled', coins: 142, lines: [{ item: 'plank', qty: 12, coins: 142 }] });
  assert.deepEqual(state.boxes, [[]]);
  assert.equal(boxQuote(state), 0);
  assert.equal(state.telemetry.coinsByChannel.box, 142);
  assert.equal(state.telemetry.salesByChannel.box, 12);
});

test('판매함: 품목 줄마다 내림하고, 감쇠는 품목별로 세요', () => {
  const state = atBox([{ item: 'plank', qty: 1 }, { item: 'rope', qty: 1 }]);
  applyIntent(state, world, { kind: 'depositBox', boxIndex: 0, item: 'plank', qty: 1 });
  applyIntent(state, world, { kind: 'depositBox', boxIndex: 0, item: 'rope', qty: 1 });
  assert.equal(boxQuote(state), 12 + 12);
});

test('판매함: 자지 않아도 아침이 오면 정산해요', () => {
  const state = atBox([{ item: 'plank', qty: 1 }]);
  applyIntent(state, world, { kind: 'depositBox', boxIndex: 0, item: 'plank', qty: 1 });
  const events = run(state, 180.2);
  assert.equal(ofKind(events, 'boxSettled').length, 1);
  assert.equal(state.coins, 12);
});

test('판매함: 꺼내면 가방으로 돌아오고, 가방이 가득하면 그대로예요', () => {
  const state = atBox([{ item: 'plank', qty: 3 }]);
  applyIntent(state, world, { kind: 'depositBox', boxIndex: 0, item: 'plank', qty: 3 });
  assert.ok(addItems(state.bag, [{ item: 'stone', qty: 240 }]));
  assert.deepEqual(applyIntent(state, world, { kind: 'withdrawBox', boxIndex: 0, slot: 0 }),
    [{ kind: 'rejected', intent: 'withdrawBox', reason: 'bag-full' }]);
  assert.deepEqual(state.boxes, [[{ item: 'plank', qty: 3 }]]);
  state.bag.fill(null);
  applyIntent(state, world, { kind: 'withdrawBox', boxIndex: 0, slot: 0 });
  assert.equal(countItem(state.bag, 'plank'), 3);
  assert.deepEqual(state.boxes, [[]]);
});

test('판매함이 없으면 no-box, 10칸이 다 차면 box-full이에요', () => {
  const none = newState();
  place(none, NEAR.box);
  addItems(none.bag, [{ item: 'plank', qty: 1 }]);
  assert.deepEqual(applyIntent(none, world, { kind: 'depositBox', boxIndex: 0, item: 'plank', qty: 1 }),
    [{ kind: 'rejected', intent: 'depositBox', reason: 'no-box' }]);
  const full = atBox([{ item: 'plank', qty: 1 }]);
  full.boxes = [Array.from({ length: 10 }, () => ({ item: 'stone' as const, qty: 20 }))];
  assert.deepEqual(applyIntent(full, world, { kind: 'depositBox', boxIndex: 0, item: 'plank', qty: 1 }),
    [{ kind: 'rejected', intent: 'depositBox', reason: 'box-full' }]);
  assert.equal(countItem(full.bag, 'plank'), 1);
});
