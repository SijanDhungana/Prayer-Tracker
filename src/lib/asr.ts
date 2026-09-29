import type { Masjid } from "./types";

/**
 * Which school's Asr the visitor follows.
 *
 * Asr is the one prayer whose calculated time depends on the school: Hanafi
 * waits until an object's shadow is twice its length, everyone else until it
 * is once. The gap is roughly an hour, which is far too big to paper over.
 *
 * "masjid" is the default and means "whatever each masjid itself calculates",
 * which is what the directory already records per masjid. It is the safe
 * default precisely because it is the status quo: nobody's times change until
 * they ask for a change. Guessing wrong in either direction is harmful — show
 * a Hanafi visitor the standard time and they may pray before Asr has begun
 * for them; show a Shafi visitor the Hanafi time and they may think Asr has
 * not started when it has.
 */
export type AsrPreference = "masjid" | "hanafi" | "standard";

/**
 * Rewrite each masjid's madhab to the visitor's choice.
 *
 * Applied once, high up, to the same list every view already receives — so a
 * preference reaches every calculation in the app without each call site
 * having to remember to ask for it. A view that forgot would quietly show an
 * Asr an hour out, which is exactly the kind of mistake this app cannot make.
 *
 * Only the *adhan* moves. A masjid's iqamah is a clock time its committee
 * chose, and no visitor preference should rewrite what a masjid published.
 */
export function applyAsrPreference(
  masjids: Masjid[],
  preference: AsrPreference,
): Masjid[] {
  if (preference === "masjid") return masjids;

  const madhab = preference === "hanafi" ? "hanafi" : "shafi";

  return masjids.map((masjid) =>
    masjid.calc.madhab === madhab
      ? masjid
      : {
          ...masjid,
          // The masjid's own school travels with it: its iqamah is still
          // judged by the Asr it actually follows (prayer.ts).
          calc: {
            ...masjid.calc,
            madhab,
            ownMadhab: masjid.calc.ownMadhab ?? masjid.calc.madhab,
          },
        },
  );
}

/**
 * The school the city-wide times run on — the prayer windows, the answer
 * card's adhan and countdown, the map's header.
 *
 * A visitor who chose a school gets it. "Match each masjid" has no single
 * city answer, so these stay on Hanafi, the later of the two, as they always
 * effectively were: nothing tells a Hanafi visitor Asr has begun before it
 * has for them, and the card keeps counting toward Asr congregations for
 * longer. The standard time is not hidden — wherever Asr is shown under this
 * default, the school is named and the strip carries both.
 */
export function cityMadhab(preference: AsrPreference): "hanafi" | "shafi" {
  return preference === "standard" ? "shafi" : "hanafi";
}
