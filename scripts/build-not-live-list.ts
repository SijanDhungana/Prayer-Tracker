/**
 * Every masjid we have discovered but that is NOT live in the app, grouped by
 * what is actually blocking it — because the groups need completely different
 * work and lumping them together hides that.
 *
 * "No website at all" is the wall: no scraper will ever reach those, so they
 * need a person to phone or visit. "Website but no times" is the tractable
 * pile. "Impossible times" and "a prayer would render blank" are the cheapest
 * wins — a handful of masjids, one website visit each.
 *
 * Writes scripts/not-live/ with a README.md that GitHub renders as clickable
 * links, plus the same data as JSON.
 *
 * Run: npx tsx scripts/build-not-live-list.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "not-live");
const MASJIDS = path.join(HERE, "..", "src", "data", "masjids.json");

interface Candidate {
  name: string;
  website: string | null;
  lat: number;
  lng: number;
  address: string | null;
  flag?: string;
}

interface Discovered {
  name: string;
  iqamah: Record<string, string | null>;
  needsReview?: string;
}

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(HERE, f), "utf8"));

/** Failure reasons recorded from the workflow logs, where we have them. */
function reasonIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const raw = path.join(HERE, "discovery-failures-raw.txt");
  if (!fs.existsSync(raw)) return index;
  for (const line of fs.readFileSync(raw, "utf8").trim().split("\n")) {
    const m = line.match(/^\[[^\]]+\] (.+?): FAILED — (.+)$/);
    if (m) index.set(m[1], m[2]);
  }
  return index;
}

function main() {
  const live = new Set(
    (JSON.parse(fs.readFileSync(MASJIDS, "utf8")) as { name: string }[]).map((m) => m.name),
  );
  const reasons = reasonIndex();

  const times = new Map<string, Discovered>();
  for (const f of fs
    .readdirSync(HERE)
    .filter((x) => /^discovered-prayer-times-\d{4}-\d{2}-\d{2}\.json$/.test(x))
    .sort()) {
    for (const m of read(f).mosques as Discovered[]) times.set(m.name, m);
  }

  const candidates: Candidate[] = [...read("ontario-mosques-new.json"), ...read("google-places-new.json")];

  const groups: Record<string, (Candidate & { detail?: string })[]> = {
    impossibleTimes: [],
    blankPrayer: [],
    noTimesFound: [],
    sharedHomepage: [],
    noWebsite: [],
  };

  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.name) || live.has(c.name)) continue;
    seen.add(c.name);

    const t = times.get(c.name);
    if (t?.needsReview) {
      groups.impossibleTimes.push({ ...c, detail: t.needsReview });
      continue;
    }
    if (t) {
      const blank = ["fajr", "dhuhr", "asr", "isha"].filter((p) => !t.iqamah[p]);
      if (blank.length) {
        groups.blankPrayer.push({ ...c, detail: `no ${blank.join(", ")}` });
        continue;
      }
    }
    if (!c.website) {
      groups.noWebsite.push(c);
      continue;
    }
    if (c.flag) {
      groups.sharedHomepage.push({ ...c, detail: c.website ?? undefined });
      continue;
    }
    groups.noTimesFound.push({ ...c, detail: reasons.get(c.name) });
  }

  const total = Object.values(groups).reduce((n, g) => n + g.length, 0);
  const link = (c: Candidate) => (c.website ? `[${c.name}](${c.website})` : `**${c.name}**`);
  const where = (c: Candidate) => (c.address ? ` — ${c.address}` : "");

  const md: string[] = [
    `# Masjids found but not live (${total})`,
    "",
    `The app currently shows **${live.size}**. These are the rest, grouped by what is`,
    "actually blocking each one. The groups need different work, so they are kept apart.",
    "",
    "| Blocked by | Count | What would unblock it |",
    "| --- | ---: | --- |",
    `| Times read but impossible | ${groups.impossibleTimes.length} | Check the site yourself and send the real times |`,
    `| Times read but a prayer was blank | ${groups.blankPrayer.length} | Same — one missing prayer each |`,
    `| Website loads, no times found | ${groups.noTimesFound.length} | Re-run the scraper, or find their times page by hand |`,
    `| Only a shared org homepage | ${groups.sharedHomepage.length} | Find that branch's own page |`,
    `| No website at all | ${groups.noWebsite.length} | Nothing to scrape — needs a phone call or a visit |`,
    "",
    "---",
    "",
    `## 1. Times read but impossible (${groups.impossibleTimes.length}) — cheapest to fix`,
    "",
    "We got times, but they cannot be right. Open the site, and if you can see the real",
    "times, send them over and these go live immediately.",
    "",
    ...groups.impossibleTimes.map((c) => `- ${link(c)} — ${c.detail}`),
    "",
    `## 2. Times read but a prayer was blank (${groups.blankPrayer.length})`,
    "",
    "Everything read except one or two prayers. Note the Shia centres are legitimately",
    "combining prayers, so a blank there may be correct rather than a bad read.",
    "",
    ...groups.blankPrayer.map((c) => `- ${link(c)} — ${c.detail}`),
    "",
    `## 3. Website loads but no times found (${groups.noTimesFound.length})`,
    "",
    "The realistic target. Some are transient; some genuinely publish nothing online.",
    "",
    ...groups.noTimesFound.map((c) => `- ${link(c)}${c.detail ? ` — ${c.detail}` : ""}`),
    "",
    `## 4. Only a shared organisation homepage (${groups.sharedHomepage.length})`,
    "",
    "Their listed site is a national homepage shared by many branches, so scraping it",
    "would give every branch the same times. Each needs its own page found first.",
    "",
    ...groups.sharedHomepage.map((c) => `- ${link(c)}`),
    "",
    `## 5. No website at all (${groups.noWebsite.length})`,
    "",
    "No scraper can ever reach these. They would need someone to phone or visit.",
    "This is the largest group and the hard wall.",
    "",
    ...groups.noWebsite.map((c) => `- **${c.name}**${where(c)}`),
    "",
  ];

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "README.md"), md.join("\n"));
  fs.writeFileSync(
    path.join(OUT_DIR, "not-live.json"),
    JSON.stringify({ liveCount: live.size, notLiveCount: total, groups }, null, 2) + "\n",
  );

  console.log(`live: ${live.size}   not live: ${total}`);
  for (const [k, g] of Object.entries(groups)) console.log(`  ${k}: ${g.length}`);
  console.log(`\nwrote ${OUT_DIR}/README.md and not-live.json`);
}

main();
