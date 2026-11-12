// 물소리·바람 소리와 짧은 효과음. 파일 없이 Web Audio로 합성한다.
// 잡음 하나를 여러 필터로 나눠 쓴다: 파도(낮은 저역 + 느린 숨결), 찰랑임(중역 + 불규칙한 흔들림), 바람(대역 필터 + 풍속), 뱃머리 물살(고역 + 배 속도).

import { levelOf } from './music.js';

export function makeNoise(ac, sec = 4) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * sec), ac.sampleRate), d = buf.getChannelData(0);
  // 분홍 잡음에 가깝게 부드럽게 만든다(날카로운 치찰음을 줄인다)
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return buf;
}

// 계속 나는 소리들. ac는 실시간·오프라인 어느 쪽이든 된다(tools/sound-check.html에서 렌더해 잰다)
export function buildAmbient(ac, dest, noise) {
  const loop = (rate = 1, offset = 0) => {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = rate; s.start(ac.currentTime, offset);
    return s;
  };
  const filter = (type, f, q = 0.7) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const gain = (v) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const lfo = (hz, amount, target) => { const o = ac.createOscillator(), g = gain(amount); o.frequency.value = hz; o.connect(g); g.connect(target); o.start(); return o; };

  // 파도: 먼 저역. 느린 숨결 두 개가 어긋나 같은 패턴이 반복되지 않게 들린다
  const swellF = filter('lowpass', 420), swellG = gain(0.34), swellB = gain(0);
  loop(0.9).connect(swellF); swellF.connect(swellB); swellB.connect(swellG); swellG.connect(dest);
  swellB.gain.value = 0.62;
  lfo(0.11, 0.26, swellB.gain); lfo(0.067, 0.14, swellB.gain); lfo(0.05, 120, swellF.frequency);

  // 찰랑임: 뱃전에 닿는 중역
  const lapF = filter('bandpass', 760, 0.9), lapG = gain(0.16), lapB = gain(0.55);
  loop(1.13, 1.3).connect(lapF); lapF.connect(lapB); lapB.connect(lapG); lapG.connect(dest);
  lfo(0.43, 0.34, lapB.gain); lfo(0.29, 0.2, lapB.gain); lfo(0.17, 240, lapF.frequency);

  // 바람: 풍속이 세면 소리가 커지고 높아진다
  const windF = filter('bandpass', 620, 0.65), windG = gain(0.05);
  loop(1, 2.1).connect(windF); windF.connect(windG); windG.connect(dest);
  lfo(0.23, 90, windF.frequency);

  // 뱃머리 물살: 배가 빠를수록 쉬익
  const washF = filter('bandpass', 1750, 0.55), washG = gain(0);
  loop(1.3, 0.6).connect(washF); washF.connect(washG); washG.connect(dest);

  return {
    set(windSpeed, boatSpeed) {
      const t = ac.currentTime, w = Math.min(1.4, windSpeed / 10), b = Math.min(1, boatSpeed / 7.5);
      swellG.gain.setTargetAtTime(0.28 + w * 0.1, t, 1.2);
      windG.gain.setTargetAtTime(0.02 + w * w * 0.045, t, 0.8); // 2026-11-02 대니님 요청으로 줄임(노 소리는 그대로)
      windF.frequency.setTargetAtTime(460 + w * 420, t, 0.8);
      washG.gain.setTargetAtTime(b * b * 0.2, t, 0.5);
      lapG.gain.setTargetAtTime(0.13 + b * 0.09, t, 0.6);
    },
  };
}

// 짧은 소리들
function burst(ac, noise, dest, t, { type = 'bandpass', f = 1000, to, q = 1, dur = 0.2, peak = 0.2, attack = 0.01 }) {
  const s = ac.createBufferSource(), n = ac.createBiquadFilter(), g = ac.createGain(), end = t + dur;
  s.buffer = noise; n.type = type; n.Q.value = q;
  n.frequency.setValueAtTime(f, t);
  if (to) n.frequency.exponentialRampToValueAtTime(to, end);
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  s.connect(n); n.connect(g); g.connect(dest);
  s.start(t, Math.random() * 3); s.stop(end + 0.05);
}
function tone(ac, dest, t, { f, to, type = 'sine', dur = 0.3, peak = 0.1, attack = 0.005 }) {
  const o = ac.createOscillator(), g = ac.createGain(), end = t + dur;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, end);
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  o.connect(g); g.connect(dest); o.start(t); o.stop(end + 0.05);
}

