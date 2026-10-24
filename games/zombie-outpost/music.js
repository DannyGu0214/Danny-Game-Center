// 배경음악: 파일 없이 Web Audio로 합성한다(게시 페이지는 외부 음원이 막히고, 라이선스·용량 걱정도 없다).
// 포스트 아포칼립스 분위기의 단순한 멜로디 7곡(단조 3곡 + 조금 희망적인 장조 4곡). 무작위로 한 곡을 골라 5분 동안 틀고,
// 다음 곡은 직전 곡을 빼고 무작위로 골라 4초 동안 겹쳐 넘어간다.
// 음표는 0.6초 앞까지 미리 예약한다(Web Audio 표준 예약 방식: setInterval로 깨어나 ctx.currentTime 기준으로 예약).

export const SEGMENT_S = 300; // 한 곡을 트는 시간(5분)
const FADE_S = 4;
const LOOKAHEAD_S = 0.6;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------- 악기(합성) ----------
function voice(ac, dest, t, end, peak, attack = 0.005) {
  const g = ac.createGain();
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
  // 낮게 깔리는 화음: 살짝 어긋난 톱니파 둘을 낮은 필터로 뭉갠다. 천천히 올라와 천천히 사라진다.
  pad(ac, dest, t, f, dur, vel) {
    const end = t + dur + 1.6, g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045 * vel, t + 1.3);
    g.gain.setValueAtTime(0.045 * vel, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    lp.connect(g); g.connect(dest);
    osc(ac, 'sawtooth', f, t, end, lp, -7); osc(ac, 'sawtooth', f, t, end, lp, 7);
  },
  // 기타처럼 뜯는 소리: 밝게 시작해 필터가 빨리 닫힌다
  pluck(ac, dest, t, f, dur, vel) {
    const end = t + Math.min(1.8, dur * 1.6 + 0.4), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(2800, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.35);
    lp.connect(voice(ac, dest, t, end, 0.16 * vel));
    osc(ac, 'sawtooth', f, t, end, lp); osc(ac, 'triangle', f * 2, t, end, lp);
  },
  // 피아노 비슷한 소리: 삼각파 + 2배음, 짧게 치고 길게 사라진다
  piano(ac, dest, t, f, dur, vel) {
    const end = t + Math.max(1.6, dur + 1.2), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    lp.connect(voice(ac, dest, t, end, 0.15 * vel, 0.006));
    osc(ac, 'triangle', f, t, end, lp);
    const h = ac.createGain(); h.gain.value = 0.25; h.connect(lp); osc(ac, 'sine', f * 2, t, end, h);
  },
  // 오르골: 사인파 + 어긋난 배음, 맑게 울린다
  bell(ac, dest, t, f, dur, vel) {
    const end = t + 1.8, g = voice(ac, dest, t, end, 0.07 * vel, 0.003);
    osc(ac, 'sine', f, t, end, g);
    const h = ac.createGain(); h.gain.value = 0.3; h.connect(g); osc(ac, 'sine', f * 2.76, t, end, h);
  },
  // 낡은 라디오: 사각파를 좁은 대역 필터로 걸러 작고 납작하게
  radio(ac, dest, t, f, dur, vel) {
    const end = t + dur * 0.95 + 0.15, bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.3;
    bp.connect(voice(ac, dest, t, end, 0.2 * vel, 0.01));
    osc(ac, 'square', f, t, end, bp);
  },
  // 휘파람: 사인파에 느린 비브라토, 부드럽게 올라온다
  whistle(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.25, g = voice(ac, dest, t, end, 0.09 * vel, 0.06);
    const o = osc(ac, 'sine', f, t, end, g);
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 5; lg.gain.value = f * 0.006;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end + 0.05);
    const h = ac.createGain(); h.gain.value = 0.12; h.connect(g); osc(ac, 'triangle', f * 2, t, end, h);
  },
  // 리드(하모니카 느낌): 살짝 어긋난 사각파 둘을 필터로 둥글게, 숨을 불어 넣듯 올라와 가볍게 떤다
  reed(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.15, lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.7;
    lp.connect(voice(ac, dest, t, end, 0.05 * vel, 0.05));
    const a = osc(ac, 'square', f, t, end, lp, -5), b = osc(ac, 'square', f, t, end, lp, 5);
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 5.5; lg.gain.value = f * 0.004;
    lfo.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency); lfo.start(t); lfo.stop(end + 0.05);
  },
  // 저음: 사인파 + 약한 삼각파
  bass(ac, dest, t, f, dur, vel) {
    const end = t + dur, g = voice(ac, dest, t, end, 0.12 * vel, 0.02);
    osc(ac, 'sine', f, t, end, g);
    const h = ac.createGain(); h.gain.value = 0.3; h.connect(g); osc(ac, 'triangle', f, t, end, h);
  },
};

