import FreshnessDot from "./FreshnessDot";
import Icon from "./Icon";
import { masjidPath } from "../lib/route";
import { formatTime } from "../lib/time";
import { formatDistance } from "../lib/distance";
import type { Masjid } from "../lib/types";
import type { ReactNode } from "react";

/**
 * The row shared by Next up, Jumu'ah and the map's results sheet.
 *
 * §5's rule lives here: the iqamah is the primary number, the adhan sits
 * beneath the name small and grey, and neither is bolded to tell them apart.
 * One component means the rule cannot drift between the three screens.
 *
 * Redesign: the time sits in its own pill on the right, the name is a size
 * up, and the whole row is taller. On a phone held in a hurry the two things
 * that matter are the name and the time, and both should be readable at
 * arm's length.
 */
export default function TimeRow({
  masjid,
  today,
  /** The congregation time. Null renders the em dash §5 asks for. */
  iqamah,
  /** Shown small under the name — the calculation, not a promise. */
  adhan,
  km,
  /** "in 2 h 14 min", already formatted by the caller's clock. */
  relative,
  /** e.g. "sitting 2 of 3". */
  note,
  favourite,
  onToggleFavourite,
  /** Overrides navigation — the map uses this to centre a pin instead. */
  onSelect,
  trailing,
}: {
  masjid: Masjid;
  today: Date;
  iqamah: Date | null;
  adhan?: Date;
  km: number;
  relative?: string;
  note?: ReactNode;
  favourite?: boolean;
  onToggleFavourite?: () => void;
  onSelect?: () => void;
  trailing?: ReactNode;
}) {
  const meta = [
    formatDistance(km),
    adhan ? `adhan ${formatTime(adhan)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-name font-semibold text-ink">
          {masjid.name}
        </span>
        <span className="mt-1 flex items-center gap-2 text-meta text-ink-3">
          <FreshnessDot masjid={masjid} today={today} showLabel={false} />
          <span className="truncate">
            <span className="num">{meta}</span>
            {note != null && <> · {note}</>}
          </span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className={
            "num inline-block rounded-full px-3 py-1.5 text-name font-semibold " +
            (iqamah ? "bg-surface-2 text-ink" : "text-ink-3")
          }
        >
          {iqamah ? formatTime(iqamah) : "—"}
        </span>
        {relative && (
          <span className="num mt-1 block text-meta text-ink-3">{relative}</span>
        )}
      </span>
      {trailing}
    </>
  );

  const className =
    // min-w-0 is what lets the name inside truncate instead of pushing the
    // time pill past the card's edge.
    "flex min-h-[80px] min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left transition-colors hover:bg-surface-2 " +
    // Without a star the row owns its right edge; with one, the star's column
    // does, and the time needs to stop short of it.
    (onToggleFavourite ? "pr-1" : "pr-4");

  return (
    // The star is a *sibling column*, not an overlay, so it can never sit on
    // top of the time however long the time string gets. A sibling rather
    // than a child because a <button> inside an <a> is invalid.
    <li className="flex items-stretch border-b border-line last:border-b-0">
      {onSelect ? (
        <button type="button" onClick={onSelect} className={className}>
          {body}
        </button>
      ) : (
        <a href={masjidPath(masjid.id)} className={className}>
          {body}
        </a>
      )}

      {onToggleFavourite && (
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
            "flex w-12 shrink-0 items-center justify-center " +
            (favourite ? "text-brand" : "text-ink-3 hover:text-ink")
          }
        >
          <Icon name={favourite ? "star-filled" : "star"} size={20} />
        </button>
      )}
    </li>
  );
}
