// 줍줍 마스터 수치 표 (DESIGN.md 3~6절을 그대로 옮긴 시작값, 2026-11-25).
// 값을 바꿀 때는 DESIGN.md 표도 같이 고쳐요. test/data.test.ts가 규칙(기준가·XP 공식)과 대조해요.
import type {
  BoxRule, ClockRule, CropDef, DropDef, HouseStageDef, ItemDef, ItemId, MarketRule, NodeKindDef,
  RecipeDef, ResourceDef, ShopRule, StationDef, ToolTierDef,
} from './types.ts';

/** 휘두르기 1번의 기본 실제 초(도구 속도로 나눠요) */
export const SWING_SECONDS = 0.8;
/** 노드·제작대·상점 칸 중심과 플레이어 사이가 이 거리(m) 안이어야 해요. 옆 칸(2m)은 되고 대각선(2.83m)은 안 돼요 */
export const REACH_METERS = 2.5;
/** 한 번에 반영하는 최대 실제 초(탭이 멈췄다 돌아와도 튀지 않게) */
export const MAX_STEP = 0.1;
/** 걷는 속도(m/s) */
export const WALK_SPEED = 4;
/** 층 0..3의 실제 높이(m): 물가·해변 / 들판 / 언덕 / 고원 */
export const LEVEL_HEIGHTS = [0, 1, 4, 8] as const;
/** 제작물 기준가 단계 보너스(4-2절) */
export const TIER_BONUS = { 1: 2, 2: 8, 3: 25, 4: 60 } as const;
/** 기준가 배율(4-2절) */
export const PRICE_MULTIPLIER = 1.4;

export const CLOCK: ClockRule = { dayRealSeconds: 720, morningHour: 6 };
/** 시제품(P1)은 게임 하루를 3분으로 줄여요(3-3절) */
export const CLOCK_PROTOTYPE: ClockRule = { dayRealSeconds: 180, morningHour: 6 };

export const SHOP: ShopRule = { rate: 0.6, dailyCapPerItem: 20, overflowRate: 0.3 };
export const BOX: BoxRule = {
  rate: 0.9, fee: 0.1, slots: 10, stackPerSlot: 20, decayAfter: 10, decayRate: 0.5, settleHour: 6,
};
export const MARKET: MarketRule = {
  rate: 1.0, demandRate: 1.3, goodsRate: 1.1, stallFee: 30, perSlotPerDay: 5,
  slotsByHouse: { 1: 8, 3: 12, 4: 16 }, everyDays: 5, demandItems: 3,
};

/** 레벨 곡선(6절): 다음 레벨까지 XP */
export function xpToNext(level: number): number {
  return Math.round(20 * level ** 1.6);
}
export const MAX_LEVEL_PROTOTYPE = 10;

// ── 자원(3-1절) ─────────────────────────────────────────

const axe0 = { family: 'axe', minTier: 0 } as const;
const pick0 = { family: 'pickaxe', minTier: 0 } as const;
const pick1 = { family: 'pickaxe', minTier: 1 } as const;
const can0 = { family: 'can', minTier: 0 } as const;

export const RESOURCES: readonly ResourceDef[] = [
  { id: 'branch', skill: 'gathering', level: 1, tool: 'hand', swings: 1, xp: 3, access: null },
  { id: 'log', skill: 'gathering', level: 1, tool: axe0, swings: 3, xp: 6, access: null },
  { id: 'reed', skill: 'gathering', level: 2, tool: 'hand', swings: 1, xp: 4, access: null },
  { id: 'berry', skill: 'gathering', level: 3, tool: 'hand', swings: 1, xp: 5, access: null },
  { id: 'shell', skill: 'gathering', level: 4, tool: 'hand', swings: 1, xp: 6, access: null },
  { id: 'mushroom', skill: 'gathering', level: 5, tool: 'hand', swings: 1, xp: 10, access: null },
  { id: 'herb', skill: 'gathering', level: 7, tool: 'hand', swings: 1, xp: 12, access: 'ladder' },
  { id: 'hardwood', skill: 'gathering', level: 8, tool: { family: 'axe', minTier: 2 }, swings: 5, xp: 22, access: 'ladder' },
  { id: 'sap', skill: 'gathering', level: 10, tool: { family: 'axe', minTier: 3 }, swings: 2, xp: 26, access: 'ladder' },
  { id: 'stone', skill: 'mining', level: 1, tool: pick0, swings: 3, xp: 5, access: null },
  { id: 'sand', skill: 'mining', level: 2, tool: pick0, swings: 1, xp: 3, access: null },
  { id: 'clay', skill: 'mining', level: 2, tool: pick0, swings: 2, xp: 5, access: null },
  { id: 'coal', skill: 'mining', level: 4, tool: pick1, swings: 4, xp: 10, access: null },
  { id: 'copper-ore', skill: 'mining', level: 4, tool: pick1, swings: 4, xp: 12, access: null },
  { id: 'fossil', skill: 'mining', level: 6, tool: pick1, swings: 0, xp: 30, access: null },
  { id: 'iron-ore', skill: 'mining', level: 8, tool: { family: 'pickaxe', minTier: 2 }, swings: 5, xp: 24, access: 'lantern' },
  { id: 'crystal', skill: 'mining', level: 12, tool: { family: 'pickaxe', minTier: 3 }, swings: 6, xp: 55, access: 'lantern' },
  { id: 'turnip', skill: 'farming', level: 1, tool: can0, swings: 0, xp: 5, access: null },
  { id: 'wheat', skill: 'farming', level: 2, tool: can0, swings: 0, xp: 6, access: null },
  { id: 'carrot', skill: 'farming', level: 3, tool: can0, swings: 0, xp: 11, access: null },
  { id: 'cotton', skill: 'farming', level: 5, tool: can0, swings: 0, xp: 12, access: null },
  { id: 'tomato', skill: 'farming', level: 6, tool: can0, swings: 0, xp: 7, access: null },
  { id: 'pumpkin', skill: 'farming', level: 7, tool: can0, swings: 0, xp: 28, access: null },
  { id: 'strawberry', skill: 'farming', level: 10, tool: can0, swings: 0, xp: 14, access: null },
];

