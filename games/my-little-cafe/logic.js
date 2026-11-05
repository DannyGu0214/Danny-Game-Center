// 게임 규칙 전부(화면 없음). 제조 판정은 순수 함수, 진행은 저장 가능한 상태 객체 하나.
import { ESPRESSO, DRIP, MILK, AMERICANO, GRIND, TASTE_GOOD, TASTE_OK, DAILY_GRIND, MENUS, REAL_PER_GAME, CAFE_NAMES, CAFE_NAME_MAX, RUSH } from './data.js';
import { SCRIPT, NOTES } from './story.js';

export const SAVE_VERSION = 1;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ── 에스프레소 ─────────────────────────────
// 분쇄 오차(칸). 양수면 정답보다 굵다
export const grindError = (grind, ideal) => grind - ideal;

// 물이 빠지는 속도(g/실제 초). 굵으면 빠르고 고우면 느리다. 칸당 약 22%
export function shotFlow(grindErr, dose = ESPRESSO.dose) {
  const base = ESPRESSO.yield / ESPRESSO.time;
  const doseF = clamp(ESPRESSO.dose / Math.max(dose, 1), 0.7, 1.3); // 많이 담으면 물이 느려진다
  return base * Math.exp(grindErr * 0.2) * doseF;
}
// 처음 몇 초는 커피가 거의 안 나온다(실제 샷처럼). realT: 실제 초
export function shotYieldAt(realT, grindErr, dose) {
  const lag = 3;
  if (realT <= lag) return 0;
  return shotFlow(grindErr, dose) * ((realT - lag) * ESPRESSO.time / (ESPRESSO.time - lag));
}
// 맛: 시간이 짧거나 양이 적으면 시큼(-), 길거나 많으면 씀(+)
export function shotTaste({ realT, yieldG }) {
  const t = (realT - ESPRESSO.time) / 14, y = (yieldG - ESPRESSO.yield) / 24;
  return clamp(t * 0.75 + y * 0.6, -1, 1);
}
// 한 항목의 점수: 초록 칸 안이면 1, 벗어난 만큼 span에 걸쳐 0까지 떨어진다
export const hit = (err, ok, span) => (err <= ok ? 1 : clamp(1 - (err - ok) / span, 0, 1));
export const evenHit = (even) => clamp((even - 0.4) / 0.5, 0, 1); // 수평·고른 정도 90%면 만점
// 평균만 보면 한 군데를 망쳐도 높게 나온다. 가장 못한 항목을 함께 본다
export function mixScore(parts) {
  if (!parts.length) return 0;
  return clamp(parts.reduce((a, b) => a + b, 0) / parts.length * 0.6 + Math.min(...parts) * 0.4, 0, 1);
}
export function scoreShot({ doseG, even, realT, yieldG }, target = 0) {
  const taste = shotTaste({ realT, yieldG }), doseErr = Math.abs(doseG - ESPRESSO.dose);
  const parts = [hit(doseErr, ESPRESSO.doseOk, 3), hit(Math.abs(yieldG - ESPRESSO.yield), ESPRESSO.yieldOk, 10), hit(Math.abs(realT - ESPRESSO.time), ESPRESSO.timeOk, 9), hit(Math.abs(taste - target), TASTE_GOOD, 0.5), evenHit(even)];
  return { taste, score: mixScore(parts) };
}
export const realFromGame = (sec) => sec * REAL_PER_GAME;

