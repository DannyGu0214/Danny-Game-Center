// 공간: 격자, 확장 영역, 구역(육지·해저·수중 층), 놓기 판정, 자리 찾기, 걷기·헤엄 판정.
// 지형은 eco.terrain 약속(GRID·EXT·SEA_LEVEL·MAX_DEPTH·kindAt·cellHeight, PLAN 4.3절)으로만 읽는다. 화면용 heightAt은 쓰지 않는다.
// 좌표: 칸 (x, y)는 바닥면, z는 높이(칸 단위, 위가 +). 육지·물속은 칸 바닥 높이가 수면(SEA_LEVEL)보다 높은지로 정한다.
// SEA_LEVEL이 null이면 물이 없는 생태계(모든 칸이 육지)다.
import { cached, clamp } from './util.js';

export const SUB = 3; // cellHeight 단위: 1/3칸
export const LAYER_IDS = ['top', 'mid', 'low']; // 수중 층 칸: 표층·중층·저층(위에서부터)
export const ZONE_IDS = ['land', 'bed', 'water']; // 육지·해저(물 밑 바닥)·수중(물기둥)
const CLEAR = 0.3; // 헤엄치는 생물이 바닥에서 띄우는 높이(칸)
const ITEM_CLEAR = 1; // 해저 물건·고착 생물 위로 띄우는 높이(칸)

// 확장 영역 칸 범위: 본 블록 옆면 하나에 같은 길이로 붙는다(PLAN 0절)
export function extRect(G, E) {
  if (!E || !(E.depth > 0)) return null;
  const d = E.depth;
  if (E.side === '+y') return { x0: 0, x1: G.w, y0: G.h, y1: G.h + d };
  if (E.side === '-y') return { x0: 0, x1: G.w, y0: -d, y1: 0 };
  if (E.side === '+x') return { x0: G.w, x1: G.w + d, y0: 0, y1: G.h };
  if (E.side === '-x') return { x0: -d, x1: 0, y0: 0, y1: G.h };
  throw new Error(`EXT.side를 알 수 없어요: ${E.side}`);
}

