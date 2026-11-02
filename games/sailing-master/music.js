// 배경음악: 파일 없이 Web Audio로 합성한다(Animal World music.js와 같은 예약 방식).
// 항해의 기본 곡은 선술집 풍(2026-11-02 대니님 요청): 아코디언·피들·뜯는 현·발 구르기·탬버린. 수역마다 한 곡, 바뀌면 4초 동안 겹쳐 넘어간다.

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
// 끄는 악기용: 음이 끝날 때까지 크기를 유지한다
function held(ac, dest, t, end, peak, attack = 0.02) {
  const g = ac.createGain(), atk = Math.min(attack, (end - t) * 0.3), rel = Math.min(0.05, (end - t) * 0.3);
  g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + atk); g.gain.setValueAtTime(peak, end - rel); g.gain.linearRampToValueAtTime(0.0001, end);
  g.connect(dest);
  return g;
}
function osc(ac, type, f, t, end, dest, detune = 0) {
  const o = ac.createOscillator();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(end + 0.05);
  return o;
}
const noiseBufs = new WeakMap();
function noiseOf(ac) {
  if (!noiseBufs.has(ac)) {
    const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(ac, buf);
  }
  return noiseBufs.get(ac);
}
function noiseHit(ac, dest, t, len, type, freq, peak) {
  const n = ac.createBufferSource(), f = ac.createBiquadFilter(); n.buffer = noiseOf(ac);
  f.type = type; f.frequency.value = freq;
  n.connect(f); f.connect(voice(ac, dest, t, t + len, peak, 0.002));
  n.start(t, Math.random() * 0.5); n.stop(t + len + 0.02);
}
function filtered(ac, type, freq, q, dest) { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(dest); return f; }
const INST = {
  // 아코디언: 살짝 어긋난 두 리드가 떨리는 소리(뮈제트)
  accordion(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.05, g = held(ac, dest, t, end, 0.06 * vel, 0.018), lp = filtered(ac, 'lowpass', 2300, 0.6, g);
    osc(ac, 'sawtooth', f, t, end, lp, -9); osc(ac, 'sawtooth', f, t, end, lp, 9);
  },
  // 피들: 활로 긁는 톱니파와 늦게 들어오는 떨림
  fiddle(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.04, g = held(ac, dest, t, end, 0.17 * vel, 0.022), bp = filtered(ac, 'bandpass', 1900, 0.7, g);
    const o = osc(ac, 'sawtooth', f, t, end, bp);
    if (dur > 0.28) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5.8; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.2); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end + 0.02); }
  },
  // 양철 호루라기: 맑고 숨이 섞인 소리
  whistle(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.03, g = held(ac, dest, t, end, 0.07 * vel, 0.012);
    osc(ac, 'triangle', f * 2, t, end, g);
    noiseHit(ac, dest, t, 0.04, 'highpass', 3500, 0.012 * vel);
  },
  // 뜯는 현: 짧게 울리는 만돌린 코드 한 음
  pluck(ac, dest, t, f, dur, vel) {
    const end = t + 0.32, g = voice(ac, dest, t, end, 0.075 * vel, 0.002), lp = filtered(ac, 'lowpass', 3000, 0.8, g);
    osc(ac, 'sawtooth', f, t, end, lp); osc(ac, 'triangle', f * 2, t, t + 0.12, lp);
  },
  // 콘트라베이스: 굵게 뜯는 저음
  bass(ac, dest, t, f, dur, vel) {
    const end = t + Math.min(dur, 0.42), g = voice(ac, dest, t, end, 0.19 * vel, 0.006);
    osc(ac, 'triangle', f, t, end, g); osc(ac, 'sine', f * 2, t, t + 0.08, g);
  },
};
// 선술집 나무 바닥을 구르는 발, 탬버린, 부딪히는 잔
const PERC = {
  stomp(ac, dest, t, vel) {
    const o = ac.createOscillator(), g = voice(ac, dest, t, t + 0.16, 0.24 * vel, 0.002);
    o.frequency.setValueAtTime(135, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.1);
    o.connect(g); o.start(t); o.stop(t + 0.2);
    noiseHit(ac, dest, t, 0.03, 'lowpass', 1400, 0.09 * vel);
  },
  tamb(ac, dest, t, vel) { noiseHit(ac, dest, t, 0.075, 'highpass', 6500, 0.065 * vel); },
  clink(ac, dest, t, vel) { for (const [f, p] of [[2350, 0.03], [3620, 0.02], [5280, 0.012]]) osc(ac, 'sine', f, t, t + 0.3, voice(ac, dest, t, t + 0.3, p * vel, 0.001)); },
};

