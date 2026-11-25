// 장면에 놓는 물체와 조명. 상태를 받아 그리기만 해요.
import * as THREE from 'three';
import type { State } from '../sim/rules.ts';

export interface View {
  sync(state: State): void;
}

export function createView(scene: THREE.Scene): View {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xff8a5c, roughness: 0.45 }),
  );

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3, 48),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1;

  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 5, 2);

  scene.add(box, floor, sun, new THREE.HemisphereLight(0xbfdfff, 0x30261c, 0.6));

  return {
    sync(state) {
      box.rotation.y = state.angle;
    },
  };
}
