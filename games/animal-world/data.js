// 게임 데이터: 지역·티어·동물·물건 정의와 점수·가격 상수. 규칙(logic.js)과 그림(art.js)이 함께 읽는다.
// 지역을 추가할 때는 SPECIES·ITEMS에 그 지역 항목을 넣고 REGIONS의 ready를 켠다.

export const GRID = 20; // 지역 땅 20×20칸
export const MAX_TIER = 8; // 비밀 티어(9)는 아직 없다
export const TIERS = [0, 60, 150, 250, 370, 520, 680, 870]; // TIERS[t-1] = 티어 t가 되는 발전도
export const caps = (tier) => ({ species: tier, animals: 4 * tier });

export const NEED_NAME = { food: '먹이', water: '물', shelter: '쉼터', herd: '무리' };
export const NEED_ICON = { food: '🌿', water: '💧', shelter: '🏠', herd: '👥' };

// 크기: 소비량(먹이·물·쉼터를 몇 마리분 쓰는지), 걸음 속도(칸/초), 그림 배율
export const SIZE = {
  S: { use: 1, speed: 1.3, scale: 0.5, name: '작음' },
  M: { use: 1, speed: 1.1, scale: 0.75, name: '중간' },
  L: { use: 2, speed: 0.9, scale: 1.05, name: '큼' },
  XL: { use: 3, speed: 0.65, scale: 1.4, name: '아주 큼' },
};

// 점수·가격·보상 상수(tools/sim.js 봇으로 조정)
export const ECON = {
  start: 60, // 시작 인기점수(첫 입양용)
  incomeDiv: 25, // 분당 관람 수익 = 발전도 합 ÷ incomeDiv
  diversity: 30, // 종마다 다양성 점수
  speciesFull: 4, // 같은 종은 이 마릿수까지 가치 전부, 넘으면 절반
  itemFull: 2, // 같은 물건은 이 개수까지 점수 전부, 넘으면 절반
  animalBase: 15, // T1 동물 가격
  itemBase: 10, // T1 물건 가격
  growth: 1.7, // 티어마다 가격 배율
  refund: 0.5, // 방생·치우기 환급 비율
  offlineCapSec: 4 * 3600, // 자리를 비운 동안 쌓이는 관람 수익 상한
  chanceEvery: [15, 35], // 순간 포착 기회 간격(초)
  chanceLen: 5, // 특수 행동(포착 가능) 시간(초)
  captureMinutes: 0.5, captureMin: 2, // 포착 보상 = 관람 수익 N분치(최소값)
  firstMinutes: 5, firstMin: 10, // 종마다 첫 포착 보상
  requestMin: 10, // 요청 보상 최소값
  swapCooldown: 60, // [다른 요청] 대기 시간(초)
};

export const animalValue = (tier) => 6 + 4 * (tier - 1);
export const itemPoints = (tier) => 4 + 2 * tier;
const round5 = (v) => Math.max(5, Math.round(v / 5) * 5);
export const animalPrice = (tier) => round5(ECON.animalBase * ECON.growth ** (tier - 1));
export const itemPrice = (tier) => round5(ECON.itemBase * ECON.growth ** (tier - 1));

export const REGIONS = [
  { id: 'grassland', name: '초원', icon: '🌾', ready: true, unlock: null },
  { id: 'seaside', name: '바닷가', icon: '🏖️', ready: true, unlock: { region: 'grassland', tier: 4 } },
  { id: 'desert', name: '사막', icon: '🏜️', ready: true, unlock: { region: 'seaside', tier: 4 } },
  { id: 'antarctic', name: '남극', icon: '🐧', ready: true, unlock: { region: 'desert', tier: 4 } },
];

