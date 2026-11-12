// 규칙(sim/)이 준 물건 목록을 BatchedMesh 하나(PropBatch)에 그린다(P2). 물건 하나 = 생성기 조각 몇 개의 조합.
// 조각 배치(RECIPES)는 P3 생성기(eco/atoll/props/<id>.js의 recipe)가 정한다. 좌표는 모두 격자(칸), 변환은 coords 한 곳.
//   at: 'ground' 그 자리 지형 높이(화면 heightAt) · 'item' 규칙이 준 물건 높이(수중 층 띠 가운데) · 'sea' 수면(떠 있는 물건)
//   dx, dy: 물건 발자국 가운데에서 떨어진 칸(물건 방향 rot을 따라 돈다) · s: 크기 · up: 세로 줄(밧줄·기둥)을 지형에서 그 높이까지 늘림
import * as THREE from 'three';
import { propRecipes } from './props.js';

const hash = (n, k = 0) => {
  let h = (n * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const C = (h) => new THREE.Color(h);

// 물건 id → 조각 배치 표. P3부터 eco/atoll/props/ 생성기가 정한다(render/proto/props.js가 모음)
const RECIPES = propRecipes();

export class PropView {
  /**
   * @param {object} o { batch(PropBatch), index(모양 이름 → 번호), coords, heightAt, eco }
   */
  constructor(o) {
    Object.assign(this, o);
    this.items = new Map();   // uid → { p(규칙 물건), parts: [{ id(인스턴스), spec, base }], floats }
    this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3();
    this._white = new THREE.Color(1, 1, 1);
    this._yaxis = new THREE.Vector3(0, 1, 0);
  }

  /** 규칙 물건 목록과 맞춘다: 없어진 것은 지우고 새로 생긴 것은 놓는다(같은 uid는 그대로) */
  sync(list) {
    const keep = new Set();
    for (const p of list) {
      keep.add(p.uid);
      const had = this.items.get(p.uid);
      if (had && had.p.x === p.x && had.p.y === p.y && had.p.layer === p.layer && had.p.rot === p.rot) continue;
      if (had) this._remove(p.uid);
      this._add(p);
    }
    for (const uid of [...this.items.keys()]) if (!keep.has(uid)) this._remove(uid);
  }

  _remove(uid) {
    const e = this.items.get(uid);
    if (!e) return;
    for (const part of e.parts) this.batch.mesh.deleteInstance(part.id);
    this.items.delete(uid);
  }

  _add(p) {
    const recipe = RECIPES[p.id] || [];
    const def = this.eco.items[p.id];
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const yaw = p.rot * Math.PI / 2 + (def.kind === 'nature' ? (hash(p.uid, 7) - 0.5) * 0.8 : 0);
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const parts = [];
    recipe.forEach((spec, k) => {
      const name = Array.isArray(spec.g) ? spec.g[Math.floor(hash(p.uid, k) * spec.g.length)] : spec.g;
      const gi = this.index[name];
      if (gi == null) return;
      const dx = spec.dx || 0, dy = spec.dy || 0;
      const x = cx + dx * cs - dy * sn, y = cy + dx * sn + dy * cs;
      const ground = this.heightAt(x, y);
      parts.push({ spec, gi, x, y, ground, yaw: yaw + (spec.yaw || 0) });
    });
    const e = { p, parts: [] };
    for (const part of parts) {
      const id = this.batch.mesh.addInstance(this.batch.ids[part.gi]);
      this.batch.mesh.setColorAt(id, part.spec.color != null ? C(part.spec.color) : this._white);
      part.id = id;
      e.parts.push(part);
      this._place(part, p, null);
    }
    this.items.set(p.uid, e);
  }

  /** 한 조각의 행렬. sea = 떠 있는 물건의 지금 수면 높이(없으면 0) */
  _place(part, p, sea) {
    const s = part.spec, seaZ = sea?.z ?? 0;
    const itemZ = p.zone === 'water' ? p.z : part.ground;
    let z = s.at === 'item' ? itemZ : s.at === 'sea' ? seaZ - 0.12 : part.ground;
    if (s.z != null) z = s.z;
    const k = s.s ?? 1;
    if (s.up != null) {
      const top = s.up === 'sea' ? seaZ - 0.2 : s.up === 'item' ? itemZ : s.up;
      this._s.set(s.w ?? 1, Math.max(0.05, top - part.ground), s.w ?? 1);
      z = part.ground;
    } else this._s.set(k, k, k);
    this.coords.toWorld(part.x, part.y, z, this._p);
    this._q.setFromAxisAngle(this._yaxis, this.coords.yawToWorld(part.yaw) - Math.PI / 2);
    if (s.float && sea) this._q.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-sea.tiltY * 0.8, 0, -sea.tiltX * 0.8)));
    this.batch.move(part.id, this._p, this._q, this._s);
  }

  /** 떠 있는 물건(부표)을 수면 높이에 맞춘다. floatAt(x, y, state) → state{ z, tiltX, tiltY } */
  update(floatAt) {
    for (const e of this.items.values()) {
      if (!this.eco.items[e.p.id].float) continue;
      e.sea = floatAt(e.p.x + e.p.w / 2, e.p.y + e.p.h / 2, e.sea || {});
      for (const part of e.parts) if (part.spec.float || part.spec.up === 'sea') this._place(part, e.p, e.sea);
    }
  }

  /** 고르기용 목록: { uid, pos(Three 블록 좌표), r } */
  pickList() {
    const out = [];
    for (const [uid, e] of this.items) {
      const p = e.p, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      const z = p.zone === 'water' ? p.z : this.heightAt(cx, cy) + Math.min(1.2, p.w * 0.3);
      out.push({ uid, id: p.id, pos: this.coords.toWorld(cx, cy, z, new THREE.Vector3()), r: Math.max(p.w, p.h) * 0.45 });
    }
    return out;
  }

  get count() { return this.items.size; }
}
