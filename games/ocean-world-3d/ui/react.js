// 젤리 반응(P4 W1, DESIGN 4.2·4.3절). 게임 사건을 구독해 블록 출렁임·물결·몸 눌림을 낸다.
// W1이 이 파일과 render/core/jelly.js, render/core/deform.js, ui/settings.js만 고친다(render/main.js는 고치지 않음).
//
// fx: { game, jelly, rig, input, creatures, propView, deformUniforms, opt, hf(getter: 확장 때 바뀜) }
//   game.on(사건, fn) — 사건 이름·인자는 render/core/events.js
//   game.isPlacing() — 놓기 모드인지
//
// 반응 7가지(DESIGN 4.2)
//   tapBlock     누른 자리부터 출렁(블록 가운데 쪽으로 전단) + 동심원 물결. 눌림 자체는 render/core/input.js가 이미 준다
//   adopt        생물이 위에서 "퐁" 떨어져 수면을 뚫음(물결), 육지형은 섬 위에 "통" 착지(몸 눌림) — 0.5초
//   place bed·land  놓은 물건이 눌렸다 올라옴 — 0.4초
//   place water  물건이 두어 번 까딱 — 0.6초
//   tapCreature  젤리 생물(해파리·문어·해삼·말미잘)만 몸이 말랑하게 눌림, 말미잘은 촉수 오므림 — 0.3~0.5초. 블록은 출렁이지 않음
//   tier         블록 전체가 한 번 크게 출렁 — 약 1초
//   expand       render/main.js가 이미 연출하므로 여기서는 구독하지 않음
// 경계(DESIGN 4.3): 놓기 모드·카메라 회전 중 블록 출렁임 없음(jelly 가드), 진폭 상한 3%(jelly.maxAmp), 0.2초 안 연타 무시(jelly.cooldown),
//   생물 누름·포착은 블록을 흔들지 않음, 판정 좌표는 그대로(화면 행렬만 덧씌움).
//
// 물건·생물의 화면 행렬은 매 프레임 creatures.update / propView.update가 다시 쓰므로, 그 두 함수 뒤에 덧씌우는 고리를 건다.
import * as THREE from 'three';
import { createSettings, loadLevel } from './settings.js';

const STRENGTH = { normal: 1, weak: 0.45, off: 0 };
const RIPPLE = { normal: 1, weak: 0.6, off: 0.35 };   // 물결은 끄기에서도 작게 남김(누른 것이 받아들여졌다는 표시)
const JELLY_SP = new Set(['moonjelly', 'octopus', 'seacucumber', 'anemone']);

/** 눌렸다 올라오는 모양(0 → 아래로 → 살짝 넘쳐 위로 → 0). u: 0..1 */
const press = (u) => -Math.sin(Math.PI * 1.5 * u) * Math.pow(1 - u, 1.5);
/** 두어 번 까딱(0에서 시작해 0으로 끝남) */
const bob = (u) => Math.sin(Math.PI * 4 * u) * (1 - u);

/** obj.name 함수 뒤에 fn을 이어 붙인다 */
function after(obj, name, fn) {
  const orig = obj[name];
  obj[name] = function (...args) { const r = orig.apply(this, args); fn(); return r; };
}

