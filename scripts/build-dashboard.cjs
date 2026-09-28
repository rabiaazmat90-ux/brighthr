#!/usr/bin/env node
/**
 * build-dashboard.cjs - turns Playwright results into a test report dashboard.
 *
 * WHAT IT DOES
 *   1. Lists EVERY test in the suite (`playwright test --list`), so tests that
 *      have not run yet still appear, marked "Not run yet".
 *   2. Reads every results file in reports/*.json written by the JSON reporter.
 *   3. Merges the two and writes one self-contained page: dashboard/index.html
 *
 * WHY a custom dashboard as well as Playwright's HTML report:
 *   Playwright's report is perfect for DEBUGGING one run (traces, screenshots),
 *   but it only shows tests that ran and is organised by file. This dashboard
 *   answers the questions a reviewer or manager asks: what is covered, at which
 *   level of the test pyramid, and what is the status of each scenario.
 * ALTERNATIVE: Allure Report gives a similar overview with history, but needs
 *   Java and an extra reporter; this script needs nothing beyond Node.
 *
 * USAGE:  npm run dashboard        (after npm run test:unit / test:e2e)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');
const OUT_DIR = path.join(ROOT, 'dashboard');

/** Walks Playwright's nested JSON (file -> describe -> spec -> test). */
function collect(suite, parents, file, out) {
  const here = suite.title && suite.title !== file ? [...parents, suite.title] : parents;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      out.push({ file, describe: here.join(' › '), title: spec.title, tags: spec.tags || [], project: t.projectName, test: t });
    }
  }
  for (const child of suite.suites || []) collect(child, here, suite.file || file, out);
}

function flatten(report) {
  const out = [];
  for (const s of report.suites || []) collect(s, [], s.file || s.title, out);
  return out;
}

const keyOf = (r) => `${r.project}|${r.file}|${r.describe}|${r.title}`;

/** Maps Playwright's outcome to the four statuses a reader cares about. */
function statusOf(test) {
  const results = test.results || [];
  if (!results.length) return 'notrun';
  // A test marked test.fail() that failed as expected = a documented product
  // defect, not a broken test. Shown separately so it is neither hidden
  // among passes nor confused with real failures.
  if (test.expectedStatus === 'failed' && test.status === 'expected') return 'known';
  if (test.status === 'flaky') return 'flaky'; // failed first, passed on retry
  if (test.status === 'skipped') return 'skipped';
  const last = results[results.length - 1];
  return last.status === 'passed' ? 'passed' : 'failed';
}

/** Which layer of the test pyramid a test belongs to. */
function layerOf(r) {
  if (r.project === 'unit') return 'unit';
  if (r.project === 'setup') return 'setup';
  // Playwright's JSON writes tags without the "@" (e.g. "negative"), while the
  // tests declare "@negative" - normalise so both forms work.
  const tags = r.tags.map((t) => String(t).replace(/^@/, ''));
  // Extra positive and boundary tests share the "extra coverage" layer with the negative tests.
  if (tags.includes('negative') || tags.includes('extended')) return 'negative';
  return 'positive';
}

const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');

// 1) The full catalogue of tests.
// WHY a fallback: listing runs Playwright once more. If that fails for any
// reason (e.g. a config problem), we still build the dashboard from the
// results we have rather than stopping with no report at all.
let catalogue = [];
try {
  const listJson = execSync('npx playwright test --list --reporter=json', {
    cwd: ROOT,
    env: { ...process.env, JSON_REPORT: path.join(REPORTS_DIR, '.list-ignore.json') },
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();
  catalogue = flatten(JSON.parse(listJson.slice(listJson.indexOf('{'))));
} catch (err) {
  console.warn(`Could not list all tests (${String(err.message).split('\n')[0]}). Building from saved results only.`);
}

// 2) Real results from every run saved in reports/.
// WHY sort by start time and keep each test's LATEST result: runs can be
// partial (e.g. only the negative tests from the dashboard's Run button).
// Each test keeps its most recent real result, so a partial run updates the
// tests it ran without wiping results for the rest.
const runs = new Map();
let lastRun = null;
const reports = [];
if (fs.existsSync(REPORTS_DIR)) {
  for (const f of fs.readdirSync(REPORTS_DIR).filter((n) => n.endsWith('.json') && !n.startsWith('.'))) {
    try {
      reports.push(JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8')));
    } catch {
      // A run stopped part-way (e.g. Ctrl+C) can leave an unreadable file - skip it.
      console.warn(`Skipping unreadable results file reports/${f}`);
    }
  }
}
reports.sort((x, y) => String(x.stats?.startTime || '').localeCompare(String(y.stats?.startTime || '')));
for (const report of reports) {
  const started = report.stats && report.stats.startTime;
  if (started && (!lastRun || started > lastRun)) lastRun = started;
  for (const r of flatten(report)) {
    // Only a test that actually ran replaces an earlier result.
    if ((r.test.results || []).length) runs.set(keyOf(r), r);
  }
}

// 3) Merge: every catalogued test, with its latest result if it has one.
// Results for tests missing from the catalogue (fallback case) are added too.
const catalogueKeys = new Set(catalogue.map(keyOf));
const merged = [...catalogue, ...[...runs.values()].filter((r) => !catalogueKeys.has(keyOf(r)))];

const tests = merged.map((c) => {
  const ran = runs.get(keyOf(c));
  const t = ran ? ran.test : c.test;
  const results = t.results || [];
  const last = results[results.length - 1] || {};
  return {
    layer: layerOf(c),
    area: c.describe || 'Setup',
    file: c.file,
    title: c.title,
    status: statusOf(t),
    duration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
    retries: Math.max(0, results.length - 1),
    // The reason given in test.fail(...) - shown next to known defects.
    note: (t.annotations || []).filter((a) => a.type === 'fail').map((a) => a.description).join(' '),
    error: stripAnsi((last.errors || []).map((e) => e.message).join('\n\n')).slice(0, 4000),
  };
});

const data = { generated: new Date().toISOString(), lastRun, tests };
const template = fs.readFileSync(path.join(__dirname, 'dashboard-template.html'), 'utf8');
const html = template.replace('__DATA__', JSON.stringify(data).replace(/</g, '\\u003c'));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);

const count = (s) => tests.filter((t) => t.status === s).length;
console.log(
  `Dashboard written to dashboard/index.html - ${tests.length} tests: ` +
    `${count('passed')} passed, ${count('known')} known defects, ${count('failed')} failed, ${count('flaky')} flaky, ${count('notrun')} not run yet`,
);
