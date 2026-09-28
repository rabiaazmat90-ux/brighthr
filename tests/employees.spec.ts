import { test } from '@playwright/test';
import { EmployeesPage } from '../pages/EmployeesPage';
import { buildEmployee, fullName } from '../utils/employeeFactory';

/**
 * BrightHR Lite technical task - Step 2 scenarios.
 *
 * WHY test.describe.serial:
 * Scenario 3 ("verify both employees are displayed") can only pass if
 * scenarios 1 and 2 created those employees. Serial mode runs them in order
 * and, if one fails, skips the rest - so we never get a misleading failure
 * in scenario 3 that is really caused by scenario 1.
 *
 * ALTERNATIVE: make every test fully independent (each creates its own
 * employee in beforeEach, ideally via an API). That is the better long-term
 * pattern for a large suite and allows parallel runs, but it would not match
 * the task, which describes one connected journey: add, add, then verify.
 */
test.describe.serial('Employees - add and verify', { tag: '@positive' }, () => {
  // Generated once per run so all three scenarios refer to the same people.
  const firstEmployee = buildEmployee();
  const secondEmployee = buildEmployee();

  let employeesPage: EmployeesPage;

  test.beforeEach(async ({ page }) => {
    employeesPage = new EmployeesPage(page);
  });

  test('Scenario 1: navigate to Employees from the left panel and add an employee with all fields (incl. optional)', async () => {
    // test.step groups actions in the HTML report / trace so the interview
    // demo reads like the scenario, and a failure shows which step broke.
    await test.step('Open Employees from the left-hand panel', async () => {
      await employeesPage.openFromSidebar();
    });

    await test.step(`Add employee: ${fullName(firstEmployee)}`, async () => {
      await employeesPage.addEmployee(firstEmployee);
    });

    await test.step('Employee appears in the list', async () => {
      await employeesPage.openFromSidebar();
      await employeesPage.expectEmployeeListed(firstEmployee);
    });
  });

  test('Scenario 2: add another employee', async () => {
    await test.step('Open Employees from the left-hand panel', async () => {
      await employeesPage.openFromSidebar();
    });

    await test.step(`Add employee: ${fullName(secondEmployee)}`, async () => {
      await employeesPage.addEmployee(secondEmployee);
    });

    await test.step('Employee appears in the list', async () => {
      await employeesPage.openFromSidebar();
      await employeesPage.expectEmployeeListed(secondEmployee);
    });
  });

  test('Scenario 3: navigate to Employees and verify both employees are displayed', async () => {
    /**
     * WHY navigate fresh (instead of reusing the page from scenario 2):
     * each Playwright test gets a brand-new browser page, so this proves the
     * employees were really SAVED on the server, not just shown in the UI
     * straight after the form was submitted.
     */
    await test.step('Open Employees from the left-hand panel', async () => {
      await employeesPage.openFromSidebar();
    });

    await test.step(`First employee is listed: ${fullName(firstEmployee)}`, async () => {
      await employeesPage.expectEmployeeListed(firstEmployee);
    });

    await test.step(`Second employee is listed: ${fullName(secondEmployee)}`, async () => {
      await employeesPage.expectEmployeeListed(secondEmployee);
    });
  });
});
