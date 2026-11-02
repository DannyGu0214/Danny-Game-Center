// M0 손맛 시제품 상수. 길이는 m, 속도는 m/s(게임용으로 실제보다 빠르게), 각도는 라디안이다.
const D = Math.PI / 180;

// 3/4 시점: 땅 y를 tiltY로 눌러 그리고 높이 z는 tiltZ만큼 위로 올린다(약 38° 기울임)
export const VIEW = { tiltY: 0.62, tiltZ: 0.785, zoomMin: 2.6, zoomDefault: 8, zoomMax: 14 };

export const BOAT = {
  len: 9, beam: 3,
  maxSail: 7.5,        // 돛으로 낼 수 있는 최고 속도
  rowSpeed: 2.8,       // 노 속도
  rowPeriod: 1.7,      // 노 한 번 젓는 시간(초)
  staminaDrain: 1 / 100, // 초당 체력 감소(100초면 지침)
  staminaRest: 1 / 40,
  tired: 0.45,         // 지쳤을 때 노 속도 배율
  accel: 3.2, coast: 7, // 속도가 목표로 가까워지는 시간 상수(가속, 관성)
  maxTurn: 0.62,       // 최대 회전(라디안/초)
  turnLag: 0.55,
  minSteer: 0.34,      // 멈춰 있어도 남는 키 힘(맞바람에 갇혀 영영 못 도는 일을 막는다)
  fullSteerSpd: 3.5,
  rowSteer: 0.8,
  clear: 3.2,          // 배 중심과 물가의 최소 거리
};

// 상대 바람각(0 = 정면) → 돛 효율. 맞바람 금지 구역 안은 0이다.
export const POLAR = [[0, 0], [40 * D, 0], [46 * D, 0.5], [60 * D, 0.82], [90 * D, 1], [120 * D, 0.97], [150 * D, 0.82], [180 * D, 0.68]];
export const NO_GO = 40 * D;
export const SAIL_K = 0.72; // 풍속 × 효율 × 이 값 = 목표 속도

export const WIND = {
  from: -22 * D,  // 기본 풍향(바람이 불어오는 쪽, 0 = 동쪽, y가 남쪽이라 음수가 북쪽)
  speed: 9,
  swing: 0.5,     // 풍향이 천천히 흔들리는 폭
};

export const SAIL_LEVELS = [0, 0.55, 1]; // 내림 · 줄임(축범) · 전체

export const NAV = {
  tackAngle: 50 * D, // 태킹 때 바람에 붙는 각
  lay: 32 * D,       // 목적지가 반대쪽으로 이만큼 넘어가면 태킹
  minTack: 7,        // 태킹 사이 최소 시간(초)
  look: 26,          // 물가를 미리 보는 거리
  arrive: 14, waypoint: 16,
};

export const LAKE = { ax: 170, ay: 280 };
