// Ocean World 3D 효과음 & 생물 소리(P4 W2). Web Audio 합성, 외부 파일 없음.
// 모든 소리는 부드러운 사인·삼각파 위주(해삼~쥐가오리 8종 귀여운 효과음 + place/capture/tier/chance).
// 같은 소리가 0.1초 안에 겹치면 하나만 낸다(DEDUP_SEC).

export const DEDUP_SEC = 0.1;

export const SPECIES_IDS = [
  'seacucumber',
  'hermitcrab',
  'anemone',
  'clownfish',
  'octopus',
  'moonjelly',
  'greenturtle',
  'manta',
];

export const GAME_SFX_IDS = ['place', 'capture', 'tier', 'chance'];

export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// 흰 잡음 버퍼(1초): 조개·모래·포착 셔터·물결 쉼에 재사용
export function createNoiseBuffer(ac, sec = 1) {
  const len = Math.max(1, Math.floor(ac.sampleRate * sec));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// 주파수 경로([[비율, Hz], ...])와 부드러운 엔벨로프로 오실레이터 하나를 재생한다
function tone(ac, dest, t, {
  type = 'sine',
  f = 440,
  path = null,
  dur = 0.25,
  peak = 0.16,
  attack = 0.008,
  hold = 0.05,
  lp = 0,
  bp = 0,
  q = 0.9,
  vib = 0,
  vibRate = 6,
} = {}) {
  const end = t + Math.max(0.03, dur);
  const g = ac.createGain();
  g.gain.value = 0.0001; // 예약 직전 1샘플 튐 방지
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.min(attack, dur * 0.45));
  if (hold > 0) {
    const holdAt = t + Math.max(attack, dur * hold);
    g.gain.setValueAtTime(Math.max(0.0002, peak), holdAt);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(dest);

  let out = g;
  if (lp || bp) {
    const flt = ac.createBiquadFilter();
    flt.type = lp ? 'lowpass' : 'bandpass';
    flt.frequency.value = lp || bp;
    flt.Q.value = q;
    flt.connect(g);
    out = flt;
  }

  const osc = ac.createOscillator();
  osc.type = type;
  const pts = path || [[0, f]];
  osc.frequency.setValueAtTime(Math.max(20, pts[0][1]), t);
  for (const [ratio, freq] of pts.slice(1)) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), t + dur * ratio);
  }

  if (vib > 0) {
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = vibRate;
    lg.gain.value = vib;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(end + 0.04);
  }

  osc.connect(out);
  osc.start(t);
  osc.stop(end + 0.04);
}

// 필터를 거친 짧은 잡음(모래·셔터·숨 뱉기·물결)
function hiss(ac, dest, noiseBuf, t, {
  type = 'bandpass',
  f = 1200,
  to = 0,
  q = 0.9,
  dur = 0.12,
  peak = 0.08,
  attack = 0.006,
} = {}) {
  const end = t + Math.max(0.02, dur);
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;

  const flt = ac.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(Math.max(40, f), t);
  if (to > 0) flt.frequency.exponentialRampToValueAtTime(Math.max(40, to), end);

  const g = ac.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.min(attack, dur * 0.4));
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  src.connect(flt);
  flt.connect(g);
  g.connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(end + 0.03);
}

