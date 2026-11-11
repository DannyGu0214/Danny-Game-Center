// 경제·한도·발전도·행복도·티어·포착·요청·시간 규칙 [AW test/logic.test.js에서 옮긴 것 + 공급 묶음·공생·확장 영역]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, eco, rich, setTier, place, run } from './helpers.js';

const E = eco.econ;

test('새 게임: 시작 인기점수 60, T1, 요청 3장, 생물 없음', () => {
  const S = G.newGame(1, 0);
  assert.equal(S.pop, E.start);
  assert.equal(S.tier, 1);
  assert.equal(S.animals.length, 0);
  assert.equal(G.requestsOf(S).length, 3);
  assert.equal(S.eco, 'atoll');
});

test('들이기는 인기점수로 산다: 값만큼 줄고, 모자라면 못 산다', () => {
  const S = G.newGame(1, 0), price = G.priceOfAnimal('seacucumber');
  assert.equal(price, 15);
  assert.ok(G.adopt(S, 'seacucumber').ok);
  assert.equal(S.pop, E.start - price);
  S.pop = price - 1;
  assert.equal(G.canAdopt(S, 'seacucumber').why, '인기점수가 모자라요');
});

test('가격: T1 생물 15·물건 10 × 1.7^(티어−1), 5 단위', () => {
  assert.deepEqual(G.speciesIds.map((s) => G.priceOfAnimal(s)), [15, 25, 45, 75, 125, 215, 360, 615]);
  assert.equal(G.priceOfItem('lagoonsand'), 10);
  assert.equal(G.priceOfItem('cleaning'), 410);
});

test('해금 전 생물은 못 산다', () => {
  const S = rich();
  assert.equal(G.canAdopt(S, 'hermitcrab').why, 'T2에서 해금');
  setTier(S, 2);
  assert.ok(G.canAdopt(S, 'hermitcrab').ok);
});

test('종 한도·개체 한도: 티어 t → t종 4t마리', () => {
  const S = rich();
  for (let i = 0; i < 4; i++) assert.ok(G.adopt(S, 'seacucumber').ok);
  assert.equal(G.canAdopt(S, 'seacucumber').why, '개체 한도 4마리');
  setTier(S, 3);
  assert.ok(G.adopt(S, 'hermitcrab').ok);
  assert.ok(G.adopt(S, 'anemone').ok);
  setTier(S, 2);
  assert.equal(G.canAdopt(S, 'anemone').why, 'T3에서 해금');
  assert.ok(G.canAdopt(S, 'seacucumber').ok); // 있는 종은 개체 한도 안에서 더 산다
  setTier(S, 7);
  for (let i = S.animals.length; i < 28; i++) assert.ok(G.adopt(S, 'seacucumber').ok);
  assert.equal(G.canAdopt(S, 'seacucumber').why, '개체 한도 28마리');
});

test('T8이 되면 확장 영역이 열리고 개체 한도 44마리(종 한도는 8종 그대로)', () => {
  const S = rich();
  setTier(S, 7);
  assert.equal(G.extOpen(S), false);
  assert.deepEqual(G.caps(S), { species: 7, animals: 28 });
  setTier(S, 8);
  assert.equal(G.extOpen(S), true);
  assert.deepEqual(G.stats(S).caps, { species: 8, animals: 44 });
  for (let i = 0; i < 44; i++) assert.ok(G.adopt(S, 'manta').ok, `${i}번째`);
  assert.equal(G.canAdopt(S, 'manta').why, '개체 한도 44마리');
});

test('티어가 올라도 생물·인기점수를 공짜로 주지 않는다', () => {
  const S = G.newGame(3, 0);
  S.pop = 1000;
  for (let i = 0; i < 4; i++) G.adopt(S, 'seacucumber');
  for (let i = 0; i < 2; i++) { place(S, 'lagoonsand'); place(S, 'feedbasket'); }
  const before = S.pop, n = S.animals.length;
  assert.ok(S.tier >= 2);
  assert.equal(S.animals.length, n);
  assert.equal(S.pop, before);
});

test('발전도 공식: (생물 + 다양성 + 꾸밈) × (0.5 + 0.5 × 행복도)', () => {
  const S = rich();
  G.adopt(S, 'seacucumber'); G.adopt(S, 'seacucumber');
  place(S, 'feedbasket');
  const st = G.stats(S);
  assert.equal(st.animal, 2 * 6);
  assert.equal(st.diversity, 30);
  assert.equal(st.decor, 6);
  // 해삼 2마리: 먹이 3/2 → 1, 쉼터 0 → 행복도 0.5
  assert.equal(st.H, 0.5);
  assert.equal(st.dev, Math.round((12 + 30 + 6) * 0.75));
});

