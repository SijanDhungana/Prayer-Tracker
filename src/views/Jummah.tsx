import { useMemo, useState } from "react";
import { masjidPath } from "../lib/route";
import { clockMinutes, formatClock } from "../lib/time";
import { formatDistance, haversineKm, type Point } from "../lib/distance";
import type { Masjid } from "../lib/types";

/**
 * One row per *sitting*, not per masjid — CLAUDE.md §8c.
 *
 * A masjid running three khutbahs is three different answers to "which one can
 * I make", and collapsing them into a row would bury the late one that is
 * usually the reason someone is looking.
 */
type Row = {
  masjid: Masjid;
  khutbah: string;
  minutes: number;
  /** 1-based position among that masjid's sittings, for "2nd of 3". */
  index: number;
  total: number;
  km: number;
};

type SortOrder = "earliest" | "latest";

const RADII = [2, 5, 10, 25];

export default function Jummah({
  masjids,
  from,
}: {
  masjids: Masjid[];
  from: Point;
}) {
  const [order, setOrder] = useState<SortOrder>("earliest");
  const [after, setAfter] = useState("");
  const [withinKm, setWithinKm] = useState<number | null>(null);

  const { rows, silent } = useMemo(() => {
    const rows: Row[] = [];
    // Masjids we hold no Friday times for. Counted rather than hidden — a
    // visitor should know the list is partial, not assume these masjids have
    // no Jumu'ah.
    const silent: Masjid[] = [];

    for (const masjid of masjids) {
      const sessions = masjid.jumuah ?? [];
      if (sessions.length === 0) {
        silent.push(masjid);
        continue;
      }

      const km = haversineKm(from, masjid);
      sessions.forEach((session, i) => {
        const minutes = clockMinutes(session.khutbah);
        // A malformed stored time can't be sorted or filtered, and guessing at
        // one is how someone ends up at a masjid an hour late.
        if (minutes == null) return;
        rows.push({
          masjid,
          khutbah: session.khutbah,
          minutes,
          index: i + 1,
          total: sessions.length,
          km,
        });
      });
    }

    return { rows, silent };
  }, [masjids, from]);

  const cutoff = after ? clockMinutes(after) : null;

  const visible = useMemo(() => {
    const kept = rows.filter((row) => {
      if (withinKm != null && row.km > withinKm) return false;
      if (cutoff != null && row.minutes < cutoff) return false;
      return true;
    });

    return kept.sort((a, b) => {
      const diff = a.minutes - b.minutes;
      if (diff !== 0) return order === "earliest" ? diff : -diff;
      // Same time at two masjids: the nearer one is the more useful answer.
      return a.km - b.km;
    });
  }, [rows, cutoff, withinKm, order]);

  const masjidsShown = new Set(visible.map((row) => row.masjid.id)).size;

  const constraints = [
    cutoff != null ? `at or after ${formatClock(after)}` : null,
    withinKm != null ? `within ${withinKm} km` : null,
  ].filter(Boolean);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Jumu&rsquo;ah</h1>
      <p className="mt-1 text-sm text-stone-600">
        Every Friday khutbah we have on file. Masjids with several sittings are
        listed once for each.
      </p>

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
          <span>Khutbah after</span>
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
        {visible.length} sitting{visible.length === 1 ? "" : "s"} across{" "}
        {masjidsShown} masjid{masjidsShown === 1 ? "" : "s"}
      </p>

      {visible.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
          No Jumu&rsquo;ah {constraints.join(" and ")}. Try relaxing a filter.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {visible.map((row) => (
            <li key={`${row.masjid.id}-${row.index}`}>
              <a
                href={masjidPath(row.masjid.id)}
                className="flex items-baseline justify-between gap-3 p-4 hover:bg-stone-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-900">
                    {row.masjid.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {formatDistance(row.km)}
                    {row.total > 1 && ` · ${row.index} of ${row.total} sittings`}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-semibold tabular-nums text-stone-900">
                  {formatClock(row.khutbah)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {silent.length > 0 && (
        <p className="mt-3 text-xs text-stone-500">
          {silent.length} masjid{silent.length === 1 ? "" : "s"} not listed —
          we don&rsquo;t have their Friday times yet. They almost certainly hold
          Jumu&rsquo;ah; check their own site.
        </p>
      )}

      <p className="mt-4 text-xs text-stone-500">
        Times are when the khutbah begins, collected from each masjid&rsquo;s
        own site. Confirm with the masjid before relying on them.
      </p>
    </section>
  );
}
