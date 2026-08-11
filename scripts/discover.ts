/**
 * Turn a list of masjid *names* into real entries in masjids.json.
 *
 * Someone naming masjids they'd like added shouldn't have to hunt down each
 * one's postal address, coordinates and website by hand. This looks each name
 * up in OpenStreetMap (free, no key) and, when the answer is confident enough,
 * writes a complete entry — address, coordinates, and the website OSM has on
 * file. The daily scraper then picks up prayer times from that website on its
 * next run.
 *
 * Names it can't place confidently stay in pending-masjids.json with the
 * reason recorded, so a failed lookup is visible rather than silently dropped.
 * Nothing half-formed is ever written to masjids.json: the app only ever sees
 * masjids with real coordinates.
 *
 * There's no network in the build sandbox, so this runs in CI — see
 * .github/workflows/discover.yml.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Masjid } from "./prayer-invariant";

const HERE = dirname(fileURLToPath(import.meta.url));
const MASJIDS = process.env.DISCOVER_MASJIDS ?? resolve(HERE, "../src/data/masjids.json");
const PENDING = process.env.DISCOVER_PENDING ?? resolve(HERE, "pending-masjids.json");

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "toronto-masjid-times/1.0 (github.com/SijanDhungana/Prayer-Tracker)";
const RATE_LIMIT_MS = 1100;

/**
 * Ontario's rough bounding box. A masjid name that resolves outside it means
 * Nominatim matched a namesake in another province or country — common, since
 * names like "Madani Mosque" recur worldwide.
 */
const ONTARIO = { minLat: 41.6, maxLat: 57.0, minLng: -95.2, maxLng: -74.3 };

/** Two entries this close together are the same building under two names. */
const SAME_PLACE_KM = 0.2;

interface Pending {
  name: string;
  near?: string;
  /** Written back when a lookup fails, so the next run has the history. */
  note?: string;
}

interface Hit {
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Comparable word tokens: "Madinah Masjid (Jamiatul…)" → {madinah, masjid, …} */
const tokens = (name: string) =>
  new Set(name.toLowerCase().match(/[a-z0-9]+/g) ?? []);

/**
 * Whether two names denote the same masjid.
 *
 * Plain string equality is too strict — the file stores "Madinah Masjid
 * (Jamiatul Muslemin of Toronto)" for what a list calls "Madinah Masjid".
 * Substring matching is too loose in the other direction: "Masjid Ali" is a
 * substring of "Masjid Al-Istiqama", which is a different masjid entirely.
 * Requiring every word of the shorter name to appear in the longer one gets
 * both right.
 */
function sameName(a: string, b: string): boolean {
  const [x, y] = [tokens(a), tokens(b)];
  const [small, large] = x.size <= y.size ? [x, y] : [y, x];
  // One word in common is a coincidence ("Masjid", "Islamic"); two is a claim.
  if (small.size < 2) return false;
  return [...small].every((word) =>
    [...large].some((other) => sameWord(word, other)),
  );
}

/**
 * Whether two words are the same word.
 *
 * Transliteration from Arabic has no single spelling: the same masjid is
 * "Zakariya" and "Zakariaya". One edit of slack on a longish word absorbs
 * that, and no more — at two edits "markham" reaches "markaz", which would
 * fold Markham Masjid into Toronto Markaz and lose a real masjid.
 *
 * The asymmetry is deliberate. A duplicate this misses is still caught by the
 * coordinate check downstream; a masjid wrongly merged away has no such
 * second chance, so the bias is toward letting duplicates through.
 */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.max(a.length, b.length) < 5) return false;
  return editDistance(a, b) <= 1;
}

