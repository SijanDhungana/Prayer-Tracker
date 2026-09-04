/**
 * Cross-references the Texas Google Places results against what the OSM import
 * already produced, and does two jobs at once:
 *
 *   1. Finds mosques OSM never recorded at all.
 *   2. Fills in a website for OSM entries that have one in Google but not in
 *      OSM — the 73 in texas-mosques-needs-website.json that no scraper can
 *      currently reach.
 *
 * Job 2 is the one that matters most here, and it exists because of a bug found
 * on the Ontario run: a match used to mean "already known, skip", which threw
 * the Google record away. Masjid Omar Bin Khatab sat in the "no website" pile
 * with a perfectly good site because its Google record matched an OSM record
 * and was discarded. On Ontario, fixing that recovered 33 mosques in one pass.
 * Texas has 73 in that pile, so the same fix should matter more here, not less.
 *
 * Matching is the same three non-fuzzy signals as import-osm-texas.ts and
 * import-osm-ontario.ts, for the same reason: a name-similarity score is what
 * once merged "Markham Masjid" into "Toronto Markaz". A website domain either
 * matches or it does not; a distance either clears the band or it does not.
 *
 * Discovery only — nothing here touches src/data/masjids.json.
 *
 * Run: npx tsx scripts/import-google-places-texas.ts [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { haversineKm } from "../src/lib/distance";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(HERE, "texas-google-places-raw.json");
const SCRAPEABLE = path.join(HERE, "texas-mosques.json");
const NEEDS_WEBSITE = path.join(HERE, "texas-mosques-needs-website.json");
const NEW_OUT = path.join(HERE, "texas-google-places-new.json");

const MATCH_RADIUS_KM = 0.075;
const REVIEW_RADIUS_KM = 0.25;

/**
 * Google's formatted addresses put the state right before the ZIP, e.g.
 * "5821 Casa Bella St, San Antonio, TX 78249, USA". Text Search only *biases*
 * toward a location, it does not restrict to one — the Ontario run came back
 * with Mecca, Jerusalem and Michigan — so the state has to be checked here.
 */
const TEXAS_ADDRESS = /,\s*TX\s+\d{5}|,\s*Texas\b/i;

const ISLAMIC_TERM =
  /masjid|mosque|islam|muslim|jama|jame|dar[\s-]?ul|imam|musalla|jamatkhana|ismaili|dawah|shia|sunni|ansar|ummah|quran|ahlul|hussain|husayn|khadija|bilal|aisha|zainab|omar|khattab|mahdi|noor|iqra|taqwa|tawheed|tawhid|rahma|salaam|salam|hidaya|maryam|fatima|bohra|dawoodi|sufi/i;

interface Known {
  name: string;
  website: string | null;
  lat: number;
  lng: number;
  address: string | null;
  origin: "scrapeable" | "needs-website";
}

interface RawPlace {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
}

