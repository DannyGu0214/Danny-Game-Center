# gamedev-skills 카탈로그

> **조사일**: 2026-11-25  
> **출처 커밋**: [`gamedev-skills/awesome-gamedev-agent-skills@c6ca6c41c839b68319ffc08430b99ab768debc32`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/c6ca6c41c839b68319ffc08430b99ab768debc32) (커밋 시각 2026-11-12T07:38:53Z, 조사일의 `main` 최신)  
> 표의 SKILL.md 링크는 `main`을 가리켜요. 위 커밋과 달라졌을 수 있어요. 별·포크 수는 조사일 값이에요.

> **조사 성격**: 읽기 전용 · 설치/클론 없음 (2026-11-25 기준)  
> **검토(2026-11-25)**: 80개 항목의 이름·URL·`scripts/` 유무는 위 커밋의 파일 트리와 전부 대조했고, 설명은 무작위 10개만 원문 frontmatter와 대조했어요. 나머지 70개 설명은 다시 대조하지 않았어요.  
> **근거**: 각 항목의 설명은 해당 `SKILL.md` 상단 YAML frontmatter(`description`)와 저장소 `git/trees` 구조를 직접 조회해 작성했습니다. 본문 전체 및 `scripts/` 내부 세부 코드는 열람하지 않았습니다.

> **범위**: 1~5절은 `gamedev-skills` 저장소의 80개 항목이에요. [6절](#video-13)은 2026-11-25에 추가한 **영상 소개 스킬·도구 13종**의 저장소 대조예요(같은 날 적합도·도입 등급을 **재판정**했어요). 언제 무엇을 꺼낼지는 [게임 개발 파이프라인](pipeline.md)에 정리했어요.

**목차**: [1. 개요](#1-조직--저장소-개요) · [2. 전체 목록](#2-제공-항목-전체-목록-총-80개-router-1--skills-79) · [3. 추천](#3-우리-쪽-추천) · [4. 다른 저장소](#4-조직의-다른-저장소) · [5. 확인 못 한 것](#5-확인-못-한-것) · [6. 영상 소개 스킬·도구 13종(2026-11-25)](#video-13)

---

## 1. 조직 · 저장소 개요

| 항목 | 내용 | 출처 |
|---|---|---|
| 조직 | `gamedev-skills` — *"Agent Skills that make AI coding agents reliable at game dev. Open & cross-engine."* | [Org API](https://api.github.com/orgs/gamedev-skills) |
| 저장소 | `awesome-gamedev-agent-skills` (별 10,963개 · 포크 1,129개 · 공개 저장소 1개) | [Repo](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) |
| 구성 규모 | **총 80개 항목** (`router` 1개 + 9개 분류 스킬 79개) | [Git Tree API](https://api.github.com/repos/gamedev-skills/awesome-gamedev-agent-skills/git/trees/main?recursive=1) |
| 라이선스 | **Apache-2.0** | [LICENSE](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/LICENSE) |
| 최근 갱신일 | 최근 커밋 `2026-11-12` (`c6ca6c4`) · 엔진 버전 검증 `2026-11-11` (Godot 4.7.2, Unity 6.3 LTS, Unreal 5.8, Phaser 4.2.1, three.js r187 등) | [Commit API](https://api.github.com/repos/gamedev-skills/awesome-gamedev-agent-skills/commits/main), [README](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/README.md) |
| 설치법 (참고용) | • CLI: `npx skills add gamedev-skills/awesome-gamedev-agent-skills` (Node.js 22.20+)<br>• Claude Code: `claude plugin marketplace add gamedev-skills/awesome-gamedev-agent-skills` → `claude plugin install gamedev@awesome-gamedev-agent-skills`<br>• 수동: `.claude/skills/` 또는 `.agents/skills/`에 폴더 복사 | [README](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/README.md) |

---

## 2. 제공 항목 전체 목록 (총 80개: Router 1 + Skills 79)

> **(추정)** `엔진 의존도`와 `쓸 상황` 열은 작성자가 설명을 읽고 분류·의역한 값이에요(원본 저장소의 필드가 아니에요). `개념만`으로 적은 항목도 특정 도구·언어의 코드 예시를 담을 수 있어요.  
> **`scripts/` 보유**: 11개 스킬. 그중 Python 스크립트가 있는 곳은 10개이고, 나머지 1개(`roblox-simulator-economy`)는 Luau예요(`create-game-assets`에는 `requirements.txt`도 있어요).  
>
> **엔진 의존도 표기 기준**: `개념만`(엔진 무관 원리·설계·알고리즘, 일부 타 엔진 예시 포함) / `JS 웹`(three.js·Phaser·PixiJS) / `특정 엔진`(Godot·Unity·Unreal·Roblox 등)

### 2.1 Router (1개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| <a id="skill-router"></a>`router` | 프로젝트 파일로 엔진(12종)과 요청 작업을 판별해 알맞은 스킬을 자동 선택·로드하는 라우터 | 어떤 스킬을 써야 할지 모르거나 게임 개발 요청을 자동 분기할 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/router/SKILL.md) |

### 2.2 Genres — 장르별 설계 템플릿 (9개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| <a id="skill-card-game"></a>`card-game` | 데이터 기반 카드, 단일 효과 이펙트 인터프리터, 덱 존, 트리거 스택, 시드 셔플 설계 | Slay the Spire·Balatro풍 덱빌더/TCG 만들 때, 카드 복제나 편향 셔플을 잡을 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/card-game/SKILL.md) |
| <a id="skill-fps-shooter"></a>`fps-shooter` | 히트스캔 vs 투사체, TTK, 거리별 데미지 감쇠, 반동 패턴, ADS 감도, 지연 보상 피격 판정 | 1인칭 슈팅 전투 설계할 때, 총기 타격감이 약하거나 피격이 안 들어갈 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/fps-shooter/SKILL.md) |
| <a id="skill-platformer"></a>`platformer` | 코요테 타임, 점프 버퍼링, 가변 높이, 낙하 중력, 코너 보정, 벽 점프, 위험물, 체크포인트 | 마리오·셀레스트풍 2D 플랫포머 만들 때, 점프가 붕 뜨거나 답답할 때 | 개념만 | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/platformer/SKILL.md) |
| <a id="skill-puzzle"></a>`puzzle` | 매치-3 연쇄, 소코반 밀기, 유일해 그리드(노노그램·스도쿠), 정확한 Undo, 솔버 검증 | 캔디크러시·소코반·피크로스류 만들 때, Undo 꼬임이나 풀 수 없는 스테이지 방지할 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/puzzle/SKILL.md) |
| <a id="skill-roguelike"></a>`roguelike` | 런(Run) 구조, 영구 죽음, 메타 성장, 시드/데일리 런, 턴 순서, 대칭 시야각(FOV) | 로그라이크/로그라이트 설계할 때, 런 밸런스가 불합리하게 느껴질 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/roguelike/SKILL.md) |
| <a id="skill-rpg"></a>`rpg` | 모디파이어 스택 기반 스탯, 경험치 곡선, 데미지 공식, 장비(슬롯·희귀도·접사), 퀘스트 | JRPG·디아블로풍 RPG 수치/장비 설계할 때, 장비 해제 후 스탯이 꼬일 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/rpg/SKILL.md) |
| <a id="skill-survival-crafting"></a>`survival-crafting` | 채집, 레시피·테크 트리, 소지 무게, 부패도, 허기·체온 욕구, 기지 건설 루프 | 마인크래프트·발헤임·돈스타브풍 제작/생존 루프 설계할 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/survival-crafting/SKILL.md) |
| <a id="skill-tower-defense"></a>`tower-defense` | 레인/미로 경로, 웨이브 페이싱, 타겟 우선순위, 장갑/비행 카운터, 골드 경제 | 블룬즈·킹덤러시풍 타워 디펜스 만들 때, 웨이브 난이도 급변이나 사기 타워 잡을 때 | 개념만 | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/tower-defense/SKILL.md) |
| <a id="skill-visual-novel"></a>`visual-novel` | 분기 루트와 엔딩, 수시 저장, 백로그, 읽은 글만 스킵, 타자기 텍스트 (Ren'Py 또는 범용) | 비주얼 노벨·연애 시뮬레이션 만들 때, 세이브 로드 위치 오류나 엔딩 도달 불가 잡을 때 | 개념만 (Ren'Py 포함) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/genres/visual-novel/SKILL.md) |

