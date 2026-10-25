// 돌고래(큰돌고래) 리그. 모양은 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX. 원점 = 몸통 아래 수면, 오른쪽을 보는 옆모습, 위가 -y.
// 물에서만 산다: 수면(y = 0) 위만 그리고 물속은 잘라 낸다. 땅 그림자 대신 수면에 닿는 자리마다 불투명한 물거품(외곽선이 둘러져도 깔끔하다).
// 외곽선 없이 그릴 때(p.shadow !== false)만 반투명 물결 고리와 푸르게 바래는 물속 몸을 더한다.
// 몸 = 단단한 앞몸(멜론 이마·짧은 부리, 아래턱은 따로 벌어진다) + 마디 띠로 된 꼬리자루(휘어짐) + 두 갈래 꼬리지느러미 + 등지느러미 + 가슴지느러미.
// 헤엄(걷기) = 돌고래 뛰기: 머리가 먼저 솟아 숨 쉬고, 등과 지느러미가 둥글게 넘어가며 잠긴다(한 주기 = STRIDE).
// 쉬기 = 머리를 물 위로 내밀고 끄덕이며 웃는 입, 가끔 숨구멍 물보라. 먹기 = 꼬리를 들며 잠수했다가 물고기를 물고 솟아오른다.
// 물 = 부리를 수면에 대고 머금는다. 눕기(rest) = 수면에 떠서 천천히 출렁이며 눈을 반쯤 감는다(로깅).
// 특수(물 위로 높이 점프) = 잠수 → 솟구쳐 포물선(몸이 호를 따라 돈다) → 물보라와 함께 입수 → 다시 머리를 내민다.
// 아이콘(rig 없음)은 물 없이 온몸이 보이는 뛰어오른 모습으로 그린다.

export const STRIDE = 12; // 한 번 솟았다 잠기는 동안 나아가는 거리
export const BOX = [20, 18];
const TAU = Math.PI * 2;

const DL = {
  col: '#8b9cad', back: '#718496', far: '#6f8192', belly: '#e4e9ed', jaw: '#d6dee4', line: '#56677a', mouth: '#c9727f', tooth: '#f6f8f8', blow: '#46525e',
  fish: '#f0b03a', fishFin: '#d8862a', fishEye: '#2a1d14', spray: '#ffffff', drop: '#d4eef8', foam: '#f4fbfe',
};
const SL = 1.85, TN = 6; // 꼬리자루: 마디 길이·마디 수
const TOPW = [3.4, 3.0, 2.55, 2.05, 1.6, 1.15, 0.8], BOTW = [3.3, 2.75, 2.2, 1.7, 1.25, 0.9, 0.62]; // 등쪽·배쪽 두께
// 물에 걸치는 범위를 계산할 때 쓰는 앞몸·등지느러미·꼬리지느러미 윤곽 점(몸 좌표)
const TORSO_TOP = [[-9, -2.6], [-6.5, -3.5], [-3, -4.4], [0, -4.75], [3, -4.75], [6, -4.55], [9, -4.5], [11.5, -4.3], [13.5, -3.2], [14.6, -1.3], [16, -0.7], [17.9, 0]];
const TORSO_BOT = [[17.9, 0.25], [17, 1.2], [14, 1.9], [11.5, 2.4], [8, 3.9], [4, 4.5], [0, 4.6], [-4, 4.3], [-7, 3.4], [-9.5, 2]];
const FIN_PTS = [[-4.4, -3.6], [-3.4, -6.4], [-4.8, -9], [-1.4, -7.6], [1.4, -5.4], [3, -4]];
const FLUKE_PTS = [[0.8, 0.65], [-4.9, 3.6], [-4.1, 0], [-4.6, -3], [0.8, -0.6]];

const cl01 = (v) => Math.max(0, Math.min(1, v));
const sm = (v) => { const x = cl01(v); return x * x * (3 - 2 * x); };
// 2D 변환(캔버스 transform 순서 a b c d e f)
const rt = (x, y, ang, s = 1) => { const c = Math.cos(ang) * s, si = Math.sin(ang) * s; return { a: c, b: si, c: -si, d: c, e: x, f: y }; };
const mm = (A, B) => ({ a: A.a * B.a + A.c * B.b, b: A.b * B.a + A.d * B.b, c: A.a * B.c + A.c * B.d, d: A.b * B.c + A.d * B.d, e: A.a * B.e + A.c * B.f + A.e, f: A.b * B.e + A.d * B.f + A.f });
const ap = (m, x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
const around = (px, py, ang) => mm(rt(px, py, ang), rt(-px, -py, 0));
const dom = (m) => new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]);

