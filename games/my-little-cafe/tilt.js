// 폰 기울임 읽기: 다지기에서 손가락 대신 쓴다. 계산은 logic.js의 levelAngle이다.
import { levelAngle } from './logic.js';

let angle = null, listening = false;
const read = (e) => { if (e.beta != null && e.gamma != null) angle = levelAngle(e.beta, e.gamma); };

const hasEvent = () => typeof DeviceOrientationEvent !== 'undefined';
export const tiltAvailable = () => hasEvent() && navigator.maxTouchPoints > 0; // 센서 값은 터치 기기에서만 기대한다
export const tiltNeedsAsk = () => hasEvent() && typeof DeviceOrientationEvent.requestPermission === 'function'; // 아이폰

export function tiltListen() {
  if (listening) return;
  listening = true; angle = null;
  window.addEventListener('deviceorientation', read);
}
export function tiltStop() {
  if (!listening) return;
  listening = false; angle = null;
  window.removeEventListener('deviceorientation', read);
}
// 아이폰은 버튼을 누른 그 처리 안에서 바로 불러야 허용 창이 뜬다. 앞에 await를 두지 않는다
export async function tiltAsk() {
  try {
    if (tiltNeedsAsk() && await DeviceOrientationEvent.requestPermission() !== 'granted') return false;
    tiltListen();
    return true;
  } catch { return false; }
}
// 값이 한 번이라도 오는지 본다. 가만히 있으면 값이 뜸해지는 기기가 있어 그 뒤로는 끊겼다고 보지 않는다
export async function tiltWait(ms) {
  const end = performance.now() + ms;
  while (angle == null && performance.now() < end) await new Promise((r) => setTimeout(r, 40));
  return angle != null;
}
export const tiltAngle = () => angle;
