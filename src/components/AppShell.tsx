import { useEffect, useState, type ReactNode } from "react";
import Icon, { type IconName } from "./Icon";
import LocationChip from "./LocationChip";
import { useAuth } from "../lib/auth";
import type { ReferencePoint } from "../lib/location";
import {
  jummahPath,
  mapPath,
  nextPath,
  planPath,
  settingsPath,
  signInPath,
  type Route,
} from "../lib/route";
import { authConfigured } from "../lib/supabase";

/**
 * The five destinations, in the order design spec v2 §3 fixes them.
 *
 * Next up sits in the centre because it is the most-used screen and the
 * centre is the easiest thumb position on a phone. That position is also why
 * it gets the elevated treatment in the bar — see §7.
 */
const TABS: { name: Route["name"]; label: string; href: string; icon: IconName }[] =
  [
    { name: "map", label: "Map", href: mapPath, icon: "map-pin" },
    { name: "plan", label: "Plan", href: planPath, icon: "route" },
    { name: "next", label: "Next up", href: nextPath, icon: "clock" },
    { name: "jummah", label: "Jumu'ah", href: jummahPath, icon: "mosque" },
    { name: "settings", label: "Settings", href: settingsPath, icon: "settings" },
  ];

/** Settings owns Suggestions, so that route keeps the Settings tab lit. */
const activeTab = (route: Route): Route["name"] =>
  route.name === "suggestions" ? "settings" : route.name;

/**
 * Start fetching the Maps SDK the moment a finger lands on Map or Plan,
 * before the tap completes and the route changes.
 *
 * §8.1 keeps the SDK off the boot path, and this respects that — nothing is
 * requested until the user reaches for a screen that needs it. But touchstart
 * fires a few hundred milliseconds before the navigation, and the chunk and
 * the script can be in flight during that gap instead of after it. Failures
 * are ignored on purpose: this is a head start, and the map does its own
 * loading and error reporting when it mounts.
 */
function warmMaps(tab: Route["name"]) {
  if (tab !== "map" && tab !== "plan") return;
  void import("../lib/googleMaps")
    .then((m) => {
      if (m.googleMapsConfigured) void m.loadGoogleMaps().catch(() => {});
    })
    .catch(() => {});
}

