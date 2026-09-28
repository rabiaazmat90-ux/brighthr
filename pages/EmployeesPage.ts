import { expect, test, type Locator, type Page } from '@playwright/test';
import { type Employee, ukDate } from '../utils/employeeFactory';
import { datePattern, phonePattern } from '../utils/displayPatterns';

/**
 * Page object for the Employees area: the left-hand navigation link, the
 * "Add employee" form and the employee list.
 */
export class EmployeesPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // --- Locators ----------------------------------------------------------------

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

  /** A form field by its accessible label, with name/id/test-id fallbacks. */
  private field(label: RegExp, ...fallbackSelectors: string[]): Locator {
    let locator = this.page.getByLabel(label);
    for (const selector of fallbackSelectors) {
      locator = locator.or(this.page.locator(selector));
    }
    return locator.first();
  }

  get firstNameInput() { return this.field(/first name/i, '[name="firstName"]', '[id^="firstName"]', '[data-testid="first-name-input"]'); }
  get lastNameInput() { return this.field(/last name|surname/i, '[name="lastName"]', '[id^="lastName"]', '[data-testid="last-name-input"]'); }
  get emailInput() { return this.field(/email/i, '[name="email"]', '[id^="email"]', '[data-testid="email-input"]'); }
  get phoneInput() { return this.field(/phone|mobile/i, '[name="phoneNumber"]', '[id^="phoneNumber"]', '[data-testid="phone-number-input"]'); }
  get jobTitleInput() { return this.field(/job title/i, '[name="jobTitle"]', '[id^="jobTitle"]', '[data-testid="job-title-input"]'); }
  get startDateInput() { return this.field(/start date/i, '[name="startDate"]', '[id^="startDate"]', '[data-testid="start-date-input"]'); }

  get searchBox(): Locator {
    return this.page.getByRole('searchbox').or(this.page.getByPlaceholder(/search/i)).first();
  }

  get validationMessage(): Locator {
    return this.page
      .getByRole('alert')
      .or(this.page.locator('[aria-invalid="true"]'))
      .or(this.page.getByText(/required|invalid|enter (a|an) valid|must|please (enter|provide)|not valid|can(')?t be (blank|empty)/i))
      .first();
  }

  // --- Actions -----------------------------------------------------------------

  /**
   * Opens Employees via the left-hand panel, as the task describes, rather
   * than going straight to the Employees URL. '/' is the logged-in dashboard.
   */
  async openFromSidebar() {
    await this.page.goto('/');
    await this.employeesNavLink.click();
    await expect(this.addEmployeeButton).toBeVisible();
  }

  /** Fills every field, required and optional, and saves. */
  async addEmployee(employee: Employee) {
    await this.openAddEmployeeForm();
    await this.fillForm(employee);
    await this.save();
  }

  /** Saves the open form and closes the confirmation dialog. */
  async save() {
    await this.saveButton.click();
    await this.dismissSuccessDialog();
  }

  async openAddEmployeeForm() {
    await this.addEmployeeButton.click();
    await expect(this.firstNameInput).toBeVisible();
  }

  /** `skip` leaves chosen fields empty, for the negative tests. */
  async fillForm(employee: Employee, skip: Array<keyof Employee> = []) {
    if (!skip.includes('firstName')) await this.firstNameInput.fill(employee.firstName);
    if (!skip.includes('lastName')) await this.lastNameInput.fill(employee.lastName);
    if (!skip.includes('email')) await this.emailInput.fill(employee.email);
    if (!skip.includes('phoneNumber')) await this.phoneInput.fill(employee.phoneNumber);
    if (!skip.includes('startDate')) await this.setStartDate(employee.startDate);
    if (!skip.includes('jobTitle')) await this.jobTitleInput.fill(employee.jobTitle);
  }

  /**
   * BrightHR blocks invalid data by disabling "Save new employee", and
   * clicking a disabled button would just time out. So check first and
   * report 'disabled' as the app refusing the data.
   */
  async attemptSave(): Promise<'clicked' | 'disabled'> {
    await expect(this.saveButton).toBeVisible();
    if (await this.saveButton.isDisabled()) return 'disabled';
    await this.saveButton.click();
    return 'clicked';
  }

  // --- Negative-path helpers ---------------------------------------------------

  /** True if the form is still open after a Save attempt (disabled or not submitted). */
  async isFormStillOpen(): Promise<boolean> {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    if (await this.saveButton.isDisabled().catch(() => false)) return true;
    return this.saveButton
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .then(() => false)
      .catch(() => true);
  }

  /**
   * The app refused to save: either Save is disabled, or it was clicked and
   * the form stayed open. The validation message is a soft check, because
   * wording changes and some forms only show messages on blur.
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

  /** Leaves the form via Cancel/Close, or Escape if there is no button. */
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
    const confirm = this.page.getByRole('button', { name: /^(yes|discard|leave|confirm)/i }).first();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();

    await expect(this.saveButton, 'Form should close after Cancel').toBeHidden({ timeout: 10_000 });
  }

  /**
   * The employee was not created. Reloads the list and waits for it to settle
   * first, because a "not visible" check passes instantly on a page that is
   * still loading.
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
   * Types DD/MM/YYYY if the input is editable; otherwise picks the day from
   * the calendar. Deliberately uses the UI rather than setting the value in
   * JavaScript, so the app's own change events fire.
   */
  private async setStartDate(date: Date) {
    const input = this.startDateInput;
    const editable = await input.isEditable().catch(() => false);

    if (editable) {
      await input.fill(ukDate(date));
      await input.press('Tab');
      return;
    }

    await input.click();
    // Generated dates are in the last 20 days, so at most one month back.
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

  /** Closes the "employee added" confirmation dialog if it appears. */
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
   * The employee is in the list. Searches by surname, which carries the
   * unique run id, then checks the same row also shows the first name.
   */
  async expectEmployeeListed(employee: Employee) {
    const search = this.page.getByRole('searchbox').or(this.page.getByPlaceholder(/search/i)).first();

    if (await search.isVisible().catch(() => false)) {
      await search.fill(employee.lastName);
    }

    await expect(this.page.getByText(employee.lastName).first()).toBeVisible();

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

  // --- Profile and boundary helpers --------------------------------------------

  /** Opens an employee's profile by clicking their name in the Employees list. */
  async openProfile(employee: Employee) {
    await this.openFromSidebar();
    if (await this.searchBox.isVisible().catch(() => false)) {
      await this.searchBox.fill(employee.lastName);
    }
    await this.page.getByText(employee.lastName).first().click();
  }

  /**
   * The profile shows every value that was entered. Phone and date use
   * patterns because the app may format them differently from how they
   * were typed (e.g. "07123 456789", "5 Sept 2026"). innerText keeps the
   * line breaks between elements, so neighbouring values do not run together.
   */
  async expectProfileShows(employee: Employee) {
    const profile = this.page.locator('body');
    await expect(profile, 'First name').toContainText(employee.firstName, { useInnerText: true });
    await expect(profile, 'Last name').toContainText(employee.lastName, { useInnerText: true });
    await expect(profile, 'Email').toContainText(employee.email, { useInnerText: true });
    await expect(profile, 'Job title').toContainText(employee.jobTitle, { useInnerText: true });
    await expect(profile, 'Phone number').toContainText(phonePattern(employee.phoneNumber), { useInnerText: true });
    await expect(profile, 'Start date').toContainText(datePattern(employee.startDate), { useInnerText: true });
  }

  /**
   * Finds the longest first name the form accepts, with every other field
   * already valid. Uses the field's maxlength if it has one; otherwise
   * searches for the longest value that keeps Save enabled.
   * Returns `upTo` if no limit is found up to that length.
   */
  async longestAcceptedFirstName(upTo: number): Promise<number> {
    const maxLength = await this.firstNameInput.getAttribute('maxlength');
    if (maxLength) return Number(maxLength);

    const accepted = async (length: number) => {
      await this.firstNameInput.fill('A'.repeat(length));
      await this.firstNameInput.blur();
      if ((await this.firstNameInput.inputValue()).length < length) return false;
      return this.saveButton.isEnabled();
    };

    if (await accepted(upTo)) return upTo;
    let longestOk = 1;
    let shortestRejected = upTo;
    while (shortestRejected - longestOk > 1) {
      const mid = Math.floor((longestOk + shortestRejected) / 2);
      if (await accepted(mid)) longestOk = mid;
      else shortestRejected = mid;
    }
    return longestOk;
  }
}
