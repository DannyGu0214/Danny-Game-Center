// P0 경제 봇 (docs/p0-p1-tasks.md 4절). 규칙 함수만 써서 욕심쟁이 정책으로 플레이해요.
// 실행: node tools/sim.ts [--table|--json] [--clock prototype|full] [--seeds 1,2,3]
import { countItem } from '../src/sim/bag.ts';
import { BOX, CLOCK, CLOCK_PROTOTYPE, ITEMS, NODE_KINDS, RECIPES, RESOURCES } from '../src/sim/data.ts';
import { P1_MAP } from '../src/sim/map-p1.ts';
import { applyIntent, boxQuote, createState, shopQuote, tick } from '../src/sim/state.ts';
import {
  SKILLS, type ChannelId, type GameState, type Intent, type ItemId, type NodeSpawn, type ResourceDef,
  type SimEvent, type SkillId, type StationSpawn,
} from '../src/sim/types.ts';
import { approachCell, findPath, worldToCell, type World } from '../src/sim/world.ts';

declare const process: { argv: string[]; exitCode?: number };

export type ClockName = 'prototype' | 'full';

const DT = 0.1;
/** S1·S2가 이 시간(실제 초) 안에 목표에 못 닿으면 미달(null)이에요 */
const GOAL_LIMIT = 900;
const S2_GOAL = 50;
/** S3 길이: 실제 15분. 마지막 아침(900초)이 반올림으로 빠지지 않게 한 틱 여유를 둬요 */
const S3_END = 900.05;
/** S3 생산: 한 품목 재료를 이만큼 만들 분량까지 모아요 */
const CRAFT_BATCH = 4;
/** S3 판매: 가방에 제작물이 이만큼 쌓이면 팔러 가요 */
const SELL_AT = 8;

type Goods = 'plank' | 'rope';
export type S3Mode = 'shop' | 'mix' | 'pile';
type Cell = { x: number; z: number };

// ── 실행기 ──────────────────────────────────────────────

class TimeUp extends Error {}

class Bot {
  readonly state: GameState;
  readonly world: World;
  readonly rejects: Record<string, number> = {};
  readonly endAt: number;
  idleSeconds = 0;

  constructor(world: World, seed: number, endAt: number) {
    this.world = world;
    this.endAt = endAt;
    this.state = createState(world, seed);
  }

  private record(events: SimEvent[]): SimEvent[] {
    for (const e of events) {
      if (e.kind === 'rejected') this.rejects[e.reason] = (this.rejects[e.reason] ?? 0) + 1;
    }
    return events;
  }

  send(intent: Intent): SimEvent[] {
    return this.record(applyIntent(this.state, this.world, intent));
  }

  step(): SimEvent[] {
    if (this.state.realSeconds >= this.endAt - 1e-6) throw new TimeUp();
    return this.record(tick(this.state, this.world, DT));
  }

  private waitWhile(kind: 'walking' | 'crafting'): void {
    while (this.state.player.activity.kind === kind) this.step();
  }

  /** 대상 칸에 닿는 가장 가까운 칸과 걸을 칸 수 */
  private route(target: Cell): { cell: Cell; length: number } | null {
    const from = worldToCell(this.state.player);
    const cell = approachCell(this.world, from, target);
    if (!cell) return null;
    if (cell.x === from.x && cell.z === from.z) return { cell, length: 0 };
    const path = findPath(this.world, from, cell);
    return path ? { cell, length: path.length } : null;
  }

  goTo(target: Cell): void {
    const route = this.route(target);
    if (!route) throw new Error(`갈 수 없는 칸이에요: ${target.x},${target.z}`);
    if (route.length === 0) return;
    this.send({ kind: 'moveTo', cell: route.cell });
    if (this.state.player.activity.kind !== 'walking') throw new Error('moveTo가 걷기를 시작하지 않았어요');
    this.waitWhile('walking');
  }

  goToSpot(id: StationSpawn['id']): void {
    const spot = this.world.map.spots.find((s) => s.id === id);
    if (!spot) throw new Error(`지도에 자리가 없어요: ${id}`);
    this.goTo(spot.cell);
  }

