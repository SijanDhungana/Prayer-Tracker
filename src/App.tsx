import { Suspense, lazy, useCallback, useMemo } from "react";
import AppShell from "./components/AppShell";
import MasjidDetailSheet from "./components/MasjidDetailSheet";
import { AuthProvider } from "./lib/auth";
import { useMasjidData } from "./lib/masjidData";
import { ClockProvider, useClock } from "./lib/clock";
import { useReferencePoint } from "./lib/location";
import { applyOverrides, useApprovedTimes } from "./lib/overrides";
import { isOverlay, pathOf, useHashRoute, useUnderlay, type Screen } from "./lib/route";
import {
  SettingsProvider,
  applyAsrPreference,
  useSettings,
} from "./lib/settings";
import { formatTime } from "./lib/time";
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
  // A masjid's details are drawn over the screen that opened it, which keeps
  // rendering underneath — see useUnderlay.
  const { base, openedHere, lastTab } = useUnderlay(route);
  const screen: Screen = isOverlay(route) ? base : route;
  const reference = useReferencePoint();
  const { today } = useClock();

  // Approved corrections win over the scraper's baseline, and land as soon as
  // they're approved — no commit, no redeploy.
  const { approved, refresh: refreshApproved } = useApprovedTimes();
  const { asr } = useSettings();
  // The directory the deployment is serving now, falling back to the copy this
  // build shipped with. A packaged app would otherwise be frozen on its own
  // build date — see src/lib/masjidData.ts.
  const { masjids: baseMasjids, source, fetchedAt } = useMasjidData();

  /**
   * Say when the times on screen are not live — §10.7 promised "Showing
   * times from 9:14 AM" and nothing rendered it; `source` and `fetchedAt`
   * came back from the hook and were dropped on the floor here.
   *
   * Quiet on a normal boot: the cache is shown for the half-second before
   * the fetch lands, and a banner that flashes on every launch would teach
   * people to ignore it. It appears only once the saved copy is genuinely
   * old, or the device reports it has no connection at all.
   */
  const notice = useMemo(() => {
    if (source === "network") return null;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (fetchedAt == null) {
      return offline
        ? "No connection — showing the times this app shipped with."
        : null;
    }
    const ageHours = (Date.now() - fetchedAt) / 3_600_000;
    if (!offline && ageHours < 6) return null;
    return `Showing times saved at ${formatTime(new Date(fetchedAt))}${
      offline ? " — no connection" : ""
    }.`;
  }, [source, fetchedAt]);
  // One place to apply both: every view below reads this list, so neither an
  // approved correction nor the visitor's Asr school can be missed by a view
  // that forgot to ask for it.
  const masjids = useMemo(
    () => applyAsrPreference(applyOverrides(baseMasjids, approved), asr),
    // baseMasjids belongs here now that it is state rather than a module
    // constant: without it the runtime fetch lands, the cache updates, and the
    // screen goes on rendering the copy the build shipped with.
    [baseMasjids, approved, asr],
  );

  const loading = <p className="p-4 text-body text-ink-3">Loading…</p>;

  const openMasjid = isOverlay(route)
    ? (masjids.find((m) => m.id === route.masjidId) ?? null)
    : null;
  const closeMasjid = useCallback(() => {
    // Opened by a tap, the screen that was tapped is the entry right behind
    // it, so closing is the browser's own Back and history stays clean. Any
    // other way in, it closes onto that screen in place.
    if (openedHere) window.history.back();
    else window.location.replace(pathOf(base));
  }, [openedHere, base]);

  return (
    <>
      <AppShell
        route={screen}
        lastTab={lastTab}
        reference={reference}
        bleed={screen.name === "map"}
        notice={notice}
      >
        {screen.name === "map" ? (
          <Suspense fallback={loading}>
            <MapScreen masjids={masjids} date={today} reference={reference} />
          </Suspense>
        ) : screen.name === "plan" ? (
          <Suspense fallback={loading}>
            <PlanTrip masjids={masjids} reference={reference} />
          </Suspense>
        ) : screen.name === "jummah" ? (
          <Jummah masjids={masjids} date={today} from={reference.point} />
        ) : screen.name === "settings" ? (
          <Settings masjids={masjids} date={today} reference={reference} />
        ) : screen.name === "suggestions" ? (
          <AdminSuggestions date={today} />
        ) : screen.name === "signin" ? (
          <SignIn />
        ) : (
          <NextUp
            masjids={masjids}
            from={reference.point}
            reference={reference}
            initialPrayer={screen.prayer}
          />
        )}
      </AppShell>
      {openMasjid && (
        <MasjidDetailSheet
          key={openMasjid.id}
          masjid={openMasjid}
          date={today}
          from={reference.point}
          onClose={closeMasjid}
          onPublished={refreshApproved}
        />
      )}
    </>
  );
}
