// 제조 소리와 효과음. 파일 없이 Web Audio로 합성한다(Sailing Master sound.js와 같은 잡음 필터 방식).
export function makeNoise(ac, sec = 3) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * sec), ac.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return buf;
}
// 끊김 없이 도는 소리 정의: 필터 종류·주파수·Q·최대 크기
const LOOPS = {
  grinder: { type: 'bandpass', f: 1500, q: 0.9, peak: 0.34, rate: 1.3, buzz: 118 },
  shot: { type: 'lowpass', f: 720, q: 0.7, peak: 0.26, rate: 0.75, buzz: 58 },
  water: { type: 'bandpass', f: 1700, q: 0.8, peak: 0.26, rate: 1.1 },
  pour: { type: 'bandpass', f: 1050, q: 0.65, peak: 0.34, rate: 0.95 },
  steam: { type: 'highpass', f: 2600, q: 0.8, peak: 0.28, rate: 1.2 },
  whirl: { type: 'lowpass', f: 480, q: 1.2, peak: 0.3, rate: 0.7 },
  rain: { type: 'bandpass', f: 2200, q: 0.5, peak: 0.1, rate: 1 },
};
export function createSound() {
  let ac = null, master = null, noise = null, on = true;
  const loops = {};
  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain(); master.gain.value = on ? 1 : 0; master.connect(ac.destination);
      noise = makeNoise(ac);
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  }
  function loopOf(name) {
    if (loops[name]) return loops[name];
    const def = LOOPS[name], src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; src.loop = true; src.playbackRate.value = def.rate;
    flt.type = def.type; flt.frequency.value = def.f; flt.Q.value = def.q;
    g.gain.value = 0;
    src.connect(flt); flt.connect(g); g.connect(master); src.start();
    let osc = null, og = null;
    if (def.buzz) {
      osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = def.buzz;
      og = ac.createGain(); og.gain.value = 0.11; osc.connect(og); og.connect(g); osc.start();
    }
    loops[name] = { g, flt, def };
    return loops[name];
  }
  // level 0~1. 부드럽게 커지고 줄어든다
  function loop(name, level) {
    if (!ensure()) return;
    const l = loopOf(name);
    l.g.gain.setTargetAtTime(l.def.peak * level, ac.currentTime, 0.04);
  }
  function stopLoops(except = []) {
    if (!ac) return;
    for (const [n, l] of Object.entries(loops)) if (!except.includes(n)) l.g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
  }
  function tone(f, dur, type = 'sine', peak = 0.2, when = 0, slide = 0) {
    if (!ensure()) return;
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dur, f, peak, type = 'bandpass', when = 0) {
    if (!ensure()) return;
    const t = ac.currentTime + when, s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; flt.type = type; flt.frequency.value = f;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt); flt.connect(g); g.connect(master); s.start(t, Math.random() * 2, dur + 0.02);
  }
  const FX = {
    click: () => tone(720, 0.05, 'triangle', 0.1),
    tick: () => { burst(0.018, 3100, 0.2); tone(1500, 0.015, 'square', 0.025); },
    ok: () => { tone(660, 0.09, 'sine', 0.14); tone(990, 0.15, 'sine', 0.12, 0.08); },
    thud: () => { tone(120, 0.12, 'sine', 0.42, 0, -60); burst(0.06, 500, 0.2); },
    clunk: () => { tone(190, 0.08, 'triangle', 0.3, 0, -70); burst(0.04, 1400, 0.16); },
    bell: () => { for (const [f, w] of [[1320, 0], [1980, 0.02], [1320, 0.16]]) tone(f, 0.6, 'sine', 0.09, w); },
    cup: () => { tone(2100, 0.12, 'sine', 0.08); tone(3200, 0.08, 'sine', 0.05, 0.01); burst(0.05, 2400, 0.09); },
    star: () => { tone(880, 0.12, 'triangle', 0.13); tone(1320, 0.18, 'triangle', 0.12, 0.09); tone(1760, 0.26, 'triangle', 0.1, 0.18); },
    bad: () => { tone(240, 0.22, 'triangle', 0.14, 0, -70); },
    page: () => burst(0.14, 3300, 0.1),
    type: () => tone(1050, 0.012, 'square', 0.009),
  };
  return {
    ensure, loop, stopLoops,
    play: (n) => { if (FX[n] && ensure()) FX[n](); },
    setOn: (v) => { on = v; if (master) master.gain.setTargetAtTime(v ? 1 : 0, ac.currentTime, 0.02); },
    get on() { return on; },
    get ctx() { ensure(); return ac; },
  };
}