// 잡음 층(바람·라디오 지직거림)
function noiseLayer(ac, dest, noiseBuf, t, dur, kind) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(), g = ac.createGain();
  if (kind === 'wind') {
    f.type = 'bandpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(720, t + dur / 2); f.frequency.linearRampToValueAtTime(420, t + dur); f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + dur / 2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  } else {
    f.type = 'highpass'; f.frequency.value = 3200;
    g.gain.setValueAtTime(0.012, t); g.gain.setValueAtTime(0.012, t + dur);
  }
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

// ---------- 곡 ----------
// 화음과 음표는 곡의 으뜸음(root, MIDI)에서 반음 단위로 적는다. 마디는 4박, 4마디 = 한 바퀴.
// melody: 바퀴마다 고르는 4마디 악구. [음, 박] 목록이고 음이 null이면 쉼표.
// gain: 곡끼리 크기를 맞추는 배율(40초 렌더 RMS가 0.0175~0.0184로 비슷하게).
export const TRACKS = [
  {
    name: '잿빛 들판', root: 50, bpm: 68, noise: 'wind', gain: 1,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], // Dm Bb F C
    melody: [
      [[[19, 1], [17, 0.5], [15, 0.5], [12, 2]], [[15, 1], [17, 1], [19, 2]], [[22, 1], [19, 1], [15, 2]], [[14, 1.5], [15, 0.5], [12, 2]]],
      [[[24, 2], [22, 1], [19, 1]], [[20, 1], [19, 1], [15, 2]], [[19, 1.5], [20, 0.5], [19, 1], [15, 1]], [[14, 2], [12, 2]]],
    ],
    // 바퀴 번호(0부터) % 4에 따라 층을 쌓는다: 0 화음만 → 1 저음 → 2·3 멜로디
    bar(play, i, chord, t, beat) {
      const cyc = Math.floor(i / 4) % 4;
      for (const n of chord) play('pad', t, n - 12, beat * 4, 0.9);
      if (cyc >= 1) { play('bass', t, chord[0] - 24, beat * 2, 0.9); play('bass', t + beat * 2, chord[0] - 24, beat * 2, 0.7); }
      return cyc >= 2 ? 'pluck' : null;
    },
  },
  {
    name: '녹슨 라디오', root: 57, bpm: 84, noise: 'crackle', gain: 1.9,
    chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], // Am G F E
    melody: [
      [[[12, 0.5], [15, 0.5], [19, 1], [17, 1], [15, 1]], [[14, 1], [12, 0.5], [14, 0.5], [10, 2]], [[12, 0.5], [8, 0.5], [12, 1], [15, 1], [12, 1]], [[11, 1.5], [12, 0.5], [11, 1], [7, 1]]],
      [[[19, 1], [null, 0.5], [19, 0.5], [17, 1], [15, 1]], [[17, 1.5], [14, 0.5], [10, 2]], [[15, 1], [12, 1], [8, 1], [12, 1]], [[11, 2], [7, 2]]],
    ],
    bar(play, i, chord, t, beat) {
      const cyc = Math.floor(i / 4) % 4;
      for (let b = 0; b < 4; b++) play('bass', t + beat * b, chord[0] - 12 - (b % 2 ? -7 : 0), beat * 0.9, b % 2 ? 0.45 : 0.7);
      if (cyc === 3) chord.concat(chord[0] + 12, chord[2], chord[1], chord[0] + 12, chord[2]).forEach((n, k) => play('bell', t + (beat / 2) * k, n + 24, beat / 2, 0.8));
      return cyc >= 1 ? 'radio' : null;
    },
  },
  {
    name: '마지막 불빛', root: 52, bpm: 58, noise: null, gain: 1.3,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], // Em C G D
    melody: [
      [[[19, 2], [17, 1], [15, 1]], [[15, 3], [12, 1]], [[14, 2], [15, 1], [17, 1]], [[14, 4]]],
      [[[22, 2], [19, 2]], [[20, 1], [19, 1], [15, 2]], [[19, 3], [17, 1]], [[15, 2], [14, 2]]],
    ],
    bar(play, i, chord, t, beat) {
      const cyc = Math.floor(i / 4) % 4, c = chord;
      [c[0], c[2], c[0] + 12, c[1] + 12, c[0] + 12, c[2], c[1] + 12, c[2]].forEach((n, k) => play('piano', t + (beat / 2) * k, n - 12, beat / 2, k % 4 ? 0.55 : 0.75));
      play('bass', t, c[0] - 24, beat * 4, 0.6);
      return cyc >= 2 ? 'piano' : null;
    },
  },
  // 여기부터 장조 2곡: 폐허 속에서도 하루를 버텨 낸 아침 같은, 조금 희망적인 톤
  {
    name: '새벽 정찰', root: 55, bpm: 76, noise: null, gain: 1.15,
    chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], // G D Em C
    melody: [
      [[[16, 1], [19, 1], [24, 2]], [[23, 1], [21, 0.5], [19, 0.5], [14, 2]], [[16, 1], [21, 1], [19, 1], [16, 1]], [[17, 1.5], [16, 0.5], [14, 2]]],
      [[[19, 1.5], [21, 0.5], [19, 1], [16, 1]], [[14, 1.5], [16, 0.5], [14, 2]], [[12, 1], [16, 1], [21, 2]], [[19, 2], [17, 1], [16, 1]]],
    ],
    // 0 화음 + 기타 아르페지오 → 1 저음 → 2·3 피아노 멜로디
    bar(play, i, chord, t, beat) {
      const cyc = Math.floor(i / 4) % 4, c = chord;
      for (const n of c) play('pad', t, n - 12, beat * 4, 0.6);
      [c[0], c[2], c[1] + 12, c[2], c[0] + 12, c[2], c[1] + 12, c[2]].forEach((n, k) => play('pluck', t + (beat / 2) * k, n, beat / 2, k % 4 ? 0.35 : 0.5));
      if (cyc >= 1) { play('bass', t, c[0] - 12, beat * 2, 0.8); play('bass', t + beat * 2, c[2] - 12, beat * 2, 0.6); }
      return cyc >= 2 ? 'piano' : null;
    },
  },
  {
    name: '첫 수확', root: 50, bpm: 88, noise: null, gain: 1.75,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], // D Bm G A
    melody: [
      [[[16, 1], [19, 1], [21, 1], [19, 1]], [[21, 1.5], [19, 0.5], [16, 2]], [[19, 1], [17, 1], [16, 1], [14, 1]], [[14, 3], [null, 1]]],
      [[[24, 2], [23, 1], [21, 1]], [[19, 1], [21, 1], [19, 1], [16, 1]], [[17, 1.5], [19, 0.5], [21, 1], [19, 1]], [[16, 1], [14, 1], [12, 2]]],
    ],
    // 0 저음 + 피아노 뒷박 → 1 오르골 반짝임 → 2·3 휘파람 멜로디
    bar(play, i, chord, t, beat) {
      const cyc = Math.floor(i / 4) % 4, c = chord, low = c[0] < -4 ? c[0] : c[0] - 12;
      play('bass', t, low, beat * 1.8, 0.85); play('bass', t + beat * 2, low + 7, beat * 1.8, 0.6);
      for (const b of [1, 3]) for (const n of c) play('piano', t + beat * b, n + 12, beat * 0.8, 0.32);
      if (cyc >= 1) { play('bell', t + beat * 2.5, c[2] + 24, beat / 2, 0.7); play('bell', t + beat * 3.5, c[1] + 24, beat / 2, 0.6); }
      return cyc >= 2 ? 'whistle' : null;
    },
  },
  {
    name: '등불 아래', root: 53, bpm: 66, noise: null, gain: 1.25,
    chords: [[0, 4, 7], [4, 7, 11], [5, 9, 12], [7, 11, 14]], // F Am B♭ C
    melody: [
      [[[12, 1], [16, 1], [19, 1], [16, 1]], [[16, 1.5], [14, 0.5], [16, 1], [19, 1]], [[21, 2], [19, 1], [17, 1]], [[16, 2], [14, 2]]],
      [[[19, 1], [21, 1], [24, 2]], [[23, 1.5], [21, 0.5], [19, 2]], [[17, 1], [19, 1], [21, 1], [17, 1]], [[19, 2], [14, 1], [16, 1]]],
    ],
    // 0 화음 + 피아노 분산화음 → 1 저음 + 오르골 멜로디(자장가처럼)
    bar(play, i, chord, t, beat) {
      const cyc = Math.floor(i / 4) % 4, c = chord;
      for (const n of c) play('pad', t, n - 12, beat * 4, 0.7);
      [c[0], c[1], c[2], c[1]].forEach((n, k) => play('piano', t + beat * k, n, beat, k ? 0.3 : 0.42));
      if (cyc >= 1) play('bass', t, c[0] - 12, beat * 3.6, 0.75);
      return cyc >= 1 ? 'bell' : null;
    },
  },
  {
    name: '모닥불 노래', root: 57, bpm: 84, noise: null, gain: 1.5,
    chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [-5, -1, 2]], // A D F♯m E
    melody: [
      [[[16, 1], [19, 1], [19, 1], [21, 1]], [[21, 1.5], [19, 0.5], [17, 2]], [[16, 1], [14, 1], [12, 1], [16, 1]], [[14, 3], [null, 1]]],
      [[[12, 1], [16, 1], [19, 2]], [[21, 1], [24, 1], [21, 1], [17, 1]], [[19, 1.5], [16, 0.5], [14, 1], [12, 1]], [[11, 2], [12, 2]]],
    ],
    // 0 기타 스트럼 + 저음 → 2·3 하모니카 멜로디(모닥불가에서 부르는 노래)
    bar(play, i, chord, t, beat) {
      const cyc = Math.floor(i / 4) % 4, c = chord;
      for (const [b, v] of [[0, 0.42], [1.5, 0.3], [2, 0.36], [3, 0.3]]) c.concat(c[0] + 12).forEach((n, k) => play('pluck', t + beat * b + k * 0.025, n, beat * 0.9, v)); // 아래에서 위로 긁는 스트럼
      play('bass', t, c[0] - 12, beat * 1.8, 0.8); play('bass', t + beat * 2, c[2] - 12, beat * 1.8, 0.6);
      return cyc >= 2 ? 'reed' : null;
    },
  },
];

