/**
 * Read prayer times off the Texas mosques that OSM gave us a website for.
 *
 * This is scrape-dfw.ts pointed at a bigger, machine-built list. It writes a
 * plain report and never touches src/data/masjids.json — Texas is not part of
 * the app's Toronto-scoped model, and whether it ever becomes a second city
 * is an open question (CLAUDE.md §16), not one this script decides.
 *
 * It reuses the real pipeline from scrape.ts — capturePage, readTimes,
 * checkResult, hasTimetableText — rather than a second copy, so a page that
 * passes here clears the same bar a Toronto masjid would: same "prayer copied
 * into every slot" and "times out of order" rejections. A weaker parallel
 * implementation would let Texas and Toronto disagree for reasons that have
 * nothing to do with what the sites publish.
 *
 * Input is scripts/texas-mosques.json, produced by import-osm-texas.ts. Run
 * that first. It deliberately contains only entries with a website — the ~73
 * without one need a discovery pass before a scraper can do anything at all.
 *
 * This cannot run from Claude's own sandbox: outbound network there is
 * allowlisted and blocks arbitrary sites. It needs real internet — your own
 * machine.
 *
 * Run:
 *   npx playwright install chromium              # once, if not already
 *   npx tsx scripts/import-osm-texas.ts          # build the candidate list
 *   npx tsx scripts/scrape-texas.ts              # ANTHROPIC_API_KEY from .env
 *   npx tsx scripts/scrape-texas.ts --limit 3    # cheap smoke test first
 *
 * Costs one Claude call per page read (Sonnet) — pennies for this list.
 */
import { chromium, type Browser } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  capturePage,
  checkResult,
  hasTimetableText,
  MAX_PAGES_PER_MASJID,
  POLITE_DELAY_MS,
  readTimes,
} from "../scrape.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(HERE, "texas-mosques.json");
const OUTPUT = path.join(HERE, "texas-mosques-report.json");

interface Candidate {
  name: string | null;
  website: string;
  lat: number;
  lng: number;
  address: string | null;
  /** Absent on rows that came from Google Places rather than OSM. */
  osmIds?: string[];
}

interface Row {
  name: string;
  website: string;
  osmIds?: string[];
  ok: boolean;
  reason?: string;
  foundAt?: string;
  iqamah?: Record<string, string | null>;
  jumuah?: string[];
  capturedVia?: string;
}

/**
 * The same crawl findTimes() runs for a Toronto masjid: try the homepage, and
 * if it does not carry today's times, follow a link found ON THE PAGE — never
 * a guessed URL — up to MAX_PAGES_PER_MASJID pages. Following real links is
 * what rescued McKinney Islamic Association in the DFW pass, where a homepage
 * had a Prayer Times link the first version never followed.
 */
async function findTimes(
  browser: Browser,
  homepage: string,
): Promise<
  { ok: true; result: any; url: string; capturedVia: string } | { ok: false; reason: string }
