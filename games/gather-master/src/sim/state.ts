// 규칙 진입점. applyIntent·tick은 상태를 제자리에서 고치고 사건 배열을 돌려줘요.
// Activity의 타이머(swingTimer·timer)는 "지금까지 흐른 실제 초"예요.
import { addItems, canAdd, countItem, removeItems } from './bag.ts';
import {
  BOX, DROPS, HOUSE_STAGES, ITEMS, MAX_STEP, NODE_KINDS, REACH_METERS, RECIPES, RESOURCES, SHOP,
  STATIONS, SWING_SECONDS, TOOL_TIERS, WALK_SPEED,
} from './data.ts';
import { nextRandom } from './rng.ts';
import { addXp, familySkill } from './skills.ts';
import { cellCenter, findPath, worldToCell } from './world.ts';
import type { World } from './world.ts';
import type {
  GameState, Intent, ItemId, RecipeDef, RejectReason, ResourceDef, SimEvent, StationSpawn,
} from './types.ts';

type Cell = { x: number; z: number };

const DAY_MINUTES = 1440;
/** 0.1초씩 더할 때 생기는 부동소수 오차를 흡수해요 */
const EPS = 1e-9;
const dayIndex = (gameMinutes: number) => Math.floor(gameMinutes / DAY_MINUTES);

const basePrice = (item: ItemId): number => ITEMS.find((i) => i.id === item)!.basePrice;

export function createState(world: World, seed: number): GameState {
  const start = cellCenter(world.map.start, world.map.grid.cellSize);
  const skill = () => ({ level: 1, xp: 0, totalXp: 0 });
  return {
    version: 1,
    seed,
    rng: seed >>> 0,
    realSeconds: 0,
    gameMinutes: 0,
    coins: 0,
    bag: Array.from({ length: HOUSE_STAGES[0]!.bagSlots }, () => null),
    skills: { gathering: skill(), mining: skill(), farming: skill(), crafting: skill() },
    tools: { axe: 0, pickaxe: 0, can: 0 },
    stations: ['workbench'],
    placeables: { consignBoxes: 0, ladder: false },
    houseStage: 1,
    seenItems: [],
    nodes: world.map.nodes.map((n) => ({ id: n.id, hitsLeft: nodeKind(n.kind).hits, depletedAt: null })),
    boxes: [],
    shopSoldToday: {},
    player: { x: start.x, z: start.z, activity: { kind: 'idle' } },
    telemetry: {
      firstGather: null, firstCraft: null, firstSale: null, firstLevelUp: null, firstTool: null,
      coinsByChannel: { shop: 0, box: 0, market: 0 },
      salesByChannel: { shop: 0, box: 0, market: 0 },
      xpBySkill: { gathering: 0, mining: 0, farming: 0, crafting: 0 },
    },
  };
}

function nodeKind(id: string) {
  const kind = NODE_KINDS.find((k) => k.id === id);
  if (!kind) throw new Error(`모르는 노드 종류예요: ${id}`);
  return kind;
}

function isNear(state: GameState, world: World, cell: Cell): boolean {
  const c = cellCenter(cell, world.map.grid.cellSize);
  return Math.hypot(state.player.x - c.x, state.player.z - c.z) <= REACH_METERS + EPS;
}

function nearSpot(state: GameState, world: World, id: StationSpawn['id']): boolean {
  const spot = world.map.spots.find((s) => s.id === id);
  return spot !== undefined && isNear(state, world, spot.cell);
}

function see(state: GameState, item: ItemId): void {
  if (!state.seenItems.includes(item)) state.seenItems.push(item);
}

const reject = (intent: Intent['kind'], reason: RejectReason): SimEvent[] => [{ kind: 'rejected', intent, reason }];

const idle = (state: GameState): void => { state.player.activity = { kind: 'idle' }; };

// ── 캐기 ───────────────────────────────────────────────

function gatherTarget(world: World, state: GameState, nodeId: string) {
  const spawn = world.map.nodes.find((n) => n.id === nodeId);
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!spawn || !node) return null;
  const kind = nodeKind(spawn.kind);
  const resource = RESOURCES.find((r) => r.id === kind.yields);
  return resource ? { spawn, node, kind, resource } : null;
}