test('같은 종 5마리째부터, 같은 물건 3개째부터 점수 절반', () => {
  const S = rich();
  setTier(S, 2);
  for (let i = 0; i < 6; i++) G.adopt(S, 'seacucumber');
  for (let i = 0; i < 4; i++) place(S, 'feedbasket');
  const st = G.stats(S);
  assert.equal(st.animal, 6 * 4 + 6 * 0.5 * 2);
  assert.equal(st.decor, 6 * 2 + 6 * 0.5 * 2);
});

test('행복도: 크기만큼 소비(XL 3, L 2), 무리는 같은 종 3마리부터', () => {
  const S = rich();
  setTier(S, 8);
  G.adopt(S, 'manta');
  place(S, 'feedbasket'); // 먹이 3 = 쥐가오리 1마리분
  assert.equal(G.stats(S).demand.water.food, 3);
  assert.equal(G.stats(S).needMet.manta.food, 1);
  G.adopt(S, 'manta');
  assert.equal(G.stats(S).needMet.manta.food, 0.5);
  G.adopt(S, 'moonjelly'); G.adopt(S, 'moonjelly');
  assert.equal(G.stats(S).needMet.moonjelly.herd, 2 / 3);
  G.adopt(S, 'moonjelly');
  assert.equal(G.stats(S).needMet.moonjelly.herd, 1);
});

test('공급 묶음: 육지형은 뭍 공급만, 물속 생물은 물속 공급만, 수면형은 뭍을 먼저 쓰고 모자라면 물속', () => {
  const S = rich();
  setTier(S, 8);
  G.adopt(S, 'hermitcrab'); // 육지형 S(먹이 1)
  G.adopt(S, 'seacucumber'); // 바닥형 S(먹이 1)
  place(S, 'feedbasket'); // 해저 먹이 3
  let st = G.stats(S);
  assert.equal(st.needMet.hermitcrab.food, 0, '해저 먹이 바구니는 소라게가 못 쓴다');
  assert.equal(st.needMet.seacucumber.food, 1);
  place(S, 'palm'); // 뭍 먹이 2
  st = G.stats(S);
  assert.equal(st.needMet.hermitcrab.food, 1);
  // 거북(L, 먹이 2): 뭍 남는 몫이 없으면 물속에서. 뭍 L=2, 소라게 1 + 거북 2 → rL = 2/3, 거북이 못 채운 2/3 → 물속 3 ÷ (해삼 1 + 2/3) → 1
  G.adopt(S, 'greenturtle');
  st = G.stats(S);
  assert.equal(st.ratio.food.land, 2 / 3);
  assert.equal(st.needMet.hermitcrab.food, 2 / 3);
  assert.equal(st.needMet.greenturtle.food, 1);
  assert.equal(st.needMet.seacucumber.food, 1);
  // 물속 먹이가 모자라면 거북도 덜 채운다: 쥐가오리 2마리(먹이 6)
  G.adopt(S, 'manta'); G.adopt(S, 'manta');
  st = G.stats(S);
  const rW = 3 / (1 + 6 + 2 * (1 - 2 / 3));
  assert.ok(Math.abs(st.ratio.food.water - rW) < 1e-9);
  assert.ok(Math.abs(st.needMet.greenturtle.food - (2 / 3 + (1 / 3) * rW)) < 1e-9);
});

test('공생: 흰동가리는 말미잘이 있어야 들이고, 말미잘 1개체가 2마리를 받는다. 마지막 말미잘은 방생할 수 없다', () => {
  const S = rich();
  setTier(S, 4);
  assert.match(G.canAdopt(S, 'clownfish').why, /말미잘/);
  const host = G.adopt(S, 'anemone').animal;
  assert.ok(G.adopt(S, 'clownfish').ok);
  assert.equal(G.stats(S).needMet.clownfish.partner, 1);
  G.adopt(S, 'clownfish'); G.adopt(S, 'clownfish');
  assert.equal(G.stats(S).needMet.clownfish.partner, 2 / 3);
  assert.ok(S.animals.filter((a) => a.sp === 'clownfish').every((a) => a.host === host.uid));
  assert.match(G.release(S, host.uid).why, /마지막 하나는 방생할 수 없어요/);
  const h2 = G.adopt(S, 'anemone').animal;
  assert.equal(G.stats(S).needMet.clownfish.partner, 1);
  assert.ok(G.release(S, host.uid).ok, '말미잘이 둘이면 하나는 방생할 수 있다');
  assert.ok(S.animals.filter((a) => a.sp === 'clownfish').every((a) => a.host === h2.uid), '짝을 잃은 흰동가리는 남은 말미잘로');
  for (const a of S.animals.filter((b) => b.sp === 'clownfish')) assert.ok(G.release(S, a.uid).ok);
  assert.ok(G.release(S, h2.uid).ok, '흰동가리가 없으면 마지막 말미잘도 방생할 수 있다');
});

