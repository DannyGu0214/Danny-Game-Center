// 계절 균형 시뮬레이션: business.js 규칙을 그대로 쓰고, 플레이어 손놀림(손 제조 시간·별 분포)만 가정한다.
// 실행: node tools/sim-spring.mjs (봄) / node tools/sim-spring.mjs summer (봄을 마친 가게로 여름)
import * as B from '../business.js';
import { EVENTS } from '../events.js';
import { DAY_SEC, PATIENCE, AUTO_SEC, MENUS, SIDE, EQUIP, RENT_PER_SEASON, DAYS_PER_SEASON } from '../data.js';

const SKILL = {
  초보: { hand: [[1, .25], [2, .55], [3, .2]], autoGood: .7, speed: 1.3, react: 2.5 },
  보통: { hand: [[1, .1], [2, .5], [3, .4]], autoGood: 1, speed: 1.0, react: 1.5 },
  능숙: { hand: [[2, .3], [3, .7]], autoGood: 1, speed: .85, react: 1.0 },
};
const HAND_SEC = { latte: 16, drip: 58, origin: 58, americano: 26, iced: 26, espresso: 22, coldbrew: 2 }; // 콜드브루는 바로 내준다
const WALK = 3;
const pick = (dist, r) => { let x = r(); for (const [v, p] of dist) { x -= p; if (x < 0) return v; } return dist.at(-1)[0]; };

function simDay(biz, place, S, opt, r) {
  const stats = B.newDayStats();
  const arrivals = B.planDay(place, biz.day, biz.weather, biz.rep, r, biz.buzzDay === biz.day ? B.BUZZ_BOOST : 1).map((t) => ({ t: t + WALK }));
  const regs = B.regularsOfDay(place, biz.day);
  const autoStars = r() < S.autoGood ? 2 : 1;
  const dt = 0.1; let clock = 0, freeAt = 0, handT = null, tickets = [], machine = [];
  const cap = biz.equip.machine ? 2 : 1;
  const ctxOf = (stars) => ({ place, rep: biz.rep, stars, hour: B.hourOf(clock), weekend: B.isWeekend(biz.day), weather: biz.weather });
  const finish = (t, stars) => { if (t.menu === 'coldbrew') biz.stock.coldbrew--; B.sellCup(biz, stats, { menu: t.menu, stars, waited: t.max - t.pat, place }); B.sellSide(biz, stats, ctxOf(stars), r); };
  let ai = 0;
  for (; ; clock += dt) {
    while (ai < arrivals.length && arrivals[ai].t <= clock) {
      ai++;
      const menu = B.pickMenu(place, B.hourOf(clock), biz.weather, biz.stock.coldbrew - tickets.filter((t) => t.menu === 'coldbrew').length, r, biz.unlocked, biz.season);
      tickets.push({ menu, pat: PATIENCE[place], max: PATIENCE[place] });
    }
    // 단골: 대화 모드라 시간이 멈춘다(시간 비용 0). 손이 비면 바로 맞는다
    while (regs.length && regs[0].at <= clock && clock >= freeAt) { regs.shift(); stats.regulars++; const s = pick(S.hand, r); B.sellCup(biz, stats, { menu: 'latte', stars: s, place }); B.sellSide(biz, stats, ctxOf(s), r); }
    for (const m of machine.slice()) { m.left -= dt; if (m.left <= 0) { machine.splice(machine.indexOf(m), 1); finish(m.t, autoStars); } }
    if (handT && clock >= freeAt) { finish(handT, pick(S.hand, r)); handT = null; }
    for (const t of tickets.slice()) { t.pat -= dt; if (t.pat <= 0) { tickets.splice(tickets.indexOf(t), 1); stats.lost++; } }
    if (clock >= freeAt && !handT && tickets.length) {
      const autoT = tickets.find((t) => B.canAuto(t.menu, biz.equip));
      if (autoT && machine.length < cap) { tickets.splice(tickets.indexOf(autoT), 1); machine.push({ t: autoT, left: AUTO_SEC[autoT.menu] ?? 9 }); freeAt = clock + S.react; }
      else {
        const h = tickets.find((t) => !B.canAuto(t.menu, biz.equip)) || (opt.greedy ? tickets[0] : null);
        if (h) { tickets.splice(tickets.indexOf(h), 1); handT = h; freeAt = clock + S.react + HAND_SEC[h.menu] * S.speed; }
      }
    }
    if (clock >= DAY_SEC && !handT) break;
  }
  for (const m of machine) finish(m.t, autoStars);
  return stats;
}

