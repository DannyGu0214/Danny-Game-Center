// 규칙 공용 도구: 시드 난수, 결과 값, 구성 캐시. 화면·생태계와 무관하다.

// 난수(mulberry32). 상태 S.rng 하나에서만 뽑아 같은 시드면 같은 결과가 나온다 [AW logic.js와 같은 방식]
export function rnd(S) {
  let t = (S.rng = (S.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const range = (S, a, b) => a + rnd(S) * (b - a);
export const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const ok = Object.freeze({ ok: true });
export const no = (why) => ({ ok: false, why });

// 계산 캐시: 구성(물건·생물·티어)이 바뀔 때마다 S.rev를 올리고, 같은 rev 동안은 다시 계산하지 않는다 [AW logic.js `cached`]
const cache = new WeakMap();
export function cached(S, key, make) {
  let c = cache.get(S);
  if (!c || c.rev !== S.rev) { c = { rev: S.rev }; cache.set(S, c); }
  if (!(key in c)) c[key] = make();
  return c[key];
}
export const touch = (S) => { S.rev = (S.rev || 0) + 1; };
