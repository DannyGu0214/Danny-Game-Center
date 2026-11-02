import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import * as W from '../world.js';
import { NO_GO } from '../data.js';

const D = Math.PI / 180;
const run = (S, sec) => { for (let i = 0; i < sec * 30; i++) G.step(S, G.FIXED_DT); return S; };
test('폴라: 맞바람 금지 구역은 0, 옆바람이 가장 빠르고 뒷바람은 그보다 느리다', () => {
  assert.equal(G.polar(0), 0);
  assert.equal(G.polar(NO_GO), 0);
  assert.ok(G.polar(90 * D) > G.polar(60 * D));
  assert.ok(G.polar(90 * D) > G.polar(180 * D));
  assert.ok(G.polar(50 * D) > 0);
});

test('지도: 출발점은 물이고, 섬과 바깥은 땅이다', () => {
  const S = G.newGame(1);
  assert.ok(W.dist(S.boat.x, S.boat.y) > 20);
  for (const I of [[54, -118], [-62, 26], [44, 112]]) assert.equal(W.isWater(I[0], I[1]), false);
  assert.equal(W.isWater(0, 480), false);
  assert.equal(W.isWater(0, 0), true);
});

test('돛을 안 올리고 노도 안 저으면 거의 움직이지 않는다', () => {
  const S = G.newGame(1);
  const { x, y } = S.boat;
  run(S, 10);
  assert.ok(Math.hypot(S.boat.x - x, S.boat.y - y) < 6);
  assert.ok(S.boat.spd < 0.1);
});

test('돛: 옆바람에서 빠르고, 맞바람 금지 구역에서는 서서히 멈춘다', () => {
  const beam = G.newGame(1);
  G.setSail(beam, 2);
  G.step(beam, G.FIXED_DT);
  beam.boat.h = beam.wind.from + Math.PI / 2;
  run(beam, 8);
  beam.boat.h = beam.wind.from + Math.PI / 2;
  assert.ok(beam.boat.spd > 3, `옆바람 속도 ${beam.boat.spd}`);

  const irons = G.newGame(1);
  G.setSail(irons, 2);
  irons.boat.spd = 5;
  for (let i = 0; i < 25 * 30; i++) { G.step(irons, G.FIXED_DT); irons.boat.h = irons.wind.from; }
  assert.ok(irons.boat.spd < 1, `맞바람 속도 ${irons.boat.spd}`);
  assert.ok(irons.boat.luff);
});

test('돛을 줄이면 느려지고, 돛 각도는 바람 반대쪽으로 간다', () => {
  const speedAt = (lv) => {
    const S = G.newGame(2);
    G.setSail(S, lv);
    S.boat.y = 0; S.boat.x = -20; // 물가에 닿기 전에 잰다
    for (let i = 0; i < 8 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.h = S.wind.from + Math.PI / 2; }
    return S;
  };
  const full = speedAt(2), half = speedAt(1);
  assert.ok(half.boat.spd < full.boat.spd);
  // 뱃머리가 바람 오른쪽 90°면 바람은 왼쪽(좌현)에서 불고, 돛은 오른쪽(+)으로 간다
  assert.ok(full.boat.boom > 0, `돛 각도 ${full.boat.boom}`);
  assert.ok(full.boat.heel < 0, `기울기 ${full.boat.heel}`);
});

test('노: 맞바람에도 가고, 오래 저으면 지친다', () => {
  const S = G.newGame(1);
  G.setRow(S, true);
  for (let i = 0; i < 12 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.h = S.wind.from; }
  assert.ok(S.boat.spd > 2, `노 속도 ${S.boat.spd}`);
  const fresh = S.boat.stamina;
  assert.ok(fresh < 1);
  S.boat.stamina = 0;
  for (let i = 0; i < 12 * 30; i++) { G.step(S, G.FIXED_DT); S.boat.h = S.wind.from; }
  assert.ok(S.boat.spd < 2, `지친 노 속도 ${S.boat.spd}`);
  G.setRow(S, false);
  run(S, 10);
  assert.ok(S.boat.stamina > 0.2);
});

test('키: 왼쪽 오른쪽으로 돌고, 멈춰 있어도 조금은 돈다', () => {
  const S = G.newGame(1);
  const h0 = S.boat.h;
  G.setRudder(S, 1);
  run(S, 4);
  assert.ok(G.angDiff(S.boat.h, h0) > 0.3);
  const T = G.newGame(1);
  G.setRudder(T, -1);
  run(T, 4);
  assert.ok(G.angDiff(T.boat.h, h0) < -0.3);
});

