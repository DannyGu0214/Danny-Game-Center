// Ocean World 3D 배경음악(P4 W2): 잔잔하고 밝은 열대 바다 1곡(32마디, F 장조, 86 BPM).
// quiz-quiz-2026/sound.js처럼 멜로디와 코드에서 베이스·아르페지오·패드를 자동 생성하고,
// 사인·삼각파 위주의 마림바·벨 음색으로 효과음을 덮지 않게 작게 깐다.

const NOTE_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CHORD_QUAL = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
};

export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

export function parseNote(tok) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(tok);
  if (!m) throw new Error(`알 수 없는 음이름: ${tok}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (+m[3] + 1) + NOTE_SEMITONE[m[1]] + acc;
}

export function parseChord(sym) {
  const m = /^([A-G])([#b]?)(maj7|m7|m|7)?$/.exec(sym);
  if (!m) throw new Error(`알 수 없는 코드: ${sym}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const root = (NOTE_SEMITONE[m[1]] + acc + 12) % 12;
  return { sym, root, iv: CHORD_QUAL[m[3] ?? ''] };
}

export const SONG_SPEC = {
  title: '산호초의 아침',
  key: 'F major',
  bpm: 86,
  beats: 4,
  bars: 32,
  chords: [
    // A (1~8): 포근한 주제
    'Fmaj7 Am7 Dm7 Bbmaj7 Fmaj7 Gm7 Bbmaj7 C7',
    // A' (9~16): 답하는 악구, F로 차분히 마침
    'Fmaj7 Am7 Dm7 Bbmaj7 Gm7 C7 Fmaj7 Fmaj7',
    // B (17~24): 햇살 비치는 석호(IV도에서 밝게 떠오름)
    'Bbmaj7 C7 Am7 Dm7 Bbmaj7 Am7 Gm7 C7',
    // C (25~32): 잔잔한 물결, 여백을 두고 돌아옴
    'Dm7 Am7 Bbmaj7 Fmaj7 Gm7 C7 Fmaj7 Fmaj7',
  ].join(' '),
  mel: `
    . . A4 C5 F5 - E5 - | C5 - - A4 G4 - . . | . . F4 A4 D5 - C5 - | A4 - - F4 D4 - . . |
    . . C5 D5 F5 - A5 - | G5 - F5 D5 Bb4 - . . | D5 - F5 - A5 - G5 - | E5 - - - . . C5 - |
    A4 - C5 - F5 - E5 - | C5 - A4 - G4 - . . | D5 - F5 - A5 - G5 F5 | D5 - - - . . Bb4 - |
    D5 - Bb4 - G4 - A4 Bb4 | C5 - E5 - G5 - E5 - | F5 - - - . . C5 A4 | F4 - - - . . . . |
    . . F5 G5 A5 - F5 - | G5 - E5 - C5 - . . | . . E5 F5 G5 - E5 - | F5 - D5 - A4 - . . |
    Bb4 - D5 - F5 - A5 - | G5 - E5 - C5 - A4 - | Bb4 - D5 - F5 - D5 - | E5 - - - . . C5 - |
    A5 - F5 - D5 - . . | G5 - E5 - C5 - . . | F5 - D5 - Bb4 - D5 - | C5 - - - . . A4 - |
    Bb4 - D5 - G5 - F5 - | E5 - C5 - G4 - Bb4 - | A4 - C5 - F5 - C5 - | A4 - - - . . . .
  `,
};

export function compileSong(spec = SONG_SPEC) {
  const ch = spec.chords.trim().split(/\s+/).map(parseChord);
  const toks = spec.mel.replace(/\|/g, ' ').trim().split(/\s+/);
  const expected = ch.length * spec.beats * 2;
  if (toks.length !== expected) {
    throw new Error(`곡 마디 길이 오류: 토큰 ${toks.length} !== 기대 ${expected}`);
  }
  const notes = toks.map(() => null);
  let last = -1;
  toks.forEach((tok, i) => {
    if (tok === '-') {
      if (last >= 0) notes[last][1] += 1;
    } else if (tok === '.') {
      last = -1;
    } else {
      notes[i] = [parseNote(tok), 1];
      last = i;
    }
  });
  return { ...spec, ch, notes };
}

export const COMPILED_SONG = compileSong(SONG_SPEC);

