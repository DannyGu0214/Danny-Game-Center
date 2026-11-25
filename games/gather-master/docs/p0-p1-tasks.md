# 줍줍 마스터 P0+P1 구현 지시서

- 작성: 2026-11-25. 메인 칸(opus) 설계 결과예요. PLAN.md 2절의 P0·P1 "opus-1 design" 몫을 이 문서로 갈음해요.
- 받는 칸: sonnet-1 `impl`, sonnet-2 `test`. 이 문서와 `src/sim/types.ts`·`data.ts`·`map-p1.ts`만 읽으면 시작할 수 있게 썼어요.
- 근거: DESIGN.md 1·3·4·5·6·12·13절, PLAN.md 1·2절, 스킬 `threejs-gameplay-systems`(설계 3문서·루프 계약·시드 RNG·결정적 테스트 훅), `threejs-game-director`(범위는 사용자 말이 정함, 증거 보고).

## 0. 지켜야 할 것

- 작업 위치:
  - P0: worktree `claude/gather-master-p0`. `claude/gather-master-design`의 최신 커밋에서 갈라요.
  - P1: `claude/gather-master-p1`. P0의 마지막 커밋에서 갈라요.
- 각 칸은 커밋까지만 해요. push·병합은 메인 칸이 대니님 승인을 받아 해요.
- 금지:
  - threejs-* 스킬의 유료 생성(Tripo·Gemini·ElevenLabs)과 키 확인 스크립트(`probe_asset_credentials.sh` 등)는 쓰지 않아요.
  - 하위 에이전트를 띄우지 않아요.
  - 새 npm 패키지는 설치하지 않아요(`npm ci`만 해요).
  - 맨 `git stash`와 `rm`은 쓰지 않아요.
- `src/sim/`은 `three`·DOM을 import하지 않아요. `node --test`로 바로 돌아야 해요.
- 모든 무작위는 `GameState.rng`(mulberry32)를 거쳐요. 시드가 같으면 결과도 같아야 해요.
- 화면 문구는 자연스러운 구어체로 써요. '합니다'체는 쓰지 않아요.

### 모양 변경 절차

`types.ts`는 칸 사이의 약속이에요.
- **선택 필드 추가는 해도 돼요.** 보고에 적어 주세요.
- **이름 바꾸기·삭제·의미 변경은 하지 않아요.** 꼭 필요하면 멈추고 메인 칸에 물어요.
- `data.ts`의 수치는 봇 결과를 보고 바꿔도 돼요. 이때 DESIGN.md의 같은 표도 같이 고쳐요.

## 1. 설계 3문서 (gameplay-systems 형식)

**설계 요약**

| 항목 | 내용 |
|---|---|
| 약속 | 무인도 한 조각에서 캐고, 만들고, 팔 곳을 골라 돈과 레벨이 같이 오르는 맛 |
| 핵심 동사 | 캐기(노드 클릭 한 번이면 고갈될 때까지 자동 휘두르기) |
| 보조 동사 | 만들기, 팔 곳 고르기(상점은 즉시 60% · 판매함은 아침 81%) |
| 5~30초마다 하는 일 | 노드로 걸어가 캐고 가방이 차는 걸 봐요 |
| 1~5분 사이에 바뀌는 것 | 레벨업으로 갈대가 열리고, 판자·밧줄 제작, 돌 도구(빨라짐), 판매함 설치 |
| 압박 | 가방 12칸, 노드 고갈과 리스폰 대기, 상점 하루 한도 20개, 판매함 같은 품목 감쇠 |
| 실패 | 없어요(포근한 장르). 손해는 "싸게 판 것"과 "기다린 시간"뿐이에요 |
| 잘하는 사람 | 리스폰 순서를 외워 동선을 짜고, 판매함에 품목을 섞어 넣어요 |
| 다음 결정 알림 | 고갈 노드는 그루터기·돌무더기로 보이고, 제작 가능 레시피 버튼에 불이 켜져요. 판매 패널에 두 가격을 나란히 보여줘요 |
| 이번에 하지 않는 것 | DESIGN 13-1절 "빼요" 열 전부(장터·농사·동료·의뢰·꾸미기·컷신·소리·무작위 리스폰·WASD) |

**핵심 루프 계약**

> 플레이어는 **노드를 클릭해 캐서** **판자·밧줄·도구를 만들고**, **가방 칸·고갈·상점 한도**가 압박이 돼요. 성공하면 **기술 XP(레벨·새 자원)와 코인**을 얻고, 잘못 고르면 **싸게 팔거나 하룻밤을 기다리는** 값을 치러요.

