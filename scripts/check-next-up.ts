import {
  congregationSequence,
  formatCountdown,
  formatSince,
  groupRows,
  nextCongregation,
  nextUpRows,
} from "../src/lib/nextUp";
import { daysSinceVerified, isStale, trustStatus, verifiedAgo } from "../src/lib/trust";
import { zonedTimeOnDate } from "../src/lib/time";
import type { Masjid } from "../src/lib/types";

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

const friday = new Date(2026, 7, 14);
const monday = new Date(2026, 7, 17);
const at = (day: Date, hhmm: string) => {
  const t = zonedTimeOnDate(day, hhmm);
  if (!t) throw new Error("bad fixture time");
  return t;
};

const TORONTO = { lat: 43.6532, lng: -79.3832 };

const masjid = (
  id: string,
  iqamah: Record<string, string>,
  jumuah: string[] = [],
  lastVerified: string | null = "2026-08-11",
): Masjid =>
  ({
    id, name: id, address: "", ...TORONTO, website: "",
    calc: { method: "NorthAmerica", madhab: "hanafi" },
    iqamah: Object.fromEntries(
      Object.entries(iqamah).map(([k, v]) => [k, { type: "fixed", time: v }]),
    ),
    jumuah: jumuah.map((khutbah) => ({ khutbah })),
    lastVerified,
  }) as Masjid;

// --- congregationSequence --------------------------------------------------
check("weekday sequence is the five daily prayers",
  congregationSequence(monday), ["fajr", "dhuhr", "asr", "maghrib", "isha"]);
check("Friday swaps Dhuhr for Jumu'ah rather than adding it",
  congregationSequence(friday), ["fajr", "jumuah", "asr", "maghrib", "isha"]);

// --- nextCongregation ------------------------------------------------------
{
  const m = [masjid("a", { fajr: "05:30", dhuhr: "13:45", asr: "18:45", maghrib: "20:30", isha: "22:00" })];
  check("mid-afternoon heads toward Maghrib",
    nextCongregation(m, monday, at(monday, "19:30")).prayer, "maghrib");
  check("before dawn heads toward Fajr",
    nextCongregation(m, monday, at(monday, "04:00")).prayer, "fajr");
}
{
  // THE rollover case: after the last Isha, today's Fajr is 15 hours behind.
  const m = [masjid("a", { fajr: "05:30", isha: "22:00" })];
  const late = nextCongregation(m, monday, at(monday, "23:30"));
  check("after the last Isha it rolls to tomorrow, not backwards", late.isTomorrow, true);
  check("  and that congregation is Fajr", late.prayer, "fajr");
  check("  dated to the following day", late.date.getDate(), monday.getDate() + 1);
}
{
  const m = [masjid("a", { dhuhr: "13:45" }, ["13:30", "14:30"])];
  check("Friday midday heads toward Jumu'ah, not Dhuhr",
    nextCongregation(m, friday, at(friday, "12:00")).prayer, "jumuah");
}

// --- nextUpRows / Jumu'ah sittings ----------------------------------------
{
  const m = [masjid("a", {}, ["13:30", "14:30", "15:30"])];
  const cong = { prayer: "jumuah" as const, date: friday, isTomorrow: false };
  const [row] = nextUpRows(m, cong, TORONTO, at(friday, "14:00"));
  check("picks the sitting still ahead of now", row.iqamah?.getTime(), at(friday, "14:30").getTime());
  check("  and labels it 2 of 3", row.sitting, { index: 2, total: 3 });
}
{
  const m = [masjid("a", {}, ["13:30"])];
  const cong = { prayer: "jumuah" as const, date: friday, isTomorrow: false };
  const [row] = nextUpRows(m, cong, TORONTO, at(friday, "12:00"));
  check("a single sitting is not labelled '1 of 1'", row.sitting, null);
}
{
  // On a Friday a masjid with no Jumu'ah must not fall back to its Dhuhr.
  const m = [masjid("a", { dhuhr: "13:45" }, [])];
  const cong = { prayer: "jumuah" as const, date: friday, isTomorrow: false };
  const [row] = nextUpRows(m, cong, TORONTO, at(friday, "12:00"));
  check("no Jumu'ah on file shows nothing, never the weekday Dhuhr", row.iqamah, null);
}

// --- groupRows -------------------------------------------------------------
{
  const cong = { prayer: "isha" as const, date: monday, isTomorrow: false };
  const now = at(monday, "22:00");
  const rows = nextUpRows([
    masjid("soon", { isha: "22:30" }),
    masjid("later", { isha: "23:00" }),
    masjid("juststarted", { isha: "21:50" }),
    masjid("longgone", { isha: "20:00" }),
    masjid("nodata", {}),
  ], cong, TORONTO, now);
  const g = groupRows(rows);
  check("upcoming is soonest-first", g.upcoming.map((r) => r.masjid.id), ["soon", "later"]);
  check("a congregation 10 min old counts as just started", g.justStarted.map((r) => r.masjid.id), ["juststarted"]);
  check("two hours old is missed", g.missed.map((r) => r.masjid.id), ["longgone"]);
  check("no time on file is its own group", g.unknown.map((r) => r.masjid.id), ["nodata"]);
}

// --- formatting ------------------------------------------------------------
check("countdown under an hour", formatCountdown(12), "in 12 min");
check("countdown at the hour drops the minutes", formatCountdown(120), "in 2 h");
check("countdown over an hour", formatCountdown(80), "in 1 h 20 min");
check("countdown at zero reads 'now'", formatCountdown(0.2), "now");
check("elapsed reads backwards", formatSince(-8), "8 min ago");

// --- trust -----------------------------------------------------------------
check("age in whole days", daysSinceVerified("2026-08-01", new Date(2026, 7, 11)), 10);
check("never verified has no age", daysSinceVerified(null, monday), null);
check("never verified counts as stale", isStale(null, monday), true);
check("verified today is not stale", isStale("2026-08-17", monday), false);
check("46 days is stale", isStale("2026-07-02", new Date(2026, 7, 17)), true);
check("45 days exactly is not yet stale", isStale("2026-07-03", new Date(2026, 7, 17)), false);
check("verifiedAgo reads naturally", verifiedAgo("2026-08-16", monday), "yesterday");
check("a future date is not reported as freshness", verifiedAgo("2026-09-01", monday), null);

// --- trustStatus: one verdict every view shares ---------------------------
const day = (iso: string, needsReview = false) => ({ lastVerified: iso, needsReview });
{
  const t = new Date(2026, 7, 17);
  check("never verified leads, and warns",
    trustStatus({ lastVerified: null }, t), { level:"unverified", label:"Not verified yet", warn:true });
  check("a future date is treated as unverified, not fresh",
    trustStatus(day("2026-09-01"), t).level, "unverified");
  check("past the stale window it warns with the age",
    trustStatus(day("2026-06-01"), t), { level:"stale", label:"Checked 77 days ago", warn:true });
  // The whole point of ranking age above the flag: a masjid checked today
  // with one unread field is not the same as one nobody has ever checked.
  check("a fresh record with the scraper's flag is 'partly confirmed', not a warning",
    trustStatus(day("2026-08-17", true), t), { level:"flagged", label:"Partly confirmed", warn:false });
  check("age still wins over the flag when the record is old",
    trustStatus(day("2026-06-01", true), t).level, "stale");
  check("a clean fresh record just reports its age",
    trustStatus(day("2026-08-17"), t), { level:"checked", label:"Checked today", warn:false });
}
check("a future date counts as stale too", isStale("2026-09-01", new Date(2026, 7, 17)), true);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
