/**
 * Searches Google Places for mosques across Texas.
 *
 * This exists because OpenStreetMap's Texas coverage is thin in a way the OSM
 * export cannot show you: 105 entries for the whole state, of which only 25
 * carry a website and 28 have no name at all. Houston alone has well over
 * eighty mosques and the export lists nine. A website scraper is structurally
 * incapable of reading a mosque nobody has recorded.
 *
 * On Ontario this same pass was the single biggest gain — it found mosques OSM
 * had never recorded, and, through the match-enrichment in
 * import-google-places-texas.ts, filled in websites for dozens more that OSM
 * knew about but had left blank.
 *
 * A separate file from discover-google-places.ts rather than a shared one with
 * a region flag, matching the convention import-osm-texas.ts and scrape-texas.ts
 * already set: each region owns its own list, and a change to Texas cannot
 * quietly alter the Ontario run that feeds the live app.
 *
 * Discovery only. Nothing here touches src/data/masjids.json, and Texas is not
 * part of the app's Toronto-scoped model (CLAUDE.md §3).
 *
 * Google's terms limit how long Places results may be cached — this is a
 * one-time snapshot for deciding what is worth pursuing, not a mirror kept in
 * sync.
 *
 * The API key must have Application restriction "None". A "Websites"
 * restriction checks the browser Referer header, which a server-side script
 * never sends, so a website-restricted key is rejected here whatever APIs are
 * enabled on it. Use a key separate from the one shipped in the app.
 *
 * Run:
 *   GOOGLE_PLACES_API_KEY=... npx tsx scripts/discover-google-places-texas.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(HERE, "texas-google-places-raw.json");

/**
 * 25km per search. Texas metros sprawl far more than Ontario's, so the big
 * four are covered by several points rather than one — a single search caps
 * at 60 results, and Houston alone would blow through that on its own.
 */
const RADIUS_M = 25_000;

const CITIES: { name: string; lat: number; lng: number }[] = [
  // Greater Houston — the largest Muslim population in the state, and the one
  // the OSM export understates worst (9 entries for the whole metro).
  { name: "Houston — downtown", lat: 29.7604, lng: -95.3698 },
  { name: "Houston — southwest", lat: 29.6905, lng: -95.5577 },
  { name: "Houston — north", lat: 29.9312, lng: -95.4194 },
  { name: "Houston — east/Pasadena", lat: 29.6911, lng: -95.2091 },
  { name: "Sugar Land / Missouri City", lat: 29.5994, lng: -95.6142 },
  { name: "Katy", lat: 29.7858, lng: -95.8245 },
  { name: "The Woodlands / Spring", lat: 30.1658, lng: -95.4613 },
  { name: "Pearland", lat: 29.5636, lng: -95.2861 },

  // Dallas–Fort Worth.
  { name: "Dallas — downtown", lat: 32.7767, lng: -96.797 },
  { name: "Dallas — north/Richardson", lat: 32.9483, lng: -96.7299 },
  { name: "Plano", lat: 33.0198, lng: -96.6989 },
  { name: "Irving", lat: 32.814, lng: -96.9489 },
  { name: "Fort Worth", lat: 32.7555, lng: -97.3308 },
  { name: "Arlington", lat: 32.7357, lng: -97.1081 },
  { name: "Garland / Mesquite", lat: 32.87, lng: -96.6 },
  { name: "Frisco / McKinney", lat: 33.1507, lng: -96.7 },
  { name: "Denton", lat: 33.2148, lng: -97.1331 },

  // Central and south.
  { name: "Austin — central", lat: 30.2672, lng: -97.7431 },
  { name: "Austin — north/Round Rock", lat: 30.5083, lng: -97.6789 },
  { name: "San Antonio — central", lat: 29.4241, lng: -98.4936 },
  { name: "San Antonio — north", lat: 29.5872, lng: -98.5142 },
  { name: "College Station", lat: 30.628, lng: -96.3344 },
  { name: "Waco", lat: 31.5493, lng: -97.1467 },
  { name: "Killeen", lat: 31.1171, lng: -97.7278 },
  { name: "Victoria", lat: 28.8053, lng: -97.0036 },
  { name: "Corpus Christi", lat: 27.8006, lng: -97.3964 },
  { name: "Laredo", lat: 27.5306, lng: -99.4803 },
  { name: "Rio Grande Valley — McAllen", lat: 26.2034, lng: -98.23 },
  { name: "Brownsville", lat: 25.9017, lng: -97.4975 },

  // East, west and the Panhandle.
  { name: "Beaumont", lat: 30.0802, lng: -94.1266 },
  { name: "Tyler", lat: 32.3513, lng: -95.3011 },
  { name: "Longview", lat: 32.5007, lng: -94.7405 },
  { name: "El Paso", lat: 31.7619, lng: -106.485 },
  { name: "Lubbock", lat: 33.5779, lng: -101.8552 },
  { name: "Amarillo", lat: 35.222, lng: -101.8313 },
  { name: "Midland / Odessa", lat: 31.9973, lng: -102.0779 },
  { name: "Abilene", lat: 32.4487, lng: -99.7331 },
  { name: "San Angelo", lat: 31.4638, lng: -100.437 },
  { name: "Wichita Falls", lat: 33.9137, lng: -98.4934 },
];

