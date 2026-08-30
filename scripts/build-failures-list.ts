/**
 * Collects every mosque the two discovery runs could NOT read, with its
 * website and the reason, into scripts/needs-checking/ — so the ones worth a
 * second look aren't lost in a workflow log that expires.
 *
 * Split by reason, because the two failures need different work:
 *  - "site could not be opened" is often transient (a slow host, a cert
 *    hiccup, a site down that hour) and is worth simply re-running.
 *  - "no times found" means the page loaded and genuinely had no timetable on
 *    it. Re-running changes nothing; someone has to look for the real prayer
 *    times page by hand, or accept the mosque doesn't publish them.
 *
 * Run: npx tsx scripts/build-failures-list.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "needs-checking");
const LOG = path.join(HERE, "discovery-failures-raw.txt");

interface Row {
  name: string;
  website: string;
  reason: string;
  source: string;
}

function websiteIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const [file, key] of [
    ["google-places-mosques.json", "website"],
    ["ontario-mosques.json", "website"],
  ] as const) {
    const full = path.join(HERE, file);
    if (!fs.existsSync(full)) continue;
    for (const m of JSON.parse(fs.readFileSync(full, "utf8"))) {
      if (m[key]) index.set(m.name, m[key]);
    }
  }
  return index;
}

function main() {
  if (!fs.existsSync(LOG)) {
    console.error(`${LOG} not found — it holds the FAILED lines from both workflow runs.`);
    process.exit(1);
  }

  const sites = websiteIndex();
  const rows: Row[] = [];
  const noWebsite: string[] = [];

  for (const line of fs.readFileSync(LOG, "utf8").trim().split("\n")) {
    const m = line.match(/^\[(google-places|osm-ontario)\] (.+?): FAILED — (.+)$/);
    if (!m) throw new Error("unparsed: " + line);
    const [, source, name, reason] = m;
    const website = sites.get(name);
    if (!website) {
      noWebsite.push(name);
      continue;
    }
    rows.push({ name, website, reason, source });
  }

  const couldNotOpen = rows.filter((r) => r.reason.includes("could not be opened"));
  const noTimes = rows.filter((r) => !r.reason.includes("could not be opened"));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(OUT_DIR, "site-would-not-open.json"),
    JSON.stringify(
      {
        what: "The site never loaded. Often transient — worth re-running before any manual work.",
        collected: "2026-08-29",
        count: couldNotOpen.length,
        mosques: couldNotOpen,
      },
      null,
      2,
    ) + "\n",
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "no-times-on-page.json"),
    JSON.stringify(
      {
        what:
          "The page loaded but carried no timetable. Re-running will not help — " +
          "someone has to find the real prayer-times page, or accept that this " +
          "mosque does not publish times online.",
        collected: "2026-08-29",
        count: noTimes.length,
        mosques: noTimes,
      },
      null,
      2,
    ) + "\n",
  );

  // One flat list of just name + link, for opening them one by one by hand.
  const lines = [
    "# Mosques with no prayer times yet (2026-08-29)",
    "",
    `## Site would not load — try re-running first (${couldNotOpen.length})`,
    "",
    ...couldNotOpen.map((r) => `- [${r.name}](${r.website})`),
    "",
    `## Page loaded but had no times — needs a human (${noTimes.length})`,
    "",
    ...noTimes.map((r) => `- [${r.name}](${r.website}) — ${r.reason}`),
    "",
  ];
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), lines.join("\n"));

  console.log(`wrote ${OUT_DIR}/`);
  console.log(`  site-would-not-open.json  ${couldNotOpen.length}`);
  console.log(`  no-times-on-page.json     ${noTimes.length}`);
  console.log(`  README.md                 ${couldNotOpen.length + noTimes.length} links`);
  if (noWebsite.length) {
    console.log(`\nno website on file (not written): ${noWebsite.length}`);
    for (const n of noWebsite) console.log(`  ${n}`);
  }
}

main();
