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

/** "4:45 AM" */
export function formatTime(date: Date, timeZone: string = TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
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
