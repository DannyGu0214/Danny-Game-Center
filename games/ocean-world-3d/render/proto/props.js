// 시제품용 물건: 육지·해저·수중 세 구역에 단순한 모양 몇 개씩. 전부 BatchedMesh 하나로 그린다.
// P3에서 eco/atoll/props/ 생성기로 옮긴다. 배치 위치는 화면 확인용 가안이다.
// aAux(vec2): x = 흔들림 정도(0 = 고정, 1 = 끝), y = 자체발광 세기.
import * as THREE from 'three';
import { part, merge, tube, hex, mix, rng } from './geo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = (g, c, aux = [0, 0]) => part(g, c, aux, 'aAux');

function palm(seed) {
  const r = rng(seed), parts = [];
  const pts = [];
  const lean = 0.5 + r() * 0.5, H = 4.2 + r() * 1.2;
  for (let k = 0; k <= 6; k++) { const s = k / 6; pts.push(V(lean * s * s, s * H, 0)); }
  for (let k = 0; k < 6; k++) {
    const t = tube(pts[k], pts[k + 1], 0.17 - k * 0.012, 0.16 - (k + 1) * 0.012, 7);
    parts.push(P(t, k % 2 ? 0x9a7650 : 0x86643f, [0, 0]));
  }
  const top = pts[6];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + r() * 0.3;
    const len = 1.9 + r() * 0.5;
    const segs = 5;
    for (let k = 0; k < segs; k++) {
      const s0 = k / segs, s1 = (k + 1) / segs;
      const p0 = top.clone().add(V(Math.cos(a) * len * s0, 0.35 * Math.sin(s0 * 2.4) - 0.9 * s0 * s0, Math.sin(a) * len * s0));
      const p1 = top.clone().add(V(Math.cos(a) * len * s1, 0.35 * Math.sin(s1 * 2.4) - 0.9 * s1 * s1, Math.sin(a) * len * s1));
      const leaf = new THREE.BoxGeometry(0.07, 0.04, 1);
      const w = 0.55 * Math.sin(Math.PI * (s0 + s1) / 2) + 0.12;
      leaf.scale(w / 0.07, 1, p0.distanceTo(p1));
      leaf.translate(0, 0, 0.5 * p0.distanceTo(p1));
      leaf.lookAt(new THREE.Vector3().subVectors(p1, p0));
      leaf.translate(p0.x, p0.y, p0.z);
      parts.push(P(leaf, mix(0x3f8f3a, 0x7cc35a, s0), [s1, 0]));
    }
  }
  for (let i = 0; i < 3; i++) { const c = new THREE.SphereGeometry(0.16, 7, 5); c.translate(top.x + Math.cos(i * 2.1) * 0.2, top.y - 0.18, Math.sin(i * 2.1) * 0.2); parts.push(P(c, 0x6b4a2a)); }
  return merge(parts);
}

function hut() {
  const parts = [];
  const wall = new THREE.BoxGeometry(2.2, 1.3, 1.8); wall.translate(0, 0.65, 0);
  parts.push(P(wall, 0xd9b98a));
  const door = new THREE.BoxGeometry(0.5, 0.8, 0.05); door.translate(0, 0.4, 0.92); parts.push(P(door, 0x7a5232));
  const roof = new THREE.ConeGeometry(1.9, 1.2, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1.05, 1, 0.9); roof.translate(0, 1.85, 0);
  parts.push(P(roof, 0xc79a4f));
  return merge(parts);
}

function bush(seed) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.IcosahedronGeometry(0.45 + r() * 0.25, 0);
    g.translate((r() - 0.5) * 0.8, 0.35 + r() * 0.2, (r() - 0.5) * 0.8);
    parts.push(P(g, mix(0x4f8f3c, 0x7fb055, r()), [0.15, 0]));
  }
  return merge(parts);
}

function shellBox() {
  const g = new THREE.BoxGeometry(0.8, 0.5, 0.6); g.translate(0, 0.25, 0);
  const lid = new THREE.BoxGeometry(0.85, 0.08, 0.65); lid.translate(0, 0.54, 0);
  const s = new THREE.ConeGeometry(0.12, 0.22, 8); s.rotateZ(1.2); s.translate(0.1, 0.66, 0);
  return merge([P(g, 0xb98c5a), P(lid, 0xa0703f), P(s, 0xf3c9b0)]);
}

