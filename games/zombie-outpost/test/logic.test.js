import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../logic.js';
import { run } from '../tools/sim.js';

const DT = 1 / 30;
const stepFor = (s, sec, input = null) => { for (let t = 0; t < sec; t += DT) G.step(s, DT, input); };
const rich = (s) => { Object.assign(s.res, { wood: 1e6, scrap: 1e6, plastic: 1e6 }); return s; };
const fresh = (seed) => { const s = G.newGame(seed); G.setObstacles(s, []); return s; };
// 진행 중인 건설·강화·제작·훈련을 모두 끝낸다
const finish = (s) => G.advanceJobs(s, 1e9);
const zombieAt = (s, x, y, hp = 1000) => {
  const z = { id: 999, type: 'runner', x, y, hp, max: hp, dmg: 0, speed: 0, reward: 2, r: 11, d: 1, atk: 9, wa: 0, wt: 99, hit: 0 };
  s.zombies.push(z);
  return z;
};

test('비용은 레벨마다 지수로 늘고 정수다', () => {
  for (const id of Object.keys(G.BUILDINGS)) {
    const a = G.buildCost(id, 1), b = G.buildCost(id, 5);
    for (const k of Object.keys(a)) {
      assert.ok(Number.isInteger(b[k]) && b[k] > a[k], `${id}.${k}`);
    }
  }
  assert.ok(G.hqCost(3).scrap > G.hqCost(2).scrap);
});

test('전진기지 한도는 본부 레벨 ÷ 2', () => {
  const s = fresh(1);
  assert.deepEqual([1, 2, 3, 4, 7, 10].map((hq) => G.outpostLimit({ ...s, hq })), [0, 1, 1, 2, 3, 5]);
});

test('전진기지: 한도·현장 방문·자원 조건을 모두 지킨다', () => {
  const s = rich(fresh(2));
  const site = s.sites[0];
  s.player.x = site.x; s.player.y = site.y;
  assert.equal(G.buildOutpost(s, 0).ok, false, '본부 1레벨이면 한도 0');
  s.hq = 2;
  s.player.x = G.CENTER.x; s.player.y = G.CENTER.y;
  assert.equal(G.buildOutpost(s, 0).ok, false, '후보지에 없으면 거절');
  s.player.x = site.x; s.player.y = site.y;
  const before = s.res.scrap;
  assert.equal(G.buildOutpost(s, 0).ok, true);
  assert.equal(s.res.scrap, before - G.outpostCost(s, 0).scrap);
  finish(s);
  const s1 = s.sites[1];
  s.player.x = s1.x; s.player.y = s1.y;
  const r = G.buildOutpost(s, 1);
  assert.equal(r.ok, false, '한도 1개 초과');
  assert.match(r.msg, /본부 4레벨/);
  assert.ok(G.safeZoneAt(s, site.x, site.y), '전진기지는 안전지대가 된다');
});

test('건물은 본부 레벨을 넘을 수 없고, 해금 전에는 못 짓는다', () => {
  const s = rich(fresh(3));
  assert.equal(G.buyBuilding(s, 'sawmill').ok, true);
  finish(s);
  assert.equal(G.buyBuilding(s, 'sawmill').ok, false, '본부 1레벨이면 1레벨까지');
  assert.equal(G.buyBuilding(s, 'recycler').ok, false, '재활용 작업장은 본부 2레벨');
  assert.equal(G.upgradeHq(s).ok, true);
  finish(s);
  assert.equal(G.buyBuilding(s, 'sawmill').ok, true);
  finish(s);
  assert.equal(G.buyBuilding(s, 'recycler').ok, true);
});

test('무기: 공방 등급이 모자라면 제작 불가, 제작하면 바로 장착', () => {
  const s = rich(fresh(4));
  assert.equal(G.craftWeapon(s, 'pistol').ok, false);
  G.buyBuilding(s, 'workbench'); finish(s);
  assert.equal(G.craftWeapon(s, 'pistol').ok, true);
  finish(s);
  assert.equal(s.equip.gun, 'pistol');
  const d1 = G.weaponDamage(s, 'pistol');
  assert.equal(G.upgradeWeapon(s, 'pistol').ok, true);
  finish(s);
  assert.ok(G.weaponDamage(s, 'pistol') > d1);
});

test('공격 선택: 붙으면 근접, 떨어지면 총(재장전 중이면 총을 못 쓴다)', () => {
  const s = rich(fresh(5));
  G.buyBuilding(s, 'workbench'); finish(s); G.craftWeapon(s, 'pistol'); finish(s);
  const P = s.player;
  assert.equal(P.mag, G.WEAPONS.pistol.mag, '제작하면 탄창이 찬다');
  assert.equal(G.chooseAttack(s, { x: P.x + 30, y: P.y, r: 0 }).w.kind, 'melee');
  assert.equal(G.chooseAttack(s, { x: P.x + 200, y: P.y, r: 0 }).w.kind, 'gun');
  P.reload = 1;
  assert.equal(G.chooseAttack(s, { x: P.x + 200, y: P.y, r: 0 }), null);
  assert.equal(G.chooseAttack(s, { x: P.x + 30, y: P.y, r: 0 }).w.kind, 'melee', '재장전 중에도 근접은 된다');
});

test('총은 탄창을 다 쓰면 예비 탄약으로 재장전하고, 좀비는 자원을 떨어뜨리지 않는다', () => {
  const s = fresh(6);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  G.gainWeapon(s, 'pistol'); G.equipWeapon(s, 'pistol');
  s.ammo = 40;
  s.player.x = 600; s.player.y = 600;
  zombieAt(s, 700, 600, 1e6);
  stepFor(s, G.WEAPONS.pistol.cd * G.WEAPONS.pistol.mag + 0.2);
  assert.equal(s.player.mag, 0);
  assert.ok(s.player.reload > 0);
  stepFor(s, G.WEAPONS.pistol.reload + 0.1);
  assert.ok(s.player.mag > 0, '재장전이 끝나면 예비 탄약으로 찬다');
  assert.equal(s.ammo, 40 - G.WEAPONS.pistol.mag, '재장전한 만큼 예비가 준다');
  s.zombies[0].hp = 1;
  stepFor(s, 2);
  assert.equal(s.stats.kills, 1);
  assert.equal(G.bagTotal(s), 0);
});

test('자원은 목재·고철·플라스틱 3종이고, 자원마다 원천 대상물이 6종이며 서로 겹치지 않는다', () => {
  assert.deepEqual(G.RES_KEYS, ['wood', 'scrap', 'plastic']);
  const byRes = {};
  for (const [id, t] of Object.entries(G.LOOT_TYPES)) (byRes[t.res] ??= []).push(id);
  for (const r of G.RES_KEYS) assert.equal(byRes[r].length, 6, `${r}: ${byRes[r]}`);
  assert.equal(Object.keys(byRes).length, 3);
  // 구역마다 주력 자원이 다르다(주택가=목재, 상가=플라스틱, 공단=고철)
  const main = (zone) => G.RES_KEYS.map((r) => [r, byRes[r].reduce((a, id) => a + G.LOOT_TYPES[id].zones[zone], 0)]).sort((a, b) => b[1] - a[1])[0][0];
  assert.deepEqual([main(1), main(2), main(3)], ['wood', 'plastic', 'scrap']);
  const s = fresh(30);
  for (const r of G.RES_KEYS) assert.ok(s.nodes.some((n) => n.res === r));
});

test('특별 아이템: 대상물을 주우면 가끔 나오고, 쓰면 효과가 난다', () => {
  const s = fresh(31);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  for (const n of s.nodes) n.amt = 1;
  let got = 0;
  for (const n of s.nodes.slice(0, 120)) {
    s.player.x = n.x; s.player.y = n.y;
    const ev = []; for (let t = 0; t < 2; t += DT) ev.push(...G.step(s, DT));
    got += ev.filter((e) => e.t === 'item').length;
    s.bag.wood = s.bag.scrap = s.bag.plastic = 0;
  }
  assert.ok(got >= 2, `아이템 ${got}개`);
  s.items.medkit = 1; s.player.hp = 10;
  assert.equal(G.useItem(s, 'medkit').ok, true);
  assert.ok(s.player.hp >= 10 + G.maxHp(s) * 0.6 - 1e-9);
  s.items.toolbox = 1; s.wall = 1;
  assert.equal(G.useItem(s, 'toolbox').ok, true);
  assert.equal(s.wall, G.wallMax(s));
  s.items.flare = 1; s.rescue = null;
  s.player.x = 900; s.player.y = 900;
  assert.equal(G.useItem(s, 'flare').ok, true);
  assert.ok(s.rescue && G.dist(s.rescue.x, s.rescue.y, 900, 900) <= 400);
  assert.deepEqual(G.ITEM_KEYS, ['medkit', 'molotov', 'toolbox', 'flare', 'stim'], '에너지 드링크는 없다');
  s.items.molotov = 1;
  const z = zombieAt(s, 950, 900, 50);
  assert.equal(G.useItem(s, 'molotov').ok, true);
  assert.ok(z.hp < 50);
  assert.equal(G.useItem(s, 'molotov').ok, false, '다 쓰면 못 쓴다');
});

test('드랍 장비(무기 6 · 방어구 5)는 제작할 수 없고, 대상물 종류와 상관없이 구역 조건에 맞는 것 중 아직 없는 것만 나온다', () => {
  const s = rich(fresh(32));
  s.bld.workbench = 3; s.hq = 4;
  const drops = Object.keys(G.WEAPONS).filter((id) => G.weaponSource(id) === 'drop');
  assert.equal(drops.length, 6);
  assert.equal(drops.filter((id) => G.WEAPONS[id].kind === 'melee').length, 3);
  for (const id of drops) assert.equal(G.craftWeapon(s, id).ok, false);
  assert.equal(Object.keys(G.ARMORS).filter((k) => G.ARMORS[k].source === 'drop').length, 5);
  // 구역 조건: 주택가는 장갑·부츠만, 공단부터 T4 무기, 검은 숲이면 11종 모두
  assert.deepEqual(G.dropPool(s, 1).sort(), ['boots', 'gloves']);
  const p3 = G.dropPool(s, 3);
  assert.ok(p3.includes('axe') && p3.includes('crossbow') && p3.includes('shield') && !p3.includes('chainsaw'));
  assert.equal(G.dropPool(s, 5).length, 11);
  s.armor.gloves = 1;
  assert.ok(!G.dropPool(s, 1).includes('gloves'), '이미 가진 건 다시 나오지 않는다');
  // 실제로 주워 보면(어떤 대상물이든) 2% 안팎으로 나온다
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  const nodes = s.nodes.filter((n) => G.zoneIndex(n.d) >= 3);
  const found = [];
  for (let i = 0; i < 900 && found.length < 3; i++) {
    const n = nodes[i % nodes.length];
    n.readyAt = 0; s.player.x = n.x; s.player.y = n.y; s.gather = null; s.bag.wood = s.bag.scrap = s.bag.plastic = 0;
    for (let t = 0; t < 2.2; t += DT) for (const e of G.step(s, DT)) if (e.t === 'weapon-found' || e.t === 'armor-found') found.push(e.id);
  }
  assert.ok(found.length >= 1, `발견 ${found}`);
  for (const id of found) assert.ok(s.weapons[id] === 1 || s.armor[id] === 1, id);
});

test('미션 7개가 유니크 7종(무기 4 · 방어구 3)을 하나씩 주고, 한 번만 받는다', () => {
  const s = fresh(33);
  const uw = Object.keys(G.WEAPONS).filter((id) => G.weaponSource(id) === 'unique');
  const ua = Object.keys(G.ARMORS).filter((id) => G.ARMORS[id].source === 'unique');
  assert.equal(uw.length, 4); assert.equal(ua.length, 3);
  assert.equal(uw.filter((id) => G.WEAPONS[id].kind === 'melee').length, 2);
  assert.deepEqual(G.MISSIONS.map((m) => m.reward).sort(), [...uw, ...ua].sort());
  assert.equal(G.claimMission(s, 'hunter').ok, false);
  s.stats.kills = 1000;
  assert.equal(G.claimMission(s, 'hunter').ok, true);
  assert.equal(s.weapons.homerun, 1);
  assert.equal(G.claimMission(s, 'hunter').ok, false);
  s.stats.rescued = 10;
  assert.equal(G.claimMission(s, 'rescuer').ok, true);
  assert.equal(s.armor.tacHelmet, 1);
  // 수집가: 드랍 장비 8종
  for (const id of ['axe', 'chainsaw', 'sledge', 'crossbow']) G.gainWeapon(s, id);
  for (const id of ['helmet', 'gloves', 'boots']) G.gainArmor(s, id);
  assert.equal(G.dropFound(s), 7);
  assert.equal(G.claimMission(s, 'collector').ok, false);
  G.gainArmor(s, 'vest');
  assert.equal(G.claimMission(s, 'collector').ok, true);
  assert.equal(s.armor.milVest, 1);
  // 단련: 방어구 3개를 2강까지
  s.armor.helmet = s.armor.gloves = G.ARMOR_MAX_LV;
  assert.equal(G.claimMission(s, 'forger').ok, false);
  s.armor.boots = G.ARMOR_MAX_LV;
  assert.equal(G.claimMission(s, 'forger').ok, true);
  assert.equal(s.armor.combatBoots, 1);
  const t = G.deserialize(G.serialize(s));
  assert.equal(t.claimed.hunter, true);
  assert.deepEqual(t.armor, s.armor);
  // 예전 세이브: 없어진 무기는 빠지고, 받은 미션의 보상이 바뀌었으면 새 보상을 준다
  const o = JSON.parse(G.serialize(fresh(34)));
  Object.assign(o, { claimed: { rescuer: true }, weapons: { fist: 1, savior: 1, nailgun: 1, pistol: 1 }, equip: { melee: 'fist', gun: 'savior' }, items: { energy: 3, stim: 7 } });
  const u = G.deserialize(JSON.stringify(o));
  assert.equal(u.armor.tacHelmet, 1);
  assert.equal(u.weapons.savior, undefined); assert.equal(u.weapons.nailgun, undefined);
  assert.equal(u.equip.gun, 'pistol', '없어진 총 대신 가진 총');
  assert.equal(u.items.stim, 9, '에너지 드링크는 스팀팩으로(9개까지)');
});

test('파밍한 자원은 가방 용량까지만 담기고, 안전지대에 들어가면 창고로 옮겨진다', () => {
  const s = fresh(8);
  s.autoHunt = false; s.spawnT = 1e9;
  const node = s.nodes.find((n) => n.res === 'wood');
  node.amt = 500;
  s.player.x = node.x; s.player.y = node.y;
  stepFor(s, 2);
  assert.equal(s.bag.wood, G.bagCap(s));
  const wood = s.res.wood;
  s.player.x = G.CENTER.x; s.player.y = G.CENTER.y;
  G.step(s, DT);
  assert.equal(s.bag.wood, 0);
  assert.ok(s.res.wood >= wood + G.bagCap(s));
});

test('로그라이크: 죽으면 게임 오버 — 세계가 멈추고, 결과는 저장돼도 유지된다', () => {
  const s = fresh(9);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.player.x = 500; s.player.y = 500;
  s.items.medkit = 0;
  s.player.hp = 1;
  const z = zombieAt(s, 505, 500);
  z.dmg = 50; z.atk = 0;
  const ev = G.step(s, DT);
  assert.ok(ev.some((e) => e.t === 'gameover'));
  assert.ok(s.over && s.over.summary.kills === 0 && s.over.summary.level === 1);
  assert.equal(s.stats.deaths, 1);
  const t0 = s.time, res0 = { ...s.res };
  assert.deepEqual(G.step(s, DT), [], '게임 오버 뒤에는 멈춘다');
  assert.equal(s.time, t0);
  assert.deepEqual(s.res, res0);
  const t = G.deserialize(G.serialize(s));
  assert.ok(t.over, '다시 열어도 결과 화면');
  assert.equal(t.player.dead, 1);
  assert.equal(G.applyOffline(t, Date.now() + 3600e3), null, '끝난 판은 자리 비움 보상도 없다');
  const n = G.newGame(10);
  assert.equal(n.over, null);
  assert.equal(n.items.medkit, 2, '새 판은 구급상자 2개로 시작');
});

test('로그라이크: 최고 기록만 판을 넘어 남는다', () => {
  const a = G.mergeRecords(null, { playTime: 600, level: 5, kills: 80, hq: 2, rescued: 1, raidsWon: 0 });
  assert.equal(a.records.runs, 1);
  assert.deepEqual(a.beaten.sort(), ['hq', 'kills', 'level', 'playTime', 'rescued']);
  const b = G.mergeRecords(a.records, { playTime: 300, level: 7, kills: 20, hq: 1, rescued: 0, raidsWon: 0 });
  assert.equal(b.records.runs, 2);
  assert.equal(b.records.playTime, 600);
  assert.equal(b.records.level, 7);
  assert.deepEqual(b.beaten, ['level']);
});