  /** wanted 자원 중 지금 캘 수 있고 가장 가까운(경로 길이) 노드 */
  private nearest(wanted: Set<ItemId>): { spawn: NodeSpawn; def: ResourceDef } | null {
    let best: { spawn: NodeSpawn; def: ResourceDef; length: number } | null = null;
    for (const spawn of this.world.map.nodes) {
      const kind = NODE_KINDS.find((k) => k.id === spawn.kind);
      const def = RESOURCES.find((r) => r.id === kind?.yields);
      if (!def || !wanted.has(def.id) || !this.canGather(def)) continue;
      if ((this.state.nodes.find((n) => n.id === spawn.id)?.hitsLeft ?? 0) <= 0) continue;
      const route = this.route(spawn.cell);
      if (route && (!best || route.length < best.length)) best = { spawn, def, length: route.length };
    }
    return best;
  }

  canGather(def: ResourceDef): boolean {
    if (def.access !== null || this.state.skills[def.skill].level < def.level) return false;
    return def.tool === 'hand' || this.state.tools[def.tool.family] >= def.tool.minTier;
  }

  /** 가장 가까운 노드 하나를 캐요. stillWanted가 false가 되면 멈춰요. 캘 노드가 없으면 false */
  gatherNearest(wanted: Set<ItemId>, stillWanted: (item: ItemId) => boolean): boolean {
    const found = this.nearest(wanted);
    if (!found) return false;
    this.goTo(found.spawn.cell);
    // 걷는 동안 상태가 바뀌지 않으니(리스폰은 늘기만 해요) 바로 캐요
    this.send({ kind: 'gather', nodeId: found.spawn.id });
    while (this.state.player.activity.kind === 'gathering') {
      this.step();
      if (this.state.player.activity.kind === 'gathering' && !stillWanted(found.def.id)) {
        this.send({ kind: 'stopAction' });
      }
    }
    return true;
  }

  wait(): void {
    this.idleSeconds += DT;
    this.step();
  }

  craft(recipeId: string): boolean {
    this.goToSpot('workbench');
    const events = this.send({ kind: 'craft', recipeId });
    if (events.some((e) => e.kind === 'rejected')) {
      this.wait(); // 거절이 반복돼도 시간은 흘러요
      return false;
    }
    this.waitWhile('crafting');
    return true;
  }

  count(item: ItemId): number {
    return countItem(this.state.bag, item);
  }

  /** 가방에 있는 품목별 개수 */
  holdings(): [ItemId, number][] {
    const totals = new Map<ItemId, number>();
    for (const slot of this.state.bag) {
      if (slot) totals.set(slot.item, (totals.get(slot.item) ?? 0) + slot.qty);
    }
    return [...totals];
  }

  sellShop(items: [ItemId, number][]): void {
    const selling = items.filter(([, qty]) => qty > 0);
    if (selling.length === 0) return;
    this.goToSpot('shop');
    for (const [item, qty] of selling) this.send({ kind: 'sellShop', item, qty });
  }

  deposit(items: [ItemId, number][]): void {
    const putting = items.filter(([, qty]) => qty > 0);
    if (putting.length === 0) return;
    this.goToSpot('box-spot');
    for (const [item, qty] of putting) this.send({ kind: 'depositBox', boxIndex: 0, item, qty });
  }

  inBox(item: ItemId): number {
    return this.state.boxes.flat().reduce((acc, s) => acc + (s.item === item ? s.qty : 0), 0);
  }
}

const recipeInputs = (id: string) => {
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error(`레시피가 없어요: ${id}`);
  return recipe.inputs;
};
const hasInputs = (bot: Bot, id: string) => recipeInputs(id).every((i) => bot.count(i.item) >= i.qty);

/** 목표를 이루면 걸린 실제 초, 시간 안에 못 이루면 null */
function until(bot: Bot, done: () => boolean, turn: () => void): number | null {
  try {
    while (!done()) turn();
    return bot.state.realSeconds;
  } catch (error) {
    if (error instanceof TimeUp) return done() ? bot.state.realSeconds : null;
    throw error;
  }
}

// ── S1 첫 도구 ──────────────────────────────────────────

const TOOL_GOALS = [
  { recipeId: 'stone-axe', skill: 'gathering' },
  { recipeId: 'stone-pickaxe', skill: 'mining' },
] as const;