// 곡마다 16마디(8분음표 단위). bar 6이면 6/8 지그, 8이면 4/4. 음은 root에서 반음 수, null은 쉼
const CH = { I: [0, 4, 7], ii: [2, 5, 9], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16], i: [0, 3, 7], III: [3, 7, 10], iv: [5, 8, 12], v: [7, 10, 14], VI: [8, 12, 15], VII: [10, 14, 17] };
export const TRACKS = {
  pond: {
    name: '갈대 나루 선술집', root: 62, bpm: 112, bar: 6, lead: 'fiddle', lead2: 'accordion', scale: [0, 2, 3, 5, 7, 9, 10],
    chords: ['i', 'i', 'VII', 'VII', 'i', 'IV', 'v', 'i', 'III', 'VII', 'i', 'IV', 'III', 'VII', 'v', 'i'],
    melody: [
      [[12, 2], [7, 1], [10, 2], [7, 1]], [[12, 2], [14, 1], [15, 2], [14, 1]], [[17, 2], [15, 1], [14, 2], [10, 1]], [[14, 2], [12, 1], [10, 3]],
      [[12, 2], [7, 1], [10, 2], [7, 1]], [[9, 2], [10, 1], [12, 2], [14, 1]], [[15, 1], [14, 1], [12, 1], [10, 2], [9, 1]], [[12, 2], [12, 1], [12, 3]],
      [[15, 2], [17, 1], [19, 2], [17, 1]], [[17, 2], [14, 1], [10, 2], [14, 1]], [[15, 2], [14, 1], [12, 2], [10, 1]], [[9, 2], [10, 1], [12, 3]],
      [[15, 2], [17, 1], [19, 2], [22, 1]], [[22, 2], [19, 1], [17, 2], [14, 1]], [[14, 2], [12, 1], [10, 2], [9, 1]], [[12, 2], [7, 1], [12, 3]],
    ],
  },
  lake: {
    name: '한 잔 더!', root: 67, bpm: 132, bar: 8, lead: 'accordion', lead2: 'whistle', scale: [0, 2, 4, 5, 7, 9, 11],
    chords: ['I', 'I', 'IV', 'V', 'I', 'vi', 'V', 'I', 'IV', 'I', 'V', 'I', 'IV', 'I', 'V', 'I'],
    melody: [
      [[0, 1], [4, 1], [7, 2], [7, 1], [9, 1], [7, 2]], [[12, 2], [11, 1], [9, 1], [7, 2], [4, 2]], [[5, 1], [9, 1], [12, 2], [12, 1], [14, 1], [12, 2]], [[11, 2], [9, 1], [7, 1], [14, 2], [null, 2]],
      [[0, 1], [4, 1], [7, 2], [7, 1], [9, 1], [7, 2]], [[9, 2], [12, 1], [9, 1], [7, 2], [4, 2]], [[7, 1], [9, 1], [11, 1], [12, 1], [14, 2], [11, 2]], [[12, 2], [7, 2], [12, 2], [null, 2]],
      [[17, 2], [16, 1], [14, 1], [12, 2], [9, 2]], [[16, 2], [14, 1], [12, 1], [7, 2], [12, 2]], [[14, 1], [16, 1], [14, 1], [12, 1], [11, 2], [7, 2]], [[12, 2], [16, 2], [19, 2], [null, 2]],
      [[17, 2], [16, 1], [14, 1], [12, 2], [9, 2]], [[16, 2], [14, 1], [12, 1], [7, 2], [12, 2]], [[14, 2], [11, 1], [14, 1], [17, 2], [14, 2]], [[12, 2], [7, 1], [7, 1], [12, 2], [null, 2]],
    ],
  },
  river: {
    name: '노 저어라, 친구', root: 69, bpm: 118, bar: 8, lead: 'fiddle', lead2: 'accordion', scale: [0, 2, 3, 5, 7, 8, 10, 11],
    chords: ['i', 'i', 'VII', 'V', 'i', 'VI', 'V', 'i', 'III', 'VII', 'VI', 'V', 'III', 'VII', 'V', 'i'],
    melody: [
      [[0, 2], [3, 1], [5, 1], [7, 2], [7, 2]], [[7, 1], [8, 1], [7, 1], [5, 1], [3, 2], [0, 2]], [[2, 2], [5, 1], [7, 1], [10, 2], [7, 2]], [[7, 2], [11, 2], [14, 2], [null, 2]],
      [[0, 2], [3, 1], [5, 1], [7, 2], [7, 2]], [[8, 1], [7, 1], [8, 1], [10, 1], [12, 2], [8, 2]], [[7, 1], [8, 1], [7, 1], [5, 1], [11, 2], [7, 2]], [[12, 2], [7, 2], [12, 2], [null, 2]],
      [[15, 2], [15, 1], [14, 1], [12, 2], [10, 2]], [[14, 2], [14, 1], [12, 1], [10, 2], [7, 2]], [[12, 2], [12, 1], [10, 1], [8, 2], [12, 2]], [[11, 2], [14, 2], [11, 1], [7, 1], [null, 2]],
      [[15, 2], [15, 1], [17, 1], [19, 2], [15, 2]], [[17, 2], [14, 1], [12, 1], [10, 2], [14, 2]], [[14, 1], [12, 1], [11, 1], [14, 1], [11, 2], [7, 2]], [[12, 2], [7, 1], [7, 1], [12, 2], [null, 2]],
    ],
  },
};
const INTRO_BARS = 2;

