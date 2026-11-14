// 화면 흐름: 타이틀 → (처음이면) 팀 고르기 → 판 준비 → 오프닝 → 1부 → 2부 → 3부 → (서든데스) → 시상식.
// 규칙은 logic.js, 그림은 art.js, 소리는 sound.js. 여기서는 순서·입력·연출·저장만 다룬다.
import {
  createMatch, advance, startRound, answer, chooseCell, attemptOf, remainingChoices, timeFor, cpuDecide, cpuPickCell,
  catName, CATS, CPU_SKILL, TIER_NAME, titleOf, nextTitle, newProfile, recordResult, highlight, BOARD_ROWS,
} from './logic.js';
import { choseong, makeTiles } from './hangul.js';
import { createStage, drawLogo, drawDuoCard, drawTrophy, DUOS, DUO_IDS } from './art.js';
import { createSound, SFX_GROUPS } from './sound.js';

// 문제은행: bank/(문제은행 칸 담당)가 있으면 그걸, 없으면 테스트용 샘플로 돈다
// 실제 문제은행은 대니님 검수를 거친 live 문항만 낸다(draft·checked는 아직 검수 전)
let BANK;
try { BANK = (await import('./bank/index.js')).BANK.filter((q) => q.status === 'live'); } catch { BANK = (await import('./test/fixtures/bank/index.js')).BANK; }

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sound = createSound();

// ---------- 저장(기기마다 따로) ----------
const KEY = 'quiz-quiz-2026';
const DEFAULTS = { sound: true, sfxVol: 3, musicVol: 2, noTimer: false, skill: 'normal' }; // 음량은 0~4칸
let save = { settings: { ...DEFAULTS }, profile: null, recent: [] };
try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (s) save = { ...save, ...s, settings: { ...DEFAULTS, ...s.settings } }; } catch { /* 저장소를 못 쓰면 이번 실행만 */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* 무시 */ } };
const S = save.settings;
const applySound = () => sound.setVolume({ on: S.sound, sfx: S.sfxVol / 4, music: S.musicVol / 4 });
applySound();
// iOS 사파리: 첫 터치 뒤에만 소리가 난다
addEventListener('pointerdown', () => sound.unlock(), { once: true, capture: true });

// ---------- 화면 크기 ----------
function fit() { const s = Math.min(innerWidth / 480, innerHeight / 270); document.documentElement.style.setProperty('--s', s.toFixed(4)); }
addEventListener('resize', fit); fit();

