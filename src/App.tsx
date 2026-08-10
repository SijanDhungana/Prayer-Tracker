import Nav from "./components/Nav";
import { masjids } from "./data/masjids";
import { nextIqamahPrayer } from "./lib/prayer";
import { listPath, useHashRoute } from "./lib/route";
import { todayIn } from "./lib/time";
import ComparePrayer from "./views/ComparePrayer";
import MasjidDetail from "./views/MasjidDetail";
import MasjidList from "./views/MasjidList";

export default function App() {
  const today = todayIn();
  const route = useHashRoute();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {route.name !== "masjid" && (
          <div className="mb-6">
            <Nav route={route} />
          </div>
        )}

        {route.name === "masjid" ? (
          <MasjidDetailRoute id={route.id} date={today} />
        ) : route.name === "compare" ? (
          <ComparePrayer
            masjids={masjids}
            date={today}
            prayer={route.prayer ?? nextIqamahPrayer(masjids, today)}
          />
        ) : (
          <MasjidList masjids={masjids} date={today} />
        )}
      </div>
    </div>
  );
}

function MasjidDetailRoute({ id, date }: { id: string; date: Date }) {
  const masjid = masjids.find((m) => m.id === id);

  if (!masjid) {
    return (
      <div>
        <p className="text-sm text-stone-600">No masjid with id “{id}”.</p>
        <a
          href={listPath}
          className="mt-3 inline-block text-sm font-medium text-emerald-700 underline underline-offset-2"
        >
          ← All masjids
        </a>
      </div>
    );
  }

  return <MasjidDetail masjid={masjid} date={date} />;
}
