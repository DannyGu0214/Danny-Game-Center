// 배경음악: assets/music/의 mp3를 먼저 틀고(2026-11-08), 파일을 못 읽으면 Web Audio 합성곡으로 대신한다(Animal World music.js와 같은 예약 방식).
// 항해의 기본 곡은 선술집 풍(2026-11-02 대니님 요청): 아코디언·피들·뜯는 현·발 구르기·탬버린.
// S4(2026-11-12): 곡을 상황(기분)으로 골라요. 평소 항해는 선술집 두 곡을 번갈아 틀고 가끔 생동감 곡, 항구에서는 축제곡, 돌풍(나중엔 S5 날씨)에는 과격한 곡. 바뀔 때는 늘 4초 동안 겹쳐 넘어가요.

const FADE_S = 4, LOOKAHEAD_S = 0.6;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function voice(ac, dest, t, end, peak, attack = 0.005) {
  const g = ac.createGain();
  g.gain.value = 0.0001; // 기본값 1이면 예약 직전 한 샘플이 크게 튄다(딸깍)
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  g.connect(dest);
  return g;
}
// 끄는 악기용: 음이 끝날 때까지 크기를 유지한다
function held(ac, dest, t, end, peak, attack = 0.02) {
  const g = ac.createGain(), atk = Math.min(attack, (end - t) * 0.3), rel = Math.min(0.05, (end - t) * 0.3);
  g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + atk); g.gain.setValueAtTime(peak, end - rel); g.gain.linearRampToValueAtTime(0.0001, end);
  g.connect(dest);
  return g;
}
function osc(ac, type, f, t, end, dest, detune = 0) {
  const o = ac.createOscillator();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(end + 0.05);
  return o;
}
const noiseBufs = new WeakMap();
function noiseOf(ac) {
  if (!noiseBufs.has(ac)) {
    const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(ac, buf);
  }
  return noiseBufs.get(ac);
}
function noiseHit(ac, dest, t, len, type, freq, peak) {
  const n = ac.createBufferSource(), f = ac.createBiquadFilter(); n.buffer = noiseOf(ac);
  f.type = type; f.frequency.value = freq;
  n.connect(f); f.connect(voice(ac, dest, t, t + len, peak, 0.002));
  n.start(t, Math.random() * 0.5); n.stop(t + len + 0.02);
}
function filtered(ac, type, freq, q, dest) { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(dest); return f; }
const INST = {
  // 아코디언: 살짝 어긋난 두 리드가 떨리는 소리(뮈제트)
  accordion(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.05, g = held(ac, dest, t, end, 0.06 * vel, 0.018), lp = filtered(ac, 'lowpass', 2300, 0.6, g);
    osc(ac, 'sawtooth', f, t, end, lp, -9); osc(ac, 'sawtooth', f, t, end, lp, 9);
  },
  // 피들: 활로 긁는 톱니파와 늦게 들어오는 떨림
  fiddle(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.04, g = held(ac, dest, t, end, 0.17 * vel, 0.022), bp = filtered(ac, 'bandpass', 1900, 0.7, g);
    const o = osc(ac, 'sawtooth', f, t, end, bp);
    if (dur > 0.28) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5.8; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.2); lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end + 0.02); }
  },
  // 양철 호루라기: 맑고 숨이 섞인 소리
  whistle(ac, dest, t, f, dur, vel) {
    const end = t + dur + 0.03, g = held(ac, dest, t, end, 0.07 * vel, 0.012);
    osc(ac, 'triangle', f * 2, t, end, g);
    noiseHit(ac, dest, t, 0.04, 'highpass', 3500, 0.012 * vel);
  },
  // 뜯는 현: 짧게 울리는 만돌린 코드 한 음
  pluck(ac, dest, t, f, dur, vel) {
    const end = t + 0.32, g = voice(ac, dest, t, end, 0.075 * vel, 0.002), lp = filtered(ac, 'lowpass', 3000, 0.8, g);
    osc(ac, 'sawtooth', f, t, end, lp); osc(ac, 'triangle', f * 2, t, t + 0.12, lp);
  },
  // 콘트라베이스: 굵게 뜯는 저음
  bass(ac, dest, t, f, dur, vel) {
    const end = t + Math.min(dur, 0.42), g = voice(ac, dest, t, end, 0.19 * vel, 0.006);
    osc(ac, 'triangle', f, t, end, g); osc(ac, 'sine', f * 2, t, t + 0.08, g);
  },
};
// 선술집 나무 바닥을 구르는 발, 탬버린, 부딪히는 잔
const PERC = {
  stomp(ac, dest, t, vel) {
    const o = ac.createOscillator(), g = voice(ac, dest, t, t + 0.16, 0.24 * vel, 0.002);
    o.frequency.setValueAtTime(135, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.1);
    o.connect(g); o.start(t); o.stop(t + 0.2);
    noiseHit(ac, dest, t, 0.03, 'lowpass', 1400, 0.09 * vel);
  },
  tamb(ac, dest, t, vel) { noiseHit(ac, dest, t, 0.075, 'highpass', 6500, 0.065 * vel); },
  clink(ac, dest, t, vel) { for (const [f, p] of [[2350, 0.03], [3620, 0.02], [5280, 0.012]]) osc(ac, 'sine', f, t, t + 0.3, voice(ac, dest, t, t + 0.3, p * vel, 0.001)); },
};

