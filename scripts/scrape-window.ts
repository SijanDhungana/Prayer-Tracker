/**
 * Decides whether the daily scrape should run in this hour.
 *
 * The point of the scrape is that today's times are on the screen before
 * anyone opens the app for Fajr. A fixed UTC cron cannot do that: Toronto's
 * Fajr moves from 07:45 UTC in late June to 11:23 UTC in January, a spread of
 * nearly four hours, and daylight saving shifts it again. The old schedule was
 * a fixed 09:00 UTC, which means that through the whole summer the scrape ran
 * AFTER Fajr had already passed — the one time of day the freshness mattered
 * most was the one time it was not there.
 *
 * So the workflow runs hourly and this decides, per run, whether to do the
 * expensive part. Exactly one hourly run lands inside a one-hour window, so
 * the scrape still happens once a day; it just tracks sunrise instead of the
 * clock.
 *
 * LEAD_HOURS is 2, not 1, on purpose. A full run takes roughly 50 minutes, and
 * GitHub's scheduled runs are routinely delayed ten minutes or more under load
 * (they are best-effort, not guaranteed). Starting an hour before Fajr would
 * mean finishing right on top of it, and a delayed start would finish after.
 * Two hours means the directory is complete about an hour before Fajr, which
 * is what "ready before Fajr" actually requires.
 *
 * Prints "go" or "skip"; also writes `run=true|false` to $GITHUB_OUTPUT when
 * running in Actions.
 *
 * Run: npx tsx scripts/scrape-window.ts
 */
import { appendFileSync } from "node:fs";
import { Coordinates, CalculationMethod, PrayerTimes } from "adhan";
import { TZ, torontoToday } from "./prayer-invariant";

/** Downtown Toronto — Fajr varies by seconds across the city, not minutes. */
const TORONTO = new Coordinates(43.6532, -79.3832);

/** How long before Fajr the run should START. See the note above. */
export const LEAD_HOURS = 2;

/** The scrape's own runtime, for the message only. */
const RUN_MINUTES = 50;

/** Today's Fajr in Toronto, as an absolute instant. */
export function fajrToday(now = new Date()): Date {
  const [year, month, day] = torontoToday().split("-").map(Number);
  // A local Date for that calendar day; adhan derives the instant from the
  // coordinates, so the runner's own timezone never enters into it.
  const times = new PrayerTimes(
    TORONTO,
    new Date(year, month - 1, day),
    CalculationMethod.NorthAmerica(),
  );
  void now;
  return times.fajr;
}

/**
 * True when `now` falls in the hour that begins LEAD_HOURS before Fajr.
 *
 * A one-hour window against an hourly cron means one run per day qualifies —
 * never zero, never two — without needing to know when the cron actually
 * fired.
 */
export function inWindow(now: Date, fajr: Date, leadHours = LEAD_HOURS): boolean {
  const start = fajr.getTime() - leadHours * 3600_000;
  return now.getTime() >= start && now.getTime() < start + 3600_000;
}

function clock(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function main() {
  // A hand-triggered run is someone asking for it now; the window is about
  // the daily schedule, not about refusing a person.
  const manual = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

  const now = new Date();
  const fajr = fajrToday(now);
  const go = manual || inWindow(now, fajr);

  const start = new Date(fajr.getTime() - LEAD_HOURS * 3600_000);
  console.log(`now        ${clock(now, TZ)} Toronto (${clock(now, "UTC")} UTC)`);
  console.log(`Fajr today ${clock(fajr, TZ)} Toronto (${clock(fajr, "UTC")} UTC)`);
  console.log(`window     ${clock(start, TZ)}–${clock(new Date(start.getTime() + 3600_000), TZ)} Toronto`);
  console.log(
    manual
      ? "go (triggered by hand — the window does not apply)"
      : go
        ? `go — a ~${RUN_MINUTES} min run from here finishes well before Fajr`
        : "skip — not this hour",
  );

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `run=${go}\n`);
  }
}

// Only when executed directly, so the check suite can import the logic.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  main();
}