function turnFirstTool(bot: Bot): void {
  const { skills } = bot.state;
  const ready = TOOL_GOALS.find((g) => skills.crafting.level >= 2 && skills[g.skill].level >= 3);
  if (ready && hasInputs(bot, ready.recipeId)) {
    bot.craft(ready.recipeId);
    return;
  }
  // 제작 Lv2까지 필요한 판자 수만큼 통나무를 모아 한 번에 만들어요
  const planksToLevel = () => (skills.crafting.level >= 2 ? 0 : Math.ceil((20 - skills.crafting.xp) / 8));
  if (planksToLevel() > 0 && bot.count('log') >= planksToLevel() * 2) {
    const n = planksToLevel();
    for (let i = 0; i < n; i++) bot.craft('plank');
    return;
  }
  const wants = (item: ItemId): boolean => {
    if (item === 'log' && planksToLevel() > 0 && bot.count('log') < planksToLevel() * 2) return true;
    if (item === 'branch' && bot.count('branch') < 2) return true;
    if (item === 'stone' && bot.count('stone') < 3) return true;
    // 채집·채광 중 하나가 Lv3이 될 때까지는 가까운 것을 캐며 XP를 올려요
    const needXp = skills.gathering.level < 3 && skills.mining.level < 3;
    return needXp && (item === 'log' || item === 'branch' || item === 'reed' || item === 'stone');
  };
  const wanted = new Set<ItemId>((['log', 'branch', 'reed', 'stone'] as const).filter(wants));
  if (!bot.gatherNearest(wanted, wants)) bot.wait();
}

export interface S1Result {
  firstGather: number | null;
  firstLevelUp: number | null;
  firstCraft: number | null;
  firstTool: number | null;
}

function runS1(bot: Bot): S1Result {
  until(bot, () => bot.state.telemetry.firstTool !== null, () => turnFirstTool(bot));
  const { firstGather, firstLevelUp, firstCraft, firstTool } = bot.state.telemetry;
  return { firstGather, firstLevelUp, firstCraft, firstTool };
}

// ── 판매함 만들기(S2b·S3 공통) ──────────────────────────

function turnBuildBox(bot: Bot): void {
  if (hasInputs(bot, 'consign-box') && bot.state.skills.crafting.level >= 2) {
    bot.craft('consign-box');
    return;
  }
  const planksShort = () => Math.max(0, 4 - bot.count('plank'));
  const ropesShort = () => Math.max(0, 2 - bot.count('rope'));
  if (planksShort() > 0 && bot.count('log') >= planksShort() * 2) {
    bot.craft('plank');
    return;
  }
  if (ropesShort() > 0 && bot.count('reed') >= ropesShort() * 3) {
    bot.craft('rope');
    return;
  }
  const reedLocked = () => bot.state.skills.gathering.level < 2;
  const wants = (item: ItemId): boolean => {
    if (item === 'log') return bot.count('log') < planksShort() * 2 || (ropesShort() > 0 && reedLocked());
    if (item === 'reed') return bot.count('reed') < ropesShort() * 3;
    if (item === 'branch') return ropesShort() > 0 && reedLocked();
    return false;
  };
  const wanted = new Set<ItemId>((['log', 'reed', 'branch'] as const).filter(wants));
  if (!bot.gatherNearest(wanted, wants)) bot.wait();
}

const hasBox = (bot: Bot) => bot.state.placeables.consignBoxes > 0;

// ── S2 급한 돈 ──────────────────────────────────────────

const SELLABLE = new Set<ItemId>(['branch', 'log', 'reed', 'stone', 'plank', 'rope']);

const shopValue = (bot: Bot) =>
  bot.holdings().reduce((acc, [item, qty]) => acc + shopQuote(bot.state, item, qty), 0);

/** 가방을 판매함에 넣으면 아침에 받을 값(정산 규칙과 같은 셈) */
function boxValue(bot: Bot): number {
  return bot.holdings().reduce((acc, [item, qty]) => {
    const base = ITEMS.find((i) => i.id === item)?.basePrice ?? 0;
    const total = qty + bot.inBox(item);
    const units = Math.min(total, BOX.decayAfter) + Math.max(0, total - BOX.decayAfter) * BOX.decayRate;
    return acc + Math.floor(base * units * BOX.rate * (1 - BOX.fee) + 1e-9);
  }, 0);
}

function runS2Shop(bot: Bot): number | null {
  return until(bot, () => bot.state.coins >= S2_GOAL, () => {
    if (shopValue(bot) >= S2_GOAL) {
      bot.sellShop(bot.holdings());
      return;
    }
    if (!bot.gatherNearest(SELLABLE, () => shopValue(bot) < S2_GOAL)) bot.wait();
  });
}

