/**
 * Merge the Aug 24 operator-compiled spreadsheet into masjids.json.
 *
 * Same shape of problem as the two imports before it — a snapshot of one
 * day's published times is not automatically safe to write over what is
 * already there — but this sheet has no Jumu'ah column at all (so Jumu'ah is
 * never touched here) and no colour-coded confidence tiers, just a free-text
 * Notes column. Two of those notes are load-bearing rather than trivia:
 *
 *   - Ibrahim Jame's note admits the site's widget "showed stale July 27
 *     data" — the same masjid whose site has been frozen on that date since
 *     the very first import. Writing these numbers as today's would mean
 *     recording a month-old reading as freshly verified, so this masjid's
 *     times are left untouched and flagged for a human to get an
 *     unambiguous read from, rather than guessed at again.
 *   - Two rows (Spiritual Society, Masjid El Noor) have no times at all and
 *     a Notes explanation instead — both already carry the flag on file
 *     (manualOnly / adDinUnverified) that explains why, so they are skipped
 *     rather than treated as a missing read.
 *
 * Run: npx tsx scripts/import-spreadsheet-2026-08-24.ts [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from "adhan";
import { minutesOfDay } from "../src/lib/time.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(HERE, "..", "src", "data", "masjids.json");
const SHEET_FILE = path.join(HERE, "spreadsheet-2026-08-24.json");

interface SheetRow {
  name: string;
  website: string;
  fajr: string | null;
  dhuhr: string | null;
  asr: string | null;
  maghrib: string | null;
  isha: string | null;
  notes: string;
}

interface Sheet {
  date: string;
  rows: SheetRow[];
}

type IqamahRule =
  | { type: "fixed"; time: string }
  | { type: "offset"; minutes: number };

interface Masjid {
  id: string;
  name: string;
  website?: string;
  lat: number;
  lng: number;
  calc: { method: string; madhab: string };
  iqamah: Record<string, IqamahRule | undefined>;
  jumuah?: { khutbah: string }[];
  lastVerified?: string;
  needsReview?: boolean;
  source?: string;
  manualOnly?: boolean;
  adDinUnverified?: boolean;
}

/** The widest sunset-to-iqamah gap we will believe — see the Aug 14 import. */
const MAX_MAGHRIB_OFFSET = 30;

