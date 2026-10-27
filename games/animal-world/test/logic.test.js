import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import * as T from '../terrain.js';
import { ECON, TIERS, SPECIES, ITEMS, GRID, animalPrice, itemPrice } from '../data.js';

const R = 'grassland';
const rich = (pop = 1e6, seed = 7) => { const S = G.newGame(seed, 0); for (const r of Object.values(S.regions)) r.pop = pop; return S; };
const pop = (S, rid = R) => G.popOf(S, rid);
const setTier = (S, t) => { S.regions[R].tier = t; S.rev = (S.rev || 0) + 1; };
const place = (S, id) => { const at = G.freeSpot(S, R, id); return G.placeItem(S, R, id, at[0], at[1]); };

test('새 게임: 지역마다 시작 인기점수, T1, 요청 3장, 동물 없음', () => {
  const S = G.newGame(1, 0);
  for (const r of Object.keys(S.regions)) assert.equal(pop(S, r), ECON.start, r);
  assert.equal(S.regions[R].tier, 1);
  assert.equal(S.regions[R].animals.length, 0);
  assert.equal(G.requestsOf(S).length, 3);
});

test('입양은 인기점수로 산다: 값만큼 줄고, 모자라면 못 산다', () => {
  const S = G.newGame(1, 0);
  const price = animalPrice(1);
  const r = G.adopt(S, R, 'rabbit');
  assert.ok(r.ok);
  assert.equal(pop(S), ECON.start - price);
  S.regions[R].pop = price - 1;
  assert.equal(G.adopt(S, R, 'rabbit').ok, false);
  assert.equal(G.canAdopt(S, R, 'rabbit').why, '인기점수가 모자라요');
});

test('해금 전 동물은 못 산다', () => {
  const S = rich();
  assert.equal(G.canAdopt(S, R, 'meerkat').why, 'T2에서 해금');
  setTier(S, 2);
  assert.ok(G.canAdopt(S, R, 'meerkat').ok);
});

test('종 한도·개체 한도: 티어 t → t종 4t마리', () => {
  const S = rich();
  for (let i = 0; i < 4; i++) assert.ok(G.adopt(S, R, 'rabbit').ok);
  assert.equal(G.canAdopt(S, R, 'rabbit').why, '개체 한도 4마리');
  setTier(S, 2);
  assert.ok(G.adopt(S, R, 'meerkat').ok);
  setTier(S, 3);
  assert.ok(G.adopt(S, R, 'gazelle').ok);
  S.regions[R].tier = 2; S.rev++; // 종 2개 한도에서 세 번째 종
  // 이미 3종이 있으니 새 종은 막히고, 있는 종은 개체 한도 안에서 더 살 수 있다
  assert.ok(G.canAdopt(S, R, 'rabbit').ok);
});

test('한 종 32마리 구성도 한도 안이면 된다', () => {
  const S = rich();
  setTier(S, 8);
  for (let i = 0; i < 32; i++) assert.ok(G.adopt(S, R, 'elephant').ok, `${i}번째`);
  assert.equal(G.canAdopt(S, R, 'elephant').why, '개체 한도 32마리');
  assert.equal(G.canAdopt(S, R, 'rabbit').why, '개체 한도 32마리');
});

test('새 종 한도: T2에서 2종이 차면 세 번째 종은 막힌다', () => {
  const S = rich();
  setTier(S, 3);
  G.adopt(S, R, 'rabbit'); G.adopt(S, R, 'meerkat');
  setTier(S, 2);
  assert.equal(G.canAdopt(S, R, 'gazelle').why, 'T3에서 해금');
  setTier(S, 3);
  assert.ok(G.canAdopt(S, R, 'gazelle').ok);
  G.adopt(S, R, 'gazelle');
  assert.equal(G.stats(S, R).species, 3);
});

test('티어가 올라도 동물·인기점수를 공짜로 주지 않는다', () => {
  const S = rich(5000);
  for (let i = 0; i < 4; i++) G.adopt(S, R, 'rabbit');
  place(S, 'grass'); place(S, 'grass'); place(S, 'hutch'); place(S, 'hutch');
  const before = pop(S), animals = S.regions[R].animals.length;
  assert.equal(S.regions[R].tier, 2, '발전도 60 이상이면 T2');
  assert.equal(S.regions[R].animals.length, animals);
  assert.equal(pop(S), before);
  assert.ok(S.events.some((e) => e.type === 'tier' && e.tier === 2));
});

