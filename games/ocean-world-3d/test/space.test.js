// 공간: 지형 약속, 확장 영역, 세 구역 놓기, 수중 층, 고착 생물 자리
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, eco, fixture, rich, setTier, place, findCell } from './helpers.js';
import { createSpace, extRect } from '../sim/space.js';

const sp = G.space;

test('지형 약속: 본 블록 40×40 + 옆면(+y) 확장 영역 40×20, 수면 0, 칸 높이는 1/3칸 정수', () => {
  assert.deepEqual([sp.W, sp.H, sp.x0, sp.y0], [40, 60, 0, 0]);
  assert.deepEqual(sp.ext, { x0: 0, x1: 40, y0: 40, y1: 60 });
  let main = 0, ext = 0;
  for (let i = 0; i < sp.N; i++) { if (sp.area[i] === 1) main++; if (sp.area[i] === 2) ext++; }
  assert.equal(main, 1600);
  assert.equal(ext, 800);
  for (let y = 0; y < 60; y++) for (let x = 0; x < 40; x++) assert.ok(Number.isInteger(fixture.cellHeight(x, y)));
  assert.ok(Math.max(...Array.from(sp.depth)) <= fixture.MAX_DEPTH);
  // 옆면 방향마다 확장 영역 범위
  const g = { w: 40, h: 40 };
  assert.deepEqual(extRect(g, { side: '-x', depth: 20 }), { x0: -20, x1: 0, y0: 0, y1: 40 });
  assert.deepEqual(extRect(g, { side: '+x', depth: 10 }), { x0: 40, x1: 50, y0: 0, y1: 40 });
  assert.equal(extRect(g, null), null);
});

test('임시 격자는 설계 초안의 지형 구성과 면적 비율을 대략 따른다(섬 약 18%, 석호·산호 대지·틸라·칸두)', () => {
  const n = {};
  for (let i = 0; i < sp.N; i++) if (sp.area[i] === 1) n[sp.kind[i]] = (n[sp.kind[i]] || 0) + 1;
  const land = n.island + n.beach;
  assert.ok(land > 1600 * 0.14 && land < 1600 * 0.24, `육지 ${land}칸`);
  for (const k of ['lagoon', 'reefflat', 'thila', 'kandu', 'slope', 'dropoff']) assert.ok(n[k] > 0, k);
  assert.ok(Math.max(...Array.from(sp.depth)) === 12, '칸두 최대 수심 12칸');
});

test('수중 층: 수심 2칸 미만은 표층만, 2~4칸은 표층·중층, 4칸 이상은 세 층 모두', () => {
  for (let i = 0; i < sp.N; i++) {
    if (!sp.wet[i] || !sp.swimK[i]) continue;
    const D = sp.depth[i];
    assert.equal(!!sp.layerOk.top[i], true);
    assert.equal(!!sp.layerOk.mid[i], D >= 2, `수심 ${D}`);
    assert.equal(!!sp.layerOk.low[i], D >= 4, `수심 ${D}`);
  }
});

test('세 구역: 육지 물건은 육지에, 해저 물건은 물속 바닥에, 수중 물건은 그 층이 있는 물기둥에만', () => {
  const S = rich();
  setTier(S, 8);
  const land = findCell((i) => !sp.wet[i] && sp.kind[i] === 'island');
  const lagoon = findCell((i) => sp.kind[i] === 'lagoon' && sp.area[i] === 1);
  const reef = findCell((i) => sp.kind[i] === 'reefflat' && sp.area[i] === 1 && sp.depth[i] < 2);
  assert.match(G.canPlace(S, 'palm', lagoon[0], lagoon[1]).why, /에 놓아요/);
  assert.match(G.canPlace(S, 'feedbasket', land[0], land[1]).why, /에 놓아요/);
  assert.match(G.canPlace(S, 'nursery', reef[0], reef[1], 'mid').why, /얕아서 중층이 없어요/);
  assert.match(G.canPlace(S, 'buoy', land[0], land[1], 'top').why, /에 놓아요/);
  assert.match(G.canPlace(S, 'buoy', lagoon[0], lagoon[1], 'mid').why, /중층에는 못 놓아요/);
  for (const id of G.itemIds) {
    const r = place(S, id), d = eco.items[id];
    assert.ok(r.ok, `${id}: ${r.why}`);
    sp.foot(d, r.item.x, r.item.y, (i) => {
      if (d.zone === 'land') assert.equal(sp.wet[i], 0, id);
      else assert.equal(sp.wet[i], 1, id);
      if (d.zone !== 'water') assert.ok(d.on.includes(sp.kind[i]), `${id} on ${sp.kind[i]}`);
      else assert.ok(sp.layerOk[r.item.layer][i], `${id} ${r.item.layer}`);
    });
    assert.equal(r.item.layer, d.zone === 'water' ? d.layers[0] : null, '수중 물건은 권하는 층부터');
  }
});

