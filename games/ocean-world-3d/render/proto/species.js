// 생물 8종 모양: eco/atoll/species/ 생성기(A 매끈한 젤리풍, PLAN 0절 2026-11-12 "섞기")를 게임의 종 목록 모양으로 감싼다(P3).
// 생성기 약속은 docs/p3-art-report.md 2절(build(THREE, opts) → { geometry, material, deform, shade }).
// 몸 규칙: 앞 = +Z, 위 = +Y, 원점 = 바닥에 닿는 점(기는·걷는·붙은 생물, 문어) 또는 몸 중심(헤엄치는 생물·해파리는 갓 가장자리 평면). 크기 1로 정규화.
// 몸 길이·크기 등급·속도·생활형은 여기 두지 않는다 — eco/atoll/data.js 한 곳(P2). 화면 크기는 배치하는 쪽이 인스턴스 배율로 곱한다.
import * as THREE from 'three';
import { DEF_COMMON, SQUASH } from '../core/deform.js';
import * as seacucumber from '../../eco/atoll/species/seacucumber.js';
import * as hermitcrab from '../../eco/atoll/species/hermitcrab.js';
import * as anemone from '../../eco/atoll/species/anemone.js';
import * as clownfish from '../../eco/atoll/species/clownfish.js';
import * as octopus from '../../eco/atoll/species/octopus.js';
import * as moonjelly from '../../eco/atoll/species/moonjelly.js';
import * as greenturtle from '../../eco/atoll/species/greenturtle.js';
import * as manta from '../../eco/atoll/species/manta.js';

/** '1.35,1.1,0.95,0.85' 또는 '1' → { S, M, L, XL } 덮어쓰기(주소 옵션 ?sizes=). 없으면 null(데이터 값 그대로).
 *  크기 배율의 원본은 eco/atoll/data.js SIZES[등급].draw 한 곳이다(P2, 2026-11-12). */
export function parseSizeScale(str) {
  if (!str) return null;
  const v = str.split(',').map(Number).filter((n) => n > 0);
  if (!v.length) return null;
  if (v.length === 1) return { S: v[0], M: v[0], L: v[0], XL: v[0] };
  const [S = 1, M = 1, L = 1, XL = 1] = v;
  return { S, M, L, XL };
}

/** 게임에 쓰는 화풍·세밀도(생성기 opts). 화풍은 모두 A 젤리풍.
 *  주소 옵션 ?spdetail=0.4~1 로 세밀도(곡면 분할 배율)를 바꿔 볼 수 있다(성능 비교용, docs/p3-content-report.md 5절) */
const qDetail = typeof location !== 'undefined' ? parseFloat(new URLSearchParams(location.search).get('spdetail')) : NaN;
const BUILD_OPTS = { variant: 'jelly', detail: Number.isFinite(qDetail) ? Math.max(0.4, Math.min(1, qDetail)) : 0.75 };   // 0.75: 1 대비 삼각형 약 30% 적고 가까이서도 매끈함(5절)

/** 종 하나: 생성기 결과(kit)는 처음 쓸 때 한 번 만든다 */
function entry(gen, count, extra = {}) {
  let kit = null;
  return {
    id: gen.id, count, gen, ...extra,
    get kit() { return kit || (kit = gen.build(THREE, BUILD_OPTS)); },
    /** 몸 지오메트리(부를 때마다 새 사본: 인스턴스 속성을 메시마다 따로 붙이므로) */
    build() { return this.kit.geometry.clone(); },
    /** 변형·음영 조각(생성기 deform + shade) */
    get patches() { return [...this.kit.deform, ...this.kit.shade]; },
    /** 재질 옵션(생성기 material.params). transparent면 render/proto/creatures.js가 renderOrder 3으로 그린다 */
    get mat() { return this.kit.material.params; },
  };
}

/**
 * 종 모양 목록(화면 전용). id는 eco/atoll/data.js SPECIES의 id와 같다.
 * count는 견본 장면(타이틀·녹화 모드)의 기본 개체 수(합 44).
 * walk: 걷는 박자 값(aParams.y = 걷는 중 0..1)을 움직일 때 쓰는 종 — 소라게 다리, 해삼 연동 운동이 걸을 때 커진다.
 */
export const SPECIES = [
  entry(seacucumber, 5, { walk: true }),
  entry(hermitcrab, 6, { walk: true }),
  entry(anemone, 5),
  entry(clownfish, 10),
  entry(octopus, 4),
  entry(moonjelly, 7),
  entry(greenturtle, 4),
  entry(manta, 3),
];

/** 종별 재질 생성(patchMaterial은 부르는 쪽에서). 조각 순서: DEF_COMMON → SQUASH → 생성기 deform → 생성기 shade
 *  (render/aqua/school.js kitMaterial과 같은 규칙. 림 발광은 생성기 shade가 종마다 가짐) */
export function speciesMaterial(sp) {
  const k = sp.kit;
  const M = THREE[k.material.type] || THREE.MeshPhysicalMaterial;
  const m = new M(Object.assign({ vertexColors: true }, k.material.params));
  m.name = 'sp-' + sp.id;
  return { material: m, patches: [DEF_COMMON, SQUASH, ...k.deform, ...k.shade] };
}

/** ?n= 개체 수에 맞춰 종별 수를 비율대로 나눈다(최소 1). */
export function scaleCounts(total) {
  const base = SPECIES.reduce((s, sp) => s + sp.count, 0);
  if (total === base) return SPECIES.map((sp) => sp.count);
  const raw = SPECIES.map((sp) => (sp.count * total) / base);
  const out = raw.map((r) => Math.max(total > 0 ? 1 : 0, Math.floor(r)));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  while (out.reduce((a, b) => a + b, 0) > total) { const i = out.indexOf(Math.max(...out)); out[i]--; }
  return out;
}
