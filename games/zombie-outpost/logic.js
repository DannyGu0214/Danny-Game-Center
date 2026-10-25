// 좀비 아웃포스트 — 게임 규칙과 필드 시뮬레이션. DOM을 쓰지 않는다.
// 페이지(index.html)와 node 테스트(test/)가 같은 모듈을 쓴다.
// 좌표는 평면(위에서 내려다본) 월드 좌표다. 쿼터뷰 투영은 화면 쪽에서만 한다.

export const VERSION = 2;
// 구역 7개(380px씩 동심원)가 들어가도록 지도를 넓혔다(3200 → 5760, 땅 덩어리 320px의 배수). 예전 세이브는 deserialize가 위치를 옮긴다.
export const WORLD = { w: 5760, h: 5760 };
export const CENTER = { x: 2880, y: 2880 };
export const ZONE_SIZE = 380; // 본부에서 380px 멀어질 때마다 위험도 +1
// 바깥으로 갈수록 위험하다. 폐허 도심·검은 숲을 새로 넣고 군사 구역을 가장 바깥으로 뺐다.
export const ZONE_NAMES = ['기지 주변', '주택가', '상가 거리', '공단', '폐허 도심', '검은 숲', '군사 구역'];
export const OFFLINE_CAP_S = 8 * 3600; // 자리 비움으로 세는 최대 시간(작업 타이머·대상물 리스폰·습격 시계)
export const OFFLINE_PROD_CAP_S = 30 * 60; // 그중 자원·탄약 생산으로 쳐 주는 최대 시간: 오래 쉬는 것이 플레이보다 이득이 되지 않게
export const PLAYER_SPEED = 91; // 난이도 상향: 130에서 30% 느리게
export const GATHER_RANGE = 42;
export const NODE_COUNT = 580; // 예전 3200² 지도의 180개와 같은 밀도
// 리스폰 간격(초) = 대상물 크기별 기준(LOOT_TYPES.respawn: 작은 것 60 · 중간 95 · 큰 것 150)
//   × 구역 배율 × 대상물마다 고정된 ±20% 흔들림.
// 기지 근처(주택가)는 느리게, 바깥일수록 빠르게 다시 생긴다. 근처만 돌면 대상물이 자주 비고,
// 위험한 바깥으로 나가면 더 많이(봇 측정 약 2배) 모인다. 값은 tools/sim.js 기반 봇 비교로 정했다.
// 구역별 대상물 리스폰 배율: 기지에서 가장 가까운 주택가는 예전 1.8의 1.3배(2.34), 바깥은 구역 번호에 반비례(2.34 ÷ 구역)
export const RESPAWN_ZONE_MULT = [2.34, 2.34, 1.17, 0.78, 0.585, 0.468, 0.39];
export const RESPAWN_BY_SIZE = { small: 60, medium: 95, large: 150 };
export const RESPAWN_JITTER = 0.2;
export const OUTPOST_SAFE_R = 110;
export const HQ_MAX = 10;
export const MAX_SURVIVOR_LV = 15;
export const RES_KEYS = ['wood', 'scrap', 'plastic'];
export const RES_NAMES = { wood: '목재', scrap: '고철', plastic: '플라스틱' };
export const CRIT_CHANCE = 0.1; // 기본 치명타 확률 10%
export const CRIT_MULT = 2; // 치명타 피해 = 평타의 2배
// 성장: 플레이어가 직접 잡은 좀비만 경험치를 준다.
export const LEVEL_MAX = 99;
export const XP_BASE = 50; // 레벨 n → n+1 요구 경험치 = 50 × n (레벨에 비례해 늘어난다)
export const HP_PER_LEVEL = 8; // 레벨당 최대 체력 기준치
export const ATK_PER_LEVEL = 0.04; // 레벨당 공격력 기준치(무기 기본 피해의 +4%)
export const BAG_PER_LEVEL = 10; // 레벨당 가방 용량 기준치
export const BAG_SPREAD = 0.1; // 가방 상승치는 기준치의 ±10% 안에서 균일 분포로 뽑는다
export const GROWTH_SPREAD = 0.4; // 실제 상승치는 기준치의 ±40% 안에서 균일 분포로 뽑는다
export const SIEGE_HOLD_S = 90; // 포위된 생존자가 버티는 시간
export const ZOMBIE_ATK_CD = 1.2; // 좀비 공격 간격(초)
export const AUTO_RETREAT_HP = 0.5; // 자동사냥: 체력이 이 비율 아래면 기지로 물러난다
export const AUTO_MEDKIT_HP = 0.35; // 자동사냥: 체력이 이 비율 아래면 구급상자를 쓴다
export const RESCUE_R = 60; // 조난자에게 이만큼 다가가면 합류
export const SIEGE_NEAR_R = 260; // 포위 좀비를 다 잡은 뒤 이 거리 안에 있으면 합류
export const SIEGE_LEASH_R = 450; // 생존자에게서 이보다 멀리 끌려간 좀비는 포위에서 빠진다
const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// mulberry32: 저장 가능한 시드 기반 난수. 테스트에서 결과를 고정하려고 상태에 시드를 둔다.
export function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const dangerAt = (x, y) => dist(x, y, CENTER.x, CENTER.y) / ZONE_SIZE;
export const zoneIndex = (d) => clamp(Math.floor(d), 0, ZONE_NAMES.length - 1);

// ---------- 파밍 대상물 ----------
// 자원마다 원천이 다르다: 목재는 나무·목재 잔해, 고철은 차량·금속, 플라스틱은 상가 쓰레기·용기.
// zones는 구역(0 기지 주변 ~ 6 군사 구역)별 출현 가중치, time은 줍는 데 걸리는 초.
export const LOOT_TYPES = {
  fallenTree: { name: '쓰러진 나무', res: 'wood', amt: 9, time: 1.6, respawn: RESPAWN_BY_SIZE.large, zones: [0, 6, 2, 1, 1, 8, 3], items: ['flare'] },
  pallets: { name: '나무 팔레트 더미', res: 'wood', amt: 6, time: 1.0, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 3, 4, 4, 3, 2, 1], items: ['toolbox'] },
  furniture: { name: '부서진 가구', res: 'wood', amt: 5, time: 0.9, respawn: RESPAWN_BY_SIZE.small, zones: [0, 5, 3, 1, 4, 2, 0], items: ['medkit'] },
  fence: { name: '나무 울타리 잔해', res: 'wood', amt: 4, time: 0.7, respawn: RESPAWN_BY_SIZE.small, zones: [0, 6, 1, 1, 1, 5, 1], items: ['toolbox'] },
  wreck: { name: '폐차', res: 'scrap', amt: 10, time: 1.8, respawn: RESPAWN_BY_SIZE.large, zones: [0, 2, 3, 4, 4, 2, 3], items: ['toolbox', 'flare'] },
  drums: { name: '철제 드럼통', res: 'scrap', amt: 6, time: 1.1, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 1, 1, 5, 2, 2, 4], items: ['molotov'] },
  vending: { name: '고장 난 자판기', res: 'scrap', amt: 7, time: 1.3, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 1, 4, 1, 4, 0, 0], items: ['energy'] },
  rebar: { name: '철근 더미', res: 'scrap', amt: 8, time: 1.4, respawn: RESPAWN_BY_SIZE.large, zones: [0, 0, 1, 5, 4, 0, 4], items: ['toolbox'] },
  garbage: { name: '쓰레기 봉투 더미', res: 'plastic', amt: 3, time: 0.7, respawn: RESPAWN_BY_SIZE.small, zones: [0, 4, 5, 2, 5, 1, 0], items: ['medkit', 'molotov'] },
  bluedrum: { name: '플라스틱 물통', res: 'plastic', amt: 5, time: 1.0, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 2, 3, 3, 2, 2, 2], items: ['molotov'] },
  crates: { name: '플라스틱 상자', res: 'plastic', amt: 4, time: 0.9, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 1, 4, 3, 3, 1, 1], items: ['medkit', 'energy', 'stim'] },
  cones: { name: '교통 콘 무더기', res: 'plastic', amt: 4, time: 0.8, respawn: RESPAWN_BY_SIZE.small, zones: [0, 2, 3, 2, 3, 0, 1], items: ['flare'] },
  mannequin: { name: '마네킹', res: 'plastic', amt: 6, time: 1.2, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 0, 4, 0, 3, 0, 0], items: ['energy', 'medkit'] },
  // 원천을 자원마다 6종으로(목재·고철 2종씩, 이미 5종이던 플라스틱은 1종 추가)
  pole: { name: '쓰러진 전봇대', res: 'wood', amt: 10, time: 1.8, respawn: RESPAWN_BY_SIZE.large, zones: [0, 2, 3, 2, 2, 4, 3], items: ['flare'] },
  shed: { name: '무너진 헛간', res: 'wood', amt: 7, time: 1.2, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 4, 1, 2, 0, 5, 1], items: ['toolbox', 'medkit'] },
  cart: { name: '쇼핑 카트', res: 'scrap', amt: 4, time: 0.8, respawn: RESPAWN_BY_SIZE.small, zones: [0, 2, 5, 1, 4, 0, 0], items: ['energy'] },
  fridge: { name: '버려진 냉장고', res: 'scrap', amt: 7, time: 1.3, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 3, 2, 2, 3, 1, 1], items: ['molotov', 'energy'] },
  pharmacy: { name: '약국 진열대', res: 'plastic', amt: 5, time: 1.1, respawn: RESPAWN_BY_SIZE.medium, zones: [0, 1, 3, 1, 3, 0, 2], items: ['stim', 'medkit'] },
};

// ---------- 특별 아이템 ----------
// 대상물마다 나오는 아이템이 다르다(LOOT_TYPES.items). 포위 구출·습격 방어 보상으로도 받는다.
export const ITEMS = {
  medkit: { name: '구급상자', desc: '체력 60% 즉시 회복. 자동사냥 중 체력 35% 아래면 알아서 쓴다' },
  molotov: { name: '화염병', desc: '가까운 좀비 무리에 큰 범위 피해' },
  toolbox: { name: '공구 상자', desc: '본부 방벽을 즉시 완전 수리(무전으로 지시)' },
  flare: { name: '구조 신호탄', desc: '근처에 조난자를 불러낸다' },
  energy: { name: '에너지 드링크', desc: '30초 동안 이동·공격 속도 +40%' },
  stim: { name: '스팀팩', desc: '최대 체력의 20%를 잃는 대신 1분 동안 이동·파밍 속도 +50%' },
};
export const ITEM_KEYS = Object.keys(ITEMS);
export const ITEM_MAX = 9;
// 기지에서 멀수록 파밍이 좋아진다. 줍기는 늘 성공하고(초반 성장을 막는 실패 벌칙 없음),
// 1건당 자원량과 아이템 확률이 위험도 d에 따라 커진다.
// 1건당 자원량 배율 = 1 + 0.7d + 0.25d² (멀수록 가파르게: 위험도 1 → 1.9배, 2 → 3.4배, 3 → 5.3배, 4.5 → 9.2배).
// 직선형보다 근처는 비슷하고 원거리는 훨씬 커서 탐험 유인이 크다(봇 비교: 탐험÷근처 파밍량 2.05 → 2.22배).
export const lootMult = (d) => 1 + 0.7 * d + 0.25 * d * d; // 대상물 양에 이미 곱해져 있다
export const itemDropChance = (d) => clamp(0.02 + 0.02 * d, 0.02, 0.12); // 아이템이 함께 나올 확률
// 탄약: 총은 예비 탄약(모든 총 공용)으로만 재장전한다. 파밍할 때 따로 확률로 탄약 상자가 나온다.
export const AMMO_MAX = 240;
export const ammoChance = (d) => clamp(0.08 + 0.04 * d, 0.08, 0.28);
export const ammoDrop = (d) => Math.round(4 + 2 * d);
// 좀비 개체수는 거리에 비례한다(위험도 × 4마리).
// 스폰 간격: 기지 주변·주택가는 예전 0.9초의 1.3배(1.17초), 바깥은 구역 번호에 반비례(1.17 ÷ 구역)해 빨리 다시 찬다.
export const ZOMBIES_PER_DANGER = 4;
export const SPAWN_INTERVAL_S = 1.17;
export const spawnInterval = (d) => SPAWN_INTERVAL_S / Math.max(1, zoneIndex(d));
export const fieldPopulation = (d) => clamp(Math.ceil(ZOMBIES_PER_DANGER * d), 1, 30);
export const ENERGY_S = 30;
export const STIM_S = 60, STIM_HP = 0.2, STIM_MULT = 1.5; // 스팀팩: 1분, 최대 체력 20% 소모, 이동·파밍 +50%
// 명중률(플레이어 총): 붙어 있으면 100%, 사거리 끝에서 20%까지 거리에 비례해 떨어진다
export const gunAccuracy = (d, range) => 1 - 0.8 * clamp(d / range, 0, 1);

// ---------- 좀비 ----------
// 3등급 6종(2026-10-25). 능력치(체력·공격·속도) 중 강점 하나, 약점 하나를 가진다. 기준(×1)은 예전 워커.
// 강점·약점 크기: 하급 +50%/−50%, 중급 +100%/−25%, 상급 +200%/−12.5%(등급이 하나 오를 때마다 강점 ×2, 약점 ×½).
// 유형마다 약점이 정해져 있어 한 등급의 두 종은 강점도 약점도 서로 다르다. 속도는 이동 속도와 공격 속도(공격 간격 ÷ 속도)를 함께 바꾼다.
export const ZGRADES = [{ name: '하급', bonus: 0.5, penalty: 0.5 }, { name: '중급', bonus: 1, penalty: 0.25 }, { name: '상급', bonus: 2, penalty: 0.125 }];
export const ZSTYLES = {
  tank: { name: '체력형', strong: 'hp', weak: 'dmg' },
  power: { name: '피해형', strong: 'dmg', weak: 'spd' },
  speed: { name: '속도형', strong: 'spd', weak: 'hp' },
};
const ztype = (name, grade, style, r, xp) => {
  const m = { hp: 1, dmg: 1, spd: 1 };
  m[ZSTYLES[style].strong] = 1 + ZGRADES[grade].bonus;
  m[ZSTYLES[style].weak] = 1 - ZGRADES[grade].penalty;
  return { name, grade, style, ...m, r, xp };
};
export const ZTYPES = {
  runner: ztype('러너', 0, 'speed', 9, 4),
  bloater: ztype('뚱보', 0, 'tank', 14, 4),
  sprinter: ztype('질주자', 1, 'speed', 10, 7),
  butcher: ztype('도살자', 1, 'power', 13, 7),
  hulk: ztype('거구', 2, 'tank', 19, 12),
  slayer: ztype('학살자', 2, 'power', 15, 12),
};
export const ZTYPES_BY_GRADE = [0, 1, 2].map((g) => Object.keys(ZTYPES).filter((k) => ZTYPES[k].grade === g));

export const ZOMBIE_HP_MULT = 1.3, ZONE_HP_STEP = 0.15;
// zone = 좀비가 나타난 자리의 구역(습격 좀비는 강함을 정하는 위험도 d와 나타난 자리가 다르다)
export function zombieStats(type, d, zone = zoneIndex(d)) {
  const T = ZTYPES[type];
  return {
    // 난이도 상향: 전체 ×1.3, 바깥 구역일수록 구역마다 +15%(거리에 따른 ×1.5^d는 그대로)
    hp: Math.round(22 * ZOMBIE_HP_MULT * (1 + ZONE_HP_STEP * zone) * 1.5 ** d * T.hp),
    dmg: 4.5 * 1.36 ** d * T.dmg,
    speed: (46 + 5 * d) * T.spd,
    atkCd: ZOMBIE_ATK_CD / T.spd, // 빠른 좀비는 공격도 빠르다
    r: T.r,
  };
}

// 구역별 등급 비율 [하급, 중급, 상급](기지 주변·주택가 → 군사 구역). 같은 등급 두 종은 반반이다.
export const GRADE_SHARE = [[1, 0, 0], [1, 0, 0], [0.8, 0.2, 0], [0.6, 0.35, 0.05], [0.4, 0.45, 0.15], [0.25, 0.45, 0.3], [0.15, 0.4, 0.45]];
export const gradeShare = (d) => GRADE_SHARE[zoneIndex(d)];
export const pickInGrade = (s, g) => ZTYPES_BY_GRADE[g][Math.floor(rand(s) * ZTYPES_BY_GRADE[g].length)];
export function pickZombieType(s, d) {
  const share = gradeShare(d);
  let r = rand(s), g = 0;
  while (g < 2 && r >= share[g]) { r -= share[g]; g++; }
  return pickInGrade(s, g);
}

