// S4 음악·사운드: 곡 고르기 규칙과 소리 설정 저장(브라우저 없이 도는 순수 함수만)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, FILES, SAIL_SETS, TURN_S, LIVELY_S, LIVELY, MOODS, moodOf, startSail, nextSail, trackFor, levelOf } from '../music.js';
import { readAudioPrefs, writeAudioPrefs, audible, AUDIO_GROUPS } from '../sound.js';

const seeded = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

test('상황: 항구가 가장 먼저, 돌풍은 예고부터 폭풍 곡, 아니면 평소 항해', () => {
  assert.deepEqual(MOODS, ['sail', 'port', 'storm']);
  assert.equal(moodOf({}), 'sail');
  assert.equal(moodOf({ gustSoon: true }), 'storm');
  assert.equal(moodOf({ gustOn: true }), 'storm');
  assert.equal(moodOf({ storm: true }), 'storm', 'S5 날씨가 넘길 신호');
  assert.equal(moodOf({ docked: 'reed', gustOn: true }), 'port', '항구에 묶여 있으면 돌풍이어도 축제곡');
  const d = startSail('lake');
  assert.equal(trackFor('port', d), 'port');
  assert.equal(trackFor('storm', d), 'storm');
  assert.equal(trackFor('sail', d), 'lake', '수역에 들어가면 그 수역 곡부터');
});

test('평소 항해: 선술집 두 곡을 번갈아, 생동감 곡은 2차례 뒤부터 가끔, 4차례면 반드시, 연달아는 안 나온다', () => {
  // 확률이 절대 안 맞는 경우: 선술집 4차례 뒤 생동감
  let d = startSail('pond'); const never = [d.track];
  for (let i = 0; i < 6; i++) { d = nextSail(d, () => 0.99); never.push(d.track); }
  assert.deepEqual(never, ['pond', 'lake', 'pond', 'lake', 'lively', 'pond', 'lake']);
  // 늘 맞는 경우: 선술집 2차례마다 생동감
  d = startSail('river'); const always = [d.track];
  for (let i = 0; i < 6; i++) { d = nextSail(d, () => 0); always.push(d.track); }
  assert.deepEqual(always, ['river', 'lake', 'lively', 'river', 'lake', 'lively', 'river']);
  // 긴 항해: 비율과 간격
  d = startSail('lake'); let lively = 0, gap = 0, maxGap = 0, prev = d.track, time = 0;
  const rand = seeded(7);
  for (let i = 0; i < 2000; i++) {
    d = nextSail(d, rand); time += d.left;
    assert.ok(!(prev === 'lively' && d.track === 'lively'), '생동감 곡이 연달아 나왔다');
    assert.equal(d.left, d.track === 'lively' ? LIVELY_S : TURN_S);
    if (d.track === 'lively') { lively++; maxGap = Math.max(maxGap, gap); gap = 0; } else gap++;
    assert.ok(SAIL_SETS.lake.includes(d.track) || d.track === 'lively', d.track);
    prev = d.track;
  }
  assert.ok(maxGap <= LIVELY.must, `선술집 곡이 ${maxGap}차례 이어졌다`);
  assert.ok(lively / 2000 > 0.22 && lively / 2000 < 0.32, `생동감 곡 비율 ${lively / 2000}`);
});

test('곡마다 틀 것이 있다: mp3가 없거나 못 읽어도 합성곡으로 간다', () => {
  const all = new Set([...Object.values(SAIL_SETS).flat(), 'lively', 'port', 'storm']);
  for (const id of all) {
    assert.ok(FILES[id], `${id} mp3 이름`);
    assert.ok(TRACKS[id] || id === 'sea', `${id} 합성곡(sea는 강 곡으로)`);
  }
  // 생동감은 선술집보다 조금 빠르고, 폭풍은 그보다 더 빠르다(박 기준. 6/8 지그는 점4분음표가 한 박)
  const tavern = Math.max(...['pond', 'lake', 'river'].map((k) => TRACKS[k].bpm));
  assert.ok(TRACKS.lively.bpm > tavern && TRACKS.storm.bpm > TRACKS.lively.bpm);
});

test('소리 설정: 예전 저장(켜고 끄기 둘)을 이어 받고, 저장한 값을 다시 읽으면 같다', () => {
  assert.deepEqual(AUDIO_GROUPS, ['mus', 'fx', 'amb']);
  const fresh = readAudioPrefs(null);
  for (const k of AUDIO_GROUPS) assert.deepEqual(fresh[k], { on: true, vol: 100 }, '기본은 지금 크기');
  const oldSnd = readAudioPrefs({ snd: false, mus: true });
  assert.deepEqual([oldSnd.mus.on, oldSnd.fx.on, oldSnd.amb.on], [true, false, false], '예전 소리 끔 = 효과음·물바람 끔');
  const oldMus = readAudioPrefs({ snd: true, mus: false });
  assert.deepEqual([oldMus.mus.on, oldMus.fx.on, oldMus.amb.on], [false, true, true]);
  const p = { mus: { on: true, vol: 35 }, fx: { on: false, vol: 80 }, amb: { on: true, vol: 0 } };
  const saved = JSON.parse(JSON.stringify(writeAudioPrefs(p)));
  assert.deepEqual(readAudioPrefs(saved), p);
  assert.equal(saved.snd, true, '예전 버전이 읽어도 물바람이 켜져 있으니 소리 켬');
  assert.equal(saved.mus, true);
  const odd = readAudioPrefs({ vol: { mus: 150, fx: -3, amb: 'x' } });
  assert.deepEqual([odd.mus.vol, odd.fx.vol, odd.amb.vol], [100, 0, 100], '이상한 값은 잘라요');
  assert.equal(audible({ on: true, vol: 0 }), false, '0이면 무음');
  assert.equal(audible({ on: false, vol: 70 }), false);
  assert.equal(audible({ on: true, vol: 1 }), true);
});

test('슬라이더 크기: 0이면 정확히 0, 100이면 지금 크기, 절반은 -12dB', () => {
  assert.equal(levelOf(0), 0);
  assert.equal(levelOf(-1), 0);
  assert.equal(levelOf(1), 1);
  assert.equal(levelOf(0.5), 0.25);
  for (let v = 0.05; v <= 1; v += 0.05) assert.ok(levelOf(v) > levelOf(v - 0.05));
});
