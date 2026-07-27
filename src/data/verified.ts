/**
 * What counts as a verified date.
 *
 * This exists because `if (block.verified)` is wrong, and wrong in a way that
 * ships silently. The string "null" is truthy. So is "", well, no — but
 * "not yet", "TBD", "2026-13-45" and every other typo are. A file edited by
 * hand with `"verified": "null"` instead of `"verified": null` passed every
 * check we had and published a page with an Invalid Date on it.
 *
 * Truthiness is the wrong test for a date. Parsing is the right one.
 */

/** Parse a verified date, or return null if it isn't one.
 *  Accepts YYYY-MM-DD only — anything looser lets a typo through. */
export function parseVerified(value: unknown): Date | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const d = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;

  // new Date('2026-02-31') silently rolls to March. Round-trip to catch it.
  if (d.toISOString().slice(0, 10) !== trimmed) return null;

  // A future verification date means someone typed a date they hadn't reached.
  if (d.getTime() > Date.now()) return null;

  return d;
}

export const isVerifiedDate = (value: unknown): boolean => parseVerified(value) !== null;

/** A data block worth rendering: an object with a genuinely parseable date. */
export function isVerifiedBlock(block: unknown): boolean {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
  return isVerifiedDate((block as Record<string, unknown>).verified);
}

/** Blocks in an airline file that carry a real verified date. */
export function verifiedBlocks(data: Record<string, any>): [string, any][] {
  return Object.entries(data).filter(([, b]) => isVerifiedBlock(b));
}

/** Has this carrier had at least one figure actually checked? */
export const hasVerifiedData = (data: Record<string, any>): boolean =>
  verifiedBlocks(data).length > 0;

export const daysSinceVerified = (value: unknown): number | null => {
  const d = parseVerified(value);
  return d ? Math.floor((Date.now() - d.getTime()) / 86_400_000) : null;
};
