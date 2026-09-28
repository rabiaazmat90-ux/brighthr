import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Load credentials from .env for local runs.
 * WHY dotenv: keeps secrets out of the code and out of Git. In CI the same
 * variable names are injected from GitHub Actions secrets, so the code does
 * not care where the values came from.
 * ALTERNATIVE: hard-coding the login in the test would work, but it leaks
 * credentials into the repo history and makes switching accounts a code change.
 */
dotenv.config({ path: path.resolve(__dirname, '.env') });

/** File where the logged-in browser session is saved by auth.setup.ts. */
export const STORAGE_STATE = path.join(__dirname, '.auth/user.json');

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',

  /**
   * WHY 60s per test: the sandbox is a shared, sometimes slow environment and
   * each scenario fills a long form. The default 30s caused false failures.
   * ALTERNATIVE: a larger global timeout hides real slowness; a smaller one
   * gives flaky red builds. 60s is a middle ground.
   */
  timeout: 60_000,
  expect: { timeout: 10_000 },

  /**
   * WHY fullyParallel false + 1 worker: all scenarios log into the SAME shared
   * BrightHR account and scenario 3 depends on data created by 1 and 2.
   * Running them in order avoids tests racing each other on one account.
   * ALTERNATIVE: parallel workers are faster, but only safe when every test
   * owns its own data/account (e.g. an account per worker created via API).
   */
  fullyParallel: false,
  workers: 1,

  /** Fail the CI build if someone accidentally commits test.only. */
  forbidOnly: isCI,

  /**
   * WHY retries only in CI: a remote sandbox can have network blips, so one
   * retry in CI stops noise from blocking the pipeline, and a retried test
   * shows as "flaky" in the report so it is still visible.
   * Locally we use 0 retries so real problems show immediately.
   * ALTERNATIVE: retries everywhere would hide genuine instability.
   */
  retries: isCI ? 2 : 0,

  /**
   * WHY these reporters: 'list' for readable console output, 'html' for the
   * clickable report with traces, and 'github' in CI so failures appear as
   * annotations directly on the pull request.
   * ALTERNATIVE: JUnit/Allure reporters suit Jenkins/Azure or management
   * dashboards; easy to add later without touching the tests.
   */
  reporter: [
    ...(isCI ? [['github'] as const] : []),
    ['list'],
    ['html', { open: isCI ? 'never' : 'on-failure' }],
    /**
     * WHY a JSON reporter too: it is the machine-readable result that
     * scripts/build-dashboard.cjs turns into the test report dashboard.
     * JSON_REPORT lets unit and E2E runs write separate files, so running
     * one never wipes the other's results.
     * Saved in reports/ (not test-results/) because Playwright empties
     * test-results/ at the start of every run.
     */
    ['json', { outputFile: process.env.JSON_REPORT || 'reports/results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://sandbox-app.brighthr.com',

    /**
     * WHY UK locale + London timezone: BrightHR is a UK product and the
     * start-date field expects DD/MM/YYYY. Pinning these makes date handling
     * identical on a UK laptop and on a US-based GitHub runner.
     */
    locale: 'en-GB',
    timezoneId: 'Europe/London',

    /**
     * WHY evidence only on failure/retry: full traces and videos for every
     * passing test make runs slower and the artifact huge. Capturing them when
     * something goes wrong gives everything needed to debug.
     * ALTERNATIVE: trace: 'on' is handy during the interview demo - switch it
     * with `npx playwright test --trace on`.
     */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    /**
     * WHY a separate "unit" project: unit tests check our own helpers and
     * test data. They need no browser and no login, so they do not depend on
     * "setup" and finish in about a second. Run them alone with
     * `npm run test:unit`; CI runs them FIRST so a broken helper fails the
     * build in seconds instead of after a slow browser run.
     */
    {
      name: 'unit',
      testMatch: /unit\/.*\.unit\.spec\.ts/,
    },
    /**
     * WHY a separate "setup" project: log in ONCE, save the session cookies to
     * .auth/user.json, and let every test start already logged in.
     * This is faster and means login is tested once rather than repeated
     * as a hidden step inside every scenario.
     * ALTERNATIVE: logging in inside beforeEach is simpler to read but repeats
     * the slowest step for every test and multiplies the chance of flakiness.
     */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      // Browser tests only - unit tests run in their own project above.
      testIgnore: /unit\//,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    /**
     * WHY only Chromium enabled: the task is about functional behaviour, and
     * one browser keeps the CI run short. Cross-browser is one uncomment away.
     */
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'], storageState: STORAGE_STATE },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE },
    //   dependencies: ['setup'],
    // },
  ],
});
