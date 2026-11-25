import assert from 'node:assert/strict';
import test from 'node:test';
import { addItems, countItem } from '../src/sim/bag.ts';
import { RESOURCES } from '../src/sim/data.ts';
import { applyIntent } from '../src/sim/state.ts';
import { approachCell, worldToCell } from '../src/sim/world.ts';
import { NEAR, newState, node, ofKind, place, run, setLevel, world } from './helpers.ts';

test('나무: 3번 휘두르면 통나무 1개와 XP 6', () => {
  const state = newState();
  place(state, NEAR.tree08);
  const events = applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' });
  events.push(...run(state, 2.2));
  assert.equal(countItem(state.bag, 'log'), 0, '2.4초 전에는 아직이에요');
  events.push(...run(state, 0.4));
  assert.equal(countItem(state.bag, 'log'), 1);
  assert.equal(ofKind(events, 'swing').length, 3);
  assert.equal(state.skills.gathering.totalXp, 6);
  assert.equal(node(state, 'tree-08').hitsLeft, 2);
  assert.ok(state.seenItems.includes('log'));
  assert.ok(state.telemetry.firstGather !== null);
  const [got] = ofKind(events, 'gathered');
  assert.deepEqual(got, { kind: 'gathered', nodeId: 'tree-08', item: 'log', qty: 1, xp: 6, skill: 'gathering' });
});

test('나무: 3개 캐면 고갈되고 멈추며, 게임 240분 뒤 되살아나요', () => {
  const state = newState();
  place(state, NEAR.tree08);
  applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' });
  const events = run(state, 8);
  assert.equal(countItem(state.bag, 'log'), 3);
  assert.equal(node(state, 'tree-08').hitsLeft, 0);
  assert.ok(node(state, 'tree-08').depletedAt !== null);
  assert.equal(ofKind(events, 'nodeDepleted').length, 1);
  assert.equal(state.player.activity.kind, 'idle');
  assert.deepEqual(applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' }),
    [{ kind: 'rejected', intent: 'gather', reason: 'node-depleted' }]);
  // 시제품 시계는 실제 1초 = 게임 8분 → 240분 = 실제 30초
  assert.equal(ofKind(run(state, 25), 'nodeRespawned').length, 0);
  const later = run(state, 35);
  assert.equal(ofKind(later, 'nodeRespawned').filter((e) => e.nodeId === 'tree-08').length, 1);
  assert.equal(node(state, 'tree-08').hitsLeft, 3);
  assert.equal(node(state, 'tree-08').depletedAt, null);
});

test('통나무는 맨손 자원이 아니라 도끼 자원이에요', () => {
  const log = RESOURCES.find((r) => r.id === 'log');
  assert.deepEqual(log?.tool, { family: 'axe', minTier: 0 });
});

test('돌 도끼는 휘두르기를 ×1.3 빠르게 해요', () => {
  const wood = newState();
  const stone = newState();
  stone.tools.axe = 1;
  for (const s of [wood, stone]) {
    place(s, NEAR.tree08);
    applyIntent(s, world, { kind: 'gather', nodeId: 'tree-08' });
  }
  run(wood, 1.7);
  run(stone, 1.7);
  assert.equal(countItem(stone.bag, 'log'), 0, '0.8÷1.3×3 = 1.85초 전에는 아직이에요');
  run(wood, 0.5);
  run(stone, 0.5);
  assert.equal(countItem(stone.bag, 'log'), 1);
  assert.equal(countItem(wood.bag, 'log'), 0);
});

test('맨손 자원은 도구 단계와 상관없이 0.8초예요', () => {
  const state = newState();
  state.tools.axe = 4;
  place(state, NEAR.branch01);
  applyIntent(state, world, { kind: 'gather', nodeId: 'branch-01' });
  run(state, 0.7);
  assert.equal(countItem(state.bag, 'branch'), 0);
  run(state, 0.2);
  assert.equal(countItem(state.bag, 'branch'), 1);
});

