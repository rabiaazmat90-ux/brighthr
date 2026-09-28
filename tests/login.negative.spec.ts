import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { requireEnv } from '../utils/env';

/**
 * LOGIN - NEGATIVE PATHS
 * ----------------------
 * Goal: prove the app REFUSES bad logins and protects its pages from
 * logged-out users. Each test checks behaviour (we stay on the login page,
 * we never reach the app) and, softly, that an error message is shown.
 *
 * WHY start logged OUT: the rest of the suite reuses a saved session. These
 * tests must see the login page, so this file overrides storageState with an
 * empty one (no cookies = a brand-new visitor).
 */
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * ACCOUNT-LOCKOUT SAFETY
 * The sandbox account is shared by every candidate and by our CI. Too many
 * failed logins on the REAL email could lock it for everyone. So:
 *   - only ONE test uses the real email with a wrong password;
 *   - "unknown email" and "invalid email" tests use made-up addresses, which
 *     cannot lock the real account.
 * ALTERNATIVE: many wrong-password variations belong on a dedicated throwaway
 * account, not a shared one.
 */
const UNKNOWN_EMAIL = `not.a.real.user.${Date.now()}@example.com`;
const WRONG_PASSWORD = 'Wrong-Password-123!';

test.describe('Login - negative paths', { tag: '@negative' }, () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  // --- Credentials rejected -------------------------------------------------

  test('Wrong password for a real account is rejected', async () => {
    await loginPage.goto();
    await test.step('Enter the real email with a wrong password', async () => {
      await loginPage.attemptLogin(requireEnv('BRIGHTHR_EMAIL'), WRONG_PASSWORD);
    });
    await test.step('Login is rejected with an error', async () => {
      await loginPage.expectLoginRejected();
    });
  });

  test('Unknown email address is rejected', async () => {
    // WHY: checks the app does not let in accounts that do not exist.
    // Using a made-up email also means zero lockout risk.
    await loginPage.goto();
    await test.step(`Enter an unregistered email (${UNKNOWN_EMAIL})`, async () => {
      await loginPage.attemptLogin(UNKNOWN_EMAIL, WRONG_PASSWORD);
    });
    await test.step('Login is rejected with an error', async () => {
      await loginPage.expectLoginRejected();
    });
  });

  test('Badly formatted email address is rejected', async () => {
    // WHY: format validation should stop an obviously invalid email before
    // (or when) it reaches the server.
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
    // WHY: password is a required field; an empty value must never log in.
    // Most forms block this before sending anything, so it does not count as
    // a failed attempt against the shared account.
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
    // WHY: a security basic - protected pages must not render without a
    // session. We open the app root directly, as if from a bookmark.
    await test.step('Open the app directly without logging in', async () => {
      await page.goto('/');
    });
    await test.step('A login screen is shown, not the app', async () => {
      await loginPage.expectRedirectedToLogin();
    });
  });
});
