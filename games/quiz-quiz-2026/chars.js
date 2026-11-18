// 출연진 도트(2026-11-14 대니님 피드백 "캐릭터를 더 정교하게"): 2~2.5등신 치비를 화면 1배 픽셀로 그린다.
// 부위마다 [밝음·기본·그늘·선] 4단 색 램프로 명암을 넣고(빛은 왼쪽 위), 외곽선은 아래·오른쪽만 진하게,
// 위·왼쪽은 그 부위의 그늘색으로 그린다(부분 외곽선). 표정은 눈 6종·입 6종, 동작은 대기·정답·오답마다 2~4프레임.
// 그리는 순서: 인물 하나를 작은 스프라이트 버퍼(투명 바탕)에 그리고 → 외곽선 → 무대에 k배로 찍는다.

const C = (hex) => (0xff000000 | (parseInt(hex.slice(5, 7), 16) << 16) | (parseInt(hex.slice(3, 5), 16) << 8) | parseInt(hex.slice(1, 3), 16)) >>> 0;
const INK = C('#0C0C1A');

// 색 램프: [밝음, 기본, 그늘, 선]
const R = {};
const ramp = (name, hi, base, sh, line) => { R[name] = { id: Object.keys(R).length + 1, c: [C(hi), C(base), C(sh), C(line)] }; };
ramp('skin', '#FFE2C2', '#F6C99C', '#D8946A', '#8A4A30');
ramp('hair', '#5C5C86', '#2A2232', '#17121D', '#0C0C1A');
ramp('green', '#7CE89A', '#2FBF5A', '#1A7A3A', '#0E3E20');
ramp('white', '#FFFFFF', '#EEEEF6', '#A4A4BC', '#565670');
ramp('red', '#FF7A6A', '#E8302F', '#9A1C24', '#4A0C12');
ramp('denim', '#C4E8FF', '#8FD0FF', '#4C8FC8', '#1F4A78');
ramp('navy', '#5068B0', '#33468A', '#1E2A5A', '#0C0C1A');
ramp('pink', '#FFC4D6', '#FF8FB0', '#D0507A', '#7A2040');
ramp('brown', '#A0703E', '#6B4426', '#4A2C18', '#24140A');
ramp('yellow', '#FFF2A0', '#FFD23A', '#C8920E', '#6A4A06');
ramp('teal', '#5EA8B8', '#2A6A7A', '#1A4652', '#0C2228');
ramp('olive', '#A09A44', '#6E6A2C', '#4A4618', '#24220A');
ramp('grey', '#C8C8D8', '#8E8EA6', '#565670', '#2A2A3A');
ramp('mint', '#B8FFD8', '#5EE0A0', '#2A9A68', '#0E4A30');
const ramps = [null, ...Object.values(R)];

// ---------- 스프라이트 버퍼(투명 바탕 + 칸마다 어느 램프인지) ----------
const SW = 84, SH = 124, OX = 42, OY = 118; // 발끝 기준점
class Spr {
  constructor() { this.c = new Uint32Array(SW * SH); this.r = new Uint8Array(SW * SH); }
  clear() { this.c.fill(0); this.r.fill(0); }
  in(x, y) { return x >= 0 && y >= 0 && x < SW && y < SH; }
  set(x, y, col, rid = 0) { x = Math.round(x) + OX; y = Math.round(y) + OY; if (this.in(x, y)) { const i = y * SW + x; this.c[i] = col; this.r[i] = rid; } }
  filled(x, y) { return this.in(x, y) && this.c[y * SW + x] !== 0; }
}
const spr = new Spr();

