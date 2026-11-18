# W3 작업 지시: 마감 (Ocean World 3D P5)

보낸 곳: Game Space 메인(Claude) · 2026-11-18 · 받는 칸: g-ocean

## 작업 위치 (반드시 지킴)
- 작업 폴더: `/Users/dannygu/Danny-Game-Center/.claude/worktrees/ocean-world-3d-w3-finish`
- 브랜치: `claude/ocean-world-3d-w3-finish` (P4 통합본 c25c8dc에서 만듦, checkout 돼 있음)
- 모든 명령은 이 폴더 안에서. 기본 checkout이나 다른 worktree는 고치지 않아요.

## 먼저 읽을 것
1. `games/ocean-world-3d/PLAN.md` 4.1.4절(W3 줄, 완료 조건)
2. 참고(읽기만): `games/zombie-outpost/manifest.webmanifest`, `games/zombie-outpost/sw.js`, `games/zombie-outpost/icons/` — 같은 저장소의 PWA 방식
3. `games/ocean-world-3d/index.html`의 `<head>`(지금 `<link rel="icon" href="data:,">` 자리 표시가 있음)

## 할 일
- `manifest.webmanifest`: 이름 "Ocean World 3D", short_name, start_url `./`, scope `./`, display standalone, theme/background 색(게임 하늘·바다 톤), 아이콘 192·512(+maskable).
- `sw.js`: 오프라인 캐시. 게임이 실제로 불러오는 파일(`index.html`, `render/`, `sim/`, `eco/`, `ui/`, `audio/`, `vendor/` 의 three.js, 프롤로그 그림 등 `assets/`)을 캐시. 캐시 이름에 버전을 넣고, 새 버전 설치 시 옛 캐시 삭제. 테스트·docs·tools는 캐시하지 않음. 캐시 목록은 손으로 쓰되 실제 파일과 맞는지 확인(빠진 파일 0, 없는 파일 0).
- `icons/`: icon-192.png, icon-512.png, apple-touch-icon.png(180). 외부 이미지·유료 API 쓰지 말고 코드(캔버스·node 스크립트 등)로 생성. 바다 블록·해파리 같은 게임 느낌이면 좋아요. 생성 스크립트를 남기면 `tools/`에.
- `index.html`: 빈 파비콘 자리를 실제 아이콘으로 바꾸고 manifest·apple-touch-icon 링크, sw 등록(캡처 모드 `?capture`나 localhost 개발 중에도 문제없게; zombie-outpost 방식 따름).
- `README.md`(게임 폴더): 무엇인지, 조작법, 주소 파라미터(`?title=0&prologue=0` 등 실제 있는 것만), 폴더 구조, `npm test`, 오프라인·홈 화면 추가.

## 고쳐도 되는 파일
`games/ocean-world-3d/manifest.webmanifest`(새), `sw.js`(새), `icons/`(새), `README.md`(새), `tools/`(아이콘 생성 스크립트만), `index.html`의 `<head>`와 sw 등록 코드, `docs/p5-finish-report.md`(새), 이 지시 파일.
그 밖(`render/`, `sim/`, `ui/`, `audio/`, 루트 `index.html`, 다른 게임)은 고치지 않아요. 필요하면 보고서에 "메인에 요청".

## 하지 않는 것
push, PR, 병합, 다른 브랜치 checkout, 패키지 설치, 파일 삭제(`rm`), 유료 API, 외부 발송, 이미지 다운로드.

## 확인 방법
- `cd games/ocean-world-3d && npm test` 전건 통과(78)
- 브라우저: `python3 -m http.server 8797` → `http://localhost:8797/index.html?title=0&prologue=0`. 콘솔 오류 0, devtools에서 sw activated·manifest 아이콘 인식, 네트워크 오프라인으로 바꿔 새로고침해도 게임이 열림. 끝나면 서버·브라우저를 꺼요.

## 끝나면
1. `claude/ocean-world-3d-w3-finish`에 커밋(한국어 메시지).
2. `docs/p5-finish-report.md`: 바꾼 것 / 캐시 목록 근거 / 확인함(수치) / 추정 / 메인에 요청 / 남은 문제. 함께 커밋.
3. 마지막 응답에 커밋 해시, `npm test` 결과, 보고서 경로를 적고 멈춰요.
