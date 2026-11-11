// 생활형별 이동: 다니는 곳, 모든 수위층, 수면형 숨쉬기·볕 쬐기, 흰동가리, 확장 영역 잠금, 물건이 놓이면 비켜 서기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, eco, rich, setTier, place, run, findCell } from './helpers.js';
import { LIFE } from '../sim/move.js';

const sp = G.space;
const cellOf = (a) => sp.cellAt(a.x, a.y);

// 모든 종 n마리씩 + 물건 한 벌을 놓은 T8(또는 tier) 상태
function zoo(seed, n = 3, tier = 8) {
  const S = rich(seed);
  setTier(S, tier);
  for (const id of G.itemIds) if (eco.items[id].tier <= tier) { place(S, id); place(S, id); }
  for (const s of G.speciesIds) if (eco.species[s].tier <= tier) for (let i = 0; i < n; i++) G.adopt(S, s);
  return S;
}
// sec초 동안 매 단계 check(S)
function watch(S, sec, check) { for (let i = 0, n = Math.round(sec * 30); i < n; i++) { G.tick(S); check(S, i); } }

test('육지형은 뭍 칸만, 바닥형은 물 밑 바닥만 다니고, 고착형은 제자리에 있다', () => {
  const S = zoo(3);
  const fixed = new Map(S.animals.filter((a) => a.sp === 'anemone').map((a) => [a.uid, [a.x, a.y, a.z]]));
  let moved = 0;
  const start = new Map(S.animals.map((a) => [a.uid, [a.x, a.y]]));
  watch(S, 90, () => {
    for (const a of S.animals) {
      const i = cellOf(a), life = eco.species[a.sp].life;
      if (life === 'walker') { assert.ok(sp.canWalk(S, i, 'land'), `소라게 ${a.x},${a.y}`); assert.equal(a.z, sp.bottomZ(i)); }
      if (life === 'crawler') { assert.ok(sp.canWalk(S, i, 'bed'), `해삼 ${a.x},${a.y}`); assert.equal(a.z, sp.bottomZ(i)); }
      if (life === 'sessile') assert.deepEqual([a.x, a.y, a.z], fixed.get(a.uid));
    }
  });
  for (const a of S.animals) { const [x, y] = start.get(a.uid); if (Math.hypot(a.x - x, a.y - y) > 0.5) moved++; }
  assert.ok(moved >= S.animals.length / 2, `움직인 생물 ${moved}/${S.animals.length}`);
});

test('헤엄치는 생물은 물기둥 안에만 있다: 바닥 위·수면 아래, 수중 물건과 키 큰 물건을 피함', () => {
  const S = zoo(5);
  watch(S, 120, () => {
    for (const a of S.animals) {
      const L = LIFE[eco.species[a.sp].life];
      if (!L.swim) continue;
      const i = cellOf(a);
      if (L.breathe && !sp.wet[i]) { assert.ok(sp.canWalk(S, i, 'land')); continue; }
      assert.ok(sp.freePoint(S, i, a.z, eco.species[a.sp], true), `${a.sp} (${a.x.toFixed(2)},${a.y.toFixed(2)},${a.z.toFixed(2)}) ${a.st}`);
    }
  });
});

test('모든 수위층: 헤엄치는 생물은 표층·중층·저층을 모두 다니고, 해삼은 얕은 곳부터 깊은 곳까지 해저 전체를 다닌다', () => {
  const S = zoo(9, 4);
  const bands = {};
  watch(S, 600, (S2, t) => {
    if (t % 15) return;
    for (const a of S.animals) {
      const life = eco.species[a.sp].life;
      if (life !== 'swimmer' && life !== 'drifter' && life !== 'surfacer') continue;
      const i = cellOf(a);
      if (!sp.wet[i]) continue;
      (bands[a.sp] ??= new Set()).add(sp.bandOf(i, a.z));
    }
  });
  for (const s of ['octopus', 'moonjelly', 'greenturtle', 'manta']) assert.deepEqual([...bands[s]].sort(), [0, 1, 2], `${s} ${[...bands[s]]}`);
  // 해삼: 바닥 걷기 칸은 지형 종류와 상관없이 하나로 이어져 있다(석호에서 칸두까지 길이 있음)
  const from = findCell((i) => sp.kind[i] === 'lagoon' && sp.area[i] === 1)[2];
  for (const k of ['reefflat', 'thila', 'kandu']) {
    const p = G.mover.bfs2(S, from, (i) => sp.kind[i] === k && sp.area[i] === 1, 'bed');
    assert.ok(p, `석호 → ${k}`);
  }
  assert.equal(eco.species.seacucumber.layers, undefined, '종마다 다니는 층 기본값 = 전부');
  assert.equal(eco.species.seacucumber.kinds, undefined, '종마다 다니는 지형 기본값 = 전부');
});

