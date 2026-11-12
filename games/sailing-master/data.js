// 게임 표. 길이는 m, 속도는 m/s(게임용으로 실제보다 빠르게), 각도는 라디안이다.
const D = Math.PI / 180;

// 3/4 시점: 땅 y를 tiltY로 눌러 그리고 높이 z는 tiltZ만큼 위로 올린다(약 38° 기울임)
export const VIEW = { tiltY: 0.62, tiltZ: 0.785, zoomMin: 2.6, zoomDefault: 8, zoomMax: 14 };

export const BOAT = {
  staminaDrain: 1 / 240, // 초당 체력 감소(4분이면 지침)
  staminaRest: 1 / 30,
  tired: 0.6,          // 지쳤을 때 노 속도 배율
  rowPeriod: 1.7,      // 노 한 번 젓는 시간(초)
  accel: 3.2, coast: 7, // 속도가 목표로 가까워지는 시간 상수(가속, 관성)
  turnLag: 0.55,
  minSteer: 0.34,      // 멈춰 있어도 남는 키 힘(맞바람에 갇혀 영영 못 도는 일을 막는다)
  fullSteerSpd: 3.5,
  rowSteer: 0.8,
  clear: 3.2,          // 배 중심과 물가의 최소 거리
  walk: 2.2,           // 선장 걷는 속도
};

// 상대 바람각(0 = 정면) → 돛 효율. 맞바람 금지 구역 안은 0이다.
export const POLAR = [[0, 0], [40 * D, 0], [46 * D, 0.5], [60 * D, 0.82], [90 * D, 1], [120 * D, 0.97], [150 * D, 0.82], [180 * D, 0.68]];
export const NO_GO = 40 * D;
export const SAIL_K = 0.72; // 풍속 × 효율 × 돛 넓이 × 이 값 = 목표 속도
export const SAIL_LEVELS = [0, 0.55, 1]; // 내림 · 줄임(축범) · 전체

export const NAV = {
  tackAngle: 50 * D, // 태킹 때 바람에 붙는 각
  lay: 32 * D,       // 목적지가 반대쪽으로 이만큼 넘어가면 태킹
  minTack: 7,        // 태킹 사이 최소 시간(초)
  look: 26,          // 물가를 미리 보는 거리
  arrive: 14, waypoint: 16, dock: 18,
};

// 달력: 하루 = 항해 3분, 계절 = 7일. 항구에 있는 동안은 흐르지 않는다
export const CAL = { day: 180, seasonDays: 7 };
// 계절별 날씨 확률은 아래 WX 표에 있어요(S5)
export const SEASONS = [
  { id: 'spring', name: '봄', icon: '🌱' },
  { id: 'summer', name: '여름', icon: '☀️' },
  { id: 'autumn', name: '가을', icon: '🍂' },
  { id: 'winter', name: '겨울', icon: '❄️' },
];
export const WEATHER = {
  gustLen: 40, gustWarn: 25,
  heelSafe: 0.38,        // 이 기울기를 넘으면 선체가 상해요
  heelHurt: 21,          // 넘은 만큼 초당 내구도 피해
  heatVigor: 1 / 300,    // 무더위에 그늘이 없을 때 초당 기력 감소
  hungerVigor: 1 / 80,   // 식량이 없을 때 초당 기력 감소
  restVigor: 1 / 120,
  droughtDepth: 0.55,    // 가뭄 때 여울 수심 배율
  hitHurt: 0.48,         // 물가 충돌: 속도 × 이 값만큼 내구도가 깎인다
  shoalHurt: 1.44,       // 여울에 걸린 채 움직일 때 초당 내구도 피해
  swellHurt: 6,          // 너울이 내항성을 넘은 1m마다 초당 내구도 피해(앞바다부터, S5에서 자리만)
};
// S5 날씨 종류(2026-11-12). 날마다 종류별로 시드로 한 번 굴려 정해 둬요(예보가 그대로 맞아요). 수역은 REGIONS의 weather 목록으로 골라요.
// when: event 하루 중 한때(하루의 at~at+span 사이에 시작해 len초, warn초 전부터 예고) · dawn 하루 시작부터 len초(새벽) · day 하루 내내 · cal 달력으로 정해진 날(days)
// chance: 계절별로 그날 올 확률. fc: 며칠 앞까지 예보에 보이나(없으면 예보 끝까지). sev: 심한 정도(1 조심 · 2 위험 · 3 아주 위험). rough: 돛을 줄일 바람(폭풍 편성·폭풍 곡)
// salt: 시드에 더하는 수(돌풍·무더위는 S5 전과 같은 값이라 같은 날에 와요). calmFirst: 첫날(처음 나루를 나서는 날)엔 오지 않아요
// fx 효과: wind 풍속 배율(gust·storm은 수역의 gustK·stormK) · rain 비(그늘막 없으면 식량이 젖어요) · spray 물보라(방수 격벽이 막아요, 앞바다부터)
//   swell 너울 높이 m(앞바다부터, 지금은 0) · strain 돛을 다 펴고 있으면 1초에 쌓이는 찢어짐(1이면 찢어져요) · fog 안개 짙기(0~1) · sight 보는 거리 배율
//   flow 물살 배율 · depth 여울 수심 배율 · flot 표류물 한도 배율 · heat 무더위(그늘막 없으면 기력이 빠져요)
export const WX = {
  storm: { name: '폭풍', icon: '⛈', sev: 3, calmFirst: true, rough: true, when: 'event', chance: { summer: 0.12, autumn: 0.14 }, at: 0.3, span: 0.45, len: 75, warn: 50, salt: 41.3, fx: { wind: 'storm', rain: 1, strain: 1 / 12, sight: 0.7 } },
  gust: { name: '돌풍', icon: '💨', sev: 2, rough: true, when: 'event', chance: { spring: 0.45, summer: 0.25, autumn: 0.55, winter: 0.35 }, at: 0.12, span: 0.76, len: 40, warn: 25, salt: 3.1, salt2: 7.7, fx: { wind: 'gust', strain: 1 / 30 } },
  squall: { name: '소나기', icon: '🌧', sev: 1, calmFirst: true, when: 'event', chance: { spring: 0.3, summer: 0.35, autumn: 0.2, winter: 0.1 }, at: 0.15, span: 0.7, len: 55, warn: 25, salt: 23.9, fx: { wind: 1.15, rain: 1, sight: 0.85 } },
  fog: { name: '짙은 안개', short: '안개', icon: '🌫', sev: 1, calmFirst: true, when: 'dawn', chance: { spring: 0.5, summer: 0.05, autumn: 0.25, winter: 0.3 }, len: 75, fc: 1, salt: 31.7, fx: { fog: 1, wind: 0.6 } },
  heat: { name: '무더위', icon: '🥵', sev: 1, when: 'day', chance: { summer: 0.6 }, salt: 11.3, fx: { heat: 1 } },
  flood: { name: '홍수', icon: '🌊', sev: 1, when: 'cal', days: { spring: [0, 1, 2, 3] }, fx: { flow: 1.6, depth: 1.5, flot: 1.4 } },
  drought: { name: '가뭄', icon: '🏜', sev: 1, when: 'cal', days: { summer: [3, 4, 5, 6], autumn: [0, 1, 2] }, fx: { depth: WEATHER.droughtDepth } },
};
export const WX_ORDER = Object.keys(WX); // 심한 것부터(같은 날 여럿이면 앞의 것이 이름이 돼요)
// 돛 찢어짐과 수선. tornMax: 찢어진 돛으로 펼 수 있는 넓이(줄임 0.55보다 작아요). cloth: 꿰매는 데 드는 마포(없으면 범포 1장). coin: 항구 돛장이 값(돛 넓이 1당)
// crewTime·capTime: 바다에서 갑판원·선장이 꿰매는 데 걸리는 초. spare: 출항할 때 창고에서 화물칸으로 알아서 싣는 수선용 마포
export const SAILCLOTH = { tornMax: 0.45, warnAt: 0.5, relax: 1 / 20, cloth: 2, coin: 10, crewTime: 20, capTime: 30, spare: 2 };
// 젖은 식량: 비를 soak초 맞으면 젖어요. 빵은 bread일, 물고기는 ffish일 일찍 상하고, 건어는 dfish일 뒤에 상해요
export const WET = { soak: 25, bread: 2, ffish: 1, dfish: 3 };

