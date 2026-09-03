import { useEffect, useState } from "react";
import FreshnessDot from "./FreshnessDot";
import Icon from "./Icon";
import SuggestTimeForm from "./SuggestTimeForm";
import { formatDistance, haversineKm, type Point } from "../lib/distance";
import { useFavourites } from "../lib/favourites";
import { adhanTimes, iqamahTimes, orderedJumuah } from "../lib/prayer";
import { formatClock, formatTime } from "../lib/time";
import { asrSchoolMismatch } from "../lib/trust";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

/**
 * The masjid detail screen — design spec v2 §8.1.
 *
 * Routed at #/map/:id so it is linkable and survives the back button, and
 * pushed over the map as a full-height sheet rather than navigating away.
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

  /**
   * Behave like the dialog the markup claims to be. It carried
   * aria-modal="true" with none of what that promises: Escape did nothing,
   * and the page behind it kept scrolling under a finger that had missed
   * the sheet. Sheet.tsx does both for every other overlay; this is the
   * same contract for the one overlay that is a route rather than state.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${masjid.name}, ${masjid.address}`,
  )}`;

  const collected = Object.keys(masjid.iqamah ?? {}).length > 0;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={masjid.name}
      className="absolute inset-x-0 bottom-0 z-40 flex flex-col overflow-y-auto rounded-t-xl border-t border-line bg-surface shadow-sheet"
      // The sheet's sticky header used to start a flat 32px from the top of
      // the web view, which on a phone with a notch is underneath the clock.
      style={{ top: "calc(env(safe-area-inset-top) + 2rem)" }}
    >
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-surface p-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-title font-semibold">{masjid.name}</h1>
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
        <div className="flex flex-wrap gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-brand px-4 font-medium text-brand-ink"
          >
            <Icon name="map-pin" size={18} />
            Directions
          </a>
          {masjid.website && (
            <a
              href={masjid.website}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line px-4 font-medium text-ink-2 hover:text-ink"
            >
              <Icon name="globe" size={18} />
              Website
            </a>
          )}
        </div>

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
              <th className="py-2 font-normal">Prayer</th>
              <th className="py-2 text-right font-normal">Adhan</th>
              <th className="py-2 text-right font-normal">Iqamah</th>
            </tr>
          </thead>
          <tbody>
            {PRAYERS.map((prayer) => {
              const mismatch = asrSchoolMismatch(masjid, prayer, date);
              return (
                <tr key={prayer} className="border-t border-line">
                  <th scope="row" className="py-3 text-left font-medium">
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
                  <td className="py-3 text-right font-num text-name font-medium text-ink">
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
            Suggest a correction →
          </button>
        )}

        <p className="mt-4 pb-8 text-meta text-ink-3">
          Adhan times are calculated for this location. Iqamah times are
          community-collected — confirm with the masjid before relying on them.
        </p>
      </div>
    </section>
  );
}