> {
  const tried = new Set<string>();
  const queue: string[] = [homepage];
  let firstReason = "site could not be opened";

  while (queue.length && tried.size < MAX_PAGES_PER_MASJID) {
    const url = queue.shift()!;
    if (tried.has(url)) continue;
    tried.add(url);

    const capture = await capturePage(browser, url);
    if (!capture) continue;

    const result = await readTimes(capture);
    const verdict = checkResult(result);

    if (verdict.ok) return { ok: true, result, url, capturedVia: capture.shot };

    if (tried.size === 1) {
      firstReason = verdict.reason;

      // The homepage plainly carries a timetable and still failed — a subpage
      // is usually a worse read (a month-long grid), not a better one, so
      // report the real failure instead of burning two more page loads.
      if (hasTimetableText(capture.text)) {
        return {
          ok: false,
          reason:
            `${verdict.reason} (page text holds ${capture.signals.prayers} prayer names ` +
            `and ${capture.signals.times} times, shot ${capture.shot} ` +
            `${capture.shotSize.width}x${capture.shotSize.height})`,
        };
      }

      queue.push(...capture.timesLinks);
    }

    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  }

  return { ok: false, reason: firstReason };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is not set. It is in this project's .env — run as:\n" +
        "  set -a && source .env && set +a && npx tsx scripts/scrape-texas.ts",
    );
    process.exit(1);
  }

  const limitFlag = process.argv.indexOf("--limit");
  const limit = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : Infinity;
  if (Number.isNaN(limit) || limit <= 0) {
    console.error("--limit needs a positive number");
    process.exit(1);
  }

  const all: Candidate[] = JSON.parse(readFileSync(INPUT, "utf8"));

  // A re-run after the candidate list has grown reads the additions, not the
  // masjids that already have a row in the report — each read is a Claude
  // call and a page load against someone's server. --all re-reads everything,
  // which is what a genuine refresh wants.
  const previous: Row[] = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, "utf8")) : [];
  const done = new Set(previous.map((r) => r.website));
  const pending = process.argv.includes("--all") ? all : all.filter((m) => !done.has(m.website));
  if (pending.length < all.length) {
    console.log(`Skipping ${all.length - pending.length} already in the report (pass --all to re-read them).\n`);
  }

  const mosques = pending.slice(0, limit === Infinity ? undefined : limit);
  if (mosques.length < pending.length) {
    // Never let a truncated run read as full coverage.
    console.log(`--limit ${limit}: reading ${mosques.length} of ${pending.length}. NOT a full run.\n`);
  }

  const browser = await chromium.launch();
  const rows: Row[] = [];

  for (const mosque of mosques) {
    // Unnamed entries survive the import when a merge gave them a website;
    // the OSM id is the only honest label for them.
    // Google-sourced rows carry no OSM id; the site is the only stable label.
    const label = mosque.name ?? `(unnamed) ${mosque.osmIds?.[0] ?? mosque.website}`;
    console.log(`Reading ${label} …`);
    const found = await findTimes(browser, mosque.website);
    const base = { name: label, website: mosque.website, osmIds: mosque.osmIds };

    if (!found.ok) {
      rows.push({ ...base, ok: false, reason: found.reason });
      console.log(`  ✗ ${found.reason}`);
      await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
      continue;
    }

    rows.push({
      ...base,
      ok: true,
      iqamah: found.result.iqamah,
      jumuah: Array.isArray(found.result.jumuah) ? found.result.jumuah : [],
      capturedVia: found.capturedVia,
      ...(found.url !== mosque.website ? { foundAt: found.url } : {}),
    });
    console.log(
      `  ✓ read via ${found.capturedVia}` +
        (found.url !== mosque.website ? ` (followed a link to ${found.url})` : ""),
    );

    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  }

  await browser.close();

  // This run's rows replace their earlier versions; everything else in the
  // report is kept, so the file stays the whole picture rather than the last
  // batch.
  const fresh = new Set(rows.map((r) => r.website));
  const merged = [...previous.filter((r) => !fresh.has(r.website)), ...rows];
  writeFileSync(OUTPUT, JSON.stringify(merged, null, 2) + "\n");

  const ok = rows.filter((r) => r.ok);
  const okAll = merged.filter((r) => r.ok);
  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `Read ${ok.length}/${rows.length} this run · report now ${okAll.length}/${merged.length}: ${OUTPUT}\n`,
  );
  for (const r of rows) {
    if (r.ok) {
      const iq = r.iqamah!;
      console.log(
        `${r.name}: Fajr ${iq.fajr ?? "—"}  Dhuhr ${iq.dhuhr ?? "—"}  Asr ${iq.asr ?? "—"}  ` +
          `Maghrib ${iq.maghrib ?? "—"}  Isha ${iq.isha ?? "—"}` +
          (r.jumuah?.length ? `  Jumu'ah ${r.jumuah.join(", ")}` : ""),
      );
    } else {
      console.log(`${r.name}: FAILED — ${r.reason}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
