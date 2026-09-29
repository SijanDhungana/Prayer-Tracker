import { useEffect, useRef, useState } from "react";
import FreshnessDot from "./FreshnessDot";
import { nextIqamahAt } from "./HomeMasjidCard";
import Icon from "./Icon";
import SuggestTimeForm from "./SuggestTimeForm";
import { formatDistance, haversineKm, type Point } from "../lib/distance";
import { useFavourites } from "../lib/favourites";
import { useClock } from "../lib/clock";
import { formatRelative } from "../lib/nextUp";
import { adhanTimes, iqamahTimes, orderedJumuah } from "../lib/prayer";
import { formatClock, formatTime } from "../lib/time";
import { asrSchoolMismatch } from "../lib/trust";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

/**
 * The masjid detail screen — design spec v2 §8.1.
 *
 * Routed at #/masjid/:id so it is linkable and survives the back button, and
 * drawn over whichever screen opened it (App.tsx, `useUnderlay`) rather than
 * navigating away from it.
 *
 * This is the one place iqamah and adhan are both explicitly labelled: §5
 * keeps labels off the dense list rows, but here the space is worth spending
 * because it is where someone checks rather than scans.
 */
export default function MasjidDetailSheet({
  masjid,
  date,
  from,
  onClose,
  onPublished,
}: {
  masjid: Masjid;
  date: Date;
  from: Point;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const adhan = adhanTimes(masjid, date);
  const iqamah = iqamahTimes(masjid, date);
  const sittings = orderedJumuah(masjid);
  const { isFavourite, toggle } = useFavourites();
  const [suggesting, setSuggesting] = useState<Prayer | "jumuah" | null>(null);
  const starred = isFavourite(masjid.id);
  const { minute } = useClock();
  // The one line people open this sheet for, answered before the table.
  const next = nextIqamahAt(masjid, date, minute);

  const panel = useRef<HTMLElement>(null);
  // The latest onClose, so the effect below runs once per opening rather
  // than again on every render the clock causes.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  /**
   * Behave like the dialog the markup claims to be — the contract Sheet.tsx
   * keeps for every other overlay. Focus moves in when it opens and stays in
   * on Tab; Escape closes it; the page behind doesn't scroll; and focus goes
   * back to whatever opened it. It had the last three but not the first:
   * focus stayed on <body>, so the next Tab went to the tab bar behind it.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const at = document.activeElement;
      if (event.shiftKey && (at === first || at === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && at === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // The screen beneath never unmounted, so what opened the sheet is
      // still there to take focus back.
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${masjid.lat},${masjid.lng}`;
  // Offered beside Google because on an iPhone it is the maps app people
  // already have open, and it needs no second app to turn by turn.
  const appleMapsUrl = `https://maps.apple.com/?daddr=${masjid.lat},${masjid.lng}&q=${encodeURIComponent(masjid.name)}`;

  const collected = Object.keys(masjid.iqamah ?? {}).length > 0;

  return (
    // Above the tab bar, not under it: the bar used to cover the bottom of
    // the sheet, including the disclaimer that closes it.
    <div className="fixed inset-0 z-50">
      {/* The screen that opened the sheet, dimmed; tapping it closes. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={masjid.name}
        tabIndex={-1}
        // Full height on a phone, starting just below the status bar (a flat
        // 32px put the sticky header under the clock on a notched phone); a
        // centred panel on anything wider.
        className="absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+2rem)] flex flex-col overflow-y-auto rounded-t-xl border-t border-line bg-surface shadow-sheet sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[min(560px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border"
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-surface p-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-section font-semibold leading-tight">{masjid.name}</h1>
            <p className="mt-0.5 text-body text-ink-2">{masjid.address}</p>
            <p className="mt-1 flex items-center gap-2 font-num text-meta text-ink-3">
              {formatDistance(haversineKm(from, masjid))}
            </p>
            <div className="mt-1">
              <FreshnessDot masjid={masjid} today={date} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggle(masjid.id)}
            aria-pressed={starred}
            aria-label={starred ? "Remove from your masjids" : "Add to your masjids"}
            className={
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full " +
              (starred ? "text-brand" : "text-ink-3 hover:text-ink")
            }
          >
            <Icon name={starred ? "star-filled" : "star"} size={20} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:text-ink"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="p-4">
          {next && (
            <div
              className="mb-4 rounded-lg px-4 py-3"
              style={{ background: `var(--${next.prayer}-wash)` }}
            >
              <p className="text-meta font-semibold" style={{ color: `var(--${next.prayer}-ink)` }}>
                Next iqamah{next.tomorrow && " · tomorrow"}
              </p>
              <p className="num mt-0.5 text-section font-semibold text-ink">
                {PRAYER_LABELS[next.prayer]} {formatTime(next.at)}
                <span className="ml-2 text-body font-normal text-ink-2">
                  {formatRelative((next.at.getTime() - minute.getTime()) / 60_000)}
                </span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-4 font-semibold text-brand-ink"
            >
              <Icon name="navigation" size={18} />
              Apple Maps
            </a>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold text-ink"
            >
              <Icon name="map-pin" size={18} />
              Google Maps
            </a>
          </div>
          {masjid.website && (
            <a
              href={masjid.website}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex min-h-11 items-center gap-2 text-meta font-medium text-brand underline underline-offset-2"
            >
              <Icon name="globe" size={16} />
              {masjid.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          )}

          {!collected && (
            <p className="mt-4 rounded-md bg-surface-2 p-3 text-body text-ink-2">
              We haven&rsquo;t collected this masjid&rsquo;s iqamah times. The
              times shown are calculated adhan.
            </p>
          )}

          <h2 className="mt-6 font-display text-section font-semibold">Today</h2>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr className="text-left text-meta uppercase tracking-[0.08em] text-ink-3">
                <th className="py-2 pl-2 font-normal">Prayer</th>
                <th className="py-2 text-right font-normal">Adhan</th>
                <th className="py-2 pr-2 text-right font-normal">Iqamah</th>
              </tr>
            </thead>
            <tbody>
              {PRAYERS.map((prayer) => {
                const mismatch = asrSchoolMismatch(masjid, prayer, date);
                // NextRakaa's cue: the row you're heading for is lit, so the
                // table answers "which one is next" without reading the clock.
                const isNext = next != null && !next.tomorrow && next.prayer === prayer;
                return (
                  <tr
                    key={prayer}
                    className="border-t border-line"
                    style={isNext ? { background: `var(--${prayer}-wash)` } : undefined}
                    aria-current={isNext ? "time" : undefined}
                  >
                    <th
                      scope="row"
                      className="py-3 pl-2 text-left font-medium"
                      style={isNext ? { color: `var(--${prayer}-ink)` } : undefined}
                    >
                      {PRAYER_LABELS[prayer]}
                      {mismatch && (
                        <span className="mt-0.5 block text-meta font-normal text-caution">
                          This masjid uses the standard Asr calculation.
                        </span>
                      )}
                    </th>
                    <td className="py-3 text-right font-num text-meta text-ink-3">
                      {formatTime(adhan[prayer])}
                    </td>
                    <td className="py-3 pr-2 text-right font-num text-name font-semibold text-ink">
                      {iqamah[prayer] ? (
                        formatTime(iqamah[prayer]!)
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSuggesting(prayer)}
                          className="inline-flex min-h-11 items-center text-meta font-medium text-brand underline underline-offset-2"
                        >
                          Add times →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2 className="mt-6 font-display text-section font-semibold">
            Friday · Jumu&rsquo;ah
          </h2>
          {sittings.length === 0 ? (
            <p className="mt-2 text-body text-ink-2">
              No Friday times on file yet.{" "}
              <button
                type="button"
                onClick={() => setSuggesting("jumuah")}
                className="font-medium text-brand underline underline-offset-2"
              >
                Add times →
              </button>
            </p>
          ) : (
            <ul className="mt-2 overflow-hidden rounded-md border border-line">
              {sittings.map((session, i) => (
                <li
                  key={`${session.khutbah}-${i}`}
                  className="flex items-center justify-between border-b border-line px-3 py-3 last:border-b-0"
                >
                  <span className="text-body text-ink-2">
                    {sittings.length > 1 ? `Sitting ${i + 1} of ${sittings.length}` : "Khutbah"}
                  </span>
                  <span className="font-num text-name font-medium text-ink">
                    {formatClock(session.khutbah)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {suggesting ? (
            <SuggestTimeForm
              masjid={masjid}
              adhan={adhan}
              iqamah={iqamah}
              initialPrayer={suggesting}
              onClose={() => setSuggesting(null)}
              onPublished={onPublished}
            />
          ) : (
            <button
              type="button"
              onClick={() => setSuggesting("fajr")}
              className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-md border border-line font-medium text-ink-2 hover:text-ink"
            >
              Report a wrong time
            </button>
          )}

          <p className="mt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] text-meta text-ink-3">
            Adhan times are calculated for this location. Iqamah times are
            community-collected — confirm with the masjid before relying on them.
          </p>
        </div>
      </section>
    </div>
  );
}
