/**
 * A one-off read of the Ontario mosques found via Google Places
 * (discover-google-places.ts) and confirmed both new AND safe to scrape by
 * import-google-places.ts — not a data source for the Toronto app. This
 * writes a plain report, never touches src/data/masjids.json, and adds
 * nothing to the app's Toronto-scoped location model. Whether any of these
 * become part of the app is a separate decision, not made here.
 *
 * "Safe to scrape" already excludes results outside Ontario, ones matching
 * a mosque already tracked (in masjids.json or the OSM candidate list), ones
 * with no Islam-related term in their name or site, and ones whose only
 * website is a shared national-organization homepage rather than their own
 * page — see import-google-places.ts for why each of those exists.
 *
 * Reuses the real extraction pipeline from scrape.ts (capturePage, readTimes,
 * checkResult, hasTimetableText) rather than a second copy of it, so a page
 * that passes here is held to the same bar as a Toronto masjid would be, and
 * follows a link when the homepage doesn't have today's times, the same as
 * every other crawl in this project.
 *
 * This cannot run from Claude's own sandbox: outbound network there is
 * allowlisted and blocks arbitrary sites. It needs to run somewhere with
 * real internet — your own machine, or the manual GitHub Action
 * (.github/workflows/scrape-google-places-manual.yml) for when there's no
 * computer to run it from.
 *
 * Run:
 *   npx playwright install chromium      # once, if not already installed
 *   ANTHROPIC_API_KEY=... npx tsx scripts/scrape-google-places.ts
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
const INPUT = path.join(HERE, "google-places-mosques.json");
const OUTPUT = path.join(HERE, "google-places-mosques-report.json");

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
        "and run again as: ANTHROPIC_API_KEY=sk-... npx tsx scripts/scrape-google-places.ts",
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
