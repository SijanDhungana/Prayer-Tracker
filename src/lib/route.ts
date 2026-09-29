import { useEffect, useMemo, useRef, useState } from "react";
import { PRAYERS, type Prayer } from "./types";

/**
 * Minimal hash routing. The app is a static bundle with no server to rewrite
 * paths, and hash URLs keep the phone's back button and shareable links
 * working without pulling in a router.
 *
 * Five destinations (design spec v2 §3) and nothing else gets a tab. The
 * screens that used to be tabs are absorbed rather than deleted: the masjid
 * list is the map's results sheet, Compare is Next up's prayer selector, and
 * Suggestions lives inside Settings.
 *
 * A masjid's details are not a destination but an overlay: `#/masjid/:id` is
 * drawn over whichever screen opened it, which stays underneath, keeps its
 * tab lit, and is exactly where closing the sheet goes back to.
 */
export type Route =
  | { name: "next"; prayer: Prayer | null }
  | { name: "map" }
  | { name: "masjid"; masjidId: string }
  | { name: "plan" }
  | { name: "jummah" }
  | { name: "settings" }
  | { name: "suggestions" }
  | { name: "signin" };

export const nextPath = "#/";
export const mapPath = "#/map";
export const planPath = "#/plan";
export const jummahPath = "#/jummah";
export const settingsPath = "#/settings";
export const suggestionsPath = "#/settings/suggestions";
export const signInPath = "#/signin";

export const masjidPath = (id: string) => `#/masjid/${encodeURIComponent(id)}`;
export const prayerPath = (prayer: Prayer) => `#/?prayer=${prayer}`;

/** A route that is a screen of its own, as opposed to an overlay on one. */
export type Screen = Exclude<Route, { name: "masjid" }>;

/** The hash that shows a screen. */
export function pathOf(screen: Screen): string {
  switch (screen.name) {
    case "next": return screen.prayer ? prayerPath(screen.prayer) : nextPath;
    case "map": return mapPath;
    case "plan": return planPath;
    case "jummah": return jummahPath;
    case "settings": return settingsPath;
    case "suggestions": return suggestionsPath;
    case "signin": return signInPath;
  }
}

const isPrayer = (value: string | null): value is Prayer =>
  value != null && (PRAYERS as readonly string[]).includes(value);

/**
 * Old links must keep working (§3). Returns the hash to replace the current
 * one with, or null when nothing needs redirecting.
 */
export function redirectFor(hash: string): string | null {
  const [path] = hash.replace(/^#/, "").split("?");

  if (/^\/masjids\/?$/.test(path)) return mapPath;
  if (/^\/compare\/?$/.test(path)) return nextPath;

  const compare = /^\/compare\/([a-z]+)\/?$/.exec(path);
  if (compare) return isPrayer(compare[1]) ? prayerPath(compare[1]) : nextPath;

  // For a while the details lived under the map, at #/map/:id; those links
  // were shared, so they land on the overlay route that replaced them.
  const underMap = /^\/map\/(.+)$/.exec(path);
  if (underMap) return `#/masjid/${underMap[1]}`;

  if (/^\/suggestions\/?$/.test(path)) return suggestionsPath;
  if (/^\/admin\/suggestions\/?$/.test(path)) return suggestionsPath;

  return null;
}

export function parseRoute(hash: string): Route {
  const [rawPath, rawQuery] = hash.replace(/^#/, "").split("?");
  const path = rawPath || "/";
  const query = new URLSearchParams(rawQuery ?? "");

  if (/^\/plan\/?$/.test(path)) return { name: "plan" };
  if (/^\/jummah\/?$/.test(path)) return { name: "jummah" };
  if (/^\/signin\/?$/.test(path)) return { name: "signin" };
  if (/^\/settings\/suggestions\/?$/.test(path)) return { name: "suggestions" };
  if (/^\/settings\/?$/.test(path)) return { name: "settings" };

  // #/map/:id is the older spelling (see redirectFor), parsed the same way so
  // the first render before the redirect lands already shows the masjid.
  const detail = /^\/(?:masjid|map)\/(.+)$/.exec(path);
  if (detail) return { name: "masjid", masjidId: decodeURIComponent(detail[1]) };
  if (/^\/map\/?$/.test(path)) return { name: "map" };

  const prayer = query.get("prayer");
  return { name: "next", prayer: isPrayer(prayer) ? prayer : null };
}

export function useHashRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => {
      const next = window.location.hash;
      const redirect = redirectFor(next);
      if (redirect) {
        // replace, not assign: an old link shouldn't leave a dead entry in
        // the back stack for the user to walk back into.
        window.location.replace(redirect);
        return;
      }
      setHash(next);
    };
    onChange();
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  // The map owns its own scroll and its sheet; resetting it would fight them.
  // Nor does opening or closing a masjid's sheet move the screen beneath it:
  // closing one from halfway down Home should leave you halfway down Home.
  const previous = useRef(hash);
  useEffect(() => {
    const was = previous.current;
    previous.current = hash;
    if (isOverlayHash(hash) || isOverlayHash(was)) return;
    if (!hash.startsWith("#/map")) window.scrollTo(0, 0);
  }, [hash]);

  // One object per hash, so effects that depend on the route run when the
  // route changes rather than on every render.
  return useMemo(() => parseRoute(hash), [hash]);
}

const isOverlayHash = (hash: string) => /^#\/(?:masjid|map)\/./.test(hash);

/** Routes drawn over another screen rather than replacing it. */
export const isOverlay = (
  route: Route,
): route is Extract<Route, { name: "masjid" }> => route.name === "masjid";

const TABS: ReadonlySet<Route["name"]> = new Set(["next", "map", "jummah", "settings"]);
const HOME: Screen = { name: "next", prayer: null };
const OVERLAY_LINK = 'a[href^="#/masjid/"]';

export interface Underlay {
  /** The screen an overlay is drawn over: the last route that wasn't one. */
  base: Screen;
  /**
   * Whether the open overlay came from a tap on a link in the app, which puts
   * it directly on top of that screen in the browser's history — so closing
   * it is simply Back. Arrived at any other way (a shared link, Back or
   * Forward) there may be nothing of the app's behind it, and it closes onto
   * its screen in place instead.
   */
  openedHere: boolean;
  /** The last tab destination visited, for screens reached from more than one. */
  lastTab: Route["name"];
}

/**
 * What an overlay sits on, and where the visitor came from.
 *
 * Masjid details used to be a route under the map, so opening one from Home
 * switched the tab bar to Map, loaded the map behind it and asked for the
 * device's location; closing it landed on the Map tab, and Back reopened the
 * sheet that had just been closed. Drawn over the screen that opened it, that
 * screen, its tab and its scroll all stay exactly as they were.
 */
export function useUnderlay(route: Route): Underlay {
  const [underlay, setUnderlay] = useState<Underlay>(() => ({
    base: isOverlay(route) ? HOME : route,
    openedHere: false,
    lastTab: TABS.has(route.name) ? route.name : "next",
  }));

  // Which overlay link was tapped last. Keyboard activation and taps both
  // arrive as clicks, before the hash changes.
  const clicked = useRef<string | null>(null);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(OVERLAY_LINK);
      clicked.current = link?.getAttribute("href") ?? null;
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (isOverlay(route)) {
      const openedHere = clicked.current === window.location.hash;
      clicked.current = null;
      setUnderlay((prev) => ({ ...prev, openedHere }));
      return;
    }
    setUnderlay((prev) => ({
      base: route,
      openedHere: false,
      lastTab: TABS.has(route.name) ? route.name : prev.lastTab,
    }));
  }, [route]);

  return underlay;
}
