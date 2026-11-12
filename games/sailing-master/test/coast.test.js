// M2b 앞바다: 내용(발견지·생물·조수기)·스쿠너·풍경(2026-11-12)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import * as SH from '../ship.js';
import { worldOf } from '../world.js';
import { sceneLayout } from '../art.js';
import { atlasBounds, pxOf } from '../art-ship.js';
import { createCreatures, drawSpeciesIcon } from '../creatures.js';
import { BOX, markBoxes, THEMES } from '../themes.js';
import { HULLS, HULL_TIERS, REGIONS, CAL, TIDE, MODULES, SPECIES, ACHIEVEMENTS, ITEMS, DESAL, WORKSHOP } from '../data.js';

const run = (S, sec, each) => { for (let i = 0; i < sec * 30; i++) { G.step(S, G.FIXED_DT); if (each) each(S); } return S; };
const drain = (S) => { const e = S.events.slice(); S.events.length = 0; return e; };
const rich = (n) => Object.fromEntries([...Object.keys(ITEMS).filter((k) => ITEMS[k].kind !== 'trade'), 'coin'].map((k) => [k, n]));
const dayWith = (seed, pred, from = 1) => { for (let d = from; d < 800; d++) if (pred(G.dayWeather(seed, d), d)) return d; throw new Error('그런 날이 없어요'); };
const calmDay = (seed) => dayWith(seed, (q) => q.gust === null && q.storm === null && q.squall === null && !q.fog && !q.seafog && !q.heat && !q.bigswell);
// 앞바다 배(기본 슬루프). mods: 놓을 모듈
function coastShip(hull = 'sloop', mods = [{ id: 'mast_m', col: 1, row: 2, rot: 0 }, { id: 'oar', col: 1, row: 4, rot: 0 }], seed = 1) {
  const S = G.newGame(seed);
  S.region = 'coast'; S.visited = { pond: 1, lake: 1, river: 1, coast: 1 }; S.blueprints = { mast_m: 1, telescope: 1 };
  S.ship = { hull, mods, name: 'T', paint: { hull: 0, sail: 0, flag: 0 }, decor: [] };
  S.cap.x = HULLS[hull].helmX; S.cap.at = 'helm'; S.food = 50; S.water = 8; S.res.coin = 100;
  G.dock(S, 'yard'); drain(S);
  return S;
}
const atSea = (S, x, y) => { G.undock(S); S.boat.x = x; S.boat.y = y; drain(S); return S; };
const SCH = [{ id: 'mast_m', col: 2, row: 2, rot: 0 }, { id: 'mast_d', col: 2, row: 7, rot: 0 }, { id: 'oar', col: 0, row: 10, rot: 0 }, { id: 'wheel', col: 2, row: 12, rot: 0 }];
const fits = (hull, mods) => mods.every((m, i) => SH.canPlace({ hull, mods: mods.slice(0, i) }, m));
const crewOf = (n) => Array.from({ length: n }, (_, i) => ({ id: 80 + i, role: 'deckhand', name: `x${i}`, wage: 0, baseWage: 0, lv: 1, xp: 0, fatigue: 0, morale: 0.9, trait: 'diligent' }));
// 화면 없이 그림 함수를 돌려 보는 가짜 캔버스(무엇을 부르든 받아 줘요)
const fakeCtx = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {})), set: (o, k, v) => { o[k] = v; return true; } });

