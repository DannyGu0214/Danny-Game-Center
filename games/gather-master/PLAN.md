# 줍줍 마스터 진행 계획

- 상태: 초안 · 2026-11-25. 설계는 [`DESIGN.md`](DESIGN.md), 화풍은 [`docs/art-style.md`](docs/art-style.md)를 봐요.
- 운영 규칙: `~/danny-agent/orch/space-rules.md`. 메인 칸은 나누고 검토만 해요. 하위 칸은 단계마다 worktree(`claude/gather-master-<단계>`)에서 고치고, 테스트하고, 커밋해요. 병합·push는 대니님 승인 뒤에만 해요.
- 파이프라인 기준: `docs/game-dev/pipeline.md` v2 6절(3D 시제품 최소 세트).

## 공통 검증 (모든 단계)

| 검사 | 명령·도구 | 통과 기준 |
|---|---|---|
| 타입 검사 | `npm run typecheck` | 오류 0 |
| 규칙 테스트 | `npm test`(node --test, TS 그대로) | 전부 통과. `src/sim/`이 `three`를 import하지 않아요 |
| 빌드 | `npm run build` | 성공, `dist/`가 정적 서버에서 열려요 |
| 브라우저 스모크 | `npm run e2e`(Playwright, 설치된 Chrome) | 통과 |
| 화면 확인 | chrome-devtools MCP 스크린샷·콘솔(사용 통계 끔 설정 적용됨) | 콘솔 오류 0, 스크린샷을 보고서에 첨부 |
| 범위 | `git diff --stat` | 그 단계 폴더 밖 변경 없음 |

`npm ci`는 이 폴더의 `package-lock.json` 기준으로만 해요. 새 패키지를 추가하려면 승인이 필요해요.

## 단계별 배치

| 단계 | 하위 칸 · dispatch | 할 일 | 완료 기준 | 추가 검증 |
|---|---|---|---|---|
| **P0 규칙 코어** (오늘 밤) | opus-1 `design` → sonnet-1 `impl` · sonnet-2 `test` | opus: `src/sim/` 데이터 모양(자원·도구·기술·가방·집)과 함수 경계를 정해요. sonnet-1: 4절 표를 데이터로 옮기고 캐기·판매·XP·레벨·구매 함수를 만들어요. sonnet-2: 사다리 점검·가방 꽉 참·레벨 경계 테스트와 봇(`tools/sim.ts`)을 만들어요 | 테스트 통과. 봇 출력에 첫 판매·첫 레벨업·첫 도구 시간이 나오고, 첫 도구가 3~5분 안이에요 | 사다리 점검(모든 자원·도구·집이 도달 가능, 순환 없음). 봇 시드 5개의 표 |
| **P1 그레이박스 섬** (오늘 밤) | opus-1 `design`(장면·입력 경계) → sonnet-1 `impl` · sonnet-2 `test` | 섬·노드·판매함을 기본 도형으로 놓아요. 클릭·탭 이동, 누르고 있으면 캐기, 노드 재생, 디버그 HUD, 조정값 상수 | 공통 검증 통과. HUD 값이 플레이에 맞게 바뀌어요. 대니님 플레이 뒤 `DESIGN.md` 1절에 RESULT 기록 | e2e: 노드 클릭 → 가방 +1 → 판매 → 코인 증가. 휴대폰 크기 화면에서 탭 조작 |
| P2 성장 고리 | sonnet-1 `impl` · sonnet-2 `test` · (구조 변경이면 opus `design`) | 집 1→3단계, 해금표 전체, 농사 성장 시간, 저장(localStorage, 버전 번호와 이주 함수) | 저장·불러오기·이주 테스트. 봇으로 집 3단계까지 걸린 시간을 기록해요 | 오래된 저장을 불러오는 시험 자료 |
| P3 화풍 | hydrogen-1 `image`(콘셉트 시트·아이콘, agy 구독) → opus `design`(주민·재질 구조) → sonnet `impl` · `review` | art-style 적용, 코드로 만든 주민 2~3명, UI·아이콘. Tripo는 화풍 점검에서 떨어질 때만 💳 승인 후 | art-style 1절 금지 목록 위반 0. 색·비율 점검표 통과 | 스크린샷 비교 3장(마당·숲·바위 언덕). 그리기 호출 수 기록 |
| P4 손맛·확장 | sonnet `impl` · neon-1 `bulk-read`(성능 기록 1차 정리) → sonnet `analyze` | game-feel(캐기 흔들림·튀어나오는 자원), 소리(Web Audio, 배경음은 agent-bridge Suno 의뢰), 강가·동굴, 모바일 다듬기 | 노트북 60fps, 휴대폰 30fps 측정 기록 | chrome-devtools 성능 기록, `?perf=1` HUD |
| P5 출시 | opus-2 `review-final` · hydrogen-1 `check`(배포 점검표) · 메인(병합) | "대가" 엔딩, 밸런스 표 마무리, `dist` 커밋(A안), 게임센터 첫 화면 연결 | 병합 승인 뒤 기본 checkout에서 공통 검증을 다시 돌리고, Pages 주소에서 열리는지 확인 | 출시 전 최종 검토 보고 |

- neon은 읽을 양이 많을 때만 써요(성능 기록, 봇 결과 여러 개).
- 글쓰기 초안(설명문·튜토리얼 문구)은 hydrogen `write` → sonnet `review` 순서예요. 문구는 해요체 대신 자연스러운 구어체로 써요(바리스타 게임과 같은 기준).

## 오늘 밤 순서

```
P0  opus-1 데이터 모양 ──▶ sonnet-1 규칙 구현 ──┬──▶ sonnet-2 테스트·봇 ──▶ 봇 표 확인(목표 3~5분)
                                               │
P1  opus-1 장면·입력 경계 ─────────────────────┴──▶ sonnet-1 그레이박스 ──▶ sonnet-2 e2e·화면
                                                                              │
                                                    대니님 플레이 ──▶ KEEP / KILL / RETUNE 기록
```

- P1의 장면 경계 작업은 P0 규칙 구현과 동시에 시작할 수 있어요. 규칙 함수 이름만 먼저 맞춰요.
- 시간 상자를 넘기면 끝난 데까지로 플레이해서 판정해요.

## 하지 않는 것

- 주민·대화·꾸미기·계절을 시제품에 먼저 넣는 것(DESIGN 5절 컷 리스트)
- 승인 없는 유료 생성(Tripo 등), 승인 목록 밖 패키지 설치
- 화풍이 정해지기 전에 아트를 다듬는 것(prototype-fast: "polishing too early")
- 특정 게임 화면을 참고 이미지나 프롬프트에 쓰는 것
