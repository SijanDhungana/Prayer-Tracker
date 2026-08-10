/** Shapes stored in src/data/masjids.json — see CLAUDE.md §6. */

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type Prayer = (typeof PRAYERS)[number];

export const PRAYER_LABELS: Record<Prayer, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

/** Either a clock time the masjid sets, or N minutes after that prayer's adhan. */
export type IqamahRule =
  | { type: "fixed"; time: string } // 24h "HH:mm"
  | { type: "offset"; minutes: number };

export interface CalcConfig {
  /** Key of adhan's CalculationMethod, e.g. "NorthAmerica". */
  method: string;
  /** Only changes Asr — "hanafi" runs it roughly an hour later. */
  madhab: "hanafi" | "shafi";
  /**
   * Per-prayer nudges in minutes, for masjids that publish times a minute or
   * two off the pure calculation (usually rounding up). Optional; omitted
   * means no adjustment.
   */
  adjustments?: Partial<Record<Prayer, number>>;
}

export interface JumuahSession {
  khutbah: string; // 24h "HH:mm"
}

export interface Masjid {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  website: string;
  /** Page the scraper should read when the times aren't on the homepage. */
  timesUrl?: string;
  calc: CalcConfig;
  iqamah: Partial<Record<Prayer, IqamahRule>>;
  jumuah: JumuahSession[];
  /** ISO date the times were last confirmed, or null if never. */
  lastVerified: string | null;
  /** Set by the scraper when a read fails or looks off. */
  needsReview?: boolean;
  source?: "seed" | "scrape" | "manual";
}
