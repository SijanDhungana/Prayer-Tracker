import { applyOverrides, type ApprovedTime } from "../src/lib/overrides";
import type { Masjid } from "../src/lib/types";

/**
 * An approved correction beats the shipped baseline — but only while it is
 * the more recent of the two. Getting this wrong is not a cosmetic bug: a
 * correction approved once used to override the file permanently, so a whole
 * series of freshly verified imports rendered as the old value on the live
 * site while the adhan times beside them updated normally, which is exactly
 * the shape of failure that is hardest to spot.
 */
const masjid = (lastVerified: string | null, fajr = "05:45"): Masjid =>
  ({
    id: "m", name: "M", address: "", lat: 43.65, lng: -79.38, website: "",
    calc: { method: "NorthAmerica", madhab: "hanafi" },
    iqamah: { fajr: { type: "fixed", time: fajr } },
    jumuah: [{ khutbah: "13:30" }],
    lastVerified,
  }) as unknown as Masjid;

const row = (over: Partial<ApprovedTime> = {}): ApprovedTime => ({
  masjid_id: "m",
  slot: "fajr",
  suggested_time: "05:20",
  offset_minutes: null,
  reviewed_at: "2026-08-14T12:00:00Z",
  ...over,
});

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

const fajrOf = (list: Masjid[]) => (list[0].iqamah.fajr as { time: string }).time;

// ── recency ──────────────────────────────────────────────────────────────
check(
  "a correction older than the baseline no longer wins",
  fajrOf(applyOverrides([masjid("2026-08-24")], [row()])),
  "05:45",
);

check(
  "a correction newer than the baseline wins",
  fajrOf(applyOverrides([masjid("2026-08-10")], [row()])),
  "05:20",
);

check(
  "same day goes to the correction",
  fajrOf(applyOverrides([masjid("2026-08-14")], [row()])),
  "05:20",
);

check(
  "a baseline that was never verified yields to any correction",
  fajrOf(applyOverrides([masjid(null)], [row()])),
  "05:20",
);

check(
  "a correction with no timestamp still applies rather than being lost",
  fajrOf(applyOverrides([masjid("2026-08-24")], [row({ reviewed_at: null })])),
  "05:20",
);

check(
  "an unparseable timestamp is treated as no timestamp, not as very old",
  fajrOf(applyOverrides([masjid("2026-08-24")], [row({ reviewed_at: "not a date" })])),
  "05:20",
);

// The comparison must happen on Toronto's clock, not the runtime's: an
// approval late on the 24th UTC is still the 24th in Toronto.
check(
  "timestamps are compared on Toronto's calendar",
  fajrOf(applyOverrides([masjid("2026-08-24")], [row({ reviewed_at: "2026-08-25T02:00:00Z" })])),
  "05:20",
);

// ── unchanged behaviour ──────────────────────────────────────────────────
check(
  "no corrections leaves the list untouched",
  fajrOf(applyOverrides([masjid("2026-08-24")], [])),
  "05:45",
);

check(
  "a correction for another masjid is ignored",
  fajrOf(applyOverrides([masjid("2026-08-10")], [row({ masjid_id: "other" })])),
  "05:45",
);

check(
  "an offset correction still applies",
  applyOverrides([masjid("2026-08-10")], [
    row({ slot: "maghrib", suggested_time: null, offset_minutes: 7 }),
  ])[0].iqamah.maghrib,
  { type: "offset", minutes: 7 },
);

check(
  "a stale jumuah correction no longer replaces the sittings",
  applyOverrides([masjid("2026-08-24")], [
    row({ slot: "jumuah", suggested_time: "12:00" }),
  ])[0].jumuah,
  [{ khutbah: "13:30" }],
);

check(
  "a current jumuah correction does replace them",
  applyOverrides([masjid("2026-08-10")], [
    row({ slot: "jumuah", suggested_time: "12:00" }),
  ])[0].jumuah,
  [{ khutbah: "12:00" }],
);

check(
  "a row with neither a time nor an offset is skipped",
  fajrOf(applyOverrides([masjid("2026-08-10")], [
    row({ suggested_time: null, offset_minutes: null }),
  ])),
  "05:45",
);

console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
