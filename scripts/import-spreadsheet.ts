/**
 * Merge an operator-compiled spreadsheet of iqamah times into masjids.json.
 *
 * Someone visited all 32 sites by hand and recorded what each one published
 * for one day. That is better data than the scraper has managed — but a
 * spreadsheet is a *snapshot of one date*, and the app has to be right on
 * every other date too, so the import cannot be a straight copy. Two rules do
 * the real work here:
 *
 *   1. Maghrib is converted from the clock time on the sheet into an offset
 *      from sunset (see `maghribRule`). Storing "8:27 PM" as a fixed time
 *      would be right today and roughly four hours wrong by December.
 *   2. A row with no data never overwrites a row that has some (CLAUDE.md
 *      §14, fail safe). Missing Jumu'ah keeps the sittings already on file.
 *
 * Run: npx tsx scripts/import-spreadsheet.ts [--write]
 * Without --write it prints the diff and changes nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from "adhan";
import { minutesOfDay } from "../src/lib/time.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(HERE, "..", "src", "data", "masjids.json");
const SHEET_FILE = path.join(HERE, "spreadsheet-2026-08-14.json");

type Confidence = "live" | "stale" | "none";

interface SheetRow {
  name: string;
  website: string;
  fajr: string | null;
  dhuhr: string | null;
  asr: string | null;
  maghrib: string | null;
  isha: string | null;
  jumuah: string | null;
  notes: string;
  confidence: Confidence;
}

interface Sheet {
  date: string;
  rows: SheetRow[];
}

/**
 * The widest sunset-to-iqamah gap we will believe.
 *
 * Maghrib is prayed promptly — a masjid that waited half an hour would be
 * cutting into the window. A larger computed gap means the sheet's time and
 * our sunset disagree about something (wrong coordinates, a typo, an adhan
 * time recorded where an iqamah was meant), and guessing would bake that
 * error into every future date. Those rows keep whatever they already had.
 */
const MAX_MAGHRIB_OFFSET = 30;

/** "5:45 AM" / "2:00 PM" / "13:45" -> minutes past midnight. */
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

/** Cells that mean "the masjid doesn't publish this", not "midnight". */
function isBlank(raw: string | null): boolean {
  if (raw == null) return true;
  const value = raw.trim().toLowerCase();
  return value === "" || value === "n/a" || value === "not listed";
}

/**
 * Sunset at this masjid on the sheet's date, as Toronto minutes past midnight.
 *
 * Deliberately re-derived rather than read from the sheet: the whole point is
 * to measure the masjid's published time *against* sunset, so the baseline has
 * to be ours.
 */
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

/**
 * Turn the Maghrib cell into a rule.
 *
 * The sheet writes it three ways — "Sunset", "Sunset +5 min", and a clock
 * time like "8:27 PM" — but they all mean the same thing, because every
 * masjid sets Maghrib relative to sunset and only *prints* it as a clock time
 * for today. Normalising to an offset is what keeps the app correct in
 * December, and it matches how all 21 existing Maghrib rules are stored.
 */
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

  return {
    rule: { type: "offset", minutes: offset },
    note: `${raw} = sunset +${offset}`,
  };
}

/**
 * "1:50 / 2:45 / 3:35 PM" -> ["13:50", "14:45", "15:35"].
 *
 * The sheet writes the meridiem once, on the last sitting, and lets the
 * earlier ones inherit it. Reading "1:50" as 1:50am would put Friday prayer
 * in the middle of the night, so a bare token borrows the meridiem the row
 * does state.
 */
function parseJumuah(raw: string): string[] {
  const tokens = raw
    .split("/")
    .map((t) => t.trim())
    .filter(Boolean);

  const stated = tokens
    .map((t) => /(AM|PM)/i.exec(t)?.[1]?.toUpperCase())
    .filter((m): m is string => m != null);
  const fallback = stated.at(-1);

  const minutes = tokens.map((token) =>
    parseClock(/(AM|PM)/i.test(token) || !fallback ? token : `${token} ${fallback}`),
  );

  if (minutes.some((m) => m == null)) return [];
  return [...new Set(minutes as number[])].sort((a, b) => a - b).map(toHHmm);
}

