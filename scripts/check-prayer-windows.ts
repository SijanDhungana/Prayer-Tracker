import { pickAnswer, type AnswerCandidate } from "../src/lib/nextUp";
import { adhanTimes, cityReference, iqamahTimes, sunriseTime } from "../src/lib/prayer";
import { applyAsrPreference } from "../src/lib/asr";
import { zonedTimeOnDate } from "../src/lib/time";
import { asrSchoolMismatch } from "../src/lib/trust";
import type { IqamahRule, Masjid, Prayer } from "../src/lib/types";

/**
 * Two guards added after the September 2026 scrape stall, when Home's answer
 * card led with a record read on 15 August: its Asr of 7:15 PM sat after
 * sunset, and its Fajr of 5:50 three minutes before its own adhan.
 *
 * 1. A congregation cannot begin once its prayer's time is over (prayer.ts).
 * 2. The answer card ranks by trust before it ranks by time (nextUp.ts).
 *
 * Plus the city clock that replaced "whichever masjid is first in the file"
 * as the source of the strip's and the card's adhan.
 */
let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

const day = new Date(2026, 8, 29);
const hhmm = (at: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
const plus = (at: Date, minutes: number) => new Date(at.getTime() + minutes * 60_000);
const fixed = (at: Date): IqamahRule => ({ type: "fixed", time: hhmm(at) });

// Where the record that prompted this sat: Scarborough, NorthAmerica, Hanafi.
const place = {
  lat: 43.77436,
  lng: -79.18427,
  calc: { method: "NorthAmerica", madhab: "hanafi" as const },
};
const masjid = (iqamah: Partial<Record<Prayer, IqamahRule>>): Masjid => ({
  id: "t", name: "T", address: "", website: "", ...place,
  iqamah, jumuah: [], lastVerified: "2026-09-29",
});

const adhan = adhanTimes(place, day);
const sunrise = sunriseTime(place, day);
const resolve = (prayer: Prayer, rule: IqamahRule) =>
  iqamahTimes(masjid({ [prayer]: rule }), day)[prayer];

// --- A congregation inside its prayer's time --------------------------------

check("Fajr a minute before sunrise is kept",
  resolve("fajr", fixed(plus(sunrise, -1)))?.getTime(), plus(sunrise, -1).getTime());
check("Fajr at sunrise is dropped", resolve("fajr", fixed(sunrise)), null);
check("Dhuhr at the Asr adhan is dropped", resolve("dhuhr", fixed(adhan.asr)), null);
check("Asr twenty minutes before sunset is kept",
  resolve("asr", fixed(plus(adhan.maghrib, -20)))?.getTime(), plus(adhan.maghrib, -20).getTime());
check("Asr fourteen minutes after sunset is dropped (the 7:15 PM record)",
  resolve("asr", fixed(plus(adhan.maghrib, 14))), null);
check("Maghrib five minutes after sunset is kept",
  resolve("maghrib", { type: "offset", minutes: 5 })?.getTime(), plus(adhan.maghrib, 5).getTime());
check("a fixed Maghrib after the Isha adhan is dropped",
  resolve("maghrib", fixed(plus(adhan.isha, 5))), null);
check("a late Isha is kept — Isha runs on to Fajr",
  resolve("isha", { type: "fixed", time: "22:25" })?.getTime(), zonedTimeOnDate(day, "22:25")?.getTime());

// The existing rounding slack at the other end is unchanged.
check("Fajr three minutes before its adhan is still rounding",
  resolve("fajr", fixed(plus(adhan.fajr, -3)))?.getTime(), plus(adhan.fajr, -3).getTime());
check("Fajr four minutes before its adhan is still refused",
  resolve("fajr", fixed(plus(adhan.fajr, -4))), null);

{
  // The whole August record at once: only the impossible prayer goes.
  const times = iqamahTimes(masjid({
    fajr: { type: "fixed", time: "05:50" },
    dhuhr: { type: "fixed", time: "13:45" },
    asr: { type: "fixed", time: "19:15" },
    maghrib: { type: "offset", minutes: 5 },
    isha: { type: "fixed", time: "22:25" },
  }), day);
  check("the 15 August record loses its Asr and keeps the rest",
    Object.fromEntries(Object.entries(times).map(([p, t]) => [p, t ? hhmm(t) : null])),
    { fajr: "05:50", dhuhr: "13:45", asr: null, maghrib: hhmm(plus(adhan.maghrib, 5)), isha: "22:25" });
}

// --- A visitor's Asr choice moves the adhan, never a masjid's times ---------
// A Hanafi preference recalculated a standard masjid's Asr adhan most of an
// hour later, and the before-adhan check then dropped its real congregation:
// 11 of 58 standard masjids lost their Asr in September 2026.

{
  const standardAdhan = adhanTimes({ ...place, calc: { ...place.calc, madhab: "shafi" } }, day);
  const standardMasjid: Masjid = {
    ...masjid({
      fajr: fixed(plus(adhan.fajr, 20)),
      dhuhr: fixed(plus(adhan.dhuhr, 30)),
      asr: fixed(plus(standardAdhan.asr, 20)),
      maghrib: { type: "offset", minutes: 5 },
      isha: fixed(plus(adhan.isha, 30)),
    }),
    calc: { ...place.calc, madhab: "shafi" },
  };
  const hanafiMasjid = masjid({
    dhuhr: fixed(plus(adhan.dhuhr, 30)),
    asr: fixed(plus(adhan.asr, 15)),
  });
  const times = (m: Masjid) => Object.values(iqamahTimes(m, day)).map((t) => t?.getTime() ?? null);

  for (const preference of ["masjid", "hanafi", "standard"] as const) {
    check(`"${preference}" leaves a standard masjid's times alone`,
      times(applyAsrPreference([standardMasjid], preference)[0]), times(standardMasjid));
    check(`"${preference}" leaves a Hanafi masjid's times alone`,
      times(applyAsrPreference([hanafiMasjid], preference)[0]), times(hanafiMasjid));
  }

  const seenByHanafi = applyAsrPreference([standardMasjid], "hanafi")[0];
  check("a standard masjid's Asr survives a Hanafi preference",
    iqamahTimes(seenByHanafi, day).asr?.getTime(), plus(standardAdhan.asr, 20).getTime());
  check("...and is flagged as the other school, as §10.1 intends",
    asrSchoolMismatch(seenByHanafi, "asr", day), true);
  check("...while the adhan shown moves to the visitor's school",
    adhanTimes(seenByHanafi, day).asr.getTime(), adhan.asr.getTime());
}

// --- The city clock ----------------------------------------------------------

{
  const hanafi = adhanTimes(cityReference("hanafi"), day);
  const standard = adhanTimes(cityReference("shafi"), day);
  check("the school moves only Asr",
    [hanafi.fajr, hanafi.dhuhr, hanafi.maghrib, hanafi.isha].map((t) => t.getTime()),
    [standard.fajr, standard.dhuhr, standard.maghrib, standard.isha].map((t) => t.getTime()));
  check("Hanafi Asr is the later one, by most of an hour",
    (hanafi.asr.getTime() - standard.asr.getTime()) / 60_000 > 30, true);
}

// --- The answer card ---------------------------------------------------------

const at = (hm: string) => zonedTimeOnDate(day, hm)!;
const now = at("04:00");
const candidate = (
  id: string,
  iqamah: string,
  { lastVerified = "2026-09-29", needsReview = false, adhanAt = "05:53", km = 5, otherSchool = false } = {},
): AnswerCandidate => ({
  masjid: {
    ...masjid({ fajr: { type: "fixed", time: iqamah } }),
    id, name: id, lastVerified, needsReview,
  },
  iqamah: at(iqamah),
  adhan: at(adhanAt),
  km,
  minutesAway: (at(iqamah).getTime() - now.getTime()) / 60_000,
  otherSchool,
});
const pick = (rows: AnswerCandidate[], withinKm: number | null = 25) =>
  pickAnswer(rows, day, withinKm)?.masjid.id ?? null;

check("a recent record beats an older one that is sooner",
  pick([candidate("old", "05:55", { lastVerified: "2026-09-07" }), candidate("recent", "06:15")]), "recent");
check("a record flagged for review counts as older",
  pick([candidate("flagged", "05:55", { needsReview: true }), candidate("clean", "06:15")]), "clean");
check("among older records, one that starts after its adhan beats one before it",
  pick([
    candidate("drifted", "05:50", { lastVerified: "2026-08-15" }),
    candidate("plausible", "05:55", { lastVerified: "2026-09-07" }),
  ]), "plausible");
check("the other Asr school still ranks last",
  pick([candidate("other", "05:55", { otherSchool: true }), candidate("older", "06:30", { lastVerified: "2026-08-15" })]), "older");
check("within a tier, the soonest wins",
  pick([candidate("later", "06:30"), candidate("sooner", "06:00")]), "sooner");
check("nothing is dropped: all drifted still answers with the soonest",
  pick([
    candidate("a", "05:52", { lastVerified: "2026-08-15" }),
    candidate("b", "05:50", { lastVerified: "2026-08-15" }),
  ]), "b");
check("outside the radius does not count",
  pick([candidate("far", "06:00", { km: 40 })]), null);
check("...unless the radius is off",
  pick([candidate("far", "06:00", { km: 40 })], null), "far");
check("a congregation already begun does not count",
  pick([{ ...candidate("begun", "06:00"), minutesAway: -5 }]), null);

console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