// ── 다지기 ─────────────────────────────────
// 폰의 좌우 기울기(도). 오른쪽이 내려가면 +. 폰의 가로축이 수평에서 벗어난 각도라 폰을 세워 들어도 값이 튀지 않는다
export function levelAngle(beta, gamma) {
  const r = Math.PI / 180;
  return Math.asin(clamp(Math.cos(beta * r) * Math.sin(gamma * r), -1, 1)) / r;
}
// 처음 누른 순간의 각도를 기준으로, 20도 기울이면 수평계 끝에 닿는다
export const tiltFromAngle = (angle, base, range = 20) => clamp((angle - base) / range, -1, 1);
// 기울기 표본의 평균으로 균일도(0~1)
export function tampEvenness(tilts) {
  if (!tilts.length) return 0.5;
  const avg = tilts.reduce((s, t) => s + Math.abs(t), 0) / tilts.length;
  return clamp(1 - Math.max(0, avg - 0.1) / 0.45, 0, 1); // 초록 칸 절반 안에서 흔들리면 만점
}
// 균일도가 낮으면 물이 한쪽으로 몰린다(물길): 샷이 조금 빨라진다
export const channelFlowBoost = (even) => 1 + (1 - clamp(even, 0, 1)) * 0.25;

// ── 아메리카노 ─────────────────────────────
export const scoreWater = (waterG) => hit(Math.abs(waterG - AMERICANO.water), AMERICANO.waterOk, 50);
// 물을 너무 적게 넣으면 진해서 씀 쪽으로, 많으면 연해서 시큼한 쪽으로 조금 움직인다
export const waterTasteShift = (waterG) => clamp((AMERICANO.water - waterG) / 300, -0.3, 0.3);

// ── 우유 스팀 ──────────────────────────────
// depth: 0 수면 근처(공기 들어감) ~ 1 깊이(소용돌이). 상태 {temp, foam}
export function steamStep(m, depth, dt) {
  const surface = depth < 0.34;
  const next = { temp: m.temp + MILK.heatPerSec * dt, foam: m.foam };
  if (surface) next.foam = clamp(m.foam + MILK.airPerSec * dt, 0, 1.2);
  return next;
}
// 거품 양에 따라 라떼 무늬가 달라진다
export const latteLook = (foam) => (foam < MILK.foamLo ? 'thin' : foam > MILK.foamHi ? 'foam' : 'heart');
export function scoreMilk({ temp, foam }) {
  const tempScore = temp < MILK.tempLo ? clamp(1 - (MILK.tempLo - temp) / 15, 0, 1)
    : temp <= MILK.tempHi ? 1
      : clamp(1 - (temp - MILK.tempHi) / 9, 0, 1);
  const foamScore = foam < MILK.foamLo ? clamp(1 - (MILK.foamLo - foam) / 0.2, 0, 1)
    : foam <= MILK.foamHi ? 1
      : clamp(1 - (foam - MILK.foamHi) / 0.3, 0, 1);
  return { tempScore, foamScore, score: mixScore([tempScore, foamScore]), burnt: temp >= MILK.burn };
}

// ── 핸드드립 ───────────────────────────────
export const DRIP_CELLS = 24; // 원두 층을 칸으로 나눠 물이 고르게 닿았는지 본다
export function newDrip(grindErr, doseG = DRIP.dose) {
  return { grindErr, doseG, poured: 0, level: 0, passed: 0, t: 0, bloomT: 0, phase: 'bloom', wet: new Array(DRIP_CELLS).fill(0), over: 0 };
}
// 극좌표로 칸 번호: 3겹 × 8방향. r>1이면 원두 층 밖
export function dripCell(x, y) {
  const r = Math.hypot(x, y);
  if (r > 1) return -1;
  const ring = Math.min(2, Math.floor(r * 3));
  const a = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
  return ring * 8 + Math.floor(a / (Math.PI * 2) * 8) % 8;
}
export const DRIP_POUR_RATE = 18; // g/게임 초(실제로는 물줄기가 흐르는 속도)
export const BLOOM_POUR_RATE = 6.5; // 뜸은 천천히 붓는 맛이 나게 느리게 찬다(40g까지 약 6초)
export const dripDrain = (grindErr) => 11.2 * Math.exp(grindErr * 0.2); // g/게임 초
export const DRIP_MAX_LEVEL = 130; // 넘치면 벽을 타고 그냥 빠져나간다

