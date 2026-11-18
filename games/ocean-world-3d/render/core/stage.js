// 렌더러·장면·조명·환경맵. 생태계 값(EnvProfile)으로 색과 세기만 바꾼다.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createStage(canvas, env, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: opts.antialias !== false,
    preserveDrawingBuffer: !!opts.capture,   // 녹화 모드: 캔버스를 그림으로 저장하려고
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(opts.pixelRatio || window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = env.exposure ?? 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = opts.shadows !== false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(env.background);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = env.envIntensity ?? 0.5;

  const hemi = new THREE.HemisphereLight(env.hemiSky, env.hemiGround, env.hemiIntensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(env.sunColor, env.sunIntensity);
  const d = new THREE.Vector3(...env.sunDir).normalize();
  sun.position.copy(d).multiplyScalar(60);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  // 블록 전체를 담는 그룹. 젤리 행렬을 직접 쓴다(jelly.js).
  const world = new THREE.Group();
  world.name = 'world';
  world.matrixAutoUpdate = false;
  scene.add(world);

  /** 그림자 범위를 블록에 맞춘다(정사영). */
  function fitShadow(halfX, halfZ, yMin, yMax) {
    const cam = sun.shadow.camera;
    const r = Math.hypot(halfX, halfZ, (yMax - yMin) / 2) + 2;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 1; cam.far = 140;
    sun.position.copy(d).multiplyScalar(70);
    cam.updateProjectionMatrix();
  }

  return { renderer, scene, world, hemi, sun, fitShadow, envTex };
}
