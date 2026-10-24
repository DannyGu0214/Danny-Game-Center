# Danny Game Center

대니의 게임 모음 저장소예요. 게임마다 `games/<게임 이름>/` 폴더 하나에 코드·설계 문서·테스트를 둬요.

## 게임 목록

| 게임 | 장르 | 상태 | 폴더 |
|---|---|---|---|
| 좀비 전초기지 (Zombie Outpost) | 세로 화면·쿼터뷰 모바일 웹 게임. 좀비 서바이벌, 수동 파밍, 기지 건설, 동료, 전진기지, 로그라이크 | 플레이 가능 | [`games/zombie-outpost`](games/zombie-outpost) |

## 공통 규칙

- 빌드 도구 없이 바닐라 JavaScript와 정적 파일로 만들어요. 외부 런타임 라이브러리가 없어요.
- 게임 규칙(`logic.js`)은 화면과 분리해서 Node에서 테스트해요.
- 실행: ES 모듈이라 파일을 바로 열지 말고 게임 폴더를 정적 서버로 열어요.

```bash
cd games/zombie-outpost && python3 -m http.server 8791
```

- 테스트: 각 게임 폴더에서 `npm test`(Node 20 이상).

## 새 게임 추가

1. `games/<새 게임>/` 폴더를 만든다.
2. 그 안에 `README.md`(실행·테스트 방법)와 설계 문서를 둔다.
3. 위 게임 목록 표에 한 줄 추가한다.
