import { faker } from '@faker-js/faker';

/** Every field the "Add employee" form accepts, required and optional. */
export interface Employee {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  startDate: Date;
  jobTitle: string;
}

/**
 * Builds a unique employee on every call.
 *
 * The sandbox account is shared and never reset, so a fixed name like
 * "John Smith" would already exist from an earlier run and scenario 3 could
 * pass on old data. A random run id in the surname means we only ever find
 * the employees this run created.
 */
export function buildEmployee(overrides: Partial<Employee> = {}): Employee {
  // Letters only, in case the name fields reject digits.
  const runId = faker.string.alpha({ length: 6, casing: 'lower' });
  const firstName = faker.person.firstName().replace(/[^A-Za-z]/g, '');
  const lastName = `${faker.person.lastName().replace(/[^A-Za-z]/g, '')}${runId}`;

  return {
    firstName,
    lastName,
    // example.com is reserved for testing (RFC 2606), so no real inbox receives mail.
    email: `qa.${firstName}.${runId}@example.com`.toLowerCase(),
    phoneNumber: `07${faker.string.numeric(9)}`, // UK mobile format
    startDate: faker.date.recent({ days: 20 }), // past dates are always valid
    jobTitle: faker.person.jobTitle(),
    ...overrides,
  };
}

export const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

/** DD/MM/YYYY, the format BrightHR displays and accepts. */
export const ukDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