// 게임 dt 진행. pour: {x, y} 또는 null
export function dripStep(d, pour, dt) {
  // 뜸을 오래 붓는다고 추출 시간이 늘어나 맛이 쓰게 변하지 않도록, 시계는 보통 붓는 속도로 센다
  const bloomPour = d.phase === 'bloom' && pour;
  d.t += bloomPour ? dt * BLOOM_POUR_RATE / DRIP_POUR_RATE : dt;
  if (pour) {
    const add = (d.phase === 'bloom' ? BLOOM_POUR_RATE : DRIP_POUR_RATE) * dt, cell = dripCell(pour.x, pour.y);
    d.poured += add; d.level += add;
    if (cell >= 0) d.wet[cell] += add;
    else d.over += add; // 원두 밖으로 부으면 그냥 흘러내려요
  }
  const drain = Math.min(d.level, (d.phase === 'bloom' ? 0.8 : dripDrain(d.grindErr)) * dt);
  d.level -= drain; d.passed += drain;
  if (d.level > DRIP_MAX_LEVEL) { d.over += d.level - DRIP_MAX_LEVEL; d.level = DRIP_MAX_LEVEL; }
  return d;
}
// 칸마다 넓이가 달라서(바깥이 넓다) 그 넓이만큼 물을 받았는지 본다
const ringArea = [1 / 9 / 8, 3 / 9 / 8, 5 / 9 / 8];
export function dripEvenness(wet) {
  const total = wet.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let dev = 0;
  wet.forEach((w, i) => { dev += Math.abs(w / total - ringArea[Math.floor(i / 8)]); });
  return clamp(1 - (dev / 2 - 0.1) / 0.35, 0, 1);
}
// 뜸: 알맞은 물을 붓고 잠깐 기다렸는지
export function bloomScore(water, waitReal) {
  return hit(Math.abs(water - DRIP.bloomWater), DRIP.bloomOk, 30) * 0.7 + hit(Math.abs(waitReal - DRIP.bloomReal), 0, 40) * 0.3;
}
export function dripRealTime(gameT) { return gameT * (DRIP.time / DRIP.gameSec); }
export function dripTaste({ gameT, water }) {
  const t = (dripRealTime(gameT) - DRIP.time) / 95, w = (water - DRIP.water) / 180;
  return clamp(t * 0.8 + w * 0.4, -1, 1);
}
export function scoreDrip({ gameT, water, even, bloom, over = 0 }, target = 0) {
  const taste = dripTaste({ gameT, water });
  const parts = [hit(Math.abs(taste - target), TASTE_GOOD, 0.5), evenHit(even), bloom, hit(Math.abs(water - DRIP.water), DRIP.waterOk, 60), hit(Math.abs(dripRealTime(gameT) - DRIP.time), DRIP.timeOk, 60)];
  return { taste, score: clamp(mixScore(parts) - clamp(over / 80, 0, 0.3), 0, 1) };
}

// ── 별과 반응 ──────────────────────────────
// 맛이 빗나가면 다른 걸 잘해도 별이 제한된다: 살짝 빗나가면 2개까지, 많이 빗나가면 1개까지
export function starsOf(score, band = 'good') {
  const base = score >= 0.92 ? 3 : score >= 0.65 ? 2 : score >= 0.35 ? 1 : 0;
  return Math.min(base, band === 'good' ? 3 : band === 'sour' || band === 'bitter' ? 2 : 1);
}
// 저울 위치의 말: 사람 반응과 안내 문구가 같이 쓴다
export function tasteBand(taste, target = 0) {
  const d = taste - target;
  if (Math.abs(d) <= TASTE_GOOD) return 'good';
  if (d < -TASTE_OK) return 'verySour';
  if (d < 0) return 'sour';
  if (d > TASTE_OK) return 'veryBitter';
  return 'bitter';
}
export function grindAdvice(band) {
  if (band === 'sour' || band === 'verySour') return '시큼하면 더 곱게 갈아 봐요.';
  if (band === 'bitter' || band === 'veryBitter') return '쓰면 더 굵게 갈아 봐요.';
  return '이대로 맞아요.';
}

