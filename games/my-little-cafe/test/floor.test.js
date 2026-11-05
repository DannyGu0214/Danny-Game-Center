import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS, createFloor, spawn, stepFloor, sendOut, prefill, reserveSeat } from '../floor.js';

const seeded = (s = 1) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const run = (F, sec, rand) => { for (let i = 0; i < sec * 30; i++) stepFloor(F, 1 / 30, rand); };

test('좌석 수: 오피스 8석, 주택가 16석이고 모두 가게 안이에요', () => {
  assert.equal(FLOORS.office.seats.length, 8);
  assert.equal(FLOORS.home.seats.length, 16);
  for (const L of Object.values(FLOORS)) for (const s of L.seats) {
    assert.ok(s.x > 0 && s.x < 100 && s.y > 30 && s.y < 100, `${s.x},${s.y}`);
    assert.ok(Math.abs(s.x - L.aisle) > 5, '통로를 막지 않아요');
  }
});

test('테이크아웃 손님도 카운터까지 와서 주문한 뒤 나가요', () => {
  const F = createFloor('home'); F.auto = false;
  const p = spawn(F, 'takeout'), seen = new Set();
  let minDist = 999;
  for (let i = 0; i < 30 * 30; i++) {
    stepFloor(F, 1 / 30, seeded());
    seen.add(p.state);
    minDist = Math.min(minDist, Math.hypot(p.x - F.L.order.x, p.y - F.L.order.y));
    if (p.state === 'gone') break;
  }
  assert.ok(seen.has('order'), [...seen].join());
  assert.ok(minDist < 0.6, `${minDist}`);
  assert.equal(p.cup, true);
  assert.equal(p.seat, -1);
  assert.equal(F.people.length, 0);
});

test('매장 손님은 주문 뒤 자리에 앉았다가 나가고, 자리를 비워요', () => {
  const rand = seeded(3), F = createFloor('office'); F.auto = false;
  const p = spawn(F, 'dine');
  run(F, 12, rand);
  assert.equal(p.state, 'sit');
  const seat = F.L.seats[p.seat];
  assert.ok(Math.hypot(p.x - seat.x, p.y - seat.y) < 0.6);
  assert.equal(F.taken[p.seat], p.id);
  run(F, 40, rand);
  assert.equal(F.people.length, 0);
  assert.ok(F.taken.every((v) => v === null));
});

test('한 자리에 두 사람이 앉지 않고, 줄이 있어도 모두 빠져나가요', () => {
  for (const place of ['office', 'home']) {
    const rand = seeded(7), F = createFloor(place);
    for (let i = 0; i < 300 * 30; i++) {
      stepFloor(F, 1 / 30, rand);
      const ids = F.taken.filter((v) => v !== null);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(F.people.length < 40, `${place} ${F.people.length}`);
    }
    F.auto = false;
    run(F, 200, rand);
    assert.equal(F.people.length, 0, place);
    assert.ok(F.served > 20, `${place} ${F.served}`);
  }
});

test('손님 비율: 오피스는 테이크아웃이, 주택가는 매장 손님이 많아요', () => {
  assert.equal(FLOORS.office.takeoutShare, 0.8);
  assert.equal(FLOORS.home.takeoutShare, 0.3);
  for (const [place, lo, hi] of [['office', 0.7, 0.9], ['home', 0.2, 0.4]]) {
    const rand = seeded(11), F = createFloor(place);
    let take = 0, all = 0;
    const seen = new Set();
    for (let i = 0; i < 3000 * 10; i++) {
      stepFloor(F, 0.1, rand);
      for (const p of F.people) if (!seen.has(p.id)) { seen.add(p.id); all += 1; if (p.kind === 'takeout') take += 1; }
    }
    assert.ok(all > 100, `${all}`);
    assert.ok(take / all > lo && take / all < hi, `${place} ${take / all}`);
  }
});

test('자리가 꽉 차면: 오피스는 테이크아웃으로 바뀌고, 주택가는 기다리다 그냥 가요', () => {
  const office = createFloor('office'), rand = seeded(5); office.auto = false;
  office.taken.fill(-1);
  const a = spawn(office, 'dine');
  run(office, 12, rand);
  assert.equal(a.kind, 'takeout'); assert.equal(a.switched, true);

  const home = createFloor('home'); home.auto = false;
  home.taken.fill(-1);
  const b = spawn(home, 'dine');
  run(home, 25, rand);
  assert.equal(home.lost, 1);
  assert.equal(home.people.length, 0);
  assert.equal(b.seat, -1);
});

test('먼저 앉은 손님과 맡아 둔 자리, 내보내기', () => {
  const F = createFloor('home'); F.auto = false;
  const s = reserveSeat(F, 0);
  assert.ok(s.x > 0);
  prefill(F, 5, seeded(2));
  assert.equal(F.people.filter((p) => p.state === 'sit').length, 5);
  assert.equal(F.taken.filter((v) => v !== null).length, 6);
  const p = F.people[0], seatIndex = p.seat;
  sendOut(F, p);
  assert.equal(F.taken[seatIndex], null);
  assert.equal(p.state, 'out');
  // 주문 자리에 붙잡아 둔 손님은 주문이 끝나지 않는다
  const G = createFloor('office'); G.auto = false;
  const h = spawn(G, 'takeout', { hold: true });
  run(G, 12, seeded(1));
  assert.equal(h.state, 'order');
});
