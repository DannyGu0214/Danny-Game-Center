// desert 동물 소리. sound.js의 VOICES처럼 종마다 { call(K, d, t), special(K, d, t) }.
// 소리는 K.tone(음높이가 미끄러지는 발진기)과 K.hiss(거른 잡음)로만 만든다. 평화로운 분위기라 짧고 작게 낸다.
export const VOICES = {
  lizard: {
    // 쪼르르 작은 지저귐 두 번과 쉭 하는 숨소리
    call(K, d, t) {
      K.tone(K, d, t, { type: 'triangle', path: [[0, 3000], [1, 4200]], dur: 0.06, peak: 0.17, attack: 0.004 });
      K.tone(K, d, t + 0.1, { type: 'triangle', path: [[0, 3400], [1, 4700]], dur: 0.07, peak: 0.15, attack: 0.004 });
      K.hiss(K, d, t + 0.2, { type: 'highpass', f: 5200, dur: 0.18, peak: 0.06, attack: 0.03 });
    },
    // 바위 위 팔굽혀펴기: 앞발이 닿는 톡 소리를 박자 있게 (톡-톡 · 톡-톡 · 톡-톡)
    special(K, d, t) {
      for (let i = 0; i < 6; i++) {
        const at = Math.floor(i / 2) * 0.5 + (i % 2) * 0.17;
        K.tone(K, d, t + at, { path: [[0, 260], [1, 120]], dur: 0.07, peak: 0.2, attack: 0.002 });
        K.hiss(K, d, t + at, { type: 'lowpass', f: 900, dur: 0.035, peak: 0.1, attack: 0.002 });
      }
    },
  },
  jerboa: {
    // 높고 가는 찍찍 세 번
    call(K, d, t) {
      for (const [at, f] of [[0, 2700], [0.13, 3000], [0.33, 2500]]) K.tone(K, d, t + at, { path: [[0, f], [0.4, f * 1.35], [1, f * 1.1]], dur: 0.09, peak: 0.15, attack: 0.006, vib: 60, vibRate: 40 });
    },
    // 용수철처럼 튀어 오르는 "뾰옹" 세 번(점점 높게)
    special(K, d, t) {
      [0, 0.4, 0.8].forEach((at, i) => {
        const f = 380 + i * 90;
        K.tone(K, d, t + at, { path: [[0, f], [0.3, f * 2.4], [1, f * 0.7]], dur: 0.3, peak: 0.14, attack: 0.006, vib: 40, vibRate: 26 });
        K.tone(K, d, t + at, { type: 'triangle', path: [[0, f * 2], [0.3, f * 4.8], [1, f * 1.4]], dur: 0.28, peak: 0.03, attack: 0.006 });
      });
    },
  },
  fennec: {
    // 부드러운 깽 · 깽 두 번과 낑 하는 칭얼거림
    call(K, d, t) {
      for (const at of [0, 0.2]) K.tone(K, d, t + at, { type: 'triangle', path: [[0, 950], [0.4, 1600], [1, 1150]], dur: 0.15, peak: 0.12, attack: 0.008 });
      K.tone(K, d, t + 0.46, { path: [[0, 1300], [0.5, 1950], [1, 1450]], dur: 0.4, peak: 0.08, attack: 0.05, hold: 0.4, vib: 22, vibRate: 9 });
    },
    // 앞발로 모래를 파는 스윽 · 스윽 소리
    special(K, d, t) {
      for (let i = 0; i < 6; i++) {
        K.hiss(K, d, t + i * 0.2, { f: 1500, to: 500, q: 0.8, dur: 0.14, peak: 0.3, attack: 0.02 });
        K.hiss(K, d, t + i * 0.2 + 0.1, { type: 'lowpass', f: 450, dur: 0.05, peak: 0.12, attack: 0.004 });
      }
    },
  },
  snake: {
    // 숨을 내쉬는 듯한 부드러운 쉬익
    call(K, d, t) {
      K.hiss(K, d, t, { f: 4200, to: 3200, q: 0.7, dur: 0.8, peak: 0.12, attack: 0.18 });
      K.hiss(K, d, t, { type: 'highpass', f: 6500, dur: 0.7, peak: 0.03, attack: 0.18 });
    },
    // 꼬리 방울이 차르르 떠는 소리: 아주 짧은 잡음을 빽빽이 이어 점점 세졌다 잦아든다
    special(K, d, t) {
      const n = 40;
      for (let i = 0; i < n; i++) K.hiss(K, d, t + i * 0.03, { f: 5600 + (i % 3) * 400, q: 2.5, dur: 0.028, peak: 0.07 + 0.2 * Math.sin((Math.PI * i) / n), attack: 0.003 });
      K.hiss(K, d, t, { type: 'highpass', f: 6500, dur: 1.2, peak: 0.025, attack: 0.3 });
    },
  },
  coyote: {
    // 짧은 컹 · 컹컹 (짖는 듯한 외침)
    call(K, d, t) {
      for (const [at, f, dur] of [[0, 520, 0.16], [0.22, 560, 0.15], [0.4, 600, 0.12]]) {
        K.tone(K, d, t + at, { type: 'sawtooth', lp: 1800, path: [[0, f], [0.35, f * 1.65], [1, f * 1.15]], dur, peak: 0.14, attack: 0.012 });
        K.hiss(K, d, t + at, { f: 1700, q: 0.8, dur: dur * 0.8, peak: 0.03, attack: 0.01 });
      }
    },
    // 하늘을 보고 길게 우는 부드러운 하울링
    special(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', lp: 1300, path: [[0, 380], [0.35, 720], [0.8, 650], [1, 430]], dur: 1.5, peak: 0.12, attack: 0.3, hold: 0.55, vib: 9, vibRate: 5 });
      K.tone(K, d, t + 0.05, { type: 'triangle', path: [[0, 760], [0.35, 1440], [0.8, 1300], [1, 860]], dur: 1.4, peak: 0.03, attack: 0.3, hold: 0.5, vib: 12, vibRate: 5 });
      K.hiss(K, d, t, { f: 1500, q: 0.6, dur: 1.4, peak: 0.02, attack: 0.4 });
    },
  },
  vulture: {
    // 쉰 목소리로 낮게 꺽 · 꺽
    call(K, d, t) {
      for (const at of [0, 0.46]) {
        K.tone(K, d, t + at, { type: 'sawtooth', bp: 750, q: 1.4, path: [[0, 190], [1, 105]], dur: 0.36, peak: 0.2, attack: 0.03 });
        K.hiss(K, d, t + at, { f: 950, q: 0.9, dur: 0.3, peak: 0.07, attack: 0.03 });
      }
    },
    // 커다란 날개를 크게 젓는 후웅 · 후웅
    special(K, d, t) {
      for (let i = 0; i < 4; i++) {
        const at = i * 0.4;
        K.hiss(K, d, t + at, { f: 380, to: 1500, q: 0.6, dur: 0.38, peak: 0.26, attack: 0.12 });
        K.tone(K, d, t + at + 0.2, { path: [[0, 90], [1, 55]], dur: 0.16, peak: 0.1, attack: 0.01 });
      }
    },
  },
  oryx: {
    // 낮은 메에 하는 울음과 코 푸는 소리
    call(K, d, t) {
      K.hiss(K, d, t, { f: 1100, to: 700, q: 0.8, dur: 0.12, peak: 0.1, attack: 0.01 });
      K.tone(K, d, t + 0.1, { type: 'sawtooth', lp: 800, path: [[0, 270], [1, 195]], dur: 0.45, peak: 0.14, attack: 0.04, hold: 0.4, vib: 14, vibRate: 26 });
    },
    // 땅을 차는 발굽 소리 세 번 + 콧김
    special(K, d, t) {
      for (let i = 0; i < 3; i++) {
        K.tone(K, d, t + i * 0.22, { path: [[0, 150], [1, 60]], dur: 0.1, peak: 0.2, attack: 0.002 });
        K.hiss(K, d, t + i * 0.22, { type: 'highpass', f: 2200, dur: 0.035, peak: 0.08, attack: 0.002 });
      }
      K.hiss(K, d, t + 0.8, { f: 1000, to: 450, q: 0.7, dur: 0.28, peak: 0.2, attack: 0.02 });
    },
  },
  camel: {
    // 투덜거리는 낮은 그르렁
    call(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', lp: 500, path: [[0, 150], [0.3, 125], [1, 82]], dur: 1.0, peak: 0.18, attack: 0.12, hold: 0.45, vib: 16, vibRate: 9 });
      K.tone(K, d, t, { type: 'square', lp: 320, f: 75, dur: 0.9, peak: 0.04, attack: 0.15, hold: 0.4, vib: 6, vibRate: 11 });
      K.hiss(K, d, t + 0.05, { type: 'lowpass', f: 650, dur: 0.85, peak: 0.07, attack: 0.15 });
    },
    // 가슴 깊이 울리는 긴 울음
    special(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', lp: 650, path: [[0, 105], [0.3, 160], [1, 72]], dur: 1.5, peak: 0.2, attack: 0.18, hold: 0.5, vib: 12, vibRate: 22 });
      K.tone(K, d, t, { type: 'triangle', path: [[0, 52], [0.3, 80], [1, 36]], dur: 1.5, peak: 0.12, attack: 0.18, hold: 0.5 });
      K.hiss(K, d, t, { type: 'lowpass', f: 420, dur: 1.4, peak: 0.08, attack: 0.25 });
    },
  },
};
