// 저장·불러오기: 같은 상태, 깨진·다른 생태계·모르는 버전, 지형이 바뀐 세이브, 확장 영역 꾸미기 기록
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, eco, fixture, rich, setTier, place, run } from './helpers.js';
import { createSim, SAVE_VERSION, BASE_VERSION } from '../sim/rules.js';
import { makeEco } from '../eco/atoll/data.js';

function busy(seed = 3) {
  const S = rich(seed);
  setTier(S, 8);
  for (const id of G.itemIds) place(S, id);
  for (const s of G.speciesIds) { G.adopt(S, s); G.adopt(S, s); }
  run(S, 20);
  return S;
}

test('저장 → 불러오기: 같은 상태이고, 이어서 돌려도 같은 결과', () => {
  const S = busy();
  const raw = G.serialize(S, 1000), o = JSON.parse(raw);
  assert.equal(o.v, SAVE_VERSION);
  assert.equal(o.base, BASE_VERSION);
  assert.equal(o.eco, 'atoll');
  assert.equal(o.events, undefined, '사건 목록은 저장하지 않는다');
  const T = G.deserialize(raw);
  assert.equal(G.serialize(T, 1000), raw);
  assert.equal(G.stats(T).dev, G.stats(S).dev);
  run(S, 30); run(T, 30);
  assert.equal(G.serialize(T, 0), G.serialize(S, 0));
});

test('깨진 세이브·다른 생태계·모르는 버전은 null', () => {
  const raw = G.serialize(busy(), 0);
  assert.equal(G.deserialize('{'), null);
  assert.equal(G.deserialize('null'), null);
  assert.equal(G.deserialize(JSON.stringify({ ...JSON.parse(raw), eco: 'kelp' })), null);
  assert.equal(G.deserialize(JSON.stringify({ ...JSON.parse(raw), v: 99 })), null);
});

test('모르는 생물·물건은 빼고 읽는다', () => {
  const o = JSON.parse(G.serialize(busy(), 0));
  o.items.push({ uid: 9999, id: 'shipwreck', x: 1, y: 1, layer: null, paid: 10 });
  o.animals.push({ uid: 9998, sp: 'whaleshark', x: 1, y: 1, z: -1 });
  const T = G.deserialize(JSON.stringify(o));
  assert.ok(!T.items.some((it) => it.id === 'shipwreck'));
  assert.ok(!T.animals.some((a) => a.sp === 'whaleshark'));
});

test('지형이 바뀐 세이브(임시 격자 → 다른 지형): 맞지 않는 물건·고착 생물은 맞는 빈자리로 옮기고, 자리가 없으면 낸 값을 돌려준다', () => {
  const S = busy(5);
  const raw = G.serialize(S, 0);
  // 섬이 모두 물에 잠긴(수면이 3칸 올라간) 지형: 육지 물건은 놓을 곳이 없어 돌려받고, 해저 물건은 맞는 자리로 옮겨진다
  const flooded = { ...fixture, SEA_LEVEL: 3 };
  const G2 = createSim(makeEco(flooded));
  const before = S.items.filter((it) => eco.items[it.id].zone === 'land');
  const T = G2.deserialize(raw);
  assert.ok(T, '읽힘');
  const ev = T.events.find((e) => e.type === 'terrain');
  assert.ok(ev && ev.refunded >= before.length, JSON.stringify(ev));
  assert.ok(!T.items.some((it) => eco.items[it.id].zone === 'land'));
  for (const it of T.items) assert.ok(G2.space.terrainOk(it.id, it.x, it.y, it.layer), it.id);
  for (const a of T.animals.filter((b) => b.fx != null)) assert.ok(G2.space.sessileTerrainOk(a.sp, a.fx, a.fy));
  assert.ok(T.pop > S.pop, '돌려받은 값만큼 늘어남');
});

test('확장 영역 꾸미기: 열려야 시작, 채운 항목은 기록해 두었다가 받기, 다 받으면 마스터(20분치)', () => {
  const S = rich(8);
  setTier(S, 7);
  assert.equal(G.visitExt(S), false);
  setTier(S, 8);
  assert.ok(G.visitExt(S));
  assert.equal(G.claimExt(S, 'item').why, '아직 덜 됐어요');
  for (const id of ['feedbasket', 'lagoonsand', 'branchcoral', 'cleaning', 'dome', 'nursery']) assert.ok(place(S, id, { ext: true }).ok, id);
  for (let i = 0; i < 4; i++) G.adopt(S, 'seacucumber');
  for (const a of S.animals) { a.y = Math.max(a.y, 0); }
  run(S, 1.1);
  for (const k of ['visit', 'item', 'needs', 'theme', 'zones']) assert.ok(S.ext.done.includes(k), k);
  // 생물 6마리가 확장 영역에 동시에 있게 옮긴다
  for (let i = 0; i < 4; i++) G.adopt(S, 'manta');
  const spots = [];
  for (let i = 0; i < G.space.N && spots.length < 8; i++) if (G.space.area[i] === 2 && G.space.kind[i] === 'kandu') spots.push(i);
  S.animals.forEach((a, n) => { if (n < 8) { const i = spots[n]; a.x = G.space.cx(i) + 0.5; a.y = G.space.cy(i) + 0.5; a.z = -6; a.st = 'idle'; a.t = 100; a.fx = undefined; } });
  S.rev++;
  run(S, 1.1);
  assert.ok(S.ext.done.includes('residents'));
  let total = 0;
  for (const g of G.EXT_GOALS) { const r = G.claimExt(S, g.key); assert.ok(r.ok, g.key); total += r.master; }
  assert.equal(G.claimExt(S, 'visit').why, '이미 받았어요');
  assert.ok(G.extMaster(S));
  assert.ok(total >= 10);
  const T = G.deserialize(G.serialize(S, 0));
  assert.deepEqual(T.ext, S.ext, '저장에 남는다');
});