| 계약 조항 | 코드로 증명하는 곳 |
|---|---|
| 동사가 실제 입력에 묶여요 | e2e: 캔버스의 나무를 실제로 클릭하면 통나무가 늘어요 |
| 목표가 보여요 | HUD: 코인, 기술 4개 레벨·XP 막대, 다음 레벨까지 남은 XP |
| 첫 1분 안에 압박이 생겨요 | 나무 하나가 3개 만에 고갈돼요. 갈대는 Lv2부터 캘 수 있어요 |
| 보상이 상태를 바꿔요 | 돌 도구는 휘두르기를 ×1.3 빠르게 해요. 판매함은 새 판매처를 열어요 |
| 다시 하기가 빨라요 | 리스폰(게임 2~6시간 = 시제품 15~45초), 잠자기 버튼 |

**지도 계획**

`map-p1.ts`

| 자리 | 위치·내용 |
|---|---|
| 시작 | (10,12) 들판 한가운데예요. 작업대(9,11), 텐트(11,10), 판매함 자리(7,12), 상점(12,14)이 모두 3칸 안에 있어요 |
| 첫 결정 | 서쪽 숲의 나무 8그루로 갈까, 동쪽 바위로 갈까 |
| 첫 보상 | 나뭇가지(맨손 1번)예요. 20 XP면 Lv2가 돼요 |
| 랜드마크 | 북동쪽 언덕(층2, 절벽 띠)과 경사로(15,7), 남쪽 모래·물 띠예요 |
| 확장 | 언덕 위 바위 2개는 경사로를 찾아야 닿아요(지형 높낮이 관찰용, DESIGN 1절) |
| 노드 | 나무 8, 바위 6, 나뭇가지 자리 6, 갈대 자리 5 |

## 2. 확정한 규칙 결정 (DESIGN에 없거나 모호했던 것)

