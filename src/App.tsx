import { Suspense, lazy, useMemo } from "react";
import LocationPicker from "./components/LocationPicker";
import Nav from "./components/Nav";
import { masjids as baseMasjids } from "./data/masjids";
import type { Point } from "./lib/distance";
import { AuthProvider } from "./lib/auth";
import { applyOverrides, useApprovedTimes } from "./lib/overrides";
import { useReferencePoint } from "./lib/location";
import { nextIqamahPrayer } from "./lib/prayer";
import { listPath, useHashRoute } from "./lib/route";
import { todayIn } from "./lib/time";
import AdminSuggestions from "./views/AdminSuggestions";
import ComparePrayer from "./views/ComparePrayer";
import MasjidDetail from "./views/MasjidDetail";
import MasjidList from "./views/MasjidList";
import SignIn from "./views/SignIn";

// Leaflet and its stylesheet are bigger than everything else here combined,
// and most visits never open the map. Split so a visitor checking a time
// pays nothing for it.
const MapView = lazy(() => import("./views/MapView"));

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const today = todayIn();
  const route = useHashRoute();
  const reference = useReferencePoint();

  // Approved corrections win over the scraper's baseline, and land as soon as
  // they're approved — no commit, no redeploy.
  const { approved, refresh: refreshApproved } = useApprovedTimes();
  const masjids = useMemo(
    () => applyOverrides(baseMasjids, approved),
    [approved],
  );

  const chrome = route.name !== "masjid";

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {chrome && (
          <div className="mb-6 space-y-3">
            <Nav route={route} />
            {route.name !== "signin" && route.name !== "admin" && (
              <LocationPicker reference={reference} />
            )}
          </div>
        )}

        {route.name === "signin" ? (
          <SignIn />
        ) : route.name === "admin" ? (
          <AdminSuggestions date={today} />
        ) : route.name === "masjid" ? (
          <MasjidDetailRoute
            id={route.id}
            masjids={masjids}
            date={today}
            from={reference.point}
            fromLabel={reference.label}
            onPublished={refreshApproved}
          />
        ) : route.name === "map" ? (
          <Suspense
            fallback={
              <p className="text-sm text-stone-500">Loading the map…</p>
            }
          >
            <MapView masjids={masjids} date={today} reference={reference} />
          </Suspense>
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
  masjids,
  date,
  from,
  fromLabel,
  onPublished,
}: {
  id: string;
  masjids: typeof baseMasjids;
  date: Date;
  from: Point;
  fromLabel: string;
  onPublished: () => void;
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
      onPublished={onPublished}
    />
  );
}
