/**
 * A one-off read of the 26 DFW mosques listed in the PDF the user uploaded —
 * not a data source for the Toronto app. This writes a plain report, never
 * touches src/data/masjids.json, and adds nothing to the app's Toronto-scoped
 * location model. Whether DFW becomes a second city, a separate project, or
 * neither is an open question raised in conversation and not decided here;
 * this only answers "what do these sites actually publish."
 *
 * Reuses the real extraction pipeline from scrape.ts (capturePage, readTimes,
 * checkResult) rather than a second copy of it, so a page that passes here is
 * held to the same bar as a Toronto masjid would be — same validation, same
 * "prayer copied into every slot" and "times out of order" checks.
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
 * billed per call (Sonnet, ~26 calls here — a few cents).
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { capturePage, checkResult, readTimes } from "../scrape.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(HERE, "dfw-mosques.json");
const OUTPUT = path.join(HERE, "dfw-mosques-report.json");
const POLITE_DELAY_MS = 3000;

interface Mosque {
  name: string;
  website: string;
}

interface Row {
  name: string;
  website: string;
  ok: boolean;
  reason?: string;
  iqamah?: Record<string, string | null>;
  jumuah?: string[];
  capturedVia?: string;
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
    const capture = await capturePage(browser, mosque.website);

    if (!capture) {
      rows.push({ ...mosque, ok: false, reason: "site could not be opened" });
      console.log(`  ✗ site could not be opened`);
      await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
      continue;
    }

    const result = await readTimes(capture);
    const verdict = checkResult(result);

    if (verdict.ok) {
      rows.push({
        ...mosque,
        ok: true,
        iqamah: result.iqamah,
        jumuah: Array.isArray(result.jumuah) ? result.jumuah : [],
        capturedVia: capture.shot,
      });
      console.log(`  ✓ read via ${capture.shot}`);
    } else {
      rows.push({ ...mosque, ok: false, reason: verdict.reason });
      console.log(`  ✗ ${verdict.reason}`);
    }

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
