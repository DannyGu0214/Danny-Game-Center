// 배경음악: 파일 없이 Web Audio로 합성한다(Animal World music.js와 같은 예약 방식).
// 담수 세 수역에 한 곡씩. 수역이 바뀌면 4초 동안 겹쳐 넘어간다. 음표는 0.6초 앞까지 미리 예약한다.

const FADE_S = 4, LOOKAHEAD_S = 0.6;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function voice(ac, dest, t, end, peak, attack = 0.005) {
  const g = ac.createGain();
  g.gain.value = 0.0001; // 기본값 1이면 예약 직전 한 샘플이 크게 튄다(딸깍)
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(dest);
  return g;
}
function osc(ac, type, f, t, end, dest, detune = 0) {
  const o = ac.createOscillator();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(end + 0.05);
  return o;
}
const INST = {
  pad(ac, dest, t, f, dur, vel) {
    const end = t + dur + 1.8, g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 850; lp.Q.value = 0.5;
    g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.042 * vel, t + 1.3);
    g.gain.setValueAtTime(0.042 * vel, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    lp.connect(g); g.connect(dest);
    osc(ac, 'triangle', f, t, end, lp, -6); osc(ac, 'triangle', f, t, end, lp, 6);
  },
  kalimba(ac, dest, t, f, dur, vel) {
    const end = t + 1.4, g = voice(ac, dest, t, end, 0.12 * vel, 0.003);
    osc(ac, 'sine', f, t, end, g);
    const h = voice(ac, dest, t, t + 0.18, 0.035 * vel, 0.002); osc(ac, 'sine', f * 5.9, t, t + 0.18, h);
  },
  flute(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.3, g = voice(ac, dest, t, end, 0.07 * vel, 0.08), o = osc(ac, 'sine', f, t, end, g);
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 4.8; lg.gain.value = f * 0.005;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + 0.2); lfo.stop(end + 0.05);
    const h = ac.createGain(); h.gain.value = 0.1; h.connect(g); osc(ac, 'triangle', f * 2, t, end, h);
  },
  // 하프: 뜯는 소리, 짧게 올라와 길게 사라진다
  harp(ac, dest, t, f, dur, vel) {
    const end = t + 2.2, lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    lp.connect(voice(ac, dest, t, end, 0.1 * vel, 0.004));
    osc(ac, 'triangle', f, t, end, lp);
    const h = ac.createGain(); h.gain.value = 0.3; h.connect(lp); osc(ac, 'sine', f * 2, t, t + 0.9, h);
  },
  bass(ac, dest, t, f, dur, vel) {
    const end = t + dur, g = voice(ac, dest, t, end, 0.085 * vel, 0.03);
    osc(ac, 'sine', f, t, end, g);
    const h = ac.createGain(); h.gain.value = 0.2; h.connect(g); osc(ac, 'triangle', f, t, end, h);
  },
};

// 곡마다 네 마디 화음 + 8마디 멜로디(반음 수 또는 null = 쉼, 박자)
const MAJOR = { I: [0, 4, 7], ii: [2, 5, 9], iii: [4, 7, 11], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16] };
const TRACKS = {
  pond: {
    name: '아침 호숫가', root: 60, bpm: 78, lead: 'kalimba', arp: 'kalimba',
    chords: ['I', 'vi', 'IV', 'V'],
    melody: [
      [[[12, 1], [16, 1], [19, 2]], [[16, 1], [12, 1], [9, 2]], [[12, 1], [9, 1], [5, 2]], [[7, 1], [11, 1], [14, 2]]],
      [[[19, 1.5], [16, 0.5], [12, 2]], [[21, 1], [19, 1], [16, 2]], [[17, 1], [16, 1], [12, 2]], [[14, 2], [null, 2]]],
    ],
  },
  lake: {
    name: '넓은 물 위로', root: 65, bpm: 70, lead: 'flute', arp: 'harp',
    chords: ['I', 'IV', 'vi', 'V'],
    melody: [
      [[[12, 2], [16, 2]], [[17, 3], [16, 1]], [[12, 2], [9, 2]], [[11, 2], [7, 2]]],
      [[[19, 3], [17, 1]], [[16, 2], [17, 2]], [[21, 2], [19, 1], [16, 1]], [[14, 4]]],
    ],
  },
  river: {
    name: '흐르는 대로', root: 62, bpm: 86, lead: 'harp', arp: 'harp',
    chords: ['I', 'V', 'vi', 'IV'],
    melody: [
      [[[12, 1], [14, 1], [16, 1], [19, 1]], [[19, 1], [14, 1], [11, 2]], [[16, 1], [12, 1], [9, 1], [12, 1]], [[17, 2], [12, 2]]],
      [[[24, 1], [21, 1], [19, 2]], [[19, 1], [21, 1], [23, 2]], [[21, 1], [19, 1], [16, 2]], [[17, 1], [16, 1], [14, 2]]],
    ],
  },
};