/** 기술 레벨·도구·들어갈 수 있는 곳 조건. 통과하면 null */
function requirement(state: GameState, resource: ResourceDef): RejectReason | null {
  if (resource.access === 'ladder' && !state.placeables.ladder) return 'need-access';
  if (resource.access === 'lantern' && countItem(state.bag, 'lantern') < 1) return 'need-access';
  if (state.skills[resource.skill].level < resource.level) return 'need-level';
  if (resource.tool !== 'hand' && state.tools[resource.tool.family] < resource.tool.minTier) return 'need-tool';
  return null;
}

function gatherBlock(state: GameState, world: World, nodeId: string): RejectReason | null {
  const target = gatherTarget(world, state, nodeId);
  if (!target) return 'unknown';
  if (target.node.hitsLeft <= 0) return 'node-depleted';
  const need = requirement(state, target.resource);
  if (need) return need;
  if (!isNear(state, world, target.spawn.cell)) return 'too-far';
  return canAdd(state.bag, [{ item: target.resource.id, qty: 1 }]) ? null : 'bag-full';
}

function swingSeconds(state: GameState, resource: ResourceDef): number {
  if (resource.tool === 'hand') return SWING_SECONDS;
  const tier = state.tools[resource.tool.family];
  return SWING_SECONDS / TOOL_TIERS.find((t) => t.tier === tier)!.speed;
}

/** 한 개를 얻었을 때 확률로 따라 나오는 것(화석). 가방에 자리가 없으면 아무것도 주지 않아요 */
function rollDrops(state: GameState, from: ResourceDef, nodeId: string): SimEvent[] {
  const events: SimEvent[] = [];
  for (const drop of DROPS) {
    if (drop.fromResource !== from.id) continue;
    const found = RESOURCES.find((r) => r.id === drop.item)!;
    if (requirement(state, found) !== null || nextRandom(state) >= drop.chance) continue;
    if (!addItems(state.bag, [{ item: found.id, qty: 1 }])) continue;
    see(state, found.id);
    events.push({ kind: 'gathered', nodeId, item: found.id, qty: 1, xp: found.xp, skill: found.skill });
    events.push(...addXp(state, found.skill, found.xp));
  }
  return events;
}

function tickGathering(state: GameState, world: World, dt: number): SimEvent[] {
  const activity = state.player.activity;
  if (activity.kind !== 'gathering') return [];
  const target = gatherTarget(world, state, activity.nodeId);
  if (!target || target.node.hitsLeft <= 0) { idle(state); return []; }
  const { node, resource } = target;
  const duration = swingSeconds(state, resource);
  activity.swingTimer += dt;
  if (activity.swingTimer + EPS < duration) return [];
  activity.swingTimer = Math.max(0, activity.swingTimer - duration);
  activity.swingsDone += 1;
  const events: SimEvent[] = [{ kind: 'swing', nodeId: node.id }];
  if (activity.swingsDone < resource.swings) return events;

  activity.swingsDone = 0;
  if (!addItems(state.bag, [{ item: resource.id, qty: 1 }])) {
    idle(state);
    return [...events, ...reject('gather', 'bag-full')];
  }
  see(state, resource.id);
  state.telemetry.firstGather ??= state.realSeconds;
  node.hitsLeft -= 1;
  events.push({ kind: 'gathered', nodeId: node.id, item: resource.id, qty: 1, xp: resource.xp, skill: resource.skill });
  events.push(...addXp(state, resource.skill, resource.xp));
  events.push(...rollDrops(state, resource, node.id));
  if (node.hitsLeft <= 0) {
    node.depletedAt = state.gameMinutes;
    idle(state);
    events.push({ kind: 'nodeDepleted', nodeId: node.id });
  } else if (!canAdd(state.bag, [{ item: resource.id, qty: 1 }])) {
    idle(state);
    events.push(...reject('gather', 'bag-full'));
  }
  return events;
}

// ── 제작 ───────────────────────────────────────────────

export function visibleRecipes(state: GameState): RecipeDef[] {
  return RECIPES.filter((r) => r.inputs.some((i) => state.seenItems.includes(i.item)));
}

