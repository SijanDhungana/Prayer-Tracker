/**
 * scrape.ts — daily masjid prayer-time scraper
 *
 * Strategy (works for plain HTML, JS widgets, AND image/PDF schedules):
 *   1. Render each masjid's site in a real browser (Playwright), so widget
 *      JavaScript runs and the times actually appear on the page.
 *   2. Capture a full-page screenshot + the visible text.
 *   3. Ask Claude to read the adhan + iqamah + jummah times out of the
 *      screenshot/text and return strict JSON. Because Claude can SEE the
 *      screenshot, this handles widgets and image-based schedules too.
 *   4. Validate, then merge into masjids.json. If a site fails or the result
 *      looks low-confidence, keep the previous value and flag it for review —
 *      never overwrite good data with garbage. Wrong times matter here.
 *
 * Run locally:  ANTHROPIC_API_KEY=... npx tsx scrape.ts
 * Runs daily via .github/workflows/daily-scrape.yml
 *
 * Model + SDK reference: https://docs.claude.com/en/api/overview
 */

import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "node:fs/promises";
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";

// Swap to "claude-haiku-4-5-20251001" to cut cost; confirm the current id at
// https://docs.claude.com/en/docs/about-claude/models
const MODEL = "claude-sonnet-5";
const DATA_FILE = "./src/data/masjids.json";
const POLITE_DELAY_MS = 3000; // be kind to masjid servers between requests

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

type IqamahRule =
  | { type: "fixed"; time: string }
  | { type: "offset"; minutes: number };

interface Masjid {
  id: string;
  name: string;
  website: string;
  lat: number;
  lng: number;
  address?: string;
  /** Page the times actually live on, when it isn't the homepage. */
  timesUrl?: string;
  calc: { method: string; madhab: "hanafi" | "shafi" };
  iqamah?: Record<string, IqamahRule | undefined>;
  jumuah?: { khutbah: string }[];
  lastVerified?: string | null;
  needsReview?: boolean;
  source?: string;
}

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
type Prayer = (typeof PRAYERS)[number];

const TZ = "America/Toronto";

const EXTRACTION_PROMPT = `You are reading a mosque (masjid) website to extract today's prayer times.
You are given the page's visible text and a screenshot. Use the SCREENSHOT as the
source of truth (times are often in an image or JS widget that the text misses).

Return ONLY a JSON object, no prose, no markdown fences, with this exact shape:
{
  "found": boolean,              // true only if you clearly see prayer times
  "confidence": number,          // 0-1, how sure you are
  "iqamah": {                    // congregation times, 24h "HH:mm". null if not shown.
    "fajr": "HH:mm" | null,
    "dhuhr": "HH:mm" | null,
    "asr": "HH:mm" | null,
    "maghrib": "HH:mm" | null,
    "isha": "HH:mm" | null
  },
  "jumuah": ["HH:mm", ...]        // Friday khutbah time(s), may be empty
}
Rules:
- Iqamah = the congregation/jamaah time, NOT the athan/adhan/"begins" time. If both
  are shown, take the iqamah column.
- CONVERT TO 24-HOUR TIME. Masjid schedules usually omit am/pm. Use these facts:
  Fajr is before sunrise (03:00-07:00). Dhuhr, Asr, Maghrib and Isha are ALL in the
  afternoon or evening — every one of them is 12:00 or later in 24-hour time, and
  they run in ascending order. So a Dhuhr shown as "1:45" is 13:45, an Asr shown as
  "7:00" is 19:00, a Maghrib shown as "8:30" is 20:30, an Isha shown as "10:25" is
  22:25. Never return 01:45 for Dhuhr or 08:30 for Maghrib.
- Jummah/Friday khutbah is a midday prayer: always between 11:00 and 17:00 in
  24-hour time. A Jummah shown as "1:50" is 13:50, never 01:50.
- If a time is genuinely not on the page, use null. Do not guess.
- If you cannot find prayer times at all, return found=false and all nulls.`;

async function extractFromSite(url: string): Promise<any | null> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      userAgent:
        "MasjidTimesBot/1.0 (personal prayer-time aggregator; contact: you@example.com)",
    });
    // "networkidle" never settles on pages that poll or stream analytics, which
    // times the whole read out even though the times rendered long ago. Wait for
    // the DOM instead, then give widget JS a fixed window to paint.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    const screenshot = await page.screenshot({ fullPage: true }); // Buffer (PNG)
    const text = (await page.innerText("body")).slice(0, 6000);

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshot.toString("base64"),
              },
            },
            { type: "text", text: `Page text:\n${text}` },
          ],
        },
      ],
    });

    const raw = msg.content.find((b) => b.type === "text")?.text ?? "";
    const json = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(json);
  } catch (err) {
    console.warn(`  ✗ ${url} — ${(err as Error).message}`);
    return null;
  } finally {
    await browser.close();
  }
}

// Basic sanity checks so bad reads never overwrite good data.
const isTime = (t: unknown): t is string =>
  typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** Minutes past midnight, read on Toronto's clock (this runs on a UTC box). */
function torontoMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);

  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);

  return (value("hour") % 24) * 60 + value("minute");
}

const clockMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Today's adhan times for a masjid, keyed by prayer. */
function adhanMinutesFor(masjid: Masjid): Record<Prayer, number> {
  const params =
    masjid.calc.method in CalculationMethod
      ? CalculationMethod[masjid.calc.method as keyof typeof CalculationMethod]()
      : CalculationMethod.NorthAmerica();
  params.madhab = masjid.calc.madhab === "shafi" ? Madhab.Shafi : Madhab.Hanafi;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const today = new Date(value("year"), value("month") - 1, value("day"));

  const t = new PrayerTimes(
    new Coordinates(masjid.lat, masjid.lng),
    today,
    params,
  );

  return {
    fajr: torontoMinutes(t.fajr),
    dhuhr: torontoMinutes(t.dhuhr),
    asr: torontoMinutes(t.asr),
    maghrib: torontoMinutes(t.maghrib),
    isha: torontoMinutes(t.isha),
  };
}

/**
 * A congregation cannot be called before the prayer time it belongs to has
 * begun, so an iqamah earlier than its own adhan is always a misread — most
 * often the model picked up a neighbouring column or yesterday's row. Drop the
 * offending prayer rather than the whole read; the previous value survives.
 */
function rejectImpossible(masjid: Masjid, iqamah: Record<string, string | null>) {
  const adhan = adhanMinutesFor(masjid);
  const rejected: string[] = [];

  for (const prayer of PRAYERS) {
    const scraped = iqamah[prayer];
    if (!scraped || !isTime(scraped)) continue;
    if (clockMinutes(scraped) < adhan[prayer]) {
      rejected.push(`${prayer} ${scraped} < adhan`);
      iqamah[prayer] = null;
    }
  }

  return rejected;
}

/**
 * Jummah replaces Dhuhr, so a khutbah is always around midday. Anything outside
 * this window is a misread — in practice an afternoon time the model failed to
 * convert to 24-hour ("1:50" written as 01:50 instead of 13:50).
 */
const JUMUAH_EARLIEST = 11 * 60;
const JUMUAH_LATEST = 17 * 60;

function plausibleJumuah(times: string[]): string[] {
  return times.filter((t) => {
    if (!isTime(t)) return false;
    const minutes = clockMinutes(t);
    return minutes >= JUMUAH_EARLIEST && minutes <= JUMUAH_LATEST;
  });
}

function looksValid(result: any): boolean {
  if (!result?.found || (result.confidence ?? 0) < 0.5) return false;
  const iq = result.iqamah ?? {};
  const times = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
    .map((p) => iq[p])
    .filter((t: unknown) => t != null);
  // require at least 3 of 5 to be plausible times
  return times.length >= 3 && times.every(isTime);
}

async function main() {
  const masjids: Masjid[] = JSON.parse(await readFile(DATA_FILE, "utf8"));
  // Toronto's date, not the runner's UTC one — after 8pm they differ.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  for (const m of masjids) {
    const target = m.timesUrl ?? m.website;
    if (!target) continue;
    console.log(`Scraping ${m.name} …`);
    const result = await extractFromSite(target);

    if (result && looksValid(result)) {
      const scraped: Record<string, string | null> = { ...result.iqamah };
      const rejected = rejectImpossible(m, scraped);

      const previous = m.iqamah ?? {};
      const merged: Record<string, IqamahRule | undefined> = {};
      let kept = 0;

      for (const prayer of PRAYERS) {
        const time = scraped[prayer];
        if (time && isTime(time)) {
          merged[prayer] = { type: "fixed", time };
        } else if (previous[prayer]) {
          // No usable read for this prayer — never write a null through.
          merged[prayer] = previous[prayer];
          kept++;
        }
      }

      m.iqamah = merged;

      if (Array.isArray(result.jumuah)) {
        const usable = plausibleJumuah(result.jumuah);
        if (usable.length === result.jumuah.length && usable.length > 0) {
          m.jumuah = result.jumuah.map((t: string) => ({ khutbah: t }));
        } else if (result.jumuah.length > 0) {
          // Keep the previous Friday times rather than writing a bad read.
          rejected.push(`jumuah ${result.jumuah.join("/")} implausible`);
        }
      }

      m.lastVerified = today;
      m.needsReview = rejected.length > 0 || kept > 0;
      m.source = "scrape";

      if (rejected.length) {
        console.log(`  ⚠ updated, rejected impossible: ${rejected.join(", ")}`);
      } else if (kept) {
        console.log(`  ⚠ updated, ${kept} prayer(s) had no reading`);
      } else {
        console.log(`  ✓ updated`);
      }
    } else {
      // Keep whatever was there before; just flag it.
      m.needsReview = true;
      console.log(`  ⚠ kept previous data, flagged for review`);
    }

    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  }

  await writeFile(DATA_FILE, JSON.stringify(masjids, null, 2) + "\n");
  const reviewed = masjids.filter((m) => m.needsReview).length;
  console.log(`\nDone. ${masjids.length - reviewed} updated, ${reviewed} need review.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
