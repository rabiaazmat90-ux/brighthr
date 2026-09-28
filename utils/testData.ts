/**
 * Shared test data for the negative tests.
 *
 * WHY a separate file: the browser tests USE this data, and the unit tests
 * PROVE it is correct (e.g. every "invalid email" really is invalid). If the
 * data were buried inside a spec file, nobody could check it without
 * running the slow browser suite.
 */

/**
 * The email pattern from the WHATWG HTML standard - the exact rule browsers
 * apply to <input type="email">. Using the official rule means our idea of
 * "valid" and "invalid" matches the platform, not personal opinion.
 * Source: https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
 */
export const HTML_EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Each value breaks a DIFFERENT email rule, so failures are specific. */
export const INVALID_EMAILS = [
  { value: 'not-an-email', rule: 'has no @ and no domain' },
  { value: 'missing-domain@', rule: 'has nothing after the @' },
  { value: '@missing-name.com', rule: 'has nothing before the @' },
  { value: 'two@@example.com', rule: 'has two @ signs' },
  { value: 'has space@example.com', rule: 'contains a space' },
] as const;

/** Phone values containing characters no phone number can have. */
export const INVALID_PHONES = [
  { value: 'abc-not-a-phone', rule: 'contains letters' },
  { value: '!!!###$$$', rule: 'contains only symbols' },
] as const;

/** Characters that must never survive in a phone field after filtering. */
export const NON_PHONE_CHARACTERS = /[a-z!#$]/i;

/** 256 characters: one over the common 255-character database limit. */
export const OVERLONG_NAME = 'A'.repeat(256);

/** A classic XSS probe: harmless text if escaped, an alert() if executed. */
export const XSS_PAYLOAD = '<img src=x onerror=alert("xss")>';
