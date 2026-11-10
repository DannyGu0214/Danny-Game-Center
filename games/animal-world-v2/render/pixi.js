// PixiJS(WebGL) 렌더러 — M1 시제품(2026-11-10).
// 그림은 지금처럼 Canvas 2D(art.js · rigs/ · items/)로 그리고, 이 모듈은 그 캔버스를 텍스처로 올려 쌓기만 한다.
// 화면 층: 아래 #view(하늘, Canvas 2D) → 이 캔버스(땅·물건·동물, WebGL) → 위 #over(선택·놓을 자리·파티클, Canvas 2D).
// 프레임마다 begin() → sprite()/sub()/shadow…() 를 그리는 순서대로 부르고 → render(). 부른 순서가 곧 그리는 순서다(정렬 없음).
import { Application, Container, Sprite, Texture, CanvasSource, RenderTexture, Rectangle, Graphics, Filter, GlProgram } from '../vendor/pixi-8.22.0.min.mjs';

// 필터 기본 꼭짓점 셰이더(PixiJS v8 문서의 기본형)
const VERT = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }`;

// 외곽선: v1은 실루엣을 8방향으로 r만큼 밀어 찍고(source-over) 진한 색으로 칠한(source-in) 뒤 원본을 얹었다.
// 같은 계산을 픽셀마다 한 번에: 테두리 알파 = 1 − Π(1 − 이웃 알파), 결과 = 원본 + 테두리색 × 테두리 알파 × (1 − 원본 알파). 텍스처는 미리 곱한 알파(premultiplied)
const OUTLINE = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize; // 꼭짓점 셰이더와 정밀도를 맞춘다
uniform highp vec4 uInputClamp;
uniform vec4 uOutline;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  float keep = 1.0;
  for (int i = 0; i < 8; i++) {
    float t = float(i) * 0.78539816;
    vec2 p = clamp(vTextureCoord - vec2(cos(t), sin(t)) * uOutline.a * uInputSize.zw, uInputClamp.xy, uInputClamp.zw);
    keep *= 1.0 - texture(uTexture, p).a;
  }
  float a = 1.0 - keep;
  finalColor = c + vec4(uOutline.rgb * a, a) * (1.0 - c.a);
}`;

