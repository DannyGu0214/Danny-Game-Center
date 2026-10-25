// seaside 동물 소리. sound.js의 VOICES처럼 종마다 { call(K, d, t), special(K, d, t) }.
// 소리는 K.tone(K, d, t, o)과 K.hiss(K, d, t, o)로만 만든다(옵션 이름은 sound.js 참고). 평화로운 분위기라 짧고 작게 낸다.

// ---------- 게: 집게 딸깍 + 거품 ----------
const click = (K, d, t, f = 3400, pk = 0.55) => {
  K.hiss(K, d, t, { f, q: 2.2, dur: 0.022, peak: pk, attack: 0.002 });
  K.tone(K, d, t, { type: 'square', lp: 4200, path: [[0, f * 0.55], [1, f * 0.4]], dur: 0.02, peak: pk * 0.14, attack: 0.001 });
};
const bubble = (K, d, t, f, pk = 0.17) => K.tone(K, d, t, { path: [[0, f], [1, f * 1.9]], dur: 0.07, peak: pk, attack: 0.008 });

// ---------- 갈매기: "끼yow" ----------
const kyow = (K, d, t, len, f0, pk) => {
  const path = [[0, f0 * 0.85], [0.22, f0 * 1.3], [0.45, f0 * 1.1], [1, f0 * 0.6]];
  K.tone(K, d, t, { type: 'sawtooth', bp: f0 * 1.5, q: 1.4, path, dur: len, peak: pk, attack: 0.02, hold: 0.35, vib: 30, vibRate: 32 });
  K.tone(K, d, t, { path, dur: len, peak: pk * 0.35, attack: 0.02, hold: 0.35 });
  K.hiss(K, d, t, { f: f0 * 2, q: 1.2, dur: len * 0.8, peak: pk * 0.4, attack: 0.02 });
};

// ---------- 바다거북: 숨소리 ----------
const huff = (K, d, t, len, pk) => {
  K.hiss(K, d, t, { f: 1300, to: 480, q: 0.7, dur: len, peak: pk, attack: len * 0.25 });
  K.hiss(K, d, t, { type: 'lowpass', f: 600, to: 250, dur: len, peak: pk * 0.5, attack: len * 0.2 });
  K.tone(K, d, t, { lp: 300, path: [[0, 150], [1, 95]], dur: len * 0.9, peak: 0.05, attack: len * 0.25 });
};

// ---------- 홍학: 거위 같은 "뿌웅" ----------
const honk = (K, d, t, len, f0, pk) => {
  const path = [[0, f0 * 0.9], [0.25, f0 * 1.12], [1, f0 * 0.95]];
  K.tone(K, d, t, { type: 'sawtooth', bp: f0 * 2.2, q: 1.3, path, dur: len, peak: pk, attack: 0.02, hold: 0.5, vib: 10, vibRate: 38 });
  K.tone(K, d, t, { type: 'square', lp: 1800, path: path.map(([p, f]) => [p, f * 2]), dur: len * 0.9, peak: pk * 0.15, attack: 0.02 });
  K.hiss(K, d, t, { f: f0 * 3, q: 0.8, dur: len * 0.7, peak: pk * 0.35, attack: 0.02 });
};

// ---------- 해달: 삑삑 ----------
const squeak = (K, d, t, f0, len = 0.12, pk = 0.22) => {
  K.tone(K, d, t, { type: 'triangle', bp: f0 * 1.3, q: 1.6, path: [[0, f0 * 0.8], [0.35, f0 * 1.35], [1, f0 * 1.05]], dur: len, peak: pk, attack: 0.012, hold: 0.3, vib: 40, vibRate: 48 });
  K.tone(K, d, t, { path: [[0, f0 * 1.6], [0.35, f0 * 2.7], [1, f0 * 2.1]], dur: len * 0.8, peak: pk * 0.2, attack: 0.012 });
};
const tap = (K, d, t, pk = 0.2) => {
  K.tone(K, d, t, { path: [[0, 1250], [1, 480]], dur: 0.05, peak: pk, attack: 0.002 });
  K.hiss(K, d, t, { f: 2600, q: 1.6, dur: 0.03, peak: pk * 1.2, attack: 0.002 });
};

// ---------- 바다사자: "오크" ----------
const bark = (K, d, t, len, f0, pk) => {
  const path = [[0, f0 * 0.9], [0.12, f0 * 1.15], [1, f0 * 0.62]];
  K.tone(K, d, t, { type: 'sawtooth', lp: f0 * 4, q: 1.4, path, dur: len, peak: pk, attack: 0.015, hold: 0.3, vib: f0 * 0.06, vibRate: 55 });
  K.tone(K, d, t, { type: 'square', lp: f0 * 3, path: path.map(([p, f]) => [p, f * 0.5]), dur: len, peak: pk * 0.3, attack: 0.015 });
  K.hiss(K, d, t, { f: f0 * 2.5, q: 0.7, dur: len * 0.7, peak: pk * 0.5, attack: 0.01 });
};
const clap = (K, d, t, f = 1500, pk = 0.5) => {
  K.hiss(K, d, t, { f, q: 0.9, dur: 0.06, peak: pk, attack: 0.002 });
  K.tone(K, d, t, { path: [[0, 260], [1, 120]], dur: 0.06, peak: pk * 0.25, attack: 0.002 });
};

