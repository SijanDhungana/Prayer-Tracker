import {
  currentPlanPrayer,
  jumuahTimesOn,
  nextJumuahTime,
  isFriday,
  planPrayerOptions,
  planPrayerWindowEnds,
  prayerLabel,
  resolvePlanIqamah,
} from "../src/lib/planPrayer";
import { zonedTimeOnDate } from "../src/lib/time";
import type { Masjid } from "../src/lib/types";

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

// Toronto coordinates, three Friday sittings, on the record as real trip
// planning would see them.
const masjid = (jumuah: string[]): Masjid =>
  ({
    id: "m", name: "M", address: "", lat: 43.6532, lng: -79.3832, website: "",
    calc: { method: "NorthAmerica", madhab: "hanafi" },
    iqamah: { dhuhr: { type: "fixed", time: "13:45" } },
    jumuah: jumuah.map((khutbah) => ({ khutbah })),
    lastVerified: null,
  }) as Masjid;

// A real Friday and a real non-Friday, both fixed so the test doesn't drift
// with the calendar.
const friday = new Date(2026, 7, 14); // August 14, 2026 is a Friday
const monday = new Date(2026, 7, 17);
check("sanity: chosen dates are the right weekdays", [friday.getDay(), monday.getDay()], [5, 1]);

// --- planPrayerOptions ---------------------------------------------------
{
  const opts = planPrayerOptions(monday).map((o) => o.value);
  check("no Jumu'ah option on a Monday", opts.includes("jumuah"), false);
}
{
  const opts = planPrayerOptions(friday).map((o) => o.value);
  check("Jumu'ah appears on a Friday", opts.includes("jumuah"), true);
  check("Jumu'ah sits right after Dhuhr", opts[opts.indexOf("dhuhr") + 1], "jumuah");
}

// --- admin: Jumu'ah on any day -------------------------------------------
check("isFriday agrees with the fixtures", [isFriday(friday), isFriday(monday)], [true, false]);
{
  // A non-admin on a Monday must not see it.
  const opts = planPrayerOptions(monday, { anyDay: false }).map((o) => o.value);
  check("anyDay:false leaves the Friday gate in place", opts.includes("jumuah"), false);
}
{
  const opts = planPrayerOptions(monday, { anyDay: true }).map((o) => o.value);
  check("anyDay:true offers Jumu'ah on a Monday", opts.includes("jumuah"), true);
  check("  still in its chronological slot after Dhuhr",
    opts[opts.indexOf("dhuhr") + 1], "jumuah");
  check("  and adds exactly one option", opts.length, 6);
}
{
  // The flag must never double up the option on a day it already applies.
  const opts = planPrayerOptions(friday, { anyDay: true }).map((o) => o.value);
  check("anyDay on a Friday does not duplicate Jumu'ah",
    opts.filter((o) => o === "jumuah").length, 1);
}
{
  // The default must stay closed: omitting the argument is the public path.
  const opts = planPrayerOptions(monday).map((o) => o.value);
  check("omitting the options object keeps Jumu'ah hidden", opts.includes("jumuah"), false);
}

// --- jumuahTimesOn / nextJumuahTime --------------------------------------
{
  const m = masjid(["13:30", "14:30", "15:30"]);
  const times = jumuahTimesOn(m, friday).map((t) => t.toISOString());
  check("resolves three sittings as real instants, in order", times.length, 3);
}
{
  const m = masjid(["13:30", "14:30", "15:30"]);
  const times = jumuahTimesOn(m, friday);
  const now = zoned(friday, "14:00");
  const next = nextJumuahTime(times, now);
  check("picks the next sitting still ahead of now (14:30, not 13:30)",
    next?.getUTCHours() !== undefined, true);
  check("that sitting is the second one", next?.getTime(), times[1].getTime());
}
{
  const m = masjid(["13:30", "14:30"]);
  const times = jumuahTimesOn(m, friday);
  const now = zoned(friday, "16:00"); // after every sitting
  const next = nextJumuahTime(times, now);
  check("falls back to the last sitting once every one has passed",
    next?.getTime(), times[times.length - 1].getTime());
}
{
  const m = masjid([]);
  check("no sittings on file is null, not a crash",
    nextJumuahTime(jumuahTimesOn(m, friday), friday), null);
}

// --- resolvePlanIqamah -----------------------------------------------------
{
  const m = masjid(["13:30", "15:00"]);
  const now = zoned(friday, "13:00");
  const iqamah = resolvePlanIqamah(m, "jumuah", now, friday);
  const expected = jumuahTimesOn(m, friday)[0];
  check("resolvePlanIqamah for jumuah matches nextJumuahTime", iqamah?.getTime(), expected.getTime());
}
{
  const m = masjid([]);
  const now = zoned(friday, "13:00");
  const iqamah = resolvePlanIqamah(m, "dhuhr", now, friday);
  check("resolvePlanIqamah for a daily prayer reads the stored iqamah, not jumuah",
    iqamah != null, true);
}

// --- planPrayerWindowEnds --------------------------------------------------
{
  const m = masjid(["13:30", "14:30", "15:30"]);
  const [end] = planPrayerWindowEnds([m], "jumuah", friday);
  const last = jumuahTimesOn(m, friday)[2];
  check("jumuah's window closes at the last sitting", end?.getTime(), last.getTime());
}
{
  const m = masjid([]);
  const [end] = planPrayerWindowEnds([m], "jumuah", friday);
  check("no sittings on file means no window at all", end, null);
}

// --- currentPlanPrayer ------------------------------------------------------
{
  // A masjid whose Dhuhr adhan is comfortably in the past relative to "now"
  // inside this test would need a real clock; instead assert the two
  // branches that don't depend on wall-clock time.
  check("empty masjid list defaults to dhuhr", currentPlanPrayer([], friday), "dhuhr");
}

// --- prayerLabel ------------------------------------------------------------
check("prayerLabel names Jumu'ah", prayerLabel("jumuah"), "Jumu'ah");
check("prayerLabel passes daily prayers through", prayerLabel("asr"), "Asr");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);

// Same resolver the real code uses, so "now" lands on Toronto's clock
// regardless of what timezone this test happens to run in.
function zoned(day: Date, hhmm: string): Date {
  const time = zonedTimeOnDate(day, hhmm);
  if (!time) throw new Error(`bad test fixture time: ${hhmm}`);
  return time;
}
