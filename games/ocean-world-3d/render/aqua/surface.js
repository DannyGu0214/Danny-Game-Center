// 물 덩어리의 겉: 수면(높이장으로 출렁임) + 블록 옆면의 물 벽. 한 지오메트리를 두 번 그린다.
//  - 'box' 방식(기본, 투과 없음): ① 뒷면(BackSide) = 상자를 지나온 거리만큼의 물색(반투명)
//                                ② 앞면(FrontSide) = 광택층(프레넬 불투명도 + 환경맵 반사 + 잔물결 + 수면선)
//  - 'transmission' 방식(비교용, 참고 사례 방식): 앞면 하나를 투과(transmission) 재질로.
import * as THREE from 'three';
import { patchMaterial } from '../core/materials/shaderPatches.js';

const FRONT_PATCH = (water) => ({
  name: 'waterFront',
  uniforms: {
    uSurfOp: { value: new THREE.Vector2(...water.surfaceOpacity) },
    uWaveAmp: { value: water.waveAmp },
    uFoamGain: { value: water.foam },
    uWaterline: { value: new THREE.Color(water.waterline) },
  },
  vertexPars: /* glsl */`attribute float aTopDist; attribute float aFoam; varying float vTopDist; varying float vFoam;`,
  vertexDeform: /* glsl */`vTopDist = aTopDist; vFoam = aFoam;`,
  fragmentPars: /* glsl */`
uniform vec2 uSurfOp; uniform float uWaveAmp, uFoamGain; uniform vec3 uWaterline;
varying float vTopDist; varying float vFoam;
// 잔물결: 방향·파장이 다른 사인 4개의 해석적 기울기
vec2 owRippleGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec4 kx = vec4(1.7, -1.1, 0.6, 2.9), kz = vec4(0.5, 1.6, -2.3, -0.9), w = vec4(1.3, 1.7, 1.1, 2.3), a = vec4(1.0, 0.8, 0.6, 0.35);
  for (int i = 0; i < 4; i++) {
    float ph = p.x * kx[i] + p.y * kz[i] + t * w[i];
    g += a[i] * cos(ph) * vec2(kx[i], kz[i]);
  }
  return g;
}`,
  fragmentNormal: /* glsl */`
if (vTopDist < -0.5) {
  vec2 g = owRippleGrad(vOwBlock.xz, uTime) * uWaveAmp;
  normal = normalize(normal + (viewMatrix * vec4(-g.x, 0.0, -g.y, 0.0)).xyz);
}`,
  fragmentOutput: /* glsl */`
{
  vec3 vv = normalize(vViewPosition);
  float ndv = clamp(abs(dot(normal, vv)), 0.0, 1.0);
  float fr = pow(1.0 - ndv, 4.0);
#ifndef OW_TRANSMISSION
  float spec = dot(totalSpecular, vec3(0.3333));
  float a = mix(uSurfOp.x, uSurfOp.y, fr) + clamp(spec * 0.5, 0.0, 0.35);
#else
  float a = gl_FragColor.a;
#endif
  // 해안 거품(위 수면, 물가)
  if (vTopDist < -0.5 && vFoam > 0.01) {
    float n = sin(vOwBlock.x * 3.1 + uTime * 1.3) * sin(vOwBlock.z * 2.7 - uTime * 1.1);
    float f = smoothstep(0.15, 0.9, vFoam + 0.35 * n) * uFoamGain;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), f * 0.85);
    a = max(a, f * 0.8);
  }
  // 수면선: 물 벽 맨 위 흰 띠 + 그 아래 옅은 어두운 띠
  if (vTopDist >= 0.0) {
    float wl = 1.0 - smoothstep(0.035, 0.11, vTopDist);
    float men = smoothstep(0.08, 0.14, vTopDist) * (1.0 - smoothstep(0.14, 0.42, vTopDist));
    gl_FragColor.rgb = mix(gl_FragColor.rgb * (1.0 - 0.35 * men), uWaterline, wl * 0.9);
    a = max(a, max(wl * 0.92, men * 0.22));
  }
  gl_FragColor.a = clamp(a, 0.0, 1.0);
}`,
});

