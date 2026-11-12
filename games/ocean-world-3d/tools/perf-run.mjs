// 노트북 실측 자동화: 이미 떠 있는 Chrome(원격 디버깅 포트)에 CDP로 붙어 ?perf=1 측정을 차례로 돌린다.
// 의존성 없음(Node 22+의 전역 WebSocket). 게임 코드는 고치지 않고, 페이지 밖에서 감싸기만 한다.
//
// 사용:
//   1) 게임 폴더에서 정적 서버:  python3 -m http.server 8123
//   2) Chrome을 디버깅 포트로(측정 전용 임시 프로필 권장):
//      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9333 \
//        --user-data-dir=/tmp/ow3d-perf --no-first-run --disable-background-timer-throttling \
//        --disable-renderer-backgrounding --disable-backgrounding-occluded-windows [--disable-gpu-vsync --disable-frame-rate-limit]
//   3) node tools/perf-run.mjs --port 9333 --base http://localhost:8123/ --sec 30 \
//        --runs "box=perf=1;trans=perf=1&water=transmission" --window 1280x800|full --out result.json
// 결과: 실행마다 { name, query, window, overlay(성능 표시의 결과 문자열), mine(직접 센 값) } 를 JSON으로.
//   mine: 프레임 시간 분위수, 1% low fps, JS 내역(갱신 고리·수면 파동·render 호출 CPU), GPU 시간(EXT_disjoint_timer_query_webgl2가 있을 때)
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1']);
  return a;
}, []));
const PORT = +(args.port || 9333);
const BASE = args.base || 'http://localhost:8123/';
const SEC = +(args.sec || 30);
const WARM = +(args.warm || 6);
const WIN = args.window || '1280x800';
const RUNS = (args.runs || 'box=perf=1').split(';').map((s) => { const i = s.indexOf('='); return { name: s.slice(0, i), query: s.slice(i + 1) }; });
const OUT = args.out || null;
const SHOT = args.shot || null;   // 폴더: 실행마다 화면 캡처(jpeg)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 최소 CDP 클라이언트(브라우저 연결 + flatten 세션) ----
const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pend = new Map(); const listeners = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else for (const l of listeners) l(m);
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId }));
});

const targets = (await send('Target.getTargets')).targetInfos.filter((t) => t.type === 'page');
const targetId = targets.length ? targets[0].targetId : (await send('Target.createTarget', { url: 'about:blank' })).targetId;
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable');
const consoleErrors = [];
listeners.push((m) => {
  if (m.sessionId !== sessionId) return;
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning'))
    consoleErrors.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
});
const evalJS = async (expr) => {
  const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

const { windowId } = await send('Browser.getWindowForTarget', { targetId });
async function setWindow(spec) {
  await send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await sleep(600);
  if (spec === 'full') { await send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } }); await sleep(1500); return; }
  const [w, h] = spec.split('x').map(Number);
  await send('Browser.setWindowBounds', { windowId, bounds: { left: 0, top: 0, width: w, height: h } });
  await sleep(600);
}

// 페이지 안에 넣는 계측(게임 파일은 건드리지 않음)
const PROBE = `(() => {
  const ow = window.__ow, app = ow.app, r = app.renderer, gl = r.getContext();
  const P = window.__probe = { frames: [], cur: null, gpu: [], gpuExt: null };
  const now = () => performance.now();
  // 갱신 고리 전체, 수면 파동 step, render() CPU
  const hook = app.hooks[0];
  app.hooks[0] = (dt, t) => { const a = now(); hook(dt, t); if (P.cur) P.cur.hook = now() - a; };
  const hfStep = ow.hf.step.bind(ow.hf);
  ow.hf.step = (dt) => { const a = now(); hfStep(dt); if (P.cur) P.cur.hf = now() - a; };
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  P.gpuExt = !!ext;
  const pendingQ = [];
  const render = r.render.bind(r);
  r.render = (s, c) => {
    let q = null;
    if (ext && P.cur) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
    const a = now(); render(s, c); const cpu = now() - a;
    if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pendingQ.push(q); }
    if (P.cur) P.cur.render = cpu;
    // 이전 쿼리 결과 회수
    while (pendingQ.length && gl.getQueryParameter(pendingQ[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q0 = pendingQ.shift();
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      const ns = gl.getQueryParameter(q0, gl.QUERY_RESULT);
      if (!disjoint && P.rec) P.gpu.push(ns / 1e6);
      gl.deleteQuery(q0);
    }
  };
  let last = now();
  const tick = () => { requestAnimationFrame(tick); const t = now(); if (P.rec && P.cur) { P.cur.dt = t - last; P.frames.push(P.cur); } last = t; P.cur = {}; };
  requestAnimationFrame(tick);
  return { gpuExt: P.gpuExt };
})()`;