| 항목 | 결정 |
|---|---|
| 상태 갱신 방식 | `applyIntent`·`tick`은 상태를 **제자리에서 고치고** 사건 배열을 돌려줘요. 테스트는 매번 `createState`로 새로 만들어요 |
| 시간 단위 | 규칙의 실제 시간은 초, 게임 시계는 `gameMinutes`(1일차 06:00 = 0)예요. 게임 분 = 실제 초 × 1440 ÷ `dayRealSeconds`. dt는 `MAX_STEP`(0.1초)로 잘라요 |
| 아침 | `gameMinutes`가 1440의 배수를 지나면 아침이에요. 한 번에 다음을 처리해요: 판매함 정산 → 상점 오늘 판매 수 비우기 → `'morning'` 노드 되살리기 → `dayStarted` |
| 잠자기 | 하던 일을 멈춰요. `gameMinutes`를 다음 1440 배수로 옮기고(이미 배수 위면 +1440), 리스폰과 아침 처리를 해요. 시제품은 장소 제한이 없어요 |
| 리스폰 | 고갈된 고정 노드는 `gameMinutes ≥ depletedAt + respawn`일 때 `hits`를 다 채워 되살아나요. P1은 화면 안·밖을 가리지 않아요(그 연출은 P2) |
| 노드 수확 | 휘두르기 1번 = `SWING_SECONDS ÷ 속도`예요. 맨손 자원은 속도 1.0이에요. `swings`번 휘두르면 1개를 얻고 XP를 받아요. 그다음 `hitsLeft − 1`. 0이 되면 고갈되고 `idle`로 돌아가요 |
| 화석 드롭 | 돌을 1개 얻을 때마다 채광 Lv6 이상이고 곡괭이가 돌 단계 이상이면 `rng() < 0.02`로 화석 1개를 더 줘요(P1 범위 밖이지만 규칙은 P0에 넣어요) |
| 가방 | 칸당 20개예요. 같은 품목 칸부터 채우고 그다음 빈 칸을 써요. 넣을 자리가 없으면 수확은 멈추고 `bag-full`이에요 |
| 레벨 | 레벨업은 넘친 XP를 이월해요. 한 번에 여러 레벨이 오를 수 있어요. 시제품은 Lv10에서 멈추고 XP는 `totalXp`에만 쌓여요 |
| 제작 | 시작할 때 조건을 검사해요(제작대 거리·레벨·재료·결과 자리). 끝날 때(제작대 `craftSeconds` 뒤) 다시 검사한 뒤 **재료 소모와 산출을 한 번에** 처리해요. 실패하면 아무것도 바뀌지 않아요 |
| 도구 레시피 | 계열과 기술: axe→채집, pickaxe→채광, can→농사. `familySkillLevel`은 그 기술 레벨이에요. 현재 단계 이상의 도구는 다시 못 만들어요(`blocked`) |
| 판매함 설치 | `consign-box`를 만들면 `placeables.consignBoxes + 1`, `boxes`에 빈 함 하나를 더해요. 집 단계의 `boxes` 한도(1단계 1개)를 넘으면 `blocked`예요 |
| 상점 값 | 한 개씩 세요. 오늘 그 품목 판매 수가 20 미만이면 기준가×0.6, 그 이상이면 **기준가×0.3**이에요. 거래 합계는 `Math.floor`해요 |
| 판매함 정산 | 모든 함을 합쳐 품목별로 세요. 앞 10개는 기준가×0.9, 넘는 몫은 ×0.9×0.5예요. 품목 줄 합계에 ×(1−0.1)을 하고 `Math.floor`해요(실효 81% / 40.5%) |
| 판매 XP | 없어요. 판매는 코인만 바꿔요(6절) |
| 거리 | 노드·제작대·상점·판매함 칸 중심과 플레이어 사이가 `REACH_METERS`(2.5m) 이하여야 해요 |
| 이동 | 칸 4방향 BFS예요(400칸이라 A*는 필요 없어요). 지나갈 수 없는 칸: 물, 절벽, 나무·바위 칸, 제작대·상점·판매함·텐트 칸. 나뭇가지·갈대 자리는 지나갈 수 있어요 |
| 층 넘기 | 이웃 칸으로 갈 수 있는 경우는 셋이에요. 층이 같을 때, 높이 차가 1m 이하일 때(층0↔층1), 한쪽이 경사로(층 L)이고 다른 쪽이 층 L이나 L+1일 때 |
| 플레이어 좌표 | 월드 m 단위예요. 칸 (x,z)의 중심은 `((x+0.5)·2, (z+0.5)·2)`예요. 높이는 화면이 칸 층에서 계산해요 |
| 노드 클릭 | 화면은 `approachCell`로 닿을 수 있는 가장 가까운 칸을 찾아요. 그다음 `moveTo{cell, then: gather}`를 보내요. 제작대·상점도 같은 방식이에요(then 없이 패널을 열어요) |
| 저장 | localStorage `gather-master:save`, `SaveFile` 모양이에요. 아침마다, 실제 30초마다, `pagehide` 때 저장해요. 버전이 다르거나 깨졌으면 새 게임으로 시작하고 콘솔 경고 하나만 남겨요 |

저장 파일 예(가방 일부·노드 일부만):

```json
{
  "version": 1,
  "savedAtEpochMs": 1795600000000,
  "state": {
    "version": 1, "seed": 42, "rng": 1938472, "realSeconds": 95.3, "gameMinutes": 760,
    "coins": 18,
    "bag": [{ "item": "log", "qty": 4 }, { "item": "plank", "qty": 1 }, null],
    "skills": {
      "gathering": { "level": 2, "xp": 9, "totalXp": 29 },
      "mining": { "level": 1, "xp": 10, "totalXp": 10 },
      "farming": { "level": 1, "xp": 0, "totalXp": 0 },
      "crafting": { "level": 1, "xp": 8, "totalXp": 8 }
    },
    "tools": { "axe": 0, "pickaxe": 0, "can": 0 },
    "stations": ["workbench"],
    "placeables": { "consignBoxes": 0, "ladder": false },
    "houseStage": 1,
    "seenItems": ["branch", "log", "stone", "plank"],
    "nodes": [{ "id": "tree-01", "hitsLeft": 0, "depletedAt": 610 }, { "id": "rock-01", "hitsLeft": 3, "depletedAt": null }],
    "boxes": [],
    "shopSoldToday": { "plank": 1 },
    "player": { "x": 19, "z": 23, "activity": { "kind": "idle" } },
    "telemetry": {
      "firstGather": 4.1, "firstCraft": 61.0, "firstSale": 70.2, "firstLevelUp": 22.5, "firstTool": null,
      "coinsByChannel": { "shop": 9, "box": 0, "market": 0 },
      "salesByChannel": { "shop": 1, "box": 0, "market": 0 },
      "xpBySkill": { "gathering": 29, "mining": 10, "farming": 0, "crafting": 8 }
    }
  }
}
```

