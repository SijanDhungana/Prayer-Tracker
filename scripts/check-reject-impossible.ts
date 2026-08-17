import { rejectImpossible } from "../scrape.ts";
import { adhanMinutesFor } from "./prayer-invariant";
import type { Masjid } from "./prayer-invariant";

/**
 * rejectImpossible drops a scraped time that comes before its own adhan — the
 * one check standing between a misread page and a wrong iqamah going live.
 * These tests pin its tolerance: a couple of minutes of rounding slack
 * (added after two masjids were wrongly flagged one minute early — see the
 * comment in scrape.ts) must not turn into a loophole a genuinely wrong read
 * can slip through.
 */
const masjid = (madhab: "hanafi" | "shafi"): Masjid =>
  ({
    id: "t", name: "T", address: "", lat: 43.65, lng: -79.38, website: "",
    calc: { method: "NorthAmerica", madhab },
    iqamah: {}, jumuah: [], lastVerified: null,
  }) as Masjid;

const toHHmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

const m = masjid("hanafi");
const adhan = adhanMinutesFor(m);

{
  const iqamah = { fajr: toHHmm(adhan.fajr + 20), dhuhr: null, asr: null, maghrib: null, isha: null };
  check("well after adhan is accepted", rejectImpossible(m, iqamah), []);
  check("...and survives in the object", iqamah.fajr, toHHmm(adhan.fajr + 20));
}

{
  const iqamah = { fajr: toHHmm(adhan.fajr - 1), dhuhr: null, asr: null, maghrib: null, isha: null };
  check("one minute early is inside tolerance", rejectImpossible(m, iqamah), []);
  check("...value is kept, not nulled", iqamah.fajr, toHHmm(adhan.fajr - 1));
}

{
  const iqamah = { fajr: toHHmm(adhan.fajr - 3), dhuhr: null, asr: null, maghrib: null, isha: null };
  check("exactly at the tolerance boundary is accepted", rejectImpossible(m, iqamah), []);
}

{
  const iqamah = { fajr: toHHmm(adhan.fajr - 4), dhuhr: null, asr: null, maghrib: null, isha: null };
  const rejected = rejectImpossible(m, iqamah);
  check("one minute past the boundary is rejected", rejected.length, 1);
  check("...and the value is nulled, not left wrong", iqamah.fajr, null);
}

{
  // The failure this whole function exists for: a time lifted from the wrong
  // column or yesterday's row, hours off rather than a rounding difference.
  const iqamah = { fajr: null, dhuhr: null, asr: toHHmm(adhan.asr - 45), maghrib: null, isha: null };
  const rejected = rejectImpossible(m, iqamah);
  check("a genuinely wrong read is still caught", rejected.length, 1);
  check("...value is dropped", iqamah.asr, null);
}

{
  // The bug this app has actually hit: Hanafi Asr rejects a time that is
  // exactly right for a masjid whose real practice is Shafi. Fixing the
  // masjid's madhab, not the tolerance, is what resolves this case.
  const hanafiRead = toHHmm(adhan.asr - 40);
  const rejectedHanafi = rejectImpossible(masjid("hanafi"), {
    fajr: null, dhuhr: null, asr: hanafiRead, maghrib: null, isha: null,
  });
  check("a Shafi masjid's Asr is rejected under a Hanafi config", rejectedHanafi.length, 1);

  const shafiAdhan = adhanMinutesFor(masjid("shafi"));
  const shafiRead = toHHmm(shafiAdhan.asr + 15);
  const rejectedShafi = rejectImpossible(masjid("shafi"), {
    fajr: null, dhuhr: null, asr: shafiRead, maghrib: null, isha: null,
  });
  check("the same masjid's real Asr passes once madhab is corrected", rejectedShafi, []);
}

{
  const iqamah = { fajr: toHHmm(adhan.fajr + 5), dhuhr: null, asr: toHHmm(adhan.asr - 60), maghrib: null, isha: toHHmm(adhan.isha + 5) };
  const rejected = rejectImpossible(m, iqamah);
  check("a mixed read drops only the bad prayer", rejected, ["asr " + toHHmm(adhan.asr - 60) + " < adhan"]);
  check("...good prayers on the same read survive", [iqamah.fajr, iqamah.asr, iqamah.isha], [toHHmm(adhan.fajr + 5), null, toHHmm(adhan.isha + 5)]);
}

console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
