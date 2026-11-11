# Ocean World 3D — P1 규칙 기반 보고서

작성 2026-11-11 · 브랜치 `claude/ocean-world-3d-p1-sim` · 담당 하위 세션: P1 규칙 기반

표기: **[확인]** = 테스트나 봇으로 확인함 · **[추정]** = 확인하지 않은 판단 · **[AW]** = Animal World에서 그대로 · **[바꿈]** = Animal World에서 바꿈 · **[새로]** = 이 게임에서 새로 만듦

## 1. 요약

- 화면 없이 Node에서 도는 규칙 모듈 `sim/`(규칙·공간·이동·저장)을 만들었어요. 생태계를 모르는 코드이고, `createSim(eco)`가 생태계 객체를 받아요.
- 열대 환초 데이터 `eco/atoll/data.js`(생물 8 · 자연물 8 · 인공물 8 · 경제 수치)와 임시 격자 `test/fixtures/atoll-grid.js`(40×40 + 옆면 확장 40×20)를 만들었어요.
- `npm test` **60개 전부 통과** [확인]. 그중 하나는 물 없는 가상의 육지 생태계로 규칙이 도는지 보는 시험이에요 [확인].
- 밸런스 봇 `tools/sim.js`: 활동 플레이 **T8 96~101분**(AW 80~102분 범위 안), 방치 220분(AW 225분) [확인, 임시 격자 기준]. 수치는 조정하지 않았어요.
- `DESIGN.md`에 대니님 결정(모든 수위층, 옆면 확장 영역, 난파선 제외, A안, Q1~Q20 권장값)을 반영하고, 구현 세부·봇 측정값·고친 공급값을 13절에 모았어요.

## 2. 모듈 구성과 공개 함수

```
games/ocean-world-3d/
  sim/util.js        시드 난수(mulberry32), 결과 값, rev 캐시
  sim/space.js       createSpace(eco): 격자·확장 영역·구역·놓기 판정·자리 찾기·걷기/헤엄 판정
  sim/move.js        createMover(eco, space): 생활형별 이동(LIFE 표)
  sim/save.js        SAVE_VERSION, serialize, parseSave
  sim/rules.js       createSim(eco): 아래 공개 함수 묶음. STEP = 1/30, BASE_VERSION = 1
  eco/atoll/data.js  KINDS·LAYERS·ZONES·NEEDS·SIZES·SPECIES·ITEMS·TIERS·ECON·EXT_RULES, makeEco(terrain)
  test/              *.test.js 6개, helpers.js, fixtures/atoll-grid.js
  tools/sim.js       밸런스 봇(run, loadSim)
```

`sim/`의 import는 모두 `./`(서로) 뿐이고 Three.js·DOM·생태계 이름이 코드에 없어요 [확인: `landonly.test.js` 세 번째 시험이 파일을 읽어 검사].

### 2.1 쓰는 법

```js
import { createSim } from './sim/rules.js';
import { makeEco } from './eco/atoll/data.js';
import * as terrain from './eco/atoll/terrain.js';   // 시제품 세션이 만드는 실제 지형(테스트는 test/fixtures/atoll-grid.js)

const G = createSim(makeEco(terrain));
const S = G.deserialize(localStorage.getItem('ow3d')) ?? G.newGame(seed, Date.now());
G.settleOffline(S, Date.now());              // 켤 때: 쉬는 동안 관람 수익(최대 30분치)
// 프레임마다
G.advance(S, dtSec);                         // 1/30초 고정 단계로 진행(남는 시간은 S.acc, 한 번에 최대 5초)
const v = G.view(S);                         // 3절 형태 → 렌더
for (const e of G.drainEvents(S)) { ... }    // 4절 사건
// 5초마다·떠날 때
localStorage.setItem('ow3d', G.serialize(S, Date.now()));
```

### 2.2 공개 함수(`createSim(eco)`가 돌려주는 것)

