// 밸런스 봇: 사람이 할 만한 순서로 건지고, 입항하고, 배를 키워 강 끝을 지나 앞바다까지 간다. node tools/sim.js [시드] [최대 분] [v] [nocrew]
// M2a: 앞바다에서는 물통을 달고 식수를 2일치 넘게 채우고, 너울이 내항성을 넘는 바다는 피하고(만 안쪽에서 놀거나 항구에서 하루 묵기),
// 앞바다 발견지를 다 찾으면 끝나요(4등급 배가 아직 없어서 큰 바다 관문은 못 넘어요).
// 표류물과 발견지 자리는 아는 채로 움직여서, 실제 사람보다 조금 빠르다.
// S5: 돌풍·폭풍은 예고부터 줄이고, 그날 폭풍이 아직 안 왔으면 항구에서 하루 묵고, 찢어진 돛은 꿰매고, 저녁엔 오늘 밤 상할 식량을 없는 셈 친다.
import * as G from '../logic.js';
import * as SH from '../ship.js';
import { worldOf } from '../world.js';
import { HULLS, MODULES, ROLES, ITEMS, MAT_IDS, TRADE_IDS, WORKSHOP, WX, CAL, REGIONS } from '../data.js';

const seed = Number(process.argv[2]) || 1, maxMin = Number(process.argv[3]) || 240, verbose = process.argv[4] === 'v', noCrew = process.argv.includes('nocrew'), reckless = process.argv.includes('reckless'); // nocrew: 선원 없이(배치 효과 비교용) · reckless: 너울을 무시(위협 확인용)
const S = G.newGame(seed), log = {}, income = {};
const mark = (k) => { if (!(k in log)) { log[k] = +(S.t / 60).toFixed(1); if (verbose) console.log(log[k], '분', k, JSON.stringify(S.res)); } };