test('티어는 내려가지 않는다(방생해도 그대로), 방생은 50% 환급', () => {
  const S = rich();
  const a = G.adopt(S, 'seacucumber').animal;
  setTier(S, 3);
  const p = S.pop, r = G.release(S, a.uid);
  assert.ok(r.ok);
  assert.equal(r.refund, Math.floor(15 * 0.5));
  assert.equal(S.pop, p + 7);
  assert.equal(S.tier, 3);
});

test('발전도가 기준을 넘으면 여러 티어도 한 번에 오르고, T8에서 확장 영역이 열렸다는 사건이 나온다', () => {
  const S = rich();
  setTier(S, 8);
  for (const s of G.speciesIds) for (let i = 0; i < 4; i++) G.adopt(S, s);
  for (const id of G.itemIds) { place(S, id); place(S, id); }
  G.drainEvents(S);
  S.tier = 1; S.rev++;
  place(S, 'lagoonsand');
  const ev = G.drainEvents(S).filter((e) => e.type === 'tier' || e.type === 'ext');
  assert.equal(S.tier, 8);
  assert.deepEqual(ev.filter((e) => e.type === 'tier').map((e) => e.tier), [2, 3, 4, 5, 6, 7, 8]);
  assert.ok(ev.some((e) => e.type === 'ext'));
});

test('관람 수익: 분당 발전도 ÷ 25, 고정 단계 1/30초로 쌓이고, 게임을 끈 동안은 최대 30분치', () => {
  const S = rich(7, 0);
  S.pop = 100;
  G.adopt(S, 'seacucumber'); G.adopt(S, 'seacucumber');
  const perMin = G.incomePerMin(S), p0 = S.pop;
  S.chanceIn = 1e9; // 포착 기회가 끼지 않게
  assert.equal(G.advance(S, 2), 60);
  assert.ok(Math.abs(S.pop - p0 - perMin / 30) < 1e-6);
  const p1 = S.pop;
  const r = G.settleOffline(S, S.savedAt + 3600 * 1000);
  assert.ok(r.capped);
  assert.ok(Math.abs(S.pop - p1 - perMin * 30) < 1e-6);
  assert.equal(G.settleOffline(S, S.savedAt - 5000).gain, 0, '시계가 뒤로 가면 0');
});

test('순간 포착: 기회가 뜬 생물만, 7초 안에, 첫 포착 보너스, 앨범·사진 요청에 반영', () => {
  const S = rich();
  setTier(S, 2);
  for (let i = 0; i < 3; i++) G.adopt(S, 'seacucumber');
  S.chanceIn = 0.01;
  run(S, 0.1);
  assert.ok(S.chance);
  const target = S.animals.find((a) => a.uid === S.chance.uid), other = S.animals.find((a) => a.uid !== S.chance.uid);
  assert.equal(target.st, 'special');
  assert.equal(G.capture(S, other.uid).ok, false);
  const r = G.capture(S, target.uid);
  assert.ok(r.ok && r.first);
  assert.equal(r.reward, Math.max(10, Math.round(G.incomePerMin(S) * 5)));
  assert.equal(S.album.seacucumber, 1);
  assert.equal(S.chance, null);
  // 두 번째 기회는 7초 동안만
  S.chanceIn = 0.01;
  run(S, 0.1);
  run(S, 6.8);
  assert.ok(S.chance, '7초 안에는 아직 있다');
  run(S, 0.3);
  assert.equal(S.chance, null);
});

test('관람객 요청: 다 되면 [받기]로 보상, 덜 되면 못 받고, 받으면 새 요청', () => {
  const S = G.newGame(5, 0);
  S.pop = 1e6;
  const q = { uid: 999, kind: 'adopt', sp: 'seacucumber', n: 2, minutes: 2, reward: 20 };
  S.requests = [q];
  assert.equal(G.claim(S, 999).why, '아직 덜 됐어요');
  G.adopt(S, 'seacucumber'); G.adopt(S, 'seacucumber');
  const p = S.pop, r = G.claim(S, 999);
  assert.ok(r.ok);
  assert.equal(S.pop, p + 20);
  assert.ok(S.requests.length >= 1 && !S.requests.some((x) => x.uid === 999));
});

