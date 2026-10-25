import { VOICES as V_SEASIDE } from './sounds/seaside.js';
import { VOICES as V_DESERT } from './sounds/desert.js';
import { VOICES as V_ANTARCTIC } from './sounds/antarctic.js';
// 동물 소리: 종마다 2가지(call = 탭할 때·가끔 저절로, special = 특수 행동이 시작될 때). 파일 없이 Web Audio로 합성한다.
// 평화로운 분위기라 모두 짧고 작게 낸다. AudioContext는 첫 터치 때 만들어 배경음악과 함께 쓴다.

// 소리 하나: 주파수가 path([시간 비율, Hz] 목록)를 따라 미끄러지는 오실레이터. lp/bp로 거르고 vib로 떨게 할 수 있다
function tone(K, dest, t, o) {
  const { ac } = K, dur = o.dur, end = t + dur;
  const g = ac.createGain();
  g.gain.value = 0.0001; // 기본값 1이면 예약 직전 한 샘플이 크게 튄다(딸깍)
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.peak, t + (o.attack ?? 0.01));
  g.gain.setValueAtTime(o.peak, t + Math.max(o.attack ?? 0.01, dur * (o.hold ?? 0)));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(dest);
  let out = g;
  if (o.lp || o.bp) {
    const f = ac.createBiquadFilter();
    f.type = o.lp ? 'lowpass' : 'bandpass'; f.frequency.value = o.lp || o.bp; f.Q.value = o.q ?? (o.lp ? 0.7 : 1.2);
    f.connect(g); out = f;
  }
  const v = ac.createOscillator();
  v.type = o.type ?? 'sine';
  const path = o.path ?? [[0, o.f]];
  v.frequency.setValueAtTime(path[0][1], t);
  for (const [p, f] of path.slice(1)) v.frequency.exponentialRampToValueAtTime(f, t + dur * p);
  if (o.vib) {
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = o.vibRate ?? 6; lg.gain.value = o.vib;
    lfo.connect(lg); lg.connect(v.frequency); lfo.start(t); lfo.stop(end + 0.05);
  }
  v.connect(out); v.start(t); v.stop(end + 0.05);
}
// 잡음 하나: 필터(type·f, to로 미끄러짐)로 거른 짧은 잡음
function hiss(K, dest, t, o) {
  const { ac } = K, end = t + o.dur;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = K.noise;
  f.type = o.type ?? 'bandpass'; f.Q.value = o.q ?? 0.9;
  f.frequency.setValueAtTime(o.f, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, end);
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.peak, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(end + 0.05);
}

