import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOCK, MAX_STEP } from '../src/sim/data.ts';
import { applyIntent, tick } from '../src/sim/state.ts';
import { NEAR, newState, node, ofKind, place, run, world } from './helpers.ts';

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

test('시제품은 실제 1초 = 게임 8분, 정식은 2분이에요', () => {
  const proto = newState();
  run(proto, 1);
  close(proto.gameMinutes, 8);
  close(proto.realSeconds, 1);
  const full = newState();
  run(full, 1, { ...world, clock: CLOCK });
  close(full.gameMinutes, 2);
});

test('큰 dt는 0.1초로 잘려요', () => {
  const state = newState();
  tick(state, world, 10);
  close(state.realSeconds, MAX_STEP);
  close(state.gameMinutes, MAX_STEP * 8);
});

test('잠자기는 다음 06:00으로 가고 dayStarted가 한 번 나와요', () => {
  const state = newState();
  run(state, 12.5);
  const real = state.realSeconds;
  const events = applyIntent(state, world, { kind: 'sleep' });
  assert.equal(state.gameMinutes, 1440);
  close(state.realSeconds, real);
  assert.deepEqual(ofKind(events, 'dayStarted'), [{ kind: 'dayStarted', day: 2 }]);
  assert.equal(ofKind(run(state, 2), 'dayStarted').length, 0);
});

test('06:00 정각에 자면 하루가 지나요', () => {
  const state = newState();
  state.gameMinutes = 1440;
  const events = applyIntent(state, world, { kind: 'sleep' });
  assert.equal(state.gameMinutes, 2880);
  assert.equal(ofKind(events, 'dayStarted').length, 1);
});

test('자지 않아도 180초면 아침이 한 번 와요', () => {
  const state = newState();
  assert.equal(ofKind(run(state, 179), 'dayStarted').length, 0);
  assert.equal(ofKind(run(state, 2), 'dayStarted').length, 1);
});

test('잠자기는 하던 일을 멈추고, 지난 노드를 되살려요', () => {
  const state = newState();
  Object.assign(node(state, 'rock-01'), { hitsLeft: 0, depletedAt: 0 });
  place(state, NEAR.tree08);
  applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' });
  const events = applyIntent(state, world, { kind: 'sleep' });
  assert.equal(state.player.activity.kind, 'idle');
  assert.equal(node(state, 'rock-01').hitsLeft, 3);
  assert.ok(ofKind(events, 'nodeRespawned').some((e) => e.nodeId === 'rock-01'));
});

test('아침마다 정산은 한 번이에요', () => {
  const state = newState();
  state.placeables.consignBoxes = 1;
  state.boxes = [[{ item: 'plank', qty: 1 }]];
  const events = applyIntent(state, world, { kind: 'sleep' });
  events.push(...run(state, 5));
  assert.equal(ofKind(events, 'boxSettled').length, 1);
  assert.equal(state.coins, 12);
});
