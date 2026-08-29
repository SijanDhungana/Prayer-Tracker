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
 * Three extra filters exist only because Text Search actually needed them,
 * discovered from a real run against all of Ontario:
 *
 *  - Text Search isn't geographically restricted, only "biased" — with few
 *    real local matches it happily returned mosques in Mecca, Jerusalem,
 *    Michigan, and upstate New York, and non-mosque businesses (a church, a
 *    grocery store) near small towns. Addresses outside Ontario are dropped
 *    before matching even runs.
 *
 *  - A worse bug, found by inspecting a real run rather than assumed:
 *    distinct, real mosques that belong to the same national network
 *    (every Ahmadiyya mosque links to ahmadiyya.ca; several unrelated MAC
 *    branches link to centres.macnet.ca) were being merged into ONE existing
 *    entry purely because they share that umbrella domain — a false merge,
 *    the opposite failure from "Markham Masjid" vs "Toronto Markaz" but
 *    exactly as dangerous, since it silently hides a real masjid instead of
 *    confusing two. A domain is only trusted as a match signal if it never
 *    shows up on two Google results more than MATCH_RADIUS_KM apart —
 *    otherwise it's a shared network domain, not one location's own site,
 *    and only distance/name are left to confirm a match.
 *
 *  - Google's Text Search also drags in real places with no religious
 *    connection at all when a search area comes up thin (a Lutheran church,
 *    a Buddhist center, a computer repair shop). A candidate is only kept
 *    if its name or website contains an Islam-related term; anything that
 *    clears the geography and dedup checks but fails this goes to a
 *    separate "uncertain" list for a human to glance at rather than being
 *    silently scraped or silently dropped.
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

// Google's own formatted addresses put the province right after the city,
// e.g. "123 Main St, Oshawa, ON L1G 4X9, Canada" — anything that doesn't
// have that isn't in Ontario, whatever the search was biased toward.
const ONTARIO_ADDRESS = /,\s*ON(?=[\s,]|$)/i;

const ISLAMIC_TERM =
  /masjid|mosque|islam|muslim|jama|jame|dar[\s-]?ul|imam|musalla|jamatkhana|ismaili|dawah|shia|sunni|ansar|ummah|quran|ahlul|hussain|husayn|khadija|bilal|aisha|zainab|omar|khattab|mahdi|noor|iqra|taqwa|tawheed|tawhid|rahma|salaam|salam|hidaya|maryam|fatima|bohra|dawoodi|sufi/i;

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
  /** Set when the website is a shared network homepage with no page of its own. */
  flag?: string;
}

/** True if the URL points somewhere more specific than a bare domain root. */
function hasDistinguishingPath(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, "").length > 0;
  } catch {
    return true;
  }
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

/**
 * A domain is only a useful match signal if it identifies ONE location. If
 * the same domain shows up on two Google results genuinely far apart, it's
 * a shared organization-wide site (an umbrella domain, a network of
 * branches) and matching on it would silently hide every branch but one.
 */
function findSharedDomains(raw: RawPlace[]): Set<string> {
  const byDomain = new Map<string, RawPlace[]>();
  for (const p of raw) {
    if (!p.website) continue;
    const d = domain(p.website);
    const list = byDomain.get(d) ?? [];
    list.push(p);
    byDomain.set(d, list);
  }

  const shared = new Set<string>();
  for (const [d, places] of byDomain) {
    outer: for (let i = 0; i < places.length; i++) {
      for (let j = i + 1; j < places.length; j++) {
        if (haversineKm(places[i], places[j]) > MATCH_RADIUS_KM) {
          shared.add(d);
          break outer;
        }
      }
    }
  }
  return shared;
}

