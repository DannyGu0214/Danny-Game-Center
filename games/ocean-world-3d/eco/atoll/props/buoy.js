// 계류 부표(인공물, 수중·표층 2×2, 수면에 뜸) — 면 음영. 닻이 산호를 부수지 않게 쓰는 부표:
// 흰 바탕에 주황 띠가 둘린 공, 위의 작은 표지 막대와 노란 등, 아래로 바닥 닻 덩이까지 이어진 밧줄.
import { lp, merge, sumTris } from './_kit.js';
import { anchorBlock, rope } from './_mooring.js';

export const id = 'buoy';

function float(THREE, w) {
  const C = (c) => new THREE.Color(c);
  const s = w / 2, parts = [];
  const ball = new THREE.IcosahedronGeometry(0.5 * s, 1); ball.scale(1, 0.82, 1);
  parts.push(lp(THREE, ball, (c) => (Math.abs(c.y) < 0.12 * s ? C(0xff6a2a) : c.y > 0 ? C(0xfdfdfa) : C(0xe8e8e2))));
  const ring = new THREE.TorusGeometry(0.5 * s, 0.06, 4, 10); ring.rotateX(Math.PI / 2); ring.translate(0, -0.02, 0);
  parts.push(lp(THREE, ring, C(0x3a3a3a)));
  const mast = new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5); mast.translate(0, 0.38 * s + 0.35, 0);
  parts.push(lp(THREE, mast, C(0x404448)));
  const flag = new THREE.BoxGeometry(0.02, 0.18, 0.3); flag.translate(0, 0.38 * s + 0.6, 0.15);
  parts.push(lp(THREE, flag, C(0xff6a2a)));
  const lamp = new THREE.OctahedronGeometry(0.1, 0); lamp.translate(0, 0.38 * s + 0.78, 0);
  parts.push(lp(THREE, lamp, C(0xffe070), [0, 1.5]));
  return merge(THREE, parts);
}

export function build(THREE, { w = 2 } = {}) {
  const geometries = { anchor: anchorBlock(THREE), rope: rope(THREE), float: float(THREE, w) };
  const recipe = [{ g: 'anchor' }, { g: 'rope', up: 'sea' }, { g: 'float', at: 'sea', float: true }];
  return { id, geometries, recipe, info: { triangles: sumTris(geometries), note: '주황 띠 부표 + 표지 막대·등 + 밧줄·닻 덩이' } };
}
