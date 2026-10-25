// 범고래 리그. 모양은 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX. 원점 = 몸통 아래 수면, 오른쪽을 보는 옆모습, 위가 -y.
// 물에서만 산다(rigs/dolphin.js와 같은 방식): 수면(y = 0) 위만 그리고 물속은 잘라 낸다. 수면에 닿는 자리마다 불투명한 물거품.
// 외곽선 없이 그릴 때(p.shadow !== false)만 반투명 물결 고리와 푸르게 바래는 물속 몸을 더한다.
// 몸 = 단단한 앞몸(둥근 머리, 흰 아래턱은 따로 벌어진다) + 마디 띠로 된 꼬리자루 + 두 갈래 꼬리지느러미(아래 갈래 흰 안쪽)
//      + 아주 높은 세모 등지느러미(수컷) + 노 모양 가슴지느러미. 무늬 = 눈 뒤 흰 눈무늬 · 흰 턱·배 · 옆구리 흰 무늬 · 등지느러미 뒤 회색 안장.
// 헤엄(걷기) = 수면을 따라 오르내리며 머리가 먼저 솟고 등·등지느러미가 물을 가르며 넘어간다, 꼬리를 한 번 젓는다(한 주기 = STRIDE). 가끔 숨구멍 물보라.
// 쉬기 = 머리·등·지느러미를 내밀고 떠서 천천히 출렁(로깅), 가끔 물보라. 눕기(rest) = 더 낮게 가라앉아 느리게 숨 쉬며 눈을 감는다.
// 먹기 = 머리부터 잠수해 꼬리지느러미를 쳐들었다가 연어를 물고 솟아올라 삼킨다. 물 = 머리를 살짝 숙여 수면에 입을 댄다.
// 특수(물 위로 머리 내밀기, 스파이호핑) = 가라앉았다가 머리부터 곧게 솟아 흰 턱·배·가슴지느러미를 내밀고 두리번 → 미끄러지듯 내려간다.
// 아이콘(rig 없음)은 물 없이 온몸이 보이는 모습으로 그린다.

export const STRIDE = 15; // 한 번 오르내리며 꼬리를 젓는 동안 나아가는 거리
export const BOX = [26, 22];
const TAU = Math.PI * 2;

const OR = {
  col: '#262a31', far: '#1b1e23', white: '#f3f6f8', saddle: '#a2abb4', fin: '#23272d', lip: '#101216', eyeRing: '#eef2f5', pupil: '#111316', lidLine: '#b4bcc4',
  hole: '#4b535d', mouth: '#c46f7c', tooth: '#f6f8f8', fish: '#ee9a6c', fishFin: '#cf7552', fishEye: '#2a1d14', spray: '#ffffff', drop: '#d4eef8', foam: '#f4fbfe',
};
const SL = 2.5, TN = 6, KS = 1.2; // 꼬리자루 마디 길이·마디 수, 꼬리지느러미 배율
const TOPW = [4.5, 4.0, 3.35, 2.65, 2.0, 1.45, 1.0], BOTW = [4.3, 3.6, 2.9, 2.2, 1.6, 1.15, 0.8]; // 등쪽·배쪽 두께
// 물에 걸치는 범위를 계산할 때 쓰는 윤곽 점(몸 좌표)
const TORSO_TOP = [[-13, -3.6], [-10, -4.9], [-6, -6.0], [-2, -6.45], [2, -6.55], [6, -6.5], [10, -6.2], [13.5, -5.5], [16.5, -4.6], [19.5, -3.4], [21.8, -1.6], [22.0, 0.3]];
const TORSO_BOT = [[21.9, 0.6], [20.8, 2.1], [17.5, 3.3], [13.6, 3.5], [11, 5.2], [7, 6.3], [3, 6.6], [-2, 6.5], [-7, 5.6], [-11, 4.2], [-13.5, 2.4], [-14.4, 0]];
const FIN_PTS = [[-3.6, -5.9], [-1.7, -12.5], [-1.3, -19.6], [0.2, -19.3], [3.4, -13], [6, -6.3]];
const FLUKE_PTS = [[1, 0.8], [-6.2, 4.4], [-5, 0.05], [-5.8, -3.6], [1, -0.8]];
const EYE = [15.2, -1.75], EYE_R = 0.78;

