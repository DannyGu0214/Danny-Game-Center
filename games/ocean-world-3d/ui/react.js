// 젤리 반응(P4 W1, DESIGN 4.2·4.3절). 게임 사건을 구독해 블록 출렁임·물결을 낸다.
// 지금 내용은 4차 준비 때 render/main.js에 흩어져 있던 반응을 그대로 옮긴 출발점이다(동작 같음).
// W1이 이 파일과 render/core/jelly.js, render/core/deform.js, ui/settings.js만 고친다.
//
// fx: { game, jelly, rig, input, creatures, propView, deformUniforms, opt, hf(getter: 확장 때 바뀜) }
//   game.on(사건, fn) — 사건 이름·인자는 render/core/events.js
//   game.isPlacing() — 놓기 모드인지
export function attachReact(fx) {
  const { game, jelly } = fx;
  game.on('adopt', (e) => { fx.hf.disturb(e.x, e.y, 1.6, -1.8); jelly.poke(-0.35, 0.08, 0.04); });
  game.on('place', (e) => { fx.hf.disturb(e.x, e.y, 1.4, -1.2); jelly.poke(-0.25); });
  game.on('capture', () => { jelly.poke(-0.3, 0.1, 0.05); });
  game.on('tier', () => { jelly.poke(-0.9, 0.25, 0.15); fx.hf.disturb(20, 20, 2.2, -2.4); });
  game.on('tapBlock', (e) => { fx.hf.disturb(e.x, e.y, 1.4, -2.2); });
  return {};
}
