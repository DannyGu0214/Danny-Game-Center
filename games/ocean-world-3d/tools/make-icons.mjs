// 앱 아이콘 생성(W3): 하늘·바다 배경 위 젤리 블록(섬·지층 띠)과 해파리 한 마리. 외부 이미지·패키지 없이 node 내장 zlib으로 PNG를 쓴다.
// 실행: node tools/make-icons.mjs  → icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');

// ---------- PNG ----------
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 모양(단위 좌표 0..1, y는 아래로) ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function inPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** 장면: s = 블록 배율(마스커블은 안전 영역 안으로 작게) */
function scene(s) {
  const C = 0.5, cy = 0.5 - 0.04 * s;      // 블록 윗면 가운데(해파리까지 합친 그림이 가운데 오게)
  const W = 0.34 * s, D = 0.17 * s, H = 0.27 * s;  // 반폭, 윗면 반높이, 옆면 높이
  const top = [[C, cy - D], [C + W, cy], [C, cy + D], [C - W, cy]];
  const left = [[C - W, cy], [C, cy + D], [C, cy + D + H], [C - W, cy + H]];
  const right = [[C, cy + D], [C + W, cy], [C + W, cy + H], [C, cy + D + H]];
  const band = 0.34;                        // 아래쪽 지층 띠 비율
  const sky = [hex('#dff4f7'), hex('#8fd3e3')];
  const layers = [];
  // 배경
  layers.push((x, y) => [mix(sky[0], sky[1], y), 1]);
  // 옆면: 물(위) + 모래 지층(아래)
  const side = (poly, water, sand, dark) => (x, y) => {
    if (!inPoly(x, y, poly)) return null;
    // 옆면 안에서 세로 위치(0 위 → 1 아래)
    const yTop = poly === left ? cy + ((x - (C - W)) / W) * D : cy + D - ((x - C) / W) * D;
    const t = (y - yTop) / H;
    if (t > 1 - band) {
      const k = Math.floor(((t - (1 - band)) / band) * 3);
      return [mix(sand, dark, k * 0.22), 1];
    }
    return [mix(water, dark, t * 0.35), 0.96];
  };
  layers.push(side(left, hex('#55c3da'), hex('#e6cf96'), hex('#9a7a4a')));
  layers.push(side(right, hex('#2f9fc1'), hex('#d9bd82'), hex('#8a6a3c')));
  // 윗면: 수면
  layers.push((x, y) => (inPoly(x, y, top) ? [mix(hex('#9fe6ef'), hex('#5cc8dc'), (y - (cy - D)) / (2 * D)), 0.97] : null));
  // 섬(모래 고리 + 풀)
  const ix = C - W * 0.18, iy = cy - D * 0.1;
  layers.push((x, y) => (inEllipse(x, y, ix, iy, W * 0.42, D * 0.5) ? [hex('#f2dfa6'), 1] : null));
  layers.push((x, y) => (inEllipse(x, y, ix - W * 0.02, iy - D * 0.12, W * 0.3, D * 0.34) ? [hex('#7cc46a'), 1] : null));
  layers.push((x, y) => (inEllipse(x, y, ix - W * 0.05, iy - D * 0.2, W * 0.16, D * 0.16) ? [hex('#94d47c'), 1] : null));
  // 모서리 빛(젤리 유리 느낌): 윗면 앞 두 변과 세로 가운데 모서리
  const edge = (ax, ay, bx, by, wdt) => (x, y) => {
    const vx = bx - ax, vy = by - ay, u = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    const d = Math.hypot(x - (ax + vx * u), y - (ay + vy * u));
    return d < wdt ? [[255, 255, 255], 0.55 * (1 - d / wdt)] : null;
  };
  const ew = 0.012 * s;
  layers.push(edge(C - W, cy, C, cy + D, ew), edge(C, cy + D, C + W, cy, ew), edge(C, cy + D, C, cy + D + H, ew));
  layers.push(edge(C - W, cy, C, cy - D, ew * 0.7), edge(C, cy - D, C + W, cy, ew * 0.7));
  // 해파리(블록 오른쪽 위 하늘에 떠 있음, 장난스러운 젤리 느낌)
  const jx = C + W * 0.62, jy = cy - D - 0.1 * s, jr = 0.09 * s;
  for (let k = 0; k < 4; k++) {
    const tx = jx - jr * 0.6 + (k * jr * 1.2) / 3;
    layers.push((x, y) => {
      if (y < jy || y > jy + jr * 1.5) return null;
      const wob = Math.sin((y - jy) / (jr * 0.35) + k) * jr * 0.09;
      return Math.abs(x - tx - wob) < jr * 0.07 ? [hex('#e8b6dc'), 0.9] : null;
    });
  }
  layers.push((x, y) => (y <= jy + jr * 0.05 && inEllipse(x, y, jx, jy, jr, jr * 0.85) ? [mix(hex('#fbe9f6'), hex('#f2b3dd'), (y - (jy - jr)) / jr), 0.95] : null));
  layers.push((x, y) => (inEllipse(x, y, jx - jr * 0.35, jy - jr * 0.45, jr * 0.22, jr * 0.14) ? [[255, 255, 255], 0.8] : null));
  // 눈 두 개
  layers.push((x, y) => (inEllipse(x, y, jx - jr * 0.3, jy - jr * 0.12, jr * 0.08, jr * 0.11) || inEllipse(x, y, jx + jr * 0.3, jy - jr * 0.12, jr * 0.08, jr * 0.11) ? [hex('#3a2c48'), 1] : null));
  return layers;
}

function render(size, s) {
  const layers = scene(s), buf = Buffer.alloc(size * size * 4), SS = 4;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = (px + (sx + 0.5) / SS) / size, y = (py + (sy + 0.5) / SS) / size;
      let c = [0, 0, 0];
      for (const L of layers) { const v = L(x, y); if (v) c = mix(c, v[0], v[1]); }
      r += c[0]; g += c[1]; b += c[2];
    }
    const n = SS * SS, o = (py * size + px) * 4;
    buf[o] = Math.round(r / n); buf[o + 1] = Math.round(g / n); buf[o + 2] = Math.round(b / n); buf[o + 3] = 255;
  }
  return png(size, size, buf);
}

mkdirSync(OUT, { recursive: true });
const jobs = [['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, 0.78], ['apple-touch-icon.png', 180, 0.92]];
for (const [name, size, s] of jobs) { const data = render(size, s); writeFileSync(path.join(OUT, name), data); console.log(name, size + 'px', data.length + ' bytes'); }
