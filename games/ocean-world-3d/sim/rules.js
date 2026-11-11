// 규칙 전부의 입구(화면 없음, Node에서 그대로 돈다). 경제·한도·발전도·행복도(필요와 공급 묶음)·티어·들이기·방생·
// 물건 놓기·치우기·순간 포착·관람객 요청·관람 수익·쉬는 동안 정산·확장 영역·저장·사건 목록.
// createSim(eco)가 생태계 객체를 받아 규칙 함수 묶음을 돌려준다. 규칙은 생태계 이름을 모르고 eco의 목록 데이터만 읽는다.
// 원형: Animal World logic.js. 그대로 옮긴 것과 바꾼 것은 docs/p1-sim-report.md 4절.
import { rnd, range, pick, ok, no, cached, touch } from './util.js';
import { createSpace } from './space.js';
import { createMover, LIFE } from './move.js';
import { SAVE_VERSION, serialize as serializeState, parseSave } from './save.js';

export const STEP = 1 / 30; // 고정 시간 단계(초)
export const BASE_VERSION = 1; // 규칙 기반 버전
export { SAVE_VERSION, LIFE };

function checkEco(eco) {
  const need = ['id', 'terrain', 'kinds', 'needs', 'sizes', 'species', 'items', 'tiers', 'econ'];
  for (const k of need) if (!eco || eco[k] == null) throw new Error(`eco.${k}가 없어요`);
  const T = eco.terrain;
  for (const k of ['GRID', 'kindAt', 'cellHeight']) if (T[k] == null) throw new Error(`eco.terrain.${k}가 없어요`);
  for (const [id, s] of Object.entries(eco.species)) {
    if (!LIFE[s.life]) throw new Error(`${id}: 모르는 생활형 ${s.life}`);
    if (!eco.sizes[s.size]) throw new Error(`${id}: 모르는 크기 ${s.size}`);
    for (const k of s.needs) if (!eco.needs[k]) throw new Error(`${id}: 모르는 필요 ${k}`);
    if (s.partner && !eco.species[s.partner.sp]) throw new Error(`${id}: 짝 ${s.partner.sp}가 없어요`);
    if (LIFE[s.life].swim && T.SEA_LEVEL == null) throw new Error(`${id}: 물이 없는 생태계에 헤엄치는 생물`);
  }
  for (const [id, d] of Object.entries(eco.items)) {
    if (!['land', 'bed', 'water'].includes(d.zone)) throw new Error(`${id}: 모르는 구역 ${d.zone}`);
    if (d.zone !== 'land' && T.SEA_LEVEL == null) throw new Error(`${id}: 물이 없는 생태계의 물속 물건`);
    for (const k of Object.keys(d.give)) if (!eco.needs[k]?.supply) throw new Error(`${id}: 공급할 수 없는 필요 ${k}`);
  }
}

