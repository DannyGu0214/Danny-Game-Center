// 규칙(sim/)이 준 생물 상태를 종마다 InstancedMesh 하나에 그린다(P1 임시 움직임 wander.js를 대체, P2).
// 위치는 규칙의 고정 단계(1/30초) 두 개 사이를 보간만 한다. 방향·기울기·몸 기울임(roll)·걷는 박자는 화면 연출이라
// 여기서 부드럽게 잇는다(규칙은 길 점마다 방향을 바로 바꾼다). 땅·바닥 생물은 화면 높이 함수(heightAt)에 다시 얹는다.
// 몸 크기는 규칙의 bodyLen(종의 len × 크기 등급 draw, eco/atoll/data.js 한 곳)에 개체차만 곱한다.
// 모이는 연출(lure, 대니님 결정 2026-11-12): 물건을 놓은 직후 가까운 헤엄 생물 몇 마리가 몇 초 동안 그쪽으로 다가갔다 돌아간다.
// 규칙의 자리·분포는 그대로이고, 화면 보간 위에 얹는 오프셋일 뿐이다("먹으러 가기"를 규칙으로 되살리지 않음).
import * as THREE from 'three';
import { SpeciesMesh } from '../core/instancing.js';
import { patchMaterial } from '../core/materials/shaderPatches.js';
import { SPECIES, speciesMaterial } from './species.js';

