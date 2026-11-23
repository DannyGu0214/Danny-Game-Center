# Sailing Master — 큰 바다·대양 기획(M3 큰 바다 · M4 대양 횡단 엔딩)

2026-11-23 초안 · 아직 구현 전이에요. 기준 코드는 M2까지 들어간 `claude/brave-davinci-qqa847`(DESIGN.md 45·46절)이에요. 수치는 첫 제안이고, 봇(`tools/sim.js`)과 시제품으로 정해요.

**한 줄 요약:** 앞바다 북쪽 경계 너머에 **큰 바다** 지도(섬 여럿, 큰 섬의 보급항이 중간 기점)를 붙이고, 거기서 5등급 **대양 탐사선**을 지어요(M3). 그다음 **대양** 지도(남북으로 긴 바다 한 장)를 건너 **새 대륙 항구**에 닿으면 게임의 진짜 엔딩이에요(M4). 새 위협은 **태풍**(움직이는 원)과 **무풍대**예요.

## 1. 로드맵에서의 자리

```
✓ M0 → ✓ M1 담수 3수역 → ✓ S0~S5 체계 심화 → ✓ L1 풍경
  → ✓ M2 앞바다(스쿠너, 엔딩 "큰 바다 앞에서")
  → ▶ M3 큰 바다(이 문서 B0~B7, 대양 탐사선, 엔딩 "대양 앞에서")
  → ▶ M4 대양(이 문서 O0~O6, 새 대륙 항구 = 진짜 엔딩)
```

- DESIGN.md 첫머리의 최종 목표("작은 호수에서 출발해 … 마지막에 대양을 횡단해요")가 M4에서 끝나요. 공간 5등급 규칙(PLAN-M1.5.md 2-1절)대로 **큰 바다는 4등급(스쿠너) 이상, 대양은 5등급(대양 탐사선)만** 들어가요. 5등급 배는 그 앞 공간인 **큰 바다의 보급항**에서 지어요.
- M2와 같은 리듬이에요: 각 마일스톤 안에서 새 배를 짓고, 다음 공간 관문에서 그 단계 엔딩을 봐요. M3의 "대양 앞에서" 엔딩은 O0에서 대양으로 이어지는 관문이 돼요(M2a가 강 끝 엔딩을 앞바다로 바꾼 것과 같아요).
- 합치는 단위는 넷이에요: **M3a = B0~B3, M3b = B4~B7, M4a = O0~O3, M4b = O4~O6.** 하나씩 합치고 배포해요(M2a·M2b와 같아요).
- DESIGN.md 15절의 옛 M3(8등급 선체, 쌍동선 등)·M4(다채로움) 표는 이 문서가 대체해요. 캡슐선·수중익선 같은 형태 선택지는 엔딩 뒤 일로 남겨요(10절).

## 2. 큰 바다 지도(M3)

### 2-1. 모양

```
  N  ░░░░░░░░░░░ 대양 어귀(5등급 관문, 안개) ░░░░░░░░░░░
     ~~ ◦작은 섬 ~~~~~~~~~~~~~~~~~~~~ ◦작은 섬 ~~~~~~~~~~~
     ~~~ ▲바위섬(어촌) ~~~~~~ ███큰 섬███ ~~~~~~~~~~~~~~~~
     ~~~~~~~~~~~~~~~~~~~~~~ ██⚓보급항██ ~~~~~ ◦ ~~~~~~~~
     ~~~ ◦ ~~~ ✱산호초◦ ~~~~ ══조류══▶ ~~~~ ▲화산섬 ~~~~~
     ~~ ▲야자섬(나루) ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ◦ ~~
     ~~~~~~~~~~ ⚓남쪽 등대 항 ~~~~~~~~~~~~~~~~~~~~~~~~~~
  S  ░░░░░░░░ 남쪽 물목(앞바다 등대섬으로) ░░░░░░░░░░░░░░░
```

| 항목 | 제안 | 이유 |
|---|---|---|
| id·이름 | `sea` · 큰 바다 · `order: 4` · `grade: 4` · `theme: 'sea'` | `music.js` `SAIL_SETS`에 이미 `sea`·`ocean` 열쇠가 있어요 |
| 크기 | x −2,000~2,000 × y −1,600~1,600(4,000 × 3,200m) | 앞바다(1,600 × 1,000m)의 약 8배 넓이. "큰 바다"가 몸으로 느껴지게 |
| 모양 종류 | 새 `isles`: 뭍은 섬뿐이고 네 끝은 모두 경계(`edgeDist`)예요 | 지금 `world.js`는 `lake`·`river`·`coast`만 있어요 |
| 거리 격자 | 칸 8m → 약 521 × 421 = 22만 칸 | 앞바다 9.5만 칸(5m)의 2.3배. B0에서 만들기 시간을 재고, 300ms(node)를 넘으면 10m로 올려요 |
| 지도 끝 | 네 끝 120m 짙은 안개 띠(`edgeFog: 120`), 물가처럼 막아요 | 앞바다와 같은 규칙 |
| 기본 확대 | 5.5(앞바다 6.5) | 한 단계 더 넓게 |
| 바람 | `from: -80°`, 세기 11, `swing 0.5`, `gustK 1.5`, `stormK 2.0` | 앞바다보다 세고 고른 바람(무역풍 느낌) |

**섬(`islands`).** 큰 섬은 둥근 섬 함수로는 만(灣)이 안 생기니, 섬에도 해안선 혹 `bumps`(각도 기준)를 받게 해요(B0).

| 섬 | x, y | r(m) | 하는 일 |
|---|---|---|---|
| 큰 섬 | 300, −300 | 420, 남쪽에 만 하나(혹 `[각도 90°, 폭 0.5rad, −160m]`) | 보급항(조선소 5등급), 폭포·측후소 발견지 |
| 남쪽 등대 바위 | −200, 1,350 | 30 | 남쪽 등대 항(시작 항구) |
| 야자섬 | −1,300, 500 | 160 | 야자섬 나루(물·식량만) |
| 화산섬 | 1,400, 700 | 200 | 화산 분화구 발견지, 연기 |
| 서쪽 바위섬 | −1,500, −800 | 110 | 바위섬 어촌 |
| 작은 섬 8개 | (−600,−1100) (900,−1200) (−900,0) (1700,−300) (600,1000) (−300,300) (1200,200) (−1700,1200) | 20~45 | 발견지·쉬어 가는 바위. (−300,300)은 산호초 고리의 가운데 |

**산호초(`shoals`, 조수 있음).** (−300, 300) 둘레에 고리 모양 4곳(수심 0.9~1.2m). 스쿠너(흘수 0.85)는 밀물에만, 대양 탐사선(흘수 1.3)은 밀물 꼭대기에만 넘어가요. 안쪽 석호에 발견지가 있어요.

### 2-2. 항구 4곳과 관문

| 항구 | id | 자리 | 식수(닢) | 역할 |
|---|---|---|---|---|
| 남쪽 등대 항 | `southLight` | 남쪽 등대 바위 | 2 | 앞바다에서 넘어오는 시작 항구. 조선소 4등급 |
| 큰 섬 보급항 | `depot` | 큰 섬 남쪽 만 안 | 1 | **대양 탐사선(5등급)을 짓는 곳**(`yard: 5`). 최고급 재료를 팔아요 |
| 야자섬 나루 | `palm` | 야자섬 동쪽 | 3 | 물·빵·건어만(재료 가게 없음, `shop: false`) |
| 바위섬 어촌 | `rockVillage` | 서쪽 바위섬 | 2 | 교역 수요가 다른 곳 |

| 관문 | 자리 | 조건 | M3에서 | M4에서 |
|---|---|---|---|---|
| 남쪽 물목 `toCoast` | 0, 1,560 근처 | 없음 | 앞바다 `light`(등대섬)으로 | 같음 |
| 대양 어귀 `toOcean` | 0, −1,560 | **5등급** | `to: null` = **M3 엔딩 "대양 앞에서"** | `to: 'ocean'`, entry `lastLight` |
| (앞바다) 큰 바다 경계 `toSea` | 지금 `toOcean` 자리 | 4등급 | id를 `toSea`로, `to: 'sea'`, entry `southLight` | 같음 |

## 3. 큰 바다 체계(M3)

### 3-1. 너울·조류

- 너울: `swell: { base: 1.3, day: 0.4, gust: 0.4, storm: 1.2 }`. 앞바다처럼 남쪽 기준선 개념이 없으니 `isles`의 `swellAt`은 **어디나 1**, 항구 둘레만 잔잔해요(`swell.calm: [{ x, y, r }]`, 항구마다 r 180m 안은 × 0.3). 스쿠너 ★1 내항성 1.8m는 보통 날(1.3~1.7m)은 견디고, 큰 너울 날(+1.0)은 못 견뎌요.
- 조류(`currents`): 선분 `[x0, y0, x1, y1, 폭 w, 세기]` 3개. `flowAt`이 `isles`일 때 선분까지 거리 < w면 선분 방향으로 `세기 × (1 − (d/w)²)`를 더해요.
  - 큰 섬과 화산섬 사이 동쪽으로 0.8m/s(폭 160) · 야자섬과 산호초 사이 북쪽으로 0.6m/s(폭 140) · 서쪽 바위섬 앞 남쪽으로 0.7m/s(폭 120).
  - 강 물살과 같은 길(`flowAt`)을 타니 항로·봇은 손대지 않아도 돼요. 해도에 조류 화살표를 그려요.