export const FX = {
  // 돛이 펄럭이는 소리: 짧은 잡음 조각 두세 번
  flap(ac, noise, d, t) { for (const [at, p] of [[0, 0.12], [0.11, 0.09], [0.24, 0.06]]) burst(ac, noise, d, t + at, { f: 900, to: 420, q: 0.8, dur: 0.1, peak: p }); },
  // 돛이 넘어가며 나는 묵직한 퍽 소리
  swing(ac, noise, d, t) { burst(ac, noise, d, t, { f: 500, to: 190, q: 0.7, dur: 0.32, peak: 0.26, attack: 0.02 }); tone(ac, d, t + 0.14, { f: 150, to: 92, dur: 0.16, peak: 0.1 }); },
  stroke(ac, noise, d, t) {
    tone(ac, d, t, { f: 220, to: 130, type: 'triangle', dur: 0.06, peak: 0.06 }); // 노걸이 쿵
    burst(ac, noise, d, t + 0.05, { f: 1300, to: 650, q: 0.8, dur: 0.34, peak: 0.13, attack: 0.03 }); // 물 가르기
    burst(ac, noise, d, t + 0.52, { f: 2300, to: 1500, q: 1.1, dur: 0.18, peak: 0.05 }); // 노가 떠오르며 물방울
  },
  creak(ac, _n, d, t) { tone(ac, d, t, { f: 170 + Math.random() * 90, to: 120, type: 'sawtooth', dur: 0.2, peak: 0.012, attack: 0.05 }); },
  ground(ac, noise, d, t) { tone(ac, d, t, { f: 90, to: 46, dur: 0.4, peak: 0.28 }); burst(ac, noise, d, t, { type: 'lowpass', f: 700, to: 200, dur: 0.46, peak: 0.2 }); },
  tap(ac, _n, d, t) { tone(ac, d, t, { f: 880, to: 840, dur: 0.22, peak: 0.05 }); tone(ac, d, t + 0.06, { f: 1320, to: 1280, dur: 0.3, peak: 0.028 }); },
  arrive(ac, _n, d, t) { for (const [at, f] of [[0, 659], [0.14, 784], [0.28, 988]]) tone(ac, d, t + at, { f, dur: 0.7, peak: 0.05 }); },
  pick(ac, noise, d, t) { burst(ac, noise, d, t, { f: 1500, to: 700, q: 0.8, dur: 0.16, peak: 0.1 }); tone(ac, d, t + 0.04, { f: 720, to: 980, dur: 0.14, peak: 0.05 }); },
  found(ac, _n, d, t) { for (const [at, f] of [[0, 523], [0.12, 659], [0.24, 784], [0.36, 1047]]) tone(ac, d, t + at, { f, type: 'triangle', dur: 0.8, peak: 0.055 }); },
  ach(ac, _n, d, t) { for (const [at, f] of [[0, 659], [0.1, 880], [0.2, 1175]]) tone(ac, d, t + at, { f, dur: 0.6, peak: 0.05 }); },
  record(ac, _n, d, t) { tone(ac, d, t, { f: 1175, dur: 0.3, peak: 0.04 }); tone(ac, d, t + 0.09, { f: 1568, dur: 0.4, peak: 0.03 }); },
  build(ac, noise, d, t) { for (const at of [0, 0.16, 0.32]) { tone(ac, d, t + at, { f: 180, to: 110, type: 'triangle', dur: 0.08, peak: 0.08 }); burst(ac, noise, d, t + at, { f: 2200, dur: 0.05, peak: 0.04 }); } },
  place(ac, noise, d, t) { tone(ac, d, t, { f: 210, to: 140, type: 'triangle', dur: 0.08, peak: 0.08 }); burst(ac, noise, d, t, { f: 1800, dur: 0.04, peak: 0.03 }); },
  dock(ac, _n, d, t) { for (const [at, f] of [[0, 880], [0.22, 880]]) { tone(ac, d, t + at, { f, dur: 0.9, peak: 0.045 }); tone(ac, d, t + at, { f: f * 2.76, dur: 0.4, peak: 0.012 }); } },
  gust(ac, noise, d, t) { burst(ac, noise, d, t, { f: 500, to: 1300, q: 0.5, dur: 2.2, peak: 0.13, attack: 0.9 }); tone(ac, d, t + 0.3, { f: 58, to: 38, dur: 1.5, peak: 0.1, attack: 0.1 }); },
  warn(ac, _n, d, t) { for (const at of [0, 0.3]) tone(ac, d, t + at, { f: 392, dur: 0.24, peak: 0.05 }); },
  disaster(ac, noise, d, t) { tone(ac, d, t, { f: 196, to: 98, type: 'triangle', dur: 1.4, peak: 0.12 }); burst(ac, noise, d, t, { type: 'lowpass', f: 900, to: 200, dur: 1.2, peak: 0.2 }); },
  sail(ac, noise, d, t) { burst(ac, noise, d, t, { f: 1500, to: 3200, q: 0.8, dur: 0.5, peak: 0.08, attack: 0.1 }); },
  // ── S4 선원·항구 소리(2026-11-12) ──
  // 망치질: 나무에 박는 못 소리. k < 1이면 멀리서(조선소 쪽) 작고 먹먹하게
  hammer(ac, noise, d, t, k = 1) {
    const far = k < 1, n = far ? 2 + Math.floor(Math.random() * 3) : 3, gap = far ? 0.42 : 0.2;
    for (let i = 0; i < n; i++) {
      const at = t + i * gap + Math.random() * 0.03, p = k * (i === n - 1 ? 1 : 0.8);
      tone(ac, d, at, { f: 330, to: 190, type: 'triangle', dur: 0.07, peak: 0.07 * p });
      burst(ac, noise, d, at, { f: far ? 1400 : 2600, q: 1.4, dur: 0.045, peak: 0.06 * p, attack: 0.002 });
    }
  },
  // 갑판장 호루라기(boatswain's call): 짧게 올라갔다 떨고 내려와요. 선원이 지시를 받아 돛을 바꿀 때
  pipe(ac, _n, d, t) {
    const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(), end = t + 0.62;
    o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(2150, t + 0.12); o.frequency.setValueAtTime(2150, t + 0.46); o.frequency.exponentialRampToValueAtTime(1600, end);
    lfo.frequency.value = 17; lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(45, t + 0.18); lg.gain.setValueAtTime(0, t + 0.44); lfo.connect(lg); lg.connect(o.frequency);
    g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 0.04); g.gain.setValueAtTime(0.022, end - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g); g.connect(d); o.start(t); lfo.start(t); o.stop(end + 0.05); lfo.stop(end + 0.05);
  },
  // 노래꾼의 흥얼거림: 지금 곡의 조(root·scale)에서 다섯 음 가락. 톱니파를 '오' 모음 두 대역으로 걸러 사람 목소리처럼
  sing(ac, _n, d, t, root = 62, scale = [0, 2, 4, 5, 7, 9, 11]) {
    const penta = scale.filter((x) => [0, 2, 4, 7, 9, 3, 10].includes(x)).slice(0, 5), out = ac.createGain();
    out.gain.value = 1; out.connect(d);
    const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.frequency.value = 480; f2.frequency.value = 820; f1.Q.value = 5; f2.Q.value = 6;
    const g2 = ac.createGain(); g2.gain.value = 0.5; f1.connect(out); f2.connect(g2); g2.connect(out);
    let at = t, step = Math.floor(Math.random() * penta.length);
    for (let i = 0; i < 5; i++) {
      step = Math.max(0, Math.min(penta.length - 1, step + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2)));
      const len = i === 4 ? 0.9 : 0.3 + Math.random() * 0.25, f = 440 * 2 ** ((root - 12 + (i === 4 ? 0 : penta[step]) - 69) / 12);
      const o = ac.createOscillator(), g = ac.createGain(), v = ac.createOscillator(), vg = ac.createGain(), end = at + len;
      o.type = 'sawtooth'; o.frequency.value = f; v.frequency.value = 5.2; vg.gain.value = f * 0.012; v.connect(vg); vg.connect(o.frequency);
      g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.05, at + 0.06); g.gain.setValueAtTime(0.05, end - 0.08); g.gain.linearRampToValueAtTime(0.0001, end);
      o.connect(g); g.connect(f1); g.connect(f2); o.start(at); v.start(at); o.stop(end + 0.05); v.stop(end + 0.05);
      at = end + 0.04;
    }
  },
};

