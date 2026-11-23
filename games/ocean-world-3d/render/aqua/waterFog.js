// 물속 안개(투과 재질 없이 물 덩어리를 그리는 핵심, 조사 문서 3.2.2·3.3.5를 직접 구현).
// 'medium' 슬롯에 등록되어, 그 슬롯을 받는 모든 재질(지형·물건·생물·입자)의 최종 색에 적용된다.
//   L  = 카메라 광선이 물 상자 안을 지나온 실제 거리(광선-상자 교차)
//   Tv = exp(−σ·L)                  보는 경로의 투과율(채널별, 빨강이 가장 빨리 줄어듦)
//   Tl = exp(−σ·k·depth)            위에서 내려온 빛이 수심만큼 줄어듦
//   색 = 원래색·Tl·Tv + 산란색·(1 − Tv)
// 물 위 조각은 depth = 0, L = 0이라 그대로 남는다. 그래서 수면을 가로지르는 물체도 따로 처리하지 않아도 된다.
import * as THREE from 'three';
import { registerSlotPatch } from '../core/materials/shaderPatches.js';
import { CAUSTICS_GLSL } from './caustics.js';

export function createWaterFog(water, box) {
  const lin = (hex) => new THREE.Color(hex);
  const uniforms = {
    uFogOn: { value: 1 },
    uCausticOn: { value: 1 },
    uSigma: { value: new THREE.Vector3(...water.absorption) },
    uScatter: { value: lin(water.scatter) },
    uScatterDeep: { value: lin(water.scatterDeep) },
    uLightAbsorb: { value: water.lightAbsorb },
    uShallowTint: { value: lin(water.shallowTint) },
    uWaterMin: { value: box.min.clone() },   // 블록 좌표의 물 상자(윗면 = 수면)
    uWaterMax: { value: box.max.clone() },
    uCausticGain: { value: water.causticGain },
    uCausticScale: { value: water.causticScale },
  };
  const patch = {
    name: 'waterFog',
    uniforms,
    fragmentPars: /* glsl */`
uniform float uFogOn, uCausticOn, uLightAbsorb, uCausticGain, uCausticScale;
uniform vec3 uSigma, uScatter, uScatterDeep, uShallowTint, uWaterMin, uWaterMax;
${CAUSTICS_GLSL}
// 광선-상자 교차(slab). 반환: (진입 t, 나감 t)
vec2 owSlab(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / (rd + vec3(1e-6) * sign(rd + 1e-9));
  vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
// 물속 경로 길이와 수심
void owWaterPath(out float L, out float depth) {
  vec3 P = vOwBlock, C = uCamBlock;
  vec3 d = P - C; float dist = length(d);
  vec2 tt = owSlab(C, d / max(dist, 1e-4), uWaterMin, uWaterMax);
  L = max(0.0, min(dist, tt.y) - max(tt.x, 0.0));
  depth = max(0.0, uWaterMax.y - P.y);
}
vec3 owScatterAt(float depth) { return mix(uScatter, uScatterDeep, smoothstep(1.5, 11.0, depth)); }`,
    fragmentMedium: /* glsl */`
{
  float L, depth;
  owWaterPath(L, depth);
#ifdef OW_WATER_BACK
  // 물 상자 뒷면: 상자를 지나온 거리만큼의 물색을 반투명으로 칠한다(뒤 배경이 얇은 곳에서 비침)
  vec3 Tv = exp(-uSigma * L * uFogOn);
  float a = clamp(1.0 - dot(Tv, vec3(0.3333)), 0.0, 1.0);
  vec3 sc = owScatterAt(depth) * 0.85;
  gl_FragColor = vec4(sc * (1.0 - Tv) / max(a, 1e-3), a * uFogOn);
#else
  #ifdef OW_CAUSTICS
  if (depth > 0.0 && uCausticOn > 0.5) {
    vec3 nW = inverseTransformDirection(normal, viewMatrix);
    float up = clamp(nW.y * 0.75 + 0.25, 0.0, 1.0);
    float cs = owCaustic(vOwBlock.xz * uCausticScale, uTime * 1.1);
    float fade = smoothstep(0.0, 0.5, depth) * exp(-depth * 0.16);
    gl_FragColor.rgb += diffuseColor.rgb * cs * uCausticGain * fade * up;
  }
  #endif
  if (uFogOn > 0.5) {
    vec3 Tl = exp(-uSigma * uLightAbsorb * depth);
    vec3 Tv = exp(-uSigma * L);
    // 얕은 흰 모래 위 청록 보정: 아주 얕고 경로가 짧을 때만 살짝
    float sh = (1.0 - smoothstep(0.0, 4.0, depth)) * smoothstep(0.0, 0.6, depth) * 0.25;
    vec3 lit = gl_FragColor.rgb * Tl * mix(vec3(1.0), uShallowTint * 1.25, sh);
    gl_FragColor.rgb = lit * Tv + owScatterAt(depth) * (1.0 - Tv);
  }
#endif
}`,
  };
  registerSlotPatch('medium', patch);
  return {
    uniforms,
    setFog(on) { uniforms.uFogOn.value = on ? 1 : 0; },
    setCaustics(on) { uniforms.uCausticOn.value = on ? 1 : 0; },
  };
}
