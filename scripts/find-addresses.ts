/**
 * Find the street address for masjids that name-based geocoding could not place.
 *
 * The 2026-08-31 audit produced masjids with verified times but no coordinates,
 * and Nominatim could not resolve them from a name. Worse, it resolved three of
 * them *plausibly and wrongly* — "Muslim Society of Guelph" came back as Masjid
 * Aisha and "Halton Islamic Association" as Muslim Association of Milton, both
 * already in this app under their own entries. A silent duplicate carrying
 * another masjid's prayer times is exactly the failure CLAUDE.md §14 is about,
 * so name-guessing is abandoned here in favour of reading the masjid's own site.
 *
 * A masjid's own contact page is the authority on where it is. This loads the
 * homepage, follows a contact/about/location link found ON THE PAGE (never a
 * guessed URL), and asks Claude for the postal address in the page text.
 *
 * It does not reuse capturePage() from scrape.ts: that function exists to find
 * and crop a *timetable* element, and its settle-and-reveal logic is tuned for
 * widgets that load times. An address is plain text in a footer or a contact
 * block, so this reads page text directly and never screenshots.
 *
 * Writes a report only. Nothing here touches src/data/masjids.json — every
 * address still has to be geocoded and validated before it can become an entry.
 *
 * Run:
 *   set -a && source .env && set +a && npx tsx scripts/find-addresses.ts
 */
import { chromium, type Browser } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POLITE_DELAY_MS } from "../scrape.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(HERE, "found-addresses.json");
const MODEL = "claude-sonnet-5";
const anthropic = new Anthropic();

/** Masjids with verified times from the audit but no usable coordinates. */
const TARGETS = [
  { name: "Mevlana Masjid", site: "https://a-than.info/vv.php?code=MEVLANA01" },
  { name: "Islamic Research Center of Canada", site: "http://www.irccan.com/" },
  { name: "Muslim Society of Guelph", site: "http://www.msofg.org/" },
  { name: "Masjid Al-Abrar", site: "http://www.alabrar.ca/" },
  { name: "Masjid Subhan (both locations)", site: "https://www.subhanislamicassociation.org/" },
  { name: "Islamic Centre of Northern Ontario", site: "https://iconosudbury.com/" },
  { name: "Halton Islamic Association", site: "https://www.hia.live/" },
  { name: "Dar Al-Hijrah Islamic Center", site: "https://darulhijra.org/" },
];

const CONTACT_LINK = /contact|about|location|visit|find\s?us|directions|address/i;
const MAX_PAGES = 3;

const PROMPT = `You are reading a mosque's own website to find its STREET ADDRESS.

Return strict JSON only:
{"addresses": [{"label": "<location name, or null if the masjid has only one>", "address": "<full street address as printed>"}], "confidence": "high" | "low"}

Rules:
- Copy the address as the page prints it. Do not normalise, expand, or guess a postal code.
- A masjid with several locations gets one entry per location, each with a label.
- If no postal address appears anywhere in the text, return {"addresses": [], "confidence": "low"}.
- A phone number, an email, or a city name alone is NOT an address. Do not invent one.
- Never return an address you did not read in the text.`;

async function pageText(browser: Browser, url: string) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        text: (a.textContent ?? "").trim(),
        href: (a as HTMLAnchorElement).href,
      })),
    );
    return { text, links };
  } catch (e) {
    return { text: "", links: [], error: (e as Error).message.split("\n")[0] };
  } finally {
    await page.close();
  }
}

async function readAddress(name: string, text: string) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: PROMPT,
    messages: [{ role: "user", content: `MASJID: ${name}\n\nPAGE TEXT:\n${text.slice(0, 24_000)}` }],
  });
  const raw = msg.content.find((b) => b.type === "text")?.text ?? "";
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Run: set -a && source .env && set +a && npx tsx scripts/find-addresses.ts");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const rows: any[] = [];

  for (const t of TARGETS) {
    console.log(`\n${t.name}`);
    const seen = new Set<string>();
    let combined = "";
    let firstError: string | undefined;

    const home = await pageText(browser, t.site);
    if (home.error) firstError = home.error;
    seen.add(t.site);
    combined += home.text;

    // Follow contact-ish links found on the page, never a guessed /contact URL.
    const follow = home.links
      .filter((l) => CONTACT_LINK.test(l.text) || CONTACT_LINK.test(l.href))
      .map((l) => l.href)
      .filter((h) => h.startsWith("http") && !seen.has(h))
      .slice(0, MAX_PAGES - 1);

    for (const href of follow) {
      seen.add(href);
      await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
      const sub = await pageText(browser, href);
      if (sub.text) combined += `\n\n--- ${href} ---\n${sub.text}`;
    }

    if (!combined.trim()) {
      console.log(`  ✗ no page text${firstError ? ` — ${firstError}` : ""}`);
      rows.push({ ...t, ok: false, reason: firstError ?? "no readable page text" });
      await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
      continue;
    }

    const result = await readAddress(t.name, combined);
    const found = result?.addresses ?? [];
    if (!found.length) {
      console.log(`  ✗ no address printed on the site`);
      rows.push({ ...t, ok: false, reason: "no postal address found in page text", pagesRead: [...seen] });
    } else {
      for (const a of found) console.log(`  ✓ ${a.label ? a.label + ": " : ""}${a.address}`);
      rows.push({ ...t, ok: true, confidence: result.confidence, addresses: found, pagesRead: [...seen] });
    }
    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  }

  await browser.close();
  writeFileSync(OUTPUT, JSON.stringify(rows, null, 2) + "\n");
  const ok = rows.filter((r) => r.ok).length;
  console.log(`\n${"=".repeat(56)}\nFound addresses for ${ok}/${rows.length}. Report: ${OUTPUT}`);
  console.log("Every address still needs geocoding and validation before it becomes an entry.");
}

main().catch((e) => { console.error(e); process.exit(1); });
