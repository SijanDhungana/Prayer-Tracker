/**
 * A one-off read of the DFW mosques listed in the PDF the user uploaded —
 * not a data source for the Toronto app. This writes a plain report, never
 * touches src/data/masjids.json, and adds nothing to the app's Toronto-scoped
 * location model. Whether DFW becomes a second city, a separate project, or
 * neither is an open question raised in conversation and not decided here;
 * this only answers "what do these sites actually publish."
 *
 * Reuses the real extraction pipeline from scrape.ts (capturePage, readTimes,
 * checkResult, hasTimetableText) rather than a second copy of it, so a page
 * that passes here is held to the same bar as a Toronto masjid would be —
 * same validation, same "prayer copied into every slot" and "times out of
 * order" checks.
 *
 * It also now follows a link when the homepage doesn't have today's times,
 * the same as the Toronto crawl in findTimes() — the first version of this
 * script only ever looked at the homepage once, and McKinney Islamic
 * Association's "no times found" turned out to be exactly that: a homepage
 * with a Prayer Times link the script never followed. This is the same fix,
 * built the same way, so both crawls can only ever disagree because of what a
 * site actually publishes, not because DFW is running weaker logic.
 *
 * This cannot run from Claude's own sandbox: outbound network there is
 * allowlisted and blocks arbitrary sites, confirmed against two of these
 * domains before writing this file. It needs to run somewhere with real
 * internet — e.g. your own machine.
 *
 * Run:
 *   npx playwright install chromium      # once, if not already installed
 *   ANTHROPIC_API_KEY=... npx tsx scripts/scrape-dfw.ts
 *
 * Get an API key at https://console.anthropic.com/settings/keys if you don't
 * have one — this uses the same Anthropic API the daily Toronto scrape does,
 * billed per call (Sonnet, a few dozen calls here — a few cents).
 */
import { chromium, type Browser } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
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
const INPUT = path.join(HERE, "dfw-mosques.json");
const OUTPUT = path.join(HERE, "dfw-mosques-report.json");

interface Mosque {
  name: string;
  website: string;
}

interface Row {
  name: string;
  website: string;
  ok: boolean;
  reason?: string;
  foundAt?: string;
  iqamah?: Record<string, string | null>;
  jumuah?: string[];
  capturedVia?: string;
}

/**
 * The same crawl findTimes() in scrape.ts runs for a Toronto masjid: try the
 * homepage, and if it does not have today's times, follow a link found ON
 * THE PAGE (never a guessed URL) up to MAX_PAGES_PER_MASJID pages total. No
 * Ad-Din fast path here — nothing in the DFW list is confirmed to be on that
 * platform — and no "remembered timesUrl" carried between pages, since this
 * is a first read with nothing from a previous run to remember.
 */
async function findTimes(
  browser: Browser,
  homepage: string,
): Promise<
  | { ok: true; result: any; url: string; capturedVia: string }
  | { ok: false; reason: string }
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

    if (verdict.ok) {
      return { ok: true, result, url, capturedVia: capture.shot };
    }

    if (tried.size === 1) {
      firstReason = verdict.reason;

      // The homepage plainly carries a timetable and still failed — a
      // subpage is usually a worse read (a month-long grid), not a better
      // one, so report the real failure instead of burning two more loads.
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
      "ANTHROPIC_API_KEY is not set. Get one at https://console.anthropic.com/settings/keys " +
        "and run again as: ANTHROPIC_API_KEY=sk-... npx tsx scripts/scrape-dfw.ts",
    );
    process.exit(1);
  }

  const mosques: Mosque[] = JSON.parse(readFileSync(INPUT, "utf8"));
  const browser = await chromium.launch();
  const rows: Row[] = [];

  for (const mosque of mosques) {
    console.log(`Reading ${mosque.name} …`);
    const found = await findTimes(browser, mosque.website);

    if (!found.ok) {
      rows.push({ ...mosque, ok: false, reason: found.reason });
      console.log(`  ✗ ${found.reason}`);
      await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
      continue;
    }

    rows.push({
      ...mosque,
      ok: true,
      iqamah: found.result.iqamah,
      jumuah: Array.isArray(found.result.jumuah) ? found.result.jumuah : [],
      capturedVia: found.capturedVia,
      // Only recorded when the crawl actually had to leave the homepage —
      // worth knowing which sites needed it and which link won.
      ...(found.url !== mosque.website ? { foundAt: found.url } : {}),
    });
    console.log(
      `  ✓ read via ${found.capturedVia}` +
        (found.url !== mosque.website ? ` (followed a link to ${found.url})` : ""),
    );

    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  }

  await browser.close();
  writeFileSync(OUTPUT, JSON.stringify(rows, null, 2) + "\n");

  const ok = rows.filter((r) => r.ok);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Read ${ok.length}/${rows.length}. Full report: ${OUTPUT}\n`);
  for (const r of rows) {
    if (r.ok) {
      const iq = r.iqamah!;
      console.log(
        `${r.name}: Fajr ${iq.fajr ?? "—"}  Dhuhr ${iq.dhuhr ?? "—"}  Asr ${iq.asr ?? "—"}  ` +
          `Maghrib ${iq.maghrib ?? "—"}  Isha ${iq.isha ?? "—"}${r.jumuah?.length ? `  Jumu'ah ${r.jumuah.join(", ")}` : ""}`,
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