export function canCraft(state: GameState, world: World, recipeId: string): RejectReason | null {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return 'unknown';
  if (!state.stations.includes(recipe.station)) return 'need-station';
  if (!nearSpot(state, world, recipe.station)) return 'too-far';
  if (state.skills.crafting.level < recipe.craftLevel) return 'need-level';
  const out = recipe.output;
  if (out.kind === 'tool') {
    if (state.skills[familySkill(out.family)].level < (recipe.familySkillLevel ?? 1)) return 'need-level';
    if (state.tools[out.family] >= out.tier) return 'blocked';
  }
  if (out.kind === 'placeable') {
    if (out.id === 'ladder' && state.placeables.ladder) return 'blocked';
    if (out.id === 'consign-box' && state.placeables.consignBoxes >= HOUSE_STAGES[state.houseStage - 1]!.boxes) return 'blocked';
  }
  if (recipe.inputs.some((i) => countItem(state.bag, i.item) < i.qty)) return 'need-items';
  if (out.kind === 'item') {
    const after = state.bag.map((s) => (s ? { ...s } : null));
    removeItems(after, recipe.inputs);
    if (!canAdd(after, [{ item: out.item, qty: out.qty }])) return 'bag-full';
  }
  return null;
}

function tickCrafting(state: GameState, world: World, dt: number): SimEvent[] {
  const activity = state.player.activity;
  if (activity.kind !== 'crafting') return [];
  const recipe = RECIPES.find((r) => r.id === activity.recipeId);
  if (!recipe) { idle(state); return reject('craft', 'unknown'); }
  activity.timer += dt;
  if (activity.timer + EPS < STATIONS.find((s) => s.id === recipe.station)!.craftSeconds) return [];
  idle(state);
  const reason = canCraft(state, world, recipe.id);
  if (reason) return reject('craft', reason);

  removeItems(state.bag, recipe.inputs);
  const out = recipe.output;
  if (out.kind === 'item') {
    addItems(state.bag, [{ item: out.item, qty: out.qty }]);
    see(state, out.item);
  } else if (out.kind === 'tool') {
    state.tools[out.family] = out.tier;
    state.telemetry.firstTool ??= state.realSeconds;
  } else if (out.id === 'consign-box') {
    state.placeables.consignBoxes += 1;
    state.boxes.push([]);
  } else {
    state.placeables.ladder = true;
  }
  state.telemetry.firstCraft ??= state.realSeconds;
  return [{ kind: 'crafted', recipeId: recipe.id, xp: recipe.xp }, ...addXp(state, 'crafting', recipe.xp)];
}

// ── 판매 ───────────────────────────────────────────────

export function shopQuote(state: GameState, item: ItemId, qty: number): number {
  if (!Number.isInteger(qty) || qty <= 0) return 0;
  const sold = state.shopSoldToday[item] ?? 0;
  const full = Math.max(0, Math.min(qty, SHOP.dailyCapPerItem - sold));
  const price = basePrice(item);
  return Math.floor(full * (price * SHOP.rate) + (qty - full) * (price * SHOP.overflowRate) + EPS);
}

/** 모든 함을 합쳐 품목별로 정산해요 */
function boxSettlement(state: GameState): { coins: number; lines: { item: ItemId; qty: number; coins: number }[] } {
  const counts = new Map<ItemId, number>();
  for (const box of state.boxes) for (const slot of box) counts.set(slot.item, (counts.get(slot.item) ?? 0) + slot.qty);
  const lines = [...counts].map(([item, qty]) => {
    const unit = basePrice(item) * BOX.rate;
    const full = Math.min(qty, BOX.decayAfter);
    const gross = full * unit + (qty - full) * unit * BOX.decayRate;
    return { item, qty, coins: Math.floor(gross * (1 - BOX.fee) + EPS) };
  });
  return { coins: lines.reduce((sum, l) => sum + l.coins, 0), lines };
}

export function boxQuote(state: GameState): number {
  return boxSettlement(state).coins;
}

function sellShop(state: GameState, world: World, item: ItemId, qty: number): SimEvent[] {
  if (!ITEMS.some((i) => i.id === item) || !Number.isInteger(qty) || qty <= 0) return reject('sellShop', 'unknown');
  if (!nearSpot(state, world, 'shop')) return reject('sellShop', 'too-far');
  if (countItem(state.bag, item) < qty) return reject('sellShop', 'need-items');
  const coins = shopQuote(state, item, qty);
  removeItems(state.bag, [{ item, qty }]);
  state.coins += coins;
  state.shopSoldToday[item] = (state.shopSoldToday[item] ?? 0) + qty;
  state.telemetry.coinsByChannel.shop += coins;
  state.telemetry.salesByChannel.shop += qty;
  state.telemetry.firstSale ??= state.realSeconds;
  return [{ kind: 'sold', channel: 'shop', item, qty, coins }];
}

