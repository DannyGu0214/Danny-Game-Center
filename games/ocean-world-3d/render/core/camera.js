// 궤도 카메라: 위에서 내려다보기 ↔ 옆에서 물속 보기를 연속으로. 카메라는 늘 블록 밖에 있다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} dom
   * @param {{box: THREE.Box3, target: THREE.Vector3, presets: object}} o
   *   box: 카메라가 들어가면 안 되는 상자(블록 + 여유), Three 좌표
   */
  constructor(camera, dom, o) {
    this.camera = camera;
    this.box = o.box.clone();
    this.home = o.target.clone();
    this.presets = o.presets;
    const c = new OrbitControls(camera, dom);
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.rotateSpeed = 0.7;
    c.zoomSpeed = 0.9;
    c.zoomToCursor = true;
    c.screenSpacePanning = true;
    c.minDistance = 6;
    c.maxDistance = 240;
    c.minPolarAngle = THREE.MathUtils.degToRad(1);   // 거의 바로 위
    c.maxPolarAngle = THREE.MathUtils.degToRad(93);  // 수평보다 조금 아래(옆에서 물속 보기)
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.target.copy(this.home);
    this.controls = c;
    this.tween = null;
    this.current = 'default';
    this._dir = new THREE.Vector3();
    this.orbit = null;   // 타이틀 같은 자동 궤도: { polar, az, radius, target, speed(rad/s) }
  }

  /** 프리셋을 기준으로 블록 둘레를 천천히 돈다. 도는 동안 사용자 조작은 잠근다. */
  startOrbit(name) {
    const p = this.presets[name];
    if (!p) return false;
    this.setView(name, 0);
    this.current = name;
    this.orbit = { polar: THREE.MathUtils.degToRad(p.polar), az: THREE.MathUtils.degToRad(p.azimuth),
      radius: typeof p.distance === 'function' ? p.distance(this.camera) : p.distance,
      target: new THREE.Vector3(...(p.target || this.home.toArray())), speed: THREE.MathUtils.degToRad(p.orbitSpeed ?? 6) };
    this.controls.enabled = false;
    return true;
  }
  /** 자동 궤도를 멈추고 조작을 푼다(다음 시점으로 옮기는 것은 setView로). */
  stopOrbit() { this.orbit = null; this.controls.enabled = true; }

  /** 시점 프리셋으로 옮긴다. dur 0이면 즉시. */
  setView(name, dur = 0.9) {
    const p = this.presets[name];
    if (!p) return false;
    this.current = name;
    const target = new THREE.Vector3(...(p.target || this.home.toArray()));
    const polar = THREE.MathUtils.degToRad(p.polar), az = THREE.MathUtils.degToRad(p.azimuth);
    const radius = typeof p.distance === 'function' ? p.distance(this.camera) : p.distance;
    const toPos = new THREE.Vector3().setFromSphericalCoords(radius, polar, az).add(target);
    if (dur <= 0) {
      this.tween = null;
      this.controls.target.copy(target);
      this.camera.position.copy(toPos);
      this.controls.update();
      this._keepOutside();
      return true;
    }
    const s0 = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    // 방위각은 가까운 쪽으로 돈다
    let dAz = az - s0.theta; dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    this.tween = { t: 0, dur, from: { target: this.controls.target.clone(), r: s0.radius, polar: s0.phi, az: s0.theta },
      to: { target, r: radius, polar, az: s0.theta + dAz } };
    return true;
  }

  update(dt) {
    if (this.orbit) {
      const o = this.orbit;
      o.az += o.speed * dt;
      this.controls.target.copy(o.target);
      this.camera.position.setFromSphericalCoords(o.radius, o.polar, o.az).add(o.target);
      this.camera.lookAt(o.target);
      this._keepOutside();
      return;
    }
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = ease(tw.t);
      const tg = tw.from.target.clone().lerp(tw.to.target, e);
      const r = THREE.MathUtils.lerp(tw.from.r, tw.to.r, e);
      const ph = THREE.MathUtils.lerp(tw.from.polar, tw.to.polar, e);
      const th = THREE.MathUtils.lerp(tw.from.az, tw.to.az, e);
      this.controls.target.copy(tg);
      this.camera.position.setFromSphericalCoords(r, ph, th).add(tg);
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update(dt);
    // 옮겨 보기는 블록 범위 안으로
    const b = this.box;
    this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x, b.min.x + 2, b.max.x - 2);
    this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z, b.min.z + 2, b.max.z - 2);
    this.controls.target.y = THREE.MathUtils.clamp(this.controls.target.y, b.min.y + 2, b.max.y);
    this._keepOutside();
  }

  /** 카메라가 상자 안이면 목표점에서 카메라 쪽으로 상자를 벗어나는 곳까지 민다. */
  _keepOutside() {
    const cam = this.camera.position, tg = this.controls.target, b = this.box;
    if (!b.containsPoint(cam)) return;
    const d = this._dir.copy(cam).sub(tg);
    const len = d.length();
    if (len < 1e-6) d.set(0, 1, 0); else d.divideScalar(len);
    // 목표점(상자 안)에서 d 방향으로 상자를 나가는 t
    let tExit = Infinity;
    for (const ax of ['x', 'y', 'z']) {
      if (Math.abs(d[ax]) < 1e-6) continue;
      const t = ((d[ax] > 0 ? b.max[ax] : b.min[ax]) - tg[ax]) / d[ax];
      if (t > 0) tExit = Math.min(tExit, t);
    }
    if (Number.isFinite(tExit)) cam.copy(tg).addScaledVector(d, tExit + 0.01);
  }

  get polarDeg() { return THREE.MathUtils.radToDeg(this.controls.getPolarAngle()); }
}