function runS2Box(bot: Bot): number | null {
  return until(bot, () => bot.state.coins >= S2_GOAL, () => {
    if (!hasBox(bot)) {
      turnBuildBox(bot);
    } else if (boxQuote(bot.state) >= S2_GOAL) {
      bot.send({ kind: 'sleep' });
    } else if (boxValue(bot) + boxQuote(bot.state) >= S2_GOAL) {
      bot.deposit(bot.holdings());
    } else if (!bot.gatherNearest(SELLABLE, () => boxValue(bot) + boxQuote(bot.state) < S2_GOAL)) {
      bot.wait();
    }
  });
}

// ── S3 15분 수입 / S4 XP 속도 ───────────────────────────

function dispose(bot: Bot, mode: S3Mode, plan: Goods[]): void {
  const held = plan.map((g): [ItemId, number] => [g, bot.count(g)]);
  if (mode === 'shop') {
    bot.sellShop(held);
  } else if (mode === 'pile') {
    bot.deposit(held);
  } else {
    // 섞기: 품목당 하룻밤 10개까지 판매함, 넘는 몫은 상점
    bot.deposit(held.map(([g, qty]): [ItemId, number] => [g, Math.min(qty, Math.max(0, BOX.decayAfter - bot.inBox(g)))]));
    bot.sellShop(plan.map((g): [ItemId, number] => [g, bot.count(g)]));
  }
}

function turnProduce(bot: Bot, mode: S3Mode, plan: Goods[]): void {
  if (plan.reduce((acc, g) => acc + bot.count(g), 0) >= SELL_AT) {
    dispose(bot, mode, plan);
    return;
  }
  const need = plan.map((g) => {
    const [input] = recipeInputs(g);
    if (!input) throw new Error(`재료가 없는 레시피예요: ${g}`);
    return { goods: g, item: input.item, qty: input.qty };
  });
  const craftAll = (goods: Goods) => {
    for (let i = 0; i < CRAFT_BATCH && hasInputs(bot, goods); i++) bot.craft(goods);
  };
  const full = need.find((n) => bot.count(n.item) >= n.qty * CRAFT_BATCH);
  if (full) {
    craftAll(full.goods);
    return;
  }
  const wants = (item: ItemId) => need.some((n) => n.item === item && bot.count(item) < n.qty * CRAFT_BATCH);
  if (bot.gatherNearest(new Set(need.map((n) => n.item).filter(wants)), wants)) return;
  const some = need.find((n) => bot.count(n.item) >= n.qty);
  if (some) craftAll(some.goods);
  else bot.wait();
}

export interface S3Result {
  coins: number;
  coinsByChannel: Record<ChannelId, number>;
  salesByChannel: Record<ChannelId, number>;
  boxBuiltAt: number | null;
}

function runS3(bot: Bot, mode: S3Mode): S3Result {
  const plan: Goods[] = mode === 'pile' ? ['plank'] : ['plank', 'rope'];
  let boxBuiltAt: number | null = null;
  until(bot, () => false, () => {
    if (mode !== 'shop' && !hasBox(bot)) {
      turnBuildBox(bot);
      if (hasBox(bot)) boxBuiltAt = bot.state.realSeconds;
      return;
    }
    turnProduce(bot, mode, plan);
  });
  const { coinsByChannel, salesByChannel } = bot.state.telemetry;
  return { coins: bot.state.coins, coinsByChannel: { ...coinsByChannel }, salesByChannel: { ...salesByChannel }, boxBuiltAt };
}

// ── 모아서 보고 ─────────────────────────────────────────

export interface SeedResult {
  seed: number;
  s1: S1Result;
  s2: { shop: number | null; box: number | null };
  s3: Record<S3Mode, S3Result>;
  s4: { xpPerMinute: Record<SkillId, number>; levels: Record<SkillId, number> };
  /** 한 시나리오 안에서 같은 이유로 가장 많이 거절된 횟수 */
  worstReject: { scenario: string; reason: string; count: number };
  idleSeconds: Record<string, number>;
}

