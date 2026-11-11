// 젤리 블록 출렁임: 블록 그룹의 행렬 하나에 감쇠 스프링 값(전단 2축 + 눌림 1축)을 넣는다.
// 밑면(bottomY)을 고정점으로, 위로 늘면 옆으로 줄어 부피가 1차 근사로 보존된다.
// 값(강성·감쇠·한계)은 직접 정한 가안이다.
import * as THREE from 'three';

export class JellyBlock {
  /**
   * @param {THREE.Object3D} group matrixAutoUpdate=false 인 블록 그룹
   * @param {{bottomY:number, height:number}} o 밑면 높이와 블록 높이(Three 단위)
   */
  constructor(group, o) {
    this.group = group;
    this.bottomY = o.bottomY;
    this.height = o.height;
    this.strength = 1;           // 0 = 끔, 1 = 기본, 2 = 두 배
    this.k = 70; this.kq = 95;   // 전단·눌림 강성(1/s²)
    this.c = 3.2; this.cq = 4.0; // 감쇠(1/s)
    // 상태: 전단 sx(Three X 방향), sz(Three Z 방향), 눌림 q
    this.s = { sx: 0, sz: 0, q: 0 };
    this.v = { sx: 0, sz: 0, q: 0 };
    this.t = { sx: 0, sz: 0, q: 0 };
    this.accel = new THREE.Vector3();   // 블록 윗면의 가속도(Three, 단위/s²). 물·생물에 넘김
    this._prevTopV = new THREE.Vector3();
    this.listeners = [];
    this.inverse = new THREE.Matrix4();
    this._apply();
  }

  /** 끌기 목표(전단). dx, dz는 Three 수평면 방향 단위의 작은 값(−1..1). */
  drag(dx, dz) {
    const lim = 0.16;
    this.t.sx = THREE.MathUtils.clamp(dx, -1, 1) * lim * this.strength;
    this.t.sz = THREE.MathUtils.clamp(dz, -1, 1) * lim * this.strength;
    this.t.q = -0.03 * this.strength;
  }
  release() { this.t.sx = 0; this.t.sz = 0; this.t.q = 0; }
  /** 순간 충격: 눌림 속도와 전단 속도에 더한다. */
  poke(q = -0.6, sx = 0, sz = 0) {
    this.v.q += q * this.strength;
    this.v.sx += sx * this.strength;
    this.v.sz += sz * this.strength;
  }
  setStrength(s) {
    this.strength = Math.max(0, s);
    if (this.strength === 0) { for (const k of ['sx', 'sz', 'q']) { this.s[k] = 0; this.v[k] = 0; this.t[k] = 0; } }
  }

  update(dt) {
    dt = Math.min(dt, 1 / 30);
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      for (const key of ['sx', 'sz', 'q']) {
        const k = key === 'q' ? this.kq : this.k, c = key === 'q' ? this.cq : this.c;
        this.v[key] += (-k * (this.s[key] - this.t[key]) - c * this.v[key]) * h;
        this.s[key] += this.v[key] * h;
      }
    }
    // 윗면 속도 = 전단 속도 × 높이. 가속도 = 변화량 / dt
    const topV = new THREE.Vector3(this.v.sx * this.height, this.v.q * this.height, this.v.sz * this.height);
    this.accel.copy(topV).sub(this._prevTopV).divideScalar(Math.max(dt, 1e-4));
    this._prevTopV.copy(topV);
    this._apply();
  }

  _apply() {
    const { sx, sz, q } = this.s;
    const b = this.bottomY;
    const side = 1 - q / 2, up = 1 + q;
    // x' = side·x + sx·(y−b),  y' = b + up·(y−b),  z' = side·z + sz·(y−b)
    const m = this.group.matrix;
    m.set(
      side, sx, 0, -sx * b,
      0, up, 0, b - up * b,
      0, sz, side, -sz * b,
      0, 0, 0, 1);
    this.group.matrixWorldNeedsUpdate = true;
    this.group.updateMatrixWorld(true);
    this.inverse.copy(this.group.matrixWorld).invert();
  }

  /** 현재 변형 정도(0이면 쉬는 중) */
  energy() {
    return Math.abs(this.s.sx) + Math.abs(this.s.sz) + Math.abs(this.s.q) +
      0.05 * (Math.abs(this.v.sx) + Math.abs(this.v.sz) + Math.abs(this.v.q));
  }
}