test('발전도 공식: (동물 + 다양성 + 꾸밈) × (0.5 + 0.5 × 행복도)', () => {
  const S = rich();
  for (let i = 0; i < 4; i++) G.adopt(S, R, 'rabbit'); // 토끼 가치 6 × 4 = 24, 다양성 30
  place(S, 'grass'); place(S, 'hutch'); // 꾸밈 6 + 6 = 12. 먹이 2/4 = 0.5, 쉼터 3/4 = 0.75
  const st = G.stats(S, R);
  assert.equal(st.animal, 24);
  assert.equal(st.diversity, 30);
  assert.equal(st.decor, 12);
  assert.equal(st.H, 0.625);
  assert.equal(st.dev, Math.round(66 * (0.5 + 0.5 * 0.625)));
});

test('같은 종 5마리째부터, 같은 물건 3개째부터 점수 절반', () => {
  const S = rich();
  setTier(S, 2);
  for (let i = 0; i < 6; i++) G.adopt(S, R, 'rabbit');
  assert.equal(G.stats(S, R).animal, 6 * 4 + 3 * 2);
  for (let i = 0; i < 4; i++) place(S, 'fence');
  assert.equal(G.stats(S, R).decor, 8 * 2 + 4 * 2);
});

test('행복도: 크기만큼 소비(XL 3), 무리는 같은 종 3마리부터', () => {
  const S = rich();
  setTier(S, 8);
  G.adopt(S, R, 'elephant'); G.adopt(S, R, 'elephant');
  place(S, 'feeder'); // 먹이 6 / 수요 6 → 1
  let st = G.stats(S, R);
  assert.equal(st.demand.food, 6);
  assert.equal(st.needMet.elephant.food, 1);
  assert.equal(st.needMet.elephant.water, 0);
  assert.equal(st.needMet.elephant.herd, 2 / 3);
  G.adopt(S, R, 'elephant');
  st = G.stats(S, R);
  assert.equal(st.needMet.elephant.herd, 1);
  assert.equal(st.needMet.elephant.food, 6 / 9);
});

test('티어는 내려가지 않는다(방생해도 그대로), 방생은 50% 환급', () => {
  const S = rich(5000);
  for (let i = 0; i < 4; i++) G.adopt(S, R, 'rabbit');
  place(S, 'grass'); place(S, 'grass'); place(S, 'hutch'); place(S, 'hutch');
  assert.equal(S.regions[R].tier, 2);
  const a = S.regions[R].animals[0], before = pop(S);
  const r = G.release(S, R, a.uid);
  assert.ok(r.ok);
  assert.equal(pop(S), before + Math.floor(a.paid * 0.5));
  for (const b of [...S.regions[R].animals]) G.release(S, R, b.uid);
  assert.equal(S.regions[R].tier, 2);
});

test('물건 놓기: 칸 밖·겹침은 막고, 치우면 50% 환급', () => {
  const S = rich();
  setTier(S, 7);
  assert.equal(G.canPlace(S, R, 'pond', GRID - 2, GRID - 2).why, '놓을 수 없는 자리예요'); // 3×3이 칸 밖으로 나간다
  assert.ok(G.placeItem(S, R, 'pond', 14, 12).ok); // 초원 가운데 저지대
  assert.equal(G.canPlace(S, R, 'grass', 16, 14).why, '놓을 수 없는 자리예요');
  assert.ok(G.canPlace(S, R, 'grass', 25, 12).ok); // 저지대 둘레 계단 바깥 평지
  assert.equal(G.canPlace(S, R, 'baobab', 0, 10).why, 'T8에서 해금');
  const it = S.regions[R].items[0], before = pop(S);
  assert.ok(G.removeItem(S, R, it.uid).ok);
  assert.equal(pop(S), before + Math.floor(itemPrice(7) * 0.5));
});

test('발전도가 기준을 넘으면 여러 티어도 한 번에, 지역 해금 이벤트', () => {
  const S = rich();
  setTier(S, 3);
  for (const sp of ['rabbit', 'meerkat', 'gazelle']) for (let i = 0; i < 4; i++) G.adopt(S, R, sp);
  for (const id of ['grass', 'grass', 'hutch', 'hutch', 'burrow', 'burrow', 'puddle', 'puddle', 'feeder', 'feeder', 'fence', 'fence']) place(S, id);
  assert.ok(G.stats(S, R).dev >= TIERS[3], `발전도 ${G.stats(S, R).dev}`);
  assert.ok(S.regions[R].tier >= 4);
  assert.ok(S.events.some((e) => e.type === 'region' && e.region === 'seaside'));
  assert.ok(G.isUnlocked(S, 'seaside'));
  assert.equal(G.isUnlocked(S, 'desert'), false);
  assert.ok(G.setView(S, 'seaside').ok, '열린 지역으로 갈 수 있다');
  assert.equal(G.setView(S, 'desert').why, '잠긴 지역');
});

