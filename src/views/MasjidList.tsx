import { useMemo } from "react";
import MasjidCard from "../components/MasjidCard";
import { haversineKm, type Point } from "../lib/distance";
import { formatCalendarDate } from "../lib/time";
import type { Masjid } from "../lib/types";

export default function MasjidList({
  masjids,
  date,
  from,
}: {
  masjids: Masjid[];
  date: Date;
  from: Point;
}) {
  const nearest = useMemo(
    () =>
      masjids
        .map((masjid) => ({ masjid, km: haversineKm(from, masjid) }))
        .sort((a, b) => a.km - b.km),
    [masjids, from],
  );

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Toronto Masjid Times
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {formatCalendarDate(date)} · {masjids.length} masjids, nearest first
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Adhan times are calculated. Iqamah times are community-collected —
          confirm with the masjid before relying on them.
        </p>
      </header>

      <ul className="mt-6 space-y-3">
        {nearest.map(({ masjid, km }) => (
          <MasjidCard key={masjid.id} masjid={masjid} date={date} km={km} />
        ))}
      </ul>
    </>
  );
}
