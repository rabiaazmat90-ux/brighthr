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
 * Add employee: negative and boundary paths.
 *
 * Each "blocked" test checks three things in order:
 *   1. Behaviour: Save is disabled, or the form stays open after Save.
 *   2. Message (soft): a validation message is shown. Soft so that a
 *      wording change is reported without hiding the real result.
 *   3. Data: the employee is not in the list.
 *
 * Tests are independent (not serial), so each rule reports its own result.
 */
test.describe('Add employee - negative paths', { tag: '@negative' }, () => {
  let employeesPage: EmployeesPage;

  test.beforeEach(async ({ page }) => {
    employeesPage = new EmployeesPage(page);
    await employeesPage.openFromSidebar();
    await employeesPage.openAddEmployeeForm();
  });

  async function expectBlockedAndNotCreated(searchText: string) {
    await test.step('Save is blocked with a validation message', async () => {
      await employeesPage.expectSaveBlocked();
    });
    await test.step('No employee was created', async () => {
      await employeesPage.closeFormWithoutSaving();
      await employeesPage.expectEmployeeNotListed(searchText);
    });
  }

  // --- Required fields --------------------------------------------------------

  test('Saving a completely empty form is blocked', async () => {
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
    // The surname normally carries the unique run id, so move it to the first name.
    const employee = withUniqueFirstName(buildEmployee());
    await test.step('Fill every field except Last name and save', async () => {
      await employeesPage.fillForm(employee, ['lastName']);
      await employeesPage.attemptSave();
    });
    await expectBlockedAndNotCreated(employee.firstName);
  });

  test('A first name of only spaces is treated as empty', async () => {
    // "   " passes a naive "is it filled in?" check but is not a name.
    // The form should trim spaces before validating.
    const employee = buildEmployee({ firstName: '   ' });
    await test.step('Enter only spaces as First name and save', async () => {
      await employeesPage.fillForm(employee);
      await employeesPage.attemptSave();
    });
    await expectBlockedAndNotCreated(employee.lastName);
  });

  // --- Invalid email (one test per rule) ---------------------------------------

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

  // --- Duplicate email ---------------------------------------------------------

  test('An email already used by another employee is blocked', async () => {
    // Known defect: kept as test.fail() so Playwright flags it once BrightHR fixes the bug.
    test.fail(true, 'Known BrightHR defect: an email already used by another employee is accepted and saved.');
    // Emails identify people (e.g. for invites), so two employees sharing one
    // could send someone else's invite to the wrong person. BrightHR does not
    // document this rule, so if it allows duplicates, record it as a finding.
    const existing = buildEmployee();
    const duplicate = buildEmployee({ email: existing.email });

    await test.step(`Add an employee with email ${existing.email}`, async () => {
      await employeesPage.fillForm(existing);
      await employeesPage.save();
    });

    await test.step('Try to add a second employee with the same email', async () => {
      await employeesPage.openFromSidebar();
      await employeesPage.openAddEmployeeForm();
      await employeesPage.fillForm(duplicate);
      await employeesPage.attemptSave();
    });

    await expectBlockedAndNotCreated(duplicate.lastName);
  });

  // --- Invalid phone -----------------------------------------------------------
  // Two acceptable outcomes: the field filters the characters as they are
  // typed, or Save is blocked. The test fails only if the bad value is saved.

  for (const { value, rule } of INVALID_PHONES) {
    test(`Phone number that ${rule} ("${value}") is rejected`, async () => {
      // Known defect: kept as test.fail() rather than skipped, so Playwright
      // flags it as soon as BrightHR fixes the bug.
      test.fail(true, 'Known BrightHR defect: the phone number field accepts letters and symbols, and the employee is saved.');

      const employee = buildEmployee({ phoneNumber: value });

      await test.step(`Fill the form with phone "${value}"`, async () => {
        await employeesPage.fillForm(employee);
      });

      const typed = await employeesPage.phoneInput.inputValue();
      if (typed !== value) {
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

      await test.step('The employee with an invalid phone number must NOT be saved', async () => {
        await employeesPage.expectEmployeeNotListed(employee.lastName);
      });
    });
  }

  // --- Boundary and security ---------------------------------------------------

  test('A very long first name (256 characters) is handled gracefully', async () => {
    // Graceful means one of: (a) the field limits the length, (b) Save is
    // blocked, or (c) it saves and lists normally. Anything else fails.
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
    // Blocking the value or showing it as plain text are both safe.
    // Any browser alert means the payload ran as code.
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    const employee = buildEmployee({ firstName: XSS_PAYLOAD });

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

  // --- Cancel ------------------------------------------------------------------

  test('Cancelling a fully filled form does not create an employee', async () => {
    // Cancel must discard the data, not quietly save it (e.g. as a draft).
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

/** Moves the 6-letter run id from the surname onto the first name. */
function withUniqueFirstName(employee: Employee): Employee {
  return { ...employee, firstName: `${employee.firstName}${employee.lastName.slice(-6)}` };
}
