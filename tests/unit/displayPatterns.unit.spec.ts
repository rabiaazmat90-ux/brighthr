import { test, expect } from '@playwright/test';
import { datePattern, phonePattern } from '../../utils/displayPatterns';

/**
 * The profile check relies on these patterns, so prove they accept the
 * display formats we expect and reject near misses.
 */
test.describe('phonePattern()', { tag: '@unit' }, () => {
  const pattern = phonePattern('07123456789');

  for (const shown of ['07123456789', '07123 456789', '07123 456 789', '+44 7123 456789', '+447123456789']) {
    test(`matches "${shown}"`, () => {
      expect(shown).toMatch(pattern);
    });
  }

  test('does not match a different number', () => {
    expect('07123456780').not.toMatch(pattern);
  });
});

test.describe('datePattern()', { tag: '@unit' }, () => {
  const pattern = datePattern(new Date(2026, 8, 5)); // 5 September 2026

  for (const shown of ['05/09/2026', '5 Sep 2026', '5 Sept 2026', '5 September 2026', '05 Sep 2026', '5th September 2026', '5 Sep, 2026']) {
    test(`matches "${shown}"`, () => {
      expect(shown).toMatch(pattern);
    });
  }

  for (const shown of ['06/09/2026', '15 Sep 2026', '5 Oct 2026', '5 Sep 2025']) {
    test(`does not match "${shown}"`, () => {
      expect(shown).not.toMatch(pattern);
    });
  }
});
