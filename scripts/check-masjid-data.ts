import {
  isNewerOrEqual,
  newestVerified,
  validateMasjids,
} from "../src/lib/masjidData";
import type { Masjid } from "../src/lib/types";

/**
 * The runtime directory fetch is the one path where data the app did not build
 * with can become a prayer time on someone's screen. These tests are about
 * what it refuses: a captive portal's login page and a host that answers every
 * path with index.html both arrive as HTTP 200, and both must leave the times
 * already on screen untouched rather than replacing them with nothing.
 */
const masjid = (over: Partial<Masjid> = {}): Masjid =>
  ({
    id: "m",
    name: "M",
    address: "",
    lat: 43.65,
    lng: -79.38,
    website: "",
    calc: { method: "NorthAmerica", madhab: "hanafi" },
    iqamah: { fajr: { type: "fixed", time: "05:45" } },
    jumuah: [],
    lastVerified: "2026-08-24",
    ...over,
  }) as Masjid;

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

// ── what it accepts ──────────────────────────────────────────────────────
check("a well-formed directory passes", validateMasjids([masjid()])?.length, 1);
check(
  "shafi is a valid school too",
  validateMasjids([masjid({ calc: { method: "NorthAmerica", madhab: "shafi" } })])?.length,
  1,
);

// ── what it refuses ──────────────────────────────────────────────────────
check("an HTML page is refused", validateMasjids("<!doctype html><html>"), null);
check("an empty array is refused", validateMasjids([]), null);
check("null is refused", validateMasjids(null), null);
check("an object is refused", validateMasjids({ masjids: [] }), null);
check("a null entry is refused", validateMasjids([null]), null);
check("a missing id is refused", validateMasjids([masjid({ id: undefined as never })]), null);
check("an empty id is refused", validateMasjids([masjid({ id: "" })]), null);
check(
  "a string latitude is refused",
  validateMasjids([masjid({ lat: "43.65" as never })]),
  null,
);
check("NaN coordinates are refused", validateMasjids([masjid({ lng: NaN })]), null);
check("a missing calc block is refused", validateMasjids([masjid({ calc: undefined as never })]), null);
check(
  "an unknown school is refused",
  validateMasjids([masjid({ calc: { method: "NorthAmerica", madhab: "maliki" as never } })]),
  null,
);
check("a missing iqamah block is refused", validateMasjids([masjid({ iqamah: undefined as never })]), null);
check(
  "one bad entry rejects the whole payload",
  validateMasjids([masjid(), masjid({ id: "" })]),
  null,
);

// ── vintage ──────────────────────────────────────────────────────────────
check(
  "newest wins across mixed dates",
  newestVerified([masjid({ lastVerified: "2026-08-01" }), masjid({ lastVerified: "2026-08-24" })]),
  "2026-08-24",
);
check("no dates yields null", newestVerified([masjid({ lastVerified: null as never })]), null);

check(
  "a newer payload replaces an older one",
  isNewerOrEqual([masjid({ lastVerified: "2026-08-24" })], [masjid({ lastVerified: "2026-08-14" })]),
  true,
);
check(
  "an equal vintage is accepted",
  isNewerOrEqual([masjid({ lastVerified: "2026-08-24" })], [masjid({ lastVerified: "2026-08-24" })]),
  true,
);
check(
  "a rolled-back deployment cannot push older times onto a newer app",
  isNewerOrEqual([masjid({ lastVerified: "2026-07-01" })], [masjid({ lastVerified: "2026-08-24" })]),
  false,
);
check(
  "an undated payload is accepted rather than stranding the app on its bundle",
  isNewerOrEqual([masjid({ lastVerified: null as never })], [masjid({ lastVerified: "2026-08-24" })]),
  true,
);

console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
