/**
 * Cross-references the Google Places raw results from
 * discover-google-places.ts against everything already known — the 32
 * masjids in src/data/masjids.json AND the 151 OSM candidates in
 * ontario-mosques-new.json — and writes out only what's genuinely new to
 * both. Nothing here re-adds an OSM candidate as if Google had found it
 * independently.
 *
 * Same three non-fuzzy signals as import-osm-ontario.ts, same two-band
 * distance logic, same reasoning: a name-similarity score is exactly what
 * merged two different real masjids earlier in this project's history, so
 * nothing here is a matter of degree — a signal either matches or it
 * doesn't, and anything close-but-unconfirmed goes to a review list instead
 * of being guessed either way.
 *
 * Run: npx tsx scripts/import-google-places.ts [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { haversineKm } from "../src/lib/distance";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(HERE, "google-places-ontario-raw.json");
const MASJIDS = path.join(HERE, "..", "src", "data", "masjids.json");
const OSM_CANDIDATES = path.join(HERE, "ontario-mosques-new.json");
const OUTPUT = path.join(HERE, "google-places-new.json");

const MATCH_RADIUS_KM = 0.075;
const REVIEW_RADIUS_KM = 0.25;

interface Known {
  name: string;
  website?: string | null;
  lat: number;
  lng: number;
}

interface RawPlace {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
}

interface Candidate {
  name: string;
  website: string | null;
  lat: number;
  lng: number;
  address: string | null;
  placeId: string;
}

function domain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function normalizeName(name: string): string | null {
  const stripped = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|masjid|mosque|islamic|centre|center|society|association|of|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.split(" ").filter(Boolean).length >= 2 ? stripped : null;
}

function main() {
  const write = process.argv.includes("--write");

  if (!fs.existsSync(RAW)) {
    console.error(`${RAW} not found — run discover-google-places.ts first.`);
    process.exit(1);
  }

  const raw: RawPlace[] = JSON.parse(fs.readFileSync(RAW, "utf8"));
  const masjids: Known[] = JSON.parse(fs.readFileSync(MASJIDS, "utf8"));
  const osmCandidates: Known[] = JSON.parse(fs.readFileSync(OSM_CANDIDATES, "utf8"));
  const known: Known[] = [...masjids, ...osmCandidates];

  const byDomain = new Map<string, Known>();
  const byName = new Map<string, Known>();
  for (const k of known) {
    if (k.website) byDomain.set(domain(k.website), k);
    const n = normalizeName(k.name);
    if (n) byName.set(n, k);
  }

  const matched: { google: string; known: string; via: string }[] = [];
  const needsReview: { google: string; known: string; distanceM: number }[] = [];
  const candidates: Candidate[] = [];

  for (const place of raw) {
    if (place.website) {
      const hit = byDomain.get(domain(place.website));
      if (hit) {
        matched.push({ google: place.name, known: hit.name, via: `website (${domain(place.website)})` });
        continue;
      }
    }

    let closest: Known | null = null;
    let closestKm = Infinity;
    for (const k of known) {
      const km = haversineKm(place, k);
      if (km < closestKm) {
        closestKm = km;
        closest = k;
      }
    }
    if (closest && closestKm < MATCH_RADIUS_KM) {
      matched.push({ google: place.name, known: closest.name, via: `distance (${Math.round(closestKm * 1000)}m)` });
      continue;
    }

    const normalized = normalizeName(place.name);
    const nameHit = normalized ? byName.get(normalized) : undefined;
    if (nameHit) {
      matched.push({ google: place.name, known: nameHit.name, via: "normalized name" });
      continue;
    }

    // Close, but not close enough to trust silently, and no name or website
    // agreement to back it up — a human needs to look at this one.
    if (closest && closestKm < REVIEW_RADIUS_KM) {
      needsReview.push({ google: place.name, known: closest.name, distanceM: Math.round(closestKm * 1000) });
      continue;
    }

    candidates.push({
      name: place.name,
      website: place.website,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      placeId: place.placeId,
    });
  }

  console.log(`Google Places results: ${raw.length}`);
  console.log(`Already known (matched): ${matched.length}`);
  for (const m of matched) console.log(`  ${m.google}  ->  ${m.known}  [${m.via}]`);

  if (needsReview.length) {
    console.log(`\nNeeds a human look — close but not confirmed (${needsReview.length}), excluded from candidates:`);
    for (const r of needsReview) {
      console.log(`  "${r.google}" is ${r.distanceM}m from "${r.known}" — no name or website agreement`);
    }
  }

  const withSite = candidates.filter((c) => c.website);
  const withoutSite = candidates.filter((c) => !c.website);

  console.log(`\nNew candidates (not in masjids.json or the OSM list): ${candidates.length}`);
  console.log(`  with a website (scrapeable): ${withSite.length}`);
  console.log(`  without a website: ${withoutSite.length}`);

  if (withoutSite.length) {
    console.log(`\nNo website — listed for reference only:`);
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
