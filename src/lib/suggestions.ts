import { PRAYER_LABELS, type Masjid, type Prayer } from "./types";
import { clockMinutes, formatCalendarDate, formatTime, minutesOfDay } from "./time";

/**
 * Where corrections go.
 *
 * The app is a static bundle with no backend, so a suggestion has to leave the
 * browser for somewhere that persists. GitHub issues cost nothing, need no
 * server, and land the correction beside the data it corrects. Swapping this
 * for a form service or a serverless endpoint means changing `submissionUrl`
 * and nothing else.
 */
const REPO = "SijanDhungana/Prayer-Tracker";

export interface Suggestion {
  masjid: Masjid;
  prayer: Prayer | "jumuah";
  /** 24h "HH:mm" the person is proposing. */
  time: string;
  /** Optional "how do you know" — a sign, a phone call, the masjid's own page. */
  source: string;
  /** The day they were looking at, for context. */
  date: Date;
  /** What the app was showing, so the maintainer can see the delta. */
  currentlyShowing: string | null;
}

const label = (prayer: Prayer | "jumuah") =>
  prayer === "jumuah" ? "Jumu'ah" : PRAYER_LABELS[prayer];

export function issueTitle(s: Suggestion): string {
  return `${s.masjid.name} — ${label(s.prayer)} iqamah should be ${s.time}`;
}

export function issueBody(s: Suggestion): string {
  return [
    `**Masjid:** ${s.masjid.name}`,
    `**Prayer:** ${label(s.prayer)}`,
    `**Suggested iqamah:** ${s.time}`,
    `**Currently showing:** ${s.currentlyShowing ?? "nothing"}`,
    "",
    `**Where this came from:** ${s.source.trim() || "_not given_"}`,
    "",
    "---",
    `Submitted from the app on ${formatCalendarDate(s.date)}.`,
    `Masjid id: \`${s.masjid.id}\` · [${s.masjid.website}](${s.masjid.website})`,
  ].join("\n");
}

/** A prefilled "new issue" link — opening it needs a GitHub account. */
export function submissionUrl(s: Suggestion): string {
  const params = new URLSearchParams({
    title: issueTitle(s),
    body: issueBody(s),
    labels: "time-correction",
  });
  return `https://github.com/${REPO}/issues/new?${params}`;
}

/**
 * A congregation is never called before the prayer time begins, so this is the
 * same invariant the scraper enforces — applied here to catch an obvious slip
 * (usually an afternoon time entered as morning) while the person can still fix
 * it. A warning, not a block: they may know something the calculation doesn't.
 */
export function warnIfBeforeAdhan(
  prayer: Prayer | "jumuah",
  time: string,
  adhan: Record<Prayer, Date>,
): string | null {
  const proposed = clockMinutes(time);
  if (proposed == null) return null;

  if (prayer === "jumuah") {
    return proposed < 11 * 60 || proposed > 17 * 60
      ? "Jumu'ah is a midday prayer — did you mean a time between 11:00 and 17:00?"
      : null;
  }

  const adhanTime = adhan[prayer];
  return proposed < minutesOfDay(adhanTime)
    ? `That's before ${label(prayer)} begins (${formatTime(adhanTime)}). Did you mean the afternoon or evening?`
    : null;
}
