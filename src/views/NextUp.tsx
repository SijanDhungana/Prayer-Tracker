import { useEffect, useMemo, useState } from "react";
import HomeMasjidCard from "../components/HomeMasjidCard";
import Icon, { type IconName } from "../components/Icon";
import LocationChip from "../components/LocationChip";
import SegmentedControl from "../components/SegmentedControl";
import Sheet from "../components/Sheet";
import TimeRow from "../components/TimeRow";
import { useClock } from "../lib/clock";
import { haversineKm, type Point } from "../lib/distance";
import { useFavourites } from "../lib/favourites";
import { formatRelative } from "../lib/nextUp";
import { isFriday, jumuahTimesOn, resolvePlanIqamah } from "../lib/planPrayer";
import { useSettings } from "../lib/settings";
import type { ReferencePoint } from "../lib/location";
import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { planPath, prayerPath } from "../lib/route";
import { asrSchoolMismatch } from "../lib/trust";
import { formatCalendarDate, formatTime } from "../lib/time";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

/**
 * Home — the app's answer to its dominant question: which congregation can I
 * still make, and when do I need to leave.
 *
 * Redesign, 2026-09. The old home led with a countdown ring, which was
 * beautiful and read as an instrument: a big number that needed the label
 * under it to mean anything. This one leads with the answer itself, the way
 * the apps this community already uses do — one card that says the next
 * prayer, its time, the nearest masjid holding it, and how long you have.
 * Below it, the five prayers as a strip of cards you can tap, then the list.
 * Filters live behind one button so the first masjid is never pushed below
 * the fold by controls.
 *
 * Everything under the surface is unchanged: the same rows, the same Friday
 * substitution, the same Asr-school rule, the same fail-safe posture.
 */
const RADII = [5, 10, 25, 50];
/** §10.3: a Toronto app must not silently list a masjid in Windsor. */
const DEFAULT_RADIUS_KM = 25;

type SortOrder = "earliest" | "latest";