interface RawPlace {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  searchedFrom: string;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "nextPageToken",
].join(",");

async function textSearch(apiKey: string, lat: number, lng: number): Promise<any[]> {
  const results: any[] = [];
  let pageToken: string | undefined;

  // Every page repeats the original search, with only pageToken added.
  // Sending the token alone is rejected — "Request parameters for paging
  // requests must match the initial SearchText request" — and because the
  // failure is per-page rather than per-search, it looks like success: page
  // one returns its 20 and the run reports a tidy "20 result(s)" for a city
  // that had far more. Every metro here came back capped at exactly 20 until
  // this was fixed.
  const search: Record<string, unknown> = {
    textQuery: "mosque",
    locationBias: {
      circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M },
    },
    pageSize: 20,
  };

  for (let page = 0; page < 3; page++) {
    const body = pageToken ? { ...search, pageToken } : search;

    // A fresh page token needs a moment to activate server-side.
    if (pageToken) await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    const data: any = await res.json();

    if (!res.ok) {
      console.error(`  ! ${res.status}: ${data.error?.message ?? "unknown error"}`);
      break;
    }

    results.push(...(data.places ?? []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return results;
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error(
      "GOOGLE_PLACES_API_KEY is not set. Create a key at console.cloud.google.com with " +
        "Places API (New) enabled and Application restriction 'None', then run:\n" +
        "  GOOGLE_PLACES_API_KEY=... npx tsx scripts/discover-google-places-texas.ts",
    );
    process.exit(1);
  }

  const seen = new Map<string, RawPlace>();

  for (const city of CITIES) {
    process.stdout.write(`Searching ${city.name} … `);
    const results = await textSearch(apiKey, city.lat, city.lng);
    let fresh = 0;

    for (const p of results) {
      if (seen.has(p.id)) continue;
      fresh++;
      seen.set(p.id, {
        placeId: p.id,
        name: p.displayName?.text ?? "(unnamed)",
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        address: p.formattedAddress ?? null,
        website: p.websiteUri ?? null,
        searchedFrom: city.name,
      });
    }
    console.log(`${results.length} result(s), ${fresh} new`);

    await new Promise((r) => setTimeout(r, 200));
  }

  const places = [...seen.values()];
  writeFileSync(OUTPUT, JSON.stringify(places, null, 2) + "\n");

  const withSite = places.filter((p) => p.website).length;
  console.log(`\n${places.length} unique place(s); ${withSite} carry a website.`);
  console.log(`wrote ${OUTPUT}`);
  console.log(`\nNext: npx tsx scripts/import-google-places-texas.ts --write`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