test('M2b 발견지: 앞바다 10곳, 새 그림 5종, 자리 규칙(where)이 물·물가·젖은 모래·내륙을 지켜요', () => {
  const finds = REGIONS.coast.finds, arts = new Set(finds.map((f) => f.art));
  assert.equal(finds.length, 10);
  for (const a of ['ruins', 'cave', 'rocks', 'tidepool', 'buoy']) assert.ok(arts.has(a), a);
  // 물 위 발견지는 이제 where 칸으로 정해요(예전 wreck 그림 규칙과 같은 결과)
  for (const r of Object.keys(REGIONS)) for (const f of REGIONS[r].finds) if (f.art === 'wreck') assert.equal(f.where, 'water', `${r} ${f.id}`);
  const w = worldOf('coast');
  for (let seed = 1; seed <= 8; seed++) {
    const list = G.findsOf(G.newGame(seed), 'coast'), by = Object.fromEntries(list.map((f) => [f.id, f]));
    assert.equal(by.estuaryBuoy.where, 'water'); assert.ok(w.dist(by.estuaryBuoy.x, by.estuaryBuoy.y) > 10, `시드 ${seed} 부표 물 위`);
    assert.equal(by.tidepool.where, 'beach'); { const d = w.landDist(by.tidepool.x, by.tidepool.y); assert.ok(d > 0 && d < 6, `시드 ${seed} 웅덩이는 물가 바로 앞 조간대 ${d}`); }
    assert.equal(by.seaCave.where, 'shore'); assert.ok(w.landDist(by.seaCave.x, by.seaCave.y) < 0);
    for (const f of list) assert.ok(w.edgeDist(f.x, f.y) > 60, `시드 ${seed} ${f.id}`);
  }
  // 보상: 스쿠너 설계도(난파선), 조수기 설계도(동굴), 철판·톱니가 처음 나와요
  assert.equal(finds.find((f) => f.blueprint === 'schooner').id, 'coastWreck');
  assert.equal(finds.find((f) => f.blueprint === 'desal').id, 'seaCave');
  assert.ok(finds.some((f) => f.plate) && finds.some((f) => f.gear));
});

test('M2b 조수 발견지: 바다 동굴은 썰물에만 들어가고, 조수 웅덩이는 썰물에만 보인다', () => {
  const S = coastShip(), list = G.findsOf(S, 'coast'), cave = list.find((f) => f.id === 'seaCave'), pool = list.find((f) => f.id === 'tidepool');
  const high = calmDay(1) * CAL.day + 1, low = high + CAL.day / 4; // 하루는 밀물 꼭대기로 시작, 1/4이면 썰물
  assert.ok(G.tideAt('coast', high) > TIDE.low && G.tideAt('coast', low) < TIDE.low);
  atSea(S, ...worldOf('coast').nearestWater(cave.x, cave.y));
  S.clock = high; run(S, 1, (T) => { T.clock = high; T.boat.spd = 0; });
  assert.ok(!S.found.seaCave, '밀물엔 못 들어가요');
  assert.ok(drain(S).some((e) => e.type === 'tideGate' && e.id === 'seaCave'));
  S.clock = low; run(S, 1, (T) => { T.clock = low; T.boat.spd = 0; });
  assert.ok(S.found.seaCave && S.blueprints.desal, '썰물엔 들어가 조수기 설계도를 얻어요');
  // 웅덩이: 밀물엔 안 보이고(찾기 전), 썰물엔 보여요
  S.clock = high; assert.equal(G.canSeeFind(S, pool), false);
  S.clock = low; assert.equal(G.canSeeFind(S, pool), true);
  // 썰물 비율: 하루의 약 38%
  let n = 0; for (let i = 0; i < 360; i++) if (G.tideAt('coast', i * CAL.day / 360) <= TIDE.low) n++;
  assert.ok(n / 360 > 0.3 && n / 360 < 0.45, `${n / 360}`);
});

