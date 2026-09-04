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

/**
 * 12-hour, 24-hour, or whatever the device says.
 *
 * "system" is the default. A phone set to 24-hour time shows 13:45 in every
 * other app and on this app's own home-screen widget, so the app printing
 * "1:45 PM" on the same screen was the odd one out. The device's preference
 * is read from the runtime's default locale, which on iOS follows the
 * Settings toggle; the explicit choices are for anyone who wants the other.
 */
export type ClockFormat = "system" | "12h" | "24h";

let clockFormat: ClockFormat = "system";

/** Set once by SettingsProvider; every formatter below reads it. */
export function setClockFormat(format: ClockFormat): void {
  clockFormat = format;
}

/** Whether times should print as 12-hour under the current preference. */
export function twelveHour(): boolean {
  if (clockFormat !== "system") return clockFormat === "12h";
  const cycle = new Intl.DateTimeFormat(undefined, { hour: "numeric" })
    .resolvedOptions().hourCycle;
  return cycle !== "h23" && cycle !== "h24";
}

/** "4:45 AM", or "04:45" on a 24-hour clock. */
export function formatTime(date: Date, timeZone: string = TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: twelveHour() ? "h12" : "h23",
  }).format(date);
}

/**
 * "4:45" — the same clock without its meridiem.
 *
 * For the five-across grids only. At 375px each of those cells is about 67px
 * wide, and "12:15 PM" at body size does not fit, so the last column wrapped
 * or clipped. The prayer name above each cell already says which half of the
 * day it is; the AM/PM was carrying no information there.
 */
export function formatTimeShort(date: Date, timeZone: string = TZ): string {
  return formatTime(date, timeZone).replace(/\s*(AM|PM)$/i, "");
}

/**
 * "13:30" → "1:30 PM".
 *
 * For stored clock times that belong to a weekday rather than to today —
 * Friday's khutbah, say — where turning the string into a Date first would
 * mean inventing a date it does not have. Malformed input is returned
 * unchanged rather than silently becoming a plausible wrong time.
 */
export function formatClock(hhmm: string): string {
  const minutes = clockMinutes(hhmm);
  if (minutes == null) return hhmm;

  const hours24 = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, "0");
  if (!twelveHour()) return `${String(hours24).padStart(2, "0")}:${mm}`;
  const hours12 = hours24 % 12 || 12;
  const suffix = hours24 < 12 ? "AM" : "PM";
  return `${hours12}:${mm} ${suffix}`;
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