// 키프레임 보간(Catmull-Rom). keys = [[u, 값…]], loop면 순환
function kf(keys, u, loop) {
  const n = keys.length;
  u = loop ? ((u % 1) + 1) % 1 : Math.max(keys[0][0], Math.min(keys[n - 1][0], u));
  let i = 0;
  for (let k = 0; k < n; k++) if (keys[k][0] <= u) i = k;
  if (!loop && i >= n - 1) return keys[n - 1].slice(1);
  const at = (k) => (loop ? keys[((k % n) + n) % n] : keys[Math.max(0, Math.min(n - 1, k))]);
  const k0 = at(i - 1), k1 = at(i), k2 = at(i + 1), k3 = at(i + 2);
  const u2 = loop && i + 1 >= n ? 1 + k2[0] : k2[0], s = (u - k1[0]) / (u2 - k1[0] || 1), s2 = s * s, s3 = s2 * s, out = [];
  for (let j = 1; j < k1.length; j++) {
    const p0 = k0[j], p1 = k1[j], p2 = k2[j], p3 = k3[j];
    out.push(0.5 * (2 * p1 + (p2 - p0) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (3 * p1 - p0 - 3 * p2 + p3) * s3));
  }
  return out;
}
// 자세 = 몸 위치(x, y)·기울기(a, 음수면 코가 위)·꼬리 휨(bend, +면 아래로)·꼬리 끝 젓기(beat)·입 벌림(jaw)·눈꺼풀(lid)·가슴지느러미(fl)
const fromK = (v) => ({ x: v[0], y: v[1], a: v[2], bend: v[3], beat: v[4], jaw: v[5], lid: 0, fl: 0 });
const lerpP = (A, B, w) => { if (w <= 0) return A; if (w >= 1) return B; const o = {}; for (const k in A) o[k] = A[k] + (B[k] - A[k]) * w; return o; };
const idleP = (t) => ({
  x: -4, y: 2.5 + 0.35 * Math.sin(t * 2.2 + 0.8), a: -1.0 + 0.09 * Math.sin(t * 2.2), bend: 0.06, beat: 0.12 * Math.sin(t * 1.7),
  jaw: 0.1 + 0.12 * Math.max(0, Math.sin(t * 5.3)) * (Math.sin(t * 0.9) > 0 ? 1 : 0.25), lid: 0, fl: -0.7 + 0.25 * Math.sin(t * 2.6),
});
const swimP = (ph) => { const q = ph * TAU; return { x: 2, y: 2.6 - 2.4 * Math.sin(q), a: -0.22 * Math.cos(q), bend: 0.12 + 0.16 * Math.sin(q - 0.3), beat: -0.45 * Math.sin(q - 2.4), jaw: 0.04, lid: 0, fl: 0.15 * Math.sin(q) }; };
const restP = (t) => ({ x: 0.5, y: 0.45 + 0.3 * Math.sin(t * 1.1), a: -0.1 + 0.025 * Math.sin(t * 0.8 + 1), bend: 0.14 + 0.03 * Math.sin(t * 0.8), beat: 0.06 * Math.sin(t * 0.7), jaw: 0.05, lid: 0.6, fl: 0.1 * Math.sin(t * 0.9) });
// 먹기(4.4초 순환): 머리 든 채 → 앞으로 숙여 꼬리를 들며 잠수 → 물속 → 물고기를 물고 솟아오름 → 고개를 젖혀 삼킨다
const EAT_T = 4.4, EAT_OFF = 1.56;
const EAT = [
  [0.00, -3, 2.4, -1.0, 0.04, 0, 0.12],
  [0.07, -1, 1.6, -0.2, 0.12, 0.1, 0.02],
  [0.13, 1.5, 4.6, 0.6, -0.4, -0.35, 0],
  [0.2, 3, 10.5, 0.95, -0.2, 0.3, 0],
  [0.3, 2, 14, 0.2, 0, 0.4, 0],
  [0.38, -1, 12, -1.0, 0, -0.3, 0],
  [0.44, -2, 6, -1.2, 0, 0.3, 0.1],
  [0.49, -3, 1.4, -1.15, 0, 0, 0.2],
  [0.56, -3, 2.7, -0.95, 0.04, 0.1, 0.22],
  [0.75, -3, 2.5, -1.02, 0.04, -0.1, 0.2],
  [0.86, -3, 2.0, -1.28, 0.02, 0, 0.45],
  [0.93, -3, 2.3, -1.05, 0.04, 0, 0.1],
];
const FISH0 = 0.42, SWALLOW = 0.84; // 물고기를 문 구간 시작 · 삼키기 시작
// 물(3.6초 순환): 고개를 숙여 부리를 수면에 댔다가 다시 든다
const DRINK = [
  [0.0, -4, 2.5, -1.0, 0.05, 0, 0.1],
  [0.3, -2, 2.3, -0.16, 0.1, 0.1, 0.04],
  [0.58, -2, 2.4, -0.13, 0.1, -0.1, 0.22],
  [0.82, -4, 2.5, -1.05, 0.05, 0, 0.1],
];
// 특수: 키프레임(앞뒤) + 공중 포물선(0.15~0.62)
const JUMP0 = 0.15, JUMP1 = 0.62, JX = 15, JH = 28, JY = 4;
const JA = Math.atan2(-4 * JH, 2 * JX);
const SP_PRE = [
  [0.0, -4, 2.5, -1.0, 0.06, 0, 0.12],
  [0.05, -3.5, 6.5, 0.5, -0.1, 0.1, 0],
  [0.1, -12, 11, 0.15, 0, 0.35, 0],
  [JUMP0, -JX, JY, JA, 0.05, 0.3, 0.05],
];
const SP_POST = [
  [JUMP1, JX, JY, -JA, 0.1, 0, 0.1],
  [0.68, 12, 12, 0.6, -0.1, 0.2, 0],
  [0.74, 4, 12.5, -0.6, 0, 0.3, 0],
  [0.8, -3, 2.0, -1.15, 0, 0, 0.25],
  [0.88, -4, 2.7, -0.92, 0.05, 0, 0.3],
  [1.0, -4, 2.5, -1.0, 0.06, 0, 0.12],
];
function specialP(sp) {
  if (sp < JUMP0) return fromK(kf(SP_PRE, sp, false));
  if (sp > JUMP1) return fromK(kf(SP_POST, sp, false));
  const u = (sp - JUMP0) / (JUMP1 - JUMP0);
  return { x: -JX + 2 * JX * u, y: JY - 4 * JH * u * (1 - u), a: Math.atan2(-4 * JH * (1 - 2 * u), 2 * JX), bend: 0.05 + 0.25 * Math.sin(Math.PI * u), beat: 0.3 * (1 - u) * Math.sin(u * 14), jaw: 0.16, lid: 0, fl: 0.35 };
}

