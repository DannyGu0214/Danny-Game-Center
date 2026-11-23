// 수중 관측 돔(인공물, 해저 4×4, 키 높음) — 면 음영. 관람객이 들어가 바다를 보는 시설: 둥근 콘크리트 받침,
// 금속 갈비뼈로 나뉜 유리 돔(물빛이 비치는 반투명 느낌의 청록 면), 꼭대기 표지등, 옆으로 나온 출입 관과 둥근 창.
import { lp, merge, tube, sumTris } from './_kit.js';

export const id = 'dome';

function dome(THREE, w) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), C = (c) => new THREE.Color(c);
  const parts = [];
  const R = w * 0.4, BASE = 0.5;
  const base = new THREE.CylinderGeometry(R * 1.08, R * 1.18, BASE, 16, 1); base.translate(0, BASE / 2 - 0.05, 0);
  parts.push(lp(THREE, base, (c, n, f) => (n.y > 0.5 ? C(0xb8bcc0) : f % 2 ? C(0x8e969c) : C(0x9aa2a8))));
  // 받침의 둥근 창
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const win = new THREE.CircleGeometry(0.12, 8); win.lookAt(V(Math.cos(a), 0, Math.sin(a))); win.translate(Math.cos(a) * R * 1.14, BASE / 2, Math.sin(a) * R * 1.14);
    parts.push(lp(THREE, win, C(0xfff0a0), [0, 0.9]));
  }
  // 유리 돔
  const glass = new THREE.SphereGeometry(R, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2); glass.translate(0, BASE - 0.05, 0);
  parts.push(lp(THREE, glass, (c, n, f) => {
    const t = (c.y - BASE) / R;
    return C(0x4a8aa8).lerp(C(0x9ad8e8), t * 0.6 + (f % 5 === 0 ? 0.3 : 0));
  }, [0, 0.18]));
  // 갈비뼈(세로 8 + 가로 고리 2)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, pts = [];
    for (let j = 0; j <= 6; j++) { const e = (j / 6) * Math.PI / 2; pts.push(V(Math.cos(a) * Math.cos(e) * (R + 0.03), BASE - 0.05 + Math.sin(e) * (R + 0.03), Math.sin(a) * Math.cos(e) * (R + 0.03))); }
    for (let j = 0; j < 6; j++) parts.push(lp(THREE, tube(THREE, pts[j], pts[j + 1], 0.045, 0.045, 4, 1, true), C(0xe0e4e8)));
  }
  for (const e of [0.45, 0.95]) {
    const ring = new THREE.TorusGeometry(Math.cos(e) * (R + 0.03), 0.04, 4, 16); ring.rotateX(Math.PI / 2); ring.translate(0, BASE - 0.05 + Math.sin(e) * (R + 0.03), 0);
    parts.push(lp(THREE, ring, C(0xe0e4e8)));
  }
  // 꼭대기 표지등
  const cap = new THREE.CylinderGeometry(0.22, 0.3, 0.16, 8); cap.translate(0, BASE + R + 0.02, 0); parts.push(lp(THREE, cap, C(0xd0d4d8)));
  const lamp = new THREE.IcosahedronGeometry(0.17, 0); lamp.translate(0, BASE + R + 0.22, 0); parts.push(lp(THREE, lamp, C(0xfff0a0), [0, 1.4]));
  // 출입 관(앞쪽으로 나와 바닥에 닿음) + 문
  const tun = new THREE.CylinderGeometry(0.42, 0.42, 0.9, 10, 1); tun.rotateX(Math.PI / 2); tun.translate(0, 0.45, R * 1.12 + 0.2);
  parts.push(lp(THREE, tun, (c, n, f) => (f % 2 ? C(0xa8b0b6) : C(0x98a0a6))));
  const door = new THREE.CircleGeometry(0.32, 10); door.translate(0, 0.45, R * 1.12 + 0.66); parts.push(lp(THREE, door, C(0x4a6a7a), [0, 0.1]));
  const wheel = new THREE.TorusGeometry(0.14, 0.03, 4, 8); wheel.translate(0, 0.45, R * 1.12 + 0.68); parts.push(lp(THREE, wheel, C(0xf0c040)));
  return merge(THREE, parts);
}

export function build(THREE, { w = 4 } = {}) {
  const geometries = { a: dome(THREE, w) };
  return { id, geometries, recipe: [{ g: 'a' }], info: { triangles: sumTris(geometries), note: '콘크리트 받침 + 갈비뼈 유리 돔 + 표지등 + 출입 관' } };
}
