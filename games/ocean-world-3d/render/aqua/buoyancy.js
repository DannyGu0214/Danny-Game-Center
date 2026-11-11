// 부력: 높이장 표본과 기울기로 떠 있는 물체의 높이·기울기를 정한다(격자 좌표).
const tmp = { x: 0, y: 0 };
export function floatOn(hf, x, y, out, follow = 1) {
  const z = hf.sample(x, y);
  hf.gradient(x, y, tmp);
  const tx = Math.atan(tmp.x), ty = Math.atan(tmp.y);
  out.z = z;
  out.tiltX = out.tiltX === undefined ? tx : out.tiltX + (tx - out.tiltX) * follow;
  out.tiltY = out.tiltY === undefined ? ty : out.tiltY + (ty - out.tiltY) * follow;
  return out;
}