// ---------- 부드러운 악기 합성 ----------
function createNoiseBuffer(ac, sec = 1) {
  const len = Math.max(1, Math.floor(ac.sampleRate * sec));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function voiceGain(ac, dest, t, end, peak, attack = 0.006) {
  const g = ac.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, Math.max(t + attack + 0.01, end));
  g.connect(dest);
  return g;
}

function playOsc(ac, type, f, t, end, dest, detune = 0) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  o.connect(dest);
  o.start(t);
  o.stop(end + 0.04);
  return o;
}

// 마림바: 사인 기본음 + 짧게 사라지는 4배음 나무 타격감 + 부드러운 로우패스
function playMarimba(ac, dest, t, f, dur, peak = 0.12) {
  const end = t + Math.max(0.32, Math.min(1.05, dur + 0.25));
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2400, t);
  const g = voiceGain(ac, dest, t, end, peak, 0.005);
  lp.connect(g);
  playOsc(ac, 'sine', f, t, end, lp);

  // 목재 마림바 배음(4배음이 35ms 안에 사라져 톡 치는 느낌만 남김)
  const hg = voiceGain(ac, lp, t, t + 0.055, 0.28, 0.002);
  playOsc(ac, 'sine', f * 4, t, t + 0.06, hg);
}

// 벨/칼림바: 맑고 투명한 사인 + 약한 2.76배음(아르페지오·B구간 햇살 느낌)
function playBell(ac, dest, t, f, dur, peak = 0.055) {
  const end = t + Math.max(0.55, Math.min(1.5, dur + 0.4));
  const g = voiceGain(ac, dest, t, end, peak, 0.004);
  playOsc(ac, 'sine', f, t, end, g);
  const hg = voiceGain(ac, g, t, t + 0.35, 0.22, 0.003);
  playOsc(ac, 'sine', f * 2.76, t, t + 0.36, hg);
}

// 따뜻한 패드: 약하게 어긋난 삼각파 둘을 낮은 로우패스로 감쌈
function playPad(ac, dest, t, f, dur, peak = 0.022) {
  const end = t + dur + 0.8;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(720, t);
  lp.Q.setValueAtTime(0.5, t);
  const g = ac.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.65);
  g.gain.setValueAtTime(peak, t + Math.max(0.7, dur * 0.85));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  lp.connect(g);
  g.connect(dest);
  playOsc(ac, 'triangle', f, t, end, lp, -5);
  playOsc(ac, 'triangle', f, t, end, lp, 5);
}

// 둥근 저음: 사인 + 아주 약한 삼각파
function playBass(ac, dest, t, f, dur, peak = 0.14) {
  const end = t + Math.max(0.25, dur);
  const g = voiceGain(ac, dest, t, end, peak, 0.018);
  playOsc(ac, 'sine', f, t, end, g);
  const h = ac.createGain();
  h.gain.value = 0.16;
  h.connect(g);
  playOsc(ac, 'triangle', f, t, end, h);
}

// 아주 작은 파도 셰이커(바다 모래 쓸리는 숨결)
function playShaker(ac, dest, noiseBuf, t, peak = 0.01) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(5200, t);
  bp.Q.setValueAtTime(1.1, t);
  const g = voiceGain(ac, dest, t, t + 0.055, peak, 0.004);
  src.connect(bp);
  bp.connect(g);
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.07);
}

