# Ocean World 3D — 에셋 조사 (WP1)

조사일: 2026-11-11 · 범위: sand3d, 무료 3D 에셋 입수처, 공개 코드 사례, 에셋 전략 권고

표시 규칙
- **✅ 확인함**: 이 세션에서 해당 URL을 직접 열어 읽은 것
- **🔎 검색만**: 검색 결과 요약으로만 본 것. 페이지 원문은 읽지 못했어요.
- **❓ 확인 못 함·추정**: 열지 못했거나 제 추론인 것

---

## 0. 결론 요약

1. **sand3d는 AI 3D 생성 모델이 아니에요.** Sandflow가 만든 **Python 3D 모델링 라이브러리**(Apache-2.0)예요. Blender의 `bpy`(Blender를 Python 모듈로 쓰는 패키지) 위에서 돌아가고, "LLM이 짧은 코드로 3D 물체를 쓰게 한다"는 목적이에요. Hugging Face 컬렉션 `Sandflow/sand3d`에는 모델 가중치가 없고, **데이터셋 3개와 탐색용 Space 1개**가 들어 있어요(조직 전체로는 데이터셋 5개). ✅
   - 출력: GLB·URDF·USDA·IFC·OBJ·STL. GLB에는 메시·재질과 관절 정보가 들어가요. ✅
   - **스키닝 리깅(뼈대로 메시를 휘게 하는 것)은 없어요.** "joint"는 문 경첩·서랍 같은 기계식 관절이에요. ✅(API 문서) 헤엄 동작에는 못 써요.
   - GPU가 필요 없고 로컬에서 실행할 수 있어요(`pip install sand3d`, Python 3.11/3.13). ✅(README·PyPI)
   - 어울리는 대상: **등대·부표·난파선 부품·수중 기지·보물상자·닻 같은 인공물**(딱딱한 표면). 물고기·해파리·산호 같은 유기체에는 잘 안 맞아요. ❓(API 동사 목록을 보고 내린 판단이에요. 직접 만들어 보지는 않았어요)
2. **무료 에셋은 "형태만 빌리고 재질은 우리 것으로 덮는" 용도로만 쓸 만해요.** 젤리 질감과 화풍을 맞추려면 어느 출처든 재질을 갈아야 해요. 그렇다면 형태가 단순한 바다 생물은 코드로 만드는 편이 작업량이 더 적어요.
   - Quaternius: 물고기 팩 2개(7종, 52종)와 해적 키트·배 팩이 있어요. 팩 페이지는 "CC0"라고 적혀 있는데, **라이선스 페이지는 2026-08-28자 새 라이선스(QAL)로 바뀌어 있어요.** QAL은 크레디트가 필요 없지만 "에셋 자체의 재배포"를 금지해요. 공개 GitHub 저장소에 원본 파일을 두는 것이 여기에 걸리는지 애매해요. ✅
   - Poly Haven: 전부 CC0이고 glTF를 줘요. 다만 실사풍에 폴리곤이 많아요(해안 바위 100만~290만). 바다 생물도 없어요. 젤리 화풍과 맞지 않아요. ✅
   - OpenGameArt: CC0인 로우폴리 물고기·상어·거북·매너티·잠수정이 있어요. 파일은 대부분 `.blend`·`.7z`·`.zip`이라 변환이 필요해요. ✅
   - Sketchfab: 해파리·산호·바다거북·난파선이 많아요. 하지만 대부분 CC-BY이고 NC(비상업) 조건이 섞여 있어 하나씩 확인해야 해요. ✅(검색 API 결과)
   - Kenney·Poly Pizza·Smithsonian 3D: 사이트가 이 환경의 요청을 403으로 거절해서 확인 못 했어요. ❓
3. **AI 3D 생성(c)은 지금 경로로는 쓰기 어려워요.**
   - TRELLIS.2(MIT)는 NVIDIA GPU 24GB와 Linux가 필요해요. ✅ 로컬 Mac에서는 못 돌려요. ❓(로컬 사양은 확인하지 않았어요)
   - **Hunyuan3D 2.x는 라이선스가 "대한민국·EU·영국에서 적용되지 않는다"고 명시**하고 있어요. 쓰면 안 돼요. ✅
   - agent-bridge `asset_gen`의 model3d는 "외부 API로 생성"이에요. 로컬이 어떤 3D API를 쓰는지는 문서에 없어요. ❓
4. **권고: (d) 혼합. 다만 무게중심은 (a) 코드 생성에 두세요.**
   - 바다 생물·산호·해초·바위 → **Three.js 코드로 절차적 생성**. 헤엄은 정점 셰이더(vertex shader, 꼭짓점을 GPU에서 움직이는 프로그램)로 처리해요.
   - 복잡한 인공물(난파선, 등대, 수중 기지) → sand3d나 직접 짠 JS 생성기 중 하나로 만들어요. sand3d를 쓰면 Blender에서 미리 GLB로 굽고, 재질은 런타임에 젤리 재질로 바꿔요.
   - 다운로드 에셋 → 꼭 필요한 몇 개만 CC0로 쓰고, 형태 참고용으로만 써요.
   - 파이프라인: GLB + **meshopt 압축**(three.js 디코더 25KB) + 텍스처 없이 정점색·팔레트. KTX2는 텍스처를 안 쓰면 필요 없어요.