function branchCoral(seed, color) {
  const r = rng(seed), parts = [];
  const grow = (a, dir, len, rad, depth) => {
    const b = a.clone().addScaledVector(dir, len);
    parts.push(P(tube(a, b, rad, rad * 0.75, 6), mix(color, 0xffffff, depth * 0.12), [Math.min(1, depth * 0.25), 0]));
    if (depth >= 3) { const t = new THREE.SphereGeometry(rad * 0.9, 6, 4); t.translate(b.x, b.y, b.z); parts.push(P(t, mix(color, 0xffffff, 0.45), [1, 0.15])); return; }
    const n = 2 + (r() > 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(V((r() - 0.5) * 1.1, 0.25, (r() - 0.5) * 1.1)).normalize();
      grow(b, d, len * (0.7 + r() * 0.15), rad * 0.72, depth + 1);
    }
  };
  grow(V(0, 0, 0), V(0, 1, 0), 0.55, 0.12, 0);
  return merge(parts);
}

function clam() {
  const parts = [];
  for (const s of [1, -1]) {
    const g = new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 0.45 * s, 0.7);
    g.rotateZ(s > 0 ? -0.25 : 0);
    g.translate(0, 0.25, 0);
    parts.push(P(g, (p) => mix(0x8e8a7a, 0xcfc9b6, 0.5 + 0.5 * Math.sin(Math.atan2(p.z, p.x) * 9))));
  }
  const mantle = new THREE.SphereGeometry(0.42, 12, 6); mantle.scale(1, 0.12, 0.6); mantle.translate(0, 0.27, 0);
  parts.push(P(mantle, (p) => mix(0x2a6fd6, 0x45e0c8, 0.5 + 0.5 * Math.sin(p.x * 30)), [0, 0.35]));
  return merge(parts);
}

function boulder(seed) {
  const r = rng(seed);
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + 0.12 * Math.sin(v.x * 5 + seed) * Math.sin(v.z * 4) + (r() - 0.5) * 0.05;
    v.multiplyScalar(k); v.y = v.y * 0.65 + 0.45;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return merge([P(g, (q) => mix(0xc89a52, 0xe7c27a, 0.5 + 0.5 * Math.sin(q.x * 18 + q.z * 14)))]);
}

function dome() {
  const parts = [];
  const base = new THREE.CylinderGeometry(2.3, 2.5, 0.5, 20); base.translate(0, 0.25, 0); parts.push(P(base, 0x9aa3a8));
  const glass = new THREE.SphereGeometry(2.0, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2); glass.translate(0, 0.5, 0);
  parts.push(P(glass, (p) => (Math.abs(Math.sin(Math.atan2(p.z, p.x) * 6)) < 0.08 || Math.abs(p.y - 1.6) < 0.05 ? hex(0xd8dde0) : hex(0x5c90a8)), [0, 0.12]));
  const lamp = new THREE.SphereGeometry(0.25, 8, 6); lamp.translate(0, 2.55, 0); parts.push(P(lamp, 0xfff0a0, [0, 1.4]));
  return merge(parts);
}

function reefBlocks() {
  const parts = [];
  const r = rng(4);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.BoxGeometry(0.9, 0.6, 0.9);
    b.rotateY(r() * 1.5);
    b.translate((i % 3 - 1) * 0.8, 0.3 + Math.floor(i / 3) * 0.6, (Math.floor(i / 3) - 0.4) * 0.5);
    parts.push(P(b, mix(0x8f8b84, 0xb3ada0, r())));
  }
  return merge(parts);
}

function seagrass(seed) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < 14; i++) {
    const a = V((r() - 0.5) * 1.6, 0, (r() - 0.5) * 1.6);
    const b = a.clone().add(V((r() - 0.5) * 0.3, 0.7 + r() * 0.5, (r() - 0.5) * 0.3));
    const g = new THREE.BoxGeometry(0.08, 1, 0.02); g.translate(0, 0.5, 0); g.scale(1, a.distanceTo(b), 1);
    g.rotateY(r() * 3); g.translate(a.x, a.y, a.z);
    parts.push(part(g, (p) => mix(0x3f8a3a, 0x8fcf6a, p.y), (p) => [Math.min(1, p.y / 1.1), 0], 'aAux'));
  }
  return merge(parts);
}