// ---------- 무대 ----------
const stage = createStage($('view'));
const st = { t: 0, dim: false, vs: null, turn: null, duo: ['tall-short', 'siblings'], react: [null, null], reactT: [0, 0], talk: null, cardFlip: false, banjjak: null, think: [false, false], cheer: false };
let screen = 'title', last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; st.t += dt;
  if (screen === 'title') drawLogo($('logo'), st.t);
  else if (screen === 'game' || screen === 'awards') stage.draw(st, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function show(name) {
  screen = name;
  for (const id of ['title', 'teamPick', 'setup', 'settings', 'game', 'awards', 'sfxCheck']) $(id).classList.toggle('hide', id !== name && !(name === 'awards' && id === 'game'));
  $('logo').classList.toggle('hide', !['title', 'teamPick', 'setup', 'settings', 'sfxCheck'].includes(name));
}
function tvStatic() { const el = $('static'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); sound.play('static'); }

// ---------- 말풍선 ----------
// 말풍선 자리: 진행자는 고개 아래, 팀은 머리 위(꼬리가 아래)
const SPOT = { na: [120, 70, 56], wang: [214, 70, 76], 0: [6, 80, 40], 1: [274, 80, 160] };
function bubble(who, text, { cls = 'host', ms = 0 } = {}) {
  const el = document.createElement('div');
  el.className = `bubble ${cls}`; el.textContent = text;
  const [x, y, tail] = SPOT[who];
  el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.setProperty('--tail', `${tail}px`);
  if (who === 0 || who === 1) el.classList.add('down');
  $('bubbles').append(el);
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
}
const clearBubbles = () => { $('bubbles').innerHTML = ''; };
// 진행자 대사: 화면을 누르면 넘어간다
async function say(who, text, ms = 2200) {
  st.talk = who;
  const el = bubble(who, text);
  await Promise.race([wait(ms), tapOnce()]);
  el.remove(); st.talk = null;
}
function tapOnce() {
  return new Promise((r) => { const h = () => { removeEventListener('pointerdown', h); r(); }; setTimeout(() => addEventListener('pointerdown', h), 250); });
}
async function caption(text, sub = '', ms = 1500, cls = '') {
  const el = $('caption');
  el.className = `outline ${cls}`;
  el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  await wait(ms);
}

// ---------- 타이틀 ----------
function renderBadge() {
  const p = save.profile, el = $('teamBadge');
  if (!p) { el.classList.add('hide'); return; }
  el.classList.remove('hide');
  const ti = titleOf(p.wins), nx = nextTitle(p.wins);
  el.innerHTML = `<b>${DUOS[p.duo].name}</b> · ${ti.name}<br>${p.wins}승 ${p.losses}패${p.draws ? ` ${p.draws}무` : ''} · 누적 ${p.totalScore.toLocaleString()}점${nx ? `<br>다음 칭호 "${nx.name}"까지 ${nx.wins - p.wins}승` : ''}`;
}
function toTitle() { renderBadge(); show('title'); sound.music(false); }

$('soloBtn').onclick = () => { sound.unlock(); openSetup('solo'); };
$('duoBtn').onclick = () => { sound.unlock(); openSetup('duo'); };

// ---------- 팀 고르기(처음 실행, 리셋 뒤) ----------
let pickedDuo = null;
function openTeamPick() {
  pickedDuo = null; $('teamHint').textContent = '위에서 팀을 눌러 골라 주세요'; $('teamHint').classList.remove('ok');
  const box = $('teamCards'); box.innerHTML = '';
  for (const id of DUO_IDS) {
    const b = document.createElement('button');
    b.className = 'duoCard';
    b.innerHTML = `<canvas></canvas>${DUOS[id].name}<small>${DUOS[id].rel}</small>`;
    drawDuoCard(b.querySelector('canvas'), id);
    b.onclick = () => { pickedDuo = id; sound.play('press'); [...box.children].forEach((c) => c.classList.toggle('on', c === b)); $('teamHint').textContent = `${DUOS[id].name} 팀으로 나가요!`; $('teamHint').classList.add('ok'); };
    box.append(b);
  }
  show('teamPick');
}
// 팀을 안 고르고 누르면 반응 없이 끝나지 않게, 카드를 흔들어 고르라고 알려 준다
$('teamOk').onclick = () => {
  if (!pickedDuo) { sound.play('aww'); const box = $('teamCards'); box.classList.remove('nudge'); void box.offsetWidth; box.classList.add('nudge'); return; }
  save.profile = newProfile(pickedDuo); persist(); sound.play('titleUp'); toTitle(); };

// ---------- 판 준비 ----------
let mode = 'solo', skill = S.skill, p2Duo = null;
const otherDuos = () => DUO_IDS.filter((d) => d !== save.profile.duo);
function openSetup(m) {
  if (!save.profile) { openTeamPick(); return; }
  mode = m; skill = S.skill; p2Duo = otherDuos()[0];
  $('setupTitle').textContent = m === 'solo' ? '혼자 하기 · 컴퓨터와 대결' : '둘이 하기 · 1P(A팀) vs 2P(B팀)';
  renderSetup(); show('setup');
}
// 실력마다 한 줄 설명과 왕대박의 한마디(병맛)
const SKILL_NOTE = { easy: '처음 하는 친구에게', normal: '비슷하게 겨뤄요', hard: '이기기 어려워요' };
const SKILL_QUIP = { easy: '왕대박: "컴퓨터가 오늘 감기 기운이 있답니다~"', normal: '왕대박: "실력은 딱 반반! 대~박 승부!"', hard: '왕대박: "컴퓨터가 밤새 공부하고 왔대요… 덜덜"' };
function renderSetup() {
  const body = $('setupBody'), me = save.profile;
  if (mode === 'solo') {
    body.innerHTML = `<p>우리 팀 <b style="color:var(--a)">${DUOS[me.duo].name}</b> vs 컴퓨터 팀 <b style="color:var(--b)">${DUOS[p2Duo].name}</b></p><p style="margin-top:6px">이번 판 컴퓨터 실력을 골라요</p><div class="row" id="skills"></div><p class="skillQuip" id="skillQuip"></p>`;
    for (const [k, v] of Object.entries(CPU_SKILL)) {
      const b = document.createElement('button');
      b.className = `pick${k === skill ? ' on' : ''}`;
      b.innerHTML = `${v.name}<small>${SKILL_NOTE[k]}</small>`;
      b.onclick = () => { skill = k; S.skill = k; persist(); sound.play('press'); renderSetup(); };
      $('skills').append(b);
    }
    $('skillQuip').textContent = SKILL_QUIP[skill];
  } else {
    body.innerHTML = `<p>1P는 우리 팀 <b style="color:var(--a)">${DUOS[me.duo].name}</b>이에요. 2P는 이번 판에 쓸 팀을 골라요.<br>전적은 1P 팀에만 쌓여요. 기기 하나를 가로로 두고 차례인 팀만 눌러요.</p><div class="row" id="p2Cards"></div>`;
    for (const id of DUO_IDS) {
      const b = document.createElement('button');
      b.className = `duoCard${id === p2Duo ? ' on' : ''}`;
      b.disabled = id === me.duo;
      b.innerHTML = `<canvas></canvas>${DUOS[id].name}<small>${id === me.duo ? '1P 팀' : DUOS[id].rel}</small>`;
      drawDuoCard(b.querySelector('canvas'), id);
      b.onclick = () => { p2Duo = id; sound.play('press'); renderSetup(); };
      $('p2Cards').append(b);
    }
  }
}
$('setupBack').onclick = toTitle;
$('setupGo').onclick = () => { sound.unlock(); runMatch().catch((e) => { console.error(e); toTitle(); }); };

// ---------- 설정 ----------
const SETS = [
  ['sound', '소리', applySound],
  ['sfxVol', '효과음 음량', () => { applySound(); sound.play('ding'); }, 'level'],
  ['musicVol', '음악 음량', applySound, 'level'],
  ['noTimer', '시간 제한 끄기', null],
];
let resetArm = false;
function openSettings() {
  const box = $('setList'); box.innerHTML = '';
  for (const [k, label, fn, kind] of SETS) {
    const row = document.createElement('div'); row.className = 'setRow';
    row.innerHTML = `<span>${label}</span>`;
    const b = document.createElement('button');
    if (kind === 'level') { // 음량: 누를 때마다 0→4칸 순환
      b.className = `toggle${S[k] ? ' on' : ''}`; b.textContent = S[k] ? '▮'.repeat(S[k]) + '▯'.repeat(4 - S[k]) : '끔';
      b.onclick = () => { S[k] = (S[k] + 1) % 5; persist(); fn?.(S[k]); openSettings(); };
    } else {
      b.className = `toggle${S[k] ? ' on' : ''}`; b.textContent = S[k] ? '켜짐' : '꺼짐';
      b.onclick = () => { S[k] = !S[k]; persist(); fn?.(S[k]); openSettings(); };
    }
    row.append(b); box.append(row);
  }
  resetArm = false;
  $('resetTeam').textContent = '팀 리셋'; $('resetTeam').classList.remove('danger');
  $('resetTeam').disabled = !save.profile;
  show('settings');
}
$('gear').onclick = openSettings;
$('setClose').onclick = toTitle;
// 팀 리셋: 두 번 눌러야 지워진다(전적과 칭호가 모두 사라져요)
$('resetTeam').onclick = () => {
  if (!resetArm) { resetArm = true; $('resetTeam').textContent = '한 번 더 누르면 전적이 지워져요'; $('resetTeam').classList.add('danger'); return; }
  save.profile = null; persist(); openTeamPick();
};

// ---------- 점수판 ----------
const shown = [0, 0];
function renderScore(t, v) {
  const el = $(t ? 'numB' : 'numA'), old = String(shown[t]).padStart(4, ' '), now = String(v).padStart(4, ' ');
  el.innerHTML = [...now].map((c, i) => `<span class="${c !== old[i] ? 'flip' : ''}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  // 점수판 딸깍: 넘어간 점수만큼 연속으로(10점에 한 번, 최대 20번)
  const n = Math.min(20, Math.round(Math.abs(v - shown[t]) / 10));
  for (let i = 0; i < n; i++) setTimeout(() => sound.play('scoreTick'), i * 45);
  shown[t] = v;
}
function setTurn(t) {
  st.turn = t;
  $('scoreA').classList.toggle('turn', t === 0); $('scoreB').classList.toggle('turn', t === 1);
}
const teamName = (t) => (t ? 'B팀' : 'A팀');

// ---------- 한 판 ----------
let M = null;
async function runMatch() {
  const me = save.profile;
  const teams = [
    { duo: me.duo, cpu: null },
    { duo: p2Duo, cpu: mode === 'solo' ? skill : null },
  ];
  M = createMatch({ teams, bank: BANK, recent: new Set(save.recent) });
  st.duo = [teams[0].duo, teams[1].duo]; st.react = [null, null]; st.turn = null; st.banjjak = null; st.cheer = false;
  shown[0] = shown[1] = 0; renderScore(0, 0); renderScore(1, 0);
  $('nameA').textContent = DUOS[teams[0].duo].name;
  $('nameB').textContent = DUOS[teams[1].duo].name;
  $('scoreB').querySelector('.who').firstChild.textContent = teams[1].cpu ? '● B팀 컴퓨터' : '● B팀';
  for (const id of ['card', 'timer', 'panel', 'reveal', 'wheel', 'board']) $(id).classList.add('hide');
  st.dim = false; st.vs = null;
  $('partLabel').textContent = '오프닝';
  show('game'); tvStatic(); sound.play('tvOn'); sound.music(true);
  await wait(500);
  await say('wang', '자~ 신나는 퀴즈 대결! 퀴즈퀴즈 2026! 대~박!');
  await say('na', `오늘의 A팀은 ${DUOS[teams[0].duo].name}! B팀은 ${DUOS[teams[1].duo].name}입니다!`);
  sound.play('opening'); st.cheer = true; sound.play('clap'); await wait(900); st.cheer = false;
  await vsBlast();

  for (;;) {
    const ev = advance(M);
    if (ev.ev === 'end') break;
    if (ev.ev === 'part') { await partIntro(ev.part); continue; }
    let slot = ev.slot;
    if (ev.ev === 'board') slot = await boardPick(ev.turn);
    else if (slot.part === 1) await spin(slot.cat);
    await runQuestion(slot);
  }
  await awards();
}

// 대결 시작: 두 팀 클로즈업과 VS 폭발
async function vsBlast() {
  st.vs = { t0: st.t, kind: 'vs' }; sound.play('roundStart');
  await caption('VS', '', 1400, 'vs');
  st.vs = null;
}

const PART = {
  1: ['1부 몸풀기', '분야 돌림판 · 4지선다 6문제', '몸 좀 풀어 볼까요~?'],
  2: ['2부 분야 판', '칸을 골라요 · 100점 4지선다, 200점 주관식', '자, 운명의 패널을 골라 주세요!'],
  3: ['3부 역전 한 방', '', '마지막 한 문제! 뒤진 팀부터 갑니다!'],
  sudden: ['서든데스!', '먼저 맞히는 팀이 우승', '동점입니다! 이런 대~박!'],
};
async function partIntro(part) {
  const [t, sub, line] = PART[part];
  tvStatic();
  $('partLabel').textContent = t;
  for (const id of ['card', 'timer', 'panel', 'reveal', 'board']) $(id).classList.add('hide');
  st.dim = false;
  if (part === 2) { sound.music(false); await caption('잠시 후 계속됩니다', '', 1500); sound.play('jingle'); await wait(700); tvStatic(); sound.music(true); }
  sound.play(part === 3 ? 'tension' : part === 'sudden' ? 'sudden' : 'roundStart');
  await caption(t, part === 3 ? `주관식 1문제 · ${M.part3Base}점` : sub, 1500);
  await say(part === 'sudden' ? 'wang' : part === 2 ? 'na' : 'wang', line, 1800);
}

async function spin(cat) {
  const w = $('wheel'), el = $('wheelCat');
  w.classList.remove('hide');
  // 돌림판: 점점 느려지는 딱딱딱
  for (let i = 0; i < 16; i++) { el.textContent = CATS[(i * 5) % CATS.length].name; sound.play('spinTick'); await wait(45 + i * i * 1.4); }
  el.textContent = catName(cat); sound.play('spinStop');
  await wait(800);
  w.classList.add('hide');
}

// 2부 패널판
function renderBoard(turn, hot = null) {
  const b = $('board');
  let html = '<div class="grid">' + M.board.map((c) => `<div class="head">${catName(c.cat)}</div>`).join('');
  for (let row = 0; row < BOARD_ROWS.length; row++) {
    for (const col of M.board) {
      const c = col.cells[row], own = c.owner === 0 ? 'A' : c.owner === 1 ? 'B' : c.owner === 'none' ? 'none' : '';
      const label = c.owner === 0 ? '▲' : c.owner === 1 ? '●' : c.owner === 'none' ? '–' : c.base;
      const isHot = hot && hot.cat === col.cat && hot.row === row;
      html += `<button class="cell ${own}${isHot ? ' hot' : ''}" data-cat="${col.cat}" data-row="${row}" ${c.owner !== null ? 'disabled' : ''}>${label}</button>`;
    }
  }
  const left = 8 - M.boardPicks;
  html += `</div><div class="note" style="color:var(--${turn ? 'b' : 'a'})">${teamName(turn)}이 칸을 골라요 · 남은 칸 ${left}개 · 한 분야 두 칸을 다 맞히면 분야 정복 +100</div>`;
  b.innerHTML = html; b.classList.remove('hide');
}
async function boardPick(turn) {
  setTurn(turn);
  renderBoard(turn);
  let pick;
  if (M.teams[turn].cpu) {
    await wait(900);
    pick = cpuPickCell(M, turn);
    renderBoard(turn, pick); sound.play('panelPick');
    await wait(1100);
  } else {
    pick = await new Promise((res) => {
      $('board').onclick = (e) => { const c = e.target.closest('.cell'); if (!c || c.disabled) return; res({ cat: c.dataset.cat, row: Number(c.dataset.row) }); };
    });
    $('board').onclick = null;
    renderBoard(turn, pick); sound.play('panelFlip'); await wait(500);
  }
  $('board').classList.add('hide');
  return chooseCell(M, pick.cat, pick.row);
}

// 문제 한 개: 기회 규칙대로 차례를 돌리며 답을 받는다
async function runQuestion(slot) {
  const r = startRound(M, slot), q = r.q;
  save.recent = [q.id, ...save.recent.filter((x) => x !== q.id)].slice(0, 40); persist();
  st.cardFlip = Math.random() < 0.25; // 왕대박이 카드를 거꾸로 들 때가 있다
  $('cardCat').textContent = `${catName(q.cat)}${slot.part === 2 ? ` · ${slot.base}점` : slot.part === 3 ? ` · 역전 한 방 ${slot.base}점` : slot.part === 'sudden' ? ' · 서든데스' : ''}`;
  $('cardStars').textContent = '★'.repeat(q.tier) + '☆'.repeat(5 - q.tier);
  $('cardStars').title = TIER_NAME[q.tier];
  $('qText').innerHTML = esc(q.q).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  $('hintLine').classList.add('hide');
  st.dim = true; // 문제가 떠 있는 동안 배경을 어둡게
  const card = $('card'); card.classList.remove('hide', 'pop'); void card.offsetWidth; card.classList.add('pop');
  sound.play('cardIn');
  const tiles = q.type === 'short' ? makeTiles(q, Math.random, BANK.filter((x) => x.cat === q.cat && x.type === 'short' && x.id !== q.id).map((x) => x.answer)) : null;
  const choiceOrder = q.type === 'choice' ? [0, 1, 2, 3] : null;
  if (st.cardFlip) { await say('wang', '어라? 카드가 거꾸로네요~ 하하!', 1300); st.cardFlip = false; }

  while (!r.done) {
    const at = attemptOf(r), t = at.team;
    setTurn(t);
    st.react = [null, null];
    if (at.hint && q.type === 'short') { $('hintLine').textContent = `힌트: ${choseong(q.answer)}`; $('hintLine').classList.remove('hide'); }
    const lim = S.noTimer ? 0 : timeFor(M, t);
    const label = at.no === 0 ? `${teamName(t)} 차례` : at.no === 1 ? `기회가 ${teamName(t)}으로!` : `${teamName(t)} 한 번 더!`;
    const chip = $('turnChip'); chip.className = t ? 'b' : 'a';
    chip.textContent = `${t ? '●' : '▲'} ${label}`;
    if (at.no > 0) { sound.play('turnChange'); chip.classList.add('flash'); setTimeout(() => chip.classList.remove('flash'), 1000); }
    const resp = await getAnswer(r, t, lim, tiles, choiceOrder);
    const out = answer(M, resp);
    await feedback(r, out, resp);
  }
  await reveal(r);
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

// 답판을 그리고, 사람이면 입력을, 컴퓨터면 생각하는 척 뒤 답을 받는다. 시간이 지나면 { timeout: true }
function getAnswer(r, t, lim, tiles, order) {
  const q = r.q, cpu = !!M.teams[t].cpu, panel = $('panel');
  panel.className = `${t ? 'b' : 'a'}${cpu ? ' wait' : ''}`;
  let typed = [], usedTile = [], finish;
  const done = new Promise((res) => { finish = res; });
  const draw = () => {
    if (q.type === 'choice') {
      panel.innerHTML = `<div class="choices">${order.map((i) => `<button class="choice c${i}${r.out.includes(i) ? ' out' : ''}" data-i="${i}" ${r.out.includes(i) || cpu ? 'disabled' : ''}><i>${i + 1}</i>${esc(q.choices[i])}</button>`).join('')}</div>`;
    } else if (q.type === 'short') {
      panel.innerHTML = `<div class="slot${typed.length ? '' : ' empty'}">${typed.length ? esc(typed.join('')) : '글자 조각을 순서대로 눌러요'}</div>
        <div class="tiles">${tiles.map((c, i) => `<button class="tile" data-k="${i}" ${usedTile.includes(i) || cpu ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div>
        <div class="keys"><button class="btn sub" data-act="back" ${cpu ? 'disabled' : ''}>⌫ 지우기</button><button class="btn" data-act="ok" ${cpu ? 'disabled' : ''}>확인</button></div>`;
    } else {
      panel.innerHTML = `<div class="slot${typed.length ? '' : ' empty'}">${typed.length ? typed.join('') : '숫자를 눌러요'}</div>
        <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => `<button data-n="${n}" ${cpu ? 'disabled' : ''}>${n}</button>`).join('')}<button data-act="back" ${cpu ? 'disabled' : ''}>⌫</button><button data-act="ok" ${cpu ? 'disabled' : ''}>확인</button></div>`;
    }
  };
  draw(); panel.classList.remove('hide');
  panel.onclick = (e) => {
    if (cpu) return;
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    sound.play(b.dataset.act === 'back' ? 'erase' : b.dataset.act === 'ok' ? 'confirm' : b.dataset.k != null || b.dataset.n != null ? 'tile' : 'press');
    if (b.dataset.i != null) return finish({ choice: Number(b.dataset.i) });
    if (b.dataset.k != null) { const k = Number(b.dataset.k); usedTile.push(k); typed.push(tiles[k]); if (typed.length > 12) { typed.pop(); usedTile.pop(); } return draw(); }
    if (b.dataset.n != null) { if (typed.length < 5) typed.push(b.dataset.n); return draw(); }
    if (b.dataset.act === 'back') { typed.pop(); usedTile.pop(); return draw(); }
    if (b.dataset.act === 'ok' && typed.length) return finish({ text: typed.join('') });
  };
  // 시간
  let left = lim, timer = null;
  const tm = $('timer'); tm.classList.remove('hide', 'off'); tm.style.setProperty('--p', 1);
  $('timerNum').textContent = lim || '∞';
  if (lim) {
    timer = setInterval(() => {
      left -= 0.2; tm.style.setProperty('--p', Math.max(0, left / lim)); $('timerNum').textContent = Math.max(0, Math.ceil(left));
      // 째깍: 남은 5초부터 빨라진다(1초에 한 번 → 0.4초에 한 번)
      const k = Math.round(left * 5);
      if (left <= 5 ? k % 2 === 0 : k % 5 === 0) sound.play(left <= 5 ? 'tickFast' : 'tick');
      if (left <= 0) { sound.play('timeUp'); finish({ timeout: true }); }
    }, 200);
  } else tm.classList.add('off');
  // 컴퓨터
  let thinkEl = null, cpuTimer = null;
  if (cpu) {
    const d = cpuDecide(M);
    st.think[t] = true;
    const lines = ['이거 아까 봤는데…', '음… 잠깐만!', '찍을까 말까…', '알 것 같은데!', '둘이 상의 좀 할게요~'];
    thinkEl = bubble(t, lines[Math.floor(Math.random() * lines.length)], { cls: 'cpu' });
    const delay = lim ? Math.min(d.delay, (lim - 1) * 1000) : d.delay;
    cpuTimer = setTimeout(async () => {
      if (q.type === 'choice') {
        const el = panel.querySelector(`[data-i="${d.resp.choice}"]`); el?.classList.add(t ? 'pickB' : 'pickA'); sound.play('press');
      } else {
        typed = [...String(d.resp.text)]; draw(); sound.play('confirm');
      }
      await wait(700);
      finish(d.resp);
    }, delay);
  }
  return done.then((resp) => {
    clearInterval(timer); clearTimeout(cpuTimer); panel.onclick = null; thinkEl?.remove(); st.think[t] = false;
    return resp;
  });
}

const NEAR_LINES = ['아깝다~!', '거의 다 왔는데!'];
async function feedback(r, out, resp) {
  const t = out.team, q = r.q;
  st.react[t] = out.result === 'correct' ? 'win' : 'lose'; st.reactT[t] = st.t;
  if (out.result === 'correct') {
    sound.play('ding'); stage.ring(t); st.cheer = true; sound.play('clap');
    if (q.type === 'choice') $('panel').querySelector(`[data-i="${resp.choice}"]`)?.classList.add('right');
    // 정답 순간: 맞힌 팀 클로즈업과 예능 자막
    st.vs = { t0: st.t, kind: 'win', team: t }; $('game').classList.add('closeup');
    await caption('정답~!', `${teamName(t)} +${out.points}`, 1100);
    st.vs = null; $('game').classList.remove('closeup'); stage.confetti(40);
    if (q.tier === 5) { stage.bowFly(); sound.play('genius'); setTimeout(() => sound.play('whoosh'), 300); await caption('천재 등장!', '', 1200); }
    if (q.cat === 'nonsense') setTimeout(() => sound.play('laugh'), 200);
    renderScore(0, M.scores[0]); renderScore(1, M.scores[1]);
    bubble(t, out.bonus ? `분야 정복! +${out.points + out.bonus}` : `+${out.points}`, { ms: 1500 });
    if (st.duo[t] === 'siblings') bubble(t, '잘했어 오빠!', { ms: 1300 });
    await wait(1700);
    st.cheer = false;
  } else {
    sound.play(out.result === 'near' ? 'near' : out.result === 'timeout' ? 'timeUp' : 'buzz');
    stage.chicken(t); caption(out.result === 'near' ? '아까워요~' : '아이고~', '', 1300, `side${t}`);
    setTimeout(() => sound.play('squawk'), 450); setTimeout(() => sound.play('aww'), 700);
    if (q.type === 'choice' && resp.choice != null) { $('panel').querySelector(`[data-i="${resp.choice}"]`)?.classList.add('wrongPick'); setTimeout(() => sound.play('grayOut'), 1100); }
    if (!r.done) setTimeout(() => sound.play('passTurn'), 1300);
    if (out.result === 'near') bubble('na', out.msg, { ms: 2200 });
    else if (out.result === 'timeout') bubble(t, '시간 끝~!', { ms: 1300 });
    else if (st.duo[t] === 'siblings') bubble(t, '너 때문이야!', { ms: 1300 });
    else bubble(t, NEAR_LINES[Math.floor(Math.random() * 2)], { ms: 1300 });
    await wait(out.result === 'near' ? 2200 : 1600);
  }
  st.react = [null, null];
}

async function reveal(r) {
  const q = r.q, ans = q.type === 'choice' ? `${q.answer + 1}번 ${q.choices[q.answer]}` : String(q.answer);
  $('timer').classList.add('hide'); $('panel').classList.add('hide');
  st.banjjak = 0; const t0 = performance.now();
  let slipped = false;
  const skate = setInterval(() => {
    st.banjjak = (performance.now() - t0) / 2400;
    if (!slipped && st.banjjak > 0.5) { slipped = true; if (Math.random() < 0.4) sound.play('skateSlip'); } // 가끔 미끄러진다
    if (st.banjjak > 1) { clearInterval(skate); st.banjjak = null; }
  }, 30);
  const el = $('reveal');
  const who = r.winner === null ? '아무도 못 맞혔어요!' : `${teamName(r.winner)} 정답!`;
  el.innerHTML = `<div class="ans">정답: ${esc(ans)}</div><div class="ex">${esc(q.explain)}</div><div class="row"><span style="margin-right:auto;font-size:10px;font-weight:800;color:${r.winner === null ? '#6a5a90' : r.winner ? 'var(--b2)' : 'var(--a2)'}">${who}</span><button class="btn small" id="nextBtn">다음 ▶</button></div>`;
  el.classList.remove('hide');
  st.talk = 'na';
  await new Promise((res) => { $('nextBtn').onclick = () => { sound.play('press'); res(); }; });
  st.talk = null;
  el.classList.add('hide'); $('card').classList.add('hide'); clearBubbles();
  st.dim = false;
}

// ---------- 시상식 ----------
async function awards() {
  const w = M.log.length ? (M.scores[0] === M.scores[1] ? M.suddenWinner : M.scores[0] > M.scores[1] ? 0 : 1) : null;
  setTurn(w); st.turn = w;
  tvStatic(); sound.music(false); stage.confetti(140); st.cheer = true;
  for (const id of ['card', 'timer', 'panel', 'reveal', 'board']) $(id).classList.add('hide');
  st.dim = false;
  $('partLabel').textContent = '시상식';
  const before = titleOf(save.profile.wins);
  const up = recordResult(save.profile, M, 0); persist();
  const p = save.profile, hi = highlight(M), hq = hi && BANK.find((x) => x.id === hi.id);
  const winName = w === null ? '' : `${teamName(w)} ${DUOS[M.teams[w].duo].name}`;
  const mine = w === 0;
  $('awardsBody').innerHTML = `
    ${w === null ? '' : '<canvas id="trophy"></canvas>'}
    <div class="big outline">${w === null ? '무승부!' : `${winName} 우승!`}</div>
    <p>${M.scores[0].toLocaleString()} : ${M.scores[1].toLocaleString()}${mine ? ' · 금 트로피가 너무 커서 비틀비틀~' : ' · 진 팀에게는 "다음엔 이긴다" 리본!'}${M.teams[1].cpu ? ` · 컴퓨터 실력 <b>${CPU_SKILL[M.teams[1].cpu].name}</b>` : ''}</p>
    ${hq ? `<div class="scene"><b>오늘의 명장면</b> · ${teamName(hi.winner)}이 ${'★'.repeat(hq.tier)} 문제를 맞혔어요<br>"${esc(hq.q.replace(/\*\*/g, ''))}" → ${esc(hq.type === 'choice' ? hq.choices[hq.answer] : hq.answer)}</div>` : ''}
    <div class="record">우리 팀 <b>${DUOS[p.duo].name}</b> · ${titleOf(p.wins).name} · <b>${p.wins}승 ${p.losses}패</b>${p.draws ? ` ${p.draws}무` : ''} · 누적 ${p.totalScore.toLocaleString()}점</div>
    ${up ? `<div class="titleUp">칭호가 올랐어요! "${before.name}" → "${up.name}"</div>` : ''}
    <div class="row"><button class="btn sub" id="toTitle">처음으로</button><button class="btn" id="again">한 판 더!</button></div>`;
  show('awards');
  if ($('trophy')) drawTrophy($('trophy'));
  // 혼자 할 때는 우리 팀 기준, 둘이 할 때는 언제나 우승 팡파르
  sound.play(mine || (!M.teams[1].cpu && w !== null) ? 'win' : 'lose'); sound.play('clap');
  if (up) setTimeout(() => sound.play('titleUp'), 1500);
  await say('wang', w === null ? '오늘은 사이좋게 무승부! 대~박!' : `축하합니다! ${winName}!`, 2000);
  $('again').onclick = () => { st.cheer = false; runMatch().catch((e) => { console.error(e); toTitle(); }); };
  $('toTitle').onclick = () => { st.cheer = false; toTitle(); };
}

// ---------- 효과음 점검 화면(?sfx=1): 모든 효과음을 눌러 들어 본다 ----------
function sfxCheck() {
  const box = $('sfxList'); box.innerHTML = '';
  for (const [group, list] of SFX_GROUPS) {
    const h = document.createElement('div'); h.className = 'sfxGroup'; h.textContent = group; box.append(h);
    for (const [id, label] of list) {
      const b = document.createElement('button'); b.className = 'pick'; b.innerHTML = `${label}<small>${id}</small>`;
      b.onclick = () => { sound.unlock(); sound.play(id); };
      box.append(b);
    }
  }
  $('musicToggle').onclick = () => { sound.unlock(); const on = !sound.playing(); sound.music(on); $('musicToggle').textContent = on ? '배경 음악 멈춤' : '배경 음악 듣기'; };
  show('sfxCheck');
}

// ---------- 시작 ----------
if (save.profile && !DUOS[save.profile.duo]) save.profile = null; // 없어진 듀오면 다시 고른다
if (new URLSearchParams(location.search).has('sfx')) sfxCheck();
else if (!save.profile) openTeamPick(); else toTitle();
