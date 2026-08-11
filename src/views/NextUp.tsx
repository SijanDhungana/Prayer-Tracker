import { useMemo, useState } from "react";
import DayRing from "../components/DayRing";
import HomeMasjidCard from "../components/HomeMasjidCard";
import Icon from "../components/Icon";
import LocationChip from "../components/LocationChip";
import SegmentedControl from "../components/SegmentedControl";
import TimeRow from "../components/TimeRow";
import { useClock } from "../lib/clock";
import { haversineKm, type Point } from "../lib/distance";
import { useFavourites } from "../lib/favourites";
import { useSettings } from "../lib/settings";
import type { ReferencePoint } from "../lib/location";
import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { prayerPath } from "../lib/route";
import { formatTime } from "../lib/time";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

/**
 * Next up — the home screen, and the app's answer to its dominant question
 * (design spec v2 §8.2).
 *
 * This screen absorbs "Compare a prayer": the prayer selector below the ring
 * re-points both the ring and the list, so "what's next" and "compare Isha
 * across the city" are the same screen rather than two.
 */
const RADII = [5, 10, 25, 50];
/** §10.3: a Toronto app must not silently list a masjid in Windsor. */
const DEFAULT_RADIUS_KM = 25;

type SortOrder = "earliest" | "latest";

