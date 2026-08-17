/**
 * Merge a hand-verified browser session's iqamah times into masjids.json.
 *
 * Same purpose as import-spreadsheet.ts — someone (this time via a live
 * browser session rather than a spreadsheet) visited every masjid's site and
 * recorded what it published — but a different payload shape: 12h clock
 * strings, "zuhr" instead of "dhuhr", a Maghrib offset already computed
 * rather than a clock time to convert, and khutbah/salah pairs for Jumu'ah
 * instead of a single time. The merge rules below exist because a snapshot
 * of one day is not automatically safe to write over what is already there.
 *
 * Run: npx tsx scripts/import-browser-verification.ts <payload.json> [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(HERE, "..", "src", "data", "masjids.json");

type IqamahRule =
  | { type: "fixed"; time: string }
  | { type: "offset"; minutes: number };

interface Masjid {
  id: string;
  name: string;
  website?: string;
  calc: { method: string; madhab: string };
  iqamah: Record<string, IqamahRule | undefined>;
  jumuah?: { khutbah: string }[];
  lastVerified?: string;
  needsReview?: boolean;
  source?: string;
}

interface PayloadJumuah {
  khutbah?: string;
  salah?: string;
  note?: string;
}

interface PayloadEntry {
  name: string;
  website: string;
  manual_only?: boolean;
  note?: string;
  fajr?: string;
  zuhr?: string;
  asr?: string;
  isha?: string;
  maghrib_offset_min?: number;
  jumuah?: PayloadJumuah[];
  review_flag?: string;
}

interface Payload {
  asOfDate: string;
  masjids: PayloadEntry[];
}

/** "5:45 AM" -> "05:45". Rejects anything that isn't a clean 12h time. */
function to24h(raw: string): string | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw.trim());
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
  const payloadPath = process.argv[2];
  const write = process.argv.includes("--write");
  if (!payloadPath) {
    console.error("usage: import-browser-verification.ts <payload.json> [--write]");
    process.exit(1);
  }

  const payload: Payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const masjids: Masjid[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  const byDomain = new Map<string, Masjid>();
  for (const m of masjids) {
    if (m.website) byDomain.set(domain(m.website), m);
  }

  const unmatched: string[] = [];
  const touched = new Set<string>();
  let changes = 0;

  for (const entry of payload.masjids) {
    if (entry.manual_only) {
      console.log(`\n${entry.name}\n  SKIPPED — ${entry.note ?? "manual only"}`);
      continue;
    }

    const masjid = byDomain.get(domain(entry.website));
    if (!masjid) {
      unmatched.push(`${entry.name} (${entry.website})`);
      continue;
    }

    const lines: string[] = [];

    const daily: [string, string | undefined][] = [
      ["fajr", entry.fajr],
      ["dhuhr", entry.zuhr],
      ["asr", entry.asr],
      ["isha", entry.isha],
    ];

    for (const [prayer, raw] of daily) {
      if (!raw) continue;
      const time = to24h(raw);
      if (!time) {
        lines.push(`  ${prayer}: unparsed "${raw}" — kept ${describe(masjid.iqamah[prayer])}`);
        continue;
      }
      const before = describe(masjid.iqamah[prayer]);
      if (before !== time) lines.push(`  ${prayer}: ${before} -> ${time}`);
      masjid.iqamah[prayer] = { type: "fixed", time };
    }

    /**
     * Maghrib arrives pre-computed as an offset, which is normally the more
     * trustworthy shape to write — except when the verifier says so
     * themselves that the offset is an assumption rather than something the
     * site actually showed. Townline's entry says exactly that ("assumed 0,
     * verify"), and the file already holds a same-week value from a live
     * scrape that made no such admission. A flagged guess must not overwrite
     * unflagged, fresher data.
     */
    if (entry.maghrib_offset_min != null) {
      const isGuess = /assum/i.test(entry.review_flag ?? "");
      if (isGuess) {
        lines.push(
          `  maghrib: KEPT ${describe(masjid.iqamah.maghrib)} — verifier flagged this offset as an assumption, not observed`,
        );
      } else {
        const next: IqamahRule = { type: "offset", minutes: entry.maghrib_offset_min };
        const before = describe(masjid.iqamah.maghrib);
        const after = describe(next);
        if (before !== after) lines.push(`  maghrib: ${before} -> ${after}`);
        masjid.iqamah.maghrib = next;
      }
    }

    /**
     * Jumu'ah: khutbah field wins when given, matching how the scraper
     * already populates this schema (confirmed against Towfiq, whose stored
     * khutbah times already equal this payload's khutbah times, not its
     * salah times). Falls back to salah only when a site showed one time.
     *
     * A sitting whose own entry admits a gap — Al-Jannah's single "3:10 PM"
     * carries "Jumuah 1 time not captured" — is a partial read of a masjid
     * that has more than one sitting. Writing it would replace two known
     * sittings with one, which is a downgrade dressed as an update, so the
     * whole masjid's Jumu'ah is left untouched whenever any sitting in the
     * payload says it is incomplete.
     */
    if (entry.jumuah && entry.jumuah.length > 0) {
      const incomplete = entry.jumuah.some((s) => s.note);
      const shrunk = !incomplete && entry.jumuah.length < (masjid.jumuah ?? []).length;

      if (incomplete) {
        lines.push(`  jumuah: KEPT — payload marks a sitting incomplete (${entry.jumuah.map((s) => s.note).filter(Boolean).join("; ")})`);
      } else {
        /**
         * khutbah is preferred (it's what this schema already stores — see
         * the module comment), but a masjid whose khutbah value repeats
         * across sittings while its salah times differ has an unreliable
         * khutbah read for this entry, not two identical sittings. Malton's
         * payload does exactly this: "1:23 PM" listed for both a 2:00 and a
         * 3:15 sitting. Deduplicating naively would silently drop a real
         * sitting, so a collision falls back to salah for the whole entry
         * rather than picking one arbitrary survivor.
         */
        const fromKhutbah = entry.jumuah.map((s) => to24h(s.khutbah ?? s.salah ?? ""));
        const collided =
          fromKhutbah.every((t) => t != null) &&
          new Set(fromKhutbah).size < entry.jumuah.length;

        const times = collided
          ? entry.jumuah.map((s) => to24h(s.salah ?? s.khutbah ?? ""))
          : fromKhutbah;

        const unique = new Set(times.filter((t): t is string => t != null));
        const stillCollided = unique.size < entry.jumuah.length;

        if (times.some((t) => t == null) || stillCollided) {
          lines.push(`  jumuah: unparsed or still-colliding entry — kept existing`);
        } else {
          if (collided) lines.push(`  jumuah: khutbah repeated across sittings — used salah instead`);
          const sittings = [...unique].sort();
          const before = (masjid.jumuah ?? []).map((s) => s.khutbah).join(", ");
          const after = sittings.join(", ");
          if (before !== after) lines.push(`  jumuah: [${before}] -> [${after}]`);
          if (shrunk) {
            lines.push(
              `  jumuah: NOTE — sitting count dropped ${(masjid.jumuah ?? []).length} -> ${sittings.length}, not flagged incomplete by the verifier; applied, but worth a second look`,
            );
          }
          masjid.jumuah = sittings.map((khutbah) => ({ khutbah }));
        }
      }
    } else {
      lines.push(`  jumuah: not observed — kept [${(masjid.jumuah ?? []).map((s) => s.khutbah).join(", ")}]`);
    }

    masjid.lastVerified = payload.asOfDate;
    masjid.needsReview = false;
    masjid.source = "manual";
    touched.add(masjid.id);

    if (entry.review_flag) lines.push(`  note: ${entry.review_flag}`);

    if (lines.length > 0) {
      changes += lines.length;
      console.log(`\n${masjid.name}`);
      console.log(lines.join("\n"));
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`matched ${touched.size}/${payload.masjids.length} entries, ${changes} field changes`);
  if (unmatched.length > 0) console.log(`unmatched:\n  ${unmatched.join("\n  ")}`);

  const missed = masjids.filter((m) => !touched.has(m.id));
  if (missed.length > 0) {
    console.log(`not in the payload (left alone):\n  ${missed.map((m) => m.name).join("\n  ")}`);
  }

  if (write) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(masjids, null, 2) + "\n");
    console.log(`\nwrote ${DATA_FILE}`);
  } else {
    console.log(`\ndry run — pass --write to apply`);
  }
}

main();