const cl01 = (v) => Math.max(0, Math.min(1, v));
const fr = (v) => ((v % 1) + 1) % 1; // 0~1 순환(음수 시간에도)
const sm = (v) => { const x = cl01(v); return x * x * (3 - 2 * x); };
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? sm((s - a) / (b - a)) : s <= c ? 1 : 1 - sm((s - c) / (d - c)));
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
// 자세 = 몸 위치(x, y)·기울기(a, 음수면 코가 위)·꼬리 휨(bend, +면 아래로)·꼬리 끝 젓기(beat)·입 벌림(jaw)·눈꺼풀(lid)·가슴지느러미(fl)·몸 돌림(tw, 두리번)
const fromK = (v) => ({ x: v[0], y: v[1], a: v[2], bend: v[3], beat: v[4], jaw: v[5], lid: 0, fl: 0, tw: 0 });
const lerpP = (A, B, w) => { if (w <= 0) return A; if (w >= 1) return B; const o = {}; for (const k in A) o[k] = A[k] + (B[k] - A[k]) * w; return o; };
const idleP = (t) => ({
  x: 1, y: 1.3 + 0.32 * Math.sin(t * 1.6 + 0.8), a: -0.1 + 0.03 * Math.sin(t * 1.6), bend: 0.05, beat: 0.1 * Math.sin(t * 1.2),
  jaw: 0.03, lid: 0, fl: 0.1 * Math.sin(t * 1.4), tw: 0,
});
const swimP = (ph) => { const q = ph * TAU; return { x: 1, y: 2.6 - 1.8 * Math.sin(q), a: -0.03 - 0.1 * Math.cos(q), bend: 0.1 + 0.12 * Math.sin(q - 0.4), beat: -0.5 * Math.sin(q - 2.2), jaw: 0.02, lid: 0, fl: 0.15 * Math.sin(q), tw: 0 }; };
const restP = (t) => ({ x: 0.5, y: 3.1 + 0.25 * Math.sin(t * 1.0), a: -0.16 + 0.02 * Math.sin(t * 0.8 + 1), bend: 0.1 + 0.02 * Math.sin(t * 0.8), beat: 0.05 * Math.sin(t * 0.6), jaw: 0.02, lid: 1, fl: 0.05 * Math.sin(t * 0.7), tw: 0 });
// 먹기(5.2초 순환): 머리부터 숙여 등을 둥글게 말며 잠수 → 꼬리지느러미를 쳐든다 → 물속 → 연어를 물고 솟아오름 → 고개를 젖혀 삼킨다
const EAT_T = 5.2, EAT_OFF = 1.9;
const EAT = [
  [0.00, 1, 1.3, -0.1, 0.05, 0, 0.03],
  [0.07, 2, 1.2, 0.15, -0.05, 0.1, 0],
  [0.14, 3, 1.0, 0.55, 0.45, -0.2, 0],
  [0.22, 3, 8, 1.1, 0.2, 0.35, 0],
  [0.30, 2, 17, 1.35, 0.05, -0.3, 0],
  [0.38, 0, 26, 0.2, 0, 0.4, 0],
  [0.45, -1, 20, -1.1, 0, -0.4, 0.3],
  [0.52, 0, 9, -0.85, 0.05, 0.3, 0.35],
  [0.58, 1, 1.2, -0.35, 0.05, 0, 0.25],
  [0.66, 1, 1.5, -0.22, 0.05, 0, 0.2],
  [0.80, 1, 1.4, -0.25, 0.05, 0, 0.18],
  [0.87, 1, 1.1, -0.38, 0.03, 0, 0.42],
  [0.94, 1, 1.3, -0.12, 0.05, 0, 0.05],
];
const FISH0 = 0.48, SWALLOW = 0.86; // 연어를 문 구간 시작 · 삼키기 시작
// 물(3.6초 순환): 머리를 살짝 숙여 입을 수면에 댔다가 든다
const DRINK = [
  [0.0, 1, 1.3, -0.1, 0.05, 0, 0.03],
  [0.3, 1.5, 1.2, -0.02, 0.14, 0.1, 0.1],
  [0.58, 1.5, 1.3, 0.0, 0.14, -0.1, 0.16],
  [0.82, 1, 1.3, -0.1, 0.05, 0, 0.03],
];
// 특수(스파이호핑): 가라앉으며 코를 들고 → 곧게 솟아 머리·가슴을 내밀고 버팀(두리번) → 미끄러져 내려간다
const SPY0 = 0.21, SPY1 = 0.76;
const SPY = [
  [0.00, 1, 1.3, -0.1, 0.05, 0, 0.03],
  [0.06, 0.5, 6.5, -0.35, 0.05, 0.2, 0],
  [0.13, -1, 14, -1.4, 0, -0.3, 0],
  [SPY0, -1.5, 4.4, -1.52, 0, 0.2, 0],
  [SPY1, -1.5, 4.2, -1.52, 0, 0, 0],
  [0.85, -1, 17, -1.45, 0, 0.2, 0],
  [0.91, 0, 13, -0.6, 0.05, 0, 0],
  [0.97, 1, 2.0, -0.13, 0.05, 0, 0.03],
  [1.0, 1, 1.3, -0.1, 0.05, 0, 0.03],
];
function specialP(sp, t) {
  const P = fromK(kf(SPY, sp, false)), e = env(sp, 0.12, SPY0, SPY1, 0.84), h = env(sp, SPY0, SPY0 + 0.06, SPY1 - 0.05, SPY1);
  P.fl = 0.05 * e + 0.12 * Math.sin(t * 3.1) * e; P.fs = 1 - 0.4 * e; // 가슴지느러미를 옆으로 짧게 내밀고(앞으로 뻗어 짧아 보인다) 살랑
  P.fh = 1 - 0.55 * e; // 곧게 선 동안(물속) 등지느러미 밑동이 수면 위로 삐죽 나오지 않게 낮춘다
  const u = (sp - SPY0) / (SPY1 - SPY0);
  P.a += h * (0.06 * Math.sin(u * TAU * 2.2)); P.y += h * 0.35 * Math.sin(u * TAU * 3.3);
  P.tw = h * Math.sin(u * TAU); // 한쪽으로 돌았다 반대쪽으로(두리번)
  return P;
}