test('물가에 부딪혀도 땅으로 올라가지 않고 뚫고 나가지 않는다', () => {
  for (const h of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7, 2.4]) {
    const S = G.newGame(3);
    G.setRow(S, true); G.setSail(S, 2);
    for (let i = 0; i < 300 * 30; i++) {
      G.step(S, G.FIXED_DT); S.boat.h = h; S.boat.stamina = 1;
      assert.ok(W.dist(S.boat.x, S.boat.y) > 0, `땅 위 ${S.boat.x},${S.boat.y}`);
    }
    assert.ok(S.boat.grounded, `방향 ${h}`);
  }
});

test('자동 항로: 맞바람 쪽 목적지도 태킹해서 도착한다', () => {
  const S = G.newGame(1);
  // 바람이 불어오는 쪽으로 멀리
  G.step(S, G.FIXED_DT);
  const up = S.wind.from, tx = S.boat.x + Math.cos(up) * 90, ty = S.boat.y + Math.sin(up) * 90;
  assert.ok(G.setDest(S, tx, ty));
  let tacks = 0, sec = 0;
  while (S.route && sec < 400) {
    G.step(S, G.FIXED_DT); sec += G.FIXED_DT;
    tacks += S.events.filter((e) => e.type === 'tack').length; S.events.length = 0;
  }
  assert.equal(S.route, null, `도착 못함: ${S.boat.x},${S.boat.y}`);
  assert.ok(tacks >= 1, `태킹 ${tacks}번`);
});

test('자동 항로: 호수 어디서 어디로 가든 시드 3개 × 12쌍 모두 도착하고 땅에 안 닿는다', () => {
  const pts = [[0, 180], [-60, -60], [90, -210], [-110, 120], [100, 40], [10, -60], [-70, -190], [60, -40]];
  let worst = 0;
  for (const seed of [1, 2, 3]) for (let i = 0; i < 12; i++) {
    const S = G.newGame(seed);
    const a = pts[(i * 3 + seed) % pts.length], b = pts[(i * 5 + 2 * seed + 1) % pts.length];
    if (a === b) continue;
    S.boat.x = a[0]; S.boat.y = a[1];
    G.setSail(S, 2);
    assert.ok(W.isWater(a[0], a[1]));
    assert.ok(G.setDest(S, b[0], b[1]));
    let sec = 0;
    while (S.route && sec < 500) {
      G.step(S, G.FIXED_DT); sec += G.FIXED_DT;
      assert.ok(W.dist(S.boat.x, S.boat.y) > 0);
    }
    assert.equal(S.route, null, `시드 ${seed} ${a} → ${b}: ${S.boat.x.toFixed(0)},${S.boat.y.toFixed(0)} 에서 못 감`);
    worst = Math.max(worst, sec);
  }
  console.log(`가장 오래 걸린 항로 ${worst.toFixed(0)}초`);
});

test('자동 항로: 땅을 탭하면 가까운 물로 잡고, 도착하면 돛을 내린다', () => {
  const S = G.newGame(1);
  assert.ok(G.setDest(S, 0, 0 - 0));
  assert.equal(S.boat.sailLevel, 2); // 돛이 내려가 있으면 올려서 간다
  const T = G.newGame(1);
  assert.ok(G.setDest(T, 500, 200));
  const [dx, dy] = [T.route.dx, T.route.dy];
  assert.ok(W.dist(dx, dy) > 5);
  let sec = 0;
  while (S.route && sec < 300) { G.step(S, G.FIXED_DT); sec += G.FIXED_DT; }
  assert.equal(S.route, null);
  assert.equal(S.boat.sailLevel, 0);
});

test('키를 직접 잡으면 자동 항로가 풀린다', () => {
  const S = G.newGame(1);
  G.setDest(S, 0, 0);
  G.setRudder(S, 0.5);
  assert.equal(S.route, null);
  assert.equal(S.boat.rudder, 0.5);
});

test('같은 시드는 같은 결과', () => {
  const a = G.newGame(5), b = G.newGame(5);
  for (const S of [a, b]) { G.setDest(S, -40, -80); run(S, 40); }
  assert.deepEqual([a.boat.x, a.boat.y, a.boat.h], [b.boat.x, b.boat.y, b.boat.h]);
});