// ---------- 돌고래: 휘파람 + 클릭 ----------
const dclick = (K, d, t) => K.hiss(K, d, t, { type: 'highpass', f: 6000, q: 0.7, dur: 0.012, peak: 0.3, attack: 0.001 });

// ---------- 바다코끼리: 낮은 으르렁 + 종소리 같은 "똑" ----------
const knock = (K, d, t, f, pk = 0.1) => {
  K.tone(K, d, t, { f, dur: 0.35, peak: pk, attack: 0.003 });
  K.tone(K, d, t, { f: f * 2.76, dur: 0.22, peak: pk * 0.35, attack: 0.003 });
};

export const VOICES = {
  crab: {
    // 집게 딸깍 두 번 + 보글보글
    call(K, d, t) {
      click(K, d, t); click(K, d, t + 0.09, 3000, 0.45);
      bubble(K, d, t + 0.3, 700); bubble(K, d, t + 0.4, 820, 0.14); bubble(K, d, t + 0.49, 640, 0.12);
    },
    // 집게를 치켜들고 옆걸음 — 박자 맞춘 딸깍 + 사삭
    special(K, d, t) {
      const beats = [0, 0.14, 0.28, 0.56, 0.7, 0.84, 1.12, 1.26, 1.4];
      beats.forEach((b, i) => {
        click(K, d, t + b, i % 3 === 2 ? 4000 : 3300, i % 3 === 2 ? 0.6 : 0.45);
        K.hiss(K, d, t + b + 0.07, { f: 1500, q: 0.8, dur: 0.03, peak: 0.1, attack: 0.003 });
      });
    },
  },
  gull: {
    // 끼요-끼요-끼요, 점점 빨라지며 낮아지는 웃음소리
    call(K, d, t) {
      kyow(K, d, t, 0.3, 1500, 0.17); kyow(K, d, t + 0.36, 0.26, 1450, 0.16);
      kyow(K, d, t + 0.68, 0.22, 1380, 0.14); kyow(K, d, t + 0.94, 0.2, 1300, 0.12);
    },
    // 날개 퍼덕퍼덕 + 길게 끼이이오
    special(K, d, t) {
      for (let i = 0; i < 6; i++) {
        K.hiss(K, d, t + i * 0.11, { f: 420 + (i % 2) * 120, q: 0.7, dur: 0.1, peak: 0.3 + 0.1 * Math.sin(i * 0.9), attack: 0.025 });
        K.tone(K, d, t + i * 0.11, { path: [[0, 95], [1, 60]], dur: 0.08, peak: 0.05, attack: 0.01 });
      }
      kyow(K, d, t + 0.8, 0.68, 1650, 0.17);
    },
  },
  turtle: {
    // 푸우… 부드러운 콧바람 두 번
    call(K, d, t) {
      huff(K, d, t, 0.45, 0.3); huff(K, d, t + 0.6, 0.35, 0.2);
    },
    // 앞지느러미로 모래를 퍼내는 사각사각
    special(K, d, t) {
      for (let i = 0; i < 6; i++) {
        const at = t + i * 0.21;
        K.hiss(K, d, at, { f: 2400, to: 900, q: 0.8, dur: 0.17, peak: 0.22, attack: 0.05 });
        K.hiss(K, d, at + 0.05, { type: 'highpass', f: 5000, dur: 0.1, peak: 0.04, attack: 0.02 });
        K.hiss(K, d, at, { type: 'lowpass', f: 400, dur: 0.1, peak: 0.15, attack: 0.01 });
      }
    },
  },
  flamingo: {
    // 뿌웅-뿌웅-뿌우웅
    call(K, d, t) {
      honk(K, d, t, 0.26, 400, 0.17); honk(K, d, t + 0.34, 0.22, 380, 0.15); honk(K, d, t + 0.62, 0.3, 420, 0.16);
    },
    // 깃털 고르기 사르륵 + 부드러운 한 번 뿌웅
    special(K, d, t) {
      for (let i = 0; i < 12; i++) K.hiss(K, d, t + i * 0.055 + (i % 3) * 0.01, { type: 'highpass', f: 4200 + (i % 4) * 500, dur: 0.045, peak: 0.07 * (1 - i / 16), attack: 0.004 });
      K.hiss(K, d, t, { f: 1600, q: 0.6, dur: 0.7, peak: 0.05, attack: 0.15 });
      honk(K, d, t + 0.8, 0.35, 390, 0.14);
    },
  },
  otter: {
    // 이이-이이-이이익! 작게 삑삑
    call(K, d, t) {
      squeak(K, d, t, 1500, 0.1); squeak(K, d, t + 0.17, 1700, 0.1); squeak(K, d, t + 0.34, 1900, 0.2, 0.24);
    },
    // 배 위에 조개를 올려 돌에 톡톡톡 — 마지막에 쩍!
    special(K, d, t) {
      for (const at of [0, 0.27, 0.54, 0.81]) tap(K, d, t + at);
      K.hiss(K, d, t + 1.1, { f: 3400, q: 1.2, dur: 0.07, peak: 0.28, attack: 0.002 });
      K.tone(K, d, t + 1.1, { path: [[0, 2200], [1, 700]], dur: 0.06, peak: 0.16, attack: 0.002 });
      squeak(K, d, t + 1.25, 1800, 0.14, 0.18);
    },
  },
  sealion: {
    // 오크, 오크, 오르크
    call(K, d, t) {
      bark(K, d, t, 0.22, 340, 0.16); bark(K, d, t + 0.3, 0.22, 330, 0.15); bark(K, d, t + 0.6, 0.3, 300, 0.15);
    },
    // 지느러미 박수 짝짝짝짝 + 신나는 한 번 컹
    special(K, d, t) {
      [0, 0.18, 0.36, 0.54].forEach((b, i) => clap(K, d, t + b, 1400 + i * 120));
      bark(K, d, t + 0.85, 0.4, 300, 0.2);
    },
  },
  dolphin: {
    // 따다다닥 클릭 소리 뒤에 휘이이~ 휘파람
    call(K, d, t) {
      for (const at of [0, 0.07, 0.13, 0.18, 0.22, 0.255, 0.285, 0.31]) dclick(K, d, t + at);
      K.tone(K, d, t + 0.42, { path: [[0, 2400], [0.25, 4300], [0.55, 3300], [1, 5200]], dur: 0.55, peak: 0.1, attack: 0.04, hold: 0.4, vib: 40, vibRate: 30 });
      K.tone(K, d, t + 0.42, { path: [[0, 4800], [0.25, 8600], [0.55, 6600], [1, 10400]], dur: 0.5, peak: 0.015, attack: 0.04 });
    },
    // 첨벙! 물방울 + 신나는 휘파람
    special(K, d, t) {
      K.hiss(K, d, t, { f: 1800, to: 700, q: 0.6, dur: 0.55, peak: 0.4, attack: 0.03 });
      K.hiss(K, d, t, { type: 'highpass', f: 3000, dur: 0.3, peak: 0.1, attack: 0.02 });
      [0.12, 0.22, 0.3, 0.38, 0.44, 0.5].forEach((at, i) => { const f = 700 + (i * 197) % 700; K.tone(K, d, t + at, { path: [[0, f], [1, f * 2.3]], dur: 0.05, peak: 0.07, attack: 0.005 }); });
      K.tone(K, d, t + 0.5, { path: [[0, 1800], [0.5, 4600], [1, 3600]], dur: 0.7, peak: 0.1, attack: 0.05, hold: 0.4, vib: 35, vibRate: 28 });
      K.tone(K, d, t + 1.2, { path: [[0, 3200], [1, 5200]], dur: 0.2, peak: 0.08, attack: 0.02 });
    },
  },
  walrus: {
    // 으르렁 한 번 + 종 같은 똑, 똑, 똑
    call(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', lp: 260, path: [[0, 125], [1, 70]], dur: 0.35, peak: 0.22, attack: 0.04 });
      K.hiss(K, d, t, { type: 'lowpass', f: 250, dur: 0.3, peak: 0.1, attack: 0.03 });
      knock(K, d, t + 0.42, 430); knock(K, d, t + 0.64, 410); knock(K, d, t + 0.86, 390, 0.08);
    },
    // 엄니를 들고 길게 부우우웅
    special(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', lp: 420, path: [[0, 80], [0.25, 150], [0.7, 130], [1, 70]], dur: 1.55, peak: 0.2, attack: 0.18, hold: 0.6, vib: 5, vibRate: 5.5 });
      K.tone(K, d, t, { type: 'sawtooth', lp: 700, path: [[0, 120], [0.25, 225], [0.7, 195], [1, 105]], dur: 1.45, peak: 0.06, attack: 0.18, hold: 0.55 });
      K.hiss(K, d, t, { type: 'lowpass', f: 350, dur: 1.3, peak: 0.12, attack: 0.2 });
    },
  },
};
