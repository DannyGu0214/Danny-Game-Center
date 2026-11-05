// 메뉴·제조 기준값·카페 이름·손님 표. 규칙은 logic.js, 대사는 story.js에 있다.

export const CAFE_NAMES = [
  { name: '윤슬', mean: '햇빛이나 달빛에 비쳐 반짝이는 잔물결이에요.' },
  { name: '여우볕', mean: '비나 눈이 오는 날 잠깐 났다가 숨어 버리는 볕이에요.' },
  { name: '온새미로', mean: '온새미는 쪼개지 않은 생긴 그대로의 상태를 말해요.' },
  { name: '봄볕 창가', mean: '봄볕이 드는 창가예요.' },
  { name: '소담한 오후', mean: '소담하다는 생김새가 탐스럽다는 말이에요.' },
];
export const CAFE_NAME_MAX = 12;

export const PLACES = {
  office: { name: '오피스빌딩 1층', sub: '식당가 골목 쪽 입구. 점심시간이면 직장인들로 붐벼요.', fun: '빠른 손놀림과 정확한 제조, 경영이 재미인 곳이에요.' },
  home: { name: '주택가 모퉁이 상가 1층', sub: '주말 오전이면 동네 사람들이 느긋하게 들러요.', fun: '단골 입맛과 커피의 특색, 카페 분위기가 재미인 곳이에요.' },
};
export const WEEKDAYS = {
  office: ['월요일', '화요일', '수요일', '목요일', '금요일'],
  home: ['화요일', '수요일', '목요일', '금요일', '토요일'],
};

// 제조 기준값(DESIGN.md 4절). 실제 시간(real)과 게임 시간(game)을 나눠 둔다
export const ESPRESSO = {
  dose: 18, doseOk: 0.5, // g, 초록 칸 ±
  yield: 36, yieldOk: 1.5,
  time: 27.5, timeOk: 2, // 실제 초(25~30초 안에서 가운데)
  gameSec: 8, // 기준 샷이 게임에서 걸리는 초
};
export const REAL_PER_GAME = ESPRESSO.time / ESPRESSO.gameSec;
export const DRIP = {
  dose: 20, doseOk: 0.6,
  bloomWater: 40, bloomOk: 12, bloomReal: 30,
  water: 320, waterOk: 12,
  time: 180, timeOk: 20, // 실제 초(약 3분)
  gameSec: 35,
  bedRadius: 1, // 정규화한 원두 층 반지름
};
export const MILK = {
  start: 6, tempLo: 60, tempHi: 65, burn: 71, // ℃
  foamLo: 0.28, foamHi: 0.44, // 공기 양(0~1)
  heatPerSec: 8, airPerSec: 0.16, // 게임 1초에
};
export const AMERICANO = { water: 180, waterOk: 14, flow: 70 }; // g, g/게임초
export const GRIND = { min: 1, max: 10 }; // 낮을수록 곱다

// 맛 저울: -1 시큼 … 0 좋음 … +1 씀
export const TASTE_GOOD = 0.12;
export const TASTE_OK = 0.42;

export const MENUS = {
  espresso: { name: '에스프레소', price: 3500, steps: ['grind', 'dose', 'tamp', 'extract'] },
  americano: { name: '아메리카노', price: 4000, steps: ['grind', 'dose', 'tamp', 'extract', 'water'] },
  latte: { name: '라떼', price: 4800, steps: ['grind', 'dose', 'tamp', 'extract', 'steam'] },
  drip: { name: '핸드드립', price: 6000, steps: ['grind', 'dose', 'bloom', 'pour'] },
  // 본게임 고유 메뉴(DESIGN 5.2절)
  iced: { name: '아이스 아메리카노', price: 4300, steps: ['grind', 'dose', 'tamp', 'extract', 'water'] },
  coldbrew: { name: '콜드브루', price: 5000, steps: [] }, // 전날 준비한 병을 바로 내준다
  origin: { name: '싱글오리진 드립', price: 7500, steps: ['grind', 'dose', 'bloom', 'pour'] },
};
export const STEP_NAME = { grind: '갈기', dose: '담기', tamp: '다지기', extract: '샷', water: '물', steam: '스팀', bloom: '뜸', pour: '붓기' };

