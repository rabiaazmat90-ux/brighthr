import { faker } from '@faker-js/faker';

/** Everything the "Add employee" form accepts, required and optional. */
export interface Employee {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  startDate: Date;
  jobTitle: string;
}

/**
 * Builds a unique employee for every call.
 *
 * WHY generated data (test data builder pattern):
 *  - The sandbox account is SHARED and never reset. Fixed names like
 *    "John Smith" would already exist after the first run, so scenario 3
 *    could "pass" by finding an employee from yesterday - a false positive.
 *  - A short unique run id in the surname guarantees we verify the exact
 *    employees THIS run created, and emails never clash if the app enforces
 *    unique email addresses.
 * ALTERNATIVE: a static JSON fixture file is easier to read but only works if
 * the data is wiped before each run, which we cannot do on this sandbox.
 */
export function buildEmployee(overrides: Partial<Employee> = {}): Employee {
  // 6 random lowercase letters = ~300 million combinations, so two runs will
  // not collide. Letters only because name fields may reject digits.
  const runId = faker.string.alpha({ length: 6, casing: 'lower' });
  const firstName = faker.person.firstName().replace(/[^A-Za-z]/g, '');
  // e.g. "Smithqkzvra" - a real-looking surname with the unique id attached.
  const lastName = `${faker.person.lastName().replace(/[^A-Za-z]/g, '')}${runId}`;

  return {
    firstName,
    lastName,
    /**
     * WHY @example.com: it is a domain reserved for testing (RFC 2606), so if
     * BrightHR ever sends an invite email it goes nowhere instead of to a
     * real person.
     */
    email: `qa.${firstName}.${runId}@example.com`.toLowerCase(),
    /** UK mobile format (07 + 9 digits) so any phone validation accepts it. */
    phoneNumber: `07${faker.string.numeric(9)}`,
    /**
     * WHY a recent past date: start dates in the past are always valid;
     * a future date could be rejected or treated differently by the app.
     */
    startDate: faker.date.recent({ days: 20 }),
    jobTitle: faker.person.jobTitle(),
    ...overrides,
  };
}

export const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

/** DD/MM/YYYY - the UK format BrightHR displays and accepts. */
export const ukDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
