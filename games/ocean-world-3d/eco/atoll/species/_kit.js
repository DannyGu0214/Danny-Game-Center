// 생물 생성기 공용 도구(P3 화풍 샘플). THREE는 인자로 받는다: eco/는 three를 직접 import하지 않는다.
//
// 생성기가 만드는 지오메트리의 속성(render/core/deform.js 규칙과 같음)
//   position, normal, color(꼭짓점 색, 선형), index
//   aDef vec4  x = 몸 길이 방향 s(0..1) · y = 마스크(종마다 뜻, 아래 각 종 파일) · z = 부위 번호 · w = 부위 안 번호/방향
//   aMat vec2  x = 불투명도 배율(반투명 종만 씀, 기본 1) · y = 자체 발광 더하기(눈 반짝임 등, 기본 0)
// 몸 규칙: 앞 = +Z, 위 = +Y, 크기 1로 정규화(물고기는 몸길이 1, 해파리는 갓 지름 1).

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

/** 결정적 난수(render/proto/geo.js와 같은 식) */
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 점 목록 [[x, y], ...]을 지나는 1차원 Catmull-Rom 보간 함수 */
export function curve1(pts) {
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    const n = pts.length;
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (i < n - 2 && x > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)][1], p1 = pts[i][1], p2 = pts[i + 1][1], p3 = pts[Math.min(n - 1, i + 2)][1];
    const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
}

/**
 * 격자 곡면. fn(u, v, out:Vector3) — u는 nu 구간, v는 nv 구간(둘 다 0..1).
 * us/vs에 0..1 값 배열을 주면 그 자리에 격자선을 둔다(로우폴리에서 색 띠 경계를 맞추려고).
 * wrapU = u 방향이 닫힌 고리(이음매 꼭짓점을 공유해 법선이 매끈하다).
 */
export function grid(THREE, nu, nv, fn, { wrapU = false, us = null, vs = null } = {}) {
  const U = us || Array.from({ length: nu + 1 }, (_, i) => i / nu);
  const Vv = vs || Array.from({ length: nv + 1 }, (_, j) => j / nv);
  const cols = wrapU ? U.length - 1 : U.length;
  const pos = [], idx = [];
  const p = new THREE.Vector3();
  for (let j = 0; j < Vv.length; j++) for (let i = 0; i < cols; i++) { fn(U[i], Vv[j], p); pos.push(p.x, p.y, p.z); }
  for (let j = 0; j < Vv.length - 1; j++) for (let i = 0; i < U.length - 1; i++) {
    const i1 = wrapU ? (i + 1) % cols : i + 1;
    const a = j * cols + i, b = j * cols + i1, c = (j + 1) * cols + i, d = (j + 1) * cols + i1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 두 점 사이 관(굵기 r0→r1). 축 방향 s(0..1)를 함께 돌려주려고 직접 만든다. */
export function tube(THREE, a, b, r0, r1, radial = 6, seg = 4, bend = null) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length(); dir.normalize();
  const ref = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n1 = new THREE.Vector3().crossVectors(dir, ref).normalize();
  const n2 = new THREE.Vector3().crossVectors(dir, n1).normalize();
  return grid(THREE, radial, seg, (u, v, out) => {
    const ang = u * Math.PI * 2, r = r0 + (r1 - r0) * v;
    out.copy(a).addScaledVector(dir, len * v).addScaledVector(n1, Math.cos(ang) * r).addScaledVector(n2, Math.sin(ang) * r);
    if (bend) bend(v, out);
  }, { wrapU: true });
}

function toLinear(THREE, c, out) {
  if (c && c.isColor) out.copy(c); else out.set(c);
  return out;
}

/**
 * 꼭짓점마다 색·aDef·aMat을 칠한다. 각 인자는 값 또는 (p, i, n)=>값 함수(p = 위치, n = 법선).
 * @returns 같은 지오메트리(uv 제거)
 */
export function paint(THREE, g, { color = 0xffffff, def = [0, 0, 0, 0], mat = [1, 0] } = {}) {
  g.deleteAttribute('uv'); g.deleteAttribute('uv1');
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, n = P.count;
  const col = new Float32Array(n * 3), d = new Float32Array(n * 4), m = new Float32Array(n * 2);
  const p = new THREE.Vector3(), nn = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i); nn.fromBufferAttribute(N, i);
    toLinear(THREE, typeof color === 'function' ? color(p, i, nn) : color, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    const dv = typeof def === 'function' ? def(p, i, nn) : def;
    for (let k = 0; k < 4; k++) d[i * 4 + k] = dv[k] || 0;
    const mv = typeof mat === 'function' ? mat(p, i, nn) : mat;
    m[i * 2] = mv[0] ?? 1; m[i * 2 + 1] = mv[1] || 0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aDef', new THREE.BufferAttribute(d, 4));
  g.setAttribute('aMat', new THREE.BufferAttribute(m, 2));
  return g;
}

/**
 * 로우폴리용: 면마다 꼭짓점을 따로 두고(면 법선) 색을 면 중심에서 고른다.
 * faceColor(centroid, normal, faceIndex) → 색. aDef·aMat은 꼭짓점 위치로 정해 면 사이가 벌어지지 않는다.
 */
export function facet(THREE, g, { faceColor, def = [0, 0, 0, 0], mat = [1, 0] }) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, n = P.count;
  const colors = new Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let f = 0; f < n / 3; f++) {
    a.fromBufferAttribute(P, f * 3); b.fromBufferAttribute(P, f * 3 + 1); c.fromBufferAttribute(P, f * 3 + 2);
    const ctr = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    nn.fromBufferAttribute(N, f * 3);
    const col = faceColor(ctr, nn, f);
    colors[f * 3] = colors[f * 3 + 1] = colors[f * 3 + 2] = col;
  }
  return paint(THREE, g, { color: (p, i) => colors[i], def, mat });
}

