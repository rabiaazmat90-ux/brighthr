import { test, expect } from '@playwright/test';
import { EmployeesPage } from '../pages/EmployeesPage';
import { buildEmployee, type Employee } from '../utils/employeeFactory';
import {
  INVALID_EMAILS,
  INVALID_PHONES,
  NON_PHONE_CHARACTERS,
  OVERLONG_NAME,
  XSS_PAYLOAD,
} from '../utils/testData';

/**
 * ADD EMPLOYEE - NEGATIVE AND BOUNDARY PATHS
 * ------------------------------------------
 * Goal: prove the Add employee form refuses bad data and never saves it.
 *
 * HOW A NEGATIVE TEST DECIDES PASS / FAIL (same pattern everywhere):
 *   1. Behaviour: the "Save new employee" button is disabled, or Save is
 *      clicked and the form stays open -> nothing was submitted.
 *      (The first real run showed BrightHR mainly uses a disabled button.)
 *   2. Message (SOFT check): a validation message is shown. Soft, because
 *      wording can change; a missing message is reported as a UX finding but
 *      does not hide the more important result.
 *   3. Data: the employee is NOT in the list. A message on screen means
 *      nothing if the bad record was saved anyway - data integrity is the
 *      real point of validation.
 *
 * WHY every test is independent (not serial like the positive journey):
 * each case is a separate rule. If "missing first name" fails, "invalid
 * email" still runs and reports its own result.
 *
 * WHY unique data per test: the account is shared and never reset, so each
 * test searches for a surname containing a random id that only it created.
 */
