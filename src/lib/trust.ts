/**
 * How much to trust a masjid's stored times — CLAUDE.md §14.
 *
 * Iqamah times are community-collected, and a masjid that changed its
 * schedule two months ago looks exactly like one confirmed this morning
 * unless the age is shown. Wrong times can make someone miss a prayer, so
 * age is part of the time, not decoration around it.
 */
import { adhanTimes, iqamahTimes } from "./prayer";
import type { Masjid, Prayer } from "./types";


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
 *
 * A date in the future counts too. It can only come from a bad write, and a
 * bad write is the last thing that should read as freshly confirmed.
 */
export function isStale(
  lastVerified: string | null | undefined,
  today: Date,
): boolean {
  const days = daysSinceVerified(lastVerified, today);
  return days == null || days < 0 || days > STALE_AFTER_DAYS;
}

/**
 * The four freshness states — design spec v2 §5.
 *
 * v2 tightens the stale threshold from 45 days to 14 and adds a "recent"
 * middle state, so the label carries the age rather than just a pass/fail.
 * STALE_AFTER_DAYS above is kept for the older trustStatus() callers until
 * they are migrated.
 */
export type FreshnessLevel = "verified" | "recent" | "stale" | "none";

export const RECENT_AFTER_DAYS = 14;

export interface Freshness {
  level: FreshnessLevel;
  label: string;
}

/** "2 Jun" — for a stale date, which reads better than "73 days ago". */
function shortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function freshness(
  masjid: { lastVerified: string | null; iqamah?: Record<string, unknown> },
  today: Date,
): Freshness {
  // Nothing collected at all outranks any date: the times on screen are
  // calculated adhan, not a masjid's decision, and that is the thing worth
  // saying (§5).
  const collected = Object.keys(masjid.iqamah ?? {}).length > 0;
  if (!collected) return { level: "none", label: "No iqamah times yet" };

  const days = daysSinceVerified(masjid.lastVerified, today);
  if (days == null || days < 0) {
    return { level: "none", label: "No iqamah times yet" };
  }
  if (days === 0) return { level: "verified", label: "Checked today" };
  if (days <= RECENT_AFTER_DAYS) {
    return {
      level: "recent",
      label: days === 1 ? "Checked yesterday" : `Checked ${days} days ago`,
    };
  }
  return {
    level: "stale",
    label: `Last checked ${shortDate(masjid.lastVerified!)}`,
  };
}

/**
 * Whether a masjid's stored iqamah lands before the adhan the *visitor's*
 * school calculates — design spec v2 §10.1.
 *
 * Real and visible today: with Hanafi Asr selected, Masjid Toronto shows an
 * iqamah of 6:00 PM against an adhan of 6:20 PM, and counts down to a
 * congregation that by the visitor's own calculation has not begun. The
 * masjid follows the standard school; the visitor does not. Neither is wrong,
 * and the app must not present it as an error — it should say which school is
 * in play and count against the masjid's own adhan.
 *
 * Only Asr can do this: it is the one prayer whose calculation depends on the
 * school, so a mismatch anywhere else would be a data error rather than a
 * difference of madhab, and is deliberately not swallowed by this note.
 */
export function asrSchoolMismatch(
  masjid: Masjid,
  prayer: Prayer,
  today: Date,
): boolean {
  if (prayer !== "asr") return false;

  const iqamah = iqamahTimes(masjid, today).asr;
  if (!iqamah) return false;

  // The comparison that matters is against the adhan the visitor is being
  // shown, which applyAsrPreference may already have rewritten. An iqamah
  // before it is the symptom; the two schools are the cause.
  return iqamah < adhanTimes(masjid, today).asr;
}

/**
 * The adhan a countdown for this row should run against.
 *
 * Normally the visitor's own — but when their school puts Asr later than the
 * masjid's own congregation, counting down to the visitor's adhan would be
 * counting down to a jamaah that has already happened. §10.1: use the
 * masjid's.
 */
export function countdownAdhan(
  masjid: Masjid,
  prayer: Prayer,
  today: Date,
): Date {
  const shown = adhanTimes(masjid, today)[prayer];
  if (!asrSchoolMismatch(masjid, prayer, today)) return shown;

  const standard: Masjid = {
    ...masjid,
    calc: { ...masjid.calc, madhab: "shafi" },
  };
  return adhanTimes(standard, today)[prayer];
}

export type TrustLevel = "unverified" | "stale" | "flagged" | "checked";

export interface TrustStatus {
  level: TrustLevel;
  /** Wording for a badge or an inline note. */
  label: string;
  /** True when this is a warning rather than reassurance. */
  warn: boolean;
}

/**
 * One verdict on a masjid's record, so every view words it the same way.
 *
 * Age leads, because age is the thing a visitor cannot otherwise see. The
 * scraper's `needsReview` flag is deliberately ranked *below* it and phrased
 * softly: it is set whenever any single field failed to read, which today
 * means 15 of 32 masjids, 9 of them verified this morning and missing only
 * Maghrib — a gap the app already fills and labels on the row itself.
 * Branding half the directory "unconfirmed" over that would teach people to
 * ignore the badge, which is worse than not having one.
 */
export function trustStatus(
  masjid: { lastVerified: string | null; needsReview?: boolean },
  today: Date,
): TrustStatus {
  const days = daysSinceVerified(masjid.lastVerified, today);

  if (days == null || days < 0) {
    return { level: "unverified", label: "Not verified yet", warn: true };
  }
  if (days > STALE_AFTER_DAYS) {
    return { level: "stale", label: `Checked ${days} days ago`, warn: true };
  }
  if (masjid.needsReview) {
    return { level: "flagged", label: "Partly confirmed", warn: false };
  }
  return {
    level: "checked",
    label: `Checked ${verifiedAgo(masjid.lastVerified, today)}`,
    warn: false,
  };
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
