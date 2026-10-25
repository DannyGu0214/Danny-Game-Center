// 오릭스(겜스복) 리그. 구조·좌표·p 필드는 rigs/zebra.js와 같다: draw(g, p, H), STRIDE, BOX.
// 원점은 몸통 아래 땅, 오른쪽을 보는 옆모습, 위가 -y. 아이콘처럼 gait·rig·dt가 없으면 서 있는 모습으로 그린다.
// 다부진 회갈색 몸, 가슴에서 옆구리를 지나 뒷다리까지 이어지는 굵은 검은 띠, 흰 배, 다리 윗부분은 검고 아래는 흰 양말,
// 흰 얼굴에 검은 가면(콧등·눈 줄), 목 아래 검은 줄, 짧고 검은 갈기, 아주 긴 칼 같은 곧은 뿔(얼굴 선을 따라 뒤로), 술 달린 검은 꼬리.
// 걸음 = 얼룩말 같은 4박 걷기(발 고정). 쉬기 = 숨·귀 털기·꼬리 휘두르기·천천히 두리번(뿔이 머리와 함께 돈다).
// 먹기·물 = 고개를 땅까지(뿔은 얼굴 선을 따라 위로 선다), 눕기 = 다리를 접고 고개는 든다,
// 특수(긴 뿔 휘두르며 껑충) = 세 번 날뛴다: 웅크림 → 앞을 들며 뛰어오름(고개를 젖혀 뿔이 등 쪽으로) → 공중에서 뒷발 차기(고개를 숙여 뿔을 앞으로 크게 휘두름) → 착지.

export const STRIDE = 10; // 한 걸음 주기 동안 몸이 나아가는 거리(그림 단위)
export const BOX = [18, 46]; // 탭 판정·표시 위치용 [가로 반폭, 높이](뿔 포함)
const DUTY = 0.64; // 4박 걷기: 가까운 뒷다리 → 가까운 앞다리 → 먼 뒷다리 → 먼 앞다리
const OFFS = { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 };
const TAU = Math.PI * 2;
const HOPS = [[0.04, 0.32, 5.5], [0.36, 0.64, 6.5], [0.68, 0.97, 7.5]]; // 껑충 [시작, 끝, 높이]
// 한 번 뛸 때(0~1)의 키 값: 몸 기울기(-: 앞을 듦) · 뒷발 차기 · 앞다리 접기 · 고개 젖힘(-: 뿔이 등 쪽, +: 뿔이 앞으로)
const PITCH = [[0, 0], [0.2, 0.05], [0.36, -0.24], [0.52, 0], [0.68, 0.22], [0.84, 0.02], [1, 0]];
const KICK = [[0, 0], [0.5, 0], [0.68, 1], [0.86, 0.05], [1, 0]];
const TUCK = [[0, 0], [0.22, 0], [0.36, 1], [0.54, 0.25], [0.8, 0], [1, 0]];
const TOSS = [[0, 0], [0.2, 0.45], [0.4, -0.75], [0.72, 1.45], [0.9, 0.25], [1, 0]];
const HL = 15; // 뿔 길이
const NA0 = 0.5, HR0 = 0.85; // 서 있을 때 목 기울기(세로에서 앞으로) · 얼굴 축 기울기

