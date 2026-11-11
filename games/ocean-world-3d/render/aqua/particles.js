// 부유 입자(마린 스노)와 빛줄기. 둘 다 CPU 갱신 없이 셰이더에서 움직이고, 각각 드로우 1회.
import * as THREE from 'three';
import { patchMaterial } from '../core/materials/shaderPatches.js';

/** 블록 좌표 상자(min, max, Three) 안을 순환하는 점들 */
export function createMarineSnow(box, count, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pos = new Float32Array(count * 3), rnd4 = new Float32Array(count);
  const size = box.getSize(new THREE.Vector3());
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box.min.x + rnd() * size.x;
    pos[i * 3 + 1] = box.min.y + rnd() * size.y;
    pos[i * 3 + 2] = box.min.z + rnd() * size.z;
    rnd4[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd4, 1));
  g.boundingSphere = new THREE.Sphere(box.getCenter(new THREE.Vector3()), size.length() / 2);
  const mat = new THREE.PointsMaterial({ color: 0xf2fbff, size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false });
  mat.name = 'marineSnow';
  const patch = {
    name: 'snow',
    uniforms: { uBoxMin: { value: box.min.clone() }, uBoxSize: { value: size.clone() }, uFlow: { value: new THREE.Vector3(0.12, -0.05, 0.06) } },
    vertexPars: /* glsl */`attribute float aRnd; uniform vec3 uBoxMin, uBoxSize, uFlow; varying float vEdge;`,
    vertexDeform: /* glsl */`
{
  vec3 p = position + uFlow * uTime * (0.6 + aRnd) + vec3(sin(uTime * 0.7 + aRnd * 30.0), cos(uTime * 0.5 + aRnd * 20.0), sin(uTime * 0.6 + aRnd * 11.0)) * 0.25;
  transformed = mod(p - uBoxMin, uBoxSize) + uBoxMin;
  vec3 q = (transformed - uBoxMin) / uBoxSize;
  vEdge = min(min(min(q.x, 1.0 - q.x), min(q.z, 1.0 - q.z)), 1.0 - q.y) * 12.0;
}`,
    fragmentPars: /* glsl */`varying float vEdge;`,
    fragmentOutput: /* glsl */`
{
  float r = length(gl_PointCoord - 0.5);
  gl_FragColor.a *= (1.0 - smoothstep(0.25, 0.5, r)) * clamp(vEdge, 0.0, 1.0);
}`,
  };
  patchMaterial(mat, [patch], { slots: ['medium'] });
  const pts = new THREE.Points(g, mat);
  pts.name = 'marine-snow';
  pts.renderOrder = 4;
  return pts;
}

/** 수면에서 비스듬히 내려오는 빛줄기 판(교차한 판 두 장씩). 가산 혼합. */
export function createLightShafts(points, sunDir, length, seed = 3) {
  const P = [], U = [], R = [], I = [];
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const d = new THREE.Vector3(-sunDir.x, -sunDir.y, -sunDir.z).normalize(); // 빛이 내려가는 방향
  for (const p of points) {
    const w = 0.7 + rnd() * 1.1, L = length * (0.65 + rnd() * 0.5), r = rnd();
    for (let k = 0; k < 2; k++) {
      const side = new THREE.Vector3().crossVectors(d, k ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(w / 2);
      const top = p, bot = p.clone().addScaledVector(d, L);
      const base = P.length / 3;
      for (const [q, u, v] of [[top.clone().sub(side), 0, 0], [top.clone().add(side), 1, 0], [bot.clone().sub(side), 0, 1], [bot.clone().add(side), 1, 1]]) {
        P.push(q.x, q.y, q.z); U.push(u, v); R.push(r);
      }
      I.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('aRnd', new THREE.Float32BufferAttribute(R, 1));
  g.setIndex(I);
  g.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  mat.name = 'lightShafts';
  const patch = {
    name: 'shafts',
    uniforms: { uShaftGain: { value: 1 } },
    vertexPars: /* glsl */`attribute float aRnd; varying vec2 vSUv; varying float vSRnd;`,
    vertexDeform: /* glsl */`vSUv = uv; vSRnd = aRnd;`,
    fragmentPars: /* glsl */`varying vec2 vSUv; varying float vSRnd; uniform float uShaftGain;`,
    fragmentOutput: /* glsl */`
{
  float along = (1.0 - vSUv.y) * smoothstep(0.0, 0.08, vSUv.y);
  float edge = sin(3.14159 * vSUv.x);
  float flick = 0.6 + 0.4 * sin(uTime * (0.6 + vSRnd) + vSRnd * 40.0 + vSUv.y * 3.0);
  // 판을 비스듬히(모서리 쪽으로) 보거나 위에서 내려다볼수록 옅게: 판 모양이 드러나지 않게
  vec3 vd = normalize(vOwWorld - cameraPosition);
  vec3 pn = normalize(cross(dFdx(vOwWorld), dFdy(vOwWorld)));
  float face = smoothstep(0.15, 0.6, abs(dot(pn, vd)));
  float down = 1.0 - smoothstep(0.55, 0.9, -vd.y);
  gl_FragColor.a *= along * along * edge * edge * flick * uShaftGain * face * down;
}`,
  };
  patchMaterial(mat, [patch]);
  const m = new THREE.Mesh(g, mat);
  m.name = 'light-shafts';
  m.renderOrder = 6;
  return { mesh: m, uniforms: patch.uniforms };
}