### 2.3 Disciplines — 횡단 공통 기술·설계 분야 (15개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| <a id="skill-ai-behavior-trees-utility-ai"></a>`ai-behavior-trees-utility-ai` | 블랙보드, 반응형 컴포지트, 데코레이터, 응답 곡선 스코어링 기반의 범용 BT·유틸리티 AI 코드 | 적이 시야를 잃어도 계속 쫓거나 매 프레임 행동을 재시작·진동할 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/ai-behavior-trees-utility-ai/SKILL.md) |
| <a id="skill-audio-design"></a>`audio-design` | 버스 레이아웃, 데시벨 볼륨 슬라이더, 음량, 대사 중 덕킹, 적응형 음악, SFX 변주 | 사운드 믹싱, 전투 반응형 BGM, 단조로운 발소리·비트 싱크 개선할 때(효과음 파일 생성은 [sunoapi.org](pipeline.md#sfx-sunoapi) 💳 1순위, 대안 ElevenLabs 💳) | 개념만 (Godot/Unity/FMOD 매핑) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/audio-design/SKILL.md) |
| <a id="skill-camera-systems"></a>`camera-systems` | 데드존·선행 시야 2D 추적, 3인칭 오빗, 1인칭 시점, 화면 분할 카메라 튜닝 | 카메라가 덜덜 떨리거나, 맵 밖을 비추거나, 벽을 뚫거나, FPS에 따라 속도가 다를 때 | 개념만 (Godot/Cinemachine 매핑) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/camera-systems/SKILL.md) |
| <a id="skill-create-game-assets"></a>`create-game-assets` | 스타일 가이드, 스프라이트, 픽셀아트, 타일셋, 아이콘, 텍스처 제작·검증 및 라이선스 기록 | 게임 아트 일관성 확보, AI 생성 아트의 가짜 투명도·Steam AI 고지 점검할 때 | 개념만 | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md) |
| <a id="skill-dialogue-systems"></a>`dialogue-systems` | Ink, Yarn Spinner 또는 경량 JSON 그래프 러너 기반 분기 대화·조건·변수·로컬라이징 ID | NPC 대화 트리, 짧은 대사(barks), `.ink`/`.yarn` 연동, 막다른 대화 수정할 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/dialogue-systems/SKILL.md) |
| <a id="skill-game-ai"></a>`game-ai` | FSM·BT·유틸리티·GOAP 선택 기준과 인지(Perception), 스티어링, A* 길찾기 설계 | 순찰·추적 AI, 플레이어 경로 탐색, 모서리 끼임·벽 투시 AI 고칠 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ai/SKILL.md) |
| <a id="skill-game-feel"></a>`game-feel` | 트라우마 기반 화면 흔들림, 히트스톱, 이징 트윈, 스쿼시&스트레치, 넉백 등 타격감(Juice) | 동작은 되는데 게임이 밋밋하거나 가볍고 타격감이 없을 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-feel/SKILL.md) |
| <a id="skill-game-ui-ux"></a>`game-ui-ux` | 앵커·컨테이너, 해상도 스케일링, 세이프 에어리어, 게임패드 포커스, 이벤트 기반 HUD, 접근성 | 메뉴·체력바·인벤토리가 울트라와이드나 모바일에서 깨질 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md) |
| <a id="skill-input-systems"></a>`input-systems` | 명명된 액션, 스틱 데드존, 입력 버퍼링, 충돌 검사가 포함된 키 리바인딩 아키텍처 | 컨트롤러 지원, 키 설정 메뉴, 스틱 드리프트·입력 씹힘 해결할 때 | 개념만 (Godot InputMap 예시) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/input-systems/SKILL.md) |
| `level-design` | 실제 컨트롤러 기준 플레이어 메트릭, 열쇠/능력 게이팅 및 소프트락 검증, 레벨 페이싱 | 레벨 배치, 메트로배니아 게이팅, 플레이어가 길을 잃거나 문 뒤에 열쇠가 놓이는 버그 막을 때 | 개념만 (Godot 검증 포함) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/level-design/SKILL.md) |
| <a id="skill-performance-optimization"></a>`performance-optimization` | CPU vs GPU 병목 측정 후 드로우 콜·오브젝트 풀링·GC 스파이크 등 최대 병목 우선 해결 | FPS 저하, 스터터링, 첫 사용 시 멈춤(hitch) 프로파일링·최적화할 때 | 개념만 (Godot/Unity/UE/Roblox 기준) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/performance-optimization/SKILL.md) |
| `physics-tuning` | 고정 타임스텝과 보간, 터널링 방지 CCD, 감쇠(damping), 솔버 반복 횟수, 충돌 레이어 매트릭스 | 물체가 떨리거나, 빠른 투사체가 벽을 뚫거나, 물리감이 어색할 때 | 개념만 (Godot 검증 포함) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/physics-tuning/SKILL.md) |
| <a id="skill-procedural-gen"></a>`procedural-gen` | 시드 RNG, 던전 레이아웃, WFC(파동 함수 붕괴), 노이즈 지형, 루트 테이블 생성 | 던전 생성기, 펄린 노이즈 지형, 같은 시드에서 다른 맵이 나오는 버그 잡을 때 | 개념만 (Python+Godot/Unity 매핑) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/procedural-gen/SKILL.md) |
| <a id="skill-save-systems"></a>`save-systems` | 직렬화 대상 선정, 슬롯·자동 저장, 원자적 쓰기(atomic write), 버전별 세이브 마이그레이션 | 저장/불러오기·이어하기 구현, 크래시 후 세이브 손상·패치 후 호환 깨짐 막을 때 | 개념만 (Godot/Python 예시) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/save-systems/SKILL.md) |
| <a id="skill-shader-programming"></a>`shader-programming` | 디졸브, 아웃라인, 프레넬 림, 포스트 이펙트의 수학적 원리 및 GLSL ↔ HLSL 포팅 | 셰이더 이펙트 수학 원리가 궁금하거나 모바일 셰이더 깨짐·스펙클 잡을 때 | 개념만 (GLSL/HLSL) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/shader-programming/SKILL.md) |

