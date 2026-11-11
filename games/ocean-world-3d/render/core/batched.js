// 서로 다른 모양의 물건을 BatchedMesh 하나로 그린다(재질 계열당 드로우 1회).
// 모든 지오메트리는 같은 속성 묶음(position, normal, color, aAux)과 index를 가져야 한다.
import * as THREE from 'three';

export class PropBatch {
  constructor(material, geometries, maxInstances) {
    let verts = 0, idx = 0;
    for (const g of geometries) { verts += g.attributes.position.count; idx += g.index ? g.index.count : 0; }
    this.mesh = new THREE.BatchedMesh(maxInstances, verts, idx, material);
    this.mesh.name = 'props';
    this.ids = geometries.map((g) => this.mesh.addGeometry(g));
    this._m = new THREE.Matrix4();
  }
  /** 지오메트리 번호 gi를 하나 놓는다. 반환값은 인스턴스 id. */
  add(gi, pos, quat, scale, color) {
    const id = this.mesh.addInstance(this.ids[gi]);
    this.mesh.setMatrixAt(id, this._m.compose(pos, quat, scale));
    if (color) this.mesh.setColorAt(id, color);
    return id;
  }
  move(id, pos, quat, scale) { this.mesh.setMatrixAt(id, this._m.compose(pos, quat, scale)); }
}
