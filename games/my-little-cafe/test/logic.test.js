import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import { SCRIPT, NOTES, REACT, EXAM_TEXT } from '../story.js';
import { ESPRESSO, DRIP, MILK, CAFE_NAMES, MENUS, PEOPLE, REGULARS, RUSH, PLACES, CAFE_NAME_MAX, HOME_PASS_STARS, DAILY_GRIND } from '../data.js';

// 샷을 시간에 따라 흘려 보내고 목표 양에서 멈춘다
function pullShot(grindErr, target = ESPRESSO.yield, dose = ESPRESSO.dose) {
  for (let t = 0; t < 120; t += 0.05) {
    const y = G.shotYieldAt(t, grindErr, dose);
    if (y >= target) return { realT: t, yieldG: y };
  }
  return { realT: 120, yieldG: G.shotYieldAt(120, grindErr, dose) };
}

test('샷: 정답 칸이면 25~30초에 36g이 나와요', () => {
  const s = pullShot(0);
  assert.ok(s.realT >= 25 && s.realT <= 30, `${s.realT}초`);
  assert.equal(G.tasteBand(G.shotTaste(s)), 'good');
});

test('샷: 굵으면 빨라서 시큼하고, 고우면 느려서 써요', () => {
  const coarse = pullShot(3), fine = pullShot(-3);
  assert.ok(coarse.realT < 20 && fine.realT > 35);
  assert.equal(G.tasteBand(G.shotTaste(coarse)), 'verySour');
  assert.equal(G.tasteBand(G.shotTaste(fine)), 'veryBitter');
  assert.match(G.grindAdvice('sour'), /곱게/);
  assert.match(G.grindAdvice('bitter'), /굵게/);
});

test('샷: 일찍 멈추면 시큼, 늦게 멈추면 써요', () => {
  assert.ok(G.shotTaste(pullShot(0, 18)) < -0.22);
  assert.ok(G.shotTaste(pullShot(0, 60)) > 0.22);
});

test('별: 잘 만든 잔은 3개, 망친 잔은 적어요', () => {
  const good = G.scoreShot({ doseG: 18, even: 0.92, ...pullShot(0) });
  assert.equal(G.starsOf(good.score), 3);
  const bad = G.scoreShot({ doseG: 12, even: 0.2, ...pullShot(4) });
  assert.ok(G.starsOf(bad.score) <= 1, `${bad.score}`);
});

test('별: 맛이 빗나가면 다른 걸 잘해도 별이 제한돼요', () => {
  assert.equal(G.starsOf(1, 'good'), 3);
  assert.equal(G.starsOf(1, 'sour'), 2);
  assert.equal(G.starsOf(1, 'veryBitter'), 1);
});

test('별 3개는 전부 잘해야 나와요: 양을 벗어나면 맛이 괜찮아도 안 돼요', () => {
  assert.equal(G.starsOf(G.scoreShot({ doseG: 18, even: 0.92, realT: 27, yieldG: 36 }).score), 3);
  const over = G.scoreShot({ doseG: 18, even: 0.9, realT: 27, yieldG: 44.5 });
  assert.ok(G.starsOf(over.score, G.tasteBand(over.taste)) < 3, `${over.score}`);
  const crooked = G.scoreShot({ doseG: 18, even: 0.4, realT: 27, yieldG: 36 });
  assert.ok(G.starsOf(crooked.score) < 3, `${crooked.score}`);
  const dose = G.scoreShot({ doseG: 20, even: 0.9, realT: 27, yieldG: 36 });
  assert.ok(G.starsOf(dose.score) < 3, `${dose.score}`);
  assert.equal(G.hit(0.4, 0.5, 3), 1);
  assert.ok(G.hit(2, 0.5, 3) < 0.6);
  assert.ok(G.mixScore([1, 1, 1, 0]) < 0.5);
});

