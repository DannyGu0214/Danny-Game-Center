// 문제은행 자동 검사(설계 10.7절 ④).
// 형식, 중복·유사 문항, 길이, 말투, 금지어, 출처, 허용 답, 채점표 합계와 등급을 본다.
// 실행: node tools/check-bank.mjs   (오류가 있으면 종료 코드 1)
// 게임 코드(logic.js·hangul.js)에 기대지 않고 bank/ 파일만 읽어요.
import { BANK, SOURCES } from '../bank/index.js';
export { BANK, SOURCES };

export const CATS = { science: 'sci', history: 'his', geo: 'geo', art: 'art', general: 'gen', nonsense: 'non' };
export const WHEN = ['E1-2', 'E3-4', 'E5-6', 'M', 'X'];
export const STATUS = ['draft', 'checked', 'live', 'flagged', 'retired'];
// 출처 유형. direct = 사실을 가져와 새로 써요, verify = 사실 확인에만 써요(10.8절)
export const LICENSES = {
  'KOGL-1': 'direct', 'KOGL-2': 'direct', 'KOGL-3': 'verify', 'KOGL-4': 'verify',
  'CC-BY': 'direct', 'CC-BY-SA': 'direct', 'PD': 'direct', 'KOGL-free': 'direct', 'fact': 'direct', 'original': 'direct', 'unknown': 'verify',
};
const SCORE_MAX = [3, 2, 2, 2];
const LIMIT = (tier) => (tier <= 2 ? 40 : 60);
const FORMAL = /(합니다|습니다|입니다|입니까|십시오|됩니까|하십시오)/;
// 밝은 병맛만. 더러운 소재·비하 표현은 넣지 않아요(10.6절 9번).
const BANNED = ['똥', '방귀', '오줌', '코딱지', '토하', '바보', '멍청', '돼지같', '못생', '뚱뚱'];
const BANNED_HOSTS = ['namu.wiki', 'namuwiki'];

/** 띄어쓰기·문장부호·가운뎃점을 지우고 소문자로(8.1절 정규화). */
export const normalize = (s) => String(s ?? '').toLowerCase().replace(/[\s\p{P}\p{S}·]/gu, '');
/** 채점표 합계 → 등급. 0~1 ★1 · 2~3 ★2 · 4~5 ★3 · 6~7 ★4 · 8~9 ★5 */
export const tierOfScore = (score) => Math.min(5, Math.floor(score.reduce((a, b) => a + b, 0) / 2) + 1);
const plain = (s) => String(s ?? '').replace(/\*\*/g, '');
const len = (s) => [...plain(s)].length;