| 묶음 | 함수 | 돌려주는 것 |
|---|---|---|
| 상태 | `newGame(seed, now)` | 새 상태 S(블록 하나) |
| 진행 | `tick(S)` · `advance(S, sec, maxSec=5)` · `settleOffline(S, now)` · `clock(S)` | 단계 수 / `{sec, gain, capped}` / `{day, phase, sec, name}` |
| 점수 | `stats(S)` · `incomePerMin(S)` · `caps(S)` · `extOpen(S)` | `{dev, H, mult, animal, diversity, decor, supply{land,water}, demand{land,water,both}, ratio[k]{land,water,both}, needMet[sp][k], happy[sp], counts, items, species, animals, caps, next}` |
| 값 | `priceOfAnimal(sp)` · `priceOfItem(id)` · `animalValue(t)` · `itemPoints(t)` · `poolOfSpecies(sp)` · `poolOfItem(id)` | 숫자 / `'land'·'water'·'both'` |
| 생물 | `canAdopt(S, sp, at?, free?)` · `adopt(S, sp, at?)` · `canRelease(S, uid)` · `release(S, uid)` · `freeSessileSpot(S, sp)` | `{ok, why?}` · `{ok, animal}` · `{ok, refund}` · `{x, y}` |
| 물건 | `canPlace(S, id, x, y, layer?)` · `placeItem(S, id, x, y, layer?, rot?)` · `removeItem(S, uid)` · `freeSpot(S, id, {layer, on, ext}?)` | `{ok, why?}` · `{ok, item}` · `{ok, refund}` · `{x, y, layer}` |
| 포착 | `capture(S, uid)` | `{ok, reward, first, sp}` |
| 요청 | `requestsOf(S)` · `requestProgress(S, q)` · `requestDone(S, q)` · `claim(S, uid)` · `swapRequest(S, uid)` | 요청 목록 / `[지금, 목표]` / 불 / `{ok, reward}` |
| 확장 영역 | `visitExt(S)` · `extProgress(S, key)` · `extReady(S)` · `claimExt(S, key)` · `extMaster(S)` · `EXT_GOALS` | 불 / `[지금, 목표]` / 수 / `{ok, reward, master}` |
| 저장 | `serialize(S, now)` · `deserialize(raw)` · `fitTerrain(S)` | 문자열 / S 또는 null / `{moved, refunded}` |
| 화면 | `view(S)` · `drainEvents(S)` | 3절 / 사건 배열 |
| 안쪽 | `space`(createSpace 결과) · `mover`(createMover 결과) · `speciesIds` · `itemIds` · `supplyKeys` · `TIERS` · `MAX_TIER` · `PHASES` | 화면이 칸 판정(놓기 미리보기의 칸 색 등)에 쓸 수 있어요 |

- `why`는 화면에 그대로 보여 줄 한국어 문장이에요(예: "산호 대지·석호 모래에 놓아요", "여기는 물이 얕아서 중층이 없어요", "T8에 열리는 확장 영역이에요").
- 놓기 미리보기용 칸 판정은 `G.space.placeWhy(S, id, x, y, layer)`(null이면 됨)와 `G.space.layerOk[layer][cell]`, `G.space.kind[cell]`로 할 수 있어요.

## 3. 화면에 넘길 상태(확정 형태)

`G.view(S)`가 돌려줘요. 매번 새 객체라 렌더가 고쳐도 규칙에 영향이 없어요.

```js
{
  time, tier, pop,                     // 플레이 초, 티어, 인기점수
  clock: { day, phase, sec, name },    // phase 0~3(아침·낮·저녁·밤), 하루 240초
  ext: { open, rect: { x0, x1, y0, y1 } | null },   // 확장 영역 칸 범위(끝 제외)
  chance: { uid, t } | null,           // 지금 포착할 수 있는 생물과 남은 초
  creatures: [{ uid, sp, x, y, z, face, pitch, st, ph, on }],
  props:     [{ uid, id, x, y, w, h, zone, layer, z, rot }],
}
```

