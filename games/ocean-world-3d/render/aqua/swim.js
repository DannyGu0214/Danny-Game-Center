// 헤엄 변형 조각(GLSL): 물고기 꼬리 파동, 해파리 박동, 가오리 날갯짓, 거북 지느러미, 문어 분사.
// 뼈대 리깅 없이 꼭짓점 셰이더에서만 움직인다(PLAN D3). 수치는 직접 정한 가안이다.
// 지오메트리 규칙(render/core/deform.js 참고): 앞 = +Z, 위 = +Y, 몸 크기 1로 정규화.

/** 해파리 박동 곡선: 빠르게 오므리고 천천히 풀린다. CPU(추진)와 GPU(변형)가 같은 식을 쓴다. */
export function jellyPulse(time, speed, phase) {
  let p = (time * 0.45 * speed + phase / (Math.PI * 2)) % 1;
  if (p < 0) p += 1;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return p < 0.28 ? ss(0, 0.28, p) : 1 - ss(0.28, 1, p);
}
const PULSE_GLSL = /* glsl */`
float owPulse(float t, float sp, float ph) {
  float p = fract(t * 0.45 * sp + ph / 6.2831853);
  return p < 0.28 ? smoothstep(0.0, 0.28, p) : 1.0 - smoothstep(0.28, 1.0, p);
}`;

/** 물고기: 머리(s=0)는 거의 고정, 꼬리(s=1)로 갈수록 크게 흔들리는 몸통 파동 + 중심축 흔들림 + 부피 보존 스쿼시. */
export const FISH = {
  name: 'fish',
  vertexNormal: /* glsl */`
{
  float s = aDef.x; float ph = uTime * 7.0 * aSpeed + aPhase;
  float dxds = (0.32 * s * sin(ph - 4.5 * s) - 0.72 * s * s * cos(ph - 4.5 * s)) * uDeformGain;
  objectNormal.xz = owRot(objectNormal.xz, atan(dxds));
}`,
  vertexDeform: /* glsl */`
{
  float s = aDef.x; float g = uDeformGain;
  float ph = uTime * 7.0 * aSpeed + aPhase;
  transformed.x += (0.02 * sin(ph) + 0.16 * s * s * sin(ph - 4.5 * s)) * g;
  transformed.xz = owRot(transformed.xz, 0.07 * sin(ph + 1.2) * g);
  float j = 0.045 * sin(2.0 * ph) * g;
  transformed.z *= 1.0 + j; transformed.xy *= 1.0 - 0.5 * j;
}`,
};

/** 해파리: 갓 테두리일수록 오므라들고, 갓이 위로 늘어난다. 촉수는 파동 + 오므림을 따라감. */
export const JELLY = {
  name: 'jelly',
  vertexPars: PULSE_GLSL,
  vertexDeform: /* glsl */`
{
  float k = owPulse(uTime, aSpeed, aPhase) * uDeformGain;
  if (aDef.z < 0.5) {
    float rim = aDef.y;
    transformed.xz *= 1.0 - 0.24 * k * rim * rim;
    transformed.y *= 1.0 + 0.28 * k;
    transformed.y -= 0.05 * k * rim * rim;
  } else {
    float s = aDef.x;
    float ph = uTime * 1.4 * aSpeed + aPhase + aDef.w * 0.9;
    transformed.xz *= 1.0 - 0.22 * k * (1.0 - 0.5 * s);
    transformed.x += 0.08 * s * sin(ph - 3.2 * s) * uDeformGain;
    transformed.z += 0.08 * s * cos(ph * 0.9 - 3.2 * s) * uDeformGain;
    transformed.y += 0.10 * k * s;
    transformed -= uCurrent * s * s * 0.4;
  }
}`,
};

/** 가오리: 날개 끝(s=1)으로 갈수록 크게 위아래로, 파동이 몸 쪽에서 끝으로 전파. 꼬리는 좌우로. */
export const RAY = {
  name: 'ray',
  vertexNormal: /* glsl */`
{
  float s = aDef.x; float ph = uTime * 1.9 * aSpeed + aPhase;
  float sp = pow(max(s, 1e-3), 0.6);
  float dyds = 0.22 * (1.6 * sp * sin(ph - 1.6 * s) - 1.6 * s * sp * cos(ph - 1.6 * s)) * uDeformGain;
  objectNormal.xy = owRot(objectNormal.xy, atan(dyds * 2.0 * aDef.w));
}`,
  vertexDeform: /* glsl */`
{
  float s = aDef.x; float g = uDeformGain;
  float ph = uTime * 1.9 * aSpeed + aPhase;
  float f = 0.22 * pow(s, 1.6) * sin(ph - 1.6 * s) * g;
  transformed.y += f;
  transformed.x *= 1.0 - 0.6 * f * f;
  transformed.y += 0.012 * sin(ph + transformed.z * 6.0) * g;
  if (aDef.z > 1.5) transformed.x += 0.05 * sin(ph * 1.6 - aDef.y * 4.0) * aDef.y * g;
}`,
};

/** 바다거북: 앞지느러미는 크게 날갯짓(위아래 + 뒤로 젓기), 뒷지느러미는 작게. 등딱지는 고정. */
const TURTLE_FLIP = /* glsl */`
  bool front = aDef.z < 1.5;
  vec3 piv = front ? vec3(aDef.w * 0.26, 0.0, 0.18) : vec3(aDef.w * 0.2, -0.02, -0.3);
  float ph = uTime * 2.1 * aSpeed + aPhase + (front ? 0.0 : 1.3);
  float a = (front ? 0.55 : 0.22) * sin(ph) * uDeformGain * aDef.w;
  float sw = (front ? 0.38 : 0.18) * cos(ph) * uDeformGain * aDef.w;`;
export const TURTLE = {
  name: 'turtle',
  vertexNormal: /* glsl */`
if (aDef.z > 0.5) {${TURTLE_FLIP}
  objectNormal.xy = owRot(objectNormal.xy, a);
  objectNormal.xz = owRot(objectNormal.xz, sw);
}`,
  vertexDeform: /* glsl */`
if (aDef.z > 0.5) {${TURTLE_FLIP}
  vec3 q = transformed - piv;
  q.xy = owRot(q.xy, a);
  q.xz = owRot(q.xz, sw);
  transformed = piv + q;
} else if (aDef.y > 0.5) {
  float ph = uTime * 2.1 * aSpeed + aPhase;
  transformed.y += 0.012 * sin(ph * 2.0) * aDef.y * uDeformGain;
}`,
};

/** 문어: 팔이 우산처럼 벌어졌다 오므리며(분사) 물결친다. 외투막은 오므릴 때 부푼다. */
export const OCTOPUS = {
  name: 'octopus',
  vertexPars: PULSE_GLSL,
  vertexDeform: /* glsl */`
{
  float k = owPulse(uTime * 0.8, aSpeed, aPhase) * uDeformGain;
  if (aDef.z > 0.5) {
    float s = aDef.x;
    float ph = uTime * 2.4 * aSpeed + aPhase + aDef.w * 0.785;
    transformed.xz *= 1.0 + (0.3 - 0.55 * k) * s;
    transformed.y += (0.14 * k - 0.05) * s;
    transformed.y += 0.05 * s * sin(ph - 5.0 * s) * uDeformGain;
    vec2 tdir = normalize(vec2(-transformed.z, transformed.x) + 1e-4);
    transformed.xz += tdir * 0.05 * s * s * sin(ph * 0.7 - 4.0 * s) * uDeformGain;
  } else {
    transformed.xz *= 1.0 + 0.08 * k;
    transformed.y *= 1.0 - 0.05 * k;
  }
}`,
};
