/**
 * apply-correction.ts — apply an approved time correction to masjids.json.
 *
 * Driven by .github/workflows/apply-correction.yml when the repo owner comments
 * "/approve" on a suggestion issue. The issue body is machine-written by the
 * app's suggestion form, so parsing it is reliable — but everything is still
 * validated before it touches the data, because an issue body is text anyone
 * can type.
 *
 * Reads ISSUE_BODY and COMMENT_BODY from the environment (never from argv or a
 * shell interpolation). Writes a one-line verdict to stdout for the workflow to
 * post back, and exits non-zero if the correction was refused.
 */
import { readFile, writeFile } from "node:fs/promises";
import {
  PRAYERS,
  adhanMinutesFor,
  clockMinutes,
  isTime,
  jumuahIsPlausible,
  torontoToday,
  type Masjid,
  type Prayer,
} from "./prayer-invariant";

const DATA_FILE = "./src/data/masjids.json";

interface Correction {
  masjidId: string;
  slot: Prayer | "jumuah";
  time: string;
}

/** Pull the fields the suggestion form writes. */
export function parseIssue(body: string): Correction | null {
  const masjidId = /Masjid id:\s*`([^`]+)`/.exec(body)?.[1]?.trim();
  const prayer = /\*\*Prayer:\*\*\s*(.+)/.exec(body)?.[1]?.trim();
  const time = /\*\*Suggested iqamah:\*\*\s*(\d{1,2}:\d{2})/.exec(body)?.[1]?.trim();
  if (!masjidId || !prayer || !time) return null;

  const normalised = prayer.toLowerCase().replace(/[^a-z]/g, "");
  const slot =
    normalised.startsWith("jum") || normalised.startsWith("friday")
      ? ("jumuah" as const)
      : (PRAYERS.find((p) => p === normalised) ?? null);
  if (!slot) return null;

  return { masjidId, slot, time };
}

/** "/approve" optionally carries a corrected time: "/approve 05:35". */
export function parseCommand(
  comment: string,
): { action: "approve" | "deny"; override?: string } | null {
  const match = /^\s*\/(approve|deny)(?:\s+(\d{1,2}:\d{2}))?\s*$/im.exec(comment);
  if (!match) return null;
  return {
    action: match[1] as "approve" | "deny",
    override: match[2],
  };
}

function pad(time: string) {
  const [h, m] = time.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

const slotLabel = (slot: Prayer | "jumuah") =>
  slot === "jumuah" ? "Jumu'ah" : slot[0].toUpperCase() + slot.slice(1);

async function main() {
  const issueBody = process.env.ISSUE_BODY ?? "";
  const commentBody = process.env.COMMENT_BODY ?? "";

  const command = parseCommand(commentBody);
  if (!command) {
    console.log("No /approve or /deny command found — nothing to do.");
    process.exit(78); // neutral: not a failure, just not for us
  }

  if (command.action === "deny") {
    console.log("Declined. No change made to the prayer times.");
    return;
  }

  const correction = parseIssue(issueBody);
  if (!correction) {
    console.log(
      "Could not read a correction from this issue. Expected the format the app's suggestion form produces (masjid id, prayer, suggested iqamah).",
    );
    process.exit(1);
  }

  const time = pad(command.override ?? correction.time);
  if (!isTime(time)) {
    console.log(`\`${time}\` is not a valid 24-hour time.`);
    process.exit(1);
  }

  const masjids: Masjid[] = JSON.parse(await readFile(DATA_FILE, "utf8"));
  const masjid = masjids.find((m) => m.id === correction.masjidId);
  if (!masjid) {
    console.log(`No masjid with id \`${correction.masjidId}\` in the data.`);
    process.exit(1);
  }

  // Same invariant the scraper enforces — an approval can't bypass it.
  if (correction.slot === "jumuah") {
    if (!jumuahIsPlausible(time)) {
      console.log(
        `Refused: ${time} is outside the 11:00–17:00 window a Jumu'ah khutbah falls in. If that really is the time, edit the issue and re-approve.`,
      );
      process.exit(1);
    }
    masjid.jumuah = [{ khutbah: time }];
  } else {
    const adhan = adhanMinutesFor(masjid);
    if (clockMinutes(time) < adhan[correction.slot]) {
      const h = Math.floor(adhan[correction.slot] / 60);
      const m = adhan[correction.slot] % 60;
      console.log(
        `Refused: ${time} is before ${slotLabel(correction.slot)} begins today (${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}). A congregation is never called before the prayer time starts.`,
      );
      process.exit(1);
    }
    masjid.iqamah = { ...masjid.iqamah, [correction.slot]: { type: "fixed", time } };
  }

  masjid.lastVerified = torontoToday();
  masjid.source = "manual";
  masjid.needsReview = PRAYERS.some((p) => !masjid.iqamah?.[p]);

  await writeFile(DATA_FILE, JSON.stringify(masjids, null, 2) + "\n");

  const label = slotLabel(correction.slot);
  const note = command.override ? ` (approved as ${time}, not the suggested ${correction.time})` : "";
  console.log(
    `Applied: **${masjid.name}** — ${label} iqamah set to **${time}**${note}. Marked verified today.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
