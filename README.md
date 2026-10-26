# Danny Game Center

대니의 게임 모음 저장소예요. 게임마다 `games/<게임 이름>/` 폴더 하나에 코드·설계 문서·테스트를 둬요.

**바로 하기:** https://dannygu0214.github.io/Danny-Game-Center/

## 게임 목록

| 게임 | 장르 | 상태 | 플레이 | 폴더 |
|---|---|---|---|---|
| Zombie Outpost (좀비 아웃포스트) | 세로 화면·쿼터뷰 모바일 웹 게임. 좀비 서바이벌, 수동 파밍, 기지 건설, 동료, 전진기지, 로그라이크 | 플레이 가능 | [바로 하기](https://dannygu0214.github.io/Danny-Game-Center/games/zombie-outpost/) | [`games/zombie-outpost`](games/zombie-outpost) |
| Animal World (애니멀 월드) | 세로 화면·쿼터뷰 관찰형 게임. 동물 입양, 지역 꾸미기, 발전도·티어, 순간 포착 | 4지역(초원·바닷가·사막·남극) 플레이 가능 | [바로 하기](https://dannygu0214.github.io/Danny-Game-Center/games/animal-world/) | [`games/animal-world`](games/animal-world) |

## 공통 규칙

- 빌드 도구 없이 바닐라 JavaScript와 정적 파일로 만들어요. 외부 런타임 라이브러리가 없어요.
- 게임 규칙(`logic.js`)은 화면과 분리해서 Node에서 테스트해요.
- 실행: ES 모듈이라 파일을 바로 열지 말고 게임 폴더를 정적 서버로 열어요.

```bash
cd games/zombie-outpost && python3 -m http.server 8791
```

- 테스트: 각 게임 폴더에서 `npm test`(Node 20 이상).
- 배포: GitHub Pages(main 브랜치 루트, https://dannygu0214.github.io/Danny-Game-Center/). `main`에 올리면 몇 분 안에 반영돼요. 게임은 PWA라 휴대폰에서 **홈 화면에 추가**하면 앱처럼 설치되고 인터넷 없이도 돌아가요. 저장은 기기마다 그 브라우저에 따로 남아요.
- 루트 `index.html`은 게임 목록 첫 화면이에요(게임마다 아이콘·제목·한 줄 소개, 아래에 홈 화면 바로가기 만드는 법). 새 게임을 추가하면 여기에도 한 칸 넣어요. 첫 화면의 홈 화면 아이콘은 `icons/`, `manifest.webmanifest`(바로가기라 `display: browser`)예요.

## 새 게임 추가

1. `games/<새 게임>/` 폴더를 만든다.
2. 그 안에 `README.md`(실행·테스트 방법)와 설계 문서를 둔다.
3. 위 게임 목록 표에 한 줄 추가한다(플레이 주소: `https://dannygu0214.github.io/Danny-Game-Center/games/<새 게임>/`).