test('길찾기는 막힌 칸을 돌아가고, 물건 위에 선 동물은 빈칸으로 옮긴다', () => {
  const S = rich();
  setTier(S, 7);
  G.placeItem(S, R, 'pond', 14, 12);
  const p = G.findPath(S, R, [12, 14], (x, y) => x === 21 && y === 14);
  assert.ok(p && p.length > 9);
  for (const [x, y] of p) assert.ok(G.walkable(S, R, x, y));
  G.adopt(S, R, 'rabbit');
  const a = S.regions[R].animals[0];
  a.x = 24.5; a.y = 2.5;
  assert.ok(G.placeItem(S, R, 'rocks', 24, 2).ok); // 뒤쪽 평지
  assert.equal(G.walkable(S, R, 24, 2), false);
  assert.ok(G.walkable(S, R, Math.floor(a.x), Math.floor(a.y)));
});

test('동물은 시간이 지나면 움직이고, 먹이가 있으면 먹으러 간다', () => {
  const S = rich();
  for (let i = 0; i < 4; i++) G.adopt(S, R, 'rabbit');
  place(S, 'grass');
  const seen = new Set();
  for (let i = 0; i < 30 * 120; i++) { G.step(S, G.STEP); for (const a of S.regions[R].animals) seen.add(a.st); }
  assert.ok(seen.has('walk'));
  assert.ok(seen.has('eat'));
  for (const a of S.regions[R].animals) assert.ok(G.walkable(S, R, Math.floor(a.x), Math.floor(a.y)));
});

test('관람 수익: 그 지역 발전도 ÷ incomeDiv, 게임을 끈 동안은 최대 30분치', () => {
  const S = rich(0);
  setTier(S, 1);
  S.regions[R].pop = 1000;
  for (let i = 0; i < 4; i++) G.adopt(S, R, 'rabbit');
  const perMin = G.incomePerMin(S);
  assert.equal(perMin, G.stats(S, R).dev / ECON.incomeDiv);
  assert.equal(ECON.offlineCapSec, 30 * 60);
  const p0 = pop(S);
  S.savedAt = 0;
  const r = G.settleOffline(S, 10 * 3600 * 1000);
  assert.equal(r.sec, 10 * 3600);
  assert.ok(r.capped);
  assert.ok(Math.abs(pop(S) - (p0 + perMin * 30)) < 1e-6);
  assert.ok(Math.abs(r.gain - perMin * 30) < 1e-6);
  S.savedAt = 5000;
  assert.equal(G.settleOffline(S, 1000).gain, 0);
});

test('순간 포착: 기회가 떴을 때 그 동물만, 첫 포착 보너스, 앨범·사진 요청 반영', () => {
  const S = rich();
  for (let i = 0; i < 2; i++) G.adopt(S, R, 'rabbit');
  S.regions[R].requests = [{ uid: 999, region: R, kind: 'photo', sp: 'rabbit', n: 1, got: 0, minutes: 3, reward: 15 }];
  S.chanceIn = 0;
  G.step(S, G.STEP);
  assert.ok(S.chance);
  const target = S.chance.uid, other = S.regions[R].animals.find((a) => a.uid !== target);
  assert.equal(S.regions[R].animals.find((a) => a.uid === target).st, 'special');
  assert.equal(G.capture(S, other.uid).ok, false);
  const r = G.capture(S, target);
  assert.ok(r.ok && r.first);
  assert.equal(r.reward, Math.max(ECON.firstMin, Math.round(G.incomePerMin(S) * ECON.firstMinutes)));
  assert.equal(S.album.rabbit, 1);
  assert.equal(S.chance, null);
  assert.ok(G.requestDone(S, G.requestsOf(S)[0]));
  // 기회가 지나면 못 찍는다
  S.chanceIn = 0; G.step(S, G.STEP);
  const t2 = S.chance.uid;
  for (let i = 0; i < 30 * (ECON.chanceLen + 0.2); i++) G.step(S, G.STEP);
  assert.equal(G.capture(S, t2).ok, false);
});

