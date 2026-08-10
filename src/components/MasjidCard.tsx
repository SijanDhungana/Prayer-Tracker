import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { masjidPath } from "../lib/route";
import { formatDistance } from "../lib/distance";
import { PRAYERS, type Masjid } from "../lib/types";
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
  const adhan = adhanTimes(masjid, date);
  const iqamah = iqamahTimes(masjid, date);
  // Counts recorded data, not resolved times — Maghrib always resolves now
  // because of the +2 default, and a default is not a collected time.
  const known = PRAYERS.filter((p) => masjid.iqamah[p]).length;

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
        <PrayerTimeRow iqamah={iqamah} adhan={adhan} />

        {known === 0 ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
            Iqamah times not collected yet — small times are the calculated
            adhan.{" "}
            <a
              className="font-medium underline underline-offset-2"
              href={masjid.website}
              target="_blank"
              rel="noreferrer"
            >
              Check the masjid&rsquo;s site
            </a>
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-stone-400">
            Iqamah in bold · adhan below
          </p>
        )}
      </div>

      <a
        className="mt-3 inline-block text-sm font-medium text-emerald-700 underline underline-offset-2"
        href={masjidPath(masjid.id)}
      >
        Full day →
      </a>
    </li>
  );
}
