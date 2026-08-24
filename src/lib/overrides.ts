import { useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authConfigured } from "./supabase";
import { TZ } from "./time";
import { PRAYERS, type IqamahRule, type Masjid, type Prayer } from "./types";

export interface ApprovedTime {
  masjid_id: string;
  slot: string;
  /** Exactly one of these is set. */
  suggested_time: string | null;
  offset_minutes: number | null;
  /** When an admin approved it. Absent on rows written before this was read. */
  reviewed_at?: string | null;
}

const isPrayer = (slot: string): slot is Prayer =>
  (PRAYERS as readonly string[]).includes(slot);

/**
 * The calendar date, in Toronto, that an ISO timestamp falls on.
 *
 * `reviewed_at` is a timestamptz and `lastVerified` is a bare date, so they
 * can only be compared once both are on the same clock. Returns null for
 * anything unparseable, which the caller treats as "no date" rather than as
 * a very old one.
 */
function reviewedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Whether an approved correction still speaks for a masjid.
 *
 * A correction is someone confirming a time against the masjid, so it beats
 * the scraper — but only until the underlying record is confirmed again. It
 * used to win permanently, which quietly broke the app: a correction approved
 * on the 14th kept overriding data re-verified on the 24th, so ten days of
 * imports were invisible on the live site while the adhan times beside them
 * updated normally. Every fresh import made that worse rather than better,
 * and nothing in the UI could show it, because the app had no idea it was
 * displaying anything other than the file it shipped with.
 *
 * ISO dates are compared as strings on purpose: both sides are
 * `YYYY-MM-DD` on Toronto's clock, where lexical order is chronological.
 * Ties go to the correction, since a human checking a masjid on the same day
 * a sheet was compiled is the more specific of the two.
 */
function stillApplies(row: ApprovedTime, masjid: Masjid): boolean {
  const verified = masjid.lastVerified;
  if (!verified) return true;

  const reviewed = reviewedOn(row.reviewed_at);
  // A row with no usable timestamp keeps the old behaviour rather than being
  // silently dropped — losing a real correction is the worse failure.
  if (!reviewed) return true;

  return reviewed >= verified;
}

/**
 * Lay approved corrections over the scraped baseline.
 *
 * masjids.json is what the scraper believes; an approved correction is what a
 * person confirmed against the masjid. The correction wins while it is the
 * more recent of the two — see `stillApplies`.
 */
export function applyOverrides(
  masjids: Masjid[],
  approved: ApprovedTime[],
): Masjid[] {
  if (approved.length === 0) return masjids;

  const byMasjid = new Map<string, ApprovedTime[]>();
  for (const row of approved) {
    const list = byMasjid.get(row.masjid_id) ?? [];
    list.push(row);
    byMasjid.set(row.masjid_id, list);
  }

  return masjids.map((masjid) => {
    const rows = byMasjid.get(masjid.id);
    if (!rows) return masjid;

    const iqamah = { ...masjid.iqamah };
    let jumuah = masjid.jumuah;

    for (const row of rows) {
      if (!stillApplies(row, masjid)) continue;

      // An offset tracks that day's adhan; a clock time is absolute.
      const rule: IqamahRule | null =
        row.offset_minutes != null
          ? { type: "offset", minutes: row.offset_minutes }
          : row.suggested_time != null
            ? { type: "fixed", time: row.suggested_time }
            : null;
      if (!rule) continue;

      if (row.slot === "jumuah") {
        // Friday khutbah is announced as a clock time, never as an offset.
        if (rule.type === "fixed") jumuah = [{ khutbah: rule.time }];
      } else if (isPrayer(row.slot)) {
        iqamah[row.slot] = rule;
      }
    }

    return { ...masjid, iqamah, jumuah };
  });
}

/**
 * Approved corrections for everyone, guests included. Starts empty so the page
 * renders from the static data immediately; the merge happens when this lands.
 */
export function useApprovedTimes(): {
  approved: ApprovedTime[];
  refresh: () => void;
} {
  const [approved, setApproved] = useState<ApprovedTime[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!authConfigured) return;
    const controller = new AbortController();

    // A plain request rather than the SDK: this runs on every page load for
    // every visitor, and pulling in the client library just to read a public
    // view would put ~60 kB in front of the prayer times.
    fetch(
      // reviewed_at is required, not decorative: without it a correction has
      // no date to be weighed against the baseline's lastVerified and would
      // override re-verified data forever.
      `${SUPABASE_URL}/rest/v1/approved_times?select=masjid_id,slot,suggested_time,offset_minutes,reviewed_at`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: controller.signal,
      },
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ApprovedTime[]) => setApproved(rows ?? []))
      // Corrections are an enhancement; the static times stand without them.
      .catch(() => {});

    return () => controller.abort();
  }, [nonce]);

  return { approved, refresh: () => setNonce((n) => n + 1) };
}