test('기지 안에 숨으면 일반 좀비는 추격을 포기하고, 포위 돌파 판단은 이길 수 있을 때만 참', () => {
  const s = fresh(74);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.player.x = G.CENTER.x; s.player.y = G.CENTER.y;
  const R = G.hqSafeRadius(s);
  const z = zombieAt(s, G.CENTER.x + R + 80, G.CENTER.y); z.speed = 60; z.wa = 0; z.wt = 99; // 바깥쪽으로 걷게
  stepFor(s, 2);
  assert.ok(G.dist(z.x, z.y, G.CENTER.x, G.CENTER.y) > R + 80, '방벽으로 몰려오지 않는다');
  const t = fresh(75);
  t.spawnT = 1e9; t.rescueT = 1e9;
  t.player.x = 900; t.player.y = 900;
  t.rescue = { kind: 'siege', x: 1100, y: 900, d: 2.3, ttl: 90 };
  for (let k = 0; k < 6; k++) { const q = zombieAt(t, 1100 + 60 * Math.cos(k), 900 + 60 * Math.sin(k), 90); q.siege = true; q.dmg = 12; }
  assert.equal(G.canBreakSiege(t), false, '맨주먹으로는 무리');
  G.gainWeapon(t, 'axe'); t.weapons.axe = 6; G.equipWeapon(t, 'axe'); t.level = 20; t.growth.atk = 0.8; t.growth.hp = 150; t.player.hp = G.maxHp(t);
  assert.equal(G.canBreakSiege(t), true, '강하면 들어간다');
});

test('좀비는 바리케이드(안전지대) 안으로 못 들어온다', () => {
  const s = fresh(10);
  s.autoHunt = false;
  s.player.x = G.CENTER.x; s.player.y = G.CENTER.y;
  const z = zombieAt(s, G.CENTER.x + G.hqSafeRadius(s) + 30, G.CENTER.y);
  z.speed = 80;
  stepFor(s, 5);
  assert.ok(G.dist(z.x, z.y, G.CENTER.x, G.CENTER.y) >= G.hqSafeRadius(s) + z.r - 0.01);
});

test('군사 구역에 맨주먹으로 서 있으면 위험하다(난이도가 거리로 오른다)', () => {
  const s = fresh(11);
  s.autoHunt = false;
  const a = Math.PI / 4, r = 4.6 * G.ZONE_SIZE;
  s.player.x = G.CENTER.x + Math.cos(a) * r; s.player.y = G.CENTER.y + Math.sin(a) * r;
  stepFor(s, 90);
  assert.ok(s.stats.deaths >= 1);
  assert.ok(G.zombieStats('butcher', 4.5).hp > G.zombieStats('butcher', 0.5).hp * 5);
});

test('동료: 방어 배치는 감시탑 레벨 + 1명까지', () => {
  const s = rich(fresh(12));
  s.survivors.push(G.makeSurvivor(s), G.makeSurvivor(s));
  const [a, b] = s.survivors;
  assert.equal(G.setPost(s, a.id, 'defense').ok, true);
  assert.equal(G.setPost(s, b.id, 'defense').ok, false, '감시탑 0레벨이면 1명');
  G.buyBuilding(s, 'watchtower'); finish(s);
  assert.equal(G.setPost(s, b.id, 'defense').ok, true);
  assert.equal(G.defenders(s).length, 2);
});

test('감시탑 완공: 생산 근무 동료 1명을 원거리 사격 > 근거리 > 기타 순으로 방벽에 자동 배치', () => {
  const s = rich(fresh(31)); s.hq = 9; // 감시탑 레벨 한도를 넉넉히
  const mk = (role, rarity, post = 'work') => { const v = G.makeSurvivor(s); Object.assign(v, { role, rarity, post }); s.survivors.push(v); return v; };
  mk('medic', 0, 'defense'); // 기본 1자리는 이미 찼다
  const eng = mk('engineer', 2), brw = mk('brawler', 2), gun = mk('gunner', 0), sct = mk('scout', 1), esc = mk('gunner', 2, 'explore');
  const build = () => { G.buyBuilding(s, 'watchtower'); return finish(s).find((e) => e.t === 'job-done'); };
  const order = [];
  for (let i = 0; i < 4; i++) { const e = build(); order.push(e.posted?.name); }
  // 원거리끼리는 화력(전투력 × 공격 × 공속)이 큰 정찰병(희귀)이 일반 사수보다 먼저, 영웅 근접전사·기술자는 그 뒤
  assert.deepEqual(order, [sct.name, gun.name, brw.name, eng.name]);
  assert.equal(esc.post, 'explore', '탐험 동행은 데려가지 않는다');
  assert.equal(G.defenders(s).length, 5);
  const e = build();
  assert.equal(e.posted, undefined, '생산 근무 동료가 없으면 아무도 옮기지 않는다');
  assert.equal(G.defenders(s).length, 5);
});

test('동료: 탐험 동행은 본부 3레벨에 1명, 5레벨에 2명', () => {
  const s = rich(fresh(13));
  assert.deepEqual([1, 2, 3, 4, 5, 9].map((hq) => G.exploreSlots({ ...s, hq })), [0, 0, 1, 1, 2, 2]);
  s.bld.dorm = 1; // 정원 4
  s.survivors.push(G.makeSurvivor(s), G.makeSurvivor(s), G.makeSurvivor(s));
  const [a, b, c] = s.survivors;
  assert.equal(G.setPost(s, a.id, 'explore').ok, false, '본부 1레벨이면 잠김');
  s.hq = 3;
  assert.equal(G.setPost(s, a.id, 'explore').ok, true);
  assert.equal(G.setPost(s, b.id, 'explore').ok, false, '본부 3레벨이면 1명');
  s.hq = 5;
  assert.equal(G.setPost(s, b.id, 'explore').ok, true);
  assert.equal(G.setPost(s, c.id, 'explore').ok, false, '최대 2명');
  assert.equal(G.setPost(s, a.id, 'work').ok, true);
  assert.equal(G.setPost(s, c.id, 'explore').ok, true, '자리가 비면 다시 보낼 수 있다');
  assert.deepEqual(G.escorts(s).map((v) => v.id), [b.id, c.id]);
  assert.equal(G.workBonus(s) > 0, true, '생산 근무만 생산 보너스');
  assert.equal(G.setPost(s, a.id, 'nap').ok, false);
  // 저장 후 본부 레벨보다 많은 동행은 생산으로 돌린다
  const t = G.deserialize(G.serialize({ ...s, hq: 3 }));
  assert.equal(G.escorts(t).length, 1);
  assert.equal(t.survivors.filter((v) => v.post === 'work').length, 2);
});

test('동료 능력치: 방어 화력 = 전투력 × 공격 × 공속(× 감시탑), 사거리는 방벽 자리에서, 생산 = 기본 × (1 + 생산% 합)', () => {
  const s = fresh(16);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; s.raidT = 1e9;
  s.bld.watchtower = 2;
  const v = G.makeSurvivor(s); Object.assign(v, { role: 'gunner', rarity: 2, lv: 6, post: 'defense' }); s.survivors.push(v);
  // 화면 값끼리 곱하면 실제 화력이 된다(공격에는 전투력이 들어 있지 않다)
  assert.equal(G.survivorAtk(v), G.ROLES.gunner.dmg * G.DEFENDER_DMG);
  assert.equal(G.survivorHit(v), G.survivorPower(v) * G.survivorAtk(v));
  const post = G.postPosition(s, 0, 1), out = { x: post.x - G.CENTER.x, y: post.y - G.CENTER.y }, k = Math.hypot(out.x, out.y);
  const at = (d) => ({ x: post.x + (out.x / k) * (d + 11), y: post.y + (out.y / k) * (d + 11) }); // 좀비 반지름 11
  s.player.x = G.CENTER.x - (post.x - G.CENTER.x); s.player.y = G.CENTER.y - (post.y - G.CENTER.y); // 반대편 안전지대
  const R = G.ROLES.gunner.range;
  const farP = at(R + 5), far = zombieAt(s, farP.x, farP.y, 1e9);
  const ev = []; for (let t = 0; t < 3; t += DT) ev.push(...G.step(s, DT));
  assert.equal(far.hp, 1e9, '사거리 밖(자리에서 +5)은 못 쏜다');
  s.zombies = [];
  const nearP = at(R - 5), near = zombieAt(s, nearP.x, nearP.y, 1e9);
  const ev2 = []; for (let t = 0; t < 10; t += DT) ev2.push(...G.step(s, DT));
  const shots = ev2.filter((e) => e.who === 'post').length, base = G.survivorHit(v) * G.defenseMult(s);
  assert.ok(Math.abs(shots - 10 * G.survivorRate(v)) <= 1.5, `공속대로 쏜다 (${shots}발 / 10초)`);
  for (const e of ev2.filter((x) => x.t === 'dmg')) assert.ok(Math.abs(e.dmg - base) < 1e-9 || Math.abs(e.dmg - base * G.CRIT_MULT) < 1e-9, `한 발 피해 = 전투력 × 공격 × 감시탑 (${e.dmg})`);
  assert.ok(near.hp < 1e9);
  // 생산: 생산 동료 +n%를 더해 기본에 곱한다
  const a = G.makeSurvivor(s), b = G.makeSurvivor(s);
  Object.assign(a, { role: 'engineer', rarity: 1, lv: 3, post: 'work' }); Object.assign(b, { role: 'scout', rarity: 0, lv: 1, post: 'work' });
  s.bld.scrapyard = 2;
  const base0 = G.productionPerSec(s).scrap;
  s.survivors.push(a, b);
  assert.ok(Math.abs(G.productionPerSec(s).scrap - base0 * (1 + G.survivorWork(a) + G.survivorWork(b))) < 1e-12);
});

test('동료: 배치 리셋은 모두 생산으로 돌리고 자리를 비운다', () => {
  const s = fresh(15);
  s.hq = 5; s.bld.dorm = 1;
  s.survivors.push(G.makeSurvivor(s), G.makeSurvivor(s), G.makeSurvivor(s));
  const [a, b] = s.survivors;
  assert.equal(G.resetPosts(s).ok, false, '모두 생산이면 할 일 없음');
  G.setPost(s, a.id, 'defense'); G.setPost(s, b.id, 'explore');
  stepFor(s, 0.5);
  assert.ok(s.posts[a.id] && s.posts[b.id]);
  const r = G.resetPosts(s);
  assert.equal(r.ok, true);
  assert.match(r.msg, /2명/);
  assert.ok(s.survivors.every((v) => v.post === 'work'));
  assert.equal(G.defenders(s).length + G.escorts(s).length, 0);
  assert.equal(s.posts[a.id] ?? s.posts[b.id], undefined, '방벽·동행 자리 정보도 지운다');
  assert.equal(G.setPost(s, b.id, 'explore').ok, true, '리셋 뒤 다시 보낼 수 있다');
});

test('동료: 탐험 동행은 플레이어를 따라다니며 좀비를 공격하고 경험치 절반을 준다', () => {
  const s = fresh(14);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; s.hq = 3;
  const v = G.makeSurvivor(s); v.role = 'gunner'; v.rarity = 2; v.lv = 8; s.survivors.push(v);
  assert.equal(G.setPost(s, v.id, 'explore').ok, true);
  s.player.x = G.CENTER.x + 900; s.player.y = G.CENTER.y;
  stepFor(s, 0.2);
  stepFor(s, 3, { x: 0, y: 1 }); // 플레이어가 아래로 걸어간다
  const c = s.posts[v.id], P = s.player;
  assert.ok(G.dist(c.x, c.y, P.x, P.y) < 80, `동료가 뒤따른다 (${G.dist(c.x, c.y, P.x, P.y).toFixed(0)})`);
  assert.ok(c.y < P.y, '뒤에서 따라온다');
  // 플레이어 주먹은 닿지 않고 동료 사거리에는 드는 좀비
  const z = zombieAt(s, P.x, P.y - 130, 1);
  const xp0 = s.xp, lv0 = s.level;
  stepFor(s, 3);
  assert.equal(s.zombies.includes(z), false, '동료가 처치');
  assert.ok(s.xp > xp0 || s.level > lv0, '동료 처치 경험치');
  assert.equal(Math.round(G.zombieXp(z) * G.ESCORT_XP) > 0, true);
});

test('조난자: 다가가면 합류하고, 빈 방어 자리에 먼저 배치된다', () => {
  const s = fresh(17);
  s.autoHunt = false; s.spawnT = 1e9;
  s.player.x = 900; s.player.y = 900;
  s.rescue = { kind: 'stranded', x: 905, y: 900, d: 1.5, ttl: 240 };
  G.step(s, DT);
  assert.equal(s.survivors.length, 1);
  assert.equal(s.survivors[0].post, 'defense');
  assert.equal(s.rescue, null);
});

test('포위된 생존자: 주변 좀비를 다 잡아야 합류, 시간이 다 되면 실패', () => {
  const s = rich(fresh(18));
  s.autoHunt = false; s.spawnT = 1e9;
  s.player.x = 900; s.player.y = 900;
  s.rescue = { kind: 'siege', x: 960, y: 900, d: 1.5, ttl: G.SIEGE_HOLD_S };
  const z = zombieAt(s, 1010, 900, 30); z.siege = true;
  G.step(s, DT);
  assert.equal(s.survivors.length, 0, '포위 좀비가 남아 있으면 합류하지 않는다');
  G.gainWeapon(s, 'rifle'); G.equipWeapon(s, 'rifle'); s.ammo = 20;
  stepFor(s, 3);
  assert.equal(s.survivors.length, 1);

  const t = fresh(19);
  t.auto = false; t.spawnT = 1e9;
  t.player.x = 300; t.player.y = 300;
  t.rescue = { kind: 'siege', x: 1200, y: 1200, d: 1.5, ttl: 2 };
  zombieAt(t, 1250, 1200).siege = true;
  stepFor(t, 3);
  assert.equal(t.rescue, null);
  assert.equal(t.survivors.length, 0);
});

test('습격: 방어가 없으면 방벽이 뚫려 창고 자원 20%를 잃는다', () => {
  const s = fresh(20);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.hq = 3;
  Object.assign(s.res, { scrap: 1000, wood: 1000, plastic: 1000 });
  s.player.x = 200; s.player.y = 200; // 플레이어는 멀리 있다
  s.raidT = 0.01;
  stepFor(s, 120);
  assert.equal(s.stats.raidsLost, 1);
  assert.ok(s.res.scrap < 850 && s.res.scrap > 700, `scrap ${s.res.scrap}`);
  assert.ok(!s.zombies.some((z) => z.raid));
});

test('습격: 방어 동료가 강하면 막아 내고 보상을 받는다', () => {
  const s = fresh(21);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.hq = 2; s.bld.watchtower = 2; s.bld.barricade = 2; s.wall = G.wallMax(s);
  for (let i = 0; i < 3; i++) { const v = G.makeSurvivor(s); v.role = 'gunner'; v.rarity = 2; v.lv = 8; v.post = 'defense'; s.survivors.push(v); }
  s.player.x = 200; s.player.y = 200;
  s.raidT = 0.01;
  const scrap = s.res.scrap;
  stepFor(s, 120);
  assert.equal(s.stats.raidsWon, 1);
  assert.equal(s.stats.raidsLost, 0);
  assert.ok(s.res.scrap > scrap);
});

test('생존자: 남녀 × 젊은·중년 4명, 추천 이름이나 직접 입력한 이름으로 판을 시작하고 저장된다', () => {
  assert.deepEqual(Object.keys(G.HEROES), ['youngM', 'oldM', 'youngF', 'oldF']);
  for (const h of Object.values(G.HEROES)) assert.ok(h.names.length >= 4 && h.label && h.age);
  const s = fresh(190);
  assert.equal(s.hero, null, '새 판은 고르기 전');
  assert.equal(G.setHero(s, 'elder', '누구').ok, false, '없는 생존자');
  assert.equal(G.setHero(s, 'oldF', '   ').ok, false, '빈 이름');
  const r = G.setHero(s, 'oldF', '  <미경>\u0007 ');
  assert.equal(r.ok, true);
  assert.deepEqual(s.hero, { id: 'oldF', name: '미경', runId: String(s.seed) }, '앞뒤 공백·꺾쇠·제어 문자를 지운다');
  assert.equal(G.cleanName('가나다라마바사아자차카타').length, G.HERO_NAME_MAX, '최대 10자');
  // 저장·불러오기
  const t = G.deserialize(G.serialize(s));
  assert.deepEqual(t.hero, s.hero);
  // 잘못된 저장값은 버린다
  const o = JSON.parse(G.serialize(s)); o.hero = { id: 'ghost', name: 'x' };
  assert.equal(G.deserialize(JSON.stringify(o)).hero, null);
  // 판마다 다른 번호(시드)
  const u = fresh(191); G.setHero(u, 'youngM', '민준');
  assert.notEqual(u.hero.runId, s.hero.runId);
});

test('엔딩: 목표 8개 중 3개 이상, 그중 필수(기지·동료·전진기지) 1개 이상이면 한 번 뜨고 이어서 할 수 있다', () => {
  assert.equal(G.ENDING_GOALS.length, 8);
  assert.deepEqual(G.ENDING_GOALS.filter((g) => g.req).map((g) => g.id), ['hq', 'crew', 'network']);
  const s = fresh(180);
  s.spawnT = 1e9; s.rescueT = 1e9; s.raidT = 1e9; s.autoHunt = false;
  const run = () => { const ev = []; for (let k = 0; k < 3; k++) ev.push(...G.step(s, DT)); return ev.filter((e) => e.t === 'ending'); };
  // 서브 목표만 3개: 엔딩 아님
  s.stats.militaryLoot = 200; s.stats.raidsWon = 25; s.level = 45;
  assert.equal(G.endingStatus(s).count, 3);
  assert.equal(G.endingStatus(s).reached, false, '필수 목표가 없으면 아니다');
  assert.equal(run().length, 0);
  // 필수 하나(전진기지 4곳 모두 3레벨) — 3레벨이 아니면 세지 않는다
  s.outposts = [0, 1, 2, 3].map((site) => ({ site, lv: 2 }));
  assert.equal(G.goalDone(s, G.ENDING_GOALS[2]), false);
  s.outposts.forEach((o) => { o.lv = 3; });
  const ev = run();
  assert.equal(ev.length, 1, '엔딩 이벤트');
  assert.deepEqual(ev[0].goals.sort(), ['fortress', 'military', 'network', 'veteran']);
  assert.ok(s.ended && s.ended.at >= 0);
  assert.equal(run().length, 0, '한 번만 뜬다');
  assert.equal(s.over, null, '게임은 이어진다');
  // 저장해도 엔딩 상태가 남아 다시 뜨지 않는다
  const t = G.deserialize(G.serialize(s));
  assert.deepEqual(t.ended, s.ended);
  // 필수 2개 + 서브 1개도 엔딩
  const u = fresh(181); u.spawnT = 1e9; u.rescueT = 1e9; u.raidT = 1e9;
  u.hq = 9; u.bld.dorm = 9; for (let i = 0; i < 20; i++) u.survivors.push(G.makeSurvivor(u)); u.weapons.pipe = G.WEAPON_MAX_LV;
  assert.deepEqual(G.endingStatus(u).done.map((g) => g.id), ['hq', 'crew', 'master']);
  assert.equal(G.endingStatus(u).reached, true);
  // 상급 처치 수는 상급(거구·학살자)만 센다
  const w = fresh(182); w.spawnT = 1e9; w.rescueT = 1e9; w.raidT = 1e9; w.autoHunt = false;
  for (const type of ['hulk', 'slayer', 'butcher', 'runner']) { const z = zombieAt(w, w.player.x + 300, w.player.y, 1); z.type = type; z.hp = 0; }
  G.step(w, DT);
  assert.equal(w.stats.eliteKills, 2);
});

