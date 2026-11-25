# 게임 개발 파이프라인

> **5줄 요약 (비전공자용)** · ↻ 2026-11-25 재판정
> 1. 새 3D 시제품은 **Vite·TypeScript** 도구를 써서 만드는 안을 추천해요. AI가 고친 코드의 일부 실수를 실행하기 전에 기계가 잡아 줘요.
> 2. 그러면 전에 "우리와 안 맞음"이던 three.js 게임 스킬 묶음과 사진→3D 도구를 후보로 쓸 수 있어요. 돈이 드는 생성기를 빼도 스킬 9개 중 6개가 남아요.
> 3. 유료 도구도 후보에 넣고 값을 적었어요. 3D 모델 생성(Tripo)은 기본 옵션 모델 10개에 2~3달러로 계산되지만 고급 옵션·리깅·동작을 쓰면 늘어나고, **쓸 때마다 승인**을 받아요.
> 4. 정보를 밖으로 보내는 기능은 끄는 방법을 적었어요. 이미 쓰는 크롬 점검 도구는 확인 당시 설정에 끄는 옵션이 없어서 꺼야 해요.
> 5. 지금 있는 게임 6개와 사이트 배포 방식은 그대로 둬요. 새 방식은 새 게임에만 써요.

- **작성**: 2026-11-25, 같은 날 기준을 바꿔 다시 판정했어요(v2). 바뀐 판정에는 **↻ 2026-11-25 재판정**(표 안에서는 ↻) 표시가 있어요. · 설계안이에요. 이 순서 전체를 새 게임에 적용해 본 적은 아직 없어요.
- **함께 보기**: [스킬 카탈로그](gamedev-skills-catalog.md) · [참고 영상 정리](references/video-skills-13.md)
- **표기**: `[추측]`은 원문을 읽거나 실행해 보지 않은 판단이에요. 영상에서 온 수치는 "제작자 주장"으로 적어요. 💳는 **쓸 때마다 승인이 필요**한 항목(유료 호출·가입·키 발급)이에요. `[미확인]`은 근거 페이지에서 값을 확인하지 못했다는 뜻이에요. 스킬 이름은 카탈로그 항목으로, **원문**은 GitHub의 `SKILL.md`로 연결돼요. 카탈로그 80개의 스킬 본문은 아직 읽지 않았어요.

## 0. 전제와 참조 방식

### 바뀐 기준 (↻ 2026-11-25 재판정)

