/**
 * The one rule both the scraper and the correction-approver enforce:
 * a congregation is never called before the prayer time it belongs to.
 *
 * Shared so the two paths can't drift apart — and so the timezone handling,
 * which is easy to get subtly wrong, exists in exactly one place.
 */
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";

export const TZ = "America/Toronto";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type Prayer = (typeof PRAYERS)[number];

export type IqamahRule =
  | { type: "fixed"; time: string }
  | { type: "offset"; minutes: number };

export interface Masjid {
  id: string;
  name: string;
  website: string;
  lat: number;
  lng: number;
  address?: string;
  timesUrl?: string;
  calc: { method: string; madhab: "hanafi" | "shafi" };
  iqamah?: Record<string, IqamahRule | undefined>;
  jumuah?: { khutbah: string }[];
  lastVerified?: string | null;
  needsReview?: boolean;
  source?: string;
}

export const isTime = (t: unknown): t is string =>
  typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** Minutes past midnight for a stored "HH:mm". */
export function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes past midnight on Toronto's clock — these run on a UTC box. */
export function torontoMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);

  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);

  return (value("hour") % 24) * 60 + value("minute");
}

/** Today's calendar date in Toronto, as "YYYY-MM-DD". */
export function torontoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Today's adhan times for a masjid, as minutes past midnight. */
export function adhanMinutesFor(masjid: Masjid): Record<Prayer, number> {
  const params =
    masjid.calc.method in CalculationMethod
      ? CalculationMethod[masjid.calc.method as keyof typeof CalculationMethod]()
      : CalculationMethod.NorthAmerica();
  params.madhab = masjid.calc.madhab === "shafi" ? Madhab.Shafi : Madhab.Hanafi;

  const [year, month, day] = torontoToday().split("-").map(Number);
  const t = new PrayerTimes(
    new Coordinates(masjid.lat, masjid.lng),
    new Date(year, month - 1, day),
    params,
  );

  return {
    fajr: torontoMinutes(t.fajr),
    dhuhr: torontoMinutes(t.dhuhr),
    asr: torontoMinutes(t.asr),
    maghrib: torontoMinutes(t.maghrib),
    isha: torontoMinutes(t.isha),
  };
}

/** Jumu'ah replaces Dhuhr, so a khutbah is always around midday. */
export const JUMUAH_EARLIEST = 11 * 60;
export const JUMUAH_LATEST = 17 * 60;

export function jumuahIsPlausible(time: string): boolean {
  if (!isTime(time)) return false;
  const minutes = clockMinutes(time);
  return minutes >= JUMUAH_EARLIEST && minutes <= JUMUAH_LATEST;
}