// 선체(배 평면 격자는 cols × rows, 칸 한 변 cell m. x0: 0행 앞쪽 끝의 배 좌표). id는 등급과 별을 함께 나타낸다: sloop = 슬루프 ★1, sloop2 = ★2
// hp: 내구도(피해는 절대값으로 들어온다), yard: 필요한 조선소 등급, speed: 항해 속도 배율(노·돛 모두. 뗏목 2배, 이후 배는 이전 값의 1.5배)
const raft = { id: 'raft', kind: 'raft', star: 1, grade: 1, name: '뗏목', len: 4.6, beam: 3.1, deck: 0.34, cols: 3, rows: 4, cell: 1, x0: 2, drag: 0.55, row: 3.8, turn: 0.8, stability: 1.4, buoy: 26, draft: 0.2, crew: 0, foodBase: 4, holdBase: 14, helmX: -1.45, hp: 40, yard: 1, speed: 2, price: {} };
const rowboat = { id: 'rowboat', kind: 'rowboat', star: 1, grade: 2, name: '나룻배', len: 6.4, beam: 2.1, deck: 0.5, cols: 2, rows: 6, cell: 0.8, x0: 2.4, drag: 0.9, row: 4.6, turn: 0.82, stability: 0.8, buoy: 30, draft: 0.3, crew: 1, foodBase: 5, holdBase: 18, helmX: -2.65, hp: 70, yard: 1, speed: 1.5, price: { wood: 40, hemp: 6, coin: 15 } };
const sloop = { id: 'sloop', kind: 'sloop', star: 1, grade: 3, name: '슬루프', len: 9, beam: 3, deck: 1, cols: 3, rows: 7, cell: 0.72, x0: 3.1, drag: 1, row: 4, turn: 0.62, stability: 1, buoy: 70, draft: 0.68, crew: 2, foodBase: 6, holdBase: 24, helmX: -3.1, cockpit: [-3.95, -2.2], hp: 120, yard: 3, speed: 1.5, blueprint: 'sloop', price: { oak: 90, wood: 50, canvas: 40, cloth: 20, nail: 20, coin: 110 } };
// ★2 선체 연장: 길이·칸·부력이 늘고 회전은 조금 느려진다. rowOff: 놓인 모듈을 뒤로 미는 행 수
const star2 = (b, over) => ({ ...b, id: `${b.kind}2`, star: 2, turn: b.turn * 0.93, blueprint: undefined, ...over });
// ★3 보강: 내구·복원력이 늘고 등급 고유 개조가 붙는다
const star3 = (b, over) => ({ ...b, id: `${b.kind}3`, star: 3, hp: Math.round(b.hp * 1.3), stability: b.stability * 1.15, rowOff: 0, ...over });
const raft2 = star2(raft, { len: 5.6, rows: 5, x0: 2.5, buoy: 32, helmX: -1.95, price: { wood: 12 } });
const rowboat2 = star2(rowboat, { len: 7.6, beam: 2.3, x0: 2.45, buoy: 45, helmX: -3.2, price: { wood: 40, cloth: 15, hemp: 8, coin: 20 } });
const sloop2 = star2(sloop, { len: 11, rows: 10, x0: 3.8, rowOff: 1, buoy: 107, crew: 3, helmX: -4.2, cockpit: [-4.95, -3.45], price: { oak: 60, canvas: 35, nail: 16, coin: 80 } });
export const HULLS = {
  raft, raft2,
  raft3: star3(raft2, { row: raft2.row * 1.15, price: { wood: 18, cloth: 4 }, perk: '노걸이 보강', perkDesc: '노 속도 +15%' }),
  rowboat, rowboat2,
  rowboat3: star3(rowboat2, { pointing: 4 * D, leeK: 0.6, yard: 2, price: { wood: 60, cloth: 30, hemp: 10, nail: 10, coin: 40 }, perk: '센터보드', perkDesc: '맞바람 금지 구역 40° → 36°, 옆으로 덜 밀림' }),
  sloop, sloop2,
  sloop3: star3(sloop2, { winch: true, price: { oak: 60, canvas: 50, tar: 16, nail: 16, coin: 120 }, perk: '돛줄 윈치', perkDesc: '돛 바꾸는 시간 절반, 선장 걷는 거리도 절반' }),
};
export const HULL_ORDER = Object.keys(HULLS);
// 조선소 사다리에 보이는 다섯 등급. 스쿠너와 탐사선은 그 바다가 열릴 때 짓는다
export const HULL_TIERS = [
  { grade: 1, kind: 'raft', name: '뗏목', space: '호수' },
  { grade: 2, kind: 'rowboat', name: '나룻배', space: '강' },
  { grade: 3, kind: 'sloop', name: '슬루프', space: '앞바다' },
  { grade: 4, kind: null, name: '스쿠너', space: '큰 바다' },
  { grade: 5, kind: null, name: '대양 탐사선', space: '대양' },
];
export const STAR_STEPS = { 2: { name: '선체 연장', desc: '배가 길어져! 칸이 늘고 더 빠르지만 조금 둔해진다고' }, 3: { name: '보강', desc: '내구도 +30%, 복원력 +15%' } };