### 3-2. 무풍(`calm`, 새 날씨)

```js
calm: { name: '무풍', icon: '🪶', sev: 1, calmFirst: true, when: 'day', chance: { spring: 0.1, summer: 0.25, autumn: 0.1, winter: 0.05 }, salt: 57.1, fx: { wind: 0.15 } }
```

- 하루 내내 바람이 15%예요. 돛으로는 거의 못 가고, 스쿠너는 보조 기관(3.2m/s)이나 노로 가요. 슬루프는 노뿐이에요.
- 예보 칸·출항 점검에 "무풍 — 기관이나 노로 가야 해!"를 띄워요. 무더위와 겹치면 식수가 빨리 줄어 항속 계획(3-3절)이 중요해져요.
- `WX_ORDER`에서 `heat` 앞, `fog` 뒤에 둬요(심함 1끼리는 앞의 것이 이름이 돼요).

### 3-3. 항속 계획

- `logic.js`에 `rangeDays(S)`를 더해요: `min(식량 일수, 식수 일수)`. 식수는 조수기 하루 생산량을 빼고 계산해요. 민물 수역은 식수를 무한으로 봐요.
- 해도 항해 계획(목적지를 누를 때): "가는 데 **n일**(항로 길이 ÷ 지금 배의 평균 돛 속도 × 0.7 ÷ `CAL.day`) · 실은 것 **m일**". n > m × 0.8이면 주황, n > m이면 빨강.
- 출항 점검: 큰 바다·대양에서 가장 가까운 항구까지 항로 길이로 잰 일수가 `rangeDays`보다 길면 경고(출항은 막지 않아요).
- 봇은 이미 "남은 식수 1.5일치 밑이면 항로 길이로 돌아가요"가 있어요. 같은 함수를 쓰게 바꿔요.

### 3-4. 태풍(`typhoon`, 새 날씨, 큰 바다·대양만)

**움직이는 원이에요.** 그날 태풍이 오면 지도 한쪽 끝에서 들어와 직선으로 지나가요. 원 안이 위험하고, **항구에 대 있으면 안전**해요. 바다 위에서는 경로를 보고 비켜 가요.

| 항목 | 값 |
|---|---|
| 확률 | 여름 10% · 가을 12%(봄·겨울 없음). `calmFirst`, `salt: 61.7` |
| 심함 | `sev: 4`(새 최고 단계). `WX_ORDER` 맨 앞 |
| 경로 | 그날 시드로: 시작점 = 서쪽 또는 동쪽 끝 밖 300m, 지나는 점 = 지도 가운데 60% 안의 한 점, 하루의 0.2~0.4에 들어와 150초 동안 건너가요(속도 = 거리 ÷ 150) |
| 원 | 눈 r 80m · 폭풍 원 r 650m · 바깥 원 r 1,300m |
| 효과(`typhoonAt(S, x, y)` → 세기 k) | 폭풍 원: 바람 × 2.6, 너울 +2.4m, 비 1, 돛 찢어짐 1/8초, 보는 거리 × 0.5 · 바깥 원: 폭풍(`storm`)과 같은 효과에 (1 − (d − 650)/650)을 곱해요 · 눈: 바람 × 0.2, 너울 +1.5m, 비 없음 |
| 바람 방향 | 원 안에서는 중심을 도는 방향(북반구처럼 반시계)으로 돌려요. 바깥 원 끝에서 수역 바람과 섞어요 |
| 예보 | 기본 2일 전부터 🌀, 기압계 +1일, 측후소 +2일(B4), 기상사 +1일(O2). 그날이 되면 해도에 **예상 경로 점선과 지금 원**을 그려요 |
| 세 단계 | 전조 = 예보 칸 🌀 "태풍 n일 뒤", 출항 점검 "오늘 태풍 — 항구에서 기다리자고!", 폭풍 곡 · 고비 = 바깥 원에 60초 안에 닿을 것 같으면 "태풍이 다가온다! 비켜!"(거리와 다가오는 속도로 판단), 위쪽 계기판 🌀 거리 · 파국 = 원 안에서 너울·기울기·찢어짐 피해(기존 체계 그대로, 새 피해 종류는 없어요) |
| 항구 | `S.docked`면 태풍 효과를 받지 않아요(지금 날씨 처리와 같아요) |

- 담수·앞바다 날씨 목록에는 넣지 않아요. 수역 `weather` 목록에 `'typhoon'`이 있을 때만 굴려요.
- `when: 'track'`은 새 종류예요. `dayWeather`가 그날 경로(시작점·끝점·시작 시각)를 함께 정해 두고, `weatherAt`이 배 위치로 `typhoonAt`을 불러 `fx`에 합쳐요(바람은 큰 것 하나, 너울은 더하기, 보는 거리는 곱하기 — 44절 규칙 그대로).

## 4. 큰 바다 내용(M3)

### 4-1. 재료 5종(최고급, PLAN-M1.5.md 3-1절)

| id | 이름 | 아이콘 | 계열·등급 | 팔 때 | 살 때(`buyAt: 'sea'`) | 나오는 곳 |
|---|---|---|---|---|---|---|
| `teak` | 티크 | 🌲 | wood 3 | 4 | 12 | 표류물(드묾), 발견지, 가게 |
| `synth` | 합성 돛천 | 🪁 | cloth 3 | 6 | 16 | 발견지, 가게 |
| `syrope` | 합성 로프 | ➿ | rope 3 | 5 | 14 | 표류물, 가게 |
| `steel` | 강판 | ⬛ | metal 3 | 8 | 22 | 발견지, 가게 |
| `chip` | 전자 부품 | 🔌 | mech 3 | 12 | 40 | 발견지, 보급항 가게만(아래) |

- 공방 짝(`WORKSHOP.pairs`)에 `oak → teak`, `canvas → synth`, `tar → syrope`, `plate → steel`을 더해요. 전자 부품은 공방으로 못 만들어요(발견지와 가게만).
- `buyAt: 'sea'`는 큰 바다 항구 모두에서 팔지만 `shop: false`인 야자섬 나루는 빼요. 전자 부품만 `buyPort: 'depot'`(보급항만)이에요. M4에서 `buyAt`을 수역 목록(`['sea', 'ocean']`)도 받게 넓혀요.

### 4-2. 발견지 10곳

| 발견지 | id | 그림 | 자리(`where`) | 보상(첫 제안) |
|---|---|---|---|---|
| 화산 분화구 전망대 | `volcanoRim` | 새 `volcano`(검은 바위 원뿔, 꼭대기 연기) | 화산섬 내륙 40m | 90닢, 강판 6 · 유물 흑요석 조각 |
| 산호초 석호 | `reefLagoon` | 새 `reef`(청록 고리, 산호 무늬) | 물 위, 석호 안 | 70닢, 합성 돛천 10, 전자 부품 1 · 유물 분홍 산호 가지 |
| 옛 탐험대 난파선 | `expWreck` | `wreck`(크기 1.6배) | 물 위 | 80닢, 티크 40, 강판 8 · **대양 탐사선 설계도** · 유물 탐험대 항해 일지 |
| 거북 알 해변 | `turtleBeach` | 새 `turtlebeach`(모래 위 둥지 자국, 작은 발자국 줄) | beach | 50닢, 합성 로프 6 · 유물 거북 등무늬 조약돌 |
| 해식 아치 | `seaArch` | 새 `arch`(물가 바위 아치) | shore | 60닢, 합성 돛천 15 · 유물 아치 밑 소라 나팔 |
| 큰 섬 폭포 | `islandFalls` | 새 `falls`(절벽 폭포, 물보라) | 큰 섬 내륙 50m | 80닢, 티크 30 · 유물 폭포 뒤 이끼 낀 종 |
| 버려진 측후소 | `oldStation` | `tower` | 큰 섬 내륙 30m | 60닢, 전자 부품 2 · **측후소 설계도** · 유물 깨진 기압계 |
| 떠도는 유리 부표 | `glassFloats` | 새 `glassfloat`(그물에 엮인 초록 유리 공) | 물 위 | 40닢, 합성 로프 6 · 유물 초록 유리 공 |
| 무인 등대 | `farLight` | `lighthouse` | 작은 섬(900, −1200) 물가 | 60닢, 강판 4 · 해무 불빛(`lights` r 260) |
| 야자 숲 옛 제단 | `palmShrine` | `shrine` | 야자섬 내륙 35m | 65닢, 티크 15 · 유물 조개 박은 나무 가면 |

