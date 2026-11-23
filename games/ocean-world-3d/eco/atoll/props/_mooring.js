// 수중 물건이 함께 쓰는 계류 조각(닻 덩이·밧줄). 계류 부표·산호 묘목 줄·플랑크톤 등이 쓴다.
import { lp, merge, tube } from './_kit.js';

/** 바닥에 놓는 콘크리트 닻 덩이 + 고리 */
export function anchorBlock(THREE) {
  const C = (c) => new THREE.Color(c);
  const b = new THREE.CylinderGeometry(0.28, 0.34, 0.24, 6); b.translate(0, 0.1, 0);
  const ring = new THREE.TorusGeometry(0.08, 0.025, 4, 6); ring.translate(0, 0.28, 0);
  return merge(THREE, [lp(THREE, b, (c, n) => (n.y > 0.5 ? C(0x9a968c) : C(0x76726a))), lp(THREE, ring, C(0x5a5650))]);
}

/** 높이 0..1 밧줄(배치 때 세로로 늘림). 두 가닥을 꼰 느낌으로 마디마다 색을 바꿈 */
export function rope(THREE) {
  const C = (c) => new THREE.Color(c);
  const parts = [];
  const N = 6;
  for (let k = 0; k < N; k++) {
    const g = tube(THREE, new THREE.Vector3(0, k / N, 0), new THREE.Vector3(0, (k + 1) / N, 0), 0.03, 0.03, 4, 1, true);
    parts.push(lp(THREE, g, k % 2 ? C(0xe8dcc0) : C(0xc8b890)));
  }
  return merge(THREE, parts);
}
