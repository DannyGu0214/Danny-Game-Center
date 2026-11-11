// 열대 환초(몰디브형) 생태계 데이터. 규칙(sim/)이 읽는 생물·물건·지형 종류·경제 수치.
// 출처: DESIGN.md 3.2~3.4절(생물·물건), AW data.js(경제 수치). 지형 함수는 이 파일에 없고 makeEco(terrain)로 받는다
// (실제 지형은 eco/atoll/terrain.js, 테스트는 test/fixtures/atoll-grid.js).
//
// 표시: [AW] = Animal World에서 그대로 · [가안] = 이 게임에서 새로 정한 값(봇 측정 전) · [P1 수정] = 설계 초안 값을 이 단계에서 고친 것(DESIGN.md·보고서에 사유)

// 지형 종류(terrain.kindAt이 돌려주는 이름). 육지·물속은 높이(수면 위·아래)로 정해지고, 여기서는 이름과 이동·놓기 여부만 정한다.
// walk = 그 칸 바닥(땅 또는 물 밑 바닥)을 걷거나 길 수 있음 · place = 물건을 놓을 수 있음 · swim = 그 칸 물기둥을 헤엄칠 수 있음(물속 칸만 의미)
export const KINDS = {
  island: { name: '섬 안쪽', walk: true, place: true },
  beach: { name: '모래 해변', walk: true, place: true },
  lagoon: { name: '석호 모래', walk: true, place: true },
  reefflat: { name: '산호 대지', walk: true, place: true },
  thila: { name: '틸라', walk: true, place: true },
  kandu: { name: '칸두', walk: true, place: true },
  slope: { name: '비탈', walk: true, place: false },
  dropoff: { name: '바깥 비탈', walk: false, place: false, swim: false },
  void: { name: '블록 밖', out: true },
};

// 수중 층 칸 3개(DESIGN 2.1). minDepth = 그 층에 물건을 놓으려면 필요한 수심(칸). 생물은 층 제한 없이 다닌다(PLAN 0절 결정)
export const LAYERS = {
  top: { name: '표층', minDepth: 0 },
  mid: { name: '중층', minDepth: 2 },
  low: { name: '저층', minDepth: 4 },
};

export const ZONES = { land: { name: '육지' }, bed: { name: '해저' }, water: { name: '수중' } };

// 필요 5칸 [기반]. supply = 물건 공급으로 채움(먹이·쉼터·맑은 물), herd = 같은 종 n마리, partner = 짝 생물(종마다 partner 정의)
export const NEEDS = {
  food: { name: '먹이', icon: '🦐', supply: true, act: 'eat' },
  shelter: { name: '쉼터', icon: '🪨', supply: true, act: 'rest' },
  water: { name: '맑은 물', icon: '💧', supply: true, act: 'drink' }, // AW '물' 칸을 바다에서 이름만 바꿈(Q7)
  herd: { name: '무리', icon: '🐟' },
  partner: { name: '공생', icon: '🤝' },
};

// 크기: 소비량은 [AW] SIZE.use 그대로. 속도는 종마다 따로(species.speed)
export const SIZES = {
  S: { use: 1, name: '작음' },
  M: { use: 1, name: '중간' },
  L: { use: 2, name: '큼' },
  XL: { use: 3, name: '아주 큼' },
};

// 생활형(life): walker 육지형 · crawler 바닥형 · sessile 고착형 · swimmer 유영형 · drifter 표류형 · surfacer 수면형 (sim/move.js)
// speed 칸/초 · roam 다니는 반경(칸) — DESIGN 12.2 [가안]. layers 생략 = 모든 수위층(PLAN 0절). kinds 생략 = 모든 지형
export const SPECIES = {
  seacucumber: { name: '해삼', tier: 1, size: 'S', life: 'crawler', needs: ['food', 'shelter'], speed: 0.4, roam: 6, special: '몸을 쭉 늘였다 동그랗게 오므리기' },
  hermitcrab: { name: '소라게', tier: 2, size: 'S', life: 'walker', needs: ['food', 'shelter', 'herd'], speed: 1.5, roam: 8, special: '여럿이 줄지어 더 큰 소라껍데기로 이사하기' },
  anemone: { name: '말미잘', tier: 3, size: 'M', life: 'sessile', needs: ['food', 'water'], foot: 2, on: ['reefflat', 'lagoon'], special: '촉수를 확 오므렸다 꽃처럼 활짝 피기' },
  clownfish: {
    name: '몰디브흰동가리', tier: 4, size: 'S', life: 'swimmer', needs: ['partner', 'food'], speed: 1.2, roam: 2,
    partner: { sp: 'anemone', per: 2 }, // 말미잘 1개체가 흰동가리 2마리를 받아 준다 [가안]
    home: { r: 2, h: 3 }, // 짝 말미잘 둘레 가로 2칸·위로 3칸 안에서 지낸다 [가안]
    special: '말미잘 촉수 속을 파고들어 몸 비비기',
  },
  octopus: { name: '문어', tier: 5, size: 'M', life: 'swimmer', needs: ['food', 'shelter'], speed: 1.0, roam: 8, special: '몸 색을 바꿔 바위 흉내 내다 먹물 뿜고 쏙' },
  moonjelly: { name: '보름달물해파리', tier: 6, size: 'M', life: 'drifter', needs: ['food', 'herd'], speed: 0.3, special: '빛을 받으며 크게 박동해 위로 떠오르기' },
  greenturtle: {
    name: '바다거북', tier: 7, size: 'L', life: 'surfacer', needs: ['food', 'shelter'], speed: 1.5, roam: 16,
    breath: [30, 60], bask: ['beach'], baskMax: 2, // 30~60초마다 숨 쉬러 수면, 해변에서 볕 쬐기(동시에 최대 2마리) [가안]
    special: '수면으로 고개 내밀어 "푸" 하고 숨 쉬기',
  },
  manta: { name: '쥐가오리', tier: 8, size: 'XL', life: 'swimmer', needs: ['food', 'water'], speed: 1.8, roam: 20, special: '제자리에서 공중제비 돌며 플랑크톤 먹기' },
};

