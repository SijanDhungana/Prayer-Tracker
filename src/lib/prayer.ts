import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from "adhan";
import type { CalcConfig, Masjid, Prayer } from "./types";
import { todayIn } from "./time";

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