| 항목 | 전 | 후 |
|---|---|---|
| 빌드·TypeScript | 금지(무빌드 바닐라 JS, three.js 동봉) | **허용.** 결과물이 GitHub Pages에 정적 파일로 올라가면 돼요 |
| 유료 API·유료 계정 | 제외 | **후보에 포함.** 비용과 무료·구독 대안 대비 이득을 적고, 쓸 때마다 승인받아요 💳 |
| 외부 전송(프롬프트·화면·사용 통계) | 제외 | **끄거나 명시**해요([5절](#5-외부-전송과-끄는-법)). 생성에 꼭 필요한 전송이 아닌데 끌 수 없으면 제외해요 |
| `superpowers` | 제외 | 제외(그대로) |

### 유지하는 전제

| 항목 | 내용 |
|---|---|
| 기존 게임 | 6개 게임은 무빌드 방식 그대로 둬요. 이번 변경은 새 게임에만 적용해요 |
| 구조 | 게임 규칙을 화면 코드와 나눠 `node --test`로 검사하고, 자동 플레이([sim.js](../../games/ocean-world-3d/tools/sim.js))로 수치를 재요 |
| 배포 | GitHub Pages. 확인 당시 설정은 `main` 브랜치 루트를 그대로 올리는 방식이에요. 병합과 push는 승인 후에만 해요 |
| 작업 방식 | 총괄 에이전트는 분배와 검토를 맡고, 작업 에이전트가 별도 작업 폴더(git worktree)에서 고치고 시험·커밋해요 |
| 승인 | 패키지·플러그인 설치, 유료 호출, 가입·키 발급, 공통 설정 변경 |

아래의 `opus`·`sonnet`은 Claude 모델, `hydrogen`·`neon`은 보조 모델을 맡은 작업 에이전트의 이름이에요.

### 기존 방식 vs 빌드 방식 (↻ 2026-11-25 재판정)

| 기준 | 무빌드 바닐라 JS + 동봉 three.js (지금 게임) | Vite + TypeScript + npm three |
|---|---|---|
| 개발 속도 | 정적 서버만 띄우면 돼요. 설정 파일이 거의 없어요 | 첫 설정에 10~20분 `[추측]`. 이후에는 저장 즉시 반영(HMR)이 돼요 |
| AI 에이전트 작업 | 오타·잘못된 인자·없는 속성은 실행해 봐야 알아요 | `tsc --noEmit`이 오타·타입 오류를 실행 전에 잡아서 "타입 오류 0"을 완료 증거로 낼 수 있어요. 타입을 맞추느라 코드가 늘 수 있어요 |
| 시험 | `node --test` | `node --test`가 `.ts`를 바로 실행해요(Node 26.3.0에서 시험 1건 통과 확인). **타입 검사는 하지 않으므로** `tsc --noEmit`이 따로 필요해요. vitest는 선택이에요 |
| 배포 | `main` 루트를 그대로 올려요 | 빌드가 필요해요. **A.** 로컬에서 빌드해 `dist/`를 커밋(Pages 설정 유지). **B.** GitHub Actions로 빌드. Pages 소스를 Actions로 바꾸면 **사이트 전체**를 워크플로가 올려야 해요(승인 필요) |
| three.js 애드온 | 필요한 파일을 `vendor/`에 하나씩 복사해요(지금 [3개](../../games/ocean-world-3d/vendor/three-0.187.0/VENDOR.md)) | `three/addons/…`를 바로 import해요. 번들에는 쓴 코드가 주로 담겨요 `[추측]` |
| 저장소 크기 | 3D 게임마다 three.js 약 2.1MB를 복사해요 | `node_modules`는 커밋하지 않아요. A안은 빌드 산출물이 커밋 기록에 쌓여요. 크기는 재지 않았어요 `[추측]` |
| 일관성 | 기존 게임과 같아요 | 방식이 하나 더 생겨요 |
| 작업 폴더 운영 | worktree에서 바로 실행돼요 | worktree마다 `npm ci`가 필요해요. 설치 승인 범위를 "그 게임 폴더의 lock 파일 기준"처럼 미리 정해야 작업이 멈추지 않아요. dev 서버 포트도 나눠요 |
| 스킬·도구 | 영상의 three.js 도구는 옮겨 써야 해요 | `threejs-game-skills` 스캐폴드와 `img2threejs`의 TypeScript 출력이 방식상 맞아요(실행해 보지 않았어요 `[추측]`) |
| 오프라인(PWA) | 서비스 워커에 파일 목록을 직접 적어요 | 파일 이름에 해시가 붙어 직접 적기 어려워요. 필요하면 PWA 플러그인을 써요(시제품에서는 제외) |

**선택 기준**

| 이럴 때 | 고를 방식 |
|---|---|
| 기존 6개 게임을 고칠 때 | 무빌드 유지 |
| 작은 2D 게임, 파일 몇 개로 끝나고 바로 올려야 할 때 | 무빌드 |
| 새 3D 게임처럼 애드온과 코드가 늘어날 때, 여러 에이전트가 나눠 고칠 때 | Vite + TypeScript |
| 패키지 설치 승인을 받을 수 없을 때 | 무빌드 |
| 빌드 게임이 2개 이상이 되거나 정식 배포할 때 | 배포 A안과 B안을 그때 다시 정해요 |

### 참조 방식 3가지

| 방식 | 뜻 | 하는 법 |
|---|---|---|
| **원문 읽기** | 필요할 때 `SKILL.md`를 읽고 요점만 적용해요. 저장소에 남는 것은 없어요 | 이 문서의 "원문" 링크를 열어요. 버전을 고정하려면 주소의 `main`을 커밋 `c6ca6c4`로 바꿔요 |
| **선택 복사** | 쓸 만한 절이나 점검표만 우리 문서로 옮겨요 | `docs/game-dev/references/`에 두고(제안), 출처 URL·커밋·라이선스·바꾼 점을 적어요. 스크립트는 원문을 감사한 뒤에만 복사해요 |
| **설치(승인)** | 플러그인·MCP·CLI·실행 파일을 설치해요 | 승인이 필요해요. 텔레메트리를 끄는 옵션과 유료 키 필요 여부를 함께 알려요 |

## 1. 단계별 파이프라인

```
기획 ──▶ 프로토 ──▶ 아트·사운드 ──▶ 구현 ──▶ 테스트·튜닝 ──▶ 배포
 │         │            │ (병행 가능)    │           │               │
opus     opus→sonnet   hydrogen        sonnet     sonnet·neon     총괄(승인 후)
                       + 에셋 의뢰                  최종 검토 opus
```

### 1-1. 기획

| 항목 | 내용 |
|---|---|
| 목표 | 핵심 루프, 화면 시안 하나, 단계 목표, "이번 판이 답할 질문 하나"를 1쪽짜리 `DESIGN.md`로 정해요 |
| 담당 | 구조 결정은 `opus`. 장르 자료 조사가 길면 `hydrogen`이 먼저 추려요 |
| 꺼낼 것 | 장르 템플릿 9개 중 해당 1개(2절) · [`threejs-gameplay-systems`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-gameplay-systems/SKILL.md) 저장소의 [장르 설계 자료](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-gameplay-systems/references/genre-design.md)(3D일 때) · [`game-docs`](gamedev-skills-catalog.md#skill-game-docs)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/game-docs/SKILL.md)) · [`prototype-fast`](gamedev-skills-catalog.md#skill-prototype-fast)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/prototype-fast/SKILL.md)) · 우리 선례: 각 게임 폴더의 `DESIGN.md` |
| 완료 기준 | 루프·조작·승리와 실패·측정할 수치가 적혀 있고, 하지 않을 것(컷 리스트)이 따로 있어요 |
| 주의 | `game-docs`의 `scripts/`는 읽지 않았으니 형식만 참고하고 실행하지 않아요 |

### 1-2. 프로토

| 항목 | 내용 |
|---|---|
| 목표 | 질문 하나에 답하는 플레이 가능한 화면. 그림은 기본 도형이면 돼요 |
| 담당 | 뼈대는 `opus`, 채우기는 `sonnet` |
| 꺼낼 것 | [`prototype-fast`](gamedev-skills-catalog.md#skill-prototype-fast)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/prototype-fast/SKILL.md)) · 3D(↻ 2026-11-25 재판정): [`threejs-gameplay-systems`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-gameplay-systems/SKILL.md)의 스캐폴드 구조로 시작하고, [`threejs-scene-setup`](gamedev-skills-catalog.md#skill-threejs-scene-setup)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-scene-setup/SKILL.md))과 우리 코드 [stage.js](../../games/ocean-world-3d/render/core/stage.js)(톤매핑·환경맵)·[app.js](../../games/ocean-world-3d/render/core/app.js)(Timer 루프)는 TypeScript로 옮길 참고용이에요 · 2D면 기존 Canvas 게임의 루프 |
| 완료 기준 | 콘솔 오류 0, 핵심 조작이 돼요. 규칙 시험이 1개 이상 있어요. 빌드 방식이면 타입 오류 0과 빌드 성공도 포함해요 |
| 주의 | 방식은 [선택 기준](#기존-방식-vs-빌드-방식--2026-11-25-재판정)으로 먼저 정해요. 설치와 유료 생성기는 승인 전에 쓰지 않아요 |

### 1-3. 아트·사운드 (구현과 병행)

| 항목 | 내용 |
|---|---|
| 목표 | 화풍 기준과 에셋 목록을 정해요. 시제품 판정 전에는 임시 그림을 써요 |
| 담당 | 이미지 시안과 화풍 초안은 `hydrogen`, 검토는 `sonnet`. 일괄 생성과 음악은 [에셋 의뢰](../agent-bridge.md)로 해요(운영자가 시작). ↻ 주인공 3D 모델은 `img2threejs`(구독 토큰) 또는 Tripo 💳, 효과음 묶음은 ElevenLabs 💳가 후보예요([4절](#4-유료-후보-비용표-)) |
| 꺼낼 것 | [`create-game-assets`](gamedev-skills-catalog.md#skill-create-game-assets)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md)) · [`audio-design`](gamedev-skills-catalog.md#skill-audio-design)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/audio-design/SKILL.md)) · 아이콘은 [make-icons.mjs](../../games/ocean-world-3d/tools/make-icons.mjs) 선례 |
| 완료 기준 | 게임 폴더에 화풍 기준([예](../../games/ocean-world-3d/docs/art-style.md)), 에셋 목록, `assets/CREDITS.md`가 있어요 |
| 주의 | ↻ 2026-11-25 재판정: `sprite-gen`과 `threejs-game-skills` 생성기는 제외에서 후보로 바꿨어요. 유료·외부 전송 경로는 쓸 때마다 승인받아요 💳. 의뢰서에 생성 모델을 지정하지 않아요. 공개 저장소에 외부 자료를 넣을 때는 라이선스를 확인해요 |

### 1-4. 구현

| 항목 | 내용 |
|---|---|
| 목표 | 시제품을 게임으로 키워요. 규칙(`sim/`)과 화면 코드를 나눠요. 규칙은 three를 import하지 않아요 |
| 담당 | 명세가 분명하면 `sonnet`. 파일 3개 이상을 바꾸는 구조 변경이나 원인 모르는 버그는 `opus` |
| 꺼낼 것 | 상황마다 1개씩(2절). 자주 쓸 것: [`game-feel`](gamedev-skills-catalog.md#skill-game-feel)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-feel/SKILL.md)) · [`camera-systems`](gamedev-skills-catalog.md#skill-camera-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/camera-systems/SKILL.md)) · [`input-systems`](gamedev-skills-catalog.md#skill-input-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/input-systems/SKILL.md)) · [`game-ui-ux`](gamedev-skills-catalog.md#skill-game-ui-ux)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md)) · [`save-systems`](gamedev-skills-catalog.md#skill-save-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/save-systems/SKILL.md)) · 코드 절제는 [ponytail](gamedev-skills-catalog.md#video-ponytail)([저장소](https://github.com/DietrichGebert/ponytail))의 원칙만 참조 |
| 완료 기준 | 기능마다 시험이 늘고 `npm test`가 모두 통과해요. 작업 브랜치에 커밋해요 |
| 주의 | ↻ 빌드 방식은 TypeScript strict와 `three/addons/…` import를 써요. 의존성을 늘릴 때는 승인받아요. 무빌드 게임의 새 애드온은 지금처럼 `vendor/`에 원본 그대로 복사하고 `VENDOR.md`에 sha256을 적어요 |

### 1-5. 테스트·튜닝

| 항목 | 내용 |
|---|---|
| 목표 | 규칙이 맞는지, 수치가 재미있는지, 성능이 버티는지 확인해요 |
| 담당 | 시험 작성은 `sonnet`, 명령 실행은 `hydrogen`, 긴 로그의 1차 정리는 `neon` 뒤 결론은 `sonnet`, 출시 전 검토는 `opus` |
| 꺼낼 것 | `node --test`(빌드 방식은 ↻ `tsc --noEmit` 추가) · [sim.js](../../games/ocean-world-3d/tools/sim.js) `--table` · ↻ Playwright 화면 검사와 [`threejs-qa-release`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-qa-release/SKILL.md)(설치 승인 후) · [chrome-devtools-mcp](gamedev-skills-catalog.md#video-chrome-devtools-mcp)(**끄기 옵션 적용 후**) · [perf-run.mjs](../../games/ocean-world-3d/tools/perf-run.mjs)와 `?perf=1` · [`performance-optimization`](gamedev-skills-catalog.md#skill-performance-optimization)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/performance-optimization/SKILL.md)) |
| 완료 기준 | 시험 통과 수, 측정 표, 성능 수치(프레임 시간·드로우 콜)를 게임 폴더의 보고 문서에 남기고, 화면을 **직접 보고** 확인한 기록이 있어요 |
| 주의 | `chrome-devtools-mcp`는 사용 통계가 기본으로 켜져 있고, 확인 당시 작업 환경 설정에는 끄는 옵션이 없었어요([5절](#5-외부-전송과-끄는-법)). [capture.mjs](../../games/ocean-world-3d/tools/capture.mjs)는 Playwright가 필요한데, 앞서 확인한 작업 폴더에서는 불러올 수 없었어요(설치는 승인 필요) |

### 1-6. 배포

| 항목 | 내용 |
|---|---|
| 목표 | `main` 병합 → GitHub Pages 반영. PWA면 서비스 워커 캐시 버전을 올려요. ↻ 빌드 방식은 A안으로 시작해요: `vite build`(`base: './'`) 산출물 `games/<name>/dist/`를 커밋하고 첫 화면에서 그 경로로 연결해요. 시제품 단계에서는 배포하지 않아요 |
| 담당 | 병합·push는 승인 뒤 총괄이 해요. 배포 전 점검표 확인은 `hydrogen` |
| 꺼낼 것 | [`game-jam`](gamedev-skills-catalog.md#skill-game-jam)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/game-jam/SKILL.md)) · itch.io에 낼 때만 [`itch-publish`](gamedev-skills-catalog.md#skill-itch-publish)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/itch-publish/SKILL.md)) |
| 완료 기준 | 병합 후 `main`에서 시험을 다시 통과하고, 배포 주소에서 열리는 것을 확인해요 |
| 주의 | GitHub Pages는 [에셋 의뢰 지침](../agent-bridge.md)의 `deploy` 등록 서비스가 아니에요. `steam-publish`는 해당 없어요 |

## 2. "언제 꺼낼지" 색인

참조 방식: **읽기** = 원문 읽기 · **복사** = 선택 복사 후보 · **승인** = 설치·유료 필요 · **보유** = 이미 있음

| 상황 | 꺼낼 것 | 참조 방식 |
|---|---|---|
| 어떤 스킬을 쓸지 모르겠다 | 이 색인 → [장르별 조합표](gamedev-skills-catalog.md#31-향후-여러-장르-게임을-만들-때-먼저-볼-스킬-조합) · [`router`](gamedev-skills-catalog.md#skill-router)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/router/SKILL.md)) | 읽기 |
| 장르를 새로 시작 | [`card-game`](gamedev-skills-catalog.md#skill-card-game)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/card-game/SKILL.md)) · [`fps-shooter`](gamedev-skills-catalog.md#skill-fps-shooter)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/fps-shooter/SKILL.md)) · [`platformer`](gamedev-skills-catalog.md#skill-platformer)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/platformer/SKILL.md)) · [`puzzle`](gamedev-skills-catalog.md#skill-puzzle)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/puzzle/SKILL.md)) · [`roguelike`](gamedev-skills-catalog.md#skill-roguelike)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/roguelike/SKILL.md)) · [`rpg`](gamedev-skills-catalog.md#skill-rpg)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/rpg/SKILL.md)) · [`survival-crafting`](gamedev-skills-catalog.md#skill-survival-crafting)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/survival-crafting/SKILL.md)) · [`tower-defense`](gamedev-skills-catalog.md#skill-tower-defense)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/tower-defense/SKILL.md)) · [`visual-novel`](gamedev-skills-catalog.md#skill-visual-novel)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/visual-novel/SKILL.md)) 중 1개 | 읽기 |
| 3D 장면 첫 설정 | ↻ 빌드 방식: [`threejs-gameplay-systems`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-gameplay-systems/SKILL.md) · [stage.js](../../games/ocean-world-3d/render/core/stage.js)·[app.js](../../games/ocean-world-3d/render/core/app.js) → [`threejs-scene-setup`](gamedev-skills-catalog.md#skill-threejs-scene-setup)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-scene-setup/SKILL.md)) | 보유 → 읽기 |
| 조명이 검다·색이 탁하다 | [`threejs-materials-lighting`](gamedev-skills-catalog.md#skill-threejs-materials-lighting)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-materials-lighting/SKILL.md)) · stage.js의 `NeutralToneMapping`+`RoomEnvironment` | 읽기 · 보유 |
| 그림자 줄무늬·그림자 없음 | [`threejs-materials-lighting`](gamedev-skills-catalog.md#skill-threejs-materials-lighting)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-materials-lighting/SKILL.md)) | 읽기 |
| GLB 모델 넣기 | [`threejs-gltf-loading`](gamedev-skills-catalog.md#skill-threejs-gltf-loading)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-gltf-loading/SKILL.md)) + `GLTFLoader`(빌드 방식은 `three/addons/…` import, 무빌드는 `vendor/`에 복사) | 읽기 · 복사 |
| 물결·림·디졸브 셰이더 | [`shader-programming`](gamedev-skills-catalog.md#skill-shader-programming)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/shader-programming/SKILL.md)) · [shaderPatches.js](../../games/ocean-world-3d/render/core/materials/shaderPatches.js) · [render/aqua](../../games/ocean-world-3d/render/aqua) | 읽기 · 보유 |
| 사진 한 장으로 3D 모형 | ↻ [img2threejs](gamedev-skills-catalog.md#video-img2threejs)([저장소](https://github.com/img2threejs/img2threejs)) 본체, 또는 Tripo 💳([4절](#4-유료-후보-비용표-)) | 읽기 · 승인 · 💳 |
| 카메라가 어지럽다·따라가기 | [`camera-systems`](gamedev-skills-catalog.md#skill-camera-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/camera-systems/SKILL.md)) · [camera.js](../../games/ocean-world-3d/render/core/camera.js) | 읽기 · 보유 |
| 타격감이 밋밋하다 | [`game-feel`](gamedev-skills-catalog.md#skill-game-feel)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-feel/SKILL.md)) | 읽기 → 복사 후보 |
| 키·터치 입력이 꼬인다 | [`input-systems`](gamedev-skills-catalog.md#skill-input-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/input-systems/SKILL.md)) · [input.js](../../games/ocean-world-3d/render/core/input.js) | 읽기 · 보유 |
| HUD 배치·해상도 대응 | [`game-ui-ux`](gamedev-skills-catalog.md#skill-game-ui-ux)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md)) | 읽기 |
| 스프라이트 시트 | [`create-game-assets`](gamedev-skills-catalog.md#skill-create-game-assets)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md)) + 보조 모델 이미지 또는 에셋 의뢰. ↻ 자르기·아틀라스는 [sprite-gen](gamedev-skills-catalog.md#video-sprite-gen) 유틸 | 읽기 · 보유 · 승인 |
| 로고·아이콘·파비콘 | [make-icons.mjs](../../games/ocean-world-3d/tools/make-icons.mjs) → [logo-design-skill](gamedev-skills-catalog.md#video-logo-design-skill)([저장소](https://github.com/kaankiziltug/logo-design-skill))의 작은 크기 전용판·사용 규칙 ↻ | 보유 → 읽기 · 설치는 승인 |
| 배경음·효과음 | 에셋 의뢰(Suno) · ↻ 효과음이 많이 필요하면 ElevenLabs 💳 · Web Audio 합성 선례 · [`audio-design`](gamedev-skills-catalog.md#skill-audio-design)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/audio-design/SKILL.md)) | 보유 · 읽기 |
| 프레임이 떨어진다 | `?perf=1` → [perf-run.mjs](../../games/ocean-world-3d/tools/perf-run.mjs) → 크롬 성능 트레이스 → [`performance-optimization`](gamedev-skills-catalog.md#skill-performance-optimization)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/performance-optimization/SKILL.md)) · [instancing.js](../../games/ocean-world-3d/render/core/instancing.js)·[batched.js](../../games/ocean-world-3d/render/core/batched.js) | 보유 → 읽기 |
| 메모리 누수 | 크롬 힙 스냅샷 · [memory-leak-debugging](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/memory-leak-debugging) 스킬([카탈로그 항목](gamedev-skills-catalog.md#video-chrome-devtools-mcp)) | 보유 · 읽기 |
| 코드가 부풀고 과하게 설계됐다 | [ponytail](gamedev-skills-catalog.md#video-ponytail)([저장소](https://github.com/DietrichGebert/ponytail)) 원칙(필요한 만큼만) · Claude Code의 `/simplify` | 읽기 · 보유 |
| 저장 구조 변경·옛 저장 옮기기 | [`save-systems`](gamedev-skills-catalog.md#skill-save-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/save-systems/SKILL.md)) · [save.js](../../games/ocean-world-3d/sim/save.js)·[save.test.js](../../games/ocean-world-3d/test/save.test.js) | 읽기 · 보유 |
| 밸런스·수치가 이상하다 | [sim.js](../../games/ocean-world-3d/tools/sim.js) `--table` · 장르 템플릿 | 보유 · 읽기 |
| 길찾기·적 AI | [`game-ai`](gamedev-skills-catalog.md#skill-game-ai)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ai/SKILL.md)) · [`ai-behavior-trees-utility-ai`](gamedev-skills-catalog.md#skill-ai-behavior-trees-utility-ai)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/ai-behavior-trees-utility-ai/SKILL.md)) | 읽기 |
| 지형·던전 자동 생성 | [`procedural-gen`](gamedev-skills-catalog.md#skill-procedural-gen)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/procedural-gen/SKILL.md)) · [terrain.js](../../games/ocean-world-3d/render/core/terrain.js) | 읽기 · 보유 |
| 대화·분기 이야기 | [`dialogue-systems`](gamedev-skills-catalog.md#skill-dialogue-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/dialogue-systems/SKILL.md)) · [`visual-novel`](gamedev-skills-catalog.md#skill-visual-novel)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/visual-novel/SKILL.md)) · [prologue-story.js](../../games/ocean-world-3d/ui/prologue-story.js) | 읽기 · 보유 |
| 검은 화면·로딩 실패(3D) ↻ | [`threejs-debug-profiler`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-debug-profiler/SKILL.md) | 읽기 |
| Pages 하위 경로·화면 회귀·봇 플레이 ↻ | [`threejs-qa-release`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-qa-release/SKILL.md) | 읽기 · 승인(Playwright) |
| 화면이 밋밋하다(3D) ↻ | [`threejs-aaa-graphics-builder`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-aaa-graphics-builder/SKILL.md) | 읽기 |
| 화면을 안 보고 끝냈다 | 크롬 스크린샷([chrome-devtools-mcp](gamedev-skills-catalog.md#video-chrome-devtools-mcp)) · 녹화 모드 `?capture` | 보유 |

## 3. 도입 등급 (↻ 2026-11-25 재판정)

영상에서 온 13종의 라이선스·필요 조건·전→후 판정은 [카탈로그 6절](gamedev-skills-catalog.md#video-13)에 있어요.

### 판정이 바뀐 항목

| 항목 | 전 → 후 | 바뀐 이유 | 외부 전송 |
|---|---|---|---|
| [threejs-game-skills](gamedev-skills-catalog.md#video-threejs-game-skills) 코어 | 미사용 → **참조 1순위 · 설치 후보** | Vite·TypeScript가 허용됐어요. [README](https://github.com/majidmanzarpour/threejs-game-skills#readme)는 코어 스킬이 유료 키 없이 동작하고, 키가 없으면 코드·로컬 에셋으로 이어 간다고 적어요 | 생성기를 쓰지 않으면 업체 호출이 없어요 |
| 그 생성기 3종 | 미사용 → **유료 후보 💳** | 유료 도구를 후보에 넣어요 | 생성에 필요한 프롬프트·이미지가 업체로 가요 |
| [img2threejs](gamedev-skills-catalog.md#video-img2threejs) 본체 | 발상 참조 → **설치 후보(주인공 소품용)** | TypeScript `THREE.Group` 출력이 빌드 방식과 맞아요 `[추측: 실행 안 함]` | `img2glb` 플러그인은 이미지를 외부 TRELLIS 서비스로 보내서 **보류** |
| [logo-design-skill](gamedev-skills-catalog.md#video-logo-design-skill) | 참조 → **설치 후보** | Python 표준 라이브러리만 쓰고, PNG 변환은 macOS Quick Look 등 있는 도구를 써요 | 카탈로그 대조상 없음 |
| [sprite-gen](gamedev-skills-catalog.md#video-sprite-gen) | 미사용 → **설치 후보(자르기 도구·`pixel-draw`)**, 업체 API 경로는 💳 | 자르기 도구의 Python 의존성은 Pillow·NumPy이고, `pixel-draw`는 Claude 구독 로그인으로 돌아요 | 생성할 때 고른 업체로 프롬프트·그림이 가요 |
| [chrome-devtools-mcp](gamedev-skills-catalog.md#video-chrome-devtools-mcp) | 보유 → **보유 · 끄기 옵션 즉시 필요** | 확인 당시 설정에 끄는 옵션이 없었어요 | [5절](#5-외부-전송과-끄는-법) |
| [mcp-for-blender](gamedev-skills-catalog.md#video-mcp-for-blender)·[blender-skills](gamedev-skills-catalog.md#video-blender-skills) | 미사용 → **보류** | Blender→GLB를 도입할 때만 다시 봐요. `mcp-for-blender`는 영상에서 결함이 늘었어요(22→43, 제작자 주장) | [5절](#5-외부-전송과-끄는-법) |
| `phaser-*`·`pixijs-rendering` 스킬 | 엔진 도입 때만 → **2D 후보로 참조 가능** | npm으로 엔진을 넣기 쉬워졌어요 `[추측]` | 문서라 없음 |

[hallmark](gamedev-skills-catalog.md#video-hallmark)·[taste-skill](gamedev-skills-catalog.md#video-taste-skill)은 판단이 같고(소개 페이지를 만들 때만) 표기를 "보류"로 바꿨어요.

### 등급별 목록

| 등급 | 항목 | 이유 |
|---|---|---|
| **지금 참조**(원문 읽기) | `threejs-game-skills`의 `SKILL.md`·참고 자료 ↻, 카탈로그 three.js 스킬 3개·공통 분야·장르 템플릿, `prototype-fast`·`game-docs`·`game-jam`, `ponytail` 원칙, `img2threejs` 구조 설명, `chrome-devtools-mcp`의 스킬 | 설치 없이 바로 읽어요 |
| **설치 후보(승인)** ↻ | `threejs-game-skills` 코어 6개, `img2threejs` 본체(플러그인 제외), `logo-design-skill`, `sprite-gen`(자르기 도구·`pixel-draw`), Playwright(게임 폴더의 개발 의존성) | 유료 키 없이 쓰는 경로가 있어요. 설치 전에 스크립트와 훅을 감사해요 |
| **유료 후보 💳** ↻ | Tripo, ElevenLabs, xAI, OpenAI 이미지, Gemini API, Together, Anthropic API(`--batch`), Meshy, Rodin, `mcp-for-blender` Premium | [4절](#4-유료-후보-비용표-)을 보고 쓸 때마다 승인받아요 |
| **선택 복사**(출처·라이선스 표기) | `threejs-game-skills` 스캐폴드 구조(MIT) ↻, `game-feel`·`performance-optimization`·`save-systems`·`create-game-assets`의 점검 항목(Apache-2.0, 본문을 읽은 뒤 확정 `[추측]`), 무빌드 게임의 three.js 애드온(MIT) | 필요한 틀만 가져와요 |
| **설정 변경(승인)** | `chrome-devtools-mcp` 끄기 옵션 ↻, Pages 소스를 Actions로 변경(B안을 고를 때만) | 공통 설정과 사이트 전체에 영향이 있어요 |
| **보류** ↻ | `mcp-for-blender`, `blender-skills`, `img2glb` 플러그인, `hallmark`, `taste-skill` | 지금 쓸 곳이 없거나 조건이 필요해요 |
| **쓰지 않음** | `superpowers`(운영 규칙), `godot-ai`와 다른 네이티브 엔진 스킬(엔진이 달라요), `frontend-design`(중복), gamedev-skills 80개 일괄 설치 | 앞 판정을 유지해요 |

### 유료 생성기를 빼면 남는 threejs-game-skills

| 스킬 | 언제 꺼내나 |
|---|---|
| [`threejs-game-director`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-game-director/SKILL.md) | 진입점이에요. 자체 위임(보통 총괄 1 + 작업자 2 이하) 안내가 있어, 우리 분업과 겹치지 않게 **"위임하지 말고 직접 작업"**을 지시해요 |
| [`threejs-gameplay-systems`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-gameplay-systems/SKILL.md) | Vite·TypeScript 스캐폴드, 루프·입력·카메라·충돌 |
| [`threejs-aaa-graphics-builder`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-aaa-graphics-builder/SKILL.md) | 코드로 만드는 모델·재질·셰이더·조명 |
| [`threejs-game-ui-designer`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-game-ui-designer/SKILL.md) | HUD·메뉴·터치 화면 |
| [`threejs-debug-profiler`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-debug-profiler/SKILL.md) | 검은 화면, 로딩, 성능 측정 |
| [`threejs-qa-release`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-qa-release/SKILL.md) | 빌드, 정적 호스팅 경로, 화면 회귀, 자동 플레이 |
| 💳 `threejs-3d-generator`·`threejs-image-generator`·`threejs-audio-generator` | Tripo·Gemini API·ElevenLabs |

스캐폴드를 그대로 쓰지 않고 맞출 곳이 있어요([package.json](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-gameplay-systems/assets/threejs-vite-game/package.json), 2026-11-25 확인).

- three가 `^0.184.0`이라 `0.187.0`으로 고정해요. `@types/three`도 맞춰요.
- `lil-gui`, `@types/node`, `pngjs`, `@types/pngjs`, `@playwright/test`도 들어 있어요. 승인 목록에서 빼려면 그 코드도 함께 빼요.
- TypeScript는 `^6.0.3`이에요. 확인 당시 npm 최신판은 7.0.2라서, 설치 승인 때 버전을 정해 lock 파일에 고정해요.
- `test`가 Playwright이고 `build`가 `tsc && vite build`예요. 아래 시제품 구조의 명령과 달라요.
- 스캐폴드 생성 스크립트는 Python이에요. 실행 전에 감사해요.

## 4. 유료 후보 비용표 💳

가격은 **2026-11-25에 공개 가격 페이지를 읽어 대조한 USD 값**이에요. 바뀔 수 있고 세금은 뺐어요. "1회"는 시제품 한 번(주인공 모델 10개, 그림 50장, 효과음 수십 개)을 가정해 계산했고, 종량제의 "월"은 **그런 시제품을 월 4번** 만든다는 계산 예시예요. 재시도 비용은 넣지 않았어요.

| 도구 → 업체 (근거) | 단가 | 1회 / 월 | 필요 계정·키 | 무료·구독 대안 | 대안 대비 이득 | 승인 |
|---|---|---|---|---|---|---|
| `3d-generator` → **Tripo** ([가격](https://developers.tripo3d.ai/en/pricing)) | 1크레딧=$0.01. 기본 텍스처: 글→3D $0.20, 이미지→3D $0.30(텍스처 없이는 $0.10·$0.20). HD 텍스처 +$0.10. 충전은 $1부터 | 기본 옵션 10개 **$2~3** / 월 $8~12. 스킬 예시·기능을 쓰면 더 늘 수 있어요([아래 정정](#threejs-game-skills-생성기-비용-정정)). 무료 크레딧 [미확인] | `TRIPO_API_KEY` | `img2threejs`(구독 토큰, 영상 기준 시간 4배) · 코드로 직접 모델링 | 텍스처가 있는 GLB를 받아요. 코드로 만들기 어려운 형태에 유리해요 `[추측]` | 💳 필요 |
| (비교) **Meshy** ([가격](https://docs.meshy.ai/en/api/pricing)) | 이미지→3D 2K 텍스처 30크레딧(`meshy-7.1`·`meshy-6`) | 10개 300크레딧. 크레딧의 USD 값, 구독 월 가격과 API에 필요한 요금제 [미확인] | 구독의 API 크레딧 + 키 | 위와 같음 | Tripo 대비 이득 [미확인] | 💳 필요 |
| (비교) **Hyper3D Rodin** ([가격](https://hyper3d.ai/pricing)) | Creator $30/월(약 60개), API는 Business $120/월. 직접 크레딧 $1.5 | API로 쓰면 **월 $120**. 모델당 크레딧 [미확인] | 구독(API는 Business) | 위와 같음 | 품질 이득 [미확인]. API 진입가가 높아요 | 💳 필요 |
| `image-generator` → **Gemini API** ([가격](https://ai.google.dev/gemini-api/docs/pricing)) | ↻ 스킬 스크립트는 **`gemini-3-pro-image-preview` 고정, 새로 만들 때 기본 2K**([아래 정정](#threejs-game-skills-생성기-비용-정정)). 정식 `gemini-3-pro-image` 1K·2K $0.134, 4K $0.24이고 preview 단가가 같다는 것은 `[추측]`. 비교: `gemini-3.1-flash-image` 1K $0.067. 두 정식 모델은 무료 등급 없음 | 50장 2K **약 $6.70** `[추측: preview 단가 동일]` / 월 약 $26.80 | `GEMINI_API_KEY`(결제 연결) | 보조 모델의 이미지 시안(구독) · 에셋 의뢰(이미지 모델은 로컬이 정해요. API 호출이면 과금돼요) | 스킬이 직접 불러 한 작업 안에서 끝나요. 대안 대비 품질 이득 [미확인] | 💳 필요 |
| `audio-generator` → **ElevenLabs** ([가격](https://elevenlabs.io/pricing/api)) | 효과음 $0.12/분, 음악 $0.15/분(파인튠 $1.50). Starter $6/월(요금표상 효과음 150회 또는 음악 40분), 무료(효과음 8회 또는 음악 3분). 둘은 같은 포함량을 나눠 쓰는 것으로 보여요 `[추측]`. 음악 상업 이용은 Starter 이상 | 시제품 **$0~6** / 월 $6(포함량 안일 때). 무료 등급 효과음의 상업 이용 조건 [미확인] | 계정 + `ELEVENLABS_API_KEY` | 에셋 의뢰(Suno 음악, 유료 호출) · Web Audio 합성(효과음, 무료) | 글로 효과음을 만들어요. 음악은 이미 Suno 경로가 있어요 | 💳 필요 |
| `sprite-gen gen --provider openai` → **OpenAI** ([가격](https://developers.openai.com/api/docs/guides/image-generation)) | GPT-Image-2 1024×1024 낮음 $0.006, 중간 $0.053, 높음 $0.211 | 50장 중간 **$2.65** / 월 $10.60. 실제 사용 모델은 실행 때 확인 | `OPENAI_API_KEY` | 보조 모델 이미지 + `sprite-gen` 자르기 도구 | 동작 줄 단위의 캐릭터 일관성 흐름을 써요 `[추측]` | 💳 필요 |
| `sprite-gen --provider codex` → **ChatGPT 로그인** ([가격](https://chatgpt.com/pricing)) | 구독 로그인이면 구독 한도 안에서 써요. **`codex`가 API 키로 로그인돼 있으면 호출마다 과금**([SKILL.md](https://github.com/aldegad/sprite-gen/blob/main/SKILL.md)). 구독 월 가격 [미확인] | 보유 구독 한도 안이면 추가 $0 / 새로 가입하면 월 가격 [미확인] | 로그인한 `codex` CLI. 사용 여부는 운영자가 정해요 | 위와 같음 | 도구의 기본 생성 경로예요 | 💳 필요 |
| `sprite-gen --provider grok`·영상 → **xAI** ([가격](https://docs.x.ai/docs/models)) | 이미지 $0.02부터, 영상 $0.02/초부터. 상위 모델·해상도 단가 [미확인] | 50장 **$1부터** / 월 $4부터. 걷기 영상 4방향×5초는 $0.40부터(상한 [미확인]) | Grok 로그인 또는 `XAI_API_KEY`(로그인이 있으면 우선) | 정지 그림은 보조 모델 이미지 | 영상에서 반복 동작을 뽑는 경로예요. 현재 우리 경로에는 대안이 없어요 | 💳 필요 |
| `sprite-gen pixel-draw --batch` → **Anthropic API** ([가격](https://platform.claude.com/docs/en/about-claude/pricing), [동작](https://github.com/aldegad/sprite-gen/blob/main/docs/pixel-draw.md)) | Opus 5.5 입력 $4·출력 $20(100만 토큰), Batch 50% 할인. 도구의 실제 사용 모델 [미확인] | 토큰 양을 몰라 1회·월 [미확인] | `ANTHROPIC_API_KEY`(`--batch`는 구독이 있어도 API 과금) | **`--batch` 없이 Claude 구독 로그인으로 실행(추가 청구 없음, 구독 한도 사용)** | API 단가의 반값이지만 구독으로 되면 이득이 작아요 | 💳 필요 |
| `hallmark`의 `imagegen.mjs` → **Together AI** ([가격](https://www.together.ai/pricing)) | FLUX.2 dev $0.0154, pro $0.03, Nano Banana 2 $0.047 | 50장 **$0.77~2.33** / 월 $3.08~9.31 | `TOGETHER_API_KEY` | 보조 모델 이미지 | 소개 페이지 흐름 안에서 바로 만들어요. 게임에는 해당 없어요 | 💳 필요 |
| **mcp-for-blender Premium** ([가격](https://www.mcp-for-blender.com/premium)) | Hobby $10/월(일반 25개), Pro $20(일반 25 + 고품질 8), Studio $60(일반 60 + 고품질 30), Max $100 | 일반 10개면 월 $10, 고품질 10개면 **월 $60** | Premium 구독(자기 업체 키를 쓰면 업체에 지불) + Blender | Tripo 직접 호출(기본 옵션 10개 $2~3) | 키 관리가 줄어요. Blender가 필요하고 직접 호출보다 비싸요 | 💳 필요 |

- **하나만 고른다면** Tripo(주인공 모델 몇 개)를 먼저 검토해요. 무료 대안으로 만들기 어려운 것을 채워 준다는 판단이에요 `[추측]`.
- Gemini API 이미지는 기존 이미지 경로와 겹쳐요. 이 스킬의 이미지 스크립트는 에셋 의뢰 경로와 다른 모델로 고정돼 있어요. 더 새로운 이미지 모델의 단가는 같은 가격 페이지에서 쓰기 직전에 확인해요.
- ElevenLabs는 효과음이 많이 필요할 때 무료 등급부터 검토해요.

### threejs-game-skills 생성기 비용 정정

**↻ 2026-11-25 정정**: 앞선 표는 스킬 스크립트가 실제로 쓰는 모델과 옵션을 반영하지 않았어요. 근거 줄은 원본 커밋 `8286774` 기준이에요(설치한 `SKILL.md`는 금지 문구 때문에 줄 번호가 달라요). Tripo 단가는 [가격 페이지](https://developers.tripo3d.ai/en/pricing)를 2026-11-25에 읽은 값이에요.

**이미지**
- 모델이 `gemini-3-pro-image-preview`로 고정돼 있어요([generate_image.py 129행](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-image-generator/scripts/generate_image.py#L129)). 모델을 바꾸는 실행 옵션은 없어요.
- 새로 만들 때 해상도를 안 주면 2K예요([117행](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-image-generator/scripts/generate_image.py#L117)). 기존 그림을 고칠 때는 입력 크기에 따라 1K·2K·4K를 골라요([101~111행](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-image-generator/scripts/generate_image.py#L101)).
- 2K 50장은 50 × $0.134 = **약 $6.70**이에요 `[추측: preview 단가가 정식 모델과 같음]`. 앞선 $3.35는 `gemini-3.1-flash-image` 1K 값이라 이 스크립트에는 해당하지 않아요. 4K면 같은 가정으로 약 $12예요.

**3D(Tripo)**: 앞선 10개 $2~3은 기본 옵션의 모델 생성만 계산한 값이에요.

| 늘어나는 항목 | 단가 | 근거 |
|---|---|---|
| HD 텍스처 / HD 형상 | 모델당 +$0.10 / +$0.20 | 가격 페이지의 추가 옵션. 글→3D 예시 명령은 둘 다 `detailed`예요([SKILL.md 43행](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-3d-generator/SKILL.md#L43)) |
| 자동 리깅 / 동작 적용 | 회당 $0.25 / 동작당 $0.10(리깅 가능 검사는 무료) | 가격 페이지. 스킬의 관찰값(2026년 6월)도 약 25·10크레딧이에요([api-notes.md 111행](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-3d-generator/references/api-notes.md#L111)) |
| 리깅 재시도 | 성공한 재시도마다 약 25크레딧. 캐릭터 일괄 명령의 추가 시도 기본값은 2번 | [api-notes.md 98행](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-3d-generator/references/api-notes.md#L98) · [스크립트 1477행](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-3d-generator/scripts/threejs_3d_asset.py#L1477) |
| 캐릭터 일괄 명령의 기본값 | 동작 3개(idle·walk·run), 텍스처 `detailed`, 형상 `standard` | [1483~1486행](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-3d-generator/scripts/threejs_3d_asset.py#L1483) |

`detailed` 옵션이 가격 페이지의 HD 항목으로 청구된다고 보고 계산하면 이렇게 돼요 `[추측]`. 형식 변환·면 수 제한 같은 후처리와 모델 재생성 비용은 뺐어요.

| 경우 | 모델 1개 | 10개 |
|---|---|---|
| 글→3D 예시 명령(HD 텍스처 + HD 형상) | $0.50 | $5.00 |
| 움직이는 캐릭터, 일괄 명령 기본값, 재시도 없음 | $0.30 + 리깅 $0.25 + 동작 3개 $0.30 = $0.85 | $8.50 |
| 위에서 리깅을 2번 더 하고 모두 청구될 때 | $1.35 | $13.50 |

## 5. 외부 전송과 끄는 법

| 도구 | 기본 동작 | 끄는 법 | 끌 수 없는 전송 |
|---|---|---|---|
| [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp#readme) | **사용 통계 켜짐.** 성능 트레이스 때 CrUX API에 URL을 보낼 수 있어요. 업데이트 확인도 해요 | 실행 인자 `--no-usage-statistics --no-performance-crux`. 통계는 환경변수 `CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS=1`, 업데이트 확인은 `CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS=1` | `npx …@latest`의 패키지 내려받기, 열어 보는 웹페이지의 통신 |
| [mcp-for-blender](https://github.com/ahujasid/mcp-for-blender#telemetry-control) | 익명 사용 기록을 보내요. 프롬프트·코드·화면 캡처는 동의해야만 보내요 | `DISABLE_TELEMETRY=true`(익명 기록까지) | 외부 에셋·생성 기능을 쓰면 해당 업체 호출 |
| [godot-ai](https://github.com/hi-godot/godot-ai#readme) | 익명 텔레메트리 켜짐 | `GODOT_AI_DISABLE_TELEMETRY=true` | 해당 없음(미사용) |
| [threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills#readme) 생성기 | 키를 넣고 쓰면 업체 호출 | 키를 주지 않고, 지시에 "외부 생성 서비스 금지"를 적어요 | 생성에 필요한 프롬프트·이미지 |
| [img2threejs](https://github.com/img2threejs/img2threejs#readme) `img2glb` | 이미지를 외부 TRELLIS 서비스로 보내요 | 플러그인을 설치하지 않아요 | 쓰면 이미지 전송 |
| [sprite-gen](https://github.com/aldegad/sprite-gen#readme) 생성 | 고른 업체로 프롬프트·그림 전송 | 생성하지 않고 자르기 도구만 써요 | 생성에 필요한 전송 |
| [hallmark](https://github.com/nutlope/hallmark#readme) | 만든 페이지가 Wikimedia Commons 사진과 웹 글꼴을 불러올 수 있어요. 키를 넣으면 Together 호출 | 로컬 사진·글꼴을 쓰라고 지시하고 키를 주지 않아요 `[추측]` | 외부 사진을 쓰는 동안의 요청 |
| [taste-skill](https://github.com/Leonxlnx/taste-skill#readme) | 함께 든 사진은 오프라인. 사진·글꼴·아이콘을 더 받을 때 네트워크 사용 | 추가 내려받기를 하지 않아요 | 해당 없음 |

> **지금 필요한 조치(승인 대기)**: 확인 당시 작업 환경의 `chrome-devtools-mcp` 설정에는 위 끄기 인자와 환경변수가 없었어요. 이 설정으로 실행하면 기본값대로 사용 통계가 켜져요. 이 문서 작업에서는 설정을 바꾸지 않았어요.

이 표는 README에 적힌 동작이에요. 실제 네트워크 통신을 관찰해 확인한 것은 아니에요.

## 6. 3D 시제품 최소 세트 (↻ 2026-11-25 재판정)

> **추천안**: **Vite + TypeScript + npm `three@0.187.0`**, 로컬 빌드(A안). 시제품 단계에서는 배포하지 않아요.

- `tsc`가 타입 오류를 실행 전에 잡아서 작업 결과를 검토하기 쉬워요.
- `threejs-game-skills`의 스캐폴드·검증 흐름과 `img2threejs`의 TypeScript 출력을 활용할 수 있어요 `[추측: 실행 안 함]`.
- Pages 설정을 바꾸지 않아 기존 게임에 영향이 없어요.

### 시작 전 승인

```
1. npm 설치 (games/<proto>/ 안): three@0.187.0, @types/three@0.187.0, vite, typescript
   선택: @playwright/test
2. chrome-devtools-mcp 설정에 --no-usage-statistics --no-performance-crux 추가
3. (선택) threejs-game-skills 설치. 안 하면 원문 읽기로 대신해요
```

승인을 받지 못하면 무빌드 방식으로 시작해요. `ocean-world-3d`의 뼈대와 동봉 three.js를 써요.

### 꺼낼 것 5개와 순서

```
① prototype-fast ─▶ ② threejs-gameplay-systems ─▶ ③ threejs-scene-setup ─▶ ④ threejs-debug-profiler ─▶ ⑤ threejs-qa-release
   질문 하나·컷 리스트    스캐폴드 구조·루프·입력       렌더러·조명 대조          검은 화면·느릴 때          경로·화면 검사·자동 플레이
```

1. [`prototype-fast`](gamedev-skills-catalog.md#skill-prototype-fast)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/prototype-fast/SKILL.md)): "답할 질문 하나"와 컷 리스트를 정해요.
2. [`threejs-gameplay-systems`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-gameplay-systems/SKILL.md): 스캐폴드 구조를 가져오고 3절의 "맞출 곳"을 반영해요.
3. [`threejs-scene-setup`](gamedev-skills-catalog.md#skill-threejs-scene-setup)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-scene-setup/SKILL.md)) + [stage.js](../../games/ocean-world-3d/render/core/stage.js): 렌더러·톤매핑·환경광을 대조해요. 조명이 이상하면 [`threejs-materials-lighting`](gamedev-skills-catalog.md#skill-threejs-materials-lighting)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-materials-lighting/SKILL.md))도 열어요.
4. [`threejs-debug-profiler`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-debug-profiler/SKILL.md): 검은 화면이나 느림이 생길 때 열어요.
5. [`threejs-qa-release`](https://github.com/majidmanzarpour/threejs-game-skills/blob/main/skills/threejs-qa-release/SKILL.md): 빌드 경로와 화면을 점검해요. 화면 확인에는 [chrome-devtools-mcp](gamedev-skills-catalog.md#video-chrome-devtools-mcp)(끄기 옵션 적용 후)를 써요.

### 폴더 구조

```
games/<proto>/
├── index.html            # Vite 진입점
├── package.json          # "type":"module", three "0.187.0" 고정
│                         # scripts: dev · build(vite build) · typecheck(tsc --noEmit) · test(node --test test/*.test.ts)
├── package-lock.json     # 커밋. 작업 폴더에서는 npm ci
├── tsconfig.json         # strict, noEmit, allowImportingTsExtensions, erasableSyntaxOnly
├── vite.config.ts        # base: './', build.outDir: 'dist', 작업 폴더마다 다른 포트
├── DESIGN.md             # 1쪽: 질문 하나 · 루프 · 조작 · 컷 리스트
├── src/
│   ├── main.ts
│   ├── core/             # Renderer.ts · Loop.ts · Input.ts
│   ├── sim/              # rules.ts (three import 금지, node --test 대상)
│   └── systems/ · entities/ · ui/
├── test/rules.test.ts
├── tests/smoke.spec.ts   # Playwright를 승인받았을 때만
├── .gitignore            # node_modules/ (시제품 동안에는 dist/도)
└── dist/                 # 배포할 때 .gitignore에서 빼고 커밋(A안). 첫 화면 링크는 games/<proto>/dist/
```

이 구조는 설계안이고 아직 만들어 실행해 보지 않았어요. `node --test`로 바로 돌릴 `.ts`는 import 경로에 `.ts` 확장자를 적어요.

### 담당 나누기

| 담당 | 할 일 |
|---|---|
| `opus` 1 | `DESIGN.md`, 뼈대·설정 파일, `sim`과 화면의 경계를 첫 커밋 |
| `sonnet` 1 | 핵심 조작과 규칙 |
| `sonnet` 2 | 규칙 시험, 타입 검사, 화면 확인(스크린샷·콘솔), 승인받았으면 Playwright |
| `hydrogen` | 색 시안 1~2장(선택) |
| 대기 | 원인 모르는 버그가 나면 `opus`에 디버깅을 맡겨요 |

### 시작 요청문 뼈대

```
작업: games/<proto> 3D 시제품 뼈대. base=main, 전용 worktree·브랜치.
질문 하나: <이 판이 확인할 재미 한 줄>
스택: Vite + TypeScript(strict) + npm three@0.187.0(정확히 고정). 설치는 승인된 목록만.
참조(원문 읽기): threejs-game-skills의 threejs-gameplay-systems(three는 0.187.0으로),
      gamedev-skills의 threejs-scene-setup, games/ocean-world-3d/render/core/{stage,app}.js(톤매핑·Timer).
      threejs-game-director를 쓰더라도 하위 에이전트에 위임하지 말고 직접 작업.
구조: src/sim(three import 금지) · src/core · src/systems · test/*.test.ts · DESIGN.md
완료: typecheck 오류 0 · npm test 통과 · dev 서버 콘솔 오류 0 · 핵심 조작 1개 · 스크린샷 1장 · build 성공
금지: 유료 API·생성기 호출(승인 전), 승인 목록 밖 패키지, Pages 설정 변경, 병합·push, 범위 밖 기능
보고: 바꾼 것 / typecheck·test(명령·통과 수) / build 결과 / 브랜치·커밋 / 스크린샷 경로 / 유료 호출 건수·비용 / 남은 불확실성
```

### 검증 체크리스트

- [ ] `npm run typecheck` 오류 0
- [ ] `npm test` 통과, `src/sim/`이 three를 import하지 않아요
- [ ] dev 서버에서 콘솔 오류 0, 화면을 직접 봤어요(검은 화면 아님, 스크린샷)
- [ ] `npm run build` 성공, `dist/`를 하위 경로의 정적 서버에서 열어도 동작해요
- [ ] `package.json`의 three가 정확히 `0.187.0`이에요(`^` 없음)
- [ ] `chrome-devtools-mcp`를 썼다면 끄기 옵션이 적용돼 있어요
- [ ] 승인 없는 유료 호출 0건(승인받았으면 건수·비용 기록)

### 하지 말 것

- three 버전을 범위(`^`)로 두거나 스캐폴드의 0.184를 그대로 두기
- 승인 없이 생성기·유료 키 쓰기, `--batch`처럼 API로 과금되는 옵션 쓰기
- Pages 소스를 Actions로 바꾸기(사이트 전체에 영향)
- `threejs-game-director`의 자체 위임을 우리 분업과 겹쳐 돌리기
- `superpowers`, 화면을 보지 않고 끝내기, 총괄이 직접 파일 고치기, 승인 없는 병합·push

## 7. 남은 불확실성

- 설치 후보는 README·`SKILL.md`·패키지 정의 일부만 읽었어요. 스크립트와 훅 원문은 감사하지 않았고 설치·실행하지 않았어요.
- 비용표의 `[미확인]` 값과, 1회·월 사용량 가정은 실제와 다를 수 있어요. 구독 한도 소모량도 재지 않았어요.
- 외부 전송은 문서 기준이고, 통신을 관찰하지 않았어요.
- Vite·TypeScript 첫 설정 시간, 빌드 크기, 자동 화면 검사에서 WebGL이 느려지는지는 재지 않았어요 `[추측]`.
- 배포 A안과 B안의 최종 선택, 첫 화면에서 `dist/` 경로를 보여 주는 방법은 정식 배포 때 정해요.
- 카탈로그 80개의 스킬 본문은 읽지 않았어요. 영상 수치는 제작자 주장이고 재현하지 않았어요.
