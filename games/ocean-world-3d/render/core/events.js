// 게임 사건 알림(P4 연결점). 화면 쪽 연출 모듈(젤리 반응·소리)이 게임 동작을 구독한다.
// 규칙(sim/)과 무관한 화면 전용 알림이고, 생태계 이름을 담지 않는다.
//
// 사건 이름과 인자(render/main.js가 보냄, PLAN 4.1.4절):
//   adopt        { uid, sp, x, y, z }          생물 들임(격자 좌표, z는 높이)
//   release      { uid, sp }                   생물 돌려보냄
//   place        { uid, id, zone, layer, x, y } 물건 놓음(x, y는 물건 가운데 격자 좌표, zone: 'land'|'bed'|'water', layer는 수중 물건만)
//   remove       { uid }                       물건 치움
//   placeMode    { on, id }                    놓기 모드 시작·끝
//   tapCreature  { uid, sp }                   생물을 누름(포착 포함)
//   tapBlock     { x, y, z }                   블록 빈 곳을 누름(격자 좌표)
//   chance       { uid, sp }                   포착 기회 시작
//   capture      { uid, sp, first }            포착 성공
//   tier         { n }                         티어 상승
//   expandStart  {}                            확장 영역이 넓어지기 시작
//   expand       {}                            확장 영역 다 넓어짐
export function createEvents() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type).delete(fn);
    },
    emit(type, data = {}) {
      const set = map.get(type);
      if (!set) return;
      for (const fn of set) {
        try { fn(data); } catch (err) { console.error(`[events] ${type}`, err); }
      }
    },
  };
}
