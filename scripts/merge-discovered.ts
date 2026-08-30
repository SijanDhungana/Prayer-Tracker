/**
 * Folds discovered mosques into src/data/masjids.json.
 *
 * Everything added here is marked `needsReview: true` and `source: "discovery"`.
 * That is not a formality. These times were read off a website by a machine and
 * confirmed by nobody — no one has phoned a single one of these masjids. In an
 * app where a wrong time means a missed prayer, they have to carry that label
 * until a human checks them, and the trust UI already keys off `needsReview`.
 *
 * Only mosques with coordinates can be added: the app sorts and filters by
 * distance, and check-masjid-data.ts rejects any entry with a non-numeric
 * lat/lng, so a mosque with no position is skipped rather than guessed at.
 *
 * Anything flagged `needsReview` in the discovery snapshot (times that cannot
 * be right for an Ontario sky) is refused outright — a labelled-but-wrong time
 * is still a wrong time on the screen.
 *
 * Maghrib is written as an offset rather than a fixed time whenever the read
 * came back empty, which is the normal case: most masjids pray Maghrib a few
 * minutes after the adhan instead of at a set clock time, and the data model
 * already expresses that as { type: "offset", minutes: N }.
 *
 * Run: npx tsx scripts/merge-discovered.ts [--write]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OSM_CANDIDATES = path.join(HERE, "ontario-mosques-new.json");
const GP_CANDIDATES = path.join(HERE, "google-places-new.json");
const MASJIDS = path.join(HERE, "..", "src", "data", "masjids.json");

/**
 * Every discovery snapshot, oldest first — the filename carries the date it
 * was collected, so sorting by name sorts by run. A later run supersedes an
 * earlier one for the same masjid: a re-run exists precisely because the first
 * read was wrong or missing, so the newest reading is the one to keep.
 */
function snapshotFiles(): string[] {
  return fs
    .readdirSync(HERE)
    .filter((f) => /^discovered-prayer-times-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => path.join(HERE, f));
}

interface Discovered {
  name: string;
  source: string;
  iqamah: Record<string, string | null>;
  jumuah: string[];
  needsReview?: string;
  /** Date of the run this reading came from, filled in from the filename. */
  collected?: string;
}

interface Located {
  name: string;
  website: string | null;
  lat: number;
  lng: number;
  address: string | null;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

function main() {
  const write = process.argv.includes("--write");

  // Later snapshots overwrite earlier ones for the same masjid.
  const byName = new Map<string, Discovered>();
  const files = snapshotFiles();
  for (const file of files) {
    const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
    const collected = snapshot.collected ?? path.basename(file).slice(-15, -5);
    for (const m of snapshot.mosques as Discovered[]) {
      byName.set(m.name, { ...m, collected });
    }
  }
  const discovered = [...byName.values()];
  console.log(`Snapshots read: ${files.map((f) => path.basename(f)).join(", ")}`);

  const existing = JSON.parse(fs.readFileSync(MASJIDS, "utf8"));

  const located = new Map<string, Located>();
  for (const m of JSON.parse(fs.readFileSync(OSM_CANDIDATES, "utf8")) as Located[]) {
    if (typeof m.lat === "number") located.set(m.name, m);
  }
  // Optional: only present once import-google-places.ts --write has been run
  // and the result committed. Without it the Google Places half has no
  // coordinates and is skipped rather than added at a guessed position.
  if (fs.existsSync(GP_CANDIDATES)) {
    for (const m of JSON.parse(fs.readFileSync(GP_CANDIDATES, "utf8")) as Located[]) {
      if (typeof m.lat === "number") located.set(m.name, m);
    }
  }

  const existingIds = new Set(existing.map((m: { id: string }) => m.id));
  const added: string[] = [];
  const skippedNoCoords: string[] = [];
  const skippedSuspect: string[] = [];
  const skippedDuplicate: string[] = [];
  const skippedIncomplete: string[] = [];

  for (const d of discovered) {
    if (d.needsReview) {
      skippedSuspect.push(d.name);
      continue;
    }

    // Every prayer must resolve to something on screen. A blank row in a
    // prayer app reads as "no congregation" rather than "we could not read
    // this", which is worse than the masjid simply not being listed yet.
    // Maghrib is the one exception: absent means the offset rule below, which
    // does render a real time.
    const blank = PRAYERS.filter((p) => !d.iqamah[p] && p !== "maghrib");
    if (blank.length) {
      skippedIncomplete.push(`${d.name} (no ${blank.join(", ")})`);
      continue;
    }

    const where = located.get(d.name);
    if (!where) {
      skippedNoCoords.push(d.name);
      continue;
    }

    const id = slug(d.name);
    if (existingIds.has(id)) {
      skippedDuplicate.push(d.name);
      continue;
    }
    existingIds.add(id);

    const iqamah: Record<string, unknown> = {};
    for (const prayer of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) {
      const time = d.iqamah[prayer];
      if (time) {
        iqamah[prayer] = { type: "fixed", time };
      } else if (prayer === "maghrib") {
        // Not a missing read — the ordinary case. Praying a few minutes after
        // the adhan is what most masjids do, so express it the way the model
        // already does rather than inventing a clock time.
        iqamah[prayer] = { type: "offset", minutes: 5 };
      }
      // A missing Fajr/Dhuhr/Asr/Isha is left absent rather than filled in.
      // The resolver returns null for a missing rule and the UI shows no time,
      // which is the honest outcome; a guess here would be a wrong time.
    }

    added.push(d.name);
    existing.push({
      id,
      name: d.name,
      address: where.address ?? "",
      lat: where.lat,
      lng: where.lng,
      website: where.website ?? "",
      calc: { method: "NorthAmerica", madhab: "hanafi" },
      iqamah,
      jumuah: d.jumuah.map((khutbah) => ({ khutbah })),
      lastVerified: d.collected ?? "",
      // Read by a machine, checked by nobody. Stays true until a human confirms.
      needsReview: true,
      source: "discovery",
    });
  }

  console.log(`Discovered mosques with times: ${discovered.length}`);
  console.log(`Already in the app: ${existing.length - added.length}`);
  console.log(`\nAdded: ${added.length}`);
  for (const n of added) console.log(`  + ${n}`);

  if (skippedSuspect.length) {
    console.log(`\nRefused — times cannot be right for Ontario (${skippedSuspect.length}):`);
    for (const n of skippedSuspect) console.log(`  ! ${n}`);
  }
  if (skippedIncomplete.length) {
    console.log(`\nSkipped — a prayer would render blank (${skippedIncomplete.length}):`);
    for (const n of skippedIncomplete) console.log(`  ~ ${n}`);
  }
  if (skippedDuplicate.length) {
    console.log(`\nSkipped — id already in masjids.json (${skippedDuplicate.length}):`);
    for (const n of skippedDuplicate) console.log(`  = ${n}`);
  }
  if (skippedNoCoords.length) {
    console.log(`\nSkipped — no coordinates available (${skippedNoCoords.length}):`);
    for (const n of skippedNoCoords) console.log(`  ? ${n}`);
    console.log(
      `\n  To include these, run 'npx tsx scripts/import-google-places.ts --write'\n` +
        `  on the machine holding google-places-ontario-raw.json, commit the\n` +
        `  resulting scripts/google-places-new.json, then re-run this script.`,
    );
  }

  console.log(`\nTotal masjids after merge: ${existing.length}`);

  if (write) {
    fs.writeFileSync(MASJIDS, JSON.stringify(existing, null, 2) + "\n");
    console.log(`\nwrote ${MASJIDS}`);
  } else {
    console.log(`\ndry run — pass --write to save`);
  }
}

main();
