/* TECHIEMAN REAL 3D — verify3d.mjs
 * Headless-Chrome CDP driver. Launches system Chromium, loads the game from
 * file://, screenshots every scene (front + side camera for the 3D proof),
 * and runs the in-page autotests (boss deflect/guard/dodge/bullet/nova/KO,
 * run chapter completion, smoke geometry check).
 * Usage: node verify3d.mjs [boss|run|smoke|shots|all]
 * Output: verify/frames/*.png + a JSON summary printed to stdout.
 */
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const require = createRequire(import.meta.url);
const WebSocket = require('/home/hatch/workspace/techieman/app/node_modules/ws');

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const GAME = '/home/hatch/workspace/techieman/web-game-3d/index.html';
const FRAMES = '/home/hatch/workspace/techieman/web-game-3d/verify/frames';
const PORT = 9333;
fs.mkdirSync(FRAMES, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

let chrome = null;
let ws = null;
let msgId = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
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

async function launch(winW, winH) {
  const profile = '/tmp/chrome-verify-3d-' + Date.now();
  chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    '--window-size=' + (winW || 1280) + ',' + (winH || 720), '--hide-scrollbars',
    'file://' + GAME + '?scene=hero',
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
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      console.log('  !! page exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      console.log('  !! console.error: ' + JSON.stringify(m.params.args).slice(0, 300));
    }
  });
  await send('Page.enable');
  await send('Runtime.enable');
}

async function nav(url) {
  await send('Page.navigate', { url });
  await sleep(2500);
}
async function sceneState() {
  return await evalJs(`(() => {
    const tm = window.__TM__ || {};
    return { scene: tm.scene, errors: tm.errors || [],
      triangles: (window.__tri = (window.__tri || 0)),
      hasGL: !!window.THREE,
      errText: (document.getElementById('err')||{}).textContent || '' };
  })()`);
}
async function waitTestDone(timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const t = await evalJs(`window.__TM__ && window.__TM__.test && window.__TM__.test.done ? {done:true, pass: window.__TM__.test.pass, log: window.__TM__.test.log} : null`);
    if (t) return t;
    await sleep(1000);
  }
  const log = await evalJs(`(window.__TM__ && window.__TM__.test && window.__TM__.test.log) || []`);
  return { done: false, pass: false, log };
}

const MODE = process.argv[2] || 'all';
const results = {};
try {
  // Shots run live (no ?t= freeze: freeze-stepping re-renders every 1/60 s
  // under SwiftShader and is far too slow for screenshots). Autotests run
  // at a smaller window — SwiftShader cost scales with pixels.
  await launch((MODE === 'boss' || MODE === 'run') ? 960 : 1280, (MODE === 'boss' || MODE === 'run') ? 540 : 720);
  console.log('chrome up, WebGL check:');
  const gl = await evalJs(`(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); return g ? g.getParameter(g.VERSION) : 'NO WEBGL'; })()`);
  console.log('  webgl: ' + gl);

  if (MODE === 'all' || MODE === 'shots') {
    const scenes = [
      ['hero', '?scene=hero'],
      ['map', '?scene=map'],
      ['run', '?scene=run'],
      ['narrate', '?scene=narrate'],
      ['troops', '?scene=troops'],
      ['boss-front', '?scene=boss'],
      ['boss-side', '?scene=boss&cam=side'],
      ['hero-side', '?scene=hero&cam=side'],
      ['run-side', '?scene=run&cam=side'],
    ];
    for (const [name, q] of scenes) {
      console.log('scene ' + name + ' ' + q);
      await nav('file://' + GAME + q);
      await sleep(1500);
      const st = await sceneState();
      const tris = await evalJs(`window.__TM__ ? 'n/a' : 'n/a'`);
      console.log('  errors: ' + JSON.stringify(st.errors) + ' errText: ' + (st.errText || '(none)'));
      const s = await shot(name + '.png');
      results[name] = { shot: s, errors: st.errors, errText: st.errText };
    }
  }

  if (MODE === 'all' || MODE === 'smoke') {
    console.log('autotest smoke');
    await nav('file://' + GAME + '?scene=hero&autotest=smoke');
    const t = await waitTestDone(60000);
    console.log(t.log.join('\n'));
    results.smoke = t;
    await shot('smoke-hero.png');
  }

  if (MODE === 'all' || MODE === 'run') {
    console.log('autotest run (Kotlin ch.1)');
    await nav('file://' + GAME + '?scene=run&road=kotlin&chapter=1&autotest=run');
    const t = await waitTestDone(360000);
    console.log(t.log.join('\n'));
    results.run = t;
    await shot('autotest-run-end.png');
  }

  if (MODE === 'all' || MODE === 'boss') {
    console.log('autotest boss (Kotlin NULLPOINTER)');
    await nav('file://' + GAME + '?scene=boss&road=kotlin&autotest=boss');
    const t = await waitTestDone(660000);
    console.log(t.log.join('\n'));
    results.boss = t;
    await shot('autotest-boss-end.png');
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(results, null, 1));
} catch (e) {
  console.error('VERIFY ERROR: ' + (e && e.stack || e));
  process.exitCode = 1;
} finally {
  try { if (ws) ws.close(); } catch (e) {}
  try { if (chrome) chrome.kill('SIGKILL'); } catch (e) {}
  try { execSync('pkill -f remote-debugging-port=' + PORT + ' 2>/dev/null || true'); } catch (e) {}
}
