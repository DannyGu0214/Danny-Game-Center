// 줍줍 마스터 규칙 코어의 데이터 모양 (P0+P1 확정본, 2026-11-25).
// three를 import하지 않아요. 수치는 data.ts, 시제품 지도는 map-p1.ts에 있어요.
// 이 파일의 모양을 바꾸려면 docs/p0-p1-tasks.md의 "모양 변경" 절차를 따라요.

// ── 식별자 ─────────────────────────────────────────────

export const SKILLS = ['gathering', 'mining', 'farming', 'crafting'] as const;
/** 기술 4개(확정): 채집·채광·농사·제작 */
export type SkillId = (typeof SKILLS)[number];

export const RESOURCE_IDS = [
  // 채집
  'branch', 'log', 'reed', 'berry', 'shell', 'mushroom', 'herb', 'hardwood', 'sap',
  // 채광
  'stone', 'sand', 'clay', 'coal', 'copper-ore', 'fossil', 'iron-ore', 'crystal',
  // 농사
  'turnip', 'wheat', 'carrot', 'cotton', 'tomato', 'pumpkin', 'strawberry',
] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export const GOODS_IDS = [
  'plank', 'rope', 'brick', 'copper-ingot', 'glass', 'crate', 'chair', 'bread', 'berry-jam',
  'thread', 'cloth', 'straw-hat', 'lantern', 'iron-ingot', 'hardwood-table', 'fossil-cabinet',
  'crystal-lamp',
] as const;
/** 팔 수 있는 제작물 */
export type GoodsId = (typeof GOODS_IDS)[number];

/** 가방에 들어가는 모든 것 = 자원 + 제작물. 도구·설치물은 가방에 들어가지 않아요 */
export type ItemId = ResourceId | GoodsId;

export const TOOL_FAMILIES = ['axe', 'pickaxe', 'can'] as const;
/** 도끼(채집)·곡괭이(채광)·물뿌리개(농사) */
export type ToolFamily = (typeof TOOL_FAMILIES)[number];

/** 0 나무(시작) · 1 돌 · 2 구리 · 3 철 · 4 수정 */
export type ToolTier = 0 | 1 | 2 | 3 | 4;

export const STATION_IDS = ['workbench', 'kiln', 'carpentry', 'kitchen', 'loom', 'smithy', 'workshop'] as const;
export type StationId = (typeof STATION_IDS)[number];

/** 세우거나 놓는 것. 가방에 들어가지 않고 상태에 플래그·개수로 남아요 */
export type PlaceableId = 'consign-box' | 'ladder';

/** 들어가려면 필요한 것. 고원은 사다리, 동굴 깊은 곳은 등불(가방에 1개 이상) */
export type AccessKey = 'ladder' | 'lantern';

export type ChannelId = 'shop' | 'box' | 'market';

// ── 정적 데이터 정의(data.ts) ───────────────────────────

export interface ItemDef {
  id: ItemId;
  name: string; // 화면 이름(한국어)
  basePrice: number; // 기준가(코인). 매개체 정산의 기준
  stack: number; // 한 칸 최대 개수
}

/** 캐는 자원. 농사 자원은 CropDef를 같이 가져요 */
export interface ResourceDef {
  id: ResourceId;
  skill: SkillId;
  level: number; // 필요한 기술 레벨
  /** 'hand' = 맨손, 아니면 도구 계열과 최소 단계 */
  tool: 'hand' | { family: ToolFamily; minTier: ToolTier };
  swings: number; // 한 개 얻는 데 필요한 휘두르기 수(농사·드롭은 0)
  xp: number; // 한 개 얻을 때 XP
  access: AccessKey | null;
}

export interface CropDef {
  item: ResourceId; // 수확물
  seedPrice: number; // 씨앗 값(코인)
  growSeconds: number; // 실제 초(물뿌리개 단계마다 −10%)
  harvests: number; // 몇 번 거두는지(토마토·딸기 3)
}

/** 다른 노드를 캘 때 확률로 나오는 것(화석) */
export interface DropDef {
  item: ResourceId;
  fromResource: ResourceId;
  chance: number; // 0~1
}

/** 지도 위 노드 종류. 큰 노드는 같은 자리, 작은 줍기 자원은 구역 무작위(P2) */
export interface NodeKindDef {
  id: string; // 'tree' | 'rock' | 'branch-spot' | 'reed-spot' ...
  yields: ResourceId;
  /** 고갈 전까지 몇 개 나오는지(시작값, 봇으로 조정) */
  hits: number;
  /** 게임 분(3-3절 표). 'morning' = 매일 아침 6시에 다시 나요(조개·버섯) */
  respawn: number | 'morning';
  placement: 'fixed' | 'zone-random';
}

