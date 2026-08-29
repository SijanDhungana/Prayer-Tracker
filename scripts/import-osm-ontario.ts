/**
 * Cross-reference an OpenStreetMap export of Ontario mosques against the 32
 * already in src/data/masjids.json, and write out only the ones that are new.
 *
 * This does not touch masjids.json. It produces a candidate list — the same
 * shape the DFW work used — for the scraper to run against next. Whether any
 * of these become part of the app is a separate decision; this only answers
 * "which of these 179 OSM entries are we not already tracking."
 *
 * Three independent signals decide a match, and any one of them is enough —
 * deliberately no fuzzy name scoring. A Levenshtein-style similarity score is
 * exactly what merged "Markham Masjid" into "Toronto Markaz" earlier in this
 * project's history: two real, different masjids whose names happen to share
 * letters. A website domain is either the same domain or it isn't; a distance
 * either clears the threshold or it doesn't; a normalized name either matches
 * exactly or it doesn't. Nothing here is a matter of degree.
 *
 *   1. Website domain, exact match after stripping protocol/www/path.
 *   2. Distance under 250m — two listings for the same building, however
 *      differently named, are still the same masjid.
 *   3. Normalized name, exact match — punctuation, "masjid"/"mosque"/"the",
 *      and case differences stripped, nothing more forgiving than that.
 *
 * Run: npx tsx scripts/import-osm-ontario.ts [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { haversineKm } from "../src/lib/distance";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GEOJSON = path.join(HERE, "ontario-osm-export.geojson");
const MASJIDS = path.join(HERE, "..", "src", "data", "masjids.json");
const OUTPUT = path.join(HERE, "ontario-mosques-new.json");

/**
 * Two bands, not one. Under 75m is a position error on the same building —
 * OSM's point is often an entrance or a "center" of a complex shape rather
 * than the exact spot this app's own address was geocoded to, and every
 * match this tight in a first pass turned out to genuinely be the same
 * masjid. Beyond that and inside 250m stops being safe to trust silently:
 * "Regent Park Islamic Resource Center" sat 218m from Masjidur Rahmah with
 * no name resemblance at all, which in a dense downtown block is easily two
 * unrelated buildings, not one. Those go to a review list instead of being
 * treated as the same result.
 */
const MATCH_RADIUS_KM = 0.075;
const REVIEW_RADIUS_KM = 0.25;

interface ExistingMasjid {
  id: string;
  name: string;
  website?: string;
  lat: number;
  lng: number;
}