test('권하는 지형부터 자리를 고른다(on 앞쪽)', () => {
  const S = rich();
  setTier(S, 8);
  for (const id of G.itemIds) {
    const d = eco.items[id], at = G.freeSpot(S, id);
    if (d.zone === 'water') continue;
    assert.equal(sp.kind[sp.cellOf(at.x, at.y)], d.on[0], id);
  }
});

test('수중 물건과 해저 물건은 위아래로 겹쳐 놓고, 같은 층은 겹치지 않으며, 키 큰 해저 물건 위 저층은 못 쓴다', () => {
  const S = rich();
  setTier(S, 8);
  const at = G.freeSpot(S, 'boulder'); // 키 큰 해저 물건(4×4)
  assert.ok(G.placeItem(S, 'boulder', at.x, at.y).ok);
  // 바로 위 중층에 산호 묘목 줄은 놓인다(틸라는 수심 5칸이라 세 층)
  assert.ok(G.placeItem(S, 'nursery', at.x, at.y, 'mid').ok);
  assert.match(G.canPlace(S, 'planktonlamp', at.x, at.y, 'mid').why, /이미 다른 것이 있어요/);
  assert.match(G.canPlace(S, 'planktonlamp', at.x + 2, at.y + 2, 'low').why, /저층이 막혀 있어요/);
  assert.ok(G.canPlace(S, 'planktonlamp', at.x + 2, at.y + 2, 'top').ok);
  // 저층 물건 아래에는 키 큰 물건을 못 놓는다
  const lowAt = G.freeSpot(S, 'planktonlamp', { layer: 'low', on: 'thila' });
  assert.ok(G.placeItem(S, 'planktonlamp', lowAt.x, lowAt.y, 'low').ok);
  const under = [lowAt.x, lowAt.y];
  const r = G.canPlace(S, 'boulder', under[0] - 1, under[1] - 1);
  assert.equal(r.ok, false);
});

test('물건 놓기: 칸 밖·겹침·비탈은 막고, 치우면 50% 환급', () => {
  const S = rich();
  assert.equal(G.canPlace(S, 'feedbasket', -1, 0).ok, false);
  assert.equal(G.canPlace(S, 'feedbasket', 39, 10).ok, false);
  const slope = findCell((i) => sp.kind[i] === 'slope' && sp.kind[i + 1] === 'slope' && sp.kind[i + sp.W] === 'slope' && sp.kind[i + sp.W + 1] === 'slope');
  if (slope) assert.equal(G.canPlace(S, 'feedbasket', slope[0], slope[1]).ok, false);
  const r = place(S, 'feedbasket');
  assert.match(G.canPlace(S, 'feedbasket', r.item.x, r.item.y).why, /이미 다른 것이 있어요/);
  const p = S.pop, rr = G.removeItem(S, r.item.uid);
  assert.equal(rr.refund, 5);
  assert.equal(S.pop, p + 5);
  assert.ok(G.canPlace(S, 'feedbasket', r.item.x, r.item.y).ok);
});

test('확장 영역: T8 전에는 물건을 못 놓고 자리 찾기에서도 빠진다. T8이면 놓을 수 있고, 자리 찾기는 본 블록부터', () => {
  const S = rich();
  setTier(S, 7);
  const e = findCell((i) => sp.area[i] === 2 && sp.kind[i] === 'lagoon' && sp.kind[i + 1] === 'lagoon' && sp.kind[i + sp.W] === 'lagoon' && sp.kind[i + sp.W + 1] === 'lagoon');
  assert.match(G.canPlace(S, 'feedbasket', e[0], e[1]).why, /T8에 열리는 확장 영역이에요/);
  for (let k = 0; k < 400; k++) { const at = G.freeSpot(S, 'feedbasket'); if (!at) break; assert.ok(at.y < 40, '잠긴 동안 자리 찾기는 본 블록만'); G.placeItem(S, 'feedbasket', at.x, at.y); }
  setTier(S, 8);
  assert.ok(G.canPlace(S, 'feedbasket', e[0], e[1]).ok);
  const S2 = rich();
  setTier(S2, 8);
  assert.ok(G.freeSpot(S2, 'feedbasket').y < 40, '열려도 본 블록 자리가 남아 있으면 본 블록부터');
  assert.ok(G.freeSpot(S2, 'feedbasket', { ext: true }).y + 2 > 40, '확장 영역 칸이 있는 자리만');
});

test('고착 생물(말미잘): 정해진 지형에 자리를 골라 붙고, 물건과 겹치지 않는다', () => {
  const S = rich();
  setTier(S, 3);
  const at = G.freeSessileSpot(S, 'anemone');
  assert.ok(eco.species.anemone.on.includes(sp.kind[sp.cellOf(at.x, at.y)]));
  const land = findCell((i) => sp.kind[i] === 'island');
  assert.equal(G.canAdopt(S, 'anemone', { x: land[0], y: land[1] }).ok, false);
  const a = G.adopt(S, 'anemone', at).animal;
  assert.deepEqual([a.fx, a.fy], [at.x, at.y]);
  assert.match(G.canPlace(S, 'feedbasket', at.x, at.y).why, /이미 다른 것이 있어요/);
  assert.equal(G.canAdopt(S, 'anemone', at).ok, false, '같은 자리에 두 번은 못 붙는다');
  const r = G.release(S, a.uid);
  assert.ok(r.ok);
  assert.ok(G.canPlace(S, 'feedbasket', at.x, at.y).ok, '방생하면 자리가 빈다');
});

