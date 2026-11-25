// 렌더러, 카메라, 조작, 화면 크기, 컨텍스트 손실 처리.
// 톤 매핑과 환경광 설정은 games/ocean-world-3d/render/core/stage.js를 참고했어요.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const MAX_PIXEL_RATIO = 2;

export interface Stage {
  scene: THREE.Scene;
  start(update: (dt: number) => void): void;
}

export function createStage(
  canvas: HTMLCanvasElement,
  onContextChange: (lost: boolean) => void,
): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101820);

  // 환경광 텍스처는 GPU에서 구운 것이라, 컨텍스트를 되찾으면 다시 구워야 해요.
  // 이전 텍스처의 GPU 자원은 컨텍스트와 함께 사라지므로 dispose하지 않고 새 것으로 바꿔요.
  // (새 컨텍스트에서 옛 자원을 지우려 하면 WebGL 경고가 나요.)
  function bakeEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.4;
    room.dispose();
    pmrem.dispose();
  }
  bakeEnvironment();

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(3, 2.2, 4);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 2.5;
  controls.maxDistance = 12;

  function resize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const timer = new THREE.Timer();
  timer.connect(document);
  let frame: ((time: number) => void) | null = null;

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); // 막지 않으면 브라우저가 컨텍스트를 되돌려 주지 않아요
    renderer.setAnimationLoop(null);
    onContextChange(true);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    bakeEnvironment();
    resize();
    timer.reset();
    renderer.setAnimationLoop(frame);
    onContextChange(false);
  });

  return {
    scene,
    start(update) {
      frame = (time) => {
        timer.update(time);
        update(timer.getDelta());
        controls.update();
        renderer.render(scene, camera);
        canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
      };
      renderer.setAnimationLoop(frame);
    },
  };
}