test('M2b 생물: 앞바다 8종이 제 모양 틀로 그려지고, 게는 썰물에만, 돌고래는 배 앞을 타며 그 순간이 도전과제', () => {
  const sea = Object.entries(SPECIES).filter(([, d]) => d.region === 'coast');
  assert.equal(sea.length, 8);
  const kinds = new Set(sea.map(([, d]) => d.kind));
  for (const k of ['dolphin', 'seal', 'seaturtle', 'jelly', 'crab', 'pelican', 'perch', 'bird']) assert.ok(kinds.has(k), k);
  assert.ok(!['swimmer', 'wader'].some((k) => sea.some(([id, d]) => (id === 'dolphin' || id === 'seal' || id === 'cormorant') && d.kind === k)), '돌고래·물범·가마우지는 이제 제 모양');
  for (const [id] of sea) drawSpeciesIcon(fakeCtx(), id, 54, 33, 42); // 도감 그림이 오류 없이 그려져요
  // 화면 생물: 썰물이 아니면 게가 안 나와요
  const w = worldOf('coast'), cam = { x: 150, y: 215, zoom: 6.5, cy: 380 }, boat = { x: 150, y: 215, h: 0, spd: 0 };
  const spawned = (tide) => { const C = createCreatures(w), seen = new Set(); for (let i = 0; i < 1500; i++) { C.update(0.5, cam, 390, 760, boat, true, { tide }); for (const c of C.list) seen.add(c.sp); C.list.length = Math.min(C.list.length, 3); } return seen; };
  assert.ok(!spawned(0.5).has('crab'), '밀물엔 게 없음');
  assert.ok(spawned(-0.5).has('crab'), '썰물엔 게');
  // 돌고래가 빠른 배 앞을 타요
  const C = createCreatures(w), fast = { x: 0, y: -300, h: 0, spd: 8 };
  C.list.push({ sp: 'dolphin', kind: 'dolphin', x: 20, y: -300, h: 0, age: 0, life: 60, ph: 0, act: 0, next: 1, size: 1 });
  let rode = false;
  for (let i = 0; i < 2000 && !rode; i++) { const d = C.list.find((c) => c.sp === 'dolphin'); if (d && !d.bow) { d.x = 20; d.y = -300; d.age = 0; } C.update(0.1, { x: 0, y: -300, zoom: 6.5, cy: 380 }, 390, 760, fast, false, { len: 9 }); rode = !!C.list.find((c) => c.sp === 'dolphin')?.bow; }
  assert.ok(rode, '뱃머리 타기');
  const S = atSea(coastShip(), 0, -300);
  assert.equal(G.bowRide(S, 'dolphin'), false, '배가 서 있으면 아니에요');
  S.boat.spd = 6; assert.equal(G.bowRide(S, 'seal'), false);
  assert.equal(G.bowRide(S, 'dolphin'), true); assert.ok(S.ach.bowRide && S.seen.dolphin);
  assert.ok(ACHIEVEMENTS.some((a) => a.id === 'seaAll') && ACHIEVEMENTS.some((a) => a.id === 'bowRide') && ACHIEVEMENTS.some((a) => a.id === 'schooner'));
});

test('M2b 조수기: 짠물 바다를 항해하는 동안 식수를 만들고(하루 2통), 입항 중이나 담수에선 안 돌아요', () => {
  const S = coastShip('sloop', [{ id: 'mast_m', col: 1, row: 2, rot: 0 }, { id: 'oar', col: 1, row: 4, rot: 0 }, { id: 'water', col: 0, row: 3, rot: 0 }]);
  S.res = rich(40); S.blueprints.desal = 1;
  assert.ok(G.isUnlocked(S, 'desal'));
  assert.ok(G.placeModule(S, 'desal', 2, 3).ok);
  const st = G.stats(S); assert.equal(st.desal, 1);
  const docked0 = S.water; S.t += 100; G.step(S, 1); assert.equal(S.water, docked0, '입항 중엔 안 돌아요');
  atSea(S, 0, 150); S.clock = calmDay(1) * CAL.day + 5; S.water = 2;
  run(S, CAL.day / 2, (T) => { T.boat.x = 0; T.boat.y = 150; T.vigor = 1; });
  const net = S.water - 2; // 하루 반나절: 조수기 +1통, 혼자 마셔서 −0.5통
  assert.ok(Math.abs(net - (DESAL.perDay - 1) / 2) < 0.02, `${net}`);
  S.water = st.waterCap - 0.01; run(S, 30); assert.ok(S.water <= st.waterCap + 1e-9, '물통 칸까지만');
  assert.equal(MODULES.desal.need.blueprint, 'desal'); assert.ok(MODULES.desal.cost.plate && MODULES.desal.cost.gear);
});

