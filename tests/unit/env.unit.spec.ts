import { test, expect } from '@playwright/test';
import { requireEnv } from '../../utils/env';

/**
 * UNIT TESTS - requireEnv() (utils/env.ts)
 * ----------------------------------------
 * WHY: a missing secret is the most common CI failure. requireEnv must fail
 * fast with a helpful message instead of a confusing "element not found".
 *
 * WHY a unique variable name per test run: these tests change process.env,
 * so we use names no real config uses, and delete them afterwards so no
 * other test is affected (test isolation).
 */
const VAR = `UNIT_TEST_VAR_${process.pid}`;

test.describe('requireEnv()', { tag: '@unit' }, () => {
  test.afterEach(() => {
    delete process.env[VAR];
  });

  test('returns the value when it is set', () => {
    process.env[VAR] = 'hello';
    expect(requireEnv(VAR)).toBe('hello');
  });

  test('trims spaces around the value (common copy-paste mistake)', () => {
    process.env[VAR] = '  qa@example.com  ';
    expect(requireEnv(VAR)).toBe('qa@example.com');
  });

  test('throws when the variable is missing', () => {
    expect(() => requireEnv(VAR)).toThrow();
  });

  test('throws when the variable is empty', () => {
    process.env[VAR] = '';
    expect(() => requireEnv(VAR)).toThrow();
  });

  test('throws when the variable is only spaces', () => {
    process.env[VAR] = '   ';
    expect(() => requireEnv(VAR)).toThrow();
  });

  test('error message names the variable and says how to fix it', () => {
    // WHY: the message is the whole point - whoever sees it must know what to do.
    expect(() => requireEnv(VAR)).toThrow(VAR);
    expect(() => requireEnv(VAR)).toThrow(/\.env/);
    expect(() => requireEnv(VAR)).toThrow(/Secrets/);
  });
});
