// 봇 통과 기준 (docs/p0-p1-tasks.md 4절, 시제품 시계, 시드 1·2·3 평균).
import assert from 'node:assert/strict';
import test from 'node:test';
import { runBot, toTable, type Check, type Report } from '../tools/sim.ts';

let cached: Report | null = null;
const report = () => (cached ??= runBot({ clock: 'prototype', seeds: [1, 2, 3] }));

function expectCheck(id: Check['id']) {
  const check = report().checks.find((c) => c.id === id);
  assert.ok(check);
  assert.ok(check.pass, `${check.label}: 목표 ${check.target}, 결과 ${check.actual}\n${toTable(report())}`);
}

test('봇: 첫 캐기 ≤ 10초', () => expectCheck('firstGather'));
test('봇: 첫 레벨업 ≤ 60초', () => expectCheck('firstLevelUp'));
test('봇: 첫 제작 ≤ 120초', () => expectCheck('firstCraft'));
test('봇: 첫 도구 180~300초', () => expectCheck('firstTool'));
test('봇: S2는 상점이 판매함보다 빨라요', () => expectCheck('s2'));
test('봇: S3 섞기가 상점만보다 많이 벌어요', () => expectCheck('s3mix'));
test('봇: S3 몰아넣기는 섞기보다 적어요', () => expectCheck('s3pile'));
test('봇: 같은 이유의 거절이 50번을 넘지 않아요', () => expectCheck('stuck'));
test('봇: 같은 시드면 결과가 같아요', () => {
  assert.deepEqual(runBot({ seeds: [2] }).runs[0], report().runs[1]);
});
