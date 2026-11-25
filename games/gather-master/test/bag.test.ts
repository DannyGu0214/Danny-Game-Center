import assert from 'node:assert/strict';
import test from 'node:test';
import { addItems, canAdd, countItem, removeItems } from '../src/sim/bag.ts';
import type { BagSlot } from '../src/sim/types.ts';
import { copy, newState } from './helpers.ts';

const empty = (n: number): BagSlot[] => Array.from({ length: n }, () => null);

test('새 상태의 가방은 빈 12칸이에요', () => {
  assert.deepEqual(newState().bag, empty(12));
});

test('같은 품목 칸부터 채우고 넘치면 빈 칸을 써요', () => {
  const bag: BagSlot[] = [null, { item: 'log', qty: 18 }, null];
  assert.ok(addItems(bag, [{ item: 'log', qty: 5 }]));
  assert.deepEqual(bag, [{ item: 'log', qty: 3 }, { item: 'log', qty: 20 }, null]);
  assert.equal(countItem(bag, 'log'), 23);
  assert.equal(countItem(bag, 'stone'), 0);
});

test('가득 차면 넣지 못하고 가방은 그대로예요', () => {
  const bag: BagSlot[] = [{ item: 'stone', qty: 20 }, { item: 'log', qty: 20 }];
  const before = copy(bag);
  assert.equal(canAdd(bag, [{ item: 'log', qty: 1 }]), false);
  assert.equal(addItems(bag, [{ item: 'log', qty: 1 }]), false);
  assert.deepEqual(bag, before);
});

test('넣기는 부분 성공이 없어요', () => {
  const bag: BagSlot[] = [{ item: 'log', qty: 19 }, null];
  const before = copy(bag);
  const items = [{ item: 'stone' as const, qty: 20 }, { item: 'log' as const, qty: 2 }];
  assert.equal(canAdd(bag, items), false);
  assert.equal(addItems(bag, items), false);
  assert.deepEqual(bag, before);
});

test('canAdd는 가방을 고치지 않아요', () => {
  const bag = empty(2);
  assert.ok(canAdd(bag, [{ item: 'log', qty: 40 }]));
  assert.deepEqual(bag, empty(2));
});

test('빼기는 여러 칸에 걸치고, 비운 칸은 null이에요', () => {
  const bag: BagSlot[] = [{ item: 'log', qty: 20 }, { item: 'log', qty: 3 }];
  assert.ok(removeItems(bag, [{ item: 'log', qty: 23 }]));
  assert.deepEqual(bag, [null, null]);
});

test('빼기도 부분 성공이 없어요', () => {
  const bag: BagSlot[] = [{ item: 'plank', qty: 4 }, { item: 'rope', qty: 1 }];
  const before = copy(bag);
  assert.equal(removeItems(bag, [{ item: 'plank', qty: 4 }, { item: 'rope', qty: 2 }]), false);
  assert.deepEqual(bag, before);
});
