// 문제은행과 검사 도구 테스트. 실행: node --test test/bank.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK, SOURCES, checkBank, checkSources, summary, tierOfScore, normalize } from '../tools/check-bank.mjs';

const good = {
  id: 'sci-9001', cat: 'science', fact: 'fc-sci-test', topic: '시험', when: 'E3-4', std: '',
  score: [1, 0, 1, 1], tier: 2, type: 'choice', q: '다음 중 곤충은 무엇일까요?',
  choices: ['거미', '지네', '쥐며느리', '무당벌레'], answer: 3, lure: [0],
  explain: '곤충은 몸이 머리·가슴·배 세 부분이고 다리가 6개예요.', src: ['t-src'], checked: '', status: 'draft', stat: null,
};
const src = [{ id: 't-src', org: '기관', title: '제목', url: 'https://example.org', license: 'KOGL-1', checked: '2026-11-14' }];
const errsOf = (patch) => checkBank([{ ...good, ...patch }], src);

test('지금 문제은행은 검사를 통과해요', () => {
  assert.deepEqual(checkBank(), []);
});

test('시범 묶음: 분야별 10문항, 등급 분포, 형식 비율', () => {
  const s = summary();
  assert.equal(s.total, 60);
  for (const c of ['science', 'history', 'geo', 'art', 'general', 'nonsense']) assert.equal(s.cat[c], 10, c);
  // 목표 15·25·30·20·10% → 60문항이면 9·15·18·12·6
  assert.deepEqual([1, 2, 3, 4, 5].map((t) => s.tier[t]), [9, 15, 18, 12, 6]);
  assert.equal(s.type.choice, 36); // 4지선다 60%
});

test('문항마다 출처가 실제 출처표에 있고, 출처표가 온전해요', () => {
  assert.deepEqual(checkSources(), []);
  const ids = new Set(SOURCES.map((s) => s.id));
  for (const q of BANK) for (const s of q.src) assert.ok(ids.has(s), `${q.id} ${s}`);
});

test('채점표 합계 → 등급', () => {
  assert.equal(tierOfScore([0, 0, 0, 1]), 1);
  assert.equal(tierOfScore([1, 0, 1, 1]), 2);
  assert.equal(tierOfScore([1, 1, 0, 2]), 3);
  assert.equal(tierOfScore([1, 2, 2, 1]), 4);
  assert.equal(tierOfScore([3, 2, 2, 2]), 5);
});

test('정규화: 띄어쓰기·문장부호·가운뎃점', () => {
  assert.equal(normalize(' 장보고 과학·기지! '), '장보고과학기지');
});

test('검사 도구가 잘못된 문항을 잡아요', () => {
  assert.deepEqual(errsOf({}), []);
  assert.match(errsOf({ tier: 3 }).join(), /채점표 합계/);
  assert.match(errsOf({ q: '다음 중 곤충은 무엇입니까?' }).join(), /합니다/);
  assert.match(errsOf({ q: '다음 중 곤충이 아닌 것은?' }).join(), /굵게/);
  assert.match(errsOf({ src: ['nope'] }).join(), /출처 id/);
  assert.match(errsOf({ lure: [3] }).join(), /lure/);
  assert.match(errsOf({ choices: ['거미', '지네', '모두 정답', '무당벌레'] }).join(), /모두 정답/);
  assert.match(errsOf({ q: '가'.repeat(41) }).join(), /41자/);
  assert.match(errsOf({ explain: '방귀 뀌는 곤충 이야기로 웃겨 보는 해설이에요.' }).join(), /금지어/);
  assert.match(errsOf({ status: 'checked' }).join(), /검증 날짜/);
  const short = { type: 'short', choices: undefined, lure: undefined, answer: '무당벌레', accept: [], near: {}, decoys: ['거', '미', '지'] };
  assert.deepEqual(errsOf(short), []);
  assert.match(errsOf({ ...short, decoys: ['무', '거', '미'] }).join(), /미끼가 정답/);
  assert.match(errsOf({ ...short, near: { '무당 벌레': 'x' } }).join(), /아까운 답/);
  assert.match(errsOf({ ...short, answer: '아주아주긴정답입니다요' }).join(), /8자/);
});

test('같은 문제, 비슷한 문제를 잡아요', () => {
  const b = { ...good, id: 'sci-9002', fact: 'fc-sci-other' };
  assert.match(checkBank([good, b], src).join(), /같은 문제/);
  assert.match(checkBank([good, { ...b, q: '다음 중에 곤충은 무엇일까요?' }], src).join(), /비슷한 문제/);
});

test('출처표 검사: 나무위키, URL, 유형', () => {
  assert.match(checkSources([{ ...src[0], url: 'https://namu.wiki/w/x' }]).join(), /나무위키/);
  assert.match(checkSources([{ ...src[0], url: '' }]).join(), /URL/);
  assert.match(checkSources([{ ...src[0], license: 'KOGL-9' }]).join(), /유형/);
});
