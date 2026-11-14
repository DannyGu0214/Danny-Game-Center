// 퀴즈퀴즈 2026 게임 규칙(화면 없음, Node에서 테스트한다).
// 한 판 진행(1부 몸풀기 → 2부 분야 판 → 3부 역전 한 방 → 동점이면 서든데스), 기회 규칙, 점수와 핸디캡,
// 문제 고르기, 맞힐 확률(레이팅 식), 컴퓨터 팀의 답을 여기서 정한다. 수치는 설계 4·5·6·7·10.4절의 첫 제안이다.
import { judgeShort, shuffle } from './hangul.js';

// ---------- 규칙 표 (대니님이 규칙을 바꾸면 이 표만 고친다) ----------
// 2026-11-14 대니님 확정: 어느 기회에 맞혀도 같은 점수(rate 1.0)
export const TURN_RULE = [
  { who: 'turn', rate: 1.0 },              // ① 차례 팀
  { who: 'other', rate: 1.0 },             // ② 상대 팀
  { who: 'turn', rate: 1.0, hint: true },  // ③ 차례 팀 한 번 더(주관식 초성 힌트)
  { who: 'other', rate: 1.0, hint: true }, // ④ 상대 팀 한 번 더
];
export const TIME_LIMIT = { choice: 15, short: 20, number: 20 }; // 기회마다 초

export const CATS = [
  { id: 'science', name: '과학' }, { id: 'history', name: '역사' }, { id: 'geo', name: '지리' },
  { id: 'art', name: '예술' }, { id: 'general', name: '일반상식' }, { id: 'nonsense', name: '넌센스' },
];
export const catName = (id) => CATS.find((c) => c.id === id)?.name ?? id;

export const TIER_NAME = { 1: '맹순이도 안다', 2: '동네 꼬마', 3: '반에서 좀 함', 4: '전교 1등', 5: '천재 박사' };

// 컴퓨터 실력: 등급별 고정 정답률(4지선다는 보기 4개 기준). 플레이어 실력을 따라가지 않는다.
// 2026-11-14 대니님 결정(실력과 난이도 연동 없음)에 따른 Game 칸 기본값, 수치는 미확정이고 sim-match로 맞춘다
export const CPU_SKILL = {
  easy: { name: '살살', acc: { 1: 0.55, 2: 0.45, 3: 0.35, 4: 0.25, 5: 0.15 } },
  normal: { name: '보통', acc: { 1: 0.7, 2: 0.6, 3: 0.5, 4: 0.38, 5: 0.25 } },
  hard: { name: '진심', acc: { 1: 0.82, 2: 0.74, 3: 0.64, 4: 0.52, 5: 0.38 } },
};
export const CPU_CAP = 0.85;     // 어떤 실력이어도 이보다 잘 맞히지 않는다
export const CLOSE_GAP = 300;    // 접전 도우미가 움직이는 점수 차
export const CLOSE_SHIFT = { ahead: -0.1, behind: 0.05 }; // 컴퓨터가 앞서면 정답률을 낮추고, 뒤지면 조금 올린다

export const PART1_COUNT = 6;
export const BOARD_PICKS = 8;    // 팀마다 4칸
// 라운드 구조에 따른 난이도(팀과 무관): 200칸은 100칸보다 한 단계 어렵게, 3부는 ★3 이상(Game 칸 기본값, 미확정)
export const BOARD_ROWS = [{ base: 100, types: ['choice'], tiers: [1, 4] }, { base: 200, types: ['short', 'number'], tiers: [2, 5] }];
export const ANY_TIER = [1, 5], PART3_TIERS = [3, 5];
export const CONQUER_BONUS = 100;
// 3부 역전 한 방 배점: 2026-11-14 대니님 결정으로 미정. 밸런스 조정용 기본값이고 createMatch({ part3Base })로 바꾼다
export const PART3_BASE = 500;

// 팀 칭호: 승수로 오른다(2026-11-14 대니님 결정. 단계 이름과 기준 승수는 첫 제안)
export const TITLES = [
  { wins: 0, name: '새내기 도전자' }, { wins: 1, name: '첫승 신고' }, { wins: 3, name: '동네 퀴즈왕' },
  { wins: 6, name: '반 대표' }, { wins: 10, name: '학교 대표' }, { wins: 15, name: '지역 챔피언' },
  { wins: 25, name: '전국 퀴즈왕' }, { wins: 40, name: '퀴즈의 신' },
];
export function titleOf(wins) {
  let t = TITLES[0];
  for (const x of TITLES) if (wins >= x.wins) t = x;
  return t;
}
export const nextTitle = (wins) => TITLES.find((x) => x.wins > wins) ?? null;