test('좀비 3등급 6종: 강점 하나·약점 하나, 등급마다 강점 ×2·약점 ×½, 같은 등급 두 종은 강점·약점이 다르다', () => {
  const types = Object.entries(G.ZTYPES), stat = ['hp', 'dmg', 'spd'];
  assert.equal(types.length, 6);
  for (let g = 0; g < 3; g++) {
    const [a, b] = G.ZTYPES_BY_GRADE[g].map((k) => G.ZTYPES[k]);
    assert.equal(G.ZTYPES_BY_GRADE[g].length, 2, `${G.ZGRADES[g].name} 2종`);
    const st = (t) => G.ZSTYLES[t.style];
    assert.notEqual(st(a).strong, st(b).strong, '강점이 다르다'); assert.notEqual(st(a).weak, st(b).weak, '약점이 다르다');
    for (const t of [a, b]) {
      const up = stat.filter((k) => t[k] > 1), down = stat.filter((k) => t[k] < 1);
      assert.deepEqual([up, down], [[st(t).strong], [st(t).weak]], `${t.name}: 강점 하나·약점 하나`);
      assert.equal(t[st(t).strong], 1 + 0.5 * 2 ** g, `${t.name} 강점`);
      assert.equal(t[st(t).weak], 1 - 0.5 / 2 ** g, `${t.name} 약점`);
    }
  }
  // 같은 유형의 위 등급: 강점 보너스 2배 이상, 약점 페널티는 줄어든다(바로 위 등급이면 ×2·25%)
  assert.deepEqual([G.ZTYPES.sprinter.spd - 1, 1 - G.ZTYPES.sprinter.hp], [2 * (G.ZTYPES.runner.spd - 1), 0.25]);
  assert.deepEqual([G.ZTYPES.slayer.dmg - 1, 1 - G.ZTYPES.slayer.spd], [2 * (G.ZTYPES.butcher.dmg - 1), 0.125]);
  // 덩치·속도·공격 간격이 강점을 따른다
  assert.ok(G.ZTYPES.hulk.r > G.ZTYPES.bloater.r && G.ZTYPES.bloater.r > G.ZTYPES.runner.r);
  assert.ok(G.zombieStats('sprinter', 3).speed > G.zombieStats('butcher', 3).speed);
  assert.equal(G.zombieStats('sprinter', 3).atkCd, G.ZOMBIE_ATK_CD / 2, '속도 ×2면 공격 간격 절반');
  // 출현: 주택가는 하급만, 구역 비율대로 뽑는다
  const s = fresh(170), count = { 0: 0, 1: 0, 2: 0 };
  for (let i = 0; i < 3000; i++) count[G.ZTYPES[G.pickZombieType(s, 6.5)].grade]++;
  assert.ok(Math.abs(count[2] / 3000 - 0.45) < 0.04 && Math.abs(count[0] / 3000 - 0.15) < 0.04, JSON.stringify(count));
  for (let i = 0; i < 200; i++) assert.equal(G.ZTYPES[G.pickZombieType(s, 1.4)].grade, 0);
  // 공격 간격대로 때린다: 질주자는 0.6초마다
  const t = fresh(171); t.spawnT = 1e9; t.rescueT = 1e9; t.autoHunt = false; t.raidT = 1e9;
  t.player.x = 1000; t.player.y = 1000; t.player.hp = 1e6;
  t.weapons = { fist: 1 }; t.equip = { melee: 'fist', gun: null };
  const z = { ...G.zombieStats('sprinter', 1), id: 1, type: 'sprinter', x: 1010, y: 1000, max: 1e9, d: 1, atk: 0, wa: 0, wt: 99, hit: 0 }; z.hp = 1e9; z.speed = 0;
  t.zombies.push(z);
  const ev = []; for (let k = 0; k < 90; k++) ev.push(...G.step(t, DT)); // 3초
  const hits = ev.filter((e) => e.t === 'hurt').length;
  assert.ok(hits >= 5 && hits <= 6, `3초에 ${hits}번`);
});

test('습격 편성은 The Last Spark 공식과 같은 모양으로 커진다', () => {
  // [하급, 중급, 상급] 수(예전 워커·러너·브루트 수와 같은 식)
  assert.deepEqual(G.raidComposition(1), [4, 0, 0]);
  assert.deepEqual(G.raidComposition(60), [25, 10, 10]);
  assert.ok(G.raidComposition(30)[0] > G.raidComposition(12)[0]);
});

test('저장 → 불러오기 왕복, 깨진 저장은 거부', () => {
  const s = rich(fresh(14));
  G.upgradeHq(s); finish(s); G.upgradeHq(s); finish(s);
  G.buyBuilding(s, 'dorm'); finish(s);
  s.survivors.push({ ...G.makeSurvivor(s), post: 'defense' });
  s.player.x = 1000; s.bag.wood = 7;
  const t = G.deserialize(G.serialize(s));
  assert.equal(t.hq, 3);
  assert.equal(t.bld.dorm, 1);
  assert.equal(t.survivors.length, 1);
  assert.equal(t.survivors[0].post, 'defense');
  assert.equal(t.player.x, 1000);
  assert.equal(t.bag.wood, 7);
  assert.equal(G.deserialize('{oops'), null);
  assert.equal(G.deserialize(JSON.stringify({ v: 999, seed: 1 })), null);
  const bad = JSON.parse(G.serialize(s));
  bad.res.scrap = 'NaN'; bad.hq = 99; bad.outposts = [{ site: 0 }, { site: 0 }, { site: 42 }];
  const u = G.deserialize(JSON.stringify(bad));
  assert.ok(Number.isFinite(u.res.scrap));
  assert.equal(u.hq, G.HQ_MAX);
  assert.equal(u.outposts.length, 1);
});

test('오프라인 보상: 생산은 30분어치까지만, 작업 타이머는 8시간까지 흐르고, 가방은 창고로 들어간다', () => {
  const s = fresh(15);
  s.bld.scrapyard = 2;
  s.bag.scrap = 10;
  // 20분 쉬면 20분어치 그대로
  const short = G.applyOffline(s, s.savedAt + 20 * 60 * 1000);
  assert.equal(short.prodS, 20 * 60);
  assert.ok(Math.abs(short.gains.scrap - (G.productionPerSec(s).scrap * 20 * 60 + 10)) < 1e-6);
  // 오래 쉬어도 30분어치에서 멈춘다(8시간·48시간 같음)
  const t = rich(fresh(15)); t.bld.scrapyard = 2; t.bld.ammo = 1; t.hq = 2; t.ammo = 0;
  const u = rich(fresh(15)); u.bld.scrapyard = 2; u.bld.ammo = 1; u.hq = 2; u.ammo = 0;
  G.buyBuilding(t, 'sawmill'); // 오래 걸리는 작업 하나
  const rt = G.applyOffline(t, t.savedAt + 8 * 3600 * 1000), ru = G.applyOffline(u, u.savedAt + 48 * 3600 * 1000);
  assert.equal(G.OFFLINE_PROD_CAP_S, 30 * 60);
  assert.equal(rt.elapsed, G.OFFLINE_CAP_S); assert.equal(rt.prodS, G.OFFLINE_PROD_CAP_S);
  assert.ok(Math.abs(rt.gains.scrap - G.productionPerSec(t).scrap * G.OFFLINE_PROD_CAP_S) < 1e-6);
  assert.ok(Math.abs(rt.gains.scrap - ru.gains.scrap) < 1e-6, '8시간이나 48시간이나 같다');
  assert.equal(rt.ammo, Math.min(G.AMMO_MAX, Math.floor(G.ammoRateOf(t) * G.OFFLINE_PROD_CAP_S)), '총알 제작도 30분어치');
  assert.ok(rt.done.length === 1 && !G.laneJob(t, 'base'), '작업 타이머는 끝까지 흐른다');
  assert.equal(s.bag.scrap, 0);
  assert.equal(G.applyOffline(s, s.savedAt + 5000), null, '30초 미만은 무시');
  assert.ok(s.raidT >= 30 || !G.raidsEnabled(s), '습격은 자리를 비운 동안 오지 않는다');
  assert.equal(s.stats.raidsLost, 0);
});

test('목적지 이동: 손가락 입력이 들어오면 취소된다', () => {
  const s = fresh(16);
  s.autoHunt = false; s.spawnT = 1e9;
  G.travelTo(s, G.CENTER.x + 300, G.CENTER.y);
  stepFor(s, 1.5);
  assert.ok(s.player.x > G.CENTER.x + 100);
  G.step(s, DT, { x: 0, y: 1 });
  assert.equal(s.waypoint, null);
});

test('좀비 전략(자동사냥): 공격적만 반경 안 좀비를 찾아가고, 활동 반경 밖 좀비는 쫓지 않는다', () => {
  const s = fresh(40);
  s.spawnT = 1e9; s.rescueT = 1e9;
  s.player.x = G.CENTER.x + 500; s.player.y = G.CENTER.y; // 주택가(위험도 1.3)
  const z = zombieAt(s, G.CENTER.x + 600, G.CENTER.y);
  assert.equal(s.stance, 'neutral', '새 게임은 중립적');
  G.setStance(s, 'aggressive');
  assert.equal(s.autoZone, 1, '기본 활동 반경은 주택가까지');
  assert.equal(G.inActivityRadius(s, z.x, z.y), true);
  assert.equal(G.chooseAutoTarget(s).ref, z);
  // 활동 반경을 기지 주변으로 줄이면 주택가 좀비는 쫓지 않는다
  s.autoZone = 0;
  assert.equal(G.inActivityRadius(s, z.x, z.y), false);
  assert.equal(G.chooseAutoTarget(s), null);
  s.autoZone = 1;
  assert.equal(G.setStance(s, 'neutral').ok, true);
  assert.equal(G.chooseAutoTarget(s), null, '중립적이면 제자리');
  assert.equal(G.setStance(s, 'nope').ok, false);
  assert.deepEqual([1, 2, 3].map(() => (G.cycleStance(s), s.stance)), ['evasive', 'aggressive', 'neutral']);
});

test('새 게임 기본값: 자동사냥 켬 · 좀비 전략 중립적 · 총기 끔, 첫 총을 얻으면 총기 켬', () => {
  const s = rich(fresh(42));
  assert.deepEqual([s.autoHunt, s.stance, s.gunOn], [true, 'neutral', false]);
  const gun = Object.keys(G.WEAPONS).find((k) => G.WEAPONS[k].kind === 'gun');
  G.gainWeapon(s, gun);
  assert.equal(s.gunOn, true, '첫 총');
  G.setSwitch(s, 'gunOn', false);
  const gun2 = Object.keys(G.WEAPONS).filter((k) => G.WEAPONS[k].kind === 'gun')[1];
  G.gainWeapon(s, gun2);
  assert.equal(s.gunOn, false, '이미 총이 있으면 직접 끈 설정을 바꾸지 않는다');
});

test('좀비 전략: 회피는 다가오는 좀비를 피하면서 공격 반경 안 좀비를 공격, 중립은 제자리에서 공격', () => {
  const s = fresh(41);
  s.spawnT = 1e9; s.rescueT = 1e9;
  G.gainWeapon(s, 'pistol'); G.equipWeapon(s, 'pistol'); s.ammo = 40;
  const x0 = G.CENTER.x + 500, y0 = G.CENTER.y;
  s.player.x = x0; s.player.y = y0;
  const z = zombieAt(s, x0 + 120, y0, 1e9); z.speed = 40;
  G.setStance(s, 'evasive');
  const d0 = G.dist(s.player.x, s.player.y, z.x, z.y);
  stepFor(s, 1);
  assert.ok(G.dist(s.player.x, s.player.y, z.x, z.y) > d0, '회피: 거리가 벌어진다');
  assert.ok(s.player.mag < G.WEAPONS.pistol.mag, '회피: 공격 반경(권총 사거리) 안 좀비를 쏜다');
  // 중립: 좀비가 다가와도 제자리에 서서 공격한다
  G.setStance(s, 'neutral');
  const x1 = s.player.x, y1 = s.player.y, mag = s.player.mag + s.ammo, hp0 = z.hp;
  z.x = x1 + 150; z.y = y1;
  stepFor(s, 1);
  assert.ok(G.dist(s.player.x, s.player.y, x1, y1) < 1, '중립: 움직이지 않는다');
  assert.ok(s.player.mag + s.ammo < mag || z.hp < hp0, '중립: 공격한다');
  // 공격: 좀비를 향해 다가간다
  G.setStance(s, 'aggressive');
  const d2 = G.dist(s.player.x, s.player.y, z.x, z.y);
  stepFor(s, 0.5);
  assert.ok(G.dist(s.player.x, s.player.y, z.x, z.y) < d2, '공격: 다가간다');
  assert.equal(G.STANCES.evasive.name, '회피적');
});

test('귀환: 가장 가까운 기지(경계까지 거리)로 걸어가 안에 들어서면 멈추고, 가는 길에 좀비를 쫓지 않는다', () => {
  const s = rich(fresh(120));
  s.spawnT = 1e9; s.rescueT = 1e9; s.raidT = 1e9;
  s.hq = 2;
  const site = s.sites[0];
  s.outposts.push({ site: 0, lv: 1 });
  // 전진기지 바로 바깥: 전진기지가 더 가깝다
  s.player.x = site.x + G.OUTPOST_SAFE_R + 60; s.player.y = site.y;
  let r = G.returnToBase(s);
  assert.equal(r.ok, true); assert.match(r.msg, new RegExp(site.name));
  assert.equal(s.waypoint.home, true);
  const z = zombieAt(s, s.player.x + 60, s.player.y + 80, 1e9); z.speed = 0; // 공격적이어도 쫓지 않는다
  for (let i = 0; i < 30 * 6 && s.waypoint; i++) G.step(s, DT);
  assert.equal(s.waypoint, null);
  assert.equal(G.safeZoneAt(s, s.player.x, s.player.y)?.kind, 'outpost', '전진기지 안에 들어서면 멈춘다');
  r = G.returnToBase(s);
  assert.equal(r.ok, false, '이미 기지 안');
  // 본부 쪽이 더 가까우면 본부로
  s.zombies = [];
  s.player.x = G.CENTER.x - G.hqSafeRadius(s) - 50; s.player.y = G.CENTER.y;
  r = G.returnToBase(s);
  assert.equal(r.msg, '본부로 귀환해요');
  assert.deepEqual(['본부', '버려진 편의점', '시립 병원', '물류 창고'].map(G.roParticle), ['로', '으로', '으로', '로']);
  // 손가락으로 움직이면 취소된다
  G.step(s, DT, { x: 0, y: 1 });
  assert.equal(s.waypoint, null);
});

test('파밍은 수동: 자동사냥이 켜져 있어도 대상물을 찾아가지 않고, 옆에 서 있으면 줍는다', () => {
  const s = fresh(44);
  s.spawnT = 1e9; s.rescueT = 1e9;
  assert.equal(s.autoFarm, undefined, '파밍 스위치는 없다');
  assert.equal(G.FARM_MODES, undefined, '자원 파밍 설정도 없다');
  const node = s.nodes.find((n) => n.d > 1.2 && n.d < 1.8);
  s.player.x = node.x - 120; s.player.y = node.y;
  stepFor(s, 2);
  assert.ok(Math.abs(s.player.x - (node.x - 120)) < 1, '대상물이 있어도 찾아가지 않고 서 있다');
  s.player.x = node.x; s.player.y = node.y;
  const ev = []; for (let t = 0; t < G.LOOT_TYPES[node.type].time + 0.2; t += DT) ev.push(...G.step(s, DT));
  assert.ok(ev.some((e) => e.t === 'loot'), '옆에 서 있으면 줍는다');
  // 가방이 가득 차도 저절로 창고로 가지 않는다(체력 위급·습격·무기 수리 때만 돌아간다)
  s.bag.wood = G.bagCap(s); s.player.x = G.CENTER.x + 700; s.player.y = G.CENTER.y;
  assert.equal(G.chooseAutoTarget(s), null);
});