## 3. P0 규칙 코어: 파일별 할 일

함수 시그니처는 그대로 써 주세요. P1 화면과 봇이 이 이름에 맞춰 동시에 작업해요.

```ts
// src/sim/world.ts — 정적 문맥
export interface World { map: MapDef; clock: ClockRule }
export function cellCenter(cell: {x:number; z:number}, cellSize?: number): {x:number; z:number};
export function worldToCell(pos: {x:number; z:number}, cellSize?: number): {x:number; z:number};
export function isPassable(world: World, cell): boolean;
export function canStep(world: World, from, to): boolean;          // 층 넘기 규칙
export function findPath(world: World, from, to): {x,z}[] | null;   // BFS, from 제외·to 포함
export function approachCell(world: World, from, target): {x,z} | null; // target 중심이 REACH 안인 가장 가까운 칸

// src/sim/rng.ts
export function nextRandom(state: GameState): number; // mulberry32, state.rng 갱신, [0,1)

// src/sim/bag.ts — 가방 순수 함수(제자리 수정, 실패 시 변경 없음)
export function countItem(bag: BagSlot[], item: ItemId): number;
export function canAdd(bag: BagSlot[], items: Ingredient[]): boolean;
export function addItems(bag: BagSlot[], items: Ingredient[]): boolean;
export function removeItems(bag: BagSlot[], items: Ingredient[]): boolean;

// src/sim/skills.ts
export function addXp(state: GameState, skill: SkillId, amount: number): SimEvent[];
export function familySkill(family: ToolFamily): SkillId;

// src/sim/state.ts — 진입점
export function createState(world: World, seed: number): GameState;
export function applyIntent(state: GameState, world: World, intent: Intent): SimEvent[];
export function tick(state: GameState, world: World, dtSeconds: number): SimEvent[];
export function visibleRecipes(state: GameState): RecipeDef[];     // 재료 하나라도 seenItems에 있음
export function canCraft(state: GameState, world: World, recipeId: string): RejectReason | null;
export function shopQuote(state: GameState, item: ItemId, qty: number): number;   // 지금 팔면 받을 코인
export function boxQuote(state: GameState): number;                // 오늘 밤 정산 예상

// src/sim/save.ts
export function serialize(state: GameState, nowMs: number): string;
export function deserialize(text: string | null, world: World, seed: number): { state: GameState; warning: string | null };

// src/sim/ladder.ts — 사다리 점검(DESIGN 6절)
export function reachabilityReport(): { unreachable: string[]; cycles: string[] };
```

| 파일 | 할 일 | 완료 기준 |
|---|---|---|
| `src/sim/rules.ts` | 회전 상자 예제예요. P0에서는 건드리지 않아요(`render/scene.ts`가 아직 써요). P1에서 `scene.ts`를 교체할 때 `rules.ts`·`rules.test.ts`를 `git rm`으로 같이 지워요 | P0 동안 기존 테스트 1개가 계속 통과해요 |
| `src/sim/world.ts` | 위 시그니처. 노드·제작대 칸을 막는 집합은 `world.map`에서 한 번 만들어 캐시해요 | 경사로 (15,7)을 거쳐서만 언덕(층2)에 올라가요. 물·절벽 칸으로 가는 길은 null이에요 |
| `src/sim/rng.ts` | mulberry32. `createState`에서 `rng = seed >>> 0`이에요 | 같은 시드면 같은 1000개 수열이에요 |
| `src/sim/bag.ts` | 위 시그니처 | 부분 성공이 없어요(가득 차면 false, 가방은 그대로) |
| `src/sim/skills.ts` | `xpToNext` 사용, 여러 레벨 동시 상승, Lv10 상한, telemetry `xpBySkill`·`firstLevelUp` | 6절 표의 누적 XP(20·81·197·…·2,676)와 같아요 |
| `src/sim/state.ts` | 2절 결정 그대로. `applyIntent`는 거절할 때 `rejected` 사건 하나만 내요. `tick`은 이동 → 활동(휘두르기·제작 타이머) → 시계 → 리스폰 → 아침 순서예요 | 아래 테스트 전부 |
| `src/sim/save.ts` | `SaveFile` 직렬화. 버전이 다르거나 JSON이 깨졌거나 노드 id가 지도에 없으면 새 상태와 warning을 내요 | 왕복(직렬화→역직렬화) 뒤 `deepEqual` |
| `src/sim/ladder.ts` | `RESOURCES`·`RECIPES`·`STATIONS`·`HOUSE_STAGES`·`TOOL_TIERS`·`access`로 의존 그래프를 만들어요. 시작 상태(맨손·나무 도구·작업대)에서 고정점 반복으로 도달 가능 집합을 구해요 | 전부 도달 가능해요. DESIGN 6절 사슬 4개를 각각 단정해요 |
| `tsconfig.json` | `include`에 `"tools"`를 더해요 | `npm run typecheck` 오류 0 |
| `test/node-test.d.ts` | `deepEqual`·`throws`·`notEqual` 선언을 더해요(`@types/node` 설치 금지) | — |