| 칸 | 뜻 |
|---|---|
| 좌표 공통 | 칸 단위. (x, y)는 바닥면(지형 약속과 같은 축), z는 높이(위가 +, 수면 = `SEA_LEVEL` = 0). Three.js 좌표로 바꾸는 것은 렌더 한 곳에서(PLAN 4.3절) |
| creature `x, y` | 몸 가운데(실수). 칸 (cx, cy)의 가운데는 (cx + 0.5, cy + 0.5) |
| creature `z` | 몸 가운데 높이. **땅·바닥에 있는 생물(`on`이 `land`·`bed`)은 칸 바닥 높이(`cellHeight ÷ 3`, 계단 모양)**라서, 렌더는 `heightAt(x, y)`로 다시 얹어도 돼요. 헤엄치는 생물은 물기둥 안의 실제 높이 |
| `face` | 머리 방향(라디안, x-y 평면, 0 = +x, π/2 = +y). 초안의 ±1이 아니에요 |
| `pitch` | 위아래 기울기(라디안, + = 위로). 헤엄칠 때만 0이 아니에요 |
| `st` | `idle`·`move`·`eat`·`drink`·`rest`·`special`(포착 행동)·`breathe`(수면 숨쉬기)·`bask`(뭍에서 볕 쬐기) |
| `ph` | 생물마다 흐르는 초(애니메이션 위상) |
| `on` | 지금 있는 곳: `land`(뭍) · `bed`(물 밑 바닥) · `water`(물기둥) — 거북은 바뀌어요 |
| prop `x, y, w, h` | 왼쪽 위 칸과 크기(칸). 물건은 [x, x+w) × [y, y+h)를 차지해요 |
| `zone` | `land`(육지) · `bed`(해저) · `water`(수중) |
| `layer` | 수중 물건의 층 `top`·`mid`·`low`, 그 밖은 null |
| prop `z` | 수중: 층 띠 가운데(덮는 칸 중 가장 얕은 수심 기준), `float` 물건(부표)은 수면 0 · 땅 물건: 덮는 칸 중 가장 높은 바닥 |
| `rot` | 0~3(90° 단위). 규칙은 쓰지 않는 화면용 값(물건이 모두 정사각형) |

초안(PLAN 4.3절)에서 바뀐 점: 생물에 `pitch`·`on`을 더하고 `face`를 라디안으로, 물건에 `w`·`h`·`z`·`rot`를 더했어요. 고착 생물(말미잘)은 creature로 나오고(`on: 'bed'`), 차지하는 2×2칸은 상태 `S.animals[i].fx, fy`에 있어요.

### 3.1 사건(`drainEvents`)

| type | 칸 | 언제 |
|---|---|---|
| `tier` | `tier` | 티어가 오름(한 번에 여러 개면 여러 개) |
| `ext` | `open` | 확장 영역이 열림(T8) |
| `adopt` / `release` | `uid, sp` (+`refund`) | 들이기·방생 |
| `place` / `remove` | `uid, id` (+`refund`) | 놓기·치우기 |
| `chance` | `uid, sp` | 포착 기회 시작(7초) |
| `capture` | `uid, sp, reward, first` | 포착 성공 |
| `claim` | `uid, reward` | 요청 보상 |
| `extGoal` / `extMaster` | `key` / `reward` | 확장 영역 꾸미기 달성·마스터 |
| `terrain` | `moved, refunded` | 불러올 때 지형이 맞지 않아 물건을 옮기거나 돌려줌 |

## 4. `eco` 객체의 형태

`makeEco(terrain)`이 만들어요. 다른 생태계도 같은 모양이면 규칙이 그대로 돌아요 [확인: 물 없는 12×12 육지 생태계 시험].

