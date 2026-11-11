// 생태계와 무관한 공용 꼭짓점 변형 조각(GLSL). 주입은 materials/shaderPatches.js가 한다.
// 몸 지오메트리는 꼭짓점 속성 aDef(vec4)를 갖는다: x = 몸 길이 방향 s(0..1), y = 가림 마스크, z = 부위 번호, w = 부위 안 번호/방향.
// 인스턴스 속성: aPhase(위상), aSpeed(주기 배율), aParams(개체차, 종마다 뜻이 다름).
import * as THREE from 'three';

/** 변형 조각이 함께 쓰는 uniform. uCurrent는 확장(예: aqua 해류)이 값을 채운다. */
export const deformUniforms = {
  uCurrent: { value: new THREE.Vector3() },
  uDeformGain: { value: 1 },
  uSquash: { value: 0 },      // 블록 전체 젤리 눌림(모든 생물이 함께 출렁)
};

/** 공용 선언. 변형 조각은 이것과 함께 붙인다. */
export const DEF_COMMON = {
  name: 'defCommon',
  uniforms: deformUniforms,
  vertexPars: /* glsl */`
attribute vec4 aDef;
#ifdef USE_INSTANCING
attribute float aPhase;
attribute float aSpeed;
attribute vec4 aParams;
#else
const float aPhase = 0.0;
const float aSpeed = 1.0;
const vec4 aParams = vec4(0.0);
#endif
uniform vec3 uCurrent;      // 해류(블록 좌표 기준 방향, 젤리 가속도 포함)
uniform float uDeformGain;  // 변형 세기 배율(0 = 끔)
uniform float uSquash;
varying float vOwPart;
vec2 owRot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }`,
  vertexDeform: /* glsl */`vOwPart = aDef.z;`,
  fragmentPars: /* glsl */`varying float vOwPart;`,
};

/** 굽힘: 뿌리(aDef.x=0)는 고정, 끝(1)일수록 크게 흔들린다. 말미잘 촉수·해초·야자잎. */
export const BEND = {
  name: 'bend',
  vertexDeform: /* glsl */`
{
  float h = aDef.x * aDef.y;
  float ph = uTime * 1.6 * aSpeed + aPhase + aDef.w * 0.7;
  vec3 sway = vec3(sin(ph), 0.0, cos(ph * 0.83 + 1.1)) * (0.12 + aParams.x) + uCurrent * 0.6;
  vec3 b = sway * h * h * uDeformGain;
  transformed += b;
  transformed.y -= dot(b, b) * 0.5;
}`,
};

/** 연동(꿈틀) 운동: 몸 길이 방향으로 굵기 파동이 지나간다. 해삼처럼 바닥을 기는 몸. */
export const PERISTALSIS = {
  name: 'peristalsis',
  vertexDeform: /* glsl */`
{
  float s = aDef.x;
  float ph = uTime * 2.2 * aSpeed + aPhase;
  float w = sin(ph - s * 7.0);
  float g = uDeformGain;
  transformed.xy *= 1.0 + 0.2 * w * g;
  transformed.z += 0.035 * cos(ph - s * 7.0) * g;
  transformed.x += 0.06 * sin(ph * 0.4 + s * 3.0) * g;
}`,
};

/** 걷기: 다리(부위 1)를 번갈아 들고 몸을 살짝 흔든다. 섬 위를 다니는 생물. */
export const GAIT = {
  name: 'gait',
  vertexDeform: /* glsl */`
{
  float ph = uTime * 9.0 * aSpeed + aPhase;
  float g = uDeformGain * clamp(aParams.y, 0.0, 1.0); // aParams.y = 걷는 중(0..1)
  if (aDef.z > 0.5 && aDef.z < 1.5) {
    float side = aDef.w;                     // 다리 번호(짝·홀 번갈아)
    float lift = max(0.0, sin(ph + side * 3.14159));
    transformed.y += lift * 0.09 * aDef.x * g;
    transformed.z += cos(ph + side * 3.14159) * 0.05 * aDef.x * g;
  } else {
    transformed.y += abs(sin(ph)) * 0.025 * g;
    transformed.x += sin(ph) * 0.012 * g;
  }
}`,
};

/** 젤리 반응(눌림 스쿼시): aParams.w = 출렁 세기. 부피를 1차 근사로 보존. */
export const SQUASH = {
  name: 'squash',
  vertexDeform: /* glsl */`
{
  float j = (aParams.w + uSquash) * uDeformGain;
  transformed.y *= 1.0 + j;
  transformed.xz *= 1.0 - j * 0.5;
}`,
};

/** 프레넬 림 발광: 불투명 생물의 "젤리 사탕" 느낌. */
export const RIM = {
  name: 'rim',
  fragmentEmissive: /* glsl */`
{
  vec3 vv = normalize(vViewPosition);
  float f = pow(1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * f * 0.55 + diffuseColor.rgb * 0.08;
}`,
};
