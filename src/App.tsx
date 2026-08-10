import MasjidCard from "./components/MasjidCard";
import { masjids } from "./data/masjids";

export default function App() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            Toronto Masjid Times
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {masjids.length} masjids. Iqamah times are community-collected —
            confirm with the masjid before relying on them.
          </p>
        </header>

        <ul className="mt-6 space-y-3">
          {masjids.map((m) => (
            <MasjidCard key={m.id} masjid={m} />
          ))}
        </ul>
      </div>
    </div>
  );
}