function parseClock(raw: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(raw.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

function toHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return `${String(h).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function isBlank(raw: string | null): boolean {
  if (raw == null) return true;
  const value = raw.trim().toLowerCase();
  return value === "" || value === "n/a" || value === "not listed";
}

function maghribAdhanMinutes(masjid: Masjid, date: Date): number {
  const params = CalculationMethod.NorthAmerica();
  params.madhab = masjid.calc.madhab === "shafi" ? Madhab.Shafi : Madhab.Hanafi;
  const times = new PrayerTimes(
    new Coordinates(masjid.lat, masjid.lng),
    date,
    params,
  );
  return minutesOfDay(times.maghrib);
}

/** Maghrib is always relative to sunset — see the Aug 14 import for why. */
function maghribRule(
  raw: string,
  masjid: Masjid,
  date: Date,
): { rule: IqamahRule; note: string } | { rule: null; note: string } {
  const sunset = /^sunset(?:\s*\+\s*(\d+)\s*min)?$/i.exec(raw.trim());
  if (sunset) {
    const minutes = Number(sunset[1] ?? 0);
    return { rule: { type: "offset", minutes }, note: `sunset +${minutes}` };
  }

  const clock = parseClock(raw);
  if (clock == null) return { rule: null, note: `unparsed "${raw}"` };

  const offset = clock - maghribAdhanMinutes(masjid, date);
  if (offset < 0 || offset > MAX_MAGHRIB_OFFSET) {
    return {
      rule: null,
      note: `${raw} is ${offset} min from our sunset — out of range, kept existing`,
    };
  }
  return { rule: { type: "offset", minutes: offset }, note: `${raw} = sunset +${offset}` };
}

function domain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function describe(rule: IqamahRule | undefined): string {
  if (!rule) return "—";
  return rule.type === "offset" ? `sunset+${rule.minutes}` : rule.time;
}

function main() {
  const write = process.argv.includes("--write");
  const sheet: Sheet = JSON.parse(fs.readFileSync(SHEET_FILE, "utf8"));
  const masjids: Masjid[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  const [y, m, d] = sheet.date.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const byDomain = new Map<string, Masjid>();
  for (const masjid of masjids) {
    if (masjid.website) byDomain.set(domain(masjid.website), masjid);
  }

  const unmatched: string[] = [];
  const touched = new Set<string>();
  let changes = 0;

  for (const row of sheet.rows) {
    const masjid = byDomain.get(domain(row.website));
    if (!masjid) {
      unmatched.push(`${row.name} (${row.website})`);
      continue;
    }

    const allBlank = ["fajr", "dhuhr", "asr", "maghrib", "isha"].every((p) =>
      isBlank(row[p as keyof SheetRow] as string | null),
    );

    if (allBlank) {
      const already = masjid.manualOnly
        ? "manualOnly already set"
        : masjid.adDinUnverified
          ? "adDinUnverified already set"
          : "no flag on file for this yet — check why";
      console.log(`\n${masjid.name}\n  SKIPPED (no times in sheet) — ${row.notes} [${already}]`);
      continue;
    }

    /**
     * A masjid whose own site the compiler says is frozen on an old date is
     * not "verified today" no matter how confidently the numbers are typed
     * into a spreadsheet — the sheet is reporting what the page shows, and
     * the page is admittedly stale. Applying these would silently convert a
     * month-old reading into what every other row here means: "checked
     * today." Left untouched, flagged instead of guessed at.
     */
    const stale = /stale/i.test(row.notes);
    if (stale) {
      masjid.needsReview = true;
      console.log(`\n${masjid.name}\n  KEPT existing times — ${row.notes}`);
      touched.add(masjid.id);
      continue;
    }

    const lines: string[] = [];

    for (const prayer of ["fajr", "dhuhr", "asr", "isha"] as const) {
      const raw = row[prayer];
      if (isBlank(raw)) continue;
      const minutes = parseClock(raw as string);
      if (minutes == null) {
        lines.push(`  ${prayer}: unparsed "${raw}" — kept ${describe(masjid.iqamah[prayer])}`);
        continue;
      }
      const next: IqamahRule = { type: "fixed", time: toHHmm(minutes) };
      const before = describe(masjid.iqamah[prayer]);
      if (before !== next.time) lines.push(`  ${prayer}: ${before} -> ${next.time}`);
      masjid.iqamah[prayer] = next;
    }

    if (!isBlank(row.maghrib)) {
      const result = maghribRule(row.maghrib as string, masjid, date);
      const before = describe(masjid.iqamah.maghrib);
      if (result.rule) {
        const after = describe(result.rule);
        if (before !== after) lines.push(`  maghrib: ${before} -> ${after}  (${result.note})`);
        masjid.iqamah.maghrib = result.rule;
      } else {
        lines.push(`  maghrib: KEPT ${before} — ${result.note}`);
      }
    }

    masjid.lastVerified = sheet.date;
    masjid.needsReview = false;
    masjid.source = "manual";
    touched.add(masjid.id);

    if (row.notes) lines.push(`  note: ${row.notes}`);

    if (lines.length > 0) {
      changes += lines.length;
      console.log(`\n${masjid.name}`);
      console.log(lines.join("\n"));
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`matched ${touched.size}/${sheet.rows.length} rows, ${changes} field changes`);
  if (unmatched.length > 0) console.log(`unmatched:\n  ${unmatched.join("\n  ")}`);

  const missed = masjids.filter((m) => !touched.has(m.id));
  if (missed.length > 0) {
    console.log(`not in the sheet (left alone):\n  ${missed.map((m) => m.name).join("\n  ")}`);
  }

  if (write) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(masjids, null, 2) + "\n");
    console.log(`\nwrote ${DATA_FILE}`);
  } else {
    console.log(`\ndry run — pass --write to apply`);
  }
}

main();
