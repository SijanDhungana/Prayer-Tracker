import { mapAdDinResponse, normaliseAdDinTime } from "../scrape.ts";

/**
 * The Ad-Din mapping is written against an endpoint nobody here has seen a
 * response from — this environment cannot reach portal.ad-din.ca, and the
 * field names came from a widget's on-screen layout. So these tests do not
 * claim to know the real shape. What they lock in is that the mapper handles
 * every spelling it says it handles, and — more importantly — that it fails
 * *closed*: an unrecognised payload returns null so the crawl takes over,
 * rather than returning a half-empty object that would overwrite good times
 * with blanks.
 *
 * When the first real run logs a raw response, add it here verbatim as a case.
 */
let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

// ── time normalisation ───────────────────────────────────────────────────
check("24h with seconds", normaliseAdDinTime("17:45:00"), "17:45");
check("24h without seconds", normaliseAdDinTime("05:30"), "05:30");
check("single-digit hour is padded", normaliseAdDinTime("5:30"), "05:30");
check("12h PM converts", normaliseAdDinTime("5:45 PM"), "17:45");
check("12h AM converts", normaliseAdDinTime("5:45 AM"), "05:45");
check("noon stays noon", normaliseAdDinTime("12:30 PM"), "12:30");
check("midnight wraps to zero", normaliseAdDinTime("12:15 AM"), "00:15");
check("hour out of range is rejected", normaliseAdDinTime("25:00"), null);
check("prose is rejected", normaliseAdDinTime("see website"), null);
check("a number is rejected", normaliseAdDinTime(1745), null);
check("null is rejected", normaliseAdDinTime(null), null);

// ── payload shapes ───────────────────────────────────────────────────────
const flat = {
  fajrIqamah: "05:30:00",
  dhuhrIqamah: "13:45:00",
  asrIqamah: "19:00:00",
  maghribIqamah: "20:27:00",
  ishaIqamah: "22:00:00",
};
check("flat *Iqamah keys", mapAdDinResponse(flat)?.iqamah, {
  fajr: "05:30", dhuhr: "13:45", asr: "19:00", maghrib: "20:27", isha: "22:00",
});

check("wrapped in data", mapAdDinResponse({ data: flat })?.iqamah, {
  fajr: "05:30", dhuhr: "13:45", asr: "19:00", maghrib: "20:27", isha: "22:00",
});

check(
  "zuhr spelling is found for dhuhr",
  mapAdDinResponse({ fajrIqama: "05:30", zuhrIqama: "13:45", asrIqama: "19:00" })?.iqamah.dhuhr,
  "13:45",
);

check(
  "nested per-prayer objects",
  mapAdDinResponse({ fajr: { adhan: "04:45", iqamah: "05:30" } })?.iqamah.fajr,
  "05:30",
);

check(
  "adhan is not mistaken for iqamah in a nested object",
  mapAdDinResponse({ fajr: { adhan: "04:45" } }),
  null,
);

// ── failing closed ───────────────────────────────────────────────────────
check("empty object returns null", mapAdDinResponse({}), null);
check("null returns null", mapAdDinResponse(null), null);
check("a string returns null", mapAdDinResponse("nope"), null);
check("unknown keys return null", mapAdDinResponse({ salatOne: "05:30" }), null);
check(
  "a partial read still returns what it has, nulls for the rest",
  mapAdDinResponse({ fajrIqamah: "05:30", ishaIqamah: "22:00" })?.iqamah,
  { fajr: "05:30", dhuhr: null, asr: null, maghrib: null, isha: "22:00" },
);
check(
  "jumuah is left empty so existing sittings survive",
  mapAdDinResponse(flat)?.jumuah,
  [],
);

console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
