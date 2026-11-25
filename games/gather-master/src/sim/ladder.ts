// 사다리 점검(DESIGN 6절): 모든 것이 시작 상태(맨손·나무 도구·작업대·텐트)에서 닿는지, 조건이 돌고 돌지 않는지 봐요.
// 이름: 'item:<id>' · 'recipe:<id>' · 'station:<id>' · 'tool:<계열>:<단계>' · 'access:<열쇠>' · 'house:<단계>'
// 기술 레벨 L은 "필요 레벨이 L보다 낮고 되풀이해 XP를 주는 일"에 닿으면 올릴 수 있다고 봐요. 코인은 상점이 처음부터 있어 따로 따지지 않아요.
import { DROPS, HOUSE_STAGES, RECIPES, RESOURCES, STATIONS, TOOL_TIERS } from './data.ts';
import { familySkill } from './skills.ts';
import { SKILLS, TOOL_FAMILIES } from './types.ts';
import type { SkillId } from './types.ts';

interface Rule {
  key: string;
  needs: string[];
  levels: { skill: SkillId; level: number }[];
  /** houseStage 조건: count개의 기술이 level 이상 */
  anySkills?: { count: number; level: number };
  /** 닿으면 되풀이해 XP를 주는 일(자원 캐기·물건 제작) */
  trains?: { skill: SkillId; level: number };
}

function rules(): Rule[] {
  const list: Rule[] = [];
  for (const r of RESOURCES) {
    const needs: string[] = [];
    if (r.tool !== 'hand') needs.push(`tool:${r.tool.family}:${r.tool.minTier}`);
    if (r.access) needs.push(`access:${r.access}`);
    // 드롭(화석)은 원천 자원을 캘 수 있어야 나와요
    for (const d of DROPS) if (d.item === r.id) needs.push(`item:${d.fromResource}`);
    list.push({ key: `item:${r.id}`, needs, levels: [{ skill: r.skill, level: r.level }], trains: { skill: r.skill, level: r.level } });
  }
  for (const r of RECIPES) {
    const levels: Rule['levels'] = [{ skill: 'crafting', level: r.craftLevel }];
    if (r.output.kind === 'tool') levels.push({ skill: familySkill(r.output.family), level: r.familySkillLevel ?? 1 });
    list.push({
      key: `recipe:${r.id}`,
      needs: [`station:${r.station}`, ...r.inputs.map((i) => `item:${i.item}`)],
      levels,
      ...(r.output.kind === 'item' ? { trains: { skill: 'crafting' as const, level: r.craftLevel } } : {}),
    });
    if (r.output.kind === 'item') list.push({ key: `item:${r.output.item}`, needs: [`recipe:${r.id}`], levels: [] });
    if (r.output.kind === 'tool') list.push({ key: `tool:${r.output.family}:${r.output.tier}`, needs: [`recipe:${r.id}`], levels: [] });
  }
  // 시작 도구(나무)는 조건이 없어요
  for (const family of TOOL_FAMILIES) {
    for (const t of TOOL_TIERS) if (t.recipePrefix === null) list.push({ key: `tool:${family}:${t.tier}`, needs: [], levels: [] });
  }
  list.push({ key: 'access:ladder', needs: ['recipe:ladder'], levels: [] });
  list.push({ key: 'access:lantern', needs: ['item:lantern'], levels: [] });
  for (const s of STATIONS) {
    const needs = s.items.map((i) => `item:${i.item}`);
    if (s.houseStage > 1) needs.push(`house:${s.houseStage}`);
    list.push({ key: `station:${s.id}`, needs, levels: [{ skill: 'crafting', level: s.craftLevel }] });
  }
  for (const h of HOUSE_STAGES) {
    const needs = h.items.map((i) => `item:${i.item}`);
    if (h.stage > 1) needs.push(`house:${h.stage - 1}`);
    list.push({ key: `house:${h.stage}`, needs, levels: [], ...(h.skillReq ? { anySkills: h.skillReq } : {}) });
  }
  return list;
}

function findUnreachable(list: Rule[]): string[] {
  const reached = new Set<string>();
  // 기술마다 지금 올릴 수 있는 가장 높은 레벨
  const top = Object.fromEntries(SKILLS.map((s) => [s, 1])) as Record<SkillId, number>;
  const train = new Map<SkillId, number[]>(SKILLS.map((s) => [s, []]));
  const canLevel = (skill: SkillId, level: number): boolean => {
    // 닿은 일 가운데 지금 레벨로 할 수 있는 것이 있으면 그 위 레벨까지 올릴 수 있어요
    while (top[skill] < level && train.get(skill)!.some((need) => need <= top[skill])) top[skill] += 1;
    return top[skill] >= level;
  };
  for (let changed = true; changed;) {
    changed = false;
    for (const rule of list) {
      if (reached.has(rule.key)) continue;
      if (!rule.needs.every((k) => reached.has(k))) continue;
      if (!rule.levels.every((l) => canLevel(l.skill, l.level))) continue;
      const any = rule.anySkills;
      if (any && SKILLS.filter((s) => canLevel(s, any.level)).length < any.count) continue;
      reached.add(rule.key);
      if (rule.trains) train.get(rule.trains.skill)!.push(rule.trains.level);
      changed = true;
    }
  }
  return list.filter((r) => !reached.has(r.key)).map((r) => r.key);
}

/** 재료·도구·제작대·집 조건만 따라간 순환 */
function findCycles(list: Rule[]): string[] {
  const needs = new Map(list.map((r) => [r.key, r.needs]));
  const done = new Set<string>();
  const trail: string[] = [];
  const cycles: string[] = [];
  const visit = (key: string): void => {
    const at = trail.indexOf(key);
    if (at >= 0) { cycles.push([...trail.slice(at), key].join(' -> ')); return; }
    if (done.has(key)) return;
    trail.push(key);
    for (const next of needs.get(key) ?? []) visit(next);
    trail.pop();
    done.add(key);
  };
  for (const rule of list) visit(rule.key);
  return cycles;
}

export function reachabilityReport(): { unreachable: string[]; cycles: string[] } {
  const list = rules();
  return { unreachable: findUnreachable(list), cycles: findCycles(list) };
}
