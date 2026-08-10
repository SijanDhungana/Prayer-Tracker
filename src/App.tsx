import LocationPicker from "./components/LocationPicker";
import Nav from "./components/Nav";
import { masjids } from "./data/masjids";
import type { Point } from "./lib/distance";
import { useReferencePoint } from "./lib/location";
import { nextIqamahPrayer } from "./lib/prayer";
import { listPath, useHashRoute } from "./lib/route";
import { todayIn } from "./lib/time";
import ComparePrayer from "./views/ComparePrayer";
import MasjidDetail from "./views/MasjidDetail";
import MasjidList from "./views/MasjidList";

export default function App() {
  const today = todayIn();
  const route = useHashRoute();
  const reference = useReferencePoint();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {route.name !== "masjid" && (
          <div className="mb-6 space-y-3">
            <Nav route={route} />
            <LocationPicker reference={reference} />
          </div>
        )}

        {route.name === "masjid" ? (
          <MasjidDetailRoute
            id={route.id}
            date={today}
            from={reference.point}
            fromLabel={reference.label}
          />
        ) : route.name === "compare" ? (
          <ComparePrayer
            masjids={masjids}
            date={today}
            prayer={route.prayer ?? nextIqamahPrayer(masjids, today)}
            from={reference.point}
          />
        ) : (
          <MasjidList masjids={masjids} date={today} from={reference.point} />
        )}
      </div>
    </div>
  );
}

function MasjidDetailRoute({
  id,
  date,
  from,
  fromLabel,
}: {
  id: string;
  date: Date;
  from: Point;
  fromLabel: string;
}) {
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

  return (
    <MasjidDetail
      masjid={masjid}
      date={date}
      from={from}
      fromLabel={fromLabel}
    />
  );
}
