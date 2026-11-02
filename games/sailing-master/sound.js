// 물소리·바람 소리와 짧은 효과음. 파일 없이 Web Audio로 합성한다.
// 잡음 하나를 여러 필터로 나눠 쓴다: 파도(낮은 저역 + 느린 숨결), 찰랑임(중역 + 불규칙한 흔들림), 바람(대역 필터 + 풍속), 뱃머리 물살(고역 + 배 속도).

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
  const windF = filter('bandpass', 620, 0.65), windG = gain(0.12);
  loop(1, 2.1).connect(windF); windF.connect(windG); windG.connect(dest);
  lfo(0.23, 90, windF.frequency);

  // 뱃머리 물살: 배가 빠를수록 쉬익
  const washF = filter('bandpass', 1750, 0.55), washG = gain(0);
  loop(1.3, 0.6).connect(washF); washF.connect(washG); washG.connect(dest);

  return {
    set(windSpeed, boatSpeed) {
      const t = ac.currentTime, w = Math.min(1.4, windSpeed / 10), b = Math.min(1, boatSpeed / 7.5);
      swellG.gain.setTargetAtTime(0.28 + w * 0.1, t, 1.2);
      windG.gain.setTargetAtTime(0.05 + w * w * 0.1, t, 0.8);
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
  sail(ac, noise, d, t) { burst(ac, noise, d, t, { f: 1500, to: 3200, q: 0.8, dur: 0.5, peak: 0.08, attack: 0.1 }); },
};

export function createSound() {
  let ac = null, master = null, noise = null, amb = null, on = true, fxBus = null;
  return {
    get on() { return on; },
    unlock() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = on ? 0.85 : 0; master.connect(ac.destination);
      fxBus = ac.createGain(); fxBus.gain.value = 2.2; fxBus.connect(master); // 효과음이 파도 소리(RMS 0.06~0.08)에 묻히지 않게
      noise = makeNoise(ac);
      amb = buildAmbient(ac, master, noise);
    },
    setOn(v) { on = v; if (ac) master.gain.setTargetAtTime(v ? 0.85 : 0, ac.currentTime, 0.1); },
    ambient(windSpeed, boatSpeed) { if (amb) amb.set(windSpeed, boatSpeed); },
    play(name) { if (ac && on && FX[name]) FX[name](ac, noise, fxBus, ac.currentTime + 0.005); },
    pause() { if (ac) ac.suspend(); },
    resume() { if (ac) ac.resume(); },
  };
}