// 곡마다 16마디(8분음표 단위). bar 6이면 6/8 지그, 8이면 4/4. 음은 root에서 반음 수, null은 쉼
const CH = { I: [0, 4, 7], ii: [2, 5, 9], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16], i: [0, 3, 7], III: [3, 7, 10], iv: [5, 8, 12], v: [7, 10, 14], VI: [8, 12, 15], VII: [10, 14, 17] };
export const TRACKS = {
  pond: {
    name: '갈대 나루 선술집', root: 62, bpm: 112, bar: 6, lead: 'fiddle', lead2: 'accordion', scale: [0, 2, 3, 5, 7, 9, 10],
    chords: ['i', 'i', 'VII', 'VII', 'i', 'IV', 'v', 'i', 'III', 'VII', 'i', 'IV', 'III', 'VII', 'v', 'i'],
    melody: [
      [[12, 2], [7, 1], [10, 2], [7, 1]], [[12, 2], [14, 1], [15, 2], [14, 1]], [[17, 2], [15, 1], [14, 2], [10, 1]], [[14, 2], [12, 1], [10, 3]],
      [[12, 2], [7, 1], [10, 2], [7, 1]], [[9, 2], [10, 1], [12, 2], [14, 1]], [[15, 1], [14, 1], [12, 1], [10, 2], [9, 1]], [[12, 2], [12, 1], [12, 3]],
      [[15, 2], [17, 1], [19, 2], [17, 1]], [[17, 2], [14, 1], [10, 2], [14, 1]], [[15, 2], [14, 1], [12, 2], [10, 1]], [[9, 2], [10, 1], [12, 3]],
      [[15, 2], [17, 1], [19, 2], [22, 1]], [[22, 2], [19, 1], [17, 2], [14, 1]], [[14, 2], [12, 1], [10, 2], [9, 1]], [[12, 2], [7, 1], [12, 3]],
    ],
  },
  lake: {
    name: '한 잔 더!', root: 67, bpm: 132, bar: 8, lead: 'accordion', lead2: 'whistle', scale: [0, 2, 4, 5, 7, 9, 11],
    chords: ['I', 'I', 'IV', 'V', 'I', 'vi', 'V', 'I', 'IV', 'I', 'V', 'I', 'IV', 'I', 'V', 'I'],
    melody: [
      [[0, 1], [4, 1], [7, 2], [7, 1], [9, 1], [7, 2]], [[12, 2], [11, 1], [9, 1], [7, 2], [4, 2]], [[5, 1], [9, 1], [12, 2], [12, 1], [14, 1], [12, 2]], [[11, 2], [9, 1], [7, 1], [14, 2], [null, 2]],
      [[0, 1], [4, 1], [7, 2], [7, 1], [9, 1], [7, 2]], [[9, 2], [12, 1], [9, 1], [7, 2], [4, 2]], [[7, 1], [9, 1], [11, 1], [12, 1], [14, 2], [11, 2]], [[12, 2], [7, 2], [12, 2], [null, 2]],
      [[17, 2], [16, 1], [14, 1], [12, 2], [9, 2]], [[16, 2], [14, 1], [12, 1], [7, 2], [12, 2]], [[14, 1], [16, 1], [14, 1], [12, 1], [11, 2], [7, 2]], [[12, 2], [16, 2], [19, 2], [null, 2]],
      [[17, 2], [16, 1], [14, 1], [12, 2], [9, 2]], [[16, 2], [14, 1], [12, 1], [7, 2], [12, 2]], [[14, 2], [11, 1], [14, 1], [17, 2], [14, 2]], [[12, 2], [7, 1], [7, 1], [12, 2], [null, 2]],
    ],
  },
  river: {
    name: '노 저어라, 친구', root: 69, bpm: 118, bar: 8, lead: 'fiddle', lead2: 'accordion', scale: [0, 2, 3, 5, 7, 8, 10, 11],
    chords: ['i', 'i', 'VII', 'V', 'i', 'VI', 'V', 'i', 'III', 'VII', 'VI', 'V', 'III', 'VII', 'V', 'i'],
    melody: [
      [[0, 2], [3, 1], [5, 1], [7, 2], [7, 2]], [[7, 1], [8, 1], [7, 1], [5, 1], [3, 2], [0, 2]], [[2, 2], [5, 1], [7, 1], [10, 2], [7, 2]], [[7, 2], [11, 2], [14, 2], [null, 2]],
      [[0, 2], [3, 1], [5, 1], [7, 2], [7, 2]], [[8, 1], [7, 1], [8, 1], [10, 1], [12, 2], [8, 2]], [[7, 1], [8, 1], [7, 1], [5, 1], [11, 2], [7, 2]], [[12, 2], [7, 2], [12, 2], [null, 2]],
      [[15, 2], [15, 1], [14, 1], [12, 2], [10, 2]], [[14, 2], [14, 1], [12, 1], [10, 2], [7, 2]], [[12, 2], [12, 1], [10, 1], [8, 2], [12, 2]], [[11, 2], [14, 2], [11, 1], [7, 1], [null, 2]],
      [[15, 2], [15, 1], [17, 1], [19, 2], [15, 2]], [[17, 2], [14, 1], [12, 1], [10, 2], [14, 2]], [[14, 1], [12, 1], [11, 1], [14, 1], [11, 2], [7, 2]], [[12, 2], [7, 1], [7, 1], [12, 2], [null, 2]],
    ],
  },
  // ── S4 상황 곡(mp3가 생기기 전까지 쓰는 합성곡) ──
  // 생동감: 평소 항해 중간중간. 8분음표가 쉬지 않고 달리는 릴, 선술집 곡보다 조금 빠르다
  lively: {
    name: '순풍이다!', root: 62, bpm: 140, bar: 8, lead: 'fiddle', lead2: 'whistle', scale: [0, 2, 4, 5, 7, 9, 11],
    chords: ['I', 'I', 'IV', 'V', 'I', 'vi', 'ii', 'V', 'IV', 'I', 'IV', 'V', 'vi', 'IV', 'V', 'I'],
    melody: [
      [[7, 1], [4, 1], [7, 1], [12, 1], [11, 1], [12, 1], [14, 1], [12, 1]], [[16, 2], [14, 1], [12, 1], [11, 1], [9, 1], [7, 2]], [[9, 1], [12, 1], [14, 1], [12, 1], [9, 1], [7, 1], [5, 2]], [[7, 1], [11, 1], [14, 1], [11, 1], [9, 2], [7, 2]],
      [[7, 1], [4, 1], [7, 1], [12, 1], [11, 1], [12, 1], [14, 1], [16, 1]], [[16, 2], [12, 1], [9, 1], [12, 2], [9, 2]], [[14, 1], [12, 1], [9, 1], [5, 1], [2, 2], [5, 1], [7, 1]], [[11, 2], [7, 1], [11, 1], [14, 2], [null, 2]],
      [[17, 2], [16, 1], [14, 1], [12, 1], [14, 1], [17, 2]], [[16, 1], [14, 1], [12, 1], [16, 1], [19, 2], [16, 2]], [[17, 1], [16, 1], [14, 1], [12, 1], [9, 2], [12, 2]], [[14, 1], [11, 1], [7, 1], [11, 1], [14, 2], [11, 2]],
      [[16, 1], [12, 1], [9, 1], [12, 1], [16, 2], [19, 2]], [[17, 1], [16, 1], [14, 1], [12, 1], [9, 1], [12, 1], [17, 2]], [[19, 1], [17, 1], [16, 1], [14, 1], [11, 2], [14, 2]], [[12, 2], [7, 1], [4, 1], [0, 2], [null, 2]],
    ],
  },
  // 항구: 서민적인 장터 축제. 쿵짝 폴카에 잔 부딪히는 소리가 자주 난다
  port: {
    name: '부두 장날', root: 65, bpm: 120, bar: 8, lead: 'accordion', lead2: 'whistle', scale: [0, 2, 4, 5, 7, 9, 11], clinks: 4,
    chords: ['I', 'I', 'V', 'I', 'IV', 'I', 'V', 'I', 'IV', 'IV', 'I', 'I', 'V', 'V', 'I', 'I'],
    melody: [
      [[0, 1], [2, 1], [4, 2], [7, 2], [4, 2]], [[9, 2], [7, 1], [4, 1], [0, 2], [4, 2]], [[2, 1], [4, 1], [5, 2], [7, 2], [11, 2]], [[12, 2], [7, 2], [4, 2], [null, 2]],
      [[5, 1], [7, 1], [9, 2], [12, 2], [9, 2]], [[7, 2], [4, 1], [7, 1], [12, 2], [7, 2]], [[11, 1], [12, 1], [14, 1], [11, 1], [7, 2], [2, 2]], [[0, 2], [4, 2], [0, 2], [null, 2]],
      [[9, 2], [12, 1], [9, 1], [5, 2], [9, 2]], [[12, 1], [14, 1], [12, 1], [9, 1], [5, 4]], [[7, 2], [9, 1], [7, 1], [4, 2], [7, 2]], [[12, 2], [11, 1], [9, 1], [7, 4]],
      [[11, 1], [12, 1], [14, 2], [11, 2], [7, 2]], [[14, 1], [12, 1], [11, 1], [9, 1], [7, 4]], [[4, 1], [7, 1], [12, 2], [9, 1], [7, 1], [4, 2]], [[0, 2], [7, 1], [7, 1], [0, 2], [null, 2]],
    ],
  },
  // 과격함: 기상이변(지금은 돌풍). 아주 빠른 단조, 저음이 박마다 몰아치고 잔 소리는 없다
  storm: {
    name: '돌풍 속으로', root: 64, bpm: 156, bar: 8, lead: 'fiddle', lead2: 'accordion', scale: [0, 2, 3, 5, 7, 8, 10, 11], drive: true, clinks: 0,
    chords: ['i', 'i', 'VI', 'V', 'i', 'iv', 'V', 'i', 'VI', 'VII', 'i', 'i', 'iv', 'VI', 'V', 'V'],
    melody: [
      [[0, 1], [3, 1], [7, 1], [3, 1], [12, 1], [7, 1], [3, 1], [7, 1]], [[12, 1], [11, 1], [12, 1], [14, 1], [15, 2], [12, 2]], [[15, 1], [12, 1], [8, 1], [12, 1], [15, 1], [17, 1], [15, 1], [12, 1]], [[11, 2], [14, 1], [11, 1], [7, 2], [null, 2]],
      [[0, 1], [3, 1], [7, 1], [3, 1], [12, 1], [7, 1], [3, 1], [7, 1]], [[8, 1], [12, 1], [17, 1], [12, 1], [8, 2], [5, 2]], [[7, 1], [8, 1], [11, 1], [14, 1], [11, 1], [8, 1], [7, 1], [5, 1]], [[3, 2], [0, 2], [0, 2], [null, 2]],
      [[20, 2], [19, 1], [17, 1], [15, 2], [12, 2]], [[17, 2], [15, 1], [14, 1], [10, 2], [14, 2]], [[15, 1], [14, 1], [15, 1], [19, 1], [24, 2], [19, 2]], [[19, 1], [15, 1], [12, 1], [15, 1], [19, 2], [15, 2]],
      [[17, 1], [20, 1], [17, 1], [12, 1], [8, 2], [12, 2]], [[15, 1], [17, 1], [15, 1], [12, 1], [8, 2], [15, 2]], [[14, 1], [11, 1], [7, 1], [11, 1], [14, 1], [17, 1], [14, 1], [11, 1]], [[11, 2], [14, 2], [11, 2], [null, 2]],
    ],
  },
};
// 상황(기분). S5 날씨가 생기면 그쪽에서 music.setMood('storm')을 부르면 돼요
export const MOODS = ['sail', 'port', 'storm'];
export function moodOf({ docked = false, gustOn = false, gustSoon = false, storm = false } = {}) {
  if (docked) return 'port';
  if (storm || gustOn || gustSoon) return 'storm'; // 돌풍 예고부터 곡이 바뀌는 것 자체가 전조예요(13절)
  return 'sail';
}
// 평소 항해 곡 고르기. 수역마다 선술집 두 곡(자기 곡 + 이웃 수역 곡)을 번갈아 틀어요.
// 한 차례는 평소 항해 시간으로 TURN_S초(mp3 한 바퀴쯤), 생동감 곡은 LIVELY_S초.
// 선술집 곡이 2차례 이상 지나면 다음 차례마다 35% 확률로 생동감 곡, 4차례가 지나면 반드시 생동감 곡. 생동감 곡은 연달아 나오지 않아요.
export const SAIL_SETS = { pond: ['pond', 'lake'], lake: ['lake', 'pond'], river: ['river', 'lake'], sea: ['sea', 'river'], ocean: ['sea', 'river'] };
export const TURN_S = 150, LIVELY_S = 90, LIVELY = { after: 2, chance: 0.35, must: 4 };
export function startSail(region) { const set = SAIL_SETS[region] || SAIL_SETS.river; return { region, track: set[0], k: 0, since: 0, left: TURN_S }; }
export function nextSail(d, rand = Math.random) {
  const set = SAIL_SETS[d.region] || SAIL_SETS.river;
  if (d.track !== 'lively') {
    const since = d.since + 1;
    if (since >= LIVELY.must || (since >= LIVELY.after && rand() < LIVELY.chance)) return { ...d, track: 'lively', since: 0, left: LIVELY_S };
    const k = (d.k + 1) % set.length;
    return { ...d, track: set[k], k, since, left: TURN_S };
  }
  const k = (d.k + 1) % set.length; // 생동감 곡 뒤에는 다음 선술집 곡
  return { ...d, track: set[k], k, left: TURN_S };
}
// 지금 틀 곡: 항구·폭풍은 그 곡, 평소 항해는 순서표의 곡
export const trackFor = (mood, d) => (mood === 'port' || mood === 'storm' ? mood : d.track);
// 슬라이더 값(0~1) → 크기 배율. 귀는 크기를 로그로 느끼니 제곱으로 줄여요(절반 = -12dB). 0이면 정말 0
export const levelOf = (v) => (v > 0 ? Math.min(1, v) ** 2 : 0);
const INTRO_BARS = 2;