test('스위치: 자동사냥을 끄면 저절로 움직이지 않고 손가락 입력으로만 움직인다', () => {
  const s = fresh(46);
  s.spawnT = 1e9; s.rescueT = 1e9;
  const x0 = G.CENTER.x + 500, y0 = G.CENTER.y;
  s.player.x = x0; s.player.y = y0;
  const z = zombieAt(s, x0 + 150, y0);
  assert.equal(G.setSwitch(s, 'autoHunt', false).ok, true);
  assert.equal(G.setSwitch(s, 'autoFarm', true).ok, false, '파밍 스위치는 없다');
  z.speed = 0;
  stepFor(s, 1);
  assert.ok(G.dist(s.player.x, s.player.y, x0, y0) < 1, '수동이면 서 있다');
  G.step(s, DT, { x: 0, y: -1 });
  assert.ok(s.player.y < y0, '손가락 입력으로는 움직인다');
  G.setSwitch(s, 'autoHunt', true); G.setStance(s, 'aggressive');
  assert.equal(G.chooseAutoTarget(s).ref, z, '자동사냥을 켜면(공격적) 반경 안 좀비에게 반응한다');
});

test('장애물: 겹치지 않게 배치되고, 통과할 수 없으며, 자동 이동은 돌아간다', () => {
  const s = G.newGame(50);
  assert.ok(s.obstacles.length >= 150);
  assert.ok(new Set(s.obstacles.map((o) => o.type)).size >= 6);
  for (const o of s.obstacles) {
    assert.ok(G.dist(o.x, o.y, G.CENTER.x, G.CENTER.y) >= 440, '본부 주변은 비운다');
    assert.ok(!s.nodes.some((n) => G.dist(o.x, o.y, n.x, n.y) < o.r + 34), '대상물을 막지 않는다');
    assert.ok(!s.sites.some((t) => G.dist(o.x, o.y, t.x, t.y) < 150), '전진기지 후보지를 막지 않는다');
    assert.ok(!G.LOOT_TYPES[o.type], '장애물은 파밍 대상이 아니다');
  }
  assert.ok(s.obstacles.every((o) => s.obstacles.every((q) => q === o || G.dist(o.x, o.y, q.x, q.y) >= o.r + q.r + 40)), '사이로 지나갈 틈이 있다');
  // 장애물 하나만 둔 판에서 충돌과 우회를 본다
  const t = fresh(51);
  const o = { x: 1000, y: 1000, type: 'container', r: G.OBSTACLE_TYPES.container.r, rot: 0 };
  G.setObstacles(t, [o]);
  t.autoHunt = false; t.spawnT = 1e9; t.rescueT = 1e9;
  runCollision(t, o);
});

function runCollision(s, o) {
  s.player.x = o.x - o.r - 40; s.player.y = o.y;
  let minD = Infinity;
  for (let t = 0; t < 2; t += DT) { G.step(s, DT, { x: 1, y: 0 }); minD = Math.min(minD, G.dist(s.player.x, s.player.y, o.x, o.y)); }
  assert.ok(minD >= o.r + 10 - 0.5, '밀고 들어가도 뚫지 못한다');
  s.player.x = o.x - o.r - 70; s.player.y = o.y;
  G.travelTo(s, o.x + o.r + 70, o.y);
  stepFor(s, 6);
  assert.equal(s.waypoint, null, '장애물을 돌아 목적지에 닿는다');
  const z = zombieAt(s, o.x + o.r + 40, o.y); z.speed = 60;
  s.player.x = o.x - o.r - 60; s.player.y = o.y;
  stepFor(s, 2);
  assert.ok(G.dist(z.x, z.y, o.x, o.y) >= o.r + z.r - 0.5, '좀비도 뚫지 못한다');
}

test('자동사냥·좀비 전략·활동 반경은 저장되고, 예전 세이브의 파밍 값은 버린다', () => {
  const s = G.newGame(42);
  G.setStance(s, 'evasive'); G.setSwitch(s, 'autoHunt', false); s.autoZone = 3;
  const t = G.deserialize(G.serialize(s));
  assert.equal(t.stance, 'evasive');
  assert.equal(t.autoHunt, false);
  assert.equal(t.autoZone, 3);
  const bad = JSON.parse(G.serialize(s)); bad.stance = 'berserk'; bad.farm = 'passive'; bad.autoFarm = true;
  delete bad.autoHunt; bad.auto = false;
  const u = G.deserialize(JSON.stringify(bad));
  assert.equal(u.stance, 'neutral', '알 수 없는 전략은 새 게임 기본값(중립적)으로');
  assert.equal(u.autoHunt, false);
  assert.equal(u.autoFarm, undefined);
  assert.equal(u.farm, undefined);
});

test('성장: 요구 경험치는 레벨에 비례하고, 레벨업하면 체력이 모두 회복된다', () => {
  assert.equal(G.xpToNext(2), G.xpToNext(1) * 2);
  assert.equal(G.xpToNext(10), G.xpToNext(1) * 10);
  const s = fresh(60);
  s.player.hp = 30;
  const ev = [];
  assert.equal(G.gainXp(s, G.xpToNext(1) + G.xpToNext(2) + 5, ev), 2, '한 번에 두 레벨');
  assert.equal(s.level, 3);
  assert.equal(s.xp, 5);
  assert.equal(s.player.hp, G.maxHp(s), '체력 완전 회복');
  const ups = ev.filter((e) => e.t === 'levelup');
  assert.equal(ups.length, 2);
  assert.ok(Math.abs(G.maxHp(s) - 100 - (ups[0].hp + ups[1].hp)) < 1e-9, '최대 체력 = 기본 + 뽑은 상승치 합');
  assert.ok(Math.abs(G.levelAtkMult(s) - 1 - (ups[0].atk + ups[1].atk)) < 1e-9);
  s.weapons.pipe = 1;
  assert.ok(Math.abs(G.weaponDamage(s, 'pipe') - G.WEAPONS.pipe.atk * G.levelAtkMult(s)) < 1e-9, '공격력에 반영');
});

test('성장: 레벨당 상승치는 기준치 ±40% 안에서 균일 분포로 뽑힌다', () => {
  const hp = [], atk = [];
  for (let seed = 1; hp.length < 4000; seed++) {
    const s = fresh(1000 + seed);
    const ev = [];
    G.gainXp(s, 1e9, ev);
    for (const e of ev) if (e.t === 'levelup') { hp.push(e.hp / G.HP_PER_LEVEL); atk.push(e.atk / G.ATK_PER_LEVEL); }
  }
  for (const [name, xs] of [['체력', hp], ['공격력', atk]]) {
    assert.ok(Math.min(...xs) >= 0.6 - 1e-12 && Math.max(...xs) <= 1.4 + 1e-12, `${name}: 범위 0.6~1.4배`);
    const mean = xs.reduce((a, v) => a + v, 0) / xs.length;
    assert.ok(Math.abs(mean - 1) < 0.02, `${name}: 평균 ${mean.toFixed(3)}배`);
    // 0.6~1.4를 4칸으로 나누면 칸마다 약 25%
    const bins = [0, 0, 0, 0];
    for (const v of xs) bins[Math.min(3, Math.floor((v - 0.6) / 0.2))]++;
    for (const b of bins) assert.ok(Math.abs(b / xs.length - 0.25) < 0.03, `${name}: 칸 비율 ${bins.map((x) => (x / xs.length).toFixed(3))}`);
  }
});

test('성장: 플레이어가 잡은 좀비만 경험치를 주고, 방어 동료가 잡은 좀비는 주지 않는다', () => {
  const s = fresh(61);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.player.x = 900; s.player.y = 900;
  const z = zombieAt(s, 920, 900, 1);
  stepFor(s, 0.6);
  assert.equal(s.stats.kills, 1);
  assert.equal(s.xp, G.zombieXp(z));
  // 본부 방벽 앞 좀비를 방어 동료가 잡는 경우
  const t = fresh(62);
  t.autoHunt = false; t.spawnT = 1e9; t.rescueT = 1e9;
  t.player.x = G.CENTER.x; t.player.y = G.CENTER.y; // 본부 안: 맨주먹은 방벽 밖에 닿지 않는다
  const v = G.makeSurvivor(t); v.role = 'gunner'; v.post = 'defense'; t.survivors.push(v);
  zombieAt(t, G.CENTER.x, G.CENTER.y - G.hqSafeRadius(t) - 60, 1);
  stepFor(t, 1.5);
  assert.equal(t.stats.kills, 1);
  assert.equal(t.xp, 0);
});

test('치명타: 확률은 무기마다(동료는 10%), 피해는 평타의 2배', () => {
  assert.equal(G.CRIT_MULT, 2);
  assert.equal(G.COMPANION_CRIT, 0.1);
  const rateOf = (id, seed) => {
    const s = fresh(seed);
    s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
    s.player.x = 900; s.player.y = 900;
    G.gainWeapon(s, id); G.equipWeapon(s, id); s.dur[id] = 1e9; // 내구도는 넉넉히
    zombieAt(s, 920, 900, 1e12);
    const dmg = [];
    for (let i = 0; i < 6000; i++) for (const e of G.step(s, DT)) if (e.t === 'dmg') dmg.push(e);
    const crits = dmg.filter((e) => e.crit), normal = dmg.find((e) => !e.crit);
    assert.ok(Math.abs(crits[0].dmg - normal.dmg * 2) < 1e-9);
    return { rate: crits.length / dmg.length, n: dmg.length };
  };
  const saw = rateOf('chainsaw', 63), axe = rateOf('axe', 64);
  assert.ok(saw.n > 600 && Math.abs(saw.rate - G.WEAPONS.chainsaw.crit) < 0.02, `전기톱 ${saw.rate.toFixed(3)} (${saw.n}회)`);
  assert.ok(axe.n > 150 && Math.abs(axe.rate - G.WEAPONS.axe.crit) < 0.08, `소방 도끼 ${axe.rate.toFixed(3)} (${axe.n}회)`);
});

test('성장 상태(누적 상승치 포함)는 저장되고, 예전 세이브는 기준치로 채운다', () => {
  const s = fresh(64);
  G.gainXp(s, G.xpToNext(1) + G.xpToNext(2) + G.xpToNext(3) + 7);
  const t = G.deserialize(G.serialize(s));
  assert.equal(t.level, 4);
  assert.equal(t.xp, 7);
  assert.deepEqual(t.growth, s.growth);
  assert.equal(G.maxHp(t), G.maxHp(s));
  const old = JSON.parse(G.serialize(s)); delete old.growth;
  const u = G.deserialize(JSON.stringify(old));
  assert.equal(u.growth.hp, 3 * G.HP_PER_LEVEL);
  assert.ok(Math.abs(u.growth.atk - 3 * G.ATK_PER_LEVEL) < 1e-12);
  assert.equal(u.growth.bag, 3 * G.BAG_PER_LEVEL, '가방 상승치가 없던 세이브는 레벨당 10으로 채운다');
  const bad = JSON.parse(G.serialize(s)); bad.growth = { hp: 9999, atk: -5, bag: 500 };
  const w = G.deserialize(JSON.stringify(bad));
  assert.ok(w.growth.hp <= 3 * G.HP_PER_LEVEL * 1.4 && w.growth.atk >= 3 * G.ATK_PER_LEVEL * 0.6 - 1e-12, '범위를 넘는 값은 자른다');
  assert.ok(Math.abs(w.growth.bag - 3 * G.BAG_PER_LEVEL * 1.1) < 1e-9);
});

test('구조(회귀): 숙소가 가득 차면 구조가 막히고 근처에 있는 동안 계속 알리며, 숙소를 올리면 바로 합류한다', () => {
  const s = rich(fresh(70));
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.hq = 2; s.bld.dorm = 1;
  for (let i = 0; i < 4; i++) s.survivors.push(G.makeSurvivor(s)); // 대니님 세이브와 같은 4/4
  s.player.x = 900; s.player.y = 900;
  s.rescue = { kind: 'stranded', x: 940, y: 900, d: 1.5, ttl: 240 };
  const ev = []; for (let t = 0; t < 10; t += DT) ev.push(...G.step(s, DT));
  assert.equal(s.survivors.length, 4, '정원이 차서 합류하지 않는다');
  assert.ok(ev.filter((e) => e.t === 'dorm-full').length >= 2, '한 번만이 아니라 반복해서 알린다');
  const st = G.rescueStatus(s);
  assert.equal(st.full, true);
  assert.equal(st.near, true);
  assert.equal(G.buyBuilding(s, 'dorm').ok, true);
  G.step(s, DT);
  assert.equal(s.survivors.length, 4, '숙소 공사가 끝나기 전에는 아직 못 데려온다');
  finish(s);
  G.step(s, DT);
  assert.equal(s.survivors.length, 5, '숙소 공사가 끝나면 그 자리에서 합류');
  assert.equal(s.rescue, null);
});

test('구조: 숙소가 가득 차 있는 동안에는 새 구조 신호가 뜨지 않고 신호탄도 쓰지 않는다', () => {
  const s = fresh(71);
  s.autoHunt = false; s.spawnT = 1e9;
  s.survivors.push(G.makeSurvivor(s), G.makeSurvivor(s)); // 숙소 0레벨 정원 2
  s.rescueT = 0.1;
  stepFor(s, 30);
  assert.equal(s.rescue, null);
  s.items.flare = 1;
  const r = G.useItem(s, 'flare');
  assert.equal(r.ok, false);
  assert.match(r.msg, /숙소/);
  assert.equal(s.items.flare, 1, '실패하면 아이템이 그대로');
});

test('구조: 조난자는 60px 안에 들어가면 합류한다', () => {
  const s = fresh(72);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.player.x = 900; s.player.y = 900;
  s.rescue = { kind: 'stranded', x: 900 + G.RESCUE_R + 15, y: 900, d: 1.5, ttl: 240 };
  G.step(s, DT);
  assert.equal(s.survivors.length, 0, '조금 멀면 아직');
  s.rescue.x = 900 + 50;
  G.step(s, DT);
  assert.equal(s.survivors.length, 1);
});

test('구조: 포위 좀비가 멀리 끌려가면 포위에서 빠져 구출을 막지 않는다', () => {
  const s = fresh(73);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.player.x = 900; s.player.y = 900;
  s.rescue = { kind: 'siege', x: 960, y: 900, d: 1.5, ttl: G.SIEGE_HOLD_S };
  const far = zombieAt(s, 960 + G.SIEGE_LEASH_R + 50, 900); far.siege = true;
  assert.equal(G.rescueStatus(s).besiegers, 1);
  G.step(s, DT);
  assert.equal(far.siege, false);
  assert.equal(s.survivors.length, 1, '남은 포위 좀비가 없으니 합류');
});

test('리스폰: 큰 대상물일수록 늦고, 기지 근처는 느리고 바깥은 빠르며, 대상물마다 ±20% 안에서 다르다', () => {
  const R = G.RESPAWN_BY_SIZE;
  assert.ok(R.small < R.medium && R.medium < R.large);
  assert.ok(G.RESPAWN_ZONE_MULT[1] > G.RESPAWN_ZONE_MULT[2] && G.RESPAWN_ZONE_MULT[2] > G.RESPAWN_ZONE_MULT[3] && G.RESPAWN_ZONE_MULT[3] > G.RESPAWN_ZONE_MULT[4]);
  const s = G.newGame(80);
  const seen = new Set();
  for (const n of s.nodes) {
    const base = G.LOOT_TYPES[n.type].respawn * G.RESPAWN_ZONE_MULT[G.zoneIndex(n.d)];
    assert.ok(n.respawn >= Math.floor(base * 0.8) && n.respawn <= Math.ceil(base * 1.2), `${n.type}: ${n.respawn} vs ${base}`);
    seen.add(n.respawn);
  }
  assert.ok(seen.size > 30, '대상물마다 리스폰이 흩어져 한꺼번에 생기지 않는다');
  // 주운 대상물은 자기 리스폰 시간이 지나야 다시 생긴다
  const t = fresh(81);
  t.autoHunt = false; t.spawnT = 1e9; t.rescueT = 1e9;
  const n = t.nodes[0];
  t.player.x = n.x; t.player.y = n.y;
  stepFor(t, G.LOOT_TYPES[n.type].time + 0.2);
  assert.ok(n.readyAt > t.time, '주운 직후에는 비어 있다');
  assert.ok(Math.abs(n.readyAt - t.time - n.respawn) < G.LOOT_TYPES[n.type].time + 0.3);
  const back = G.deserialize(G.serialize(t));
  assert.ok(Math.abs(back.nodes[0].readyAt - back.time - (n.readyAt - t.time)) <= 1, '남은 리스폰 시간이 저장된다');
});

