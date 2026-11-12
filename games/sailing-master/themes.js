import { VIEW } from './data.js';
// 공간별 풍경 테마(L1, 2026-11-12). 수역을 더할 때 THEMES에 한 줄, data.js REGIONS에 theme 이름 하나만 더하면
// 땅 층 색·물 색·나무와 사물 구성·항구 집이 정해져요. 그림(스프라이트·무늬)은 art.js가 이름으로 찾아 그려요.
// 이 파일은 화면 없이 돌아요(배치 규칙만). 그래서 테스트에서도 겹침을 확인할 수 있어요.

// 땅 층: d(m)만큼 뭍으로 옮긴 윤곽의 바깥을 채워요. 뒤로 갈수록 뭍 쪽이에요.
// fill은 테마 전체에 같은 색, key는 구간마다 다른 값(wet 젖은 모래 · shore 물가 · bank 둑 옆면 · ground 땅)을 써요
const layers = (shallow) => [
  { d: -16, fill: shallow[0] }, { d: -9, fill: shallow[1] }, { d: -4, fill: shallow[2] }, { d: -1.2, fill: shallow[3] },
  { d: 0, key: 'wet' }, { d: 1.2, key: 'shore' }, { d: 5.5, key: 'bank' }, { d: 5.5, key: 'ground', lift: true },
];