// needs: food·water·shelter는 물건 공급량으로, herd는 같은 종 3마리 이상으로 채운다
// swim: 물에서만 사는 동물(헤엄칠 수 있는 물건의 칸에서만 움직인다. 그 물이 있어야 입양할 수 있다)
export const SPECIES = {
  rabbit: { name: '토끼', region: 'grassland', tier: 1, size: 'S', needs: ['food', 'shelter'], special: '깡충 높이뛰기' },
  meerkat: { name: '미어캣', region: 'grassland', tier: 2, size: 'S', needs: ['shelter', 'herd'], special: '두 발로 서서 보초' },
  gazelle: { name: '가젤', region: 'grassland', tier: 3, size: 'M', needs: ['food', 'water'], special: '네 발로 통통 뛰기' },
  zebra: { name: '얼룩말', region: 'grassland', tier: 4, size: 'L', needs: ['food', 'water', 'herd'], special: '흙바닥 뒹굴기' },
  ostrich: { name: '타조', region: 'grassland', tier: 5, size: 'L', needs: ['food', 'water'], special: '날개 펼쳐 춤' },
  lion: { name: '사자', region: 'grassland', tier: 6, size: 'L', needs: ['shelter', 'water'], special: '하품하며 포효' },
  giraffe: { name: '기린', region: 'grassland', tier: 7, size: 'XL', needs: ['food', 'water'], special: '목 뻗어 잎 먹기' },
  elephant: { name: '코끼리', region: 'grassland', tier: 8, size: 'XL', needs: ['food', 'water', 'herd'], special: '코로 물 뿌리기' },

  crab: { name: '게', region: 'seaside', tier: 1, size: 'S', needs: ['food', 'shelter'], special: '집게 들고 옆걸음 춤' },
  gull: { name: '갈매기', region: 'seaside', tier: 2, size: 'S', needs: ['food', 'herd'], special: '날개 펴고 날아올랐다 내려앉기' },
  turtle: { name: '바다거북', region: 'seaside', tier: 3, size: 'M', needs: ['water', 'shelter'], special: '앞지느러미로 모래 파기' },
  flamingo: { name: '홍학', region: 'seaside', tier: 4, size: 'M', needs: ['water', 'food', 'herd'], special: '한 발로 서서 깃털 고르기' },
  otter: { name: '해달', region: 'seaside', tier: 5, size: 'M', needs: ['water', 'food'], special: '배 위에 조개 올려 깨기', swim: true },
  sealion: { name: '바다사자', region: 'seaside', tier: 6, size: 'L', needs: ['water', 'shelter', 'herd'], special: '앞지느러미로 박수 치기' },
  dolphin: { name: '돌고래', region: 'seaside', tier: 7, size: 'L', needs: ['water', 'food'], special: '물 위로 높이 점프', swim: true },
  walrus: { name: '바다코끼리', region: 'seaside', tier: 8, size: 'XL', needs: ['water', 'shelter', 'herd'], special: '엄니 들고 크게 울기' },

  lizard: { name: '도마뱀', region: 'desert', tier: 1, size: 'S', needs: ['food', 'shelter'], special: '바위 위에서 팔굽혀펴기' },
  jerboa: { name: '날쥐', region: 'desert', tier: 2, size: 'S', needs: ['food', 'shelter'], special: '긴 뒷다리로 높이 뛰기' },
  fennec: { name: '사막여우', region: 'desert', tier: 3, size: 'S', needs: ['food', 'shelter'], special: '큰 귀 쫑긋하고 땅 파기' },
  snake: { name: '방울뱀', region: 'desert', tier: 4, size: 'M', needs: ['shelter', 'food'], special: '똬리 틀고 꼬리 방울 흔들기' },
  coyote: { name: '코요테', region: 'desert', tier: 5, size: 'M', needs: ['food', 'water', 'herd'], special: '하늘 보고 울부짖기' },
  vulture: { name: '독수리', region: 'desert', tier: 6, size: 'M', needs: ['shelter', 'food'], special: '날개 활짝 펴고 날아오르기' },
  oryx: { name: '오릭스', region: 'desert', tier: 7, size: 'L', needs: ['food', 'water', 'herd'], special: '긴 뿔 휘두르며 껑충' },
  camel: { name: '낙타', region: 'desert', tier: 8, size: 'XL', needs: ['food', 'water'], special: '무릎 꿇고 앉았다 일어나기' },

  adelie: { name: '아델리펭귄', region: 'antarctic', tier: 1, size: 'S', needs: ['water', 'food', 'herd'], special: '배로 미끄러지기' },
  skua: { name: '도둑갈매기', region: 'antarctic', tier: 2, size: 'S', needs: ['food', 'shelter'], special: '날개 들고 큰 소리로 울기' },
  gentoo: { name: '젠투펭귄', region: 'antarctic', tier: 3, size: 'M', needs: ['water', 'food', 'herd'], special: '조약돌 물어 와 선물하기' },
  weddell: { name: '웨델물범', region: 'antarctic', tier: 4, size: 'L', needs: ['water', 'shelter'], special: '옆으로 뒹굴며 기지개' },
  king: { name: '킹펭귄', region: 'antarctic', tier: 5, size: 'L', needs: ['water', 'food', 'herd'], special: '고개 들고 트럼펫처럼 울기' },
  elephantseal: { name: '남방코끼리물범', region: 'antarctic', tier: 6, size: 'XL', needs: ['water', 'shelter', 'herd'], special: '코 부풀리며 포효' },
  emperor: { name: '황제펭귄', region: 'antarctic', tier: 7, size: 'XL', needs: ['water', 'food', 'herd'], special: '고개 숙여 인사하기' },
  orca: { name: '범고래', region: 'antarctic', tier: 8, size: 'XL', needs: ['water', 'food', 'herd'], special: '물 위로 머리 내밀기', swim: true },
};

