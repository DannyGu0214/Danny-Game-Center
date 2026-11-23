// 본부 레벨업 컷씬: 본부가 한 단계 오를 때마다 마을이 조금씩 나아지는 장면(2~9레벨), 최고 레벨(10)은 엔딩 장면.
// 화풍은 시작 화면(title.js)과 같다: 가로 약 200칸 픽셀 버퍼를 정수 배로 키우고, 쿼터뷰 타일 16×8칸, 반투명은 4×4 바이어 디더링.
// 흐름: 2~4 불타는 도시 앞의 작은 울타리 → 5~7 담장이 넓어지고 집·밭·아이들·먼 마을 불빛이 늘어남 → 8~9 여명 → 10 해가 뜬다.
// 움직이지 않는 풍경은 레벨·화면 크기마다 한 번 그려 두고, 매 프레임 빛·불·연기·사람·아이·동물·풍차만 덧그린다.
import { Px, P, C, lerpC, unpack, pack, dith, hash, text, textW, makeIso, isoBox, SURV, ZOMB, mapZ } from './title.js';

export const CUT_FIRST = 2, CUT_FINAL = 10;

// ---------- 문구(해요체 구어체) ----------
// {name} = 이번 판 생존자 이름. 마을 사람들이 대장(플레이어)에게 하는 말이다.
export const SCENES = {
  2: { title: '첫 번째 울타리', lines: [
    '마지막 말뚝까지 다 박았어요. 이제 울타리가 빙 둘러섰어요.',
    '오늘 밤은 다들 조금은 마음 놓고 잘 수 있겠어요.',
    '무너진 세상 한가운데 우리 자리가 하나 생겼어요. 다 대장 덕분이에요.',
  ] },
  3: { title: '어둠을 비추는 망루', lines: [
    '망루에 탐조등을 달았어요. 이제 어둠 속에서도 우리가 먼저 볼 수 있어요.',
    '멀리서 불빛을 보고 사람들이 하나둘 찾아오고 있어요.',
    '"여기라면 살 수 있겠다." 새로 온 사람이 그렇게 말했어요.',
  ] },
  4: { title: '처음 심은 씨앗', lines: [
    '울타리 안쪽 땅을 갈아서 씨앗을 심었어요.',
    '통조림 말고 우리가 키운 걸 먹는 날이 곧 올 거예요.',
    '작은 새싹이지만, 내일을 믿는 사람들이 심은 거예요.',
  ] },
  5: { title: '넓어진 담장', lines: [
    '담장을 밖으로 넓히고 오두막도 새로 지었어요.',
    '창문마다 불이 켜지니까 이제 진짜 마을 같아요.',
    '저기 도시 너머에도 불빛이 몇 개 보여요. 살아남은 게 우리만이 아니었어요.',
  ] },
  6: { title: '아이들 웃음소리', lines: [
    '오늘 처음으로 아이들 웃음소리를 들었어요.',
    '공 하나로 해 질 때까지 뛰어놀더라고요.',
    '총소리 대신 웃음소리가 들리는 곳, 대장이 만든 거예요.',
  ] },
  7: { title: '바람이 켜는 불', lines: [
    '풍차를 세웠어요. 이제 바람이 밤마다 불을 밝혀 줘요.',
    '밭이 울타리 밖까지 넓어졌고 닭도 키우기 시작했어요.',
    '배를 곯는 밤이 하루하루 줄고 있어요.',
  ] },
  8: { title: '작은 배움터', lines: [
    '온실이랑 작은 배움터가 생겼어요.',
    '아이들은 글자를 배우고, 어른들은 내년 농사 얘기를 해요.',
    '버티기만 하던 사람들이 이제 다시 살아가기 시작했어요.',
  ] },
  9: { title: '등불 장터', lines: [
    '다른 생존자 마을에서 물건을 바꾸러 사람들이 왔어요.',
    '등불 아래 장터가 열리고, 오랜만에 노랫소리도 들려요.',
    '저기 지평선 좀 보세요. 하늘이 조금씩 밝아지고 있어요.',
  ] },
  10: { title: '긴 밤이 끝났어요', ending: true, lines: [
    '본부가 마지막 단계까지 다 지어졌어요.',
    '울타리 하나로 시작한 곳이 이제 모두의 마을이 됐어요.',
    '그리고 오늘, 이 마을에 처음으로 해가 떴어요.',
    '{name} 대장, 무너진 세상을 조금 더 살 만한 곳으로 만들어 줘서 고마워요.',
  ] },
};
export const sceneLines = (lv, name = '생존자') => (SCENES[lv]?.lines ?? []).map((l) => l.replaceAll('{name}', name));

// ---------- 색 ----------
const X = {
  soil0: C('#1e140c'), soil1: C('#5a3e26'), sprout: C('#7ccc54'), leaf: C('#3c6e33'), leaf2: C('#5f9a45'),
  fruit: C('#d0432a'), pumpkin: C('#de7d2a'), wheat: C('#b89038'), wheat2: C('#e2bd5a'),
  flowerY: C('#e8c84a'), flowerW: C('#e6e2d6'), flowerP: C('#d87a9a'),
  glass: C('#4c7486'), glass2: C('#8cc0d0'), glassD: C('#2c4452'),
  panel: C('#1c2846'), panel2: C('#3c5c8e'),
  brick0: C('#3e3230'), brick1: C('#54443c'), brick2: C('#6e5a4a'), cap: C('#7e7468'),
  sheet0: C('#323a40'), sheet1: C('#46505a'), sheet2: C('#5e6a74'),
  roof0: C('#4e2420'), roof1: C('#6e3426'), roof2: C('#8e4630'),
  roofB0: C('#24303e'), roofB1: C('#34465a'), roofB2: C('#4a6078'),
  awnR: C('#b83a2a'), awnW: C('#e2d6c0'), awnB: C('#2e5e8e'), awnG: C('#3e7a4a'),
  bulb: C('#ffd27a'), bulbR: C('#ff6a4a'), bulbG: C('#8ae07a'), bulbB: C('#7ab8ff'), lantern: C('#ff7a3a'),
  dog: C('#8a6a48'), dogD: C('#5e462e'), hen: C('#e6e2d6'), henD: C('#b8b0a0'), comb: C('#d83a2a'), beak: C('#e0a83a'),
  ball: C('#ece8e0'), bell: C('#c8a040'),
  leafT0: C('#1e3a22'), leafT1: C('#2c5030'), leafT2: C('#3e6a3c'), bud: C('#3a4a2e'),
  vine: C('#2e4a2a'), sun: C('#fff2c0'), sunE: C('#ffd27a'), ray: C('#ffe8a8'), cloud: C('#f6e6d8'), cloudD: C('#d8b8b0'),
  bird: C('#2a2a36'), petalP: C('#f2a0b8'), petalW: C('#fff4e0'), petalY: C('#ffd25a'),
  firefly: C('#d8f070'),
};
// 빛나는 색은 날이 밝아도 그대로 둔다
const GLOW_KEYS = new Set(['fire0', 'fire1', 'fire2', 'fire3', 'light', 'win', 'winD', 'cityLit', 'cityLit2', 'star', 'starD', 'moon', 'moonD', 'moonE', 't0', 't1', 't2', 't3', 't4', 'tDepth', 'tLine', 'rust', 'zeye',
  'bulb', 'bulbR', 'bulbG', 'bulbB', 'lantern', 'sun', 'sunE', 'ray', 'cloud', 'cloudD', 'firefly', 'petalP', 'petalW', 'petalY']);
// 아침 햇빛: 어두운 색을 끌어올리고(감마) 채도를 조금 살리고 따뜻하게. 여명은 푸르게 아주 조금만.
function grade(c, L, warm) {
  if (L <= 0) return c;
  const [r, g, b] = unpack(c);
  const f = (v) => 255 * Math.pow(v / 255, 1 / (1 + 1.05 * L));
  let R = f(r), G = f(g), B = f(b);
  const l = (R + G + B) / 3, sat = 1 + 0.45 * L;
  R = l + (R - l) * sat; G = l + (G - l) * sat; B = l + (B - l) * sat;
  if (warm) { R += 16 * L; G += 8 * L; B -= 8 * L; } else { R -= 2 * L; B += 16 * L; }
  return pack([R, G, B].map((v) => Math.max(0, Math.min(255, Math.round(v)))));
}
const SKY = {
  burn: ['#070a14', '#10152b', '#1d1a35', '#3a2236', '#6e2f28', '#b5502a'],
  ember: ['#070a14', '#0e1328', '#191a36', '#2c2140', '#4a2a36', '#6e3a2c'],
  night: ['#05080f', '#0a1020', '#101a32', '#172442', '#1f2e4e', '#2a3a5a'],
  predawn: ['#070b18', '#0d162e', '#16233f', '#22324f', '#36425e', '#544e6c'],
  dawn: ['#0b1430', '#16264a', '#283f68', '#4a5a86', '#9a7a8e', '#e2966a'],
  sunrise: ['#4a7cbc', '#6896ca', '#8eb0d8', '#c2c6d0', '#f2cc96', '#ffe2a4'],
};
const skyOf = (lv) => (lv <= 3 ? 'burn' : lv === 4 ? 'ember' : lv <= 7 ? 'night' : lv === 8 ? 'predawn' : lv === 9 ? 'dawn' : 'sunrise');

// 마을 사람 겉옷·머리·피부(주황 겉옷은 대장)
const JACKETS = ['#3e6e9a', '#6a8a3e', '#9a3e4e', '#7a6aa0', '#b8a060', '#4e8a7a', '#a0603a', '#5a5a6a'];
const HAIRS = ['#3a2a1e', '#1a1410', '#6a4a2a', '#8a8a8a', '#a87a3a', '#2a1a14'];
const SKINS = ['#e0c29f', '#c8a07a', '#a87a5a', '#f0d2b0'];
// 아이(가로 6칸)·만세 하는 어른·개·닭
const KID = [
  ['..hh..', '.hssh.', '..ss..', '.jjjj.', '.sjjs.', '..jj..', '..pp..', '.k..k.'],
  ['..hh..', '.hssh.', '..ss..', '.jjjj.', 's.jj.s', '..jj..', '..pp..', '..kk..'],
];
const KID_UP = ['.s..s.', '.shhs.', '.jssj.', '.jjjj.', '..jj..', '..jj..', '..pp..', '.k..k.'];
const CHEER = ['s....s', 'j.hh.j', 'jhhhhj', 'jssssj', '.s.s..', '..ss..', '.jjjj.', '.jJjj.', '.jjjj.', '.pp.p.', '.p..p.', '.k..k.'];
const DOG = [['d....d.', '.dddddD', '.ddddd.', '.d...d.'], ['.d...d.', '.dddddD', '.ddddd.', 'd.....d']];
const HEN = [['.c.', 'wwb', 'www', '.y.'], ['...', '.wc', 'wwwb', '.y.']];