function depositBox(state: GameState, world: World, boxIndex: number, item: ItemId, qty: number): SimEvent[] {
  const box = state.boxes[boxIndex];
  if (!box) return reject('depositBox', 'no-box');
  if (!ITEMS.some((i) => i.id === item) || !Number.isInteger(qty) || qty <= 0) return reject('depositBox', 'unknown');
  if (!nearSpot(state, world, 'box-spot')) return reject('depositBox', 'too-far');
  if (countItem(state.bag, item) < qty) return reject('depositBox', 'need-items');
  const room = box.reduce((n, s) => n + (s.item === item ? BOX.stackPerSlot - s.qty : 0), (BOX.slots - box.length) * BOX.stackPerSlot);
  if (room < qty) return reject('depositBox', 'box-full');
  removeItems(state.bag, [{ item, qty }]);
  let left = qty;
  for (const slot of box) {
    if (slot.item !== item) continue;
    const put = Math.min(left, BOX.stackPerSlot - slot.qty);
    slot.qty += put;
    left -= put;
  }
  while (left > 0) {
    const put = Math.min(left, BOX.stackPerSlot);
    box.push({ item, qty: put });
    left -= put;
  }
  return [];
}

function withdrawBox(state: GameState, world: World, boxIndex: number, slotIndex: number): SimEvent[] {
  const box = state.boxes[boxIndex];
  if (!box) return reject('withdrawBox', 'no-box');
  const slot = box[slotIndex];
  if (!slot) return reject('withdrawBox', 'unknown');
  if (!nearSpot(state, world, 'box-spot')) return reject('withdrawBox', 'too-far');
  if (!addItems(state.bag, [{ item: slot.item, qty: slot.qty }])) return reject('withdrawBox', 'bag-full');
  box.splice(slotIndex, 1);
  return [];
}

// ── 시계 ───────────────────────────────────────────────

/** 지금 시각 기준으로 때가 된 노드를 되살려요 */
function respawnDue(state: GameState, world: World): SimEvent[] {
  const events: SimEvent[] = [];
  for (const node of state.nodes) {
    if (node.depletedAt === null) continue;
    const kind = nodeKind(world.map.nodes.find((n) => n.id === node.id)!.kind);
    if (kind.respawn === 'morning' || state.gameMinutes + EPS < node.depletedAt + kind.respawn) continue;
    node.hitsLeft = kind.hits;
    node.depletedAt = null;
    events.push({ kind: 'nodeRespawned', nodeId: node.id });
  }
  return events;
}

/** 아침: 판매함 정산 → 상점 오늘 판매 수 비우기 → 'morning' 노드 되살리기 → dayStarted */
function morning(state: GameState, world: World): SimEvent[] {
  const events: SimEvent[] = [];
  const { coins, lines } = boxSettlement(state);
  if (lines.length > 0) {
    state.coins += coins;
    state.telemetry.coinsByChannel.box += coins;
    state.telemetry.salesByChannel.box += lines.reduce((n, l) => n + l.qty, 0);
    state.telemetry.firstSale ??= state.realSeconds;
    for (const box of state.boxes) box.length = 0;
    events.push({ kind: 'boxSettled', coins, lines });
  }
  state.shopSoldToday = {};
  for (const node of state.nodes) {
    if (node.depletedAt === null) continue;
    const kind = nodeKind(world.map.nodes.find((n) => n.id === node.id)!.kind);
    if (kind.respawn !== 'morning') continue;
    node.hitsLeft = kind.hits;
    node.depletedAt = null;
    events.push({ kind: 'nodeRespawned', nodeId: node.id });
  }
  events.push({ kind: 'dayStarted', day: dayIndex(state.gameMinutes) + 1 });
  return events;
}

function sleep(state: GameState, world: World): SimEvent[] {
  idle(state);
  state.gameMinutes = (dayIndex(state.gameMinutes) + 1) * DAY_MINUTES;
  return [...respawnDue(state, world), ...morning(state, world)];
}

// ── 이동 ───────────────────────────────────────────────