// ---------- 배경음악 스케줄러 ----------
export function createMusicPlayer({ ac, dest }) {
  const song = COMPILED_SONG;
  const noiseBuf = createNoiseBuffer(ac, 1);
  // 재생마다 새 출력 노드를 쓴다. 멈춘 뒤 미리 예약된 음(최대 0.25초)이 다시 켜진 노드로 새지 않게.
  let layer = null;

  const S16 = 60 / song.bpm / 4;
  const bar16 = song.beats * 4; // 16
  const loop16 = song.ch.length * bar16; // 512

  let timer = null;
  let step = 0;
  let next = 0;

  function scheduleBarTones(b, j, t) {
    const c = song.ch[b];
    // 화음 구성음(4옥타브 근처, F4~E5 범위에 모아 부드럽게)
    const chordMidi = c.iv.map((iv) => {
      let m = 60 + ((c.root + iv) % 12);
      if (m < 62) m += 12;
      return m;
    });
    // 베이스 근음(F2~E3)
    let root = 36 + c.root;
    if (root < 41) root += 12; // F2(41) 이상으로 유지해 노트북 스피커에서도 들리게

    // 1) 패드: 마디 첫 박에 루트+3음+7음 옅게 깔기
    if (j === 0) {
      playPad(ac, layer, t, midiHz(chordMidi[0] - 12), S16 * 14, 0.02);
      playPad(ac, layer, t, midiHz(chordMidi[1] - 12), S16 * 14, 0.016);
      if (chordMidi[3] !== undefined) {
        playPad(ac, layer, t, midiHz(chordMidi[3] - 12), S16 * 14, 0.014);
      }
    }

    // 2) 베이스: 느긋한 열대 1박 + 2.5박 스웨이(마지막 마디는 1박만 여운)
    const isEndingBar = b === 15 || b === 31;
    if (j === 0) {
      playBass(ac, layer, t, midiHz(root), S16 * (isEndingBar ? 10 : 5.5), 0.14);
    } else if (!isEndingBar && j === 6) {
      playBass(ac, layer, t, midiHz(root + 7), S16 * 3.5, 0.09);
    } else if (!isEndingBar && j === 10) {
      playBass(ac, layer, t, midiHz(root), S16 * 5, 0.11);
    }

    // 3) 반주 아르페지오(칼림바/벨): 16·32마디는 쉬고, 8분음표 간격으로 잔잔하게
    if (!isEndingBar) {
      const inB = b >= 16 && b < 24;
      const arpSteps = inB ? [0, 4, 6, 10, 12] : [2, 6, 10, 14];
      const idx = arpSteps.indexOf(j);
      if (idx >= 0) {
        const note = chordMidi[(idx + (b % 2)) % chordMidi.length];
        playBell(ac, layer, t, midiHz(note), S16 * 2.5, inB ? 0.045 : 0.036);
      }
    }

    // 4) 모래 쓸리는 셰이커: B구간과 A' 후반에만 아주 옅게
    if (!isEndingBar && b >= 8 && b < 28 && (j === 4 || j === 12)) {
      playShaker(ac, layer, noiseBuf, t, j === 4 ? 0.01 : 0.007);
    }

    // 5) 멜로디(8분음표 칸 = 짝수 16분음표)
    if (j % 2 === 0) {
      const note = song.notes[(b * bar16 + j) / 2];
      if (note) {
        const [midi, len8] = note;
        const dur = S16 * 2 * len8 * 0.92;
        const f = midiHz(midi);
        const inB = b >= 16 && b < 24;
        if (inB) {
          // B구간은 벨 비중을 높여 햇살 반짝이는 느낌
          playMarimba(ac, layer, t, f, dur, 0.085);
          playBell(ac, layer, t, f, dur, 0.055);
        } else {
          playMarimba(ac, layer, t, f, dur, 0.115);
        }
      }
    }
  }

  function tick() {
    if (!timer) return;
    if (next < ac.currentTime) {
      // 메인 스레드 지연으로 뒤처진 경우 밀린 음을 한꺼번에 터뜨리지 않는다
      next = ac.currentTime + 0.03;
    }
    while (next < ac.currentTime + 0.25) {
      const i = step % loop16;
      const b = Math.floor(i / bar16);
      const j = i % bar16;
      scheduleBarTones(b, j, next);
      next += S16;
      step += 1;
    }
  }

  function start({ fromBar = false } = {}) {
    if (timer) return;
    if (fromBar) step = step - (step % bar16);
    const now = ac.currentTime;
    layer = ac.createGain();
    layer.gain.setValueAtTime(0.0001, now);
    layer.gain.linearRampToValueAtTime(1, now + 0.18);
    layer.connect(dest);
    next = now + 0.06;
    timer = setInterval(tick, 60);
    tick();
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    const now = ac.currentTime;
    const old = layer;
    layer = null;
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(Math.max(0.0001, old.gain.value), now);
    old.gain.linearRampToValueAtTime(0.0001, now + 0.08);
    setTimeout(() => { try { old.disconnect(); } catch { /* 이미 끊김 */ } }, 400);
  }

  return {
    start,
    stop,
    playing: () => !!timer,
    title: song.title,
    bars: song.bars,
    bpm: song.bpm,
  };
}
