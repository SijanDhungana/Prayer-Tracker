import { PRAYERS, PRAYER_LABELS, type Prayer } from "../lib/types";
import { formatTime } from "../lib/time";

/**
 * Five-across strip of a day's times. Iqamah is the headline — it's the thing
 * the app exists to compare — with the calculated adhan beneath it in support.
 */
export default function PrayerTimeRow({
  iqamah,
  adhan,
}: {
  iqamah: Record<Prayer, Date | null>;
  adhan: Record<Prayer, Date>;
}) {
  return (
    <dl className="grid grid-cols-5 gap-1 text-center">
      {PRAYERS.map((prayer) => (
        <div key={prayer}>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
            {PRAYER_LABELS[prayer]}
          </dt>
          <dd>
            <span
              className={
                "mt-0.5 block text-base font-semibold tabular-nums " +
                (iqamah[prayer] ? "text-ink" : "text-ink-3")
              }
            >
              {iqamah[prayer] ? formatTime(iqamah[prayer]!) : "—"}
            </span>
            <span className="block text-[11px] tabular-nums text-ink-3">
              {formatTime(adhan[prayer])}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
