/**
 * Turn the two Texas OpenStreetMap exports into a candidate list the scraper
 * can run against, and say honestly which entries it cannot reach.
 *
 * This is the DFW work generalized: the same "produce a report, decide later"
 * shape as import-osm-ontario.ts. It does NOT touch src/data/masjids.json and
 * adds nothing to the app's Toronto-scoped model. Whether Texas ever becomes
 * a second city is an open question (CLAUDE.md §16); this only answers "which
 * of these OSM entries can we even attempt, and what blocks the rest."
 *
 * The headline fact, and the reason this file exists at all: of the 105
 * unique OSM entries, only 25 carry a `website` tag. A website scraper is
 * structurally incapable of reading the other 80 — there is nothing to open.
 * Those are written to a separate file for a discovery pass (discover.ts
 * against Nominatim, or discover-google-places.ts) rather than being handed
 * to the scraper to fail 80 times.
 *
 * Deduping follows import-osm-ontario.ts exactly, and for the same reason:
 * proximity and exact-normalized-name only, never fuzzy name similarity. OSM
 * routinely holds a named `place_of_worship` node and an unnamed `building:
 * mosque` way for one physical building — Baitus Samee Mosque and way/
 * 1412305434 sit 25m apart and are one mosque. Merging those is right.
 * Guessing that two similar *names* are one masjid is how "Markham Masjid"
 * once got merged into "Toronto Markaz"; that mistake is not repeated here.
 *
 * Ismaili jamatkhanas are flagged, not dropped. The 2026-08-31 Ontario audit
 * established that jamatkhanas generally do not publish a public
 * Fajr/Dhuhr/Asr/Maghrib/Isha timetable — timing reaches registered Jamati
 * members through internal channels. Scraping them is not a data gap to
 * chase, so they are excluded from the scrape list with the reason recorded.
 *
 * Run: npx tsx scripts/import-osm-texas.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { haversineKm } from "../src/lib/distance";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUTS = [
  path.join(HERE, "texas-osm-export-2.geojson"),
  path.join(HERE, "texas-osm-export-3.geojson"),
];
const SCRAPEABLE = path.join(HERE, "texas-mosques.json");
const NEEDS_WEBSITE = path.join(HERE, "texas-mosques-needs-website.json");

/** Same band as the Ontario import: under 75m is one building, not two. */
const MERGE_RADIUS_KM = 0.075;

interface OsmFeature {
  properties: Record<string, string | undefined>;
  geometry: { type: string; coordinates: [number, number] };
  id: string;
}

interface Candidate {
  name: string | null;
  website: string | null;
  lat: number;
  lng: number;
  address: string | null;
  osmIds: string[];
  denomination?: string;
  /** Why this entry cannot go to the scraper, when it cannot. */
  blocked?: string;
}

function address(p: Record<string, string | undefined>): string | null {
  const street = [p["addr:housenumber"], p["addr:street"]].filter(Boolean).join(" ");
  const parts = [street, p["addr:city"], p["addr:state"], p["addr:postcode"]].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * A jamatkhana is identified by OSM's own denomination tag first, and only
 * then by name — the name check is an exact word match on "jamatkhana"/
 * "jamat khana", not a substring guess about what a mosque might be.
 */
function isJamatkhana(entry: { name?: string | null; denomination?: string }): boolean {
  if (entry.denomination === "ismaili") return true;
  const name = (entry.name ?? "").toLowerCase();
  return /\bjamat\s?khana\b/.test(name) || /\bismaili\b/.test(name);
}

function toCandidate(f: OsmFeature): Candidate {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  return {
    name: p.name ?? p.alt_name ?? p.common_name ?? null,
    website: p.website ?? p["owner:website"] ?? null,
    lat,
    lng,
    address: address(p),
    osmIds: [f.id],
    ...(p.denomination ? { denomination: p.denomination } : {}),
  };
}

/**
 * Merge entries within MERGE_RADIUS_KM into one. The surviving record keeps
 * the best field from either side rather than whichever happened to come
 * first: a named node and an unnamed building are one mosque, and the name
 * is the half worth keeping.
 */
function dedupe(candidates: Candidate[]): Candidate[] {
  const out: Candidate[] = [];

  for (const c of candidates) {
    const near = out.find(
      (o) => haversineKm({ lat: o.lat, lng: o.lng }, { lat: c.lat, lng: c.lng }) <= MERGE_RADIUS_KM,
    );
    if (!near) {
      out.push({ ...c });
      continue;
    }
    near.name ??= c.name;
    near.website ??= c.website;
    near.address ??= c.address;
    near.denomination ??= c.denomination;
    near.osmIds.push(...c.osmIds);
  }

  return out;
}

function main() {
  // Both exports overlap almost entirely; @id is the stable OSM identity, so
  // merging on it is exact rather than a heuristic.
  const byOsmId = new Map<string, OsmFeature>();
  for (const file of INPUTS) {
    const fc = JSON.parse(readFileSync(file, "utf8"));
    for (const f of fc.features as OsmFeature[]) byOsmId.set(f.id, f);
  }
  console.log(`${byOsmId.size} unique OSM entries across ${INPUTS.length} exports`);

  const merged = dedupe([...byOsmId.values()].map(toCandidate));
  console.log(`${merged.length} after merging entries under ${MERGE_RADIUS_KM * 1000}m`);

  const scrapeable: Candidate[] = [];
  const blocked: Candidate[] = [];

  for (const c of merged) {
    if (isJamatkhana(c)) {
      blocked.push({ ...c, blocked: "ismaili jamatkhana — does not publish a public timetable" });
    } else if (!c.website) {
      blocked.push({ ...c, blocked: c.name ? "no website in OSM" : "no website and no name in OSM" });
    } else {
      scrapeable.push(c);
    }
  }

  writeFileSync(SCRAPEABLE, JSON.stringify(scrapeable, null, 2) + "\n");
  writeFileSync(NEEDS_WEBSITE, JSON.stringify(blocked, null, 2) + "\n");

  const noName = blocked.filter((c) => !c.name).length;
  const jamat = blocked.filter((c) => c.blocked?.startsWith("ismaili")).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`scrapeable (has a website):  ${scrapeable.length}  -> ${path.basename(SCRAPEABLE)}`);
  console.log(`blocked:                     ${blocked.length}  -> ${path.basename(NEEDS_WEBSITE)}`);
  console.log(`    of which jamatkhanas:    ${jamat}  (expected, not a gap)`);
  console.log(`    of which unnamed:        ${noName}  (nothing to search for)`);
  console.log(
    `\nThe scraper can only attempt the ${scrapeable.length}. The rest need a discovery pass\n` +
      `first — see scripts/discover.ts (Nominatim) or scripts/discover-google-places.ts.`,
  );
}

main();
