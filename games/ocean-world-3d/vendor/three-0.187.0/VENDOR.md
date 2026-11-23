# three 0.187.0 (vendor)

npm 패키지 `three@0.187.0`(`npm pack three@0.187.0`, 2026-11-11 받음)에서 아래 파일만 **고치지 않고** 복사했어요. 라이선스는 같은 폴더의 `LICENSE`(MIT).

| 파일 | sha256 |
|---|---|
| `build/three.module.js` | `104f56145899722094556490d787aae0617cc2fc3382f31df02d724ea1aee341` |
| `build/three.core.js` | `613e370f76638fdef83926642bf256dc9615684922de1ce1f63a8583e5d78578` |
| `examples/jsm/controls/OrbitControls.js` | 원본 그대로 |
| `examples/jsm/environments/RoomEnvironment.js` | 원본 그대로 |
| `examples/jsm/utils/BufferGeometryUtils.js` | 원본 그대로 |

패키지 묶음(tgz) sha256: `ff540832ded0cfe919764d24a3d88f3e2a05f23303f876423e4f893841e90728`

`index.html`의 import map이 `three` → `build/three.module.js`, `three/addons/` → `examples/jsm/`로 풀어요. 버전을 바꿀 때는 폴더 이름과 import map 두 줄을 함께 바꿔요.
