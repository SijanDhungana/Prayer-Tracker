import { useEffect, useMemo, useState } from "react";
import { formatDistance, type Point } from "../lib/distance";
import {
  formatCountdown,
  formatSince,
  groupRows,
  nextCongregation,
  nextUpRows,
  type NextUpRow,
} from "../lib/nextUp";
import { prayerLabel } from "../lib/planPrayer";
import { DEFAULT_MAGHRIB_OFFSET_MINUTES } from "../lib/prayer";
import { comparePath, jummahPath, listPath, masjidPath } from "../lib/route";
import { formatTime } from "../lib/time";
import { isStale } from "../lib/trust";
import type { Masjid } from "../lib/types";

/**
 * How often the countdowns re-render. "In 12 min" going stale is the whole
 * failure mode of this screen, and half a minute is fine for a number shown
 * to the minute.
 */
const TICK_MS = 30_000;

/**
 * Radii offered, and the one used by default.
 *
 * A radius is not optional polish here. At Maghrib almost every masjid's
 * iqamah is a few minutes after the same adhan, so a pure soonest-first sort
 * puts a masjid 54 km away above one 300 m away — technically sooner, and
 * useless. The spec's own acceptance test asks which *nearby* masjids are
 * still catchable, so distance has to bound the list before time orders it.
 * Whatever falls outside is counted, never silently dropped.
 */
const RADII = [2, 5, 10, 25];
const DEFAULT_RADIUS_KM = 10;

function useNow(intervalMs = TICK_MS): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

export default function NextUp({
  masjids,
  date,
  from,
}: {
  masjids: Masjid[];
  date: Date;
  from: Point;
}) {
  const now = useNow();
  const [withinKm, setWithinKm] = useState<number | null>(DEFAULT_RADIUS_KM);

  const congregation = useMemo(
    () => nextCongregation(masjids, date, now),
    [masjids, date, now],
  );

  const all = useMemo(
    () => nextUpRows(masjids, congregation, from, now),
    [masjids, congregation, from, now],
  );

  const near = useMemo(
    () => (withinKm == null ? all : all.filter((row) => row.km <= withinKm)),
    [all, withinKm],
  );

  const groups = useMemo(() => groupRows(near), [near]);
  const beyond = all.length - near.length;

  const label = prayerLabel(congregation.prayer);

  // Adhan is near enough identical across the city (CLAUDE.md §2), so the
  // nearest masjid's is the honest one to put in the header. Taken from the
  // unfiltered set so tightening the radius never blanks the header.
  const nearest = useMemo(
    () => [...all].sort((a, b) => a.km - b.km)[0],
    [all],
  );

  return (
    <section>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {congregation.isTomorrow ? `Tomorrow — ${label}` : label}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {congregation.isTomorrow
            ? "Today’s congregations are done."
            : "Congregations you can still make, soonest first."}
          {nearest && (
            <>
              {" "}
              Adhan{" "}
              <span className="tabular-nums">{formatTime(nearest.adhan)}</span>.
            </>
          )}
        </p>
        {congregation.prayer === "jumuah" && (
          <p className="mt-1 text-xs text-stone-500">
            It&rsquo;s Friday — showing Jumu&rsquo;ah rather than Dhuhr.
          </p>
        )}
      </header>

      <label className="mt-4 flex items-center gap-2 text-sm text-stone-600">
        <span>Within</span>
        <select
          value={withinKm ?? ""}
          onChange={(e) =>
            setWithinKm(e.target.value ? Number(e.target.value) : null)
          }
          className="rounded-lg bg-white px-2 py-1.5 text-sm text-stone-900 ring-1 ring-stone-200"
        >
          {RADII.map((km) => (
            <option key={km} value={km}>
              {km} km
            </option>
          ))}
          <option value="">Any distance</option>
        </select>
        {beyond > 0 && (
          <span className="text-xs text-stone-500">{beyond} further out</span>
        )}
      </label>

      {groups.upcoming.length === 0 && groups.justStarted.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
          {beyond > 0
            ? `No masjid within ${withinKm} km still has ${label} ahead of it — try widening the radius.`
            : `No masjid on file still has ${label} ahead of it.`}{" "}
          <a
            className="font-medium text-emerald-700 underline underline-offset-2"
            href={comparePath()}
          >
            Compare another prayer
          </a>
          .
        </p>
      ) : (
        <>
          {groups.justStarted.length > 0 && (
            <Group
              title="Started just now"
              note="You may still catch the jamaah."
              rows={groups.justStarted}
              date={date}
              started
            />
          )}
          {groups.upcoming.length > 0 && (
            <Group
              title={groups.justStarted.length > 0 ? "Still to come" : undefined}
              rows={groups.upcoming}
              date={date}
            />
          )}
        </>
      )}

      <Tail
        missed={groups.missed.length}
        unknown={groups.unknown.length}
        prayer={label}
        isJumuah={congregation.prayer === "jumuah"}
      />

      <p className="mt-4 text-xs text-stone-500">
        Adhan times are calculated. Iqamah times are community-collected —
        confirm with the masjid before relying on them.
      </p>
    </section>
  );
}

