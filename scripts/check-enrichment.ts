import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * A match must improve the record it matched, never silently discard it.
 *
 * Masjid Omar Bin Khatab is the case this exists for. OpenStreetMap carries it
 * as four bare tags — name, amenity, religion, wheelchair — with no website at
 * all. Google carries the same mosque, 2m away, with a working site. The two
 * matched on distance, the Google record was dropped as "already known", and
 * the mosque was reported to the user as having no website — while its site
 * was one search away. The user found it by hand in seconds.
 *
 * The cost of that bug is not cosmetic: a mosque filed under "no website" is
 * excluded from scraping entirely, so it can never get prayer times and can
 * never appear in the app. This pins the fix against a real run of the real
 * script, so it fails loudly if the dedup ever goes back to discarding.
 */
let failed = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok && detail) console.log(`    ${detail}`);
};

const SCRIPTS = path.dirname(new URL(import.meta.url).pathname);

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "enrich-"));
  const keep: Record<string, string> = {};
  const files = {
    raw: path.join(SCRIPTS, "google-places-ontario-raw.json"),
    osm: path.join(SCRIPTS, "ontario-mosques-new.json"),
    out: path.join(SCRIPTS, "google-places-new.json"),
    scrapeIn: path.join(SCRIPTS, "google-places-mosques.json"),
  };

  // Preserve whatever is really there; this test writes over these paths.
  for (const [k, f] of Object.entries(files)) {
    if (fs.existsSync(f)) keep[k] = fs.readFileSync(f, "utf8");
  }

  try {
    // An OSM candidate with no website, and the same mosque in Google with one.
    fs.writeFileSync(
      files.osm,
      JSON.stringify(
        [
          { name: "Masjid Bare Record", website: null, lat: 43.6561, lng: -79.3673, address: null, osmId: "node/1" },
          { name: "Masjid Already Has One", website: "https://already.example", lat: 43.7, lng: -79.4, address: "1 A St", osmId: "node/2" },
        ],
        null,
        2,
      ),
    );
    fs.writeFileSync(
      files.raw,
      JSON.stringify(
        [
          {
            placeId: "p1",
            name: "Masjid Bare Record (Google spelling)",
            lat: 43.65612,
            lng: -79.36731,
            address: "232 Parliament St, Toronto, ON M5A 2Z4, Canada",
            website: "https://found-it.example/",
          },
          {
            placeId: "p2",
            name: "Masjid Already Has One",
            lat: 43.7,
            lng: -79.4,
            address: "1 A St, Toronto, ON M1M 1M1, Canada",
            website: "https://google-version.example/",
          },
        ],
        null,
        2,
      ),
    );

    execFileSync("npx", ["tsx", path.join(SCRIPTS, "import-google-places.ts"), "--write"], {
      cwd: path.join(SCRIPTS, ".."),
      stdio: "pipe",
    });

    const after = JSON.parse(fs.readFileSync(files.osm, "utf8"));
    const bare = after.find((m: { name: string }) => m.name === "Masjid Bare Record");
    const had = after.find((m: { name: string }) => m.name === "Masjid Already Has One");

    check(
      "a matched Google record fills in a website OSM was missing",
      bare?.website === "https://found-it.example/",
      `got: ${JSON.stringify(bare?.website)}`,
    );

    check(
      "it fills in the missing address too",
      typeof bare?.address === "string" && bare.address.includes("Parliament"),
      `got: ${JSON.stringify(bare?.address)}`,
    );

    check(
      "an existing website is never overwritten",
      had?.website === "https://already.example",
      `got: ${JSON.stringify(had?.website)}`,
    );

    check(
      "the enriched mosque is still treated as known, not re-added as new",
      !JSON.parse(fs.readFileSync(files.out, "utf8")).some(
        (c: { name: string }) => /Bare Record/.test(c.name),
      ),
      "it was wrongly emitted as a new candidate",
    );
  } finally {
    for (const [k, f] of Object.entries(files)) {
      if (keep[k] !== undefined) fs.writeFileSync(f, keep[k]);
      else if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
