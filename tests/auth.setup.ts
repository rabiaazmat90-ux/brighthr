import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { requireEnv } from '../utils/env';
import { STORAGE_STATE } from '../utils/paths';

/**
 * Logs in once through the real UI and saves the session, so every browser
 * test starts already authenticated.
 */
setup('log in to BrightHR Lite and save session', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(requireEnv('BRIGHTHR_EMAIL'), requireEnv('BRIGHTHR_PASSWORD'));
  await page.context().storageState({ path: STORAGE_STATE });
});