let TORSO = null, JAW = null, WHITE = null, PATCH = null, SADDLE = null, FIN = null, FLIP = null, FLUKE = null;
function build() {
  const t = new Path2D(); // 앞몸: 등 → 둥근 머리 → 윗입술선 → 입꼬리 → 목 → 배 → 꼬리 쪽
  t.moveTo(-13, -3.6);
  t.bezierCurveTo(-9, -5.4, -5, -6.4, 0, -6.5);
  t.bezierCurveTo(6, -6.6, 11, -6.3, 15.5, -5.0);
  t.bezierCurveTo(20.4, -3.9, 22.8, -1.6, 22.0, 0.3);
  t.quadraticCurveTo(17.6, 1.15, 14.6, 0.75);
  t.quadraticCurveTo(13.9, 1.0, 14.0, 1.7);
  t.bezierCurveTo(13.6, 4.0, 9.5, 6.3, 3, 6.6);
  t.bezierCurveTo(-3, 6.7, -9, 5.6, -13, 3.4);
  t.quadraticCurveTo(-14.6, 0, -13, -3.6);
  t.closePath();
  TORSO = t;
  const j = new Path2D(); // 흰 아래턱(입꼬리를 축으로 벌어진다)
  j.moveTo(14.3, 0.8); j.quadraticCurveTo(17.6, 1.2, 21.8, 0.45); j.quadraticCurveTo(22.3, 1.4, 20.8, 2.1); j.quadraticCurveTo(17.5, 3.4, 13.4, 3.1); j.quadraticCurveTo(13.1, 1.8, 14.3, 0.8); j.closePath();
  JAW = j;
  const w = new Path2D(); // 흰 무늬: 목 → 가슴지느러미 아래로 좁아진 배 → 옆구리로 솟아 꼬리 쪽으로 뾰족한 무늬(앞몸·꼬리자루로 잘라 쓴다)
  w.moveTo(23, 1.2); w.lineTo(14.2, 1.3);
  w.bezierCurveTo(12.6, 1.8, 10.6, 2.7, 8.0, 4.0);
  w.bezierCurveTo(4, 5.8, -1, 5.6, -4, 4.4);
  w.bezierCurveTo(-6.6, 3.2, -7.8, 0.0, -10.0, -1.4);
  w.bezierCurveTo(-11.8, -2.5, -14.6, -1.6, -16.8, -0.3);
  w.bezierCurveTo(-15.2, 0.6, -13.8, 2.0, -12.8, 4.6);
  w.lineTo(-13, 10); w.lineTo(23, 10); w.closePath();
  WHITE = w;
  const e = new Path2D(); // 눈 뒤 위의 흰 눈무늬(뒤쪽이 살짝 올라간 길쭉한 잎 모양)
  e.moveTo(15.4, -2.6); e.bezierCurveTo(15.3, -4.7, 11.6, -5.5, 8.3, -4.7); e.bezierCurveTo(9.6, -3.0, 12.6, -1.7, 15.4, -2.6); e.closePath();
  PATCH = e;
  const s = new Path2D(); // 등지느러미 뒤 회색 안장(앞몸 윗선으로 잘라 쓴다)
  s.moveTo(-1.8, -7.5); s.quadraticCurveTo(-2.6, -5.0, -6.5, -4.6); s.quadraticCurveTo(-9.8, -4.4, -11.5, -5.4); s.lineTo(-11, -8); s.closePath();
  SADDLE = s;
  const f = new Path2D(); // 등지느러미: 아주 높고 곧은 세모(수컷), 끝이 살짝 뒤로
  f.moveTo(-3.6, -5.9); f.quadraticCurveTo(-1.7, -12, -1.3, -19.6); f.quadraticCurveTo(-0.5, -20.3, 0.2, -19.3); f.quadraticCurveTo(3.6, -13.4, 6.0, -6.3); f.closePath();
  FIN = f;
  const p = new Path2D(); // 노 모양 가슴지느러미(뿌리 = 원점, +x 쪽으로 뻗고 끝이 둥글고 넓다)
  p.moveTo(-0.6, -1.3); p.quadraticCurveTo(3.0, -2.4, 6.2, -1.9); p.bezierCurveTo(8.8, -1.4, 8.9, 1.8, 6.0, 1.9); p.quadraticCurveTo(2.6, 1.8, -0.6, 1.2); p.closePath();
  FLIP = p;
  const k = new Path2D(); // 꼬리지느러미(+x = 몸 쪽). 가까운 갈래가 아래, 먼 갈래가 위
  k.moveTo(1, 0.8); k.quadraticCurveTo(-2, 1.6, -6.2, 4.4); k.quadraticCurveTo(-4.6, 1.4, -5, 0.05); k.quadraticCurveTo(-4.5, -1.3, -5.8, -3.6); k.quadraticCurveTo(-2, -1.6, 1, -0.8); k.closePath();
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
const wave = (x, t) => 0.28 * Math.sin(x * 0.7 + t * 2.2);

export function draw(g, p, H) {
  if (!TORSO) build();
  const { ell, C, hash } = H, real = H.real();
  const icon = !p.rig; // 아이콘: 물 없이 온몸
  const r = p.rig ?? {}, dt = p.dt ?? 0;
  H.rigTick(r, dt);
  const t = p.ph ?? 0, sp = p.sp ?? -1, special = sp >= 0, moving = p.mv > 0 && !special;
  const follow = (key, target, rate) => { r[key] = dt > 0 && r[key] !== undefined ? r[key] + (target - r[key]) * Math.min(1, dt * rate) : target; };
  follow('mw', moving ? 1 : 0, 2.5);
  follow('rz', p.st === 'rest' && !moving ? 1 : 0, 1.6);
  if (p.st === 'eat' || p.st === 'drink') r.hk = p.st;
  const hd = cl01(p.hd ?? 0), ek = r.hk === 'drink' ? 0 : hd, dk = r.hk === 'drink' ? hd : 0;
  const ec = fr((t + EAT_OFF) / EAT_T); // 먹기 순환 위상

  // ---- 자세 고르기(상태별 자세를 무게로 섞는다) ----
  let P, spout = -1, spS = 1;
  if (icon) P = { x: 4, y: -10, a: -0.06, bend: 0.06, beat: 0.16, jaw: 0.07, lid: 0, fl: 0.25, tw: 0 };
  else if (special) {
    P = specialP(sp, t);
    if (sp > 0.93) spout = (sp - 0.93) / 0.12;
  } else {
    P = idleP(t);
    spout = fr((t + 1.2) / 6.5) / 0.3;
    if (r.mw > 0) { P = lerpP(P, swimP(p.gait ?? 0), r.mw); if (r.mw > 0.5) { spout = fr(t / 4.2) < 0.3 ? fr((p.gait ?? 0) + 0.02) / 0.4 : -1; spS = 0.85; } }
    if (ek > 0) { P = lerpP(P, fromK(kf(EAT, ec, true)), ek); if (ek > 0.5) spout = ec > 0.6 && ec < 0.8 ? (ec - 0.6) / 0.2 : -1; }
    if (dk > 0) P = lerpP(P, fromK(kf(DRINK, t / 3.6, true)), dk);
    if (r.rz > 0) { P = lerpP(P, restP(t), r.rz * (1 - hd)); if (r.rz > 0.5) spout = fr((t + 3) / 9) / 0.25; }
  }
  const lid = Math.max(P.lid, r.blink > 0 ? 1 : 0);

  // ---- 뼈대: 앞몸 변환(두리번 = 세운 몸을 가로로 살짝 좁힌다) · 꼬리자루 마디 · 지느러미 변환 ----
  let MF = rt(P.x, P.y, P.a);
  if (P.tw) { const cx = ap(MF, 14, 0)[0], k = 1 - 0.2 * Math.abs(P.tw); MF = mm({ a: k, b: 0, c: 0, d: 1, e: cx * (1 - k), f: 0 }, MF); }
  const pts = [[-9.5, -0.1]], dirs = [];
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
  const MK = mm(MF, rt(pts[TN][0], pts[TN][1], dirs[TN - 1] + Math.PI + P.beat * 0.5, KS));
  const MJ = mm(MF, around(14.3, 0.8, P.jaw));
  const fh = P.fh ?? 1, MFin = mm(MF, { a: 1, b: 0, c: 0, d: fh, e: 0, f: -6 * (1 - fh) }); // 등지느러미 높이 배율(곧게 선 동안 물속에서 낮춘다)
  const fsc = { a: P.fs ?? 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; // 가슴지느러미 길이 배율(앞으로 뻗으면 짧아 보인다)
  const MPn = mm(MF, mm(rt(9.6, 4.0, 2.15 + P.fl), fsc)), MPf = mm(MF, mm(rt(10.6, 3.3, 1.95 + P.fl * 0.8), fsc));

  // 물에 걸친 구간(물결 고리·물거품 자리)
  let wet = [];
  if (!icon && real) {
    const W = (m, list) => list.map(([x, y]) => ap(m, x, y));
    const body = [...W(MF, tops.slice(2).reverse()), ...W(MF, TORSO_TOP), ...W(MF, TORSO_BOT), ...W(MF, bots.slice(2))];
    const all = [...spans(body), ...spans(W(MFin, FIN_PTS)), ...spans(W(MK, FLUKE_PTS))].sort((a, b) => a[0] - b[0]);
    for (const s of all) { const last = wet[wet.length - 1]; if (last && s[0] <= last[1] + 1) last[1] = Math.max(last[1], s[1]); else wet.push([...s]); }
  }

  const part = (m, path, col) => { g.save(); g.transform(m.a, m.b, m.c, m.d, m.e, m.f); g.fillStyle = C(col); g.fill(path); g.restore(); };
  const water = !icon && real, soft = water && p.shadow !== false; // soft: 외곽선 없이 그릴 때만(반투명 물속 몸·물결 고리)
  if (soft) {
    ell(g, 0, 1, 19, 4, 0, 'rgba(20,60,90,0.16)');
    // 물속 몸: 한 덩어리 윤곽을 짙푸르게, 깊을수록 옅게
    const U = new Path2D();
    for (const [m, path] of [[MF, TORSO], [MFin, FIN], [MF, band], [MK, FLUKE], [MPn, FLIP], [MPf, FLIP], [MJ, JAW]]) U.addPath(path, dom(m));
    const gr = g.createLinearGradient(0, 0, 0, 8);
    gr.addColorStop(0, 'rgba(14,44,66,0.55)'); gr.addColorStop(1, 'rgba(14,44,66,0)');
    g.save(); g.beginPath(); g.rect(-70, 0, 140, 9); g.clip(); g.fillStyle = gr; g.fill(U); g.restore();
    // 물결 고리: 몸이 물에 걸친 자리마다(멈춰 있으면 바깥으로 퍼진다)
    g.lineCap = 'round';
    for (const [a, b] of wet) {
      const m = (a + b) / 2, w = (b - a) / 2;
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(m, 0.2, w + 1.8, 1 + (w + 1.8) * 0.24, 0, 0, TAU); g.stroke();
      if (r.mw < 0.5) for (let k = 0; k < 2; k++) {
        const age = fr(t * 0.45 + k * 0.5), rx = w + 2.2 + age * 8;
        g.strokeStyle = `rgba(255,255,255,${(0.45 * (1 - age)).toFixed(3)})`; g.lineWidth = 0.65;
        g.beginPath(); g.ellipse(m, 0.3, rx, 1 + rx * 0.24, 0, 0, TAU); g.stroke();
      } else { // 헤엄칠 땐 뒤로 갈라지는 물살
        g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.65;
        g.beginPath(); g.moveTo(a - 0.5, -0.1); g.lineTo(a - 8, -1.2); g.moveTo(a - 0.5, 0.6); g.lineTo(a - 8.5, 2.2); g.stroke();
      }
    }
  }
  if (water && ek > 0.5 && ec > 0.2 && ec < 0.48) { // 잠수 중: 물방울이 올라와 수면에서 터진다
    for (let i = 0; i < 5; i++) { const bt = fr(t * 1.2 + i * 0.23), bx = -2 + i * 1.3 + Math.sin(t * 3 + i) * 0.5, by = 5.5 - bt * 5.8; if (by > -0.4) ell(g, bx, by, 0.4 + 0.1 * i, 0.4 + 0.1 * i, 0, OR.foam); }
  }

  // ---- 수면 위 몸 ----
  g.save();
  if (!icon) { g.beginPath(); g.moveTo(-80, -110); g.lineTo(80, -110); for (let x = 80; x >= -80; x -= 3.5) g.lineTo(x, wave(x, t)); g.closePath(); g.clip(); }
  part(MPf, FLIP, OR.far);
  part(MK, FLUKE, OR.col);
  if (real) { // 꼬리지느러미: 먼 갈래는 어둡게, 가까운 갈래 아래쪽은 흰 안쪽이 보인다
    g.save(); g.transform(MK.a, MK.b, MK.c, MK.d, MK.e, MK.f); g.clip(FLUKE);
    g.fillStyle = OR.far; g.beginPath(); g.ellipse(-3.4, -2.6, 3.4, 2.0, 0.5, 0, TAU); g.fill();
    g.fillStyle = OR.white; g.beginPath(); g.ellipse(-3.2, 3.2, 3.6, 1.1, 0.55, 0, TAU); g.fill();
    g.restore();
  }
  g.save(); g.transform(MF.a, MF.b, MF.c, MF.d, MF.e, MF.f);
  g.fillStyle = C(OR.col); g.fill(band);
  g.save(); g.transform(1, 0, 0, fh, 0, -6 * (1 - fh));
  g.fillStyle = C(OR.fin); g.fill(FIN);
  if (real) { // 등지느러미 앞쪽 윤기
    g.clip(FIN); g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 0.9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0.4, -18.4); g.quadraticCurveTo(3.0, -13, 5.2, -7.4); g.stroke();
  }
  g.restore();
  g.fillStyle = C(OR.col); g.fill(TORSO);
  if (real) {
    const BODY = new Path2D(TORSO); BODY.addPath(band);
    g.save(); g.clip(BODY);
    g.fillStyle = OR.white; g.fill(WHITE);
    g.restore();
    g.save(); g.clip(TORSO);
    g.fillStyle = OR.saddle; g.fill(SADDLE);
    g.fillStyle = OR.white; g.fill(PATCH);
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.ellipse(19.2, -2.7, 1.7, 0.7, 0.72, 0, TAU); g.fill(); // 머리 윤기
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.ellipse(4, -5.8, 8.5, 0.6, 0.0, 0, TAU); g.fill(); // 등 윤기
    g.restore();
  }
  // 입: 벌어지면 분홍 속과 작은 이
  if (P.jaw > 0.02) { // 입 속: 윗입술선과 벌어진 아래턱 윗선 사이를 메운다
    const JR = around(14.3, 0.8, P.jaw), [lx, ly] = ap(JR, 21.8, 0.45), [qx, qy] = ap(JR, 17.6, 1.2);
    g.fillStyle = C(OR.mouth); g.beginPath(); g.moveTo(14.2, 0.85); g.quadraticCurveTo(17.6, 1.15, 21.95, 0.35); g.lineTo(lx, ly); g.quadraticCurveTo(qx, qy, 14.3, 0.8); g.closePath(); g.fill(); g.strokeStyle = C(OR.mouth); g.lineWidth = 0.3; g.stroke(); // 테두리를 살짝 덧그려 이음새 틈을 없앤다
    if (real && P.jaw > 0.12) { g.fillStyle = OR.tooth; for (let k = 0; k < 4; k++) { const x = 16.0 + k * 1.3, y = 0.92 + 0.12 * Math.sin((x - 14.4) / 7.4 * Math.PI) - (x - 14.3) * 0.03; g.beginPath(); g.moveTo(x - 0.35, y - 0.05); g.lineTo(x, y + 0.65); g.lineTo(x + 0.35, y - 0.05); g.fill(); } }
  }
  g.restore();
  part(MJ, JAW, OR.white);
  if (real) { // 아래턱 끝의 검은 입술선
    g.save(); g.transform(MJ.a, MJ.b, MJ.c, MJ.d, MJ.e, MJ.f); g.clip(JAW); g.fillStyle = OR.col;
    g.beginPath(); g.moveTo(14.3, 0.5); g.quadraticCurveTo(17.6, 0.9, 22.4, 0.1); g.quadraticCurveTo(22.7, 1.3, 21.2, 1.6); g.quadraticCurveTo(18, 1.45, 14.3, 1.25); g.closePath(); g.fill();
    g.restore();
  }
  // 연어(먹기): 물고 올라와 버둥대다 고개를 젖혀 삼킨다
  if (!icon && ek > 0.5 && ec > FISH0 && ec < SWALLOW + 0.06) {
    const sw = sm((ec - SWALLOW) / 0.055), wig = Math.sin(t * 12) * (1 - sw);
    g.save(); g.transform(MF.a, MF.b, MF.c, MF.d, MF.e, MF.f);
    g.translate(21.2 - sw * 4.4, 1.3); g.rotate(Math.PI / 2 + 0.4 + 0.25 * wig - sw * 1.6); g.scale(1.15 - sw * 0.7, 1.15 - sw * 0.7);
    g.fillStyle = C(OR.fishFin); g.beginPath(); g.moveTo(-2.4, 0); g.lineTo(-4.3, -1.4 + wig * 0.6); g.lineTo(-3.8, 0); g.lineTo(-4.3, 1.4 + wig * 0.6); g.closePath(); g.fill();
    g.fillStyle = C(OR.fish); g.beginPath(); g.ellipse(0, 0, 2.9, 1.15, 0, 0, TAU); g.fill();
    if (real) { g.fillStyle = OR.fishFin; g.beginPath(); g.moveTo(-0.6, -1); g.lineTo(0.9, -1.9); g.lineTo(1, -0.9); g.fill(); ell(g, 1.8, -0.25, 0.32, 0.32, 0, OR.fishEye); }
    g.restore();
  }
  part(MPn, FLIP, OR.fin);
  if (real) {
    g.save(); g.transform(MPn.a, MPn.b, MPn.c, MPn.d, MPn.e, MPn.f); g.clip(FLIP); // 가슴지느러미 윗가장자리 윤기(몸과 겹쳐도 구분되게)
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, -1.1); g.quadraticCurveTo(3.4, -2.0, 6.6, -1.4); g.stroke(); g.restore();
    g.save(); g.transform(MF.a, MF.b, MF.c, MF.d, MF.e, MF.f); g.lineCap = 'round';
    g.strokeStyle = OR.hole; g.lineWidth = 0.45; g.beginPath(); g.arc(8.6, -5.95, 0.6, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); // 숨구멍
    g.strokeStyle = OR.lip; g.lineWidth = 0.4; g.beginPath(); g.moveTo(14.7, 0.8); g.quadraticCurveTo(13.9, 0.75, 13.7, 0.05); g.stroke(); // 웃는 입꼬리
    const [ex, ey] = EYE, er = EYE_R; // 눈: 흰 테두리 + 까만 눈동자(감으면 아래로 휜 선)
    if (lid > 0.85) {
      g.strokeStyle = OR.lidLine; g.lineWidth = 0.42; g.beginPath(); g.arc(ex, ey - er * 0.55, er * 1.05, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
    } else {
      ell(g, ex, ey, er * 1.3, er * 1.3, 0, OR.eyeRing);
      ell(g, ex + 0.12, ey + 0.05, er, er, 0, OR.pupil);
      ell(g, ex + er * 0.42, ey - er * 0.32, er * 0.36, er * 0.36, 0, '#ffffff');
      if (lid > 0.1) {
        g.save(); g.beginPath(); g.arc(ex, ey, er * 1.35, 0, TAU); g.clip(); g.fillStyle = OR.col; g.fillRect(ex - er * 1.5, ey - er * 1.5, er * 3, er * 3 * lid * 0.95); g.restore();
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
    g.strokeStyle = C(OR.foam); g.lineWidth = 0.75; g.beginPath(); g.moveTo(a - 0.4, wave(a - 0.4, t));
    for (let x = a + 0.8; x < b + 0.4; x += 1.2) g.lineTo(x, wave(x, t) + 0.1);
    g.lineTo(b + 0.4, wave(b + 0.4, t)); g.stroke();
    ell(g, a - 0.1, 0.05, 1.0, 0.55, 0, OR.foam); ell(g, b + 0.1, 0.05, 1.0, 0.55, 0, OR.foam);
  }
  const splash = (x, age, s) => {
    if (age <= 0 || age >= 1) return;
    const k = 1 - age, hgt = s * 5.5 * Math.sin(Math.PI * Math.min(1, age * 1.3)), wd = s * 3.2 * (0.7 + age * 0.6);
    if (hgt > 0.4) {
      g.fillStyle = C(OR.foam); g.beginPath(); g.moveTo(x - wd, 0.5);
      for (let i = 0; i <= 8; i++) { const u = i / 8, tip = i % 2 ? hgt * 0.42 : hgt * (1 - Math.abs(u - 0.5) * 1.1); g.lineTo(x - wd + 2 * wd * u, -tip); }
      g.lineTo(x + wd, 0.5); g.quadraticCurveTo(x, 1.4, x - wd, 0.5); g.fill();
    }
    for (let i = 0; i < 9; i++) {
      const vx = (hash(i, 3, 7) - 0.5) * 16 * s, vy = (7 + hash(i, 5, 11) * 7) * s, px = x + vx * age, py = -(vy * age - 13 * s * age * age), rr = s * (0.35 + 0.35 * k);
      if (py < 0.3) ell(g, px, py, rr * 0.85, rr, 0, OR.drop);
    }
  };
  if (special) { splash(1.5, (sp - 0.1) / 0.16, 1.1); splash(1.5, (sp - 0.79) / 0.13, 0.9); splash(6, (sp - 0.92) / 0.1, 0.6); }
  if (ek > 0.5) { splash(4, (ec - 0.1) / 0.2, 0.8); splash(-6, (ec - 0.27) / 0.14, 0.7); splash(10, (ec - 0.5) / 0.14, 0.9); }
  if (spout >= 0 && spout < 1) { // 숨구멍 물보라(물 위에 있을 때만): 굵은 줄기가 솟고 끝이 덤불처럼 퍼졌다가 흩어진다
    const [bx, by] = ap(MF, 8.6, -6.6);
    if (by < -0.6) {
      const up = sm(spout / 0.35), fade = 1 - sm((spout - 0.6) / 0.4), hh = (2 + up * 7.5) * spS, rr = (0.8 + up * 1.2) * fade * spS;
      if (fade > 0.05) {
        g.fillStyle = C(OR.spray); g.beginPath(); g.moveTo(bx - 0.45 * fade, by + 0.2); g.lineTo(bx - 0.65 * rr, by - hh); g.lineTo(bx + 0.65 * rr, by - hh); g.lineTo(bx + 0.45 * fade, by + 0.2); g.fill();
        ell(g, bx, by - hh - rr * 0.45, rr * 1.15, rr * 0.95, 0, OR.spray); ell(g, bx - rr * 0.95, by - hh + rr * 0.1, rr * 0.8, rr * 0.7, 0, OR.spray); ell(g, bx + rr, by - hh + rr * 0.05, rr * 0.85, rr * 0.7, 0, OR.spray);
      }
    }
  }
}