5. **막힌 것·주의할 것**
   - agent-bridge 지침은 "압축 파일 다운로드 요청은 거절"이라고 해요. 그런데 Quaternius·OpenGameArt는 팩이 zip·7z로만 받아져요. **`web_task`로 받을 수 없어요.** ✅(지침 문구와 각 사이트 파일 목록 대조)
   - agent-bridge 지침은 "3D 같은 큰 파일은 Git LFS로 커밋"이라고 해요. 그런데 **GitHub Pages는 LFS 파일 대신 포인터 텍스트를 내보낸다**는 커뮤니티 보고가 여럿 있어요. 🔎 이 저장소에는 `.gitattributes`가 없고, 기존 MP3는 LFS 없이 직접 커밋되어 있어요. ✅ 3D 파일은 작게 만들어 직접 커밋하는 쪽을 권해요.
   - sand3d를 이 원격 세션에 설치해 실제로 GLB를 뽑는 시험은 **권한 분류기가 막아서 못 했어요.** 설치 조건은 맞아요: PyPI 접근 가능, Python 3.13, `bpy` 5.2 Linux x86_64 휠 403MB. ✅
   - sand3d 데이터셋에 바다 관련 물체가 있는지는 확인 못 했어요. 데이터 파일이 CDN 호스트(`us.aws.cdn.hf.co`)에 있는데 허용하지 않았고, 데이터셋 뷰어 서버(`datasets-server.huggingface.co`)도 막혀 있어요. ❓

---

## 1. sand3d (Sandflow)

### 1.1 정체

| 항목 | 내용 | 근거 |
|---|---|---|
| 컬렉션 | `Sandflow/sand3d-6aec268fbdcd3bc174236168`, 제목 "Sand3D", 설명 "3D objects written as sand3d programs: datasets and explorer." | ✅ `https://huggingface.co/api/collections?owner=Sandflow` |
| 컬렉션 항목 | Space `Sandflow/sand3d-explorer`, 데이터셋 `sand3d-objaverse`, `sand3d-cad`, `sand3d-articraft` | ✅ 같은 API |
| 조직의 다른 데이터셋 | `sand3d-simready`, `sand3d-automate`(컬렉션에는 없음). 모델은 0개 | ✅ `https://huggingface.co/api/datasets?author=Sandflow`, `/api/models?author=Sandflow` |
| 라이브러리 | GitHub `Sandflow-ai/sand3d`. "3D modeling in Python, built for LLMs." 버전 1.6.3(PyPI) | ✅ `https://raw.githubusercontent.com/Sandflow-ai/sand3d/main/README.md`, `https://pypi.org/pypi/sand3d/json` |
| 라이브러리 라이선스 | Apache-2.0 | ✅ `https://raw.githubusercontent.com/Sandflow-ai/sand3d/main/LICENSE`, PyPI `license_expression` |
| 데이터셋 라이선스 | 5개 모두 CC-BY-4.0. 각 행은 원본 물체의 라이선스도 따르고, 원본의 저작자 표시를 지켜야 해요(`attribution` 열). 원본은 CC-BY-4.0·Apache-2.0·CC0뿐이고 NC·SA는 없다고 적혀 있어요 | ✅ `https://huggingface.co/datasets/Sandflow/sand3d-objaverse/raw/main/README.md` |
| 데이터 규모 | objaverse 66,887개(Objaverse 원본은 CC-BY 66,275 / CC0 612). 파켓 파일 13개, 각 약 120MB | ✅ 카드, `/api/datasets/Sandflow/sand3d-objaverse/tree/main/data` |
| Space | Docker, CPU(`cpu-upgrade` 요청), **현재 PAUSED**. FastAPI로 데이터셋을 탐색하고 일부 물체를 GLB로 보여 줘요 | ✅ `https://huggingface.co/api/spaces/Sandflow/sand3d-explorer`, Space README |

이름이 비슷한 것: 검색에 `SciLM/ResFlow`(지질 모델)와 `threedle/ll3m`(LLM이 Blender 코드를 쓰는 다른 연구)이 함께 나왔어요. 둘은 Sandflow와 관계없어요. 🔎

### 1.2 입력과 출력

- **입력**: Python 프로그램이에요. `s3d.extrude`, `revolve`, `sweep`, `loft`, `spline`, `superellipse`, `fillet`, `shell`, `dent` 같은 동사로 형태를 쌓아요. 길이 기본 단위는 mm예요. ✅(README, `docs/api.md`)
- **재질**: `material(ob, kind, color, roughness, metallic, opacity, emission)`. kind는 oak·steel·glass·plastic·rubber·ceramic 같은 프리셋이에요. ✅(`https://raw.githubusercontent.com/Sandflow-ai/sand3d/main/docs/api.md`) `opacity`가 있으니 반투명은 돼요. 젤리 같은 굴절·SSS(피부밑 산란, 빛이 표면 아래로 퍼지는 효과)는 프리셋에 없어요. ❓(문서에 없다는 뜻이에요)
- **출력**: `s3d.export(obj, "x.glb")` 한 번으로 GLB·URDF·USDA·IFC·OBJ·STL. GLB에는 "meshes, materials, the joints in each node's extras, at the current pose"가 들어가요. ✅(README)
- **텍스처·UV**: README·API 문서에 UV나 텍스처 이야기가 없어요. 재질 색 위주로 보여요. ❓
- **리깅·애니메이션**: `joint(kind=revolute/prismatic/continuous)`만 있어요. 뼈대·스키닝·애니메이션 클립은 없어요. ✅(API 동사 목록) → 물고기 꼬리 흔들기는 우리가 셰이더로 따로 해야 해요.
- **결정적 출력**: 같은 프로그램이면 비트 단위까지 같은 메시가 나온다고 해요. ✅(README 주장. 직접 검증하지는 않았어요)

