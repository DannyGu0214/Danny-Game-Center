import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TURN_RULE, makeRound, submitRound, attemptOf, createMatch, advance, startRound, answer, chooseCell, cpuDecide, cpuPickCell,
  tierOfScore, pickQuestion, titleOf, newProfile, recordResult, leader, highlight, PART3_BASE, CPU_CAP, cpuAccuracy, CPU_SKILL, BOARD_ROWS,
} from '../logic.js';
import { BANK } from './fixtures/bank/index.js';

const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const choiceQ = { id: 't-1', type: 'choice', choices: ['a', 'b', 'c', 'd'], answer: 3, tier: 2 };
const shortQ = { id: 't-2', type: 'short', answer: '직지', accept: [], tier: 3 };

test('샘플 문항이 10.9절 형식의 기본 필드를 갖췄다', () => {
  for (const q of BANK) {
    assert.ok(q.id && q.cat && q.fact && q.tier && q.type && q.q && q.explain, q.id);
    assert.equal(tierOfScore(q.score), q.tier, q.id);
  }
});

test('기회 규칙: 차례 → 상대 → 차례 → 상대, 어느 기회든 점수 차감 없음', () => {
  assert.deepEqual(TURN_RULE.map((r) => r.who), ['turn', 'other', 'turn', 'other']);
  assert.ok(TURN_RULE.every((r) => r.rate === 1));
  const r = makeRound(shortQ, 1, 200);
  const teams = [];
  for (let i = 0; i < 3; i++) { teams.push(attemptOf(r).team); submitRound(r, { text: '몰라' }); }
  teams.push(attemptOf(r).team);
  assert.deepEqual(teams, [1, 0, 1, 0]);
  assert.ok(attemptOf(r).hint);
  const out = submitRound(r, { text: '직지' });
  assert.equal(out.result, 'correct'); assert.equal(out.rate, 1); assert.equal(r.winner, 0);
});

test('주관식은 네 번 다 틀리면 정답 공개', () => {
  const r = makeRound(shortQ, 0, 200);
  let out;
  for (let i = 0; i < 4; i++) out = submitRound(r, { timeout: true });
  assert.ok(out.reveal); assert.equal(r.winner, null); assert.equal(attemptOf(r), null);
});

test('4지선다는 보기가 하나만 남으면 맞힌 게 아니라서 바로 공개(보통 ③에서 끝)', () => {
  const r = makeRound(choiceQ, 0, 100);
  assert.equal(submitRound(r, { choice: 0 }).reveal, false);
  assert.equal(submitRound(r, { choice: 1 }).reveal, false);
  const out = submitRound(r, { choice: 2 });
  assert.ok(out.reveal); assert.equal(r.winner, null); assert.deepEqual(r.out, [0, 1, 2]);
  assert.throws(() => submitRound(r, { choice: 3 }));
});

test('지운 보기는 다시 고를 수 없다', () => {
  const r = makeRound(choiceQ, 0, 100);
  submitRound(r, { choice: 0 });
  assert.throws(() => submitRound(r, { choice: 0 }));
});

test('채점표 합계로 등급', () => {
  assert.equal(tierOfScore([0, 0, 0, 1]), 1);
  assert.equal(tierOfScore([1, 0, 1, 1]), 2);
  assert.equal(tierOfScore([1, 1, 0, 2]), 3);
  assert.equal(tierOfScore([3, 2, 0, 1]), 4);
  assert.equal(tierOfScore([3, 2, 2, 1]), 5);
});

test('문제 고르기: 팀과 상관없이 등급 범위 안에서 고르고, 한 판에 같은 사실은 한 번', () => {
  for (let i = 0; i < 50; i++) {
    const q = pickQuestion(BANK, { cat: 'science', types: ['short', 'number'], tiers: BOARD_ROWS[1].tiers, rng: Math.random });
    assert.ok(q.tier >= 2 && q.tier <= 5, q.id);
    const p3 = pickQuestion(BANK, { cat: 'geo', types: ['short', 'number'], tiers: [3, 5], rng: Math.random });
    assert.ok(p3.tier >= 3, p3.id);
  }
  const usedFacts = new Set(['fc-his-jikji']);
  for (let i = 0; i < 20; i++) {
    const x = pickQuestion(BANK, { cat: 'history', types: ['choice', 'short'], usedFacts, rng: Math.random });
    assert.notEqual(x.fact, 'fc-his-jikji');
  }
});

test('문제 고르기: 최근에 본 문항은 다른 게 있으면 피한다', () => {
  const recent = new Set(BANK.filter((q) => q.cat === 'art' && q.type === 'choice' && q.id !== 'art-0003').map((q) => q.id));
  for (let i = 0; i < 10; i++) assert.equal(pickQuestion(BANK, { cat: 'art', types: ['choice'], recent, rng: Math.random }).id, 'art-0003');
});