test('M2b 스쿠너 짓기: 슬루프 ★2 이상 + 조선 항구(조선소 4등급) + 설계도 + 철판·톱니', () => {
  assert.equal(HULL_TIERS[3].kind, 'schooner');
  const H = HULLS.schooner;
  assert.equal(H.grade, 4); assert.ok(H.len >= 14 && HULLS.schooner2.len <= 17);
  assert.equal(SH.validCells('schooner').length, 42); assert.equal(SH.validCells('schooner2').length, 56);
  assert.deepEqual([H.crew, HULLS.schooner2.crew, HULLS.schooner3.crew, H.minCrew], [6, 7, 8, 3]);
  assert.ok(H.price.plate && H.price.gear && H.price.oak && H.price.canvas);
  const S = coastShip('sloop'); S.res = rich(900);
  assert.match(G.buildHull(S, 'schooner').why, /★2/);
  S.ship.hull = 'sloop2'; S.crew = crewOf(2);
  G.dock(S, 'fisher'); drain(S);
  assert.match(G.buildHull(S, 'schooner').why, /조선 항구/, '하구 어촌(조선소 3등급)에선 못 지어요');
  assert.equal(G.yardOf(S), 3);
  G.dock(S, 'yard'); drain(S); assert.equal(G.yardOf(S), 4);
  assert.match(G.buildHull(S, 'schooner').why, /설계도/);
  S.blueprints.schooner = 1;
  assert.ok(G.canAffordHull(S, H));
  const coin = S.res.coin;
  assert.ok(G.buildHull(S, 'schooner').ok);
  assert.equal(S.ship.hull, 'schooner'); assert.equal(S.crew.length, 0, '선원은 내려요');
  assert.ok(S.res.coin <= coin - H.price.coin + 60 + 40, '배 값(옛 모듈 절반 + 도전과제 금화는 돌려받아요)'); assert.ok(S.ach.schooner);
  assert.ok(G.stats(S).canMove, '보조 기관이 있어 모듈 없이도 움직여요');
  // 스쿠너 모듈이 열려요(주돛대·타륜·망루·구명정), 아직 표에만 있는 것은 잠겨 있어요
  for (const id of ['mast_d', 'wheel', 'crowsnest', 'lifeboat']) assert.ok(G.isUnlocked(S, id), id);
  for (const id of ['galley', 'lounge', 'sickbay', 'oar2']) assert.ok(!G.isUnlocked(S, id), id);
  // 톱니·베어링은 앞바다 항구에서만 사요. 공방은 쇠못 3개로 철판
  assert.ok(G.canBuyMat(S, 'gear') && G.buyMat(S, 'gear', 1) === 1);
  const R = G.newGame(1); R.region = 'river'; R.docked = 'head'; R.res.coin = 100; assert.equal(G.canBuyMat(R, 'gear'), false); assert.equal(G.buyMat(R, 'gear', 1), 0); assert.ok(G.canBuyMat(R, 'nail'));
  assert.equal(WORKSHOP.pairs.nail, 'plate');
  // ★2·★3도 같은 곳에서
  assert.ok(G.buildHull(S, 'schooner2').ok && G.buildHull(S, 'schooner3').ok); assert.ok(G.stats(S).doubleHull);
});

test('M2b 스쿠너 그림: 선체마다 배율을 낮춰 굽고(14~16px/m), 64방향 모두 칸 256px 안에 들어가요', () => {
  const tall = [{ id: 'crowsnest', col: 1, row: 4, rot: 0 }, { id: 'desal', col: 3, row: 6, rot: 0 }];
  for (const id of ['sloop', 'sloop3', 'schooner', 'schooner2', 'schooner3']) {
    const b = atlasBounds({ hull: id, mods: tall.filter(() => HULLS[id].grade >= 4) });
    assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= b.cell && b.y1 <= b.cell, `${id} ${JSON.stringify(b)}`);
    assert.ok(b.layer < b.cell / 2, `${id} 층 그림도 안 잘림`);
  }
  assert.equal(pxOf(HULLS.sloop2), 20, '12m 밑은 예전 그대로');
  assert.ok(pxOf(HULLS.schooner) <= 16 && pxOf(HULLS.schooner2) <= 14);
  // 예전 방식(20px/m)이었다면 스쿠너 ★2는 잘렸어요
  assert.ok(HULLS.schooner2.len / 2 * 20 > 128);
});

