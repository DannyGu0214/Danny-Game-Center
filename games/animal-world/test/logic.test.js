import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import { ECON, TIERS, SPECIES, ITEMS, GRID, animalPrice, itemPrice } from '../data.js';

const R = 'grassland';
const rich = (pop = 1e6, seed = 7) => { const S = G.newGame(seed, 0); S.pop = pop; return S; };
const setTier = (S, t) => { S.regions[R].tier = t; S.rev = (S.rev || 0) + 1; };
const place = (S, id) => { const at = G.freeSpot(S, R, id); return G.placeItem(S, R, id, at[0], at[1]); };

test('새 게임: 시작 인기점수, T1, 요청 3장, 동물 없음', () => {
  const S = G.newGame(1, 0);
  assert.equal(S.pop, ECON.start);
  assert.equal(S.regions[R].tier, 1);
  assert.equal(S.regions[R].animals.length, 0);
  assert.equal(S.requests.length, 3);
});

test('입양은 인기점수로 산다: 값만큼 줄고, 모자라면 못 산다', () => {
  const S = G.newGame(1, 0);
  const price = animalPrice(1);
  const r = G.adopt(S, R, 'rabbit');
  assert.ok(r.ok);
  assert.equal(S.pop, ECON.start - price);
  S.pop = price - 1;
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
  const before = S.pop, animals = S.regions[R].animals.length;
  assert.equal(S.regions[R].tier, 2, '발전도 60 이상이면 T2');
  assert.equal(S.regions[R].animals.length, animals);
  assert.equal(S.pop, before);
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
  const a = S.regions[R].animals[0], before = S.pop;
  const r = G.release(S, R, a.uid);
  assert.ok(r.ok);
  assert.equal(S.pop, before + Math.floor(a.paid * 0.5));
  for (const b of [...S.regions[R].animals]) G.release(S, R, b.uid);
  assert.equal(S.regions[R].tier, 2);
});