// ---------- 생물 8종 소리 (0.2~0.6초, 귀여운 효과음) ----------
export const SPECIES_VOICES = {
  // 해삼: 말랑하게 늘어났다 오므라드는 '물컹-뽀옥' (~0.30초)
  seacucumber(ac, dest, noiseBuf, t) {
    tone(ac, dest, t, {
      type: 'sine',
      path: [[0, 175], [0.45, 290], [1, 210]],
      dur: 0.24,
      peak: 0.18,
      attack: 0.025,
      lp: 900,
    });
    tone(ac, dest, t + 0.14, {
      type: 'triangle',
      path: [[0, 260], [1, 390]],
      dur: 0.13,
      peak: 0.08,
      attack: 0.01,
      lp: 1100,
    });
  },

  // 소라게: 껍데기 '똑-똑-따각' 두드림 (~0.32초)
  hermitcrab(ac, dest, noiseBuf, t) {
    const knocks = [[0, 740, 0.14], [0.095, 930, 0.12], [0.19, 820, 0.15]];
    for (const [at, freq, pk] of knocks) {
      tone(ac, dest, t + at, {
        type: 'triangle',
        path: [[0, freq], [1, freq * 0.62]],
        dur: 0.075,
        peak: pk,
        attack: 0.003,
        hold: 0,
        lp: 2400,
      });
      hiss(ac, dest, noiseBuf, t + at, {
        type: 'bandpass',
        f: 2200,
        q: 2.2,
        dur: 0.025,
        peak: 0.045,
        attack: 0.002,
      });
    }
  },

  // 말미잘: 촉수가 활짝 피어나는 맑은 '파르르-뾰롱' (~0.42초)
  anemone(ac, dest, noiseBuf, t) {
    tone(ac, dest, t, {
      type: 'sine',
      path: [[0, 440], [0.6, 660], [1, 587]],
      dur: 0.26,
      peak: 0.13,
      attack: 0.015,
      vib: 10,
      vibRate: 9,
    });
    tone(ac, dest, t + 0.11, {
      type: 'sine',
      path: [[0, 880], [1, 1046]],
      dur: 0.24,
      peak: 0.09,
      attack: 0.008,
    });
    tone(ac, dest, t + 0.2, {
      type: 'sine',
      f: 1318,
      dur: 0.22,
      peak: 0.06,
      attack: 0.006,
    });
  },

  // 몰디브흰동가리: 작고 명랑한 물방울 '뽀글-삐!' (~0.24초)
  clownfish(ac, dest, noiseBuf, t) {
    tone(ac, dest, t, {
      type: 'sine',
      path: [[0, 520], [1, 860]],
      dur: 0.09,
      peak: 0.16,
      attack: 0.005,
    });
    tone(ac, dest, t + 0.095, {
      type: 'sine',
      path: [[0, 680], [0.55, 1120], [1, 980]],
      dur: 0.14,
      peak: 0.15,
      attack: 0.005,
    });
  },

  // 문어: 빨판 '뽁!' 뒤 물속으로 쏙 빠지는 '휘리릭' (~0.38초)
  octopus(ac, dest, noiseBuf, t) {
    tone(ac, dest, t, {
      type: 'sine',
      path: [[0, 260], [1, 620]],
      dur: 0.085,
      peak: 0.19,
      attack: 0.004,
      hold: 0.2,
    });
    tone(ac, dest, t + 0.09, {
      type: 'triangle',
      path: [[0, 480], [0.5, 310], [1, 195]],
      dur: 0.26,
      peak: 0.13,
      attack: 0.01,
      lp: 1400,
    });
    hiss(ac, dest, noiseBuf, t + 0.1, {
      type: 'bandpass',
      f: 900,
      to: 420,
      q: 1.4,
      dur: 0.2,
      peak: 0.055,
      attack: 0.015,
    });
  },

  // 보름달물해파리: 부드럽고 둥실거리는 '뽀요옹~' (~0.52초)
  moonjelly(ac, dest, noiseBuf, t) {
    tone(ac, dest, t, {
      type: 'sine',
      path: [[0, 330], [0.35, 520], [1, 450]],
      dur: 0.48,
      peak: 0.16,
      attack: 0.02,
      hold: 0.15,
      vib: 6,
      vibRate: 5.5,
    });
    tone(ac, dest, t + 0.03, {
      type: 'sine',
      path: [[0, 660], [0.35, 1040], [1, 900]],
      dur: 0.46,
      peak: 0.055,
      attack: 0.025,
    });
  },

  // 바다거북: 낮고 푸근한 '뿌우웅~' + 작은 숨소리 (~0.50초)
  greenturtle(ac, dest, noiseBuf, t) {
    tone(ac, dest, t, {
      type: 'triangle',
      path: [[0, 145], [0.3, 185], [1, 122]],
      dur: 0.44,
      peak: 0.15, // 두 음이 같은 높이로 겹쳐 더해지므로 다른 종(피크 0.13~0.25)과 맞게 낮춤
      attack: 0.035,
      hold: 0.25,
      lp: 540,
    });
    tone(ac, dest, t, {
      type: 'sine',
      path: [[0, 145], [0.3, 185], [1, 122]],
      dur: 0.46,
      peak: 0.11,
      attack: 0.035,
      hold: 0.25,
    });
    hiss(ac, dest, noiseBuf, t + 0.28, {
      type: 'bandpass',
      f: 700,
      to: 480,
      q: 1.1,
      dur: 0.19,
      peak: 0.04,
      attack: 0.02,
    });
  },

  // 쥐가오리: 넓고 포근하게 활공하는 '우우웅-샤아~' (~0.56초)
  manta(ac, dest, noiseBuf, t) {
    tone(ac, dest, t, {
      type: 'sine',
      path: [[0, 130], [0.5, 196], [1, 174]],
      dur: 0.54,
      peak: 0.18,
      attack: 0.06,
      hold: 0.25,
    });
    tone(ac, dest, t + 0.04, {
      type: 'triangle',
      path: [[0, 261], [0.55, 294], [1, 261]],
      dur: 0.50,
      peak: 0.075,
      attack: 0.07,
      lp: 800,
    });
    hiss(ac, dest, noiseBuf, t + 0.02, {
      type: 'bandpass',
      f: 520,
      to: 980,
      q: 0.8,
      dur: 0.45,
      peak: 0.045,
      attack: 0.08,
    });
  },
};