// 부위 하나: mask(x, y) → 안쪽이면 true. bbox 안에서 칠하고 왼쪽 위는 밝게, 오른쪽·아래 2칸은 그늘
function part(b, x0, y0, x1, y1, mask, rp, { rim = true, shade = 2, flat = false } = {}) {
  const [hi, base, sh] = rp.c;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!mask(x, y)) continue;
    let col = base;
    if (!flat) {
      if (shade && (!mask(x + 1, y) || (shade > 1 && !mask(x + 2, y)) || !mask(x, y + 1))) col = sh;
      else if (rim && (!mask(x - 1, y) || !mask(x, y - 1))) col = hi;
    }
    b.set(x, y, col, rp.id);
  }
}
const rect = (b, x, y, w, h, rp, o) => part(b, x, y, x + w - 1, y + h - 1, (px, py) => px >= x && px < x + w && py >= y && py < y + h, rp, o);
const ell = (b, cx, cy, rx, ry, rp, o) => part(b, cx - rx, cy - ry, cx + rx, cy + ry, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, rp, o);
// 둥근 모서리 사각형
const rrect = (b, x, y, w, h, r, rp, o) => part(b, x, y, x + w - 1, y + h - 1, (px, py) => {
  if (px < x || px >= x + w || py < y || py >= y + h) return false;
  const dx = Math.max(x + r - px, 0, px - (x + w - 1 - r)), dy = Math.max(y + r - py, 0, py - (y + h - 1 - r));
  return dx * dx + dy * dy <= r * r + 0.5;
}, rp, o);
// 굵은 선(팔·다리): 두 점 사이 거리가 반지름 안
function limb(b, ax, ay, bx, by, rad, rp, o) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  part(b, Math.min(ax, bx) - rad, Math.min(ay, by) - rad, Math.max(ax, bx) + rad, Math.max(ay, by) + rad, (px, py) => {
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)), qx = ax + t * dx - px, qy = ay + t * dy - py;
    return qx * qx + qy * qy <= rad * rad;
  }, rp, o);
}
const dot = (b, x, y, col, rid = 0) => b.set(x, y, col, rid);
const line = (b, x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) b.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col); };

// 외곽선: 빈 칸 옆에 칠한 칸이 있으면, 그 칸이 위·왼쪽(빛 쪽)이면 그 램프의 선색, 아래·오른쪽이면 먹색
function outline(b) {
  const out = [];
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (b.c[y * SW + x]) continue;
    const below = b.filled(x, y + 1), right = b.filled(x + 1, y), above = b.filled(x, y - 1), left = b.filled(x - 1, y);
    if (!(below || right || above || left)) continue;
    // 빛 쪽(이 빈 칸이 도형의 위·왼쪽에 있다)이면 색 외곽선
    const lit = (below || right) && !above && !left;
    const src = below ? (y + 1) * SW + x : right ? y * SW + x + 1 : above ? (y - 1) * SW + x : y * SW + x - 1;
    const rp = ramps[b.r[src]];
    out.push([y * SW + x, lit && rp ? rp.c[3] : INK]);
  }
  for (const [i, col] of out) b.c[i] = col;
}

// 무대(Px)에 스프라이트를 k배로 찍는다. (x, feet) = 발끝 자리
export function blit(px, x, feet, k = 1, flip = false) {
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
    const col = spr.c[j * SW + (flip ? SW - 1 - i : i)];
    if (!col) continue;
    const dx = Math.round(x + (i - OX) * k), dy = Math.round(feet + (j - OY) * k);
    if (k === 1) px.set(dx, dy, col); else px.rect(dx, dy, k, k, col);
  }
}

