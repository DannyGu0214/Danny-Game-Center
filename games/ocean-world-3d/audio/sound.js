// 소리(P4 W2): 생물 소리와 배경음악 1곡. Web Audio 합성, 외부 파일 없음.
// W2가 audio/ 폴더만 고친다. 게임 사건은 fx.game.on(사건, fn)으로 받는다(이름·인자는 render/core/events.js).
// 브라우저는 사용자 동작 전에는 소리를 막으니, AudioContext는 첫 누르기 뒤에 연다.
//
// 돌려줄 것(메인이 설정 창에 연결): { muted(), setMuted(bool), volume(), setVolume(0..1) }
export function attachSound(fx) {
  return { muted: () => true, setMuted() {}, volume: () => 0, setVolume() {} };
}
