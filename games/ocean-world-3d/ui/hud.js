// 가로 화면 HUD와 패널(DOM만, 3D 모름 — P2). DESIGN 5.1절 배치를 줄인 MVP:
//   위 왼쪽 상태 줄(인기점수·티어 막대·행복도·시간) · 오른쪽 패널(생물 / 꾸미기[육지·해저·수중] / 요청) · 아래 가운데 선택 카드·놓기 줄
//   · 왼쪽 아래 시점 단추와 설정 · 알림(토스트) · 포착 표시(✨)
// 규칙 값은 game.G(createSim 결과)와 game.S()(지금 상태)로 읽고, 바꾸는 일은 game의 동작 함수로만 한다.
// 문구는 해요체 구어(대니님 지침).

const CSS = /* css */`
#hud { position: fixed; inset: 0; pointer-events: none; z-index: 10; font: 13px/1.4 system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #17323f; }
#hud > * { pointer-events: auto; }
#hud button { font: inherit; color: inherit; cursor: pointer; border: 1px solid rgba(23,50,63,.16); background: #fff; border-radius: 9px; padding: 4px 10px; }
#hud button:disabled { opacity: .45; cursor: default; }
#hud button.on { background: #1f8fb0; border-color: #1f8fb0; color: #fff; }
#hud button.go { background: #ffcf4a; border-color: #e9b52a; font-weight: 700; }
.hud-glass { background: rgba(255,255,255,.86); border: 1px solid rgba(23,50,63,.12); border-radius: 14px; backdrop-filter: blur(8px); box-shadow: 0 6px 22px rgba(10,40,60,.12); }
#hud-top { position: absolute; left: 12px; top: 12px; display: flex; align-items: center; gap: 14px; padding: 8px 14px; flex-wrap: wrap; max-width: calc(100vw - 380px); }
#hud-top .pop { font-size: 18px; font-weight: 800; }
#hud-top .inc { opacity: .65; font-size: 12px; margin-left: 4px; }
#hud-top .tier { display: flex; align-items: center; gap: 8px; }
#hud-top .tier b { font-size: 15px; }
#hud-top .bar { width: 140px; height: 9px; border-radius: 6px; background: rgba(23,50,63,.12); overflow: hidden; }
#hud-top .bar i { display: block; height: 100%; background: linear-gradient(90deg, #3cc0d8, #1f8fb0); width: 0; transition: width .3s; }
#hud-top .muted { opacity: .7; }
#hud-panel { position: absolute; right: 12px; top: 12px; bottom: 12px; width: 340px; display: flex; flex-direction: column; overflow: hidden; }
#hud-panel.closed { width: auto; bottom: auto; }
#hud-panel.closed .tabs button:not(.fold), #hud-panel.closed .body { display: none; }
#hud-panel .tabs { display: flex; gap: 6px; padding: 10px 10px 8px; border-bottom: 1px solid rgba(23,50,63,.1); }
#hud-panel .tabs .fold { margin-left: auto; }
#hud-panel .sub { display: flex; gap: 6px; padding: 8px 10px 0; }
#hud-panel .body { overflow-y: auto; padding: 8px 10px 12px; flex: 1; }
#hud-panel .cap { opacity: .72; margin: 2px 2px 8px; font-size: 12px; }
.hud-card { display: grid; grid-template-columns: 34px 1fr auto; gap: 2px 8px; align-items: center; padding: 8px; border-radius: 11px; border: 1px solid rgba(23,50,63,.08); margin-bottom: 6px; background: rgba(255,255,255,.7); }
.hud-card.locked { opacity: .55; }
.hud-card .ic { font-size: 24px; grid-row: span 2; text-align: center; }
.hud-card .nm { font-weight: 700; }
.hud-card .nm small { font-weight: 400; opacity: .6; margin-left: 4px; }
.hud-card .ds { font-size: 12px; opacity: .75; grid-column: 2; }
.hud-card .ac { grid-row: span 2; grid-column: 3; text-align: right; }
.hud-card .why { font-size: 11px; color: #b0513a; grid-column: 2 / 4; }
.hud-req { padding: 9px; border-radius: 11px; border: 1px solid rgba(23,50,63,.08); margin-bottom: 7px; background: rgba(255,255,255,.7); }
.hud-req .row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.hud-req .prog { flex: 1; height: 7px; border-radius: 5px; background: rgba(23,50,63,.1); overflow: hidden; }
.hud-req .prog i { display: block; height: 100%; background: #3cc0d8; }
.hud-req.done { border-color: #e9b52a; background: #fff7d6; }
#hud-bottom { position: absolute; left: calc((100vw - 364px) / 2 + 60px); bottom: 14px; transform: translateX(-50%); min-width: 340px; max-width: min(560px, calc(100vw - 560px)); padding: 10px 14px; display: none; }
#hud-bottom.show { display: block; }
#hud-bottom .hd { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
#hud-bottom .hd .x { margin-left: auto; padding: 2px 8px; }
#hud-bottom .ln { margin-top: 6px; }
#hud-bottom .need { display: inline-block; margin: 4px 8px 0 0; }
#hud-bottom .acts { display: flex; gap: 6px; margin-top: 9px; flex-wrap: wrap; align-items: center; }
#hud-bottom .msg.ok { color: #1d7a4a; } #hud-bottom .msg.no { color: #b0513a; }
#hud-views { position: absolute; left: 12px; bottom: 12px; display: flex; gap: 6px; padding: 7px; }
#hud-toasts { position: absolute; left: calc((100vw - 364px) / 2); top: 70px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; }
#hud-toasts div { background: rgba(10,40,58,.86); color: #f3fbff; padding: 8px 16px; border-radius: 20px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,.2); animation: hudIn .25s ease; }
#hud-toasts div.big { background: linear-gradient(90deg, #ffcf4a, #ffb02e); color: #3a2a00; font-size: 16px; }
@keyframes hudIn { from { opacity: 0; transform: translateY(-6px); } }
#hud-chance { position: absolute; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; display: none; align-items: center; justify-content: center;
  font-size: 26px; background: radial-gradient(circle, rgba(255,240,170,.95), rgba(255,200,60,.55) 60%, rgba(255,200,60,0) 72%); animation: hudPulse 0.9s ease-in-out infinite; cursor: pointer; }
#hud-chance.show { display: flex; }
#hud-chance .t { position: absolute; bottom: -16px; font: 700 11px system-ui; color: #fff; text-shadow: 0 1px 3px #000; }
#hud-chance.edge { background: rgba(255,200,60,.9); font-size: 18px; }
@keyframes hudPulse { 50% { transform: scale(1.14); } }
#hud-modal { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(4,30,46,.35); }
#hud-modal.show { display: flex; }
#hud-modal .box { max-width: 420px; padding: 20px 22px; text-align: center; }
#hud-modal .box h3 { margin: 0 0 8px; font-size: 19px; }
#hud-modal .box .acts { margin-top: 14px; display: flex; gap: 8px; justify-content: center; }
body.intro #hud, body.capture:not(.hud) #hud { display: none; }
#ui { display: none; }
#ui.show { display: flex; }
@media (max-width: 899px) {
  #hud-panel { top: auto; left: 12px; right: 12px; width: auto; height: 42vh; }
  #hud-panel.closed { height: auto; left: auto; }
  #hud-top { max-width: calc(100vw - 24px); }
  #hud-bottom { left: 50%; bottom: calc(42vh + 22px); max-width: calc(100vw - 24px); }
  #hud-toasts { left: 50%; }
}
`;

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const pct = (v) => Math.round(v * 100) + '%';