### 2.4 Workflows — 프로토타이핑 · 문서 · 배포 (5개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| <a id="skill-game-docs"></a>`game-docs` | 코드와 동기화되는 1페이지 GDD, 기능 인덱스, 짧은 기능별 스펙 문서 작성·유지 | GDD 초안 작성, 메카닉 스펙 정리, 플레이테스트 후 문서 동기화할 때 | 개념만 | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/game-docs/SKILL.md) |
| <a id="skill-game-jam"></a>`game-jam` | 잼 규칙 확인, 마감 시간 기준 스코프 조절, 컷 리스트 유지, 제출 전 빌드 점검 | 48시간 게임 잼 참가 시, 일정이 밀려 기능을 쳐내야 할 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/game-jam/SKILL.md) |
| <a id="skill-itch-publish"></a>`itch-publish` | `butler push` 채널 배포, 플랫폼 태그, HTML5 빌드 설정, `--userversion`, CI 자동 업로드 | itch.io에 게임 올릴 때, HTML5 게임이 실행 안 되고 다운로드될 때 | 개념만 (itch butler) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/itch-publish/SKILL.md) |
| <a id="skill-prototype-fast"></a>`prototype-fast` | "이 메카닉이 재밌는가?" 한 가지 질문에 답하는 1시간짜리 일회용 그레이박스 프로토타입 제작 | 새 메카닉을 빠르게 검증하거나 프로토타입 코드를 유지/폐기 판단할 때 | 개념만 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/prototype-fast/SKILL.md) |
| `steam-publish` | SteamPipe 디포, `app_build .vdf`, `steamcmd` 업로드, 베타 브랜치, SetLive, 스토어 검수 | Steam 출시·빌드 업로드, `steamcmd` 오류, Steam Deck Verified 대응할 때 | 개념만 (SteamPipe) | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/workflows/steam-publish/SKILL.md) |

### 2.5 Web Engines — JS 웹 엔진 (6개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| `phaser-core` | Phaser 4(및 3.90) 게임 설정, Scene 생명주기, 로더, 씬 전환, v3→v4 마이그레이션 | Phaser 프로젝트에서 검은 화면, `create` 시 에셋 미정의, HUD 씬 겹침 해결할 때 | JS 웹 (Phaser) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/phaser-core/SKILL.md) |
| `phaser-arcade-physics` | Phaser 4 Arcade Physics 바디, 속도·중력, collider vs overlap, 그룹, 총알 풀링 | Phaser 플랫포머/탑다운 이동, `onFloor()` 항상 false, 벽 통과 해결할 때 | JS 웹 (Phaser) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/phaser-arcade-physics/SKILL.md) |
| `pixijs-rendering` | PixiJS v8 비동기 init, `Assets` 로딩, `Container`/`Sprite` 씬 그래프, 포인터 드래그, v7→v8 | PixiJS 2D 웹 게임에서 빈 캔버스, 클릭 미동작, 드래그 끊김 해결할 때 | JS 웹 (PixiJS) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/pixijs-rendering/SKILL.md) |
| <a id="skill-threejs-scene-setup"></a>`threejs-scene-setup` | plain three.js r187 import map, Scene/Camera/Renderer, `setAnimationLoop`+`Timer`, 리사이즈, `OrbitControls`, `WebGPURenderer` | 빌드 도구 없이 three.js r187 세팅할 때, 모듈 경로 오류·검은 캔버스·애니메이션 정지 해결할 때 | JS 웹 (three.js r187) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-scene-setup/SKILL.md) |
| <a id="skill-threejs-gltf-loading"></a>`threejs-gltf-loading` | three.js r187 `GLTFLoader`, DRACO/Meshopt/KTX2 디코더, `AnimationMixer` 크로스페이드, `SkeletonUtils` 복제 | glTF/GLB 모델이 안 보이거나 너무 작을 때, 디코더 404, 복제본 스켈레톤 공유 버그 잡을 때 | JS 웹 (three.js r187) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-gltf-loading/SKILL.md) |
| <a id="skill-threejs-materials-lighting"></a>`threejs-materials-lighting` | three.js r187 Standard/Physical/Unlit 머티리얼, 라이트, 그림자, HDR 환경광, 톤 매핑 | 메시가 검거나 색이 날아갈 때, 그림자 누락·섀도우 애크니, `EffectComposer` 어두워짐 잡을 때 | JS 웹 (three.js r187) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-materials-lighting/SKILL.md) |

