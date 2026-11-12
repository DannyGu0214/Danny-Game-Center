import { HULLS, MODULES, NO_GO } from './data.js';
// 배 설계 규칙: 선체 윤곽, 칸 검사, 무게·복원력·속도·항속 계산. 화면이 없다.
// 설계: { hull, mods: [{ id, col, row, rot }] }. 0행이 뱃머리 쪽, 0열이 좌현이다.

const PI = Math.PI;

// 선체 윤곽의 반폭. s: -1 고물 ~ 1 뱃머리
export function planW(hullId, s) {
  const H = HULLS[hullId];
  if (H.kind === 'raft') return Math.abs(s) <= 1 ? H.beam / 2 : 0;
  if (H.kind === 'rowboat') return (H.beam / 2) * Math.pow(Math.max(0, 1 - Math.abs(s * 0.98) ** 2.4), 0.8);
  return (H.beam / 2) * Math.pow(Math.max(0, Math.sin(PI * (0.2 + 0.8 * (s + 1) / 2))), 0.72);
}

// 칸 번호 → 배 좌표(칸 가운데)
export const cellX = (H, row) => H.x0 - (row + 0.5) * H.cell;
export const cellY = (H, col) => (col + 0.5 - H.cols / 2) * H.cell;

// 선체 윤곽 안에 들어가는 칸만 쓴다
export function validCells(hullId) {
  const H = HULLS[hullId], out = [];
  for (let row = 0; row < H.rows; row++) for (let col = 0; col < H.cols; col++) {
    const x = cellX(H, row), y = cellY(H, col);
    let ok = true;
    for (const dx of [-0.5, 0.5]) for (const dy of [-0.5, 0.5]) {
      const s = (x + dx * H.cell) / (H.len / 2);
      if (Math.abs(s) > 1 || Math.abs(y + dy * H.cell) > planW(hullId, s) * 0.98) ok = false;
    }
    if (ok) out.push([col, row]);
  }
  return out;
}

export const sizeOf = (m) => { const M = MODULES[m.id]; return m.rot ? [M.h, M.w] : [M.w, M.h]; };
function cellsOf(m) {
  const [w, h] = sizeOf(m), out = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out.push([m.col + c, m.row + r]);
  return out;
}
// 이 자리에 놓을 수 있나
export function canPlace(design, m) {
  const ok = new Set(validCells(design.hull).map(([c, r]) => `${c},${r}`)), used = new Set();
  for (const o of design.mods) for (const [c, r] of cellsOf(o)) used.add(`${c},${r}`);
  for (const [c, r] of cellsOf(m)) { if (!ok.has(`${c},${r}`) || used.has(`${c},${r}`)) return false; }
  const M = MODULES[m.id];
  if (M.sail && mastProblem(design, m)) return false;
  return true;
}
// 돛대 규칙: 보통은 하나, 스쿠너(maxMasts 2)는 둘까지. 둘이면 돛대끼리 MAST_GAP m 넘게 떨어져야 돛이 서로 안 걸려요
export const MAST_GAP = 3.6;
export function mastProblem(design, m) {
  const H = HULLS[design.hull], masts = design.mods.filter((o) => MODULES[o.id].sail && o !== m);
  if (masts.length >= (H.maxMasts || 1)) return (H.maxMasts || 1) > 1 ? 'many' : 'one';
  const x = modulePos(design.hull, m)[0];
  if (masts.some((o) => Math.abs(modulePos(design.hull, o)[0] - x) < MAST_GAP)) return 'near';
  return null;
}
export const moduleAt = (design, col, row) => design.mods.find((m) => cellsOf(m).some(([c, r]) => c === col && r === row));

// 모듈 가운데의 배 좌표
export function modulePos(hullId, m) {
  const H = HULLS[hullId], [w, h] = sizeOf(m);
  return [H.x0 - (m.row + h / 2) * H.cell, (m.col + w / 2 - H.cols / 2) * H.cell];
}

// 모든 계기 값. cargo: 실은 화물 수, food: 실은 식량
export function statsOf(design, cargo = 0, food = 0) {
  const H = HULLS[design.hull], cnt = {};
  let kg = 2, moment = 0;
  const masts = [];
  for (const m of design.mods) {
    const M = MODULES[m.id], [, y] = modulePos(design.hull, m);
    cnt[m.id] = (cnt[m.id] || 0) + 1;
    kg += M.kg; moment += M.kg * y;
    if (M.sail) masts.push(m);
  }
  // 돛 넓이: 큰 돛 하나 + 나머지는 85%(앞돛이 뒷돛 바람을 조금 가려요, M2b 스쿠너). mast는 가장 큰 돛대(선장이 걸어가는 곳)
  masts.sort((a, b) => MODULES[b.id].sail - MODULES[a.id].sail);
  const mast = masts[0] || null, sailArea = masts.reduce((a, m, i) => a + MODULES[m.id].sail * (i ? 0.85 : 1), 0);
  kg += cargo * 0.1 + food * 0.2;
  const load = kg / H.buoy;
  const oars = cnt.oar || 0;
  const hullSpeed = 2.45 * Math.sqrt(H.len) * H.drag;
  const heavy = load > 0.9 ? Math.max(0.5, 1 - (load - 0.9) * 2) : 1;
  const listing = Math.min(1, Math.abs(moment) / (H.buoy * H.beam * 0.08)); // 한쪽으로 쏠린 정도(0~1)
  const stability = H.stability * (1 + 0.25 * (cnt.ballast || 0)) * (1 - 0.3 * listing);
  return {
    hull: H, kg, load, draft: H.draft * (1 + 0.5 * load),
    maxSpeed: hullSpeed * heavy * (1 - 0.12 * listing),
    rowSpeed: oars ? H.row * (oars > 1 ? 1.25 : 1) * heavy : 0,
    oars, sailArea, mast, masts, mastId: mast ? mast.id : null,
    // 보조 기관(M2b 스쿠너): 돛이 이 속도보다 약할 때만 돌아요(연료 없음). 타륜은 큰 배 키를 잘 듣게 해요
    motor: H.motor || 0, minCrew: H.minCrew || 0, turnK: cnt.wheel ? MODULES.wheel.turnK : 1,
    mastX: mast ? modulePos(design.hull, mast)[0] : 0,
    stability, listing,
    noGo: NO_GO - (H.pointing || 0), leeK: H.leeK || 1,
    holdCap: H.holdBase + 20 * (cnt.hold || 0) + 34 * (cnt.hold2 || 0),
    foodCap: H.foodBase + 6 * (cnt.food || 0) + 12 * (cnt.food2 || 0),
    crewCap: Math.min(H.crew, (cnt.hammock || 0) + (cnt.cabin || 0)),
    // M2a: 식수 칸(선체 기본 + 물통 4통씩), 내항성(너울을 견디는 높이 m: 등급 × 0.45 + 별마다 0.1 + 바닥짐 0.1)
    waterCap: (H.waterBase || 0) + 4 * (cnt.water || 0),
    sea: H.sea ?? H.grade * 0.45 + 0.1 * ((H.star || 1) - 1) + (cnt.ballast ? 0.1 : 0),
    awning: !!cnt.awning, bulkhead: !!cnt.bulkhead, net: !!cnt.net, telescope: !!(cnt.telescope || cnt.crowsnest), crowsnest: !!cnt.crowsnest, forecast: 1 + (cnt.barometer ? 2 : 0),
    desal: cnt.desal || 0, lifeboat: !!cnt.lifeboat, doubleHull: !!H.doubleHull,
    canMove: oars > 0 || sailArea > 0 || !!H.motor,
    overload: load >= 1,
  };
}
