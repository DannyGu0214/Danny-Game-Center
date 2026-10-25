// antarctic 동물 소리. sound.js의 VOICES처럼 종마다 { call(K, d, t), special(K, d, t) }. K.tone·K.hiss로만 만든다.
// tone 옵션: path([[시간 비율, Hz]...]) · f · dur · peak · attack · hold · lp · bp · q · vib · vibRate · type, hiss 옵션: type · f · to · q · dur · peak · attack
// 평화로운 분위기라 모두 짧고 작게(1.6초 안쪽) 낸다.
export const VOICES = {
  adelie: {
    // 아델리펭귄: 코맹맹이 "꽥-꽥-꽥" 짧은 외침 세 번
    call(K, d, t) {
      [[0, 1.0, 0.13], [0.2, 1.12, 0.12], [0.4, 0.92, 0.17]].forEach(([at, k, len]) => {
        K.tone(K, d, t + at, { type: 'sawtooth', bp: 1500, q: 1.4, path: [[0, 760 * k], [0.3, 1020 * k], [1, 640 * k]], dur: len, peak: 0.34, attack: 0.012, hold: 0.4 });
        K.hiss(K, d, t + at, { f: 2200, q: 0.9, dur: len * 0.8, peak: 0.035, attack: 0.01 });
      });
    },
    // 배로 미끄러지기: 눈 위를 "스으윽" 쓸며 가다가 신나서 "삐"
    special(K, d, t) {
      K.hiss(K, d, t, { type: 'bandpass', f: 4200, to: 1300, q: 0.7, dur: 0.95, peak: 0.2, attack: 0.12 });
      K.hiss(K, d, t + 0.05, { type: 'lowpass', f: 700, to: 350, dur: 0.9, peak: 0.1, attack: 0.15 });
      K.tone(K, d, t + 0.85, { type: 'triangle', path: [[0, 1100], [0.5, 1750], [1, 1500]], dur: 0.18, peak: 0.14, attack: 0.01 });
    },
  },
  skua: {
    // 도둑갈매기: 거칠게 "켁-켁-켁-켁"
    call(K, d, t) {
      for (let i = 0; i < 4; i++) {
        const at = i * 0.11;
        K.tone(K, d, t + at, { type: 'square', bp: 1900, q: 2, path: [[0, 1650 - i * 60], [1, 1150]], dur: 0.075, peak: 0.2, attack: 0.004 });
        K.hiss(K, d, t + at, { f: 2600, q: 1.2, dur: 0.06, peak: 0.08, attack: 0.004 });
      }
    },
    // 날개 들고 길게 "키이아아" + 퍼덕이는 날갯짓
    special(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', bp: 2100, q: 1.2, path: [[0, 1500], [0.3, 2300], [1, 1250]], dur: 0.95, peak: 0.22, attack: 0.05, hold: 0.45, vib: 40, vibRate: 11 });
      K.tone(K, d, t, { type: 'square', bp: 3200, path: [[0, 1500], [0.3, 2300], [1, 1250]], dur: 0.9, peak: 0.03, attack: 0.06 });
      for (let i = 0; i < 6; i++) K.hiss(K, d, t + 0.55 + i * 0.13, { type: 'lowpass', f: 650 + (i % 2) * 150, q: 0.7, dur: 0.1, peak: 0.16, attack: 0.012 });
    },
  },
  gentoo: {
    // 젠투펭귄: 나귀처럼 "빠아-빠아-빠아앙" 나팔 울음
    call(K, d, t) {
      [[0, 440, 0.2], [0.27, 470, 0.2], [0.55, 420, 0.42]].forEach(([at, f, len], i) => {
        K.tone(K, d, t + at, { type: 'sawtooth', bp: 1000, q: 0.9, path: [[0, f], [0.3, f * 1.45], [1, f * 1.1]], dur: len, peak: 0.34, attack: 0.025, hold: 0.55, vib: 14, vibRate: 22 + i });
        K.tone(K, d, t + at, { type: 'square', bp: 1700, path: [[0, f * 2], [0.3, f * 2.9], [1, f * 2.2]], dur: len * 0.9, peak: 0.03, attack: 0.03 });
      });
    },
    // 조약돌 "딱딱" 내려놓고 기쁜 "빠앙"
    special(K, d, t) {
      for (const at of [0, 0.11, 0.2]) {
        K.hiss(K, d, t + at, { type: 'highpass', f: 3200, dur: 0.03, peak: 0.16, attack: 0.002 });
        K.tone(K, d, t + at, { path: [[0, 2300 - at * 3000], [1, 900]], dur: 0.045, peak: 0.13, attack: 0.002 });
      }
      K.tone(K, d, t + 0.45, { type: 'sawtooth', bp: 1000, q: 0.9, path: [[0, 470], [0.35, 690], [1, 540]], dur: 0.5, peak: 0.34, attack: 0.03, hold: 0.55, vib: 14, vibRate: 22 });
    },
  },
  weddell: {
    // 웨델물범: 사이렌 같은 "삐유우—" 내려가는 휘파람 트릴 두 번
    call(K, d, t) {
      K.tone(K, d, t, { path: [[0, 2900], [0.18, 1500], [1, 250]], dur: 0.6, peak: 0.16, attack: 0.012, hold: 0.2, vib: 140, vibRate: 36 });
      K.tone(K, d, t + 0.62, { path: [[0, 2300], [0.2, 1200], [1, 210]], dur: 0.55, peak: 0.12, attack: 0.012, hold: 0.2, vib: 110, vibRate: 32 });
      K.tone(K, d, t, { path: [[0, 5800], [0.18, 3000], [1, 500]], dur: 0.5, peak: 0.02, attack: 0.012, vib: 200, vibRate: 36 });
    },
    // 옆으로 뒹굴며 "쿵쿵" 구르는 소리 + 기지개 한숨
    special(K, d, t) {
      for (const at of [0, 0.2, 0.36]) {
        K.tone(K, d, t + at, { path: [[0, 130], [1, 48]], dur: 0.2, peak: 0.34, attack: 0.004 });
        K.tone(K, d, t + at, { type: 'triangle', path: [[0, 260], [1, 110]], dur: 0.12, peak: 0.06, attack: 0.004 });
        K.hiss(K, d, t + at, { type: 'lowpass', f: 450, dur: 0.1, peak: 0.1, attack: 0.004 });
      }
      K.hiss(K, d, t + 0.6, { type: 'bandpass', f: 700, to: 320, q: 0.8, dur: 0.85, peak: 0.1, attack: 0.3 });
      K.tone(K, d, t + 0.6, { type: 'triangle', lp: 700, path: [[0, 240], [1, 130]], dur: 0.85, peak: 0.1, attack: 0.3 });
    },
  },
  king: {
    // 킹펭귄: 두 음이 겹치는 "뿌-뿌우우" 트럼펫(짧은 음 하나 + 긴 음 하나)
    call(K, d, t) {
      [[0, 0.17, 1], [0.24, 0.6, 1.12]].forEach(([at, len, k]) => {
        K.tone(K, d, t + at, { type: 'sawtooth', bp: 1300, q: 1, path: [[0, 400 * k], [0.15, 470 * k], [1, 430 * k]], dur: len, peak: 0.2, attack: 0.03, hold: 0.7, vib: 8, vibRate: 7 });
        K.tone(K, d, t + at, { type: 'sawtooth', bp: 1700, q: 1, path: [[0, 585 * k], [0.15, 690 * k], [1, 630 * k]], dur: len, peak: 0.15, attack: 0.03, hold: 0.7, vib: 8, vibRate: 6 });
      });
    },
    // 고개 들고 길게 부는 이중창 트럼펫: 두 목소리가 엇갈려 올라갔다 내려온다
    special(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', bp: 1300, q: 1, path: [[0, 380], [0.35, 520], [0.75, 500], [1, 370]], dur: 1.45, peak: 0.19, attack: 0.1, hold: 0.7, vib: 9, vibRate: 6 });
      K.tone(K, d, t, { type: 'sawtooth', bp: 1700, q: 1, path: [[0, 560], [0.35, 760], [0.75, 735], [1, 545]], dur: 1.45, peak: 0.13, attack: 0.1, hold: 0.7, vib: 9, vibRate: 5 });
      K.tone(K, d, t + 0.32, { type: 'sawtooth', bp: 1500, q: 1, path: [[0, 450], [0.4, 610], [1, 420]], dur: 1.1, peak: 0.12, attack: 0.12, hold: 0.6, vib: 8, vibRate: 7 });
    },
  },
  elephantseal: {
    // 남방코끼리물범: 낮고 걸쭉하게 "그르르륵" 가래 끓는 으르렁
    call(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', lp: 420, q: 1, path: [[0, 95], [0.45, 72], [1, 52]], dur: 0.75, peak: 0.31, attack: 0.06, hold: 0.5, vib: 22, vibRate: 17 });
      K.tone(K, d, t, { type: 'triangle', path: [[0, 190], [0.45, 144], [1, 104]], dur: 0.7, peak: 0.06, attack: 0.06, vib: 30, vibRate: 17 });
      for (let i = 0; i < 6; i++) K.hiss(K, d, t + 0.05 + i * 0.1, { type: 'lowpass', f: 380 + (i % 2) * 120, dur: 0.07, peak: 0.1, attack: 0.01 });
    },
    // 코를 부풀리며 깊게 울리는 포효(평화로운 모드라 부드럽게)
    special(K, d, t) {
      K.tone(K, d, t, { type: 'sawtooth', lp: 520, q: 0.9, path: [[0, 62], [0.3, 100], [0.7, 82], [1, 48]], dur: 1.5, peak: 0.3, attack: 0.18, hold: 0.55, vib: 28, vibRate: 24 });
      K.tone(K, d, t, { type: 'sawtooth', lp: 900, path: [[0, 124], [0.3, 200], [0.7, 164], [1, 96]], dur: 1.4, peak: 0.06, attack: 0.2, vib: 40, vibRate: 24 });
      K.hiss(K, d, t, { type: 'bandpass', f: 320, q: 0.8, dur: 1.4, peak: 0.12, attack: 0.25 });
    },
  },
  emperor: {
    // 황제펭귄: 부드럽게 떨리는 음악적인 트릴 "루리리~ 루리"
    call(K, d, t) {
      K.tone(K, d, t, { type: 'triangle', path: [[0, 700], [0.45, 880], [1, 760]], dur: 0.5, peak: 0.2, attack: 0.04, hold: 0.55, vib: 45, vibRate: 15 });
      K.tone(K, d, t, { path: [[0, 1400], [0.45, 1760], [1, 1520]], dur: 0.45, peak: 0.04, attack: 0.05, vib: 70, vibRate: 15 });
      K.tone(K, d, t + 0.55, { type: 'triangle', path: [[0, 820], [0.5, 640], [1, 590]], dur: 0.45, peak: 0.16, attack: 0.04, hold: 0.5, vib: 40, vibRate: 14 });
    },
    // 고개 숙여 인사: 느린 맥놀이 트릴이 한 박자씩 내려간다
    special(K, d, t) {
      for (let i = 0; i < 6; i++) {
        const f = 820 - i * 52;
        K.tone(K, d, t + i * 0.23, { type: 'triangle', path: [[0, f * 1.06], [0.4, f], [1, f * 0.95]], dur: 0.2, peak: 0.19 - i * 0.012, attack: 0.025, hold: 0.4, vib: 25, vibRate: 12 });
      }
      K.tone(K, d, t, { type: 'sine', path: [[0, 410], [1, 290]], dur: 1.35, peak: 0.07, attack: 0.2, hold: 0.5, vib: 6, vibRate: 5 });
    },
  },
  orca: {
    // 범고래: 높은 휘파람 "삐이—" 한 번 + 끽끽 맥박 소리
    call(K, d, t) {
      K.tone(K, d, t, { path: [[0, 1800], [0.4, 3300], [1, 2400]], dur: 0.6, peak: 0.16, attack: 0.04, hold: 0.5, vib: 60, vibRate: 7 });
      K.tone(K, d, t + 0.7, { type: 'sawtooth', bp: 2600, q: 2, path: [[0, 2300], [1, 1400]], dur: 0.5, peak: 0.12, attack: 0.01, vib: 700, vibRate: 55 });
      for (let i = 0; i < 6; i++) K.hiss(K, d, t + 0.72 + i * 0.07, { type: 'bandpass', f: 3800 - i * 250, q: 3, dur: 0.035, peak: 0.07, attack: 0.003 });
    },
    // 물 위로 머리를 내밀며 "첨벙" + 숨구멍으로 "푸슈우"
    special(K, d, t) {
      K.hiss(K, d, t, { type: 'bandpass', f: 600, to: 2600, q: 0.7, dur: 0.45, peak: 0.2, attack: 0.04 });
      K.tone(K, d, t, { path: [[0, 180], [1, 80]], dur: 0.25, peak: 0.28, attack: 0.006 });
      for (let i = 0; i < 5; i++) { const at = 0.05 + Math.random() * 0.4; K.tone(K, d, t + at, { path: [[0, 1800 + Math.random() * 1500], [1, 3400]], dur: 0.04, peak: 0.035, attack: 0.003 }); }
      K.hiss(K, d, t + 0.5, { type: 'highpass', f: 3200, to: 1800, dur: 0.6, peak: 0.12, attack: 0.05 });
      K.hiss(K, d, t + 0.5, { type: 'bandpass', f: 1100, q: 0.6, dur: 0.55, peak: 0.07, attack: 0.06 });
    },
  },
};
