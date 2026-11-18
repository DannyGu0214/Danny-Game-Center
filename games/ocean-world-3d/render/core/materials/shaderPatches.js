// 셰이더 조각 주입은 이 모듈 한 곳에서만 한다(PLAN.md 3절).
// 나중에 WebGPU(TSL)로 옮길 때 "기본 재질 + 조각 주입"을 바꿀 곳을 여기 하나로 모으려는 것이다.
//
// 구조
// - 조각(patch): { name, uniforms, defines, vertexPars, vertexNormal, vertexDeform,
//                 fragmentPars, fragmentColor, fragmentNormal, fragmentEmissive,
//                 fragmentMedium, fragmentOutput }
//   각 항목은 GLSL 문자열이고, 아래 HOOKS의 three 청크 뒤에 끼워 넣는다.
// - 재질마다 붙이는 조각(patchMaterial의 patches)과, 장면 전체에 걸리는 "슬롯 조각"이 있다.
//   슬롯 조각은 core가 모르는 확장(예: render/aqua의 물속 안개)이 registerSlotPatch로 끼워 넣는다.
//   그래서 core는 aqua를 import하지 않는다.
// - 모든 주입 재질은 vOwWorld(진짜 월드 좌표)와 vOwBlock(젤리 변형을 되돌린 블록 좌표)을 갖는다.

import * as THREE from 'three';

/** 모든 주입 재질이 함께 쓰는 uniform(같은 객체를 공유하므로 한 번 바꾸면 전부 바뀐다). */
export const globals = {
  uTime: { value: 0 },
  uBlockInv: { value: new THREE.Matrix4() },  // 월드 → 블록 좌표(젤리 행렬의 역행렬)
  uCamBlock: { value: new THREE.Vector3() },  // 블록 좌표의 카메라 위치
};

// 슬롯 이름 → 조각 목록. 재질이 opts.slots에 그 이름을 적으면 컴파일 때 그 조각들이 붙는다.
const slotPatches = new Map();
let slotVersion = 0;

/** 장면 전체 슬롯에 조각을 등록한다(예: 'medium' 슬롯에 물속 안개). 재질 생성 전에 부르는 것이 원칙. */
export function registerSlotPatch(slot, patch) {
  if (!slotPatches.has(slot)) slotPatches.set(slot, []);
  slotPatches.get(slot).push(patch);
  slotVersion++;
}
export function slotNames() { return [...slotPatches.keys()]; }

// three 0.187.0 청크 기준 주입 위치. 없는 청크(예: Points의 법선)는 건너뛴다.
const HOOKS = {
  vertexPars: ['vertex', '#include <common>'],
  vertexNormal: ['vertex', '#include <beginnormal_vertex>'],
  vertexDeform: ['vertex', '#include <begin_vertex>'],
  vertexWorld: ['vertex', '#include <project_vertex>'],
  fragmentPars: ['fragment', '#include <common>'],
  fragmentColor: ['fragment', '#include <color_fragment>'],
  fragmentNormal: ['fragment', '#include <normal_fragment_maps>'],
  fragmentEmissive: ['fragment', '#include <emissivemap_fragment>'],
  fragmentMedium: ['fragment', '#include <opaque_fragment>'],
  fragmentOutput: ['fragment', '#include <opaque_fragment>'],
};
const ORDER = ['vertexPars', 'vertexNormal', 'vertexDeform', 'vertexWorld',
  'fragmentPars', 'fragmentColor', 'fragmentNormal', 'fragmentEmissive', 'fragmentMedium', 'fragmentOutput'];

const BASE = {
  name: 'base',
  vertexPars: /* glsl */`
varying vec3 vOwWorld;
varying vec3 vOwBlock;
uniform mat4 uBlockInv;
uniform float uTime;`,
  vertexWorld: /* glsl */`
{
  vec4 owW = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    owW = batchingMatrix * owW;
  #endif
  #ifdef USE_INSTANCING
    owW = instanceMatrix * owW;
  #endif
  owW = modelMatrix * owW;
  vOwWorld = owW.xyz;
  vOwBlock = ( uBlockInv * owW ).xyz;
}`,
  fragmentPars: /* glsl */`
varying vec3 vOwWorld;
varying vec3 vOwBlock;
uniform float uTime;
uniform vec3 uCamBlock;`,
};

const stats = { compiled: 0, injected: {}, missingHooks: [] };
export function patchStats() { return JSON.parse(JSON.stringify(stats)); }

function inject(shader, patches, label) {
  const parts = { vertex: shader.vertexShader, fragment: shader.fragmentShader };
  // 같은 청크 뒤에 붙는 슬롯은 ORDER 순서대로 쌓인다(fragmentMedium 다음 fragmentOutput).
  const byHook = new Map();
  for (const key of ORDER) {
    const code = patches.map((p) => p[key]).filter(Boolean).join('\n');
    if (!code) continue;
    const [stage, chunk] = HOOKS[key];
    const id = stage + '|' + chunk;
    if (!byHook.has(id)) byHook.set(id, { stage, chunk, code: [] });
    byHook.get(id).code.push(`// [ow:${key}]\n${code}`);
  }
  for (const { stage, chunk, code } of byHook.values()) {
    if (!parts[stage].includes(chunk)) {
      stats.missingHooks.push(`${label}:${chunk}`);
      continue;
    }
    parts[stage] = parts[stage].replace(chunk, `${chunk}\n${code.join('\n')}\n`);
    stats.injected[chunk] = (stats.injected[chunk] || 0) + 1;
  }
  shader.vertexShader = parts.vertex;
  shader.fragmentShader = parts.fragment;
}

/**
 * 재질에 조각을 붙인다.
 * @param {THREE.Material} material
 * @param {object[]} patches 재질 고유 조각
 * @param {{slots?: string[], defines?: object}} opts slots: 이 재질이 받을 장면 슬롯(예: ['medium'])
 */
export function patchMaterial(material, patches = [], opts = {}) {
  const slots = opts.slots || [];
  material.userData.owPatches = patches;
  material.userData.owSlots = slots;
  material.onBeforeCompile = (shader) => {
    const all = [BASE, ...patches];
    for (const s of slots) all.push(...(slotPatches.get(s) || []));
    for (const p of all) {
      if (p.uniforms) for (const [k, v] of Object.entries(p.uniforms)) shader.uniforms[k] = v;
    }
    for (const [k, v] of Object.entries(globals)) shader.uniforms[k] = v;
    const defs = Object.assign({}, opts.defines || {});
    for (const p of all) Object.assign(defs, p.defines || {});
    const defStr = Object.entries(defs).map(([k, v]) => `#define ${k} ${v === true ? '' : v}`).join('\n');
    if (defStr) {
      shader.vertexShader = defStr + '\n' + shader.vertexShader;
      shader.fragmentShader = defStr + '\n' + shader.fragmentShader;
    }
    inject(shader, all, material.type + ':' + (material.name || ''));
    stats.compiled++;
    material.userData.owShader = shader;
  };
  const key = 'ow:' + patches.map((p) => p.name).join(',') + '|' + slots.join(',') + '|' +
    JSON.stringify(opts.defines || {}) + '|v' + slotVersion;
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return material;
}