export const CROPS: readonly CropDef[] = [
  { item: 'turnip', seedPrice: 1, growSeconds: 90, harvests: 1 },
  { item: 'wheat', seedPrice: 2, growSeconds: 120, harvests: 1 },
  { item: 'carrot', seedPrice: 3, growSeconds: 180, harvests: 1 },
  { item: 'cotton', seedPrice: 5, growSeconds: 240, harvests: 1 },
  { item: 'tomato', seedPrice: 6, growSeconds: 240, harvests: 3 },
  { item: 'pumpkin', seedPrice: 10, growSeconds: 360, harvests: 1 },
  { item: 'strawberry', seedPrice: 25, growSeconds: 300, harvests: 3 },
];

export const DROPS: readonly DropDef[] = [{ item: 'fossil', fromResource: 'stone', chance: 0.02 }];

// ── 품목(기준가·이름) ────────────────────────────────────

const STACK = 20;
const item = (id: ItemId, name: string, basePrice: number): ItemDef => ({ id, name, basePrice, stack: STACK });

export const ITEMS: readonly ItemDef[] = [
  item('branch', '나뭇가지', 2), item('log', '통나무', 5), item('reed', '갈대', 3),
  item('berry', '산딸기', 5), item('shell', '조개껍데기', 6), item('mushroom', '버섯', 12),
  item('herb', '약초', 15), item('hardwood', '단단한 원목', 22), item('sap', '수액', 30),
  item('stone', '돌', 3), item('sand', '모래', 2), item('clay', '점토', 4), item('coal', '석탄', 8),
  item('copper-ore', '구리 광석', 10), item('fossil', '화석', 80), item('iron-ore', '철 광석', 24),
  item('crystal', '수정', 70),
  item('turnip', '순무', 6), item('wheat', '밀', 7), item('carrot', '당근', 14), item('cotton', '목화', 16),
  item('tomato', '토마토', 9), item('pumpkin', '호박', 40), item('strawberry', '딸기', 18),
  item('plank', '판자', 16), item('rope', '밧줄', 15), item('brick', '벽돌', 30),
  item('copper-ingot', '구리 주괴', 61), item('glass', '유리', 28), item('crate', '나무 상자', 98),
  item('chair', '나무 의자', 96), item('bread', '빵', 37), item('berry-jam', '산딸기 잼', 75),
  item('thread', '실', 53), item('cloth', '천', 248), item('straw-hat', '밀짚모자', 148),
  item('lantern', '등불', 150), item('iron-ingot', '철 주괴', 148),
  item('hardwood-table', '고급 원목 탁자', 225), item('fossil-cabinet', '화석 장식장', 340),
  item('crystal-lamp', '수정 등', 542),
];

// ── 노드 종류와 리스폰(3-3절) ────────────────────────────

