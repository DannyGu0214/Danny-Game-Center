# 줍줍 마스터 (Gather Master) 진행 계획

- 상태: 2판 · 2026-11-25. 설계는 [`DESIGN.md`](DESIGN.md), 화풍은 [`docs/art-style.md`](docs/art-style.md)에 있어요.
- 운영 규칙: `~/danny-agent/orch/space-rules.md`.
  - 메인 칸은 나누고 검토만 해요.
  - 하위 칸은 단계마다 worktree(`claude/gather-master-<단계>`)에서 고치고, 테스트하고, 커밋해요.
  - 병합·push는 대니님 승인 뒤에만 해요.
- 파이프라인 기준: `docs/game-dev/pipeline.md` v2.

## 0. 시작 전 확인

- threejs-* 프로젝트 스킬 9종은 `main`(1cf79a1)에 설치돼 있어요. 이 브랜치의 base(`claude/proto-3d-scaffold` 3777775)에는 없어요.
  - P0 worktree를 만들기 전에 이 브랜치를 `main`과 합친 base에서 시작해야 하위 칸이 `.claude/skills/threejs-*`를 불러요.
  - 합치기는 메인 칸이 대니님 승인을 받아 해요.
- 프로젝트 규칙(`CLAUDE.md`):
  - threejs-* 스킬로 유료 생성(Tripo·Gemini·ElevenLabs)을 하지 않아요.
  - 키 확인 스크립트(`probe_asset_credentials.sh` 등)를 실행하지 않아요.
  - 스킬이 하위 에이전트를 따로 띄우지 않게 하고, 그 칸이 직접 작업해요.
- `npm ci`는 이 폴더의 `package-lock.json` 기준으로만 해요. 새 패키지는 승인이 필요해요.

## 1. 공통 검증 (모든 단계)

| 검사 | 명령·도구 | 통과 기준 |
|---|---|---|
| 타입 검사 | `npm run typecheck` | 오류 0 |
| 규칙 테스트 | `npm test`(node --test, TS 그대로) | 전부 통과. `src/sim/`이 `three`를 import하지 않아요 |
| 경제 봇 | `node tools/sim.ts --table`(P0에서 만들어요) | 그 단계의 목표 시간·비율 안 |
| 빌드 | `npm run build` | 성공, `dist/`가 정적 서버에서 열려요 |
| 브라우저 스모크 | `npm run e2e`(Playwright, 설치된 Chrome) | 통과 |
| 화면 확인 | chrome-devtools MCP 스크린샷·콘솔(사용 통계 끔 적용됨) | 콘솔 오류 0, 스크린샷을 보고서에 첨부 |
| 범위 | `git diff --stat` | 그 단계 범위 밖 변경 없음 |

## 2. 단계별 배치