test('대상물 리스폰: 같은 구역 안 무작위 자리로 옮겨 다시 생기고, 구역별·종류별 수는 그대로이며 저장된다', () => {
  const s = G.newGame(91); // 장애물이 있는 실제 지도
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; s.raidT = 1e9;
  const zoneOf = (n) => G.zoneIndex(n.d);
  const census = () => { const c = {}; for (const n of s.nodes) { const k = `${zoneOf(n)}:${n.type}`; c[k] = (c[k] ?? 0) + 1; } return c; };
  const before = census(), N = s.nodes.length;
  const targets = s.nodes.filter((_, i) => i % 4 === 0);
  const orig = new Map(targets.map((n) => [n, { x: n.x, y: n.y, zone: zoneOf(n) }]));
  for (const n of targets) {
    s.player.x = n.x; s.player.y = n.y; s.bag.wood = s.bag.scrap = s.bag.plastic = 0;
    const t0 = s.time;
    for (let k = 0; k < 200 && n.readyAt <= s.time; k++) G.step(s, DT);
    assert.ok(n.readyAt > t0, '파밍됨');
    assert.ok(Math.abs(n.readyAt - (s.time + n.respawn)) < 0.1, '옮긴 자리 기준 리스폰 시간');
  }
  assert.equal(s.nodes.length, N);
  assert.deepEqual(census(), before, '구역별·종류별 대상물 수가 그대로');
  let moved = 0;
  for (const n of targets) {
    const o = orig.get(n);
    assert.equal(zoneOf(n), o.zone, '같은 구역');
    assert.equal(G.zoneIndex(G.dangerAt(n.x, n.y)), o.zone);
    if (n.x !== o.x || n.y !== o.y) moved++;
    assert.ok(!G.insideObstacle(s, n.x, n.y, 30), '장애물에 묻히지 않는다');
    assert.ok(!s.sites.some((q) => G.dist(n.x, n.y, q.x, q.y) < 70) && !G.safeZoneAt(s, n.x, n.y), '기지·후보지 밖');
    assert.ok(n.d >= 1 && n.amt === Math.round(G.LOOT_TYPES[n.type].amt * G.lootMult(n.d)), '양은 새 자리 위험도 기준');
  }
  assert.ok(moved >= targets.length * 0.95, `대부분 자리가 바뀐다 (${moved}/${targets.length})`);
  // 다시 생기면 새 자리에서 파밍할 수 있다
  const n0 = targets[0];
  s.time = Math.max(s.time, n0.readyAt + 1);
  s.player.x = n0.x; s.player.y = n0.y; s.bag.wood = s.bag.scrap = s.bag.plastic = 0;
  const ev = []; for (let k = 0; k < 200 && n0.readyAt <= s.time; k++) ev.push(...G.step(s, DT));
  assert.ok(ev.some((e) => e.t === 'loot'), '새 자리에서 다시 파밍');
  // 저장·불러오기: 옮긴 자리·양·타이머가 그대로
  const t = G.deserialize(G.serialize(s));
  for (const n of targets) {
    const m = t.nodes[s.nodes.indexOf(n)];
    assert.deepEqual([m.x, m.y, m.amt, m.respawn], [n.x, n.y, n.amt, n.respawn]);
    assert.ok(Math.abs((m.readyAt - t.time) - Math.max(0, n.readyAt - s.time)) <= 1, '남은 리스폰 시간');
  }
  // 다른 구역 좌표로 조작된 저장은 무시한다
  const o = JSON.parse(G.serialize(s)), i = s.nodes.indexOf(n0);
  o.nodeMoves = [[i, G.CENTER.x + 50, G.CENTER.y]];
  const bad = G.deserialize(JSON.stringify(o));
  assert.equal(zoneOf(bad.nodes[i]), orig.get(n0).zone);
});

test('거리 비례: 줍기는 늘 성공하고, 멀수록 1건당 자원량이 가파르게 커지며 아이템 확률도 오른다', () => {
  for (let d = 0.5; d < 5; d += 0.5) assert.ok(G.lootMult(d + 0.5) > G.lootMult(d) && G.itemDropChance(d + 0.5) >= G.itemDropChance(d));
  assert.ok(G.lootMult(4) - G.lootMult(3) > G.lootMult(2) - G.lootMult(1), '멀수록 더 크게 늘어난다');
  assert.ok(Math.abs(G.lootMult(2) - 3.4) < 1e-9);
  const s = fresh(90);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  let ok = 0;
  for (const n of s.nodes) {
    s.player.x = n.x; s.player.y = n.y;
    const amt = n.amt; // 파밍하면 대상물이 같은 구역 다른 자리로 옮겨지며 양도 그 자리 기준으로 바뀐다
    const ev = []; for (let t = 0; t < G.LOOT_TYPES[n.type].time + 0.1; t += DT) ev.push(...G.step(s, DT));
    const got = ev.filter((e) => e.t === 'loot');
    ok += got.length;
    if (got[0]) assert.equal(got[0].amt, Math.min(amt, G.bagCap(s)), '대상물 양만큼(가방 한도 안에서) 받는다');
    s.bag.wood = s.bag.scrap = s.bag.plastic = 0;
  }
  assert.equal(ok, s.nodes.length, '모든 줍기가 성공한다');
  const near = s.nodes.filter((n) => n.d < 2), far = s.nodes.filter((n) => n.d > 3.5);
  const avgAmt = (xs) => xs.reduce((a, n) => a + n.amt / G.LOOT_TYPES[n.type].amt, 0) / xs.length;
  assert.ok(avgAmt(far) > 2.5 * avgAmt(near), '원거리 대상물이 같은 종류 기준 2.5배 넘게 준다');
});

test('거리 비례: 좀비 개체수는 위험도에 비례하고(스폰 간격은 같음), 고티어 비율도 멀수록 오른다', () => {
  assert.equal(G.fieldPopulation(1), G.ZOMBIES_PER_DANGER);
  assert.equal(G.fieldPopulation(2), 2 * G.ZOMBIES_PER_DANGER);
  assert.equal(G.fieldPopulation(3), 3 * G.ZOMBIES_PER_DANGER);
  const count = (d) => {
    const s = fresh(91);
    s.autoHunt = false; s.rescueT = 1e9;
    s.player.x = G.CENTER.x + d * G.ZONE_SIZE * Math.SQRT1_2; s.player.y = G.CENTER.y + d * G.ZONE_SIZE * Math.SQRT1_2;
    s.player.hp = 1e9; s.growth.hp = 1e9;
    let maxN = 0;
    for (let t = 0; t < 30; t += DT) { G.step(s, DT); maxN = Math.max(maxN, s.zombies.filter((z) => !z.raid && !z.siege).length); }
    return maxN;
  };
  const near = count(1), far = count(4);
  assert.ok(near <= G.fieldPopulation(1.3) && far >= 3 * near, `위험도 1: ${near}마리, 위험도 4: ${far}마리`);
  // 멀수록 높은 등급 비율이 오른다(중급 이상, 상급 각각)
  for (let d = 1; d < 6.5; d++) {
    const a = G.gradeShare(d), b = G.gradeShare(d + 1);
    assert.ok(b[1] + b[2] >= a[1] + a[2] && b[2] >= a[2], `위험도 ${d}`);
  }
  assert.deepEqual(G.gradeShare(1.5), [1, 0, 0], '주택가는 하급만');
  assert.ok(G.gradeShare(6.5)[2] > 0.4, '군사 구역은 상급이 가장 많다');
});

test('균형: 자동사냥 봇이 30분 안에 본부 2레벨 이상, 상태값에 NaN이 없다', () => {
  for (const seed of [7, 11]) {
    const { s } = run(30, seed);
    assert.equal(s.over, null, `seed ${seed}: 자동사냥 봇이 30분 안에 죽지 않는다`);
    assert.ok(s.hq >= 2, `seed ${seed}: hq ${s.hq}`);
    assert.ok(s.stats.kills > 120, `seed ${seed}: kills ${s.stats.kills}`); // 난이도 상향(체력 ×1.3·탄약 제한·이동 -30%) 뒤 기준
    const flat = JSON.stringify(s, (k, v) => (k === 'zombies' || k === 'posts' || k === 'autoTarget' ? undefined : v));
    assert.ok(!/null|NaN/.test(flat.replace(/"(waypoint|rescue|gather|raid|gun|over|ended|hero)":null/g, '')), 'NaN 없음');
    for (const k of G.RES_KEYS) assert.ok(Number.isFinite(s.res[k]) && s.res[k] >= 0);
  }
});

test('작업 시간: 등급에 비례해 늘고, 어떤 작업도 5분을 넘지 않으며 최고 등급이 딱 5분', () => {
  const tracks = {
    hq: [2, G.HQ_MAX].map((n) => G.jobDuration('hq', 0, n)),
    barricade: [1, 5, 10].map((n) => G.jobDuration('bld', 'barricade', n)),
    workbench: [1, 2, 3].map((n) => G.jobDuration('bld', 'workbench', n)),
    craft: ['pipe', 'bat', 'machete'].map((id) => G.jobDuration('craft', id, 1)),
    wup: [2, 4, G.WEAPON_MAX_LV].map((n) => G.jobDuration('wup', 'pistol', n)),
    aup: [2, G.ARMOR_MAX_LV].map((n) => G.jobDuration('aup', 'gloves', n)),
    lvl: [2, 8, G.MAX_SURVIVOR_LV].map((n) => G.jobDuration('lvl', 1, n)),
    outpost: [1, 2, 3].map((n) => G.jobDuration(n === 1 ? 'obuild' : 'oup', 0, n)),
  };
  for (const [k, ts] of Object.entries(tracks)) {
    for (let i = 1; i < ts.length; i++) assert.ok(ts[i] > ts[i - 1], `${k}: ${ts}`);
    assert.equal(ts.at(-1), G.JOB_MAX_S, `${k}: 최고 등급 = 5분`);
    assert.ok(ts.every((t) => t > 0 && t <= 300), k);
  }
  assert.equal(G.jobDuration('bld', 'barricade', 5), G.jobDuration('bld', 'barricade', 1) * 5, '정비례');
});

test('작업 시간: 자원은 시작할 때 내고 효과는 시간이 다 지나야 붙는다', () => {
  const s = rich(fresh(90));
  const wood = s.res.wood, wall = G.wallMax(s);
  const r = G.buyBuilding(s, 'barricade');
  assert.equal(r.ok, true);
  assert.match(r.msg, /30초/);
  assert.equal(s.res.wood, wood - G.buildCost('barricade', 1).wood, '시작할 때 지불');
  assert.equal(s.bld.barricade, 0, '아직 효과 없음');
  stepFor(s, 29);
  assert.equal(s.bld.barricade, 0);
  const ev = []; for (let t = 0; t < 1.5; t += DT) ev.push(...G.step(s, DT));
  assert.equal(s.bld.barricade, 1, '30초 뒤 완성');
  assert.ok(G.wallMax(s) > wall);
  assert.ok(ev.some((e) => e.t === 'job-done' && e.name === '바리케이드 1레벨'));
  assert.equal(s.jobs.length, 0);
});

test('작업 시간: 같은 줄은 한 번에 하나, 다른 줄끼리는 동시에 진행', () => {
  const s = rich(fresh(91));
  s.bld.workbench = 1;
  s.survivors.push(G.makeSurvivor(s));
  assert.equal(G.buyBuilding(s, 'sawmill').ok, true);
  const r = G.upgradeHq(s);
  assert.equal(r.ok, false, '기지 건설 줄이 바쁘다');
  assert.match(r.msg, /기지 건설 중이에요 · 제재소 1레벨 \d+초 남음/);
  assert.equal(G.craftWeapon(s, 'pistol').ok, true, '공방은 따로 돈다');
  assert.equal(G.upgradeWeapon(s, 'fist').ok, false, '공방 줄도 하나씩');
  assert.equal(G.levelSurvivor(s, s.survivors[0].id).ok, true, '훈련도 따로 돈다');
  assert.equal(s.jobs.length, 3);
  assert.equal(s.weapons.pistol, undefined, '제작이 끝나야 무기가 생긴다');
  finish(s);
  assert.equal(s.bld.sawmill, 1);
  assert.equal(s.weapons.pistol, 1);
  assert.equal(s.equip.gun, 'pistol', '제작이 끝나면 장착');
  assert.equal(s.survivors[0].lv, 2);
  assert.equal(G.upgradeHq(s).ok, true, '끝나면 다시 쓸 수 있다');
});

test('작업 취소: 모든 건설·강화·제작·훈련·전진기지 공사는 진행 중에 취소할 수 있고, 낸 자원을 모두 돌려받는다', () => {
  const s = rich(fresh(94));
  s.hq = 4; s.bld.workbench = 2;
  G.gainWeapon(s, 'pipe');
  const v = G.makeSurvivor(s); s.survivors.push(v);
  s.outposts.push({ site: 0, lv: 1 });
  const site = s.sites[2]; s.player.x = site.x; s.player.y = site.y;
  const craftable = Object.keys(G.WEAPONS).find((id) => G.weaponSource(id) === 'craft' && !s.weapons[id] && G.WEAPONS[id].tier <= 2);
  const cases = [
    ['hq', 0, () => G.upgradeHq(s)],
    ['bld', 'sawmill', () => G.buyBuilding(s, 'sawmill')],
    ['craft', craftable, () => G.craftWeapon(s, craftable)],
    ['wup', 'pipe', () => G.upgradeWeapon(s, 'pipe')],
    ['lvl', v.id, () => G.levelSurvivor(s, v.id)],
    ['obuild', 2, () => G.buildOutpost(s, 2)],
    ['oup', 0, () => G.upgradeOutpost(s, 0)],
    ['odemo', 0, () => G.demolishOutpost(s, 0)],
  ];
  for (const [kind, key, start] of cases) {
    const before = { ...s.res }, state = JSON.stringify([s.hq, s.bld, s.weapons, s.survivors, s.outposts]);
    assert.equal(start().ok, true, `${kind} 시작`);
    const paid = Object.fromEntries(G.RES_KEYS.map((r) => [r, before[r] - s.res[r]]));
    G.advanceJobs(s, 1); // 조금 진행된 뒤
    const r = G.cancelJob(s, kind, key);
    assert.equal(r.ok, true, `${kind} 취소`); assert.match(r.msg, /취소/);
    assert.deepEqual(s.res, before, `${kind}: 낸 자원(${JSON.stringify(paid)})을 모두 돌려받는다`);
    assert.equal(G.jobOf(s, kind, key), null);
    assert.equal(JSON.stringify([s.hq, s.bld, s.weapons, s.survivors, s.outposts]), state, `${kind}: 효과는 붙지 않는다`);
  }
  assert.equal(s.outposts.length, 1, '철거를 취소하면 전진기지가 남는다');
  assert.equal(G.cancelJob(s, 'hq', 0).ok, false, '진행 중이 아니면 취소할 수 없다');
  // 취소한 줄은 바로 다른 작업을 시작할 수 있다
  G.buyBuilding(s, 'sawmill'); G.cancelJob(s, 'bld', 'sawmill');
  assert.equal(G.upgradeHq(s).ok, true);
});

test('전진기지 철거: 자원 반환 없이 레벨에 비례한 시간이 걸리고, 끝나면 다른 곳에 지을 수 있다', () => {
  const s = rich(fresh(93));
  s.hq = 2; // 한도 1곳
  s.outposts.push({ site: 0, lv: 2 });
  const a = s.sites[0], b = s.sites[2];
  assert.equal(G.demolishOutpost(s, 5).ok, false, '세우지 않은 곳은 철거할 수 없다');
  // 한도가 차 있으면 다른 곳에 못 짓는다
  s.player.x = b.x; s.player.y = b.y;
  assert.equal(G.buildOutpost(s, 2).ok, false);
  const res0 = { ...s.res };
  const r = G.demolishOutpost(s, 0);
  assert.equal(r.ok, true); assert.match(r.msg, /철거/);
  assert.deepEqual(s.res, res0, '철거는 자원을 쓰지도 돌려주지도 않는다');
  const j = G.jobOf(s, 'odemo', 0);
  assert.equal(j.total, Math.round(G.jobTime(2, G.OUTPOST_MAX_LV) * G.DEMOLISH_SHARE), '2레벨 철거 시간');
  assert.deepEqual([1, 2, 3].map((lv) => G.jobDuration('odemo', 0, lv)), [50, 100, 150], '레벨에 비례');
  // 헐리는 동안에는 그대로 쓰이고, 같은 공사 줄이라 다른 공사는 못 한다
  assert.ok(G.safeZoneAt(s, a.x, a.y));
  assert.equal(G.upgradeOutpost(s, 0).ok, false);
  assert.equal(G.buildOutpost(s, 2).ok, false);
  // 저장해도 철거 작업이 이어진다
  const t = G.deserialize(G.serialize(s));
  assert.ok(G.jobOf(t, 'odemo', 0), '저장 후에도 철거 중');
  G.advanceJobs(s, j.total - 1);
  assert.equal(s.outposts.length, 1, '다 헐리기 전');
  const ev = G.advanceJobs(s, 2);
  assert.equal(s.outposts.length, 0);
  assert.ok(ev.some((e) => e.t === 'job-done' && e.kind === 'odemo' && /철거/.test(e.name)));
  assert.ok(!G.safeZoneAt(s, a.x, a.y), '안전지대가 사라진다');
  assert.deepEqual(s.res, res0, '끝나도 자원은 돌아오지 않는다');
  // 비운 자리 대신 다른 후보지에 짓는다(같은 자리도 다시 지을 수 있다)
  assert.equal(G.buildOutpost(s, 2).ok, true);
  // 없는 전진기지를 가리키는 철거 작업은 불러올 때 버린다
  const o = JSON.parse(G.serialize(s));
  o.jobs = [{ lane: 'outpost', kind: 'odemo', key: 7, next: 1, t: 10, total: 50 }];
  assert.equal(G.deserialize(JSON.stringify(o)).jobs.length, 0);
});

test('작업 시간: 전진기지는 공사가 끝나야 안전지대가 되고, 공사 중에는 다른 후보지를 못 짓는다', () => {
  const s = rich(fresh(92));
  s.hq = 4;
  const [a, b] = s.sites;
  s.player.x = a.x; s.player.y = a.y;
  assert.equal(G.buildOutpost(s, 0).ok, true);
  assert.equal(s.outposts.length, 0);
  assert.ok(!G.safeZoneAt(s, a.x, a.y), '공사 중에는 안전지대가 아니다');
  s.player.x = b.x; s.player.y = b.y;
  assert.equal(G.buildOutpost(s, 1).ok, false);
  G.advanceJobs(s, G.jobDuration('obuild', 0, 1));
  assert.deepEqual(s.outposts, [{ site: 0, lv: 1 }]);
  assert.ok(G.safeZoneAt(s, a.x, a.y));
  assert.equal(G.buildOutpost(s, 1).ok, true);
});

