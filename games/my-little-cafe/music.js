// 배경음악. 기본은 날씨별 MP3(music/), 받지 못하면 아래 합성 곡으로 대신한다.
// 합성: Sailing Master music.js와 같은 예약 방식의 잔잔한 카페 재즈 두 곡.
// day: 영업 시간(브러시와 워킹 베이스), drip: 오후·드립(건반만 느리게).
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const LOOKAHEAD = 0.6;

export const TRACKS = {
  day: { bpm: 84, swing: 0.18, bass: true, brush: true, chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55], [50, 53, 57, 60], [55, 59, 62, 65], [52, 55, 59, 62], [45, 49, 52, 55]], motif: [72, 69, 67, 69, 72, 74, 72, 69] },
  drip: { bpm: 60, swing: 0.1, bass: false, brush: false, chords: [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53]], motif: [76, 74, 72, 71, 72, 69, 67, 69] },
};

function keyNote(ac, dest, f, t, dur, peak) {
  // 전기 건반 느낌: 사인 + 2배음 + 짧은 어택
  for (const [mul, k, d] of [[1, 1, 1], [2, 0.32, 0.65], [4, 0.1, 0.25]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f * mul;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak * k, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * d);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
}
function bassNote(ac, dest, f, t, dur, peak) {
  const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 420;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
const noiseBufs = new WeakMap();
function brush(ac, dest, t, peak) {
  if (!noiseBufs.has(ac)) {
    const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(ac, b);
  }
  const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  n.buffer = noiseBufs.get(ac); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.6;
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * 0.8, 0.14);
}
// 한 마디(4박)를 t에 예약한다
export function scheduleBar(ac, dest, tr, bar, t, rand) {
  const beat = 60 / tr.bpm, ch = tr.chords[bar % tr.chords.length];
  const sw = (i) => (i % 2 ? beat * 0.5 * tr.swing : 0);
  // 화음: 1박과 3박 뒤에 살짝
  ch.forEach((m, i) => keyNote(ac, dest, mtof(m + 12), t + i * 0.012, beat * 3.2, 0.05));
  if (bar % 2) ch.slice(1).forEach((m) => keyNote(ac, dest, mtof(m + 12), t + beat * 2.5 + sw(1), beat * 1.3, 0.032));
  // 멜로디 조각: 듬성듬성
  if (rand() < 0.72) {
    const off = Math.floor(rand() * 4);
    for (let i = 0; i < 3; i++) {
      if (rand() < 0.3) continue;
      keyNote(ac, dest, mtof(tr.motif[(bar * 2 + i + off) % tr.motif.length] + (rand() < 0.2 ? 12 : 0)), t + (1 + i) * beat * 0.5 + sw(i + 1) + beat * 0.5, beat * 1.2, 0.055);
    }
  }
  if (tr.bass) {
    const root = ch[0] - 12;
    [0, 7, 12, 10].forEach((d, i) => bassNote(ac, dest, mtof(root + d), t + i * beat, beat * 0.9, 0.16));
  }
  if (tr.brush) for (let i = 0; i < 8; i++) brush(ac, dest, t + i * beat * 0.5 + sw(i), i % 4 === 2 ? 0.032 : 0.014);
}

export function createMusic() {
  let ac = null, out = null, curr = null, timer = null, nextT = 0, bar = 0, track = null, enabled = true;
  const rand = Math.random;
  const pump = () => {
    if (!ac || !curr) return;
    while (nextT < ac.currentTime + LOOKAHEAD) {
      scheduleBar(ac, curr, TRACKS[track], bar, nextT, rand);
      nextT += 240 / TRACKS[track].bpm; bar += 1;
    }
  };
  return {
    play(context, id) {
      ac = context;
      if (!out) { out = ac.createGain(); out.gain.value = enabled ? 1 : 0; out.connect(ac.destination); }
      if (track === id && curr) return;
      if (curr) { const old = curr; old.gain.setTargetAtTime(0, ac.currentTime, 0.7); setTimeout(() => old.disconnect(), 4000); }
      track = id; bar = 0; nextT = ac.currentTime + 0.1;
      curr = ac.createGain(); curr.gain.value = 0.0001; curr.gain.setTargetAtTime(0.95, ac.currentTime, 0.8); curr.connect(out);
      if (!timer) timer = setInterval(pump, 200);
      pump();
    },
    setOn(v) { enabled = v; if (out) out.gain.setTargetAtTime(v ? 1 : 0, ac.currentTime, 0.05); },
    get track() { return track; },
  };
}

// 날씨별 MP3 재생: 곡이 끝나 갈 때 같은 날씨의 다른 곡과 겹쳐 넘어간다. MP3 끝 공백이 들리지 않게 한다
const FILES = { sunny: ['sunny-1', 'sunny-2'], cloudy: ['cloudy-1', 'cloudy-2'], rainy: ['rainy-1', 'rainy-2'], snowy: ['snowy-1', 'snowy-2'] };
export const MUSIC_FILES = FILES;
const FADE = 3;
const LEVEL = 0.8;
export function createFileMusic(synth) {
  let ac = null, out = null, key = null, idx = 0, active = 0, enabled = true, failed = false, wired = false;
  const slots = [0, 1].map(() => ({ el: null, gain: null }));
  function wire() {
    if (wired) return;
    wired = true;
    out = ac.createGain(); out.gain.value = enabled ? 1 : 0; out.connect(ac.destination);
    for (const s of slots) {
      s.el = new Audio(); s.el.preload = 'auto'; s.el.crossOrigin = 'anonymous';
      s.gain = ac.createGain(); s.gain.gain.value = 0;
      ac.createMediaElementSource(s.el).connect(s.gain); s.gain.connect(out);
      s.el.addEventListener('error', () => fallback());
      s.el.addEventListener('timeupdate', () => { if (s === slots[active] && s.el.duration && s.el.currentTime > s.el.duration - FADE) advance(); });
    }
  }
  function fallback() {
    if (failed) return;
    failed = true;
    for (const s of slots) s.gain.gain.setTargetAtTime(0, ac.currentTime, 0.3);
    synth.play(ac, key === 'rainy' || key === 'snowy' ? 'drip' : 'day');
    synth.setOn(enabled);
  }
  function start(file) {
    const prev = slots[active];
    active = 1 - active;
    const next = slots[active], t = ac.currentTime;
    next.el.src = `music/${file}.mp3`;
    next.el.currentTime = 0;
    const p = next.el.play();
    if (p) p.catch(() => {}); // 자동 재생이 막히면 다음 탭에서 다시 시도한다
    next.gain.gain.cancelScheduledValues(t); next.gain.gain.setValueAtTime(0.0001, t); next.gain.gain.exponentialRampToValueAtTime(LEVEL, t + FADE);
    prev.gain.gain.cancelScheduledValues(t); prev.gain.gain.setTargetAtTime(0, t, FADE / 3);
    setTimeout(() => { if (slots[active] !== prev) prev.el.pause(); }, (FADE + 1) * 1000);
  }
  function advance() { idx = (idx + 1) % FILES[key].length; start(FILES[key][idx]); }
  return {
    play(context, nextKey) {
      ac = context; wire();
      if (failed) return;
      if (key === nextKey) { const s = slots[active]; if (s.el.paused && s.el.src) { const p = s.el.play(); if (p) p.catch(() => {}); } return; }
      key = nextKey; idx = Math.floor(Math.random() * FILES[key].length);
      start(FILES[key][idx]);
    },
    setOn(v) { enabled = v; if (out) out.gain.setTargetAtTime(v ? 1 : 0, ac.currentTime, 0.05); if (failed) synth.setOn(v); },
    get key() { return key; },
    get failed() { return failed; },
  };
}