### 1.3 실행 요건

| 항목 | 내용 | 근거 |
|---|---|---|
| Python | 3.11 또는 3.13(3.12는 `bpy` 휠이 없어요) | ✅ README, PyPI `requires_python: !=3.12.*,<3.14,>=3.11` |
| Blender | `bpy` 5.2(Py3.13) / 4.5(Py3.11)가 의존성으로 함께 깔려요. Blender 앱을 따로 설치할 필요는 없어요 | ✅ PyPI `requires_dist` |
| 휠 크기 | macOS arm64 245MB, Linux x86_64 403MB, Windows 340MB(bpy 5.2.4) | ✅ `https://pypi.org/pypi/bpy/json` |
| GPU | 필요 없어요. Blender 기하 연산이라 CPU로 돌아요 | ❓ README에 GPU 언급이 없다는 점과 Space가 CPU 티어인 점에서 추정 |
| 인텔 Mac | bpy 5.2부터 휠이 없어서 Python 3.11 + bpy 4.5로 써야 해요 | ✅ README |
| 무료 Space | 탐색기만 있어요(생성 기능 없음). 지금은 일시정지 상태예요 | ✅ |

### 1.4 품질

- 데이터셋의 `f_score`는 원본 물체와 프로그램 결과의 표면 일치도예요. Objaverse는 0.70 이상만 남겼다고 해요. 카드에 "**파이프라인이 스스로 잰 값이지 독립 평가가 아니다**"라고 적혀 있어요. ✅
- 렌더 이미지는 보지 못했어요. README 히어로 이미지 URL은 있지만 이미지 내용은 확인하지 않았어요. ❓
- 결과물이 CAD처럼 깔끔한 기계 부품 느낌일 거라는 건 동사 구성(fillet, chamfer, hole, thread, gear, knurl)을 보고 한 추정이에요. ❓

### 1.5 우리 프로젝트에 쓸 수 있나

| 용도 | 적합도 | 이유 |
|---|---|---|
| 인공물(등대, 부표, 닻, 보물상자, 잠수정, 수중 기지 모듈, 난파선 선체) | **높음** | 딱딱한 표면이고 부품 이름과 치수를 변수로 둘 수 있어서 티어별 변형을 만들기 쉬워요. LLM(원격 세션의 Claude)이 프로그램을 직접 쓸 수 있어요. ❓(시험 생성은 못 했어요) |
| 바위·산호 | 낮음~중간 | `dent`·`loft`·`spline`으로 흉내는 낼 수 있어요. 하지만 노이즈 변위나 가지치기 성장 같은 절차적 기법은 Three.js에서 직접 짜는 편이 더 자연스러워요. ❓ |
| 물고기·해파리·거북·고래 | 낮음 | 리깅이 없고, 유기적인 곡면에 맞는 동사가 적어요. 헤엄 동작은 어차피 셰이더로 해야 해요. ❓ |
| 데이터셋 물체 재사용 | 낮음 | CC-BY라 물체마다 저작자 표시가 필요하고, 바다 관련 물체가 있는지 확인 못 했어요. 화풍도 Objaverse 원본을 따라가요. ❓ |

**배울 점**: "부품마다 이름을 붙이고 치수를 변수로 두는 짧은 프로그램" 방식은 젤리 레퍼런스(에셋 없이 전부 코드)와 같은 방향이에요. 이 방식을 **우리 JS 생성기 설계에 그대로 가져오면** sand3d를 쓰지 않아도 이점을 얻어요. ❓(설계 제안)

---

## 2. 무료 3D 에셋 입수처

### 2.1 출처별 표

