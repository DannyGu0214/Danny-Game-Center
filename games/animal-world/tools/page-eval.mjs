// 헤드리스 Chrome으로 페이지를 열고, 식(expr)이 참이 될 때까지 기다렸다가 그 값을 출력한다(소리 점검처럼 비동기 결과가 필요한 점검용).
// 사용: node tools/page-eval.mjs <url> [식=document.title === 'ready' && document.body.innerText] [최대초=60] [포트=9333]
// 예: node tools/page-eval.mjs "http://localhost:8793/tools/sound-check.html?region=seaside"
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, expr = "document.title === 'ready' && document.body.innerText", maxSec = '60', port = '9333'] = process.argv.slice(2);
if (!url) { console.error('url이 필요해요'); process.exit(2); }
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dir = mkdtempSync(join(tmpdir(), 'page-eval-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => { chrome.kill(); setTimeout(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* 무시 */ } process.exit(code); }, 300); };
try {
  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json(); } catch { /* 아직 안 뜸 */ }
  }
  if (!target) throw new Error('Chrome에 연결하지 못했어요');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
  const send = (method, params) => new Promise((r) => { const n = ++id; wait.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const t0 = Date.now();
  while (Date.now() - t0 < Number(maxSec) * 1000) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    const v = r.result?.result?.value;
    if (v) { console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1)); ws.close(); done(0); break; }
    await sleep(500);
  }
  if (Date.now() - t0 >= Number(maxSec) * 1000) { console.error('시간 초과'); done(1); }
} catch (e) { console.error(e.message); done(1); }
