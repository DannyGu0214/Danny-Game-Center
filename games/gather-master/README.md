# 줍줍 마스터 (Gather Master) — 3D 시제품 (폴더 이름 `gather-master`)

Vite + TypeScript + npm `three` 뼈대예요. 게임 규칙은 아직 없고, 도는 상자와 조명, 끌어서 돌려 보는 카메라만 있어요. 구성 기준은 [파이프라인 문서](../../docs/game-dev/pipeline.md)의 3D 시제품 절이에요. 아직 배포하지 않았고 게임센터 첫 화면에도 연결하지 않았어요.

설계는 [`DESIGN.md`](DESIGN.md), 진행 계획은 [`PLAN.md`](PLAN.md), 화풍은 [`docs/art-style.md`](docs/art-style.md)에 있어요. 아래 뼈대 설명은 아직 기획 전 상태 그대로예요.

## 명령

```
npm ci              # package-lock.json 기준 설치(이 폴더 안에만)
npm run dev         # 개발 서버 http://127.0.0.1:5183/
npm run typecheck
npm test            # sim 규칙 시험(node --test)
npm run build       # dist/ 생성
npm run preview     # 빌드 결과 확인 http://127.0.0.1:4183/
npm run e2e         # 빌드 → 미리보기 → 스모크. 설치된 Chrome 필요
```

Node 26 이상을 기준으로 해요(`.ts` 시험을 그대로 실행해요).

## 구조

| 경로 | 역할 |
|---|---|
| `src/sim/` | 화면과 분리한 규칙. `three`를 import하지 않아요 |
| `src/render/` | `stage.ts`(렌더러·카메라·크기·픽셀비 상한 2·컨텍스트 손실), `scene.ts`(물체·조명) |
| `src/main.ts` | 규칙과 화면 연결 |
| `test/` · `e2e/` | 규칙 시험, 브라우저 스모크 |

파이프라인 문서의 예시와 달리 `src/core/` 대신 `src/render/`를 써요. `systems/`·`entities/`·`ui/`는 필요해질 때 만들어요.

`.ts` 파일을 import할 때는 확장자까지 적어요. 타입 검사 범위는 `src/`, `test/`, `vite.config.ts`예요. `playwright.config.ts`와 `e2e/`는 `@types/node` 없이 설치해서 `typecheck`에서 빠져 있어요(실행할 때 Playwright가 변환해요).

## 배포(아직 안 함)

- `base: './'`라서 `dist/`는 하위 경로 어디에 놓아도 열려요.
- 지금은 `dist/`를 `.gitignore`에 넣어 커밋하지 않아요.
- 배포할 때(A안): `.gitignore`에서 `dist/`를 빼고, `npm run build` 결과를 커밋하고, 게임센터 첫 화면에서 `games/<이름>/dist/`로 연결해요. Pages 설정은 바꾸지 않아요.
- 폴더 이름은 임시라서, 게임 이름을 정하면 폴더, `package.json`의 `name`, `package-lock.json`을 함께 바꿔요.
- PWA(서비스 워커)는 시제품에 넣지 않았어요.