let TORSO = null, JAW = null, BELLY = null, CAPE = null, FIN = null, FLIP = null, FLUKE = null;
function build() {
  const t = new Path2D(); // 앞몸: 등 → 멜론 이마 → 짧은 부리 → 입선(윗턱) → 목 → 배 → 꼬리 쪽
  t.moveTo(-9, -2.6);
  t.bezierCurveTo(-5, -4.4, 0, -4.9, 5, -4.6);
  t.bezierCurveTo(8, -4.5, 10.6, -4.7, 12.7, -3.7);
  t.bezierCurveTo(14.4, -2.9, 15.1, -1.6, 14.6, -0.95);
  t.quadraticCurveTo(15.8, -0.8, 17.6, -0.4);
  t.quadraticCurveTo(18.4, -0.15, 17.9, 0.25);
  t.lineTo(12.9, 0.6);
  t.quadraticCurveTo(12.4, 0.75, 12.3, 1.3);
  t.bezierCurveTo(11, 3.2, 7, 4.6, 2, 4.6);
  t.bezierCurveTo(-3, 4.6, -7, 3.6, -9.5, 2.0);
  t.quadraticCurveTo(-10.6, -0.4, -9, -2.6);
  t.closePath();
  TORSO = t;
  const j = new Path2D(); // 아래턱(입꼬리를 축으로 벌어진다)
  j.moveTo(12.1, 0.55); j.lineTo(17.7, 0.2); j.quadraticCurveTo(18.1, 0.85, 17.1, 1.2); j.quadraticCurveTo(14.6, 1.95, 11.4, 2.3); j.quadraticCurveTo(11.2, 1.4, 12.1, 0.55); j.closePath();
  JAW = j;
  const b = new Path2D(); // 흰 배(입꼬리 아래에서 꼬리 쪽으로)
  b.moveTo(12.3, 1.0); b.bezierCurveTo(9, 1.9, 4, 1.4, -1, 2.0); b.bezierCurveTo(-5, 2.4, -8, 1.4, -11, 0.6); b.lineTo(-11, 7); b.lineTo(13, 7); b.closePath();
  BELLY = b;
  const c = new Path2D(); // 짙은 등(멜론에서 꼬리 쪽으로)
  c.moveTo(-11, -1.6); c.bezierCurveTo(-5, -2.8, 2, -3.2, 7, -3.0); c.bezierCurveTo(10, -2.9, 11.5, -3.0, 13, -2.6); c.lineTo(13, -7); c.lineTo(-11, -7); c.closePath();
  CAPE = c;
  const f = new Path2D(); // 등지느러미: 뒤로 휜 낫 모양
  f.moveTo(-4.4, -3.6); f.quadraticCurveTo(-3.0, -6.2, -4.8, -9.0); f.quadraticCurveTo(0.4, -7.8, 3.0, -4.0); f.closePath();
  FIN = f;
  const p = new Path2D(); // 가슴지느러미(뿌리 = 원점, +x 쪽으로 뻗는다)
  p.moveTo(-0.4, -1.0); p.quadraticCurveTo(3.2, -1.5, 5.6, 0.5); p.quadraticCurveTo(2.8, 1.2, -0.4, 1.0); p.closePath();
  FLIP = p;
  const k = new Path2D(); // 꼬리지느러미(+x = 몸 쪽). 가까운 갈래가 아래, 먼 갈래가 위(내려다보는 시점)
  k.moveTo(0.8, 0.65); k.quadraticCurveTo(-1.6, 1.4, -4.9, 3.6); k.quadraticCurveTo(-3.6, 1.2, -4.1, 0.05); k.quadraticCurveTo(-3.5, -1.0, -4.6, -3.0); k.quadraticCurveTo(-1.5, -1.3, 0.8, -0.6); k.closePath();
  FLUKE = k;
}
// 점들을 부드럽게 잇는다(가운데 점들은 조절점, 끝점은 그대로)
function smoothTo(path, Q, move) {
  if (move) path.moveTo(Q[0][0], Q[0][1]); else path.lineTo(Q[0][0], Q[0][1]);
  for (let k = 1; k < Q.length - 1; k++) path.quadraticCurveTo(Q[k][0], Q[k][1], (Q[k][0] + Q[k + 1][0]) / 2, (Q[k][1] + Q[k + 1][1]) / 2);
  path.lineTo(Q[Q.length - 1][0], Q[Q.length - 1][1]);
}
// 닫힌 다각형이 수면(y = 0)과 만나는 x 구간들
function spans(poly) {
  const xs = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    if ((y1 < 0) !== (y2 < 0)) xs.push(x1 + ((x2 - x1) * (0 - y1)) / (y2 - y1));
  }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}