function domain(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function normalizeName(name: string | null | undefined): string | null {
  // OSM entries with no name at all (21 of them in Texas) reach here; a
  // nameless record can only ever match on domain or distance.
  if (!name) return null;
  const stripped = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|masjid|mosque|islamic|centre|center|society|association|of|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.split(" ").filter(Boolean).length >= 2 ? stripped : null;
}

/**
 * A domain only identifies a mosque if it identifies ONE mosque. Networks —
 * every ICNA branch, every MAS centre — share a site, and matching on it would
 * silently fold every branch into whichever one came first.
 */
function findSharedDomains(raw: RawPlace[]): Set<string> {
  const byDomain = new Map<string, RawPlace[]>();
  for (const p of raw) {
    if (!p.website) continue;
    const d = domain(p.website);
    byDomain.set(d, [...(byDomain.get(d) ?? []), p]);
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
    console.error(`${RAW} not found — run discover-google-places-texas.ts first.`);
    process.exit(1);
  }

  const rawAll: RawPlace[] = JSON.parse(fs.readFileSync(RAW, "utf8"));
  const scrapeable = JSON.parse(fs.readFileSync(SCRAPEABLE, "utf8"));
  const needsWebsite = JSON.parse(fs.readFileSync(NEEDS_WEBSITE, "utf8"));

  // Tagged in place, not spread into copies. A spread here is what made the
  // whole enrichment pass a no-op: every website Google supplied was written
  // onto a copy, the tally below counted the originals, and --write saved
  // the originals — so the run printed fills it then threw away.
  for (const m of scrapeable) m.origin = "scrapeable";
  for (const m of needsWebsite) m.origin = "needs-website";
  const known: Known[] = [...scrapeable, ...needsWebsite];

  const outOfState = rawAll.filter((p) => !p.address || !TEXAS_ADDRESS.test(p.address));
  const raw = rawAll.filter((p) => p.address && TEXAS_ADDRESS.test(p.address));
  const sharedDomains = findSharedDomains(raw);

  const byDomain = new Map<string, Known>();
  const byName = new Map<string, Known>();
  for (const k of known) {
    if (k.website) byDomain.set(domain(k.website), k);
    const n = normalizeName(k.name);
    if (n) byName.set(n, k);
  }

  const enriched: { name: string; website: string }[] = [];
  const matched: { google: string; known: string; via: string }[] = [];
  const needsReview: { google: string; known: string; distanceM: number }[] = [];
  const uncertain: RawPlace[] = [];
  const candidates: RawPlace[] = [];

  /** A match improves the record it matched; it never discards it. */
  function enrich(hit: Known, place: RawPlace): void {
    if (!hit.website && place.website) {
      hit.website = place.website;
      if (!hit.address && place.address) hit.address = place.address;
      enriched.push({ name: hit.name, website: place.website });
    }
  }

  for (const place of raw) {
    if (place.website && !sharedDomains.has(domain(place.website))) {
      const hit = byDomain.get(domain(place.website));
      if (hit) {
        matched.push({ google: place.name, known: hit.name, via: `website (${domain(place.website)})` });
        enrich(hit, place);
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
      enrich(closest, place);
      continue;
    }

    const normalized = normalizeName(place.name);
    const nameHit = normalized ? byName.get(normalized) : undefined;
    if (nameHit) {
      matched.push({ google: place.name, known: nameHit.name, via: "normalized name" });
      enrich(nameHit, place);
      continue;
    }

    if (closest && closestKm < REVIEW_RADIUS_KM) {
      needsReview.push({ google: place.name, known: closest.name, distanceM: Math.round(closestKm * 1000) });
      continue;
    }

    if (!ISLAMIC_TERM.test(`${place.name} ${place.website ?? ""}`)) {
      uncertain.push(place);
      continue;
    }

    candidates.push(place);
  }

  console.log(`Google Places results: ${rawAll.length}`);
  console.log(`  outside Texas, dropped: ${outOfState.length}`);
  if (sharedDomains.size) console.log(`  shared/network domains not trusted alone: ${sharedDomains.size}`);

  console.log(`\nFilled in a website OSM was missing: ${enriched.length}`);
  for (const e of enriched) console.log(`  ${e.name}  ->  ${e.website}`);

  console.log(`\nAlready known (matched): ${matched.length}`);
  if (needsReview.length) {
    console.log(`\nClose but unconfirmed, held out (${needsReview.length}):`);
    for (const r of needsReview) console.log(`  "${r.google}" is ${r.distanceM}m from "${r.known}"`);
  }
  if (uncertain.length) {
    console.log(`\nNo Islam-related term in name or site — not auto-included (${uncertain.length}):`);
    for (const p of uncertain) console.log(`  ${p.name}${p.address ? `  (${p.address})` : ""}`);
  }

  const newWithSite = candidates.filter((c) => c.website);
  console.log(`\nNEW to Texas, not in the OSM export at all: ${candidates.length}`);
  console.log(`  with a website (scrapeable): ${newWithSite.length}`);
  console.log(`  without: ${candidates.length - newWithSite.length}`);

  // The whole point, stated plainly.
  const stillBlocked = needsWebsite.filter((m: any) => !m.website).length;
  console.log(
    `\nOSM entries with no website: ${needsWebsite.length} before, ${stillBlocked} after — ` +
      `${needsWebsite.length - stillBlocked} became reachable.`,
  );

  if (write) {
    const untag = ({ origin: _origin, ...m }: any) => m;
    // An entry that gained a website leaves the blocked list.
    fs.writeFileSync(
      NEEDS_WEBSITE,
      JSON.stringify(needsWebsite.filter((m: any) => !m.website).map(untag), null, 2) + "\n",
    );
    // Everything the scraper can now attempt: the originals plus the newly
    // enriched plus anything Google found that OSM never had. Full records,
    // not name+website pairs — the scraper labels unnamed rows by OSM id and
    // the report keeps coordinates for the next cross-reference.
    const scrapeList = [
      ...scrapeable.map(untag),
      ...needsWebsite.filter((m: any) => m.website).map(untag),
      ...newWithSite.map((c) => ({
        name: c.name, website: c.website, lat: c.lat, lng: c.lng,
        address: c.address, placeId: c.placeId,
      })),
    ];
    fs.writeFileSync(SCRAPEABLE, JSON.stringify(scrapeList, null, 2) + "\n");
    fs.writeFileSync(NEW_OUT, JSON.stringify(candidates, null, 2) + "\n");
    console.log(`\nwrote ${SCRAPEABLE} (${scrapeList.length} scrapeable)`);
    console.log(`wrote ${NEEDS_WEBSITE} and ${NEW_OUT}`);
  } else {
    console.log(`\ndry run — pass --write to save`);
  }
}

main();