test('보통 손놀림이면 별 3개가 드물어요: 무작위 오차로 2000잔', () => {
  let s = 12345; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const noise = (a) => (rnd() * 2 - 1) * a;
  const count = [0, 0, 0, 0], n = 2000;
  for (let i = 0; i < n; i++) {
    const err = noise(0.6), doseG = 18 + noise(0.3) * 2.2, even = 0.55 + rnd() * 0.4;
    let t = 0; while (G.shotYieldAt(t, err, doseG) < 36 && t < 90) t += 0.05;
    const realT = t + noise(0.35) * 3.44, yieldG = G.shotYieldAt(realT, err, doseG);
    const r = G.scoreShot({ doseG, even, realT, yieldG });
    count[G.starsOf(r.score, G.tasteBand(r.taste))] += 1;
  }
  const three = count[3] / n;
  assert.ok(three > 0.03 && three < 0.25, `별 3개 비율 ${three} ${count}`);
  assert.ok(count[2] > count[3], `${count}`);
});

test('다지기: 수평이면 균일도가 높고 비뚤면 낮아요', () => {
  assert.ok(G.tampEvenness([0, 0.02, -0.03]) > 0.9);
  assert.ok(G.tampEvenness([0.6, 0.7, -0.6]) === 0);
  assert.ok(Math.abs(G.levelAngle(0, 10) - 10) < 1e-9); // 폰을 눕히면 좌우 기울기 그대로예요
  assert.ok(G.levelAngle(0, -10) < 0);
  assert.ok(Math.abs(G.levelAngle(89, 89) - G.levelAngle(91, -89)) < 1e-6); // 폰을 세워도 값이 튀지 않아요
  assert.equal(G.tiltFromAngle(15, 5), 0.5);
  assert.equal(G.tiltFromAngle(90, 0), 1);
  assert.equal(G.tampEvenness([0.1, -0.08, 0.05]), 1); // 수평 칸 안쪽에서 조금 흔들리는 건 괜찮아요
  assert.ok(G.channelFlowBoost(0.2) > G.channelFlowBoost(0.9));
});

test('스팀: 공기는 수면에서만 들어가고, 초록 칸에서 만점이에요', () => {
  const m0 = { temp: MILK.start, foam: 0 };
  assert.equal(G.steamStep(m0, 0.9, 1).foam, 0);
  assert.ok(G.steamStep(m0, 0.1, 1).foam > 0);
  assert.equal(G.scoreMilk({ temp: 62, foam: 0.35 }).score, 1);
  assert.deepEqual([0.1, 0.35, 0.8].map(G.latteLook), ['thin', 'heart', 'foam']); // 거품이 알맞아야 하트가 떠요
  const hot = G.scoreMilk({ temp: 80, foam: 0.35 });
  assert.ok(hot.burnt && hot.score < 0.6);
  assert.ok(G.scoreMilk({ temp: 62, foam: 1 }).foamScore < 0.5);
  assert.ok(G.scoreMilk({ temp: 62, foam: 0.6 }).foamScore < 1);
});

// 드립: 고르게 원을 그리며 다 붓는 봇
function pourDrip(grindErr, { circle = true, water = DRIP.water } = {}) {
  const dt = 1 / 30, d = G.newDrip(grindErr);
  d.phase = 'pour';
  let a = 0;
  while (d.poured < water && d.t < 200) {
    a += dt * 3.5;
    const r = 0.1 + 0.8 * Math.abs(Math.sin(a * 0.18));
    if (d.level < 70) G.dripStep(d, circle ? { x: Math.cos(a) * r, y: Math.sin(a) * r } : { x: 0, y: 0 }, dt);
    else G.dripStep(d, null, dt);
  }
  while (d.level > 0.5 && d.t < 400) G.dripStep(d, null, dt);
  return d;
}

test('드립: 뜸 없이 고르게 부으면 시간은 조금 짧고 물은 고르게 닿아요', () => {
  const d = pourDrip(0), real = G.dripRealTime(d.t);
  assert.ok(real > 145 && real < 215, `${real}초`);
  const even = G.dripEvenness(d.wet);
  assert.ok(even > 0.5, `균일 ${even}`);
});

test('드립: 한가운데만 부으면 균일도가 낮고, 굵으면 시큼 곱게 쓰다', () => {
  const center = pourDrip(0, { circle: false });
  assert.ok(G.dripEvenness(center.wet) < 0.3, `${G.dripEvenness(center.wet)}`);
  const coarse = pourDrip(3.5), fine = pourDrip(-3.5);
  assert.ok(G.dripTaste({ gameT: coarse.t, water: coarse.poured }) < -0.22, `굵게 ${coarse.t}`);
  assert.ok(G.dripTaste({ gameT: fine.t, water: fine.poured }) > 0.22, `곱게 ${fine.t}`);
});

