import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from "adhan";
import {
  PRAYERS,
  type CalcConfig,
  type IqamahRule,
  type JumuahSession,
  type Masjid,
  type Prayer,
} from "./types";
import { clockMinutes, todayIn, zonedTimeOnDate } from "./time";

type MethodKey = keyof typeof CalculationMethod;

const DEFAULT_METHOD: MethodKey = "NorthAmerica";

/**
 * Build adhan's parameters from a masjid's `calc` block. `method` comes from
 * JSON a scraper writes, so an unknown value falls back rather than throwing.
 */
function parametersFor(calc: CalcConfig): CalculationParameters {
  const key = (
    calc.method in CalculationMethod ? calc.method : DEFAULT_METHOD
  ) as MethodKey;

  if (key !== calc.method) {
    console.warn(
      `Unknown calculation method "${calc.method}" — using ${DEFAULT_METHOD}.`,
    );
  }

  const params = CalculationMethod[key]();
  params.madhab = calc.madhab === "shafi" ? Madhab.Shafi : Madhab.Hanafi;

  if (calc.adjustments) {
    params.adjustments = { ...params.adjustments, ...calc.adjustments };
  }

  return params;
}

/** What the calculation needs: somewhere, and how to calculate for it. */
export type Place = Pick<Masjid, "lat" | "lng" | "calc">;

function solve(place: Place, date: Date): PrayerTimes {
  const coords = new Coordinates(place.lat, place.lng);
  return new PrayerTimes(coords, date, parametersFor(place.calc));
}

const adhanOf = (t: PrayerTimes): Record<Prayer, Date> => ({
  fajr: t.fajr,
  dhuhr: t.dhuhr,
  asr: t.asr,
  maghrib: t.maghrib,
  isha: t.isha,
});

/**
 * Astronomically calculated adhan times for one masjid on one day.
 * Pure math, no network — see CLAUDE.md §2.
 */
export function adhanTimes(
  place: Place,
  date: Date = todayIn(),
): Record<Prayer, Date> {
  return adhanOf(solve(place, date));
}

/** Sunrise closes the Fajr window; useful on the detail view. */
export function sunriseTime(place: Place, date: Date = todayIn()): Date {
  return solve(place, date).sunrise;
}

/**
 * Downtown Toronto — the app's default reference point (CLAUDE.md §9).
 *
 * Adhan is near enough identical across the city (§2) that one place can
 * stand for all of it, so the prayer strip, the answer card's adhan, the
 * prayer windows and the map's header all read their times from here. They
 * used to read them from whichever masjid happened to be first in the
 * directory, which quietly made the whole app's Asr that masjid's school.
 */
export const CITY_CENTRE = { lat: 43.6532, lng: -79.3832 };

/** The city's adhan, calculated for one school's Asr. */
export function cityReference(madhab: CalcConfig["madhab"]): Place {
  return { ...CITY_CENTRE, calc: { method: DEFAULT_METHOD, madhab } };
}

/**
 * When each prayer's time runs out — the latest its congregation could
 * begin. Fajr ends at sunrise and every other prayer when the next one's
 * adhan is called. Isha runs on to Fajr and has no bound here.
 */
function windowEnds(t: PrayerTimes): Record<Prayer, Date | null> {
  return {
    fajr: t.sunrise,
    dhuhr: t.asr,
    asr: t.maghrib,
    maghrib: t.isha,
    isha: null,
  };
}

/**
 * Resolve one iqamah rule to an instant — CLAUDE.md §7.
 *
 * `fixed` is a wall-clock time the masjid sets; `offset` is N minutes after
 * that prayer's adhan (how Maghrib is almost always run). Returns null when
 * there is no rule or the stored time is malformed, so callers show "—"
 * rather than a wrong time.
 */
export function iqamahTime(
  rule: IqamahRule | undefined,
  adhan: Date,
  date: Date = todayIn(),
  /** When this prayer's time is over; see `windowEnds`. */
  windowEnd: Date | null = null,
): Date | null {
  if (!rule) return null;
  const at =
    rule.type === "offset"
      ? new Date(adhan.getTime() + rule.minutes * 60_000)
      : zonedTimeOnDate(date, rule.time);
  if (!at) return null;
  // §14, at display time. The scraper refuses an iqamah earlier than its own
  // adhan, but only on the day it reads the page; a fixed time then drifts as
  // the adhan moves through the season. When the scrape stalled for three
  // weeks in September 2026, 36 masjids ended up showing a Fajr jamaah before
  // Fajr had begun. A time that cannot be right shows "—" instead, and the
  // next successful read brings the real one back.
  if (
    rule.type === "fixed" &&
    at.getTime() < adhan.getTime() - IMPOSSIBLE_BEFORE_ADHAN_MINUTES * 60_000
  ) {
    return null;
  }
  // The same drift from the other side. The same stall left a masjid's
  // August Asr of 7:15 PM on file after sunset had moved to 7:01, and Home
  // listed it as a congregation still to catch. No rounding slack here:
  // masjids schedule well inside a prayer's time, never minutes from its end.
  if (windowEnd && at.getTime() >= windowEnd.getTime()) return null;
  return at;
}