function Group({
  title,
  note,
  rows,
  date,
  started = false,
}: {
  title?: string;
  note?: string;
  rows: NextUpRow[];
  date: Date;
  started?: boolean;
}) {
  return (
    <div className="mt-6">
      {title && (
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
      )}
      {note && <p className="text-xs text-stone-500">{note}</p>}
      <ul
        className={
          "divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white " +
          (title ? "mt-2" : "")
        }
      >
        {rows.map((row) => (
          <Row key={row.masjid.id} row={row} date={date} started={started} />
        ))}
      </ul>
    </div>
  );
}

function Row({
  row,
  date,
  started,
}: {
  row: NextUpRow;
  date: Date;
  started: boolean;
}) {
  const { masjid, iqamah, minutesAway, km, sitting, assumed } = row;
  // An assumed time is already caveated by its own label; saying "unconfirmed"
  // on top of it just stacks two hedges on one row.
  const stale = !assumed && isStale(masjid.lastVerified, date);

  return (
    <li>
      <a
        href={masjidPath(masjid.id)}
        className={
          "flex items-center justify-between gap-3 p-4 hover:bg-stone-50 " +
          (started ? "bg-amber-50/40" : "")
        }
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-stone-900">
            {masjid.name}
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            {formatDistance(km)}
            {sitting && ` · ${sitting.index} of ${sitting.total} sittings`}
            {/* CLAUDE.md §14: never show a time without how old it is. */}
            {stale && (
              <span className="text-amber-700"> · unconfirmed</span>
            )}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-lg font-semibold tabular-nums text-stone-900">
            {iqamah ? formatTime(iqamah) : "—"}
          </span>
          {minutesAway != null && (
            <span
              className={
                "block text-xs tabular-nums " +
                (started ? "text-amber-700" : "text-emerald-700")
              }
            >
              {started
                ? formatSince(minutesAway)
                : formatCountdown(minutesAway)}
            </span>
          )}
          {assumed && (
            <span className="block text-[11px] text-stone-400">
              assumed +{DEFAULT_MAGHRIB_OFFSET_MINUTES} min
            </span>
          )}
        </span>
      </a>
    </li>
  );
}

/** The masjids that aren't answers, counted rather than listed. */
function Tail({
  missed,
  unknown,
  prayer,
  isJumuah,
}: {
  missed: number;
  unknown: number;
  prayer: string;
  isJumuah: boolean;
}) {
  if (missed === 0 && unknown === 0) return null;

  return (
    <p className="mt-3 text-xs text-stone-500">
      {missed > 0 && (
        <>
          {missed} masjid{missed === 1 ? "" : "s"} already held {prayer}.
        </>
      )}
      {missed > 0 && unknown > 0 && " "}
      {unknown > 0 && (
        <>
          {unknown} {unknown === 1 ? "has" : "have"} no {prayer} time on file
          {isJumuah && " — they almost certainly hold it"}.{" "}
          <a
            className="font-medium text-emerald-700 underline underline-offset-2"
            href={isJumuah ? jummahPath : listPath}
          >
            {isJumuah ? "See all Friday times" : "See all masjids"}
          </a>
        </>
      )}
    </p>
  );
}
