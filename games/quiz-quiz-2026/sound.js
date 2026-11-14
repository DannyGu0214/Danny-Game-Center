// 칩튠 효과음과 배경음악(설계 11.5절). 파일 없이 Web Audio로 합성한다.
// 8비트 게임기처럼 펄스파(12.5%·25%·50% 듀티), 삼각파, 노이즈(긴·짧은 주기) 채널만 써서 모든 소리를 같은 계열로 맞춘다.
// 효과음과 음악은 음량을 따로 두고, 전체 끄기가 있다. iOS 사파리는 첫 터치 뒤에만 소리가 나서 unlock()을 첫 터치에 부른다.

const hz = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI 번호 → 주파수

export function createSound() {
  let ac = null, master = null, sfxBus = null, musicBus = null, longNoise = null, shortNoise = null;
  const waves = {};
  const vol = { on: true, sfx: 0.8, music: 0.5 };

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain(); master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.connect(master);
      applyVol();
      // 펄스파: 듀티비마다 푸리에 계수로 만든다
      for (const duty of [0.125, 0.25, 0.5]) {
        const n = 32, re = new Float32Array(n), im = new Float32Array(n);
        for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
        waves[duty] = ac.createPeriodicWave(re, im);
      }
      // 노이즈: 긴 주기(쉭·박수)와 짧은 주기(금속성 칙)를 LFSR로 만든다
      const lfsr = (len, short) => {
        const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
        let r = 1, v = 1;
        for (let i = 0; i < len; i++) {
          if (i % 4 === 0) { const bit = (r ^ (r >> (short ? 6 : 1))) & 1; r = (r >> 1) | (bit << 14); v = r & 1 ? 1 : -1; }
          d[i] = v * 0.8;
        }
        return buf;
      };
      longNoise = lfsr(ac.sampleRate, false);
      shortNoise = lfsr(ac.sampleRate, true);
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  }
  function applyVol() {
    if (!ac) return;
    master.gain.value = vol.on ? 1 : 0;
    sfxBus.gain.value = vol.sfx;
    musicBus.gain.value = vol.music * 0.5;
  }
  // iOS: 첫 터치 때 무음 버퍼를 한 번 재생해 오디오를 깨운다
  function unlock() {
    if (!ensure()) return;
    const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource();
    s.buffer = b; s.connect(ac.destination); s.start(0);
  }

  // ---------- 채널 ----------
  // 펄스/삼각 음 하나: f(주파수) at(초 뒤) dur(길이) { duty|tri, vol, to(끝 주파수), vib(비브라토 Hz) }
  function tone(f, at, dur, { duty = 0.5, tri = false, v = 0.2, to = null, vib = 0, out = sfxBus, attack = 0.005, release = null } = {}) {
    const t = ac.currentTime + Math.max(0, at), o = ac.createOscillator(), g = ac.createGain();
    if (tri) o.type = 'triangle'; else o.setPeriodicWave(waves[duty]);
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vib; lg.gain.value = f * 0.03; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    // 8비트 느낌: 계단처럼 짧게 붙었다 떨어지는 엔벨로프
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + attack);
    g.gain.setValueAtTime(v, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + (release ?? dur));
    o.connect(g); g.connect(out); o.start(t); o.stop(t + (release ?? dur) + 0.02);
  }
  // 노이즈: { short(금속성), v, hp, lp, to(필터 끝값) }
  function hiss(at, dur, { short = false, v = 0.2, hp = 0, lp = 0, rate = 1, out = sfxBus, decay = true } = {}) {
    const t = ac.currentTime + Math.max(0, at), s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = short ? shortNoise : longNoise; s.loop = true; s.playbackRate.value = rate;
    let node = s;
    if (hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    g.gain.setValueAtTime(v, t);
    if (decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur); else g.gain.setValueAtTime(0, t + dur);
    node.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const arp = (notes, step, opt = {}) => notes.forEach((n, i) => n && tone(hz(n), i * step, opt.len ?? step * 0.95, opt));
  const kick = (at, v = 0.5) => tone(150, at, 0.12, { tri: true, v, to: 45 });
  const snare = (at, v = 0.25) => { hiss(at, 0.12, { v, hp: 1200 }); tone(220, at, 0.05, { tri: true, v: v * 0.6, to: 120 }); };

  // ---------- 효과음 ----------
  const SFX = {
    // [진행]
    tvOn: () => { hiss(0, 0.45, { v: 0.25, hp: 800 }); tone(hz(93), 0.42, 0.3, { duty: 0.125, v: 0.12 }); },
    static: () => hiss(0, 0.35, { v: 0.22, hp: 1500, decay: false }),
    jingle: () => arp([72, 76, 79, 84, 0, 79, 84], 0.11, { duty: 0.25, v: 0.16 }), // 잠시 후 계속됩니다
    opening: () => { arp([67, 72, 76, 79, 0, 76, 79], 0.1, { duty: 0.25, v: 0.17 }); arp([48, 0, 55, 0, 60], 0.14, { tri: true, v: 0.3 }); },
    roundStart: () => { kick(0, 0.6); kick(0.22, 0.7); tone(hz(43), 0.22, 0.4, { tri: true, v: 0.35 }); hiss(0.22, 0.3, { v: 0.12, hp: 3000 }); }, // 두둥
    spinTick: () => tone(hz(96), 0, 0.025, { duty: 0.125, v: 0.12 }),
    spinStop: () => { tone(hz(84), 0, 0.08, { duty: 0.25, v: 0.16 }); tone(hz(91), 0.08, 0.2, { duty: 0.25, v: 0.16 }); },
    panelPick: () => tone(hz(79), 0, 0.06, { duty: 0.25, v: 0.15, to: hz(86) }),
    panelFlip: () => { hiss(0, 0.05, { short: true, v: 0.2, hp: 2000 }); tone(hz(72), 0.04, 0.06, { duty: 0.5, v: 0.12, to: hz(84) }); hiss(0.1, 0.04, { short: true, v: 0.15, hp: 2500 }); },
    turnChange: () => arp([81, 76], 0.08, { duty: 0.25, v: 0.15 }),
    // [문제]
    cardIn: () => { hiss(0, 0.18, { v: 0.15, hp: 2500, rate: 1.5 }); tone(hz(60), 0, 0.16, { duty: 0.125, v: 0.1, to: hz(84) }); }, // 휘릭
    press: () => tone(hz(76), 0, 0.05, { duty: 0.5, v: 0.13 }),
    tile: () => tone(hz(84), 0, 0.04, { duty: 0.25, v: 0.11 }),
    erase: () => tone(hz(72), 0, 0.06, { duty: 0.25, v: 0.11, to: hz(60) }),
    confirm: () => arp([79, 84], 0.05, { duty: 0.25, v: 0.14 }),
    tick: () => tone(hz(91), 0, 0.03, { duty: 0.125, v: 0.08 }),
    tickFast: () => { tone(hz(96), 0, 0.03, { duty: 0.125, v: 0.12 }); },
    timeUp: () => { tone(hz(45), 0, 0.6, { duty: 0.5, v: 0.2 }); tone(hz(46), 0, 0.6, { duty: 0.25, v: 0.12 }); },
    // [판정]
    ding: () => arp([79, 83, 88], 0.16, { duty: 0.25, v: 0.2, len: 0.3 }), // 딩동댕
    buzz: () => { tone(hz(40), 0, 0.45, { duty: 0.5, v: 0.22 }); tone(hz(41), 0, 0.45, { duty: 0.25, v: 0.12 }); }, // 땡
    passTurn: () => arp([74, 69], 0.12, { duty: 0.5, v: 0.15 }), // 기회 넘어감(두 음 내려감)
    grayOut: () => tone(hz(67), 0, 0.18, { duty: 0.125, v: 0.12, to: hz(48) }),
    near: () => arp([76, 75, 74], 0.1, { duty: 0.25, v: 0.15, vib: 7 }),
    genius: () => { arp([72, 76, 79, 84, 88, 91, 96], 0.06, { duty: 0.25, v: 0.15 }); tone(hz(96), 0.42, 0.5, { duty: 0.125, v: 0.12, vib: 8 }); }, // 천재 등장
    scoreTick: () => hiss(0, 0.025, { short: true, v: 0.18, hp: 3000 }), // 점수판 딸깍
    // [병맛]
    squawk: () => { tone(hz(84), 0, 0.1, { duty: 0.125, v: 0.18, to: hz(91), vib: 30 }); tone(hz(88), 0.1, 0.28, { duty: 0.125, v: 0.18, to: hz(70), vib: 25 }); }, // 고무 닭 꽥
    clap: () => { for (let i = 0; i < 24; i++) hiss(Math.random() * 1.3, 0.05, { v: 0.1 + Math.random() * 0.06, hp: 1800, rate: 0.8 + Math.random() * 0.6 }); },
    aww: () => { tone(hz(67), 0, 0.9, { tri: true, v: 0.22, to: hz(55), vib: 5 }); tone(hz(71), 0, 0.9, { duty: 0.125, v: 0.06, to: hz(59) }); }, // 아~
    laugh: () => [0, 0.13, 0.26, 0.39, 0.52].forEach((a, i) => tone(hz(79 - i), a, 0.08, { duty: 0.25, v: 0.14, to: hz(74 - i) })), // 하하하
    whoosh: () => { hiss(0, 0.6, { v: 0.18, hp: 1500, rate: 0.6 }); tone(hz(60), 0, 0.55, { duty: 0.125, v: 0.06, to: hz(96) }); }, // 휘잉
    skateSlip: () => { tone(hz(84), 0, 0.15, { duty: 0.125, v: 0.12, to: hz(96) }); tone(hz(60), 0.15, 0.25, { tri: true, v: 0.25, to: hz(36) }); hiss(0.15, 0.15, { v: 0.15, lp: 900 }); },
    flipFail: () => { SFX.panelFlip(); tone(hz(64), 0.18, 0.25, { tri: true, v: 0.25, to: hz(52), vib: 12 }); }, // 넘김 아저씨 실수(띠용)
    // [마무리]
    tension: () => { for (let i = 0; i < 16; i++) snare(i * 0.06 * (1 - i * 0.02), 0.12 + i * 0.01); kick(0.95, 0.7); tone(hz(40), 0.95, 0.5, { tri: true, v: 0.35 }); }, // 역전 한 방 드럼
    sudden: () => { arp([64, 0, 64, 0, 70], 0.09, { duty: 0.5, v: 0.17 }); kick(0); kick(0.36); },
    win: () => { arp([72, 72, 72, 76, 0, 74, 77, 0, 79, 84], 0.11, { duty: 0.25, v: 0.17 }); arp([48, 0, 55, 0, 52, 0, 55, 0, 60], 0.11, { tri: true, v: 0.3 }); }, // 우승 팡파르
    lose: () => arp([76, 74, 72, 67, 0, 72], 0.12, { duty: 0.125, v: 0.15 }), // 다음엔 이긴다 띠리리
    titleUp: () => { arp([67, 71, 74, 79, 83, 86], 0.07, { duty: 0.25, v: 0.15 }); tone(hz(91), 0.45, 0.4, { duty: 0.25, v: 0.13, vib: 6 }); },
  };
  function play(name) { if (!vol.on || !vol.sfx || !ensure() || !SFX[name]) return; SFX[name](); }

  // ---------- 배경음악: 90년대 예능 밴드 느낌의 칩튠 루프(신스 브라스 + 슬랩 베이스 흉내) ----------
  const BPM = 132, STEP = 60 / BPM / 4;
  const MEL = [72, 0, 76, 0, 79, 0, 76, 77, 79, 0, 0, 81, 79, 0, 76, 0, 74, 0, 77, 0, 81, 0, 77, 79, 81, 0, 0, 83, 84, 0, 0, 0];
  const BASS = [48, 0, 48, 60, 0, 48, 0, 55, 53, 0, 53, 65, 0, 53, 0, 57, 50, 0, 50, 62, 0, 50, 0, 57, 55, 0, 55, 67, 0, 55, 59, 0];
  let step = 0, next = 0, timer = null;
  function schedule() {
    while (next < ac.currentTime + 0.2) {
      const at = next - ac.currentTime, i = step % 32, m = MEL[i], b = BASS[i];
      if (m) tone(hz(m), at, STEP * 1.5, { duty: 0.25, v: 0.12, out: musicBus });
      if (b) tone(hz(b), at, STEP * 0.85, { tri: true, v: 0.3, out: musicBus });
      if (i % 8 === 0) { const t0 = at; const k = ac.createOscillator(), g = ac.createGain(); k.type = 'triangle'; k.frequency.setValueAtTime(150, ac.currentTime + t0); k.frequency.exponentialRampToValueAtTime(45, ac.currentTime + t0 + 0.1); g.gain.setValueAtTime(0.4, ac.currentTime + t0); g.gain.linearRampToValueAtTime(0.0001, ac.currentTime + t0 + 0.12); k.connect(g); g.connect(musicBus); k.start(ac.currentTime + t0); k.stop(ac.currentTime + t0 + 0.15); }
      if (i % 8 === 4) hiss(at, 0.1, { v: 0.12, hp: 1200, out: musicBus });
      if (i % 2 === 0) hiss(at, 0.03, { short: true, v: 0.05, hp: 6000, out: musicBus });
      next += STEP; step++;
    }
  }
  function music(on) {
    if (on && vol.on && vol.music && ensure()) {
      if (timer) return;
      next = ac.currentTime + 0.05; step = 0;
      timer = setInterval(schedule, 60);
    } else if (!on && timer) { clearInterval(timer); timer = null; }
  }

  return {
    play, music, unlock, names: Object.keys(SFX),
    playing: () => !!timer,
    setVolume({ on, sfx, music: mv } = {}) {
      if (on != null) vol.on = on;
      if (sfx != null) vol.sfx = sfx;
      if (mv != null) vol.music = mv;
      applyVol();
      if (!vol.on || !vol.music) music(false);
    },
  };
}

// 점검 화면(?sfx=1)에서 쓰는 묶음과 이름
export const SFX_GROUPS = [
  ['진행', [['tvOn', '브라운관 켜짐'], ['static', '장면 전환 지지직'], ['jingle', '잠시 후 계속됩니다'], ['opening', '오프닝 팡파르'], ['roundStart', '라운드 시작 두둥'], ['spinTick', '돌림판 딱'], ['spinStop', '돌림판 멈춤'], ['panelPick', '패널 고르기'], ['panelFlip', '패널 뒤집기'], ['turnChange', '차례 바뀜']]],
  ['문제', [['cardIn', '문제 카드 휘릭'], ['press', '답 버튼'], ['tile', '글자 조각'], ['erase', '지우기'], ['confirm', '확인'], ['tick', '째깍'], ['tickFast', '째깍(5초 남음)'], ['timeUp', '시간 끝 부저']]],
  ['판정', [['ding', '정답 딩동댕'], ['buzz', '오답 땡'], ['passTurn', '기회 넘어감'], ['grayOut', '보기 지워짐'], ['near', '아까운 답'], ['genius', '천재 등장'], ['scoreTick', '점수판 딸깍']]],
  ['병맛', [['squawk', '고무 닭 꽥'], ['clap', '방청석 박수'], ['aww', '탄식 아~'], ['laugh', '웃음'], ['whoosh', '나비넥타이 휘잉'], ['skateSlip', '롤러스케이트 미끄러짐'], ['flipFail', '숫자판 실수']]],
  ['마무리', [['tension', '역전 한 방 드럼'], ['sudden', '서든데스'], ['win', '우승 팡파르'], ['lose', '다음엔 이긴다'], ['titleUp', '칭호 오름']]],
];
