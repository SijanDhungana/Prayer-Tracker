/**
 * How much to trust a masjid's stored times — CLAUDE.md §14.
 *
 * Iqamah times are community-collected, and a masjid that changed its
 * schedule two months ago looks exactly like one confirmed this morning
 * unless the age is shown. Wrong times can make someone miss a prayer, so
 * age is part of the time, not decoration around it.
 */

/** Past this, a stored time is old enough that it should say so out loud. */
export const STALE_AFTER_DAYS = 45;

/**
 * Whole days between a stored `lastVerified` and `today`, or null when the
 * masjid has never been verified or the stored value is malformed.
 *
 * Both sides are normalised through `Date.UTC` before subtracting: a plain
 * millisecond difference between local dates is off by an hour across a DST
 * boundary, which is enough to round a 45-day gap to 44 and quietly withhold
 * the warning on exactly the day it starts to matter.
 */
export function daysSinceVerified(
  lastVerified: string | null | undefined,
  today: Date,
): number | null {
  if (!lastVerified) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(lastVerified);
  if (!match) return null;

  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.floor((now - then) / 86_400_000);
}

/**
 * Whether a masjid's times are old enough to warn about. Never verified
 * counts as stale: "we have never checked this" is a weaker claim than "we
 * checked it two months ago", not a stronger one.
 */
export function isStale(
  lastVerified: string | null | undefined,
  today: Date,
): boolean {
  const days = daysSinceVerified(lastVerified, today);
  return days == null || days > STALE_AFTER_DAYS;
}

/** Short human phrasing for a verification age: "today", "3 days ago". */
export function verifiedAgo(
  lastVerified: string | null | undefined,
  today: Date,
): string | null {
  const days = daysSinceVerified(lastVerified, today);
  if (days == null) return null;
  // A negative age means the stored date is in the future — a bad write
  // rather than a fresh check, so it is not reported as freshness.
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
