/**
 * Merge platform metadata from a seed file into masjids.json.
 *
 * The seed that came with the new scraper carries three things the live file
 * does not: which prayer-time platform each masjid runs, the Ad-Din id where
 * one was found, and a `manualOnly` flag for the site whose robots.txt
 * disallows automated access. Those unlock the fast path and the skip.
 *
 * It carries nothing else worth having. Its coordinates are mostly null, its
 * addresses mostly null, and its own header says every iqamah in it is a
 * placeholder — all of which the live file has since filled in properly. So
 * this copies the metadata across and touches nothing else: no times, no
 * coordinates, no names. Matching is by website domain rather than id, because
 * the seed's ids drifted from the live ones ("slifo-masjid-al-jannah" against
 * "masjid-al-jannah") while the domains stayed put.
 *
 * Run: npx tsx scripts/merge-seed-metadata.ts <seed.json> [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(HERE, "..", "src", "data", "masjids.json");

interface SeedEntry {
  id?: string;
  name?: string;
  website?: string;
  platform?: string;
  adDinMasjidId?: number | null;
  manualOnly?: boolean;
  confidence?: string;
  _readme?: string;
}

function domain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/** "masjidzakariya.com" -> "masjidzakariya" — the TLD dropped. */
function label(url: string): string {
  const host = domain(url);
  const parts = host.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : host;
}

function main() {
  const seedPath = process.argv[2];
  const write = process.argv.includes("--write");
  if (!seedPath) {
    console.error("usage: merge-seed-metadata.ts <seed.json> [--write]");
    process.exit(1);
  }

  const seed: SeedEntry[] = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const masjids: any[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  const byDomain = new Map<string, any>();
  // Zakariya is listed in the seed as .org and in the live file as .com — the
  // same masjid under a different TLD. Matching on the second-level label as a
  // fallback catches that. It is an exact string match on a distinctive label,
  // not fuzzy similarity: an earlier fuzzy matcher in this repo happily merged
  // "Markham Masjid" into "Toronto Markaz".
  const byLabel = new Map<string, any>();
  for (const m of masjids) {
    if (!m.website) continue;
    byDomain.set(domain(m.website), m);
    byLabel.set(label(m.website), m);
  }

  const unmatched: string[] = [];
  let changed = 0;

  for (const entry of seed) {
    // The seed's first element doubles as its own documentation.
    if (!entry.website || entry._readme != null) {
      if (!entry.website) continue;
    }

    const masjid = byDomain.get(domain(entry.website)) ?? byLabel.get(label(entry.website));
    if (!masjid) {
      unmatched.push(`${entry.name ?? entry.id} (${entry.website})`);
      continue;
    }

    const lines: string[] = [];

    if (entry.platform && entry.platform !== masjid.platform) {
      lines.push(`  platform: ${masjid.platform ?? "—"} -> ${entry.platform}`);
      masjid.platform = entry.platform;
    }

    // An id of null in the seed means "not found yet", which must not erase a
    // real id the live file already has.
    if (entry.adDinMasjidId != null && entry.adDinMasjidId !== masjid.adDinMasjidId) {
      lines.push(`  adDinMasjidId: ${masjid.adDinMasjidId ?? "—"} -> ${entry.adDinMasjidId}`);
      masjid.adDinMasjidId = entry.adDinMasjidId;
    }

    /**
     * An unverified id is worse than no id.
     *
     * The seed says Masjid El Noor's id 11 is "a strong but not verified
     * match". If it is the wrong masjid, the fast path does not fail — it
     * succeeds, and quietly fills El Noor's page with another masjid's
     * congregation times, which is the one failure mode this whole app exists
     * to avoid. The id is recorded so the check is easy to finish later, and
     * flagged so the scraper will not act on it until someone has.
     */
    /**
     * Case-sensitive on purpose. The seed's author uses a shouted
     * "UNCONFIRMED" as a deliberate warning about the entry, and lower-case
     * "unconfirmed" in passing prose about something else — Omar Farooq's id
     * came off the Network tab and is solid, while its *street address* is
     * unconfirmed. Matching case-insensitively held that masjid's fast path
     * back over a note about its address.
     */
    const unverified = (entry.confidence ?? "").includes("UNCONFIRMED");
    if (entry.adDinMasjidId != null && unverified && !masjid.adDinUnverified) {
      lines.push(`  adDinUnverified: true — id ${entry.adDinMasjidId} is a guess, fast path stays off`);
      masjid.adDinUnverified = true;
    }

    if (entry.manualOnly && !masjid.manualOnly) {
      lines.push(`  manualOnly: true — ${entry.confidence ?? ""}`.trimEnd());
      masjid.manualOnly = true;
    }

    if (lines.length) {
      changed += lines.length;
      console.log(`${masjid.name}\n${lines.join("\n")}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${changed} metadata fields set`);
  if (unmatched.length) {
    console.log(`in the seed but not in the live file:\n  ${unmatched.join("\n  ")}`);
  }

  const adDin = masjids.filter((m) => m.platform === "ad-din");
  const fast = adDin.filter((m) => m.adDinMasjidId != null && !m.adDinUnverified);
  const held = adDin.filter((m) => m.adDinMasjidId != null && m.adDinUnverified);
  console.log(
    `ad-din masjids: ${adDin.length}; fast path on for ${fast.length} (${fast.map((m) => m.name).join(", ") || "none"})`,
  );
  if (held.length) {
    console.log(`  held back pending an id check: ${held.map((m) => m.name).join(", ")}`);
  }
  console.log(`manualOnly: ${masjids.filter((m) => m.manualOnly).map((m) => m.name).join(", ") || "none"}`);

  if (write) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(masjids, null, 2) + "\n");
    console.log(`\nwrote ${DATA_FILE}`);
  } else {
    console.log(`\ndry run — pass --write to apply`);
  }
}

main();
