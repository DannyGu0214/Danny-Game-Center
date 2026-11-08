import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../business.js';
import { WEATHER_ODDS, DAY_SEC, RENT_PER_SEASON, MENUS, COST, DAYS_PER_SEASON, BIZ_REGULARS, EQUIP, PEOPLE } from '../data.js';
import { REG_TALK, OWNER_VISIT, NOTES } from '../story.js';
import { EVENTS, FAIR, textsOf } from '../events.js';

const seeded = (s = 1) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

test('날씨 비율: 대니님이 정한 값이고 합이 100이에요', () => {
  assert.deepEqual(WEATHER_ODDS.spring, { sun: 40, cloud: 40, rain: 20 });
  assert.deepEqual(WEATHER_ODDS.summer, { sun: 40, cloud: 40, rain: 10, shower: 10 });
  assert.deepEqual(WEATHER_ODDS.winter, { sun: 40, cloud: 40, rain: 10, snow: 10 });
  const rand = seeded(9), n = 20000, c = {};
  for (let i = 0; i < n; i++) { const w = B.rollWeather('winter', rand); c[w] = (c[w] || 0) + 1; }
  assert.ok(Math.abs(c.sun / n - 0.4) < 0.02 && Math.abs(c.snow / n - 0.1) < 0.02, JSON.stringify(c));
  assert.equal(B.rollWeather('spring', () => 0.99), 'rain');
});

test('시계: 12시간이 300초에 흘러요', () => {
  assert.equal(B.clockOf(0), '08:00');
  assert.equal(B.clockOf(DAY_SEC / 2), '14:00');
  assert.equal(B.clockOf(DAY_SEC), '20:00');
  assert.equal(B.weekdayOf(1), '월');
  assert.equal(B.isWeekend(6), true);
  assert.equal(B.isWeekend(8), false);
});

test('손님 수: 일주일 평균 하루 20명쯤이고, 평일과 주말 성격이 달라요', () => {
  for (const place of ['office', 'home']) {
    let sum = 0;
    for (let d = 1; d <= 7; d++) sum += B.customerCount(place, d, 'cloud', 2.5);
    assert.ok(sum / 7 >= 17 && sum / 7 <= 23, `${place} ${sum / 7}`);
  }
  assert.ok(B.customerCount('office', 1, 'sun', 2.5) > B.customerCount('office', 6, 'sun', 2.5));
  assert.ok(B.customerCount('home', 6, 'sun', 2.5) > B.customerCount('home', 1, 'sun', 2.5));
  assert.ok(B.customerCount('home', 1, 'rain', 2.5) < B.customerCount('home', 1, 'sun', 2.5));
  assert.ok(B.customerCount('home', 1, 'sun', 5) > B.customerCount('home', 1, 'sun', 0));
});

test('도착 시간: 오피스 평일은 점심에, 주택가 주말은 오전에 몰려요', () => {
  const share = (place, day, lo, hi) => {
    const rand = seeded(13); let inside = 0, all = 0;
    for (let i = 0; i < 300; i++) for (const t of B.planDay(place, day, 'cloud', 2.5, rand)) { all += 1; const h = B.hourOf(t); if (h >= lo && h < hi) inside += 1; }
    return inside / all;
  };
  assert.ok(share('office', 1, 12, 13.5) > 0.25, `${share('office', 1, 12, 13.5)}`);
  assert.ok(share('home', 6, 9, 12.5) > 0.4, `${share('home', 6, 9, 12.5)}`);
  for (const t of B.planDay('office', 2, 'sun', 2.5, seeded(2))) assert.ok(t >= 0 && t < DAY_SEC);
});

test('메뉴: 오피스 드립은 오후에만, 콜드브루는 재고가 있을 때만 나와요', () => {
  const rand = seeded(3), seen = (place, hour, stock) => { const s = new Set(); for (let i = 0; i < 3000; i++) s.add(B.pickMenu(place, hour, 'sun', stock, rand)); return s; };
  assert.equal(seen('office', 12, 5).has('drip'), false);
  assert.equal(seen('office', 15, 5).has('drip'), true);
  assert.equal(seen('office', 12, 0).has('coldbrew'), false);
  assert.equal(seen('office', 12, 5).has('coldbrew'), true);
  assert.equal(seen('home', 12, 0).has('origin'), true);
  for (const place of ['office', 'home']) for (const m of seen(place, 15, 5)) assert.ok(MENUS[m] && COST[m], m);
});

