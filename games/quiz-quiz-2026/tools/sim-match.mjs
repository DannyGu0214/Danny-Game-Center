// 봇 대전: 사람 팀 봇(레이팅 식대로 맞힌다)과 컴퓨터 팀을 겨루게 해 판 길이, 승률, 3부 역전률을 잰다.
// 실행: node tools/sim-match.mjs [--n 2000] [--skill normal] [--part3 500] [--player kid]
// 사람 봇의 등급별 정답률(--player)은 가정이에요. 문제는 팀 실력과 상관없이 나오고(2026-11-14 대니님 결정), 컴퓨터는 등급별 고정 정답률이에요.
import { BANK } from '../test/fixtures/bank/index.js';
import {
  createMatch, advance, startRound, answer, chooseCell, cpuDecide, cpuPickCell, attemptOf, remainingChoices,
  leader, PART3_BASE,
} from '../logic.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('n', 2000)), SKILL = arg('skill', 'normal'), P3 = Number(arg('part3', PART3_BASE)), PLAYER = arg('player', 'kid');

// 사람 봇 정답률(4지선다 보기 4개 기준): kid = 초등 고학년쯤, adult = 어른, young = 초등 저학년쯤
export const PLAYERS = {
  young: { 1: 0.75, 2: 0.55, 3: 0.4, 4: 0.25, 5: 0.15 },
  kid: { 1: 0.85, 2: 0.72, 3: 0.58, 4: 0.42, 5: 0.28 },
  adult: { 1: 0.95, 2: 0.88, 3: 0.78, 4: 0.62, 5: 0.48 },
};

// 시간 모형(초): 사람이 답하는 시간, 컴퓨터 3~8초, 문제 하나의 연출(카드 등장·정답 공개·해설), 부 소개
const T = { humanChoice: 7, humanShort: 12, perQuestion: 14, perAttempt: 2.5, part: 6, opening: 15, awards: 15, boardPick: 4 };

function humanResp(m, rng) {
  const r = m.round, q = r.q, left = remainingChoices(r);
  let p = PLAYERS[m.player][q.tier];
  if (q.type === 'choice' && left.length < 4) p = 1 - (1 - p) * ((left.length - 1) / 3);
  const ok = rng() < p;
  if (q.type === 'choice') {
    const wrong = left.filter((i) => i !== q.answer);
    return { choice: ok ? q.answer : wrong[Math.floor(rng() * wrong.length)] };
  }
  return { text: ok ? String(q.answer) : '몰라요' };
}

export function sim({ n = N, skill = SKILL, part3 = P3, player = PLAYER, rng = Math.random } = {}) {
  let wins = 0, secs = 0, comeback = 0, p3decides = 0, sudden = 0, scoreA = 0, scoreB = 0;
  for (let k = 0; k < n; k++) {
    const teams = [{ duo: 'tall-short', cpu: null }, { duo: 'siblings', cpu: skill }];
    const m = createMatch({ teams, bank: BANK, rng, part3Base: part3 });
    m.player = player;
    let t = T.opening + T.awards, ev, before3 = null;
    while ((ev = advance(m)).ev !== 'end') {
      if (ev.ev === 'part') { t += T.part; if (ev.part === 3) before3 = leader(m); continue; }
      let slot = ev.slot;
      if (ev.ev === 'board') { const c = cpuPickCell(m, ev.turn, rng); slot = chooseCell(m, c.cat, c.row); t += T.boardPick; }
      startRound(m, slot);
      t += T.perQuestion;
      while (!m.round.done) {
        const team = attemptOf(m.round).team;
        if (m.teams[team].cpu) { const d = cpuDecide(m, rng); t += d.delay / 1000; answer(m, d.resp); }
        else { t += m.round.q.type === 'choice' ? T.humanChoice : T.humanShort; answer(m, humanResp(m, rng)); }
        t += T.perAttempt;
      }
    }
    if (m.suddenNo) sudden++;
    if (before3 !== null && ev.winner !== before3) comeback++;
    if (before3 !== null) p3decides++;
    if (ev.winner === 0) wins++;
    secs += t; scoreA += m.scores[0]; scoreB += m.scores[1];
  }
  return { n, skill, part3, player, win: wins / n, minutes: secs / n / 60, comeback: comeback / Math.max(1, p3decides), sudden: sudden / n, avgA: Math.round(scoreA / n), avgB: Math.round(scoreB / n) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = sim();
  console.log(`판 ${r.n} · 컴퓨터 ${r.skill} · 3부 배점 ${r.part3} · 사람 봇 ${r.player}`);
  console.log(`사람 승률 ${(r.win * 100).toFixed(1)}% · 판 길이 약 ${r.minutes.toFixed(1)}분 · 3부 역전 ${(r.comeback * 100).toFixed(1)}% · 서든데스 ${(r.sudden * 100).toFixed(1)}% · 평균 점수 ${r.avgA} : ${r.avgB}`);
}