// 시간대 빛: v1의 source-atop 색 덮기와 같은 식. 결과 = 원본 × (1 − k) + 빛색 × k × 원본 알파
const TINT = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uTint;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  finalColor = vec4(c.rgb * (1.0 - uTint.a) + uTint.rgb * uTint.a * c.a, c.a);
}`;

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const hexNum = (hex) => parseInt(hex.slice(1), 16);
const bucket = (v) => Math.max(256, Math.ceil(v / 256) * 256);

export async function createPixi(host, before) {
  const app = new Application();
  await app.init({ preference: 'webgl', backgroundAlpha: 0, antialias: false, autoStart: false, sharedTicker: false, resolution: 1, autoDensity: false, width: 1, height: 1, powerPreference: 'high-performance' });
  const R = app.renderer, cv = app.canvas;
  cv.id = 'pixi';
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  host.insertBefore(cv, before);

  const world = new Container(), base = new Container(), shadows = new Graphics(), depth = new Container();
  world.addChild(base, shadows, depth);
  app.stage.addChild(world);

  const tintF = new Filter({ glProgram: GlProgram.from({ vertex: VERT, fragment: TINT, name: 'aw-tint' }), resources: { tintU: { uTint: { value: new Float32Array(4), type: 'vec4<f32>' } } }, resolution: 'inherit', padding: 0, antialias: 'off' });
  const outF = new Filter({ glProgram: GlProgram.from({ vertex: VERT, fragment: OUTLINE, name: 'aw-outline' }), resources: { outU: { uOutline: { value: new Float32Array(4), type: 'vec4<f32>' } } }, resolution: 1, padding: 0, antialias: 'off' });
  const atlasSp = new Sprite();
  atlasSp.filters = [outF];

  // 캔버스 → 텍스처(한 번 올림). 아틀라스처럼 매 프레임 바뀌는 캔버스는 refresh()로 다시 올린다
  const tex = new Map(), alias = new Map();
  function texOf(c) {
    if (alias.has(c)) return alias.get(c);
    let t = tex.get(c);
    if (!t) { if (!c.width || !c.height) return null; t = new Texture({ source: new CanvasSource({ resource: c, resolution: 1 }) }); tex.set(c, t); }
    return t;
  }
  function refresh(c) {
    const t = texOf(c); if (!t) return null;
    const s = t.source;
    if (s.pixelWidth !== c.width || s.pixelHeight !== c.height) { s.resize(c.width, c.height, 1); t.frame.width = c.width; t.frame.height = c.height; t.updateUvs(); }
    s.update();
    return t;
  }

  // 스프라이트 묶음: n번째로 부른 그림 = n번째 자식. 남는 자식은 숨긴다
  const pools = { base: { c: base, n: 0 }, depth: { c: depth, n: 0 } };
  const subs = []; let nSub = 0;
  function take(layer) {
    const P = pools[layer];
    let sp = P.c.children[P.n];
    if (!sp) { sp = new Sprite(); P.c.addChild(sp); }
    P.n++; sp.visible = true;
    return sp;
  }
  const S = { miss: 0, upKB: 0, frames: 0, lost: false };
  cv.addEventListener('webglcontextlost', () => { S.lost = true; });
  cv.addEventListener('webglcontextrestored', () => { S.lost = false; });

  let rt = null;
  const px = new Uint8Array(4);
  return {
    stats: S,
    canvas: cv,
    resize(w, h, dpr) { R.resize(w, h, dpr); },
    begin() {
      pools.base.n = pools.depth.n = 0; nSub = 0; S.miss = 0; S.upKB = 0;
      shadows.clear();
    },
    // 캔버스 한 장을 (x, y)에 w×h(CSS 픽셀)로
    sprite(c, x, y, w, h, alpha = 1, layer = 'depth') {
      const t = texOf(c); if (!t) return;
      const sp = take(layer);
      sp.texture = t; sp.position.set(x, y); sp.setSize(w, h); sp.alpha = alpha;
    },
    // 캔버스의 일부(sx, sy, sw, sh: 그 캔버스 픽셀)를 (x, y)에 w×h로 — 아틀라스의 한 칸
    sub(c, sx, sy, sw, sh, x, y, w, h) {
      const src = texOf(c); if (!src) return;
      let t = subs[nSub];
      if (!t || t.source !== src.source) { t?.destroy(false); t = subs[nSub] = new Texture({ source: src.source, frame: new Rectangle(sx, sy, sw, sh) }); }
      else { const f = t.frame; f.x = sx; f.y = sy; f.width = sw; f.height = sh; t.updateUvs(); }
      nSub++;
      const sp = take('depth');
      sp.texture = t; sp.position.set(x, y); sp.setSize(w, h); sp.alpha = 1;
    },
    shadowEllipse(x, y, rx, ry, hex, a) { shadows.ellipse(x, y, rx, ry).fill({ color: hexNum(hex), alpha: a }); },
    shadowRing(x, y, rx, ry, w, hex, a) { shadows.ellipse(x, y, rx, ry).stroke({ width: w, color: hexNum(hex), alpha: a }); },
    // 2D로 다 만든 아틀라스(외곽선까지)를 그대로 올린다
    upload(c) { const t = refresh(c); if (t) S.upKB += (c.width * c.height * 4) / 1024; },
    // 원본 아틀라스 cA를 올리고, 외곽선 셰이더로 RenderTexture에 한 번에 그린다. 이후 cB(외곽선 아틀라스)를 찾으면 그 RenderTexture를 쓴다
    outline(cA, cB, wide, used, r, hex) {
      if (!wide || !used) return;
      const t = refresh(cA); if (!t) return;
      S.upKB += (cA.width * cA.height * 4) / 1024;
      if (!rt || rt.width < wide || rt.height < used) {
        rt?.destroy(true);
        rt = RenderTexture.create({ width: bucket(Math.max(wide, rt?.width ?? 0)), height: bucket(Math.max(used, rt?.height ?? 0)), resolution: 1 });
        alias.set(cB, rt);
      }
      if (!atlasSp.texture || atlasSp.texture.source !== t.source) atlasSp.texture = new Texture({ source: t.source, frame: new Rectangle(0, 0, wide, used) });
      else { const f = atlasSp.texture.frame; f.width = wide; f.height = used; atlasSp.texture.updateUvs(); }
      atlasSp.setSize(wide, used);
      const u = outF.resources.outU.uniforms.uOutline, [cr, cg, cb] = rgb(hex);
      u[0] = cr; u[1] = cg; u[2] = cb; u[3] = r;
      R.render({ container: atlasSp, target: rt, clear: true });
    },
    tint(hex, k) {
      if (k <= 0.004) { world.filters = null; return; }
      const u = tintF.resources.tintU.uniforms.uTint, [r, g, b] = rgb(hex);
      u[0] = r; u[1] = g; u[2] = b; u[3] = k;
      if (!world.filters) world.filters = [tintF];
    },
    // sync: GPU가 다 그릴 때까지 기다린다(측정용. 1픽셀을 읽으면 앞의 그리기가 다 끝나야 한다)
    render(sync = false) {
      for (const P of Object.values(pools)) for (let i = P.n; i < P.c.children.length; i++) P.c.children[i].visible = false;
      R.render({ container: app.stage });
      if (sync && R.gl) R.gl.readPixels(0, 0, 1, 1, R.gl.RGBA, R.gl.UNSIGNED_BYTE, px);
      // 버린 캔버스(v1은 다시 그릴 때 옛 캔버스 크기를 0으로 만든다)의 텍스처를 GPU에서 지운다
      if (++S.frames % 120 === 0) for (const [c, t] of tex) if (!c.width) { t.destroy(true); tex.delete(c); }
    },
    info() {
      const gl = R.gl;
      return { name: R.name, maxTex: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : null, textures: tex.size, sprites: pools.depth.n + pools.base.n };
    },
  };
}
