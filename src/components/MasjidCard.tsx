import FreshnessDot from "./FreshnessDot";
import Icon from "./Icon";
import { formatDistance } from "../lib/distance";
import { masjidPath } from "../lib/route";
import { formatTime, formatTimeShort } from "../lib/time";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";
import type { ReactNode } from "react";

/**
 * One masjid as a card with its whole day on it — Home's list item.
 *
 * Redesign, 2026-09, after looking at how the other Toronto iqamah apps
 * lay this out: the row that showed one time made you open the masjid to
 * answer the next question ("and when is Isha there?"). The card shows all
 * five congregations in a row, the one you're looking at lit up, so the
 * common follow-up is answered without a tap. Directions sits on the card
 * because it is what you do once you've picked.
 */
export default function MasjidCard({
  masjid,
  today,
  focus,
  focusLabel,
  day,
  jumuah,
  km,
  relative,
  note,
  favourite,
  onToggleFavourite,
}: {
  masjid: Masjid;
  today: Date;
  /** The prayer the screen is about — its column is highlighted. */
  focus: Prayer;
  /** "Jumu'ah" on a Friday's Dhuhr, otherwise the prayer's name. */
  focusLabel: string;
  /** The day's congregation per prayer; null where none is on file. */
  day: Partial<Record<Prayer, Date | null>>;
  /** Friday khutbah times, already formatted. Empty when none on file. */
  jumuah: Date[];
  km: number;
  /** "in 12 min" for the focused prayer, if it has a time. */
  relative?: string;
  note?: ReactNode;
  favourite: boolean;
  onToggleFavourite: () => void;
}) {
  const collected = Object.keys(masjid.iqamah ?? {}).length > 0;

  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <a href={masjidPath(masjid.id)} className="min-w-0 flex-1">
          <span className="block truncate text-name font-semibold text-ink">
            {masjid.name}
          </span>
          <span className="mt-1 flex items-center gap-2 text-meta text-ink-3">
            <span className="num shrink-0">{formatDistance(km)}</span>
            <span aria-hidden="true">·</span>
            <FreshnessDot masjid={masjid} today={today} />
          </span>
        </a>
        <button
          type="button"
          onClick={onToggleFavourite}
          aria-pressed={favourite}
          aria-label={
            favourite
              ? `Remove ${masjid.name} from your masjids`
              : `Add ${masjid.name} to your masjids`
          }
          className={
            "-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full " +
            (favourite ? "text-brand" : "text-ink-3 hover:text-ink")
          }
        >
          <Icon name={favourite ? "star-filled" : "star"} size={22} />
        </button>
      </div>

      {/* The day, five across. A list, not a table: each cell is read as
          "Fajr, 6:15" on its own, and the column headers of a table would be
          read again before every value. */}
      <ul className="mt-3 grid grid-cols-5 gap-1" aria-label="Today's congregations">
        {PRAYERS.map((p) => {
          const at = day[p] ?? null;
          const lit = p === focus;
          const label = p === focus ? focusLabel : PRAYER_LABELS[p];
          return (
            <li
              key={p}
              className="flex min-w-0 flex-col items-center rounded-lg px-0.5 py-2"
              style={
                lit
                  ? { background: `var(--${p}-wash)`, boxShadow: `inset 0 0 0 1.5px var(--${p})` }
                  : undefined
              }
            >
              <span
                className="w-full truncate text-center text-[12px] font-semibold"
                style={{ color: lit ? `var(--${p}-ink)` : "var(--ink-3)" }}
              >
                {label}
              </span>
              <span
                className={
                  "num mt-0.5 text-[15px] font-semibold " + (at ? "text-ink" : "text-ink-3")
                }
              >
                {at ? formatTimeShort(at) : "—"}
                {!at && <span className="sr-only">no time on file</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {jumuah.length > 0 && (
        <p className="mt-2 flex items-baseline gap-2 border-t border-line pt-2 text-meta">
          <span className="text-ink-3">Jumu&rsquo;ah</span>
          <span className="num font-semibold text-ink">
            {jumuah.map((t) => formatTimeShort(t)).join(" · ")}
          </span>
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <p className="min-w-0 flex-1 text-meta text-ink-2">
          {collected && day[focus] ? (
            <>
              <span className="font-semibold" style={{ color: `var(--${focus}-ink)` }}>
                {focusLabel}
              </span>{" "}
              <span className="num">
                {formatTime(day[focus]!)}
                {relative && ` · ${relative}`}
              </span>
            </>
          ) : (
            <span className="text-ink-3">No {focusLabel} time on file</span>
          )}
          {note != null && <span className="block truncate">{note}</span>}
        </p>
        <a
          href={directionsUrl(masjid)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-wash px-4 text-meta font-semibold text-brand"
        >
          <Icon name="navigation" size={16} />
          Directions
        </a>
      </div>
    </li>
  );
}

/** Google Maps directions, which opens the maps app on a phone. */
export function directionsUrl(masjid: Masjid): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${masjid.lat},${masjid.lng}`;
}