// ---------- 정적 풍경(레벨·화면 크기마다 한 번) ----------
function build(w, h, lv) {
  const px = new Px(w, h);
  const day = lv >= 10 ? 0.85 : lv === 9 ? 0.1 : lv === 8 ? 0.05 : 0, warm = lv >= 10;
  const Q = {};
  for (const k of Object.keys(P)) Q[k] = GLOW_KEYS.has(k) ? P[k] : grade(P[k], day, warm);
  for (const k of Object.keys(X)) Q[k] = GLOW_KEYS.has(k) ? X[k] : grade(X[k], day, warm);
  const g = (hex) => grade(C(hex), day, warm);
  const R = lv >= 8 ? 6 : lv >= 5 ? 5 : 4, tier = lv >= 8 ? 2 : lv >= 5 ? 1 : 0;
  const HZ = Math.round(h * 0.2), OX = Math.round(w / 2), OY = Math.round(h * 0.42 + 4), I = makeIso(OX, OY);
  const lights = [], folk = [], bulbs = [], cloth = [], beams = [];
  const night = lv < 10;

  // 하늘: 레벨이 오를수록 불타는 붉은빛이 가라앉고, 맑은 밤 → 여명 → 해돋이
  const bands = SKY[skyOf(lv)].map((x) => C(x));
  const sk = lv >= 8 ? 1.05 : 1.6; // 여명·해돋이는 지평선 빛이 위로 번진다
  for (let y = 0; y < HZ + 6; y++) {
    const t = Math.pow(y / (HZ + 6), sk) * (bands.length - 1), i = Math.min(bands.length - 2, Math.floor(t)), f = t - i;
    for (let x = 0; x < w; x++) px.set(x, y, dith(x, y, f) ? bands[i + 1] : bands[i]);
  }
  const sun = lv >= 10 ? [Math.round(w * 0.24), HZ - 20, Math.max(7, Math.round(w * 0.04))] : null;
  if (sun) {
    const [sx, sy, sr] = sun;
    px.disc(sx, sy, sr * 2.6, X.cloud, 0.35); px.disc(sx, sy, sr * 1.7, X.sunE, 0.45); px.disc(sx, sy, sr, X.sun);
    // 아침 구름(납작한 띠)
    for (const [cx, cy, cw] of [[0.62, 0.07, 0.22], [0.82, 0.13, 0.16], [0.12, 0.1, 0.18]]) {
      const x0 = Math.round(w * cx), y0 = Math.round(h * cy), ww = Math.round(w * cw);
      px.oval(x0, y0, ww / 2, 3, X.cloudD); px.oval(x0 - 2, y0 - 2, ww / 2.6, 3, X.cloud); px.oval(x0 + ww / 5, y0 - 3, ww / 5, 2.5, X.cloud);
    }
  } else {
    const mr = Math.min(9, Math.max(5, Math.round(w * 0.034))), mx = Math.round(w * 0.74), my = Math.round(h * 0.085) + (lv >= 8 ? 6 : 0); // 건너뛰기 버튼을 피한다
    px.disc(mx, my, mr + 5, bands[2], 0.35); px.disc(mx, my, mr, lv >= 9 ? lerpC(P.moon, bands[3], 0.35) : P.moon);
    px.disc(mx + 2, my - 1, mr * 0.95, P.moonD, 0.25);
    for (const [ox, oy, r] of [[-2, -2, 1.6], [2, 2, 1.2], [-1, 3, 1], [3, -3, 0.8]]) px.disc(mx + ox, my + oy, r, P.moonE);
  }
  // 도시 실루엣: 2~4 불타는 폐허, 5~9 다른 생존자 마을의 불빛이 하나둘, 10 아침 햇살에 드러난 덩굴 덮인 건물
  const cityA = night ? Q.city1 : g('#55606e'), cityB = night ? Q.city0 : g('#3e4652'), cityE = night ? Q.cityE : g('#6a7480');
  const lit = lv <= 4 ? 0.035 : Math.min(0.2, 0.025 * (lv - 4));
  const skyline = (base, col, edgeC, seed, minH, maxH) => {
    let x = -2;
    while (x < w + 2) {
      const bw = 6 + Math.floor(hash(x, seed) * 14), bh = minH + Math.floor(hash(x, seed + 1) * (maxH - minH)), top = base - bh;
      px.rect(x, top, bw, bh + 1, col);
      for (let i = 0; i < bw; i++) if (hash(x + i, seed + 2) < 0.35) px.rect(x + i, top - 1 - Math.floor(hash(x + i, seed + 3) * 3), 1, 3, col);
      px.line(x, top, x, base, edgeC);
      for (let wy = top + 3; wy < base - 2; wy += 3) for (let wx = x + 2; wx < x + bw - 1; wx += 3) {
        if (hash(wx, wy, seed) >= (night ? lit : 0.5)) continue;
        px.set(wx, wy, !night ? g('#2a303a') : lv <= 4 ? (hash(wx, wy, seed + 9) < 0.5 ? P.cityLit : P.cityLit2) : hash(wx, wy, seed + 9) < 0.7 ? X.bulb : P.win);
      }
      if (!night) for (let i = 0; i < bw; i += 2) if (hash(x + i, seed + 5) < 0.4) px.rect(x + i, top, 1, 2 + Math.floor(hash(x + i, seed + 6) * 6), Q.vine);
      x += bw + (hash(x, seed + 4) < 0.3 ? 2 : 0);
    }
  };
  skyline(HZ + 3, cityA, cityE, 11, 10, 26);
  skyline(HZ + 5, cityB, cityA, 23, 4, 14);
  const cx0 = Math.round(w * 0.18); // 크레인
  px.line(cx0, HZ - 30, cx0, HZ + 2, cityA); px.line(cx0 + 1, HZ - 30, cx0 + 1, HZ + 2, cityA);
  px.line(cx0 - 6, HZ - 30, cx0 + 22, HZ - 30, cityA); px.line(cx0 + 18, HZ - 30, cx0 + 18, HZ - 22, cityE);

  // 땅: 화면 픽셀마다 쿼터뷰 좌표로 되돌려 무늬를 정한다
  const fields = [];
  if (lv >= 4) fields.push(tier === 0 ? [-3.8, 0, -1.6, 2.8] : tier === 1 ? [-4.6, 0.4, -1.6, 3.4] : [-5.4, 1.2, -2.2, 4.4]);
  if (lv >= 7) fields.push(tier === 1 ? [-9.4, -4.2, -6, -0.6] : [-10.6, -5, -7.2, -1.2]);
  if (lv >= 9) fields.push([6.4, -2.8, 8.8, 0]);
  const inField = (gx, gy) => fields.find(([a, b, c, d]) => gx > a && gx < c && gy > b && gy < d);
  const fadeC = lerpC(bands[2], bands[bands.length - 1], night ? 0.3 : 0.55);
  const inv = (x, y) => { const a = (x - OX) / 8, b = (y - OY) / 4; return [(a + b) / 2, (b - a) / 2]; };
  const flowers = lv <= 4 ? 0 : Math.min(0.016, 0.004 * (lv - 4));
  for (let y = HZ + 2; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pc = px.get(x, y);
      if (y < HZ + 6 && pc !== bands[5] && pc !== bands[4] && pc !== bands[3]) continue; // 도시 실루엣은 남긴다
      const [gx, gy] = inv(x + 0.5, y + 0.5), tx = Math.floor(gx), ty = Math.floor(gy), hv = hash(tx, ty);
      let c;
      const inside = Math.abs(gx) < R + 0.4 && Math.abs(gy) < R + 0.4;
      const roadA = gx > -0.8 && gx < 1.8 && gy > R + 0.3, roadB = gy > R + 5 && gy < R + 7.4;
      const fd = inField(gx, gy);
      if (fd) {
        const row = Math.floor((gx - fd[0]) * 2.2) & 1; // 이랑
        c = row ? Q.soil1 : Q.soil0;
        if (hash(x, y, 6) < 0.05) c = Q.dirt0;
      } else if (roadB || roadA) {
        if (tier === 2 && roadA) { c = (tx + ty) & 1 ? Q.stone1 : Q.stone0; if (gx - tx < 0.06 || gy - ty < 0.06) c = Q.road0; }
        else {
          c = hv < 0.33 ? Q.road0 : hv < 0.75 ? Q.road1 : Q.road2;
          if (roadB && Math.abs(gy - (R + 6.2)) < 0.12 && (Math.floor(gx * 1.4) & 1)) c = Q.roadLine;
          if (lv <= 6 && hash(tx * 3 + Math.floor(gx * 4), ty * 3 + Math.floor(gy * 4), 5) < 0.04) c = Q.crack;
        }
      } else if (inside) {
        c = hv < 0.4 ? Q.dirt0 : hv < 0.8 ? Q.dirt1 : Q.dirt2;
        if (dith(x, y, 0.15) && hash(x, y, 2) < 0.3) c = Q.dirt2;
        // 8레벨부터 본부 앞 돌길
        if (tier === 2 && ((gx > -0.8 && gx < 1.8 && gy > 0.4) || (gy > 0.6 && gy < 2.6 && gx > -1 && gx < 3))) { c = (tx + ty) & 1 ? Q.stone1 : Q.stone2; if (gx - tx < 0.06 || gy - ty < 0.06) c = Q.stone0; }
      } else {
        // 바깥 들판: 레벨이 오를수록 풀이 짙어지고 들꽃이 핀다
        const lush = Math.min(1, Math.max(0, (lv - 4) / 5));
        c = hv < 0.12 ? Q.grass0 : hv < 0.84 ? Q.grass1 : hv < 0.96 ? Q.grass2 : Q.dirt0;
        if (lush && hash(tx, ty, 9) < lush * 0.5) c = Q.grass2;
        if (hash(x, y, 3) < 0.06 + lush * 0.06) c = Q.blade;
        if (hash(x, y, 4) < 0.02 + lush * 0.03) c = Q.grass3;
        if (hash(x, y, 8) < flowers) { const k = hash(x, y, 10); c = k < 0.4 ? Q.flowerY : k < 0.75 ? Q.flowerW : Q.flowerP; }
      }
      if (!inside && !roadA && !roadB && !fd && (gx - tx < 0.04 || gy - ty < 0.04) && hv > 0.7) c = lerpC(c, P.void, 0.15);
      const far = Math.max(0, 1 - (y - HZ) / (h * 0.16));
      if (far > 0) c = lerpC(c, fadeC, far * (night ? 0.75 : 0.5));
      px.set(x, y, c);
    }
  }
  if (lv <= 5) for (const [gx, gy, r] of [[-7, 7, 6], [6, R + 8.5, 7], [-3, R + 9.5, 5]]) { // 웅덩이(달빛 반사)
    const [x, y] = I(gx, gy); px.oval(x, y, r, r * 0.45, Q.road0); px.oval(x - 1, y - 1, r * 0.5, r * 0.2, bands[2]); px.set(x + 1, y, P.starD);
  }

  // 물체들: 깊이(gx+gy) 순서로 그린다
  const items = [];
  const add = (depth, fn) => items.push([depth, fn]);
  const win = (x, y, ww = 3, hh = 3, glow = 1) => {
    px.rect(x, y, ww, hh, night ? P.win : Q.glass2);
    if (night) { px.rect(x, y + hh - 1, ww, 1, P.winD); if (glow) lights.push([x + ww / 2, y + hh / 2, 7 + ww, 'win']); }
    else px.set(x, y, Q.glass);
  };

  // 울타리: 2~4 말뚝, 5~7 말뚝 + 함석판, 8~10 돌담과 등
  const G0 = -1, G1 = 2; // 정문 자리(gy = R 변, gx -1 ~ 2)
  const gateGap = (gx, gy) => gy === R && gx > G0 && gx < G1;
  if (tier < 2) {
    const post = (gx, gy) => add(gx + gy, () => {
      const front = gy === R || gx === R; // 앞쪽 두 변은 낮게(안이 보이게)
      const hgt = front ? 8 + Math.floor(hash(gx, gy) * 3) : (tier ? 14 : 12) + Math.floor(hash(gx, gy) * 4);
      isoBox(px, I, gx - 0.3, gy - 0.3, 0, 0.6, 0.6, hgt, Q.wood2, Q.wood1, Q.wood0);
      const [tx, ty] = I(gx, gy, hgt + 2); px.set(tx, ty, Q.wood3); px.set(tx, ty + 1, Q.wood2);
    });
    for (let i = -R; i <= R; i++) { post(i, -R); post(-R, i); if (!gateGap(i, R) && i !== G0 && i !== G1) post(i, R); post(R, i); }
    const rails = [[[-R, -R], [R, -R]], [[-R, -R], [-R, R]], [[R, -R], [R, R]], [[-R, R], [G0, R]], [[G1, R], [R, R]]];
    for (const [a, b] of rails) add(a[0] + a[1] + 0.05 + (b[0] + b[1] - a[0] - a[1]) / 2, () => {
      const z = a[1] === R || a[0] === R ? 5 : 7;
      const p = I(a[0], a[1], z), q = I(b[0], b[1], z); px.line(p[0], p[1], q[0], q[1], Q.wood3); px.line(p[0], p[1] + 1, q[0], q[1] + 1, Q.wood0);
    });
    if (tier === 1) { // 함석판 보강(한 칸씩)
      const plate = (gx, gy, alongX) => add(gx + gy + 0.4, () => {
        if (alongX) isoBox(px, I, gx + 0.3, gy - 0.12, 0, 0.4 + 0.4, 0.24, 10, Q.sheet2, Q.sheet1, Q.sheet0);
        else isoBox(px, I, gx - 0.12, gy + 0.3, 0, 0.24, 0.8, 10, Q.sheet2, Q.sheet1, Q.sheet0);
      });
      for (let i = -R; i < R; i++) if ((i + 7) % 3) { plate(i, -R, true); plate(-R, i, false); }
    }
  } else {
    const seg = (gx, gy, alongX) => add(gx + gy + 0.5, () => {
      const H = gy === R || gx === R ? 5 : 9;
      if (alongX) { isoBox(px, I, gx, gy - 0.2, 0, 1, 0.4, H, Q.brick2, Q.brick1, Q.brick0); isoBox(px, I, gx - 0.02, gy - 0.25, H, 1.04, 0.5, 1.5, Q.cap, Q.stone1, Q.stone0); }
      else { isoBox(px, I, gx - 0.2, gy, 0, 0.4, 1, H, Q.brick2, Q.brick1, Q.brick0); isoBox(px, I, gx - 0.25, gy - 0.02, H, 0.5, 1.04, 1.5, Q.cap, Q.stone1, Q.stone0); }
      const p = alongX ? I(gx + 0.5, gy + 0.2, 4) : I(gx + 0.2, gy + 0.5, 4); px.set(p[0], p[1], Q.brick0); px.set(p[0] + 1, p[1] - 3, Q.brick0);
    });
    for (let i = -R; i < R; i++) { seg(i, -R, true); seg(-R, i, false); seg(R, i, false); if (i >= G1 || i < G0) seg(i, R, true); }
    const pillar = (gx, gy) => add(gx + gy + 0.6, () => {
      const H = gy === R || gx === R ? 9 : 14;
      isoBox(px, I, gx - 0.35, gy - 0.35, 0, 0.7, 0.7, H, Q.cap, Q.brick1, Q.brick0);
      const [x, y] = I(gx, gy, H + 2); px.rect(x - 1, y - 3, 3, 3, night ? P.win : Q.glass2); px.rect(x - 1, y - 4, 3, 1, Q.metal1);
      if (night) lights.push([x, y - 2, 12, 'bulb']);
    });
    for (const [gx, gy] of [[-R, -R], [R, -R], [-R, R], [R, R], [-R, 0], [0, -R], [R, 0], [-R + 3, R], [R - 2, R], [-R, -3], [3, -R], [R, 3], [-3, -R], [-R, 3], [R, -3]]) pillar(gx, gy);
  }
  // 정문 기둥과 간판(6레벨부터 전구, 10레벨 현수막)
  add(G0 + R + 0.6, () => {
    const st = tier === 2;
    for (const gx of [G0, G1]) isoBox(px, I, gx - 0.3, R - 0.3, 0, 0.6, 0.6, 22, st ? Q.cap : Q.wood2, st ? Q.brick1 : Q.wood1, st ? Q.brick0 : Q.wood0);
    const a = I(G0, R, 22), b = I(G1, R, 22);
    px.poly([[a[0], a[1] - 4], [b[0], b[1] - 4], [b[0], b[1] + 1], [a[0], a[1] + 1]], st ? Q.wood2 : Q.wood1);
    px.line(a[0], a[1] - 4, b[0], b[1] - 4, Q.wood3);
    for (let k = 0; k < 6; k++) px.set(Math.round(a[0] + (b[0] - a[0]) * (0.2 + k * 0.12)), Math.round(a[1] + (b[1] - a[1]) * (0.2 + k * 0.12)) - 2, night ? P.cityLit : Q.wood0);
    if (lv >= 6) for (let k = 0; k <= 8; k++) bulbs.push([a[0] + (b[0] - a[0]) * k / 8, a[1] - 6 + (b[1] - a[1]) * k / 8, k % 3, 0]);
    if (lv >= 10) { // 현수막
      const p = I(G0 + 0.1, R, 18), q = I(G1 - 0.1, R, 18);
      px.poly([[p[0], p[1]], [q[0], q[1]], [q[0], q[1] + 6], [p[0], p[1] + 6]], Q.awnR);
      px.line(p[0], p[1] + 2, q[0], q[1] + 2, Q.awnW); px.line(p[0], p[1] + 4, q[0], q[1] + 4, Q.awnW);
    }
  });

  // 망루(3레벨부터, 7레벨에 하나 더): 탐조등이 들판을 훑는다
  const tower = (gx, gy, main) => add(gx + gy - 1, () => {
    for (const [ox, oy] of [[0, 0], [1.3, 0], [0, 1.3], [1.3, 1.3]]) isoBox(px, I, gx + ox, gy + oy, 0, 0.22, 0.22, 30, Q.wood2, Q.wood1, Q.wood0);
    for (const z of [9, 19]) { const p = I(gx + 0.1, gy + 1.3, z), q = I(gx + 1.3, gy + 1.3, z + 6); px.line(p[0], p[1], q[0], q[1], Q.wood1); const r = I(gx + 1.3, gy + 0.1, z), s2 = I(gx + 1.3, gy + 1.3, z + 6); px.line(r[0], r[1], s2[0], s2[1], Q.wood0); }
    isoBox(px, I, gx - 0.15, gy - 0.15, 30, 1.8, 1.8, 3, Q.wood3, Q.wood1, Q.wood0, Q.wood3);
    for (const [ox, oy] of [[0, 1.8], [1.8, 0], [1.8, 1.8]]) { const p = I(gx - 0.15 + ox, gy - 0.15 + oy, 33), q = I(gx - 0.15 + ox, gy - 0.15 + oy, 38); px.line(p[0], p[1], q[0], q[1], Q.wood1); }
    const t = I(gx + 0.75, gy + 0.75, 50), e1 = I(gx - 0.3, gy + 1.95, 40), e2 = I(gx + 1.95, gy + 1.95, 40), e3 = I(gx + 1.95, gy - 0.3, 40);
    px.poly([t, e1, e2], tier === 2 ? Q.roof1 : Q.metal1); px.poly([t, e2, e3], tier === 2 ? Q.roof0 : Q.metal0); px.line(t[0], t[1], e2[0], e2[1], tier === 2 ? Q.roof2 : Q.metal2);
    const lamp = I(gx + 0.75, gy + 1.95, 34);
    folk.push({ x: lamp[0] - 3, y: lamp[1] - 3, kind: 'bust', map: person(main ? 1 : 5) });
    if (night && lv >= 3) beams.push({ x: lamp[0], y: lamp[1], ph: main ? 0 : 2.4 });
  });
  if (lv >= 3) tower(-R + 0.4, -R + 0.4, true);
  if (lv >= 7) tower(R - 1.9, -R + 0.4, false);

  // 본부: 2~4 판자 오두막, 5~7 넓은 오두막, 8~10 2층
  const hq = tier === 0 ? [-2.4, -1.8, 2.4, 2, 16] : tier === 1 ? [-2.9, -2.3, 3, 2.4, 18] : [-3.2, -2.6, 3.2, 2.6, 18];
  let chimney = null, flag = null;
  add(hq[0] + hq[1] + hq[3] * 0.5, () => {
    const [gx, gy, sx, sy, hz] = hq;
    isoBox(px, I, gx, gy, 0, sx, sy, hz, Q.wood2, Q.wood1, Q.wood0);
    for (let z = 3; z < hz; z += 3) { const p = I(gx, gy + sy, z), q = I(gx + sx, gy + sy, z); px.line(p[0], p[1], q[0], q[1], Q.wood0); const r = I(gx + sx, gy + sy, z), s2 = I(gx + sx, gy, z); px.line(r[0], r[1], s2[0], s2[1], g('#2a1d13')); }
    const d0 = I(gx + sx * 0.6, gy + sy, 0); px.rect(d0[0] - 2, d0[1] - 10, 5, 10, night ? C('#1a120c') : Q.wood0); px.set(d0[0] + 1, d0[1] - 5, night ? P.cityLit : Q.metal3);
    if (night) lights.push([d0[0], d0[1] - 4, 9, 'win']);
    for (const f of [0.22, ...(tier ? [0.86] : [])]) { const w0 = I(gx + sx * f, gy + sy, 9); win(w0[0] - 1, w0[1] - 4, 4, 4); }
    const w1 = I(gx + sx, gy + sy * 0.45, 9); win(w1[0] - 2, w1[1] - 4, 4, 4, 0);
    let top = hz;
    if (tier === 2) { // 2층
      isoBox(px, I, gx + 0.3, gy + 0.3, hz, sx - 0.6, sy - 0.6, 12, Q.wood3, Q.wood2, Q.wood1);
      for (const f of [0.25, 0.7]) { const w2 = I(gx + 0.3 + (sx - 0.6) * f, gy + sy - 0.3, hz + 8); win(w2[0] - 1, w2[1] - 4, 4, 4); }
      const w3 = I(gx + sx - 0.3, gy + sy * 0.5, hz + 8); win(w3[0] - 2, w3[1] - 4, 4, 4, 0);
      isoBox(px, I, gx - 0.2, gy - 0.2, hz, sx + 0.4, 0.2, 1, Q.wood3, Q.wood2, Q.wood1);
      top = hz + 12;
      // 지붕의 태양광 판
      const sp = (a, b) => { const p = [I(gx + a, gy + b, top + 2), I(gx + a + 0.9, gy + b, top + 2), I(gx + a + 0.9, gy + b + 0.7, top + 2), I(gx + a, gy + b + 0.7, top + 2)]; px.poly(p, Q.panel); px.line(p[0][0], p[0][1], p[2][0], p[2][1], Q.panel2); };
      isoBox(px, I, gx + 0.1, gy + 0.1, top, sx - 0.2, sy - 0.2, 2, Q.metal2, Q.metal1, Q.metal0);
      sp(0.5, 0.5); sp(1.5, 0.5);
    } else {
      isoBox(px, I, gx - 0.25, gy - 0.25, hz, sx + 0.5, sy + 0.5, 2, Q.metal2, Q.metal1, Q.metal0);
      for (let k = 0; k <= 5; k++) { const p = I(gx - 0.25 + k * (sx + 0.5) / 5, gy - 0.25, hz + 2), q = I(gx - 0.25 + k * (sx + 0.5) / 5, gy + sy + 0.25, hz + 2); px.line(p[0], p[1], q[0], q[1], Q.metal1); }
    }
    isoBox(px, I, gx + 0.3, gy + 0.3, top + 2, 0.45, 0.45, 9, Q.stone2, Q.stone1, Q.stone0);
    const ant = I(gx + sx - 0.3, gy + 0.3, top + 2); px.line(ant[0], ant[1], ant[0], ant[1] - 14, Q.metal3); px.line(ant[0] - 2, ant[1] - 11, ant[0] + 2, ant[1] - 11, Q.metal3);
    chimney = I(gx + 0.5, gy + 0.5, top + 13);
    flag = I(gx + sx * 0.75, gy + sy * 0.3, top + 4);
  });

  // 천막(2~4)과 오두막(5부터): 레벨이 오를수록 천막이 집으로 바뀌고 집이 늘어난다
  const tent = (gx, gy, c0, c1, c2) => add(gx + gy + 1, () => {
    const L = 1.8, Wd = 1.2, H = 11;
    const f1 = I(gx, gy + Wd, 0), f2 = I(gx, gy, 0), b1 = I(gx + L, gy + Wd, 0), b2 = I(gx + L, gy, 0), rf = I(gx, gy + Wd / 2, H), rb = I(gx + L, gy + Wd / 2, H);
    px.poly([f2, b2, rb, rf], c0); px.poly([f1, b1, rb, rf], c1);
    px.poly([b1, b2, rb], c2); px.poly([I(gx + L, gy + Wd * 0.3, 0), I(gx + L, gy + Wd * 0.7, 0), I(gx + L, gy + Wd / 2, 7)], night ? C('#120e0a') : Q.wood0);
    px.line(rf[0], rf[1], rb[0], rb[1], c2);
    if (night) { const [x, y] = I(gx + L, gy + Wd / 2, 2); lights.push([x, y, 8, 'win']); }
  });
  const cabin = (gx, gy, sx, sy, blue, solar) => add(gx + gy + (sx + sy) * 0.5, () => {
    const hz = 11;
    isoBox(px, I, gx, gy, 0, sx, sy, hz, Q.wood3, Q.wood2, Q.wood1);
    for (let z = 3; z < hz; z += 3) { const p = I(gx, gy + sy, z), q = I(gx + sx, gy + sy, z); px.line(p[0], p[1], q[0], q[1], Q.wood1); }
    const w0 = I(gx + sx * 0.3, gy + sy, 8); win(w0[0] - 1, w0[1] - 4, 3, 3);
    const d0 = I(gx + sx * 0.72, gy + sy, 0); px.rect(d0[0] - 1, d0[1] - 7, 3, 7, Q.wood0);
    const w1 = I(gx + sx, gy + sy * 0.5, 8); win(w1[0] - 2, w1[1] - 4, 3, 3, 0);
    // 박공지붕
    const [r0, r1, r2] = blue ? [Q.roofB0, Q.roofB1, Q.roofB2] : [Q.roof0, Q.roof1, Q.roof2];
    const e = 0.2, a1 = I(gx - e, gy + sy + e, hz), a2 = I(gx + sx + e, gy + sy + e, hz), b1 = I(gx - e, gy - e, hz), b2 = I(gx + sx + e, gy - e, hz);
    const t1 = I(gx - e, gy + sy / 2, hz + 7), t2 = I(gx + sx + e, gy + sy / 2, hz + 7);
    px.poly([b1, b2, t2, t1], r0); px.poly([a1, a2, t2, t1], r1); px.poly([I(gx + sx + e, gy + sy + e, hz), I(gx + sx + e, gy - e, hz), t2], r0);
    px.line(t1[0], t1[1], t2[0], t2[1], r2); px.line(a1[0], a1[1], a2[0], a2[1], r2);
    if (solar) { // 지붕 앞면 가운데의 태양광 판(칸 줄무늬)
      const x0 = gx + sx * 0.3, x1 = gx + sx * 0.7, y0 = gy + sy / 2 + 0.25, y1 = gy + sy - 0.05, z0 = hz + 5.2, z1 = hz + 1.6;
      px.poly([I(x0, y0, z0), I(x1, y0, z0), I(x1, y1, z1), I(x0, y1, z1)], Q.panel);
      const m0 = I((x0 + x1) / 2, y0, z0), m1 = I((x0 + x1) / 2, y1, z1); px.line(m0[0], m0[1], m1[0], m1[1], Q.panel2);
      const a = I(x0, y0, z0), b = I(x1, y0, z0); px.line(a[0], a[1], b[0], b[1], Q.panel2);
    }
  });
  const slots = tier === 0 ? { A: [0.6, -3.4], B: [1.6, -1.2] } : tier === 1 ? { A: [0.5, -4.4, 2.2, 1.6], B: [1.2, -1.8, 1.8, 1.4], C: [3.3, -2.8, 1.4, 2.2] } : { A: [0.4, -5.2, 2.4, 1.8], B: [1.2, -2.2, 2, 1.5], C: [3.8, -3.6, 1.6, 2.6], D: [-5.4, -0.8, 1.6, 1.8] };
  if (lv <= 4) tent(...slots.A, Q.tent0, Q.tent1, Q.tent2); else cabin(...slots.A, false, lv >= 8);
  if (lv >= 3) { if (lv <= 5) tent(...(tier ? [1.4, -1.6] : slots.B), Q.canvas0, Q.canvas1, g('#8e7c58')); else cabin(...slots.B, true, lv >= 8); }
  if (lv >= 7) cabin(...slots.C, false, lv >= 8);
  if (lv >= 8) cabin(...slots.D, true, true);

  // 배움터(8레벨부터): 종탑과 깃발
  if (lv >= 8) {
    const [gx, gy, sx, sy] = [2.8, 2.4, 2.4, 1.8];
    add(gx + gy + 2, () => {
      isoBox(px, I, gx, gy, 0, sx, sy, 12, Q.awnW, g('#c8bca4'), g('#a89c86'));
      for (const f of [0.2, 0.5, 0.8]) { const w0 = I(gx + sx * f, gy + sy, 8); win(w0[0] - 1, w0[1] - 4, 3, 3, f === 0.5); }
      isoBox(px, I, gx - 0.15, gy - 0.15, 12, sx + 0.3, sy + 0.3, 2, Q.roofB2, Q.roofB1, Q.roofB0);
      isoBox(px, I, gx + sx * 0.4, gy + sy * 0.35, 14, 0.6, 0.6, 7, Q.awnW, g('#c8bca4'), g('#a89c86'));
      const t = I(gx + sx * 0.4 + 0.3, gy + sy * 0.35 + 0.3, 26), e1 = I(gx + sx * 0.4 - 0.1, gy + sy * 0.35 + 0.7, 21), e2 = I(gx + sx * 0.4 + 0.7, gy + sy * 0.35 + 0.7, 21), e3 = I(gx + sx * 0.4 + 0.7, gy + sy * 0.35 - 0.1, 21);
      px.poly([t, e1, e2], Q.roofB1); px.poly([t, e2, e3], Q.roofB0);
      const b = I(gx + sx * 0.4 + 0.3, gy + sy * 0.35 + 0.6, 17); px.rect(b[0] - 1, b[1] - 2, 3, 3, Q.bell);
      const s = I(gx + sx * 0.4 + 0.3, gy + sy * 0.35 + 0.3, 26); px.line(s[0], s[1], s[0], s[1] - 8, Q.metal3);
      px.sprite(['bbbb', 'bwwb', 'bbbb'], s[0] + 1, s[1] - 8, { b: Q.awnB, w: Q.awnW });
    });
  } else {
    const crate = (gx, gy, z = 0) => add(gx + gy + z * 0.01, () => { isoBox(px, I, gx, gy, z, 0.7, 0.7, 6, Q.wood3, Q.wood2, Q.wood1); const p = I(gx, gy + 0.7, z), q = I(gx + 0.7, gy + 0.7, z + 6); px.line(p[0], p[1], q[0], q[1], Q.wood0); });
    const cg = tier ? [3.2, 3.2] : [2.6, 2.4];
    crate(cg[0], cg[1]); crate(cg[0] + 0.6, cg[1]); crate(cg[0] + 0.3, cg[1], 6);
  }
  const barrel = (gx, gy, c) => add(gx + gy, () => { const [x, y] = I(gx, gy); px.rect(x - 2, y - 7, 5, 7, c); px.rect(x - 2, y - 5, 5, 1, Q.metal0); px.oval(x, y - 7, 2.5, 1.2, lerpC(c, P.white, 0.25)); px.set(x - 2, y - 6, lerpC(c, P.white, 0.3)); });
  if (lv < 8) { barrel(-R + 0.9, R - 0.9, g('#4a6a3a')); barrel(-R + 1.4, R - 0.5, g('#8a2e22')); }
  else { barrel(4.6, 0.6, g('#3a5a8a')); barrel(5.1, 1, g('#3a5a8a')); } // 빗물 통

  // 물탱크(4레벨부터)
  if (lv >= 4) {
    const [gx, gy] = tier === 0 ? [3.0, -3.4] : tier === 1 ? [-4.5, -2.1] : [-5.2, -3.6];
    add(gx + gy + 0.6, () => {
      for (const [ox, oy] of [[0, 0], [0.7, 0], [0, 0.7], [0.7, 0.7]]) isoBox(px, I, gx + ox, gy + oy, 0, 0.12, 0.12, 12, Q.metal1, Q.metal0, Q.metal0);
      const [x, y] = I(gx + 0.4, gy + 0.4, 12);
      px.rect(x - 5, y - 12, 11, 12, Q.metal2); px.rect(x - 5, y - 12, 3, 12, Q.metal3); px.rect(x + 3, y - 12, 3, 12, Q.metal1);
      px.oval(x, y - 12, 5.5, 2.2, Q.metal3); px.rect(x - 5, y - 6, 11, 1, Q.metal0);
    });
  }

  // 밭: 4 새싹 → 5 잎 → 6 무성 → 7부터 열매, 9부터 바깥 밀밭
  const crop = (gx, gy, stage, k) => add(gx + gy, () => {
    const [x, y] = I(gx, gy);
    if (stage === 0) { px.set(x, y - 1, Q.sprout); px.set(x - 1, y - 2, Q.sprout); px.set(x + 1, y - 2, Q.leaf2); }
    else if (stage === 1) { px.set(x, y - 1, Q.leaf); px.set(x - 1, y - 2, Q.leaf2); px.set(x + 1, y - 2, Q.leaf2); px.set(x, y - 3, Q.leaf2); }
    else if (stage === 2 || stage === 3) {
      px.rect(x - 1, y - 4, 3, 3, Q.leaf); px.set(x, y - 5, Q.leaf2); px.set(x - 2, y - 3, Q.leaf2); px.set(x + 2, y - 3, Q.leaf);
      if (stage === 3 && k % 3 === 0) px.set(x + (k & 1 ? 1 : -1), y - 3, Q.fruit);
      if (stage === 3 && k % 5 === 1) px.rect(x - 1, y - 2, 3, 2, Q.pumpkin);
    } else { for (let i = -1; i <= 1; i++) { px.line(x + i, y, x + i, y - 5, Q.wheat); px.set(x + i, y - 6, Q.wheat2); px.set(x + i, y - 5, Q.wheat2); } }
  });
  fields.forEach(([a, b, c, d], fi) => {
    // 나무 테두리와 밤에는 모퉁이 등불(밭이 어둠에 묻히지 않게)
    add(a + d - 0.2, () => {
      for (const [p, q] of [[I(a, b), I(c, b)], [I(a, b), I(a, d)], [I(c, b), I(c, d)], [I(a, d), I(c, d)]]) { px.line(p[0], p[1] - 1, q[0], q[1] - 1, Q.wood2); px.line(p[0], p[1], q[0], q[1], Q.wood0); }
    });
    if (fi === 0) add(c + d + 0.1, () => {
      const [x, y] = I(c, d); px.line(x, y, x, y - 12, Q.wood1); px.rect(x - 1, y - 15, 3, 3, night ? P.light : Q.metal2); px.set(x, y - 16, Q.metal1);
      if (night) lights.push([x, y - 8, 22, 'light']);
    });
    const stage = fi === 2 ? 4 : fi === 1 ? (lv >= 9 ? 4 : 2) : Math.min(3, lv - 4);
    let k = 0;
    for (let gx = a + 0.3; gx < c - 0.1; gx += 0.45) for (let gy = b + 0.3; gy < d - 0.1; gy += 0.55) crop(gx, gy, stage, k++);
  });
  // 허수아비(5레벨부터 첫 밭)
  if (lv >= 5 && fields[0]) {
    const [a, b, c, d] = fields[0], sx = (a + c) / 2, sy = (b + d) / 2;
    add(sx + sy + 0.2, () => {
      const [x, y] = I(sx, sy); px.line(x, y, x, y - 16, Q.wood1); px.line(x - 5, y - 11, x + 5, y - 11, Q.wood1);
      px.sprite(['.cc.', 'cssc', '.ss.', 'jjjj', 'jjjj'], x - 2, y - 17, { c: Q.wheat, s: Q.canvas1, j: Q.awnR });
    });
  }
  // 온실(8레벨부터, 바깥 밭 끝)
  if (lv >= 8) {
    const [gx, gy, sx, sy] = [-10.4, -0.8, 2.8, 1.6];
    add(gx + gy + 2, () => {
      const a = [I(gx, gy + sy, 0), I(gx + sx, gy + sy, 0), I(gx + sx, gy + sy, 8), I(gx, gy + sy, 8)];
      const b = [I(gx + sx, gy + sy, 0), I(gx + sx, gy, 0), I(gx + sx, gy, 8), I(gx + sx, gy + sy, 8)];
      px.poly(a, Q.glass, 0.85); px.poly(b, Q.glassD, 0.85);
      const r1 = I(gx, gy + sy / 2, 13), r2 = I(gx + sx, gy + sy / 2, 13);
      px.poly([I(gx, gy + sy, 8), I(gx + sx, gy + sy, 8), r2, r1], Q.glass2, 0.7); px.poly([I(gx, gy, 8), I(gx + sx, gy, 8), r2, r1], Q.glass, 0.7);
      for (let k = 0; k < 9; k++) { const p = I(gx + 0.3 + (k % 3) * 0.9, gy + sy, 2 + Math.floor(k / 3) * 2); px.set(p[0], p[1], Q.leaf2); px.set(p[0] + 1, p[1], Q.leaf); }
      for (let k = 0; k <= 4; k++) { const p = I(gx + k * sx / 4, gy + sy, 0), q = I(gx + k * sx / 4, gy + sy, 8); px.line(p[0], p[1], q[0], q[1], Q.metal3); }
      px.line(r1[0], r1[1], r2[0], r2[1], Q.metal3);
      if (night) { const [x, y] = I(gx + sx / 2, gy + sy, 4); lights.push([x, y, 10, 'bulbG']); }
    });
  }
  // 풍차(7레벨부터): 바람으로 불을 켠다
  let mill = null;
  if (lv >= 7) {
    const [gx, gy] = tier === 1 ? [-7.4, -6.2] : [-8.6, -7.2];
    const [bx, by] = I(gx, gy);
    mill = { x: bx, y: by - 38, r: 17 };
    add(gx + gy, () => {
      px.poly([[bx - 8, by], [bx + 8, by], [bx + 4, by - 36], [bx - 4, by - 36]], Q.stone1);
      px.poly([[bx, by], [bx + 8, by], [bx + 4, by - 36], [bx, by - 36]], Q.stone0);
      px.poly([[bx - 6, by - 36], [bx + 6, by - 36], [bx, by - 44]], Q.roof1); px.poly([[bx, by - 36], [bx + 6, by - 36], [bx, by - 44]], Q.roof0);
      px.rect(bx - 2, by - 7, 4, 7, Q.wood0);
      win(bx - 1, by - 22, 3, 3);
    });
  }
  // 빨랫줄(6레벨부터)
  if (lv >= 6) {
    const [ax, ay] = tier === 1 ? [2.4, 1.0] : [3.0, 0.3], L = 1.6;
    add(ax + ay + 1.5, () => {
      const p = I(ax, ay), q = I(ax + L, ay);
      px.line(p[0], p[1], p[0], p[1] - 13, Q.wood1); px.line(q[0], q[1], q[0], q[1] - 13, Q.wood1);
      px.line(p[0], p[1] - 13, q[0], q[1] - 13, Q.metal3);
    });
    const p = I(ax, ay), q = I(ax + L, ay);
    for (let k = 0; k < 4; k++) cloth.push([p[0] + (q[0] - p[0]) * (0.15 + k * 0.22), p[1] - 13 + (q[1] - p[1]) * (0.15 + k * 0.22), [Q.awnW, Q.awnB, Q.awnR, Q.awnG][k]]);
  }
  // 장터(9레벨부터): 정문 밖 길가 노점과 등불 줄
  if (lv >= 9) {
    const stall = (gx, gy, c) => add(gx + gy + 0.8, () => {
      isoBox(px, I, gx, gy, 0, 1.4, 1, 5, Q.wood3, Q.wood2, Q.wood1);
      for (const [ox, oy] of [[0, 0], [1.3, 0], [0, 0.9], [1.3, 0.9]]) isoBox(px, I, gx + ox, gy + oy, 0, 0.1, 0.1, 13, Q.wood1, Q.wood0, Q.wood0);
      const a = I(gx - 0.1, gy + 1.1, 12), b = I(gx + 1.5, gy + 1.1, 12), b2 = I(gx + 1.5, gy - 0.1, 14), a2 = I(gx - 0.1, gy - 0.1, 14);
      px.poly([a2, b2, b, a], c);
      for (let k = 0; k < 4; k++) { const p = I(gx - 0.1 + k * 0.4, gy + 1.1, 12), q = I(gx - 0.1 + k * 0.4, gy - 0.1, 14); px.line(p[0], p[1], q[0], q[1], Q.awnW); }
      const top = I(gx + 0.7, gy + 0.5, 5); px.rect(top[0] - 3, top[1] - 2, 2, 2, Q.pumpkin); px.rect(top[0], top[1] - 2, 2, 2, Q.fruit); px.rect(top[0] + 3, top[1] - 1, 2, 1, Q.wheat2);
    });
    stall(-2.8, R + 1.4, Q.awnR); stall(2.2, R + 1.0, Q.awnB); stall(2.4, R + 3.0, Q.awnG); stall(-3.0, R + 3.6, Q.awnB);
    const a = I(-1.2, R + 2.2, 18), b = I(2.2, R + 1.6, 18), c = I(-1.4, R + 4.2, 17), d = I(2.4, R + 3.6, 17);
    for (const [p, q] of [[a, b], [c, d]]) for (let k = 0; k <= 10; k++) { const f = k / 10; bulbs.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f + Math.sin(f * Math.PI) * 4, 3, 1]); }
  }
  // 가로등(5레벨부터 정문 밖 길)
  if (lv >= 5) for (const [gx, gy] of [[-1.2, R + 1], [2.2, R + 2.4], [-1.2, R + 4.6], [5, R + 6.8], [-5, R + 6.8]]) add(gx + gy, () => {
    const [x, y] = I(gx, gy); px.line(x, y, x, y - 20, Q.metal1); px.line(x, y - 20, x + 3, y - 18, Q.metal1); px.rect(x + 2, y - 18, 3, 2, night ? P.light : Q.metal2);
    if (night) lights.push([x + 3, y - 15, 14, 'light']);
  });
  // 나무: 2~4 마른 고목 → 5~7 새잎 → 8~10 무성한 나무
  const tree = (gx, gy, s) => add(gx + gy, () => {
    const [x, y] = I(gx, gy), H = Math.round(26 * s);
    px.rect(x - 1, y - H, 2, H, Q.wood0); px.set(x + 1, y - H, Q.wood1);
    for (let k = 0; k < 5; k++) {
      const by = y - H + 3 + k * Math.round(4 * s), dir = k % 2 ? 1 : -1, len = Math.round((8 - k) * s);
      px.line(x, by, x + dir * len, by - Math.round(len * 0.6), Q.wood0);
      px.line(x + dir * Math.round(len * 0.6), by - Math.round(len * 0.36), x + dir * Math.round(len * 0.8), by - Math.round(len), Q.wood0);
    }
    if (lv >= 5) {
      const n = lv >= 8 ? 46 : 14, c1 = lv >= 8 ? Q.leafT1 : Q.bud, c2 = lv >= 8 ? Q.leafT2 : Q.leafT1;
      if (lv >= 8) { px.disc(x, y - H + 4, 8 * s, Q.leafT0); px.disc(x - 3, y - H + 1, 6 * s, Q.leafT1); px.disc(x + 3, y - H + 3, 6 * s, Q.leafT1); }
      for (let k = 0; k < n; k++) { const a = hash(k, gx) * Math.PI * 2, r = hash(k, gy) * 9 * s; px.set(x + Math.cos(a) * r, y - H + 4 + Math.sin(a) * r * 0.8, hash(k, 3) < 0.5 ? c1 : c2); }
      if (lv >= 8) for (let k = 0; k < 10; k++) px.set(x - 5 + hash(k, gx, 2) * 10, y - H - 2 + hash(k, gy, 2) * 6, Q.leaf2);
    }
  });
  for (const [gx, gy, s] of [[-R - 2.5, R + 2, 1], [R + 3, -1.4, 0.9], [-R - 0.5, R + 8.5, 1.15], [R + 5, R + 3, 1], [R + 1.5, -R - 3, 0.85]]) tree(gx, gy, s);
  // 폐허·버려진 차(앞쪽 레벨에만): 나아질수록 치워진다
  const ruin = (gx, gy, sx, sy, hz) => add(gx + gy + sx + sy, () => {
    isoBox(px, I, gx, gy, 0, sx, sy, hz, g('#3a3a42'), g('#2c2c34'), g('#222228'));
    for (let z = 6; z < hz - 4; z += 7) for (let k = 0.4; k < sx - 0.3; k += 0.9) { const p = I(gx + k, gy + sy, z); px.rect(p[0], p[1] - 3, 2, 3, hash(k, z, gx) < 0.15 ? P.winD : g('#141418')); }
    const p = I(gx, gy + sy, hz), q = I(gx + sx, gy + sy, hz);
    for (let i = 0; i <= 8; i++) { const x = Math.round(p[0] + (q[0] - p[0]) * i / 8), y = Math.round(p[1] + (q[1] - p[1]) * i / 8); px.rect(x, y - Math.floor(hash(i, gx) * 6), 2, Math.floor(hash(i, gx) * 6) + 1, g('#2c2c34')); }
    if (lv >= 6) for (let k = 0; k < 24; k++) px.set(p[0] + hash(k, 1, gx) * (q[0] - p[0]), p[1] + 2 + hash(k, 2, gx) * 30, Q.vine); // 덩굴
  });
  if (lv <= 6) { ruin(-R - 7, 1, 3, 2.5, 40); ruin(R + 4.5, -R - 2, 2.5, 3, 34); }
  if (lv <= 5) add(R + 6 + 9.8, () => { // 큰길 위의 버려진 차
    const gx = 4.2, gy = R + 5.8;
    isoBox(px, I, gx, gy, 2, 2.6, 1.2, 5, g('#6a2a24'), g('#4e1e1a'), g('#3a1612'));
    isoBox(px, I, gx + 0.6, gy + 0.1, 7, 1.3, 1, 4, g('#3a4250'), g('#2a3038'), g('#20252c'));
    for (const [ox, oy] of [[0.4, 1.2], [2.2, 1.2]]) { const [x, y] = I(gx + ox, gy + oy, 1); px.disc(x, y, 1.6, P.ink); }
  });
  // 모닥불 돌 테두리와 장작
  const FIRE = [0.8, 1.6];
  add(FIRE[0] + FIRE[1], () => {
    const [x, y] = I(FIRE[0], FIRE[1]);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; px.rect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 3), 2, 1, k % 2 ? Q.stone2 : Q.stone1); }
    px.line(x - 4, y + 1, x + 3, y - 1, Q.wood1); px.line(x - 3, y - 1, x + 4, y + 1, Q.wood0);
    if (lv >= 4) for (const [ox, oy] of [[-1.3, 0.1], [0.9, -1.1]]) isoBox(px, I, FIRE[0] + ox, FIRE[1] + oy, 0, 0.9, 0.25, 2, Q.wood3, Q.wood2, Q.wood1); // 통나무 의자
  });

  const kids = lv >= 6 ? [3, 4, 5, 6, 7][lv - 6] : 0;
  if (kids && night) { // 놀이터 등
    const [gx, gy] = [R + 1.2, 1.2];
    add(gx + gy, () => { const [x, y] = I(gx, gy); px.line(x, y, x, y - 18, Q.metal1); px.line(x, y - 18, x + 3, y - 16, Q.metal1); px.rect(x + 2, y - 16, 3, 2, P.light); });
    const [x, y] = I(gx, gy); lights.push([x + 3, y - 10, 26, 'light']);
  }
  items.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());

  // 사람들: 레벨마다 늘어난다(대장은 주황 겉옷)
  const fire = I(FIRE[0], FIRE[1]);
  const ring = [[8, -12], [11, -4], [-6, -15], [2, -17], [14, 4], [-6, 6]]; // 왼쪽(밭)은 비워 둔다
  const adults = [3, 3, 5, 6, 8, 9, 11, 12, 15, 18][lv - 1] ?? 3;
  folk.push({ x: fire[0] - 15, y: fire[1] + 11, kind: lv >= 10 ? 'cheer' : 'adult', map: person(-1), lead: true }); // 대장(주황 겉옷)은 모닥불 앞
  for (let k = 0; k < Math.min(adults - 1, ring.length); k++) folk.push({ x: fire[0] + ring[k][0], y: fire[1] + ring[k][1], kind: lv >= 10 ? 'cheer' : 'adult', map: person(k), flip: ring[k][0] > 0 });
  const spots = [ // 일하는 사람들: 정문 보초, 밭, 빨래, 장터, 배움터 앞
    [I(G1 + 0.3, R + 0.7), 3, 0], [fields[0] && I(fields[0][0] + 0.8, (fields[0][1] + fields[0][3]) / 2), 4, 4], [fields[0] && I(fields[0][2] - 0.6, fields[0][1] + 0.6), 6, 5],
    [lv >= 6 && I(tier === 1 ? 3.2 : 3.6, tier === 1 ? 1.6 : 0.9), 7, 6], [fields[1] && I((fields[1][0] + fields[1][2]) / 2, fields[1][3] - 0.6), 0, 7],
    [lv >= 8 && I(3.4, 4.6), 2, 8], [lv >= 9 && I(-1.6, R + 2.8), 1, 9], [lv >= 9 && I(1.6, R + 2.2), 4, 9], [lv >= 9 && I(0.2, R + 4.4), 6, 9],
    [lv >= 7 && I(-R + 0.8, -R + 3.2), 5, 7], [lv >= 9 && I(2.8, R + 4.5), 3, 9], [lv >= 10 && I(-2.4, R + 2.4), 0, 10], [lv >= 10 && I(4.4, 3.4), 7, 10],
  ];
  for (const [p, k, need] of spots) {
    if (!p || lv < need) continue;
    folk.push({ x: p[0] - 3, y: p[1] - 11, kind: lv >= 10 ? 'cheer' : 'adult', map: person(k + 2), flip: k % 2 === 1, raw: true });
  }
  // 좀비(2~5): 울타리 밖 어둠 속을 서성인다. 레벨이 오를수록 줄고 멀어진다
  const zn = Math.max(0, 6 - lv);
  const ZSPOT = [[R + 3.4, -0.6], [R + 2.2, 1.4], [R + 2.8, 3.2], [R + 4.4, 1.8]];
  const zombies = ZSPOT.slice(0, zn).map(([ax, ay], k) => ({ ax, ay, bx: ax + 1, by: ay + 1.6, dur: 9 + k * 2.3, off: k * 3.1, shirt: [P.zcloth, P.zcloth2, C('#5a3a3a'), C('#4a4a3a')][k % 4] }));

  // 화면 가장자리 어둡게(비네트)
  const vig = [];
  const vEdge = night ? 0.8 : 0.9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.max(Math.abs(x / w - 0.5) * 2, Math.abs(y / h - 0.5) * 2); if (v > vEdge && dith(x, y, (v - vEdge) * 2.6)) vig.push(y * w + x); }
  const kidMap = (k) => ({ h: C(HAIRS[k % HAIRS.length]), s: C(SKINS[(k + 1) % SKINS.length]), j: C(['#e2c24a', '#e07aa0', '#6ac0e0', '#8ad07a', '#ff9a5a', '#c0a0ff'][k % 6]), p: C('#2c3340'), k: P.ink });
  return {
    px, w, h, HZ, I, R, lv, night, day, sun, fire, chimney, flag, mill, lights, folk, bulbs, cloth, beams, zombies, vig: Uint32Array.from(vig),
    kids: Array.from({ length: kids }, (_, k) => ({ map: gradeMap(kidMap(k), day, warm), ph: k / Math.max(1, kids), r: 12 + (k % 2) * 7 })),
    yard: I(R + 2.4, 2.2), // 아이들 놀이터: 오른쪽 앞 울타리 밖 빈터
    fireflies: lv >= 6 && lv <= 9 ? Array.from({ length: 4 + lv }, (_, k) => [hash(k, 31), hash(k, 32), hash(k, 33)]) : [],
    stars: lv >= 10 ? [] : Array.from({ length: Math.round(w * (lv >= 9 ? 0.12 : lv >= 5 ? 0.45 : 0.3)) }, (_, k) => [Math.floor(hash(k, 1) * w), Math.floor(hash(k, 2) * HZ * 0.8), hash(k, 3)]),
    smokes: lv <= 4 ? [0.12, 0.42, 0.66, 0.9].slice(0, 6 - lv).map((f, k) => [Math.round(w * f), HZ - 10 - Math.floor(hash(k, 8) * 12)]) : [],
    dog: lv >= 5 ? gradeMap({ d: X.dog, D: X.dogD }, day, warm) : null,
    hens: lv >= 7 ? Array.from({ length: lv >= 9 ? 5 : 3 }, (_, k) => [I(-R - 1.6 - (k % 3) * 0.7, 0.6 + Math.floor(k / 3) * 0.7), k]) : [],
    birds: lv >= 10 ? Array.from({ length: 7 }, (_, k) => [hash(k, 41), hash(k, 42), 0.5 + hash(k, 43)]) : [],
    petals: lv >= 10 ? Array.from({ length: 40 }, (_, k) => [hash(k, 51), hash(k, 52), 0.4 + hash(k, 53) * 0.8, k % 3]) : [],
    fog: lv <= 5 ? (6 - lv) / 4 : 0,
    henMap: gradeMap({ c: X.comb, w: X.hen, b: X.beak, y: X.beak }, day, warm),
    zMap: (shirt) => mapZ(shirt),
    Q,
  };
  function person(k) {
    if (k < 0) return gradeMap({ h: P.hair, s: P.skin, j: P.jacket, J: P.jacketD, p: P.pants, k: P.ink }, day, warm);
    const j = C(JACKETS[((k % JACKETS.length) + JACKETS.length) % JACKETS.length]);
    return gradeMap({ h: C(HAIRS[(k * 5 + 1) % HAIRS.length]), s: C(SKINS[(k * 3) % SKINS.length]), j, J: lerpC(j, P.ink, 0.3), p: k % 3 ? P.pants : C('#3a3026'), k: P.ink }, day, warm);
  }
}
function gradeMap(m, L, warm) { const o = {}; for (const k of Object.keys(m)) o[k] = k === 'k' ? m[k] : grade(m[k], L, warm); return o; }

