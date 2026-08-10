/**
 * Replace the hand-typed masjid coordinates with real geocoded ones.
 *
 * The seed coordinates in masjids.json were eyeballed — several are rounded
 * to two or three decimals, which is 100 m to over 1 km of error, enough to
 * drop a map pin across the street or on the wrong block. This looks each
 * masjid's street address up with OpenStreetMap's Nominatim geocoder (free,
 * no key, no billing) and writes back a precise lat/lng.
 *
 * Fail safe, like the scraper: the existing coordinate is roughly right, so
 * it's used as an anchor. A geocode result more than SANITY_KM away means
 * Nominatim matched the wrong place — that result is rejected and the old
 * coordinate kept, never silently replaced with something worse.
 *
 * There is no network in the build sandbox, so this is meant to run in CI
 * (see .github/workflows/geocode.yml) or on a machine with internet.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Masjid } from "./prayer-invariant";

const HERE = dirname(fileURLToPath(import.meta.url));
// GEOCODE_DATA lets a test point this at a throwaway copy.
const DATA = process.env.GEOCODE_DATA ?? resolve(HERE, "../src/data/masjids.json");

// Nominatim's usage policy: at most one request a second, and a real
// User-Agent identifying the app. https://operations.osmfoundation.org/policies/nominatim/
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "toronto-masjid-times/1.0 (github.com/SijanDhungana/Prayer-Tracker)";
const RATE_LIMIT_MS = 1100;

// A correction is normally under a few hundred metres. A jump larger than
// this is Nominatim finding a different building of the same name, or the
// wrong Kingston Rd entirely — reject it and keep the anchor.
const SANITY_KM = 3;

interface Hit {
  lat: string;
  lon: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Query variants, tried in order. Nominatim does better with a clean street
 * address than with "Unit 2, …" or a "#1" suite, so those are stripped; the
 * masjid's name is a last resort when the address doesn't resolve.
 */
function queriesFor(masjid: Masjid): string[] {
  const variants: string[] = [];
  if (masjid.address) {
    const clean = masjid.address
      .replace(/\bunit\s*\d+,?\s*/i, "")
      .replace(/#\s*\d+,?\s*/i, "")
      .trim();
    variants.push(clean);
    if (clean !== masjid.address) variants.push(masjid.address);
  }
  variants.push(`${masjid.name}, Toronto, Ontario, Canada`);
  return variants;
}

async function geocode(query: string): Promise<Hit | null> {
  const url = `${ENDPOINT}?${new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "ca",
    limit: "1",
  })}`;

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.warn(`  ! HTTP ${res.status} for "${query}"`);
    return null;
  }
  const hits = (await res.json()) as Hit[];
  return hits[0] ?? null;
}

/** Round to ~0.1 m — more decimals than that is noise. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

async function main() {
  const masjids: Masjid[] = JSON.parse(await readFile(DATA, "utf8"));
  let changed = 0;
  const flagged: string[] = [];

  for (const masjid of masjids) {
    const anchor = { lat: masjid.lat, lng: masjid.lng };
    let placed: { lat: number; lng: number; via: string } | null = null;

    for (const query of queriesFor(masjid)) {
      const hit = await geocode(query);
      await sleep(RATE_LIMIT_MS);
      if (!hit) continue;

      const found = { lat: Number(hit.lat), lng: Number(hit.lon) };
      const moved = haversineKm(anchor, found);
      if (moved <= SANITY_KM) {
        placed = { ...found, via: query };
        break;
      }
      console.warn(
        `  ? "${query}" resolved ${moved.toFixed(1)} km away — rejected`,
      );
    }

    if (!placed) {
      flagged.push(masjid.name);
      console.log(`✗ ${masjid.name}: kept ${anchor.lat}, ${anchor.lng}`);
      continue;
    }

    const moved = haversineKm(anchor, placed);
    const lat = round6(placed.lat);
    const lng = round6(placed.lng);
    if (lat !== masjid.lat || lng !== masjid.lng) {
      masjid.lat = lat;
      masjid.lng = lng;
      changed++;
      console.log(
        `✓ ${masjid.name}: ${lat}, ${lng}  (moved ${Math.round(moved * 1000)} m)`,
      );
    } else {
      console.log(`· ${masjid.name}: already exact`);
    }
  }

  await writeFile(DATA, JSON.stringify(masjids, null, 2) + "\n");
  console.log(
    `\n${changed} coordinate${changed === 1 ? "" : "s"} updated, ` +
      `${flagged.length} kept as-is${flagged.length ? `: ${flagged.join(", ")}` : ""}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