export function createMusic({ volume = 0.65, rand = Math.random } = {}) { // 파도 소리(RMS 약 0.06)에 묻히지 않을 크기
  let ac = null, bus = null, verb = null, timer = null, on = true, paused = false, cur = null, wanted = 'pond';
  function makeReverb() {
    const len = Math.floor(ac.sampleRate * 0.9), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    const c = ac.createConvolver(); c.buffer = buf;
    const wet = ac.createGain(); wet.gain.value = 0.18; // 나무 벽 방 정도의 짧은 울림
    c.connect(wet); wet.connect(bus);
    return c;
  }
  function begin(id, t) {
    const T = TRACKS[id], g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + FADE_S);
    g.connect(bus); g.connect(verb);
    cur = { id, T, g, nextBar: t + 0.05, i: -INTRO_BARS, e: 60 / T.bpm / (T.bar === 6 ? 3 : 2) };
  }
  function scheduleBar(c) {
    const { T, i, nextBar: t, e, g } = c, pos = i < 0 ? 0 : i % T.chords.length, ch = CH[T.chords[pos]];
    const human = () => (rand() - 0.5) * 0.014;
    const play = (inst, at, semis, dur, vel) => INST[inst](ac, g, at + human(), mtof(T.root + semis), dur, vel * (0.9 + rand() * 0.2));
    const hit = (kind, at, vel) => PERC[kind](ac, g, at + human(), vel);
    // 쿵(저음·발) 짝(코드) 반주. 6/8은 쿵-짝짝 쿵-짝짝, 4/4는 쿵-짝 쿵-짝
    const beats = T.bar === 6 ? [0, 3] : [0, 2, 4, 6], offs = T.bar === 6 ? [1, 2, 4, 5] : [1, 3, 5, 7];
    beats.forEach((b, k) => {
      const fifth = T.bar === 6 ? k === 1 : k % 2 === 1;
      if (T.bar === 6 || k % 2 === 0) play('bass', t + b * e, (fifth ? ch[2] - 12 : ch[0]) - 24, e * 1.6, 1);
      hit('stomp', t + b * e, k === 0 ? 1 : 0.72);
    });
    if (T.bar === 8) beats.filter((_, k) => k % 2 === 1).forEach((b) => play('bass', t + b * e, ch[2] - 36, e * 1.6, 0.8));
    offs.forEach((b, k) => {
      const at = t + b * e;
      if (T.bar === 8 ? k % 2 === 0 || k === 3 : k % 2 === 1) { ch.forEach((n, q) => play('accordion', at, n - 12, e * 0.72, 0.42)); ch.forEach((n, q) => play('pluck', at + q * 0.009, n, e, 0.5)); hit('tamb', at, 1); }
      else hit('tamb', at, 0.55);
    });
    if (i >= 0) {
      const cycle = Math.floor(i / T.chords.length), inB = pos >= 8, lead = inB ? T.lead2 : T.lead;
      let at = t;
      T.melody[pos].forEach(([n, len], k) => {
        if (n != null) {
          // 긴 음 앞에 가끔 꾸밈음을 넣어 민요 맛을 낸다
          if (len >= 2 && k === 0 && rand() < 0.3) play(lead, at - 0.05, n + 2, 0.05, 0.55);
          play(lead, at, n, e * len * 0.92, k === 0 ? 1 : 0.86);
          if (cycle % 2 === 1 && !inB) play('accordion', at, n - 12, e * len * 0.9, 0.5); // 두 번째 돌 때는 아코디언이 겹친다
        }
        at += e * len;
      });
      if (pos % 8 === 7 && rand() < 0.7) hit('clink', t + e * (T.bar - 1), 1);
    }
    c.nextBar += e * T.bar; c.i++;
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
      verb = makeReverb(); begin(id, 0); cur.i = 0;
      while (cur.nextBar < seconds) scheduleBar(cur);
    },
    get timer() { return timer; },
  };
}
export const TRACK_IDS = Object.keys(TRACKS);
