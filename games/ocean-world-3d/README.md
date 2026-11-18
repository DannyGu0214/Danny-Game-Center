# Ocean World 3D

투명한 젤리 블록 속 열대 환초 바다(몰디브형)를 꾸미는 3D 관찰 게임이에요. 생물 8종을 들이고 해저·육지·수중 물건을 놓아 필요를 채우면 관람 수익(⭐)과 발전도가 올라 티어(T1~T8)가 열려요. T8에서는 블록 옆에 확장 영역이 붙어요. 생물이 특별한 행동을 하는 순간을 눌러 "포착"하면 앨범이 채워져요.

브라우저만 있으면 돌아가요(빌드 없음, Three.js 0.187은 `vendor/`에 들어 있음). 설계는 `DESIGN.md`, 진행 계획과 결정은 `PLAN.md`에 있어요.

## 실행

```bash
cd games/ocean-world-3d
python3 -m http.server 8797
# http://localhost:8797/index.html
```

ES 모듈을 쓰므로 `file://`로는 열리지 않아요. 아무 정적 서버나 쓰면 돼요.

## 조작

| 동작 | 방법 |
|---|---|
| 시점 돌리기 | 블록 밖 빈 곳 끌기 · Shift+끌기(블록 위에서도) |
| 확대·축소 | 휠 · 두 손가락 |
| 옮겨 보기 | 오른쪽 끌기 |
| 블록 출렁 | 블록 누르기(누른 자리부터 출렁)·끌기(기울이기) |
| 생물·물건 고르기 | 누르기. 포착 기회가 뜬 생물을 누르면 포착 |
| 들이기·꾸미기 | 오른쪽 판의 생물·꾸미기·요청 탭 |
| 물건 놓기 | 자리 누르기 → `R` 돌리기 · `Enter` 놓기 · `Esc` 취소 |
| 시점 바로가기 | `H` 기본 · `T` 위 · `Y` 옆 |
| 설정 | 오른쪽 위 ⚙️: 출렁임(보통·약하게·끄기), 소리 |

저장은 브라우저 localStorage(`ow3d`)에 5초마다, 그리고 떠날 때 해요.

## 주소 파라미터

`render/main.js` 머리말에 있는 것 그대로예요.

| 파라미터 | 뜻 |
|---|---|
| `?title=0` · `?title=1` | 타이틀 화면 끄기·켜기(기본 켬. `capture`·`perf=1`·`demo`에서는 끔) |
| `?prologue=0` | 새 게임에서 프롤로그 건너뛰기 |
| `?demo=1` · `?n=44` | 견본 장면(T8, 생물 n마리 ≤ 44). 저장하지 않음 |
| `?ext=1` | 확장 영역이 열린 블록(견본 확인용) |
| `?t8soon=1` | 개발용: T8 바로 앞 새 게임. **저장을 덮어써요** |
| `?view=default\|top\|side\|under\|near` | 시작 시점 |
| `?perf=1` | 성능 표시(드로우콜·프레임 시간) |
| `?water=box\|transmission` | 물 방식(기본 box = 투과 없음) |
| `?sigma=1` | 물 흡수 배율(낮을수록 맑음) |
| `?jelly=1` | 젤리 세기(0 끔 ~ 2). 주면 설정 창의 저장값 대신 이 값을 씀 |
| `?shadow=0` `?fog=0` `?caustics=0` `?snow=0` `?shafts=0` `?deform=0` | 기능 끄기(비교용) |
| `?schools=0` · `?school=lowpoly` | 장식 물고기 떼 끄기 · 로우폴리풍 |
| `?lineup=1` | 종마다 한 마리 줄 세우기(변형 확인용) |
| `?sizes=1.35,1.1,0.95,0.85` | 크기 등급(S,M,L,XL) 화면 배율 덮어쓰기 |
| `?capture` · `?hud=1` · `?size=1280x800` · `?dpr=1` | 녹화 모드(`window.__cap.step(dt)`로 진행, 저장 안 함), HUD 함께 그리기, 캔버스 크기, 픽셀 비율 |
| `?spdetail=0.4~1` | 생물 곡면 세밀도(성능 비교용) |

개발 중에는 `index.html?title=0&prologue=0`이 가장 빨리 게임으로 들어가요.

## 폴더

```
index.html            진입점(importmap으로 vendor/의 three를 씀)
manifest.webmanifest  홈 화면 추가용
sw.js                 오프라인 캐시(서비스 워커)
icons/                앱 아이콘(tools/make-icons.mjs가 만듦)
render/               화면: core/(생태계와 무관한 뼈대) · aqua/(물·물고기 떼) · proto/(생물·물건 그리기) · main.js(조립)
sim/                  규칙(Three.js·DOM 없음, node에서 테스트)
eco/atoll/            열대 환초 생태계: 지형·데이터·생물·물건 생성기
ui/                   HUD·타이틀·프롤로그·젤리 반응·설정
audio/                소리(Web Audio 합성)
assets/               프롤로그 그림 등(출처는 assets/CREDITS.md)
vendor/               three.js 0.187
test/                 규칙 테스트(node --test)
tools/                밸런스 봇·녹화·성능 측정·아이콘 생성
docs/                 단계별 보고서·조사
```

## 테스트

```bash
npm test          # node --test test/*.test.js (규칙·저장·지형)
npm run sim       # 밸런스 봇
```

## 오프라인·홈 화면 추가

- https나 localhost에서 한 번 열면 `sw.js`가 게임 파일을 모두 받아 둬요. 그 뒤에는 인터넷 없이도 열려요. 온라인일 때는 늘 새 파일을 먼저 받아요(네트워크 우선).
- 홈 화면 추가: iOS Safari는 공유 → "홈 화면에 추가", Android Chrome은 메뉴 → "앱 설치" 또는 "홈 화면에 추가"예요.
- 녹화 모드(`?capture`)와 claude.ai Artifact 안에서는 서비스 워커를 등록하지 않아요.
- 게임이 불러오는 파일을 더하거나 빼면 `sw.js`의 `CORE` 목록과 `CACHE` 버전(`ocean-world-3d-vN`)을 함께 고쳐요.
- 아이콘을 다시 만들려면 `node tools/make-icons.mjs`를 실행해요.
