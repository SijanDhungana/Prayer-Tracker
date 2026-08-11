import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { masjidPath } from "../lib/route";
import { formatDistance } from "../lib/distance";
import { PRAYERS, type Masjid } from "../lib/types";
import PrayerTimeRow from "./PrayerTimeRow";
import TrustBadge from "./TrustBadge";

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
    <li className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 text-base font-semibold text-ink">
          <a className="hover:underline" href={masjidPath(masjid.id)}>
            {masjid.name}
          </a>
        </h2>
        <span className="shrink-0 text-sm tabular-nums text-ink-3">
          {formatDistance(km)}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-2">{masjid.address}</p>

      {/* When nothing has been collected the card already says so below, at
          more length and with somewhere to go about it. A "Not verified yet"
          pill above that is the same news twice. */}
      {known > 0 && (
        <div className="mt-2">
          <TrustBadge masjid={masjid} today={date} />
        </div>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <PrayerTimeRow iqamah={iqamah} adhan={adhan} />

        {known === 0 ? (
          <p className="mt-2 rounded-lg bg-caution-wash px-2 py-1.5 text-[11px] text-caution">
            Iqamah times not collected yet — small times are the calculated
            adhan.{" "}
            {/* Newly discovered masjids may have no website on file yet;
                a link to nowhere is worse than no link. */}
            {masjid.website && (
              <a
                className="font-medium underline underline-offset-2"
                href={masjid.website}
                target="_blank"
                rel="noreferrer"
              >
                Check the masjid&rsquo;s site
              </a>
            )}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-ink-3">
            Iqamah in bold · adhan below
          </p>
        )}
      </div>

      <a
        className="mt-3 inline-block text-sm font-medium text-brand underline underline-offset-2"
        href={masjidPath(masjid.id)}
      >
        Full day →
      </a>
    </li>
  );
}
