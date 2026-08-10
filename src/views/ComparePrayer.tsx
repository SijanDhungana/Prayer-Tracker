import { useMemo, useState } from "react";
import { adhanTimes, iqamahTime } from "../lib/prayer";
import { masjidPath } from "../lib/route";
import { formatTime, zonedTimeOnDate } from "../lib/time";
import { PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";
import PrayerPicker from "../components/PrayerPicker";

type Row = {
  masjid: Masjid;
  adhan: Date;
  iqamah: Date | null;
};

type SortOrder = "earliest" | "latest";

export default function ComparePrayer({
  masjids,
  date,
  prayer,
}: {
  masjids: Masjid[];
  date: Date;
  prayer: Prayer;
}) {
  const [order, setOrder] = useState<SortOrder>("earliest");
  const [after, setAfter] = useState("");

  const rows = useMemo<Row[]>(
    () =>
      masjids.map((masjid) => {
        const adhan = adhanTimes(masjid, date)[prayer];
        return {
          masjid,
          adhan,
          iqamah: iqamahTime(masjid.iqamah[prayer], adhan, date),
        };
      }),
    [masjids, date, prayer],
  );

  const cutoff = after ? zonedTimeOnDate(date, after) : null;

  const visible = useMemo(() => {
    // A masjid with no time for this prayer can't satisfy an "after" filter,
    // so it drops out entirely once one is set; otherwise it sorts last.
    const kept = cutoff
      ? rows.filter((r) => r.iqamah != null && r.iqamah.getTime() >= cutoff.getTime())
      : rows;

    return [...kept].sort((a, b) => {
      if (!a.iqamah || !b.iqamah) return a.iqamah ? -1 : b.iqamah ? 1 : 0;
      const diff = a.iqamah.getTime() - b.iqamah.getTime();
      return order === "earliest" ? diff : -diff;
    });
  }, [rows, cutoff, order]);

  const label = PRAYER_LABELS[prayer];
  const article = /^[AEIOU]/.test(label) ? "an" : "a";

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

        {after && (
          <button
            type="button"
            onClick={() => setAfter("")}
            className="text-sm font-medium text-emerald-700 underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-stone-500">
        Showing {visible.length} of {rows.length} masjids
      </p>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
          No masjid has {article} {label} iqamah at or after{" "}
          {cutoff ? formatTime(cutoff) : after}. Try an earlier time.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {visible.map(({ masjid, adhan, iqamah }) => (
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
                    Adhan {formatTime(adhan)}
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
