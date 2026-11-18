// 소리(P4 W2): 생물 8종 소리, 게임 효과음 4종, 배경음악 1곡. Web Audio 합성, 외부 파일 없음.
// W2가 audio/ 폴더만 고친다. 게임 사건은 fx.game.on(사건, fn)으로 받는다(이름·인자는 render/core/events.js).
// 브라우저는 사용자 동작 전에는 소리를 막으니, AudioContext는 첫 pointerdown/keydown 뒤에 연다.
//
// 돌려줄 것(메인이 설정 창에 연결): { muted(), setMuted(bool), volume(), setVolume(0..1) }
import { createSfxPlayer } from './sfx.js';
import { createMusicPlayer } from './music.js';

const STORAGE_KEY = 'ow3d-sound';
const DEFAULT_VOLUME = 0.75;
const SFX_GAIN = 0.9;
const MUSIC_GAIN = 0.3; // 효과음을 덮지 않도록 배경음악은 작게 유지

function readSaved() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      volume: Number.isFinite(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume))
        : DEFAULT_VOLUME,
    };
  } catch {
    return null;
  }
}

function writeSaved(state) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      muted: state.muted,
      volume: state.volume,
    }));
  } catch {
    // 사생활 보호 창 등 저장 불가 환경 무시
  }
}

function isHidden() {
  return typeof document !== 'undefined' && !!document.hidden;
}

export function attachSound(fx) {
  const saved = readSaved();
  const state = {
    muted: saved ? saved.muted : false,
    volume: saved ? saved.volume : DEFAULT_VOLUME,
  };

  let ac = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let sfx = null;
  let music = null;
  let unlocked = false;

  function applyGain() {
    if (!ac || !master) return;
    const target = state.muted ? 0 : state.volume;
    const now = ac.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target, now + 0.03);
  }

  function syncMusic() {
    if (!unlocked || !music || !ac) return;
    if (state.muted || state.volume <= 0 || isHidden()) {
      music.stop();
    } else {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      music.start({ fromBar: true });
    }
  }

  function unlock() {
    if (typeof window === 'undefined') return false;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = state.muted ? 0 : state.volume;
      master.connect(ac.destination);

      sfxBus = ac.createGain();
      sfxBus.gain.value = SFX_GAIN;
      sfxBus.connect(master);

      musicBus = ac.createGain();
      musicBus.gain.value = MUSIC_GAIN;
      musicBus.connect(master);

      sfx = createSfxPlayer({ ac, dest: sfxBus });
      music = createMusicPlayer({ ac, dest: musicBus });
    }

    if (ac.state === 'suspended') ac.resume().catch(() => {});

    if (!unlocked) {
      try {
        // iOS Safari / Chromium 첫 동작 오디오 잠금 해제용 무음 버퍼
        const buf = ac.createBuffer(1, 1, 22050);
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        src.start(0);
      } catch {
        // 무음 버퍼 실패해도 계속 진행
      }
      unlocked = true;
      window.removeEventListener('pointerdown', onFirstGesture, true);
      window.removeEventListener('keydown', onFirstGesture, true);
    }

    applyGain();
    syncMusic();
    return true;
  }

  function onFirstGesture() {
    unlock();
  }

  function onVisibilityChange() {
    if (!ac || !unlocked) return;
    if (isHidden()) {
      if (music) music.stop();
      if (ac.state === 'running') ac.suspend().catch(() => {});
    } else {
      ac.resume().catch(() => {});
      syncMusic();
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onFirstGesture, { capture: true, passive: true });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function canPlaySfx() {
    if (state.muted || state.volume <= 0 || !unlocked || !ac || !sfx || isHidden()) return false;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return true;
  }

  const game = fx?.game;
  if (game && typeof game.on === 'function') {
    game.on('adopt', (e) => {
      if (canPlaySfx() && e?.sp) sfx.playSpecies(e.sp);
    });
    game.on('tapCreature', (e) => {
      if (canPlaySfx() && e?.sp) sfx.playSpecies(e.sp);
    });
    game.on('place', (e) => {
      if (canPlaySfx()) sfx.playGame('place', e);
    });
    game.on('capture', (e) => {
      if (canPlaySfx()) sfx.playGame('capture', e);
    });
    game.on('tier', (e) => {
      if (canPlaySfx()) sfx.playGame('tier', e);
    });
    game.on('chance', (e) => {
      if (canPlaySfx()) sfx.playGame('chance', e);
    });
  }

  return {
    muted: () => state.muted,
    setMuted(bool) {
      state.muted = Boolean(bool);
      writeSaved(state);
      applyGain();
      syncMusic();
    },
    volume: () => state.volume,
    setVolume(v) {
      const n = Number(v);
      if (!Number.isFinite(n)) return;
      state.volume = Math.min(1, Math.max(0, n));
      writeSaved(state);
      applyGain();
      syncMusic();
    },
  };
}