### 2.6 Godot 4.7 (16개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| `godot-2d-movement` | `CharacterBody2D` 플랫포머·탑다운 이동, 경사면, 단방향 플랫폼 | Godot 2D 캐릭터 이동 불가·바닥 뚫림·`is_on_floor()` 오류 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-2d-movement/SKILL.md) |
| `godot-3d-essentials` | `Camera3D`, 라이트, `WorldEnvironment`, `StandardMaterial3D`, `GridMap`, 로컬/글로벌 변환 | Godot 3D 씬이 검거나 빛바래고 회전축이 어긋날 때 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-3d-essentials/SKILL.md) |
| `godot-animation` | `AnimationPlayer`, `AnimationTree` 상태머신, `AnimatedSprite2D`, `create_tween()` | Godot 애니메이션 미재생·트윈 튕김·`Animation not found` 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-animation/SKILL.md) |
| `godot-audio` | `AudioStreamPlayer` 2D/3D, 버스, `AudioServer` 볼륨·음소거, 루프, 비트 싱크 재생 위치 | Godot에서 SFX·BGM·볼륨 슬라이더 연결 및 무음/끊김 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-audio/SKILL.md) |
| `godot-csharp` | Godot C#/.NET partial 클래스, `[Export]`/`[Signal]`, C# 이벤트 시그널, `.csproj` | Godot에서 `.cs` 스크립트 작성, GDScript 포팅, C# 웹/안드로이드 빌드 실패 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-csharp/SKILL.md) |
| `godot-export` | 데스크톱·웹·안드로이드 익스포트 템플릿, `export_presets.cfg`, CLI 빌드, 웹 COOP/COEP 헤더 | 템플릿 누락·빈 웹 빌드·`SharedArrayBuffer` 오류 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-export/SKILL.md) |
| `godot-gdscript` | GDScript 2.0 정적 타이핑, `@export`/`@onready`, `await` 코루틴, 3.x 포팅 | `.gd` 파싱 오류, 코루틴 멈춤, `@onready` null 오류 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-gdscript/SKILL.md) |
| `godot-gdscript-headless-testing` | `godot --headless` + 실패 시 non-zero 종료하는 `SceneTree` 테스트 러너 | GitHub Actions 등 CI에서 Godot 자동화 테스트 돌릴 때 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-gdscript-headless-testing/SKILL.md) |
| `godot-multiplayer` | ENet 호스트/조인, `@rpc`/`rpc_id()`, `MultiplayerSpawner`/`Synchronizer` | Godot 온라인/LAN 협동 멀티플레이 및 RPC·동기화 오류 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-multiplayer/SKILL.md) |
| `godot-nodes-scenes` | `.tscn` 재사용, `instantiate()`, 오토로드, 깨진 `res://`·`uid` 검사기 | 총알/적 스폰, 파일 이동 후 씬 깨짐·`Node not found` 해결 시 | 특정 엔진 | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-nodes-scenes/SKILL.md) |
| `godot-physics` | 2D/3D Body·Area, `collision_layer`/mask, RayCast, Jolt(4.6+ 기본) | Godot 충돌 누락, `body_entered` 미발생, 레이캐스트 자가 충돌 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-physics/SKILL.md) |
| `godot-resources` | 커스텀 `Resource`, `.tres`, 공유 참조 vs `duplicate_deep()`, 스레드 로딩 | 아이템·스탯 데이터화 및 리소스 수정 시 모든 인스턴스가 바뀌는 버그 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-resources/SKILL.md) |
| `godot-shaders` | Godot 셰이딩 언어(`canvas_item`/`spatial`/particle), `ShaderMaterial`, 헤드리스 컴파일 체크 | `.gdshader` 작성 및 `SHADER ERROR`·렌더 정렬 오류 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-shaders/SKILL.md) |
| `godot-signals-groups` | 타입 지정 시그널, `Callable` 연결, 이벤트 버스 오토로드, `call_group` | 노드 간 결합도 낮추기 및 시그널 중복·미발생 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-signals-groups/SKILL.md) |
| `godot-tilemap` | `TileMapLayer`·`TileSet`, 아틀라스, 데이터 레이어, 지형 오토타일링, 런타임 `set_cell` | Godot 2D 타일 레벨, 충돌 누락, 구형 `TileMap` 포팅 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-tilemap/SKILL.md) |
| `godot-ui-control` | `Control` 앵커, 컨테이너, Theme/StyleBox, 포커스 이웃, 스트레치 설정 | Godot UI 겹침·리사이즈 밀림·게임패드 포커스 무시 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-ui-control/SKILL.md) |

### 2.7 Unity 6.3 LTS (9개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| `unity-animation` | Animator 상태·전이, 블렌드 트리, Avatar Mask 레이어, 루트 모션, 휴머노이드 IK | `SetTrigger` 연동, 전이 지연, 루트 모션 미끄러짐 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-animation/SKILL.md) |
| `unity-build-pipeline` | Build Profiles, IL2CPP vs Mono, `link.xml` 스트리핑, `BuildPlayer` 스크립팅, Addressables | Unity 빌드 자동화 및 빌드 후 `MissingMethodException` 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-build-pipeline/SKILL.md) |
| `unity-build-size` | Build Report 분석, 비압축 텍스처, glTFast 모델, PCM 오디오 등 플랫폼별 용량 축소 | APK/AAB/WebGL/Steam 빌드 용량 초과 시 | 특정 엔진 | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-build-size/SKILL.md) |
| `unity-csharp-scripting` | `MonoBehaviour` 생명주기, 직렬화, `.meta`/GUID 규율, CLI 테스트 | `.cs` 파일 생성·이름 변경, `Missing script`, 인스펙터 필드 누락 시 | 특정 엔진 | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-csharp-scripting/SKILL.md) |
| `unity-input-system` | `.inputactions`, 액션 맵, `PlayerInput`, 컨트롤 스킴, 구형 `Input` 포팅 | Unity 입력 미동작·메뉴 뒤 입력 통과·`FindAction` null 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-input-system/SKILL.md) |
| `unity-navmesh` | `NavMeshSurface` 베이크, `NavMeshAgent`, `NavMeshLink` 점프, 런타임 리베이크 | Unity 적 추적/순찰, 에이전트 정지·워프·부분 경로 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-navmesh/SKILL.md) |
| `unity-physics` | 3D/2D Rigidbody, 힘/`linearVelocity`, 레이어 충돌 매트릭스, 레이캐스트 | 물체 바닥 뚫림, `OnTriggerEnter` 미발생, 레이캐스트 자가 충돌 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-physics/SKILL.md) |
| `unity-scriptableobjects` | `CreateAssetMenu` 설정 에셋, 공유 런타임 변수, 이벤트 채널, 코드 기반 `.asset` 생성 | 싱글톤 대체, 데이터 기반 아이템·카드 구현, Play 모드 종료 후 값 유지 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-scriptableobjects/SKILL.md) |
| `unity-tilemap-2d` | Tile Palette, Tilemap Collider 2D+Composite Collider, Rule Tiles, 런타임 `SetTile` | Unity 2D 타일맵 페인팅, 타일 간 충돌 틈새, 헥스·아이소메트릭 그리드 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-tilemap-2d/SKILL.md) |

