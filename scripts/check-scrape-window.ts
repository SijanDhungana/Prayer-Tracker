import { Coordinates, CalculationMethod, PrayerTimes } from "adhan";
import { inWindow, LEAD_HOURS } from "./scrape-window";

/**
 * The daily scrape has to land once a day, before Fajr, all year.
 *
 * The old fixed 09:00 UTC cron did not: Toronto's Fajr runs from 07:45 UTC in
 * late June to 11:23 UTC in January, so every summer the scrape ran after Fajr
 * had already passed. An hourly cron plus a one-hour window tracks it, but only
 * if the window really does catch exactly one hour out of every 24 — never
 * zero (a day with no refresh) and never two (a wasted duplicate run).
 *
 * So this walks a full year, hour by hour, and counts.
 */
const TORONTO = new Coordinates(43.6532, -79.3832);

let failed = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok && detail) console.log(`    ${detail}`);
};

function fajrOn(date: Date): Date {
  return new PrayerTimes(TORONTO, date, CalculationMethod.NorthAmerica()).fajr;
}

function main() {
  const offenders: string[] = [];
  let daysChecked = 0;
  let totalHits = 0;

  // Every day of a year, including both daylight-saving switchovers.
  for (let d = 0; d < 365; d++) {
    const day = new Date(2026, 0, 1 + d);
    const fajr = fajrOn(day);
    daysChecked++;

    // Every hourly cron tick in the 48 hours around it, since the window can
    // sit before midnight in the runner's own reckoning.
    let hits = 0;
    for (let h = -24; h < 24; h++) {
      const tick = new Date(day.getTime() + h * 3600_000);
      tick.setMinutes(0, 0, 0);
      if (inWindow(tick, fajr)) hits++;
    }

    totalHits += hits;
    if (hits !== 1) {
      offenders.push(`${day.toISOString().slice(0, 10)} -> ${hits} hits`);
    }
  }

  check(
    `exactly one hourly tick qualifies on each of ${daysChecked} days`,
    offenders.length === 0,
    offenders.slice(0, 5).join("; "),
  );
  check("that is one scrape per day, no more", totalHits === daysChecked, `${totalHits} vs ${daysChecked}`);

  // The whole point: the run has to be finished before Fajr, not racing it.
  const RUN_MINUTES = 50;
  const tight: string[] = [];
  for (let d = 0; d < 365; d += 7) {
    const day = new Date(2026, 0, 1 + d);
    const fajr = fajrOn(day);
    const latestStart = fajr.getTime() - LEAD_HOURS * 3600_000 + 3600_000;
    const finish = latestStart + RUN_MINUTES * 60_000;
    if (finish >= fajr.getTime()) tight.push(day.toISOString().slice(0, 10));
  }
  check(
    `even starting at the end of the window, a ${RUN_MINUTES} min run finishes before Fajr`,
    tight.length === 0,
    tight.slice(0, 5).join(", "),
  );

  // And it must never be scheduled after Fajr, which is the bug being fixed.
  const late: string[] = [];
  for (let d = 0; d < 365; d += 7) {
    const day = new Date(2026, 0, 1 + d);
    const fajr = fajrOn(day);
    const start = fajr.getTime() - LEAD_HOURS * 3600_000;
    if (start >= fajr.getTime()) late.push(day.toISOString().slice(0, 10));
  }
  check("the window never opens after Fajr", late.length === 0, late.join(", "));

  console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
