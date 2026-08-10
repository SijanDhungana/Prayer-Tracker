import { useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authConfigured } from "./supabase";
import { PRAYERS, type IqamahRule, type Masjid, type Prayer } from "./types";

export interface ApprovedTime {
  masjid_id: string;
  slot: string;
  /** Exactly one of these is set. */
  suggested_time: string | null;
  offset_minutes: number | null;
}

const isPrayer = (slot: string): slot is Prayer =>
  (PRAYERS as readonly string[]).includes(slot);

/**
 * Lay approved corrections over the scraped baseline.
 *
 * masjids.json is what the scraper believes; an approved correction is what a
 * person confirmed against the masjid. The correction wins, and it takes effect
 * the moment an admin approves it — no commit, no redeploy.
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
      `${SUPABASE_URL}/rest/v1/approved_times?select=masjid_id,slot,suggested_time,offset_minutes`,
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
