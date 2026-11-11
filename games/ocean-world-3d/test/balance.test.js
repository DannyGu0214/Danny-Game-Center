// 균형감(대니님 방향 2026-11-11 "게임적 허용"): 오래 돌렸을 때 헤엄치는 생물이 물 부피에 고르게 퍼지고, 해삼은 깊은 해저까지 간다.
//
// 기준과 근거
// - 기대값 = 생물이 갈 수 있는 물 부피(칸마다 바닥 위 0.4칸 ~ 수면 아래 0.35칸 사이)의 몫. 목표점을 이 부피에 비례해 고르므로(sim/move.js) 오래 돌면 이 몫에 가까워야 한다.
// - 관측값 = 처음 300초를 뺀 뒤 1초마다 찍은 유영형·표류형의 위치 몫. 수면형(숨 쉬러 수면)·고착형·바닥형·육지형은 뺀다.
// - 허용: 관측 ÷ 기대가 0.5~1.6. 이동 중인 시간(목표 사이를 지나는 길)과 제자리 먹기·쉬기 때문에 딱 맞지는 않는다.
//   3개 시드(21~23)로 잰 비는 깊이대 0.85~1.32, 구역 0.67~1.29, 층 띠 0.68~1.27이었다(2026-11-11). 이전 구현(목표를 둘레에서만 고르고 먼 물건 쪽으로도 감)은
//   깊은 곳 약 0.4~0.6, 확장 영역 약 0.4~0.7이라 이 기준에 걸렸다.
// - 해삼: 칸두 바닥에 있는 몫이 칸두 넓이 몫(0.23)의 절반 이상. 3개 시드에서 0.14~0.20.
// - 깊이대: 얕음(수면~3칸) · 중간(3~6칸) · 깊음(6칸 아래). 구역: 본 블록 왼쪽(x < 20) · 본 블록 오른쪽 · 확장 영역. 층 띠: 칸마다 물기둥 3등분(표층·중층·저층).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, eco, rich, setTier, place } from './helpers.js';

const sp = G.space;
const SWIM = new Set(['swimmer', 'drifter']);
const depthZone = (z) => (z >= -3 ? 'shallow' : z >= -6 ? 'mid' : 'deep');
const areaOf = (x, y) => (y >= 40 ? 'ext' : x < 20 ? 'left' : 'right');

function expected() {
  const e = { depth: {}, area: {}, band: {} };
  let tot = 0;
  for (let i = 0; i < sp.N; i++) {
    if (!sp.wet[i] || !sp.swimK[i]) continue;
    for (let z = sp.bottomZ(i) + 0.45; z < -0.35; z += 0.1) {
      tot += 1;
      const k = [['depth', depthZone(z)], ['area', areaOf(sp.cx(i), sp.cy(i))], ['band', sp.bandOf(i, z)]];
      for (const [g, v] of k) e[g][v] = (e[g][v] || 0) + 1;
    }
  }
  for (const g of Object.keys(e)) for (const v of Object.keys(e[g])) e[g][v] /= tot;
  return e;
}

function observe(seed, sec = 1200, warm = 300) {
  const S = rich(seed);
  setTier(S, 8);
  for (const id of G.itemIds) { place(S, id); place(S, id); }
  for (const s of G.speciesIds) for (let i = 0; i < 4; i++) G.adopt(S, s);
  const o = { depth: {}, area: {}, band: {} }, cuc = { n: 0, deep: 0, kandu: 0 };
  let n = 0;
  for (let t = 0; t < sec * 30; t++) {
    G.tick(S);
    if (t % 30 || t < warm * 30) continue;
    for (const a of S.animals) {
      const life = eco.species[a.sp].life, i = sp.cellAt(a.x, a.y);
      if (a.sp === 'seacucumber') { cuc.n++; if (a.z <= -6) cuc.deep++; if (sp.kind[i] === 'kandu') cuc.kandu++; }
      if (!SWIM.has(life)) continue;
      n++;
      for (const [g, v] of [['depth', depthZone(a.z)], ['area', areaOf(a.x, a.y)], ['band', sp.bandOf(i, a.z)]]) o[g][v] = (o[g][v] || 0) + 1;
    }
  }
  for (const g of Object.keys(o)) for (const v of Object.keys(o[g])) o[g][v] /= n;
  return { o, cuc };
}

const E = expected();
for (const seed of [21, 22]) {
  test(`균형감(시드 ${seed}): 헤엄치는 생물이 깊이대·구역·층 띠마다 물 부피 몫의 0.5~1.6배에 있다`, () => {
    const { o, cuc } = observe(seed);
    for (const g of ['depth', 'area', 'band']) for (const v of Object.keys(E[g])) {
      const r = (o[g][v] || 0) / E[g][v];
      assert.ok(r >= 0.5 && r <= 1.6, `${g} ${v}: 관측 ${(o[g][v] || 0).toFixed(2)} / 기대 ${E[g][v].toFixed(2)} = ${r.toFixed(2)}`);
    }
    // 해삼은 깊은 해저(칸두)까지 긴다: 칸두 바닥 몫이 칸두 넓이 몫의 절반 이상
    let bed = 0, kandu = 0;
    for (let i = 0; i < sp.N; i++) if (sp.area[i] && sp.wet[i] && sp.walkK[i]) { bed++; if (sp.kind[i] === 'kandu') kandu++; }
    assert.ok(cuc.deep > 0, '해삼이 수심 6칸 아래 바닥에 간다');
    assert.ok(cuc.kandu / cuc.n >= 0.5 * (kandu / bed), `해삼 칸두 몫 ${(cuc.kandu / cuc.n).toFixed(2)} / 넓이 몫 ${(kandu / bed).toFixed(2)}`);
  });
}
