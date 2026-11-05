// 가게 안 손님 동선(화면 없음). 좌표는 0~100: x는 왼쪽에서 오른쪽, y는 안쪽 벽(카운터)에서 문 쪽.
// 대니님 규칙: 테이크아웃 손님도 매장 손님과 똑같이 들어와 카운터에서 주문한다. 다른 점은 주문 뒤에 어디로 가느냐뿐이다.

const table = (x, y, n) => {
  const seats = n === 2
    ? [{ x, y: y - 8, table: { x, y } }, { x, y: y + 8, table: { x, y } }]
    : [[-10, -7], [10, -7], [-10, 7], [10, 7]].map(([dx, dy]) => ({ x: x + dx, y: y + dy, table: { x, y } }));
  return seats;
};
export const FLOORS = {
  // 오피스: 좁고 깊다. 창가 바 좌석 4 + 2인 테이블 2
  office: {
    door: { x: 58, y: 100 }, order: { x: 58, y: 25 }, aisle: 58,
    seats: [
      ...[42, 54, 66, 78].map((y) => ({ x: 16, y, bar: true })),
      ...table(88, 50, 2), ...table(88, 80, 2),
    ],
    takeoutShare: 0.8, arriveEvery: 3.2, stay: [10, 18],
  },
  // 주택가: 넓다. 4인 테이블 4
  home: {
    door: { x: 50, y: 100 }, order: { x: 62, y: 25 }, aisle: 50,
    seats: [...table(21, 46, 4), ...table(21, 78, 4), ...table(79, 46, 4), ...table(79, 78, 4)],
    takeoutShare: 0.3, arriveEvery: 6, stay: [24, 42],
  },
};
const SPEED = 24, ORDER_SEC = 1.6, QUEUE_GAP = 8, SEAT_WAIT_SEC = 5;

export function createFloor(place) {
  const L = FLOORS[place];
  return { place, L, people: [], taken: new Array(L.seats.length).fill(null), t: 0, nextArrive: 0.4, nextId: 1, auto: true, served: 0, lost: 0 };
}
const queueOf = (F) => F.people.filter((p) => p.state === 'queue' || p.state === 'order');
function walkTo(p, pts) { p.path = pts.map((q) => ({ x: q.x, y: q.y })); }

// 손님 들어오기. kind: 'takeout' | 'dine'. look은 그림 쪽에서 쓰는 값
export function spawn(F, kind, opts = {}) {
  const { door, aisle } = F.L;
  const p = { id: F.nextId++, kind, x: door.x, y: door.y, state: 'in', path: [], cup: false, seat: -1, stayLeft: 0, wait: 0, look: opts.look ?? null, phase: 0, named: !!opts.named, hold: !!opts.hold };
  const spot = queueSpot(F, queueOf(F).length + F.people.filter((q) => q.state === 'in').length);
  walkTo(p, [{ x: aisle, y: 90 }, spot]);
  F.people.push(p);
  return p;
}
function queueSpot(F, i) { const { order, aisle } = F.L; return i === 0 ? { x: order.x, y: order.y } : { x: aisle + (order.x - aisle) * 0.2, y: order.y + 4 + i * QUEUE_GAP }; }
function freeSeat(F, rand) {
  const free = F.taken.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
  return free.length ? free[Math.floor(rand() * free.length)] : -1;
}
// 주문을 마치고 다음 행동으로 넘어간다
function afterOrder(F, p, rand) {
  p.cup = true; F.served += 1;
  if (p.kind === 'dine') {
    const s = freeSeat(F, rand);
    if (s >= 0) { sendToSeat(F, p, s, rand); return; }
    if (F.place === 'office') { p.kind = 'takeout'; p.switched = true; } else { // 주택가는 자리가 나기를 잠깐 기다린다
      p.state = 'seatWait'; p.wait = SEAT_WAIT_SEC;
      walkTo(p, [{ x: F.L.aisle, y: 62 }]);
      return;
    }
  }
  sendOut(F, p);
}
function sendToSeat(F, p, s, rand) {
  const seat = F.L.seats[s];
  F.taken[s] = p.id; p.seat = s; p.state = 'toSeat';
  p.stayLeft = F.L.stay[0] + rand() * (F.L.stay[1] - F.L.stay[0]);
  walkTo(p, [{ x: F.L.aisle, y: Math.max(p.y, 34) }, { x: F.L.aisle, y: seat.y }, { x: seat.x, y: seat.y }]);
}
// 본게임: 잔이 나오면 줄 어디에 있든 받아 들고 다음 행동으로 간다
export function serve(F, p, rand = Math.random) { p.hold = false; p.path = []; afterOrder(F, p, rand); }
export function sendOut(F, p) {
  if (p.seat >= 0) { F.taken[p.seat] = null; p.seat = -1; }
  p.state = 'out';
  walkTo(p, [{ x: F.L.aisle, y: p.y }, { x: F.L.aisle, y: 92 }, F.L.door]);
}
// 이미 앉아 있는 손님으로 가게를 채운다(장면이 짧아도 손님이 있어 보이게)
export function prefill(F, n, rand = Math.random, look = () => null) {
  for (let i = 0; i < n; i++) {
    const s = freeSeat(F, rand);
    if (s < 0) return;
    const seat = F.L.seats[s], p = { id: F.nextId++, kind: 'dine', x: seat.x, y: seat.y, state: 'sit', path: [], cup: true, seat: s, stayLeft: F.L.stay[0] + rand() * (F.L.stay[1] - F.L.stay[0]), wait: 0, look: look(), phase: 0 };
    F.taken[s] = p.id; F.people.push(p);
  }
}
// 주인 같은 고정 인물이 앉을 자리를 맡아 둔다
export function reserveSeat(F, i) { F.taken[i] = -1; return F.L.seats[i]; }