// 모듈. w·h: 차지하는 칸(가로 × 세로), kg: 무게 단위, z: 그림 높이(m). need: 해금 조건
// fam: 8갈래(helm 조타 · sail 돛 · oar 노 · supply 보급 · cargo 화물 · rest 거주 · work 작업 · watch 관측·안전), mk: 등급, seat: 선원 자리(S3에서 씀)
// up: 같은 칸에서 재료만 내고 올리는 다음 Mk(슬루프부터). grade: 이 등급 이상 선체에서만
export const MOD_FAMS = { helm: '조타', sail: '돛', oar: '노', supply: '보급', cargo: '화물', rest: '거주', work: '작업', watch: '관측·안전' };
export const MODULES = {
  oar: { name: '노 자리', icon: '🚣', fam: 'oar', mk: 1, seat: 'oar', w: 1, h: 1, kg: 1, z: 0.1, color: '#8a5b34', cost: { wood: 4 }, desc: '이걸 달아야 노를 젓지! 둘이면 25% 빠르다고', need: {} },
  food: { name: '식량 창고', icon: '🍖', fam: 'supply', mk: 1, w: 1, h: 1, kg: 3, z: 0.5, color: '#b98a52', cost: { wood: 8 }, desc: '식량 +6', need: {}, up: 'food2' },
  food2: { name: '큰 식량 창고', icon: '🍖', fam: 'supply', mk: 2, w: 1, h: 1, kg: 4, z: 0.62, color: '#a97a42', cost: { oak: 6, nail: 3 }, desc: '식량 +12', need: { grade: 3 }, upOnly: true },
  hold: { name: '화물칸', icon: '📦', fam: 'cargo', mk: 1, w: 1, h: 2, kg: 3, z: 0.42, color: '#9b7443', cost: { wood: 12 }, desc: '화물 +20', need: {}, up: 'hold2' },
  hold2: { name: '큰 화물칸', icon: '📦', fam: 'cargo', mk: 2, w: 1, h: 2, kg: 4, z: 0.5, color: '#8a6638', cost: { oak: 10, nail: 4 }, desc: '화물 +34', need: { grade: 3 }, upOnly: true },
  telescope: { name: '망원경', icon: '🔭', fam: 'watch', mk: 1, seat: 'look', w: 1, h: 1, kg: 1, z: 0.9, color: '#c2a14a', cost: { wood: 6, coin: 20 }, desc: '멀리 본다! 내륙 발견지랑 뭍짐승도 찾아내지', need: { blueprint: 'telescope' } },
  mast_s: { name: '작은 돛대', icon: '⛵', fam: 'sail', mk: 1, seat: 'sail', w: 1, h: 1, kg: 3, z: 0.2, color: '#6b4a2e', cost: { wood: 10, cloth: 8, hemp: 3 }, desc: '작은 돛. 바람 타고 가자고!', need: { region: 'lake' }, sail: 0.6, mastH: 7, boom: 2.6 },
  mast_m: { name: '돛대', icon: '⛵', fam: 'sail', mk: 2, seat: 'sail', w: 1, h: 1, kg: 8, z: 0.2, color: '#6b4a2e', cost: { oak: 20, canvas: 22, hemp: 6, coin: 15 }, desc: '큰 돛! 빠르지만 잘 기운다고', need: { blueprint: 'mast_m' }, sail: 1, mastH: 12.6, boom: 4.2 },
  hammock: { name: '해먹', icon: '🛏', fam: 'rest', mk: 1, seat: 'rest', w: 1, h: 1, kg: 1, z: 0.3, color: '#d9c9a0', cost: { wood: 4, cloth: 4 }, desc: '선원 1명 재울 자리', need: {} },
  cabin: { name: '선실', icon: '🏠', fam: 'rest', mk: 2, seat: 'rest', w: 2, h: 2, kg: 5, z: 0.72, color: '#fbf7ee', cost: { wood: 20, oak: 8, nail: 4 }, desc: '선원 1명 잠자리에 쉴 곳까지. 슬루프부터 들어가지', need: { region: 'lake' }, crew: 1 },
  awning: { name: '그늘막', icon: '⛱', fam: 'watch', mk: 1, w: 2, h: 1, kg: 1, z: 1.05, color: '#d8634f', cost: { wood: 6, cloth: 12 }, desc: '푹푹 쪄도 기력이 안 빠져!', need: { region: 'lake' } },
  net: { name: '어망', icon: '🎣', fam: 'work', mk: 1, seat: 'fish', w: 1, h: 1, kg: 1, z: 0.25, color: '#7fa39a', cost: { hemp: 5, coin: 5 }, desc: '가는 길에 신선한 물고기가 걸린다!', need: { region: 'lake' } },
  ballast: { name: '바닥짐', icon: '🪨', fam: 'watch', mk: 1, w: 1, h: 1, kg: 6, z: 0.12, color: '#777d7a', cost: { coin: 8 }, desc: '복원력 +25%, 대신 무겁지', need: { region: 'lake' } },
  barometer: { name: '기압계', icon: '🌡', fam: 'watch', mk: 1, seat: 'weather', w: 1, h: 1, kg: 1, z: 0.8, color: '#c9c3a8', cost: { coin: 25 }, desc: '예보 +2일', need: { blueprint: 'barometer' } },
  // 뒤 공간에서 여는 모듈: 표에만 두고 잠가 둬요(PLAN-M1.5.md 3-3절)
  wheel: { name: '타륜', icon: '☸️', fam: 'helm', mk: 2, seat: 'helm', w: 1, h: 1, kg: 2, z: 0.9, color: '#6b4a2e', cost: {}, desc: '큰 배는 타륜으로 몬다. 스쿠너부터', need: { grade: 4 }, future: true },
  autohelm: { name: '자동 조타', icon: '🧭', fam: 'helm', mk: 3, seat: 'helm', w: 1, h: 1, kg: 2, z: 0.6, color: '#5a6a72', cost: {}, desc: '사람 없이 항로를 지킨다. 대양 탐사선', need: { grade: 5 }, future: true },
  mast_d: { name: '이중 돛대', icon: '⛵', fam: 'sail', mk: 3, seat: 'sail', w: 1, h: 2, kg: 12, z: 0.2, color: '#6b4a2e', cost: {}, desc: '돛대 둘. 스쿠너부터', need: { grade: 4 }, future: true },
  oar2: { name: '큰 노 자리', icon: '🚣', fam: 'oar', mk: 2, seat: 'oar', w: 1, h: 1, kg: 2, z: 0.12, color: '#7a4e2c', cost: {}, desc: '둘이 젓는 큰 노', need: { grade: 4 }, future: true },
  water: { name: '물통', icon: '🛢', fam: 'supply', mk: 1, w: 1, h: 1, kg: 4, z: 0.5, color: '#4a7f95', cost: {}, desc: '식수 4통. 앞바다부터(PLAN-M2.md)', need: { grade: 3, region: 'coast' }, future: true },
  lounge: { name: '휴게실', icon: '🛋', fam: 'rest', mk: 3, seat: 'rest', w: 2, h: 2, kg: 6, z: 0.8, color: '#e8dcc2', cost: {}, desc: '쉬면 사기가 오른다. 스쿠너부터', need: { grade: 4 }, future: true },
  galley: { name: '조리실', icon: '🍲', fam: 'work', mk: 1, seat: 'cook', w: 1, h: 1, kg: 3, z: 0.7, color: '#b56a4a', cost: {}, desc: '같은 식량으로 기력이 더 돈다', need: { grade: 4 }, future: true },
  bench: { name: '수리대', icon: '🔨', fam: 'work', mk: 1, seat: 'carpenter', w: 1, h: 1, kg: 3, z: 0.5, color: '#8a6a44', cost: { oak: 8, nail: 4, wood: 6 }, desc: '목수가 앉으면 화물칸 잡목으로 항해 중에 고친다', need: { grade: 3 } },
  sickbay: { name: '의무실', icon: '⚕', fam: 'work', mk: 1, seat: 'medic', w: 1, h: 1, kg: 2, z: 0.6, color: '#e8e4dc', cost: {}, desc: '무더위·추위에 쓰러지지 않게', need: { grade: 4 }, future: true },
  crowsnest: { name: '망루', icon: '🗼', fam: 'watch', mk: 2, seat: 'look', w: 1, h: 1, kg: 3, z: 1.2, color: '#a88a4a', cost: {}, desc: '망원경 다음. 더 멀리, 안개 속까지', need: { grade: 4 }, future: true },
  station: { name: '측후소', icon: '📡', fam: 'watch', mk: 2, seat: 'weather', w: 1, h: 1, kg: 2, z: 1, color: '#b9b4a0', cost: {}, desc: '기압계 다음. 예보 +4일', need: { grade: 4 }, future: true },
  bulkhead: { name: '방수 격벽', icon: '🧱', fam: 'watch', mk: 1, w: 1, h: 1, kg: 4, z: 0.3, color: '#6f7478', cost: {}, desc: '너울에 덜 상하고, 물보라에 식량이 안 젖는다. 앞바다부터', need: { grade: 3, region: 'coast' }, future: true },
  lifeboat: { name: '구명정', icon: '🛟', fam: 'watch', mk: 1, w: 1, h: 2, kg: 4, z: 0.6, color: '#d8634f', cost: {}, desc: '침몰해도 짐 절반을 건진다', need: { grade: 4 }, future: true },
};
// 선원 역할(S3, 2026-11-08). seat: 앉는 자리 종류(모듈의 seat). grade: 이 등급 배부터 후보로 와요. future: 뒤 공간 역할(표에만)
export const ROLES = {
  rower: { name: '노잡이', icon: '🚣', seat: 'oar', desc: '노는 내가 젓지! 선장은 키만 잡으라고', brief: '노는 내가 젓지! 선장은 키만 잡아', hire: 12, wage: 1, region: 'pond', grade: 2, z: 1 },
  deckhand: { name: '갑판원', icon: '🪢', seat: 'sail', desc: '돛은 내게 맡겨! 선장이 돛대까지 안 뛰어도 되고, 돌풍이면 알아서 줄이지', brief: '돛은 내게 맡겨! 돌풍이면 알아서 줄이지', hire: 15, wage: 1, region: 'pond', grade: 2, z: 1 },
  lookout: { name: '견시', icon: '🔭', seat: 'look', desc: '망원경 자리에서 건질 건 더 멀리서 줍고, 해도도 더 넓게 밝히지', brief: '망원경만 있으면 멀리서도 줍지!', hire: 15, wage: 1, region: 'pond', grade: 2, z: 1 },
  helmsman: { name: '조타수', icon: '☸️', seat: 'helm', desc: '선장이 키를 떠나도 항로는 지키지. 돛·노를 오가도 배가 안 헤맨다고', brief: '선장이 자리를 떠도 항로는 지키지!', hire: 20, wage: 2, region: 'river', grade: 3, z: 1 },
  fisher: { name: '어부', icon: '🎣', seat: 'fish', desc: '어망 자리에서 물고기를 두 배로 낚지', brief: '어망만 주면 저녁은 걱정 마!', hire: 15, wage: 1, region: 'river', grade: 3, z: 1 },
  carpenter: { name: '목수', icon: '🔨', seat: 'carpenter', desc: '수리대 자리에서 화물칸 잡목으로 항해 중에 배를 고치지', brief: '잡목만 실어 주면 바다 위에서 고친다!', hire: 20, wage: 2, region: 'river', grade: 3, z: 1 },
  cook: { name: '요리사', icon: '🍲', seat: 'cook', desc: '식량 효율과 사기', hire: 20, wage: 3, region: 'river', grade: 4, future: true },
  engineer: { name: '기관사', icon: '⚙️', seat: 'engine', desc: '기관·배터리 효율', hire: 30, wage: 4, region: 'river', grade: 4, future: true },
  bosun: { name: '갑판장', icon: '📯', seat: 'sail', desc: '갑판원 효과 증가, 돌풍 대응이 빨라져', hire: 30, wage: 4, region: 'river', grade: 4, future: true },
  medic: { name: '의무원', icon: '⚕', seat: 'medic', desc: '탈진·질병 회복', hire: 30, wage: 4, region: 'river', grade: 4, future: true },
  weather: { name: '기상사', icon: '📡', seat: 'weather', desc: '예보 기간·정확도', hire: 35, wage: 4, region: 'river', grade: 5, future: true },
  mate: { name: '일등 항해사', icon: '🧭', seat: 'bridge', desc: '선장 대리, 다른 선원 지휘', hire: 50, wage: 6, region: 'river', grade: 5, future: true },
};
// 자리 이름(선원 탭 평면도). helm은 모든 배의 고물에 있고, rest는 해먹·선실이에요
export const SEATS = { helm: '조타', oar: '노', sail: '돛', look: '견시', fish: '어망', carpenter: '수리대', rest: '쉼', weather: '기상' };
// 특성: 사람마다 하나
export const TRAITS = {
  diligent: { name: '부지런함', desc: '피로가 30% 덜 쌓여' },
  seasick: { name: '뱃멀미', desc: '돌풍이 불면 피로가 두 배' },
  singer: { name: '노래꾼', desc: '다른 선원 사기가 덜 떨어져' },
  sharp: { name: '눈썰미', desc: '견시 자리에서 보는 거리 +30%' },
  strong: { name: '장사', desc: '노잡이·목수 일이 20% 빨라' },
};
// 숙련: 1~5. 효과 = 기본 × (0.7 + 0.15 × 숙련), 맞지 않는 자리는 50%. 숙련 n→n+1에 필요한 근무 = n × lvDays 일
// 피로: 일하면 tireDays 일에 꽉 차고 쉼 자리에서 restDays 일이면 풀려요. 사기 0.2 아래로 입항하면 떠나요
export const CREW_GROW = { lvDays: 1.2, maxLv: 5, tireDays: 1.5, restDays: 0.4, idleDays: 1.2, wageStep: 0.25, leaveMorale: 0.2 };
export const CREW_NAMES = { 남: ['라파엘', '니콜라스', '루이스', '파블로', '세바스티안', '올리버', '토마스 2세', '후안 3세', '얀', '페드로', '알론소 2세', '빌럼'], 여: ['마리아', '클라라', '이네스', '줄리에타', '페르난다', '브리타', '로사', '비앙카', '솔레다드', '아나벨 2세', '마르타', '엘로이사'] };
// 선원 후보: 항구마다 1~3명. 능력치는 기준값의 ±25% 안에서 정해지고, 며칠 지나면 후보가 바뀐다
export const CREW = { spread: 0.25, baseStat: 100, refreshDays: 3, minCands: 1, maxCands: 3, speedPerSkill: 0.1, rumDrink: 115 }; // rumDrink: 이 주량부터 보수를 럼주 값으로 받겠다고 한다

