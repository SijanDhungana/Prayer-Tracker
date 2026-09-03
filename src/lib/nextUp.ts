/**
 * "Which congregation can I still make?" — the logic behind the home view.
 *
 * CLAUDE.md §8a. Pure and network-free, like tripPlan.ts and for the same
 * reason: deciding which prayer is next, and which masjids still have it
 * ahead of them, is arithmetic that should be exact and testable rather than
 * tangled up in rendering.
 */
import { haversineKm, type Point } from "./distance";
import {
  isFriday,
  jumuahTimesOn,
  nextJumuahTime,
  resolvePlanIqamah,
  type PlanPrayer,
} from "./planPrayer";
import { adhanTimes, effectiveRule } from "./prayer";
import { PRAYERS, type Masjid, type Prayer } from "./types";

/** A congregation that began this recently is still worth showing. */
export const JUST_STARTED_MINUTES = 20;

/**
 * The congregations held on `date`, in the order they happen.
 *
 * On a Friday the midday congregation is Jumu'ah, not Dhuhr — the masjid
 * holds one or the other, never both. Listing Dhuhr on a Friday would send
 * someone to a jamaah that isn't happening, so the slot is substituted
 * rather than added to.
 */
export function congregationSequence(date: Date): PlanPrayer[] {
  return PRAYERS.map((prayer) =>
    prayer === "dhuhr" && isFriday(date) ? "jumuah" : prayer,
  );
}

export interface Congregation {
  prayer: PlanPrayer;
  /** The calendar day these times belong to. */
  date: Date;
  /** True once today's congregations are done and this is tomorrow's Fajr. */
  isTomorrow: boolean;
}

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * The congregation the visitor is heading toward: the earliest one today
 * that some masjid still holds ahead of `now`.
 *
 * Once every masjid's Isha has passed, this rolls to *tomorrow's* Fajr
 * rather than naming today's. Today's Fajr is fifteen hours in the past by
 * then, and reporting it would render as a countdown running backwards.
 */
export function nextCongregation(
  masjids: Masjid[],
  today: Date,
  now: Date,
): Congregation {
  for (const prayer of congregationSequence(today)) {
    const anyAhead = masjids.some((masjid) => {
      const iqamah = resolvePlanIqamah(masjid, prayer, now, today);
      return iqamah != null && iqamah > now;
    });
    if (anyAhead) return { prayer, date: today, isTomorrow: false };
  }

  const tomorrow = addDays(today, 1);
  return {
    prayer: congregationSequence(tomorrow)[0],
    date: tomorrow,
    isTomorrow: true,
  };
}

/**
 * The adhan that opens a congregation's window. Jumu'ah runs in Dhuhr's
 * window, so that is the adhan it answers to — `adhanTimes` has no Jumu'ah
 * of its own to give.
 */
export function congregationAdhan(
  masjid: Masjid,
  prayer: PlanPrayer,
  date: Date,
): Date {
  const times = adhanTimes(masjid, date);
  return prayer === "jumuah" ? times.dhuhr : times[prayer];
}

export interface NextUpRow {
  masjid: Masjid;
  /** Null when this masjid has no time on file for this congregation. */
  iqamah: Date | null;
  adhan: Date;
  km: number;
  /** Minutes from now — negative once the congregation has begun. */
  minutesAway: number | null;
  /** Which sitting, when the congregation is a multi-sitting Jumu'ah. */
  sitting: { index: number; total: number } | null;
  /**
   * True when the time came from the Maghrib fallback rather than from the
   * masjid. Almost every masjid's Maghrib resolves through that default, so
   * without this the screen shows a wall of confident-looking times that
   * nobody actually collected.
   */
  assumed: boolean;
}