test('자동 잔: 아침에 칸을 잘 맞추면 맛이 좋고, 별은 2개까지예요', () => {
  const good = B.autoCup('americano', 0.2);
  assert.equal(good.band, 'good'); assert.equal(good.stars, 2);
  const bad = B.autoCup('americano', 3);
  assert.equal(bad.band, 'verySour'); assert.ok(bad.stars <= 1);
  assert.equal(B.canAuto('americano', {}), true);
  assert.equal(B.canAuto('latte', {}), false);
  assert.equal(B.canAuto('latte', { pitcher: true }), true);
  assert.equal(B.canAuto('drip', { pitcher: true }), false);
});

test('장부: 판매·팁·원가가 돈에 더해지고, 놓친 손님은 평판을 깎아요', () => {
  const biz = B.newBiz(seeded(1)), st = B.newDayStats();
  const r = B.sellCup(biz, st, { menu: 'americano', stars: 2, waited: 10, place: 'office' });
  assert.equal(r.tip, 500);
  assert.equal(B.sellCup(biz, st, { menu: 'americano', stars: 2, waited: 40, place: 'home' }).tip, 0);
  st.lost = 0;
  const before = biz.money, c = B.closeDay(biz, st);
  assert.equal(biz.money, before + c.net);
  assert.ok(c.net > 0);
  const b2 = B.newBiz(seeded(1)), s2 = B.newDayStats();
  B.sellCup(b2, s2, { menu: 'americano', stars: 2, place: 'home' }); s2.lost = 10;
  const repBefore = b2.rep; B.closeDay(b2, s2);
  assert.ok(b2.rep < repBefore);
});

test('한 계절 수지: 하루 20잔을 팔면 월세를 내고도 남고, 별로 못 팔면 빠듯해요', () => {
  const season = (place, cups, lost) => {
    const biz = B.newBiz(seeded(4));
    for (let d = 1; d <= DAYS_PER_SEASON; d++) {
      const st = B.newDayStats();
      for (let i = 0; i < cups; i++) B.sellCup(biz, st, { menu: place === 'office' ? 'americano' : 'latte', stars: 2, place });
      st.lost = lost; B.closeDay(biz, st); if (d < DAYS_PER_SEASON) B.nextDay(biz, seeded(d));
    }
    assert.equal(B.isSeasonEnd(biz), true);
    return B.settleSeason(biz, place);
  };
  for (const place of ['office', 'home']) {
    const full = season(place, 20, 1), low = season(place, 8, 8);
    assert.ok(full.money > 500000 + 200000, `${place} ${full.money}`);
    assert.ok(low.money < full.money - 500000, `${place} ${low.money}`);
    assert.equal(full.rent, RENT_PER_SEASON[place]);
  }
  // 장비 세 개를 다 사려면 한 계절을 잘 보내야 해요
  const total = Object.values(EQUIP).reduce((a, e) => a + e.price, 0);
  assert.ok(total > B.newBiz(seeded(1)).money);
});