// 계절 하나를 돌린다. biz를 주면 그 가게(봄을 마친 가게 등)로 이어서 돈다
function simSeason(place, S, opt, r, biz = B.newBiz(r)) {
  let fairTomorrow = false; const out = { d100: null, d250: null, fair: null, baker: null, days: 0, ev: {} };
  for (; ;) {
    if (fairTomorrow) {
      fairTomorrow = false; biz.seen[biz.fairId] = biz.day; biz.eventDay = biz.day; out.fair = biz.day; out.ev[biz.fairId] = biz.day;
      if (biz.fairId === 'fair') biz.unlocked.equip = true;
      if (biz.fairId === 'festival' && place === 'office') biz.unlocked.coldbrew = true;
    } else {
      if (opt.dessert && biz.unlocked.dessert) B.buyDessert(biz, opt.dessert);
      if (place === 'office' && biz.unlocked.coldbrew && opt.coldbrew) B.prepColdbrew(biz, opt.coldbrew);
      const st = simDay(biz, place, S, opt, r);
      B.endOfDayStock(biz); B.closeDay(biz, st); out.days++;
      const ss = B.starsThisSeason(biz);
      if (out.d100 == null && ss >= 100) out.d100 = biz.day;
      if (out.d250 == null && ss >= 250) out.d250 = biz.day;
      const e = B.eventDue(biz, EVENTS, 'close');
      if (e) {
        B.markEvent(biz, e.id); out.ev[e.id] = biz.day;
        if (e.kind === 'fair-news') { fairTomorrow = true; biz.fairId = e.fair || 'fair'; }
        if (e.kind === 'buzz') biz.buzzDay = biz.day + 1;
        for (const s of Array.isArray(e.script) ? e.script : []) if (s.unlock) biz.unlocked[s.unlock] = true;
        if (e.id === 'baker') out.baker = biz.day;
      }
      if (opt.buy && biz.unlocked.equip) for (const id of opt.buy) if (!biz.equip[id] && biz.money - EQUIP[id].price >= RENT_PER_SEASON[place]) B.buyEquip(biz, id);
    }
    if (B.isSeasonEnd(biz)) break;
    B.nextDay(biz, r);
  }
  const s = B.settleSeason(biz, place);
  return { ...out, ...s, side: biz.history.reduce((a, d) => a + d.sideSales, 0), stars: biz.starsTotal, eq: Object.keys(biz.equip).join('+') };
}

let seed = 12345; const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const q = (a, p) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) * p)] : '-'; };
const N = 2000, man = (n) => (n / 10000).toFixed(0) + '만';
const mode = process.argv[2] || 'spring';
const rows = [];
if (mode === 'spring') for (const place of ['office', 'home']) for (const [label, opt] of [['기본 메뉴만', {}], ['손으로 더 만들기', { greedy: true }], ['디저트 8개/일', { dessert: 8 }]]) for (const sk of Object.keys(SKILL)) {
  const res = Array.from({ length: N }, () => simSeason(place, SKILL[sk], opt, rand));
  const f = (k) => res.map((x) => x[k]);
  rows.push([place === 'office' ? '오피스' : '주택가', label, sk,
    `${q(f('d100'), .5)}일 (${q(f('d100'), .1)}~${q(f('d100'), .9)})`,
    `${q(f('d250'), .5)}일 (${q(f('d250'), .1)}~${q(f('d250'), .9)})`,
    `${(res.filter((x) => x.baker).length / N * 100).toFixed(0)}%`,
    `${(res.reduce((a, x) => a + x.served, 0) / N / 19).toFixed(1)}`,
    `${(res.reduce((a, x) => a + x.lost, 0) / N).toFixed(0)}`,
    `${(res.reduce((a, x) => a + x.avgStars, 0) / N).toFixed(2)}`,
    `${(res.reduce((a, x) => a + x.rep, 0) / N).toFixed(1)}`,
    man(q(f('income'), .5)), man(RENT_PER_SEASON[place]), `${(res.filter((x) => x.income >= x.rent).length / N * 100).toFixed(0)}%`,
    man(q(f('money'), .5))]);
}
if (mode === 'spring') {
console.log('| 가게 | 운영 | 실력 | 별 100 도달 | 별 250 도달 | 디저트 해금 | 하루 손님 | 놓친 손님 | 별 평균 | 평판 | 계절 수입(중앙) | 월세 | 수입≥월세 | 결산 후 돈 |');
console.log('|' + '---|'.repeat(14));
for (const r of rows) console.log('| ' + r.join(' | ') + ' |');
}

// 여름: 봄을 디저트 8개로 마친 가게를 이어서 돌린다. 여름에는 오피스가 콜드브루 4병을 준비한다(원두 로스팅은 넣지 않았다)
if (mode === 'summer') {
  const N2 = 1000, pct = (res, k) => `${(res.filter((x) => x.ev[k]).length / res.length * 100).toFixed(0)}%`;
  const day = (res, k) => { const d = res.map((x) => x.ev[k]); return `${q(d, .5)}일 (${q(d, .1)}~${q(d, .9)})`; };
  console.log('| 가게 | 실력 | 페스티벌 소식 | 로스터 방문(원두) | 인플루언서 | 아빠 | 여름 평판 | 여름 수입(중앙) | 월세 | 수입≥월세 | 여름 결산 후 돈 |');
  console.log('|' + '---|'.repeat(11));
  for (const place of ['office', 'home']) for (const sk of Object.keys(SKILL)) {
    const res = Array.from({ length: N2 }, () => {
      const b = B.newBiz(rand); simSeason(place, SKILL[sk], { dessert: 8 }, rand, b);
      b.finished = true; B.startNextSeason(b, rand);
      return simSeason(place, SKILL[sk], { dessert: 8, coldbrew: 4 }, rand, b);
    });
    const f = (k) => res.map((x) => x[k]);
    console.log('| ' + [place === 'office' ? '오피스' : '주택가', sk, day(res, 'festival-news'), `${day(res, 'roaster')} · ${pct(res, 'roaster')}`, `${day(res, 'influencer')} · ${pct(res, 'influencer')}`, day(res, 'dad'),
      (res.reduce((a, x) => a + x.rep, 0) / res.length).toFixed(1), man(q(f('income'), .5)), man(RENT_PER_SEASON[place]), `${(res.filter((x) => x.income >= x.rent).length / res.length * 100).toFixed(0)}%`, man(q(f('money'), .5))].join(' | ') + ' |');
  }
}