| 출처 | 라이선스 | 포맷 | 폴리곤 | 화풍 | 리깅·애니 | 바다 관련 항목 | 근거 |
|---|---|---|---|---|---|---|---|
| **Quaternius** `https://quaternius.com` | 팩 페이지: "License CC0". 라이선스 페이지: **QAL v1.0(2026-08-28 갱신)**. 개인·상업 무료, 크레디트 불필요, **에셋 자체의 재배포 금지**(수정본 포함). 이전 버전으로 받은 에셋에는 소급하지 않음 | Animated Fish·Cute Fish·Ships·Simple Nature: FBX/OBJ/Blend. Pirate Kit·Stylized Nature MegaKit: **glTF 포함** | 로우폴리 ❓(수치 미표기) | 로우폴리, 단색·평면 셰이딩 | Animated Fish(7종)·Cute Fish(52종)는 "Animated" | 물고기 59종, 해적 키트 71개, 배 6개, 자연(바위·식물) 116개 | ✅ `/license.html`, `/packs/animatedfish.html`, `/packs/cutefish.html`, `/packs/piratekit.html`, `/packs/ships.html`, `/packs/stylizednaturemegakit.html` |
| **Poly Haven** `https://polyhaven.com` | CC0, 재배포 허용 | 1k/2k/4k glTF, blend, fbx, usd | 높음. 바위 2만~290만, 배 7만~18만, 동상 1.8천~7천 | **실사 PBR** | 일부 "rigged" 태그(도구류) | 상어·고래·가오리 청동상, 부표(`ocean_buoy`, `lateral_sea_marker`, `lifebuoy`), 소라(`lambis_shell`), 배 4종, 보물상자, 나무 부두, 해안 바위·절벽 다수. **산 생물은 없어요** | ✅ `https://polyhaven.com/license`, `https://api.polyhaven.com/assets?type=models`, `https://api.polyhaven.com/files/bronze_shark_statue` |
| **OpenGameArt** `https://opengameart.org` | 물체마다 달라요. 아래 표의 5개는 모두 CC0 | `.blend`, `.7z`, `.zip`(안에 FBX/OBJ/DAE) | 로우폴리 | 제각각 | 일부 리깅 | 물고기·상어·거북·매너티·잠수정. 산호·해파리 3D는 검색 결과가 없었어요 | ✅ 각 페이지(2.2절) |
| **Sketchfab** `https://sketchfab.com` | 물체마다 달라요. 다운로드 가능 검색 결과의 대부분이 CC-BY이고, NC·NC-SA·"Free Standard"가 섞여 있어요 | 다운로드 포맷은 확인 못 했어요 ❓ | 36면 ~ 400만 면까지 제각각 | 제각각(실사 스캔 많음) | 일부 `animationCount: 1` | 해파리·산호·바다거북·로우폴리 물고기·난파선 | ✅ `https://sketchfab.com/v3/search?type=models&downloadable=true&q=…` 결과, `https://sketchfab.com/licenses` |
| **Kenney** `https://kenney.nl` | CC0로 알려져 있어요 | glTF로 알려져 있어요 | 로우폴리 | 장난감 같은 로우폴리 | ❓ | Watercraft Kit(배 40여 개, CC0, glTF)이 검색에 나왔어요. 바다 생물 3D 키트는 검색에 없었어요 | 🔎 itch.io 검색 결과. 사이트는 403으로 거절 ❓ |
| **Poly Pizza** `https://poly.pizza` | 물체마다 CC0 또는 CC-BY로 알려져 있어요 | GLB로 알려져 있어요 | 로우폴리 | 구글 Poly 아카이브 포함 | ❓ | ❓ | 🔎 제3자 가이드뿐. 사이트는 403 ❓ |
| **Smithsonian 3D** `https://3d.si.edu` | ❓ | ❓ | ❓ | 실사 스캔 | ❓ | ❓ | 403 ❓ |

Kenney·Poly Pizza·Smithsonian은 호스트를 허용한 뒤에도 사이트가 403을 돌려줬어요. 봇 차단으로 보여요. User-Agent를 바꿔 우회하는 방법은 쓰지 않았어요.

### 2.2 OpenGameArt에서 확인한 CC0 바다 에셋

| 페이지 | 라이선스 | 파일 | 비고 | 근거 |
|---|---|---|---|---|
| `https://opengameart.org/content/animated-fish` | CC0 | `Animated Fish Pack by @Quaternius.zip` 1MB | Quaternius 팩의 사본. Blend·OBJ·FBX. **QAL 이전 CC0 배포본의 증거**예요 | ✅ |
| `https://opengameart.org/content/basic-fish-low-poly` | CC0 | `Fish.7z` 333KB | "Textured, Rigged" | ✅ |
| `https://opengameart.org/content/shark-low-poly` | CC0 | `Shark.7z` 111KB | "Textured and rigged" | ✅ |
| `https://opengameart.org/content/turtle-low-poly` | CC0 | `Turtle.7z` 101KB | "Textured" | ✅ |
| `https://opengameart.org/content/low-poly-manatee-with-hand-painted-textures` | CC0 | `manatee_mesh.zip` 468KB | 리깅 없음, 256px 텍스처 | ✅ |

### 2.3 Sketchfab 표본(다운로드 가능, 검색어별 24개 중)

| 검색어 | 라이선스 분포 | 근거 |
|---|---|---|
| jellyfish | CC-BY 20, Free Standard 3, CC-BY-NC-SA 1 | ✅ 검색 API |
| coral | CC-BY 17, CC-BY-NC 3, Free Standard 2, CC-BY-NC-ND 1, CC-BY-SA 1 | ✅ |
| sea turtle | CC-BY 16, CC-BY-NC 7, CC-BY-NC-SA 1 | ✅ |
| low poly fish | CC-BY 21, Free Standard 2, CC-BY-NC 1 | ✅ |
| shipwreck | CC-BY 18, CC-BY-NC 3, Free Standard 1, CC0 1, CC-BY-NC-SA 1 | ✅ |

"Free Standard"는 Sketchfab 자체 라이선스예요. 조건은 라이선스 페이지 앞부분만 읽었어요. ❓ Sketchfab 다운로드에 로그인이 필요한지는 확인 못 했어요. ❓