// 선장 4명. 게임을 시작할 때 고르고, 특성은 판 내내 그대로예요(Zombie Outpost 생존자 고르기와 같은 방식)
export const CAPTAINS = {
  sailor: { name: '항해술', look: '젊은 남자', age: '20대', desc: '항해 속도 +10%', names: ['디에고', '마르코', '티아고 2세', '안드레스'], coat: '#25506f', hair: '#3a2a1c', style: 'short' },
  lucky: { name: '운빨', look: '젊은 여자', age: '20대', desc: '발견물 찾는 거리 +10%', names: ['이사벨', '루시아', '카탈리나', '소피아 2세'], coat: '#2f6b5a', hair: '#5a3a22', style: 'long' },
  trader: { name: '거래술', look: '중년 여자', age: '50대', desc: '판매 수익 +10%', names: ['테레사', '베아트리스', '콘수엘로', '도나 엘레나'], coat: '#7a4a5e', hair: '#8d8680', style: 'perm' },
  crafter: { name: '기능공', look: '중년 남자', age: '50대', desc: '모듈 재료마다 1개 덜 쓰지', names: ['곤살로', '마테우스 2세', '한스', '에밀리오 3세'], coat: '#6b5a3a', hair: '#9a9590', style: 'bald' },
};
// 선장의 출항 이야기: 항해와 상관없이 살던 사람이 공고를 보고 떠나 갈대 나루에 닿기까지. {N은}처럼 쓰면 이름 받침에 맞춘다
const NOTICE = '“선장 모집. 경력 없어도 좋습니다. 배는 뗏목 한 척. 갈 곳은 대양.”';
export const STORIES = {
  sailor: { title: '마지막 편지', pages: [
    { scene: 'ride', text: '{N은} 항구 도시에서 제일 빠른 우편 기수였어요. 골목길은 다 외웠지만, 아무리 말을 달려도 도착하는 곳은 늘 같은 동네였어요. 바다는 부두에서 구경만 했지요.' },
    { scene: 'poleNotice', text: `비 오는 밤, 마지막 편지를 전하고 돌아서는데 가로등 기둥에 종이 한 장이 붙어 있었어요.\n${NOTICE}\n끝이 보이지 않는 길은 처음이었어요. 다음 날 아침 {N은} 우편 가방을 반납했어요.` },
    { scene: 'journeyHorse', text: '어머니께는 ‘조금 멀리 편지 전하러 간다’고만 말씀드렸어요. 말을 달려 한나절, 돌길이 끝나는 곳에 호수가 나타났어요. 갈대 나루에 뗏목 한 척과 노 한 쌍이 기다리고 있었어요. 대양까지 가는 길은 어느 우편 지도에도 없어요.' },
  ] },
  lucky: { title: '찾으러 오지 않는 궤짝', pages: [
    { scene: 'lostFound', text: '{N은} 항구 세관의 유실물 창고를 지켰어요. 뱃사람들이 잃어버린 지팡이와 가방을 이상할 만큼 잘 찾아 줘서 별명이 ‘운빨’이었지요. 정작 자기가 무엇을 찾고 싶은지는 몰랐어요.' },
    { scene: 'oldBox', text: `어느 날, 일 년 넘게 아무도 찾으러 오지 않은 궤짝에서 낡은 해도와 공고문이 나왔어요.\n${NOTICE}\n누가 잃어버린 걸까요. 어쩌면 {N을} 찾아온 건지도 몰라요.` },
    { scene: 'journeyCoach', text: '동료들은 ‘금방 돌아올 거지?’ 하며 웃었어요. {N은} 보관증에 자기 이름을 적고 해도를 챙겼어요. 역마차 종점에서 내려 조금 걸으니 갈대 나루였어요. 저 물 너머에는 아직 아무도 찾지 못한 것들이 있을 거예요.' },
  ] },
  trader: { title: '마지막 장날', pages: [
    { scene: 'market', text: '{N은} 항구 시장에서 서른 해 동안 향신료 가게를 했어요. 손님 얼굴만 봐도 얼마면 살지 알았고, 에누리로 져 본 적이 없었어요. 바다는 향신료 상자에 찍힌 도장으로만 알았지요.' },
    { scene: 'lastDay', text: `부두를 넓힌다며 시장이 헐린다는 통지가 왔어요. 마지막 장날, 텅 빈 골목 벽에서 공고를 봤어요.\n${NOTICE}\n딸이 말했어요. “엄마, 이제 좀 쉬어.” {N이} 대답했어요. “바다 건너엔 내가 아직 못 팔아 본 물건이 있다더라.”` },
    { scene: 'journeyCart', text: '가게를 정리하고 저울과 장부만 챙겨 노새 수레를 얻어 탔어요. 단골들이 싸 준 보따리가 짐칸에서 덜컹거렸어요. 갈대 나루에서 뗏목을 본 {N은} 습관처럼 값부터 깎으려 했어요. 파는 사람은 없었어요. 이제 대양까지 장사하러 가요.' },
  ] },
  crafter: { title: '손주의 질문', pages: [
    { scene: 'clockShop', text: '{N은} 항구 도시의 시계공이었어요. 서른 해 동안 톱니를 깎아 탑시계를 한 치도 안 틀리게 맞췄지요. 공방이 문을 닫던 날 남은 건 공구 가방과 심심한 두 손이었어요.' },
    { scene: 'basinBoat', text: `손주에게 나무 배를 깎아 대야에 띄워 줬더니 손주가 물었어요. “할아버지, 진짜 배는 못 만들어?” 다음 날 대장간 벽에서 공고를 봤어요.\n${NOTICE}\n배는 만들어 본 적 없지만, 못 고칠 기계는 없었어요.` },
    { scene: 'journeyDonkey', text: '아내는 ‘한 달이면 돌아올걸’ 하면서 공구 가방에 빵을 넣어 줬어요. 당나귀를 타고 갈대 나루에 가 보니 뗏목 매듭부터 엉망이었어요. {N은} 씩 웃으며 공구 가방을 열었어요. 고쳐 가면서 대양까지 가 볼 참이에요.' },
  ] },
};