test('작업 시간: 저장·불러오기에 남은 시간이 유지되고, 자리를 비운 동안에도 진행된다', () => {
  const s = rich(fresh(93));
  G.buyBuilding(s, 'clinic'); // 본부 3레벨 전이라 거절
  s.hq = 3;
  assert.equal(G.buyBuilding(s, 'clinic').ok, true);
  G.advanceJobs(s, 10);
  const t = G.deserialize(G.serialize(s));
  assert.equal(t.jobs.length, 1);
  assert.equal(t.jobs[0].kind, 'bld');
  assert.equal(Math.round(t.jobs[0].t), G.jobDuration('bld', 'clinic', 1) - 10);
  const short = G.applyOffline(t, t.savedAt + 10e3);
  assert.equal(short, null, '10초 자리 비움: 아직 안 끝남');
  assert.equal(Math.round(t.jobs[0].t), G.jobDuration('bld', 'clinic', 1) - 20, '짧게 비워도 작업은 진행');
  const r = G.applyOffline(t, t.savedAt + 600e3);
  assert.deepEqual(r.done, ['의무실 1레벨']);
  assert.equal(t.bld.clinic, 1);
  // 맞지 않는 작업(레벨 건너뛰기·없는 대상·같은 줄 중복)은 버린다
  const bad = JSON.parse(G.serialize(s));
  bad.jobs = [{ kind: 'bld', key: 'clinic', next: 5, t: 1 }, { kind: 'bld', key: 'constructor', next: 1, t: 1 }, { kind: 'hq', key: 0, next: 4, t: 1 }, { kind: 'bld', key: 'sawmill', next: 1, t: 1 }, { kind: 'zap', key: 0, next: 1, t: 1 }];
  const u = G.deserialize(JSON.stringify(bad));
  assert.deepEqual(u.jobs.map((j) => j.kind + j.next), ['hq4']);
});

test('가방 늘리기: (기본 + 레벨업 + 탐험 동료 짐) × 배낭 공방(레벨마다 +25%)', () => {
  const s = rich(fresh(96));
  s.level = 11; s.growth.bag = 100; // 레벨업 누적(10번 올린 값의 범위 안)
  assert.equal(G.bagCap(s), 160);
  // 1) 배낭 공방: 본부 2레벨부터, 레벨마다 ×(1 + 0.25 × 레벨)
  assert.equal(G.buyBuilding(s, 'pack').ok, false, '본부 1레벨이면 잠김');
  s.hq = 3;
  assert.equal(G.buyBuilding(s, 'pack').ok, true);
  assert.equal(G.bagCap(s), 160, '공사가 끝나야 붙는다');
  finish(s);
  assert.equal(G.bagCap(s), Math.floor(160 * 1.25));
  G.buyBuilding(s, 'pack'); finish(s);
  assert.equal(G.bagCap(s), Math.floor(160 * 1.5));
  // 2) 탐험 동료 짐꾼: 동행 중에만 25 × 전투력, 공방 배율도 같이 받는다
  const v = G.makeSurvivor(s); Object.assign(v, { role: 'brawler', rarity: 2, lv: 10 }); s.survivors.push(v);
  assert.equal(G.survivorCarry(v), Math.round(25 * G.survivorPower(v)));
  assert.equal(G.bagCap(s), Math.floor(160 * 1.5), '생산 근무 중이면 짐을 들지 않는다');
  G.setPost(s, v.id, 'explore');
  assert.equal(G.bagCap(s), Math.floor((160 + G.survivorCarry(v)) * 1.5));
  // 실제로 더 담긴다: 가방이 공방·동료 없이 가득 찬 양에서도 줍는다
  s.bag.wood = 160; s.player.x = s.nodes[0].x; s.player.y = s.nodes[0].y; s.spawnT = 1e9; s.rescueT = 1e9; s.autoHunt = false;
  const ev = []; for (let k = 0; k < 200 && !ev.some((e) => e.t === 'loot'); k++) ev.push(...G.step(s, DT));
  assert.ok(ev.some((e) => e.t === 'loot') && G.bagTotal(s) > 160);
  // 저장 후에도 같다
  assert.equal(G.bagCap(G.deserialize(G.serialize(s))), G.bagCap(s));
});

test('가방: 레벨업마다 레벨당 10의 ±10%(9~11)에서 균일 분포로 늘어난다', () => {
  const s = fresh(95);
  assert.equal(G.bagCap(s), 60, '1레벨 시작 가방');
  assert.equal(G.BUILDINGS.supply, undefined, '가방을 늘리던 보급소는 없다');
  const ev = [];
  G.gainXp(s, G.xpToNext(1), ev);
  const up = ev.find((e) => e.t === 'levelup');
  assert.ok(up.bag >= 9 && up.bag <= 11, `상승 ${up.bag}`);
  assert.equal(G.bagCap(s), 60 + Math.floor(up.bag));
  const xs = [];
  for (let seed = 1; xs.length < 4000; seed++) {
    const t = fresh(3000 + seed), e2 = [];
    G.gainXp(t, 1e9, e2);
    for (const e of e2) if (e.t === 'levelup') xs.push(e.bag / G.BAG_PER_LEVEL);
    assert.equal(G.bagCap(t), 60 + Math.floor(t.growth.bag));
  }
  assert.ok(Math.min(...xs) >= 0.9 - 1e-12 && Math.max(...xs) <= 1.1 + 1e-12, '범위 0.9~1.1배');
  const bins = [0, 0, 0, 0];
  for (const v of xs) bins[Math.min(3, Math.floor((v - 0.9) / 0.05))]++;
  for (const b of bins) assert.ok(Math.abs(b / xs.length - 0.25) < 0.03, `칸 비율 ${bins.map((x) => (x / xs.length).toFixed(3))}`);
});

test('난이도: 이동 속도 -30%, 좀비 체력 ×1.3에 바깥 구역일수록 구역마다 +15%', () => {
  assert.equal(G.PLAYER_SPEED, 91);
  const hp = (d) => G.zombieStats('butcher', d).hp;
  assert.equal(hp(0), Math.round(22 * 1.3));
  // 같은 거리 배율(1.5^d)을 빼면 구역 번호에 비례해 커진다
  const base = (d) => hp(d) / (22 * 1.5 ** d);
  for (const [z, d] of [[1, 1.5], [2, 2.5], [3, 3.5], [4, 4.5]]) assert.ok(Math.abs(base(d) - 1.3 * (1 + 0.15 * z)) < 0.02, `구역 ${z}: ${base(d)}`);
  const s = fresh(101);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  G.step(s, 1, { x: 1, y: 0 });
  assert.ok(Math.abs(s.player.x - (G.CENTER.x + 91)) < 1, '1초에 91');
});

test('리스폰: 주택가는 예전보다 30% 느리고, 바깥 구역일수록 구역 번호에 반비례해 빨라진다(대상물·좀비 모두)', () => {
  assert.ok(Math.abs(G.RESPAWN_ZONE_MULT[1] - 1.8 * 1.3) < 1e-9);
  for (const z of [2, 3, 4]) assert.ok(Math.abs(G.RESPAWN_ZONE_MULT[z] - G.RESPAWN_ZONE_MULT[1] / z) < 1e-9);
  assert.ok(Math.abs(G.SPAWN_INTERVAL_S - 0.9 * 1.3) < 1e-9);
  assert.equal(G.spawnInterval(0.5), G.SPAWN_INTERVAL_S, '기지 주변');
  assert.equal(G.spawnInterval(1.5), G.SPAWN_INTERVAL_S, '주택가');
  for (const z of [2, 3, 4]) assert.ok(Math.abs(G.spawnInterval(z + 0.5) - G.SPAWN_INTERVAL_S / z) < 1e-9);
});

test('명중률: 무기 명중률대로 맞고(거리와 상관없음), 빗나가도 총은 탄을 쓰고 근접은 내구도가 닳지 않는다', () => {
  const run = (id, dx) => {
    const s = fresh(102);
    s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
    G.gainWeapon(s, id); G.equipWeapon(s, id); s.ammo = 240;
    s.player.x = 600; s.player.y = 600;
    zombieAt(s, 600 + dx, 600, 1e12);
    let hit = 0, miss = 0;
    for (let i = 0; i < 3000; i++) for (const e of G.step(s, DT)) { if (e.t === 'dmg') hit++; if (e.t === 'miss') miss++; }
    return { s, hit, miss, rate: hit / (hit + miss) };
  };
  const near = run('carbine', 40), far = run('carbine', 240);
  assert.equal(near.rate, 1, '자동 소총은 명중 100%');
  assert.equal(far.rate, 1, '멀어도 같다');
  const saw = run('chainsaw', 20);
  assert.ok(Math.abs(saw.rate - G.WEAPONS.chainsaw.acc) < 0.03, `전기톱 ${saw.rate.toFixed(3)}`);
  assert.equal(G.maxDurability(saw.s, 'chainsaw') - saw.s.dur.chainsaw, saw.hit, '내구도는 맞힌 만큼만 닳는다');
});

test('총기 사용 끄기: 근접 무기만 쓰고 탄약을 쓰지 않아 제작소 탄약이 쌓인다', () => {
  const s = rich(fresh(104));
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.hq = 2; s.bld.ammo = 1;
  G.gainWeapon(s, 'pistol'); G.equipWeapon(s, 'pistol');
  s.player.x = 600; s.player.y = 600;
  const far = zombieAt(s, 700, 600, 1e9); // 근접 사거리 밖, 권총 사거리 안
  assert.equal(G.setSwitch(s, 'gunOn', false).ok, true);
  const ammo0 = s.ammo + s.player.mag;
  stepFor(s, 30);
  assert.equal(far.hp, 1e9, '먼 좀비는 쏘지 않는다');
  assert.equal(G.gunReady(s), false);
  assert.ok(s.ammo + s.player.mag > ammo0, `제작소 탄약이 쌓인다 (${ammo0} → ${s.ammo + s.player.mag})`);
  // 가까운 좀비는 근접 무기로 친다
  const near = zombieAt(s, 620, 600, 1e9);
  stepFor(s, 1);
  assert.ok(near.hp < 1e9, '근접 공격은 그대로');
  // 저장해도 꺼진 채로 남는다
  assert.equal(G.deserialize(G.serialize(s)).gunOn, false);
  // 다시 켜면 총을 쏜다
  s.zombies = s.zombies.filter((z) => z === far);
  G.setSwitch(s, 'gunOn', true);
  const mag0 = s.player.mag;
  stepFor(s, 1);
  assert.ok(far.hp < 1e9 && s.player.mag < mag0, '켜면 다시 총을 쓴다');
});

test('탄약: 무한 재장전 없음. 예비가 바닥나면 총을 못 쓰고, 파밍하면 확률로 탄약이 나온다', () => {
  const s = fresh(103);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  G.gainWeapon(s, 'pistol');
  assert.equal(s.ammo, G.WEAPONS.pistol.mag, '총을 얻으면 탄창 1개분이 같이 온다');
  G.equipWeapon(s, 'pistol');
  assert.equal(s.player.mag, 8); assert.equal(s.ammo, 0);
  s.player.x = 600; s.player.y = 600;
  zombieAt(s, 700, 600, 1e9); // 근접 사거리 밖
  const ev = []; for (let t = 0; t < 8; t += DT) ev.push(...G.step(s, DT));
  assert.equal(s.player.mag, 0); assert.equal(s.player.reload, 0, '예비가 없으면 재장전하지 않는다');
  assert.equal(G.gunReady(s), false);
  assert.equal(ev.filter((e) => e.t === 'no-ammo').length, 1, '한 번만 알린다');
  assert.equal(G.chooseAttack(s, { x: 840, y: 600, r: 0 }), null, '총을 못 쓰니 먼 좀비는 공격 못 한다');
  // 총을 바꿔도 탄 총량은 그대로
  s.ammo = 10; G.step(s, DT); stepFor(s, G.WEAPONS.pistol.reload + 0.1);
  const total = () => s.ammo + s.player.mag;
  const before = total(); G.gainWeapon(s, 'shotgun'); const gained = G.WEAPONS.shotgun.mag;
  G.equipWeapon(s, 'shotgun');
  assert.equal(total(), before + gained);
  // 저장·불러오기에도 탄창과 예비가 유지된다(새로 열어도 공짜로 차지 않는다)
  const t = G.deserialize(G.serialize(s));
  assert.equal(t.ammo, s.ammo); assert.equal(t.player.mag, s.player.mag);
  // 파밍 탄약: 위험도에 따라 확률·양이 커진다
  assert.ok(G.ammoChance(4) > G.ammoChance(1) && G.ammoDrop(4) > G.ammoDrop(1));
  const u = fresh(104);
  u.autoHunt = false; u.spawnT = 1e9; u.rescueT = 1e9;
  for (const [id, w] of Object.entries(G.WEAPONS)) if (w.source === 'loot') u.weapons[id] = 1; // 총을 주워 탄창분이 따라오는 경우는 뺀다
  let got = 0, loots = 0;
  for (const n of u.nodes.slice(0, 120)) {
    u.player.x = n.x; u.player.y = n.y; u.bag.wood = u.bag.scrap = u.bag.plastic = 0;
    for (let k = 0; k < 120 && n.readyAt <= u.time; k++) for (const e of G.step(u, DT)) { if (e.t === 'ammo') got += e.n; if (e.t === 'loot') loots++; }
  }
  assert.ok(loots > 80 && got > 0 && u.ammo === got, `탄약 ${got} / 파밍 ${loots}`);
});

test('근접 내구도: 때릴 때마다 줄고 0이면 파손(맨주먹), 강화하면 최대치가 늘고, 본부 수리점에서 시간 없이 고친다', () => {
  const s = rich(fresh(105));
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  G.gainWeapon(s, 'pipe'); G.equipWeapon(s, 'pipe');
  const max = G.maxDurability(s, 'pipe');
  assert.equal(max, G.WEAPONS.pipe.dur); assert.equal(s.dur.pipe, max);
  assert.equal(G.maxDurability(s, 'fist'), Infinity, '맨주먹은 부서지지 않는다');
  s.player.x = 900; s.player.y = 900;
  zombieAt(s, 920, 900, 1e9);
  stepFor(s, 3);
  assert.ok(s.dur.pipe < max && s.dur.pipe > 0);
  s.dur.pipe = 1;
  const ev = []; for (let t = 0; t < 2; t += DT) ev.push(...G.step(s, DT));
  assert.equal(s.dur.pipe, 0); assert.ok(ev.some((e) => e.t === 'broken' && e.id === 'pipe'));
  assert.equal(G.meleeId(s), 'fist', '파손되면 맨주먹으로 싸운다');
  assert.ok(ev.filter((e) => e.t === 'swing').at(-1).weapon === 'fist');
  // 수리: 수리점·본부 안·자원
  let r = G.repairWeapon(s, 'pipe');
  assert.equal(r.ok, false); assert.match(r.msg, /수리점/);
  s.bld.repair = 1;
  r = G.repairWeapon(s, 'pipe');
  assert.equal(r.ok, false); assert.match(r.msg, /본부 안/);
  s.player.x = G.CENTER.x; s.player.y = G.CENTER.y; s.zombies = [];
  const scrap = s.res.scrap, cost = G.repairCost(s, 'pipe').scrap;
  r = G.repairWeapon(s, 'pipe');
  assert.equal(r.ok, true); assert.equal(s.dur.pipe, max); assert.equal(s.res.scrap, scrap - cost);
  assert.equal(s.jobs.length, 0, '수리는 시간이 걸리지 않는다');
  assert.equal(G.meleeId(s), 'pipe');
  // 강화: 최대 내구도도 공격력과 같은 비율(기본의 +10%)로 늘고, 늘어난 만큼 현재 내구도도 찬다
  s.dur.pipe = max - 10;
  assert.equal(G.upgradeWeapon(s, 'pipe').ok, true); finish(s);
  assert.equal(G.maxDurability(s, 'pipe'), Math.round(G.WEAPONS.pipe.dur * 1.1));
  assert.equal(s.dur.pipe, G.maxDurability(s, 'pipe') - 10);
  // 수리점 2·3레벨은 수리비가 싸진다
  s.dur.pipe = 0; const c1 = G.repairCost(s, 'pipe').scrap; s.bld.repair = 3;
  assert.ok(G.repairCost(s, 'pipe').scrap < c1);
  // 저장·불러오기
  const t = G.deserialize(G.serialize(s));
  assert.equal(t.dur.pipe, 0);
});

test('스팀팩: 1분 동안 이동·파밍·공격 속도 +50%, 체력은 들지 않는다', () => {
  const s = fresh(106);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.items.stim = 2;
  s.player.x = 900; s.player.y = 900; s.player.hp = G.maxHp(s);
  assert.equal(G.atkSpeedMult(s), 1);
  assert.equal(G.useItem(s, 'stim').ok, true);
  assert.equal(s.player.hp, G.maxHp(s), '체력 대가 없음');
  assert.equal(s.player.stim, 60);
  assert.equal(G.atkSpeedMult(s), 1.5, '공격 속도 +50%');
  const x0 = s.player.x; G.step(s, 1, { x: 1, y: 0 });
  assert.ok(Math.abs(s.player.x - x0 - 91 * 1.5) < 1, '이동 +50%');
  // 파밍 속도
  const node = s.nodes.find((n) => n.readyAt <= s.time);
  s.player.x = node.x; s.player.y = node.y; s.gather = null;
  stepFor(s, G.LOOT_TYPES[node.type].time / 1.5 + 0.1);
  assert.ok(node.readyAt > s.time, '1.5배 빨리 줍는다');
  stepFor(s, 60);
  assert.equal(s.player.stim, 0, '1분 뒤 끝난다');
  s.player.hp = 5;
  assert.equal(G.useItem(s, 'stim').ok, true, '체력이 낮아도 쓸 수 있다');
});