export function createMusic({ volume = 0.65, rand = Math.random } = {}) { // 파도 소리(RMS 약 0.06)에 묻히지 않을 크기
  let ac = null, bus = null, verb = null, timer = null, on = true, paused = false, cur = null, wanted = 'pond';
  function makeReverb() {
    const len = Math.floor(ac.sampleRate * 2.4), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    const c = ac.createConvolver(); c.buffer = buf;
    const wet = ac.createGain(); wet.gain.value = 0.3;
    c.connect(wet); wet.connect(bus);
    return c;
  }
  function begin(id, t) {
    const T = TRACKS[id], g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + FADE_S);
    g.connect(bus); g.connect(verb);
    cur = { id, T, g, nextBar: t + 0.05, i: 0, beat: 60 / T.bpm };
  }
  function scheduleBar(c) {
    const { T, i, nextBar: t, beat, g } = c, ch = MAJOR[T.chords[i % 4]];
    const play = (inst, at, semis, dur, vel) => INST[inst](ac, g, at + (rand() - 0.5) * 0.02, mtof(T.root + semis), dur, vel * (0.9 + rand() * 0.2));
    for (const n of ch) play('pad', t, n, beat * 4, 0.8);
    play('bass', t, ch[0] - 12, beat * 1.8, 0.85);
    if (i % 2) play('bass', t + beat * 2, ch[0] - 12, beat * 1.6, 0.7);
    // 분산화음: 한 마디 8분음표로 물결치듯
    const seq = [0, 1, 2, 1, 0, 2, 1, 2];
    for (let k = 0; k < 8; k++) if (T.arp !== T.lead || k % 2 === 0) play(T.arp, t + beat * k / 2, ch[seq[k]] + 12, beat / 2, 0.42 + (k % 4 === 0 ? 0.12 : 0));
    // 앞의 네 마디는 쉬고 멜로디는 다섯째 마디부터
    if (i >= 4) {
      const phrase = T.melody[Math.floor((i - 4) / 4) % 2][(i - 4) % 4];
      let at = t;
      for (const [n, b] of phrase) { if (n != null) play(T.lead, at, n, beat * b, 0.95); at += beat * b; }
    }
    c.nextBar += beat * 4; c.i++;
  }
  function tick() {
    if (!ac || !on || paused || ac.state !== 'running') return;
    const until = ac.currentTime + LOOKAHEAD_S;
    if (!cur) begin(wanted, ac.currentTime + 0.1);
    if (cur.nextBar < ac.currentTime) cur.nextBar = ac.currentTime + 0.05; // 멈췄다 돌아오면 밀린 음표를 치지 않는다
    if (cur.id !== wanted) {
      const old = cur, t = cur.nextBar;
      old.g.gain.setValueAtTime(1, t); old.g.gain.exponentialRampToValueAtTime(0.0001, t + FADE_S);
      setTimeout(() => old.g.disconnect(), (t - ac.currentTime + FADE_S + 2) * 1000);
      begin(wanted, t);
    }
    while (cur.nextBar < until) scheduleBar(cur);
  }
  function level() {
    if (!bus) return;
    const t = ac.currentTime, v = on && !paused ? Math.max(0.0001, volume) : 0.0001;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t); bus.gain.exponentialRampToValueAtTime(v, t + 0.6);
  }
  return {
    start(ctx) {
      if (ac || !ctx) return;
      ac = ctx; bus = ac.createGain(); bus.gain.value = 0.0001; bus.connect(ac.destination);
      verb = makeReverb(); level();
      timer = setInterval(tick, 50); tick();
    },
    setRegion(id) { if (TRACKS[id]) wanted = id; },
    setOn(v) { on = !!v; level(); },
    get on() { return on; },
    pause() { paused = true; level(); },
    resume() { paused = false; level(); },
    get current() { return cur?.T.name ?? null; },
    // 점검용: 오프라인 컨텍스트에 한 곡을 seconds만큼 예약한다
    renderInto(ctx, id, seconds) {
      ac = ctx; bus = ac.createGain(); bus.gain.value = volume; bus.connect(ac.destination);
      verb = makeReverb(); begin(id, 0); cur.i = 4;
      while (cur.nextBar < seconds) scheduleBar(cur);
    },
    get timer() { return timer; },
  };
}
export const TRACK_IDS = Object.keys(TRACKS);