// 종마다 [call, special]
export const VOICES = {
  rabbit: {
    // 뒷발로 땅을 두 번 콩콩
    call(K, d, t) {
      for (const at of [0, 0.22]) { tone(K, d, t + at, { path: [[0, 120], [1, 48]], dur: 0.13, peak: 0.45, attack: 0.003 }); hiss(K, d, t + at, { type: 'lowpass', f: 500, dur: 0.05, peak: 0.08 }); }
    },
    // 깡충 뛰어오르는 "뾰옹" 두 번
    special(K, d, t) {
      tone(K, d, t, { type: 'triangle', path: [[0, 420], [0.5, 900], [1, 620]], dur: 0.22, peak: 0.16 });
      tone(K, d, t + 0.3, { type: 'triangle', path: [[0, 520], [0.5, 1100], [1, 760]], dur: 0.22, peak: 0.13 });
    },
  },
  meerkat: {
    // 재잘거림: 짧고 높은 소리 다섯 번
    call(K, d, t) {
      for (let i = 0; i < 5; i++) tone(K, d, t + i * 0.075, { type: 'square', lp: 3200, path: [[0, 1850 + (i % 2) * 260], [1, 2450]], dur: 0.045, peak: 0.12, attack: 0.004 });
    },
    // 보초의 경계 신호 "삐삐 · 삐삐"
    special(K, d, t) {
      for (const at of [0, 0.2, 0.6, 0.8]) tone(K, d, t + at, { path: [[0, 1500], [1, 1280]], dur: 0.13, peak: 0.12, attack: 0.006 });
    },
  },
  gazelle: {
    // 코로 "흥" 하는 짧은 콧김
    call(K, d, t) {
      hiss(K, d, t, { f: 1100, q: 0.8, dur: 0.2, peak: 0.35, attack: 0.008 });
      tone(K, d, t, { type: 'sawtooth', lp: 500, path: [[0, 140], [1, 90]], dur: 0.15, peak: 0.05 });
    },
    // 통통 뛰는 발굽 소리 네 번
    special(K, d, t) {
      for (let i = 0; i < 4; i++) {
        hiss(K, d, t + i * 0.3, { type: 'highpass', f: 2600, dur: 0.035, peak: 0.16 });
        tone(K, d, t + i * 0.3, { path: [[0, 190], [1, 80]], dur: 0.07, peak: 0.12, attack: 0.002 });
      }
    },
  },
  zebra: {
    // 짖는 듯한 "꽉-하 꽉"
    call(K, d, t) {
      for (let i = 0; i < 3; i++) {
        tone(K, d, t + i * 0.24, { type: 'sawtooth', bp: 1000, q: 1.1, path: [[0, 430 - i * 20], [1, 300]], dur: 0.15, peak: 0.22, attack: 0.01 });
        hiss(K, d, t + i * 0.24, { f: 1500, dur: 0.12, peak: 0.04 });
      }
    },
    // 흙바닥에 뒹구는 소리 + 마지막 콧김
    special(K, d, t) {
      hiss(K, d, t, { type: 'lowpass', f: 320, to: 650, dur: 1.0, peak: 0.35, attack: 0.25 });
      hiss(K, d, t + 0.9, { f: 1000, dur: 0.18, peak: 0.3, attack: 0.008 });
    },
  },
  ostrich: {
    // 낮게 울리는 "부웅 · 부웅"
    call(K, d, t) {
      for (const at of [0, 0.75]) {
        tone(K, d, t + at, { path: [[0, 125], [1, 95]], dur: 0.55, peak: 0.3, attack: 0.12, hold: 0.5 });
        tone(K, d, t + at, { type: 'triangle', path: [[0, 250], [1, 190]], dur: 0.5, peak: 0.05, attack: 0.12 });
      }
    },
    // 날개를 퍼덕이는 소리
    special(K, d, t) {
      for (let i = 0; i < 10; i++) hiss(K, d, t + i * 0.065, { f: 650 + (i % 2) * 150, q: 0.7, dur: 0.05, peak: 0.3, attack: 0.004 });
      hiss(K, d, t + 0.7, { type: 'highpass', f: 2500, dur: 0.3, peak: 0.04, attack: 0.05 });
    },
  },
  lion: {
    // 낮은 "흐응 · 흐응"
    call(K, d, t) {
      for (const at of [0, 0.55]) {
        tone(K, d, t + at, { type: 'sawtooth', lp: 380, path: [[0, 100], [1, 72]], dur: 0.38, peak: 0.2, attack: 0.03 });
        hiss(K, d, t + at, { type: 'lowpass', f: 300, dur: 0.35, peak: 0.06, attack: 0.03 });
      }
    },
    // 하품하며 포효(평화로운 모드라 너무 크지 않게)
    special(K, d, t) {
      tone(K, d, t, { type: 'sawtooth', lp: 650, path: [[0, 120], [0.35, 210], [1, 95]], dur: 1.5, peak: 0.18, attack: 0.15, hold: 0.4, vib: 6 });
      tone(K, d, t, { type: 'sawtooth', lp: 650, path: [[0, 180], [0.35, 300], [1, 140]], dur: 1.4, peak: 0.06, attack: 0.15 });
      hiss(K, d, t, { f: 520, q: 0.6, dur: 1.4, peak: 0.08, attack: 0.2 });
    },
  },
  giraffe: {
    // 기린의 낮은 허밍(작은 스피커에서도 들리게 높은 배음을 조금 섞는다)
    call(K, d, t) {
      tone(K, d, t, { f: 92, dur: 1.3, peak: 0.26, attack: 0.25, hold: 0.6 });
      tone(K, d, t, { f: 184, dur: 1.3, peak: 0.07, attack: 0.25, hold: 0.6 });
      tone(K, d, t, { type: 'triangle', f: 368, dur: 1.2, peak: 0.025, attack: 0.3, hold: 0.5 });
    },
    // 높은 가지의 잎 바스락 + 우물우물
    special(K, d, t) {
      for (let i = 0; i < 6; i++) hiss(K, d, t + i * 0.08, { type: 'highpass', f: 3000, dur: 0.06, peak: 0.06 });
      for (const at of [0.5, 0.75, 1.0]) hiss(K, d, t + at, { type: 'lowpass', f: 900, dur: 0.08, peak: 0.07, attack: 0.006 });
    },
  },
  elephant: {
    // 코끼리 나팔 소리
    call(K, d, t) {
      tone(K, d, t, { type: 'sawtooth', bp: 1100, q: 0.9, path: [[0, 440], [0.25, 720], [0.8, 650], [1, 480]], dur: 0.95, peak: 0.17, attack: 0.04, hold: 0.6, vib: 12, vibRate: 7 });
      tone(K, d, t, { type: 'square', bp: 1500, path: [[0, 660], [0.25, 1080], [0.8, 975], [1, 720]], dur: 0.9, peak: 0.04, attack: 0.05 });
    },
    // 코로 물을 뿜는 소리 + 떨어지는 물방울
    special(K, d, t) {
      hiss(K, d, t, { type: 'highpass', f: 1800, to: 1200, dur: 0.9, peak: 0.14, attack: 0.15 });
      for (let i = 0; i < 8; i++) { const at = 0.4 + Math.random() * 0.7, f = 1500 + Math.random() * 1700; tone(K, d, t + at, { path: [[0, f], [1, f * 1.4]], dur: 0.04, peak: 0.04, attack: 0.003 }); }
    },
  },
};