// --- 수중 물건 ---
function buoy() {
  const s = new THREE.SphereGeometry(0.45, 14, 10);
  const ring = new THREE.TorusGeometry(0.45, 0.06, 6, 18); ring.rotateX(Math.PI / 2);
  const mast = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6); mast.translate(0, 0.6, 0);
  const lamp = new THREE.SphereGeometry(0.1, 8, 6); lamp.translate(0, 1.05, 0);
  return merge([P(s, (p) => (p.y > 0.12 ? hex(0xff5a3c) : hex(0xffffff))), P(ring, 0xffffff), P(mast, 0x333333), P(lamp, 0xffe070, [0, 1.6])]);
}
function rope(len) {
  const g = new THREE.CylinderGeometry(0.03, 0.03, 1, 4); g.translate(0, 0.5, 0);
  return merge([P(g, 0xe8dcc0)]);
}
function anchor() {
  const g = new THREE.BoxGeometry(0.6, 0.3, 0.6); g.translate(0, 0.15, 0);
  return merge([P(g, 0x6e6a64)]);
}
function nursery() {
  const parts = [];
  const bar = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6); bar.rotateZ(Math.PI / 2); parts.push(P(bar, 0xdedad0));
  for (let i = 0; i < 5; i++) {
    const x = -1.2 + i * 0.6;
    const line = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 3); line.translate(x, -0.25, 0); parts.push(P(line, 0xdedad0));
    const frag = new THREE.IcosahedronGeometry(0.13, 0); frag.scale(1, 1.4, 1); frag.translate(x, -0.55, 0);
    parts.push(P(frag, i % 2 ? 0xf08aa0 : 0xf2b05a, [0.3, 0.1]));
  }
  const fl = new THREE.SphereGeometry(0.18, 8, 6); fl.translate(0, 0.2, 0); parts.push(P(fl, 0xffc640));
  return merge(parts);
}
function planktonLamp() {
  const g = new THREE.SphereGeometry(0.32, 12, 8);
  const cap = new THREE.CylinderGeometry(0.12, 0.16, 0.14, 8); cap.translate(0, 0.36, 0);
  return merge([P(g, 0xbff7ff, [0, 1.3]), P(cap, 0x555555)]);
}
function bungalow() {
  const parts = [];
  const deck = new THREE.BoxGeometry(4.0, 0.25, 3.2); deck.translate(0, 0, 0); parts.push(P(deck, 0xa57a4c));
  const house = new THREE.BoxGeometry(2.6, 1.4, 2.0); house.translate(0, 0.82, -0.3); parts.push(P(house, 0xe8d8b8));
  const roof = new THREE.ConeGeometry(2.2, 1.2, 4); roof.rotateY(Math.PI / 4); roof.scale(1.1, 1, 0.9); roof.translate(0, 2.1, -0.3); parts.push(P(roof, 0xb88a48));
  return merge(parts);
}
function pillar() {
  // 높이 1짜리 기둥(배치 때 세로로 늘림). 수면을 가로지른다.
  const g = new THREE.CylinderGeometry(0.16, 0.16, 1, 8); g.translate(0, 0.5, 0);
  return merge([P(g, (p) => mix(0x7a5a3a, 0x9b7a52, p.y))]);
}

/** 물건 지오메트리 목록(BatchedMesh에 넣는 순서) */
export function propGeometries() {
  const list = {
    palmA: palm(1), palmB: palm(2), palmC: palm(3), hut: hut(), bushA: bush(5), bushB: bush(6), shellBox: shellBox(),
    coralPink: branchCoral(7, 0xe46f9a), coralPurple: branchCoral(8, 0x9a6fe0), coralOrange: branchCoral(9, 0xf09a4a),
    clam: clam(), boulderA: boulder(1), boulderB: boulder(2), dome: dome(), reef: reefBlocks(), grassA: seagrass(3), grassB: seagrass(4),
    buoy: buoy(), rope: rope(), anchor: anchor(), nursery: nursery(), plankton: planktonLamp(), bungalow: bungalow(), pillar: pillar(),
  };
  const names = Object.keys(list);
  return { names, geometries: names.map((n) => list[n]), index: Object.fromEntries(names.map((n, i) => [n, i])) };
}