// 소리 묶음 셋(2026-11-12 S4): 음악(music.js) · 효과음(fx) · 물·바람(amb). 슬라이더는 0~100, 기본은 지금 크기인 100
export const AUDIO_GROUPS = ['mus', 'fx', 'amb'];
const pct = (v, d = 100) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Math.round(Number(v)))) : d);
// 저장된 값 읽기. 예전 저장 { snd, mus }(켜고 끄기만)도 그대로 이어 받아요: snd가 꺼져 있었으면 효과음·물바람 둘 다 꺼짐
export function readAudioPrefs(raw) {
  const a = raw && typeof raw === 'object' ? raw : {}, vol = a.vol && typeof a.vol === 'object' ? a.vol : {};
  const was = (k, legacy) => (typeof a[k] === 'boolean' ? a[k] : legacy !== false);
  return { mus: { on: was('mus'), vol: pct(vol.mus) }, fx: { on: was('fx', a.snd), vol: pct(vol.fx) }, amb: { on: was('amb', a.snd), vol: pct(vol.amb) } };
}
// 저장할 값. 예전 버전이 읽어도 맞게 snd·mus도 같이 적어요
export function writeAudioPrefs(p) {
  return { v: 2, mus: !!p.mus.on, snd: !!(p.fx.on || p.amb.on), fx: !!p.fx.on, amb: !!p.amb.on, vol: { mus: pct(p.mus.vol), fx: pct(p.fx.vol), amb: pct(p.amb.vol) } };
}
export const audible = (g) => !!g && g.on && g.vol > 0;