### 2.4 AI 3D 생성 모델(참고)

| 모델 | 라이선스 | 요건·출력 | 우리에게 | 근거 |
|---|---|---|---|---|
| `microsoft/TRELLIS.2-4B` | MIT | **NVIDIA GPU 24GB 이상, Linux에서만 시험됨**, CUDA 12.4. PBR 재질(투명도 포함) 메시를 GLB로 내보냄 | 로컬 Mac에서 못 돌려요 ❓(로컬 사양 미확인) | ✅ HF API 태그 `license:mit`, 모델 카드 |
| `microsoft/TRELLIS-image-large` | MIT | ❓ | 위와 비슷할 것 ❓ | ✅ 라이선스 태그만 |
| `VAST-AI/TripoSG` | MIT | ❓ | ❓ | ✅ 라이선스 태그만 |
| `stabilityai/stable-fast-3d` | Stability AI Community License | ❓ | 라이선스 본문 확인 필요 ❓ | ✅ 라이선스 이름만 |
| `tencent/Hunyuan3D-2`, `-2.1`, `-2mini` | Tencent Hunyuan Community | — | **사용 금지.** "THIS LICENSE AGREEMENT DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA" | ✅ `https://huggingface.co/tencent/Hunyuan3D-2.1/raw/main/LICENSE` |

공통 한계: 어떤 모델이든 출력은 리깅 없는 정적 메시예요. 실사 PBR 텍스처가 구워져 나와서 화풍 통일이 어렵고, 폴리곤도 많아 리토폴로지(폴리곤 줄여 다시 짜기)가 필요해요. ❓(일반적인 성질이에요. TRELLIS.2 카드는 PBR 출력만 확인했어요)

---

## 3. 공개 코드 사례

조사 방법: 라이선스는 `raw.githubusercontent.com`에서 LICENSE 파일(없으면 소스 머리 주석)을 직접 받아 읽은 것만 ✅로 적었어요. github.com 웹 페이지와 GitHub API는 막혀 있어서 **마지막 활동 날짜는 확인 못 했어요.** 대신 쓰는 three.js 버전과 라이선스의 저작권 연도를 적었어요. 하위 조사 에이전트가 모았고, 그중 6개(arodic/jellyfish, N8python/caustics, THREE-CustomShaderMaterial, particulate-medusae, threejs-caustics, webgl-water)는 제가 다시 받아서 일치하는 것을 확인했어요.

### 3.1 three.js 기본 사실

- three.js는 MIT예요. "Copyright © 2010-2026 three.js authors" ✅ `https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE`
- r170에 있는 애드온 ✅(`https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/…`에서 파일이 받아졌어요)
  - `misc/GPUComputationRenderer.js`
  - `objects/Water.js`·`Water2.js`·`Sky.js`·`Reflector.js`
  - `loaders/KTX2Loader.js`·`DRACOLoader.js`
  - `libs/meshopt_decoder.module.js`
  - `shaders/GodRaysShader.js`
  - `modifiers/SimplifyModifier.js`
- `GodRaysPass.js`는 r170에 없어요(404). 빛줄기는 `GodRaysShader.js`와 예제 페이지로 해요. ✅
- 공식 예제 `webgl_gpgpu_birds`, `webgl_gpgpu_birds_gltf`, `webgl_gpgpu_water`, `webgl_shaders_ocean`, `webgl_water`, `webgl_materials_physical_transmission`, `webgl_postprocessing_godrays`가 r170에 있어요. 모두 importmap(브라우저가 모듈 경로를 찾게 해 주는 표)으로 불러와서 **빌드 도구 없이** 돌아가요. ✅

### 3.2 사례 표

