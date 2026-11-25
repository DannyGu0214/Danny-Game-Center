import { createView } from './render/scene.ts';
import { createStage } from './render/stage.ts';
import { createState, step } from './sim/rules.ts';

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`화면 요소가 없어요: ${selector}`);
  return found;
}

const canvas = element<HTMLCanvasElement>('#stage');
const notice = element<HTMLDivElement>('#notice');

function showNotice(message: string): void {
  notice.textContent = message;
  notice.hidden = message === '';
}

try {
  const stage = createStage(canvas, (lost) => {
    showNotice(lost ? '그래픽 연결이 끊겼어요. 되살아나기를 기다리는 중이에요.' : '');
  });
  const view = createView(stage.scene);
  let state = createState();
  stage.start((dt) => {
    state = step(state, dt);
    view.sync(state);
  });
} catch (error) {
  showNotice('이 브라우저에서는 3D 화면(WebGL2)을 열 수 없어요.');
  console.error(error);
}
