import { masjids } from "./data/masjids";
import { masjidIdFrom, useHashRoute } from "./lib/route";
import { todayIn } from "./lib/time";
import MasjidDetail from "./views/MasjidDetail";
import MasjidList from "./views/MasjidList";

export default function App() {
  const today = todayIn();
  const route = useHashRoute();

  const selectedId = masjidIdFrom(route);
  const selected = selectedId
    ? masjids.find((m) => m.id === selectedId)
    : undefined;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {selectedId && !selected ? (
          <div>
            <p className="text-sm text-stone-600">
              No masjid with id “{selectedId}”.
            </p>
            <a
              href="#"
              className="mt-3 inline-block text-sm font-medium text-emerald-700 underline underline-offset-2"
            >
              ← All masjids
            </a>
          </div>
        ) : selected ? (
          <MasjidDetail masjid={selected} date={today} />
        ) : (
          <MasjidList masjids={masjids} date={today} />
        )}
      </div>
    </div>
  );
}
