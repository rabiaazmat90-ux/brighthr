import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { requireEnv } from '../utils/env';

/**
 * Login: negative paths and access control. Each test checks behaviour
 * (we stay on the login page and never reach the app) and, softly, that an
 * error message is shown.
 */

// Start logged out: override the saved session with an empty one.
test.use({ storageState: { cookies: [], origins: [] } });

// The sandbox account is shared, so only ONE test sends a wrong password for
// the real email; the others use made-up addresses that cannot lock it.
const UNKNOWN_EMAIL = `not.a.real.user.${Date.now()}@example.com`;
const WRONG_PASSWORD = 'Wrong-Password-123!';

test.describe('Login - negative paths', { tag: '@negative' }, () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  // --- Credentials rejected -------------------------------------------------

  test('Wrong password for a real account is rejected', async () => {
    // The only test that sends a wrong password for the real account (lockout safety).
    await loginPage.goto();
    await test.step('Enter the real email with a wrong password', async () => {
      await loginPage.attemptLogin(requireEnv('BRIGHTHR_EMAIL'), WRONG_PASSWORD);
    });
    await test.step('Login is rejected with an error', async () => {
      await loginPage.expectLoginRejected();
    });
  });

  test('Unknown email address is rejected', async () => {
    // A made-up address, so it cannot lock the shared account.
    await loginPage.goto();
    await test.step(`Enter an unregistered email (${UNKNOWN_EMAIL})`, async () => {
      await loginPage.attemptLogin(UNKNOWN_EMAIL, WRONG_PASSWORD);
    });
    await test.step('Login is rejected with an error', async () => {
      await loginPage.expectLoginRejected();
    });
  });

  test('Badly formatted email address is rejected', async () => {
    await loginPage.goto();
    await test.step('Enter "not-an-email" as the email', async () => {
      await loginPage.attemptLogin('not-an-email', WRONG_PASSWORD);
    });
    await test.step('Login is rejected with a validation message', async () => {
      await loginPage.expectLoginRejected();
    });
  });

  // --- Required fields ------------------------------------------------------

  test('Empty email and empty password is rejected', async () => {
    await loginPage.goto();
    await test.step('Submit the login form with both fields empty', async () => {
      await loginPage.attemptLogin('', '');
    });
    await test.step('Login is rejected with a validation message', async () => {
      await loginPage.expectLoginRejected();
    });
  });

  test('Real email with an empty password is rejected', async () => {
    // Blocked before anything is sent, so it is not a failed attempt on the account.
    await loginPage.goto();
    await test.step('Enter the real email and leave the password empty', async () => {
      await loginPage.attemptLogin(requireEnv('BRIGHTHR_EMAIL'), '');
    });
    await test.step('Login is rejected with a validation message', async () => {
      await loginPage.expectLoginRejected();
    });
  });

  // --- Access control -------------------------------------------------------

  test('Logged-out user cannot open the app and is sent to login', async ({ page }) => {
    // Opens the app root directly, as if from a bookmark.
    await test.step('Open the app directly without logging in', async () => {
      await page.goto('/');
    });
    await test.step('A login screen is shown, not the app', async () => {
      await loginPage.expectRedirectedToLogin();
    });
  });
});