```js
{
  id, name,
  terrain: { GRID: {w, h}, EXT: {side, depth} | null, SEA_LEVEL: number | null, MAX_DEPTH, heightAt, kindAt, cellHeight },
  kinds:  { <지형>: { name, walk, place, swim?, out? } },      // 'void'는 out: true
  layers: { top|mid|low: { name, minDepth } },                // 물 없는 생태계는 {}
  zones:  { land|bed|water: { name } },
  needs:  { food|shelter|water: { name, icon, supply: true, act }, herd: { name }, partner: { name } },
  sizes:  { S|M|L|XL: { use, name } },
  species: { <id>: { name, tier, size, life, needs[], speed, roam?, special,
                     layers?, kinds?,            // 다니는 층·지형(생략 = 전부, PLAN 0절)
                     foot?, on?,                 // 고착형: 차지하는 칸, 붙는 지형
                     partner?: { sp, per },      // 공생 필요의 짝
                     home?: { r, h },            // 짝 둘레에서 지냄(가로 r칸, 위로 h칸)
                     breath?: [a, b], bask?: [지형], baskMax? } },  // 수면형
  items:  { <id>: { name, tier, kind: 'nature'|'made', zone, w, h, on[], layers?, walk?, tall?, float?, give: { k: n } } },
  tiers: [발전도 기준 × 8], maxTier, econ: { ...ECON }, phases: [시간대 이름],
  ext: { tier, animals, theme[], residents },   // 확장 영역 규칙(지형에 EXT가 있을 때만 씀)
  place: { maxStep },                           // 땅·해저 물건 자리의 높이 차 허용(1/3칸)
}
```

- 생활형(`life`)은 규칙의 기본 어휘예요: `walker` 육지형 · `crawler` 바닥형 · `sessile` 고착형 · `swimmer` 유영형 · `drifter` 표류형 · `surfacer` 수면형(`sim/move.js` `LIFE`).
- 지형 이름(`kindAt`의 값)은 데이터가 정해요. 규칙은 이름을 모르고 `kinds`의 `walk`·`place`·`swim`만 봐요. 육지·물속은 칸 높이와 수면으로 정해요(높이 < 수면이면 물속).
- 지형 약속에서 규칙이 쓰는 것: `GRID`, `EXT`, `SEA_LEVEL`, `MAX_DEPTH`, `kindAt`, `cellHeight`. `heightAt`은 쓰지 않아요. **가정 [추정, 시제품 세션과 맞춰야 함]**: `kindAt`·`cellHeight`는 확장 영역 칸(`+y`면 y = 40~59)도 같은 좌표로 답하고, 블록 밖은 `'void'`예요. `cellHeight`는 정수(1/3칸)예요.

## 5. Animal World에서 그대로 온 것과 바뀐 것

