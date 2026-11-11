// 앱 뼈대: 메인 루프(Timer), 갱신 훅, 녹화 모드(?capture)의 step(dt)·시점 전환·통계 내보내기.
import * as THREE from 'three';
import { globals } from './materials/shaderPatches.js';
import { installGLCounter, PerfOverlay } from './perf.js';

export class App {
  /**
   * @param {object} o { renderer, scene, camera, rig, world, jelly, capture, perf, extra }
   */
  constructor(o) {
    Object.assign(this, o);
    this.hooks = [];        // (dt, t) => void, 순서대로
    this.t = 0;
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.gl = installGLCounter(o.renderer.getContext());
    this.perfOverlay = o.perf ? new PerfOverlay(o.renderer, o.extra) : null;
    this._camBlock = new THREE.Vector3();
    this._last = performance.now();
    this.paused = false;
  }
  onUpdate(fn) { this.hooks.push(fn); }

  /** 한 프레임: 시뮬레이션 → 행렬·uniform → 그리기 */
  step(dt) {
    const w0 = performance.now();
    if (!this.paused) {
      this.t += dt;
      globals.uTime.value = this.t;
      this.jelly.update(dt);
      for (const h of this.hooks) h(dt, this.t);
    }
    this.rig.update(dt);
    this.camera.updateMatrixWorld();
    // 블록 좌표(젤리 변형을 되돌린 좌표)의 카메라 위치·역행렬
    globals.uBlockInv.value.copy(this.jelly.inverse);
    globals.uCamBlock.value.copy(this.camera.position).applyMatrix4(this.jelly.inverse);
    this.gl.begin();
    this.renderer.render(this.scene, this.camera);
    this.lastPasses = this.gl.end();
    return performance.now() - w0;
  }

  start() {
    if (this.capture) return; // 녹화 모드는 __cap.step으로만 진행
    const loop = (ts) => {
      requestAnimationFrame(loop);
      this.timer.update(ts);
      const dt = Math.min(this.timer.getDelta(), 1 / 20);
      const now = performance.now(), frameMs = now - this._last; this._last = now;
      const work = this.step(dt);
      if (this.perfOverlay) this.perfOverlay.frame(frameMs, work);
    };
    requestAnimationFrame(loop);
  }

  stats() {
    const i = this.renderer.info;
    return {
      calls: i.render.calls, triangles: i.render.triangles, points: i.render.points, lines: i.render.lines,
      programs: i.programs ? i.programs.length : null, geometries: i.memory.geometries, textures: i.memory.textures,
      glPasses: this.lastPasses, multiDraw: this.gl.hasMultiDraw,
      canvas: [this.renderer.domElement.width, this.renderer.domElement.height],
    };
  }

  /** 녹화 모드 핸들: window.__cap */
  installCapture(extra = {}) {
    const app = this;
    window.__cap = Object.assign({
      step(dt = 1 / 30, n = 1) { for (let k = 0; k < n; k++) app.step(dt); return app.t; },
      setView(name) { const ok = app.rig.setView(name, 0); app.step(0); return ok; },
      views() { return Object.keys(app.rig.presets); },
      dump() { return app.stats(); },
      snapshot(type = 'image/png', q = 0.9) { return app.renderer.domElement.toDataURL(type, q); },
      time() { return app.t; },
    }, extra);
    window.__cap.ready = true;
  }
}