// 날마다 정답 분쇄 칸(1~10). 같은 원두도 날씨에 따라 달라지는 걸 게임으로 만들었다
export const DAILY_GRIND = [
  { espresso: 4.0, drip: 7.0, weather: 'rain', line: '비가 와요' },
  { espresso: 4.6, drip: 7.2, weather: 'cloud', line: '흐려요' },
  { espresso: 3.6, drip: 6.8, weather: 'sun', line: '맑아요' },
  { espresso: 4.2, drip: 7.4, weather: 'rain', line: '비가 와요' },
  { espresso: 3.9, drip: 7.0, weather: 'sun', line: '맑아요' },
];

// 얼굴 그림 파라미터는 art.js의 drawPerson이 쓴다
export const PEOPLE = {
  heroM: { name: '나', skin: '#f0c9a4', hair: '#2b2320', style: 'short', body: '#f2eee6', tie: '#3a4f6a', age: 35 },
  heroF: { name: '나', skin: '#f3cfae', hair: '#33261f', style: 'bob', body: '#f2eee6', age: 35 },
  ownerM: { name: '사장님', skin: '#e3b48e', hair: '#c9c6c0', style: 'oldM', body: '#6d5a48', glasses: true, age: 65, mustache: true },
  ownerF: { name: '사장님', skin: '#ecc19c', hair: '#d6d2cb', style: 'oldF', body: '#7c5a55', glasses: true, age: 65 },
  junior: { name: '지수', skin: '#f1cdae', hair: '#1f1a1b', style: 'mid', body: '#34405a', age: 29, tired: true },
  // 오피스 손님
  kim: { name: '김 대리', skin: '#efc6a2', hair: '#221d1c', style: 'short', body: '#3f4b63', tie: '#8c3b3b', age: 31 },
  choi: { name: '최 팀장', skin: '#e9bd98', hair: '#2d2522', style: 'bob', body: '#2e3346', age: 43 },
  han: { name: '한 주임', skin: '#f2cbaa', hair: '#3a2a22', style: 'mid', body: '#7a8590', age: 27 },
  oh: { name: '오 부장', skin: '#deb08b', hair: '#58524d', style: 'short', body: '#30343d', tie: '#3e6a55', age: 52 },
  // 주택가 손님
  park: { name: '박 선생님', skin: '#e5b692', hair: '#bdb9b2', style: 'oldM', body: '#6f7b64', age: 68, glasses: true },
  mina: { name: '미나 씨', skin: '#f4d2b4', hair: '#4a2f22', style: 'long', body: '#d59a7c', age: 34 },
  jaeho: { name: '재호', skin: '#ecc29d', hair: '#1c1a1a', style: 'mid', body: '#4d6a78', age: 26 },
};

// 5일차 주택가 시험: 단골마다 늘 먹는 메뉴와 좋아하는 맛(저울 위치)
export const REGULARS = {
  park: { menu: 'drip', taste: -0.3, like: '늘 핸드드립, 산뜻하게 시큼한 쪽' },
  mina: { menu: 'latte', taste: 0, like: '늘 라떼, 저울 가운데의 부드러운 맛' },
  jaeho: { menu: 'americano', taste: 0.3, like: '늘 아메리카노, 진하게 쌉쌀한 쪽' },
};

// 5일차 오피스 시험: 점심 러시
export const RUSH = {
  orders: [
    { who: 'kim', menu: 'americano' },
    { who: 'han', menu: 'latte' },
    { who: 'oh', menu: 'americano' },
    { who: 'choi', menu: 'latte' },
    { who: 'kim', menu: 'americano' },
  ],
  patience: 45, // 게임 초: 한 잔을 만드는 동안 손님이 기다려 주는 시간
  passStars: 8, // 5잔 15별 중
  maxLate: 2, // 오래 기다리게 해도 되는 손님 수
};
export const HOME_PASS_STARS = 5; // 3잔 9별 중

