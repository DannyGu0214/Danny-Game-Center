// 저장 문자열 ↔ 상태. localStorage 읽고 쓰기는 화면 쪽 몫이에요.
import { ITEMS } from './data.ts';
import { createState } from './state.ts';
import type { World } from './world.ts';
import { SKILLS, TOOL_FAMILIES } from './types.ts';
import type { GameState, SaveFile } from './types.ts';

export function serialize(state: GameState, nowMs: number): string {
  const file: SaveFile = { version: 1, savedAtEpochMs: nowMs, state };
  return JSON.stringify(file);
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isItem = (v: unknown): boolean => ITEMS.some((i) => i.id === v);
const isStack = (v: unknown): boolean => isObject(v) && isItem(v.item) && isNumber(v.qty) && v.qty > 0;

/** 불러온 뒤 규칙이 죽지 않을 만큼 모양을 확인해요. 문제가 있으면 이유, 없으면 null */
function problem(s: unknown, world: World): string | null {
  if (!isObject(s) || s.version !== 1) return '저장 버전이 달라요';
  if (!['seed', 'rng', 'realSeconds', 'gameMinutes', 'coins', 'houseStage'].every((k) => isNumber(s[k]))) return '숫자 칸이 깨졌어요';
  if (!Array.isArray(s.bag) || !s.bag.every((b) => b === null || isStack(b))) return '가방이 깨졌어요';
  const { skills, tools, placeables, player, telemetry, nodes } = s;
  if (!isObject(skills) || !SKILLS.every((k) => { const v = skills[k]; return isObject(v) && isNumber(v.level) && isNumber(v.xp) && isNumber(v.totalXp); })) return '기술이 깨졌어요';
  if (!isObject(tools) || !TOOL_FAMILIES.every((k) => isNumber(tools[k]))) return '도구가 깨졌어요';
  if (!isObject(placeables) || !isNumber(placeables.consignBoxes)) return '설치물이 깨졌어요';
  if (!Array.isArray(s.stations) || !Array.isArray(s.seenItems) || !isObject(s.shopSoldToday)) return '목록이 깨졌어요';
  if (!Array.isArray(s.boxes) || !s.boxes.every((box) => Array.isArray(box) && box.every(isStack))) return '판매함이 깨졌어요';
  if (!isObject(player) || !isNumber(player.x) || !isNumber(player.z) || !isObject(player.activity) || typeof player.activity.kind !== 'string') return '플레이어가 깨졌어요';
  if (!isObject(telemetry) || !isObject(telemetry.coinsByChannel) || !isObject(telemetry.salesByChannel) || !isObject(telemetry.xpBySkill)) return '기록이 깨졌어요';
  if (!Array.isArray(nodes) || !nodes.every((n) => isObject(n) && isNumber(n.hitsLeft) && (n.depletedAt === null || isNumber(n.depletedAt)))) return '노드가 깨졌어요';
  const known = new Set(world.map.nodes.map((n) => n.id));
  const unknown = (nodes as Json[]).find((n) => !known.has(n.id as string));
  if (unknown) return `지도에 없는 노드가 있어요: ${String(unknown.id)}`;
  return null;
}

/** 저장이 없으면 조용히 새 게임, 깨졌으면 새 게임과 경고 한 줄 */
export function deserialize(text: string | null, world: World, seed: number): { state: GameState; warning: string | null } {
  const fresh = (warning: string | null) => ({ state: createState(world, seed), warning });
  if (text === null) return fresh(null);
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return fresh('저장을 읽지 못해 새 게임으로 시작해요: JSON이 깨졌어요');
  }
  const reason = !isObject(file) || file.version !== 1 ? '저장 버전이 달라요' : problem(file.state, world);
  if (reason) return fresh(`저장을 읽지 못해 새 게임으로 시작해요: ${reason}`);
  const state = (file as unknown as SaveFile).state;
  // 저장한 뒤 지도에 새로 생긴 노드는 꽉 찬 상태로 더해요
  const have = new Set(state.nodes.map((n) => n.id));
  state.nodes.push(...createState(world, seed).nodes.filter((n) => !have.has(n.id)));
  return { state, warning: null };
}
