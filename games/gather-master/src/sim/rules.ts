// 화면과 분리한 규칙. three를 import하지 않아요(node --test로 바로 검사).

export interface State {
  /** 상자의 회전각(라디안), 0 이상 2π 미만 */
  angle: number;
}

/** 초당 회전량(라디안) */
export const SPIN_SPEED = Math.PI / 4;
/** 한 번에 반영하는 최대 시간(초). 탭이 멈췄다 돌아와도 크게 튀지 않아요 */
export const MAX_STEP = 0.1;

const TURN = Math.PI * 2;

export function createState(): State {
  return { angle: 0 };
}

export function step(state: State, dt: number): State {
  const clamped = Math.min(Math.max(dt, 0), MAX_STEP);
  return { angle: (state.angle + SPIN_SPEED * clamped) % TURN };
}
