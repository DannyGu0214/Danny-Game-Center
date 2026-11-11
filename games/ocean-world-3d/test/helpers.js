// 테스트 공용: 임시 환초 격자로 만든 규칙 묶음과 상태 도우미
import { createSim } from '../sim/rules.js';
import { makeEco } from '../eco/atoll/data.js';
import * as FIX from './fixtures/atoll-grid.js';

export const eco = makeEco(FIX);
export const G = createSim(eco);
export const fixture = FIX;
export const rich = (seed = 7, pop = 1e7) => { const S = G.newGame(seed, 0); S.pop = pop; return S; };
export const setTier = (S, t) => { S.tier = t; S.rev++; };
export const place = (S, id, opt) => { const at = G.freeSpot(S, id, opt); if (!at) return { ok: false, why: '자리 없음' }; return G.placeItem(S, id, at.x, at.y, at.layer); };
export const run = (S, sec) => { for (let i = 0, n = Math.round(sec * 30); i < n; i++) G.tick(S); };
// 칸 찾기: 조건에 맞는 첫 칸 [x, y]
export function findCell(fn, sp = G.space) {
  for (let i = 0; i < sp.N; i++) if (sp.area[i] && fn(i)) return [sp.cx(i), sp.cy(i), i];
  return null;
}
