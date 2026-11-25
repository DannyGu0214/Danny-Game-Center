# threejs-game-skills (외부 스킬 묶음)

| 항목 | 값 |
|---|---|
| 출처 | https://github.com/majidmanzarpour/threejs-game-skills |
| 커밋 | `8286774b22a2566bf894dbc825825c16921866af` (2026-09-27) |
| 가져온 날 | 2026-11-25 |
| 라이선스 | MIT, Copyright (c) 2026 Majid Manzarpour ([원문](LICENSE-threejs-game-skills)) |
| 가져온 범위 | 저장소 `skills/` 아래 `threejs-*` 폴더 9개. 설치 스크립트(`install.sh`), 루트의 `package.json`·`scripts/`·`AGENTS.md`·`README.md`는 가져오지 않았어요 |

## 원본에서 바꾼 점

아래 다섯 파일의 YAML 머리말 바로 아래에 금지 문구 한 단락을 넣었어요. 그 밖의 파일은 원본 그대로예요.

- `threejs-game-director/SKILL.md` · `threejs-aaa-graphics-builder/SKILL.md`: 유료 생성·키 확인 스크립트 금지, 하위 에이전트 없이 직접 작업
- `threejs-3d-generator/SKILL.md`
- `threejs-image-generator/SKILL.md`
- `threejs-audio-generator/SKILL.md`

## 이 저장소에서 쓸 때

- **생성기 3개는 승인 전에 쓰지 않아요.** Tripo(`TRIPO_API_KEY`), Gemini(`GEMINI_API_KEY`), ElevenLabs(`ELEVENLABS_API_KEY`)로 프롬프트·이미지·음성이 전송되고 요금이 생길 수 있어요. 이미지 스크립트는 모델이 `gemini-3-pro-image-preview`로 고정돼 있어요.
- `threejs-game-director`와 `threejs-aaa-graphics-builder`의 원문에는 "키가 있으면 생성 에셋을 쓰라"는 안내가 남아 있어요. 파일 맨 위의 금지 문구와 저장소 `CLAUDE.md`의 규칙이 우선해요. 문구는 지시일 뿐이고 실행을 기술적으로 막지는 않아요.
- **`probe_asset_credentials.sh`는 실행하지 않아요.** 키 확인을 위해 사용자의 셸 설정 파일(`~/.zprofile`, `~/.zshrc`)을 읽어 들여 실행해요. `threejs-audio-generator`의 `probe --validate`는 키로 업체를 호출하고 계정 이메일이나 ID를 출력해요.
- `threejs-game-director` 원문은 하위 작업자 위임(보통 총괄 1 + 작업자 2 이하)을 안내해요. 이 저장소에서는 따라 하지 않고 현재 작업자가 직접 작업해요.
- 스킬 안의 설치 명령(`npm install`, `npx playwright install`, `uv run`)은 각각 승인 대상이에요. `uv run generate_image.py`는 실행할 때 파이썬 패키지를 내려받아요.

## three 버전 차이 (0.184 → 0.187)

| 항목 | 이 스킬의 스캐폴드(`threejs-gameplay-systems/assets/threejs-vite-game/`) | 이 저장소의 기준 |
|---|---|---|
| `three` | `^0.184.0` | `0.187.0` 정확히 고정 |
| `@types/three` | `^0.184.1` | `0.187.0` |
| `typescript` | `^6.0.3` | 시제품 뼈대는 `7.0.2` 기준으로 준비 중이에요 |
| `vite` | `^8.0.13` | 시제품 뼈대는 `8.3.8` 기준으로 준비 중이에요 |
| 추가 패키지 | `lil-gui`, `@types/node`, `pngjs`, `@types/pngjs` | 승인 전에는 설치하지 않아요 |
| 화면 시험 브라우저 | Playwright `channel: 'chromium'`(브라우저 내려받기 필요) | 시제품 뼈대는 설치된 Chrome 사용 |

- 스캐폴드는 원본 그대로 뒀어요. 코드를 옮길 때는 `package.json`·lock 파일을 그대로 복사하지 말고, 우리 버전에서 타입 검사와 화면 확인을 다시 해요.
- 0.185~0.187의 변경이 스캐폴드나 셰이더 예제에 미치는 영향은 확인하지 않았어요. `shader-cookbook.md` 원문도 프로젝트의 three 버전에서 확인하라고 안내해요.
