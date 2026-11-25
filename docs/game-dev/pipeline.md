# 게임 개발 파이프라인

> **5줄 요약 (비전공자용)**
> 1. 게임 만들기를 **기획 → 시제품 → 그림·소리 → 구현 → 시험 → 배포**로 나누고, 단계마다 어떤 AI가 맡을지 정했어요.
> 2. 남이 만든 "요령 문서(스킬)"는 한꺼번에 설치하지 않고, "조명이 검다", "느리다" 같은 상황이 오면 그 문서만 꺼내 읽어요.
> 3. 가장 먼저 꺼내는 것은 이미 써 본 우리 것이에요(바다 3D 게임 코드, 자동 시험, 크롬 점검 도구).
> 4. 설치하거나 돈이 드는 도구는 승인을 받은 뒤에만 쓰고, 영상에서 효과가 없었고 정보를 밖으로 보낼 수 있는 도구는 쓰지 않아요.
> 5. 3D 시제품은 바다 게임의 뼈대를 줄여서 시작하고, 화면을 직접 보고 확인해야 끝난 것으로 쳐요.

- **작성**: 2026-11-25 · 설계안이에요. 이 순서 전체를 새 게임에 적용해 본 적은 아직 없어요.
- **함께 보기**: [스킬 카탈로그](gamedev-skills-catalog.md) · [참고 영상 정리](references/video-skills-13.md)
- **표기**: `[추측]`은 원문을 읽거나 실행해 보지 않은 판단이에요. 영상에서 온 수치는 "제작자 주장"으로 적어요. 스킬 이름은 카탈로그 항목으로, **원문**은 GitHub의 `SKILL.md`로 연결돼요. 카탈로그 80개의 스킬 본문은 아직 읽지 않았어요.

## 0. 전제와 참조 방식

### 바꾸지 않는 전제

| 항목 | 내용 |
|---|---|
| 언어·빌드 | 바닐라 JS(ES Modules). 번들러·TypeScript·npm 런타임 의존성 없이 정적 파일 그대로 배포해요 |
| 3D | three.js **0.187.0**을 저장소에 담고([VENDOR.md](../../games/ocean-world-3d/vendor/three-0.187.0/VENDOR.md), 약 2.1MB) import map으로 불러와요. 담긴 애드온은 `OrbitControls`·`RoomEnvironment`·`BufferGeometryUtils` 3개예요 |
| 구조 | 규칙(`sim/`)을 화면(`render/`·`ui/`)과 나눠 `node --test`로 검사하고, 자동 플레이([sim.js](../../games/ocean-world-3d/tools/sim.js))로 수치를 재요 |
| 에셋 | 대부분 코드로 그려요. 생성 에셋은 에셋 목록(`asset-manifest.yaml`)과 화풍·음악 기준 문서로 관리해요. 이미지는 보조 모델의 시안 또는 [에셋 의뢰](../agent-bridge.md), 음악은 에셋 의뢰(Suno)를 써요 |
| 배포 | GitHub Pages(`main`). 병합과 push는 승인 후에만 해요 |
| 작업 방식 | 총괄 에이전트는 분배와 검토를 맡고, 작업 에이전트가 별도 작업 폴더(git worktree)에서 고치고 시험·커밋해요 |
| 제외 | `superpowers` 흐름, 승인 없는 패키지 설치와 유료 API |