const SUMMARY = `(() => {
  const P = window.__probe, f = P.frames;
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const dt = f.map((x) => x.dt);
  const pick = (k) => f.map((x) => x[k] || 0);
  return {
    frames: f.length, avgFps: 1000 / avg(dt), p50: q(dt, 0.5), p95: q(dt, 0.95), p99: q(dt, 0.99), max: Math.max(...dt),
    low1Fps: 1000 / q(dt, 0.99), over20ms: dt.filter((x) => x > 20).length, over34ms: dt.filter((x) => x > 34).length,
    hookMs: avg(pick('hook')), hfMs: avg(pick('hf')), renderCpuMs: avg(pick('render')),
    gpuMs: P.gpu.length ? { avg: avg(P.gpu), p50: q(P.gpu, 0.5), p95: q(P.gpu, 0.95), n: P.gpu.length } : null,
  };
})()`;

const results = [];
await setWindow(WIN);
for (const run of RUNS) {
  const url = BASE + '?' + run.query;
  consoleErrors.length = 0;
  await S('Page.navigate', { url });
  for (let i = 0; i < 100; i++) { await sleep(200); try { if (await evalJS('!!(window.__ow && window.__ow.app && window.__ow.app.perfOverlay)')) break; } catch {} }
  const env = await evalJS(`({ dpr: devicePixelRatio, inner: [innerWidth, innerHeight], screen: [screen.width, screen.height],
    canvas: [__ow.app.renderer.domElement.width, __ow.app.renderer.domElement.height], pr: __ow.app.renderer.getPixelRatio(),
    gpu: __ow.app.perfOverlay.gpu, multiDraw: __ow.app.gl.hasMultiDraw, ua: navigator.userAgent })`);
  const probe = await evalJS(PROBE);
  await sleep(WARM * 1000);   // 셰이더 컴파일·초기 출렁임이 가라앉을 때까지
  await evalJS(`(() => { __ow.app.perfOverlay.result = null; window.__probe.frames.length = 0; window.__probe.gpu.length = 0; window.__probe.rec = true; __ow.app.perfOverlay.start(${SEC}); })()`);
  await sleep(SEC * 1000);
  for (let i = 0; i < 50; i++) { if (await evalJS('!!__ow.app.perfOverlay.result')) break; await sleep(200); }
  await evalJS('window.__probe.rec = false');
  const overlay = await evalJS('__ow.app.perfOverlay.result');
  const mine = await evalJS(SUMMARY);
  const stats = await evalJS('__ow.app.stats()');
  let shot = null;
  if (SHOT) {
    fs.mkdirSync(SHOT, { recursive: true });
    const img = await S('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
    shot = `${SHOT}/${run.name}-${WIN}.jpg`;
    fs.writeFileSync(shot, Buffer.from(img.data, 'base64'));
  }
  const rec = { name: run.name, query: run.query, window: WIN, env, probe, overlay, mine, stats, errors: [...consoleErrors], shot };
  results.push(rec);
  console.log(`[${run.name} ${WIN}] fps ${mine.avgFps.toFixed(1)} · 1%low ${mine.low1Fps.toFixed(1)} · p99 ${mine.p99.toFixed(1)}ms · max ${mine.max.toFixed(1)}ms · ` +
    `JS ${mine.hookMs.toFixed(2)}+${mine.renderCpuMs.toFixed(2)}ms(hf ${mine.hfMs.toFixed(2)}) · GPU ${mine.gpuMs ? mine.gpuMs.avg.toFixed(2) + 'ms' : '-'} · ` +
    `calls ${stats.calls} · tris ${(stats.triangles / 1000).toFixed(1)}k · canvas ${env.canvas.join('×')} · err ${consoleErrors.length}`);
}
if (OUT) {
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
  fs.writeFileSync(OUT, JSON.stringify(prev.concat(results), null, 1));
}
ws.close();