// 물건. kind: nature(자연 지형물)·made(인공물). zone: land 육지 · bed 해저 · water 수중. w×h칸.
// on = 놓을 수 있는 지형(앞일수록 먼저 권함) · layers = 수중 물건이 놓일 수 있는 층(앞이 권하는 층) · walk = 생물이 그 위를 다님
// tall = 키 큰 해저 물건(그 위 칸의 저층을 못 씀) · emerge = 해저에서 수면 위로 솟음(그 위 물기둥의 모든 층을 막음)
// maxDepth = 놓을 수 있는 가장 깊은 수심(칸) · float = 수면에 떠 있음(화면용) · theme = 확장 영역 테마 물건 · give = 공급량 [가안]
const SHALLOW = ['reefflat', 'lagoon'];
const WET = ['lagoon', 'reefflat', 'thila', 'kandu', 'slope'];
export const ITEMS = {
  lagoonsand: { name: '석호 모래밭', tier: 1, kind: 'nature', zone: 'bed', w: 2, h: 2, on: ['lagoon', 'reefflat'], walk: true, give: { shelter: 2 } }, // [P1 수정] 먹이 2 → 쉼터 2
  feedbasket: { name: '먹이 바구니', tier: 1, kind: 'made', zone: 'bed', w: 2, h: 2, on: ['lagoon', 'reefflat', 'thila'], give: { food: 3 } },
  palm: { name: '야자수', tier: 2, kind: 'nature', zone: 'land', w: 2, h: 2, on: ['island', 'beach'], give: { food: 2, shelter: 2 } },
  shellbox: { name: '소라껍데기 상자', tier: 2, kind: 'made', zone: 'land', w: 2, h: 2, on: ['beach', 'island'], give: { shelter: 3 } },
  branchcoral: { name: '가지산호 군락', tier: 3, kind: 'nature', zone: 'bed', w: 2, h: 2, on: SHALLOW, give: { shelter: 2, water: 2 } }, // [P1 수정] 쉼터 3 → 쉼터 2·맑은 물 2
  buoy: { name: '계류 부표', tier: 3, kind: 'made', zone: 'water', w: 2, h: 2, on: WET, layers: ['top'], float: true, give: {} },
  seagrass: { name: '해초밭', tier: 4, kind: 'nature', zone: 'bed', w: 4, h: 4, on: ['lagoon'], walk: true, give: { food: 3, water: 3 } },
  nursery: { name: '산호 묘목 줄', tier: 4, kind: 'made', zone: 'water', w: 2, h: 2, on: WET, layers: ['mid', 'low'], give: { shelter: 2, water: 2 } },
  boulder: { name: '덩어리산호 바위', tier: 5, kind: 'nature', zone: 'bed', w: 4, h: 4, on: ['thila', 'lagoon'], tall: true, give: { shelter: 5 } },
  reefblock: { name: '인공 어초', tier: 5, kind: 'made', zone: 'bed', w: 2, h: 2, on: ['thila', 'lagoon', 'kandu'], give: { shelter: 4 } },
  giantclam: { name: '대왕조개', tier: 6, kind: 'nature', zone: 'bed', w: 2, h: 2, on: SHALLOW, give: { water: 4 } },
  planktonlamp: { name: '플랑크톤 등', tier: 6, kind: 'made', zone: 'water', w: 2, h: 2, on: WET, layers: ['mid', 'low', 'top'], give: { food: 6 } },
  beachscrub: { name: '해안 덤불', tier: 7, kind: 'nature', zone: 'land', w: 4, h: 4, on: ['beach', 'island'], give: { shelter: 5 } },
  hut: { name: '그늘 오두막', tier: 7, kind: 'made', zone: 'land', w: 2, h: 2, on: ['island', 'beach'], give: { shelter: 5 } },
  cleaning: { name: '청소 정거장', tier: 8, kind: 'nature', zone: 'bed', w: 4, h: 4, on: ['thila'], give: { water: 8 } },
  dome: { name: '수중 관측 돔', tier: 8, kind: 'made', zone: 'bed', w: 4, h: 4, on: ['kandu', 'thila'], tall: true, give: {} },
  // 확장 영역 테마 물건(대니님 승인 2026-11-11, 수치 모두 [가안]). 육지가 없어도 놓이게 얕은 해저에 뿌리·기둥을 내리고 수면 위로 솟는다
  mangrove: { name: '맹그로브 덤불', tier: 8, kind: 'nature', zone: 'bed', w: 4, h: 4, on: ['lagoon', 'reefflat'], maxDepth: 3, emerge: true, theme: true, give: { shelter: 4, water: 3 } },
  boardwalk: { name: '수상 데크', tier: 8, kind: 'made', zone: 'bed', w: 4, h: 4, on: ['lagoon', 'reefflat'], maxDepth: 3, emerge: true, theme: true, give: { shelter: 3 } },
};