// ---------- 무기 ----------
// source: craft(공방 제작) / loot(파밍으로만 발견) / unique(미션 보상).
// tier는 제작에 필요한 공방 레벨. 근접은 제한 없이 휘두르고, 총기는 탄창을 다 쓰면 재장전한다(그동안은 근접).
// 특수 효과: crit(치명타 확률 추가), guard(받는 피해 감소), leech(준 피해의 일부만큼 체력 회복).
export const WEAPONS = {
  fist: { name: '맨주먹', kind: 'melee', dmg: 6, cd: 0.5, range: 34, tier: 0, cost: { scrap: 20 } },
  pipe: { name: '쇠파이프', kind: 'melee', dmg: 14, cd: 0.6, range: 42, tier: 1, cost: { scrap: 40 }, dur: 120 },
  bat: { name: '못 박은 방망이', kind: 'melee', dmg: 26, cd: 0.65, range: 46, cleave: 40, tier: 2, cost: { wood: 60, scrap: 60 }, dur: 160 },
  machete: { name: '마체테', kind: 'melee', dmg: 45, cd: 0.5, range: 44, tier: 3, cost: { wood: 100, scrap: 300 }, dur: 200 },
  axe: { name: '소방 도끼', kind: 'melee', dmg: 90, cd: 0.8, range: 52, cleave: 55, tier: 4, cost: { wood: 400, scrap: 900 }, dur: 240 },
  pistol: { name: '권총', kind: 'gun', dmg: 18, cd: 0.45, range: 250, mag: 8, reload: 1.4, tier: 1, cost: { scrap: 70, plastic: 30 } },
  shotgun: { name: '산탄총', kind: 'gun', dmg: 40, cd: 0.9, range: 170, splash: 45, mag: 4, reload: 2.0, tier: 2, cost: { scrap: 250, plastic: 120 } },
  rifle: { name: '사냥 소총', kind: 'gun', dmg: 70, cd: 0.6, range: 340, mag: 5, reload: 2.2, tier: 3, cost: { wood: 200, scrap: 700, plastic: 250 } },
  carbine: { name: '자동 소총', kind: 'gun', dmg: 45, cd: 0.18, range: 300, mag: 24, reload: 2.6, tier: 4, cost: { scrap: 2000, plastic: 900 } },
  // 파밍 전용: find에 적힌 대상물을 minZone 이상 구역에서 주울 때만 chance 확률로 발견
  chainsaw: { name: '전기톱', kind: 'melee', source: 'loot', dmg: 16, cd: 0.12, range: 44, cleave: 30, value: 600, find: ['fallenTree', 'pallets'], minZone: 2, chance: 0.03, dur: 500 },
  sledge: { name: '대형 해머', kind: 'melee', source: 'loot', dmg: 150, cd: 1.2, range: 52, cleave: 65, value: 800, find: ['rebar', 'wreck'], minZone: 3, chance: 0.03, dur: 150 },
  crossbow: { name: '석궁', kind: 'gun', source: 'loot', dmg: 95, cd: 0.9, range: 380, mag: 1, reload: 0.9, value: 500, find: ['furniture', 'fence'], minZone: 1, chance: 0.03 },
  nailgun: { name: '네일건', kind: 'gun', source: 'loot', dmg: 14, cd: 0.12, range: 170, mag: 30, reload: 2.0, value: 450, find: ['crates', 'vending'], minZone: 2, chance: 0.03 },
  flamer: { name: '화염방사기', kind: 'gun', source: 'loot', dmg: 11, cd: 0.08, range: 120, splash: 50, mag: 60, reload: 3.0, value: 900, find: ['drums', 'bluedrum'], minZone: 3, chance: 0.03 },
  // 유니크: 미션 보상으로만
  homerun: { name: '홈런왕', kind: 'melee', source: 'unique', dmg: 60, cd: 0.55, range: 50, cleave: 50, crit: 0.25, value: 1500, desc: '치명타 확률 +25%', dur: 260 },
  savior: { name: '구원자', kind: 'gun', source: 'unique', dmg: 75, cd: 0.75, range: 200, splash: 60, mag: 6, reload: 1.5, value: 1800, desc: '넓은 산탄, 빠른 재장전' },
  bulwark: { name: '철벽', kind: 'melee', source: 'unique', dmg: 120, cd: 0.75, range: 56, cleave: 60, guard: 0.3, value: 2200, desc: '장착 중 받는 피해 -30%', dur: 320 },
  milestone: { name: '이정표', kind: 'gun', source: 'unique', dmg: 280, cd: 1.1, range: 480, mag: 5, reload: 2.2, value: 2600, desc: '아주 긴 사거리' },
  prometheus: { name: '프로메테우스', kind: 'gun', source: 'unique', dmg: 26, cd: 0.08, range: 150, splash: 60, mag: 90, reload: 2.4, leech: 0.03, value: 3200, desc: '불길로 준 피해의 3%만큼 체력 회복' },
};
export const weaponSource = (id) => WEAPONS[id].source ?? 'craft';
export const WEAPON_MAX_LV = 10;
// 근접 무기 내구도: 한 번 때릴 때마다 1 줄고, 0이면 파손(맨주먹으로 싸운다). 맨주먹은 부서지지 않는다.
// 최대 내구도는 강화할 때 공격력과 같은 비율(+15%/강화)로 늘어난다.
export const maxDurability = (s, id) => (WEAPONS[id].dur ? Math.round(WEAPONS[id].dur * (1 + 0.15 * ((s.weapons[id] || 1) - 1))) : Infinity);
export const isBroken = (s, id) => !!WEAPONS[id].dur && (s.dur[id] ?? 0) <= 0;
export const meleeId = (s) => (isBroken(s, s.equip.melee) ? 'fist' : s.equip.melee); // 실제로 휘두르는 근접 무기
// 무기를 얻을 때: 근접은 내구도 가득, 총은 탄창 1개분 탄약이 같이 온다
export function gainWeapon(s, id) {
  const w = WEAPONS[id];
  if (w.kind === 'gun' && !Object.keys(s.weapons).some((k) => WEAPONS[k].kind === 'gun')) s.gunOn = true; // 첫 총을 얻으면 총기 사용을 켠다
  s.weapons[id] ||= 1;
  if (w.dur) s.dur[id] = maxDurability(s, id);
  if (w.mag) s.ammo = Math.min(AMMO_MAX, s.ammo + w.mag);
}

export const xpToNext = (lv) => XP_BASE * lv;
// 레벨업 때 뽑은 상승치를 누적해 둔다(s.growth). 같은 레벨이라도 사람마다 조금씩 다르다.
export const levelAtkMult = (s) => 1 + s.growth.atk;
export const rollGrowth = (s, base, spread = GROWTH_SPREAD) => base * (1 - spread + 2 * spread * rand(s));
export const zombieXp = (z) => Math.round(ZTYPES[z.type].xp * (1 + 0.5 * z.d));
// 무기 강화(+15%/강화)와 레벨 보너스(+4%/레벨)가 곱해진다. 플레이어 무기에만 쓴다.
export const weaponDamage = (s, id) => WEAPONS[id].dmg * (1 + 0.15 * ((s.weapons[id] || 1) - 1)) * levelAtkMult(s);
export function weaponUpgradeCost(s, id) {
  const w = WEAPONS[id], base = w.cost?.scrap ?? w.value;
  return scaleCost({ scrap: base * 0.8, [w.kind === 'gun' ? 'plastic' : 'wood']: base * 0.6 }, 0.6 * 1.45 ** (s.weapons[id] || 1));
}

// ---------- 기지 건물 ----------
export const BUILDINGS = {
  barricade: { name: '바리케이드', desc: '방벽 체력 ×1.5', base: { wood: 40, scrap: 20 }, unlockHq: 1 },
  watchtower: { name: '감시탑', desc: '방어 배치 +1, 방어 피해 +10%', base: { wood: 50, scrap: 30 }, unlockHq: 1 },
  workbench: { name: '공방', desc: '무기 제작 등급 +1', base: { wood: 20, scrap: 30 }, unlockHq: 1, max: 4 },
  dorm: { name: '숙소', desc: '동료 정원 +2', base: { wood: 40, plastic: 20 }, unlockHq: 1 },
  sawmill: { name: '제재소', desc: '목재 생산', prod: { wood: 0.25 }, base: { scrap: 30, plastic: 15 }, unlockHq: 1 },
  scrapyard: { name: '고철 작업장', desc: '고철 생산', prod: { scrap: 0.2 }, base: { wood: 35, plastic: 15 }, unlockHq: 1 },
  recycler: { name: '재활용 작업장', desc: '플라스틱 생산', prod: { plastic: 0.18 }, base: { wood: 30, scrap: 30 }, unlockHq: 2 },
  clinic: { name: '의무실', desc: '최대 체력 +25, 회복 증가', base: { scrap: 80, plastic: 60 }, unlockHq: 3 },
  repair: { name: '수리점', desc: '본부에서 근접 무기 수리(2·3레벨은 수리비 -25%씩)', base: { wood: 40, scrap: 40 }, unlockHq: 1, max: 3 },
  ammo: { name: '총알 제작소', desc: '고철 2·플라스틱 1로 탄약 1발(1레벨 6초에 1발, 강화마다 +10%)', base: { wood: 50, scrap: 60 }, unlockHq: 2 },
  pack: { name: '배낭 공방', desc: '가방 용량 +25%(레벨마다, 동행 동료 짐 포함)', base: { wood: 45, plastic: 40 }, unlockHq: 2 },
};
// 총알 제작소: 시설 1레벨 6초에 1발, 시설을 강화할 때마다 직전 속도의 1.1배(복리). 1발에 고철 2·플라스틱 1.
// 자원이 모자라거나 예비 탄약이 가득 차면 멈춘다. (2026-10-24 너무 빨라서 속도 관련 값을 모두 절반으로: 3초→6초, +20%→+10%, 동료 보너스 100%→50%)
export const AMMO_COST = { scrap: 2, plastic: 1 };
export const AMMO_BASE_S = 6, AMMO_GROWTH = 1.1, AMMO_CREW_SHARE = 0.5;
export const ammoRate = (lv) => (lv > 0 ? (1 / AMMO_BASE_S) * AMMO_GROWTH ** (lv - 1) : 0); // 시설 레벨별 기본 초당 발 수
// 근무 배치 동료의 생산 보너스(역할·등급·레벨)를 절반만 반영한다
export const ammoCrewMult = (s) => 1 + workBonus(s) * AMMO_CREW_SHARE;
export const ammoRateOf = (s) => ammoRate(s.bld.ammo) * ammoCrewMult(s);
export function setAmmoOn(s, on) {
  if (!s.bld.ammo) return fail('총알 제작소를 먼저 지어야 해요');
  s.ammoOn = !!on;
  return ok(s.ammoOn ? '총알 제작소 가동 · 고철·플라스틱을 써서 탄약을 만들어요' : '총알 제작소 멈춤 · 자원을 아껴요');
}
// sec초 동안 만들 수 있는 만큼 만든다. 자투리는 s.ammoProg에 쌓는다(저장하지 않아도 되는 작은 값).
export function makeAmmo(s, sec) {
  if (!s.bld.ammo || !s.ammoOn) return 0; // 꺼 두면 자원을 쓰지 않는다
  s.ammoProg = (s.ammoProg ?? 0) + sec * ammoRateOf(s);
  let made = 0;
  while (s.ammoProg >= 1 && s.ammo < AMMO_MAX && canAfford(s.res, AMMO_COST)) { pay(s.res, AMMO_COST); s.ammo++; s.ammoProg -= 1; made++; }
  if (s.ammoProg > 1) s.ammoProg = 1; // 멈춰 있는 동안 몰아서 만들지 않는다
  return made;
}

export const buildingMax = (s, id) => Math.min(BUILDINGS[id].max ?? HQ_MAX, s.hq);
export const buildCost = (id, next) => scaleCost(BUILDINGS[id].base, 1.55 ** (next - 1));
export function hqCost(next) {
  const k = next - 2;
  return { wood: Math.round(80 * 1.9 ** k), scrap: Math.round(80 * 1.9 ** k), plastic: Math.round(70 * 1.9 ** k) };
}

// 본부 레벨이 대부분의 한도를 정한다(기지 확장 = 본부 레벨업).
export const survivorCap = (s) => 2 + 2 * s.bld.dorm;
export const defenseSlots = (s) => 1 + s.bld.watchtower;
export const defenseMult = (s) => 1 + 0.1 * s.bld.watchtower;
export const wallMax = (s) => Math.round(150 * 1.5 ** s.bld.barricade);
export const outpostLimit = (s) => Math.floor(s.hq / 2);
// 가방은 레벨업으로만 커진다(소수점까지 누적하고 칸 수는 내림)
// 가방 = (기본 60 + 레벨업 누적 + 탐험 동료가 나눠 드는 짐) × (1 + 0.25 × 배낭 공방 레벨)
export const PACK_BONUS = 0.25;
export const ESCORT_CARRY = 25; // 탐험 동료 1명이 드는 짐 = 25 × 전투력
export const bagCap = (s) => Math.floor((60 + s.growth.bag + escorts(s).reduce((a, v) => a + survivorCarry(v), 0)) * (1 + PACK_BONUS * s.bld.pack));
export const maxHp = (s) => 100 + 25 * s.bld.clinic + s.growth.hp;
export const hqSafeRadius = (s) => 140 + 22 * s.hq;

// ---------- 전진기지 후보지 ----------
// 후보지마다 특산 자원이 다르다(prod는 1레벨·위험도 0 기준 초당 생산량).
// 전진기지 후보지: 판마다(시드) 구역마다 2곳씩 무작위로 정한다. 기지 주변 구역은 빼고 주택가~군사 구역 6구역 × 2 = 12곳.
// 이름·특산은 구역에 어울리는 후보에서 겹치지 않게 고르고, 위험도(d)는 실제 자리 기준이다. 저장에는 남기지 않고 시드로 다시 만든다.
export const SITES_PER_ZONE = 2;
export const SITES_VERSION = 2; // 저장의 후보지 방식(없으면 예전 고정 9곳)
export const SITE_POOL = [
  [], // 기지 주변: 없음
  [{ name: '버려진 편의점', prod: { plastic: 0.1, wood: 0.03 } }, { name: '초등학교', prod: { wood: 0.09, plastic: 0.04 } }, { name: '동네 약국', prod: { plastic: 0.09, scrap: 0.03 } }, { name: '아파트 관리소', prod: { wood: 0.06, scrap: 0.06 } }],
  [{ name: '주유소', prod: { scrap: 0.07, plastic: 0.06 } }, { name: '대형 마트', prod: { plastic: 0.1, wood: 0.03 } }, { name: '시장 상가', prod: { wood: 0.07, plastic: 0.05 } }],
  [{ name: '물류 창고', prod: { wood: 0.06, plastic: 0.07 } }, { name: '자동차 정비소', prod: { scrap: 0.1, plastic: 0.03 } }, { name: '제재 공장', prod: { wood: 0.1, scrap: 0.03 } }],
  [{ name: '시립 병원', prod: { plastic: 0.1, scrap: 0.03 } }, { name: '경찰서', prod: { scrap: 0.1, plastic: 0.03 } }, { name: '방송국', prod: { scrap: 0.07, plastic: 0.06 } }],
  [{ name: '산림 감시소', prod: { wood: 0.1, plastic: 0.02 } }, { name: '캠핑장', prod: { wood: 0.08, plastic: 0.04 } }, { name: '벌목 기지', prod: { wood: 0.11, scrap: 0.02 } }],
  [{ name: '군 검문소', prod: { scrap: 0.12, wood: 0.02 } }, { name: '육군 보급창', prod: { scrap: 0.1, plastic: 0.03 } }, { name: '레이더 기지', prod: { scrap: 0.09, plastic: 0.05 } }],
];
// 예전 고정 후보지 9곳의 구역(세이브 옮기기용): 편의점·주유소·초등학교·물류 창고·병원·경찰서·검문소·산림 감시소·보급창
const OLD_SITE_ZONES = [1, 2, 2, 3, 3, 3, 4, 5, 6];
function genSites(seed) {
  const g = { rng: (seed ^ 0x27d4eb2f) | 0 }, sites = [];
  for (let z = 1; z < ZONE_NAMES.length; z++) {
    const pool = SITE_POOL[z].slice();
    for (let k = 0; k < SITES_PER_ZONE; k++) {
      const { name, prod } = pool.splice(Math.floor(rand(g) * pool.length), 1)[0];
      // 구역 가장자리에서 조금 안쪽 고리에서 고르고, 다른 후보지와 가장 멀리 떨어진 자리를 쓴다(같은 구역끼리 700, 다른 구역과 450 넘게)
      let best = null, bestGap = -1;
      for (let tries = 0; tries < 80 && bestGap < 1; tries++) {
        const a = rand(g) * TAU, r = (z + 0.15 + rand(g) * 0.7) * ZONE_SIZE;
        const x = Math.round(CENTER.x + Math.cos(a) * r), y = Math.round(CENTER.y + Math.sin(a) * r);
        if (x < 200 || y < 200 || x > WORLD.w - 200 || y > WORLD.h - 200) continue;
        const gap = Math.min(1, ...sites.map((o) => dist(x, y, o.x, o.y) / (zoneIndex(o.d) === z ? 700 : 450)));
        if (gap > bestGap) { bestGap = gap; best = { x, y }; }
      }
      sites.push({ name, prod, x: best.x, y: best.y, d: dangerAt(best.x, best.y) });
    }
  }
  return sites;
}
export const OUTPOST_MAX_LV = 3;