export const NODE_KINDS: readonly NodeKindDef[] = [
  { id: 'branch-spot', yields: 'branch', hits: 1, respawn: 120, placement: 'zone-random' },
  { id: 'reed-spot', yields: 'reed', hits: 1, respawn: 180, placement: 'zone-random' },
  { id: 'tree', yields: 'log', hits: 3, respawn: 240, placement: 'fixed' },
  { id: 'rock', yields: 'stone', hits: 3, respawn: 360, placement: 'fixed' },
  { id: 'berry-bush', yields: 'berry', hits: 3, respawn: 360, placement: 'fixed' },
  { id: 'shell-spot', yields: 'shell', hits: 1, respawn: 'morning', placement: 'zone-random' },
  { id: 'mushroom-spot', yields: 'mushroom', hits: 1, respawn: 'morning', placement: 'zone-random' },
  { id: 'herb-spot', yields: 'herb', hits: 1, respawn: 720, placement: 'zone-random' },
  { id: 'hardwood-tree', yields: 'hardwood', hits: 3, respawn: 720, placement: 'fixed' },
  { id: 'old-tree', yields: 'sap', hits: 2, respawn: 1440, placement: 'fixed' },
  { id: 'sand-bar', yields: 'sand', hits: 3, respawn: 120, placement: 'fixed' },
  { id: 'clay-bank', yields: 'clay', hits: 3, respawn: 240, placement: 'fixed' },
  { id: 'coal-vein', yields: 'coal', hits: 3, respawn: 480, placement: 'fixed' },
  { id: 'copper-vein', yields: 'copper-ore', hits: 3, respawn: 720, placement: 'fixed' },
  { id: 'iron-vein', yields: 'iron-ore', hits: 3, respawn: 1440, placement: 'fixed' },
  { id: 'crystal-vein', yields: 'crystal', hits: 2, respawn: 4320, placement: 'fixed' },
];

// ── 도구(3-2절) ─────────────────────────────────────────

export const TOOL_TIERS: readonly ToolTierDef[] = [
  { tier: 0, name: '나무', speed: 1.0, recipePrefix: null },
  { tier: 1, name: '돌', speed: 1.3, recipePrefix: 'stone' },
  { tier: 2, name: '구리', speed: 1.7, recipePrefix: 'copper' },
  { tier: 3, name: '철', speed: 2.2, recipePrefix: 'iron' },
  { tier: 4, name: '수정', speed: 2.8, recipePrefix: 'crystal' },
];

// ── 제작대(4-1절) ───────────────────────────────────────

export const STATIONS: readonly StationDef[] = [
  { id: 'workbench', coins: 0, items: [], craftLevel: 1, houseStage: 1, craftSeconds: 3 },
  { id: 'kiln', coins: 300, items: [{ item: 'stone', qty: 20 }], craftLevel: 3, houseStage: 1, craftSeconds: 10 },
  { id: 'carpentry', coins: 600, items: [{ item: 'log', qty: 30 }], craftLevel: 4, houseStage: 1, craftSeconds: 10 },
  { id: 'kitchen', coins: 800, items: [{ item: 'stone', qty: 30 }, { item: 'plank', qty: 10 }], craftLevel: 5, houseStage: 1, craftSeconds: 10 },
  { id: 'loom', coins: 1500, items: [{ item: 'plank', qty: 10 }, { item: 'rope', qty: 10 }], craftLevel: 6, houseStage: 1, craftSeconds: 30 },
  { id: 'smithy', coins: 3000, items: [{ item: 'brick', qty: 20 }], craftLevel: 8, houseStage: 1, craftSeconds: 30 },
  { id: 'workshop', coins: 8000, items: [{ item: 'glass', qty: 10 }, { item: 'iron-ingot', qty: 10 }], craftLevel: 12, houseStage: 4, craftSeconds: 60 },
];

// ── 레시피(4-2절) ───────────────────────────────────────

const goods = (id: RecipeDef['id'], tier: RecipeDef['tier'], station: RecipeDef['station'],
  inputs: RecipeDef['inputs'], xp: number, craftLevel = 1): RecipeDef =>
  ({ id, tier, station, inputs, output: { kind: 'item', item: id as never, qty: 1 }, craftLevel, xp });

const toolRecipes = (prefix: string, tier: 1 | 2 | 3 | 4, toolTier: 1 | 2 | 3 | 4,
  station: RecipeDef['station'], inputs: RecipeDef['inputs'], craftLevel: number,
  familySkillLevel: number, xp: number): RecipeDef[] =>
  (['axe', 'pickaxe', 'can'] as const).map((family) => ({
    id: `${prefix}-${family}`, tier, station, inputs,
    output: { kind: 'tool', family, tier: toolTier }, craftLevel, familySkillLevel, xp,
  }));

