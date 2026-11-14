// 한글 처리: 초성 뽑기, 정답 정규화와 채점, 주관식 글자 조각(정답 글자 + 미끼 글자) 만들기.
// 화면과 상관없이 Node에서 테스트한다.

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const isSyllable = (code) => code >= 0xac00 && code <= 0xd7a3;

// 초성 힌트: 한글 음절은 초성으로, 나머지(숫자·영문·띄어쓰기)는 그대로 둔다
export function choseong(s) {
  return [...String(s)].map((ch) => {
    const code = ch.charCodeAt(0);
    return isSyllable(code) ? CHO[Math.floor((code - 0xac00) / 588)] : ch;
  }).join('');
}

// 비교용 정규화: 띄어쓰기·문장부호·가운뎃점을 지우고 영문은 소문자로
export function normalize(s) {
  return String(s ?? '').normalize('NFC').toLowerCase().replace(/[\s.,!?'"“”‘’·•ㆍ\-_~()[\]{}:;/]/g, '');
}

// 주관식 채점: 정답·허용 답은 'correct', near에 적힌 흔한 오답은 'near'(메시지 포함), 나머지는 'wrong'.
// 비슷한 답을 자동으로 정답 처리하지 않는다(설계 8.1절).
export function judgeShort(q, input) {
  const v = normalize(input);
  if (!v) return { result: 'wrong' };
  if (q.type === 'number') return { result: Number(v) === Number(q.answer) ? 'correct' : 'wrong' };
  const ok = [q.answer, ...(q.accept ?? [])].some((a) => normalize(a) === v);
  if (ok) return { result: 'correct' };
  for (const [k, msg] of Object.entries(q.near ?? {})) if (normalize(k) === v) return { result: 'near', msg };
  return { result: 'wrong' };
}

// 등급별 미끼 글자 수(★1은 3개, ★5는 9개)
export const DECOY_COUNT = { 1: 3, 2: 4, 3: 6, 4: 7, 5: 9 };

const chars = (s) => [...normalize(s)];

// 글자 조각: 정답 글자 전부 + 미끼. 미끼는 문항의 decoys를 먼저, 모자라면 pool(같은 분야 다른 답)에서.
// 정답 글자와 같은 글자는 미끼로 쓰지 않는다(같은 글자가 두 번 나오면 헷갈려서).
export function makeTiles(q, rng = Math.random, pool = []) {
  const ans = chars(q.answer);
  const want = DECOY_COUNT[q.tier] ?? 4;
  const seen = new Set(ans), decoys = [];
  const take = (list) => { for (const c of list) { if (decoys.length >= want) return; if (!seen.has(c)) { seen.add(c); decoys.push(c); } } };
  take((q.decoys ?? []).flatMap(chars));
  if (decoys.length < want) take(shuffle(pool.flatMap(chars), rng));
  return shuffle([...ans, ...decoys], rng);
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
