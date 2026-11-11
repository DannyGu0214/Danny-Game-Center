// 밸런스 봇: 생태계 하나를 욕심껏 키우는 플레이어를 흉내 내 티어별 도달 시간을 잰다 [AW tools/sim.js 방식을 옮김].
// 사용:
//   node tools/sim.js [분=240] [시드=7] [포착률=0.6] [요청=1] [탭지연=1.5]   한 번 돌리고 티어 도달 시각·끝 상태를 찍는다
//   node tools/sim.js --table [시드 수=5] [탭지연=1.5]                      활동·가끔·방치 플레이를 여러 시드로 돌려 표를 찍는다
//   포착률: 순간 포착 기회 중 탭하는 비율(0이면 방치형) · 요청: 1이면 다 된 요청을 받는다 · 탭지연: 기회가 뜬 뒤 탭까지 걸리는 초
//   지형: 기본은 test/fixtures/atoll-grid.js(임시 격자). --terrain=<경로>로 다른 지형 모듈(예: eco/atoll/terrain.js)을 쓴다.
import { createSim } from '../sim/rules.js';
import { makeEco } from '../eco/atoll/data.js';

const DT = 0.2;

export function run(G, { minutes = 240, seed = 7, captureRate = 0.6, requests = 1, tapDelay = 1.5, log = false, untilMax = true } = {}) {
  const S = G.newGame(seed, 0), ITEMS = G.eco.items, SPECIES = G.eco.species;
  const tierAt = { 1: 0 };
  let botRng = seed * 7919 + 13;
  const coin = () => ((botRng = (botRng * 1103515245 + 12345) % 2147483648) / 2147483648);
  let tapAt = null, lastChance = null, nextBuy = 1;
  const income = { view: 0, capture: 0, request: 0 };
  while (S.time < minutes * 60) {
    const p0 = S.pop;
    G.advance(S, DT);
    income.view += S.pop - p0;
    // 순간 포착: 기회마다 한 번 탭할지 정하고, tapDelay초 뒤에 탭한다
    if (S.chance && S.chance !== lastChance) { lastChance = S.chance; tapAt = coin() < captureRate ? S.time + tapDelay : null; }
    if (S.chance && tapAt != null && S.time >= tapAt) { const r = G.capture(S, S.chance.uid); if (r.ok) income.capture += r.reward; tapAt = null; }
    if (requests) for (const q of [...G.requestsOf(S)]) if (G.requestDone(S, q)) { const r = G.claim(S, q.uid); if (r.ok) income.request += r.reward; }
    // 확장 영역: 열리면 바로 가 보고, 달성한 항목은 받는다(마스터 보상 포함)
    if (requests && G.extOpen(S)) {
      G.visitExt(S);
      for (const k of S.ext.done.filter((k) => !S.ext.got.includes(k))) { const r = G.claimExt(S, k); if (r.ok) income.request += r.reward + r.master; }
    }
    // 1초마다 살 것을 정한다(한 번에 4개까지)
    if (S.time >= nextBuy) {
      nextBuy += 1;
      for (let k = 0; k < 4; k++) { const want = choose(G, S); if (!want || S.pop < want.price) break; buy(G, S, want); }
    }
    if (!tierAt[S.tier]) { tierAt[S.tier] = S.time / 60; if (log) console.log(`T${S.tier} ${(S.time / 60).toFixed(1)}분`); }
    if (untilMax && S.tier >= G.MAX_TIER) break;
  }
  void ITEMS; void SPECIES;
  return { tierAt, S, income };
}

function choose(G, S) {
  const ITEMS = G.eco.items, SPECIES = G.eco.species, st = G.stats(S), tier = S.tier;
  const items = G.itemIds.filter((id) => ITEMS[id].tier <= tier && G.freeSpot(S, id));
  const best = (list, k) => list.sort((a, b) => ITEMS[b].give[k] / G.priceOfItem(b) - ITEMS[a].give[k] / G.priceOfItem(a))[0];
  // 1) 모자란 필요를 채운다: 묶음(뭍·물속)마다, 그 묶음 물건 중 공급량 ÷ 가격이 좋은 것
  for (const k of G.supplyKeys) {
    const r = st.ratio[k], d = st.demand;
    const landShort = r.land < 1 && d.land[k] + d.both[k] > 0;
    const waterShort = r.water < 1 && (d.water[k] > 0 || (d.both[k] > 0 && r.land < 1));
    for (const [short, pool] of [[landShort, 'land'], [waterShort, 'water']]) {
      if (!short) continue;
      const c = best(items.filter((id) => ITEMS[id].give[k] && G.poolOfItem(id) === pool), k);
      if (c) return { kind: 'item', id: c, price: G.priceOfItem(c) };
    }
  }
  const canHave = (s) => G.canAdopt(S, s, null, true).ok;
  const open = G.speciesIds.filter((s) => SPECIES[s].tier <= tier);
  // 2) 새 종(낮은 티어부터)
  if (st.species < st.caps.species && st.animals < st.caps.animals) {
    const s = open.find((x) => !st.counts[x] && canHave(x));
    if (s) return { kind: 'animal', sp: s, price: G.priceOfAnimal(s) };
  }
  // 3) 종마다 4마리까지(높은 티어부터)
  if (st.animals < st.caps.animals) {
    const s = [...open].reverse().find((x) => st.counts[x] && st.counts[x] < G.eco.econ.speciesFull && canHave(x));
    if (s) return { kind: 'animal', sp: s, price: G.priceOfAnimal(s) };
  }
  // 3-1) 종마다 4마리가 다 차고도 자리가 남으면(확장 영역) 한도까지: 적은 종부터, 같으면 높은 티어부터
  if (st.animals < st.caps.animals) {
    const s = open.filter((x) => st.counts[x] && canHave(x)).sort((a, b) => st.counts[a] - st.counts[b] || SPECIES[b].tier - SPECIES[a].tier)[0];
    if (s) return { kind: 'animal', sp: s, price: G.priceOfAnimal(s) };
  }
  // 4) 꾸밈: 늘어나는 점수 ÷ 가격이 좋은 것
  const gainOf = (id) => G.itemPoints(ITEMS[id].tier) * ((st.items[id] || 0) < G.eco.econ.itemFull ? 1 : 0.5);
  const c = items.sort((a, b) => gainOf(b) / G.priceOfItem(b) - gainOf(a) / G.priceOfItem(a))[0];
  return c ? { kind: 'item', id: c, price: G.priceOfItem(c) } : null;
}
function buy(G, S, w) {
  if (w.kind === 'animal') return G.adopt(S, w.sp);
  const at = G.freeSpot(S, w.id);
  return at && G.placeItem(S, w.id, at.x, at.y, at.layer);
}