const OX = {
  col: '#bcae99', far: '#9a8d7b', white: '#f2eee7', whiteFar: '#cdc7bc', bk: '#24201d', bkFar: '#3c3631', pale: '#ddd4c6',
  hoof: '#24201d', hoofFar: '#3c3631', horn: '#2b2521', hornFar: '#4b433c', ring: '#605650', mane: '#6a5444', maneTip: '#2e241d', earIn: '#efe6da',
  hip: [-8.5, -20], sh: [8.5, -20.8], hind: { a: 7.6, b: 7.6, c: 6.6, bend: 1 }, fore: { a: 7.2, b: 7.8, c: 6.6, bend: -1 }, lift: 3.4,
};
const cl01 = (v) => Math.max(0, Math.min(1, v));
// 키 값 사이를 부드럽게 잇는다
function key(K, f, smooth) {
  for (let i = 1; i < K.length; i++) if (f <= K[i][0]) { const [a, va] = K[i - 1], [b, vb] = K[i]; return va + (vb - va) * smooth((f - a) / (b - a)); }
  return K[K.length - 1][1];
}
// 두 점 사이 사다리꼴(굵기 w0 → w1)을 경로에 더한다. 언제나 같은 방향으로 돌아 겹쳐도 구멍이 나지 않는다
function quad(P, a, b, w0, w1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  P.moveTo(a[0] + (nx * w0) / 2, a[1] + (ny * w0) / 2); P.lineTo(b[0] + (nx * w1) / 2, b[1] + (ny * w1) / 2);
  P.lineTo(b[0] - (nx * w1) / 2, b[1] - (ny * w1) / 2); P.lineTo(a[0] - (nx * w0) / 2, a[1] - (ny * w0) / 2); P.closePath();
}
function dot(P, c, rad) { P.moveTo(c[0] + rad, c[1]); P.arc(c[0], c[1], rad, 0, TAU, true); }