export function createSpace(eco) {
  const T = eco.terrain, G = T.GRID, K = eco.kinds, ITEMS = eco.items;
  const ext = extRect(G, T.EXT);
  const x0 = Math.min(0, ext ? ext.x0 : 0), y0 = Math.min(0, ext ? ext.y0 : 0);
  const x1 = Math.max(G.w, ext ? ext.x1 : 0), y1 = Math.max(G.h, ext ? ext.y1 : 0);
  const W = x1 - x0, H = y1 - y0, N = W * H;
  const hasWater = T.SEA_LEVEL != null;
  const seaZ = hasWater ? T.SEA_LEVEL : null, seaSub = hasWater ? Math.round(T.SEA_LEVEL * SUB) : null;
  const layerIds = LAYER_IDS.filter((L) => eco.layers && eco.layers[L]);
  const nb = layerIds.length, lowL = layerIds[nb - 1];
  const maxStep = eco.place?.maxStep ?? 1;

  // ---------- 고정 격자(지형은 바뀌지 않는다) ----------
  const kind = new Array(N).fill('void'), hgt = new Int16Array(N), depth = new Float32Array(N);
  const area = new Uint8Array(N); // 0 블록 밖 · 1 본 블록 · 2 확장 영역
  const wet = new Uint8Array(N), walkK = new Uint8Array(N), placeK = new Uint8Array(N), swimK = new Uint8Array(N);
  const layerOk = {};
  for (const L of layerIds) layerOk[L] = new Uint8Array(N);
  const idx = (x, y) => (y - y0) * W + (x - x0);
  const cellOf = (x, y) => (x >= x0 && y >= y0 && x < x1 && y < y1 ? idx(x, y) : -1);
  const cellAt = (x, y) => cellOf(Math.floor(x), Math.floor(y));
  const cx = (i) => (i % W) + x0, cy = (i) => Math.floor(i / W) + y0;
  const inMain = (x, y) => x >= 0 && y >= 0 && x < G.w && y < G.h;
  const inExtRect = (x, y) => !!ext && x >= ext.x0 && y >= ext.y0 && x < ext.x1 && y < ext.y1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const main = inMain(x, y);
    if (!main && !inExtRect(x, y)) continue;
    const k = T.kindAt(x, y), d = K[k];
    if (!d || d.out) continue;
    const i = idx(x, y);
    kind[i] = k; area[i] = main ? 1 : 2; hgt[i] = T.cellHeight(x, y) | 0;
    walkK[i] = d.walk ? 1 : 0; placeK[i] = d.place ? 1 : 0;
    if (hasWater && hgt[i] < seaSub) {
      wet[i] = 1; depth[i] = (seaSub - hgt[i]) / SUB; swimK[i] = d.swim === false ? 0 : 1;
      for (const L of layerIds) layerOk[L][i] = swimK[i] && depth[i] >= eco.layers[L].minDepth ? 1 : 0;
    }
  }
  const bottomZ = (i) => hgt[i] / SUB;
  // 물기둥을 층 수만큼 같은 두께로 나눈 띠 번호(0 = 표층)
  const bandOf = (i, z) => (depth[i] > 0 ? clamp(Math.floor((seaZ - z) / (depth[i] / nb)), 0, nb - 1) : -1);
  const kindName = (k) => K[k]?.name ?? k;

  // ---------- 확장 영역 ----------
  const extOpen = (S) => !!ext && !!eco.ext && S.tier >= eco.ext.tier;
  const lockedCell = (S, i) => area[i] === 2 && !extOpen(S);
  const isExtCell = (i) => area[i] === 2;

  // ---------- 놓는 것의 모양 ----------
  // def = { w, h, zone, on, tall, layers }. 물건은 eco.items[id], 고착 생물은 foot×foot 해저(또는 ground) 칸
  const sessileDef = (sp) => { const s = eco.species[sp], f = s.foot || 1; return { w: f, h: f, zone: s.ground || (hasWater ? 'bed' : 'land'), on: s.on || null }; };
  const layersOf = (def) => (def.zone === 'water' ? (def.layers || layerIds) : [null]);
  function foot(def, x, y, fn) {
    for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) if (fn(cellOf(xx, yy)) === false) return false;
    return true;
  }
  // 지형만 보고 놓을 수 있는가(null = 됨, 아니면 까닭 코드)
  function staticWhy(def, x, y, layer) {
    let lo = Infinity, hi = -Infinity, why = null;
    foot(def, x, y, (i) => {
      if (i < 0 || !area[i]) { why = 'out'; return false; }
      const k = kind[i], onOk = !def.on || def.on.includes(k);
      if (def.zone === 'water') {
        if (!layerOk[layer] || !layerOk[layer][i]) { why = wet[i] && swimK[i] ? 'layer' : 'terrain'; return false; }
        if (!onOk) { why = 'terrain'; return false; }
      } else if ((def.zone === 'land') === !!wet[i] || !placeK[i] || !onOk) { why = 'terrain'; return false; }
      else if (def.maxDepth != null && depth[i] > def.maxDepth) { why = 'deep'; return false; }
      lo = Math.min(lo, hgt[i]); hi = Math.max(hi, hgt[i]);
    });
    if (why) return why;
    if (def.zone !== 'water' && hi - lo > maxStep) return 'uneven';
    return null;
  }
  // 점유: 땅(육지·해저 물건과 고착 생물) 한 장 + 수중 층마다 한 장
  function occ(S) {
    return cached(S, 'occ', () => {
      const g = new Array(N).fill(null), w = {};
      for (const L of layerIds) w[L] = new Array(N).fill(null);
      for (const it of S.items) { const d = ITEMS[it.id], arr = d.zone === 'water' ? w[it.layer] : g; foot(d, it.x, it.y, (i) => { if (i >= 0) arr[i] = it; }); }
      for (const a of S.animals) if (a.fx != null) foot(sessileDef(a.sp), a.fx, a.fy, (i) => { if (i >= 0) g[i] = a; });
      return { g, w };
    });
  }
  const isTall = (o) => !!o && !o.sp && !!ITEMS[o.id].tall;
  // emerge = 해저에서 수면 위로 솟는 물건(기둥·뿌리): 그 위 물기둥의 모든 층을 막는다
  const isEmerge = (o) => !!o && !o.sp && !!ITEMS[o.id].emerge;
  const isWalkItem = (o) => !!o && !o.sp && !!ITEMS[o.id].walk;
  function dynamicWhy(S, def, x, y, layer) {
    const o = occ(S);
    let why = null;
    foot(def, x, y, (i) => {
      if (lockedCell(S, i)) { why = 'locked'; return false; }
      if (def.zone === 'water') {
        if (o.w[layer][i]) { why = 'occupied'; return false; }
        if (isEmerge(o.g[i])) { why = 'emerge'; return false; }
        if (layer === lowL && isTall(o.g[i])) { why = 'tall'; return false; }
      } else {
        if (o.g[i]) { why = 'occupied'; return false; }
        if (def.tall && lowL && o.w[lowL][i]) { why = 'under'; return false; }
        if (def.emerge && layerIds.some((L) => o.w[L][i])) { why = 'underAny'; return false; }
      }
    });
    return why;
  }
  const WHY = {
    out: () => '놓을 수 없는 자리예요',
    terrain: (def) => (def.on ? `${def.on.filter((k) => K[k]?.place || def.zone === 'water').map(kindName).join('·')}에 놓아요` : '놓을 수 없는 지형이에요'),
    layer: (def, L) => `여기는 물이 얕아서 ${eco.layers[L].name}이 없어요`,
    uneven: () => '바닥이 고르지 않아요',
    locked: () => `T${eco.ext.tier}에 열리는 확장 영역이에요`,
    occupied: () => '이미 다른 것이 있어요',
    tall: () => '키 큰 물건 위라 저층이 막혀 있어요',
    emerge: () => '수면 위로 솟은 물건이 있어 물기둥이 막혀 있어요',
    underAny: () => '이 자리 물기둥에 물건이 있어 수면 위로 솟는 물건을 못 놓아요',
    deep: (def) => `물이 깊어요(수심 ${def.maxDepth}칸까지)`,
    under: () => '이 자리 저층에 물건이 있어 키 큰 물건을 못 놓아요',
  };
  // 물건 놓기 판정: null이면 됨, 아니면 안내 문장
  function placeWhy(S, id, x, y, layer = null) {
    const d = ITEMS[id];
    if (d.zone === 'water') { if (!layer) return '층을 골라 주세요'; if (!layersOf(d).includes(layer)) return `${eco.layers[layer]?.name ?? layer}에는 못 놓아요`; }
    const w = staticWhy(d, x, y, layer) || dynamicWhy(S, d, x, y, layer);
    return w ? WHY[w](d, layer) : null;
  }
  function sessileWhy(S, sp, x, y) {
    const def = sessileDef(sp), w = staticWhy(def, x, y, null) || dynamicWhy(S, def, x, y, null);
    return w ? WHY[w](def, null) : null;
  }

  // ---------- 자리 찾기 ----------
  // 권하는 지형(on 앞쪽) 먼저, 그다음 본 블록 가운데와 가까운 순서. 확장 영역 자리는 본 블록 자리 뒤에 [AW logic.js `spotList`와 같은 순서]
  const spotCache = new Map();
  function spots(key, def, layer) {
    const k = key + ':' + layer;
    if (spotCache.has(k)) return spotCache.get(k);
    const mx = (G.w - 1) / 2, my = (G.h - 1) / 2, cand = [];
    for (let y = y0; y + def.h <= y1; y++) for (let x = x0; x + def.w <= x1; x++) {
      if (staticWhy(def, x, y, layer)) continue;
      let pref = def.on ? def.on.indexOf(kind[cellOf(x, y)]) : 0;
      if (pref < 0) pref = def.on.length;
      let inExt = false;
      foot(def, x, y, (i) => { if (area[i] === 2) inExt = true; });
      cand.push([x, y, (inExt ? 1000 : 0) + pref * 100 + Math.hypot(x + (def.w - 1) / 2 - mx, y + (def.h - 1) / 2 - my)]);
    }
    cand.sort((a, b) => a[2] - b[2]);
    const out = cand.map(([x, y]) => [x, y]);
    spotCache.set(k, out);
    return out;
  }
  const covers = (def, x, y, on) => !foot(def, x, y, (i) => kind[i] !== on);
  // opt.layer: 그 층만 · opt.on: 그 지형 칸에 걸치는 자리만 · opt.ext: true면 확장 영역 칸이 있는 자리만
  function freeSpot(S, id, opt = {}) {
    const d = ITEMS[id];
    for (const L of opt.layer ? [opt.layer] : layersOf(d)) {
      for (const [x, y] of spots(id, d, L)) {
        if (opt.on && !covers(d, x, y, opt.on)) continue;
        if (opt.ext && foot(d, x, y, (i) => area[i] !== 2)) continue;
        if (!dynamicWhy(S, d, x, y, L)) return { x, y, layer: L };
      }
    }
    return null;
  }
  function freeSessileSpot(S, sp) {
    const def = sessileDef(sp);
    for (const [x, y] of spots('sp:' + sp, def, null)) if (!dynamicWhy(S, def, x, y, null)) return { x, y };
    return null;
  }

  // ---------- 생물이 다닐 수 있는 곳 ----------
  // 바닥 걷기: mode 'land'(육지 칸) · 'bed'(물 밑 바닥 칸). 걷는 물건(walk) 위는 다니고, 나머지 물건·고착 생물 칸은 못 간다
  function canWalk(S, i, mode) {
    if (i < 0 || !area[i] || !walkK[i] || lockedCell(S, i)) return false;
    if ((mode === 'land') === !!wet[i]) return false;
    const o = occ(S).g[i];
    return !o || isWalkItem(o);
  }
  // 물기둥의 한 점: 물속 칸, 바닥·수면에서 떨어짐, 수중 물건이 그 층에 없음, 키 큰 물건 위 저층 아님, 그 종이 다니는 층
  // pad: 바닥에서 더 띄울 여유(길을 미리 볼 때 점 사이를 건너뛰어도 바닥에 닿지 않게)
  function freePoint(S, i, z, s, surf = false, pad = 0) {
    if (i < 0 || !wet[i] || !swimK[i] || lockedCell(S, i)) return false;
    const o = occ(S), g = o.g[i];
    if (z < bottomZ(i) + (g && !isWalkItem(g) ? ITEM_CLEAR : CLEAR) + pad) return false;
    if (z > seaZ - (surf ? 0 : 0.25)) return false; // surf: 수면까지(숨쉬기·뭍에 오르기)
    const b = bandOf(i, z), L = layerIds[b];
    if (o.w[L][i] || (L === lowL && isTall(g)) || isEmerge(g)) return false;
    return !(s && s.layers && !s.layers.includes(L));
  }
  // 수면형이 뭍에 오르는 자리: 그 지형의 육지 칸과 맞닿은 물 칸
  const shoreCache = new Map();
  function shores(kinds) {
    const key = kinds.join(',');
    if (shoreCache.has(key)) return shoreCache.get(key);
    const out = [];
    for (let i = 0; i < N; i++) {
      if (!area[i] || wet[i] || !walkK[i] || !kinds.includes(kind[i])) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = cellOf(cx(i) + dx, cy(i) + dy);
        if (j >= 0 && wet[j] && swimK[j]) out.push({ land: i, sea: j });
      }
    }
    shoreCache.set(key, out);
    return out;
  }

  // 물건의 화면 높이(z): 수중은 층 띠 가운데(덮는 칸 중 가장 얕은 수심 기준), 떠 있는 물건은 수면, 땅 물건은 덮는 칸 중 가장 높은 바닥
  function itemZ(it) {
    const d = ITEMS[it.id];
    if (d.zone === 'water') {
      if (d.float) return seaZ;
      let D = Infinity;
      foot(d, it.x, it.y, (i) => { D = Math.min(D, depth[i]); });
      return seaZ - (layerIds.indexOf(it.layer) + 0.5) * D / nb;
    }
    let hz = -Infinity;
    foot(d, it.x, it.y, (i) => { hz = Math.max(hz, hgt[i]); });
    return hz / SUB;
  }

  return {
    G, ext, W, H, N, x0, y0, x1, y1, hasWater, seaZ, layerIds, nb, lowL, maxDepth: T.MAX_DEPTH ?? 0,
    kind, hgt, depth, area, wet, walkK, swimK, layerOk,
    cellOf, cellAt, cx, cy, bottomZ, bandOf, kindName,
    extOpen, lockedCell, isExtCell,
    sessileDef, layersOf, foot, occ, isTall, isEmerge, placeWhy, sessileWhy, freeSpot, freeSessileSpot, covers,
    terrainOk: (id, x, y, layer = null) => !staticWhy(ITEMS[id], x, y, layer),
    sessileTerrainOk: (s, x, y) => !staticWhy(sessileDef(s), x, y, null),
    inExt: (def, x, y) => !foot(def, x, y, (i) => i < 0 || area[i] !== 2),
    canWalk, freePoint, shores, itemZ,
  };
}