export interface ToolTierDef {
  tier: ToolTier;
  name: string;
  speed: number; // 휘두르기 속도 배율. 휘두르기 1번 = SWING_SECONDS ÷ speed
  /** 이 단계 도구를 만드는 레시피 id 접두사. 레시피 id = '<prefix>-<family>'(예: stone-axe). 시작 단계는 null */
  recipePrefix: string | null;
}

export interface Ingredient {
  item: ItemId;
  qty: number;
}

export type RecipeOutput =
  | { kind: 'item'; item: GoodsId; qty: number }
  | { kind: 'tool'; family: ToolFamily; tier: ToolTier }
  | { kind: 'placeable'; id: PlaceableId };

export interface RecipeDef {
  id: string; // 'plank', 'stone-axe', 'consign-box' ...
  tier: 1 | 2 | 3 | 4;
  station: StationId;
  inputs: Ingredient[];
  output: RecipeOutput;
  craftLevel: number; // 제작 기술 필요 레벨
  /** 도구 레시피만: 해당 계열 기술 필요 레벨(3-2절) */
  familySkillLevel?: number;
  xp: number; // 제작 XP(4-2절 규칙으로 계산해 적어 둔 값, 테스트가 규칙과 대조)
}

export interface StationDef {
  id: StationId;
  coins: number;
  items: Ingredient[];
  craftLevel: number;
  houseStage: number; // 필요한 집 단계(공방만 4)
  craftSeconds: number; // 레시피 하나 만드는 실제 초
}

export interface ShopRule {
  rate: number; // 0.6
  dailyCapPerItem: number; // 20
  overflowRate: number; // 0.3 (기준가 × 30%)
}

export interface BoxRule {
  rate: number; // 0.9
  fee: number; // 0.1 (판매액의 10%)
  slots: number; // 10
  stackPerSlot: number; // 20
  decayAfter: number; // 같은 품목 하룻밤 10개 넘는 몫
  decayRate: number; // 0.5
  settleHour: number; // 6
}

export interface MarketRule {
  rate: number; // 1.0
  demandRate: number; // 1.3
  goodsRate: number; // 1.1
  stallFee: number; // 30
  perSlotPerDay: number; // 5
  slotsByHouse: Record<number, number>; // {1:8, 3:12, 4:16}
  everyDays: number; // 5
  demandItems: number; // 3
}

export interface HouseStageDef {
  stage: 1 | 2 | 3 | 4 | 5;
  name: string;
  coins: number;
  items: Ingredient[];
  /** 조건: count개의 기술이 level 이상 */
  skillReq: { count: number; level: number } | null;
  bagSlots: number;
  fieldPlots: number;
  boxes: number; // 놓을 수 있는 판매함 수
  companions: number;
}

export interface ClockRule {
  /** 게임 하루 = 실제 몇 초. 정식 720(12분), 시제품 180(3분) */
  dayRealSeconds: number;
  /** 하루가 시작하는 시각(게임 시). 정산·리스폰 아침 기준 */
  morningHour: number; // 6
}

// ── 지형(P1: 40×40m, 2m 칸) ─────────────────────────────

/** 칸 종류. cliff는 못 지나가요. ramp는 아래·위 층을 이어요 */
export type CellKind = 'water' | 'sand' | 'ground' | 'cliff' | 'ramp';

export interface TerrainGrid {
  cellSize: number; // 2 (m)
  width: number; // 칸 수 20
  height: number; // 칸 수 20
  /** 행 우선(index = z * width + x) */
  kinds: CellKind[];
  /** 칸 높이 층 0..3. 실제 높이(m)는 LEVEL_HEIGHTS[level] */
  levels: number[];
}

export interface NodeSpawn {
  id: string; // 'tree-01' 같은 고정 id(저장에 쓰여요)
  kind: string; // NodeKindDef.id
  cell: { x: number; z: number }; // 칸 좌표
}

export interface StationSpawn {
  id: StationId | 'shop' | 'box-spot' | 'bed';
  cell: { x: number; z: number };
}

export interface MapDef {
  grid: TerrainGrid;
  start: { x: number; z: number }; // 칸 좌표
  nodes: NodeSpawn[];
  spots: StationSpawn[];
}

// ── 변하는 상태(저장되는 것) ────────────────────────────

/** 가방 한 칸. 빈 칸은 null */
export type BagSlot = { item: ItemId; qty: number } | null;

export interface SkillState {
  level: number; // 1부터
  xp: number; // 현재 레벨 안에서 쌓인 XP(레벨업하면 넘친 만큼 이월)
  totalXp: number;
}

