/* TechieMan M1 — web verification driver (headless Chromium via CDP).
 * Serves technieman-game/build/web over HTTP, loads the Godot web export,
 * and (a) checks for console errors on a plain load, (b) runs the in-game
 * self-test (?selftest=1) and reads the M1SELFTEST result, (c) screenshots
 * every photo state (?photo=...) front + side for the 3D proof.
 * Usage: node verify_m1.mjs [smoke|selftest|shots|all]
 * Output: verification/frames/*.png + PASS/FAIL lines on stdout.
 * Reuses the CDP pattern + ws module from web-game-3d/verify/verify3d.mjs.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const require = createRequire(import.meta.url);
const WebSocket = require('/home/hatch/workspace/techieman/app/node_modules/ws');

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const GAME_DIR = '/home/hatch/workspace/techieman/technieman-game/build/web';
const FRAMES = '/home/hatch/workspace/techieman/technieman-game/verification/frames';
const PORT = 9334;
const HTTP_PORT = 8932;
fs.mkdirSync(FRAMES, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); })
      .on('error', reject);
  });
}

let chrome = null, ws = null, msgId = 0;
const pending = new Map();
const consoleErrors = [];
const consoleLines = [];
function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result ? r.result.value : undefined;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = path.join(FRAMES, name);
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
  const sz = fs.statSync(p).size;
  console.log('  shot ' + name + ' ' + sz + ' bytes');
  return { name, size: sz };
}

async function launch(url) {
  chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=/tmp/chrome-verify-m1-' + Date.now(),
    '--window-size=1280,720', '--hide-scrollbars', url,
  ], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { targets = await getJson('http://127.0.0.1:' + PORT + '/json/list'); break; }
    catch (e) { /* not up yet */ }
  }
  if (!targets) throw new Error('chrome devtools did not come up');
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.on('message', (data) => {
    const m = JSON.parse(data.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result || {}); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') {
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      consoleLines.push(m.params.type + ': ' + text);
      if (m.params.type === 'error') consoleErrors.push(text);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 500));
    }
  });
  await send('Runtime.enable', {});
  await send('Page.enable', {});
}

async function close() {
  try { if (ws) ws.close(); } catch (e) {}
  try { if (chrome) chrome.kill(); } catch (e) {}
  ws = null; chrome = null;
  consoleErrors.length = 0; consoleLines.length = 0;
}

async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await fn()) return true; } catch (e) {}
    await sleep(1000);
  }
  throw new Error('timeout waiting for ' + label);
}

const mode = process.argv[2] || 'all';
const server = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--directory', GAME_DIR],
  { stdio: 'ignore' });
await sleep(1500);
const base = `http://127.0.0.1:${HTTP_PORT}/index.html`;

try {
  if (mode === 'smoke' || mode === 'all') {
    console.log('== smoke: plain load, console errors? ==');
    await launch(base);
    // The Godot canvas appears once the engine boots.
    await waitFor(async () => (await evalJs(`!!document.querySelector('canvas')`)), 60000, 'canvas');
    await sleep(8000);
    const title = await evalJs('document.title');
    console.log('  title: ' + title);
    const hasCanvas = await evalJs(`(() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : 'none'; })()`);
    console.log('  canvas: ' + hasCanvas);
    const selftestLines = consoleLines.filter((l) => l.includes('M1SELFTEST'));
    console.log('  console errors: ' + consoleErrors.length);
    consoleErrors.slice(0, 5).forEach((e) => console.log('   ERR: ' + e.slice(0, 300)));
    console.log('SMOKE ' + (consoleErrors.length === 0 ? 'PASS' : 'FAIL'));
    await shot('web_title.png');
    await close();
  }

  if (mode === 'selftest' || mode === 'all') {
    console.log('== selftest: ?selftest=1 combat flow ==');
    await launch(base + '?selftest=1');
    await waitFor(async () => (await evalJs('document.title')).includes('M1SELFTEST'), 120000, 'selftest title');
    const title = await evalJs('document.title');
    console.log('  ' + title);
    const lines = consoleLines.filter((l) => l.includes('M1SELFTEST'));
    lines.forEach((l) => console.log('  ' + l));
    console.log('SELFTEST ' + (title.includes('PASS') ? 'PASS' : 'FAIL'));
    await close();
  }

  if (mode === 'shots' || mode === 'all') {
    console.log('== shots: photo states ==');
    const states = [
      ['hero_select', 'hero_select.png'],
      ['level', 'level.png'],
      ['troop', 'troop.png'],
      ['boss', 'boss_front.png'],
      ['boss_side', 'boss_side.png'],
      ['victory', 'victory.png'],
    ];
    for (const [state, file] of states) {
      await launch(base + '?photo=' + state);
      await waitFor(async () => (await evalJs(`!!document.querySelector('canvas')`)), 60000, 'canvas ' + state);
      await sleep(9000);
      await shot(file);
      await close();
    }
    console.log('SHOTS done');
  }
} finally {
  try { server.kill(); } catch (e) {}
  try { if (chrome) chrome.kill(); } catch (e) {}
}
console.log('verify_m1 done');