function runSeed(world: World, seed: number): SeedResult {
  const bots: Record<string, Bot> = {};
  const make = (name: string, endAt: number) => (bots[name] = new Bot(world, seed, endAt));
  const s1 = runS1(make('S1', GOAL_LIMIT));
  const s2 = { shop: runS2Shop(make('S2a', GOAL_LIMIT)), box: runS2Box(make('S2b', GOAL_LIMIT)) };
  const shop = runS3(make('S3a', S3_END), 'shop');
  const mix = runS3(make('S3b', S3_END), 'mix');
  const pile = runS3(make('S3c', S3_END), 'pile');
  const mixState = bots['S3b']!.state;
  const bySkill = (value: (skill: SkillId) => number) =>
    Object.fromEntries(SKILLS.map((k) => [k, value(k)])) as Record<SkillId, number>;
  const s4 = {
    xpPerMinute: bySkill((k) => mixState.telemetry.xpBySkill[k] / (mixState.realSeconds / 60)),
    levels: bySkill((k) => mixState.skills[k].level),
  };
  let worstReject = { scenario: '-', reason: '-', count: 0 };
  for (const [scenario, bot] of Object.entries(bots)) {
    for (const [reason, count] of Object.entries(bot.rejects)) {
      if (count > worstReject.count) worstReject = { scenario, reason, count };
    }
  }
  const idleSeconds = Object.fromEntries(Object.entries(bots).map(([k, b]) => [k, b.idleSeconds]));
  return { seed, s1, s2, s3: { shop, mix, pile }, s4, worstReject, idleSeconds };
}

/** 하나라도 미달(null)이면 평균도 null이에요 */
function mean(values: (number | null)[]): number | null {
  let total = 0;
  for (const v of values) {
    if (v === null) return null;
    total += v;
  }
  return total / values.length;
}

export interface Check {
  id: 'firstGather' | 'firstLevelUp' | 'firstCraft' | 'firstTool' | 's2' | 's3mix' | 's3pile' | 'stuck';
  label: string;
  target: string;
  actual: string;
  pass: boolean;
}

export interface Report {
  clock: ClockName;
  seeds: number[];
  runs: SeedResult[];
  average: {
    s1: S1Result;
    s2: { shop: number | null; box: number | null };
    s3: Record<S3Mode, { coins: number; salesByChannel: Record<ChannelId, number> }>;
    s4: { xpPerMinute: Record<SkillId, number>; levels: Record<SkillId, number> };
  };
  checks: Check[];
}

const fmt = (value: number | null, digits = 1) => (value === null ? '미달' : String(Number(value.toFixed(digits))));

export function runBot(options: { clock?: ClockName; seeds?: number[] } = {}): Report {
  const clock = options.clock ?? 'prototype';
  const seeds = options.seeds ?? [1, 2, 3];
  const world: World = { map: P1_MAP, clock: clock === 'full' ? CLOCK : CLOCK_PROTOTYPE };
  const runs = seeds.map((seed) => runSeed(world, seed));
  const avg = (pick: (r: SeedResult) => number | null) => mean(runs.map(pick));
  const num = (pick: (r: SeedResult) => number) => avg(pick) as number;
  const s3Average = (mode: S3Mode) => ({
    coins: num((r) => r.s3[mode].coins),
    salesByChannel: {
      shop: num((r) => r.s3[mode].salesByChannel.shop),
      box: num((r) => r.s3[mode].salesByChannel.box),
      market: num((r) => r.s3[mode].salesByChannel.market),
    },
  });
  const bySkill = (pick: (r: SeedResult, k: SkillId) => number) =>
    Object.fromEntries(SKILLS.map((k) => [k, num((r) => pick(r, k))])) as Record<SkillId, number>;
  const average: Report['average'] = {
    s1: {
      firstGather: avg((r) => r.s1.firstGather),
      firstLevelUp: avg((r) => r.s1.firstLevelUp),
      firstCraft: avg((r) => r.s1.firstCraft),
      firstTool: avg((r) => r.s1.firstTool),
    },
    s2: { shop: avg((r) => r.s2.shop), box: avg((r) => r.s2.box) },
    s3: { shop: s3Average('shop'), mix: s3Average('mix'), pile: s3Average('pile') },
    s4: { xpPerMinute: bySkill((r, k) => r.s4.xpPerMinute[k]), levels: bySkill((r, k) => r.s4.levels[k]) },
  };

  const { s1, s2, s3 } = average;
  const within = (id: Check['id'], label: string, value: number | null, min: number, max: number): Check => ({
    id, label, target: min > 0 ? `${min}~${max}초` : `≤ ${max}초`, actual: `${fmt(value)}초`,
    pass: value !== null && value >= min && value <= max,
  });
  const worst = runs.reduce((a, r) => (r.worstReject.count > a.count ? r.worstReject : a), runs[0]!.worstReject);
  const checks: Check[] = [
    within('firstGather', '첫 캐기', s1.firstGather, 0, 10),
    within('firstLevelUp', '첫 레벨업', s1.firstLevelUp, 0, 60),
    within('firstCraft', '첫 제작', s1.firstCraft, 0, 120),
    within('firstTool', '첫 도구', s1.firstTool, 180, 300),
    {
      id: 's2', label: 'S2 상점이 판매함보다 빨라요', target: '상점 < 판매함',
      actual: `상점 ${fmt(s2.shop)}초 / 판매함 ${fmt(s2.box)}초`,
      pass: s2.shop !== null && (s2.box === null || s2.shop < s2.box),
    },
    {
      id: 's3mix', label: 'S3 섞기 > 상점만', target: '(b) > (a)',
      actual: `(b) ${fmt(s3.mix.coins)} / (a) ${fmt(s3.shop.coins)}`, pass: s3.mix.coins > s3.shop.coins,
    },
    {
      id: 's3pile', label: 'S3 몰아넣기 < 섞기', target: '(c) < (b)',
      actual: `(c) ${fmt(s3.pile.coins)} / (b) ${fmt(s3.mix.coins)}`, pass: s3.pile.coins < s3.mix.coins,
    },
    {
      id: 'stuck', label: '같은 이유 거절 반복', target: '≤ 50번',
      actual: `${worst.count}번 (${worst.scenario} ${worst.reason})`, pass: worst.count <= 50,
    },
  ];
  return { clock, seeds, runs, average, checks };
}