export function draw(g, p, H) {
  const { ik, footAt, smooth, springTo, rigTick, ell, eye, C } = H;
  const real = H.real();
  const r = p.rig ?? {}, dt = p.dt ?? 0;
  rigTick(r, dt);
  if (!r.hk) r.hk = 'eat';
  const sp = p.sp ?? -1, hop = sp >= 0, moving = p.mv > 0 && !hop, ph = p.gait ?? 0, t = p.ph ?? 0;
  const ly = p.ly ?? 0, hd = p.hd ?? 0; // 누워 있거나 먹다가 특수 행동이 시작되면 일어선 뒤에 날뛴다
  if (p.st === 'eat' || p.st === 'drink') r.hk = p.st; // 고개를 드는 동안에도 어떤 자세였는지 기억
  const ek = r.hk === 'eat' ? hd : 0, dk = r.hk === 'drink' ? hd : 0;

  // 특수: 날뛰기 한 번마다 높이·기울기·뒷발 차기·앞다리 접기·고개 젖힘
  let up = 0, pitch = 0, kick = 0, tuck = 0, toss = 0;
  if (hop) for (const [a, b, ht] of HOPS) {
    if (sp < a || sp > b) continue;
    const f = (sp - a) / (b - a);
    if (f < 0.2) up = -1.3 * Math.sin((Math.PI * f) / 0.2);
    else if (f < 0.84) { const u = (f - 0.2) / 0.64; up = 4 * u * (1 - u) * ht; }
    else up = -1.1 * Math.sin((Math.PI * (f - 0.84)) / 0.16);
    const w = 1 - smooth(cl01(Math.max(ly, hd) * 1.5));
    up *= w; pitch = key(PITCH, f, smooth) * w; kick = key(KICK, f, smooth) * w; tuck = key(TUCK, f, smooth) * w; toss = key(TOSS, f, smooth) * w;
  }
  const PY = -20, cp = Math.cos(pitch), sn = Math.sin(pitch);
  const W = (x, y) => [x * cp - (y - PY) * sn, PY - up + x * sn + (y - PY) * cp]; // 몸 기준 → 땅 기준(뛰어오름·기울기)
  if (p.shadow !== false) ell(g, 0, 0, 14 - Math.max(0, up) * 0.4, 3 - Math.max(0, up) * 0.08, 0, 'rgba(40,25,10,0.22)');

  const breath = Math.sin((t * TAU) / 3.2), bob = moving ? Math.sin(ph * TAU * 2) : 0, drop = ly * 13, dip = hd * 1.8 * (1 - ly);
  const hipL = [OX.hip[0], OX.hip[1] + 0.5 * bob + drop];
  const shL = [OX.sh[0], OX.sh[1] + 0.5 * (moving ? Math.sin(ph * TAU * 2 + 1.4) : 0) + drop + dip];

  // 다리: 서 있으면 IK로 발굽을 땅에, 걸으면 발 고정 걸음, 누우면 접고, 날뛸 땐 공중에서 차고 접는다
  const stroke = STRIDE * DUTY, airW = up > 0 ? smooth(cl01(up / 3)) : 0;
  const legPts = (k, rootL, cfg, front) => {
    const root = W(rootL[0], rootL[1]), x = rootL[0];
    if (ly > 0.5) return front ? [root, [x + 0.2, -3.7], [x + 4.1, -1.8], [x + 0.3, -1.1]] : [root, [x + 3.8, -3.7], [x - 3.5, -1.7], [x + 2.2, -1.1]];
    let f;
    if (moving) {
      const u = footAt((ph + OFFS[k]) % 1, stroke, OX.lift, DUTY);
      f = { x: u.x + x + 0.5, y: u.y, th: front ? 0.95 * u.sw + (u.st - 0.4) * 0.35 * (1 - u.sw) : 0.55 * u.sw + (u.st - 0.5) * 0.25 * (1 - u.sw) };
    } else {
      f = { x: x + (k === 'fh' ? -1.1 : k === 'ff' ? 1 : 0) + (front ? (k === 'nf' ? 1.6 : -0.6) * dk : 0), y: 0, th: 0 };
      if (hop) {
        const reach = (cfg.a + cfg.b + cfg.c) * 0.95;
        const q = W(front ? x + 1.5 * tuck : x - 7 * kick, rootL[1] + reach * (front ? 1 - 0.42 * tuck : 1 - 0.2 * kick));
        f.x += (q[0] - f.x) * airW; f.y = Math.min(0, q[1] * airW);
        f.th = ((front ? 1.7 * tuck : 1.0 * kick) + pitch) * airW;
      }
    }
    const hoof = [f.x, f.y], ankle = [hoof[0] + cfg.c * Math.sin(f.th), hoof[1] - cfg.c * Math.cos(f.th)];
    const { knee, end } = ik(root[0], root[1], ankle[0], ankle[1], cfg.a, cfg.b, cfg.bend);
    return [root, knee, end, hoof];
  };
  const legs = {
    fh: legPts('fh', [hipL[0] + 0.8, hipL[1]], OX.hind, false), ff: legPts('ff', [shL[0] + 0.8, shL[1]], OX.fore, true),
    nh: legPts('nh', hipL, OX.hind, false), nf: legPts('nf', shL, OX.fore, true),
  };
  if (p.shadow !== false && ly < 0.5) for (const k of ['nh', 'nf', 'fh', 'ff']) { const [x, y] = legs[k][3]; if (y > -0.3) ell(g, x, 0.2, 2, 0.65, 0, 'rgba(40,25,10,0.3)'); }
  // 다리 그리기: 한 덩어리로 칠한 뒤 윗마디는 검게, 대롱뼈는 흰 양말, 앞다리 무릎 앞에 검은 점
  const WH = [4.6, 3.6, 2.2, 1.9], WF = [4.1, 3.2, 2.1, 1.8];
  const leg = (pts, ws, far, front) => {
    const P = new Path2D();
    for (let i = 0; i < 3; i++) { quad(P, pts[i], pts[i + 1], ws[i], ws[i + 1]); dot(P, pts[i + 1], ws[i + 1] / 2); }
    g.fillStyle = C(far ? OX.far : OX.col); g.fill(P);
    if (real) {
      // 윗마디 앞쪽의 검은 반점(옆구리 띠가 다리로 이어진다)
      const [ax, ay] = pts[0], [kx, ky] = pts[1], L0 = Math.hypot(kx - ax, ky - ay) || 1, fx = (ky - ay) / L0, fy = -(kx - ax) / L0; // fx,fy = 앞쪽
      const s = front ? 1 : -1, B = new Path2D(); // 앞다리는 앞쪽, 뒷다리는 넓적다리 앞(무릎 쪽)
      B.moveTo(ax + fx * s * ws[0] * 0.5, ay + fy * s * ws[0] * 0.5); B.lineTo(kx + fx * s * ws[1] * 0.5, ky + fy * s * ws[1] * 0.5);
      B.quadraticCurveTo(kx - fx * s * ws[1] * 0.2 - (kx - ax) / L0 * 0.4, ky - fy * s * ws[1] * 0.2 - (ky - ay) / L0 * 0.4, ax - fx * s * ws[0] * 0.15, ay - fy * s * ws[0] * 0.15); B.closePath();
      g.fillStyle = far ? OX.bkFar : OX.bk; g.fill(B);
      const Wt = new Path2D(); quad(Wt, pts[2], pts[3], ws[2], ws[3]); dot(Wt, pts[2], ws[2] / 2 * 0.9);
      g.fillStyle = far ? OX.whiteFar : OX.white; g.fill(Wt);
      if (front) { const [ex, ey] = pts[2], [hx2, hy2] = pts[3], L = Math.hypot(hx2 - ex, hy2 - ey) || 1; ell(g, ex + ((hy2 - ey) / L) * 0.25 + ((hx2 - ex) / L) * 0.5, ey - ((hx2 - ex) / L) * 0.25 + ((hy2 - ey) / L) * 0.5, ws[2] * 0.55, ws[2] * 0.75, Math.atan2(hy2 - ey, hx2 - ex) - Math.PI / 2, far ? OX.bkFar : OX.bk); } // 검은 무릎
    }
    // 발굽: 대롱뼈 방향을 따라 기운 사다리꼴
    const [ex, ey] = pts[2], [hx2, hy2] = pts[3], L = Math.hypot(hx2 - ex, hy2 - ey) || 1, dx = (hx2 - ex) / L, dy = (hy2 - ey) / L, nx = dy, ny = -dx, w = ws[3];
    g.fillStyle = C(far ? OX.hoofFar : OX.hoof); g.beginPath();
    g.moveTo(hx2 - dx * 1.7 - nx * w * 0.55, hy2 - dy * 1.7 - ny * w * 0.55); g.lineTo(hx2 - dx * 1.7 + nx * w * 0.6, hy2 - dy * 1.7 + ny * w * 0.6);
    g.lineTo(hx2 + nx * w * 0.9, hy2 + ny * w * 0.9); g.lineTo(hx2 - nx * w * 0.65, hy2 - ny * w * 0.65); g.closePath(); g.fill();
  };
  leg(legs.fh, WH, true, false);
  leg(legs.ff, WF, true, true);

  // 몸 기준 좌표계(날뛸 때 기울고 떠오른다)
  const body = new Path2D(), by = 1 + 0.03 * breath, [hx, hy] = hipL, [sx, sy] = shL, my = (hy + sy) / 2;
  g.save(); g.translate(0, PY - up); g.rotate(pitch); g.translate(0, -PY);
  // 꼬리(스프링): 길고 검은 술. 걸을 때 흔들리고 가끔 휙, 날뛸 땐 뒷발과 함께 튀어 오른다
  const tr = [hx - 6.8, hy - 5.4];
  springTo(r.tail, 0.22 + r.swish * 1.1 + (moving ? 0.12 * Math.sin(ph * TAU) : 0) + ly * 0.5, 40, 6, dt);
  const ta = r.tail.x + 1.1 * kick - 0.2 * tuck, tl = 11 - ly * 2.5;
  const tm = [tr[0] - Math.sin(ta * 0.6) * tl * 0.45 - 0.5, tr[1] + Math.cos(ta * 0.6) * tl * 0.45], te = [tr[0] - Math.sin(ta) * tl, tr[1] + Math.cos(ta) * tl];
  const tq = (u) => [(1 - u) * (1 - u) * tr[0] + 2 * (1 - u) * u * tm[0] + u * u * te[0], (1 - u) * (1 - u) * tr[1] + 2 * (1 - u) * u * tm[1] + u * u * te[1]];
  H.curve(g, tr[0], tr[1], tm[0], tm[1], te[0], te[1], 1.2, OX.col);
  const t1 = tq(0.38), t2 = tq(0.7);
  g.strokeStyle = C(OX.bk); g.lineWidth = 2.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(t1[0], t1[1]); g.quadraticCurveTo(t2[0], t2[1], te[0], te[1]); g.stroke();
  ell(g, te[0] - Math.sin(ta) * 0.6, te[1] + Math.cos(ta) * 0.6, 1.25, 2, -ta, OX.bk);

  // 몸통: 둥근 엉덩이 · 곧은 등 · 살짝 솟은 어깨 · 깊은 가슴 · 배(숨 쉴 때 살짝 부푼다)
  body.moveTo(hx - 1.5, hy - 8);
  body.quadraticCurveTo(0, Math.min(hy, sy) - 6.8, sx + 0.5, sy - 9.4);
  body.quadraticCurveTo(sx + 5.4, sy - 9, sx + 6.4, sy - 3.4);
  body.quadraticCurveTo(sx + 7.6, sy + 2.2, sx + 3.4, sy + 4.6 * by);
  body.quadraticCurveTo(0, my + 7.6 * by, hx + 2, hy + 4.6 * by);
  body.quadraticCurveTo(hx - 5, hy + 4.8, hx - 7, hy - 1.4);
  body.quadraticCurveTo(hx - 7.4, hy - 7.6, hx - 1.5, hy - 8);
  body.closePath();
  g.fillStyle = C(OX.col); g.fill(body);
  if (real) {
    g.save(); g.clip(body);
    // 흰 배(옆구리 띠 아래)
    g.fillStyle = OX.white; g.beginPath(); g.moveTo(sx + 9, sy + 0.6); g.quadraticCurveTo(sx + 3.6, sy + 2.4, 0, my + 3.6);
    g.quadraticCurveTo(hx + 4, hy + 2.8, hx + 2.4, hy - 0.8); g.lineTo(hx - 2, hy + 9); g.lineTo(sx + 9, sy + 9); g.closePath(); g.fill();
    // 엉덩이 아래 옅은 반점
    g.fillStyle = OX.pale; g.beginPath(); g.ellipse(hx - 5.4, hy + 1.2, 2.2, 3.8, 0.15, 0, TAU); g.fill();
    // 가슴에서 옆구리를 따라 뒷다리로 이어지는 검은 띠, 뒷다리 윗부분의 검은 반점
    g.fillStyle = OX.bk; g.beginPath(); g.moveTo(sx + 7.8, sy - 2.4); g.quadraticCurveTo(sx + 3, sy - 0.4, 0, my + 1.1);
    g.quadraticCurveTo(hx + 5, hy + 0.4, hx + 2.2, hy - 0.9); g.quadraticCurveTo(hx + 4, hy + 2.8, 0, my + 3.6);
    g.quadraticCurveTo(sx + 3.6, sy + 2.4, sx + 7.8, sy + 0.6); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(hx + 1.4, hy + 3.2, 3.2, 2.3, -0.35, 0, TAU); g.fill();
    g.fillStyle = 'rgba(60,45,30,0.15)'; g.beginPath(); g.ellipse(0, my + 6.4, 14, 3, 0, 0, TAU); g.fill(); // 배 쪽 그늘
    g.fillStyle = 'rgba(255,250,240,0.35)'; g.beginPath(); g.ellipse(-0.5, Math.min(hy, sy) - 7.4, 10, 1.3, 0, 0, TAU); g.fill(); // 등 하이라이트
    g.strokeStyle = 'rgba(70,50,35,0.45)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(sx - 0.5, sy - 9.2); g.quadraticCurveTo(0, Math.min(hy, sy) - 7.6, hx - 1.5, hy - 7.9); g.stroke(); // 등줄
    g.restore();
  }
  g.restore();
  leg(legs.nh, WH, false, false);
  leg(legs.nf, WF, false, true);

  // 목·머리(몸 기준 좌표계): 걸을 땐 한 걸음에 두 번 끄덕, 쉴 땐 천천히 두리번, 먹을 땐 땅까지. 날뛸 땐 뿔을 크게 휘두른다
  g.save(); g.translate(0, PY - up); g.rotate(pitch); g.translate(0, -PY);
  const look = r.look ?? 0;
  const nod = moving ? 0.06 * Math.sin(ph * TAU * 2 - 0.6) : 0.1 * Math.sin(look * 0.5) * Math.sin(look * 0.23);
  springTo(r.head, nod * (1 - hd) * (hop ? 0 : 1), 60, 9, dt);
  // 고개를 젖히거나 숙일 땐(날뛰기) 목을 세운다
  const nib = ek > 0.6 ? 0.05 * Math.sin(t * 6) * Math.max(0, Math.sin(t * 1.3)) : dk > 0.6 ? 0.025 * Math.sin(t * 9) : 0; // 풀 뜯기 · 홀짝
  const na = NA0 + r.head.x + hd * 2.15 - ly * 0.14 - Math.abs(toss) * 0.22 - pitch * 0.3, nb = [sx + 3.6, sy - 6.2], nl = 8.5 + hd * hd * 7 + dk * 0.6;
  const tip = [nb[0] + Math.sin(na) * nl, nb[1] - Math.cos(na) * nl], nx = Math.cos(na), ny = Math.sin(na);
  const mx = (nb[0] + tip[0]) / 2, mY = (nb[1] + tip[1]) / 2;
  const neck = new Path2D();
  neck.moveTo(sx + 0.2, sy - 8.8); // 목 뿌리는 어깨(등)와 가슴에 고정해 어떤 각도에서도 몸에 붙는다
  neck.quadraticCurveTo(mx - nx * 2.6, mY - ny * 2.6, tip[0] - nx * 2.3, tip[1] - ny * 2.3);
  neck.lineTo(tip[0] + nx * 2.7, tip[1] + ny * 2.7);
  neck.quadraticCurveTo(mx + nx * 3.4, mY + ny * 3.4, sx + 6.2, sy - 1.4);
  neck.closePath();
  g.fillStyle = C(OX.col); g.fill(neck);
  if (real) { // 목 아래 검은 줄(턱에서 가슴 띠까지)
    g.save(); g.clip(neck); g.strokeStyle = OX.bk; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(tip[0] + nx * 2.8, tip[1] + ny * 2.8); g.quadraticCurveTo(mx + nx * 3.5, mY + ny * 3.5, sx + 6.6, sy - 1.2); g.stroke();
    g.restore();
  }
  // 갈기: 목 윗선을 따라 짧고 검은 털
  g.strokeStyle = C(OX.mane); g.lineWidth = 1.3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(tip[0] - nx * 2, tip[1] - ny * 2); g.quadraticCurveTo(mx - nx * 2.9, mY - ny * 2.9, sx + 0.4, sy - 9.2); g.stroke();
  if (real) {
    g.strokeStyle = OX.maneTip; g.lineWidth = 0.7; g.beginPath();
    for (let i = 1; i <= 5; i++) {
      const u = i / 6, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      const qx = a * (tip[0] - nx * 2) + b * (mx - nx * 2.9) + c * (sx + 0.4), qy = a * (tip[1] - ny * 2) + b * (mY - ny * 2.9) + c * (sy - 9.2);
      g.moveTo(qx - nx * 0.5, qy - ny * 0.5); g.lineTo(qx - nx * 1.6 + ny * 0.3, qy - ny * 1.6 - nx * 0.3);
    }
    g.stroke();
  }

  // 머리(옆모습): 흰 얼굴 · 검은 콧등과 눈 줄 · 넓은 귀 · 얼굴 선을 따라 뒤로 뻗은 긴 뿔. 귀는 스프링으로 가끔 휙
  const hr = HR0 + (na - NA0) * (0.4 - 0.12 * hd) + toss * 0.75 + nib;
  g.save(); g.translate(tip[0], tip[1]); g.rotate(hr);
  const ear = (x, y, ang, col, inner) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(-1.3, 0); g.quadraticCurveTo(-2, -3.2, 0, -4.9); g.quadraticCurveTo(2, -3.2, 1.3, 0); g.closePath(); g.fill();
    if (inner && real) { ell(g, 0.1, -2.4, 0.75, 1.7, 0, OX.earIn); ell(g, 0, -4.4, 0.7, 0.5, 0, OX.bk); }
    g.restore();
  };
  const horn = (bx, by2, col, w, da) => { // 곧고 가는 뿔: 밑동이 굵고 끝이 뾰족, 아주 살짝 등 쪽으로 휜다
    g.save(); g.translate(bx, by2); g.rotate(Math.PI - 0.12 + da);
    g.fillStyle = C(col); g.beginPath(); g.moveTo(0, -w / 2); g.quadraticCurveTo(HL * 0.5, -w * 0.36 + 0.3, HL, 0.08); g.lineTo(HL, 0.3);
    g.quadraticCurveTo(HL * 0.5, w * 0.36 + 0.3, 0, w / 2); g.closePath(); g.fill();
    if (real) { g.strokeStyle = OX.ring; g.lineWidth = 0.3; g.beginPath(); for (let i = 1; i <= 5; i++) { const x = i * 0.85, hw = (w / 2) * (1 - (x / HL) * 0.7); g.moveTo(x, -hw + 0.05); g.lineTo(x + 0.25, hw + 0.05); } g.stroke(); }
    g.restore();
  };
  ear(-1.4, -1.3, -1.55 + r.ear.x * 0.5, OX.far, false);
  horn(0.4, -2.5, OX.hornFar, 1.2, -0.07);
  const head = new Path2D();
  head.moveTo(-1.9, -2.2); head.quadraticCurveTo(2.5, -3.2, 7.2, -1.4); head.quadraticCurveTo(8.9, -0.9, 8.6, 0.6);
  head.quadraticCurveTo(8.3, 1.9, 6.6, 1.9); head.quadraticCurveTo(3.2, 3, 0.3, 3.1); head.quadraticCurveTo(-2.5, 2.5, -1.9, -2.2); head.closePath();
  g.fillStyle = C(OX.white); g.fill(head);
  const closed = r.blink > 0 || p.st === 'rest';
  if (real) {
    g.save(); g.clip(head); g.lineCap = 'round';
    g.fillStyle = OX.col; g.beginPath(); g.ellipse(-2, 1.2, 1.8, 3.4, 0.2, 0, TAU); g.fill(); // 뺨 뒤쪽은 몸 색
    g.strokeStyle = OX.bk; g.lineWidth = 1.7; g.beginPath(); g.moveTo(-1.6, -2.6); g.quadraticCurveTo(2.6, -3.3, 7.6, -1.2); g.stroke(); // 콧등 검은 띠
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(-0.4, -2.8); g.quadraticCurveTo(1.6, -0.6, 2.2, 3.4); g.stroke(); // 눈 지나는 검은 줄
    g.fillStyle = OX.bk; g.beginPath(); g.ellipse(8.2, -0.2, 0.9, 0.85, 0, 0, TAU); g.fill(); // 검은 코
    g.fillStyle = 'rgba(60,45,30,0.13)'; g.beginPath(); g.ellipse(3.5, 3, 4.5, 1, 0, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = '#6b5f55'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(8.3, 1.4); g.quadraticCurveTo(7.6, 1.8, 6.6, 1.6); g.stroke(); // 입
    if (!closed) ell(g, 1.6, -0.75, 1.2, 1.05, 0, OX.white); // 흰 눈테
  }
  eye(g, 1.6, -0.75, 0.8, closed);
  horn(-0.5, -2.3, OX.horn, 1.35, 0);
  ear(-1, -1.1, -1.3 + r.ear.x * 0.8, OX.col, true);
  g.restore();
  g.restore();
}