test('드립: 뜸을 들이고 초록 칸(320g)까지 부으면 약 3분 + 좋은 맛이에요', () => {
  const dt = 1 / 30, d = G.newDrip(0);
  while (d.poured < DRIP.bloomWater) G.dripStep(d, { x: 0.4, y: 0 }, dt);
  for (let i = 0; i < DRIP.bloomReal / (DRIP.time / DRIP.gameSec) / dt; i++) G.dripStep(d, null, dt);
  d.phase = 'pour';
  let a = 0;
  while (d.poured < DRIP.water) {
    a += dt * 3.5;
    const r = 0.1 + 0.8 * Math.abs(Math.sin(a * 0.18));
    G.dripStep(d, d.level < 90 ? { x: Math.cos(a) * r, y: Math.sin(a) * r } : null, dt);
  }
  while (d.level > 2) G.dripStep(d, null, dt);
  const real = G.dripRealTime(d.t);
  assert.ok(real > 145 && real < 215, `${real}초`);
  const taste = G.dripTaste({ gameT: d.t, water: d.poured });
  assert.equal(G.tasteBand(taste), 'good', `${taste} ${real}`);
  const r = G.scoreDrip({ gameT: d.t, water: d.poured, even: G.dripEvenness(d.wet), bloom: 1 });
  assert.ok(G.starsOf(r.score, G.tasteBand(r.taste)) >= 2, `${r.score}`);
});

test('뜸: 40g까지 약 6초 걸리고, 그만큼 추출 시간이 늘지는 않아요', () => {
  const d = G.newDrip(0);
  let sec = 0;
  while (d.poured < DRIP.bloomWater) { G.dripStep(d, { x: 0.3, y: 0 }, 1 / 30); sec += 1 / 30; }
  assert.ok(sec > 5.5 && sec < 7, `${sec}초`);
  assert.ok(d.t < 2.5, `시계 ${d.t}`);
  // 초록 칸을 지나가는 시간도 3초 넘게 있어요
  assert.ok((DRIP.bloomOk * 2) / G.BLOOM_POUR_RATE > 3);
});

test('드립 칸: 원 안은 칸 번호, 밖은 -1', () => {
  assert.equal(G.dripCell(2, 0), -1);
  for (const [x, y] of [[0, 0], [0.9, 0], [-0.5, 0.5], [0, -0.3]]) {
    const c = G.dripCell(x, y);
    assert.ok(c >= 0 && c < G.DRIP_CELLS);
  }
});

test('뜸: 40g과 30초 근처에서 점수가 높아요', () => {
  assert.equal(G.bloomScore(DRIP.bloomWater, DRIP.bloomReal), 1);
  assert.ok(G.bloomScore(150, 2) < 0.3);
});

test('시작 선택: 이름을 다듬고 잘못된 선택은 막아요', () => {
  assert.equal(G.cleanCafeName('  봄볕   창가 '), '봄볕 창가');
  assert.equal([...G.cleanCafeName('가'.repeat(30))].length, CAFE_NAME_MAX);
  assert.equal(G.validChoices({ hero: 'M', owner: 'F', place: 'office', cafe: '  ' }), false);
  assert.equal(G.validChoices({ hero: 'M', owner: 'F', place: 'home', cafe: '윤슬' }), true);
  assert.equal(CAFE_NAMES.length, 5);
  assert.ok(CAFE_NAMES.every((c) => c.name.split(' ').length <= 2));
});

const textsOf = () => {
  const out = [];
  for (const day of SCRIPT) for (const b of day) { if (b.text) out.push(b.text); if (b.title) out.push(b.title); if (b.tips) out.push(...Object.values(b.tips)); }
  for (const n of Object.values(NOTES)) out.push(n.title, n.text);
  const walk = (v) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(REACT); walk(EXAM_TEXT); walk(PLACES); walk(CAFE_NAMES); walk(REGULARS);
  return out;
};

