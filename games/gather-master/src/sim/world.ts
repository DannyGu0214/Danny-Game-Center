// 정적 문맥(지도·시계)과 칸 이동 규칙. 칸 중심 좌표는 월드 m 단위예요.
import { LEVEL_HEIGHTS, NODE_KINDS, REACH_METERS } from './data.ts';
import type { ClockRule, MapDef } from './types.ts';

export interface World { map: MapDef; clock: ClockRule }

type Cell = { x: number; z: number };

const CELL = 2;
const SIDES: readonly Cell[] = [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }];

export function cellCenter(cell: Cell, cellSize = CELL): Cell {
  return { x: (cell.x + 0.5) * cellSize, z: (cell.z + 0.5) * cellSize };
}

export function worldToCell(pos: Cell, cellSize = CELL): Cell {
  return { x: Math.floor(pos.x / cellSize), z: Math.floor(pos.z / cellSize) };
}

/** 자리가 고정된 큰 노드(나무·바위…)와 제작대·상점·판매함 자리·텐트 칸. 지도마다 한 번만 만들어요 */
const blockedCache = new WeakMap<MapDef, Set<number>>();
function blockedOf(map: MapDef): Set<number> {
  let set = blockedCache.get(map);
  if (!set) {
    set = new Set();
    for (const node of map.nodes) {
      if (NODE_KINDS.find((k) => k.id === node.kind)?.placement === 'fixed') set.add(node.cell.z * map.grid.width + node.cell.x);
    }
    for (const spot of map.spots) set.add(spot.cell.z * map.grid.width + spot.cell.x);
    blockedCache.set(map, set);
  }
  return set;
}

function indexOf(world: World, cell: Cell): number {
  const { width, height } = world.map.grid;
  if (!Number.isInteger(cell.x) || !Number.isInteger(cell.z)) return -1;
  return cell.x >= 0 && cell.z >= 0 && cell.x < width && cell.z < height ? cell.z * width + cell.x : -1;
}

export function isPassable(world: World, cell: Cell): boolean {
  const i = indexOf(world, cell);
  if (i < 0) return false;
  const kind = world.map.grid.kinds[i];
  return kind !== 'water' && kind !== 'cliff' && !blockedOf(world.map).has(i);
}

/** 4방향 이웃 칸 to로 걸어갈 수 있는지(지나갈 수 있는 칸 + 층 넘기 규칙) */
export function canStep(world: World, from: Cell, to: Cell): boolean {
  if (Math.abs(from.x - to.x) + Math.abs(from.z - to.z) !== 1 || !isPassable(world, to)) return false;
  const a = indexOf(world, from);
  if (a < 0) return false;
  const b = indexOf(world, to);
  const { kinds, levels } = world.map.grid;
  const la = levels[a]!, lb = levels[b]!;
  if (la === lb) return true;
  if (Math.abs(LEVEL_HEIGHTS[la]! - LEVEL_HEIGHTS[lb]!) <= 1) return true;
  if (kinds[a] === 'ramp' && (lb === la || lb === la + 1)) return true;
  return kinds[b] === 'ramp' && (la === lb || la === lb + 1);
}

/** BFS. goal을 처음 만족하는(=가장 적게 걷는) 칸까지의 길. from은 빼고 끝 칸은 넣어요 */
function search(world: World, from: Cell, goal: (cell: Cell) => boolean): Cell[] | null {
  const start = indexOf(world, from);
  if (start < 0) return null;
  const { width } = world.map.grid;
  const came = new Map<number, number>([[start, -1]]);
  const queue: Cell[] = [{ x: from.x, z: from.z }];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    if (goal(cell)) {
      const path: Cell[] = [];
      for (let i = cell.z * width + cell.x; i !== start; i = came.get(i)!) path.push({ x: i % width, z: Math.floor(i / width) });
      return path.reverse();
    }
    for (const side of SIDES) {
      const next = { x: cell.x + side.x, z: cell.z + side.z };
      if (!canStep(world, cell, next)) continue;
      const i = next.z * width + next.x;
      if (came.has(i)) continue;
      came.set(i, cell.z * width + cell.x);
      queue.push(next);
    }
  }
  return null;
}

export function findPath(world: World, from: Cell, to: Cell): Cell[] | null {
  if (!isPassable(world, to)) return null;
  return search(world, from, (c) => c.x === to.x && c.z === to.z);
}

/** target 칸 중심이 REACH_METERS 안인 칸 가운데 from에서 가장 적게 걷는 칸. 없으면 null */
export function approachCell(world: World, from: Cell, target: Cell): Cell | null {
  const size = world.map.grid.cellSize;
  const goal = cellCenter(target, size);
  const near = (cell: Cell) => {
    const c = cellCenter(cell, size);
    return Math.hypot(c.x - goal.x, c.z - goal.z) <= REACH_METERS;
  };
  const path = search(world, from, near);
  if (!path) return null;
  return path[path.length - 1] ?? { x: from.x, z: from.z };
}
