// 실제 지형(eco/atoll/terrain.js)으로 도는 시험. 화면이 쓰는 것과 같은 지형 약속(atollTerrain)을 규칙에 넘긴다.
// 확장 영역이 열리기 전(ext = false)과 후(ext = true)의 지형이 따로 있고, 화면은 T8에 열린 지형으로 다시 불러온다(docs/p2-report.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../sim/rules.js';
import { makeEco, atollTerrain, LIMITS } from '../eco/atoll/data.js';
import * as TER from '../eco/atoll/terrain.js';

const PRE = createSim(makeEco(atollTerrain(TER, false)));
const POST = createSim(makeEco(atollTerrain(TER, true)));
const rich = (G, seed = 3) => { const S = G.newGame(seed, 0); S.pop = 1e7; return S; };
const setTier = (S, t) => { S.tier = t; S.rev++; };
const place = (G, S, id, opt) => { const at = G.freeSpot(S, id, opt); return at ? G.placeItem(S, id, at.x, at.y, at.layer) : { ok: false, why: '자리 없음' }; };

test('실제 지형: 열리기 전에는 확장 영역 칸이 블록 밖이고, 열린 뒤에는 40×20칸이 확장 영역이다', () => {
  const count = (G, v) => { let n = 0; for (let i = 0; i < G.space.N; i++) if (G.space.area[i] === v) n++; return n; };
  assert.equal(POST.space.ext.x0, 40, '확장 영역은 +x 옆면');
  assert.equal(count(PRE, 2), 0);
  assert.equal(count(PRE, 1), 40 * 40);
  assert.equal(count(POST, 2), 40 * 20);
  assert.equal(count(POST, 1), 40 * 40);
});

test('실제 지형: 열리기 전·후 본 블록이 달라지는 칸은 +x 가장자리 띠(x ≥ 37)뿐이다', () => {
  const a = PRE.space, b = POST.space;
  let diff = 0;
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
    const i = a.cellOf(x, y), j = b.cellOf(x, y);
    if (a.kind[i] !== b.kind[j] || a.hgt[i] !== b.hgt[j]) { diff++; assert.ok(x >= 37, `(${x}, ${y}) ${a.kind[i]} → ${b.kind[j]}`); }
  }
  assert.ok(diff > 0, '가장자리 띠는 실제로 바뀐다(바깥 비탈 → 이어진 바다)');
});

test('실제 지형: 물건 18종 모두 놓을 자리가 있고, 생물 8종 모두 들일 수 있다(T8, 열린 지형)', () => {
  const S = rich(POST); setTier(S, 8);
  for (const id of POST.itemIds) assert.ok(POST.freeSpot(S, id), `${id} 자리 없음`);
  for (const s of POST.speciesIds) { const r = POST.adopt(S, s); assert.ok(r.ok, `${s}: ${r.why}`); }
  // 열리기 전 지형에서도 확장 영역 테마 물건 2종을 뺀 모두 자리가 있다(테마 물건은 얕은 해저면 본 블록에도 놓인다)
  const P = rich(PRE); setTier(P, 8);
  for (const id of PRE.itemIds) assert.ok(PRE.freeSpot(P, id), `열리기 전 ${id} 자리 없음`);
});

test('실제 지형: 열리기 전 상태를 저장해 열린 지형으로 불러오면 옮기거나 돌려주는 것 없이 이어지고, 생물이 확장 영역까지 간다', () => {
  const S = rich(PRE, 5); setTier(S, 8);
  for (const id of PRE.itemIds) { place(PRE, S, id); place(PRE, S, id); }
  for (const s of PRE.speciesIds) for (let i = 0; i < 4; i++) PRE.adopt(S, s);
  for (let i = 0; i < 30 * 30; i++) PRE.tick(S);
  const raw = PRE.serialize(S, 1000);
  const T = POST.deserialize(raw);
  assert.ok(T, '불러오기');
  assert.equal(T.items.length, S.items.length);
  assert.equal(T.animals.length, S.animals.length);
  assert.ok(!POST.drainEvents(T).some((e) => e.type === 'terrain'), '지형 맞추기로 옮긴 것이 없다');
  assert.equal(POST.caps(T).animals, 44);
  // 확장 영역 칸에 놓기가 된다(T8)
  const at = POST.freeSpot(T, 'mangrove', { ext: true });
  assert.ok(at && at.x + POST.eco.items.mangrove.w > 40, '확장 영역 칸에 걸친 자리');
  assert.ok(POST.placeItem(T, 'mangrove', at.x, at.y).ok);
  let reached = false;
  for (let i = 0; i < 30 * 600 && !reached; i++) { POST.tick(T); if (i % 30 === 0) reached = T.animals.some((a) => POST.space.isExtCell(POST.space.cellAt(a.x, a.y))); }
  assert.ok(reached, '10분 안에 어떤 생물이든 확장 영역에 들어간다');
});

test('실제 지형: 열리기 전 지형에서는 확장 영역 칸에 물건을 못 놓고 생물도 들어가지 않는다', () => {
  const S = rich(PRE, 6); setTier(S, 8);
  assert.equal(PRE.freeSpot(S, 'mangrove', { ext: true }), null);
  const r = PRE.canPlace(S, 'buoy', 45, 20, 'top');
  assert.equal(r.ok, false);
  for (const s of PRE.speciesIds) for (let i = 0; i < 4; i++) PRE.adopt(S, s);
  for (let i = 0; i < 30 * 120; i++) PRE.tick(S);
  for (const a of S.animals) assert.ok(a.x < 40, `${a.sp} x=${a.x.toFixed(1)}`);
});

