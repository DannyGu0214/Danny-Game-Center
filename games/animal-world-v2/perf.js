// 성능 측정(M0·M1, 2026-11-10): 고정 장면을 만들고 프레임 시간을 잰다. 세이브는 건드리지 않는다.
// 주소: index.html?perf=1&region=seaside&n=44&zoom=1&renderer=pixi|2d&outline=gpu|2d&dur=30&seed=1&time=day&dpr=2&sync=0
//   region  지역(grassland·seaside·desert·antarctic)    n     동물 수(최대 44)       zoom  배율(1~4)
//   renderer pixi(WebGL) 또는 2d(v1과 같은 그리기)       outline gpu(셰이더) 또는 2d(v1 방식으로 만든 그림을 올림, pixi에서만)
//   dur     잴 시간(초, 앞 3초는 버림)                   time  morning·day·evening·night
//   dpr     화면 배율(없으면 기기 값, 최대 2)             sync  1이면 GPU가 다 그릴 때까지 기다려서 잰다(GPU 시간 포함)

// 고정 장면: 모든 지역 T8, 그 지역 물건을 종류마다 items개, 동물은 종을 돌아가며 n마리
export function buildScenario(G, D, { region = 'seaside', n = 44, seed = 1, items = 2, time = 'day' } = {}) {
  const S = G.newGame(seed, Date.now());
  for (const r of D.REGIONS) { S.regions[r.id].tier = D.MAX_TIER; S.regions[r.id].pop = 1e12; }
  G.setView(S, region);
  const R = S.regions[region];
  R.pop = 1e12;
  for (const id of D.itemsOf(region)) for (let k = 0; k < items; k++) { const at = G.freeSpot(S, region, id); if (at) G.placeItem(S, region, id, at[0], at[1]); }
  const sps = D.speciesOf(region);
  for (let i = 0, tries = 0; R.animals.length < n && tries < n * 4; i++, tries++) G.adopt(S, region, sps[i % sps.length]);
  const ph = { morning: 0, day: 1, evening: 2, night: 3 }[time] ?? 1;
  S.time = G.PHASE_SEC * ph + G.PHASE_SEC / 2;
  S.events.length = 0;
  return S;
}

// 측정 표: 프레임 간격(rAF)과 구간별 시간(ms)을 모아 평균·1% 최저 fps·긴 프레임 비율을 낸다
export function createPerf({ dur = 30, warm = 3, label = '' } = {}) {
  const el = document.createElement('pre');
  el.id = 'perf';
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50;margin:0;padding:8px 10px;font:12px/1.45 ui-monospace,Menlo,monospace;background:rgba(20,16,12,0.82);color:#f4ead8;border-radius:10px;max-width:min(520px,calc(100vw - 16px));white-space:pre-wrap;user-select:text';
  document.body.appendChild(el);
  const t0 = performance.now(), gaps = [], sec = {}, cur = {};
  let last = 0, done = null, shownAt = 0, live = { fps: 0, n: 0, t: t0 };
  const P = {
    mark(name, ms) { cur[name] = (cur[name] || 0) + ms; },
    frame(now, info) {
      if (last) {
        const gap = now - last, el2 = (now - t0) / 1000;
        if (!done && el2 > warm) { gaps.push(gap); for (const k in cur) (sec[k] ||= []).push(cur[k]); }
        live.n++;
        if (now - live.t > 500) { live.fps = (live.n * 1000) / (now - live.t); live.n = 0; live.t = now; }
        if (!done && el2 > warm + dur) finish(info);
      }
      last = now;
      for (const k in cur) delete cur[k];
      if (now - shownAt > 500) { shownAt = now; show(info); }
    },
    get result() { return done; },
  };
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const pct = (a, p) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
  function finish(info) {
    const ms = avg(gaps);
    done = {
      label, frames: gaps.length, fps: +(1000 / ms).toFixed(1), low1: +(1000 / pct(gaps, 0.99)).toFixed(1),
      long: +((gaps.filter((g) => g > 20).length / gaps.length) * 100).toFixed(2),
      ms: Object.fromEntries(Object.entries(sec).map(([k, v]) => [k, +avg(v).toFixed(2)])), ...info,
    };
    window.__perf = done;
    document.title = 'perf-done';
    console.log('[perf]', JSON.stringify(done));
  }
  function show(info) {
    const lines = [`${label}`, `지금 ${live.fps.toFixed(1)} fps · ${(((performance.now() - t0) / 1000) | 0)}초`];
    for (const k in sec) lines.push(`  ${k.padEnd(8)} ${avg(sec[k].slice(-60)).toFixed(2)} ms`);
    for (const [k, v] of Object.entries(info || {})) lines.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    if (done) lines.push('', `결과(${dur}초): 평균 ${done.fps} fps · 1% 최저 ${done.low1} fps · 20ms 넘는 프레임 ${done.long}%`, JSON.stringify(done));
    else lines.push(`  측정 중… (앞 ${warm}초 버림, ${dur}초 잼)`);
    el.textContent = lines.join('\n');
  }
  return P;
}