### 2.8 Unreal Engine 5.8 (6개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| `unreal-behavior-trees` | Behavior Trees, Blackboards, EQS, StateTree, Observer Aborts, C++ `BTTask` | UE 적 AI(`BT_`/`BB_`/`EQS_`), AI 정지·`MoveTo` 실패 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unreal/unreal-behavior-trees/SKILL.md) |
| `unreal-blueprints` | Blueprint Classes vs Level Blueprint, Event Graph, Cast, Interfaces, Event Dispatchers | BP 간 통신, `cast failed`, 느린 Event Tick, 컴파일 오류 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unreal/unreal-blueprints/SKILL.md) |
| `unreal-cpp-gameplay` | `UCLASS`/`UPROPERTY` 리플렉션, Gameplay Framework, GC 안전 포인터, `Build.cs` | `GENERATED_BODY`, Live Coding, 링크·UHT 오류 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unreal/unreal-cpp-gameplay/SKILL.md) |
| `unreal-enhanced-input` | Input Actions(`IA_`), Mapping Contexts(`IMC_`), `ETriggerEvent`, 키 리바인딩 | UE 이동/시점/발사 입력 연결 및 리스폰 후 입력 끊김 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unreal/unreal-enhanced-input/SKILL.md) |
| `unreal-niagara` | Niagara 시스템/이미터, User 파라미터, C++/BP 스폰, 바운즈, GPU vs CPU 시뮬레이션 | UE 파티클(`NS_`), 화면 가장자리 소멸·영구 잔류 오류 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unreal/unreal-niagara/SKILL.md) |
| `unreal-packaging` | Shipping 빌드, 쿠킹, pak/IoStore, `RunUAT BuildCookRun` 및 UAT/cook 로그 분석 | 패키징된 게임 검은 화면·맵 누락·`BUILD FAILED` 해결 시 | 특정 엔진 | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unreal/unreal-packaging/SKILL.md) |

### 2.9 Ebitengine (1개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| `ebitengine-game` | Go Ebitengine v2 2D 게임 루프, 입력, 픽셀아트 스케일링, 텍스트, 오디오, 데스크톱/WASM/모바일 빌드 | `go.mod`에 `ebiten/v2` 사용 시, 흐린 픽셀아트·입력 누락·스터터링 해결 시 | 특정 엔진 (Go) | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/ebitengine/ebitengine-game/SKILL.md) |

### 2.10 Other Engines — Bevy · Defold · LÖVE · pygame · Roblox (12개)

| 이름 | 한 줄 설명 | 쓸 상황 | 엔진 의존도 | 스크립트 유무 | SKILL.md URL |
|---|---|---|---|---|---|
| `bevy-ecs` | Rust Bevy 0.20 컴포넌트, `Query`/`Commands`, 스케줄, States, 옵저버, 헤드리스 테스트 | `Cargo.toml`에 `bevy` 사용 시, `B0001` 쿼리 충돌 패닉·구버전 마이그레이션 시 | 특정 엔진 (Rust) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/bevy-ecs/SKILL.md) |
| `defold-core` | Defold 1.14 Lua 컬렉션, 게임 오브젝트, 입력 포커스, `msg.post`, 팩토리, 프록시, Bob 빌드 | `.collection`/`.script` 작업, `on_input` 미호출, 메시지 디스패치 오류 시 | 특정 엔진 (Lua) | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/defold-core/SKILL.md) |
| `love2d-core` | LÖVE 11.x `main.lua` 콜백, `conf.lua`, 고정 스텝, 픽셀아트 스케일링, `love.filesystem` 저장 | `love.*` 기반 Lua 게임에서 흐린 픽셀아트·프레임레이트 종속 속도 해결 시 | 특정 엔진 (Lua) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/love2d-core/SKILL.md) |
| `pygame-core` | Python `pygame-ce` 이벤트-업데이트-드로우 루프, 델타 타임, `Surface`/`Rect`, 스프라이트 그룹 | `import pygame` 2D 게임에서 창 응답 없음·PC별 속도 차이 해결 시 | 특정 엔진 (Python) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/pygame-core/SKILL.md) |
| `roblox-characters` | Roblox `CharacterAdded`, `Humanoid`/`HumanoidRootPart`, R6/R15/커스텀 리그, 리스폰, Tools | 리스폰 후 캐릭터 스크립트 깨짐·애니메이션 미복제 해결 시 | 특정 엔진 (Luau) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/roblox-characters/SKILL.md) |
| `roblox-datastores` | `DataStoreService` 접속 로드, 퇴장/`BindToClose` 저장, `UpdateAsync`, 세션 락, 리더보드 | 데이터 유실·텔레포트 후 아이템 복사·요청 초과 오류 해결 시 | 특정 엔진 (Luau) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/roblox-datastores/SKILL.md) |
| `roblox-luau` | Luau 서비스, `Instance`, Script/LocalScript/ModuleScript, `task` 라이브러리, 타입 체크 | `LocalScript` 미실행·클라이언트 `nil` 참조·구형 `wait()` 교체 시 | 특정 엔진 (Luau) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/roblox-luau/SKILL.md) |
| `roblox-networking` | `RemoteEvent`/`RemoteFunction` 규약, 서버 권한, 레이트 리밋, 피격 검증, 복제 | 원격 호출 악용·익스플로잇 차단·피격 판정 오류 해결 시 | 특정 엔진 (Luau) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/roblox-networking/SKILL.md) |
| `roblox-physics` | 어셈블리, 컨스트레인트, 충돌 그룹, `Raycast`/`Shapecast`, 네트워크 소유권 | 파트 바닥 뚫림/떨림·`Touched` 불안정·구형 `BodyMover` 교체 시 | 특정 엔진 (Luau) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/roblox-physics/SKILL.md) |
| `roblox-simulator-economy` | 시뮬레이터/타이쿤/방치형 업그레이드 비용 곡선, 초당 수익, 환생 페이싱, 큰 수 포맷, 확률 | `baseCost`/환생 수치 밸런싱 및 무과금/유료 재화 경제 설계 시 | 특정 엔진 (Luau/Lune) | 있음 (`scripts/`) | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/roblox-simulator-economy/SKILL.md) |
| `roblox-studio-workflow` | 기존 `.rbxl` 또는 Rojo 프로젝트 안전 수정 및 테스트 모드/Studio MCP(`execute_luau`) 검증 | Roblox Studio MCP나 Rojo 프로젝트 작업 시 검증 절차 준수용 | 특정 엔진 (Luau) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/roblox-studio-workflow/SKILL.md) |
| `roblox-ui` | `ScreenGui`/`PlayerGui`, `ResetOnSpawn`, `UDim2`, `UIListLayout`, 세이프 에어리어, StyleSheet | 모바일 UI 잘림·리스폰 시 UI 초기화·컨트롤러 포커스 손실 해결 시 | 특정 엔진 (Luau) | 없음 | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/other-engines/roblox-ui/SKILL.md) |

