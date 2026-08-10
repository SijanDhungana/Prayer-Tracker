import { adhanTimes, iqamahTimes, sunriseTime } from "../lib/prayer";
import { formatCalendarDate, formatIsoDate, formatTime } from "../lib/time";
import { PRAYERS, PRAYER_LABELS, type Masjid } from "../lib/types";

function mapsUrl(masjid: Masjid) {
  const query = encodeURIComponent(`${masjid.name}, ${masjid.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default function MasjidDetail({
  masjid,
  date,
}: {
  masjid: Masjid;
  date: Date;
}) {
  const adhan = adhanTimes(masjid, date);
  const iqamah = iqamahTimes(masjid, date);
  const sunrise = sunriseTime(masjid, date);
  const verified = masjid.lastVerified
    ? formatIsoDate(masjid.lastVerified)
    : null;

  return (
    <article>
      <a
        href="#"
        className="text-sm font-medium text-emerald-700 underline underline-offset-2"
      >
        ← All masjids
      </a>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {masjid.name}
      </h1>
      <p className="mt-1 text-sm text-stone-600">{masjid.address}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-emerald-700">
        <a
          className="underline underline-offset-2"
          href={mapsUrl(masjid)}
          target="_blank"
          rel="noreferrer"
        >
          Directions
        </a>
        <a
          className="underline underline-offset-2"
          href={masjid.website}
          target="_blank"
          rel="noreferrer"
        >
          Official site
        </a>
      </div>

      <h2 className="mt-6 text-sm font-medium text-stone-500">
        {formatCalendarDate(date)}
      </h2>

      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <th className="py-2 font-medium">Prayer</th>
            <th className="py-2 text-right font-medium">Adhan</th>
            <th className="py-2 text-right font-medium">Iqamah</th>
          </tr>
        </thead>
        <tbody>
          {PRAYERS.map((prayer) => (
            <tr key={prayer} className="border-b border-stone-100">
              <th scope="row" className="py-2.5 text-left font-medium">
                {PRAYER_LABELS[prayer]}
              </th>
              <td className="py-2.5 text-right tabular-nums text-stone-600">
                {formatTime(adhan[prayer])}
              </td>
              <td className="py-2.5 text-right text-base font-semibold tabular-nums">
                {iqamah[prayer] ? formatTime(iqamah[prayer]!) : "—"}
              </td>
            </tr>
          ))}
          <tr className="border-b border-stone-100 text-stone-500">
            <th scope="row" className="py-2.5 text-left font-normal">
              Sunrise
              <span className="block text-xs text-stone-400">Fajr ends</span>
            </th>
            <td className="py-2.5 text-right tabular-nums">
              {formatTime(sunrise)}
            </td>
            <td className="py-2.5 text-right">—</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-xs text-stone-500">
        {verified
          ? `Iqamah times last verified ${verified}.`
          : "Iqamah times have not been verified yet — treat them as a starting point only."}{" "}
        Adhan times are calculated for this location. Confirm with the masjid
        before relying on either.
      </p>
    </article>
  );
}