| 단계 | 하위 칸 · dispatch | 꺼낼 스킬·문서 | 완료 기준 · 추가 검증 |
|---|---|---|---|
| **P0 규칙 코어** (오늘 밤) | opus-1 `design`(데이터 모양·함수 경계) → sonnet-1 `impl`(DESIGN 3~6절 표를 데이터로) · sonnet-2 `test`(사다리·매개체·리스폰 테스트, `tools/sim.ts`) | gamedev-skills `survival-crafting`(원자적 제작, 사다리 점검) · `rpg`(XP 표 점검) · pipeline.md 1-1 기획, 6절 | 테스트 통과, 사다리 점검 통과. 봇이 첫 판매·첫 제작·첫 도구 시간과 매개체별 수입을 출력하고, 첫 도구는 3~5분이에요. 상점·판매함 중 하나가 늘 이기지 않아요 |
| **P1 첫 루프 그레이박스** (오늘 밤) | opus-1 `design`(장면·입력 경계, P0와 동시 시작) → sonnet-1 `impl` · sonnet-2 `test` | `threejs-gameplay-systems`(설계 3문서·루프 계약 점검, 스캐폴드는 이미 있음) · `threejs-debug-profiler`(검은 화면·느림) · `threejs-qa-release`(e2e·캔버스 픽셀) · pipeline.md 1-2 프로토, 2절 색인 | 공통 검증 통과. e2e: 나무 클릭 → 통나무 +1 → 판자 제작 → 상점 판매로 코인 증가 / 판매함 넣고 잠자기 → 아침 정산. 대니님 플레이 뒤 DESIGN 1절 RESULT 기록 |
| P2 지형·리스폰 | opus `design`(지형 격자·길찾기·장면 전환) → sonnet `impl` · `test` · neon `bulk-read`(성능 기록이 길 때) | gamedev-skills `procedural-gen`·`camera-systems`·`save-systems` · `threejs-aaa-graphics-builder`(절차적 지형·LOD·인스턴싱) · `threejs-debug-profiler` · pipeline.md 1-5 테스트·튜닝 | 길찾기(층·경사로·사다리), 리스폰(같은 자리·무작위·접속 공백), 저장 이주 테스트. 휴대폰 크기 30fps 측정 기록 |
| P3 제작·판매·의뢰 | opus `design`(경제 구조) → sonnet `impl` · `test` · sonnet `analyze`(봇 표) | `survival-crafting` · `game-ui-ux` · `threejs-game-ui-designer`(제작·판매·게시판 UI) · pipeline.md 1-4 구현 | 경제 봇: 집 3단계까지 시간, 매개체·의뢰 수입 비율(의뢰 ≤ 40%, 의뢰 XP ≤ 15%). 의뢰 생성 테스트 |
| P4 캐릭터·주민·스토리 | hydrogen-1 `image`(콘셉트 시트·아이콘, agy 구독) → opus `design`(캐릭터 부품·얼굴 텍스처 구조) → sonnet `impl` · `review` · hydrogen `write`(컷신·대사 초안) → sonnet `review` | `threejs-aaa-graphics-builder`(절차적 캐릭터·재질, 화면 점수표) · `threejs-game-ui-designer`(캐릭터 만들기 화면) · gamedev-skills `dialogue-systems` · pipeline.md 1-3 아트·사운드, 4절 비용표(Tripo를 쓸 때만) | art-style 1절 금지 목록 위반 0. 캐릭터 만들기 e2e(남/여·얼굴·표정·복장 저장). 스크린샷 비교 3장 |
| P5 동료·연구·큰 의뢰 | opus `design`(동료 상태·연구 공식) → sonnet `impl` · `test` · sonnet `analyze` | gamedev-skills `game-ai`(동료 작업 상태 기계) · `save-systems` · pipeline.md 1-5 | 봇: 동료 있음/없음 비교에서 재물 축만 빨라지고 XP 축은 그대로예요. 연구 속도 공식 테스트 |
| P6 손맛·출시 | sonnet `impl`(game-feel·소리) · neon `bulk-read` → sonnet `analyze`(성능) · opus-2 `review-final` · hydrogen `check`(배포 점검표) · 메인(병합) | gamedev-skills `game-feel`·`audio-design` · `threejs-qa-release`(base 경로·회귀) · 배경음은 agent-bridge Suno 의뢰 · pipeline.md 1-6 배포 | 노트북 60fps·휴대폰 30fps 기록. 병합 승인 뒤 기본 checkout에서 공통 검증을 다시 돌리고 Pages에서 열리는지 확인 |

- 낮은 모델부터 써요. 한 번 실패하거나 범위가 커지면 한 단계 올려요(space-rules).
- 글 초안(튜토리얼·대사·컷신)은 hydrogen `write` → sonnet `review` 순서예요. 문구는 '합니다'체를 피하고 자연스러운 구어체로 써요.
- 쓰지 않는 스킬: `threejs-3d-generator`·`threejs-image-generator`·`threejs-audio-generator`(유료 생성기)는 대니님 승인 전 금지예요. Tripo가 필요하면 pipeline.md 4절 비용표와 art-style 5절 추정(9명 약 $12)으로 승인을 따로 받아요.

## 3. 오늘 밤 순서

```
P0  opus-1 데이터 모양 ──▶ sonnet-1 규칙 구현 ──┬──▶ sonnet-2 테스트·경제 봇 ──▶ 봇 표 확인
                                               │
P1  opus-1 장면·입력 경계 ─────────────────────┴──▶ sonnet-1 그레이박스 ──▶ sonnet-2 e2e·화면
                                                                              │
                                                    대니님 플레이 ──▶ KEEP / KILL / RETUNE 기록
```

- P1 장면 경계 작업은 P0 규칙 구현과 동시에 시작해요. 규칙 함수 이름만 먼저 맞춰요.
- 시간 상자를 넘기면 끝난 데까지로 플레이해서 판정해요.

## 4. 하지 않는 것

- 컷 리스트 항목(DESIGN 13-1)을 오늘 밤에 끌어오는 것
- 승인 없는 유료 생성, 키 확인 스크립트 실행, 승인 목록 밖 패키지 설치
- 화풍이 정해지기 전에 아트를 다듬는 것(prototype-fast: "polishing too early")
- 특정 게임 화면이나 이름을 참고 이미지·프롬프트에 쓰는 것