const MASTER = 0.85, FX_GAIN = 2.2; // FX_GAIN: 효과음이 파도 소리(RMS 0.06~0.08)에 묻히지 않게
export function createSound() {
  // master(0.85) ← 효과음 묶음(2.2 × 슬라이더) + 물·바람 묶음(1 × 슬라이더). 슬라이더 100이 S4 전의 크기와 같아요
  let ac = null, master = null, noise = null, amb = null, fxBus = null, ambBus = null;
  const grp = { fx: { on: true, v: 1 }, amb: { on: true, v: 1 } };
  const target = (k) => (grp[k].on ? levelOf(grp[k].v) * (k === 'fx' ? FX_GAIN : 1) : 0);
  function level(k, quick) { const b = k === 'fx' ? fxBus : ambBus; if (b) b.gain.setTargetAtTime(target(k), ac.currentTime, quick ? 0.03 : 0.1); }
  return {
    get ac() { return ac; },
    get on() { return grp.fx.on || grp.amb.on; },
    isOn(k) { return grp[k].on; },
    volume(k) { return grp[k].v; },
    // ctx를 주면 그 컨텍스트(오프라인 측정용)에 붙어요
    unlock(ctx) {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = !ctx && (window.AudioContext || window.webkitAudioContext);
      if (!ctx && !AC) return;
      ac = ctx || new AC();
      master = ac.createGain(); master.gain.value = MASTER; master.connect(ac.destination);
      fxBus = ac.createGain(); fxBus.gain.value = target('fx'); fxBus.connect(master);
      ambBus = ac.createGain(); ambBus.gain.value = target('amb'); ambBus.connect(master);
      noise = makeNoise(ac);
      amb = buildAmbient(ac, ambBus, noise);
    },
    // 묶음 하나 켜고 끄기. 묶음을 안 주면 둘 다(예전 소리 단추)
    setOn(v, k) { for (const g of k ? [k] : ['fx', 'amb']) { grp[g].on = !!v; level(g); } },
    // 슬라이더(0~1). 끄는 동안 바로 들리게 빠르게 따라가요
    setVolume(k, v) { grp[k].v = Math.max(0, Math.min(1, Number(v) || 0)); level(k, true); },
    ambient(windSpeed, boatSpeed) { if (amb) amb.set(windSpeed, boatSpeed); },
    // at: 지금부터 몇 초 뒤(오프라인 측정에서 씀). 효과음이 0이면 소리 마디를 만들지도 않아요
    play(name, at = 0, ...args) { if (ac && target('fx') > 0 && FX[name]) FX[name](ac, noise, fxBus, ac.currentTime + 0.005 + at, ...args); },
    pause() { if (ac && ac.suspend) ac.suspend(); },
    resume() { if (ac && ac.resume) ac.resume(); },
  };
}