test('데이터 점검: 물건 16종 모두 임시 격자에 놓을 자리가 있고, 생물 8종 모두 지낼 곳이 있다', () => {
  const S = rich();
  setTier(S, 8);
  for (const id of G.itemIds) assert.ok(G.freeSpot(S, id), id);
  for (const s of G.speciesIds) assert.ok(G.canAdopt(S, s, null, true).ok || s === 'clownfish', s);
});

test('공간 모듈은 지형 약속만 읽는다: 다른 크기·다른 옆면의 지형도 만들 수 있다', () => {
  const T = { GRID: { w: 10, h: 8 }, EXT: { side: '-x', depth: 4 }, SEA_LEVEL: 0, MAX_DEPTH: 3, kindAt: () => 'lagoon', cellHeight: () => -9, heightAt: () => -3 };
  const s2 = createSpace({ ...eco, terrain: T });
  assert.deepEqual([s2.W, s2.H, s2.x0], [14, 8, -4]);
  assert.equal(s2.area[s2.cellOf(-1, 0)], 2);
  assert.equal(s2.area[s2.cellOf(0, 0)], 1);
});

test('확장 영역 테마 물건(맹그로브 덤불·수상 데크): 얕은 해저(수심 3칸까지)에 뿌리·기둥을 내리고 수면 위로 솟아, 그 위 물기둥의 모든 층을 막는다', () => {
  const S = rich();
  setTier(S, 8);
  const kandu = findCell((i) => sp.kind[i] === 'kandu' && sp.area[i] === 1);
  assert.match(G.canPlace(S, 'mangrove', kandu[0], kandu[1]).why, /에 놓아요/);
  const at = G.freeSpot(S, 'mangrove', { ext: true });
  const r = G.placeItem(S, 'mangrove', at.x, at.y);
  assert.ok(r.ok, r.why);
  for (const L of ['top', 'mid', 'low']) if (sp.layerOk[L][sp.cellOf(at.x, at.y)]) assert.match(G.canPlace(S, 'nursery', at.x, at.y, L).why ?? '', L === 'top' ? /층에는 못 놓아요|솟은/ : /솟은/);
  assert.match(G.canPlace(S, 'buoy', at.x, at.y, 'top').why, /솟은 물건/);
  const i = sp.cellOf(at.x + 1, at.y + 1);
  for (let z = sp.bottomZ(i); z <= 0; z += 0.1) assert.equal(sp.freePoint(S, i, z, eco.species.manta, true), false, `z ${z.toFixed(1)}`);
  // 반대로: 물기둥에 물건이 있는 자리에는 솟는 물건을 못 놓는다
  const b = G.freeSpot(S, 'boardwalk');
  assert.ok(G.placeItem(S, 'buoy', b.x + 1, b.y + 1, 'top').ok);
  assert.match(G.canPlace(S, 'boardwalk', b.x, b.y).why, /물기둥에 물건이 있어/);
  // 확장 영역 테마 물건은 확장 영역 꾸미기에서 센다
  const d = G.freeSpot(S, 'boardwalk', { ext: true });
  assert.ok(G.placeItem(S, 'boardwalk', d.x, d.y).ok);
  assert.ok(G.space.inExt(eco.items.mangrove, at.x, at.y) && G.space.inExt(eco.items.boardwalk, d.x, d.y), '둘 다 확장 영역 안');
  assert.deepEqual(G.extProgress(S, 'theme'), [2, 2]);
});

test('테마 물건은 육지가 없는 확장 영역에도 놓이고, 수심 3칸보다 깊은 곳에는 못 놓는다', () => {
  const T = { GRID: { w: 12, h: 12 }, EXT: { side: '+y', depth: 8 }, SEA_LEVEL: 0, MAX_DEPTH: 6,
    kindAt: (x, y) => (y >= 12 ? 'lagoon' : 'kandu'), cellHeight: (x, y) => (y >= 12 ? (x < 6 ? -9 : -12) : -18), heightAt: () => -3 };
  const s2 = createSpace({ ...eco, terrain: T });
  const S = { tier: 8, items: [], animals: [], rev: 1 };
  assert.equal(s2.placeWhy(S, 'mangrove', 1, 13), null, '수심 3칸 석호(육지 없음)');
  assert.match(s2.placeWhy(S, 'mangrove', 7, 13), /물이 깊어요/);
  assert.ok(s2.freeSpot(S, 'boardwalk', { ext: true }));
});
