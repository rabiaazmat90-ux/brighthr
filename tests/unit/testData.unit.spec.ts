import { test, expect } from '@playwright/test';
import { LOGIN_URL } from '../../pages/LoginPage';
import {
  HTML_EMAIL_PATTERN,
  INVALID_EMAILS,
  INVALID_PHONES,
  NON_PHONE_CHARACTERS,
  OVERLONG_NAME,
  XSS_PAYLOAD,
} from '../../utils/testData';

/**
 * UNIT TESTS - negative test data and URL rules
 * ---------------------------------------------
 * WHY "test the tests": a negative test is only meaningful if its input is
 * genuinely invalid. If "two@@example.com" were actually valid, the
 * "email is blocked" test would be asserting the wrong thing. These checks
 * prove the data is correct before the slow browser suite relies on it.
 */

test.describe('HTML_EMAIL_PATTERN', { tag: '@unit' }, () => {
  test('accepts ordinary valid emails', () => {
    for (const ok of ['a@b.co', 'qa.tester@example.com', 'first+tag@sub.example.co.uk']) {
      expect(ok, `${ok} should be valid`).toMatch(HTML_EMAIL_PATTERN);
    }
  });
});

test.describe('INVALID_EMAILS', { tag: '@unit' }, () => {
  for (const { value, rule } of INVALID_EMAILS) {
    test(`"${value}" is really invalid (${rule})`, () => {
      expect(value).not.toMatch(HTML_EMAIL_PATTERN);
    });
  }

  test('every entry is unique (no wasted duplicate tests)', () => {
    expect(new Set(INVALID_EMAILS.map((e) => e.value)).size).toBe(INVALID_EMAILS.length);
  });
});

test.describe('INVALID_PHONES', { tag: '@unit' }, () => {
  for (const { value, rule } of INVALID_PHONES) {
    test(`"${value}" really contains non-phone characters (${rule})`, () => {
      expect(value).toMatch(NON_PHONE_CHARACTERS);
    });
  }

  test('a real UK mobile number does NOT trip the non-phone check', () => {
    // Guards against a pattern so broad it would flag valid numbers too.
    expect('07123456789').not.toMatch(NON_PHONE_CHARACTERS);
    expect('+44 7123 456789').not.toMatch(NON_PHONE_CHARACTERS);
  });
});

test.describe('Boundary and security data', { tag: '@unit' }, () => {
  test('OVERLONG_NAME is exactly 256 characters (one over 255)', () => {
    expect(OVERLONG_NAME).toHaveLength(256);
  });

  test('XSS_PAYLOAD contains an HTML tag and an event handler', () => {
    expect(XSS_PAYLOAD).toMatch(/<img/i);
    expect(XSS_PAYLOAD).toMatch(/onerror=/i);
  });
});

test.describe('LOGIN_URL', { tag: '@unit' }, () => {
  /**
   * WHY: the positive login check is "we are NOT on a login URL any more".
   * If this pattern accidentally matched a normal app page, a successful
   * login would look like a failure - or the reverse.
   */
  const loginUrls = [
    'https://sandbox-login.brighthr.com/connect/authorize?client_id=x',
    'https://sandbox-app.brighthr.com/login',
    'https://example.com/Account/Login?returnUrl=/',
  ];
  const appUrls = [
    'https://sandbox-app.brighthr.com/',
    'https://sandbox-app.brighthr.com/dashboard',
    'https://sandbox-app.brighthr.com/employee-hub',
    'https://sandbox-app.brighthr.com/lite',
  ];

  for (const url of loginUrls) {
    test(`matches a login URL: ${url}`, () => {
      expect(url).toMatch(LOGIN_URL);
    });
  }
  for (const url of appUrls) {
    test(`does NOT match an app URL: ${url}`, () => {
      expect(url).not.toMatch(LOGIN_URL);
    });
  }
});