// ---------- 작은 계산 ----------
export const round10 = (v) => Math.round(v / 10) * 10;

// 출제 채점표 합계 → 처음 등급(10.3절)
export function tierOfScore(score) {
  const s = score.reduce((a, b) => a + b, 0);
  return s <= 1 ? 1 : s <= 3 ? 2 : s <= 5 ? 3 : s <= 7 ? 4 : 5;
}

// ---------- 문제 고르기 ----------
// 팀 실력과 상관없이 은행에서 고른다(2026-11-14 대니님 결정). 등급 범위 안에서 은행 분포 그대로 무작위,
// 최근에 본 문항은 뒤로, 한 판에 같은 사실 카드는 한 번. 그 분야나 등급이 바닥나면 조건을 하나씩 푼다.
export function pickQuestion(bank, { cat = null, types, tiers = ANY_TIER, used = new Set(), usedFacts = new Set(), recent = new Set(), rng = Math.random }) {
  const fresh = (q) => !used.has(q.id) && !usedFacts.has(q.fact) && types.includes(q.type) && q.status !== 'retired' && q.status !== 'flagged';
  const inTier = (q) => q.tier >= tiers[0] && q.tier <= tiers[1];
  const tries = [(q) => fresh(q) && inTier(q) && (!cat || q.cat === cat), (q) => fresh(q) && (!cat || q.cat === cat), (q) => fresh(q) && inTier(q), fresh];
  for (const ok of tries) {
    const pool = bank.filter(ok);
    if (!pool.length) continue;
    const unseen = pool.filter((q) => !recent.has(q.id)), from = unseen.length ? unseen : pool;
    return from[Math.floor(rng() * from.length)];
  }
  return null;
}

// ---------- 문제 한 개(기회 규칙) ----------
export function makeRound(q, turn, base) {
  return { q, turn, base, step: 0, out: [], done: false, winner: null, points: 0, tries: [] };
}

export function attemptOf(r) {
  if (r.done) return null;
  const rule = TURN_RULE[r.step];
  return { ...rule, team: rule.who === 'turn' ? r.turn : 1 - r.turn, no: r.step };
}

export const remainingChoices = (r) => (r.q.type === 'choice' ? r.q.choices.map((_, i) => i).filter((i) => !r.out.includes(i)) : []);

// 답 하나 처리. resp: { choice } | { text } | { timeout: true }. 점수는 rate까지만 정하고 배율은 경기가 곱한다.
export function submitRound(r, resp) {
  const at = attemptOf(r);
  if (!at) throw new Error('끝난 문제예요');
  let result, msg = '';
  if (resp.timeout) result = 'timeout';
  else if (r.q.type === 'choice') {
    if (r.out.includes(resp.choice)) throw new Error('이미 지운 보기예요');
    result = resp.choice === r.q.answer ? 'correct' : 'wrong';
  } else {
    const j = judgeShort(r.q, resp.text);
    result = j.result; msg = j.msg ?? '';
  }
  r.tries.push({ team: at.team, step: at.no, result, resp });
  if (result === 'correct') {
    r.done = true; r.winner = at.team;
    return { result, team: at.team, rate: at.rate, reveal: true, msg };
  }
  if (r.q.type === 'choice' && resp.choice != null) r.out.push(resp.choice);
  r.step++;
  // 4지선다는 보기가 하나만 남으면 맞힌 게 아니라서 바로 정답을 공개한다
  const lastOne = r.q.type === 'choice' && remainingChoices(r).length <= 1;
  if (r.step >= TURN_RULE.length || lastOne) r.done = true;
  return { result, team: at.team, rate: 0, reveal: r.done, msg };
}

// ---------- 한 판 ----------
// teams: [{ duo, cpu: null | 'easy' | 'normal' | 'hard' }, …] A팀이 0, B팀이 1
export function createMatch({ teams, bank, rng = Math.random, recent = new Set(), close = true, part3Base = PART3_BASE }) {
  return {
    teams, bank, rng, recent, close, part3Base,
    scores: [0, 0], phase: 'opening', nextTurn: 0,
    used: new Set(), usedFacts: new Set(),
    part1Cats: shuffle(CATS.map((c) => c.id), rng), part1Done: 0,
    board: CATS.map((c) => ({ cat: c.id, cells: BOARD_ROWS.map((row) => ({ base: row.base, owner: null })) })),
    boardPicks: 0, part3Done: false, suddenNo: 0, suddenWinner: null,
    round: null, slot: null, log: [],
  };
}