export function stepFloor(F, dt, rand = Math.random, makeLook = () => null) {
  if (dt <= 0) return;
  F.t += dt;
  if (F.auto) {
    F.nextArrive -= dt;
    if (F.nextArrive <= 0) {
      spawn(F, rand() < F.L.takeoutShare ? 'takeout' : 'dine', { look: makeLook() });
      F.nextArrive = F.L.arriveEvery * (0.6 + rand() * 0.8);
    }
  }
  // 줄을 앞으로 당긴다
  const q = F.people.filter((p) => p.state === 'queue' || p.state === 'order');
  q.forEach((p, i) => {
    const spot = queueSpot(F, i);
    if (Math.hypot(p.x - spot.x, p.y - spot.y) > 0.5 && !p.path.length) walkTo(p, [spot]);
    if (i === 0 && p.state === 'queue' && !p.path.length) { p.state = 'order'; p.wait = ORDER_SEC; }
  });
  for (const p of F.people) {
    if (p.path.length) {
      const g = p.path[0], d = Math.hypot(g.x - p.x, g.y - p.y), m = SPEED * dt;
      p.phase += dt * 9;
      p.dir = g.x < p.x ? -1 : g.x > p.x ? 1 : p.dir;
      if (d <= m) { p.x = g.x; p.y = g.y; p.path.shift(); } else { p.x += (g.x - p.x) / d * m; p.y += (g.y - p.y) / d * m; }
    }
    if (p.path.length) continue;
    if (p.state === 'in') p.state = 'queue';
    else if (p.state === 'order' && !p.hold) { p.wait -= dt; if (p.wait <= 0) afterOrder(F, p, rand); }
    else if (p.state === 'toSeat') p.state = 'sit';
    else if (p.state === 'sit') { p.stayLeft -= dt; if (p.stayLeft <= 0) sendOut(F, p); }
    else if (p.state === 'seatWait') {
      p.wait -= dt;
      const s = freeSeat(F, rand);
      if (s >= 0) sendToSeat(F, p, s, rand);
      else if (p.wait <= 0) { F.lost += 1; p.kind = 'takeout'; sendOut(F, p); }
    } else if (p.state === 'out') p.state = 'gone';
  }
  F.people = F.people.filter((p) => p.state !== 'gone');
}
