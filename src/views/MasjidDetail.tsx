import { useState } from "react";
import {
  adhanTimes,
  effectiveRule,
  iqamahTimes,
  orderedJumuah,
  sunriseTime,
} from "../lib/prayer";
import { listPath } from "../lib/route";
import { formatDistance, haversineKm, type Point } from "../lib/distance";
import {
  formatCalendarDate,
  formatClock,
  formatIsoDate,
  formatTime,
} from "../lib/time";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";
import SuggestTimeForm from "../components/SuggestTimeForm";

function mapsUrl(masjid: Masjid) {
  const query = encodeURIComponent(`${masjid.name}, ${masjid.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * The masjid's Friday sittings.
 *
 * Shown as a list rather than a single time because the count genuinely
 * varies — one at a small masjid, four where space is tight — and the later
 * sittings are the whole reason someone checks: they are what you attend when
 * you cannot get away at one o'clock. Numbering them makes it obvious at a
 * glance how many there are.
 */
function Jumuah({
  masjid,
  onSuggest,
}: {
  masjid: Masjid;
  onSuggest: () => void;
}) {
  const sessions = orderedJumuah(masjid);

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-stone-500">
        Friday · Jumu&rsquo;ah
      </h2>

      {sessions.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-600">
          No Friday times on file yet.{" "}
          <button
            type="button"
            onClick={onSuggest}
            className="font-medium text-emerald-700 underline underline-offset-2"
          >
            Suggest one
          </button>
        </p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {sessions.map((session, index) => (
              <li
                key={`${session.khutbah}-${index}`}
                className="flex items-baseline justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm text-stone-600">
                  {sessions.length > 1 ? `${ordinal(index + 1)} khutbah` : "Khutbah"}
                </span>
                <span className="text-lg font-semibold tabular-nums text-stone-900">
                  {formatClock(session.khutbah)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-stone-500">
            {sessions.length === 1
              ? "One sitting."
              : `${sessions.length} sittings.`}{" "}
            Times are when the khutbah begins.
          </p>
        </>
      )}
    </section>
  );
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
const ordinal = (n: number) => ORDINALS[n - 1] ?? `${n}th`;

export default function MasjidDetail({
  masjid,
  date,
  from,
  fromLabel,
  onPublished,
}: {
  masjid: Masjid;
  date: Date;
  from: Point;
  fromLabel: string;
  onPublished?: () => void;
}) {
  const adhan = adhanTimes(masjid, date);
  const iqamah = iqamahTimes(masjid, date);
  const sunrise = sunriseTime(masjid, date);
  const verified = masjid.lastVerified
    ? formatIsoDate(masjid.lastVerified)
    : null;

  const [suggesting, setSuggesting] = useState<Prayer | "jumuah" | null>(null);

  return (
    <article>
      <a
        href={listPath}
        className="text-sm font-medium text-emerald-700 underline underline-offset-2"
      >
        ← All masjids
      </a>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {masjid.name}
      </h1>
      <p className="mt-1 text-sm text-stone-600">{masjid.address}</p>
      <p className="mt-1 text-sm text-stone-500">
        {formatDistance(haversineKm(from, masjid))} from {fromLabel}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-emerald-700">
        <a
          className="underline underline-offset-2"
          href={mapsUrl(masjid)}
          target="_blank"
          rel="noreferrer"
        >
          Directions
        </a>
        {masjid.website && (
          <a
            className="underline underline-offset-2"
            href={masjid.website}
            target="_blank"
            rel="noreferrer"
          >
            Official site
          </a>
        )}
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
                {iqamah[prayer] ? (
                  <>
                    {formatTime(iqamah[prayer]!)}
                    <RuleNote masjid={masjid} prayer={prayer} />
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSuggesting(prayer)}
                    className="text-sm font-medium text-emerald-700 underline underline-offset-2"
                  >
                    Suggest
                  </button>
                )}
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

      <Jumuah masjid={masjid} onSuggest={() => setSuggesting("jumuah")} />

      {suggesting ? (
        <SuggestTimeForm
          masjid={masjid}
          adhan={adhan}
          iqamah={iqamah}
          initialPrayer={suggesting}
          onClose={() => setSuggesting(null)}
          onPublished={onPublished}
        />
      ) : (
        <button
          type="button"
          onClick={() => setSuggesting(firstMissing(iqamah))}
          className="mt-4 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:text-stone-900"
        >
          Suggest a time
        </button>
      )}

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

/**
 * Says how a time was arrived at when it wasn't simply announced: an offset
 * tracks that day's adhan, and the Maghrib fallback is not something a masjid
 * confirmed. A plain recorded clock time needs no explanation.
 */
function RuleNote({ masjid, prayer }: { masjid: Masjid; prayer: Prayer }) {
  const { rule, isDefault } = effectiveRule(masjid, prayer);
  if (!rule || rule.type !== "offset") return null;

  const gap =
    rule.minutes === 0 ? "right after adhan" : `${rule.minutes} min after adhan`;

  return (
    <span className="block text-[11px] font-normal text-stone-400">
      {gap}
      {isDefault && " (assumed)"}
    </span>
  );
}

/** Open the form on the first gap, since that's what most needs filling. */
function firstMissing(iqamah: Record<Prayer, Date | null>): Prayer {
  return PRAYERS.find((p) => iqamah[p] == null) ?? "fajr";
}