// 설계: 없으면 빈칸에 놓는다
function tryPlace(id) {
  if (S.ship.mods.filter((m) => m.id === id).length >= (id === 'hold' || id === 'water' ? 2 : 1)) return false; // 화물칸·물통은 두 개까지(남는 목재를 다 넣지 않게)
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
// 앞바다에서는 슬루프 ★3(내구 +30%, 내항성 +0.15)까지 키운다
const goal = () => { const H = HULLS[S.ship.hull]; return H.kind === 'raft' ? HULLS.rowboat : H.kind === 'rowboat' ? (H.star < 2 ? HULLS.rowboat2 : HULLS.sloop) : H.star < 2 ? HULLS.sloop2 : H.star < 3 && S.region === 'coast' ? HULLS.sloop3 : null; };
const salt = () => !!REGIONS[S.region].salt;
// 오늘 바깥 바다 너울 × 그 자리 배율이 내항성을 넘는가(조금 여유를 둬요)
const rough = (x, y, k = 0.95) => !reckless && (S.weather?.fx?.swell || G.daySwell(S.region, S.seed, G.clock(S).day)) * worldOf(S.region).swellAt(x, y) > G.stats(S).sea * k;
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
  if (S.boat.torn && G.mendSail(S).ok) log.mendPort = (log.mendPort || 0) + 1; // 찢어진 돛은 항구에서 꿰맨다
  // 슬루프는 돛대 값까지 있을 때 짓는다(돛대 없이 강을 다니면 노로만 가야 한다)
  const ready = g && (g.kind !== 'sloop' || g.star > 1 || (S.blueprints.mast_m && Object.entries(need).every(([k, v]) => (S.res[k] || 0) >= v)));
  if (ready && G.buildHull(S, g.id).ok) mark(g.star > 1 ? `${g.name} ★${g.star}` : g.name);
  const H2 = HULLS[S.ship.hull]; // 방금 지었으면 새 배 기준으로
  const list = H2.kind === 'raft' ? [] : H2.kind === 'rowboat' ? ['mast_s', 'telescope', 'hold', 'food', 'hammock', 'awning'] : ['mast_m', 'telescope', 'hold', 'food', 'hammock', 'awning', 'ballast', 'net', 'water', 'water', 'bulkhead'];
  for (const id of list) tryPlace(id);
  // 식수: 짠물 바다에선 물통 가득(2일치 넘게)
  if (salt()) { const before = S.water; G.buyWater(S, 99); if (S.water > before) income.waterBought = (income.waterBought || 0) + (S.water - before); }
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
// 가장 가까운 항구. 앞바다는 곶 너머 항구가 곧은 거리로는 가까워 보여서 항로 길이로 재요(M2a)
const pathLen = (x, y) => { const w = worldOf(S.region), pts = w.findPath(S.boat.x, S.boat.y, x, y); if (!pts) return 1e9; let L = 0, px = S.boat.x, py = S.boat.y; for (const q of pts) { L += Math.hypot(q.x - px, q.y - py); px = q.x; py = q.y; } return L; };
function nearestPort(calm = false) {
  const w = worldOf(S.region), b = S.boat, list0 = calm ? w.ports.filter((p) => !rough(p.x, p.y, 0.8)) : w.ports, list = list0.length ? list0 : w.ports;
  const far = salt() ? (p) => pathLen(p.x, p.y) : (p) => Math.hypot(p.x - b.x, p.y - b.y);
  return list.map((p) => [p, far(p)]).sort((a, q) => a[1] - q[1])[0][0];
}
// 식수가 1.5일치 밑이면 가장 가까운 항구까지 항로로 몇 날 걸리나 잰다(5초마다)
let backT = -99, backDays = 0;
function daysBack(st) {
  if (S.t - backT < 5) return backDays;
  backT = S.t;
  const w = worldOf(S.region), L = Math.min(...w.ports.map((p) => pathLen(p.x, p.y)));
  backDays = L / Math.max(2, st.maxSpeed * 0.45) / CAL.day;
  return backDays;
}
function think() {
  const w = worldOf(S.region), b = S.boat, st = G.stats(S), persons = 1 + S.crew.length;
  if (st.sailArea) {
    // 돌풍·폭풍은 예고부터 줄인다(S5)
    const wx = S.weather, want = wx.gustOn || wx.gustSoon || wx.stormOn || wx.stormSoon ? 1 : 2;
    if (b.sailLevel !== want && !S.cap.to && !S.mend) G.setSail(S, want);
    // 돛이 찢어지면 화물칸 마포로 꿰맨다(갑판원이 없으면 선장이 돛대로)
    if (b.torn && !S.mend && G.canMendAtSea(S) && G.mendSail(S).ok) log.mendSea = (log.mendSea || 0) + 1;
    if (S.mend && S.mend.by === 'cap') return; // 꿰매는 동안은 키를 놓는다
  }
  // 수리비가 없으면 항구로 가도 소용없으니 벌러 나간다. 다음 배 재료가 모이면 바로 돌아간다
  const wantBuild = HULLS[S.ship.hull].kind === 'raft' && G.canAffordHull(S, G.nextHull(S));
  // 오늘 밤에 상할 식량(젖은 것 포함)은 저녁부터 없는 셈 친다(S5)
  const day = G.clock(S).day, late = S.clock % CAL.day > CAL.day * 0.45, rotting = late ? (S.pantry || []).reduce((t, q) => t + (q.exp != null && q.exp <= day + 1 ? q.n : 0), 0) : 0;
  const drink = G.drinkPerDay(S), thirsty = salt() && S.water < drink * 1.5 && S.water < drink * (0.3 + 1.4 * daysBack(st));
  const low = wantBuild || S.food - rotting < persons * 0.7 || thirsty || (S.hull < 0.4 && S.res.coin >= G.repairCost(S)) || S.vigor < 0.3 || G.holdUsed(S) >= st.holdCap;
  // 너울이 내항성을 넘는 데 있으면 잔잔한 항구로 피한다(M2a)
  const hit = !reckless && salt() && G.swellHere(S) > st.sea;
  if (low || hit) {
    if (!(S.route && S.route.target && S.route.target.type === 'port')) { const p = nearestPort(hit); G.setDest(S, p.x, p.y, { type: 'port', id: p.id }); }
    return;
  }
  if (S.route) return;
  // 작은 호수와 큰 호수를 다 돌고 나룻배를 지은 뒤에 강으로 가고, 강에서는 슬루프 ★2와 돛대를 갖춰야 끝으로 간다
  const gate = w.gates[0], status = G.gateStatus(S, gate), kind = HULLS[S.ship.hull].kind, left = G.findsOf(S).some((f) => !S.found[f.id] && (!f.inland || st.telescope));
  const goOn = S.region === 'pond' ? kind !== 'raft' : S.region === 'lake' ? kind !== 'raft' && S.blueprints.mast_m && !left : S.region === 'river' ? !goal() && st.sailArea : false; // 앞바다에선 강으로 돌아가지 않아요
  if (status.ok && goOn) {
    if (Math.hypot(gate.x - b.x, gate.y - b.y) < 30) { G.passGate(S, gate); return; }
    G.setDest(S, gate.x, gate.y, { type: 'gate', id: gate.id }); return;
  }
  // 앞바다: 너울이 버거운 날엔 잔잔한 곳(만 안쪽·뭍 가까이)만 간다. 바다 위 목적지는 가는 길 가운데도 본다
  const calm = (x, y) => !salt() || (!rough(x, y) && !rough((x + b.x) / 2, (y + b.y) / 2));
  const reach = (f) => { const [x, y] = w.nearestWater(f.x, f.y); return calm(x, y); };
  const finds = G.findsOf(S).filter((f) => !S.found[f.id] && (!f.inland || st.telescope));
  const find = finds.filter(reach).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
  if (find) { G.setDest(S, find.x, find.y); return; }
  const fl = G.flotsamOf(S).filter((f) => calm(f.x, f.y)).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
  if (fl) { G.setDest(S, fl.x, fl.y, { type: 'pick' }); return; }
  // 갈 데가 다 거친 바다면 잔잔한 항구에 들어가 하루 묵는다
  if (salt() && finds.length) { const p = nearestPort(true); G.setDest(S, p.x, p.y, { type: 'port', id: p.id }); waitRough = true; }
}
let waitRough = false;

const ticks = maxMin * 60 * 30;
let thinkT = 0, waitedDay = -1;
const coastDone = () => S.region === 'coast' && G.findsOf(S, 'coast').every((f) => S.found[f.id]);
for (let i = 0; i < ticks && !S.ended && !coastDone(); i++) {
  if (S.disaster) {
    // 원인 꼬리표: 가뭄·홍수(강), 갈증·굶주림(쓰러짐), 너울·기울기(침몰)
    const c = S.disaster.cause, tag = S.weather.drought ? '+가뭄' : S.weather.flood ? '+홍수' : c === 'faint' ? (S.water <= 0 && salt() ? '+갈증' : S.food <= 0 ? '+굶주림' : '+더위') : (S.swellHurtNow || 0) > 0.05 ? '+너울' : '';
    const why = `${c}@${S.region}${tag}`, r = G.rescue(S); log.rescues = (log.rescues || 0) + 1; (log.why ||= {})[why] = (log.why[why] || 0) + 1; if (verbose) console.log('구조', why, JSON.stringify(r));
  }
  if (S.docked) {
    shop();
    // 오늘 폭풍이 아직 안 왔으면 하루 묵어 간다(조심스러운 사람처럼)
    const o = G.outlook(S)[0], inDay = S.clock % CAL.day;
    if (o.ids.includes('storm') && inDay < o.storm + WX.storm.len && waitedDay !== G.clock(S).day) { waitedDay = G.clock(S).day; G.waitDay(S); log.waits = (log.waits || 0) + 1; shop(); }
    // 앞바다: 갈 데가 모두 너울 너머면 하루 묵는다(하루에 한 번)
    else if (waitRough && waitedDay !== G.clock(S).day) { waitedDay = G.clock(S).day; waitRough = false; G.waitDay(S); log.swellWaits = (log.swellWaits || 0) + 1; shop(); }
    waitRough = false;
    const gate = worldOf(S.region).gates[0];
    const r = G.undock(S);
    if (!r.ok && verbose) console.log('출항 못 함', r.why);
  }
  G.step(S, G.FIXED_DT);
  for (const e of S.events) {
    if (e.type === 'region' && e.first) mark(e.to === 'lake' ? '큰 호수 도착' : e.to === 'river' ? '강 도착' : '앞바다 도착');
    if (e.type === 'cargoLost') log.cargoLost = (log.cargoLost || 0) + 1;
    if (e.type === 'pickWater') log.waterFlot = (log.waterFlot || 0) + 1;
    if (e.type === 'docked' || e.type === 'region') { for (const [k, v] of Object.entries(e.got || {})) income[k] = (income[k] || 0) + v; }
  }
  S.events.length = 0;
  if ((thinkT -= G.FIXED_DT) <= 0) { thinkT = 0.5; think(); }
}
mark(S.ended ? '큰 바다' : coastDone() ? '앞바다 발견 끝' : `시간 초과(${S.region})`);
if (log['앞바다 도착'] != null) log.coastMin = +((log['앞바다 발견 끝'] ?? +(S.t / 60).toFixed(1)) - log['앞바다 도착']).toFixed(1);
console.log(JSON.stringify({ seed, ...log, state: S.ended ? undefined : { hullHp: +S.hull.toFixed(2), food: +S.food.toFixed(1), vigor: +S.vigor.toFixed(2), mods: S.ship.mods.map((m) => m.id).join(','), crew: S.crew.length, owed: +S.owed.toFixed(1), route: S.route?.target?.type ?? null, docked: S.docked, at: [Math.round(S.boat.x), Math.round(S.boat.y)], spd: +S.boat.spd.toFixed(1), sail: S.boat.sailLevel, canMove: G.stats(S).canMove, rowing: S.boat.row }, hull: S.ship.hull, res: S.res, income, water: +(S.water || 0).toFixed(1), swellHurt: +(S.stats.swellHurt || 0).toFixed(2), coastFound: G.findsOf(S, 'coast').filter((f) => S.found[f.id]).length, found: Object.keys(S.found).length, ach: Object.keys(S.ach).length, day: G.clock(S).day, rescues: S.stats.rescues, gusts: S.stats.gusts, gustHurt: S.stats.gustHurt, storms: S.stats.storms, stormHurt: S.stats.stormHurt, torn: S.stats.torn, wet: S.stats.wet }));
