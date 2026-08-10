import { useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authConfigured } from "./supabase";
import { PRAYERS, type Masjid, type Prayer } from "./types";

export interface ApprovedTime {
  masjid_id: string;
  slot: string;
  suggested_time: string;
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
      if (row.slot === "jumuah") {
        jumuah = [{ khutbah: row.suggested_time }];
      } else if (isPrayer(row.slot)) {
        iqamah[row.slot] = { type: "fixed", time: row.suggested_time };
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
      `${SUPABASE_URL}/rest/v1/approved_times?select=masjid_id,slot,suggested_time`,
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
