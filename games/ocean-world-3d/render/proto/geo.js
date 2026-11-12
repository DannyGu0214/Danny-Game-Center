// 도형 도우미: 기본 도형에 꼭짓점 색과 변형 속성(aDef 또는 aAux)을 붙여 하나로 합친다. P3부터 생물·물건 모양은 eco/atoll/species·props 생성기가 만들고, 이 파일은 render/main.js가 쓰는 rng와 확인용 도우미만 남는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const _p = new THREE.Vector3();

/**
 * @param {THREE.BufferGeometry} g
 * @param {number|((p:THREE.Vector3)=>number|THREE.Color)} color
 * @param {((p:THREE.Vector3, i:number)=>number[])|number[]} def aDef 값(vec4) 또는 함수
 * @param {string} attr 'aDef'(생물) | 'aAux'(물건, vec2)
 */
export function part(g, color, def = [0, 0, 0, 0], attr = 'aDef') {
  g = g.index ? g : g; // 그대로
  if (!g.index) {
    const n = g.attributes.position.count;
    g.setIndex([...Array(n).keys()]);
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('uv1');
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position, n = pos.count;
  const size = attr === 'aDef' ? 4 : 2;
  const col = new Float32Array(n * 3), d = new Float32Array(n * size);
  for (let i = 0; i < n; i++) {
    _p.fromBufferAttribute(pos, i);
    const c = typeof color === 'function' ? color(_p, i) : color;
    if (c && c.isColor) _c.copy(c); else _c.set(c);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    const v = typeof def === 'function' ? def(_p, i) : def;
    for (let k = 0; k < size; k++) d[i * size + k] = v[k] || 0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute(attr, new THREE.BufferAttribute(d, size));
  return g;
}

export function merge(parts) {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('mergeGeometries 실패');
  g.computeBoundingSphere();
  return g;
}

/** 두 점 사이 원기둥(굵기 r0→r1) */
export function tube(a, b, r0, r1, radial = 6, seg = 1) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, seg, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

export const hex = (h) => new THREE.Color(h);
export const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));

/** 결정적 난수 */
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