export function attachReact(fx) {
  const { game, jelly, rig, creatures, propView, opt } = fx;

  // ---------- 경계: 놓기 모드·카메라 회전 중에는 블록이 출렁이지 않음 ----------
  let rotating = false;
  rig?.controls?.addEventListener?.('start', () => { rotating = true; });
  rig?.controls?.addEventListener?.('end', () => { rotating = false; });
  const calm = () => rotating || game.isPlacing();
  jelly.setGuard(() => !calm());

  // ---------- 설정: 출렁임 보통 / 약하게 / 끄기 ----------
  // 주소에 ?jelly= 를 준 경우와 녹화 모드는 주소 값을 따른다(개발·확인용). 그 밖에는 저장된 값, 없으면 보통
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const fromUrl = opt?.capture || q.has('jelly');
  let level = fromUrl ? (jelly.strength <= 0 ? 'off' : jelly.strength < 0.8 ? 'weak' : 'normal') : (loadLevel() || 'normal');
  function setLevel(lv) {
    if (!(lv in STRENGTH)) return;
    level = lv;
    jelly.setStrength(STRENGTH[lv]);
    settings?.set(lv);
  }
  const settings = opt?.capture ? null : createSettings({ level, onChange: (lv) => setLevel(lv) });
  if (!fromUrl) setLevel(level);
  const ripple = () => RIPPLE[level] ?? 1;

  // ---------- 다음 프레임에 할 일(놓기 확정 안에서 생긴 사건은 놓기 모드가 끝난 뒤 반응) ----------
  const queue = [];
  const later = (fn) => queue.push(fn);
  jelly.onUpdate(() => { if (queue.length) for (const fn of queue.splice(0)) fn(); });

  const center = () => {
    const h = fx.hf;
    return { x: h.b.x0 + ((h.nx - 1) * h.dx) / 2, y: h.b.y0 + ((h.ny - 1) * h.dx) / 2 };
  };

  // ---------- 블록 빈 곳 누름: 누른 자리부터 출렁 + 동심원 물결 ----------
  game.on('tapBlock', (e) => {
    // render/core/input.js가 같은 탭에서 jelly.poke(-0.7)을 먼저 부른다. 그것이 받아들여졌을 때만(연타·가드 통과) 이어서 반응
    if (!jelly.justPoked()) return;
    const c = center();
    const gx = c.x - e.x, gy = c.y - e.y;            // 누른 자리 → 가운데(격자). 누른 쪽이 밀려 들어가듯
    const L = Math.hypot(gx, gy) || 1;
    const k = Math.min(1, L / 14) * 0.38;
    jelly.nudge((gx / L) * k, (-gy / L) * k);        // 격자 y = Three −z
    fx.hf.disturb(e.x, e.y, 1.4, -2.2 * ripple());
  });

  // ---------- 애니메이션 목록(블록 시간 jelly.time 기준) ----------
  const drops = new Map();   // uid → { t0, sp, land, rippled }
  const bodies = new Map();  // uid → { t0, sp, dur, kind: 'press'|'land' }
  const props = new Map();   // uid → { t0, dur, zone }

  // ---------- 생물 들임: 위에서 "퐁" ----------
  game.on('adopt', (e) => {
    drops.set(e.uid, { t0: jelly.time, sp: e.sp, land: e.z >= 0, x: e.x, y: e.y, rippled: false });
  });

  // ---------- 물건 놓음: 해저·육지 눌림, 수중 까딱 ----------
  game.on('place', (e) => {
    const water = e.zone === 'water';
    props.set(e.uid, { t0: jelly.time, dur: water ? 0.6 : 0.4, zone: e.zone });
    fx.hf.disturb(e.x, e.y, water ? 1.1 : 1.3, (water ? -0.8 : -1.0) * ripple());
  });
  game.on('remove', (e) => props.delete(e.uid));
  game.on('release', (e) => { drops.delete(e.uid); bodies.delete(e.uid); });

  // ---------- 젤리 생물 누름: 그 몸만 말랑하게(블록은 흔들지 않음) ----------
  game.on('tapCreature', (e) => {
    if (!JELLY_SP.has(e.sp)) return;
    const b = bodies.get(e.uid);
    if (b && jelly.time - b.t0 < 0.2) return;       // 0.2초 안 연타는 새로 시작하지 않음
    bodies.set(e.uid, { t0: jelly.time, sp: e.sp, dur: e.sp === 'anemone' ? 0.5 : 0.36, kind: 'press' });
  });
  // 포착(capture)은 생물을 누른 탭에서 생기므로 블록을 흔들지 않는다(DESIGN 4.3 ✨). 소리·카드 쪽 연출만 남김

  // ---------- 티어 상승: 블록 전체 한 번 크게 ----------
  game.on('tier', () => {
    later(() => {   // 놓기 확정 안에서 오르면 놓기 모드가 끝난 다음 프레임에
      jelly.poke(-0.9, 0.3, 0.18, { force: true });
      const c = center();
      fx.hf.disturb(c.x, c.y, 2.2, -2.4 * ripple());
    });
  });

  // ---------- 화면 행렬 덧씌우기 ----------
  const _m = new THREE.Matrix4(), _d = new THREE.Matrix4(), _t = new THREE.Matrix4(), _ti = new THREE.Matrix4();
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const _axis = new THREE.Vector3();

  function slotOf(uid, sp) {
    const m = creatures.meshes.get(sp);
    if (!m) return null;
    const i = m.slots.indexOf(uid);
    return i < 0 ? null : { m, i };
  }

  function creaturesAfter() {
    const now = jelly.time;
    let touched = null;
    const touch = (m) => { (touched || (touched = new Set())).add(m); };

    for (const [uid, d] of drops) {
      const u = (now - d.t0) / 0.5;
      const at = slotOf(uid, d.sp);
      if (!at) { if (u > 2) drops.delete(uid); continue; }   // 아직 그려지지 않음(다음 프레임)
      if (u >= 1) {
        drops.delete(uid);
        if (d.land) bodies.set(uid, { t0: now, sp: d.sp, dur: 0.3, kind: 'land' });   // "통" 착지
        later(() => jelly.poke(d.land ? -0.22 : -0.3, 0.06, 0.03));
        continue;
      }
      const sm = at.m.sm;
      sm.mesh.getMatrixAt(at.i, _m);
      _p.setFromMatrixPosition(_m);
      const seaY = creatures.coords.toWorld(d.x, d.y, 0, _s).y;
      const top = Math.max(_p.y, seaY) + (d.land ? 1.6 : 3.2);   // 떨어지기 시작하는 높이
      const y = top + (_p.y - top) * u * u;                         // 점점 빨라지며 떨어짐
      _m.elements[13] = y;
      sm.mesh.setMatrixAt(at.i, _m);
      touch(sm);
      if (!d.land && !d.rippled && y <= seaY) {                   // 수면을 뚫는 순간 물결
        d.rippled = true;
        fx.hf.disturb(d.x, d.y, 1.6, -1.8 * ripple());
      }
    }

    for (const [uid, b] of bodies) {
      const u = (now - b.t0) / b.dur;
      const at = slotOf(uid, b.sp);
      const done = u >= 1;
      if (at) {
        const p = at.m.sm.params;
        const w = done ? 0 : press(u) * (b.kind === 'land' ? 0.2 : 0.3);
        const z = done || b.sp !== 'anemone' ? 0 : Math.pow(Math.sin(Math.PI * u), 0.6);   // 말미잘 촉수 오므림
        p.setW(at.i, w); p.setZ(at.i, z);
        p.needsUpdate = true;
      }
      if (done || !at) bodies.delete(uid);
    }
    if (touched) for (const sm of touched) sm.commit();
  }

  function propsAfter() {
    const now = jelly.time;
    let dirty = false;
    for (const [uid, a] of props) {
      const e = propView.items.get(uid);
      if (!e) { if (now - a.t0 > 0.5) props.delete(uid); continue; }
      const u = (now - a.t0) / a.dur;
      const p = e.p, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      if (u >= 1) {   // 원래 행렬로 되돌림
        for (const part of e.parts) propView._place(part, p, e.sea || null);
        props.delete(uid);
        dirty = true;
        continue;
      }
      // 덧씌우는 변형 D를 물건 바닥(수중은 물건 높이) 기준점에서: M' = T(c)·D·T(−c)·M
      const water = a.zone === 'water';
      const z0 = water ? (p.z ?? 0) : propView.heightAt(cx, cy);
      propView.coords.toWorld(cx, cy, z0, _p);
      if (water) {
        const ang = (Number(uid) || 0) * 1.7;   // 물건마다 까딱이는 방향을 다르게
        _axis.set(Math.cos(ang), 0, Math.sin(ang));
        _q.setFromAxisAngle(_axis, bob(u) * 0.2);
        _d.makeRotationFromQuaternion(_q);
      } else {
        const k = press(u) * 0.22;
        _d.makeScale(1 - k * 0.5, 1 + k, 1 - k * 0.5);
      }
      _t.makeTranslation(_p.x, _p.y, _p.z); _ti.makeTranslation(-_p.x, -_p.y, -_p.z);
      _d.premultiply(_t).multiply(_ti);
      for (const part of e.parts) {
        propView._place(part, p, e.sea || null);   // 원래 행렬(떠 있는 물건은 지금 수면 기준)
        propView.batch.mesh.getMatrixAt(part.id, _m);
        _m.premultiply(_d);
        propView.batch.mesh.setMatrixAt(part.id, _m);
      }
      dirty = true;
    }
    return dirty;
  }

  after(creatures, 'update', creaturesAfter);
  after(propView, 'update', propsAfter);

  return {
    setLevel,
    level: () => level,
    /** 확인용: 지금 돌고 있는 연출 수 */
    active: () => ({ drops: drops.size, bodies: bodies.size, props: props.size, calm: calm() }),
  };
}
