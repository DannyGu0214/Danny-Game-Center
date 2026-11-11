// 화면 확인용 임시 움직임(규칙이 아님). 실제 이동 규칙은 sim/이 정하고 P2에서 이 파일을 대체한다.
// 대니님 결정(2026-11-12): 헤엄치는 생물은 표층·중층·저층을 가리지 않고 다닌다.
// 좌표는 모두 격자(칸) 기준: x, y 바닥면, z 높이(수면 0).
import { rng } from './geo.js';
import { jellyPulse } from '../aqua/swim.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export class Wander {
  constructor({ bounds, heightAt, seed = 1, sizeScale = null }) {
    this.b = bounds; this.H = heightAt; this.r = rng(seed);
    this.sizeScale = sizeScale || {};   // 크기 등급별 화면 배율(S·M·L·XL)
    this.list = [];
    this.current = { x: 0, y: 0, z: 0 };   // 블록 흔들림 → 해류(격자 방향)
  }

  /** 조건에 맞는 칸을 무작위로 찾는다 */
  _find(pred, tries = 400, near = null, rad = 0) {
    const b = this.b, m = 1.5;
    for (let k = 0; k < tries; k++) {
      let x, y;
      if (near) { const a = this.r() * TAU, d = Math.sqrt(this.r()) * rad; x = near.x + Math.cos(a) * d; y = near.y + Math.sin(a) * d; }
      else { x = b.x0 + m + this.r() * (b.x1 - b.x0 - 2 * m); y = b.y0 + m + this.r() * (b.y1 - b.y0 - 2 * m); }
      if (x < b.x0 + m || x > b.x1 - m || y < b.y0 + m || y > b.y1 - m) continue;
      const g = this.H(x, y);
      if (pred(g, x, y)) return { x, y, g };
    }
    return null;
  }

  /** 물 부피에 비례해 헤엄칠 점을 고른다: 물기둥이 깊은 칸일수록 자주 뽑히고, 높이는 물기둥 안에서 고르게.
   *  그래서 얕은 석호보다 칸두·중층에도 고르게 퍼진다(대니님 방향 2026-11-11: 생동감과 균형감). */
  _findWater(half, tries = 600) {
    const need = half * 2 + 0.5, maxCol = 12;
    for (let k = 0; k < tries; k++) {
      const p = this._find((g) => g < -need, 1);
      if (!p) continue;
      const col = -p.g - need;                       // 몸이 들어갈 수 있는 물기둥 높이
      if (this.r() * maxCol > col) continue;         // 깊이에 비례한 거절 표본
      const lo = p.g + half + 0.25, hi = -half - 0.15;
      p.z = lo + this.r() * Math.max(0, hi - lo);
      return p;
    }
    return this._find((g) => g < -need);
  }

  add(sp, place) {
    const c = { sp, life: sp.life, L: sp.L * (this.sizeScale[sp.size] ?? 1) * (0.88 + this.r() * 0.24), x: 0, y: 0, z: 0, yaw: this.r() * TAU, pitch: 0, roll: 0,
      vx: 0, vy: 0, vz: 0, speed: sp.speed * (0.8 + this.r() * 0.4), phase: this.r() * TAU, tgt: null, walk: 0 };
    const half = this._half(c);
    let p = null;
    if (place) p = { ...place, g: this.H(place.x, place.y) };
    else if (c.life === 'walk') p = this._find((g) => g > 0.25);
    else if (c.life === 'crawl') p = this._find((g) => g < -0.8);
    else if (c.life === 'fixed') p = this._find((g) => g < -0.6 && g > -2.5);
    else p = this._findWater(half);
    if (!p) p = { x: (this.b.x0 + this.b.x1) / 2, y: (this.b.y0 + this.b.y1) / 2, g: this.H(20, 20) };
    c.x = p.x; c.y = p.y;
    c.home = { x: p.x, y: p.y };
    if (c.life === 'swim' || c.life === 'drift') c.z = p.z ?? (p.g + half + 0.3 + this.r() * Math.max(0, -p.g - 2 * half - 0.6));
    else c.z = p.g;
    this.list.push(c);
    return c;
  }

  /** 몸 높이의 절반(칸) */
  _half(c) { return c.sp.id === 'manta' ? 0.12 * c.L : c.sp.id === 'moonjelly' ? 0.45 * c.L : 0.25 * c.L; }

  _newTarget(c) {
    const half = this._half(c);
    if (c.life === 'walk') c.tgt = this._find((g) => g > 0.25, 200, c.home, 7) || c.home;
    else if (c.life === 'crawl') c.tgt = this._find((g) => g < -0.8, 200, c, 22) || c.home;   // 깊은 해저까지(수심 제한 없음, 블록 대부분이 범위)
    else {
      // 모든 수위층, 물 부피에 비례: 바닥 위 ~ 수면 아래 사이 아무 높이
      const p = this._findWater(half);
      if (!p) { c.tgt = { x: c.x, y: c.y, z: c.z }; return; }
      c.tgt = p;
    }
    c.wait = c.life === 'walk' || c.life === 'crawl' ? this.r() * 1.2 : 0;
  }

  update(dt, t) {
    for (const c of this.list) {
      if (c.life === 'fixed') continue;
      if (!c.tgt) this._newTarget(c);
      if (c.wait > 0) { c.wait -= dt; c.walk = Math.max(0, c.walk - dt * 3); continue; }
      const half = this._half(c);
      const dx = c.tgt.x - c.x, dy = c.tgt.y - c.y;
      const dz = c.tgt.z !== undefined ? c.tgt.z - c.z : 0;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < Math.max(0.6, c.L * 0.6)) { this._newTarget(c); continue; }
      const want = Math.atan2(dy, dx);
      const turn = (c.life === 'swim' ? 1.4 : c.life === 'drift' ? 0.6 : 2.2) / Math.max(0.6, Math.sqrt(c.L));
      c.yaw += clamp(angDiff(c.yaw, want), -turn * dt, turn * dt);
      const facing = Math.max(0, Math.cos(angDiff(c.yaw, want)));
      let sp = c.speed * (0.35 + 0.65 * facing);
      if (c.life === 'drift') {
        // 해파리: 박동할 때 위로 밀리고 천천히 가라앉음
        const k = jellyPulse(t, 1, c.phase);
        c.vz = (k * 0.9 - 0.34) * 0.5 + clamp(dz, -1, 1) * 0.2;   // 뜨는 힘과 가라앉는 힘을 거의 같게(아래층까지)
        sp *= 0.4 + k;
      } else if (c.life === 'swim') {
        c.vz += (clamp(dz / Math.max(dist, 1e-3), -0.6, 0.6) * c.speed - c.vz) * Math.min(1, dt * 1.5);
      }
      c.x += Math.cos(c.yaw) * sp * dt + this.current.x * dt;
      c.y += Math.sin(c.yaw) * sp * dt + this.current.y * dt;
      const b = this.b, m = 0.6 + c.L * 0.4;
      c.x = clamp(c.x, b.x0 + m, b.x1 - m); c.y = clamp(c.y, b.y0 + m, b.y1 - m);
      const g = this.H(c.x, c.y);
      if (c.life === 'walk') {
        if (g < 0.1) { c.x -= Math.cos(c.yaw) * sp * dt; c.y -= Math.sin(c.yaw) * sp * dt; this._newTarget(c); }
        c.z = this.H(c.x, c.y); c.walk = Math.min(1, c.walk + dt * 3);
        c.pitch = this._slope(c);
      } else if (c.life === 'crawl') {
        if (g > -0.5) { c.x -= Math.cos(c.yaw) * sp * dt; c.y -= Math.sin(c.yaw) * sp * dt; this._newTarget(c); }
        c.z = this.H(c.x, c.y); c.pitch = this._slope(c);
      } else {
        c.z += c.vz * dt + this.current.z * dt * 0.3;
        // 앞쪽 지형 살피기: 부딪힐 것 같으면 위로
        const ahead = this.H(c.x + Math.cos(c.yaw) * c.L, c.y + Math.sin(c.yaw) * c.L);
        const floor = Math.max(g, ahead) + half + 0.15;
        if (c.z < floor) { c.z += (floor - c.z) * Math.min(1, dt * 4); c.vz = Math.max(c.vz, 0.3); }
        c.z = clamp(c.z, g + half + 0.05, -half - 0.08);
        const pt = c.life === 'drift' ? 0 : clamp(Math.atan2(c.vz, sp + 1e-3), -0.5, 0.5);
        c.pitch += (pt - c.pitch) * Math.min(1, dt * 3);
        c.roll += (clamp(angDiff(c.yaw, want) * 0.6, -0.4, 0.4) - c.roll) * Math.min(1, dt * 2);
      }
    }
    this.current.x *= 0.96; this.current.y *= 0.96; this.current.z *= 0.96;
  }

  _slope(c) {
    const e = 0.4, fx = Math.cos(c.yaw), fy = Math.sin(c.yaw);
    return Math.atan2(this.H(c.x + fx * e, c.y + fy * e) - this.H(c.x - fx * e, c.y - fy * e), 2 * e);
  }
}
