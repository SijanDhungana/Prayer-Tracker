import MasjidCard from "../components/MasjidCard";
import { formatCalendarDate } from "../lib/time";
import type { Masjid } from "../lib/types";

export default function MasjidList({
  masjids,
  date,
}: {
  masjids: Masjid[];
  date: Date;
}) {
  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Toronto Masjid Times
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {formatCalendarDate(date)} · {masjids.length} masjids
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Adhan times are calculated. Iqamah times are community-collected —
          confirm with the masjid before relying on them.
        </p>
      </header>

      <ul className="mt-6 space-y-3">
        {masjids.map((m) => (
          <MasjidCard key={m.id} masjid={m} date={date} />
        ))}
      </ul>
    </>
  );
}
