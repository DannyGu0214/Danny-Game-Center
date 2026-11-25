// P1 시제품 섬 조각: 40×40m = 2m 칸 20×20 (DESIGN 2-2절, 13-1절).
// 북쪽(z 작음)이 위예요. 들판(층1) + 북동쪽 언덕(층2) + 경사로 하나 + 남쪽 모래·물가 띠(층0).
import type { CellKind, MapDef, NodeSpawn, StationSpawn, TerrainGrid } from './types.ts';

/**
 * 글자 하나 = 칸 하나.
 * '~' 물(층0, 못 감) · '.' 모래(층0) · 'g' 들판(층1) · 'h' 언덕 땅(층2)
 * '#' 절벽(층2, 못 감) · '/' 경사로(층1↔층2를 이어요)
 */
export const P1_ROWS: readonly string[] = [
  'gggggggggggg#hhhhhhh', // z0
  'gggggggggggg#hhhhhhh',
  'gggggggggggg#hhhhhhh',
  'gggggggggggg#hhhhhhh',
  'gggggggggggg#hhhhhhh',
  'gggggggggggg#hhhhhhh',
  'gggggggggggg#hhhhhhh',
  'gggggggggggg###/####', // z7: 경사로 (15,7)
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
  'gggggggggggggggggggg',
  '....................', // z16 모래
  '....................',
  '~~~~~~~~~~~~~~~~~~~~', // z18 물
  '~~~~~~~~~~~~~~~~~~~~',
];

const LEGEND: Record<string, { kind: CellKind; level: number }> = {
  '~': { kind: 'water', level: 0 },
  '.': { kind: 'sand', level: 0 },
  g: { kind: 'ground', level: 1 },
  h: { kind: 'ground', level: 2 },
  '#': { kind: 'cliff', level: 2 },
  '/': { kind: 'ramp', level: 1 },
};

export function parseGrid(rows: readonly string[], cellSize = 2): TerrainGrid {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const kinds: CellKind[] = [];
  const levels: number[] = [];
  rows.forEach((row, z) => {
    if (row.length !== width) throw new Error(`지도 줄 길이가 달라요: z=${z}`);
    for (const ch of row) {
      const cell = LEGEND[ch];
      if (!cell) throw new Error(`모르는 지도 글자: '${ch}' (z=${z})`);
      kinds.push(cell.kind);
      levels.push(cell.level);
    }
  });
  return { cellSize, width, height, kinds, levels };
}

const at = (x: number, z: number) => ({ x, z });
const spawn = (id: string, kind: string, x: number, z: number): NodeSpawn => ({ id, kind, cell: at(x, z) });

/** 나무 8 · 바위 6(들판 4, 언덕 2) · 나뭇가지 자리 6 · 갈대 자리 5 */
export const P1_NODES: readonly NodeSpawn[] = [
  spawn('tree-01', 'tree', 1, 1), spawn('tree-02', 'tree', 3, 2), spawn('tree-03', 'tree', 1, 4),
  spawn('tree-04', 'tree', 4, 5), spawn('tree-05', 'tree', 2, 7), spawn('tree-06', 'tree', 6, 1),
  spawn('tree-07', 'tree', 7, 4), spawn('tree-08', 'tree', 5, 8),
  spawn('rock-01', 'rock', 10, 9), spawn('rock-02', 'rock', 13, 11), spawn('rock-03', 'rock', 9, 13),
  spawn('rock-04', 'rock', 16, 13), spawn('rock-05', 'rock', 15, 2), spawn('rock-06', 'rock', 18, 4),
  spawn('branch-01', 'branch-spot', 3, 9), spawn('branch-02', 'branch-spot', 6, 10),
  spawn('branch-03', 'branch-spot', 8, 6), spawn('branch-04', 'branch-spot', 2, 12),
  spawn('branch-05', 'branch-spot', 5, 14), spawn('branch-06', 'branch-spot', 10, 3),
  spawn('reed-01', 'reed-spot', 2, 17), spawn('reed-02', 'reed-spot', 6, 17), spawn('reed-03', 'reed-spot', 10, 17),
  spawn('reed-04', 'reed-spot', 14, 17), spawn('reed-05', 'reed-spot', 18, 17),
];

export const P1_SPOTS: readonly StationSpawn[] = [
  { id: 'workbench', cell: at(9, 11) },
  { id: 'shop', cell: at(12, 14) }, // 오소리 보리의 위탁상점(그레이박스에선 상자)
  { id: 'box-spot', cell: at(7, 12) }, // 위탁판매함을 만들면 여기 놓여요
  { id: 'bed', cell: at(11, 10) }, // 텐트. 잠자기
];

export const P1_MAP: MapDef = {
  grid: parseGrid(P1_ROWS),
  start: at(10, 12),
  nodes: [...P1_NODES],
  spots: [...P1_SPOTS],
};