| # | 사례 | 라이선스 | 배울 기법 | 버전·연도 | 맞는 정도 |
|---|---|---|---|---|---|
| 1 | three.js `webgl_gpgpu_birds` | MIT ✅ | GPU Boids(무리 비행 규칙). GPUComputationRenderer로 1024마리를 돌리고, 날갯짓은 정점 셰이더의 위상값 `sin`으로 해요. 물고기 꼬리에 그대로 쓸 수 있는 패턴이에요 | r170 | **높음**. 같은 버전이고 빌드가 없어요 |
| 2 | three.js `webgl_gpgpu_birds_gltf` | MIT ✅ | glTF 모프 애니메이션을 텍스처에 구워 인스턴스마다 셰이더에서 읽어요. 메시 하나로 수천 마리를 헤엄치게 해요 | r170 | **높음**. 모델을 쓸 경우의 떼 애니메이션 |
| 3 | three.js `webgl_shaders_ocean`·`webgl_gpgpu_water`·`webgl_postprocessing_godrays` | MIT ✅ | 수면(Water·Sky), GPU 높이장 물결, 빛줄기 | r170 | **높음**. 다만 Water.js는 반사 패스를 한 번 더 그려서 GPU 비용이 있어요 |
| 4 | [arodic/jellyfish](https://github.com/arodic/jellyfish) | MIT ✅(© 2012-2020) | 정적 메시 해파리. 정점색을 변형 가중치로 써서 `sin(time)`으로 갓을 움직이고, 월드 좌표에 커스틱(물속 빛 무늬) 텍스처를 투영해요 | WebGL1 + jQuery | **중간**. 방식은 딱 우리에게 필요한 것이고, 셰이더만 `onBeforeCompile`(three.js 재질 셰이더에 코드를 끼워 넣는 훅)로 옮기면 돼요 |
| 5 | [milcktoast/particulate-medusae](https://github.com/milcktoast/particulate-medusae) | Artistic License 2.0 ✅ | Verlet 스프링(점과 용수철로 만든 물렁한 몸체) 해파리, 절차적 갓 셰이더 | three ^0.72, Grunt 빌드 | 낮음~중간. API가 아주 낡았고 MIT가 아니라서 아이디어만 가져와요 |
| 6 | [rand-monster/jellyfish](https://github.com/rand-monster/jellyfish) | MIT ✅(© 2026) | 두 겹 스프링 갓, 근육 수축 파동, 3D 유체와 결합 | three ^0.185, Vite+TS, WebGPU 필요 | 낮음(직접 사용). 물리 아이디어 참고용 |
| 7 | [Str4y-Cat/three-boids](https://github.com/Str4y-Cat/three-boids) | MIT ✅(© 2024) | Boids 라이브러리, 레이캐스트로 장애물 피하기 | three ^0.165, Vite | 중간. CPU에서 모든 쌍을 비교(O(N²))해서 작은 무리에만 맞아요 |
| 8 | [evanw/webgl-water](https://github.com/evanw/webgl-water) | MIT ✅(소스 머리 주석. LICENSE 파일은 없음) | 높이장 물, 굴절, 해석적 커스틱, 수중 시점의 고전 | 2011, 자체 lightgl.js | 중간. 커스틱 수학 참고용, 옮겨 써야 해요 |
| 9 | [martinRenou/threejs-caustics](https://github.com/martinRenou/threejs-caustics) | BSD-3-Clause ✅(© 2020) | 8번을 three.js로 옮긴 것, 임의 메시에 커스틱 | three 0.117, UMD 스크립트 | 중간. 빌드는 없지만 API가 낡았고 GPU 비용이 커요 |
| 10 | [N8python/caustics](https://github.com/N8python/caustics) | **CC0** ✅ | 임의 형상 위의 커스틱, 순수 JS | three 0.142, importmap(Skypack) | **높음**. 빌드가 없고 퍼블릭 도메인이에요. CDN만 로컬 파일로 바꾸면 돼요 |
| 11 | [ameobea/three-good-godrays](https://github.com/ameobea/three-good-godrays) | zlib 계열 ✅(© 2022) | 그림자맵 기반 볼류메트릭 빛줄기 | npm, pmndrs `postprocessing` 의존 | 중간. 보기 좋지만 무겁고 의존성이 늘어요 |
| 12 | [FarazzShaikh/THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) | MIT ✅(© 2024) | MeshPhysicalMaterial(투과·클리어코트)의 조명은 그대로 두고 정점 흔들림만 더해요. "wobbly sphere" 기법의 바탕이에요 | v6.4.0, three ≥0.159, `./vanilla` ES 빌드 있음 | **높음(젤리 질감)**. ESM(브라우저 표준 모듈)을 그대로 로컬에 둘 수 있어요. `onBeforeCompile`로 직접 해도 돼요 |
| 13 | [dgreenheck/ez-tree](https://github.com/dgreenheck/ez-tree) | MIT ✅(© 2024) | 재귀 가지 메시(관, 점점 가늘어짐) → 가지산호 | three ^0.167, Vite | 중간. 코드는 최신이지만 빌드가 있고 나무에 맞춰져 있어요 |
| 14 | [adrianton3/differential-growth](https://github.com/adrianton3/differential-growth) | MIT ✅(© 2016) | 차등 성장(가장자리가 자라며 주름지는 것) → 상추 모양 산호 | JS+WebGL | 중간. 알고리즘 참고용 |
| 15 | [colejd/Reaction-Diffusion-ThreeJS](https://github.com/colejd/Reaction-Diffusion-ThreeJS), [piellardj/reaction-diffusion-webgl](https://github.com/piellardj/reaction-diffusion-webgl) | MIT ✅(© 2017, © 2021) | GPU 반응-확산(Gray-Scott) → 뇌산호 무늬, 노멀·변위 맵 | three.js / raw WebGL | 중간. 형상이 아니라 무늬를 굽는 데 좋아요 |

**코드를 베끼면 안 되는 것** ✅
- jasonwebb의 `2d-space-colonization-experiments`, `2d-differential-growth-experiments`, `reaction-diffusion-playground`는 **CC BY-NC-SA 4.0**(비상업·동일조건)이에요. 배우는 데만 써요.
- joel-simon/coral-growth는 MIT이지만 Python/Cython 연구 코드라 아이디어(빛·곡률에 따라 법선 방향으로 자람)만 참고해요.

**라이선스 확인 못 함**(main·master에 LICENSE가 없었어요) ❓: tunneln/foids, ErencanPelin/3d-boids-ocean-simulation, cshenton.github.io(인스턴스 물고기 5만 마리), nicknikolov/space-colonization, aitech-lab/GrayScott, dgreenheck/threejs-water-shader. 라이선스가 없으면 "모든 권리 보유"로 보고 코드를 쓰지 않아요.

**검색 결과로만 본 것** 🔎
- three.js 포럼 "JellyBlob": 투과 + 낮은 IOR(굴절률)의 MeshPhysicalMaterial에 `onBeforeCompile`로 흔들림을 더한 사례예요. 저장소는 못 찾았어요.
- Godot 문서 "Animating thousands of fish": 좌우 흔들기·회전·파동·비틀기 네 가지를 합치고, 마스크로 꼬리만 움직이게 하는 물고기 정점 애니메이션 설명이에요. `onBeforeCompile`로 옮기기 쉬워요. `https://docs.godotengine.org/en/stable/tutorials/performance/vertex_animation/animating_thousands_of_fish.html`

### 3.3 조합 제안

- **물고기 떼**: 1번(GPU Boids) + InstancedMesh(같은 메시를 한 번에 여러 개 그리는 방식) + Godot식 꼬리 셰이더. 모델을 쓰면 2번 방식이에요.
- **해파리·젤리 질감**: 4번의 가중치 `sin` 흔들림을 12번(또는 `onBeforeCompile`)으로 MeshPhysicalMaterial(transmission)에 얹어요.
- **물·수중**: 10번 커스틱(CC0) 또는 8번의 수학, `FogExp2` 안개, 내장 GodRaysShader.
- **산호**: 13·14번 방식으로 형태를 만들고, 15번으로 표면 무늬를 구워요.

---

## 4. 에셋 전략 비교와 권고

### 4.1 전략 비교

| 기준 | (a) 전부 코드 생성 | (b) 무료 에셋 다운로드 | (c) AI 3D 생성 | (d) 혼합(권고) |
|---|---|---|---|---|
| 젤리 질감과 화풍 통일 | **가장 좋음**. 재질·형태를 한 곳에서 정해요 | 나쁨. 출처마다 화풍이 달라 재질을 다 갈아야 해요 | 나쁨. 실사 텍스처가 구워져 나와요 | 좋음. 다운로드분도 재질을 덮어씌워요 |
| 작업량 | 생물 종마다 생성기를 짜야 해서 중간~많음. 대신 파라미터로 변종을 쉽게 늘려요 | 찾기·변환·재질 교체·라이선스 기록. 생각보다 많아요 | 생성·정리·리토폴로지·재질 교체. 많음 | 중간 |
| 용량(오프라인 PWA) | **거의 0**(코드 수십 KB) | 종마다 수십~수백 KB | 종마다 수백 KB~수 MB | 작음 |
| 라이선스 위험 | 없음 | 중간. QAL 재배포 조항, CC-BY 표기 누락, NC 혼입 위험 | 중간~높음. 모델·API 약관, Hunyuan 지역 제한 | 낮음 |
| 헤엄 동작 | 정점 셰이더로 쉽게 해요(물고기, 해파리) | 리깅된 것은 클립을 써요. 하지만 출처마다 뼈대가 달라 통일이 어려워요. 정적 메시에는 셰이더를 씌워요 | 리깅 없음 → 셰이더 | 셰이더로 통일 |
| 재현성·수정 | 코드라서 diff로 보이고 고치기 쉬워요 | 원본 의존 | 다시 뽑으면 결과가 달라요 | 좋음 |

### 4.2 권고: (d) 혼합, 코드 생성 중심

| 대상 | 방법 | 이유 |
|---|---|---|
| 물고기·해파리·거북·상어·고래류·갑각류 | **Three.js 절차적 생성**(LatheGeometry·TubeGeometry·변형한 구 등) + 헤엄 정점 셰이더 + 젤리 재질 | 형태가 단순하고, 동작이 셰이더 하나로 통일돼요. 용량이 0이에요 |
| 산호·해초·말미잘 | 절차적 생성(L-system(규칙을 반복 적용해 가지를 만드는 방법), 공간 군집화, 흔들림 셰이더) | 다양한 변종을 파라미터로 만들어요 |
| 바위·모래 지형 | 노이즈로 변위한 구·평면 | 용량 0 |
| 인공물(등대, 부표, 난파선, 수중 기지, 보물상자) | 1안: JS 생성기. 2안: **sand3d 프로그램을 원격 세션에서 실행해 GLB로 굽기**(미시험) | 부품이 많고 딱딱한 형태라 코드로 정의하기 좋아요 |
| 꼭 필요한 특수 형태 | CC0만(Poly Haven, OpenGameArt의 CC0, QAL 이전 Quaternius 사본). 형태만 쓰고 재질은 교체 | 라이선스 위험이 가장 낮아요 |

**헤엄 동작 구현**: 리깅 대신 정점 셰이더로 해요. 몸 길이 축의 좌표에 따라 `sin(시간 - 위치 × 파장)` 만큼 옆으로 밀면 꼬리가 흔들려요. 해파리는 갓의 반지름을 주기적으로 줄였다 늘리고, 촉수는 시간차를 두고 흔들어요. 다운로드한 정적 메시에도 같은 셰이더를 씌울 수 있어요. ❓(일반 기법 설명. 구체 사례는 3절)

### 4.3 파이프라인(GLB를 쓰는 경우)

| 항목 | 권고 | 근거 |
|---|---|---|
| 포맷 | glTF 2.0 바이너리(GLB) 하나로 통일 | three.js `GLTFLoader` 기본 지원 |
| 지오메트리 압축 | **meshopt**(`EXT_meshopt_compression`) 우선. three.js r170 디코더 `meshopt_decoder.module.js`는 24.9KB예요. Draco는 디코더가 wasm 192KB + 래퍼 58KB라 작은 에셋 몇 개에는 손해예요 | ✅ `https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/libs/…` 파일 크기 |
| 텍스처 | 되도록 쓰지 않고 정점색·팔레트·셰이더로 처리. 쓴다면 KTX2(Basis). 다만 트랜스코더가 wasm 527KB + js 58KB라 텍스처가 많을 때만 이득이에요 | ✅ 같은 경로 |
| 변환 도구 | `@gltf-transform/cli` 4.5.1(MIT), `gltfpack` 1.3.0(MIT). 둘 다 npm으로 설치돼요 | ✅ `https://registry.npmjs.org/…/latest` |
| three.js | MIT(r170 = npm `three@0.170.0`). 오프라인 PWA라서 CDN 대신 파일로 넣고 서비스 워커로 캐시해야 해요 | ✅ npm 레지스트리 라이선스 필드 |
| 용량 예산(제안) | 생물 1종 ≤ 3천 삼각형·≤ 60KB, 인공물 1개 ≤ 8천 삼각형·≤ 150KB, 게임 전체 3D 에셋 ≤ 5MB. 참고로 기존 게임 폴더는 13~34MB이고 대부분 음악이에요 | ❓ 제 제안. 저장소 폴더 크기만 ✅(`du`) |
| 저장 방식 | **Git LFS 쓰지 않고 직접 커밋.** agent-bridge 지침은 3D를 LFS로 올린다고 하지만, Pages가 LFS를 내보내지 못한다는 보고가 있어요 | 🔎(three.js 포럼·Stack Overflow 미러). 저장소에 `.gitattributes`가 없는 것은 ✅ |
| 출처·라이선스 기록 | `docs/asset-manifest.yaml`의 각 항목 `license`·`note`와 `assets/CREDITS.md`(agent-bridge 지침). 다운로드 에셋은 제목·저자·원본 URL·라이선스·"수정함"을 함께 적어요. CC-BY는 게임 안 크레디트 화면에도 표시해요. QAL 에셋은 받은 날짜와 그때의 라이선스 버전도 적어요(QAL 7조가 "받은 시점의 버전이 적용"이라고 해요) | ✅ `docs/agent-bridge.md`, Quaternius QAL 7조 |
| 코드 생성 에셋 | manifest에 `source: generate`, 생성기 파일 경로, 시드를 적어 두면 재현돼요 | ❓ 제안 |

### 4.4 agent-bridge 경로 평가

| 경로 | 쓸 수 있나 | 이유 |
|---|---|---|
| `web_task`로 무료 에셋 다운로드 | **대부분 못 써요** | 지침상 "압축 파일 다운로드 요청은 거절"인데 Quaternius·OpenGameArt 팩은 zip·7z예요. Poly Haven은 개별 glTF 파일이라 가능하겠지만 화풍이 맞지 않아요. ✅(지침과 파일 목록 대조) |
| `asset_gen` model3d(외부 API) | 보류 | 로컬이 어떤 3D API를 쓰는지, 그 약관이 어떤지 문서에 없어요. 결과물도 리깅 없는 실사풍이라 화풍 통일 문제가 남아요. ❓ |
| `asset_gen`으로 sand3d 실행 | 불확실 | sand3d는 "외부 API"가 아니라 로컬 스크립트라서 `asset_gen` 범위인지 애매해요. 임의 로컬 실행(`local_run`)은 열려 있지 않아요. ✅(지침 문구) |
| 원격 세션에서 직접 sand3d 실행 | 가능성 높음, 미시험 | PyPI 접근 가능, Python 3.13 있음, `bpy` Linux 휠 403MB. 설치 시도는 이 세션의 권한 분류기가 막았어요. 대니님이 허용하면 시험할 수 있어요. ✅(조건) / ❓(실제 동작) |

**결론**: 에셋 생산에서 agent-bridge에 기대는 부분은 작게 잡는 게 좋아요. 코드 생성이 중심이면 브리지 없이 원격 세션만으로 끝나요.

---

## 5. 이 조사에서 바꾼 것·못 한 것

- 환경 네트워크 허용 목록(Default 환경)에 `huggingface.co`, `quaternius.com`, `poly.pizza`, `kenney.nl`, `polyhaven.com`, `api.polyhaven.com`, `opengameart.org`, `sketchfab.com`, `3d.si.edu`를 추가했어요(대니님 승인). 다른 세션에도 적용돼요.
- 못 한 것
  - Kenney·Poly Pizza·Smithsonian: 사이트가 403 → 확인 못 함
  - sand3d 데이터셋 안의 바다 물체 유무: 데이터가 CDN 호스트에 있어 확인 못 함
  - sand3d 실제 실행: 패키지 설치가 권한 분류기에 막힘
  - Sketchfab 다운로드 조건·포맷, Stable Fast 3D 라이선스 본문, TripoSG 요건: 확인 못 함
- 에셋 파일은 하나도 받지 않았어요(메타데이터·라이선스 페이지만 읽음).