- 자리 규칙은 46절 그대로예요(판마다 자리, 경계 70m 안은 빼요). 새 그림 6종(volcano·reef·turtlebeach·arch·falls·glassfloat)은 `art.js` 발견지 그림 표에 더해요.
- 「무인 등대」는 자리를 고정해요(작은 섬 위에 등대가 서야 해서). 고정 발견지는 `fixed: true`로 `randomFinds`가 건너뛰게 해요.

### 4-3. 생물 8종(`region: 'sea'`)

| 생물 | id | 틀(`creatures.js`) | 움직임 |
|---|---|---|---|
| 날치 떼 | `flyingfish` | 새 `flyfish` | 다섯 마리가 물 위로 뛰어 1~2초 미끄러져요. 배가 4m/s 넘으면 뱃머리 앞에서 자주 |
| 참치 떼 | `tuna` | `fish`(len 1.2, school 4) | 물속 그림자 |
| 상어 | `shark` | 새 `fin` | 등지느러미만 물을 가르며 큰 원을 돌아요. **공격하지 않아요** |
| 만타가오리 | `manta` | 새 `manta` | 넓은 그림자로 천천히, 가끔 물 위로 뛰어요 |
| 앨버트로스 | `albatross` | `bird`(wing 2.2, 느리게) | 긴 날개로 크게 돌아요 |
| 군함조 | `frigatebird` | `bird`(검정, 붉은 목주머니) | 높이 떠요 |
| 슴새 | `shearwater` | `bird`(wing 1.2) | 물 위 낮게 |
| 야자집게 | `coconutcrab` | `crab`(크기 1.6, `tide` 없음) | 섬 해변. 지금 `crab`은 밀물이면 사라지니 `def.tide`가 없을 땐 그 줄을 건너뛰게 해요 |

### 4-4. 표류물·교역·도전과제

- 표류물(`flot`): 한도 36. 잡목 1 · 참나무 1.5 · 티크 0.8 · 그물 뭉치 2 · 합성 로프 0.8 · 철판 1 · 강판 0.4 · 톱니 0.5 · 물통 3(2~3통) · 반짝이는 곳 6(1~2개).
- 교역(`trade`): 도자기 3 · 비단 4 · 미술품 1.2 · 향신료 2. 찾는 품목(`demand`): 향신료·비단.
- 도전과제(B3·B5·B7에서 나눠 넣어요):

| id | 이름 | 조건 | 닢 | 단계 |
|---|---|---|---|---|
| `openSea`(바꿈) | 큰 바다 앞에서 → **큰 바다에 닿다** | 4등급 배로 큰 바다에 처음 닿기 | 80 | B0 |
| `seaIsles` | 섬과 섬 사이 | 큰 바다 발견지 모두 찾기 | 60 | B3 |
| `typhoonSafe` | 태풍을 비켜 가다 | 바다 위에서 태풍 하루를 태풍 피해 없이 넘기기 | 40 | B2 |
| `islandNaturalist` | 섬 바다 박물학자 | 큰 바다 생물 모두 기록 | 60 | B3 |
| `explorer` | 대양 탐사선 | 대양 탐사선 짓기 | 60 | B5 |
| `oceanGate` | 대양 앞에서 | 5등급 배로 대양 어귀 넘기(M3 엔딩, M4에선 대양에 처음 닿기) | 100 | B7 |

- 칭호(`TITLES`)에 「큰 바다 항해사」를 더해요(B0). `index.html`이 `TITLES[가 본 수역 수 − 1]`로 고르니 줄 하나면 돼요.

## 5. 선원·모듈(M3)

### 5-1. 역할 4개를 열어요(`future` 해제)

| 역할 | 자리 | 효과 | 후보가 나오는 곳 | 고용·보수 |
|---|---|---|---|---|
| 요리사 `cook` | 조리실 `cook` | 배 전체 식량 소비 × (1 − 0.25 × 효과), 하루 한 번 사기 +5% | 앞바다~ | 20 · 2 |
| 갑판장 `bosun` | 돛 `sail` | 같은 배 갑판원 효과 × (1 + 0.25 × 효과), 돌풍·태풍 규칙 축범이 예고 즉시, 돛 바꾸는 시간 절반 | 앞바다~ | 30 · 3 |
| 기관사 `engineer` | 기관 `engine`(새 자리) | 보조 기관 속도 × (1 + 0.15 × 효과), 무풍 날 기관이 돛보다 먼저 돌아요 | 앞바다~ | 30 · 3 |
| 의무원 `medic` | 의무실 `medic` | 기력 회복 × 1.5, 무더위·목마름 기력 감소 × 0.6, 선원 피로 회복 × 1.5 | 큰 바다~ | 30 · 3 |

- `ROLES`의 `region`을 각각 `'coast'`·`'coast'`·`'coast'`·`'sea'`로 바꿔요(지금은 모두 `'river'`인 자리 값이에요).
- **기관 자리:** 스쿠너·대양 탐사선 선체에 `engineAt: [x, y]`(고물 쪽 갑판 칸 하나)를 더하고, `SEATS`에 `engine: '기관'`을 더해요. 조타 자리처럼 모듈 없이 생겨요.
- `SEATS`에 `cook: '조리'`, `medic: '의무'`도 더해요.

### 5-2. 모듈 4개를 열어요

| 모듈 | 칸 | 값(첫 제안) | 조건 | 효과 |
|---|---|---|---|---|
| 조리실 `galley` | 1 × 1 | 참나무 8 · 철판 2 · 쇠못 4 | 4등급 | 요리사 자리. 요리사 없이도 식량 소비 × 0.9 |
| 의무실 `sickbay` | 1 × 1 | 참나무 6 · 범포 6 · 금화 30 | 4등급 | 의무원 자리 |
| 휴게실 `lounge` | 2 × 2 | 참나무 16 · 범포 8 · 금화 20 | 4등급 | 쉼 자리 2개, 쉬는 동안 사기 회복 × 2 |
| 측후소 `station` | 1 × 1 | 철판 4 · 톱니 2 · 금화 40, 설계도(버려진 측후소) | 4등급 | 기압계 다음 Mk. 예보 +4일(기압계 +2 대신), 태풍 예보 +2일 |

- `oar2`(큰 노 자리)는 `future` 그대로 둬요(쓸 곳이 없어요).

### 5-3. 선원 쓸모 고치기(46절 "다음 조정 후보")

46절 봇에서 바다는 **선원 없는 쪽이 11분 빨랐어요.** 스쿠너·대양 탐사선은 일손이 필수라 이번에 같이 고쳐요.

- **옮겨 탈 때 선원이 남아요:** 새 배 정원 안이면 그대로 타고, 자리만 다시 앉아요(지금은 모두 내려요). 정원이 줄 때만 숙련 낮은 사람부터 내려요.
- **바다 품삯:** 짠물 수역에서는 품삯 × 0.75(바다 보너스로 교역 수입이 커서 상쇄) — 봇으로 확인하고 숫자만 다듬어요.
- 완료 기준: 봇 시드 1~12에서 "선원 배치"가 "선원 없음"보다 큰 바다 체류가 짧거나 같아요.

## 6. 대양 탐사선(M3, 5등급)

| 칸 | 길이·폭 | 칸 수 | 정원(일손) | 내구도 | 값(첫 제안) | 짓는 곳 |
|---|---|---|---|---|---|---|
| ★1 | 22 × 5.8m | 약 82 | 12(6) | 400 | 티크 120 · 합성 돛천 60 · 강판 24 · 합성 로프 30 · 전자 부품 6 · 금화 400 | 큰 섬 보급항(조선소 5등급), 설계도(옛 탐험대 난파선) |
| ★2 선체 연장 | 27 × 6.0m | 약 114 | 14 | 400 | 티크 140 · 합성 돛천 60 · 강판 20 · 금화 320 | 보급항 |
| ★3 보강 · 항해 함교 | 27 × 6.0m | 약 114 | 16 | 520 | 티크 160 · 합성 돛천 80 · 합성 로프 40 · 강판 30 · 전자 부품 4 · 금화 450 | 보급항 |

```js
// data.js 초안. cols·rows·cell·x0는 ship.js 윤곽 계산으로 칸 수(82·114)에 맞춰 다듬어요
const explorer = { id: 'explorer', kind: 'explorer', star: 1, grade: 5, name: '대양 탐사선', len: 22, beam: 5.8, deck: 1.8, cols: 6, rows: 18, cell: 0.9, x0: 10, drag: 1.1, row: 2, turn: 0.3, stability: 2.4, buoy: 420, draft: 1.3, crew: 12, minCrew: 6, foodBase: 24, holdBase: 80, waterBase: 20, helmX: -9, cockpit: [-10.2, -7.8], engineAt: [-8.4, 0.9], hp: 400, yard: 5, speed: 1.7, motor: 4.2, maxMasts: 3, sprit: 2.6, blueprint: 'explorer', price: { /* 위 표 */ } };
```