// 곡마다 mp3. 파일이 없거나(READY 밖, 2026-11-12 기준 lively·port·storm) 못 읽는 곡은 합성곡으로 틀어요. 바다·대양 곡(sea)은 그 수역이 생기면 써요
export const FILES = { pond: 'pond', lake: 'lake', river: 'river', sea: 'sea', lively: 'lively', port: 'port', storm: 'storm' };
// 저장소에 실제로 있는 mp3. 여기 없는 곡은 찾지 않고 바로 합성곡으로 틀어요(없는 파일을 찾다 콘솔에 404가 쌓이지 않게). 새 mp3가 오면 여기에 더해요
export const READY = new Set(['pond', 'lake', 'river', 'sea']);
// mp3는 평균 -17.5dB(RMS 약 0.13)라 합성곡(RMS 약 0.035)과 크기를 맞추려고 줄인다
const FILE_GAIN = 0.42;
export function createMusic({ volume = 0.65, rand = Math.random, base = 'assets/music/' } = {}) { // 파도 소리(RMS 약 0.06)에 묻히지 않을 크기
  let ac = null, bus = null, verb = null, timer = null, on = true, paused = false, cur = null, lastT = 0;
  let user = 1, mood = 'sail', dir = startSail('pond'); // user = 음악 슬라이더(0~1), dir = 평소 항해 곡 순서
  // 파일 곡: 곡마다 audio 하나를 만들어 두고 이음새 없이 반복한다. 실패한 곡은 failed에 넣고 합성곡으로 간다
  const files = {}, failed = new Set(Object.values(FILES).filter((n) => !READY.has(n)));
  let fileCur = null;
  const wanted = () => trackFor(mood, dir);
  const audible = () => on && !paused && user > 0;
  const fileOf = (id) => (FILES[id] && !failed.has(FILES[id]) ? FILES[id] : null);
  function fileTrack(name) {
    if (files[name]) return files[name];
    const el = new Audio(); el.src = `${base}${name}.mp3`; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
    const g = ac.createGain(); g.gain.value = 0.0001; g.connect(bus);
    const src = ac.createMediaElementSource(el); src.connect(g);
    const f = files[name] = { name, el, g };
    el.addEventListener('error', () => miss(name));
    return f;
  }
  // 없는 파일은 처음에 HEAD로 알아 둔다(틀던 곡을 내린 뒤에야 없는 걸 알면 잠깐 비니까). 오프라인이면 실패로 보고 합성곡
  function miss(name) {
    failed.add(name);
    const f = files[name];
    if (f && fileCur === f) { fileCur = null; fade(f.g, 0.0001, 0.3); setTimeout(() => f.el.pause(), 500); }
  }
  function probe() {
    if (typeof fetch !== 'function') return;
    for (const name of new Set(Object.values(FILES))) if (!failed.has(name)) fetch(`${base}${name}.mp3`, { method: 'HEAD', cache: 'no-cache' }).then((r) => { if (!r.ok) miss(name); }, () => miss(name));
  }
  function fade(g, to, s) { const t = ac.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), t + s); }
  function playFile(f) { const p = f.el.play(); if (p && p.catch) p.catch(() => { /* 자동 재생이 막히면 다음 탭에서 다시 */ }); }
  function letGo(f) { fade(f.g, 0.0001, FADE_S); setTimeout(() => { if (fileCur !== f) f.el.pause(); }, FADE_S * 1000 + 200); }
  function stopSynth() {
    if (!cur) return;
    const old = cur, t = ac.currentTime; old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(Math.max(0.0001, old.g.gain.value), t); old.g.gain.exponentialRampToValueAtTime(0.0001, t + FADE_S);
    setTimeout(() => old.g.disconnect(), (FADE_S + 1) * 1000); cur = null;
  }
  function tickFile() {
    const name = fileOf(wanted());
    if (!name) { if (fileCur) { letGo(fileCur); fileCur = null; } return false; }
    if (!fileCur || fileCur.name !== name) {
      const old = fileCur, f = fileTrack(name);
      if (old) letGo(old);
      stopSynth();
      fileCur = f; playFile(f); fade(f.g, FILE_GAIN, FADE_S);
    } else if (fileCur.el.paused) playFile(fileCur);
    return true;
  }
  function makeReverb() {
    const len = Math.floor(ac.sampleRate * 0.9), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    const c = ac.createConvolver(); c.buffer = buf;
    const wet = ac.createGain(); wet.gain.value = 0.18; // 나무 벽 방 정도의 짧은 울림
    c.connect(wet); wet.connect(bus);
    return c;
  }
  function begin(id, t) {
    const T = TRACKS[id], g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + FADE_S);
    g.connect(bus); g.connect(verb);
    cur = { id, T, g, nextBar: t + 0.05, i: -INTRO_BARS, e: 60 / T.bpm / (T.bar === 6 ? 3 : 2) };
  }
  function scheduleBar(c) {
    const { T, i, nextBar: t, e, g } = c, pos = i < 0 ? 0 : i % T.chords.length, ch = CH[T.chords[pos]];
    const human = () => (rand() - 0.5) * 0.014;
    const play = (inst, at, semis, dur, vel) => INST[inst](ac, g, at + human(), mtof(T.root + semis), dur, vel * (0.9 + rand() * 0.2));
    const hit = (kind, at, vel) => PERC[kind](ac, g, at + human(), vel);
    // 쿵(저음·발) 짝(코드) 반주. 6/8은 쿵-짝짝 쿵-짝짝, 4/4는 쿵-짝 쿵-짝
    const beats = T.bar === 6 ? [0, 3] : [0, 2, 4, 6], offs = T.bar === 6 ? [1, 2, 4, 5] : [1, 3, 5, 7];
    beats.forEach((b, k) => {
      const fifth = T.bar === 6 ? k === 1 : k % 2 === 1;
      if (T.bar === 6 || k % 2 === 0) play('bass', t + b * e, (fifth ? ch[2] - 12 : ch[0]) - 24, e * 1.6, 1);
      hit('stomp', t + b * e, k === 0 ? 1 : 0.72);
      if (T.drive) play('bass', t + (b + 1) * e, ch[0] - 24, e * 0.8, 0.55); // 몰아치는 곡: 저음이 8분음표로 달린다
    });
    if (T.bar === 8) beats.filter((_, k) => k % 2 === 1).forEach((b) => play('bass', t + b * e, ch[2] - 36, e * 1.6, 0.8));
    offs.forEach((b, k) => {
      const at = t + b * e;
      if (T.bar === 8 ? k % 2 === 0 || k === 3 : k % 2 === 1) { ch.forEach((n, q) => play('accordion', at, n - 12, e * 0.72, 0.42)); ch.forEach((n, q) => play('pluck', at + q * 0.009, n, e, 0.5)); hit('tamb', at, 1); }
      else hit('tamb', at, 0.55);
    });
    if (i >= 0) {
      const cycle = Math.floor(i / T.chords.length), inB = pos >= 8, lead = inB ? T.lead2 : T.lead;
      let at = t;
      T.melody[pos].forEach(([n, len], k) => {
        if (n != null) {
          // 긴 음 앞에 가끔 꾸밈음을 넣어 민요 맛을 낸다
          if (len >= 2 && k === 0 && rand() < 0.3) play(lead, at - 0.05, n + 2, 0.05, 0.55);
          play(lead, at, n, e * len * 0.92, k === 0 ? 1 : 0.86);
          if (cycle % 2 === 1 && !inB) play('accordion', at, n - 12, e * len * 0.9, 0.5); // 두 번째 돌 때는 아코디언이 겹친다
        }
        at += e * len;
      });
      const every = T.clinks ?? 8;
      if (every && pos % every === every - 1 && rand() < 0.7) hit('clink', t + e * (T.bar - 1), 1);
    }
    c.nextBar += e * T.bar; c.i++;
  }
  function tick() {
    if (!ac) return;
    const now = ac.currentTime, dt = Math.min(1, Math.max(0, now - lastT)); lastT = now;
    if (!audible() || ac.state !== 'running') return;
    if (mood === 'sail') { dir.left -= dt; if (dir.left <= 0) dir = nextSail(dir, rand); } // 평소 항해 시간만 센다(항구·폭풍 동안은 멈춤)
    if (tickFile()) return;
    const until = now + LOOKAHEAD_S, w = wanted(), sid = TRACKS[w] ? w : 'river'; // 합성곡이 없는 곡(sea)은 강 곡으로
    if (!cur) begin(sid, now + 0.1);
    if (cur.nextBar < now) cur.nextBar = now + 0.05; // 멈췄다 돌아오면 밀린 음표를 치지 않는다
    if (cur.id !== sid) {
      const old = cur, t = cur.nextBar;
      old.g.gain.setValueAtTime(1, t); old.g.gain.exponentialRampToValueAtTime(0.0001, t + FADE_S);
      setTimeout(() => old.g.disconnect(), (t - now + FADE_S + 2) * 1000);
      begin(sid, t);
    }
    while (cur.nextBar < until) scheduleBar(cur);
  }
  // 항구에서 시작하면 처음 탭에 항구 곡을 트니, 이 수역의 항해 곡도 그 탭 안에서 한 번 틀었다 멈춰 둔다(iOS는 탭으로 한 번 튼 audio만 나중에 틀어 줌)
  function prime() {
    for (const id of SAIL_SETS[dir.region] || []) {
      const n = fileOf(id); if (!n || files[n]) continue;
      const f = fileTrack(n), p = f.el.play();
      if (p && p.then) p.then(() => { if (fileCur !== f) f.el.pause(); }, () => {}); else if (fileCur !== f) f.el.pause();
    }
  }
  // 꺼지거나 멈추거나 0으로 내리면 소리가 줄어든 뒤 파일 재생도 멈춘다(배터리)
  function holdFiles() { const f = fileCur; if (f) setTimeout(() => { if (!audible()) f.el.pause(); }, 700); }
  const busLevel = () => volume * levelOf(user);
  function level(quick = false) {
    if (!bus) return;
    const t = ac.currentTime, v = audible() ? busLevel() : 0;
    bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.setTargetAtTime(v, t, quick ? 0.04 : 0.12); // 끄면 0.7초 뒤 -50dB
  }
  function wake(quick) { level(quick); if (audible()) { if (ac) tickFile(); } else holdFiles(); }
  return {
    start(ctx) {
      if (ac || !ctx) return;
      ac = ctx; bus = ac.createGain(); bus.gain.value = 0; bus.connect(ac.destination);
      verb = makeReverb(); level(); lastT = ac.currentTime; probe();
      timer = setInterval(tick, 50); tick();
      if (audible()) { tickFile(); prime(); } // 탭한 그 순간에 재생을 시작해야 iOS가 막지 않는다
    },
    // 화면을 탭할 때마다: 막혔던 파일 재생을 그 탭 안에서 다시 시작한다(iOS)
    kick() { if (ac && audible() && fileCur && fileCur.el.paused) playFile(fileCur); },
    setRegion(id) { if ((SAIL_SETS[id] || TRACKS[id]) && id !== dir.region) dir = startSail(id); },
    // 상황 바꾸기: 'sail' | 'port' | 'storm'. 곡은 4초 동안 겹쳐 넘어가요(합성곡은 다음 마디부터)
    setMood(m) { if (MOODS.includes(m)) mood = m; },
    get mood() { return mood; },
    setOn(v) { on = !!v; wake(); },
    get on() { return on; },
    // 음악 슬라이더(0~1). 끄는 동안 바로 들리게 빠르게 따라가요
    setVolume(v) { const was = audible(); user = Math.max(0, Math.min(1, Number(v) || 0)); if (audible() !== was) wake(true); else level(true); },
    get volume() { return user; },
    pause() { paused = true; level(); holdFiles(); },
    resume() { paused = false; level(); if (ac && audible()) tickFile(); },
    get track() { return wanted(); },
    get current() { return fileCur ? `${fileCur.name}.mp3` : cur?.T.name ?? null; },
    get failed() { return [...failed]; },
    get turn() { return { ...dir, left: Math.round(dir.left) }; },
    skipTurn() { dir.left = 0; }, // 점검용: 평소 항해 다음 차례로
    // 점검용: 오프라인 컨텍스트에 한 곡을 seconds만큼 예약한다(음악 슬라이더 값도 반영)
    renderInto(ctx, id, seconds) {
      ac = ctx; bus = ac.createGain(); bus.gain.value = on ? busLevel() : 0; bus.connect(ac.destination);
      verb = makeReverb(); begin(id, 0); cur.i = 0;
      while (cur.nextBar < seconds) scheduleBar(cur);
    },
    get timer() { return timer; },
  };
}
export const TRACK_IDS = Object.keys(TRACKS);
