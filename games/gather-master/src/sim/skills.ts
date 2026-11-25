import { MAX_LEVEL_PROTOTYPE, xpToNext } from './data.ts';
import type { GameState, SimEvent, SkillId, ToolFamily } from './types.ts';

/** 넘친 XP는 이월하고 여러 레벨이 한 번에 오를 수 있어요. 최고 레벨부터는 totalXp에만 쌓여요 */
export function addXp(state: GameState, skill: SkillId, amount: number): SimEvent[] {
  const events: SimEvent[] = [];
  if (!(amount > 0)) return events;
  const s = state.skills[skill];
  s.totalXp += amount;
  state.telemetry.xpBySkill[skill] += amount;
  if (s.level >= MAX_LEVEL_PROTOTYPE) return events;
  s.xp += amount;
  while (s.level < MAX_LEVEL_PROTOTYPE && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level += 1;
    state.telemetry.firstLevelUp ??= state.realSeconds;
    events.push({ kind: 'levelUp', skill, level: s.level });
  }
  if (s.level >= MAX_LEVEL_PROTOTYPE) s.xp = 0;
  return events;
}

const FAMILY_SKILL: Record<ToolFamily, SkillId> = { axe: 'gathering', pickaxe: 'mining', can: 'farming' };

export function familySkill(family: ToolFamily): SkillId {
  return FAMILY_SKILL[family];
}