const takeTurn = (m) => { const t = m.nextTurn; m.nextTurn = 1 - t; return t; };
export const leader = (m) => (m.scores[0] === m.scores[1] ? (m.suddenWinner ?? null) : m.scores[0] > m.scores[1] ? 0 : 1);

// 다음에 보여 줄 것: { ev: 'part', part } | { ev: 'question', slot } | { ev: 'board', turn } | { ev: 'end', winner }
export function advance(m) {
  if (m.round && !m.round.done) throw new Error('문제가 아직 안 끝났어요');
  switch (m.phase) {
    case 'opening': m.phase = 'part1'; return { ev: 'part', part: 1 };
    case 'part1':
      if (m.part1Done < PART1_COUNT) return { ev: 'question', slot: { part: 1, cat: m.part1Cats[m.part1Done], base: 100, types: ['choice'], tiers: ANY_TIER, turn: takeTurn(m) } };
      m.phase = 'board'; return { ev: 'part', part: 2 };
    case 'board':
      if (m.boardPicks < BOARD_PICKS && m.board.some((col) => col.cells.some((c) => c.owner === null))) return { ev: 'board', turn: m.nextTurn };
      m.phase = 'part3'; return { ev: 'part', part: 3 };
    case 'part3':
      if (!m.part3Done) {
        const lead = leader(m), turn = lead === null ? takeTurn(m) : 1 - lead; // 뒤진 팀이 차례
        return { ev: 'question', slot: { part: 3, cat: CATS[Math.floor(m.rng() * CATS.length)].id, base: m.part3Base, types: ['short', 'number'], tiers: PART3_TIERS, turn } };
      }
      if (leader(m) === null) { m.phase = 'sudden'; return { ev: 'part', part: 'sudden' }; }
      m.phase = 'end'; return { ev: 'end', winner: leader(m) };
    case 'sudden':
      if (leader(m) === null) return { ev: 'question', slot: { part: 'sudden', cat: null, base: 0, types: ['choice'], tiers: ANY_TIER, turn: m.rng() < 0.5 ? 0 : 1 } };
      m.phase = 'end'; return { ev: 'end', winner: leader(m) };
    default: return { ev: 'end', winner: leader(m) };
  }
}

// 2부: 차례 팀이 칸을 고르면 그 칸의 문제 자리를 만든다
export function chooseCell(m, cat, row) {
  const col = m.board.find((c) => c.cat === cat), cell = col?.cells[row];
  if (!cell || cell.owner !== null) throw new Error('고를 수 없는 칸이에요');
  const R = BOARD_ROWS[row];
  return { part: 2, cat, row, base: R.base, types: R.types, tiers: R.tiers, turn: takeTurn(m) };
}

// 문제 자리에 문항을 골라 문제를 시작한다(등급은 라운드 구조로만 정한다)
export function startRound(m, slot) {
  let q = pickQuestion(m.bank, { cat: slot.cat, types: slot.types, tiers: slot.tiers, used: m.used, usedFacts: m.usedFacts, recent: m.recent, rng: m.rng });
  if (!q) q = pickQuestion(m.bank, { cat: null, types: ['choice', 'short', 'number'], used: m.used, usedFacts: new Set(), recent: m.recent, rng: m.rng });
  if (!q) throw new Error('문제은행에 남은 문제가 없어요');
  m.used.add(q.id); m.usedFacts.add(q.fact);
  m.slot = slot;
  m.round = makeRound(q, slot.turn, slot.base);
  return m.round;
}

export const timeFor = (m) => TIME_LIMIT[m.round.q.type];

// 차례인 팀의 답을 처리하고 점수를 더한다. 문제가 끝나면 기록과 칸 상태를 정리한다.
export function answer(m, resp) {
  const r = m.round, out = submitRound(r, resp);
  out.points = 0; out.bonus = 0;
  if (out.result === 'correct') {
    out.points = round10(r.base * out.rate);
    m.scores[out.team] += out.points;
    r.points = out.points;
  }
  if (r.done) out.bonus = finish(m);
  if (out.bonus) m.scores[r.winner] += out.bonus;
  return out;
}

function finish(m) {
  const r = m.round, s = m.slot;
  m.log.push({ id: r.q.id, cat: r.q.cat, tier: r.q.tier, part: s.part, turn: r.turn, winner: r.winner, step: r.winner === null ? null : r.tries.length - 1, points: r.points, first: r.tries[0]?.result === 'correct' });
  let bonus = 0;
  if (s.part === 1) m.part1Done++;
  else if (s.part === 2) {
    m.boardPicks++;
    const col = m.board.find((c) => c.cat === s.cat);
    col.cells[s.row].owner = r.winner === null ? 'none' : r.winner;
    if (r.winner !== null && col.cells.every((c) => c.owner === r.winner)) { bonus = CONQUER_BONUS; m.log.at(-1).conquer = true; }
  } else if (s.part === 3) m.part3Done = true;
  else if (s.part === 'sudden') m.suddenNo++;
  if (s.part === 'sudden' && r.winner !== null) m.suddenWinner = r.winner; // 서든데스는 맞힌 팀이 이긴다(점수는 그대로)
  return bonus;
}