테스트(sonnet-2, `test/*.test.ts`):

| 파일 | 단정 |
|---|---|
| `data.test.ts` | 모든 제작물 기준가 = round(재료합×1.4+단계보너스). 제작 XP = ceil(기준가/2), 도구·설치물은 ceil(재료합/2). 모든 `ItemId`에 `ITEMS` 행이 하나씩 있어요. 레시피 id가 겹치지 않아요 |
| `world.test.ts` | 경사로 경유 길, 물·절벽 차단, 층0↔층1 통과, `approachCell`이 대각선 칸을 고르지 않아요 |
| `bag.test.ts` | 쌓기·빈 칸·가득 참·부분 성공 없음 |
| `gather.test.ts` | 나무: 3번 휘둘러 통나무 1개, 3개 뒤 고갈, 시제품 시계로 실제 60초(=게임 480분 > 240분) 뒤 되살아남. 갈대 Lv1 거절(`need-level`). 통나무 맨손 아님. 돌 도구면 휘두르기 시간 ÷1.3. 멀면 `too-far` |
| `craft.test.ts` | 판자 원자성(재료 부족이면 아무 변화 없음), 3초 뒤 산출, 돌 도끼 조건(제작 Lv2·채집 Lv3), 판매함 2개째 `blocked` |
| `sell.test.ts` | 상점 21번째부터 ×0.3, 아침에 한도 리셋. 판매함 판자 12개 → floor((10×14.4 + 2×7.2)×0.9) = floor(142.56) = **142**. 아침 전에는 코인 불변 |
| `clock.test.ts` | 잠자기 → 다음 06:00, 정산·`dayStarted` 한 번. 06:00 정각에 자면 +1일. 큰 dt는 0.1초로 잘려요 |
| `ladder.test.ts` | `unreachable`·`cycles`가 비어 있어요. 6절 사슬 4개 |
| `save.test.ts` | 왕복 일치, 깨진 JSON·버전 2 → 새 게임 + warning |
| `bot.test.ts` | 아래 봇 기준(시드 3개 평균) |

## 4. P0 경제 봇 `tools/sim.ts`

- 실행: `node tools/sim.ts --table`은 마크다운 표, `--json`은 테스트용이에요. 인자는 `--clock prototype|full`(기본 prototype)과 `--seeds 1,2,3`이에요.
- 규칙 함수만 써요. 걷기도 `moveTo`·`tick`(dt 0.1)으로 실제로 해요. 화면은 없어요.
- 정책은 단순 욕심쟁이예요. 목표마다 "필요한 자원 중 캘 수 있고 가장 가까운(경로 길이) 노드"로 가요.

| 시나리오 | 정책 | 출력 |
|---|---|---|
| S1 첫 도구 | 돌 도구(도끼·곡괭이 중 먼저 되는 것)를 목표로 해요. 제작 Lv2를 위해 판자를 만들고, 팔지 않아요 | 첫 캐기·첫 레벨업·첫 제작·첫 도구 실제 초 |
| S2 급한 돈 | 50코인을 목표로 해요. (a) 상점만 (b) 판매함만(판매함을 먼저 만들고 잠자기 허용) | 50코인 도달 초 |
| S3 15분 수입 | 실제 15분 동안 판자·밧줄을 만들어 팔아요. (a) 상점만 (b) 판매함 섞기(품목당 10개까지) (c) 판매함 몰아넣기(한 품목만) | 15분 뒤 코인, 매개체별 판매 수 |
| S4 XP 속도 | S3(b)와 같은 동안 | 기술별 분당 XP, 15분 뒤 레벨 |

