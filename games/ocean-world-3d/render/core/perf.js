// 성능 표시(?perf=1)와 GL 드로우 호출 계수기.
// - renderer.info: three가 센 프레임당 드로우콜·삼각형(그림자·투과 패스 포함)
// - GL 계수기: WebGL 함수 자체를 감싸 프레임버퍼(패스)별로 센다. multiDraw(BatchedMesh)는 GL 호출 1회로 센다.

export function installGLCounter(gl) {
  const st = { frame: {}, cur: null, fbIds: new Map(), last: null };
  const passOf = () => st.cur;
  const bump = (kind) => {
    const p = passOf();
    const key = p === null ? 'screen' : 'fb' + (st.fbIds.get(p) ?? '?');
    st.frame[key] = (st.frame[key] || 0) + 1;
    st.frame._total = (st.frame._total || 0) + 1;
    if (kind) st.frame['_' + kind] = (st.frame['_' + kind] || 0) + 1;
  };
  const origBind = gl.bindFramebuffer.bind(gl);
  gl.bindFramebuffer = (target, fb) => {
    if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) {
      st.cur = fb || null;
      if (fb && !st.fbIds.has(fb)) st.fbIds.set(fb, st.fbIds.size + 1);
    }
    return origBind(target, fb);
  };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const f = gl[name].bind(gl);
    gl[name] = (...a) => { bump(name.includes('Instanced') ? 'instanced' : null); return f(...a); };
  }
  const ext = gl.getExtension('WEBGL_multi_draw');
  if (ext) {
    for (const name of ['multiDrawArraysWEBGL', 'multiDrawElementsWEBGL', 'multiDrawArraysInstancedWEBGL', 'multiDrawElementsInstancedWEBGL']) {
      if (!ext[name]) continue;
      const f = ext[name].bind(ext);
      ext[name] = (...a) => { bump('multiDraw'); return f(...a); };
    }
  }
  st.hasMultiDraw = !!ext;
  return {
    begin() { st.frame = {}; },
    end() { st.last = Object.assign({}, st.frame); return st.last; },
    get last() { return st.last; },
    hasMultiDraw: st.hasMultiDraw,
  };
}

function gpuName(gl) {
  try {
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch { return '?'; }
}

/** 화면 왼쪽 위 성능 표시 + 측정 단추 */
export class PerfOverlay {
  constructor(renderer, getExtra) {
    this.r = renderer; this.getExtra = getExtra || (() => ({}));
    this.times = []; this.rec = null;
    const el = document.createElement('div');
    el.id = 'perf';
    el.innerHTML = `<div class="perf-lines"></div>
      <div class="perf-btns"><button data-s="10">10초 측정</button><button data-s="30">30초 측정</button><button class="perf-copy" disabled>결과 복사</button></div>
      <pre class="perf-out"></pre>`;
    document.body.appendChild(el);
    this.el = el; this.lines = el.querySelector('.perf-lines'); this.out = el.querySelector('.perf-out');
    this.copyBtn = el.querySelector('.perf-copy');
    el.querySelectorAll('button[data-s]').forEach((b) => b.addEventListener('click', () => this.start(+b.dataset.s)));
    this.copyBtn.addEventListener('click', () => this.copy());
    this.gpu = gpuName(renderer.getContext());
    this._acc = 0; this._n = 0; this._lastShow = 0;
  }
  /** 프레임마다: dtMs = 프레임 사이 시간, workMs = 이 프레임의 JS 작업 시간 */
  frame(dtMs, workMs) {
    const info = this.r.info.render;
    this.times.push(dtMs); if (this.times.length > 120) this.times.shift();
    if (this.rec) {
      this.rec.dt.push(dtMs); this.rec.work.push(workMs);
      this.rec.calls.push(info.calls); this.rec.tris.push(info.triangles);
      if (performance.now() - this.rec.t0 > this.rec.sec * 1000) this.finish();
    }
    const now = performance.now();
    if (now - this._lastShow > 250) {
      this._lastShow = now;
      const avg = this.times.reduce((a, b) => a + b, 0) / this.times.length;
      const ex = this.getExtra();
      this.lines.textContent =
        `${(1000 / avg).toFixed(1)} fps · ${avg.toFixed(1)} ms (JS ${workMs.toFixed(1)} ms)\n` +
        `드로우콜 ${info.calls} · 삼각형 ${(info.triangles / 1000).toFixed(1)}k · 점 ${info.points}\n` +
        `물 ${ex.water || '?'} · 생물 ${ex.creatures ?? '?'} · ${this.r.domElement.width}×${this.r.domElement.height}` +
        (this.rec ? `\n측정 중… ${((now - this.rec.t0) / 1000).toFixed(0)}/${this.rec.sec}초` : '');
    }
  }
  start(sec) { this.rec = { sec, t0: performance.now(), dt: [], work: [], calls: [], tris: [] }; this.out.textContent = ''; this.copyBtn.disabled = true; }
  finish() {
    const r = this.rec; this.rec = null;
    const s = [...r.dt].sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    const ex = this.getExtra();
    this.result = [
      `Ocean World 3D P1 측정 (${new Date().toISOString().slice(0, 19)})`,
      `주소: ${location.search || '(기본)'}`,
      `GPU: ${this.gpu}`,
      `캔버스: ${this.r.domElement.width}×${this.r.domElement.height} (DPR ${this.r.getPixelRatio()})`,
      `물: ${ex.water} · 생물 ${ex.creatures} · 시점 ${ex.view}`,
      `측정: ${r.sec}초, ${r.dt.length}프레임`,
      `평균 fps: ${(1000 / avg(r.dt)).toFixed(1)}`,
      `프레임 시간 ms: 평균 ${avg(r.dt).toFixed(2)} · 중앙 ${q(0.5).toFixed(2)} · 95% ${q(0.95).toFixed(2)} · 99% ${q(0.99).toFixed(2)} · 최대 ${s[s.length - 1].toFixed(2)}`,
      `JS 작업 ms: 평균 ${avg(r.work).toFixed(2)}`,
      `드로우콜: 평균 ${avg(r.calls).toFixed(0)} · 최대 ${Math.max(...r.calls)}`,
      `삼각형: 평균 ${(avg(r.tris) / 1000).toFixed(1)}k`,
      `UA: ${navigator.userAgent}`,
    ].join('\n');
    this.out.textContent = this.result;
    this.copyBtn.disabled = false;
  }
  async copy() {
    try { await navigator.clipboard.writeText(this.result); this.copyBtn.textContent = '복사됨'; }
    catch { const t = document.createElement('textarea'); t.value = this.result; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); this.copyBtn.textContent = '복사됨'; }
    setTimeout(() => { this.copyBtn.textContent = '결과 복사'; }, 1500);
  }
}