- **★3 고유 개조 「항해 함교」**(PLAN-M1.5.md 2-2절): 예보 +2일, 선장이 조타 자리에 있으면 돛을 바꿀 때 돛대까지 걷지 않아요. 일등 항해사 자리(`bridge`)는 O2에서 열어요.
- **돛대 셋:** `maxMasts: 3`. 새 모듈 **큰 주돛대** `mast_l`(Mk4, 1 × 2칸, 돛 1.6, 높이 19m, 붐 6.5m, 티크 18 · 합성 돛천 24 · 합성 로프 8 · 강판 4 · 금화 30, `need: { grade: 5 }`). 돛 넓이 = 가장 큰 돛 + 나머지 × 0.85(46절 규칙 그대로) → 큰 주돛대 + 주돛대 + 돛대 = 약 3.6. `SH.mastProblem`의 셋째 돛대 규칙(`many`)은 `maxMasts`를 이미 읽으니 숫자만 맞아요.
- **보조 기관:** 4.2m/s(스쿠너 3.2), 켜지는 규칙은 46절 그대로(돛 속도가 기관보다 약할 때). 연료 없음(M2 결정 6 그대로).
- **흘수 1.3m:** 강 여울(0.95~1.1m)에 걸려요. 강·호수 관문에 `maxGrade: 4`를 더해 탐사선은 **앞바다까지만** 돌아가요(관문 팻말 "배가 너무 커! 이 물길엔 못 들어가"). 열린 결정 8.
- **그림:** `art-ship.js`에 `explorer` 선체(쇠띠 두른 나무 선체, 흰 갑판실, 작은 굴뚝(기관), 앞·가운데·뒤 돛대). 배율은 46절 `pxOf`가 저절로 정해요(22m → 10px/m, 27m → 8px/m). `atlasBounds` 테스트로 64방향이 칸 안에 드는지 확인해요.
- **설계 화면:** 114칸을 390px에 놓으면 칸이 작아져요. B5에서 칸 크기를 재서 **30px 밑이면 격자만 세로로 스크롤**되게 해요(두 손가락 확대는 하지 않아요). 모든 칸을 눌러 그 칸에 놓이는지 브라우저로 확인해요.
- 조선소 사다리(`HULL_TIERS[4]`)의 `kind: null`을 `'explorer'`로 바꿔요.

## 7. 대양 지도(M4)

### 7-1. 모양: 남북으로 긴 바다 한 장

```
  N  ▓▓▓▓▓▓▓ 새 대륙(절벽·⚓새 대륙 항구) ▓▓▓▓▓▓▓   y ≈ −11,600
     ~~~~~~~~~~~ 편서풍 띠(세고 차가운 바람) ~~~~~~~~~
     ~~~~~~ ◇둘째 산호섬(나루) ~~~~~~~~~~~~~~~~~~~~   y −8,000
     ░░░░░░░░░ 무풍대(바람 거의 없음) ░░░░░░░░░░░░░   y −4,500 ~ −7,000
     ~~~~~~ ◇첫째 산호섬(나루) ~~~~~~~~~~~~~~~~~~~~   y −4,000
     ~~~~~~~~~~~ 무역풍 띠(옆~뒷바람) ~~~~~~~~~~~~~
  S  ⚓마지막 등대 ═ 남쪽 물목(큰 바다 보급항으로)         y ≈ 250
```

| 항목 | 제안 | 이유 |
|---|---|---|
| id·이름 | `ocean` · 대양 · `order: 5` · `grade: 5` · `theme: 'ocean'` · `zoom: 5` | |
| 크기 | x −900~900 × y −12,000~400(1,800 × 12,400m) | 세로 화면에 맞는 긴 띠. 탐사선 평균 6~8m/s면 25~35분(8~12일) |
| 모양 종류 | 새 `strip`: 동·서·남 끝은 경계, **북쪽은 새 대륙 해안선**(앞바다 `coastLine`을 뒤집어 `y ≤ f(x)`가 뭍) | 띠 한 장이라 관문·저장이 단순해요 |
| 거리 격자 | 칸 10m → 약 197 × 1,257 = 25만 칸 | O0에서 재요. 길 찾기(8m BFS)가 길어지면 대양에서만 16m 칸 |
| 지도 끝 | 동·서·남 150m 안개 띠 | |
| 해도 | 띠 전체가 한 화면에 안 들어가요. **해도는 지금 위치 ±2,000m 창 + 오른쪽 가장자리에 전체 띠 막대**(내 위치·항구·태풍 표시, 누르면 그 자리로 창 이동) | |

**항구 4곳**

| 항구 | id | y | 하는 일 |
|---|---|---|---|
| 마지막 등대 | `lastLight` | 250 | 큰 바다에서 넘어오는 시작 항구. 식수 2 |
| 첫째 산호섬 | `atollA` | −4,000 | 물·빵·건어만(`shop: false`), 식수 3 |
| 둘째 산호섬 | `atollB` | −8,000 | 같음 |
| 새 대륙 항구 | `newLand` | 약 −11,560 | **처음 대면 엔딩**(8절). 가게 전부, 조선소 5등급, 수요 커피·도자기 × 2 |

- 관문: 남쪽 물목 `toSea`(조건 없음, 큰 바다 `depot`으로). 큰 바다 대양 어귀는 O0에서 `to: 'ocean'`, entry `lastLight`가 돼요.
- 산호섬 둘레에 산호초 고리(조수 없음, 수심 1.6~2.0m라 탐사선도 지나가요. 그림만 얕은 물).

### 7-2. 바람 띠와 무풍대(O1)

- `windBands: [{ y0, y1, from, speed }]`: `windAt`이 배 y로 띠를 골라요. 띠 경계 300m에서 섞어요.

| 띠 | y | 바람 |
|---|---|---|
| 무역풍 | 400 ~ −4,300 | 동남쪽에서 세기 10(북쪽으로 가는 배에 옆~뒷바람) |
| 무풍대 | −4,500 ~ −7,000 | 세기 1.5, `swing` 크게. 무더위 확률 두 배 |
| 편서풍 | −7,200 ~ −12,000 | 서쪽에서 세기 13, 돌풍 잦음(`gustK 1.6`) |

- 무풍대는 **지도에 고정**이에요(큰 바다의 무풍 날씨와 달리 예보가 아니라 해도에 빗금 띠로 늘 보여요). 기관·노·태양광으로 건너요.
- 너울: `base 1.8`, 편서풍 띠 × 1.2, 무풍대 × 0.5.
- 날씨 목록: `storm`, `gust`, `squall`, `seafog`, `heat`, `bigswell`, `typhoon`.

### 7-3. 물 대기(O1)

8일 넘게 7~12명이 마셔요. 물통만으로는 칸이 모자라니 셋을 더해요.

| 장치 | 효과 | 값(첫 제안) |
|---|---|---|
| 탐사선 기본 물칸 | `waterBase: 20` | 선체 |
| 빗물받이 `raincatch` | 1 × 1, 비(소나기·폭풍·태풍 바깥 원) 동안 20초마다 1통 | 합성 돛천 6 · 합성 로프 2 · 4등급 |
| 조수기 | 46절 그대로(하루 2통). 탐사선엔 여럿 달 수 있어요 | |
| 산호섬 나루 | 식수 3닢 | |

- 완료 기준: 봇이 산호섬 두 곳을 들르면 식수 때문에 쓰러지지 않고, 건너뛰면 고비(경고)가 와요.

### 7-4. 빨리 가기 ⏩(O0)

- 큰 바다·대양에서 **×1 · ×2 · ×4** 단추. `index.html`이 프레임마다 `G.step`을 그 수만큼 불러요(고정 시간 단계 1/30초 그대로라 규칙은 안 바뀌어요).
- 켤 수 있는 때: 입항 아님, 물가 200m 밖, `fx.soon`·`fx.on` 중 심함 2 이상 없음, 태풍 바깥 원 + 300m 밖. 하나라도 깨지면 저절로 ×1로 돌아오고 한 번 알려요("바람이 수상해! 천천히 가자고").
- 경고 이벤트(`emit`)가 나오면 그 프레임에 바로 ×1이에요.

## 8. 대양 내용과 엔딩(M4)

### 8-1. 장비·역할(O2)

| 무엇 | 효과 | 값·조건 |
|---|---|---|
| 기상사 `weather` 역할 | 측후소·기압계 자리. 예보 +1일, 태풍 예상 경로를 하루 전부터 해도에 | 고용 35 · 보수 3, 큰 바다~, 5등급 |
| 일등 항해사 `mate` 역할 | 함교 자리 `bridge`(탐사선 선체에 `bridgeAt`). 다른 선원 효과 +10%, 피로 쌓임 −20%, 선장이 키를 떠나도 조타수 몫 | 고용 50 · 보수 4, 큰 바다~, 5등급 |
| 자동 조타 `autohelm` | 조타 Mk3. 사람 없이 항로 유지·자동 태킹 | 강판 4 · 전자 부품 2, 5등급 |
| 태양광 패널 `solar` | 2 × 1. 보조 기관 속도 +0.5m/s(2장까지), 비·해무·태풍 때 절반 | 전자 부품 2 · 강판 2 · 합성 돛천 4, 5등급 |

