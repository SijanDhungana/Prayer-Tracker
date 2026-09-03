import { PRAYERS, PRAYER_LABELS, type Prayer } from "../lib/types";
import { formatTimeShort } from "../lib/time";

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
                "mt-0.5 block font-num text-body " +
                (iqamah[prayer] ? "text-ink" : "text-ink-3")
              }
            >
              {iqamah[prayer] ? formatTimeShort(iqamah[prayer]!) : "—"}
            </span>
            <span className="block font-num text-[11px] text-ink-3">
              {formatTimeShort(adhan[prayer])}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
