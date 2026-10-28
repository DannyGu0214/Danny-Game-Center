# Animal World (애니멀 월드)

캐릭터 없이 지켜보는 관찰형 동물 게임이에요. 인기점수로 동물을 입양하고 지형지물·사물을 놓아 지역을 가꾸면 발전도가 오르고, 기준을 넘으면 티어가 올라 더 많은 동물을 키울 수 있어요. 조이스틱 없이 버튼과 탭으로만 해요.

**바로 하기:** https://dannygu0214.github.io/Danny-Game-Center/games/animal-world/

지역은 **초원 → 바닷가 → 사막 → 남극**(앞 지역 T4가 되면 열림), 지역마다 T1~T8, 동물 8종·물건 16종이에요. 위쪽 지역 이름(▾)을 누르면 지역을 옮길 수 있어요. 인기점수(⭐)는 지역마다 따로이고, 쉬는 동안(게임을 끈 동안·다른 지역에 있는 동안)은 지역마다 최대 30분치만 쌓여요. 땅에는 언덕·봉우리·저지대·길·바다가 있어서, 은신처·먹이는 언덕과 평지에, 연못은 저지대에, 놀이 물건은 높은 언덕과 평지에 놓아요. 지역이 T8이 되면 본섬 앞에 다리로 이어진 T8 섬(20×20칸)이 열리고 개체 한도가 44마리로 늘어요(그전엔 섬이 흐리게 🔒). 자세한 규칙과 수치는 [DESIGN.md](DESIGN.md)에 있어요.

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 화면·조작·HUD·시트(동물·꾸미기·요청·앨범)·저장(브라우저 저장소) |
| `data.js` | 지역·티어·동물·물건 정의와 점수·가격 상수 |
| `logic.js` | 게임 규칙 전부(화면 없음, 고정 시간 단계 1/30초, 시드 난수) |
| `terrain.js` | 지역마다 40×40 지형 지도(평지·언덕·봉우리·저지대·길·바다)와 T8 섬 20×20 지도·다리(지역 격자 40×66), 둘레 작은 계단 높이 계산, 지형별 놓을 수 있는 물건 |
| `art.js` | 그림 전용(쿼터뷰 땅·물건, 시간대 하늘·빛, 동물 그림 공통 도우미) |
| `rigs/<종>.js` | 동물 32종 리그 그림(관절·발 고정 걸음·몸짓·상태별 자세) |
| `items/<지역>.js`, `sounds/<지역>.js` | 바닷가·사막·남극 물건 그림과 동물 소리 |
| `music.js` | 초원 배경음악 5곡 합성(Web Audio, 파일 없음) |
| `sound.js` | 동물 소리 8종 × 2가지 합성 |
| `test/logic.test.js` | 규칙 테스트 |
| `tools/sim.js` | 밸런스 봇 |
| `tools/icon.html` | 앱 아이콘 그리기 |
| `tools/rig-preview.html` | 리그 점검표(`?sp=<종>`, `&live=1`, `?sp=all&region=<지역 또는 every>`) |
| `tools/item-preview.html` | 지역 점검표(`?region=<지역>`: 시간대별 풍경 + 물건 16종) |
| `tools/sound-check.html`, `tools/page-eval.mjs` | 동물 소리 렌더 측정(헤드리스 Chrome으로 결과 읽기) |
| `tools/rig-demo.html` | 예전 그림 vs 리그 그림 비교 시제품 |
| `manifest.webmanifest`, `sw.js`, `icons/` | 독립 실행(PWA): 홈 화면 설치·오프라인 실행 |

## 휴대폰에 설치

위 주소를 열고 브라우저 메뉴에서 **홈 화면에 추가**(iPhone은 Safari 공유 버튼 → 홈 화면에 추가)를 누르면 앱처럼 설치돼요. 한 번 열어 두면 인터넷 없이도 실행돼요. 저장은 그 기기·브라우저에만 남아요.

## 실행

```bash
python3 -m http.server 8793
```

브라우저에서 `http://localhost:8793`을 열어요.

## 테스트

```bash
npm test
```

## 봇 시뮬레이션

```bash
node tools/sim.js 300 7 0.6 1
```

인자는 플레이 시간(분)·시드·순간 포착 비율·요청 받기(1/0)예요.

## 아이콘 다시 그리기

실행 중인 서버(8793)에서 `tools/icon.html`을 헤드리스 Chrome으로 찍어요.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=3000 --window-size=512,512 --screenshot="$PWD/icons/icon-512.png" "http://localhost:8793/tools/icon.html?s=512"
```

크기는 `s`(192·180·512), 마스커블은 `&m=1`이에요.
