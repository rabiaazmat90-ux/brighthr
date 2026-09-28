#!/usr/bin/env node
/**
 * dashboard-server.cjs - serves the dashboard with a working "Run tests" button.
 *
 *   npm run dashboard:serve        ->  http://localhost:4321
 *
 * WHY a small local server: a web page on its own is NOT allowed to run
 * programs on your computer (a core browser security rule). This server is
 * the bridge: the page asks it to start a run, the server runs Playwright,
 * streams the output back live, then rebuilds the dashboard.
 *
 * WHY plain Node (no Express or other packages): nothing extra to install
 * or keep up to date, and the whole server is readable in one file.
 * ALTERNATIVE: triggering GitHub Actions from the page would work anywhere,
 * but needs a GitHub token in the browser - unsafe for a shared page.
 *
 * SECURITY - this server can start programs, so it is locked down:
 *   1. Listens on 127.0.0.1 only: other computers on your network cannot
 *      reach it.
 *   2. The page can only pick from a fixed list of runs (SCOPES below).
 *      Nothing typed by a user is ever passed to a command.
 *   3. Run requests must carry a custom header and come from this server's
 *      own address. Browsers will not let another website send that header
 *      without permission we never grant, so a random site you visit cannot
 *      start runs on your machine (CSRF protection).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.DASHBOARD_PORT) || 4321;
const HOST = '127.0.0.1';
const DASHBOARD = path.join(ROOT, 'dashboard', 'index.html');
const PW = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.cmd' : 'playwright');

/**
 * The ONLY runs the page can ask for. Each is a fixed list of steps.
 * Each browser run writes its own results file, and the dashboard keeps
 * every test's latest result, so a partial run never wipes the others.
 */
const E2E = ['--project=setup', '--project=chromium'];
const SCOPES = {
  all: [
    { label: 'Unit tests', args: ['--project=unit'], report: 'unit.json' },
    { label: 'Browser tests', args: E2E, report: 'e2e.json', browser: true },
  ],
  unit: [{ label: 'Unit tests', args: ['--project=unit'], report: 'unit.json' }],
  positive: [{ label: 'Required scenarios', args: [...E2E, '--grep', '@positive'], report: 'positive.json', browser: true }],
  negative: [{ label: 'Extra coverage', args: [...E2E, '--grep', '@negative|@extended'], report: 'negative.json', browser: true }],
};

/** Current run state, shared with every open dashboard tab. */
const state = { running: false, scope: null, step: null, startedAt: null, finishedAt: null, exitCode: null, log: [] };
const listeners = new Set();

function emit(event) {
  if (event.type === 'line') {
    state.log.push(event.text);
    if (state.log.length > 2000) state.log.shift(); // keep memory bounded
  }
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of listeners) res.write(payload);
}

function publicState() {
  const { log, ...rest } = state;
  return rest;
}

/** Rebuilds dashboard/index.html from the saved results. */
function buildDashboard() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'build-dashboard.cjs')], { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

/** Runs one step and resolves with its exit code. Output streams to the page. */
function runStep(step, headed) {
  return new Promise((resolve) => {
    const args = ['test', ...step.args];
    if (headed && step.browser) args.push('--headed');
    emit({ type: 'line', text: `\n$ playwright ${args.slice(1).join(' ')}` });
    const child = spawn(PW, args, {
      cwd: ROOT,
      env: { ...process.env, JSON_REPORT: path.join('reports', step.report), FORCE_COLOR: '0' },
    });
    const pipe = (buf) => String(buf).split(/\r?\n/).filter(Boolean).forEach((text) => emit({ type: 'line', text }));
    child.stdout.on('data', pipe);
    child.stderr.on('data', pipe);
    child.on('error', (err) => {
      emit({ type: 'line', text: `Could not start Playwright: ${err.message}. Run "npm install" first.` });
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function startRun(scope, headed) {
  Object.assign(state, { running: true, scope, step: null, startedAt: Date.now(), finishedAt: null, exitCode: null, log: [] });
  emit({ type: 'state', state: publicState() });

  let worst = 0;
  for (const step of SCOPES[scope]) {
    state.step = step.label;
    emit({ type: 'state', state: publicState() });
    const code = await runStep(step, headed);
    worst = Math.max(worst, code);
    // WHY keep going after a failure: the unit tests failing should not hide
    // what the browser tests would show - the dashboard reports both.
  }

  state.step = 'Building dashboard';
  emit({ type: 'state', state: publicState() });
  const built = buildDashboard();
  emit({ type: 'line', text: built.output });

  Object.assign(state, { running: false, step: null, finishedAt: Date.now(), exitCode: built.ok ? worst : 1 });
  emit({ type: 'done', state: publicState() });
}

/** Rejects requests that did not come from this dashboard page. */
function isTrustedRequest(req) {
  const hostOk = [`127.0.0.1:${PORT}`, `localhost:${PORT}`].includes(req.headers.host);
  const origin = req.headers.origin;
  const originOk = !origin || origin === `http://127.0.0.1:${PORT}` || origin === `http://localhost:${PORT}`;
  const headerOk = req.headers['x-dashboard-request'] === '1';
  return hostOk && originOk && headerOk;
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    if (!fs.existsSync(DASHBOARD)) buildDashboard();
    return send(res, 200, fs.readFileSync(DASHBOARD), 'text/html; charset=utf-8');
  }

  // The page calls this to find out whether a Run button can be offered.
  if (req.method === 'GET' && url.pathname === '/api/status') {
    return send(res, 200, { ...publicState(), scopes: Object.keys(SCOPES) });
  }

  // Live output (Server-Sent Events): replays the log so far, then streams.
  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'state', state: publicState(), log: state.log })}\n\n`);
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    if (!isTrustedRequest(req)) return send(res, 403, { error: 'Runs can only be started from the dashboard page.' });
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1000) req.destroy(); });
    req.on('end', () => {
      let input = {};
      try { input = JSON.parse(body || '{}'); } catch { return send(res, 400, { error: 'Invalid request.' }); }
      const scope = String(input.scope || 'all');
      if (!Object.prototype.hasOwnProperty.call(SCOPES, scope)) return send(res, 400, { error: `Unknown run "${scope}".` });
      if (state.running) return send(res, 409, { error: 'A run is already in progress.' });
      // WHY only one run at a time: every run uses the same shared BrightHR
      // account, and two at once would interfere.
      startRun(scope, input.headed === true);
      return send(res, 202, { started: scope });
    });
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  const link = `http://localhost:${PORT}`;
  console.log(`Dashboard with Run button: ${link}\nPress Ctrl+C to stop.`);
  if (!process.env.NO_OPEN) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(opener, [link], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).on('error', () => {});
  }
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is busy. The dashboard may already be running - open http://localhost:${PORT}`);
  else console.error(err.message);
  process.exit(1);
});