export default function NextUp({
  masjids,
  from,
  reference,
  initialPrayer,
}: {
  masjids: Masjid[];
  from: Point;
  reference: ReferencePoint;
  initialPrayer: Prayer | null;
}) {
  const { second, minute, today, windows, position } = useClock();
  const { favourites, isFavourite, toggle } = useFavourites();
  const { homeMasjidId } = useSettings();
  const home = masjids.find((m) => m.id === homeMasjidId) ?? null;

  const reference0 = masjids[0];

  /**
   * The prayer the ring counts down to: the next one whose adhan is still
   * ahead. Not the current *window* — at 5:30 PM you are inside Asr, and
   * counting down to an Asr that began fourteen minutes ago just reads
   * "now". The window still drives the accent colour; this drives the
   * numbers (§9).
   */
  const nextPrayer = useMemo<Prayer>(() => {
    if (!reference0) return "fajr";
    const times = adhanTimes(reference0, today);
    return PRAYERS.find((p) => times[p] > minute) ?? "fajr";
  }, [reference0, today, minute]);


  const [chosen, setChosen] = useState<Prayer | null>(initialPrayer);
  const prayer = chosen ?? nextPrayer;

  const [order, setOrder] = useState<SortOrder>("earliest");
  const [after, setAfter] = useState("");
  const [withinKm, setWithinKm] = useState<number | null>(DEFAULT_RADIUS_KM);

  const adhanForFocus = reference0 ? adhanTimes(reference0, today)[prayer] : null;

  /**
   * The instant the countdown runs to.
   *
   * Normally today's adhan for the focused prayer. But after the last Isha
   * there is nothing left today, and the ring's default focus falls back to
   * Fajr — whose time today is fifteen hours *past* by midnight. Rolling to
   * tomorrow's is what makes the small hours read "in 5 h 12 min" instead of
   * "started".
   *
   * A prayer the visitor picked deliberately is left alone: if they select
   * Dhuhr at 6pm they mean today's Dhuhr, and the ring says it has started
   * rather than silently jumping to tomorrow.
   */
  const countdownTo = useMemo(() => {
    if (!reference0 || !adhanForFocus) return null;
    if (adhanForFocus > minute) return adhanForFocus;
    if (chosen) return null; // deliberate pick of a past prayer
    const tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );
    return adhanTimes(reference0, tomorrow)[prayer];
  }, [reference0, adhanForFocus, minute, chosen, today, prayer]);

  const passed = countdownTo == null;

  // Rows are recomputed on the minute, not the second: distances and iqamah
  // times don't change sixty times a minute, and §12 asks that they not be
  // recomputed on every tick.
  const rows = useMemo(
    () =>
      masjids.map((masjid) => {
        const iqamah = iqamahTimes(masjid, today)[prayer];
        return {
          masjid,
          iqamah,
          adhan: adhanTimes(masjid, today)[prayer],
          km: haversineKm(from, masjid),
          minutesAway:
            iqamah == null ? null : (iqamah.getTime() - minute.getTime()) / 60_000,
        };
      }),
    [masjids, from, today, prayer, minute],
  );

  const cutoff = after ? Number(after.slice(0, 2)) * 60 + Number(after.slice(3)) : null;

  const visible = useMemo(() => {
    const kept = rows.filter((row) => {
      if (withinKm != null && row.km > withinKm) return false;
      if (cutoff != null) {
        if (!row.iqamah) return false;
        const mins = row.iqamah.getHours() * 60 + row.iqamah.getMinutes();
        if (mins < cutoff) return false;
      }
      return true;
    });

    return kept.sort((a, b) => {
      if (!a.iqamah || !b.iqamah) return a.iqamah ? -1 : b.iqamah ? 1 : 0;
      const diff = a.iqamah.getTime() - b.iqamah.getTime();
      return order === "earliest" ? diff : -diff;
    });
  }, [rows, withinKm, cutoff, order]);

  const beyond = rows.length - visible.length;
  const starred = visible.filter((r) => isFavourite(r.masjid.id));
  const rest = visible.filter((r) => !isFavourite(r.masjid.id));

  // The soonest congregation still ahead — the ring's target line (§9).
  const target = useMemo(
    () =>
      [...rows]
        .filter((r) => r.minutesAway != null && r.minutesAway > 0)
        .sort((a, b) => a.minutesAway! - b.minutesAway!)[0] ?? null,
    [rows],
  );

  const countdown = passed ? "started" : countdownText(second, countdownTo);
  const relative = (minutes: number | null) =>
    minutes == null ? undefined : formatRelative(minutes);

  return (
    <section>
      <header className="flex items-center justify-between gap-3">
        <span className="font-display text-name font-semibold">Masjid Times</span>
        <LocationChip reference={reference} />
      </header>

      {home && <HomeMasjidCard masjid={home} />}

      <div className="mt-6">
        <DayRing
          windows={windows}
          position={position}
          countdown={countdown}
          focus={prayer}
          adhan={adhanForFocus}
          onSelectPrayer={setChosen}
        >
          {target ? (
            <a
              href={`#/map/${target.masjid.id}`}
              className="mt-3 inline-block text-meta text-ink-2 underline-offset-2 hover:underline"
            >
              {target.masjid.name}
              <span className="block font-num text-ink-3">
                Iqamah {formatTime(target.iqamah!)}
              </span>
            </a>
          ) : (
            <span className="mt-3 block text-meta text-ink-3">
              No congregation left today for {PRAYER_LABELS[prayer]}
            </span>
          )}
        </DayRing>
      </div>

      {/* The accessible twin: re-rendered on the minute, never aria-live (§9). */}
      <p className="sr-only">
        {countdown} until {PRAYER_LABELS[prayer]}
        {adhanForFocus ? ` at ${formatTime(adhanForFocus)}` : ""}.
        {target
          ? ` Next congregation at ${target.masjid.name}, ${formatTime(target.iqamah!)}.`
          : ""}
      </p>

      <div className="mt-6">
        <SegmentedControl
          label="Prayer"
          scrollable
          accent="now"
          value={prayer}
          onChange={(p) => {
            setChosen(p);
            // Keep the URL shareable — §3's #/?prayer=asr.
            window.history.replaceState(null, "", prayerPath(p));
          }}
          options={PRAYERS.map((p) => ({ value: p, label: PRAYER_LABELS[p] }))}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOrder((o) => (o === "earliest" ? "latest" : "earliest"))}
          className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-meta font-medium text-ink-2 hover:text-ink"
        >
          <Icon name="sliders" size={16} />
          {order === "earliest" ? "Earliest first" : "Latest first"}
        </button>

        <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-surface px-3 text-meta text-ink-2">
          <span>Iqamah after</span>
          <input
            type="time"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="bg-transparent font-num text-ink outline-none"
          />
        </label>

        <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-surface px-3 text-meta text-ink-2">
          <span>Within</span>
          <select
            value={withinKm ?? ""}
            onChange={(e) =>
              setWithinKm(e.target.value ? Number(e.target.value) : null)
            }
            className="bg-transparent text-ink outline-none"
          >
            {RADII.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
            <option value="">Any distance</option>
          </select>
        </label>
      </div>

      <p className="mt-3 text-meta text-ink-3" aria-live="polite">
        {PRAYER_LABELS[prayer]} adhan{" "}
        {adhanForFocus ? formatTime(adhanForFocus) : "—"}. Soonest congregation
        first.
        {beyond > 0 && (
          <>
            {" "}
            <button
              type="button"
              onClick={() => setWithinKm(null)}
              className="font-medium text-brand underline underline-offset-2"
            >
              {beyond} further out →
            </button>
          </>
        )}
      </p>
      <p className="mt-1 text-meta text-ink-3">Iqamah · adhan below</p>

      {starred.length > 0 && (
        <>
          <h2 className="mt-5 font-display text-section font-semibold">
            Your masjids
          </h2>
          <ul className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
            {starred.map((row) => (
              <TimeRow
                key={row.masjid.id}
                masjid={row.masjid}
                today={today}
                iqamah={row.iqamah}
                adhan={row.adhan}
                km={row.km}
                relative={relative(row.minutesAway)}
                favourite
                onToggleFavourite={() => toggle(row.masjid.id)}
              />
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-5 font-display text-section font-semibold">
        {starred.length > 0 ? "Also nearby" : "Congregations"}
      </h2>

      {rest.length === 0 ? (
        <p className="mt-2 rounded-lg border border-line bg-surface p-6 text-center text-body text-ink-2">
          No masjid within {withinKm ?? "any"} km has a {PRAYER_LABELS[prayer]}{" "}
          iqamah on file.
        </p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
          {rest.map((row) => (
            <TimeRow
              key={row.masjid.id}
              masjid={row.masjid}
              today={today}
              iqamah={row.iqamah}
              adhan={row.adhan}
              km={row.km}
              relative={relative(row.minutesAway)}
              favourite={false}
              onToggleFavourite={() => toggle(row.masjid.id)}
            />
          ))}
        </ul>
      )}

      {favourites.length === 0 && (
        <p className="mt-3 text-meta text-ink-3">Star a masjid to pin it here.</p>
      )}

      <p className="mt-5 text-meta text-ink-3">
        Adhan times are calculated. Iqamah times are community-collected —
        confirm with the masjid before relying on them.
      </p>
    </section>
  );
}

/**
 * The ring's hero number (§9): "2:50:49" with seconds under an hour, "2:50"
 * above it. A plain function, not a hook — it derives from the clock value it
 * is handed, so it can be called conditionally.
 */
function countdownText(now: Date, target: Date | null): string {
  if (!target) return "—";
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "now";

  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatRelative(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 0) return `${Math.abs(m)} min ago`;
  if (m === 0) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `in ${h} h` : `in ${h} h ${rest} min`;
}