// 티어 기준 발전도 [AW TIERS]
export const TIERS = [0, 60, 150, 250, 370, 520, 680, 870];
export const MAX_TIER = 8;

// 경제 수치. 표시 없는 것은 [AW data.js ECON] 그대로
export const ECON = {
  start: 60, // 시작 인기점수
  incomeDiv: 25, // 분당 관람 수익 = 발전도 ÷ incomeDiv
  diversity: 30, // 종마다 다양성 점수
  speciesFull: 4, // 같은 종은 이 마릿수까지 가치 전부, 넘으면 절반
  itemFull: 2, // 같은 물건은 이 개수까지 점수 전부, 넘으면 절반
  animalBase: 15, itemBase: 10, growth: 1.7, // 가격 = 기본 × growth^(티어−1), 5 단위 반올림
  refund: 0.5, // 방생·치우기 환급
  offlineCapSec: 30 * 60, // 쉬는 동안 쌓이는 관람 수익 상한
  chanceEvery: [15, 35], // 순간 포착 기회 간격(초)
  chanceLen: 7, // [가안] 포착 시간. AW 5초 → 7초(DESIGN 2.3, Q10)
  captureMinutes: 0.5, captureMin: 2, // 포착 보상 = 관람 수익 N분치(최소)
  firstMinutes: 5, firstMin: 10, // 종마다 첫 포착
  requestMin: 10, // 요청 보상 최소
  swapCooldown: 60, // [다른 요청] 대기(초)
  perTier: 4, // 개체 한도 = perTier × 티어(+ 확장 영역)
  herdSize: 3, // 무리 필요: 같은 종 이 마릿수면 1
  animalValueBase: 6, animalValueStep: 4, // 개체 가치 = 6 + 4 × (티어 − 1)
  itemPointsBase: 4, itemPointsStep: 2, // 물건 점수 = 4 + 2 × 티어
  daySec: 240, // 하루 = 플레이 4분(시간대 4개 × 1분)
};
export const PHASES = ['아침', '낮', '저녁', '밤'];

// T8 확장 영역(PLAN 0절: 다리 없이 본 블록 옆면에 붙어 열림). 크기는 지형 쪽 EXT, 여기서는 규칙 값만
// theme = 확장 영역 꾸미기의 테마 물건: 맹그로브 덤불·수상 데크(대니님 승인 2026-11-11, 난파선은 제외)
export const EXT_RULES = { tier: 8, animals: 12, theme: ['mangrove', 'boardwalk'], residents: 6 };

// sim/rules.js의 createSim(eco)에 넘길 생태계 객체를 만든다. terrain = 지형 약속(GRID·EXT·SEA_LEVEL·MAX_DEPTH·heightAt·kindAt·cellHeight)
export function makeEco(terrain) {
  return {
    id: 'atoll', name: '열대 환초 바다',
    terrain,
    kinds: KINDS, layers: LAYERS, zones: ZONES, needs: NEEDS, sizes: SIZES,
    species: SPECIES, items: ITEMS,
    tiers: TIERS, maxTier: MAX_TIER, econ: ECON, phases: PHASES,
    ext: EXT_RULES,
    place: { maxStep: 1 }, // 땅·해저 물건이 덮는 칸의 높이 차 허용(1/3칸 단위)
  };
}