// 자원. 항해 중엔 화물칸에 담고, 입항하면 창고로 옮겨요
// 아이템(S2, 2026-11-08). kind: mat 재료 · trade 교역품 · coin 돈. 재료는 계열(fam)과 등급(tier)이 있고, 고급 재료는 뒤 공간에서 나와요.
// id wood·cloth는 옛 저장의 목재·천을 그대로 잡목·마포로 이어 받으려고 남겨 둔 이름이에요. vol: 화물칸 부피, sell: 항구에서 1개 팔 때 금화
export const ITEMS = {
  wood: { name: '잡목', icon: '🪵', kind: 'mat', fam: 'wood', tier: 1, vol: 1, sell: 0.5 },
  oak: { name: '참나무', icon: '🌳', kind: 'mat', fam: 'wood', tier: 2, vol: 1, sell: 1.5 },
  cloth: { name: '마포', icon: '🧵', kind: 'mat', fam: 'cloth', tier: 1, vol: 1, sell: 1 },
  canvas: { name: '범포', icon: '🏳', kind: 'mat', fam: 'cloth', tier: 2, vol: 1, sell: 2.5 },
  hemp: { name: '삼 밧줄', icon: '🪢', kind: 'mat', fam: 'rope', tier: 1, vol: 1, sell: 1, buy: 3 },
  tar: { name: '타르 밧줄', icon: '➰', kind: 'mat', fam: 'rope', tier: 2, vol: 1, sell: 2.5 },
  nail: { name: '쇠못', icon: '📌', kind: 'mat', fam: 'metal', tier: 1, vol: 1, sell: 1.5, buy: 4 },
  coffee: { name: '커피', icon: '☕', kind: 'trade', vol: 1, price: 8 },
  spice: { name: '향신료', icon: '🌶', kind: 'trade', vol: 1, price: 14 },
  porcelain: { name: '도자기', icon: '🏺', kind: 'trade', vol: 1, price: 22 },
  silk: { name: '비단', icon: '🧶', kind: 'trade', vol: 1, price: 32 },
  painting: { name: '미술품', icon: '🖼', kind: 'trade', vol: 1, price: 60 },
  coin: { name: '금화', icon: '🪙', kind: 'coin', vol: 0 },
};
export const RES = ITEMS; // 예전 이름
export const MAT_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'mat');
export const TRADE_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].kind === 'trade');
// 공방: 같은 계열 낮은 등급 3개 + 금화를 높은 등급 1개로(막힘 방지용이라 비싸요)
export const WORKSHOP = { ratio: 3, fee: 6, pairs: { wood: 'oak', cloth: 'canvas', hemp: 'tar' } };
// 교역: 공간마다 찾는 품목은 1.5배. 같은 공간의 기항지는 값이 같아요
export const TRADE = { demandK: 1.5 };
// 보급품. keep: 며칠 뒤 상하나(없으면 안 상함), vigor: 먹으면 기력이 빨리 돌아옴
export const SUPPLY = {
  bread: { name: '빵', icon: '🍞', price: 1, keep: 5, desc: '싸지만 5일이면 상해' },
  dfish: { name: '건어', icon: '🐟', price: 2, desc: '비싸지만 안 상하지' },
  ffish: { name: '신선한 물고기', icon: '🎣', keep: 2, vigor: 1.6, desc: '어망으로 낚아. 기력이 빨리 돌아와. 이틀이면 상해' },
};
export const HERB = { name: '약초', icon: '🌿', price: 3, cap: 5, vigor: 0.45, at: 0.35, desc: '기력이 바닥나기 전에 알아서 씹어 먹지' };

