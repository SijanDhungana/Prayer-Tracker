import { mergeJumuah } from "../scrape.ts";
import type { Masjid } from "./prayer-invariant";

const base = (jumuah: string[]): Masjid =>
  ({
    id: "t", name: "T", address: "", lat: 43.65, lng: -79.38, website: "",
    calc: { method: "NorthAmerica", madhab: "hanafi" },
    iqamah: {}, jumuah: jumuah.map((khutbah) => ({ khutbah })),
    lastVerified: null,
  }) as Masjid;

/** The stored shape has jumuah optional, so read it the way callers must. */
const times = (m: Masjid) => (m.jumuah ?? []).map((s) => s.khutbah);

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

// Several sittings, out of order, with a duplicate from a banner.
{
  const m = base([]);
  const r = mergeJumuah(m, ["14:30", "13:30", "14:30", "15:30"]);
  check("three sittings, deduped and ordered",
    times(m), ["13:30", "14:30", "15:30"]);
  check("  reports what it added", r.added, "3: 13:30/14:30/15:30");
}

// One bad sitting must not delete the two good ones already on file.
{
  const m = base(["13:00", "14:00", "15:00"]);
  const r = mergeJumuah(m, ["13:00", "25:99"]);
  check("partial read never overwrites known sittings",
    times(m), ["13:00", "14:00", "15:00"]);
  check("  but is flagged", r.rejected, "jumu'ah 25:99 implausible");
}

// With nothing on file, a partial read beats a blank.
{
  const m = base([]);
  const r = mergeJumuah(m, ["13:15", "09:00"]);
  check("publishes survivors when nothing is on file",
    times(m), ["13:15"]);
  check("  and flags the dropped one", r.rejected, "jumu'ah 09:00 implausible");
}

// A masjid with exactly one Jummah stays at one.
{
  const m = base([]);
  mergeJumuah(m, ["13:30"]);
  check("single sitting stays single", times(m), ["13:30"]);
}

// Nothing found and nothing stored: say so, don't silently pass.
{
  const m = base([]);
  const r = mergeJumuah(m, []);
  check("empty read with no history is reported missing", r.missing, true);
}

// Nothing found but times already on file: not missing, and not wiped.
{
  const m = base(["13:30"]);
  const r = mergeJumuah(m, []);
  check("empty read keeps existing sittings", times(m), ["13:30"]);
  check("  and is not called missing", r.missing, false);
}

// Unchanged sittings shouldn't add noise to the run summary.
{
  const m = base(["13:30", "14:30"]);
  const r = mergeJumuah(m, ["14:30", "13:30"]);
  check("no summary line when nothing changed", r.added, "");
}

// A model returning junk instead of an array must not throw.
{
  const m = base(["13:30"]);
  const r = mergeJumuah(m, "13:30");
  check("non-array read is survived", times(m), ["13:30"]);
  check("  and reported as not missing", r.missing, false);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