test.describe('Add employee - negative paths', { tag: '@negative' }, () => {
  let employeesPage: EmployeesPage;

  test.beforeEach(async ({ page }) => {
    employeesPage = new EmployeesPage(page);
    await employeesPage.openFromSidebar();
    await employeesPage.openAddEmployeeForm();
  });

  /**
   * Shared ending for "should be blocked" tests: save is refused, the form is
   * closed, and the record is confirmed absent from the list.
   */
  async function expectBlockedAndNotCreated(searchText: string) {
    await test.step('Save is blocked with a validation message', async () => {
      await employeesPage.expectSaveBlocked();
    });
    await test.step('No employee was created', async () => {
      await employeesPage.closeFormWithoutSaving();
      await employeesPage.expectEmployeeNotListed(searchText);
    });
  }

  // ===========================================================================
  // REQUIRED FIELDS
  // ===========================================================================

  test('Saving a completely empty form is blocked', async () => {
    // WHY: the most basic guard - an empty record must never be created.
    await test.step('Click Save without filling anything', async () => {
      await employeesPage.attemptSave();
    });
    await test.step('Save is blocked with a validation message', async () => {
      await employeesPage.expectSaveBlocked();
    });
    await employeesPage.closeFormWithoutSaving();
  });

  test('Saving without a first name is blocked', async () => {
    const employee = buildEmployee();
    await test.step('Fill every field except First name and save', async () => {
      await employeesPage.fillForm(employee, ['firstName']);
      await employeesPage.attemptSave();
    });
    await expectBlockedAndNotCreated(employee.lastName);
  });

  test('Saving without a last name is blocked', async () => {
    // The surname is normally what we search by, and it is empty here, so
    // put this run's unique id into the FIRST name instead.
    const employee = withUniqueFirstName(buildEmployee());
    await test.step('Fill every field except Last name and save', async () => {
      await employeesPage.fillForm(employee, ['lastName']);
      await employeesPage.attemptSave();
    });
    await expectBlockedAndNotCreated(employee.firstName);
  });

  test('A first name of only spaces is treated as empty', async () => {
    // WHY: "   " passes a naive "is it filled in?" check but is not a name.
    // A good form trims spaces before validating. If this fails, the app
    // saved a blank-looking employee - a genuine defect worth reporting.
    const employee = buildEmployee({ firstName: '   ' });
    await test.step('Enter only spaces as First name and save', async () => {
      await employeesPage.fillForm(employee);
      await employeesPage.attemptSave();
    });
    await expectBlockedAndNotCreated(employee.lastName);
  });

  // ===========================================================================
  // INVALID EMAIL - data-driven
  // ===========================================================================

  /**
   * WHY data-driven (one test per row): each value breaks a DIFFERENT email
   * rule, and each gets its own line in the report, so a failure tells you
   * exactly which rule is not enforced.
   * ALTERNATIVE: one test that loops through all values stops at the first
   * failure and hides the rest.
   * Values chosen are invalid under the HTML standard's email rules, so the
   * expectations are not opinion.
   */
  // Data lives in utils/testData.ts so the unit tests can verify it.

  for (const { value, rule } of INVALID_EMAILS) {
    test(`Email that ${rule} ("${value}") is blocked`, async () => {
      const employee = buildEmployee({ email: value });
      await test.step(`Fill the form with email "${value}" and save`, async () => {
        await employeesPage.fillForm(employee);
        await employeesPage.attemptSave();
      });
      await expectBlockedAndNotCreated(employee.lastName);
    });
  }

  // ===========================================================================
  // INVALID PHONE - data-driven
  // ===========================================================================

  /**
   * WHY two acceptable outcomes for phone: apps protect this field in one of
   * two valid ways -
   *   (a) the field refuses the characters as you type (they never appear), or
   *   (b) the field accepts them and Save is blocked with a message.
   * Both keep bad data out. The test only FAILS if the bad characters are
   * accepted AND saved - which is exactly the defect we care about.
   *
   * WHY no "too short" / "too long" digits case: BrightHR does not document
   * a length rule, so asserting one would be testing our assumption rather
   * than the product. Worth asking the team about in a real project.
   */
  // Data lives in utils/testData.ts so the unit tests can verify it.

  for (const { value, rule } of INVALID_PHONES) {
    test(`Phone number that ${rule} ("${value}") is rejected`, async () => {
      /**
       * KNOWN BRIGHTHR DEFECT - found by this suite on the first real run.
       * With letters or symbols in the phone number, "Save new employee"
       * stays enabled and the form submits, i.e. the invalid phone number
       * is accepted.
       *
       * WHY test.fail() instead of deleting or weakening the test:
       *  - The expectation stays correct ("bad phone numbers must not be
       *    saved"), so the defect is documented, not hidden.
       *  - The build stays green, because this failure is EXPECTED.
       *  - If BrightHR fixes the bug, this test unexpectedly passes and
       *    Playwright flags it, telling us to remove test.fail().
       * ALTERNATIVE: test.skip() would also keep the build green, but it
       * stops checking entirely, so nobody would notice when it is fixed.
       */
      test.fail(true, 'Known BrightHR defect: the phone number field accepts letters and symbols, and the employee is saved.');

      const employee = buildEmployee({ phoneNumber: value });

      await test.step(`Fill the form with phone "${value}"`, async () => {
        await employeesPage.fillForm(employee);
      });

      const typed = await employeesPage.phoneInput.inputValue();
      if (typed !== value) {
        // The field filtered the input as it was typed - bad data cannot get in.
        await test.step('The field refused the invalid characters as they were typed', async () => {
          expect(typed, 'Only digits/phone characters should remain').not.toMatch(NON_PHONE_CHARACTERS);
        });
        await employeesPage.closeFormWithoutSaving();
        return;
      }

      const outcome = await employeesPage.attemptSave();
      if (outcome === 'disabled' || (await employeesPage.isFormStillOpen())) {
        await expectBlockedAndNotCreated(employee.lastName);
        return;
      }

      // The form submitted. The only thing that matters now is whether the
      // bad record was stored - that decides pass or fail.
      await test.step('The employee with an invalid phone number must NOT be saved', async () => {
        await employeesPage.expectEmployeeNotListed(employee.lastName);
      });
    });
  }

  // ===========================================================================
  // BOUNDARY AND SECURITY
  // ===========================================================================

  test('A very long first name (256 characters) is handled gracefully', async () => {
    /**
     * WHY: 255/256 is a classic database column limit. Without a limit in the
     * UI, an over-long value can crash the save or break the list layout.
     * THREE acceptable outcomes - all are graceful:
     *   (a) the field stops typing at its max length,
     *   (b) Save is blocked (disabled button or a message),
     *   (c) it saves and the employee appears normally in the list.
     * The test FAILS only on an unhandled error (e.g. form hangs, no record,
     * no message) - that is the real defect.
     */
    const longName = OVERLONG_NAME;
    const employee = buildEmployee({ firstName: longName });

    await test.step('Enter a 256-character First name', async () => {
      await employeesPage.fillForm(employee);
    });

    const typed = await employeesPage.firstNameInput.inputValue();
    if (typed.length < longName.length) {
      await test.step(`(a) Field limited the input to ${typed.length} characters`, async () => {
        expect(typed.length).toBeGreaterThan(0);
      });
      await employeesPage.closeFormWithoutSaving();
      return;
    }

    await employeesPage.attemptSave();
    if (await employeesPage.isFormStillOpen()) {
      // Seen on the real site: the Save button is disabled for 256 characters.
      await test.step('(b) Save was blocked', async () => {
        await employeesPage.expectSaveBlocked();
      });
      await employeesPage.closeFormWithoutSaving();
    } else {
      await test.step('(c) Saved - the employee appears normally in the list', async () => {
        await employeesPage.openFromSidebar();
        await employeesPage.expectEmployeeListed(employee);
      });
    }
  });

  test('HTML/script in a name is never executed (XSS check)', async ({ page }) => {
    /**
     * WHY: Cross-Site Scripting is a top web security risk (OWASP Top 10).
     * If a name like <img onerror=alert(1)> is saved and later rendered as
     * HTML, the script runs for every user who opens the Employees page.
     * PASS if: no browser alert ever fires. Blocking the value OR saving it
     * and showing it as plain text are both safe.
     * FAIL if: an alert fires at any point - a genuine security defect.
     */
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    const payload = XSS_PAYLOAD;
    const employee = buildEmployee({ firstName: payload });

    await test.step('Enter an HTML/script payload as First name and save', async () => {
      await employeesPage.fillForm(employee);
      await employeesPage.attemptSave();
    });

    if (await employeesPage.isFormStillOpen()) {
      await employeesPage.closeFormWithoutSaving();
    }

    await test.step('Open the Employees list where the name would be rendered', async () => {
      await employeesPage.openFromSidebar();
      await page.waitForLoadState('networkidle').catch(() => {});
    });

    await test.step('No script executed', async () => {
      expect(dialogs, 'A browser alert means the payload ran as code (XSS)').toEqual([]);
    });
  });

  // ===========================================================================
  // CANCEL
  // ===========================================================================

  test('Cancelling a fully filled form does not create an employee', async () => {
    // WHY: users often abandon forms; Cancel must discard, not half-save.
    const employee = buildEmployee();
    await test.step('Fill every field, then cancel instead of saving', async () => {
      await employeesPage.fillForm(employee);
      await employeesPage.closeFormWithoutSaving();
    });
    await test.step('No employee was created', async () => {
      await employeesPage.expectEmployeeNotListed(employee.lastName);
    });
  });
});

/**
 * Moves this run's unique id into the first name, for tests that leave the
 * surname empty. The surname ends with the 6-letter id (see employeeFactory).
 */
function withUniqueFirstName(employee: Employee): Employee {
  return { ...employee, firstName: `${employee.firstName}${employee.lastName.slice(-6)}` };
}
