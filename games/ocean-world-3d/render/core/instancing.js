// 종(species)마다 InstancedMesh 하나. 인스턴스 속성(위상·속도·개체차)을 붙여 꼭짓점 셰이더 변형에 쓴다.
import * as THREE from 'three';

export class SpeciesMesh {
  /**
   * @param {THREE.BufferGeometry} geometry 길이(또는 폭) 1로 정규화된 몸
   * @param {THREE.Material} material
   * @param {number} count
   */
  constructor(geometry, material, count) {
    const cap = Math.max(1, count);
    this.mesh = new THREE.InstancedMesh(geometry, material, cap);
    this.mesh.count = count;
    this.mesh.frustumCulled = false; // 개체가 블록 안을 돌아다녀서 묶음 경계를 매번 다시 재지 않음
    this.phase = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    this.speed = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1);
    this.params = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.speed.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aPhase', this.phase);
    geometry.setAttribute('aSpeed', this.speed);
    geometry.setAttribute('aParams', this.params);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3();
  }
  setPhase(i, p) { this.phase.array[i] = p; this.phase.needsUpdate = true; }
  setSpeed(i, s) { this.speed.array[i] = s; this.speed.needsUpdate = true; }
  setParams(i, a, b, c, d) { this.params.setXYZW(i, a, b, c, d); this.params.needsUpdate = true; }
  setColor(i, color) { this.mesh.setColorAt(i, color); this.mesh.instanceColor.needsUpdate = true; }
  /** 위치·회전·크기. size는 균일 배율. */
  setTransform(i, pos, quat, size) {
    this._s.set(size, size, size);
    this._m.compose(pos, quat, this._s);
    this.mesh.setMatrixAt(i, this._m);
  }
  commit() { this.mesh.instanceMatrix.needsUpdate = true; }
}
