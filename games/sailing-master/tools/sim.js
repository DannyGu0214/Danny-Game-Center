// 밸런스 봇: 사람이 할 만한 순서로 건지고, 입항하고, 배를 키워 강 끝까지 간다. node tools/sim.js [시드] [최대 분] [v] [nocrew]
// 표류물과 발견지 자리는 아는 채로 움직여서, 실제 사람보다 조금 빠르다.
import * as G from '../logic.js';
import * as SH from '../ship.js';
import { worldOf } from '../world.js';
import { HULLS, MODULES, ROLES, ITEMS, MAT_IDS, TRADE_IDS, WORKSHOP } from '../data.js';

const seed = Number(process.argv[2]) || 1, maxMin = Number(process.argv[3]) || 240, verbose = process.argv[4] === 'v', noCrew = process.argv.includes('nocrew'); // nocrew: 선원 없이(배치 효과 비교용)
const S = G.newGame(seed), log = {}, income = {};
const mark = (k) => { if (!(k in log)) { log[k] = +(S.t / 60).toFixed(1); if (verbose) console.log(log[k], '분', k, JSON.stringify(S.res)); } };

// 설계: 없으면 빈칸에 놓는다
function tryPlace(id) {
  if (S.ship.mods.filter((m) => m.id === id).length >= (id === 'hold' ? 2 : 1)) return false; // 화물칸은 두 개까지(남는 목재를 다 넣지 않게)
  if (!G.isUnlocked(S, id)) return false;
  const [w, h] = [MODULES[id].w, MODULES[id].h];
  for (const [c, r] of SH.validCells(S.ship.hull)) {
    for (const rot of w === h ? [0] : [0, 1]) {
      if (SH.canPlace(S.ship, { id, col: c, row: r, rot }) && G.placeModule(S, id, c, r, rot).ok) return true;
    }
  }
  return false;
}
// 다음 목표 칸: 뗏목 → 나룻배 → 나룻배 ★2 → 슬루프. 슬루프 다음은 ★2·★3을 키우면 짓고, 강 끝까지 간다
const goal = () => { const H = HULLS[S.ship.hull]; return H.kind === 'raft' ? HULLS.rowboat : H.kind === 'rowboat' ? (H.star < 2 ? HULLS.rowboat2 : HULLS.sloop) : H.star < 2 ? HULLS.sloop2 : null; };
function shop() {
  const H = HULLS[S.ship.hull], g = goal(), next = g?.price || {};
  // 교역품은 다 판다. 다음 배에 안 드는 재료는 넉넉히 남기고 판다
  for (const k of TRADE_IDS) if (S.res[k]) income.trade = (income.trade || 0) + G.sell(S, k, S.res[k]);
  const wantCoin = (next.coin || 0) + 30;
  // 금화가 바닥나면 다음 배 재료라도 식량·수리 값만큼은 판다(굶으며 재료만 쌓는 교착 방지)
  if (S.res.coin < 15) for (const k of ['oak', 'canvas', 'cloth', 'nail', 'tar', 'hemp']) { if (S.res.coin >= 30) break; if (S.res[k]) G.sell(S, k, Math.min(S.res[k], Math.ceil((30 - S.res.coin) / (ITEMS[k].sell || 1)))); }
  for (const k of MAT_IDS) {
    if (S.res.coin >= wantCoin) break;
    const keep = (next[k] || 0) + 5 + (k === 'wood' ? Math.ceil(HULLS[S.ship.hull].hp * 0.6) : 0); // 수리용 잡목은 남겨 둔다
    if ((S.res[k] || 0) > keep) G.sell(S, k, S.res[k] - keep);
  }
  // 모자란 고급 재료는 공방에서, 밧줄·쇠못은 사서 채운다(돛대 값까지)
  const m = MODULES.mast_m.cost, need = { ...next };
  if (g && g.kind === 'sloop' && g.star === 1) for (const [k, v] of Object.entries(m)) need[k] = (need[k] || 0) + v;
  for (const [low, up] of Object.entries(WORKSHOP.pairs)) {
    const short = (need[up] || 0) - (S.res[up] || 0), spare = (S.res[low] || 0) - (need[low] || 0) - 10;
    if (short > 0 && spare >= WORKSHOP.ratio && S.res.coin > 40) G.craft(S, low, Math.min(short, Math.floor(spare / WORKSHOP.ratio)));
  }
  for (const k of ['hemp', 'nail']) { const short = (need[k] || 0) - (S.res[k] || 0); if (short > 0 && S.res.coin > (next.coin || 0) + 10) G.buyMat(S, k, short); }
  if (S.hull < 0.75 && !G.repair(S)) G.repairWithWood(S);
  // 슬루프는 돛대 값까지 있을 때 짓는다(돛대 없이 강을 다니면 노로만 가야 한다)
  const ready = g && (g.kind !== 'sloop' || g.star > 1 || (S.blueprints.mast_m && Object.entries(need).every(([k, v]) => (S.res[k] || 0) >= v)));
  if (ready && G.buildHull(S, g.id).ok) mark(g.star > 1 ? `${g.name} ★${g.star}` : g.name);
  const H2 = HULLS[S.ship.hull]; // 방금 지었으면 새 배 기준으로
  const list = H2.kind === 'raft' ? [] : H2.kind === 'rowboat' ? ['mast_s', 'telescope', 'hold', 'food', 'hammock', 'awning'] : ['mast_m', 'telescope', 'hold', 'food', 'hammock', 'awning', 'ballast', 'net'];
  for (const id of list) tryPlace(id);
  // 비어 있는 일자리에 맞는 사람부터 뽑는다(자리 없는 역할은 안 뽑음)
  if (!noCrew && S.crew.length < G.stats(S).crewCap) {
    const free = new Set(G.seatsOf(S).filter((q) => q.type !== 'rest' && q.type !== 'helm' && !S.crew.some((c) => c.seat === q.key)).map((q) => q.type));
    if (!G.workerAt(S, 'helm')) free.add('helm');
    for (const c of G.candidatesAt(S)) if (free.has(ROLES[c.role].seat) && !G.hasRole(S, c.role) && S.res.coin > c.hireCost * 2 && G.hire(S, c.id).ok) { mark(`고용 ${c.role}`); break; }
  }
  const need2 = Math.min(G.stats(S).foodCap - S.food, S.res.coin - 5);
  if (need2 > 0) G.buyFood(S, Math.floor(need2), 'bread');
  if ((S.herb || 0) < 1 && S.res.coin > 60) G.buyHerb(S, 1);
}
function nearestPort() {
  const w = worldOf(S.region), b = S.boat;
  return w.ports.slice().sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
}
function think() {
  const w = worldOf(S.region), b = S.boat, st = G.stats(S), persons = 1 + S.crew.length;
  if (st.sailArea) {
    const want = S.weather.gustOn || S.weather.gustSoon ? 1 : 2;
    if (b.sailLevel !== want && !S.cap.to) G.setSail(S, want);
  }
  // 수리비가 없으면 항구로 가도 소용없으니 벌러 나간다. 다음 배 재료가 모이면 바로 돌아간다
  const wantBuild = HULLS[S.ship.hull].kind === 'raft' && G.canAffordHull(S, G.nextHull(S));
  const low = wantBuild || S.food < persons * 0.7 || (S.hull < 0.4 && S.res.coin >= G.repairCost(S)) || S.vigor < 0.3 || G.holdUsed(S) >= st.holdCap;
  if (low) {
    if (!(S.route && S.route.target && S.route.target.type === 'port')) { const p = nearestPort(); G.setDest(S, p.x, p.y, { type: 'port', id: p.id }); }
    return;
  }
  if (S.route) return;
  // 작은 호수와 큰 호수를 다 돌고 나룻배를 지은 뒤에 강으로 가고, 강에서는 슬루프 ★2와 돛대를 갖춰야 끝으로 간다
  const gate = w.gates[0], status = G.gateStatus(S, gate), kind = HULLS[S.ship.hull].kind, left = G.findsOf(S).some((f) => !S.found[f.id] && (!f.inland || st.telescope));
  const goOn = S.region === 'pond' ? kind !== 'raft' : S.region === 'lake' ? kind !== 'raft' && S.blueprints.mast_m && !left : !goal() && st.sailArea;
  if (status.ok && goOn) {
    if (Math.hypot(gate.x - b.x, gate.y - b.y) < 30) { G.passGate(S, gate); return; }
    G.setDest(S, gate.x, gate.y, { type: 'gate', id: gate.id }); return;
  }
  const find = G.findsOf(S).filter((f) => !S.found[f.id] && (!f.inland || st.telescope)).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
  if (find) { G.setDest(S, find.x, find.y); return; }
  const fl = G.flotsamOf(S).slice().sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
  if (fl) G.setDest(S, fl.x, fl.y, { type: 'pick' });
}

