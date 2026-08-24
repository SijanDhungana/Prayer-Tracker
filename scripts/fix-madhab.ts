/**
 * Infer each masjid's Asr school from the Asr iqamah it publishes.
 *
 * `calc.madhab` decides where this app puts the Asr *adhan*, and Hanafi and
 * Shafi disagree about it by roughly an hour. It is not a display preference:
 * the Settings default is "whatever each masjid itself calculates", so for
 * most visitors the stored value is exactly what they see, and it also feeds
 * the scraper's rejectImpossible check — a wrong school there throws away
 * correct scraped times for being "before the adhan".
 *
 * Twelve masjids carried "shafi" from long before any import in this repo's
 * recent history, and the Aug 24 spreadsheet made the error legible: each one
 * publishes an Asr iqamah 24-55 minutes after the *Hanafi* Asr and 84-115
 * minutes after the Shafi one. A congregation is not held an hour and a half
 * after its own adhan; the school underneath was simply wrong.
 *
 * The rule: whichever school puts the adhan before the published iqamah with
 * the smaller gap is the one the masjid keeps. A negative gap is impossible
 * and disqualifies a school outright. This is inference from evidence, not a
 * claim about any community's fiqh — it reads back the calculation each
 * masjid is demonstrably already using.
 *
 * Run: npx tsx scripts/fix-madhab.ts [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from "adhan";
import { minutesOfDay, clockMinutes, todayIn } from "../src/lib/time.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(HERE, "..", "src", "data", "masjids.json");

type Madhabs = "hanafi" | "shafi";

interface Masjid {
  id: string;
  name: string;
  lat: number;
  lng: number;
  calc: { method: string; madhab: string };
  iqamah: Record<string, { type: string; time?: string; minutes?: number } | undefined>;
}

/**
 * Beyond this the "gap" is not a masjid's habit any more, it is the wrong
 * school. Real iqamah gaps in this dataset run 17-55 minutes; the mistaken
 * Shafi readings all land past 84.
 */
const MAX_BELIEVABLE_GAP = 90;

function asrMinutes(masjid: Masjid, madhab: Madhabs, date: Date): number {
  const params = CalculationMethod.NorthAmerica();
  params.madhab = madhab === "shafi" ? Madhab.Shafi : Madhab.Hanafi;
  return minutesOfDay(
    new PrayerTimes(new Coordinates(masjid.lat, masjid.lng), date, params).asr,
  );
}

function main() {
  const write = process.argv.includes("--write");
  const masjids: Masjid[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const date = todayIn();

  const changes: string[] = [];
  const unresolved: string[] = [];

  for (const masjid of masjids) {
    const rule = masjid.iqamah?.asr;
    if (!rule || rule.type !== "fixed" || !rule.time) continue;

    const iqamah = clockMinutes(rule.time);
    if (iqamah == null) continue;

    const gaps: Record<Madhabs, number> = {
      hanafi: iqamah - asrMinutes(masjid, "hanafi", date),
      shafi: iqamah - asrMinutes(masjid, "shafi", date),
    };

    // A congregation cannot precede its own adhan, so a negative gap rules
    // that school out entirely rather than merely scoring worse.
    const viable = (["hanafi", "shafi"] as Madhabs[]).filter(
      (m) => gaps[m] >= 0 && gaps[m] <= MAX_BELIEVABLE_GAP,
    );

    if (viable.length === 0) {
      unresolved.push(
        `${masjid.name}: neither school fits (hanafi ${gaps.hanafi}, shafi ${gaps.shafi}) — left as ${masjid.calc.madhab}`,
      );
      continue;
    }

    const best = viable.reduce((a, b) => (gaps[a] <= gaps[b] ? a : b));
    if (best === masjid.calc.madhab) continue;

    changes.push(
      `${masjid.name}: ${masjid.calc.madhab} -> ${best}  (hanafi gap ${gaps.hanafi}min, shafi gap ${gaps.shafi}min)`,
    );
    masjid.calc.madhab = best;
  }

  for (const line of changes) console.log(`  ${line}`);
  console.log(`\n${changes.length} madhab corrections`);
  if (unresolved.length) {
    console.log(`\nleft alone, no school fits:\n  ${unresolved.join("\n  ")}`);
  }

  const counts = masjids.reduce<Record<string, number>>((acc, m) => {
    acc[m.calc.madhab] = (acc[m.calc.madhab] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nresulting split: ${JSON.stringify(counts)}`);

  if (write) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(masjids, null, 2) + "\n");
    console.log(`\nwrote ${DATA_FILE}`);
  } else {
    console.log(`\ndry run — pass --write to apply`);
  }
}

main();