/** The sun's day, one glyph per prayer. */
const PRAYER_ICON: Record<Prayer, IconName> = {
  fajr: "sunrise",
  dhuhr: "sun",
  asr: "sun-dim",
  maghrib: "sunset",
  isha: "moon",
};

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
  const { second, minute, today, windows } = useClock();
  const { favourites, isFavourite, toggle } = useFavourites();
  const { homeMasjidId, onlyMyAsr } = useSettings();
  const home = masjids.find((m) => m.id === homeMasjidId) ?? null;

  const reference0 = masjids[0];

  /**
   * The prayer the card counts down to: the next one whose adhan is still
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
  // A #/?prayer=asr link tapped while this screen is already open changes
  // the hash but not the mounted state, so the selector stayed put. Follow
  // the URL whenever it names a prayer.
  useEffect(() => {
    if (initialPrayer) setChosen(initialPrayer);
  }, [initialPrayer]);
  const prayer = chosen ?? nextPrayer;

  const [order, setOrder] = useState<SortOrder>("earliest");
  const [after, setAfter] = useState("");
  const [withinKm, setWithinKm] = useState<number | null>(DEFAULT_RADIUS_KM);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
   * Whether the focused prayer has finished for today and we are looking at
   * tomorrow's. The whole screen moves together: it would be incoherent for
   * the card to count down to tomorrow's Fajr while the list underneath said
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

  /**
   * On a Friday the midday congregation is Jumu'ah, not Dhuhr — a masjid
   * holds one or the other, never both. Judged on the date the list is for,
   * so late on a Thursday the rolled-over list is already Friday's.
   */
  const jumuah = isFriday(listDate) && prayer === "dhuhr";
  const prayerName = jumuah ? "Jumu'ah" : PRAYER_LABELS[prayer];
  const labelFor = (p: Prayer) =>
    isFriday(listDate) && p === "dhuhr" ? "Jumu'ah" : PRAYER_LABELS[p];

  const countdownTo = useMemo(() => {
    if (!reference0) return null;
    if (inProgress) return null;
    return adhanTimes(reference0, listDate)[prayer];
  }, [reference0, inProgress, listDate, prayer]);

  /** Today's adhan for each prayer, for the strip. */
  const strip = useMemo(
    () => (reference0 ? adhanTimes(reference0, today) : null),
    [reference0, today],
  );

  // Rows are recomputed on the minute, not the second: distances and iqamah
  // times don't change sixty times a minute, and §12 asks that they not be
  // recomputed on every tick.
  const rows = useMemo(
    () =>
      masjids.map((masjid) => {
        // Jumu'ah resolves to the masjid's next sitting still ahead; a
        // masjid with several sittings names which one this is.
        const iqamah = jumuah
          ? resolvePlanIqamah(masjid, "jumuah", minute, listDate)
          : iqamahTimes(masjid, listDate)[prayer];
        const sittings = jumuah ? jumuahTimesOn(masjid, listDate) : [];
        const index =
          iqamah && sittings.length > 1
            ? sittings.findIndex((t) => t.getTime() === iqamah.getTime())
            : -1;
        return {
          masjid,
          iqamah,
          adhan: adhanTimes(masjid, listDate)[prayer],
          km: haversineKm(from, masjid),
          minutesAway:
            iqamah == null ? null : (iqamah.getTime() - minute.getTime()) / 60_000,
          sitting: index === -1 ? null : `sitting ${index + 1} of ${sittings.length}`,
          // §10.1: this masjid's congregation starts before Asr begins by the
          // visitor's own school.
          otherSchool: asrSchoolMismatch(masjid, prayer, listDate),
        };
      }),
    [masjids, from, listDate, prayer, minute, jumuah],
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
      // The visitor asked to see only masjids praying Asr on their own
      // school's time. Off by default; see settings.tsx.
      if (onlyMyAsr && row.otherSchool) return false;
      return true;
    });

    /**
     * Congregations still ahead come first, soonest at the top; the ones
     * already begun follow, most recent first; masjids with nothing on file
     * last. A plain time sort put "30 min ago" rows above "in 12 min" — the
     * top of the list, where the eye lands, was the prayers you had missed.
     * "Latest first" reverses the upcoming block only.
     */
    const rank = (r: (typeof kept)[number]) =>
      r.minutesAway == null ? 2 : r.minutesAway > 0 ? 0 : 1;
    return kept.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 2) return a.km - b.km;
      const diff = a.iqamah!.getTime() - b.iqamah!.getTime();
      if (ra === 1) return -diff;
      return order === "earliest" ? diff : -diff;
    });
  }, [rows, withinKm, cutoff, order, onlyMyAsr]);

  // Only the ones the radius hid — the "further out" link widens the radius,
  // and must not promise masjids the school filter will still keep hidden.
  const beyond =
    withinKm == null ? 0 : rows.filter((row) => row.km > withinKm).length;
  const starred = visible.filter((r) => isFavourite(r.masjid.id));
  const rest = visible.filter((r) => !isFavourite(r.masjid.id));

  /**
   * The soonest congregation still ahead — the card's answer.
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

  const filtersActive =
    order !== "earliest" || after !== "" || withinKm !== DEFAULT_RADIUS_KM;

  const pick = (p: Prayer) => {
    setChosen(p);
    // Keep the URL shareable — §3's #/?prayer=asr.
    window.history.replaceState(null, "", prayerPath(p));
  };

  return (
    <section>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-meta text-ink-3">{formatCalendarDate(today)}</p>
          <h1 className="font-display text-section font-semibold leading-tight">
            Assalamu alaikum
          </h1>
        </div>
        <div className="pt-1">
          <LocationChip reference={reference} />
        </div>
      </header>

      {/* The answer, as one card. Tinted with the focused prayer's colour so
          the whole card changes with the sun rather than a small badge. */}
      <div
        className="mt-5 rounded-xl border p-5"
        style={{
          borderColor: `var(--${prayer})`,
          background: `var(--${prayer}-wash)`,
        }}
      >
        <div className="flex items-center gap-2" style={{ color: `var(--${prayer})` }}>
          <Icon name={PRAYER_ICON[prayer]} size={22} />
          <span className="text-body font-semibold">
            {inProgress ? "Now" : "Next"}: {prayerName}
            {rollsOver && " tomorrow"}
          </span>
          {adhanForFocus && (
            <span className="num ml-auto text-meta text-ink-3">
              adhan {formatTime(countdownTo ?? adhanForFocus)}
            </span>
          )}
        </div>

        {target ? (
          <>
            <p className="num mt-3 font-display text-bigtime font-semibold leading-none text-ink">
              {formatTime(target.iqamah!)}
            </p>
            <p className="mt-2 text-body text-ink-2">
              <span className="num font-medium text-ink">{relative(target.minutesAway)}</span>
              {" · "}
              {target.masjid.name}
              <span className="num text-ink-3"> · {formatDistanceShort(target.km)}</span>
            </p>
            {target.otherSchool && (
              <p className="mt-1 text-meta text-caution">
                Uses the standard Asr calculation
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <a
                href={directionsUrl(target.masjid)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-body font-semibold text-brand-ink"
              >
                <Icon name="navigation" size={18} />
                Directions
              </a>
              <a
                href={`#/map/${target.masjid.id}`}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-body font-semibold text-ink"
              >
                All times
                <Icon name="chevron-right" size={18} />
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="num mt-3 font-display text-bigtime font-semibold leading-none text-ink">
              {countdownTo ? formatTime(countdownTo) : "—"}
            </p>
            <p className="mt-2 text-body text-ink-2">
              No {prayerName} congregation on file
              {rollsOver ? " for tomorrow" : " left today"}.
            </p>
          </>
        )}

        <p className="num mt-3 text-meta text-ink-3">
          {inProgress ? "Started" : "Adhan in"} {countdown}
        </p>
      </div>

      {/* The accessible twin: re-rendered on the minute, never aria-live (§9). */}
      <p className="sr-only">
        {countdown} {inProgress ? "since" : "until"} {prayerName}
        {adhanForFocus ? ` at ${formatTime(adhanForFocus)}` : ""}.
        {target
          ? ` Next congregation at ${target.masjid.name}, ${formatTime(target.iqamah!)}.`
          : ""}
      </p>

      {home && <HomeMasjidCard masjid={home} />}

      {/* The five prayers as cards. Tapping one re-points the card above and
          the list below — this is where "compare Asr across the city" lives. */}
      <div
        role="radiogroup"
        aria-label="Prayer"
        className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {PRAYERS.map((p) => {
          const selected = p === prayer;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(p)}
              className="flex min-w-[76px] shrink-0 flex-col items-center gap-1 rounded-lg border px-3 py-3 transition-colors"
              style={
                selected
                  ? { background: `var(--${p})`, borderColor: `var(--${p})`, color: "var(--brand-ink)" }
                  : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }
              }
            >
              <Icon name={PRAYER_ICON[p]} size={22} />
              <span className="text-meta font-semibold">{labelFor(p)}</span>
              <span className="num text-meta opacity-90">
                {strip ? formatTime(strip[p]) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="font-display text-section font-semibold">
          {starred.length > 0 ? "Your masjids" : "Masjids near you"}
        </h2>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={
            "flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-meta font-semibold " +
            (filtersActive
              ? "border-brand bg-brand-wash text-brand"
              : "border-line bg-surface text-ink-2")
          }
        >
          <Icon name="filter" size={16} />
          Filters
        </button>
      </div>

      {starred.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-lg border border-line bg-surface">
          {starred.map((row) => (
            <TimeRow
              key={row.masjid.id}
              masjid={row.masjid}
              today={today}
              iqamah={row.iqamah}
              adhan={row.adhan}
              km={row.km}
              relative={relative(row.minutesAway)}
              note={row.sitting ?? undefined}
              favourite
              onToggleFavourite={() => toggle(row.masjid.id)}
            />
          ))}
        </ul>
      )}

      {starred.length > 0 && (
        <h2 className="mt-6 font-display text-section font-semibold">Also nearby</h2>
      )}

      {rest.length === 0 ? (
        <p className="mt-3 rounded-lg border border-line bg-surface p-6 text-center text-body text-ink-2">
          {withinKm == null
            ? `No masjid has a ${prayerName} iqamah on file.`
            : `No masjid within ${withinKm} km has a ${prayerName} iqamah on file.`}
        </p>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-lg border border-line bg-surface">
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
                ) : (
                  (row.sitting ?? undefined)
                )
              }
              favourite={false}
              onToggleFavourite={() => toggle(row.masjid.id)}
            />
          ))}
        </ul>
      )}

      {beyond > 0 && (
        <button
          type="button"
          onClick={() => setWithinKm(null)}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-surface text-body font-semibold text-brand"
        >
          Show {beyond} further out
        </button>
      )}

      {favourites.length === 0 && (
        <p className="mt-3 text-meta text-ink-3">
          Tap the star on a masjid to keep it at the top.
        </p>
      )}

      <a
        href={planPath}
        className="mt-6 flex items-center gap-3 rounded-lg border border-line bg-surface p-4"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-wash text-brand">
          <Icon name="route" size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold text-ink">Going somewhere?</span>
          <span className="block text-meta text-ink-3">
            Find a masjid on the way and know if you can still make it.
          </span>
        </span>
        <Icon name="chevron-right" size={20} />
      </a>

      <p className="mt-6 text-meta text-ink-3">
        Big time is the congregation (iqamah); small is the calculated adhan.
        Iqamah times are collected from each masjid — confirm with the masjid
        before relying on them.
      </p>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-meta font-semibold text-ink-2">Order</p>
            <SegmentedControl
              label="Order"
              value={order}
              onChange={setOrder}
              options={[
                { value: "earliest", label: "Earliest first" },
                { value: "latest", label: "Latest first" },
              ]}
            />
          </div>
          <label className="block">
            <span className="mb-2 block text-meta font-semibold text-ink-2">
              Only after
            </span>
            <input
              type="time"
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              className="num min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-meta font-semibold text-ink-2">
              Within
            </span>
            <select
              value={withinKm ?? ""}
              onChange={(e) => setWithinKm(e.target.value ? Number(e.target.value) : null)}
              className="min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink"
            >
              {RADII.map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
              <option value="">Any distance</option>
            </select>
          </label>
          <div className="flex gap-2">
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setOrder("earliest");
                  setAfter("");
                  setWithinKm(DEFAULT_RADIUS_KM);
                }}
                className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-line text-body font-semibold text-ink-2"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand text-body font-semibold text-brand-ink"
            >
              Done
            </button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}

/** "325 m", "2.4 km" — the row's own formatter, kept short for the card. */
function formatDistanceShort(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Google Maps directions to the masjid, opened in the maps app on a phone. */
function directionsUrl(masjid: Masjid): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${masjid.lat},${masjid.lng}`;
}

/**
 * The card's countdown: "2:50:49" with seconds under an hour, "2:50" above
 * it. A plain function, not a hook — it derives from the clock value it is
 * handed, so it can be called conditionally.
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