// rand: 곡 고르기·사람 손맛(셈여림·박자 흔들림) 난수. segment: 한 곡 길이(초).
export function createMusic({ segment = SEGMENT_S, volume = 0.34, rand = Math.random } = {}) {
  let ac = null, bus = null, verb = null, noiseBuf = null, timer = null;
  let on = true, paused = false, cur = null, history = [], user = 1; // user: 메뉴의 음악 음량(0~1)

  // 리버브: 잡음에 지수 감쇠를 입힌 2.6초 임펄스(넓은 폐허 느낌)
  function makeReverb() {
    const len = Math.floor(ac.sampleRate * 2.6), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
    const c = ac.createConvolver(); c.buffer = buf;
    const wet = ac.createGain(); wet.gain.value = 0.32;
    c.connect(wet); wet.connect(bus);
    return c;
  }
  function pick() {
    const choices = TRACKS.map((_, k) => k).filter((k) => k !== cur?.k);
    return choices[Math.floor(rand() * choices.length)];
  }
  // 한 곡 시작: 곡마다 자기 볼륨 노드(겹쳐 넘어가기용)를 가진다
  function begin(k, t) {
    const T = TRACKS[k], g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(T.gain, t + FADE_S);
    g.connect(bus); g.connect(verb);
    cur = { k, T, g, start: t, nextBar: t + 0.05, i: 0, beat: 60 / T.bpm, noiseUntil: t };
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
    const lead = T.bar(play(c.g), i, chord, t, beat);
    if (lead) {
      const phrase = T.melody[Math.floor(i / 4) % 2][i % 4];
      let at = t;
      for (const [n, b] of phrase) { if (n != null && !(Math.floor(i / 16) > 0 && rand() < 0.08)) play(c.g)(lead, at, n, beat * b, 0.95); at += beat * b; }
    }
    c.nextBar += beat * 4; c.i++;
  }
  // until 시각까지 음표를 예약한다. 5분이 지나면 다음 곡으로 겹쳐 넘어간다.
  function scheduleUntil(until) {
    if (!cur) begin(pick(), ac.currentTime + 0.1);
    // 멈췄다 돌아오면(소리 끔·화면 숨김·컨텍스트 정지) 밀린 음표를 몰아 치지 않고 지금부터 이어 간다. 멈춘 시간은 5분에 셈하지 않는다.
    const now = ac.currentTime;
    if (cur.nextBar < now) { const gap = now + 0.05 - cur.nextBar; cur.start += gap; cur.nextBar += gap; cur.noiseUntil = Math.max(cur.noiseUntil, cur.nextBar); }
    while (cur.nextBar < until) {
      if (cur.nextBar - cur.start >= segment) {
        const old = cur, t = cur.nextBar;
        old.g.gain.setValueAtTime(old.T.gain, t); old.g.gain.exponentialRampToValueAtTime(0.0001, t + FADE_S);
        setTimeout(() => old.g.disconnect(), (t - ac.currentTime + FADE_S + 2) * 1000);
        begin(pick(), t);
      }
      if (cur.T.noise && cur.noiseUntil < cur.nextBar + 8) { noiseLayer(ac, cur.g, noiseBuf, cur.noiseUntil, 8, cur.T.noise); cur.noiseUntil += 8; }
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
    // 첫 터치 뒤 효과음과 같은 AudioContext로 시작한다(모바일 자동재생 정책)
    start(ctx) {
      if (ac || !ctx) return;
      ac = ctx;
      bus = ac.createGain(); bus.gain.value = 0.0001; bus.connect(ac.destination);
      verb = makeReverb();
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      setLevel();
      timer = setInterval(tick, 50);
      tick();
    },
    setOn(v) { on = !!v; setLevel(); },
    setVolume(v) { user = Math.max(0, Math.min(1, v)); setLevel(); },
    // 화면이 숨으면 멈추고, 돌아오면 이어서
    pause() { paused = true; setLevel(); },
    resume() { paused = false; setLevel(); },
    get current() { return cur?.T.name ?? null; },
    get history() { return history.slice(); },
    get bus() { return bus; },
    // 미리듣기·검증용: 오프라인 컨텍스트에 한 곡을 seconds만큼 통째로 예약한다
    renderInto(ctx, k, seconds) {
      ac = ctx; bus = ac.createGain(); bus.gain.value = volume; bus.connect(ac.destination);
      verb = makeReverb();
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      begin(k, 0);
      cur.i = 4; // 첫 바퀴(화음만)를 건너뛰어 멜로디가 빨리 나오게
      while (cur.nextBar < seconds) {
        if (cur.T.noise && cur.noiseUntil < cur.nextBar + 8) { noiseLayer(ac, cur.g, noiseBuf, cur.noiseUntil, 8, cur.T.noise); cur.noiseUntil += 8; }
        scheduleBar(cur);
      }
    },
  };
}
