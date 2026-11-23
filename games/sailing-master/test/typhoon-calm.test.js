// 태풍과 무풍이 같은 날 겹치면 무풍 배율 0.15가 태풍 바람까지 깎던 것(2026-11-23)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import { CAL, WX, SEASONS } from '../data.js';

const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
// 고치기 전 추첨(무풍 단독)으로 태풍과 겹쳤을 날을 찾는다
function overlap(seed) {
  for (let d = 1; d < 800; d++) {
    const w = G.dayWeather(seed, d), sea = SEASONS[Math.floor(d / CAL.seasonDays) % 4].id, p = WX.calm.chance[sea] || 0;
    if (w.typhoon && hash(seed + WX.calm.salt, d) < p) return d;
  }
  return null;
}
test('태풍 오는 날엔 무풍이 안 뽑혀요(겹치던 시드에서도)', () => {
  let found = 0;
  for (let seed = 1; seed < 400 && found < 3; seed++) {
    const d = overlap(seed);
    if (d === null) continue;
    found++;
    assert.equal(G.dayWeather(seed, d).calm, false, `시드 ${seed} ${d}일`);
  }
  assert.ok(found > 0, '겹치는 시드를 못 찾았어요');
  for (let seed = 1; seed < 60; seed++) for (let d = 0; d < 400; d++) { const w = G.dayWeather(seed, d); assert.ok(!(w.typhoon && w.calm)); }
});
test('태풍 없는 날의 무풍은 그대로 와요', () => {
  let calm = 0;
  for (let d = 1; d < 400; d++) { const w = G.dayWeather(7, d); if (w.calm) { calm++; assert.ok(!w.typhoon); } }
  assert.ok(calm > 0);
});
test('태풍이 건너는 동안 무풍 배율이 바람에 안 걸려요(날을 넘긴 태풍 포함)', () => {
  let n = 0;
  for (let seed = 1; seed < 80; seed++) for (let d = 1; d < 400; d++) {
    const tr = G.dayWeather(seed, d).typhoon;
    if (!tr) continue;
    for (const t of [tr.t0 + 5, tr.t0 + 100, tr.t0 + 149]) {
      const w = G.weatherAt('sea', seed, d * CAL.day + t);
      assert.ok(w.typhoonOn); assert.ok(!w.on.includes('calm'));
      n++;
    }
  }
  assert.ok(n > 0);
});
