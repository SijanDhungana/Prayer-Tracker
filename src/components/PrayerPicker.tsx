import { comparePath } from "../lib/route";
import { PRAYERS, PRAYER_LABELS, type Prayer } from "../lib/types";

/** Segmented control across the five prayers. Links, so the URL is shareable. */
export default function PrayerPicker({ selected }: { selected: Prayer }) {
  return (
    <div
      className="grid grid-cols-5 gap-1 rounded-xl bg-surface-2 p-1"
      role="tablist"
      aria-label="Prayer"
    >
      {PRAYERS.map((prayer) => {
        const active = prayer === selected;
        return (
          <a
            key={prayer}
            href={comparePath(prayer)}
            role="tab"
            aria-selected={active}
            className={
              "rounded-lg py-2 text-center text-sm font-medium transition-colors " +
              (active
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-2 hover:text-ink")
            }
          >
            {PRAYER_LABELS[prayer]}
          </a>
        );
      })}
    </div>
  );
}
