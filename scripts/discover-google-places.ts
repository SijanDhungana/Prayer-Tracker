/**
 * Searches Google Places for mosques across a curated list of Ontario towns
 * and cities, rather than tiling the whole province blindly — most of
 * Ontario is unpopulated, and a full-province grid would burn API calls on
 * empty forest and lake for no benefit. The city list mirrors what actually
 * turned up mosques in the OSM export (Toronto/GTA, Ottawa, the Waterloo
 * region, Windsor, Hamilton, Niagara, Sudbury, Thunder Bay, Cornwall,
 * Cambridge, Guelph, Barrie, Bradford) plus a handful of other populated
 * Ontario centres OSM's volunteer coverage might have missed (Kingston,
 * Peterborough, Sarnia, Chatham, Brantford, Sault Ste. Marie, Timmins,
 * North Bay, Orillia).
 *
 * This is a discovery tool, not a data source for the app — it only answers
 * "does Google know about a masjid neither OSM nor our own list has," and
 * writes a plain snapshot for import-google-places.ts to dedupe next.
 * Nothing here touches src/data/masjids.json.
 *
 * Google's terms restrict how long Places results can be cached — this
 * writes a one-time snapshot to decide what's worth adding by hand, not a
 * database kept in permanent sync with Google.
 *
 * Uses Places API (New) Text Search — a single call per city returns name,
 * address, coordinates AND website together (no separate Details lookup
 * needed), and it paginates up to 60 results per city if a field mask asks
 * for nextPageToken. "mosque" as a search term catches more than the strict
 * `mosque` place type would (islamic centres, musallas that Google hasn't
 * categorized as a place of worship at all).
 *
 * The API key for this MUST be a key with Application restriction "None" —
 * a "Websites" restriction checks the browser Referer header, which a
 * server-side script never sends, so every request from a website-restricted
 * key gets rejected here regardless of which APIs are enabled on it. Use a
 * separate key from the one shipped in the app; the app's public key should
 * stay restricted to your actual domains.
 *
 * Run:
 *   GOOGLE_PLACES_API_KEY=... npx tsx scripts/discover-google-places.ts
 *
 * Get a key at console.cloud.google.com: enable "Places API (New)", create
 * an API key, restrict it to that API only with no application restriction.
 * Billing must be on for the project, but Google's $200/month free credit
 * comfortably covers a run this size.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(HERE, "google-places-ontario-raw.json");

// 20km covers a city and its immediate suburbs without so much overlap
// between neighbouring cities that the same mosque gets pulled twice from
// unrelated searches (harmless if it happens — results are deduped by
// place id below — but wasteful of quota).
const RADIUS_M = 20_000;

const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Toronto/GTA", lat: 43.7, lng: -79.42 },
  { name: "Mississauga", lat: 43.589, lng: -79.644 },
  { name: "Brampton", lat: 43.7315, lng: -79.7624 },
  { name: "Vaughan/Markham/Richmond Hill", lat: 43.85, lng: -79.42 },
  { name: "Oakville/Milton", lat: 43.47, lng: -79.75 },
  { name: "Oshawa/Durham", lat: 43.9, lng: -78.85 },
  { name: "Hamilton", lat: 43.2557, lng: -79.8711 },
  { name: "Niagara", lat: 43.1594, lng: -79.2469 },
  { name: "Kitchener/Waterloo/Cambridge", lat: 43.45, lng: -80.49 },
  { name: "Guelph", lat: 43.5448, lng: -80.2482 },
  { name: "London", lat: 42.9849, lng: -81.2453 },
  { name: "Windsor", lat: 42.3149, lng: -83.0364 },
  { name: "Chatham", lat: 42.4048, lng: -82.191 },
  { name: "Sarnia", lat: 42.9749, lng: -82.4066 },
  { name: "Brantford", lat: 43.1394, lng: -80.2644 },
  { name: "Barrie", lat: 44.3894, lng: -79.6903 },
  { name: "Bradford", lat: 44.1173, lng: -79.5663 },
  { name: "Orillia", lat: 44.6079, lng: -79.4187 },
  { name: "Ottawa", lat: 45.4215, lng: -75.6972 },
  { name: "Cornwall", lat: 45.0225, lng: -74.7288 },
  { name: "Kingston", lat: 44.2312, lng: -76.486 },
  { name: "Peterborough", lat: 44.3091, lng: -78.3197 },
  { name: "Sudbury", lat: 46.4917, lng: -80.993 },
  { name: "Sault Ste. Marie", lat: 46.5136, lng: -84.3358 },
  { name: "Thunder Bay", lat: 48.3809, lng: -89.2477 },
  { name: "Timmins", lat: 48.4758, lng: -81.3305 },
  { name: "North Bay", lat: 46.3091, lng: -79.4608 },
];

interface RawPlace {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
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

  for (let page = 0; page < 3; page++) {
    const body: Record<string, unknown> = pageToken
      ? { pageToken }
      : {
          textQuery: "mosque",
          locationBias: {
            circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M },
          },
          pageSize: 20,
        };

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
      "GOOGLE_PLACES_API_KEY is not set. Get one from console.cloud.google.com " +
        "(enable Places API (New), create a key restricted to it with no application " +
        "restriction) and run again as: " +
        "GOOGLE_PLACES_API_KEY=... npx tsx scripts/discover-google-places.ts",
    );
    process.exit(1);
  }

  const seen = new Map<string, RawPlace>();

  for (const city of CITIES) {
    console.log(`Searching ${city.name} …`);
    const results = await textSearch(apiKey, city.lat, city.lng);
    console.log(`  ${results.length} result(s)`);

    for (const p of results) {
      if (seen.has(p.id)) continue;
      seen.set(p.id, {
        placeId: p.id,
        name: p.displayName?.text ?? "(unnamed)",
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        address: p.formattedAddress ?? null,
        website: p.websiteUri ?? null,
      });
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  const places = [...seen.values()];
  writeFileSync(OUTPUT, JSON.stringify(places, null, 2) + "\n");
  console.log(`\n${places.length} unique place(s) found. wrote ${OUTPUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