export function outpostCost(s, site) {
  const { d } = s.sites[site];
  return { wood: Math.round(60 * 1.7 ** d), scrap: Math.round(70 * 1.7 ** d), plastic: Math.round(30 * 1.6 ** d) };
}
export const outpostUpgradeCost = (s, site, lv) => scaleCost(outpostCost(s, site), 1.8 ** lv);
export function outpostProd(s, site, lv) {
  const o = s.sites[site], m = lv * (1 + 0.5 * o.d), p = {};
  for (const [r, v] of Object.entries(o.prod)) p[r] = v * m;
  return p;
}

// ---------- 동료(구출한 생존자) ----------
// 동료 임무: 기지 방벽에서 싸우거나(defense), 생산을 돕거나(work), 플레이어와 함께 필드를 다닌다(explore).
export const ROLES = {
  gunner: { name: '사수', dmg: 9, cd: 0.7, range: 240, ranged: true, desc: '원거리 사격' },
  brawler: { name: '근접전사', dmg: 20, cd: 0.8, range: 70, desc: '방벽에 붙은 좀비를 처리' },
  scout: { name: '정찰병', dmg: 7, cd: 0.6, range: 300, ranged: true, desc: '가장 긴 사거리' },
  medic: { name: '의무병', dmg: 5, cd: 0.8, range: 200, ranged: true, repair: 2, desc: '습격 중 방벽 응급 보수' },
  engineer: { name: '기술자', dmg: 6, cd: 0.8, range: 200, ranged: true, repair: 3, work: 0.25, desc: '방벽 보수, 생산 보너스 큼' },
};
export const RARITIES = [
  { name: '일반', mult: 1 },
  { name: '희귀', mult: 1.7 },
  { name: '영웅', mult: 2.8 },
];
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '한', '오', '서'];
const GIVEN = ['민준', '서연', '도윤', '하은', '지호', '수아', '현우', '지민', '건우', '유나', '태오', '다인', '시우', '소율', '준서', '예린', '하람', '윤재'];

export function makeSurvivor(s, d = 0) {
  const roles = Object.keys(ROLES);
  const wEpic = 6 + 3 * d, wRare = 24 + 4 * d, roll = rand(s) * (70 + wRare + wEpic);
  return {
    id: s.nextId++,
    name: SURNAMES[Math.floor(rand(s) * SURNAMES.length)] + GIVEN[Math.floor(rand(s) * GIVEN.length)],
    role: roles[Math.floor(rand(s) * roles.length)],
    rarity: roll < 70 ? 0 : roll < 70 + wRare ? 1 : 2,
    lv: 1,
    post: 'work',
  };
}
export const survivorPower = (v) => RARITIES[v.rarity].mult * (1 + 0.2 * (v.lv - 1));
export const levelUpCost = (v) => ({ scrap: Math.round(25 * 1.5 ** (v.lv - 1)), plastic: Math.round(20 * 1.5 ** (v.lv - 1)) });
export const defenders = (s) => s.survivors.filter((v) => v.post === 'defense');
// 동료 능력치(동료 탭에 보이는 값을 그대로 쓴다)
// 방어·탐험: 한 번 공격 피해 = 전투력 × 공격, 초당 공격 횟수 = 공속 → 화력 = 전투력 × 공격 × 공속(방어는 감시탑 보너스를 더 곱한다).
//   사거리 = 서 있는 자리(방어는 방벽 위 자기 자리, 탐험은 플레이어 곁)에서 공격할 수 있는 거리.
// 생산: 생산 배치 동료의 생산 +n%를 모두 더해 기본 생산에 (1 + 합)으로 곱한다.
export const survivorAtk = (v) => ROLES[v.role].dmg * DEFENDER_DMG;
export const survivorRate = (v) => 1 / ROLES[v.role].cd;
export const survivorHit = (v) => survivorPower(v) * survivorAtk(v);
export const survivorWork = (v) => (ROLES[v.role].work ?? 0.1) * survivorPower(v);
export const survivorCarry = (v) => Math.round(ESCORT_CARRY * survivorPower(v)); // 탐험 동행 때 가방에 더해 주는 짐
export const workBonus = (s) => s.survivors.reduce((a, v) => a + (v.post === 'work' ? survivorWork(v) : 0), 0);
// 감시탑이 완공되면 늘어난 방어 자리에 생산 근무 동료 1명을 자동으로 올린다.
// 순서: 원거리 사격(사수·정찰병) > 근거리 공격(근접전사) > 기타 보수·생산 인력(의무병·기술자), 같은 순서면 화력이 큰 동료.
export const DEFENSE_RANK = { gunner: 0, scout: 0, brawler: 1, medic: 2, engineer: 2 };
export function autoDefender(s) {
  if (defenders(s).length >= defenseSlots(s)) return null;
  const fire = (v) => survivorHit(v) * survivorRate(v);
  const v = s.survivors.filter((x) => x.post === 'work').sort((a, b) => DEFENSE_RANK[a.role] - DEFENSE_RANK[b.role] || fire(b) - fire(a))[0];
  if (!v) return null;
  v.post = 'defense';
  delete s.posts[v.id];
  return v;
}
export const POSTS = { defense: '방어', work: '생산', explore: '탐험' };
export const POST_ORDER = ['defense', 'work', 'explore'];
// 탐험 동행 자리: 본부 3레벨에 1명, 5레벨에 2명
export const exploreSlots = (s) => (s.hq >= 5 ? 2 : s.hq >= 3 ? 1 : 0);
export const EXPLORE_UNLOCK = [3, 5];
export const escorts = (s) => s.survivors.filter((v) => v.post === 'explore');

// ---------- 자원 ----------
export function scaleCost(cost, k) {
  const out = {};
  for (const [r, v] of Object.entries(cost)) out[r] = Math.round(v * k);
  return out;
}
export const canAfford = (res, cost) => Object.entries(cost).every(([r, v]) => res[r] >= v);
function pay(res, cost) {
  for (const [r, v] of Object.entries(cost)) res[r] -= v;
}
export const bagTotal = (s) => RES_KEYS.reduce((a, k) => a + s.bag[k], 0);

export function productionPerSec(s) {
  const p = { wood: 0, scrap: 0, plastic: 0 };
  for (const [id, b] of Object.entries(BUILDINGS)) {
    if (b.prod) for (const [r, v] of Object.entries(b.prod)) p[r] += v * s.bld[id];
  }
  for (const o of s.outposts) for (const [r, v] of Object.entries(outpostProd(s, o.site, o.lv))) p[r] += v;
  // 근무 배치 동료가 생산을 돕는다. 기술자는 보너스가 더 크다.
  const bonus = 1 + workBonus(s);
  for (const r of RES_KEYS) p[r] *= bonus;
  return p;
}

export function fmt(n) {
  const a = Math.abs(n);
  if (a < 1000) return String(Math.floor(n));
  const units = ['K', 'M', 'B', 'T'];
  let i = -1, v = a;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return (n < 0 ? '-' : '') + (v < 10 ? v.toFixed(1) : Math.floor(v)) + units[i];
}

// ---------- 새 게임 / 월드 ----------
function pickLootType(g, zone) {
  const entries = Object.entries(LOOT_TYPES), total = entries.reduce((a, [, t]) => a + t.zones[zone], 0);
  let roll = rand(g) * total;
  for (const [id, t] of entries) { if (roll < t.zones[zone]) return id; roll -= t.zones[zone]; }
  return entries[0][0];
}

// 위치로 정해지는 흔들림(난수 순서를 건드리지 않아 기존 지도 배치가 그대로다)
const posHash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
export function nodeRespawn(n) {
  const base = LOOT_TYPES[n.type].respawn * RESPAWN_ZONE_MULT[zoneIndex(n.d)];
  return Math.round(base * (1 - RESPAWN_JITTER + 2 * RESPAWN_JITTER * posHash(n.x, n.y)));
}

// 대상물 자리를 정하면 위험도·양·리스폰 시간도 그 자리 기준으로 다시 계산한다
function setNodePos(n, x, y) {
  n.x = x; n.y = y; n.d = dangerAt(x, y);
  n.amt = Math.round(LOOT_TYPES[n.type].amt * lootMult(n.d));
  n.respawn = nodeRespawn(n);
}
// 파밍된 대상물은 같은 구역 안 무작위 자리로 옮겨 다시 생긴다. 종류는 그대로라 구역별·자원별 대상물 수가 변하지 않는다.
// 처음 배치와 같은 규칙: 본부 둘레(위험도 1 미만)·전진기지 후보지 70px 안·안전지대·장애물 근처·다른 대상물 바로 옆은 피한다.
export function relocateNode(s, n) {
  const zone = zoneIndex(n.d), r1 = Math.max(ZONE_SIZE, zone * ZONE_SIZE);
  const r2 = zone === ZONE_NAMES.length - 1 ? Math.hypot(CENTER.x, CENTER.y) : (zone + 1) * ZONE_SIZE;
  for (let tries = 0; tries < 60; tries++) {
    const a = rand(s) * TAU, r = Math.sqrt(r1 * r1 + rand(s) * (r2 * r2 - r1 * r1)); // 고리 안 넓이 고르게
    const x = Math.round(CENTER.x + Math.cos(a) * r), y = Math.round(CENTER.y + Math.sin(a) * r);
    if (x < 60 || y < 60 || x > WORLD.w - 60 || y > WORLD.h - 60 || zoneIndex(dangerAt(x, y)) !== zone) continue;
    if (s.sites.some((o) => dist(x, y, o.x, o.y) < 70) || safeZoneAt(s, x, y, 30) || insideObstacle(s, x, y, 34)) continue;
    if (s.nodes.some((m) => m !== n && dist(x, y, m.x, m.y) < 40)) continue;
    setNodePos(n, x, y);
    n.moved = true;
    return true;
  }
  return false; // 자리를 못 찾으면 제자리에서 다시 생긴다
}

function genNodes(seed, sites) {
  const g = { rng: seed ^ 0x5bd1e995 };
  const nodes = [];
  while (nodes.length < NODE_COUNT) {
    // 저장·검사·그리기가 같은 좌표를 쓰도록 먼저 반올림한다
    const x = Math.round(60 + rand(g) * (WORLD.w - 120)), y = Math.round(60 + rand(g) * (WORLD.h - 120));
    if (dist(x, y, CENTER.x, CENTER.y) < ZONE_SIZE) continue;
    if (sites.some((o) => dist(x, y, o.x, o.y) < 70)) continue;
    const d = dangerAt(x, y), type = pickLootType(g, zoneIndex(d)), T = LOOT_TYPES[type];
    const n = { x, y, type, res: T.res, amt: Math.round(T.amt * lootMult(d)), d, readyAt: 0 };
    n.respawn = nodeRespawn(n);
    nodes.push(n);
  }
  return nodes;
}

// ---------- 장애물(지형지물·잔해) ----------
// 통과할 수 없고 파밍도 안 된다. 충돌은 원으로 처리하고, 그림은 화면 쪽에서 종류별로 그린다.
export const OBSTACLE_TYPES = {
  rock: { name: '바위', r: 18, zones: [0, 3, 1, 3, 1, 5, 2] },
  rubble: { name: '콘크리트 잔해', r: 22, zones: [0, 2, 4, 4, 6, 1, 3] },
  wall: { name: '무너진 담벼락', r: 26, zones: [0, 4, 3, 1, 5, 0, 0] },
  deadtree: { name: '고목', r: 14, zones: [0, 4, 1, 1, 0, 7, 2] },
  barrier: { name: '콘크리트 방벽', r: 18, zones: [0, 1, 3, 2, 4, 0, 3] },
  container: { name: '녹슨 컨테이너', r: 34, zones: [0, 0, 1, 4, 3, 0, 1] },
  sandbags: { name: '모래주머니', r: 20, zones: [0, 0, 0, 1, 1, 0, 4] },
  tanktrap: { name: '대전차 장애물', r: 16, zones: [0, 0, 0, 1, 0, 0, 4] },
  // 안쪽 구역 전용(구역마다 2종): 주택가 가로수·생울타리, 상가 거리 버스 정류장·노점 가판대, 공단 콘크리트 관 더미·저장 탱크
  tree: { name: '가로수', r: 14, zones: [0, 6, 2, 0, 0, 1, 0] },
  hedge: { name: '생울타리', r: 24, zones: [0, 5, 1, 0, 0, 0, 0] },
  busstop: { name: '버스 정류장', r: 26, zones: [0, 1, 5, 1, 2, 0, 0] },
  kiosk: { name: '노점 가판대', r: 22, zones: [0, 1, 5, 0, 2, 0, 0] },
  pipes: { name: '콘크리트 관 더미', r: 26, zones: [0, 0, 1, 6, 2, 0, 1] },
  tank: { name: '저장 탱크', r: 30, zones: [0, 0, 0, 5, 1, 0, 2] },
  // 바깥 구역 전용(구역마다 2종): 폐허 도심 무너진 건물·불탄 버스, 검은 숲 침엽수·가시덤불, 군사 구역 벙커·파괴된 전차
  ruin: { name: '무너진 건물', r: 34, zones: [0, 0, 0, 1, 6, 0, 1] },
  bus: { name: '불탄 버스', r: 34, zones: [0, 0, 1, 1, 4, 0, 1] },
  pine: { name: '침엽수', r: 14, zones: [0, 1, 0, 0, 0, 7, 1] },
  bramble: { name: '가시덤불', r: 22, zones: [0, 1, 0, 0, 1, 5, 0] },
  bunker: { name: '콘크리트 벙커', r: 28, zones: [0, 0, 0, 0, 0, 0, 4] },
  tankwreck: { name: '파괴된 전차', r: 30, zones: [0, 0, 0, 0, 1, 0, 4] },
};
export const OBSTACLE_COUNT = 780; // 예전 240개와 같은 밀도
const OBS_CELL = 160;
// 도로(화면의 아스팔트 줄)에는 장애물을 두지 않는다. 화면도 같은 규칙으로 도로를 그린다.
export const isRoad = (x, y) => Math.floor(x / 80) % 7 === 3 || Math.floor(y / 80) % 7 === 3;

function genObstacles(seed, nodes, sites) {
  const g = { rng: Math.imul(seed, 2654435761) ^ 0x2c1b3c6d };
  const entries = Object.entries(OBSTACLE_TYPES), list = [];
  for (let tries = 0; list.length < OBSTACLE_COUNT && tries < 30000; tries++) {
    // 저장·검사·그리기가 같은 좌표를 쓰도록 먼저 반올림한다
    const x = Math.round(60 + rand(g) * (WORLD.w - 120)), y = Math.round(60 + rand(g) * (WORLD.h - 120));
    if (dist(x, y, CENTER.x, CENTER.y) < 440 || isRoad(x, y)) continue;
    const zone = zoneIndex(dangerAt(x, y)), total = entries.reduce((a, [, t]) => a + t.zones[zone], 0);
    let roll = rand(g) * total, type = entries[0][0];
    for (const [id, t] of entries) { if (roll < t.zones[zone]) { type = id; break; } roll -= t.zones[zone]; }
    const r = OBSTACLE_TYPES[type].r;
    if (sites.some((o) => dist(x, y, o.x, o.y) < 150 + r)) continue;
    if (nodes.some((n) => dist(x, y, n.x, n.y) < r + 34)) continue;
    if (list.some((o) => dist(x, y, o.x, o.y) < o.r + r + 40)) continue; // 사이로 지나갈 틈을 남긴다
    list.push({ x, y, type, r, rot: rand(g) < 0.5 ? 0 : 1 });
  }
  return list;
}