export const SPECIES = {
  crucian: { name: '붕어', kind: 'fish', region: 'pond', color: '#9c8a55', len: 0.5 },
  minnow: { name: '피라미', kind: 'fish', region: 'pond', color: '#a9c3b8', len: 0.3, school: 5 },
  duck: { name: '오리', kind: 'duck', region: 'pond', color: '#7c5c3a', head: '#2f6b4a' },
  heron: { name: '왜가리', kind: 'wader', region: 'pond', color: '#8d9aa6' },
  frog: { name: '개구리', kind: 'frog', region: 'pond', color: '#6da04a' },
  otter: { name: '수달', kind: 'swimmer', region: 'pond', color: '#6f4f33' },
  carp: { name: '잉어', kind: 'fish', region: 'lake', color: '#c48b3f', len: 0.8 },
  trout: { name: '송어', kind: 'fish', region: 'lake', color: '#88a07f', len: 0.6 },
  catfish: { name: '큰 메기', kind: 'fish', region: 'lake', color: '#4e5346', len: 1.3 },
  swan: { name: '백조', kind: 'duck', region: 'lake', color: '#f4f2ea', head: '#f4f2ea', neck: 1.5, size: 1.5 },
  osprey: { name: '물수리', kind: 'bird', region: 'lake', color: '#6d5a48', wing: 1.5 },
  beaver: { name: '비버', kind: 'swimmer', region: 'lake', color: '#7a5636' },
  deer: { name: '사슴', kind: 'land', region: 'lake', color: '#a97a4a', height: 1.5, antler: true },
  salmon: { name: '연어', kind: 'fish', region: 'river', color: '#c26a59', len: 0.9 },
  lamprey: { name: '칠성장어', kind: 'fish', region: 'river', color: '#5a5d57', len: 0.8, thin: true },
  turtle: { name: '민물거북', kind: 'turtle', region: 'river', color: '#55703f' },
  kingfisher: { name: '물총새', kind: 'bird', region: 'river', color: '#2a86b8', wing: 0.5 },
  bear: { name: '곰', kind: 'land', region: 'river', color: '#5d4530', height: 1.7 },
  ottercub: { name: '수달 가족', kind: 'swimmer', region: 'river', color: '#7f5c3e', group: 3 },
};

