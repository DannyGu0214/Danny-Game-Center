import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOCK_PROTOTYPE } from '../src/sim/data.ts';
import { P1_MAP, P1_ROWS, parseGrid } from '../src/sim/map-p1.ts';
import { approachCell, canStep, cellCenter, findPath, isPassable, worldToCell, type World } from '../src/sim/world.ts';
import { world } from './helpers.ts';

const bare = (rows: string[]): World => ({
  map: { grid: parseGrid(rows), start: { x: 0, z: 0 }, nodes: [], spots: [] },
  clock: CLOCK_PROTOTYPE,
});
const manhattan = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

test('칸 중심과 월드 좌표가 서로 바뀌어요', () => {
  assert.deepEqual(cellCenter({ x: 0, z: 0 }), { x: 1, z: 1 });
  assert.deepEqual(cellCenter({ x: 10, z: 12 }), { x: 21, z: 25 });
  assert.deepEqual(worldToCell({ x: 21.9, z: 24.1 }), { x: 10, z: 12 });
});

test('언덕은 경사로 (15,7)을 거쳐서 올라가요', () => {
  const path = findPath(world, P1_MAP.start, { x: 15, z: 5 });
  assert.ok(path);
  assert.ok(path.some((c) => c.x === 15 && c.z === 7), '경사로를 지나야 해요');
  assert.deepEqual(path[path.length - 1], { x: 15, z: 5 });
  let from: { x: number; z: number } = P1_MAP.start;
  for (const to of path) {
    assert.equal(manhattan(from, to), 1, '4방향 한 칸씩이에요(from 제외)');
    assert.ok(isPassable(world, to) && canStep(world, from, to));
    from = to;
  }
});

test('경사로를 막으면 언덕으로 가는 길이 없어요', () => {
  const rows = P1_ROWS.map((row) => row.replace('/', '#'));
  const closed: World = { map: { ...P1_MAP, grid: parseGrid(rows) }, clock: CLOCK_PROTOTYPE };
  assert.equal(findPath(closed, P1_MAP.start, { x: 15, z: 5 }), null);
});

test('물·절벽 칸으로 가는 길은 null이에요', () => {
  assert.equal(findPath(world, P1_MAP.start, { x: 5, z: 18 }), null);
  assert.equal(findPath(world, P1_MAP.start, { x: 12, z: 3 }), null);
  assert.equal(isPassable(world, { x: 5, z: 18 }), false);
  assert.equal(isPassable(world, { x: 12, z: 3 }), false);
});

test('층0↔층1은 지나가고, 경사로 없는 층1↔층2는 막혀요', () => {
  assert.ok(canStep(world, { x: 5, z: 15 }, { x: 5, z: 16 }));
  assert.ok(canStep(world, { x: 5, z: 16 }, { x: 5, z: 15 }));
  const cliffless = bare(['gh']);
  assert.equal(canStep(cliffless, { x: 0, z: 0 }, { x: 1, z: 0 }), false);
  assert.equal(canStep(cliffless, { x: 1, z: 0 }, { x: 0, z: 0 }), false);
  const ramp = bare(['g/h']);
  assert.ok(canStep(ramp, { x: 0, z: 0 }, { x: 1, z: 0 }));
  assert.ok(canStep(ramp, { x: 1, z: 0 }, { x: 2, z: 0 }));
  assert.ok(canStep(ramp, { x: 2, z: 0 }, { x: 1, z: 0 }));
});

test('나무·바위·제작대·상점·판매함 자리·텐트는 막고, 가지·갈대 자리는 지나가요', () => {
  for (const n of P1_MAP.nodes) {
    const blocked = n.kind === 'tree' || n.kind === 'rock';
    assert.equal(isPassable(world, n.cell), !blocked, n.id);
  }
  for (const s of P1_MAP.spots) assert.equal(isPassable(world, s.cell), false, s.id);
});

test('approachCell은 상하좌우 옆 칸을 골라요(대각선은 닿지 않아요)', () => {
  const target = { x: 9, z: 11 };
  for (const from of [P1_MAP.start, { x: 8, z: 10 }, { x: 10, z: 12 }, { x: 4, z: 4 }]) {
    const cell = approachCell(world, from, target);
    assert.ok(cell);
    assert.equal(manhattan(cell, target), 1, `from ${from.x},${from.z}`);
    assert.ok(isPassable(world, cell));
  }
});

test('approachCell은 이미 옆 칸이면 그 칸을 돌려줘요', () => {
  assert.deepEqual(approachCell(world, { x: 9, z: 12 }, { x: 9, z: 11 }), { x: 9, z: 12 });
});

test('닿을 칸이 없으면 approachCell은 null이에요', () => {
  assert.equal(approachCell(world, P1_MAP.start, { x: 5, z: 19 }), null);
});
