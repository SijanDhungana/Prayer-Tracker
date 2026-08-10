import type { Masjid } from "../lib/types";

export default function MasjidCard({ masjid }: { masjid: Masjid }) {
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-stone-900">{masjid.name}</h2>
      <p className="mt-1 text-sm text-stone-600">{masjid.address}</p>
      <a
        className="mt-3 inline-block text-sm font-medium text-emerald-700 underline underline-offset-2"
        href={masjid.website}
        target="_blank"
        rel="noreferrer"
      >
        Official site
      </a>
    </li>
  );
}