interface OsmFeature {
  type: "Feature";
  properties: Record<string, string | undefined>;
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface Candidate {
  name: string;
  website: string | null;
  lat: number;
  lng: number;
  address: string | null;
  osmId: string;
  /** Set when the entry looked suspect enough to flag rather than silently include. */
  flag?: string;
}

function domain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/**
 * Strips exactly the words this domain repeats everywhere, nothing softer —
 * but a result left too short to be specific is worse than no match at all.
 * "Windsor Mosque" and "Windsor Islamic Association" both reduce to just
 * "windsor" once "mosque"/"islamic"/"association" are gone, which matches
 * on the strength of a city's name, not the masjid's. That one happened to
 * be correct; the risk is real regardless, so a normalized name under two
 * words is treated as not specific enough to match on and is left to the
 * other two signals instead.
 */
function normalizeName(name: string): string | null {
  const stripped = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|masjid|mosque|islamic|centre|center|society|association|of|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.split(" ").filter(Boolean).length >= 2 ? stripped : null;
}

function addressOf(props: Record<string, string | undefined>): string | null {
  const parts = [
    props["addr:housenumber"],
    props["addr:street"],
    props["addr:city"],
    props["addr:province"],
    props["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function websiteOf(props: Record<string, string | undefined>): string | null {
  const raw = props.website || props["contact:website"] || props["operator:website"];
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

function main() {
  const write = process.argv.includes("--write");
  const geojson = JSON.parse(fs.readFileSync(GEOJSON, "utf8"));
  const existing: ExistingMasjid[] = JSON.parse(fs.readFileSync(MASJIDS, "utf8"));

  const existingByDomain = new Map<string, ExistingMasjid>();
  const existingByName = new Map<string, ExistingMasjid>();
  for (const m of existing) {
    if (m.website) existingByDomain.set(domain(m.website), m);
    const normalized = normalizeName(m.name);
    if (normalized) existingByName.set(normalized, m);
  }

  const seenOsmIds = new Set<string>();
  const matched: { osm: string; existing: string; via: string }[] = [];
  const needsReview: { osm: string; existing: string; distanceM: number }[] = [];
  const skipped: { osm: string; why: string }[] = [];
  const candidates: Candidate[] = [];

  for (const feature of geojson.features as OsmFeature[]) {
    const props = feature.properties;
    const osmName = props.name ?? "(unnamed)";
    const osmId = props["@id"] ?? "(no id)";

    if (seenOsmIds.has(osmId)) continue;
    seenOsmIds.add(osmId);

    // OSM preserves history through tag prefixes rather than deleting a
    // feature — "demolished:building" or "was:amenity" means the physical
    // building this point represents is gone, whatever the current amenity
    // tag still says.
    const demolished = Object.keys(props).some(
      (k) => k.startsWith("demolished:") || k.startsWith("was:") || k.startsWith("disused:"),
    );
    if (demolished) {
      skipped.push({ osm: osmName, why: "tagged as demolished/disused in OSM" });
      continue;
    }

    const [lng, lat] = feature.geometry.coordinates;
    const website = websiteOf(props);

    // Signal 1: website domain.
    if (website) {
      const hit = existingByDomain.get(domain(website));
      if (hit) {
        matched.push({ osm: osmName, existing: hit.name, via: `website (${domain(website)})` });
        continue;
      }
    }

    // Signal 2: distance to any existing masjid — two confidence bands.
    let closest: ExistingMasjid | null = null;
    let closestKm = Infinity;
    for (const m of existing) {
      const km = haversineKm({ lat, lng }, m);
      if (km < closestKm) {
        closestKm = km;
        closest = m;
      }
    }
    if (closest && closestKm < MATCH_RADIUS_KM) {
      matched.push({ osm: osmName, existing: closest.name, via: `distance (${Math.round(closestKm * 1000)}m)` });
      continue;
    }

    // Signal 3: normalized name (skipped entirely when too generic to trust).
    const normalized = normalizeName(osmName);
    const byName = normalized ? existingByName.get(normalized) : undefined;
    if (byName) {
      matched.push({ osm: osmName, existing: byName.name, via: "normalized name" });
      continue;
    }

    // Close, but not close enough to trust silently, and no name or website
    // agreement to back it up — a human needs to look at this one.
    if (closest && closestKm < REVIEW_RADIUS_KM) {
      needsReview.push({ osm: osmName, existing: closest.name, distanceM: Math.round(closestKm * 1000) });
      continue;
    }

    const candidate: Candidate = {
      name: osmName,
      website,
      lat,
      lng,
      address: addressOf(props),
      osmId,
    };

    if (osmName === "(unnamed)") candidate.flag = "no name in OSM — needs identifying by hand";
    candidates.push(candidate);
  }

  console.log(`OSM features: ${seenOsmIds.size}`);
  console.log(`Already tracked (matched): ${matched.length}`);
  for (const m of matched) console.log(`  ${m.osm}  ->  ${m.existing}  [${m.via}]`);

  if (needsReview.length) {
    // Deliberately excluded from the candidate output rather than guessed
    // either way — held out here rather than added as "new" until someone
    // confirms whether this is the same masjid under a different name.
    console.log(`\nNeeds a human look — close but not confirmed (${needsReview.length}), excluded from candidates:`);
    for (const r of needsReview) {
      console.log(`  "${r.osm}" is ${r.distanceM}m from "${r.existing}" — no name or website agreement`);
    }
  }

  if (skipped.length) {
    console.log(`\nSkipped: ${skipped.length}`);
    for (const s of skipped) console.log(`  ${s.osm} — ${s.why}`);
  }

  const withSite = candidates.filter((c) => c.website);
  const withoutSite = candidates.filter((c) => !c.website);

  console.log(`\nNew candidates: ${candidates.length}`);
  console.log(`  with a website (scrapeable): ${withSite.length}`);
  console.log(`  without a website: ${withoutSite.length}`);

  if (withoutSite.length) {
    console.log(`\nNo website in OSM — cannot be scraped, listed for reference only:`);
    for (const c of withoutSite) console.log(`  ${c.name}${c.address ? `  (${c.address})` : ""}`);
  }

  console.log(`\nNew candidates with a website:`);
  for (const c of withSite) console.log(`  ${c.name}  ->  ${c.website}`);

  if (write) {
    fs.writeFileSync(OUTPUT, JSON.stringify(candidates, null, 2) + "\n");
    console.log(`\nwrote ${OUTPUT}`);
  } else {
    console.log(`\ndry run — pass --write to save the candidate list`);
  }
}

main();
