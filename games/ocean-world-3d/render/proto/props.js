// 물건 모양: eco/atoll/props/ 생성기 18종(자연물 8 · 인공물 8 · 확장 영역 테마 2)을 모아 BatchedMesh 하나에 넣을 목록으로 만든다(P3).
// 화풍은 면 음영(로우폴리, PLAN 0절 2026-11-12 "섞기"). 배치는 규칙 상태가 정하고, 물건 하나를 이루는 조각 배치(recipe)는
// 각 생성기가 가지며 render/proto/propview.js가 읽는다. 발자국 칸 수(w×h)는 eco/atoll/data.js ITEMS에서 읽어 생성기에 넘긴다.
// aAux(vec2): x = 흔들림 정도(0 = 고정, 1 = 끝), y = 자체발광 세기.
import * as THREE from 'three';
import { ITEMS } from '../../eco/atoll/data.js';
import * as lagoonsand from '../../eco/atoll/props/lagoonsand.js';
import * as feedbasket from '../../eco/atoll/props/feedbasket.js';
import * as palm from '../../eco/atoll/props/palm.js';
import * as shellbox from '../../eco/atoll/props/shellbox.js';
import * as branchcoral from '../../eco/atoll/props/branchcoral.js';
import * as buoy from '../../eco/atoll/props/buoy.js';
import * as seagrass from '../../eco/atoll/props/seagrass.js';
import * as nursery from '../../eco/atoll/props/nursery.js';
import * as boulder from '../../eco/atoll/props/boulder.js';
import * as reefblock from '../../eco/atoll/props/reefblock.js';
import * as giantclam from '../../eco/atoll/props/giantclam.js';
import * as planktonlamp from '../../eco/atoll/props/planktonlamp.js';
import * as beachscrub from '../../eco/atoll/props/beachscrub.js';
import * as hut from '../../eco/atoll/props/hut.js';
import * as cleaning from '../../eco/atoll/props/cleaning.js';
import * as dome from '../../eco/atoll/props/dome.js';
import * as mangrove from '../../eco/atoll/props/mangrove.js';
import * as boardwalk from '../../eco/atoll/props/boardwalk.js';

/** 생성기 목록(data.js ITEMS 순서) */
export const PROP_GENERATORS = [lagoonsand, feedbasket, palm, shellbox, branchcoral, buoy, seagrass, nursery, boulder, reefblock,
  giantclam, planktonlamp, beachscrub, hut, cleaning, dome, mangrove, boardwalk];

let cache = null;
function buildAll() {
  if (cache) return cache;
  const names = [], geometries = [], recipes = {}, info = {};
  for (const gen of PROP_GENERATORS) {
    const it = ITEMS[gen.id] || {};
    const out = gen.build(THREE, { w: it.w ?? 2, h: it.h ?? 2 });
    for (const [k, g] of Object.entries(out.geometries)) { names.push(`${gen.id}.${k}`); geometries.push(g); }
    const ns = (n) => `${gen.id}.${n}`;
    recipes[gen.id] = out.recipe.map((s) => ({ ...s, g: Array.isArray(s.g) ? s.g.map(ns) : ns(s.g) }));
    info[gen.id] = out.info;
  }
  cache = { names, geometries, index: Object.fromEntries(names.map((n, i) => [n, i])), recipes, info };
  return cache;
}

/** 물건 지오메트리 목록(BatchedMesh에 넣는 순서). names[i] = '<물건 id>.<조각 이름>'. recipes·info는 P3에서 더함 */
export function propGeometries() {
  const c = buildAll();
  return { names: c.names, geometries: c.geometries, index: c.index, recipes: c.recipes, info: c.info };
}

/** 규칙 물건 id → 조각 배치 표(render/proto/propview.js가 읽음) */
export function propRecipes() { return buildAll().recipes; }
