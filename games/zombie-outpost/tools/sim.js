// 균형 점검용 봇: 자동사냥을 켜 두고, 사람처럼 직접 걸어가 파밍하며, 살 수 있는 것을 욕심껏 산다. node tools/sim.js [분] [시드]
import * as G from '../logic.js';

export function greedyBuy(s) {
  const log = [];
  const tryDo = (r) => { if (r.ok) log.push(r.msg); return r.ok; };
  for (let guard = 0; guard < 20; guard++) {
    let bought = false;
    // 1) 가까운 후보지에 전진기지
    for (let i = 0; i < s.sites.length; i++) if (G.nearSite(s, i)) bought ||= tryDo(G.buildOutpost(s, i));
    // 2) 무기: 가장 좋은 걸 제작
    for (const id of ['carbine', 'rifle', 'axe', 'shotgun', 'machete', 'bat', 'pistol', 'pipe']) if (!s.weapons[id]) bought ||= tryDo(G.craftWeapon(s, id));
    // 가진 무기 중 초당 피해가 가장 큰 것을 장착
    for (const kind of ['melee', 'gun']) {
      const own = Object.keys(s.weapons).filter((id) => G.WEAPONS[id].kind === kind && !G.isBroken(s, id));
      const best = own.sort((a, b) => G.weaponDamage(s, b) / G.WEAPONS[b].cd - G.weaponDamage(s, a) / G.WEAPONS[a].cd)[0];
      if (best && s.equip[kind] !== best) G.equipWeapon(s, best);
    }
    for (const m of G.MISSIONS) if (!s.claimed[m.id] && G.missionDone(s, m)) tryDo(G.claimMission(s, m.id));
    if (s.raid && s.wall < G.wallMax(s) * 0.4 && s.items.toolbox) tryDo(G.useItem(s, 'toolbox'));
    // 3) 동료: 방어 슬롯을 먼저 채우고, 남은 근무자 중 강한 순으로 탐험에 데려간다
    for (const v of s.survivors) if (v.post === 'work' && G.defenders(s).length < G.defenseSlots(s)) tryDo(G.setPost(s, v.id, 'defense'));
    for (const v of s.survivors.filter((u) => u.post === 'work').sort((a, b) => G.survivorPower(b) - G.survivorPower(a))) if (G.escorts(s).length < G.exploreSlots(s)) tryDo(G.setPost(s, v.id, 'explore'));
    // 4) 본부 > 건물 > 무기 강화 > 동료 레벨
    bought ||= tryDo(G.upgradeHq(s));
    const order = ['barricade', 'workbench', 'repair', 'watchtower', 'dorm', 'pack', 'scrapyard', 'sawmill', 'recycler', 'ammo', 'clinic'];
    // 본부에 들렀을 때 절반 넘게 닳은 근접 무기는 고친다
    for (const id of Object.keys(s.weapons)) if (G.WEAPONS[id].dur && s.dur[id] < G.maxDurability(s, id) * 0.5) tryDo(G.repairWeapon(s, id));
    for (const id of order) bought ||= tryDo(G.buyBuilding(s, id));
    // 강화는 본부 확장 비용의 2배 넘게 남을 때만(사람처럼 확장 자금을 모은다)
    const hq = G.hqCost(s.hq + 1), spare = s.hq >= G.HQ_MAX || G.RES_KEYS.every((k) => !hq[k] || s.res[k] > hq[k] * 2);
    if (spare) for (const id of [s.equip.gun, s.equip.melee]) if (id) bought ||= tryDo(G.upgradeWeapon(s, id));
    if (spare) for (const v of G.defenders(s)) bought ||= tryDo(G.levelSurvivor(s, v.id));
    for (const o of s.outposts) bought ||= tryDo(G.upgradeOutpost(s, o.site));
    if (!bought) break;
  }
  return log;
}

