import { BOAT, POLAR, NO_GO, SAIL_K, WIND, NAV, SAIL_LEVELS, LAKE } from './data.js';
import * as W from './world.js';
// 항해 규칙 전부. 화면이 없고, 시드와 고정 시간 단계만으로 결과가 같다.

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (v, to, dt, tau) => v + (to - v) * (1 - Math.exp(-dt / tau));

// a - b를 -π~π로
export function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > PI) d -= TAU; else if (d < -PI) d += TAU;
  return d;
}

// 상대 바람각(절댓값, 0 = 정면)의 돛 효율
export function polar(twa) {
  for (let i = 1; i < POLAR.length; i++) {
    const [a0, v0] = POLAR[i - 1], [a1, v1] = POLAR[i];
    if (twa <= a1) return v0 + (v1 - v0) * (twa - a0) / (a1 - a0);
  }
  return POLAR[POLAR.length - 1][1];
}

export function windAt(t, ph = 0) {
  const from = WIND.from + WIND.swing * (Math.sin(t / 83 + ph) + 0.45 * Math.sin(t / 31 + ph * 2));
  const speed = WIND.speed * (1 + 0.2 * Math.sin(t / 19 + ph * 3) + 0.12 * Math.sin(t / 6.3 + ph));
  return { from, speed };
}

export function newGame(seed = 1) {
  const S = {
    seed, t: 0,
    ph: (seed * 2.399963) % TAU,
    wind: null,
    boat: {
      x: 0, y: LAKE.ay * 0.62, h: -PI / 2,
      spd: 0, turn: 0, rudder: 0,
      sailLevel: 0, sailNow: 0, lastSail: 2,
      row: false, rowPhase: 0, stamina: 1,
      boom: 0.2, luff: false, heel: 0, twa: 0, grounded: false,
    },
    route: null,
    events: [],
  };
  S.wind = windAt(0, S.ph);
  return S;
}

// 키를 직접 잡으면 자동 항로가 풀린다
export function setRudder(S, r) {
  S.boat.rudder = clamp(r, -1, 1);
  S.route = null;
}

export function setSail(S, level) {
  const b = S.boat;
  b.sailLevel = clamp(level, 0, SAIL_LEVELS.length - 1);
  if (b.sailLevel > 0) b.lastSail = b.sailLevel;
}

export function setRow(S, on) { S.boat.row = !!on; }

// 탭한 곳으로 자동 항로. 움직일 힘이 없으면 마지막 돛을 다시 올린다
export function setDest(S, x, y) {
  const b = S.boat, [dx, dy] = W.nearestWater(x, y), pts = W.findPath(b.x, b.y, dx, dy);
  if (!pts) return false;
  S.route = { pts, i: 0, side: 0, since: 99, dx, dy };
  if (b.sailLevel === 0 && !b.row) setSail(S, b.lastSail);
  return true;
}

export const clearRoute = (S) => { S.route = null; S.boat.rudder = 0; };

const blocked = (x, y, a, L, clear = 9) => !W.lineClear(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, clear);

function tack(S, r, side) {
  r.side = side; r.since = 0;
  S.events.push({ type: 'tack' });
}

// 자동 조타: 다음 점으로 향하고, 맞바람이면 지그재그로 간다
function autopilot(S, dt) {
  const r = S.route, b = S.boat;
  let wp = r.pts[r.i], dx = wp.x - b.x, dy = wp.y - b.y;
  const last = r.i === r.pts.length - 1;
  if (Math.hypot(dx, dy) < (last ? NAV.arrive : NAV.waypoint)) {
    if (last) {
      S.route = null; b.rudder = 0;
      if (!b.row) setSail(S, 0);
      b.row = false;
      S.events.push({ type: 'arrive' });
      return;
    }
    r.i++; wp = r.pts[r.i]; dx = wp.x - b.x; dy = wp.y - b.y;
  }
  r.since += dt;
  const bearing = Math.atan2(dy, dx), up = S.wind.from, rel = angDiff(bearing, up);
  const sailing = b.sailLevel > 0 && !b.row;
  let want = bearing;
  if (sailing && Math.abs(rel) < NAV.tackAngle) {
    // 처음엔 지금 뱃머리 쪽 뱃길을 고른다
    if (!r.side) r.side = angDiff(b.h, up) >= 0 ? 1 : -1;
    const past = r.side > 0 ? rel < -NAV.lay : rel > NAV.lay;
    if (past && r.since > NAV.minTack) tack(S, r, -r.side);
    want = up + r.side * NAV.tackAngle;
    if (blocked(b.x, b.y, want, NAV.look) && r.since > NAV.minTack) { tack(S, r, -r.side); want = up + r.side * NAV.tackAngle; }
  } else {
    r.side = 0;
    if (blocked(b.x, b.y, want, NAV.look)) {
      // 물가가 가로막으면 가까운 쪽으로 비켜 간다(돛으로 갈 때는 맞바람 구역 제외)
      for (let k = 1; k <= 8; k++) {
        const pick = [want + k * 0.26, want - k * 0.26].find((a) => !blocked(b.x, b.y, a, NAV.look) && (!sailing || Math.abs(angDiff(a, up)) >= NAV.tackAngle));
        if (pick !== undefined) { want = pick; break; }
      }
    }
  }
  b.rudder = clamp(angDiff(want, b.h) * 1.9, -1, 1);
}

