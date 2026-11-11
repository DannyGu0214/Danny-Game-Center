// 높이 함수 하나로 지형 메시와 블록 옆면 지층 단면을 만든다. 생태계와 무관(높이·색·지층은 인자로 받음).
import * as THREE from 'three';
import { patchMaterial } from './materials/shaderPatches.js';

/**
 * @param {object} o
 * @param {(x:number,y:number)=>number} o.heightAt 격자 좌표 → 높이(칸)
 * @param {(x:number,y:number,h:number,out:number[])=>void} o.colorAt 꼭짓점 색(선형 RGB 0..1)
 * @param {object} o.coords render/core/coords.js
 * @param {number} o.step 꼭짓점 간격(칸)
 * @param {number} o.bottom 블록 밑면 높이(칸)
 * @param {{top:number,color:number}[]} o.strata 지층(아래→위)
 * @param {number} o.strataBottom 밑면 색
 * @param {string[]} o.slots 지형 재질이 받을 장면 슬롯(예: ['medium'])
 */
export function buildTerrain(o) {
  const { bounds: b } = o.coords;
  const step = o.step || 0.25;
  const nx = Math.round((b.x1 - b.x0) / step), ny = Math.round((b.y1 - b.y0) / step);
  const vx = nx + 1, vy = ny + 1;
  const pos = new Float32Array(vx * vy * 3), col = new Float32Array(vx * vy * 3);
  const v = { x: 0, y: 0, z: 0 }, c = [0, 0, 0];
  for (let j = 0; j < vy; j++) for (let i = 0; i < vx; i++) {
    const x = b.x0 + i * step, y = b.y0 + j * step;
    const h = o.heightAt(x, y);
    o.coords.toWorld(x, y, h, v);
    const k = (j * vx + i) * 3;
    pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
    o.colorAt(x, y, h, c);
    col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2];
  }
  const idx = new Uint32Array(nx * ny * 6);
  let t = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * vx + i, bb = a + 1, cc = a + vx, d = cc + 1;
    // 격자 y가 커지면 Three Z가 작아지므로 감김 방향을 맞춘다(윗면이 +Y를 보게)
    idx[t++] = a; idx[t++] = bb; idx[t++] = cc;
    idx[t++] = bb; idx[t++] = d; idx[t++] = cc;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  mat.name = 'terrain';
  patchMaterial(mat, [], { slots: o.slots || [], defines: { OW_CAUSTICS: true } });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const sides = buildStrata(o, step);
  return { mesh, sides };
}

const STRATA_PATCH = (n) => ({
  name: 'strata' + n,
  vertexPars: /* glsl */`attribute float aTop; varying float vTopDist;`,
  vertexDeform: /* glsl */`vTopDist = aTop - position.y;`,
  fragmentPars: /* glsl */`
uniform float uStrataTops[${n}];
uniform vec3 uStrataColors[${n}];
varying float vTopDist;`,
  fragmentColor: /* glsl */`
{
  vec3 q = vOwBlock;
  float zz = q.y + 0.22 * sin(q.x * 0.55 + q.z * 0.41) + 0.12 * sin(q.x * 1.9 - q.z * 1.7 + 1.3);
  vec3 sc = uStrataColors[0];
  for (int i = 0; i < ${n - 1}; i++) sc = mix(sc, uStrataColors[i + 1], step(uStrataTops[i], zz));
  float g = fract(sin(dot(floor(q * 5.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  sc *= 0.9 + 0.16 * g;
  // 층 경계에 옅은 그늘 줄
  float edge = 0.0;
  for (int i = 0; i < ${n - 1}; i++) edge = max(edge, 1.0 - smoothstep(0.0, 0.09, abs(zz - uStrataTops[i])));
  sc *= 1.0 - 0.18 * edge;
  // 맨 위 얇은 띠는 지표 색(꼭짓점 색)으로: 지표가 단면 위로 살짝 덮인 느낌
  diffuseColor.rgb = mix(diffuseColor.rgb, sc, smoothstep(0.12, 0.32, vTopDist));
}`,
});

function buildStrata(o, step) {
  const { bounds: b } = o.coords;
  const P = [], N = [], C = [], A = [], I = [];
  const v = { x: 0, y: 0, z: 0 }, c = [0, 0, 0];
  const bottom = o.bottom;
  // 네 옆면: 가장자리를 따라 (x, y) 점열과 바깥 법선(격자 기준)
  const sides = [
    { from: [b.x0, b.y0], to: [b.x1, b.y0], n: [0, -1] }, // 앞(y = y0)
    { from: [b.x1, b.y0], to: [b.x1, b.y1], n: [1, 0] },  // 오른쪽
    { from: [b.x1, b.y1], to: [b.x0, b.y1], n: [0, 1] },  // 뒤
    { from: [b.x0, b.y1], to: [b.x0, b.y0], n: [-1, 0] }, // 왼쪽
  ];
  for (const s of sides) {
    const len = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);
    const n = Math.round(len / step);
    const base = P.length / 3;
    // 격자 법선 (nx, ny) → Three (nx, 0, -ny)
    const nw = [s.n[0], 0, -s.n[1]];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const x = s.from[0] + (s.to[0] - s.from[0]) * f, y = s.from[1] + (s.to[1] - s.from[1]) * f;
      const h = o.heightAt(x, y);
      o.colorAt(x, y, h, c);
      o.coords.toWorld(x, y, h, v); P.push(v.x, v.y, v.z); N.push(...nw); C.push(...c); A.push(h);
      o.coords.toWorld(x, y, bottom, v); P.push(v.x, v.y, v.z); N.push(...nw); C.push(...c); A.push(h);
    }
    for (let i = 0; i < n; i++) {
      const a = base + i * 2, bb = a + 1, cc = a + 2, d = a + 3;
      I.push(a, bb, cc, cc, bb, d);
    }
  }
  // 밑면
  {
    const base = P.length / 3;
    const bc = new THREE.Color(o.strataBottom);
    for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]) {
      o.coords.toWorld(x, y, bottom, v); P.push(v.x, v.y, v.z); N.push(0, -1, 0); C.push(bc.r, bc.g, bc.b); A.push(bottom - 100);
    }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(A, 1));
  g.setIndex(I);
  g.computeBoundingSphere();
  // 감김 방향은 면마다 다를 수 있어 양면으로 그린다(옆면 4장 + 밑면 = 드로우 1회)
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  mat.name = 'strata';
  const n = o.strata.length;
  const patch = STRATA_PATCH(n);
  patch.uniforms = {
    uStrataTops: { value: o.strata.map((s) => s.top) },
    uStrataColors: { value: o.strata.map((s) => new THREE.Color(s.color)) },
  };
  patchMaterial(mat, [patch], { slots: [] });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'strata';
  mesh.receiveShadow = true;
  return mesh;
}
