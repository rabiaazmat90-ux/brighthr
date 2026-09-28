/**
 * Test data for the negative tests. Kept separate so the unit tests can
 * prove each "invalid" value really is invalid.
 */

/** The WHATWG HTML standard's rule for <input type="email">.
 *  https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address */
export const HTML_EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Each value breaks a different email rule, so a failure names the rule. */
export const INVALID_EMAILS = [
  { value: 'not-an-email', rule: 'has no @ and no domain' },
  { value: 'missing-domain@', rule: 'has nothing after the @' },
  { value: '@missing-name.com', rule: 'has nothing before the @' },
  { value: 'two@@example.com', rule: 'has two @ signs' },
  { value: 'has space@example.com', rule: 'contains a space' },
] as const;

export const INVALID_PHONES = [
  { value: 'abc-not-a-phone', rule: 'contains letters' },
  { value: '!!!###$$$', rule: 'contains only symbols' },
] as const;

/** Characters that must never survive in a phone field. */
export const NON_PHONE_CHARACTERS = /[a-z!#$]/i;

/** One over the common 255-character database column limit. */
export const OVERLONG_NAME = 'A'.repeat(256);

/** Harmless text if escaped; fires alert() if rendered as HTML. */
export const XSS_PAYLOAD = '<img src=x onerror=alert("xss")>';

/** Real names that systems often wrongly reject. All of these must be accepted. */
export const REAL_WORLD_NAMES = [
  { firstName: 'Anne-Marie', lastName: "O'Brien", why: 'a hyphen and an apostrophe' },
  { firstName: 'José', lastName: 'Núñez', why: 'accented letters' },
] as const;

/** Upper bound when searching for the first-name length limit. */
export const NAME_LENGTH_SEARCH_LIMIT = OVERLONG_NAME.length;