test('서브제품: 평판과 잔 품질이 좋을수록 잘 팔리고, 재고가 없으면 못 팔아요', () => {
  const ctx = { place: 'home', rep: 2.5, stars: 2, hour: 11, weekend: false, weather: 'cloud' };
  for (const kind of ['dessert', 'beans']) {
    assert.ok(B.sideChance(kind, { ...ctx, rep: 5 }) > B.sideChance(kind, { ...ctx, rep: 1 }), kind);
    assert.ok(B.sideChance(kind, { ...ctx, stars: 3 }) > B.sideChance(kind, { ...ctx, stars: 1 }), kind);
    assert.ok(B.sideChance(kind, { ...ctx, friend: 5 }) > B.sideChance(kind, ctx), kind);
    assert.ok(B.sideChance(kind, { ...ctx, place: 'office' }) < B.sideChance(kind, ctx), kind);
  }
  assert.ok(B.sideChance('dessert', { ...ctx, hour: 15 }) > B.sideChance('dessert', ctx));
  assert.ok(B.sideChance('dessert', { ...ctx, weather: 'rain' }) > B.sideChance('dessert', ctx));
  assert.ok(B.sideChance('beans', { ...ctx, quality: 1 }) > B.sideChance('beans', { ...ctx, quality: 0.2 }));
  assert.ok(B.sideChance('beans', { ...ctx, weekend: true }) > B.sideChance('beans', ctx));
  const biz = B.newBiz(seeded(1)), st = B.newDayStats();
  assert.deepEqual(B.sellSide(biz, st, ctx, () => 0), []); // 재고 없음
  biz.stock.dessert = 1; biz.stock.beans = 1;
  assert.deepEqual(B.sellSide(biz, st, ctx, () => 0), ['dessert', 'beans']);
  assert.equal(biz.stock.dessert, 0);
  assert.equal(st.sideSales, 20500);
  assert.equal(st.sales, 20500);
});

test('로스팅: 초록 칸이면 품질 100%, 태우면 떨어지고, 원두는 남겨 둬요', () => {
  assert.equal(B.roastQuality(215), 1);
  assert.ok(B.roastQuality(245) < 0.2);
  assert.ok(B.roastQuality(190) < 0.5);
  const biz = B.newBiz(seeded(1));
  assert.equal(B.roastBatch(biz, 215), 1);
  assert.equal(biz.stock.beans, 8);
  assert.equal(biz.money, 452000);
  assert.ok(B.buyDessert(biz, 4));
  assert.equal(biz.money, 444000);
  assert.deepEqual(B.endOfDayStock(biz), { coldbrew: 0, dessert: 4 });
  assert.equal(biz.stock.beans, 8);
  biz.money = 0;
  assert.equal(B.roastBatch(biz, 215), null);
  assert.equal(B.buyDessert(biz, 1), false);
});

test('장비와 콜드브루: 돈이 모자라면 못 사고, 남은 병은 버려요', () => {
  const biz = B.newBiz(seeded(1));
  assert.equal(B.buyEquip(biz, 'machine'), false);
  biz.money = 1e7; assert.equal(B.buyEquip(biz, 'machine'), false); // 2구 머신은 겨울에 열려요
  biz.unlocked.machine = true; assert.equal(B.buyEquip(biz, 'machine'), true);
  biz.money = 500000; biz.equip = {};
  assert.equal(B.buyEquip(biz, 'grinder'), true);
  assert.equal(B.buyEquip(biz, 'grinder'), false);
  assert.equal(biz.money, 200000);
  assert.equal(B.prepColdbrew(biz, 5), true);
  assert.equal(biz.stock.coldbrew, 5);
  assert.equal(B.endOfDayStock(biz).coldbrew, 5);
  assert.equal(biz.stock.coldbrew, 0);
});

test('단골: 두 카페 모두 하루 평균 2명 오고, 대화와 인물이 있어요', () => {
  for (const place of ['office', 'home']) {
    for (let d = 1; d <= DAYS_PER_SEASON; d++) {
      const list = B.regularsOfDay(place, d);
      assert.equal(list.length, 2);
      assert.notEqual(list[0].id, list[1].id);
      for (const r of list) {
        assert.ok(BIZ_REGULARS[place][r.id]); assert.ok(PEOPLE[r.id]);
        assert.ok(r.at > 0 && r.at < DAY_SEC);
      }
    }
    for (const id of Object.keys(BIZ_REGULARS[place])) {
      assert.ok(REG_TALK[id] && REG_TALK[id].length >= 4, id);
      for (const ep of REG_TALK[id]) for (const line of ep) assert.doesNotMatch(line.text, /(습니다|합니다|입니다|십시오)/, line.text);
    }
  }
  for (const v of OWNER_VISIT) assert.doesNotMatch(v.text, /(습니다|합니다|입니다|십시오)/, v.text);
  const biz = B.newBiz(seeded(1));
  B.regularDone(biz, 'kim', { stars: 3, band: 'good' });
  B.regularDone(biz, 'kim', { stars: 1, band: 'sour' });
  assert.equal(biz.friend.kim, 1); assert.equal(biz.visits.kim, 2);
});