export interface NodeState {
  id: string; // NodeSpawn.id
  hitsLeft: number; // 0이면 고갈
  /** 고갈된 게임 분. 고갈이 아니면 null. 리스폰 시각 = depletedAt + respawn */
  depletedAt: number | null;
}

export interface BoxSlot {
  item: ItemId;
  qty: number;
}

export interface Telemetry {
  /** 첫 사건까지 걸린 실제 초(디버그 HUD·봇). 아직이면 null */
  firstGather: number | null;
  firstCraft: number | null;
  firstSale: number | null;
  firstLevelUp: number | null;
  firstTool: number | null;
  coinsByChannel: Record<ChannelId, number>;
  salesByChannel: Record<ChannelId, number>; // 판 개수
  xpBySkill: Record<SkillId, number>;
}

export type Activity =
  | { kind: 'idle' }
  /** path = 칸 좌표 목록(다음 칸부터). 도착하면 then을 그대로 실행해요 */
  | { kind: 'walking'; path: { x: number; z: number }[]; then: Intent | null }
  | { kind: 'gathering'; nodeId: string; swingTimer: number; swingsDone: number }
  | { kind: 'crafting'; recipeId: string; timer: number };

export interface GameState {
  version: 1;
  seed: number;
  rng: number; // 시드 RNG 내부 상태(mulberry32)
  realSeconds: number; // 플레이한 실제 초(정지 중 제외)
  /** 게임 시계: 1일차 아침 6시를 0으로 둔 게임 분 */
  gameMinutes: number;
  coins: number;
  bag: BagSlot[]; // 길이 = 집 단계의 bagSlots
  skills: Record<SkillId, SkillState>;
  tools: Record<ToolFamily, ToolTier>;
  stations: StationId[]; // 세운 제작대
  placeables: { consignBoxes: number; ladder: boolean };
  houseStage: 1 | 2 | 3 | 4 | 5;
  /** 처음 주운 품목. 레시피 공개 조건(4-2절) */
  seenItems: ItemId[];
  nodes: NodeState[];
  /** 위탁판매함들. 함마다 칸 배열 */
  boxes: BoxSlot[][];
  /** 오늘(이번 게임 날) 상점에 판 개수, 아침마다 비워요 */
  shopSoldToday: Partial<Record<ItemId, number>>;
  player: { x: number; z: number; activity: Activity }; // 월드 좌표(m)
  telemetry: Telemetry;
}

/** localStorage 'gather-master:save'에 JSON으로 들어가는 모양 */
export interface SaveFile {
  version: 1;
  savedAtEpochMs: number; // P2 접속 공백(8시간) 판정용
  state: GameState;
}

// ── 입력 의도와 사건 ─────────────────────────────────────

/** 화면·봇이 규칙에 보내는 요청. 규칙은 이것만 받아요 */
export type Intent =
  /** 그 칸까지 걸어가요. then이 있으면 도착 뒤 실행해요(노드 클릭 = moveTo(옆 칸, then: gather)) */
  | { kind: 'moveTo'; cell: { x: number; z: number }; then?: Intent }
  /** 노드가 고갈되거나 stopAction·가방 가득일 때까지 계속 캐요 */
  | { kind: 'gather'; nodeId: string }
  | { kind: 'stopAction' }
  | { kind: 'craft'; recipeId: string }
  | { kind: 'sellShop'; item: ItemId; qty: number }
  | { kind: 'depositBox'; boxIndex: number; item: ItemId; qty: number }
  | { kind: 'withdrawBox'; boxIndex: number; slot: number }
  | { kind: 'sleep' };

export type RejectReason =
  | 'too-far' | 'node-depleted' | 'need-tool' | 'need-level' | 'need-access'
  | 'need-items' | 'need-station' | 'bag-full' | 'box-full' | 'no-box' | 'busy' | 'blocked' | 'unknown';

/** 규칙이 내보내는 사건. 화면(HUD·연출·소리)과 텔레메트리가 이걸 받아요 */
export type SimEvent =
  | { kind: 'swing'; nodeId: string }
  | { kind: 'gathered'; nodeId: string; item: ItemId; qty: number; xp: number; skill: SkillId }
  | { kind: 'nodeDepleted'; nodeId: string }
  | { kind: 'nodeRespawned'; nodeId: string }
  | { kind: 'levelUp'; skill: SkillId; level: number }
  | { kind: 'crafted'; recipeId: string; xp: number }
  | { kind: 'sold'; channel: ChannelId; item: ItemId; qty: number; coins: number }
  | { kind: 'boxSettled'; coins: number; lines: { item: ItemId; qty: number; coins: number }[] }
  | { kind: 'dayStarted'; day: number }
  | { kind: 'rejected'; intent: Intent['kind']; reason: RejectReason };
