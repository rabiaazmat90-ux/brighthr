import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object for the BrightHR login journey.
 *
 * WHY Page Object Model (POM): selectors live in ONE place. If BrightHR renames
 * a button, we fix one line here instead of every test. Tests then read like
 * the scenario ("log in", "add employee") rather than a list of clicks.
 * ALTERNATIVE: locators written straight inside tests are fine for a one-off
 * script but become copy-paste maintenance as the suite grows.
 *
 * WHAT THE PAGE ACTUALLY LOOKS LIKE (confirmed with a diagnostic run):
 * https://sandbox-app.brighthr.com/lite is the "Sign up for BrightHR Lite"
 * form (first name, last name, email, phone, company, T&Cs, Submit). It has
 * NO password box. The real login is behind the "Log in" link (href="/").
 * Earlier versions typed into the sign-up email box, which is why login failed.
 */
/**
 * URL patterns that mean "still on a login page". Exported so a unit test
 * can prove it matches login URLs and NOT normal app URLs - the whole
 * "did login succeed?" check depends on this pattern being right.
 */
export const LOGIN_URL = /sandbox-login|\/login|signin|account\/login/i;

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** The "Log in" link on the /lite sign-up page. Exact name, so it can never
   *  match the "Sign up" button next to it. */
  get logInLink(): Locator {
    return this.page.getByRole('link', { name: 'Log in', exact: true });
  }

  /**
   * WHY these locators: accessible label first (what a user sees), then input
   * type / name as fallbacks via .or(). We exclude the sign-up form's
   * "-sign-up" ids so we can never type into the wrong form again.
   * ALTERNATIVE: long CSS/XPath paths break on any layout change.
   */
  get emailInput(): Locator {
    return this.page
      .getByLabel(/email|username/i)
      .or(this.page.locator('input[type="email"], input[name="email"], input[name="username"], input[name="Username"]'))
      .and(this.page.locator(':not([id$="-sign-up"])'))
      .first();
  }

  /** Every password box has type="password", whatever its label says. */
  get passwordInput(): Locator {
    return this.page.locator('input[type="password"]').first();
  }

  get submitButton(): Locator {
    return this.page
      .getByRole('button', { name: /^(log ?in|sign ?in|continue|next|submit)$/i })
      .first();
  }

  /**
   * Follows the same route a real user takes: open /lite, click "Log in".
   * WHY not go straight to BrightHR's login site URL: it uses a redirect with
   * one-time parameters, so a copied URL can go stale. Following the app's own
   * link keeps working even if BrightHR changes the login site address.
   */
  async goto() {
    await this.page.goto('/lite');
    await this.logInLink.click();
    await expect(this.emailInput, 'The BrightHR login form did not appear').toBeVisible({ timeout: 30_000 });
  }

  /** Happy path: log in and prove it worked. Used by auth.setup.ts. */
  async login(email: string, password: string) {
    await this.attemptLogin(email, password);
    await this.expectLoggedIn();
  }

  /**
   * Types the credentials and submits WITHOUT asserting the outcome.
   *
   * WHY split "attempt" from "assert": the positive test expects success and
   * the negative tests expect failure, but both must perform the SAME user
   * actions. One attempt method + separate expectations avoids duplicating
   * the login steps (DRY) and keeps each test's intent obvious.
   */
  async attemptLogin(email: string, password: string) {
    await this.emailInput.fill(email);

    /**
     * WHY support both one-page and two-step logins: some identity pages show
     * email and password together, others ask for the email first, then show
     * the password. We detect which one we have instead of assuming.
     */
    const passwordShown = await this.isPasswordVisible(3_000);
    if (!passwordShown) {
      await this.submitOrEnter(this.emailInput);
      // With an empty/invalid email a two-step login never shows the
      // password box - that is fine for negative tests, so do not fail here.
      if (!(await this.isPasswordVisible(10_000))) return;
    }

    await this.passwordInput.fill(password);
    await this.submitOrEnter(this.passwordInput);
  }

  /**
   * WHY these two checks: the password box disappearing AND the browser
   * leaving the login site together prove login really worked.
   * Web-first assertions retry automatically - no fixed sleeps.
   * ALTERNATIVE: page.waitForTimeout(5000) - too short on a slow day,
   * wasted time on a fast one.
   */
  async expectLoggedIn() {
    await expect(this.passwordInput).toBeHidden({ timeout: 30_000 });
    await expect(this.page).not.toHaveURL(LOGIN_URL, { timeout: 30_000 });
  }

  /**
   * Negative-path proof that login was REJECTED.
   *
   * WHY check behaviour first (still on the login site, login form still
   * there) and the error text second: behaviour is what really matters to a
   * user and does not change when BrightHR rewords a message. The error-text
   * check is a SOFT assertion - if the wording differs it is reported in the
   * results but does not hide the more important behavioural result.
   * ALTERNATIVE: asserting one exact error string is precise but breaks on
   * any copy change.
   */
  async expectLoginRejected() {
    // Give the app time to respond, then confirm we never left the login page.
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(this.emailInput.or(this.passwordInput).first()).toBeVisible({ timeout: 15_000 });
    await expect(this.page).not.toHaveURL(/sandbox-app\.brighthr\.com\/(dashboard|employee)/i);
    await expect
      .soft(this.errorMessage, 'An error or validation message should explain why login failed')
      .toBeVisible({ timeout: 10_000 });
  }

  /**
   * Proves a logged-OUT user is kept away from the app and shown a login
   * or sign-up screen instead of the dashboard.
   * WHY check for the absence of the Employees link: it only exists inside
   * the logged-in app, so it is a clear signal that protected content did
   * not render.
   */
  async expectRedirectedToLogin() {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(
      this.emailInput.or(this.passwordInput).or(this.logInLink).first(),
      'A logged-out user should see a login (or sign-up) screen',
    ).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole('link', { name: /^employees$/i })).toHaveCount(0);
  }

  /** Any visible error / validation text on the login page. */
  get errorMessage(): Locator {
    return this.page
      .getByRole('alert')
      .or(this.page.getByText(/incorrect|invalid|required|not recogni[sz]ed|try again|enter (a|an|your)|can(')?t be (blank|empty)|please/i))
      .first();
  }

  private async isPasswordVisible(timeout: number) {
    return this.passwordInput
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  /** Click the form's button if we can see one, otherwise press Enter -
   *  exactly what a keyboard user would do. */
  private async submitOrEnter(field: Locator) {
    if (await this.submitButton.isVisible().catch(() => false)) {
      await this.submitButton.click();
    } else {
      await field.press('Enter');
    }
  }
}
