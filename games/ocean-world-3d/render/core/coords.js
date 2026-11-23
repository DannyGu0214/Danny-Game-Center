// 격자 좌표(x, y 바닥면, z 높이, 칸 단위) ↔ Three.js 좌표(X 오른쪽, Y 위, Z 화면 앞쪽) 변환.
// 변환은 이 파일 한 곳에서만 한다(PLAN.md 4.3절).
// 격자 y = 0(기본 시점의 앞)이 Three +Z 쪽, 격자 x = 0이 Three −X 쪽이다. 회전만 있고 뒤집기는 없다.
// 1칸 = Three 1단위.

export function makeCoords(bounds) {
  const cx = (bounds.x0 + bounds.x1) / 2;
  const cy = (bounds.y0 + bounds.y1) / 2;
  return {
    bounds,
    center: { x: cx, y: cy },
    /** 격자 → Three. out은 {x,y,z}를 가진 객체(Vector3 포함). */
    toWorld(x, y, z, out) {
      out.x = x - cx; out.y = z; out.z = cy - y;
      return out;
    },
    /** Three → 격자. */
    toGrid(X, Y, Z, out) {
      out.x = X + cx; out.y = cy - Z; out.z = Y;
      return out;
    },
    /** 격자 방향각(x축에서 y축 쪽으로, 라디안) → Three Y축 회전각(+Z가 0인 Object3D 앞방향 기준). */
    yawToWorld(a) { return a + Math.PI / 2; },
    /** 블록의 Three 좌표 반폭 */
    half: { x: (bounds.x1 - bounds.x0) / 2, z: (bounds.y1 - bounds.y0) / 2 },
  };
}
