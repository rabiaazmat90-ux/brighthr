import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page object for the BrightHR login journey.
 *
 * /lite is the public "Sign up for BrightHR Lite" form and has no password
 * field; the real login form is behind its "Log in" link.
 */

/** URLs that mean "still on a login page". Unit-tested in testData.unit.spec.ts. */
export const LOGIN_URL = /sandbox-login|\/login|signin|account\/login/i;

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get logInLink(): Locator {
    return this.page.getByRole('link', { name: 'Log in', exact: true });
  }

  /** Excludes the sign-up form's "-sign-up" ids so we never type into the wrong form. */
  get emailInput(): Locator {
    return this.page
      .getByLabel(/email|username/i)
      .or(this.page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="Username"]'))
      .and(this.page.locator(':not([id$="-sign-up"])'))
      .first();
  }

  get passwordInput(): Locator {
    return this.page.locator('input[type="password"]').first();
  }

  get submitButton(): Locator {
    return this.page
      .getByRole('button', { name: /^(log ?in|sign ?in|continue|next|submit)$/i })
      .first();
  }

  get errorMessage(): Locator {
    return this.page
      .getByRole('alert')
      .or(this.page.getByText(/incorrect|invalid|required|not recogni[sz]ed|try again|enter (a|an|your)|can(')?t be (blank|empty)|please/i))
      .first();
  }

  /**
   * Follows the user's route: open /lite and click "Log in". The login site
   * uses one-time redirect parameters, so its URL cannot be opened directly.
   */
  async goto() {
    await this.page.goto('/lite');
    await this.logInLink.click();
    await expect(this.emailInput, 'The BrightHR login form did not appear').toBeVisible({ timeout: 30_000 });
  }

  async login(email: string, password: string) {
    await this.attemptLogin(email, password);
    await this.expectLoggedIn();
  }

  /**
   * Enters the credentials and submits without asserting the outcome, so the
   * positive and negative tests share exactly the same steps.
   * Handles both one-page logins and email-first, then-password logins.
   */
  async attemptLogin(email: string, password: string) {
    await this.emailInput.fill(email);

    const passwordShown = await this.isPasswordVisible(3_000);
    if (!passwordShown) {
      await this.submitOrEnter(this.emailInput);
      // With an empty or invalid email the password step may never appear;
      // that is expected in negative tests.
      if (!(await this.isPasswordVisible(10_000))) return;
    }

    await this.passwordInput.fill(password);
    await this.submitOrEnter(this.passwordInput);
  }

  async expectLoggedIn() {
    await expect(this.passwordInput).toBeHidden({ timeout: 30_000 });
    await expect(this.page).not.toHaveURL(LOGIN_URL, { timeout: 30_000 });
  }

  /** Still on the login form, never reached the app; error message is a soft check. */
  async expectLoginRejected() {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(this.emailInput.or(this.passwordInput).first()).toBeVisible({ timeout: 15_000 });
    await expect(this.page).not.toHaveURL(/sandbox-app\.brighthr\.com\/(dashboard|employee)/i);
    await expect
      .soft(this.errorMessage, 'An error or validation message should explain why login failed')
      .toBeVisible({ timeout: 10_000 });
  }

  /** A logged-out visitor sees a login or sign-up screen and no app navigation. */
  async expectRedirectedToLogin() {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(
      this.emailInput.or(this.passwordInput).or(this.logInLink).first(),
      'A logged-out user should see a login (or sign-up) screen',
    ).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole('link', { name: /^employees$/i })).toHaveCount(0);
  }

  private async isPasswordVisible(timeout: number) {
    return this.passwordInput
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  /** Clicks the form's button if there is one, otherwise presses Enter. */
  private async submitOrEnter(field: Locator) {
    if (await this.submitButton.isVisible().catch(() => false)) {
      await this.submitButton.click();
    } else {
      await field.press('Enter');
    }
  }
}
