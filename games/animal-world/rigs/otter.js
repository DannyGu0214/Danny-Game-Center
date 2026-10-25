// 해달 리그(물에 사는 동물): 갈색 털, 연회색 머리, 흰 수염, 작고 둥근 귀, 물갈퀴 뒷발, 굵은 꼬리.
// 물 위에 떠 있어 수면(y = 0) 위만 보인다(아래는 잘라 낸다). 땅 그림자 대신 수면 물결 고리를 그린다.
// 헤엄(걷기): 배를 아래로 하고 머리·등만 내민 채 꼬리를 저으며 나아간다. 쉬기·눕기: 배를 위로 하고 누워 앞발을 가슴에(눕기는 눈 감고 둥실둥실).
// 먹기: 누운 채 앞발로 성게를 들고 오물오물. 물: 쉬기와 같다. 특수 행동: 배 위에 돌을 얹고 조개를 쥐고 내리쳐 깨기.
// 누운 자세 ↔ 헤엄 자세는 몸을 위아래로 뒤집듯 빠르게 바꾼다(몸짓 상태 r.bel 스프링).
// 좌표·포즈 규칙은 rigs/zebra.js와 같다. 원점은 몸통 아래 수면, 오른쪽을 보는 옆모습, 위가 -y.

export const STRIDE = 5; // 한 번 젓는 동안 나아가는 거리
export const BOX = [11, 10];
const TAU = Math.PI * 2;
const OT = {
  fur: '#6b4630', far: '#563723', belly: '#7d5639', head: '#cfc5b6', face: '#ebe5da', nose: '#2a1d17', paw: '#4a3020', foot: '#3e281b',
  ear: '#8f8170', whisk: '#f7f3ec', stone: '#8b8d92', stone2: '#a7a9ae', clam: '#dcc7a2', clam2: '#a88f6c', urchin: '#5a3360', spine: '#7d4c82',
};

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ss = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
const env = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? ss((s - a) / (b - a)) : s <= c ? 1 : 1 - ss((s - c) / (d - c)));

let BACK = null, TAIL = null, FOOT = null;
function paths() {
  if (BACK) return;
  BACK = new Path2D(); // 배를 위로 누운 몸(엉덩이 → 둥근 배 → 가슴 → 목). 수면 아래는 잘린다
  BACK.moveTo(-7.2, 1);
  BACK.bezierCurveTo(-6.8, -2.4, -3, -3.5, 0, -3.4);
  BACK.bezierCurveTo(2.8, -3.3, 4.6, -3.0, 5.6, -3.8);
  BACK.lineTo(8.4, -2.2);
  BACK.lineTo(8.6, 1.5);
  BACK.lineTo(-7.2, 1.5);
  BACK.closePath();
  TAIL = new Path2D(); // 굵고 납작한 꼬리(원점 = 꼬리 뿌리, -x 쪽으로 뻗는다)
  TAIL.moveTo(0.5, -1.5);
  TAIL.quadraticCurveTo(-2.8, -1.5, -4.6, -0.9);
  TAIL.quadraticCurveTo(-5.6, -0.4, -4.8, 0.4);
  TAIL.quadraticCurveTo(-2.4, 0.9, 0.5, 1.2);
  TAIL.closePath();
  FOOT = new Path2D(); // 물갈퀴 뒷발(원점 = 발목, +x = 발끝). 끝이 넓고 발가락 사이가 살짝 파였다
  FOOT.moveTo(0, -0.6);
  FOOT.quadraticCurveTo(1.6, -1.4, 3.2, -1.3);
  FOOT.lineTo(3.0, -0.6);
  FOOT.lineTo(3.5, -0.2);
  FOOT.lineTo(3.1, 0.3);
  FOOT.lineTo(3.4, 0.9);
  FOOT.quadraticCurveTo(1.6, 1.2, 0, 0.6);
  FOOT.closePath();
}

