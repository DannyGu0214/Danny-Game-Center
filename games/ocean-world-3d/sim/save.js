// 저장 형식. 상태 S는 JSON으로 그대로 저장할 수 있는 순수 데이터다(사건 목록 events·캐시 rev·시간 단계 나머지 acc는 저장하지 않는다).
// 세이브에는 형식 버전(v), 규칙 기반 버전(base), 생태계 id(eco)를 함께 적는다(DESIGN 10절: 나중에 다른 생태계·게임과 형식을 맞추기 쉽게).
export const SAVE_VERSION = 1;
export const SAVE_KEYS = [
  'v', 'base', 'eco', 'rng', 'time', 'savedAt', 'tier', 'pop', 'earned',
  'items', 'animals', 'requests', 'reqSwapAt', 'album', 'chance', 'chanceIn', 'uid', 'ext',
];

export function serialize(S, now = Date.now()) {
  const o = {};
  for (const k of SAVE_KEYS) o[k] = S[k];
  o.savedAt = now;
  return JSON.stringify(o);
}

// 읽을 수 있는 세이브면 객체, 아니면 null(깨진 JSON·다른 생태계·모르는 버전)
export function parseSave(raw, ecoId) {
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object' || o.v !== SAVE_VERSION || o.eco !== ecoId) return null;
  if (!Array.isArray(o.items) || !Array.isArray(o.animals) || typeof o.pop !== 'number' || typeof o.tier !== 'number') return null;
  return o;
}
