import { queriesFor, tidyWebsite } from "./discover.ts";

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
};

// A bracketed second name is how the directory reads, but not how a geocoder
// matches — so the stripped form has to be tried too.
check("bracketed name is also tried stripped",
  queriesFor({ name: "Islamic Society of Ajax (Masjid Quba)", near: "Ajax, Ontario" }),
  [
    "Islamic Society of Ajax (Masjid Quba), Ajax, Ontario",
    "Islamic Society of Ajax, Ajax, Ontario",
    "Islamic Society of Ajax (Masjid Quba), Ontario, Canada",
    "Islamic Society of Ajax, Ontario, Canada",
  ]);

check("a plain name is unchanged",
  queriesFor({ name: "Masjid Al-Aqsaa" }),
  ["Masjid Al-Aqsaa, Ontario, Canada"]);

check("a plain name with a locality",
  queriesFor({ name: "Jamia Masjid Sayyidah Zainab", near: "Ajax, Ontario" }),
  [
    "Jamia Masjid Sayyidah Zainab, Ajax, Ontario",
    "Jamia Masjid Sayyidah Zainab, Ontario, Canada",
  ]);

// A supplied URL is evidence; OSM's blank tag is not.
check("a supplied website survives tidying", tidyWebsite("https://www.ajaxmasjid.ca"), "https://www.ajaxmasjid.ca");
check("a bare domain gains a scheme", tidyWebsite("ajaxmosque.ca"), "https://ajaxmosque.ca");
check("nothing supplied stays empty", tidyWebsite(undefined), "");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