/** Levenshtein distance, two rows at a time. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
    }
    previous = current;
  }

  return previous[b.length];
}

/** URL-safe id, deduplicated against ids already in use. */
function makeId(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "masjid";

  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * A postal-style address from OSM's parts, falling back to its display name.
 * `display_name` alone is verbose ("…, Golden Horseshoe, Ontario, M1G 3M6,
 * Canada"), which reads badly on a card.
 */
function formatAddress(hit: Hit): string {
  const a = hit.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city =
    a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality ?? a.county;
  const parts = [street, city, a.state && "ON", a.postcode].filter(Boolean);
  return parts.length >= 2
    ? parts.join(", ")
    : hit.display_name.split(",").slice(0, 4).join(",").trim();
}

/** Queries to try in order — most specific first. */
function queriesFor(entry: Pending): string[] {
  const queries = [];
  if (entry.near) queries.push(`${entry.name}, ${entry.near}`);
  queries.push(`${entry.name}, Ontario, Canada`);
  return queries;
}

async function search(query: string): Promise<Hit[]> {
  const url = `${ENDPOINT}?${new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "ca",
    addressdetails: "1",
    // Where OSM keeps `website`, which saves the maintainer finding it by hand
    // and lets the scraper start reading times immediately.
    extratags: "1",
    limit: "5",
  })}`;

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.warn(`  ! HTTP ${res.status} for "${query}"`);
    return [];
  }
  return (await res.json()) as Hit[];
}

/**
 * Prefer an actual place of worship over, say, a bus stop or a street named
 * after the same person. OSM tags mosques as amenity=place_of_worship.
 */
function pickBest(hits: Hit[]): Hit | null {
  const worship = hits.find(
    (h) => h.type === "place_of_worship" || h.class === "amenity",
  );
  return worship ?? hits[0] ?? null;
}

function tidyWebsite(raw: string | undefined): string {
  if (!raw) return "";
  const url = raw.trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

async function main() {
  const masjids: Masjid[] = JSON.parse(await readFile(MASJIDS, "utf8"));
  const pending: Pending[] = JSON.parse(await readFile(PENDING, "utf8"));

  const ids = new Set(masjids.map((m) => m.id));
  const known: string[] = masjids.map((m) => m.name);

  const added: Masjid[] = [];
  const unresolved: Pending[] = [];

  for (const entry of pending) {
    // A name already in the file needs no lookup at all.
    const twinByName = known.find((name) => sameName(name, entry.name));
    if (twinByName) {
      console.log(`· ${entry.name}: already listed as ${twinByName}`);
      continue;
    }

    let placed: { hit: Hit; lat: number; lng: number } | null = null;
    let reason = "no match in OpenStreetMap";

    for (const query of queriesFor(entry)) {
      const hits = await search(query);
      await sleep(RATE_LIMIT_MS);

      const hit = pickBest(hits);
      if (!hit) continue;

      const lat = Number(hit.lat);
      const lng = Number(hit.lon);

      if (
        lat < ONTARIO.minLat ||
        lat > ONTARIO.maxLat ||
        lng < ONTARIO.minLng ||
        lng > ONTARIO.maxLng
      ) {
        reason = "matched a namesake outside Ontario";
        continue;
      }

      placed = { hit, lat, lng };
      break;
    }

    if (!placed) {
      console.log(`✗ ${entry.name}: ${reason}`);
      unresolved.push({ ...entry, note: reason });
      continue;
    }

    // Same building under a different name — the surest duplicate test there
    // is, and the reason names alone aren't enough.
    const twin = masjids.find(
      (m) => haversineKm(m, { lat: placed!.lat, lng: placed!.lng }) <= SAME_PLACE_KM,
    );
    if (twin) {
      console.log(`· ${entry.name}: same location as ${twin.name} — skipped`);
      continue;
    }

    const id = makeId(entry.name, ids);
    ids.add(id);
    known.push(entry.name);

    const website = tidyWebsite(placed.hit.extratags?.website);
    const masjid: Masjid = {
      id,
      name: entry.name,
      address: formatAddress(placed.hit),
      lat: round6(placed.lat),
      lng: round6(placed.lng),
      website,
      calc: { method: "NorthAmerica", madhab: "hanafi" },
      iqamah: {},
      jumuah: [],
      lastVerified: null,
      // Nothing here is confirmed by a human or a scrape yet.
      needsReview: true,
      source: "seed",
    };

    masjids.push(masjid);
    added.push(masjid);
    console.log(
      `✓ ${entry.name}: ${masjid.address}` +
        (website ? `  → ${website}` : "  (no website on file)"),
    );
  }

  await writeFile(MASJIDS, JSON.stringify(masjids, null, 2) + "\n");
  await writeFile(PENDING, JSON.stringify(unresolved, null, 2) + "\n");

  const withSite = added.filter((m) => m.website).length;
  console.log(
    `\n${added.length} added (${withSite} with a website the scraper can read), ` +
      `${unresolved.length} still unresolved.`,
  );
  if (unresolved.length) {
    console.log("Unresolved: " + unresolved.map((p) => p.name).join(", "));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
