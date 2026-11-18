# W1 작업 지시: 젤리 반응 (Ocean World 3D P4)

보낸 곳: Game Space 메인(Claude) · 2026-11-14 · 받는 칸: g-ocean

## 작업 위치 (반드시 지킴)
- 작업 폴더: `/Users/dannygu/Danny-Game-Center/.claude/worktrees/ocean-world-3d-w1-jelly`
- 브랜치: `claude/ocean-world-3d-w1-jelly` (이미 만들어져 checkout 돼 있음)
- 모든 명령은 이 폴더 안에서 실행해요. 기본 checkout(`/Users/dannygu/Danny-Game-Center`)이나 다른 worktree는 읽지도 고치지도 않아요.

## 먼저 읽을 것
1. `games/ocean-world-3d/PLAN.md` 4.1.4절, 4.2.1절
2. `games/ocean-world-3d/DESIGN.md` 4.2절(반응 표), 4.3절(경계 표)
3. `games/ocean-world-3d/render/core/events.js` (구독할 사건 12종과 인자)
4. `games/ocean-world-3d/ui/react.js` (지금 반응, 출발점), `render/core/jelly.js`, `render/core/deform.js`
5. `games/ocean-world-3d/render/main.js`의 "P4 연출 모듈" 부분(fx에 무엇이 들어오는지만 확인)

## 할 일
DESIGN 4.2의 반응 7가지를 구현하고 4.3의 경계를 지켜요.
- 블록 빈 곳 누름(`tapBlock`): 누른 자리부터 출렁 + 동심원 물결(0.6~1초 감쇠)
- 생물 들임(`adopt`): 위에서 "퐁" 떨어져 수면을 뚫는 물결(0.5초)
- 해저·육지 물건 놓음(`place`, zone `bed`·`land`): 놓은 자리가 눌렸다 올라옴(0.4초)
- 수중 물건 놓음(`place`, zone `water`): 두어 번 까딱(0.6초)
- 젤리 생물 누름(`tapCreature`, 해파리·문어·해삼·말미잘): 그 몸만 말랑하게 눌림(0.3~0.5초). **블록은 출렁이지 않음**
- 티어 상승(`tier`): 블록 전체가 한 번 크게 출렁(1초)
- 확장(`expandStart`·`expand`)은 `main.js`가 이미 연출하므로 겹치지 않게 해요
- 경계: 놓기 모드(`game.isPlacing()`, `placeMode` 사건)와 카메라를 돌리는 동안에는 블록 출렁임 없음 · 진폭 상한 고정(블록 크기의 3% 이하) · 0.2초 안 연타는 새로 시작하지 않음 · 판정 좌표는 출렁이지 않은 원래 자리
- 설정: "출렁임: 보통 / 약하게 / 끄기"(`ui/settings.js` 새로 만듦, 화면 오른쪽 위 작은 단추 하나로 열리는 창. 고른 값은 localStorage에 저장, try/catch로 감쌈). `attachReact`가 돌려주는 객체에 `setLevel(level)`, `level()`을 넣어요.

## 고쳐도 되는 파일 (이 밖은 고치지 않음)
`games/ocean-world-3d/ui/react.js`, `ui/settings.js`(새), `render/core/jelly.js`, `render/core/deform.js`, `docs/p4-jelly-report.md`(새), 이 지시 파일

특히 `render/main.js`, `index.html`, `sim/`, `audio/`, `eco/`, `vendor/`는 고치지 않아요. `main.js`에 꼭 고칠 곳이 있으면 고치지 말고 보고서에 "메인에 요청"으로 적어요.

## 하지 않는 것
push, PR, 병합, 다른 브랜치 checkout, 패키지 설치, 파일 삭제(`rm`), 유료 API 호출, 외부 발송.

## 확인 방법
- `cd games/ocean-world-3d && npm test` 전건 통과(지금 78개)
- 브라우저: `cd games/ocean-world-3d && python3 -m http.server 8797` 후 `http://localhost:8797/index.html?title=0&prologue=0`. 콘솔 오류 0. 끝나면 서버를 꺼요.
- 성능: `?perf=1`에서 드로우콜이 늘지 않는지(지금 19회)

## 끝나면
1. 작업 폴더에서 `claude/ocean-world-3d-w1-jelly`에 커밋해요(메시지 한국어, 무엇을 했는지).
2. `docs/p4-jelly-report.md`에 보고서를 써서 함께 커밋해요: 바꾼 것 / 반응 7가지별 구현 방법 / 확인함(직접 실행해 본 것과 수치) / 추정(실행하지 않은 것) / 메인에 요청 / 남은 문제.
3. 마지막 응답에 커밋 해시, `npm test` 결과(통과 수), 보고서 경로를 적고 멈춰요.
