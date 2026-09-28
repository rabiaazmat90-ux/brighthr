import { expect, test, type Locator, type Page } from '@playwright/test';
import { type Employee, ukDate } from '../utils/employeeFactory';

/**
 * Page Object for the Employees area: the left-hand navigation link,
 * the "Add employee" form and the employee list.
 */
export class EmployeesPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ---------------------------------------------------------------------------
  // Locators
  // ---------------------------------------------------------------------------

  /**
   * WHY target the link by its visible name: the task says "navigate to the
   * employee tab on the left-hand side of the panel", so we click it the way a
   * user would instead of jumping straight to a URL.
   * ALTERNATIVE: page.goto('/employee-hub') is faster, but it would skip the
   * navigation step the scenario explicitly asks us to test.
   */
  get employeesNavLink(): Locator {
    return this.page
      .getByRole('link', { name: /^employees$/i })
      .or(this.page.getByRole('button', { name: /^employees$/i }))
      .first();
  }

  get addEmployeeButton(): Locator {
    return this.page.getByRole('button', { name: /add employee/i }).first();
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: /save( new)? employee|^save$/i }).first();
  }

  /**
   * One helper for every text field: accessible label first, then id / name
   * attribute as a fallback. Keeps each field definition to a single line and
   * gives the same resilience strategy everywhere (see LoginPage for the WHY).
   */
  private field(label: RegExp, ...fallbackSelectors: string[]): Locator {
    let locator = this.page.getByLabel(label);
    for (const selector of fallbackSelectors) {
      locator = locator.or(this.page.locator(selector));
    }
    return locator.first();
  }

  /**
   * Fallback selectors follow BrightHR's own naming style, seen on its
   * sign-up form: name="firstName", id="firstName-<suffix>",
   * data-testid="first-name-input". [id^=...] means "id starts with".
   */
  get firstNameInput() { return this.field(/first name/i, '[name="firstName"]', '[id^="firstName"]', '[data-testid="first-name-input"]'); }
  get lastNameInput() { return this.field(/last name|surname/i, '[name="lastName"]', '[id^="lastName"]', '[data-testid="last-name-input"]'); }
  get emailInput() { return this.field(/email/i, '[name="email"]', '[id^="email"]', '[data-testid="email-input"]'); }
  get phoneInput() { return this.field(/phone|mobile/i, '[name="phoneNumber"]', '[id^="phoneNumber"]', '[data-testid="phone-number-input"]'); }
  get jobTitleInput() { return this.field(/job title/i, '[name="jobTitle"]', '[id^="jobTitle"]', '[data-testid="job-title-input"]'); }
  get startDateInput() { return this.field(/start date/i, '[name="startDate"]', '[id^="startDate"]', '[data-testid="start-date-input"]'); }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Start from the dashboard and use the left-hand panel, as the task states.
   * WHY '/' and not '/lite': /lite is the public sign-up page. The app root
   * is where a logged-in user lands (the dashboard with the left-hand panel).
   */
  async openFromSidebar() {
    await this.page.goto('/');
    await this.employeesNavLink.click();
    /**
     * WHY assert on something visible, not just the URL: a visible
     * "Add employee" button proves the page actually rendered and is usable.
     */
    await expect(this.addEmployeeButton).toBeVisible();
  }

  /** Happy path: fill every field (required + optional) and save. */
  async addEmployee(employee: Employee) {
    await this.openAddEmployeeForm();
    await this.fillForm(employee);
    await this.saveButton.click();
    await this.dismissSuccessDialog();
  }

  async openAddEmployeeForm() {
    await this.addEmployeeButton.click();
    await expect(this.firstNameInput).toBeVisible();
  }

  /**
   * Fills the form. `skip` leaves chosen fields empty - used by the negative
   * tests (e.g. no first name).
   *
   * WHY one fill method with a skip option: positive and negative tests type
   * into the form in exactly the same way, so the steps live in one place.
   * ALTERNATIVE: a separate "fillFormWithoutFirstName" per case duplicates
   * code and drifts out of sync.
   */
  async fillForm(employee: Employee, skip: Array<keyof Employee> = []) {
    // Required fields
    if (!skip.includes('firstName')) await this.firstNameInput.fill(employee.firstName);
    if (!skip.includes('lastName')) await this.lastNameInput.fill(employee.lastName);

    // Optional fields - the task asks for ALL fields, including optional ones
    if (!skip.includes('email')) await this.emailInput.fill(employee.email);
    if (!skip.includes('phoneNumber')) await this.phoneInput.fill(employee.phoneNumber);
    if (!skip.includes('startDate')) await this.setStartDate(employee.startDate);
    if (!skip.includes('jobTitle')) await this.jobTitleInput.fill(employee.jobTitle);
  }

  /**
   * Tries to save the form the way a user would.
   * Returns 'disabled' if the Save button is locked, 'clicked' otherwise.
   *
   * WHY this exists (learned from the first real run): BrightHR blocks
   * invalid data by DISABLING the "Save new employee" button. A plain
   * click() waits for the button to become clickable and times out after
   * 15 s - the test failed even though the app behaved correctly.
   * Checking the button's state first lets the test treat "disabled" as
   * the app successfully refusing the data.
   * ALTERNATIVE: click({ force: true }) would "click" a disabled button,
   * but that is not something a real user can do, so it proves nothing.
   */
  async attemptSave(): Promise<'clicked' | 'disabled'> {
    await expect(this.saveButton).toBeVisible();
    if (await this.saveButton.isDisabled()) return 'disabled';
    await this.saveButton.click();
    return 'clicked';
  }

  // ---------------------------------------------------------------------------
  // Negative-path helpers
  // ---------------------------------------------------------------------------

  /**
   * True if the Add employee form is still open after a Save attempt.
   * Used by boundary tests where "blocked" and "saved" can both be valid,
   * so the test can branch on what actually happened.
   */
  async isFormStillOpen(): Promise<boolean> {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    // A disabled Save button means the form refused to submit - still open.
    if (await this.saveButton.isDisabled().catch(() => false)) return true;
    // Give a successful save time to close the form before we decide.
    return this.saveButton
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .then(() => false)
      .catch(() => true);
  }

  /** Any visible validation message in the form. */
  get validationMessage(): Locator {
    return this.page
      .getByRole('alert')
      .or(this.page.locator('[aria-invalid="true"]'))
      .or(this.page.getByText(/required|invalid|enter (a|an) valid|must|please (enter|provide)|not valid|can(')?t be (blank|empty)/i))
      .first();
  }

  /**
   * Proves the app REFUSED to save.
   *
   * BrightHR does this in one of two ways, and both count as blocked:
   *   - the "Save new employee" button is DISABLED (seen on the real site
   *     for missing names, bad emails and over-long names), or
   *   - Save was clicked but the form stayed open.
   *
   * WHY behaviour first, message second: the form still being open is the
   * real proof nothing was submitted. The message check is SOFT - wording
   * can change, and some forms only show messages after a field loses focus;
   * a missing message is reported as a UX finding without hiding the result.
   * ALTERNATIVE: matching one exact message string is precise but brittle.
   */
  async expectSaveBlocked() {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(this.saveButton, 'Form should stay open when validation fails').toBeVisible();
    await expect(this.firstNameInput).toBeVisible();
    if (await this.saveButton.isDisabled()) {
      test.info().annotations.push({ type: 'blocked-by', description: 'Save new employee button disabled' });
      return;
    }
    await expect.soft(this.validationMessage, 'A validation message should explain the problem').toBeVisible();
  }

  /**
   * Leaves the form without saving: Cancel / Close button if there is one,
   * otherwise Escape (the keyboard route every accessible dialog supports).
   */
  async closeFormWithoutSaving() {
    const cancel = this.page
      .getByRole('button', { name: /^(cancel|close|discard|back)$/i })
      .or(this.page.getByLabel(/^close$/i))
      .first();
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    // Some forms ask "discard changes?" - confirm it if shown.
    const confirm = this.page.getByRole('button', { name: /^(yes|discard|leave|confirm)/i }).first();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();

    await expect(this.saveButton, 'Form should close after Cancel').toBeHidden({ timeout: 10_000 });
  }

  /**
   * Proves an employee was NOT created.
   *
   * WHY reload the list and wait for it to settle first: a "not visible"
   * check passes instantly on an empty, still-loading page - a false pass.
   * Reopening Employees and waiting for the network to go quiet makes the
   * absence check meaningful.
   * WHY search by a unique text (normally the surname, which contains this
   * run's random id): no other employee in the shared account can match it.
   */
  async expectEmployeeNotListed(uniqueText: string) {
    await this.openFromSidebar();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const search = this.page.getByRole('searchbox').or(this.page.getByPlaceholder(/search/i)).first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill(uniqueText);
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }
    await expect(this.page.getByText(uniqueText)).toHaveCount(0);
  }

  /**
   * Date pickers are the most common source of flaky UI tests, so this is
   * deliberately defensive.
   *
   * WHY two strategies:
   *  1. If the input accepts typing, type the date in DD/MM/YYYY - fastest and
   *     exactly what a keyboard user does.
   *  2. If the input is read-only (a pure calendar widget), open the calendar
   *     and click the day number.
   * ALTERNATIVE: setting the value with page.evaluate() is "reliable" but
   * bypasses the UI and the app's own change events, so the form may not
   * actually register the date - the test would no longer test the real app.
   */
  private async setStartDate(date: Date) {
    const input = this.startDateInput;
    const editable = await input.isEditable().catch(() => false);

    if (editable) {
      await input.fill(ukDate(date));
      await input.press('Tab'); // close any picker popup and trigger validation
      return;
    }

    await input.click();
    // The generated date is always in the recent past; if it is in last month
    // move the calendar back one month first.
    const now = new Date();
    if (date.getMonth() !== now.getMonth()) {
      await this.page
        .getByRole('button', { name: /previous|prev|back/i })
        .first()
        .click();
    }
    await this.page
      .getByRole('button', { name: new RegExp(`^${date.getDate()}$`) })
      .or(this.page.getByRole('gridcell', { name: new RegExp(`^${date.getDate()}$`) }))
      .first()
      .click();
  }

  /**
   * After saving, BrightHR shows a confirmation dialog (e.g. "employee added"
   * with options to add another / go to profile). We close it so the next
   * step starts from a clean page.
   *
   * WHY check for the dialog instead of assuming it exists: if BrightHR
   * removes the dialog in future, the test still passes as long as the
   * employee is created - we assert the real outcome in scenario 3.
   */
  private async dismissSuccessDialog() {
    const dialog = this.page.getByRole('dialog');
    await expect(this.saveButton).toBeHidden({ timeout: 15_000 }).catch(() => {});

    if (await dialog.isVisible().catch(() => false)) {
      const close = dialog.getByRole('button', { name: /close|done|finish|no,? thanks|not now/i }).first();
      if (await close.isVisible().catch(() => false)) {
        await close.click();
      } else {
        await this.page.keyboard.press('Escape');
      }
    }
  }

  /**
   * Checks an employee is shown in the list.
   *
   * WHY search by the unique full name: each run's names contain a random id,
   * so this can only match the employees created by THIS run.
   * If the list has a search box we use it, because a long shared list may be
   * paginated or virtualised and the new employee might not be rendered yet.
   */
  async expectEmployeeListed(employee: Employee) {
    const search = this.page.getByRole('searchbox').or(this.page.getByPlaceholder(/search/i)).first();

    if (await search.isVisible().catch(() => false)) {
      await search.fill(employee.lastName);
    }

    /**
     * WHY a web-first assertion (toBeVisible) instead of reading text and
     * comparing: it automatically retries until the list has loaded, which
     * removes timing flakiness without any manual waits.
     */
    //
    // WHY match on the surname (which carries the unique run id) rather than
    // the exact "First Last" string: some list layouts show "Last, First" or
    // put the two names in separate elements. The surname is unique on its own.
    await expect(this.page.getByText(employee.lastName).first()).toBeVisible();

    // Extra check: if the list is a table/list, the same row must also show
    // the first name - proves it is the right person, not just a surname match.
    const row = this.page
      .getByRole('row')
      .or(this.page.getByRole('listitem'))
      .filter({ hasText: employee.lastName })
      .first();
    if ((await row.count()) > 0) {
      await expect(row).toContainText(employee.firstName);
    }

    if (await search.isVisible().catch(() => false)) {
      await search.clear();
    }
  }
}