function bigrams(s) {
  const t = normalize(s), out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
function similarity(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

export function checkSources(sources = SOURCES) {
  const errs = [], ids = new Set();
  for (const s of sources) {
    const e = (m) => errs.push(`출처 ${s.id ?? '?'}: ${m}`);
    if (!/^[a-z0-9-]+$/.test(s.id ?? '')) e('id 형식');
    if (ids.has(s.id)) e('id 중복');
    ids.add(s.id);
    if (!s.org) e('기관 없음');
    if (!s.title) e('제목 없음');
    if (!(s.license in LICENSES)) e(`유형 ${s.license}`);
    if (s.license !== 'original' && !/^https?:\/\//.test(s.url ?? '')) e('URL 없음');
    if (BANNED_HOSTS.some((h) => (s.url ?? '').includes(h))) e('나무위키는 쓰지 않아요');
    if (s.license !== 'original' && !/^\d{4}-\d{2}-\d{2}$/.test(s.checked ?? '')) e('확인일 YYYY-MM-DD');
  }
  return errs;
}

export function checkBank(bank = BANK, sources = SOURCES) {
  const errs = checkSources(sources);
  const srcIds = new Set(sources.map((s) => s.id));
  const ids = new Set();
  const err = (q, msg) => errs.push(`${q.id ?? '?'}: ${msg}`);

  for (const q of bank) {
    const pre = CATS[q.cat];
    if (!pre) err(q, `분야 ${q.cat}`);
    if (!new RegExp(`^${pre}-\\d{4}$`).test(q.id ?? '')) err(q, `id 형식(${pre}-0000)`);
    if (ids.has(q.id)) err(q, 'id 중복');
    ids.add(q.id);
    if (!/^fc-[a-z0-9-]+$/.test(q.fact ?? '')) err(q, '사실 카드 id(fc-...)');
    if (!q.topic) err(q, '주제 없음');
    if (!WHEN.includes(q.when)) err(q, `교과 시점 ${q.when}`);
    if (typeof q.std !== 'string') err(q, '성취기준 칸(std)은 문자열');

    // 채점표와 등급
    if (!Array.isArray(q.score) || q.score.length !== 4) err(q, '채점표는 4칸');
    else {
      q.score.forEach((v, i) => {
        if (!Number.isInteger(v) || v < 0 || v > SCORE_MAX[i]) err(q, `채점표 ${i + 1}번째 값 ${v}`);
      });
      const t = tierOfScore(q.score);
      if (t !== q.tier && !q.tierWhy) err(q, `채점표 합계 등급 ★${t} ≠ tier ★${q.tier} (tierWhy 없음)`);
    }
    if (![1, 2, 3, 4, 5].includes(q.tier)) err(q, `등급 ${q.tier}`);

    // 문제 글
    const n = len(q.q);
    if (!n) err(q, '문제 없음');
    else if (n > LIMIT(q.tier)) err(q, `문제가 ${n}자(★${q.tier}는 ${LIMIT(q.tier)}자 안)`);
    if (!q.explain || len(q.explain) < 20) err(q, '해설이 너무 짧거나 없음');
    else if (len(q.explain) > 160) err(q, `해설이 ${len(q.explain)}자(160자 안)`);
    const texts = [q.q, q.explain, ...(q.choices ?? []), ...Object.values(q.near ?? {})];
    for (const t of texts) {
      if (t && FORMAL.test(t)) err(q, `'합니다'체: ${t.match(FORMAL)[0]}`);
      const bad = t && BANNED.find((w) => t.includes(w));
      if (bad) err(q, `금지어: ${bad}`);
    }
    if (/모두 정답|정답 없음|모두 아님|모두 맞/.test((q.choices ?? []).join('|'))) err(q, '"모두 정답"·"정답 없음" 보기');
    if (/아닌|않은|않는|틀린/.test(plain(q.q)) && !/\*\*(아닌|않은|않는|틀린)\*\*/.test(q.q)) err(q, '부정형은 **굵게**');

    // 출처와 상태
    if (!q.src?.length) err(q, '출처 없음');
    for (const s of q.src ?? []) if (!srcIds.has(s)) err(q, `출처 id ${s} 가 sources.js에 없음`);
    if (!STATUS.includes(q.status)) err(q, `상태 ${q.status}`);
    if (q.status !== 'draft' && !/^\d{4}-\d{2}-\d{2}$/.test(q.checked ?? '')) err(q, '검증 날짜(checked) 없음');
    if (q.valid && !/^\d{4}(-\d{2}-\d{2})?$/.test(q.valid)) err(q, `유효 기한 ${q.valid}`);

    // 형식별
    if (q.type === 'choice') {
      const c = q.choices ?? [];
      if (c.length !== 4) err(q, '보기는 4개');
      else if (new Set(c.map((x) => x.trim())).size !== 4) err(q, '보기 중복'); // 띄어쓰기만 다른 보기(몇일·몇 일)는 맞춤법 문제라 허용
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(q, '정답 번호');
      if (!Array.isArray(q.lure) || q.lure.some((i) => i === q.answer || !Number.isInteger(i) || i < 0 || i > 3)) err(q, '매력적인 오답 번호(lure)');
      if (q.accept || q.decoys) err(q, '4지선다에는 accept·decoys를 쓰지 않아요');
    } else if (q.type === 'short') {
      if (typeof q.answer !== 'string' || !q.answer) err(q, '주관식 정답');
      else {
        if ([...normalize(q.answer)].length > 8) err(q, '글자 조각 정답은 8자 안');
        const ok = [q.answer, ...(q.accept ?? [])].map(normalize);
        if (new Set(ok).size !== ok.length) err(q, 'accept에 정답과 같은 말');
        for (const k of Object.keys(q.near ?? {})) if (ok.includes(normalize(k))) err(q, `아까운 답 '${k}'이 정답과 같아요`);
        const d = q.decoys ?? [];
        if (d.length < 3) err(q, '미끼 글자(decoys)는 3개 이상');
        if (d.some((x) => [...x].length !== 1)) err(q, '미끼는 한 글자씩');
        if (new Set(d).size !== d.length) err(q, '미끼 중복');
        if (d.some((x) => normalize(q.answer).includes(x))) err(q, '미끼가 정답 글자와 같음');
      }
      if (q.choices) err(q, '주관식에는 choices를 쓰지 않아요');
    } else if (q.type === 'number') {
      if (!Number.isInteger(q.answer) || q.answer < 0) err(q, '숫자 정답');
      if (q.choices || q.decoys) err(q, '숫자 문제에는 choices·decoys를 쓰지 않아요');
    } else err(q, `형식 ${q.type}`);
  }

  // 같은·비슷한 문제(같은 사실 카드끼리는 형식을 바꾼 짝이라 허용)
  for (let i = 0; i < bank.length; i++) {
    for (let j = i + 1; j < bank.length; j++) {
      const a = bank[i], b = bank[j];
      if (normalize(a.q) === normalize(b.q)) err(b, `같은 문제: ${a.id}`);
      else if (a.fact !== b.fact && similarity(a.q, b.q) >= 0.6) err(b, `비슷한 문제: ${a.id}`);
    }
  }
  // "아닌 것은?"은 분야마다 10% 이하
  for (const c of Object.keys(CATS)) {
    const all = bank.filter((q) => q.cat === c);
    const neg = all.filter((q) => /\*\*(아닌|않은|않는|틀린)\*\*/.test(q.q));
    if (all.length && neg.length > Math.max(1, Math.floor(all.length * 0.1))) errs.push(`${c}: 부정형 문제가 ${neg.length}/${all.length}`);
  }
  return errs;
}

export function summary(bank = BANK) {
  const by = (f) => bank.reduce((o, q) => ((o[f(q)] = (o[f(q)] ?? 0) + 1), o), {});
  return { total: bank.length, cat: by((q) => q.cat), tier: by((q) => q.tier), type: by((q) => q.type), status: by((q) => q.status) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errs = checkBank();
  console.log(JSON.stringify(summary()));
  if (errs.length) {
    console.error(errs.join('\n'));
    process.exit(1);
  }
  console.log('문제은행 검사 통과');
}