test('M2b 돛대 둘: 스쿠너는 돛대를 둘(3.6m 넘게 떨어져)까지 세우고, 둘이면 바람을 더 받아 빠르다', () => {
  assert.ok(fits('schooner', SCH), '시험 배치가 칸 규칙에 맞아요');
  const one = SH.statsOf({ hull: 'schooner', mods: [SCH[1], SCH[2]] }), two = SH.statsOf({ hull: 'schooner', mods: SCH });
  assert.equal(two.masts.length, 2); assert.equal(two.mastId, 'mast_d', '큰 돛대가 주돛대');
  assert.ok(Math.abs(two.sailArea - (MODULES.mast_d.sail + MODULES.mast_m.sail * 0.85)) < 1e-9);
  assert.equal(SH.mastProblem({ hull: 'schooner', mods: SCH.slice(0, 2) }, { id: 'mast_m', col: 0, row: 10, rot: 0 }), 'many');
  assert.equal(SH.mastProblem({ hull: 'schooner', mods: [SCH[1]] }, { id: 'mast_m', col: 2, row: 5, rot: 0 }), 'near');
  assert.equal(SH.mastProblem({ hull: 'sloop', mods: [{ id: 'mast_m', col: 1, row: 2, rot: 0 }] }, { id: 'mast_m', col: 1, row: 6, rot: 0 }), 'one', '슬루프는 그대로 하나');
  // 옆바람 돛 속도: 둘이 하나보다 빨라요(선원 셋이 있어 다 펴요)
  const speed = (mods) => { const S = coastShip('schooner', mods); S.crew = crewOf(3); S.ship.mods.push({ id: 'hammock', col: 1, row: 4, rot: 0 }, { id: 'hammock', col: 3, row: 4, rot: 0 }, { id: 'hammock', col: 1, row: 9, rot: 0 }); S.rev++; atSea(S, 0, -150); S.clock = calmDay(1) * CAL.day + 5; S.boat.sailLevel = 2; run(S, 25, (T) => { T.boat.x = 0; T.boat.y = -150; T.boat.h = T.wind.from + 0.95; T.boat.rudder = 0; }); return S.boat.spd; }; // 맞바람 쪽 55°(배 속도 상한에 안 닿게)
  const v1 = speed([SCH[1], SCH[2]]), v2 = speed(SCH);
  assert.ok(v2 > v1 * 1.08, `${v2} > ${v1}`);
  // 일손이 모자라면 줄인 만큼만 펴요
  const S = coastShip('schooner', SCH); atSea(S, 0, -150); S.boat.sailLevel = 2; run(S, 8);
  assert.ok(S.boat.sailNow <= 0.56, `${S.boat.sailNow}`);
  assert.ok(G.departureCheck(coastShip('schooner', SCH)).warns.some((x) => x.includes('일손')));
});