// 사람 팀을 흉내 내는 봇: 레이팅 식대로 맞힌다
function playMatch(seed, { cpu = 'normal', part3Base } = {}) {
  const rng = mulberry(seed);
  const teams = [{ duo: 'tall-short', cpu: 'normal' }, { duo: 'siblings', cpu }]; // 사람 팀도 같은 정답률 봇으로 둔다
  const m = createMatch({ teams, bank: BANK, rng, part3Base });
  let ev, guard = 0;
  while ((ev = advance(m)).ev !== 'end') {
    if (++guard > 200) throw new Error('끝나지 않아요');
    if (ev.ev === 'part') continue;
    const slot = ev.ev === 'board' ? (() => { const c = cpuPickCell(m, ev.turn, rng); return chooseCell(m, c.cat, c.row); })() : ev.slot;
    startRound(m, slot);
    while (!m.round.done) answer(m, cpuDecide(m, rng).resp);
  }
  return { m, winner: ev.winner };
}

test('한 판이 끝까지 돈다: 1부 6 + 2부 8 + 3부 1, 동점이면 서든데스', () => {
  for (let s = 1; s <= 30; s++) {
    const { m, winner } = playMatch(s);
    const parts = m.log.map((e) => e.part);
    assert.equal(parts.filter((p) => p === 1).length, 6);
    assert.equal(parts.filter((p) => p === 2).length, 8);
    assert.equal(parts.filter((p) => p === 3).length, 1);
    assert.equal(winner, leader(m));
    assert.notEqual(winner, null);
    assert.equal(new Set(m.log.map((e) => e.id)).size, m.log.length);
  }
});

test('3부는 뒤진 팀 차례이고 배점은 설정값', () => {
  const { m } = playMatch(7, { part3Base: 300 });
  const p3 = m.log.find((e) => e.part === 3);
  if (p3.winner !== null) assert.equal(p3.points, 300);
  assert.equal(PART3_BASE, 500);
});

test('2부: 한 분야 두 칸을 모두 맞히면 분야 정복 +100', () => {
  const teams = [{ duo: 'a', cpu: null }, { duo: 'b', cpu: null }];
  const m = createMatch({ teams, bank: BANK, rng: mulberry(3) });
  m.phase = 'board';
  const win = () => { const q = m.round.q; return answer(m, q.type === 'choice' ? { choice: q.answer } : { text: String(q.answer) }); };
  startRound(m, chooseCell(m, 'science', 0)); // A팀 차례
  assert.equal(win().bonus, 0);
  startRound(m, chooseCell(m, 'geo', 0)); // B팀 차례
  answer(m, { timeout: true }); // B 틀림 → A 기회
  const out = (() => { startRound; return win(); })();
  assert.equal(out.team, 0);
  assert.equal(m.scores[0], 200);
  startRound(m, chooseCell(m, 'science', 1)); // A팀 차례
  const o = win();
  assert.equal(o.bonus, 100);
  assert.equal(m.scores[0], 200 + 200 + 100);
});

test('컴퓨터 정답률: 등급별 고정값, 플레이어를 따라가지 않고 상한 0.85', () => {
  const m = createMatch({ teams: [{ duo: 'a', cpu: null }, { duo: 'b', cpu: 'normal' }], bank: BANK, rng: mulberry(5) });
  assert.equal(cpuAccuracy(m, 1, { type: 'short', tier: 1 }), CPU_SKILL.normal.acc[1]);
  assert.equal(cpuAccuracy(m, 1, { type: 'short', tier: 5 }), CPU_SKILL.normal.acc[5]);
  assert.ok(cpuAccuracy(m, 1, { type: 'choice', tier: 3 }, 2) > cpuAccuracy(m, 1, { type: 'choice', tier: 3 }, 4)); // 보기가 줄면 쉬워진다
  m.teams[1].cpu = 'hard';
  assert.ok(cpuAccuracy(m, 1, { type: 'choice', tier: 1 }, 2) <= CPU_CAP);
  m.scores = [0, 400]; // 컴퓨터가 300점 넘게 앞서면 정답률이 내려간다
  assert.ok(cpuAccuracy(m, 1, { type: 'short', tier: 3 }) < CPU_SKILL.hard.acc[3]);
});

test('살살 < 보통 < 진심', () => {
  for (const t of [1, 2, 3, 4, 5]) assert.ok(CPU_SKILL.easy.acc[t] < CPU_SKILL.normal.acc[t] && CPU_SKILL.normal.acc[t] < CPU_SKILL.hard.acc[t]);
});

test('봇 대전: 보통 컴퓨터를 상대로 초등 고학년 봇 승률 55~65%', async () => {
  const { sim } = await import('../tools/sim-match.mjs');
  const r = sim({ n: 1500, skill: 'normal', player: 'kid', rng: mulberry(42) });
  assert.ok(r.win > 0.55 && r.win < 0.65, `승률 ${r.win}`);
});

test('전적과 칭호: 승수로 칭호가 오른다', () => {
  assert.equal(titleOf(0).name, '새내기 도전자');
  assert.equal(titleOf(3).name, '동네 퀴즈왕');
  const p = newProfile('tall-short');
  const { m } = playMatch(11);
  const up = recordResult(p, m, 0);
  assert.equal(p.matches, 1);
  assert.equal(p.wins + p.losses + p.draws, 1);
  assert.equal(p.totalScore, m.scores[0]);
  if (p.wins) assert.equal(up.name, '첫승 신고'); else assert.equal(up, null);
  assert.ok(highlight(m) === null || highlight(m).winner !== null);
});
