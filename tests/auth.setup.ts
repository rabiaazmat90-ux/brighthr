import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { STORAGE_STATE } from '../playwright.config';
import { requireEnv } from '../utils/env';

/**
 * Runs ONCE before the scenarios (see the "setup" project in
 * playwright.config.ts). Logs in through the real UI and saves the session
 * cookies, so each scenario starts already authenticated.
 *
 * WHY log in through the UI here rather than via an API call: we do not have
 * a documented BrightHR auth API, and the UI login also proves the account
 * works. If an auth API existed, calling it would be faster and less flaky.
 */
setup('log in to BrightHR Lite and save session', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(requireEnv('BRIGHTHR_EMAIL'), requireEnv('BRIGHTHR_PASSWORD'));
  await page.context().storageState({ path: STORAGE_STATE });
});
