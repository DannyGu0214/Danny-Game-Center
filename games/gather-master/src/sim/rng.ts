import type { GameState } from './types.ts';

/** mulberry32. state.rng를 갱신하고 [0,1) 값을 돌려줘요. 게임의 모든 무작위는 이 함수를 거쳐요 */
export function nextRandom(state: GameState): number {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
