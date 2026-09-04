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
import { formatRelative } from "../lib/nextUp";
import { useSettings } from "../lib/settings";
import type { ReferencePoint } from "../lib/location";
import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { prayerPath } from "../lib/route";
import { asrSchoolMismatch } from "../lib/trust";
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
   * Whether the focused prayer's window is open right now.
   *
   * This is the only state where "started" means anything: Isha at 11pm has
   * begun and can still be prayed. Fajr at 11pm has not "started" — its
   * window closed at sunrise eighteen hours ago, and the thing the visitor
   * wants to know is how long until the next one.
   */
  const inProgress = useMemo(() => {
    const window = windows.find((w) => w.prayer === prayer);
    return window != null && minute >= window.start && minute < window.end;
  }, [windows, prayer, minute]);

  /**
   * The instant the countdown runs to: the next occurrence of the focused
   * prayer, today's if it is still ahead and tomorrow's once it has passed.
   *
   * Deliberately not "today's, or nothing" — at 11pm nobody selecting Fajr
   * means this morning's. Tomorrow's is the only reading that makes sense,
   * and computing it from today's date rather than the window keeps it right
   * in the small hours too, when today's Fajr is still ahead.
   */
  /**
   * Whether the focused prayer has finished for today and we are looking at
   * tomorrow's. The whole screen moves together: it would be incoherent for
   * the ring to count down to tomorrow's Fajr while the list underneath said
   * "no congregation left today".
   */
  const rollsOver =
    !inProgress && adhanForFocus != null && adhanForFocus <= minute;

  const listDate = useMemo(
    () =>
      rollsOver
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        : today,
    [rollsOver, today],
  );

  const countdownTo = useMemo(() => {
    if (!reference0) return null;
    if (inProgress) return null;
    return adhanTimes(reference0, listDate)[prayer];
  }, [reference0, inProgress, listDate, prayer]);

  // Rows are recomputed on the minute, not the second: distances and iqamah
  // times don't change sixty times a minute, and §12 asks that they not be
  // recomputed on every tick.
  const rows = useMemo(
    () =>
      masjids.map((masjid) => {
        const iqamah = iqamahTimes(masjid, listDate)[prayer];
        return {
          masjid,
          iqamah,
          adhan: adhanTimes(masjid, listDate)[prayer],
          km: haversineKm(from, masjid),
          minutesAway:
            iqamah == null ? null : (iqamah.getTime() - minute.getTime()) / 60_000,
          // §10.1: this masjid's congregation starts before Asr begins by the
          // visitor's own school.
          otherSchool: asrSchoolMismatch(masjid, prayer, listDate),
        };
      }),
    [masjids, from, listDate, prayer, minute],
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

  /**
   * The soonest congregation still ahead — the ring's target line (§9).
   *
   * Masjids on the other Asr school are ranked last rather than dropped.
   * Their jamaah begins before Asr has started for a Hanafi visitor, so
   * offering it as "the soonest congregation you can catch" would be
   * recommending a prayer they cannot pray — but it is still a real jamaah,
   * and the right answer if there is nothing else.
   */
  const target = useMemo(() => {
    const ahead = rows
      .filter((r) => r.minutesAway != null && r.minutesAway > 0)
      .sort((a, b) => a.minutesAway! - b.minutesAway!);
    return ahead.find((r) => !r.otherSchool) ?? ahead[0] ?? null;
  }, [rows]);

  const countdown = inProgress
    ? countdownText(adhanForFocus ?? second, second)
    : countdownText(second, countdownTo);
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
          countdownLabel={inProgress ? "since" : "until"}
          focus={prayer}
          adhan={adhanForFocus}
          onSelectPrayer={setChosen}
        >
          {target ? (
            <a
              href={`#/map/${target.masjid.id}`}
              className="inline-block underline-offset-2 hover:underline"
            >
              <span className="block text-meta uppercase tracking-[0.08em] text-ink-3">
                Soonest congregation
              </span>
              <span className="mt-0.5 block text-body text-ink">
                {target.masjid.name}
              </span>
              <span className="block font-num text-meta text-ink-3">
                Iqamah {formatTime(target.iqamah!)} ·{" "}
                {relative(target.minutesAway)}
              </span>
              {target.otherSchool && (
                <span className="mt-0.5 block text-meta text-caution">
                  Uses the standard Asr calculation
                </span>
              )}
            </a>
          ) : (
            <span className="mt-3 block text-meta text-ink-3">
              No {PRAYER_LABELS[prayer]} congregation on file
              {rollsOver ? " for tomorrow" : " left today"}
            </span>
          )}
        </DayRing>
      </div>

      {/* The accessible twin: re-rendered on the minute, never aria-live (§9). */}
      <p className="sr-only">
        {countdown} {inProgress ? "since" : "until"} {PRAYER_LABELS[prayer]}
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

      {/* One row that scrolls, not two that wrap. Three chips wrapping onto a
          second line pushed the first congregation another 52px down a screen
          whose whole job is to show it. */}
      <div className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setOrder((o) => (o === "earliest" ? "latest" : "earliest"))}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-meta font-medium text-ink-2 hover:text-ink"
        >
          <Icon name="sliders" size={16} />
          {order === "earliest" ? "Earliest first" : "Latest first"}
        </button>

        <label className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 text-meta text-ink-2">
          <span>After</span>
          <input
            type="time"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="bg-transparent font-num text-ink outline-none"
          />
        </label>

        <label className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 text-meta text-ink-2">
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

      {/* Not aria-live: this line re-renders every minute, and a live region
          would read the whole sentence aloud each time. The sr-only twin above
          already carries the countdown for screen readers, on its own terms. */}
      <p className="mt-3 text-meta text-ink-3">
        {PRAYER_LABELS[prayer]} adhan{" "}
        {countdownTo ? formatTime(countdownTo) : "—"}
        {rollsOver && " tomorrow"} · large time is the iqamah, small is the adhan.
        {beyond > 0 && (
          <>
            {" "}
            <button
              type="button"
              onClick={() => setWithinKm(null)}
              className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-2"
            >
              {beyond} further out →
            </button>
          </>
        )}
      </p>

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
          {withinKm == null
            ? `No masjid has a ${PRAYER_LABELS[prayer]} iqamah on file.`
            : `No masjid within ${withinKm} km has a ${PRAYER_LABELS[prayer]} iqamah on file.`}
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
              note={
                row.otherSchool ? (
                  <span className="text-caution">standard Asr</span>
                ) : undefined
              }
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