// ---------- 매 프레임 ----------
const BULB_C = [X.bulb, X.bulbR, X.bulbG, X.bulbB];
function draw(px, S, t) {
  const { w, h, HZ, I, night, lv } = S;
  px.u.set(S.px.u);
  for (const [x, y, k] of S.stars) { const b = Math.sin(t * (1 + k * 3) + k * 40); if (b > 0.3) px.set(x, y, b > 0.85 ? P.star : P.starD); }
  // 불타는 도시(2~4): 연기 기둥과 지평선 불빛
  for (const [sx, sy] of S.smokes) for (let k = 0; k < 7; k++) {
    const life = ((t * 0.08 + k / 7 + sx * 0.013) % 1), r = 2 + life * 9;
    px.disc(sx + Math.sin(life * 4 + sx) * 3 + life * 10, sy - life * 40, r, life < 0.5 ? P.smoke2 : P.smoke, 0.45 * (1 - life));
  }
  if (lv <= 4) for (let x = 0; x < w; x++) if (hash(x, Math.floor(t * 6)) < (lv <= 3 ? 0.04 : 0.015)) px.set(x, HZ + 1 + Math.floor(hash(x, 7) * 2), P.fire0);
  // 해돋이(10): 햇살이 번진다
  if (S.sun) {
    const [sx, sy, sr] = S.sun;
    for (let k = 0; k < 14; k++) {
      const a = Math.PI + (k / 13) * Math.PI, len = sr * (3.2 + Math.sin(t * 1.3 + k * 1.7) * 0.6);
      for (let s = sr + 2; s < len; s += 1.3) { const f = s / len; const x = sx + Math.cos(a) * s, y = sy + Math.sin(a) * s * 0.8; if (y < HZ + 2 && dith(Math.round(x), Math.round(y), 0.55 * (1 - f))) px.set(x, y, X.ray); }
    }
  }
  // 굴뚝 연기
  if (S.chimney) for (let k = 0; k < 5; k++) { const life = (t * 0.25 + k / 5) % 1; px.disc(S.chimney[0] + life * 6 + Math.sin(life * 6 + t) * 1.5, S.chimney[1] - life * 22, 1.2 + life * 3, night ? P.smoke2 : C('#c8c4c0'), 0.6 * (1 - life)); }
  // 깃발
  if (S.flag) {
    const [fx, fy] = S.flag, wave = Math.floor(t * 4) % 2, big = lv >= 6;
    px.line(fx, fy, fx, fy - (big ? 16 : 12), P.metal3);
    const fl = big ? (wave ? ['rrrrr.', 'rwwwrr', 'rrrrr.', '.rrr..'] : ['rrrr..', 'rrwwwr', '.rrrrr', '..rrr.']) : (wave ? ['rrrr.', 'rrrrr', 'rrrr.', '.rr..'] : ['rrr..', 'rrrrr', '.rrrr', '..rr.']);
    px.sprite(fl, fx + 1, fy - (big ? 16 : 12), { r: P.red, w: P.white });
  }
  // 빛: 창문·가로등·온실이 둘레를 데운다(밤만)
  if (night) for (const [x, y, r, c] of S.lights) {
    const fl = 0.9 + hash(Math.floor(t * 3), x, y) * 0.12, col = c === 'bulbG' ? X.bulbG : c === 'light' ? P.light : P.fire1;
    for (let yy = Math.floor(y - r * 0.6); yy <= y + r * 0.6; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
      const d = Math.hypot((xx - x) / r, (yy - y) / (r * 0.6)) / fl;
      if (d < 1 && xx >= 0 && xx < w && yy >= 0 && yy < h) px.mix(xx, yy, col, d < 0.4 ? 0.22 : 0.1);
    }
  }
  // 모닥불: 땅을 데우는 빛 + 불꽃 + 불티
  const [cx, cy] = S.fire, flick = 0.85 + Math.sin(t * 13) * 0.08 + hash(Math.floor(t * 9)) * 0.1, fr = night ? 30 : 16;
  for (let y = cy - fr * 0.6; y <= cy + fr * 0.4; y++) for (let x = cx - fr; x <= cx + fr; x++) {
    const d = Math.hypot((x - cx) / fr, (y - cy) / (fr / 2)) / flick;
    if (d < 1) { const a = d < 0.35 ? 0.42 : d < 0.65 ? 0.26 : 0.12; if (y >= 0 && y < h && x >= 0 && x < w) px.mix(x, y, P.fire1, night ? a : a * 0.5); }
  }
  for (let k = 0; k < 14; k++) {
    const fx2 = cx - 3 + (k % 7), hgt = 3 + Math.floor(hash(k, Math.floor(t * 12)) * 6) - Math.abs(k % 7 - 3);
    for (let j = 0; j < hgt; j++) px.set(fx2, cy - 1 - j, j < hgt * 0.4 ? P.fire1 : j < hgt * 0.75 ? P.fire2 : P.fire3);
  }
  for (let k = 0; k < 8; k++) { const life = (t * 0.6 + k / 8) % 1; px.set(cx + Math.sin(k * 3 + t * 2) * 4 * life, cy - 6 - life * 26, life < 0.6 ? P.fire2 : P.fire0); }
  // 탐조등(3~9)
  for (const b of S.beams) { // 울타리 밖(왼쪽·오른쪽 들판)을 훑는다
    const ang = (b.ph ? 0.12 : Math.PI - 0.12) + Math.sin(t * 0.45 + b.ph) * 0.42, reach = w * 0.34;
    const tx = b.x + Math.cos(ang) * reach, ty = Math.max(HZ + 10, b.y + 8 + Math.sin(ang) * reach * 0.5), sp = 12;
    const len = Math.hypot(tx - b.x, ty - b.y) || 1, nx = -(ty - b.y) / len, ny = (tx - b.x) / len; // 빛줄기 폭은 방향에 수직으로
    px.poly([[b.x, b.y - 1], [tx + nx * 7, ty + ny * 4], [tx - nx * 7, ty - ny * 4]], P.light, 0.24);
    px.oval(tx, ty + 2, sp + 2, 6, P.light, 0.34);
    px.oval(tx, ty + 2, sp * 0.55, 3.5, P.light, 0.55);
    px.rect(b.x - 1, b.y - 1, 3, 2, P.white);
  }
  // 풍차 날개
  if (S.mill) {
    const { x, y, r } = S.mill, a0 = t * 1.1;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2, ex = x + Math.cos(a) * r, ey = y + Math.sin(a) * r, nx = -Math.sin(a), ny = Math.cos(a);
      px.line(x, y, ex, ey, S.Q.wood1);
      for (let s = 0.35; s <= 1; s += 0.08) { const bx = x + Math.cos(a) * r * s, by = y + Math.sin(a) * r * s; px.line(bx, by, bx + nx * 4, by + ny * 4, s > 0.9 ? S.Q.wood1 : S.Q.canvas1); }
    }
    px.disc(x, y, 1.6, S.Q.wood0);
  }
  // 빨래(펄럭)
  for (const [x, y, c] of S.cloth) { const f = Math.floor(t * 3 + x) % 2; px.rect(x - 1, y + 1, 3, 4 + f, c); px.set(x + (f ? 2 : -1), y + 4, c); }
  // 전구 줄(정문·장터)
  for (const [x, y, k, string] of S.bulbs) {
    const on = Math.sin(t * 3 + x * 0.7) > -0.6, c = string ? [X.lantern, X.bulbR, X.bulb][k % 3] : BULB_C[k % 4];
    if (string) px.set(x, y - 1, P.metal1);
    px.set(x, y, on ? c : lerpC(c, P.ink, 0.5));
    if (night && on) { px.mix(x - 1, y, c, 0.35); px.mix(x + 1, y, c, 0.35); px.mix(x, y + 1, c, 0.3); }
  }
  // 반딧불(6~9)
  for (const [ax, ay, sp] of S.fireflies) {
    const x = w * 0.04 + ax * w * 0.92 + Math.sin(t * sp + ax * 9) * 6, y = S.fire[1] - h * 0.18 + ay * h * 0.3 + Math.cos(t * sp * 1.3 + ay * 7) * 4;
    if (Math.sin(t * (2 + sp * 3) + ax * 20) > 0.2) { px.set(x, y, X.firefly); px.mix(x + 1, y, X.firefly, 0.4); }
  }
  // 좀비(2~5): 울타리 밖을 서성인다
  const step = Math.floor(t * 3) % 2;
  for (const z of S.zombies) {
    const f = (Math.sin(((t + z.off) / z.dur) * Math.PI * 2) + 1) / 2, gx = z.ax + (z.bx - z.ax) * f, gy = z.ay + (z.by - z.ay) * f;
    const [x, y] = I(gx, gy);
    if (y < HZ + 8) continue;
    px.oval(x, y, 3, 1.2, P.ink, 0.6);
    px.sprite(ZOMB[(step + Math.round(z.off)) % 2], x - 3, y - 12, S.zMap(z.shirt), Math.cos(((t + z.off) / z.dur) * Math.PI * 2) < 0);
  }
  // 닭(7부터)
  for (const [[x, y], k] of S.hens) { const peck = Math.floor(t * 2 + k * 1.7) % 3 === 0; px.sprite(HEN[peck ? 1 : 0], x + Math.sin(t * 0.5 + k) * 2, y - 4, S.henMap, k % 2 === 1); }
  // 사람들(두 장면을 번갈아), 10레벨은 모두 만세
  const idle = Math.floor(t * 2) % 2;
  for (const p of S.folk) {
    if (p.kind === 'bust') { px.sprite(['.hh.', 'hssh', 'jjjj', 'jjjj'], p.x, p.y, p.map); continue; }
    const jump = p.kind === 'cheer' ? (Math.floor(t * 3 + p.x * 0.3) % 2 ? 1 : 0) : 0;
    const y = p.y - (p.raw ? 0 : 11) - jump;
    px.oval(p.x + 3, p.y + (p.raw ? 11 : 0), 3, 1, P.ink, 0.5);
    px.sprite(p.kind === 'cheer' && jump ? CHEER : SURV[(idle + (p.lead ? 0 : Math.round(p.x))) % 2], p.x, y, p.map, !!p.flip);
  }
  // 아이들(6부터): 모닥불 둘레를 뛰어다니고, 공이 따라 튄다
  const [kx, ky] = S.yard;
  S.kids.forEach((k, i) => {
    const a = t * 1.6 + k.ph * Math.PI * 2, x = kx + Math.cos(a) * k.r, y = ky + Math.sin(a) * k.r * 0.42;
    const hop = Math.abs(Math.sin(t * 8 + i)) * 2;
    px.oval(x + 3, y, 2.5, 1, P.ink, 0.5);
    px.sprite(lv >= 10 && i % 2 === 0 ? KID_UP : KID[Math.floor(t * 6 + i) % 2], x, y - 8 - hop, k.map, Math.sin(a) > 0);
    if (i === 0) { const bx = x + Math.cos(a + 0.5) * 6, by = y - Math.abs(Math.sin(t * 5)) * 5; px.disc(bx, by, 1.2, S.Q.ball); }
  });
  // 개(5부터)
  if (S.dog) {
    const a = t * 0.9, [ox, oy] = S.kids.length ? S.yard : [cx, cy + 10], x = ox + Math.cos(a) * 24, y = oy + Math.sin(a) * 9;
    px.sprite(DOG[Math.floor(t * 8) % 2], x, y - 4, S.dog, Math.sin(a) > 0);
  }
  // 새(10): V자로 날아간다
  for (const [ax, ay, sp] of S.birds) {
    const x = ((ax * w + t * 9 * sp) % (w + 20)) - 10, y = h * 0.05 + ay * h * 0.1 + Math.sin(t * 2 + ax * 9) * 2, f = Math.floor(t * 5 + ax * 10) % 2;
    px.set(x, y, X.bird); px.set(x - 1, y - f, X.bird); px.set(x + 1, y - f, X.bird); px.set(x - 2, y - 1 + f, X.bird); px.set(x + 2, y - 1 + f, X.bird);
  }
  // 앞쪽 안개(2~5, 레벨이 오를수록 걷힌다)
  if (S.fog > 0) {
    const drift = Math.floor(t * 6);
    for (let y = Math.round(h * 0.55); y < h; y++) {
      const base = ((y - h * 0.55) / (h * 0.45)) * 0.42 * S.fog + Math.sin(y * 0.18 + t * 0.6) * 0.06;
      for (let x = 0; x < w; x++) { const a = base + Math.sin((x + t * 9) * 0.06 + y * 0.03) * 0.1; if (a > 0.04 && dith(x + drift, y, a)) px.mix(x, y, P.fog, 0.3); }
    }
  }
  // 꽃잎(10): 축하
  for (const [ax, ay, sp, k] of S.petals) {
    const x = ((ax * w + Math.sin(t * sp + ax * 7) * 10 + t * 4) % w + w) % w, y = (ay * h + t * 16 * sp) % h;
    px.set(x, y, [X.petalP, X.petalW, X.petalY][k]); if (Math.floor(t * 4 + ax * 9) % 2) px.set(x + 1, y, [X.petalP, X.petalW, X.petalY][k]);
  }
  if (night) for (const i of S.vig) px.u[i] = P.void;
  else for (const i of S.vig) px.u[i] = lerpC(px.u[i], P.void, 0.3);
  if (lv >= 10) drawEnding(px, S, t);
}

