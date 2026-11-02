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
  if (S.ship.mods.some((m) => m.id === id) && id !== 'hold') return false;
  if (!G.isUnlocked(S, id)) return false;
  const [w, h] = [MODULES[id].w, MODULES[id].h];
  for (const [c, r] of SH.validCells(S.ship.hull)) {
    for (const rot of w === h ? [0] : [0, 1]) {
      if (SH.canPlace(S.ship, { id, col: c, row: r, rot }) && G.placeModule(S, id, c, r, rot).ok) return true;
    }
  }
  return false;
}
function shop() {
  const H = S.ship.hull;
  // 코인이 모자라면 남는 재료를 판다
  const next = S.ship.hull === 'raft' ? HULLS.rowboat.price : S.ship.hull === 'rowboat' ? HULLS.sloop.price : {};
  const keepW = (next.wood || 0) + 20, keepC = (next.cloth || 0) + 20, wantCoin = (next.coin || 0) + 30;
  if (S.res.coin < wantCoin && S.res.cloth > keepC) G.sell(S, 'cloth', Math.min(S.res.cloth - keepC, wantCoin - S.res.coin));
  if (S.res.coin < wantCoin && S.res.wood > keepW) G.sell(S, 'wood', Math.min(S.res.wood - keepW, (wantCoin - S.res.coin) * 2));
  if (S.hull < 0.75) G.repair(S);
  if (H === 'raft' && G.buildHull(S, 'rowboat').ok) mark('나룻배');
  if (H === 'rowboat' && S.visited.lake && S.blueprints.mast_m && G.buildHull(S, 'sloop').ok) mark('슬루프');
  const list = S.ship.hull === 'raft' ? [] : S.ship.hull === 'rowboat' ? ['mast_s', 'hold', 'food', 'hammock', 'awning'] : ['mast_m', 'hold', 'food', 'hammock', 'awning', 'ballast'];
  for (const id of list) tryPlace(id);
  if (S.crew.length < G.stats(S).crewCap) for (const r of G.hireList(S)) if (S.res.coin > ROLES[r.role].hire * 2 && G.hire(S, r.role).ok) { mark(`고용 ${r.role}`); break; }
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
  const low = S.food < persons * 0.7 || S.hull < 0.4 || S.vigor < 0.3 || G.holdUsed(S) >= st.holdCap;
  if (low) {
    if (!(S.route && S.route.target && S.route.target.type === 'port')) { const p = nearestPort(); G.setDest(S, p.x, p.y, { type: 'port', id: p.id }); }
    return;
  }
  if (S.route) return;
  const gate = w.gates[0], status = G.gateStatus(S, gate);
  if (status.ok && (S.ship.hull === (S.region === 'pond' ? 'rowboat' : 'sloop'))) {
    if (Math.hypot(gate.x - b.x, gate.y - b.y) < 30) { G.passGate(S, gate); return; }
    G.setDest(S, gate.x, gate.y, { type: 'gate', id: gate.id }); return;
  }
  const find = w.finds.filter((f) => !S.found[f.id]).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
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
    if (G.gateStatus(S, gate).ok && Math.hypot(gate.x - S.boat.x, gate.y - S.boat.y) < 30) G.passGate(S, gate);
    const r = G.undock(S);
    if (!r.ok && verbose) console.log('출항 못 함', r.why);
  }
  G.step(S, G.FIXED_DT);
  for (const e of S.events) {
    if (e.type === 'region') mark(e.to === 'lake' ? '큰 호수 도착' : '강 도착');
    if (e.type === 'docked') { for (const k of Object.keys(income)) income[k] += e.got[k]; }
  }
  S.events.length = 0;
  if ((thinkT -= G.FIXED_DT) <= 0) { thinkT = 0.5; think(); }
}
mark(S.ended ? '강 끝' : `시간 초과(${S.region})`);
console.log(JSON.stringify({ seed, ...log, hull: S.ship.hull, res: S.res, income, found: Object.keys(S.found).length, ach: Object.keys(S.ach).length, day: G.clock(S).day, rescues: S.stats.rescues, gusts: S.stats.gusts, gustHurt: S.stats.gustHurt }));
