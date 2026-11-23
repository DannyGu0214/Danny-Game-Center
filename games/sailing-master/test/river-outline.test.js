// 강 그림 윤곽과 물가 판정이 맞는지(2026-11-23 버그: 강머리 남쪽 끝·강 끝 북쪽 끝의 물이 풀밭으로 그려졌어요)
// 원인: outlines()의 양 끝 반원이 늘 각도가 커지는 쪽으로 돌아 강 안쪽으로 접혔어요. 땅 그림(evenodd)은 이 윤곽을 구멍으로 쓰니,
// rawWater로는 물인 끝 반원(물가 거리 최대 약 60m)이 풀밭으로 칠해지고 물고기 그림자가 그 위에 보였어요
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldOf } from '../world.js';

const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [a, b] = P[i], [p, q] = P[j]; if ((b > y) !== (q > y) && x < (p - a) * (y - b) / (q - b) + a) c = !c; } return c; };

test('강 윤곽: 물가 거리 3m 넘는 물은 모두 그림에서도 물(강 양 끝 포함)', () => {
  const w = worldOf('river'), [river, ...isles] = w.outlines(0), [x0, y0, x1, y1] = w.bounds;
  const bad = [];
  for (let x = x0; x < x1; x += 4) for (let y = y0; y < y1; y += 4) {
    if (w.dist(x, y) > 3 && !inPoly(river, x, y)) bad.push([x, y]);
    // 반대로 3m 넘는 뭍이 강 구멍 안에 들어가면 섬 윤곽 안이어야 해요
    if (w.dist(x, y) < -3 && inPoly(river, x, y)) assert.ok(isles.some((P) => inPoly(P, x, y)), `뭍 ${x},${y}가 물로 그려짐`);
  }
  assert.equal(bad.length, 0, `물인데 풀밭으로 그려지는 점 ${bad.length}개, 예: ${bad.slice(0, 3).join(' / ')}`);
  // 강머리 나루 남쪽(바로 그 증상 자리)을 콕 집어서도 봐요
  const head = w.ports.find((p) => p.id === 'head');
  for (let dy = 10; dy <= 60; dy += 10) if (w.dist(head.x, head.y + dy) > 3) assert.ok(inPoly(river, head.x, head.y + dy), `강머리 나루 남쪽 ${dy}m`);
});