test('관람객 요청: 다 되면 [받기]로 보상, 덜 되면 못 받고, 받으면 새 요청', () => {
  const S = rich(1000);
  S.regions[R].requests = [{ uid: 500, region: R, kind: 'adopt', sp: 'rabbit', n: 2, minutes: 4, reward: 40 }];
  assert.equal(G.claim(S, 500).ok, false);
  G.adopt(S, R, 'rabbit'); G.adopt(S, R, 'rabbit');
  const before = pop(S);
  assert.ok(G.claim(S, 500).ok);
  assert.equal(pop(S), before + 40);
  assert.equal(G.requestsOf(S).length, 3);
  for (const q of G.requestsOf(S)) assert.equal(G.requestDone(S, q), false, '새 요청은 이미 끝난 것이 아니어야 한다');
});

test('요청 바꾸기는 대기 시간이 있다', () => {
  const S = rich();
  const u = G.requestsOf(S)[0].uid;
  assert.ok(G.swapRequest(S, u).ok);
  assert.equal(G.swapRequest(S, G.requestsOf(S)[0].uid).ok, false);
  S.time += ECON.swapCooldown;
  assert.ok(G.swapRequest(S, G.requestsOf(S)[0].uid).ok);
});

test('저장 → 불러오기: 같은 상태, 깨진 저장은 null', () => {
  const S = rich();
  setTier(S, 3);
  G.adopt(S, R, 'gazelle'); place(S, 'puddle');
  for (let i = 0; i < 100; i++) G.step(S, G.STEP);
  const raw = G.serialize(S, 1234);
  const T = G.deserialize(raw);
  assert.equal(T.savedAt, 1234);
  assert.equal(pop(T), pop(S));
  assert.deepEqual(T.regions, S.regions);
  assert.equal(G.stats(T, R).dev, G.stats(S, R).dev);
  assert.equal(G.deserialize('{bad'), null);
  assert.equal(G.deserialize(JSON.stringify({ v: 999 })), null);
});

test('같은 시드면 같은 결과', () => {
  const run = () => {
    const S = rich(1e6, 42);
    setTier(S, 3);
    for (const sp of ['rabbit', 'meerkat', 'gazelle']) G.adopt(S, R, sp);
    place(S, 'grass'); place(S, 'puddle');
    for (let i = 0; i < 30 * 60; i++) G.step(S, G.STEP);
    return G.serialize(S, 0);
  };
  assert.equal(run(), run());
});

test('데이터: 지역마다 동물 8종이 티어 1~8에 하나씩, 물건은 티어마다 지형지물·사물 하나씩, 필요는 그 티어까지의 물건으로 채운다', () => {
  for (const reg of ['grassland', 'seaside', 'desert', 'antarctic']) {
    const sp = Object.values(SPECIES).filter((s) => s.region === reg).map((s) => s.tier).sort();
    assert.deepEqual(sp, [1, 2, 3, 4, 5, 6, 7, 8], reg);
    for (let t = 1; t <= 8; t++) {
      const its = Object.values(ITEMS).filter((i) => i.region === reg && i.tier === t);
      assert.deepEqual(its.map((i) => i.kind).sort(), ['object', 'terrain'], `${reg} T${t}`);
    }
    for (const s of Object.values(SPECIES).filter((x) => x.region === reg)) {
      for (const k of s.needs) {
        if (k === 'herd') continue;
        assert.ok(Object.values(ITEMS).some((i) => i.region === reg && i.tier <= s.tier && i.give[k]), `${s.name} ${k}`);
      }
      if (s.swim) assert.ok(Object.values(ITEMS).some((i) => i.region === reg && i.tier <= s.tier && i.swim), `${s.name} 헤엄칠 물`);
    }
  }
});