- 태양광은 배터리 없이 **보조 기관을 세게 하는 것**으로만 둬요(밤 그림이 아직 없어요). 무풍대를 건너는 주된 수단이에요.

### 8-2. 발견지 8곳(O3)

| 발견지 | 그림 | 자리 | 비고 |
|---|---|---|---|
| 떠도는 해초 숲 | 새 `kelp`(물 위 갈색 해초 매트) | 물 위, 무풍대 | 합성 로프 |
| 해저 화산 김 | 새 `vent`(물 위 김·거품 고리) | 물 위 | 강판 · 유물 뜨거운 부석 |
| 빙산 | 새 `iceberg`(흰·하늘빛 덩어리, 물 밑 그림자) | 물 위, 편서풍 띠 북쪽 끝 | 펭귄이 올라가 있어요 |
| 고래가 모이는 바다 | 새 `whalespot`(물 위 거품 고리·물보라) | 물 위 | 고래 셋이 자주 나와요 |
| 옛 탐험대의 표류병 | `bottle`(병 속 편지 그림 재사용) | 물 위 | 탐험대 난파선(큰 바다)과 이어지는 짧은 글 |
| 무인 기상 부표 | `buoy` | 물 위, 무역풍 띠 | 전자 부품 2 |
| 석호의 쪽배 | `beached` | 첫째 산호섬 물가 | 티크 |
| 새 대륙 절벽 표지 | `stone` | 새 대륙 내륙 30m | 유물 「건너편 사람들의 표지석」 |

### 8-3. 생물 8종(O3, `region: 'ocean'`)

| 생물 | 틀 | 비고 |
|---|---|---|
| 혹등고래 | 새 `whale` | 떠올라 숨 쉬고(물기둥), 꼬리를 들고 잠수. **드물게 뛰어올라요(브리칭)** |
| 향유고래 | `whale`(뭉툭한 머리, 비스듬한 물기둥) | |
| 대왕고래 | `whale`(크기 2.6, 아주 드묾) | |
| 참돌고래 떼 | `dolphin`(group 5) | 뱃머리 타기 그대로 |
| 개복치 | 새 `sunfish` | 물 위에 납작 누워 떠 있어요 |
| 바다제비 | `bird`(작고 빠름) | |
| 펭귄 | 새 `penguin` | 빙산 위에만 |
| 앨버트로스(대양) | 큰 바다 것 재사용 안 함 → 대신 **슴새 떼** `bird`(group) | 도감 중복을 피해요 |

- **고래 브리칭 순간:** 배에서 120m 안 고래가 90초에 한 번꼴로 3초 동안 뛰어올라요. 그때 탭하면 도전과제 「고래의 도약」(46절 돌고래 뱃머리와 같은 금빛 고리 방식).

### 8-4. 도전과제(O3·O4)

| id | 이름 | 조건 | 닢 |
|---|---|---|---|
| `whaleLeap` | 고래의 도약 | 뛰어오르는 고래 기록 | 50 |
| `doldrums` | 무풍대를 건너 | 무풍대를 남에서 북으로 지나기 | 40 |
| `oceanNaturalist` | 대양 박물학자 | 대양 생물 모두 기록 | 80 |
| `oceanAll` | 대양의 지도 | 대양 발견지 모두 찾기 | 80 |
| `crossOcean` | 대양을 건너 | 새 대륙 항구에 닿기(엔딩) | 150 |

칭호에 「대양 항해사」(O0)를 더해요.

### 8-5. 엔딩(O4)

```
새 대륙 항구 첫 입항
  ─▶ 화면이 천천히 멀어지며 엔딩곡 시작(이야기 화면은 2초 뒤)
  ─▶ 엔딩 이야기 3쪽(출항 이야기 화면 재사용)
        1쪽 공통 「새 대륙」          그림 endArrival
        2쪽 선장별 「그 뒤의 이야기」   그림 endSailor / endLucky / endTrader / endCrafter
        3쪽 공통 「계속되는 항해」      그림 endCrew + 기록(항해 km·날짜·구조·도전과제·도감) + 만든 이 Danny Soft
  ─▶ [이 바다에서 계속 항해] → 새 대륙 항구에 대 있음
```

- **선장별 2쪽**은 출항 이야기를 닫아요: 우편 기수는 가장 먼 곳에서 어머니께 편지를 부치고, 운빨은 궤짝 해도의 빈칸을 자기 손으로 채우고, 거래술은 처음 보는 물건을 사고 판 첫 장사를 하고, 기능공은 손주에게 "진짜 배"를 보여 줄 편지를 써요. 문장은 `STORIES`와 같은 서술 말투(해요체 서술)로, 뱃사람 말투는 대사에만 써요. 초안은 O4에서 쓰고 대니님 확인을 받아요.
- 상태: `S.crossed`(처음 닿은 날짜, 없으면 `null`). 처음 닿을 때만 엔딩이고, 다시 오면 보통 항구예요. 엔딩 중엔 `S.ended = true`(지금 엔딩 흐름 재사용), 닫으면 `false`.
- 타이틀: `S.crossed`가 있으면 타이틀 그림이 새 대륙 해안 + 탐사선이에요(`best`와 같은 방식).
- M3 엔딩 문구("대양 앞에서")와 `passGate`의 `to: null` 갈래는 O0에서 관문이 대양으로 이어지면 쓰이지 않아요. 갈래는 남기고 주석을 "지금 쓰는 곳 없음"으로 바꿔요.
- 그림·곡이 아직 없으면 캔버스 장면(지금 출항 이야기의 대체 그림처럼)과 합성곡으로 대신해요.

## 9. 작업 순서와 코드 영향

규모: S = 반나절, M = 하루, L = 하루 넘게(하위 에이전트 한 명 기준).

### 9-1. M3 큰 바다

| 단계 | 할 일 | 고치는 파일 | 저장 | 규모 |
|---|---|---|---|---|
| **B0 지도 시제품** | `isles` 모양(섬 `bumps`, 네 끝 경계), `REGIONS.sea`(2절 섬·항구 4·관문 2, 발견지는 자리 표시용 임시 3곳), `REGION_ORDER`에 `sea`, 앞바다 관문 `toSea`, 임시 테마 `sea`(앞바다 복사 + 야자수 없이), 칭호, `openSea` 뜻 바꾸기, 해도 맞춤 | `world.js`, `data.js`, `logic.js`, `themes.js`, `index.html` | **v8** | L |
| **B1 바다 체계** | 너울(항구 둘레 잔잔), 조류 3개(`flowAt`), 무풍 날씨, 항속 계획(`rangeDays`·해도·출항 점검) | `world.js`, `data.js`, `logic.js`, `index.html`, `art.js`(조류 화살표) | v8 | M |
| **B2 태풍** | `when: 'track'`, `typhoonAt`, 예보·해도 경로·원, 바람 회전, 세 단계 알림, 항구 대피, 도전과제 `typhoonSafe`, 봇 규칙 | `data.js`, `logic.js`, `art.js`, `index.html`, `music.js`(`moodOf`), `tools/sim.js` | v8 | L |
| **B3 내용** | 재료 5·공방 짝·가게, 발견지 10(새 그림 6), 생물 8(새 틀 3), 표류물·교역, 도전과제 2 | `data.js`, `logic.js`, `world.js`(`fixed`), `art.js`, `creatures.js` | v8 | L |
| **B4 선원·모듈** | 역할 4·자리 3(engine·cook·medic), 모듈 4, 옮겨 탈 때 선원 남기기, 바다 품삯 | `data.js`, `logic.js`, `ship.js`, `art-ship.js`(모듈 단면 4), `index.html` | 바뀌면 v9 | M |
| **B5 대양 탐사선** | 선체 ★1~3, 큰 주돛대, 돛대 셋, 기관 4.2, 함교, 조선소 5등급, 강·호수 `maxGrade`, 선체 그림, 설계 화면 스크롤, 도전과제 `explorer` | `data.js`, `ship.js`, `art-ship.js`, `logic.js`, `index.html`, `tools/ship-preview.html` | 바뀌면 v9 | L |
| **B6 풍경·소리** | 테마 `sea`(아래 10-1절), 항구 집 `islehut`, 소리(태풍 바람·고래 없음), 음악 연결 | `themes.js`, `art.js`, `sound.js`, `music.js` | – | M |
| **B7 마감** | 대양 어귀 엔딩 "대양 앞에서", `oceanGate`, 봇(큰 바다 → 탐사선 → 대양 어귀), 측정, DESIGN.md 47·48절, 서비스 워커 캐시 | `index.html`, `logic.js`, `tools/sim.js`, `sw.js`, `DESIGN.md`, `README.md` | – | M |

