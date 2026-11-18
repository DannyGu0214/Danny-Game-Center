// 테스트·봇용 임시 환초 격자. 실제 지형(eco/atoll/terrain.js, 시제품 세션 담당)과 같은 약속(PLAN 4.3절)을 따른다.
// 구성은 DESIGN 2.1절(큰 섬 + 모래톱 + 산호 대지 + 석호 + 틸라 + 칸두, 가장자리 바깥 비탈)과 12절 면적 비율을 대략 따른다.
// y = 0이 블록 뒤쪽, y가 커질수록 앞쪽. 확장 영역은 앞쪽(+y) 40~59행.
export const GRID = { w: 40, h: 40 };
export const EXT = { side: '+y', depth: 20 };
export const SEA_LEVEL = 0;
export const MAX_DEPTH = 12;

const W = GRID.w, H = GRID.h + EXT.depth;
// 지형마다 바닥 높이(1/3칸 단위). 섬 +2칸, 해변 +1/3칸, 산호 대지 −5/3칸, 석호 −3칸, 틸라 −5칸, 칸두·바깥 비탈 −12칸
const BASE_H = { island: 6, beach: 1, reefflat: -5, lagoon: -9, thila: -15, kandu: -36, dropoff: -36 };

const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
function baseKind(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return 'void';
  if (x === 0 || x === W - 1 || y === 0 || y === H - 1) return 'dropoff';
  const px = x + 0.5, py = y + 0.5;
  // 본 블록
  const big = ell(px, py, 12.5, 10, 10.5, 7.2), bar = ell(px, py, 31, 7, 5.5, 3);
  const cay = ell(px, py, 10, 51, 4.2, 2.6); // 확장 영역의 작은 모래섬
  if (big < 0.45) return 'island';
  if (big < 1 || bar < 1) return 'beach';
  if (cay < 0.35) return 'island';
  if (cay < 1) return 'beach';
  if (big < 1.6 || bar < 2.2 || cay < 2.3) return 'reefflat';
  // 칸두: 블록 오른쪽 앞을 가로지르는 깊은 수로(확장 영역까지 이어짐)
  const kx = 27 + (py - 20) * 0.15;
  if (py > 19 && Math.abs(px - kx - 5) < 8) return 'kandu';
  // 틸라: 물속에 솟은 봉우리
  if (ell(px, py, 10, 30, 7.5, 6.5) < 1 || ell(px, py, 23, 21, 4.5, 4) < 1 || ell(px, py, 22, 52, 4, 3.5) < 1) return 'thila';
  // 바깥 산호 둑(가장자리 안쪽 띠)
  if (x <= 1 || x >= W - 2 || y <= 1) return 'reefflat';
  return 'lagoon';
}

const KIND = new Array(W * H), HGT = new Int16Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = baseKind(x, y); KIND[y * W + x] = k; HGT[y * W + x] = BASE_H[k] ?? 0; }
// 깊이가 크게 바뀌는 곳(칸두·틸라 가장자리)은 비탈 한 칸으로 잇는다
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const orig = KIND.slice(), origH = HGT.slice();
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  const i = y * W + x, k = orig[i];
  if (k !== 'kandu' && k !== 'thila') continue;
  let hi = -Infinity;
  for (const [dx, dy] of NB) { const j = (y + dy) * W + x + dx, kj = orig[j]; if (kj !== 'dropoff' && kj !== 'void' && kj !== k) hi = Math.max(hi, origH[j]); }
  if (hi - origH[i] > 6) { KIND[i] = 'slope'; HGT[i] = Math.round((origH[i] + hi) / 2); }
}

const inGrid = (cx, cy) => Number.isInteger(cx) && Number.isInteger(cy) && cx >= 0 && cy >= 0 && cx < W && cy < H;
export function kindAt(cx, cy) { return inGrid(cx, cy) ? KIND[cy * W + cx] : 'void'; }
export function cellHeight(cx, cy) { return inGrid(cx, cy) ? HGT[cy * W + cx] : 0; }
// 화면용 연속 높이(여기서는 칸 높이를 겹선형으로 보간한 단순한 값)
export function heightAt(x, y) {
  const fx = Math.floor(x - 0.5), fy = Math.floor(y - 0.5), tx = x - 0.5 - fx, ty = y - 0.5 - fy;
  const h = (cx, cy) => cellHeight(Math.max(0, Math.min(W - 1, cx)), Math.max(0, Math.min(H - 1, cy))) / 3;
  return (h(fx, fy) * (1 - tx) + h(fx + 1, fy) * tx) * (1 - ty) + (h(fx, fy + 1) * (1 - tx) + h(fx + 1, fy + 1) * tx) * ty;
}