Object.assign(VOICES, V_SEASIDE, V_DESERT, V_ANTARCTIC); // 다른 지역 동물 소리(sounds/<지역>.js). 그쪽은 K.tone·K.hiss로 소리를 만든다

export function createSound({ volume = 0.5 } = {}) {
  let ac = null, bus = null, K = null, on = true;
  return {
    // 첫 터치 때 부른다(모바일은 사용자 동작 안에서만 소리를 켤 수 있다)
    unlock() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        bus = ac.createGain(); bus.gain.value = volume; bus.connect(ac.destination);
        const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        K = { ac, noise, tone, hiss };
      }
      if (ac.state === 'suspended') ac.resume().catch(() => {});
    },
    get ctx() { return ac; },
    setOn(v) { on = !!v; },
    isOn: () => on,
    // kind: 'call' | 'special'. vol 0~1, pan -1(왼쪽)~1(오른쪽)
    play(sp, kind, { vol = 1, pan = 0 } = {}) {
      if (!ac || !on || ac.state !== 'running') return;
      const f = VOICES[sp]?.[kind];
      if (!f) return;
      const g = ac.createGain();
      g.gain.value = vol;
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(bus); } else g.connect(bus);
      f(K, g, ac.currentTime + 0.02);
      setTimeout(() => g.disconnect(), 2500);
    },
    // 검증용: 오프라인 컨텍스트에 소리 하나를 예약한다
    renderInto(ctx, sp, kind) {
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const g = ctx.createGain(); g.gain.value = volume; g.connect(ctx.destination);
      VOICES[sp][kind]({ ac: ctx, noise, tone, hiss }, g, 0.02);
    },
  };
}
