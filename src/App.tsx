import { Suspense, lazy, useMemo } from "react";
import AppShell from "./components/AppShell";
import { masjids as baseMasjids } from "./data/masjids";
import { AuthProvider } from "./lib/auth";
import { ClockProvider, useClock } from "./lib/clock";
import { useReferencePoint } from "./lib/location";
import { applyOverrides, useApprovedTimes } from "./lib/overrides";
import { useHashRoute } from "./lib/route";
import {
  SettingsProvider,
  applyAsrPreference,
  useSettings,
} from "./lib/settings";
import AdminSuggestions from "./views/AdminSuggestions";
import Jummah from "./views/Jummah";
import NextUp from "./views/NextUp";
import Settings from "./views/Settings";
import SignIn from "./views/SignIn";

// The Maps SDK must not load on app boot (§8.1) — only when Map or Plan is
// actually opened.
const MapScreen = lazy(() => import("./views/MapScreen"));
const PlanTrip = lazy(() => import("./views/PlanTrip"));

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ClockProvider>
          <Shell />
        </ClockProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

function Shell() {
  const route = useHashRoute();
  const reference = useReferencePoint();
  const { today } = useClock();

  // Approved corrections win over the scraper's baseline, and land as soon as
  // they're approved — no commit, no redeploy.
  const { approved, refresh: refreshApproved } = useApprovedTimes();
  const { asr } = useSettings();
  // One place to apply both: every view below reads this list, so neither an
  // approved correction nor the visitor's Asr school can be missed by a view
  // that forgot to ask for it.
  const masjids = useMemo(
    () => applyAsrPreference(applyOverrides(baseMasjids, approved), asr),
    [approved, asr],
  );

  const loading = <p className="p-4 text-body text-ink-3">Loading…</p>;

  return (
    <AppShell route={route} reference={reference} bleed={route.name === "map"}>
      {route.name === "map" ? (
        <Suspense fallback={loading}>
          <MapScreen
            masjids={masjids}
            date={today}
            reference={reference}
            masjidId={route.masjidId}
            onPublished={refreshApproved}
          />
        </Suspense>
      ) : route.name === "plan" ? (
        <Suspense fallback={loading}>
          <PlanTrip masjids={masjids} reference={reference} />
        </Suspense>
      ) : route.name === "jummah" ? (
        <Jummah masjids={masjids} date={today} from={reference.point} />
      ) : route.name === "settings" ? (
        <Settings masjids={masjids} date={today} reference={reference} />
      ) : route.name === "suggestions" ? (
        <AdminSuggestions date={today} />
      ) : route.name === "signin" ? (
        <SignIn />
      ) : (
        <NextUp
          masjids={masjids}
          from={reference.point}
          reference={reference}
          initialPrayer={route.prayer}
        />
      )}
    </AppShell>
  );
}
