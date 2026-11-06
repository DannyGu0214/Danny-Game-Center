<!-- agent-bridge-guide v1 -->
<!-- 정본: DannyGu0214/agent-bridge project-kit/agent-bridge.md. 이 파일은 install.sh가 덮어쓴다. 여기서 고치지 않는다. -->

# agent-bridge 의뢰서 작성 지침 (원격 세션용)

이 프로젝트는 공용 브리지 저장소 `DannyGu0214/agent-bridge`로 로컬 PC(macbook-15)에 작업을 맡길 수 있다.

## 언제 맡기나

먼저 원격 환경에서 직접 해결한다. 아래 경우에만 의뢰서를 쓴다.

| type | 맡기는 일 |
|---|---|
| `asset_gen` | 외부 API로 에셋 생성(이미지·음악·효과음·음성·영상·3D 등)과 규격 변환 |
| `web_task` | 원격 브라우저로 막힌 사이트의 조회, 또는 이미지·문서·음악 다운로드 |

이 밖의 type은 거절된다. 로컬 앱·스크립트 실행(`local_run`)은 아직 열려 있지 않다.

## 쓰는 법

1. `agent-bridge` 저장소의 `inbox/`에 `<id>.md` 파일을 하나 만든다. 형식은 아래와 같다.
2. **보낸 의뢰서는 고치지 않는다.** 바꿀 게 생기면 새 의뢰서를 쓰고 `supersedes`에 이전 id를 적는다.
3. 커밋·push한 뒤 대니님께 "agent-bridge에 의뢰서 `<id>`를 넣었다"고 알린다. 로컬 처리는 대니님이 개시할 때만 시작된다(자동 처리 없음).
4. 결과는 `outbox/<id>.result.md`에 생긴다. 에셋은 `target_branch`에 직접 커밋되므로 그 브랜치를 pull해서 받는다.

### id 규칙

`YYYY-MM-DD-<저장소 이름 소문자>-NNN` (예: `2026-11-06-danny-game-center-001`). 같은 날 같은 저장소에서 번호를 1씩 올린다.

### 의뢰서 형식

```markdown
---
id: 2026-11-06-danny-game-center-001
guide_version: 1
type: asset_gen            # asset_gen | web_task
target_repo: DannyGu0214/Danny-Game-Center
target_branch: claude/stage-2   # 필수. 결과를 커밋할 원격 작업 브랜치
manifest: docs/asset-manifest.yaml   # asset_gen, 에셋 다운로드일 때 필수
deliver: repo              # repo = target_branch에 커밋 / outbox = 결과 파일만
supersedes:                # 대체하는 이전 의뢰서 id (없으면 비움)
---

## 목적
무엇을 위해 필요한지 한두 줄.

## 작업
- manifest에서 status: pending인 항목을 처리해 주세요. (asset_gen)
- 또는 web_task라면: 사이트 주소, 찾을 것, 받을 파일 종류.

## 완료 기준
어떤 상태면 끝났다고 볼지.

## 제약
예산 상한, 스타일 기준 문서, 피해야 할 것.
```

## 에셋 목록 `docs/asset-manifest.yaml`

에셋 설계는 의뢰서가 아니라 이 파일에 쓴다. 개발 중에는 placeholder를 쓰고, 마일스톤마다 의뢰서 한 장으로 `pending` 항목을 일괄 처리시킨다. 로컬은 처리한 항목의 `status`·`license`·`note`만 바꾼다.

```yaml
version: 1
style: docs/art-style.md        # 스타일 기준 문서 (한 곳에서만 정의)
assets:
  - id: player-idle
    kind: image                 # image | music | sfx | voice | video | model3d | document
    source: generate            # generate | download
    path: assets/sprites/player-idle.png
    spec: "64x64 PNG, 투명 배경, 4프레임 가로 시트"
    prompt: "..."               # source: generate일 때
    url: ""                     # source: download일 때 (페이지 주소)
    status: pending             # pending | done | failed  (로컬이 갱신)
    license: ""                 # 로컬이 기록
    note: ""                    # 로컬이 기록 (모델·비용·실패 사유)
```

- 큰 파일(음악·영상·3D)은 Git LFS로 커밋된다. 저장소에 `.gitattributes` LFS 설정이 있어야 한다.
- 출처와 라이선스는 로컬이 `assets/CREDITS.md`에 함께 기록한다.

## 하지 않는 것

- 의뢰서에 키·비밀번호·개인정보를 쓰지 않는다.
- 실행 파일·압축 파일·설치 파일 다운로드를 요청하지 않는다(거절된다).
- 폼 제출·발송·구매·삭제·설정 변경을 요청하지 않는다(거절된다).