test('물건 개수 상한: 데이터는 해저 120 · 수중 60 + 확장 영역 40 · 20(대니님 결정 2026-11-12), 육지는 없음', () => {
  assert.deepEqual(LIMITS, { land: null, bed: 120, water: 60, ext: { land: null, bed: 40, water: 20 } });
  assert.equal(POST.eco.limits.bed, 120);
  assert.equal(POST.eco.limits.ext.water, 20);
});

test('물건 개수 상한(몫 하나, ext: null): 켜면 그 구역만 막고 freeSpot도 null이 된다', () => {
  const G = createSim(makeEco(atollTerrain(TER, true), { limits: { water: 2, ext: null } }));
  const S = rich(G); setTier(S, 8);
  assert.ok(place(G, S, 'buoy').ok);
  assert.ok(place(G, S, 'nursery').ok);
  const r = place(G, S, 'planktonlamp');
  assert.equal(r.ok, false);
  assert.equal(G.freeSpot(S, 'planktonlamp'), null);
  const at = createSim(makeEco(atollTerrain(TER, true), { limits: { bed: null, water: null, ext: null } })).freeSpot(S, 'planktonlamp');
  const c = G.canPlace(S, 'planktonlamp', at.x, at.y, at.layer);
  assert.match(c.why, /수중 물건은 2개까지/);
  assert.ok(place(G, S, 'feedbasket').ok, '다른 구역은 그대로');
  assert.equal(G.zoneCount(S, 'water'), 2);
});

test('물건 개수 상한(본 블록·확장 영역 따로): 본 블록이 차면 확장 영역 자리를 권하고, 둘 다 차면 막는다', () => {
  const lim = { bed: null, water: 2, ext: { bed: null, water: 1 } };
  const G = createSim(makeEco(atollTerrain(TER, true), { limits: lim }));
  const S = rich(G); setTier(S, 8);
  assert.ok(place(G, S, 'buoy').ok);
  assert.ok(place(G, S, 'nursery').ok);
  assert.equal(G.zoneCount(S, 'water', 'main'), 2);
  // 본 블록 자리는 막히고 안내에 확장 영역을 권한다
  const free = createSim(makeEco(atollTerrain(TER, true), { limits: { bed: null, water: null, ext: null } }));
  const mainAt = free.freeSpot(S, 'planktonlamp', { area: 'main' });
  assert.ok(mainAt && !G.space.inExt(G.eco.items.planktonlamp, mainAt.x, mainAt.y));
  assert.match(G.canPlace(S, 'planktonlamp', mainAt.x, mainAt.y, mainAt.layer).why, /본 블록 수중 물건은 2개까지예요\. 확장 영역에 놓아 보세요/);
  assert.equal(G.limitWhy(S, 'planktonlamp'), null, '확장 영역 몫이 남아 있으면 패널 단추는 막지 않는다');
  // freeSpot은 확장 영역 자리를 준다
  const at = G.freeSpot(S, 'planktonlamp');
  assert.ok(at && G.space.inExt(G.eco.items.planktonlamp, at.x, at.y), '확장 영역 자리');
  assert.ok(G.placeItem(S, 'planktonlamp', at.x, at.y, at.layer).ok);
  assert.equal(G.zoneCount(S, 'water', 'ext'), 1);
  assert.equal(G.zoneCount(S, 'water'), 3);
  // 둘 다 참
  assert.equal(G.freeSpot(S, 'buoy'), null);
  assert.match(G.limitWhy(S, 'buoy'), /본 블록 2개 · 확장 영역 1개까지/);
  const info = G.limitInfo(S, 'buoy');
  assert.deepEqual([info.main.n, info.main.lim, info.ext.n, info.ext.lim], [2, 2, 1, 1]);
  assert.ok(place(G, S, 'feedbasket').ok, '해저는 그대로');
});

test('물건 개수 상한: 확장 영역이 열리기 전에 본 블록이 차면 T8을 안내하고, 저장·불러오기 뒤에도 센 값이 같다', () => {
  const lim = { bed: 2, water: null, ext: { bed: 1, water: null } };
  const G = createSim(makeEco(atollTerrain(TER, false), { limits: lim }));
  const S = rich(G); setTier(S, 7);
  assert.ok(place(G, S, 'feedbasket').ok);
  assert.ok(place(G, S, 'lagoonsand').ok);
  assert.equal(G.freeSpot(S, 'giantclam'), null);
  assert.match(G.limitWhy(S, 'giantclam'), /T8 확장 영역에 더 놓을 수 있어요/);
  assert.equal(G.limitInfo(S, 'giantclam').ext, undefined, '열리기 전에는 확장 영역 몫을 보여 주지 않는다');
  const G2 = createSim(makeEco(atollTerrain(TER, true), { limits: lim }));
  const S2 = G2.deserialize(G.serialize(S, 0));
  setTier(S2, 8);
  assert.equal(G2.zoneCount(S2, 'bed', 'main'), 2);
  assert.equal(G2.limitWhy(S2, 'giantclam'), null);
  const at = G2.freeSpot(S2, 'giantclam');
  assert.ok(at && G2.space.inExt(G2.eco.items.giantclam, at.x, at.y));
});

test('화면 크기·속도는 data.js 한 곳: bodyLen = len × draw, 속도는 시제품 생동감 값(해삼만 예외)', () => {
  const sp = POST.eco.species;
  assert.equal(POST.bodyLen('clownfish'), 0.75 * 1.35);
  assert.equal(POST.bodyLen('manta'), 4 * 0.85);
  const want = { seacucumber: 0.6, hermitcrab: 1.15, clownfish: 1.9, octopus: 1.0, moonjelly: 0.36, greenturtle: 1.45, manta: 1.75 };
  for (const [s, v] of Object.entries(want)) assert.equal(sp[s].speed, v, s);
});