/**
 * @param {object} game
 *   G, S() 지금 상태, eco
 *   adopt(sp) · startPlace(id) · setLayer(L) · rotate() · confirmPlace() · cancelPlace() · release(uid) · removeItem(uid)
 *   capture() · claim(uid) · swap(uid) · claimExt(key) · setView(name) · deselect() · panelChanged(open)
 * @returns HUD 핸들
 */
export function createHud(game) {
  if (!document.getElementById('ow-hud-css')) { const st = document.createElement('style'); st.id = 'ow-hud-css'; st.textContent = CSS; document.head.appendChild(st); }
  const G = game.G, eco = G.eco, SP = eco.species, IT = eco.items, NEEDS = eco.needs;
  const root = el(`<div id="hud">
    <div id="hud-top" class="hud-glass">
      <span><span class="pop">⭐ 0</span><span class="inc"></span></span>
      <span class="tier"><b>T1</b><span class="bar"><i></i></span><span class="muted dev"></span></span>
      <span class="happy"></span>
      <span class="muted clock"></span>
    </div>
    <div id="hud-panel" class="hud-glass">
      <div class="tabs">
        <button data-tab="animals" class="on">생물</button><button data-tab="items">꾸미기</button><button data-tab="reqs">요청 <span class="badge"></span></button>
        <button class="fold" data-act="fold" title="패널 접기">⟩</button>
      </div>
      <div class="sub"></div>
      <div class="body"></div>
    </div>
    <div id="hud-bottom" class="hud-glass"></div>
    <div id="hud-views" class="hud-glass">
      <button data-view="default">기본</button><button data-view="top">위</button><button data-view="side">옆</button><button data-act="settings" title="설정·확인용">⚙</button>
    </div>
    <div id="hud-toasts"></div>
    <div id="hud-chance"><span>✨</span><span class="t"></span></div>
    <div id="hud-modal"><div class="box hud-glass"></div></div>
  </div>`);
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const panel = $('#hud-panel'), body = $('#hud-panel .body'), sub = $('#hud-panel .sub'), bottom = $('#hud-bottom');
  let tab = 'animals', zone = 'bed', sel = null, placing = null, lastRender = 0, lastKey = '';

  // ---------- 상태 줄 ----------
  function renderTop() {
    const S = game.S(), st = G.stats(S), clock = G.clock(S);
    $('#hud-top .pop').textContent = '⭐ ' + fmt(S.pop);
    $('#hud-top .inc').textContent = `+${G.incomePerMin(S).toFixed(1)}/분`;
    $('#hud-top .tier b').textContent = 'T' + S.tier;
    const lo = G.TIERS[S.tier - 1] ?? 0, hi = st.next;
    $('#hud-top .bar i').style.width = hi == null ? '100%' : Math.max(0, Math.min(100, ((st.dev - lo) / (hi - lo)) * 100)) + '%';
    $('#hud-top .dev').textContent = hi == null ? `발전도 ${fmt(st.dev)} · 최고 티어` : `발전도 ${fmt(st.dev)} / ${fmt(hi)}`;
    $('#hud-top .happy').textContent = st.animals ? `행복 ${pct(st.H)}` : '';
    $('#hud-top .clock').textContent = `${['🌅', '☀️', '🌇', '🌙'][clock.phase] ?? ''} ${clock.day}일차 · ${clock.name}`;
    const ready = G.requestsOf(S).filter((q) => G.requestDone(S, q)).length + (G.extOpen(S) ? G.extReady(S) : 0);
    $('#hud-panel .badge').textContent = ready ? `(${ready})` : '';
  }

  // ---------- 패널 ----------
  const needIcons = (needs) => needs.map((k) => NEEDS[k]?.icon ?? k).join('');
  const giveText = (give) => Object.entries(give).map(([k, n]) => `${NEEDS[k].icon}${n}`).join(' ') || '꾸밈';
  const kindNames = (on) => on.filter((k) => eco.kinds[k]).map((k) => eco.kinds[k].name).join('·');
  function animalsHtml(S) {
    const st = G.stats(S);
    let h = `<div class="cap">생물 ${st.animals}/${st.caps.animals}마리 · ${st.species}/${st.caps.species}종 · 들이면 생물이 블록에 "퐁" 들어와요</div>`;
    for (const s of G.speciesIds) {
      const d = SP[s], c = G.canAdopt(S, s), locked = S.tier < d.tier, have = st.counts[s] || 0;
      h += `<div class="hud-card${locked ? ' locked' : ''}"><span class="ic">${d.icon ?? ''}</span>
        <span class="nm">${d.name}<small>T${d.tier}${have ? ` · ${have}마리` : ''}</small></span>
        <span class="ac"><button class="go" data-adopt="${s}" ${c.ok ? '' : 'disabled'}>⭐${G.priceOfAnimal(s)}</button></span>
        <span class="ds">필요 ${needIcons(d.needs)}${have ? ` · 행복 ${pct(st.happy[s] ?? 1)}` : ''}</span>
        ${c.ok ? '' : `<span class="why">${c.why}</span>`}</div>`;
    }
    return h;
  }
  function itemsHtml(S) {
    let h = '';
    for (const id of G.itemIds) {
      const d = IT[id];
      if (d.zone !== zone) continue;
      const locked = S.tier < d.tier, price = G.priceOfItem(id), n = G.stats(S).items[id] || 0;
      const lim = G.limitWhy ? G.limitWhy(S, id) : null;
      const why = locked ? `T${d.tier}에서 해금` : lim || (S.pop < price ? '인기점수가 모자라요' : null);
      const where = d.zone === 'water' ? d.layers.map((L) => eco.layers[L].name).join('·') : kindNames(d.on);
      h += `<div class="hud-card${locked ? ' locked' : ''}"><span class="ic">${d.icon ?? ''}</span>
        <span class="nm">${d.name}<small>T${d.tier} · ${d.w}×${d.h}${n ? ` · ${n}개` : ''}</small></span>
        <span class="ac"><button class="go" data-place="${id}" ${why ? 'disabled' : ''}>⭐${price}</button></span>
        <span class="ds">${giveText(d.give)} · 📍${where}</span>
        ${why ? `<span class="why">${why}</span>` : ''}</div>`;
    }
    return h || '<div class="cap">이 구역 물건이 없어요</div>';
  }
  function reqText(S, q) {
    const nm = (s) => `${SP[s].icon ?? ''}${SP[s].name}`;
    if (q.kind === 'adopt') return `${nm(q.sp)} ${q.n}마리 키우기`;
    if (q.kind === 'species') return `생물 ${q.n}종 모으기`;
    if (q.kind === 'set') return Object.entries(q.need).map(([k, n]) => `${NEEDS[k].icon}${NEEDS[k].name} 물건 ${n}개`).join(' · ') + ' 갖추기';
    if (q.kind === 'terrain') return `${IT[q.item].icon ?? ''}${IT[q.item].name}을 ${q.layer ? eco.layers[q.layer].name : eco.kinds[q.on].name}에 ${q.n}개`;
    if (q.kind === 'happy') return `행복도 ${q.pct}% 넘기기`;
    return `${nm(q.sp)} 특수 행동 포착${q.phase != null ? `(${G.PHASES[q.phase]}에)` : ''}`;
  }
  const EXT_NAMES = { visit: '확장 영역 둘러보기', item: '확장 영역에 물건 놓기', needs: '확장 영역에 먹이·쉼터·맑은 물 물건', theme: '테마 물건(맹그로브·수상 데크) 2개', residents: '확장 영역에 생물 6마리', zones: '서로 다른 구역 물건 2가지' };
  function reqsHtml(S) {
    let h = '<div class="cap">관람객 요청을 채우면 보상을 받아요</div>';
    const cool = Math.max(0, Math.ceil(S.reqSwapAt - S.time));
    for (const q of G.requestsOf(S)) {
      const [a, b] = G.requestProgress(S, q), done = G.requestDone(S, q);
      h += `<div class="hud-req${done ? ' done' : ''}"><div>${reqText(S, q)}</div>
        <div class="row"><span class="prog"><i style="width:${b ? (a / b) * 100 : 0}%"></i></span><span>${a}/${b}</span>
        ${done ? `<button class="go" data-claim="${q.uid}">⭐${q.reward} 받기</button>` : `<span class="muted">⭐${q.reward}</span><button data-swap="${q.uid}" ${cool ? 'disabled' : ''} title="다른 요청">${cool ? cool + '초' : '바꾸기'}</button>`}</div></div>`;
    }
    if (G.extOpen(S) && G.EXT_GOALS.length) {
      h += `<div class="cap" style="margin-top:12px">확장 영역 꾸미기${G.extMaster(S) ? ' · 마스터 달성!' : ''}</div>`;
      for (const g of G.EXT_GOALS) {
        const [a, b] = G.extProgress(S, g.key), got = S.ext.got.includes(g.key), done = S.ext.done.includes(g.key);
        h += `<div class="hud-req${done && !got ? ' done' : ''}"><div>${EXT_NAMES[g.key] ?? g.key}</div><div class="row"><span class="prog"><i style="width:${(a / b) * 100}%"></i></span><span>${a}/${b}</span>
          ${got ? '<span class="muted">받음</span>' : done ? `<button class="go" data-ext="${g.key}">받기</button>` : ''}</div></div>`;
      }
    }
    return h;
  }
  function renderPanel(force = false) {
    if (panel.classList.contains('closed')) return;
    const S = game.S();
    sub.innerHTML = tab === 'items' ? Object.entries(eco.zones).map(([k, z]) => `<button data-zone="${k}" class="${k === zone ? 'on' : ''}">${z.name}</button>`).join('') : '';
    const html = tab === 'animals' ? animalsHtml(S) : tab === 'items' ? itemsHtml(S) : reqsHtml(S);
    if (force || html !== lastKey) { const top = body.scrollTop; body.innerHTML = html; body.scrollTop = top; lastKey = html; }
  }

  // ---------- 아래 카드 ----------
  function renderBottom() {
    const S = game.S();
    if (placing) {
      const d = IT[placing.id], p = placing;
      const layers = d.zone === 'water' ? d.layers.map((L) => `<button data-layer="${L}" class="${L === p.layer ? 'on' : ''}">${eco.layers[L].name}</button>`).join('') : '';
      bottom.innerHTML = `<div class="hd">${d.icon ?? ''} ${d.name} 놓기<button class="x" data-act="cancel">취소</button></div>
        <div class="ln msg ${p.ok ? 'ok' : 'no'}">${p.ok ? '여기에 놓을 수 있어요. 블록을 누르면 자리를 옮겨요' : p.why}</div>
        <div class="acts">${layers}<button data-act="rotate" title="돌리기(R)">⟳</button><button class="go" data-act="confirm" ${p.ok ? '' : 'disabled'}>놓기 ⭐${G.priceOfItem(p.id)}</button></div>`;
      bottom.classList.add('show');
      return;
    }
    if (!sel) { bottom.classList.remove('show'); return; }
    if (sel.kind === 'animal') {
      const a = S.animals.find((b) => b.uid === sel.uid);
      if (!a) { sel = null; bottom.classList.remove('show'); return; }
      const d = SP[a.sp], st = G.stats(S), met = st.needMet[a.sp] || {}, c = G.canRelease(S, a.uid);
      const isChance = S.chance && S.chance.uid === a.uid;
      bottom.innerHTML = `<div class="hd">${d.icon ?? ''} ${d.name}<small class="muted">T${d.tier} · ${eco.sizes[d.size].name}</small><button class="x" data-act="close">✕</button></div>
        <div class="ln">${d.needs.map((k) => `<span class="need">${NEEDS[k].icon}${NEEDS[k].name} ${met[k] >= 0.999 ? '✓' : pct(met[k] ?? 0)}</span>`).join('')}</div>
        <div class="ln muted">행복 ${pct(st.happy[a.sp] ?? 1)} · 특수 행동: ${d.special}</div>
        <div class="acts">${isChance ? '<button class="go" data-act="capture">✨ 포착!</button>' : ''}
          <button data-act="release" ${c.ok ? '' : 'disabled'}>방생(⭐${Math.floor(a.paid * eco.econ.refund)} 돌려받기)</button>${c.ok ? '' : `<span class="muted">${c.why}</span>`}</div>`;
    } else {
      const it = S.items.find((b) => b.uid === sel.uid);
      if (!it) { sel = null; bottom.classList.remove('show'); return; }
      const d = IT[it.id];
      bottom.innerHTML = `<div class="hd">${d.icon ?? ''} ${d.name}<small class="muted">${eco.zones[d.zone].name}${it.layer ? ' · ' + eco.layers[it.layer].name : ''}</small><button class="x" data-act="close">✕</button></div>
        <div class="ln">${giveText(d.give)}</div>
        <div class="acts"><button data-act="remove">치우기(⭐${Math.floor(it.paid * eco.econ.refund)} 돌려받기)</button></div>`;
    }
    bottom.classList.add('show');
  }

  // ---------- 입력 ----------
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.tab) { tab = ds.tab; for (const t of root.querySelectorAll('[data-tab]')) t.classList.toggle('on', t.dataset.tab === tab); renderPanel(true); return; }
    if (ds.zone) { zone = ds.zone; renderPanel(true); return; }
    if (ds.adopt) { game.adopt(ds.adopt); renderPanel(true); return; }
    if (ds.place) { game.startPlace(ds.place); return; }
    if (ds.claim) { game.claim(+ds.claim); renderPanel(true); return; }
    if (ds.swap) { game.swap(+ds.swap); renderPanel(true); return; }
    if (ds.ext) { game.claimExt(ds.ext); renderPanel(true); return; }
    if (ds.layer) { game.setLayer(ds.layer); return; }
    if (ds.view) { game.setView(ds.view); return; }
    const act = ds.act;
    if (act === 'fold') { const closed = panel.classList.toggle('closed'); b.textContent = closed ? '⟨ 패널' : '⟩'; game.panelChanged(!closed); renderPanel(true); }
    else if (act === 'settings') document.getElementById('ui')?.classList.toggle('show');
    else if (act === 'cancel') game.cancelPlace();
    else if (act === 'rotate') game.rotate();
    else if (act === 'confirm') game.confirmPlace();
    else if (act === 'close') { sel = null; game.deselect(); renderBottom(); }
    else if (act === 'release') { if (sel) game.release(sel.uid); }
    else if (act === 'remove') { if (sel) game.removeItem(sel.uid); }
    else if (act === 'capture') game.capture();
  });
  const chance = $('#hud-chance');
  chance.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); game.chanceTap(); });

  return {
    root,
    /** 화면 시간 기준으로 부른다. 숫자는 매번, 목록은 0.4초마다 */
    update(now = performance.now()) {
      renderTop();
      if (now - lastRender > 400) { lastRender = now; renderPanel(); if (!placing) renderBottom(); }
    },
    refresh() { renderTop(); renderPanel(true); renderBottom(); },
    select(s) { sel = s; placing = null; renderBottom(); },
    get selected() { return sel; },
    setPlacing(p) { placing = p; if (p) sel = null; renderBottom(); },
    toast(text, big = false, ms = 2600) {
      const t = document.createElement('div'); t.textContent = text; if (big) t.className = 'big';
      const box = $('#hud-toasts'); box.appendChild(t);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => t.remove(), ms);
    },
    /** 포착 표시: null이면 숨김. { x, y, on, t } — on이 false면 화면 가장자리에 화살표 */
    chance(m) {
      if (!m) { chance.classList.remove('show'); return; }
      chance.classList.add('show');
      const W = window.innerWidth, H = window.innerHeight, pad = 34;
      let x = m.x, y = m.y - 26;
      const edge = !m.on;
      if (edge) {
        if (!m.front) { x = W - x; y = H - y; }
        x = Math.min(W - pad, Math.max(pad, x)); y = Math.min(H - pad, Math.max(pad, y));
      }
      chance.classList.toggle('edge', edge);
      chance.style.left = x + 'px'; chance.style.top = y + 'px';
      chance.firstElementChild.textContent = edge ? '✨➜' : '✨';
      chance.querySelector('.t').textContent = Math.ceil(m.t) + '초';
    },
    modal(html, buttons) {
      const m = $('#hud-modal'), box = m.querySelector('.box');
      box.innerHTML = html + `<div class="acts">${buttons.map((b, i) => `<button class="${i === 0 ? 'go' : ''}" data-m="${i}">${b.label}</button>`).join('')}</div>`;
      m.classList.add('show');
      box.querySelectorAll('[data-m]').forEach((btn) => { btn.onclick = () => { m.classList.remove('show'); buttons[+btn.dataset.m].onClick?.(); }; });
    },
    get panelOpen() { return !panel.classList.contains('closed'); },
    panelWidth() { return window.innerWidth >= 900 && !panel.classList.contains('closed') ? panel.offsetWidth + 12 : 0; },
  };
}
