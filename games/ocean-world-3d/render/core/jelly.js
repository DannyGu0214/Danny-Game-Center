// 젤리 블록 출렁임: 블록 그룹의 행렬 하나에 감쇠 스프링 값(전단 2축 + 눌림 1축)을 넣는다.
// 밑면(bottomY)을 고정점으로, 위로 늘면 옆으로 줄어 부피가 1차 근사로 보존된다.
// 경계(DESIGN 4.3절): 진폭 상한 ≤ 블록 크기의 3%, 감쇠 ≤ 1초, 0.2초 안 연타 무시, 잠금/가드 중 출렁임 없음.
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
    this.strength = 1;           // 0 = 끔, 0.45 = 약하게, 1 = 보통
    this.k = 85; this.kq = 110;  // 전단·눌림 강성(1/s²): ~1.5Hz
    this.c = 4.8; this.cq = 5.6; // 감쇠(1/s): 0.8~1초 안에 가라앉음
    this.maxAmp = 0.03;          // 진폭 상한(블록 높이·크기의 3%)
    this.cooldown = 0.2;         // 연타 무시 간격(초)
    // 상태: 전단 sx(Three X 방향), sz(Three Z 방향), 눌림 q
    this.s = { sx: 0, sz: 0, q: 0 };
    this.v = { sx: 0, sz: 0, q: 0 };
    this.t = { sx: 0, sz: 0, q: 0 };
    this.accel = new THREE.Vector3();   // 블록 윗면의 가속도(Three, 단위/s²). 물·생물에 넘김
    this._prevTopV = new THREE.Vector3();
    this._topV = new THREE.Vector3();
    this._time = 0;
    this._frame = 0;
    this._lastPokeTime = -1;
    this._lastPokeFrame = -1;
    this._locked = false;
    this._guard = null;
    this.listeners = [];
    this.inverse = new THREE.Matrix4();
    this._apply();
  }

  get time() { return this._time; }
  get frame() { return this._frame; }
  justPoked() { return this._lastPokeFrame === this._frame; }
  setLocked(on) {
    this._locked = !!on;
    if (this._locked) this.release();
  }
  setGuard(fn) { this._guard = typeof fn === 'function' ? fn : null; }
  _canWobble() { return this.strength > 0 && !this._locked && (!this._guard || this._guard()); }

  /** 갱신 고리 구독(jelly.update 뒤 같은 프레임에 호출, 녹화 모드 step과도 맞음). */
  onUpdate(fn) {
    this.listeners.push(fn);
    return () => { const i = this.listeners.indexOf(fn); if (i >= 0) this.listeners.splice(i, 1); };
  }

  _capState() {
    const cap = this.maxAmp * Math.min(this.strength, 1);
    if (cap <= 0) {
      for (const k of ['sx', 'sz', 'q']) { this.s[k] = 0; this.v[k] = 0; this.t[k] = 0; }
      return;
    }
    // 위상 공간 타원 상한: 초기 속도에서 감쇠 최대 진폭이 cap(3%)을 넘지 않게 묶는다
    const vqCap = cap * 15.6;
    const vsCap = cap * 13.8;
    const eq = Math.hypot(this.s.q / cap, this.v.q / vqCap);
    if (eq > 1) { this.s.q /= eq; this.v.q /= eq; }
    const sMag = Math.hypot(this.s.sx, this.s.sz);
    const vMag = Math.hypot(this.v.sx, this.v.sz);
    const es = Math.hypot(sMag / cap, vMag / vsCap);
    if (es > 1) {
      this.s.sx /= es; this.s.sz /= es;
      this.v.sx /= es; this.v.sz /= es;
    }
  }

  /** 끌기 목표(전단). dx, dz는 Three 수평면 방향 단위의 작은 값(−1..1). */
  drag(dx, dz) {
    if (!this._canWobble()) { this.release(); return; }
    const lim = this.maxAmp * Math.min(this.strength, 1);
    const mag = Math.hypot(dx, dz);
    const k = mag > 1 ? 1 / mag : 1;
    this.t.sx = dx * k * lim;
    this.t.sz = dz * k * lim;
    this.t.q = -0.5 * lim;
  }
  release() { this.t.sx = 0; this.t.sz = 0; this.t.q = 0; }

  /** 즉시 멈춤(놓기 모드 시작·끄기 설정 때). */
  stop() {
    for (const k of ['sx', 'sz', 'q']) { this.s[k] = 0; this.v[k] = 0; this.t[k] = 0; }
    this.accel.set(0, 0, 0);
    this._prevTopV.set(0, 0, 0);
    this._apply();
  }

  /** 순간 충격: 눌림 속도와 전단 속도에 더한다. 연타·잠금·3% 상한을 지킨다. */
  poke(q = -0.6, sx = 0, sz = 0, opts = {}) {
    // opts.force: 연타 간격만 건너뛴다(티어 상승처럼 연타가 아닌 사건). 잠금·가드(놓기 모드·카메라 회전)는 늘 지킨다
    if (!this._canWobble()) return false;
    if (!opts.force && (this._time - this._lastPokeTime < this.cooldown)) return false;
    this._lastPokeTime = this._time;
    this._lastPokeFrame = this._frame;
    const sc = Math.min(this.strength, 1);
    this.v.q += q * sc;
    this.v.sx += sx * sc;
    this.v.sz += sz * sc;
    this._capState();
    return true;
  }

  /** 같은 탭 프레임에서 전단 방향만 더한다(BlockInput.poke 직후 tapBlock에서 사용). */
  nudge(sx = 0, sz = 0) {
    if (!this._canWobble()) return false;
    const sc = Math.min(this.strength, 1);
    this.v.sx += sx * sc;
    this.v.sz += sz * sc;
    this._capState();
    return true;
  }

  setStrength(s) {
    this.strength = Math.max(0, Number.isFinite(s) ? s : 0);
    if (this.strength === 0) this.stop();
    else this._capState();
  }

  update(dt) {
    dt = Math.min(Math.max(0, dt), 1 / 30);
    this._frame++;
    this._time += dt;
    if (this.strength > 0 && dt > 0) {
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        for (const key of ['sx', 'sz', 'q']) {
          const k = key === 'q' ? this.kq : this.k, c = key === 'q' ? this.cq : this.c;
          this.v[key] += (-k * (this.s[key] - this.t[key]) - c * this.v[key]) * h;
          this.s[key] += this.v[key] * h;
        }
      }
      // 잠금·가드 중(놓기 모드·카메라 회전): 끌기 목표를 풀고 남은 출렁임을 빠르게(약 0.15초) 가라앉힌다. 갑자기 멈춰 튀지 않게
      if (!this._canWobble()) {
        this.release();
        const f = Math.exp(-dt * 22);
        for (const key of ['sx', 'sz', 'q']) {
          this.s[key] *= f; this.v[key] *= f;
          if (Math.abs(this.s[key]) < 1e-5 && Math.abs(this.v[key]) < 1e-4) { this.s[key] = 0; this.v[key] = 0; }
        }
      }
      const cap = this.maxAmp * Math.min(this.strength, 1);
      this.s.q = THREE.MathUtils.clamp(this.s.q, -cap, cap);
      const sMag = Math.hypot(this.s.sx, this.s.sz);
      if (sMag > cap && sMag > 1e-8) { this.s.sx *= cap / sMag; this.s.sz *= cap / sMag; }
      const topV = this._topV.set(this.v.sx * this.height, this.v.q * this.height, this.v.sz * this.height);
      this.accel.copy(topV).sub(this._prevTopV).divideScalar(Math.max(dt, 1e-4));
      this._prevTopV.copy(topV);
    } else if (this.strength <= 0) {
      this.accel.set(0, 0, 0);
      this._prevTopV.set(0, 0, 0);
    }
    this._apply();
    for (const fn of this.listeners) fn(dt, this._time, this._frame);
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