function moveTo(state: GameState, world: World, cell: Cell, then: Intent | null): SimEvent[] {
  const size = world.map.grid.cellSize;
  const here = worldToCell(state.player, size);
  const path = findPath(world, here, cell);
  if (!path) return reject('moveTo', 'blocked');
  // 칸 사이에서 길을 바꾸면, 다음 칸 쪽으로 가던 중이 아닌 한 지금 칸 중심부터 들러요(모서리를 가로지르지 않게)
  const center = cellCenter(here, size);
  const dx = state.player.x - center.x, dz = state.player.z - center.z;
  if (dx !== 0 || dz !== 0) {
    const next = path[0];
    const ahead = next !== undefined
      && dx * (next.z - here.z) === dz * (next.x - here.x)
      && dx * (next.x - here.x) + dz * (next.z - here.z) > 0;
    if (!ahead) path.unshift(here);
  }
  if (path.length === 0) {
    idle(state);
    return then ? applyIntent(state, world, then) : [];
  }
  state.player.activity = { kind: 'walking', path, then };
  return [];
}

function tickWalking(state: GameState, world: World, dt: number): SimEvent[] {
  const activity = state.player.activity;
  if (activity.kind !== 'walking') return [];
  let budget = WALK_SPEED * dt;
  while (activity.path.length > 0) {
    const target = cellCenter(activity.path[0]!, world.map.grid.cellSize);
    const dx = target.x - state.player.x, dz = target.z - state.player.z;
    const distance = Math.hypot(dx, dz);
    if (distance > budget + EPS) {
      state.player.x += (dx / distance) * budget;
      state.player.z += (dz / distance) * budget;
      return [];
    }
    state.player.x = target.x;
    state.player.z = target.z;
    budget -= distance;
    activity.path.shift();
  }
  idle(state);
  return activity.then ? applyIntent(state, world, activity.then) : [];
}

// ── 진입점 ─────────────────────────────────────────────

export function applyIntent(state: GameState, world: World, intent: Intent): SimEvent[] {
  switch (intent.kind) {
    case 'moveTo':
      // 부른 쪽 객체와 끊고, 저장했다 불러와도 같은 모양이 되게 복사해요
      return moveTo(state, world, intent.cell, intent.then ? (JSON.parse(JSON.stringify(intent.then)) as Intent) : null);
    case 'gather': {
      const current = state.player.activity;
      if (current.kind === 'gathering' && current.nodeId === intent.nodeId) return []; // 다시 눌러도 휘두르기는 이어져요
      const reason = gatherBlock(state, world, intent.nodeId);
      if (reason) return reject('gather', reason);
      state.player.activity = { kind: 'gathering', nodeId: intent.nodeId, swingTimer: 0, swingsDone: 0 };
      return [];
    }
    case 'stopAction':
      idle(state);
      return [];
    case 'craft': {
      if (state.player.activity.kind === 'crafting') return reject('craft', 'busy');
      const reason = canCraft(state, world, intent.recipeId);
      if (reason) return reject('craft', reason);
      state.player.activity = { kind: 'crafting', recipeId: intent.recipeId, timer: 0 };
      return [];
    }
    case 'sellShop':
      return sellShop(state, world, intent.item, intent.qty);
    case 'depositBox':
      return depositBox(state, world, intent.boxIndex, intent.item, intent.qty);
    case 'withdrawBox':
      return withdrawBox(state, world, intent.boxIndex, intent.slot);
    case 'sleep':
      return sleep(state, world);
    default:
      return reject((intent as Intent).kind, 'unknown');
  }
}

/** 이동 → 활동(휘두르기·제작) → 시계 → 리스폰 → 아침. dt는 MAX_STEP으로 잘라요 */
export function tick(state: GameState, world: World, dtSeconds: number): SimEvent[] {
  const dt = dtSeconds > 0 ? Math.min(dtSeconds, MAX_STEP) : 0;
  if (dt === 0) return [];
  // 이번 걸음에 도착해 시작한 일은 다음 걸음부터 시간이 흘러요
  const kind = state.player.activity.kind;
  const events = kind === 'walking' ? tickWalking(state, world, dt)
    : kind === 'gathering' ? tickGathering(state, world, dt)
      : kind === 'crafting' ? tickCrafting(state, world, dt)
        : [];
  const day = dayIndex(state.gameMinutes);
  state.realSeconds += dt;
  state.gameMinutes += (dt * DAY_MINUTES) / world.clock.dayRealSeconds;
  events.push(...respawnDue(state, world));
  if (dayIndex(state.gameMinutes) > day) events.push(...morning(state, world));
  return events;
}
