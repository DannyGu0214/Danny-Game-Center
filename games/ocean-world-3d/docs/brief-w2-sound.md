# W2 작업 지시: 소리 (Ocean World 3D P4)

보낸 곳: Game Space 메인(Claude) · 2026-11-14 · 받는 칸: g-sailing

## 작업 위치 (반드시 지킴)
- 작업 폴더: `/Users/dannygu/Danny-Game-Center/.claude/worktrees/ocean-world-3d-w2-sound`
- 브랜치: `claude/ocean-world-3d-w2-sound` (이미 만들어져 checkout 돼 있음)
- 모든 명령은 이 폴더 안에서 실행해요. 기본 checkout(`/Users/dannygu/Danny-Game-Center`)이나 다른 worktree는 고치지 않아요.

## 먼저 읽을 것
1. `games/ocean-world-3d/PLAN.md` 4.1.4절, 4.2.1절
2. `games/ocean-world-3d/render/core/events.js` (구독할 사건 12종과 인자)
3. `games/ocean-world-3d/audio/sound.js` (빈 틀, 돌려줄 모양)
4. `games/ocean-world-3d/eco/atoll/data.js`의 생물 8종 id(해삼·소라게·말미잘·흰동가리·문어·보름달물해파리·바다거북·쥐가오리)
5. 참고(읽기만): `games/quiz-quiz-2026/sound.js` — 같은 저장소의 Web Audio 합성 배경음악 방식(멜로디+코드 → 베이스·화음 자동). 이 파일은 고치지 않아요.

## 할 일
- **배경음악 1곡**: Web Audio 합성, 외부 파일 없음. 분위기는 잔잔하고 밝은 열대 바다(느린 템포 약 80~96, 장조, 부드러운 소리: 사인·삼각파 위주, 마림바·벨 느낌). 효과음을 덮지 않게 작게, 반복해도 거슬리지 않게 16마디 이상.
- **생물 소리 8종**: 생물을 들일 때(`adopt`)와 누를 때(`tapCreature`) 그 종의 짧은 소리(0.2~0.6초). 종마다 구별되게(예: 해파리 = 부드러운 '뽀용', 거북 = 낮은 '뿌웅'). 실제 울음소리 흉내가 아니라 귀여운 효과음이에요.
- **게임 효과음**: `place`(물건 놓음), `capture`(포착 성공), `tier`(티어 상승 짧은 팡파르), `chance`(포착 기회 알림, 아주 작게). 같은 소리가 0.1초 안에 겹치면 하나만.
- **켜기·끄기·음량**: `attachSound(fx)`가 `{ muted(), setMuted(bool), volume(), setVolume(0..1) }`를 돌려줘요. 값은 localStorage에 저장(try/catch로 감쌈). 화면 단추는 만들지 않아요(메인이 설정 창에 연결해요).
- 브라우저는 사용자 동작 전에는 소리를 막아요. AudioContext는 첫 `pointerdown`/`keydown` 뒤에 열어요. 탭이 숨으면(`visibilitychange`) 배경음악을 멈췄다가 돌아오면 다시 틀어요.

## 고쳐도 되는 파일 (이 밖은 고치지 않음)
`games/ocean-world-3d/audio/` 안의 파일(새 파일 추가 가능), `docs/p4-sound-report.md`(새), 이 지시 파일

`render/`, `ui/`, `index.html`, `sim/`, `eco/`, `vendor/`, 다른 게임 폴더는 고치지 않아요. 꼭 필요한 바깥 변경은 보고서에 "메인에 요청"으로 적어요.

## 하지 않는 것
push, PR, 병합, 다른 브랜치 checkout, 패키지 설치, 파일 삭제(`rm`), 유료 API 호출, 외부 발송, 음원 파일 다운로드.

## 확인 방법
- `cd games/ocean-world-3d && npm test` 전건 통과(지금 78개)
- 브라우저: `cd games/ocean-world-3d && python3 -m http.server 8798` 후 `http://localhost:8798/index.html?title=0&prologue=0`. 화면을 한 번 누른 뒤 `__ow.sound`로 켜기·끄기·음량을 바꿔 보고, 새로고침 뒤에도 유지되는지 확인. 콘솔 오류 0. 끝나면 서버를 꺼요.
- 실제로 들어 보는 것은 대니님이 해요. 보고서에 "들어 본 것"과 "들어 보지 못한 것"을 나눠 적어요.

## 끝나면
1. 작업 폴더에서 `claude/ocean-world-3d-w2-sound`에 커밋해요(메시지 한국어).
2. `docs/p4-sound-report.md`에 보고서를 써서 함께 커밋해요: 바꾼 것 / 곡 구성(조성·템포·코드 진행·악기) / 종별 소리 설계 / 확인함 / 추정 / 메인에 요청 / 남은 문제.
3. 마지막 응답에 커밋 해시, `npm test` 결과(통과 수), 보고서 경로를 적고 멈춰요.
