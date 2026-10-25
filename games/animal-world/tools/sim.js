// 밸런스 봇: 한 지역을 욕심껏 키우는 플레이어를 흉내 내 티어별 도달 시간을 잰다.
// 사용: node tools/sim.js [분=240] [시드=7] [포착률=0.6] [요청=1] [지역=grassland]
//   포착률: 순간 포착 기회 중 탭하는 비율(0이면 방치형). 요청: 1이면 다 된 요청을 받는다.
//   다른 지역은 앞 지역을 해금 티어로만 맞춰 두고(동물 없음) 그 지역 하나의 수입으로 처음부터 잰다.
import * as G from '../logic.js';
import { ECON, SPECIES, ITEMS, SIZE, MAX_TIER, REGIONS, animalValue, itemPoints, speciesOf, itemsOf } from '../data.js';

const args = process.argv.slice(2);
const [MIN = 240, SEED = 7, CAP = 0.6, REQ = 1] = args.slice(0, 4).map(Number);
const REGION = args[4] || 'grassland', DT = 0.25;
let R = REGION;

export function run({ minutes = MIN, seed = SEED, captureRate = CAP, requests = REQ, log = false, region = REGION } = {}) {
  R = region;
  const S = G.newGame(seed, 0);
  for (const d of REGIONS) if (d.unlock && (d.id === region || REGIONS.findIndex((x) => x.id === d.id) < REGIONS.findIndex((x) => x.id === region))) S.regions[d.unlock.region].tier = Math.max(S.regions[d.unlock.region].tier, d.unlock.tier);
  S.rev = (S.rev || 0) + 1;
  if (region !== 'grassland') { const v = G.setView(S, region); if (!v.ok) throw new Error(v.why); S.requests = []; }
  const tierAt = { 1: 0 };
  let botRng = seed * 7919 + 13;
  const coin = () => ((botRng = (botRng * 1103515245 + 12345) % 2147483648) / 2147483648);
  let tapAt = null, lastChance = null;
  const income = { view: 0, capture: 0, request: 0 };
  for (let t = 0; t < minutes * 60; t += DT) {
    const p0 = G.popOf(S, R);
    G.step(S, DT);
    income.view += G.popOf(S, R) - p0;
    // 순간 포착: 기회마다 한 번 탭할지 정하고, 1.5초 뒤에 탭한다
    if (S.chance && S.chance !== lastChance) { lastChance = S.chance; tapAt = coin() < captureRate ? S.time + 1.5 : null; }
    if (S.chance && tapAt != null && S.time >= tapAt) { const r = G.capture(S, S.chance.uid); if (r.ok) income.capture += r.reward; tapAt = null; }
    if (requests) for (const q of [...S.requests]) if (G.requestDone(S, q)) { const r = G.claim(S, q.uid); if (r.ok) income.request += r.reward; }
    // 1초마다 살 것을 정한다
    if (Math.abs(t % 1) < 1e-9) {
      for (let k = 0; k < 4; k++) { const want = choose(S); if (!want || G.popOf(S, R) < want.price) break; buy(S, want); }
    }
    const tier = S.regions[R].tier;
    if (!tierAt[tier]) { tierAt[tier] = S.time / 60; if (log) console.log(`T${tier} ${(S.time / 60).toFixed(1)}분`); }
    if (tier >= MAX_TIER && !log) break;
  }
  return { tierAt, S, income };
}

function choose(S) {
  const st = G.stats(S, R), tier = S.regions[R].tier;
  const items = itemsOf(R).filter((id) => ITEMS[id].tier <= tier && G.freeSpot(S, R, id));
  // 0) 해금된 물에 사는 동물이 있는데 헤엄칠 물이 없으면 가장 싼 물부터
  if (speciesOf(R).some((sp) => SPECIES[sp].swim && SPECIES[sp].tier <= tier) && !G.swimTiles(S, R).length) {
    const w = items.filter((id) => ITEMS[id].swim).sort((a, b) => G.priceOfItem(a) - G.priceOfItem(b))[0];
    if (w) return { kind: 'item', id: w, price: G.priceOfItem(w) };
  }
  // 1) 모자란 필요를 채운다(공급량 ÷ 가격이 좋은 것)
  for (const k of ['food', 'water', 'shelter']) {
    if (st.ratio[k] >= 1) continue;
    const c = items.filter((id) => ITEMS[id].give[k]).sort((a, b) => ITEMS[b].give[k] / G.priceOfItem(b) - ITEMS[a].give[k] / G.priceOfItem(a))[0];
    if (c) return { kind: 'item', id: c, price: G.priceOfItem(c) };
  }
  const open = speciesOf(R).filter((sp) => SPECIES[sp].tier <= tier);
  // 2) 새 종
  if (st.species < st.caps.species && st.animals < st.caps.animals) {
    const sp = open.filter((s) => !st.counts[s] && (!SPECIES[s].swim || G.swimTiles(S, R).length)).sort((a, b) => SPECIES[a].tier - SPECIES[b].tier)[0];
    if (sp) return { kind: 'animal', sp, price: G.priceOfAnimal(sp) };
  }
  // 3) 종마다 4마리까지(높은 티어부터)
  if (st.animals < st.caps.animals) {
    const sp = open.filter((s) => st.counts[s] && st.counts[s] < ECON.speciesFull).sort((a, b) => SPECIES[b].tier - SPECIES[a].tier)[0];
    if (sp) return { kind: 'animal', sp, price: G.priceOfAnimal(sp) };
  }
  // 4) 꾸밈: 늘어나는 점수 ÷ 가격이 좋은 것
  const gainOf = (id) => itemPoints(ITEMS[id].tier) * ((st.items[id] || 0) < ECON.itemFull ? 1 : 0.5);
  const c = items.sort((a, b) => gainOf(b) / G.priceOfItem(b) - gainOf(a) / G.priceOfItem(a))[0];
  return c ? { kind: 'item', id: c, price: G.priceOfItem(c) } : null;
}
function buy(S, w) {
  if (w.kind === 'animal') return G.adopt(S, R, w.sp);
  const at = G.freeSpot(S, R, w.id);
  return at && G.placeItem(S, R, w.id, at[0], at[1]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { tierAt, S, income } = run({ log: true, region: REGION });
  const st = G.stats(S, R);
  console.log(`끝: ${(S.time / 60).toFixed(0)}분, T${S.regions[R].tier}, 발전도 ${st.dev}, 행복도 ${(st.H * 100).toFixed(0)}%, 동물 ${st.animals}마리 ${st.species}종, 물건 ${S.regions[R].items.length}개, 남은 인기 ${Math.floor(G.popOf(S, R))}`);
  const tot = income.view + income.capture + income.request;
  console.log(`수입: 관람 ${Math.round(income.view)} (${Math.round((income.view / tot) * 100)}%) · 포착 ${Math.round(income.capture)} · 요청 ${Math.round(income.request)}`);
  void tierAt; void SIZE; void animalValue;
}
