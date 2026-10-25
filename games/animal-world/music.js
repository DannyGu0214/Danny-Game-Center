// 배경음악: 파일 없이 Web Audio로 합성한다(Zombie Outpost music.js와 같은 예약 방식).
// 초원의 평화로운 장조 5곡. 악기 구성을 같게 맞춰(따뜻한 패드 · 칼림바 · 플루트/피아노/오르골 · 부드러운 저음 · 셰이커 · 산들바람 · 새소리)
// 곡이 바뀌어도 분위기가 이어진다. 무작위로 한 곡을 골라 3분 동안 틀고, 다음 곡은 직전 곡을 빼고 골라 4초 동안 겹쳐 넘어간다.
// 음표는 0.6초 앞까지 미리 예약한다(setInterval로 깨어나 ctx.currentTime 기준으로 예약).

export const SEGMENT_S = 180; // 한 곡을 트는 시간(3분)
const FADE_S = 4;
const LOOKAHEAD_S = 0.6;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------- 악기(합성) ----------
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
  // 따뜻한 패드: 살짝 어긋난 삼각파 둘을 낮은 필터로 감싸 천천히 올라오고 천천히 사라진다
  pad(ac, dest, t, f, dur, vel) {
    const end = t + dur + 1.8, g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
    g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 1.2);
    g.gain.setValueAtTime(0.05 * vel, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    lp.connect(g); g.connect(dest);
    osc(ac, 'triangle', f, t, end, lp, -6); osc(ac, 'triangle', f, t, end, lp, 6);
  },
  // 칼림바: 사인파에 빨리 사라지는 높은 배음, 톡 치고 맑게 울린다
  kalimba(ac, dest, t, f, dur, vel) {
    const end = t + 1.4, g = voice(ac, dest, t, end, 0.13 * vel, 0.003);
    osc(ac, 'sine', f, t, end, g);
    const h = voice(ac, dest, t, t + 0.18, 0.04 * vel, 0.002); osc(ac, 'sine', f * 5.9, t, t + 0.18, h);
  },
  // 플루트: 사인파에 느린 비브라토, 숨을 불어 넣듯 부드럽게 올라온다
  flute(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.3, g = voice(ac, dest, t, end, 0.075 * vel, 0.08);
    const o = osc(ac, 'sine', f, t, end, g);
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 4.8; lg.gain.value = f * 0.005;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + 0.2); lfo.stop(end + 0.05);
    const h = ac.createGain(); h.gain.value = 0.1; h.connect(g); osc(ac, 'triangle', f * 2, t, end, h);
  },
  // 피아노 비슷한 소리: 삼각파 + 2배음, 짧게 치고 길게 사라진다
  piano(ac, dest, t, f, dur, vel) {
    const end = t + Math.max(1.6, dur + 1.2), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    lp.connect(voice(ac, dest, t, end, 0.13 * vel, 0.006));
    osc(ac, 'triangle', f, t, end, lp);
    const h = ac.createGain(); h.gain.value = 0.22; h.connect(lp); osc(ac, 'sine', f * 2, t, end, h);
  },
  // 오르골: 사인파 + 어긋난 배음
  bell(ac, dest, t, f, dur, vel) {
    const end = t + 1.8, g = voice(ac, dest, t, end, 0.065 * vel, 0.003);
    osc(ac, 'sine', f, t, end, g);
    const h = ac.createGain(); h.gain.value = 0.28; h.connect(g); osc(ac, 'sine', f * 2.76, t, end, h);
  },
  // 저음: 사인파 + 약한 삼각파, 둥글게
  bass(ac, dest, t, f, dur, vel) {
    const end = t + dur, g = voice(ac, dest, t, end, 0.1 * vel, 0.03);
    osc(ac, 'sine', f, t, end, g);
    const h = ac.createGain(); h.gain.value = 0.2; h.connect(g); osc(ac, 'triangle', f, t, end, h);
  },
};
// 셰이커: 아주 짧은 높은 잡음
function shaker(ac, dest, noiseBuf, t, vel) {
  const src = ac.createBufferSource(), hp = ac.createBiquadFilter();
  src.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 6500;
  src.connect(hp); hp.connect(voice(ac, dest, t, t + 0.06, 0.02 * vel, 0.004));
  src.start(t, Math.random() * 1.5); src.stop(t + 0.08);
}
// 산들바람: 대역 잡음이 천천히 불었다 잦아든다
function breeze(ac, dest, noiseBuf, t, dur) {
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true;
  f.type = 'bandpass'; f.Q.value = 0.7;
  f.frequency.setValueAtTime(420, t); f.frequency.linearRampToValueAtTime(760, t + dur / 2); f.frequency.linearRampToValueAtTime(460, t + dur);
  g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + dur / 2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
// 새소리: 짧게 위로 미끄러지는 사인파 두세 번
function birds(ac, dest, t, rand) {
  const n = 2 + Math.floor(rand() * 3), base = 2300 + rand() * 1200;
  for (let i = 0; i < n; i++) {
    const at = t + i * (0.09 + rand() * 0.05), o = ac.createOscillator(), g = voice(ac, dest, at, at + 0.08, 0.012, 0.006);
    o.type = 'sine'; o.frequency.setValueAtTime(base * (0.9 + rand() * 0.2), at); o.frequency.exponentialRampToValueAtTime(base * 1.35, at + 0.07);
    o.connect(g); o.start(at); o.stop(at + 0.1);
  }
}

// ---------- 곡 ----------
// 화음과 음표는 곡의 으뜸음(root, MIDI)에서 반음 단위로 적는다. 마디는 4박, 4마디 = 한 바퀴.
// melody: 바퀴마다 번갈아 쓰는 4마디 악구 둘. [음, 박] 목록이고 음이 null이면 쉼표.
// 모든 곡이 같은 짜임이다: 0바퀴 패드+칼림바 분산화음 → 1바퀴 +저음·셰이커 → 2·3바퀴 +멜로디.
const I = [0, 4, 7], ii = [2, 5, 9], iii = [4, 7, 11], IV = [-7, -3, 0], V = [-5, -1, 2], vi = [-3, 0, 4];
function calm(lead, arp) {
  return function bar(play, i, chord, t, beat, shake) {
    const cyc = Math.floor(i / 4) % 4;
    for (const n of chord) play('pad', t, n - 12, beat * 4, 0.85);
    // 칼림바 분산화음(박자 모양은 곡마다 조금 다르게)
    arp.forEach(([b, k]) => play('kalimba', t + beat * b, chord[k % 3] + (k >= 3 ? 12 : 0), beat, 0.55));
    if (cyc >= 1) {
      play('bass', t, chord[0] - 24, beat * 2, 0.85); play('bass', t + beat * 2, chord[2] - 24, beat * 2, 0.6);
      for (const b of [0.5, 1.5, 2.5, 3.5]) shake(t + beat * b, b === 1.5 || b === 3.5 ? 0.9 : 0.6);
    }
    return cyc >= 2 ? lead : null;
  };
}
export const TRACKS = [
  {
    name: '아침 이슬', root: 60, bpm: 76, chords: [I, vi, IV, V],
    melody: [
      [[[16, 1], [19, 1], [21, 0.5], [19, 0.5], [16, 1]], [[12, 1], [16, 1], [21, 2]], [[21, 1], [19, 0.5], [16, 0.5], [14, 1], [12, 1]], [[14, 1.5], [16, 0.5], [14, 2]]],
      [[[24, 1], [21, 1], [19, 2]], [[16, 1], [19, 1], [21, 1], [19, 1]], [[17, 1], [16, 1], [14, 2]], [[14, 1], [11, 1], [12, 2]]],
    ],
    bar: calm('kalimba', [[0, 0], [1, 1], [2, 2], [3, 1]]),
  },
  {
    name: '느긋한 초원', root: 65, bpm: 72, chords: [I, IV, I, V],
    melody: [
      [[[12, 2], [16, 1], [19, 1]], [[21, 2], [19, 2]], [[16, 1], [14, 1], [12, 2]], [[14, 3], [null, 1]]],
      [[[19, 1], [21, 1], [24, 2]], [[21, 1], [19, 1], [17, 1], [16, 1]], [[16, 2], [19, 1], [16, 1]], [[12, 3], [null, 1]]],
    ],
    bar: calm('flute', [[0, 0], [1.5, 2], [2, 1], [3, 3]]),
  },
  {
    name: '기린의 산책', root: 55, bpm: 84, chords: [I, V, vi, IV],
    melody: [
      [[[12, 0.5], [14, 0.5], [16, 1], [19, 1], [16, 1]], [[14, 1], [11, 1], [14, 2]], [[16, 0.5], [19, 0.5], [21, 1], [19, 1], [16, 1]], [[12, 1], [14, 1], [12, 2]]],
      [[[19, 1], [19, 0.5], [21, 0.5], [24, 2]], [[23, 1], [21, 1], [19, 2]], [[21, 1], [19, 1], [16, 1], [19, 1]], [[17, 1], [16, 1], [12, 2]]],
    ],
    bar: calm('piano', [[0, 0], [0.5, 1], [1, 2], [2, 0], [2.5, 1], [3, 2]]),
  },
  {
    name: '햇살 낮잠', root: 62, bpm: 68, chords: [IV, I, ii, V],
    melody: [
      [[[21, 1.5], [19, 0.5], [14, 2]], [[16, 1], [19, 1], [24, 2]], [[21, 1], [19, 1], [16, 1], [14, 1]], [[16, 1], [14, 1], [19, 2]]],
      [[[24, 1], [21, 1], [19, 1], [16, 1]], [[14, 1], [16, 1], [12, 2]], [[14, 1.5], [16, 0.5], [21, 2]], [[19, 3], [null, 1]]],
    ],
    bar: calm('bell', [[0, 0], [1, 2], [2, 4], [3, 2]]),
  },
  {
    name: '노을 바람', root: 58, bpm: 74, chords: [I, IV, vi, V],
    melody: [
      [[[19, 1], [21, 1], [24, 1], [21, 1]], [[19, 2], [17, 1], [16, 1]], [[16, 1], [14, 1], [12, 1], [14, 1]], [[14, 2], [11, 1], [14, 1]]],
      [[[24, 2], [26, 1], [24, 1]], [[21, 1], [19, 1], [17, 2]], [[16, 1], [19, 1], [21, 2]], [[19, 3], [null, 1]]],
    ],
    bar: calm('flute', [[0, 0], [1, 1], [1.5, 2], [2.5, 1], [3, 3]]),
  },
];

// rand: 곡 고르기·사람 손맛(셈여림·박자 흔들림) 난수. segment: 한 곡 길이(초).
export function createMusic({ segment = SEGMENT_S, volume = 0.3, rand = Math.random } = {}) {
  let ac = null, bus = null, verb = null, noiseBuf = null, timer = null;
  let on = true, paused = false, cur = null, history = [], user = 1, birdsOn = true;

  // 리버브: 잡음에 지수 감쇠를 입힌 2.2초 임펄스(탁 트인 들판)
  function makeReverb() {
    const len = Math.floor(ac.sampleRate * 2.2), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    const c = ac.createConvolver(); c.buffer = buf;
    const wet = ac.createGain(); wet.gain.value = 0.28;
    c.connect(wet); wet.connect(bus);
    return c;
  }
  function makeNoise() {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function pick() {
    const choices = TRACKS.map((_, k) => k).filter((k) => k !== cur?.k);
    return choices[Math.floor(rand() * choices.length)];
  }
  function begin(k, t) {
    const T = TRACKS[k], g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + FADE_S);
    g.connect(bus); g.connect(verb);
    cur = { k, T, g, start: t, nextBar: t + 0.05, i: 0, beat: 60 / T.bpm, ambUntil: t };
    history.push(T.name);
  }
  function play(dest) {
    return (inst, t, semis, dur, vel) => {
      if (semis == null) return;
      INST[inst](ac, dest, t + (rand() - 0.5) * 0.02, mtof(cur.T.root + semis), dur, vel * (0.9 + rand() * 0.2));
    };
  }
  function scheduleBar(c) {
    const { T, i, nextBar: t, beat } = c, chord = T.chords[i % 4];
    const lead = T.bar(play(c.g), i, chord, t, beat, (at, v) => shaker(ac, c.g, noiseBuf, at, v));
    if (lead) {
      const phrase = T.melody[Math.floor(i / 4) % 2][i % 4];
      let at = t;
      for (const [n, b] of phrase) { if (n != null) play(c.g)(lead, at, n, beat * b, 0.95); at += beat * b; }
    }
    c.nextBar += beat * 4; c.i++;
  }
  // 바람은 8초씩, 새소리는 그 안에서 가끔(밤에는 끈다)
  function ambience(c) {
    breeze(ac, c.g, noiseBuf, c.ambUntil, 8);
    if (birdsOn && rand() < 0.7) birds(ac, c.g, c.ambUntil + rand() * 6, rand);
    c.ambUntil += 8;
  }
  function scheduleUntil(until) {
    if (!cur) begin(pick(), ac.currentTime + 0.1);
    // 멈췄다 돌아오면 밀린 음표를 몰아 치지 않고 지금부터 이어 간다. 멈춘 시간은 곡 길이에 셈하지 않는다.
    const now = ac.currentTime;
    if (cur.nextBar < now) { const gap = now + 0.05 - cur.nextBar; cur.start += gap; cur.nextBar += gap; cur.ambUntil = Math.max(cur.ambUntil, cur.nextBar); }
    while (cur.nextBar < until) {
      if (cur.nextBar - cur.start >= segment) {
        const old = cur, t = cur.nextBar;
        old.g.gain.setValueAtTime(1, t); old.g.gain.exponentialRampToValueAtTime(0.0001, t + FADE_S);
        setTimeout(() => old.g.disconnect(), (t - ac.currentTime + FADE_S + 2) * 1000);
        begin(pick(), t);
      }
      if (cur.ambUntil < cur.nextBar + 8) ambience(cur);
      scheduleBar(cur);
    }
  }
  function tick() {
    if (!ac || !on || paused || ac.state !== 'running') return;
    scheduleUntil(ac.currentTime + LOOKAHEAD_S);
  }
  function setLevel() {
    if (!bus) return;
    const t = ac.currentTime, v = on && !paused ? Math.max(0.0001, volume * user) : 0.0001;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t); bus.gain.exponentialRampToValueAtTime(v, t + 0.6);
  }
  return {
    // 첫 터치 뒤 동물 소리와 같은 AudioContext로 시작한다(모바일 자동재생 정책)
    start(ctx) {
      if (ac || !ctx) return;
      ac = ctx;
      bus = ac.createGain(); bus.gain.value = 0.0001; bus.connect(ac.destination);
      verb = makeReverb(); makeNoise();
      setLevel();
      timer = setInterval(tick, 50);
      tick();
    },
    setOn(v) { on = !!v; setLevel(); },
    setVolume(v) { user = Math.max(0, Math.min(1, v)); setLevel(); },
    setBirds(v) { birdsOn = !!v; },
    pause() { paused = true; setLevel(); },
    resume() { paused = false; setLevel(); },
    get current() { return cur?.T.name ?? null; },
    get history() { return history.slice(); },
    // 검증용: 오프라인 컨텍스트에 한 곡을 seconds만큼 통째로 예약한다
    renderInto(ctx, k, seconds) {
      ac = ctx; bus = ac.createGain(); bus.gain.value = volume; bus.connect(ac.destination);
      verb = makeReverb(); makeNoise();
      begin(k, 0);
      cur.i = 4; // 첫 바퀴를 건너뛰어 저음·멜로디가 빨리 나오게
      while (cur.nextBar < seconds) {
        if (cur.ambUntil < cur.nextBar + 8) ambience(cur);
        scheduleBar(cur);
      }
    },
  };
}
