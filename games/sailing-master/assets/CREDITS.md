# Sailing Master 에셋 출처·라이선스

2026-11-08 agent-bridge 의뢰 `2026-11-08-danny-game-center-002`로 로컬(macbook-15)에서 생성했어요. 항목별 모델·비용은 `docs/asset-manifest.yaml`의 `note`에 있어요.

## 이미지 (초상화 4장, 출항 이야기 그림 12장)

| 경로 | 생성 | 라이선스 |
|---|---|---|
| `portraits/{sailor,lucky,trader,crafter}.webp` | Google Gemini 3.1 Flash Image(Nano Banana 2). sailor·lucky는 OpenRouter, trader·crafter는 Google AI Studio | AI 생성물. Google은 생성물의 소유권을 주장하지 않아요. 프로젝트에서 자유롭게 써요 |
| `story/*.webp` (12장) | 같은 모델, Google AI Studio. 선장별 초상화를 참고 이미지로 써서 같은 인물로 맞췄어요 | 위와 같아요 |

- 화풍: 정밀한 배경과 역광을 쓰는 일본 극장 애니메이션풍이에요(2026-11-08 대니님 확정). 특정 작가 이름은 프롬프트에 쓰지 않았어요.
- 초상화는 896x1200(3:4)이에요. 한 화면에 한 캐릭터를 크게 띄우는 선택 화면용이라 manifest spec(1024 정사각)과 달라요.
- 이야기 그림은 3:2로 생성한 뒤 가운데를 36:25로 잘라 1440x1000으로 맞췄어요.

## 배경음악 4곡

| 경로 | 곡 | 생성 | 라이선스 |
|---|---|---|---|
| `music/pond.mp3` | 갈대 나루 선술집(작은 호수) | Suno v6-mini, 연주곡 | Suno 무료 플랜 |
| `music/lake.mp3` | 한 잔 더!(큰 호수) | 같음 | 같음 |
| `music/river.mp3` | 노 저어라, 친구(강) | 같음 | 같음 |
| `music/sea.mp3` | 넓은 바다(바다·대양) | 같음 | 같음 |

- **Suno 무료 플랜 생성물은 비상업 용도로만 쓸 수 있고, 저작권은 Suno에 있어요.** 게임을 상업적으로 배포하려면 유료 플랜(sunoapi.org)으로 다시 만들어야 해요.
- 앞뒤 무음을 지우고, 끝 2.5초를 처음 2.5초에 크로스페이드로 겹쳐 반복 재생 때 끊기지 않게 했어요(ffmpeg). 128kbps, 44.1kHz 스테레오예요.
