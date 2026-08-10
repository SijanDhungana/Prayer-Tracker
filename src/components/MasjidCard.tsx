import { adhanTimes } from "../lib/prayer";
import { masjidPath } from "../lib/route";
import { formatDistance } from "../lib/distance";
import type { Masjid } from "../lib/types";
import PrayerTimeRow from "./PrayerTimeRow";

export default function MasjidCard({
  masjid,
  date,
  km,
}: {
  masjid: Masjid;
  date: Date;
  km: number;
}) {
  const times = adhanTimes(masjid, date);

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 text-base font-semibold text-stone-900">
          <a className="hover:underline" href={masjidPath(masjid.id)}>
            {masjid.name}
          </a>
        </h2>
        <span className="shrink-0 text-sm tabular-nums text-stone-500">
          {formatDistance(km)}
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-600">{masjid.address}</p>

      <div className="mt-3 border-t border-stone-100 pt-3">
        <PrayerTimeRow times={times} />
        <p className="mt-2 text-[11px] text-stone-400">
          Adhan times, calculated for this location
        </p>
      </div>

      <a
        className="mt-3 inline-block text-sm font-medium text-emerald-700 underline underline-offset-2"
        href={masjidPath(masjid.id)}
      >
        Iqamah times →
      </a>
    </li>
  );
}