**저장 v8(B0, 그 뒤 B1~B3도 같은 v8 안에서 기본값만 채워요)**
- v7 중 `ended && region === 'coast'`(스쿠너로 큰 바다 경계를 넘어 M2 엔딩을 본 저장): `ended = false`, 앞바다 `light`(등대섬)에 대 둬요. 북쪽으로 가면 바로 큰 바다예요. `openSea` 도전과제는 그대로라 금화를 다시 주지 않아요.
- `route`가 옛 관문 id `toOcean`을 가리키면 `null`로 비워요.
- `stats.typhoons`·`stats.typhoonHurt`·`stats.calmDays` 0, 새 재료 5종 창고 0.
- **v9(M3b):** 선원 `seat`가 새 자리 이름과 부딪히는지만 확인해요. 저장 모양이 바뀌지 않으면 올리지 않고 DESIGN.md에 "v8 그대로"라고 적어요. 바뀌면 v9로 올리고 기본값을 채워요.

### 9-2. M4 대양

| 단계 | 할 일 | 고치는 파일 | 저장 | 규모 |
|---|---|---|---|---|
| **O0 지도 시제품** | `strip` 모양(북쪽 새 대륙 해안선), `REGIONS.ocean`(항구 4·관문), 큰 바다 대양 어귀 → 대양, ⏩ 빨리 가기, 해도 창 + 전체 띠 막대, 칭호, `oceanGate` 뜻 바꾸기 | `world.js`, `data.js`, `logic.js`, `index.html` | **v9(또는 v10)** | L |
| **O1 바람 띠·물** | `windBands`, 무풍대 띠(해도 빗금), 대양 너울, 빗물받이, `buyAt` 수역 목록, 물 계획 봇 규칙 | `data.js`, `logic.js`, `world.js`, `art.js`, `index.html`, `tools/sim.js` | 같음 | M |
| **O2 장비·역할** | 대양 태풍(대피 항구 없음 → 비켜 가기), 기상사·일등 항해사, 자동 조타, 태양광 | `data.js`, `logic.js`, `ship.js`, `art-ship.js`, `index.html`, `tools/sim.js` | 같음 | M |
| **O3 내용** | 발견지 8(새 그림 4), 생물 8(새 틀 3), 고래 브리칭 순간, 도전과제 4 | `data.js`, `world.js`, `art.js`, `creatures.js`, `logic.js` | 같음 | L |
| **O4 엔딩** | `S.crossed`, 엔딩 흐름·3쪽, 선장별 글, 엔딩곡, 기록·만든 이, 타이틀 바꾸기, `crossOcean` | `logic.js`, `index.html`, `art-story.js`, `data.js`(`ENDINGS`), `music.js` | 같음 | M |
| **O5 풍경·소리·음악** | 테마 `ocean`·`newland`(10-1절), 새 대륙 항구 집 `cityhut`, 고래 노래·물기둥·뱃고동, 새 곡 연결 | `themes.js`, `art.js`, `sound.js`, `music.js` | – | M |
| **O6 마감** | 봇 처음부터 엔딩까지, 측정, 에셋 반영(`READY`·manifest `status`), DESIGN.md 49·50절, README, 서비스 워커 캐시, 게임 센터 설명 | `tools/sim.js`, `sw.js`, `DESIGN.md`, `README.md`, `docs/asset-manifest.yaml` | – | M |

**저장(O0):** 번호는 M3 마지막 번호 + 1이에요. `S.crossed: null`, `stats.crossDays: 0`을 채워요. ⏩ 배속은 저장에 넣지 않고 늘 ×1로 시작해요(소리 설정처럼 따로 두지도 않아요).

### 9-3. 테스트 추가

새 파일 `test/opensea.test.js`(M3)와 `test/ocean.test.js`(M4)에 넣어요. 지금 119개는 모두 그대로 통과해야 해요.

| 단계 | 테스트 |
|---|---|
| B0 | `isles` 격자: 섬 안은 뭍, 네 끝 바깥은 `dist < 0`, 항구 4곳이 물가 12m 안 · 앞바다 → 큰 바다 → 앞바다 왕복(스쿠너 통과, 슬루프는 막힘) · 저장 v7(M2 엔딩 본 것) → v8 |
| B1 | 조류 선분 위에서 `flowAt` 방향·세기 · 무풍 날 바람 × 0.15, 스쿠너 기관이 돎 · `rangeDays`(식량·식수·조수기) · 출항 점검 항속 경고 |
| B2 | 같은 시드·날짜면 같은 경로 · 원 안 효과(바람·너울·비)와 거리별 세기 · 항구에 대 있으면 효과 0 · 예보 일수(기본·기압계·측후소) · 담수·앞바다엔 안 옴 · `typhoonSafe` |
| B3 | 발견지 10곳 자리(시드 1~8, 경계·항구 거리), 고정 발견지 · 공방 최고급 짝 · `buyPort` · 야자집게가 밀물에도 남음 · 도전과제 2 |
| B4 | 역할 4 효과(식량 소비·갑판원 배율·기관 속도·기력 회복) · 옮겨 탈 때 정원 안 선원 남음 · 측후소 예보 +4 |
| B5 | 탐사선 짓기(보급항에서만, 설계도·재료) · `atlasBounds` ★1~3 칸 안 · 돛대 셋 규칙(`near`·`many`) · 기관 4.2 · 강·호수 관문 `maxGrade` · 함교 |
| B6 | 큰 바다 풍경 겹침 0(L1·C5와 같은 검사, 시드 1~8) |
| B7 | 실제 탐사선으로 대양 어귀 넘기 → 엔딩 · `oceanGate` |
| O0 | `strip` 격자(북쪽 해안 뭍, 남쪽 경계) · 큰 바다 ↔ 대양 왕복 · ⏩가 같은 시드에서 ×1과 같은 결과(같은 단계 수면 같은 상태) · 저장 번호 올림 |
| O1 | 바람 띠 고르기·경계 섞기 · 무풍대 바람 · 빗물받이 · 대양 너울 |
| O2 | 대양 태풍(대피 없음) · 기상사·일등 항해사 효과 · 자동 조타가 사람 없이 태킹 · 태양광(날씨 절반) |
| O3 | 발견지 8곳 자리 · 고래 브리칭 탭 → `whaleLeap` · 펭귄은 빙산 위만 · 도전과제 |
| O4 | 새 대륙 항구 첫 입항 → `ended`·`crossed`·`crossOcean`, 두 번째 입항은 엔딩 없음 · 다시 불러오기 |
| O5 | 대양·새 대륙 풍경 겹침 0 |

### 9-4. 완료 기준

**공통(단계마다):** `npm test` 통과 · 브라우저 전체 흐름 콘솔 오류 0 · 390 × 844 가로 넘침 없음 · 해당 DESIGN.md 절 갱신.

| 단계 | 그 단계만의 완료 기준 |
|---|---|
| B0 | 스쿠너로 남쪽 등대 항 → 큰 섬 보급항 → 대양 어귀 표지까지 오류 없이 가요. 장면 만들기 + 첫 그림이 CPU 4배 저속에서 앞바다의 2배 안 |
| B1 | 조류 화살표와 실제 밀림이 같은 쪽 · 무풍 날 슬루프는 노, 스쿠너는 기관으로 감 · 해도 항해 계획에 n일/m일 |
| B2 | 봇 시드 1~12: 태풍 날 항구에서 기다리면 피해 0 · 무시하는 봇(`reckless`)은 피해가 나지만 가라앉기 전에 원을 벗어날 수 있어요(전조 → 고비 → 파국 순서) |
| B3 | 도감·도전과제 화면에 큰 바다 칸 · 발견지 10곳을 다 찾을 수 있음(봇) |
| B4 | 5-3절 기준(선원 배치 ≤ 선원 없음, 큰 바다 체류) |
| B5 | 탐사선 ★1·★2가 잘리지 않고 그려짐 · 설계 화면 모든 칸이 눌림 · 봇이 탐사선을 지음 |
| B6 | 큰 바다 프레임(배율 2)이 앞바다 측정(24~34fps)보다 10% 넘게 떨어지지 않음 |
| B7 | 봇 시드 1~12: 큰 바다 체류 **50~70분**, 큰 바다 구조 0~1번, 24판 모두 대양 어귀까지 |
| O0 | 탐사선으로 대양 남쪽 → 새 대륙 항구까지 오류 없이(엔딩 없이 임시 입항) · ⏩ ×4에서 프레임이 ×1의 절반 밑으로 안 떨어짐 |
| O1 | 봇: 산호섬을 들르면 식수 파국 0, 무풍대를 기관·태양광으로 건넘 |
| O2 | 봇: 대양 태풍 만난 판에서 비켜 가 구조 0 |
| O3 | 대양 생물 8종을 봇이 다 볼 수 있음(자리·빈도 확인) |
| O4 | 엔딩 3쪽이 선장 4명 모두 뜸(그림 없으면 대체 장면) · 닫으면 계속 항해 |
| O6 | 봇 시드 1~12: **처음부터 엔딩까지 평균 약 4시간**(열린 결정 1), 대양 체류 40~60분(×1 기준), 구조 합 12판에 5번 이하 |

## 10. 그림과 소리

### 10-1. 코드로 그릴 것