export const RECIPES: readonly RecipeDef[] = [
  // T1 작업대
  goods('plank', 1, 'workbench', [{ item: 'log', qty: 2 }], 8),
  goods('rope', 1, 'workbench', [{ item: 'reed', qty: 3 }], 8),
  ...toolRecipes('stone', 1, 1, 'workbench', [{ item: 'branch', qty: 2 }, { item: 'stone', qty: 3 }], 2, 3, 7),
  { id: 'consign-box', tier: 1, station: 'workbench', inputs: [{ item: 'plank', qty: 4 }, { item: 'rope', qty: 2 }],
    output: { kind: 'placeable', id: 'consign-box' }, craftLevel: 2, xp: 47 },
  { id: 'ladder', tier: 1, station: 'workbench', inputs: [{ item: 'plank', qty: 2 }, { item: 'rope', qty: 1 }],
    output: { kind: 'placeable', id: 'ladder' }, craftLevel: 1, xp: 24 },
  // T2
  goods('brick', 2, 'kiln', [{ item: 'clay', qty: 2 }, { item: 'coal', qty: 1 }], 15),
  goods('copper-ingot', 2, 'kiln', [{ item: 'copper-ore', qty: 3 }, { item: 'coal', qty: 1 }], 31),
  goods('glass', 2, 'kiln', [{ item: 'sand', qty: 3 }, { item: 'coal', qty: 1 }], 14),
  goods('crate', 2, 'carpentry', [{ item: 'plank', qty: 4 }], 49),
  goods('chair', 2, 'carpentry', [{ item: 'plank', qty: 3 }, { item: 'rope', qty: 1 }], 48),
  goods('bread', 2, 'kitchen', [{ item: 'wheat', qty: 3 }], 19),
  goods('berry-jam', 2, 'kitchen', [{ item: 'berry', qty: 4 }, { item: 'glass', qty: 1 }], 38),
  goods('thread', 2, 'loom', [{ item: 'cotton', qty: 2 }], 27),
  // T3
  goods('cloth', 3, 'loom', [{ item: 'thread', qty: 3 }], 124),
  goods('straw-hat', 3, 'loom', [{ item: 'wheat', qty: 5 }, { item: 'thread', qty: 1 }], 74),
  goods('lantern', 3, 'smithy', [{ item: 'copper-ingot', qty: 1 }, { item: 'glass', qty: 1 }], 75),
  goods('iron-ingot', 3, 'smithy', [{ item: 'iron-ore', qty: 3 }, { item: 'coal', qty: 2 }], 74),
  ...toolRecipes('copper', 3, 2, 'smithy', [{ item: 'copper-ingot', qty: 3 }, { item: 'plank', qty: 2 }], 1, 6, 108),
  ...toolRecipes('iron', 3, 3, 'smithy', [{ item: 'iron-ingot', qty: 3 }, { item: 'hardwood', qty: 2 }], 1, 9, 244),
  // T4 공방
  goods('hardwood-table', 4, 'workshop', [{ item: 'hardwood', qty: 4 }, { item: 'sap', qty: 1 }], 113),
  goods('fossil-cabinet', 4, 'workshop', [{ item: 'fossil', qty: 1 }, { item: 'plank', qty: 4 }, { item: 'glass', qty: 2 }], 170),
  goods('crystal-lamp', 4, 'workshop', [{ item: 'crystal', qty: 2 }, { item: 'iron-ingot', qty: 1 }, { item: 'glass', qty: 2 }], 271),
  ...toolRecipes('crystal', 4, 4, 'workshop', [{ item: 'crystal', qty: 3 }, { item: 'iron-ingot', qty: 2 }], 1, 14, 253),
];

// ── 집 단계(6절) ────────────────────────────────────────

export const HOUSE_STAGES: readonly HouseStageDef[] = [
  { stage: 1, name: '텐트', coins: 0, items: [], skillReq: null, bagSlots: 12, fieldPlots: 4, boxes: 1, companions: 0 },
  { stage: 2, name: '오두막', coins: 500, items: [{ item: 'plank', qty: 20 }], skillReq: null, bagSlots: 18, fieldPlots: 8, boxes: 2, companions: 1 },
  { stage: 3, name: '나무집', coins: 2500, items: [{ item: 'brick', qty: 20 }, { item: 'plank', qty: 30 }], skillReq: { count: 1, level: 6 }, bagSlots: 18, fieldPlots: 12, boxes: 2, companions: 2 },
  { stage: 4, name: '큰 집', coins: 10000, items: [{ item: 'iron-ingot', qty: 10 }, { item: 'glass', qty: 10 }], skillReq: { count: 2, level: 10 }, bagSlots: 18, fieldPlots: 12, boxes: 2, companions: 4 },
  { stage: 5, name: '장인의 집', coins: 40000, items: [{ item: 'crystal-lamp', qty: 2 }, { item: 'hardwood-table', qty: 2 }], skillReq: { count: 4, level: 15 }, bagSlots: 18, fieldPlots: 12, boxes: 2, companions: 6 },
];