**봇 통과 기준**(P0 완료 기준, 시드 3개 평균):

| 기준 | 값 |
|---|---|
| 첫 캐기 | ≤ 10초 |
| 첫 레벨업 | ≤ 60초 |
| 첫 제작 | ≤ 120초 |
| 첫 도구 | **180~300초**(DESIGN 13-2) |
| 매개체 균형 | S2에서는 상점이 판매함보다 빨라요. S3에서는 (b)가 (a)보다 많아요. (c)는 (b)보다 적어요. 셋 다 맞아야 "어느 하나가 늘 이기지 않음"이에요 |
| 막힘 | 15분 안에 `rejected` 사건이 같은 이유로 50번 넘게 반복되지 않아요(정책 버그 감시) |

- 기준에 못 미치면 `data.ts`의 시작값만 바꿔요. 바꿀 수 있는 값: `NODE_KINDS.hits`·`respawn`, `SWING_SECONDS`, 지도 노드 수. 바꾼 값과 전후 봇 표를 보고서에 붙여요.
- 상점·판매함 비율(0.6·0.9·0.1)과 XP 곡선은 **바꾸지 않아요**. 대니님 확정 영역이에요.

## 5. P1 첫 루프 그레이박스: 파일별 할 일

장면은 규칙 상태를 읽기만 해요. 입력은 `Intent`로만 보내요. 프레임마다 `tick(state, world, dt)` → 사건 처리 → `view.sync(state)` 순서예요.

| 파일 | 할 일 | 완료 기준 |
|---|---|---|
| `src/render/stage.ts` | OrbitControls를 빼요. 3/4 시점 추적 카메라로 바꿔요: 피치 약 50°, 거리 14m, 휠로 8~22m, `Q`/`E`로 45° 회전, 부드럽게 따라가기. 컨텍스트 손실 처리는 그대로 둬요 | 언덕 위에서도 플레이어가 화면 가운데 근처에 있어요 |
| `src/render/terrain.ts` | 칸 400개를 `InstancedMesh` 상자로 그려요. 높이 `LEVEL_HEIGHTS[level]`, 물은 반투명 파랑 −0.3m, 경사로는 기울인 상자, 절벽은 회색 높은 상자예요. 색은 art-style 3-2절 팔레트에서 가져와요(그레이박스라 명도 위주) | draw call ≤ 10 |
| `src/render/nodes.ts` | 나무(원기둥+원뿔), 바위(정이십면체), 나뭇가지(작은 막대), 갈대(가는 원기둥 3개)예요. 고갈되면 그루터기·돌무더기·빈 자리로 바꿔요. 되살아날 때 0.5초 커지는 연출을 넣어요. `swing` 사건에 0.1초 흔들기를 넣어요 | 노드 25개, 상태가 바뀌면 1프레임 안에 반영돼요 |
| `src/render/actors.ts` | 플레이어 캡슐(art-style 사람 비율 1.1m)과 작업대·상점·판매함·텐트 상자예요. 판매함은 `placeables.consignBoxes > 0`일 때만 보여요 | — |
| `src/input.ts` | 포인터를 Raycaster로 찍어요. 땅이면 `moveTo`, 노드면 `approachCell` + `moveTo{then: gather}`, 제작대·상점·판매함·텐트면 다가간 뒤 패널을 열어요. 터치 탭도 같아요. 드래그는 무시해요 | 모바일 크기(390×844)에서 탭으로 같은 동작 |
| `src/ui/hud.ts` + `index.html` | DOM 오버레이예요. 코인 `#hud-coins`, 시계 `#hud-clock`(n일차 HH:MM), 기술 4개 막대 `#hud-skills`, 가방 12칸 `#bag`, 패널 `#panel`, 잠자기 `#btn-sleep`, 디버그 HUD `#debug`(DESIGN 1절 값: 첫 사건 초, 분당 코인·XP, 매개체별 판매 수)가 있어요. 버튼에는 `data-recipe="plank"`·`data-sell="plank"`·`data-deposit="plank"`를 달아요. 판매 패널은 "지금 팔기 n코인 / 판매함 아침 m코인"을 나란히 보여줘요 | 거절 사건은 화면 아래 토스트 한 줄로 보여줘요(예: "갈대는 채집 Lv2부터 캘 수 있어요") |
| `src/main.ts` | `World{map: P1_MAP, clock: CLOCK_PROTOTYPE}`로 상태를 불러오거나 새로 만들어요. 루프를 연결하고 저장 시점(2절)을 걸어요. `?debug=1`이면 `window.__gm`을 열어요 | — |
| `window.__gm`(`?debug=1`만) | `state()`(깊은 복사), `send(intent)`, `advance(seconds)`(dt 0.1로 반복), `grant({items?, xp?, coins?})`, `screenOf(id)`(노드·자리의 화면 픽셀 좌표), `reset(seed)` | 배포본에서 `?debug=1`이 없으면 `__gm`이 없어요 |
| `e2e/loop.spec.ts` | 아래 두 흐름 | 통과 |