test('수면형(바다거북): 숨 쉬러 수면에 오르고, 해변에 올라 볕을 쬐며, 동시에 뭍에 있는 거북은 2마리 이하', () => {
  const S = rich(4);
  setTier(S, 7);
  for (const id of ['feedbasket', 'shellbox', 'palm']) place(S, id);
  for (let i = 0; i < 4; i++) G.adopt(S, 'greenturtle');
  const seen = { breathe: 0, bask: 0, surface: 0 };
  watch(S, 600, () => {
    let onLand = 0;
    for (const a of S.animals) {
      if (a.st === 'breathe') seen.breathe++;
      if (a.st === 'bask') { seen.bask++; assert.equal(sp.wet[cellOf(a)], 0); assert.ok(eco.species.greenturtle.bask.includes(sp.kind[cellOf(a)])); }
      if (a.z > -0.2 && sp.wet[cellOf(a)]) seen.surface++;
      if (!sp.wet[cellOf(a)]) onLand++;
    }
    assert.ok(onLand <= 2, `뭍에 ${onLand}마리`);
  });
  assert.ok(seen.breathe > 0 && seen.surface > 0, '숨쉬기');
  assert.ok(seen.bask > 0, '볕 쬐기');
});

test('흰동가리(게임적 허용, 2026-11-11): 짝 말미잘 곁에 매이지 않고 깊은 곳까지 블록 전체를 다니며, 가끔 말미잘 곁에 들른다', () => {
  const S = rich(6);
  setTier(S, 8);
  place(S, 'feedbasket');
  const h = G.adopt(S, 'anemone').animal;
  for (let i = 0; i < 4; i++) G.adopt(S, 'clownfish');
  const [hx, hy] = [h.fx + 1, h.fy + 1];
  let n = 0, near = 0, far = 0, deep = 0;
  watch(S, 900, (S2, t) => {
    if (t % 30) return;
    for (const a of S.animals.filter((b) => b.sp === 'clownfish')) {
      n++;
      const d = Math.hypot(a.x - hx, a.y - hy);
      if (d <= 3) near++;
      if (d > 12) far++;
      if (a.z < -6) deep++;
    }
  });
  assert.ok(near / n < 0.5, `말미잘 3칸 안 ${(near / n).toFixed(2)} — 대부분은 블록 전체`);
  assert.ok(near > 0, '가끔은 말미잘 곁에 들른다');
  assert.ok(far / n > 0.3, `말미잘에서 12칸 넘게 떨어진 때 ${(far / n).toFixed(2)}`);
  assert.ok(deep > 0, '깊은 곳(수심 6칸 아래)까지 간다');
  assert.equal(G.stats(S).needMet.clownfish.partner, 0.5, '공생은 행복도 필요로만(말미잘 1개체 = 2마리분)');
});

test('표류형(해파리)은 길찾기 없이 떠다니며, 막히면 방향을 돌려 물기둥을 벗어나지 않는다', () => {
  const S = zoo(8, 4, 6);
  const start = S.animals.filter((a) => a.sp === 'moonjelly').map((a) => [a.x, a.y]);
  watch(S, 240, () => { for (const a of S.animals.filter((b) => b.sp === 'moonjelly')) { assert.equal(a.path, null); assert.ok(sp.freePoint(S, cellOf(a), a.z, eco.species.moonjelly, true)); } });
  const end = S.animals.filter((a) => a.sp === 'moonjelly').map((a) => [a.x, a.y]);
  assert.ok(end.some(([x, y], i) => Math.hypot(x - start[i][0], y - start[i][1]) > 1), '떠다닌다');
});

test('확장 영역이 잠긴 동안에는 어떤 생물도 들어가지 않고, 열리면 들어가 지낸다', () => {
  const S = zoo(12, 4, 7);
  setTier(S, 7); // 물건을 많이 놓아 티어가 저절로 오른 것을 되돌린다(테스트용)
  G.mover.fix(S);
  watch(S, 300, () => { for (const a of S.animals) assert.notEqual(sp.area[cellOf(a)], 2, `${a.sp} ${a.x},${a.y}`); });
  setTier(S, 8);
  let inExt = 0;
  watch(S, 600, (S2, t) => { if (t % 30 === 0) inExt = Math.max(inExt, S.animals.filter((a) => sp.area[cellOf(a)] === 2).length); });
  assert.ok(inExt > 0, '열린 뒤 확장 영역에 들어간 생물');
});