// ---------- 인물 한 명 ----------
// L: 생김새, pose: { arms:[왼,오], face, mouth, dy, lean, frame, blink, tears }
// 좌표: x = 몸 가운데(0), 발끝 y = 0. 위가 음수.
function person(b, L, pose = {}) {
  const f = pose.frame ?? 0, dy = pose.dy ?? 0, lean = pose.lean ?? 0;
  const legH = L.legs, bodyH = L.body, bw = L.bodyW ?? 20;
  const breath = pose.breath ? (f % 2) : 0; // 대기 숨쉬기: 윗몸이 1칸 오르내린다
  const F = dy, legTop = F - legH, bt = legTop - bodyH + breath, X = lean;
  const bx = X - bw / 2;
  // --- 다리와 신발
  const B = L.bottom, legR = B.kind === 'pants' || B.kind === 'monpe' ? R[B.ramp] : R.skin;
  const lx = [-5, 5], kick = pose.kick ?? 0; // 정답 점프 때 다리를 벌린다
  for (const s of [0, 1]) {
    const x0 = X + lx[s] + (s ? kick : -kick);
    limb(b, X + lx[s] * 0.8, legTop, x0, F - 4, 3, legR);
    if (B.kind !== 'pants' && B.kind !== 'monpe') rect(b, x0 - 3, F - 7, 7, 3, R.white, { shade: 1 }); // 양말
    if (B.stripe) line(b, x0 + (s ? 2 : -2), legTop + 1, x0 + (s ? 2 : -2), F - 5, R.white.c[0]);
  }
  for (const s of [0, 1]) { // 신발: 밑창 + 반짝임
    const x0 = X + lx[s] + (s ? kick : -kick), shoe = R[L.shoe ?? 'navy'];
    rrect(b, x0 - 5 + (s ? 1 : -1), F - 5, 10, 5, 2, shoe);
    rect(b, x0 - 5 + (s ? 1 : -1), F - 1, 10, 1, R.white, { flat: true });
    dot(b, x0 - 2 + (s ? 1 : -1), F - 4, shoe.c[0], shoe.id);
  }
  if (L.skates) for (const s of [0, 1]) { const x0 = X + lx[s] + (s ? kick : -kick); for (const w of [-3, 2]) { ell(b, x0 + w, F + 2, 1.6, 1.6, R.red); } }
  // 반바지·치마
  if (B.kind === 'shorts') { rrect(b, X - bw / 2 + 1, legTop - 1, bw - 2, Math.round(legH * 0.45), 2, R[B.ramp]); line(b, X, legTop + 1, X, legTop + Math.round(legH * 0.45) - 2, R[B.ramp].c[2]); }
  if (B.kind === 'skirt') {
    const h = Math.round(legH * 0.62);
    part(b, X - bw / 2 - 5, legTop - 1, X + bw / 2 + 5, legTop + h, (px, py) => { const t = (py - legTop + 1) / h; return py >= legTop - 1 && py <= legTop + h && Math.abs(px - X) <= bw / 2 - 1 + t * 6; }, R[B.ramp]);
    for (const k of [-6, -2, 2, 6]) line(b, X + k, legTop + 2, X + k * 1.3, legTop + h - 1, R[B.ramp].c[2]); // 주름
  }
  if (B.kind === 'pants' || B.kind === 'monpe') rrect(b, X - bw / 2 + 1, legTop - 1, bw - 2, 4, 1, legR);
  // --- 몸통
  const T = L.top, TR = R[T.ramp];
  if (T.square) { rrect(b, bx - 3, bt, bw + 6, bodyH, 3, TR); } else rrect(b, bx, bt, bw, bodyH, 4, TR);
  switch (T.kind) {
    case 'track': // 체육복: 흰 깃, 지퍼, 옆줄
      rect(b, X - 4, bt, 8, 3, R.white, { shade: 1 }); line(b, X, bt + 3, X, bt + bodyH - 2, R.white.c[2]);
      line(b, bx + 1, bt + 3, bx + 1, bt + bodyH - 2, R.white.c[1]); line(b, bx + bw - 2, bt + 3, bx + bw - 2, bt + bodyH - 2, R.white.c[1]);
      rect(b, bx, bt + bodyH - 3, bw, 2, TR, { rim: false }); break;
    case 'stripe': for (let j = 2; j < bodyH - 1; j += 3) line(b, bx + 1, bt + j, bx + bw - 2, bt + j, (j / 3) % 2 < 1 ? R.red.c[1] : R.denim.c[2]); break;
    case 'blazer': // 교복: 흰 셔츠 깃, 넥타이, 명찰, 단추
      part(b, X - 5, bt, X + 5, bt + 8, (px, py) => py >= bt && Math.abs(px - X) <= 5 - (py - bt) * 0.6, R.white, { shade: 1 });
      limb(b, X, bt + 3, X, bt + 9, 1.2, R.red, { shade: 0 });
      rect(b, bx + 3, bt + 6, 5, 2, R.yellow, { flat: true }); dot(b, X + 3, bt + 11, R.yellow.c[1]); dot(b, X + 3, bt + 14, R.yellow.c[1]);
      line(b, X + 1, bt + 9, X + 1, bt + bodyH - 1, TR.c[2]); break;
    case 'sweater': // 분홍 스웨터: 흰 동그란 깃, 고무단
      ell(b, X - 3, bt + 1, 4, 2.2, R.white, { shade: 1 }); ell(b, X + 3, bt + 1, 4, 2.2, R.white, { shade: 1 });
      for (let i = bx + 1; i < bx + bw - 1; i += 2) dot(b, i, bt + bodyH - 2, TR.c[2]); break;
    case 'suit': // 각진 양복: 흰 셔츠, 깃, 행커치프
      part(b, X - 5, bt, X + 5, bt + 10, (px, py) => py >= bt && Math.abs(px - X) <= 5 - (py - bt) * 0.5, R.white, { shade: 1 });
      line(b, X - 5, bt, X - 1, bt + 10, TR.c[2]); line(b, X + 5, bt, X + 1, bt + 10, TR.c[2]);
      rect(b, bx + bw - 5, bt + 5, 3, 2, R.red, { flat: true }); dot(b, X, bt + 13, TR.c[0]); dot(b, X, bt + 16, TR.c[0]); break;
    case 'sequin': // 반짝이 조끼(프레임마다 반짝임이 움직인다)
      rect(b, X - 2, bt, 4, bodyH, R.white, { shade: 1 });
      for (let j = 1; j < bodyH - 1; j += 2) for (let i = 1; i < bw - 1; i += 2) if (Math.abs(bx + i - X) > 2 && ((i + j + f) % 5 === 0)) dot(b, bx + i, bt + j, R.white.c[0]); break;
    default:
  }
  if (L.bow && !pose.noBow) { // 왕대박의 커다란 나비넥타이(돌아간다)
    const s = pose.bowSpin ?? 0, w = [7, 5, 3, 5][s % 4];
    part(b, X - 2 - w, bt - 1, X - 1, bt + 6, (px, py) => Math.abs(py - (bt + 2.5)) <= 1 + (X - 1 - px) * 0.5 && px >= X - 1 - w, R.red);
    part(b, X + 1, bt - 1, X + 2 + w, bt + 6, (px, py) => Math.abs(py - (bt + 2.5)) <= 1 + (px - X - 1) * 0.5 && px <= X + 1 + w, R.red);
    ell(b, X, bt + 2.5, 2, 2, R.red, { shade: 1 });
  }
  // --- 팔(어깨 → 손), 소매는 옷 램프, 손은 살 램프
  const sl = R[L.sleeve ?? T.ramp], shY = bt + 3, shX = (s) => X + s * (bw / 2 + (T.square ? 3 : 1));
  const hand = (hx, hy) => ell(b, hx, hy, 3, 3, R.skin);
  const arm = (s, mode) => {
    const ax = shX(s); let ex, ey, hx, hy;
    switch (mode) {
      case 'up': ex = ax + s * 2; ey = shY - 9; hx = ax + s * 2; hy = shY - 17; break;
      case 'cheer': ex = ax + s * 6; ey = shY - 6; hx = ax + s * 8; hy = shY - 14; break;
      case 'out': ex = ax + s * 8; ey = shY + 1; hx = ax + s * 15; hy = shY; break;
      case 'hip': ex = ax + s * 5; ey = shY + 6; hx = ax + s * 1; hy = shY + 11; break;
      case 'pat': ex = ax + s * 7; ey = shY + 3; hx = ax + s * 13; hy = shY + 1 + (f % 2) * 2; break;
      case 'chin': ex = ax + s * 3; ey = shY + 8; hx = ax - s * 4; hy = shY - 3; break;
      case 'card': ex = ax + s * 5; ey = shY + 2; hx = ax + s * 6; hy = shY - 6; break;
      case 'mic': ex = ax + s * 2; ey = shY + 8; hx = ax - s * 3; hy = shY + 4; break;
      case 'face': ex = ax + s * 2; ey = shY + 6; hx = ax - s * 5; hy = shY - 8; break; // 얼굴 가리기(울먹)
      default: ex = ax + s * 1; ey = shY + 7; hx = ax + s * 1; hy = shY + bodyH - 4;
    }
    limb(b, ax, shY, ex, ey, 2.6, sl); limb(b, ex, ey, hx, hy, 2.4, sl);
    if (L.sleeveStripe) line(b, ax, shY, ex, ey, R.white.c[0]);
    hand(hx, hy);
    if (mode === 'card') { rrect(b, hx - 1 - (s < 0 ? 9 : 0), hy - 12, 11, 9, 1, R.yellow, { shade: 1 }); line(b, hx + 1 - (s < 0 ? 9 : 0), hy - 9, hx + 7 - (s < 0 ? 9 : 0), hy - 9, R.red.c[1]); line(b, hx + 1 - (s < 0 ? 9 : 0), hy - 6, hx + 5 - (s < 0 ? 9 : 0), hy - 6, R.yellow.c[2]); }
    if (mode === 'mic') { limb(b, hx, hy, hx + s * -1, hy - 9, 1.2, R.grey); ell(b, hx - s, hy - 11, 2.5, 3, R.grey); }
  };
  const [aL, aR] = pose.arms ?? ['down', 'down'];
  // 앞으로 오는 팔은 머리 뒤에 그려도 되므로 먼저 몸 쪽 팔
  arm(-1, aL); arm(1, aR);
  // --- 머리
  const hw = 13, hh = 12, hcx = X, hcy = bt - hh + 2 + breath * 0; // 머리 반지름(가로 13, 세로 12)
  const HR = R.hair;
  // 뒷머리
  // 단발 뒷머리: 양옆으로만 턱선까지(턱 아래로는 내려오지 않는다)
  if (L.hair === 'bob') {
    const len = L.bobLen ?? 6; // 옆머리 길이(턱선 아래로 몇 칸)
    part(b, hcx - hw - 3, hcy - hh, hcx + hw + 3, hcy + len, (px, py) => Math.abs(px - hcx) <= hw + 3 - Math.max(0, py - hcy - len + 4) && ((px - hcx) / (hw + 3)) ** 2 + ((Math.min(py, hcy) - hcy) / (hh + 2)) ** 2 <= 1 && py <= hcy + len && (py < hcy - 2 || Math.abs(px - hcx) > hw - 4), HR, { shade: 1 });
  }
  if (L.hair === 'perm') for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; ell(b, hcx + Math.cos(a) * 12, hcy + Math.sin(a) * 10, 3.5, 3.5, HR, { shade: 1 }); }
  // 얼굴
  ell(b, hcx, hcy, hw, hh, R.skin);
  ell(b, hcx - hw, hcy + 1, 2, 3, R.skin, { shade: 1 }); ell(b, hcx + hw, hcy + 1, 2, 3, R.skin, { shade: 1 }); // 귀
  // 앞머리
  const top = hcy - hh;
  switch (L.hair) {
    case 'spiky': {
      part(b, hcx - hw - 2, top - 7, hcx + hw + 2, hcy - 2, (px, py) => {
        const inHead = ((px - hcx) / (hw + 1.5)) ** 2 + ((py - hcy + 1) / (hh + 1.5)) ** 2 <= 1;
        const ph = ((px - hcx + 36) % 7), spike = py <= top + 3 && py >= top - 7 + Math.abs(ph - 3) * 2.2 && Math.abs(px - hcx) < hw;
        const fringe = py < hcy - 4 - (((px - hcx + 21) % 7) < 3 ? 0 : 2);
        return (inHead && fringe) || spike;
      }, HR, { shade: 1 });
      line(b, hcx - 6, top, hcx + 2, top - 2, HR.c[0]);
      part(b, hcx - hw - 1, hcy - 4, hcx - hw + 3, hcy + 2, (px, py) => px <= hcx - hw + 2 - (py - hcy + 4) * 0.3, HR); break;
    }
    case 'short': case 'cowlick': {
      part(b, hcx - hw - 1, top - 2, hcx + hw + 1, hcy - 1, (px, py) => { const inHead = ((px - hcx) / (hw + 1)) ** 2 + ((py - hcy + 1) / (hh + 1.5)) ** 2 <= 1; const fringe = py < hcy - 4 - (((px - hcx + 20) % 5) < 2 ? 0 : 1); return inHead && (fringe || Math.abs(px - hcx) > hw - 2); }, HR, { shade: 1 });
      line(b, hcx - 7, top + 1, hcx - 1, top, HR.c[0]);
      if (L.hair === 'cowlick') { line(b, hcx + 2, top - 1, hcx + 4, top - 5, HR.c[1]); line(b, hcx + 4, top - 5, hcx + 6, top - 4, HR.c[1]); }
      break;
    }
    case 'parted': { // 2:8 가르마, 윤기
      part(b, hcx - hw - 1, top - 3, hcx + hw + 1, hcy - 2, (px, py) => { const inHead = ((px - hcx) / (hw + 1)) ** 2 + ((py - hcy + 2) / (hh + 2)) ** 2 <= 1; return inHead && (py < hcy - 5 + (px > hcx - 6 ? 0 : 2) || Math.abs(px - hcx) > hw - 2); }, HR, { shade: 1 });
      line(b, hcx - 6, top - 2, hcx - 6, top + 4, R.skin.c[1]);
      line(b, hcx - 2, top - 1, hcx + 7, top + 1, HR.c[0]); break;
    }
    case 'bob': { // 단발: 일자 앞머리
      part(b, hcx - hw - 2, top - 2, hcx + hw + 2, hcy - 3, (px, py) => ((px - hcx) / (hw + 2)) ** 2 + ((py - hcy + 1) / (hh + 2)) ** 2 <= 1 && py < hcy - 4, HR, { shade: 1 });
      line(b, hcx - 7, top + 2, hcx + 3, top + 1, HR.c[0]); break;
    }
    case 'bowl': { // 바가지 머리
      part(b, hcx - hw - 2, top - 2, hcx + hw + 2, hcy - 1, (px, py) => ((px - hcx) / (hw + 2)) ** 2 + ((py - hcy + 1) / (hh + 2)) ** 2 <= 1 && py < hcy - 3, HR, { shade: 1 });
      line(b, hcx - 8, top + 1, hcx + 2, top, HR.c[0]); break;
    }
    case 'perm': for (let k = 0; k < 9; k++) ell(b, hcx - hw + 2 + k * 3, top + 1 + (k % 2), 3, 3, HR, { shade: 1 }); break;
    default:
  }
  if (L.ribbon) { const rx = hcx + 8, ry = top; ell(b, rx - 3, ry, 3, 2.5, R[L.ribbon]); ell(b, rx + 3, ry, 3, 2.5, R[L.ribbon]); ell(b, rx, ry, 1.5, 1.5, R[L.ribbon], { shade: 1 }); }
  if (L.glasses) { for (const s of [-1, 1]) { const ex = hcx + s * 5; line(b, ex - 3, hcy - 1, ex + 3, hcy - 1, INK); line(b, ex - 3, hcy + 3, ex + 3, hcy + 3, INK); line(b, ex - 3, hcy - 1, ex - 3, hcy + 3, INK); line(b, ex + 3, hcy - 1, ex + 3, hcy + 3, INK); } }
  face(b, hcx, hcy, L, pose, f);
}