export function draw(g, p, H) {
  const { springTo, rigTick, ell, eye, C, taper } = H;
  paths();
  const r = p.rig ?? {}, dt0 = p.dt ?? 0;
  rigTick(r, dt0);
  const dt = Math.min(dt0, 0.05), t = p.ph ?? 0, hd = p.hd ?? 0, ly = p.ly ?? 0, sp = p.sp ?? -1, real = H.real();
  const special = sp >= 0, moving = p.mv > 0 && !special, u = (((p.gait ?? 0) % 1) + 1) % 1;
  const spring = (key, target, k, c) => { let s = r[key]; if (!s) s = r[key] = { x: target, v: 0 }; if (dt > 0) springTo(s, target, k, c, dt); return s.x; };
  const bel = clamp01(spring('bel', moving ? 1 : 0, 150, 24)); // 1 = 배를 아래로(헤엄), 0 = 배를 위로(누움)
  const look = r.look ?? 0;

  // ---- 수면 물결 고리(그림자 대신) ----
  if (p.shadow !== false) {
    g.lineWidth = 0.7; g.strokeStyle = 'rgba(255,255,255,0.55)';
    const w = moving ? 0.5 * Math.sin(u * TAU) : 0.4 * Math.sin(t * 1.3);
    g.beginPath(); g.ellipse(0, 0.3, 11.5 + w, 2.4, 0, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(-0.5, 0.4, 13.5 - w, 3.1, 0, 0, TAU); g.stroke();
    if (moving) { g.strokeStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(10, 0.2); g.quadraticCurveTo(2, 1.6, -10, 2.8); g.moveTo(10, -0.1); g.quadraticCurveTo(2, -0.9, -10, -1.4); g.stroke(); } // 뱃머리 물살
  }

  // ---- 수면 위만 그린다 ----
  g.save();
  g.beginPath(); g.rect(-40, -40, 80, 40); g.clip();
  const flip = bel < 0.5 ? 1 - 2 * bel : 2 * bel - 1; // 뒤집는 중엔 위아래로 납작해졌다 다시 펴진다
  g.scale(1, Math.max(0.04, flip));

  // 머리(머리 좌표: +x = 코끝, -y = 정수리). fy = -1이면 위아래를 뒤집어(배를 위로 누움) 정수리가 물 쪽
  const head = (x, y, ang, fy, closed) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), ex = x + ca * 0.95 + sa * 0.8 * fy, ey = y + sa * 0.95 - ca * 0.8 * fy;
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(1, fy);
    ell(g, -1.6, -1.9, 0.85, 0.75, -0.3, OT.ear); // 작고 둥근 귀
    ell(g, 0, 0, 2.75, 2.5, 0, OT.head);
    ell(g, 2.15, 0.55, 1.65, 1.3, 0, OT.face); // 주둥이(수염 자리)
    if (real) {
      ell(g, -1.55, -1.85, 0.4, 0.35, -0.3, '#5a4a3c'); // 귓속
      ell(g, -1.2, 1.2, 1.9, 1.0, 0.3, 'rgba(120,100,80,0.18)'); // 뺨 아래 그늘
      g.strokeStyle = OT.whisk; g.lineWidth = 0.2; g.lineCap = 'round'; g.beginPath(); // 수염
      for (const [a, b] of [[4.3, 0.75], [4.2, 1.45], [3.7, 2.05]]) { g.moveTo(2.5, 0.9); g.quadraticCurveTo((2.5 + a) / 2, (0.9 + b) / 2 - 0.2, a, b); }
      g.stroke();
      g.strokeStyle = '#4a3a30'; g.lineWidth = 0.22; g.beginPath(); g.moveTo(3.3, 0.6); g.quadraticCurveTo(3.0, 1.45, 2.2, 1.5); g.stroke(); // 입
      for (const [x2, y2] of [[2.4, 0.6], [2.8, 0.95], [2.2, 1.0]]) ell(g, x2, y2, 0.11, 0.11, 0, '#8a7a6a'); // 수염 뿌리 점
    }
    ell(g, 3.45, 0.05, 0.62, 0.46, 0, OT.nose);
    g.restore();
    if (!closed) eye(g, ex, ey, 0.5, false);
    else { g.strokeStyle = C('#2a1d14'); g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath(); g.arc(ex, ey - 0.25, 0.5, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); } // 감은 눈(웃는 모양)
  };

  if (bel < 0.5) {
    // ===== 배를 위로 누운 자세(쉬기·눕기·먹기·특수) =====
    const eat = p.st === 'eat' && !special ? hd : 0, rest = special ? 0 : ly * (1 - eat);
    const crack = special ? ss(sp / 0.08) * ss((1 - sp) / 0.06) : 0;
    const groom = !special && p.st === 'idle' ? env((t % 9) / 9, 0.55, 0.6, 0.78, 0.83) : 0; // 가끔 앞발로 얼굴 문지르기
    const bob = (0.25 + rest * 0.15) * Math.sin(t * TAU / (2.6 + rest * 1.2)), tilt = 0.03 * Math.sin(t * TAU / 3.4 + 0.7) * (1 - crack * 0.5);
    g.save(); g.translate(0, bob); g.rotate(tilt);
    // 조개 깨기: 위로 들었다가 빠르게 돌에 내리친다(1초에 두 번)
    const k = sp * 9.5, f = k - Math.floor(k);
    const raise = special ? (f < 0.55 ? ss(f / 0.55) : f < 0.7 ? 1 - ss((f - 0.55) / 0.15) : 0) : 0, hit = special && f >= 0.68 && f < 0.85 ? 1 - (f - 0.68) / 0.17 : 0;
    // 뒷발(먼 쪽): 물 밖으로 비스듬히, 쉴 때 까딱까딱
    const wig = (1 - rest * 0.7) * Math.sin(t * 1.9), wig2 = (1 - rest * 0.7) * Math.sin(t * 1.9 + 1.7);
    const hindFoot = (x, y, a, col) => { g.save(); g.translate(x, y); g.rotate(a); g.scale(0.85, 0.85); taper(g, 0.6, 0.4, -0.2, 0, 1.6, 1.2, col); g.fillStyle = C(col); g.fill(FOOT); g.restore(); };
    hindFoot(-5.6, -2.2, -2.15 + 0.12 * wig2, OT.foot);
    // 꼬리(수면에 납작하게)
    g.save(); g.translate(-6.4, 0.25); g.rotate(0.04 * Math.sin(t * 1.1)); g.scale(1, 0.85); g.fillStyle = C(OT.fur); g.fill(TAIL); g.restore();
    // 몸통
    g.fillStyle = C(OT.fur); g.fill(BACK);
    if (real) {
      g.save(); g.clip(BACK);
      g.fillStyle = OT.belly; g.beginPath(); g.ellipse(-0.5, -2.6, 6.2, 1.2, 0.02, 0, TAU); g.fill(); // 배 털(조금 밝다)
      g.fillStyle = 'rgba(255,235,210,0.18)'; g.beginPath(); g.ellipse(4.4, -3.2, 2.2, 0.8, -0.3, 0, TAU); g.fill(); // 가슴 밝은 털
      g.restore();
    }
    // 돌(특수): 배 위에 납작한 돌
    if (crack > 0) {
      g.save(); g.translate(0.4, -3.6); g.scale(crack, crack);
      ell(g, 0, 0, 2.1, 0.95, -0.05, OT.stone);
      if (real) ell(g, -0.4, -0.35, 1.1, 0.35, -0.05, OT.stone2);
      g.restore();
    }
    // 머리: 쉴 땐 가슴 쪽을 내려다보고 두리번, 먹을 땐 앞발의 먹이로, 깰 땐 돌을 본다
    let ha = -2.3 + 0.1 * Math.sin(look * 0.5) * Math.sin(look * 0.21), hx = 6.8, hy = -4.5;
    ha = lerp(ha, -2.1, rest); hy += rest * 0.5; hx += rest * 0.3;
    ha = lerp(ha, -2.45 + 0.08 * Math.sin(t * TAU * 2.6), eat);
    ha = lerp(ha, -2.55 + 0.08 * hit, crack);
    ha = lerp(ha, -2.2 + 0.06 * Math.sin(t * TAU * 2), groom);
    const closed = rest > 0.5 || r.blink > 0 || groom > 0.5 || hit > 0.5;
    head(hx, hy, ha, -1, closed);
    // 앞발: 가슴 위 → (먹기) 입 앞에 먹이 → (특수) 조개를 들고 내리치기 → (쉬기) 얼굴 문지르기
    let px = 3.2, py = -4.1;
    px = lerp(px, 3.1, eat); py = lerp(py, -5.5 + 0.3 * Math.sin(t * TAU * 1.3), eat);
    if (crack > 0) { px = lerp(px, lerp(1.0, 2.2, raise), crack); py = lerp(py, lerp(-5.0, -8.6, raise), crack); }
    if (groom > 0) { const c = t * TAU * 2.2; px = lerp(px, 5.0 + 0.5 * Math.cos(c), groom); py = lerp(py, -6.5 + 0.5 * Math.sin(c), groom); }
    const sh = [4.6, -3.4];
    taper(g, sh[0] - 0.6, sh[1] - 0.2, px + 0.5, py - 0.1, 1.9, 1.3, OT.far); // 먼 앞발
    ell(g, px + 0.6, py - 0.2, 0.9, 0.75, 0, OT.paw);
    // 먹이(성게)·조개
    if (eat > 0.3) {
      const fx = px - 0.2, fy = py - 0.9;
      if (real) { g.strokeStyle = OT.spine; g.lineWidth = 0.2; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.moveTo(fx + Math.cos(a) * 0.9, fy + Math.sin(a) * 0.9); g.lineTo(fx + Math.cos(a) * 1.6, fy + Math.sin(a) * 1.6); } g.stroke(); }
      ell(g, fx, fy, 1.05, 1.0, 0, OT.urchin);
    }
    if (crack > 0) {
      const cx = px - 0.3, cy = py - 1.0;
      g.save(); g.translate(cx, cy); g.rotate(-0.4 + raise * 0.3);
      ell(g, 0, 0, 1.45, 1.0, 0, OT.clam);
      if (real) { g.strokeStyle = OT.clam2; g.lineWidth = 0.18; g.beginPath(); for (const a of [-0.7, -0.25, 0.2, 0.65]) { g.moveTo(0, 0.85); g.lineTo(Math.sin(a) * 1.4, 0.85 - Math.cos(a) * 1.75); } g.stroke(); }
      g.restore();
      if (hit > 0 && real) { // 탁! 부딪는 선
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.3; g.lineCap = 'round'; g.beginPath();
        for (const a of [-2.6, -2.0, -1.2, -0.6]) { const r0 = 1.9 + (1 - hit) * 0.6; g.moveTo(cx + Math.cos(a) * r0, cy + 0.5 + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + 0.9), cy + 0.5 + Math.sin(a) * (r0 + 0.9)); }
        g.stroke();
      }
    }
    taper(g, sh[0], sh[1], px - 0.4, py + 0.2, 2.0, 1.4, OT.fur); // 가까운 앞발
    ell(g, px - 0.5, py + 0.2, 0.95, 0.8, 0, OT.paw);
    // 뒷발(가까운 쪽)
    hindFoot(-4.6, -2.2, -1.95 + 0.12 * wig, OT.foot);
    g.restore();
  } else {
    // ===== 배를 아래로 헤엄치기: 머리와 등만 물 위, 꼬리로 저어 나아간다 =====
    const bob = moving ? 0.22 * Math.sin(u * TAU * 2) : 0, pitch = moving ? 0.025 * Math.sin(u * TAU * 2 + 1) : 0;
    g.save(); g.translate(0, bob); g.rotate(pitch);
    // 꼬리: 위아래로 저어 끝이 물 위로 나왔다 들어간다. 등은 젓는 박자에 맞춰 물결치듯 오르내린다
    const hump = moving ? 0.4 * Math.sin(u * TAU) : 0;
    g.save(); g.translate(-6.6, -0.5 - hump * 0.5); g.rotate(-0.12 + 0.3 * Math.sin(u * TAU - 0.9)); g.fillStyle = C(OT.fur); g.fill(TAIL); g.restore();
    const SWIM = new Path2D(); // 배를 아래로 헤엄치는 몸(낮은 등 → 어깨 → 목)
    SWIM.moveTo(-7.4, 1);
    SWIM.bezierCurveTo(-6.6, -2.3 - hump, -3, -3.0 - hump * 0.6, 0.4, -2.9 + hump * 0.3);
    SWIM.bezierCurveTo(3, -2.8 + hump * 0.4, 4.6, -2.9, 5.6, -3.6);
    SWIM.lineTo(8.2, -1.6); SWIM.lineTo(8.4, 1.5); SWIM.lineTo(-7.4, 1.5); SWIM.closePath();
    g.fillStyle = C(OT.fur); g.fill(SWIM);
    if (real) {
      g.save(); g.clip(SWIM);
      g.fillStyle = 'rgba(255,230,200,0.16)'; g.beginPath(); g.ellipse(-0.5, -2.1, 6, 0.6, 0, 0, TAU); g.fill(); // 젖은 등 하이라이트
      g.restore();
    }
    const nod = moving ? 0.06 * Math.sin(u * TAU * 2 - 0.8) : 0;
    head(7.2, -3.7 - bob * 0.3, -0.22 + nod, 1, r.blink > 0);
    g.restore();
  }
  g.restore();
}
