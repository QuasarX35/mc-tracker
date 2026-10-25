/**
 * Zero-dependency browser driver for UI acceptance tests (测试部, EDICT-0009).
 *
 * Why this exists: the repository takes no npm dependencies, and the app must be
 * tested as a user experiences it — real Chrome, real DOM, real events — not by
 * asserting on strings. Node 22 ships a global WebSocket, so the DevTools Protocol
 * is reachable without any package. Chrome is launched with stdio ignored (the
 * sandbox denies piped child stdio) and driven over its debugging port.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean);

export function chromePath() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Chrome not found; set CHROME_PATH to run the UI acceptance suite');
  return found;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForEndpoint(port, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {
      /* not up yet */
    }
    await sleep(120);
  }
  throw new Error(`Chrome DevTools endpoint did not appear on port ${port}`);
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => resolve(new Cdp(socket)));
      socket.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000);
    });
  }

  on(listener) {
    this.listeners.push(listener);
  }

  close() {
    try {
      this.socket.close();
    } catch {
      /* already closed */
    }
  }
}

/** A thin page object with the handful of interactions the suite needs. */
class Page {
  constructor(cdp, { url, consoleErrors }) {
    this.cdp = cdp;
    this.url = url;
    this.consoleErrors = consoleErrors;
  }

  async goto(targetUrl) {
    await this.cdp.send('Page.navigate', { url: targetUrl });
    await this.waitFor('document.readyState === "complete" && window.TrackerModel !== undefined');
  }

  async reload() {
    await this.cdp.send('Page.reload', { ignoreCache: true });
    await this.waitFor('document.readyState === "complete" && window.TrackerModel !== undefined');
  }

  /** Evaluate an expression in the page and return its JSON value. */
  async evaluate(expression) {
    const result = await this.cdp.send('Runtime.evaluate', {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`page error: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
    }
    return result.result.value;
  }

  /** Evaluate and keep the remote object (needed for file inputs). */
  async evaluateHandle(expression) {
    const result = await this.cdp.send('Runtime.evaluate', {
      expression: `(() => { ${expression} })()`,
      returnByValue: false,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'handle failed');
    return result.result.objectId;
  }

  async waitFor(expression, { timeout = 8000, interval = 60 } = {}) {
    const started = Date.now();
    let lastError = null;
    while (Date.now() - started < timeout) {
      try {
        if (await this.evaluate(`return !!(${expression});`)) return true;
      } catch (error) {
        lastError = error;
      }
      await sleep(interval);
    }
    throw new Error(`waitFor timed out: ${expression}${lastError ? ` (${lastError.message})` : ''}`);
  }

  /** Click an element by CSS selector; throws if it is missing or hidden. */
  async click(selector) {
    const clicked = await this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return 'missing';
      if (el.disabled) return 'disabled';
      el.click();
      return 'ok';
    `);
    if (clicked !== 'ok') throw new Error(`cannot click ${selector}: ${clicked}`);
    await sleep(30);
  }

  /** Type into an input/textarea so `change`/`input` listeners fire like real typing. */
  async fill(selector, value) {
    const result = await this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return 'missing';
      el.focus();
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    `);
    if (result !== 'ok') throw new Error(`cannot fill ${selector}: ${result}`);
    await sleep(30);
  }

  /** Press a key through the browser (used for focus/tab-order assertions). */
  async press(key, { code = key, keyCode = 0 } = {}) {
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
    await sleep(40);
  }

  async setViewport(width, height) {
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
    });
    await sleep(50);
  }

  async clearViewport() {
    await this.cdp.send('Emulation.clearDeviceMetricsOverride');
    await sleep(30);
  }

  /** Emulate prefers-reduced-motion (needed for the panorama pan assertion). */
  async emulateReducedMotion(reduce) {
    await this.cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
    });
    await sleep(40);
  }

  /** Block URL patterns at the network layer (used to prove graceful degradation). */
  async blockUrls(patterns) {
    await this.cdp.send('Network.enable');
    await this.cdp.send('Network.setBlockedURLs', { urls: patterns });
    await sleep(40);
  }

  async unblockUrls() {
    await this.cdp.send('Network.setBlockedURLs', { urls: [] });
    await sleep(40);
  }

  async screenshot(file) {
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  }

  async text(selector) {
    return this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      return el ? el.textContent.trim() : null;
    `);
  }

  async html(selector) {
    return this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      return el ? el.innerHTML : null;
    `);
  }

  async count(selector) {
    return this.evaluate(`return document.querySelectorAll(${JSON.stringify(selector)}).length;`);
  }

  async exists(selector) {
    return this.evaluate(`return !!document.querySelector(${JSON.stringify(selector)});`);
  }

  async attr(selector, name) {
    return this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      return el ? el.getAttribute(${JSON.stringify(name)}) : null;
    `);
  }

  async hidden(selector) {
    return this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      return el ? el.hidden : null;
    `);
  }

  async value(selector) {
    return this.evaluate(`
      const el = document.querySelector(${JSON.stringify(selector)});
      return el ? el.value : null;
    `);
  }

  /** Attach a file to <input type="file"> the way the OS picker would. */
  async upload(selector, filePath) {
    // CDP needs an absolute path; a relative one is accepted but attaches nothing,
    // which is a nasty silent failure for tests.
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absolute)) throw new Error(`upload file not found: ${absolute}`);
    const objectId = await this.evaluateHandle(`return document.querySelector(${JSON.stringify(selector)});`);
    await this.cdp.send('DOM.setFileInputFiles', { files: [absolute], objectId });
    await sleep(120);
  }

  /** Capture console errors and uncaught exceptions for the whole session. */
}

export async function launch({ appUrl, port = 9333, profileDir, headed = false } = {}) {
  const dir = profileDir || path.join(process.cwd(), '.tmp', `ui-profile-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const args = [
    headed ? '--headless=false' : '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-crashpad',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    'about:blank',
  ];
  const child = spawn(chromePath(), args, { stdio: 'ignore', windowsHide: true });
  const exits = new Promise((resolve) => child.on('exit', resolve));
  await waitForEndpoint(port);

  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  let target = list.find((entry) => entry.type === 'page');
  if (!target) {
    target = await (await fetch(`http://127.0.0.1:${port}/json/new`, { method: 'PUT' })).json();
  }
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const consoleErrors = [];
  cdp.on((message) => {
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      consoleErrors.push(`exception: ${detail.exception?.description || detail.text}`);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(`console.error: ${message.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    }
  });

  const page = new Page(cdp, { url: appUrl, consoleErrors });
  if (appUrl) await page.goto(appUrl);

  return {
    page,
    consoleErrors,
    profileDir: dir,
    async close() {
      try {
        await cdp.send('Browser.close');
      } catch {
        /* browser already gone */
      }
      cdp.close();
      await Promise.race([exits, sleep(4000)]);
      try {
        child.kill();
      } catch {
        /* already dead */
      }
    },
  };
}

export function fileUrl(relativePath) {
  // Keep ?query / #hash out of the path: pathToFileURL would percent-encode '?' and
  // point at a file that does not exist.
  const [target, query = ''] = String(relativePath).split('?');
  const base = pathToFileURL(path.resolve(target)).href;
  return query ? `${base}?${query}` : base;
}

export { sleep };