const wave = (x, t) => 0.28 * Math.sin(x * 0.75 + t * 2.4);

export function draw(g, p, H) {
  if (!TORSO) build();
  const { ell, eye, seg, C, hash } = H, real = H.real();
  const icon = !p.rig; // 아이콘: 물 없이 온몸
  const r = p.rig ?? {}, dt = p.dt ?? 0;
  H.rigTick(r, dt);
  const t = p.ph ?? 0, sp = p.sp ?? -1, special = sp >= 0, moving = p.mv > 0 && !special;
  const follow = (key, target, rate) => { r[key] = dt > 0 && r[key] !== undefined ? r[key] + (target - r[key]) * Math.min(1, dt * rate) : target; };
  follow('mw', moving ? 1 : 0, 3);
  follow('rz', p.st === 'rest' && !moving ? 1 : 0, 2);
  if (p.st === 'eat' || p.st === 'drink') r.hk = p.st;
  const hd = cl01(p.hd ?? 0), ek = r.hk === 'drink' ? 0 : hd, dk = r.hk === 'drink' ? hd : 0;
  const ec = (((t + EAT_OFF) / EAT_T) % 1 + 1) % 1; // 먹기 순환 위상

  // ---- 자세 고르기(상태별 자세를 무게로 섞는다) ----
  let P, spout = -1, spS = 1;
  if (icon) P = { x: 1.2, y: -9.4, a: -0.08, bend: 0.17, beat: 0.12, jaw: 0.14, lid: 0, fl: 0.2 };
  else if (special) {
    P = specialP(sp);
    if (sp > 0.84) spout = (sp - 0.84) / 0.14;
  } else {
    P = idleP(t);
    spout = (((t + 0.7) / 5.5) % 1) / 0.3;
    if (r.mw > 0) { P = lerpP(P, swimP(p.gait ?? 0), r.mw); if (r.mw > 0.5) { spout = (t / 3.4) % 1 < 0.45 ? (((p.gait ?? 0) + 0.12) % 1) / 0.32 : -1; spS = 0.6; } }
    if (ek > 0) { P = lerpP(P, fromK(kf(EAT, ec, true)), ek); if (ek > 0.5) spout = ec > 0.52 && ec < 0.72 ? (ec - 0.52) / 0.2 : -1; }
    if (dk > 0) P = lerpP(P, fromK(kf(DRINK, t / 3.6, true)), dk);
    if (r.rz > 0) { P = lerpP(P, restP(t), r.rz * (1 - hd)); if (r.rz > 0.5) spout = (((t + 2) / 7.5) % 1) / 0.28; }
  }
  const lid = Math.max(P.lid, r.blink > 0 ? 1 : 0);

  // ---- 뼈대: 앞몸 변환 · 꼬리자루 마디 · 지느러미 변환 ----
  const MF = rt(P.x, P.y, P.a);
  const pts = [[-6, -0.3]], dirs = [];
  for (let i = 0; i < TN; i++) {
    const u = (i + 1) / TN, d = Math.PI - P.bend * 2 * u - P.beat * u * u, q = pts[i];
    dirs.push(d); pts.push([q[0] + Math.cos(d) * SL, q[1] + Math.sin(d) * SL]);
  }
  const tops = [], bots = [];
  for (let i = 0; i <= TN; i++) {
    const d = i === 0 ? dirs[0] : i === TN ? dirs[TN - 1] : (dirs[i - 1] + dirs[i]) / 2, ux = -Math.sin(d), uy = Math.cos(d); // ux,uy = 등쪽 방향
    tops.push([pts[i][0] + ux * TOPW[i], pts[i][1] + uy * TOPW[i]]); bots.push([pts[i][0] - ux * BOTW[i], pts[i][1] - uy * BOTW[i]]);
  }
  const band = new Path2D(); // 꼬리자루(꼬리 끝 → 앞몸 속 → 꼬리 끝)
  smoothTo(band, [...tops].reverse(), true); smoothTo(band, bots, false); band.closePath();
  const MK = mm(MF, rt(pts[TN][0], pts[TN][1], dirs[TN - 1] + Math.PI + P.beat * 0.5, 1.2));
  const MJ = mm(MF, around(12.4, 0.7, P.jaw));
  const MPn = mm(MF, rt(7.2, 2.6, 2.25 + P.fl)), MPf = mm(MF, rt(8.1, 2.1, 2.05 + P.fl * 0.8));

  // 물에 걸친 구간(물결 고리·물거품 자리)
  let wet = [];
  if (!icon && real) {
    const W = (m, list) => list.map(([x, y]) => ap(m, x, y));
    const body = [...W(MF, tops.slice(2).reverse()), ...W(MF, TORSO_TOP), ...W(MF, TORSO_BOT), ...W(MF, bots.slice(2))];
    const all = [...spans(body), ...spans(W(MF, FIN_PTS)), ...spans(W(MK, FLUKE_PTS))].sort((a, b) => a[0] - b[0]);
    for (const s of all) { const last = wet[wet.length - 1]; if (last && s[0] <= last[1] + 1) last[1] = Math.max(last[1], s[1]); else wet.push([...s]); }
  }

  const part = (m, path, col) => { g.save(); g.transform(m.a, m.b, m.c, m.d, m.e, m.f); g.fillStyle = C(col); g.fill(path); g.restore(); };
  const water = !icon && real, soft = water && p.shadow !== false; // soft: 외곽선 없이 그릴 때만(반투명 물속 몸·물결 고리)
  if (soft) {
    ell(g, 0, 0.8, 15, 3.2, 0, 'rgba(20,60,90,0.16)');
    // 물속 몸: 한 덩어리 윤곽을 푸르게, 깊을수록 옅게
    const U = new Path2D();
    for (const [m, path] of [[MF, TORSO], [MF, FIN], [MF, band], [MK, FLUKE], [MPn, FLIP], [MPf, FLIP], [MJ, JAW]]) U.addPath(path, dom(m));
    const gr = g.createLinearGradient(0, 0, 0, 6.5);
    gr.addColorStop(0, 'rgba(28,78,110,0.5)'); gr.addColorStop(1, 'rgba(28,78,110,0)');
    g.save(); g.beginPath(); g.rect(-60, 0, 120, 7); g.clip(); g.fillStyle = gr; g.fill(U); g.restore();
    // 물결 고리: 몸이 물에 걸친 자리마다(멈춰 있으면 바깥으로 퍼진다)
    g.lineCap = 'round';
    for (const [a, b] of wet) {
      const m = (a + b) / 2, w = (b - a) / 2;
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(m, 0.2, w + 1.6, 0.9 + (w + 1.6) * 0.26, 0, 0, TAU); g.stroke();
      if (r.mw < 0.5) for (let k = 0; k < 2; k++) {
        const age = (t * 0.55 + k * 0.5) % 1, rx = w + 2 + age * 7;
        g.strokeStyle = `rgba(255,255,255,${(0.45 * (1 - age)).toFixed(3)})`; g.lineWidth = 0.6;
        g.beginPath(); g.ellipse(m, 0.3, rx, 0.9 + rx * 0.26, 0, 0, TAU); g.stroke();
      } else { // 헤엄칠 땐 뒤로 갈라지는 물살
        g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(a - 0.5, -0.1); g.lineTo(a - 7, -1.1); g.moveTo(a - 0.5, 0.6); g.lineTo(a - 7.5, 2.0); g.stroke();
      }
    }
  }
  if (water && ek > 0.5 && ec > 0.18 && ec < 0.46) { // 잠수 중: 물방울이 올라와 수면에서 터진다
    for (let i = 0; i < 4; i++) { const bt = (t * 1.3 + i * 0.27) % 1, bx = -1 + i * 1.1 + Math.sin(t * 3 + i) * 0.4, by = 4.8 - bt * 5; if (by > -0.4) ell(g, bx, by, 0.35 + 0.1 * i, 0.35 + 0.1 * i, 0, DL.foam); }
  }

  // ---- 수면 위 몸 ----
  g.save();
  if (!icon) { g.beginPath(); g.moveTo(-70, -95); g.lineTo(70, -95); for (let x = 70; x >= -70; x -= 3.5) g.lineTo(x, wave(x, t)); g.closePath(); g.clip(); }
  part(MPf, FLIP, DL.far);
  part(MK, FLUKE, DL.col);
  if (real) { g.save(); g.transform(MK.a, MK.b, MK.c, MK.d, MK.e, MK.f); g.clip(FLUKE); g.fillStyle = C(DL.far); g.beginPath(); g.ellipse(-3, -2.4, 3.2, 1.9, 0.5, 0, TAU); g.fill(); g.restore(); } // 먼 갈래는 조금 어둡게
  g.save(); g.transform(MF.a, MF.b, MF.c, MF.d, MF.e, MF.f);
  g.fillStyle = C(DL.col); g.fill(band);
  if (real) { // 꼬리자루 윗선을 따라 짙은 등색
    g.save(); g.clip(band); g.lineCap = 'round';
    g.strokeStyle = C(DL.back); g.lineWidth = 2.4; g.beginPath(); smoothTo(g, tops, true); g.stroke();
    g.restore();
  }
  g.fillStyle = C(DL.back); g.fill(FIN);
  g.fillStyle = C(DL.col); g.fill(TORSO);
  if (real) {
    g.save(); g.clip(TORSO);
    g.fillStyle = DL.back; g.fill(CAPE);
    g.fillStyle = DL.belly; g.fill(BELLY);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.ellipse(12, -2.9, 2.2, 1.0, -0.6, 0, TAU); g.fill(); // 멜론 윤기
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.beginPath(); g.ellipse(1, -3.9, 7.5, 0.7, 0.02, 0, TAU); g.fill();
    g.restore();
  }
  // 입: 벌어지면 분홍 속과 작은 이
  const [lx, ly] = ap(around(12.4, 0.7, P.jaw), 17.7, 0.25);
  if (P.jaw > 0.02) {
    g.fillStyle = C(DL.mouth); g.beginPath(); g.moveTo(12.2, 0.72); g.lineTo(17.75, 0.2); g.lineTo(lx, ly); g.closePath(); g.fill();
    if (real && P.jaw > 0.12) { g.fillStyle = DL.tooth; for (let k = 0; k < 4; k++) { const x = 14 + k * 0.9; g.beginPath(); g.arc(x, 0.62 - (x - 12.2) * 0.075, 0.22, 0, Math.PI); g.fill(); } }
  }
  g.restore();
  part(MJ, JAW, DL.jaw);
  // 물고기(먹기): 물고 올라와 버둥대다 고개를 젖혀 삼킨다
  if (!icon && ek > 0.5 && ec > FISH0 && ec < SWALLOW + 0.06) {
    const sw = sm((ec - SWALLOW) / 0.055), wig = Math.sin(t * 13) * (1 - sw);
    g.save(); g.transform(MF.a, MF.b, MF.c, MF.d, MF.e, MF.f);
    g.translate(15.8 - sw * 2.6, 0.55); g.rotate(Math.PI / 2 + 0.25 * wig - sw * 1.2); g.scale(1 - sw * 0.6, 1 - sw * 0.6);
    g.fillStyle = C(DL.fishFin); g.beginPath(); g.moveTo(-2.4, 0); g.lineTo(-4.3, -1.4 + wig * 0.6); g.lineTo(-3.8, 0); g.lineTo(-4.3, 1.4 + wig * 0.6); g.closePath(); g.fill();
    g.fillStyle = C(DL.fish); g.beginPath(); g.ellipse(0, 0, 2.9, 1.15, 0, 0, TAU); g.fill();
    if (real) { g.fillStyle = DL.fishFin; g.beginPath(); g.moveTo(-0.6, -1); g.lineTo(0.9, -1.9); g.lineTo(1, -0.9); g.fill(); ell(g, 1.8, -0.25, 0.32, 0.32, 0, DL.fishEye); }
    g.restore();
  }
  part(MPn, FLIP, DL.col);
  if (real) {
    g.save(); g.transform(MF.a, MF.b, MF.c, MF.d, MF.e, MF.f); g.lineCap = 'round';
    g.strokeStyle = DL.line; g.lineWidth = 0.4;
    g.beginPath(); g.moveTo(12.5, 0.74); g.quadraticCurveTo(11.9, 0.8, 11.55, 0.15); g.stroke(); // 웃는 입꼬리
    if (P.jaw <= 0.02) { g.beginPath(); g.moveTo(17.4, 0.28); g.lineTo(12.5, 0.72); g.stroke(); }
    g.strokeStyle = DL.blow; g.lineWidth = 0.45; g.beginPath(); g.arc(7.6, -3.55, 0.5, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); // 숨구멍
    const ex = 10.9, ey = -0.45, er = 0.62; // 눈(반쯤 감으면 위 눈꺼풀이 덮는다)
    if (lid > 0.85) eye(g, ex, ey, er, true);
    else {
      eye(g, ex, ey, er, false);
      if (lid > 0.1) {
        g.save(); g.beginPath(); g.arc(ex, ey, er * 1.2, 0, TAU); g.clip(); g.fillStyle = DL.col; g.fillRect(ex - er * 1.4, ey - er * 1.4, er * 2.8, er * 2.8 * lid * 0.95); g.restore();
        seg(g, ex - er * 1.05, ey - er + er * 2 * lid * 0.95, ex + er * 1.05, ey - er + er * 2 * lid * 0.95, 0.35, '#2a1d14');
      }
    }
    g.restore();
  }
  g.restore();

  if (icon || !real) return;
  // ---- 수면 물거품 · 물보라 · 숨구멍 물안개(외곽선이 둘러지므로 불투명하게) ----
  g.lineCap = 'round';
  for (const [a, b] of wet) {
    if (b - a < 1.6) continue; // 꼬리 끝만 살짝 나온 곳은 거품 없이
    g.strokeStyle = C(DL.foam); g.lineWidth = 0.7; g.beginPath(); g.moveTo(a - 0.4, wave(a - 0.4, t));
    for (let x = a + 0.8; x < b + 0.4; x += 1.2) g.lineTo(x, wave(x, t) + 0.1);
    g.lineTo(b + 0.4, wave(b + 0.4, t)); g.stroke();
    ell(g, a - 0.1, 0.05, 0.9, 0.5, 0, DL.foam); ell(g, b + 0.1, 0.05, 0.9, 0.5, 0, DL.foam);
  }
  const splash = (x, age, s) => {
    if (age <= 0 || age >= 1) return;
    const k = 1 - age, hgt = s * 5.5 * Math.sin(Math.PI * Math.min(1, age * 1.3)), wd = s * 3.2 * (0.7 + age * 0.6);
    if (hgt > 0.4) {
      g.fillStyle = C(DL.foam); g.beginPath(); g.moveTo(x - wd, 0.5);
      for (let i = 0; i <= 8; i++) { const u = i / 8, tip = i % 2 ? hgt * 0.42 : hgt * (1 - Math.abs(u - 0.5) * 1.1); g.lineTo(x - wd + 2 * wd * u, -tip); }
      g.lineTo(x + wd, 0.5); g.quadraticCurveTo(x, 1.4, x - wd, 0.5); g.fill();
    }
    for (let i = 0; i < 9; i++) {
      const vx = (hash(i, 3, 7) - 0.5) * 16 * s, vy = (7 + hash(i, 5, 11) * 7) * s, px = x + vx * age, py = -(vy * age - 13 * s * age * age), rr = s * (0.35 + 0.35 * k);
      if (py < 0.3) ell(g, px, py, rr * 0.85, rr, 0, DL.drop);
    }
  };
  if (special) { splash(-JX + 1.1, (sp - 0.12) / 0.18, 1); splash(JX - 1.1, (sp - 0.57) / 0.22, 1.3); splash(-2.4, (sp - 0.77) / 0.14, 0.65); }
  if (ek > 0.5) { splash(-4.5, (ec - 0.12) / 0.2, 0.75); splash(-2.4, (ec - 0.46) / 0.15, 0.7); }
  if (spout >= 0 && spout < 1) { // 숨구멍 물보라(물 위에 있을 때만): 가는 줄기가 솟고 끝이 구름처럼 퍼졌다가 흩어진다
    const [bx, by] = ap(MF, 7.6, -4.4);
    if (by < -0.6) {
      const up = sm(spout / 0.35), fade = 1 - sm((spout - 0.6) / 0.4), hh = (1.5 + up * 5.5) * spS, rr = (0.6 + up * 0.9) * fade * spS;
      if (fade > 0.05) {
        g.fillStyle = C(DL.spray); g.beginPath(); g.moveTo(bx - 0.35 * fade, by + 0.2); g.lineTo(bx - 0.6 * rr, by - hh); g.lineTo(bx + 0.6 * rr, by - hh); g.lineTo(bx + 0.35 * fade, by + 0.2); g.fill();
        ell(g, bx, by - hh - rr * 0.4, rr * 1.1, rr * 0.9, 0, DL.spray); ell(g, bx - rr * 0.9, by - hh + rr * 0.1, rr * 0.75, rr * 0.65, 0, DL.spray); ell(g, bx + rr * 0.95, by - hh + rr * 0.05, rr * 0.8, rr * 0.65, 0, DL.spray);
      }
    }
  }
}