const hash = (n, k = 0) => {
  let h = (n * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SWIM_LIFE = new Set(['swimmer', 'drifter', 'surfacer']);
const LURE_LIFE = new Set(['swimmer', 'surfacer']);   // 모이는 연출에 오는 생물(떠다니는 해파리는 빼요)

export class CreatureView {
  /**
   * @param {object} o { world, coords, heightAt, eco, bodyLen(sp), cap(종마다 최대 개체 수), sizeOverride({S,M,L,XL}|null), fixedZ(줄 세우기: 높이를 지형에 얹지 않음) }
   */
  constructor(o) {
    Object.assign(this, o);
    this.cap = o.cap ?? 48;
    this.meshes = new Map();   // sp → { sm, slots: uid[] }
    for (const def of SPECIES) {
      const geo = def.build();
      const { material, patches } = speciesMaterial(def);
      patchMaterial(material, patches, { slots: ['medium'], defines: { OW_CAUSTICS: true } });
      const sm = new SpeciesMesh(geo, material, this.cap);
      sm.mesh.count = 0;
      sm.mesh.name = 'sp-' + def.id;
      sm.mesh.renderOrder = def.mat && def.mat.transparent ? 3 : 0;
      o.world.add(sm.mesh);
      this.meshes.set(def.id, { def, sm, slots: [] });
    }
    this.disp = new Map();     // uid → 화면 연출 상태 { yaw, pitch, roll, walk }
    this.drawn = [];           // 고르기용: { uid, sp, pos(Three, 블록 좌표), r(몸 반지름) }
    this.total = 0;
    this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._c = new THREE.Color(); this._w = new THREE.Color(1, 1, 1);
    this.lures = new Map();    // uid → { tx, ty, tz, t, dur, ox, oy, oz } 모이는 연출(격자 좌표)
    this._last = new Map();    // uid → 지난 프레임에 그린 격자 자리(규칙 자리 + 오프셋 전)
  }

  /**
   * 모이는 연출: 격자 점 (x, y, z) 둘레로 가까운 헤엄 생물을 몇 마리 불러 모은다.
   * @param {{n?:number, radius?:number, dur?:number}} o n = 최대 마릿수, radius = 고르는 반경(칸), dur = 다가갔다 돌아가는 전체 시간(초)
   * @returns {number} 모인 마릿수
   */
  lure(x, y, z, o = {}) {
    const n = o.n ?? 4, radius = o.radius ?? 13, dur = o.dur ?? 4.6, H = this.heightAt;
    const cand = [];
    for (const [uid, p] of this._last) {
      if (this.lures.has(uid) || !LURE_LIFE.has(this.eco.species[p.sp]?.life)) continue;
      const d = Math.hypot(p.x - x, p.y - y, (p.z - z) * 0.6);
      if (d > radius || d < 1.2) continue;
      // 가는 길(곧은 선)이 섬·얕은 바닥을 지나지 않는 것만
      let clear = true;
      for (let k = 1; k < 6 && clear; k++) { const f = k / 6; if (H(p.x + (x - p.x) * f, p.y + (y - p.y) * f) > Math.min(-0.5, p.z + (z - p.z) * f - 0.3)) clear = false; }
      if (clear) cand.push([d, uid, p]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const pick = cand.slice(0, n);
    pick.forEach(([, uid, p], i) => {
      // 물건 둘레 고리 위의 제자리(서로 겹치지 않게), 물건보다 조금 위
      const a = Math.atan2(p.y - y, p.x - x) + (i - (pick.length - 1) / 2) * 0.5;
      const L = this.lenOf(uid, p.sp), r = 1.1 + L * 0.6 + (i % 2) * 0.5;
      this.lures.set(uid, { cx: x, cy: y, tx: x + Math.cos(a) * r, ty: y + Math.sin(a) * r, tz: z + 0.4 + (i % 3) * 0.35, t: -i * 0.18, dur, ox: 0, oy: 0 });
    });
    return pick.length;
  }

  /** 모이는 정도 0..1(다가감 1.2초 → 머묾 → 돌아감 1.6초, 매끈하게) */
  static lureWeight(t, dur) {
    if (t <= 0 || t >= dur) return 0;
    const sm = (u) => u * u * (3 - 2 * u);
    return Math.min(sm(Math.min(1, t / 1.2)), sm(Math.min(1, (dur - t) / 1.6)));
  }

  /** 몸 길이(칸): 규칙 값 × 개체차(±12%). sizeOverride가 있으면 등급 배율만 바꿔 끼운다(주소 옵션 ?sizes=) */
  lenOf(uid, sp) {
    let L = this.bodyLen(sp);
    if (this.sizeOverride) { const s = this.eco.species[sp]; L = (s.len ?? 1) * (this.sizeOverride[s.size] ?? 1); }
    return L * (0.88 + hash(uid, 1) * 0.24);
  }
  /** 몸 높이의 절반(칸): 바닥에 묻히지 않게 띄우는 값 */
  static half(sp, L) { return sp === 'manta' ? 0.12 * L : sp === 'moonjelly' ? 0.45 * L : 0.25 * L; }

  _slope(x, y, yaw) {
    const e = 0.4, fx = Math.cos(yaw), fy = Math.sin(yaw);
    return Math.atan2(this.heightAt(x + fx * e, y + fy * e) - this.heightAt(x - fx * e, y - fy * e), 2 * e);
  }

  /**
   * @param {object[]} prev 직전 단계의 생물 목록(sim creatures 모양). 없거나 uid가 없으면 cur를 그대로
   * @param {object[]} cur 지금 단계의 생물 목록
   * @param {number} alpha 0..1 두 단계 사이 비율
   * @param {number} dt 화면 프레임 시간(초, 연출용)
   */
  update(prev, cur, alpha, dt) {
    const pm = this._pm || (this._pm = new Map());
    pm.clear();
    if (prev) for (const c of prev) pm.set(c.uid, c);
    const groups = new Map();
    for (const k of this.meshes.keys()) groups.set(k, []);
    const seen = new Set();
    this.drawn.length = 0;
    const H = this.heightAt;
    for (const c of cur) {
      const m = this.meshes.get(c.sp);
      if (!m) continue;
      const p = pm.get(c.uid) || c;
      const life = this.eco.species[c.sp]?.life;
      const L = this.lenOf(c.uid, c.sp), half = CreatureView.half(c.sp, L);
      // 순간이동(불러오기·자리 고치기)은 보간하지 않는다
      const jump = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) > 3;
      const a = jump ? 1 : alpha;
      const x = lerp(p.x, c.x, a), y = lerp(p.y, c.y, a);
      let z = lerp(p.z, c.z, a);
      let face = p.face + angDiff(p.face, c.face) * a;
      this._last.set(c.uid, { sp: c.sp, x, y, z });
      // 모이는 연출: 규칙 자리에서 물건 쪽 제자리로 끌려가는 오프셋. 가는 동안·머무는 동안은 그쪽을, 돌아갈 때는 제자리 쪽을 본다
      const lu = this.lures.get(c.uid);
      let lx = x, ly = y;
      if (lu) {
        lu.t += dt;
        const w = CreatureView.lureWeight(lu.t, lu.dur);
        if (lu.t >= lu.dur) this.lures.delete(c.uid);
        else if (w > 0) {
          const nx = x + (lu.tx - x) * w, ny = y + (lu.ty - y) * w, nz = z + (lu.tz - z) * w;
          const mx = nx - x - lu.ox, my = ny - y - lu.oy;   // 이번 프레임 오프셋 변화(끌려가는 방향)
          lu.ox = nx - x; lu.oy = ny - y;
          const back = lu.t > lu.dur - 1.6, going = lu.t < 1.2;
          // 다가갈 때는 제자리 쪽, 머무는 동안은 물건 쪽, 돌아갈 때는 움직이는 쪽을 본다
          const look = back ? (Math.hypot(mx, my) > 1e-4 ? Math.atan2(my, mx) : face)
            : going && Math.hypot(lu.tx - nx, lu.ty - ny) > 0.5 ? Math.atan2(lu.ty - ny, lu.tx - nx) : Math.atan2(lu.cy - ny, lu.cx - nx);
          face += angDiff(face, look) * Math.min(1, w * 1.6);
          lx = nx; ly = ny; z = nz;
        }
      }
      let d = this.disp.get(c.uid);
      if (!d || jump) { d = { yaw: face, pitch: c.pitch || 0, roll: 0, walk: 0 }; this.disp.set(c.uid, d); }
      seen.add(c.uid);
      const swim = SWIM_LIFE.has(life);
      const ground = c.on === 'land' || c.on === 'bed';
      const k = 1 - Math.exp(-dt * (swim ? 4.5 : 9));
      const dy = angDiff(d.yaw, face);
      d.yaw += dy * k;
      let pitch;
      if (this.fixedZ) pitch = 0;                                                                  // 줄 세우기: 준 높이 그대로
      else if (life === 'sessile') { z = H(lx, ly); pitch = 0; }
      else if (!swim || (ground && life !== 'surfacer')) { z = H(lx, ly); pitch = this._slope(lx, ly, d.yaw); }
      else if (c.on === 'land') { z = H(lx, ly) + half; pitch = this._slope(lx, ly, d.yaw); }       // 수면형이 뭍에서 볕 쬐기
      else { z = Math.max(z, H(lx, ly) + half + 0.05); if (lu) z = Math.min(z, -half - 0.15); pitch = lu ? 0 : c.pitch || 0; }                  // 화면 지형이 칸 높이보다 높은 곳에서 묻히지 않게
      d.pitch += (clamp(pitch, -0.6, 0.6) - d.pitch) * Math.min(1, dt * 4);
      const rollT = swim && life !== 'drifter' ? clamp(dy * 0.8, -0.4, 0.4) : 0;
      d.roll += (rollT - d.roll) * Math.min(1, dt * 2);
      d.walk += ((c.st === 'move' ? 1 : 0) - d.walk) * Math.min(1, dt * 5);
      groups.get(c.sp).push({ c, x: lx, y: ly, z, d, L });
    }
    for (const uid of [...this.disp.keys()]) if (!seen.has(uid)) this.disp.delete(uid);
    for (const uid of [...this._last.keys()]) if (!seen.has(uid)) { this._last.delete(uid); this.lures.delete(uid); }

    let total = 0;
    for (const [sp, m] of this.meshes) {
      const list = groups.get(sp), sm = m.sm, n = Math.min(list.length, this.cap);
      for (let i = 0; i < n; i++) {
        const { c, x, y, z, d, L } = list[i];
        if (m.slots[i] !== c.uid) {   // 이 자리에 다른 개체가 왔으면 개체 속성(위상·박자·색)을 다시 넣는다
          m.slots[i] = c.uid;
          sm.setPhase(i, hash(c.uid, 2) * Math.PI * 2);
          sm.setSpeed(i, 0.85 + hash(c.uid, 3) * 0.3);
          sm.setParams(i, hash(c.uid, 4) * 0.1, 0, 0, 0);
          this._c.setHSL(hash(c.uid, 5), 0.25, 0.9);
          sm.setColor(i, this._w.setRGB(1, 1, 1).lerp(this._c, sp === 'moonjelly' ? 0.6 : 0.25));
        }
        this.coords.toWorld(x, y, z, this._p);
        this._e.set(-d.pitch, this.coords.yawToWorld(d.yaw), d.roll);
        this._q.setFromEuler(this._e);
        sm.setTransform(i, this._p, this._q, L);
        if (m.def.walk) sm.params.setY(i, d.walk);
        const half = CreatureView.half(sp, L), swim = SWIM_LIFE.has(this.eco.species[sp].life);
        this.drawn.push({ uid: c.uid, sp, pos: this._p.clone().setY(this._p.y + (swim ? 0 : half)), r: Math.max(L * 0.5, 0.4) });
      }
      m.slots.length = n;
      sm.mesh.count = n;
      if (m.def.walk) sm.params.needsUpdate = true;
      sm.commit();
      total += n;
    }
    this.total = total;
  }
}