// ── 게임 진행 ──────────────────────────────
export function cleanCafeName(raw) {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, CAFE_NAME_MAX).join('');
}
export const defaultChoices = () => ({ hero: 'M', owner: 'F', place: 'home', cafe: CAFE_NAMES[0].name });
export function validChoices(c) {
  return (c.hero === 'M' || c.hero === 'F') && (c.owner === 'M' || c.owner === 'F') && (c.place === 'office' || c.place === 'home') && cleanCafeName(c.cafe).length > 0;
}
export function newGame(choices) {
  return { v: SAVE_VERSION, choices: { ...choices, cafe: cleanCafeName(choices.cafe) }, day: 0, beat: 0, notes: [], cups: [], dial: { espresso: 6, drip: 5 }, examTries: 0, done: false };
}
export const scriptOf = (S, day = S.day) => SCRIPT[day].filter((b) => !b.place || b.place === S.choices.place);
export const currentBeat = (S) => scriptOf(S)[S.beat] ?? null;
export function nextBeat(S) {
  const list = scriptOf(S);
  if (S.beat + 1 < list.length) { S.beat += 1; return currentBeat(S); }
  if (S.day + 1 < SCRIPT.length) { S.day += 1; S.beat = 0; return currentBeat(S); }
  S.done = true;
  return null;
}
// 이름표 채우기: {cafe}. 주인공을 부르는 말은 대사에 직접 쓴다
export const fillText = (S, text) => String(text).replaceAll('{cafe}', S.choices.cafe);
export const beatText = (S, b) => fillText(S, b.text);
export function addNote(S, id) {
  if (!NOTES[id]) throw new Error(`없는 노트 ${id}`);
  if (!S.notes.includes(id)) S.notes.push(id);
}
export function recordCup(S, cup) {
  S.cups.push({ day: S.day, menu: cup.menu, stars: cup.stars ?? starsOf(cup.score, cup.band), taste: +cup.taste.toFixed(2) });
}
// S.day: 0 프롤로그, 1~5 수업, 6 엔딩. 표는 1~5일차만 있어서 범위 밖은 가까운 날을 쓴다
export const dailyOf = (day) => DAILY_GRIND[clamp(day - 1, 0, DAILY_GRIND.length - 1)];
export const idealGrind = (day, menu) => (menu === 'drip' ? dailyOf(day).drip : dailyOf(day).espresso);
export const stepsOf = (menu) => MENUS[menu].steps;
export const clampGrind = (g) => clamp(Math.round(g * 10) / 10, GRIND.min, GRIND.max);
// 오늘 만든 잔의 별 합계(시험에 쓴다)
// 러시 시험: 늦어도 별은 그대로이고(별은 커피로만), 오래 기다린 손님 수를 따로 본다
export const rushPassed = (stars, late) => stars >= RUSH.passStars && late <= RUSH.maxLate;
export const starsSince = (S, from) => S.cups.slice(from).reduce((a, c) => a + c.stars, 0);

export function normalizeSave(raw) {
  if (!raw || raw.v !== SAVE_VERSION || !raw.choices || !validChoices(raw.choices)) return null;
  const S = newGame(raw.choices);
  const day = Number.isInteger(raw.day) && raw.day >= 0 && raw.day < SCRIPT.length ? raw.day : 0;
  S.day = day; S.beat = Number.isInteger(raw.beat) && raw.beat >= 0 && raw.beat < scriptOf(S, day).length ? raw.beat : 0;
  S.notes = Array.isArray(raw.notes) ? raw.notes.filter((n) => NOTES[n]) : [];
  S.cups = Array.isArray(raw.cups) ? raw.cups.filter((c) => c && typeof c.stars === 'number').slice(-200) : [];
  if (raw.dial && Number.isFinite(raw.dial.espresso) && Number.isFinite(raw.dial.drip)) S.dial = { espresso: clampGrind(raw.dial.espresso), drip: clampGrind(raw.dial.drip) };
  S.examTries = Number(raw.examTries) || 0;
  S.done = !!raw.done;
  return S;
}