test('요청 3장은 종류가 모두 다르고, 여섯 종류가 다 나온다', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const S = rich(seed);
    setTier(S, 6);
    for (const s of G.speciesIds.slice(0, 5)) G.adopt(S, s);
    place(S, 'feedbasket'); place(S, 'palm');
    S.requests = [];
    G.tick(S); // 빈 칸은 1초마다 채운다
    run(S, 1.1);
    const kinds = S.requests.map((q) => q.kind);
    assert.equal(new Set(kinds).size, kinds.length, kinds.join(','));
    kinds.forEach((k) => seen.add(k));
  }
  assert.deepEqual([...seen].sort(), ['adopt', 'happy', 'photo', 'set', 'species', 'terrain']);
});

test('입양 요청은 종마다 4마리까지만, 4마리 찬 종은 요청하지 않는다', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const S = rich(seed);
    setTier(S, 2);
    for (let i = 0; i < 4; i++) G.adopt(S, 'seacucumber');
    S.requests = [];
    run(S, 1.1);
    for (const q of S.requests) if (q.kind === 'adopt') { assert.notEqual(q.sp, 'seacucumber'); assert.ok(q.n <= 4); }
  }
});

test('구역·지형 꾸미기 요청: 그 지형 칸에 걸친 것, 그 수중 층에 놓은 것만 센다', () => {
  const S = rich();
  setTier(S, 6);
  const q1 = { uid: 900, kind: 'terrain', item: 'feedbasket', on: 'thila', n: 1, minutes: 2, reward: 10 };
  const q2 = { uid: 901, kind: 'terrain', item: 'planktonlamp', layer: 'low', n: 1, minutes: 2, reward: 10 };
  S.requests = [q1, q2];
  place(S, 'feedbasket'); // 권하는 자리는 석호
  assert.equal(G.requestDone(S, q1), false);
  place(S, 'feedbasket', { on: 'thila' });
  assert.ok(G.requestDone(S, q1));
  place(S, 'planktonlamp'); // 권하는 층은 중층
  assert.equal(G.requestDone(S, q2), false);
  place(S, 'planktonlamp', { layer: 'low' });
  assert.ok(G.requestDone(S, q2));
});

test('시간대 사진 요청: 그 시간대에 찍은 사진만 친다', () => {
  const S = rich();
  G.adopt(S, 'seacucumber');
  S.requests = [{ uid: 950, kind: 'photo', sp: 'seacucumber', n: 1, got: 0, phase: 3, minutes: 2, reward: 10 }];
  S.time = 10; // 아침
  S.chance = { uid: S.animals[0].uid, t: 5 };
  G.capture(S, S.animals[0].uid);
  assert.equal(S.requests[0].got, 0);
  S.time = 3 * 60 + 5; // 밤
  S.chance = { uid: S.animals[0].uid, t: 5 };
  G.capture(S, S.animals[0].uid);
  assert.equal(S.requests[0].got, 1);
});

test('요청 바꾸기는 60초 대기, 방금 바꾼 것과 같은 요청은 다시 내지 않는다', () => {
  const S = rich();
  setTier(S, 3);
  G.adopt(S, 'seacucumber'); G.adopt(S, 'hermitcrab');
  S.requests = []; run(S, 1.1);
  const q = S.requests[0], key = JSON.stringify({ ...q, uid: 0, reward: 0 });
  assert.ok(G.swapRequest(S, q.uid).ok);
  assert.notEqual(JSON.stringify({ ...S.requests[0], uid: 0, reward: 0 }), key);
  assert.match(G.swapRequest(S, S.requests[0].uid).why, /초 뒤에 바꿀 수 있어요/);
});

test('시간대: 1분마다 아침 → 낮 → 저녁 → 밤, 4분 = 하루, 1일차부터', () => {
  const S = G.newGame(1, 0);
  assert.deepEqual(G.clock(S), { day: 1, phase: 0, sec: 0, name: '아침' });
  S.time = 61; assert.equal(G.clock(S).name, '낮');
  S.time = 239; assert.equal(G.clock(S).name, '밤');
  S.time = 241; assert.equal(G.clock(S).day, 2);
});

test('같은 시드면 같은 결과(생물 움직임·포착 기회·요청까지)', () => {
  const play = () => {
    const S = rich(11);
    setTier(S, 8);
    for (const s of G.speciesIds) { G.adopt(S, s); G.adopt(S, s); }
    for (const id of G.itemIds) place(S, id);
    run(S, 60);
    return G.serialize(S, 0);
  };
  assert.equal(play(), play());
});

test('사건 목록: 들이기·놓기·티어 사건이 쌓이고, 꺼내면 비워진다', () => {
  const S = G.newGame(2, 0);
  S.pop = 500;
  G.adopt(S, 'seacucumber');
  place(S, 'feedbasket');
  const ev = G.drainEvents(S);
  assert.deepEqual(ev.slice(0, 2).map((e) => e.type), ['adopt', 'place']);
  assert.equal(G.drainEvents(S).length, 0);
});
