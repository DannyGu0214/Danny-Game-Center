// 녹화 모드 화면 저장·드로우콜 내보내기(원격 환경·노트북 둘 다).
// 사용: node tools/capture.mjs [--out 폴더] [--views default,top,side,under,near,bungalow]
//        [--water box,transmission] [--size 1280x800] [--frames 40] [--dt 0.0333] [--jpeg 0.82] [--extra "n=44&jelly=1"]
// 결과: <out>/<water>-<view>.(png|jpg), <out>/stats.json  (--out을 안 주면 OS 임시 폴더의 ow3d-capture)
// Playwright가 필요하다(이 원격 환경에는 미리 설치되어 있다). 소프트웨어 WebGL이라 한 장에 수십 초 걸릴 수 있다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1']);
  return a;
}, []));
const out = path.resolve(args.out || path.join(os.tmpdir(), 'ow3d-capture'));   // 기본값은 저장소 밖(실수로 커밋되지 않게)
const views = (args.views || 'default,top,side,near').split(',');
const waters = (args.water || 'box,transmission').split(',');
const size = args.size || '1280x800';
const frames = +(args.frames || 40);
const dt = +(args.dt || 1 / 30);
const jpeg = args.jpeg ? +args.jpeg : 0;
const extra = args.extra ? '&' + args.extra : '';
const strip = +(args.strip || 1);   // 한 시점에서 frames 간격으로 여러 장(움직임 확인용)
const poke = !!args.poke;           // 첫 장 전에 젤리 블록을 한 번 출렁임
fs.mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const stats = {};
try {
  for (const water of waters) {
    const page = await browser.newPage({ viewport: { width: +size.split('x')[0], height: +size.split('x')[1] } });
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const url = `http://127.0.0.1:${port}/index.html?capture&size=${size}&water=${water}${extra}`;
    await page.goto(url);
    await page.waitForFunction(() => window.__cap && window.__cap.ready, null, { timeout: 180000 });
    const info = await page.evaluate(() => window.__cap.info());
    stats[water] = { url, info, views: {}, logs };
    for (const v of views) {
      const t0 = Date.now();
      await page.evaluate(([v]) => window.__cap.setView(v), [v]);
      if (poke) await page.evaluate(() => window.__cap.poke());
      for (let k = 0; k < strip; k++) {
        await page.evaluate(([n, dt]) => window.__cap.step(dt, n), [frames, dt]);
        const dump = await page.evaluate(() => window.__cap.dump());
        const data = await page.evaluate(([j]) => window.__cap.snapshot(j ? 'image/jpeg' : 'image/png', j || 0.9), [jpeg]);
        const file = path.join(out, `${water}-${v}${strip > 1 ? '-' + k : ''}.${jpeg ? 'jpg' : 'png'}`);
        fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
        stats[water].views[v + (strip > 1 ? '-' + k : '')] = { ...dump, t: await page.evaluate(() => window.__cap.time()), ms: Date.now() - t0, file: path.basename(file) };
        console.log(water, v, k, `calls=${dump.calls} tris=${dump.triangles}`, JSON.stringify(dump.glPasses), `${Date.now() - t0}ms`);
      }
    }
    await page.close();
  }
} finally {
  fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(stats, null, 2));
  await browser.close();
  server.close();
}
