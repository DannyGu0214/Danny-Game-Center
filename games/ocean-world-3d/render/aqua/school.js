// 장식 물고기 떼(규칙·점수와 무관한 렌더 연출, PLAN 3절). 떼 여러 개를 InstancedMesh 하나(드로우 1회)로 그린다.
// 모양은 생성기(eco/<생태계>/species/*.js의 build 결과)를 받는다. 움직임은 CPU에서 떼마다 매끈한 궤도 하나를 돌리고,
// 물고기마다 궤도를 조금 늦게 따라가며(지연) 떼 안의 제자리(오프셋)에서 흔들린다. 꼬리 흔들기는 셰이더(생성기의 deform).
// 매 프레임 비용: 물고기 1마리당 궤도 계산 2번 + 행렬 1개(100마리 기준 무시할 만함).
import * as THREE from 'three';
import { patchMaterial } from '../core/materials/shaderPatches.js';
import { DEF_COMMON, SQUASH } from '../core/deform.js';
import { SpeciesMesh } from '../core/instancing.js';

/**
 * 생성기 결과로 재질을 만든다(종 메시와 떼가 같이 쓰는 조립 규칙).
 * 조각 순서: DEF_COMMON(공용 선언) → SQUASH(젤리 눌림) → 생성기 deform → 생성기 shade → 장면 슬롯(물속 안개 등)
 * @param {object} kit build(THREE, opts)의 결과
 * @param {{slots?: string[], defines?: object}} o
 */
export function kitMaterial(kit, o = {}) {
  const M = THREE[kit.material.type];
  const m = new M(Object.assign({ vertexColors: true }, kit.material.params));
  m.name = `sp-${kit.id}-${kit.variant}`;
  patchMaterial(m, [DEF_COMMON, SQUASH, ...kit.deform, ...(kit.shade || [])], {
    slots: o.slots ?? ['medium'], defines: o.defines ?? { OW_CAUSTICS: true },
  });
  return m;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * @param {object} kit 생성기 결과(예: chromis build)
 * @param {object} o
 * @param {{count:number, center:number[], radius:number[], speed?:number, spread?:number, size?:number}[]} o.schools
 *        center·radius는 부모 좌표(Three). speed = 궤도 속도(단위/초), spread = 떼 반경, size = 물고기 몸길이
 * @param {THREE.Box3} [o.bounds] 이 상자 밖으로 나가지 않게 자름(부모 좌표)
 * @param {(x:number, z:number)=>number} [o.floor] 바닥 높이(부모 좌표). 바닥 위 0.3 + 몸 크기 아래로 내려가지 않음
 * @param {number} [o.seed]
 * @param {string[]} [o.slots] @param {object} [o.defines] 재질 조립 옵션(kitMaterial)
 */
export function createSchool(kit, o) {
  const r = rng(o.seed ?? 17);
  const total = o.schools.reduce((s, k) => s + k.count, 0);
  const material = kitMaterial(kit, o);
  const sm = new SpeciesMesh(kit.geometry, material, total);
  sm.mesh.name = 'school-' + kit.id;
  sm.mesh.renderOrder = kit.material.renderOrder || 0;
  const fish = [];
  o.schools.forEach((k, si) => {
    const sp = k.speed ?? 1.2, spread = k.spread ?? 1.2, size = k.size ?? 0.35;
    const rad = k.radius || [4, 0.8, 3];
    const path = {
      c: new THREE.Vector3(...k.center), rx: rad[0], ry: rad[1], rz: rad[2],
      w: sp / Math.max(0.5, (rad[0] + rad[2]) / 2), p: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28],
      dirSign: r() < 0.5 ? -1 : 1,
    };
    for (let i = 0; i < k.count; i++) {
      // 떼 안의 자리: 앞뒤로 긴 타원체 안에 고르게
      let x, y, z;
      do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
      const f = {
        path, lag: r() * 0.9 * spread / sp + 0.05,
        off: new THREE.Vector3(x * spread, y * spread * 0.45, z * spread * 1.3),
        wob: [0.6 + r() * 0.8, r() * 6.28, 0.5 + r() * 0.7, r() * 6.28],
        size: size * (0.85 + r() * 0.3),
      };
      fish.push(f);
      const idx = fish.length - 1;
      sm.setPhase(idx, r() * Math.PI * 2);
      sm.setSpeed(idx, (0.85 + r() * 0.3) * Math.min(1.6, 0.6 + sp * 0.35));
      sm.setParams(idx, 0, 0, 0, 0);
    }
  });

  const at = (P, t, out) => {
    const a = P.w * t * P.dirSign;
    return out.set(
      P.c.x + P.rx * Math.sin(a + P.p[0]) + 0.25 * P.rx * Math.sin(0.43 * a + P.p[1]),
      P.c.y + P.ry * Math.sin(0.61 * a + P.p[2]),
      P.c.z + P.rz * Math.cos(a + P.p[0]) + 0.25 * P.rz * Math.cos(0.37 * a + P.p[3]));
  };
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  const pos = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();

  function update(dt, t) {
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i], tt = t - f.lag;
      at(f.path, tt, p0); at(f.path, tt + 0.05, p1);
      fwd.subVectors(p1, p0).normalize();
      side.crossVectors(Y, fwd).normalize(); up.crossVectors(fwd, side);
      const w = f.wob;
      pos.copy(p0)
        .addScaledVector(side, f.off.x + 0.12 * Math.sin(t * w[0] + w[1]))
        .addScaledVector(up, f.off.y + 0.08 * Math.sin(t * w[2] + w[3]))
        .addScaledVector(fwd, f.off.z);
      if (o.floor) pos.y = Math.max(pos.y, o.floor(pos.x, pos.z) + 0.3 + f.size);
      if (o.bounds) pos.clamp(o.bounds.min, o.bounds.max);
      m.makeBasis(side, up, fwd).scale(p0.set(f.size, f.size, f.size)).setPosition(pos);
      sm.mesh.setMatrixAt(i, m);
    }
    sm.commit();
  }
  update(0, 0);
  return { mesh: sm.mesh, update, count: total, material, triangles: kit.info.triangles * total };
}