// 표정: 눈 6종(idle·happy·sad·shock·smug·closed) × 입 6종(smile·grin·o·sad·smug·talk)
function face(b, cx, cy, L, pose, f) {
  const fc = pose.face ?? 'idle', blink = pose.blink && fc === 'idle';
  const ey = cy + 1, eyes = [cx - 5, cx + 5];
  const brow = (ex, s, tilt) => line(b, ex - 2, ey - 5 + (s < 0 ? tilt : -tilt), ex + 2, ey - 5 + (s < 0 ? -tilt : tilt), R.hair.c[1]);
  eyes.forEach((ex, k) => {
    const s = k ? 1 : -1;
    switch (blink ? 'closed' : fc) {
      case 'happy': line(b, ex - 2, ey + 1, ex, ey - 1, INK); line(b, ex, ey - 1, ex + 2, ey + 1, INK); brow(ex, s, 0); break;
      case 'closed': line(b, ex - 2, ey, ex + 2, ey, INK); break;
      case 'smug': line(b, ex - 2, ey, ex + 2, ey, INK); dot(b, ex - 1, ey + 1, INK); dot(b, ex, ey + 1, INK); dot(b, ex + 1, ey + 1, INK); brow(ex, s, -1); break;
      case 'shock':
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 5) dot(b, ex + i, ey + j, R.white.c[0]);
        dot(b, ex, ey, INK); brow(ex, s, 0); line(b, ex - 2, ey - 6, ex + 2, ey - 6, R.hair.c[1]); break;
      case 'sad':
        for (let j = 0; j <= 2; j++) for (let i = -1; i <= 1; i++) dot(b, ex + i, ey + j, INK);
        dot(b, ex - 1, ey, R.white.c[0]); brow(ex, s, -2);
        if (pose.tears) { const ty = ey + 3 + (f % 3); dot(b, ex + s, ty, R.denim.c[0]); dot(b, ex + s, ty + 1, R.denim.c[1]); } break;
      default: // idle: 큰 눈 + 반짝이
        for (let j = -2; j <= 2; j++) for (let i = -1; i <= 1; i++) dot(b, ex + i, ey + j, INK);
        dot(b, ex - 1, ey - 1, R.white.c[0]); dot(b, ex, ey - 2, R.white.c[0]);
        if (L.lashes) { dot(b, ex + s * 2, ey - 2, INK); }
    }
  });
  // 볼
  for (const s of [-1, 1]) { dot(b, cx + s * 8, ey + 3, R.pink.c[1]); dot(b, cx + s * 9, ey + 3, R.pink.c[1]); }
  // 입
  const my = cy + 7, m = pose.mouth ?? (fc === 'happy' ? 'grin' : fc === 'shock' ? 'o' : fc === 'sad' ? 'sad' : fc === 'smug' ? 'smug' : 'smile');
  switch (pose.talk && f % 2 ? 'grin' : m) {
    case 'grin': // 활짝: 흰 이 + 빨간 입 안 + 혀
      for (let j = 0; j < 4; j++) for (let i = -3 + (j > 2 ? 1 : 0); i <= 3 - (j > 2 ? 1 : 0); i++) dot(b, cx + i, my - 1 + j, j === 0 ? R.white.c[0] : j === 3 ? R.pink.c[1] : R.red.c[2]);
      break;
    case 'o': for (let j = 0; j < 4; j++) for (let i = -1; i <= 1; i++) dot(b, cx + i, my - 1 + j, (i === 0 && j > 0 && j < 3) ? R.red.c[2] : INK); break;
    case 'sad': line(b, cx - 2, my + 1, cx, my, INK); line(b, cx, my, cx + 2, my + 1, INK); break;
    case 'smug': line(b, cx - 2, my, cx + 2, my - 1, INK); dot(b, cx + 3, my - 2, INK); break;
    default: line(b, cx - 2, my - 1, cx - 1, my, INK); line(b, cx - 1, my, cx + 1, my, INK); line(b, cx + 1, my, cx + 2, my - 1, INK);
  }
}