test('물건 놓기: 칸 밖·겹침은 막고, 치우면 50% 환급', () => {
  const S = rich();
  setTier(S, 7);
  assert.equal(G.canPlace(S, R, 'pond', GRID - 2, GRID - 2).why, '놓을 수 없는 자리예요'); // 3×3이 칸 밖으로 나간다
  assert.ok(G.placeItem(S, R, 'pond', 0, 0).ok);
  assert.equal(G.canPlace(S, R, 'grass', 2, 2).why, '놓을 수 없는 자리예요');
  assert.ok(G.canPlace(S, R, 'grass', 3, 0).ok);
  assert.equal(G.canPlace(S, R, 'baobab', 0, 5).why, 'T8에서 해금');
  const it = S.regions[R].items[0], before = S.pop;
  assert.ok(G.removeItem(S, R, it.uid).ok);
  assert.equal(S.pop, before + Math.floor(itemPrice(7) * 0.5));
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
  G.placeItem(S, R, 'pond', 3, 3);
  const p = G.findPath(S, R, [2, 4], (x, y) => x === 6 && y === 4);
  assert.ok(p && p.length > 4);
  for (const [x, y] of p) assert.ok(G.walkable(S, R, x, y));
  G.adopt(S, R, 'rabbit');
  const a = S.regions[R].animals[0];
  a.x = 1.5; a.y = 1.5;
  G.placeItem(S, R, 'rocks', 1, 1);
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

test('관람 수익: 분당 발전도 ÷ incomeDiv, 오프라인은 최대 4시간', () => {
  const S = rich(0);
  setTier(S, 1);
  S.pop = 1000;
  for (let i = 0; i < 4; i++) G.adopt(S, R, 'rabbit');
  const perMin = G.incomePerMin(S);
  assert.equal(perMin, G.stats(S, R).dev / ECON.incomeDiv);
  const p0 = S.pop;
  S.savedAt = 0;
  const r = G.settleOffline(S, 10 * 3600 * 1000);
  assert.equal(r.sec, 4 * 3600);
  assert.ok(Math.abs(S.pop - (p0 + perMin * 240)) < 1e-6);
  S.savedAt = 5000;
  assert.equal(G.settleOffline(S, 1000).gain, 0);
});

test('순간 포착: 기회가 떴을 때 그 동물만, 첫 포착 보너스, 앨범·사진 요청 반영', () => {
  const S = rich();
  for (let i = 0; i < 2; i++) G.adopt(S, R, 'rabbit');
  S.requests = [{ uid: 999, region: R, kind: 'photo', sp: 'rabbit', n: 1, got: 0, minutes: 3, reward: 15 }];
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
  assert.ok(G.requestDone(S, S.requests[0]));
  // 기회가 지나면 못 찍는다
  S.chanceIn = 0; G.step(S, G.STEP);
  const t2 = S.chance.uid;
  for (let i = 0; i < 30 * (ECON.chanceLen + 0.2); i++) G.step(S, G.STEP);
  assert.equal(G.capture(S, t2).ok, false);
});

test('관람객 요청: 다 되면 [받기]로 보상, 덜 되면 못 받고, 받으면 새 요청', () => {
  const S = rich(1000);
  S.requests = [{ uid: 500, region: R, kind: 'adopt', sp: 'rabbit', n: 2, minutes: 4, reward: 40 }];
  assert.equal(G.claim(S, 500).ok, false);
  G.adopt(S, R, 'rabbit'); G.adopt(S, R, 'rabbit');
  const before = S.pop;
  assert.ok(G.claim(S, 500).ok);
  assert.equal(S.pop, before + 40);
  assert.equal(S.requests.length, 3);
  for (const q of S.requests) assert.equal(G.requestDone(S, q), false, '새 요청은 이미 끝난 것이 아니어야 한다');
});

test('요청 바꾸기는 대기 시간이 있다', () => {
  const S = rich();
  const u = S.requests[0].uid;
  assert.ok(G.swapRequest(S, u).ok);
  assert.equal(G.swapRequest(S, S.requests[0].uid).ok, false);
  S.time += ECON.swapCooldown;
  assert.ok(G.swapRequest(S, S.requests[0].uid).ok);
});

test('저장 → 불러오기: 같은 상태, 깨진 저장은 null', () => {
  const S = rich();
  setTier(S, 3);
  G.adopt(S, R, 'gazelle'); place(S, 'puddle');
  for (let i = 0; i < 100; i++) G.step(S, G.STEP);
  const raw = G.serialize(S, 1234);
  const T = G.deserialize(raw);
  assert.equal(T.savedAt, 1234);
  assert.equal(T.pop, S.pop);
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

test('물에 사는 동물: 헤엄칠 물이 있어야 입양, 물 칸에서만 움직이고, 마지막 물은 치울 수 없다', () => {
  const S = rich();
  for (const r of ['grassland', 'seaside']) { S.regions[r].tier = 8; }
  S.rev++;
  const W = 'seaside';
  assert.equal(G.canAdopt(S, W, 'otter').why, '헤엄칠 물이 필요해요');
  const pool = G.placeItem(S, W, 'tidepool', 4, 4).item;
  assert.ok(G.adopt(S, W, 'otter').ok);
  const otter = S.regions[W].animals[0];
  for (let i = 0; i < 30 * 90; i++) {
    G.step(S, G.STEP);
    assert.ok(G.walkable(S, W, Math.floor(otter.x), Math.floor(otter.y), true), '해달은 물 칸 안에 있다');
  }
  assert.equal(G.removeItem(S, W, pool.uid).why, '물에 사는 동물이 있어서 치울 수 없어요');
  const lagoon = G.placeItem(S, W, 'lagoon', 10, 10).item;
  assert.ok(G.removeItem(S, W, pool.uid).ok, '다른 물이 있으면 치울 수 있다');
  assert.ok(G.walkable(S, W, Math.floor(otter.x), Math.floor(otter.y), true), '치운 물에 있던 해달은 남은 물로 옮긴다');
  assert.ok(lagoon);
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