| 항목 | 구분 | 내용 |
|---|---|---|
| 티어 기준 0·60·150·250·370·520·680·870, 티어 안 내려감 | [AW] | |
| 한도: 종 = 티어, 개체 = 4 × 티어, 확장 영역이 열리면 +12(44) | [AW] 틀 / [바꿈] 여는 것 | AW는 T8 섬, 여기는 옆면 확장 영역 |
| 발전도 = (생물 + 종 × 30 + 꾸밈) × (0.5 + 0.5 × 행복도), 개체 가치 6 + 4(t−1), 물건 점수 4 + 2t, 5마리째·3개째부터 절반 | [AW] | |
| 가격 15·10 × 1.7^(t−1), 5 단위, 환급 50%, 시작 60, 분당 발전도 ÷ 25, 쉬는 동안 최대 30분 | [AW] | |
| 포착 간격 15~35초, 보상 0.5분치(최소 2)·첫 포착 5분치(최소 10) | [AW] | |
| 포착 시간 | [바꿈] | 5초 → 7초(DESIGN Q10, 가안) |
| 필요: 공급 ÷ 소비(최대 1), 무리 = 같은 종 3마리, 크기 소비 1·1·2·3 | [AW] | |
| 공급 묶음(뭍·물속), 수면형은 뭍 먼저 | [새로] | DESIGN 2.2절 공식 그대로. 육지만 있는 생태계에서는 AW와 같은 결과 [확인] |
| 공생 필요·짝이 있어야 들이기·마지막 짝 방생 금지 | [새로] | AW 🌊(물이 있어야 입양)과 같은 방식 |
| 맑은 물 | [바꿈] | AW '물' 칸, 이름만 |
| 요청 6종류, 3장 종류가 모두 다름, 보상 분량, [다른 요청] 60초, 빈 칸 1초마다 채움 | [AW] | |
| '지형 꾸미기' 요청 | [바꿈] | 지형(on) 또는 수중 층(layer) 조건. AW는 '평지'를 뺐는데 여기는 물건의 놓을 수 있는 지형 전부 [바꿈] |
| T8 섬 꾸미기 6항목·마스터 20분치 | [AW] 틀 / [바꿈] 항목 | '섬 언덕 물건 2개' → '서로 다른 구역 물건 2가지', 테마 물건은 임시 |
| 자리 찾기: 권하는 지형 → 본 블록 가운데와 가까운 순, 확장 영역은 뒤에 | [AW] | |
| 땅 걷기 BFS, 필요 채우러 가기(물건 옆 칸), 무리는 같은 종 4칸 안, 배회 | [AW] | 확률 0.38·0.8 등 [AW `decide`] 그대로. AW의 '높은 언덕·길' 선호는 뺌(지형 이름 의존) |
| 3D 헤엄·표류·수면형·고착형 | [새로] | 13.1절(DESIGN) |
| 하루 240초, 시간대 4개 | [AW] | |
| 시드 난수 mulberry32, 고정 단계 1/30초, rev 캐시 | [AW] | AW는 `step(S, dt)` 가변, 여기는 `tick` 고정 + `advance` 누적 [바꿈] |
| 세이브 형식 | [새로] | v1, 기반 버전·생태계 id. AW 세이브와 연결하지 않음(Q19) |
| 지형이 바뀐 세이브 맞추기 | [AW] | `fitTerrain` 방식 |
| 상태 하나 = 블록 하나(지역 여러 개를 한 상태에 넣지 않음) | [바꿈] | AW는 4지역을 한 상태에. 여기는 MVP가 한 생태계라 블록마다 상태 하나. 선반을 만들 때 상태를 여러 개 두면 '지역마다 따로'가 그대로 돼요 [추정] |

**밸런스에 대해**: AW 수치를 그대로 썼다고 AW 밸런스가 검증된 것은 아니에요. 생물 크기 구성·공급값·공생·공급 묶음·수중 층이 달라 봇으로 다시 잰 것이 7절이고, 그것도 임시 격자 기준이에요.

## 6. 데이터(열대 환초)

- 생물 8종·자연물 8종·인공물 8종은 DESIGN 3.2~3.4절 그대로예요(이름·티어·크기·필요·놓는 구역). 공급값 2개만 [P1 수정](9.1절).
- PLAN 0절 결정에 따라: 모든 종이 다니는 층 기본값 전부(`layers` 없음), 문어는 유영형(초안은 바닥형), 해삼만 바닥형.
- 속도·다니는 반경은 DESIGN 12.2절 가안(해삼 0.4 · 소라게 1.5 · 흰동가리 1.2 · 문어 1.0 · 해파리 0.3 · 거북 1.5 · 쥐가오리 1.8칸/초).
- 놓을 수 있는 지형(`on`)은 DESIGN 2.1절 지형표에서 정했어요 [새로, 가안]: 산호·해초·대왕조개·말미잘은 얕은 곳(산호 대지·석호), 덩어리산호·청소 정거장은 틸라, 관측 돔은 칸두·틸라, 수중 물건은 물이 있는 모든 지형(바깥 비탈 제외). 수중 물건의 층: 부표 표층만, 묘목 줄 중층·저층, 플랑크톤 등 중층·저층·표층(앞이 권하는 층).