// ---------- 생김새(90년대 한국 방송국, 한국 인물) ----------
export const LOOKS = {
  tall: { legs: 26, body: 22, bodyW: 20, hair: 'spiky', top: { kind: 'track', ramp: 'green' }, sleeveStripe: true, bottom: { kind: 'pants', ramp: 'green', stripe: true }, shoe: 'white' },
  short: { legs: 11, body: 15, bodyW: 20, hair: 'cowlick', top: { kind: 'stripe', ramp: 'white' }, bottom: { kind: 'shorts', ramp: 'denim' }, shoe: 'red' },
  oppa: { legs: 18, body: 19, bodyW: 20, hair: 'short', top: { kind: 'blazer', ramp: 'navy' }, bottom: { kind: 'shorts', ramp: 'brown' }, shoe: 'navy' },
  sister: { legs: 14, body: 16, bodyW: 19, hair: 'bob', bobLen: 8, ribbon: 'red', lashes: true, top: { kind: 'sweater', ramp: 'pink' }, bottom: { kind: 'skirt', ramp: 'denim' }, shoe: 'red' },
  wang: { legs: 20, body: 23, bodyW: 22, hair: 'parted', top: { kind: 'suit', ramp: 'teal', square: true }, bottom: { kind: 'pants', ramp: 'teal' }, bow: true, shoe: 'brown' },
  na: { legs: 20, body: 21, bodyW: 20, hair: 'bob', bobLen: 11, lashes: true, top: { kind: 'suit', ramp: 'navy', square: true }, bottom: { kind: 'pants', ramp: 'navy' }, shoe: 'navy' },
  banjjak: { legs: 17, body: 17, bodyW: 20, hair: 'bowl', top: { kind: 'sequin', ramp: 'mint' }, sleeve: 'pink', bottom: { kind: 'pants', ramp: 'olive' }, skates: true, shoe: 'denim' },
};