const ticks = maxMin * 60 * 30;
let thinkT = 0;
for (let i = 0; i < ticks && !S.ended; i++) {
  if (S.disaster) { const r = G.rescue(S); log.rescues = (log.rescues || 0) + 1; if (verbose) console.log('구조', JSON.stringify(r)); }
  if (S.docked) {
    shop();
    const gate = worldOf(S.region).gates[0];
    const r = G.undock(S);
    if (!r.ok && verbose) console.log('출항 못 함', r.why);
  }
  G.step(S, G.FIXED_DT);
  for (const e of S.events) {
    if (e.type === 'region' && e.first) mark(e.to === 'lake' ? '큰 호수 도착' : '강 도착');
    if (e.type === 'docked' || e.type === 'region') { for (const [k, v] of Object.entries(e.got || {})) income[k] = (income[k] || 0) + v; }
  }
  S.events.length = 0;
  if ((thinkT -= G.FIXED_DT) <= 0) { thinkT = 0.5; think(); }
}
mark(S.ended ? '강 끝' : `시간 초과(${S.region})`);
console.log(JSON.stringify({ seed, ...log, state: S.ended ? undefined : { hullHp: +S.hull.toFixed(2), food: +S.food.toFixed(1), vigor: +S.vigor.toFixed(2), mods: S.ship.mods.map((m) => m.id).join(','), crew: S.crew.length, owed: +S.owed.toFixed(1), route: S.route?.target?.type ?? null, docked: S.docked, at: [Math.round(S.boat.x), Math.round(S.boat.y)], spd: +S.boat.spd.toFixed(1), sail: S.boat.sailLevel, canMove: G.stats(S).canMove, rowing: S.boat.row }, hull: S.ship.hull, res: S.res, income, found: Object.keys(S.found).length, ach: Object.keys(S.ach).length, day: G.clock(S).day, rescues: S.stats.rescues, gusts: S.stats.gusts, gustHurt: S.stats.gustHurt }));
