// 가방 순수 함수. 제자리에서 고치고, 실패하면 아무것도 바꾸지 않아요.
import { ITEMS } from './data.ts';
import type { BagSlot, Ingredient, ItemId } from './types.ts';

const stackOf = (item: ItemId): number => ITEMS.find((i) => i.id === item)!.stack;

/** 같은 품목 줄을 합쳐요. 개수가 0 이상의 정수가 아니면 null */
function totals(items: Ingredient[]): Map<ItemId, number> | null {
  const sum = new Map<ItemId, number>();
  for (const { item, qty } of items) {
    if (!Number.isInteger(qty) || qty < 0) return null;
    if (qty > 0) sum.set(item, (sum.get(item) ?? 0) + qty);
  }
  return sum;
}

export function countItem(bag: BagSlot[], item: ItemId): number {
  let n = 0;
  for (const slot of bag) if (slot?.item === item) n += slot.qty;
  return n;
}

/** 같은 품목 칸부터 채우고 그다음 빈 칸을 써요. 다 들어가면 true */
function fill(bag: BagSlot[], wanted: Map<ItemId, number>): boolean {
  for (const [item, qty] of wanted) {
    const stack = stackOf(item);
    let left = qty;
    for (const slot of bag) {
      if (left > 0 && slot?.item === item) {
        const put = Math.min(left, stack - slot.qty);
        slot.qty += put;
        left -= put;
      }
    }
    for (let i = 0; i < bag.length && left > 0; i++) {
      if (bag[i] === null) {
        const put = Math.min(left, stack);
        bag[i] = { item, qty: put };
        left -= put;
      }
    }
    if (left > 0) return false;
  }
  return true;
}

export function canAdd(bag: BagSlot[], items: Ingredient[]): boolean {
  const wanted = totals(items);
  return wanted !== null && fill(bag.map((s) => (s ? { ...s } : null)), wanted);
}

export function addItems(bag: BagSlot[], items: Ingredient[]): boolean {
  if (!canAdd(bag, items)) return false;
  return fill(bag, totals(items)!);
}

export function removeItems(bag: BagSlot[], items: Ingredient[]): boolean {
  const wanted = totals(items);
  if (!wanted) return false;
  for (const [item, qty] of wanted) if (countItem(bag, item) < qty) return false;
  for (const [item, qty] of wanted) {
    let left = qty;
    for (let i = bag.length - 1; i >= 0 && left > 0; i--) {
      const slot = bag[i];
      if (slot?.item !== item) continue;
      const take = Math.min(left, slot.qty);
      slot.qty -= take;
      left -= take;
      if (slot.qty === 0) bag[i] = null;
    }
  }
  return true;
}