test('저장: 불러오면 그대로이고, 망가진 값은 고쳐요', () => {
  const biz = B.newBiz(seeded(1)); biz.day = 7; biz.money = 123; biz.equip.machine = true;
  const back = B.normalizeBiz(JSON.parse(JSON.stringify(biz)));
  assert.equal(back.day, 7); assert.equal(back.money, 123); assert.equal(back.equip.machine, true);
  assert.equal(B.normalizeBiz({ season: '없음' }), null);
  assert.equal(B.normalizeBiz({ season: 'spring', day: 999, weather: 'snow' }).day, DAYS_PER_SEASON);
  assert.equal(B.normalizeBiz({ season: 'spring', weather: 'snow' }).weather, 'sun');
});

test('가게 저장: 위치별로 따로이고, 이전 저장을 옮기고, 다른 쪽 가게는 이름만 새로 정해요', () => {
  const known = { shot: {} };
  const base = { choices: { hero: 'F', owner: 'M', place: 'home', cafe: '윤슬' }, notes: ['shot', '없음'], dial: { espresso: 4, drip: 7 } };
  assert.equal(B.slotKey('office') === B.slotKey('home'), false);
  assert.deepEqual(B.parseBase(base, known).notes, ['shot']);
  assert.equal(B.parseBase({ choices: { hero: 'X' } }), null);
  assert.equal(B.needsNewName(base, 'home'), false);
  assert.equal(B.needsNewName(base, 'office'), true);
  const c = B.slotChoices(base, 'office', '  봄볕   창가 ');
  assert.deepEqual(c, { hero: 'F', owner: 'M', place: 'office', cafe: '봄볕 창가' });
  assert.equal(B.slotChoices(base, 'home').cafe, '윤슬');
  const biz = B.newBiz(seeded(1)); biz.day = 5;
  const slot = { choices: base.choices, notes: [], dial: base.dial, biz };
  const back = B.parseSlot(JSON.parse(JSON.stringify(slot)), 'home', known);
  assert.equal(back.biz.day, 5);
  assert.equal(B.parseSlot(JSON.parse(JSON.stringify(slot)), 'office', known), null); // 다른 위치의 칸으로 잘못 읽지 않아요
  assert.equal(B.parseSlot({ ...slot, biz: null }, 'home', known), null);
  const m = B.migrateOldBiz(JSON.parse(JSON.stringify(slot)), known);
  assert.equal(m.base.choices.place, 'home');
  assert.equal(m.slot.biz.day, 5);
  const m2 = B.migrateOldBiz({ ...base, biz: null }, known);
  assert.equal(m2.slot, null);
  assert.equal(B.migrateOldBiz(null, known), null);
});