## 7. 테스트 결과

`npm test`(Node 22.23.4): **60개 통과, 0개 실패** [확인]. 세 번 연달아 돌려 모두 통과(시드 고정이라 흔들림 없음).

| 파일 | 개수 | 다루는 것 |
|---|---|---|
| `rules.test.js` | 25 | 시작 상태, 가격, 해금, 종·개체 한도, T8 44마리, 공짜 없음, 발전도 공식, 절반 규칙, 크기 소비·무리, **공급 묶음(뭍·물속·수면형 공식 수치 검산)**, **공생**, 방생 환급, 여러 티어 한 번에 + 확장 사건, 관람 수익·고정 단계·쉬는 동안 상한, 포착(7초), 요청 받기·종류·입양 4마리·구역/층 꾸미기·시간대 사진·바꾸기, 시간대, 같은 시드 같은 결과, 사건 목록 |
| `space.test.js` | 11 | 지형 약속(40×60, 확장 범위·옆면 방향), 임시 격자 면적 비율, 수중 층 수심 조건, 세 구역 놓기, 권하는 지형 순, 위아래 겹치기·키 큰 물건 저층, 칸 밖·겹침·환급, 확장 영역 잠금·해제, 고착 생물 자리, 물건 16종 자리·생물 8종 지낼 곳 |
| `move.test.js` | 10 | 육지형·바닥형·고착형 다니는 곳, 헤엄 생물이 물기둥 안(120초 매 단계), **모든 수위층**(4종이 세 층 모두), 해삼 해저 전체 연결, 거북 숨쉬기·볕 쬐기·뭍 2마리 이하, 흰동가리 집, 해파리 표류, **확장 영역 잠금 동안 아무도 안 들어감·열리면 들어감**, 물건 놓으면 비켜 서기, 3D 길찾기 우회, 화면 상태 형태 |
| `save.test.js` | 5 | 저장·불러오기 같은 상태·이어서 같은 결과, 깨진·다른 생태계·버전, 모르는 생물·물건, 지형이 바뀐 세이브, 확장 영역 꾸미기·마스터 |
| `landonly.test.js` | 3 | **물 없는 육지 생태계로 규칙 전체가 돎**, 잘못된 생태계 데이터 거절, `sim/`에 Three.js·DOM·생태계 이름 없음 |
| `data.test.js` | 6 | 티어별 생물·물건 구성, 인공물 구역 수, 난파선 없음, 층 기본값, 생활형, 필요를 그 티어 물건으로 채울 수 있음, 경제 수치 |

## 8. 봇 결과

`node tools/sim.js --table 5`(시드 1~5, 방치는 시드 1, 탭 1.5초 뒤) [확인, 임시 격자]

| 플레이 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---|---|---|---|---|---|---|
| 활동(포착 60%·요청 받음) | 0분 | 6~9 | 19~22 | 33~38 | 51~56 | 67~75 | **96~101** |
| 가끔(포착 20%·요청 받음) | 0 | 8~14 | 26~37 | 42~57 | 68~78 | 93~111 | 132~146 |
| 방치(포착·요청 없음) | 7 | 39 | 65 | 94 | 129 | 168 | 220 |
| AW 초원 활동 [AW DESIGN 9절] | 0 | 2~5 | 7~16 | 24~32 | 42~51 | 62~68 | 84~96 |
| AW 가끔 / 방치 | | | | | | | 121~140 / 225 |

