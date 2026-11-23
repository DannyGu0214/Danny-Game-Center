// 탭 판정(생태계 무관). DESIGN 2.3절: 생물·물건은 실제 모양이 아니라 단순한 구 하나로, 화면에서 최소 반지름을 키워 판정한다.
// 판정은 출렁이지 않은 원래 자리 기준이 아니라 지금 그려진 자리(블록 행렬을 거친 자리) 기준이다 — 출렁임이 작고 짧아서
// 화면에 보이는 곳을 누르는 쪽이 맞다고 봤다(P2 가안). 물·젤리 벽·다른 물건에 가린 것도 고른다(투명하니까).
import * as THREE from 'three';

const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
const _m = new THREE.Matrix4();

/**
 * 화면 점 둘레에 걸리는 후보를 가까운 순서로 돌려준다.
 * @param {object} o
 * @param {THREE.Camera} o.camera
 * @param {HTMLElement} o.dom 캔버스
 * @param {THREE.Matrix4} o.matrix 블록 좌표 → 월드(블록 그룹의 matrixWorld)
 * @param {{pos:THREE.Vector3, r:number}[]} o.items 블록 좌표의 중심과 반지름(Three 단위)
 * @param {number} o.x 화면 x(clientX)
 * @param {number} o.y 화면 y(clientY)
 * @param {number} [o.minPx=22] 화면 반지름 최소(터치는 28 권장)
 * @returns {{item:object, d:number, rad:number, depth:number}[]}
 */
export function screenPick(o) {
  const rect = o.dom.getBoundingClientRect(), minPx = o.minPx ?? 22;
  const cam = o.camera;
  cam.updateMatrixWorld();
  _r.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
  const out = [];
  for (const it of o.items) {
    _v.copy(it.pos).applyMatrix4(o.matrix);
    const depth = _v.distanceTo(cam.position);
    _o.copy(_v).addScaledVector(_r, it.r);
    _v.project(cam); _o.project(cam);
    if (_v.z > 1 || _v.z < -1) continue;              // 카메라 뒤·먼 면 밖
    const sx = rect.left + ((_v.x + 1) / 2) * rect.width, sy = rect.top + ((1 - _v.y) / 2) * rect.height;
    const ox = rect.left + ((_o.x + 1) / 2) * rect.width, oy = rect.top + ((1 - _o.y) / 2) * rect.height;
    const rad = Math.max(minPx, Math.hypot(ox - sx, oy - sy));
    const d = Math.hypot(o.x - sx, o.y - sy);
    if (d <= rad) out.push({ item: it, d, rad, depth });
  }
  out.sort((a, b) => a.d / a.rad - b.d / b.rad || a.depth - b.depth);
  return out;
}

/** 블록 좌표의 한 점 → 화면 좌표 { x, y, on(화면 안·카메라 앞) } */
export function toScreen(camera, dom, matrix, pos, out = {}) {
  const rect = dom.getBoundingClientRect();
  _v.copy(pos).applyMatrix4(matrix).project(camera);
  out.x = rect.left + ((_v.x + 1) / 2) * rect.width;
  out.y = rect.top + ((1 - _v.y) / 2) * rect.height;
  out.front = _v.z <= 1 && _v.z >= -1;
  out.on = out.front && _v.x >= -1 && _v.x <= 1 && _v.y >= -1 && _v.y <= 1;
  return out;
}

/** 화면 점 → 블록 좌표의 광선 { origin, dir } (블록 그룹 행렬의 역을 거침) */
export function blockRay(camera, dom, inverse, x, y) {
  const rect = dom.getBoundingClientRect();
  const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  const rc = new THREE.Raycaster();
  camera.updateMatrixWorld();
  rc.setFromCamera(ndc, camera);
  const origin = rc.ray.origin.clone().applyMatrix4(inverse);
  _m.copy(inverse);
  const dir = rc.ray.direction.clone().transformDirection(_m);
  return { origin, dir };
}

/**
 * 블록 좌표 광선이 높이 함수 지형에 처음 닿는 격자 점(없으면 null). 격자 ↔ Three 변환은 coords 한 곳.
 * 지형 메시(삼각형 수만 개)에 레이캐스트하지 않고 높이 함수를 따라 걸어간다.
 */
export function rayToGround(ray, coords, heightAt, { step = 0.2, maxT = 400 } = {}) {
  const b = coords.bounds, g = {};
  const at = (t) => { _d.copy(ray.dir).multiplyScalar(t).add(ray.origin); return coords.toGrid(_d.x, _d.y, _d.z, g); };
  let prev = null;
  for (let t = 0; t < maxT; t += step) {
    const p = at(t);
    const inside = p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
    if (inside) {
      const h = heightAt(p.x, p.y);
      if (p.z <= h) {
        // 직전 점과 사이를 몇 번 나눠 더 정확히
        let lo = prev ?? t - step, hi = t;
        for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2, q = at(m); if (q.z <= heightAt(q.x, q.y)) hi = m; else lo = m; }
        const q = at(hi);
        return { x: q.x, y: q.y, z: q.z };
      }
      prev = t;
    } else if (prev != null) return null;   // 블록을 지나쳐 나감
  }
  return null;
}

/** 블록 좌표 광선이 격자 높이 z인 수평면에 닿는 격자 점(없으면 null) */
export function rayToPlane(ray, coords, z) {
  const g = {};
  const o = coords.toGrid(ray.origin.x, ray.origin.y, ray.origin.z, {});
  if (Math.abs(ray.dir.y) < 1e-6) return null;
  const t = (z - o.z) / ray.dir.y;   // Three Y = 격자 z
  if (t < 0) return null;
  _d.copy(ray.dir).multiplyScalar(t).add(ray.origin);
  return coords.toGrid(_d.x, _d.y, _d.z, g);
}