test('이벤트: 조건이 맞을 때 하루 하나만 나오고, 본 건 다시 안 나와요', () => {
  const b = B.newBiz(seeded(1));
  assert.equal(B.eventDue(b, EVENTS, 'close'), null);
  b.starsTotal = 100;
  assert.equal(B.eventDue(b, EVENTS, 'close').id, 'fair-news');
  B.snoozeEvent(b, 'fair-news', 3);
  assert.equal(B.eventDue(b, EVENTS, 'close'), null); // 오늘은 이미 하나 나왔어요
  b.day = 3; assert.equal(B.eventDue(b, EVENTS, 'close'), null); // 사흘 뒤에 다시 물어요
  b.day = 4; assert.equal(B.eventDue(b, EVENTS, 'close').id, 'fair-news');
  B.markEvent(b, 'fair-news');
  b.day = 5; assert.equal(B.eventDue(b, EVENTS, 'morning').id, 'friend');
  B.markEvent(b, 'friend'); assert.equal(B.eventDue(b, EVENTS, 'close'), null);
  b.day = 20; b.starsTotal = 900; b.seen['fair-news'] = 0; delete b.seen['fair-news'];
  assert.notEqual(B.eventDue(b, EVENTS, 'close')?.id, 'fair-news'); // 마지막 날엔 다음 날이 없어 박람회 소식이 안 나와요
});
test('이벤트: 디저트는 박람회 뒤, 별이 모여야 열려요', () => {
  const b = B.newBiz(seeded(1)), baker = EVENTS.filter((e) => e.id === 'baker');
  b.starsTotal = 999; b.day = 10;
  assert.equal(B.eventDue(b, baker, 'close'), null);
  b.seen.fair = 9; assert.equal(B.eventDue(b, baker, 'close'), null); // 이틀 뒤부터
  b.day = 11; assert.equal(B.eventDue(b, baker, 'close').id, 'baker');
  b.starsTotal = 249; assert.equal(B.eventDue(b, baker, 'close'), null);
});
test('해금: 새 가게는 잠겨 있고, 예전 저장은 열려 있어요', () => {
  const b = B.newBiz(seeded(1)), st = B.newDayStats();
  for (const k of B.UNLOCKS) assert.equal(B.isUnlocked(b, k), false);
  st.served = 2; st.stars = 5; B.closeDay(b, st); assert.equal(b.starsTotal, 5);
  const same = B.normalizeBiz(JSON.parse(JSON.stringify({ ...b, unlocked: { equip: true }, seen: { fair: 3 }, starsTotal: 7, fairTomorrow: true, equipHint: 'machine' })));
  assert.deepEqual([same.unlocked, same.seen, same.starsTotal, same.fairTomorrow, same.equipHint], [{ equip: true }, { fair: 3 }, 7, true, 'machine']);
  const old = B.normalizeBiz({ season: 'spring', day: 7, money: 1, rep: 3, weather: 'sun', history: [{ stars: 30 }, { stars: 12 }] });
  for (const k of B.UNLOCKS) assert.equal(B.isUnlocked(old, k), true);
  assert.equal(old.starsTotal, 42);
  assert.equal(old.seen.baker, 1); // 옮긴 저장은 해금 장면을 건너뛰어요
});
test('해금: 잠기면 싱글오리진 주문이 안 들어와요', () => {
  const rand = seeded(5);
  for (let i = 0; i < 2000; i++) assert.notEqual(B.pickMenu('home', 11, 'sun', 0, rand, {}), 'origin');
  const seen = new Set(); for (let i = 0; i < 2000; i++) seen.add(B.pickMenu('home', 11, 'sun', 0, rand, { origin: true }));
  assert.ok(seen.has('origin'));
});
test('이벤트 대본: 말투, 등장인물, 노트, 장비가 맞아요', () => {
  const all = [...EVENTS.flatMap((e) => (Array.isArray(e.script) ? e.script : Object.values(e.script).flat())), ...FAIR.open, ...FAIR.booths.flatMap((x) => x.script), ...FAIR.consult, ...FAIR.close];
  const texts = [...textsOf(all), FAIR.question, FAIR.consultAsk, ...FAIR.needs.flatMap((n) => [n.label, n.reply])];
  assert.ok(texts.length > 40);
  for (const t of texts) assert.doesNotMatch(t, /(습니다|합니다|입니다|십시오|답니다)/, t);
  const walk = (list) => { for (const s of list) { if (s.who && !['narr', 'sys', 'hero'].includes(s.who)) assert.ok(PEOPLE[s.who], s.who); if (s.note) assert.ok(NOTES[s.note], s.note); if (s.brew) { walk(s.good); walk(s.other); } if (s.options) s.options.forEach(([, l]) => walk(l)); } };
  walk(all);
  for (const n of FAIR.needs) assert.ok(EQUIP[n.equip], n.equip);
  assert.ok(all.some((s) => s.unlock === 'equip') && all.some((s) => s.unlock === 'dessert'));
});