- **비교**: T8은 AW 범위 안이에요(AW는 지형을 넣은 뒤 4지역 활동 80~102분, 요청 개편 뒤 80~98분). **조정하지 않았어요.** [확인]
- T3~T5는 AW보다 3~10분 늦어요. 공급 묶음을 하나로 합친 실험(시드 1~3): T4 14~23분, T8 84~108분 — 당겨지긴 했지만 흩어짐이 커서 원인을 단정하지 못했어요. 소라게 필요를 2개(쉼터·무리)로 줄인 실험: 거의 그대로. [확인: 실험 값 / 추정: 원인]
- 탭 지연 4초(`--table 5 4`): 활동 T8 93~103분, 가끔 138~146분 — 1.5초와 같아요. 봇은 포착률로 성공 여부를 정하므로 7초 포착 시간의 효과는 사람의 포착률로만 나타나요. [확인]
- 240분 끝(시드 1~3, 활동): 발전도 4,347~4,371 · 행복도 100% · 44마리 · 물건 761~765개(해저 268 · 육지 61 · 수중 432~436) · 수입 관람 51~52% · 포착 34~38% · 요청 11~15%(AW 54·38·9%) · 확장 영역 꾸미기 4/6(봇이 따로 노리지 않음). [확인]
- 규칙 비용(원격 CPU): 44마리 + 물건 765개에서 60초분 99ms(단계당 평균 0.055ms, 20초 중 가장 긴 단계 2.8ms), 28마리 + 31개에서 17ms. 봇 240분 한 번은 약 13초. [확인] 노트북에서는 다를 수 있어요 [추정].

## 9. 설계 초안에서 발견한 모순·빈틈

### 9.1 고친 것([P1 수정], DESIGN 3.3·13.3절)

| 빈틈 | 고친 것 | 다른 방법(제안) |
|---|---|---|
| T1 물건 둘(석호 모래밭 먹이 2, 먹이 바구니 먹이 3)이 모두 먹이라 해삼(먹이·쉼터)의 쉼터가 T3까지 0 → 행복도 상한 50% [확인: 데이터 시험] | 석호 모래밭 → 쉼터 2(AW 바닷가 T1 모래사장과 같은 짝) | 먹이 바구니를 은신처류로 바꾸기(초안 메모 "AW 은신 상자 자리"와 맞음) |
| 맑은 물을 주는 물건이 T4(해초밭·묘목 줄)부터라 T3 말미잘(먹이·맑은 물)의 맑은 물이 0 [확인] | 가지산호 군락 쉼터 3 → 쉼터 2·맑은 물 2 | 말미잘 필요를 먹이·쉼터로, 또는 T3 부표(장식)를 공급 물건으로 |

### 9.2 고치지 않고 적어 둔 것

1. **수중 층이 놓을 자리를 크게 늘려요.** 같은 2×2 자리에 해저 1 + 수중 3층이 겹쳐, 봇 240분 물건이 AW의 약 3배예요(8절). 꾸밈 점수가 계속 오르고(발전도 4,350, AW 1,800 안팎), 화면에 그릴 물건도 늘어요. [확인: 봇 / 추정: 화면 부담]
2. **"모든 수위층" 결정과 공생 집**: 흰동가리를 짝 말미잘 둘레(위로 3칸)에 두었어요. 층 제한은 아니지만 위아래 범위를 좁히는 규칙이에요(DESIGN 3.2절 "말미잘 둘레 1~2칸"을 따름).
3. **문어의 생활형**: 초안 3.2절은 바닥형, PLAN 0절 해석은 헤엄치는 생물. PLAN을 따라 유영형으로 했어요. 바닥을 기는 모습은 렌더 연출로 남길 수 있어요.
4. **난파선 제외 → 확장 영역 테마 물건이 비어요.** 임시로 청소 정거장·수중 관측 돔.
5. **초안 6.6절 '구역 꾸미기 2개(예: 육지 1 + 수중 1)'**: 확장 영역에 육지가 없으면(지형 세션 결정) 육지 물건을 놓을 수 없어요. '서로 다른 구역 2가지'로 일반화했어요.
6. **요청 '지형 꾸미기'의 지형 범위**: AW는 흔한 지형(평지)을 뺐는데, 환초는 "흔한 지형"이 따로 없어 놓을 수 있는 지형 전부를 후보로 했어요. 권하는 지형(on 첫째)은 봇이 저절로 채워 쉬운 요청이 돼요. [추정]
7. **수중 층 판정과 물건 높이**: 수중 물건 하나가 수심이 다른 칸들을 덮으면 칸마다 층 띠 높이가 달라요. 규칙은 칸마다 띠로 막고, 화면 높이(`z`)는 가장 얕은 칸 기준 하나로 줘요. 깊이 차가 큰 칸두 가장자리에서는 그림과 판정이 조금 어긋날 수 있어요. [추정]
8. **얕은 곳의 큰 생물**: 산호 대지(수심 1.67칸)에도 쥐가오리(몸 폭 4칸)가 들어가요. 규칙은 몸 크기로 수심을 제한하지 않아요(모든 수위층 결정과 함께 게임성 우선으로 둠). [확인: 규칙 / 추정: 보기에 어색할 수 있음]