test('습격 완화: 습격 좀비의 구역 보너스는 나타난 자리(기지 근처) 기준, 막으면 탄약도 받는다', () => {
  const s = rich(fresh(110));
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  s.hq = 9; s.bld.barricade = 9; s.wall = G.wallMax(s); s.raidT = 0.01;
  stepFor(s, 0.2);
  const rz = s.zombies.filter((z) => z.raid);
  assert.ok(rz.length > 0);
  const D = G.raidDanger(s);
  for (const z of rz) {
    // 나타난 자리의 구역 k로 계산한 체력과 같고, k는 기지 근처(습격 위험도의 구역보다 안쪽)다
    const k = [0, 1, 2, 3, 4].find((q) => G.zombieStats(z.type, D, q).hp === z.max);
    assert.ok(k !== undefined && k < G.zoneIndex(D), `구역 ${k} / 습격 위험도 구역 ${G.zoneIndex(D)}`);
    assert.ok(Math.abs(k - G.zoneIndex(G.dangerAt(z.x, z.y))) <= 1);
  }
  // 막으면 탄약 보상
  s.zombies = []; s.raid.queue = []; s.ammo = 5;
  const ev = G.step(s, DT);
  const won = ev.find((e) => e.t === 'raid-won');
  assert.ok(won);
  assert.equal(won.reward.ammo, G.raidAmmo(s));
  assert.equal(s.ammo, 5 + G.raidAmmo(s));
});

test('습격 완화: 방어 동료 공격력 ×1.3', () => {
  const s = fresh(111);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  const v = { ...G.makeSurvivor(s), role: 'gunner', rarity: 0, lv: 1, post: 'defense' };
  s.survivors.push(v);
  G.step(s, DT);
  const c = s.posts[v.id];
  zombieAt(s, c.x + 60, c.y, 1e9);
  const dmg = [];
  for (let i = 0; i < 300; i++) for (const e of G.step(s, DT)) if (e.t === 'dmg' && !e.crit) dmg.push(e.dmg);
  const R = G.ROLES.gunner;
  assert.ok(dmg.length > 0);
  assert.ok(Math.abs(dmg[0] - R.dmg * G.survivorPower(v) * G.defenseMult(s) * 1.3) < 1e-9);
});

test('자동사냥 수리 복귀: 근접 무기가 부서지면 수리점이 있고 고철이 있을 때 본부로 가서 고친다', () => {
  const s = fresh(112);
  s.spawnT = 1e9; s.rescueT = 1e9; s.raidT = 1e9;
  s.autoHunt = true;
  G.gainWeapon(s, 'bat'); G.equipWeapon(s, 'bat'); s.dur.bat = 0;
  s.player.x = G.CENTER.x + 700; s.player.y = G.CENTER.y;
  assert.equal(G.needsRepairTrip(s), false, '수리점이 없으면 가지 않는다');
  assert.notEqual(G.chooseAutoTarget(s)?.kind, 'home');
  s.bld.repair = 1; s.res.scrap = 0;
  assert.equal(G.needsRepairTrip(s), false, '고철이 없으면 가지 않는다');
  s.res.scrap = 1000;
  assert.equal(G.needsRepairTrip(s), true);
  const t = G.chooseAutoTarget(s);
  assert.equal(t.kind, 'home'); assert.equal(t.x, G.CENTER.x); assert.equal(t.y, G.CENTER.y);
  // 걸어서 본부에 들어가면 알아서 고친다
  const ev = []; for (let i = 0; i < 30 * 30 && G.isBroken(s, 'bat'); i++) ev.push(...G.step(s, DT));
  assert.equal(G.isBroken(s, 'bat'), false);
  assert.equal(s.dur.bat, G.maxDurability(s, 'bat'));
  assert.ok(ev.some((e) => e.t === 'auto-repair' && e.id === 'bat'));
  assert.equal(G.safeZoneAt(s, s.player.x, s.player.y)?.kind, 'hq');
  // 자동사냥이 꺼져 있으면 본부에 있어도 자동으로 고치지 않는다(무기 탭에서 직접)
  s.dur.bat = 0; s.autoHunt = false;
  const ev2 = []; for (let i = 0; i < 30; i++) ev2.push(...G.step(s, DT));
  assert.equal(G.isBroken(s, 'bat'), true);
  assert.ok(!ev2.some((e) => e.t === 'auto-repair'));
});

test('배경음악: 7곡(단조 3 + 장조 4), 한 곡 5분, 마디마다 4박이 맞고 느린 템포의 단순한 악구', async () => {
  const M = await import('../music.js');
  assert.equal(M.TRACKS.length, 7);
  // 희망적인 4곡은 장조: 으뜸화음이 장3화음(0·4·7), 앞의 3곡은 단조(0·3·7)
  assert.deepEqual(M.TRACKS.map((T) => T.chords[0].join()), ['0,3,7', '0,3,7', '0,3,7', '0,4,7', '0,4,7', '0,4,7', '0,4,7']);
  assert.equal(new Set(M.TRACKS.map((T) => T.name)).size, 7);
  assert.equal(M.SEGMENT_S, 300);
  for (const T of M.TRACKS) {
    assert.ok(T.bpm >= 50 && T.bpm <= 90, `${T.name} ${T.bpm}BPM`);
    assert.equal(T.chords.length, 4);
    for (const phrase of T.melody) {
      assert.equal(phrase.length, 4, '4마디 악구');
      for (const bar of phrase) assert.equal(bar.reduce((a, [, b]) => a + b, 0), 4, `${T.name}: 마디 박 합`);
    }
  }
});

test('탐험 지역: 구역 7개(폐허 도심·검은 숲 추가), 군사 구역이 가장 바깥이고 가장 위험하다', () => {
  assert.deepEqual(G.ZONE_NAMES, ['기지 주변', '주택가', '상가 거리', '공단', '폐허 도심', '검은 숲', '군사 구역']);
  assert.equal(G.zoneIndex(99), 6, '가장 바깥은 군사 구역');
  // 구역 7개가 지도 안에 동심원으로 들어간다(가장자리 가운데가 군사 구역)
  assert.ok(G.WORLD.w / 2 > 6 * G.ZONE_SIZE && G.CENTER.x === G.WORLD.w / 2);
  assert.equal(G.zoneIndex(G.dangerAt(G.CENTER.x + G.WORLD.w / 2 - 30, G.CENTER.y)), 6);
  for (const t of [...Object.values(G.LOOT_TYPES), ...Object.values(G.OBSTACLE_TYPES)]) assert.equal(t.zones.length, 7);
  assert.equal(G.RESPAWN_ZONE_MULT.length, 7);
  // 바깥일수록 위험: 좀비 체력·개체수·스폰 간격, 리스폰도 빨라진다
  assert.ok(G.zombieStats('butcher', 6.5).hp > G.zombieStats('butcher', 4.5).hp);
  assert.ok(G.spawnInterval(6.5) < G.spawnInterval(4.5) && G.RESPAWN_ZONE_MULT[6] < G.RESPAWN_ZONE_MULT[4]);
  // 주력 자원: 폐허 도심 = 고철, 검은 숲 = 목재
  const main = (zone) => G.RES_KEYS.map((r) => [r, Object.values(G.LOOT_TYPES).filter((t) => t.res === r).reduce((a, t) => a + t.zones[zone], 0)]).sort((a, b) => b[1] - a[1])[0][0];
  assert.deepEqual([main(4), main(5), main(6)], ['scrap', 'wood', 'scrap']);
  const s = G.newGame(130);
  for (const z of [4, 5, 6]) assert.ok(s.nodes.some((n) => G.zoneIndex(n.d) === z), `구역 ${z}에 대상물`);
  assert.ok(s.obstacles.some((o) => G.zoneIndex(G.dangerAt(o.x, o.y)) === 5 && o.type === 'deadtree'), '검은 숲에 고목');
});

test('탐험 지역: 지도가 커지기 전(3200) 세이브는 본부와의 상대 위치를 지켜서 옮긴다', () => {
  const s = G.newGame(131);
  const old = JSON.parse(G.serialize(s));
  delete old.world; // 예전 세이브에는 지도 크기가 없다
  old.player.x = 1600 + 300; old.player.y = 1600 - 120; // 예전 본부(1600,1600) 기준 위치
  const t = G.deserialize(JSON.stringify(old));
  assert.equal(t.player.x, G.CENTER.x + 300);
  assert.equal(t.player.y, G.CENTER.y - 120);
  const u = G.deserialize(G.serialize(t));
  assert.equal(u.player.x, t.player.x, '새 세이브는 그대로');
});

test('구역 전용 지형지물: 주택가~군사 구역(1~6)마다 전용 2종이 그 구역에서 가장 흔하다', () => {
  const own = { 1: ['tree', 'hedge'], 2: ['busstop', 'kiosk'], 3: ['pipes', 'tank'], 4: ['ruin', 'bus'], 5: ['pine', 'bramble'], 6: ['bunker', 'tankwreck'] };
  for (const [z, ids] of Object.entries(own)) {
    for (const id of ids) {
      const t = G.OBSTACLE_TYPES[id];
      assert.ok(t && !G.LOOT_TYPES[id], `${id}: 장애물이고 파밍 대상이 아니다`);
      assert.equal(Math.max(...t.zones), t.zones[z], `${id}: 구역 ${z}에서 가장 흔하다`);
    }
  }
  const s = G.newGame(140);
  for (const [z, ids] of Object.entries(own)) {
    const here = s.obstacles.filter((o) => G.zoneIndex(G.dangerAt(o.x, o.y)) === Number(z)).map((o) => o.type);
    assert.ok(ids.some((id) => here.includes(id)), `구역 ${z}에 전용 지형지물이 배치된다`);
  }
});

test('총알 제작소: 본부 2레벨부터, 고철 2·플라스틱 1로 1발, 1레벨 6초에 1발·강화마다 +10%, 동료 보너스 절반, 자원·상한·끄기에서 멈추며 자리 비움에도 만든다', () => {
  const s = fresh(150);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; s.raidT = 1e9;
  assert.equal(G.BUILDINGS.ammo.unlockHq, 2);
  assert.deepEqual(G.AMMO_COST, { scrap: 2, plastic: 1 });
  assert.ok(Math.abs(G.ammoRate(1) - 1 / 6) < 1e-12, '1레벨 6초에 1발');
  for (let lv = 2; lv <= 10; lv++) assert.ok(Math.abs(G.ammoRate(lv) / G.ammoRate(lv - 1) - 1.1) < 1e-12, '강화마다 +10%');
  s.hq = 2; s.bld.ammo = 1; s.ammo = 0;
  Object.assign(s.res, { wood: 0, scrap: 1000, plastic: 1000 });
  stepFor(s, 60.05);
  assert.equal(s.ammo, 10, '1레벨 60초에 10발');
  assert.ok(Math.abs(s.res.scrap - (1000 - 20)) < 2 && Math.abs(s.res.plastic - (1000 - 10)) < 2);
  s.bld.ammo = 2; s.ammo = 0; s.ammoProg = 0;
  stepFor(s, 60.05);
  assert.equal(s.ammo, 11, '2레벨 60초에 11발(1.1배)');
  // 자원이 없으면 멈춘다
  s.res.scrap = 1; const a = s.ammo;
  stepFor(s, 30);
  assert.equal(s.ammo, a);
  // 상한에서 멈춘다
  s.res.scrap = 1e5; s.res.plastic = 1e5; s.ammo = G.AMMO_MAX;
  stepFor(s, 30);
  assert.equal(s.ammo, G.AMMO_MAX);
  // 자리를 비운 동안: 2레벨 120초 = 22발, 오래 비워도 상한까지만
  s.ammo = 0; s.ammoProg = 0;
  let r = G.applyOffline(s, s.savedAt + 120e3);
  assert.equal(r.ammo, 22); assert.equal(s.ammo, 22);
  r = G.applyOffline(s, s.savedAt + 8 * 3600e3);
  assert.equal(s.ammo, G.AMMO_MAX);
  // 끄면 만들지 않고 자원도 쓰지 않는다(저장되고, 자리 비움에도 지킨다)
  assert.equal(s.ammoOn, true, '기본은 가동');
  assert.equal(G.setAmmoOn(s, false).ok, true);
  s.ammo = 0; s.ammoProg = 0; const sc = s.res.scrap;
  stepFor(s, 30);
  assert.equal(s.ammo, 0); assert.equal(s.res.scrap, sc);
  assert.equal(G.deserialize(G.serialize(s)).ammoOn, false);
  assert.equal(G.applyOffline(s, s.savedAt + 100e3).ammo, 0);
  G.setAmmoOn(s, true);
  assert.equal(G.setAmmoOn(fresh(151), true).ok, false, '제작소가 없으면 켤 수 없다');
  // 레벨은 시설 레벨(캐릭터 레벨과 무관), 근무 배치 동료의 생산 보너스는 절반만 곱해진다
  s.level = 30;
  assert.equal(G.ammoRateOf(s), G.ammoRate(2));
  s.survivors.push({ ...G.makeSurvivor(s), role: 'engineer', rarity: 2, lv: 5, post: 'work' });
  assert.ok(G.workBonus(s) > 0);
  assert.ok(Math.abs(G.ammoRateOf(s) - G.ammoRate(2) * (1 + G.workBonus(s) * 0.5)) < 1e-12);
  s.ammo = 0; s.ammoProg = 0; s.res.scrap = 1e5; s.res.plastic = 1e5;
  stepFor(s, 60.05);
  assert.equal(s.ammo, Math.floor(60 * G.ammoRateOf(s) + 1e-9));
});

test('전진기지 후보지: 판마다 무작위로, 구역(주택가~군사 구역)마다 2곳씩', () => {
  const key = (t) => t.sites.map((o) => `${o.name}@${o.x},${o.y}`).join('|');
  for (let seed = 1; seed <= 40; seed++) {
    const s = G.newGame(seed);
    assert.equal(s.sites.length, 12);
    const per = {};
    for (const o of s.sites) per[G.zoneIndex(o.d)] = (per[G.zoneIndex(o.d)] ?? 0) + 1;
    assert.deepEqual(per, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 }, `시드 ${seed}: 구역마다 2곳`);
    assert.equal(new Set(s.sites.map((o) => o.name)).size, 12, '이름이 겹치지 않는다');
    for (const o of s.sites) {
      assert.ok(o.x >= 200 && o.y >= 200 && o.x <= G.WORLD.w - 200 && o.y <= G.WORLD.h - 200, `${o.name}: 지도 안`);
      assert.ok(G.SITE_POOL[G.zoneIndex(o.d)].some((p) => p.name === o.name), `${o.name}: 구역에 맞는 이름`);
      assert.ok(!s.obstacles.some((q) => G.dist(o.x, o.y, q.x, q.y) < 150), `${o.name}: 장애물이 막지 않는다`);
      assert.ok(!s.nodes.some((n) => G.dist(o.x, o.y, n.x, n.y) < 70), `${o.name}: 대상물이 겹치지 않는다`);
      for (const q of s.sites) if (q !== o) assert.ok(G.dist(o.x, o.y, q.x, q.y) >= (G.zoneIndex(o.d) === G.zoneIndex(q.d) ? 700 : 450), '서로 떨어져 있다');
    }
    assert.equal(key(G.newGame(seed)), key(s), '같은 시드면 같은 자리(저장·불러오기)');
  }
  assert.notEqual(key(G.newGame(1)), key(G.newGame(2)), '새 게임마다 자리가 바뀐다');
  // 먼 곳일수록 비싸고 많이 만든다
  const s = G.newGame(7), near = 0, far = s.sites.length - 1;
  assert.ok(G.outpostCost(s, far).scrap > G.outpostCost(s, near).scrap);
  const sum = (p) => Object.values(p).reduce((a, b) => a + b, 0);
  assert.ok(sum(G.outpostProd(s, far, 1)) > sum(G.outpostProd(s, near, 1)));
  // 불러올 때 후보지는 시드로 다시 만든다(저장에 없다)
  assert.equal(key(G.deserialize(G.serialize(s))), key(s));
});

test('전진기지 후보지: 고정 9곳이던 예전 세이브는 세운 기지·공사를 같은 구역 새 후보지로 옮긴다', () => {
  const s = rich(fresh(33)); s.hq = 10;
  const o = JSON.parse(G.serialize(s));
  delete o.sitesV;
  o.outposts = [{ site: 0, lv: 2 }, { site: 8, lv: 1 }, { site: 1, lv: 3 }]; // 편의점(주택가)·보급창(군사)·주유소(상가)
  o.jobs = [{ lane: 'outpost', kind: 'obuild', key: 3, next: 1, t: 30, total: 60 }]; // 물류 창고(공단) 공사 중
  o.nodes = s.nodes.map(() => 999);
  const t = G.deserialize(JSON.stringify(o));
  assert.deepEqual(t.outposts.map((x) => [G.zoneIndex(t.sites[x.site].d), x.lv]), [[1, 2], [6, 1], [2, 3]]);
  const j = t.jobs.find((x) => x.kind === 'obuild');
  assert.ok(j && G.zoneIndex(t.sites[j.key].d) === 3, '공사도 같은 구역으로');
  assert.ok(t.nodes.every((n) => n.readyAt <= t.time), '대상물 배치가 달라져 예전 타이머는 버린다');
  // 새 세이브는 그대로
  const u = G.deserialize(G.serialize(t));
  assert.deepEqual(u.outposts, t.outposts);
});

