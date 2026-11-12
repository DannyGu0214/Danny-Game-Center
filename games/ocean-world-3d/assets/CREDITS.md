# Ocean World 3D 에셋 출처·라이선스

2026-11-12 agent-bridge 의뢰 `2026-11-11-danny-game-center-ocean-world-3d-001`로 로컬(macbook-15)에서 생성했어요. 항목별 후보 수·참고 이미지는 `docs/asset-manifest.yaml`의 `note`에 있어요.

## 이미지 (인물 기준 그림 2장, 프롤로그 이야기 그림 5장)

| 경로 | 생성 | 라이선스 |
|---|---|---|
| `portraits/{director,rookie}.webp` | Google Gemini 3.1 Flash Image(Nano Banana 2), Google AI Studio. director는 rookie를 화풍 참고 이미지로 넣어 같은 화풍으로 맞췄어요 | AI 생성물. Google은 생성물의 소유권을 주장하지 않아요. 프로젝트에서 자유롭게 써요 |
| `story/{institute,surface,idea,jelly,invite}.webp` | 같은 모델, Google AI Studio. 인물 기준 그림 2장을 참고 이미지로 넣어 같은 인물로 맞췄고, invite는 jelly를 함께 넣어 젤리 블록을 같은 물건으로 맞췄어요 | 위와 같아요 |

- 화풍: 정밀한 배경과 역광을 쓰는 일본 극장 애니메이션풍이에요(Sailing Master와 같은 계열, 2026-11-11 대니님 승인). 특정 작가·작품 이름은 프롬프트에 쓰지 않았어요.
- 인물 기준 그림은 896x1200(3:4)으로 생성된 그대로예요.
- 이야기 그림은 16:9(1376x768)로 생성한 뒤 높이 900으로 키우고 가운데를 1600x900으로 잘랐어요. WebP 품질 82.
- 원본 PNG와 탈락 후보는 커밋하지 않았어요.