test('M2b 보조 기관: 돛이 약할 때(맞바람·무풍)만 느리게 돌고, 돛이 받치면 꺼져요. 슬루프엔 없어요', () => {
  const go = (hull, mods, head, crew = 3) => {
    const S = coastShip(hull, mods); S.crew = crewOf(crew); atSea(S, 0, -150); S.clock = calmDay(1) * CAL.day + 5; S.boat.sailLevel = 2;
    let on = false;
    run(S, 20, (T) => { T.boat.x = 0; T.boat.y = -150; T.boat.h = T.wind.from + head; T.boat.rudder = 0; on ||= !!T.boat.motor; });
    return { spd: S.boat.spd, motor: !!S.boat.motor, ev: drain(S) };
  };
  const irons = go('schooner', SCH, 0), reach = go('schooner', SCH, Math.PI / 2), sloop = go('sloop', [{ id: 'mast_m', col: 1, row: 2, rot: 0 }], 0, 0);
  assert.ok(irons.motor && Math.abs(irons.spd - HULLS.schooner.motor) < 0.25, `맞바람 기관 ${irons.spd}`);
  assert.ok(irons.spd <= HULLS.schooner.motor + 1e-6, '기관 속도 상한');
  assert.ok(irons.ev.some((e) => e.type === 'motorOn'));
  assert.ok(!reach.motor && reach.spd > HULLS.schooner.motor * 1.5, `옆바람엔 꺼져요 ${reach.spd}`);
  assert.ok(sloop.spd < 0.6 && !sloop.motor, `슬루프는 맞바람에 서요 ${sloop.spd}`);
  // 돛을 내리고 항로도 없으면 안 돌아요(그냥 떠 있어요)
  const S = coastShip('schooner', SCH); atSea(S, 0, -150); S.boat.sailLevel = 0; run(S, 10); assert.ok(!S.boat.motor && S.boat.spd < 0.3);
  // 타륜: 키가 30% 잘 들어요
  assert.equal(SH.statsOf({ hull: 'schooner', mods: SCH }).turnK, 1.3); assert.equal(SH.statsOf({ hull: 'schooner', mods: [] }).turnK, 1);
});

test('M2b 엔딩: 스쿠너로 북쪽 큰 바다 경계를 넘으면 이번 단계가 끝나요(슬루프는 못 넘어요)', () => {
  const ocean = worldOf('coast').gates.find((g) => g.id === 'toOcean');
  const T = coastShip('sloop3'); assert.equal(G.passGate(T, ocean), false);
  const S = coastShip('schooner', SCH); S.crew = crewOf(3);
  atSea(S, ...worldOf('coast').nearestWater(ocean.x, ocean.y + 30));
  assert.ok(G.setDest(S, ocean.x, ocean.y, { type: 'gate', id: ocean.id }));
  let at = false; run(S, 40, (U) => { if (U.events.some((e) => e.type === 'atGate')) at = true; U.events.length = 0; U.vigor = 1; });
  assert.ok(at, '경계 표지까지 배로 가요');
  assert.ok(G.gateStatus(S, ocean).ok);
  assert.ok(G.passGate(S, ocean));
  assert.ok(S.ended && S.ach.openSea && drain(S).some((e) => e.type === 'ended'));
  G.step(S, 1); assert.ok(S.ended, '엔딩 뒤엔 멈춰요');
});

test('M2b 너울 방향은 그 바다에 늘 부는 바람을 따르고, 구명정은 가라앉아도 화물 절반을 건진다', () => {
  assert.equal(G.swellFrom('coast'), REGIONS.coast.wind.from);
  const from = REGIONS.coast.wind.from;
  assert.ok(Math.abs(G.swellBeamK(from, from) - 0.5) < 1e-9 && Math.abs(G.swellBeamK(from + Math.PI / 2, from) - 1.5) < 1e-9);
  const S = coastShip('schooner', [...SCH, { id: 'lifeboat', col: 4, row: 10, rot: 0 }]); atSea(S, 0, -200);
  S.hold = { oak: 10, canvas: 5 }; S.hull = 0; G.step(S, G.FIXED_DT); assert.ok(S.disaster);
  const r = G.rescue(S); assert.deepEqual(S.hold, { oak: 5, canvas: 2 }); assert.deepEqual(r.lost, { oak: 5, canvas: 3 });
  const T = coastShip(); atSea(T, 0, -200); T.hold = { oak: 10 }; T.hull = 0; G.step(T, G.FIXED_DT); G.rescue(T); assert.deepEqual(T.hold, {});
});