export async function loadSim(argv = process.argv.slice(2)) {
  const t = argv.find((a) => a.startsWith('--terrain='));
  const path = t ? new URL(t.slice(10), `file://${process.cwd()}/`).href : new URL('../test/fixtures/atoll-grid.js', import.meta.url).href;
  return createSim(makeEco(await import(path)));
}

const fmt = (v) => (v == null ? '-' : v < 1 ? '0' : Math.round(v).toString());
function range(list) { const v = list.filter((x) => x != null); if (!v.length) return '-'; const a = Math.min(...v), b = Math.max(...v); return fmt(a) === fmt(b) ? fmt(a) : `${fmt(a)}~${fmt(b)}`; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), G = await loadSim(argv), nums = argv.filter((a) => !a.startsWith('--')).map(Number);
  if (argv.includes('--table')) {
    const [seeds = 5, tapDelay = 1.5] = nums;
    const plays = [['활동(포착 60%·요청 받음)', 0.6, 1], ['가끔(포착 20%·요청 받음)', 0.2, 1], ['방치(포착·요청 없음)', 0, 0]];
    console.log(`| 플레이 | 시드 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |\n|---|---|---|---|---|---|---|---|---|`);
    for (const [name, cap, req] of plays) {
      const n = cap === 0 ? 1 : seeds, rows = [];
      for (let s = 1; s <= n; s++) rows.push(run(G, { minutes: 400, seed: s, captureRate: cap, requests: req, tapDelay }).tierAt);
      const cells = [2, 3, 4, 5, 6, 7, 8].map((t) => range(rows.map((r) => r[t])));
      console.log(`| ${name} | ${n === 1 ? '1' : `1~${n}`} | ${cells.join(' | ')} |`);
    }
  } else {
    const [MIN = 240, SEED = 7, CAP = 0.6, REQ = 1, TAP = 1.5] = nums;
    const t0 = Date.now();
    const { S, income } = run(G, { minutes: MIN, seed: SEED, captureRate: CAP, requests: REQ, tapDelay: TAP, log: true, untilMax: false });
    const st = G.stats(S);
    console.log(`끝: ${(S.time / 60).toFixed(0)}분, T${S.tier}, 발전도 ${st.dev}, 행복도 ${(st.H * 100).toFixed(0)}%, 생물 ${st.animals}마리 ${st.species}종, 물건 ${S.items.length}개, 남은 인기 ${Math.floor(S.pop)}`);
    const tot = income.view + income.capture + income.request;
    console.log(`수입: 관람 ${Math.round(income.view)} (${Math.round((income.view / tot) * 100)}%) · 포착 ${Math.round(income.capture)} (${Math.round((income.capture / tot) * 100)}%) · 요청 ${Math.round(income.request)} (${Math.round((income.request / tot) * 100)}%)`);
    const z = {}; for (const it of S.items) { const k = G.eco.items[it.id].zone; z[k] = (z[k] || 0) + 1; }
    console.log(`구역별 물건: ${Object.entries(z).map(([k, n]) => `${k} ${n}`).join(' · ')} · 확장 영역 꾸미기 ${S.ext.done.length}/${G.EXT_GOALS.length}${G.extMaster(S) ? ' · 마스터' : ''}`);
    console.log(`행복도(종별): ${Object.entries(st.happy).map(([s, h]) => `${G.eco.species[s].name} ${(h * 100).toFixed(0)}%`).join(' · ')}`);
    console.log(`(실행 ${((Date.now() - t0) / 1000).toFixed(1)}초)`);
  }
}