// 파밍은 수동이라 봇이 사람 대신 목적지를 정한다('이동' 버튼과 같은 길찾기로 걸어간다).
// 가방이 차면 가까운 기지로, 구조 신호가 있으면 구하러, 아니면 활동 반경 안에서 가장 가까운 대상물로.
function manualFarm(s) {
  const P = s.player;
  if (s.waypoint || s.gather || s.autoRetreat || s.raid || G.needsRepairTrip(s)) return;
  const here = G.safeZoneAt(s, P.x, P.y), maxD = s.autoZone + 1;
  if (G.bagTotal(s) >= G.bagCap(s) * 0.95) {
    if (here) return;
    const z = G.safeZones(s).sort((a, b) => G.dist(P.x, P.y, a.x, a.y) - G.dist(P.x, P.y, b.x, b.y))[0];
    G.travelTo(s, z.x, z.y);
    return;
  }
  const R = s.rescue;
  if (R && R.d < maxD + 0.6 && !G.dormFull(s) && (R.kind === 'stranded' || G.canBreakSiege(s))) { G.travelTo(s, R.x, R.y); return; }
  const need = G.RES_KEYS.reduce((a, k) => (s.res[k] + s.bag[k] < s.res[a] + s.bag[a] ? k : a), G.RES_KEYS[0]);
  // 가장 모자란 자원은 한 구역 더 바깥까지 찾아간다(사람도 플라스틱이 없으면 상가로 간다)
  let best = null, bd = Infinity;
  for (const n of s.nodes) {
    if (n.readyAt > s.time || n.d >= maxD + (n.res === need ? 1 : 0)) continue;
    const d = G.dist(P.x, P.y, n.x, n.y) * (n.res === need ? 0.7 : 1);
    if (d < bd) { bd = d; best = n; }
  }
  if (best) { G.travelTo(s, best.x, best.y); return; }
  const a = G.rand(s) * Math.PI * 2, r = (s.autoZone + 0.5) * G.ZONE_SIZE;
  G.travelTo(s, G.CENTER.x + Math.cos(a) * r, G.CENTER.y + Math.sin(a) * r);
}

export function run(minutes, seed, verbose = false) {
  const s = G.newGame(seed);
  const dt = 1 / 30;
  let t = 0, nextBuy = 0, nextZone = 0, nextMove = 0;
  const steps = Math.round(minutes * 60 / dt);
  const marks = [];
  for (let i = 0; i < steps; i++) {
    G.step(s, dt, null);
    t += dt;
    if (t >= nextBuy) { nextBuy = t + 5; const l = greedyBuy(s); if (verbose) for (const m of l) marks.push(`${(t / 60).toFixed(1)}m ${m}`); }
    if (t >= nextMove) { nextMove = t + 0.5; manualFarm(s); }
    // 본부 레벨에 맞춰 활동 반경을 넓힌다
    if (t >= nextZone) {
      nextZone = t + 30;
      s.autoZone = Math.min(G.ZONE_NAMES.length - 1, Math.floor((s.hq - 1) / 2) + 1);
      // 한도가 남으면 가장 가까운 빈 후보지로 걸어간다(사람이 '이동' 버튼을 누르는 것과 같다)
      if (!s.waypoint && s.outposts.length < G.outpostLimit(s)) {
        const free = s.sites.map((o, i) => ({ o, i })).filter(({ i }) => !s.outposts.some((x) => x.site === i));
        const c = G.outpostCost(s, free[0].i);
        if (free.length && G.canAfford(s.res, c)) G.travelTo(s, free[0].o.x, free[0].o.y);
      }
    }
  }
  return { s, marks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const minutes = Number(process.argv[2] || 30), seed = Number(process.argv[3] || 7);
  const { s, marks } = run(minutes, seed, true);
  console.log(marks.slice(-40).join('\n'));
  console.log(JSON.stringify({ items: s.items, claimed: s.claimed, hq: s.hq, bld: s.bld, weapons: s.weapons, equip: s.equip, res: Object.fromEntries(Object.entries(s.res).map(([k, v]) => [k, Math.round(v)])), survivors: s.survivors.length, defense: G.defenders(s).length, wall: Math.round(s.wall) + '/' + G.wallMax(s), outposts: s.outposts, stats: s.stats, autoZone: s.autoZone }, null, 1));
}