---

## 3. 우리 쪽 추천

> **(추정)** 이 절은 frontmatter 설명만 보고 고른 추천이에요. 스킬 본문을 읽거나 우리 코드에 적용해 본 결과가 아니에요.

### 3.1 향후 여러 장르 게임을 만들 때 먼저 볼 스킬 조합

| 목표 장르 | 1순위로 볼 장르 스킬 | 함께 조합할 공통(Disciplines) 스킬 |
|---|---|---|
| **퍼즐 / 그리드** | `puzzle` | `game-feel` (연쇄/클리어 타격감), `game-ui-ux` (HUD/모바일 대응), `audio-design` |
| **2D 플랫포머 / 액션** | `platformer` | `camera-systems` (데드존·선행 카메라), `game-feel` (히트스톱·화면 흔들림), `level-design`, `input-systems` |
| **로그라이크 / 던전** | `roguelike` | `procedural-gen` (시드 던전·루트 테이블), `save-systems` (런/메타 세이브 분리), `game-ai` |
| **RPG / 성장형** | `rpg` | `dialogue-systems` (분기 대화), `save-systems`, `game-ui-ux` (인벤토리/스탯창) |
| **타워 디펜스 / 전략** | `tower-defense` | `game-ai` (경로/타겟팅), `performance-optimization` (다수 유닛 풀링/드로우 콜) |
| **카드 / 덱빌더** | `card-game` | `game-ui-ux` (핸드/카드 UI), `game-feel` (카드 드로우·타격 연출), `save-systems` |
| **서바이벌 / 크래프팅** | `survival-crafting` | `procedural-gen` (노이즈 지형), `save-systems`, `game-ui-ux` |
| **FPS / 슈팅** | `fps-shooter` | `camera-systems` (1인칭 시점), `physics-tuning` (CCD 터널링 방지), `game-feel`, `audio-design` |
| **비주얼 노벨 / 스토리** | `visual-novel` | `dialogue-systems`, `audio-design` (대사 덕킹·적응형 음악), `save-systems` |

### 3.2 현재 우리 스택(Vanilla JS 캔버스 2D 5종 + three.js 0.187.0 `ocean-world-3d`, 빌드 도구 없음. 중단된 `animal-world-v2`는 PixiJS 8.22.0이라 여기서 뺐어요)에 바로 쓰는 것

1. **three.js r187 직접 적용 (`ocean-world-3d`와 버전·구조 일치)**
   - `threejs-scene-setup`: **import map 기반 + r187 핀 고정**이라 빌드 도구 없는 우리 `ocean-world-3d` 구조와 직접 맞을 것으로 보여요(추정). (`setAnimationLoop` + `Timer`, 리사이즈, `OrbitControls` 포함)
   - `threejs-materials-lighting`: 톤 매핑, 그림자 아티팩트(acne) 디버깅에 참조할 수 있어요. 수면/수중 라이팅에 도움이 되는지는 추정이에요(설명에는 없어요).
   - `threejs-gltf-loading`: 향후 3D 모델(선박·어류·지형 GLB) 추가 시 `GLTFLoader`, 디코더, `AnimationMixer`, `SkeletonUtils` 복제 버그 방지에 유용.
   - `shader-programming`: GLSL 기반이라 WebGL / three.js 커스텀 셰이더(물결·프레넬·디졸브 등) 수학 원리에 참조할 수 있어요. 설명에 있는 건 디졸브·아웃라인·프레넬 계열이고, 물결 적용은 추정이에요.
2. **Vanilla JS 캔버스 2D 게임 5종에 개념·알고리즘으로 바로 이식 가능한 것**
   - `game-feel` (트라우마 스크린 셰이크, 히트스톱, 이징, 스쿼시&스트레치), `camera-systems` (2D 데드존·선행 추적), `physics-tuning` (고정 타임스텝·보간·터널링 방지), `input-systems` (액션 매핑·입력 버퍼), `game-ui-ux` (해상도 대응·이벤트 기반 HUD), `save-systems` (슬롯·버전 마이그레이션 설계. 예시는 Godot·Python이라 localStorage 이식은 추정), `game-ai` & `ai-behavior-trees-utility-ai` (FSM/A*/BT 패턴), `procedural-gen` (시드 RNG·노이즈·던전), `audio-design` (볼륨 커브·SFX 변주), `create-game-assets` (에셋 일관성·QA·라이선스 기록).
   - `prototype-fast`, `game-jam`, `itch-publish`, `game-docs` (프로토타입·문서화·HTML5 웹 배포 체크).
   - *(참고: `phaser-*`, `pixijs-rendering`은 JS 웹이지만 별도 엔진 라이브러리 도입 시에만 참조)*

---

## 4. 조직의 다른 저장소

- 없음 (`https://api.github.com/orgs/gamedev-skills` 기준 `public_repos: 1`로, `awesome-gamedev-agent-skills`가 유일한 공개 저장소입니다).

---

## 5. 확인 못 한 것

- **각 `SKILL.md` 본문 전체 및 `scripts/` 내부 개별 스크립트 내용**: 이번 카탈로그의 설명·쓸 상황은 80개 `SKILL.md`의 frontmatter(`description`)와 `git/trees`의 `scripts/` 폴더 존재 여부만 확인해 정리했습니다. 실제 구현 코드 패턴이나 계산기/체커 스크립트의 구체적 사용법은 추후 해당 스킬을 선택해 본문을 읽어야 확인할 수 있습니다.
- **비공개 저장소 여부**: 확인한 건 조직의 `public_repos` 값(1)뿐이에요.
- **버전 검증**: 엔진 버전과 확인 날짜(2026-11-11)는 원본 README의 주장이고, 우리가 실행해 확인한 게 아니에요.

---

<a id="video-13"></a>

## 6. 영상 소개 스킬·도구 13종(2026-11-25)