/**
 * The same tolerance scrape.ts uses: masjids round their published times, so
 * an iqamah a minute or two before the calculated adhan is rounding, not error.
 */
export const IMPOSSIBLE_BEFORE_ADHAN_MINUTES = 3;

/**
 * The prayer worth showing first: the earliest one that still has an iqamah
 * ahead of `now` at any masjid in the list. Falls back to Fajr once the day's
 * congregations are all done.
 */
export function nextIqamahPrayer(
  masjids: Masjid[],
  date: Date = todayIn(),
  now: Date = new Date(),
): Prayer {
  const schedules = masjids.map((m) => iqamahTimes(m, date));

  return (
    PRAYERS.find((prayer) =>
      schedules.some((times) => {
        const time = times[prayer];
        return time != null && time.getTime() > now.getTime();
      }),
    ) ?? "fajr"
  );
}

/**
 * Maghrib is prayed a few minutes after sunset almost everywhere, so a masjid
 * with no recorded Maghrib is far better served by this than by a blank. It is
 * a floor, not a claim: any real value — scraped, entered, or suggested and
 * approved — replaces it.
 */
export const DEFAULT_MAGHRIB_OFFSET_MINUTES = 2;

/**
 * The rule actually used for a prayer, and whether it came from the data or
 * from the Maghrib fallback. Callers that display a time need the distinction
 * so a default is never dressed up as something a masjid confirmed.
 */
export function effectiveRule(
  masjid: Masjid,
  prayer: Prayer,
): { rule: IqamahRule | undefined; isDefault: boolean } {
  const stored = masjid.iqamah[prayer];
  if (stored) return { rule: stored, isDefault: false };

  if (prayer === "maghrib") {
    return {
      rule: { type: "offset", minutes: DEFAULT_MAGHRIB_OFFSET_MINUTES },
      isDefault: true,
    };
  }

  return { rule: undefined, isDefault: false };
}

/**
 * A masjid's Friday sittings, earliest first.
 *
 * The stored order cannot be trusted: a scrape reads a page in whatever order
 * the markup happens to run, and a manually entered or approved time is
 * appended wherever it lands. Masjid Bilal is on file right now as 15:30 then
 * 14:00. Anything that numbers the sittings — "1st khutbah", "2 of 3" — is
 * making a claim about time, so it has to sort by time rather than trust the
 * array, or it will tell someone the 3:30 sitting is the first one.
 *
 * Malformed times sort last rather than being dropped: the detail view should
 * still show a time a human can read and correct.
 */
export function orderedJumuah(masjid: Masjid): JumuahSession[] {
  return [...(masjid.jumuah ?? [])].sort((a, b) => {
    const left = clockMinutes(a.khutbah);
    const right = clockMinutes(b.khutbah);
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    return left - right;
  });
}

/** Every iqamah a masjid holds on `date`, keyed by prayer. */
export function iqamahTimes(
  masjid: Masjid,
  date: Date = todayIn(),
): Record<Prayer, Date | null> {
  // Resolved and checked on the masjid's own school, never the visitor's. A
  // Hanafi preference used to recalculate a standard masjid's Asr adhan most
  // of an hour later, and iqamahTime's before-adhan check then threw out its
  // real congregation — 11 of 58 standard masjids lost their Asr outright in
  // September 2026, instead of showing it with the other-school note §10.1
  // designed for exactly them.
  const own = masjid.calc.ownMadhab
    ? { ...masjid, calc: { ...masjid.calc, madhab: masjid.calc.ownMadhab } }
    : masjid;
  const times = solve(own, date);
  const adhan = adhanOf(times);
  const ends = windowEnds(times);

  return Object.fromEntries(
    PRAYERS.map((prayer) => [
      prayer,
      iqamahTime(effectiveRule(masjid, prayer).rule, adhan[prayer], date, ends[prayer]),
    ]),
  ) as Record<Prayer, Date | null>;
}
