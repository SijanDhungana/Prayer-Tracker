/**
 * Which prayer a trip is being planned around, and when its iqamah actually
 * falls today.
 *
 * Kept apart from tripPlan.ts on the same grounds that module states for
 * itself: the scheduling engine only ever sees a `Date | null` and has no
 * business knowing where it came from. "What does Jumu'ah at a masjid with
 * three sittings mean as a single instant" is a resolution question that
 * belongs here, before anything reaches the engine.
 */
import { adhanTimes, iqamahTimes, orderedJumuah } from "./prayer";
import { minutesOfDay, zonedTimeOnDate } from "./time";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "./types";

/** Trip planning's one addition to the five daily prayers. */
export type PlanPrayer = Prayer | "jumuah";

export function prayerLabel(prayer: PlanPrayer): string {
  return prayer === "jumuah" ? "Jumu'ah" : PRAYER_LABELS[prayer];
}

export function isFriday(date: Date): boolean {
  return date.getDay() === 5;
}

/**
 * The choices worth offering today. Jumu'ah is included only when `today`
 * actually is a Friday — any other day there is no congregation to plan a
 * stop around, and offering one would just be confusing rather than useful.
 * Placed right after Dhuhr, its natural chronological position.
 *
 * `anyDay` lifts the Friday restriction so an admin can exercise the Jumu'ah
 * route on the other six days — checking that a masjid's newly collected
 * sittings actually plan sensibly shouldn't mean waiting until Friday to
 * find out. The resulting plan is fictional on any other day, so callers
 * that pass this must say so on screen; see PlanTrip's preview notice.
 */
export function planPrayerOptions(
  today: Date,
  { anyDay = false }: { anyDay?: boolean } = {},
): { value: PlanPrayer; label: string }[] {
  const options: { value: PlanPrayer; label: string }[] = PRAYERS.map((p) => ({
    value: p,
    label: PRAYER_LABELS[p],
  }));

  if (isFriday(today) || anyDay) {
    const afterDhuhr = options.findIndex((o) => o.value === "dhuhr") + 1;
    options.splice(afterDhuhr, 0, { value: "jumuah", label: "Jumu'ah" });
  }

  return options;
}

/**
 * The prayer someone opening the planner right now is most likely trying to
 * catch: the last one whose adhan has already passed. On a Friday, the
 * midday congregation people are actually heading to is Jumu'ah, not the
 * Dhuhr the calculation alone would name, so that one window defaults there
 * instead.
 */
export function currentPlanPrayer(masjids: Masjid[], today: Date): PlanPrayer {
  const reference = masjids[0];
  if (!reference) return "dhuhr";

  const times = adhanTimes(reference, today);
  const nowMinutes = minutesOfDay(new Date());

  let current: Prayer = "fajr";
  for (const prayer of PRAYERS) {
    if (minutesOfDay(times[prayer]) <= nowMinutes) current = prayer;
  }

  return isFriday(today) && current === "dhuhr" ? "jumuah" : current;
}

/** A masjid's Friday sittings as real instants on `today`, earliest first. */
export function jumuahTimesOn(masjid: Masjid, today: Date): Date[] {
  const times: Date[] = [];
  for (const session of orderedJumuah(masjid)) {
    const time = zonedTimeOnDate(today, session.khutbah);
    if (time) times.push(time);
  }
  return times;
}

/**
 * Which of a masjid's sittings "the Jumu'ah iqamah" means for a trip
 * starting at `now`: whichever one hasn't happened yet, mirroring how the
 * home view always points at the next iqamah rather than the first one on
 * the page. If every sitting has already begun, the last one is returned
 * rather than null — a departure priced against it correctly comes back as
 * "too late" instead of the masjid silently vanishing from the results as if
 * it held no Jumu'ah at all.
 */
export function nextJumuahTime(times: Date[], now: Date): Date | null {
  if (times.length === 0) return null;
  return times.find((time) => time > now) ?? times[times.length - 1];
}

/** The iqamah a masjid offers for `prayer`, resolving Jumu'ah's sittings. */
export function resolvePlanIqamah(
  masjid: Masjid,
  prayer: PlanPrayer,
  now: Date,
  today: Date,
): Date | null {
  if (prayer === "jumuah") {
    return nextJumuahTime(jumuahTimesOn(masjid, today), now);
  }
  return iqamahTimes(masjid, today)[prayer];
}

/**
 * When `prayer`'s window closes for each masjid — praying after this isn't a
 * real option. For a daily prayer that's the next prayer's adhan; for
 * Jumu'ah it's the last sitting, since once that has begun there is no more
 * congregation left today to plan around.
 */
export function planPrayerWindowEnds(
  masjids: Masjid[],
  prayer: PlanPrayer,
  today: Date,
): (Date | null)[] {
  if (prayer === "jumuah") {
    return masjids.map((masjid) => {
      const times = jumuahTimesOn(masjid, today);
      return times.length ? times[times.length - 1] : null;
    });
  }

  const order = PRAYERS.indexOf(prayer);
  const next = PRAYERS[order + 1];
  if (!next) return masjids.map(() => null);
  return masjids.map((masjid) => adhanTimes(masjid, today)[next]);
}
