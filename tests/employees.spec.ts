import { test } from '@playwright/test';
import { EmployeesPage } from '../pages/EmployeesPage';
import { buildEmployee, fullName } from '../utils/employeeFactory';

/**
 * The task's required journey: add an employee, add another, verify both.
 * Serial because scenario 3 depends on the data from 1 and 2: if an earlier
 * scenario fails, the rest are skipped rather than failing misleadingly.
 */
test.describe.serial('Employees - add and verify', { tag: '@positive' }, () => {
  const firstEmployee = buildEmployee();
  const secondEmployee = buildEmployee();

  let employeesPage: EmployeesPage;

  test.beforeEach(async ({ page }) => {
    employeesPage = new EmployeesPage(page);
  });

  test('Scenario 1: navigate to Employees from the left panel and add an employee with all fields (incl. optional)', async () => {
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
    // A fresh page load proves both employees were saved on the server,
    // not just shown in the UI straight after submitting.
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