test('M2b 풍경: 앞바다 사물(해송·갯풀·어촌·덕장·방파제·염전)이 판마다 항구·부두·관문·등대·발견지와 겹치지 않는다', () => {
  assert.equal(THEMES.coast.hut, 'seahut'); assert.ok(THEMES.coast.strict);
  const k = 0.62, box = (p) => { const [w, h] = BOX[p.kind], s = p.size || 1; return [p.x - w * s / 2, p.x + w * s / 2, p.y * k - h * s, p.y * k + 0.6]; };
  const hit = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
  const kinds = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const S = G.newGame(seed), L = sceneLayout('coast', G.findsOf(S, 'coast')), mb = markBoxes(L.marks), w = worldOf('coast');
    const land = L.props.filter((p) => !L.marks.includes(p));
    for (const p of land) { kinds.add(p.kind); for (let i = 0; i < mb.length; i++) assert.ok(!hit(box(p), mb[i]), `시드 ${seed}: ${p.kind} (${p.x | 0}, ${p.y | 0}) × ${L.marks[i].kind}`); assert.ok(w.landDist(p.x, p.y) < 0, `${p.kind} 뭍`); }
    for (const q of L.decals) for (const m of L.marks) assert.ok(Math.hypot(q.x - m.x, q.y - m.y) > q.r + 5, `시드 ${seed}: ${q.kind} × ${m.kind}`);
    assert.ok(L.decals.some((q) => q.kind === 'saltpan'));
    assert.ok(L.marks.some((m) => m.kind === 'seamark' && m.gate) && L.marks.some((m) => m.kind === 'lighthouse'), '바다 관문 표지·등대');
    assert.ok(L.marks.filter((m) => m.port).every((m) => m.kind === 'seahut'), '어촌 항구 집');
  }
  for (const kk of ['seapine', 'seagrass', 'fishhut', 'netrack', 'breakwater']) assert.ok(kinds.has(kk), kk);
});

test('M2b 저장 v6 → v7: 정해 둔 앞바다 발견지 자리는 그대로 두고 그림·보상은 새 표로, 새 발견지만 새 자리', () => {
  const S = G.newGame(4); S.region = 'coast'; S.visited.coast = 1;
  const now = G.findsOf(S, 'coast');
  // 예전(M2a) 모양: 7곳, 버려진 어촌은 cabin, 물개 바위 돌탑은 stone
  const old = now.filter((f) => !['seaCave', 'tidepool', 'estuaryBuoy'].includes(f.id)).map((f) => ({ ...f, art: f.id === 'fishRuin' ? 'cabin' : f.id === 'sealRock' ? 'stone' : f.art, blueprint: undefined, plate: undefined }));
  S.findPos.coast = old; S.found.fishRuin = 1;
  const o = JSON.parse(G.serialize(S)); o.v = 6; delete o.boat.motor;
  const T = G.deserialize(JSON.stringify(o));
  assert.equal(T.v, 7); assert.equal(T.boat.motor, false);
  const list = T.findPos.coast, by = Object.fromEntries(list.map((f) => [f.id, f]));
  assert.equal(list.length, 10);
  for (const f of old) { assert.equal(by[f.id].x, f.x); assert.equal(by[f.id].y, f.y); }
  assert.equal(by.fishRuin.art, 'ruins'); assert.equal(by.sealRock.art, 'rocks'); assert.equal(by.coastWreck.blueprint, 'schooner');
  for (const id of ['seaCave', 'tidepool', 'estuaryBuoy']) assert.ok(by[id] && Number.isFinite(by[id].x), id);
  assert.equal(by.estuaryBuoy.where, 'water');
  assert.ok(T.found.fishRuin);
  // 다시 불러도 같아요
  assert.deepEqual(JSON.parse(G.serialize(G.deserialize(G.serialize(T)))).findPos, JSON.parse(G.serialize(T)).findPos);
  // 품삯: 한 닢이 안 되는 끝수는 다음에(입항할 때마다 한 닢씩 나가지 않게)
  const W = coastShip(); W.crew = crewOf(1); W.owed = 0.3; const c0 = W.res.coin; G.dock(W, 'yard'); assert.equal(W.res.coin, c0); assert.ok(Math.abs(W.owed - 0.3) < 1e-9);
});