export function toTable(report: Report): string {
  const { average: a } = report;
  const lines = [
    `## 경제 봇 (clock=${report.clock}, seeds=${report.seeds.join(',')} 평균)`,
    '',
    '| S1 첫 도구 | 첫 캐기 | 첫 레벨업 | 첫 제작 | 첫 도구 |',
    '|---|---:|---:|---:|---:|',
    `| 실제 초 | ${fmt(a.s1.firstGather)} | ${fmt(a.s1.firstLevelUp)} | ${fmt(a.s1.firstCraft)} | ${fmt(a.s1.firstTool)} |`,
    '',
    `| S2 ${S2_GOAL}코인 | 상점만 | 판매함만 |`,
    '|---|---:|---:|',
    `| 도달 초 | ${fmt(a.s2.shop)} | ${fmt(a.s2.box)} |`,
    '',
    '| S3 15분 | 코인 | 상점 판매 수 | 판매함 판매 수 |',
    '|---|---:|---:|---:|',
  ];
  const names: Record<S3Mode, string> = { shop: '(a) 상점만', mix: '(b) 판매함 섞기', pile: '(c) 판매함 몰아넣기' };
  for (const mode of ['shop', 'mix', 'pile'] as const) {
    const r = a.s3[mode];
    lines.push(`| ${names[mode]} | ${fmt(r.coins)} | ${fmt(r.salesByChannel.shop)} | ${fmt(r.salesByChannel.box)} |`);
  }
  lines.push('', '| S4 (S3b 동안) | 채집 | 채광 | 농사 | 제작 |', '|---|---:|---:|---:|---:|',
    `| 분당 XP | ${SKILLS.map((k) => fmt(a.s4.xpPerMinute[k])).join(' | ')} |`,
    `| 15분 뒤 레벨 | ${SKILLS.map((k) => fmt(a.s4.levels[k])).join(' | ')} |`,
    '', '| 통과 기준 | 목표 | 결과 | 판정 |', '|---|---|---|---|');
  for (const c of report.checks) lines.push(`| ${c.label} | ${c.target} | ${c.actual} | ${c.pass ? '통과' : '미달'} |`);
  return lines.join('\n');
}

function parseArgs(args: string[]): { clock: ClockName; seeds: number[]; json: boolean } {
  const out = { clock: 'prototype' as ClockName, seeds: [1, 2, 3], json: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') out.json = true;
    else if (arg === '--table') out.json = false;
    else if (arg === '--clock') {
      const value = args[++i];
      if (value !== 'prototype' && value !== 'full') throw new Error('--clock은 prototype 또는 full이에요');
      out.clock = value;
    } else if (arg === '--seeds') {
      out.seeds = (args[++i] ?? '').split(',').map(Number);
      if (!out.seeds.every(Number.isInteger)) throw new Error('--seeds는 1,2,3 같은 정수 목록이에요');
    } else throw new Error(`모르는 인자예요: ${arg}`);
  }
  return out;
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const { clock, seeds, json } = parseArgs(process.argv.slice(2));
  const report = runBot({ clock, seeds });
  console.log(json ? JSON.stringify(report, null, 2) : toTable(report));
}
