# 참고 영상: 클로드 스킬·도구 13종 비교

- **영상**: [깃허브 인기 클로드 스킬 13개, 깔면 정말 달라질까?](https://youtu.be/fuNsKrTZTEQ) · 채널 "사장님은 말만 합니다" · 게시 2026-11-25(영상 정보의 원 시각은 2026-11-24 18:45, UTC−8) · 길이 18:01
- **정리 근거**: 영상 자막, 화면 캡처, 설명란
- **읽는 법**: 아래 판정, 시간·비용 배수, 결함 수, 시험 결과는 모두 **제작자 주장**이에요. 재현하지 않았어요. 저장소를 대조한 결과와 도입 등급은 [카탈로그 6절](../gamedev-skills-catalog.md#video-13)에 있어요.

## 영상이 보여 주는 것

별을 많이 받은 클로드 코드 스킬·도구 13개를 설치해, 같은 부탁을 설치하지 않은 쪽과 설치한 쪽에 시키고 결과를 나란히 비교해요. 분야는 three.js, Godot, 게임 에셋, Blender, 웹(만들기·고치기), 코딩 공통이에요. 모델은 Claude Opus 5.5(설명란 기준 추론 high)로 고정했어요.

- **판정 기준**: 차이가 한눈에 보이면 "큼", 작게 나아지면 "조금", 차이가 없거나 나빠지면 "없음". 시간과 비용은 따로 "대가"로 보여 줘요.
- **결과(제작자 주장)**: 큼 8 · 조금 4 · 없음 1
- **반복 횟수**: 대부분 세 번 돌려 가운데 값을 봤어요. `img2threejs`, `sprite-gen`, `taste-skill`, `hallmark`는 한 번만 돌렸어요.
- **비용**: API로 냈다면의 환산값이에요(설명란).

## 핵심 주장 (제작자 주장)

1. 효과가 큰 것도 대부분 시간과 비용이 더 들어요. 필요한 작업에 골라 설치하라는 것이 결론이에요.
2. `ponytail`은 숨겨 둔 시험 20개를 두 쪽 모두 통과한 상태에서 바꾼 코드가 116줄 → 52줄이었고, 시간과 비용도 줄었어요(줄어든 배수는 말하지 않아요). 스스로 쓴 시험은 조금 적었어요.
3. 스킬이 없어도 기본 산출물은 잘 나온 비교가 있어요. 3D 게임은 6판 모두 오류 없이 돌았고, 스프라이트는 챙긴 파일 구성이 같았어요.
4. 화면을 직접 보고 고치는지가 차이를 만든 사례가 있어요. Godot 비교에서 설치하지 않은 쪽은 세 판 모두 화면을 보지 않았고, 한 판은 배치가 깨졌어요.
5. Blender 결함 수(가운데 값)는 설치 안 함 22, `mcp-for-blender` 43, `blender-skills` 0이었어요.
6. 홈페이지의 "AI 티"(제작자가 정한 10개 항목) 중 걸린 수는 설치 안 함 4, `frontend-design` 2, `taste-skill`·`hallmark` 0이었어요.

## 도구별 결과 (제작자 주장)

대가는 "설치 안 함" 대비 배수예요.

| 도구 | 판정 | 영상 속 실험과 대가 | 구간 |
|---|---|---|---|
| [img2threejs](../gamedev-skills-catalog.md#video-img2threejs) | 큼 | 로봇 사진 → 3D 모델. 집게·눈·칠이 사진에 더 가깝고 "분해 보기" 추가. 시간 4배(7→29분), 비용 4.9배 | [01:07](https://youtu.be/fuNsKrTZTEQ?t=67) |
| [threejs-game-skills](../gamedev-skills-catalog.md#video-threejs-game-skills) | 조금 | 브라우저 3D 게임. 게임은 비슷하고 파일 구조·자동 검사·확인 기록이 달라요. 시간 2배, 비용 1.9배 | [02:56](https://youtu.be/fuNsKrTZTEQ?t=176) |
| [godot-ai](../gamedev-skills-catalog.md#video-godot-ai) | 조금 | Godot 게임. 직접 띄워 화면 배치를 맞춰요. 시간 1.1배, 비용 1.3배 | [04:17](https://youtu.be/fuNsKrTZTEQ?t=257) |
| [logo-design-skill](../gamedev-skills-catalog.md#video-logo-design-skill) | 큼 | 게임 스튜디오 로고. 16px 전용판, 아이콘 세트, 사용 규칙까지. 시간 3.6배, 비용 4.6배 | [05:57](https://youtu.be/fuNsKrTZTEQ?t=357) |
| [sprite-gen](../gamedev-skills-catalog.md#video-sprite-gen) | 큼 | 걷기 스프라이트 8동작. 그림은 Codex가 그려요. 비용 1.8배 + Codex 사용량, 시간 비슷 | [07:26](https://youtu.be/fuNsKrTZTEQ?t=446) |
| [mcp-for-blender](../gamedev-skills-catalog.md#video-mcp-for-blender) | 없음 | 게임용 나무 상자. 겹친 면 결함이 늘었어요(세 판 43·2·94). 화면 표에는 시간 0.6배, 비용 0.9배 | [08:57](https://youtu.be/fuNsKrTZTEQ?t=537) |
| [blender-skills](../gamedev-skills-catalog.md#video-blender-skills) | 큼 | 같은 상자. 결함 1·0·0. 시간 2.3배, 비용 2.2배 | [08:57](https://youtu.be/fuNsKrTZTEQ?t=537) |
| [frontend-design](../gamedev-skills-catalog.md#video-frontend-design) | 큼 | 카페 홈페이지. 첫 화면 개성이 뚜렷해지고 실제 사진은 0장. 시간 2.1배, 비용 2.6배 | [11:03](https://youtu.be/fuNsKrTZTEQ?t=663) |
| [taste-skill](../gamedev-skills-catalog.md#video-taste-skill) | 큼 | 같은 홈페이지. 사진 6장과 출처 페이지, 브라우저 점검 3회. 시간 3.1배, 비용 6배 | [11:03](https://youtu.be/fuNsKrTZTEQ?t=663) |
| [hallmark](../gamedev-skills-catalog.md#video-hallmark) | 큼 | 같은 홈페이지. 테마 선택, 사진 3장과 출처. 시간 2배, 비용 4.6배 | [11:03](https://youtu.be/fuNsKrTZTEQ?t=663) |
| [chrome-devtools-mcp](../gamedev-skills-catalog.md#video-chrome-devtools-mcp) | 조금 | 느린 페이지 수리. 두 쪽 모두 문제 6개를 고쳤고, 설치한 쪽은 전후 시간을 재서 보고. 시간·비용은 조금 적음 | [13:16](https://youtu.be/fuNsKrTZTEQ?t=796) |
| [superpowers](../gamedev-skills-catalog.md#video-superpowers) | 조금 | 할 일 앱 기능 추가. 숨은 시험은 동률, 자체 시험 18개 대 33개. 시간 1.7배, 비용 2.4배 | [14:41](https://youtu.be/fuNsKrTZTEQ?t=881) |
| [ponytail](../gamedev-skills-catalog.md#video-ponytail) | 큼 | 같은 기능. 시험 20/20 동률, 변경 116줄 → 52줄. 시간·비용 감소 | [16:10](https://youtu.be/fuNsKrTZTEQ?t=970) |

## 장면 순서

- [00:00](https://youtu.be/fuNsKrTZTEQ?t=0) 결과를 먼저 알리고 비교 방법과 판정 기준을 설명해요.
- [01:02](https://youtu.be/fuNsKrTZTEQ?t=62) three.js: 사진으로 만든 3D 로봇과 브라우저 3D 게임을 비교해요.
- [04:17](https://youtu.be/fuNsKrTZTEQ?t=257) Godot: 제목과 일시정지 화면의 배치가 쏠린 사례를 보여 줘요.
- [05:57](https://youtu.be/fuNsKrTZTEQ?t=357) 에셋: 로고를 16px로 줄여 보고, 걷기 스프라이트를 비교해요.
- [08:51](https://youtu.be/fuNsKrTZTEQ?t=531) Blender: 겹친 면을 빨갛게 표시하고 결함·시간·비용 표를 띄워요.
- [11:03](https://youtu.be/fuNsKrTZTEQ?t=663) 웹 만들기: 카페 홈페이지 네 개를 검사해요.
- [13:16](https://youtu.be/fuNsKrTZTEQ?t=796) 웹 고치기: 8.8초 걸리던 첫 화면이 두 쪽 모두 0.5초 안쪽이 돼요.
- [14:41](https://youtu.be/fuNsKrTZTEQ?t=881) 코딩 공통: `superpowers`와 `ponytail`을 비교해요.
- [17:27](https://youtu.be/fuNsKrTZTEQ?t=1047) 효과가 컸던 8개를 정리해요.

## 한계

- 채점용 시험, "AI 티" 항목 전체, 원본 결과물은 확인하지 못했어요. 판정에는 제작자가 눈으로 본 기준이 섞여 있어요.
- 웹 고치기에서 영상의 "8.8초 → 0.5초 안쪽"과 설치한 쪽 보고서의 "1.27초 → 0.008초"는 수치가 달라요. 측정 조건이 다른 것으로 보여요 `[추측]`. 영상은 이유를 설명하지 않아요.
- 화면 캡처는 일부 장면이라, 자막에 없고 화면에 잠깐 나온 정보는 빠졌을 수 있어요.

## 출처

- 영상: <https://youtu.be/fuNsKrTZTEQ>
- 저장소 주소와 설치 방법: 영상 설명란. 저장소별 링크는 [카탈로그 6절](../gamedev-skills-catalog.md#video-13)에 있어요.