아래의 `opus`·`sonnet`은 Claude 모델, `hydrogen`·`neon`은 보조 모델을 맡은 작업 에이전트의 이름이에요.

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
| 꺼낼 것 | 장르 템플릿 9개 중 해당 1개(2절) · [`game-docs`](gamedev-skills-catalog.md#skill-game-docs)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/game-docs/SKILL.md)) · [`prototype-fast`](gamedev-skills-catalog.md#skill-prototype-fast)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/prototype-fast/SKILL.md)) · 우리 선례: 각 게임 폴더의 `DESIGN.md` |
| 완료 기준 | 루프·조작·승리와 실패·측정할 수치가 적혀 있고, 하지 않을 것(컷 리스트)이 따로 있어요 |
| 주의 | `game-docs`의 `scripts/`는 읽지 않았으니 형식만 참고하고 실행하지 않아요 |

### 1-2. 프로토

| 항목 | 내용 |
|---|---|
| 목표 | 질문 하나에 답하는 플레이 가능한 화면. 그림은 기본 도형이면 돼요 |
| 담당 | 뼈대는 `opus`, 채우기는 `sonnet` |
| 꺼낼 것 | [`prototype-fast`](gamedev-skills-catalog.md#skill-prototype-fast)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/prototype-fast/SKILL.md)) · 3D면 [`threejs-scene-setup`](gamedev-skills-catalog.md#skill-threejs-scene-setup)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-scene-setup/SKILL.md)) · 우리 코드: [stage.js](../../games/ocean-world-3d/render/core/stage.js)(렌더러·톤매핑·환경맵), [app.js](../../games/ocean-world-3d/render/core/app.js)(Timer 루프·녹화 모드), [camera.js](../../games/ocean-world-3d/render/core/camera.js) · 2D면 기존 Canvas 게임의 루프 |
| 완료 기준 | 정적 서버로 열면 콘솔 오류 0, 핵심 조작이 돼요. `sim/` 규칙 시험이 1개 이상 있어요 |
| 주의 | [threejs-game-skills](gamedev-skills-catalog.md#video-threejs-game-skills)·[img2threejs](gamedev-skills-catalog.md#video-img2threejs)는 TypeScript 전제라 그대로 쓰지 않아요. 스킬 예시의 import 경로는 저장소에 담은 three.js 경로로 바꿔 읽어요 |

### 1-3. 아트·사운드 (구현과 병행)

| 항목 | 내용 |
|---|---|
| 목표 | 화풍 기준과 에셋 목록을 정해요. 시제품 판정 전에는 임시 그림을 써요 |
| 담당 | 이미지 시안과 화풍 초안은 `hydrogen`, 검토는 `sonnet`. 일괄 생성과 음악은 [에셋 의뢰](../agent-bridge.md)로 해요(운영자가 시작) |
| 꺼낼 것 | [`create-game-assets`](gamedev-skills-catalog.md#skill-create-game-assets)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md)) · [`audio-design`](gamedev-skills-catalog.md#skill-audio-design)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/audio-design/SKILL.md)) · 아이콘은 [make-icons.mjs](../../games/ocean-world-3d/tools/make-icons.mjs) 선례 |
| 완료 기준 | 게임 폴더에 화풍 기준([예](../../games/ocean-world-3d/docs/art-style.md)), 에셋 목록, `assets/CREDITS.md`가 있어요 |
| 주의 | `sprite-gen`과 `threejs-game-skills`의 생성기는 쓰지 않아요. 의뢰서에 생성 모델을 지정하지 않아요. 공개 저장소에 외부 자료를 넣을 때는 라이선스를 확인해요 |

### 1-4. 구현

| 항목 | 내용 |
|---|---|
| 목표 | 시제품을 게임으로 키워요. 규칙은 `sim/`, 화면은 `render/`·`ui/`에 둬요 |
| 담당 | 명세가 분명하면 `sonnet`. 파일 3개 이상을 바꾸는 구조 변경이나 원인 모르는 버그는 `opus` |
| 꺼낼 것 | 상황마다 1개씩(2절). 자주 쓸 것: [`game-feel`](gamedev-skills-catalog.md#skill-game-feel)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-feel/SKILL.md)) · [`camera-systems`](gamedev-skills-catalog.md#skill-camera-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/camera-systems/SKILL.md)) · [`input-systems`](gamedev-skills-catalog.md#skill-input-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/input-systems/SKILL.md)) · [`game-ui-ux`](gamedev-skills-catalog.md#skill-game-ui-ux)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md)) · [`save-systems`](gamedev-skills-catalog.md#skill-save-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/save-systems/SKILL.md)) · 코드 절제는 [ponytail](gamedev-skills-catalog.md#video-ponytail)([저장소](https://github.com/DietrichGebert/ponytail))의 원칙만 참조 |
| 완료 기준 | 기능마다 시험이 늘고 `npm test`가 모두 통과해요. 작업 브랜치에 커밋해요 |
| 주의 | 새 애드온(`GLTFLoader` 등)은 `vendor/`에 원본 그대로 복사하고 `VENDOR.md`에 sha256을 적어요. npm 런타임 의존성은 만들지 않아요 |

### 1-5. 테스트·튜닝

| 항목 | 내용 |
|---|---|
| 목표 | 규칙이 맞는지, 수치가 재미있는지, 성능이 버티는지 확인해요 |
| 담당 | 시험 작성은 `sonnet`, 명령 실행은 `hydrogen`, 긴 로그의 1차 정리는 `neon` 뒤 결론은 `sonnet`, 출시 전 검토는 `opus` |
| 꺼낼 것 | `node --test` · [sim.js](../../games/ocean-world-3d/tools/sim.js) `--table` · [chrome-devtools-mcp](gamedev-skills-catalog.md#video-chrome-devtools-mcp)(콘솔·스크린샷·성능 트레이스) · [perf-run.mjs](../../games/ocean-world-3d/tools/perf-run.mjs)와 `?perf=1` · [`performance-optimization`](gamedev-skills-catalog.md#skill-performance-optimization)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/performance-optimization/SKILL.md)) |
| 완료 기준 | 시험 통과 수, 측정 표, 성능 수치(프레임 시간·드로우 콜)를 게임 폴더의 보고 문서에 남기고, 화면을 **직접 보고** 확인한 기록이 있어요 |
| 주의 | `chrome-devtools-mcp`는 사용 통계가 기본으로 켜져 있어요. `--no-usage-statistics`·`--no-performance-crux` 적용 여부는 미확인이에요. [capture.mjs](../../games/ocean-world-3d/tools/capture.mjs)는 Playwright가 필요한데, 작성 시점의 작업 폴더에서는 불러올 수 없었어요(설치는 승인 필요) |

### 1-6. 배포

| 항목 | 내용 |
|---|---|
| 목표 | `main` 병합 → GitHub Pages 반영. PWA면 서비스 워커 캐시 버전을 올려요 |
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
| 3D 장면 첫 설정 | [stage.js](../../games/ocean-world-3d/render/core/stage.js)·[app.js](../../games/ocean-world-3d/render/core/app.js) → [`threejs-scene-setup`](gamedev-skills-catalog.md#skill-threejs-scene-setup)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-scene-setup/SKILL.md)) | 보유 → 읽기 |
| 조명이 검다·색이 탁하다 | [`threejs-materials-lighting`](gamedev-skills-catalog.md#skill-threejs-materials-lighting)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-materials-lighting/SKILL.md)) · stage.js의 `NeutralToneMapping`+`RoomEnvironment` | 읽기 · 보유 |
| 그림자 줄무늬·그림자 없음 | [`threejs-materials-lighting`](gamedev-skills-catalog.md#skill-threejs-materials-lighting)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-materials-lighting/SKILL.md)) | 읽기 |
| GLB 모델 넣기 | [`threejs-gltf-loading`](gamedev-skills-catalog.md#skill-threejs-gltf-loading)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-gltf-loading/SKILL.md)) + `GLTFLoader`를 `vendor/`에 추가(MIT) | 읽기 · 복사 |
| 물결·림·디졸브 셰이더 | [`shader-programming`](gamedev-skills-catalog.md#skill-shader-programming)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/shader-programming/SKILL.md)) · [shaderPatches.js](../../games/ocean-world-3d/render/core/materials/shaderPatches.js) · [render/aqua](../../games/ocean-world-3d/render/aqua) | 읽기 · 보유 |
| 사진 한 장으로 3D 모형 | [img2threejs](gamedev-skills-catalog.md#video-img2threejs)([저장소](https://github.com/img2threejs/img2threejs)). 발상만 참고해요 | 읽기 |
| 카메라가 어지럽다·따라가기 | [`camera-systems`](gamedev-skills-catalog.md#skill-camera-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/camera-systems/SKILL.md)) · [camera.js](../../games/ocean-world-3d/render/core/camera.js) | 읽기 · 보유 |
| 타격감이 밋밋하다 | [`game-feel`](gamedev-skills-catalog.md#skill-game-feel)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-feel/SKILL.md)) | 읽기 → 복사 후보 |
| 키·터치 입력이 꼬인다 | [`input-systems`](gamedev-skills-catalog.md#skill-input-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/input-systems/SKILL.md)) · [input.js](../../games/ocean-world-3d/render/core/input.js) | 읽기 · 보유 |
| HUD 배치·해상도 대응 | [`game-ui-ux`](gamedev-skills-catalog.md#skill-game-ui-ux)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md)) | 읽기 |
| 스프라이트 시트 | [`create-game-assets`](gamedev-skills-catalog.md#skill-create-game-assets)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md)) + 보조 모델 이미지 또는 에셋 의뢰 | 읽기 · 보유 |
| 로고·아이콘·파비콘 | [make-icons.mjs](../../games/ocean-world-3d/tools/make-icons.mjs) → [logo-design-skill](gamedev-skills-catalog.md#video-logo-design-skill)([저장소](https://github.com/kaankiziltug/logo-design-skill))의 작은 크기 전용판·사용 규칙 | 보유 → 읽기 · 실행은 승인 |
| 배경음·효과음 | 에셋 의뢰(Suno) · Web Audio 합성 선례 · [`audio-design`](gamedev-skills-catalog.md#skill-audio-design)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/audio-design/SKILL.md)) | 보유 · 읽기 |
| 프레임이 떨어진다 | `?perf=1` → [perf-run.mjs](../../games/ocean-world-3d/tools/perf-run.mjs) → 크롬 성능 트레이스 → [`performance-optimization`](gamedev-skills-catalog.md#skill-performance-optimization)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/performance-optimization/SKILL.md)) · [instancing.js](../../games/ocean-world-3d/render/core/instancing.js)·[batched.js](../../games/ocean-world-3d/render/core/batched.js) | 보유 → 읽기 |
| 메모리 누수 | 크롬 힙 스냅샷 · [memory-leak-debugging](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/main/skills/memory-leak-debugging) 스킬([카탈로그 항목](gamedev-skills-catalog.md#video-chrome-devtools-mcp)) | 보유 · 읽기 |
| 코드가 부풀고 과하게 설계됐다 | [ponytail](gamedev-skills-catalog.md#video-ponytail)([저장소](https://github.com/DietrichGebert/ponytail)) 원칙(필요한 만큼만) · Claude Code의 `/simplify` | 읽기 · 보유 |
| 저장 구조 변경·옛 저장 옮기기 | [`save-systems`](gamedev-skills-catalog.md#skill-save-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/save-systems/SKILL.md)) · [save.js](../../games/ocean-world-3d/sim/save.js)·[save.test.js](../../games/ocean-world-3d/test/save.test.js) | 읽기 · 보유 |
| 밸런스·수치가 이상하다 | [sim.js](../../games/ocean-world-3d/tools/sim.js) `--table` · 장르 템플릿 | 보유 · 읽기 |
| 길찾기·적 AI | [`game-ai`](gamedev-skills-catalog.md#skill-game-ai)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ai/SKILL.md)) · [`ai-behavior-trees-utility-ai`](gamedev-skills-catalog.md#skill-ai-behavior-trees-utility-ai)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/ai-behavior-trees-utility-ai/SKILL.md)) | 읽기 |
| 지형·던전 자동 생성 | [`procedural-gen`](gamedev-skills-catalog.md#skill-procedural-gen)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/procedural-gen/SKILL.md)) · [terrain.js](../../games/ocean-world-3d/render/core/terrain.js) | 읽기 · 보유 |
| 대화·분기 이야기 | [`dialogue-systems`](gamedev-skills-catalog.md#skill-dialogue-systems)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/dialogue-systems/SKILL.md)) · [`visual-novel`](gamedev-skills-catalog.md#skill-visual-novel)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/visual-novel/SKILL.md)) · [prologue-story.js](../../games/ocean-world-3d/ui/prologue-story.js) | 읽기 · 보유 |
| 화면을 안 보고 끝냈다 | 크롬 스크린샷([chrome-devtools-mcp](gamedev-skills-catalog.md#video-chrome-devtools-mcp)) · 녹화 모드 `?capture` | 보유 |

## 3. 도입 등급

영상에서 온 13종의 라이선스·필요 조건·텔레메트리는 [카탈로그 6절](gamedev-skills-catalog.md#video-13)에 있어요.

### 지금 참조만 (원문 읽기)

| 항목 | 이유 |
|---|---|
| three.js 스킬 3개(`threejs-scene-setup`·`threejs-materials-lighting`·`threejs-gltf-loading`) | 카탈로그 설명상 r187·import map 기준이라 우리 버전과 같아요 |
| `prototype-fast`·`game-docs`·`game-jam` | 범위 자르기와 문서 형식만 쓰면 돼요 |
| 장르 템플릿 9개 | 새 장르를 시작할 때 1개씩 읽어요 |
| 공통 기술 분야 15개(`game-feel`·`camera-systems`·`save-systems` 등) | 카탈로그 분류상 개념 위주예요 `[추측]`. 다른 엔진 예시는 JS로 옮겨 읽어요 |
| `ponytail` | 영상에서 코드·시간·비용이 함께 줄었어요(제작자 주장). `hooks/`는 감사 전이라 원칙만 가져와요 |
| `img2threejs`·`logo-design-skill` | 발상만 참고해요. 실행은 TypeScript 출력과 변환 도구 문제로 보류해요 |
| `hallmark`의 `sloplint`·`taste-skill` | 게임센터 소개 페이지를 만들 때만 봐요 |
| `chrome-devtools-mcp`의 스킬 8개 | 도구는 이미 설정돼 있어요. `memory-leak-debugging`·`debug-optimize-lcp`를 필요할 때 읽어요 |

### 선택 복사 후보 (출처·라이선스 표기 필요)

본문을 읽은 뒤에 확정해요 `[추측]`.

| 항목 | 이유 |
|---|---|
| `game-feel`의 점검 항목 | 여러 게임에 다시 쓸 만해요(저장소 라이선스 Apache-2.0) |
| `performance-optimization`의 측정 순서 | `perf-run.mjs` 절차와 합쳐 한 장으로 둘 만해요 |
| `save-systems`의 마이그레이션 절 | `localStorage` 저장 버전을 올리는 규칙의 기준 후보예요 |
| `create-game-assets`의 스프라이트·아이콘 검증 항목 | 화풍 점검표에 넣을 만해요. `scripts/`는 감사 전이라 빼요 |
| three.js 애드온(`GLTFLoader` 등) | MIT. `VENDOR.md` 방식(원본 그대로·sha256)으로만 넣어요 |

### 승인 필요 (설치·유료·설정 변경)

| 항목 | 이유 |
|---|---|
| Playwright | `capture.mjs` 실행에 필요해요 |
| gamedev-skills 플러그인 | 80개를 다 싣는 것은 "필요할 때 꺼내 읽기"와 맞지 않아 지금은 원문 읽기로 해요 |
| `logo-design-skill` 실행 | Python과 SVG→PNG 변환 도구가 필요해요 |
| `img2threejs` 실행 | Node·Python이 필요하고, 시간 4배·비용 4.9배(제작자 주장)에 TypeScript 출력을 옮겨야 해요 |
| 에셋 의뢰(이미지·음악) | 이미 있는 경로지만 유료 호출이 생겨요 |
| `chrome-devtools-mcp`의 끄기 옵션 추가 | 공통 설정 변경이에요 |

### 쓰지 않음

| 항목 | 이유 |
|---|---|
| `superpowers` | 운영 규칙상 제외이고, worktree·서브에이전트 흐름이 우리 분업과 겹쳐요 |
| `mcp-for-blender` | 영상에서 유일하게 "없음"(결함 22→43, 제작자 주장)이었고, 동의하면 프롬프트·화면 캡처까지 보낼 수 있어요 |
| `blender-skills`·`godot-ai` | Blender·Godot를 쓰지 않아요. Blender→GLB를 도입하면 다시 봐요 |
| `threejs-game-skills` | Vite·TypeScript 스캐폴드가 전제이고 생성기 3종은 외부 API 키가 필요해요. 같은 영역은 카탈로그의 three.js 스킬이 더 맞아요 |
| `sprite-gen` | 외부 이미지 생성 계정·API와 여러 실행 파일이 필요하고 기존 경로와 겹쳐요 |
| `frontend-design` | 이미 가진 웹 디자인 지침과 겹쳐요 |
| 다른 엔진 스킬(Godot·Unity·Unreal 등) | 쓰지 않는 엔진이에요 |

## 4. 3D 시제품 최소 세트

### 꺼낼 것 5개와 순서

```
① prototype-fast ─▶ ② ocean-world-3d 코드 ─▶ ③ threejs-scene-setup ─▶ ④ threejs-materials-lighting ─▶ ⑤ chrome-devtools-mcp
   질문 하나로 범위       stage·app·camera         import map 대조           조명 문제가 날 때            화면·콘솔·성능 확인
```

1. [`prototype-fast`](gamedev-skills-catalog.md#skill-prototype-fast)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/prototype-fast/SKILL.md)): 시작 전에 "답할 질문 하나"와 컷 리스트를 정해요.
2. 우리 코드 [stage.js](../../games/ocean-world-3d/render/core/stage.js) · [app.js](../../games/ocean-world-3d/render/core/app.js) · [camera.js](../../games/ocean-world-3d/render/core/camera.js): 이미 r187·무빌드로 동작하는 게임의 뼈대라 출발점으로 삼아요.
3. [`threejs-scene-setup`](gamedev-skills-catalog.md#skill-threejs-scene-setup)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-scene-setup/SKILL.md)): 우리 뼈대와 다른 점만 확인해요.
4. [`threejs-materials-lighting`](gamedev-skills-catalog.md#skill-threejs-materials-lighting)([원문](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-materials-lighting/SKILL.md)): 화면이 검거나 그림자가 깨질 때만 열어요.
5. [chrome-devtools-mcp](gamedev-skills-catalog.md#video-chrome-devtools-mcp)([저장소](https://github.com/ChromeDevTools/chrome-devtools-mcp)): 단계 끝마다 스크린샷 1장과 콘솔 오류 0을 확인해요. 시작 전에 연결되는지부터 봐요.

### 준비물

**폴더 구조** (`ocean-world-3d`를 줄인 모양)

```
games/<proto-name>/
├── index.html          # import map: three, three/addons/ → vendor
├── package.json        # { "type":"module", "scripts":{ "test":"node --test test/*.test.js" } }
├── DESIGN.md           # 1쪽: 질문 하나 · 루프 · 조작 · 컷 리스트
├── vendor/three-0.187.0/   # ocean-world-3d에서 원본 그대로 복사(VENDOR.md·LICENSE 포함)
├── sim/rules.js        # three를 import하지 않는 순수 규칙
├── render/main.js      # 진입점, ?capture · ?perf=1
├── render/stage.js     # ocean-world-3d stage.js를 줄여서
├── ui/hud.js
└── test/rules.test.js
```

`?capture`와 `?perf=1`은 폴더를 만들면 자동으로 생기는 기능이 아니에요. 우리 코드에서 옮겨 와야 해요.

**담당 나누기**

| 담당 | 할 일 |
|---|---|
| `opus` 1 | `DESIGN.md`, 뼈대(index·stage·main·sim 경계) 첫 커밋 |
| `sonnet` 1 | 핵심 조작과 규칙 |
| `sonnet` 2 | `sim/` 시험, 화면 확인(스크린샷·콘솔) |
| `hydrogen` | 색 시안 1~2장(선택), 진행 보고 정리 |
| 대기 | 원인 모르는 버그가 나면 `opus`에 디버깅을 맡겨요 |

**시작 요청문 뼈대**

```
작업: games/<proto-name> 3D 시제품 뼈대. base=main, 전용 worktree·브랜치.
질문 하나: <이 판이 확인할 재미 한 줄>
스택: 바닐라 JS ES Modules, 빌드 없음, three.js 0.187.0을 games/ocean-world-3d/vendor에서 원본 그대로 복사(import map).
참조: games/ocean-world-3d/render/core/{stage,app,camera}.js 를 출발점으로,
      필요하면 gamedev-skills의 threejs-scene-setup SKILL.md(원문 읽기만).
구조: sim/(three 없음, node --test) · render/ · ui/ · test/ · DESIGN.md(1쪽, 컷 리스트 포함)
완료: 정적 서버에서 콘솔 오류 0 · 핵심 조작 1개 동작 · npm test 통과 · 스크린샷 1장
금지: npm 의존성·TypeScript·번들러 추가, 패키지 설치, 유료 API, 병합·push, 범위 밖 기능
보고: 바꾼 것 / 시험(명령·통과 수) / 브랜치·커밋 / 스크린샷 경로 / 남은 불확실성
```

### 검증 체크리스트

- [ ] 게임 폴더에서 `python3 -m http.server`로 열었을 때 콘솔 오류가 0이에요(`file://`로 열지 않아요)
- [ ] 화면을 직접 보고 스크린샷을 남겼어요. 검은 화면이 아니에요
- [ ] `npm test`가 통과하고, `sim/`이 `three`를 import하지 않아요
- [ ] `?perf=1`에서 프레임 시간과 드로우 콜을 한 번 기록했어요
- [ ] 복사한 three.js 파일이 원본과 같아요(`diff -r`로 vendor 폴더 비교. `VENDOR.md`의 sha256은 build 파일 2개에 있어요)
- [ ] `DESIGN.md`의 질문에 답했어요(예·아니오와 이유 한 줄)

### 하지 말 것

- `threejs-game-skills`·`img2threejs`를 설치하거나 TypeScript·Vite로 시작하기
- gamedev-skills 80개 전체 설치, `superpowers` 흐름
- three.js를 CDN에서 불러오거나 다른 버전 섞기
- 그림·모델 생성부터 하기. 시제품은 기본 도형으로 해요
- 화면을 보지 않고 끝내기(영상의 Godot 비교 사례, 제작자 주장)
- 총괄이 직접 파일을 고치기, 승인 없는 병합·push

## 5. 남은 불확실성

- 카탈로그 스킬은 설명(frontmatter)을 바탕으로 골랐고 본문은 읽지 않았어요. 복사 후보는 본문을 읽은 뒤에 정해요.
- 영상 속 13종은 `SKILL.md`·`hooks/`·`scripts/` 원문을 줄 단위로 감사하지 않았어요.
- 영상의 수치(시간·비용 배수, 결함 수)는 제작자 주장이고 재현하지 않았어요.
- `chrome-devtools-mcp`의 통계 끄기 옵션이 적용돼 있는지는 확인하지 않았어요.
- 새 게임마다 three.js를 복사할지(약 2.1MB 중복), `ocean-world-3d`의 것을 함께 쓸지는 정하지 않았어요. 함께 쓰면 저장소 루트에서 서버를 띄워야 하고 게임끼리 묶여요.
