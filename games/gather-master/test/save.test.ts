import assert from 'node:assert/strict';
import test from 'node:test';
import { nextRandom } from '../src/sim/rng.ts';
import { deserialize, serialize } from '../src/sim/save.ts';
import { applyIntent } from '../src/sim/state.ts';
import type { GameState, SaveFile } from '../src/sim/types.ts';
import { copy, NEAR, newState, place, run, world } from './helpers.ts';

function played(): GameState {
  const state = newState(42);
  place(state, NEAR.tree08);
  applyIntent(state, world, { kind: 'gather', nodeId: 'tree-08' });
  run(state, 5.3);
  return state;
}

const sequence = (seed: number) => {
  const state = newState(seed);
  return Array.from({ length: 1000 }, () => nextRandom(state));
};

test('같은 시드면 같은 1000개 수열이고, 값은 [0,1)이에요', () => {
  const a = sequence(42);
  assert.deepEqual(a, sequence(42));
  assert.ok(a.every((v) => v >= 0 && v < 1));
  assert.notEqual(a[0], sequence(43)[0]);
});

test('nextRandom은 mulberry32예요(state.rng 갱신)', () => {
  let a = 42 >>> 0;
  const reference = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const state = newState(42);
  assert.equal(state.rng, 42);
  for (let i = 0; i < 20; i++) assert.equal(nextRandom(state), reference());
});

test('저장 → 불러오기 왕복이 일치해요(활동 중 포함)', () => {
  const state = played();
  const text = serialize(state, 1795600000000);
  const file = JSON.parse(text) as SaveFile;
  assert.equal(file.version, 1);
  assert.equal(file.savedAtEpochMs, 1795600000000);
  const loaded = deserialize(text, world, 1);
  assert.equal(loaded.warning, null);
  assert.deepEqual(loaded.state, state);
});

test('불러온 뒤 이어서 돌리면 원본과 같아요', () => {
  const state = played();
  const loaded = deserialize(serialize(state, 0), world, 1).state;
  run(state, 20);
  run(loaded, 20);
  assert.deepEqual(loaded, state);
});

test('저장이 없으면 새 게임이에요', () => {
  const result = deserialize(null, world, 9);
  assert.deepEqual(result.state, newState(9));
  assert.equal(result.warning, null);
});

function expectFresh(text: string) {
  const result = deserialize(text, world, 9);
  assert.deepEqual(result.state, newState(9));
  assert.ok(typeof result.warning === 'string' && result.warning.length > 0);
}

test('깨진 JSON → 새 게임 + warning', () => {
  expectFresh('{"version":1,');
  expectFresh('null');
});

test('버전 2 → 새 게임 + warning', () => {
  const file = JSON.parse(serialize(played(), 0)) as { version: number };
  file.version = 2;
  expectFresh(JSON.stringify(file));
});

test('지도에 없는 노드 id → 새 게임 + warning', () => {
  const file = copy(JSON.parse(serialize(played(), 0)) as SaveFile);
  file.state.nodes[0]!.id = 'tree-99';
  expectFresh(JSON.stringify(file));
});