test('물에 사는 동물: 바다 지형이나 헤엄칠 물건 칸에서만 움직이고, 바다가 있으면 물건 없이도 입양', () => {
  const S = rich();
  for (const r of ['grassland', 'seaside']) { S.regions[r].tier = 8; }
  S.rev++;
  const W = 'seaside';
  assert.ok(G.canAdopt(S, W, 'otter').ok, '바닷가에는 바다가 있다');
  const pool = G.placeItem(S, W, 'tidepool', 10, 8).item; // 바닷가 모래 저지대
  assert.ok(pool);
  assert.ok(G.adopt(S, W, 'otter').ok);
  const otter = S.regions[W].animals[0];
  for (let i = 0; i < 30 * 90; i++) {
    G.step(S, G.STEP);
    assert.ok(G.walkable(S, W, Math.floor(otter.x), Math.floor(otter.y), true), '해달은 물 칸 안에 있다');
  }
  assert.ok(G.removeItem(S, W, pool.uid).ok, '바다가 있으면 마지막 물건 물도 치울 수 있다');
  assert.ok(G.walkable(S, W, Math.floor(otter.x), Math.floor(otter.y), true), '치운 물에 있던 해달은 바다로 옮긴다');
  // 땅 동물은 물 칸을 걷지 않는다
  G.adopt(S, W, 'crab');
  const crab = S.regions[W].animals.find((a) => a.sp === 'crab');
  for (let i = 0; i < 30 * 60; i++) { G.step(S, G.STEP); assert.ok(G.walkable(S, W, Math.floor(crab.x), Math.floor(crab.y))); }
});

test('지역 해금 사슬: 초원 T4 → 바닷가, 바닷가 T4 → 사막, 사막 T4 → 남극', () => {
  const S = rich();
  assert.equal(G.isUnlocked(S, 'seaside'), false);
  S.regions.grassland.tier = 4; assert.ok(G.isUnlocked(S, 'seaside')); assert.equal(G.isUnlocked(S, 'desert'), false);
  S.regions.seaside.tier = 4; assert.ok(G.isUnlocked(S, 'desert')); assert.equal(G.isUnlocked(S, 'antarctic'), false);
  S.regions.desert.tier = 4; assert.ok(G.isUnlocked(S, 'antarctic'));
});

test('시간대: 1분마다 아침 → 낮 → 저녁 → 밤, 4분 = 하루, 1일차부터(플레이 시간 기준)', () => {
  const S = G.newGame(1, 0);
  const at = (sec) => { S.time = sec; return G.clock(S); };
  assert.deepEqual(at(0), { day: 1, phase: 0, sec: 0 });
  assert.equal(at(59.9).phase, 0);
  assert.equal(at(60).phase, 1);
  assert.equal(at(130).phase, 2);
  assert.equal(at(239).phase, 3);
  assert.deepEqual(at(240), { day: 2, phase: 0, sec: 0 });
  assert.equal(at(240 * 9 + 200).day, 10);
  assert.equal(G.PHASE_NAME[at(200).phase], '밤');
  // 플레이 시간(step)으로만 흐르고, 자리를 비운 시간(오프라인 정산)으로는 흐르지 않는다
  const T = G.newGame(1, 0);
  for (let i = 0; i < 30 * 61; i++) G.step(T, G.STEP);
  assert.equal(G.clock(T).phase, 1);
  T.savedAt = 0; G.settleOffline(T, 3600 * 1000);
  assert.equal(G.clock(T).day, 1);
});

test('지형: 지도 4장은 40×40이고 걷는 칸이 모두 이어지며, 물건마다 놓을 자리가 있다', () => {
  for (const rid of ['grassland', 'seaside', 'desert', 'antarctic']) {
    assert.equal(T.MAPS[rid].length, GRID, rid);
    for (const row of T.MAPS[rid]) assert.equal(row.length, GRID, rid);
    const S = rich();
    const land = [];
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (G.walkable(S, rid, x, y)) land.push([x, y]);
    const [sx, sy] = land[0], p = new Set(), q = [[sx, sy]];
    p.add(sy * GRID + sx);
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!p.has(ny * GRID + nx) && G.walkable(S, rid, nx, ny)) { p.add(ny * GRID + nx); q.push([nx, ny]); } } }
    assert.equal(p.size, land.length, `${rid} 걷는 칸 연결`);
    for (const id of Object.keys(ITEMS).filter((k) => ITEMS[k].region === rid)) assert.ok(G.freeSpot(S, rid, id), `${rid} ${id} 놓을 자리`);
  }
});

