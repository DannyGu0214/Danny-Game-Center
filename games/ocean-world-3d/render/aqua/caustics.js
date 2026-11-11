// 커스틱(물밑에 일렁이는 빛 그물) GLSL. 움직이는 보로노이 셀의 경계(F2 − F1이 작은 곳)를 밝게 그린다.
// 직접 새로 쓴 함수다(참고 사례의 커스틱 함수와 다른 방식).
export const CAUSTICS_GLSL = /* glsl */`
vec2 owHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float owCell(vec2 p, float t) {
  vec2 ip = floor(p), fp = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = owHash2(ip + g);
    o = 0.5 + 0.4 * sin(t + 6.2831853 * o);
    float d = length(g + o - fp);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return 1.0 - smoothstep(0.0, 0.22, f2 - f1);
}
float owCaustic(vec2 p, float t) {
  float a = owCell(p, t * 0.9);
  float b = owCell(p * 1.37 + vec2(3.1, 7.7), -t * 0.7 + 2.0);
  float c = a * 0.62 + b * 0.5;
  return c * c * 1.6;
}`;
