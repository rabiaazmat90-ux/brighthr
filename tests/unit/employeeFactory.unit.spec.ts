import { test, expect } from '@playwright/test';
import { buildEmployee, fullName, ukDate } from '../../utils/employeeFactory';
import { HTML_EMAIL_PATTERN } from '../../utils/testData';

/**
 * UNIT TESTS - test-data factory (utils/employeeFactory.ts)
 * ---------------------------------------------------------
 * WHY unit-test the test data: every browser test trusts this factory. If it
 * ever produced a duplicate surname, an invalid email or a future start
 * date, the E2E tests would fail (or worse, pass) for the wrong reason, and
 * we would waste time debugging the app instead of the data.
 *
 * WHY Playwright's runner for unit tests: no extra framework (Jest/Vitest)
 * to install or configure. Tests that do not use the `page` fixture never
 * start a browser, so these run in well under a second.
 * ALTERNATIVE: Vitest is a great choice in a larger codebase with lots of
 * non-UI logic; here one runner keeps the project simple.
 */

test.describe('buildEmployee()', { tag: '@unit' }, () => {
  test('returns every field, all non-empty', () => {
    const e = buildEmployee();
    for (const key of ['firstName', 'lastName', 'email', 'phoneNumber', 'jobTitle'] as const) {
      expect(e[key], `${key} should be filled`).toBeTruthy();
      expect(e[key].trim(), `${key} should not be only spaces`).not.toBe('');
    }
    expect(e.startDate).toBeInstanceOf(Date);
  });

  test('names contain letters only (no digits or punctuation)', () => {
    // WHY: some name fields reject digits/punctuation; the factory strips
    // them so a POSITIVE test never fails on our own data.
    for (let i = 0; i < 200; i++) {
      const e = buildEmployee();
      expect(e.firstName).toMatch(/^[A-Za-z]+$/);
      expect(e.lastName).toMatch(/^[A-Za-z]+$/);
    }
  });

  test('surname ends with a 6-letter lowercase run id', () => {
    // WHY: the "last name missing" negative test relies on this format to
    // move the id into the first name (lastName.slice(-6)).
    const e = buildEmployee();
    expect(e.lastName.slice(-6)).toMatch(/^[a-z]{6}$/);
  });

  test('1,000 employees in a row all have unique surnames and emails', () => {
    // WHY: uniqueness is what stops scenario 3 passing on old data in the
    // shared sandbox. 1,000 is far more than any run creates.
    const people = Array.from({ length: 1000 }, () => buildEmployee());
    expect(new Set(people.map((p) => p.lastName)).size).toBe(1000);
    expect(new Set(people.map((p) => p.email)).size).toBe(1000);
  });

  test('email is valid by the HTML standard, lowercase, and on @example.com', () => {
    // WHY @example.com: reserved for testing (RFC 2606) - no real inbox.
    for (let i = 0; i < 200; i++) {
      const { email } = buildEmployee();
      expect(email).toMatch(HTML_EMAIL_PATTERN);
      expect(email).toBe(email.toLowerCase());
      expect(email.endsWith('@example.com')).toBe(true);
    }
  });

  test('phone is a UK mobile number: 07 followed by 9 digits', () => {
    for (let i = 0; i < 200; i++) {
      expect(buildEmployee().phoneNumber).toMatch(/^07\d{9}$/);
    }
  });

  test('start date is in the past, within the last 20 days', () => {
    // WHY: future start dates may be rejected; a date far in the past could
    // fall outside the calendar month shown by the date picker.
    const now = Date.now();
    const twentyDaysMs = 20 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 200; i++) {
      const t = buildEmployee().startDate.getTime();
      expect(t).toBeLessThanOrEqual(now);
      expect(t).toBeGreaterThanOrEqual(now - twentyDaysMs - 1000);
    }
  });

  test('overrides replace only the fields given; the rest are still generated', () => {
    const e = buildEmployee({ email: 'not-an-email', firstName: '   ' });
    expect(e.email).toBe('not-an-email');
    expect(e.firstName).toBe('   ');
    expect(e.lastName).toMatch(/^[A-Za-z]+$/);
    expect(e.phoneNumber).toMatch(/^07\d{9}$/);
  });

  test('each call returns a new object (no shared state between tests)', () => {
    const a = buildEmployee();
    const b = buildEmployee();
    expect(a).not.toBe(b);
    expect(a.lastName).not.toBe(b.lastName);
  });
});

test.describe('fullName()', { tag: '@unit' }, () => {
  test('joins first and last name with one space', () => {
    const e = buildEmployee({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(fullName(e)).toBe('Ada Lovelace');
  });
});

test.describe('ukDate()', { tag: '@unit' }, () => {
  /**
   * WHY table-driven: date formatting bugs hide in edge cases - single-digit
   * days/months, month ends, year ends, leap days. Each row is one case.
   * Dates are built from parts (year, monthIndex, day) so the test is the
   * same in every timezone.
   */
  const cases: Array<[string, Date, string]> = [
    ['pads single-digit day and month', new Date(2026, 0, 5), '05/01/2026'],
    ['double-digit day and month', new Date(2026, 10, 23), '23/11/2026'],
    ['last day of the year', new Date(2026, 11, 31), '31/12/2026'],
    ['first day of the year', new Date(2027, 0, 1), '01/01/2027'],
    ['leap day', new Date(2028, 1, 29), '29/02/2028'],
  ];
  for (const [name, date, expected] of cases) {
    test(`${name} -> ${expected}`, () => {
      expect(ukDate(date)).toBe(expected);
    });
  }

  test('always produces DD/MM/YYYY', () => {
    for (let i = 0; i < 200; i++) {
      expect(ukDate(buildEmployee().startDate)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });
});
