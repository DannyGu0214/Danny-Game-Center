# P5 W3 마감 보고서

브랜치 `claude/ocean-world-3d-w3-finish`(기준 c25c8dc) · 2026-11-18 · 지시 `docs/brief-w3-finish.md`

## 1. 바꾼 것

| 파일 | 내용 |
|---|---|
| `manifest.webmanifest` (새) | 이름 "Ocean World 3D", short_name "Ocean World", `start_url`·`scope` `./`, `display: standalone`, 배경 `#eaf3f4`(게임 `body` 배경), 테마 `#8fd3e3`(하늘·바다 톤), 아이콘 192·512·maskable 512. 게임이 가로·세로를 모두 받으므로 `orientation`은 두지 않음 |
| `sw.js` (새) | `games/zombie-outpost/sw.js` 방식. 네트워크 우선(4초 넘으면 캐시), 설치 때 `CORE` 92개를 모두 받아 둠. 캐시 이름 `ocean-world-3d-v1`, 새 버전이 켜지면 `ocean-world-3d-`로 시작하는 옛 캐시만 지움(같은 출처의 다른 게임 캐시는 그대로). 오프라인 이동 요청은 `index.html`로 대신 응답 |
| `icons/` (새) | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`(안전 영역 안으로 0.78배), `apple-touch-icon.png`(180). 하늘·바다 배경 위 젤리 블록(섬·모래 지층 띠·유리 모서리 빛)과 해파리 |
| `tools/make-icons.mjs` (새) | 아이콘 생성 스크립트. 외부 이미지·패키지 없이 node 내장 `zlib`으로 PNG를 씀(4×4 슈퍼샘플링). `node tools/make-icons.mjs` |
| `index.html` | `<head>`: 빈 파비콘 `data:,`을 `icons/icon-192.png`로 바꾸고, manifest·apple-touch-icon·`theme-color`·`apple-mobile-web-app-*` 링크를 넣음. `</body>` 앞: sw 등록(https 또는 localhost에서만, `window.claude`(Artifact)와 `?capture`(녹화 모드)에서는 등록 안 함) |
| `README.md` (새) | 무엇인지, 실행, 조작, 주소 파라미터(`render/main.js` 머리말·`opt` 파싱에 실제로 있는 것만), 폴더, `npm test`·`npm run sim`, 오프라인·홈 화면 추가 |
| `docs/p5-finish-report.md` (새) | 이 보고서. 지시 파일 `docs/brief-w3-finish.md`도 함께 커밋 |

## 2. 캐시 목록 근거

- **JS 79개**: `render/main.js`에서 정적 `import`·`export … from`·동적 `import()`를 따라간 그래프예요. `importmap`의 `three`, `three/addons/`를 `vendor/three-0.187.0/`로 풀었어요. three는 `three.module.js`, `three.core.js`, `OrbitControls.js`, `RoomEnvironment.js`, `BufferGeometryUtils.js`의 5개예요. 풀리지 않은 import는 0이에요.
- **그 밖 13개**: `./`, `index.html`, `manifest.webmanifest`, 아이콘 4장, `ui/prologue.css`(`ui/prologue.js`가 `new URL('./prologue.css', import.meta.url)`로 부름), 프롤로그 그림 5장(`ui/prologue-story.js`의 `art:` 5개).
- **뺀 것**: `render/aqua/swim.js`(어디서도 import하지 않음), `assets/portraits/*.webp` 2장(코드에서 부르지 않음), `assets/CREDITS.md`, `prologue-demo.html`, `test/`, `docs/`, `tools/`, `DESIGN.md`, `PLAN.md`, `package.json`.
- **대조**(임시 스크립트로 확인): `CORE` 92개 = 필요 목록 91개 + `./`. 빠진 파일 0, 없는 파일 0, 중복 0.
- **소리**: `audio/`는 Web Audio 합성이라 따로 받는 소리 파일이 없어요(`audio/*.js` 3개만 캐시).

## 3. 확인함 (직접 실행)

- `npm test`: **78/78 통과**.
- 브라우저: ego lite, `python3 -m http.server 8797` → `http://localhost:8797/index.html?title=0&prologue=0`. 문서 시작 전에 오류 수집 스크립트를 넣고 재 봤어요.

| 항목 | 결과 |
|---|---|
| 콘솔 오류(error·unhandledrejection·console.error) | 0 |
| 서비스 워커 | `activated`, 페이지 제어 중(`controller` 있음), 범위 `http://localhost:8797/` |
| 캐시 | `ocean-world-3d-v1` 하나, 항목 **92**(설치는 `addAll`이라 하나라도 404면 실패함. 92개 모두 받아짐) |
| manifest(`Page.getAppManifest`) | 파싱 오류 0, 아이콘 3개 인식(192 any, 512 any, 512 maskable) |
| 아이콘 파일 | 192×192, 512×512, 512×512, 180×180(브라우저 `Image.decode`로 확인) |
| 오프라인 | 서버를 끈 상태(curl 응답 000)에서 새로고침하니 **4.1초**에 게임 화면(`mode: play`)이 열리고 오류 0. 프롤로그 그림 2장과 `prologue.css`도 캐시에서 200 |
| 정리 | 확인이 끝난 뒤 브라우저의 서비스 워커 등록과 `ocean-world-3d-v1` 캐시를 지우고 서버·브라우저 공간을 닫음 |

확인 중에 겪은 일: 처음에는 서비스 워커가 등록되지 않았어요. W1 확인 때 같은 주소로 받은 옛 `index.html`을 브라우저가 HTTP 캐시(python http.server는 `Cache-Control`을 보내지 않음)에서 썼기 때문이에요. 캐시를 끄고 다시 불러온 뒤에는 위 결과대로 됐어요. 실제 배포에서는 한 번 새 `index.html`을 받으면 등록돼요.

## 4. 추정 (실행하지 않은 것)

- `?capture`에서 등록하지 않는 분기는 코드로만 확인했어요(이미 등록된 서비스 워커가 있으면 녹화 모드 페이지도 그 워커를 거쳐요. 네트워크 우선이라 결과는 같아요).
- 실제 iOS·Android 홈 화면 추가와 독립 실행 화면은 해 보지 않았어요. 데스크톱 Chrome의 manifest 파싱만 확인했어요.
- maskable 아이콘이 원·물방울 마스크에서 잘리지 않는지는 계산(안전 영역 반지름 0.4 안)으로만 봤어요.
- GitHub Pages 같은 하위 경로 배포에서도 `./` 상대 경로라 맞을 것으로 봐요.

## 5. 메인에 요청

- **같은 출처의 다른 게임 캐시 문제**: `games/zombie-outpost/sw.js`는 activate 때 자기 캐시 말고 출처의 모든 캐시를 지워요(`k !== CACHE`). 게임 센터가 한 출처(같은 GitHub Pages)에 여러 게임을 올리면, 좀비 아웃포스트가 업데이트될 때 Ocean World 3D의 오프라인 캐시도 지워져요. Ocean 쪽은 다음 온라인 방문 때 다시 채우지만, 좀비 쪽 sw를 자기 접두사만 지우게 고치는 것을 권해요(다른 게임 파일이라 고치지 않았어요).
- 루트 게임 센터 목록 등록은 메인이 맡아요(PLAN 4.1.4).
- 게임 파일을 더하거나 빼는 다음 회차부터는 `sw.js`의 `CORE`와 `CACHE` 버전을 함께 고쳐야 해요. README에 적어 뒀어요.

## 6. 남은 문제

- 캐시 목록을 손으로 관리해요. 파일이 바뀌면 빠질 수 있어요. 지금 쓴 그래프 대조 스크립트는 임시 폴더에만 있어요. `tools/`에 두는 것은 지시 범위(아이콘 생성 스크립트만) 밖이라 넣지 않았어요.
- 첫 방문 때 vendor를 포함해 약 3MB를 한 번에 받아요.
- 아이콘은 코드로 그린 단순한 그림이에요. 대니님 느낌 확인이 필요해요.