test('물건이 놓이면 그 자리에 있던 생물은 가까운 빈자리로 비켜 선다', () => {
  const S = rich(2);
  setTier(S, 5);
  const a = G.adopt(S, 'seacucumber').animal;
  const c = findCell((i) => sp.kind[i] === 'thila' && sp.area[i] === 1 && G.canPlace(S, 'reefblock', sp.cx(i), sp.cy(i)).ok);
  a.x = c[0] + 0.5; a.y = c[1] + 0.5; a.z = sp.bottomZ(c[2]);
  const f = G.adopt(S, 'octopus').animal;
  f.x = c[0] + 1; f.y = c[1] + 1; f.z = sp.bottomZ(c[2]) + 0.4;
  assert.ok(G.placeItem(S, 'reefblock', c[0], c[1]).ok);
  assert.ok(sp.canWalk(S, cellOf(a), 'bed'), '해삼이 비켜 섬');
  assert.ok(sp.freePoint(S, cellOf(f), f.z, eco.species.octopus, true), '문어가 비켜 섬');
});

test('3D 길찾기: 곧은 길이 막히면 돌아가는 길을 찾고, 길 위 모든 점이 물기둥 안이다', () => {
  const S = rich(1);
  setTier(S, 8);
  const a = G.adopt(S, 'manta').animal;
  // 칸두 두 점 사이를 중층 물건 벽으로 막는다
  const y0 = 24, x0 = 28;
  for (let y = 16; y < 40; y += 2) for (const L of ['top', 'mid', 'low']) G.placeItem(S, 'planktonlamp', x0, y, L);
  a.x = x0 - 2.5; a.y = y0 + 0.5; a.z = -6;
  const t = [x0 + 5.5, y0 + 0.5, -6];
  const p = G.mover.path3(S, a, eco.species.manta, t);
  assert.ok(p && p.length > 1, '돌아가는 길');
  let prev = [a.x, a.y, a.z];
  for (const q of p) {
    const n = Math.ceil(Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]) / 0.25);
    for (let k = 1; k <= n; k++) {
      const x = prev[0] + ((q[0] - prev[0]) * k) / n, y = prev[1] + ((q[1] - prev[1]) * k) / n, z = prev[2] + ((q[2] - prev[2]) * k) / n;
      assert.ok(sp.freePoint(S, sp.cellAt(x, y), z, eco.species.manta, true), `(${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)})`);
    }
    prev = q;
  }
});

test('화면에 넘길 상태: 생물 { uid, sp, x, y, z, face, pitch, st, ph, on }, 물건 { uid, id, x, y, w, h, zone, layer, z, rot }', () => {
  const S = zoo(1, 1);
  run(S, 3);
  const v = G.view(S);
  assert.deepEqual(Object.keys(v.creatures[0]).sort(), ['face', 'on', 'ph', 'pitch', 'sp', 'st', 'uid', 'x', 'y', 'z'].sort());
  assert.deepEqual(Object.keys(v.props[0]).sort(), ['h', 'id', 'layer', 'rot', 'uid', 'w', 'x', 'y', 'z', 'zone'].sort());
  for (const c of v.creatures) { assert.ok(['land', 'bed', 'water'].includes(c.on)); for (const k of ['x', 'y', 'z', 'face', 'pitch', 'ph']) assert.ok(Number.isFinite(c[k]), `${c.sp}.${k}`); }
  const states = new Set(['idle', 'move', 'eat', 'drink', 'rest', 'special', 'breathe', 'bask']);
  for (const c of v.creatures) assert.ok(states.has(c.st), c.st);
  for (const p of v.props) { assert.ok(Number.isFinite(p.z)); if (p.zone === 'water') assert.ok(p.z <= 0); else if (p.zone === 'bed') assert.ok(p.z < 0); else assert.ok(p.z > 0); }
  const buoy = v.props.find((p) => p.id === 'buoy');
  assert.equal(buoy.z, 0, '떠 있는 물건은 수면');
  assert.deepEqual(v.ext.rect, { x0: 0, x1: 40, y0: 40, y1: 60 });
});