/** Domain only, so "https://www.slifo.ca/" and "slifo.ca" match. */
function domain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/** A row may list several domains ("masjidaljannah.ca, slifo.ca"). */
function domains(cell: string): string[] {
  return cell.split(",").map(domain).filter(Boolean);
}

/** "Site schedule dated Jul 27, 2026" -> "2026-07-27". */
function noteDate(note: string): string | null {
  const match =
    /\b([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(note);
  if (!match) return null;

  const month = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ].indexOf(match[1].toLowerCase());
  if (month < 0) return null;

  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
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
}

function describe(rule: IqamahRule | undefined): string {
  if (!rule) return "—";
  return rule.type === "offset" ? `sunset+${rule.minutes}` : rule.time;
}

function main() {
  const write = process.argv.includes("--write");
  const sheet: Sheet = JSON.parse(fs.readFileSync(SHEET_FILE, "utf8"));
  const masjids: Masjid[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  // adhan reads the date's components in the runtime's zone, so a plain
  // local-midnight Date is what it wants — see src/lib/time.ts.
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
    const masjid = domains(row.website)
      .map((host) => byDomain.get(host))
      .find((hit): hit is Masjid => hit != null);

    if (!masjid) {
      unmatched.push(`${row.name} (${row.website})`);
      continue;
    }

    if (row.confidence === "none") {
      console.log(`\n${masjid.name}\n  SKIPPED — ${row.notes}`);
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

    let jumuahConfirmed = false;
    if (!isBlank(row.jumuah)) {
      const sittings = parseJumuah(row.jumuah as string);
      if (sittings.length === 0) {
        lines.push(`  jumuah: unparsed "${row.jumuah}" — kept existing`);
      } else {
        const before = (masjid.jumuah ?? []).map((s) => s.khutbah).join(", ");
        const after = sittings.join(", ");
        if (before !== after) lines.push(`  jumuah: [${before}] -> [${after}]`);
        masjid.jumuah = sittings.map((khutbah) => ({ khutbah }));
        jumuahConfirmed = true;
      }
    } else {
      lines.push(`  jumuah: not published — kept [${(masjid.jumuah ?? []).map((s) => s.khutbah).join(", ")}]`);
    }

    // A row the compiler could not date to today is still good data, but it
    // is dated to when the masjid published it, not to today — so the
    // freshness badge ages from that date and the review flag stays up.
    const stale = row.confidence === "stale";

    /**
     * Confirming the five daily prayers is not confirming Friday.
     *
     * Whatever Jumu'ah is on file for these came from a scrape nobody has
     * checked since, and at least one of those reads is provably wrong:
     * Masjid El Noor and Masjid Vaughan were both given an identical
     * `13:35, 14:00` by the same run, and the sheet says Vaughan holds one
     * sitting at 2:00. Two unrelated masjids do not share an oddly specific
     * pair by coincidence — that is the scraper's fingerprint, not theirs.
     * Vaughan gets corrected here because the sheet covers it; El Noor keeps
     * the suspect pair because the sheet does not, so it must not come out of
     * this import looking verified.
     */
    const unconfirmedJumuah = !jumuahConfirmed;
    if (unconfirmedJumuah) lines.push(`  -> flagged for review: Friday time unconfirmed`);

    masjid.lastVerified = (stale && noteDate(row.notes)) || sheet.date;
    masjid.needsReview = stale || unconfirmedJumuah;
    masjid.source = "manual";
    touched.add(masjid.id);

    if (lines.length > 0) {
      changes += lines.length;
      console.log(`\n${masjid.name}${stale ? "  [needs review]" : ""}`);
      console.log(lines.join("\n"));
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`matched ${touched.size}/${sheet.rows.length} rows, ${changes} field changes`);
  if (unmatched.length > 0) {
    console.log(`unmatched rows:\n  ${unmatched.join("\n  ")}`);
  }

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
