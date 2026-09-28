/**
 * Patterns for checking values the app may *display* differently from how
 * they were typed, e.g. "07123 456789" or "5 Sept 2026".
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** A UK mobile number typed as 07xxxxxxxxx, shown with or without spaces or as +44. */
export function phonePattern(phone: string): RegExp {
  const rest = phone.slice(1).split('').join('\\s?');
  return new RegExp(`(?:0|\\+44\\s?)${rest}`);
}

/** A date shown as DD/MM/YYYY, "5 Sep 2026", "5 Sept 2026", "5th September 2026", etc. */
export function datePattern(d: Date): RegExp {
  const day = d.getDate();
  const dd = String(day).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const month = MONTHS[d.getMonth()];
  const monthText = `${month.slice(0, 3)}(?:${month.slice(3)}|t)?\\.?`;
  return new RegExp(`${dd}/${mm}/${yyyy}|\\b0?${day}(?:st|nd|rd|th)?\\s+${monthText},?\\s+${yyyy}`, 'i');
}