function main() {
  const write = process.argv.includes("--write");

  if (!fs.existsSync(RAW)) {
    console.error(`${RAW} not found — run discover-google-places.ts first.`);
    process.exit(1);
  }

  const rawAll: RawPlace[] = JSON.parse(fs.readFileSync(RAW, "utf8"));
  const masjids: Known[] = JSON.parse(fs.readFileSync(MASJIDS, "utf8"));
  const osmCandidates: Known[] = JSON.parse(fs.readFileSync(OSM_CANDIDATES, "utf8"));
  const known: Known[] = [...masjids, ...osmCandidates];

  const outOfRegion = rawAll.filter((p) => !p.address || !ONTARIO_ADDRESS.test(p.address));
  const raw = rawAll.filter((p) => p.address && ONTARIO_ADDRESS.test(p.address));

  const sharedDomains = findSharedDomains(raw);

  const byDomain = new Map<string, Known>();
  const byName = new Map<string, Known>();
  for (const k of known) {
    if (k.website) byDomain.set(domain(k.website), k);
    const n = normalizeName(k.name);
    if (n) byName.set(n, k);
  }

  const matched: { google: string; known: string; via: string }[] = [];
  const needsReview: { google: string; known: string; distanceM: number }[] = [];
  const uncertain: RawPlace[] = [];
  const candidates: Candidate[] = [];

  for (const place of raw) {
    if (place.website && !sharedDomains.has(domain(place.website))) {
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

    if (!ISLAMIC_TERM.test(`${place.name} ${place.website ?? ""}`)) {
      uncertain.push(place);
      continue;
    }

    const candidate: Candidate = {
      name: place.name,
      website: place.website,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      placeId: place.placeId,
    };

    // A shared domain with no path of its own (ahmadiyya.ca, not
    // ahmadiyya.ca/some-branch) is a national homepage, not this specific
    // mosque's page — scraping it can't tell branches apart, and if the
    // homepage happens to show any time at all, every branch scraped from
    // it would wrongly get the same one. Flagged, not auto-scraped.
    if (place.website && sharedDomains.has(domain(place.website)) && !hasDistinguishingPath(place.website)) {
      candidate.flag = "website is a shared network homepage, not this mosque's own page — needs a specific URL found by hand before scraping";
    }

    candidates.push(candidate);
  }

  console.log(`Google Places results: ${rawAll.length}`);

  if (outOfRegion.length) {
    console.log(`\nOutside Ontario, dropped (${outOfRegion.length}):`);
    for (const p of outOfRegion) console.log(`  ${p.name}${p.address ? `  (${p.address})` : "  (no address)"}`);
  }

  if (sharedDomains.size) {
    console.log(`\nShared/network domains found — not trusted as a match signal on their own (${sharedDomains.size}):`);
    for (const d of sharedDomains) console.log(`  ${d}`);
  }

  console.log(`\nAlready known (matched): ${matched.length}`);
  for (const m of matched) console.log(`  ${m.google}  ->  ${m.known}  [${m.via}]`);

  if (needsReview.length) {
    console.log(`\nNeeds a human look — close but not confirmed (${needsReview.length}), excluded from candidates:`);
    for (const r of needsReview) {
      console.log(`  "${r.google}" is ${r.distanceM}m from "${r.known}" — no name or website agreement`);
    }
  }

  if (uncertain.length) {
    console.log(
      `\nNo Islam-related term in name or website — not auto-included, check by hand if one of these looks real (${uncertain.length}):`,
    );
    for (const p of uncertain) {
      console.log(`  ${p.name}${p.website ? `  ${p.website}` : ""}${p.address ? `  (${p.address})` : ""}`);
    }
  }

  const withoutSite = candidates.filter((c) => !c.website);
  const flaggedSite = candidates.filter((c) => c.website && c.flag);
  const withSite = candidates.filter((c) => c.website && !c.flag);

  console.log(`\nNew candidates (not in masjids.json or the OSM list): ${candidates.length}`);
  console.log(`  with a website, safe to auto-scrape: ${withSite.length}`);
  console.log(`  with only a shared network homepage, needs a specific URL by hand: ${flaggedSite.length}`);
  console.log(`  without a website: ${withoutSite.length}`);

  if (withoutSite.length) {
    console.log(`\nNo website — listed for reference only:`);
    for (const c of withoutSite) console.log(`  ${c.name}${c.address ? `  (${c.address})` : ""}`);
  }

  if (flaggedSite.length) {
    console.log(`\nOnly a shared network homepage — find each one's actual page before scraping:`);
    for (const c of flaggedSite) console.log(`  ${c.name}  ->  ${c.website}`);
  }

  console.log(`\nNew candidates with a website, safe to auto-scrape:`);
  for (const c of withSite) console.log(`  ${c.name}  ->  ${c.website}`);

  if (write) {
    fs.writeFileSync(OUTPUT, JSON.stringify(candidates, null, 2) + "\n");
    console.log(`\nwrote ${OUTPUT}`);
  } else {
    console.log(`\ndry run — pass --write to save the candidate list`);
  }
}

main();
