import FreshnessDot from "./FreshnessDot";
import Icon from "./Icon";
import { masjidPath } from "../lib/route";
import { formatTime } from "../lib/time";
import { formatDistance } from "../lib/distance";
import type { Masjid } from "../lib/types";
import type { ReactNode } from "react";

/**
 * The 72px row shared by Next up, Jumu'ah and the map's results sheet
 * (design spec v2 §11).
 *
 * §5's rule lives here: the iqamah is the primary number, the adhan sits
 * beneath it small and grey, and neither is bolded to tell them apart. One
 * component means the rule cannot drift between the three screens.
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
  /** Overrides navigation — the map uses this to centre a pin instead. */
  onSelect?: () => void;
  trailing?: ReactNode;
}) {
  const meta = [
    formatDistance(km),
    adhan ? `Adhan ${formatTime(adhan)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <FreshnessDot masjid={masjid} today={today} showLabel={false} />
          <span className="truncate text-name font-medium text-ink">
            {masjid.name}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-meta text-ink-3">
          <span className="font-num">{meta}</span>
          {note != null && <> · {note}</>}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block font-num text-section font-medium text-ink">
          {iqamah ? formatTime(iqamah) : <span className="text-ink-3">—</span>}
        </span>
        {relative && (
          <span className="block font-num text-meta text-ink-3">{relative}</span>
        )}
      </span>
      {trailing}
    </>
  );

  const className =
    "flex min-h-[72px] flex-1 items-center gap-3 py-3 pl-4 text-left transition-colors hover:bg-surface-2 " +
    // Without a star the row owns its right edge; with one, the star's column
    // does, and the time needs to stop short of it.
    (onToggleFavourite ? "pr-1" : "pr-4");

  return (
    // The star is a *sibling column*, not an overlay. It used to be absolutely
    // positioned at the row's top-right, which is exactly where the iqamah
    // time sits — so on every row the star sat on top of the "PM".
    //
    // A sibling rather than a child because a <button> inside an <a> is
    // invalid, and because giving it its own 44px column is what guarantees
    // the two can never collide however long the time string gets.
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
            "flex w-11 shrink-0 items-center justify-center " +
            (favourite ? "text-brand" : "text-ink-3 hover:text-ink")
          }
        >
          <Icon name={favourite ? "star-filled" : "star"} size={18} />
        </button>
      )}
    </li>
  );
}