/**
 * One nav component that switches mode by breakpoint — §6 is explicit that
 * rendering both and hiding one with CSS duplicates every focusable element,
 * which doubles the tab order for keyboard and screen-reader users.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

export default function AppShell({
  route,
  reference,
  children,
  /** The map takes the whole viewport and manages its own scrolling. */
  bleed = false,
  /** One line above the content when the times on screen are not live. */
  notice = null,
}: {
  route: Route;
  reference: ReferencePoint;
  children: ReactNode;
  bleed?: boolean;
  notice?: ReactNode;
}) {
  const isDesktop = useIsDesktop();
  const active = activeTab(route);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {/* §12: first focusable element on the page. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {isDesktop ? (
        <Sidebar active={active} reference={reference} />
      ) : (
        <TabBar active={active} />
      )}

      <main
        id="main"
        className={
          (isDesktop ? "lg:pl-[264px] " : "") +
          // The top inset is as load-bearing as the bottom one below it. Since
          // the viewport declares viewport-fit=cover, the web view extends
          // under the status bar, so a flat pt-5 put the title and the location
          // chip beneath the clock and the battery on a real phone. Resolves to
          // exactly the old 20px anywhere without a notch, so the desktop and
          // browser layouts are unchanged.
          (bleed
            ? ""
            : "mx-auto w-full max-w-[720px] px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] md:px-6 ") +
          // Clear the floating bar (§7). The map opts out and insets its own
          // furniture instead.
          (bleed || isDesktop ? "" : "pb-[calc(88px+env(safe-area-inset-bottom))]")
        }
      >
        {bleed ? (
          children
        ) : (
          <div className="pb-8">
            {notice && (
              <p
                role="status"
                className="mb-3 rounded-md bg-caution-wash px-3 py-2 text-meta text-caution"
              >
                {notice}
              </p>
            )}
            {children}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * The floating pill (§7) — not a docked full-width bar. Inset from the edges,
 * blurred, with the centre item raised and carrying --now, so the chrome
 * itself quietly reports which prayer window you are in.
 */
function TabBar({ active }: { active: Route["name"] }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 z-40 rounded-full border border-line shadow-float backdrop-blur-xl"
      style={{
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
      }}
    >
      <ul className="flex items-stretch justify-between px-1">
        {TABS.map((tab) => {
          const current = tab.name === active;
          const centre = tab.name === "next";

          return (
            <li key={tab.name} className="min-w-0 flex-1">
              <a
                href={tab.href}
                aria-current={current ? "page" : undefined}
                onTouchStart={() => warmMaps(tab.name)}
                onPointerEnter={() => warmMaps(tab.name)}
                className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-full"
              >
                {centre ? (
                  <span
                    className="-mt-4 flex h-11 w-11 items-center justify-center rounded-full shadow-float"
                    style={{ background: "var(--now)", color: "var(--paper)" }}
                  >
                    <Icon name={tab.icon} size={22} />
                  </span>
                ) : (
                  <span
                    className={
                      "flex h-8 w-12 items-center justify-center rounded-full " +
                      (current ? "bg-brand-wash text-brand" : "text-ink-3")
                    }
                    style={{ transition: "background var(--fast) var(--ease)" }}
                  >
                    <Icon name={tab.icon} size={22} />
                  </span>
                )}
                {/* The bar is fixed-height chrome spanning the viewport, so
                    its labels cannot scale freely with the root font: at a
                    200% text setting five rem-sized labels push the bar off
                    screen, which §12 forbids. Capped against the viewport and
                    truncated instead. */}
                <span
                  className={
                    "w-full truncate px-0.5 text-center " +
                    (current ? "text-brand" : centre ? "text-ink-2" : "text-ink-3")
                  }
                  style={{ fontSize: "min(var(--t--1), 3.2vw)" }}
                >
                  {tab.label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 264px sticky sidebar at lg+ (§6), with the account block pinned bottom. */
function Sidebar({
  active,
  reference,
}: {
  active: Route["name"];
  reference: ReferencePoint;
}) {
  const { session, email, isAdmin, signOut } = useAuth();

  return (
    <div className="fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "var(--now-wash)", color: "var(--now)" }}
        >
          <Icon name="mosque" size={18} />
        </span>
        <span className="font-display text-name font-semibold">Masjid Times</span>
      </div>

      <nav aria-label="Main" className="px-3">
        <ul className="space-y-1">
          {TABS.map((tab) => {
            const current = tab.name === active;
            return (
              <li key={tab.name}>
                <a
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    "relative flex min-h-[44px] items-center gap-3 rounded-md px-3 text-body " +
                    (current
                      ? "bg-brand-wash font-medium text-brand"
                      : "text-ink-2 hover:text-ink")
                  }
                >
                  {current && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-brand"
                    />
                  )}
                  <Icon name={tab.icon} size={20} />
                  {tab.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 border-t border-line px-4 py-4">
        <LocationChip reference={reference} block />
      </div>

      {/* Account is chrome, not a sentence in the content column (§2). */}
      <div className="mt-auto border-t border-line px-4 py-4">
        {authConfigured ? (
          session ? (
            <>
              <p className="truncate text-meta text-ink-3">{email}</p>
              {isAdmin && (
                <span className="mt-1 inline-block rounded-full bg-brand-wash px-2 py-0.5 text-meta font-medium text-brand">
                  Admin
                </span>
              )}
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-2 block text-meta font-medium text-ink-2 underline underline-offset-2 hover:text-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <a
              href={signInPath}
              className="text-meta font-medium text-brand underline underline-offset-2"
            >
              Sign in
            </a>
          )
        ) : null}
      </div>
    </div>
  );
}