test('갈대는 채집 Lv1이면 거절하고 Lv2면 캐요', () => {
  const state = newState();
  place(state, NEAR.reed01);
  assert.deepEqual(applyIntent(state, world, { kind: 'gather', nodeId: 'reed-01' }),
    [{ kind: 'rejected', intent: 'gather', reason: 'need-level' }]);
  assert.equal(state.player.activity.kind, 'idle');
  setLevel(state, 'gathering', 2);
  applyIntent(state, world, { kind: 'gather', nodeId: 'reed-01' });
  run(state, 1);
  assert.equal(countItem(state.bag, 'reed'), 1);
});

test('멀거나 대각선이면 too-far예요', () => {
  const state = newState();
  const rejected = [{ kind: 'rejected' as const, intent: 'gather' as const, reason: 'too-far' as const }];
  assert.deepEqual(applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' }), rejected);
  place(state, { x: 4, z: 9 });
  assert.deepEqual(applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' }), rejected);
});

test('가방이 가득 차면 bag-full로 멈추고 노드는 줄지 않아요', () => {
  const state = newState();
  assert.ok(addItems(state.bag, [{ item: 'stone', qty: 240 }]));
  place(state, NEAR.tree08);
  const events = applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' });
  events.push(...run(state, 4));
  assert.ok(ofKind(events, 'rejected').some((e) => e.reason === 'bag-full'));
  assert.equal(state.player.activity.kind, 'idle');
  assert.equal(node(state, 'tree-08').hitsLeft, 3);
  assert.equal(state.skills.gathering.totalXp, 0);
});

test('stopAction은 캐기를 멈춰요', () => {
  const state = newState();
  place(state, NEAR.tree08);
  applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' });
  run(state, 1);
  applyIntent(state, world, { kind: 'stopAction' });
  run(state, 3);
  assert.equal(countItem(state.bag, 'log'), 0);
  assert.equal(state.player.activity.kind, 'idle');
});

test('moveTo + then: gather는 걸어가서 캐요', () => {
  const state = newState();
  const cell = approachCell(world, worldToCell(state.player), { x: 5, z: 8 });
  assert.ok(cell);
  applyIntent(state, world, { kind: 'moveTo', cell, then: { kind: 'gather', nodeId: 'tree-08' } });
  assert.equal(state.player.activity.kind, 'walking');
  run(state, 16); // 걷기 약 5초 + 통나무 3개 7.2초
  assert.deepEqual(worldToCell(state.player), cell);
  assert.equal(countItem(state.bag, 'log'), 3);
});

/** 같은 바위를 되살려 가며 돌 count개를 캐고, 나온 화석 수를 돌려줘요 */
function mineStones(pickaxe: 0 | 1, miningLevel: number, count: number, seed: number): number {
  const state = newState(seed);
  state.tools.pickaxe = pickaxe;
  setLevel(state, 'mining', miningLevel);
  place(state, NEAR.rock01);
  let stones = 0;
  let fossils = 0;
  while (stones < count) {
    state.bag.fill(null);
    Object.assign(node(state, 'rock-01'), { hitsLeft: 3, depletedAt: null });
    applyIntent(state, world, { kind: 'gather', nodeId: 'rock-01' });
    const events = run(state, 8);
    for (const e of ofKind(events, 'gathered')) {
      if (e.item === 'stone') stones += e.qty;
    }
    fossils += countItem(state.bag, 'fossil');
    if (events.length === 0) throw new Error('캐기가 진행되지 않아요');
  }
  return fossils;
}

test('화석은 채광 Lv6 + 돌 곡괭이부터 가끔 나와요', () => {
  assert.equal(mineStones(0, 6, 300, 3), 0);
  assert.equal(mineStones(1, 5, 3, 3), 0);
  const found = mineStones(1, 10, 600, 3);
  assert.ok(found > 0 && found < 40, `600개 중 화석 ${found}개`);
});