> **출처**: [YouTube 영상 요약과 타임스탬프](references/video-skills-13.md) · 각 저장소(2026-11-25 대조). 이 13종은 위 80개 목록에 들어 있지 않아요.  
> **확인 범위**: GitHub 메타데이터·README·파일 트리와 웹 검색에 색인된 문서를 대조했어요. `SKILL.md`·`hooks/`·`scripts/` 원문을 줄 단위로 읽지 않았고, 설치하거나 실행하지 않았어요. 도입하기 전에는 원문을 직접 감사해야 해요.  
> **우리 적합도 기준(↻ 2026-11-25 재판정)**: 기존 게임은 무빌드 바닐라 JS를 유지하고, **새 게임은 빌드·TypeScript를 허용**해요. 유료 도구는 비용과 대안을 비교해 후보에 넣고 쓸 때마다 승인받아요(💳). 외부 전송은 끄거나 명시해요. 이미지(Gemini 계열)·음악(Suno) 생성 경로와 여러 AI 에이전트 분업은 그대로예요. 표의 `전 → 후`와 ↻ 표시가 바뀐 곳이에요.  
> **도입 등급**: `참조`(원문을 읽고 요점만 적용) · `설치 후보`(설치는 승인 필요) · `보유`(이미 설정돼 있음) · `보류`(조건이 생기면 다시 검토) · `미사용`. 유료 값은 [pipeline.md의 비용표](pipeline.md#4-유료-후보-비용표-)에 있어요. 단계별로 언제 꺼내는지는 [pipeline.md](pipeline.md)에 있어요.

| 이름 | 저장소 | 라이선스 | 무엇 | 필요 조건 | 텔레메트리·네트워크 | 우리 적합도 (전 → 후) | 도입 등급 (전 → 후) |
|---|---|---|---|---|---|---|---|
| <a id="video-img2threejs"></a>`img2threejs` | [img2threejs/img2threejs](https://github.com/img2threejs/img2threejs) | Apache-2.0 | 사진 1장을 코드로 만든 three.js 3D 모델(`THREE.Group`)로 바꾸는 파이프라인. 스킬 1개 | Node 18+, Python 3.10+(표준 라이브러리만), Git. 외부 계정·유료 API 없음 | 텔레메트리 없음. 검수에 로컬 브라우저 렌더 사용 | 중 → **중상** ↻. 출력이 TypeScript라 빌드 방식에 방식상 맞아요 `[추측]`. 시간이 커서 소품 하나씩 맡겨요 | 참조(발상만) → **설치 후보(승인, 본체만)** ↻. 플러그인 `img2glb`는 보류 |
| <a id="video-threejs-game-skills"></a>`threejs-game-skills` | [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) | MIT | three.js 게임 기획~QA·배포 스킬 9개 + Vite·TS 스캐폴드 | Node(Vite·TS·Playwright), Python(스캐폴드). 선택 생성기 3종은 외부 API 키 필요(Tripo·Gemini·ElevenLabs) | 코어 텔레메트리 없음. 생성기를 쓰면 외부 API 호출 | 하 → **상** ↻. Vite·TypeScript가 더는 걸림돌이 아니에요. 키 없이 6개 스킬이 남아요 | 미사용 → **참조 1순위 · 설치 후보(승인)** ↻. 생성기 3종은 유료 후보 💳 |
| <a id="video-godot-ai"></a>`godot-ai` | [hi-godot/godot-ai](https://github.com/hi-godot/godot-ai) | MIT | 실행 중인 Godot 편집기를 제어하는 MCP 서버·애드온(도구 46개) + 검증 스킬 1개 | Godot 4.7+, `uv`. 외부 계정·유료 API 없음 | **익명 텔레메트리 기본 켜짐.** `GODOT_AI_DISABLE_TELEMETRY=true` 또는 `DISABLE_TELEMETRY=true`로 꺼요 | 하(유지). Godot를 쓰지 않아요 | 미사용(유지) |
| <a id="video-logo-design-skill"></a>`logo-design-skill` | [kaankiziltug/logo-design-skill](https://github.com/kaankiziltug/logo-design-skill) | MIT | 브리핑·시안·보정·SVG·브랜드 가이드까지의 로고 스킬 1개 + SVG 참고 자료 1,400개 이상 | Python 3.8+ **와 SVG→PNG 변환 도구**(CairoSVG·Inkscape·`rsvg-convert`·headless Chrome 중 하나) | 텔레메트리·외부 호출 없음 | 중 → **상** ↻. 아이콘·로고용. 맥 기본 기능으로 PNG 변환이 될 것으로 보여요 `[추측: 실행 안 함]` | 참조 → **설치 후보(승인)** ↻ |
| <a id="video-sprite-gen"></a>`sprite-gen` | [aldegad/sprite-gen](https://github.com/aldegad/sprite-gen) | Apache-2.0 | 캐릭터 그림 1장에서 상태별 애니메이션 프레임과 아틀라스를 만드는 스킬 1개 + Python CLI | Python venv, FFmpeg, Node.js, `img2webp`, `rife-ncnn-vulkan`(보간) + **이미지 생성용 외부 계정·API**(ChatGPT·Codex, Grok·`XAI_API_KEY`, `OPENAI_API_KEY` 중) | 자체 텔레메트리 없음. 이미지 생성 때 외부 호출 | 하 → **중** ↻. 구독 로그인 경로와 무료 자르기 도구가 있어요 | 미사용 → **설치 후보(승인): 자르기 도구·`pixel-draw`** ↻. 업체 API 경로는 💳 |
| <a id="video-blender-skills"></a>`blender-skills` | [EL4CTEO/blender-skills](https://github.com/EL4CTEO/blender-skills) | MIT | Blender 모델링부터 익스포트·QA까지 스킬 28개 | Blender 5.2 LTS+(5.3 검증 권장). 외부 계정·유료 API 없음 | 텔레메트리·외부 호출 없음(로컬 실행) | 하(유지). Blender를 쓰지 않아요 | 미사용 → **보류** ↻. Blender→GLB 도입 때 재검토 |
| <a id="video-mcp-for-blender"></a>`mcp-for-blender` | [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender) | MIT | Blender를 실시간 제어하는 커뮤니티 MCP 서버·애드온. `SKILL.md` 없음 | Blender + `addon.py` + Python·`uvx`. 일부 외부 3D 생성 연동은 계정·유료 키 필요 | **기본으로 익명 사용 기록**(설치 ID·도구 이름·성공 여부·OS 등)을 보내요. 프롬프트·코드·화면 캡처는 동의해야만 보내요. `DISABLE_TELEMETRY=true`로 전부 꺼요. 외부 에셋 API 호출 | 하(유지). Blender 미사용, 영상 판정 "없음"(제작자 주장) | 미사용 → **보류(조건부 후보)** ↻. Premium은 💳 |
| <a id="video-frontend-design"></a>`frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Apache-2.0(스킬 폴더의 `LICENSE.txt`. 저장소 루트 표기는 없음) | Anthropic의 웹 UI 디자인 지침. 저장소 스킬 20개 중 1개 | 런타임·계정·유료 API 없음 | 없음 | 중·중복(유지). 가진 웹 디자인 지침(`artifact-design`)과 겹쳐요 | 미사용(유지) |
| <a id="video-taste-skill"></a>`taste-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | 템플릿 티를 줄이는 랜딩 디자인 스킬 1개 + 브라우저 검사·사진 수집 스크립트 | **Node 22+**, Chrome·Edge·Chromium, `ffmpeg`(선택). API 키 없음 | 텔레메트리 없음. 사진·아이콘 수집 때 Wikimedia·Openverse·The Met·jsDelivr 등 호출 | 중(유지). 게임 화면이 아닌 소개 페이지용 | 참조(소개 페이지만) → **보류(소개 페이지를 만들 때)** ↻ 표기 |
| <a id="video-hallmark"></a>`hallmark` | [nutlope/hallmark](https://github.com/nutlope/hallmark) | MIT | AI 티를 줄이는 웹 디자인 스킬 1개(테마 50개) + `sloplint.mjs` 린터 | Node 18+. `--render` 검사는 전역 `puppeteer-core` + Chrome 추가. 선택 `imagegen.mjs`는 유료 `TOGETHER_API_KEY` | 텔레메트리 없음. 생성한 페이지가 Wikimedia 사진·Google Fonts를 불러와요. 키를 설정하면 Together AI 호출 | 중(유지). 소개 페이지용. 설치하면 편집 때 도는 훅을 넣는 스크립트가 있어 감사가 필요해요 | 참조(소개 페이지만) → **보류(소개 페이지를 만들 때)** ↻ 표기 |
| <a id="video-chrome-devtools-mcp"></a>`chrome-devtools-mcp` | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Apache-2.0 | Chrome DevTools MCP 서버·CLI + 스킬 8개 | Node(`npx`), Chrome. 외부 계정·유료 API 없음 | **사용 통계 기본 켜짐**, 성능 트레이스 때 CrUX API 호출. `--no-usage-statistics`, `--no-performance-crux`로 꺼요 | 상(유지) | 보유 → **보유 · 끄기 옵션 즉시 필요(설정 변경 승인)** ↻. 확인 당시 설정에 옵션이 없었어요 |
| <a id="video-superpowers"></a>`superpowers` | [obra/superpowers](https://github.com/obra/superpowers) | MIT(배포 마켓 [저장소](https://github.com/anthropics/claude-plugins-official)는 Apache-2.0) | 설계→계획→시험 우선→서브에이전트→리뷰 워크플로. 스킬 15개 | 런타임·계정·유료 API 없음 | 기본 오프라인. 선택 기능(visual companion)은 서버에서 로고를 불러오며 버전 문자열을 보내요(끌 수 있음) | 하(유지). 운영 규칙상 쓰지 않아요 | 미사용(유지) |
| <a id="video-ponytail"></a>`ponytail` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | MIT | 과한 설계와 긴 코드를 억제하는 핵심 스킬 6개 + 여러 에이전트용 플러그인·`hooks/` | 핵심은 마크다운 지침. 플러그인·훅은 Node 환경. 계정·유료 API 없음 | 클라우드 텔레메트리 없음(통계는 로컬). 사칭 패키지에 주의하고 `hooks/`는 먼저 감사해야 해요 | 상(유지) | 참조(원칙만, 유지). `hooks/`는 감사 전 |

### 6.1 영상 주장과 실제가 다른 점

영상의 판정(큼·조금·없음)과 시간·비용 배수는 **제작자 주장**이고 재현하지 않았어요. 아래는 영상의 설명과 저장소를 대조해, 도입 판단에 영향을 주는 차이예요.

| 이름 | 영상에서 | 저장소 대조 결과 |
|---|---|---|
| `img2threejs` | three.js 3D 모델이 나와요. 필요 조건은 Python·Node | 출력이 TypeScript(`THREE.Group`)예요. Python은 외부 패키지가 필요 없어요 |
| `threejs-game-skills` | 화면에 "그림·소리 자동 생성은 유료 키 필요(안 써도 됨)"라고 안내해요 | 유료 키가 필요한 생성기는 9개 중 3개(Tripo·Gemini·ElevenLabs)예요. 우리 효과음 1순위는 이 생성기가 아니라 [sunoapi.org](pipeline.md#sfx-sunoapi) 💳예요. 스캐폴드는 Vite·TS 전제이고 Python 스크립트도 써요 |
| `logo-design-skill` | Python 필요 | 파비콘·앱 아이콘 PNG를 만들려면 SVG 변환 도구가 하나 더 필요해요 |
| `sprite-gen` | Python과 ChatGPT 또는 Grok 계정 | FFmpeg·Node.js·`img2webp`·`rife-ncnn-vulkan`도 얽혀 있고, `OPENAI_API_KEY`·`XAI_API_KEY` 방식도 있어요 |
| `mcp-for-blender` | 사용 통계가 기본으로 켜져 있어요 | 동의하면 프롬프트·코드·화면 캡처까지 보낼 수 있고, 외부 에셋 연동이 있어요 |
| `frontend-design` | 별 19.9만 | 그 값은 스킬 하나가 아니라 20개 스킬이 담긴 `anthropics/skills` 저장소 전체 값이에요(조사 시점 약 20만) |
| `taste-skill` | 브라우저 검사로 최대 10분 추가 | Node 22+가 필수이고, 외부 이미지 모음을 자동으로 조회해요 |
| `hallmark` | Node 18+ | 렌더 검사에는 `puppeteer-core`와 Chrome이 더 필요하고, 선택 유료 API 스크립트가 있어요 |
| `chrome-devtools-mcp` | 크롬 연결 도구, 사용 통계 기본 켜짐 | 공식 스킬 8개가 함께 있고, CrUX 호출을 끄는 옵션이 따로 있어요 |
| `superpowers` | 설계·시험부터 하는 워크플로 | 스킬이 15개이고, 선택 기능에 가벼운 네트워크 호출이 있어요 |
| `ponytail` | `/ponytail` 하나처럼 소개해요 | 핵심 스킬 6개와 Claude Code `hooks/`를 포함한 플러그인 묶음이에요 |

`godot-ai`와 `blender-skills`는 영상 설명이 저장소와 대체로 맞았어요.