// ---------- 장비 개편(2026-10-25): 무기 16종 · 강화 · 방어구 · 아이템 ----------
test('무기: 계열마다 8종(제작 3 · 드랍 3 · 유니크 2), 점수 = 공격력 × 공격속도 × 명중률 × (1 + 치명타율)이 티어 목표의 ±3%', () => {
  for (const kind of ['melee', 'gun']) {
    const ids = Object.keys(G.WEAPONS).filter((k) => k !== 'fist' && G.WEAPONS[k].kind === kind);
    assert.equal(ids.length, 8, kind);
    assert.deepEqual(ids.map((k) => G.WEAPONS[k].tier).sort(), [1, 2, 3, 4, 5, 6, 7, 8], kind);
    for (const src of ['craft', 'drop', 'unique']) {
      const g = ids.filter((k) => G.weaponSource(k) === src), str = g.map((k) => G.WEAPONS[k].str);
      assert.equal(new Set(str).size, str.length, `${kind}·${src}: 강점이 겹치지 않는다 ${str}`);
    }
  }
  for (const [id, w] of Object.entries(G.WEAPONS)) {
    if (id === 'fist') continue;
    const sc = G.weaponScore(id);
    assert.ok(Math.abs(sc / G.tierScore(w.tier) - 1) < 0.03, `${id}: ${sc.toFixed(1)} / ${G.tierScore(w.tier).toFixed(1)}`);
    assert.equal(w.range, w.kind === 'gun' ? G.GUN_RANGE : G.MELEE_RANGE, `${id}: 사거리는 계열마다 하나`);
    if (w.kind === 'gun') assert.ok(Math.abs(w.mag / ((w.mag - 1) * w.cd + w.reload) - w.spd) < 1e-9 && w.cd > 0, `${id}: 재장전 포함 지속 속도`);
    assert.ok(!('cleave' in w) && !('splash' in w) && !('guard' in w) && !('leech' in w), `${id}: 점수 밖 변수 없음`);
  }
  // 티어가 오를수록 점수가 커진다(간격은 점점 줄어든다)
  const t = [1, 2, 3, 4, 5, 6, 7, 8].map(G.tierScore);
  for (let i = 1; i < 8; i++) assert.ok(t[i] > t[i - 1] && (i < 2 || t[i] / t[i - 1] < t[i - 1] / t[i - 2]));
});

test('강화: 한 단계마다 기본의 10%씩(최대 +5 = 150%), 비용은 장비마다 배합이 다르고(끝자리 0) 높은 티어일수록·단계에 비례해 비싸다', () => {
  assert.deepEqual([1, 2, 3, 4, 6].map((lv) => Math.round(G.upgradeMult(lv) * 100)), [100, 110, 120, 130, 150]);
  assert.equal(G.WEAPON_MAX_LV, 6);
  const s = rich(fresh(201));
  G.gainWeapon(s, 'pipe');
  for (let i = 0; i < 5; i++) { assert.equal(G.upgradeWeapon(s, 'pipe').ok, true); finish(s); }
  assert.equal(s.weapons.pipe, 6);
  assert.equal(G.upgradeWeapon(s, 'pipe').ok, false, '+5가 최대');
  assert.ok(Math.abs(G.weaponDamage(s, 'pipe') - G.WEAPONS.pipe.atk * 1.5) < 1e-9);
  // 총량 = 3 × 40 × 티어^1.25 × 목표 단계(10 단위), 장비마다 배합(합 3)으로 나눠 자원마다 끝자리 0
  const total = (c) => Object.values(c).reduce((a, v) => a + v, 0);
  for (const [id, w] of [...Object.entries(G.WEAPONS), ...Object.entries(G.ARMORS)]) {
    assert.ok(Math.abs(w.mix.reduce((a, v) => a + v, 0) - 3) < 1e-9 && new Set(w.mix).size > 1, `${id}: 배합 합 3, 셋이 다 같지 않다`);
    const tier = G.WEAPONS[id] ? w.tier : G.ARMOR_TIER[w.source];
    for (let next = 2; next <= (G.WEAPONS[id] ? G.WEAPON_MAX_LV : G.ARMOR_MAX_LV); next++) {
      const c = G.upgradeCostFor(tier, next, w.mix), want = 3 * 40 * Math.max(0.5, tier) ** 1.25 * (next - 1);
      assert.ok(Object.values(c).every((v) => v > 0 && v % 10 === 0), `${id} +${next - 1}: ${JSON.stringify(c)}`);
      assert.ok(Math.abs(total(c) - want) <= 5, `${id} +${next - 1}: 총량 ${total(c)} / ${want.toFixed(1)}`);
    }
  }
  const c = (tier, next) => total(G.upgradeCostFor(tier, next, G.WEAPONS.machete.mix));
  assert.ok(Math.abs(c(3, 6) - c(3, 2) * 5) <= 30, '+5는 +1의 5배(10 단위 반올림 오차 안)');
  assert.ok(c(8, 2) > c(4, 2) && c(4, 2) > c(1, 2), '높은 티어일수록 비싸다');
  assert.deepEqual(G.weaponUpgradeCost({ weapons: { pipe: 1 } }, 'pipe'), { wood: 30, scrap: 60, plastic: 30 }, '쇠파이프는 고철이 많다');
  // 예전 세이브의 +6 이상은 +5로 잘린다
  const o = JSON.parse(G.serialize(s)); o.weapons.pipe = 10;
  assert.equal(G.deserialize(JSON.stringify(o)).weapons.pipe, 6);
});

test('방어구: 얻으면 바로 효과(10% · 1강 11% · 2강 12%), 같은 부위는 유니크가 대신하고, 여러 부위는 곱해서 겹친다', () => {
  const s = rich(fresh(202));
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; s.hq = 5;
  assert.deepEqual([1, 2, 3].map((lv) => Math.round(G.armorBonus(lv) * 1000) / 10), [10, 11, 12]);
  const hp0 = G.maxHp(s);
  G.gainArmor(s, 'vest');
  assert.ok(Math.abs(G.maxHp(s) - hp0 * 1.1) < 1e-9, '방탄조끼: 최대 체력 +10%');
  G.gainArmor(s, 'gloves');
  assert.ok(Math.abs(G.atkSpeedMult(s) - 1.1) < 1e-9, '안전장갑: 공격 속도 +10%');
  G.gainArmor(s, 'shield'); G.gainArmor(s, 'milVest');
  assert.ok(Math.abs(G.playerGuard(s) - (1 - 0.9 * 0.9)) < 1e-9, '방패 10% × 군용 방탄복 10% = 19%');
  assert.ok(Math.abs(G.maxHp(s) - hp0 * 1.1) < 1e-9, '가슴은 군용 방탄복이 방탄조끼를 대신한다(겹치지 않음)');
  G.gainArmor(s, 'boots');
  s.player.x = 900; s.player.y = 900;
  const x0 = s.player.x; G.step(s, 1, { x: 1, y: 0 });
  assert.ok(Math.abs(s.player.x - x0 - 91 * 1.1) < 1, '가죽부츠: 이동 +10%');
  // 강화: 2강까지, 강화하면 증강이 커진다
  assert.equal(G.upgradeArmor(s, 'gloves').ok, true); finish(s);
  assert.equal(G.upgradeArmor(s, 'gloves').ok, true); finish(s);
  assert.equal(s.armor.gloves, G.ARMOR_MAX_LV);
  assert.equal(G.upgradeArmor(s, 'gloves').ok, false, '2강이 최대');
  assert.ok(Math.abs(G.atkSpeedMult(s) - 1.12) < 1e-9);
  assert.equal(G.upgradeArmor(s, 'helmet').ok, false, '얻지 못한 방어구는 강화할 수 없다');
  const t = G.deserialize(G.serialize(s));
  assert.deepEqual(t.armor, s.armor);
});

test('공격 간격: 1/30초 단계에서도 남은 시간을 넘겨 빠른 무기·공격속도 증강이 그대로 반영된다', () => {
  const swings = (setup) => {
    const s = fresh(203);
    s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
    G.gainWeapon(s, 'chainsaw'); G.equipWeapon(s, 'chainsaw'); s.dur.chainsaw = 1e9;
    setup(s);
    s.player.x = 900; s.player.y = 900;
    zombieAt(s, 920, 900, 1e12);
    let n = 0;
    for (let i = 0; i < 300; i++) for (const e of G.step(s, DT)) if (e.t === 'swing') n++; // 10초
    return n;
  };
  assert.ok(Math.abs(swings(() => {}) - 50) <= 1, '전기톱 초당 5회');
  const fast = swings((s) => { G.gainArmor(s, 'gloves'); s.player.stim = 30; });
  assert.ok(Math.abs(fast - 50 * 1.1 * 1.5) <= 1.5, `장갑 + 스팀팩 ${fast}회`);
});

test('탄약: 어떤 총이든 쉬지 않고 쏘면 초당 1.6개를 쓴다(빠른 총은 탄약 1개로 여러 발)', () => {
  for (const id of ['flamer', 'crossbow', 'carbine']) {
    const s = fresh(204);
    s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; s.ammoOn = false;
    G.gainWeapon(s, id); G.equipWeapon(s, id); s.ammo = 200;
    s.player.x = 600; s.player.y = 600;
    zombieAt(s, 800, 600, 1e12);
    const a0 = s.ammo + s.player.mag * G.ammoPerShot(id);
    stepFor(s, 30);
    const used = a0 - (s.ammo + s.player.mag * G.ammoPerShot(id));
    assert.ok(Math.abs(used / 30 - G.AMMO_PER_SEC) < 0.15, `${id}: 초당 ${(used / 30).toFixed(2)}개`);
  }
});

test('아이템: 파밍 드랍은 5종이 같은 확률, 습격 방어는 공구 상자 1~3개, 구출한 생존자는 1~2개를 답례로 준다', () => {
  // 파밍 드랍
  const s = fresh(205);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9;
  const far = s.nodes.filter((n) => G.zoneIndex(n.d) >= 5);
  const got = Object.fromEntries(G.ITEM_KEYS.map((k) => [k, 0]));
  for (let i = 0; i < 900; i++) {
    const n = far[i % far.length];
    n.readyAt = 0; n.amt = 1; s.player.x = n.x; s.player.y = n.y; s.gather = null; s.bag.wood = s.bag.scrap = s.bag.plastic = 0;
    for (const k of G.ITEM_KEYS) s.items[k] = 0;
    for (let t = 0; t < 2.2; t += DT) for (const e of G.step(s, DT)) if (e.t === 'item') got[e.id]++;
  }
  const total = Object.values(got).reduce((a, v) => a + v, 0);
  for (const k of G.ITEM_KEYS) assert.ok(got[k] > total / 5 * 0.5, `${k} ${got[k]}/${total}`);
  // 습격 방어 보상
  const t = fresh(206);
  t.autoHunt = false; t.spawnT = 1e9; t.rescueT = 1e9; t.hq = 2;
  const ns = [0, 0, 0, 0];
  for (let i = 0; i < 300; i++) {
    t.items.toolbox = 0; t.raid = { queue: [], spawnT: 9, ang: 0, total: 1, hpTotal: 100 };
    const e = G.step(t, DT).find((x) => x.t === 'raid-won');
    ns[e.reward.itemN]++;
  }
  assert.equal(ns[0], 0);
  for (const n of [1, 2, 3]) assert.ok(ns[n] > 60, `공구 상자 ${ns}`);
  // 구출 답례(포위·조난 모두)
  const u = fresh(207);
  u.autoHunt = false; u.spawnT = 1e9; u.bld.dorm = 9;
  const cnt = [0, 0, 0];
  for (let i = 0; i < 300; i++) {
    u.survivors = []; u.rescueT = 1e9; for (const k of G.ITEM_KEYS) u.items[k] = 0;
    u.rescue = { kind: i % 2 ? 'siege' : 'stranded', x: u.player.x, y: u.player.y, d: 1, ttl: 100 };
    const e = G.step(u, DT).find((x) => x.t === 'rescued');
    cnt[e.gifts.length]++;
    for (const id of e.gifts) assert.ok(G.ITEM_KEYS.includes(id));
  }
  assert.equal(cnt[0], 0);
  assert.ok(cnt[1] > 110 && cnt[2] > 110, `답례 ${cnt}`);
});

test('생산 건물: 레벨마다 늘어나는 생산량이 ×1.2씩 커져, 10레벨 한 단계 회수 시간이 예전의 1/5로 준다(제재소 30분 · 고철 42분 · 재활용 56분)', () => {
  assert.equal(G.prodLevelMult(0), 0);
  assert.equal(G.prodLevelMult(1), 1);
  assert.ok(Math.abs(G.prodLevelMult(2) - 2.2) < 1e-9);
  assert.ok(Math.abs(G.prodLevelMult(10) - 25.9587) < 1e-3);
  const s = fresh(208);
  s.bld.sawmill = 3;
  assert.ok(Math.abs(G.productionPerSec(s).wood - G.BUILDINGS.sawmill.prod.wood * 3.64) < 1e-9);
  for (const id of ['sawmill', 'scrapyard', 'recycler']) {
    const v = Object.values(G.BUILDINGS[id].prod)[0] * 60;
    for (let lv = 1; lv <= 10; lv++) {
      const gain = v * (G.prodLevelMult(lv) - G.prodLevelMult(lv - 1));
      const cost = Object.values(G.buildCost(id, lv)).reduce((a, x) => a + x, 0);
      const before = cost / v; // 예전: 레벨마다 같은 양(기본)만 늘었다
      assert.ok(cost / gain < 60 && cost / gain <= before + 1e-9, `${id} ${lv}레벨: 회수 ${(cost / gain).toFixed(0)}분(예전 ${before.toFixed(0)}분)`);
    }
  }
});

test('날짜: 새 판은 1일차, 게임이 진행된 1분마다 하루, 꺼 둔 시간은 세지 않는다', () => {
  const s = fresh(209);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; s.raidT = 1e9;
  assert.equal(G.dayOf(s), 1);
  assert.deepEqual([0, 59, 60, 119, 9120].map(G.daysOf), [1, 1, 2, 2, 153], '지난 기록(초)도 일수로');
  stepFor(s, 59.9);
  assert.equal(G.dayOf(s), 1);
  stepFor(s, 0.2);
  assert.equal(G.dayOf(s), 2);
  // 자리 비움 1시간: 작업·리스폰 시계는 흐르지만 날짜는 그대로
  s.savedAt = Date.now() - 3600 * 1000;
  G.applyOffline(s);
  assert.equal(G.dayOf(s), 2);
  const t = G.deserialize(G.serialize(s));
  assert.equal(G.dayOf(t), 2, '저장·불러오기 뒤에도 같은 날');
});

test('생존자 특성: 젊은 남자 공격력 +10% · 중년 남자 받는 피해 −10% · 젊은 여자 이동 +10% · 중년 여자 파밍 +10%', () => {
  const pick = (id) => { const s = fresh(210); s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; G.setHero(s, id, '테스트'); return s; };
  const base = fresh(210);
  const ym = pick('youngM');
  assert.ok(Math.abs(G.weaponDamage(ym, 'fist') / G.weaponDamage(base, 'fist') - 1.1) < 1e-9);
  assert.ok(Math.abs(G.attackDps(ym, 'fist') / G.attackDps(base, 'fist') - 1.1) < 1e-9);
  const om = pick('oldM');
  assert.ok(Math.abs(G.playerGuard(om) - 0.1) < 1e-9);
  G.gainArmor(om, 'shield');
  assert.ok(Math.abs(G.playerGuard(om) - (1 - 0.9 * 0.9)) < 1e-9, '방패와 곱해서 겹친다');
  const yf = pick('youngF');
  yf.player.x = 900; yf.player.y = 900;
  const x0 = yf.player.x; G.step(yf, 1, { x: 1, y: 0 });
  assert.ok(Math.abs(yf.player.x - x0 - 91 * 1.1) < 1, '이동 +10%');
  const of = pick('oldF');
  assert.ok(Math.abs(G.farmMult(of) - 1.1) < 1e-9);
  for (const s of [ym, om, yf]) assert.equal(G.farmMult(s), 1);
  assert.equal(G.playerGuard(base), 0, '생존자를 고르기 전에는 특성 없음');
});

test('후보지 발견: 300px 안으로 다가가야 발견(미니맵), 세운 곳은 늘 발견, 저장된다', () => {
  const s = fresh(211);
  s.autoHunt = false; s.spawnT = 1e9; s.rescueT = 1e9; s.raidT = 1e9;
  assert.deepEqual(s.seenSites, []);
  assert.ok(s.sites.every((o, i) => !G.siteSeen(s, i)), '처음엔 하나도 모른다');
  const o = s.sites[3];
  s.player.x = o.x + G.SITE_SEEN_R + 40; s.player.y = o.y;
  assert.ok(!G.step(s, DT).some((e) => e.t === 'site-found'));
  s.player.x = o.x + G.SITE_SEEN_R - 40;
  const ev = G.step(s, DT);
  assert.ok(ev.some((e) => e.t === 'site-found' && e.site === 3));
  assert.ok(G.siteSeen(s, 3) && !G.siteSeen(s, 4));
  assert.ok(!G.step(s, DT).some((e) => e.t === 'site-found'), '한 번만 알린다');
  s.hq = 4; s.outposts.push({ site: 7, lv: 1 }); // 본부 4레벨: 전진기지 한도 2
  assert.ok(G.siteSeen(s, 7), '세운 곳은 발견한 것');
  const t = G.deserialize(G.serialize(s));
  assert.ok(G.siteSeen(t, 3) && G.siteSeen(t, 7) && !G.siteSeen(t, 4));
  const old = JSON.parse(G.serialize(s)); delete old.seenSites;
  const u = G.deserialize(JSON.stringify(old));
  assert.deepEqual(u.seenSites, [7], '기록이 없던 세이브는 세운 곳만');
});