// theme: 풍경 테마 이름(themes.js THEMES)
export const REGIONS = {
  pond: {
    id: 'pond', name: '작은 호수', order: 0, grade: 1, theme: 'lake', yard: 1, wind: { from: -70 * D, speed: 6.5, swing: 0.7 }, gustK: 1.35, weather: ['gust', 'squall', 'fog'],
    shape: { kind: 'lake', ax: 96, ay: 150, ph: 0.4 },
    islands: [{ x: 28, y: -42, r: 13, ph: 1.4 }],
    start: 'reed',
    ports: [{ id: 'reed', name: '갈대 나루', x: -8, y: 118 }, { id: 'willow', name: '버들 나루', x: -88, y: -40 }, { id: 'stonePier', name: '돌담 나루', x: 84, y: -60 }],
    gates: [{ id: 'toLake', name: '북쪽 수로', x: 0, y: -135, to: 'lake', entry: 'southGate', req: {} }],
    finds: [
      // 뗏목은 느리니 발견지 보상만으로 나룻배 값을 빨리 모으게 한다(나루 가까이에 먼저 놓음)
      { id: 'logpile', name: '물가의 통나무 더미', x: -56, y: 92, coin: 4, wood: 8, relic: '뗏목꾼의 손도끼', art: 'logpile' },
      { id: 'raftcamp', name: '뗏목꾼의 빈 야영지', x: 50, y: 112, coin: 6, hemp: 3, wood: 7, cloth: 3, relic: '그을린 주전자', art: 'camp' },
      { id: 'stone', name: '이끼 낀 표지석', x: -72, y: 18, coin: 12, wood: 8, relic: '이끼 낀 이정표 조각', art: 'stone' },
      { id: 'hollow', name: '속이 빈 고목', x: 92, y: 40, coin: 10, wood: 14, relic: '다람쥐가 숨긴 금단추', art: 'stump' },
      { id: 'fishtrap', name: '부서진 통발', x: -46, y: -62, coin: 6, hemp: 3, wood: 10, cloth: 3, relic: '버들 통발 뚜껑', art: 'wreck' },
      { id: 'skiff', name: '가라앉은 쪽배', x: 18, y: -84, coin: 18, cloth: 8, blueprint: 'telescope', relic: '녹슨 놋쇠 노걸이', art: 'wreck' },
      // 내륙(inland: 물가에서 안쪽으로 들어간 거리 m)은 망원경이 있어야 찾아요
      { id: 'grove', name: '숲속 돌 제단', x: 62, y: -108, inland: 28, coin: 20, cloth: 10, relic: '제단의 돌 부적', art: 'stone' },
      { id: 'hunter', name: '사냥꾼의 빈 오두막', x: -90, y: -70, inland: 42, coin: 30, wood: 20, relic: '사냥꾼의 뿔피리', art: 'cabin' },
    ],
    flot: { cap: 9, table: [['wood', 5, 3, 6], ['cloth', 1, 1, 3], ['hemp', 1, 1, 2], ['shiny', 1.2, 1, 1]] },
    trade: [['coffee', 7], ['spice', 3]], demand: ['porcelain'],
  },
  lake: {
    id: 'lake', name: '큰 호수', order: 1, grade: 1, theme: 'lake', yard: 2, wind: { from: -22 * D, speed: 9, swing: 0.5 }, gustK: 1.7, stormK: 2.05, heat: true, weather: ['storm', 'gust', 'squall', 'fog', 'heat'],
    shape: { kind: 'lake', ax: 170, ay: 280, ph: 0 },
    islands: [{ x: 54, y: -118, r: 30, ph: 0.6 }, { x: -62, y: 26, r: 21, ph: 2.2 }, { x: 44, y: 112, r: 13, ph: 4 }],
    start: 'southGate',
    ports: [{ id: 'southGate', name: '남쪽 물목', x: -30, y: 262 }, { id: 'pine', name: '솔숲 마을', x: -150, y: -70 }, { id: 'northPier', name: '북동 나루', x: 110, y: -195 }, { id: 'eastTown', name: '동쪽 마을', x: 158, y: 90 }, { id: 'reedTown', name: '갈대 마을', x: -152, y: 112 }],
    gates: [{ id: 'toRiver', name: '강 어귀', x: 16, y: -285, to: 'river', entry: 'head', req: { grade: 2 } }, { id: 'toPond', name: '남쪽 수로', x: 24, y: 276, to: 'pond', entry: 'stonePier', req: {} }],
    finds: [
      { id: 'lighthouse', name: '작은 등대', x: 118, y: -30, coin: 30, cloth: 20, blueprint: 'mast_m', relic: '등대지기의 기름 등잔', art: 'tower' },
      { id: 'cove', name: '조용한 만', x: -166, y: 45, coin: 22, wood: 30, relic: '조개껍데기 목걸이', art: 'beached' },
      { id: 'isleStone', name: '섬의 돌탑', x: 0, y: -88, coin: 25, cloth: 15, relic: '새긴 돌 조각', art: 'stone' },
      { id: 'barge', name: '버려진 바지선', x: 118, y: 170, coin: 40, nail: 8, wood: 40, relic: '바지선 선적 장부', art: 'wreck' },
      { id: 'hut', name: '어부의 빈 오두막', x: -68, y: -212, coin: 30, blueprint: 'barometer', relic: '어부의 낡은 그물추', art: 'cabin' },
      { id: 'pineTower', name: '솔숲 망루', x: -170, y: -160, inland: 32, coin: 40, cloth: 25, relic: '망루의 구리 나팔', art: 'tower' },
      { id: 'oldCamp', name: '숲속 옛 야영지', x: 175, y: 60, inland: 45, coin: 45, hemp: 6, wood: 40, relic: '야영지의 무쇠 냄비', art: 'camp' },
      { id: 'hillStone', name: '언덕 위 선돌', x: -60, y: 300, inland: 26, coin: 35, cloth: 20, relic: '선돌 아래 은화', art: 'stone' },
    ],
    flot: { cap: 14, table: [['wood', 4, 4, 9], ['cloth', 3, 3, 7], ['hemp', 2, 2, 4], ['nail', 1, 2, 4], ['shiny', 3, 1, 1]] },
    trade: [['coffee', 5], ['spice', 4], ['porcelain', 1]], demand: ['porcelain'],
  },
  river: {
    id: 'river', name: '강', order: 2, grade: 2, theme: 'river', yard: 3, wind: { from: -100 * D, speed: 8, swing: 0.8 }, gustK: 1.5, stormK: 1.85, heat: true, flow: 1.1, weather: ['storm', 'gust', 'squall', 'fog', 'heat', 'flood', 'drought'],
    shape: { kind: 'river', pts: [[0, 1000], [70, 840], [-50, 660], [-110, 470], [20, 290], [130, 120], [50, -70], [-100, -240], [-70, -440], [60, -620], [20, -800], [-30, -1000]], width: 62 },
    islands: [{ x: 96, y: 66, r: 11, ph: 1.2 }],
    start: 'head',
    ports: [{ id: 'head', name: '강머리 나루', x: 8, y: 960 }, { id: 'mill', name: '물방아 마을', x: -110, y: 400 }, { id: 'ferry', name: '나루터 언덕', x: -60, y: -320 }],
    gates: [{ id: 'toSea', name: '넓어지는 강', x: -24, y: -972, to: null, req: { grade: 3 } }, { id: 'toLake', name: '호수 어귀', x: -20, y: 985, to: 'lake', entry: 'northPier', req: {} }],
    finds: [
      { id: 'rapidsStone', name: '여울목 표지', x: 70, y: 760, coin: 30, oak: 20, wood: 30, relic: '여울 뱃사공의 장대 끝', art: 'stone' },
      { id: 'mill2', name: '멈춘 물레방아', x: -40, y: 540, coin: 35, canvas: 10, cloth: 20, blueprint: 'sloop', relic: '물레방아 쇠굴대', art: 'mill' },
      { id: 'hermit', name: '강가의 은둔처', x: 120, y: 170, coin: 40, tar: 6, relic: '은둔자의 나무 묵주', art: 'shelter' },
      { id: 'oldBridge', name: '무너진 옛 다리', x: -90, y: -180, coin: 50, oak: 30, nail: 10, wood: 40, relic: '다리 난간의 쇠고리', art: 'wreck' },
      { id: 'cairn', name: '순례자의 돌무지', x: 50, y: -560, coin: 45, relic: '순례자의 조가비 배지', art: 'stone' },
      { id: 'beacon', name: '강 끝 봉화대', x: 12, y: -860, coin: 60, canvas: 20, cloth: 30, relic: '봉화대의 청동 종', art: 'beacon' },
      { id: 'watchHut', name: '산지기 오두막', x: 90, y: 620, inland: 30, coin: 50, oak: 25, wood: 40, relic: '산지기의 쌍안경', art: 'cabin' },
      { id: 'ridgeStone', name: '능선의 돌탑', x: -130, y: 200, inland: 40, coin: 55, cloth: 30, relic: '능선의 화석', art: 'stone' },
      { id: 'hermitage', name: '숲속 암자', x: 90, y: -470, inland: 28, coin: 60, relic: '암자의 필사본', art: 'shrine' },
    ],
    shoals: [{ x: 40, y: 760, r: 34, depth: 1.1 }, { x: -70, y: 520, r: 40, depth: 1.05 }, { x: 110, y: 170, r: 42, depth: 1 }, { x: -60, y: -300, r: 34, depth: 1.1 }, { x: 50, y: -640, r: 50, depth: 0.95 }],
    flot: { cap: 18, table: [['wood', 3, 5, 10], ['oak', 3, 3, 7], ['cloth', 2, 3, 7], ['canvas', 2, 2, 5], ['tar', 1, 2, 3], ['nail', 1, 2, 4], ['shiny', 3, 1, 1]] },
    trade: [['coffee', 3], ['spice', 4], ['porcelain', 4], ['painting', 0.25]], demand: ['coffee', 'spice'],
  },
};
export const REGION_ORDER = ['pond', 'lake', 'river'];

