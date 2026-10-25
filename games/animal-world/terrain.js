// 지형: 지역마다 정해진 20×20 지도. 칸마다 지형 종류가 있고, 높이·이동·놓을 수 있는 물건이 지형으로 정해진다.
// 지도 글자: . 평지 · h 낮은 언덕(구릉) · H 높은 언덕 · ^ 봉우리 · l 저지대 · = 길 · ~ 물(바다·호수)
// 화면에서 (0,0)이 맨 뒤 꼭짓점, x는 오른쪽 아래, y는 왼쪽 아래로 늘어난다. 키 큰 지형은 뒤쪽에 둔다.
import { GRID, ITEMS } from './data.js';

export const LEVEL = 9; // 높이 한 단계(그림 단위, 칸 한 변은 32)
export const TERRAIN = {
  flat: { name: '평지', h: 0, walk: true },
  hill: { name: '낮은 언덕', h: 1, walk: true },
  high: { name: '높은 언덕', h: 2, walk: true },
  peak: { name: '봉우리', h: 3, walk: false },
  low: { name: '저지대', h: -1, walk: true },
  path: { name: '길', h: 0, walk: true },
  water: { name: '물', h: -1, walk: false, swim: true },
};
const CH = { '.': 'flat', h: 'hill', H: 'high', '^': 'peak', l: 'low', '=': 'path', '~': 'water' };

export const MAPS = {
  // 초원: 뒤쪽 꼭짓점에 봉우리와 높은 언덕, 오른쪽에 바위 구릉, 왼쪽 앞에 구릉, 가운데·오른쪽 앞에 마른 저지대, 가로지르는 흙길
  grassland: [
    '^^HHHhh.............',
    '^HHHHhh.............',
    'HHHHhh..............',
    'HHhhh...........hh..',
    'hhh............hhhh.',
    'hh.............hHHh.',
    '.......llll....hhhh.',
    '.......llll.....hh..',
    '.......llll.........',
    '==.....llll.........',
    '.===................',
    '...====.............',
    '......====....lll...',
    '.hh......===..lll...',
    'hhhh.......==.lll...',
    'hhhh........====....',
    '.hh............===..',
    '.................===',
    '....................',
    '....................',
  ],
  // 바닷가: 오른쪽 뒤가 바다(바위섬 봉우리), 바닷가를 따라 모래 저지대, 왼쪽 뒤 모래 언덕, 오른쪽 바위 곶(등대 자리), 나무 데크길
  seaside: [
    'hh~~~~~~~~~~~~~~^~~~',
    'hh~~~~~~~~~~~~~~~~~~',
    'Hhll~~~~~~~~~~~~~~~~',
    'HHhll~~~~~~~~~~~~~HH',
    'HHhlllll~~~~~~~llhH^',
    'Hhh..lllll~~~lllhhHH',
    'hh.....llllllll...hh',
    'hh...........ll.....',
    'h...................',
    '......==============',
    '......=.............',
    'hh....=.............',
    'hhh...=.......lll...',
    'hHh...=.......lll...',
    'hhh...=.......lll...',
    'hh....=.............',
    '......=.............',
    '......=.............',
    '......=.............',
    '......=.............',
  ],
  // 사막: 뒤쪽 꼭짓점에 메사 봉우리와 높은 모래 언덕, 가운데 오아시스 저지대를 돌길이 한 바퀴 두른다
  desert: [
    '^^^HHh......hhh.....',
    '^^HHHh.....hhHhh....',
    '^HHHh.......hhhh....',
    'HHHh.........hh.....',
    'hhh.................',
    'h.......====........',
    '......===..===......',
    '.....==......===....',
    '....==...llll..==...',
    'hh.==....llll...==..',
    'hhh=.....llll....=..',
    'hh.=.....llll....=..',
    'h..=.............=hh',
    '...=......hh.....=hH',
    '...==....hHHh....=hh',
    'll..==...hhhh...==..',
    'll...===..hh..===...',
    '.......========.....',
    '....................',
    '....................',
  ],
  // 남극: 왼쪽 뒤가 바다, 바닷가에 얼음 저지대, 오른쪽 뒤에 빙하 언덕과 얼음 봉우리, 가운데 저지대(얼음구멍 자리)를 눈길이 두른다
  antarctic: [
    '~~~~~......hHH^^HHh.',
    '~~~~~......hHHH^HHh.',
    '~~~~ll......hhHHHhh.',
    '~~~~ll.......hhhhh..',
    '~~~~l...............',
    '~~~~l.....====......',
    '~~~~l....==..==.....',
    '~~~~ll..==....==....',
    '~~~~ll..=......==...',
    '~~~~l...=.......=...',
    '~~~~~...=..lll..=...',
    '~~~~~...=..lll..=...',
    '~~~~~...=..lll..=...',
    '~~~~~...==.....==...',
    '~~~~l....==...==..hh',
    '~~~~ll....=====..hhh',
    '~~~~ll.........hhhh.',
    '~~~~l.........hhhh..',
    '~~~~~..........hh...',
    '~~~~~...............',
  ],
};

const grids = {};
// 지역 지도를 칸 배열(지형 이름)로. 지도가 없는 지역은 모두 평지
export function terrainOf(rid) {
  if (grids[rid]) return grids[rid];
  const rows = MAPS[rid], g = new Array(GRID * GRID).fill('flat');
  if (rows) for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) g[y * GRID + x] = CH[rows[y]?.[x]] ?? 'flat';
  return (grids[rid] = g);
}
const inGrid = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
export const kindAt = (rid, x, y) => (inGrid(x, y) ? terrainOf(rid)[y * GRID + x] : null);
export const heightAt = (rid, x, y) => TERRAIN[kindAt(rid, x, y) ?? 'flat'].h;
export const hasWater = (rid) => terrainOf(rid).includes('water');

// 물건을 놓을 수 있는 지형(앞에 있을수록 먼저 권하는 자리)
// 은신처·먹이·물그릇 → 낮은 언덕·평지 / 놀이·관람 → 높은 언덕·평지 / 물 자연물 → 저지대 / 헤엄치는 물 → 물·저지대 / 걷는 바닥 → 평지·저지대
const WATER_BODY = new Set(['puddle', 'pond', 'oasis', 'bigoasis', 'icehole']);
const ON_WATER = new Set(['buoy']);
export function allowedOn(id) {
  const d = ITEMS[id];
  if (!d) return [];
  if (ON_WATER.has(id)) return ['water'];
  if (d.swim) return ['water', 'low'];
  if (WATER_BODY.has(id)) return ['low'];
  if (d.walk) return ['flat', 'low'];
  if (!Object.keys(d.give).length) return ['high', 'flat'];
  return ['hill', 'flat'];
}
// 물건 하나가 덮는 칸이 모두 허용 지형이고 높이가 같은가
export function terrainFits(rid, id, x, y) {
  const d = ITEMS[id], ok = allowedOn(id);
  let h = null;
  for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) {
    const k = kindAt(rid, xx, yy);
    if (!k || !ok.includes(k)) return false;
    if (h === null) h = TERRAIN[k].h; else if (TERRAIN[k].h !== h) return false;
  }
  return true;
}
