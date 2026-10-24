// Renders the store screenshots and promotional tiles into store/images/.
//
// Serves the repository on 127.0.0.1, opens store/src/demo.html?image=<name>
// for each image in a throwaway headless Edge profile (sync and extensions
// disabled, no network beyond localhost), and saves PNGs of exact size.
// The popup shown is the real one, fed invented data by store/src/mock-chrome.js.
//
// Usage (Windows Node 22+): node scripts/capture_store_images.mjs
// Set EDGE_PATH to use another Chromium-based browser.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'store', 'images');
const EDGE = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const IMAGES = [
  { name: 'screenshot-1-download', width: 1280, height: 800 },
  { name: 'screenshot-2-translate', width: 1280, height: 800 },
  { name: 'screenshot-3-formats', width: 1280, height: 800 },
  { name: 'screenshot-4-dark', width: 1280, height: 800, dark: true },
  { name: 'promo-small-440x280', width: 440, height: 280 },
  { name: 'promo-large-1400x560', width: 1400, height: 560 },
];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serveRepository() {
  const server = createServer((request, response) => {
    const path = resolve(ROOT, `.${decodeURIComponent(new URL(request.url, 'http://x').pathname)}`);
    if (!path.startsWith(ROOT + sep) || !existsSync(path)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    response.end(readFileSync(path));
  });
  return new Promise((ready) => server.listen(0, '127.0.0.1', () => ready(server)));
}

async function connect(url) {
  const ws = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  const problems = [];
  await new Promise((resolveOpen, rejectOpen) => {
    ws.onopen = resolveOpen;
    ws.onerror = rejectOpen;
  });
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.method === 'Runtime.exceptionThrown') {
      const details = data.params.exceptionDetails;
      const where = details.url ? ` (${details.url}:${details.lineNumber + 1}:${details.columnNumber + 1})` : '';
      problems.push(`${details.exception?.description ?? details.text}${where}`);
    } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      problems.push(data.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    } else if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') {
      problems.push(`${data.params.entry.text} ${data.params.entry.url ?? ''}`.trim());
    }
    const callback = pending.get(data.id);
    if (!callback) return;
    pending.delete(data.id);
    if (data.error) callback.reject(new Error(`${data.error.message} (${data.error.code})`));
    else callback.resolve(data.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolveCall, rejectCall) => {
      nextId += 1;
      pending.set(nextId, { resolve: resolveCall, reject: rejectCall });
      ws.send(JSON.stringify({ id: nextId, method, params }));
    });
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
  return { send, evaluate, problems, close: () => ws.close() };
}

async function launchEdge(profile) {
  const edge = spawn(
    EDGE,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      // Without this a fresh profile signs into the Windows Microsoft account and syncs.
      '--disable-sync',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i += 1) await sleep(100);
  const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  return { edge, port, browser: await connect(version.webSocketDebuggerUrl) };
}

async function openPage(browser, port) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const page = await connect(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
  await page.send('Runtime.enable');
  await page.send('Log.enable');
  return { targetId, page };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await serveRepository();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), 'store-images-'));
  const { edge, port, browser } = await launchEdge(profile);
  try {
    const guard = await openPage(browser, port);
    await guard.page.send('Page.navigate', { url: 'edge://sync-internals' });
    await sleep(2000);
    if (await guard.page.evaluate(String.raw`/Sync Feature Enabled\s+true/.test(document.body.innerText)`)) {
      throw new Error('sync is enabled in the throwaway profile; refusing to continue');
    }
    await browser.send('Target.closeTarget', { targetId: guard.targetId });

    for (const image of IMAGES) {
      const { targetId, page } = await openPage(browser, port);
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: image.width,
        height: image.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: image.dark ? 'dark' : 'light' }],
      });
      await page.send('Page.navigate', { url: `${origin}/store/src/demo.html?image=${image.name}` });
      let state = '';
      for (let i = 0; i < 150 && !state; i += 1) {
        await sleep(100);
        state = (await page.evaluate('document.body?.dataset.ready ?? ""').catch(() => '')) ?? '';
      }
      if (state !== 'done') {
        const details = page.problems.length ? `\n  ${page.problems.join('\n  ')}` : '';
        throw new Error(`${image.name}: ${state || 'page never became ready'}${details}`);
      }
      const { data } = await page.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: image.width, height: image.height, scale: 1 },
      });
      writeFileSync(join(OUT_DIR, `${image.name}.png`), Buffer.from(data, 'base64'));
      console.log(`wrote store/images/${image.name}.png (${image.width}x${image.height})`);
      page.close();
      await browser.send('Target.closeTarget', { targetId });
    }
  } finally {
    await browser.send('Browser.close').catch(() => {});
    browser.close();
    server.close();
    for (let i = 0; i < 50 && edge.exitCode === null; i += 1) await sleep(100);
    if (edge.exitCode === null) edge.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