// 나무 구성(mix): [물가에서 이 깊이(m) 안쪽까지, [[종류, 누적 확률], ...]]. 종류가 null이면 비워 둬요
// 사물(pieces)·바닥 무늬(decals): 구간 안에서 시드로 자리를 정하고 항구·부두·수문·발견지와 겹치지 않게 해요
export const THEMES = {
  // 1등급 호수: M1 때 그림 그대로예요(값을 옮기기만 했어요)
  lake: {
    name: '호수', water: ['#2b7f9f', '#2f94a9'], hut: 'hut',
    layers: layers(['rgba(120,205,205,.13)', 'rgba(138,216,208,.18)', 'rgba(170,228,212,.26)', 'rgba(214,226,190,.62)']),
    wet: '#c9b98d', shore: { tile: 'sand' }, bank: '#7a5a36', ground: { tile: 'grass' }, lift: 1.5,
    mix: [[6, [['rock', 0.5], ['bush', 0.8], ['reed', 1]]], [Infinity, [['pine', 0.46], ['oak', 0.86], ['bush', 0.95], ['rock', 1]]]],
  },
  // 2등급 강: 물길을 따라 세 구간(to: 강머리에서 강 끝까지 비율). 물은 조금 탁한 초록빛이에요
  river: {
    name: '강', water: ['#3a8079', '#44907f'], hut: 'hut', seed: 23, strict: true, scatter: { k: 2, cap: 3000, tries: 80000 },
    layers: layers(['rgba(122,196,168,.14)', 'rgba(138,204,168,.2)', 'rgba(170,212,172,.28)', 'rgba(206,212,172,.6)']),
    wet: '#c4b48a', shore: { tile: 'sand' }, bank: '#7a5a36', ground: { tile: 'grass' }, lift: 1.5,
    sections: [
      {
        id: 'gorge', name: '바위 협곡', to: 0.27, water: ['#2a6f7c', '#317f88'],
        wet: '#8e8a7c', shore: { tile: 'gravel' }, bank: { tile: 'cliff' }, ground: { tile: 'rocky' }, lift: 2.6,
        mix: [[6, [['pebbles', 0.45], ['rock', 0.8], ['reed', 1]]], [10, [['boulder', 0.3], ['rock', 0.5], ['pine', 0.82], ['bush', 1]]],
          [Infinity, [['pine', 0.6], ['boulder', 0.72], ['rock', 0.82], ['oak', 0.9], ['bush', 1]]]],
        decals: [{ kind: 'crag', n: 50, r: [3, 7.5], depth: [6, 90] }],
        pieces: [{ kind: 'pebbles', n: 80, depth: [2.2, 6.5], small: true }, { kind: 'boulder', n: 40, depth: [2.5, 9], small: true }],
      },
      {
        id: 'farm', name: '들판', to: 0.63, water: ['#3a8079', '#45917f'],
        wet: '#c4b48a', shore: { tile: 'sand', base: '#e2d4a6' }, bank: '#7a5a36', ground: { tile: 'grass', base: '#80ae52', specks: ['rgba(80,128,52,.35)', 'rgba(150,196,90,.35)', 'rgba(244,224,120,.55)'] }, lift: 1.2,
        mix: [[6, [['reed', 0.35], ['flowers', 0.6], ['willow', 0.82], ['bush', 1]]], [12, [['willow', 0.32], ['flowers', 0.62], ['oak', 0.8], ['bush', 1]]],
          [Infinity, [['oak', 0.3], ['flowers', 0.55], ['bush', 0.66], ['willow', 0.72], [null, 1]]]],
        decals: [{ kind: 'field', n: 90, size: [7, 14], depth: [8, 90] }],
        pieces: [{ kind: 'bridge', n: 3, depth: [22, 60] }, { kind: 'windmill', n: 4, depth: [16, 70] }, { kind: 'village', n: 4, depth: [14, 60], houses: [3, 5] }, { kind: 'reed', n: 60, depth: [2.2, 5], small: true }, { kind: 'willow', n: 30, depth: [3, 8], small: true }],
      },
      {
        id: 'marsh', name: '습지', to: 1, water: ['#4a7d6c', '#548a72'],
        wet: '#6f6648', shore: { tile: 'mud' }, bank: '#5e4a30', ground: { tile: 'grass', base: '#5f8c4c', specks: ['rgba(50,92,52,.4)', 'rgba(116,160,84,.35)', 'rgba(200,214,140,.4)'] }, lift: 0.6,
        mix: [[6, [['reedbed', 0.5], ['reed', 0.85], ['flowers', 1]]], [12, [['reedbed', 0.3], ['willow', 0.55], ['reed', 0.7], ['bush', 0.85], ['flowers', 1]]],
          [Infinity, [['willow', 0.3], ['bush', 0.48], ['reedbed', 0.62], ['oak', 0.7], ['flowers', 0.84], [null, 1]]]],
        decals: [{ kind: 'pool', n: 60, r: [3, 9], depth: [5, 90] }],
        pieces: [{ kind: 'reedbed', n: 140, depth: [2.2, 6], small: true }],
      },
    ],
  },
  // 3등급 앞바다(M2a 임시, C5에서 다듬어요): 청록 바닷물, 만 안쪽은 모래 해변·해송, 곶 끝과 섬은 바위 해안.
  // 구간은 남(만 해변) → 북(곶 끝·바깥 섬) 순서예요(zonesOf는 shape.pts가 없으면 지도 남쪽 끝에서 북쪽 끝으로 나눠요)
  coast: {
    name: '앞바다', water: ['#1d7b86', '#22909a'], hut: 'hut', seed: 31,
    layers: layers(['rgba(110,210,196,.15)', 'rgba(132,220,200,.2)', 'rgba(176,230,206,.3)', 'rgba(226,228,186,.66)']),
    wet: '#cbb98a', shore: { tile: 'sand', base: '#eadcae' }, bank: '#9a8256', ground: { tile: 'grass', base: '#8aa95a', specks: ['rgba(90,120,60,.35)', 'rgba(176,196,120,.4)', 'rgba(236,222,170,.55)'] }, lift: 1.3,
    sections: [
      {
        id: 'beach', name: '모래 해변', to: 0.43, water: ['#1f8290', '#26989f'],
        wet: '#cdbb8c', shore: { tile: 'sand', base: '#efe2b6' }, bank: '#b79c66', ground: { tile: 'grass', base: '#93ae5e', specks: ['rgba(90,120,60,.35)', 'rgba(176,196,120,.4)', 'rgba(236,222,170,.6)'] }, lift: 1.1,
        mix: [[7, [['pebbles', 0.12], [null, 1]]], [16, [['reed', 0.25], ['bush', 0.5], [null, 1]]], [Infinity, [['pine', 0.55], ['bush', 0.75], ['rock', 0.85], [null, 1]]]],
      },
      {
        id: 'rocks', name: '바위 해안', to: 1, water: ['#1a6f7f', '#1f8290'],
        wet: '#8c897c', shore: { tile: 'gravel', base: '#9c968a' }, bank: { tile: 'cliff', base: '#6d685e' }, ground: { tile: 'rocky', base: '#6f8650' }, lift: 2.4,
        mix: [[6, [['pebbles', 0.35], ['rock', 0.75], ['boulder', 1]]], [Infinity, [['pine', 0.5], ['boulder', 0.66], ['rock', 0.8], ['bush', 1]]]],
      },
    ],
  },
};
// 지역 → 테마. 표에 없으면 호수 테마예요
export const themeOf = (def) => THEMES[def.theme] || THEMES.lake;