// ---------- 게임 효과음 4종 ----------
export const GAME_SFX = {
  // 물건 놓음: 구역에 따라 뭍은 포근한 '톡', 바닷속은 물방울 '퐁'
  place(ac, dest, noiseBuf, t, data = {}) {
    const isLand = data.zone === 'land';
    tone(ac, dest, t, {
      type: isLand ? 'triangle' : 'sine',
      path: isLand ? [[0, 240], [1, 150]] : [[0, 230], [0.6, 360], [1, 310]],
      dur: 0.13,
      peak: 0.16,
      attack: 0.005,
      lp: isLand ? 1200 : 1800,
    });
    tone(ac, dest, t + 0.045, {
      type: 'sine',
      path: isLand ? [[0, 480], [1, 380]] : [[0, 540], [1, 740]],
      dur: 0.11,
      peak: 0.09,
      attack: 0.005,
    });
  },

  // 포착 성공: 가벼운 셔터 딸깍 + 맑은 반짝 화음(첫 포착이면 한 음 더)
  capture(ac, dest, noiseBuf, t, data = {}) {
    hiss(ac, dest, noiseBuf, t, {
      type: 'highpass',
      f: 2600,
      dur: 0.028,
      peak: 0.08,
      attack: 0.002,
    });
    const notes = data.first ? [77, 81, 84, 89, 93] : [77, 81, 84, 89];
    notes.forEach((m, idx) => {
      tone(ac, dest, t + 0.03 + idx * 0.055, {
        type: 'sine',
        f: midiHz(m),
        dur: 0.24,
        peak: 0.11,
        attack: 0.004,
      });
    });
  },

  // 티어 상승: 짧고 밝은 열대 마림바+벨 팡파르
  tier(ac, dest, noiseBuf, t) {
    const lead = [
      [0.0, 77, 0.22],
      [0.1, 81, 0.22],
      [0.2, 84, 0.22],
      [0.3, 89, 0.48],
      [0.44, 84, 0.18],
      [0.54, 89, 0.55],
    ];
    for (const [at, m, dur] of lead) {
      const freq = midiHz(m);
      tone(ac, dest, t + at, { type: 'sine', f: freq, dur, peak: 0.14, attack: 0.005 });
      tone(ac, dest, t + at, { type: 'sine', f: freq * 2, dur: Math.min(0.14, dur), peak: 0.04, attack: 0.003 });
    }
    tone(ac, dest, t, { type: 'triangle', f: midiHz(53), dur: 0.4, peak: 0.12, attack: 0.01, lp: 700 });
    tone(ac, dest, t + 0.3, { type: 'sine', f: midiHz(60), dur: 0.65, peak: 0.13, attack: 0.01 });
  },

  // 포착 기회 알림: 아주 작고 은은한 두 음 반짝임
  chance(ac, dest, noiseBuf, t) {
    tone(ac, dest, t, {
      type: 'sine',
      f: midiHz(81),
      dur: 0.18,
      peak: 0.05,
      attack: 0.008,
    });
    tone(ac, dest, t + 0.11, {
      type: 'sine',
      f: midiHz(84),
      dur: 0.24,
      peak: 0.055,
      attack: 0.008,
    });
  },
};

export function createSfxPlayer({ ac, dest, dedupSec = DEDUP_SEC }) {
  const noiseBuf = createNoiseBuffer(ac, 1);
  const lastAt = new Map();

  function canPlay(key) {
    const now = ac.currentTime;
    const prev = lastAt.get(key);
    if (prev !== undefined && now - prev < dedupSec) return false;
    lastAt.set(key, now);
    return true;
  }

  function playSpecies(sp) {
    const fn = SPECIES_VOICES[sp];
    if (!fn || !canPlay(`sp:${sp}`)) return false;
    fn(ac, dest, noiseBuf, ac.currentTime + 0.005);
    return true;
  }

  function playGame(name, data) {
    const fn = GAME_SFX[name];
    if (!fn || !canPlay(`sfx:${name}`)) return false;
    fn(ac, dest, noiseBuf, ac.currentTime + 0.005, data);
    return true;
  }

  return { playSpecies, playGame };
}
