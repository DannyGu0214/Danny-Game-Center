// 밸런스 봇: 사람이 할 만한 순서로 건지고, 입항하고, 배를 키워 강 끝까지 간다. node tools/sim.js [시드] [최대 분] [v]
// 표류물과 발견지 자리는 아는 채로 움직여서, 실제 사람보다 조금 빠르다.
import * as G from '../logic.js';
import * as SH from '../ship.js';
import { worldOf } from '../world.js';
import { HULLS, MODULES, ROLES } from '../data.js';

const seed = Number(process.argv[2]) || 1, maxMin = Number(process.argv[3]) || 240, verbose = process.argv[4] === 'v';
const S = G.newGame(seed), log = {}, income = { wood: 0, cloth: 0, coin: 0 };
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
  const H = HULLS[S.ship.hull], next = goal()?.price || {};
  // 코인이 모자라면 남는 재료를 판다
  const keepW = (next.wood || 0) + 20, keepC = (next.cloth || 0) + 20, wantCoin = (next.coin || 0) + 30;
  if (S.res.coin < wantCoin && S.res.cloth > keepC) G.sell(S, 'cloth', Math.min(S.res.cloth - keepC, wantCoin - S.res.coin));
  if (S.res.coin < wantCoin && S.res.wood > keepW) G.sell(S, 'wood', Math.min(S.res.wood - keepW, (wantCoin - S.res.coin) * 2));
  if (S.hull < 0.75) G.repair(S);
  const g = goal();
  // 슬루프는 돛대 값까지 있을 때 짓는다(돛대 없이 강을 다니면 노로만 가야 한다)
  const m = MODULES.mast_m.cost;
  const ready = g && (g.kind !== 'sloop' || g.star > 1 || (S.blueprints.mast_m && Object.entries(g.price).every(([k, v]) => S.res[k] >= v + (m[k] || 0))));
  if (ready && G.buildHull(S, g.id).ok) mark(g.star > 1 ? `${g.name} ★${g.star}` : g.name);
  const list = H.kind === 'raft' ? [] : H.kind === 'rowboat' ? ['mast_s', 'telescope', 'hold', 'food', 'hammock', 'awning'] : ['mast_m', 'telescope', 'hold', 'food', 'hammock', 'awning', 'ballast'];
  for (const id of list) tryPlace(id);
  if (S.crew.length < G.stats(S).crewCap) for (const c of G.candidatesAt(S)) if (!G.hasRole(S, c.role) && S.res.coin > c.hireCost * 2 && G.hire(S, c.id).ok) { mark(`고용 ${c.role}`); break; }
  const need = Math.min(G.stats(S).foodCap - S.food, S.res.coin - 5);
  if (need > 0) G.buyFood(S, Math.floor(need));
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
  const low = wantBuild || S.food < persons * 0.7 || (S.hull < 0.4 && S.res.coin + S.hold.coin >= G.repairCost(S)) || S.vigor < 0.3 || G.holdUsed(S) >= st.holdCap;
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
    if (e.type === 'docked') { for (const k of Object.keys(income)) income[k] += e.got[k]; }
  }
  S.events.length = 0;
  if ((thinkT -= G.FIXED_DT) <= 0) { thinkT = 0.5; think(); }
}
mark(S.ended ? '강 끝' : `시간 초과(${S.region})`);
console.log(JSON.stringify({ seed, ...log, hull: S.ship.hull, res: S.res, income, found: Object.keys(S.found).length, ach: Object.keys(S.ach).length, day: G.clock(S).day, rescues: S.stats.rescues, gusts: S.stats.gusts, gustHurt: S.stats.gustHurt }));