| 무엇 | 단계 | 내용 |
|---|---|---|
| 큰 바다 테마 `sea` | B6 | 짙은 남청 바닷물, 산호초 얕은 물(청록·옥빛), 섬 해변 흰 모래, 화산섬은 검은 모래·용암 바위, 야자수 2종(새 그림), 덤불·갯풀 재사용, 큰 섬 내륙은 짙은 열대 숲 |
| 섬 항구 집 `islehut` | B6 | 같은 집 틀에 분홍·노랑 회벽, 붉은 기와, 덧창 |
| 발견지 그림 6 | B3 | volcano · reef · turtlebeach · arch · falls · glassfloat |
| 생물 틀 3 | B3 | flyfish · fin · manta |
| 태풍 | B2 | 해도: 소용돌이 구름 원 + 점선 경로. 항해 화면: 하늘을 더 어둡게(폭풍 0.42 → 0.55), 굵은 비, 원 안 바람에 맞춘 물결, 눈 안은 맑은 빛 |
| 조류 | B1 | 해도 화살표, 물 위 옅은 줄무늬 |
| 대양 탐사선 선체·모듈 | B4·B5 | 선체(위 6절), 큰 주돛대, 조리실(솥·굴뚝), 의무실(흰 약상자에 약초 그림, 적십자 표시는 쓰지 않아요), 휴게실(벤치·탁자), 측후소(풍향계·풍속계) |
| 대양 테마 `ocean` | O5 | 깊은 남색 물, 긴 너울 줄, 무풍대는 거울 같은 물(물결 무늬 거의 없음), 편서풍 띠는 흰 물머리 많이 |
| 새 대륙 테마 `newland` | O5 | 높은 바위 절벽, 석조 부두, 큰 창고·종탑·색 회벽 집 `cityhut`, 등대 |
| 발견지 그림 4 | O3 | kelp · vent · iceberg · whalespot |
| 생물 틀 3 | O3 | whale(3종 크기·머리 모양만 달리) · sunfish · penguin |
| 장비 | O2 | 자동 조타(놋쇠 상자), 태양광 패널(파란 판 2 × 1), 빗물받이(천 깔때기 + 통) |
| 엔딩 대체 장면 | O4 | 그림을 못 읽으면 쓸 캔버스 장면 3장(항구·선장 얼굴·부두 저녁) |

### 10-2. 소리(Web Audio, 파일 없음)

| 소리 | 단계 | 묶음 |
|---|---|---|
| 태풍 바람(낮은 울부짖음, 세기 k에 따라) · 굵은 빗소리(지금 비 소리 × 1.4) | B2 | 물·바람 |
| 섬 새소리(군함조·슴새 짧은 울음) | B6 | 효과음 |
| 고래 노래(저주파 활강, DESIGN.md 13절) · 물기둥 숨소리 | O5 | 효과음 |
| 탐사선 뱃고동(새 대륙 첫 입항, 엔딩 시작) | O4 | 효과음 |
| 보조 기관 소리가 없으면 낮은 엔진 허밍(기관이 돌 때) | B5 | 효과음 |

### 10-3. agent-bridge로 맡길 것(생성 에셋)

**한 번에 맡겨요:** M4a(O0~O3)가 합쳐진 뒤 의뢰서 한 장(`asset_gen`)으로 아래 9개 + 지금 `pending`인 3곡(`bgm-lively`·`bgm-port`·`bgm-storm`)을 처리해요. 개발 중엔 캔버스 장면과 합성곡으로 돌아가요. 생성 모델은 로컬이 정해요(`docs/agent-bridge.md`).

| 에셋 | 종류 | 쓰는 곳 | 없을 때 |
|---|---|---|---|
| `bgm-opensea` | 음악 | 큰 바다 항해(`SAIL_SETS.sea = ['opensea', 'sea']`) | `sea.mp3` |
| `bgm-ocean` | 음악 | 대양 항해(`SAIL_SETS.ocean = ['ocean', 'opensea']`) | `sea.mp3` |
| `bgm-ending` | 음악 | 엔딩 3쪽 동안 한 번, 끝나면 `ocean` | 합성 `sea` |
| `story-endArrival` | 이미지 | 엔딩 1쪽 | 캔버스 장면 |
| `story-endSailor`·`endLucky`·`endTrader`·`endCrafter` | 이미지 4 | 엔딩 2쪽(선장별) | 캔버스 장면 |
| `story-endCrew` | 이미지 | 엔딩 3쪽 | 캔버스 장면 |

- 새 곡 이름에 맞는 합성곡은 만들지 않아요. `music.js`에서 합성곡이 없는 곡 이름은 `sea` 합성곡으로 넘기는 한 줄을 더해요(O5).
- **Suno 무료 플랜 곡은 비상업 용도만 돼요**(`assets/CREDITS.md`).

**asset-manifest 항목 초안**(O3 끝에 `docs/asset-manifest.yaml`에 `status: pending`으로 더해요):

