// 입력 분기: 블록을 누르면 젤리 출렁임(끌기 = 기울이기, 탭 = 꾹 누르기), 빈 곳이면 카메라(OrbitControls).
// 젤리 행렬로 일그러진 블록도 three의 레이캐스트가 월드 행렬을 따라가므로 그대로 맞힌다.
// 짧은 탭(6px 안)은 먼저 onPick(e, 블록 점|null)에 묻고(생물·물건 고르기, 놓기 자리 — P2), true를 돌려주면 출렁이지 않는다.
// onPick은 젤리 끌기가 꺼져 있어도(enabled = false) 불린다.
import * as THREE from 'three';

export class BlockInput {
  /**
   * @param {object} o { dom, camera, rig, jelly, hitMesh, onTap(pointBlock), onDrag(pointBlock), onPick(event, pointBlock|null) → bool }
   *   hitMesh: 블록을 감싸는 보이지 않는 상자(world 그룹 안)
   */
  constructor(o) {
    Object.assign(this, o);
    this.enabled = true;        // false면 모든 끌기가 카메라
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.active = null;
    const dom = o.dom;
    dom.addEventListener('pointerdown', (e) => this._down(e), { capture: true });
    dom.addEventListener('pointermove', (e) => this._move(e), { capture: true });
    dom.addEventListener('pointerup', (e) => this._up(e), { capture: true });
    dom.addEventListener('pointercancel', (e) => this._up(e), { capture: true });
    this.pointers = new Set();
  }
  _hit(e) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(this.ndc, this.camera);
    const h = this.ray.intersectObject(this.hitMesh, false)[0];
    if (!h) return null;
    return h.point.clone().applyMatrix4(this.jelly.inverse); // 블록 좌표
  }
  _down(e) {
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1) this.tap = null;
    if (this.active && this.pointers.size > 1) { // 두 손가락이면 젤리를 놓고 카메라로
      this.jelly.release(); this.active = null; this.rig.controls.enabled = true; return;
    }
    if (e.button !== 0) return;
    const p = this._hit(e);
    if (this.pointers.size === 1) this.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, p };
    if (!this.enabled || this.jelly.strength <= 0 || e.shiftKey) return;
    if (!p) return;
    e.stopImmediatePropagation();
    this.dom.setPointerCapture?.(e.pointerId);
    this.rig.controls.enabled = false;
    this.active = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, p };
  }
  _move(e) {
    const tp = this.tap;
    if (tp && e.pointerId === tp.id) tp.moved = Math.max(tp.moved, Math.hypot(e.clientX - tp.x, e.clientY - tp.y));
    const a = this.active;
    if (!a || e.pointerId !== a.id) return;
    e.stopImmediatePropagation();
    const dx = e.clientX - a.x, dy = e.clientY - a.y;
    a.moved = Math.max(a.moved, Math.hypot(dx, dy));
    // 화면 이동 → 카메라 오른쪽·앞쪽을 수평면에 투영한 방향
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0); right.y = 0; right.normalize();
    const fwd = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1); fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.setFromMatrixColumn(this.camera.matrixWorld, 2).negate().setY(0);
    fwd.normalize();
    const s = 1 / 260;
    const v = right.multiplyScalar(dx * s).addScaledVector(fwd, -dy * s);
    this.jelly.drag(v.x, v.z);
    if (this.onDrag) { const p = this._hit(e); if (p) this.onDrag(p); }
  }
  _up(e) {
    this.pointers.delete(e.pointerId);
    const tp = this.tap;
    const isTap = !!tp && tp.id === e.pointerId && tp.moved < 6;
    if (tp && tp.id === e.pointerId) this.tap = null;
    const picked = isTap && this.onPick ? !!this.onPick(e, tp.p) : false;
    const a = this.active;
    if (!a || e.pointerId !== a.id) return;
    e.stopImmediatePropagation();
    this.active = null;
    this.rig.controls.enabled = true;
    if (a.moved < 6 && !picked) { this.jelly.poke(-0.7); if (this.onTap) this.onTap(a.p); }
    this.jelly.release();
  }
}