export function createSim(eco) {
  checkEco(eco);
  const sp = createSpace(eco), mv = createMover(eco, sp);
  const E = eco.econ, SPECIES = eco.species, ITEMS = eco.items, NEEDS = eco.needs, TIERS = eco.tiers;
  const MAX_TIER = eco.maxTier ?? TIERS.length;
  const speciesIds = Object.keys(SPECIES).sort((a, b) => SPECIES[a].tier - SPECIES[b].tier);
  const itemIds = Object.keys(ITEMS).sort((a, b) => ITEMS[a].tier - ITEMS[b].tier);
  const supplyKeys = Object.keys(NEEDS).filter((k) => NEEDS[k].supply);
  const X = sp.ext && eco.ext ? eco.ext : null; // 확장 영역 규칙(지형에 확장 영역이 있을 때만)
  const PHASES = eco.phases || ['아침', '낮', '저녁', '밤'];
  const DAY_SEC = E.daySec ?? 240, PHASE_SEC = DAY_SEC / PHASES.length;

  // ---------- 수치 ----------
  const round5 = (v) => Math.max(5, Math.round(v / 5) * 5);
  const animalValue = (t) => E.animalValueBase + E.animalValueStep * (t - 1);
  const itemPoints = (t) => E.itemPointsBase + E.itemPointsStep * t;
  const priceOfAnimal = (s) => round5(E.animalBase * E.growth ** (SPECIES[s].tier - 1));
  const priceOfItem = (id) => round5(E.itemBase * E.growth ** (ITEMS[id].tier - 1));
  // 화면에 그리는 몸 크기(칸) = 종의 len × 크기 등급의 draw 배율. 규칙 판정에는 쓰지 않는다(생물은 점 하나로 판정)
  const bodyLen = (s) => (SPECIES[s].len ?? 1) * (eco.sizes[SPECIES[s].size].draw ?? 1);
  const extOpen = (S) => !!X && sp.extOpen(S);
  const capsOf = (S) => ({ species: S.tier, animals: E.perTier * S.tier + (extOpen(S) ? X.animals : 0) });
  const poolOfItem = (id) => (ITEMS[id].zone === 'land' ? 'land' : 'water');
  function poolOfSpecies(s) {
    const L = LIFE[SPECIES[s].life];
    if (!sp.hasWater) return 'land';
    if (L.fixed) return sp.sessileDef(s).zone === 'land' ? 'land' : 'water';
    return L.pool;
  }

  // ---------- 새 게임 ----------
  function newGame(seed = 1, now = Date.now()) {
    const S = {
      v: SAVE_VERSION, base: BASE_VERSION, eco: eco.id, rng: seed | 0 || 1, time: 0, savedAt: now,
      tier: 1, pop: E.start, earned: 0, items: [], animals: [], requests: [], reqSwapAt: 0,
      album: {}, chance: null, chanceIn: 12, uid: 1, ext: newExt(), events: [], rev: 0, acc: 0,
    };
    fillRequests(S);
    return S;
  }
  const newExt = () => ({ done: [], got: [] });

  // ---------- 발전도·행복도 ----------
  // 공급은 뭍(육지 구역)·물속(해저·수중) 두 묶음(DESIGN 2.2). 육지형은 뭍, 물속 생물은 물속, 수면형은 뭍을 먼저 쓰고 모자라면 물속
  function stats(S) {
    return cached(S, 'st', () => {
      const counts = {}, items = {};
      for (const a of S.animals) counts[a.sp] = (counts[a.sp] || 0) + 1;
      for (const it of S.items) items[it.id] = (items[it.id] || 0) + 1;
      let animal = 0, decor = 0;
      for (const [s, n] of Object.entries(counts)) { const v = animalValue(SPECIES[s].tier); animal += v * Math.min(n, E.speciesFull) + v * 0.5 * Math.max(0, n - E.speciesFull); }
      for (const [id, n] of Object.entries(items)) { const p = itemPoints(ITEMS[id].tier); decor += p * Math.min(n, E.itemFull) + p * 0.5 * Math.max(0, n - E.itemFull); }
      const species = Object.keys(counts).length, diversity = species * E.diversity;
      const zero = () => Object.fromEntries(supplyKeys.map((k) => [k, 0]));
      const supply = { land: zero(), water: zero() }, demand = { land: zero(), water: zero(), both: zero() };
      for (const it of S.items) for (const [k, n] of Object.entries(ITEMS[it.id].give)) supply[poolOfItem(it.id)][k] += n;
      for (const a of S.animals) {
        const s = SPECIES[a.sp], pool = poolOfSpecies(a.sp);
        for (const k of s.needs) if (k in demand[pool]) demand[pool][k] += eco.sizes[s.size].use;
      }
      const ratio = {};
      for (const k of supplyKeys) {
        const Dl = demand.land[k], Ds = demand.both[k], Do = demand.water[k];
        const rL = Dl + Ds > 0 ? Math.min(1, supply.land[k] / (Dl + Ds)) : 1;
        const R = Ds * (1 - rL);
        const rW = Do + R > 0 ? Math.min(1, supply.water[k] / (Do + R)) : 1;
        ratio[k] = { land: rL, water: rW, both: rL + (1 - rL) * rW };
      }
      const needMet = {}, happy = {};
      for (const s of Object.keys(counts)) {
        const d = SPECIES[s], pool = poolOfSpecies(s);
        needMet[s] = {};
        for (const k of d.needs) {
          if (k === 'herd') needMet[s][k] = Math.min(1, counts[s] / E.herdSize);
          else if (k === 'partner') needMet[s][k] = d.partner ? Math.min(1, ((counts[d.partner.sp] || 0) * d.partner.per) / counts[s]) : 1;
          else needMet[s][k] = ratio[k][pool];
        }
        const vals = Object.values(needMet[s]);
        happy[s] = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 1;
      }
      let H = 1;
      if (S.animals.length) { H = 0; for (const [s, n] of Object.entries(counts)) H += happy[s] * n; H /= S.animals.length; }
      const mult = 0.5 + 0.5 * H;
      const dev = Math.round((animal + diversity + decor) * mult);
      return {
        dev, H, mult, animal, diversity, decor, supply, demand, ratio, needMet, happy, counts, items,
        species, animals: S.animals.length, caps: capsOf(S), next: S.tier < MAX_TIER ? TIERS[S.tier] : null,
      };
    });
  }

  // ---------- 인기점수 ----------
  const incomePerMin = (S) => stats(S).dev / E.incomeDiv;
  const gain = (S, n) => { S.pop += n; S.earned += n; };
  // 구성이 바뀐 뒤: 다시 계산하고 티어를 올린다(티어는 내려가지 않는다)
  function refresh(S) {
    touch(S);
    while (S.tier < MAX_TIER && stats(S).dev >= TIERS[S.tier]) {
      S.tier++;
      touch(S);
      S.events.push({ type: 'tier', tier: S.tier });
      if (X && S.tier === X.tier) S.events.push({ type: 'ext', open: true });
    }
  }

  // ---------- 들이기·방생 ----------
  const habitat = (S, s) => cached(S, 'hab:' + s, () => {
    const L = LIFE[SPECIES[s].life];
    if (L.fixed) return !!sp.freeSessileSpot(S, s);
    for (let i = 0; i < sp.N; i++) {
      if (L.swim ? sp.wet[i] && sp.swimK[i] && !sp.lockedCell(S, i) : sp.canWalk(S, i, L.ground)) return true;
    }
    return false;
  });
  // free = true면 값은 보지 않는다(봇·화면에서 '살 수 있는 종인가'만 볼 때)
  function canAdopt(S, s, at = null, free = false) {
    const d = SPECIES[s];
    if (!d) return no('없는 생물이에요');
    if (S.tier < d.tier) return no(`T${d.tier}에서 해금`);
    const st = stats(S);
    if (d.partner && !st.counts[d.partner.sp]) return no(`${SPECIES[d.partner.sp].name}(짝)이 먼저 있어야 해요`);
    if (!st.counts[s] && st.species >= st.caps.species) return no(`종 한도 ${st.caps.species}종`);
    if (st.animals >= st.caps.animals) return no(`개체 한도 ${st.caps.animals}마리`);
    if (LIFE[d.life].fixed && at) { const w = sp.sessileWhy(S, s, at.x, at.y); if (w) return no(w); }
    else if (!habitat(S, s)) return no(LIFE[d.life].fixed ? '붙어 살 자리가 없어요' : '지낼 곳이 없어요');
    if (!free && S.pop < priceOfAnimal(s)) return no('인기점수가 모자라요');
    return ok;
  }
  // 짝 생물(흰동가리 → 말미잘): 가장 덜 찬 짝에 붙인다
  function assignHost(S, a) {
    const p = SPECIES[a.sp].partner;
    const hosts = S.animals.filter((b) => b.sp === p.sp);
    if (!hosts.length) { a.host = null; return; }
    const load = (h) => S.animals.filter((b) => b !== a && b.host === h.uid).length;
    a.host = hosts.reduce((best, h) => (load(h) < load(best) ? h : best)).uid;
  }
  // at: 고착 생물의 자리 {x, y}(칸, 왼쪽 위). 없으면 권하는 빈자리
  function adopt(S, s, at = null) {
    const c = canAdopt(S, s, at);
    if (!c.ok) return c;
    const d = SPECIES[s], L = LIFE[d.life], price = priceOfAnimal(s);
    S.pop -= price;
    const a = {
      uid: S.uid++, sp: s, x: 0, y: 0, z: 0, face: range(S, -Math.PI, Math.PI), pitch: 0, st: 'idle', t: range(S, 0.5, 2),
      ph: range(S, 0, 10), path: null, goal: null, jx: range(S, -0.3, 0.3), jy: range(S, -0.3, 0.3), paid: price,
    };
    if (L.fixed) { const spot = at || sp.freeSessileSpot(S, s); a.fx = spot.x; a.fy = spot.y; }
    if (L.breathe) a.breath = range(S, d.breath[0], d.breath[1]);
    if (L.drift) { a.hd = 0; a.tz = 0; }
    S.animals.push(a);
    touch(S);
    if (d.partner) assignHost(S, a);
    mv.spawn(S, a);
    if (L.fixed) mv.fix(S);
    refresh(S);
    S.events.push({ type: 'adopt', uid: a.uid, sp: s });
    return { ok: true, animal: a };
  }
  function canRelease(S, uid) {
    const a = S.animals.find((b) => b.uid === uid);
    if (!a) return no('없는 생물이에요');
    const st = stats(S);
    const dep = speciesIds.find((x) => SPECIES[x].partner?.sp === a.sp && st.counts[x]);
    if (dep && st.counts[a.sp] === 1) return no(`${SPECIES[dep].name}의 짝이라 마지막 하나는 방생할 수 없어요`);
    return ok;
  }
  function release(S, uid) {
    const c = canRelease(S, uid);
    if (!c.ok) return c;
    const i = S.animals.findIndex((b) => b.uid === uid), [a] = S.animals.splice(i, 1);
    const refund = Math.floor(a.paid * E.refund);
    S.pop += refund;
    if (S.chance && S.chance.uid === uid) endChance(S);
    touch(S);
    for (const b of S.animals) if (b.host === uid) assignHost(S, b);
    refresh(S);
    S.events.push({ type: 'release', uid, sp: a.sp, refund });
    return { ok: true, refund };
  }

  // ---------- 물건 놓기·치우기 ----------
  // 물건 개수 상한(eco.limits[구역], null이면 없음). 지금 데이터는 모두 꺼 둠(대니님 결정 대기, docs/p2-report.md)
  const zoneCount = (S, z) => cached(S, 'zc', () => { const c = {}; for (const it of S.items) { const k = ITEMS[it.id].zone; c[k] = (c[k] || 0) + 1; } return c; })[z] || 0;
  const limitOf = (z) => eco.limits?.[z] ?? null;
  function limitWhy(S, id) {
    const z = ITEMS[id].zone, lim = limitOf(z);
    return lim != null && zoneCount(S, z) >= lim ? `${eco.zones?.[z]?.name ?? z} 물건은 ${lim}개까지예요` : null;
  }
  function canPlace(S, id, x, y, layer = null) {
    const d = ITEMS[id];
    if (!d) return no('없는 물건이에요');
    if (S.tier < d.tier) return no(`T${d.tier}에서 해금`);
    const lw = limitWhy(S, id);
    if (lw) return no(lw);
    const why = sp.placeWhy(S, id, x, y, d.zone === 'water' ? layer ?? sp.layersOf(d)[0] : null);
    if (why) return no(why);
    if (S.pop < priceOfItem(id)) return no('인기점수가 모자라요');
    return ok;
  }
  // layer: 수중 물건의 층('top'|'mid'|'low', 없으면 권하는 층) · rot: 화면용 돌림(0~3, 규칙은 쓰지 않음 — 물건이 모두 정사각형)
  function placeItem(S, id, x, y, layer = null, rot = 0) {
    const d = ITEMS[id];
    const L = d && d.zone === 'water' ? layer ?? sp.layersOf(d)[0] : null;
    const c = canPlace(S, id, x, y, L);
    if (!c.ok) return c;
    const price = priceOfItem(id);
    S.pop -= price;
    const it = { uid: S.uid++, id, x, y, layer: L, rot: rot & 3, paid: price };
    S.items.push(it);
    refresh(S);
    mv.fix(S);
    S.events.push({ type: 'place', uid: it.uid, id });
    return { ok: true, item: it };
  }
  function removeItem(S, uid) {
    const i = S.items.findIndex((it) => it.uid === uid);
    if (i < 0) return no('없는 물건이에요');
    const [it] = S.items.splice(i, 1), refund = Math.floor(it.paid * E.refund);
    S.pop += refund;
    refresh(S);
    mv.fix(S);
    S.events.push({ type: 'remove', uid, id: it.id, refund });
    return { ok: true, refund };
  }
  const freeSpot = (S, id, opt) => (limitWhy(S, id) ? null : sp.freeSpot(S, id, opt)); // 상한에 걸리면 자리가 없는 것으로

  // ---------- 순간 포착 [AW] ----------
  function endChance(S) { S.chance = null; S.chanceIn = range(S, E.chanceEvery[0], E.chanceEvery[1]); }
  function updateChance(S, dt) {
    if (S.chance) { S.chance.t -= dt; if (S.chance.t <= 0) endChance(S); return; }
    S.chanceIn -= dt;
    if (S.chanceIn > 0) return;
    const cand = S.animals.filter((a) => a.st !== 'special');
    if (!cand.length) { S.chanceIn = 5; return; }
    const a = pick(S, cand);
    a.st = 'special'; a.t = E.chanceLen; a.path = null; a.goal = null; a.pitch = 0;
    S.chance = { uid: a.uid, t: E.chanceLen };
    S.events.push({ type: 'chance', uid: a.uid, sp: a.sp });
  }
  function capture(S, uid) {
    if (!S.chance || S.chance.uid !== uid) return no('지금은 포착할 수 없어요');
    const a = S.animals.find((b) => b.uid === uid);
    if (!a) { endChance(S); return no('없는 생물이에요'); }
    const first = !S.album[a.sp], perMin = incomePerMin(S);
    const reward = first ? Math.max(E.firstMin, Math.round(perMin * E.firstMinutes)) : Math.max(E.captureMin, Math.round(perMin * E.captureMinutes));
    S.album[a.sp] = (S.album[a.sp] || 0) + 1;
    gain(S, reward);
    const phase = clock(S).phase;
    for (const q of S.requests) if (q.kind === 'photo' && q.sp === a.sp && (q.phase == null || q.phase === phase)) q.got++;
    endChance(S);
    S.events.push({ type: 'capture', uid, sp: a.sp, reward, first });
    return { ok: true, reward, first, sp: a.sp };
  }

  // ---------- 관람객 요청 [AW 15절 틀, '지형 꾸미기'는 '구역·지형 꾸미기'] ----------
  //   adopt 그 종 N마리 · species 종 N종 · set 필요별 물건 수 · terrain 그 지형(on) 칸이나 그 수중 층(layer)에 그 물건 · happy 행복도 N% · photo 특수 행동 사진
  const needCount = (st, k) => Object.entries(st.items).reduce((n, [id, c]) => n + (ITEMS[id].give[k] ? c : 0), 0);
  const countOn = (S, id, on) => S.items.filter((it) => it.id === id && sp.covers(ITEMS[id], it.x, it.y, on)).length;
  const countLayer = (S, id, L) => S.items.filter((it) => it.id === id && it.layer === L).length;
  function requestProgress(S, q) {
    const st = stats(S);
    if (q.kind === 'adopt') return [Math.min(q.n, st.counts[q.sp] || 0), q.n];
    if (q.kind === 'species') return [Math.min(q.n, st.species), q.n];
    if (q.kind === 'set') { const ks = Object.keys(q.need); return [ks.reduce((n, k) => n + Math.min(q.need[k], needCount(st, k)), 0), ks.reduce((n, k) => n + q.need[k], 0)]; }
    if (q.kind === 'terrain') return [Math.min(q.n, q.layer ? countLayer(S, q.item, q.layer) : countOn(S, q.item, q.on)), q.n];
    if (q.kind === 'happy') return [Math.min(q.pct, Math.round(st.H * 100 * (st.animals >= 2 ? 1 : 0))), q.pct];
    return [Math.min(q.n, q.got), q.n];
  }
  function requestDone(S, q) {
    if (q.kind === 'happy') { const st = stats(S); return st.animals >= 2 && Math.round(st.H * 100) >= q.pct; }
    const [a, b] = requestProgress(S, q);
    return a >= b;
  }
  function requestCandidates(S) {
    const st = stats(S), out = { adopt: [], species: [], set: [], terrain: [], happy: [], photo: [] };
    const room = st.caps.animals - st.animals;
    const canHave = (s) => SPECIES[s].tier <= S.tier && (!SPECIES[s].partner || st.counts[SPECIES[s].partner.sp]) && habitat(S, s);
    for (const s of speciesIds) {
      const have = st.counts[s] || 0;
      if (have) {
        out.photo.push({ kind: 'photo', sp: s, n: 1, got: 0, minutes: 1 });
        out.photo.push({ kind: 'photo', sp: s, n: 1, got: 0, phase: Math.floor(rnd(S) * PHASES.length), minutes: 2 });
      }
      if (!canHave(s) || room <= 0 || have >= E.speciesFull || (!have && st.species >= st.caps.species)) continue;
      const add = Math.min(room, E.speciesFull - have, 1 + Math.floor(rnd(S) * 2));
      out.adopt.push({ kind: 'adopt', sp: s, n: have + add, minutes: add });
    }
    if (st.species >= 1 && st.species < st.caps.species && room > 0 && speciesIds.some((s) => !st.counts[s] && canHave(s))) out.species.push({ kind: 'species', n: st.species + 1, minutes: 2 });
    const open = itemIds.filter((id) => ITEMS[id].tier <= S.tier);
    const needs = supplyKeys.filter((k) => open.some((id) => ITEMS[id].give[k] && freeSpot(S, id)));
    if (needs.length) {
      const drop = needs.length > 2 ? pick(S, needs) : null, ks = needs.filter((k) => k !== drop), need = {};
      for (const k of ks) need[k] = needCount(st, k) + 1;
      out.set.push({ kind: 'set', need, minutes: ks.length });
    }
    for (const id of open) {
      const d = ITEMS[id];
      if (d.zone === 'water') { for (const L of sp.layersOf(d)) if (freeSpot(S, id, { layer: L })) out.terrain.push({ kind: 'terrain', item: id, layer: L, n: countLayer(S, id, L) + 1, minutes: 2 }); }
      else for (const k of d.on) if (eco.kinds[k]?.place && freeSpot(S, id, { on: k })) out.terrain.push({ kind: 'terrain', item: id, on: k, n: countOn(S, id, k) + 1, minutes: 2 });
    }
    if (st.animals >= 2) { const pct = Math.ceil((Math.round(st.H * 100) + 5) / 5) * 5; if (pct <= 100) out.happy.push({ kind: 'happy', pct, minutes: 3 }); }
    return out;
  }
  const reqKey = (q) => `${q.kind}:${q.sp || q.item || q.pct || ''}:${q.on ?? q.layer ?? q.phase ?? ''}`;
  function makeRequest(S, avoid = null) {
    const taken = new Set(S.requests.map((q) => q.kind)), cand = requestCandidates(S);
    const kinds = Object.keys(cand).filter((k) => !taken.has(k)).map((k) => cand[k].filter((q) => reqKey(q) !== avoid && !requestDone(S, q))).filter((l) => l.length);
    if (!kinds.length) return null;
    const q = pick(S, pick(S, kinds));
    return { uid: S.uid++, ...q, reward: Math.max(E.requestMin, Math.round(incomePerMin(S) * q.minutes)) };
  }
  function fillRequests(S) {
    while (S.requests.length < 3) { const q = makeRequest(S); if (!q) break; S.requests.push(q); }
  }
  function claim(S, uid) {
    const i = S.requests.findIndex((q) => q.uid === uid);
    if (i < 0) return no('없는 요청이에요');
    const q = S.requests[i];
    if (!requestDone(S, q)) return no('아직 덜 됐어요');
    gain(S, q.reward);
    S.requests.splice(i, 1);
    fillRequests(S);
    S.events.push({ type: 'claim', uid, reward: q.reward });
    return { ok: true, reward: q.reward };
  }
  function swapRequest(S, uid) {
    const i = S.requests.findIndex((q) => q.uid === uid);
    if (i < 0) return no('없는 요청이에요');
    if (S.time < S.reqSwapAt) return no(`${Math.ceil(S.reqSwapAt - S.time)}초 뒤에 바꿀 수 있어요`);
    const [old] = S.requests.splice(i, 1), q = makeRequest(S, reqKey(old));
    S.requests.splice(i, 0, q ?? old);
    S.reqSwapAt = S.time + E.swapCooldown;
    return ok;
  }

  // ---------- 확장 영역 꾸미기 [AW 16절 T8 섬 꾸미기 틀] ----------
  // 확장 영역이 열리면 6항목(아무 순서, 바꾸기·기한 없음). 한 번 채우면 달성으로 기록하고 [받기]로 보상. 다 받으면 마스터(20분치)
  const EXT_GOALS = X ? [
    { key: 'visit', n: 1, minutes: 5 },
    { key: 'item', n: 1, minutes: 3 },
    { key: 'needs', n: supplyKeys.length, minutes: 5 },
    ...(X.theme && X.theme.length ? [{ key: 'theme', n: 2, minutes: 6 }] : []),
    { key: 'residents', n: X.residents ?? 6, minutes: 6 },
    { key: 'zones', n: 2, minutes: 5 }, // 확장 영역에 서로 다른 구역(육지·해저·수중) 물건 2가지
  ] : [];
  const MASTER_MINUTES = 20;
  const extItems = (S) => S.items.filter((it) => sp.inExt(ITEMS[it.id], it.x, it.y));
  function extNow(S, key) {
    const items = extItems(S);
    if (key === 'visit') return 0;
    if (key === 'item') return items.length;
    if (key === 'needs') return supplyKeys.filter((k) => items.some((it) => ITEMS[it.id].give[k])).length;
    if (key === 'theme') return items.filter((it) => X.theme.includes(it.id)).length;
    if (key === 'residents') return S.animals.filter((a) => sp.isExtCell(sp.cellAt(a.x, a.y))).length;
    return new Set(items.map((it) => ITEMS[it.id].zone)).size;
  }
  const extProgress = (S, key) => { const g = EXT_GOALS.find((x) => x.key === key); return [S.ext.done.includes(key) ? g.n : Math.min(g.n, extNow(S, key)), g.n]; };
  const extReward = (S, minutes) => Math.max(E.requestMin, Math.round(incomePerMin(S) * minutes));
  const extMaster = (S) => EXT_GOALS.length > 0 && EXT_GOALS.every((g) => S.ext.got.includes(g.key));
  const extReady = (S) => S.ext.done.filter((k) => !S.ext.got.includes(k)).length;
  function checkExt(S) {
    if (!extOpen(S)) return;
    for (const g of EXT_GOALS) {
      if (S.ext.done.includes(g.key) || extNow(S, g.key) < g.n) continue;
      S.ext.done.push(g.key);
      S.events.push({ type: 'extGoal', key: g.key });
    }
  }
  function visitExt(S) {
    if (!extOpen(S) || S.ext.done.includes('visit')) return false;
    S.ext.done.push('visit');
    S.events.push({ type: 'extGoal', key: 'visit' });
    return true;
  }
  function claimExt(S, key) {
    const g = EXT_GOALS.find((x) => x.key === key);
    if (!g) return no('없는 항목이에요');
    checkExt(S);
    if (S.ext.got.includes(key)) return no('이미 받았어요');
    if (!S.ext.done.includes(key)) return no('아직 덜 됐어요');
    const reward = extReward(S, g.minutes);
    gain(S, reward);
    S.ext.got.push(key);
    let master = 0;
    if (extMaster(S)) { master = extReward(S, MASTER_MINUTES); gain(S, master); S.events.push({ type: 'extMaster', reward: master }); }
    return { ok: true, reward, master };
  }

  // ---------- 시간 ----------
  // 하루 = 플레이 DAY_SEC초, 시간대 PHASES가 같은 길이로. 진행일수는 1일차부터 [AW]
  function clock(S) {
    const t = Math.max(0, S.time) % DAY_SEC;
    return { day: Math.floor(Math.max(0, S.time) / DAY_SEC) + 1, phase: Math.floor(t / PHASE_SEC), sec: t % PHASE_SEC, name: PHASES[Math.floor(t / PHASE_SEC)] };
  }
  // 한 단계(1/30초)
  function tick(S) {
    S.time += STEP;
    gain(S, (incomePerMin(S) / 60) * STEP);
    updateChance(S, STEP);
    for (const a of S.animals) mv.update(S, a, STEP);
    if (Math.floor(S.time) !== Math.floor(S.time - STEP)) {
      if (S.requests.length < 3) fillRequests(S); // 빈 칸은 1초마다 다시 채워 본다 [AW]
      checkExt(S);
    }
  }
  // 실제 흐른 시간 sec초만큼 고정 단계로 진행(남는 시간은 S.acc에 쌓아 둔다). 한 번에 최대 maxSec초(넘는 몫은 버린다 — 오래 비운 시간은 settleOffline으로)
  function advance(S, sec, maxSec = 5) {
    S.acc = (S.acc || 0) + Math.min(sec, maxSec);
    let n = 0;
    while (S.acc >= STEP - 1e-9) { S.acc -= STEP; tick(S); n++; }
    return n;
  }
  // 게임을 끈 동안의 관람 수익: 최대 offlineCapSec초분. 시계가 뒤로 가면 0
  function settleOffline(S, now) {
    const sec = Math.max(0, (now - S.savedAt) / 1000), n = (incomePerMin(S) / 60) * Math.min(sec, E.offlineCapSec);
    gain(S, n);
    S.savedAt = now;
    return { sec, gain: n, capped: sec > E.offlineCapSec };
  }

  // ---------- 저장 ----------
  function deserialize(raw) {
    const o = parseSave(raw, eco.id);
    if (!o) return null;
    const S = { ...o, events: [], rev: 0, acc: 0 };
    S.items = S.items.filter((it) => ITEMS[it.id]);
    S.animals = S.animals.filter((a) => SPECIES[a.sp]);
    S.requests ??= []; S.reqSwapAt ??= 0; S.album ??= {}; S.ext ??= newExt(); S.chanceIn ??= 12;
    if (S.chance && !S.animals.some((a) => a.uid === S.chance.uid)) S.chance = null;
    touch(S);
    fitTerrain(S);
    return S;
  }
  // 지형이 바뀐 세이브(임시 격자 → 실제 지형 등): 맞지 않는 물건·고착 생물은 맞는 빈자리로 옮기고, 자리가 없으면 낸 값을 모두 돌려준다 [AW `fitTerrain`]
  function fitTerrain(S) {
    const out = { moved: 0, refunded: 0 };
    const bad = S.items.filter((it) => !sp.terrainOk(it.id, it.x, it.y, it.layer));
    if (bad.length) {
      S.items = S.items.filter((it) => !bad.includes(it));
      touch(S);
      for (const it of bad) {
        const at = sp.freeSpot(S, it.id, ITEMS[it.id].zone === 'water' && it.layer ? { layer: it.layer } : {}) || sp.freeSpot(S, it.id);
        if (at) { it.x = at.x; it.y = at.y; it.layer = at.layer; S.items.push(it); out.moved++; } else { S.pop += it.paid; out.refunded++; }
        touch(S);
      }
    }
    for (const a of [...S.animals]) {
      if (a.fx == null || sp.sessileTerrainOk(a.sp, a.fx, a.fy)) continue;
      a.fx = null; touch(S);
      const at = sp.freeSessileSpot(S, a.sp);
      if (at) { a.fx = at.x; a.fy = at.y; mv.spawn(S, a); out.moved++; } else { S.animals.splice(S.animals.indexOf(a), 1); S.pop += a.paid; out.refunded++; }
      touch(S);
    }
    for (const a of S.animals) if (SPECIES[a.sp].partner && !S.animals.some((b) => b.uid === a.host)) assignHost(S, a);
    mv.fix(S, !(out.moved || out.refunded)); // 지형이 그대로면 막힌 자리의 생물만 옮기고 가던 길은 둔다
    if (out.moved || out.refunded) S.events.push({ type: 'terrain', ...out });
    return out;
  }

  // ---------- 화면에 넘길 상태(docs/p1-sim-report.md 2절) ----------
  // creatures·props는 따로도 부를 수 있다(화면은 매 단계 생물만 읽고, 물건은 바뀔 때만 읽는다 — P2)
  const creaturesOf = (S) => S.animals.map((a) => ({ uid: a.uid, sp: a.sp, x: a.x, y: a.y, z: a.z, face: a.face, pitch: a.pitch, st: a.st, ph: a.ph, on: mv.whereOf(a) }));
  const propsOf = (S) => S.items.map((it) => ({ uid: it.uid, id: it.id, x: it.x, y: it.y, w: ITEMS[it.id].w, h: ITEMS[it.id].h, zone: ITEMS[it.id].zone, layer: it.layer, z: sp.itemZ(it), rot: it.rot || 0 }));
  function view(S) {
    return {
      time: S.time, tier: S.tier, pop: S.pop, clock: clock(S),
      ext: { open: extOpen(S), rect: sp.ext },
      chance: S.chance ? { uid: S.chance.uid, t: S.chance.t } : null,
      creatures: creaturesOf(S),
      props: propsOf(S),
    };
  }
  function drainEvents(S) { const e = S.events; S.events = []; return e; }

  return {
    eco, space: sp, mover: mv, STEP, MAX_TIER, TIERS, EXT_GOALS, PHASES, DAY_SEC,
    speciesIds, itemIds, supplyKeys,
    newGame, stats, incomePerMin, popOf: (S) => S.pop, caps: capsOf, extOpen,
    animalValue, itemPoints, priceOfAnimal, priceOfItem, poolOfSpecies, poolOfItem, bodyLen,
    canAdopt, adopt, canRelease, release, canPlace, placeItem, removeItem, freeSpot, limitWhy, zoneCount,
    freeSessileSpot: (S, s) => sp.freeSessileSpot(S, s),
    capture, requestsOf: (S) => S.requests, requestProgress, requestDone, claim, swapRequest,
    extProgress, extReady, extMaster, visitExt, claimExt, extReward,
    clock, tick, advance, settleOffline,
    serialize: serializeState, deserialize, fitTerrain, view, creatures: creaturesOf, props: propsOf, drainEvents,
  };
}