/** 같은 속성 묶음을 가진 지오메트리를 하나로(앞에 온 것이 먼저 그려진다: 반투명 종의 겹침 순서) */
export function merge(THREE, parts) {
  const names = ['position', 'normal', 'color', 'aDef', 'aMat'];
  let verts = 0, idx = 0;
  for (const g of parts) { verts += g.attributes.position.count; idx += g.index.count; }
  const out = new THREE.BufferGeometry();
  for (const nm of names) {
    const size = parts[0].attributes[nm].itemSize;
    const arr = new Float32Array(verts * size);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; }
    out.setAttribute(nm, new THREE.BufferAttribute(arr, size));
  }
  const I = verts > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  let o = 0, base = 0;
  for (const g of parts) {
    const src = g.index.array;
    for (let k = 0; k < src.length; k++) I[o + k] = src[k] + base;
    o += src.length; base += g.attributes.position.count;
  }
  out.setIndex(new THREE.BufferAttribute(I, 1));
  out.computeBoundingSphere();
  return out;
}

export const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/**
 * 프래그먼트 음영 조각: 프레넬 림 발광 + 바탕 발광(속이 비치는 젤리 사탕 느낌) + aMat.y 발광.
 * alpha를 주면 프레넬 불투명도(가장자리 진하고 가운데 비침)도 넣는다(반투명 종).
 * 값은 GLSL 상수로 굽기 때문에 name이 값마다 달라야 한다(셰이더 캐시 키가 이름이다).
 */
export function shadePatch(name, { rim = 0.5, rimPow = 3, glow = 0.08, alpha = null } = {}) {
  const f = (x) => Number(x).toFixed(4);
  const p = {
    name,
    vertexPars: /* glsl */`attribute vec2 aMat; varying vec2 vOwMat;`,
    vertexDeform: /* glsl */`vOwMat = aMat;`,
    fragmentPars: /* glsl */`varying vec2 vOwMat;`,
    fragmentEmissive: /* glsl */`
{
  vec3 vv = normalize(vViewPosition);
  float ndv = clamp(abs(dot(normal, vv)), 0.0, 1.0);
  float fr = pow(1.0 - ndv, ${f(rimPow)});
  totalEmissiveRadiance += diffuseColor.rgb * (${f(rim)} * fr + ${f(glow)} + vOwMat.y);
}`,
  };
  if (alpha) {
    p.fragmentOutput = /* glsl */`
{
  vec3 vv2 = normalize(vViewPosition);
  float fa = pow(1.0 - clamp(abs(dot(normal, vv2)), 0.0, 1.0), ${f(alpha.pow ?? 2)});
  gl_FragColor.a = clamp(opacity * vOwMat.x * (${f(alpha.base)} + ${f(alpha.edge)} * fa), 0.0, ${f(alpha.max ?? 0.95)});
}`;
  }
  return p;
}

