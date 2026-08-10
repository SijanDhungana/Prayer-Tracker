import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from "adhan";
import { PRAYERS, type CalcConfig, type IqamahRule, type Masjid, type Prayer } from "./types";
import { todayIn, zonedTimeOnDate } from "./time";

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

/**
 * Astronomically calculated adhan times for one masjid on one day.
 * Pure math, no network — see CLAUDE.md §2.
 */
export function adhanTimes(
  masjid: Masjid,
  date: Date = todayIn(),
): Record<Prayer, Date> {
  const coords = new Coordinates(masjid.lat, masjid.lng);
  const t = new PrayerTimes(coords, date, parametersFor(masjid.calc));

  return {
    fajr: t.fajr,
    dhuhr: t.dhuhr,
    asr: t.asr,
    maghrib: t.maghrib,
    isha: t.isha,
  };
}

/** Sunrise closes the Fajr window; useful on the detail view. */
export function sunriseTime(masjid: Masjid, date: Date = todayIn()): Date {
  const coords = new Coordinates(masjid.lat, masjid.lng);
  return new PrayerTimes(coords, date, parametersFor(masjid.calc)).sunrise;
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
): Date | null {
  if (!rule) return null;
  if (rule.type === "offset") {
    return new Date(adhan.getTime() + rule.minutes * 60_000);
  }
  return zonedTimeOnDate(date, rule.time);
}

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

/** Every iqamah a masjid holds on `date`, keyed by prayer. */
export function iqamahTimes(
  masjid: Masjid,
  date: Date = todayIn(),
): Record<Prayer, Date | null> {
  const adhan = adhanTimes(masjid, date);

  return Object.fromEntries(
    PRAYERS.map((prayer) => [
      prayer,
      iqamahTime(effectiveRule(masjid, prayer).rule, adhan[prayer], date),
    ]),
  ) as Record<Prayer, Date | null>;
}