test('문구: 합니다체를 쓰지 않아요(대니님 규칙)', () => {
  for (const t of textsOf()) assert.doesNotMatch(t, /(습니다|합니다|입니다|십시오)/, t);
});

test('문구: 오너 대사에 "자네" 말투, 중심 대사가 있어요', () => {
  const owner = SCRIPT.flat().filter((b) => b.who === 'owner' && b.text).map((b) => b.text);
  assert.ok(owner.some((t) => t.includes('나도 자네 나이에 커피를 시작했다네')));
  assert.ok(owner.filter((t) => t.includes('자네')).length >= 10);
});

test('진행표: 프롤로그가 위치별로 갈리고, 모든 참조가 유효해요', () => {
  const known = new Set(['owner', 'hero', 'narr', 'sys', ...Object.keys(PEOPLE)]);
  for (const place of ['office', 'home']) {
    const S = G.newGame({ hero: 'F', owner: 'M', place, cafe: '봄볕 창가' });
    const seen = new Set();
    let steps = 0, b = G.currentBeat(S);
    while (b) {
      seen.add(b.t);
      if (b.who && (b.t === 'say' || b.t === 'cut' || b.t === 'react' || b.t === 'meet')) assert.ok(known.has(b.who), b.who);
      if (b.place) assert.equal(b.place, place);
      if (b.t === 'note') { assert.ok(NOTES[b.id], b.id); G.addNote(S, b.id); }
      if (b.t === 'brew') { assert.ok(MENUS[b.menu], b.menu); for (const s of b.do) assert.ok(MENUS[b.menu].steps.includes(s), `${b.menu}:${s}`); if (b.for !== 'owner') assert.ok(PEOPLE[b.for], b.for); }
      if (b.t === 'cut' || b.t === 'say') assert.doesNotMatch(G.beatText(S, b), /\{/);
      b = G.nextBeat(S); steps += 1;
      assert.ok(steps < 2000);
    }
    assert.equal(S.done, true);
    for (const t of ['cut', 'say', 'day', 'brew', 'react', 'note', 'exam', 'end']) assert.ok(seen.has(t), `${place} ${t}`);
    // 위치가 다른 프롤로그 문구
    const pro = SCRIPT[0].filter((x) => x.place === place).map((x) => x.text).join(' ');
    assert.match(pro, place === 'office' ? /식당가 골목/ : /토요일 오전/);
    if (place === 'home') for (const id of Object.keys(REGULARS)) assert.ok(S.notes.includes(`reg${id[0].toUpperCase()}${id.slice(1)}`), id);
  }
});

test('시험: 러시와 단골 합격선이 만점 안에 있어요', () => {
  assert.ok(RUSH.passStars <= RUSH.orders.length * 3);
  assert.ok(HOME_PASS_STARS <= Object.keys(REGULARS).length * 3);
  for (const o of RUSH.orders) assert.ok(PEOPLE[o.who] && MENUS[o.menu]);
  assert.equal(DAILY_GRIND.length, 5);
});

test('러시 시험: 늦어도 별은 그대로이고, 합격은 별과 대기 손님을 함께 봐요', () => {
  assert.equal(G.rushPassed(RUSH.passStars, RUSH.maxLate), true);
  assert.equal(G.rushPassed(15, RUSH.maxLate + 1), false);
  assert.equal(G.rushPassed(RUSH.passStars - 1, 0), false);
});

test('저장: 불러오면 그대로이고, 망가진 값은 버려요', () => {
  const S = G.newGame({ hero: 'M', owner: 'F', place: 'home', cafe: '윤슬' });
  S.day = 2; S.beat = 3; S.notes = ['shot'];
  const back = G.normalizeSave(JSON.parse(JSON.stringify(S)));
  assert.deepEqual(back.choices, S.choices);
  assert.equal(back.day, 2); assert.equal(back.beat, 3);
  assert.equal(G.normalizeSave({ v: 99 }), null);
  assert.equal(G.normalizeSave(null), null);
  const odd = G.normalizeSave({ ...S, beat: 99999, notes: ['없음', 'shot'] });
  assert.equal(odd.beat, 0);
  assert.deepEqual(odd.notes, ['shot']);
});