test('지형: 봉우리·물은 못 걷고, 물건은 정해진 지형에만, 권하는 지형부터 자리를 고른다', () => {
  const S = rich();
  setTier(S, 8);
  assert.equal(T.kindAt(R, 0, 0), 'peak');
  assert.equal(G.walkable(S, R, 0, 0), false, '봉우리');
  assert.equal(G.walkable(S, 'seaside', 20, 2), false, '땅 동물은 바다를 못 걷는다');
  assert.ok(G.walkable(S, 'seaside', 20, 2, true), '헤엄치는 동물은 바다를 다닌다');
  assert.equal(G.canPlace(S, R, 'pond', 24, 20).why, '저지대에 놓아요', '연못은 저지대에만');
  assert.equal(G.canPlace(S, R, 'hutch', 4, 2).why, '낮은 언덕·평지에 놓아요', '은신처는 높은 언덕에 못 놓는다');
  assert.ok(G.canPlace(S, R, 'tower', 4, 2).ok, '망루는 높은 언덕에');
  assert.equal(G.canPlace(S, R, 'feeder', 0, 18).why, '낮은 언덕·평지에 놓아요', '길은 비워 둔다');
  assert.equal(T.kindAt(R, ...G.freeSpot(S, R, 'hutch')), 'hill', '은신처는 낮은 언덕부터');
  assert.equal(T.kindAt(R, ...G.freeSpot(S, R, 'tower')), 'high', '망루는 높은 언덕부터');
  assert.equal(T.kindAt(R, ...G.freeSpot(S, R, 'puddle')), 'low');
  // 여러 칸 물건은 높이가 같은 칸에만(낮은 언덕과 평지에 걸치면 안 된다)
  assert.equal(T.terrainFits(R, 'rocks', 30, 8), false);
});

test('지형 이전: 지형 전 세이브의 맞지 않는 물건은 맞는 자리로 옮기고, 자리가 없으면 전액 환불', () => {
  const S = rich(1000);
  setTier(S, 7);
  const Rg = S.regions[R];
  Rg.items.push({ uid: 900, id: 'pond', x: 0, y: 0, paid: 50 }, { uid: 901, id: 'hutch', x: 20, y: 36, paid: 10 }, { uid: 902, id: 'tower', x: 5, y: 5, paid: 99 });
  for (let i = 0; i < 4; i++) Rg.items.push({ uid: 910 + i, id: 'pond', x: 0, y: 0, paid: 50 }); // 저지대 자리보다 많은 연못
  G.adopt(S, R, 'rabbit');
  const a = Rg.animals[0]; a.x = 0.5; a.y = 0.5; // 봉우리 위
  const raw = G.serialize(S, 0), L = G.deserialize(raw);
  const items = L.regions[R].items;
  for (const it of items) assert.ok(T.terrainFits(R, it.id, it.x, it.y), it.id);
  assert.ok(items.some((it) => it.uid === 901 && it.x === 20 && it.y === 36), '맞는 물건은 그대로');
  const ponds = items.filter((it) => it.id === 'pond').length, refunded = 5 - ponds;
  assert.ok(ponds >= 1 && refunded >= 1, `연못 ${ponds}개 남고 ${refunded}개 환불`);
  assert.equal(pop(L), pop(S) + refunded * 50);
  const ev = L.events.find((e) => e.type === 'terrain');
  assert.ok(ev && ev.refunded === refunded);
  const b = L.regions[R].animals[0];
  assert.ok(G.walkable(L, R, Math.floor(b.x), Math.floor(b.y)), '봉우리 위 동물은 걷는 칸으로');
  // 이미 맞는 세이브는 손대지 않는다
  const again = G.deserialize(G.serialize(L, 0));
  assert.deepEqual(again.regions, L.regions);
  assert.equal(again.events.length, 0);
});

test('인기점수는 지역마다 따로: 새 지역은 시작 점수부터, 산 값은 그 지역에서만 빠진다', () => {
  const S = G.newGame(3, 0);
  S.regions[R].pop = 5000; S.regions[R].tier = 4; S.rev++;
  assert.ok(G.isUnlocked(S, 'seaside'));
  assert.equal(pop(S, 'seaside'), ECON.start, '초원 점수를 가져가지 않는다');
  assert.ok(G.setView(S, 'seaside').ok);
  assert.equal(pop(S, 'seaside'), ECON.start, '처음 가는 지역은 쉬는 동안 쌓인 것이 없다(발전도 0)');
  assert.ok(G.adopt(S, 'seaside', 'crab').ok);
  assert.equal(pop(S, 'seaside'), ECON.start - animalPrice(1));
  assert.equal(pop(S, R), 5000, '다른 지역 점수는 그대로');
  assert.equal(G.canAdopt(S, 'seaside', 'gull').why, 'T2에서 해금');
  // 보고 있는 지역에만 실시간 수익
  const g0 = pop(S, R), s0 = pop(S, 'seaside');
  for (let i = 0; i < 30 * 60; i++) G.step(S, G.STEP);
  assert.equal(pop(S, R), g0, '쉬는 초원은 실시간으로 쌓이지 않는다');
  assert.ok(pop(S, 'seaside') > s0);
});