// 엔딩 글자: 시작 화면 로고와 같은 불씨 그라데이션
function drawEnding(px, S, t) {
  const { w, h } = S;
  const grad = [P.t0, P.t1, P.t1, P.t2, P.t2, P.t3, P.t4];
  const s1 = 'ENDING', sc = Math.max(2, Math.floor((w - 30) / (6 * 6))), tw = textW(s1, sc, sc);
  const y1 = Math.round(h * 0.075) + Math.round(Math.sin(t * 1.5) * 1); // 건너뛰기 버튼 아래
  text(px, s1, Math.round((w - tw) / 2), y1, sc, (j, k) => (hash(k, Math.floor(t * 3)) < 0.08 && j < 3 ? P.t0 : grad[Math.min(6, j)]), { line: P.tLine, depth: 2, depthC: P.tDepth });
  const s2 = 'A NEW DAWN', w2 = textW(s2, 1, 1);
  text(px, s2, Math.round((w - w2) / 2), y1 + 7 * sc + 8, 1, () => P.t0, { gap: 1, line: P.tLine });
}

// ---------- 화면 ----------
// 캔버스 하나에 그린다. stop()으로 멈춘다. 처음 0.6초는 디더링으로 나타난다.
export function runCutscene(canvas, lv) {
  const ctx = canvas.getContext('2d');
  let low = null, lowCtx = null, scene = null, frame = null, cell = 4, raf = 0;
  const t0 = performance.now(), REVEAL = 0.6;
  let seenW = -1, seenH = -1; // 마지막으로 맞춘 캔버스 CSS 크기(ResizeObserver가 같은 크기로 다시 부르면 건너뛴다)
  function resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    seenW = canvas.clientWidth; seenH = canvas.clientHeight;
    const cw = canvas.clientWidth || window.innerWidth || 360, ch = canvas.clientHeight || window.innerHeight || 640;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    // 가로 칸 수: 마을이 커질수록 카메라가 물러난다(2~4 150칸 · 5~7 172칸 · 8~10 196칸). 가로 화면은 세로 기준으로 맞춘다
    const across = lv >= 8 ? 196 : lv >= 5 ? 172 : 150;
    cell = Math.max(2, Math.round(Math.min(canvas.width / across, canvas.height / (across * 1.75))));
    const w = Math.ceil(canvas.width / cell), h = Math.ceil(canvas.height / cell);
    low = document.createElement('canvas'); low.width = w; low.height = h; lowCtx = low.getContext('2d');
    scene = build(w, h, lv);
    frame = new Px(w, h);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!scene || canvas.clientWidth === 0) return;
    const t = (now - t0) / 1000;
    draw(frame, scene, t + 2);
    if (t < REVEAL) { const a = t / REVEAL; for (let y = 0; y < scene.h; y++) for (let x = 0; x < scene.w; x++) if (!dith(x, y, a)) frame.u[y * scene.w + x] = P.void; }
    lowCtx.putImageData(frame.img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, scene.w * cell, scene.h * cell);
  }
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  // iOS Safari는 로딩 중 resize 이벤트를 보내지 않으므로(index.html·title.js와 같은 처리) 캔버스 크기 변화도 직접 받는다
  const ro = window.ResizeObserver ? new ResizeObserver(() => { if (canvas.clientWidth !== seenW || canvas.clientHeight !== seenH) resize(); }) : null;
  ro?.observe(canvas);
  resize();
  raf = requestAnimationFrame(loop);
  return { stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); ro?.disconnect(); } };
}