// kind: terrain(지형지물)·object(사물). w×h칸, walk = 동물이 그 위를 걸을 수 있음, swim = 물에 사는 동물이 헤엄칠 수 있음, give = 공급량
export const ITEMS = {
  grass: { name: '풀밭', region: 'grassland', tier: 1, kind: 'terrain', w: 1, h: 1, walk: true, give: { food: 2 } },
  hutch: { name: '은신 상자', region: 'grassland', tier: 1, kind: 'object', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  burrow: { name: '흙둔덕 굴', region: 'grassland', tier: 2, kind: 'terrain', w: 1, h: 1, walk: false, give: { shelter: 4 } },
  fence: { name: '나무 울타리', region: 'grassland', tier: 2, kind: 'object', w: 1, h: 1, walk: false, give: {} },
  puddle: { name: '물웅덩이', region: 'grassland', tier: 3, kind: 'terrain', w: 2, h: 2, walk: false, give: { water: 6 } },
  feeder: { name: '먹이통', region: 'grassland', tier: 3, kind: 'object', w: 1, h: 1, walk: false, give: { food: 6 } },
  rocks: { name: '바위 언덕', region: 'grassland', tier: 4, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 5 } },
  trough: { name: '물통', region: 'grassland', tier: 4, kind: 'object', w: 1, h: 1, walk: false, give: { water: 4 } },
  tallgrass: { name: '키 큰 풀숲', region: 'grassland', tier: 5, kind: 'terrain', w: 1, h: 1, walk: true, give: { food: 3 } },
  hay: { name: '건초 더미', region: 'grassland', tier: 5, kind: 'object', w: 1, h: 1, walk: false, give: { food: 8 } },
  acacia: { name: '아카시아 나무', region: 'grassland', tier: 6, kind: 'terrain', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  awning: { name: '그늘막', region: 'grassland', tier: 6, kind: 'object', w: 1, h: 1, walk: false, give: { shelter: 4 } },
  pond: { name: '큰 연못', region: 'grassland', tier: 7, kind: 'terrain', w: 3, h: 3, walk: false, give: { water: 14 } },
  saltlick: { name: '소금 핥기돌', region: 'grassland', tier: 7, kind: 'object', w: 1, h: 1, walk: false, give: { food: 4 } },
  baobab: { name: '바오밥 나무', region: 'grassland', tier: 8, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 6 } },
  tower: { name: '관람 망루', region: 'grassland', tier: 8, kind: 'object', w: 1, h: 1, walk: false, give: {} },

  sand: { name: '모래사장', region: 'seaside', tier: 1, kind: 'terrain', w: 1, h: 1, walk: true, give: { shelter: 2 } },
  shells: { name: '조개 더미', region: 'seaside', tier: 1, kind: 'object', w: 1, h: 1, walk: false, give: { food: 3 } },
  tiderock: { name: '갯바위', region: 'seaside', tier: 2, kind: 'terrain', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  fishbasket: { name: '생선 바구니', region: 'seaside', tier: 2, kind: 'object', w: 1, h: 1, walk: false, give: { food: 5 } },
  tidepool: { name: '얕은 물', region: 'seaside', tier: 3, kind: 'terrain', w: 2, h: 2, walk: false, swim: true, give: { water: 6 } },
  parasol: { name: '파라솔', region: 'seaside', tier: 3, kind: 'object', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  mudflat: { name: '갯벌', region: 'seaside', tier: 4, kind: 'terrain', w: 2, h: 2, walk: true, give: { food: 4, water: 3 } },
  buoy: { name: '부표', region: 'seaside', tier: 4, kind: 'object', w: 1, h: 1, walk: false, give: {} },
  kelp: { name: '다시마 숲', region: 'seaside', tier: 5, kind: 'terrain', w: 2, h: 2, walk: false, swim: true, give: { water: 4, food: 4 } },
  fishtub: { name: '물고기 통', region: 'seaside', tier: 5, kind: 'object', w: 1, h: 1, walk: false, give: { food: 8 } },
  rockyshore: { name: '바위 해안', region: 'seaside', tier: 6, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 6 } },
  beachball: { name: '비치볼', region: 'seaside', tier: 6, kind: 'object', w: 1, h: 1, walk: false, give: {} },
  lagoon: { name: '석호', region: 'seaside', tier: 7, kind: 'terrain', w: 3, h: 3, walk: false, swim: true, give: { water: 14 } },
  fishfeeder: { name: '물고기 먹이대', region: 'seaside', tier: 7, kind: 'object', w: 1, h: 1, walk: false, give: { food: 10 } },
  reef: { name: '산호초', region: 'seaside', tier: 8, kind: 'terrain', w: 2, h: 2, walk: false, swim: true, give: { water: 6, food: 4 } },
  lighthouse: { name: '등대', region: 'seaside', tier: 8, kind: 'object', w: 1, h: 1, walk: false, give: {} },

  rockpile: { name: '바위 더미', region: 'desert', tier: 1, kind: 'terrain', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  fruitbasket: { name: '선인장 열매 바구니', region: 'desert', tier: 1, kind: 'object', w: 1, h: 1, walk: false, give: { food: 3 } },
  sandburrow: { name: '모래굴', region: 'desert', tier: 2, kind: 'terrain', w: 1, h: 1, walk: false, give: { shelter: 4 } },
  drygrass: { name: '마른 풀 다발', region: 'desert', tier: 2, kind: 'object', w: 1, h: 1, walk: false, give: { food: 4 } },
  cactus: { name: '선인장', region: 'desert', tier: 3, kind: 'terrain', w: 1, h: 1, walk: false, give: { water: 2, food: 1 } },
  waterbowl: { name: '물그릇', region: 'desert', tier: 3, kind: 'object', w: 1, h: 1, walk: false, give: { water: 4 } },
  redrock: { name: '붉은 바위', region: 'desert', tier: 4, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 5 } },
  tent: { name: '그늘 천막', region: 'desert', tier: 4, kind: 'object', w: 1, h: 1, walk: false, give: { shelter: 4 } },
  oasis: { name: '오아시스', region: 'desert', tier: 5, kind: 'terrain', w: 2, h: 2, walk: false, give: { water: 8 } },
  foodcrate: { name: '먹이 상자', region: 'desert', tier: 5, kind: 'object', w: 1, h: 1, walk: false, give: { food: 7 } },
  deadtree: { name: '마른 나무', region: 'desert', tier: 6, kind: 'terrain', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  perch: { name: '새 횃대', region: 'desert', tier: 6, kind: 'object', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  bigoasis: { name: '큰 오아시스', region: 'desert', tier: 7, kind: 'terrain', w: 3, h: 3, walk: false, give: { water: 14 } },
  haycart: { name: '건초 수레', region: 'desert', tier: 7, kind: 'object', w: 1, h: 1, walk: false, give: { food: 9 } },
  arch: { name: '사암 아치', region: 'desert', tier: 8, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 6 } },
  caravan: { name: '캐러밴 텐트', region: 'desert', tier: 8, kind: 'object', w: 1, h: 1, walk: false, give: { shelter: 5 } },

  icehole: { name: '얼음구멍', region: 'antarctic', tier: 1, kind: 'terrain', w: 1, h: 1, walk: false, give: { water: 3 } },
  fishbucket: { name: '생선 양동이', region: 'antarctic', tier: 1, kind: 'object', w: 1, h: 1, walk: false, give: { food: 4 } },
  snowdrift: { name: '눈더미', region: 'antarctic', tier: 2, kind: 'terrain', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  pebblenest: { name: '조약돌 둥지', region: 'antarctic', tier: 2, kind: 'object', w: 1, h: 1, walk: false, give: { shelter: 3 } },
  rockshore: { name: '바위 해안', region: 'antarctic', tier: 3, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 5 } },
  fishcrate: { name: '물고기 통', region: 'antarctic', tier: 3, kind: 'object', w: 1, h: 1, walk: false, give: { food: 6 } },
  sealead: { name: '얼음 틈 바다', region: 'antarctic', tier: 4, kind: 'terrain', w: 2, h: 2, walk: false, swim: true, give: { water: 7 } },
  iceslide: { name: '얼음 미끄럼틀', region: 'antarctic', tier: 4, kind: 'object', w: 1, h: 1, walk: false, give: {} },
  glacier: { name: '빙하 바위', region: 'antarctic', tier: 5, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 6 } },
  krill: { name: '크릴 통', region: 'antarctic', tier: 5, kind: 'object', w: 1, h: 1, walk: false, give: { food: 8 } },
  icecave: { name: '얼음 동굴', region: 'antarctic', tier: 6, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 7 } },
  flag: { name: '관측 깃발', region: 'antarctic', tier: 6, kind: 'object', w: 1, h: 1, walk: false, give: {} },
  iceberg: { name: '빙산', region: 'antarctic', tier: 7, kind: 'terrain', w: 2, h: 2, walk: false, give: { shelter: 4 } },
  snowman: { name: '눈사람', region: 'antarctic', tier: 7, kind: 'object', w: 1, h: 1, walk: false, give: {} },
  southsea: { name: '남극해', region: 'antarctic', tier: 8, kind: 'terrain', w: 3, h: 3, walk: false, swim: true, give: { water: 16, food: 4 } },
  station: { name: '연구 기지', region: 'antarctic', tier: 8, kind: 'object', w: 1, h: 1, walk: false, give: {} },
};

export const speciesOf = (region) => Object.keys(SPECIES).filter((k) => SPECIES[k].region === region);
export const itemsOf = (region) => Object.keys(ITEMS).filter((k) => ITEMS[k].region === region);