export class WaterBody {
  /**
   * @param {object} o
   * @param {import('./heightfield.js').Heightfield} o.hf
   * @param {object} o.coords render/core/coords.js
   * @param {(x,y)=>number} o.heightAt
   * @param {object} o.water eco WaterProfile
   * @param {'box'|'transmission'} o.mode
   */
  constructor(o) {
    this.hf = o.hf; this.coords = o.coords; this.mode = o.mode;
    const hf = this.hf, b = this.coords.bounds;
    const nx = hf.nx, ny = hf.ny;
    this.nTop = nx * ny;
    // 옆면 물 벽: 앞(y0) → 오른쪽(x1) → 뒤(y1) → 왼쪽(x0) 가장자리 격자점 순서
    const edge = [];
    for (let i = 0; i < nx; i++) edge.push([i, 0, 0, -1]);
    for (let j = 0; j < ny; j++) edge.push([nx - 1, j, 1, 0]);
    for (let i = nx - 1; i >= 0; i--) edge.push([i, ny - 1, 0, 1]);
    for (let j = ny - 1; j >= 0; j--) edge.push([0, j, -1, 0]);
    this.edge = edge;
    const nv = this.nTop + edge.length * 2;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
    const top = new Float32Array(nv), foam = new Float32Array(nv);
    const idx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, bb = a + 1, c = a + nx, d = c + 1;
      idx.push(a, bb, c, bb, d, c);
    }
    for (let k = 0; k < this.nTop; k++) { top[k] = -1; foam[k] = hf.shore[k]; }
    this.bottomZ = new Float32Array(edge.length);
    const inset = 0.015;
    for (let e = 0; e < edge.length; e++) {
      const [i, j, nX, nY] = edge[e];
      const x = b.x0 + i * hf.dx - nX * inset, y = b.y0 + j * hf.dx - nY * inset;
      this.bottomZ[e] = Math.min(0, o.heightAt(x, y));
      const t = this.nTop + e * 2;
      for (const q of [t, t + 1]) { nor[q * 3] = nX; nor[q * 3 + 1] = 0; nor[q * 3 + 2] = -nY; }
      if (e > 0 && (edge[e - 1][2] === nX && edge[e - 1][3] === nY)) {
        const p = t - 2;
        // 바깥에서 볼 때 반시계가 되도록
        idx.push(p, p + 1, t, t, p + 1, t + 1);
      }
    }
    this._edgeXY = edge.map(([i, j, nX, nY]) => [b.x0 + i * hf.dx - nX * inset, b.y0 + j * hf.dx - nY * inset]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTopDist', new THREE.BufferAttribute(top, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aFoam', new THREE.BufferAttribute(foam, 1));
    g.setIndex(idx);
    this.geometry = g;
    this.update();
    g.computeBoundingSphere();

    const w = o.water;
    this.meshes = [];
    if (this.mode === 'transmission') {
      const t = w.transmission;
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, transmission: 1, thickness: t.thickness, ior: t.ior,
        attenuationColor: new THREE.Color(t.attenuationColor), attenuationDistance: t.attenuationDistance,
        roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
        emissive: new THREE.Color(0x0b3a5a), emissiveIntensity: 0.25, envMapIntensity: 1.3,
        side: THREE.DoubleSide,
      });
      mat.name = 'waterTransmission';
      patchMaterial(mat, [FRONT_PATCH(w)], { defines: { OW_TRANSMISSION: true } });
      const m = new THREE.Mesh(g, mat); m.name = 'water-transmission'; m.renderOrder = 5;
      this.meshes.push(m);
    } else {
      const back = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, depthWrite: false });
      back.name = 'waterBack';
      patchMaterial(back, [], { slots: ['medium'], defines: { OW_WATER_BACK: true } });
      const mb = new THREE.Mesh(g, back); mb.name = 'water-back'; mb.renderOrder = 2;
      const front = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(w.surfaceColor), roughness: 0.05, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4,
        transparent: true, depthWrite: false, side: THREE.FrontSide,
      });
      front.name = 'waterFront';
      patchMaterial(front, [FRONT_PATCH(w)]);
      const mf = new THREE.Mesh(g, front); mf.name = 'water-front'; mf.renderOrder = 10;
      this.meshes.push(mb, mf);
    }
    for (const m of this.meshes) { m.frustumCulled = false; }
  }

  /** 높이장 → 꼭짓점 */
  update() {
    const hf = this.hf, b = this.coords.bounds, g = this.geometry;
    const P = g.attributes.position.array, T = g.attributes.aTopDist.array;
    const v = { x: 0, y: 0, z: 0 };
    for (let j = 0; j < hf.ny; j++) for (let i = 0; i < hf.nx; i++) {
      const k = j * hf.nx + i;
      let z = hf.h[k];
      if (hf.wall[k]) z = hf.ground[k] - 0.08;         // 육지 밑으로 숨김
      this.coords.toWorld(b.x0 + i * hf.dx, b.y0 + j * hf.dx, z, v);
      P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z;
    }
    for (let e = 0; e < this.edge.length; e++) {
      const [x, y] = this._edgeXY[e];
      const zt = Math.max(this.bottomZ[e], hf.sample(x, y));
      const zb = this.bottomZ[e];
      const t = this.nTop + e * 2;
      this.coords.toWorld(x, y, zt, v); P[t * 3] = v.x; P[t * 3 + 1] = v.y; P[t * 3 + 2] = v.z;
      this.coords.toWorld(x, y, zb, v); P[t * 3 + 3] = v.x; P[t * 3 + 4] = v.y; P[t * 3 + 5] = v.z;
      T[t] = 0; T[t + 1] = zt - zb;
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.aTopDist.needsUpdate = true;
    this._topNormals();
  }

  /** 윗면 법선만 높이장 차분으로(옆면 법선은 고정) */
  _topNormals() {
    const hf = this.hf, N = this.geometry.attributes.normal.array, H = hf.h;
    const nx = hf.nx, ny = hf.ny, inv = 1 / (2 * hf.dx);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const l = H[i > 0 ? k - 1 : k], r = H[i < nx - 1 ? k + 1 : k];
      const d = H[j > 0 ? k - nx : k], u = H[j < ny - 1 ? k + nx : k];
      const gx = (r - l) * inv, gy = (u - d) * inv;
      // 격자 기울기 (gx, gy) → Three 법선 (−gx, 1, +gy)
      const len = Math.hypot(gx, 1, gy);
      N[k * 3] = -gx / len; N[k * 3 + 1] = 1 / len; N[k * 3 + 2] = gy / len;
    }
    this.geometry.attributes.normal.needsUpdate = true;
  }
}
