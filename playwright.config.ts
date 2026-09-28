import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { STORAGE_STATE } from './utils/paths';

// Local runs read credentials from .env; CI injects the same variables from secrets.
dotenv.config({ path: path.resolve(__dirname, '.env') });

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',

  // The shared sandbox can be slow and the add-employee form is long.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // One shared account, and scenario 3 depends on 1 and 2, so run in order.
  fullyParallel: false,
  workers: 1,

  forbidOnly: isCI,
  // Retries absorb sandbox network blips in CI; retried tests still show as flaky.
  retries: isCI ? 2 : 0,

  reporter: [
    ...(isCI ? [['github'] as const] : []),
    ['list'],
    ['html', { open: isCI ? 'never' : 'on-failure' }],
    // Machine-readable results for scripts/build-dashboard.cjs. Written to
    // reports/ because Playwright empties test-results/ at the start of a run.
    ['json', { outputFile: process.env.JSON_REPORT || 'reports/results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://sandbox-app.brighthr.com',

    // BrightHR is a UK product: keeps DD/MM/YYYY dates identical locally and in CI.
    locale: 'en-GB',
    timezoneId: 'Europe/London',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Browser-free tests of our own helpers and test data.
    {
      name: 'unit',
      testMatch: /unit\/.*\.unit\.spec\.ts/,
    },
    // Logs in once and saves the session for the browser tests.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: /unit\//,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    // Cross-browser runs are one uncomment away:
    // {
    //   name: 'firefox',
    //   testIgnore: /unit\//,
    //   use: { ...devices['Desktop Firefox'], storageState: STORAGE_STATE },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'webkit',
    //   testIgnore: /unit\//,
    //   use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE },
    //   dependencies: ['setup'],
    // },
  ],
});