function buildObsGrid(list) {
  const grid = new Map();
  list.forEach((o) => {
    const k = `${Math.floor(o.x / OBS_CELL)},${Math.floor(o.y / OBS_CELL)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(o);
  });
  return grid;
}

export function setObstacles(s, list) {
  s.obstacles = list;
  s.obsGrid = buildObsGrid(list);
}

export function obstaclesNear(s, x, y) {
  const cx = Math.floor(x / OBS_CELL), cy = Math.floor(y / OBS_CELL), out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const cell = s.obsGrid.get(`${cx + i},${cy + j}`);
    if (cell) out.push(...cell);
  }
  return out;
}
export const insideObstacle = (s, x, y, margin = 0) => obstaclesNear(s, x, y).some((o) => dist(x, y, o.x, o.y) < o.r + margin);

// 장애물 안으로 들어가면 가장자리로 밀어낸다(미끄러지듯 비켜 간다).
function pushOutOfObstacles(s, e, er) {
  for (const o of obstaclesNear(s, e.x, e.y)) {
    const d = dist(e.x, e.y, o.x, o.y), min = o.r + er;
    if (d < min) { const k = min / (d || 1); e.x = o.x + (e.x - o.x) * k; e.y = o.y + (e.y - o.y) * k; }
  }
}

// 진행 방향 앞에 장애물이 있으면 옆으로 비켜 가는 방향을 섞는다.
function avoidObstacles(s, x, y, vx, vy, er) {
  const m = Math.hypot(vx, vy);
  if (m < 0.01) return { x: vx, y: vy };
  let ux = vx / m, uy = vy / m, ax = 0, ay = 0;
  for (const o of obstaclesNear(s, x, y)) {
    const cx = o.x - x, cy = o.y - y, ahead = cx * ux + cy * uy, reach = 70 + o.r;
    if (ahead <= 0 || ahead > reach) continue;
    const side = cx * uy - cy * ux; // 진행선에서 얼마나 옆에 있는가
    if (Math.abs(side) > o.r + er + 6) continue;
    // 장애물 반대쪽 수직 방향
    let px = -uy, py = ux;
    if (px * cx + py * cy > 0) { px = -px; py = -py; }
    const w = 1 - ahead / reach;
    ax += px * w * 1.6; ay += py * w * 1.6;
  }
  ux += ax; uy += ay;
  const n = Math.hypot(ux, uy) || 1;
  return { x: (ux / n) * Math.min(1, m), y: (uy / n) * Math.min(1, m) };
}

export const RAID_FIRST_S = 240;

export function newGame(seed = (Date.now() & 0x7fffffff) || 1) {
  const s = {
    v: VERSION,
    seed,
    rng: seed,
    savedAt: Date.now(),
    time: 0,
    res: { wood: 30, scrap: 20, plastic: 10 },
    bag: { wood: 0, scrap: 0, plastic: 0 },
    hq: 1,
    bld: Object.fromEntries(Object.keys(BUILDINGS).map((k) => [k, 0])),
    weapons: { fist: 1 },
    equip: { melee: 'fist', gun: null },
    survivors: [],
    outposts: [],
    jobs: [], // 진행 중인 건설·강화·제작·훈련
    wall: 150,
    raidT: RAID_FIRST_S,
    player: { x: CENTER.x, y: CENTER.y + 20, hp: 100, dead: 0, cd: 0, face: 0, mag: 0, reload: 0, buff: 0, stim: 0 },
    ammo: 0, // 예비 탄약(모든 총 공용)
    ammoOn: true, // 총알 제작소 가동 여부
    gunOn: false, // 총기 사용 여부(끄면 근접 무기만 써서 탄약을 아낀다). 처음엔 총이 없어 꺼 두고, 첫 총을 얻으면 켠다
    dur: {}, // 근접 무기 내구도
    items: { ...Object.fromEntries(ITEM_KEYS.map((k) => [k, 0])), medkit: 2 }, // 로그라이크 시작 지원
    claimed: {},
    autoHunt: true,
    autoZone: 1, // 활동 반경: 자동사냥이 쫓아가는 구역(0 기지 주변 ~ 4 군사 구역까지)
    stance: 'neutral',
    level: 1,
    xp: 0,
    growth: { hp: 0, atk: 0, bag: 0 },
    stats: { kills: 0, deaths: 0, looted: 0, rescued: 0, raidsWon: 0, raidsLost: 0, militaryLoot: 0, playTime: 0, eliteKills: 0 },
    ended: null, // 엔딩에 닿은 때 { at: 플레이 시간(초), goals: 달성한 목표 id }
    hero: null, // 이번 판의 생존자 { id: HEROES 키, name, runId }
    over: null,
    nextId: 1,
  };
  s.sites = genSites(seed);
  s.nodes = genNodes(seed, s.sites);
  setObstacles(s, genObstacles(seed, s.nodes, s.sites));
  return resetTransient(s);
}

function resetTransient(s) {
  s.zombies = [];
  s.zid = 1;
  s.spawnT = 1;
  s.posts = {};
  s.gather = null;
  s.rescue = null;
  s.rescueT = 40;
  s.raid = null;
  s.autoTarget = null;
  s.autoT = 0;
  s.autoRetreat = false;
  s.waypoint = null;
  s.player.reload = 0;
  return s;
}

// 예비 탄약에서 탄창을 채운다(무한 재장전 없음)
function loadMag(s) {
  const g = s.equip.gun && WEAPONS[s.equip.gun], P = s.player;
  P.reload = 0;
  if (!g) return;
  const take = Math.min(g.mag - P.mag, s.ammo);
  if (take > 0) { P.mag += take; s.ammo -= take; }
}
// 총을 바꾸면 탄창에 남은 탄은 예비로 돌려놓고 새 총을 채운다
function swapGun(s, id) {
  s.ammo += s.player.mag; s.player.mag = 0;
  s.equip.gun = id;
  loadMag(s);
}
// 총기 사용을 끄면 공격·공격 반경·자동사냥 접근 거리가 모두 근접 기준이 된다
export const gunReady = (s) => s.gunOn && !!s.equip.gun && s.player.reload <= 0 && s.player.mag > 0;

// ---------- 안전지대 ----------
export function safeZones(s) {
  const zones = [{ x: CENTER.x, y: CENTER.y, r: hqSafeRadius(s), kind: 'hq' }];
  for (const o of s.outposts) zones.push({ x: s.sites[o.site].x, y: s.sites[o.site].y, r: OUTPOST_SAFE_R, kind: 'outpost', site: o.site });
  return zones;
}
export function safeZoneAt(s, x, y, margin = 0) {
  for (const z of safeZones(s)) if (dist(x, y, z.x, z.y) < z.r + margin) return z;
  return null;
}
function nearestSafe(s, x, y) {
  let best = null, bd = Infinity;
  for (const z of safeZones(s)) {
    const d = dist(x, y, z.x, z.y);
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}

// ---------- 작업 시간(건설·강화·제작·훈련) ----------
// 누르면 바로 끝나지 않는다. 자원은 시작할 때 내고, 효과는 시간이 다 지나야 붙는다.
// 걸리는 시간 = 5분 × (목표 레벨 ÷ 그 항목의 최고 레벨): 높은 등급일수록 비례해서 길고, 최고 등급이 딱 5분이다.
// 줄마다 한 번에 하나만 진행한다. 다른 줄끼리는 동시에 돌아간다.
export const JOB_MAX_S = 300;
export const JOB_LANES = { base: '기지 건설', forge: '무기 작업', train: '훈련', outpost: '전진기지 공사' };
const JOB_KINDS = { hq: 'base', bld: 'base', craft: 'forge', wup: 'forge', lvl: 'train', obuild: 'outpost', oup: 'outpost', odemo: 'outpost' };
// 전진기지 철거: 자원은 돌려받지 못하고, 그 레벨까지 지은 시간의 절반이 걸린다(1레벨 50초 · 2레벨 1분 40초 · 3레벨 2분 30초).
// 다 헐릴 때까지는 안전지대·생산이 그대로이고, 끝나면 그 자리는 다시 후보지가 된다.
export const DEMOLISH_SHARE = 0.5;
export const CRAFT_MAX_TIER = Math.max(...Object.values(WEAPONS).map((w) => w.tier ?? 0));
export const jobTime = (next, max) => Math.round(JOB_MAX_S * Math.min(1, next / max));
export const durText = (sec) => {
  const t = Math.max(0, Math.ceil(sec)), m = Math.floor(t / 60), r = t % 60;
  return m ? (r ? `${m}분 ${r}초` : `${m}분`) : `${r}초`;
};
// 항목별 (목표 레벨, 최고 레벨) → 시간
export function jobDuration(kind, key, next) {
  switch (kind) {
    case 'hq': return jobTime(next, HQ_MAX);
    case 'bld': return jobTime(next, BUILDINGS[key].max ?? HQ_MAX);
    case 'craft': return jobTime(WEAPONS[key].tier, CRAFT_MAX_TIER);
    case 'wup': return jobTime(next, WEAPON_MAX_LV);
    case 'lvl': return jobTime(next, MAX_SURVIVOR_LV);
    case 'odemo': return Math.round(jobTime(next, OUTPOST_MAX_LV) * DEMOLISH_SHARE); // next = 헐리는 전진기지의 레벨
    default: return jobTime(next, OUTPOST_MAX_LV); // obuild(1레벨)·oup
  }
}
// 작업 대상의 지금 레벨(없는 대상이면 null)과 오를 수 있는 최고 레벨. 저장 검증에 쓴다.
function jobLevel(s, kind, key) {
  const site = Number.isInteger(key) && key >= 0 && key < s.sites.length;
  switch (kind) {
    case 'hq': return key === 0 ? s.hq : null;
    case 'bld': return Object.hasOwn(BUILDINGS, key) ? s.bld[key] : null;
    case 'craft': return Object.hasOwn(WEAPONS, key) && weaponSource(key) === 'craft' ? (s.weapons[key] ? 1 : 0) : null;
    case 'wup': return Object.hasOwn(WEAPONS, key) && s.weapons[key] ? s.weapons[key] : null;
    case 'lvl': return s.survivors.find((v) => v.id === key)?.lv ?? null;
    case 'obuild': return site ? (s.outposts.some((o) => o.site === key) ? 1 : 0) : null;
    case 'oup': case 'odemo': return site ? s.outposts.find((o) => o.site === key)?.lv ?? null : null;
    default: return null;
  }
}
function jobMax(s, kind, key) {
  switch (kind) {
    case 'hq': return HQ_MAX;
    case 'bld': return buildingMax(s, key);
    case 'craft': return s.bld.workbench >= WEAPONS[key].tier ? 1 : 0;
    case 'wup': return WEAPON_MAX_LV;
    case 'lvl': return MAX_SURVIVOR_LV;
    case 'obuild': return s.outposts.length < outpostLimit(s) ? 1 : 0;
    default: return OUTPOST_MAX_LV;
  }
}
export const laneJob = (s, lane) => s.jobs.find((j) => j.lane === lane) ?? null;
export const jobOf = (s, kind, key) => s.jobs.find((j) => j.kind === kind && j.key === key) ?? null;
export function jobName(s, j) {
  switch (j.kind) {
    case 'hq': return `본부 ${j.next}레벨`;
    case 'bld': return `${BUILDINGS[j.key].name} ${j.next}레벨`;
    case 'craft': return `${WEAPONS[j.key].name} 제작`;
    case 'wup': return `${WEAPONS[j.key].name} +${j.next - 1}`;
    case 'lvl': return `${s.survivors.find((v) => v.id === j.key)?.name ?? '동료'} ${j.next}레벨`;
    case 'obuild': return `${s.sites[j.key].name} 전진기지`;
    case 'odemo': return `${s.sites[j.key].name} 철거`;
    default: return `${s.sites[j.key].name} ${j.next}레벨`;
  }
}
const busy = (s, lane) => {
  const j = laneJob(s, lane);
  return j && fail(`${JOB_LANES[lane]} 중이에요 · ${jobName(s, j)} ${durText(j.t)} 남음`);
};
function startJob(s, kind, key, next, cost) {
  pay(s.res, cost);
  const total = jobDuration(kind, key, next);
  const j = { lane: JOB_KINDS[kind], kind, key, next, t: total, total };
  s.jobs.push(j);
  return ok(`${jobName(s, j)} 시작 · ${durText(total)} 걸려요`);
}
function finishJob(s, j) {
  switch (j.kind) {
    case 'hq': s.hq = Math.max(s.hq, j.next); break;
    case 'bld': {
      const before = wallMax(s);
      s.bld[j.key] = Math.max(s.bld[j.key], j.next);
      if (j.key === 'barricade') s.wall += wallMax(s) - before;
      if (j.key === 'watchtower') { const v = autoDefender(s); if (v) return { posted: { name: v.name, role: v.role } }; }
      break;
    }
    case 'craft': {
      const w = WEAPONS[j.key];
      gainWeapon(s, j.key);
      if (w.kind === 'gun') swapGun(s, j.key); else s.equip.melee = j.key;
      break;
    }
    case 'wup': {
      const before = WEAPONS[j.key].dur ? maxDurability(s, j.key) : 0;
      s.weapons[j.key] = Math.max(s.weapons[j.key] || 1, j.next);
      if (before) s.dur[j.key] = Math.min(maxDurability(s, j.key), (s.dur[j.key] ?? 0) + maxDurability(s, j.key) - before); // 늘어난 만큼 함께 찬다
      break;
    }
    case 'lvl': { const v = s.survivors.find((x) => x.id === j.key); if (v) v.lv = Math.max(v.lv, j.next); break; }
    case 'obuild': if (!s.outposts.some((o) => o.site === j.key)) s.outposts.push({ site: j.key, lv: 1 }); break;
    case 'odemo': s.outposts = s.outposts.filter((o) => o.site !== j.key); break;
    default: { const o = s.outposts.find((x) => x.site === j.key); if (o) o.lv = Math.max(o.lv, j.next); }
  }
}
// 진행 중인 작업의 시간을 줄이고, 다 된 것은 효과를 붙인다(게임 중에는 step, 자리를 비운 뒤에는 applyOffline이 부른다).
export function advanceJobs(s, dt, ev = []) {
  for (const j of [...s.jobs]) {
    j.t -= dt;
    if (j.t > 0) continue;
    s.jobs.splice(s.jobs.indexOf(j), 1);
    const name = jobName(s, j);
    const extra = finishJob(s, j);
    ev.push({ t: 'job-done', kind: j.kind, key: j.key, next: j.next, name, ...extra });
  }
  return ev;
}

// 작업에 낸 자원(시작할 때와 같은 계산, 작업 중에는 대상 레벨이 바뀌지 않는다). 취소하면 이만큼 돌려준다.
export function jobCost(s, j) {
  switch (j.kind) {
    case 'hq': return hqCost(j.next);
    case 'bld': return buildCost(j.key, j.next);
    case 'craft': return WEAPONS[j.key].cost;
    case 'wup': return weaponUpgradeCost(s, j.key);
    case 'lvl': { const v = s.survivors.find((x) => x.id === j.key); return v ? levelUpCost(v) : {}; }
    case 'obuild': return outpostCost(s, j.key);
    case 'oup': { const o = s.outposts.find((x) => x.site === j.key); return o ? outpostUpgradeCost(s, j.key, o.lv) : {}; }
    default: return {}; // 철거는 자원을 쓰지 않는다
  }
}
// 진행 중인 작업 취소: 낸 자원을 모두 돌려주고 효과는 붙지 않는다. 철거를 취소하면 전진기지가 그대로 남는다.
export function cancelJob(s, kind, key) {
  const j = jobOf(s, kind, key);
  if (!j) return fail('진행 중인 작업이 아니에요');
  const c = jobCost(s, j), name = jobName(s, j);
  s.jobs.splice(s.jobs.indexOf(j), 1);
  for (const [r, v] of Object.entries(c)) s.res[r] += v;
  const back = Object.entries(c).filter(([, v]) => v > 0).map(([r, v]) => `${RES_NAMES[r]} ${fmt(v)}`).join(' · ');
  return ok(`${name} 취소${back ? ` · ${back} 돌려받음` : ''}`);
}

// ---------- 행동(버튼) ----------
const ok = (msg) => ({ ok: true, msg });
const fail = (msg) => ({ ok: false, msg });

export function upgradeHq(s) {
  if (s.hq >= HQ_MAX) return fail('본부가 최고 레벨이에요');
  const c = hqCost(s.hq + 1);
  const wait = busy(s, 'base'); if (wait) return wait;
  if (!canAfford(s.res, c)) return fail('자원이 부족해요');
  return startJob(s, 'hq', 0, s.hq + 1, c);
}

export function buyBuilding(s, id) {
  const b = BUILDINGS[id];
  if (!b) return fail('없는 건물이에요');
  if (s.hq < b.unlockHq) return fail(`본부 ${b.unlockHq}레벨에 열려요`);
  const next = s.bld[id] + 1;
  if (next > buildingMax(s, id)) return fail('본부 레벨을 먼저 올려야 해요');
  const wait = busy(s, 'base'); if (wait) return wait;
  const c = buildCost(id, next);
  if (!canAfford(s.res, c)) return fail('자원이 부족해요');
  return startJob(s, 'bld', id, next, c);
}

export function craftWeapon(s, id) {
  const w = WEAPONS[id];
  if (!w) return fail('없는 무기예요');
  if (s.weapons[id]) return fail('이미 가진 무기예요');
  if (weaponSource(id) !== 'craft') return fail(weaponSource(id) === 'loot' ? '파밍으로만 구할 수 있어요' : '미션 보상으로만 받을 수 있어요');
  if (s.bld.workbench < w.tier) return fail(`공방 ${w.tier}레벨이 필요해요`);
  const wait = busy(s, 'forge'); if (wait) return wait;
  if (!canAfford(s.res, w.cost)) return fail('자원이 부족해요');
  return startJob(s, 'craft', id, 1, w.cost);
}

export function upgradeWeapon(s, id) {
  if (!s.weapons[id]) return fail('먼저 제작해야 해요');
  if (s.weapons[id] >= WEAPON_MAX_LV) return fail('최고 강화예요');
  const wait = busy(s, 'forge'); if (wait) return wait;
  const c = weaponUpgradeCost(s, id);
  if (!canAfford(s.res, c)) return fail('자원이 부족해요');
  return startJob(s, 'wup', id, s.weapons[id] + 1, c);
}

export function equipWeapon(s, id) {
  if (!s.weapons[id]) return fail('먼저 제작해야 해요');
  if (WEAPONS[id].kind === 'gun') swapGun(s, id); else s.equip.melee = id;
  return ok(`${WEAPONS[id].name} 장착${isBroken(s, id) ? ' · 파손 상태라 수리 전까지는 맨주먹으로 싸워요' : ''}`);
}

// 근접 무기 수리: 본부 안전지대에서, 수리점이 있을 때만. 시간은 걸리지 않고 고철을 낸다(잃은 내구도에 비례).
export function repairCost(s, id) {
  const w = WEAPONS[id], max = maxDurability(s, id), missing = 1 - (s.dur[id] ?? 0) / max;
  const base = (w.cost?.scrap ?? w.value * 0.5) * (1 + 0.15 * ((s.weapons[id] || 1) - 1));
  return { scrap: Math.max(1, Math.ceil(base * 0.6 * missing * (1 - 0.25 * Math.max(0, s.bld.repair - 1)))) };
}
export function repairWeapon(s, id) {
  const w = WEAPONS[id];
  if (!w || !w.dur || !s.weapons[id]) return fail('수리할 수 있는 근접 무기가 아니에요');
  if (!s.bld.repair) return fail('본부에 수리점을 먼저 지어야 해요');
  if (safeZoneAt(s, s.player.x, s.player.y)?.kind !== 'hq') return fail('본부 안에 있어야 수리할 수 있어요');
  if ((s.dur[id] ?? 0) >= maxDurability(s, id)) return fail('내구도가 가득해요');
  const c = repairCost(s, id);
  if (!canAfford(s.res, c)) return fail('자원이 부족해요');
  pay(s.res, c);
  s.dur[id] = maxDurability(s, id);
  return ok(`${w.name} 수리 완료 · 내구도 ${s.dur[id]}`);
}

export function setPost(s, id, post) {
  const v = s.survivors.find((x) => x.id === id);
  if (!v) return fail('없는 동료예요');
  if (!Object.hasOwn(POSTS, post)) return fail('알 수 없는 임무예요');
  if (post === 'defense' && v.post !== 'defense' && defenders(s).length >= defenseSlots(s)) return fail(`방어 배치는 ${defenseSlots(s)}명까지예요. 감시탑을 올리세요`);
  if (post === 'explore' && v.post !== 'explore') {
    const n = exploreSlots(s);
    if (!n) return fail(`탐험 동행은 본부 ${EXPLORE_UNLOCK[0]}레벨에 열려요`);
    if (escorts(s).length >= n) return fail(`탐험 동행은 ${n}명까지예요${n < 2 ? `. 본부 ${EXPLORE_UNLOCK[1]}레벨에 2명이 돼요` : ''}`);
  }
  if (v.post !== post) delete s.posts[v.id]; // 새 임무 자리에서 다시 시작한다
  v.post = post;
  return ok(post === 'defense' ? `${v.name} 방벽 배치` : post === 'explore' ? `${v.name} 탐험 동행` : `${v.name} 생산 근무`);
}

// 배치 리셋: 모든 동료를 기본 임무(생산)로 돌린다. 방어·탐험 자리가 모두 빈다.
export function resetPosts(s) {
  const moved = s.survivors.filter((v) => v.post !== 'work');
  if (!moved.length) return fail('이미 모두 생산 근무예요');
  for (const v of moved) { v.post = 'work'; delete s.posts[v.id]; }
  return ok(`동료 ${moved.length}명의 배치를 리셋했어요. 모두 생산 근무예요`);
}

export function levelSurvivor(s, id) {
  const v = s.survivors.find((x) => x.id === id);
  if (!v) return fail('없는 동료예요');
  if (v.lv >= MAX_SURVIVOR_LV) return fail('최고 레벨이에요');
  const wait = busy(s, 'train'); if (wait) return wait;
  const c = levelUpCost(v);
  if (!canAfford(s.res, c)) return fail('자원이 부족해요');
  return startJob(s, 'lvl', v.id, v.lv + 1, c);
}

export const nearSite = (s, site) => dist(s.player.x, s.player.y, s.sites[site].x, s.sites[site].y) < 90;

export function buildOutpost(s, site) {
  if (!s.sites[site]) return fail('없는 후보지예요');
  if (s.outposts.some((o) => o.site === site)) return fail('이미 세운 전진기지예요');
  const wait = busy(s, 'outpost'); if (wait) return wait;
  if (s.outposts.length >= outpostLimit(s)) {
    const need = (s.outposts.length + 1) * 2;
    return fail(need > HQ_MAX ? '전진기지 한도에 도달했어요' : `본부 ${need}레벨부터 하나 더 세울 수 있어요`);
  }
  if (s.player.dead || !nearSite(s, site)) return fail('후보지에 직접 가야 해요');
  const c = outpostCost(s, site);
  if (!canAfford(s.res, c)) return fail('자원이 부족해요');
  return startJob(s, 'obuild', site, 1, c);
}

export function upgradeOutpost(s, site) {
  const o = s.outposts.find((x) => x.site === site);
  if (!o) return fail('먼저 세워야 해요');
  if (o.lv >= OUTPOST_MAX_LV) return fail('최고 레벨이에요');
  const wait = busy(s, 'outpost'); if (wait) return wait;
  const c = outpostUpgradeCost(s, site, o.lv);
  if (!canAfford(s.res, c)) return fail('자원이 부족해요');
  return startJob(s, 'oup', site, o.lv + 1, c);
}

// 철거: 자원 반환 없음, 레벨에 비례한 작업 시간. 공사 줄을 쓰므로 그동안 다른 전진기지 공사는 못 한다.
export function demolishOutpost(s, site) {
  const o = s.outposts.find((x) => x.site === site);
  if (!o) return fail('세운 전진기지가 아니에요');
  const wait = busy(s, 'outpost'); if (wait) return wait;
  const r = startJob(s, 'odemo', site, o.lv, {});
  return ok(`${r.msg} · 자원은 돌아오지 않아요`);
}

// 목적지까지 자동 이동(전진기지 후보지 안내 등). 손가락으로 움직이면 취소된다.
export function travelTo(s, x, y) {
  s.waypoint = { x: clamp(x, 20, WORLD.w - 20), y: clamp(y, 20, WORLD.h - 20) };
  s.autoTarget = null;
  s.autoT = 0;
  return ok('이동을 시작해요');
}

// 귀환: 가장 가까운 기지(본부·전진기지)로 걸어간다. 가깝다는 것은 기지 경계까지의 거리다(본부는 반경이 크다).
// 가는 길에 좀비를 쫓지 않고(피하기는 한다), 기지 안에 들어서면 멈춘다. 손가락으로 움직이면 취소된다.
export function returnToBase(s) {
  const P = s.player;
  if (P.dead) return fail('쓰러진 동안은 움직일 수 없어요');
  if (safeZoneAt(s, P.x, P.y)) return fail('이미 기지 안이에요');
  let best = null, bd = Infinity;
  for (const z of safeZones(s)) { const d = dist(P.x, P.y, z.x, z.y) - z.r; if (d < bd) { bd = d; best = z; } }
  travelTo(s, best.x, best.y);
  s.waypoint.home = true;
  const name = best.kind === 'hq' ? '본부' : s.sites[best.site].name;
  return ok(`${name}${roParticle(name)} 귀환해요`);
}
// '로/으로': 받침이 있으면(ㄹ 받침 제외) '으로'
export const roParticle = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00, j = c % 28; return c >= 0 && c < 11172 && j && j !== 8 ? '으로' : '로'; };

// ---------- 미션 ----------
export const MISSIONS = [
  { id: 'hunter', name: '좀비 사냥꾼', desc: '좀비 1,000마리 처치', goal: 1000, reward: 'homerun', progress: (s) => s.stats.kills },
  { id: 'rescuer', name: '구조대장', desc: '생존자 10명 구출', goal: 10, reward: 'savior', progress: (s) => s.stats.rescued },
  { id: 'wall', name: '철벽 수비', desc: '기지 습격 10회 방어', goal: 10, reward: 'bulwark', progress: (s) => s.stats.raidsWon },
  { id: 'pioneer', name: '개척자', desc: '전진기지 3곳 건설', goal: 3, reward: 'milestone', progress: (s) => s.outposts.length },
  { id: 'raider', name: '군사 구역 약탈자', desc: '군사 구역에서 50번 파밍', goal: 50, reward: 'prometheus', progress: (s) => s.stats.militaryLoot },
];
export const missionDone = (s, m) => m.progress(s) >= m.goal;

export function claimMission(s, id) {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) return fail('없는 미션이에요');
  if (s.claimed[id]) return fail('이미 받은 보상이에요');
  if (!missionDone(s, m)) return fail(`아직 ${Math.floor(m.progress(s))}/${m.goal}이에요`);
  s.claimed[id] = true;
  gainWeapon(s, m.reward);
  return ok(`미션 달성! 유니크 무기 「${WEAPONS[m.reward].name}」 획득`);
}

// ---------- 아이템 사용 ----------
export function addItem(s, id, n = 1) {
  const before = s.items[id];
  s.items[id] = Math.min(ITEM_MAX, before + n);
  return s.items[id] - before;
}

export function useItem(s, id, ev = []) {
  const P = s.player;
  if (!ITEMS[id]) return fail('없는 아이템이에요');
  if (!s.items[id]) return fail(`${ITEMS[id].name}이(가) 없어요`);
  if (P.dead && id !== 'toolbox') return fail('쓰러진 동안은 쓸 수 없어요');
  if (id === 'medkit') {
    if (P.hp >= maxHp(s)) return fail('체력이 가득해요');
    P.hp = Math.min(maxHp(s), P.hp + maxHp(s) * 0.6);
  } else if (id === 'molotov') {
    const z = nearestZombie(s, P.x, P.y, 220);
    if (!z) return fail('던질 대상이 가까이 없어요');
    const dmg = 45 * 1.5 ** dangerAt(P.x, P.y);
    for (const o of s.zombies) if (o.hp > 0 && dist(o.x, o.y, z.x, z.y) < 95) { o.hp -= dmg; o.hit = 0.2; o.by = 'player'; ev.push({ t: 'dmg', x: o.x, y: o.y, dmg, crit: true }); }
    ev.push({ t: 'fire', x: z.x, y: z.y });
  } else if (id === 'toolbox') {
    if (s.wall >= wallMax(s)) return fail('방벽이 멀쩡해요');
    s.wall = wallMax(s);
  } else if (id === 'flare') {
    if (s.rescue) return fail('이미 구조 신호가 떠 있어요');
    if (dormFull(s)) return fail(`숙소가 가득 찼어요(${s.survivors.length}/${survivorCap(s)}). 숙소를 먼저 올리세요`);
    if (!spawnRescueNear(s, P.x, P.y, ev)) return fail('여기서는 신호가 닿지 않아요. 조금 움직여 보세요');
  } else if (id === 'energy') {
    P.buff = ENERGY_S;
  } else if (id === 'stim') {
    if (P.hp <= maxHp(s) * STIM_HP + 1) return fail('체력이 너무 낮아서 쓸 수 없어요');
    P.hp -= maxHp(s) * STIM_HP;
    P.stim = STIM_S;
  }
  s.items[id]--;
  return ok(`${ITEMS[id].name} 사용`);
}

// ---------- 기지 습격 ----------
// 편성 공식은 The Last Spark hordes.js:13-16 관측식을 본부 레벨 기반 L로 옮긴 것이다.
export const raidsEnabled = (s) => s.hq >= 2 || s.survivors.length > 0;
export const raidLevel = (s) => clamp(s.hq * 6 + s.stats.raidsWon, 1, 60);
export const raidDanger = (s) => 1 + 0.4 * s.hq;
export function raidComposition(L) {
  const r = clamp((L - 15) / 45, 0, 1);
  // 예전 워커·러너·브루트 수를 하급·중급·상급 수로 그대로 옮겼다
  return [Math.round(4 + 21 * ((L - 1) / 59) ** 1.35), Math.floor(10 * r ** 1.65), Math.floor(10 * r * r)];
}
export const RAID_LOSS = 0.2; // 방벽이 뚫리면 창고 자원의 20%를 잃는다
export const raidAmmo = (s) => 10 + 3 * s.hq; // 습격을 막으면 탄약도 받는다
export const DEFENDER_DMG = 1.3; // 방어 동료 공격력: 좀비 체력 ×1.3만큼 함께 올려 습격 난이도만 되돌린다

function startRaid(s, ev) {
  const comp = raidComposition(raidLevel(s));
  const queue = [];
  comp.forEach((n, g) => { for (let i = 0; i < n; i++) queue.push(ZTYPES_BY_GRADE[g][i % 2]); }); // 등급 안 두 종을 번갈아
  for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
  s.raid = { queue, spawnT: 0, ang: rand(s) * TAU, total: queue.length, hpTotal: 0 };
  ev.push({ t: 'raid-start', count: queue.length });
}

function updateRaid(s, dt, ev) {
  const max = wallMax(s);
  if (!s.raid) {
    s.wall = Math.min(max, s.wall + max * 0.03 * dt);
    if (!raidsEnabled(s)) return;
    s.raidT -= dt;
    if (s.raidT <= 0) startRaid(s, ev);
    return;
  }
  const R = s.raid;
  R.spawnT -= dt;
  if (R.queue.length && R.spawnT <= 0) {
    R.spawnT = 1.2;
    const d = raidDanger(s);
    for (let i = 0; i < 2 && R.queue.length; i++) {
      const type = R.queue.pop();
      const a = R.ang + (rand(s) - 0.5) * 1.6, r = hqSafeRadius(s) + 420 + rand(s) * 120;
      const x = clamp(CENTER.x + Math.cos(a) * r, 30, WORLD.w - 30), y = clamp(CENTER.y + Math.sin(a) * r, 30, WORLD.h - 30);
      const z = makeZombie(s, type, x, y, d, { raid: true });
      R.hpTotal += z.max;
      s.zombies.push(z);
    }
  }
  if (s.wall <= 0) {
    const lost = {};
    for (const k of RES_KEYS) { lost[k] = Math.floor(s.res[k] * RAID_LOSS); s.res[k] -= lost[k]; }
    s.zombies = s.zombies.filter((z) => !z.raid);
    s.wall = max * 0.25;
    s.raid = null;
    s.raidT = 300 + rand(s) * 180;
    s.stats.raidsLost++;
    ev.push({ t: 'raid-lost', lost });
    return;
  }
  if (!R.queue.length && !s.zombies.some((z) => z.raid)) {
    const reward = { scrap: Math.round(R.hpTotal / 8), wood: Math.round(R.hpTotal / 14), plastic: Math.round(R.hpTotal / 14) };
    for (const k of RES_KEYS) s.res[k] += reward[k];
    reward.item = 'toolbox';
    addItem(s, 'toolbox');
    reward.ammo = Math.min(AMMO_MAX - s.ammo, raidAmmo(s));
    s.ammo += reward.ammo;
    s.raid = null;
    s.raidT = 300 + rand(s) * 180;
    s.stats.raidsWon++;
    ev.push({ t: 'raid-won', reward });
  }
}

// ---------- 필드 시뮬레이션 ----------
function makeZombie(s, type, x, y, d, extra = {}) {
  const st = zombieStats(type, d, zoneIndex(dangerAt(x, y)));
  return { id: s.zid++, type, x, y, hp: st.hp, max: st.hp, dmg: st.dmg, speed: st.speed, atkCd: st.atkCd, r: st.r, d, atk: 0.6, wa: rand(s) * TAU, wt: 0, hit: 0, ...extra };
}

// input: 조이스틱 벡터 {x, y}(길이 ≤ 1, 월드 좌표계) 또는 null. 반환값은 화면 효과용 이벤트 목록.
export function step(s, dt, input = null) {
  // 로그라이크: 쓰러지면 그 판은 끝이다. 게임 오버 뒤에는 세계가 멈춘다.
  if (s.over) return [];
  const ev = [];
  s.time += dt;
  s.stats.playTime += dt;
  const prod = productionPerSec(s);
  for (const r of RES_KEYS) s.res[r] += prod[r] * dt;
  makeAmmo(s, dt);
  advanceJobs(s, dt, ev);
  updateRaid(s, dt, ev);

  const P = s.player;
  if (P.buff > 0) P.buff = Math.max(0, P.buff - dt);
  if (P.stim > 0) P.stim = Math.max(0, P.stim - dt);
  // 재장전은 예비 탄약이 있을 때만. 탄창도 예비도 비면 총을 못 쓴다(한 번 알린다). 총기 사용을 끄면 새로 재장전하지 않는다.
  const gun = s.gunOn && s.equip.gun && WEAPONS[s.equip.gun];
  if (P.reload > 0) {
    P.reload -= dt;
    if (P.reload <= 0) { loadMag(s); ev.push({ t: 'reloaded' }); }
  } else if (gun && P.mag <= 0) {
    if (s.ammo > 0) { P.reload = gun.reload; ev.push({ t: 'reload' }); s.noAmmo = false; }
    else if (!s.noAmmo) { s.noAmmo = true; ev.push({ t: 'no-ammo' }); }
  }
  // 1) 이동: 손가락 입력이 자동사냥·목적지 이동보다 우선
  let mx = 0, my = 0;
  if (input && (input.x || input.y)) {
    mx = input.x; my = input.y;
    s.autoTarget = null;
    s.waypoint = null;
  } else if (s.autoHunt || s.waypoint) {
    ({ x: mx, y: my } = autoSteer(s, dt));
  }
  const mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; }
  P.moving = mag > 0.05;
  if (P.moving) P.face = Math.atan2(my, mx);
  const speed = PLAYER_SPEED * (P.buff > 0 ? 1.4 : 1) * (P.stim > 0 ? STIM_MULT : 1);
  P.x = clamp(P.x + mx * speed * dt, 20, WORLD.w - 20);
  P.y = clamp(P.y + my * speed * dt, 20, WORLD.h - 20);
  pushOutOfObstacles(s, P, 10);

  // 2) 안전지대: 가방 비우기 + 회복
  const mh = maxHp(s);
  const safe = safeZoneAt(s, P.x, P.y);
  if (safe) {
    if (bagTotal(s) > 0) {
      const got = { ...s.bag };
      for (const k of RES_KEYS) { s.res[k] += s.bag[k]; s.bag[k] = 0; }
      ev.push({ t: 'deposit', got, where: safe.kind });
    }
    P.hp = Math.min(mh, P.hp + (15 + 5 * s.bld.clinic) * dt);
  } else {
    P.hp = Math.min(mh, P.hp + 0.4 * dt);
  }

  autoRepair(s, ev);
  gatherNodes(s, dt, ev);
  updateRescue(s, dt, ev);
  spawnZombies(s, dt);
  moveZombies(s, dt, ev);
  playerAttack(s, dt, ev);
  defend(s, dt, ev);
  escort(s, dt, ev);
  collectKills(s, ev);

  if (s.autoHunt && P.hp > 0 && P.hp < mh * AUTO_MEDKIT_HP && s.items.medkit > 0 && useItem(s, 'medkit').ok) ev.push({ t: 'item-auto', id: 'medkit' });
  if (P.hp <= 0) {
    // 로그라이크: 사망하면 게임 오버. 기록만 남기고 다음 판은 새 지도에서 처음부터.
    P.hp = 0;
    P.dead = 1;
    s.gather = null;
    s.autoRetreat = false;
    s.waypoint = null;
    s.stats.deaths++;
    s.over = { at: Date.now(), summary: runSummary(s) };
    ev.push({ t: 'gameover', summary: s.over.summary });
  }
  checkEnding(s, ev);
  return ev;
}

// ---------- 생존자(플레이어 캐릭터) ----------
// 새 판마다 4명 중 하나를 고르고 이름을 붙인다(추천 이름 또는 직접 입력). 쓰러지거나 엔딩을 보면 이 이름으로 기록이 남는다.
export const HEROES = {
  youngM: { label: '젊은 남자', age: '20대', names: ['민준', '도윤', '지호', '현우'] },
  oldM: { label: '중년 남자', age: '50대', names: ['영수', '성호', '정훈', '상철'] },
  youngF: { label: '젊은 여자', age: '20대', names: ['서연', '하은', '수아', '예린'] },
  oldF: { label: '중년 여자', age: '50대', names: ['미경', '은정', '혜숙', '정숙'] },
};
export const HERO_NAME_MAX = 10;
export const cleanName = (name) => String(name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, HERO_NAME_MAX);
export function setHero(s, id, name) {
  if (!Object.hasOwn(HEROES, id)) return fail('없는 생존자예요');
  const n = cleanName(name);
  if (!n) return fail('이름을 정해 주세요');
  s.hero = { id, name: n, runId: String(s.seed) }; // 판 번호 = 시드(새 판마다 다르다)
  return ok(`${n}(${HEROES[id].label}) · 새 판 시작`);
}

// ---------- 엔딩 ----------
// 목표 8개 중 3개 이상을 달성하고 그중 필수 목표(기지·동료·전진기지)가 하나 이상이면 엔딩이다. 한 판에 한 번 뜨고, 이어서 계속할 수 있다.
// 목표: 사람 기준 2~3시간에 엔딩. 사람은 손으로 파밍하고 멈춰 고르므로 봇의 약 1.2~1.8배가 걸린다고 보고, 봇이 100~110분쯤 닿게 맞췄다.
export const ENDING_NEED = 3;
export const ENDING_GOALS = [
  { id: 'hq', req: true, name: '재건된 거점', desc: '본부 7레벨', goal: 7, progress: (s) => s.hq },
  { id: 'crew', req: true, name: '생존자 공동체', desc: '동료 14명', goal: 14, progress: (s) => s.survivors.length },
  { id: 'network', req: true, name: '개척 거점망', desc: '전진기지 3곳, 모두 3레벨', goal: 3, progress: (s) => s.outposts.filter((o) => o.lv >= OUTPOST_MAX_LV).length },
  { id: 'elite', name: '학살자 사냥꾼', desc: '상급 좀비(거구·학살자) 100마리 처치', goal: 100, progress: (s) => s.stats.eliteKills },
  { id: 'military', name: '군사 구역 정복', desc: '군사 구역에서 100번 파밍', goal: 100, progress: (s) => s.stats.militaryLoot },
  { id: 'fortress', name: '난공불락', desc: '기지 습격 12회 방어', goal: 12, progress: (s) => s.stats.raidsWon },
  { id: 'master', name: '명장', desc: '무기 하나를 +6까지 강화', goal: 7, progress: (s) => Math.max(1, ...Object.values(s.weapons)) },
  { id: 'veteran', name: '베테랑', desc: '플레이어 레벨 30', goal: 30, progress: (s) => s.level },
];
export const goalDone = (s, g) => g.progress(s) >= g.goal;
export function endingStatus(s) {
  const done = ENDING_GOALS.filter((g) => goalDone(s, g)), req = done.some((g) => g.req);
  return { done, req, count: done.length, reached: req && done.length >= ENDING_NEED };
}
function checkEnding(s, ev) {
  if (s.ended || s.over) return;
  const st = endingStatus(s);
  if (!st.reached) return;
  s.ended = { at: Math.floor(s.stats.playTime), goals: st.done.map((g) => g.id) };
  ev.push({ t: 'ending', goals: s.ended.goals, summary: runSummary(s) });
}

// 한 판의 결과(게임 오버 화면·최고 기록용)
export function runSummary(s) {
  return {
    playTime: Math.floor(s.stats.playTime),
    level: s.level,
    kills: s.stats.kills,
    hq: s.hq,
    rescued: s.stats.rescued,
    raidsWon: s.stats.raidsWon,
    outposts: s.outposts.length,
    looted: s.stats.looted,
    missions: Object.keys(s.claimed).length,
  };
}
export const RECORD_KEYS = ['playTime', 'level', 'kills', 'hq', 'rescued', 'raidsWon'];

// 최고 기록 합치기: 판을 넘어 남는 것은 이것뿐이다(게임 진행에는 영향 없음).
export function mergeRecords(rec, summary) {
  const out = { runs: (Number.isFinite(rec?.runs) ? rec.runs : 0) + 1 }, beaten = [];
  for (const k of RECORD_KEYS) {
    const prev = Number.isFinite(rec?.[k]) ? rec[k] : 0;
    out[k] = Math.max(prev, summary[k]);
    if (summary[k] > prev) beaten.push(k);
  }
  return { records: out, beaten };
}

function gatherNodes(s, dt, ev) {
  const P = s.player;
  let node = null, bd = GATHER_RANGE;
  for (const n of s.nodes) {
    if (n.readyAt > s.time) continue;
    const d = dist(P.x, P.y, n.x, n.y);
    if (d < bd) { bd = d; node = n; }
  }
  if (!node) { s.gather = null; return; }
  if (!s.gather || s.gather.node !== node) s.gather = { node, prog: 0 };
  s.gather.prog += (dt / LOOT_TYPES[node.type].time) * (P.stim > 0 ? STIM_MULT : 1);
  if (s.gather.prog < 1) return;

  const room = bagCap(s) - bagTotal(s);
  if (room <= 0) {
    s.gather.prog = 1;
    if (!s.bagFullWarned) ev.push({ t: 'bagfull' });
    s.bagFullWarned = true;
    return;
  }
  s.bagFullWarned = false;
  s.gather = null;
  const got = Math.min(node.amt, room);
  s.bag[node.res] += got;
  s.stats.looted++;
  const zone = zoneIndex(node.d);
  if (zone === ZONE_NAMES.length - 1) s.stats.militaryLoot++;
  ev.push({ t: 'loot', type: node.type, res: node.res, amt: got, x: node.x, y: node.y });
  if (s.ammo < AMMO_MAX && rand(s) < ammoChance(node.d)) {
    const n = Math.min(AMMO_MAX - s.ammo, ammoDrop(node.d));
    s.ammo += n;
    ev.push({ t: 'ammo', n, x: node.x, y: node.y });
  }
  const pool = LOOT_TYPES[node.type].items;
  if (rand(s) < itemDropChance(node.d)) {
    const id = pool[Math.floor(rand(s) * pool.length)];
    if (addItem(s, id)) ev.push({ t: 'item', id, x: node.x, y: node.y });
  }
  for (const [id, w] of Object.entries(WEAPONS)) {
    if (w.source !== 'loot' || s.weapons[id] || !w.find.includes(node.type) || zone < w.minZone) continue;
    if (rand(s) < w.chance) { gainWeapon(s, id); ev.push({ t: 'weapon-found', id, x: node.x, y: node.y }); break; }
  }
  // 리스폰은 같은 구역 안 무작위 자리에서(옮긴 자리 기준 리스폰 시간)
  relocateNode(s, node);
  node.readyAt = s.time + node.respawn;
}

// 구출 이벤트: 'stranded'(조난자, 다가가면 합류) 또는 'siege'(좀비에 포위, 주변 좀비를 모두 잡아야 합류).
export const dormFull = (s) => s.survivors.length >= survivorCap(s);

// 자동 포위 구출 판단: 내 근접 공격으로 포위 좀비를 다 정리하는 동안 받을 피해가 지금 체력의 60% 미만이면 들어간다.
export function canBreakSiege(s) {
  const zs = s.zombies.filter((z) => z.siege && z.hp > 0);
  if (!zs.length) return true;
  const mel = meleeId(s), dps = weaponDamage(s, mel) / WEAPONS[mel].cd * (1 + CRIT_CHANCE * (CRIT_MULT - 1));
  const gunDps = s.equip.gun && (s.player.mag > 0 || s.ammo > 0) ? weaponDamage(s, s.equip.gun) / WEAPONS[s.equip.gun].cd * 0.6 : 0; // 명중률 감안
  const hpTotal = zs.reduce((a, z) => a + z.hp, 0), clearTime = hpTotal / Math.max(dps, gunDps * 0.7);
  // 한꺼번에 붙는 좀비는 절반쯤으로 본다
  const incoming = zs.reduce((a, z) => a + z.dmg / (z.atkCd ?? ZOMBIE_ATK_CD), 0) * 0.5 * (1 - playerGuard(s));
  return clearTime * incoming < s.player.hp * 0.6;
}

// 지금 떠 있는 구조 신호의 상태(화면 표시용)
export function rescueStatus(s) {
  const R = s.rescue;
  if (!R) return null;
  const besiegers = R.kind === 'siege' ? s.zombies.filter((z) => z.siege && z.hp > 0).length : 0;
  const d = dist(s.player.x, s.player.y, R.x, R.y);
  return { kind: R.kind, besiegers, ttl: R.ttl, full: dormFull(s), dist: d, near: d < (R.kind === 'siege' ? SIEGE_NEAR_R : RESCUE_R) };
}

function updateRescue(s, dt, ev) {
  const P = s.player;
  if (!s.rescue) {
    s.rescueT -= dt;
    if (s.rescueT > 0) return;
    // 숙소가 가득 차면 데려올 수 없으니 새 신호를 띄우지 않고 10초마다 다시 본다
    if (dormFull(s)) { s.rescueT = 10; return; }
    s.rescueT = 60 + rand(s) * 50;
    const maxD = Math.min(ZONE_NAMES.length, s.autoZone + 1.6);
    for (let i = 0; i < 8; i++) {
      const a = rand(s) * TAU, r = (1.1 + rand(s) * (maxD - 1.1)) * ZONE_SIZE;
      if (placeRescue(s, CENTER.x + Math.cos(a) * r, CENTER.y + Math.sin(a) * r, rand(s) < 0.5 ? 'stranded' : 'siege', ev)) return;
    }
    return;
  }
  const R = s.rescue;
  if (R.kind === 'siege') {
    // 멀리 끌려간 좀비는 포위에서 빠진다(어딘가에 남아 구출을 영영 막지 않게)
    for (const z of s.zombies) if (z.siege && dist(z.x, z.y, R.x, R.y) > SIEGE_LEASH_R) z.siege = false;
  }
  const besiegers = R.kind === 'siege' ? s.zombies.filter((z) => z.siege && z.hp > 0).length : 0;
  if (R.kind === 'stranded' || besiegers > 0) R.ttl -= dt;
  if (R.ttl <= 0) {
    for (const z of s.zombies) z.siege = false;
    ev.push({ t: 'rescue-failed', kind: R.kind });
    s.rescue = null;
    return;
  }
  const near = dist(P.x, P.y, R.x, R.y) < (R.kind === 'siege' ? SIEGE_NEAR_R : RESCUE_R);
  if (besiegers > 0 || !near || P.dead) return;
  if (dormFull(s)) {
    // 근처에 있는 동안 8초마다 다시 알린다
    R.warnT = (R.warnT ?? 0) - dt;
    if (R.warnT <= 0) { ev.push({ t: 'dorm-full', cap: survivorCap(s) }); R.warnT = 8; }
    return;
  }
  const v = makeSurvivor(s, R.d);
  if (defenders(s).length < defenseSlots(s)) v.post = 'defense';
  s.survivors.push(v);
  s.stats.rescued++;
  s.rescue = null;
  // 포위에서 구한 생존자는 감사의 뜻으로 아이템을 하나 준다
  const gift = R.kind === 'siege' ? ITEM_KEYS[Math.floor(rand(s) * ITEM_KEYS.length)] : null;
  if (gift) addItem(s, gift);
  ev.push({ t: 'rescued', name: v.name, role: v.role, rarity: v.rarity, post: v.post, kind: R.kind, gift });
}

function placeRescue(s, x, y, kind, ev) {
  if (x < 80 || y < 80 || x > WORLD.w - 80 || y > WORLD.h - 80 || safeZoneAt(s, x, y, 60) || insideObstacle(s, x, y, 40)) return false;
  const d = Math.max(1, dangerAt(x, y));
  s.rescue = { kind, x, y, d, ttl: kind === 'siege' ? SIEGE_HOLD_S : 240 };
  if (kind === 'siege') {
    const n = 3 + Math.floor(d * 1.5);
    for (let k = 0; k < n; k++) {
      const b = (k / n) * TAU, rr = 55 + rand(s) * 35;
      s.zombies.push(makeZombie(s, pickZombieType(s, d), x + Math.cos(b) * rr, y + Math.sin(b) * rr, d, { siege: true }));
    }
  }
  ev.push({ t: 'rescue-spawn', kind });
  return true;
}

// 구조 신호탄: 플레이어 주변 250~400px에 조난자를 부른다.
function spawnRescueNear(s, px, py, ev) {
  for (let i = 0; i < 10; i++) {
    const a = rand(s) * TAU, r = 250 + rand(s) * 150;
    if (placeRescue(s, px + Math.cos(a) * r, py + Math.sin(a) * r, 'stranded', ev)) return true;
  }
  return false;
}

function spawnZombies(s, dt) {
  const P = s.player;
  const target = fieldPopulation(dangerAt(P.x, P.y));
  s.spawnT -= dt;
  if (s.spawnT > 0) return;
  if (s.zombies.filter((z) => !z.raid && !z.siege).length >= target) return;
  s.spawnT = SPAWN_INTERVAL_S;
  for (let i = 0; i < 6; i++) {
    const a = rand(s) * TAU, r = 430 + rand(s) * 220;
    const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
    if (x < 40 || y < 40 || x > WORLD.w - 40 || y > WORLD.h - 40 || safeZoneAt(s, x, y, 40) || insideObstacle(s, x, y, 18)) continue;
    const d = dangerAt(x, y);
    s.zombies.push(makeZombie(s, pickZombieType(s, d), x, y, d));
    return;
  }
}

function moveZombies(s, dt, ev) {
  const P = s.player, alive = !P.dead, zones = safeZones(s), hqR = hqSafeRadius(s);
  // 플레이어가 기지·전진기지 안에 숨으면 일반 좀비는 추격을 포기한다(방벽 앞에 몰려 대기하지 않게)
  const hidden = !!safeZoneAt(s, P.x, P.y);
  for (const z of s.zombies) {
    z.hit = Math.max(0, z.hit - dt);
    const dp = dist(z.x, z.y, P.x, P.y);
    // 목표: 플레이어가 가까우면 플레이어, 아니면 습격 좀비는 본부, 포위 좀비는 생존자
    let tx = null, ty = null, chase = false, sp = z.speed;
    if (alive && dp < (z.raid ? 150 : z.siege ? 220 : 420) && (z.raid || !hidden)) { tx = P.x; ty = P.y; chase = true; }
    else if (z.raid) { tx = CENTER.x; ty = CENTER.y; }
    else if (z.siege && s.rescue) { tx = s.rescue.x; ty = s.rescue.y; }
    let vx = 0, vy = 0;
    if (tx !== null) {
      const d = dist(z.x, z.y, tx, ty) || 1;
      vx = (tx - z.x) / d; vy = (ty - z.y) / d;
      if (z.siege && !chase && d < 50) { vx = 0; vy = 0; }
      ({ x: vx, y: vy } = avoidObstacles(s, z.x, z.y, vx, vy, z.r));
    } else {
      z.wt -= dt;
      if (z.wt <= 0) { z.wa = rand(s) * TAU; z.wt = 2 + rand(s) * 3; }
      vx = Math.cos(z.wa); vy = Math.sin(z.wa); sp *= 0.35;
    }
    const atWall = z.raid && dist(z.x, z.y, CENTER.x, CENTER.y) <= hqR + z.r + 3;
    if (chase && dp < z.r + 14) {
      z.atk -= dt;
      if (z.atk <= 0) { z.atk = z.atkCd ?? ZOMBIE_ATK_CD; const dmg = z.dmg * (1 - playerGuard(s)); P.hp -= dmg; ev.push({ t: 'hurt', dmg }); }
    } else if (atWall && !chase) {
      z.atk -= dt;
      if (z.atk <= 0) { z.atk = z.atkCd ?? ZOMBIE_ATK_CD; s.wall -= z.dmg; ev.push({ t: 'wall-hit', x: z.x, y: z.y, dmg: z.dmg }); }
    } else {
      z.x += vx * sp * dt; z.y += vy * sp * dt;
    }
    pushOutOfObstacles(s, z, z.r);
    // 좀비는 바리케이드(안전지대) 안으로 못 들어온다
    for (const q of zones) {
      const d = dist(z.x, z.y, q.x, q.y), min = q.r + z.r;
      if (d < min) { const k = min / (d || 1); z.x = q.x + (z.x - q.x) * k; z.y = q.y + (z.y - q.y) * k; }
    }
  }
  // 겹침 풀기
  const zs = s.zombies;
  for (let i = 0; i < zs.length; i++) {
    for (let j = i + 1; j < zs.length; j++) {
      const a = zs[i], b = zs[j], d = dist(a.x, a.y, b.x, b.y), min = a.r + b.r;
      if (d > 0 && d < min) {
        const push = (min - d) / 2, ux = (a.x - b.x) / d, uy = (a.y - b.y) / d;
        a.x += ux * push; a.y += uy * push; b.x -= ux * push; b.y -= uy * push;
      }
    }
  }
  // 멀어진 떠돌이 좀비만 지운다. 습격·포위 좀비는 끝까지 남는다.
  s.zombies = zs.filter((z) => z.raid || z.siege || dist(z.x, z.y, P.x, P.y) < 1100);
}

function nearestZombie(s, x, y, range) {
  let best = null, bd = range;
  for (const z of s.zombies) {
    if (z.hp <= 0) continue;
    const d = dist(x, y, z.x, z.y) - z.r;
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}

export const playerGuard = (s) => Math.min(0.6, (WEAPONS[meleeId(s)].guard ?? 0) + (s.equip.gun ? WEAPONS[s.equip.gun].guard ?? 0 : 0));

// by: 'player', 'post'(방어 동료), 'escort'(탐험 동료). 마지막으로 때린 쪽이 처치로 친다.
function hit(s, z, dmg, ev, splash = 0, critBonus = 0, by = 'player') {
  const crit = rand(s) < CRIT_CHANCE + critBonus;
  if (crit) dmg *= CRIT_MULT;
  z.hp -= dmg;
  z.hit = 0.12;
  z.by = by;
  ev.push({ t: 'dmg', x: z.x, y: z.y, dmg, crit });
  if (!splash) return dmg;
  let total = dmg;
  for (const o of s.zombies) {
    if (o !== z && o.hp > 0 && dist(o.x, o.y, z.x, z.y) < splash) { o.hp -= dmg * 0.6; o.hit = 0.12; o.by = by; total += dmg * 0.6; }
  }
  return total;
}

export function gainXp(s, xp, ev = []) {
  if (s.level >= LEVEL_MAX) return 0;
  s.xp += xp;
  let ups = 0;
  while (s.level < LEVEL_MAX && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    ups++;
    const hp = rollGrowth(s, HP_PER_LEVEL), atk = rollGrowth(s, ATK_PER_LEVEL), bag = rollGrowth(s, BAG_PER_LEVEL, BAG_SPREAD);
    s.growth.hp += hp;
    s.growth.atk += atk;
    s.growth.bag += bag;
    s.player.hp = maxHp(s); // 레벨업하면 체력을 모두 회복한다
    ev.push({ t: 'levelup', level: s.level, hp, atk, bag });
  }
  if (s.level >= LEVEL_MAX) s.xp = 0;
  return ups;
}

// 가까우면 근접무기, 멀면 총기(탄창에 탄이 있고 재장전 중이 아닐 때). 공격은 늘 자동이다.
export function chooseAttack(s, z) {
  const P = s.player, d = dist(P.x, P.y, z.x, z.y) - z.r;
  const mid = meleeId(s), mel = WEAPONS[mid];
  if (d <= mel.range) return { id: mid, w: mel };
  const gid = s.equip.gun;
  if (gunReady(s) && d <= WEAPONS[gid].range) return { id: gid, w: WEAPONS[gid] };
  return null;
}

function playerAttack(s, dt, ev) {
  const P = s.player;
  P.cd -= dt;
  if (P.cd > 0) return;
  // 공격 반경 = 쏠 수 있으면 총 사거리, 아니면 근접 사거리(좀비 전략과 상관없이 같다)
  const melee = WEAPONS[meleeId(s)].range;
  const reach = gunReady(s) ? WEAPONS[s.equip.gun].range : melee;
  const z = nearestZombie(s, P.x, P.y, reach);
  if (!z) return;
  const a = chooseAttack(s, z);
  if (!a) return;
  P.face = Math.atan2(z.y - P.y, z.x - P.x);
  P.cd = a.w.cd * (P.buff > 0 ? 0.7 : 1);
  if (a.w.kind === 'gun') {
    P.mag--;
    // 명중률: 멀수록 빗나간다. 빗나가도 탄은 쓴다.
    if (rand(s) >= gunAccuracy(dist(P.x, P.y, z.x, z.y) - z.r, a.w.range)) {
      const o = (rand(s) < 0.5 ? -1 : 1) * (z.r + 8 + rand(s) * 14);
      ev.push({ t: 'shot', x1: P.x, y1: P.y, x2: z.x + o, y2: z.y - o, who: 'player', weapon: a.id, miss: true });
      ev.push({ t: 'miss', x: z.x, y: z.y });
      return;
    }
  } else if (a.w.dur) {
    s.dur[a.id] = Math.max(0, (s.dur[a.id] ?? 0) - 1);
    if (s.dur[a.id] === 0) ev.push({ t: 'broken', id: a.id });
  }
  const dealt = hit(s, z, weaponDamage(s, a.id), ev, a.w.cleave || a.w.splash || 0, a.w.crit ?? 0);
  if (a.w.leech) P.hp = Math.min(maxHp(s), P.hp + dealt * a.w.leech);
  ev.push({ t: a.w.kind === 'gun' ? 'shot' : 'swing', x1: P.x, y1: P.y, x2: z.x, y2: z.y, who: 'player', weapon: a.id });
}

// 방어 배치 동료는 본부 방벽 둘레에 서서 사거리 안의 좀비를 공격한다. 의무병·기술자는 습격 중 방벽을 보수한다.
export function postPosition(s, i, n) {
  const a = (i / Math.max(1, n)) * TAU - Math.PI / 2, r = hqSafeRadius(s) - 8;
  return { x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r };
}

function defend(s, dt, ev) {
  const D = defenders(s), mult = defenseMult(s), max = wallMax(s);
  D.forEach((v, i) => {
    const pos = postPosition(s, i, D.length);
    const c = (s.posts[v.id] ??= { cd: 0.3, face: 0 });
    c.x = pos.x; c.y = pos.y;
    const R = ROLES[v.role], pw = survivorPower(v);
    if (s.raid && R.repair) s.wall = Math.min(max, s.wall + R.repair * pw * dt);
    c.cd -= dt;
    if (c.cd > 0) return;
    const z = nearestZombie(s, c.x, c.y, R.range);
    if (!z) return;
    c.cd = 1 / survivorRate(v);
    c.face = Math.atan2(z.y - c.y, z.x - c.x);
    hit(s, z, survivorHit(v) * mult, ev, 0, 0, 'post');
    ev.push({ t: R.ranged ? 'shot' : 'swing', x1: c.x, y1: c.y, x2: z.x, y2: z.y, who: 'post' });
  });
}

// 탐험 동행 동료는 플레이어를 따라다니며 직업 사거리 안의 좀비를 공격한다.
// 원거리 직업은 명중률을 따르고, 탄약·내구도는 쓰지 않는다. 좀비는 동료를 노리지 않는다.
export const ESCORT_XP = 0.5; // 동료가 잡은 좀비 경험치 중 플레이어가 받는 몫
export const ESCORT_SPEED = PLAYER_SPEED * 2.2; // 자극제·음료를 쓴 플레이어도 따라잡는다
export const ESCORT_GAP = 36; // 플레이어와 유지하는 거리(두 번째 동료는 더 뒤)
export const ESCORT_LEASH = 520; // 이보다 멀어지면 플레이어 곁으로 합류
function escort(s, dt, ev) {
  const P = s.player;
  if (P.dead) return;
  const E = escorts(s);
  E.forEach((v, i) => {
    const gap = ESCORT_GAP + 20 * i;
    let c = s.posts[v.id];
    if (!c || dist(c.x, c.y, P.x, P.y) > ESCORT_LEASH) {
      const a = (P.face ?? 0) + Math.PI + (i ? -0.6 : 0.6);
      c = s.posts[v.id] = { cd: 0.5, face: P.face ?? 0, moving: false, x: P.x + Math.cos(a) * gap, y: P.y + Math.sin(a) * gap };
      pushOutOfObstacles(s, c, 10);
    }
    // 따라가기: 정해진 거리보다 멀면 플레이어 쪽으로, 동료끼리는 겹치지 않게 벌린다
    const d = dist(c.x, c.y, P.x, P.y) || 1;
    let vx = 0, vy = 0;
    if (d > gap + 4) { const k = Math.min(ESCORT_SPEED, (d - gap) * 4) / d; vx = (P.x - c.x) * k; vy = (P.y - c.y) * k; }
    for (const o of [P, ...E.slice(0, i).map((u) => s.posts[u.id])]) {
      const q = dist(c.x, c.y, o.x, o.y);
      if (q < 22 && q > 0.01) { vx += ((c.x - o.x) / q) * 60; vy += ((c.y - o.y) / q) * 60; }
    }
    const sp = Math.hypot(vx, vy);
    c.moving = sp > 8;
    if (c.moving) {
      const u = avoidObstacles(s, c.x, c.y, vx / sp, vy / sp, 10);
      c.x = clamp(c.x + u.x * sp * dt, 20, WORLD.w - 20);
      c.y = clamp(c.y + u.y * sp * dt, 20, WORLD.h - 20);
      pushOutOfObstacles(s, c, 10);
      if (c.cd <= 0) c.face = Math.atan2(vy, vx);
    }
    c.cd -= dt;
    if (c.cd > 0) return;
    const R = ROLES[v.role];
    const z = nearestZombie(s, c.x, c.y, R.range);
    if (!z) return;
    c.cd = 1 / survivorRate(v);
    c.face = Math.atan2(z.y - c.y, z.x - c.x);
    if (R.ranged && rand(s) >= gunAccuracy(dist(c.x, c.y, z.x, z.y) - z.r, R.range)) {
      const o = (rand(s) < 0.5 ? -1 : 1) * (z.r + 8 + rand(s) * 14);
      ev.push({ t: 'shot', x1: c.x, y1: c.y, x2: z.x + o, y2: z.y - o, who: 'escort', miss: true });
      return;
    }
    hit(s, z, survivorHit(v), ev, 0, 0, 'escort');
    ev.push({ t: R.ranged ? 'shot' : 'swing', x1: c.x, y1: c.y, x2: z.x, y2: z.y, who: 'escort' });
  });
}

// 좀비는 자원을 떨어뜨리지 않는다. 자원은 대상물·건물·전진기지·습격 방어에서만 나온다.
function collectKills(s, ev) {
  for (const z of s.zombies) {
    if (z.hp > 0) continue;
    s.stats.kills++;
    if (ZTYPES[z.type]?.grade === 2) s.stats.eliteKills++; // 상급(거구·학살자), 누가 잡았든
    const xp = z.by === 'player' ? zombieXp(z) : z.by === 'escort' ? Math.round(zombieXp(z) * ESCORT_XP) : 0;
    ev.push({ t: 'kill', x: z.x, y: z.y, type: z.type, raid: !!z.raid, xp });
    if (xp) gainXp(s, xp, ev);
  }
  s.zombies = s.zombies.filter((z) => z.hp > 0);
}

// ---------- 자동사냥 스위치와 좀비 전략 ----------
// 파밍은 수동이다: 대상물 옆에 서 있으면 줍고, 찾아가는 것은 사람이 한다.
// 자동사냥(autoHunt): 좀비 전략대로 움직임(활동 반경 안), 체력 위급 귀환, 습격 때 본부 복귀, 파손 무기 수리 복귀, 구급상자 자동 사용.
// 공격은 스위치와 상관없이 늘 자동이고, 손가락 조작은 언제나 우선한다.
export const SENSE_R = 260; // 좀비 전략이 반응하는 반경
// 활동 반경: 자동사냥은 이 구역(autoZone) 안에 있는 좀비만 쫓아간다
export const inActivityRadius = (s, x, y) => dangerAt(x, y) < s.autoZone + 1;

// 좀비 전략: 자동사냥이 켜져 있을 때의 움직임을 정한다. 공격은 셋 다 공격 반경(무기 사거리) 안의 좀비를 친다.
export const STANCES = {
  aggressive: { name: '공격적', desc: '좀비를 향해 다가가 공격해요' },
  neutral: { name: '중립적', desc: '좀비가 다가와도 제자리에 서서 공격해요' },
  evasive: { name: '회피적', desc: '다가오는 좀비를 피하고, 공격 반경에 들어온 좀비를 공격해요' },
};
export const STANCE_ORDER = ['aggressive', 'neutral', 'evasive'];
export const EVADE_R = 200; // 회피적일 때 이 거리 안의 좀비에게서 멀어진다

export function setStance(s, id) {
  if (!STANCES[id]) return fail('없는 좀비 전략이에요');
  s.stance = id;
  s.autoTarget = null;
  s.autoT = 0;
  return ok(`좀비 전략: ${STANCES[id].name} · ${STANCES[id].desc}`);
}
export const cycleStance = (s) => setStance(s, STANCE_ORDER[(STANCE_ORDER.indexOf(s.stance) + 1) % STANCE_ORDER.length]);

export function setSwitch(s, which, on) {
  if (which === 'gunOn') {
    s.gunOn = !!on;
    return ok(s.gunOn ? '총기 사용 ON' : '총기 사용 OFF · 근접 무기만 써요');
  }
  if (which !== 'autoHunt') return fail('없는 스위치예요');
  s.autoHunt = !!on;
  s.autoTarget = null;
  s.autoT = 0;
  if (!s.autoHunt) s.autoRetreat = false;
  return ok(`자동사냥 ${on ? 'ON' : 'OFF'}`);
}

// 좀비 전략이 이동을 정하는가: 자동사냥이 켜져 있을 때만(공격 사거리는 늘 따른다)
export const stanceMoves = (s) => s.autoHunt;

// ---------- 자동 이동 ----------
function autoSteer(s, dt) {
  const P = s.player;
  s.autoT -= dt;
  const t = s.autoTarget;
  const stale = !t || (t.kind === 'fight' && t.ref.hp <= 0) || (t.kind === 'travel' && !s.waypoint);
  if (s.autoT <= 0 || stale) { s.autoTarget = chooseAutoTarget(s); s.autoT = 0.4; }
  let gx = 0, gy = 0;
  const g = s.autoTarget;
  if (g) {
    const tx = g.ref ? g.ref.x : g.x, ty = g.ref ? g.ref.y : g.y;
    const d = dist(P.x, P.y, tx, ty);
    let stop = 8;
    if (g.kind === 'fight') {
      stop = gunReady(s) ? WEAPONS[s.equip.gun].range * 0.5 : WEAPONS[meleeId(s)].range * 0.7 + g.ref.r; // 총은 가까이 붙어야 잘 맞는다
    } else if (g.kind === 'home') stop = g.r * 0.4;
    else if (g.kind === 'travel') stop = 30;
    if (d > stop) { gx = (tx - P.x) / d; gy = (ty - P.y) / d; }
  }
  if (s.stance === 'evasive' && stanceMoves(s)) {
    // 가까운 좀비일수록 강하게 밀어내는 힘을 목표 방향에 더한다
    let rx = 0, ry = 0;
    for (const z of s.zombies) {
      if (z.hp <= 0) continue;
      const d = dist(P.x, P.y, z.x, z.y);
      if (d > EVADE_R || d < 1) continue;
      const w = (EVADE_R - d) / EVADE_R;
      rx += ((P.x - z.x) / d) * w; ry += ((P.y - z.y) / d) * w;
    }
    if (Math.hypot(rx, ry) > 0.01) {
      gx += rx * 2.5; gy += ry * 2.5;
      const m = Math.hypot(gx, gy) || 1;
      gx /= m; gy /= m;
    }
  }
  return avoidObstacles(s, P.x, P.y, gx, gy, 10);
}

const homeTarget = (z) => ({ kind: 'home', x: z.x, y: z.y, r: z.r });
// 자동사냥 수리 복귀: 장착한 근접 무기가 파손됐고, 수리점이 있고, 수리비가 있을 때
export const needsRepairTrip = (s) => s.autoHunt && isBroken(s, s.equip.melee) && s.bld.repair > 0 && canAfford(s.res, repairCost(s, s.equip.melee));
// 본부에 들어오면 파손된 장착 무기를 고친다(자동사냥일 때만, 사람이 조작할 때는 무기 탭에서 직접)
function autoRepair(s, ev) {
  if (!s.autoHunt || !isBroken(s, s.equip.melee) || safeZoneAt(s, s.player.x, s.player.y)?.kind !== 'hq') return;
  const id = s.equip.melee, cost = repairCost(s, id), r = repairWeapon(s, id);
  if (r.ok) { s.autoTarget = null; ev.push({ t: 'auto-repair', id, cost }); }
}

export function chooseAutoTarget(s) {
  const P = s.player, hp = P.hp / maxHp(s);
  const here = safeZoneAt(s, P.x, P.y);
  // 자동사냥: 생존 판단이 가장 먼저다
  if (s.autoHunt) {
    if (hp < AUTO_RETREAT_HP) s.autoRetreat = true;
    if (s.autoRetreat && hp >= 0.95) s.autoRetreat = false;
    if (s.autoRetreat) return homeTarget(nearestSafe(s, P.x, P.y));
    if (s.raid && !(here && here.kind === 'hq')) return homeTarget({ x: CENTER.x, y: CENTER.y, r: hqSafeRadius(s) });
    // 근접 무기가 부서지면 본부 수리점으로 돌아간다(고칠 수 있을 때만). 도착하면 step이 알아서 고친다.
    if (needsRepairTrip(s) && !(here && here.kind === 'hq')) return homeTarget({ x: CENTER.x, y: CENTER.y, r: hqSafeRadius(s) });
  }
  // 사람이 지시한 이동(전진기지 후보지 안내·귀환). 귀환은 기지 안에 들어서면 끝나고, 가는 길에 좀비를 쫓지 않는다.
  if (s.waypoint) {
    if (s.waypoint.home && here) { s.waypoint = null; return null; }
    const zt = !s.waypoint.home && stanceMoves(s) && s.stance === 'aggressive' ? nearestZombie(s, P.x, P.y, 120) : null;
    if (zt) return { kind: 'fight', ref: zt };
    if (dist(P.x, P.y, s.waypoint.x, s.waypoint.y) > 40) return { kind: 'travel', x: s.waypoint.x, y: s.waypoint.y };
    s.waypoint = null;
  }
  // 좀비 전략 공격적: 반경 안이면서 활동 반경 안에 있는 좀비를 찾아간다. 없으면 제자리.
  if (stanceMoves(s) && s.stance === 'aggressive') {
    let best = null, bd = SENSE_R;
    for (const z of s.zombies) {
      if (z.hp <= 0 || !inActivityRadius(s, z.x, z.y)) continue;
      const d = dist(P.x, P.y, z.x, z.y);
      if (d < bd) { bd = d; best = z; }
    }
    if (best) return { kind: 'fight', ref: best };
  }
  return null;
}


// ---------- 저장 / 오프라인 ----------
export function serialize(s) {
  return JSON.stringify({
    v: VERSION, world: WORLD.w, sitesV: SITES_VERSION, seed: s.seed, rng: s.rng, savedAt: Date.now(), time: s.time,
    res: s.res, bag: s.bag, hq: s.hq, bld: s.bld, weapons: s.weapons, equip: s.equip, level: s.level, xp: s.xp, growth: s.growth,
    survivors: s.survivors, outposts: s.outposts, wall: s.wall,
    jobs: s.jobs.map((j) => ({ kind: j.kind, key: j.key, next: j.next, t: j.t })),
    raidT: s.raid ? 20 : s.raidT, // 진행 중이던 습격은 다시 열면 20초 뒤 새로 온다
    nodes: s.nodes.map((n) => Math.max(0, Math.round(n.readyAt - s.time))),
    nodeMoves: s.nodes.flatMap((n, i) => (n.moved ? [[i, n.x, n.y]] : [])), // 옮겨진 대상물 자리(나머지는 시드로 다시 만든다)
    player: { x: s.player.x, y: s.player.y, hp: s.player.hp, mag: s.player.mag }, ammo: s.ammo, ammoOn: s.ammoOn, gunOn: s.gunOn, dur: s.dur,
    autoHunt: s.autoHunt, autoZone: s.autoZone, stance: s.stance, stats: s.stats, nextId: s.nextId,
    items: s.items, claimed: s.claimed, over: s.over, ended: s.ended, hero: s.hero,
  });
}

const num = (v, d, lo = 0, hi = Infinity) => (Number.isFinite(v) ? clamp(v, lo, hi) : d);

// 손상되거나 버전이 다른 저장은 버리고(null) 새 게임으로 시작한다. 숫자는 범위를 넘으면 잘라낸다.
export function deserialize(text) {
  let o;
  try { o = JSON.parse(text); } catch { return null; }
  if (!o || o.v !== VERSION || !Number.isFinite(o.seed)) return null;
  const s = newGame(o.seed);
  s.rng = num(o.rng, s.rng, -2147483648, 2147483647) | 0;
  s.savedAt = num(o.savedAt, Date.now());
  s.time = num(o.time, 0);
  for (const k of RES_KEYS) s.res[k] = num(o.res?.[k], s.res[k]);
  for (const k of RES_KEYS) s.bag[k] = num(o.bag?.[k], 0);
  s.hq = Math.floor(num(o.hq, 1, 1, HQ_MAX));
  for (const k of Object.keys(BUILDINGS)) s.bld[k] = Math.floor(num(o.bld?.[k], 0, 0, buildingMax(s, k)));
  s.level = Math.floor(num(o.level, 1, 1, LEVEL_MAX));
  s.xp = num(o.xp, 0, 0, xpToNext(s.level) - 1e-9);
  // 누적 상승치는 가능한 범위로 자르고, 없던 세이브(무작위 상승 이전)는 기준치 평균으로 채운다
  const ups = s.level - 1, lo = 1 - GROWTH_SPREAD, hi = 1 + GROWTH_SPREAD;
  s.growth.hp = num(o.growth?.hp, HP_PER_LEVEL * ups, HP_PER_LEVEL * ups * lo, HP_PER_LEVEL * ups * hi);
  s.growth.atk = num(o.growth?.atk, ATK_PER_LEVEL * ups, ATK_PER_LEVEL * ups * lo, ATK_PER_LEVEL * ups * hi);
  s.growth.bag = num(o.growth?.bag, BAG_PER_LEVEL * ups, BAG_PER_LEVEL * ups * (1 - BAG_SPREAD), BAG_PER_LEVEL * ups * (1 + BAG_SPREAD));
  for (const k of Object.keys(WEAPONS)) {
    const lv = Math.floor(num(o.weapons?.[k], 0, 0, WEAPON_MAX_LV));
    if (lv) s.weapons[k] = lv;
  }
  s.weapons.fist ||= 1;
  for (const kind of ['melee', 'gun']) {
    const id = o.equip?.[kind];
    if (id && s.weapons[id] && WEAPONS[id].kind === kind) s.equip[kind] = id;
  }
  s.survivors = (Array.isArray(o.survivors) ? o.survivors : [])
    .filter((v) => v && ROLES[v.role] && RARITIES[v.rarity])
    .slice(0, survivorCap(s))
    .map((v) => ({ id: Math.floor(num(v.id, 0)), name: String(v.name || '생존자').slice(0, 12), role: v.role, rarity: v.rarity, lv: Math.floor(num(v.lv, 1, 1, MAX_SURVIVOR_LV)), post: Object.hasOwn(POSTS, v.post) ? v.post : 'work' }));
  let posted = 0, going = 0;
  for (const v of s.survivors) {
    if (v.post === 'defense' && ++posted > defenseSlots(s)) v.post = 'work';
    if (v.post === 'explore' && ++going > exploreSlots(s)) v.post = 'work';
  }
  // 후보지가 고정 9곳이던 예전 세이브: 세운 전진기지·전진기지 공사를 같은 구역의 새 후보지로 옮긴다(구역마다 2곳이라 넘치면 버린다)
  const fixedSites = o.sitesV !== SITES_VERSION;
  const siteMap = new Map();
  if (fixedSites) {
    const used = new Set(), olds = Array.isArray(o.outposts) ? o.outposts.map((x) => x?.site) : [];
    for (const i of [...olds, ...OLD_SITE_ZONES.keys()]) {
      if (!Number.isInteger(i) || i < 0 || i >= OLD_SITE_ZONES.length || siteMap.has(i)) continue;
      const k = s.sites.findIndex((q, j) => !used.has(j) && zoneIndex(q.d) === OLD_SITE_ZONES[i]);
      if (k >= 0) { siteMap.set(i, k); used.add(k); }
    }
  }
  const siteOf = (i) => (fixedSites ? siteMap.get(i) ?? -1 : i);
  const seen = new Set();
  s.outposts = (Array.isArray(o.outposts) ? o.outposts : [])
    .map((x) => x && { ...x, site: siteOf(x.site) })
    .filter((x) => x && s.sites[x.site] && !seen.has(x.site) && seen.add(x.site))
    .slice(0, outpostLimit(s))
    .map((x) => ({ site: x.site, lv: Math.floor(num(x.lv, 1, 1, OUTPOST_MAX_LV)) }));
  s.wall = num(o.wall, wallMax(s), 0, wallMax(s));
  // 작업은 지금 레벨의 바로 다음 단계이고, 줄마다 하나뿐이며, 한도 안일 때만 살린다
  for (const j of Array.isArray(o.jobs) ? o.jobs : []) {
    const x = j && JOB_KINDS[j.kind] === 'outpost' ? { ...j, key: siteOf(j.key) } : j;
    const lane = x && Object.hasOwn(JOB_KINDS, x.kind) ? JOB_KINDS[x.kind] : null;
    const cur = lane ? jobLevel(s, x.kind, x.key) : null;
    const nextOk = x.kind === 'odemo' ? x.next === cur : x.next === cur + 1 && x.next <= jobMax(s, x.kind, x.key); // 철거는 지금 레벨 그대로
    if (cur === null || laneJob(s, lane) || !nextOk) continue;
    const total = jobDuration(x.kind, x.key, x.next);
    s.jobs.push({ lane, kind: x.kind, key: x.key, next: x.next, t: num(x.t, total, 0, total), total });
  }
  s.raidT = num(o.raidT, RAID_FIRST_S, 0, 3600);
  // 지도 크기가 다른 예전 세이브(3200): 본부가 지도 가운데로 옮겨졌으니 플레이어도 같은 만큼 옮기고, 대상물 타이머는 버린다(배치가 다르다)
  const sameWorld = o.world === WORLD.w, shift = sameWorld ? 0 : CENTER.x - (Number.isFinite(o.world) ? o.world : 3200) / 2;
  // 옮겨진 대상물 자리: 같은 구역 안일 때만 받아들인다(구역별 수가 변하지 않게)
  const sameNodes = sameWorld && !fixedSites; // 후보지가 바뀌면 대상물 배치도 달라진다
  if (sameNodes && Array.isArray(o.nodeMoves)) for (const m of o.nodeMoves) {
    const n = Array.isArray(m) && Number.isInteger(m[0]) ? s.nodes[m[0]] : null;
    if (!n || !Number.isFinite(m[1]) || !Number.isFinite(m[2])) continue;
    const x = Math.round(clamp(m[1], 60, WORLD.w - 60)), y = Math.round(clamp(m[2], 60, WORLD.h - 60));
    if (zoneIndex(dangerAt(x, y)) !== zoneIndex(n.d)) continue;
    setNodePos(n, x, y);
    n.moved = true;
  }
  if (sameNodes && Array.isArray(o.nodes)) s.nodes.forEach((n, i) => { n.readyAt = s.time + num(o.nodes[i], 0, 0, n.respawn); });
  s.player.x = num(o.player?.x + shift, s.player.x, 20, WORLD.w - 20);
  s.player.y = num(o.player?.y + shift, s.player.y, 20, WORLD.h - 20);
  s.player.hp = num(o.player?.hp, maxHp(s), 1, maxHp(s));
  // 예전 세이브의 단일 '자동' 값은 자동사냥으로 옮긴다(파밍 스위치·자원 파밍 설정은 없어졌다)
  s.autoHunt = typeof o.autoHunt === 'boolean' ? o.autoHunt : o.auto !== false;
  s.autoZone = Math.floor(num(o.autoZone, 1, 0, ZONE_NAMES.length - 1));
  s.stance = STANCES[o.stance] ? o.stance : 'neutral';
  for (const k of Object.keys(s.stats)) s.stats[k] = Math.floor(num(o.stats?.[k], 0));
  if (o.hero && Object.hasOwn(HEROES, o.hero.id) && cleanName(o.hero.name)) s.hero = { id: o.hero.id, name: cleanName(o.hero.name), runId: String(o.hero.runId ?? s.seed) };
  if (o.ended && Number.isFinite(o.ended.at)) s.ended = { at: Math.floor(num(o.ended.at, 0)), goals: (Array.isArray(o.ended.goals) ? o.ended.goals : []).filter((id) => ENDING_GOALS.some((g) => g.id === id)) };
  for (const k of ITEM_KEYS) s.items[k] = Math.floor(num(o.items?.[k], 0, 0, ITEM_MAX));
  for (const m of MISSIONS) if (o.claimed?.[m.id] === true) s.claimed[m.id] = true;
  // 게임 오버로 끝난 판이면 결과 화면을 다시 보여 주도록 그대로 둔다
  if (o.over && typeof o.over === 'object') {
    const sum = runSummary(s);
    for (const k of Object.keys(sum)) sum[k] = Math.floor(num(o.over.summary?.[k], sum[k]));
    s.over = { at: num(o.over.at, Date.now()), summary: sum };
    s.player.dead = 1;
    s.player.hp = 0;
  }
  s.nextId = Math.max(Math.floor(num(o.nextId, 1)), ...s.survivors.map((v) => v.id + 1), 1);
  // 탄약·내구도: 예전 세이브(무한 탄창 시절)는 총이 있으면 예비 30발, 근접 무기는 내구도 가득으로 시작
  const ownsGun = Object.keys(s.weapons).some((k) => WEAPONS[k].kind === 'gun');
  s.ammo = Math.floor(num(o.ammo, ownsGun ? 30 : 0, 0, AMMO_MAX));
  s.ammoOn = o.ammoOn !== false;
  s.gunOn = o.gunOn !== false;
  const g = s.equip.gun && WEAPONS[s.equip.gun];
  s.player.mag = g ? Math.floor(num(o.player?.mag, o.ammo === undefined ? g.mag : 0, 0, g.mag)) : 0;
  for (const k of Object.keys(s.weapons)) if (WEAPONS[k].dur) s.dur[k] = Math.floor(num(o.dur?.[k], maxDurability(s, k), 0, maxDurability(s, k)));
  return s;
}

// 자리를 비운 동안: 작업 타이머는 최대 8시간 흐르고, 기지·전진기지 생산·총알 제작은 최대 30분어치만 쌓는다. 플레이어는 본부에서 쉰 것으로 친다.
// 습격은 게임을 켜 둔 동안에만 온다(The Last Spark hordes.js:7,76 관측과 같은 방식). 타이머만 줄고 최소 30초 여유를 남긴다.
// 건설·강화 같은 작업은 자리를 비운 시간만큼 그대로 진행된다(짧게 비워도). done = 그동안 끝난 작업 이름.
export function applyOffline(s, now = Date.now()) {
  const elapsed = clamp((now - s.savedAt) / 1000, 0, OFFLINE_CAP_S);
  s.savedAt = now;
  if (s.over) return null;
  const done = advanceJobs(s, elapsed).map((e) => e.name);
  if (elapsed < 30) return done.length ? { elapsed, gains: null, done } : null;
  const prodS = Math.min(elapsed, OFFLINE_PROD_CAP_S), prod = productionPerSec(s), gains = {};
  for (const k of RES_KEYS) { gains[k] = prod[k] * prodS + s.bag[k]; s.res[k] += gains[k]; s.bag[k] = 0; }
  const ammo = makeAmmo(s, prodS);
  s.time += elapsed;
  s.wall = wallMax(s);
  if (raidsEnabled(s)) s.raidT = Math.max(30, s.raidT - elapsed);
  s.player.x = CENTER.x; s.player.y = CENTER.y + 20; s.player.hp = maxHp(s); s.player.dead = 0;
  resetTransient(s);
  return { elapsed, prodS, gains, done, ammo };
}
