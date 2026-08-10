import { useMemo, useState } from "react";
import { adhanTimes, iqamahTime } from "../lib/prayer";
import { masjidPath } from "../lib/route";
import { formatTime, zonedTimeOnDate } from "../lib/time";
import { formatDistance, haversineKm, type Point } from "../lib/distance";
import { PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";
import PrayerPicker from "../components/PrayerPicker";

type Row = {
  masjid: Masjid;
  adhan: Date;
  iqamah: Date | null;
  km: number;
};

type SortOrder = "earliest" | "latest";

const RADII = [2, 5, 10, 25];

export default function ComparePrayer({
  masjids,
  date,
  prayer,
  from,
}: {
  masjids: Masjid[];
  date: Date;
  prayer: Prayer;
  from: Point;
}) {
  const [order, setOrder] = useState<SortOrder>("earliest");
  const [after, setAfter] = useState("");
  const [withinKm, setWithinKm] = useState<number | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      masjids.map((masjid) => {
        const adhan = adhanTimes(masjid, date)[prayer];
        return {
          masjid,
          adhan,
          iqamah: iqamahTime(masjid.iqamah[prayer], adhan, date),
          km: haversineKm(from, masjid),
        };
      }),
    [masjids, date, prayer, from],
  );

  const cutoff = after ? zonedTimeOnDate(date, after) : null;

  const visible = useMemo(() => {
    const kept = rows.filter((row) => {
      if (withinKm != null && row.km > withinKm) return false;
      // A masjid with no time for this prayer can't satisfy an "after" filter,
      // so it drops out once one is set; otherwise it sorts last.
      if (!cutoff) return true;
      return row.iqamah != null && row.iqamah.getTime() >= cutoff.getTime();
    });

    return kept.sort((a, b) => {
      if (!a.iqamah || !b.iqamah) return a.iqamah ? -1 : b.iqamah ? 1 : 0;
      const diff = a.iqamah.getTime() - b.iqamah.getTime();
      return order === "earliest" ? diff : -diff;
    });
  }, [rows, cutoff, withinKm, order]);

  const label = PRAYER_LABELS[prayer];
  const article = /^[AEIOU]/.test(label) ? "an" : "a";

  const constraints = [
    cutoff ? `at or after ${formatTime(cutoff)}` : null,
    withinKm != null ? `within ${withinKm} km` : null,
  ].filter(Boolean);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Compare a prayer</h1>
      <p className="mt-1 text-sm text-stone-600">
        Every masjid&rsquo;s {label} congregation today.
      </p>

      <div className="mt-4">
        <PrayerPicker selected={prayer} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="button"
          onClick={() =>
            setOrder((o) => (o === "earliest" ? "latest" : "earliest"))
          }
          className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:text-stone-900"
        >
          {order === "earliest" ? "Earliest first ↑" : "Latest first ↓"}
        </button>

        <label className="flex items-center gap-2 text-sm text-stone-600">
          <span>Iqamah after</span>
          <input
            type="time"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="rounded-lg bg-white px-2 py-1.5 text-sm tabular-nums text-stone-900 ring-1 ring-stone-200"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-stone-600">
          <span>Within</span>
          <select
            value={withinKm ?? ""}
            onChange={(e) =>
              setWithinKm(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-lg bg-white px-2 py-1.5 text-sm text-stone-900 ring-1 ring-stone-200"
          >
            <option value="">Any distance</option>
            {RADII.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>

        {(after || withinKm != null) && (
          <button
            type="button"
            onClick={() => {
              setAfter("");
              setWithinKm(null);
            }}
            className="text-sm font-medium text-emerald-700 underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-stone-500">
        Showing {visible.length} of {rows.length} masjids
      </p>

      {visible.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
          No masjid has {article} {label} iqamah {constraints.join(" and ")}.
          Try relaxing a filter.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {visible.map(({ masjid, adhan, iqamah, km }) => (
            <li key={masjid.id}>
              <a
                href={masjidPath(masjid.id)}
                className="flex items-baseline justify-between gap-3 p-4 hover:bg-stone-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-900">
                    {masjid.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {formatDistance(km)} · Adhan {formatTime(adhan)}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-semibold tabular-nums text-stone-900">
                  {iqamah ? formatTime(iqamah) : "—"}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
