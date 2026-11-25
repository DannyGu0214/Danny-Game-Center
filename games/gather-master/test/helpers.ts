// 테스트 공통 도우미. 파일 이름이 *.test.ts가 아니라서 테스트로는 돌지 않아요.
import { CLOCK_PROTOTYPE } from '../src/sim/data.ts';
import { P1_MAP } from '../src/sim/map-p1.ts';
import { createState, tick } from '../src/sim/state.ts';
import type { GameState, SimEvent, SkillId } from '../src/sim/types.ts';
import { cellCenter, type World } from '../src/sim/world.ts';

export const world: World = { map: P1_MAP, clock: CLOCK_PROTOTYPE };

/** 상호작용 대상 바로 옆(상하좌우)의 지나갈 수 있는 칸 */
export const NEAR = {
  tree08: { x: 5, z: 9 },
  rock01: { x: 10, z: 10 },
  reed01: { x: 2, z: 16 },
  branch01: { x: 3, z: 9 },
  workbench: { x: 9, z: 12 },
  shop: { x: 12, z: 13 },
  box: { x: 7, z: 13 },
} as const;

export function newState(seed = 7): GameState {
  return createState(world, seed);
}

export function place(state: GameState, cell: { x: number; z: number }): void {
  const pos = cellCenter(cell);
  state.player.x = pos.x;
  state.player.z = pos.z;
}

/** dt 0.1초로 seconds만큼 돌리고 사건을 모아요 */
export function run(state: GameState, seconds: number, w: World = world): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 10); i++) events.push(...tick(state, w, 0.1));
  return events;
}

export function setLevel(state: GameState, skill: SkillId, level: number): void {
  state.skills[skill].level = level;
}

export function ofKind<K extends SimEvent['kind']>(events: SimEvent[], kind: K): Extract<SimEvent, { kind: K }>[] {
  return events.filter((e): e is Extract<SimEvent, { kind: K }> => e.kind === kind);
}

export function node(state: GameState, id: string) {
  const found = state.nodes.find((n) => n.id === id);
  if (!found) throw new Error(`노드가 없어요: ${id}`);
  return found;
}

export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