```yaml
  # M4 대양·엔딩(PLAN-M3.md 10-3절). 파일이 없으면 합성곡·캔버스 장면으로 대신해요
  - id: bgm-opensea
    kind: music
    source: generate
    path: games/sailing-master/assets/music/opensea.mp3
    spec: "mp3 스테레오 128kbps, 44.1kHz, 2:00~3:00, 끊김 없는 루프, 4MB 이하, 보컬 없음"
    prompt: "Instrumental sea-shanty folk in 6/8, about 96 BPM, G major. Fiddle and accordion carry a broad, rolling melody, tin whistle answers, plucked mandolin, upright bass, bodhran and soft foot stomps, a sustained low accordion drone like a horizon. Open sea between scattered tropical islands, steady trade wind, sunlight on long swells, confident and free. Short wooden-room reverb. Not cute, not childlike. No vocals. Seamless loop: the ending leads naturally back into the beginning."
    url: ""
    status: pending
    license: ""
    note: "곡 이름: 섬과 섬 사이(큰 바다 항해, sea.mp3와 번갈아)"
  - id: bgm-ocean
    kind: music
    source: generate
    path: games/sailing-master/assets/music/ocean.mp3
    spec: "mp3 스테레오 128kbps, 44.1kHz, 2:30~3:30, 끊김 없는 루프, 4MB 이하, 보컬 없음"
    prompt: "Instrumental slow folk ballad in 3/4, about 72 BPM, D dorian. Solo fiddle sings a long, lonely melody over a quiet accordion drone, plucked mandolin arpeggios, upright bass on the downbeats, very soft bodhran like distant waves. Crossing an endless ocean at dawn, small ship under a huge sky, solitary but hopeful, grand and calm. Gentle wooden-room reverb, a little wider than a tavern. Not orchestral, not cute. No vocals. Seamless loop: the ending leads naturally back into the beginning."
    url: ""
    status: pending
    license: ""
    note: "곡 이름: 끝없는 물(대양 항해, opensea와 번갈아)"
  - id: bgm-ending
    kind: music
    source: generate
    path: games/sailing-master/assets/music/ending.mp3
    spec: "mp3 스테레오 128kbps, 44.1kHz, 2:30~3:00, 루프 아님(분명한 끝맺음), 4MB 이하, 보컬 없음"
    prompt: "Instrumental folk finale, starts slow in 3/4 at about 70 BPM with solo fiddle and accordion recalling a simple sea-shanty theme, then gathers into a joyful 6/8 reel at about 120 BPM with tin whistle, mandolin, upright bass, bodhran, foot stomps and clinking mugs, and ends on a warm held major chord. A small crew finally reaching a new continent after crossing the ocean, celebration on the docks at sunset, proud and tender. Wooden-room reverb. Not orchestral, not cute. No vocals."
    url: ""
    status: pending
    license: ""
    note: "곡 이름: 건너편 부두(엔딩, 한 번 재생)"
  - id: story-endArrival
    kind: image
    source: generate
    path: games/sailing-master/assets/story/endArrival.webp
    spec: "1440x1000 WebP(품질 82, 350KB 이하), 불투명 배경, 원본 PNG는 커밋하지 않음"
    prompt: "Japanese theatrical animation film style with richly detailed painted backgrounds and backlighting, wide landscape composition 36:25. Age of Sail fantasy. A three-masted wooden ocean exploration ship with white deckhouse and a small funnel, sails weathered from a long voyage, gliding into a large stone harbor of an unknown new continent at golden sunset; tall cliffs, a lighthouse, colorful stucco houses and a bell tower above the quay, gulls, people waving small cloths on the pier. Warm, triumphant, emotional mood. Keep the bottom 12% of the frame calm and simple (a text panel overlaps it). No readable text or letters anywhere, no logo, no watermark, no border, no weapons, no cannons."
    url: ""
    status: pending
    license: ""
    note: "엔딩 1쪽(공통) · 배는 게임의 대양 탐사선(돛대 셋, 흰 갑판실, 작은 굴뚝)"
  - id: story-endSailor
    kind: image
    source: generate
    path: games/sailing-master/assets/story/endSailor.webp
    spec: "1440x1000 WebP(품질 82, 350KB 이하), 불투명 배경, 원본 PNG는 커밋하지 않음"
    prompt: "Japanese theatrical animation film style with richly detailed painted backgrounds and backlighting, wide landscape composition 36:25. The young sailor captain (twenties, short dark brown hair, tanned, light stubble, deep sea-blue #25506f coat), once a postal courier, sits on a crate at a new-continent harbor at dusk writing a letter to his mother, a sealed envelope and an old leather mail bag beside him, the ocean exploration ship moored behind, lanterns lighting up. Quiet, warm, a little homesick but proud. Keep the bottom 12% of the frame calm and simple. No readable text or letters anywhere (papers show only illegible scribbles), no logo, no watermark, no border, no weapons."
    url: ""
    status: pending
    license: ""
    note: "엔딩 2쪽 선장 sailor · 해당 초상화를 참고 이미지로"
  - id: story-endLucky
    kind: image
    source: generate
    path: games/sailing-master/assets/story/endLucky.webp
    spec: "1440x1000 WebP(품질 82, 350KB 이하), 불투명 배경, 원본 PNG는 커밋하지 않음"
    prompt: "Japanese theatrical animation film style with richly detailed painted backgrounds and backlighting, wide landscape composition 36:25. The young lucky captain (twenties, long brown hair, teal #2f6b5a coat), once a lost-and-found clerk, stands on a cliff above a new continent harbor in morning light, holding open an old worn sea chart and drawing the last missing coastline onto it with a pencil, wind in her hair, the ocean exploration ship small in the bay below. Hopeful, curious, bright. Keep the bottom 12% of the frame calm and simple. No readable text or letters anywhere (the chart shows only coastlines and illegible marks), no logo, no watermark, no border, no weapons."
    url: ""
    status: pending
    license: ""
    note: "엔딩 2쪽 선장 lucky · 해당 초상화를 참고 이미지로"
  - id: story-endTrader
    kind: image
    source: generate
    path: games/sailing-master/assets/story/endTrader.webp
    spec: "1440x1000 WebP(품질 82, 350KB 이하), 불투명 배경, 원본 PNG는 커밋하지 않음"
    prompt: "Japanese theatrical animation film style with richly detailed painted backgrounds and backlighting, wide landscape composition 36:25. The trader captain (woman in her fifties, grey wavy permed hair, plum #7a4a5e coat), a former spice merchant, haggles happily at a busy open-air market stall in a new continent harbor town, holding a small brass scale, unfamiliar colorful fruits, woven baskets and strange shells on the stall, local vendors laughing with her, afternoon sun through awnings. Lively, warm, humorous. Keep the bottom 12% of the frame calm and simple. No readable text or letters anywhere, no logo, no watermark, no border, no weapons."
    url: ""
    status: pending
    license: ""
    note: "엔딩 2쪽 선장 trader · 해당 초상화를 참고 이미지로"
  - id: story-endCrafter
    kind: image
    source: generate
    path: games/sailing-master/assets/story/endCrafter.webp
    spec: "1440x1000 WebP(품질 82, 350KB 이하), 불투명 배경, 원본 PNG는 커밋하지 않음"
    prompt: "Japanese theatrical animation film style with richly detailed painted backgrounds and backlighting, wide landscape composition 36:25. The crafter captain (man in his fifties, bald with grey sides and beard, a magnifying loupe on a cord around his neck, ochre-brown #6b5a3a coat), a former clockmaker, sits on the deck of the moored ocean exploration ship at sunset carving a small wooden model of that same ship for his grandchild, a toolbag open beside him, wood shavings, the new continent harbor glowing behind. Tender, satisfied, gentle humor. Keep the bottom 12% of the frame calm and simple. No readable text or letters anywhere, no logo, no watermark, no border, no weapons."
    url: ""
    status: pending
    license: ""
    note: "엔딩 2쪽 선장 crafter · 해당 초상화를 참고 이미지로"
  - id: story-endCrew
    kind: image
    source: generate
    path: games/sailing-master/assets/story/endCrew.webp
    spec: "1440x1000 WebP(품질 82, 350KB 이하), 불투명 배경, 원본 PNG는 커밋하지 않음"
    prompt: "Japanese theatrical animation film style with richly detailed painted backgrounds and backlighting, wide landscape composition 36:25. A festive evening on a stone pier of a new continent harbor: a diverse crew of about ten sailors in Age of Sail clothes (headscarves, knit caps, flat caps) sitting around a long table with bread, fish and mugs, one playing a fiddle and one an accordion, a ship's cat on a barrel, string lanterns, the three-masted ocean exploration ship moored behind under the first stars. Joyful, warm, the feeling of a long journey's end and a new beginning. No main captain in the center (the player's captain varies). Keep the bottom 12% of the frame calm and simple. No readable text or letters anywhere, no logo, no watermark, no border, no weapons."
    url: ""
    status: pending
    license: ""
    note: "엔딩 3쪽(공통) · 선장은 넣지 않아요(선장 4명 공통)"
```

- 이 초안의 화풍 문구는 `docs/art-style.md`(일본 극장 애니메이션풍, 작가 이름 없음)를 따랐어요. 큰 바다 도착 그림(M2의 "하구 도착 그림"과 같은 선택 항목)은 넣지 않았어요. 열린 결정 7.

## 11. 알려진 위험

| 위험 | 대응 |
|---|---|
| 큰 바다(22만 칸)·대양(25만 칸) 격자 만들기·메모리 | B0·O0에서 먼저 재요. 넘치면 칸 10m·16m. 거리 격자 Float32 3장 = 약 3MB라 메모리는 괜찮아요 |
| 대양 길 찾기 BFS가 길어짐 | 대양은 거의 열린 물이라 직선 + 산호섬 피하기로 충분해요. `lineClear`가 통하면 BFS를 건너뛰어요 |
| 태풍이 "갑자기 죽이는" 위협이 됨 | 2일 전 예보, 그날 경로 공개, 60초 전 경고, 항구 대피, 원 크기 650m(탐사선 8m/s면 80초에 벗어남). 봇 `reckless`로 가라앉는지 재요 |
| ⏩에서 사건을 놓침 | 조건이 깨지면 바로 ×1, 경고 이벤트는 그 프레임에 ×1. 같은 시드 테스트로 결과가 ×1과 같은지 확인 |
| 114칸 설계 화면 | 칸 크기 측정 → 30px 밑이면 격자 세로 스크롤. 두 손가락 확대는 하지 않아요 |
| 해도가 긴 띠를 못 보여 줌 | 창 + 전체 띠 막대(7-1절) |
| 장면 만들기 시간(큰 섬 숲) | 사물 상한(`scatter` 3,000)과 축소 때 건너뛰기(L1) 그대로. 큰 섬 내륙 숲은 바닥 무늬로 굽고 나무는 물가 60m 안만 |
| 일손 6명 모으기 귀찮음 | 5-3절 선원 남기기 + 보급항 후보 3명 고정(`minCands: 2` 큰 바다만) |
| 저장 전환 두 번(M3 엔딩, M4 관문) | M2 때처럼 엔딩 본 저장은 엔딩을 풀고 관문 앞 항구에 대 둬요. 테스트로 확인 |
| 봇이 너무 조심스러워 위험이 안 재짐 | `reckless`·`nocrew` 대조를 같이 재요(46절과 같은 방식) |

## 12. 대니님이 정할 것

| # | 결정 | 추천 | 대안 |
|---|---|---|---|
| 1 | 엔딩까지 목표 시간 | **봇 약 4시간**(큰 바다 50~70분 + 대양 40~60분 더함, 사람은 6~8시간 예상) | DESIGN.md 3절의 10~15시간(지도·값을 2~3배 키워야 해요) |
| 2 | 대양 지도 | **남북 12km 띠 한 장** + 산호섬 2곳 | 구간 3장(관문으로 이어 붙임, 해도는 쉬움·넘어가는 연출 필요) |
| 3 | 빨리 가기 ⏩ | **큰 바다·대양의 탁 트인 곳에서 ×2·×4** | 넣지 않음(대양 30분을 그대로) |
| 4 | 태풍 | **움직이는 원**(경로를 보고 비켜 감, 항구 대피) | 하루짜리 날씨(폭풍을 세게, 구현 가벼움) |
| 5 | 추위·결빙 | **넣지 않음**(빙산·펭귄은 볼거리로만) | 편서풍 띠 겨울에 추위 + 방한 난로 모듈 |
| 6 | 대양 탐사선 동력 | **돛 셋 + 보조 기관 + 태양광(연료 없음)** | 연료 보급품(석유·석탄) 추가 |
| 7 | 엔딩 그림 | **6장**(공통 2 + 선장별 4) | 공통 2장만 / 여기에 큰 바다 도착 그림 1장 더 |
| 8 | 탐사선이 강·호수로 | **못 들어감**(앞바다까지) | 들어감(여울 좌초 규칙만) |
| 9 | 선원 쓸모 고치기(5-3절) | **B4에서 같이** | 따로 조정 작업으로 |
