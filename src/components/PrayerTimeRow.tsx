import { PRAYERS, PRAYER_LABELS, type Prayer } from "../lib/types";
import { formatTime } from "../lib/time";

/** Compact five-across strip of a day's times — the app's core visual unit. */
export default function PrayerTimeRow({
  times,
}: {
  times: Record<Prayer, Date>;
}) {
  return (
    <dl className="grid grid-cols-5 gap-1 text-center">
      {PRAYERS.map((prayer) => (
        <div key={prayer}>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
            {PRAYER_LABELS[prayer]}
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-stone-900">
            {formatTime(times[prayer])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