// 도전과제. check는 logic.js가 S로 판단하고, 보상은 코인과 꾸미기 해금이에요
export const ACHIEVEMENTS = [
  { id: 'firstRow', name: '첫 노 젓기', desc: '노로 100m 가기', coin: 5 },
  { id: 'firstPort', name: '무사 귀항', desc: '처음 입항하기', coin: 5, decor: 'lantern' },
  { id: 'rowboat', name: '내 나룻배', desc: '나룻배 짓기', coin: 10 },
  { id: 'pondAll', name: '호숫가 탐험가', desc: '작은 호수 발견지 모두 찾기', coin: 15, decor: 'flowerpot' },
  { id: 'firstSail', name: '바람을 타다', desc: '돛으로 200m 가기', coin: 10 },
  { id: 'firstTack', name: '바람을 거슬러', desc: '처음 태킹하기', coin: 10 },
  { id: 'paint', name: '우리 배', desc: '배 색이나 이름 바꾸기', coin: 5, decor: 'pennant' },
  { id: 'gustSafe', name: '돌풍을 넘기다', desc: '돌풍을 피해 없이 넘기기', coin: 15 },
  { id: 'stormSafe', name: '폭풍을 뚫고', desc: '폭풍을 피해 없이 넘기기', coin: 20 },
  { id: 'heatSafe', name: '시원한 그늘', desc: '그늘막으로 무더위 하루 넘기기', coin: 15 },
  { id: 'crew3', name: '한 배를 탄 사람들', desc: '갑판원·견시·조타수 모두 고용해 본 적 있기', coin: 20, decor: 'cat' },
  { id: 'sloop', name: '진짜 항해', desc: '슬루프 짓기', coin: 20 },
  { id: 'lakeAll', name: '큰 호수의 지도', desc: '큰 호수 발견지 모두 찾기', coin: 25 },
  { id: 'species5', name: '관찰 일지', desc: '생물 5종 기록', coin: 30 },
  { id: 'species10', name: '물가의 친구들', desc: '생물 10종 기록', coin: 50 },
  { id: 'speciesAll', name: '민물 박물학자', desc: '민물 생물 모두 기록', coin: 80, decor: 'garland' },
  { id: 'riverEnd', name: '강이 끝나는 곳', desc: '강 끝에 닿기', coin: 50 },
];

// 칭호(수역 도달)
export const TITLES = ['뱃사공', '사공', '강 안내인'];

export const DECOR = {
  lantern: { name: '랜턴', icon: '🏮' },
  flowerpot: { name: '화분', icon: '🌼' },
  pennant: { name: '삼각기 줄', icon: '🎏' },
  cat: { name: '배 고양이', icon: '🐈' },
  garland: { name: '꽃 장식', icon: '💐' },
};
export const PAINTS = {
  hull: ['#f6f1e6', '#3f6f8f', '#b54a3d', '#2f5d4a', '#e7b64a', '#3a3f4a'],
  sail: [[250, 243, 226], [232, 214, 170], [226, 120, 96], [120, 170, 196], [238, 202, 96]],
  flag: ['#d6443a', '#2f7fb8', '#e7b64a', '#3f8a55', '#ffffff'],
};