export const DUOS = {
  'tall-short': { name: '키다리와 꼬마', rel: '단짝 친구', a: LOOKS.tall, b: LOOKS.short },
  'siblings': { name: '오빠와 여동생', rel: '남매', a: LOOKS.oppa, b: LOOKS.sister },
};
export const DUO_IDS = Object.keys(DUOS);

// 인물 하나를 스프라이트로 그려 무대에 찍는다
export function drawPerson(px, x, feet, L, pose = {}, k = 1, flip = false) {
  spr.clear();
  person(spr, L, pose);
  outline(spr);
  blit(px, x, feet, k, flip);
}

// 듀오 한 쌍(대기·정답·오답 동작 2~4프레임). dir = 무대 안쪽 방향(1 오른쪽, -1 왼쪽)
export function drawDuo(px, id, cx, feet, react, t, { k = 1, dir = 1, think = false } = {}) {
  const d = DUOS[id];
  if (!d) return;
  const f4 = Math.floor(t * 6) % 4, f2 = Math.floor(t * 4) % 2, blink = (t % 3.2) < 0.12;
  const breathe = Math.floor(t * 1.6) % 2;
  const flip = dir < 0;
  const ax = cx - dir * 14 * k, bx = cx + dir * 14 * k; // a는 바깥쪽, b는 안쪽
  const P = (who, x, y, pose) => drawPerson(px, x, y, who, { frame: f4, blink, ...pose }, k, flip);
  const jump = [0, -3, -6, -3][f4] * k;
  if (id === 'tall-short') {
    if (react === 'win') { // 키다리가 꼬마를 번쩍 들어 올린다
      P(d.a, ax, feet, { arms: ['up', 'up'], face: 'happy', dy: 0 });
      P(d.b, ax + dir * 2 * k, feet - (64 + [0, 2, 4, 2][f4]) * k, { arms: ['cheer', 'cheer'], face: 'happy', kick: f2 ? 3 : 0 });
    } else if (react === 'lose') { // 꼬마가 키다리 다리 뒤로 숨는다
      P(d.b, ax + dir * 9 * k + (f2 ? k : 0), feet, { arms: ['face', 'face'], face: 'sad', tears: true });
      P(d.a, ax - (f2 ? k : 0), feet, { arms: ['down', 'chin'], face: 'shock' });
    } else {
      P(d.a, ax, feet, { arms: think ? ['down', 'chin'] : ['hip', 'down'], face: think ? 'smug' : 'idle', breath: true, frame: breathe });
      P(d.b, bx, feet, { arms: think ? ['chin', 'down'] : ['down', 'hip'], face: think ? 'closed' : 'happy', breath: true, frame: 1 - breathe });
    }
  } else {
    if (react === 'win') { // 오빠는 펄쩍, 여동생은 오빠 등을 팡팡
      P(d.a, ax, feet + jump, { arms: ['cheer', 'cheer'], face: 'happy', kick: f2 ? 2 : 0 });
      P(d.b, bx - dir * 6 * k, feet, { arms: ['pat', 'up'], face: 'happy', frame: f2 });
    } else if (react === 'lose') { // 둘이 동시에 서로를 가리키며 "너 때문이야!"
      P(d.a, ax + (f2 ? k : -k), feet, { arms: ['down', 'out'], face: 'shock', mouth: 'o' });
      P(d.b, bx - (f2 ? k : -k), feet, { arms: ['out', 'down'], face: 'shock', mouth: 'o' });
    } else {
      P(d.a, ax, feet, { arms: think ? ['chin', 'down'] : ['hip', 'hip'], face: think ? 'smug' : 'idle', breath: true, frame: breathe });
      P(d.b, bx, feet, { arms: think ? ['down', 'chin'] : ['hip', 'down'], face: 'happy', breath: true, frame: 1 - breathe });
    }
  }
}