/**
 * 물고기 헤엄 조각(꼬리 흔들기). P1 aqua/swim.js의 FISH 식에 지느러미 움직임을 더했다.
 * aDef: x = s(0 주둥이 → 1 꼬리 끝) · y = 지느러미 마스크(뿌리 0 → 가장자리 1) ·
 *       z = 부위(0 몸, 1 등·뒷·꼬리지느러미, 2 가슴지느러미, 3 배지느러미, 4 눈) · w = 좌우(-1/+1, 짝지느러미)
 * o: { freq 꼬리 박자(rad/초), amp 꼬리 진폭, wave 파동 수, yaw 머리 흔들림, pecPivot [x, y, z](+x쪽), pecAmp, pecFreq }
 */
export function fishSwimPatch(name, o = {}) {
  const f = (x) => Number(x).toFixed(4);
  const freq = o.freq ?? 7.0, amp = o.amp ?? 0.15, wave = o.wave ?? 4.5, yaw = o.yaw ?? 0.06;
  const [px, py, pz] = o.pecPivot || [0.08, -0.02, 0.22];
  const pecAmp = o.pecAmp ?? 0.6, pecFreq = o.pecFreq ?? 9.0;
  const dxds = `(${f(2 * amp)} * s * sin(ph - ${f(wave)} * s) - ${f(amp * wave)} * s * s * cos(ph - ${f(wave)} * s))`;
  return {
    name,
    vertexNormal: /* glsl */`
{
  float s = aDef.x; float ph = uTime * ${f(freq)} * aSpeed + aPhase;
  float dxds = ${dxds} * uDeformGain;
  objectNormal.xz = owRot(objectNormal.xz, atan(dxds));
}`,
    vertexDeform: /* glsl */`
{
  float s = aDef.x; float g = uDeformGain;
  float ph = uTime * ${f(freq)} * aSpeed + aPhase;
  float part = aDef.z;
  if (part > 1.5 && part < 2.5) {
    // 가슴지느러미: 뿌리(세로축)를 중심으로 앞뒤로 젓는다. 흰동가리는 제자리에서도 쉬지 않고 젓는다
    float side = aDef.w;
    float ph2 = uTime * ${f(pecFreq)} * aSpeed + aPhase * 1.7 + side * 0.8;
    vec3 piv = vec3(${f(px)} * side, ${f(py)}, ${f(pz)});
    vec3 q = transformed - piv;
    q.xz = owRot(q.xz, side * ${f(pecAmp)} * (0.35 + 0.65 * sin(ph2)) * g);
    transformed = piv + q;
  } else if (part > 2.5 && part < 3.5) {
    transformed.x += aDef.w * 0.012 * aDef.y * sin(ph * 1.3) * g;
  } else if (part > 0.5 && part < 1.5) {
    // 등·뒷·꼬리지느러미 가장자리가 물결친다
    transformed.x += 0.022 * aDef.y * sin(ph * 1.2 - s * 10.0) * g;
  }
  transformed.x += (0.018 * sin(ph) + ${f(amp)} * s * s * sin(ph - ${f(wave)} * s)) * g;
  transformed.xz = owRot(transformed.xz, ${f(yaw)} * sin(ph + 1.2) * g);
  float j = 0.04 * sin(2.0 * ph) * g;
  transformed.z *= 1.0 + j; transformed.xy *= 1.0 - 0.5 * j;
}`,
  };
}