// 오늘의 명장면: 그 판에서 가장 어려운 문제를 맞힌 순간(같으면 나중 것)
export function highlight(m) {
  let best = null;
  for (const e of m.log) if (e.winner !== null && (!best || e.tier >= best.tier)) best = e;
  return best;
}

// ---------- 컴퓨터 팀 ----------
// 컴퓨터가 이번 기회에 맞힐 확률: 등급별 고정 정답률 + 지운 보기만큼 찍기 쉬워짐 + 접전 도우미, 상한 0.85
export function cpuAccuracy(m, t, q, left = 4) {
  let p = CPU_SKILL[m.teams[t].cpu]?.acc[q.tier] ?? 0.5;
  if (q.type === 'choice' && left < 4) p = 1 - (1 - p) * ((left - 1) / 3);
  if (m.close) {
    const gap = m.scores[t] - m.scores[1 - t];
    if (gap > CLOSE_GAP) p += CLOSE_SHIFT.ahead;
    else if (gap < -CLOSE_GAP) p += CLOSE_SHIFT.behind;
  }
  return Math.max(0.02, Math.min(CPU_CAP, p));
}

// 컴퓨터가 지금 기회에 낼 답: { delay(ms), resp, correct }
export function cpuDecide(m, rng = m.rng) {
  const r = m.round, at = attemptOf(r), q = r.q;
  const left = remainingChoices(r);
  const p = cpuAccuracy(m, at.team, q, left.length || 4);
  const correct = rng() < p, delay = 3000 + Math.floor(rng() * 5000);
  if (q.type === 'choice') {
    if (correct) return { delay, correct, resp: { choice: q.answer } };
    const wrong = left.filter((i) => i !== q.answer), lures = wrong.filter((i) => (q.lure ?? []).includes(i));
    const pick = lures.length && rng() < 0.6 ? lures[Math.floor(rng() * lures.length)] : wrong[Math.floor(rng() * wrong.length)];
    return { delay, correct, resp: { choice: pick } };
  }
  if (correct) return { delay, correct, resp: { text: String(q.answer) } };
  if (q.type === 'number') {
    const n = Number(q.answer), d = rng() < 0.5 ? -1 : 1;
    return { delay, correct, resp: { text: String(Math.max(0, n + d * (1 + Math.floor(rng() * 2)))) } };
  }
  const near = Object.keys(q.near ?? {});
  if (near.length && rng() < 0.4) return { delay, correct, resp: { text: near[0] } };
  const dec = q.decoys ?? [];
  const guess = dec.length >= 2 ? shuffle(dec, rng).slice(0, Math.min(3, [...String(q.answer)].length)).join('') : '몰라요';
  return { delay, correct, resp: { text: guess } };
}

// 컴퓨터가 2부에서 칸 고르기: 이미 한 칸을 가진 분야를 먼저(분야 정복), 아니면 아무 칸이나
export function cpuPickCell(m, t, rng = m.rng) {
  const open = [];
  for (const col of m.board) col.cells.forEach((c, row) => { if (c.owner === null) open.push({ cat: col.cat, row, mine: col.cells.some((o) => o.owner === t) }); });
  const mine = open.filter((o) => o.mine);
  const from = mine.length && rng() < 0.6 ? mine : open;
  return from[Math.floor(rng() * from.length)];
}

// ---------- 팀 전적(리셋 전까지 쌓인다) ----------
export function newProfile(duo) {
  return { duo, wins: 0, losses: 0, draws: 0, matches: 0, totalScore: 0, best: 0 };
}

// 한 판 끝: 1P 팀 전적에 결과를 더한다. 반환값은 칭호가 올랐으면 새 칭호
export function recordResult(profile, m, t = 0) {
  const before = titleOf(profile.wins);
  const w = leader(m), score = m.scores[t];
  profile.matches++;
  if (w === t) profile.wins++; else if (w === null) profile.draws++; else profile.losses++;
  profile.totalScore += score;
  profile.best = Math.max(profile.best, score);
  const after = titleOf(profile.wins);
  return after.name !== before.name ? after : null;
}
