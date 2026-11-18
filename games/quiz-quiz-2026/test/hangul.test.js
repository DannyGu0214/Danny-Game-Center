import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choseong, normalize, judgeShort, makeTiles, DECOY_COUNT } from '../hangul.js';

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('초성 힌트는 한글만 초성으로 바꾼다', () => {
  assert.equal(choseong('직지심체요절'), 'ㅈㅈㅅㅊㅇㅈ');
  assert.equal(choseong('2분음표'), '2ㅂㅇㅍ');
  assert.equal(choseong('수원 화성'), 'ㅅㅇ ㅎㅅ');
});

test('정규화는 띄어쓰기·문장부호·가운뎃점을 지운다', () => {
  assert.equal(normalize(' 이순신 장군! '), '이순신장군');
  assert.equal(normalize('머리·가슴'), '머리가슴');
  assert.equal(normalize('ABC'), 'abc');
});

test('주관식 채점: 허용 답만 정답, near는 아까운 답, 나머지는 오답', () => {
  const q = { type: 'short', answer: '직지', accept: ['직지심체요절'], near: { '직지심경': '아까워요!' } };
  assert.equal(judgeShort(q, '직 지').result, 'correct');
  assert.equal(judgeShort(q, '직지심체요절').result, 'correct');
  const n = judgeShort(q, '직지심경');
  assert.equal(n.result, 'near'); assert.equal(n.msg, '아까워요!');
  assert.equal(judgeShort(q, '직지요').result, 'wrong'); // 비슷한 답을 자동으로 정답 처리하지 않는다
  assert.equal(judgeShort(q, '').result, 'wrong');
  assert.equal(judgeShort({ type: 'number', answer: 11 }, '11').result, 'correct');
  assert.equal(judgeShort({ type: 'number', answer: 11 }, '12').result, 'wrong');
});

test('글자 조각: 정답 글자를 모두 담고, 등급만큼 미끼를 넣고, 정답 글자는 미끼로 안 쓴다', () => {
  const q = { type: 'short', answer: '수증기', tier: 3, decoys: ['공', '기', '산'] };
  const tiles = makeTiles(q, seq([0.3, 0.7, 0.1]), ['얼음', '구름', '이슬비']);
  assert.equal(tiles.length, 3 + DECOY_COUNT[3]);
  for (const c of '수증기') assert.ok(tiles.includes(c));
  assert.equal(tiles.filter((c) => c === '기').length, 1);
  assert.equal(new Set(tiles).size, tiles.length);
});
