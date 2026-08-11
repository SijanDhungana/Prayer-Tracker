/**
 * The sun's day as five windows — the material the design is built from
 * (design spec v2 §1, §9).
 *
 * A window runs from one prayer's adhan to the next one's, so the five of
 * them tile the whole day with no gaps: that is what lets the ring be a
 * complete circle rather than a progress bar with a hole in it. Isha's window
 * runs past midnight to *tomorrow's* Fajr, which is why the circle is defined
 * as Fajr-to-Fajr rather than midnight-to-midnight.
 *
 * Arc lengths follow real durations, so the ring's shape changes across the
 * year. In Toronto's June, Isha's arc is visibly short. That is the design
 * carrying true information rather than decorating it.
 */
import { adhanTimes } from "./prayer";
import { PRAYERS, type Masjid, type Prayer } from "./types";

export interface PrayerWindow {
  prayer: Prayer;
  start: Date;
  /** The next prayer's adhan; for Isha, tomorrow's Fajr. */
  end: Date;
}

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * Today's five windows, in order, starting at Fajr.
 *
 * `reference` is one masjid's coordinates — adhan is near enough identical
 * across the city (CLAUDE.md §2), so the ring uses a single reference rather
 * than trying to average thirty-two.
 */
export function dayWindows(reference: Masjid, date: Date): PrayerWindow[] {
  const today = adhanTimes(reference, date);
  const tomorrowFajr = adhanTimes(reference, addDays(date, 1)).fajr;

  return PRAYERS.map((prayer, i) => ({
    prayer,
    start: today[prayer],
    end: i + 1 < PRAYERS.length ? today[PRAYERS[i + 1]] : tomorrowFajr,
  }));
}

export interface WindowPosition {
  /** Index into the window list, or -1 before the day's first Fajr. */
  index: number;
  window: PrayerWindow | null;
  /** 0–1 through the current window. */
  progress: number;
  /** 0–1 through the whole Fajr-to-Fajr circle. */
  dayProgress: number;
}

/**
 * Where `now` sits in the day.
 *
 * Between midnight and Fajr the clock is inside *yesterday's* Isha window,
 * which today's list cannot represent — so the caller is told index -1 and
 * should recompute against yesterday's date. Returning a bogus index here
 * would put the ring's marker at the wrong end of the circle.
 */
export function positionInDay(
  windows: PrayerWindow[],
  now: Date,
): WindowPosition {
  const first = windows[0]?.start;
  const last = windows[windows.length - 1]?.end;
  if (!first || !last) {
    return { index: -1, window: null, progress: 0, dayProgress: 0 };
  }

  const span = last.getTime() - first.getTime();
  const elapsed = now.getTime() - first.getTime();

  if (elapsed < 0) {
    return { index: -1, window: null, progress: 0, dayProgress: 0 };
  }

  const index = windows.findIndex((w) => now >= w.start && now < w.end);
  if (index === -1) {
    // Past tomorrow's Fajr — the caller's date is stale by a day.
    return { index: -1, window: null, progress: 1, dayProgress: 1 };
  }

  const window = windows[index];
  const length = window.end.getTime() - window.start.getTime();

  return {
    index,
    window,
    progress: length > 0 ? (now.getTime() - window.start.getTime()) / length : 0,
    dayProgress: span > 0 ? elapsed / span : 0,
  };
}

/**
 * The window containing `now`, looking back to yesterday when the clock is in
 * the small hours. Returns the window and the calendar date its circle
 * belongs to, so callers can draw the right ring.
 */
export function currentWindow(
  reference: Masjid,
  today: Date,
  now: Date,
): { windows: PrayerWindow[]; position: WindowPosition; date: Date } {
  const windows = dayWindows(reference, today);
  const position = positionInDay(windows, now);
  if (position.index !== -1) return { windows, position, date: today };

  // Before this morning's Fajr: still inside yesterday's Isha.
  const yesterday = addDays(today, -1);
  const back = dayWindows(reference, yesterday);
  return { windows: back, position: positionInDay(back, now), date: yesterday };
}

/** Each window's share of the circle, for the ring's arc lengths. */
export function windowShares(windows: PrayerWindow[]): number[] {
  const total = windows.reduce(
    (sum, w) => sum + (w.end.getTime() - w.start.getTime()),
    0,
  );
  if (total <= 0) return windows.map(() => 1 / windows.length);
  return windows.map((w) => (w.end.getTime() - w.start.getTime()) / total);
}
