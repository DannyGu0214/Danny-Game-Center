// 리스폰 설정 비교: 탐험 봇(본부 레벨에 따라 구역을 넓힘)과 근처만 도는 봇(주택가 고정).
// node tools/respawn-exp.js — 표의 열: 본부 30/60분, 파밍량, 헛걸음 비율, 파밍 위험도, 사망 수 / 근처 봇 / 탐험÷근처 파밍량
import * as G from '../logic.js';
import { greedyBuy } from './sim.js';
const SIZE = { garbage: 's', cones: 's', fence: 's', furniture: 's', pallets: 'm', drums: 'm', crates: 'm', bluedrum: 'm', vending: 'm', mannequin: 'm', fallenTree: 'l', wreck: 'l', rebar: 'l' };
const posHash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
const CONFIGS = {
  '이전 일괄 75초': { s: 75, m: 75, l: 75, zone: [1, 1, 1, 1, 1] },
  '현재(logic.js)': { ...Object.fromEntries(Object.entries(G.RESPAWN_BY_SIZE).map(([k, v]) => [k[0], v])), zone: G.RESPAWN_ZONE_MULT },
};
function apply(s, c) {
  for (const n of s.nodes) n.respawn = Math.round(c[SIZE[n.type]] * c.zone[G.zoneIndex(n.d)] * (0.8 + 0.4 * posHash(n.x, n.y)));
}
function run(c, seed, minutes, camper) {
  const s = G.newGame(seed); apply(s, c);
  const dt = 1 / 30; let amount = 0, t = 0, nextBuy = 0, nextZone = 0, idle = 0, farmSteps = 0, dangerSum = 0, loots = 0, hq30 = 0;
  const steps = Math.round(minutes * 60 / dt);
  for (let i = 0; i < steps && !s.over; i++) {
    const ev = G.step(s, dt, null); t += dt;
    for (const e of ev) if (e.t === 'loot') { loots++; amount += e.amt; dangerSum += G.dangerAt(e.x, e.y); }
    const k = s.autoTarget?.kind;
    if (!G.safeZoneAt(s, s.player.x, s.player.y) || k) { farmSteps++; if (!k || k === 'wander') idle++; }
    if (t >= nextBuy) { nextBuy = t + 5; greedyBuy(s); }
    if (t >= nextZone) {
      nextZone = t + 30;
      s.autoZone = camper ? 1 : Math.min(4, Math.floor((s.hq - 1) / 2) + 1);
      if (!camper && !s.waypoint && s.outposts.length < G.outpostLimit(s)) {
        const free = s.sites.map((o, i) => ({ o, i })).filter(({ i }) => !s.outposts.some((x) => x.site === i));
        if (free.length && G.canAfford(s.res, G.outpostCost(s, free[0].i))) G.travelTo(s, free[0].o.x, free[0].o.y);
      }
    }
    if (Math.abs(t - 1800) < dt / 2) hq30 = s.hq;
  }
  return { hq30, hq60: s.hq, lv: s.level, loots, amount, idle: idle / Math.max(1, farmSteps), danger: dangerSum / Math.max(1, loots), dead: !!s.over, res: s.res };
}
const seeds = [7, 11, 23, 42, 99, 5];
const avg = (xs, f) => xs.reduce((a, x) => a + f(x), 0) / xs.length;
console.log('설정 | 탐험봇: 본부30/60분 · 파밍량 · 헛걸음% · 위험도 · 사망 || 근처봇: 본부60분 · 파밍량 · 헛걸음% || 탐험/근처 파밍량');
for (const [name, c] of Object.entries(CONFIGS)) {
  const ex = seeds.map((sd) => run(c, sd, 60, false)), cp = seeds.map((sd) => run(c, sd, 60, true));
  const ea = avg(ex, (r) => r.amount), ca = avg(cp, (r) => r.amount);
  console.log(name.padEnd(12) + ' | ' + avg(ex, (r) => r.hq30).toFixed(1) + '/' + avg(ex, (r) => r.hq60).toFixed(1) + ' · ' + ea.toFixed(0) + ' · ' + (avg(ex, (r) => r.idle) * 100).toFixed(0) + '% · ' + avg(ex, (r) => r.danger).toFixed(2) + ' · ' + ex.filter((r) => r.dead).length + ' || ' + avg(cp, (r) => r.hq60).toFixed(1) + ' · ' + ca.toFixed(0) + ' · ' + (avg(cp, (r) => r.idle) * 100).toFixed(0) + '% || ' + (ea / ca).toFixed(2));
}