export function nextUpRows(
  masjids: Masjid[],
  congregation: Congregation,
  from: Point,
  now: Date,
): NextUpRow[] {
  const { prayer, date } = congregation;

  return masjids.map((masjid) => {
    const iqamah = resolvePlanIqamah(masjid, prayer, now, date);

    return {
      masjid,
      iqamah,
      adhan: congregationAdhan(masjid, prayer, date),
      km: haversineKm(from, masjid),
      minutesAway:
        iqamah == null ? null : (iqamah.getTime() - now.getTime()) / 60_000,
      sitting: sittingOf(masjid, prayer, date, iqamah),
      // Jumu'ah has no fallback rule — a masjid either published sittings or
      // it didn't — so only the daily prayers can be running on a default.
      assumed:
        prayer !== "jumuah" && effectiveRule(masjid, prayer as Prayer).isDefault,
    };
  });
}

/** "2 of 3" for a Jumu'ah sitting; null for anything with a single time. */
function sittingOf(
  masjid: Masjid,
  prayer: PlanPrayer,
  date: Date,
  iqamah: Date | null,
): { index: number; total: number } | null {
  if (prayer !== "jumuah" || iqamah == null) return null;

  const times = jumuahTimesOn(masjid, date);
  if (times.length < 2) return null;

  const index = times.findIndex((time) => time.getTime() === iqamah.getTime());
  return index === -1 ? null : { index: index + 1, total: times.length };
}

export interface NextUpGroups {
  /** Still ahead of you, soonest first — the answer to the question. */
  upcoming: NextUpRow[];
  /** Began within the last few minutes; you might still catch the jamaah. */
  justStarted: NextUpRow[];
  /** Long gone. */
  missed: NextUpRow[];
  /** No time on file for this congregation at all. */
  unknown: NextUpRow[];
}

export function groupRows(rows: NextUpRow[]): NextUpGroups {
  const groups: NextUpGroups = {
    upcoming: [],
    justStarted: [],
    missed: [],
    unknown: [],
  };

  for (const row of rows) {
    if (row.minutesAway == null) groups.unknown.push(row);
    else if (row.minutesAway > 0) groups.upcoming.push(row);
    else if (row.minutesAway >= -JUST_STARTED_MINUTES)
      groups.justStarted.push(row);
    else groups.missed.push(row);
  }

  // Soonest first; where two masjids share a minute, the nearer one is the
  // more useful answer.
  groups.upcoming.sort(
    (a, b) => a.minutesAway! - b.minutesAway! || a.km - b.km,
  );
  // Most recently begun first — the one you have the best chance of joining.
  groups.justStarted.sort(
    (a, b) => b.minutesAway! - a.minutesAway! || a.km - b.km,
  );
  groups.missed.sort((a, b) => a.km - b.km);
  groups.unknown.sort((a, b) => a.km - b.km);

  return groups;
}

/** "now", "in 12 min", "in 1 h 20 min". */
export function formatCountdown(minutes: number): string {
  const total = Math.round(minutes);
  if (total <= 0) return "now";
  if (total < 60) return `in ${total} min`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
}

/** "just now", "8 min ago" — for a congregation already under way. */
export function formatSince(minutes: number): string {
  const ago = Math.round(-minutes);
  return ago <= 0 ? "just now" : `${ago} min ago`;
}

/**
 * "in 12 min", "in 2 h 5 min", "now", "8 min ago", "2 h ago" — the one
 * relative-time formatter for every list row and card.
 *
 * Four screens each carried their own copy of this, and they had drifted:
 * only one of them handled the past at all, and that one printed "120 min
 * ago" because it never rolled minutes into hours in that direction. A
 * congregation that began two hours ago is exactly the case where a row
 * needs to read clearly as gone rather than as a large number to decode.
 */
export function formatRelative(minutes: number): string {
  const m = Math.round(minutes);
  if (m === 0) return "now";
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const rest = abs % 60;
  const span =
    abs < 60 ? `${abs} min` : rest === 0 ? `${h} h` : `${h} h ${rest} min`;
  return m > 0 ? `in ${span}` : `${span} ago`;
}

/**
 * Whether the next Jumu'ah sitting a masjid offers is still ahead of `now`.
 * Exported for the tests that pin the sitting-selection rule.
 */
export function hasUpcomingJumuah(
  masjid: Masjid,
  date: Date,
  now: Date,
): boolean {
  const next = nextJumuahTime(jumuahTimesOn(masjid, date), now);
  return next != null && next > now;
}
