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

test('물건 개수 상한: 데이터에는 슬롯만 있고 꺼져 있다. 켜면 그 구역만 막고 freeSpot도 null이 된다', () => {
  assert.deepEqual(LIMITS, { land: null, bed: null, water: null });
  const G = createSim(makeEco(atollTerrain(TER, true), { limits: { water: 2 } }));
  const S = rich(G); setTier(S, 8);
  assert.ok(place(G, S, 'buoy').ok);
  assert.ok(place(G, S, 'nursery').ok);
  const r = place(G, S, 'planktonlamp');
  assert.equal(r.ok, false);
  assert.equal(G.freeSpot(S, 'planktonlamp'), null);
  const at = POST.freeSpot(S, 'planktonlamp');
  const c = G.canPlace(S, 'planktonlamp', at.x, at.y, at.layer);
  assert.match(c.why, /수중 물건은 2개까지/);
  assert.ok(place(G, S, 'feedbasket').ok, '다른 구역은 그대로');
  assert.equal(G.zoneCount(S, 'water'), 2);
});

test('화면 크기·속도는 data.js 한 곳: bodyLen = len × draw, 속도는 시제품 생동감 값(해삼만 예외)', () => {
  const sp = POST.eco.species;
  assert.equal(POST.bodyLen('clownfish'), 0.75 * 1.35);
  assert.equal(POST.bodyLen('manta'), 4 * 0.85);
  const want = { seacucumber: 0.6, hermitcrab: 1.15, clownfish: 1.9, octopus: 1.0, moonjelly: 0.36, greenturtle: 1.45, manta: 1.75 };
  for (const [s, v] of Object.entries(want)) assert.equal(sp[s].speed, v, s);
});