## 10. 알려진 문제

1. **임시 격자로만 쟀어요.** 실제 지형(`eco/atoll/terrain.js`)은 이 브랜치에 없어요. 실제 지형으로 `npm test`와 봇을 다시 돌려야 해요(`node tools/sim.js --table 5 --terrain=eco/atoll/terrain.js`). 테스트 일부(`space.test.js`의 칸 수·면적, `move.test.js`의 칸두 좌표)는 임시 격자에 맞춘 값이라 실제 지형에 바로 쓰면 안 돼요.
2. 땅·바닥 생물의 `z`는 칸마다 계단 모양이에요. 렌더가 `heightAt`으로 얹어야 매끄러워요.
3. 생물끼리는 부딪히지 않아요(AW와 같음). 큰 생물이 겹쳐 보일 수 있어요.
4. 헤엄 생물의 몸 크기는 길찾기에 반영하지 않아요(점 하나로 판정). 쥐가오리 날개가 물건·바닥을 뚫고 그려질 수 있어요.
5. 길 위 점 사이는 계획할 때 0.25칸 간격 + 칸 경계로 확인해요. 시험(10개 시드 × 120초, 매 단계)에서는 벗어난 적이 없지만, 매우 드문 경우 칸 모서리를 스칠 가능성은 남아요. [확인: 시험 범위 / 추정: 드문 경우]
6. 봇은 수중 층을 권하는 층부터 채우고, 확장 영역 꾸미기를 따로 노리지 않아요(4/6).
7. AW 봇과 같이 "살 수 있으면 바로 산다"라서 실제 플레이보다 물건이 많아요.

## 11. 정해야 할 것

**메인 세션**

1. 시제품 세션의 `terrain.js`와 맞출 것: `kindAt`·`cellHeight`가 확장 영역 칸까지 답하는지, 블록 밖은 `'void'`인지, 지형 이름 8개(`island·beach·lagoon·reefflat·thila·kandu·slope·dropoff`)와 `void`, `EXT.side`. 맞춰지면 실제 지형으로 테스트·봇을 다시 돌리기.
2. 화면 상태 형태(3절)를 P2 화면 세션에 넘기기. 특히 `face`가 라디안, 땅 생물 `z`는 계단 높이라는 점.
3. 물건 수가 많아지는 문제(9.2절 1)를 성능 목표(PLAN D8)와 함께 볼지.

**대니님**

1. **확장 영역 테마 물건**: 난파선이 빠져 비었어요. 새 물건(수상 데크·맹그로브 덤불 등)을 만들지, 지금 물건(임시: 청소 정거장·수중 관측 돔)으로 할지.
2. **물건 개수 상한**: 수중 층 때문에 놓을 수 있는 물건이 AW의 몇 배예요. 구역별 상한이나 꾸밈 점수 상한을 둘지(성능·밸런스).
3. **고친 공급값 2개**(9.1절)를 그대로 둘지, 다른 방법으로 할지.
4. **흰동가리가 말미잘 둘레에만 있는 것**(위로 3칸)을 "모든 수위층" 결정 안에서 그대로 둘지.