test('쉬는 지역: 돌아오면 쉬는 동안의 관람 수익을 받되 최대 30분치, 게임을 끈 시간도 쉬는 시간에 더한다', () => {
  const S = rich(1000);
  setTier(S, 4);
  for (let i = 0; i < 4; i++) G.adopt(S, R, 'rabbit');
  const perMin = G.incomePerMin(S, R);
  assert.ok(perMin > 0);
  G.setView(S, 'seaside');
  S.time += 10 * 60; // 바닷가에서 10분
  const p0 = pop(S, R), back = G.setView(S, R);
  assert.ok(Math.abs(back.rest.gain - perMin * 10) < 1e-6 && !back.rest.capped);
  assert.ok(Math.abs(pop(S, R) - (p0 + perMin * 10)) < 1e-6);
  // 다시 바닷가로 가서 20분 놀고, 게임을 1시간 껐다 켜면 초원은 30분치만
  G.setView(S, 'seaside');
  S.time += 20 * 60;
  S.savedAt = 0; G.settleOffline(S, 3600 * 1000);
  const p1 = pop(S, R), again = G.setView(S, R);
  assert.ok(again.rest.capped);
  assert.ok(Math.abs(pop(S, R) - (p1 + perMin * 30)) < 1e-6);
});

test('v1 세이브(점수 하나를 같이 씀) → v2: 그 점수는 발전도가 가장 높은 지역으로, 나머지는 시작 점수', () => {
  const S = rich(0);
  setTier(S, 4);
  for (let i = 0; i < 3; i++) G.adopt(S, R, 'rabbit');
  const o = JSON.parse(G.serialize(S, 0));
  o.v = 1; o.pop = 777; o.view = 'seaside'; o.requests = []; o.reqSwapAt = 0; // v1 세이브 모양(점수·요청을 같이 씀)
  for (const r of Object.values(o.regions)) { delete r.pop; delete r.away; delete r.requests; delete r.reqSwapAt; }
  const L = G.deserialize(JSON.stringify(o));
  assert.equal(L.v, G.SAVE_VERSION);
  assert.equal(L.pop, undefined);
  assert.equal(pop(L, R), 777);
  for (const r of ['seaside', 'desert', 'antarctic']) assert.equal(pop(L, r), ECON.start, r);
  assert.equal(L.regions.seaside.away, null, '보던 지역은 쉬지 않는다');
  assert.equal(L.regions[R].away, L.time);
  assert.equal(G.deserialize(JSON.stringify({ ...o, v: 1, pop: 'x' })), null);
});

test('관람객 요청은 지역마다 따로: 다른 지역에 가면 그 지역 요청 3장, 원래 지역 요청은 그대로 남는다', () => {
  const S = rich(1000);
  setTier(S, 4);
  const grass = G.requestsOf(S, R).map((q) => q.uid);
  assert.equal(grass.length, 3);
  assert.ok(G.requestsOf(S, R).every((q) => q.region === R));
  assert.equal(G.requestsOf(S, 'seaside').length, 0, '아직 안 가 본 지역은 요청이 없다');
  assert.ok(G.setView(S, 'seaside').ok);
  const sea = G.requestsOf(S, 'seaside');
  assert.equal(sea.length, 3);
  assert.ok(sea.every((q) => q.region === 'seaside'));
  assert.deepEqual(G.requestsOf(S, R).map((q) => q.uid), grass, '초원 요청은 그대로');
  // 바꾸기 대기 시간도 지역마다 따로
  assert.ok(G.swapRequest(S, sea[0].uid).ok);
  assert.equal(G.swapRequest(S, G.requestsOf(S, 'seaside')[0].uid).ok, false);
  assert.ok(G.swapRequest(S, grass[0]).ok, '바닷가에서 바꿔도 초원 요청은 바로 바꿀 수 있다');
});

