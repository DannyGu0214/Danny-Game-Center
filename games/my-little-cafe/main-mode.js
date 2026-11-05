// 본게임: 아침 준비 → 영업(메인 모드, 시간이 흐른다) → 단골 대화(시간이 멈춘다) → 마감 → 계절 결산.
import * as G from './logic.js';
import * as B from './business.js';
import { createFloor, spawn, stepFloor, prefill, serve, sendOut } from './floor.js';
import { drawInside, randomLook } from './art-shop.js';
import { runBrew, runRoast } from './stations.js';
import { MENUS, DAY_SEC, PATIENCE, AUTO_SEC, EQUIP, PEOPLE, BIZ_REGULARS, WEATHER_NAME, COLDBREW_COST, RENT_PER_SEASON, SEASON_NAME, DAYS_PER_SEASON, SIDE, ROAST } from './data.js';
import { REG_TALK, OWNER_VISIT, REACT } from './story.js';

const PANEL = 214; // 아래 주문판 높이
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const stars = (n) => `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;

export function createBusiness(env) {
  const { $, sfx, ticks, ui, brewCtx } = env;
  let day = null; // 오늘 영업 상태
  const biz = () => env.S.biz;

  function setHudDay(sec = null) {
    const b = biz(), time = sec == null ? '' : ` · ${B.clockOf(sec)}`;
    $('hudDay').innerHTML = `${SEASON_NAME[b.season]} ${b.day}일차<small>${B.weekdayOf(b.day)} · ${WEATHER_NAME[b.weather]}${time}</small>`;
    $('hud').classList.remove('hide');
    $('btnShop').classList.add('hide');
    $('skip').classList.add('hide');
  }
  function syncStoryDay() { env.S.day = ((biz().day - 1) % 5) + 1; } // 날마다 맞는 분쇄 칸 표를 돌려 쓴다

  // ── 주문판 ──
  function renderTickets() {
    if (!day) return;
    const box = $('tickets');
    $('tickHead').textContent = `${won(biz().money + day.stats.sales + day.stats.tips - day.stats.cost)} · 손님 ${day.stats.served}명 · 평판 ${biz().rep.toFixed(1)}`;
    const list = day.tickets.slice(0, 4);
    const sig = list.map((t) => `${t.id}:${t.state}:${t.regular ? 1 : 0}:${buttonsOf(t).map((b) => b.off ? 1 : 0).join('')}`).join('|');
    if (sig !== day.sig) {
      day.sig = sig;
      $('tickList').innerHTML = list.length ? list.map((t) => `
        <div class="ticket${t.regular ? ' reg' : ''}" data-id="${t.id}">
          <div class="tInfo"><b>${t.regular ? `💬 ${PEOPLE[t.regular].name}` : MENUS[t.menu].name}</b><span>${t.regular ? '단골이에요. 시간이 멈춰요' : t.state === 'auto' ? '머신이 만들고 있어요' : t.kind === 'takeout' ? '가져가요' : '마시고 가요'}</span><i><u></u></i></div>
          <div class="tBtns">${buttonsOf(t).map((b) => `<button data-act="${b.act}"${b.off ? ' disabled' : ''}>${b.label}</button>`).join('')}</div>
        </div>`).join('') : '<div class="tEmpty">기다리는 손님이 없어요. 잠깐 숨 돌려요.</div>';
    }
    for (const t of list) {
      const bar = box.querySelector(`.ticket[data-id="${t.id}"] u`);
      if (!bar) continue;
      const k = t.state === 'auto' ? 1 - t.left / t.total : t.regular ? 1 : Math.max(0, t.patience / t.maxPatience);
      bar.style.width = `${k * 100}%`;
      bar.className = t.state === 'auto' ? 'run' : k < 0.3 ? 'low' : k < 0.6 ? 'mid' : '';
    }
  }
  function machineBusy() { return day.tickets.filter((t) => t.state === 'auto').length; }
  function machineCap() { return biz().equip.machine ? 2 : 1; }
  function buttonsOf(t) {
    if (t.state === 'auto') return [{ act: 'none', label: '…', off: true }];
    if (t.regular) return [{ act: 'talk', label: '대화하기' }];
    if (B.isInstant(t.menu)) return [{ act: 'instant', label: '바로 내주기' }];
    const out = [];
    if (B.canAuto(t.menu, biz().equip)) out.push({ act: 'auto', label: '자동', off: machineBusy() >= machineCap() });
    out.push({ act: 'hand', label: t.menu === 'latte' ? '스팀 직접' : t.menu === 'drip' || t.menu === 'origin' ? '직접 내리기' : '직접' });
    return out;
  }
  $('tickList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || !day || btn.disabled) return;
    const t = day.tickets.find((x) => x.id === Number(btn.closest('.ticket').dataset.id));
    if (!t) return;
    sfx.play('click');
    act(t, btn.dataset.act);
  });
  function act(t, what) {
    if (t.state !== 'wait') return; // 이미 만들거나 대화 중인 주문은 다시 시작하지 않는다
    if (what === 'auto') {
      if (machineBusy() >= machineCap()) return; // 화면이 갱신되기 전에 연달아 눌러도 머신 수를 넘지 않는다
      t.state = 'auto'; t.total = AUTO_SEC[t.menu] ?? 9; t.left = t.total; sfx.play('clunk'); day.sig = null; renderTickets();
    } else if (what === 'instant') finishCup(t, { menu: t.menu, stars: 2, band: 'good', taste: 0, auto: true }); else if (what === 'hand') makeByHand(t); else if (what === 'talk') talkTo(t);
  }

  function finishCup(t, cup) {
    const st = cup.stars ?? G.starsOf(cup.score, cup.band), waited = t.maxPatience - t.patience;
    const { price, tip } = B.sellCup(biz(), day.stats, { menu: cup.menu, stars: st, waited, place: day.place });
    if (cup.menu === 'coldbrew') biz().stock.coldbrew = Math.max(0, biz().stock.coldbrew - 1);
    day.tickets = day.tickets.filter((x) => x !== t); day.sig = null;
    if (day.F.people.includes(t.p)) serve(day.F, t.p, Math.random);
    sfx.play(st >= 2 ? 'cup' : 'bad');
    const sold = B.sellSide(biz(), day.stats, { place: day.place, rep: biz().rep, stars: st, hour: B.hourOf(day.clock), weekend: B.isWeekend(biz().day), weather: biz().weather, friend: t.regular ? B.friendLevel(biz(), t.regular) : 0 });
    const extra = sold.reduce((a, k) => a + SIDE[k].price, 0);
    env.flash(`${stars(st)} ${MENUS[cup.menu].name} +${won(price + tip)}${tip ? ' (팁)' : ''}${sold.length ? ` + ${sold.map((k) => SIDE[k].name).join('·')} ${won(extra)}` : ''}`);
    renderTickets();
  }

  // 일반 손님 직접 만들기: 시간은 계속 흐른다. 이 손님은 만드는 동안 기다려 준다
  async function makeByHand(t) {
    t.state = 'hand'; day.busy = true; day.sig = null;
    $('tickets').classList.add('hide');
    let steps = MENUS[t.menu].steps.filter((s) => s !== 'grind' || t.menu === 'drip' || t.menu === 'origin');
    if (biz().equip.grinder) steps = steps.filter((s) => s !== 'dose');
    if (t.menu === 'latte') steps = ['steam'];
    $('stepbar').classList.remove('hide');
    const menu = t.menu === 'origin' ? 'drip' : t.menu === 'iced' ? 'americano' : t.menu;
    const r = await runBrew(brewCtx, { menu, do: steps, title: `${MENUS[t.menu].name} · 직접` }, { useDial: true, autoErr: day.err });
    r.menu = t.menu;
    backToMain();
    if (day) finishCup(t, r);
  }
  function backToMain() {
    $('stepbar').classList.add('hide'); $('hint').classList.add('hide'); $('actions').classList.add('hide');
    ui.clearActions(); env.setPointer(null); sfx.stopLoops();
    if (!day) return;
    day.busy = false;
    mainView();
    $('tickets').classList.remove('hide');
    day.sig = null; renderTickets();
  }
  function mainView() {
    const d = day; // 마감 뒤 다음 프레임이 와도 오늘 상태로 그린다
    env.setView((g, W, H, t) => {
      const F = d.F;
      drawInside(g, W, H - PANEL, { place: d.place, cafe: env.S.choices.cafe, F, t, staff: [{ person: env.personOf('hero') }] });
    });
    env.setPointer(null);
  }

  // 단골: 대화 모드. 시간이 멈추고 전부 직접 만든다
  async function talkTo(t) {
    const id = t.regular, R = BIZ_REGULARS[day.place][id];
    t.state = 'talk';
    day.clockOn = false; day.busy = true;
    $('tickets').classList.add('hide');
    env.setFront(id); env.barView();
    const episodes = REG_TALK[id], visits = biz().visits[id] || 0, ep = episodes[Math.min(visits, episodes.length - 1)];
    env.showDialog();
    for (const line of ep) await env.showLine(line.who === 'hero' ? 'hero' : id, line.text);
    env.hideDialog();
    const steps = MENUS[R.menu].steps;
    env.showStepbar();
    const res = await runBrew(brewCtx, { menu: R.menu, do: steps, title: `${PEOPLE[id].name} · ${MENUS[R.menu].name}` }, { target: R.taste });
    res.stars = G.starsOf(res.score, res.band);
    await env.showResult(res, { goLabel: '내주기', canAgain: false, stars: res.stars, extra: R.taste ? `▼ 표시가 ${PEOPLE[id].name} 입맛이에요.` : '' });
    B.regularDone(biz(), id, res);
    env.leaveBrewQuiet();
    env.setFront(id); env.barView(); env.showDialog();
    const table = REACT[day.place];
    await env.showLine(id, table[res.band][Math.floor(Math.random() * table[res.band].length)]);
    env.hideDialog(); env.setFront(null);
    day.stats.regulars += 1;
    finishCup(t, res);
    day.clockOn = true;
    backToMain();
  }

  function addTicket(p, menu, kind, regular = null) {
    const P = regular ? 1e6 : PATIENCE[day.place];
    day.tickets.push({ id: day.nextId++, p, menu, kind, regular, state: 'wait', patience: P, maxPatience: P, left: 0, total: 1 });
    day.sig = null;
    sfx.play('bell');
  }
  function tick(dt) {
    const d = day;
    if (!d) return;
    if (d.clockOn) {
      d.clock += dt;
      stepFloor(d.F, dt, Math.random);
      for (const p of d.pending.filter((x) => x.p.state === 'queue' || x.p.state === 'order')) { addTicket(p.p, p.menu, p.kind, p.regular); d.pending.splice(d.pending.indexOf(p), 1); }
      while (d.arrivals.length && d.arrivals[0] <= d.clock) {
        d.arrivals.shift();
        const hour = B.hourOf(d.clock), menu = B.pickMenu(d.place, hour, biz().weather, biz().stock.coldbrew - d.tickets.filter((x) => x.menu === 'coldbrew').length, Math.random);
        const takeout = menu === 'beans' || Math.random() < d.F.L.takeoutShare, kind = takeout ? 'takeout' : 'dine';
        d.pending.push({ p: spawn(d.F, kind, { look: randomLook(d.place), hold: true }), menu, kind });
      }
      while (d.regs.length && d.regs[0].at <= d.clock) {
        const r = d.regs.shift();
        d.pending.push({ p: spawn(d.F, 'dine', { look: PEOPLE[r.id], hold: true, named: true }), menu: BIZ_REGULARS[d.place][r.id].menu, kind: 'dine', regular: r.id });
      }
      for (const t of d.tickets.slice()) {
        if (t.state === 'auto') {
          t.left -= dt;
          if (t.left <= 0) finishCup(t, B.autoCup(t.menu, d.err));
        } else if (t.state === 'wait' && !t.regular) {
          t.patience -= dt;
          if (t.patience <= 0) {
            d.tickets = d.tickets.filter((x) => x !== t); d.sig = null;
            d.stats.lost += 1; d.F.lost += 1;
            if (d.F.people.includes(t.p)) { t.p.hold = false; sendOut(d.F, t.p); }
            sfx.play('bad'); env.flash('손님이 기다리다 그냥 갔어요');
          }
        }
      }
      if (d.clock >= DAY_SEC && !d.busy) { d.resolve(); return; }
    }
    d.hudT = (d.hudT || 0) + dt;
    if (d.hudT > 0.25) { d.hudT = 0; setHudDay(Math.min(d.clock, DAY_SEC)); renderTickets(); }
  }

  // ── 하루 ──
  async function morning() {
    const b = biz();
    syncStoryDay(); setHudDay();
    env.startMusic();
    await env.dayCard(`${SEASON_NAME[b.season]} ${b.day}일차`, `${B.weekdayOf(b.day)}요일 · ${WEATHER_NAME[b.weather]}`, B.isWeekend(b.day) ? '주말이에요' : '평일이에요');
    env.setFront('owner'); env.barView();
    const visit = OWNER_VISIT.find((v) => v.day === b.day);
    if (visit) { env.showDialog(); await env.showLine('owner', visit.text); }
    env.setFront(null); env.barView(); env.hideDialog();
    // 아침 칸 맞추기: 시간이 멈춘 상태. 오늘 자동 잔의 맛을 정한다
    let accepted = false, advice = null, err = 0;
    while (!accepted) {
      env.showStepbar();
      const r = await runBrew(brewCtx, { menu: 'espresso', do: ['grind', 'extract'], title: '아침 칸 맞추기', tips: { grind: advice ? `${advice} 오늘 자동 잔의 맛이 이 칸으로 정해져요.` : '오늘의 칸을 맞춰요. 오늘 자동 잔의 맛이 이 칸으로 정해져요.' } }, { advice });
      err = r.grind - G.idealGrind(env.S.day, 'espresso');
      const again = await env.showResult(r, { goLabel: '이 칸으로 영업', canAgain: true });
      advice = r.band === 'good' ? null : G.grindAdvice(r.band);
      accepted = !again;
    }
    env.leaveBrewQuiet();
    if (env.S.choices.place === 'office') {
      const n = await env.pick(`오늘 콜드브루를 몇 병 준비할까요? 병당 ${won(COLDBREW_COST)}이고, 남으면 저녁에 버려요.`, [['안 만들어요', 0], ['2병', 2], ['4병', 4], ['6병', 6]]);
      B.prepColdbrew(b, n);
    }
    const d = await env.pick(`오늘 디저트를 몇 개 들일까요? 외부에서 개당 ${won(SIDE.dessert.unitCost)}에 받아 ${won(SIDE.dessert.price)}에 팔아요. 남으면 저녁에 버려요.`, [['안 들여요', 0], ['4개', 4], ['8개', 8], ['12개', 12]]);
    B.buyDessert(b, d);
    if (b.stock.beans < ROAST.lowStock && b.money >= ROAST.batchCost) {
      const roast = await env.pick(`원두가 ${b.stock.beans}봉지 남았어요. 오늘 로스팅할까요? 생두값 ${won(ROAST.batchCost)}으로 ${ROAST.bags}봉지가 나와요.`, [['로스팅할게요', true], ['오늘은 안 해요', false]]);
      if (roast) {
        env.showStepbar();
        ui.setSteps([], [], -1, '원두 로스팅');
        $('steps').innerHTML = '';
        const temp = await runRoast(brewCtx, ROAST);
        const q = B.roastBatch(b, temp);
        env.leaveBrewQuiet();
        env.flash(`${temp.toFixed(0)}℃에 꺼냈어요. 품질 ${Math.round(q * 100)}%`);
      }
    }
    return err;
  }
  function openShop(err) {
    const b = biz(), place = env.S.choices.place;
    const F = createFloor(place); F.auto = false;
    prefill(F, place === 'home' ? 3 : 1, Math.random, () => randomLook(place));
    day = {
      place, F, err, clock: 0, clockOn: true, busy: false, tickets: [], pending: [], nextId: 1, sig: null, stats: B.newDayStats(),
      arrivals: B.planDay(place, b.day, b.weather, b.rep), regs: B.regularsOfDay(place, b.day).sort((a, x) => a.at - x.at), resolve: null,
    };
    mainView();
    $('tickets').classList.remove('hide');
    renderTickets();
    env.setFade(0.7);
    return new Promise((done) => {
      day.resolve = done;
      ticks.add(tick);
    });
  }
  function closeUp() {
    const b = biz(), d = day;
    ticks.delete(tick);
    day = null;
    $('tickets').classList.add('hide');
    const lost = d.tickets.filter((t) => !t.regular).length; // 문 닫을 때 남은 손님은 놓친 걸로 치지 않지만 알려 준다
    const wasted = B.endOfDayStock(b);
    return { ...B.closeDay(b, d.stats), leftAtClose: lost, wasted };
  }
  function settleScreen(rec) {
    const b = biz();
    return new Promise((done) => {
      const box = $('settle');
      const draw = () => {
        const rows = [['오늘 매출', won(rec.sales)], ['팁', won(rec.tips)], ['재료비', `- ${won(rec.cost)}`], ['오늘 번 돈', won(rec.net)], ['손님', `${rec.served}명`], ['기다리다 간 손님', `${rec.lost}명`], ['별 평균', rec.avg.toFixed(1)], ['평판', `${b.rep.toFixed(1)} (${rec.repDelta >= 0 ? '+' : ''}${rec.repDelta})`]];
        rows.splice(1, 0, ['커피 외 판매', `디저트 ${rec.dessert}개 · 원두 ${rec.beans}봉지 · ${won(rec.sideSales)}`]);
        if (rec.wasted.coldbrew || rec.wasted.dessert) rows.push(['저녁에 버린 것', `콜드브루 ${rec.wasted.coldbrew}병 · 디저트 ${rec.wasted.dessert}개`]);
        rows.push(['남은 원두', `${b.stock.beans}봉지`]);
        const left = DAYS_PER_SEASON - b.day;
        box.innerHTML = `<h2>${SEASON_NAME[b.season]} ${b.day}일차 마감</h2>
          <div class="sRows">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
          <div class="sMoney">가진 돈 <b>${won(b.money)}</b><small>${left ? `월세 ${won(RENT_PER_SEASON[env.S.choices.place])}까지 ${left}일 남았어요` : '오늘이 계절 결산이에요'}</small></div>
          <h3>장비 들이기</h3>
          <div class="sEquip">${Object.entries(EQUIP).map(([id, e]) => `<button data-buy="${id}"${b.equip[id] || b.money < e.price ? ' disabled' : ''}><b>${e.name}</b><span>${b.equip[id] ? '샀어요' : won(e.price)}</span><small>${e.text}</small></button>`).join('')}</div>
          <button class="mainBtn sNext" id="settleNext">${left ? '다음 날' : '봄 결산 보기'}</button>`;
        box.querySelectorAll('[data-buy]').forEach((el) => { el.onclick = () => { if (B.buyEquip(b, el.dataset.buy)) { sfx.play('star'); env.save(); draw(); } }; });
        $('settleNext').onclick = () => { sfx.play('click'); box.classList.add('hide'); done(); };
      };
      draw(); box.classList.remove('hide'); box.scrollTop = 0;
    });
  }
  function seasonScreen(s) {
    return new Promise((done) => {
      const box = $('settle');
      box.innerHTML = `<h2>봄 결산</h2>
        <p class="sLead">${s.money >= 0 ? '봄을 무사히 넘겼어요.' : '월세를 내고 나니 빚이 생겼어요. 그래도 가게는 계속돼요.'}</p>
        <div class="sRows"><div><span>영업한 날</span><b>${s.days}일</b></div><div><span>번 돈(재료비 뺌)</span><b>${won(s.income)}</b></div><div><span>월세</span><b>- ${won(s.rent)}</b></div><div><span>손님</span><b>${s.served}명</b></div><div><span>기다리다 간 손님</span><b>${s.lost}명</b></div><div><span>별 평균</span><b>${s.avgStars}</b></div><div><span>평판</span><b>${s.rep}</b></div></div>
        <div class="sMoney">가진 돈 <b>${won(s.money)}</b></div>
        <p class="sLead">여름부터는 지금 만들고 있어요. 다음 계절이 열리면 여기서 이어져요.</p>
        <button class="mainBtn sNext" id="settleNext">타이틀로</button>`;
      box.classList.remove('hide');
      $('settleNext').onclick = () => { box.classList.add('hide'); done(); };
    });
  }

  return {
    async run() {
      for (;;) {
        const b = biz();
        if (b.finished) { env.toTitle(); return; }
        const err = await morning();
        env.save();
        await openShop(err);
        const rec = closeUp();
        env.save();
        await settleScreen(rec);
        if (B.isSeasonEnd(b)) {
          const s = B.settleSeason(b, env.S.choices.place);
          b.finished = true; env.save();
          await seasonScreen(s);
          env.toTitle();
          return;
        }
        B.nextDay(b); env.save();
      }
    },
    get day() { return day; },
    act,
  };
}