// 그림 크기(m): [너비, 기준점 위 높이]. art.js 그림과 맞춰요. 겹침은 화면에 보이는 사각형으로 따져요
export const BOX = {
  pine: [6.4, 12.1], oak: [9, 10.1], bush: [4.6, 2.8], reed: [2.8, 3], rock: [3.4, 2], willow: [8, 9], reedbed: [5.6, 3.1], flowers: [2.6, 1.1], pebbles: [3.6, 1.1], boulder: [6.2, 4.1],
  windmill: [9.6, 12.8], thatch: [7.6, 5.8], bridge: [9.4, 3.4], haystack: [2.8, 2.5],
  hut: [10.6, 8.6], sign: [5, 5.9], find: [9, 12.6], pier: [4, 3],
};
// 화면 사각형 [x0, x1, y0, y1](m). 세상 y를 눌러 그리고 그림은 기준점에서 위로 선다
function boxOf(p, kind = p.kind) {
  const [w, h] = BOX[kind] || BOX.find, s = p.size || 1, sy = p.y * VIEW.tiltY;
  return [p.x - w * s / 2, p.x + w * s / 2, sy - h * s, sy + 0.6];
}
const hit = (a, b, m = 1) => a[0] < b[1] + m && b[0] < a[1] + m && a[2] < b[3] + m && b[2] < a[3] + m;
// 항구 집·부두·수문 표지·발견지의 화면 사각형
export function markBoxes(marks) {
  return marks.map((m) => {
    if (m.kind === 'pier') { const x1 = m.x0 + Math.cos(m.ang) * m.len, y1 = m.y0 + Math.sin(m.ang) * m.len, k = VIEW.tiltY; return [Math.min(m.x0, x1) - 1.5, Math.max(m.x0, x1) + 1.5, Math.min(m.y0, y1) * k - 3, Math.max(m.y0, y1) * k + 0.6]; }
    return boxOf(m, m.port ? 'hut' : m.gate ? 'sign' : 'find');
  });
}

// 구간: 강머리에서 강 끝 방향의 비율 u로 나눠요. 경계는 물결처럼 굽어 자연스럽게 바뀌어요
export function zonesOf(w, theme) {
  if (!theme.sections) return { list: [theme], at: () => 0, u: () => 0, edge: null, clips: null };
  const secs = theme.sections, P = w.def.shape.pts || [[0, w.bounds[3]], [0, w.bounds[1]]];
  const [ax, ay] = P[0], [bx, by] = P[P.length - 1], len = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / len, dy = (by - ay) / len;
  const edge = (b, v) => secs[b].to + (9 * Math.sin(v * 0.045 + b * 2.1) + 4 * Math.sin(v * 0.13 + b * 4.7)) / len;
  const u = (x, y) => ((x - ax) * dx + (y - ay) * dy) / len, v = (x, y) => -(x - ax) * dy + (y - ay) * dx;
  const at = (x, y) => { const uu = u(x, y), vv = v(x, y); let i = 0; while (i < secs.length - 1 && uu >= edge(i, vv)) i++; return i; };
  const toWorld = (uu, vv) => [ax + dx * uu * len - dy * vv, ay + dy * uu * len + dx * vv];
  // 그림을 자를 영역(세상 좌표 다각형)과 그 u 범위
  const clips = secs.map((s, i) => {
    const pts = [];
    for (let vv = -1600; vv <= 1600; vv += 10) pts.push(toWorld(i ? edge(i - 1, vv) : -1, vv));
    for (let vv = 1600; vv >= -1600; vv -= 10) pts.push(toWorld(i < secs.length - 1 ? edge(i, vv) : 2, vv));
    return { pts, u0: i ? secs[i - 1].to - 14 / len : -1, u1: i < secs.length - 1 ? s.to + 14 / len : 2 };
  });
  // 물 색: 경계 앞뒤 45m에서 섞어요
  const blend = 45 / len;
  const waterAt = (x, y) => {
    const uu = u(x, y), vv = v(x, y), i = at(x, y);
    for (const b of [i - 1, i]) {
      if (b < 0 || b >= secs.length - 1) continue;
      const e = (uu - edge(b, vv)) / blend;
      if (Math.abs(e) < 1) { const f = (e + 1) / 2, s = f * f * (3 - 2 * f); return [b, b + 1, s]; }
    }
    return [i, i, 0];
  };
  return { list: secs, at, u, edge, clips, waterAt };
}