e2e 흐름(실제 입력 우선, 준비만 `__gm`):
1. `?debug=1&seed=7`.
   - `screenOf('tree-08')` 위치를 실제로 클릭하고, 가방 통나무가 1 이상이 될 때까지 폴링해요(`advance`로 시간 빨리 감기 허용).
   - `grant`로 통나무를 2개 이상 맞춰요.
   - 작업대 클릭 → `[data-recipe=plank]` 클릭 → 판자 +1.
   - 상점 클릭 → `[data-sell=plank]` 클릭 → `#hud-coins` 증가.
2. `grant({items: 판자 4·밧줄 2, xp: {crafting: 20}})`.
   - 판매함 제작 → 판매함이 보여요 → 판자 1개 넣기 → `#btn-sleep` 클릭.
   - `#hud-clock`이 다음 날 06:00이고, 코인이 floor(16×0.9×0.9)=**12** 늘어요.
3. 기존 `smoke.spec.ts`는 그대로 통과해요(콘솔 오류 0).

## 6. 배치와 순서

```
sonnet-1 impl  P0: world·rng·bag·skills·state·save·ladder ─┐ (커밋: claude/gather-master-p0)
sonnet-2 test  P0: 테스트 9개 + tools/sim.ts 봇 ──────────────┤ 시그니처(3절)만 보고 동시에 시작
                                                         ▼
                              메인 칸: 봇 표·테스트 확인 → P0 검수
                                                         ▼
sonnet-1 impl  P1: stage·terrain·nodes·actors·input·hud·main ─┐ (claude/gather-master-p1)
sonnet-2 test  P1: e2e loop.spec + 390×844 스크린샷 ─────────┤
                                                         ▼
           메인 칸: 공통 검증(PLAN 1절) → 대니님 플레이 → DESIGN 1절 RESULT 기록
```

| 칸 | 꺼낼 스킬·참고 | 하지 않는 것 |
|---|---|---|
| sonnet-1 P0 | `threejs-gameplay-systems` SKILL.md "Build" 5~6항(핫패스 할당 줄이기, 시드 RNG) | 스캐폴드 스크립트 `create_threejs_game.py`는 돌리지 않아요(이미 있는 스캐폴드를 덮어써요) |
| sonnet-2 P0 | gamedev-skills `survival-crafting`(사다리 점검) · `rpg`(XP 표) | 기준을 맞추려고 3절 고정값(비율·곡선)을 바꾸기 |
| sonnet-1 P1 | `threejs-gameplay-systems`(입력·카메라), `threejs-game-ui-designer`(HUD 글자 맞춤·안전 영역), 막히면 `threejs-debug-profiler` | 그레이박스를 다듬기(화풍은 P4), 소리 |
| sonnet-2 P1 | `threejs-qa-release`: `references/release-checks.md`, `scripts/inspect-threejs-canvas.mjs`(캔버스 픽셀) | 유료 생성기 3종, 키 확인 스크립트 |

## 7. 완료 기준 요약

| 단계 | 통과 조건 |
|---|---|
| P0 | `npm run typecheck` 오류 0 · `npm test` 전부 통과 · `node tools/sim.ts --table`이 4절 기준을 모두 충족 · `src/sim/`에 `three` import 0 · `git diff --stat`이 `src/sim/`·`test/`·`tools/`·`tsconfig.json`·`data.ts` 수치(바꿨다면 DESIGN 표)만 |
| P1 | P0 조건 유지 · `npm run build` 성공 · `npm run e2e`(smoke + loop) 통과 · 1280×800·390×844 스크린샷 2장과 콘솔 오류 0 · draw call과 fps 한 줄 기록 |

보고 양식(각 칸): `바꾼 것 / 검사 결과(명령과 숫자) / 봇 표 / 커밋 sha / 남은 불확실성`.