export function step(S, dt) {
  S.t += dt;
  const b = S.boat;
  S.wind = windAt(S.t, S.ph);
  const { from, speed: wspd } = S.wind;
  if (S.route) autopilot(S, dt);

  // 돛 올리고 내리기
  const wantSail = SAIL_LEVELS[b.sailLevel];
  b.sailNow += clamp(wantSail - b.sailNow, -dt * 0.7, dt * 0.7);

  // 바람과 돛
  const windSide = angDiff(from, b.h); // 양수면 오른쪽(우현)에서 불어온다
  const twa = Math.abs(windSide);
  b.twa = twa;
  b.luff = twa < NO_GO && b.sailNow > 0.03;
  const sailT = Math.min(BOAT.maxSail, polar(twa) * wspd * SAIL_K) * Math.pow(b.sailNow, 0.7);

  // 노
  let rowT = 0;
  if (b.row) {
    const before = Math.sin(b.rowPhase);
    b.rowPhase = (b.rowPhase + dt * TAU / BOAT.rowPeriod) % TAU;
    if (before <= 0 && Math.sin(b.rowPhase) > 0) S.events.push({ type: 'stroke' });
    b.stamina = Math.max(0, b.stamina - BOAT.staminaDrain * dt);
    rowT = BOAT.rowSpeed * (b.stamina > 0 ? 1 : BOAT.tired) * (0.82 + 0.36 * Math.max(0, Math.sin(b.rowPhase)));
  } else {
    b.stamina = Math.min(1, b.stamina + BOAT.staminaRest * dt);
  }

  const target = Math.max(sailT, rowT) + 0.25 * Math.min(sailT, rowT);
  b.spd = ease(b.spd, target, dt, target > b.spd ? BOAT.accel : BOAT.coast);

  // 키
  let steer = Math.max(BOAT.minSteer, Math.min(1, b.spd / BOAT.fullSteerSpd));
  if (b.row) steer = Math.max(steer, BOAT.rowSteer);
  b.turn = ease(b.turn, b.rudder * BOAT.maxTurn * steer, dt, BOAT.turnLag);
  b.h = (b.h + b.turn * dt) % TAU;
  b.spd *= Math.exp(-Math.abs(b.turn) * 0.1 * dt);

  // 돛 각도: 맞바람일수록 조이고 뒷바람일수록 푼다. 바람이 반대쪽으로 넘어가면 돛이 넘어간다
  const trim = (12 + clamp((twa - NO_GO) / (PI - NO_GO), 0, 1) * 68) * PI / 180;
  const boomT = b.luff ? Math.sign(b.boom || 1) * 0.1 : -Math.sign(windSide || 1) * trim;
  const boomBefore = b.boom;
  b.boom += clamp(boomT - b.boom, -dt * 1.5, dt * 1.5);
  if (boomBefore * b.boom < 0 && b.sailNow > 0.2) S.events.push({ type: 'swing' });

  // 기울기: 바람 반대쪽으로 눕는다
  const heelT = b.luff ? 0 : Math.sign(windSide) * b.sailNow * Math.min(1.1, wspd / 12) * Math.sin(twa) * 0.34;
  b.heel = ease(b.heel, heelT, dt, 1.6);

  // 이동: 뱃머리 방향 + 바람에 밀림
  const lee = 0.018 * wspd * (0.25 + b.sailNow) * (0.4 + Math.sin(twa));
  const vx = Math.cos(b.h) * b.spd - Math.cos(from) * lee;
  const vy = Math.sin(b.h) * b.spd - Math.sin(from) * lee;
  let nx = b.x + vx * dt, ny = b.y + vy * dt;
  const d = W.dist(nx, ny);
  if (d < BOAT.clear) {
    const [gx, gy] = W.gradient(nx, ny);
    nx += gx * (BOAT.clear - d); ny += gy * (BOAT.clear - d);
    if (!b.grounded && b.spd > 1) S.events.push({ type: 'ground' });
    b.grounded = true;
    b.spd *= Math.exp(-dt * 2.2);
  } else if (d > BOAT.clear + 1.5) b.grounded = false;
  b.x = nx; b.y = ny;

  return S;
}

export const FIXED_DT = 1 / 30;