// 시드 난수(world.js scatter와 같은 식)
function seeded(seed) { let s = seed >>> 0; return () => (s = (s + 0x6D2B79F5) >>> 0, ((s ^ (s >>> 15)) * (1 | s) >>> 0) / 4294967296); }

// 나무·사물·바닥 무늬를 정해요. marks: 항구 집·부두·수문 표지·발견지(art.js createScene이 만든 것)
export function dressLand(w, theme, marks) {
  const zones = zonesOf(w, theme);
  const pick = (d, r, x, y) => {
    const sec = zones.list[zones.at(x, y)], bands = sec.mix || theme.mix;
    for (const [depth, list] of bands) if (-d < depth) { for (const [k, c] of list) if (r < c) return k; return null; }
    return null;
  };
  const near = (m, t) => (m.port || m.find || m.gate || m.lamp) && Math.hypot(m.x - t.x, m.y - t.y) < 9;
  if (!theme.strict) {
    // 호수: M1 규칙 그대로(9m 안의 나무만 뺌)
    const trees = w.scatter(11, pick).filter((t) => !marks.some((m) => near(m, t)));
    return { props: trees, decals: [], zones };
  }
  const rnd = seeded(theme.seed || 7), mb = markBoxes(marks), [bx0, by0, bx1, by1] = w.bounds;
  const decals = [], pieces = [], pb = []; // pb: 사물 화면 사각형(pieces와 같은 순서)
  const addPiece = (p) => { pieces.push(p); pb.push(boxOf(p)); };
  const clearMarks = (x, y, r) => marks.every((m) => Math.hypot(m.x - x, m.y - y) > r + 7);
  const clearDecals = (x, y, r) => decals.every((q) => q.kind === 'creek' || q.kind === 'path' ? q.pts.every(([px, py]) => Math.hypot(px - x, py - y) > r + 2.5) : Math.hypot(q.x - x, q.y - y) > (r + q.r) * (q.kind === 'field' ? 0.8 : 1));
  const clearBox = (b) => mb.every((q) => !hit(b, q)) && pb.every((q) => !hit(b, q));
  const land = (x, y, lo, hi) => { const d = (w.landDist || w.dist)(x, y); return d > -199 && -d >= lo && -d <= hi; }; // 바다 끝 너머는 땅이 아니에요
  const sample = (si, depth, ok, tries = 400) => {
    for (let t = 0; t < tries; t++) {
      const x = bx0 + rnd() * (bx1 - bx0), y = by0 + rnd() * (by1 - by0);
      if (!land(x, y, depth[0], depth[1]) || zones.at(x, y) !== si) continue;
      const got = ok(x, y);
      if (got) return got;
    }
    return null;
  };
  const placePieces = (si, list) => { for (const spec of list) for (let n = 0; n < spec.n; n++) {
    sample(si, spec.depth, (x, y) => {
      if (spec.kind === 'bridge') return placeBridge(x, y, si);
      if (spec.kind === 'village') return placeVillage(x, y, spec);
      const p = { kind: spec.kind, x, y, v: rnd(), size: spec.small ? 0.8 + rnd() * 0.45 : 1 };
      if (!clearMarks(x, y, spec.small ? 2 : 6) || !clearDecals(x, y, spec.small ? 1 : 8) || !clearBox(boxOf(p))) return null;
      addPiece(p); return p;
    }, 600);
  } };
  zones.list.forEach((sec, si) => {
    // 돌다리(개울과 함께)를 먼저 놓아야 밭이 개울을 덮지 않아요
    placePieces(si, (sec.pieces || []).filter((q) => q.kind === 'bridge'));
    // 바닥 무늬: 밭·습지 웅덩이·바위 너덜
    for (const spec of sec.decals || []) for (let n = 0; n < spec.n; n++) {
      sample(si, spec.depth, (x, y) => {
        if (spec.kind === 'field') {
          const [gx, gy] = w.gradient(x, y), ang = Math.atan2(gy, gx) + (rnd() - 0.5) * 0.5, a = spec.size[0] + rnd() * (spec.size[1] - spec.size[0]), b = a * (0.55 + rnd() * 0.4), r = Math.hypot(a, b);
          const c = Math.cos(ang), s = Math.sin(ang);
          for (const [u, v] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const px = x + (u * a * c - v * b * s), py = y + (u * a * s + v * b * c); if (!land(px, py, 6, 400) || zones.at(px, py) !== si) return null; }
          if (!clearMarks(x, y, r) || !clearDecals(x, y, r)) return null;
          const tone = rnd(), q = { kind: 'field', x, y, a, b, ang, r, tone: tone < 0.34 ? 'wheat' : tone < 0.58 ? 'plow' : tone < 0.82 ? 'crop' : 'paddy', hedge: Math.floor(rnd() * 16), v: rnd() };
          decals.push(q); return q;
        }
        const r = spec.r[0] + rnd() * (spec.r[1] - spec.r[0]);
        if (!land(x, y, Math.max(spec.depth[0], r * 0.7), 400) || !clearMarks(x, y, r) || !clearDecals(x, y, r)) return null;
        const q = { kind: spec.kind, x, y, r, v: rnd() }; decals.push(q); return q;
      });
    }
    // 사물: 풍차 · 초가 마을
    placePieces(si, (sec.pieces || []).filter((q) => q.kind !== 'bridge'));
  });
  // 돌다리: 북쪽 샘에서 남쪽으로 흐르는 개울 위에 놓고, 개울은 물가 쪽으로 꺾여 강에 들어가요. 다리 위로 동서 길이 지나가요
  function placeBridge(x, y, si) {
    const pts = [];
    for (let k = -14; k <= 10; k += 2) pts.push([x + Math.sin(k * 0.21) * 1.6, y + k]);
    let [px, py] = pts[pts.length - 1];
    for (let i = 0; i < 80 && w.dist(px, py) < 1; i++) { const [gx, gy] = w.gradient(px, py), last = pts[pts.length - 1], tx = 0.5 * gx, ty = 0.5 * gy + 0.5; const m = Math.hypot(tx, ty) || 1; px = last[0] + tx / m * 2; py = last[1] + ty / m * 2; pts.push([px, py]); }
    if (w.dist(px, py) < 1) return null;
    const road = [[x - 12, y + 0.4], [x - 4.6, y + 0.2], [x + 4.6, y + 0.2], [x + 12, y + 0.4]];
    for (const [qx, qy] of [...pts, ...road]) { if (zones.at(qx, qy) !== si) return null; if (!marks.every((m) => Math.hypot(m.x - qx, m.y - qy) > 9)) return null; }
    for (const [qx, qy] of road) if (!land(qx, qy, 6, 400)) return null;
    if (!pts.slice(0, 13).every(([qx, qy]) => land(qx, qy, 8, 400))) return null;
    const p = { kind: 'bridge', x, y, v: 0, size: 1 };
    if (!clearBox(boxOf(p)) || ![...pts, ...road].every(([qx, qy]) => clearDecals(qx, qy, 2)) || pieces.some((q) => q.kind === 'bridge' && Math.hypot(q.x - x, q.y - y) < 80)) return null;
    // 개울이 다른 사물 밑을 지나지 않게
    if (pieces.some((q) => pts.some(([qx, qy]) => Math.hypot(q.x - qx, q.y - qy) < 6))) return null;
    const reach = (list) => Math.max(...list.map(([qx, qy]) => Math.hypot(qx - x, qy - y))) + 3;
    decals.push({ kind: 'creek', pts, x, y, r: reach(pts) }, { kind: 'path', pts: road, x, y, r: reach(road) });
    addPiece(p); return p;
  }
  // 초가 마을: 가운데 자리 둘레에 집 3~5채
  function placeVillage(x, y, spec) {
    if (!clearMarks(x, y, 14) || !clearDecals(x, y, 12)) return null;
    const n = spec.houses[0] + Math.floor(rnd() * (spec.houses[1] - spec.houses[0] + 1)), got = [];
    for (let i = 0; i < n * 6 && got.length < n; i++) {
      const a = rnd() * Math.PI * 2, q = got.length ? 6 + rnd() * 5 : rnd() * 2, hx = x + Math.cos(a) * q, hy = y + Math.sin(a) * q;
      const p = { kind: 'thatch', x: hx, y: hy, v: rnd(), size: 0.92 + rnd() * 0.16 };
      if (!land(hx, hy, 9, 400) || !clearMarks(hx, hy, 5) || !clearDecals(hx, hy, 4.5)) continue;
      if (got.some((h) => Math.hypot(h.x - hx, h.y - hy) < 7.5 || (Math.abs(h.x - hx) < 7 && Math.abs(h.y - hy) < 6))) continue;
      if (!clearBox(boxOf(p))) continue;
      got.push(p);
    }
    if (got.length < 2) return null;
    got.forEach(addPiece); return got;
  }
  // 밀밭 몇 곳에 건초 더미
  for (const f of decals) if (f.kind === 'field' && f.tone === 'wheat' && f.v < 0.55) {
    const c = Math.cos(f.ang), s = Math.sin(f.ang), u = (f.v - 0.27) * 1.4 * f.a, vv = (f.hedge / 16 - 0.5) * f.b, x = f.x + u * c - vv * s, y = f.y + u * s + vv * c;
    const p = { kind: 'haystack', x, y, v: f.v, size: 1 };
    if (clearMarks(x, y, 2) && clearBox(boxOf(p))) addPiece(p);
  }
  // 습지 웅덩이 둘레에 갈대숲
  for (const q of decals) if (q.kind === 'pool') for (let i = 0; i < 3; i++) {
    const a = q.v * 9 + i * 2.3, x = q.x + Math.cos(a) * q.r * 0.95, y = q.y + Math.sin(a) * q.r * 0.62;
    const p = { kind: 'reedbed', x, y, v: (q.v + i * 0.37) % 1, size: 0.8 + ((q.v * 7 + i) % 1) * 0.4 };
    if (clearMarks(x, y, 2) && clearBox(boxOf(p))) addPiece(p);
  }
  // 나무: 무늬 위·사물 앞·표지 둘레는 비워요
  const inDecal = (t) => decals.some((q) => {
    if (Math.abs(t.x - q.x) > q.r + 3 || Math.abs(t.y - q.y) > q.r + 3) return false;
    if (q.kind === 'creek' || q.kind === 'path') return q.pts.some(([px, py]) => Math.hypot(px - t.x, py - t.y) < (q.kind === 'creek' ? 2.6 : 1.8));
    if (q.kind === 'field') { const dx = t.x - q.x, dy = t.y - q.y, c = Math.cos(q.ang), s = Math.sin(q.ang), u = dx * c + dy * s, v = -dx * s + dy * c; return Math.abs(u) < q.a + 0.8 && Math.abs(v) < q.b + 0.8; }
    if (q.kind === 'pool') return Math.hypot(t.x - q.x, (t.y - q.y) * 1.2) < q.r * 0.9;
    return t.kind !== 'boulder' && t.kind !== 'rock' && t.kind !== 'pebbles' && Math.hypot(t.x - q.x, t.y - q.y) < q.r * 0.8; // 바위 너덜 위엔 돌만
  });
  const trees = w.scatter(11, pick, theme.scatter).filter((t) => {
    if (marks.some((m) => near(m, t)) || inDecal(t)) return false;
    const b = boxOf(t);
    if (mb.some((q) => hit(b, q, 0.5))) return false;
    return pieces.every((p, i) => Math.abs(p.x - t.x) > 12 || (Math.hypot(p.x - t.x, p.y - t.y) > 4 && (t.y < p.y - 1 || !hit(b, pb[i], -0.5))));
  });
  return { props: [...trees, ...pieces], decals, zones, pieces };
}