// ── 본게임 ───────────────────────────────
export const SEASON_NAME = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
export const DAYS_PER_SEASON = 20;
export const DAY_SEC = 300; // 12시간 = 실시간 5분
export const OPEN_HOUR = 8;
export const HOURS = 12;
export const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
// 날씨 발생 비율(DESIGN 5.6절). 일부러 합을 100으로 맞췄다
export const WEATHER_ODDS = {
  spring: { sun: 40, cloud: 40, rain: 20 },
  summer: { sun: 40, cloud: 40, rain: 10, shower: 10 },
  autumn: { sun: 40, cloud: 40, rain: 20 },
  winter: { sun: 40, cloud: 40, rain: 10, snow: 10 },
};
export const WEATHER_NAME = { sun: '맑아요', cloud: '흐려요', rain: '비가 와요', shower: '소나기가 내려요', snow: '눈이 와요' };
export const WEATHER_MUSIC = { sun: 'sunny', cloud: 'cloudy', rain: 'rainy', shower: 'rainy', snow: 'snowy' };

// 잔마다 원가(원). 월세와 함께 나중에 맞출 값
export const COST = { espresso: 900, americano: 1000, iced: 1100, latte: 1500, drip: 1800, origin: 2600, coldbrew: 1700 };
export const COLDBREW_COST = 1700;
// 서브제품(DESIGN 5.8절): 커피를 산 손님이 일정 확률로 함께 산다
export const SIDE = {
  dessert: { name: '디저트', price: 4500, unitCost: 2000, base: { office: 0.2, home: 0.3 } }, // 외부에서 공급받는다. 남으면 저녁에 버린다
  beans: { name: '원두 200g', price: 16000, base: { office: 0.05, home: 0.11 } }, // 직접 로스팅한다. 며칠 두고 판다
};
// 로스팅: 한 번에 8봉지. 온도 기준은 조사한 범위를 게임 값으로 정리했다(DESIGN 6절)
export const ROAST = { bags: 8, batchCost: 48000, start: 150, crack: 200, lo: 210, hi: 220, max: 245, perSec: 8, lowStock: 4 };
export const START_MONEY = 500000;
export const RENT_PER_SEASON = { office: 800000, home: 500000 }; // 계절(20일)마다 결산
export const PATIENCE = { office: 42, home: 72 }; // 게임 초
export const FAST_TIP_SEC = 16; // 오피스: 이 안에 내면 팁
export const TIP = 500;
export const AUTO_SEC = { espresso: 7, americano: 8, iced: 9 }; // 머신이 알아서 만드는 시간(게임 초)
// 장비(DESIGN 5.7절). 자동화가 성장 보상이다
export const EQUIP = {
  grinder: { name: '자동 도징 그라인더', price: 300000, text: '직접 만들 때 가루 담기가 자동이에요.' },
  machine: { name: '2구 머신', price: 600000, text: '자동 메뉴를 2잔까지 동시에 만들어요.' },
  pitcher: { name: '자동 스팀 피처', price: 250000, text: '라떼도 자동으로 만들어요. 직접 치면 별과 팁이 더 붙어요.' },
};
// 단골: 두 카페 모두 있다. 대화 모드에서 시간이 멈추고, 전부 직접 만든다
export const BIZ_REGULARS = {
  office: {
    kim: { menu: 'americano', taste: 0.15, like: '늘 아메리카노, 약간 진하게' },
    choi: { menu: 'latte', taste: 0, like: '늘 라떼, 부드럽게' },
    oh: { menu: 'drip', taste: -0.15, like: '오후엔 핸드드립, 산뜻하게' },
  },
  home: {
    park: { menu: 'drip', taste: -0.3, like: '늘 핸드드립, 산뜻하게 시큼한 쪽' },
    mina: { menu: 'latte', taste: 0, like: '늘 라떼, 저울 가운데의 부드러운 맛' },
    jaeho: { menu: 'americano', taste: 0.3, like: '늘 아메리카노, 진하게 쌉쌀한 쪽' },
  },
};
