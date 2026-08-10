/** Everything in v1 is Toronto, so times are always shown in Toronto's zone. */
export const TZ = "America/Toronto";

/**
 * The current calendar date in `timeZone`, as a Date at local midnight.
 *
 * `adhan` reads a date's year/month/day in the *runtime's* zone, so passing a
 * bare `new Date()` from a UTC machine (CI, or a traveller's laptop) computes
 * the wrong day's times after 8pm Toronto. This pins the day to Toronto and
 * leaves the components where adhan expects to find them.
 */
export function todayIn(timeZone: string = TZ, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return new Date(part("year"), part("month") - 1, part("day"));
}

/** Milliseconds `timeZone` is offset from UTC at a given instant. */
function offsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  // Intl renders hour 24 rather than 0 for midnight in some engines.
  const hour = part("hour") % 24;

  const asIfUTC = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    hour,
    part("minute"),
    part("second"),
  );

  return asIfUTC - instant.getTime();
}

/**
 * The instant at which the clock in `timeZone` reads `hhmm` ("HH:mm") on
 * `calendarDate` (a floating day from `todayIn`).
 *
 * A masjid's fixed iqamah of "13:45" means 1:45pm *in Toronto*. Using
 * `Date.setHours` would anchor it to the runtime's zone instead, so a UTC
 * machine would place it at 9:45am Toronto. Resolving the zone offset twice
 * keeps it right across DST changeovers, where the offset before and after
 * the instant differ.
 */
export function zonedTimeOnDate(
  calendarDate: Date,
  hhmm: string,
  timeZone: string = TZ,
): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const wallClock = Date.UTC(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    calendarDate.getDate(),
    hours,
    minutes,
  );

  const firstGuess = wallClock - offsetAt(new Date(wallClock), timeZone);
  const refined = wallClock - offsetAt(new Date(firstGuess), timeZone);
  return new Date(refined);
}

/**
 * Minutes past midnight on `timeZone`'s clock.
 *
 * Not `date.getHours()` — that reads the runtime's zone, which is only Toronto
 * by luck. Comparing a stored "HH:mm" against an instant has to happen on the
 * same clock or the comparison is meaningless.
 */
export function minutesOfDay(date: Date, timeZone: string = TZ): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return (part("hour") % 24) * 60 + part("minute");
}

/** Minutes past midnight for a stored "HH:mm", or null if malformed. */
export function clockMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** "4:45 AM" */
export function formatTime(date: Date, timeZone: string = TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * "August 10, 2026" from a stored ISO date like `lastVerified`.
 *
 * Parsed by hand because `new Date("2026-08-10")` is midnight *UTC*, which
 * renders as the previous day anywhere west of Greenwich — Toronto included.
 */
export function formatIsoDate(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * "Monday, August 10" for a calendar date from `todayIn`.
 *
 * Deliberately has no `timeZone`: `todayIn` returns a floating calendar day
 * pinned to the runtime's midnight, so re-projecting it into Toronto would
 * shift it back a day on a UTC machine. Only true instants (adhan/iqamah
 * times) get `formatTime`'s zone treatment.
 */
export function formatCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}