test('v2 세이브(요청을 같이 씀) → v3: 요청은 낸 지역으로 나눠 담는다', () => {
  const S = rich(1000);
  setTier(S, 4);
  const o = JSON.parse(G.serialize(S, 0));
  o.v = 2;
  o.requests = [{ uid: 801, region: R, kind: 'adopt', sp: 'rabbit', n: 1, minutes: 2, reward: 10 }, { uid: 802, region: 'seaside', kind: 'adopt', sp: 'crab', n: 1, minutes: 2, reward: 10 }];
  o.reqSwapAt = 42;
  for (const r of Object.values(o.regions)) { delete r.requests; delete r.reqSwapAt; }
  const L = G.deserialize(JSON.stringify(o));
  assert.equal(L.v, G.SAVE_VERSION);
  assert.equal(L.requests, undefined);
  assert.deepEqual(G.requestsOf(L, R).map((q) => q.uid), [801]);
  assert.deepEqual(G.requestsOf(L, 'seaside').map((q) => q.uid), [802]);
  assert.equal(L.regions.seaside.reqSwapAt, 42);
  assert.equal(G.deserialize(JSON.stringify({ ...o, requests: 'x' })), null);
});

test('v3 세이브(땅 20×20칸) → v4(40×40칸): 물건·동물 좌표를 2배로, 새 지도에 맞게 놓인다', () => {
  const S = rich(1000);
  setTier(S, 7);
  const o = JSON.parse(G.serialize(S, 0));
  o.v = 3;
  o.regions[R].items = [{ uid: 700, id: 'pond', x: 7, y: 6, paid: 40 }, { uid: 701, id: 'hutch', x: 3, y: 12, paid: 10 }];
  o.regions[R].animals = [{ uid: 702, sp: 'rabbit', x: 11.5, y: 3.5, st: 'walk', t: 1, path: [[12, 3]], goal: 'eat', face: 1, ph: 0, jx: 0, jy: 0, paid: 15 }];
  const L = G.deserialize(JSON.stringify(o));
  assert.equal(L.v, G.SAVE_VERSION);
  const pond = L.regions[R].items.find((it) => it.uid === 700), hutch = L.regions[R].items.find((it) => it.uid === 701);
  assert.deepEqual([pond.x, pond.y], [14, 12], '저지대 연못은 같은 자리(2배 좌표)');
  assert.ok(hutch && T.terrainFits(R, 'hutch', hutch.x, hutch.y));
  const a = L.regions[R].animals[0];
  assert.deepEqual([a.x, a.y], [23, 7]);
  assert.equal(a.path, null);
  assert.equal(a.st, 'idle');
});

test('작은 계단: 높이가 다른 지형 사이는 한 칸에 한 계단(높이 1/3단계)씩, 계단 칸은 걷기만 하고 물건은 못 놓는다', () => {
  const S = rich();
  setTier(S, 8);
  let ones = 0, twos = 0;
  for (const rid of ['grassland', 'seaside', 'desert', 'antarctic']) {
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const k = T.kindAt(rid, x, y), h = T.heightAt(rid, x, y);
      if (k === 'peak' || k === 'water') continue;
      // 이웃 칸과의 높이 차는 한 계단(1/3단계)을 넘지 않는다. 봉우리·물, 낮은 언덕이 저지대에 바로 닿는 곳(모래 언덕 절벽)은 뺀다
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nk = T.kindAt(rid, x + dx, y + dy);
        if (!nk || nk === 'peak' || nk === 'water') continue;
        const diff = Math.round(Math.abs(T.heightAt(rid, x + dx, y + dy) - h) * T.SUB);
        if (k === 'high' || nk === 'high') continue; // 높은 언덕은 저지대 바로 옆이면 절벽으로 남는다(모래 언덕·바위 곶)
        assert.ok(diff <= 2, `${rid} (${x},${y})→(${x + dx},${y + dy}) ${diff}계단`); // 언덕과 저지대가 가까운 곳만 두 계단 턱
        if (diff === 2) twos++; else if (diff === 1) ones++;
      }
      if (k === 'step') assert.ok(G.walkable(S, rid, x, y), `${rid} 계단 칸은 걷는다`);
    }
  }
  assert.ok(twos * 10 < ones, `두 계단 턱 ${twos}곳 / 한 계단 ${ones}곳`);
  const step = T.terrainOf(R).indexOf('step'), sx = step % GRID, sy = (step - sx) / GRID;
  assert.ok(step >= 0);
  assert.equal(G.canPlace(S, R, 'hutch', sx, sy).ok, false, '계단 칸엔 물건을 못 놓는다');
});
